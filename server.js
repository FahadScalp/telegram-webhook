const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const msg = req.body?.message || req.body?.channel_post;

  if (!msg || !msg.text) return res.send('No message');

  console.log("📥 Message Received:", msg.text);

  // لاحقًا: تخزين الرسالة أو إرسالها لمكان آخر
  res.send('OK');
});

app.get('/', (req, res) => {
  res.send('✅ Webhook is ready');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
