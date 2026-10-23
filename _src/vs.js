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
  const subs=new Set(),msgs=new Set(),outbox=[];let ws=null,me=null,token=null,code=null,mine={},list=[],closed=false,tries=0,pingT=0,pongAt=0,retryT=0,firstJoin=null;
  const self={code:null,
   presence(p){Object.assign(mine,p);put({t:'presence',p});return Promise.resolve()},
   onPeers(cb,err){const s={cb,err};subs.add(s);if(me)cb({peers:shape()});return()=>subs.delete(s)},
   send(d){if(ws&&ws.readyState===1&&me)put({t:'msg',d});else if(outbox.length<60)outbox.push(d)},
   onMsg(cb){msgs.add(cb);return()=>msgs.delete(cb)},
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
     outbox.splice(0).forEach(d=>put({t:'msg',d}));
     if(firstJoin){firstJoin.res(self);firstJoin=null}}
    else if(m.t==='msg'){msgs.forEach(f=>{try{f(m.d)}catch(x){console.error(x)}})}
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

 return{room:()=>room,lobby,shareRow,parse,toast}})();

/* ---- Online Vs live game: one phone pitches, the other bats, swap every half inning ----
   Each phone keeps its own G with G.top = "I'm batting". The batter's phone decides every
   result and sends it; the pitcher's phone shows the same pitch, swing and ball flight. */
window.VS=(()=>{
 const T1={k:'STRUCK OUT',strike:'STRIKE',cstrike:'CALLED STRIKE',ball:'BALL',walk:'WALK',foul:'FOUL BALL',fly:'FLIED OUT',ground:'GROUNDED OUT',single:'SINGLE',double:'DOUBLE',triple:'TRIPLE',hr:'HOME RUN!'};
 const CODE=Object.fromEntries(Object.entries(T1).map(([k,v])=>[v,k]));
 // what the pitcher's phone says for each result
 const PIT={k:['STRIKEOUT!','Sat him down','#5ee08a'],strike:['STRIKE','','#5ee08a'],cstrike:['CALLED STRIKE','Painted the corner','#5ee08a'],ball:['BALL','','#8e98be'],
  walk:['WALK','Ball four','#ff5a5f'],foul:['FOUL BALL','','#ffb627'],fly:['FLY OUT','Can of corn','#5ee08a'],ground:['GROUND OUT','Infield handles it','#5ee08a'],
  single:['SINGLE','','#ff5a5f'],double:['DOUBLE','','#ff5a5f'],triple:['TRIPLE','','#ff5a5f'],hr:['HOME RUN!','Gone!','#ff5a5f']};
 let bound=null,waitT=0;
 const v=()=>G.vs;
 const send=d=>{if(NET.mr&&NET.mr.send)NET.mr.send(Object.assign({g:v().g,h:v().half},d))};
 const oppName=()=>((NET.opp&&NET.opp.nick)||'Rival').slice(0,14);

 function start(seed){$('online').hidden=true;$('title').hidden=true;
  if(bound!==NET.mr){bound=NET.mr;NET.mr.onMsg(onMsg)}
  const now=performance.now();
  G=Object.assign(castOf(),{mode:'game',online:true,vs:{host:!!NET.host,half:0,g:seed&0xffffff,opp:oppName(),q:[]},phase:'countdown',next:now+3200,inning:1,top:!!NET.host,you:0,cpu:0,outs:0,balls:0,strikes:0,bases:[0,0,0],innings:3,banner:null,swing:null,
   ln:{you:lineup(),cpu:lineup()},bi:{you:0,cpu:0},fSkins:Array.from({length:8},()=>pick(SKINS)),pSkin:{you:pick(SKINS),cpu:pick(SKINS)},chase:null});
  buildField(LV());P=F=CT=null;floaters=[];
  [3,2,1].forEach((n,i)=>setTimeout(()=>{if(G.vs)banner(String(n),'vs '+G.vs.opp,'#ffd23f',900)},i*1000));
  setTimeout(()=>{if(!G.vs||G.phase!=='countdown')return;banner('PLAY BALL!',G.top?'You bat first':'You pitch first','#5ee08a',1300);G.phase='wait';G.next=performance.now()+1300;ui()},3000);ui()}

 function onMsg(d){const s=v();if(!s||!d||d.g!==s.g||d.h<s.half||G.phase==='over')return;s.q.push(d)}

 // batter: wait for the other phone's pitch
 function batWait(){G.next=Infinity;waitT=performance.now()}
 // pitcher: tell the batter what we threw
 function pitch(d){send({t:'pitch',k:d.k,mph:Math.round(d.mph),tx:Math.round(d.tx*10)/10,ty:Math.round(d.ty*10)/10})}
 function sw(){if(G.top)send({t:'sw'})}
 function hit(){if(!F)return;const f=F;send({t:'hit',f:{out:f.out,q:f.q,X0:f.X0,Z0:f.Z0,h0:f.h0,pw:f.pw,X1:f.X1,Z1:f.Z1,h1:f.h1,peak:f.peak,dur:f.dur}})}
 // batter: the pitch is decided, send the result and the new count
 function res(){const s=v();if(!s||!G.top)return;const k=CODE[G.banner&&G.banner.t1]||'strike';
  send({t:'res',k,st:{b:G.balls|0,s:G.strikes|0,o:G.outs|0,bases:G.bases.map(x=>x?1:0),r:G.you|0},pa:G.balls===0&&G.strikes===0});
  if(G.outs<3)check()}

 function tick(now){const s=v();if(!s)return;
  if(G.top&&G.phase==='wait'&&G.next===Infinity&&now-waitT>1400)CDVS.toast(oppName()+' is picking a pitch…');
  const m=s.q[0];if(!m)return;
  if(m.h>s.half)return; // next half inning: wait for our own switch
  if(m.t==='pitch'){if(!(G.top&&G.phase==='wait'&&G.next===Infinity))return;s.q.shift();CDVS.toast('');
   G.pend={k:PITCHES[m.k]?m.k:'fast',mph:+m.mph||80,tx:+m.tx,ty:+m.ty,cpu:true};G.phase='windup';G.relAt=now+650;ui();return}
  if(G.top){s.q.shift();return}
  if(m.t==='sw'){if(!(G.phase==='pitch'&&P))return;s.q.shift();if(!P.swung){P.swung=true;G.swing={at:now,cAt:now+120,aimY:P.final.y,bx:P.final.x}}return}
  if(m.t==='hit'){if(!(G.phase==='pitch'&&P))return;s.q.shift();const f=m.f||{};
   const t=Math.min((now-P.start)/P.dur,1.05),pos=ballPos(P,t);
   F={out:f.out,q:+f.q||0,X0:+f.X0||0,Z0:+f.Z0||1,h0:+f.h0||1,pw:+f.pw||0,X1:+f.X1||0,Z1:+f.Z1||100,h1:+f.h1||0,peak:+f.peak||2,dur:Math.max(300,+f.dur||900),start:now,fx:null,fxBall:null,hot:(+f.q||0)>.72||['double','triple','hr'].includes(f.out),trail:[]};
   G.chase=null;G.phase='flight';P.hit=true;if(!G.swing)G.swing={at:now,cAt:now,aimY:P.final.y,bx:P.final.x};G.swing.hit=true;
   G.burst=f.out==='foul'?{x:pos.x,y:pos.y,at:now,t:'TINK!'}:['single','double','triple','hr'].includes(f.out)?{x:pos.x,y:pos.y,at:now,t:f.out==='single'?'POP!':'CRACK!',big:f.out==='hr'}:null;
   contactFX(pos.x,pos.y,f.out,F.q);if(f.out!=='foul')G.ba={mode:f.out==='hr'?'hr':'run',at:now+330,b:curBatter(),top:false};return}
  if(m.t==='res'){
   if(G.phase==='flight'||G.phase==='windup'||G.phase==='aim'||(G.phase==='pitch'&&P&&(now-P.start)/P.dur<1))return;
   s.q.shift();apply(m);return}
  s.q.shift()}

 // pitcher: show the batter's result and copy the count, bases and score
 function apply(m){const st=m.st||{},before=G.outs,b=PIT[m.k]||PIT.strike;
  G.balls=st.b|0;G.strikes=st.s|0;G.outs=st.o|0;G.bases=(st.bases||[0,0,0]).map(x=>x?1:0);G.moves=[];
  const runs=(st.r|0)-G.cpu;G.cpu=st.r|0;
  banner(b[0],runs>0?(runs>1?runs+' runs score':'A run scores'):b[1],b[2],m.k==='hr'?2000:1100);
  if(m.k==='k'){G.cheerAt=performance.now();G.cheerTeam='you';earn(150,'Strikeout',200,330)}
  else if(G.outs>before)earn(40,'Out',200,330);
  if(m.pa)nextBatter();
  if(G.outs>=3){endHalf();return}
  if(check())return;
  nextPitch(m.k==='hr'?2400:1200)}

 const hostRuns=()=>v().host?G.you:G.cpu,guestRuns=()=>v().host?G.cpu:G.you;
 // walk-off: the guest bats in the bottom half and goes ahead in the last inning
 function check(){const s=v();if(s.half%2===1&&Math.floor(s.half/2)+1>=G.innings&&guestRuns()>hostRuns()){over();return true}return false}

 function endHalf(){const s=v(),h=s.half,inn=Math.floor(h/2)+1;
  if(h%2===0&&inn>=G.innings&&guestRuns()>hostRuns())return over();
  if(h%2===1&&inn>=G.innings&&hostRuns()!==guestRuns())return over();
  const batNext=((h+1)%2===0)===s.host;
  G.phase='switch';banner('SIDE RETIRED',batNext?'Back to the plate':'Take the mound','#ffb627',1700);
  const gs=G;setTimeout(()=>{if(G!==gs||G.phase!=='switch')return;s.half++;G.top=batNext;G.inning=Math.floor(s.half/2)+1;
   G.outs=0;resetCount();G.bases=[0,0,0];G.moves=[];G.ba=null;G.bc=[null,null,null];nextPitch(600)},1800)}

 function over(why){const s=v();if(!s||G.phase==='over')return;G.phase='over';P=F=CT=null;CDVS.toast('');
  const left=why==='left',win=left||G.you>G.cpu,tie=!left&&G.you===G.cpu;
  if(win&&!tie){S.wins++;earn(2000,'Online win',200,300);fireworks(5)}else save();
  banner(left?'YOU WIN!':tie?'TIE GAME':win?'YOU WIN!':s.opp.toUpperCase().slice(0,10)+' WINS',left?s.opp+' left the game':`${G.you}–${G.cpu}`,win?'#5ee08a':'#ff5a5f',2400);
  NET.started=false;if(NET.mr)NET.mr.presence({ready:false,go:null,playing:false}).catch(()=>{});
  const gg=G;setTimeout(()=>{if(G!==gg)return;showOverlay(left?'You Win!':tie?'Tie Game!':win?'You Win!':'You Lost',left?`${s.opp} left the game. You win ${G.you}–${G.cpu}.`:`You ${G.you} – ${G.cpu} ${s.opp}. Tap Online Vs to play again.`,false,'online')},2600);ui()}

 // the other player dropped or left mid-game
 function peers(opp){const s=G&&G.vs;if(!s||G.phase==='over')return;
  if(!opp)return over('left');
  if(opp.presence&&opp.presence.away)CDVS.toast(oppName()+' lost connection. Waiting…');
  else if(document.getElementById('vsToast')&&/lost connection/.test(document.getElementById('vsToast').textContent))CDVS.toast('')}

 // match screen: the host picks the game, both see it
 function modeRow(w){const gm=NET.host?(NET.gm||'ball'):((NET.peers.find(p=>p.presence&&p.presence.host)||{}).presence||{}).gm||'ball';
  const note=w.querySelector('.onnote');
  if(note)note.textContent=(NET.host?'Send this code to your friend. ':'')+(gm==='ball'?'Live game: one of you pitches, the other bats, and you switch every 3 outs. 3 innings, most runs wins $2,000.':'Race: you each bat against the same computer pitches in a 10-out derby. Highest score wins $2,000.');
  const row=document.createElement('div');row.className='vsshare';
  if(NET.host){row.innerHTML=`<button class="big ${gm==='ball'?'':'alt'}" data-gm="ball">Pitch &amp; Bat</button><button class="big ${gm==='derby'?'':'alt'}" data-gm="derby">HR Derby race</button>`;
   row.querySelectorAll('button').forEach(b=>b.onclick=()=>{NET.gm=b.dataset.gm;if(NET.mr)NET.mr.presence({gm:NET.gm}).catch(()=>{});renderOnline()})}
  else row.innerHTML=`<p class="onnote">Game: <b>${gm==='ball'?'Pitch &amp; Bat':'HR Derby race'}</b> (the host picks)</p>`;
  w.appendChild(row)}

 return{start,batWait,pitch,sw,hit,res,tick,endHalf,over,peers,modeRow}})();
