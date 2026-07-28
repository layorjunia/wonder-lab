#!/usr/bin/env python3
"""Transcribe every narration clip back and prove it says the right thing.

Neural TTS fails silently. Piper renders confident, natural-sounding audio of
the wrong words, and no file is missing, no clip is silent, and validation
passes. The only way to know is to listen to the build's own output.

  .venv-tts/bin/python tools/verify_phrases.py
  .venv-tts/bin/python tools/verify_phrases.py --since 600   # just-rendered
  .venv-tts/bin/python tools/verify_phrases.py --limit 200   # tune tolerance

THE NUMBER PROBLEM, AND WHY THIS VERSION DIFFERS FROM THE REFERENCE.

21% of Wonder Lab's strings contain a digit. The reference compares the
transcript against the manifest key — the text as WRITTEN — so a clip that
correctly says "forty-three feet" is scored against "43 ft (13 m)" and flagged
forever. A fifth of the corpus permanently red makes the report unreadable,
and an unread report is worse than no report.

The fix is not a bigger substitution table. It is comparing against what the
clip was actually asked to say: `for_speech(key)`, the same string the
synthesiser was handed. Numbers then match on both sides by construction.
Whisper still sometimes writes "43" where it heard "forty-three", so digits are
spelled out on the heard side too, and that is all the normalisation needed.

Single-word clips (species names) are excluded. "Quetzalcoatlus" and
"Pachycephalosaurus" are not words any recogniser spells reliably, and a gate
that flags all 150 of them every run teaches you to ignore it.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK
os.environ.setdefault('HF_HOME', os.path.join(ROOT, '.work', 'hf'))

sys.path.insert(0, os.path.join(ROOT, 'tools'))
from speech_forms import for_speech, _n2w                 # noqa: E402

AUDIO = os.path.join(ROOT, 'audio')

# Recogniser spellings, not pronunciation faults. Unit words appear here
# because for_speech already expanded them and whisper sometimes contracts
# them back.
SUBS = {
    'ok': 'okay', 'mr': 'mister', 'mrs': 'missus', 'dr': 'doctor',
    'gonna': 'going to', 'wanna': 'want to',
    'cannot': 'can not', 'dont': 'do not', 'cant': 'can not',
    'its': 'it is', 'lets': 'let us', 'thats': 'that is',
    'ft': 'feet', 'foot': 'feet', 'inch': 'inches', 'in': 'inches',
    'lb': 'pounds', 'lbs': 'pounds', 'pound': 'pounds',
    'mph': 'miles an hour', 'mi': 'miles', 'mile': 'miles',
    'kg': 'kilograms', 'km': 'kilometres', 'kilometers': 'kilometres',
    'meters': 'metres', 'metre': 'metres', 'meter': 'metres',
    'centimeters': 'centimetres', 'percent': 'per cent',
    'oz': 'ounces', 'ounce': 'ounces', 'degrees': 'degree',
}


def words_of(text):
    """Lowercase word sequence, digits spelled out, contractions expanded."""
    t = text.lower().replace('’', "'").replace('‘', "'")
    # Strip diacritics before the character filter, or "galápagos" becomes the
    # two tokens "gal pagos" and scores 0.67 WER against a transcript that said
    # exactly the right thing.
    t = ''.join(c for c in unicodedata.normalize('NFD', t)
                if unicodedata.category(c) != 'Mn')
    t = re.sub(r'(\d),(\d)', r'\1\2', t)          # 8,435 -> 8435
    t = t.replace('&', ' and ')                   # the clip says "and"; the key has "&"
    t = re.sub(r"[^a-z0-9' ]+", ' ', t)
    out = []
    for w in t.split():
        w = w.strip("'")
        if not w:
            continue
        if w.isdigit():
            # whisper writes "43" for audio that said "forty-three"
            out.extend(_n2w(int(w)).split())
            continue
        out.extend(SUBS.get(w, w).split())
    return out


def wer(ref, hyp):
    if not ref:
        return 0.0 if not hyp else 1.0
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i]
        for j, h in enumerate(hyp, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[len(hyp)] / len(ref)


def to_wav16k(path):
    out = tempfile.mktemp(suffix='.wav')
    r = subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1',
                        path, out], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('afconvert: ' + r.stderr.strip()[:160])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='base.en')
    ap.add_argument('--confirm', default='small.en')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--since', type=float, default=0)
    ap.add_argument('--tol', type=float, default=0.30)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--out', default=os.path.join(ROOT, 'tools',
                                                  'verify-phrases-report.json'))
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    manifest = json.load(open(os.path.join(AUDIO, 'manifest.json'), encoding='utf-8'))
    keys = sorted(k for k in manifest['words'] if ' ' in k)
    if args.since:
        now = time.time()
        keys = [k for k in keys
                if os.path.exists(os.path.join(AUDIO, manifest['words'][k]))
                and now - os.path.getmtime(os.path.join(AUDIO, manifest['words'][k])) <= args.since]
    if args.limit:
        # Stride, not head. Slicing a sorted list checks 'a' through 'ask'
        # every run and never samples the rest of the corpus — the reference's
        # --limit has exactly that bug.
        step = max(1, len(keys) // args.limit)
        keys = keys[::step][:args.limit]
    print(f'checking {len(keys)} clips, tolerance {args.tol:.0%} WER, '
          f'{args.workers} workers')

    # One model per worker — a WhisperModel is not safe to share across threads.
    pool = [WhisperModel(args.model, device='cpu', compute_type='int8')
            for _ in range(args.workers)]

    def listen(m, key):
        rel = manifest['words'][key]
        path = os.path.join(AUDIO, rel)
        if not os.path.exists(path):
            return None, 1.0
        wav = to_wav16k(path)
        try:
            segs, _ = m.transcribe(wav, language='en', beam_size=5, vad_filter=False)
            heard = ' '.join(s.text for s in segs).strip()
        finally:
            os.unlink(wav)
        # compare against what the clip was ASKED to say, not the written form
        return heard, wer(words_of(for_speech(key)), words_of(heard))

    done = [0]

    def check(idx_key):
        i, key = idx_key
        try:
            heard, e = listen(pool[i % args.workers], key)
        except Exception as ex:
            heard, e = f'(error: {ex})', 1.0
        done[0] += 1
        if done[0] % 200 == 0:
            print(f'  {done[0]}/{len(keys)}', flush=True)
        if heard is None:
            return {'text': key, 'heard': '(file missing)', 'wer': 1.0}
        if e > args.tol:
            return {'text': key, 'heard': heard, 'wer': round(e, 3),
                    'file': manifest['words'][key]}
        return None

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        suspect = [s for s in ex.map(check, enumerate(keys)) if s]

    # Stage 2. The small model mishears often enough that its failures are
    # mostly its own; re-listening to only the suspects with a bigger model is
    # what makes the surviving list worth reading.
    bad = []
    if suspect:
        print(f'\nre-listening to {len(suspect)} suspects with {args.confirm}...')
        big = [WhisperModel(args.confirm, device='cpu', compute_type='int8')
               for _ in range(max(1, args.workers // 2))]

        def confirm(idx_s):
            i, s = idx_s
            if s['heard'] == '(file missing)':
                return s
            try:
                heard, e = listen(big[i % len(big)], s['text'])
            except Exception as ex:
                return {**s, 'heard': f'(error: {ex})'}
            if e > args.tol:
                return {**s, 'heard': heard, 'wer': round(e, 3),
                        'first_pass': s['heard']}
            return None

        with ThreadPoolExecutor(max_workers=len(big)) as ex:
            bad = [b for b in ex.map(confirm, enumerate(suspect)) if b]
        print(f'{len(suspect) - len(bad)} were transcription artefacts')

    json.dump(bad, open(args.out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'\n{len(keys)} clips checked, {len(bad)} suspect '
          f'({100.0 * len(bad) / max(1, len(keys)):.1f}%)')
    for b in sorted(bad, key=lambda x: -x['wer'])[:20]:
        print(f"  WER {b['wer']:.2f}  want: {b['text'][:70]}")
        print(f"             got : {b['heard'][:70]}")
    print(f'\nfull report: {args.out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
