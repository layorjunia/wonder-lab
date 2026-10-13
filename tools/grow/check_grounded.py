#!/usr/bin/env python3
"""Flag words in a hand-written lesson's paragraphs, fact boxes, terms and explanations that are NOT in the
sourced facts the lesson was planned from. A reading aid for the person (me) checking for invented claims.

  python3 tools/grow/check_grounded.py physical            # every lesson
  python3 tools/grow/check_grounded.py physical machines   # one section

The lesson's plan block (.work/lessons-plan/<course>-g1.txt) is the sourced text. Wrong answer options are
skipped (distractors are not claims). Words are compared by a crude stem.
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
c, only = sys.argv[1], set(sys.argv[2:])
STOP = set('a an the and or but if so as at by for from in into of on onto to up with without is are was were be been '
           'it its this that these those there here they them their he she his her we you your i not no yes can could '
           'will would may might must do does did has have had how what when where which who why more most some any '
           'all each every other another one two than then very also just only about over under out off again once '
           'many much such own same too both few like look box paragraph answer'.split())

def stem(w):
    w = w.lower()
    for suf in ('ing', 'ed', 'es', 's', 'ly', 'er', 'est'):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[:-len(suf)]
    return w

def words(t):
    return [w for w in re.findall(r"[A-Za-z][A-Za-z'’-]+", t)]

plan = open(os.path.join(ROOT, '.work', 'lessons-plan', c + '-g1.txt'), encoding='utf-8').read()
plans = {}
for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^=== |\Z)', plan, re.S | re.M):
    body = re.sub(r'\b(TERM|Q)\b.*?(?=\s(?:TERM|Q)\b|$)', ' ', m.group(2), flags=re.M)
    body = re.sub(r'^hook:.*$', '', body, flags=re.M)
    plans[m.group(1)] = body
hand = open(os.path.join(ROOT, '.work', 'lessons-hand', c + '.txt'), encoding='utf-8').read()
flagged = 0
for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^# UNREVIEWED|^=== |\Z)', hand, re.S | re.M):
    lid, body = m.group(1), m.group(2)
    if only and lid.split('-', 1)[1] not in only:
        continue
    allowed = {stem(w) for w in words(plans.get(lid, ''))}
    page = 0
    out = []
    for line in body.split('\n'):
        if line.startswith('--- '):
            page += 1
        mm = re.match(r'^(p|fact|term|explain|hint):\s*(.*)$', line)
        if not mm or mm.group(1) == 'hint':
            continue
        txt = mm.group(2)
        if mm.group(1) == 'term':
            txt = txt.split('=', 1)[-1]
        miss = []
        for w in words(txt):
            if w.lower() in STOP or len(w) < 4:
                continue
            if stem(w) not in allowed and w.lower() not in miss:
                miss.append(w.lower())
        if miss:
            out.append('  page %d %-7s %s' % (page, mm.group(1), ', '.join(miss)))
    # idea / game lines
    for key in ('idea', 'game'):
        for line in body.split('\n'):
            if line.startswith(key + ':'):
                miss = []
                for w in words(line.split(':', 1)[1]):
                    if w.lower() in STOP or len(w) < 4:
                        continue
                    if stem(w) not in allowed and w.lower() not in miss:
                        miss.append(w.lower())
                if miss:
                    out.append('  %-12s %s' % (key, ', '.join(miss)))
    print('%s: %s' % (lid, 'ok' if not out else ''))
    for o in out:
        print(o)
    flagged += bool(out)
print('%d lesson(s) with words outside the sourced facts' % flagged)
