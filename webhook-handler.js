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
    console.log('❌ تنسيق الرسالة غير صحيح:', text);
    return res.status(400).send('Invalid format');
  }

  const [ , name, account_id, balance, profit, time ] = match;
  const dir = path.join(__dirname, 'accounts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = path.join(dir, `${account_id}.json`);
  let existing = { account_id, alias: name, history: [] };

  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('❌ تعذر قراءة الملف القديم:', e.message);
    }
  }

  existing.account_id = account_id;
  existing.alias = name;
  existing.history.push({
    balance: parseFloat(balance),
    profit: parseFloat(profit),
    timestamp: new Date(time).getTime()
  });

  // احتفظ فقط بـ 20 سجلًا
  if (existing.history.length > 20) {
    existing.history = existing.history.slice(-20);
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  console.log(`✅ تم تحديث الحساب: ${account_id}`);
  res.send('Saved');
});

module.exports = router;
