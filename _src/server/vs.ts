// Cash Diamond Online Vs rooms (Railway Function, Bun). Invite-only: a room exists only after
// a player creates it, holds two players, and is reached by its 6-character code. No chat,
// no lobby, nothing written to disk. Presence is a small JSON object relayed to the other player.
// WS /vs   client sends {t:'create'|'join'|'resume'|'presence'|'leave'|'ping', ...}
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ORIGINS = ['https://edgarbirlew-source.github.io', 'http://localhost:8099'];
const GRACE = 120_000;        // a dropped player keeps their seat this long
const ROOM_MAX = 3 * 3600_000; // rooms close after 3 hours no matter what

type Peer = { id: string; token: string; p: Record<string, unknown>; ws: any; timer?: Timer };
type Room = { code: string; peers: Map<string, Peer>; born: number; timer?: Timer };
const rooms = new Map<string, Room>();

const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => ALPHA[x % ALPHA.length]).join('');
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
const send = (ws: any, o: unknown) => { try { ws?.send(JSON.stringify(o)) } catch (e) { } };

function clean(p: unknown) {
  const o: Record<string, unknown> = {};
  if (!p || typeof p !== 'object') return o;
  for (const [k, v] of Object.entries(p as Record<string, unknown>).slice(0, 16)) {
    if (k.length > 12) continue;
    if (k === 'nick') o.nick = String(v ?? '').replace(/[<>&"]/g, '').slice(0, 14);
    else if (v === null || typeof v === 'boolean' || typeof v === 'number') o[k] = v;
    else if (k === 'go' && typeof v === 'object') o.go = { seed: Number((v as any).seed) | 0, n: Number((v as any).n) || 0 };
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
  const x: Peer = { id: rand(8), token: tok(), p: clean({ nick }), ws };
  r.peers.set(x.id, x); ws.data.room = r.code; ws.data.id = x.id;
  send(ws, { t: 'joined', code: r.code, me: x.id, token: x.token });
  broadcast(r);
}

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
    if (url.pathname === '/health') return Response.json({ ok: true, rooms: rooms.size });
    if (url.pathname === '/vs') {
      if (!ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
      const ip = req.headers.get('x-real-ip') || server.requestIP(req)?.address || '?';
      if (server.upgrade(req, { data: { ip, room: '', id: '' } })) return;
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
      switch (m?.t) {
        case 'ping': return send(ws, { t: 'pong' });
        case 'create': {
          if (r) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          let code = rand(6); while (rooms.has(code)) code = rand(6);
          const room: Room = { code, peers: new Map(), born: Date.now() };
          room.timer = setTimeout(() => { for (const x of room.peers.values()) send(x.ws, { t: 'gone' }); rooms.delete(code) }, ROOM_MAX);
          rooms.set(code, room); return seat(room, ws, m.nick);
        }
        case 'join': {
          if (r) return;
          if (limited(d.ip, 40)) return send(ws, { t: 'error', e: 'slow_down' });
          const room = rooms.get(String(m.code || '').toUpperCase());
          if (!room) return send(ws, { t: 'error', e: 'no_room' });
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
          return broadcast(room);
        }
        case 'presence': {
          if (!r || !me) return;
          Object.assign(me.p, clean(m.p));
          if (JSON.stringify(me.p).length > 1024) me.p = clean({ nick: me.p.nick });
          return broadcast(r);
        }
        case 'leave': {
          if (r) drop(r, d.id);
          d.room = ''; return;
        }
      }
    },
    close(ws: any) {
      const d = ws.data, r = d.room ? rooms.get(d.room) : undefined, x = r?.peers.get(d.id);
      if (!r || !x || x.ws !== ws) return;
      x.ws = null; broadcast(r);
      x.timer = setTimeout(() => drop(r, x.id), GRACE);
    },
  },
});
console.log('cash diamond vs rooms up');
