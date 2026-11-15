/* ---- Growth + money (BIRCO standard, 2026-11-15) ----
 * 1. "More from BIRCO" (shared module birco/crosspromo.js): title-screen button + end-of-game bar. Never during play.
 * 2. Full Game owners: no ads, no promo interruptions; their "double it" bonus needs no video.
 * 3. Rewarded ads (store apps only): after a game / Derby level / Pitch stage, the player MAY tap
 *    "Watch a video: double it" to double the cash won in that game. Nothing ever plays by itself.
 */
window.CDM=(()=>{
 const full=()=>!!(window.CD&&CD.isFull&&CD.isFull());
 const ads=()=>!!(window.CDN&&CDN.ads&&CDN.ads.available);
 const CAP=5000,MIN=100;
 let base=null,bar=null,hold=null,busy=false;
 if(window.BIRCO&&BIRCO.promo)BIRCO.promo.init({game:'cashdiamond',fallback:window.CD_PROMO||null,isFull:full,
  onOpen:()=>{paused=true},onClose:()=>{if(busy)release();else paused=false}});

 const css=document.createElement('style');css.textContent=`
.cdmBar{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:25;width:calc(100% - 24px);max-width:420px;box-sizing:border-box;
 background:var(--cream);color:var(--ink);border:3px solid var(--ink);border-radius:16px;box-shadow:0 5px 0 var(--ink);padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;font-family:var(--body);font-weight:700;font-size:14px}
.cdmBar b{flex:1 1 100%;text-align:center;font-size:15px}
.cdmBar button{flex:1 1 40%;min-width:0;font-family:var(--display);font-size:15px;padding:9px 6px 6px;border:3px solid var(--ink);border-radius:12px;box-shadow:0 3px 0 var(--ink);cursor:pointer;color:var(--ink)}
.cdmBar .cdmGo{background:#5ee08a}.cdmBar .cdmMore{background:var(--sun)}
`;document.head.appendChild(css);

 function hide(){if(bar){bar.remove();bar=null}}
 function release(){const h=hold;hold=null;busy=false;paused=false;hide();if(h&&G===h.g)h.fn()}
 // The game asks before auto-starting the next game. While the bar is up it waits a little longer,
 // and while the player is using it (video, More from BIRCO) it waits until they are done.
 function after(fn){const g=G;if(busy){hold={fn,g};return}
  if(bar&&!bar.dataset.waited){bar.dataset.waited='1';setTimeout(()=>{if(G===g)after(fn)},2500);return}
  hide();fn()}
 function start(){base=S.money;hide();hold=null;busy=false}
 function menu(){hide();hold=null;busy=false;base=null}
 function end(){if(!G||G.online||G.vs||base==null)return;const gain=S.money-base;base=null;
  const canDouble=gain>=MIN&&(full()||ads()),reward=Math.min(gain,CAP);
  const promo=window.BIRCO&&BIRCO.promo;
  if(!canDouble&&!promo)return;
  hide();bar=document.createElement('div');bar.className='cdmBar';
  bar.innerHTML=(canDouble?`<b>You won ${fmt(gain)} this game!</b><button class="cdmGo" data-go>${full()?'Double it! (Full Game)':'▶ Watch a video: double it'}</button>`:'')+
   (promo?'<button class="cdmMore" data-more>More from BIRCO</button>':'');
  bar.addEventListener('pointerdown',e=>e.stopPropagation());
  const go=bar.querySelector('[data-go]');if(go)go.onclick=()=>double(reward,go);
  const mo=bar.querySelector('[data-more]');if(mo)mo.onclick=()=>{busy=true;paused=true;BIRCO.promo.open()};
  document.body.appendChild(bar);
  if(ads()&&!full())CDN.ads.warm();
 }
 async function double(n,btn){if(busy&&btn.disabled)return;busy=true;paused=true;btn.disabled=true;
  if(full()){pay(n);return}
  btn.textContent='Loading video…';
  try{if(await CDN.ads.show())pay(n);else{btn.textContent='No reward: video closed early';setTimeout(release,1400)}}
  catch(e){btn.textContent='No video right now. Try later!';setTimeout(release,1600)}}
 function pay(n){S.money+=n;save();ui();banner('CASH DOUBLED!','+'+fmt(n),'#5ee08a',1600);hide();setTimeout(release,1700)}

 // title screen: "More from BIRCO" (and the ad privacy link where the law needs one)
 addEventListener('load',()=>{const m=document.getElementById('modes');if(!m||!window.BIRCO)return;
  const b=document.createElement('button');b.className='big alt';b.id='moreBtn';b.textContent='More from BIRCO';b.style.flex='1 1 100%';
  b.onclick=()=>{const extra=ads()&&!full()?'<button class="bpLink" data-privacy hidden>Ad privacy choices</button>':'';BIRCO.promo.open(null,extra);
   const pv=document.querySelector('.bpSheet [data-privacy]');if(pv)CDN.ads.privacyNeeded().then(r=>{if(r){pv.hidden=false;pv.onclick=()=>CDN.ads.privacy()}})};
  const fb=document.getElementById('fullBtn');m.insertBefore(b,fb||null)});
 return{start,end,after,hide:menu,isFull:full}})();
