#!/usr/bin/env python3
"""List every word Kokoro has to GUESS in Wonder Lab's narration, with its guess.

Kokoro reads common words from its dictionary and works the rest out from
spelling. That is fine for English prose and unreliable for the words this app
is full of: species names, Latin binomials, minerals, anatomy, astronomy.
misaki's G2P returns a `rating` per token; below 3 means it guessed.

    .venv-tts/bin/python tools/names.py            # every guessed word
    .venv-tts/bin/python tools/names.py --top 60   # the most frequent ones

Put the ones it gets WRONG into tools/lexicon.py. Everything it happens to get
right can be left alone — the point is to look, not to spell out all of them.
"""
import argparse
import collections
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_audio import corpus  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--top', type=int, default=0)
    ap.add_argument('--min-count', type=int, default=1)
    args = ap.parse_args()

    from misaki import en, espeak
    lines = [t for _, t in corpus()]
    # Every distinct word, not just capitalised ones: Wonder Lab's hard words
    # are mostly lowercase (mitochondria, chlorophyll, marsupial).
    counts = collections.Counter(
        w for t in lines for w in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", t))

    g2p = en.G2P(trf=False, british=False, fallback=espeak.EspeakFallback(british=False))
    guessed = []
    for w, n in counts.most_common():
        if n < args.min_count:
            continue
        _, toks = g2p(w)
        t = toks[0] if toks else None
        if t is None:
            continue
        rating = getattr(t, 'rating', None)
        if rating is None or rating < 3:
            guessed.append((w, n, t.phonemes, rating))

    print(f'{len(lines)} lines, {len(counts)} distinct words, '
          f'{len(guessed)} Kokoro has to guess:\n')
    print(f'{"word":<26}{"uses":>5}  guess')
    for w, n, ph, r in (guessed[:args.top] if args.top else guessed):
        print(f'{w:<26}{n:>5}  {ph}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
