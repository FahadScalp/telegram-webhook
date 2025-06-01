
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.post('/webhook', express.urlencoded({ extended: true }), (req, res) => {
  const text = req.body.text;
  if (!text) return res.status(400).send('Missing text');

  const lines = text.split('\n');
  const data = {};
  lines.forEach(line => {
    const [key, ...rest] = line.split(':');
    data[key.trim().toLowerCase()] = rest.join(':').trim().replace(' $', '');
  });

  const accountId = data['account'];
  const alias = data['name'];
  const balance = parseFloat(data['balance']);
  const timestamp = new Date().toISOString();

  if (!accountId || isNaN(balance)) {
    return res.status(400).send('Invalid data');
  }

  const accountsDir = path.join(__dirname, 'accounts');
  if (!fs.existsSync(accountsDir)) {
    fs.mkdirSync(accountsDir);
  }

  const filePath = path.join(accountsDir, accountId + '.json');
  let accountData = { account_id: accountId, alias: alias, history: [] };

  if (fs.existsSync(filePath)) {
    accountData = JSON.parse(fs.readFileSync(filePath));
  }

  accountData.alias = alias;
  accountData.account_id = accountId;
  accountData.history.push({ balance, timestamp });

  fs.writeFileSync(filePath, JSON.stringify(accountData, null, 2));

  res.status(200).send(`OK: Account ${accountId} updated at ${new Date(timestamp).toLocaleTimeString()}`);
});

module.exports = router;
