// server.js — MT4 Accounts Dashboard (stable)
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== In-memory store =====
const accounts = {}; // { [account_id]: { account_id, alias, initial_balance, history:[{balance,timestamp}], last:{balance,timestamp} } }

// ===== Middlewares =====
app.use(express.json());                             // parse JSON
app.use(express.static(path.join(__dirname, ".")));  // serve index.html, script.js, ...

// Helper: ensure account object exists
function ensureAccount(id, alias, initial) {
  if (!accounts[id]) {
    accounts[id] = {
      account_id: id,
      alias: alias || "",
      initial_balance: Number(initial) || 0,
      history: []
    };
  } else {
    // لو تغيّر alias أو initial_balance نحدّثهم (اختياري)
    if (alias && accounts[id].alias !== alias) accounts[id].alias = alias;
    if (initial && Number(initial) !== Number(accounts[id].initial_balance)) {
      accounts[id].initial_balance = Number(initial);
    }
  }
}

// ===== Webhook to receive updates from MT4 =====
app.post("/webhook", (req, res) => {
  const data = req.body || {};
  // التحقق الأساسي
  if (!data.account_id || data.initial_balance === undefined || data.balance === undefined) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }

  const id = String(data.account_id);
  const alias = data.alias ? String(data.alias) : "";
  const initial = Number(data.initial_balance);
  const balance = Number(data.balance);
  const ts = data.timestamp ? Number(data.timestamp) : Date.now();

  if (!isFinite(initial) || !isFinite(balance)) {
    return res.status(400).send("❌ قيم غير رقمية");
  }

  ensureAccount(id, alias, initial);

  accounts[id].history.push({ balance, timestamp: ts });

  // احتفظ بآخر 200 نقطة فقط (اختياري)
  if (accounts[id].history.length > 200) {
    accounts[id].history = accounts[id].history.slice(-200);
  }

  // احسب "last" للاختصار في الواجهة
  const last = accounts[id].history[accounts[id].history.length - 1];
  accounts[id].last = last;

  return res.status(200).send("✅ Webhook received");
});

// ===== Accounts endpoint for the dashboard =====
app.get("/accounts", (req, res) => {
  // جهّز نسخة مرتبة للعرض
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

// (اختياري) دعم POST "/" لو كان الـEA يرسل للجذر بالغلط
app.post("/", (req, res) => {
  // إمّا نعيد توجيه بسيط، أو نستدعي نفس المنطق — هنا نرجّع خطأ واضح:
  return res.status(404).send("Use POST /webhook");
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
