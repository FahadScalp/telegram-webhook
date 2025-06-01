const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Webhook
const webhook = require('./webhook-handler');
app.use('/', webhook);

app.get('/accounts', (req, res) => {
  const dir = path.join(__dirname, 'accounts');
  const files = fs.readdirSync(dir);
  const accounts = {};
  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file)));
    accounts[data.account_id] = data;
  });
  res.json(accounts);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
