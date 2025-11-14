// server.js — مع دعم equity و today + Basic Auth للواجهة
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== In-memory store =====
/*
  accounts = {
    [id]: {
      account_id: string,
      alias: string,
      initial_balance: number,
      today: number,                      // آخر Today PnL مستلم
      last: { balance, equity, timestamp },
      history: [ { balance, equity, timestamp }, ... ] // أحدث عنصر في النهاية
    }
  }
*/
const accounts = {};

// ===== Middlewares =====
app.use(express.json({ limit: "256kb" })); // JSON body

// ===== Basic Auth (يحمي الواجهة و /accounts فقط) =====
const USER = process.env.DASH_USER || "admin";
const PASS = process.env.DASH_PASS || "1234"; // غيّرها في بيئة Render

function authUI(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    const idx = decoded.indexOf(":");
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    if (u === USER && p === PASS) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="FahadScalp Dashboard"');
  return res.status(401).send("Authentication required");
}

// ===== Helpers =====
function toMs(ts) {
  // يقبل رقم بالثواني أو المللي ثانية أو نص يمثل رقم
  const n = Number(ts);
  if (!Number.isFinite(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n; // إن كان بالثواني حوّله لمللي ثانية
}

function toNum(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

// ===== Webhook (مفتوح لبوت MT4) =====
app.post("/webhook", (req, res) => {
  const body = req.body || {};

  // تحقق أساسي
  if (body.account_id == null || body.initial_balance == null || body.balance == null) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }

  const id       = String(body.account_id);
  const alias    = typeof body.alias === "string" ? body.alias : "";
  const initial  = toNum(body.initial_balance, NaN);
  const balance  = toNum(body.balance, NaN);
  const equity   = body.equity != null ? toNum(body.equity, NaN) : NaN;
  const today    = body.today  != null ? toNum(body.today, 0)    : 0;
  const timestamp= toMs(body.timestamp != null ? body.timestamp : Date.now());

  if (!Number.isFinite(initial) || !Number.isFinite(balance)) {
    return res.status(400).send("❌ قيم غير رقمية");
  }

  // تهيئة الحساب إن لم يوجد
  if (!accounts[id]) {
    accounts[id] = {
      account_id: id,
      alias: alias || "",
      initial_balance: initial,
      today: 0,
      last: { balance, equity: Number.isFinite(equity)?equity:undefined, timestamp },
      history: []
    };
  }

  // تحديث alias / initial_balance عند الاختلاف
  if (alias) accounts[id].alias = alias;
  if (Number.isFinite(initial)) accounts[id].initial_balance = initial;

  // خزّن today (آخر قيمة)
  accounts[id].today = today;

  // أضف نقطة تاريخ (مع equity إن توفّر)
  const point = { balance: toNum(balance, 0), timestamp };
  if (Number.isFinite(equity)) point.equity = equity;

  accounts[id].history.push(point);
  // حدّد طول التاريخ لآخر 200 عنصر
  if (accounts[id].history.length > 200) {
    accounts[id].history = accounts[id].history.slice(-200);
  }

  // حدّث last
  const last = accounts[id].history[accounts[id].history.length - 1];
  accounts[id].last = {
    balance: last.balance,
    equity: last.equity,          // قد تكون undefined إذا لم تُرسل
    timestamp: last.timestamp
  };

  return res.status(200).send("✅ Webhook received");
});

// (اختياري) منع POST على الجذر
app.post("/", (req, res) => res.status(404).send("Use POST /webhook"));

// ===== واجهة + /accounts (محميّة) =====
app.get("/accounts", authUI, (req, res) => {
  const shaped = {};
  for (const [id, acc] of Object.entries(accounts)) {
    shaped[id] = {
      account_id: acc.account_id,
      alias: acc.alias || "",
      initial_balance: toNum(acc.initial_balance, 0),
      today: toNum(acc.today, 0),
      last: {
        balance: toNum(acc.last?.balance, acc.initial_balance || 0),
        equity:  acc.last?.equity != null ? toNum(acc.last.equity) : undefined,
        timestamp: acc.last?.timestamp || null
      },
      history: acc.history.map(h => ({
        balance: toNum(h.balance, 0),
        equity:  h.equity != null ? toNum(h.equity) : undefined,
        timestamp: h.timestamp || null
      }))
    };
  }
  res.json(shaped);
});

// قدّم الملفات الساكنة (index.html, script.js, styles.css) بعد auth
app.use("/", authUI, express.static(path.join(__dirname, ".")));

// (اختياري) فحص صحة الخدمة
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`✅ Server listening at :${PORT}`);
});
