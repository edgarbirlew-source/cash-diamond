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
assert rest.rstrip().endswith('</body></html>')
rest = rest.rstrip()[:-len('</body></html>')] + app_js + '</body></html>\n'

out = pathlib.Path('dist'); out.mkdir(exist_ok=True)
(out / 'index.html').write_text(head + '\n' + rest)
sw = pathlib.Path('sw.template.js').read_text().replace('__VERSION__', VERSION)
(out / 'sw.js').write_text(sw)
print('built', VERSION, len(head + rest), 'bytes')
