#!/usr/bin/env python3
"""Page-format audit over every parsed lesson (.work/lessons/*.json).

  python3 tools/grow/format_audit.py            # summary per course
  python3 tools/grow/format_audit.py -v utah    # list the pages

Checks the things a child actually runs into on a page:
  pos      where the right answer sits (must not always be the same slot)
  dangle   a callout/explanation that starts with It/They/He/... with no noun
  tease    a paragraph that announces something ("list three jobs") or is a 1-4 word lead-in
  thin     a paragraph of 5 words or fewer
  dupe     the callout repeats the paragraph
  hint     a hint that only says where to look
"""
import glob, json, os, re, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = [a for a in sys.argv[1:] if not a.startswith('-')]
verbose = '-v' in sys.argv
PRON = re.compile(r"^(it|they|he|she|its|their|his|her|these|those|this|that|them|then|so|but|and|also|both)\b", re.I)
TEASE = re.compile(r"\b(list|lists|listed)\b.*\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\b|\bthe following\b|\bhere (are|is)\b|^(meet|now meet|think about|look at|next,|say)\b", re.I)
GENERIC_HINT = re.compile(r"^look at the (paragraph|box|first paragraph|word box)\.\s*the answer is there\.?$", re.I)
words = lambda s: re.findall(r"[A-Za-z0-9']+", s)
rows = collections.defaultdict(lambda: collections.Counter())
bad = collections.defaultdict(list)
pos_all = collections.defaultdict(collections.Counter)
for f in sorted(glob.glob(os.path.join(ROOT, '.work', 'lessons', '*.json'))):
    course = os.path.basename(f)[:-5]
    if args and course not in args:
        continue
    data = json.load(open(f, encoding='utf-8'))
    for lid, L in data.items():
        for i, pg in enumerate(L.get('pages', []), 1):
            ps = [b for b in pg['blocks'] if b['t'] == 'p']
            fs = [b for b in pg['blocks'] if b['t'] == 'fact']
            for b in fs:
                if PRON.match(b['text']):
                    bad['dangle'].append((course, lid, i, 'F: ' + b['text'][:90]))
                    rows[course]['dangle'] += 1
            for b in ps[:1]:
                n = len(words(b['text']))
                if TEASE.search(b['text']) or (n <= 4 and fs):
                    bad['tease'].append((course, lid, i, 'P: ' + b['text'][:90]))
                    rows[course]['tease'] += 1
                if n <= 5:
                    rows[course]['thin'] += 1
                if fs and set(w.lower() for w in words(fs[0]['text'])) <= set(w.lower() for w in words(b['text'])):
                    bad['dupe'].append((course, lid, i, 'F: ' + fs[0]['text'][:90]))
                    rows[course]['dupe'] += 1
            for b in pg['blocks']:
                if b['t'] == 'check':
                    q = b['q']
                    pos_all[course][q['answer']] += 1
                    if GENERIC_HINT.match(q.get('hint', '')):
                        rows[course]['hint'] += 1
                    if PRON.match(q.get('explain', '')):
                        bad['dangle'].append((course, lid, i, 'E: ' + q['explain'][:90]))
                        rows[course]['dangle'] += 1
        for q in L.get('quiz', []):
            pos_all[course][q['answer']] += 1
            if PRON.match(q.get('explain', '')):
                bad['dangle'].append((course, lid, 'quiz', 'E: ' + q['explain'][:90]))
                rows[course]['dangle'] += 1
print('%-10s %6s %6s %6s %6s %6s   right answer in slot 1/2/3' % ('course', 'dangle', 'tease', 'thin', 'dupe', 'hint'))
for c in sorted(pos_all):
    p = pos_all[c]
    print('%-10s %6d %6d %6d %6d %6d   %d / %d / %d' % (c, rows[c]['dangle'], rows[c]['tease'], rows[c]['thin'], rows[c]['dupe'],
                                                   rows[c]['hint'], p[0], p[1], p[2]))
if verbose:
    for k in ('dangle', 'tease', 'dupe'):
        print('\n==', k)
        for c, lid, i, t in bad[k]:
            print(' ', lid, i, t)
