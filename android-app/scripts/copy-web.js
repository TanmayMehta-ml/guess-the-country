// Copies the game (one folder up) into www/ for Capacitor.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..'), dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'data', 'flags', 'fonts']) {
  const from = path.join(src, item);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(dst, item), { recursive: true });
}
console.log('www ready');
