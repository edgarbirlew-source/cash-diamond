# App Review resubmission for Cash Diamond 1.1.0. Mode = first word of ios/REVIEW:
#   status  - print the public half of the API key (for encrypting the review video) and the review state
#   submit  - decrypt ios/review-video.enc, attach it to the review details, update the notes,
#             put build BUILD on version 1.1.0 and resubmit the review submission.
# The video is encrypted to the API key, so the public repo never holds it in readable form.
import os, sys, time, json, hashlib, urllib.request, jwt
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
kid, iss = os.environ['ASC_KEY_ID'], os.environ['ASC_ISSUER_ID']
APP, VERSION, SUBMISSION = '6828503020', 'e0552bc2-7513-42ee-8439-77a789a2a840', '858e9c28-f804-4ab6-9f2c-563dfb20e74c'
words = open('ios/REVIEW').readline().split('#')[0].split()
mode, BUILD = words[0], (words[1] if len(words) > 1 else '13')
pem = open(os.path.expanduser(f'~/private_keys/AuthKey_{kid}.p8')).read()
priv = serialization.load_pem_private_key(pem.encode(), None)
def call(method, path, body=None, raw=False):
    tok = jwt.encode({'iss': iss, 'iat': int(time.time()), 'exp': int(time.time()) + 900, 'aud': 'appstoreconnect-v1'}, pem, algorithm='ES256', headers={'kid': kid})
    url = path if path.startswith('http') else 'https://api.appstoreconnect.apple.com' + path
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            b = r.read(); return r.status, json.loads(b) if b else {}
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, {'errors': [{'detail': b[:300].decode(errors='replace')}]}
def errs(d): return [(e.get('code'), e.get('detail')) for e in d.get('errors', [])]

s, d = call('GET', f'/v1/appStoreVersions/{VERSION}?include=build,appStoreReviewDetail')
v = d.get('data', {})
print('version', s, v.get('attributes', {}).get('versionString'), v.get('attributes', {}).get('appStoreState') or v.get('attributes', {}).get('appVersionState'))
inc = {x['type']: x for x in d.get('included', [])}
print('current build', inc.get('builds', {}).get('attributes', {}).get('version'))
detail = inc.get('appStoreReviewDetails', {})
did = detail.get('id')
print('review detail', did)
s, d = call('GET', f'/v1/reviewSubmissions/{SUBMISSION}?include=items')
print('submission', s, d.get('data', {}).get('attributes', {}).get('state'), errs(d))
for it in d.get('included', []):
    print('  item', it['id'], it['attributes'].get('state'), list((it.get('relationships') or {}).keys()))

if mode == 'status':
    pub = priv.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    print('PUBKEY'); print(pub)
    sys.exit(0)

# --- submit ---
blob = open('ios/review-video.enc', 'rb').read()
epk = serialization.load_der_public_key(blob[:91]); nonce = blob[91:103]
shared = priv.exchange(ec.ECDH(), epk)
k = HKDF(hashes.SHA256(), 32, None, b'cash-diamond-review-video').derive(shared)
video = AESGCM(k).decrypt(nonce, blob[103:], None)
print('video bytes', len(video))
name = 'cash-diamond-review-recording.mp4'
# remove old attachments with the same name, then reserve and upload
s, d = call('GET', f'/v1/appStoreReviewDetails/{did}/appStoreReviewAttachments')
for a in d.get('data', []):
    if a['attributes'].get('fileName') == name:
        print('delete old attachment', call('DELETE', f"/v1/appStoreReviewAttachments/{a['id']}")[0])
s, d = call('POST', '/v1/appStoreReviewAttachments', {'data': {'type': 'appStoreReviewAttachments',
    'attributes': {'fileName': name, 'fileSize': len(video)},
    'relationships': {'appStoreReviewDetail': {'data': {'type': 'appStoreReviewDetails', 'id': did}}}}})
print('reserve attachment', s, errs(d))
if s >= 300: sys.exit(1)
att = d['data']
for op in att['attributes']['uploadOperations']:
    chunk = video[op['offset']:op['offset'] + op['length']]
    req = urllib.request.Request(op['url'], method=op['method'], data=chunk,
        headers={h['name']: h['value'] for h in op.get('requestHeaders', [])})
    with urllib.request.urlopen(req) as r: pass
print('uploaded parts', len(att['attributes']['uploadOperations']))
s, d = call('PATCH', f"/v1/appStoreReviewAttachments/{att['id']}", {'data': {'type': 'appStoreReviewAttachments', 'id': att['id'],
    'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(video).hexdigest()}}})
print('commit attachment', s, errs(d), d.get('data', {}).get('attributes', {}).get('assetDeliveryState'))
if s >= 300: sys.exit(1)

notes = open('ios/review-notes.txt').read().strip()
s, d = call('PATCH', f'/v1/appStoreReviewDetails/{did}', {'data': {'type': 'appStoreReviewDetails', 'id': did, 'attributes': {'notes': notes}}})
print('notes', s, errs(d))

s, d = call('GET', f'/v1/builds?filter[app]={APP}&filter[version]={BUILD}')
bid = d['data'][0]['id']
s, d = call('PATCH', f'/v1/appStoreVersions/{VERSION}/relationships/build', {'data': {'type': 'builds', 'id': bid}})
print('build', BUILD, 'on version', s, errs(d))
if s >= 300: sys.exit(1)

s, d = call('PATCH', f'/v1/reviewSubmissions/{SUBMISSION}', {'data': {'type': 'reviewSubmissions', 'id': SUBMISSION, 'attributes': {'submitted': True}}})
print('resubmit', s, errs(d), d.get('data', {}).get('attributes', {}).get('state'))
if s >= 300: sys.exit(1)
