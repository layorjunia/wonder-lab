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

// 12 ms of 8 kHz silence. Played once on the first gesture purely to mark the
// shared element as user-initiated; short enough that nobody hears it.
const SILENCE = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAf'
  + 'AAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'
  + 'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'
  + 'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'
  + 'gICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

const AudioLib = {
  manifest: null,      // { words: {normalised text -> file}, engine, voice }
  ready: false,
  _current: null,
  _el: null,           // the one shared, gesture-unlocked <audio>
  _fin: null,          // resolver for the clip currently in flight
  _queueToken: 0,
  _unlocked: false,

  init() {
    // Keep the promise, do not fire and forget. The reference sets `ready` and
    // never reads it, so a very first tap on a cold load resolves against a
    // null manifest and speaks in the browser voice. _playSeq awaits this.
    // Version the manifest by build id. Without it the browser (and the
    // service worker, and Pages' own 10-minute cache) happily serve the
    // previous manifest after a re-render: the new clips are sitting on the
    // server, fileFor misses every one of them, and the app quietly speaks in
    // the browser voice while sounding perfect on a fresh load.
    const build = (document.querySelector('meta[name="build"]') || {}).content
                || (document.querySelector('meta[name="build"]')
                    && document.querySelector('meta[name="build"]').getAttribute('content'))
                || '';
    this.loading = fetch(AUDIO_BASE + 'manifest.json' + (build ? '?v=' + encodeURIComponent(build) : ''))
      .then(r => r.ok ? r.json() : null)
      .then(m => { this.manifest = m; this.ready = !!m; })
      .catch(() => { this.manifest = null; });
    // iOS gesture unlock. See el() for why this has to be the SAME element
    // every clip plays through, and why it fires in the capture phase.
    const EVENTS = ['pointerdown', 'touchend', 'click'];
    const unlock = () => {
      if (this._unlocked) return;
      // Synchronously, and exactly once. Waiting for the play() promise to
      // resolve looks more careful and is a bug: all three events fire for a
      // single tap, so the flag stayed false through the whole gesture and the
      // element got re-pointed at the silent clip three times. The Listen
      // handler then set the real src, Safari aborted the in-flight load, the
      // abort fired `error`, and _playFile read that as "clip finished" and
      // skipped it. Four choices, four instant skips, no sound, no error.
      this._unlocked = true;
      EVENTS.forEach(ev => document.removeEventListener(ev, unlock, true));
      const a = this.el();
      a.src = SILENCE;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      // Prime the sound-effect pool in the same gesture. Sfx used to mint a
      // fresh Audio per call — the exact trap that silenced the whole app on
      // iOS once already. A sound fired inside a tap survives that; the stamp
      // thunk (520 ms after render) and the deck fanfare (after a setTimeout)
      // fire OUTSIDE the gesture and would be silently killed.
      Sfx.prime();
    };
    // Capture, so the element is unlocked BEFORE the Listen button's own
    // handler runs — say() awaits the manifest before it plays, and by then
    // the gesture is over.
    EVENTS.forEach(ev => document.addEventListener(ev, unlock, true));
  },

  // ONE audio element for the whole app.
  //
  // iOS only lets an <audio> element play if play() was called on THAT element
  // during a user gesture. A fresh `new Audio()` per clip — which is what this
  // did — is therefore never unlocked: every play() rejects with
  // NotAllowedError, `.catch(() => resolve())` swallows it, the sequence runs
  // to completion in milliseconds, and the app is silent with nothing logged
  // and nothing on screen. It worked on every desktop browser and on no iPhone.
  //
  // Reusing one unlocked element and only swapping .src is the fix. It also
  // stops the app allocating an element per clip.
  el() {
    if (!this._el) {
      const a = new Audio();
      a.preload = 'auto';
      a.playsInline = true;       // never hand playback to the fullscreen player
      a.setAttribute('playsinline', '');
      this._el = a;
    }
    return this._el;
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
    if (this._el) { try { this._el.pause(); } catch (e) { /* nothing playing */ } }
    this._current = null;
    // Release whatever clip is in flight. With one shared element a pause
    // fires neither `ended` nor `error`, so without this the sequence's await
    // never settles and _done hangs forever — every later screen change then
    // waits on a promise that will not resolve.
    if (this._fin) { const f = this._fin; this._fin = null; f(); }
    if (window.speechSynthesis) speechSynthesis.cancel();
  },

  _playFile(file) {
    return new Promise(resolve => {
      const a = this.el();
      this._current = a;
      let done = false;
      let watchdog = 0;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        a.onended = a.onerror = null;
        if (this._fin === fin) this._fin = null;
        resolve();
      };
      this._fin = fin;
      a.onended = fin;
      // `error` with no a.error is an aborted load, not a broken clip — it
      // fires when something else re-points the element mid-load. Treating it
      // as the end of the clip is how a whole sequence used to evaporate
      // silently. Only a real MediaError ends playback.
      a.onerror = () => { if (a.error) fin(); };
      a.src = AUDIO_BASE + file;
      const p = a.play();
      if (p && p.catch) p.catch(() => fin());
      // Nothing above is guaranteed to fire. A clip that neither plays nor
      // errors would otherwise stall the whole sequence forever.
      watchdog = setTimeout(fin, 20000);
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
  _pool: [],
  _i: 0,

  // Four elements, all unlocked on the first gesture (AudioLib calls this).
  // Round-robin means up to four effects can overlap — a yes landing on a
  // ding — without any of them cutting another off.
  prime() {
    if (this._pool.length) return;
    for (let k = 0; k < 4; k++) {
      const a = new Audio();
      a.playsInline = true;
      a.setAttribute('playsinline', '');
      a.src = SILENCE;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      this._pool.push(a);
    }
  },

  play(name, volume) {
    if (!this.enabled) return;
    try {
      // Fall back to a bare element pre-gesture (desktop allows it; iOS will
      // refuse and that is correct — nothing should sound before a touch).
      const a = this._pool.length
        ? this._pool[this._i++ % this._pool.length]
        : new Audio();
      a.src = AUDIO_BASE + 'sfx/' + name + '.m4a';
      a.volume = volume == null ? 0.75 : volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* audio not available yet */ }
  }
};

// ── Offline packs ────────────────────────────────────────────────────────
// A tablet in a car has no signal, and clips are only cached once they have
// been heard. This walks a subject's clips and asks the service-worker cache
// to hold them, so a downloaded section works with the wifi off.
//
// It talks to caches directly rather than to the worker: the worker's own
// fetch handler already caches whatever goes through it, so simply fetching
// each clip in cors mode fills the same cache under the same key.
const Offline = {
  KEY: 'wonderlab:offline',
  // A cache of its own, and deliberately NOT the versioned one. The service
  // worker's cache name carries the build id and its activate step deletes
  // every other cache, so a pack stored there would be wiped by the next
  // deploy and the child would re-download the lot. This name never changes
  // and sw.js is told to leave it alone.
  CACHE: 'wonderlab-offline',

  done() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
           catch (e) { return {}; } },

  mark(id, bytes) {
    const d = this.done(); d[id] = bytes;
    localStorage.setItem(this.KEY, JSON.stringify(d));
  },

  has(id) { return !!this.done()[id]; },

  // Every distinct clip a set of strings resolves to. Deduplicated, because
  // section names and "Try it now" repeat on every card in the section.
  filesFor(texts) {
    const out = new Set();
    texts.forEach((t) => { const f = AudioLib.fileFor(t); if (f) out.add(f); });
    return [...out];
  },

  async download(id, texts, onProgress) {
    const files = this.filesFor(texts);
    if (!files.length) return { files: 0, bytes: 0 };
    let bytes = 0, n = 0;
    let cache = null;
    try { cache = await caches.open(this.CACHE); } catch (e) { /* no storage */ }
    if (!cache) return { files: 0, bytes: 0, failed: true };
    // Six at a time. Serial is slow enough on a phone to look broken; all at
    // once makes a few hundred simultaneous requests and Safari starts
    // dropping them.
    const queue = files.slice();
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          const url = AUDIO_BASE + f;
          // Already downloaded — skip it. This is what makes a second run
          // instant and a interrupted download resume where it stopped.
          if (cache && await cache.match(url)) { bytes += 42000; n++;
            if (onProgress) onProgress(n, files.length); continue; }
          const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
          // Write it ourselves. Relying on the worker's fetch handler to cache
          // it as a side effect meant that with no worker registered — a first
          // visit, or a browser where registration failed — the download
          // reported success and stored nothing at all.
          if (r.ok && r.status === 200 && cache) await cache.put(url, r.clone());
          if (r.ok) bytes += (+r.headers.get('content-length') || 0);
        } catch (e) { /* one missed clip is not a failed download */ }
        n++;
        if (onProgress) onProgress(n, files.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.mark(id, bytes);
    return { files: files.length, bytes };
  },

  // Every narratable string in the whole app, so "download everything" is one
  // button rather than ten. Deduplication happens in filesFor().
  allTexts() {
    const t = ['Try it now'];
    [CATEGORIES, KINDS, GROUPS, PLANT_GROUPS, BODY_SECTIONS, GAME_PHRASES]
      .forEach(m => { if (m) Object.values(m).forEach(v =>
        t.push(typeof v === 'string' ? v : v.name)); });
    const facts = (a) => a.forEach(x => {
      ['name', 'blurb', 'size', 'wonder', 'text', 'more', 'tryit']
        .forEach(k => { if (x[k]) t.push(x[k]); });
      (x.facts || []).forEach(f => { if (f.text) t.push(f.text);
                                     if (f.more) t.push(f.more); });
    });
    if (typeof ANIMALS !== 'undefined') facts(ANIMALS);
    if (typeof PLANTS !== 'undefined') facts(PLANTS);
    if (typeof BODY !== 'undefined') facts(BODY);
    if (typeof TOPIC_SETS !== 'undefined') {
      Object.values(TOPIC_SETS).forEach(ts => {
        const rows = globalThis[ts.data] || [];
        facts(rows);
        t.push(ts.name);
        Object.values(globalThis[ts.secs] || {}).forEach(s => t.push(s.name));
      });
    }
    if (typeof EXPEDITIONS !== 'undefined') EXPEDITIONS.forEach(x => {
      t.push(x.name, x.intro, x.outro);
      x.stops.forEach(st => { if (st.note) t.push(st.note); });
    });
    return t;
  },

  // What a pack will cost, before committing to it. Estimated from the
  // measured average rather than by asking the server 340 times.
  estimate(texts) { return this.filesFor(texts).length * 43000; },
};

AudioLib.init();
