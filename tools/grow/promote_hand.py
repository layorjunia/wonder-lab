#!/usr/bin/env python3
"""Append hand-written lessons (.work/lessons-hand/<course>.txt) to .work/lessons-src/<course>.txt.

  python3 tools/grow/promote_hand.py astro earth ...      # courses

Each block gets its own '# UNREVIEWED:' marker line (the audit reads the line above `=== id`). A lesson id that is
already in lessons-src is skipped, so it is safe to run twice.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MARK = ('# UNREVIEWED: written by hand (Claude) from sourced facts (each fact quotes its source), passed every '
        'automatic check, not yet read by a person (2026-10-13)\n')
for c in sys.argv[1:]:
    hand = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), encoding='utf-8').read()
    dst = os.path.join(ROOT, '.work', 'lessons-src', c + '.txt')
    cur = open(dst, encoding='utf-8').read() if os.path.exists(dst) else ''
    have = set(re.findall(r'^=== (\S+)', cur, re.M))
    add, n = '', 0
    for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^# UNREVIEWED|^=== |\Z)', hand, re.S | re.M):
        if m.group(1) in have:
            continue
        add += '\n' + MARK + '=== %s\n%s' % (m.group(1), m.group(2).rstrip('\n') + '\n')
        n += 1
    if add:
        open(dst, 'w', encoding='utf-8').write((cur.rstrip('\n') + '\n' if cur else '') + add)
    print('%s: +%d lesson(s) (now %d)' % (c, n, len(have) + n))
