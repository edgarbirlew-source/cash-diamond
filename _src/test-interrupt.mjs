// A phone call in the middle of a live Pitch & Bat game: one phone goes silent (the line is dead
// but nobody closed it), the other keeps playing, then the first comes back. The game must carry
// on in sync. Also checks the official team colors: game maker Blue, friend Red, on both phones.
// node _src/test-interrupt.mjs [game url] [vs server url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8099/';
const VS = process.argv[3] || 'http://localhost:3000';
const shots = process.env.SHOTS || '.';
const b = await chromium.launch();
const phone = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true };
const errs = [], log = [];
async function open(name) {
  const ctx = await b.newContext(phone);
  await ctx.addInitScript(([vs, nick]) => {
    localStorage.setItem('cd_vs', vs); localStorage.setItem('cd_nick', nick);
    // __dead = true: the phone stops hearing and being heard, but the socket stays "open"
    const W = window.WebSocket, D = Object.getOwnPropertyDescriptor(W.prototype, 'onmessage'); window.__ws = []; window.__dead = false;
    window.WebSocket = function (...a) {
      const s = new W(...a); window.__ws.push(s); const send = s.send.bind(s);
      s.send = d => { if (!window.__dead) send(d) };
      Object.defineProperty(s, 'onmessage', { set(f) { D.set.call(s, e => { if (!window.__dead) f(e) }) }, get() { return D.get.call(s) } });
      return s;
    }; window.WebSocket.prototype = W.prototype;
    // pretend the app went to the background (phone call) and came back
    let vis = 'visible'; Object.defineProperty(document, 'visibilityState', { get: () => vis });
    window.__bg = on => { vis = on ? 'hidden' : 'visible'; document.dispatchEvent(new Event('visibilitychange')) };
  }, [VS, name]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_INTERNET/.test(m.text())) errs.push(name + ' ' + m.text()) });
  await p.goto(URL, { waitUntil: 'load' });
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const state = p => p.evaluate(() => ({ ph: G.phase, top: G.top, b: G.balls, s: G.strikes, o: G.outs, you: G.you, cpu: G.cpu, bases: G.bases.join(''), half: G.vs && G.vs.half }));
const dad = await open('Dad'), son = await open('Son');
await dad.tap('#onlineBtn'); await wait(300); await dad.tap('#vsMake'); await dad.waitForSelector('.oncode b');
const code = await dad.textContent('.oncode b');
await son.tap('#onlineBtn'); await wait(300); await son.fill('#codeIn', code); await son.tap('#jnMatch');
await son.waitForSelector('#rdy:not([disabled])'); await dad.waitForSelector('#rdy:not([disabled])');
await wait(300);
const roomText = [await dad.textContent('.onplayers'), await son.textContent('.onplayers')];
await dad.screenshot({ path: shots + '/int-0-room-dad.png' }); await son.screenshot({ path: shots + '/int-0-room-son.png' });
await dad.tap('#rdy'); await son.tap('#rdy');
await dad.waitForFunction(() => G.vs && G.phase === 'wait', null, { timeout: 8000 });
await son.waitForFunction(() => G.vs && G.phase === 'aim', null, { timeout: 8000 });

// colors: who is Blue and Red, on each phone
const colors = p => p.evaluate(() => ({ batter: uniOf(G.top).name, fielders: uniOf(!G.top).name,
  rows: [...document.querySelectorAll('.board .trow')].map(r => r.textContent.replace(/\d+$/, '') + ' ' + getComputedStyle(r.querySelector('.dot')).backgroundColor) }));
const col = { dad: await colors(dad), son: await colors(son) };
await dad.screenshot({ path: shots + '/int-1-dad-bats.png' }); await son.screenshot({ path: shots + '/int-1-son-pitches.png' });

async function throwPitch(pit) {
  await pit.waitForFunction(() => G.phase === 'aim', null, { timeout: 20000 });
  const tap = await pit.evaluate(() => { const r = C.getBoundingClientRect(), k = r.width / W; return [r.left + (ZONE.x + ZONE.w / 2) * k, r.top + (ZONE.y + ZONE.h / 2) * k] });
  await pit.touchscreen.tap(tap[0], tap[1]);
}
const settled = p => p.waitForFunction(() => !['windup', 'pitch', 'flight', 'settle', 'catch', 'vsCatch', 'switch'].includes(G.phase), null, { timeout: 30000 });
async function check(tag) {
  await settled(dad); await settled(son); await wait(200);
  const [d, s] = [await state(dad), await state(son)];
  const [bat, pit] = d.top ? [d, s] : [s, d];
  const ok = bat.b === pit.b && bat.s === pit.s && bat.o === pit.o && bat.you === pit.cpu && bat.bases === pit.bases && d.half === s.half;
  log.push({ tag, ok, d, s }); return ok;
}
const pitcher = async () => (await dad.evaluate(() => G.top)) ? son : dad;

// 1) Batter (Dad) gets a call: his line goes dead, Son throws, Dad comes back 8 s later.
await dad.evaluate(() => { window.__dead = true; window.__bg(true) });
await throwPitch(son); await wait(8000);
const stuckSon = await son.evaluate(() => ({ ph: G.phase, toast: (document.getElementById('vsToast') || {}).textContent || '' }));
await dad.evaluate(() => { window.__dead = false; window.__bg(false) });
const ok1 = await check('batter call');

// 2) Pitcher (Son) gets a call right after throwing: Dad's result can't reach him.
await throwPitch(await pitcher());
await son.evaluate(() => { window.__dead = true; window.__bg(true) }); await wait(6000);
await son.evaluate(() => { window.__dead = false; window.__bg(false) });
const ok2 = await check('pitcher call');

// 3) Long call: Son's socket really closes and stays down 20 s while Dad waits.
await son.evaluate(() => { window.__bg(true); window.__dead = true; window.__ws.forEach(s => s.close()) });
await wait(3000);
const dadToast = await dad.evaluate(() => (document.getElementById('vsToast') || {}).textContent || '');
await wait(17000);
await son.evaluate(() => { window.__dead = false; window.__bg(false) });
await wait(2000);
await throwPitch(await pitcher());
const ok3 = await check('long call');

// 4) keep playing a few more pitches, everything stays in sync
let more = 0;
for (let i = 0; i < 8; i++) { await throwPitch(await pitcher()).catch(() => { }); if (await check('after ' + i)) more++; if ((await state(dad)).ph === 'over') break }
await dad.screenshot({ path: shots + '/int-2-dad-after.png' }); await son.screenshot({ path: shots + '/int-2-son-after.png' });
console.log(JSON.stringify({ roomText, col, stuckSon, dadToast, ok1, ok2, ok3, more, bad: log.filter(l => !l.ok), errs }, null, 1));
await b.close();
