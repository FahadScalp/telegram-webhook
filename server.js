const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(__dirname)); // ✅ يخدم الملفات: dashboard.html و data.csv

// استقبال من Telegram
app.post('/webhook', (req, res) => {
  const msg = req.body?.message?.text || req.body?.channel_post?.text;
  console.log("📥 Message Received:", msg); // ✅ هذا السطر يطبع الرسالة في logs

  if (!msg) return res.sendStatus(400);


  const match = msg.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d\.\-]+) \$\nProfit:\s*([\d\.\-]+) \$\nTime:\s*(.+)/);
  if (!match) return res.sendStatus(400);

  const [, name, account, balance, profit, time] = match;
  const line = `${time},${name},${account},${balance},${profit}\n`;
  const filePath = path.join(__dirname, 'data.csv');

  // إنشاء ملف وترويسة لو أول مرة
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'Time,Name,Account,Balance,Profit\n');
  }

  // منع التكرار البسيط
  const last = fs.readFileSync(filePath, 'utf8').trim().split('\n').pop();
  if (last && last.trim() === line.trim()) return res.send("Duplicate");

  fs.appendFileSync(filePath, line);
  console.log("📥 Message Saved:", line.trim());

  res.send("OK");
});

// ✅ عرض الصفحة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
