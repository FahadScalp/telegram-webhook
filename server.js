
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ملفات ثابتة (script.js, style.css, الخ)
app.use(express.static(__dirname));

// مجلد الحسابات
app.use('/accounts', express.static(path.join(__dirname, 'accounts')));

// صفحة البداية = index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// صفحة الحساب الفردي
app.get('/account/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'account.html'));
});

// صفحة لوحة الإدارة
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// صفحة تسجيل الدخول
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// نقطة استقبال Webhook (من MT4)
app.post('/webhook', express.urlencoded({ extended: true }), require('./webhook-handler'));

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
