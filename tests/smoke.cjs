const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const requiredFiles = [
  'index.html', 'styles.css', 'app.js', '.nojekyll',
  'assets/logo.svg', 'assets/help.svg', 'assets/home.svg', 'assets/reset.svg',
  'assets/speaker.svg', 'assets/mute.svg', 'assets/levels.svg', 'assets/star.svg',
  'assets/success.mp3', 'assets/error.mp3', 'assets/finish.mp3',
  'assets/SimplerPro-Regular.woff2', 'assets/SimplerPro-Bold.woff2'
];

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error(`Missing ${file}`);
  if (file !== '.nojekyll' && fs.statSync(full).size === 0) throw new Error(`Empty ${file}`);
}

if (!/<html[^>]+lang="he"[^>]+dir="rtl"/.test(html)) throw new Error('Hebrew RTL document metadata missing');
if (!html.includes('assets/logo.svg')) throw new Error('Official logo is not referenced');
if ((js.match(/^      title:/gm) || []).length !== 5) throw new Error('Expected five missions');
for (const event of ['successSound', 'errorSound', 'finishSound']) {
  if (!html.includes(`id="${event}"`) || !js.includes(`'${event}'`)) throw new Error(`Sound event not wired: ${event}`);
}

const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((match) => match[1]);
for (const asset of new Set(assets)) {
  if (!fs.existsSync(path.join(root, asset))) throw new Error(`Broken asset reference: ${asset}`);
}

console.log(`Smoke checks passed: ${requiredFiles.length} files, 5 missions, ${new Set(assets).size} referenced assets.`);
