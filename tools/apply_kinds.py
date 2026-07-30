#!/usr/bin/env python3
"""Write the evidence markings back into the animal entry files.

The 180 non-dinosaur animals were the only content in the app with no `kind`,
so an inference like "the shape suits fast running" sat unmarked next to a
measured top speed. This closes that gap.

Refuses to run if a batch looks over-hedged. The failure mode this pass has to
avoid is not the gap — it is marking measured things as reasoned, which makes
every sentence sound uncertain and teaches a child nothing.

  .venv-tts/bin/python tools/apply_kinds.py
"""
import collections
import glob
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK

KINDS = {'found', 'worked', 'record'}
# A batch whose 'worked' share exceeds this is almost certainly hedging things
# somebody measured. The brief asks for roughly 70/20/10.
MAX_WORKED = 0.42

# Vague appeals to authority. The app says what the reasoning IS, or says
# nothing; "scientists believe" teaches deference instead of thinking.
BAD_PHRASES = ('scientists believe', 'scientists think', 'it is thought',
               'experts say', 'researchers claim', 'it is believed')


def main():
    rows = []
    for p in sorted(glob.glob(os.path.join(ROOT, '.work', 'kinds-*.json'))):
        try:
            rows += json.load(open(p, encoding='utf-8'))
        except Exception as e:
            print(f'  UNREADABLE {os.path.basename(p)}: {e}')
    if not rows:
        print('no kinds-*.json found')
        return 2

    # ── sanity gates before touching anything ──
    problems = []
    bad_kind = [r for r in rows if r.get('kind') not in KINDS]
    if bad_kind:
        problems.append(f'{len(bad_kind)} row(s) with a bad kind')
    split = collections.Counter(r['kind'] for r in rows if r.get('kind') in KINDS)
    worked_share = split['worked'] / max(1, sum(split.values()))
    if worked_share > MAX_WORKED:
        problems.append(f'{worked_share:.0%} marked worked — over the {MAX_WORKED:.0%} '
                        'ceiling; this is hedging measured things')
    hedged = [r for r in rows
              if any(b in (r.get('text') or '').lower() for b in BAD_PHRASES)]
    if hedged:
        problems.append(f'{len(hedged)} row(s) use a banned authority phrase')
        for r in hedged[:5]:
            print(f'    {r["id"]}#{r["index"]}: {r["text"][:90]}')
    if problems:
        for p in problems:
            print('  REFUSING: ' + p)
        return 1

    by_id = collections.defaultdict(dict)
    for r in rows:
        by_id[r['id']][r['index']] = r

    files = {p: json.load(open(p, encoding='utf-8'))
             for p in sorted(glob.glob(os.path.join(ROOT, '.work', 'entries-*.json')))
             if not any(x in p for x in ('dinos', 'plants', 'earth', '.bak'))}

    marked = reworded = 0
    missing = []
    for path, entries in files.items():
        changed = False
        for e in entries:
            per = by_id.get(e.get('id'))
            if not per:
                continue
            for i, f in enumerate(e.get('facts', [])):
                r = per.get(i)
                if not r:
                    missing.append(f'{e["id"]}#{i}')
                    continue
                f['kind'] = r['kind']
                marked += 1
                if r.get('changed') and r.get('text') and r['text'] != f['text']:
                    f['text'] = r['text']
                    reworded += 1
                if r.get('more'):
                    f['more'] = r['more']
                changed = True
        if changed:
            json.dump(entries, open(path, 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)

    print(f'{marked} facts marked, {reworded} reworded')
    print(f'split: {dict(split)}  ({worked_share:.0%} worked)')
    if missing:
        print(f'{len(missing)} fact(s) had no marking returned: '
              f'{", ".join(missing[:12])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
