#!/usr/bin/env python3
"""Make the plan's page icons match a hand-written lessons file, then lint it.
   python3 tools/grow/sync_icons.py astro   -> reads .work/lessons-hand/astro.txt, edits .work/lessons-plan/astro-g1.txt
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c = sys.argv[1]
hand = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), encoding='utf-8').read()
pp = os.path.join(ROOT, '.work', 'lessons-plan', c + '-g1.txt')
plan = open(pp, encoding='utf-8').read()
for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^# UNREVIEWED|^=== |\Z)', hand, re.S | re.M):
    lid, body = m.group(1), m.group(2)
    pages = re.split(r'^--- ', body, flags=re.M)[1:]
    icons = [pg.split('\n', 1)[0].strip() for pg in pages]
    has_term = ['\nterm:' in pg for pg in pages]
    if not icons:
        continue
    pm = re.search(r'(^=== %s\n)(.*?)(?=^=== |\Z)' % re.escape(lid), plan, re.S | re.M)
    if not pm:
        print('no plan for', lid); continue
    lines = pm.group(2).split('\n')
    n = 0
    for i, l in enumerate(lines):
        mm = re.match(r'^(\d+|close)\s+(\S+)(\s+.*)$', l)
        if mm and n < len(icons):
            rest = mm.group(3)
            rest = re.sub(r' TERM[^Q]*?(?= Q |$)', '', rest) if not has_term[n] else rest
            if has_term[n] and ' TERM' not in rest:
                rest = rest.replace(' Q ', ' TERM Q ', 1) if ' Q ' in rest else rest + ' TERM'
            lines[i] = '%s %s%s' % (mm.group(1), icons[n], rest)
            n += 1
    plan = plan[:pm.start(2)] + '\n'.join(lines) + plan[pm.end(2):]
open(pp, 'w', encoding='utf-8').write(plan)
print('synced icons for', c)
