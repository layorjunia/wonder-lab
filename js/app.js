// Wonder Lab — app shell.
//
// Five tabs, all driven off the same two data arrays:
//   Today   — a FINITE dealt deck of fact cards. Finite on purpose: an endless
//             scroll trains skimming, a deck that runs out gives a clean stop
//             and a reason to come back tomorrow.
//   Guide   — browse everything, filtered by group or habitat, showing how well
//             each species is known.
//   Play    — quizzes and face-offs, generated entirely from the data.
//   Body    — the human body half, built around do-it-now experiments.
//   Notes   — everything the kid marked "Whoa!", their own collection.

const App = {
  tab: 'today',
  view: null,

  // ── boot ──
  init() {
    this.checkForUpdate();          // unawaited on purpose — never blocks boot
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const has = Progress.init();
    if (has) { Progress.touchDay(); Progress.commit(); this.go('today'); }
    else this.welcome();
  },

  // An installed service worker plus Pages' HTML caching can pin a device to
  // an old build for hours with no error anywhere. Compare the id baked into
  // the page against version.json fetched with no-store; on a mismatch, bin
  // every cache and reload exactly once.
  async checkForUpdate() {
    try {
      const meta = document.querySelector('meta[name="build"]');
      const running = meta ? meta.getAttribute('content') : null;
      const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const { build } = await res.json();
      if (!build || !running || build === running) return;
      if (sessionStorage.getItem('wonderlab-updating') === build) return;   // never loop
      sessionStorage.setItem('wonderlab-updating', build);
      for (const k of await caches.keys()) await caches.delete(k);
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      location.replace(location.pathname + '?b=' + build);
    } catch (e) { /* offline: keep running what we have */ }
  },

  el(html) {
    document.getElementById('app').innerHTML = `<div class="screen">${html}</div>`;
    window.scrollTo(0, 0);
  },

  // Registry indexes are per-screen; stale entries would point a button at
  // another screen's text. Cleared before each render, filled during it.
  resetSay() { this._sayReg = []; this._saying = null; AudioLib.stop(); },

  go(tab) {
    this.tab = tab;
    this.view = null;
    this.resetSay();
    ({ today: () => this.today(), trails: () => this.expeditions(),
       explore: () => this.explore(),
       guide: () => this.guide(), plants: () => this.plants(),
       play: () => this.play(),
       body: () => this.body(), notes: () => this.notes() }[tab]
      // Any TOPIC_SETS key is a valid destination — seven subjects and
      // counting, none of which needs its own line here.
      || (TOPIC_SETS[tab] ? () => this.topics(tab) : null)
      || (() => this.today()))();
    this.renderNav();
  },

  renderNav() {
    // Four sections (animals, plants, earth, human) plus Today, Play and Notes
    // is seven destinations — too many for a thumb-sized bar. Explore is a hub
    // over the four; the bar stays at four items and has room to grow.
    const items = [
      ['today', 'Today'], ['trails', 'Trails'],
      ['explore', 'Explore'], ['play', 'Play'], ['notes', 'Notes'],
    ];
    const inExplore = ['explore', 'guide', 'plants', 'body'].concat(Object.keys(TOPIC_SETS));
    document.getElementById('nav').innerHTML = items.map(([k, label]) =>
      `<button class="${this.tab === k || (k === 'explore' && inExplore.includes(this.tab)) ? 'on' : ''}"
        onclick="App.go('${k}')" aria-label="${label}">
        ${this.icon(k)}${label}</button>`).join('');
  },


  // Drawn, not typed. Five icons is a small enough set to hand-draw and it is
  // the most-looked-at furniture in the app.
  ICON: {
    today:   '<path d="M3 12h3l2.5-7 4 14L15 9l2 3h4"/>',
    trails:  '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 10 10l-1.5 5.5L14 14z"/>',
    explore: '<path d="M4 5.5A2 2 0 0 1 6 4h5v16H6a2 2 0 0 0-2 2z"/>'
             + '<path d="M20 5.5A2 2 0 0 0 18 4h-5v16h5a2 2 0 0 1 2 2z"/>',
    play:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'
             + '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    notes:   '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9.5 12h6M9.5 16h4"/>',
  },

  icon(name) {
    return `<span class="n-ic"><svg viewBox="0 0 24 24" aria-hidden="true">`
         + (this.ICON[name] || '') + `</svg></span>`;
  },

  // ── Listen buttons ──
  // Narration is opt-in per section, never automatic: this app is read as
  // often as it is listened to, and audio that starts by itself is audio you
  // have to stop. Long text goes through an index rather than into the onclick
  // attribute — a fact containing an apostrophe would otherwise break the
  // handler it is embedded in.
  _sayReg: [],
  _saying: null,

  listenBtn(...parts) { return this._mkListen('Listen', parts); },

  // Labelled variant. In the games the button offers something more specific
  // than "listen", and "Hear the choices" is the difference between a child
  // using it and never noticing it is there.
  listenLabel(label, ...parts) { return this._mkListen(label, parts); },

  _mkListen(label, parts) {
    const clean = parts.filter(p => p && String(p).trim());
    if (!clean.length) return '';
    const i = this._sayReg.push({ parts: clean, label }) - 1;
    return `<button class="listen" data-say="${i}" aria-label="${label}"
      onclick="event.stopPropagation();App.say(${i})">
      <span class="ic">▶</span><span class="lbl">${label}</span></button>`;
  },

  say(i) {
    const reg = this._sayReg[i];
    if (!reg) return;
    const parts = reg.parts;
    if (this._saying === i) { AudioLib.stop(); this._saying = null; return this.syncListen(); }
    this._saying = i;
    this.syncListen();
    AudioLib.speakSeq(parts).then(() => {
      if (this._saying === i) { this._saying = null; this.syncListen(); }
    });
  },

  // Repaint the buttons in place. A full re-render would reset the scroll
  // position out from under a child halfway down a species page.
  syncListen() {
    document.querySelectorAll('.listen').forEach(b => {
      const on = +b.dataset.say === this._saying;
      b.classList.toggle('on', on);
      b.querySelector('.ic').textContent = on ? '■' : '▶';
      b.querySelector('.lbl').textContent = on ? 'Stop'
        : ((this._sayReg[+b.dataset.say] || {}).label || 'Listen');
    });
  },

  // "How do we know this?" badge. Absent `kind` renders nothing, so the
  // living-animal entries are unaffected until they are marked too.
  kindTag(f, dino) {
    const k = KINDS[f.kind];
    if (!k) return '';
    const v = (dino && k.dino) ? k.dino : k;
    return `<span class="kind-tag k-${f.kind}" title="${k.blurb}"
      onclick="event.stopPropagation();App.explainKind('${f.kind}')"
      >${v.glyph} ${v.name}</span>`;
  },

  explainKind(id) {
    const k = KINDS[id];
    if (k) alert(k.glyph + '  ' + k.name + '\n\n' + k.blurb);
  },

  // Animals and plants share the entry shape and the profile screen, so one
  // lookup serves both. A duplicate profile renderer would have been the third
  // place to remember when the schema changes.
  all() {
    return (typeof PLANTS !== 'undefined' ? ANIMALS.concat(PLANTS) : ANIMALS);
  },
  find(id) { return this.all().find(x => x.id === id); },

  // Tile image: the restoration when there is one, otherwise the photo.
  pic(a) { return 'img/' + (a.art ? a.id + '-life.jpg' : a.id + '.jpg'); },

  bar(title, right) {
    return `<div class="bar"><h1>${title}</h1><div class="grow"></div>${right || ''}</div>`;
  },

  streakChip() {
    const s = Progress.p.dayStreak || 0;
    return s > 1 ? `<span class="chip flame">🔥 ${s}</span>` : '';
  },

  // ── welcome ──
  welcome() {
    document.getElementById('nav').innerHTML = '';
    this.el(`
      <div style="padding:60px 6px 20px;text-align:center">
        <div style="font-size:4rem;line-height:1">🔬</div>
        <h1 style="margin-top:10px;font-size:2.1rem">Wonder Lab</h1>
        <p class="dim" style="margin-top:8px;font-size:1.02rem">
          Thousands of true, strange, brilliant things<br>about animals and your own body.</p>
      </div>
      <div class="card">
        <h2>What should we call you?</h2>
        <input id="nm" maxlength="18" placeholder="Your name"
          style="width:100%;margin-top:12px;padding:14px;border-radius:12px;
                 background:var(--ink-3);border:1px solid var(--line);
                 color:var(--text);font:inherit;font-size:1.05rem">
        <button class="btn wide big" style="margin-top:14px" onclick="App.start()">Start exploring</button>
      </div>`);
    setTimeout(() => { const i = document.getElementById('nm'); if (i) i.focus(); }, 100);
  },

  start() {
    const n = (document.getElementById('nm').value || '').trim() || 'Explorer';
    Progress.create(n);
    this.go('today');
  },

  // ── TODAY: the dealt deck ──
  DECK_SIZE: 20,

  buildDeck() {
    const p = Progress.p, today = Store.dayKey();
    if (p.deck.day === today && p.deck.served.length) return p.deck;

    // Weight toward species the child has not met, so the deck keeps opening
    // new doors instead of recycling favourites.
    const pool = [];
    ANIMALS.forEach(a => {
      const st = Progress.state(a.id);
      const weight = st === 'unseen' ? 4 : st === 'seen' ? 2 : 1;
      a.facts.forEach((f, i) => {
        for (let w = 0; w < weight; w++) pool.push(a.id + '#' + i);
      });
    });
    // deterministic shuffle seeded by the date, so the deck is stable all day
    let seed = 0;
    for (const c of today) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const picked = [], usedSpecies = {};
    while (picked.length < this.DECK_SIZE && pool.length) {
      const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const sp = k.split('#')[0];
      if ((usedSpecies[sp] || 0) >= 2) continue;   // no species more than twice
      usedSpecies[sp] = (usedSpecies[sp] || 0) + 1;
      picked.push(k);
    }
    p.deck = { day: today, served: picked, idx: 0 };
    Progress.commit();
    return p.deck;
  },

  today() {
    this.resetSay();
    const deck = this.buildDeck();
    if (deck.idx >= deck.served.length) return this.deckDone();

    const [aid, fi] = deck.served[deck.idx].split('#');
    const a = ANIMALS.find(x => x.id === aid);
    if (!a) { deck.idx++; return this.today(); }
    const f = a.facts[+fi];
    Progress.markSeen(a.id);

    const cat = CATEGORIES[f.cat] || { name: f.cat, glyph: '✨' };
    const whoa = Progress.isWhoa(a.id, +fi);
    this.el(`
      ${this.bar('Today', `${this.streakChip()}<span class="chip">${deck.idx + 1} / ${deck.served.length}</span>`)}
      <div class="fact-deck">
        <div class="fact-card">
          <div class="fact-photo">
            <span class="fact-tag">${cat.glyph} ${cat.name}</span>
            ${this.kindTag(f, a.group === 'dinosaurs')}
            <img src="${this.pic(a)}" alt="${a.name}" loading="eager"
                 onerror="this.style.display='none'">
            <div class="fact-name">${a.name}</div>
          </div>
          <div class="fact-body">
            <div class="fact-text">${f.text}</div>
            ${f.more ? `<div class="fact-more">${f.more}</div>` : ''}
            ${a.wonder && +fi === 0 ? `<div class="wonder">${a.wonder}</div>` : ''}
            <div class="fact-actions">
              ${this.listenBtn(a.name, cat.name, f.text, f.more)}
              <button class="btn ghost" onclick="App.whoa(${deck.idx})">
                ${whoa ? '★ Saved' : '☆ Whoa!'}</button>
              <button class="btn ghost" onclick="App.species('${a.id}')">Full profile</button>
              <button class="btn" onclick="App.nextCard()">Next →</button>
            </div>
          </div>
        </div>
      </div>`);
  },

  whoa(i) {
    const deck = Progress.p.deck;
    const [aid, fi] = deck.served[i].split('#');
    Progress.toggleWhoa(aid, +fi);
    this.today();
  },

  nextCard() {
    Progress.p.deck.idx++;
    Progress.commit();
    this.today();
  },

  deckDone() {
    const c = Progress.counts();
    this.el(`
      ${this.bar('Today', this.streakChip())}
      <div class="card" style="text-align:center;padding:34px 20px">
        <div style="font-size:3rem">🎉</div>
        <h2 style="margin-top:8px">That's today's deck</h2>
        <p class="dim" style="margin-top:8px">You've met <b>${c.seen + c.known + c.mastered}</b>
           of ${ANIMALS.length} species so far.</p>
        <div class="meter" style="margin:16px 0 6px">
          <span style="width:${Math.round((c.seen + c.known + c.mastered) / ANIMALS.length * 100)}%"></span>
        </div>
        <p class="dim small">A fresh deck is dealt tomorrow.</p>
        <button class="btn wide big" style="margin-top:16px" onclick="App.go('play')">
          Test what you remember →</button>
        <button class="btn ghost wide" style="margin-top:10px" onclick="App.go('guide')">
          Browse the field guide</button>
      </div>`);
  },

  // ── EXPLORE: the hub over the four sections ──
  explore() {
    this.resetSay();
    const c = Progress.counts();
    const met = c.seen + c.known + c.mastered;
    const nPlants = typeof PLANTS !== 'undefined' ? PLANTS.length : 0;
    const nBody = typeof BODY !== 'undefined' ? BODY.length : 0;

    // Ten subjects in one flat grid is a wall. Three families, from
    // FAMILIES in schema.js — a subject with no data yet renders as
    // "being written" rather than vanishing, so the shape of the app is
    // visible before the content lands.
    const countFor = (c) => {
      if (c.go === 'guide') return `${ANIMALS.length} species · ${met} met`;
      if (c.go === 'plants') return nPlants ? `${nPlants} kinds to meet` : 'being written';
      if (c.go === 'body') return `${nBody} facts about you`;
      const cfg = this.topicCfg(c.topic);
      return cfg.rows.length ? `${cfg.rows.length} facts` : 'being written';
    };
    const cardFor = (c, tint) => {
      const t = c.topic ? TOPIC_SETS[c.topic] : null;
      const dest = c.topic || c.go;
      const glyph = c.glyph || (t && t.glyph);
      const name = c.name || (t && t.name);
      const empty = c.topic && !this.topicCfg(c.topic).rows.length;
      const pat = c.pat || (t && t.pat) || 'leaf';
      // colour drives the texture too — currentColor inside ::after
      return `<div class="kingdom pat-${pat}${empty ? ' soon' : ''}"
          onclick="App.go('${dest}')" style="--tint:${tint};color:${tint}">
        <span class="k-glyph">${glyph}</span>
        <div class="k-name" style="color:var(--text)">${name}</div>
        <div class="k-sub">${countFor(c)}</div>
      </div>`;
    };

    const totalFacts = ANIMALS.reduce((n, a) => n + a.facts.length, 0)
      + (typeof PLANTS !== 'undefined' ? PLANTS.reduce((n, p) => n + p.facts.length, 0) : 0)
      + nBody
      + Object.keys(TOPIC_SETS).reduce((n, k) => n + this.topicCfg(k).rows.length, 0);
    const deck = Progress.p.deck || {};
    const left = Math.max(0, (deck.served || []).length - (deck.idx || 0));
    const pct = Math.round(met / Math.max(1, ANIMALS.length) * 100);
    const tried = Object.keys(Progress.p.tried || {}).length;
    // A photograph, not a coloured rectangle. There are 322 licensed images
    // here and the front door was using none of them. Curated rather than
    // random: rotating through all 210 lands on a lot of pale cave newts, and
    // the first thing she sees each day should be worth seeing.
    const HERO = ['red-eyed-tree-frog', 'snowy-owl', 'cheetah', 'giraffe', 'orca',
                  'poison-dart-frog', 'lion', 'emperor-penguin', 'monarch-butterfly',
                  'tarsier', 'clownfish', 'sea-otter', 'arctic-fox', 'toucan',
                  'flamingo', 'humpback-whale', 'peacock'];
    const heroA = this.find(HERO[Math.floor(Date.now() / 864e5) % HERO.length]);
    const heroPic = heroA ? this.pic(heroA) : this.pic(ANIMALS[0]);
    this.el(`
      <div class="hero">
        <img class="hero-bg" src="${heroPic}" alt="" aria-hidden="true"
             onerror="this.style.display='none'">
        <div class="hero-body">
          <div class="hero-eyebrow">A field guide to almost everything</div>
          <h1 class="hero-title">Wonder Lab</h1>
          <p class="hero-sub">${totalFacts.toLocaleString()} true things, in ten subjects.
            Every one of them says how anybody knows.</p>
          <div class="hero-acts">
            <button class="btn" onclick="App.go('today')">
              ${left ? `Keep going · ${left} left` : "Today's deck"}</button>
            <button class="btn ghost" onclick="App.go('trails')">Walk a trail</button>
          </div>
        </div>
      </div>

      <div class="rule">The ledger</div>
      <div class="ledger">
        <div><b>${met}</b><span>Species met</span></div>
        <div><b>${tried}</b><span>Things tried</span></div>
        <div><b>${Progress.p.whoa.length}</b><span>Saved</span></div>
        <div><b>${Progress.p.dayStreak || 0}</b><span>Day streak</span></div>
      </div>

      ${this.offlineAll()}
      ${FAMILIES.map(f => `
        <div class="family">
          <h2 class="rule">${f.name}</h2>
          <div class="kingdoms">
            ${f.cards.map(c => cardFor(c, f.tint)).join('')}
          </div>
        </div>`).join('')}

      <div class="card hub-trail" onclick="App.go('trails')" style="margin-top:16px">
        <div><h2>🧭 Expeditions</h2>
          <p class="dim small" style="margin-top:4px">Short trails that cross the
            whole lab — each one goes somewhere.</p></div>
        <span class="hub-arrow">→</span>
      </div>
      <div class="hub-panel">
        <div class="hub-main card">
          <h2>${left ? `${left} card${left === 1 ? '' : 's'} left today` : "Today's deck is done"}</h2>
          <p class="dim" style="margin-top:6px">
            ${left ? 'A fresh deck is dealt every morning.'
                   : 'Come back tomorrow for a new one — or browse anything above.'}</p>
          <button class="btn ${left ? '' : 'ghost'} wide" style="margin-top:14px"
            onclick="App.go('today')">${left ? 'Keep going →' : 'See the deck'}</button>
        </div>
        <div class="hub-side card">
          <h2>Where you are</h2>
          <div class="dim small" style="margin-top:10px">Species met</div>
          <div class="meter" style="margin-top:5px"><span style="width:${pct}%"></span></div>
          <div class="dim small" style="margin-top:4px">${met} of ${ANIMALS.length} animals · ${pct}%</div>
          <div class="hub-stats">
            <div><b>${totalFacts.toLocaleString()}</b><span class="dim small">facts in here</span></div>
            <div><b>${Progress.p.whoa.length}</b><span class="dim small">saved to Notes</span></div>
          </div>
        </div>
      </div>`);
  },

  // ── GUIDE ──
  guideFilter: { kind: 'group', key: null },

  guide() {
    const f = this.guideFilter;
    // Two scrolling rails rather than one wrapping block. Wrapped, the filters
    // ran eight rows deep on a phone and pushed every animal below the fold —
    // the child had to scroll past the controls to reach the thing itself.
    const rail = (kind, dict) => Object.entries(dict).map(([k, v]) =>
      `<button class="chip ${f.kind === kind && f.key === k ? 'accent' : ''}"
        onclick="App.setFilter('${kind}','${k}')">${v.glyph} ${v.name}</button>`).join('');

    const list = ANIMALS.filter(a =>
      !f.key || (f.kind === 'group' ? a.group === f.key : (a.homes || []).includes(f.key)));

    const c = Progress.counts();
    this.el(`
      ${this.bar('Field Guide', `<span class="chip accent">${c.known + c.mastered} known</span>`)}
      <div class="rail">
        <button class="chip ${!f.key ? 'accent' : ''}" onclick="App.setFilter('group',null)">All</button>
        ${rail('group', GROUPS)}
      </div>
      <div class="rail last">${rail('home', HABITATS)}</div>
      <div class="grid">
        ${list.map(a => {
          const st = Progress.state(a.id);
          return `<div class="thumb ${st}" onclick="App.species('${a.id}')">
            <img src="${this.pic(a)}" alt="${a.name}" loading="lazy"
                 onerror="this.style.opacity=.15">
            <div class="th-name">${a.name}
              ${st === 'mastered' ? '<span class="th-star">★</span>' : ''}</div>
          </div>`;
        }).join('')}
      </div>
      ${list.length ? '' : '<p class="dim">Nothing here yet.</p>'}`);
  },

  plantFilter: null,

  plants() {
    this.resetSay();
    if (typeof PLANTS === 'undefined' || !PLANTS.length) {
      return this.el(`${this.bar('Plants')}
        <div class="card"><p class="dim">The plant section is being written.</p>
        <button class="btn ghost wide" style="margin-top:12px" onclick="App.go('explore')">Back</button></div>`);
    }
    const f = this.plantFilter;
    const list = PLANTS.filter(p => !f || p.group === f);
    const c = Progress.counts();
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('explore')">←</button>
        <h1>Plants</h1><div class="grow"></div>
        <span class="chip accent">${PLANTS.length}</span></div>
      <div class="rail last">
        <button class="chip ${!f ? 'accent' : ''}" onclick="App.setPlantFilter(null)">All</button>
        ${Object.entries(PLANT_GROUPS).map(([k, v]) =>
          `<button class="chip ${f === k ? 'accent' : ''}"
            onclick="App.setPlantFilter('${k}')">${v.glyph} ${v.name}</button>`).join('')}
      </div>
      <div class="grid">
        ${list.map(p => {
          const st = Progress.state(p.id);
          return `<div class="thumb ${st}" onclick="App.species('${p.id}')">
            <img src="img/${p.id}.jpg" alt="${p.name}" loading="lazy"
                 onerror="this.style.opacity=.15">
            <div class="th-name">${p.name}
              ${st === 'mastered' ? '<span class="th-star">★</span>' : ''}</div>
          </div>`;
        }).join('')}
      </div>`);
  },

  setPlantFilter(k) {
    this.plantFilter = k;
    this.plants();
    const on = document.querySelector('.rail .chip.accent');
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  },

  setFilter(kind, key) {
    this.guideFilter = { kind, key };
    this.guide();
    // The chosen chip may sit well off the right edge of its rail — Dinosaurs
    // is the twelfth group. Without this the child taps a filter, the grid
    // changes, and no chip on screen looks selected.
    const on = document.querySelector('.rail .chip.accent');
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  },

  // ── species profile ──
  species(id) {
    this.resetSay();
    const a = this.find(id);
    if (!a) return this.guide();
    const isPlant = typeof PLANTS !== 'undefined' && PLANTS.some(p => p.id === id);
    Progress.markSeen(id);
    const st = Progress.state(id);
    const g = (isPlant ? PLANT_GROUPS : GROUPS)[a.group] || {};
    // Dinosaurs get two pictures where a good restoration exists: the painting
    // as the hero, the excavated skeleton kept below with the bones facts. A
    // child should be able to see which one is evidence and which one is
    // somebody's careful guess, rather than being handed a painting unlabelled.
    const art = a.art ? a.id + '-life.jpg' : null;
    const hero = art || (a.id + '.jpg');
    const stats = Object.entries(a.stats || {})
      .filter(([k]) => STAT_META[k])
      .map(([k, v]) => `<div style="flex:1;min-width:78px">
        <div class="dim small">${STAT_META[k].name}</div>
        <div style="font-size:1.16rem;font-weight:800">${v}<span class="dim small"> ${STAT_META[k].unit}</span></div>
      </div>`).join('');

    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('${isPlant ? 'plants' : 'guide'}')">←</button>
        <div class="grow"></div>
        <span class="chip">${g.glyph || ''} ${g.name || a.group}</span>
        ${st === 'mastered' ? '<span class="chip accent">★ Mastered</span>' : ''}</div>
      <div class="fact-card" style="margin-bottom:16px">
        <div class="fact-photo profile-photo"
             style="background-image:url('img/${hero}')">
          <img src="img/${hero}" alt="${a.name}" onerror="this.style.display='none'">
          ${art ? '<span class="art-tag">🎨 Artist\'s idea</span>' : ''}
          <div class="fact-name">${a.name}</div>
        </div>
        <div class="fact-body">
          <div style="font-size:1.04rem">${a.blurb}</div>
          <div class="dim" style="margin-top:8px">📏 ${a.size}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            ${(a.homes || []).map(h => HABITATS[h]
              ? `<span class="chip">${HABITATS[h].glyph} ${HABITATS[h].name}</span>` : '').join('')}
          </div>
          ${stats ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;
                        padding-top:14px;border-top:1px solid var(--line)">${stats}</div>
            ${a.group === 'dinosaurs' ? `<div class="dim small" style="margin-top:10px">
              🦴 Worked out from the bones — nobody ever put one on a scale.</div>` : ''}` : ''}
          <div class="card-actions">${this.listenBtn(a.name, a.blurb, a.size)}</div>
        </div>
      </div>
      ${a.wonder ? `<div class="wonder" style="margin-bottom:14px">${a.wonder}</div>` : ''}
      ${art ? `<div class="card tight" style="margin-bottom:14px">
        <div class="cat-label">🦴 What we actually dug up</div>
        <img src="img/${a.id}.jpg" alt="${a.name} skeleton" loading="lazy"
             style="width:100%;border-radius:12px;margin-top:8px;display:block">
        <div class="dim small" style="margin-top:8px">The picture above is an
          artist's reconstruction. This is the mounted skeleton — the part
          anybody can go and stand in front of.</div>
      </div>` : ''}
      ${a.facts.map((f, i) => {
        const cat = CATEGORIES[f.cat] || { name: f.cat, glyph: '✨' };
        return `<div class="card tight">
          <div class="cat-row"><span class="cat-label">${cat.glyph} ${cat.name}</span>
            ${this.kindTag(f, a.group === 'dinosaurs')}</div>
          <div style="margin-top:6px;font-size:1.02rem;line-height:1.5">${f.text}</div>
          ${f.more ? `<div class="fact-more" style="margin-top:10px;padding-top:10px">${f.more}</div>` : ''}
          <div class="card-actions">
            ${this.listenBtn(cat.name, f.text, f.more)}
            <button class="btn ghost" style="padding:7px 14px;font-size:.84rem"
              onclick="Progress.toggleWhoa('${a.id}',${i});App.species('${a.id}')">
              ${Progress.isWhoa(a.id, i) ? '★ Saved' : '☆ Whoa!'}</button>
          </div>
        </div>`;
      }).join('')}`);
  },

  // ── CLOUD ──
  // One account across every homeschool app. The sign-in is a name and four
  // pictures because the child using this cannot type a password, and the
  // derivation lives in HOMESCHOOL_AUTH so it cannot drift between apps.
  CLOUD_EMOJI: ['🦖', '🐙', '🦋', '🐝', '🦉', '🐢', '🦈', '🐸',
                '🌋', '⭐', '🌈', '🍄', '🔬', '🧪', '🦴', '🪐'],

  cloudCard() {
    const on = window.Sync && Sync.uid;
    return `<div class="card" style="margin-top:16px">
      <h2>${on ? '☁️ Backed up' : '☁️ Cloud Backpack'}</h2>
      <p class="dim small" style="margin-top:6px">
        ${on ? 'Your progress is saved to the cloud and follows you to any device.'
             : 'Sign in and your progress follows you to any device — and to the other homeschool apps.'}
      </p>
      <button class="btn ${on ? 'ghost' : ''}" style="margin-top:12px"
        onclick="App.cloud()">${on ? 'Manage' : 'Sign in'}</button>
    </div>`;
  },

  _pin: [],

  cloud() {
    this.resetSay();
    if (!window.Sync || !Sync.configured()) {
      return this.el(`${this.bar('Cloud Backpack')}
        <div class="card"><p class="dim">Cloud sync is not set up for this copy of
        the app. Everything is still saved on this device.</p>
        <button class="btn ghost wide" style="margin-top:12px" onclick="App.go('notes')">Back</button></div>`);
    }
    if (Sync.uid) {
      return this.el(`${this.bar('Cloud Backpack')}
        <div class="card" style="text-align:center;padding:30px 20px">
          <div style="font-size:3rem">☁️</div>
          <h2 style="margin-top:8px">Signed in</h2>
          <p class="dim" style="margin-top:8px">Progress for
            <b>${Progress.profile ? Progress.profile.name : 'you'}</b> is backed up,
            and the same name and pictures work in the other homeschool apps.</p>
          <button class="btn ghost wide" style="margin-top:16px" onclick="App.cloudOut()">Sign out</button>
          <button class="btn ghost wide" style="margin-top:10px" onclick="App.go('notes')">Back</button>
        </div>`);
    }
    this._pin = [];
    this.el(`${this.bar('Cloud Backpack')}
      <div class="card">
        <h2>What's your name?</h2>
        <input id="cn" maxlength="18" placeholder="Your name" value="${
          Progress.profile ? Progress.profile.name : ''}"
          style="width:100%;margin-top:12px;padding:14px;border-radius:12px;
                 background:var(--ink-3);border:1px solid var(--line);
                 color:var(--text);font:inherit;font-size:1.05rem">
        <h2 style="margin-top:20px">Tap four pictures</h2>
        <p class="dim small" style="margin-top:4px">The same four, in the same order, every time.</p>
        <div id="pin" class="pin-row"></div>
        <div class="emoji-grid" style="margin-top:12px">
          ${this.CLOUD_EMOJI.map(e => `<button class="emoji-btn"
            onclick="App.cloudTap('${e}')">${e}</button>`).join('')}
        </div>
        <div id="cloud-msg" class="dim small" style="margin-top:12px;min-height:1.2em"></div>
        <button class="btn wide big" style="margin-top:8px" onclick="App.cloudIn()">Sign in</button>
        <button class="btn ghost wide" style="margin-top:10px" onclick="App.go('notes')">Not now</button>
      </div>`);
    this.drawPin();
  },

  drawPin() {
    const el = document.getElementById('pin');
    if (!el) return;
    el.innerHTML = [0, 1, 2, 3].map(i =>
      `<span class="pin-slot ${this._pin[i] ? 'filled' : ''}">${this._pin[i] || ''}</span>`).join('');
  },

  cloudTap(e) {
    if (this._pin.length >= 4) this._pin = [];
    this._pin.push(e);
    this.drawPin();
  },

  async cloudIn() {
    const name = (document.getElementById('cn').value || '').trim();
    const msg = document.getElementById('cloud-msg');
    if (!name) { msg.textContent = 'Type your name first.'; return; }
    if (this._pin.length !== 4) { msg.textContent = 'Tap four pictures.'; return; }
    msg.textContent = 'Connecting…';
    try {
      await Sync.signIn(name, this._pin);
      const cloud = await Sync.pull();
      // Newer wins. A child who played on the tablet this morning should not
      // lose it by opening the laptop this afternoon.
      if (cloud && cloud.progress && Progress.profile) {
        const theirs = cloud.updatedAt && cloud.updatedAt.toMillis
          ? cloud.updatedAt.toMillis() : 0;
        if (theirs > (Progress.profile.updatedAt || 0)) {
          Progress.profile.p = cloud.progress;
        }
      }
      if (Progress.profile) { Progress.profile.name = name; Progress.commit(); }
      Sync.watch(d => {
        if (d.progress && Progress.profile) {
          Progress.profile.p = d.progress;
          Store.save(Progress.data);
          if (this.tab) this.go(this.tab);
        }
      });
      await Sync.push(Progress.profile);
      this.cloud();
    } catch (err) {
      msg.textContent = err.message || 'Could not sign in.';
    }
  },

  async cloudOut() {
    await Sync.signOut();
    this.go('notes');
  },

  // ── EXPEDITIONS ──
  // A trail with a beginning and an end, which is the thing the app did not
  // have. Progress is stored per expedition so a child can stop halfway and
  // come back to the right stop rather than starting again.
  expProgress(id) {
    const p = Progress.p;
    if (!p.exp) p.exp = {};
    if (!p.exp[id]) p.exp[id] = { at: 0, done: false };
    return p.exp[id];
  },

  expeditions() {
    this.resetSay();
    if (typeof EXPEDITIONS === 'undefined') return this.go('today');
    this.el(`
      ${this.bar('Expeditions', this.streakChip())}
      <p class="dim" style="margin:2px 0 14px">Short trails that cross the whole
        lab. Each one goes somewhere and ends somewhere.</p>
      <div class="exps">
        ${EXPEDITIONS.map(x => {
          const stops = expeditionStops(x);
          const pr = this.expProgress(x.id);
          const at = Math.min(pr.at, stops.length);
          return `<div class="exp" onclick="App.expedition('${x.id}')" style="--tint:${x.tint}">
            <span class="exp-glyph">${x.glyph}</span>
            <div class="exp-name">${x.name}${pr.done ? ' <span class="exp-stamp">✓</span>' : ''}</div>
            <div class="exp-sub">${pr.done ? 'Finished' : at ? `Stop ${at + 1} of ${stops.length}`
                                                             : `${stops.length} stops`}</div>
            <div class="meter exp-meter"><span style="width:${Math.round(at / stops.length * 100)}%"></span></div>
          </div>`;
        }).join('')}
      </div>`);
  },

  expedition(id, at) {
    this.resetSay();
    const x = EXPEDITIONS.find(e => e.id === id);
    if (!x) return this.expeditions();
    const stops = expeditionStops(x);
    const pr = this.expProgress(id);
    if (at == null) at = pr.done ? 0 : Math.min(pr.at, stops.length - 1);
    at = Math.max(0, Math.min(at, stops.length));
    this._exp = { id, at };

    // past the last stop: the closing card
    if (at >= stops.length) {
      pr.done = true; pr.at = stops.length; Progress.commit();
      return this.el(`
        <div class="bar"><button class="btn ghost" onclick="App.expeditions()">←</button>
          <div class="grow"></div><h2>${x.glyph} ${x.name}</h2></div>
        <div class="card" style="text-align:center;padding:32px 20px">
          <div style="font-size:3rem">${x.glyph}</div>
          <h2 style="margin-top:8px">Trail complete</h2>
          <p style="margin-top:12px;line-height:1.6">${x.outro}</p>
          <div class="card-actions" style="justify-content:center">
            ${this.listenBtn(x.outro)}
            <button class="btn" onclick="App.expedition('${id}', 0)">Walk it again</button>
          </div>
        </div>
        <button class="btn ghost wide" style="margin-top:12px"
          onclick="App.expeditions()">Back to expeditions</button>`);
    }

    if (at > pr.at) { pr.at = at; Progress.commit(); }
    const st = stops[at];
    const body = this.stopCard(st);
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.expeditions()">←</button>
        <div class="grow"></div><h2>${x.glyph} ${x.name}</h2></div>
      <div class="exp-track">${stops.map((_, i) =>
        `<span class="pip ${i < at ? 'past' : i === at ? 'now' : ''}"></span>`).join('')}</div>
      ${at === 0 ? `<div class="card" style="margin-bottom:12px">
        <p style="line-height:1.6">${x.intro}</p></div>` : ''}
      ${st.note ? `<div class="exp-note">${st.note}</div>` : ''}
      ${body}
      <div class="exp-nav">
        ${at > 0 ? `<button class="btn ghost" onclick="App.expedition('${id}',${at - 1})">← Back</button>`
                 : '<span></span>'}
        <button class="btn" onclick="App.expedition('${id}',${at + 1})">
          ${at === stops.length - 1 ? 'Finish →' : 'Next stop →'}</button>
      </div>`);
  },

  // One stop rendered inline. A species stop shows its photo and blurb rather
  // than jumping to the profile — leaving the trail to read a full page and
  // then finding your way back is how a journey stops feeling like one.
  stopCard(st) {
    if (st.s) {
      const a = this.find(st.s);
      if (!a) return '';
      Progress.markSeen(a.id);
      return `<div class="fact-card">
        <div class="fact-photo profile-photo" style="background-image:url('${this.pic(a)}')">
          <img src="${this.pic(a)}" alt="${a.name}" onerror="this.style.display='none'">
          <div class="fact-name">${a.name}</div>
        </div>
        <div class="fact-body">
          <div style="font-size:1.04rem">${a.blurb}</div>
          <div class="dim" style="margin-top:8px">📏 ${a.size}</div>
          <div class="card-actions">
            ${this.listenBtn(a.name, a.blurb, a.size)}
            <button class="btn ghost" onclick="App.species('${a.id}')">Full profile</button>
          </div>
        </div>
      </div>`;
    }
    const f = st.e ? EARTH.find(e => e.id === st.e)
            : st.b ? BODY.find(b => b.id === st.b)
            : st.a ? ASTRO.find(a => a.id === st.a) : null;
    if (!f) return '';
    const cat = CATEGORIES[f.cat] || { name: f.cat, glyph: '✨' };
    return `<div class="card">
      <div class="cat-row"><span class="cat-label">${cat.glyph} ${cat.name}</span>
        ${this.kindTag(f)}</div>
      <div style="margin-top:6px;font-size:1.05rem;line-height:1.5">${f.text}</div>
      ${f.more ? `<div class="fact-more">${f.more}</div>` : ''}
      ${f.tryit ? `<div class="wonder" style="border-left-color:var(--lime);
         background:rgba(158,232,95,.08);color:#d8f5be">
         <b>Try it now:</b> ${f.tryit}</div>` : ''}
      <div class="card-actions">
        ${this.listenBtn(cat.name, f.text, f.more, f.tryit ? 'Try it now' : '', f.tryit)}
      </div>
    </div>`;
  },

  // ── ZOOM IN ──
  // The photo starts far too close to read and pulls back over six seconds.
  // Answering early is worth more, which is the whole game: commit on a
  // texture or a color before the shape gives it away.
  _zoom: null,

  zoomGame() {
    this.resetSay();
    const pool = this.pool();
    const a = pool[Math.floor(Math.random() * pool.length)];
    this._zoom = { a, opts: this.options(a, 4), t0: Date.now(), done: false };
    const st = this.gameStats('zoom');
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('play')">←</button>
        <div class="grow"></div><h2>🔎 Zoom In</h2>
        <span class="chip accent">${st.streak} in a row</span></div>
      <div class="zoom-stage">
        <img class="zbg" src="${this.pic(a)}" alt="" aria-hidden="true">
        <img id="zi" class="zfg" src="${this.pic(a)}" alt="">
      </div>
      <div class="opt-head">
        ${this.listenLabel('Hear the choices', ...this._zoom.opts.map(o => o.name))}
      </div>
      <div id="zopts" class="opt-grid">
        ${this._zoom.opts.map((o, i) =>
          `<button class="btn ghost opt" onclick="App.zoomAnswer(${i})">${o.name}</button>`).join('')}
      </div>
      <div id="zmsg"></div>`);
    // Force a reflow, then flip the class. requestAnimationFrame looks like
    // the right tool and is not: browsers throttle it in a backgrounded or
    // unfocused tab, so the callback never runs and the photo just sits at 7x
    // forever. Reading offsetWidth commits the starting style synchronously,
    // which is all the transition actually needs.
    const el = document.getElementById('zi');
    if (el) { void el.offsetWidth; el.classList.add('out'); }
  },

  zoomAnswer(i) {
    const z = this._zoom;
    if (!z || z.done) return;
    z.done = true;
    const pick = z.opts[i];
    const right = pick.id === z.a.id;
    const secs = (Date.now() - z.t0) / 1000;
    const st = this.gameStats('zoom');
    st.played++;
    st.streak = right ? st.streak + 1 : 0;
    if (st.streak > st.best) st.best = st.streak;
    Progress.markSeen(z.a.id);
    Progress.commit();

    const img = document.getElementById('zi');
    if (img) { img.classList.remove('out'); img.classList.add('done'); }
    document.querySelectorAll('#zopts .opt').forEach((b, n) => {
      b.disabled = true;
      if (z.opts[n].id === z.a.id) b.classList.add('right');
      else if (n === i) b.classList.add('wrong');
    });
    document.getElementById('zmsg').innerHTML = `
      <div class="card" style="margin-top:14px">
        <h2>${right ? (secs < 2 ? 'Got it, fast' : 'Got it') : z.a.name}</h2>
        <p class="dim" style="margin-top:6px">${z.a.blurb}</p>
        <div class="card-actions">
          ${this.listenBtn(z.a.name, z.a.blurb)}
          <button class="btn" onclick="App.zoomGame()">Next →</button>
          <button class="btn ghost" onclick="App.species('${z.a.id}')">Full profile</button>
        </div>
      </div>`;
  },

  // ── BIGGER OR SMALLER ──
  _hl: null,

  higherGame() {
    this.resetSay();
    // Questions come from GAME_PHRASES in schema.js so gen_audio can render a
    // clip for each. Typed inline here they would have no recording.
    const STATS = [
      { k: 'weight', q: GAME_PHRASES.heavier, unit: 'lb' },
      { k: 'length', q: GAME_PHRASES.longer, unit: 'ft' },
      { k: 'height', q: GAME_PHRASES.taller, unit: 'ft' },
      { k: 'life', q: GAME_PHRASES.lives, unit: 'yrs' },
    ];
    // Only stats with enough species to make a varied game.
    const usable = STATS.map(s => ({ ...s,
      pool: this.pool().filter(a => a.stats && typeof a.stats[s.k] === 'number') }))
      .filter(s => s.pool.length >= 12);
    const s = usable[Math.floor(Math.random() * usable.length)];
    let a, b, guard = 0;
    do {
      a = s.pool[Math.floor(Math.random() * s.pool.length)];
      b = s.pool[Math.floor(Math.random() * s.pool.length)];
      guard++;
      // Reject near-ties: a coin flip the child cannot reason about is not a
      // question, it is a punishment.
    } while (guard < 40 && (a.id === b.id ||
             Math.min(a.stats[s.k], b.stats[s.k]) /
             Math.max(a.stats[s.k], b.stats[s.k]) > 0.8));
    this._hl = { a, b, s, done: false };
    const st = this.gameStats('higher');
    const card = (x, side) => `
      <button class="hl-card" onclick="App.higherAnswer('${side}')">
        <img src="${this.pic(x)}" alt="" onerror="this.style.opacity=.15">
        <div class="hl-name">${x.name}</div>
        <div class="hl-val" data-side="${side}"></div>
      </button>`;
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('play')">←</button>
        <div class="grow"></div><h2>⚖️ Bigger or Smaller</h2>
        <span class="chip accent">${st.streak} in a row</span></div>
      <p class="hl-q">${s.q}</p>
      <div class="opt-head" style="margin-top:0;margin-bottom:12px">
        ${this.listenLabel('Hear the question', s.q, a.name, b.name)}
      </div>
      <div class="hl-pair">${card(a, 'a')}${card(b, 'b')}</div>
      <div id="hmsg"></div>`);
  },

  higherAnswer(side) {
    const h = this._hl;
    if (!h || h.done) return;
    h.done = true;
    const { a, b, s } = h;
    const winner = a.stats[s.k] >= b.stats[s.k] ? 'a' : 'b';
    const right = side === winner;
    const st = this.gameStats('higher');
    st.played++;
    st.streak = right ? st.streak + 1 : 0;
    if (st.streak > st.best) st.best = st.streak;
    Progress.markSeen(a.id); Progress.markSeen(b.id);
    Progress.commit();

    document.querySelectorAll('.hl-val').forEach(el => {
      const x = el.dataset.side === 'a' ? a : b;
      el.textContent = x.stats[s.k].toLocaleString() + ' ' + s.unit;
    });
    document.querySelectorAll('.hl-card').forEach((c, i) => {
      c.disabled = true;
      c.classList.add((i === 0 ? 'a' : 'b') === winner ? 'right' : 'wrong');
    });
    document.getElementById('hmsg').innerHTML = `
      <div class="card" style="margin-top:14px">
        <h2>${right ? 'Correct' : 'Not that one'}</h2>
        <p class="dim" style="margin-top:6px">
          ${(a.stats[s.k] >= b.stats[s.k] ? a : b).name} wins this one.
          ${right ? `That is ${st.streak} in a row.` : `Best streak so far: ${st.best}.`}</p>
        <button class="btn wide" style="margin-top:12px" onclick="App.higherGame()">Next →</button>
      </div>`;
  },

  // ── LISTEN UP ──
  // A recording cannot be bleeped, so the clue has to be a fact that never
  // says the animal's name in the first place. 1,549 of them qualify.
  _lis: null,

  namelessFacts(a) {
    const n = this.nameForms(a);
    return a.facts.filter(f => !n.some(rx => rx.test(f.text)) && AudioLib.has(f.text));
  },

  listenGame() {
    this.resetSay();
    const pool = this.pool();
    let a, clues = [], guard = 0;
    do {
      a = pool[Math.floor(Math.random() * pool.length)];
      clues = this.namelessFacts(a);
      guard++;
    } while (guard < 60 && !clues.length);
    if (!clues.length) return this.go('play');
    const clue = clues[Math.floor(Math.random() * clues.length)];
    this._lis = { a, clue, opts: this.options(a, 4), done: false };
    const st = this.gameStats('listen');
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('play')">←</button>
        <div class="grow"></div><h2>🎧 Listen Up</h2>
        <span class="chip accent">${st.streak} in a row</span></div>
      <div class="card" style="text-align:center;padding:26px 18px">
        <div style="font-size:2.6rem">🎧</div>
        <p class="dim" style="margin-top:8px">One clue. No names in it.</p>
        <button class="btn wide big" style="margin-top:14px" onclick="App.listenPlay()">▶ Play the clue</button>
        <button class="btn ghost wide" style="margin-top:10px" onclick="App.listenShow()">Show it in words</button>
        <div id="lclue" class="dim" style="margin-top:12px;display:none;line-height:1.5"></div>
      </div>
      <div class="opt-head">
        ${this.listenLabel('Hear the choices', ...this._lis.opts.map(o => o.name))}
      </div>
      <div id="lopts" class="opt-grid">
        ${this._lis.opts.map((o, i) =>
          `<button class="btn ghost opt" onclick="App.listenAnswer(${i})">${o.name}</button>`).join('')}
      </div>
      <div id="lmsg"></div>`);
    setTimeout(() => this.listenPlay(), 350);
  },

  listenPlay() { if (this._lis) AudioLib.speak(this._lis.clue.text); },

  // Reading it is a fair fallback: a deaf child, a quiet room, a broken
  // speaker. The clue names nothing either way.
  listenShow() {
    const el = document.getElementById('lclue');
    if (el && this._lis) { el.textContent = this._lis.clue.text; el.style.display = 'block'; }
  },

  listenAnswer(i) {
    const l = this._lis;
    if (!l || l.done) return;
    l.done = true;
    AudioLib.stop();
    const right = l.opts[i].id === l.a.id;
    const st = this.gameStats('listen');
    st.played++;
    st.streak = right ? st.streak + 1 : 0;
    if (st.streak > st.best) st.best = st.streak;
    Progress.markSeen(l.a.id);
    Progress.commit();
    document.querySelectorAll('#lopts .opt').forEach((b, n) => {
      b.disabled = true;
      if (l.opts[n].id === l.a.id) b.classList.add('right');
      else if (n === i) b.classList.add('wrong');
    });
    document.getElementById('lmsg').innerHTML = `
      <div class="card" style="margin-top:14px">
        <div style="display:flex;gap:12px">
          <img src="${this.pic(l.a)}" alt="" style="width:72px;height:72px;object-fit:cover;
               border-radius:12px;flex:0 0 72px" onerror="this.style.opacity=.15">
          <div><b>${l.a.name}</b>
            <div class="dim" style="margin-top:4px;line-height:1.45">${l.clue.text}</div></div>
        </div>
        <div class="card-actions">
          ${this.listenBtn(l.a.name, l.clue.text)}
          <button class="btn" onclick="App.listenGame()">Next →</button>
          <button class="btn ghost" onclick="App.species('${l.a.id}')">Full profile</button>
        </div>
      </div>`;
  },

  // ── TRY IT NOW ──
  // 18 experiments were sitting in the app with nothing recording whether she
  // had ever done one. Getting a child off the screen and into the actual
  // world is the best thing this app can do, so it is worth tracking.
  allTryits() {
    const out = [];
    if (typeof BODY !== 'undefined') {
      BODY.forEach((b, i) => {
        // b.id, not the index. Keying on position meant that adding a single
        // body fact renumbered every experiment after it and silently wiped
        // the child's record of what she had actually done.
        if (b.tryit) out.push({ key: b.id || ('b' + i), where: 'Your Body',
          section: (BODY_SECTIONS[b.section] || {}).name || b.section,
          text: b.tryit, go: `App.body('${b.section}')` });
      });
    }
    // Every topic set, not a hand-written list. Earth and Body were the only
    // two collected here, so astronomy's experiments — "find the moon in
    // daylight", "spot Jupiter's moons with binoculars" — existed in the data
    // and appeared nowhere in the tracker. A list of sources that has to be
    // extended by hand is a list that will be short again next month.
    Object.keys(TOPIC_SETS).forEach((key) => {
      const cfg = this.topicCfg(key);
      cfg.rows.forEach((e) => {
        if (!e.tryit) return;
        out.push({ key: e.id, where: cfg.title,
          section: (cfg.secs[e.section] || {}).name || e.section,
          text: e.tryit, go: `App.topics('${key}','${e.section}')` });
      });
    });
    return out;
  },

  toggleTried(key) {
    const t = Progress.p.tried || (Progress.p.tried = {});
    if (t[key]) delete t[key]; else t[key] = Store.dayKey();
    Progress.commit();
    this.tried();
  },

  tried() {
    this.resetSay();
    const list = this.allTryits();
    const done = Progress.p.tried || {};
    const n = list.filter(x => done[x.key]).length;
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('play')">←</button>
        <h1>Try It Now</h1><div class="grow"></div>
        <span class="chip accent">${n} / ${list.length}</span></div>
      <div class="card">
        <p class="dim">Things to actually go and do, away from the screen.
          Tick one off when you have really done it.</p>
        <div class="meter" style="margin-top:12px">
          <span style="width:${Math.round(n / Math.max(1, list.length) * 100)}%"></span></div>
      </div>
      ${list.map(x => `
        <div class="card tight tryit-row ${done[x.key] ? 'done' : ''}">
          <button class="tick" onclick="App.toggleTried('${x.key}')"
            aria-label="Mark done">${done[x.key] ? '✓' : ''}</button>
          <div style="flex:1">
            <div class="cat-label">${x.where} · ${x.section}</div>
            <div style="margin-top:5px;line-height:1.5">${x.text}</div>
            ${done[x.key] ? `<div class="dim small" style="margin-top:6px">Done ${done[x.key]}</div>` : ''}
          </div>
        </div>`).join('')}`);
  },

  // ── GAME PLUMBING ──
  // Per-game records live under p.games. Profiles created before these games
  // existed have no such key, so every read goes through here.
  gameStats(key) {
    const p = Progress.p;
    if (!p.games) p.games = {};
    if (!p.games[key]) p.games[key] = { played: 0, best: 0, streak: 0 };
    return p.games[key];
  },

  // Every species the games can draw on: needs a photo, and for the stat games
  // a value to compare. Plants and animals both qualify.
  pool() { return this.all().filter(a => a.name && a.id); },

  // Wrong answers come from the same group where possible. Four random species
  // from across the whole app would make most rounds trivially easy — a
  // rainforest frog next to a sequoia is not a question.
  options(correct, n) {
    const same = this.pool().filter(x => x.id !== correct.id && x.group === correct.group);
    const rest = this.pool().filter(x => x.id !== correct.id && x.group !== correct.group);
    const picked = [];
    const take = (arr) => {
      const a = arr.slice();
      while (picked.length < n - 1 && a.length) {
        picked.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
      }
    };
    take(same); take(rest);
    return [correct, ...picked].sort(() => Math.random() - 0.5);
  },

  // ── PLAY ──
  play() {
    const q = Progress.p.quiz;
    this.el(`
      ${this.bar('Play', this.streakChip())}
      <div class="tiles">
        <div class="tile" onclick="App.quiz()">
          <span class="t-glyph">🎯</span>
          <div class="t-name">Spot Check</div>
          <div class="t-sub">Quiz yourself</div></div>
        <div class="tile" onclick="App.faceoffPick()">
          <span class="t-glyph">⚔️</span>
          <div class="t-name">Face-Off</div>
          <div class="t-sub">Compare two animals</div></div>
        <div class="tile" onclick="App.zoomGame()">
          <span class="t-glyph">🔎</span>
          <div class="t-name">Zoom In</div>
          <div class="t-sub">Name it before it clears</div></div>
        <div class="tile" onclick="App.higherGame()">
          <span class="t-glyph">⚖️</span>
          <div class="t-name">Bigger or Smaller</div>
          <div class="t-sub">Keep the streak alive</div></div>
        <div class="tile" onclick="App.listenGame()">
          <span class="t-glyph">🎧</span>
          <div class="t-name">Listen Up</div>
          <div class="t-sub">Guess it from a clue</div></div>
        <div class="tile" onclick="App.tried()">
          <span class="t-glyph">🧪</span>
          <div class="t-name">Try It Now</div>
          <div class="t-sub">${Object.keys(Progress.p.tried || {}).length} of ${this.allTryits().length} done</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2>Your record</h2>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap">
          <div><div class="dim small">Answered</div><div style="font-size:1.4rem;font-weight:800">${q.asked}</div></div>
          <div><div class="dim small">Correct</div><div style="font-size:1.4rem;font-weight:800">${q.right}</div></div>
          <div><div class="dim small">Best streak</div><div style="font-size:1.4rem;font-weight:800">${q.best}</div></div>
        </div>
      </div>`);
  },

  // Questions are generated from the data, so the quiz grows automatically as
  // content is added — no bespoke question authoring anywhere.
  makeQuestion() {
    const withStats = ANIMALS.filter(a => a.stats && typeof a.stats.speed === 'number');
    const kind = Math.random() < 0.45 && withStats.length > 4 ? 'stat' : 'fact';

    if (kind === 'stat') {
      const pick = () => withStats[Math.floor(Math.random() * withStats.length)];
      let a = pick(), b = pick(), guard = 0;
      while ((b.id === a.id || b.stats.speed === a.stats.speed) && guard++ < 40) b = pick();
      const faster = a.stats.speed > b.stats.speed ? a : b;
      return {
        q: 'Which one is faster?',
        options: [a, b].sort(() => Math.random() - 0.5)
          .map(x => ({ label: x.name, right: x.id === faster.id, id: x.id })),
        after: `${faster.name} — about ${faster.stats.speed} mph.`,
        subject: faster.id,
      };
    }

    const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    // Most facts name their own animal, which hands the answer over. Prefer one
    // that doesn't; if every fact names it, blank the name out instead.
    const names = this.nameForms(a);
    const clean = a.facts.filter(f => !names.some(n => n.test(f.text)));
    const usable = clean.length ? clean : a.facts;
    const f = usable[Math.floor(Math.random() * usable.length)];
    const prompt = clean.length ? f.text : this.redact(f.text, names);

    const others = ANIMALS.filter(x => x.id !== a.id && x.group === a.group);
    const pool = (others.length >= 3 ? others : ANIMALS.filter(x => x.id !== a.id))
      .sort(() => Math.random() - 0.5).slice(0, 3);
    return {
      q: 'Which animal is this about?',
      prompt,
      options: [a, ...pool].sort(() => Math.random() - 0.5)
        .map(x => ({ label: x.name, right: x.id === a.id, id: x.id })),
      after: (clean.length ? '' : `The fact is about the ${a.name.toLowerCase()}. `) + (f.more || ''),
      subject: a.id,
    };
  },

  // Every way this animal's name might appear: the full name, the head noun
  // ("Snow leopard" -> "leopard"), and the id's words. Plurals included.
  nameForms(a) {
    const words = a.name.toLowerCase().split(/[\s-]+/);
    const bits = new Set([a.name.toLowerCase(), words[words.length - 1]]);
    a.id.split('-').forEach(w => { if (w.length > 3) bits.add(w); });
    // Short forms the prose actually uses. "Tyrannosaurus rex" never appears
    // in a fact written for a child — "T. rex" does, and without this the quiz
    // hands over the answer inside the question.
    (a.alias || []).forEach(x => bits.add(x.toLowerCase()));
    return [...bits]
      .filter(b => b.length > 2)
      .map(b => new RegExp('\\b' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'i'));
  },

  redact(text, names) {
    let out = text;
    names.forEach(rx => {
      out = out.replace(new RegExp(rx.source, 'gi'), '▬▬▬▬');
    });
    return out;
  },

  quiz(state) {
    const s = state || { n: 0, right: 0 };
    if (s.n >= 8) {
      return this.el(`
        ${this.bar('Spot Check')}
        <div class="card" style="text-align:center;padding:32px 20px">
          <div style="font-size:3rem">${s.right >= 7 ? '🏆' : s.right >= 5 ? '👏' : '💪'}</div>
          <h2 style="margin-top:8px">${s.right} out of 8</h2>
          <p class="dim" style="margin-top:6px">${
            s.right >= 7 ? 'Outstanding.' : s.right >= 5 ? 'Solid work.' : 'Worth another run.'}</p>
          <button class="btn wide big" style="margin-top:16px" onclick="App.quiz()">Again</button>
          <button class="btn ghost wide" style="margin-top:10px" onclick="App.go('play')">Back</button>
        </div>`);
    }
    const question = this.makeQuestion();
    this._q = { ...s, question };
    this.el(`
      ${this.bar('Spot Check', `<span class="chip">${s.n + 1} / 8</span>`)}
      <div class="card">
        <h2>${question.q}</h2>
        ${question.prompt ? `<p style="margin-top:10px;font-size:1.06rem;line-height:1.5">
          “${question.prompt}”</p>` : ''}
      </div>
      <div id="opts">
        ${question.options.map((o, i) =>
          `<button class="q-option" onclick="App.answer(${i})">${o.label}</button>`).join('')}
      </div>
      <div id="after"></div>`);
  },

  answer(i) {
    const { question } = this._q;
    const chosen = question.options[i];
    document.querySelectorAll('.q-option').forEach((btn, j) => {
      btn.disabled = true;
      if (question.options[j].right) btn.classList.add('right');
      else if (j === i) btn.classList.add('wrong');
    });
    Progress.recordQuiz(chosen.right);
    if (chosen.right) Progress.markRight(question.subject);
    document.getElementById('after').innerHTML = `
      <div class="card" style="margin-top:12px">
        <b style="color:${chosen.right ? 'var(--lime)' : 'var(--coral)'}">
          ${chosen.right ? 'Correct' : 'Not quite'}</b>
        ${question.after ? `<div class="dim" style="margin-top:8px;line-height:1.55">${question.after}</div>` : ''}
        <button class="btn wide" style="margin-top:12px"
          onclick="App.quiz({n:${this._q.n + 1},right:${this._q.right + (chosen.right ? 1 : 0)}})">
          Next →</button>
      </div>`;
    document.getElementById('after').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  // ── Face-Off ──
  faceoffPick(aId) {
    const list = ANIMALS.filter(a => a.stats && Object.keys(a.stats).length);
    this.el(`
      ${this.bar('Face-Off')}
      <div class="card tight"><b>${aId ? 'Now pick a challenger' : 'Pick your first animal'}</b></div>
      <div class="grid">
        ${list.map(a => `<div class="thumb" onclick="${aId
          ? `App.faceoff('${aId}','${a.id}')` : `App.faceoffPick('${a.id}')`}">
          <img src="${this.pic(a)}" alt="" loading="lazy" onerror="this.style.opacity=.15">
          <div class="th-name">${a.name}</div></div>`).join('')}
      </div>`);
  },

  faceoff(x, y) {
    const A = ANIMALS.find(a => a.id === x), B = ANIMALS.find(a => a.id === y);
    const keys = Object.keys(STAT_META).filter(k =>
      typeof (A.stats || {})[k] === 'number' && typeof (B.stats || {})[k] === 'number');
    const rows = keys.map(k => {
      const av = A.stats[k], bv = B.stats[k], max = Math.max(av, bv);
      const bar = (v, win) => `<div class="meter" style="margin-top:4px">
        <span style="width:${Math.round(v / max * 100)}%;${win ? '' : 'background:var(--line)'}"></span></div>`;
      return `<div style="margin-bottom:14px">
        <div class="dim small">${STAT_META[k].name}</div>
        <div style="display:flex;gap:12px;margin-top:4px">
          <div style="flex:1"><b>${av}</b> <span class="dim small">${STAT_META[k].unit}</span>${bar(av, av >= bv)}</div>
          <div style="flex:1"><b>${bv}</b> <span class="dim small">${STAT_META[k].unit}</span>${bar(bv, bv >= av)}</div>
        </div></div>`;
    }).join('') || `<p class="dim">These two have no measurement in common —
        pick a different pair to compare.</p>`;

    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.faceoffPick()">←</button>
        <div class="grow"></div><h2>Face-Off</h2></div>
      <div style="display:flex;gap:12px;margin-bottom:14px">
        ${[A, B].map(a => `<div style="flex:1;text-align:center">
          <img src="${this.pic(a)}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;
               border-radius:14px;border:1px solid var(--line)" onerror="this.style.opacity=.15">
          <div style="font-weight:800;margin-top:6px">${a.name}</div></div>`).join('')}
      </div>
      <div class="card">${rows || '<p class="dim">These two have no stats in common yet.</p>'}</div>
      <button class="btn ghost wide" onclick="App.faceoffPick()">Pick two more</button>`);
  },

  // ── ASTRONOMY ──
  // Same shape as Earth — topic sections of standalone facts — so it runs
  // through the same renderer rather than a near-identical copy.

  // ── EARTH ──

  // Driven by TOPIC_SETS, not by a branch per subject. Seven subjects share
  // this renderer; adding an eighth is a line in schema.js.
  topicCfg(which) {
    const t = TOPIC_SETS[which] || TOPIC_SETS.earth;
    const g = (n) => globalThis[n] || null;
    return { rows: g(t.data) || [], secs: g(t.secs) || {},
             title: t.name, glyph: t.glyph, fn: which };
  },

  // The default offer is the whole app in one go — that is what a tablet
  // going in a car actually needs. Per-subject packs stay, for a smaller
  // download or a slow connection.
  offlineAll() {
    if (Offline.has('all')) {
      return `<div class="offline done"><span>✓</span>
        <div><b>Everything downloaded</b>
        <div class="dim small">The whole app works with no wifi</div></div></div>`;
    }
    const texts = Offline.allTexts();
    const mb = Math.round(Offline.estimate(texts) / 1048576);
    return `<div class="offline" id="off-all">
      <span>⬇</span>
      <div class="grow"><b>Download the whole app</b>
        <div class="dim small" id="off-msg">Every subject · about ${mb} MB ·
          then it works with no wifi</div></div>
      <button class="btn" onclick="App.downloadAll()">Get it</button>
    </div>`;
  },

  async downloadAll() {
    const row = document.getElementById('off-all');
    const msg = document.getElementById('off-msg');
    if (row) row.classList.add('busy');
    const r = await Offline.download('all', Offline.allTexts(), (n, total) => {
      if (msg) msg.textContent = `${n} of ${total} clips… you can keep using the app`;
    });
    // A whole-app download covers every subject, so mark them all done rather
    // than leaving each subject page still offering its own copy.
    Object.keys(TOPIC_SETS).forEach(k => Offline.mark(k, 0));
    if (row) {
      row.className = 'offline done';
      row.innerHTML = `<span>✓</span><div><b>Everything downloaded</b>
        <div class="dim small">${r.files} clips · ${Math.round(r.bytes / 1048576)} MB ·
        works with no wifi</div></div>`;
    }
  },

  // Clips are only cached once they have been heard, so a tablet taken out of
  // wifi is silent for anything new. This downloads a whole subject's narration
  // up front.
  offlineRow(which, cfg) {
    if (!cfg.rows.length) return '';
    const texts = this.offlineTexts(which, cfg);
    const mb = Math.round(Offline.estimate(texts) / 1048576);
    if (Offline.has(which) || Offline.has('all')) {
      return `<div class="offline done"><span>✓</span>
        <div><b>Downloaded</b><div class="dim small">Works with no wifi</div></div></div>`;
    }
    return `<div class="offline" id="off-${which}">
      <span>⬇</span>
      <div class="grow"><b>Download for offline</b>
        <div class="dim small" id="off-msg">${texts.length} clips · about ${mb} MB</div></div>
      <button class="btn" onclick="App.downloadPack('${which}')">Get it</button>
    </div>`;
  },

  // Everything the subject can speak: each card's three fields, plus the
  // section names and the shared "Try it now" the Listen button reads first.
  offlineTexts(which, cfg) {
    const t = ['Try it now'];
    Object.values(cfg.secs).forEach(s => t.push(s.name));
    Object.values(CATEGORIES).forEach(c => t.push(c.name));
    Object.values(KINDS).forEach(k => t.push(k.name));
    cfg.rows.forEach(e => { t.push(e.text); if (e.more) t.push(e.more);
                            if (e.tryit) t.push(e.tryit); });
    return t;
  },

  async downloadPack(which) {
    const cfg = this.topicCfg(which);
    const row = document.getElementById('off-' + which);
    const msg = document.getElementById('off-msg');
    if (row) row.classList.add('busy');
    const r = await Offline.download(which, this.offlineTexts(which, cfg),
      (n, total) => { if (msg) msg.textContent = `${n} of ${total} clips…`; });
    if (row) {
      row.className = 'offline done';
      row.innerHTML = `<span>✓</span><div><b>Downloaded</b>
        <div class="dim small">${r.files} clips · ${Math.round(r.bytes / 1048576)} MB ·
        works with no wifi</div></div>`;
    }
  },

  topics(which, sec) {
    const cfg = this.topicCfg(which);
    this.resetSay();
    if (!cfg.rows.length) {
      return this.el(`${this.bar(cfg.title)}
        <div class="card"><p class="dim">This section is being written.</p>
        <button class="btn ghost wide" style="margin-top:12px" onclick="App.go('explore')">Back</button></div>`);
    }
    if (sec) {
      const items = cfg.rows.filter(e => e.section === sec);
      const meta = cfg.secs[sec] || { name: sec, glyph: cfg.glyph };
      return this.el(`
        <div class="bar"><button class="btn ghost" onclick="App.topics('${which}')">←</button>
          <div class="grow"></div><h2>${meta.glyph} ${meta.name}</h2></div>
        ${items.map(e => {
          const cat = CATEGORIES[e.cat] || { name: e.cat, glyph: '✨' };
          return `<div class="card">
            <div class="cat-row"><span class="cat-label">${cat.glyph} ${cat.name}</span>
              ${this.kindTag(e)}</div>
            <div style="margin-top:6px;font-size:1.05rem;line-height:1.5">${e.text}</div>
            ${e.more ? `<div class="fact-more">${e.more}</div>` : ''}
            ${e.tryit ? `<div class="wonder" style="border-left-color:var(--lime);
               background:rgba(158,232,95,.08);color:#d8f5be">
               <b>Try it now:</b> ${e.tryit}</div>` : ''}
            <div class="card-actions">
              ${this.listenBtn(cat.name, e.text, e.more, e.tryit ? 'Try it now' : '', e.tryit)}
            </div>
          </div>`;
        }).join('')}`);
    }
    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('explore')">←</button>
        <h1>${cfg.title}</h1><div class="grow"></div>
        <span class="chip accent">${cfg.rows.length}</span></div>
      ${this.offlineRow(which, cfg)}
      <div class="tiles">
        ${Object.entries(cfg.secs).map(([k, v]) => {
          const n = cfg.rows.filter(e => e.section === k).length;
          if (!n) return '';
          return `<div class="tile" onclick="App.topics('${which}','${k}')">
            <span class="t-glyph">${v.glyph}</span>
            <div class="t-name">${v.name}</div>
            <div class="t-sub">${n} facts</div>
          </div>`;
        }).join('')}
      </div>`);
  },

  // ── BODY ──
  body(sec) {
    this.resetSay();
    if (typeof BODY === 'undefined' || !BODY.length) {
      return this.el(`${this.bar('Your Body')}
        <div class="card"><p class="dim">The body section is being written.</p></div>`);
    }
    if (sec) {
      const items = BODY.filter(b => b.section === sec);
      const meta = BODY_SECTIONS[sec] || { name: sec, glyph: '🫀' };
      return this.el(`
        <div class="bar"><button class="btn ghost" onclick="App.body()">←</button>
          <div class="grow"></div><h2>${meta.glyph} ${meta.name}</h2></div>
        ${items.map(b => `<div class="card">
          <div class="cat-label">${(CATEGORIES[b.cat] || {}).glyph || '✨'} ${(CATEGORIES[b.cat] || {}).name || b.cat}</div>
          <div style="margin-top:6px;font-size:1.05rem;line-height:1.5">${b.text}</div>
          ${b.more ? `<div class="fact-more">${b.more}</div>` : ''}
          ${b.tryit ? `<div class="wonder" style="border-left-color:var(--lime);
             background:rgba(158,232,95,.08);color:#d8f5be">
             <b>Try it now:</b> ${b.tryit}</div>` : ''}
          <div class="card-actions">
            ${this.listenBtn((CATEGORIES[b.cat] || {}).name || b.cat, b.text, b.more,
                             b.tryit ? 'Try it now' : '', b.tryit)}
            ${b.animal ? `<button class="btn ghost" style="padding:7px 14px;font-size:.84rem"
               onclick="App.species('${b.animal}')">Compare with an animal →</button>` : ''}
          </div>
        </div>`).join('')}`);
    }
    const used = [...new Set(BODY.map(b => b.section))];
    this.el(`
      ${this.bar('Your Body', this.streakChip())}
      <div class="tiles">
        ${used.map(k => {
          const m = BODY_SECTIONS[k] || { name: k, glyph: '🫀' };
          const n = BODY.filter(b => b.section === k).length;
          return `<div class="tile" onclick="App.body('${k}')">
            <span class="t-glyph">${m.glyph}</span>
            <div class="t-name">${m.name}</div>
            <div class="t-sub">${n} facts</div></div>`;
        }).join('')}
      </div>`);
  },

  // ── NOTES ──
  notes() {
    const keys = Progress.p.whoa;
    this.el(`
      ${this.bar('Field Notes', `<span class="chip accent">${keys.length}</span>`)}
      ${keys.length ? keys.map(k => {
        const [aid, fi] = k.split('#');
        const a = ANIMALS.find(x => x.id === aid);
        if (!a || !a.facts[+fi]) return '';
        const f = a.facts[+fi];
        return `<div class="card tight" onclick="App.species('${a.id}')" style="cursor:pointer">
          <div style="display:flex;gap:12px">
            <img src="${this.pic(a)}" alt="" style="width:64px;height:64px;object-fit:cover;
                 border-radius:10px;flex:0 0 64px" onerror="this.style.opacity=.15">
            <div><b>${a.name}</b><div class="dim" style="margin-top:4px;line-height:1.45">${f.text}</div></div>
          </div></div>`;
      }).join('') : `<div class="card"><p class="dim">
        Nothing saved yet. Tap <b>☆ Whoa!</b> on any fact that surprises you and
        it lands here.</p></div>`}
      ${this.cloudCard()}
      <div class="card" style="margin-top:16px">
        <h2>Photo credits</h2>
        <p class="dim small" style="margin-top:6px">Every photo is freely licensed.
          <button class="btn ghost" style="margin-top:10px;padding:7px 14px;font-size:.84rem"
            onclick="App.credits()">See the list</button></p>
      </div>`);
  },

  credits() {
    fetch('img/credits.json').then(r => r.json()).then(c => {
      const rows = Object.entries(c).map(([id, v]) =>
        `<div class="credit-row"><img src="img/${v.file}" alt="" loading="lazy">
          <div><b style="color:var(--text)">${v.name}</b><br>${v.licence} · ${v.author}</div></div>`).join('');
      this.el(`<div class="bar"><button class="btn ghost" onclick="App.go('notes')">←</button>
        <div class="grow"></div><h2>Photo credits</h2></div>
        <div class="card">${rows}</div>`);
    }).catch(() => {});
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
