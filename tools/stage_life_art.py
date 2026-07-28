#!/usr/bin/env python3
"""Download several restoration CANDIDATES per dinosaur for a human to pick from.

The first pass of fetch_life_art.py picked by filename alone and shipped a
cartoon video-game sprite as Tyrannosaurus, a fossil beak as Edmontosaurus and
Mantell's 1825 sketch — the reconstruction later shown to be wrong — as
Iguanodon. Filenames cannot tell you whether a picture is any good, whether it
shows the right animal, or whether it is a diagram.

So this stages candidates instead of choosing. Everything lands in
.work/lifecand/<id>/NN.jpg with a manifest, they get looked at, and the chosen
one is copied into img/<id>-life.jpg by promote_life_art.py.

Licence gate is unchanged: PD/CC0/CC-BY/CC-BY-SA only.

  python3 tools/stage_life_art.py [id ...]
"""
import io
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_life_art import (ROOT, IMG, UA, MAX_WIDTH, JPEG_QUALITY, ALL_GENERA,
                            api, acceptable, candidates, file_meta)

STAGE = os.path.join(ROOT, '.work', 'lifecand')
PER_SPECIES = 8


def save(url, dest):
    import urllib.request
    from PIL import Image
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    im = Image.open(io.BytesIO(raw))
    # Restorations are often transparent PNGs. Flattening onto white is what
    # made the earlier batch look like cut-outs floating on a light card in a
    # dark app; flatten onto the app's own panel colour instead.
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (18, 26, 36, 255))
        im = Image.alpha_composite(bg, im)
    im = im.convert('RGB')
    if im.width > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)),
                       Image.LANCZOS)
    im.save(dest, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    return im.width, im.height


def main():
    roster = json.load(open(os.path.join(ROOT, 'tools', 'species-dinos.json'),
                            encoding='utf-8'))
    only = set(sys.argv[1:])
    if only:
        roster = [s for s in roster if s['id'] in only]

    os.makedirs(STAGE, exist_ok=True)
    manifest = {}
    mpath = os.path.join(STAGE, 'manifest.json')
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding='utf-8'))

    for sp in roster:
        # Commons throttles a fast run: a first pass returned eight candidates
        # for the first two species and zero for the next ten, which looked
        # exactly like "no art exists" and was really just a closed tap.
        time.sleep(1.5)
        d = os.path.join(STAGE, sp['id'])
        os.makedirs(d, exist_ok=True)
        rows = []
        for fn in candidates(sp.get('wiki') or sp['name'])[:22]:
            if len(rows) >= PER_SPECIES:
                break
            meta = file_meta(fn)
            if not meta:
                continue
            ok, why = acceptable(meta)
            if not ok:
                continue
            dest = os.path.join(d, f'{len(rows):02d}.jpg')
            try:
                w, h = save(meta['url'], dest)
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
