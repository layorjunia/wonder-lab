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
import tempfile
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK          # never the system temp dir
OUT = os.path.join(ROOT, 'js', 'animals.js')

CATS = {'speed', 'size', 'senses', 'food', 'babies', 'defence', 'record',
        'weird', 'build', 'home', 'talk', 'sleep', 'travel', 'gross',
        'teamwork', 'disguise', 'copied', 'bones', 'created', 'tryit', 'oops', 'samesame',
        # history + physical science
        'built', 'writing', 'daily', 'artifact', 'when', 'people', 'howworks'}
# How the claim is known. Optional for now — the living-animal entries predate
# it — but required on every dinosaur fact, where almost nothing is direct
# observation and prose alone lets a model borrow the authority of a bone.
KINDS = {'found', 'worked', 'record'}
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
    # The app must never talk about itself. Cards that explain the badge
    # colours, or say "the rest of this section", are commentary on how the
    # thing was built rather than on the world — and a child reading a card
    # about Genesis should get Genesis, not a note about the interface.
    (re.compile(r'\bthis app\b|\bthe app\b|\bthis section\b|\bthis card\b|'
                r'purple badge|green badge|badge on every|'
                r'purple rather than green|green means somebody|'
                r'included here because|'
                r'(?:green|amber|purple)\b[^.]{0,30}\bnot\b[^.]{0,15}(?:green|amber|purple)', re.I), 'meta commentary'),
    # "before people existed" is the same claim wearing plain clothes
    (re.compile(r'before (humans?|people|man) (ever )?(existed|appeared|walked)',
                re.I), 'deep-time framing'),
]


# Group-scoped tripwires. The plain BANNED list runs against every entry, so a
# feather rule cannot live there — half the bird entries would fail it. The
# family's position is that the feathered specimens are birds rather than
# dinosaurs, so the word simply has no business in this group.
BANNED_BY_GROUP = {
    'dinosaurs': [
        (re.compile(r'\bfeather|\bquill|\bplumage|\bpycnofib|\bproto-?feather',
                    re.I), 'feathers'),
    ],
}


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
        k = f.get('kind')
        if k is not None and k not in KINDS:
            problems.append(f'{eid}: unknown kind {k!r}')
        if entry.get('group') == 'dinosaurs' and not k:
            problems.append(f'{eid}: fact has no kind — {f.get("text", "")[:48]!r}')
        words = len((f.get('text') or '').split())
        if words > 60:
            problems.append(f'{eid}: fact runs {words} words')
    blob = ' '.join(
        [entry.get('blurb', ''), entry.get('size', ''), entry.get('wonder', '')]
        + [f.get('text', '') + ' ' + (f.get('more') or '')
           for f in entry.get('facts', [])])
    rules = BANNED + BANNED_BY_GROUP.get(entry.get('group'), [])
    for rx, label in rules:
        m = rx.search(blob)
        if m:
            problems.append(f'{eid}: EDITORIAL — {label} ({m.group(0)!r})')
    return problems


def main():
    # Explicit, not a wildcard. '.work/entries-*.json' also matches the plant
    # and earth files, and plants have the same entry shape as animals — so a
    # glob silently merged 91 plants into ANIMALS and the app showed 301
    # "animals" including the banana.
    patterns = sys.argv[1:] or ['.work/entries-mammals.json',
                                '.work/entries-rest.json',
                                '.work/entries-birds5.json',
                                '.work/entries-dinos-*.json']
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
            # Flag entries that have an artist's reconstruction alongside the
            # excavated-skeleton photo, so the app can lead with the painting
            # and still show the bones underneath, each labelled for what it is.
            if os.path.exists(os.path.join(ROOT, 'img', eid + '-life.jpg')):
                e['art'] = 1
            else:
                e.pop('art', None)
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
