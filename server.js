const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, ".")));

function handleWebhook(req, res) {
  const data = req.body;
  if (!data || !data.account_id || !data.initial_balance || !data.balance) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }
  const id = data.account_id;

  // خزن بالذاكرة + ملف (اختياري) — اختصرنا
  // ... منطق التخزين الذي كان عندك ...

  return res.status(200).send("✅ Webhook received");
}

app.post("/webhook", handleWebhook);
app.post("/", handleWebhook);              // ← يدعم POST على الجذر أيضاً

app.get("/accounts", (req, res) => {
  // ارجع JSON للحسابات من الذاكرة/الملف
  // res.json(accounts);
  res.json({ ok: true }); // مؤقتاً
});

app.listen(port, () => {
  console.log(`✅ Server listening at :${port}`);
});
