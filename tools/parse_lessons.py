#!/usr/bin/env python3
"""Compile the hand-written lesson scripts into .work/lessons/<course>.json.

  python3 tools/parse_lessons.py            # every .work/lessons-src/*.txt
  python3 tools/parse_lessons.py earth      # just earth.txt

Lessons are written as plain text because prose is what matters here, and a
JSON file makes every sentence fight with quotes and commas. The format:

  === earth-quakes                      one lesson (id from js/lessons.js)
  idea: One sentence shown on the lesson card before it opens.
  game: P wave = The push-pull wave that arrives first | Mica = Black flecks that peel | ...
                                       NAME on the left, what it IS on the right —
                                       never a name on both sides.

  --- 🌍                               one page (the emoji is its icon)
  --- 🐾 @lion                         a species page: the lion's photo is shown on it
  p: A warm paragraph. One thought. Short sentences.
  term: magnitude = What the word means, in plain language.
  fact: Something concrete and surprising.
  fact(The record): Same, with its own label instead of "Look at this".
  try: Something to do right now with what is at hand.
  check: A question about the page just read?
  - a wrong option
  + the right option
  - another wrong option
  hint: Shown after a wrong tap.
  explain: Shown after the right one.

A check belongs to the page it sits in and must come last on that page.

  quiz: A question for the end-of-lesson quiz?   (after the last page; same - / + options, then explain:)
Option order is kept exactly as written — vary where the + falls.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.work', 'lessons-src')
OUT = os.path.join(ROOT, '.work', 'lessons')

KEY = re.compile(r'^(p|term|fact(?:\([^)]*\))?|try|check|quiz|hint|explain|idea|game):\s*(.*)$')


def parse(path):
    lessons, L, page, chk, cont = {}, None, None, None, None
    name = os.path.basename(path)

    def err(n, msg):
        raise SystemExit(f'{name}:{n}: {msg}')

    def close_check(n):
        nonlocal chk
        if chk is None:
            return
        if sum(1 for o in chk['opts'] if o[0]) != 1:
            err(n, 'a check needs exactly one + option')
        q = {'type': 'choice', 'prompt': chk['prompt'],
             'options': [o[1] for o in chk['opts']],
             'answer': next(i for i, o in enumerate(chk['opts']) if o[0]),
             'hint': chk.get('hint', ''), 'explain': chk.get('explain', '')}
        if chk.get('quiz'):
            q.pop('hint')
            L.setdefault('quiz', []).append(q)
        else:
            page['blocks'].append({'t': 'check', 'q': q})
        chk = None

    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.rstrip('\n')
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if s.startswith('==='):
            cont = None
            close_check(n)
            L = {'idea': '', 'pages': [], 'game': {'pairs': []}}
            lid = s[3:].strip()
            if lid in lessons:
                err(n, f'duplicate lesson {lid}')
            lessons[lid] = L
            page = None
            continue
        if L is None:
            err(n, 'text before the first === line')
        if s.startswith('---'):
            cont = None
            close_check(n)
            head = s[3:].strip()
            m_img = re.match(r'^(\S+)\s+@(\S+)$', head)
            page = {'icon': m_img.group(1) if m_img else head, 'blocks': []}
            if m_img:
                page['img'] = m_img.group(2)
            L['pages'].append(page)
            continue
        if chk is not None and s[:2] in ('- ', '+ '):
            chk['opts'].append((s[0] == '+', s[2:].strip()))
            continue
        m = KEY.match(s)
        if not m:
            if cont is not None:              # a paragraph that wrapped onto a second line
                cont(s)
                continue
            err(n, f'cannot read this line: {s[:50]}')
        key, val = m.group(1), m.group(2).strip()
        cont = None
        if key == 'idea':
            L['idea'] = val
            cont = lambda t: L.__setitem__('idea', (L['idea'] + ' ' + t).strip())
        elif key == 'game':
            for part in val.split('|'):
                a, sep, b = part.partition('=')
                if not sep or not a.strip() or not b.strip():
                    err(n, f'game pair needs "left = right": {part}')
                L['game']['pairs'].append([a.strip(), b.strip()])
        elif key in ('hint', 'explain'):
            if chk is None:
                err(n, f'{key} outside a check')
            chk[key] = val
            cont = lambda t, k=key: chk.__setitem__(k, (chk[k] + ' ' + t).strip())
        elif key == 'quiz':
            close_check(n)
            if L is None or not L['pages']:
                err(n, 'quiz before the pages')
            page = None
            chk = {'prompt': val, 'opts': [], 'quiz': True}
            cont = lambda t: chk.__setitem__('prompt', (chk['prompt'] + ' ' + t).strip())
        else:
            if page is None:
                err(n, f'{key} before the first --- page')
            close_check(n)
            if key == 'check':
                chk = {'prompt': val, 'opts': []}
                cont = lambda t: chk.__setitem__('prompt', (chk['prompt'] + ' ' + t).strip())
            elif key == 'term':
                w, sep, t = val.partition('=')
                if not sep:
                    err(n, 'term needs "word = meaning"')
                tb = {'t': 'term', 'word': w.strip(), 'text': t.strip()}
                page['blocks'].append(tb)
                cont = lambda t, b=tb: b.__setitem__('text', (b['text'] + ' ' + t).strip())
            elif key.startswith('fact'):
                b = {'t': 'fact', 'text': val}
                lm = re.match(r'fact\(([^)]*)\)', key)
                if lm:
                    b['label'] = lm.group(1)
                page['blocks'].append(b)
                cont = lambda t, b=b: b.__setitem__('text', (b['text'] + ' ' + t).strip())
            else:
                pb = {'t': key, 'text': val}
                page['blocks'].append(pb)
                cont = lambda t, b=pb: b.__setitem__('text', (b['text'] + ' ' + t).strip())
        if chk is not None and key not in ('check', 'quiz', 'hint', 'explain'):
            err(n, 'a check must be the last thing on its page')
    close_check(n)
    return lessons


def emit_page(pg):
    """One page back to script text (a list of lines)."""
    out = [f"--- {pg['icon']}" + (f" @{pg['img']}" if pg.get('img') else '')]
    for b in pg['blocks']:
        if b['t'] == 'check':
            q = b['q']
            out.append(f"check: {q['prompt']}")
            out += [('+ ' if i == q['answer'] else '- ') + o for i, o in enumerate(q['options'])]
            out += [f"hint: {q['hint']}", f"explain: {q['explain']}"]
        elif b['t'] == 'term':
            out.append(f"term: {b['word']} = {b['text']}")
        elif b['t'] == 'fact':
            out.append(f"fact({b['label']}): {b['text']}" if b.get('label') else f"fact: {b['text']}")
        else:
            out.append(f"{b['t']}: {b['text']}")
    return out


def emit(lid, L):
    """The inverse of parse(): one lesson back to script text."""
    out = [f'=== {lid}', f"idea: {L['idea']}",
           'game: ' + ' | '.join(f'{a} = {b}' for a, b in L['game']['pairs']), '']
    for pg in L['pages']:
        out += emit_page(pg) + ['']
    for q in L.get('quiz', []):
        out.append(f"quiz: {q['prompt']}")
        out += [('+ ' if i == q['answer'] else '- ') + o for i, o in enumerate(q['options'])]
        out += [f"explain: {q['explain']}", '']
    return '\n'.join(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:]
    files = sorted(glob.glob(os.path.join(SRC, '*.txt')))
    if want:
        files = [f for f in files if os.path.basename(f)[:-4] in want]
    tot = 0
    longest = rightpos = 0
    for f in files:
        data = parse(f)
        for L in data.values():
            for pg in L['pages']:
                for b in pg['blocks']:
                    if b['t'] == 'check':
                        q = b['q']
                        tot += 1
                        longest += len(q['options'][q['answer']]) == max(map(len, q['options']))
        out = os.path.join(OUT, os.path.basename(f)[:-4] + '.json')
        json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{os.path.basename(f)}: {len(data)} lesson(s) -> {out}')
    if tot:
        print(f'{tot} checks; the right answer is the longest option in {longest} '
              f'({100 * longest // tot}%) — keep this near 25-40%')


if __name__ == '__main__':
    main()
