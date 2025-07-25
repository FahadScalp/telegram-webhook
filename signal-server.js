
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const filePath = path.join(__dirname, "signal.json");

// ✅ استلام صفقة من MT4
app.post("/signal", (req, res) => {
  const data = req.body;

  if (!data.ticket || !data.symbol || !data.type || !data.price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let existing = [];
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      return res.status(500).json({ error: "Failed to read signal.json" });
    }
  }

  const alreadyExists = existing.some(item => item.ticket === data.ticket);
  if (alreadyExists) {
    return res.status(200).json({ message: "⚠️ Signal already exists" });
  }

  existing.push(data);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
  return res.status(200).json({ message: "✅ Signal received" });
});

// ✅ حذف صفقة بناءً على رقم التذكرة
app.post("/delete", (req, res) => {
  const { ticket } = req.body;

  if (!ticket) {
    return res.status(400).json({ error: "Missing ticket" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "signal.json not found" });
  }

  let existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const filtered = existing.filter(order => order.ticket !== ticket);

  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), "utf-8");
  return res.status(200).json({ message: "✅ Deleted successfully" });
});

// ✅ تشغيل السيرفر على بورت منفصل أو افتراضي
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Signal server running at http://localhost:${PORT}`);
});
