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
  bossHelp: 'Answer questions to beat the boss. Three wrong answers and the boss wins.',
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
  // follows the game, so a lesson's game does not give its quiz away).
  qPool(lessons, withQuiz) {
    const out = [];
    lessons.forEach(L => {
      (L.pages || []).forEach(p => (p.blocks || []).forEach(b => {
        if (b.t === 'check' && b.q && b.q.options && b.q.options.length >= 3 && b.q.type !== 'tf') out.push(b.q);
      }));
      if (withQuiz) (L.quiz || []).forEach(q => { if (q.options && q.options.length >= 3 && q.type !== 'tf') out.push(q); });
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
// ═════════════════════════════════════════════════════════════════════════
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
    const items = pool.slice(0, 10).map(q => {
      const it = this.qItem({ ...q, options: q.options.slice(0, 4) });
      return it;
    });
    this._lesson = null;
    this._game = { kind: 'boss', ctx: 'hub', course: courseId, items, idx: 0, total: items.length, right: 0,
      hearts: 3, hp: 8, hpMax: 8, locked: false, lessons: [] };
    this.gmBoss();
  },
  bossName(courseId) { return this.GPHR['bossName_' + courseId] || 'The Boss'; },
  gmBoss() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false;
    const course = COURSES.find(c => c.id === g.course);
    el.innerHTML = `
      <div class="pl-top"><button class="pl-x" onclick="App.bossQuit()" aria-label="Close">✕</button>
        <div class="boss-hp"><i id="bossHp" style="width:${g.hp / g.hpMax * 100}%"></i><span>${this.bossName(g.course)}</span></div>
        ${this.autoBtn()}
        <span class="pl-sp boss-hearts" id="bossHearts">${[0, 1, 2].map(k => `<i class="${k < g.hearts ? '' : 'spent'}">${this.fx('❤️')}</i>`).join('')}</span></div>
      <div class="gm-wrap boss-wrap">
        <div class="boss-stage"><div class="boss-body" id="bossBody">${this.fx(BOSS_ICON[g.course] || '👾')}</div>
          <div class="boss-pip">${this.pip('')}</div></div>
        <div class="gm-stage boss-q">
          <p class="gm-q">${r.prompt}</p>
          <div class="bb-listen">${this.listenLabel('Hear it', r.prompt, ...r.opts)}</div>
          <div class="answer-list" style="margin-top:12px">
            ${r.opts.map((o, i) => `<div class="answer-row"><button class="answer" id="ba${i}" onclick="App.gmBossPick(${i})">${o}</button>${this.listenLabel('', o)}</div>`).join('')}
          </div>
          <div class="check-fb" id="bossFb"></div>
        </div>
      </div>`;
    this.syncListen();
    if (g.idx === 0) this.speakNow([this.GPHR.bossTitle, this.bossName(g.course)]);
    else this.autoPlay('#lessonOverlay .bb-listen .listen');
  },
  gmBossPick(i) {
    const g = this._game; if (!g || g.kind !== 'boss' || g.locked) return false;
    const r = g.items[g.idx], ok = i === r.ans;
    g.locked = true;
    document.querySelectorAll('.boss-q .answer').forEach((b, k) => {
      b.disabled = true; if (k === r.ans) b.classList.add('right'); else if (k === i) b.classList.add('wrong');
    });
    const body = document.getElementById('bossBody');
    if (ok) {
      g.right++; g.hp--;
      Sfx.play('yes', 0.5); this.haptic(20);
      if (body) { body.classList.remove('hit'); void body.offsetWidth; body.classList.add('hit'); }
      const bar = document.getElementById('bossHp'); if (bar) bar.style.width = (g.hp / g.hpMax * 100) + '%';
    } else {
      g.hearts--;
      Sfx.play('no', 0.4); this.haptic(35);
      const hs = document.querySelectorAll('#bossHearts i'); if (hs[g.hearts]) hs[g.hearts].classList.add('spent');
      if (body) { body.classList.remove('laugh'); void body.offsetWidth; body.classList.add('laugh'); }
    }
    const fb = document.getElementById('bossFb');
    const lead = this.explainLeadsWith(r, r.opts[r.ans]);
    fb.innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><span class="fb-pip">${this.pip(ok ? 'happy' : 'oops')}</span>
      <div><b>${ok ? this.PHR.right : this.PHR.miss}</b><p>${ok || lead ? '' : this.PHR.answerIs + ' ' + r.opts[r.ans] + '. '}${r.explain}</p></div></div>`;
    this.speakNow(ok ? [this.PHR.right, r.explain] : lead ? [this.PHR.miss, r.explain] : [this.PHR.miss, this.PHR.answerIs, r.opts[r.ans], r.explain]);
    g.idx++;
    const done = g.hp <= 0 || g.hearts <= 0 || g.idx >= g.total;
    setTimeout(() => {
      if (this._game !== g) return;
      if (done) this.bossEnd(); else this.gmBoss();
    }, 3600);
    return ok;
  },
  bossEnd() {
    const g = this._game, won = g.hp <= 0;
    const course = COURSES.find(c => c.id === g.course);
    let xp = 10 + g.right * 2, firstMedal = false;
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
        ${won ? `<div class="rs-medal">${this.fx('🏅')}</div>` : `<div class="boss-body lost">${this.fx(BOSS_ICON[g.course] || '👾')}</div>`}
        <div class="rs-stats">
          <div class="rs-stat"><b>${g.right}</b><span>Right</span></div>
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
