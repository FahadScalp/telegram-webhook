const accounts = {}; // 🧠 تخزين مؤقت للبيانات
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// ✅ هذا هو السطر الضروري لتحليل JSON
app.use(express.json());

// يقدم ملفات الواجهة
app.use(express.static(path.join(__dirname, ".")));

// نقطة النهاية /webhook
app.post("/webhook", (req, res) => {
  const data = req.body;
  if (!data.account_id || !data.initial_balance || !data.balance) {
    return res.status(400).send("❌ تنسيق غير صالح");
  }

  const id = data.account_id;
  if (!accounts[id]) {
    accounts[id] = {
      account_id: id,
      alias: data.alias,
      initial_balance: data.initial_balance,
      history: []
    };
  }

  accounts[id].history.push({
    balance: data.balance,
    timestamp: data.timestamp
  });
  app.get("/accounts", (req, res) => {
  res.json(accounts);
});


  res.send("✅ Webhook received");
});
const fs = require("fs");

// ✅ حذف صفقة من signal.json حسب رقم التذكرة
app.post("/delete", (req, res) => {
  const { ticket } = req.body;

  if (!ticket) {
    return res.status(400).json({ error: "Missing ticket" });
  }

  const filePath = path.join(__dirname, "signal.json");

  // إذا الملف غير موجود → لا شيء نحذفه
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "signal.json not found" });
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    return res.status(500).json({ error: "Failed to read or parse signal.json" });
  }

  // نحذف الصفقات التي تحمل نفس رقم التذكرة
  const updated = Array.isArray(data)
    ? data.filter(order => order.ticket !== ticket)
    : [];

  try {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
    return res.status(200).json({ message: "✅ Deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "❌ Failed to write updated file" });
  }
});


app.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
