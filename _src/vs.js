/* ---- Online Vs in the web app: private rooms by code, Copy/Share, reconnects after a drop ---- */
window.CDVS=(()=>{
 const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
 const API=(local&&localStorage.getItem('cd_vs'))||'__CD_VS__';
 const ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789',LEN=6;
 const esc=s=>String(s??'').replace(/[<>&"]/g,'');
 const css=document.createElement('style');css.textContent=`
.vsjoin{display:flex;gap:8px}.vsjoin input{flex:1;min-width:0;text-align:center;letter-spacing:.14em;text-transform:uppercase}
.vsjoin .big,.vsshare .big{flex:none;font-size:clamp(12px,3.8cqw,16px);padding:10px 12px 7px}
.vsshare{display:flex;gap:8px}.vsshare .big{flex:1}
.vsor{color:var(--cream);opacity:.8;text-align:center;font-weight:700;font-size:13px}
#vsToast{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:40;background:var(--ink,#1a1a2e);color:#ffd23f;font-weight:700;font-family:var(--body,sans-serif);font-size:14px;padding:7px 14px;border-radius:999px;border:2px solid #ffd23f;pointer-events:none}
`;document.head.appendChild(css);
 let toastT=0;
 function toast(t,ms){let el=document.getElementById('vsToast');if(!t){if(el)el.remove();return}
  if(!el){el=document.createElement('div');el.id='vsToast';document.body.appendChild(el)}el.textContent=t;clearTimeout(toastT);if(ms)toastT=setTimeout(()=>toast(''),ms)}

 // Pull a room code out of whatever got pasted: the code itself, the share message, or the link.
 function parse(text){const t=String(text||'').toUpperCase();const re=`([${ALPHA}]{${LEN}})`;
  const m=t.match(new RegExp('VS=\\s*'+re))||t.match(new RegExp('CODE[:\\s]+'+re))||t.replace(/[\s-]/g,'').match(new RegExp('^'+re+'$'))||t.match(new RegExp('\\b'+re+'\\b'));
  return m?m[1]:''}
 const link=code=>location.origin+location.pathname+'?vs='+code;
 const msg=code=>`Play me in Cash Diamond Home Run Derby! Code: ${code}`;

 // One match connection. Looks like the Claude room API the game already uses.
 function Match(){
  const subs=new Set();let ws=null,me=null,token=null,code=null,mine={},list=[],closed=false,tries=0,pingT=0,pongAt=0,retryT=0,firstJoin=null;
  const self={code:null,
   presence(p){Object.assign(mine,p);put({t:'presence',p});return Promise.resolve()},
   onPeers(cb,err){const s={cb,err};subs.add(s);if(me)cb({peers:shape()});return()=>subs.delete(s)},
   leave(){closed=true;put({t:'leave'});finish();return Promise.resolve()}};
  function shape(){return list.map(x=>({id:x.id,isMe:x.id===me,sameTab:x.id===me,kind:'viewer',presence:x.online?x.p:Object.assign({},x.p,{away:true})}))}
  function put(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))}
  function finish(){clearInterval(pingT);clearTimeout(retryT);toast('');if(ws){try{ws.close()}catch(e){}}ws=null}
  function fail(text){finish();closed=true;toast(text,5000);subs.forEach(s=>s.err&&s.err(text))}
  function open(first){ws=new WebSocket(API.replace(/^http/,'ws')+'/vs');const sock=ws;
   sock.onopen=()=>{tries=0;pongAt=Date.now();sock.send(JSON.stringify(first()));clearInterval(pingT);
    pingT=setInterval(()=>{if(Date.now()-pongAt>12000){try{sock.close()}catch(e){}return}put({t:'ping'})},4000)};
   sock.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}pongAt=Date.now();
    if(m.t==='joined'){me=m.me;token=m.token;code=self.code=m.code;toast('');
     if(m.resumed&&Object.keys(mine).length)put({t:'presence',p:mine});
     if(firstJoin){firstJoin.res(self);firstJoin=null}}
    else if(m.t==='peers'){list=m.peers||[];const ch={peers:shape()};subs.forEach(s=>s.cb(ch))}
    else if(m.t==='error'){const why={no_room:'No game with that code. Check it with your friend.',full:'That game already has two players.',slow_down:'Too many tries. Wait a few minutes.'}[m.e]||'Could not join that game.';
     if(firstJoin){firstJoin.rej(Object.assign(new Error(why),{cdMsg:why}));firstJoin=null;closed=true;finish()}}
    else if(m.t==='gone'){toast('');fail('That game has ended.')}};
   sock.onclose=()=>{if(sock!==ws)return;clearInterval(pingT);ws=null;
    if(closed)return;
    if(firstJoin){firstJoin.rej(Object.assign(new Error('x'),{cdMsg:'Could not reach the game server. Check your internet and try again.'}));firstJoin=null;closed=true;return}
    retry()}}
  function retry(){if(closed||ws||!token)return;clearTimeout(retryT);toast('Reconnecting…');
   if(++tries>40)return fail('Lost the match connection.');
   retryT=setTimeout(()=>open(()=>({t:'resume',code,token})),Math.min(4000,400*tries))}
  addEventListener('online',()=>{tries=0;retry()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||closed)return;
   if(ws&&ws.readyState===1){put({t:'ping'});return}tries=0;retry()});
  self.start=req=>new Promise((res,rej)=>{firstJoin={res,rej};open(()=>Object.assign({nick:(mine.nick||'')},req))});
  return self}

 const room={
  onPeers(){return()=>{}},peers(){return[]},presence(){return Promise.resolve()},
  join(name){const want=String(name).replace(/^hrd-/,'').toUpperCase(),m=Match();
   const n=(()=>{try{return localStorage.getItem('cd_nick')||''}catch(e){return''}})();
   return m.start(want==='NEW'?{t:'create',nick:n}:{t:'join',code:want,nick:n})}};

 // Lobby: your name, Create game, or paste a code and Join. No list of open games.
 function lobby(box){const pre=pending;pending='';
  const n=(()=>{try{return localStorage.getItem('cd_nick')||''}catch(e){return''}})();
  box.innerHTML=`<div class="oncol"><label class="onlab" for="nickIn">Your nickname</label><input id="nickIn" maxlength="14" placeholder="Type a nickname" value="${esc(n)}"></div>
<div class="oncol"><button class="big" id="vsMake">Create game</button><p class="onnote">You get a code to send to someone you know. Games are private: only people with the code can join.</p></div>
<div class="vsor">or join a friend's game</div>
<div class="oncol"><div class="vsjoin"><input id="codeIn" maxlength="40" placeholder="PASTE CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(pre)}"><button class="big alt" id="vsPaste">Paste</button></div>
<button class="big" id="jnMatch">Join game</button></div>`;
  const nm=()=>{const v=$('nickIn').value.trim();try{localStorage.setItem('cd_nick',v)}catch(e){}return v};
  $('nickIn').oninput=nm;
  if(!navigator.clipboard||!navigator.clipboard.readText)$('vsPaste').hidden=true;
  $('vsPaste').onclick=async()=>{try{const t=await navigator.clipboard.readText();const c=parse(t);$('codeIn').value=c||t.trim().slice(0,40);onlineMsg(c?'':'That doesn’t look like a game code.')}catch(e){onlineMsg('Press and hold the box, then tap Paste.')}};
  $('codeIn').onblur=()=>{const c=parse($('codeIn').value);if(c)$('codeIn').value=c};
  $('vsMake').onclick=()=>{if(!nm())return onlineMsg('Type a nickname first.'),$('nickIn').focus();onlineMsg('');joinMatch('new',true)};
  $('jnMatch').onclick=()=>{const c=parse($('codeIn').value);if(!nm())return onlineMsg('Type a nickname first.'),$('nickIn').focus();
   if(!c)return onlineMsg('Game codes are 6 letters and numbers.');$('codeIn').value=c;onlineMsg('Joining…');joinMatch(c,false).then(()=>{if(NET.mr)onlineMsg('')})};
  if(pre&&n)$('jnMatch').click();else if(pre)$('nickIn').focus()}

 // Copy and Share buttons under the match code.
 function shareRow(box){if(!NET.code||!NET.host)return;const code=NET.code;
  const row=document.createElement('div');row.className='vsshare';
  row.innerHTML=`<button class="big alt" id="vsCopy">Copy code</button>${navigator.share?'<button class="big" id="vsShare">Share</button>':''}`;
  const code$=box.querySelector('.oncode');(code$&&code$.parentNode||box).insertBefore(row,code$?code$.nextSibling:null);
  $('vsCopy').onclick=async()=>{const t=msg(code)+'\n'+link(code);let ok=false;
   try{await navigator.clipboard.writeText(t);ok=true}catch(e){try{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();ok=document.execCommand('copy');a.remove()}catch(x){}}
   onlineMsg(ok?'Copied! Paste it in a text to your friend.':'Copy did not work. Tell your friend the code: '+code)};
  if(navigator.share)$('vsShare').onclick=()=>navigator.share({title:'Cash Diamond',text:msg(code),url:link(code)}).catch(()=>{})}

 // Opened from a shared link: go straight to Join with the code filled in.
 let pending='';
 try{const q=new URLSearchParams(location.search),c=parse('VS='+(q.get('vs')||''));
  if(c){pending=c;q.delete('vs');history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
   addEventListener('load',()=>setTimeout(()=>{if($('online').hidden)openOnline()},300))}}catch(e){}

 return{room:()=>room,lobby,shareRow,parse}})();
