// More games — the arcade set, plus the world Boss Battle.
//
//   catch   Catch It     slide Pip under the falling right answer
//   sling   Sling It     pull a rock back, aim, let go at the right answer
//   slice   Slice It     answers fly up; swipe across the right one
//   sort    Sort It      drag animals into "lighter / heavier than you"
//   hilo    Which One?   two animals, one measurement, a streak
//   drag    Drag It      drag each name onto the clue that fits it
//   boss    Boss Battle  a whole world's questions against a boss (unlocks the medal)
//
// Same rules as js/games.js: the questions, answers, names and clues are lesson
// text that already has a recorded clip; the few fixed prompts are in GPHR.
// Every engine has a `…Pick/…Place` entry point so tools/selftest.js can play it.

Object.assign(App.GPHR, {
  catchTitle: 'Catch it',
  catchHelp: 'Slide Pip left and right to catch the right answer.',
  slingTitle: 'Sling it',
  slingHelp: 'Pull the rock back, aim, and let go to hit the right answer.',
  sliceTitle: 'Slice it',
  sliceHelp: 'Swipe across the right answer to slice it.',
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
  dragTitle: 'Drag it',
  dragHelp: 'Drag each name onto the clue that fits it.',
  bossTitle: 'Boss battle',
  bossHelp: 'Answer questions to beat the boss. Three wrong answers and the boss wins.',
  bossWin: 'You beat the boss!',
  bossLose: 'The boss won this time. Try again!',
  bossName_earth: 'Rumble the Volcano', bossName_astro: 'Comet Crusher',
  bossName_physical: 'Static the Spark', bossName_micro: 'Germ Gloop',
  bossName_ancient: 'The Stone Guardian', bossName_america: 'Eagle Eye',
  bossName_world: 'Captain Compass', bossName_economics: 'The Coin Dragon',
  bossName_body: 'Sneezy the Germ', bossName_animals: 'The Great Beast',
  bossName_plants: 'Thorn the Tangle',
});

const BOSS_ICON = { earth: '🌋', astro: '☄️', physical: '⚡', micro: '🦠', ancient: '🗿', america: '🦅',
  world: '🧭', economics: '🪙', body: '🤧', animals: '🦖', plants: '🌵' };

Object.assign(App.GAMES, {
  catch: { name: 'Catch It', glyph: '🧺', blurb: 'Catch the right answer as it falls' },
  sling: { name: 'Sling It', glyph: '🪨', blurb: 'Aim and fire at the right answer' },
  slice: { name: 'Slice It', glyph: '🔪', blurb: 'Swipe through the right answer' },
  sort:  { name: 'Sort It',  glyph: '⚖️', blurb: 'Lighter or heavier than you?' },
  hilo:  { name: 'Which One?', glyph: '🆚', blurb: 'Two animals, one winner, a streak' },
  drag:  { name: 'Drag It',  glyph: '👆', blurb: 'Drag each name onto its clue' },
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
    if (this.gamePairs(L)) out.push('pairs', 'bubbles');
    const sp = this.gameSpecies(L);
    if (sp.length >= 3 && sp.filter(a => this.speciesClue(a)).length >= 3) out.push('whoami');
    if (this.rankStats(sp).length) out.push('rank');
    if (this.qPool([L], false).length >= 3) out.push('catch', 'sling', 'slice');
    if (this.sortChoices(sp).stats.length) out.push('sort');
    if (this.hiloRounds(sp, 3).length >= 3) out.push('hilo');
    if (this.gamePairs(L)) out.push('drag');
    return out;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// CATCH IT
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.catch = {
  build(g, lessons, ctx) {
    const pool = this.shuffle(this.qPool(lessons, ctx === 'hub'));
    g.items = pool.slice(0, ctx === 'hub' ? 6 : 5).map(q => this.qItem(q));
    g.total = g.items.length;
  },
  render() { this.gmCatch(); },
};
Object.assign(App, {
  // shared question card at the top of the three question arcades
  qHead(r, label) {
    return `<div class="bb-clue"><div class="bb-kicker">${label}</div>
      <p class="bb-text">${r.prompt}</p>
      <div class="bb-listen">${this.listenLabel('Hear it', r.prompt, ...r.opts)}</div></div>`;
  },
  // a round's right/wrong outcome, shared by the arcades
  qResolve(i, hit) {
    const g = this._game, r = g.items[g.idx];
    if (!r || g.locked) return false;
    const ok = i === r.ans;
    this.speakNow([r.opts[i]], true);
    if (ok) {
      g.locked = true;
      Sfx.play('yes', 0.5); this.haptic(14); this.pipReact('happy'); this.confetti(12);
      setTimeout(() => this.speakNow([this.PHR.right, r.explain]), 500);
      this.gameNextRound(g.firstTry, r.explain ? 3200 : 1500);
    } else {
      g.firstTry = false;
      Sfx.play('no', 0.35); this.haptic(30);
    }
    return ok;
  },
  qReveal(r) {
    const g = this._game;
    g.locked = true; g.firstTry = false;
    Sfx.play('no', 0.3);
    this.speakNow([this.PHR.miss, r.opts[r.ans], r.explain]);
    this.gameNextRound(false, 3800);
  },

  gmCatch() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.firstTry = true; g.token = (g.token || 0) + 1;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap ct-wrap">
        ${g.idx === 0 ? `<p class="gm-help gm-help-in">${this.GPHR.catchHelp}</p>` : ''}
        ${this.qHead(r, this.fx('🧺') + ' Catch the right answer')}
        <div class="ct-arena" id="ctArena">
          ${r.opts.map((o, i) => `<div class="ct-card" data-i="${i}">${o}</div>`).join('')}
          <div class="ct-basket" id="ctBasket"><span class="ct-pip">${this.pip('')}</span><span class="ct-bowl"></span></div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .bb-listen .listen');
    const arena = document.getElementById('ctArena');
    const token = g.token, idx = g.idx;
    const W = arena.clientWidth, H = arena.clientHeight;
    const cards = [...arena.querySelectorAll('.ct-card')];
    const cw = Math.max(110, Math.min(230, W / 3 - 14));
    const st = cards.map((c, i) => {
      c.style.width = cw + 'px';
      return { el: c, i, x: W * (i + 0.5) / 3 - cw / 2 + (Math.random() * 20 - 10), y: -90 - i * 150, h: c.offsetHeight || 70, done: false };
    });
    const basketW = 130, basketTop = H - 96;
    let bx = W / 2, target = W / 2, last = performance.now();
    const basket = document.getElementById('ctBasket');
    const move = e => {
      const rc = arena.getBoundingClientRect();
      target = Math.max(basketW / 2, Math.min(W - basketW / 2, e.clientX - rc.left));
    };
    arena.addEventListener('pointerdown', move);
    arena.addEventListener('pointermove', move);
    const speed = H / 5.6;
    const loop = now => {
      if (this._game !== g || g.token !== token || g.idx !== idx) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      bx += (target - bx) * Math.min(1, 14 * dt);
      basket.style.transform = `translateX(${bx - basketW / 2}px)`;
      let alive = 0;
      st.forEach(c => {
        if (c.done) return;
        c.y += speed * dt;
        c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        if (c.y + c.h >= basketTop && c.y < H) {
          const cx = c.x + cw / 2;
          if (Math.abs(cx - bx) < cw / 2 + basketW / 2 - 24 && !g.locked) {
            c.done = true;
            const ok = this.qResolve(c.i);
            c.el.classList.add(ok ? 'right' : 'wrong');
            if (!ok) setTimeout(() => { c.el.style.opacity = 0; }, 450);
            return;
          }
        }
        if (c.y > H) { c.done = true; c.el.style.opacity = 0; return; }
        alive++;
      });
      if (!g.locked && alive === 0) { this.qReveal(r); return; }
      if (!g.locked || alive > 0) g._raf = requestAnimationFrame(loop);
    };
    g._raf = requestAnimationFrame(loop);
    g.pick = i => { // bot / keyboard entry
      const c = st.find(x => x.i === i);
      if (!c || c.done) return false;
      c.done = true;
      const ok = this.qResolve(i);
      c.el.classList.add(ok ? 'right' : 'wrong');
      return ok;
    };
  },
  gmCatchPick(i) { const g = this._game; return g && g.pick ? g.pick(i) : false; },
});

// ═════════════════════════════════════════════════════════════════════════
// SLING IT
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.sling = {
  build(g, lessons, ctx) {
    const pool = this.shuffle(this.qPool(lessons, ctx === 'hub'));
    g.items = pool.slice(0, ctx === 'hub' ? 5 : 4).map(q => this.qItem(q));
    g.total = g.items.length;
  },
  render() { this.gmSling(); },
};
Object.assign(App, {
  gmSling() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.firstTry = true; g.token = (g.token || 0) + 1; g.shots = 3;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap sl-wrap">
        ${g.idx === 0 ? `<p class="gm-help gm-help-in">${this.GPHR.slingHelp}</p>` : ''}
        ${this.qHead(r, this.fx('🪨') + ' Hit the right answer')}
        <div class="sl-arena" id="slArena">
          ${r.opts.map((o, i) => `<div class="sl-target" data-i="${i}">${o}</div>`).join('')}
          <div class="sl-post"></div>
          <div class="sl-band" id="slBand"></div>
          <div class="sl-rock" id="slRock">${this.fx('🪨')}</div>
          <div class="sl-dots" id="slDots"></div>
          <div class="sl-shots" id="slShots">${'<i></i>'.repeat(3)}</div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .bb-listen .listen');
    const arena = document.getElementById('slArena');
    const token = g.token, idx = g.idx;
    const W = arena.clientWidth, H = arena.clientHeight;
    const rock = document.getElementById('slRock'), dots = document.getElementById('slDots'), band = document.getElementById('slBand');
    const R = { x: Math.max(54, W * 0.13), y: H - 74 };
    const setRock = (x, y) => { rock.style.transform = `translate(${x - 22}px, ${y - 22}px)`; };
    setRock(R.x, R.y);
    const rect = () => arena.getBoundingClientRect();
    // targets sit on the right, stacked
    const tw = Math.max(130, Math.min(300, W * 0.42));
    const tg = [...arena.querySelectorAll('.sl-target')].map((t, i) => {
      t.style.width = tw + 'px';
      const th = t.offsetHeight || 64;
      const y = 10 + (H - 40 - th * 3) * (i / 2) + th * i;
      const x = W - tw - 12 - (i === 1 ? 0 : 26);
      t.style.transform = `translate(${x}px, ${y}px)`;
      return { el: t, i, x, y, w: tw, h: th, gone: false };
    });
    let drag = null, flying = null, last = 0;
    const useShot = () => {
      g.shots--;
      const s = document.querySelectorAll('#slShots i'); if (s[g.shots]) s[g.shots].classList.add('spent');
    };
    const hitTest = p => tg.find(t => !t.gone && p.x > t.x && p.x < t.x + t.w && p.y > t.y && p.y < t.y + t.h);
    const settle = () => {
      flying = null; setRock(R.x, R.y); rock.style.opacity = 1;
      if (!g.locked && g.shots <= 0) this.qReveal(r);
    };
    const resolveHit = t => {
      t.gone = true;
      const ok = this.qResolve(t.i);
      t.el.classList.add(ok ? 'right' : 'wrong');
      if (!ok) setTimeout(() => { t.el.style.opacity = 0.25; }, 300);
      return ok;
    };
    const fly = (vx, vy) => {
      useShot();
      flying = { x: R.x, y: R.y, vx, vy };
      last = performance.now();
      band.style.opacity = 0; dots.innerHTML = '';
      const step = now => {
        if (this._game !== g || g.token !== token || g.idx !== idx || !flying) return;
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        flying.vy += 1100 * dt; flying.x += flying.vx * dt; flying.y += flying.vy * dt;
        setRock(flying.x, flying.y);
        const t = hitTest(flying);
        if (t) {
          const ok = resolveHit(t);
          flying = null; rock.style.opacity = 0;
          if (!ok) setTimeout(() => { if (this._game === g && !g.locked) settle(); }, 500);
          return;
        }
        if (flying.y > H + 60 || flying.x > W + 60 || flying.x < -60) { settle(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const pull = e => {
      const rc = rect();
      let dx = e.clientX - rc.left - R.x, dy = e.clientY - rc.top - R.y;
      const len = Math.hypot(dx, dy), max = 120;
      if (len > max) { dx *= max / len; dy *= max / len; }
      setRock(R.x + dx, R.y + dy);
      const vx = -dx * 7.5, vy = -dy * 7.5;
      band.style.opacity = 1;
      band.style.width = Math.hypot(dx, dy) + 'px';
      band.style.transform = `translate(${R.x}px, ${R.y}px) rotate(${Math.atan2(dy, dx)}rad)`;
      // a short dotted preview of the path
      let html = '', x = R.x + dx, y = R.y + dy, ux = vx, uy = vy;
      for (let k = 0; k < 14; k++) {
        ux += 0; uy += 1100 * 0.07; x += ux * 0.07; y += uy * 0.07;
        if (k % 2 === 0) html += `<i style="transform:translate(${x - 3}px,${y - 3}px)"></i>`;
      }
      dots.innerHTML = html;
      return { dx, dy, vx, vy, len };
    };
    arena.addEventListener('pointerdown', e => {
      if (flying || g.locked || g.shots <= 0) return;
      arena.setPointerCapture && arena.setPointerCapture(e.pointerId);
      drag = pull(e);
    });
    arena.addEventListener('pointermove', e => { if (drag) drag = pull(e); });
    const release = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.len < 14) { setRock(R.x, R.y); band.style.opacity = 0; dots.innerHTML = ''; return; }
      fly(d.vx, d.vy);
    };
    arena.addEventListener('pointerup', release);
    arena.addEventListener('pointercancel', release);
    g.pick = i => { // bot entry: act as a perfect shot
      const t = tg.find(x => x.i === i);
      if (!t || t.gone || g.locked) return false;
      useShot();
      return resolveHit(t);
    };
  },
  gmSlingPick(i) { const g = this._game; return g && g.pick ? g.pick(i) : false; },
});

// ═════════════════════════════════════════════════════════════════════════
// SLICE IT
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.slice = {
  build(g, lessons, ctx) {
    const pool = this.shuffle(this.qPool(lessons, ctx === 'hub'));
    g.items = pool.slice(0, ctx === 'hub' ? 5 : 4).map(q => this.qItem(q));
    g.total = g.items.length;
  },
  render() { this.gmSlice(); },
};
Object.assign(App, {
  gmSlice() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.firstTry = true; g.token = (g.token || 0) + 1; g.hearts = 3;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap sc-wrap">
        ${g.idx === 0 ? `<p class="gm-help gm-help-in">${this.GPHR.sliceHelp}</p>` : ''}
        ${this.qHead(r, this.fx('🔪') + ' Slice the right answer')}
        <div class="sc-arena" id="scArena">
          ${r.opts.map((o, i) => `<div class="sc-card" data-i="${i}">${o}</div>`).join('')}
          <div class="sc-hearts" id="scHearts">${'<i></i>'.repeat(3)}</div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .bb-listen .listen');
    const arena = document.getElementById('scArena');
    const token = g.token, idx = g.idx;
    const W = arena.clientWidth, H = arena.clientHeight;
    const cw = Math.max(120, Math.min(250, W / 3 - 12));
    const cs = [...arena.querySelectorAll('.sc-card')].map((c, i) => {
      c.style.width = cw + 'px';
      return { el: c, i, t: -i * 0.9, T: 3.6, x0: 0, peak: 0.74, gone: false, x: 0, y: H + 100, h: c.offsetHeight || 64 };
    });
    const relaunch = c => { c.t = 0; c.x0 = Math.max(4, Math.min(W - cw - 4, W * (c.i + 0.5) / 3 - cw / 2 + (Math.random() * 60 - 30))); };
    cs.forEach(c => { c.x0 = Math.max(4, Math.min(W - cw - 4, W * (c.i + 0.5) / 3 - cw / 2)); });
    let last = performance.now();
    const loop = now => {
      if (this._game !== g || g.token !== token || g.idx !== idx) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      cs.forEach(c => {
        if (c.gone) return;
        c.t += dt;
        if (c.t < 0) { c.y = H + 100; c.el.style.transform = `translate(${c.x0}px, ${c.y}px)`; return; }
        const u = c.t / c.T;
        if (u >= 1) { relaunch(c); return; }
        c.x = c.x0 + Math.sin(u * 3.1) * 14;
        c.y = H + 20 - (H * c.peak) * 4 * u * (1 - u) - 0;
        c.el.style.transform = `translate(${c.x}px, ${c.y - c.h}px) rotate(${(u - .5) * 10}deg)`;
      });
      g._raf = requestAnimationFrame(loop);
    };
    g._raf = requestAnimationFrame(loop);
    const cut = c => {
      if (c.gone || g.locked) return false;
      c.gone = true;
      const ok = this.qResolve(c.i);
      c.el.classList.add(ok ? 'right' : 'wrong', 'cut');
      if (!ok) {
        g.hearts--;
        const h = document.querySelectorAll('#scHearts i'); if (h[g.hearts]) h[g.hearts].classList.add('spent');
        if (g.hearts <= 0 && !g.locked) setTimeout(() => this.qReveal(r), 350);
      }
      return ok;
    };
    // the swipe: sample the finger's path and test each sample against the cards
    let lastPt = null;
    const trail = (x, y) => {
      const d = document.createElement('i'); d.className = 'sc-trail';
      d.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
      arena.appendChild(d); setTimeout(() => d.remove(), 380);
    };
    const test = (x, y) => {
      cs.forEach(c => {
        if (c.gone || c.t < 0) return;
        if (x > c.x - 6 && x < c.x + cw + 6 && y > c.y - c.h - 6 && y < c.y + 6) cut(c);
      });
    };
    const at = e => { const rc = arena.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; };
    arena.addEventListener('pointerdown', e => { lastPt = at(e); arena.setPointerCapture && arena.setPointerCapture(e.pointerId); test(lastPt.x, lastPt.y); });
    arena.addEventListener('pointermove', e => {
      if (!lastPt) return;
      const p = at(e);
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - lastPt.x, p.y - lastPt.y) / 10));
      for (let k = 1; k <= n; k++) {
        const x = lastPt.x + (p.x - lastPt.x) * k / n, y = lastPt.y + (p.y - lastPt.y) * k / n;
        test(x, y); if (k === n) trail(x, y);
      }
      lastPt = p;
    });
    const up = () => { lastPt = null; };
    arena.addEventListener('pointerup', up); arena.addEventListener('pointercancel', up);
    g.pick = i => { const c = cs.find(x => x.i === i); return c ? cut(c) : false; };
  },
  gmSlicePick(i) { const g = this._game; return g && g.pick ? g.pick(i) : false; },
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
          <button class="so-bin" data-bin="0" onclick="App.gmSortBin(0)"><b>${lessTxt}</b><small>than ${refTxt}</small><span class="so-pile" id="pile0"></span></button>
          <button class="so-bin" data-bin="1" onclick="App.gmSortBin(1)"><b>${moreTxt}</b><small>than ${refTxt}</small><span class="so-pile" id="pile1"></span></button>
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
// DRAG IT   (drag each name onto the clue that fits it)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.drag = {
  build(g, lessons, ctx) {
    const pairs = this.shuffle(lessons.flatMap(L => this.gamePairs(L) || []))
      .filter((p, i, a) => a.findIndex(q => q[0] === p[0]) === i);
    g.items = pairs.slice(0, ctx === 'hub' ? 5 : 4).map(([name, clue]) => ({ name, clue }));
    g.total = g.items.length;
    g.placed = 0; g.sel = null; g.miss = {};
    g.order = this.shuffle(g.items.map((_, i) => i));
  },
  render() { this.gmDrag(); },
};
Object.assign(App, {
  gmDrag() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    el.innerHTML = `${this.gameTop(g, `${g.placed} / ${g.total}`)}
      <div class="gm-wrap dg-wrap">
        ${this.gameHead(this.GPHR.dragTitle, this.GPHR.dragHelp)}
        <div class="dg-slots">${g.items.map((it, k) => `
          <div class="dg-slot" id="dgs${k}" data-k="${k}" onclick="App.gmDragSlot(${k})">
            <span class="dg-clue">${it.clue}</span>
            <span class="dg-drop" id="dgd${k}">drop the name here</span>
            ${this.listenLabel('', it.clue)}
          </div>`).join('')}</div>
        <div class="dg-tray" id="dgTray">${g.order.map(k => `
          <button class="dg-chip" id="dgc${k}" data-k="${k}" onclick="App.gmDragChip(${k})">${g.items[k].name}</button>`).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.autoPlay('#lessonOverlay .gm-help .listen');
    // real dragging: pick up a name, drop it on a clue
    const tray = document.getElementById('dgTray');
    let dragK = null, ghost = null;
    tray.addEventListener('pointerdown', e => {
      const c = e.target.closest('.dg-chip'); if (!c || c.disabled) return;
      dragK = +c.dataset.k;
      ghost = c.cloneNode(true); ghost.classList.add('dg-ghost'); ghost.removeAttribute('id');
      document.body.appendChild(ghost);
      ghost.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 26}px)`;
      c.classList.add('lift');
      this.speakNow([g.items[dragK].name], true);
      e.preventDefault();
    });
    this._dgMove = e => { if (ghost) ghost.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 26}px)`; };
    this._dgUp = e => {
      if (dragK == null) return;
      const k = dragK; dragK = null;
      if (ghost) { ghost.remove(); ghost = null; }
      const c = document.getElementById('dgc' + k); if (c) c.classList.remove('lift');
      const slots = [...document.querySelectorAll('.dg-slot')];
      const hit = slots.findIndex(s => { const b = s.getBoundingClientRect();
        return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; });
      if (hit >= 0) this.gmDragPlace(k, hit);
    };
    window.addEventListener('pointermove', this._dgMove);
    window.addEventListener('pointerup', this._dgUp);
    this._dragCleanup = () => {
      window.removeEventListener('pointermove', this._dgMove);
      window.removeEventListener('pointerup', this._dgUp);
    };
  },
  gmDragChip(k) {            // tap a name, then tap the clue it belongs to
    const g = this._game; if (!g || g.kind !== 'drag') return;
    document.querySelectorAll('.dg-chip').forEach(c => c.classList.remove('sel'));
    const c = document.getElementById('dgc' + k);
    if (c && !c.disabled) { g.sel = k; c.classList.add('sel'); this.speakNow([g.items[k].name], true); }
  },
  gmDragSlot(k) {
    const g = this._game; if (!g || g.kind !== 'drag' || g.sel == null) return;
    this.gmDragPlace(g.sel, k);
  },
  gmDragPlace(chipK, slotK) {
    const g = this._game;
    const chip = document.getElementById('dgc' + chipK), slot = document.getElementById('dgs' + slotK);
    if (!g || !chip || !slot || chip.disabled || slot.classList.contains('done')) return false;
    g.sel = null;
    document.querySelectorAll('.dg-chip').forEach(c => c.classList.remove('sel'));
    if (chipK === slotK) {
      chip.disabled = true; chip.style.display = 'none';
      slot.classList.add('done');
      document.getElementById('dgd' + slotK).textContent = g.items[slotK].name;
      g.placed++;
      if (!g.miss[chipK]) g.right++;
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${g.placed} / ${g.total}`;
      Sfx.play('yes', 0.45); this.haptic(12); this.speakNow([g.items[slotK].name], true);
      if (g.placed >= g.total) {
        if (this._dragCleanup) { this._dragCleanup(); this._dragCleanup = null; }
        g.idx = g.total;
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.PHR.pairsDone}</div>`;
        this.confetti(18); Sfx.play('tada', 0.4);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 1800);
      }
      return true;
    }
    g.miss[chipK] = true;
    chip.classList.add('wrong'); slot.classList.add('wrong');
    setTimeout(() => { chip.classList.remove('wrong'); slot.classList.remove('wrong'); }, 450);
    Sfx.play('no', 0.35); this.haptic(30);
    return false;
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
