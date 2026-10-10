#!/usr/bin/env python3
"""Move REVIEWED drafts into the lessons that ship.

  python3 tools/promote_lessons.py earth-volcanoes earth-water
  python3 tools/promote_lessons.py --course earth        # every draft of a course

A draft (.work/lessons-draft/<id>.txt) is whatever the local model wrote, edited
by hand. Promotion appends it to .work/lessons-src/<course>.txt and files the
draft away in .work/lessons-draft/approved/. It refuses a draft that fails
tools/check_lessons.py, so nothing unreviewed-and-broken can ship.
"""
import glob
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import check_lessons as C          # noqa: E402
import parse_lessons as P          # noqa: E402

DRAFTS = os.path.join(ROOT, '.work', 'lessons-draft')
SRC = os.path.join(ROOT, '.work', 'lessons-src')


def main():
    args = sys.argv[1:]
    ids = []
    if args[:1] == ['--course']:
        ids = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(DRAFTS, args[1] + '-*.txt')))
    else:
        ids = args
    srcs = C.source_text()
    done = 0
    for lid in ids:
        path = os.path.join(DRAFTS, lid + '.txt')
        if not os.path.exists(path):
            print(f'{lid}: no draft'); continue
        d = P.parse(path)
        L = d[lid]
        L.setdefault('quiz', [])
        probs = []
        C.check(lid, L, probs, srcs.get(lid))
        if probs:
            print(f'{lid}: NOT promoted, {len(probs)} problem(s):')
            for p in probs[:8]:
                print('   ', p)
            continue
        course = lid.split('-')[0]
        out = os.path.join(SRC, course + '.txt')
        existing = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
        if re.search(r'^=== ' + re.escape(lid) + r'$', existing, re.M):
            print(f'{lid}: already in {course}.txt'); continue
        body = open(path, encoding='utf-8').read().strip() + '\n'
        with open(out, 'a', encoding='utf-8') as f:
            f.write(('\n' if existing and not existing.endswith('\n\n') else '') + body + '\n')
        os.makedirs(os.path.join(DRAFTS, 'approved'), exist_ok=True)
        shutil.move(path, os.path.join(DRAFTS, 'approved', lid + '.txt'))
        pr = os.path.join(DRAFTS, lid + '.problems')
        if os.path.exists(pr):
            os.unlink(pr)
        print(f'{lid}: promoted into {course}.txt')
        done += 1
    print(f'{done} promoted')


if __name__ == '__main__':
    main()
