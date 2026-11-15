// BIRCO standard check: More from BIRCO, rewarded "double it", Full Game = no ads, never during play.
// cd <work>; python3 _src/build.py _src/v21.html vX; python3 _src/build.py _src/v21.html s --store; node _src/test-monetize.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
const OUT = process.env.SHOTS || '/tmp/cd-mon-shots'; fs.mkdirSync(OUT, { recursive: true });
const serve = (dir, port) => http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d) }) }).listen(port);
const s1 = serve('dist-store', 8101), s2 = serve('dist', 8102);

const CFG = JSON.parse(fs.readFileSync(new URL('../birco/crosspromo.json', import.meta.url)));
const live = JSON.parse(JSON.stringify(CFG)); // pretend a second game and a Recon episode are live
live.apps.push({ id: 'testgame', name: 'Test Game', pitch: 'A second BIRCO game', play: 'https://play.google.com/store/apps/details?id=com.birco.test', appstore: 'https://apps.apple.com/app/id1', live: { play: true, appstore: true }, kidsSafe: false });
live.recon.latest = 'https://www.youtube.com/watch?v=TEST';
const mock = (owned, adResult) => `window.__buys=0;window.__ads=0;window.CDN={native:true,platform:'android',store:'Google Play',
 price:async()=>'$3.99',buy:async()=>{window.__buys++;return true},owned:async()=>${owned},restore:async()=>${owned},
 ads:{available:true,test:true,warm:async()=>{},privacyNeeded:async()=>false,privacy:async()=>false,
  show:async()=>{window.__ads++;await new Promise(r=>setTimeout(r,300));${adResult === 'throw' ? "throw new Error('no fill')" : 'return ' + adResult}}}};`;

const b = await chromium.launch(); const errs = []; const R = {};
async function page(port, nativeJs, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route('https://raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opts.cfg || live), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/play\.google\.com|apps\.apple\.com|youtube\.com/, r => { R.opened = (R.opened || []).concat(r.request().url()); r.fulfill({ body: 'store' }) });
  if (opts.full) await ctx.addInitScript(() => localStorage.setItem('cd_full', JSON.stringify({ code: 'store', at: 1 })));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(port + ' ' + e.message));
  if (nativeJs) await p.route('**/native.js', r => r.fulfill({ contentType: 'text/javascript', body: nativeJs }));
  await p.goto(`http://localhost:${port}/`, { waitUntil: 'load' }); await p.waitForTimeout(600);
  return { ctx, p };
}
// a real Pitch Challenge stage that ends with a pass: the bar appears, auto-advance waits for the player
async function endStage(p) {
  await p.evaluate(() => { $('title').hidden = true; newPitchStage(0) }); await p.waitForTimeout(200);
  await p.evaluate(() => { G.pcPts = G.pcStage.goal; S.money += 400; pcEnd() }); await p.waitForTimeout(300);
}

// 1. store app, free player, video watched to the end
{ const { ctx, p } = await page(8101, mock(false, true)); const r = R.store = {};
  r.moreBtn = await p.isVisible('#moreBtn');
  await p.screenshot({ path: `${OUT}/1-title.png` });
  await p.evaluate(() => BIRCO.promo.init({ game: 'cashdiamond', fallback: window.CD_PROMO })); await p.waitForTimeout(300); // pick up the "live" list
  await p.tap('#moreBtn'); await p.waitForTimeout(200);
  r.tiles = await p.$$eval('.bpRow b', e => e.map(x => x.textContent));
  r.pausedInSheet = await p.evaluate(() => paused);
  await p.screenshot({ path: `${OUT}/2-more-from-birco.png` });
  r.links = await p.evaluate(() => BIRCO.promo.tiles().map(t => t.url));
  await p.tap('.bpX'); r.unpaused = await p.evaluate(() => !paused);
  r.duringPlay = await p.evaluate(() => { $('title').hidden = true; newGame(); return !document.querySelector('.cdmBar,.bpSheet') });
  await p.evaluate(() => toMenu()); await p.waitForTimeout(300);
  await endStage(p);
  r.bar = await p.textContent('.cdmBar').catch(() => null);
  await p.screenshot({ path: `${OUT}/3-end-bar.png` });
  const before = await p.evaluate(() => S.money); const stage = await p.evaluate(() => G.pcSi);
  await p.tap('.cdmGo'); await p.waitForTimeout(150); r.waitsDuringAd = await p.evaluate(() => paused);
  await p.waitForTimeout(3500);
  r.gotReward = (await p.evaluate(() => S.money)) - before; r.adsShown = await p.evaluate(() => window.__ads);
  r.advancedAfter = await p.evaluate(s => G.pcSi === s + 1 && !document.querySelector('.cdmBar'), stage);
  // never shown in online games
  r.onlineNoBar = await p.evaluate(() => { CDM.start(); G.online = true; S.money += 500; CDM.end(); return !document.querySelector('.cdmBar') });
  await ctx.close(); }

// 2. store app, video closed early / no fill: no reward, game goes on
for (const [k, res] of [['closedEarly', false], ['noFill', "'throw'"]]) {
  const { ctx, p } = await page(8101, mock(false, res === "'throw'" ? 'throw' : res)); await endStage(p);
  const before = await p.evaluate(() => S.money); await p.tap('.cdmGo'); await p.waitForTimeout(700);
  const msg = await p.textContent('.cdmGo').catch(() => ''); await p.waitForTimeout(4000);
  R[k] = { msg, reward: (await p.evaluate(() => S.money)) - before, advanced: await p.evaluate(() => G.pcSi === 1) };
  await ctx.close(); }

// 3. Full Game owner: no video, no promo pop-up, no locks
{ const { ctx, p } = await page(8101, mock(true, true), { full: true }); const r = R.full = {};
  r.fullBtnHidden = await p.evaluate(() => !document.getElementById('fullBtn') || document.getElementById('fullBtn').hidden);
  await endStage(p); r.bar = await p.textContent('.cdmBar').catch(() => null);
  await p.screenshot({ path: `${OUT}/4-full-owner-bar.png` });
  const before = await p.evaluate(() => S.money); await p.tap('.cdmGo'); await p.waitForTimeout(2200);
  r.reward = (await p.evaluate(() => S.money)) - before; r.adsShown = await p.evaluate(() => window.__ads);
  r.noFullScreenPromo = await p.evaluate(() => BIRCO.promo.onceAfterGame() === false);
  await ctx.close(); }

// 4. one full-screen promo per session at most (free player)
{ const { ctx, p } = await page(8101, mock(false, true)); await p.evaluate(() => BIRCO.promo.init({ game: 'cashdiamond' })); await p.waitForTimeout(300);
  R.oncePerSession = await p.evaluate(() => { const a = BIRCO.promo.onceAfterGame(); BIRCO.promo.close(); const b = BIRCO.promo.onceAfterGame(); return [a, b] });
  R.kids = await p.evaluate(() => { BIRCO.promo.init({ game: 'cashdiamond', kids: true }); return BIRCO.promo.tiles().map(t => [t.name, t.url]) });
  R.iosLinks = await p.evaluate(() => { BIRCO.promo.init({ game: 'cashdiamond', kids: false, platform: 'ios' }); return BIRCO.promo.tiles().map(t => t.url) });
  await ctx.close(); }

// 5. web app: no locks (nothing to buy yet), More from BIRCO, no video button
{ const { ctx, p } = await page(8102, null, { cfg: CFG }); const r = R.web = {};
  r.noFullGame = await p.evaluate(() => !window.CD && !document.getElementById('fullBtn'));
  r.moreBtn = await p.isVisible('#moreBtn');
  await endStage(p); r.bar = await p.textContent('.cdmBar').catch(() => null); r.noVideoBtn = !(await p.$('.cdmGo'));
  await p.tap('.cdmMore'); await p.waitForTimeout(200); r.emptyListNote = await p.textContent('.bpCard p').catch(() => null);
  await p.screenshot({ path: `${OUT}/5-web-more.png` });
  await ctx.close(); }

console.log(JSON.stringify({ R, errs }, null, 1));
await b.close(); s1.close(); s2.close();
