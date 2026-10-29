// Online Vs live game: the fielder's phone gets the glove ring on fly balls and can catch them.
// node _src/test-catch.mjs [game url] [vs server url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8099/';
const VS = process.argv[3] || 'http://localhost:3000';
const shots = process.env.SHOTS || '.';
const b = await chromium.launch();
const phone = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true };
const errs = [], log = [];
async function open(name) {
  const ctx = await b.newContext(phone);
  await ctx.addInitScript(([vs, nick]) => { localStorage.setItem('cd_vs', vs); localStorage.setItem('cd_nick', nick) }, [VS, name]);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  await p.goto(URL, { waitUntil: 'load' });
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const state = p => p.evaluate(() => ({ ph: G.phase, o: G.outs, you: G.you, cpu: G.cpu, bases: G.bases.join(''), banner: G.banner && G.banner.t1 }));
const dad = await open('Dad'), son = await open('Son');
await dad.tap('#onlineBtn'); await wait(300); await dad.tap('#vsMake'); await dad.waitForSelector('.oncode b');
const code = await dad.textContent('.oncode b');
await son.tap('#onlineBtn'); await wait(300); await son.fill('#codeIn', code); await son.tap('#jnMatch');
await son.waitForSelector('#rdy:not([disabled])'); await dad.tap('#rdy'); await son.tap('#rdy');
await dad.waitForFunction(() => G.vs && G.phase === 'wait', null, { timeout: 8000 });

// Dad bats, Son pitches and fields. Every ball Dad hits is `out`; Son taps the ring or lets it drop.
async function play(out, tapIt) {
  await dad.evaluate(o => { window.hitOutcome = () => o }, out);
  for (let n = 0; n < 12; n++) {
    await son.waitForFunction(() => G.phase === 'aim', null, { timeout: 15000 });
    const tap = await son.evaluate(() => { const r = C.getBoundingClientRect(), k = r.width / W; return [r.left + (ZONE.x + ZONE.w / 2) * k, r.top + (ZONE.y + ZONE.h / 2) * k] });
    await son.touchscreen.tap(tap[0], tap[1]);
    await dad.waitForFunction(() => G.phase === 'pitch' && P, null, { timeout: 8000 });
    await dad.waitForFunction(() => P && (performance.now() - P.start) / P.dur > .95, null, { timeout: 5000 }); await dad.evaluate(() => userSwing(0, 0, true));
    const before = await state(dad);
    const ring = await son.waitForFunction(() => G.phase === 'catch' && CT, null, { timeout: 6000 }).then(() => true, () => false);
    if (!ring) { await dad.waitForFunction(() => !['windup', 'pitch', 'flight', 'settle', 'vsCatch'].includes(G.phase), null, { timeout: 10000 }); continue }
    await son.screenshot({ path: shots + `/catch-${out}-ring.png` });
    const dadWaits = await dad.evaluate(() => G.phase);
    if (tapIt) {
      await son.waitForFunction(() => { const R = CT.R0 * (1 - (performance.now() - CT.start) / CT.dur); return Math.abs(R - CT.T) <= CT.win * .5 }, null, { timeout: 4000, polling: 'raf' });
      const r = await son.evaluate(() => { const r = C.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] });
      await son.touchscreen.tap(r[0], r[1]);
    }
    await dad.waitForFunction(() => !['flight', 'settle', 'vsCatch'].includes(G.phase), null, { timeout: 10000 });
    await son.waitForFunction(() => !['flight', 'settle', 'catch'].includes(G.phase) && !CT, null, { timeout: 10000 });
    await wait(150);
    const a = await state(dad), c = await state(son);
    await son.screenshot({ path: shots + `/catch-${out}-after.png` });
    log.push({ out, tapIt, dadWaits, before, dad: a, son: c, inSync: a.o === c.o && a.you === c.cpu && a.bases === c.bases });
    return;
  }
  log.push({ out, tapIt, noRing: true });
}
await play('fly', true);
await play('double', false);
await play('fly', false);
console.log(JSON.stringify({ log, errs }, null, 1));
await b.close();
