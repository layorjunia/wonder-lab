#!/usr/bin/env python3
"""Render every narratable Wonder Lab string to a neural-voice clip.

  .venv-tts/bin/python tools/gen_audio.py            # incremental
  .venv-tts/bin/python tools/gen_audio.py --clean    # start over

Two deliberate departures from the reference implementation in
unicorn-reading-academy, both of which its own porting guide calls for:

1. NOTHING IS SCRAPED WITH A REGEX. The reference reads a fixed list of JS
   files as raw text and pulls out quoted strings. `js/animals.js` is machine
   generated and double-quoted, so that approach mis-pairs quotes on every
   apostrophe in the prose: 353 bogus matches, 229 of which would have been
   rendered as clips of things like `t. Small head, deep chest, legs like
   stilts"},{"cat":"build`. Here the data files are handed to node, evaluated
   properly, dumped as JSON, and walked by field name. A renamed field raises;
   it does not silently halve the corpus.

2. EVERY CLIP IS A PHRASE CLIP. The reference also mints one clip per word so
   a child can tap any word in a story. Wonder Lab has no word tapping, so
   that loop would have produced ~9,000 extra clips for audio nothing can
   play. It also means `resolve()` is binary here — a string either has its
   own recording or falls to browser TTS, which is a build defect. There is no
   middle "stitched" state to hide a miss.

Everything speakable is one clip, keyed by the normalised ORIGINAL text and
named for its md5. The text actually handed to the synthesiser goes through
tools/speech_forms.py first, so "43 ft (13 m)" is looked up as written and
spoken as "forty-three feet".
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK
os.environ.setdefault('HF_HOME', os.path.join(ROOT, '.work', 'hf'))
os.environ.setdefault('PIPER_BITRATE', '32000')

sys.path.insert(0, os.path.join(ROOT, 'tools'))
from speech_forms import for_speech                      # noqa: E402
from tts_engines import get_engine                       # noqa: E402

AUDIO = os.path.join(ROOT, 'audio')
MANIFEST = os.path.join(AUDIO, 'manifest.json')

# Must match AudioLib.norm in js/audio.js character for character. A divergence
# is not an error — it is a lookup miss, and the browser voice speaks one line
# in a different voice with nothing logged. tools/check_norm.py proves it.
EMOJI_RE = re.compile('[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍]')


def norm(text):
    t = str(text).lower().replace('‘', "'").replace('’', "'")
    t = EMOJI_RE.sub('', t)
    return re.sub(r'\s+', ' ', t).strip()


# ── corpus ───────────────────────────────────────────────────────────────
# node evaluates the data files, so this is a real parse rather than a regex
# over source text. Field names are explicit: adding a narratable field to the
# schema means adding it here, which is the point.
_DUMP = r'''
const fs = require('fs');
// /gm, not /m: schema.js declares GROUPS, HABITATS, CATEGORIES, KINDS and
// BODY_SECTIONS, and a non-global replace only reaches the first one.
const load = f => { const s = fs.readFileSync(f, 'utf8')
  .replace(/^const (\w+)/gm, 'globalThis.$1'); eval(s); };
load('js/schema.js'); load('js/animals.js'); load('js/body.js');
const out = [];
const push = (src, field, id, t) => { if (t && String(t).trim())
  out.push({ src, field, id, text: String(t) }); };
ANIMALS.forEach(a => {
  push('animal', 'name',   a.id, a.name);
  push('animal', 'blurb',  a.id, a.blurb);
  push('animal', 'size',   a.id, a.size);
  push('animal', 'wonder', a.id, a.wonder);
  a.facts.forEach((f, i) => {
    push('animal', 'fact.text', a.id + '#' + i, f.text);
    push('animal', 'fact.more', a.id + '#' + i, f.more);
  });
});
// Section headers. Pressing Listen on a card used to start mid-thought — the
// fact with no clue what it was about or which animal it belonged to. These
// are short and few, and they make every playback self-contained.
Object.values(CATEGORIES).forEach((c, i) => push('label', 'category', 'c' + i, c.name));
Object.values(BODY_SECTIONS).forEach((b, i) => push('label', 'section', 's' + i, b.name));
Object.values(KINDS).forEach((k, i) => push('label', 'kind', 'k' + i, k.name));
Object.values(GROUPS).forEach((g, i) => push('label', 'group', 'g' + i, g.name));
push('label', 'phrase', 'tryit', 'Try it now');
BODY.forEach((f, i) => {
  push('body', 'fact.text',  'b' + i, f.text);
  push('body', 'fact.more',  'b' + i, f.more);
  push('body', 'fact.tryit', 'b' + i, f.tryit);
});
console.log(JSON.stringify(out));
'''

# Fields the app can play. Anything not listed gets no clip, on purpose.
NARRATED = {'name', 'blurb', 'size', 'wonder',
            'fact.text', 'fact.more', 'fact.tryit',
            'category', 'section', 'kind', 'group', 'phrase'}

MAX_CHARS = 1400        # a fact over this length is a content bug, not a clip


def corpus():
    """[(key, spoken_text)] — deduplicated, ready to render."""
    r = subprocess.run(['node', '-e', _DUMP], cwd=ROOT,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('node dump failed:\n' + r.stderr[:800])
    rows = json.loads(r.stdout)
    if not rows:
        raise SystemExit('node dump returned nothing — check js/animals.js')

    seen, out, oversize = {}, [], []
    for row in rows:
        if row['field'] not in NARRATED:
            continue
        text = row['text']
        if len(text) > MAX_CHARS:
            oversize.append((row['id'], row['field'], len(text)))
            continue
        k = norm(text)
        if not k or k in seen:
            continue
        seen[k] = True
        out.append((k, for_speech(text)))

    if oversize:
        # The reference drops over-cap strings silently and they surface months
        # later as one line in the browser voice. Fail instead.
        for i, f, n in oversize[:10]:
            print(f'  OVERSIZE {i} {f} {n} chars')
        raise SystemExit(f'{len(oversize)} string(s) over {MAX_CHARS} chars — '
                         'shorten the content or raise MAX_CHARS deliberately')
    return out


def clip_path(key):
    return os.path.join('p', hashlib.md5(key.encode('utf-8')).hexdigest()[:12] + '.m4a')


# ── validation ───────────────────────────────────────────────────────────
def duration(path):
    r = subprocess.run(['afinfo', path], capture_output=True, text=True)
    m = re.search(r'estimated duration: ([\d.]+)', r.stdout)
    return float(m.group(1)) if m else 0.0


def clip_energy(path):
    """(peak, seconds above amplitude 1500).

    A clip can have the right name, the right size and the right duration and
    still be digital silence. Duration alone never caught that; this does. The
    reference runs it over 310 phoneme clips and nothing else — here it runs
    over everything that ships.
    """
    import wave
    import numpy as np
    wav = tempfile.mktemp(suffix='.wav')
    try:
        r = subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@22050',
                            '-c', '1', path, wav], capture_output=True, text=True)
        if r.returncode != 0:
            return 0, 0.0
        with wave.open(wav, 'rb') as w:
            a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if a.size == 0:
            return 0, 0.0
        return int(np.abs(a).max()), float((np.abs(a) > 1500).sum()) / 22050.0
    finally:
        if os.path.exists(wav):
            os.unlink(wav)


def validate(manifest, check_energy):
    problems = []
    for key, rel in manifest['words'].items():
        path = os.path.join(AUDIO, rel)
        if not os.path.exists(path):
            problems.append(f'missing file for {key[:60]!r}')
            continue
        if os.path.getsize(path) < 900:
            problems.append(f'tiny file ({os.path.getsize(path)}b) for {key[:60]!r}')
            continue
        if key in check_energy:
            peak, loud = clip_energy(path)
            if peak < 9000 or loud < 0.05:
                problems.append(f'silent/quiet clip (peak {peak}, {loud:.2f}s) '
                                f'for {key[:60]!r}')
            elif duration(path) < 0.20:
                problems.append(f'clip under 0.2s for {key[:60]!r}')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', default=os.environ.get('TTS_ENGINE', 'piper'))
    ap.add_argument('--clean', action='store_true')
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--limit', type=int, default=0, help='render only the first N (smoke test)')
    ap.add_argument('--no-energy', action='store_true', help='skip the energy gate')
    args = ap.parse_args()

    try:
        engine = get_engine(args.engine)
    except Exception as e:
        print(e)
        return 2

    if args.clean and os.path.isdir(AUDIO):
        # Narrowed to the directory this tool owns. The reference rmtree'd the
        # whole of audio/ and took audio/sfx/ with it, and Sfx.play() swallows
        # the resulting 404 — so every tap went silent with nothing logged.
        shutil.rmtree(os.path.join(AUDIO, 'p'), ignore_errors=True)
        if os.path.exists(MANIFEST):
            os.unlink(MANIFEST)

    os.makedirs(os.path.join(AUDIO, 'p'), exist_ok=True)

    items = corpus()
    if args.limit:
        items = items[:args.limit]
    print(f'{len(items)} narratable strings')

    manifest = {'words': {}, 'engine': engine.name, 'voice': engine.VOICE_NAME}
    jobs = {}
    for key, spoken in items:
        rel = clip_path(key)
        manifest['words'][key] = rel
        out = os.path.join(AUDIO, rel)
        if not os.path.exists(out):
            jobs[out] = spoken            # dedupe by output path, not by index

    print(f'{len(jobs)} to render ({len(items) - len(jobs)} already on disk)')
    fails = []
    if jobs:
        def render(item):
            out, spoken = item
            try:
                engine.speak_text(spoken, out)
            except Exception as e:
                fails.append((out, str(e)[:160]))

        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            for _ in ex.map(render, jobs.items()):
                done += 1
                if done % 200 == 0:
                    print(f'  {done}/{len(jobs)}')

    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, separators=(',', ':'), ensure_ascii=False)

    fresh = set()
    if not args.no_energy:
        rev = {v: k for k, v in manifest['words'].items()}
        fresh = {rev[os.path.relpath(o, AUDIO)] for o in jobs if os.path.relpath(o, AUDIO) in rev}
    print(f'checking {len(fresh)} newly rendered clip(s) for silence')
    problems = validate(manifest, fresh)

    for out, err in fails[:10]:
        print(f'  RENDER FAILED {os.path.basename(out)}: {err}')
    for p in problems[:20]:
        print('  ' + p)

    total = sum(os.path.getsize(os.path.join(AUDIO, v))
                for v in manifest['words'].values()
                if os.path.exists(os.path.join(AUDIO, v)))
    print(f'\n{len(manifest["words"])} clips, {total / 1048576:.0f} MB -> {MANIFEST}')
    if fails or problems:
        print(f'{len(fails)} render failure(s), {len(problems)} validation problem(s)')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
