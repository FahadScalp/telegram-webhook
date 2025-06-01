const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ميدل وير لتحليل JSON في body
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // في حال كانت الرسالة بصيغة x-www-form-urlencoded

// تقديم الملفات الثابتة من مجلد المشروع
app.use(express.static(__dirname));

// استيراد webhook
const webhook = require('./webhook-handler');
app.use('/', webhook);

// Endpoint لعرض جميع الحسابات الموجودة في مجلد accounts
app.get('/accounts', (req, res) => {
  const dir = path.join(__dirname, 'accounts');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const accounts = {};

  files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.trim()) throw new Error('Empty file');
      const data = JSON.parse(content);
      if (data.account_id) {
        accounts[data.account_id] = data;
      }
    } catch (err) {
      console.error(`❌ Error parsing ${file}: ${err.message}`);
    }
  });

  res.json(accounts);
});

// بدء تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
