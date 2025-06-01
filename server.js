// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(bodyParser.text({ type: 'application/x-www-form-urlencoded' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/webhook', (req, res) => {
  let msg = req.body.startsWith("text=") ? decodeURIComponent(req.body.slice(5).replace(/\+/g, ' ')) : req.body;

  console.log("📥 Message Received:", msg);

  const match = msg.match(/Name:\s*(.+)\n\s*Account:\s*(\d+)\n\s*Balance:\s*([\d.\-]+) \$\n\s*Profit:\s*([\d.\-]+) \$\n\s*Time:\s*(.+)/);
  if (!match) return res.status(400).send("Invalid format");

  const [, name, account, balance, profit, time] = match;
  let data = {};

  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  data[account] = {
    name,
    account,
    balance: parseFloat(balance),
    profit: parseFloat(profit),
    time
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.send("OK");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
