#!/usr/bin/env python3
"""Mint/refresh the Ad Hoc provisioning profile for Wonder Lab.

Uses the App Store Connect API key (~/.appstoreconnect/private_keys/AuthKey_<KEY>.p8,
team Illuminate Drones, LLC); no Xcode account is needed, so the build signs manually.
Registers the explicit bundle ID com.illuminatedrones.wonderlab the first time.
The profile is rewritten, not patched, so a newly added iPad is picked up; rebuild and
republish after adding one. Pattern copied from Lamplight (Bible App, iOS/scripts/
adhoc_profile.py), itself copied from the Piano App — see ~/.claude/CLAUDE.md.

  python3 scripts/adhoc_profile.py
  python3 scripts/adhoc_profile.py --add-device "New iPad" 00008030-XXXXXXXXXXXX
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives import hashes, serialization

KID = 'L58U29F65J'
ISS = '77719da1-93f7-438f-8bc5-796eefc91031'
KEY_PATH = f'/Users/jacob/.appstoreconnect/private_keys/AuthKey_{KID}.p8'
BUNDLE = 'com.illuminatedrones.wonderlab'
BUNDLE_NAME = 'Wonder Lab'
PROFILE = 'Wonder Lab AdHoc'
API = 'https://api.appstoreconnect.apple.com'


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def token():
    header = {'alg': 'ES256', 'kid': KID, 'typ': 'JWT'}
    payload = {'iss': ISS, 'iat': int(time.time()), 'exp': int(time.time()) + 1200,
               'aud': 'appstoreconnect-v1'}
    signing_input = (b64url(json.dumps(header).encode())
                      + '.' + b64url(json.dumps(payload).encode()))
    key = serialization.load_pem_private_key(open(KEY_PATH, 'rb').read(), password=None)
    der_sig = key.sign(signing_input.encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_sig)
    raw_sig = r.to_bytes(32, 'big') + s.to_bytes(32, 'big')
    return signing_input + '.' + b64url(raw_sig)


def api(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                  headers={'Authorization': 'Bearer ' + token(),
                                           'Content-Type': 'application/json'},
                                  data=json.dumps(body).encode() if body else None)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()) if r.status != 204 else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f'{method} {path} -> {e.code}: {e.read().decode()[:500]}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--add-device', nargs=2, metavar=('NAME', 'UDID'))
    args = ap.parse_args()

    if args.add_device:
        name, udid = args.add_device
        print(f'registering device {name} ({udid})')
        api('POST', '/v1/devices', {'data': {'type': 'devices', 'attributes': {
            'name': name, 'platform': 'IOS', 'udid': udid}}})

    certs = api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION')['data']
    if not certs:
        raise SystemExit('no Distribution certificate in App Store Connect — '
                         'create one in Certificates, Identifiers & Profiles first')
    cert_id = certs[0]['id']
    print(f'using certificate {certs[0]["attributes"]["displayName"]} ({cert_id})')

    bundles = api('GET', f'/v1/bundleIds?filter[identifier]={BUNDLE}')['data']
    if bundles:
        bundle_rec_id = bundles[0]['id']
        print(f'bundle id {BUNDLE} already registered ({bundle_rec_id})')
    else:
        created = api('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {
            'identifier': BUNDLE, 'name': BUNDLE_NAME, 'platform': 'IOS'}}})
        bundle_rec_id = created['data']['id']
        print(f'registered bundle id {BUNDLE} ({bundle_rec_id})')

    devices = api('GET', '/v1/devices?filter[status]=ENABLED&limit=200')['data']
    device_ids = [d['id'] for d in devices if d['attributes']['platform'] == 'IOS']
    names = ', '.join(d['attributes']['name'] for d in devices
                      if d['attributes']['platform'] == 'IOS')
    print(f'{len(device_ids)} enabled iOS device(s): {names}')

    existing = api('GET', f'/v1/profiles?filter[name]={PROFILE.replace(" ", "%20")}')['data']
    for p in existing:
        print(f'deleting existing profile {p["id"]}')
        api('DELETE', f'/v1/profiles/{p["id"]}')

    created = api('POST', '/v1/profiles', {'data': {
        'type': 'profiles',
        'attributes': {'name': PROFILE, 'profileType': 'IOS_APP_ADHOC'},
        'relationships': {
            'bundleId': {'data': {'type': 'bundleIds', 'id': bundle_rec_id}},
            'certificates': {'data': [{'type': 'certificates', 'id': cert_id}]},
            'devices': {'data': [{'type': 'devices', 'id': d} for d in device_ids]},
        }}})
    content = created['data']['attributes']['profileContent']
    raw = base64.b64decode(content)

    # Decode just to read the UUID for the filename and a sanity echo — the
    # the file xcodebuild actually reads is matched by its embedded Name/UUID,
    # not by filename, but a stable path makes debugging easier.
    plist = subprocess.run(['security', 'cms', '-D', '-i', '/dev/stdin'],
                           input=raw, capture_output=True)
    import plistlib
    info = plistlib.loads(plist.stdout)
    uuid = info['UUID']
    out = f'/Users/jacob/Library/MobileDevice/Provisioning Profiles/{uuid}.mobileprovision'
    with open(out, 'wb') as f:
        f.write(raw)
    print(f'wrote {out}')
    print(f'profile "{PROFILE}" covers {len(info.get("ProvisionedDevices", []))} device(s), '
         f'expires {info["ExpirationDate"]}')


if __name__ == '__main__':
    main()
