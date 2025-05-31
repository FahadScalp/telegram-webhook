const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/x-www-form-urlencoded' }));
app.use(express.static(__dirname));

app.post('/webhook', (req, res) => {
  let msg = "";

  if (typeof req.body === "string") {
    msg = req.body.startsWith("text=") ? decodeURIComponent(req.body.slice(5).replace(/\+/g, " ")) : req.body;
  } else {
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
  const cleanedTime = timeRaw.trim().replace(/\./g, '-').replace(/\s+/g, ' ');
  const time = new Date(cleanedTime);
  if (isNaN(time.getTime())) {
    console.log("❌ Invalid date format after fix:", cleanedTime);
    return res.status(400).send("Invalid date format");
  }
  const timeStr = time.toISOString().slice(0, 16).replace("T", " ");
  const newLine = `${timeStr},${name},${account},${balance},${profit}`;

  const filePath = path.join(__dirname, 'data.csv');
  let lines = [];

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'Time,Name,Account,Balance,Profit\n');
  } else {
    lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  }

  const header = lines[0];
  const dataLines = lines.slice(1);

  // ابحث عن الحساب وعدّل السطر إن وُجد، وإلا أضف سطرًا جديدًا
  let updated = false;
  const updatedLines = dataLines.map(line => {
    if (line.split(',')[2] === account) {
      updated = true;
      return newLine;
    }
    return line;
  });

  if (!updated) updatedLines.push(newLine);

  fs.writeFileSync(filePath, [header, ...updatedLines].join('\n'));
  console.log("✅ Data updated/saved:", newLine);
  res.send("OK");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
