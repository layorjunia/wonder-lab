#!/usr/bin/env python3
"""Cheap proof that the live site is the build on disk. Downloads ~4 MB, not 55 MB.

    python3 tools/verify_live.py [base-url]

Compares the app code (index.html, sw.js, every js/*.js and css/*.css) byte for byte
with the local files, and HEADs a few photos. The full lesson-playing bot is run
LOCALLY (node tools/ui_shot.mjs .work/qa/selftest.json against the dev server);
running it against the Vercel URL downloads the whole ~55 MB site on every run,
which counts against the free plan's data transfer.
"""
import glob
import hashlib
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://wonder-lab-ecru.vercel.app').rstrip('/') + '/'
os.chdir(ROOT)
files = ['index.html', 'sw.js', 'manifest.json', 'version.json'] + sorted(glob.glob('js/*.js')) + sorted(glob.glob('css/*.css'))
bad, total = [], 0
for f in files:
    try:
        req = urllib.request.Request(BASE + f, headers={'Cache-Control': 'no-cache'})
        body = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        bad.append((f, str(e)[:50])); continue
    total += len(body)
    if hashlib.sha1(body).digest() != hashlib.sha1(open(f, 'rb').read()).digest():
        bad.append((f, 'differs from local'))
photos = sorted(glob.glob('img/*.jpg'))[:3]
for p in photos:
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + p, method='HEAD'), timeout=30)
        if r.status != 200:
            bad.append((p, f'HTTP {r.status}'))
    except Exception as e:
        bad.append((p, str(e)[:50]))
print(f'{BASE}: {len(files)} app files compared ({total / 1e6:.1f} MB downloaded), {len(photos)} photos checked, {len(bad)} problem(s)')
for b in bad[:10]:
    print('   ', b)
sys.exit(1 if bad else 0)
