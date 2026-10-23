// Cash Diamond unlock service (Railway Function, Bun).
// GET /verify?session=cs_...  -> asks Stripe if that checkout was paid, returns an unlock code
// GET /redeem?code=CD-...     -> checks an unlock code typed on another phone
// Env: STRIPE_KEY (restricted key, Checkout Sessions: read), UNLOCK_SECRET (random), PRICE_CENTS (default 399)
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ORIGINS = ['https://edgarbirlew-source.github.io', 'http://localhost:8099'];
const enc = new TextEncoder();

async function hmac(msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(Bun.env.UNLOCK_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const chars = (b: Uint8Array, n: number) => Array.from(b.slice(0, n), x => ALPHA[x % ALPHA.length]).join('');
async function sign(body: string) { return chars(await hmac('cd1:' + body), 6) }
async function codeFor(session: string) {
  const body = chars(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(session))), 6);
  const sig = await sign(body);
  return `CD-${body.slice(0, 4)}-${body.slice(4)}${sig.slice(0, 2)}-${sig.slice(2)}`;
}
async function checkCode(raw: string) {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^CD/, '');
  if (c.length !== 12) return false;
  return (await sign(c.slice(0, 6))) === c.slice(6);
}

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 600000);
  list.push(now); hits.set(ip, list);
  return list.length > 30;
}

Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  async fetch(req, server) {
    const url = new URL(req.url), origin = req.headers.get('origin') || '';
    const cors: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store' };
    if (ORIGINS.includes(origin)) cors['access-control-allow-origin'] = origin;
    const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const ip = req.headers.get('x-real-ip') || server.requestIP(req)?.address || '?';

    if (url.pathname === '/health') return reply({ ok: true, ready: !!(Bun.env.STRIPE_KEY && Bun.env.UNLOCK_SECRET) });

    if (url.pathname === '/verify') {
      const id = url.searchParams.get('session') || '';
      if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return reply({ ok: false, error: 'bad_session' }, 400);
      if (!Bun.env.STRIPE_KEY || !Bun.env.UNLOCK_SECRET) return reply({ ok: false, error: 'not_ready' }, 503);
      if (limited(ip)) return reply({ ok: false, error: 'slow_down' }, 429);
      let r: Response;
      try { r = await fetch((Bun.env.STRIPE_API || 'https://api.stripe.com') + '/v1/checkout/sessions/' + id, { headers: { authorization: 'Bearer ' + Bun.env.STRIPE_KEY } }) }
      catch (e) { console.log('stripe unreachable', String(e)); return reply({ ok: false, error: 'stripe' }, 502) }
      if (r.status === 404) return reply({ ok: false, error: 'not_found' }, 404);
      if (!r.ok) { console.log('stripe error', r.status, await r.text()); return reply({ ok: false, error: 'stripe' }, 502) }
      const s = await r.json() as { payment_status?: string; status?: string; amount_total?: number };
      const paid = s.status === 'complete' && s.payment_status === 'paid' && (s.amount_total ?? 0) >= Number(Bun.env.PRICE_CENTS || 399);
      if (!paid) return reply({ ok: false, error: 'not_paid' }, 402);
      return reply({ ok: true, code: await codeFor(id) });
    }

    if (url.pathname === '/redeem') {
      if (!Bun.env.UNLOCK_SECRET) return reply({ ok: false, error: 'not_ready' }, 503);
      if (limited(ip)) return reply({ ok: false, error: 'slow_down' }, 429);
      return reply({ ok: await checkCode(url.searchParams.get('code') || '') });
    }
    return reply({ ok: false, error: 'not_found' }, 404);
  },
});
