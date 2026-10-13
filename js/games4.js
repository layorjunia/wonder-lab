// Picture games for the lessons that have no photos (Earth, Astronomy, Body, History...).
//
// Each lesson gets ONE game designed around what it teaches (data: L.picgame,
// from .work/picgames/*.jsonl via tools/build_lessons.py), the way Lamplight
// builds a small game around each lesson. Pictures are Fluent emoji art, the
// goal is a spoken sentence, every picture says its name when touched.
//
//   tapall   "Tap everything that ..."   tap the right pictures among the wrong ones
//   catch    "Catch ..."                 the pictures fall, Pip catches the right ones
//   sort     "Put each one in the right box"   two boxes, each with a picture and a label

(function () {
  const G = App.GPHR;
  // every spoken string in these games is one recorded clip: the goal, each picture's name, each box label
  (typeof LESSONS !== 'undefined' ? LESSONS : []).forEach(L => {
    const pg = L.picgame; if (!pg) return;
    G['pg_goal_' + L.id] = pg.goal;
    (pg.bins || []).forEach((b, i) => { G['pg_bin_' + L.id + '_' + i] = b.label; });
    (pg.items || []).forEach((it, i) => { G['pg_item_' + L.id + '_' + i] = it.name; });
  });
  G.pgSortDone = 'Everything is in the right box!';
  G.pgAgain = 'Try again';
})();

Object.assign(App.GAMES, {
  factall:   { name: 'Picture Hunt',  glyph: '🔎', blurb: 'Tap everything that belongs' },
  factcatch: { name: 'Picture Catch', glyph: '🧺', blurb: 'Your buddy catches the right ones' },
  factsort:  { name: 'Two Boxes',     glyph: '📦', blurb: 'Put each one in the right box' },
});

Object.assign(App, {
  pgOf(L) { return L.picgame || null; },
  pgImg(icon) {
    const src = this.fxSrc(icon);
    return src ? `<img src="${src}" alt="">` : `<span class="pg-emoji">${icon}</span>`;
  },
  pgSay(L, i) { return this.GPHR['pg_item_' + L.id + '_' + i]; },
  pgBtn(L, it, i) {
    return `<button class="pic pg-pic" data-i="${i}" onclick="App.gmPgTap(${i})">${this.pgImg(it.icon)}<span class="pic-name"></span></button>`;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// TAP THEM ALL
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.factall = {
  build(g, lessons) {
    const L = lessons[0], pg = L.picgame;
    g.L = L;
    g.items = this.shuffle(pg.items.map((it, i) => ({ ...it, i })));
    g.need = pg.items.filter(x => x.good).length;
    g.total = g.need; g.found = 0; g.misses = 0; g.right = 0;
  },
  render() { this.gmPgTapAll(); },
};
Object.assign(App, {
  gmPgTapAll() {
    const g = this._game, el = document.getElementById('lessonOverlay'), L = g.L, pg = L.picgame;
    g.locked = false;
    el.innerHTML = `${this.gameTop(g, `${g.found} / ${g.need}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['pg_goal_' + L.id]], pg.goal)}
        <div class="pic-grid dense pg-grid">${g.items.map(it => this.pgBtn(L, it, it.i)).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['pg_goal_' + L.id]]);
  },
  gmPgTap(i) {
    const g = this._game; if (!g || g.kind !== 'factall' || g.locked) return false;
    const L = g.L, it = L.picgame.items[i];
    const btn = document.querySelector(`.pg-pic[data-i="${i}"]`);
    if (!btn || btn.classList.contains('gone')) return false;
    this.speakNow([this.pgSay(L, i)], true);
    const lab = btn.querySelector('.pic-name'); if (lab) lab.textContent = it.name;
    if (it.good) {
      btn.classList.add('right', 'gone'); g.found++;
      g.right = Math.max(0, g.need - Math.min(g.need, g.misses));
      Sfx.play('yes', 0.45); this.haptic(12);
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${g.found} / ${g.need}`;
      if (g.found >= g.need) {
        g.locked = true; g.idx = g.total;
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.GPHR.gotThemAll}</div>`;
        this.confetti(20); Sfx.play('tada', 0.4); this.pipReact('happy');
        setTimeout(() => this.speakNow([this.GPHR.gotThemAll], true), 600);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2300);
      }
      return true;
    }
    g.misses++;
    btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 600);
    Sfx.play('no', 0.3);
    return false;
  },
});

// ═════════════════════════════════════════════════════════════════════════
// CATCH THEM
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.factcatch = {
  build(g, lessons) {
    const L = lessons[0], pg = L.picgame;
    g.L = L;
    g.good = pg.items.map((it, i) => ({ ...it, i })).filter(x => x.good);
    g.bad = pg.items.map((it, i) => ({ ...it, i })).filter(x => !x.good);
    g.need = Math.min(5, g.good.length + 1); g.total = g.need; g.found = 0; g.misses = 0; g.right = 0;
  },
  render() { this.gmPgCatch(); },
};
Object.assign(App, {
  gmPgCatch() {
    const g = this._game, el = document.getElementById('lessonOverlay'), L = g.L, pg = L.picgame;
    g.locked = false; g.token = (g.token || 0) + 1;
    el.innerHTML = `${this.gameTop(g, `${g.found} / ${g.need}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['pg_goal_' + L.id]], pg.goal)}
        <div class="ct-arena pic-arena" id="pcArena">
          <div class="ct-basket" id="pcBasket"><span class="ct-pip">${this.pip('')}</span><span class="ct-bowl"></span></div>
        </div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['pg_goal_' + L.id]]);
    const arena = document.getElementById('pcArena'), token = g.token;
    const W = arena.clientWidth, H = arena.clientHeight;
    const basketW = 140, basketTop = H - 100, size = Math.max(74, Math.min(104, W / 6));
    const basket = document.getElementById('pcBasket');
    let bx = W / 2, target = W / 2, last = performance.now(), nextSpawn = 0.2, gi = 0, bi = 0, flip = 0;
    const move = e => { const rc = arena.getBoundingClientRect(); target = Math.max(basketW / 2, Math.min(W - basketW / 2, e.clientX - rc.left)); };
    arena.addEventListener('pointerdown', move); arena.addEventListener('pointermove', move);
    const things = [];
    const spawn = () => {
      const wantGood = (flip++ % 3) !== 2 || g.found === 0;
      const it = wantGood ? g.good[gi++ % g.good.length] : g.bad[bi++ % Math.max(1, g.bad.length)];
      if (!it) return;
      const el2 = document.createElement('div');
      el2.className = 'cp-thing pg-thing'; el2.style.width = el2.style.height = size + 'px';
      el2.innerHTML = this.pgImg(it.icon);
      arena.appendChild(el2);
      things.push({ el: el2, it, good: !!it.good, x: 8 + Math.random() * (W - size - 16), y: -size, done: false });
    };
    const speed = H / 4.8;
    const loop = now => {
      if (this._game !== g || g.token !== token || g.locked) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      bx += (target - bx) * Math.min(1, 14 * dt);
      basket.style.transform = `translateX(${bx - basketW / 2}px)`;
      nextSpawn -= dt;
      if (nextSpawn <= 0 && things.filter(x => !x.done).length < 4) { spawn(); nextSpawn = 1.2; }
      things.forEach(c => {
        if (c.done) return;
        c.y += speed * dt;
        c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        if (c.y + size >= basketTop && c.y < H - 20 && Math.abs(c.x + size / 2 - bx) < size / 2 + basketW / 2 - 30) {
          c.done = true; this.pgCaught(c);
        } else if (c.y > H) { c.done = true; c.el.remove(); }
      });
      g._raf = requestAnimationFrame(loop);
    };
    g._raf = requestAnimationFrame(loop);
    g.catchOne = good => {
      const it = (good ? g.good[0] : g.bad[0]) || g.good[0];
      this.pgCaught({ el: document.createElement('div'), it, good: !!good, done: true });
    };
  },
  pgCaught(c) {
    const g = this._game; if (!g || g.locked) return;
    this.speakNow([this.pgSay(g.L, c.it.i)], true);
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
        setTimeout(() => this.speakNow([this.GPHR.gotThemAll], true), 600);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2300);
      }
    } else {
      g.misses++; c.el.classList.add('wrong'); Sfx.play('no', 0.3);
      setTimeout(() => c.el.remove && c.el.remove(), 450);
    }
  },
  gmPgCatchPick(good) { const g = this._game; if (g && g.catchOne) { g.catchOne(good !== false); return true; } return false; },
});

// ═════════════════════════════════════════════════════════════════════════
// SORT IT   (two boxes, each with a picture and a spoken label)
// ═════════════════════════════════════════════════════════════════════════
App.GAMEX.factsort = {
  build(g, lessons) {
    const L = lessons[0], pg = L.picgame;
    g.L = L;
    g.items = this.shuffle(pg.items.map((it, i) => ({ ...it, i })));
    g.total = g.items.length; g.placed = 0; g.sel = null; g.miss = {}; g.right = 0;
  },
  render() { this.gmPgSort(); },
};
Object.assign(App, {
  gmPgSort() {
    const g = this._game, el = document.getElementById('lessonOverlay'), L = g.L, pg = L.picgame;
    el.innerHTML = `${this.gameTop(g, `${g.placed} / ${g.total}`)}
      <div class="gm-wrap pic-wrap">
        ${this.goalBar([this.GPHR['pg_goal_' + L.id]], pg.goal)}
        <div class="so-bins pg-bins">${pg.bins.map((b, k) => `
          <button class="so-bin pg-bin" data-bin="${k}" onclick="App.gmPgBin(${k})">
            <span class="pg-bin-pic">${this.pgImg(b.icon)}</span><b>${b.label}</b>
            <span class="so-pile" id="pgpile${k}"></span></button>`).join('')}</div>
        <div class="so-tray pg-tray" id="pgTray">${g.items.map(it => `
          <button class="so-chip pg-chip" id="pgc${it.i}" data-i="${it.i}" onclick="App.gmPgChip(${it.i})">${this.pgImg(it.icon)}<span>${it.name}</span></button>`).join('')}</div>
        <div id="gmMsg"></div>
      </div>`;
    this.syncListen();
    this.speakNow([this.GPHR['pg_goal_' + L.id]]);
    const tray = document.getElementById('pgTray');
    let dragI = null, ghost = null;
    tray.addEventListener('pointerdown', e => {
      const c = e.target.closest('.pg-chip'); if (!c || c.disabled) return;
      dragI = +c.dataset.i;
      ghost = c.cloneNode(true); ghost.classList.add('so-ghost'); ghost.removeAttribute('id');
      document.body.appendChild(ghost);
      ghost.style.transform = `translate(${e.clientX - 50}px, ${e.clientY - 40}px)`;
      c.classList.add('lift');
      this.speakNow([this.pgSay(L, dragI)], true);
      e.preventDefault();
    });
    this._pgMove = e => { if (ghost) ghost.style.transform = `translate(${e.clientX - 50}px, ${e.clientY - 40}px)`; };
    this._pgUp = e => {
      if (dragI == null) return;
      const i = dragI; dragI = null;
      if (ghost) { ghost.remove(); ghost = null; }
      const c = document.getElementById('pgc' + i); if (c) c.classList.remove('lift');
      const bins = [...document.querySelectorAll('.pg-bin')].map(b => b.getBoundingClientRect());
      const bi = bins.findIndex(b => e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom);
      if (bi >= 0) this.gmPgPlace(i, bi);
    };
    window.addEventListener('pointermove', this._pgMove);
    window.addEventListener('pointerup', this._pgUp);
    this._pgCleanup = () => {
      window.removeEventListener('pointermove', this._pgMove);
      window.removeEventListener('pointerup', this._pgUp);
    };
  },
  gmPgChip(i) {
    const g = this._game; if (!g || g.kind !== 'factsort') return;
    document.querySelectorAll('.pg-chip').forEach(c => c.classList.remove('sel'));
    const c = document.getElementById('pgc' + i);
    if (c && !c.disabled) { g.sel = i; c.classList.add('sel'); this.speakNow([this.pgSay(g.L, i)], true); }
  },
  gmPgBin(k) {
    const g = this._game; if (!g || g.kind !== 'factsort' || g.sel == null) return;
    this.gmPgPlace(g.sel, k);
  },
  gmPgPlace(i, bi) {
    const g = this._game; if (!g || g.kind !== 'factsort') return false;
    const L = g.L, it = L.picgame.items[i], chip = document.getElementById('pgc' + i);
    if (!it || !chip || chip.disabled) return false;
    g.sel = null; document.querySelectorAll('.pg-chip').forEach(c => c.classList.remove('sel'));
    if (it.bin === bi) {
      chip.disabled = true; chip.style.display = 'none';
      const pile = document.getElementById('pgpile' + bi);
      const d = document.createElement('div'); d.className = 'pg-done'; d.innerHTML = `${this.pgImg(it.icon)}<span>${it.name}</span>`;
      pile.appendChild(d);
      g.placed++;
      if (!g.miss[i]) g.right++;
      const c = document.querySelector('.pl-sp'); if (c) c.textContent = `${g.placed} / ${g.total}`;
      Sfx.play('yes', 0.45); this.haptic(12);
      if (g.placed >= g.total) {
        if (this._pgCleanup) { this._pgCleanup(); this._pgCleanup = null; }
        g.idx = g.total;
        document.getElementById('gmMsg').innerHTML = `<div class="gm-banner">${this.fx('🎉')} ${this.GPHR.pgSortDone}</div>`;
        this.confetti(18); Sfx.play('tada', 0.4);
        setTimeout(() => this.speakNow([this.GPHR.pgSortDone], true), 500);
        setTimeout(() => { if (this._game === g) this.gameFinish(); }, 2200);
      }
      return true;
    }
    g.miss[i] = true;
    chip.classList.add('wrong'); setTimeout(() => chip.classList.remove('wrong'), 450);
    Sfx.play('no', 0.35); this.haptic(30);
    return false;
  },
});

// a lesson with a designed picture game plays it first; Match Up is what a replay offers
(function () {
  const TYPE = { tapall: 'factall', catch: 'factcatch', sort: 'factsort' };
  const _kinds = App.gameKinds;
  App.gameKinds = function (L) {
    const out = _kinds.call(this, L);
    if (L.picgame && TYPE[L.picgame.type]) out.unshift(TYPE[L.picgame.type]);
    return out;
  };
  const _pick = App.pickGameKind;
  App.pickGameKind = function (L) {
    const kinds = this.gameKinds(L);
    const pic = kinds.find(k => k.startsWith('fact'));
    if (pic) {
      const rec = this.lessonRecord(L.id);
      if (!(rec && rec.g === pic && kinds.includes('pairs'))) return pic;
    }
    return _pick.call(this, L);
  };
})();
