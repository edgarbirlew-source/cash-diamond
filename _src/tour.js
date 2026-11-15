/* ---- Tournament: one code for a whole group, a single-elimination bracket, one champion ----
   The server draws the bracket and makes a two-player room for every match. Each phone gets its
   seat in 'tstate' and plays the match as a normal Online Vs Pitch & Bat game (window.VS). */
window.CDT=(()=>{
 const esc=s=>String(s??'').replace(/[<>&"]/g,'');
 const KEY='cd_tour',LIFE=6*3600e3;
 const css=document.createElement('style');css.textContent=`
#tour .onbody{gap:10px}
.tcode{font-family:var(--display);color:var(--cream);font-size:clamp(14px,4.4cqw,19px);text-align:center}
.tcode b{color:var(--sun);font-weight:400;font-size:1.4em;letter-spacing:.12em;text-shadow:0 2px 0 var(--ink)}
.tcard{background:rgba(0,0,0,.3);border:3px solid var(--ink);border-radius:14px;padding:10px 12px;color:var(--cream);font-weight:800;font-size:clamp(13px,4cqw,17px);line-height:1.3;text-align:center}
.tcard h3{margin:0 0 4px;font-family:var(--display);font-weight:400;color:var(--sun);font-size:clamp(16px,5.2cqw,22px);text-shadow:0 2px 0 var(--ink)}
.tcard.live{background:rgba(63,174,90,.35)}
.tcard.champ{background:rgba(255,210,63,.25);font-size:clamp(14px,4.4cqw,18px)}
.tcard .trophy{font-size:clamp(40px,14cqw,60px);line-height:1}
.tplayers{display:flex;flex-wrap:wrap;gap:5px}
.tplayers span{background:var(--cream);color:var(--ink);border:2px solid var(--ink);border-radius:99px;padding:3px 9px 1px;font-family:var(--display);font-size:clamp(11px,3.4cqw,14px)}
.tplayers span.me{background:var(--sun)} .tplayers span.off{opacity:.55}
.tbr{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.tcol{display:flex;flex-direction:column;justify-content:space-around;gap:6px;min-width:84px;flex:1 0 84px}
.tcol>b{font-family:var(--display);font-weight:400;color:var(--sun);font-size:clamp(11px,3.3cqw,13px);text-align:center;text-shadow:0 1px 0 var(--ink)}
.tm{background:var(--cream);color:var(--ink);border:2px solid var(--ink);border-radius:9px;font-weight:800;font-size:clamp(11px,3.3cqw,13px);overflow:hidden}
.tm div{display:flex;justify-content:space-between;gap:3px;padding:2px 5px;white-space:nowrap}
.tm div+div{border-top:1px solid rgba(34,23,15,.25)}
.tm span{overflow:hidden;text-overflow:ellipsis}
.tm .w{background:#bff0c9} .tm .l{opacity:.45;text-decoration:line-through} .tm .me{color:#1d4fa3}
.tm.live{border-color:#1f8a3a;box-shadow:0 0 0 2px #5ee08a}
.tm.mine{box-shadow:0 0 0 2px var(--sun)}
#tBar{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:41;width:min(92vw,420px);box-sizing:border-box;font-size:clamp(14px,4vw,18px)!important}
`;document.head.appendChild(css);

 // the tournament screen, next to the Online Vs screen
 const ov=document.createElement('div');ov.className='overlay';ov.id='tour';ov.hidden=true;
 ov.innerHTML=`<h1 style="font-size:clamp(28px,8vw,40px)">Tournament</h1><div id="tBody" class="onbody"></div><p class="onmsg" id="tMsg"></p><button class="big alt" id="tBack">Back</button>`;
 document.getElementById('park').appendChild(ov);
 const bar=document.createElement('button');bar.className='big';bar.id='tBar';bar.hidden=true;document.body.appendChild(bar);
 const msg=t=>{const m=document.getElementById('tMsg');if(m)m.textContent=t||''};
 const nickNow=()=>{try{return localStorage.getItem('cd_nick')||''}catch(e){return''}};
 const saved=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'null');return o&&Date.now()-o.at<LIFE?o:null}catch(e){return null}};
 const store=o=>{try{o?localStorage.setItem(KEY,JSON.stringify(o)):localStorage.removeItem(KEY)}catch(e){}};

 let curM='',asked={},lastTry='',ws=null,st=null,closed=true,tries=0,pingT=0,pongAt=0,retryT=0,pending='',seatCode='',sess=saved(),leaveArm=0,paid={};
 try{paid=JSON.parse(localStorage.getItem('cd_tour_paid')||'{}')}catch(e){}
 const put=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
 function connect(first){closed=false;if(ws){try{ws.close()}catch(e){}}
  const sock=ws=new WebSocket(CDVS.api.replace(/^http/,'ws')+'/vs');
  sock.onopen=()=>{tries=0;pongAt=Date.now();sock.send(JSON.stringify(first));clearInterval(pingT);
   pingT=setInterval(()=>{if(Date.now()-pongAt>12000){try{sock.close()}catch(e){}return}put({t:'ping'})},4000)};
  sock.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}pongAt=Date.now();
   if(m.t==='tjoined'){sess={code:m.code,token:m.token,at:(sess&&sess.code===m.code&&sess.at)||Date.now()};store(sess);msg('')}
   else if(m.t==='tstate'){st=m;drive();render()}
   else if(m.t==='tgone'){end();msg('That tournament has ended.');render()}
   else if(m.t==='error'){const why={no_tour:'No tournament with that code.',is_room:'That is a 2-player game code. Opening Online Vs…',started:'That tournament already started. Ask for the next one!',full:'That tournament is full (32 players).',few:'You need at least 2 players to start.',slow_down:'Too many tries. Wait a few minutes.'}[m.e]||'Could not join that tournament.';
    msg(why);if(!st){closed=true;sess=null;store(null);try{sock.close()}catch(x){}const t=document.getElementById('tMsg').textContent;render();msg(t)}
    if(m.e==='is_room'){const c=lastTry;setTimeout(()=>{hide();openOnline().then(()=>{const i=document.getElementById('codeIn');if(i){i.value=c;$('jnMatch').click()}})},600)}}};
  sock.onclose=()=>{if(sock!==ws)return;clearInterval(pingT);ws=null;if(closed||!sess)return;
   clearTimeout(retryT);if(++tries>60)return;retryT=setTimeout(()=>{if(!ws&&sess&&!closed)connect({t:'tresume',code:sess.code,token:sess.token})},Math.min(5000,400*tries))}}
 function end(){closed=true;clearInterval(pingT);clearTimeout(retryT);if(ws){try{ws.close()}catch(e){}}ws=null;st=null;sess=null;store(null);bar.hidden=true;seatCode=''}
 // phone call, app switch: check the line as soon as the app is back
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&sess&&!closed&&(!ws||Date.now()-pongAt>6000)){tries=0;connect({t:'tresume',code:sess.code,token:sess.token})}});
 addEventListener('online',()=>{if(sess&&!closed&&!ws){tries=0;connect({t:'tresume',code:sess.code,token:sess.token})}});

 const who=id=>(st&&st.players.find(x=>x.id===id))||{nick:'?'};
 const nm=id=>id?esc(who(id).nick):'';
 const all=()=>st?st.rounds.flat():[];
 const roundName=(r,n)=>r===n-1?'Final':r===n-2?'Semifinals':r===n-3&&n>3?'Quarterfinals':'Round '+(r+1);
 const myMatch=()=>{if(!st)return null;let last=null;for(const m of all())if(m.a===st.me||m.b===st.me)last=m;return last};
 const inVs=()=>G&&G.vs&&G.phase!=='over';

 // keep this phone in step with the bracket: join a new match, end a match the server settled
 function drive(){if(!st)return;const seat=st.seat;
  if(st.state==='done'&&st.champ===st.me&&!paid[st.code]){paid[st.code]=1;try{localStorage.setItem('cd_tour_paid',JSON.stringify(paid))}catch(e){}earn(3000,'Champion!',200,300);fireworks(8)}
  // the server settled the match I'm playing (the other player was away too long, or I was)
  const cm=curM&&all().find(x=>x.id===curM);
  if(cm&&cm.st==='done'&&inVs()&&NET.code===seatCode){curM='';VS.over(cm.w===st.me?'left':'lost')}
  if(seat&&seat.code!==seatCode){
   // the app was closed during this match (its game is gone): start the match over for both players
   const cur=all().find(x=>x.id===seat.m);
   if(!seatCode&&cur&&cur.st==='play'&&!inVs()&&!asked[seat.m]){asked[seat.m]=1;msg('Your game was interrupted. Starting it over…');put({t:'treplay',m:seat.m});
    const c=seat.code;setTimeout(()=>{if(st&&st.seat&&st.seat.code===c&&seatCode!==c)join(st.seat)},5000);return}
   if(G&&G.vs&&G.phase==='over'){seatCode=seat.code;setTimeout(()=>join(seat),4500)} // let the last game's result show first
   else if(inVs()||!$('tour').hidden||!$('title').hidden||!$('online').hidden||(G&&G.phase==='over'))join(seat);
   else showBar(seat);
   return}
  if(!seat&&seatCode){seatCode='';curM='';bar.hidden=true;setTimeout(()=>{if(!seatCode&&!inVs())leaveMatch()},3000)}
  if(!seat)bar.hidden=true}
 function showBar(seat){const m=all().find(x=>x.id===seat.m);
  bar.textContent=`🏆 Your match vs ${who(m&&(m.a===st.me?m.b:m.a)).nick} is ready. Tap to play`;bar.hidden=false;bar.onclick=()=>{bar.hidden=true;join(seat)}}
 async function join(seat){seatCode=seat.code;curM=seat.m;bar.hidden=true;
  // a game still on from the old room (the match is starting over): stop it quietly, no result
  if(inVs()){G.phase='over';P=F=CT=null;CDVS.toast('')}
  CDVS.setTicket({code:seat.code,token:seat.token});NET.gm='ball';
  await netInit();await joinMatch(seat.code,!!seat.host);
  if(!NET.mr||NET.code!==seat.code){seatCode='';return msg('Could not reach your match. Trying again…')}
  NET.mr.presence({ready:true,gm:'ball'}).catch(()=>{})}

 // the result of a finished game goes to the bracket
 function report(you,cpu,left,lost){if(!st||!seatCode)return false;
  if(!lost&&st.seat&&st.seat.code===NET.code)put({t:'tres',m:st.seat.m,me:you,opp:cpu,left:!!left});return true}

 function render(){const box=document.getElementById('tBody');if(!box||ov.hidden)return;
  if(!st){if(sess&&!closed){box.innerHTML='<p class="onnote">Connecting…</p>';return}
   box.innerHTML=`<div class="oncol"><label class="onlab" for="tNick">Your nickname</label><input id="tNick" maxlength="14" placeholder="Type a nickname" value="${esc(nickNow())}"></div>
<div class="oncol"><button class="big gold" id="tMake">🏆 Start a tournament</button><p class="onnote">You get one code for everyone. Anyone with the code can join, up to 32 players. You press Start when everyone is in.</p></div>
<div class="vsor">or join one</div>
<div class="oncol"><div class="vsjoin"><input id="tCode" maxlength="40" placeholder="PASTE CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(pending)}"></div><button class="big" id="tJoin">Join tournament</button></div>`;
   const nk=()=>{const v=$('tNick').value.trim();try{localStorage.setItem('cd_nick',v)}catch(e){}return v};$('tNick').oninput=nk;
   $('tCode').onblur=()=>{const c=CDVS.parse($('tCode').value);if(c)$('tCode').value=c};
   $('tMake').onclick=()=>{if(!nk())return msg('Type a nickname first.'),$('tNick').focus();msg('Making your tournament…');connect({t:'tcreate',nick:nk()})};
   $('tJoin').onclick=()=>{const c=CDVS.parse($('tCode').value);if(!nk())return msg('Type a nickname first.'),$('tNick').focus();
    if(!c)return msg('Codes are 6 letters and numbers.');pending=c;lastTry=c;$('tCode').value=c;msg('Joining…');connect({t:'tjoin',code:c,nick:nk()})};
   if(pending&&nickNow()){const c=pending;pending=c;$('tJoin').click()}else if(pending)$('tNick').value='Guest',nk(),$('tJoin').click();
   pending='';return}
  const me=st.me,org=st.org===me,live=st.players.filter(x=>!x.left);
  let h=`<div class="tcode">Tournament code <b>${esc(st.code)}</b></div>`;
  if(st.state==='lobby'){
   h+=`<div class="vsinv"><button class="big" id="tShare">📤 Share invite link</button><div class="vslink">${esc(link())}</div><button class="big alt" id="tCopy">Copy link</button></div>
<div class="oncol"><div class="onlab">${live.length} player${live.length===1?'':'s'} in</div><div class="tplayers">${live.map(x=>`<span class="${x.id===me?'me':''} ${x.on?'':'off'}">${esc(x.nick)}${x.id===st.org?' ⭐':''}</span>`).join('')}</div></div>`+
    (org?`<button class="big gold" id="tStart" ${live.length<2?'disabled':''}>Start tournament (${live.length})</button><p class="onnote">${live.length<2?'Waiting for players. Send them the link.':'Press Start when everyone is in. Late players can’t join after that.'}</p>`
     :`<p class="onnote">Waiting for ${nm(st.org)} to start the tournament…</p>`)}
  else{h+=card();h+=bracket()}
  h+=`<button class="big alt" id="tLeave">${st.state==='done'?'Close tournament':leaveArm>Date.now()?'Tap again to leave':'Leave tournament'}</button>`;
  box.innerHTML=h;
  const sh=$('tShare');if(sh){const text=`Join my Cash Diamond tournament! Tap the link to sign in. Code: ${st.code}`,url=link();
   const copied=async()=>msg(await CDVS.copy(text+'\n'+url)?'Link copied! Paste it in your group text.':'Copy did not work. Send this link: '+url);
   $('tCopy').onclick=copied;
   sh.onclick=async()=>{const cap=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Share;
    try{if(navigator.share){await navigator.share({title:'Cash Diamond Tournament',text,url});return}
     if(cap){await cap.share({title:'Cash Diamond Tournament',text,url,dialogTitle:'Send the tournament link'});return}}
    catch(e){if(e&&(e.name==='AbortError'||/cancel/i.test(e.message||'')))return}copied()}}
  const go=$('tStart');if(go)go.onclick=()=>{msg('');put({t:'tstart'})};
  const pl=$('tPlay');if(pl)pl.onclick=()=>join(st.seat);
  $('tLeave').onclick=()=>{if(st.state!=='done'&&leaveArm<Date.now()){leaveArm=Date.now()+3000;render();setTimeout(render,3100);return}
   put({t:'tleave'});leaveMatch();end();render()}}

 // "your next match" card
 function card(){const me=st.me,m=myMatch(),n=st.rounds.length;
  if(st.state==='done'){const ch=st.champ===me;
   return `<div class="tcard champ"><div class="trophy">🏆</div><h3>${ch?'YOU ARE THE CHAMPION!':nm(st.champ)+' is the champion!'}</h3>${ch?'Nobody could beat you. +$3,000 champion bonus.':'Great tournament. Start another one any time.'}</div>`}
  if(!m)return `<div class="tcard">The bracket is ready.</div>`;
  const opp=m.a===me?m.b:m.a,rn=roundName(m.r,n);
  if(m.st==='done'&&m.w!==me){const why={noshow:'You didn’t join in time',away:'You were away too long',left:'You left the match'}[m.why]||(m.sc?`${nm(m.w)} won ${Math.max(...m.sc)}–${Math.min(...m.sc)}`:'');
   return `<div class="tcard"><h3>You’re out</h3>${esc(rn)}: ${why}. Watch the bracket to see who wins it all.</div>`}
  if(m.st==='done'&&m.why==='bye')return `<div class="tcard"><h3>Free pass!</h3>You have a bye in ${esc(rn)} and move on. Next up: ${esc(roundName(m.r+1,n))}.</div>`;
  if(m.st==='wait'){const feed=all().filter(x=>x.r===m.r-1&&(x.i>>1)===m.i&&x.w!==me)[0];
   return `<div class="tcard"><h3>You’re in the ${esc(rn)}!</h3>Next: you play ${feed&&feed.a&&feed.b?`the winner of ${nm(feed.a)} vs ${nm(feed.b)}`:'the next winner'}. Stay on this screen and the game starts by itself.</div>`}
  if(m.st==='ready'||m.st==='play'){const playing=inVs()&&st.seat&&NET.code===st.seat.code;
   return `<div class="tcard live"><h3>${esc(rn)}: you vs ${nm(opp)}</h3>${m.st==='ready'?'Getting the game ready… Your friend has 3 minutes to join.':playing?'Game on!':'Starting your game…'}</div>`+
    (m.st==='ready'&&!seatCode?`<button class="big" id="tPlay">Play my match</button>`:'')}
  return ''}
 // the bracket: one column per round, scroll sideways when it's wide
 function bracket(){const n=st.rounds.length,me=st.me;
  return `<div class="tbr">${st.rounds.map((rd,r)=>`<div class="tcol"><b>${esc(roundName(r,n))}</b>${rd.map(m=>{
   const row=id=>{if(!id)return `<div><span>${m.st==='done'&&m.why==='bye'?'bye':'…'}</span></div>`;
    const c=[m.w===id?'w':m.w?'l':'',id===me?'me':''].join(' '),sc=m.sc?m.sc[id===m.a?0:1]:'';
    return `<div class="${c}"><span>${nm(id)}</span><span>${m.w===id&&!m.sc?'✓':sc}</span></div>`};
   return `<div class="tm ${m.st==='play'||m.st==='ready'?'live':''} ${m.a===me||m.b===me?'mine':''}">${row(m.a)}${row(m.b)}</div>`}).join('')}</div>`).join('')}</div>`}

 const link=()=>location.origin+location.pathname+'?t='+(st?st.code:'');
 function show(){if(!$('online').hidden)$('online').hidden=true;$('title').hidden=true;ov.hidden=false;msg('');render();ui()}
 function hide(){ov.hidden=true;ui()}
 // open the tournament screen; with a code, join that tournament
 function open(code){if(code&&(!st||st.code!==String(code).toUpperCase())){if(st||sess)end();pending=String(code).toUpperCase()}
  if(!st&&sess&&closed){closed=false;connect({t:'tresume',code:sess.code,token:sess.token})}
  show()}
 document.getElementById('tBack').onclick=()=>{hide();if(G&&G.vs&&G.phase==='over')toMenu();else showOverlay('Cash Diamond','Pick a mode. Win games to move up the leagues.',false)};

 // title screen button
 const tb=document.createElement('button');tb.className='big';tb.id='tourBtn';tb.textContent='🏆 Tournament';tb.style.cssText='flex:1 1 100%;background:#3fae5a;color:#fff;text-shadow:0 2px 0 var(--ink)';
 const modes=document.getElementById('modes');if(modes)modes.insertBefore(tb,document.getElementById('installBtn'));tb.onclick=async()=>{await leaveMatch();open()};

 // opened from a shared link (?t=CODE), or the app was closed during a tournament: go right back in
 try{const q=new URLSearchParams(location.search),c=CDVS.parse('VS='+(q.get('t')||''));
  if(c){q.delete('t');history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
   if(sess&&sess.code===c)addEventListener('load',()=>setTimeout(()=>open(),300));
   else{sess=null;store(null);addEventListener('load',()=>setTimeout(()=>open(c),300))}}
  else if(sess)addEventListener('load',()=>setTimeout(()=>open(),300))}catch(e){}

 return{open,show,hide,report,active:()=>!!st,state:()=>st}})();
