#!/usr/bin/env python3
"""Re-promote chosen hand lessons: drop their blocks from .work/lessons-src/<course>.txt, then promote again.

  python3 tools/grow/repromote.py earth earth-lakes earth-storms
(run tools/grow/hand_dsl.py <course> first so .work/lessons-hand/<course>.txt is current)
"""
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
course, ids = sys.argv[1], set(sys.argv[2:])
p = os.path.join(ROOT, '.work', 'lessons-src', course + '.txt')
lines = open(p, encoding='utf-8').read().split('\n')
starts = []
for k, l in enumerate(lines):
    m = re.match(r'=== (\S+)', l)
    if m:
        s = k - 1 if k > 0 and lines[k - 1].startswith('# UNREVIEWED') else k
        starts.append((s, m.group(1)))
keep = [True] * len(lines)
for idx, (s, lid) in enumerate(starts):
    end = starts[idx + 1][0] if idx + 1 < len(starts) else len(lines)
    if lid in ids:
        for k in range(s, end):
            keep[k] = False
open(p, 'w', encoding='utf-8').write('\n'.join(l for l, kp in zip(lines, keep) if kp).rstrip('\n') + '\n')
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'grow', 'promote_hand.py'), course], check=True)
