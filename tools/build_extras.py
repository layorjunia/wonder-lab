#!/usr/bin/env python3
"""Build js/plants.js and js/earth.js from the generated entry files.

Same editorial gate as the animals — BANNED, category and kind checks are
imported from build_animals rather than copied, so a rule added there applies
here automatically. That matters: the whole point of the gate is that it cannot
be half-applied, and a second copy of the regex list is exactly how it gets
half-applied.

  .venv-tts/bin/python tools/build_extras.py
"""
import glob
import json
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK

sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_animals import BANNED, CATS, HOMES, KINDS          # noqa: E402

PLANT_GROUPS = {'trees', 'flowers', 'carnivores', 'desert', 'crops',
                'water', 'moss', 'ferns', 'fungi', 'odd'}
EARTH_SECTIONS = {'rocks', 'volcanoes', 'quakes', 'water',
                  'weather', 'caves', 'ice', 'sky'}
ASTRO_SECTIONS = {'sun', 'moon', 'rocky', 'giants',
                  'smallstuff', 'stars', 'deepsky', 'looking'}
BODY_SECTIONS = {'brain', 'heart', 'bones', 'lungs', 'senses', 'gut', 'skin',
                 'defence', 'growing', 'sleep', 'cells', 'voice', 'hands', 'heat'}
MAX_WORDS = 60


def editorial(blob, label):
    out = []
    for rx, name in BANNED:
        m = rx.search(blob)
        if m:
            out.append(f'{label}: EDITORIAL — {name} ({m.group(0)!r})')
    return out


def check_plant(e, roster_ids, photo_ids):
    p, eid = [], e.get('id', '?')
    if eid not in roster_ids:
        p.append(f'{eid}: not in the plant roster')
    if eid not in photo_ids:
        p.append(f'{eid}: no photo')
    if e.get('group') not in PLANT_GROUPS:
        p.append(f'{eid}: unknown plant group {e.get("group")!r}')
    for h in e.get('homes', []):
        if h not in HOMES:
            p.append(f'{eid}: unknown habitat {h!r}')
    if not e.get('facts'):
        p.append(f'{eid}: no facts')
    for f in e.get('facts', []):
        if f.get('cat') not in CATS:
            p.append(f'{eid}: unknown category {f.get("cat")!r}')
        if f.get('kind') not in KINDS:
            p.append(f'{eid}: fact has no/unknown kind — {f.get("text", "")[:44]!r}')
        n = len((f.get('text') or '').split())
        if n > MAX_WORDS:
            p.append(f'{eid}: fact runs {n} words')
    blob = ' '.join([e.get('blurb', ''), e.get('size', ''), e.get('wonder', '')]
                    + [f.get('text', '') + ' ' + (f.get('more') or '')
                       for f in e.get('facts', [])])
    return p + editorial(blob, eid)


def check_flat(e, sections, label):
    """Shared shape check for the id-and-section datasets (earth, astro)."""
    p, eid = [], e.get('id', '?')
    if e.get('section') not in sections:
        p.append(f'{eid}: unknown {label} section {e.get("section")!r}')
    if e.get('cat') not in CATS:
        p.append(f'{eid}: unknown category {e.get("cat")!r}')
    if e.get('kind') not in KINDS:
        p.append(f'{eid}: no/unknown kind {e.get("kind")!r}')
    if not (e.get('text') or '').strip():
        p.append(f'{eid}: empty text')
    n = len((e.get('text') or '').split())
    if n > MAX_WORDS:
        p.append(f'{eid}: runs {n} words')
    blob = ' '.join([e.get('text', ''), e.get('more') or '', e.get('tryit') or ''])
    return p + editorial(blob, eid)


# Astronomy has one rule the other sections do not: no star may be born,
# formed, collapse or die. That is the single claim Jacob named, it is
# ubiquitous in astronomy writing, and it slips in as ordinary phrasing rather
# than as a banned word.
STAR_STORY = re.compile(
    r'star\s*(?:s)?\s+(?:are|is|was|were)\s+(?:being\s+)?(?:born|formed|forming|made)'
    r'|(?:birth|formation|death|life\s*cycle)\s+of\s+(?:a\s+)?stars?'
    r'|stars?\s+(?:form|forms|forming|collapse|collapses|ignite|ignites|die|dies)\b'
    r'|protostar|main\s+sequence|red\s+giant\s+phase|stellar\s+evolution', re.I)


# Saying a thing in order to disown it is the point, not a violation. The
# Orion card — "people call it a nursery because they think stars form inside
# it. Nobody has watched one form." — is the single best card in the section
# and a bare keyword match rejects it. So the tripwire only fires when the
# phrase is ASSERTED: no nearby negation, no attribution to someone else.
HEDGED = re.compile(
    r'\bnobody\b|\bno one\b|\bnever\b|\bnot\b|people call|they think|'
    r'is thought|are thought|believed to|assumed|the idea|the story|'
    r'has watched|has ever seen|guesswork|so far as anyone', re.I)


def check_astro(e):
    p = check_flat(e, ASTRO_SECTIONS, 'astro')
    blob = ' '.join([e.get('text', ''), e.get('more') or '', e.get('tryit') or ''])
    for m in STAR_STORY.finditer(blob):
        window = blob[max(0, m.start() - 140):m.end() + 140]
        if not HEDGED.search(window):
            p.append(f'{e.get("id", "?")}: EDITORIAL — '
                     f'star-formation narrative asserted ({m.group(0)!r})')
            break
    return p


def check_body(e):
    return check_flat(e, BODY_SECTIONS, 'body')


def check_earth(e):
    p, eid = [], e.get('id', '?')
    if e.get('section') not in EARTH_SECTIONS:
        p.append(f'{eid}: unknown section {e.get("section")!r}')
    if e.get('cat') not in CATS:
        p.append(f'{eid}: unknown category {e.get("cat")!r}')
    if e.get('kind') not in KINDS:
        p.append(f'{eid}: no/unknown kind {e.get("kind")!r}')
    if not (e.get('text') or '').strip():
        p.append(f'{eid}: empty text')
    n = len((e.get('text') or '').split())
    if n > MAX_WORDS:
        p.append(f'{eid}: runs {n} words')
    blob = ' '.join([e.get('text', ''), e.get('more') or '', e.get('tryit') or ''])
    return p + editorial(blob, eid)


def load(pattern):
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, pattern))):
        rows += json.load(open(f, encoding='utf-8'))
    return rows


def write_js(path, const, rows, header):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write(f'const {const} = ')
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    return os.path.getsize(path)


def main():
    credits = set(json.load(open(os.path.join(ROOT, 'img', 'credits.json'),
                                 encoding='utf-8')))
    problems = []

    # ── plants ──
    roster = json.load(open(os.path.join(ROOT, 'tools', 'species-plants.json'),
                            encoding='utf-8'))
    order = {s['id']: i for i, s in enumerate(roster)}
    roster_ids = set(order)
    merged = {}
    for e in load('.work/entries-plants-*.json'):
        if e.get('id'):
            merged[e['id']] = e
    kept = {}
    for eid, e in merged.items():
        pr = check_plant(e, roster_ids, credits)
        problems += pr
        if not any('EDITORIAL' in x or 'no facts' in x or 'no photo' in x for x in pr):
            kept[eid] = e
    plants = [kept[k] for k in sorted(kept, key=lambda x: order.get(x, 9999))]

    # ── earth ──
    earth = []
    for e in load('.work/entries-earth-*.json'):
        pr = check_earth(e)
        problems += pr
        if not any('EDITORIAL' in x or 'empty text' in x for x in pr):
            earth.append(e)
    sec_order = list(EARTH_SECTIONS)
    earth.sort(key=lambda e: (sec_order.index(e['section'])
                              if e.get('section') in sec_order else 99, e.get('id', '')))

    # Ids are how an Expedition addresses a stop, so a collision silently
    # points two stops at the same card. The recovery pass created one by
    # numbering against a single file when the section spanned two.
    dupes = [e['id'] for e in earth]
    dupes = sorted({i for i in dupes if dupes.count(i) > 1})
    if dupes:
        problems.append(f'duplicate earth ids: {", ".join(dupes)}')

    # Body facts get a stable id for the same reason. They are hand-written and
    # ordered, so position is the id — but it has to be written down, not
    # inferred at runtime, or inserting one fact renumbers every stop after it.
    missing = sorted(roster_ids - set(kept))
    if missing:
        print(f'plants with no usable entry ({len(missing)}): {", ".join(missing[:12])}')

    # ── astronomy ──
    astro = []
    for e in load('.work/entries-astro-*.json'):
        pr = check_astro(e)
        problems += pr
        if not any('EDITORIAL' in x or 'empty text' in x for x in pr):
            astro.append(e)
    asec = list(ASTRO_SECTIONS)
    astro.sort(key=lambda e: (asec.index(e['section']) if e.get('section') in asec else 99,
                              e.get('id', '')))
    adupe = [e['id'] for e in astro]
    adupe = sorted({i for i in adupe if adupe.count(i) > 1})
    if adupe:
        problems.append(f'duplicate astro ids: {", ".join(adupe)}')

    # ── body ──
    # Existing ids are load-bearing: the Try It Now tracker stores them, so a
    # renumber would erase what a child has actually gone and done. Anything
    # already carrying an id keeps it; new facts take the next free number.
    body = load('.work/entries-body-*.json')
    for e in body:
        problems += check_body(e)
    body = [e for e in body if not any(
        x.startswith(e.get('id', '?')) and 'EDITORIAL' in x for x in problems)]
    taken = {e['id'] for e in body if e.get('id')}
    nxt = 0
    for e in body:
        if not e.get('id'):
            while f'b{nxt}' in taken:
                nxt += 1
            e['id'] = f'b{nxt}'
            taken.add(e['id'])
    bsec = list(BODY_SECTIONS)
    body.sort(key=lambda e: (bsec.index(e['section']) if e.get('section') in bsec else 99,
                             int(e['id'][1:])))

    n3 = write_js(os.path.join(ROOT, 'js', 'astro.js'), 'ASTRO', astro,
                  '// Wonder Lab astronomy data. Generated by tools/build_extras.py\n'
                  '// Observed first. No star is born, formed or dies anywhere in here —\n'
                  '// nobody has watched that happen. See .work/BRIEF-astronomy.md.\n'
                  f'// {len(astro)} facts across {len({e["section"] for e in astro})} sections.\n')
    n4 = write_js(os.path.join(ROOT, 'js', 'body.js'), 'BODY', body,
                  '// Wonder Lab human-body data. Generated by tools/build_extras.py\n'
                  '// ids are stable and referenced by the Try It Now tracker — never\n'
                  '// renumber an existing one.\n'
                  f'// {len(body)} facts across {len({e["section"] for e in body})} sections.\n')
    print(f'wrote {len(astro)} astronomy facts -> js/astro.js ({n3//1024} KB)')
    print(f'wrote {len(body)} body facts -> js/body.js ({n4//1024} KB)')

    n1 = write_js(os.path.join(ROOT, 'js', 'plants.js'), 'PLANTS', plants,
                  '// Wonder Lab plant data. Generated by tools/build_extras.py\n'
                  '// Written and fact-checked in review passes; do not hand-edit.\n'
                  f'// {len(plants)} plants, {sum(len(p["facts"]) for p in plants)} facts.\n')
    n2 = write_js(os.path.join(ROOT, 'js', 'earth.js'), 'EARTH', earth,
                  '// Wonder Lab earth-science data. Generated by tools/build_extras.py\n'
                  '// Written and fact-checked in review passes; do not hand-edit.\n'
                  f'// {len(earth)} facts across {len({e["section"] for e in earth})} sections.\n')

    print(f'\nwrote {len(plants)} plants / '
          f'{sum(len(p["facts"]) for p in plants)} facts -> js/plants.js ({n1//1024} KB)')
    print(f'wrote {len(earth)} earth facts -> js/earth.js ({n2//1024} KB)')

    # Reported LAST, once every dataset has contributed. Printing partway
    # through meant astronomy and body problems were appended after the loop
    # had already run, so two rejected astronomy facts vanished without a word.
    if problems:
        print()
        for pr in problems[:40]:
            print('  ' + pr)
        if len(problems) > 40:
            print(f'  ... and {len(problems) - 40} more')
        print(f'{len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
