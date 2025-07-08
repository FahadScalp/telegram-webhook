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


app.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
