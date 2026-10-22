# Cash Diamond Baseball

Installable web app (PWA) build of Cash Diamond, a cartoon baseball game by BIRCO, Inc.

- `index.html` is the game (one file), plus `manifest.webmanifest`, `sw.js` (offline) and `icons/`.
- To ship a new game version: save the new artifact HTML, run `python3 _src/build.py <file.html> <version>` from a work folder, copy `dist/` here, commit and push.
