#!/usr/bin/env python3
"""Rewrite question prompts in .work/lessons-src/<course>.txt so each stands alone, and balance where the right answer sits.

  python3 tools/grow/apply_prompt_fixes.py body            # applies .work/prompt-fixes/body.json, then balances slots
  python3 tools/grow/apply_prompt_fixes.py body --no-balance

.work/prompt-fixes/<course>.json:  {"<lesson id>|<page number>": "new prompt", "<lesson id>|q2": "new prompt"}
Page numbers count every '--- ' page in the lesson (1-based); q<N> is the Nth quiz question.
Only lessons NOT written in DSL v2 are balanced (v2 lessons were balanced when converted).
"""
import json, os, re, sys, zlib
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
course = sys.argv[1]
balance = '--no-balance' not in sys.argv
src = os.path.join(ROOT, '.work', 'lessons-src', course + '.txt')
fx_path = os.path.join(ROOT, '.work', 'prompt-fixes', course + '.json')
fixes = json.load(open(fx_path, encoding='utf-8')) if os.path.exists(fx_path) else {}
dsl = os.path.join(ROOT, '.work', 'lessons-hand', course + '.dsl')
v2 = set(re.findall(r'^@ (\S+)', open(dsl, encoding='utf-8').read(), re.M)) if os.path.exists(dsl) else set()
text = open(src, encoding='utf-8').read()
lines = text.split('\n')
out = []
lid = None
page = 0
qn = 0
used = set()
# collect question groups so options can be rewritten: a question = 'check:'/'quiz:' line followed by option lines '+ ' / '- '
i = 0
slots_state = {}
def slot_seq(lesson, n):
    """a deterministic, balanced-in-blocks sequence of target slots for a lesson's n questions"""
    import random
    rnd = random.Random(zlib.crc32(lesson.encode()))
    seq, last = [], None
    while len(seq) < n:
        blk = [0, 1, 2]
        rnd.shuffle(blk)
        if blk[0] == last:
            blk.append(blk.pop(0))
        seq += blk
        last = blk[-1]
    return seq[:n]
# first pass: count questions per lesson
qcount = {}
cur = None
for ln in lines:
    m = re.match(r'=== (\S+)', ln)
    if m:
        cur = m.group(1); qcount[cur] = 0
    elif cur and re.match(r'(check|quiz):', ln):
        qcount[cur] += 1
seqs = {}
cur = None
qi = 0
while i < len(lines):
    ln = lines[i]
    m = re.match(r'=== (\S+)', ln)
    if m:
        lid = m.group(1); page = 0; qn = 0; qi = 0
        seqs[lid] = slot_seq(lid, qcount.get(lid, 0))
    if ln.startswith('--- '):
        page += 1
    mm = re.match(r'(check|quiz):\s*(.*)', ln)
    if mm and lid:
        kind = mm.group(1)
        if kind == 'quiz':
            qn += 1
            key = '%s|q%d' % (lid, qn)
        else:
            key = '%s|%d' % (lid, page)
        newp = fixes.get(key)
        if newp:
            used.add(key)
            ln = '%s: %s' % (kind, newp)
        # collect option lines
        j = i + 1
        opts = []
        while j < len(lines) and re.match(r'[+-] ', lines[j]):
            opts.append(lines[j]); j += 1
        out.append(ln)
        if balance and lid not in v2 and 2 <= len(opts) <= 4:
            txt = ' '.join(o[2:].lower() for o in opts)
            if not re.search(r'\b(both|all of|none of|neither|the same|either)\b', txt):
                right = next(k for k, o in enumerate(opts) if o.startswith('+ '))
                target = seqs[lid][qi] % len(opts)
                if right != target:
                    o2 = opts[:]
                    r = o2.pop(right)
                    o2.insert(target, r)
                    opts = o2
        qi += 1
        out.extend(opts)
        i = j
        continue
    out.append(ln)
    i += 1
missing = [k for k in fixes if k not in used]
open(src, 'w', encoding='utf-8').write('\n'.join(out))
print('%s: applied %d prompt fix(es)%s' % (course, len(used), (', NOT FOUND: %s' % missing) if missing else ''))
