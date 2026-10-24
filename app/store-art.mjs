// Draws the store-app art (icon, adaptive icon layers, splash, Play feature graphic) into assets/ and store/.
// Uses the same icon drawing as the web app (../_src/icons.mjs).
import { createRequire } from 'module';
import { execSync } from 'child_process';
// Playwright comes from the machine's global install
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
import fs from 'fs';

const src = fs.readFileSync('../_src/icons.mjs', 'utf8');
const draw = src.match(/const draw = `([\s\S]*?)`;/)[1];
// same drawing without the blue striped square, for layering on other backgrounds
const bgBlock = /x\.fillStyle = '#1d4fa3'; x\.fillRect\(0, 0, 512, 512\);[\s\S]*?x\.restore\(\);/;
if (!bgBlock.test(draw)) throw new Error('icon background block not found');
const drawFg = draw.replace(bgBlock, '');

// layer: 'all' = full icon, 'bg' = stripes only, 'fg' = diamond + ball on transparent
const art = `async (w, h, mode) => {
  await document.fonts.load('64px "Luckiest Guy"'); await document.fonts.load('700 64px "Baloo 2"');
  const icon = (${draw}), fgIcon = (${drawFg});
  const load = d => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
  const img = s => load(icon(s, 0)), fgImg = s => load(fgIcon(s, 0));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const stripes = () => { x.fillStyle = '#1d4fa3'; x.fillRect(0, 0, w, h); x.save(); x.globalAlpha = .12; x.fillStyle = '#fff';
    const st = Math.max(w, h) / 512 * 56; for (let k = -h; k < w + h; k += st) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + st / 2, 0); x.lineTo(k + st / 2 - h, h); x.lineTo(k - h, h); x.fill(); } x.restore(); };
  const title = (t, cx, cy, size) => { x.font = size + 'px "Luckiest Guy", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = size * .16; x.strokeStyle = '#22170f'; x.strokeText(t, cx, cy); x.fillStyle = '#ffd23f'; x.fillText(t, cx, cy); };
  if (mode === 'icon') { x.drawImage(await img(w), 0, 0); }
  else if (mode === 'bg') { stripes(); }
  else if (mode === 'fg') { const s = w * .62; x.drawImage(await fgImg(512), (w - s) / 2, (h - s) / 2, s, s); }
  else if (mode === 'splash') { stripes(); const s = Math.min(w, h) * .32; x.drawImage(await fgImg(512), (w - s) / 2, h / 2 - s * .75, s, s); title('CASH DIAMOND', w / 2, h / 2 + s * .5, s * .28); }
  else if (mode === 'feature') { stripes(); const s = h * .78; x.drawImage(await fgImg(512), w * .06, (h - s) / 2, s, s);
    title('CASH', w * .66, h * .33, h * .26); title('DIAMOND', w * .66, h * .58, h * .2);
    x.font = '700 ' + h * .075 + 'px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('Every hit earns cash!', w * .66, h * .8); }
  return c.toDataURL('image/png').split(',')[1];
}`;

const b = await chromium.launch(); const p = await b.newPage();
fs.writeFileSync('src/fonts/_art.html', `<html><head><link rel="stylesheet" href="fonts.css"></head><body style="font-family:'Luckiest Guy'">a<span style="font-family:'Baloo 2';font-weight:700">b</span></body></html>`);
await p.goto('file://' + process.cwd() + '/src/fonts/_art.html'); await p.evaluate(() => document.fonts.ready); fs.unlinkSync('src/fonts/_art.html');
fs.mkdirSync('assets', { recursive: true }); fs.mkdirSync('store', { recursive: true });
const jobs = [
  ['assets/icon-only.png', 1024, 1024, 'icon'],
  ['assets/icon-background.png', 1024, 1024, 'bg'],
  ['assets/icon-foreground.png', 1024, 1024, 'fg'],
  ['assets/splash.png', 2732, 2732, 'splash'],
  ['assets/splash-dark.png', 2732, 2732, 'splash'],
  ['store/play-icon-512.png', 512, 512, 'icon'],
  ['store/play-feature-graphic-1024x500.png', 1024, 500, 'feature'],
  ['store/app-store-icon-1024.png', 1024, 1024, 'icon'],
];
for (const [f, w, h, m] of jobs) fs.writeFileSync(f, Buffer.from(await p.evaluate(`(${art})(${w}, ${h}, '${m}')`), 'base64'));
await b.close(); console.log('art done');
