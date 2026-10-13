#!/usr/bin/env python3
"""Lint every lesson in .work/lessons-hand/<course>.txt with the draft harness (plan, source facts, whole-lesson gate).
   python3 tools/grow/lint_hand.py astro [lesson-section ...]
"""
import os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c, only = sys.argv[1], set(sys.argv[2:])
hand = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), encoding='utf-8').read()
bad = 0
for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^# UNREVIEWED|^=== |\Z)', hand, re.S | re.M):
    lid = m.group(1)
    if only and lid.split('-', 1)[1] not in only:
        continue
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write('# UNREVIEWED: hand\n=== %s\n%s' % (lid, m.group(2)))
        path = f.name
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'lint_draft.py'), '--file', path, lid],
                       capture_output=True, text=True, cwd=ROOT)
    os.unlink(path)
    print(r.stdout.strip())
    bad += (r.returncode != 0)
print('%d lesson(s) with problems' % bad)
sys.exit(1 if bad else 0)
