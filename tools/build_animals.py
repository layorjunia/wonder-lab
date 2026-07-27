#!/usr/bin/env python3
"""Merge fact-checked entry files into js/animals.js, validating as it goes.

Content arrives from several generation runs. This is the gate everything
passes through, so a malformed or off-brief entry cannot reach the app:

  * ids must match the species roster, and every animal must have a photo
  * fact categories and habitats must be values the app actually knows
  * the editorial rules are enforced by search, not by trust — anything
    mentioning evolution, natural selection, deep time or a date is reported

  python3 tools/build_animals.py .work/entries-*.json
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'animals.js')

CATS = {'speed', 'size', 'senses', 'food', 'babies', 'defence', 'record',
        'weird', 'build', 'home', 'talk', 'sleep', 'travel', 'gross',
        'teamwork', 'disguise', 'copied', 'bones', 'created'}
HOMES = {'rainforest', 'ocean', 'desert', 'grassland', 'polar', 'mountain',
         'forest', 'freshwater', 'cave', 'backyard'}

# Editorial tripwires, checked against the shipped text — a rule that lives only
# in a prompt is a rule that is only sometimes followed.
#
# Dinosaurs and the bones they left are IN scope, described the way the family
# reads Genesis: land animals made on day six, alive alongside people, young
# ones aboard the Ark, remembered in the dragon accounts. What stays out is the
# deep-time frame that usually rides along with the word "dinosaur" — the era
# names smuggle in a timescale as surely as "millions of years" does, so
# "Jurassic" is banned for the same reason.
BANNED = [
    (re.compile(r'\bevolv|\bevolution', re.I), 'evolution'),
    (re.compile(r'natural selection', re.I), 'natural selection'),
    (re.compile(r'millions? of years|billions? of years', re.I), 'deep time'),
    (re.compile(r'\b\d[\d,\.]*\s*(million|billion)\s*years', re.I), 'age claim'),
    (re.compile(r'\byears ago\b', re.I), 'dating claim'),
    (re.compile(r'\bTriassic|\bJurassic(?!\s+(Park|World))|\bCretaceous|'
                r'\bMesozoic|\bPaleozoic|\bCenozoic|\bPermian|'
                r'\bIce Age', re.I), 'geologic era'),
    (re.compile(r'\bK-Pg\b|\bK-T\b|mass extinction|extinction event|'
                r'asteroid (impact|strike|hit)', re.I), 'extinction-event framing'),
    (re.compile(r'\bancestor|\bdescend(ed|ant)', re.I), 'common descent'),
    (re.compile(r'\bprehistoric|\bprimitive\b', re.I), 'deep-time framing'),
    # "before people existed" is the same claim wearing plain clothes
    (re.compile(r'before (humans?|people|man) (ever )?(existed|appeared|walked)',
                re.I), 'deep-time framing'),
]


def check(entry, roster_ids, photo_ids):
    problems = []
    eid = entry.get('id', '?')
    if eid not in roster_ids:
        problems.append(f'{eid}: not in the species roster')
    if eid not in photo_ids:
        problems.append(f'{eid}: no photo')
    if not entry.get('facts'):
        problems.append(f'{eid}: no facts')
    for h in entry.get('homes', []):
        if h not in HOMES:
            problems.append(f'{eid}: unknown habitat {h!r}')
    for f in entry.get('facts', []):
        if f.get('cat') not in CATS:
            problems.append(f'{eid}: unknown category {f.get("cat")!r}')
        words = len((f.get('text') or '').split())
        if words > 60:
            problems.append(f'{eid}: fact runs {words} words')
    blob = ' '.join(
        [entry.get('blurb', ''), entry.get('size', ''), entry.get('wonder', '')]
        + [f.get('text', '') + ' ' + (f.get('more') or '')
           for f in entry.get('facts', [])])
    for rx, label in BANNED:
        m = rx.search(blob)
        if m:
            problems.append(f'{eid}: EDITORIAL — {label} ({m.group(0)!r})')
    return problems


def main():
    patterns = sys.argv[1:] or ['.work/entries-*.json']
    files = []
    for p in patterns:
        files += sorted(glob.glob(os.path.join(ROOT, p) if not os.path.isabs(p) else p))
    if not files:
        print('no entry files found')
        return 2

    roster = json.load(open(os.path.join(ROOT, 'tools', 'species.json'), encoding='utf-8'))
    roster_ids = {s['id'] for s in roster}
    order = {s['id']: i for i, s in enumerate(roster)}
    credits = json.load(open(os.path.join(ROOT, 'img', 'credits.json'), encoding='utf-8'))
    photo_ids = set(credits)

    merged = {}
    for f in files:
        for e in json.load(open(f, encoding='utf-8')):
            if e.get('id'):
                merged[e['id']] = e        # later files win
    print(f'{len(files)} file(s) -> {len(merged)} entries')

    problems, kept = [], {}
    for eid, e in merged.items():
        p = check(e, roster_ids, photo_ids)
        problems += p
        if not any('EDITORIAL' in x or 'no facts' in x for x in p):
            kept[eid] = e

    ordered = sorted(kept.values(), key=lambda e: order.get(e['id'], 9999))
    facts = sum(len(e['facts']) for e in ordered)

    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('// Wonder Lab animal data. Generated by tools/build_animals.py\n')
        fh.write('// Written and fact-checked in review passes; do not hand-edit.\n')
        fh.write(f'// {len(ordered)} species, {facts} facts.\n')
        fh.write('const ANIMALS = ')
        json.dump(ordered, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')

    kb = os.path.getsize(OUT) / 1024
    print(f'wrote {len(ordered)} species, {facts} facts -> {OUT} ({kb:.0f} KB)')
    missing = sorted(roster_ids - set(kept))
    if missing:
        print(f'\nstill to write ({len(missing)}): {", ".join(missing[:14])}'
              + (' …' if len(missing) > 14 else ''))
    if problems:
        print(f'\n{len(problems)} issue(s):')
        for p in problems[:30]:
            print('  ', p)
    return 0


if __name__ == '__main__':
    sys.exit(main())
