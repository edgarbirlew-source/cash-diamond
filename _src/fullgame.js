/* ---- Full Game: free tier, inning-break card, $3.99 unlock (Stripe on the web, Apple/Google in the store apps) ---- */
window.CD=(()=>{
 const API=(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&localStorage.getItem('cd_api'))||'__CD_API__';
 const PAY=(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&localStorage.getItem('cd_pay'))||'__CD_PAY__';
 const STORE=!!(window.CD_STORE&&window.CDN&&CDN.native); // store apps must sell through Apple / Google in-app purchase
 let PRICE='$3.99';
 const FREE={lg:3,dv:3,pc:4};           // first N leagues / Derby levels / Pitch stages are free
 const GAP=5*60*1000;                   // at least 5 minutes between break cards
 const NAMES={lg:'College, Minor League, Big League and the World Series',dv:'every HR Derby level after level 3, plus the Legend levels',pc:'every Pitch Challenge stage after stage 4, plus the Pro tiers'};
 const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
 const put=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
 const full=()=>{try{return !!JSON.parse(get('cd_full')||'null')?.code}catch(e){return false}};
 const locked=(k,i)=>!full()&&i>=FREE[k];

 const css=document.createElement('style');css.textContent=`
.cdsheet{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,20,50,.82)}
.cdcard{width:100%;max-width:360px;max-height:100%;overflow-y:auto;background:var(--cream);color:var(--ink);border:4px solid var(--ink);border-radius:20px;box-shadow:0 7px 0 var(--ink);padding:18px 16px 16px;display:flex;flex-direction:column;gap:10px;text-align:center;font-family:var(--body);font-weight:700}
.cdcard h2{margin:0;font-family:var(--display);font-weight:400;font-size:30px;line-height:1;color:var(--sun);text-shadow:-2px 0 var(--ink),2px 0 var(--ink),0 -2px var(--ink),0 3px var(--ink);transform:rotate(-2deg)}
.cdcard p{margin:0;line-height:1.25;font-size:16px}
.cdcard ul{margin:0;padding:0;list-style:none;text-align:left;display:flex;flex-direction:column;gap:4px;font-size:15px}
.cdcard li:before{content:'⚾ '}
.cdprice{font-family:var(--display);font-size:26px;color:#1f8a3a}
.cdprice small{display:block;font-family:var(--body);font-size:13px;color:#7a5a3a}
.cdcard .big{flex:none;width:100%}
.cdcard input{font-family:var(--display);font-size:20px;text-align:center;letter-spacing:.08em;padding:9px 10px 6px;border-radius:12px;border:3px solid var(--ink);background:#fff;color:var(--ink);width:100%;box-sizing:border-box}
.cdlink{background:none;border:0;color:#2c6fb5;font:inherit;font-size:15px;text-decoration:underline;cursor:pointer;padding:4px}
.cdmsg{color:#c62f28;min-height:1em}
.cdcode{font-family:var(--display);font-size:24px;letter-spacing:.06em;background:#fff;border:3px dashed var(--ink);border-radius:12px;padding:8px 6px 4px;user-select:all}
.lv.cdlock small{color:#c62f28}
`;document.head.appendChild(css);

 let sheet=null,onClose=null;
 function close(){if(sheet){sheet.remove();sheet=null}const f=onClose;onClose=null;if(f)f();else resume()}
 function resume(){paused=false;if(G.phase==='wait')G.next=performance.now()+900;ui()}
 function show(html,wire,after){if(sheet)sheet.remove();onClose=after||null;paused=true;
  sheet=document.createElement('div');sheet.className='cdsheet';sheet.innerHTML=`<div class="cdcard">${html}</div>`;
  sheet.addEventListener('pointerdown',e=>e.stopPropagation());document.body.appendChild(sheet);
  const q=s=>sheet.querySelector(s);(q('[data-x]')||{}).onclick=close;wire&&wire(q)}

 function offer(kind,head,after){
  if(full()&&STORE){show(`<h2>Full Game</h2><p>Every league and level is unlocked. Thanks for supporting Cash Diamond!</p><p style="font-size:14px">New phone? Sign in to the same ${CDN.store} account and tap Restore purchase.</p><button class="big" data-x>Back</button>`,null,after);return}
  if(full()){show(`<h2>Full Game</h2><p>Every league and level is unlocked on this phone.</p><p>Your unlock code:</p><div class="cdcode">${JSON.parse(get('cd_full')).code}</div><p style="font-size:14px">Type it on another phone or browser to unlock it there too.</p><button class="big" data-x>Back</button>`,null,after);return}
  show(`<h2>${head||'Get the Full Game'}</h2>
<ul><li>All 7 leagues, up to the World Series</li><li>Every HR Derby and Legend level</li><li>Every Pitch Challenge stage and Pro tier</li><li>No break cards, ever</li></ul>
${kind?`<p style="font-size:14px">Locked in the free game: ${NAMES[kind]}.</p>`:''}
<div class="cdprice">${PRICE} one time<small>Real money. No subscription. A grown-up pays.</small></div>
<button class="big" data-buy>Ask a grown-up</button>
${STORE?'<button class="cdlink" data-restore>Restore purchase</button>':'<button class="cdlink" data-code>I have an unlock code</button>'}
<button class="big alt" data-x>Keep playing free</button>`,q=>{q('[data-buy]').onclick=()=>gate(after);if(STORE)q('[data-restore]').onclick=()=>restore(after);else q('[data-code]').onclick=()=>enter(after)},after)}

 function gate(after){const a=11+Math.floor(Math.random()*8),b=3+Math.floor(Math.random()*6);
  show(`<h2>Grown-ups only</h2><p>To buy, type the answer:</p><p style="font-family:var(--display);font-size:30px">${a} × ${b} = ?</p>
<input inputmode="numeric" autocomplete="off" data-a aria-label="Answer"><p class="cdmsg" data-m></p>
<button class="big" data-go>${STORE?'Buy with '+CDN.store:'Continue to payment'}</button><button class="big alt" data-x>Cancel</button>`,q=>{const inp=q('[data-a]');setTimeout(()=>inp.focus(),50);
   const go=()=>{if(+inp.value.trim()!==a*b){q('[data-m]').textContent='Not quite. Ask a grown-up to help.';inp.value='';return}
    if(STORE)return buyNative(after);
    if(!/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(PAY)){q('[data-m]').textContent='Buying opens soon. Check back in a day or two!';return}
    put('cd_buying',String(Date.now()));location.href=PAY};
   q('[data-go]').onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go()}},after)}

 function enter(after){show(`<h2>Unlock code</h2><p>Type the code from the phone where you bought the Full Game.</p>
<input autocomplete="off" autocapitalize="characters" placeholder="CD-XXXX-XXXX-XXXX" data-c aria-label="Unlock code"><p class="cdmsg" data-m></p>
<button class="big" data-go>Unlock</button><button class="big alt" data-x>Back</button>`,q=>{const inp=q('[data-c]'),m=q('[data-m]');
   q('[data-go]').onclick=async()=>{const code=inp.value.trim().toUpperCase();if(code.replace(/[^A-Z0-9]/g,'').length<14){m.textContent='That code looks too short.';return}
    m.textContent='Checking…';try{const r=await fetch(API+'/redeem?code='+encodeURIComponent(code));const j=await r.json();
     if(j.ok){grant(code);done(after)}else m.textContent=r.status===429?'Too many tries. Wait a few minutes.':'That code didn’t work. Check it and try again.'}
    catch(e){m.textContent='Can’t reach the internet right now. Try again when you’re online.'}}},after)}

 function grant(code){put('cd_full',JSON.stringify({code,at:Date.now()}));put('cd_pending',null);
  if(get('cd_beat3')&&S.unlocked<FREE.lg){S.unlocked=FREE.lg;S.fx=BALLFX[S.unlocked].id;S.fxOn=true;save()}
  const b=document.getElementById('fullBtn');if(b)b.hidden=true;if(!$('title').hidden&&!$('stages').hidden){if($('tTitle').textContent.includes('Derby'))renderDerbyLevels();else renderStages()}ui()}
 // --- store apps: Apple / Google in-app purchase ---
 async function buyNative(after){show(`<h2>One moment…</h2><p>Opening ${CDN.store}.</p>`,null,after);
  try{if(await CDN.buy()){grant('store');done(after)}else close()}
  catch(e){const m=String(e&&(e.message||e)||'');
   if(/cancel/i.test(m)){close();return}
   show(`<h2>Not bought</h2><p>${CDN.store} didn’t finish the purchase, so nothing was charged. You can try again any time.</p><button class="big" data-x>OK</button>`,null,after)}}
 async function restore(after){show(`<h2>Checking…</h2><p>Looking for your Full Game on ${CDN.store}.</p>`,null,after);
  try{if(await CDN.restore()){grant('store');done(after);return}
   show(`<h2>Nothing to restore</h2><p>We didn’t find a Full Game purchase on this ${CDN.store} account.</p><button class="big" data-x>OK</button>`,null,after)}
  catch(e){show(`<h2>Can’t check right now</h2><p>Make sure you’re online and signed in to ${CDN.store}, then try again.</p><button class="big" data-x>OK</button>`,null,after)}}
 function done(after){const c=JSON.parse(get('cd_full')).code;
  if(c==='store'){show(`<h2>Full Game unlocked!</h2><p>Every league and level is open. Thanks for supporting Cash Diamond!</p><button class="big" data-x>Play ball!</button>`,null,after);return}
  show(`<h2>Full Game unlocked!</h2><p>Every league and level is open. Thanks for supporting Cash Diamond!</p><p>Your unlock code:</p><div class="cdcode">${c}</div><p style="font-size:14px">Write it down. Type it on another phone or browser to unlock it there too.</p><button class="big" data-x>Play ball!</button>`,null,after)}

 async function verify(session,quiet){
  if(!quiet)show(`<h2>Unlocking…</h2><p>Checking your payment with Stripe.</p>`);
  try{const r=await fetch(API+'/verify?session='+encodeURIComponent(session));const j=await r.json().catch(()=>({}));
   if(j.ok){grant(j.code);done();return}
   if(r.status===402||r.status===404||r.status===400){put('cd_pending',null);if(!quiet)show(`<h2>Not paid yet</h2><p>Stripe says this payment didn’t go through, so nothing was charged for it. You can try again any time.</p><button class="big" data-x>OK</button>`);return}
   throw new Error(j.error||'server')}
  catch(e){put('cd_pending',session);if(!quiet)show(`<h2>Almost there</h2><p>Your payment went to Stripe, but we couldn’t confirm it just now. The game will finish unlocking the next time you open it online.</p><button class="big" data-x>OK</button>`)}}

 // --- hooks the game calls ---
 const api={
  wall:(k,i)=>locked(k,i),
  dress(k,i,b){if(!locked(k,i))return;b.disabled=false;b.classList.add('cdlock');const sm=b.querySelector('small');if(sm)sm.textContent='🔒 Full Game';b.onclick=e=>{e&&e.stopPropagation&&e.stopPropagation();offer(k)}},
  stop(k,i){if(!locked(k,i))return false;if(k==='lg'){S.cur=Math.min(S.cur,FREE.lg-1);save();buildField(LV())}
   toMenu().then(()=>{if(k==='dv')$('derbyBtn').click();if(k==='pc')$('pcBtn').click();offer(k,'Keep going!',()=>{paused=false;ui()})});return true},
  beat(k){if(k==='lg'){put('cd_beat3','1');setTimeout(()=>{if(!full())offer('lg','You beat High School!',resume)},2600)}},
  brk(cb){if(full())return false;const last=+get('cd_brk')||0;if(Date.now()-last<GAP)return false;put('cd_brk',String(Date.now()));
   show(`<h2>Inning break</h2><p>Liking Cash Diamond? Get every league and level with the Full Game.</p><div class="cdprice">${PRICE} one time<small>No subscription. No ads.</small></div>
<button class="big" data-more>See the Full Game</button><button class="big alt" data-x>Keep playing</button>`,q=>{q('[data-more]').onclick=()=>offer(null,null,cb)},cb);return true},
  open:()=>offer(null),
  isFull:full,
 };

 // title-screen button
 addEventListener('load',()=>{const m=document.getElementById('modes');if(!m||full())return;const b=document.createElement('button');b.className='big';b.id='fullBtn';b.textContent='Full Game '+PRICE;b.style.flex='1 1 100%';b.style.background='#5ee08a';b.onclick=()=>offer(null);m.appendChild(b)});

 // store apps: local price, and unlock again if this store account already owns it
 if(STORE)addEventListener('load',()=>{CDN.price().then(p=>{if(p){PRICE=p;const b=document.getElementById('fullBtn');if(b)b.textContent='Full Game '+p}}).catch(()=>{});
  CDN.owned().then(o=>{if(o&&!full())grant('store')}).catch(()=>{})});
 // back from Stripe with ?paid=cs_...
 else{const u=new URL(location.href),sid=u.searchParams.get('paid');
  if(sid){u.searchParams.delete('paid');history.replaceState(null,'',u.pathname+(u.search||'')+u.hash);put('cd_buying',null);if(!full())addEventListener('load',()=>verify(sid,false))}
  else{const pend=get('cd_pending');if(pend&&!full())addEventListener('load',()=>verify(pend,true))}}
 return api})();
