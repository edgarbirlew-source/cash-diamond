// Host taps Share (share sheet, or copy when there is none); a friend opens the link and joins with no nickname.
// node _src/test-share.mjs [shots dir]   (game on localhost:8099, room server on localhost:3000)
import { chromium } from 'playwright';
const SC=process.argv[2]||'.';
const b = await chromium.launch();
const phone = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read','clipboard-write'] };
const errs=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function open(nick,url,share){const ctx=await b.newContext(phone);
 await ctx.addInitScript(([nick,share])=>{localStorage.setItem('cd_vs','http://localhost:3000');if(nick)localStorage.setItem('cd_nick',nick);
  if(share)navigator.share=async d=>{window.__shared=d}},[nick,share]);
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url,{waitUntil:'load'});return p}
const dad=await open('Dad','http://localhost:8099/',true);
await dad.tap('#onlineBtn');await wait(500);await dad.tap('#vsMake');await dad.waitForSelector('#vsShare');await wait(300);
await dad.screenshot({path:SC+'/host-share.png'});
await dad.tap('#vsShare');await wait(200);const shared=await dad.evaluate(()=>window.__shared);
const linkText=await dad.textContent('#vsLink');console.log('shared',JSON.stringify(shared),'shown',linkText);
// no navigator.share (like Android app WebView): falls back to copy
const dad2=await open('Dad2','http://localhost:8099/',false);
await dad2.evaluate(()=>{delete Navigator.prototype.share});
await dad2.tap('#onlineBtn');await wait(500);await dad2.tap('#vsMake');await dad2.waitForSelector('#vsShare');
await dad2.tap('#vsShare');await wait(300);console.log('fallback msg:',await dad2.textContent('#onMsg'),'| clip:',JSON.stringify(await dad2.evaluate(()=>navigator.clipboard.readText())));
// Friend opens the link with no nickname saved: should auto-join
const son=await open('',linkText.replace('edgarbirlew-source.github.io/cash-diamond','localhost:8099'),false);
await son.waitForSelector('#rdy',{timeout:8000});await wait(800);
await son.screenshot({path:SC+'/friend-joined.png'});await dad.screenshot({path:SC+'/host-sees-friend.png'});
console.log('son url',son.url(),'| dad sees:',await dad.textContent('.onplayers'),'| rdy enabled:',await dad.isEnabled('#rdy'));
await dad.tap('#rdy');await son.tap('#rdy');await wait(5000);
console.log('dad game:',await dad.evaluate(()=>!!(window.G&&G.vs)||document.getElementById('online').hidden),'son game:',await son.evaluate(()=>document.getElementById('online').hidden));
await son.screenshot({path:SC+'/son-playing.png'});
console.log('errors',errs);await b.close();
