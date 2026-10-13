#!/usr/bin/env python3
"""Print the best single sentences of each saved source, for writing facts from.
   python3 tools/grow/show_sentences.py physical machines air [--n 12]
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
N = 12
if '--n' in sys.argv:
    N = int(sys.argv[sys.argv.index('--n') + 1]); args = [a for a in args if a != str(N)]
course, only = args[0], set(args[1:])
BAD = re.compile(r'\b(BC|BCE|AD|CE|million years|billion years|Ma\b|\\displaystyle|prehistoric|Neolithic|evolv|extinct)', re.I)
UNIT = re.compile(r'\b(ft|feet|mi|miles|mph|km|kg|lb|pounds|inches|in|cm|m|°F|°C|%|percent|tons|gallons|minutes|hours|days|years)\b')
BIG = re.compile(r'\b(largest|tallest|first|only|most|fastest|longest|biggest|smallest|highest|deepest|hottest|coldest|oldest|never|every|more than|over|nearly|about)\b', re.I)
def sents(text):
    out = []
    for para in text.split('\n'):
        para = para.strip()
        if len(para) < 40: continue
        for s in re.split(r'(?<=[.!?])\s+(?=[A-Z"“])', para):
            out.append(s.strip())
    return out
d = os.path.join(ROOT, '.work', 'grow', 'sources')
for fn in sorted(os.listdir(d)):
    if not fn.startswith(course + '-'): continue
    sec = json.load(open(os.path.join(d, fn), encoding='utf-8'))
    if only and sec['id'] not in only: continue
    print('\n######## %s-%s  %s %s  | FOCUS: %s' % (sec['course'], sec['id'], sec['glyph'], sec['name'], sec['angle']))
    for i, s in enumerate(sec['sources'], 1):
        ss = sents(s['text'])
        scored = []
        for k, t in enumerate(ss):
            w = len(t.split())
            if w < 7 or w > 38 or BAD.search(t): continue
            sc = (1.0 if re.search(r'\d', t) else 0) + 0.4 * len(UNIT.findall(t)) + 0.5 * len(BIG.findall(t)) + (0.6 if k < 6 else 0)
            sc -= 0.3 * t.count('(') + (0.5 if re.search(r'[^\x00-\x7F]{2,}', t) else 0)
            scored.append((sc, k, t))
        top = sorted(sorted(scored, reverse=True)[:N], key=lambda x: x[1])
        print('--- S%d %s' % (i, s['title']))
        for _, k, t in top: print('  *', t)
