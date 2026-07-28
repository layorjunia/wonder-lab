"""Pluggable text-to-speech engines for the audio generator.

Two engines, same interface:

  google  — Google Cloud Text-to-Speech REST API. Neural voices for prose AND
            true IPA phonemes via SSML <phoneme>. This is the shipping engine:
            one voice for everything, so narration and letter sounds match.
  apple   — macOS `say` + AVSpeechSynthesizer. Offline fallback, noticeably
            more robotic. Kept so the build still works with no API key.

Google needs an API key. Put it in tools/.tts-key (git-ignored) or set
GOOGLE_TTS_KEY. The key is used only here, at build time; it is never shipped
in the app.
"""
import base64
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
import wave
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Keep ALL scratch files inside the project — never the system temp dir.
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK

KEY_FILE = os.path.join(ROOT, 'tools', '.tts-key')

# Neural2 voices are covered by Google's free monthly tier at our volume.
# Studio voices sound even better but have a much smaller free allowance.
GOOGLE_VOICE = os.environ.get('GOOGLE_TTS_VOICE', 'en-US-Neural2-F')
GOOGLE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'


def google_key():
    k = os.environ.get('GOOGLE_TTS_KEY', '').strip()
    if k:
        return k
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE) as f:
            return f.read().strip()
    return ''


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


class GoogleEngine:
    name = 'google'
    ext = '.mp3'

    def __init__(self, voice=None, rate=0.92):
        self.voice = voice or GOOGLE_VOICE
        self.rate = rate
        self.key = google_key()
        if not self.key:
            raise RuntimeError(
                'No Google TTS API key.\n'
                'Create one in Google Cloud (APIs & Services > Credentials),\n'
                'enable "Cloud Text-to-Speech API", then save the key to:\n'
                f'  {KEY_FILE}\n'
                'or export GOOGLE_TTS_KEY=... before running.')

    def _post(self, payload, attempts=4):
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            GOOGLE_URL + '?key=' + self.key, data=data,
            headers={'Content-Type': 'application/json'})
        last = None
        for i in range(attempts):
            try:
                with urllib.request.urlopen(req, timeout=45) as r:
                    return json.loads(r.read())['audioContent']
            except urllib.error.HTTPError as e:
                body = e.read().decode('utf8', 'replace')[:400]
                last = f'HTTP {e.code}: {body}'
                # 4xx other than rate-limit will not fix itself
                if e.code not in (429, 500, 503):
                    break
            except Exception as e:  # noqa: BLE001 - network flakiness
                last = str(e)
            time.sleep(1.5 * (i + 1))
        raise RuntimeError(last or 'unknown TTS error')

    def _synth(self, body_input, out_path):
        payload = {
            'input': body_input,
            'voice': {'languageCode': 'en-US', 'name': self.voice},
            'audioConfig': {
                'audioEncoding': 'MP3',
                'speakingRate': self.rate,
                'pitch': 0.0,
                'sampleRateHertz': 24000,
            },
        }
        audio = self._post(payload)
        with open(out_path, 'wb') as f:
            f.write(base64.b64decode(audio))

    def speak_text(self, text, out_path):
        """Ordinary prose — words, phrases, story sentences."""
        self._synth({'text': text}, out_path)

    def speak_phoneme(self, ipa, out_path):
        """A pure letter SOUND. SSML <phoneme> gives exact IPA control, so /b/
        is the sound and never the letter name."""
        ssml = f'<speak><phoneme alphabet="ipa" ph="{esc(ipa)}">x</phoneme></speak>'
        self._synth({'ssml': ssml}, out_path)

    def speak_letter_name(self, ch, out_path):
        """The letter NAME, e.g. "bee" for b — used when spelling words out."""
        ssml = (f'<speak><say-as interpret-as="characters">{esc(ch)}'
                f'</say-as></speak>')
        self._synth({'ssml': ssml}, out_path)

    def speak_narration(self, segments, out_path):
        """A whole teaching line as ONE utterance.

        Prose, letter names and exact letter sounds are combined in a single
        SSML document, so the result has natural sentence prosody instead of
        sounding like separate clips glued together — while the <phoneme>
        spans still guarantee the exact sound.
        """
        parts = []
        for s in segments:
            if s.get('say') is not None or s.get('word') is not None:
                parts.append(esc(s.get('say') or s.get('word')))
            elif s.get('ph') is not None:
                parts.append(f'<phoneme alphabet="ipa" ph="{esc(s["ph_ipa"])}">'
                             f'{esc(s["ph"])}</phoneme>')
            elif s.get('ltr') is not None:
                parts.append('<say-as interpret-as="characters">'
                             f'{esc(s["ltr"])}</say-as>')
        ssml = '<speak>' + ' '.join(parts) + '</speak>'
        self._synth({'ssml': ssml}, out_path)


class AppleEngine:
    """Offline fallback. Note: the legacy `say "[[inpt PHON]]…"` escape is
    BROKEN on modern macOS (the marker is spoken aloud), so phonemes go through
    AVSpeechSynthesizer's IPA attribute instead."""

    name = 'apple'
    ext = '.m4a'
    VOICE = 'Samantha'
    SWIFT = os.path.join(ROOT, 'tools', 'phoneme_render.swift')

    LETTER_NAME = {
        'a': 'ay', 'b': 'bee', 'c': 'see', 'd': 'dee', 'e': 'ee', 'f': 'eff',
        'g': 'jee', 'h': 'aitch', 'i': 'eye', 'j': 'jay', 'k': 'kay',
        'l': 'ell', 'm': 'em', 'n': 'en', 'o': 'oh', 'p': 'pee', 'q': 'cue',
        'r': 'are', 's': 'ess', 't': 'tee', 'u': 'you', 'v': 'vee',
        'w': 'double you', 'x': 'ex', 'y': 'why', 'z': 'zee',
    }

    def __init__(self, rate=150):
        self.rate = str(rate)

    def _convert(self, aiff, out):
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '40000',
                        aiff, out], capture_output=True, check=True)
        try:
            os.unlink(aiff)
        except OSError:
            pass

    def speak_text(self, text, out_path):
        aiff = out_path + '.aiff'
        # stdin, never argv: strings like "-ful" are parsed as flags otherwise
        r = subprocess.run(['say', '-v', self.VOICE, '-r', self.rate, '-o', aiff],
                           input=text, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError('say failed: ' + r.stderr.strip())
        self._convert(aiff, out_path)

    def speak_phoneme(self, ipa, out_path):
        with tempfile.NamedTemporaryFile('w', suffix='.tsv', delete=False,
                                         encoding='utf-8') as f:
            spec = f.name
            base = os.path.basename(out_path)
            stem = base[:-len(self.ext)] if base.endswith(self.ext) else base
            f.write(f'{stem}\t{ipa}\tx\n')
        outdir = os.path.dirname(out_path)
        r = subprocess.run(['swift', self.SWIFT, outdir, spec],
                           capture_output=True, text=True)
        os.unlink(spec)
        aiff = os.path.join(outdir, stem + '.aiff')
        if r.returncode != 0 or not os.path.exists(aiff):
            raise RuntimeError('swift phoneme render failed: ' + r.stderr.strip()[:200])
        self._convert(aiff, out_path)

    def speak_letter_name(self, ch, out_path):
        self.speak_text(self.LETTER_NAME.get(ch, ch), out_path)

    NARR_SWIFT = os.path.join(ROOT, 'tools', 'narration_render.swift')

    def speak_narration_batch(self, lines, out_dir):
        """Render many narration lines in one swift invocation.

        Each line becomes a single AVSpeechUtterance built from an attributed
        string where only the phoneme spans carry an IPA attribute — one
        continuous sentence, exact sounds inside it.
        """
        spec = []
        for name, segments in lines:
            segs = []
            for s in segments:
                if s.get('say') is not None or s.get('word') is not None:
                    segs.append({'text': s.get('say') or s.get('word')})
                elif s.get('ph') is not None:
                    segs.append({'text': s['ph'], 'ipa': s['ph_ipa']})
                elif s.get('ltr') is not None:
                    segs.append({'text': s['ltr'], 'ipa': s.get('ltr_ipa')})
            spec.append({'name': name, 'segments': segs})

        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False,
                                         encoding='utf-8') as f:
            path = f.name
            json.dump(spec, f, ensure_ascii=False)
        r = subprocess.run(['swift', self.NARR_SWIFT, out_dir, path],
                           capture_output=True, text=True)
        os.unlink(path)
        made = []
        for name, _ in lines:
            aiff = os.path.join(out_dir, name + '.aiff')
            out = os.path.join(out_dir, name + self.ext)
            if os.path.exists(aiff):
                self._convert(aiff, out)
                made.append(name)
        if not made:
            raise RuntimeError('narration render produced nothing: '
                               + r.stderr.strip()[:200])
        return made


class PiperEngine:
    """Piper — a neural TTS that runs locally. No API key, no billing, no
    network at build time, and it sounds like a person rather than a 1990s
    speech synthesiser.

    Crucially it exposes the phoneme layer (`phonemize` → IPA, then
    `phonemes_to_ids` → `phoneme_ids_to_audio`), so a whole teaching line can be
    built as ONE utterance whose prose is naturally phonemised while the letter
    sounds are our exact IPA. That is the combination the app needs: natural
    delivery AND guaranteed-correct phonics.
    """

    name = 'piper'
    ext = '.m4a'
    VOICE_NAME = os.environ.get('PIPER_VOICE', 'en_US-lessac-high')
    DEFAULT_MODEL = os.path.join(ROOT, 'tools', 'voices', VOICE_NAME + '.onnx')

    # espeak has no ɝ; it writes the stressed r-coloured vowel as ɜː
    IPA_FIX = [('ɝ', 'ɜː')]

    def __init__(self, model=None, rate=1.0):
        try:
            from piper import PiperVoice
        except ImportError as e:
            raise RuntimeError(
                'piper-tts is not installed. Set it up with:\n'
                '  uv venv --python 3.12 .venv-tts\n'
                '  uv pip install --python .venv-tts/bin/python piper-tts\n'
                '  .venv-tts/bin/python -m piper.download_voices '
                '--download-dir tools/voices ' + PiperEngine.VOICE_NAME + '\n'
                'then run gen_audio.py with .venv-tts/bin/python') from e
        path = model or self.DEFAULT_MODEL
        if not os.path.exists(path):
            raise RuntimeError('voice model missing: ' + path)
        self.voice = PiperVoice.load(path)
        self.sample_rate = self.voice.config.sample_rate
        self.pmap = self.voice.config.phoneme_id_map
        self._lock = threading.Lock()   # onnx session is not thread-safe

    def _fix(self, ipa):
        for a, b in self.IPA_FIX:
            ipa = ipa.replace(a, b)
        return ipa

    def ipa_chars(self, ipa, stress=True):
        """IPA string -> phoneme characters the model knows.

        The map is per-character, so diphthongs like eɪ are naturally split.
        Unknown characters are dropped rather than silently poisoning the
        sequence; validate() then catches anything that produced no audio.
        """
        ipa = self._fix(ipa)
        out = []
        if stress and ipa and 'ˈ' not in ipa:
            out.append('ˈ')
        out.extend(c for c in ipa if c in self.pmap)
        return out

    def text_phonemes(self, text):
        """All sentences flattened — phonemize() splits on sentence
        boundaries, and using only the first silently truncates the line."""
        seq = []
        for i, sent in enumerate(self.voice.phonemize(text)):
            if i:
                seq.append(' ')
            seq.extend(sent)
        return seq

    def _write(self, phonemes, out_path, length_scale=None):
        from piper.config import SynthesisConfig
        cfg = SynthesisConfig(length_scale=length_scale) if length_scale else None
        ids = self.voice.phonemes_to_ids(phonemes)
        with self._lock:
            audio = self.voice.phoneme_ids_to_audio(ids, syn_config=cfg)
        import numpy as np
        arr = np.asarray(audio)
        if arr.dtype != 'int16':
            arr = (np.clip(arr, -1.0, 1.0) * 32767).astype('int16')
        wav_path = out_path + '.wav'
        with wave.open(wav_path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.sample_rate)
            w.writeframes(arr.tobytes())
        # Bitrate is a per-app choice, not a constant. Wonder Lab narrates 16
        # hours of connected prose, where 32 kbps mono AAC is clean and halves
        # a 450 MB corpus; a phonics app wants 48 for the crisp attack on a
        # single tapped word.
        r = subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac',
                            '-b', os.environ.get('PIPER_BITRATE', '48000'),
                            wav_path, out_path], capture_output=True, text=True)
        os.unlink(wav_path)
        if r.returncode != 0:
            raise RuntimeError('afconvert: ' + r.stderr.strip()[:200])

    def speak_text(self, text, out_path, length_scale=None):
        # A trailing period matters: without sentence-final punctuation the
        # model often clips the last consonant ("sit" -> "si").
        t = text if text.strip()[-1:] in '.!?' else text.rstrip() + '.'
        self._write(self.text_phonemes(t), out_path, length_scale)

    def speak_word_verified(self, word, out_path, listener, attempts=6):
        """Render a single word and keep re-rolling until it is heard correctly.

        Short inputs are where this model drifts — "hop" comes out "hope",
        "cub" comes out "cube". Because sampling is stochastic, another draw
        usually lands correctly, so generate-then-listen converges quickly.
        Returns what was finally heard, or None if it never matched.
        """
        last = None
        for _ in range(max(1, attempts)):
            self.speak_text(word, out_path)
            heard = listener(out_path, word)
            if heard is True:
                return None
            last = heard
        return last

    def speak_phoneme(self, ipa, out_path):
        self._write(self.ipa_chars(ipa), out_path)

    def speak_letter_name(self, ch, out_path):
        # spelled out so espeak reads the NAME, not the sound
        names = AppleEngine.LETTER_NAME
        self._write(self.text_phonemes(names.get(ch, ch)), out_path)

    def speak_narration(self, segments, out_path):
        seq = []
        for s in segments:
            if seq:
                seq.append(' ')
            if s.get('say') is not None or s.get('word') is not None:
                seq.extend(self.text_phonemes(s.get('say') or s.get('word')))
            elif s.get('ph') is not None:
                seq.extend(self.ipa_chars(s['ph_ipa']))
            elif s.get('ltr') is not None:
                ipa = s.get('ltr_ipa')
                seq.extend(self.ipa_chars(ipa) if ipa
                           else self.text_phonemes(s['ltr']))
        self._write(seq, out_path)


def get_engine(name):
    if name == 'google':
        return GoogleEngine()
    if name == 'apple':
        return AppleEngine()
    if name == 'piper':
        return PiperEngine()
    raise ValueError('unknown engine: ' + name)


# ── Isolated letter sounds ──────────────────────────────────────────────────
# A neural TTS is the wrong tool for a single phoneme: it is trained on
# connected speech, so a one-sound input is far outside anything it has seen.
# Piper rendered /k/+/a/+/t/ as "buh-ah-dup" — it invents a whole extra
# syllable, which is exactly the jumbling a child hears.
#
# eSpeak NG takes phonemes as its NATIVE input, so /b/ is the stop alone with
# no invented vowel, and it is fully deterministic. It is more mechanical than
# the neural voice, but for a phonics app a correct sound beats a pretty wrong
# one — and this is the same trade a teacher makes when they enunciate.
IPA_TO_ESPEAK = [
    # order matters: longest first, so digraphs win over their parts
    ('eɪ', 'eI'), ('aɪ', 'aI'), ('oʊ', 'oU'), ('aʊ', 'aU'), ('ɔɪ', 'OI'),
    ('dʒ', 'dZ'), ('tʃ', 'tS'), ('ɑɹ', 'A@'), ('ɔɹ', 'O@'), ('ɜː', '3:'),
    ('iː', 'i:'), ('uː', 'u:'), ('ɡ', 'g'), ('ɹ', 'r'), ('ʃ', 'S'),
    ('θ', 'T'), ('ð', 'D'), ('ŋ', 'N'), ('ʒ', 'Z'), ('ʊ', 'U'),
    ('æ', 'a'), ('ɛ', 'E'), ('ɪ', 'I'), ('ɑ', '0'), ('ʌ', 'V'),
    ('ɔ', 'O'), ('ə', '@'), ('ɝ', '3:'), ('ɚ', '@'), ('ju', 'ju:'),
    ('i', 'i'), ('u', 'u:'), ('e', 'e'), ('a', 'a'), ('o', 'oU'),
    ('ˈ', ''), ('ˌ', ''), ('ː', ''),
]


def ipa_to_espeak(ipa):
    out, i = [], 0
    while i < len(ipa):
        for src, dst in IPA_TO_ESPEAK:
            if ipa.startswith(src, i):
                out.append(dst)
                i += len(src)
                break
        else:
            out.append(ipa[i])
            i += 1
    return ''.join(out)


class EspeakPhonemes:
    """Renders one isolated letter sound, exactly as specified."""

    def __init__(self, speed=150, pitch=55, voice='en-us'):
        self.speed, self.pitch, self.voice = str(speed), str(pitch), voice
        if not shutil.which('espeak-ng'):
            raise RuntimeError('espeak-ng not installed — run: brew install espeak-ng')

    # A stop consonant needs SOMETHING after it or there is no sound at all —
    # /b/, /d/ and /g/ rendered as literal silence when the schwa was stripped.
    # Phonics teaches them with a minimal schwa ("buh"), so keep it, but keep it
    # short: unvoiced stops get a lighter release than voiced ones.
    VOICED_STOPS = ('b', 'd', 'g', 'dZ')
    UNVOICED_STOPS = ('p', 't', 'k', 'tS')

    # Continuants must be HELD to be heard as a sound ("ffff", "mmmm"), which
    # espeak does by repeating the phoneme. And en-us has no standalone /r/ at
    # all — a bare 'r' renders as pure silence; only 'r@' produces anything.
    CONTINUANTS = ('f', 's', 'm', 'n', 'l', 'v', 'z', 'T', 'D', 'S', 'Z', 'N')

    def render(self, ipa, out_path, pad=0.10):
        code = ipa_to_espeak(ipa)
        base = code[:-1] if code.endswith('@') else code
        if base in self.VOICED_STOPS or base in self.UNVOICED_STOPS:
            code = base + '@'   # audible release; never a bare stop
        elif base == 'r':
            code = 'r@'
        elif base in self.CONTINUANTS:
            code = base * 3
        elif base and not any(v in base for v in 'aeiouAEIOU@3VU0'):
            # a consonant blend ("gr", "nd") is still all stops — without a
            # release it is as inaudible as a bare stop
            code = base + '@'
        wav = out_path + '.raw.wav'
        r = subprocess.run(['espeak-ng', '-v', self.voice, '-s', self.speed,
                            '-p', self.pitch, '-w', wav, '[[%s]]' % code],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(wav):
            raise RuntimeError('espeak failed for %r: %s' % (ipa, r.stderr[:160]))
        # espeak pads generously; trim to the sound and re-pad evenly so clips
        # line up when they are played in sequence for blending practice
        with wave.open(wav, 'rb') as w:
            sr = w.getframerate()
            data = w.readframes(w.getnframes())
        import array
        a = array.array('h')
        a.frombytes(data)
        thresh = 220
        first = next((i for i, v in enumerate(a) if abs(v) > thresh), 0)
        last = next((i for i in range(len(a) - 1, -1, -1) if abs(a[i]) > thresh), len(a) - 1)
        core = a[max(0, first - int(sr * 0.01)):min(len(a), last + int(sr * 0.03))]
        peak = max((abs(v) for v in core), default=0)
        if peak:
            gain = min(8.0, 24000.0 / peak)      # bring every sound to a like level
            core = array.array('h', [int(max(-32000, min(32000, v * gain))) for v in core])
        padding = array.array('h', [0] * int(sr * pad))
        out = padding + core + padding
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(out.tobytes())
        c = subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000',
                            wav, out_path], capture_output=True, text=True)
        os.unlink(wav)
        if c.returncode != 0:
            raise RuntimeError('afconvert: ' + c.stderr[:160])
