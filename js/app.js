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
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const has = Progress.init();
    if (has) { Progress.touchDay(); Progress.commit(); this.go('today'); }
    else this.welcome();
  },

  el(html) {
    document.getElementById('app').innerHTML = `<div class="screen">${html}</div>`;
    window.scrollTo(0, 0);
  },

  go(tab) {
    this.tab = tab;
    this.view = null;
    ({ today: () => this.today(), guide: () => this.guide(),
       play: () => this.play(), body: () => this.body(),
       notes: () => this.notes() }[tab] || (() => this.today()))();
    this.renderNav();
  },

  renderNav() {
    const items = [
      ['today', '🔭', 'Today'], ['guide', '📖', 'Guide'],
      ['play', '🎯', 'Play'], ['body', '🫀', 'Body'], ['notes', '📓', 'Notes'],
    ];
    document.getElementById('nav').innerHTML = items.map(([k, ic, label]) =>
      `<button class="${this.tab === k ? 'on' : ''}" onclick="App.go('${k}')">
        <span class="n-ic">${ic}</span>${label}</button>`).join('');
  },

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
            <img src="img/${a.id}.jpg" alt="${a.name}" loading="eager"
                 onerror="this.style.display='none'">
            <div class="fact-name">${a.name}</div>
          </div>
          <div class="fact-body">
            <div class="fact-text">${f.text}</div>
            ${f.more ? `<div class="fact-more">${f.more}</div>` : ''}
            ${a.wonder && +fi === 0 ? `<div class="wonder">${a.wonder}</div>` : ''}
            <div class="fact-actions">
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

  // ── GUIDE ──
  guideFilter: { kind: 'group', key: null },

  guide() {
    const f = this.guideFilter;
    const chips = [
      `<button class="chip ${!f.key ? 'accent' : ''}" onclick="App.setFilter('group',null)">All</button>`,
      ...Object.entries(GROUPS).map(([k, g]) =>
        `<button class="chip ${f.kind === 'group' && f.key === k ? 'accent' : ''}"
          onclick="App.setFilter('group','${k}')">${g.glyph} ${g.name}</button>`),
      ...Object.entries(HABITATS).map(([k, h]) =>
        `<button class="chip ${f.kind === 'home' && f.key === k ? 'accent' : ''}"
          onclick="App.setFilter('home','${k}')">${h.glyph} ${h.name}</button>`),
    ].join(' ');

    const list = ANIMALS.filter(a =>
      !f.key || (f.kind === 'group' ? a.group === f.key : (a.homes || []).includes(f.key)));

    const c = Progress.counts();
    this.el(`
      ${this.bar('Field Guide', `<span class="chip accent">${c.known + c.mastered} known</span>`)}
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">${chips}</div>
      <div class="grid">
        ${list.map(a => {
          const st = Progress.state(a.id);
          const unseen = st === 'unseen';
          return `<div class="thumb ${st === 'known' || st === 'mastered' ? 'seen' : ''}"
            onclick="App.species('${a.id}')">
            <img src="img/${a.id}.jpg" alt="" loading="lazy"
                 style="${unseen ? 'filter:grayscale(1) brightness(.42)' : ''}"
                 onerror="this.style.opacity=.15">
            <div class="th-name">${unseen ? '???' : a.name}
              ${st === 'mastered' ? '<span style="color:var(--amber)">★</span>' : ''}</div>
          </div>`;
        }).join('')}
      </div>
      ${list.length ? '' : '<p class="dim">Nothing here yet.</p>'}`);
  },

  setFilter(kind, key) { this.guideFilter = { kind, key }; this.guide(); },

  // ── species profile ──
  species(id) {
    const a = ANIMALS.find(x => x.id === id);
    if (!a) return this.guide();
    Progress.markSeen(id);
    const st = Progress.state(id);
    const g = GROUPS[a.group] || {};
    const stats = Object.entries(a.stats || {})
      .filter(([k]) => STAT_META[k])
      .map(([k, v]) => `<div style="flex:1;min-width:78px">
        <div class="dim small">${STAT_META[k].name}</div>
        <div style="font-size:1.16rem;font-weight:800">${v}<span class="dim small"> ${STAT_META[k].unit}</span></div>
      </div>`).join('');

    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.go('guide')">←</button>
        <div class="grow"></div>
        <span class="chip">${g.glyph || ''} ${g.name || a.group}</span>
        ${st === 'mastered' ? '<span class="chip accent">★ Mastered</span>' : ''}</div>
      <div class="fact-card" style="margin-bottom:16px">
        <div class="fact-photo">
          <img src="img/${a.id}.jpg" alt="${a.name}" onerror="this.style.display='none'">
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
                        padding-top:14px;border-top:1px solid var(--line)">${stats}</div>` : ''}
        </div>
      </div>
      ${a.wonder ? `<div class="wonder" style="margin-bottom:14px">${a.wonder}</div>` : ''}
      ${a.facts.map((f, i) => {
        const cat = CATEGORIES[f.cat] || { name: f.cat, glyph: '✨' };
        return `<div class="card tight">
          <div class="dim small" style="text-transform:uppercase;letter-spacing:.05em;
               color:var(--cyan);font-weight:700">${cat.glyph} ${cat.name}</div>
          <div style="margin-top:6px;font-size:1.02rem;line-height:1.5">${f.text}</div>
          ${f.more ? `<div class="fact-more" style="margin-top:10px;padding-top:10px">${f.more}</div>` : ''}
          <button class="btn ghost" style="margin-top:10px;padding:7px 14px;font-size:.84rem"
            onclick="Progress.toggleWhoa('${a.id}',${i});App.species('${a.id}')">
            ${Progress.isWhoa(a.id, i) ? '★ Saved' : '☆ Whoa!'}</button>
        </div>`;
      }).join('')}`);
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
    return [...bits]
      .filter(b => b.length > 3)
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
          <img src="img/${a.id}.jpg" alt="" loading="lazy" onerror="this.style.opacity=.15">
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
    }).join('');

    this.el(`
      <div class="bar"><button class="btn ghost" onclick="App.faceoffPick()">←</button>
        <div class="grow"></div><h2>Face-Off</h2></div>
      <div style="display:flex;gap:12px;margin-bottom:14px">
        ${[A, B].map(a => `<div style="flex:1;text-align:center">
          <img src="img/${a.id}.jpg" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;
               border-radius:14px;border:1px solid var(--line)" onerror="this.style.opacity=.15">
          <div style="font-weight:800;margin-top:6px">${a.name}</div></div>`).join('')}
      </div>
      <div class="card">${rows || '<p class="dim">These two have no stats in common yet.</p>'}</div>
      <button class="btn ghost wide" onclick="App.faceoffPick()">Pick two more</button>`);
  },

  // ── BODY ──
  body(sec) {
    if (typeof BODY === 'undefined' || !BODY.length) {
      return this.el(`${this.bar('Your Body')}
        <div class="card"><p class="dim">The body section is being written.</p></div>`);
    }
    if (sec) {
      const items = BODY.filter(b => b.section === sec);
      const meta = BODY_SECTIONS[sec] || { name: sec, glyph: '🫀' };
      return this.el(`
        <div class="bar"><button class="btn ghost" onclick="App.go('body')">←</button>
          <div class="grow"></div><h2>${meta.glyph} ${meta.name}</h2></div>
        ${items.map(b => `<div class="card">
          <div class="dim small" style="text-transform:uppercase;letter-spacing:.05em;
               color:var(--cyan);font-weight:700">${(CATEGORIES[b.cat] || {}).glyph || '✨'} ${b.cat}</div>
          <div style="margin-top:6px;font-size:1.05rem;line-height:1.5">${b.text}</div>
          ${b.more ? `<div class="fact-more">${b.more}</div>` : ''}
          ${b.tryit ? `<div class="wonder" style="border-left-color:var(--lime);
             background:rgba(158,232,95,.08);color:#d8f5be">
             <b>Try it now:</b> ${b.tryit}</div>` : ''}
          ${b.animal ? `<button class="btn ghost" style="margin-top:10px;padding:7px 14px;font-size:.84rem"
             onclick="App.species('${b.animal}')">Compare with an animal →</button>` : ''}
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
            <img src="img/${a.id}.jpg" alt="" style="width:64px;height:64px;object-fit:cover;
                 border-radius:10px;flex:0 0 64px" onerror="this.style.opacity=.15">
            <div><b>${a.name}</b><div class="dim" style="margin-top:4px;line-height:1.45">${f.text}</div></div>
          </div></div>`;
      }).join('') : `<div class="card"><p class="dim">
        Nothing saved yet. Tap <b>☆ Whoa!</b> on any fact that surprises you and
        it lands here.</p></div>`}
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
