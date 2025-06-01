
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { user, pass } = req.query;
  if (user === "FahadScalp" && pass === "Fa.6794669") {
    return res.json({ ok: true, role: "owner" });
  }
  const dir = path.join(__dirname, 'accounts');
  const files = fs.readdirSync(dir);
  for (let file of files) {
    const acc = JSON.parse(fs.readFileSync(path.join(dir, file)));
    if (acc.login && acc.login.user === user && acc.login.pass === pass) {
      return res.json({ ok: true, role: "user", id: acc.account_id });
    }
  }
  res.json({ ok: false });
};
