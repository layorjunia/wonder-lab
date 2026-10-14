// The games: four engines that are not quizzes.
//
//   pairs    Match Up      two columns: a name on the left, its clue on the right
//   bubbles  Bubble Pop    a clue appears, name bubbles drift up, pop the right one
//   whoami   Who Am I?     read a clue, tap the picture that fits   (species lessons)
//   rank     Line Up       put animals/plants in order of a real measurement
//
// Every string any of them speaks is already a recorded clip: names, clues and
// descriptions come straight from the lessons and the species data, and the few
// fixed prompts live in GPHR (read by tools/gen_audio.py like PHR is).
//
// A game runs either inside a lesson (ctx 'lesson': its result becomes the
// lesson's game accuracy and the quiz follows) or from the Games tab (ctx 'hub':
// a mixed round from every lesson finished so far, which pays Sparks).

Object.assign(App, {

  GPHR: {
    whoTitle: 'Who am I?',
    whoHelp: 'Listen to the clue. Then tap the picture that fits.',
    bubTitle: 'Bubble pop',
    bubHelp: 'Read the clue. Then pop the bubble with the right name.',
    rankTitle: 'Line them up',
    rankHelp: 'Tap them one at a time, in the right order.',
    rankOops: 'Not that one. Try another.',
    rankDone: 'In the right order!',
    gameDone: 'Great game!',
    gameAgain: 'Play again',
    weightDesc: 'Tap them from heaviest to lightest.',
    weightAsc: 'Tap them from lightest to heaviest.',
    lengthDesc: 'Tap them from longest to shortest.',
    lengthAsc: 'Tap them from shortest to longest.',
    speedDesc: 'Tap them from fastest to slowest.',
    speedAsc: 'Tap them from slowest to fastest.',
    lifeDesc: 'Tap them from longest life to shortest life.',
    lifeAsc: 'Tap them from shortest life to longest life.',
    heightDesc: 'Tap them from tallest to shortest.',
    heightAsc: 'Tap them from shortest to tallest.',
    dailyTitle: 'Daily challenge',
    dailyDone: 'Challenge complete!',
  },

  GAMES: {
    pairs:   { name: 'Match Up',    glyph: '🧩', blurb: 'Match each name to its clue' },
    whoami:  { name: 'Who Am I?',   glyph: '🔍', blurb: 'Read the clue, find the picture' },
    rank:    { name: 'Line Up',     glyph: '📏', blurb: 'Put them in order, biggest to smallest' },
  },

  // ── what each game can be built from ─────────────────────────────────
  gamePairs(L) {
    const p = (L.game || {}).pairs || [];
    return p.length >= 3 ? p : null;
  },
  gameSpecies(L) {
    if (L.kind !== 'species') return [];
    return (L.items || []).map(i => this.find(i)).filter(Boolean);
  },
  // a clue that does not give the name away: the blurb, else the first clean fact
  speciesClue(a) {
    const nf = this.nameForms(a);
    const c = [a.blurb, ...((a.facts || []).map(f => f.text))].filter(Boolean)
      .filter(t => !nf.some(r => r.test(t)));
    return c[0] || null;
  },
  STATS: {
    weight: { unit: 'lb', mu: 'kg', k: 0.4536, noun: 'weight' },
    length: { unit: 'ft', mu: 'm', k: 0.3048, noun: 'length' },
    speed:  { unit: 'mph', mu: 'km/h', k: 1.609, noun: 'speed' },
    life:   { unit: 'years', mu: '', k: 1, noun: 'life' },
    height: { unit: 'ft', mu: 'm', k: 0.3048, noun: 'height' },
  },
  statLabel(stat, v) {
    const S = this.STATS[stat];
    const num = x => x >= 100 ? Math.round(x).toLocaleString('en-US')
      : x >= 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100);
    if ((stat === 'length' || stat === 'height') && v < 1) {
      const inch = v * 12;
      return `${num(inch)} in (${num(inch * 2.54)} cm)`;
    }
    if (stat === 'life') return `${num(v)} years`;
    return `${num(v)} ${S.unit} (${num(v * S.k)} ${S.mu})`;
  },
  gameKinds(L) {
    const out = [];
    if (this.gamePairs(L)) out.push('pairs');
    const sp = this.gameSpecies(L);
    if (sp.length >= 3 && sp.filter(a => this.speciesClue(a)).length >= 3) out.push('whoami');
    if (this.rankStats(sp).length) out.push('rank');
    return out;
  },
  // which game a lesson plays this time: a stable rotation, never the same
  // game twice in a row when a lesson is replayed
  pickGameKind(L) {
    const kinds = this.gameKinds(L);
    if (!kinds.length) return null;
    let h = 0; for (const c of L.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const rec = this.lessonRecord(L.id);
    const last = rec && rec.g;
    let k = kinds[h % kinds.length];
    if (last && k === last && kinds.length > 1) k = kinds[(kinds.indexOf(k) + 1) % kinds.length];
    return k;
  },
  // every spoken string a game can add beyond the lesson's own text: none
  gameStrings(L) { return []; },

  // ── shared screen furniture ──────────────────────────────────────────
  gameTop(g, countText) {
    const lesson = g.ctx === 'lesson';
    const segs = lesson ? this.segs('game')
      : Array.from({ length: g.total }, (_, i) => `<i class="${i < g.idx ? 'past' : i === g.idx ? 'on' : ''}"></i>`).join('');
    return `<div class="pl-top">
      <button class="pl-x" onclick="App.gameExit()" aria-label="Close">✕</button>
      <div class="pl-seg">${segs}</div>
      ${this.autoBtn()}
      ${countText ? `<span class="pl-sp">${countText}</span>` : ''}
    </div>`;
  },
  gameHead(title, help) {
    return `<div class="gm-head"><h1 class="gm-title">${title}</h1>
      <p class="gm-help">${help} ${this.listenLabel('', title, help)}</p></div>`;
  },
  gameExit() {
    const g = this._game;
    if (this._sortCleanup) { this._sortCleanup(); this._sortCleanup = null; }
    if (this._dragCleanup) { this._dragCleanup(); this._dragCleanup = null; }
    if (g && g._raf) cancelAnimationFrame(g._raf);
    if (g && g.ctx === 'hub') {
      const el = document.getElementById('lessonOverlay');
      if (el) el.remove();
      AudioLib.stop(); this._game = null;
      return this.go('games');
    }
    this.lessonExit();
  },

  // ── starting a game ──────────────────────────────────────────────────
  lessonStartGame() {
    const s = this._lesson, L = s.L;
    s.stage = 'game';
    const kind = this.pickGameKind(L) || 'pairs';
    s.gameKind = kind;
    this.gameStart(kind, [L], 'lesson');
  },

  gameStart(kind, lessons, ctx) {
    const g = { kind, ctx, lessons, idx: 0, right: 0, misses: 0, busy: false };
    this._game = g;
    this.setWorld(ctx === 'lesson' ? lessons[0].course : (this._worldId || 'physical'));
    if (ctx === 'hub') {
      let el = document.getElementById('lessonOverlay');
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'pl pip-react'; el.id = 'lessonOverlay';
      document.body.appendChild(el);
    }
    const species = lessons.flatMap(L => this.gameSpecies(L));
    if (kind === 'pairs') {
      let pairs = lessons.flatMap(L => this.gamePairs(L) || []);
      if (ctx === 'hub') pairs = this.shuffle(pairs).slice(0, 6);
      const left = pairs.map((pr, i) => ({ i, text: pr[0], side: 0 }));
      const right = pairs.map((pr, i) => ({ i, text: pr[1], side: 1 }));
      const L2 = this.shuffle(left);
      let R2 = this.shuffle(right), tries = 0;
      while (tries++ < 30 && R2.filter((c, k) => c.i === L2[k].i).length > 1) R2 = this.shuffle(right);
      Object.assign(g, { cards: [...L2, ...R2], n: L2.length, sel: -1, done: {}, total: pairs.length });
    } else if (kind === 'bubbles') {
      const pairs = this.shuffle(lessons.flatMap(L => this.gamePairs(L) || [])
        .filter((p, i, a) => a.findIndex(q => q[0] === p[0]) === i));
      const rounds = pairs.slice(0, ctx === 'hub' ? 6 : Math.min(6, pairs.length));
      g.items = rounds.map(pr => {
        const decoys = this.shuffle(pairs.filter(q => q[0] !== pr[0])).slice(0, 3).map(q => q[0]);
        return { clue: pr[1], name: pr[0], opts: this.shuffle([pr[0], ...decoys]) };
      });
      g.total = g.items.length;
    } else if (kind === 'whoami') {
      const pool = species.filter(a => this.speciesClue(a));
      const pick = this.shuffle(pool).slice(0, ctx === 'hub' ? 6 : Math.min(5, pool.length));
      g.items = pick.map(a => {
        const near = this.shuffle(species.filter(x => x.id !== a.id));
        const far = this.shuffle(this.all().filter(x => x.group === a.group && x.id !== a.id && x.id !== near[0]?.id));
        const decoys = [...near, ...far].filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 2);
        return { a, clue: this.speciesClue(a), opts: this.shuffle([a, ...decoys]) };
      });
      g.total = g.items.length;
    } else if (kind === 'rank') {
      g.items = this.rankRounds(species, ctx === 'hub' ? 3 : 2);
      g.total = g.items.length;
    } else if (this.GAMEX && this.GAMEX[kind]) {
      this.GAMEX[kind].build.call(this, g, lessons, ctx);
    }
    if (!g.total) return ctx === 'lesson' ? this.lessonStartQuiz() : this.go('games');
    this.gameRender();
  },

  gameRender() {
    const g = this._game;
    if (this.GAMEX && this.GAMEX[g.kind]) return this.GAMEX[g.kind].render.call(this);
    ({ pairs: () => this.gmPairs(), bubbles: () => this.gmBubbles(),
       whoami: () => this.gmWho(), rank: () => this.gmRank() })[g.kind]();
  },

  // A round of any game finished: counts it, then moves on or ends.
  gameNextRound(ok, delay) {
    const g = this._game;
    if (ok) g.right++;
    g.idx++;
    // Never move on while the answer is still being read out: wait for the narration to end
    // (at least `delay`, at most 15 s) and a short breath, so nothing is cut off mid-sentence.
    Promise.race([Promise.all([this._sleep(delay || 1100), AudioLib.done()]), this._sleep(15000)])
      .then(() => this._sleep(350)).then(() => {
        if (this._game !== g) return;
        if (g.idx >= g.total) this.gameFinish(); else this.gameRender();
      });
  },

  gameFinish() {
    const g = this._game;
    const acc = g.total ? g.right / g.total : 1;
    if (g.ctx === 'lesson') {
      const s = this._lesson;
      s.gameAcc = acc;
      const rec = Progress.p.lessons && Progress.p.lessons[s.L.id];
      if (rec) { rec.g = s.gameKind; Progress.commit(); }
      else { s.gameKindPlayed = s.gameKind; }
      return this.lessonStartQuiz();
    }
    this.gameHubResult(acc);
  },

  // ══ MATCH UP ═════════════════════════════════════════════════════════
  gmPairs() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    const count = `${Object.keys(g.done).length / 2} / ${g.n}`;
    el.innerHTML = `${this.gameTop(g, count)}
      <div class="gm-wrap">
        ${this.gameHead(this.PHR.pairsTitle, this.PHR.pairsHelp)}
        <div class="pair-cols">
          ${[0, 1].map(side => `<div class="pair-col">${g.cards.map((c, k) => c.side !== side ? '' :
            `<button class="pair-card ${side ? 'r' : 'l'}" id="pc${k}"
               onclick="App.gmPairTap(${k})">${c.text}</button>`).join('')}</div>`).join('')}
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .gm-help .listen');
  },

  gmPairTap(k) {
    const g = this._game;
    if (g.busy || g.done[k] || g.sel === k) return;
    const card = document.getElementById('pc' + k);
    this.speakNow([g.cards[k].text], true);    // every card is read aloud when you tap it
    if (g.sel >= 0 && g.cards[g.sel].side === g.cards[k].side) {
      document.getElementById('pc' + g.sel).classList.remove('sel');
      g.sel = -1;
    }
    if (g.sel < 0) { g.sel = k; card.classList.add('sel'); Sfx.play('pop', 0.3); return; }
    const a = g.sel, b = k, ca = document.getElementById('pc' + a);
    g.sel = -1;
    if (g.cards[a].i === g.cards[b].i) {
      g.done[a] = g.done[b] = true;
      ca.classList.remove('sel'); ca.classList.add('matched'); card.classList.add('matched');
      Sfx.play('yes', 0.45); this.haptic(14); this.pipReact('happy');
      const matched = Object.keys(g.done).length / 2;
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${matched} / ${g.n}`;
      if (matched === g.n) {
        g.right = Math.max(0, g.n - g.misses); g.idx = g.total = g.n;
        document.getElementById('gmMsg').innerHTML =
          `<div class="gm-banner">${this.fx('🎉')} ${this.PHR.pairsDone}</div>`;
        this.confetti(24);
        setTimeout(() => this.speakNow([this.PHR.pairsDone], true), 350);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2000);
      }
    } else {
      g.misses++; g.busy = true;
      ca.classList.add('wrong'); card.classList.add('wrong');
      Sfx.play('no', 0.35); this.haptic(30);
      setTimeout(() => {
        ca.classList.remove('sel', 'wrong'); card.classList.remove('wrong'); g.busy = false;
      }, 650);
    }
  },

  // ══ BUBBLE POP ═══════════════════════════════════════════════════════
  gmBubbles() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    const r = g.items[g.idx];
    g.pops = 0; g.locked = false; g.firstTry = true;
    const bubbles = r.opts.map((name, i) => {
      const n = r.opts.length;
      const x = 8 + (84 - 24) * (i + .5) / n + (Math.random() * 6 - 3);   // spread across the sky
      const sz = Math.max(104, Math.min(150, 70 + name.length * 5.5));
      const dur = 11 + Math.random() * 5, delay = -Math.random() * dur;
      return `<button class="bubble" style="left:${x.toFixed(1)}%;--sz:${Math.round(sz)}px;--dur:${dur.toFixed(1)}s;--delay:${delay.toFixed(1)}s;--sway:${(Math.random() * 18 + 8).toFixed(0)}px"
        data-name="${i}" onclick="App.gmBubbleTap(${i})"><span>${name}</span></button>`;
    }).join('');
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap bb-wrap">
        <div class="bb-clue"><div class="bb-kicker">${this.fx('🫧')} Pop the name that fits</div>
          <p class="bb-text">${r.clue}</p>
          <div class="bb-listen">${this.listenLabel('Hear it', r.clue)}</div></div>
        <div class="bb-sky" id="bbSky">${bubbles}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .bb-listen .listen');
  },

  gmBubbleTap(i) {
    const g = this._game, r = g.items[g.idx];
    if (g.locked) return;
    const b = document.querySelector(`.bubble[data-name="${i}"]`);
    if (!b || b.classList.contains('pop')) return;
    const name = r.opts[i];
    this.speakNow([name], true);
    if (name === r.name) {
      g.locked = true;
      b.classList.add('pop', 'good');
      document.querySelectorAll('.bubble').forEach(o => { if (o !== b) o.classList.add('fade'); });
      Sfx.play('yes', 0.5); this.haptic(14); this.confetti(14); this.pipReact('happy');
      this.gameNextRound(g.firstTry, 1250);
    } else {
      g.firstTry = false;
      b.classList.add('pop', 'bad');
      Sfx.play('no', 0.35); this.haptic(30);
      b.disabled = true;
    }
  },

  // ══ WHO AM I? ════════════════════════════════════════════════════════
  gmWho() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    const r = g.items[g.idx];
    g.locked = false; g.firstTry = true;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap">
        ${g.idx === 0 ? this.gameHead(this.GPHR.whoTitle, this.GPHR.whoHelp) : ''}
        <div class="gm-stage">
          <div class="bb-kicker dark">${this.fx('🔍')} Who am I?</div>
          <p class="gm-clue">${r.clue}</p>
          <div class="bb-listen">${this.listenLabel('Hear it', r.clue)}</div>
          <div class="gm-pics">${r.opts.map((o, i) => `<button class="gm-pic" data-i="${i}" onclick="App.gmWhoTap(${i})">
            <img src="${this.pic(o)}" alt=""><span>${o.name}</span></button>`).join('')}</div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .bb-listen .listen');
  },

  gmWhoTap(i) {
    const g = this._game, r = g.items[g.idx];
    if (g.locked) return;
    const pick = r.opts[i];
    const btn = document.querySelector(`.gm-pic[data-i="${i}"]`);
    if (pick.id === r.a.id) {
      g.locked = true;
      btn.classList.add('right');
      Sfx.play('yes', 0.5); this.haptic(14); this.pipReact('happy'); this.confetti(12);
      this.speakNow([this.PHR.right, r.a.name]);
      this.gameNextRound(g.firstTry, 1700);
    } else {
      g.firstTry = false;
      btn.classList.add('wrong'); btn.disabled = true;
      Sfx.play('no', 0.35); this.haptic(30);
      this.speakNow([pick.name]);
    }
  },

  // ══ LINE UP ══════════════════════════════════════════════════════════
  // rounds of 4 species ordered by one real measurement. Eligibility is
  // deterministic (a lesson either can or cannot play Line Up); only WHICH four
  // are picked varies.
  rankChain(species, st) {
    const have = species.filter(a => a.stats && a.stats[st] > 0 && this.STATS[st])
      .sort((a, b) => a.stats[st] - b.stats[st]);
    const chain = [];
    have.forEach(a => {
      if (!chain.length || a.stats[st] / chain[chain.length - 1].stats[st] >= 1.35) chain.push(a);
    });
    return chain;
  },
  rankStats(species) {
    return ['weight', 'length', 'speed', 'life', 'height'].filter(st => this.rankChain(species, st).length >= 4);
  },
  rankRounds(species, maxRounds) {
    const out = [];
    for (const st of this.shuffle(this.rankStats(species))) {
      if (out.length >= maxRounds) break;
      const four = this.shuffle(this.rankChain(species, st)).slice(0, 4)
        .sort((a, b) => a.stats[st] - b.stats[st]);
      const desc = out.length % 2 === 0;
      out.push({ stat: st, desc, order: desc ? four.slice().reverse() : four, tray: this.shuffle(four) });
    }
    return out;
  },

  gmRank() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    const r = g.items[g.idx];
    g.k = 0; g.firstTry = true; g.locked = false;
    const prompt = this.GPHR[r.stat + (r.desc ? 'Desc' : 'Asc')];
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap">
        ${this.gameHead(this.GPHR.rankTitle, prompt)}
        <div class="gm-stage">
          <div class="gm-rank" id="rkSlots">${r.order.map((_, i) =>
            `<div class="gm-slot" id="slot${i}"><b>${i + 1}</b><span class="slot-fill"></span></div>`).join('')}</div>
          <div class="gm-tray" id="rkTray">${r.tray.map(a => `<button class="gm-chip" data-id="${a.id}"
            onclick="App.gmRankTap('${a.id}')"><img src="${this.pic(a)}" alt=""><span>${a.name}</span></button>`).join('')}</div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .gm-help .listen');
  },

  gmRankTap(id) {
    const g = this._game, r = g.items[g.idx];
    if (g.locked) return;
    const want = r.order[g.k], chip = document.querySelector(`.gm-chip[data-id="${id}"]`);
    const a = r.order.find(x => x.id === id);
    this.speakNow([a.name], true);
    if (id === want.id) {
      const slot = document.getElementById('slot' + g.k);
      slot.classList.add('ok');
      slot.querySelector('.slot-fill').innerHTML =
        `${a.name} <small>${this.statLabel(r.stat, a.stats[r.stat])}</small>`;
      chip.disabled = true; chip.style.visibility = 'hidden';
      Sfx.play('yes', 0.4); this.haptic(12);
      g.k++;
      if (g.k >= r.order.length) {
        g.locked = true;
        document.getElementById('gmMsg').innerHTML =
          `<div class="gm-banner">${this.fx('🎉')} ${this.GPHR.rankDone}</div>`;
        Sfx.play('tada', 0.4); this.pipReact('happy'); this.confetti(14);
        setTimeout(() => this.speakNow([this.GPHR.rankDone], true), 300);
        this.gameNextRound(g.firstTry, 2100);
      }
    } else {
      g.firstTry = false;
      chip.classList.add('wrong'); setTimeout(() => chip.classList.remove('wrong'), 450);
      Sfx.play('no', 0.35); this.haptic(30);
    }
  },

  // ══ the hub's result screen ══════════════════════════════════════════
  gameHubResult(acc) {
    const g = this._game;
    const xp = 8 + g.right * 3;
    const before = this.levelInfo(Progress.p.xp || 0);
    Progress.p.xp = (Progress.p.xp || 0) + xp;
    Progress.p.gamesPlayed = (Progress.p.gamesPlayed || 0) + 1;
    Progress.touchDay(); Progress.commit();
    const after = this.levelInfo(Progress.p.xp);
    const stars = acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1;
    const el = document.getElementById('lessonOverlay');
    Sfx.play('tada', 0.5); this.confetti(stars >= 3 ? 36 : 20);
    el.innerHTML = `
      <div class="pl-top"><button class="pl-x" onclick="App.gameExit()" aria-label="Close">✕</button>
        <div class="pl-seg"><i class="past"></i></div>${this.listenLabel('Listen', this.GPHR.gameDone,
          ...(after.level > before.level ? [this.PHR.levelUp] : []))}</div>
      <div class="rs"><div class="rs-rays"></div>
        <div class="rs-pip">${this.pip('happy cheer jump')}</div>
        <div class="rs-kicker">${this.GAMES[g.kind].name}</div>
        <h1>${this.GPHR.gameDone}</h1>
        <div class="rs-stars">${[0, 1, 2].map(i => `<span class="rs-star ${i < stars ? 'on' : 'off'}"
          style="animation-delay:${.3 + i * .3}s">${this.fx('⭐')}</span>`).join('')}</div>
        <div class="rs-stats">
          <div class="rs-stat"><b>${g.right}/${g.total}</b><span>First try</span></div>
          <div class="rs-stat"><b>+<span id="rsXp">0</span></b><span>${this.fx('⚡')} Sparks</span></div>
        </div>
        ${after.level > before.level ? `<div class="rs-levelup">${this.fx('🎉')} ${this.PHR.levelUp} You are level ${after.level}</div>` : ''}
      </div>
      <div class="rs-foot" style="display:flex;gap:10px">
        <button class="cta" style="background:var(--paper-2);color:var(--pink-ink-2);box-shadow:0 6px 0 var(--paper-edge)"
          onclick="App.gameExit()">Done</button>
        <button class="cta pulse" onclick="App.hubPlay('${g.kind}')">${this.GPHR.gameAgain}</button>
      </div>`;
    this.syncListen();
    setTimeout(() => this.countUp(document.getElementById('rsXp'), 0, xp, 800), 400);
    setTimeout(() => this.autoPlay('#lessonOverlay .pl-top .listen'), 700);
  },

  // ══ games from the Games tab ═════════════════════════════════════════
  doneLessons() {
    return LESSONS.filter(l => l.pages && this.lessonStars(l.id) > 0);
  },
  hubPlay(kind) {
    const pool = this.doneLessons().filter(l => this.gameKinds(l).includes(kind));
    if (!pool.length) {
      this.toast(`${this.fx('🔒')} Finish a lesson first to unlock this game`);
      return;
    }
    const pick = this.shuffle(pool).slice(0, kind === 'rank' || kind === 'whoami' ? 3 : 4);
    this.gameStart(kind, pick, 'hub');
  },

  // ══ the daily challenge ══════════════════════════════════════════════
  dailyPool() {
    const out = [];
    this.doneLessons().forEach(L => {
      (L.quiz || []).forEach(q => { if (!q.fig) out.push({ ...q, _from: L.id }); });
    });
    return out;
  },
  dailyDone() { return (Progress.p.daily || {}).day === Store.dayKey(); },
  dailyStart() {
    const pool = this.dailyPool();
    if (pool.length < 5) {
      this.toast(`${this.fx('🔒')} Finish a few lessons to unlock the daily challenge`);
      return;
    }
    // the same five all day, so a replay is the same challenge
    let seed = 0; for (const c of Store.dayKey()) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const byLesson = {};
    pool.forEach(q => { (byLesson[q._from] = byLesson[q._from] || []).push(q); });
    const lessons = Object.keys(byLesson).sort(() => rnd() - 0.5);
    const picked = [];
    for (let r = 0; picked.length < 5 && r < 5; r++) {
      lessons.forEach(id => {
        if (picked.length >= 5) return;
        const qs = byLesson[id];
        const q = qs.splice(Math.floor(rnd() * qs.length), 1)[0];
        if (q) picked.push(q);
      });
    }
    const first = LESSONS.find(l => l.id === picked[0]._from);
    this.setWorld(first.course);
    this.resetSay();
    const wrap = document.createElement('div');
    const old = document.getElementById('lessonOverlay'); if (old) old.remove();
    wrap.className = 'pl pip-react'; wrap.id = 'lessonOverlay';
    document.body.appendChild(wrap);
    this._lesson = { mode: 'daily', L: { id: '_daily', title: this.GPHR.dailyTitle, course: first.course,
      quiz: picked, pages: [] }, pages: [], idx: 0, stage: 'quiz', _checkOK: {}, _checkMiss: {},
      _tried: {}, quizIdx: 0, quizRight: 0, quizFirst: 0, xp0: Progress.p.xp || 0 };
    this.lessonStartQuiz();
  },
  dailyFinish() {
    const s = this._lesson;
    const total = s.quiz.length, right = s.quizFirst;
    const first = !this.dailyDone();
    const xp = first ? 20 + right * 5 : 5;
    const before = this.levelInfo(Progress.p.xp || 0);
    Progress.p.xp = (Progress.p.xp || 0) + xp;
    Progress.p.daily = { day: Store.dayKey(), right, total };
    Progress.touchDay(); Progress.commit();
    const after = this.levelInfo(Progress.p.xp);
    const stars = right >= total ? 3 : right >= total - 1 ? 2 : 1;
    Sfx.play('tada', 0.5); this.confetti(stars >= 3 ? 36 : 22);
    const el = document.getElementById('lessonOverlay');
    el.innerHTML = `
      <div class="pl-top"><button class="pl-x" onclick="App.dailyExit()" aria-label="Close">✕</button>
        <div class="pl-seg"><i class="past"></i></div>${this.listenLabel('Listen', this.GPHR.dailyDone,
          ...(after.level > before.level ? [this.PHR.levelUp] : []))}</div>
      <div class="rs"><div class="rs-rays"></div>
        <div class="rs-pip">${this.pip('happy cheer jump')}</div>
        <div class="rs-kicker">${this.GPHR.dailyTitle}</div>
        <h1>${this.GPHR.dailyDone}</h1>
        <div class="rs-stars">${[0, 1, 2].map(i => `<span class="rs-star ${i < stars ? 'on' : 'off'}"
          style="animation-delay:${.3 + i * .3}s">${this.fx('⭐')}</span>`).join('')}</div>
        <div class="rs-stats">
          <div class="rs-stat"><b>${right}/${total}</b><span>First try</span></div>
          <div class="rs-stat"><b>+<span id="rsXp">0</span></b><span>${this.fx('⚡')} Sparks</span></div>
          <div class="rs-stat"><b>${Progress.p.dayStreak || 1}</b><span>${this.fx('🔥')} Day streak</span></div>
        </div>
        ${after.level > before.level ? `<div class="rs-levelup">${this.fx('🎉')} ${this.PHR.levelUp} You are level ${after.level}</div>` : ''}
      </div>
      <div class="rs-foot"><button class="cta pulse" onclick="App.dailyExit()">Continue</button></div>`;
    this.syncListen();
    setTimeout(() => this.countUp(document.getElementById('rsXp'), 0, xp, 800), 400);
  },
  dailyExit() {
    const el = document.getElementById('lessonOverlay');
    if (el) el.remove();
    AudioLib.stop(); this._lesson = null;
    this.go('games');
  },
});
