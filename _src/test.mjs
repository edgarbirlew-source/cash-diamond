import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:8099/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) });
await p.goto(URL, { waitUntil: 'networkidle' });
const man = await p.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.ok && (await r.json()).name });
await p.evaluate(() => navigator.serviceWorker.ready);
const ctrl = await p.evaluate(async () => { for (let i = 0; i < 20 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 200)); return !!navigator.serviceWorker.controller });
await p.screenshot({ path: 'shot-title.png' });
// save something then reload to check progress persists
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cashdiamond') || '{}'); s.money = 4321; localStorage.setItem('cashdiamond', JSON.stringify(s)) });
await p.reload({ waitUntil: 'networkidle' });
const money = await p.textContent('#money');
await p.tap('#playBtn'); await p.waitForTimeout(2500); await p.screenshot({ path: 'shot-game.png' });
// offline
await ctx.setOffline(true);
await p.reload({ waitUntil: 'load' }).catch(e => errs.push('offline reload ' + e.message));
const offTitle = await p.title(); const offBtn = await p.isVisible('#derbyBtn');
await p.tap('#derbyBtn').catch(()=>{}); await p.waitForTimeout(2000); await p.screenshot({ path: 'shot-offline-derby.png' });
await ctx.setOffline(false);
const p2 = await ctx.newPage(); await p2.goto(URL); await p2.tap('#onlineBtn'); await p2.waitForTimeout(800); const onl = await p2.textContent('#onBody');
console.log(JSON.stringify({ man, ctrl, money, offTitle, offBtn, onl, errs }, null, 1));
await b.close();
