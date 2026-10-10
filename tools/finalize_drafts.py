#!/usr/bin/env python3
"""Turn the model's drafts into lessons, unattended, and say honestly which ones are unreviewed.

  python3 tools/finalize_drafts.py

For every draft in .work/lessons-draft/ it applies the mechanical fixes a person would (a page
over four blocks loses an extra paragraph; a game with a bad or surplus pair loses that pair),
runs the same gate every hand-approved lesson passes (tools/check_lessons.py), and promotes
the ones that pass into .work/lessons-src/ marked  # UNREVIEWED  so the audit can find them.
A draft that still fails stays in .work/lessons-draft/ and is listed as needing work.
Its leftover page-level notes are kept in .work/audit/notes/ either way.
"""
import glob
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import check_lessons as C          # noqa: E402
import parse_lessons as P          # noqa: E402

DRAFTS = os.path.join(ROOT, '.work', 'lessons-draft')
AUDIT = os.path.join(ROOT, '.work', 'audit')


def autofix(lid, L):
    # 1. a page may have at most 4 blocks: shed extra paragraphs, keeping the first and the last
    for pg in L['pages']:
        while len(pg['blocks']) > 4:
            ps = [i for i, b in enumerate(pg['blocks']) if b['t'] == 'p']
            drop = next((i for i in ps if 0 < i < len(pg['blocks']) - 1 and pg['blocks'][i + 0]['t'] == 'p'
                         and not (pg['blocks'][-1]['t'] == 'check' and i == len(pg['blocks']) - 2)), None)
            if drop is None:
                drop = ps[-1] if ps else None
            if drop is None:
                break
            pg['blocks'].pop(drop)
    # 2. a game keeps at most 6 pairs, and drops a pair that breaks the name = description rule
    species = lid.startswith(('animals-', 'plants-'))
    lo = 3 if species else 4
    good = []
    for a, b in L['game']['pairs']:
        l, r = len(a.split()), len(b.split())
        if 1 <= l <= 4 and 3 <= r <= 10 and r >= l + 1:
            good.append([a, b])
    if len(good) >= lo:
        L['game']['pairs'] = good[:6]
    return L


def main():
    os.makedirs(AUDIT, exist_ok=True)
    srcs = C.source_text()
    promoted, needs = [], {}
    for path in sorted(glob.glob(os.path.join(DRAFTS, '*.txt'))):
        lid = os.path.basename(path)[:-4]
        try:
            L = P.parse(path)[lid]
        except SystemExit as e:
            needs[lid] = [f'unreadable: {e}']
            continue
        note = os.path.join(DRAFTS, lid + '.problems')
        if os.path.exists(note):
            open(os.path.join(AUDIT, 'notes', lid + '.txt'), 'w').write(open(note).read())
        L = autofix(lid, L)
        L.setdefault('quiz', [])
        probs = []
        C.check(lid, L, probs, srcs.get(lid))
        if probs:
            needs[lid] = [p.split(': ', 1)[1] if ': ' in p else p for p in probs]
            if '--discard-failures' in sys.argv:        # re-roll it: the next round drafts it again
                os.makedirs(os.path.join(AUDIT, 'failed'), exist_ok=True)
                os.replace(path, os.path.join(AUDIT, 'failed', f'{lid}.{int(time.time())}.txt'))
            continue
        text = P.emit(lid, L)
        open(path, 'w', encoding='utf-8').write(
            f'# UNREVIEWED: drafted by a local model, auto-checked, not yet read by a person ({time.strftime("%Y-%m-%d")})\n' + text)
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'promote_lessons.py'), lid],
                           capture_output=True, text=True)
        (promoted if 'promoted into' in r.stdout else []).append(lid)
        if 'promoted into' not in r.stdout:
            needs[lid] = [r.stdout.strip()[-300:]]
    json.dump({'promoted': promoted, 'needs_work': needs}, open(os.path.join(AUDIT, 'finalize.json'), 'w'), indent=1)
    print(f'{len(promoted)} promoted (unreviewed), {len(needs)} need work')
    for k, v in needs.items():
        print('  NEEDS WORK', k, '|', '; '.join(v)[:160])


if __name__ == '__main__':
    main()
