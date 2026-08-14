#!/usr/bin/env python3
"""Measure how hard every shipped string is to read.

The app is for a 9-10 year old. Prose that reads like a museum label is prose
she will bounce off, however true it is. This is the mechanical check for that,
because "sounds about right" is not a standard anyone can apply to 4,000 cards.

  .venv-tts/bin/python tools/readability.py            # summary + worst 25
  .venv-tts/bin/python tools/readability.py --all      # every failure

Grade is Flesch-Kincaid. A card also fails on a single over-long sentence,
because one 40-word sentence sinks a card whose average looks fine.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK

MAX_GRADE = 7.0        # ~US 7th grade. She is 9-10; this is already generous.
MAX_SENTENCE = 24      # words in any one sentence
MAX_PROPER = 4         # capitalised names in one card

VOWELS = 'aeiouy'


def syllables(word):
    w = re.sub(r'[^a-z]', '', word.lower())
    if not w:
        return 0
    n, prev = 0, False
    for c in w:
        v = c in VOWELS
        if v and not prev:
            n += 1
        prev = v
    if w.endswith('e') and n > 1:
        n -= 1
    return max(1, n)


def sentences(text):
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if re.search(r'[a-z]', p, re.I)]


def grade(text):
    sents = sentences(text)
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", text)
    if not sents or not words:
        return 0.0, 0, 0
    syl = sum(syllables(w) for w in words)
    g = 0.39 * (len(words) / len(sents)) + 11.8 * (syl / len(words)) - 15.59
    longest = max(len(re.findall(r"[A-Za-z][A-Za-z'-]*", s)) for s in sents)
    return round(g, 1), longest, len(words)


# A name the child has heard of is free; a name she has not is a speed bump.
KNOWN = {'God', 'Genesis', 'Jesus', 'Noah', 'Adam', 'Abraham', 'Moses', 'Bible',
         'Earth', 'Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn', 'America',
         'English', 'Latin', 'Greek', 'Roman', 'Rome', 'Egypt', 'China',
         'Africa', 'Europe', 'January', 'Christmas', 'I', 'A', 'The', 'It',
         'In', 'On', 'At', 'And', 'But', 'That', 'They', 'You', 'He', 'She',
         'When', 'What', 'Why', 'How', 'If', 'So', 'Most', 'Every', 'One',
         'Two', 'Three', 'There', 'This', 'These', 'Some', 'Nobody', 'No'}


def proper_nouns(text):
    body = re.sub(r'(?<=[.!?])\s+', '\x00', text)
    names = set()
    for chunk in body.split('\x00'):
        for m in re.finditer(r"\b[A-Z][a-zA-Z'’]+(?:\s+[A-Z][a-zA-Z'’]+)*", chunk[1:]):
            w = m.group(0)
            if w.split()[0] not in KNOWN:
                names.add(w)
    return names


def rows():
    js = r'''
const fs = require('fs');
const load = f => { const s = fs.readFileSync(f, 'utf8')
  .replace(/^const (\w+)/gm, 'globalThis.$1'); eval(s); };
load('js/schema.js'); load('js/animals.js'); load('js/body.js');
load('js/plants.js'); load('js/expeditions.js');
Object.values(TOPIC_SETS).forEach(t => load('js/' + t.data.toLowerCase() + '.js'));
const out = [];
const add = (src, id, field, t) => { if (t && String(t).trim())
  out.push({ src, id, field, text: String(t) }); };
ANIMALS.forEach(a => { add('animal', a.id, 'blurb', a.blurb);
  a.facts.forEach((f, i) => { add('animal', a.id + '#' + i, 'text', f.text);
                              add('animal', a.id + '#' + i, 'more', f.more); }); });
PLANTS.forEach(a => { add('plant', a.id, 'blurb', a.blurb);
  a.facts.forEach((f, i) => { add('plant', a.id + '#' + i, 'text', f.text);
                              add('plant', a.id + '#' + i, 'more', f.more); }); });
BODY.forEach(e => { add('body', e.id, 'text', e.text); add('body', e.id, 'more', e.more);
                    add('body', e.id, 'tryit', e.tryit); });
Object.entries(TOPIC_SETS).forEach(([k, t]) => (globalThis[t.data] || []).forEach(e => {
  add(k, e.id, 'text', e.text); add(k, e.id, 'more', e.more); add(k, e.id, 'tryit', e.tryit); }));
console.log(JSON.stringify(out));
'''
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('node dump failed:\n' + r.stderr[:600])
    return json.loads(r.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--src', default=None)
    args = ap.parse_args()

    data = rows()
    if args.src:
        data = [r for r in data if r['src'] == args.src]

    bad, by_src, grades = [], {}, []
    for r in data:
        g, longest, nwords = grade(r['text'])
        names = proper_nouns(r['text'])
        grades.append(g)
        s = by_src.setdefault(r['src'], [0, 0])
        s[0] += 1
        fails = []
        if g > MAX_GRADE:
            fails.append(f'grade {g}')
        if longest > MAX_SENTENCE:
            fails.append(f'{longest}-word sentence')
        if len(names) > MAX_PROPER:
            fails.append(f'{len(names)} names')
        if fails:
            s[1] += 1
            bad.append((g, longest, len(names), r, fails))

    print(f'{len(data)} strings, mean grade {sum(grades)/max(1,len(grades)):.1f}')
    print(f'{len(bad)} fail ({len(bad)*100//max(1,len(data))}%)  '
          f'[grade>{MAX_GRADE}, sentence>{MAX_SENTENCE}w, names>{MAX_PROPER}]\n')
    for src in sorted(by_src, key=lambda k: -by_src[k][1]):
        n, f = by_src[src]
        print(f'  {src:10} {f:5}/{n:<5} {f*100//max(1,n):3}%')
    print()
    bad.sort(key=lambda x: -x[0])
    for g, longest, nn, r, fails in (bad if args.all else bad[:25]):
        print(f'[{", ".join(fails)}] {r["src"]}/{r["id"]}.{r["field"]}')
        print(f'   {r["text"][:180]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
