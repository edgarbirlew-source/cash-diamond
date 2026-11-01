# Sends a TestFlight build to the "Family testers" group and submits it for beta review.
# Uses the same API key file as the upload step. Prints only ids and status codes, never the key.
# BUILD = the build number to send (defaults to the newest upload).
import os, time, json, urllib.request, jwt
kid, iss = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
APP, GROUP = '6828503020', 'b1580e65-e710-4b00-805f-bfe67d7490d9'
WANT = os.environ.get('BUILD', '').strip()
WHATS_NEW = os.environ.get('WHATS_NEW', 'Clearer message after buying the Full Game. Please test: buy the Full Game, then Restore purchase.')
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

build = None
for i in range(90):  # up to ~45 minutes for Apple to finish processing
    q = f'/v1/builds?filter[app]={APP}&sort=-uploadedDate&limit=10'
    if WANT: q += f'&filter[version]={WANT}'
    s, d = call('GET', q)
    rows = d.get('data', [])
    if rows:
        build = rows[0]; st = build['attributes']['processingState']
        print('build', build['attributes']['version'], build['id'], st)
        if st == 'VALID': break
        if st in ('FAILED', 'INVALID'): raise SystemExit('Apple rejected the build: ' + st)
    else:
        print('build not listed yet', s, errs(d))
    time.sleep(30)
else:
    raise SystemExit('build never finished processing')
bid = build['id']

if build['attributes'].get('usesNonExemptEncryption') is None:
    s, d = call('PATCH', f'/v1/builds/{bid}', {'data': {'type': 'builds', 'id': bid, 'attributes': {'usesNonExemptEncryption': False}}})
    print('encryption answer', s, errs(d))

s, d = call('GET', f'/v1/builds/{bid}/betaBuildLocalizations')
loc = [x for x in d.get('data', []) if x['attributes'].get('locale') == 'en-US']
if loc:
    s, d = call('PATCH', f"/v1/betaBuildLocalizations/{loc[0]['id']}", {'data': {'type': 'betaBuildLocalizations', 'id': loc[0]['id'], 'attributes': {'whatsNew': WHATS_NEW}}})
else:
    s, d = call('POST', '/v1/betaBuildLocalizations', {'data': {'type': 'betaBuildLocalizations', 'attributes': {'locale': 'en-US', 'whatsNew': WHATS_NEW}, 'relationships': {'build': {'data': {'type': 'builds', 'id': bid}}}}})
print('what to test', s, errs(d))

s, d = call('POST', f'/v1/betaGroups/{GROUP}/relationships/builds', {'data': [{'type': 'builds', 'id': bid}]})
print('added to Family testers', s, errs(d))
if s >= 300: raise SystemExit(1)

s, d = call('POST', '/v1/betaAppReviewSubmissions', {'data': {'type': 'betaAppReviewSubmissions', 'relationships': {'build': {'data': {'type': 'builds', 'id': bid}}}}})
print('beta review submit', s, errs(d))
if s >= 300 and s != 409: raise SystemExit(1)
s, d = call('GET', f'/v1/builds/{bid}/buildBetaDetail')
print('beta state', s, d.get('data', {}).get('attributes'))
