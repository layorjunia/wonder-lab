#!/usr/bin/env python3
"""Compact lesson writing. Reads .work/lessons-hand/<course>.dsl, writes .work/lessons-hand/<course>.txt

  @ <lesson id>
  idea: ...
  game: Name = clue | Name = clue | ...
  <icon> | p: sentence(s) | [p: second paragraph] | [term: word = definition] | fact: sentence(s) | [? question = right ~ wrong ~ wrong]
  close <icon> | p: ... | p: ...
  quiz: question = right ~ wrong ~ wrong => explanation

The converter adds the hint (paragraph or box, whichever holds the answer) and the explanation (the sentence
containing the answer). Then run sync_icons.py and lint_hand.py.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c = sys.argv[1]
src = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.dsl'), encoding='utf-8').read()
MARK = '# UNREVIEWED: written by hand (Claude) from sourced facts (each fact quotes its source), passed every automatic check, not yet read by a person (2026-10-13)'


def toks(s):
    return set(re.findall(r"[a-z0-9]+", s.lower().replace(',', '')))


def sentences(s):
    return [x.strip() for x in re.split(r'(?<=[.!?])\s+', s.strip()) if x.strip()]


def explain_for(right, texts):
    rt = toks(right)
    best, score = None, 0
    for t in texts:
        for s in sentences(t):
            sc = len(rt & toks(s))
            if sc > score:
                best, score = s, sc
    return best or right


out = []
for block in re.split(r'^@ ', src, flags=re.M)[1:]:
    lines = [l.rstrip() for l in block.split('\n')]
    lid = lines[0].strip()
    out.append(MARK)
    out.append('=== ' + lid)
    quiz = []
    for l in lines[1:]:
        if not l.strip() or l.startswith('#'):
            continue
        if l.startswith('idea:') or l.startswith('game:'):
            out.append(l)
            out.append('')
            continue
        if l.startswith('quiz:'):
            m = re.match(r'quiz:\s*(.*?)\s*=\s*(.*?)\s*=>\s*(.*)$', l)
            q, opts, ex = m.group(1), [o.strip() for o in m.group(2).split('~')], m.group(3).strip()
            quiz.append((q, opts, ex))
            continue
        parts = [x.strip() for x in l.split(' | ')]
        head = parts[0]
        if head.startswith('close'):
            out.append('--- ' + head.split(None, 1)[1].strip())
            for pr in parts[1:]:
                out.append(pr)
                out.append('')
            continue
        icon = head.split(None, 1)[1] if ' ' in head and head.split()[0].isdigit() else head
        out.append('--- ' + icon.strip())
        ps = [x[2:].strip() for x in parts[1:] if x.startswith('p:')]
        fact = next((x[5:].strip() for x in parts[1:] if x.startswith('fact:')), '')
        for pt in ps:
            out.append('p: ' + pt)
            out.append('')
        for x in parts[1:]:
            if x.startswith('term:'):
                out.append(x)
                out.append('')
        if fact:
            out.append('fact: ' + fact)
            out.append('')
        for x in parts[1:]:
            if x.startswith('?'):
                m = re.match(r'\?\s*(.*?)\s*=\s*(.*)$', x)
                q, opts = m.group(1), [o.strip() for o in m.group(2).split('~')]
                right = opts[0]
                where = 'paragraph' if toks(right) & toks(' '.join(ps)) else 'box'
                if where == 'paragraph' and len(ps) > 1:
                    where = 'first paragraph'
                # options: right is listed first here; the file keeps it second so it is not always on top
                order = [opts[1], opts[0]] + opts[2:]
                out.append('check: ' + q)
                for o in order:
                    out.append(('+ ' if o == right else '- ') + o)
                out.append('hint: Look at the %s. The answer is there.' % where)
                out.append('explain: ' + explain_for(right, ps + [fact]))
                out.append('')
    for q, opts, ex in quiz:
        right = opts[0]
        order = [opts[1], opts[0]] + opts[2:]
        out.append('quiz: ' + q)
        for o in order:
            out.append(('+ ' if o == right else '- ') + o)
        out.append('explain: ' + ex)
        out.append('')
open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('wrote', c)
