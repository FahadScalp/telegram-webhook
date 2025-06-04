const express = require('express');
const bodyParser = require('body-parser');
const { handleTradeWebhook } = require('./trade-webhook');

const app = express();
app.use(bodyParser.json());

app.post('/trade-webhook', handleTradeWebhook);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Trade Webhook شغّال على المنفذ ${PORT}`);
});