/* BIRCO shared cross-promotion module (one copy for every BIRCO game).
 *
 * Live config:  https://raw.githubusercontent.com/edgarbirlew-source/cash-diamond/gh-pages/birco/crosspromo.json
 * This module:  https://edgarbirlew-source.github.io/cash-diamond/birco/crosspromo.js
 * Edit the JSON once and every game shows the change on its next launch. Each game also bundles a copy of
 * the JSON as a fallback for offline play.
 *
 * Use:
 *   BIRCO.promo.init({ game: 'cashdiamond', fallback: {...bundled json...}, isFull: () => false, kids: false })
 *   BIRCO.promo.open()          // "More from BIRCO" sheet (menu / game-over screens only, never during play)
 *   BIRCO.promo.onceAfterGame() // at most ONE full-screen promo per session, never for Full Game owners
 *   BIRCO.promo.tiles()         // the tiles this player would see
 *
 * Rules built in: only apps live in this phone's store; this game's own tile hidden; Play link on Android,
 * App Store link on iPhone; every link tagged utm_source=<game>&utm_campaign=crosspromo; kids mode shows
 * kidsSafe tiles only and no external links.
 */
(function () {
  var URL_LIVE = 'https://raw.githubusercontent.com/edgarbirlew-source/cash-diamond/gh-pages/birco/crosspromo.json';
  var CACHE = 'birco_promo_cfg', SEEN = 'birco_promo_once';
  var o = { game: 'game', kids: false, isFull: function () { return false }, fallback: null, platform: null, onOpen: null, onClose: null };
  var cfg = null, sheet = null;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null } }
  function platform() {
    if (o.platform) return o.platform;
    try { if (window.Capacitor && Capacitor.getPlatform) { var p = Capacitor.getPlatform(); if (p === 'android' || p === 'ios') return p } } catch (e) {}
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    return 'web';
  }
  function native() { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) } catch (e) { return false } }
  function valid(c) { return c && Array.isArray(c.apps) }

  function tag(url, kind) {
    if (!url) return '';
    var src = encodeURIComponent(o.game), q = 'utm_source=' + src + '&utm_campaign=crosspromo';
    if (kind === 'play') { // Play passes the referrer string to the installed app (Install Referrer API)
      return url + (url.indexOf('?') < 0 ? '?' : '&') + 'referrer=' + encodeURIComponent(q);
    }
    if (kind === 'appstore') q += '&ct=' + src + '-crosspromo'; // App Store Connect campaign token
    return url + (url.indexOf('?') < 0 ? '?' : '&') + q;
  }

  function tiles() {
    var c = cfg || o.fallback || { apps: [] }, p = platform(), out = [];
    (c.apps || []).forEach(function (a) {
      if (!a || a.id === o.game) return;                       // hide this game's own tile
      if (o.kids && !a.kidsSafe) return;
      if (a.soon) { if (a.show === true) out.push({ id: a.id, name: a.name, pitch: a.pitch || 'Coming soon', icon: a.icon || '', age: a.age || '', btn: '', url: '' }); return } // coming-soon tile: no button, no link, only when show is true
      var live = a.live || {}, url = '', kind = '';
      if (p === 'ios') { if (live.appstore && a.appstore) { url = a.appstore; kind = 'appstore' } }
      else if (p === 'android') { if (live.play && a.play) { url = a.play; kind = 'play' } }
      else if (live.play && a.play) { url = a.play; kind = 'play' } // desktop / web: Google Play page
      if (!url) return;                                           // show only apps live in this store
      out.push({ id: a.id, name: a.name, pitch: a.pitch || '', icon: a.icon || '', age: a.age || '', btn: 'Get it', url: o.kids ? '' : tag(url, kind) });
    });
    var r = c.recon;
    if (r && (r.latest || r.channel) && (!o.kids || r.kidsSafe)) {
      out.push({ id: 'recon', name: r.name || 'Watch Recon', pitch: r.pitch || '', icon: r.icon || '', btn: 'Watch', url: o.kids ? '' : tag(r.latest || r.channel, 'video') });
    }
    return out.slice(0, 6);
  }

  function go(url) {
    if (!url) return;
    if (native()) { location.href = url; return } // Capacitor hands store / YouTube links to the phone's own app
    var w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
  }

  function css() {
    if (document.getElementById('bircoPromoCss')) return;
    var s = document.createElement('style'); s.id = 'bircoPromoCss';
    s.textContent = '.bpSheet{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,20,50,.82)}' +
      '.bpCard{width:100%;max-width:380px;max-height:100%;overflow-y:auto;box-sizing:border-box;background:#fff6d6;color:#1b1b2f;border:4px solid #1b1b2f;border-radius:20px;box-shadow:0 7px 0 #1b1b2f;padding:16px;display:flex;flex-direction:column;gap:10px;font:700 15px/1.25 system-ui,sans-serif;text-align:center}' +
      '.bpCard h2{margin:0;font-size:26px;line-height:1.1;color:#1d4fa3}' +
      '.bpRow{display:flex;align-items:center;gap:10px;text-align:left;background:#fff;border:3px solid #1b1b2f;border-radius:14px;padding:8px}' +
      '.bpIco{flex:none;width:48px;height:48px;border-radius:12px;object-fit:cover;background:#1d4fa3;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px}' +
      '.bpTxt{flex:1;min-width:0}.bpTxt b{display:block;font-size:16px}.bpTxt small{display:block;font-weight:600;color:#55516a;font-size:13px}' +
      '.bpBtn{flex:none;border:3px solid #1b1b2f;border-radius:12px;background:#5ee08a;color:#1b1b2f;font:800 15px system-ui,sans-serif;padding:8px 12px;cursor:pointer}' +
      '.bpX{border:3px solid #1b1b2f;border-radius:14px;background:#ffd23f;color:#1b1b2f;font:800 17px system-ui,sans-serif;padding:10px;cursor:pointer}' +
      '.bpNote{color:#55516a;font-size:14px}.bpLink{background:none;border:0;color:#2c6fb5;text-decoration:underline;font:600 13px system-ui,sans-serif;cursor:pointer}';
    document.head.appendChild(s);
  }
  function esc(t) { return String(t || '').replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';' }) }

  function close() { if (sheet) { sheet.remove(); sheet = null; if (o.onClose) o.onClose() } }
  function open(head, extra) {
    css(); if (sheet) sheet.remove();
    var list = tiles();
    var rows = list.map(function (t, i) {
      var ico = t.icon ? '<img class="bpIco" alt="" src="' + esc(t.icon) + '">' : '<span class="bpIco">' + esc((t.name || '?')[0]) + '</span>';
      return '<div class="bpRow">' + ico + '<div class="bpTxt"><b>' + esc(t.name) + '</b><small>' + esc(t.pitch) + '</small></div>' +
        (t.url ? '<button class="bpBtn" data-i="' + i + '">' + esc(t.btn) + '</button>' : '') + '</div>';
    }).join('');
    sheet = document.createElement('div'); sheet.className = 'bpSheet';
    sheet.innerHTML = '<div class="bpCard"><h2>' + esc(head || 'More from BIRCO') + '</h2>' +
      (rows || '<p class="bpNote">More BIRCO games are on the way. Check back soon!</p>') +
      (o.kids && rows ? '<p class="bpNote">Ask a grown-up to find these in the app store.</p>' : '') +
      (extra || '') + '<button class="bpX" data-x>Back</button></div>';
    sheet.addEventListener('pointerdown', function (e) { e.stopPropagation() });
    sheet.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i],[data-x]'); if (!b) return;
      if (b.hasAttribute('data-x')) return close();
      go(list[+b.getAttribute('data-i')].url);
    });
    document.body.appendChild(sheet);
    if (o.onOpen) o.onOpen();
    return sheet;
  }

  // At most one full-screen promo per app session, never for players who bought the Full Game.
  function onceAfterGame() {
    var s; try { s = sessionStorage.getItem(SEEN) } catch (e) {}
    if (s || o.isFull() || !tiles().length || sheet) return false;
    try { sessionStorage.setItem(SEEN, '1') } catch (e) {}
    open('Try another BIRCO game'); return true;
  }

  function init(opts) {
    for (var k in opts) o[k] = opts[k];
    try { var c = JSON.parse(store(CACHE) || 'null'); if (valid(c)) cfg = c } catch (e) {}
    try {
      fetch(o.url || URL_LIVE, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null }).then(function (c) {
        if (valid(c)) { cfg = c; store(CACHE, JSON.stringify(c)) }
      }).catch(function () {});
    } catch (e) {}
    return api;
  }

  var api = { init: init, open: open, close: close, tiles: tiles, onceAfterGame: onceAfterGame, isOpen: function () { return !!sheet }, _tag: tag, _platform: platform };
  window.BIRCO = window.BIRCO || {}; window.BIRCO.promo = api;
})();
