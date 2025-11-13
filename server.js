// server.js — مع حماية Basic Auth للواجهة
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== In-memory store =====
const accounts = {};

// ===== Middlewares =====
app.use(express.json());

// ===== Basic Auth (يحمي الواجهة فقط) =====
const USER = process.env.DASH_USER || "admin";
const PASS = process.env.DASH_PASS || "1234"; // غيّرها من بيئة Render

function authUI(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    const [user, pass] = decoded.split(":");
    if (user === USER && pass === PASS) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="FahadScalp Dashboard"');
  return res.status(401).send("Authentication required");
}

// ===== Webhook (مفتوح لبوت MT4) =====
app.post("/webhook", (req, res) => {
  const data = req.body || {};
  if (!data.account_id || data.initial_balance === undefined || data.balance === undefined) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }
  const id = String(data.account_id);
  const alias = data.alias ? String(data.alias) : "";
  const initial = Number(data.initial_balance);
  const balance = Number(data.balance);
  const ts = data.timestamp ? Number(data.timestamp) : Date.now();
  if (!isFinite(initial) || !isFinite(balance)) return res.status(400).send("❌ قيم غير رقمية");

  if (!accounts[id]) accounts[id] = { account_id: id, alias, initial_balance: initial, history: [] };
  // تحديث alias/initial لو تغيّروا
  if (alias) accounts[id].alias = alias;
  if (isFinite(initial)) accounts[id].initial_balance = initial;

  accounts[id].history.push({ balance, timestamp: ts });
  if (accounts[id].history.length > 200) accounts[id].history = accounts[id].history.slice(-200);
  accounts[id].last = accounts[id].history[accounts[id].history.length - 1];

  return res.status(200).send("✅ Webhook received");
});

// (اختياري) منع POST على الجذر
app.post("/", (req, res) => res.status(404).send("Use POST /webhook"));

// ===== واجهة + /accounts (محميّة) =====
app.get("/accounts", authUI, (req, res) => {
  const shaped = {};
  for (const [id, acc] of Object.entries(accounts)) {
    const last = acc.history.length ? acc.history[acc.history.length - 1] : { balance: acc.initial_balance, timestamp: null };
    shaped[id] = {
      account_id: acc.account_id,
      alias: acc.alias,
      initial_balance: Number(acc.initial_balance || 0),
      last: { balance: Number(last.balance || 0), timestamp: last.timestamp || null },
      history: acc.history.map(h => ({ balance: Number(h.balance || 0), timestamp: h.timestamp || null }))
    };
  }
  res.json(shaped);
});

// قدّم الملفات الساكنة (index.html, script.js, …) بعد auth
app.use("/", authUI, express.static(path.join(__dirname, ".")));

app.listen(PORT, () => {
  console.log(`✅ Server listening at :${PORT}`);
});
