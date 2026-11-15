# Checks the App Store Connect API key the iOS workflow uses: prints only status codes and counts, never the key.
import os, time, json, urllib.request, jwt
kid, iss = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
key = open(os.path.expanduser(f'~/private_keys/AuthKey_{kid}.p8')).read()
tok = jwt.encode({'iss': iss, 'iat': int(time.time()), 'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'}, key, algorithm='ES256', headers={'kid': kid})
def get(path):
    req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, headers={'Authorization': 'Bearer ' + tok})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
s, d = get('/v1/bundleIds?filter[identifier]=com.birco.cashdiamond')
print('bundleIds', s, len(d.get('data', [])), [e.get('detail') for e in d.get('errors', [])])
s, d = get('/v1/certificates?limit=50')
print('certificates', s, [c['attributes']['certificateType'] for c in d.get('data', [])], [e.get('detail') for e in d.get('errors', [])])
# If the configured id is refused, try the other BIRCO key ids (and the individual-key form) with the same private key.
if s == 401:
    for k in ['96C8CK9U3H', '5AN3H63V83', 'T58UR4UUGD', '7UX222VH8F']:
        for form in ('team', 'individual'):
            claims = {'iat': int(time.time()), 'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'}
            claims.update({'iss': iss} if form == 'team' else {'sub': 'user'})
            tok = jwt.encode(claims, key, algorithm='ES256', headers={'kid': k})
            print('try', k, form, get('/v1/bundleIds?limit=1')[0])
