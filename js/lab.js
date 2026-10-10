// Wonder Lab 2 — the shared pieces every screen is built from:
// Fluent art, Pip (the mascot), a colour story for each world, the HUD,
// levels, toasts. Nothing in here knows about lessons or games.

const THEMES = {
  earth:    { top: '#e8743b', mid: '#b8452f', bot: '#3a1830', acc: '#ff9a52', accD: '#c9602a' },
  astro:    { top: '#5a46d8', mid: '#2b2292', bot: '#0a0a2e', acc: '#8d7bff', accD: '#5a46d8' },
  physical: { top: '#2f8cff', mid: '#1a56c9', bot: '#0b1f55', acc: '#4aa8ff', accD: '#1f6fd0' },
  micro:    { top: '#12b8a0', mid: '#0c7f8a', bot: '#07334a', acc: '#2fe0b4', accD: '#12a784' },
  ancient:  { top: '#d99a1e', mid: '#a8631a', bot: '#3d2412', acc: '#ffc247', accD: '#c98a12' },
  america:  { top: '#e5485d', mid: '#a02a55', bot: '#281545', acc: '#ff6f82', accD: '#c9304a' },
  world:    { top: '#2aa7d8', mid: '#1c6ab0', bot: '#0f2a5c', acc: '#45c4ec', accD: '#1b86b4' },
  economics:{ top: '#5cb03a', mid: '#2e7d3a', bot: '#123222', acc: '#86d95a', accD: '#4a9a2e' },
  body:     { top: '#ef5f8f', mid: '#b53a78', bot: '#3a1646', acc: '#ff86ab', accD: '#d04a78' },
  animals:  { top: '#f0a020', mid: '#c26a12', bot: '#4a2a0f', acc: '#ffbb3d', accD: '#d98a10' },
  plants:   { top: '#3cbf4a', mid: '#1f8a4a', bot: '#0c3a2c', acc: '#5fdc6c', accD: '#2fa23c' },
};

const WORLD_BLURB = {
  earth: 'Rocks, volcanoes, oceans and weather',
  astro: 'The sun, the planets and the stars',
  physical: 'Forces, light, sound and electricity',
  micro: 'The tiny living world under the lens',
  ancient: 'The first people and the first cities',
  america: 'The story of the United States',
  world: 'Explorers, empires and discoveries',
  economics: 'Money, trade and how work works',
  body: 'How your amazing body works',
  animals: 'Creatures from every corner of the earth',
  plants: 'Trees, flowers, fungi and friends',
};

// a few Fluent props to scatter beside each world's path
const WORLD_PROPS = {
  earth: ['🌋', '🏔️', '🪨', '🌲', '🌊'], astro: ['⭐', '🪐', '🌙', '☄️', '🛰️'],
  physical: ['⚡', '🧲', '💡', '🌈', '🔬'], micro: ['🦠', '🧫', '🔬', '🫧', '🧬'],
  ancient: ['🏺', '🏛️', '📜', '🐫', '⛵'], america: ['🦅', '🗽', '⭐', '🚂', '🌽'],
  world: ['🧭', '🗺️', '🚢', '🏰', '🌐'], economics: ['🪙', '📈', '🏪', '🌾', '🧮'],
  body: ['🫀', '🧠', '🦴', '👂', '👁️'], animals: ['🦁', '🐘', '🦒', '🐢', '🦉'],
  plants: ['🌻', '🌳', '🍄', '🌵', '🌸'],
};

Object.assign(App, {

  // ── Fluent art ────────────────────────────────────────────────────────
  _fxn: null,
  fx(e, cls) {
    if (!e) return '';
    if (!this._fxn) {
      this._fxn = {};
      if (typeof FX !== 'undefined') Object.keys(FX).forEach(k => { this._fxn[k.replace(/️/g, '')] = FX[k]; });
    }
    const key = String(e).replace(/️/g, '');
    const f = this._fxn[key];
    return f ? `<img class="fx ${cls || ''}" src="img/fx/${f}.svg" alt="" draggable="false">`
             : `<span class="fx-text ${cls || ''}">${e}</span>`;
  },
  fxSrc(e) {
    this.fx('');                      // make sure the table is built
    const f = this._fxn[String(e).replace(/️/g, '')];
    return f ? `img/fx/${f}.svg` : '';
  },

  // ── Pip ───────────────────────────────────────────────────────────────
  // A seed-sprite with a two-leaf sprout. States: '', happy, oops, wow, cheer.
  pip(state, cls) {
    const st = String(state || '');
    return `<svg class="mascot ${st} ${cls || ''}" viewBox="0 0 120 130" aria-hidden="true">
      <defs>
        <radialGradient id="pipG" cx="38%" cy="32%" r="80%">
          <stop offset="0" stop-color="#e4ff9a"/><stop offset=".55" stop-color="#8fe04f"/><stop offset="1" stop-color="#4fb43a"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="123" rx="34" ry="6" fill="rgba(0,0,0,.24)"/>
      <g class="pip-body">
        <ellipse cx="41" cy="115" rx="12" ry="6.5" fill="#4aa83c" stroke="#2e7d2a" stroke-width="2.5"/>
        <ellipse cx="79" cy="115" rx="12" ry="6.5" fill="#4aa83c" stroke="#2e7d2a" stroke-width="2.5"/>
        <g class="arms-down">
          <ellipse cx="12" cy="88" rx="9" ry="7" transform="rotate(-28 12 88)" fill="#7fd447" stroke="#3d9a30" stroke-width="2.5"/>
          <ellipse cx="108" cy="88" rx="9" ry="7" transform="rotate(28 108 88)" fill="#7fd447" stroke="#3d9a30" stroke-width="2.5"/>
        </g>
        <g class="arms-up">
          <ellipse cx="9" cy="62" rx="9" ry="7" transform="rotate(-62 9 62)" fill="#7fd447" stroke="#3d9a30" stroke-width="2.5"/>
          <ellipse cx="111" cy="62" rx="9" ry="7" transform="rotate(62 111 62)" fill="#7fd447" stroke="#3d9a30" stroke-width="2.5"/>
        </g>
        <path d="M60 36 C92 36 109 60 109 84 C109 106 89 119 60 119 C31 119 11 106 11 84 C11 60 28 36 60 36Z"
              fill="url(#pipG)" stroke="#3d9a30" stroke-width="3.5"/>
        <ellipse cx="60" cy="100" rx="27" ry="15" fill="#f4ffd4" opacity=".7"/>
        <path d="M60 38 C60 28 58 22 60 15" fill="none" stroke="#3d9a30" stroke-width="5" stroke-linecap="round"/>
        <g class="pip-leafL"><path d="M60 18 C44 4 25 10 22 25 C39 30 54 26 60 18Z" fill="#5fd04a" stroke="#2e8a2a" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M58 19 C48 15 38 17 31 22" fill="none" stroke="#2e8a2a" stroke-width="2" stroke-linecap="round"/></g>
        <g class="pip-leafR"><path d="M60 18 C76 3 97 9 100 24 C83 30 66 26 60 18Z" fill="#9aeb62" stroke="#2e8a2a" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M62 19 C72 15 82 17 89 22" fill="none" stroke="#2e8a2a" stroke-width="2" stroke-linecap="round"/></g>
        <g class="eye-open">
          <g class="pip-eye"><ellipse cx="42" cy="70" rx="11.5" ry="13.5" fill="#fff" stroke="#2d4a1c" stroke-width="2.5"/>
            <ellipse cx="44" cy="72" rx="6.5" ry="8.5" fill="#1d2b3a"/><circle cx="46.5" cy="68" r="2.8" fill="#fff"/><circle cx="41.5" cy="76" r="1.4" fill="#fff"/></g>
          <g class="pip-eye r"><ellipse cx="78" cy="70" rx="11.5" ry="13.5" fill="#fff" stroke="#2d4a1c" stroke-width="2.5"/>
            <ellipse cx="76" cy="72" rx="6.5" ry="8.5" fill="#1d2b3a"/><circle cx="78.5" cy="68" r="2.8" fill="#fff"/><circle cx="73.5" cy="76" r="1.4" fill="#fff"/></g>
        </g>
        <g class="e-happy"><path d="M31 74 Q42 58 53 74" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M67 74 Q78 58 89 74" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/></g>
        <g class="e-oops"><path d="M31 68 Q42 80 53 68" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M67 68 Q78 80 89 68" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/></g>
        <ellipse cx="27" cy="88" rx="7.5" ry="4.8" fill="#ff8fa8" opacity=".6"/>
        <ellipse cx="93" cy="88" rx="7.5" ry="4.8" fill="#ff8fa8" opacity=".6"/>
        <path class="m-idle" d="M50 89 Q60 99 70 89" fill="none" stroke="#2d4a1c" stroke-width="4" stroke-linecap="round"/>
        <g class="m-happy"><path d="M45 84 Q60 110 75 84 Z" fill="#8b2d3c" stroke="#2d4a1c" stroke-width="3" stroke-linejoin="round"/>
          <ellipse cx="60" cy="98" rx="7" ry="4.5" fill="#ff7a8f"/></g>
        <path class="m-oops" d="M50 97 Q60 86 70 97" fill="none" stroke="#2d4a1c" stroke-width="4" stroke-linecap="round"/>
        <ellipse class="m-wow" cx="60" cy="93" rx="7.5" ry="9.5" fill="#8b2d3c" stroke="#2d4a1c" stroke-width="3"/>
      </g></svg>`;
  },
  pipWrap(state, cls, style) {
    return `<span class="pip-wrap ${cls || ''}" ${style ? `style="${style}"` : ''}>${this.pip(state)}</span>`;
  },
  // animate the Pip(s) currently on screen
  pipReact(state, ms) {
    document.querySelectorAll('.pip-react .mascot').forEach(p => {
      p.classList.remove('happy', 'oops', 'wow', 'cheer', 'jump', 'shake');
      void p.getBoundingClientRect();
      if (state === 'happy') p.classList.add('happy', 'jump');
      else if (state === 'cheer') p.classList.add('happy', 'cheer', 'jump');
      else if (state === 'oops') p.classList.add('oops', 'shake');
      else if (state === 'wow') p.classList.add('wow');
      if (state) setTimeout(() => p.classList.remove('jump', 'shake'), ms || 1500);
    });
  },

  // ── worlds ────────────────────────────────────────────────────────────
  theme(courseId) { return THEMES[courseId] || THEMES.physical; },
  themeVars(courseId) {
    const t = this.theme(courseId);
    return `--w-top:${t.top};--w-mid:${t.mid};--w-bot:${t.bot};--w-acc:${t.acc};--w-acc-d:${t.accD}`;
  },
  setWorld(courseId) {
    const b = document.body, t = this.theme(courseId);
    if (!courseId) { b.classList.remove('in-world'); return; }
    b.style.setProperty('--w-top', t.top); b.style.setProperty('--w-mid', t.mid);
    b.style.setProperty('--w-bot', t.bot); b.style.setProperty('--w-acc', t.acc);
    b.style.setProperty('--w-acc-d', t.accD);
    b.classList.add('in-world');
  },
  worldProps(courseId) { return WORLD_PROPS[courseId] || ['⭐']; },
  worldBlurb(courseId) { return WORLD_BLURB[courseId] || ''; },

  // ── levels: 25·(L-1)² Sparks to reach level L ───────────────────────
  levelInfo(xp) {
    xp = Math.max(0, xp || 0);
    const lvl = Math.floor(Math.sqrt(xp / 25)) + 1;
    const base = 25 * (lvl - 1) ** 2, next = 25 * lvl ** 2;
    return { level: lvl, base, next, frac: (xp - base) / (next - base), into: xp - base, span: next - base };
  },
  totalStars() {
    return Object.values(Progress.p.lessons || {}).reduce((n, r) => n + (r.stars || 0), 0);
  },

  // ── HUD (streak, sparks, level) ──────────────────────────────────────
  hud(extra) {
    const p = Progress.p, xp = p.xp || 0, lv = this.levelInfo(xp), streak = p.dayStreak || 0;
    return `<header class="hud">
      <button class="hud-pill flame ${streak ? '' : 'off'}" onclick="App.go('notes')" aria-label="Day streak">${this.fx('🔥')}<span>${streak}</span></button>
      <button class="hud-pill" id="hudSparks" onclick="App.go('notes')" aria-label="Sparks">${this.fx('⚡')}<span>${xp}</span></button>
      <div class="hud-grow"></div>
      ${extra || ''}
      <button class="hud-level" onclick="App.go('notes')" aria-label="Level ${lv.level}">
        <span class="lv-n">${lv.level}</span><span class="lv-bar"><i style="width:${Math.round(lv.frac * 100)}%"></i></span></button>
    </header>`;
  },

  // ── small feedback pieces ────────────────────────────────────────────
  toast(html, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  },
  sparkFloat(text, el) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const s = document.createElement('div');
    s.className = 'spark-float'; s.textContent = text;
    s.style.left = (r.left + r.width / 2) + 'px'; s.style.top = (r.top) + 'px';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  },
  // animate a number from a to b inside el
  countUp(el, a, b, ms) {
    if (!el) return;
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / (ms || 900));
      el.textContent = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  haptic(n) { try { if (navigator.vibrate) navigator.vibrate(n || 12); } catch (e) { /* none on iOS */ } },

  // Plain, high-contrast speaker icons (currentColor) for every listen control.
  ico(kind) {
    const wave = '<path d="M16 8.5a5 5 0 0 1 0 7M18.6 5.8a8.8 8.8 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
    const body = '<path d="M3.5 9.2v5.6h3.9l5.1 4.2V5L7.4 9.2H3.5z" fill="currentColor"/>';
    const mute = '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
    const stop = '<rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor"/>';
    const inner = kind === 'stop' ? stop : kind === 'mute' ? body + mute : body + wave;
    return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  },

  // ── listen buttons (replaces the text-arrow version) ──
  _mkListen(label, parts) {
    const clean = parts.filter(p => p && String(p).trim());
    if (!clean.length) return '';
    const i = this._sayReg.push({ parts: clean, label }) - 1;
    const text = String(label || '').replace(/^[^A-Za-z0-9]+/, '');
    return `<button class="listen" data-say="${i}" aria-label="${text || 'Listen'}"
      onclick="event.stopPropagation();App.say(${i})">
      <span class="ic">${this.ico('speak')}</span><span class="lbl">${text}</span></button>`;
  },
  syncListen() {
    document.querySelectorAll('.listen, .goal-bar').forEach(b => {
      const on = +b.dataset.say === this._saying;
      b.classList.toggle('on', on);
      if (b.classList.contains('goal-bar')) return;
      const ic = b.querySelector('.ic');
      if (ic) ic.innerHTML = this.ico(on ? 'stop' : 'speak');
      const lbl = b.querySelector('.lbl');
      if (lbl) lbl.textContent = on ? 'Stop'
        : String(((this._sayReg[+b.dataset.say] || {}).label) || 'Listen').replace(/^[^A-Za-z0-9]+/, '');
    });
  },

  // confetti in the new palette
  confetti(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const hues = ['#ffc933', '#45b9ff', '#ff5360', '#3ec956', '#9a7bff', '#ff78a8', '#fff'];
    box.innerHTML = Array.from({ length: n }, (_, i) => `<i style="
      left:${6 + Math.random() * 88}%;
      background:${hues[i % hues.length]};
      width:${7 + Math.random() * 7}px;height:${9 + Math.random() * 9}px;
      animation-delay:${Math.random() * .3}s;
      animation-duration:${1.1 + Math.random() * .7}s;
      --drift:${(Math.random() * 2 - 1) * 120}px;
      --spin:${360 + Math.random() * 720}deg;"></i>`).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2300);
  },
});
