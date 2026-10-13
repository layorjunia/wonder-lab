#!/usr/bin/env python3
"""Patch one written fact and report its reading grade.
   python3 tools/grow/patch.py america revolution 4 "new text" [--q "question?" --a "answer"] [--from X --to Y]
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import readability as R
a = sys.argv[1:]
course, sec, idx, text = a[0], a[1], int(a[2]) - 1, a[3]
opt = {}
i = 4
while i < len(a):
    opt[a[i].lstrip('-')] = a[i + 1]; i += 2
p = os.path.join(ROOT, '.work', 'grow', 'written', course + '.json')
d = json.load(open(p, encoding='utf-8'))
f = d[sec]['facts'][idx]
f['t'] = text
for k in ('q', 'a', 'from', 'to', 's', 'cat', 'kind'):
    if k in opt:
        f[k] = int(opt[k]) if k == 's' else opt[k]
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('grade %.1f' % R.grade(text)[0], '|', text)
