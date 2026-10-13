#!/usr/bin/env python3
"""Print the candidate facts of a course for review: fact, check verdict, and the quote it rests on.

  python3 tools/grow/review_facts.py --course earth
  python3 tools/grow/review_facts.py --course earth --section deserts
  python3 tools/grow/review_facts.py --status          # how far each course is

The reviewer (a person or Claude) then writes .work/grow/decisions/<course>.json:
  {"<section>": {"hook": "...", "term": "dune", "pick": [3, 0, 5, 1, 2, 4], "edit": {"3": "new text"}}}
`pick` is the order of the six facts as indices into the list printed here.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FACTS = os.path.join(ROOT, '.work', 'grow', 'facts')


def load(course=None):
    out = []
    for fn in sorted(os.listdir(FACTS)):
        if not fn.endswith('.json') or (course and not fn.startswith(course + '-')):
            continue
        out.append(json.load(open(os.path.join(FACTS, fn), encoding='utf-8')))
    return out


def usable(f):
    return f.get('verdict') in (None, 'supported', 'partly')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--course')
    ap.add_argument('--section')
    ap.add_argument('--status', action='store_true')
    ap.add_argument('--quote', type=int, default=240)
    a = ap.parse_args()
    secs = load(a.course)
    if a.status:
        for s in secs:
            v = {}
            for f in s['facts']:
                v[f.get('verdict', '?')] = v.get(f.get('verdict', '?'), 0) + 1
            print('%-24s %2d facts %s  %ds' % (s['course'] + '-' + s['id'], len(s['facts']), v, s.get('seconds', 0)))
        return 0
    for s in secs:
        if a.section and s['id'] != a.section:
            continue
        print('\n## %s-%s  %s %s   (%d candidates)' % (s['course'], s['id'], s['glyph'], s['name'], len(s['facts'])))
        for i, f in enumerate(s['facts']):
            if not usable(f):
                continue
            flag = {'supported': '', 'partly': '  [PARTLY: %s]' % f.get('unsupported', ''), None: '  [unverified]'}.get(f.get('verdict'), '')
            print('%2d (%s/%s) %s%s' % (i, f.get('cat'), f.get('kind'), f['text'], flag))
            print('     Q: %s -> %s | quote(%s): "%s"' % (f.get('q'), f.get('a'), f.get('source'),
                                                         f['quote'][:a.quote]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
