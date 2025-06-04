const fs = require('fs');

function handleTradeWebhook(req, res) {
  const msg = req.body.message?.text || '';
  console.log("📩 رسالة واردة من Telegram:", msg);

  const lines = msg.split('\n').map(x => x.trim());
  const firstLine = lines[0]?.toLowerCase();

  const match = firstLine.match(/(gold|xauusd)\s+(buy|sell)\s+([\d.]+)/);
  if (!match) return res.send("❌ الصيغة غير صحيحة");

  const symbol = match[1].toUpperCase();
  const direction = match[2].toLowerCase();
  const entry = parseFloat(match[3]);

  const tps = lines.filter(l => l.toLowerCase().startsWith('tp')).map(tp => parseFloat(tp.split(' ')[1]));
  const slLine = lines.find(l => l.toLowerCase().startsWith('sl'));
  const sl = slLine ? parseFloat(slLine.split(' ')[1]) : null;

  if (!tps.length || sl === null) return res.send("❌ ناقص TP أو SL");

  const trade = { symbol, direction, entry, tps, sl };
  fs.writeFileSync('signal.json', JSON.stringify(trade, null, 2));
  console.log("✅ تم حفظ الصفقة:", trade);

  res.send("✅ تم استقبال الصفقة");
}

module.exports = { handleTradeWebhook };