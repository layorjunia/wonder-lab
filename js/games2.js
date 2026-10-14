// More games — the arcade set, plus the world Boss Battle.
//
//   sort    Sort It      drag animals into "lighter / heavier than you"
//   hilo    Which One?   two animals, one measurement, a streak
//   boss    Boss Battle  a whole world's questions against a boss (unlocks the medal)
//
// Same rules as js/games.js: the questions, answers, names and clues are lesson
// text that already has a recorded clip; the few fixed prompts are in GPHR.
// Every engine has a `…Pick/…Place` entry point so tools/selftest.js can play it.

Object.assign(App.GPHR, {
  sortTitle: 'Sort it',
  sortHelp: 'Drag each one to the box where it belongs.',
  sortLess_weight: 'Lighter than you', sortMore_weight: 'Heavier than you',
  sortLess_length: 'Shorter than you', sortMore_length: 'Longer than you',
  sortLess_speed: 'Slower than you', sortMore_speed: 'Faster than you',
  sortLess_life: 'Lives a shorter time', sortMore_life: 'Lives longer',
  hiloTitle: 'Which one?',
  hiloMore_weight: 'Which one is heavier?', hiloLess_weight: 'Which one is lighter?',
  hiloMore_length: 'Which one is longer?', hiloLess_length: 'Which one is shorter?',
  hiloMore_speed: 'Which one is faster?', hiloLess_speed: 'Which one is slower?',
  hiloMore_life: 'Which one lives longer?', hiloLess_life: 'Which one lives a shorter time?',
  hiloMore_height: 'Which one is taller?', hiloLess_height: 'Which one is shorter?',
  bossTitle: 'Boss battle',
  bossHelp: 'Answer questions to hit the boss. Three wrong answers and the boss wins.',
  bossStrike: 'Tap Strike when the star is in the green!',
  bossCrit: 'Critical hit!',
  bossSuper: 'Super attack!',
  bossAngry: 'Watch out! The boss is getting angry!',
  bossWin: 'You beat the boss!',
  bossLose: 'The boss won this time. Try again!',
  bossName_earth: 'Rumble the Volcano', bossName_astro: 'Comet Crusher',
  bossName_physical: 'Static the Spark', bossName_micro: 'Germ Gloop',
  bossName_ancient: 'The Stone Guardian', bossName_america: 'Eagle Eye', bossName_utah: 'The Queen Bee',
  bossName_world: 'Captain Compass', bossName_economics: 'The Coin Dragon',
  bossName_body: 'Sneezy the Germ', bossName_animals: 'The Great Beast',
  bossName_plants: 'Thorn the Tangle',
});

const BOSS_ICON = { earth: '🌋', astro: '☄️', physical: '⚡', micro: '🦠', ancient: '🗿', america: '🦅', utah: '🐝',
  world: '🧭', economics: '🪙', body: '🤧', animals: '🦖', plants: '🌵' };

Object.assign(App.GAMES, {
  sort:  { name: 'Sort It',  glyph: '⚖️', blurb: 'Lighter or heavier than you?' },
  hilo:  { name: 'Which One?', glyph: '🆚', blurb: 'Two animals, one winner, a streak' },
});

App.GAMEX = {};     // kind -> { build(g, lessons, ctx), render() }

Object.assign(App, {

  // ── what each new game is built from ─────────────────────────────────
  // Multiple-choice questions a lesson has already asked (never the quiz that
  // follows the game, so a lesson's game does not give its quiz away). A question
  // that only tests remembering a figure (q.fig, see tools/qkind.py) is left out:
  // it is fine right after the page that gave the number, and a guess anywhere else.
  qPool(lessons, withQuiz) {
    const out = [];
    lessons.forEach(L => {
      (L.pages || []).forEach(p => (p.blocks || []).forEach(b => {
        if (b.t === 'check' && b.q && b.q.options && b.q.options.length >= 3 && b.q.type !== 'tf' && !b.q.fig) out.push(b.q);
      }));
      if (withQuiz) (L.quiz || []).forEach(q => { if (q.options && q.options.length >= 3 && q.type !== 'tf' && !q.fig) out.push(q); });
    });
    return out;
  },
  // three options, the right one among them, as {prompt, opts, ans, explain}
  qItem(q) {
    const right = q.options[q.answer];
    const wrong = this.shuffle(q.options.filter((_, i) => i !== q.answer)).slice(0, 2);
    const opts = this.shuffle([right, ...wrong]);
    return { prompt: q.prompt, opts, ans: opts.indexOf(right), explain: q.explain || '' };
  },
  sortChoices(species) {
    const REF = { weight: 70, length: 4.5, speed: 10, life: 9 };
    const out = [];
    Object.keys(REF).forEach(st => {
      const near = species.filter(a => a.stats && a.stats[st] > 0 && (a.stats[st] / REF[st] > 1.5 || a.stats[st] / REF[st] < 0.67));
      const less = near.filter(a => a.stats[st] < REF[st]), more = near.filter(a => a.stats[st] > REF[st]);
      if (less.length >= 2 && more.length >= 2) out.push(st);
    });
    return { REF, stats: out };
  },
  hiloRounds(species, n) {
    const out = [];
    const stats = Object.keys(this.STATS).filter(st => st !== 'height' || species.some(a => a.stats && a.stats.height));
    for (let t = 0; t < 120 && out.length < n; t++) {
      const st = this.pick(stats);
      const have = species.filter(a => a.stats && a.stats[st] > 0);
      if (have.length < 2) continue;
      const [a, b] = this.shuffle(have).slice(0, 2);
      const ratio = Math.max(a.stats[st], b.stats[st]) / Math.min(a.stats[st], b.stats[st]);
      if (ratio < 1.5) continue;
      if (out.some(r => (r.a.id === a.id && r.b.id === b.id) || (r.a.id === b.id && r.b.id === a.id))) continue;
      out.push({ stat: st, more: out.length % 2 === 0, a, b });
    }
    return out;
  },

  // ── eligibility: extend js/games.js ──────────────────────────────────
  gameKinds(L) {
    const out = [];
    if (this.gamePairs(L)) out.push('pairs');
    const sp = this.gameSpecies(L);
    if (sp.length >= 3 && sp.filter(a => this.speciesClue(a)).length >= 3) out.push('whoami');
    if (this.rankStats(sp).length) out.push('rank');
    if (this.sortChoices(sp).stats.length) out.push('sort');
    if (this.hiloRounds(sp, 3).length >= 3) out.push('hilo');
    return out;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// SORT IT   (animals and plants: lighter or heavier than you)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.sort = {
  build(g, lessons, ctx) {
    const species = lessons.flatMap(L => this.gameSpecies(L));
    const { REF, stats } = this.sortChoices(species);
    const st = this.pick(stats);
    const cand = species.filter(a => a.stats && a.stats[st] > 0 && (a.stats[st] / REF[st] > 1.5 || a.stats[st] / REF[st] < 0.67))
      .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
    const less = this.shuffle(cand.filter(a => a.stats[st] < REF[st])).slice(0, 3);
    const more = this.shuffle(cand.filter(a => a.stats[st] > REF[st])).slice(0, 3);
    g.stat = st;
    g.ref = REF[st];
    g.items = this.shuffle([...less.map(a => ({ a, bin: 0 })), ...more.map(a => ({ a, bin: 1 }))]);
    g.total = g.items.length;
    g.placed = 0; g.sel = null; g.miss = {};
  },
  render() { this.gmSort(); },
};
Object.assign(App, {
  gmSort() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    const st = g.stat, S = this.STATS[st];
    const lessTxt = this.GPHR['sortLess_' + st], moreTxt = this.GPHR['sortMore_' + st];
    const refTxt = st === 'weight' ? 'about 70 lb (32 kg)' : st === 'length' ? 'about 4.5 ft (1.4 m)'
      : st === 'speed' ? 'about 10 mph (16 km/h)' : 'about 9 years';
    el.innerHTML = `${this.gameTop(g, `${g.placed} / ${g.total}`)}
      <div class="gm-wrap so-wrap">
        ${this.gameHead(this.GPHR.sortTitle, this.GPHR.sortHelp)}
        <div class="so-bins">
          <button class="so-bin" data-bin="0" onclick="App.gmSortBin(0)">${this.fx('⬇️')}<b>${lessTxt}</b><small>than ${refTxt}</small><span class="so-pile" id="pile0"></span></button>
          <button class="so-bin" data-bin="1" onclick="App.gmSortBin(1)">${this.fx('⬆️')}<b>${moreTxt}</b><small>than ${refTxt}</small><span class="so-pile" id="pile1"></span></button>
        </div>
        <div class="so-tray" id="soTray">${g.items.map((it, k) =>
          `<button class="so-chip" data-k="${k}" onclick="App.gmSortChip(${k})" id="chip${k}">
             <img src="${this.pic(it.a)}" alt=""><span>${it.a.name}</span></button>`).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR.sortTitle, this.GPHR.sortHelp, lessTxt, moreTxt]);
    // drag and drop: pick up a chip, drop it on a box
    const tray = document.getElementById('soTray');
    let dragK = null, ghost = null;
    const bins = () => [...document.querySelectorAll('.so-bin')].map(b => b.getBoundingClientRect());
    tray.addEventListener('pointerdown', e => {
      const c = e.target.closest('.so-chip'); if (!c || c.disabled) return;
      dragK = +c.dataset.k;
      ghost = c.cloneNode(true); ghost.classList.add('so-ghost');
      document.body.appendChild(ghost);
      ghost.style.transform = `translate(${e.clientX - 50}px, ${e.clientY - 30}px)`;
      c.classList.add('lift');
      e.preventDefault();
    });
    window.addEventListener('pointermove', this._soMove = e => {
      if (ghost) ghost.style.transform = `translate(${e.clientX - 50}px, ${e.clientY - 30}px)`;
    });
    window.addEventListener('pointerup', this._soUp = e => {
      if (dragK == null) return;
      const k = dragK; dragK = null;
      if (ghost) { ghost.remove(); ghost = null; }
      const c = document.getElementById('chip' + k); if (c) c.classList.remove('lift');
      const bi = bins().findIndex(b => e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom);
      if (bi >= 0) this.gmSortPlace(k, bi);
    });
    this._sortCleanup = () => {
      window.removeEventListener('pointermove', this._soMove);
      window.removeEventListener('pointerup', this._soUp);
    };
  },
  gmSortChip(k) {            // tap-to-select, then tap a box
    const g = this._game; if (!g || g.kind !== 'sort') return;
    document.querySelectorAll('.so-chip').forEach(c => c.classList.remove('sel'));
    const c = document.getElementById('chip' + k);
    if (c && !c.disabled) { g.sel = k; c.classList.add('sel'); this.speakNow([g.items[k].a.name], true); }
  },
  gmSortBin(bi) {
    const g = this._game; if (!g || g.kind !== 'sort' || g.sel == null) return;
    this.gmSortPlace(g.sel, bi);
  },
  gmSortPlace(k, bi) {
    const g = this._game, it = g.items[k];
    const chip = document.getElementById('chip' + k);
    if (!it || !chip || chip.disabled) return false;
    g.sel = null;
    document.querySelectorAll('.so-chip').forEach(c => c.classList.remove('sel'));
    if (it.bin === bi) {
      chip.disabled = true; chip.classList.add('placed');
      const pile = document.getElementById('pile' + bi);
      const done = document.createElement('div');
      done.className = 'so-done';
      done.innerHTML = `<img src="${this.pic(it.a)}" alt=""><span>${it.a.name}<small>${this.statLabel(g.stat, it.a.stats[g.stat])}</small></span>`;
      pile.appendChild(done);
      chip.style.display = 'none';
      g.placed++;
      if (!g.miss[k]) g.right++;
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${g.placed} / ${g.total}`;
      Sfx.play('yes', 0.4); this.haptic(12); this.speakNow([it.a.name], true);
      if (g.placed >= g.total) {
        if (this._sortCleanup) this._sortCleanup();
        g.idx = g.total;
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.PHR.pairsDone}</div>`;
        this.confetti(18); Sfx.play('tada', 0.4);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 1800);
      }
      return true;
    }
    g.miss[k] = true;
    chip.classList.add('wrong'); setTimeout(() => chip.classList.remove('wrong'), 450);
    Sfx.play('no', 0.35); this.haptic(30);
    return false;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// WHICH ONE?   (two animals, one measurement, a streak)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.hilo = {
  build(g, lessons, ctx) {
    const species = lessons.flatMap(L => this.gameSpecies(L)).filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
    g.items = this.hiloRounds(species, ctx === 'hub' ? 8 : 6);
    g.total = g.items.length;
    g.streak = 0;
  },
  render() { this.gmHilo(); },
};
Object.assign(App, {
  gmHilo() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false;
    const prompt = this.GPHR[(r.more ? 'hiloMore_' : 'hiloLess_') + r.stat];
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap hl-wrap">
        <div class="gm-head"><h1 class="gm-title">${prompt}</h1>
          <p class="gm-help">${this.listenLabel('Hear it', prompt)}${g.streak >= 2 ? ` <span class="hl-streak">${this.fx('🔥')} ${g.streak} in a row</span>` : ''}</p></div>
        <div class="hl-pair">
          ${[r.a, r.b].map((a, i) => `<button class="hl-card" data-i="${i}" onclick="App.gmHiloPick(${i})">
            <img src="${this.pic(a)}" alt=""><b>${a.name}</b><small class="hl-val"></small></button>`).join('')}
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .gm-help .listen');
  },
  gmHiloPick(i) {
    const g = this._game; if (!g || g.kind !== 'hilo' || g.locked) return false;
    const r = g.items[g.idx], pick = i === 0 ? r.a : r.b, other = i === 0 ? r.b : r.a;
    const win = r.more ? pick.stats[r.stat] > other.stats[r.stat] : pick.stats[r.stat] < other.stats[r.stat];
    g.locked = true;
    const cards = document.querySelectorAll('.hl-card');
    [r.a, r.b].forEach((a, k) => { cards[k].querySelector('.hl-val').textContent = this.statLabel(r.stat, a.stats[r.stat]); });
    cards[i].classList.add(win ? 'right' : 'wrong');
    if (!win) cards[1 - i].classList.add('right');
    this.speakNow([pick.name], true);
    if (win) { g.streak++; Sfx.play('yes', 0.5); this.pipReact('happy'); if (g.streak >= 3) this.confetti(10); }
    else { g.streak = 0; Sfx.play('no', 0.35); this.haptic(30); }
    this.gameNextRound(win, 1700);
    return win;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// BOSS BATTLE
//
// A turn is: read the question -> tap an answer -> (right) power-strike meter,
// Pip attacks, the boss reels; (wrong) the boss attacks Pip. Every third right
// answer in a row is a Super Attack; tapping Strike with the star in the green
// is a critical hit. The boss gets angry at half health. Win = boss at 0,
// lose = Pip out of hearts (or the questions run out first).
//
// phases: ask -> strike (right answers only) -> anim -> fb -> (next) ask | end
// ═════════════════════════════════════════════════════════════════════════
const BOSS_ACC = { earth: 'horns', astro: 'antenna', physical: 'antenna', micro: 'antenna', ancient: 'crown',
  america: 'crown', utah: 'horns', world: 'horns', economics: 'crown', body: 'horns', animals: 'horns', plants: 'antenna' };
// body colours chosen to stand OUT from each world's background, not match it
const BOSS_COLOR = { earth: ['#b78bff', '#6a3ad0'], astro: ['#ffb347', '#e0701a'], physical: ['#ffe066', '#e0a010'],
  micro: ['#ff8ec4', '#d03a86'], ancient: ['#5fe0cc', '#1f9a8a'], america: ['#6fa8ff', '#2a62d9'],
  utah: ['#ffd95a', '#e0a010'], world: ['#ff9a73', '#e0502e'], economics: ['#ffd84a', '#e8a317'],
  body: ['#5fe0cc', '#1f9a8a'], animals: ['#b78bff', '#6a3ad0'], plants: ['#ff7a96', '#d03050'] };
const BOSS_HP = 12, BOSS_QS = 12;

Object.assign(App, {
  bossReady(courseId) {
    const ls = this.lessonsFor(courseId);
    return ls.length > 0 && ls.every(l => this.lessonStars(l.id) > 0);
  },
  bossPool(courseId) {
    const ls = this.lessonsFor(courseId);
    return this.qPool(ls, true);
  },
  bossStart(courseId) {
    const pool = this.shuffle(this.bossPool(courseId));
    if (pool.length < 6) { this.toast(`${this.fx('🔒')} This boss is not ready yet`); return; }
    this.closeSheet();
    this.setWorld(courseId);
    this.resetSay();
    const old = document.getElementById('lessonOverlay'); if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'pl pip-react'; wrap.id = 'lessonOverlay';
    document.body.appendChild(wrap);
    const items = pool.slice(0, BOSS_QS).map(q => this.qItem({ ...q, options: q.options.slice(0, 4) }));
    this._lesson = null;
    this._game = { kind: 'boss', ctx: 'hub', course: courseId, items, idx: 0, total: items.length, right: 0,
      hearts: 3, hp: BOSS_HP, hpMax: BOSS_HP, locked: false, lessons: [], combo: 0, rage: false,
      phase: 'ask', crits: 0, supers: 0, strikeDmg: 1 };
    this.gmBoss();
  },
  bossName(courseId) { return this.GPHR['bossName_' + courseId] || 'The Boss'; },

  // The boss itself: a round body in the world's colours with a face, arms, an
  // accessory, and the world's emblem on its belly. The mood is a CSS class, so
  // the face changes (grin / ouch / angry / laughing / knocked out) with no redraw.
  bossArt(courseId) {
    const col = BOSS_COLOR[courseId] || ['#ffd84a', '#e8a317'], acc = BOSS_ACC[courseId] || 'horns';
    const t = { acc: col[0], accD: col[1] };
    const dark = '#2b1a3a', gid = 'bbg' + courseId;
    const ACC = {
      horns: `<path d="M50 62 L34 14 L82 46Z" fill="#fff6d8" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
              <path d="M150 62 L166 14 L118 46Z" fill="#fff6d8" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>`,
      crown: `<path d="M56 56 L58 14 L80 36 L100 6 L120 36 L142 14 L144 56Z" fill="#ffc933" stroke="#9a5a10" stroke-width="5" stroke-linejoin="round"/>
              <circle cx="58" cy="14" r="6" fill="#ff5360"/><circle cx="100" cy="7" r="6" fill="#45b9ff"/><circle cx="142" cy="14" r="6" fill="#ff5360"/>`,
      antenna: `<path d="M78 50 Q66 22 48 16" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>
                <circle cx="46" cy="14" r="10" fill="#ffd84a" stroke="${dark}" stroke-width="4"/>
                <path d="M122 50 Q134 22 152 16" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>
                <circle cx="154" cy="14" r="10" fill="#ffd84a" stroke="${dark}" stroke-width="4"/>`,
    }[acc];
    const eye = (cx) => `<g class="b-eye"><ellipse cx="${cx}" cy="104" rx="19" ry="22" fill="#fff" stroke="${dark}" stroke-width="4"/>
        <ellipse class="b-pupil" cx="${cx - 4}" cy="108" rx="9" ry="12" fill="#1d2b3a"/>
        <circle cx="${cx - 1}" cy="102" r="3.4" fill="#fff"/></g>`;
    return `<svg class="boss-art" viewBox="0 0 200 224" aria-hidden="true">
      <defs><radialGradient id="${gid}" cx="36%" cy="28%" r="88%">
        <stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".3" stop-color="${t.acc}"/><stop offset="1" stop-color="${t.accD}"/>
      </radialGradient></defs>
      <ellipse cx="100" cy="212" rx="64" ry="9" fill="rgba(0,0,0,.3)"/>
      <g class="b-body">
        <ellipse cx="62" cy="202" rx="24" ry="12" fill="${t.accD}" stroke="${dark}" stroke-width="5"/>
        <ellipse cx="138" cy="202" rx="24" ry="12" fill="${t.accD}" stroke="${dark}" stroke-width="5"/>
        <g class="b-arm l"><ellipse cx="22" cy="138" rx="17" ry="12" transform="rotate(-32 22 138)" fill="${t.acc}" stroke="${dark}" stroke-width="5"/></g>
        <g class="b-arm r"><ellipse cx="178" cy="138" rx="17" ry="12" transform="rotate(32 178 138)" fill="${t.acc}" stroke="${dark}" stroke-width="5"/></g>
        ${ACC}
        <path d="M100 40 C154 40 188 84 188 136 C188 184 152 208 100 208 C48 208 12 184 12 136 C12 84 46 40 100 40Z"
              fill="url(#${gid})" stroke="${dark}" stroke-width="6"/>
        <ellipse cx="100" cy="164" rx="50" ry="36" fill="#fff" opacity=".3"/>
        <g class="b-face">
          ${eye(68)}${eye(132)}
          <path class="b-ko" d="M54 90 L82 118 M82 90 L54 118 M118 90 L146 118 M146 90 L118 118" stroke="${dark}" stroke-width="7" stroke-linecap="round" fill="none"/>
          <path class="b-brow l" d="M46 76 L88 90" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>
          <path class="b-brow r" d="M154 76 L112 90" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>
          <path class="b-m idle" d="M72 140 Q100 166 128 140" fill="#7a1d2a" stroke="${dark}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="b-m angry" d="M68 150 L80 136 L92 150 L104 136 L116 150 L128 136 L134 150" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
          <ellipse class="b-m hurt" cx="100" cy="148" rx="13" ry="16" fill="#7a1d2a" stroke="${dark}" stroke-width="5"/>
          <path class="b-m laugh" d="M64 136 Q100 190 136 136Z" fill="#7a1d2a" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
          <path class="b-m ko" d="M70 150 Q85 140 100 150 T130 150" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
        </g>
      </g>
    </svg>`;
  },

  bossHpHTML(g) {
    return Array.from({ length: g.hpMax }, (_, k) => `<i class="${k < g.hp ? '' : 'off'}"></i>`).join('');
  },
  bossHeartsHTML(g) {
    return [0, 1, 2].map(k => `<i class="${k < g.hearts ? '' : 'spent'}">${this.fx('❤️')}</i>`).join('');
  },

  gmBoss() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.phase = 'ask';
    const t = this.theme(g.course);
    const props = (WORLD_PROPS[g.course] || []).slice(0, 4).map((e, k) =>
      `<span class="bb-prop p${k}">${this.fx(e)}</span>`).join('');
    el.innerHTML = `
      <div class="pl-top"><button class="pl-x" onclick="App.bossQuit()" aria-label="Close">✕</button>
        <div class="bb-title">${this.GPHR.bossTitle}</div>${this.autoBtn()}</div>
      <div class="bb" style="--b-top:${t.top};--b-mid:${t.mid};--b-bot:${t.bot};--b-acc:${t.acc}">
        <div class="bb-arena ${g.rage ? 'rage' : ''}" id="bbArena">
          ${props}
          <div class="bb-hud"><span class="bb-name">${this.bossName(g.course)}</span>
            <div class="bb-hp" id="bbHp">${this.bossHpHTML(g)}</div></div>
          <div class="bb-boss ${g.idx === 0 ? 'enter' : ''}" id="bbBoss" data-mood="${g.rage ? 'angry' : 'idle'}">
            ${this.bossArt(g.course)}<div class="bb-emblem">${this.fx(BOSS_ICON[g.course] || '👾')}</div></div>
          <div class="bb-pip pip-react" id="bbPip">${this.pip('')}</div>
          <div class="bb-hearts" id="bbHearts">${this.bossHeartsHTML(g)}</div>
          <div class="bb-fx" id="bbFx"></div>
          <div class="bb-banner" id="bbBanner"></div>
        </div>
        <div class="bb-card" id="bbCard">
          <div class="bb-turn">Your move · ${g.idx + 1} of ${g.total}</div>
          <p class="gm-q">${r.prompt}</p>
          <div class="bb-listen">${this.listenLabel('Hear it', r.prompt, ...r.opts)}</div>
          <div class="answer-list" style="margin-top:12px">
            ${r.opts.map((o, i) => `<div class="answer-row"><button class="answer" id="ba${i}" onclick="App.gmBossPick(${i})">${o}</button>${this.listenLabel('', o)}</div>`).join('')}
          </div>
        </div>
      </div>`;
    this.syncListen();
    if (g.idx === 0) {
      Sfx.play('whoosh', 0.5);
      this.speakNow([this.GPHR.bossTitle, this.bossName(g.course)]);
    } else this.autoPlay('#lessonOverlay .bb-listen .listen');
  },

  // ── little helpers for the show ──────────────────────────────────────
  bossMood(m) { const b = document.getElementById('bbBoss'); if (b) b.dataset.mood = m; },
  bossBanner(text, cls) {
    const b = document.getElementById('bbBanner'); if (!b) return;
    b.className = 'bb-banner'; void b.offsetWidth;
    b.textContent = text; b.classList.add('show', cls || '');
  },
  bossPop(text, anchorId, cls) {
    const fx = document.getElementById('bbFx'), a = document.getElementById(anchorId);
    if (!fx || !a) return;
    const f = fx.getBoundingClientRect(), r = a.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'bb-pop ' + (cls || ''); d.textContent = text;
    d.style.left = (r.left - f.left + r.width / 2) + 'px'; d.style.top = (r.top - f.top + r.height * 0.2) + 'px';
    fx.appendChild(d); setTimeout(() => d.remove(), 1200);
  },
  // a projectile from one element's centre to another's
  bossFly(fromId, toId, html, ms) {
    const fx = document.getElementById('bbFx'), a = document.getElementById(fromId), b = document.getElementById(toId);
    if (!fx || !a || !b) return;
    const f = fx.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const x0 = ra.left - f.left + ra.width / 2, y0 = ra.top - f.top + ra.height / 2;
    const x1 = rb.left - f.left + rb.width / 2, y1 = rb.top - f.top + rb.height / 2;
    const p = document.createElement('div');
    p.className = 'bb-proj'; p.innerHTML = html;
    p.style.left = x0 + 'px'; p.style.top = y0 + 'px';
    fx.appendChild(p);
    if (p.animate) {
      p.animate([
        { transform: 'translate(-50%,-50%) scale(.5) rotate(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${(x1 - x0) / 2}px), calc(-50% + ${(y1 - y0) / 2 - 46}px)) scale(1.2) rotate(180deg)`, opacity: 1, offset: .5 },
        { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(1) rotate(360deg)`, opacity: 1 }
      ], { duration: ms || 520, easing: 'ease-in', fill: 'forwards' });
    }
    setTimeout(() => p.remove(), (ms || 520) + 40);
  },
  _bossShake() {
    const a = document.getElementById('bbArena'); if (!a) return;
    a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
  },

  gmBossPick(i) {
    const g = this._game; if (!g || g.kind !== 'boss' || g.phase !== 'ask' || g.locked) return false;
    const r = g.items[g.idx], ok = i === r.ans;
    g.locked = true; g.lastOk = ok;
    document.querySelectorAll('.bb-card .answer').forEach((b, k) => {
      b.disabled = true; if (k === r.ans) b.classList.add('right'); else if (k === i) b.classList.add('wrong');
    });
    if (ok) {
      g.right++; g.combo++;
      Sfx.play('yes', 0.5); this.haptic(20);
      g.phase = 'strike';
      this.bossShowStrike(g);
    } else {
      g.combo = 0;
      Sfx.play('no', 0.4);
      g.phase = 'anim';
      this.bossHitsPip(g, r);
    }
    return ok;
  },

  // right answer -> the power meter: tap Strike while the star is in the green
  bossShowStrike(g) {
    const card = document.getElementById('bbCard'); if (!card) return;
    const supercharged = g.combo > 0 && g.combo % 3 === 0;
    const extra = card.querySelector('.bb-strike-box'); if (extra) extra.remove();
    const box = document.createElement('div');
    box.className = 'bb-strike-box';
    box.innerHTML = `
      <div class="bb-strike-msg">${supercharged ? this.fx('🌟') + ' ' + this.GPHR.bossSuper : this.fx('⚡') + ' ' + this.GPHR.bossStrike}</div>
      <div class="bb-track" id="bbTrack"><i class="zone" id="bbZone"></i><b class="marker" id="bbMarker">${this.fx('⭐')}</b></div>
      <button class="cta pulse bb-strike" id="bbStrikeBtn" onclick="App.bossStrike()">Strike!</button>`;
    card.appendChild(box);
    this.pipReact('happy');
    if (g.idx === 0 || !g.explainedStrike) { g.explainedStrike = true; this.speakNow([supercharged ? this.GPHR.bossSuper : this.GPHR.bossStrike]); }
    else if (supercharged) this.speakNow([this.GPHR.bossSuper]);
  },
  bossStrike() {
    const g = this._game; if (!g || g.kind !== 'boss' || g.phase !== 'strike') return;
    g.phase = 'anim';
    let crit = false;
    const m = document.getElementById('bbMarker'), z = document.getElementById('bbZone');
    if (m && z) {
      const a = m.getBoundingClientRect(), b = z.getBoundingClientRect(), c = a.left + a.width / 2;
      crit = c >= b.left && c <= b.right;
    }
    const btn = document.getElementById('bbStrikeBtn'); if (btn) btn.disabled = true;
    this.bossAttack(g, crit);
  },

  async bossAttack(g, crit) {
    const supercharged = g.combo > 0 && g.combo % 3 === 0;
    const dmg = 1 + (crit ? 1 : 0) + (supercharged ? 1 : 0);
    g.hp = Math.max(0, g.hp - dmg);
    if (crit) g.crits++; if (supercharged) g.supers++;
    const pip = document.getElementById('bbPip');
    if (pip) { pip.classList.remove('lunge'); void pip.offsetWidth; pip.classList.add('lunge'); }
    Sfx.play('whoosh', 0.55);
    this.bossFly('bbPip', 'bbBoss', this.fx(supercharged ? '🌟' : crit ? '💥' : '⭐'), 480);
    await this._sleep(430);
    if (this._game !== g) return;
    // impact
    const boss = document.getElementById('bbBoss');
    if (boss) { boss.classList.remove('hit'); void boss.offsetWidth; boss.classList.add('hit'); }
    this.bossMood('hurt'); this._bossShake();
    Sfx.play(crit || supercharged ? 'stamp' : 'pop', 0.7); this.haptic(supercharged ? 40 : 22);
    const hp = document.getElementById('bbHp');
    if (hp) hp.querySelectorAll('i').forEach((s, k) => s.classList.toggle('off', k >= g.hp));
    this.bossPop('-' + dmg, 'bbBoss', crit || supercharged ? 'big' : '');
    if (supercharged) { this.bossBanner(this.GPHR.bossSuper, 'super'); this.confetti(14); }
    else if (crit) { this.bossBanner(this.GPHR.bossCrit, 'crit'); }
    await this._sleep(supercharged || crit ? 900 : 650);
    if (this._game !== g) return;
    if (g.hp <= 0) return this.bossKO(g);
    if (!g.rage && g.hp <= g.hpMax / 2) {
      g.rage = true;
      document.getElementById('bbArena') && document.getElementById('bbArena').classList.add('rage');
      this.bossMood('angry');
      this.bossBanner(this.GPHR.bossAngry, 'angry');
      Sfx.play('no', 0.35);
      this.speakNow([this.GPHR.bossAngry]);
      await this._sleep(1100);
      if (this._game !== g) return;
    } else this.bossMood(g.rage ? 'angry' : 'idle');
    this.bossFeedback(g);
  },

  async bossKO(g) {
    this.bossMood('ko');
    const boss = document.getElementById('bbBoss'); if (boss) boss.classList.add('ko');
    const pip = document.getElementById('bbPip'); this.pipReact('cheer', 2000);
    Sfx.play('tada', 0.6); this.confetti(30);
    await this._sleep(1500);
    if (this._game !== g) return;
    this.bossEnd();
  },

  // wrong answer -> the boss fires back
  async bossHitsPip(g, r) {
    this.bossMood('laugh');
    const boss = document.getElementById('bbBoss');
    if (boss) { boss.classList.remove('charge'); void boss.offsetWidth; boss.classList.add('charge'); }
    await this._sleep(380);
    if (this._game !== g) return;
    Sfx.play('whoosh', 0.55);
    this.bossFly('bbBoss', 'bbPip', this.fx(BOSS_ICON[g.course] || '💥'), 480);
    await this._sleep(430);
    if (this._game !== g) return;
    g.hearts = Math.max(0, g.hearts - 1);
    this.pipReact('oops', 1200); this._bossShake(); this.haptic(35);
    Sfx.play('no', 0.45);
    const hs = document.getElementById('bbHearts'); if (hs) hs.innerHTML = this.bossHeartsHTML(g);
    this.bossPop('💔', 'bbPip', 'heart');
    await this._sleep(750);
    if (this._game !== g) return;
    this.bossMood(g.rage ? 'angry' : 'idle');
    if (g.hearts <= 0) { this.bossBanner('', ''); return this.bossEnd(); }
    this.bossFeedback(g);
  },

  // what the answer was and why — read in full before anything moves on
  bossFeedback(g) {
    const r = g.items[g.idx], ok = g.lastOk;
    g.phase = 'fb';
    const card = document.getElementById('bbCard'); if (!card) return;
    const sb = card.querySelector('.bb-strike-box'); if (sb) sb.remove();
    const lead = this.explainLeadsWith(r, r.opts[r.ans]);
    const last = g.idx + 1 >= g.total;
    const fb = document.createElement('div');
    fb.className = 'check-fb';
    fb.innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><span class="fb-pip">${this.pip(ok ? 'happy' : 'oops')}</span>
      <div><b>${ok ? this.PHR.right : this.PHR.miss}</b><p>${ok || lead ? '' : this.PHR.answerIs + ' ' + r.opts[r.ans] + '. '}${r.explain}</p></div></div>
      <button class="cta pulse bb-next" onclick="App.bossNext()">${last ? 'Finish' : 'Next'}</button>`;
    card.appendChild(fb);
    const say = ok ? [this.PHR.right, r.explain] : lead ? [this.PHR.miss, r.explain] : [this.PHR.miss, this.PHR.answerIs, r.opts[r.ans], r.explain];
    this.speakNow(say);
    // read-to-me on: move on once the whole explanation has been heard (never on a timer)
    if (this.autoRead()) {
      Promise.race([AudioLib.done(), this._sleep(20000)]).then(() => this._sleep(900)).then(() => {
        if (this._game === g && g.phase === 'fb' && g.idx === g._fbIdx) this.bossNext();
      });
    }
    g._fbIdx = g.idx;
  },
  bossNext() {
    const g = this._game; if (!g || g.kind !== 'boss' || g.phase !== 'fb') return;
    g.phase = 'anim';
    g.idx++;
    if (g.hp <= 0 || g.hearts <= 0 || g.idx >= g.total) return this.bossEnd();
    this.gmBoss();
  },

  bossEnd() {
    const g = this._game, won = g.hp <= 0;
    g.phase = 'end';
    const course = COURSES.find(c => c.id === g.course);
    let xp = 10 + g.right * 2 + g.crits + g.supers * 2, firstMedal = false;
    const before = this.levelInfo(Progress.p.xp || 0);
    if (won) {
      Progress.p.medals = Progress.p.medals || {};
      if (!Progress.p.medals[g.course]) { Progress.p.medals[g.course] = true; xp += 50; firstMedal = true; }
    }
    Progress.p.xp = (Progress.p.xp || 0) + xp;
    Progress.touchDay(); Progress.commit();
    const after = this.levelInfo(Progress.p.xp);
    const el = document.getElementById('lessonOverlay');
    Sfx.play(won ? 'tada' : 'no', 0.5);
    if (won) this.confetti(46);
    el.innerHTML = `
      <div class="pl-top"><button class="pl-x" onclick="App.bossQuit()" aria-label="Close">✕</button>
        <div class="pl-seg"><i class="past"></i></div>${this.listenLabel('Listen', won ? this.GPHR.bossWin : this.GPHR.bossLose,
          ...(after.level > before.level ? [this.PHR.levelUp] : []), ...(firstMedal ? [this.PHR.medal] : []))}</div>
      <div class="rs"><div class="rs-rays"></div>
        <div class="rs-pip">${this.pip(won ? 'happy cheer jump' : 'oops')}</div>
        <div class="rs-kicker">${this.GPHR.bossTitle} · ${course.name}</div>
        <h1>${won ? this.GPHR.bossWin : this.GPHR.bossLose}</h1>
        ${won ? `<div class="rs-medal">${this.fx('🏅')}</div>`
              : `<div class="bb-boss lost" data-mood="laugh">${this.bossArt(g.course)}<div class="bb-emblem">${this.fx(BOSS_ICON[g.course] || '👾')}</div></div>`}
        <div class="rs-stats">
          <div class="rs-stat"><b>${g.right}</b><span>Right</span></div>
          <div class="rs-stat"><b>${g.crits + g.supers}</b><span>Big hits</span></div>
          <div class="rs-stat"><b>+<span id="rsXp">0</span></b><span>${this.fx('⚡')} Sparks</span></div>
        </div>
        ${after.level > before.level ? `<div class="rs-levelup">${this.fx('🎉')} ${this.PHR.levelUp} You are level ${after.level}</div>` : ''}
        ${firstMedal ? `<div class="rs-levelup">${this.fx('🏅')} ${this.PHR.medal}</div>` : ''}
      </div>
      <div class="rs-foot" style="display:flex;gap:10px">
        <button class="cta" style="background:var(--paper-2);color:var(--pink-ink-2);box-shadow:0 6px 0 var(--paper-edge)" onclick="App.bossQuit()">Done</button>
        ${won ? '' : `<button class="cta pulse" onclick="App.bossStart('${g.course}')">Try again</button>`}
      </div>`;
    this.syncListen();
    setTimeout(() => this.countUp(document.getElementById('rsXp'), 0, xp, 800), 400);
    setTimeout(() => this.autoPlay('#lessonOverlay .pl-top .listen'), 700);
  },
  bossQuit() {
    const el = document.getElementById('lessonOverlay'); if (el) el.remove();
    AudioLib.stop(); this._game = null;
    this.go('journey');
  },
});

// the journey's last node is now the boss
Object.assign(App, {
  medalTap(courseId) {
    const c = COURSES.find(x => x.id === courseId);
    const have = !!((Progress.p.medals || {})[courseId]);
    if (this.bossReady(courseId)) {
      Sfx.play('pop', 0.4);
      return this.bossStart(courseId);
    }
    Sfx.play('no', 0.3);
    this.toast(`${this.fx('🔒')} Finish every ${c.name} lesson to face the boss`);
    if (have) this.confetti(10);
  },
});
