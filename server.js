const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(__dirname)); // ✅ يخدم dashboard.html و data.csv

// استقبال من Telegram
app.post('/webhook', (req, res) => {
  const msg = req.body?.message?.text || req.body?.channel_post?.text;
  console.log("📥 Message Received:", msg);

  if (!msg) return res.sendStatus(400);

  const match = msg.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d\.\-]+) \$\nProfit:\s*([\d\.\-]+) \$\nTime:\s*(.+)/);
  if (!match) {
    console.log("❌ Message format invalid");
    return res.sendStatus(400);
  }

  const [, name, account, balance, profit, time] = match;
  const line = `${time},${name},${account},${balance},${profit}\n`;
  const filePath = path.join(__dirname, 'data.csv');

  // إنشاء الملف مع الترويسة إذا لم يكن موجودًا
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'Time,Name,Account,Balance,Profit\n');
  }

  // مقارنة مع آخر سطر لمنع التكرار
  const last = fs.readFileSync(filePath, 'utf8').trim().split('\n').pop();
  console.log("⚠️ Last line in file:", last.trim());
  console.log("⚠️ New line from Telegram:", line.trim());

  if (last && last.trim() === line.trim()) {
    console.log("⚠️ Duplicate message skipped");
    return res.send("Duplicate");
  }

  fs.appendFileSync(filePath, line);
  console.log("📥 Message Saved:", line.trim());

  res.send("OK");
});

// عرض الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
