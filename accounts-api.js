
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const dir = path.join(__dirname, 'accounts');
  const files = fs.readdirSync(dir);
  const data = {};

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const raw = fs.readFileSync(path.join(dir, file));
      const parsed = JSON.parse(raw);
      data[parsed.account_id] = parsed;
    }
  });

  res.json(data);
};
