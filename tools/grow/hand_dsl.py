#!/usr/bin/env python3
"""Compact lesson writing (v2). Reads .work/lessons-hand/<course>.dsl, writes .work/lessons-hand/<course>.txt

  @ <lesson id>
  idea: ...
  game: Name = clue (4+ words) | Name = clue | ...
  <n> <icon> | p: sentence(s) | [p: more] | [term: word = definition] | [fact(Label): sentence(s)]
              | [? question = right ~ wrong ~ wrong] | [hint: ...] | [why: ...]
  close <icon> | p: ... | p: ...
  quiz: question = right ~ wrong ~ wrong => explanation

Page rules this converter relies on (they are what a child actually sees):
  * p     the page's idea, complete on its own — never a teaser that the box has to finish.
  * fact  a "look at this" callout with its OWN label ("The four needs") and sentences that name
          their subject (no "It/They/He" opening). Optional: a page may be a paragraph alone.
  * ?     the question must make sense with NO page in front of it — the games and the boss battle
          show it alone — so never "the example" or "this".
  * the right answer is placed in slot 1, 2 or 3 in a shuffled-but-balanced order (never always 2nd).
  * hint  says where to look AND what to look for. why: is the explanation read after the answer.
"""
import os, random, re, sys, zlib
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c = sys.argv[1]
src = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.dsl'), encoding='utf-8').read()
MARK = '# UNREVIEWED: written by hand (Claude) from sourced facts (each fact quotes its source), passed every automatic check, not yet read by a person (2026-10-14)'
STOP = set('a an the and or but if so as at by for from in into of on to with is are was were be it its this that these those '
           'they them their he she his her we you your i not no what who when where why how which do does did can could will would '
           'there here more most some any all each every than then also just only about over one two'.split())


def toks(s):
    return set(re.findall(r"[a-z0-9]+", s.lower().replace(',', '')))


def words(s):
    return re.findall(r"[A-Za-z0-9$%'’-]+", s)


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


def hint_for(q, where, texts):
    """'Look at the paragraph. Find where it says "textbooks list".' — a place AND a thing to find."""
    body = ' '.join(texts).lower()
    qw = [w for w in words(q.rstrip('?')) if w]
    best = ''
    for n in range(min(5, len(qw)), 1, -1):
        for i in range(0, len(qw) - n + 1):
            seg = qw[i:i + n]
            if all(w.lower() in STOP for w in seg):
                continue
            ph = ' '.join(seg).lower()
            if ph in body and len(ph) > len(best):
                best = ph
        if best:
            break
    if not best:
        cand = [w for w in qw if w.lower() not in STOP and len(w) > 3 and w.lower() in body]
        best = max(cand, key=len).lower() if cand else ''
    place = 'the ' + where
    return ('Look at %s. Find where it says "%s".' % (place, best)) if best else ('Look at %s. The answer is there.' % place)


def slots(lid, n):
    """Balanced, non-repeating slots 0/1/2 for the n questions of one lesson, seeded by its id."""
    r = random.Random(zlib.crc32(lid.encode()))
    out, last = [], None
    while len(out) < n:
        blk = [0, 1, 2]
        r.shuffle(blk)
        if blk[0] == last:
            blk.append(blk.pop(0))
        out.extend(blk)
        last = out[-1]
    return out[:n]


def place(opts, slot):
    right, wrong = opts[0], opts[1:]
    wrong = wrong[:2]
    out = wrong[:]
    out.insert(min(slot, len(out)), right)
    return out


out = []
for block in re.split(r'^@ ', src, flags=re.M)[1:]:
    lines = [l.rstrip() for l in block.split('\n')]
    lid = lines[0].strip()
    nq = sum(1 for l in lines[1:] if re.match(r'^\d ', l) and ' ? ' in l.replace('| ?', ' ? ')) + sum(1 for l in lines[1:] if l.startswith('quiz:'))
    sl = slots(lid, nq + 2)
    qi = 0
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
        fm = next((re.match(r'^fact(?:\(([^)]*)\))?:\s*(.*)$', x) for x in parts[1:] if x.startswith('fact')), None)
        fact, label = (fm.group(2).strip(), (fm.group(1) or '').strip()) if fm else ('', '')
        for pt in ps:
            out.append('p: ' + pt)
            out.append('')
        for x in parts[1:]:
            if x.startswith('term:'):
                out.append(x)
                out.append('')
        if fact:
            out.append(('fact(%s): ' % label if label else 'fact: ') + fact)
            out.append('')
        term_text = ' '.join(x[5:] for x in parts[1:] if x.startswith('term:'))
        for x in parts[1:]:
            if x.startswith('?'):
                m = re.match(r'\?\s*(.*?)\s*=\s*(.*)$', x)
                q, opts = m.group(1), [o.strip() for o in m.group(2).split('~')]
                right = opts[0]
                texts = ps + ([term_text] if term_text else []) + ([fact] if fact else [])
                inp = toks(right) & toks(' '.join(ps))
                inf = toks(right) & toks(fact + ' ' + term_text)
                where = 'paragraph' if inp and len(inp) >= len(inf) else 'box'
                if where == 'paragraph' and len(ps) > 1:
                    where = 'first paragraph'
                hint = next((y[5:].strip() for y in parts[1:] if y.startswith('hint:')), '') or hint_for(q, where, texts)
                why = next((y[4:].strip() for y in parts[1:] if y.startswith('why:')), '') or explain_for(right, ps + [fact])
                order = place(opts, sl[qi % len(sl)]); qi += 1
                out.append('check: ' + q)
                for o in order:
                    out.append(('+ ' if o == right else '- ') + o)
                out.append('hint: ' + hint)
                out.append('explain: ' + why)
                out.append('')
    for q, opts, ex in quiz:
        right = opts[0]
        order = place(opts, sl[qi % len(sl)]); qi += 1
        out.append('quiz: ' + q)
        for o in order:
            out.append(('+ ' if o == right else '- ') + o)
        out.append('explain: ' + ex)
        out.append('')
open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('wrote', c)
