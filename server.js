const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/x-www-form-urlencoded' }));
app.use(express.static(__dirname));

// استقبال من Telegram أو MT4
app.post('/webhook', (req, res) => {
  let msg = "";

  if (typeof req.body === "string") {
    // إذا كانت الرسالة بصيغة x-www-form-urlencoded
    msg = req.body.startsWith("text=") ? decodeURIComponent(req.body.slice(5).replace(/\+/g, " ")) : req.body;
  } else {
    // إذا كانت الرسالة من Telegram بصيغة JSON
    msg =
      req.body?.message?.text ||
      req.body?.channel_post?.text ||
      req.body?.edited_message?.text ||
      req.body?.edited_channel_post?.text ||
      req.body?.text || "";
  }

  console.log("📥 Message Received:", msg);

  if (!msg) return res.status(400).send("No message text found");

  const match = msg.match(/Name:\s*(.+)\n\s*Account:\s*(\d+)\n\s*Balance:\s*([\d.\-]+) \$\n\s*Profit:\s*([\d.\-]+) \$\n\s*Time:\s*(.+)/);

  if (!match) {
    console.log("❌ Message format invalid");
    return res.status(400).send("Invalid format");
  }

  const [, name, account, balance, profit, timeRaw] = match;
  const fixedTime = timeRaw.replace(/\./g, '-');
  const time = new Date(fixedTime);
  if (isNaN(time.getTime())) {
    console.log("❌ Invalid date format after fix:", fixedTime);
    return res.status(400).send("Invalid date format");
  }
  const timeStr = time.toISOString().slice(0, 16).replace("T", " ");

  const line = `${timeStr},${name},${account},${balance},${profit}\n`;
  const filePath = path.join(__dirname, 'data.csv');

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'Time,Name,Account,Balance,Profit\n');
  }

  const fileContent = fs.readFileSync(filePath, 'utf8').trim();
  const lastLine = fileContent.split('\n').pop();
  console.log("⚠️ Last line in file:", lastLine);
  console.log("⚠️ New line from Telegram:", line.trim());

  if (lastLine && lastLine.trim() === line.trim()) {
    console.log("⚠️ Duplicate skipped");
    return res.send("Duplicate");
  }

  fs.appendFileSync(filePath, line);
  console.log("✅ Message Saved:", line.trim());

  res.send("OK");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
