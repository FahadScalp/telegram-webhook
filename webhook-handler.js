const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.post('/webhook', (req, res) => {
  let text = '';

  // استخراج النص بمرونة بناءً على نوع البيانات المرسلة
  if (typeof req.body === 'string') {
    text = req.body;
  } else if (typeof req.body === 'object' && req.body.text) {
    text = req.body.text;
  } else if (typeof req.body === 'object') {
    const raw = Object.keys(req.body)[0];
    if (raw && raw.startsWith('text=')) {
      text = decodeURIComponent(raw.slice(5).replace(/\+/g, ' '));
    }
  }

  const match = text.match(/Name:\s*(.+)\nAccount:\s*(\d+)\nBalance:\s*([\d.]+) \$(?:\r)?\nProfit:\s*([\d.\-]+) \$(?:\r)?\nTime:\s*(.+)/);

  if (!match) {
    console.log('❌ تنسيق غير صالح:', text);
    return res.status(400).send('Invalid message format');
  }

  const [ , name, account_id, balance, profit, time ] = match;
  const dir = path.join(__dirname, 'accounts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = path.join(dir, `${account_id}.json`);
  let existing = { account_id, alias: name, history: [] };

  // محاولة قراءة بيانات سابقة إن وجدت
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('⚠️ تعذر قراءة الملف السابق:', e.message);
    }
  }

  // تحديث أو إضافة سجل جديد
  existing.account_id = account_id;
  existing.alias = name;
  existing.history.push({
    balance: parseFloat(balance),
    profit: parseFloat(profit),
    timestamp: new Date(time).getTime()
  });

  // الإبقاء على آخر 20 سجل فقط
  if (existing.history.length > 20) {
    existing.history = existing.history.slice(-20);
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  console.log(`✅ تم حفظ أو تحديث الحساب: ${account_id}`);
  res.send('Saved');
});

module.exports = router;
