// AudioLib — plays pre-generated voice clips (audio/manifest.json).
//
// Nothing here uses the browser's speech synthesiser for real content. Every
// word, sentence, letter sound and letter name is a file generated at build
// time by tools/gen_audio.py with a neural voice.
//
// The app does NOT speak isolated letter sounds. Synthesised phonemes were
// inaccurate enough to teach the wrong thing — /a/ and /i/ came out nearly
// identical — and they sounded mechanical next to the neural voice. Everything
// the child hears is a whole word or a whole sentence, in one human voice.
//
// A teaching line is still an ordered list of segments, so prose and example
// words can be composed:
//
//   [{say:"Let's read some words."}, {word:'cat'}, {word:'sit'}]

// Where the ~4,750 clips are served from.
//
// The app runs on Vercel; the 194 MB of audio stays in the GitHub repo and is
// served by GitHub Pages, which already fronts a CDN and sends
// `access-control-allow-origin: *` — that header is what lets the service
// worker cache these cross-origin clips as normal responses instead of opaque
// ones. Nothing is preloaded either way: a clip is fetched the first time a
// child presses Listen, so this is a hosting number, not a download.
//
// Same-origin locally and on Pages itself, absolute everywhere else, so a dev
// server plays the clips sitting next to it.
const AUDIO_BASE = (function () {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('github.io')
      || location.protocol === 'file:') return 'audio/';
  return 'https://layorjunia.github.io/wonder-lab/audio/';
})();

const AudioLib = {
  manifest: null,      // { words: {normalised text -> file}, engine, voice }
  ready: false,
  _current: null,
  _queueToken: 0,
  _unlocked: false,

  init() {
    // Keep the promise, do not fire and forget. The reference sets `ready` and
    // never reads it, so a very first tap on a cold load resolves against a
    // null manifest and speaks in the browser voice. _playSeq awaits this.
    this.loading = fetch(AUDIO_BASE + 'manifest.json')
      .then(r => r.ok ? r.json() : null)
      .then(m => { this.manifest = m; this.ready = !!m; })
      .catch(() => { this.manifest = null; });
    // iOS needs a user gesture before audio may play — unlock on first tap
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      const a = new Audio();
      a.muted = true;
      a.play().catch(() => {});
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchend', unlock);
    document.addEventListener('click', unlock);
  },

  norm(text) {
    return String(text).toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  fileFor(text) {
    if (!this.manifest) return null;
    const k = this.norm(text);
    // Clip names drop apostrophes ("let's" is stored as "lets").
    return this.manifest.words[k] || this.manifest.words[k.replace(/'/g, '')] || null;
  },

  // Resolve text to playable items and report HOW it was resolved.
  //   'clip'     one pre-generated recording — the good case
  //   'stitched' several word clips concatenated — acceptable only for a bare
  //              word list, never for prose (it sounds robotic and chopped)
  //   'tts'      browser fallback — should never happen for shipped content
  resolve(text) {
    const f = this.fileFor(text);
    if (f) return { kind: 'clip', items: [{ file: f }] };

    const words = this.norm(text).split(/[^a-z']+/).filter(Boolean);
    const found = words.map(w => this.manifest &&
      (this.manifest.words[w] || this.manifest.words[w.replace(/'/g, '')]));
    // length >= 1 so trailing punctuation ("cat!") still finds the word clip
    // instead of silently dropping to browser speech.
    if (words.length >= 1 && found.every(Boolean)) {
      const items = [];
      found.forEach((file, i) => {
        if (i) items.push({ gap: 90 });
        items.push({ file });
      });
      return { kind: 'stitched', items };
    }
    return { kind: 'tts', items: [{ tts: text }] };
  },

  _itemsFor(text, opts) {
    const r = this.resolve(text);
    if (r.kind === 'tts' && opts && opts.rate) r.items[0].rate = opts.rate;
    return r.items;
  },

  stop() {
    this._queueToken++;
    if (this._current) { this._current.pause(); this._current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  },

  _playFile(file) {
    return new Promise(resolve => {
      const a = new Audio(AUDIO_BASE + file);
      this._current = a;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
  },

  // Resolves when whatever is currently speaking has finished. Screen changes
  // wait on this instead of a fixed timer — otherwise the next screen's audio
  // cancels the praise line halfway through, which is heard as it being
  // "cut off".
  _done: Promise.resolve(),
  done() { return this._done; },

  // Takes a thunk rather than a list: the items have to be resolved AFTER the
  // manifest lands, or a cold-start tap resolves every string to 'tts'.
  _playLater(makeItems) {
    this.stop();
    const token = this._queueToken;
    this._done = (async () => {
      await (this.loading || Promise.resolve()).catch(() => {});
      if (token !== this._queueToken) return;
      for (const it of makeItems()) {
        if (token !== this._queueToken) return;
        if (it.gap) { await new Promise(r => setTimeout(r, it.gap)); continue; }
        if (it.file) { await this._playFile(it.file); continue; }
        if (it.tts != null) { await this._tts(it.tts, it.rate); }
      }
    })();
    return this._done;
  },

  _playSeq(items) {
    this.stop();
    const token = this._queueToken;
    this._done = (async () => {
      for (const it of items) {
        if (token !== this._queueToken) return;
        if (it.gap) { await new Promise(r => setTimeout(r, it.gap)); continue; }
        if (it.file) { await this._playFile(it.file); continue; }
        if (it.tts != null) { await this._tts(it.tts, it.rate); }
      }
    })();
    return this._done;
  },

  _tts(text, rate) {
    return new Promise(resolve => {
      if (!window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.startsWith('en'));
      const v = vs.find(x => /Samantha/i.test(x.name)) || vs[0];
      if (v) u.voice = v;
      u.rate = rate || 0.92; u.pitch = 1.05;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.speak(u);
      setTimeout(resolve, 8000);
    });
  },

  speak(text, opts) { return this._playLater(() => this._itemsFor(text, opts)); },

  speakSeq(texts) {
    return this._playLater(() => {
      const items = [];
      texts.forEach((t, i) => {
        if (i) items.push({ gap: 220 });
        items.push(...this._itemsFor(t));
      });
      return items;
    });
  },

  // Play one authored string on demand, and report whether anything started.
  // Wonder Lab narrates by section rather than automatically, so a button needs
  // to know if it has audio before it offers itself.
  has(text) { return !!this.fileFor(text); },

  // Toggle: a second press on a playing section stops it rather than
  // restarting. Returns true if playback began.
  toggle(text) {
    if (this._playingKey === this.norm(text)) { this.stop(); this._playingKey = null; return false; }
    this._playingKey = this.norm(text);
    const token = this._queueToken + 1;
    this._playSeq(this._itemsFor(text)).then(() => {
      if (token === this._queueToken) this._playingKey = null;
    });
    return true;
  },

  playingKey: null,
  _playingKey: null,
};

// Sound effects are deliberately separate from speech: they must be able to
// overlap a spoken line rather than cancel it, and a fresh Audio per call lets
// rapid taps stack instead of cutting each other off.
const Sfx = {
  enabled: true,
  play(name, volume) {
    if (!this.enabled) return;
    try {
      const a = new Audio(AUDIO_BASE + 'sfx/' + name + '.m4a');
      a.volume = volume == null ? 0.75 : volume;
      a.play().catch(() => {});
    } catch (e) { /* audio not available yet */ }
  }
};

AudioLib.init();
