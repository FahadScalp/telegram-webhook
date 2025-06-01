
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.text({ type: 'application/x-www-form-urlencoded' }));
app.use(express.static(__dirname));

app.post('/webhook', (req, res) => {
  const raw = req.body || "";
  const msg = raw.startsWith("text=") ? decodeURIComponent(raw.slice(5).replace(/\+/g, " ")) : raw;
  console.log("📥 Message Received:", msg);

  const match = msg.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d.\-]+) \$\nProfit:\s*([\d.\-]+) \$\nTime:\s*(.+)/);

  if (!match) {
    console.log("❌ Message format invalid");
    return res.status(400).send("Invalid format");
  }

  const [, name, account, balance, profit, timeRaw] = match;
  const time = timeRaw.replace(/\./g, "-");
  const line = `${time},${name},${account},${balance},${profit}\n`;

  const filePath = path.join(__dirname, 'data.csv');
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "Time,Name,Account,Balance,Profit\n");

  let existing = fs.readFileSync(filePath, 'utf8').split('\n');
  let headers = existing.shift();
  let filtered = existing.filter(row => !row.startsWith(',') && !row.includes(`,${account},`));
  filtered.push(line.trim());
  const newCSV = [headers, ...filtered].join('\n') + '\n';

  fs.writeFileSync(filePath, newCSV);
  console.log("✅ Updated CSV with account:", account);
  res.send("OK");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
