#!/usr/bin/env python3
"""Stage several photo candidates per plant so a human can pick.

Automated picking failed twice here. Filename heuristics chose a Van Dyck
self-portrait for sunflower (the man is holding one), an Andean ulluco tuber
for truffle, a banana-fibre textile mill for banana, and a pressed herbarium
sheet for oak. Filtering those out then promoted a Romanian banknote for poppy
and a world map for fig.

The lesson is the same one the dinosaur restorations taught: a licence gate is
not a quality gate, and a filename does not tell you what is in the picture.
Stage the options, look at them, choose.

  python3 tools/stage_plant_photos.py id [id ...]
"""
import json
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK

sys.path.insert(0, os.path.join(ROOT, 'tools'))
from fetch_photos import (acceptable, commons_candidates, file_meta,   # noqa: E402
                          lead_image, download)
import urllib.parse                                                    # noqa: E402

STAGE = os.path.join(ROOT, '.work', 'plantcand')
PER = 8


def main():
    want = set(sys.argv[1:])
    roster = json.load(open(os.path.join(ROOT, 'tools', 'species-plants.json'),
                            encoding='utf-8'))
    roster = [s for s in roster if not want or s['id'] in want]
    os.makedirs(STAGE, exist_ok=True)
    manifest = {}
    mpath = os.path.join(STAGE, 'manifest.json')
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding='utf-8'))

    for sp in roster:
        time.sleep(1.2)                     # Commons throttles a fast run
        d = os.path.join(STAGE, sp['id'])
        os.makedirs(d, exist_ok=True)
        title = sp.get('wiki') or sp['name']
        names = []
        src = lead_image(title)
        if src:
            names.append(urllib.parse.unquote(src.rsplit('/', 1)[-1]))
        names += commons_candidates(title, want=24)

        rows = []
        seen = set()
        for fn in names:
            if len(rows) >= PER:
                break
            if fn in seen:
                continue
            seen.add(fn)
            meta = file_meta(fn)
            if not meta:
                continue
            ok, why = acceptable(meta)
            if not ok:
                continue
            dest = os.path.join(d, f'{len(rows):02d}.jpg')
            try:
                _, w, h = download(meta['url'], dest[:-4])
            except Exception:
                continue
            rows.append({'n': len(rows), 'file': fn, 'licence': why,
                         'author': meta['author'], 'source': meta['descUrl'],
                         'w': w, 'h': h})
        manifest[sp['id']] = rows
        print(f'  {sp["id"]:20} {len(rows)} candidates')

    json.dump(manifest, open(mpath, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\nstaged -> {STAGE}')


if __name__ == '__main__':
    main()
