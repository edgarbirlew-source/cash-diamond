#!/usr/bin/env bash
# CI-05 static checks (no browser). Prints PASS/FAIL per item; exit 1 if any FAIL.
# Does NOT replace the full Playwright suite (owner rule 2026-11-19 9:33 AM).
# Usage: bash _src/static-check.sh   (from repo root)
cd "$(dirname "$0")/.." || exit 2
fail=0; tmp=$(mktemp -d)
ok(){ echo "PASS $1"; }; bad(){ echo "FAIL $1"; fail=1; }
for f in _src/*.js _src/*.mjs sw.js app/src/*.js; do
  [ -f "$f" ] || continue
  if node --check "$f" 2>"$tmp/err"; then ok "node --check $f"; else bad "node --check $f: $(head -3 "$tmp/err" | tr '\n' ' ')"; fi
done
inline(){ # $1 html file, $2 label
  python3 - "$1" "$tmp" "$2" <<'PY'
import re,sys,pathlib
src=pathlib.Path(sys.argv[1]).read_text()
for i,m in enumerate(re.finditer(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>',src,re.S)):
  if 'json' in m.group(1) or 'importmap' in m.group(1): continue
  ext='.mjs' if 'module' in m.group(1) else '.js'
  pathlib.Path(sys.argv[2],f"{sys.argv[3]}-{i}{ext}").write_text(m.group(2))
PY
  for s in "$tmp/$2"-*; do [ -f "$s" ] || continue
    if node --check "$s" 2>"$tmp/err"; then ok "inline $(basename "$s") ($1)"; else bad "inline $(basename "$s") ($1): $(head -3 "$tmp/err" | tr '\n' ' ')"; fi
  done
}
for h in _src/v21.html index.html privacy.html; do [ -f "$h" ] && inline "$h" "$(basename "$h" .html)"; done
mkdir "$tmp/r"; tar --exclude=.git -cf - . | tar -xf - -C "$tmp/r"; ln -s "$tmp/r/_src" "$tmp/b"
for mode in web store; do
  flag=""; [ $mode = store ] && flag="--store"
  if (cd "$tmp/b" && python3 build.py $flag >"$tmp/build-$mode.log" 2>&1); then ok "build.py $mode"; else bad "build.py $mode: $(tail -3 "$tmp/build-$mode.log" | tr '\n' ' ')"; fi
done
for d in dist dist-store; do
  [ -d "$tmp/b/$d" ] || continue
  for h in "$tmp/b/$d"/*.html; do [ -f "$h" ] && inline "$h" "$d-$(basename "$h" .html)"; done
  for j in "$tmp/b/$d"/*.js; do [ -f "$j" ] || continue
    if node --check "$j" 2>"$tmp/err"; then ok "node --check $d/$(basename "$j")"; else bad "node --check $d/$(basename "$j")"; fi
  done
done
rm -rf "$tmp"; [ $fail = 0 ] && echo "ALL STATIC CHECKS PASS" || echo "STATIC CHECKS FAILED"; exit $fail
