# Upgrade Wonder Lab's narration from Piper to Kokoro (and let each profile pick a voice)

Written 2026-09-28 from the Lamplight (Bible App) voice work, where Jacob heard Kokoro side by side with
the device voice and said it is "way better". Wonder Lab currently narrates with Piper
`en_US-lessac-high` (`tools/tts_engines.py`, `audio/manifest.json` says `"engine": "piper"`). Kokoro is a
newer open-source neural voice (82M parameters, Apache-2.0) that runs on this Mac with no key and no
billing, like Piper, but with noticeably more natural inflection, pauses between sentences and
expression. Everything below was built and measured in Lamplight first; the working code is in
`~/Desktop/Layor Apps/Bible App/Tools/voice/` (gen.py, lexicon.py, names.py) and
`Web/src/04-sound.js` (the player).

Read `../NEURAL-NARRATION.md` too: its pipeline, manifest and "never ship browser TTS" rules still apply.
This document only swaps the engine and adds the voice choice.

---

## 1. Hear it first

Samples (same Lamplight page in each voice) are in
`~/Desktop/Layor Apps/Bible App/Tools/voice/out/samples/`:
`1 American woman (Heart).m4a`, `2 American woman (Bella).m4a`, `3 British woman (Emma).m4a`,
`4 American man (Michael).m4a`, and `Character voices (narrator Heart).m4a`.

Kokoro's own quality grades (from its voice list), best first. Pick narrator voices from the top:

| Voice id | Who | Grade |
|---|---|---|
| `af_heart` | American woman, warm | A |
| `af_bella` | American woman, bright | A- |
| `af_nicole` | American woman, soft | B- |
| `bf_emma` | British woman | B- |
| `am_michael`, `am_fenrir`, `am_puck` | American men | C+ |
| `af_aoede`, `af_kore`, `af_sarah` | American women | C+ |
| `bm_george`, `bm_fable` | British men | C |

Lamplight ships Heart (default), Bella, Emma and Michael as the four choices.

## 2. Install (about 900 MB, once)

Wonder Lab's `.venv-tts` is already Python 3.12, which is what PyTorch needs (3.14 has no wheels).

```bash
cd "~/Desktop/Schooling Apps/wonder-lab"
~/.local/bin/uv pip install -p .venv-tts/bin/python "kokoro>=0.9" soundfile
```

`espeak-ng` (Homebrew) is already on this Mac; Kokoro falls back to it for words not in its dictionary.
The first run downloads the model from Hugging Face (`hexgrad/Kokoro-82M`, about 330 MB, into the
HF cache) and spaCy's small English model. Nothing is shipped in the app except the recorded clips.

## 3. The engine

Add this next to `PiperEngine` in `tools/tts_engines.py` and a branch in `get_engine`. It keeps the same
interface (`name`, `ext`, `VOICE_NAME`, `speak_text(text, out_path)`), so `gen_audio.py` doesn't change
beyond `--engine kokoro`.

```python
class KokoroEngine:
    """Kokoro (hexgrad/Kokoro-82M) — local neural TTS, more natural than Piper. See KOKORO-VOICE-UPGRADE.md."""
    name = 'kokoro'
    ext = '.m4a'
    VOICE_NAME = os.environ.get('KOKORO_VOICE', 'af_heart')     # a British voice needs lang 'b' (bf_*, bm_*)
    SR = 24000

    def __init__(self, voice=None, speed=0.95, device=None):
        os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
        import torch
        from kokoro import KModel, KPipeline
        self.voice = voice or self.VOICE_NAME
        self.speed = speed
        dev = device or ('mps' if torch.backends.mps.is_available() else 'cpu')
        model = KModel(repo_id='hexgrad/Kokoro-82M').to(dev).eval()
        self.pipe = KPipeline(lang_code='b' if self.voice[0] == 'b' else 'a',
                              repo_id='hexgrad/Kokoro-82M', model=model)
        self._lock = threading.Lock()

    def speak_text(self, text, out_path):
        import numpy as np, soundfile as sf
        t = text if text.strip()[-1:] in '.!?' else text.rstrip() + '.'
        with self._lock:
            chunks = [np.asarray(a) for _, _, a in self.pipe(t, voice=self.voice, speed=self.speed)]
        gap = np.zeros(int(0.12 * self.SR), dtype=np.float32)
        a = np.concatenate([x for c in chunks for x in (self._trim(c), gap)][:-1])
        a = self._trim(a)
        wav = out_path + '.wav'
        sf.write(wav, a, self.SR, subtype='PCM_16')
        r = subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', os.environ.get('KOKORO_BITRATE', '32000'),
                            wav, out_path], capture_output=True, text=True)
        os.unlink(wav)
        if r.returncode != 0:
            raise RuntimeError('afconvert: ' + r.stderr.strip()[:200])

    def _trim(self, a, pad=0.03):
        """Cut the model's edge silence to an even margin; the player adds the pauses between lines."""
        import numpy as np
        idx = np.where(np.abs(a) > 0.012)[0]
        if not len(idx):
            return a
        p = int(pad * self.SR)
        return a[max(0, idx[0] - p): idx[-1] + p]
```

Phonics methods (`speak_phoneme`, `speak_letter_name`) are not needed in Wonder Lab (it narrates facts, not
letter sounds). If any screen does play an isolated sound, keep Piper for that one kind of clip.

## 4. Speed: run several workers

Measured on this Mac (M4 Pro) with real, mostly short lines:

- one process on the graphics chip (`mps`): about 8x real time (22x on long paragraphs)
- one process on the CPU: about 8x real time
- Lamplight runs **6 workers side by side** (1 on `mps`, 5 on CPU with `torch.set_num_threads(2)`), each
  taking every 6th line, about 230 clips a minute in total.

The Kokoro pipeline is not thread-safe (hence the lock), so parallelism must be separate processes, not
threads. Wonder Lab's current corpus (7,666 lines, the headline tier) is roughly an hour per voice this way.
Copy the worker pattern from Lamplight's `Tools/voice/gen.py` (`--worker i/n`) and `record-all.sh`.

## 5. Pronunciation: check what Kokoro guesses

Kokoro reads common words from its dictionary and guesses the rest from spelling. In Lamplight, 209 Bible
names were guesses and many were wrong (Pilate as "PIL-ate", Emmaus as "EM-ouse"). Wonder Lab has the same
risk with species and science words (Latin names, "archaeopteryx", "mitochondria").

1. List the guessed words. Lamplight's `Tools/voice/names.py` does it (misaki's `G2P` returns a `rating`
   per token; below 3 means guessed). Point it at Wonder Lab's content files.
2. Write the right pronunciation for each wrong one in Kokoro's phoneme alphabet (see Lamplight
   `Tools/voice/lexicon.py`: `A` = "ay", `I` = "eye", `O` = "oh", `ˈ` before the stressed syllable) and
   substitute `[word](/phonemes/)` into the text before synthesis. Possessives need their own ending
   (`lexicon.py` handles "Boaz's").
3. Keep the existing faster-whisper verify pass (`tools/verify_phrases.py`): it still catches drift.

Other text fixes Lamplight needed: number ranges ("pages 8-20" was read "eight dash twenty": replace with
"8 to 20"), and words in capitals for emphasis ("I AM WHO I AM" must become "I Am Who I Am" or it may be
spelled out; keep real acronyms like "DNA" and "OK").

## 6. Let each profile choose a voice

Wonder Lab has real profiles (`js/store.js`), so the choice belongs on the profile:

- Record each offered voice into its own folder: `audio/<voice>/...` with its own `manifest.json`
  (`gen_audio.py --engine kokoro --voice af_heart --out audio/heart`). Same clip file names in every
  folder, so switching voices is only switching the base folder.
- `profile.voice` (default `heart`). In `js/audio.js`, load `audio/<profile.voice>/manifest.json` when the
  profile changes, and resolve clips against it. If a line is missing in that voice, fall back to the
  default voice's clip before ever falling back to browser TTS.
- Profile settings: four buttons (name + "American woman, warm", etc.), each plays a short sample line
  when tapped and saves the choice. Lamplight's chooser: `Web/src/06-ui.js` (`.voice-opt`).
- Size: Wonder Lab's corpus is about 340 MB per voice at the current bitrate. Four voices is over a GB, so
  either offer two voices, drop to 24 kbps, or download a voice's clips only when a profile picks it
  (Lamplight fetches one lesson's clips at a time from a separate host and never bundles them).

## 7. Optional: characters in their own voices

Lamplight reads quoted speech in a character's voice (men, women, God, Jesus, angels, children) and the
rest in the profile's narrator voice: `Content/dialogue.json` tags each quote, `Web/build.py` splits
paragraphs into turns, and the player plays the turns in order with a short pause between speakers. If
Wonder Lab's stories have quoted speech (explorers, scientists), the same pattern applies; for a fact app
it's probably not worth it.

## 8. Checklist

- [ ] `uv pip install` Kokoro into `.venv-tts`
- [ ] `KokoroEngine` in `tools/tts_engines.py`, `get_engine('kokoro')`
- [ ] list and fix guessed pronunciations (science names), re-run the whisper verify
- [ ] parallel workers for rendering
- [ ] per-voice manifests and `profile.voice` in the player, fallback to the default voice
- [ ] voice chooser in profile settings with sample lines
- [ ] decide the size plan (voices, bitrate, on-demand download)
