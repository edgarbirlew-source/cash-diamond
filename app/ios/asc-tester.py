# Re-sends TestFlight invites for the Family testers group. Testers are matched by the sha256 of their
# lowercased email (listed in ios/TESTERS) so no email address goes into this public repo or its logs.
# Prints only masked emails, ids and states.
import os, time, json, hashlib, urllib.request, jwt
kid, iss = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
APP, GROUP = '6828503020', 'b1580e65-e710-4b00-805f-bfe67d7490d9'
want = {l.split('#')[0].strip() for l in open('ios/TESTERS') if l.split('#')[0].strip()}
key = open(os.path.expanduser(f'~/private_keys/AuthKey_{kid}.p8')).read()
def call(method, path, body=None):
    tok = jwt.encode({'iss': iss, 'iat': int(time.time()), 'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'}, key, algorithm='ES256', headers={'kid': kid})
    req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read(); return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read(); return e.code, json.loads(raw) if raw else {}
def errs(d): return [e.get('detail') for e in d.get('errors', [])]
def mask(e): u, _, dom = (e or '').partition('@'); return u[:1] + '***@' + dom
s, d = call('GET', f'/v1/betaTesters?filter[apps]={APP}&limit=200&fields[betaTesters]=email,inviteType,state&include=betaGroups')
print('testers', s, errs(d))
found = set()
for t in d.get('data', []):
    e = (t['attributes'].get('email') or '').strip().lower()
    h = hashlib.sha256(e.encode()).hexdigest()
    groups = [g['id'] for g in t.get('relationships', {}).get('betaGroups', {}).get('data', [])]
    print(' ', mask(e), t['id'], t['attributes'].get('inviteType'), t['attributes'].get('state'), 'in Family testers' if GROUP in groups else 'NOT in group')
    if h in want:
        found.add(h)
        if GROUP not in groups:
            s2, d2 = call('POST', f'/v1/betaGroups/{GROUP}/relationships/betaTesters', {'data': [{'type': 'betaTesters', 'id': t['id']}]})
            print('    added to group', s2, errs(d2))
        s2, d2 = call('POST', '/v1/betaTesterInvitations', {'data': {'type': 'betaTesterInvitations', 'relationships': {
            'app': {'data': {'type': 'apps', 'id': APP}}, 'betaTester': {'data': {'type': 'betaTesters', 'id': t['id']}}}}})
        print('    invite re-sent', s2, errs(d2))
missing = want - found
print('not on the app at all:', len(missing))
s, d = call('GET', f'/v1/betaGroups/{GROUP}')
a = d.get('data', {}).get('attributes', {})
print('group public link enabled:', a.get('publicLinkEnabled'), 'limit', a.get('publicLinkLimit'))
