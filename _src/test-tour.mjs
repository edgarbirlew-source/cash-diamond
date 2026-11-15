// Tournament with 5 phones: one makes it, three join by code, one by the shared link. The bracket
// has 3 byes. Checks: everyone sees the lobby and the bracket, a real Pitch & Bat match runs and
// stays in sync, results move winners on, a phone that closes the app mid-match can start it over,
// a player who leaves the app too long forfeits, and there is exactly one champion.
// Run the server with short timeouts: T_JOIN_MS=15000 T_AWAY_MS=15000 T_REPORT_MS=5000 T_TICK_MS=1000 bun _src/server/vs.ts
// node _src/test-tour.mjs [game url] [vs server url]
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8099/';
const VS = process.argv[3] || 'http://localhost:3000';
const shots = process.env.SHOTS || '.';
const b = await chromium.launch();
const phone = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true };
const errs = [], log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
async function open(name, url = URL) {
  const ctx = await b.newContext(phone);
  await ctx.addInitScript(([vs, nick]) => {
    localStorage.setItem('cd_vs', vs); localStorage.setItem('cd_nick', nick);
    let vis = 'visible'; Object.defineProperty(document, 'visibilityState', { get: () => vis });
    window.__bg = on => { vis = on ? 'hidden' : 'visible'; document.dispatchEvent(new Event('visibilitychange')) };
  }, [VS, name]);
  const p = await ctx.newPage(); p.nick = name;
  p.on('pageerror', e => errs.push(name + ' pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_INTERNET/.test(m.text())) errs.push(name + ' ' + m.text()) });
  await p.goto(url, { waitUntil: 'load' });
  return p;
}
const st = p => p.evaluate(() => CDT.state());
const names = ['Dad', 'Son', 'Ann', 'Ben'];
const ph = {};
for (const n of names) ph[n] = await open(n);
const dad = ph.Dad;
await dad.tap('#tourBtn'); await dad.waitForSelector('#tMake'); await dad.tap('#tMake');
await dad.waitForSelector('.tcode b'); const code = await dad.textContent('.tcode b');
await dad.screenshot({ path: shots + '/tour-0-dad-lobby.png' });
for (const n of ['Son', 'Ann', 'Ben']) { const p = ph[n]; await p.tap('#tourBtn'); await p.fill('#tCode', code); await p.tap('#tJoin'); await p.waitForSelector('.tcode b') }
// Cal opens the invite link
ph.Cal = await open('Cal', URL + '?t=' + code); await ph.Cal.waitForSelector('.tcode b', { timeout: 8000 });
const all = () => Object.values(ph);
await wait(500);
const lobby = {}; for (const p of all()) lobby[p.nick] = (await st(p)).players.length;
const startOff = await ph.Son.$('#tStart');
await ph.Cal.screenshot({ path: shots + '/tour-1-cal-lobby.png' });
await dad.tap('#tStart');
await wait(1500);
const s0 = await st(dad);
const nick = id => s0.players.find(x => x.id === id).nick;
const draw = s0.rounds.map(rd => rd.map(m => `${m.a ? nick(m.a) : '-'} v ${m.b ? nick(m.b) : 'bye'} [${m.st}]`));
await dad.screenshot({ path: shots + '/tour-2-dad-bracket.png' });

// helpers
const byNick = n => ph[n];
async function liveMatches() { const s = await st(dad); return s.rounds.flat().filter(m => m.st === 'ready' || m.st === 'play').map(m => ({ id: m.id, r: m.r, a: nick(m.a), b: nick(m.b) })) }
const inGame = p => p.waitForFunction(() => G.vs && ['wait', 'aim'].includes(G.phase), null, { timeout: 25000 });
async function throwPitch(pit) {
  await pit.waitForFunction(() => G.phase === 'aim', null, { timeout: 20000 });
  const tap = await pit.evaluate(() => { const r = C.getBoundingClientRect(), k = r.width / W; return [r.left + (ZONE.x + ZONE.w / 2) * k, r.top + (ZONE.y + ZONE.h / 2) * k] });
  await pit.touchscreen.tap(tap[0], tap[1]);
}
const settled = p => p.waitForFunction(() => !['windup', 'pitch', 'flight', 'settle', 'catch', 'vsCatch', 'switch', 'countdown'].includes(G.phase), null, { timeout: 30000 });
const gs = p => p.evaluate(() => ({ ph: G.phase, top: G.top, b: G.balls, s: G.strikes, o: G.outs, you: G.you, cpu: G.cpu }));
// end a game the way a real one ends: same score on both phones, then both call over()
async function finish(win, lose, w = 3, l = 1) {
  await win.evaluate(([w, l]) => { G.you = w; G.cpu = l; VS.over() }, [w, l]);
  await lose.evaluate(([w, l]) => { G.you = l; G.cpu = w; VS.over() }, [w, l]);
}
const out = {};

// round 1 / first live match: play real pitches, check sync, then end it
let lm = await liveMatches(); out.live1 = lm;
const m1 = lm[0], A = byNick(m1.a), B = byNick(m1.b);
await inGame(A); await inGame(B);
await A.screenshot({ path: shots + '/tour-3-match-a.png' });
let sync = 0;
for (let i = 0; i < 4; i++) {
  const pit = (await A.evaluate(() => G.top)) ? B : A;
  await throwPitch(pit); await settled(A); await settled(B); await wait(200);
  const [x, y] = [await gs(A), await gs(B)], [bat, pt] = x.top ? [x, y] : [y, x];
  if (bat.b === pt.b && bat.s === pt.s && bat.o === pt.o && bat.you === pt.cpu) sync++;
}
out.sync = sync;
// a second match may be live at the same time (2 v 3 after byes): run them side by side
if (lm[1]) { const C2 = byNick(lm[1].a), D2 = byNick(lm[1].b); await inGame(C2); await inGame(D2);
  // D2 closes the app mid-match and opens it again: the match starts over on both phones by itself
  const room0 = await C2.evaluate(() => NET.code);
  await D2.reload({ waitUntil: 'load' }); await wait(1200);
  await D2.screenshot({ path: shots + '/tour-4-rejoin.png' });
  await D2.waitForFunction(r => G.vs && NET.code !== r && ['wait', 'aim'].includes(G.phase), room0, { timeout: 25000 });
  await C2.waitForFunction(r => G.vs && NET.code !== r && ['wait', 'aim'].includes(G.phase), room0, { timeout: 25000 });
  out.replay = { newRoom: room0 !== await C2.evaluate(() => NET.code), same: await C2.evaluate(() => NET.code) === await D2.evaluate(() => NET.code) };
  await finish(C2, D2, 5, 2);
  out.m2 = { winner: C2.nick };
}
await finish(A, B);
out.m1 = { winner: A.nick };
await wait(3500);
await B.screenshot({ path: shots + '/tour-5-loser.png' }); await A.screenshot({ path: shots + '/tour-5-winner.png' });
out.loserCard = await B.textContent('.tcard').catch(() => 'no card');

// later rounds: the first live match is decided by one player leaving the app too long
let rounds = 0, awayDone = false;
while (rounds++ < 6) {
  const s = await st(dad); if (s.state === 'done') break;
  lm = await liveMatches(); if (!lm.length) { await wait(1000); continue }
  for (const m of lm) {
    const X = byNick(m.a), Y = byNick(m.b);
    await inGame(X); await inGame(Y);
    if (!awayDone) { awayDone = true; await Y.evaluate(() => __bg(true)); await wait(19000); await Y.evaluate(() => __bg(false));
      out.away = { stayed: m.a, away: m.b, w: nick((await st(dad)).rounds.flat().find(x => x.id === m.id).w) };
      await wait(1500); await Y.screenshot({ path: shots + '/tour-6-away.png' }); continue }
    await finish(X, Y, 4, 3);
  }
  await wait(6000);
}
const fin = await st(dad);
out.champ = fin.champ && nick(fin.champ); out.state = fin.state;
await wait(3500);
const champP = byNick(out.champ);
if (champP) { await champP.screenshot({ path: shots + '/tour-7-champion.png' }); out.champCard = await champP.textContent('.tcard').catch(() => '') }
await dad.screenshot({ path: shots + '/tour-7-dad-final.png' });
out.final = fin.rounds.map(rd => rd.map(m => `${m.a ? nick(m.a) : '-'} v ${m.b ? nick(m.b) : 'bye'} → ${m.w ? nick(m.w) : '?'} (${m.why}${m.sc ? ' ' + m.sc.join('-') : ''})`));
// late joiner is refused
const late = await open('Late'); await late.tap('#tourBtn'); await late.fill('#tCode', code); await late.tap('#tJoin'); await wait(1200);
out.lateMsg = await late.textContent('#tMsg');
console.log(JSON.stringify({ code, lobby, startHiddenForOthers: !startOff, draw, ...out, errs }, null, 1));
await b.close();
