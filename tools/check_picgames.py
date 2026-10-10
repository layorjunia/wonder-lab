#!/usr/bin/env python3
"""Validate the designed picture games and make sure every picture has art.

    python3 tools/check_picgames.py            # check, add new emoji to the Fluent map, fetch art
    python3 tools/check_picgames.py --no-fetch

Reads .work/picgames/*.jsonl (one game per line, one line per lesson):
  {"id", "type": tapall|catch|sort, "title", "goal", "items": [{"icon","name","good"|"bin"}], "bins": [...]}
Checks the shape, then maps every emoji to a Microsoft Fluent Emoji folder name
(tools/fluent_map.json) and runs tools/fetch_fluent.py so the picture shows as
real art, never a system-emoji fallback.
"""
import glob
import json
import os
import re
import subprocess
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(ROOT, 'tools', 'fluent_map.json')


def lesson_ids():
    ids = set()
    for f in glob.glob(os.path.join(ROOT, '.work', 'lessons-src', '*.txt')):
        ids |= set(re.findall(r'(?m)^=== (\S+)', open(f, encoding='utf-8').read()))
    return ids


def fluent_names():
    cache = '/tmp/fluent-names.txt'
    if not os.path.exists(cache):
        out = subprocess.run(['gh', 'api', 'repos/microsoft/fluentui-emoji/git/trees/main?recursive=1', '--jq',
                              '.tree[] | select(.type=="tree") | .path'], capture_output=True, text=True).stdout
        names = sorted({p.split('/')[1] for p in out.split('\n') if p.startswith('assets/') and p.count('/') == 1})
        open(cache, 'w').write('\n'.join(names))
    return [l.rstrip('\n') for l in open(cache) if l.strip()]


def guess(e, low):
    base = [c for c in e if c not in '️']
    if len(base) != 1:
        return None
    try:
        n = unicodedata.name(base[0]).lower()
    except ValueError:
        return None
    tries = [n, re.sub(r' face$', '', n), n.replace(' symbol', ''), re.sub(r'^large ', '', n),
             re.sub(r' button$', '', n), n.replace('black ', ''), n.replace('white ', '')]
    return next((low[t] for t in tries if t in low), None)


def main():
    games = {}
    problems = []
    for f in sorted(glob.glob(os.path.join(ROOT, '.work', 'picgames', '*.jsonl')), key=lambda x: ('fixes' in x, x)):
        for n, line in enumerate(open(f, encoding='utf-8'), 1):
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except Exception as e:
                problems.append(f'{os.path.basename(f)}:{n} not JSON ({e})')
                continue
            games[d.get('id')] = d
    ids = lesson_ids()
    emoji = set()
    for lid, d in games.items():
        w = f'{lid}:'
        if lid not in ids:
            problems.append(f'{w} no such lesson')
        t = d.get('type')
        items = d.get('items') or []
        if t not in ('tapall', 'catch', 'sort'):
            problems.append(f'{w} unknown type {t!r}')
        if not 6 <= len(items) <= 9:
            problems.append(f'{w} {len(items)} items (want 6-9)')
        if len((d.get('goal') or '').split()) > 12 or not d.get('goal'):
            problems.append(f'{w} goal missing or too long')
        icons = [i.get('icon') for i in items]
        if len(set(icons)) != len(icons):
            problems.append(f'{w} repeated picture')
        for it in items:
            if not it.get('name') or len(it['name'].split()) > 3 or re.search(r'\d', it['name']):
                problems.append(f'{w} bad item name {it.get("name")!r}')
            emoji.add(it.get('icon'))
        if t in ('tapall', 'catch'):
            good = sum(1 for i in items if i.get('good'))
            if not 3 <= good <= 5 or good >= len(items) - 1:
                problems.append(f'{w} {good} right pictures of {len(items)}')
        if t == 'sort':
            bins = d.get('bins') or []
            if len(bins) != 2 or not all(b.get('label') and b.get('icon') for b in bins):
                problems.append(f'{w} sort needs two boxes with icon and label')
            else:
                counts = [sum(1 for i in items if i.get('bin') == k) for k in (0, 1)]
                if min(counts) < 2:
                    problems.append(f'{w} sort items split {counts}')
                emoji |= {b['icon'] for b in bins}
    print(f'{len(games)} picture game(s) checked, {len(problems)} problem(s)')
    for p in problems:
        print('  ' + p)
    # art for every picture
    m = json.load(open(MAP, encoding='utf-8'))
    have = {k.replace('️', '') for k in m}
    low = {n.lower(): n for n in fluent_names()}
    added, missing = [], []
    for e in sorted(x for x in emoji if x):
        if e.replace('️', '') in have:
            continue
        name = guess(e, low)
        if name:
            m[e] = name
            added.append(e)
        else:
            missing.append(e)
    if added:
        json.dump(m, open(MAP, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'{len(added)} new picture(s) mapped: {" ".join(added)}')
    if missing:
        print(f'NO ART NAME for: {" ".join(missing)}  (use another picture)')
    if added and '--no-fetch' not in sys.argv:
        print(subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'fetch_fluent.py')],
                             capture_output=True, text=True).stdout.strip())
    return 1 if problems or missing else 0


if __name__ == '__main__':
    sys.exit(main())
