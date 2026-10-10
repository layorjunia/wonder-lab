// Picture games — for a child who cannot read yet.
//
// The standard (Lamplight's): the goal is SPOKEN the moment a game opens and a
// big speaker button says it again; everything you choose between is a PICTURE;
// touching a picture says its name; nothing is timed against you; every
// mistake is gentle and says what the thing was.
//
//   tapname    Tap It       "Tap the sloth" among six photos
//   tapgroup   Tap Them     "Tap all the birds" among mixed photos
//   catchpic   Catch Them   photos fall, Pip catches the right ones
//   slingpic   Sling It     "Hit the sloth": tap a picture, or pull back and let go
//
// All from the species photos and names already in the app, so every word a
// game says is a clip that already exists (names, group names) plus a few fixed
// phrases in GPHR.

Object.assign(App.GPHR, {
  tapTitle: 'Tap it',
  tapGroupTitle: 'Tap them all',
  catchPicTitle: 'Catch them',
  slingPicHelp: 'Tap a picture to fire at it, or pull the rock back and let go.',
  gotThemAll: 'You got them all!',
});
// Whole spoken sentences, one clip each ("Tap the sloth." is never two clips glued together):
// one per species that is in a lesson, and one per group.
(function () {
  const G = App.GPHR;
  const seen = {};
  (typeof LESSONS !== 'undefined' ? LESSONS : []).forEach(L => {
    if (L.kind !== 'species') return;
    const plants = L.course === 'plants';
    (L.items || []).forEach(id => {
      if (seen[id]) return; seen[id] = 1;
      const all = plants ? (typeof PLANTS !== 'undefined' ? PLANTS : []) : (typeof ANIMALS !== 'undefined' ? ANIMALS : []);
      const a = all.find(x => x.id === id);
      if (!a) return;
      G['tapThe_' + id] = `Tap the ${a.name}.`;
      G['hitThe_' + id] = `Hit the ${a.name}.`;
    });
  });
  if (typeof GROUPS !== 'undefined') Object.entries(GROUPS).forEach(([k, v]) => {
    G['tapAll_' + k] = `Tap all the ${v.name.toLowerCase()}.`;
    G['catchAll_' + k] = `Catch all the ${v.name.toLowerCase()}.`;
  });
  if (typeof PLANT_GROUPS !== 'undefined') Object.entries(PLANT_GROUPS).forEach(([k, v]) => {
    G['tapAll_p_' + k] = `Tap all the ${v.name.toLowerCase()}.`;
    G['catchAll_p_' + k] = `Catch all the ${v.name.toLowerCase()}.`;
  });
})();

Object.assign(App.GAMES, {
  tapname:  { name: 'Tap It',      glyph: '👆', blurb: 'Hear the name, tap the picture' },
  tapgroup: { name: 'Tap Them All', glyph: '🖐️', blurb: 'Tap every bird, every fish...' },
  catchpic: { name: 'Catch Them',  glyph: '🧺', blurb: 'Pip catches the right animals' },
  slingpic: { name: 'Sling It',    glyph: '🪨', blurb: 'Hear the name, hit the picture' },
});

// pictures that are a scientific plate or a diagram, not something a child can recognise
const PIC_BAD = ['trapdoor-spider'];

Object.assign(App, {

  // ── data ─────────────────────────────────────────────────────────────
  picSpecies(lessons) {
    return lessons.flatMap(L => this.gameSpecies(L))
      .filter((a, i, arr) => a && !PIC_BAD.includes(a.id) && arr.findIndex(b => b.id === a.id) === i);
  },
  // photos of OTHER things, to be wrong with: other groups of the same kingdom first
  picDecoys(species, n, exceptGroup) {
    const plants = typeof PLANTS !== 'undefined' && species.length && PLANTS.some(p => p.id === species[0].id);
    const all = plants ? PLANTS : ANIMALS;
    const ids = new Set(species.map(a => a.id));
    let pool = all.filter(a => !ids.has(a.id) && !PIC_BAD.includes(a.id) && (!exceptGroup || a.group !== exceptGroup));
    if (pool.length < n) pool = all.filter(a => !ids.has(a.id) && !PIC_BAD.includes(a.id));
    return this.shuffle(pool).slice(0, n);
  },
  groupKey(a) {
    const plants = typeof PLANTS !== 'undefined' && PLANTS.some(p => p.id === a.id);
    return (plants ? 'p_' : '') + a.group;
  },
  groupName(a) {
    const plants = typeof PLANTS !== 'undefined' && PLANTS.some(p => p.id === a.id);
    const G = plants ? PLANT_GROUPS : GROUPS;
    return (G[a.group] || {}).name || '';
  },
  picBtn(a, extra) {
    return `<button class="pic ${extra || ''}" data-id="${a.id}" onclick="App.gmPicTap('${a.id}')">
      <img src="${this.pic(a)}" alt=""><span class="pic-name"></span></button>`;
  },
  // the spoken goal, always available again from the big speaker
  goalBar(parts, text) {
    const i = this._sayReg.push({ parts: parts.filter(Boolean), label: 'Listen' }) - 1;
    return `<button class="goal-bar" data-say="${i}" onclick="App.say(${i})" aria-label="Hear the goal">
      <span class="goal-ic">${this.ico('speak')}</span><span class="goal-t">${text}</span></button>`;
  },
  // every picture says its name when touched and shows it
  picSay(a, btn) {
    this.speakNow([a.name], true);
    const lab = btn && btn.querySelector('.pic-name');
    if (lab) lab.textContent = a.name;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// TAP IT   (hear a name, tap the picture)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.tapname = {
  build(g, lessons, ctx) {
    const sp = this.picSpecies(lessons);
    const rounds = this.shuffle(sp).slice(0, ctx === 'hub' ? 6 : 5);
    g.items = rounds.map(a => {
      const mates = this.shuffle(sp.filter(x => x.id !== a.id)).slice(0, 2);
      const far = this.picDecoys(sp, 5 - mates.length, a.group);
      return { a, opts: this.shuffle([a, ...mates, ...far]) };
    });
    g.total = g.items.length;
  },
  render() { this.gmTapName(); },
};
Object.assign(App, {
  gmTapName() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.firstTry = true;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['tapThe_' + r.a.id]], `Tap the <b>${r.a.name}</b>`)}
        <div class="pic-grid">${r.opts.map(a => this.picBtn(a)).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['tapThe_' + r.a.id]]);
  },
  gmPicTap(id) {
    const g = this._game; if (!g) return false;
    if (g.kind === 'tapname') return this.gmTapNamePick(id);
    if (g.kind === 'tapgroup') return this.gmTapGroupPick(id);
    return false;
  },
  gmTapNamePick(id) {
    const g = this._game, r = g.items[g.idx];
    if (!g || g.locked) return false;
    const btn = document.querySelector(`.pic[data-id="${id}"]`);
    const a = r.opts.find(x => x.id === id);
    if (!btn || !a || btn.classList.contains('gone')) return false;
    this.picSay(a, btn);
    if (id === r.a.id) {
      g.locked = true;
      btn.classList.add('right');
      document.querySelectorAll('.pic').forEach(b => { if (b !== btn) b.classList.add('dim'); });
      Sfx.play('yes', 0.5); this.haptic(14); this.pipReact('happy'); this.confetti(10);
      this.gameNextRound(g.firstTry, 1700);
      return true;
    }
    g.firstTry = false;
    btn.classList.add('wrong');
    setTimeout(() => btn.classList.remove('wrong'), 600);
    Sfx.play('no', 0.3);
    return false;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// TAP THEM ALL   (tap every bird, every fish...)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.tapgroup = {
  build(g, lessons, ctx) {
    const sp = this.picSpecies(lessons);
    const grp = sp[0] && sp[0].group;
    const good = this.shuffle(sp.filter(a => a.group === grp)).slice(0, 5);
    const bad = this.picDecoys(sp, Math.max(4, good.length), grp);
    g.group = grp;
    g.groupName = good[0] ? this.groupName(good[0]) : '';
    g.gkey = good[0] ? this.groupKey(good[0]) : '';
    g.good = good;
    g.items = this.shuffle([...good, ...bad]);
    g.need = good.length;
    g.total = g.need;
    g.found = 0; g.misses = 0; g.right = 0;
  },
  render() { this.gmTapGroup(); },
};
Object.assign(App, {
  gmTapGroup() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    g.locked = false;
    const gn = g.groupName;
    el.innerHTML = `${this.gameTop(g, `${g.found} / ${g.need}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['tapAll_' + g.gkey]], `Tap all the <b>${gn.toLowerCase()}</b>`)}
        <div class="pic-grid dense">${g.items.map(a => this.picBtn(a)).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['tapAll_' + g.gkey]]);
  },
  gmTapGroupPick(id) {
    const g = this._game;
    const btn = document.querySelector(`.pic[data-id="${id}"]`);
    const a = g.items.find(x => x.id === id);
    if (!btn || !a || g.locked || btn.classList.contains('gone')) return false;
    this.picSay(a, btn);
    if (a.group === g.group && g.good.some(x => x.id === id)) {
      btn.classList.add('right', 'gone');
      g.found++;
      if (g.misses <= g.found) g.right = Math.max(0, g.need - g.misses);
      Sfx.play('yes', 0.45); this.haptic(12);
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${g.found} / ${g.need}`;
      if (g.found >= g.need) {
        g.locked = true; g.idx = g.total;
        g.right = Math.max(0, g.need - Math.min(g.need, g.misses));
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.GPHR.gotThemAll}</div>`;
        this.confetti(20); Sfx.play('tada', 0.4); this.pipReact('happy');
        setTimeout(() => this.speakNow([this.GPHR.gotThemAll], true), 500);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2200);
      }
      return true;
    }
    g.misses++;
    btn.classList.add('wrong');
    setTimeout(() => btn.classList.remove('wrong'), 600);
    Sfx.play('no', 0.3);
    return false;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// CATCH THEM   (Pip catches the right animals; the others just drop away)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.catchpic = {
  build(g, lessons, ctx) {
    const sp = this.picSpecies(lessons);
    const grp = sp[0] && sp[0].group;
    g.good = sp.filter(a => a.group === grp);
    g.bad = this.picDecoys(sp, 6, grp);
    g.group = grp;
    g.groupName = g.good[0] ? this.groupName(g.good[0]) : '';
    g.gkey = g.good[0] ? this.groupKey(g.good[0]) : '';
    g.need = 5; g.total = 5; g.found = 0; g.misses = 0; g.right = 0;
  },
  render() { this.gmCatchPic(); },
};
Object.assign(App, {
  gmCatchPic() {
    const g = this._game, el = document.getElementById('lessonOverlay');
    g.locked = false; g.token = (g.token || 0) + 1;
    el.innerHTML = `${this.gameTop(g, `${g.found} / ${g.need}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['catchAll_' + g.gkey]], `Catch all the <b>${g.groupName.toLowerCase()}</b>`)}
        <div class="ct-arena pic-arena" id="cpArena">
          <div class="ct-basket" id="cpBasket"><span class="ct-pip">${this.pip('')}</span><span class="ct-bowl"></span></div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['catchAll_' + g.gkey]]);
    const arena = document.getElementById('cpArena');
    const token = g.token;
    const W = arena.clientWidth, H = arena.clientHeight;
    const basketW = 140, basketTop = H - 100, size = Math.max(78, Math.min(110, W / 5));
    const basket = document.getElementById('cpBasket');
    let bx = W / 2, target = W / 2, last = performance.now(), nextSpawn = 0.2, t = 0;
    const move = e => { const rc = arena.getBoundingClientRect(); target = Math.max(basketW / 2, Math.min(W - basketW / 2, e.clientX - rc.left)); };
    arena.addEventListener('pointerdown', move); arena.addEventListener('pointermove', move);
    const things = [];
    let goodIdx = 0, badIdx = 0, flip = 0;
    const spawn = () => {
      const wantGood = (flip++ % 3) !== 2 || g.found === 0;           // two good for every one other
      const a = wantGood ? g.good[goodIdx++ % g.good.length] : g.bad[badIdx++ % g.bad.length];
      const el2 = document.createElement('div');
      el2.className = 'cp-thing'; el2.style.width = (size * 1.3) + 'px'; el2.style.height = size + 'px';
      el2.innerHTML = `<img src="${this.pic(a)}" alt="">`;
      arena.appendChild(el2);
      const x = 8 + Math.random() * (W - size * 1.3 - 16);
      things.push({ el: el2, a, good: wantGood, x, y: -size, done: false });
    };
    const speed = H / 4.6;
    const loop = now => {
      if (this._game !== g || g.token !== token || g.locked) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      bx += (target - bx) * Math.min(1, 14 * dt);
      basket.style.transform = `translateX(${bx - basketW / 2}px)`;
      nextSpawn -= dt;
      if (nextSpawn <= 0 && things.filter(x => !x.done).length < 4) { spawn(); nextSpawn = 1.25; }
      things.forEach(c => {
        if (c.done) return;
        c.y += speed * dt;
        c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        if (c.y + size >= basketTop && c.y < H - 20 && Math.abs(c.x + size * 0.65 - bx) < size * 0.65 + basketW / 2 - 30) {
          c.done = true; this.cpCaught(c);
        } else if (c.y > H) { c.done = true; c.el.remove(); }
      });
      g._raf = requestAnimationFrame(loop);
    };
    g._raf = requestAnimationFrame(loop);
    g.catchOne = (good) => {     // bot entry: catch a right (or a wrong) one
      const fake = { el: document.createElement('div'), a: good ? g.good[0] : g.bad[0], good, done: true };
      this.cpCaught(fake);
    };
  },
  cpCaught(c) {
    const g = this._game; if (!g || g.locked) return;
    this.speakNow([c.a.name], true);
    if (c.good) {
      g.found++; c.el.classList.add('right');
      g.right = Math.max(0, g.need - Math.min(g.need, g.misses));
      Sfx.play('yes', 0.45); this.haptic(12); this.pipReact('happy');
      const ct = document.querySelector('.pl-sp'); if (ct) ct.textContent = `${g.found} / ${g.need}`;
      setTimeout(() => c.el.remove && c.el.remove(), 350);
      if (g.found >= g.need) {
        g.locked = true; g.idx = g.total;
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.GPHR.gotThemAll}</div>`;
        this.confetti(24); Sfx.play('tada', 0.4);
        setTimeout(() => this.speakNow([this.GPHR.gotThemAll], true), 500);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2200);
      }
    } else {
      g.misses++; c.el.classList.add('wrong');
      Sfx.play('no', 0.3);
      setTimeout(() => c.el.remove && c.el.remove(), 450);
    }
  },
  gmCatchPicPick(good) { const g = this._game; if (g && g.catchOne) { g.catchOne(good !== false); return true; } return false; },
});

// ═════════════════════════════════════════════════════════════════════════
// SLING IT   (hear a name, hit the picture — with real aim help)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.slingpic = {
  build(g, lessons, ctx) {
    const sp = this.picSpecies(lessons);
    const rounds = this.shuffle(sp).slice(0, ctx === 'hub' ? 4 : 3);
    g.items = rounds.map(a => {
      const mates = this.shuffle(sp.filter(x => x.id !== a.id)).slice(0, 2);
      const far = this.picDecoys(sp, 3 - mates.length, a.group);
      return { a, opts: this.shuffle([a, ...mates, ...far].slice(0, 4)) };
    });
    g.total = g.items.length;
  },
  render() { this.gmSlingPic(); },
};
Object.assign(App, {
  gmSlingPic() {
    const g = this._game, el = document.getElementById('lessonOverlay'), r = g.items[g.idx];
    g.locked = false; g.firstTry = true; g.token = (g.token || 0) + 1; g.shots = 3;
    el.innerHTML = `${this.gameTop(g, `${g.idx + 1} / ${g.total}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['hitThe_' + r.a.id]], `Hit the <b>${r.a.name}</b>`)}
        <div class="sl-arena pic-arena" id="spArena">
          ${r.opts.map((o, i) => `<div class="sl-target pic-target" data-i="${i}"><img src="${this.pic(o)}" alt=""><span class="pic-name"></span></div>`).join('')}
          <div class="sl-post"></div><div class="sl-band" id="spBand"></div>
          <div class="sl-rock" id="spRock">${this.fx('🪨')}</div>
          <div class="sl-dots" id="spDots"></div>
          <div class="sl-shots" id="spShots">${'<i></i>'.repeat(3)}</div>
        </div>
        <p class="gm-help-in" style="margin-top:8px">${this.GPHR.slingPicHelp}</p>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['hitThe_' + r.a.id]]);
    const arena = document.getElementById('spArena');
    const token = g.token, idx = g.idx;
    const W = arena.clientWidth, H = arena.clientHeight;
    const rock = document.getElementById('spRock'), dots = document.getElementById('spDots'), band = document.getElementById('spBand');
    const R = { x: Math.max(54, W * 0.13), y: H - 70 };
    const G = 900;
    const setRock = (x, y) => { rock.style.transform = `translate(${x - 22}px, ${y - 22}px)`; };
    setRock(R.x, R.y);
    // one column of big pictures down the right edge: nothing stands in front of anything else
    const n = r.opts.length;
    const ts = Math.max(86, Math.min(136, (H - 28 - (n - 1) * 12) / n));          // height of a picture
    const tw = Math.min(ts * 1.33, W * 0.4);                                       // 4:3, the whole photo fits
    const slots = r.opts.map((_, i) => ({ x: W - tw - 16, y: 14 + i * (ts + 12) }));
    const tg = [...arena.querySelectorAll('.pic-target')].map((t, i) => {
      const sl = slots[i % slots.length];
      t.style.width = tw + 'px'; t.style.height = ts + 'px';
      t.style.transform = `translate(${sl.x}px, ${sl.y}px)`;
      return { el: t, i, x: sl.x, y: sl.y, w: tw, h: ts, gone: false };
    });
    const center = t => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
    let flying = null, drag = null, last = 0;
    const useShot = () => { g.shots--; const s = document.querySelectorAll('#spShots i'); if (s[g.shots]) s[g.shots].classList.add('spent'); };
    const hit = p => tg.find(t => !t.gone && p.x > t.x - 12 && p.x < t.x + t.w + 12 && p.y > t.y - 12 && p.y < t.y + t.h + 12);
    const path = (vx, vy, n = 60, dt = 0.05) => {
      const pts = []; let x = R.x, y = R.y, ux = vx, uy = vy;
      for (let k = 0; k < n; k++) { uy += G * dt; x += ux * dt; y += uy * dt; pts.push({ x, y }); if (y > H + 40 || x > W + 40) break; }
      return pts;
    };
    // the speed that carries the rock from the rest point through a picture's middle at a launch angle
    const solve = (t, ang) => {
      const c = center(t), dx = c.x - R.x, dy = R.y - c.y;      // dy: up is positive
      const cos = Math.cos(ang), tan = Math.tan(ang);
      const den = 2 * cos * cos * (dx * tan - dy);
      if (dx <= 0 || den <= 0) return null;
      const v = Math.sqrt(G * dx * dx / den);
      return { vx: v * cos, vy: -v * Math.sin(ang), v };
    };
    const straight = t => { const c = center(t); return Math.atan2(R.y - c.y, c.x - R.x); };
    // AIM HELP: point the pull at a picture (a little above it is fine) and the speed is worked out for you.
    const assist = (vx, vy) => {
      const ang = Math.atan2(-vy, vx), deg = Math.PI / 180;
      let best = null;
      tg.forEach(t => {
        if (t.gone) return;
        const a0 = straight(t), d = ang - a0;
        if (d >= -9 * deg && d <= 16 * deg) {
          const k = Math.abs(d);
          if (!best || k < best.k) best = { t, a: Math.max(ang, a0 + 6 * deg), k };
        }
      });
      if (!best) return { vx, vy, t: null };
      // lob it a little higher until the speed is reasonable (a straight-at-it aim needs a lift)
      let a = best.a, sol = solve(best.t, a);
      for (let k = 0; (!sol || sol.v > 1100) && a < 80 * deg; k++) { a += 2 * deg; sol = solve(best.t, a); }
      if (!sol || sol.v > 1500) return { vx, vy, t: null };
      return { vx: sol.vx, vy: sol.vy, t: best.t };
    };
    const settle = () => {
      flying = null; setRock(R.x, R.y); rock.style.opacity = 1;
      if (!g.locked && g.shots <= 0) {         // out of shots: show the right one and move on
        g.locked = true; g.firstTry = false;
        const right = tg.find(t => r.opts[t.i].id === r.a.id);
        if (right) right.el.classList.add('right');
        this.speakNow([r.a.name], true);
        this.gameNextRound(false, 2400);
      }
    };
    const resolve = t => {
      t.gone = true;
      const a = r.opts[t.i];
      this.speakNow([a.name], true);
      const lab = t.el.querySelector('.pic-name'); if (lab) lab.textContent = a.name;
      if (a.id === r.a.id) {
        g.locked = true;
        t.el.classList.add('right');
        Sfx.play('yes', 0.5); this.haptic(14); this.pipReact('happy'); this.confetti(12);
        this.gameNextRound(g.firstTry, 1900);
        return true;
      }
      g.firstTry = false;
      t.el.classList.add('wrong');
      Sfx.play('no', 0.3); this.haptic(30);
      return false;
    };
    const fire = (vx, vy, raw) => {
      if (flying || g.locked || g.shots <= 0) return;
      useShot();
      const a = raw ? { vx, vy } : assist(vx, vy);
      flying = { x: R.x, y: R.y, vx: a.vx, vy: a.vy };
      last = performance.now(); band.style.opacity = 0; dots.innerHTML = '';
      const step = now => {
        if (this._game !== g || g.token !== token || g.idx !== idx || !flying) return;
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        flying.vy += G * dt; flying.x += flying.vx * dt; flying.y += flying.vy * dt;
        setRock(flying.x, flying.y);
        const t = hit(flying);
        if (t) {
          flying = null; rock.style.opacity = 0;
          const ok = resolve(t);
          if (!ok) setTimeout(() => { if (this._game === g && !g.locked) settle(); }, 700);
          return;
        }
        if (flying.y > H + 60 || flying.x > W + 60 || flying.x < -60) { settle(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const showAim = (dx, dy) => {
      band.style.opacity = 1; band.style.width = Math.hypot(dx, dy) + 'px';
      band.style.transform = `translate(${R.x}px, ${R.y}px) rotate(${Math.atan2(dy, dx)}rad)`;
      const a = assist(-dx * 7.5, -dy * 7.5);
      const pts = path(a.vx, a.vy, 40, 0.045);
      dots.innerHTML = pts.map((p, k) => k % 2 ? '' : `<i style="transform:translate(${p.x - 4}px,${p.y - 4}px)"></i>`).join('');
      tg.forEach(t => t.el.classList.toggle('aimed', a.t === t));
    };
    const rc = () => arena.getBoundingClientRect();
    arena.addEventListener('pointerdown', e => {
      if (flying || g.locked || g.shots <= 0) return;
      const box = rc(), px = e.clientX - box.left, py = e.clientY - box.top;
      // a tap on a picture fires straight at it
      const t = tg.find(x => !x.gone && px > x.x && px < x.x + x.w && py > x.y && py < x.y + x.h);
      if (t) {
        const a0 = straight(t);
        let a = a0 + 0.2, sol = solve(t, a);
        for (let k = 0; (!sol || sol.v > 1100) && a < 1.4; k++) { a += 0.05; sol = solve(t, a); }
        if (sol) { fire(sol.vx, sol.vy, true); return; }
      }
      arena.setPointerCapture && arena.setPointerCapture(e.pointerId);
      drag = { dx: 0, dy: 0 };
    });
    arena.addEventListener('pointermove', e => {
      if (!drag) return;
      const box = rc();
      let dx = e.clientX - box.left - R.x, dy = e.clientY - box.top - R.y;
      const len = Math.hypot(dx, dy), max = 120;
      if (len > max) { dx *= max / len; dy *= max / len; }
      setRock(R.x + dx, R.y + dy);
      drag = { dx, dy, len: Math.min(len, max) };
      showAim(dx, dy);
    });
    const release = () => {
      if (!drag) return;
      const d = drag; drag = null;
      tg.forEach(t => t.el.classList.remove('aimed'));
      if (!d.len || d.len < 16) { setRock(R.x, R.y); band.style.opacity = 0; dots.innerHTML = ''; return; }
      fire(-d.dx * 7.5, -d.dy * 7.5);
    };
    arena.addEventListener('pointerup', release); arena.addEventListener('pointercancel', release);
    g.pick = i => {                    // bot: tap the picture
      const t = tg.find(x => x.i === i);
      if (!t || t.gone || g.locked) return false;
      useShot();
      return resolve(t);
    };
  },
  gmSlingPicPick(i) { const g = this._game; return g && g.pick ? g.pick(i) : false; },
});

// eligibility: every lesson with at least three species can play the picture games
(function () {
  const _kinds = App.gameKinds;
  App.gameKinds = function (L) {
    const out = _kinds.call(this, L);
    const sp = this.gameSpecies(L);
    if (sp.length >= 3) out.push('tapname', 'tapgroup', 'catchpic', 'slingpic');
    return out;
  };
})();
