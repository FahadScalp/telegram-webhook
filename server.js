const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.text({ type: 'application/x-www-form-urlencoded' }));
app.use(express.static(__dirname));

app.post('/webhook', (req, res) => {
  let msg = req.body?.startsWith("text=") ? decodeURIComponent(req.body.slice(5).replace(/\+/g, " ")) : req.body;

  console.log("📥 Message Received:", msg);
  if (!msg) return res.status(400).send("No message text found");

  const match = msg.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d.]+) \$(?:\r)?\nProfit:\s*([\d.\-]+) \$(?:\r)?\nTime:\s*(.+)/);
  if (!match) {
    console.log("❌ Message format invalid");
    return res.status(400).send("Invalid format");
  }

  const [, name, account, balance, profit, timeRaw] = match;
  const time = timeRaw.trim().replace(/\./g, '-');
  const line = `${time},${name},${account},${balance},${profit}\n`;

  const filePath = path.join(__dirname, 'data.csv');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'Time,Name,Account,Balance,Profit\n');
  }

  const lastLine = fs.readFileSync(filePath, 'utf8').trim().split('\n').pop();
  if (lastLine && lastLine.trim() === line.trim()) {
    console.log("⚠️ Duplicate skipped");
    return res.send("Duplicate");
  }

  fs.appendFileSync(filePath, line);
  console.log("✅ Message Saved:", line.trim());
  res.send("OK");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
