
const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCOUNTS_DIR = path.join(__dirname, 'accounts');
const PROFIT_THRESHOLD = 50;
const ALERT_STEP = 10; // كل كم دولار يُعاد إرسال التنبيه بعد أول مرة

function sendTelegram(token, chat_id, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const data = JSON.stringify({ chat_id, text: message });

  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  });

  req.on('error', (e) => console.error('Telegram error:', e));
  req.write(data);
  req.end();
}

function checkAccounts() {
  const files = fs.readdirSync(ACCOUNTS_DIR);
  for (const file of files) {
    const fullPath = path.join(ACCOUNTS_DIR, file);
    const raw = fs.readFileSync(fullPath);
    const account = JSON.parse(raw);

    if (!account.telegram || !account.telegram.token || account.telegram.token === 'null') continue;

    const last = account.history[account.history.length - 1];
    const profit = last.balance - 100;
    const lastAlert = account.telegram.last_alert || 0;

    if (profit >= PROFIT_THRESHOLD && profit >= lastAlert + ALERT_STEP) {
      sendTelegram(account.telegram.token, account.telegram.chat_id, account.telegram.message || `🚨 ربحك وصل $${profit.toFixed(2)}`);
      account.telegram.last_alert = profit;
      fs.writeFileSync(fullPath, JSON.stringify(account, null, 2));
      console.log(`✅ Alert sent to ${account.account_id} (Profit: $${profit.toFixed(2)})`);
    }
  }
}

checkAccounts();
