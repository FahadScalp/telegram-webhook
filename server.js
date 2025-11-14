// server.js — مع دعم equity/today + Basic Auth + تخزين JSON آمن
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Basic Auth (يحمي الواجهة و /accounts و /backup) =====
const USER = process.env.DASH_USER || "admin";
const PASS = process.env.DASH_PASS || "1234"; // غيّرها في Render → Environment

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

// ===== تخزين في الذاكرة =====
/*
  accounts = {
    [id]: {
      account_id: string,
      alias: string,
      initial_balance: number,
      today: number,
      last: { balance:number, equity?:number, timestamp:number },
      history: [ { balance:number, equity?:number, timestamp:number }, ... ] // أحدث عنصر في النهاية
    }
  }
*/
let accounts = {};

// ===== أدوات =====
app.use(express.json({ limit: "256kb" }));

function toMs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n; // إن كانت ثواني → مللي ثانية
}
function toNum(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

// ====== حفظ/تحميل JSON ======
const DATA_FILE = path.join(__dirname, "data.json");
let saveTimer = null;
const SAVE_DELAY_MS = 400; // Debounce

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
}

function saveNow(cb) {
  // كتابة ذرّية: نكتب لملف tmp ثم نعيد تسميته
  const tmp = DATA_FILE + ".tmp";
  const data = JSON.stringify({ accounts }, null, 2);
  fs.writeFile(tmp, data, "utf8", (err) => {
    if (err) {
      console.error("❌ save write error:", err.message);
      if (cb) cb(err);
      return;
    }
    fs.rename(tmp, DATA_FILE, (err2) => {
      if (err2) console.error("❌ save rename error:", err2.message);
      else console.log("💾 data.json saved.");
      if (cb) cb(err2);
    });
  });
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object" && obj.accounts && typeof obj.accounts === "object") {
        accounts = obj.accounts;
        console.log("📥 data.json loaded.");
      } else {
        console.warn("⚠️ data.json structure unexpected. Starting empty.");
      }
    } else {
      console.log("ℹ️ data.json not found. Starting fresh.");
    }
  } catch (e) {
    console.error("❌ load error:", e.message);
  }
}
loadFromDisk();

// حاول حفظ عند الإنهاء
process.on("SIGTERM", () => saveNow(() => process.exit(0)));
process.on("SIGINT",  () => saveNow(() => process.exit(0)));

// ===== Webhook (مفتوح لبوت MT4) =====
app.post("/webhook", (req, res) => {
  const body = req.body || {};
  if (body.account_id == null || body.initial_balance == null || body.balance == null) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }

  const id        = String(body.account_id);
  const alias     = typeof body.alias === "string" ? body.alias : "";
  const initial   = toNum(body.initial_balance, NaN);
  const balance   = toNum(body.balance, NaN);
  const equity    = body.equity != null ? toNum(body.equity, NaN) : NaN;
  const today     = body.today  != null ? toNum(body.today, 0)    : 0;
  const timestamp = toMs(body.timestamp != null ? body.timestamp : Date.now());

  if (!Number.isFinite(initial) || !Number.isFinite(balance)) {
    return res.status(400).send("❌ قيم غير رقمية");
  }

  if (!accounts[id]) {
    accounts[id] = {
      account_id: id,
      alias: alias || "",
      initial_balance: initial,
      today: 0,
      last: { balance, equity: Number.isFinite(equity) ? equity : undefined, timestamp },
      history: []
    };
  }
  if (alias) accounts[id].alias = alias;
  if (Number.isFinite(initial)) accounts[id].initial_balance = initial;
  accounts[id].today = today;

  const point = { balance: toNum(balance, 0), timestamp };
  if (Number.isFinite(equity)) point.equity = equity;

  accounts[id].history.push(point);
  if (accounts[id].history.length > 200) {
    accounts[id].history = accounts[id].history.slice(-200);
  }
  const last = accounts[id].history[accounts[id].history.length - 1];
  accounts[id].last = { balance: last.balance, equity: last.equity, timestamp: last.timestamp };

  scheduleSave(); // ← احفظ بعد كل تحديث
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
      history: (acc.history || []).map(h => ({
        balance: toNum(h.balance, 0),
        equity:  h.equity != null ? toNum(h.equity) : undefined,
        timestamp: h.timestamp || null
      }))
    };
  }
  res.json(shaped);
});

// تنزيل نسخة احتياطية من البيانات (محمي)
app.get("/backup", authUI, (req, res) => {
  const payload = JSON.stringify({ accounts }, null, 2);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="backup-${Date.now()}.json"`);
  res.send(payload);
});

// تقديم الملفات الثابتة (index.html, script.js, styles.css) — محمي
app.use("/", authUI, express.static(path.join(__dirname, ".")));

// فحص صحة الخدمة
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`✅ Server listening at :${PORT}`);
  console.log(`🔒 Basic Auth: user=${USER} (غير كلمة السر من المتغيرات)`);
});
