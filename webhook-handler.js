const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.post('/webhook', (req, res) => {
  const text = req.body?.startsWith("text=")
    ? decodeURIComponent(req.body.slice(5).replace(/\+/g, " "))
    : req.body;

  const match = text.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d.]+) \$(?:\r)?\nProfit:\s*([\d.\-]+) \$(?:\r)?\nTime:\s*(.+)/);

  if (!match) {
    console.log('❌ لم يتم التعرف على الرسالة:', text);
    return res.status(400).send('Invalid format');
  }

  const [ , name, account_id, balance, profit, time ] = match;
  const data = {
    name,
    account_id,
    balance: parseFloat(balance),
    profit: parseFloat(profit),
    time
  };

  const dir = path.join(__dirname, 'accounts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = path.join(dir, `${account_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(`✅ تم حفظ الحساب ${account_id}`);
  res.send('Received and saved');
});

module.exports = router;
