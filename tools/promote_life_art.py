#!/usr/bin/env python3
"""Copy chosen staged restorations into img/ and record their attribution.

Takes a JSON map of {species id: candidate index} on stdin or as a file. An
index of -1 means "none of the candidates was usable" — that species keeps its
skeleton photo, which is the honest fallback and needs no apology.

  python3 tools/promote_life_art.py picks.json
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'img')
STAGE = os.path.join(ROOT, '.work', 'lifecand')
CREDITS = os.path.join(IMG, 'credits.json')


def main():
    picks = json.load(open(sys.argv[1], encoding='utf-8')) if len(sys.argv) > 1 \
        else json.load(sys.stdin)
    manifest = json.load(open(os.path.join(STAGE, 'manifest.json'), encoding='utf-8'))
    credits = json.load(open(CREDITS, encoding='utf-8'))
    roster = {s['id']: s for s in json.load(
        open(os.path.join(ROOT, 'tools', 'species-dinos.json'), encoding='utf-8'))}

    used = dropped = 0
    for sid, sel in picks.items():
        n = sel['pick'] if isinstance(sel, dict) else sel
        key = sid + '-life'
        dest = os.path.join(IMG, key + '.jpg')
        if n is None or n < 0:
            # clear any earlier promotion so a rejected species really does
            # fall back to its skeleton rather than keeping a stale picture
            if os.path.exists(dest):
                os.remove(dest)
            credits.pop(key, None)
            dropped += 1
            print(f'  {sid:20} -> skeleton (no usable restoration)')
            continue
        row = next((r for r in manifest.get(sid, []) if r['n'] == n), None)
        if not row:
            print(f'  {sid:20} !! candidate {n} not staged')
            continue
        shutil.copyfile(os.path.join(STAGE, sid, f'{n:02d}.jpg'), dest)
        credits[key] = {
            'name': roster[sid]['name'] + ' — artist\'s reconstruction',
            'file': key + '.jpg',
            'licence': row['licence'], 'author': row['author'],
            'source': row['source'], 'width': row['w'], 'height': row['h'],
            'kind': 'artwork',
        }
        used += 1
        print(f'  {sid:20} #{n} {row["licence"]:15} {row["author"][:34]}')

    json.dump(credits, open(CREDITS, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\n{used} restorations promoted, {dropped} species keep the skeleton')


if __name__ == '__main__':
    main()
