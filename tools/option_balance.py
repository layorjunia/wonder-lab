#!/usr/bin/env python3
"""Find questions whose right answer is easy to guess by length, and apply rewrites.

A child learns fast that "the long one is right". In the shipped lessons the
right option was the longest of its options 61% of the time (chance is 33%), and
more than 30% longer than every wrong option in 41% of questions.

    python3 tools/option_balance.py export  > .work/balance-in.json
    # ...someone rewrites the WRONG options so they match the right one in length
    # and specificity (still clearly wrong, never true), writes balance-out.json
    python3 tools/option_balance.py apply .work/balance-out.json [--write]
    python3 tools/option_balance.py stats

Keys are "<lesson>||<question>||<right answer>" (stable when lines move). The right option is never
touched; only wrong (`-`) options are replaced, in place.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.work', 'lessons-src')
RATIO = 1.15          # right longer than the longest wrong option by this much => rewrite


def questions():
    """Yield dicts for every check/quiz with +/- options."""
    for path in sorted(glob.glob(os.path.join(SRC, '*.txt'))):
        base = os.path.basename(path)
        lines = open(path, encoding='utf-8').read().split('\n')
        lesson = None
        i = 0
        while i < len(lines):
            l = lines[i]
            m = re.match(r'^=== (\S+)', l)
            if m:
                lesson = m.group(1)
            m = re.match(r'^(check|quiz):\s*(.*)$', l)
            if m and lesson:
                j = i + 1
                opts = []
                hint = explain = ''
                while j < len(lines) and re.match(r'^(?:[-+] |hint:|explain:|check:|quiz:|--- |=== |p:|term:|fact|try:|idea:|game:|#|$)', lines[j]):
                    if re.match(r'^[-+] ', lines[j]):
                        opts.append((j, lines[j][0], lines[j][2:]))
                    elif lines[j].startswith('hint:'):
                        hint = lines[j][5:].strip()
                    elif lines[j].startswith('explain:'):
                        explain = lines[j][8:].strip()
                    else:
                        break
                    j += 1
                if opts:
                    rt = next((o[2] for o in opts if o[1] == '+'), '')
                    yield {'key': f'{lesson}||{m.group(2).strip()}||{rt}', 'file': path, 'lesson': lesson,
                           'kind': m.group(1), 'prompt': m.group(2).strip(), 'opts': opts,
                           'hint': hint, 'explain': explain}
                i = j
                continue
            i += 1


def needs_fix(q):
    right = [o for o in q['opts'] if o[1] == '+']
    wrong = [o for o in q['opts'] if o[1] == '-']
    if len(right) != 1 or len(wrong) < 2:
        return False
    r = len(right[0][2])
    w = max(len(o[2]) for o in wrong)
    return r >= 18 and r > w * RATIO


def cmd_export():
    out = []
    for q in questions():
        if not needs_fix(q):
            continue
        right = next(o[2] for o in q['opts'] if o[1] == '+')
        out.append({'key': q['key'], 'lesson': q['lesson'], 'question': q['prompt'],
                    'right': right, 'wrong': [o[2] for o in q['opts'] if o[1] == '-'],
                    'explain': q['explain'], 'hint': q['hint']})
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    print(f'{len(out)} question(s) to rebalance', file=sys.stderr)


def cmd_stats():
    n = lg = big = 0
    for q in questions():
        right = [o for o in q['opts'] if o[1] == '+']
        wrong = [o for o in q['opts'] if o[1] == '-']
        if len(right) != 1 or len(wrong) < 2:
            continue
        n += 1
        r = len(right[0][2]); w = max(len(o[2]) for o in wrong)
        lg += r > w
        big += r > w * 1.3
    print(f'{n} questions; right is longest in {lg} ({100 * lg // max(n, 1)}%); '
          f'more than 30% longer than every wrong option in {big} ({100 * big // max(n, 1)}%)')


def cmd_apply(path, write):
    new = json.load(open(path, encoding='utf-8'))
    byfile = {}
    bad = 0
    qs = {q['key']: q for q in questions()}
    for key, wrongs in new.items() if isinstance(new, dict) else [(x['key'], x['wrong']) for x in new]:
        q = qs.get(key)
        if not q:
            print('no such question', key); bad += 1; continue
        slots = [o for o in q['opts'] if o[1] == '-']
        if len(wrongs) != len(slots):
            print('wrong option count differs', key); bad += 1; continue
        right = next(o[2] for o in q['opts'] if o[1] == '+')
        for (ln, _, old), txt in zip(slots, wrongs):
            txt = txt.strip()
            if not txt or txt == right or any(txt == w for w in wrongs if w is not txt and wrongs.count(txt) > 1):
                print('unusable option', key, repr(txt)); bad += 1
                break
        else:
            for (ln, _, old), txt in zip(slots, wrongs):
                byfile.setdefault(q['file'], {})[ln] = '- ' + txt.strip()
    for f, edits in byfile.items():
        lines = open(f, encoding='utf-8').read().split('\n')
        for ln, text in edits.items():
            lines[ln] = text
        if write:
            open(f, 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'{sum(len(e) for e in byfile.values())} option(s) rewritten in {len(byfile)} file(s)'
          f'{" (written)" if write else " (dry run)"}; {bad} problem(s)')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'stats':
        cmd_stats()
    elif a[0] == 'export':
        cmd_export()
    elif a[0] == 'apply':
        cmd_apply(a[1], '--write' in a)
