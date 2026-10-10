// Wonder Lab 2 — the front door and the four tabs:
//   Journey (lessons.js)   Games   Cards   Me
// Also: the welcome screen and the bottom bar.

(function () {
  const _go = App.go;
  App.go = function (tab) {
    if (tab === 'games') {
      this.tab = 'games'; this.view = null;
      this.resetSay(); this.realm('games');
      this.setWorld(null);
      this.games();
      this.renderNav();
      return;
    }
    if (tab !== 'journey') this.setWorld(null);
    return _go.call(this, tab);
  };
})();

Object.assign(App, {

  // ── bottom bar ────────────────────────────────────────────────────────
  renderNav() {
    const me = `<span class="n-ic"><span class="nav-pip">${this.pip('')}</span></span>`;
    const items = [
      ['journey', 'Journey', this.fx('🗺️')],
      ['games', 'Games', this.fx('🎮')],
      ['collection', 'Cards', this.fx('🃏')],
      ['notes', 'Me', null],
    ];
    const inCards = ['collection', 'guide', 'plants', 'species'];
    const daily = !this.dailyDone() && this.dailyPool().length >= 5;
    document.getElementById('nav').innerHTML = items.map(([k, label, icon]) => {
      const on = this.tab === k || (k === 'collection' && inCards.includes(this.tab));
      return `<button class="${on ? 'on' : ''}" onclick="App.go('${k}')" aria-label="${label}">
        ${icon ? `<span class="n-ic">${icon}</span>` : me}${label}
        ${k === 'games' && daily ? '<i class="dot"></i>' : ''}</button>`;
    }).join('');
  },

  // ── welcome ───────────────────────────────────────────────────────────
  welcome() {
    document.getElementById('nav').innerHTML = '';
    this.setWorld('physical');
    const props = ['🦁', '🌋', '🪐', '🦠', '🌻', '🫀', '🦕', '🧲'];
    const spots = [[6, 8], [80, 6], [12, 40], [84, 38], [4, 70], [86, 68], [30, 90], [66, 92]];
    this.el(`
      <div class="wl">
        ${props.map((e, i) => `<span class="wl-prop" style="left:${spots[i][0]}%;top:${spots[i][1]}%;animation-delay:${i * .5}s">${this.fx(e)}</span>`).join('')}
        <div class="wl-pip">${this.pip('happy')}</div>
        <h1>Wonder Lab</h1>
        <p class="wl-sub">Real lessons about animals, plants, the earth, the sky, history and you. Play, learn and collect.</p>
        <div class="wl-card">
          <h2>What should we call you?</h2>
          <input id="nm" maxlength="18" placeholder="Your name" autocomplete="off" class="wl-input">
          <button class="cta pulse" onclick="App.start()">Let's go!</button>
        </div>
      </div>`);
    setTimeout(() => { const i = document.getElementById('nm'); if (i) i.focus(); }, 150);
  },

  // ── games tab ─────────────────────────────────────────────────────────
  games() {
    const done = this.doneLessons();
    const dailyDone = this.dailyDone();
    const poolOk = this.dailyPool().length >= 5;
    const accents = { pairs: ['#ff8a3d', '#d9602a'], bubbles: ['#35b6ff', '#1f86d6'],
      whoami: ['#9a7bff', '#6c4fe0'], rank: ['#3ec956', '#229a3a'],
      catch: ['#ffb02e', '#d98a10'], sling: ['#ff5a6e', '#c9304a'], slice: ['#ff7aa8', '#d04a78'],
      sort: ['#2fe0b4', '#12a784'], hilo: ['#45b9ff', '#1b86d6'], drag: ['#a98bff', '#6c4fe0'] };
    const tiles = Object.entries(this.GAMES).map(([k, g]) => {
      const n = done.filter(l => this.gameKinds(l).includes(k)).length;
      return `<button class="gtile ${n ? '' : 'locked'}" style="--t-acc:${(accents[k] || accents.pairs)[0]};--t-acc-d:${(accents[k] || accents.pairs)[1]}"
          onclick="App.hubPlay('${k}')">
        ${this.fx(g.glyph)}
        ${n ? `<span class="tag">${n} lesson${n === 1 ? '' : 's'}</span>` : `<span class="tag">${this.fx('🔒')}</span>`}
        <h3>${g.name}</h3><p>${g.blurb}</p></button>`;
    }).join('');
    this.el(`
      <div class="pip-react">
        ${this.hud()}
        <div class="tab-head"><h1>Games</h1>
          <p>Play for Sparks. Every lesson you finish unlocks more to play with.</p></div>
        <button class="daily ${dailyDone ? 'done' : ''}" onclick="App.dailyStart()">
          <span class="pip-wrap">${this.pip(dailyDone ? 'happy cheer' : '')}</span>
          <span><h2>${this.GPHR.dailyTitle}</h2>
            <p>${dailyDone ? 'Done for today. Come back tomorrow!'
              : poolOk ? 'Five questions from what you have learned.' : 'Finish a few lessons to unlock this.'}</p></span>
        </button>
        <div class="tile-grid">${tiles}</div>
      </div>`);
  },

  // ── cards tab ─────────────────────────────────────────────────────────
  collection() {
    this.resetSay();
    this.realm('collection');
    this.setWorld(null);
    const have = Progress.p.cards || {};
    const worlds = this.worlds();
    const all = LESSONS.filter(l => l.idea);
    const got = all.filter(l => have[l.id]).length;
    const gold = all.filter(l => (have[l.id] || {}).foil).length;
    const met = this.all().filter(a => Progress.state(a.id) !== 'unseen');
    const animalsMet = ANIMALS.filter(a => Progress.state(a.id) !== 'unseen').length;
    const plantsMet = (typeof PLANTS !== 'undefined' ? PLANTS : []).filter(a => Progress.state(a.id) !== 'unseen').length;
    const sections = worlds.map(c => {
      const ls = this.lessonsFor(c.id).filter(l => l.idea);
      if (!ls.length) return '';
      const t = this.theme(c.id), n = ls.filter(l => have[l.id]).length;
      return `<section class="cw">
        <div class="cw-head" style="--cw:${t.acc}">${this.fx(c.glyph)}<h2>${c.name}</h2>
          <span class="chip">${n} / ${ls.length}</span>${(Progress.p.medals || {})[c.id] ? this.fx('🏅') : ''}</div>
        <div class="dcard-grid">${ls.map(l => have[l.id]
          ? `<div onclick="App.lessonIntro('${l.id}')" style="cursor:pointer">${this.dcardHTML(l, c, have[l.id].foil, false)}</div>`
          : `<div class="dcard locked"><div class="dcard-glyph ${this.lessonPhoto(l) ? 'photo' : ''}">${this.lessonPhoto(l)
              ? `<img class="dcard-photo" src="${this.lessonPhoto(l)}" alt="">` : this.fx(l.glyph || c.glyph)}</div>
              <div class="dcard-kicker">${c.name}</div><h3>???</h3></div>`).join('')}</div>
      </section>`;
    }).join('');
    this.el(`
      ${this.hud()}
      <div class="tab-head"><h1>Cards</h1>
        <p>${got} of ${all.length} Discovery Cards${gold ? `, ${gold} gold` : ''}. Three stars turns a card gold.</p></div>
      <div class="meter" style="margin:6px 0 14px"><span style="width:${all.length ? Math.round(got / all.length * 100) : 0}%"></span></div>
      <div class="fg-row">
        <button class="gtile" style="--t-acc:#ffbb3d;--t-acc-d:#d98a10" onclick="App.go('guide')">
          ${this.fx('🦁')}<span class="tag">${animalsMet} / ${ANIMALS.length}</span>
          <h3>Animal field guide</h3><p>Every animal you meet gets a page.</p></button>
        <button class="gtile" style="--t-acc:#5fdc6c;--t-acc-d:#2fa23c" onclick="App.go('plants')">
          ${this.fx('🌻')}<span class="tag">${plantsMet} / ${typeof PLANTS !== 'undefined' ? PLANTS.length : 0}</span>
          <h3>Plant field guide</h3><p>Trees, flowers, fungi and friends.</p></button>
      </div>
      ${sections}
      <div style="height:20px"></div>`);
  },

  // ── me tab ────────────────────────────────────────────────────────────
  notes() {
    this.resetSay();
    this.setWorld(null);
    const p = Progress.p, name = (Progress.profile && Progress.profile.name) || 'Explorer';
    const lv = this.levelInfo(p.xp || 0);
    const doneL = Object.values(p.lessons || {}).filter(r => r.stars > 0).length;
    const cards = Object.keys(p.cards || {}).length;
    const keys = p.whoa || [];
    const stat = (n, label, icon) => `<div class="me-stat">${this.fx(icon)}<b>${n}</b><span>${label}</span></div>`;
    this.el(`
      <div class="pip-react">
      <div class="me-head">
        <div class="me-pip">${this.pip('happy')}</div>
        <div class="me-id">
          <h1>${name}</h1>
          <div class="me-lv"><span class="lv-n">${lv.level}</span>
            <div style="flex:1"><small>Level ${lv.level} · ${lv.into} / ${lv.span} Sparks to level ${lv.level + 1}</small>
              <span class="lv-bar"><i style="width:${Math.round(lv.frac * 100)}%"></i></span></div></div>
        </div>
      </div>
      <div class="me-stats">
        ${stat(p.dayStreak || 0, 'Day streak', '🔥')}
        ${stat(p.xp || 0, 'Sparks', '⚡')}
        ${stat(this.totalStars(), 'Stars', '⭐')}
        ${stat(doneL, 'Lessons', '📚')}
        ${stat(cards, 'Cards', '🃏')}
        ${stat(Object.keys(p.medals || {}).length, 'Medals', '🏅')}
      </div>
      ${this.voiceCard()}
      ${this.updateCard()}
      ${this.cloudCard()}
      ${keys.length ? `<h2 class="me-h">Saved facts</h2>${keys.map(k => {
        const [aid, fi] = k.split('#');
        const a = ANIMALS.find(x => x.id === aid);
        if (!a || !a.facts[+fi]) return '';
        const f = a.facts[+fi];
        return `<div class="card tight" onclick="App.species('${a.id}')" style="cursor:pointer;margin-top:10px">
          <div style="display:flex;gap:12px">
            <img src="${this.pic(a)}" alt="" style="width:64px;height:64px;object-fit:cover;
                 border-radius:14px;flex:0 0 64px" onerror="this.style.opacity=.15">
            <div><b>${a.name}</b><div class="dim" style="margin-top:4px;line-height:1.45">${f.text}</div></div>
          </div></div>`;
      }).join('')}` : ''}
      <div class="card" style="margin-top:16px">
        <h2>Photo and art credits</h2>
        <p class="dim small" style="margin-top:6px">Every photo is freely licensed. Icons are Microsoft Fluent
          Emoji (MIT). Fonts are Baloo 2 and Nunito (SIL OFL).</p>
        <button class="btn ghost" style="margin-top:10px;padding:8px 16px;font-size:16px"
          onclick="App.credits()">See the photo list</button>
      </div>
      <div style="height:20px"></div>
      </div>`);
  },
});
