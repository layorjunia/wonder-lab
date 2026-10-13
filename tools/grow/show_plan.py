#!/usr/bin/env python3
"""python3 tools/grow/show_plan.py astro [section ...]  -- print the plan blocks (icons, facts, Q seeds, TERM)"""
import re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c, only = sys.argv[1], set(sys.argv[2:])
s = open(os.path.join(ROOT, '.work', 'lessons-plan', c + '-g1.txt'), encoding='utf-8').read()
for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^=== |\Z)', s, re.S | re.M):
    if only and m.group(1).split('-', 1)[1] not in only:
        continue
    print('=== ' + m.group(1))
    print(m.group(2).strip())
    print()
