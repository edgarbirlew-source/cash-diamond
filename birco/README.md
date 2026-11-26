# BIRCO shared cross-promotion (every BIRCO game)

- `crosspromo.json`: the ONE list of BIRCO games and the latest Recon the Raccoon episode. Store links, `live` per store, age rating, `kidsSafe`.
- `crosspromo.js`: the module every game loads. It shows the "More from BIRCO" sheet and applies the rules:
  only apps live in this phone's store, this game's own tile hidden, Play link on Android / App Store link on iPhone,
  every link tagged `utm_source=<game>&utm_campaign=crosspromo` (Play: inside `referrer=`), kids mode = kidsSafe tiles with no links,
  at most one full-screen promo per session and none for Full Game owners.

Live URLs (published from the `gh-pages` branch):
- config: https://raw.githubusercontent.com/edgarbirlew-source/cash-diamond/gh-pages/birco/crosspromo.json (the module reads this; CORS-safe inside store apps)
- module: https://edgarbirlew-source.github.io/cash-diamond/birco/crosspromo.js

To change what every game shows: edit `crosspromo.json` here, merge, copy it to `gh-pages/birco/`. Games pick it up on next launch
and keep a cached copy; each game also bundles a copy as the offline fallback.

Adopting it in another game:
```html
<script src="https://edgarbirlew-source.github.io/cash-diamond/birco/crosspromo.js"></script>  <!-- or inline a copy for offline -->
<script>
BIRCO.promo.init({ game: 'knockoutzoo', fallback: {/* bundled crosspromo.json */}, isFull: () => ownsFullGame(), kids: false });
// menu button and game-over screen only:
moreButton.onclick = () => BIRCO.promo.open();
</script>
```
Rewarded ads + Full Game for Capacitor games: copy `app/src/native.js` (the `CDN.ads` part), `app/ads.config.json` and
`app/ads-apply.mjs` from Cash Diamond. All AdMob ids sit in `ads.config.json`; kids games set `childDirected: true`.

Coming-soon tile (staging): an `apps` entry with `"soon": true` shows a tile with no button and no link, only when `"show": true`. `recongames` ships with `show: false`, so nothing changes until it is flipped on. Its `video` block (enabled, src, poster, seconds, learnMore) is reserved for a future video tile; the module ignores it today. Stores that bundle an older module copy need a new build to show a `soon` tile.

Windows (Microsoft Store build): call `init({ platform: 'windows', ... })`. Windows shows only apps with `live.microsoft: true` and a `microsoft` link, never Google Play links. Add `microsoft` and `live.microsoft` to an app only once it is live in the Microsoft Store.
