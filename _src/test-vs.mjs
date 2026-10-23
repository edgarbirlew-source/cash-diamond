// Two phones playing Online Vs against each other, with a dropped connection in the middle.
// node _src/test-vs.mjs [game url] [vs server url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8099/';
const VS = process.argv[3] || 'http://localhost:3000';
const shots = process.env.SHOTS || '.';
const b = await chromium.launch();
const phone = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] };
const errs = [], out = {};
async function open(name, url) {
  const ctx = await b.newContext(phone);
  await ctx.addInitScript(([vs, nick]) => {
    localStorage.setItem('cd_vs', vs); localStorage.setItem('cd_nick', nick);
    const W = window.WebSocket; window.__ws = [];
    window.WebSocket = function (...a) { const s = new W(...a); window.__ws.push(s); return s }; window.WebSocket.prototype = W.prototype;
  }, [VS, name]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_INTERNET/.test(m.text())) errs.push(name + ' ' + m.text()) });
  await p.goto(url, { waitUntil: 'load' });
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const dad = await open('Dad', URL);
await dad.tap('#onlineBtn'); await wait(500);
await dad.screenshot({ path: shots + '/vs-1-lobby.png' });
await dad.tap('#vsMake'); await dad.waitForSelector('.oncode b');
const code = await dad.textContent('.oncode b'); out.code = code;
await dad.tap('#vsCopy'); await wait(300);
out.copied = await dad.evaluate(() => navigator.clipboard.readText());
await dad.screenshot({ path: shots + '/vs-2-code.png' });

// Son: wrong code first, then opens the shared link.
const son = await open('Son', URL);
await son.tap('#onlineBtn'); await wait(400);
await son.fill('#codeIn', 'ZZZZZZ'); await son.tap('#jnMatch'); await wait(800);
out.wrongCode = await son.textContent('#onMsg');
await son.evaluate(t => navigator.clipboard.writeText(t), out.copied);
await son.tap('#vsPaste'); await wait(200); out.pasted = await son.inputValue('#codeIn');
await son.tap('#jnMatch'); await son.waitForSelector('#rdy:not([disabled])');
await son.screenshot({ path: shots + '/vs-3-son-joined.png' });
// A third phone cannot get in.
const kid3 = await open('Stranger', URL + '?vs=' + code); await wait(1500);
out.thirdPlayer = await kid3.textContent('#onMsg');
await kid3.screenshot({ path: shots + '/vs-4-full.png' });

await dad.waitForSelector('#rdy:not([disabled])');
await dad.tap('[data-gm=derby]'); await wait(500);
await dad.tap('#rdy'); await son.tap('#rdy');
await wait(4200);
out.seeds = await Promise.all([dad, son].map(p => p.evaluate(() => [G.online, G.seed, G.phase])));
await dad.screenshot({ path: shots + '/vs-5-playing.png' });

// Son's connection drops mid-game.
await son.evaluate(() => { G.pts = 7; netPush() }); await wait(500);
await son.evaluate(() => window.__ws.forEach(s => s.close()));
await wait(150); out.sonToast = await son.evaluate(() => document.getElementById('vsToast')?.textContent || '');
out.dadSeesAway = await dad.evaluate(() => !!(NET.opp && NET.opp.away));
await wait(2500);
out.sonBack = await son.evaluate(() => !document.getElementById('vsToast') && window.__ws.at(-1).readyState === 1);
await son.evaluate(() => { G.pts = 9; netPush() }); await wait(500);
out.dadSeesSon = await dad.evaluate(() => NET.opp && [NET.opp.nick, NET.opp.score, !!NET.opp.away]);
await dad.screenshot({ path: shots + '/vs-6-after-drop.png' });

// Both finish: Dad 12, Son 9.
await dad.evaluate(() => { G.pts = 12; G.dOuts = 10; netPush(); derbyOver() });
await son.evaluate(() => { G.dOuts = 10; netPush(); derbyOver() });
await wait(3500);
out.dadResult = await dad.textContent('#tTitle'); out.sonResult = await son.textContent('#tTitle');
await son.screenshot({ path: shots + '/vs-7-result.png' });
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
