
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
//app.use('/accounts', express.static(path.join(__dirname, 'accounts')));
app.get('/accounts', require('./accounts-api'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/account/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'account.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/webhook', express.urlencoded({ extended: true }), require('./webhook-handler'));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
