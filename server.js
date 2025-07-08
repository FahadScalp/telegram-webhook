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

  console.log("✅ Received webhook:", data);
  // هنا يمكن تخزين البيانات في الذاكرة أو ملف أو قاعدة بيانات
  res.send("✅ Webhook received");
});

app.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
