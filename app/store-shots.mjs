// Store screenshots at the sizes Google Play and the App Store ask for -> store/screenshots/<device>/
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join('www', new URL(q.url, 'http://x').pathname.replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d) }) }).listen(8097);
const DEVICES = {
  'play-phone-1080x1920': { width: 360, height: 640, s: 3 },
  'iphone-6.9in-1320x2868': { width: 440, height: 956, s: 3 },
  'ipad-13in-2064x2752': { width: 1032, height: 1376, s: 2 },
};
const b = await chromium.launch();
for (const [dev, v] of Object.entries(DEVICES)) {
  const dir = `store/screenshots/${dev}`; fs.mkdirSync(dir, { recursive: true });
  // each scene in its own fresh browser profile, starting at the title screen with the Full Game on
  const scene = async (name, go) => {
    const ctx = await b.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.s, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { if (!localStorage.getItem('cd_full')) localStorage.setItem('cd_full', JSON.stringify({ code: 'store', at: 1 })) });
    const p = await ctx.newPage();
    await p.route('**/native.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.CDN={native:true,store:"Google Play",price:async()=>null,owned:async()=>true,restore:async()=>true,buy:async()=>true}' }));
    await p.goto('http://localhost:8097/', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    await go(p); await p.screenshot({ path: `${dir}/${name}.png` }); await ctx.close();
  };
  await scene('1-title', async () => {});
  await scene('2-play-ball', async p => { await p.tap('#playBtn'); await p.waitForTimeout(3200) });
  await scene('3-hr-derby', async p => { await p.tap('#derbyBtn'); await p.waitForTimeout(500); await p.tap('#stages .lv:not([disabled])'); await p.waitForTimeout(3000) });
  await scene('4-pitch-challenge', async p => { await p.tap('#pcBtn'); await p.waitForTimeout(500); await p.tap('#stages .lv:not([disabled])'); await p.waitForTimeout(3000) });
  await scene('5-shop', async p => { await p.tap('#shopBtn'); await p.waitForTimeout(600) });
}
await b.close(); srv.close(); console.log('shots done');
