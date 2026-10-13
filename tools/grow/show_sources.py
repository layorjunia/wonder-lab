#!/usr/bin/env python3
"""Print the best passages of each saved source for the sections of a course, so facts can be written from them.
   python3 tools/grow/show_sources.py earth [section ...] [--chars 1800]
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import extract_facts as E
args = [a for a in sys.argv[1:] if not a.startswith('--')]
chars = 1800
if '--chars' in sys.argv:
    chars = int(sys.argv[sys.argv.index('--chars') + 1])
    args = [a for a in args if a != str(chars)]
course, only = args[0], set(args[1:])
d = os.path.join(ROOT, '.work', 'grow', 'sources')
for fn in sorted(os.listdir(d)):
    if not fn.startswith(course + '-'):
        continue
    sec = json.load(open(os.path.join(d, fn), encoding='utf-8'))
    if only and sec['id'] not in only:
        continue
    print('\n######## %s-%s  %s %s   | FOCUS: %s' % (sec['course'], sec['id'], sec['glyph'], sec['name'], sec['angle']))
    for i, s in enumerate(sec['sources'], 1):
        print('--- S%d %s' % (i, s['title']))
        print(E.passages(s['text'], sec['angle'] + ' ' + sec['name'], chars))
