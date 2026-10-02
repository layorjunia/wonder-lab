#!/usr/bin/env python3
"""Merge the agent-written lesson intros/reorderings into a tracked curation
file, after validating them against the rules the brief actually asked for.

  .venv-tts/bin/python tools/apply_lesson_intros.py

Reads .work/rw/intros-batch-*.json (one object per file, lesson id -> {intro,
order}), validates each against .work/lesson-export.json (the source of
truth for which fact ids a lesson actually has), and writes the validated
result to .work/lesson-curation.json — a tracked content source, same
status as .work/entries-*.json. tools/build_lessons.py merges it into
js/lessons.js on every rebuild, so it survives a lesson-set regeneration
instead of being baked into generated output and lost.
"""
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT = os.path.join(ROOT, '.work', 'lesson-export.json')
CURATION = os.path.join(ROOT, '.work', 'lesson-curation.json')

BANNED = [
    (re.compile(r'\bwow\b', re.I), 'fake enthusiasm'),
    (re.compile(r'did you know', re.I), 'cliche opener'),
    (re.compile(r'\bthis (lesson|app|section)\b', re.I), 'meta commentary'),
    (re.compile(r'\bwonder lab\b', re.I), 'meta commentary'),
    (re.compile(r'\?\s*$', re.M), 'rhetorical question'),
    (re.compile(r'\bevolut|\bmillions of years|\bprehistoric\b', re.I), 'editorial — deep time'),
]


def main():
    source = json.load(open(EXPORT, encoding='utf-8'))
    curation = {}
    problems = []

    for path in sorted(glob.glob(os.path.join(ROOT, '.work', 'rw', 'intros-batch-*.json'))):
        batch = json.load(open(path, encoding='utf-8'))
        for lid, rec in batch.items():
            if lid not in source:
                problems.append(f'{path}: {lid} is not a real lesson id')
                continue
            intro = (rec.get('intro') or '').strip()
            order = rec.get('order') or []
            want_ids = {f['id'] for f in source[lid]['facts']}
            got_ids = set(order)

            if not intro:
                problems.append(f'{lid}: empty intro')
            n = len(intro.split())
            if not (20 <= n <= 110):
                problems.append(f'{lid}: intro is {n} words (want ~40-70)')
            for rx, label in BANNED:
                if rx.search(intro):
                    problems.append(f'{lid}: EDITORIAL — {label} in intro')
            if got_ids != want_ids:
                missing = want_ids - got_ids
                extra = got_ids - want_ids
                problems.append(f'{lid}: order mismatch'
                                 + (f' missing {sorted(missing)}' if missing else '')
                                 + (f' extra {sorted(extra)}' if extra else ''))
            if len(order) != len(set(order)):
                problems.append(f'{lid}: order has duplicate ids')

            if lid not in problems and want_ids == got_ids and intro:
                curation[lid] = {'intro': intro, 'order': order}

    missing_lessons = sorted(set(source) - set(curation))
    if missing_lessons:
        print(f'{len(missing_lessons)} lesson(s) with no usable curation '
              f'(kept without an intro — see problems below):')
        for lid in missing_lessons[:20]:
            print('  ' + lid)

    if problems:
        print(f'\n{len(problems)} problem(s):')
        for p in problems[:60]:
            print('  ' + p)

    with open(CURATION, 'w', encoding='utf-8') as f:
        json.dump(curation, f, indent=1, ensure_ascii=False)
    print(f'\nwrote {len(curation)} curated lesson(s) -> {CURATION}')
    return 1 if problems and len(curation) < len(source) * 0.8 else 0


if __name__ == '__main__':
    raise SystemExit(main())
