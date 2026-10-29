// Two phones play the live Pitch & Bat game: Son pitches, Dad bats, then they swap.
// node _src/test-live.mjs [game url] [vs server url]
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
    const W = window.WebSocket; window.__ws = [];
    window.WebSocket = function (...a) { const s = new W(...a); window.__ws.push(s); return s }; window.WebSocket.prototype = W.prototype;
  }, [VS, name]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_INTERNET/.test(m.text())) errs.push(name + ' ' + m.text()) });
  await p.goto(URL, { waitUntil: 'load' });
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const state = p => p.evaluate(() => ({ ph: G.phase, top: G.top, b: G.balls, s: G.strikes, o: G.outs, you: G.you, cpu: G.cpu, bases: G.bases.join(''), half: G.vs && G.vs.half, inn: G.inning }));
const dad = await open('Dad'), son = await open('Son');
await dad.tap('#onlineBtn'); await wait(300); await dad.tap('#vsMake'); await dad.waitForSelector('.oncode b');
const code = await dad.textContent('.oncode b');
await son.tap('#onlineBtn'); await wait(300); await son.fill('#codeIn', code); await son.tap('#jnMatch');
await son.waitForSelector('#rdy:not([disabled])'); await dad.waitForSelector('#rdy:not([disabled])');
await son.screenshot({ path: shots + '/live-1-room-son.png' }); await dad.screenshot({ path: shots + '/live-1-room-dad.png' });
await dad.tap('#rdy'); await son.tap('#rdy');
await dad.waitForFunction(() => G.vs && G.phase === 'wait', null, { timeout: 8000 });
await dad.evaluate(() => { G.innings = 1 }); await son.evaluate(() => { G.innings = 1 });
log.push({ start: await state(dad), son: await state(son) });

// One pitch: whoever is pitching throws, the batter swings (or takes).
async function onePitch(i, swing) {
  for (const p of [dad, son]) await p.waitForFunction(() => G.phase !== 'switch', null, { timeout: 8000 });
  await wait(100);
  const [pit, bat] = (await dad.evaluate(() => G.top)) ? [son, dad] : [dad, son];
  await pit.waitForFunction(() => G.phase === 'aim' || G.phase === 'over', null, { timeout: 15000 });
  if (await pit.evaluate(() => G.phase === 'over')) return false;
  if (i === 2) await pit.screenshot({ path: shots + '/live-2-pitcher-aim.png' });
  // tap the strike zone (or a bit outside for a ball)
  const tap = await pit.evaluate(i => { const r = C.getBoundingClientRect(), k = r.width / W, x = ZONE.x + ZONE.w / 2 + (i % 4 === 3 ? ZONE.w : 0), y = ZONE.y + ZONE.h / 2; return [r.left + x * k, r.top + y * k] }, i);
  await pit.touchscreen.tap(tap[0], tap[1]);
  await bat.waitForFunction(() => G.phase === 'pitch' && P, null, { timeout: 8000 });
  if (i === 2) await bat.screenshot({ path: shots + '/live-3-batter-pitch.png' });
  if (swing) { await bat.waitForFunction(() => P && (performance.now() - P.start) / P.dur > .93, null, { timeout: 5000 }); await bat.evaluate(() => userSwing(0, 0, true)) }
  await bat.waitForFunction(() => !['windup', 'pitch', 'flight', 'settle', 'catch', 'vsCatch'].includes(G.phase), null, { timeout: 10000 });
  await pit.waitForFunction(() => !['windup', 'pitch', 'flight', 'settle', 'catch', 'vsCatch'].includes(G.phase), null, { timeout: 10000 });
  await wait(150);
  const a = await state(bat), c = await state(pit);
  const ok = a.b === c.b && a.s === c.s && a.o === c.o && a.you === c.cpu && a.bases === c.bases;
  log.push({ i, swing, bat: a, pit: c, ok });
  return true;
}
let i = 0;
for (; i < 60; i++) {
  if (i === 7) { // Son's phone drops right after a pitch is thrown
    await son.evaluate(() => window.__ws.forEach(s => s.close()));
    log.push({ dropped: true });
  }
  if (!(await onePitch(i, i % 6 === 0).catch(e => { errs.push('pitch ' + i + ' ' + e.message); return false }))) break;
  if (i === 4) await dad.screenshot({ path: shots + '/live-4-dad.png' });
}
await wait(3000);
const endD = await state(dad), endS = await state(son);
await dad.screenshot({ path: shots + '/live-5-end-dad.png' }); await son.screenshot({ path: shots + '/live-5-end-son.png' });
const titles = [await dad.textContent('#tTitle'), await son.textContent('#tTitle')];
// Rematch: both open Online Vs again and land back in the same room.
await dad.tap('#onlineBtn'); await son.tap('#onlineBtn'); await wait(800);
const rematch = [await dad.isVisible('#rdy'), await son.isVisible('#rdy'), await dad.textContent('.oncode b')];
await dad.tap('#rdy'); await son.tap('#rdy');
const again = await dad.waitForFunction(() => G.vs && G.vs.half === 0 && G.phase !== 'over', null, { timeout: 8000 }).then(() => true, () => false);
console.log(JSON.stringify({ rematch, again, pitches: i, allInSync: log.filter(l => 'ok' in l).every(l => l.ok), outOfSync: log.filter(l => l.ok === false), endD, endS, titles, errs, first: log.slice(0, 4) }, null, 1));
await b.close();
