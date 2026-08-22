#!/usr/bin/env python3
"""Apply agent rewrites back into the entry files, matching on OLD TEXT.

  .venv-tts/bin/python tools/apply_rewrites.py .work/rw/sa-*.json --out .work/rw/out-sa-*.json

Matching on the old string rather than the id is deliberate: body facts carry
no id in source (they get one at build), and a key-based patch would silently
skip every one of them. It also means a rewrite can never land on the wrong
card — if the old text is not there verbatim, nothing happens and it is
reported.
"""
import argparse, glob, json, sys

ap = argparse.ArgumentParser()
ap.add_argument('inputs', nargs='+', help='batch files the agents were given')
ap.add_argument('--out', nargs='+', required=True, help='agent output files')
a = ap.parse_args()

old = {}
for pat in a.inputs:
    for f in glob.glob(pat):
        for ent in json.load(open(f, encoding='utf-8')):
            for fa in ent.get('facts', []):
                for field in ('text', 'more', 'tryit'):
                    if fa.get(field):
                        old[f"{fa['key']}|{field}"] = fa[field]
new = {}
for pat in a.out:
    for f in glob.glob(pat):
        new.update(json.load(open(f, encoding='utf-8')))

pairs, unknown = {}, []
for k, v in new.items():
    if k not in old: unknown.append(k); continue
    if v and v.strip() and v != old[k]: pairs[old[k]] = v
print(f'{len(new)} rewrites returned, {len(pairs)} distinct changes, {len(unknown)} unknown keys')
if unknown: print('  unknown:', ', '.join(unknown[:8]))

applied = 0
for f in sorted(glob.glob('.work/entries-*.json')):
    if '.bak' in f: continue
    rows = json.load(open(f, encoding='utf-8')); dirty = False
    def walk(e):
        global applied, dirty
        for k in ('text', 'more', 'tryit', 'blurb', 'wonder', 'size'):
            v = e.get(k)
            if isinstance(v, str) and v in pairs:
                e[k] = pairs[v]; applied += 1; dirty = True
    for e in rows:
        walk(e)
        for fa in (e.get('facts') or []): walk(fa)
    if dirty:
        json.dump(rows, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{applied} strings replaced')
missing = len(pairs) - applied
if missing > 0:
    print(f'WARNING: {missing} change(s) found no verbatim match and were NOT applied')
sys.exit(0)
