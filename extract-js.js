// Extract inline <script> blocks from HTML pages into js-src/ (readable source)
// and replace them with external <script src="/js/<page>-<n>.js"> tags.
// Usage: node extract-js.js
const fs = require('fs');
const path = require('path');

const PAGES = ['index.html', 'admin.html', 'vendor.html', 'setup.html', 'terms.html', 'privacy.html'];
const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'js-src');

if (!fs.existsSync(SRC_DIR)) fs.mkdirSync(SRC_DIR, { recursive: true });

const OPEN_RE = /<script\s*>/g;
const CLOSE_RE = /<\/script>/g;

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  const opens = [];
  let m;
  while ((m = OPEN_RE.exec(html)) !== null) opens.push(m);
  const closes = [];
  while ((m = CLOSE_RE.exec(html)) !== null) closes.push(m);
  if (opens.length !== closes.length) {
    console.error(`⚠️  ${page}: ${opens.length} opening vs ${closes.length} closing tags — SKIPPED`);
    continue;
  }
  if (!opens.length) { console.log(`${page}: no inline scripts`); continue; }

  const base = page.replace('.html', '');
  const edits = [];
  for (let i = 0; i < opens.length; i++) {
    const start = opens[i].index;
    const end = closes[i].index + closes[i][0].length;
    const content = html.slice(opens[i].index + opens[i][0].length, closes[i].index);
    const srcName = `${base}-${i + 1}.js`;
    fs.writeFileSync(path.join(SRC_DIR, srcName), content, 'utf8');
    edits.push({ start, end, to: `    <script src="/js/${srcName}"></script>\n`, name: srcName, size: content.length });
  }
  // rebuild from the end so positions stay valid
  for (const e of edits.reverse()) {
    html = html.slice(0, e.start) + e.to + html.slice(e.end);
  }
  fs.writeFileSync(file, html, 'utf8');
  const sizes = edits.reverse().map(r => `${r.name}(${(r.size / 1024).toFixed(1)}KB)`).join(', ');
  console.log(`✅ ${page} → extracted ${opens.length} block(s): ${sizes}`);
}
console.log('Done.');
