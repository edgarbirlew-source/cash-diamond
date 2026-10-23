#!/usr/bin/env python3
"""Turn the single-file Cash Diamond artifact into an installable web app in dist/."""
import re, sys, pathlib

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'v21.html').read_text()
VERSION = sys.argv[2] if len(sys.argv) > 2 else 'v21'
CLAUDE_LINK = 'https://claude.ai/artifact/KiT4WVL5SpJTVN3nCQtmyg'

first, rest = src.split('\n', 1)
assert first.startswith('<!doctype html>') and first.endswith('<body>'), 'unexpected skeleton line'
reset = re.search(r'<style>.*?</style>', first).group(0)

head = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Cash Diamond Baseball</title>
<meta name="description" content="Cartoon baseball where every hit earns cash. Play Ball, HR Derby and Pitch Challenge.">
<meta name="theme-color" content="#1d4fa3">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cash Diamond">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{reset}</head><body>'''

# Online Vs uses Claude's live rooms, which only exist on the Claude link.
old_msg = "Online play needs you signed in to Claude, and the game shared with the person you want to play. Open it from the Claude app and try again."
assert old_msg in rest
rest = rest.replace(old_msg,
  f"Online Vs runs on the Claude version of the game for now. <a href=\\'{CLAUDE_LINK}\\' style=\\'color:#ffd23f\\'>Open it there</a> to play a friend.")

# Online Vs in the web app: private rooms on our own server (Railway "vs"), Copy/Share code.
CD_VS = 'https://vs-production-b01d.up.railway.app'
here = pathlib.Path(__file__).parent
VS_PATCHES = [
  ("NET.room=window.claude&&window.claude.use?await window.claude.use('room'):null",
   "NET.room=window.CDVS?CDVS.room():window.claude&&window.claude.use?await window.claude.use('room'):null"),
  ("NET.code=code.toUpperCase();", "NET.code=(NET.mr.code||code).toUpperCase();"),
  ("catch(e){onlineMsg('Could not join that match. Check the code and try again.');return}",
   "catch(e){onlineMsg(e&&e.cdMsg||'Could not join that match. Check the code and try again.');return}"),
  ("if(!NET.mr){\n  const lobby=", "if(!NET.mr&&window.CDVS)return CDVS.lobby(box);\n if(!NET.mr){\n  const lobby="),
  ("box.appendChild(w);\n const row=", "box.appendChild(w);if(window.CDVS)CDVS.shareRow(w);if(window.VS)VS.modeRow(w);\n const row="),
  # live Pitch & Bat game between two phones (VS in vs.js)
  ("const go={seed:Math.random()*1e9|0,n:Date.now()}", "const go={seed:Math.random()*1e9|0,n:Date.now(),gm:NET.gm||'ball'}"),
  ("startOnlineCountdown(hostP.presence.go.seed)", "startOnlineCountdown(hostP.presence.go.seed,hostP.presence.go.gm)"),
  ("function startOnlineCountdown(seed){", "function startOnlineCountdown(seed,gm){if(gm==='ball'&&window.VS)return VS.start(seed);"),
  ("NET.opp=opp?opp.presence:null;", "NET.opp=opp?opp.presence:null;if(window.VS)VS.peers(opp);"),
  ("function onlineResult(){if(!G.online", "function onlineResult(){if(G.vs||!G.online"),
  ("function planCpuPitch(){", "function planCpuPitch(){if(G.vs)return VS.batWait();"),
  ("tx:ax+rnd(-sc,sc),ty:ay+rnd(-sc,sc),mine:true};", "tx:ax+rnd(-sc,sc),ty:ay+rnd(-sc,sc),mine:true};if(G.vs)VS.pitch(G.pend);"),
  ("if(!G.top){const inZ=inZone(P.final);", "if(!G.top&&!G.vs){const inZ=inZone(P.final);"),
  ("contact(d.q,d.pw,d.aim);return}", "contact(d.q,d.pw,d.aim);if(G.vs&&G.top)VS.hit();return}"),
  ("if(t>=1.12&&!P.hit&&!P.pend&&!isPC())takeResult()}", "if(t>=1.12&&!P.hit&&!P.pend&&!isPC()&&!(G.vs&&!G.top)){takeResult();if(G.vs)VS.res()}}"),
  ("G.phase='settle';if(G.top)batResult();else defResult()}", "G.phase='settle';if(G.top){batResult();if(G.vs)VS.res()}else if(!G.vs)defResult()}"),
  ("if(isPC()){pcUpdate(now,dtU);return}\n", "if(isPC()){pcUpdate(now,dtU);return}if(G.vs)VS.tick(now);\n"),
  ("P.swung=true;const b0=bat()", "P.swung=true;if(G.vs)VS.sw();const b0=bat()"),
  ("function endHalf(){\n", "function endHalf(){if(G.vs)return VS.endHalf();\n"),
  ("function gameOver(){const win=", "function gameOver(){if(G.vs)return VS.over();const win="),
  ("${G.top?'TOP':'BOT'} ${G.inning}", "${(G.vs?G.vs.half%2===0:G.top)?'TOP':'BOT'} ${G.inning}"),
  ("${L.abbr} ${G.cpu}", "${G.vs?G.vs.opp.toUpperCase():L.abbr} ${G.cpu}"),
  ("$('oppAbbr').textContent=L.abbr;", "$('oppAbbr').textContent=G.vs?G.vs.opp.slice(0,4).toUpperCase():L.abbr;"),
  ("(G.top?'▲':'▼')+G.inning", "((G.vs?G.vs.half%2===0:G.top)?'▲':'▼')+G.inning"),
  ("$('msg').innerHTML=cb?(G.top?", "$('msg').innerHTML=cb&&G.vs?(G.top?'Your turn to bat · hold, slide, release':'Pitching to <b>'+G.vs.opp.replace(/[<>&]/g,'')+'</b> · pick a pitch, tap the zone'):cb?(G.top?"),
  ("der?(G.online?'Online Derby':'HR Derby'):L.tier", "der?(G.online?'Online Derby':'HR Derby'):G.vs?'Online Game':L.tier"),
]
for a, b in VS_PATCHES:
  assert rest.count(a) == 1, 'vs patch anchor not found once: ' + a[:50]
  rest = rest.replace(a, b)
vs = (here / 'vs.js').read_text().replace('__CD_VS__', CD_VS)
assert rest.count('</body></html>') == 1
rest = rest.replace('</body></html>', '<script>\n' + vs + '</script>\n</body></html>')

app_js = f'''
<script>
/* ---- installable app: offline cache + install button ---- */
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{{}}));
(()=>{{let ev=null;const b=document.createElement('button');b.className='big alt';b.id='installBtn';b.textContent='Install App';b.hidden=true;b.style.flex='1 1 100%';
 const m=document.getElementById('modes');if(m)m.appendChild(b);
 addEventListener('beforeinstallprompt',e=>{{e.preventDefault();ev=e;b.hidden=false}});
 b.onclick=async()=>{{if(!ev)return;ev.prompt();try{{await ev.userChoice}}catch(e){{}}ev=null;b.hidden=true}};
 addEventListener('appinstalled',()=>{{b.hidden=true}});}})();
</script>
'''
# Full Game: free tier, inning-break card and the $3.99 Stripe unlock (web app only).
CD_API = 'https://unlock-production-90f0.up.railway.app'
CD_PAY = ''  # the BIRCO Stripe Payment Link (https://buy.stripe.com/...); empty = "opens soon"
PATCHES = [
  ("b.onclick=()=>{S.cur=i;save();buildField(LV());ui()};lv.appendChild(b)});",
   "b.onclick=()=>{S.cur=i;save();buildField(LV());ui()};if(window.CD)CD.dress('lg',i,b);lv.appendChild(b)});"),
  ("b.onclick=()=>{$('title').hidden=true;newDerby({dlv:i})};box.appendChild(b)}}",
   "b.onclick=()=>{$('title').hidden=true;newDerby({dlv:i})};if(window.CD)CD.dress('dv',i,b);box.appendChild(b)}}"),
  ("b.onclick=()=>{$('title').hidden=true;newPitchStage(i)};box.appendChild(b)}}",
   "b.onclick=()=>{$('title').hidden=true;newPitchStage(i)};if(window.CD)CD.dress('pc',i,b);box.appendChild(b)}}"),
  ("function newGame(){", "function newGame(){if(window.CD&&CD.stop('lg',S.cur))return;"),
  ("function newDerby(opts){opts=opts||{};", "function newDerby(opts){opts=opts||{};if(window.CD&&!opts.online&&CD.stop('dv',opts.dlv??0))return;"),
  ("function newPitchStage(si){", "function newPitchStage(si){if(window.CD&&CD.stop('pc',si))return;"),
  ("if(S.cur>=S.unlocked&&S.unlocked<LEVELS.length-1){",
   "if(window.CD&&S.cur>=S.unlocked&&CD.wall('lg',S.unlocked+1))CD.beat('lg');else if(S.cur>=S.unlocked&&S.unlocked<LEVELS.length-1){"),
  ("G.you!==G.cpu){gameOver();return}\n G.phase='switch';banner('SIDE RETIRED'",
   "G.you!==G.cpu){gameOver();return}\n if(window.CD&&G.mode==='game'&&!G.online&&!G.top&&G.inning===1&&!G.cdB){G.cdB=1;const gb=G;if(CD.brk(()=>{paused=false;if(G===gb)endHalf()})){G.phase='switch';return}}G.phase='switch';banner('SIDE RETIRED'"),
]
for a, b in PATCHES:
  assert rest.count(a) == 1, 'patch anchor not found once: ' + a[:50]
  rest = rest.replace(a, b)
fg = (here / 'fullgame.js').read_text().replace('__CD_API__', CD_API).replace('__CD_PAY__', CD_PAY)
anchor = '<script>\n// ================= catalog'
assert rest.count(anchor) == 1
rest = rest.replace(anchor, '<script>\n' + fg + '</script>\n' + anchor)

assert rest.rstrip().endswith('</body></html>')
rest = rest.rstrip()[:-len('</body></html>')] + app_js + '</body></html>\n'

out = pathlib.Path('dist'); out.mkdir(exist_ok=True)
(out / 'index.html').write_text(head + '\n' + rest)
sw = (here / 'sw.template.js').read_text().replace('__VERSION__', VERSION)
(out / 'sw.js').write_text(sw)
print('built', VERSION, len(head + rest), 'bytes')
