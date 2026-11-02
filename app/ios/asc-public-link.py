# Turns on the TestFlight invite link for the Family testers group, capped at LIMIT people
# (first line of ios/PUBLIC_LINK; 0 turns the link off), and prints the link.
import os, time, json, urllib.request, jwt
kid, iss = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
GROUP = 'b1580e65-e710-4b00-805f-bfe67d7490d9'
limit = int(''.join(c for c in open('ios/PUBLIC_LINK').readline() if c.isdigit()) or 0)
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
attrs = {'publicLinkEnabled': limit > 0}
if limit > 0: attrs.update({'publicLinkLimitEnabled': True, 'publicLinkLimit': limit})
s, d = call('PATCH', f'/v1/betaGroups/{GROUP}', {'data': {'type': 'betaGroups', 'id': GROUP, 'attributes': attrs}})
print('update', s, [e.get('detail') for e in d.get('errors', [])])
a = d.get('data', {}).get('attributes', {})
print('enabled', a.get('publicLinkEnabled'), 'limit', a.get('publicLinkLimit'))
print('LINK', a.get('publicLink'))
if s >= 300: raise SystemExit(1)
