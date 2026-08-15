#!/usr/bin/env python3
"""Synthesize the app's sound effects. No samples, no downloads — every sound
is a few sine waves and an envelope, so the whole kit is ~40 KB and perfectly
reproducible.

The Sfx player in js/audio.js has existed since the port and audio/sfx/ was
EMPTY — every tap in the app has been mute. Rules for what gets made here:

  * short: nothing over 700 ms, most under 200 ms
  * pitched to C major so overlapping sounds never clash
  * soft attacks; nothing startles a child in a quiet room
  * played at low volume by the caller (0.3-0.5), never full scale

  .venv-tts/bin/python tools/gen_sfx.py
"""
import numpy as np
import os
import subprocess
import tempfile
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK
OUT = os.path.join(ROOT, 'audio', 'sfx')
os.makedirs(OUT, exist_ok=True)
SR = 22050


def t(ms):
    return np.linspace(0, ms / 1000, int(SR * ms / 1000), False)


def env(sig, attack=0.004, release=None):
    """Soft attack, exponential tail. Release defaults to the whole length."""
    n = len(sig)
    a = min(n, int(SR * attack))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    r = release if release is not None else n / SR
    e *= np.exp(-np.linspace(0, n / SR, n) / (r * 0.36))
    return sig * e


def tone(freq, ms, harmonics=((1, 1.0),)):
    x = t(ms)
    return sum(a * np.sin(2 * np.pi * freq * h * x) for h, a in harmonics)


def sweep(f0, f1, ms):
    x = t(ms)
    f = np.linspace(f0, f1, len(x))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def write(name, sig, gain=0.8):
    sig = sig / max(1e-9, np.abs(sig).max()) * gain
    wav = os.path.join(_WORK, name + '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767).astype(np.int16).tobytes())
    m4a = os.path.join(OUT, name + '.m4a')
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000',
                    wav, m4a], check=True, capture_output=True)
    print(f'  {name}.m4a  {os.path.getsize(m4a)} b')


def mix(*parts):
    """Overlay at offsets: (signal, start_ms)."""
    end = max(int(SR * s / 1000) + len(p) for p, s in parts)
    out = np.zeros(end)
    for p, s in parts:
        i = int(SR * s / 1000)
        out[i:i + len(p)] += p
    return out


# pop — dealing the next card. A soft pitch-drop blip, like a cork the size
# of a pea.
write('pop', env(sweep(520, 260, 70), release=0.07), 0.7)

# ding — an experiment ticked off. A small bright bell (C6 with two partials).
write('ding', env(tone(1046.5, 320, ((1, 1), (2.76, .35), (5.4, .12))),
                  release=0.28), 0.6)

# yes — right answer. Two quick notes up: C5 then E5, barely 200 ms.
write('yes', mix((env(tone(523.25, 90, ((1, 1), (2, .25))), release=.09), 0),
                 (env(tone(659.25, 150, ((1, 1), (2, .25))), release=.14), 70)), 0.65)

# no — wrong answer. A soft downward slide, more "hm" than "wrong".
write('no', env(sweep(280, 208, 180), release=0.16) * 0.8, 0.5)

# stamp — the passport stamp landing: a low thump plus a tick of noise.
rng = np.random.default_rng(7)
thump = env(tone(96, 150, ((1, 1), (2, .5), (3.1, .2))), release=0.10)
tick = env(rng.standard_normal(int(SR * 0.02)), attack=0.001, release=0.015) * 0.5
write('stamp', mix((thump, 0), (tick, 4)), 0.85)

# tada — the deck cleared. C-E-G climbed quickly, held as a chord with a
# slow shimmer. The only sound allowed to be longer than half a second.
notes = [(523.25, 0), (659.25, 90), (783.99, 180)]
parts = [(env(tone(f, 120, ((1, 1), (2, .3))), release=.11), s) for f, s in notes]
x = t(430)
chord = sum(np.sin(2 * np.pi * f * x) * (1 + 0.10 * np.sin(2 * np.pi * 5.2 * x))
            for f, _ in notes)
parts.append((env(chord, attack=0.01, release=0.38), 250))
write('tada', mix(*parts), 0.6)

print('done ->', OUT)
