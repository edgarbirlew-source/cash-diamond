// Cash Diamond Online Vs rooms (Railway Function, Bun). Invite-only: a room exists only after
// a player creates it, holds two players, and is reached by its 6-character code. No chat,
// no lobby, nothing written to disk. Presence is a small JSON object relayed to the other player.
// WS /vs   client sends {t:'create'|'join'|'resume'|'presence'|'msg'|'leave'|'ping', ...}
// Tournaments: one invite code for a whole group. The organizer starts it, the server draws a
// single-elimination bracket (byes for odd counts) and opens a normal two-player room for every
// match, with both seats already made. Each player gets their seat in 'tstate' and joins it with 'resume'.
// WS /vs   client sends {t:'tcreate'|'tjoin'|'tresume'|'tstart'|'tres'|'treplay'|'tleave', ...}
// 'msg' carries game moves (pitch, swing, result) to the other player: numbers, true/false and short
// lowercase codes only, so nothing typed by a player can pass through.
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// store apps: Android serves the game from https://edgarbirlew-source.github.io (capacitor.config server.hostname),
// iOS from capacitor://edgarbirlew-source.github.io
const ORIGINS = ['https://edgarbirlew-source.github.io', 'capacitor://edgarbirlew-source.github.io', 'http://localhost:8099'];
const GRACE = 15 * 60_000;    // a dropped player keeps their seat this long (long enough for a phone call)
const ROOM_MAX = 3 * 3600_000; // rooms close after 3 hours no matter what

type Peer = { id: string; token: string; p: Record<string, unknown>; ws: any; timer?: Timer; inbox: unknown[] };
type Room = { code: string; peers: Map<string, Peer>; born: number; timer?: Timer; tour?: string; mid?: string };
const rooms = new Map<string, Room>();

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => ALPHA[x % ALPHA.length]).join('');
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
const send = (ws: any, o: unknown) => { try { ws?.send(JSON.stringify(o)) } catch (e) { } };

const CODE = /^[a-z_]{1,12}$/;
// a game move: nested objects/arrays (depth 3), finite numbers, booleans, null, lowercase codes
function move(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') return CODE.test(v) ? v : null;
  if (depth >= 3 || typeof v !== 'object') return null;
  if (Array.isArray(v)) return v.slice(0, 12).map(x => move(x, depth + 1));
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 24)) if (k.length <= 12) o[k] = move(x, depth + 1);
  return o;
}
function clean(p: unknown) {
  const o: Record<string, unknown> = {};
  if (!p || typeof p !== 'object') return o;
  for (const [k, v] of Object.entries(p as Record<string, unknown>).slice(0, 16)) {
    if (k.length > 12) continue;
    if (k === 'nick') o.nick = String(v ?? '').replace(/[<>&"]/g, '').slice(0, 14);
    else if (v === null || typeof v === 'boolean' || typeof v === 'number') o[k] = v;
    else if (typeof v === 'string' && CODE.test(v)) o[k] = v;
    else if (k === 'go' && typeof v === 'object') o.go = { seed: Number((v as any).seed) | 0, n: Number((v as any).n) || 0, gm: CODE.test(String((v as any).gm)) ? (v as any).gm : 'derby' };
  }
  return o;
}
function broadcast(r: Room) {
  const list = [...r.peers.values()].map(x => ({ id: x.id, online: !!x.ws, p: x.p }));
  for (const x of r.peers.values()) send(x.ws, { t: 'peers', me: x.id, peers: list });
}
function drop(r: Room, id: string) {
  const x = r.peers.get(id); if (!x) return;
  clearTimeout(x.timer); r.peers.delete(id);
  if (!r.peers.size) { clearTimeout(r.timer); rooms.delete(r.code) } else broadcast(r);
}
function seat(r: Room, ws: any, nick: unknown) {
  const x: Peer = { id: rand(8), token: tok(), p: clean({ nick }), ws, inbox: [] };
  r.peers.set(x.id, x); ws.data.room = r.code; ws.data.id = x.id;
  send(ws, { t: 'joined', code: r.code, me: x.id, token: x.token });
  broadcast(r);
}

// ---------------- tournaments ----------------
const T_MAX = 32;               // players in one tournament
const T_LIFE = 6 * 3600_000;    // a tournament closes after 6 hours
const JOIN_WAIT = Number(Bun.env.T_JOIN_MS) || 3 * 60_000;   // a player who doesn't show up for a match this long loses it
const AWAY_WAIT = Number(Bun.env.T_AWAY_MS) || 5 * 60_000;   // a player away from a match (dropped, app in the background) this long loses it
const REPORT_WAIT = Number(Bun.env.T_REPORT_MS) || 20_000;     // one phone reported the final score: wait this long for the other
type TP = { id: string; token: string; nick: string; ws: any; left: boolean; out: boolean };
type Rep = { me: number; opp: number; left: boolean };
type TM = { id: string; r: number; i: number; a: string | null; b: string | null; w: string | null; st: 'wait' | 'ready' | 'play' | 'done';
  room: string; seats: Record<string, { pid: string; token: string }>; at: number; off: Record<string, number>; rep: Record<string, Rep>; repAt: number;
  why: string; sc: number[] | null; replays: number };
type Tour = { code: string; org: string; ps: Map<string, TP>; state: 'lobby' | 'live' | 'done'; rounds: TM[][]; champ: string | null; born: number };
const tours = new Map<string, Tour>();
const newCode = () => { let c = rand(6); while (rooms.has(c) || tours.has(c)) c = rand(6); return c };
const nickOf = (v: unknown) => String(v ?? '').replace(/[<>&"]/g, '').trim().slice(0, 14) || 'Player';
// bracket order for a power-of-two field: seed 1 meets the lowest seed, and byes never meet each other
function order(n: number): number[] { let o = [1]; while (o.length < n) { const m = o.length * 2; o = o.flatMap(x => [x, m + 1 - x]) } return o }
function tview(t: Tour, pid: string) {
  const seat = (() => { for (const rd of t.rounds) for (const m of rd) if ((m.st === 'ready' || m.st === 'play') && m.seats[pid]) return { m: m.id, code: m.room, token: m.seats[pid].token, host: m.a === pid }; return null })();
  return { t: 'tstate', code: t.code, me: pid, org: t.org, state: t.state, champ: t.champ, seat,
    players: [...t.ps.values()].map(x => ({ id: x.id, nick: x.nick, on: !!x.ws, out: x.out, left: x.left })),
    rounds: t.rounds.map(rd => rd.map(m => ({ id: m.id, r: m.r, i: m.i, a: m.a, b: m.b, w: m.w, st: m.st, why: m.why, sc: m.sc }))) };
}
function tcast(t: Tour) { for (const x of t.ps.values()) send(x.ws, tview(t, x.id)) }
function tseat(t: Tour, ws: any, nick: unknown) {
  const x: TP = { id: rand(8), token: tok(), nick: nickOf(nick), ws, left: false, out: false };
  t.ps.set(x.id, x); ws.data.tour = t.code; ws.data.tid = x.id;
  send(ws, { t: 'tjoined', code: t.code, me: x.id, token: x.token });
  tcast(t);
}
function tend(t: Tour) { for (const rd of t.rounds) for (const m of rd) closeRoom(m.room); tours.delete(t.code) }
function closeRoom(code: string) {
  const r = rooms.get(code); if (!r) return;
  setTimeout(() => { if (rooms.get(code) !== r) return; clearTimeout(r.timer); for (const x of r.peers.values()) { clearTimeout(x.timer); if (x.ws) x.ws.data.room = '' } rooms.delete(code) }, 60_000);
}
// both players are known: open their room, or settle it at once if one of them already left
function tready(t: Tour, m: TM) {
  const A = t.ps.get(m.a!), B = t.ps.get(m.b!);
  if (A?.left || B?.left) return tresolve(t, m, A?.left ? m.b! : m.a!, 'left', null);
  if (m.room) closeRoom(m.room);
  const code = newCode(), room: Room = { code, peers: new Map(), born: Date.now(), tour: t.code, mid: m.id };
  room.timer = setTimeout(() => rooms.delete(code), ROOM_MAX);
  m.seats = {};
  for (const pid of [m.a!, m.b!]) {
    const x: Peer = { id: rand(8), token: tok(), p: clean({ nick: t.ps.get(pid)!.nick }), ws: null, inbox: [] };
    room.peers.set(x.id, x); m.seats[pid] = { pid: x.id, token: x.token };
  }
  rooms.set(code, room);
  Object.assign(m, { room: code, st: 'ready', at: Date.now(), off: {}, rep: {}, repAt: 0 });
}
function tresolve(t: Tour, m: TM, w: string, why: string, sc: number[] | null) {
  if (m.st === 'done') return;
  m.w = w; m.st = 'done'; m.why = why; m.sc = sc;
  const l = m.a === w ? m.b : m.a; if (l) t.ps.get(l)!.out = true;
  if (m.room) closeRoom(m.room);
  if (m.r === t.rounds.length - 1) { t.champ = w; t.state = 'done'; setTimeout(() => tours.get(t.code) === t && tend(t), 3600_000) }
  else {
    const n = t.rounds[m.r + 1][m.i >> 1];
    if (m.i % 2) n.b = w; else n.a = w;
    if (n.a && n.b && n.st === 'wait') tready(t, n);
  }
  tcast(t);
}
function tstart(t: Tour) {
  const list = [...t.ps.values()].filter(x => !x.left);
  for (let i = list.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);[list[i], list[j]] = [list[j], list[i]] }
  let size = 2; while (size < list.length) size *= 2;
  const o = order(size), mk = (r: number, i: number): TM => ({ id: 'r' + r + 'm' + i, r, i, a: null, b: null, w: null, st: 'wait', room: '', seats: {}, at: 0, off: {}, rep: {}, repAt: 0, why: '', sc: null, replays: 0 });
  t.rounds = [];
  for (let r = 0, n = size / 2; n >= 1; r++, n /= 2) t.rounds.push(Array.from({ length: n }, (_, i) => mk(r, i)));
  t.state = 'live';
  t.rounds[0].forEach((m, i) => { m.a = list[o[2 * i] - 1]?.id ?? null; m.b = list[o[2 * i + 1] - 1]?.id ?? null });
  for (const m of t.rounds[0]) if (!m.b) tresolve(t, m, m.a!, 'bye', null);
  for (const m of t.rounds[0]) if (m.st === 'wait' && m.a && m.b) tready(t, m);
  tcast(t);
}
// final score from one phone: each phone is the judge of the runs it scored while batting
function treport(t: Tour, m: TM, pid: string, rp: Rep) {
  if (m.st === 'done' || !m.seats[pid]) return;
  m.rep[pid] = rp; if (!m.repAt) m.repAt = Date.now();
  const other = pid === m.a ? m.b! : m.a!, ro = m.rep[other];
  if (ro) {
    const ra = m.rep[m.a!].me, rb = m.rep[m.b!].me;
    const w = ra !== rb ? (ra > rb ? m.a! : m.b!) : rp.left ? pid : ro.left ? other : m.a!;
    return tresolve(t, m, w, 'score', [ra, rb]);
  }
  const peer = rooms.get(m.room)?.peers.get(m.seats[other].pid);
  if (rp.left || !peer?.ws) return tresolve(t, m, rp.left || rp.me > rp.opp ? pid : other, rp.left ? 'left' : 'score', pid === m.a ? [rp.me, rp.opp] : [rp.opp, rp.me]);
}
// every few seconds: no-shows, players away too long, a missing second score
setInterval(() => {
  const now = Date.now();
  for (const t of tours.values()) {
    if (now - t.born > T_LIFE) { for (const x of t.ps.values()) send(x.ws, { t: 'tgone' }); tend(t); continue }
    if (t.state !== 'live') continue;
    for (const rd of t.rounds) for (const m of rd) {
      if (m.st !== 'ready' && m.st !== 'play') continue;
      const room = rooms.get(m.room), on = (pid: string) => { const x = room?.peers.get(m.seats[pid].pid); return !!x?.ws && !x.p.bg };
      const a = m.a!, b = m.b!;
      if (m.repAt) { if (now - m.repAt > REPORT_WAIT) { const pid = m.rep[a] ? a : b, rp = m.rep[pid]; tresolve(t, m, rp.left || rp.me > rp.opp ? pid : pid === a ? b : a, 'score', pid === a ? [rp.me, rp.opp] : [rp.opp, rp.me]) } continue }
      if (m.st === 'ready') {
        if (on(a) && on(b)) { m.st = 'play'; m.off = {}; tcast(t); continue }
        if (now - m.at > JOIN_WAIT) {
          const w = on(a) ? a : on(b) ? b : t.ps.get(b)!.ws && !t.ps.get(a)!.ws ? b : a;
          tresolve(t, m, w, 'noshow', null);
        }
        continue;
      }
      for (const pid of [a, b]) { if (on(pid)) delete m.off[pid]; else m.off[pid] ??= now }
      const late = [a, b].filter(pid => m.off[pid] && now - m.off[pid] > AWAY_WAIT);
      if (late.length) tresolve(t, m, late.length === 2 ? (m.off[a] <= m.off[b] ? b : a) : late[0] === a ? b : a, 'away', null);
    }
  }
}, Number(Bun.env.T_TICK_MS) || 5000);

const hits = new Map<string, number[]>();
function limited(ip: string, max: number) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 600_000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  fetch(req, server) {
    const url = new URL(req.url), origin = req.headers.get('origin') || '';
    if (url.pathname === '/health') return Response.json({ ok: true, rooms: rooms.size, tours: tours.size });
    if (url.pathname === '/vs') {
      if (!ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
      const ip = req.headers.get('x-real-ip') || server.requestIP(req)?.address || '?';
      if (server.upgrade(req, { data: { ip, room: '', id: '', tour: '', tid: '' } })) return;
      return new Response('upgrade required', { status: 426 });
    }
    return new Response('not found', { status: 404 });
  },
  websocket: {
    idleTimeout: 60,
    maxPayloadLength: 2048,
    message(ws: any, raw) {
      let m: any; try { m = JSON.parse(String(raw)) } catch (e) { return }
      const d = ws.data, r = d.room ? rooms.get(d.room) : undefined, me = r?.peers.get(d.id);
      const tr = d.tour ? tours.get(d.tour) : undefined, tp = tr?.ps.get(d.tid);
      switch (m?.t) {
        case 'ping': return send(ws, { t: 'pong' });
        case 'create': {
          if (r) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          const code = newCode();
          const room: Room = { code, peers: new Map(), born: Date.now() };
          room.timer = setTimeout(() => { for (const x of room.peers.values()) send(x.ws, { t: 'gone' }); rooms.delete(code) }, ROOM_MAX);
          rooms.set(code, room); return seat(room, ws, m.nick);
        }
        case 'join': {
          if (r) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          const room = rooms.get(String(m.code || '').toUpperCase());
          if (!room) return send(ws, { t: 'error', e: tours.has(String(m.code || '').toUpperCase()) ? 'is_tour' : 'no_room' });
          if (room.tour) return send(ws, { t: 'error', e: 'full' });
          if (room.peers.size >= 2) return send(ws, { t: 'error', e: 'full' });
          return seat(room, ws, m.nick);
        }
        case 'resume': {
          const room = rooms.get(String(m.code || '').toUpperCase());
          const x = room && [...room.peers.values()].find(y => y.token === m.token);
          if (!room || !x) return send(ws, { t: 'gone' });
          clearTimeout(x.timer); x.timer = undefined;
          if (x.ws && x.ws !== ws) { x.ws.data.room = ''; try { x.ws.close() } catch (e) { } }
          x.ws = ws; d.room = room.code; d.id = x.id;
          send(ws, { t: 'joined', code: room.code, me: x.id, token: x.token, resumed: true });
          for (const d of x.inbox.splice(0)) send(ws, d);
          return broadcast(room);
        }
        case 'presence': {
          if (!r || !me) return;
          Object.assign(me.p, clean(m.p));
          if (JSON.stringify(me.p).length > 1024) me.p = clean({ nick: me.p.nick });
          return broadcast(r);
        }
        case 'msg': {
          if (!r || !me) return;
          const d = { t: 'msg', d: move(m.d) };
          for (const x of r.peers.values()) if (x !== me) { if (x.ws) send(x.ws, d); else if (x.inbox.length < 200) x.inbox.push(d) }
          return;
        }
        case 'leave': {
          // leaving a tournament match before it is decided gives it to the other player
          const t = r?.tour ? tours.get(r.tour) : undefined, mt = t?.rounds.flat().find(x => x.room === r!.code);
          if (t && mt && (mt.st === 'ready' || mt.st === 'play') && !mt.repAt) {
            const pid = Object.keys(mt.seats).find(k => mt.seats[k].pid === d.id);
            if (pid) tresolve(t, mt, pid === mt.a ? mt.b! : mt.a!, 'left', null);
          }
          if (r) drop(r, d.id);
          d.room = ''; return;
        }
        case 'tcreate': {
          if (tr) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          const t: Tour = { code: newCode(), org: '', ps: new Map(), state: 'lobby', rounds: [], champ: null, born: Date.now() };
          tours.set(t.code, t); tseat(t, ws, m.nick); t.org = d.tid; return tcast(t);
        }
        case 'tjoin': {
          if (tr) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          const t = tours.get(String(m.code || '').toUpperCase());
          if (!t) return send(ws, { t: 'error', e: rooms.has(String(m.code || '').toUpperCase()) ? 'is_room' : 'no_tour' });
          if (t.state !== 'lobby') return send(ws, { t: 'error', e: 'started' });
          if ([...t.ps.values()].filter(x => !x.left).length >= T_MAX) return send(ws, { t: 'error', e: 'full' });
          return tseat(t, ws, m.nick);
        }
        case 'tresume': {
          const t = tours.get(String(m.code || '').toUpperCase()), x = t && [...t.ps.values()].find(y => y.token === m.token);
          if (!t || !x || x.left) return send(ws, { t: 'tgone' });
          if (x.ws && x.ws !== ws) { x.ws.data.tour = ''; try { x.ws.close() } catch (e) { } }
          x.ws = ws; d.tour = t.code; d.tid = x.id;
          send(ws, { t: 'tjoined', code: t.code, me: x.id, token: x.token, resumed: true });
          return tcast(t);
        }
        case 'tstart': {
          if (!tr || !tp || tr.org !== tp.id || tr.state !== 'lobby') return;
          if ([...tr.ps.values()].filter(x => !x.left).length < 2) return send(ws, { t: 'error', e: 'few' });
          return tstart(tr);
        }
        case 'tres': {
          const mt = tr?.rounds.flat().find(x => x.id === m.m);
          if (!tr || !tp || !mt) return;
          const n = (v: unknown) => Math.max(0, Math.min(99, Number(v) | 0));
          return treport(tr, mt, tp.id, { me: n(m.me), opp: n(m.opp), left: m.left === true });
        }
        case 'treplay': {
          // a phone lost its game (the app was closed): both players start that match over in a new room
          const mt = tr?.rounds.flat().find(x => x.id === m.m);
          if (!tr || !tp || !mt || mt.st !== 'play' || !mt.seats[tp.id] || mt.repAt || mt.replays >= 3) return;
          mt.replays++; tready(tr, mt); return tcast(tr);
        }
        case 'tleave': {
          if (!tr || !tp) return;
          d.tour = '';
          if (tr.state === 'lobby') {
            tr.ps.delete(tp.id);
            if (!tr.ps.size) { tours.delete(tr.code); return }
            if (tr.org === tp.id) tr.org = tr.ps.keys().next().value!;
            return tcast(tr);
          }
          tp.left = true; tp.ws = null;
          for (const mt of tr.rounds.flat()) if (mt.st !== 'done' && (mt.a === tp.id || mt.b === tp.id) && mt.a && mt.b) tresolve(tr, mt, mt.a === tp.id ? mt.b : mt.a, 'left', null);
          return tcast(tr);
        }
      }
    },
    close(ws: any) {
      const td = ws.data, tt = td.tour ? tours.get(td.tour) : undefined, tx = tt?.ps.get(td.tid);
      if (tt && tx && tx.ws === ws) { tx.ws = null; tcast(tt) }
      const d = ws.data, r = d.room ? rooms.get(d.room) : undefined, x = r?.peers.get(d.id);
      if (!r || !x || x.ws !== ws) return;
      x.ws = null; broadcast(r);
      x.timer = setTimeout(() => drop(r, x.id), GRACE);
    },
  },
});
console.log('cash diamond vs rooms up');
