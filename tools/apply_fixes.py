#!/usr/bin/env python3
"""Apply staged fact corrections and rewrites back into the .work entry files.

Corrections arrive from two places — the adversarial fact-check workflow and
the feather sweep — and both address facts by (species id, index). Applying them
by hand across six files invites the wrong fact being overwritten silently, so
this does it by lookup and reports every change it makes.

Input JSON may contain any of:
  {"facts":   [{"id":..., "index":n, "cat":..., "text":..., "more":...}],
   "blurbs":  {"id": "new blurb"},
   "created": [{"id":..., "facts":[{"text":..., "more":...}]}]}

`created` replaces that species' cat=="created" facts in order, which is how
the de-boilerplate rewrite comes back.

  python3 tools/apply_fixes.py fixes1.json fixes2.json
"""
import glob
import json
import os
import tempfile
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK          # never the system temp dir
WORK = os.path.join(ROOT, '.work')


def load_entries():
    """id -> (path, entry) across every dinosaur entry file."""
    files, index = {}, {}
    for path in sorted(glob.glob(os.path.join(WORK, 'entries-dinos-*.json'))):
        files[path] = json.load(open(path, encoding='utf-8'))
        for e in files[path]:
            index[e['id']] = (path, e)
    return files, index


def main():
    files, index = load_entries()
    changed, misses = 0, []

    for src in sys.argv[1:]:
        fix = json.load(open(src, encoding='utf-8'))

        for f in fix.get('facts', []):
            hit = index.get(f['id'])
            if not hit:
                misses.append(f'{f["id"]}: not found')
                continue
            facts = hit[1]['facts']
            i = f['index']
            if not (0 <= i < len(facts)):
                misses.append(f'{f["id"]}: index {i} out of range')
                continue
            # Carry `kind` across unless the caller overrides it. Rebuilding
            # the fact from scratch silently dropped the evidence marking on
            # every fact this touched, and the build gate only catches that if
            # it happens to every one of them.
            new = {'cat': f.get('cat') or facts[i]['cat'], 'text': f['text']}
            kind = f.get('kind') or facts[i].get('kind')
            if kind:
                new['kind'] = kind
            if f.get('more'):
                new['more'] = f['more']
            facts[i] = new
            changed += 1
            print(f'  {f["id"]:20} #{i} [{new["cat"]}] replaced')

        for sid, blurb in (fix.get('blurbs') or {}).items():
            hit = index.get(sid)
            if not hit:
                misses.append(f'{sid}: not found')
                continue
            hit[1]['blurb'] = blurb
            changed += 1
            print(f'  {sid:20} blurb replaced')

        for r in fix.get('created', []):
            hit = index.get(r['id'])
            if not hit:
                misses.append(f'{r["id"]}: not found')
                continue
            facts = hit[1]['facts']
            slots = [i for i, x in enumerate(facts) if x['cat'] == 'created']
            for slot, nf in zip(slots, r['facts']):
                new = {'cat': 'created', 'text': nf['text']}
                kind = nf.get('kind') or facts[slot].get('kind')
                if kind:
                    new['kind'] = kind
                if nf.get('more'):
                    new['more'] = nf['more']
                facts[slot] = new
                changed += 1
            print(f'  {r["id"]:20} {len(slots)} created facts rewritten')

    for path, entries in files.items():
        json.dump(entries, open(path, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)

    print(f'\n{changed} changes applied')
    for m in misses:
        print(f'  MISS {m}')
    return 1 if misses else 0


if __name__ == '__main__':
    sys.exit(main())
