#!/usr/bin/env python3
"""Run every lesson check on a hand-written draft, page by page, the way the drafting tool does.

    python3 tools/lint_draft.py animals-insects-4 [more ids]
    python3 tools/lint_draft.py --file path/to/draft.txt animals-insects-4

Reads .work/lessons-draft/<id>.txt (or --file), parses it, then applies the page-level
rules from draft_pages.page_problems (reading level, answer not longer than the wrong
ones, hint points at the right block, closing page uses only words already used...) and
the whole-lesson gate in check_lessons. Prints every problem; exit 0 means clean.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import check_lessons as C          # noqa: E402
import draft_lessons as D          # noqa: E402
import draft_pages as DP           # noqa: E402
import parse_lessons as P          # noqa: E402


def lint(lid, path):
    src, plans = D.load_sources(), D.load_plans()
    if lid not in src or lid not in plans:
        return [f'{lid}: no source facts or plan'], None
    entry, plan = src[lid], plans[lid]
    species = D.is_species(lid)
    _hook, specs = DP.parse_plan(plan)
    try:
        L = P.parse(path)[lid]
    except SystemExit as e:
        return [f'unreadable: {e}'], None
    L.setdefault('quiz', [])
    probs = []
    if len(L['pages']) != len(specs):
        probs.append(f'the plan has {len(specs)} pages, the draft has {len(L["pages"])}')
    src_text = C.source_text().get(lid, '')
    names = DP.species_names(entry, specs) if species else None
    so_far = ''
    for i, (spec, pg) in enumerate(zip(specs, L['pages']), 1):
        facts = DP.page_facts(entry, spec, species)
        spec = dict(spec, title=entry['title'])
        for p in DP.page_problems(lid, spec, pg, src_text + ' ' + facts, i, facts, so_far, names):
            # the plan's Q/TERM markers steer a model; a person may add a check where the lesson needs 3
            if p.startswith(('this page must NOT have a check', 'this page needs a check')):
                continue
            probs.append(f'page {i}: {p}')
        so_far += ' ' + ' '.join(b.get('text', '') for b in pg['blocks'])
    final = []
    C.check(lid, L, final, src_text)
    probs += [p.split(': ', 1)[1] if ': ' in p else p for p in final]
    return probs, L


def main():
    args = sys.argv[1:]
    path = None
    if '--file' in args:
        k = args.index('--file')
        path = args[k + 1]
        del args[k:k + 2]
    bad = 0
    for lid in args:
        p = path or os.path.join(D.DRAFTS, lid + '.txt')
        probs, _ = lint(lid, p)
        print(f'{lid}: {len(probs)} problem(s)')
        for x in sorted(set(probs)):
            print('   -', x)
        bad += bool(probs)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
