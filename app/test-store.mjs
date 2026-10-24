// Store-app check in Chromium: serves www/ with a pretend Apple/Google store, at phone sizes.
// node test-store.mjs  ->  prints results, writes shots to /tmp/cd-store-shots/
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');

const OUT = process.env.SHOTS || '/tmp/cd-store-shots'; fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join('www', decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d) }) }).listen(8098);
const mock = owned => `window.__buys=0;window.CDN={native:true,platform:'android',store:'Google Play',
 price:async()=>'$3.99',buy:async()=>{window.__buys++;return true},owned:async()=>${owned},restore:async()=>${owned}};`;

const b = await chromium.launch(); const res = {}; const errs = [];
for (const [name, vp] of [['phone', { width: 360, height: 780 }], ['fold-open', { width: 884, height: 1104 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // no outside internet in the app except the game servers
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => { errs.push('google fonts requested'); r.abort() });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  await p.route('**/native.js', r => r.fulfill({ contentType: 'text/javascript', body: mock(false) }));
  await p.goto('http://localhost:8098/', { waitUntil: 'networkidle' });
  const r = res[name] = {};
  r.fontLocal = await p.evaluate(() => document.fonts.check('40px "Luckiest Guy"'));
  r.noSW = await p.evaluate(() => !document.querySelector('link[rel=manifest]') && !document.getElementById('installBtn'));
  r.fullBtn = await p.textContent('#fullBtn');
  await p.screenshot({ path: `${OUT}/${name}-title.png` });
  await p.tap('#fullBtn'); await p.waitForTimeout(300);
  r.offer = { restore: await p.isVisible('[data-restore]'), code: await p.isVisible('[data-code]') };
  await p.screenshot({ path: `${OUT}/${name}-offer.png` });
  await p.tap('[data-buy]'); await p.waitForTimeout(200);
  r.buyLabel = await p.textContent('[data-go]');
  const q = await p.textContent('.cdcard p:nth-of-type(2)'); const [a, bb] = q.match(/\d+/g).map(Number);
  await p.fill('[data-a]', '1'); await p.tap('[data-go]'); r.wrongStops = await p.evaluate(() => window.__buys === 0);
  await p.fill('[data-a]', String(a * bb)); await p.tap('[data-go]'); await p.waitForTimeout(400);
  r.after = await p.textContent('.cdcard h2'); r.saved = await p.evaluate(() => localStorage.getItem('cd_full'));
  await p.screenshot({ path: `${OUT}/${name}-unlocked.png` });
  await ctx.close();
  // a fresh install on a store account that already bought it unlocks by itself
  const c2 = await b.newContext({ viewport: vp }); const p2 = await c2.newPage();
  await p2.route('**/native.js', r => r.fulfill({ contentType: 'text/javascript', body: mock(true) }));
  await p2.goto('http://localhost:8098/', { waitUntil: 'networkidle' }); await p2.waitForTimeout(300);
  r.autoRestore = await p2.evaluate(() => !!localStorage.getItem('cd_full') && !document.getElementById('fullBtn')?.offsetParent);
  await c2.close();
}
console.log(JSON.stringify({ res, errs }, null, 1));
await b.close(); srv.close();
