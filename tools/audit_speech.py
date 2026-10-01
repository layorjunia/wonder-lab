#!/usr/bin/env python3
"""Render every word Kokoro has to guess, transcribe it back, rank the misses.

tools/names.py lists the guesses; this renders each one (plus every word
already in tools/lexicon.py, to prove the hand-written phonemes are right and
not a typo that reads worse than the guess), transcribes it with
faster-whisper, and prints the ones whose transcript is far from the word,
most-used first. The output is a shortlist for a human ear, not a gate:
whisper cannot spell "Quetzalcoatlus" either, so a miss here means LISTEN,
then fix in lexicon.py if it is really wrong.

  .venv-tts/bin/python tools/audit_speech.py            # full sweep
  .venv-tts/bin/python tools/audit_speech.py --only olm,xylem   # spot check

Sharded, exactly like gen_audio.py — one Kokoro pipeline per PROCESS (the
engine's lock means threads buy nothing):

  for i in 0 1 2 3 4 5; do
    KOKORO_DEVICE=$([ $i = 0 ] && echo mps || echo cpu) KOKORO_THREADS=2 \
      .venv-tts/bin/python tools/audit_speech.py --shards 6 --shard $i &
  done; wait
  .venv-tts/bin/python tools/audit_speech.py --report   # transcribe + rank
"""
import argparse
import collections
import difflib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ.setdefault('HF_HOME', os.path.join(ROOT, '.work', 'hf'))

from gen_audio import corpus                              # noqa: E402
import lexicon                                            # noqa: E402
from tts_engines import KokoroEngine                      # noqa: E402

OUT = os.path.join(ROOT, '.work', 'speech-audit')


def norm_word(w):
    return re.sub(r'[^a-z]', '', w.lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='comma list of words, skip discovery')
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--threshold', type=float, default=0.75)
    ap.add_argument('--shards', type=int, default=1)
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--report', action='store_true',
                    help='skip rendering; transcribe whatever is already in OUT')
    args = ap.parse_args()

    counts = collections.Counter(
        w for _, t in corpus() for w in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", t))

    if args.only:
        words = [w for w in args.only.split(',') if w]
    else:
        from misaki import en, espeak
        g2p = en.G2P(trf=False, british=False,
                     fallback=espeak.EspeakFallback(british=False))
        words = []
        for w, n in counts.most_common():
            _, toks = g2p(w)
            t = toks[0] if toks else None
            rating = getattr(t, 'rating', None) if t is not None else None
            if t is not None and (rating is None or rating < 3):
                words.append(w)
        # The lexicon's own entries always get rendered, even the ones the
        # model would have guessed acceptably — a bad phoneme string is worse
        # than a bad guess, and only listening back finds it.
        words += [w for w in lexicon.WORDS if w not in set(words)]

    os.makedirs(OUT, exist_ok=True)
    if not args.report:
        # Disjoint slices, so parallel shards never write the same file.
        todo = words[args.shard::args.shards] if args.shards > 1 else words
        eng = KokoroEngine(voice=args.voice)
        done = 0
        for w in todo:
            p = os.path.join(OUT, f'{norm_word(w)}.m4a')
            if os.path.exists(p):
                continue
            try:
                eng.speak_text(w, p)      # speak_text runs lexicon.tts_text itself
            except Exception as e:
                print(f'RENDER FAILED {w}: {str(e)[:120]}')
            done += 1
            if done % 50 == 0:
                print(f'  shard {args.shard}: {done} rendered', flush=True)
        if args.shards > 1:
            print(f'shard {args.shard} done ({done} rendered)')
            return 0

    paths = {w: p for w in words
             if os.path.exists(p := os.path.join(OUT, f'{norm_word(w)}.m4a'))}
    from faster_whisper import WhisperModel
    wm = WhisperModel('base.en', compute_type='int8')
    rows = []
    for w, p in paths.items():
        segs, _ = wm.transcribe(p, beam_size=1)
        heard = ' '.join(s.text.strip() for s in segs)
        score = difflib.SequenceMatcher(
            None, norm_word(w), norm_word(heard)).ratio()
        rows.append((score, counts.get(w, 0), w, heard))

    rows.sort(key=lambda r: (r[0], -r[1]))
    flagged = [r for r in rows if r[0] < args.threshold]
    print(f'\n{len(paths)} words rendered ({args.voice}), '
          f'{len(flagged)} under {args.threshold}:\n')
    print(f'{"score":>5} {"uses":>5}  {"word":<26} heard')
    for score, n, w, heard in flagged:
        mark = ' *LEX*' if w in lexicon.WORDS else ''
        print(f'{score:5.2f} {n:>5}  {w:<26} {heard!r}{mark}')
    print(f'\nclips kept in {OUT} — listen before touching lexicon.py')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
