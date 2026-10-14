// The lesson engine — journey map, lesson player, quiz, rewards.
//
// Wonder Lab 2 (2026-10): the whole front of the app was rebuilt around
// AUTHORED lessons and a game-like shell (worlds, Pip, sparks, stars, cards).
// An authored lesson (.work/lessons/*.json -> tools/build_lessons.py ->
// js/lessons.js) is:
//   idea   one sentence: what you will understand when you finish
//   pages  6-9 screens. Each is an icon (or a photo) plus a few BLOCKS:
//            p      a short paragraph that teaches one thing
//            term   a new word, with what it means
//            fact   a "look at this" callout
//            try    something to go and do
//            check  a real question about what the page just said. It gates
//                   Next. A wrong answer does not lock you out: it shakes,
//                   turns red, and you try another.
//   game   a matching game built from the lesson's own words
//   quiz   the end-of-lesson questions
// Finishing earns stars, Sparks, a streak day, and a Discovery Card.
//
// The game engines live in js/games.js, the tabs (cards, games, me) in
// js/tabs.js. What is SPOKEN is decided here (lessonStrings) and read by
// tools/gen_audio.py and the offline downloader.

Object.assign(App, {

  // ── small helpers ──
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  lessonsFor(courseId) { return LESSONS.filter(l => l.course === courseId); },
  lessonRecord(id) { return (Progress.p.lessons || {})[id] || null; },
  lessonStars(id) { return (this.lessonRecord(id) || {}).stars || 0; },
  worlds() { return COURSES.filter(c => this.lessonsFor(c.id).length); },
  courseOf(L) { return COURSES.find(c => c.id === L.course) || COURSES[0]; },

  // ══ THE JOURNEY: one world at a time ═════════════════════════════════
  journey() {
    this.resetSay();
    this.realm('journey');
    const worlds = this.worlds();
    const set = Progress.profile.settings = Progress.profile.settings || {};
    let wi = worlds.findIndex(c => c.id === (this._worldId || set.world));
    if (wi < 0) {
      wi = worlds.findIndex(c => this.lessonsFor(c.id).some(l => !this.lessonStars(l.id)));
      if (wi < 0) wi = 0;
    }
    const course = worlds[wi];
    this._worldId = course.id;
    this.setWorld(course.id);
    const lessons = this.lessonsFor(course.id);
    const done = lessons.filter(l => this.lessonStars(l.id) > 0);
    const stars = lessons.reduce((n, l) => n + this.lessonStars(l.id), 0);
    const nextIdx = lessons.findIndex(l => this.lessonStars(l.id) === 0);
    this.el(`
      <div class="jy pip-react">
        ${this.hud()}
        <section class="wh">
          <button class="wh-arrow" onclick="App.worldGo(-1)" aria-label="Previous world">‹</button>
          <div class="wh-mid" onclick="App.worldPicker()" role="button">
            <div class="wh-kicker">World ${wi + 1} of ${worlds.length}</div>
            <h1 class="wh-title">${course.name}</h1>
            <div class="wh-sub">${this.worldBlurb(course.id)}</div>
            <div class="wh-pills">
              <span class="wh-pill">${done.length} / ${lessons.length} done</span>
              <span class="wh-pill">${this.fx('⭐')} ${stars} / ${lessons.length * 3}</span>
            </div>
          </div>
          <button class="wh-arrow" onclick="App.worldGo(1)" aria-label="Next world">›</button>
        </section>
        <div class="wh-dots">${worlds.map((c, i) => `<i class="${i === wi ? 'on' : ''}"></i>`).join('')}</div>
        ${this.journeyPath(course, lessons, nextIdx, done.length)}
      </div>`);
    document.getElementById('app').style.setProperty('--w-acc', this.theme(course.id).acc);
  },

  worldGo(d) {
    const worlds = this.worlds();
    // The worlds form a loop: past the last one comes the first, and back from the first is the last.
    const n = worlds.length;
    const i = (Math.max(0, worlds.findIndex(c => c.id === this._worldId)) + d + n) % n;
    this.setWorldId(worlds[i].id);
  },
  setWorldId(id) {
    this._worldId = id;
    Progress.profile.settings = Progress.profile.settings || {};
    Progress.profile.settings.world = id;
    Progress.commit();
    this.closeSheet();
    this.journey();
    window.scrollTo(0, 0);
  },

  worldPicker() {
    this.closeSheet();
    Sfx.play('pop', 0.3);
    const worlds = this.worlds();
    const wrap = document.createElement('div');
    wrap.id = 'introSheet';
    wrap.innerHTML = `
      <div class="sheet-scrim" onclick="App.closeSheet()"></div>
      <div class="sheet">
        <div class="sh-body" style="padding-top:20px"><div class="sh-kicker">Pick a world</div>
          <div class="sh-title">Where to next?</div></div>
        <div class="world-picker">${worlds.map(c => {
          const ls = this.lessonsFor(c.id), d = ls.filter(l => this.lessonStars(l.id) > 0).length, t = this.theme(c.id);
          return `<button class="wp-item ${c.id === this._worldId ? 'on' : ''}" style="--t-top:${t.top};--t-mid:${t.mid}"
              onclick="App.setWorldId('${c.id}')">${this.fx(c.glyph)}<b>${c.name}</b><small>${d} / ${ls.length}</small></button>`;
        }).join('')}</div>
        <div class="sh-actions"><button class="cta" onclick="App.closeSheet()" style="background:var(--paper-2);color:var(--pink-ink-2);box-shadow:0 6px 0 var(--paper-edge)">Close</button></div>
      </div>`;
    document.body.appendChild(wrap);
    void wrap.firstElementChild.offsetWidth;
    wrap.querySelector('.sheet').classList.add('up');
    wrap.querySelector('.sheet-scrim').classList.add('up');
  },

  // The path: a snaking trail of big round lesson buttons.
  journeyPath(course, lessons, nextIdx, doneCount) {
    const n = lessons.length, TOP = 74, STEP = 168, W = 100;
    const pat = [50, 77, 50, 23];
    const xs = lessons.map((_, i) => pat[i % 4]);
    const ys = lessons.map((_, i) => TOP + i * STEP);
    const H = TOP + n * STEP + 20;                 // room for the medal at the end
    const medalY = TOP + n * STEP, medalX = 50;
    let d = `M ${xs[0]} ${ys[0] + 44}`;
    const pts = [...xs.map((x, i) => [x, ys[i] + 44]), [medalX, medalY + 44]];
    for (let i = 1; i < pts.length; i++) {
      const my = (pts[i - 1][1] + pts[i][1]) / 2;
      d += ` C ${pts[i - 1][0]} ${my}, ${pts[i][0]} ${my}, ${pts[i][0]} ${pts[i][1]}`;
    }
    const litFrac = n > 0 ? Math.min(1, doneCount / n) : 0;
    const props = this.worldProps(course.id);
    const decor = lessons.map((_, i) => {
      const side = xs[i] > 55 ? 14 : xs[i] < 45 ? 86 : (i % 2 ? 16 : 84);
      const e = props[i % props.length];
      return `<span class="prop ${i % 3 === 0 ? 'big' : ''}" style="left:calc(${side}% - 30px);top:${ys[i] + 18 + (i % 2) * 14}px;animation-delay:${(i * .7) % 4}s">${this.fx(e)}</span>`;
    }).join('');
    const earned = !!((Progress.p.medals || {})[course.id]);
    const nodes = lessons.map((l, i) => {
      const stars = this.lessonStars(l.id);
      const state = stars > 0 ? 'done' : (i === nextIdx ? 'next' : '');
      return `<button class="node ${state}" style="left:${xs[i]}%;top:${ys[i]}px"
          onclick="App.lessonIntro('${l.id}')" aria-label="${l.title}">
        ${state === 'next' ? `<span class="node-bubble">${doneCount ? 'Next up' : 'Start here'}</span>` : ''}
        <span class="node-disc ${this.lessonPhoto(l) ? 'photo' : ''}">${this.lessonPhoto(l)
          ? `<img class="node-photo" src="${this.lessonPhoto(l)}" alt="">` : this.fx(l.glyph || course.glyph)}${stars ? '<span class="node-check">✓</span>' : ''}</span>
        <span class="node-stars">${[0, 1, 2].map(k => this.fx('⭐', k < stars ? '' : 'off')).join('')}</span>
        <span class="node-label">${l.title}</span>
      </button>`;
    }).join('');
    const bossIcon = (typeof BOSS_ICON !== 'undefined' && BOSS_ICON[course.id]) || '👾';
    const bossUp = !earned && this.bossReady && this.bossReady(course.id);
    const medal = `<button class="node medal ${earned ? 'earned' : ''} ${bossUp ? 'ready' : ''}" style="left:${medalX}%;top:${medalY}px"
        onclick="App.medalTap('${course.id}')">
      ${bossUp ? '<span class="node-bubble">Boss battle!</span>' : ''}
      <span class="node-disc">${this.fx(earned ? '🏅' : bossIcon)}</span>
      <span class="node-label">${earned ? course.name + ' medal' : (this.bossName ? this.bossName(course.id) : 'Boss')}</span></button>`;
    let pip = '';
    if (nextIdx >= 0) {
      const x = xs[nextIdx], right = x < 60;
      pip = `<div class="pip-spot ${right ? '' : 'right'}" style="left:calc(${x}% + ${right ? 70 : -150}px);top:${ys[nextIdx] - 8}px;margin-left:0">${this.pip('')}</div>`;
    } else {
      pip = `<div class="pip-spot" style="left:calc(50% + 70px);top:${medalY - 8}px;margin-left:0">${this.pip('happy cheer')}</div>`;
    }
    return `<div class="jmap" style="height:${H + 150}px">
      <svg class="jm-svg" viewBox="0 0 ${W} ${H + 150}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" class="jm-path-shadow" vector-effect="non-scaling-stroke" transform="translate(0 6)"/>
        <path d="${d}" class="jm-path" vector-effect="non-scaling-stroke"/>
        <path d="${d}" class="jm-path-lit" vector-effect="non-scaling-stroke" pathLength="100"
          style="stroke-dasharray:100;stroke-dashoffset:${100 - 100 * litFrac}"/>
      </svg>
      ${decor}${nodes}${medal}${pip}
    </div>`;
  },

  // species lessons show their first animal or plant, not a generic icon
  lessonPhoto(L) {
    if (L.kind !== 'species' || !L.items || !L.items.length) return '';
    const a = this.find(L.items[0]);
    return a ? this.pic(a) : '';
  },

  medalTap(courseId) {
    const c = COURSES.find(x => x.id === courseId);
    const have = !!((Progress.p.medals || {})[courseId]);
    Sfx.play(have ? 'tada' : 'no', 0.4);
    this.toast(have ? `${this.fx('🏅')} You earned the ${c.name} medal!`
      : `${this.fx('🔒')} Finish every ${c.name} lesson to earn this medal`);
    if (have) this.confetti(18);
  },

  // ══ THE SHEET BEFORE A LESSON ════════════════════════════════════════
  lessonIntro(id) {
    const L = LESSONS.find(x => x.id === id);
    if (!L) return;
    this.closeSheet();
    const course = this.courseOf(L);
    this.setWorld(course.id);
    const stars = this.lessonStars(id);
    const n = L.pages ? L.pages.length : this.lessonPages(L).length + 1;
    const nq = L.quiz ? L.quiz.length : 6;
    Sfx.play('pop', 0.3);
    this.resetSay();
    const meet = (L.kind === 'species' ? L.items : []).map(i => this.find(i)).filter(Boolean).slice(0, 7)
      .map(a => `<img src="${this.pic(a)}" alt="${a.name}">`).join('');
    const wrap = document.createElement('div');
    wrap.id = 'introSheet';
    wrap.innerHTML = `
      <div class="sheet-scrim" onclick="App.closeSheet()"></div>
      <div class="sheet">
        <div class="sh-hero">${this.fx(L.glyph || course.glyph, 'sh-icon')}
          <span class="sh-pip">${this.pip('happy')}</span></div>
        <div class="sh-body">
          <div class="sh-kicker">${course.name}</div>
          <h2 class="sh-title">${L.title}</h2>
          ${L.idea ? `<p class="sheet-idea">${L.idea}</p>` : ''}
          ${meet ? `<div class="sh-meet">${meet}</div>` : ''}
          <div class="sh-chips">
            <span class="sh-chip">${n} pages</span><span class="sh-chip">a game</span>
            <span class="sh-chip">${nq} questions</span>
            <span class="sh-chip">${[0, 1, 2].map(k => this.fx('⭐', k < stars ? '' : 'off')).join('')}</span>
          </div>
        </div>
        <div class="sh-actions">
          ${L.idea ? this.listenLabel('', L.title, L.idea).replace('class="listen"', 'class="listen sh-hear"') : ''}
          <button class="cta pulse" onclick="App.lessonOpen('${L.id}')">${stars ? 'Play again' : 'Start lesson'}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    void wrap.firstElementChild.offsetWidth;
    wrap.querySelector('.sheet').classList.add('up');
    wrap.querySelector('.sheet-scrim').classList.add('up');
  },

  closeSheet() {
    const el = document.getElementById('introSheet');
    if (!el) return;
    el.removeAttribute('id');
    el.querySelector('.sheet').classList.remove('up');
    el.querySelector('.sheet-scrim').classList.remove('up');
    setTimeout(() => el.remove(), 280);
  },

  COURSE_TINT: {},   // (kept for old callers; the world themes replace it)

  // ══ THE PLAYER ═══════════════════════════════════════════════════════
  lessonOpen(id) {
    this.closeSheet();
    const L = LESSONS.find(x => x.id === id);
    if (!L) return;
    this.resetSay();
    const course = this.courseOf(L);
    this.setWorld(course.id);
    const pages = L.pages
      ? L.pages.map(p => ({ ...p, _authored: true }))
      : [{ text: L.intro || '', isIntro: true, isFrame: true }, ...this.lessonPages(L)];
    this._lesson = { L, pages, idx: 0, stage: 'story', _checkOK: {}, _checkMiss: {},
      _tried: {}, quizIdx: 0, quizRight: 0, quizFirst: 0, xp0: Progress.p.xp || 0 };
    const old = document.getElementById('lessonOverlay');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'pl pip-react';
    wrap.id = 'lessonOverlay';
    document.body.appendChild(wrap);
    this.lessonRenderPage();
  },

  lessonExit() {
    if (this._lesson && this._lesson.mode === 'daily') return this.dailyExit();
    const el = document.getElementById('lessonOverlay');
    if (el) el.remove();
    AudioLib.stop();
    this._lesson = null;
    this._game = null;
    this.journey();
  },

  // progress segments: every page, then the game, then the quiz
  segs(stage) {
    const s = this._lesson, n = s.pages.length;
    if (s.mode === 'daily') {
      return s.L.quiz.map((_, i) => `<i class="${i < s.quizIdx ? 'past' : i === s.quizIdx ? 'on' : ''}"></i>`).join('');
    }
    const at = stage === 'story' ? s.idx : stage === 'game' ? n : n + 1;
    return Array.from({ length: n + 2 }, (_, i) =>
      `<i class="${i < at ? 'past' : i === at ? 'on' : ''} ${i === n ? 'kind-game' : i === n + 1 ? 'kind-quiz' : ''}"></i>`).join('');
  },

  // The question attached to a page, whichever kind of page it is.
  pageCheck(p) {
    if (p.blocks) { const b = p.blocks.find(x => x.t === 'check'); return b ? b.q : null; }
    return p._check || null;
  },

  // ══ WHAT IS SPOKEN ═══════════════════════════════════════════════════
  // The one place that decides which strings are read aloud. Every string
  // here is exactly one pre-recorded clip, and gen_audio.py and
  // Offline.allTexts() both call lessonStrings() to learn the corpus — so a
  // string cannot be shown, spoken, and missing a clip. EVERYTHING a child
  // reads in a lesson is spoken: the page, each question AND each possible
  // answer, the feedback after an answer, the game's cards, the results.
  PHR: {
    right: 'Right!', miss: 'Not quite.',
    missFallback: 'Look back at the page and try another.',
    pairsTitle: 'Match them up',
    pairsHelp: 'Tap a name on the left, then the clue that fits it on the right.',
    pairsDone: 'All matched!',
    cheers: ['Nice!', "That's right!", 'Yes!', 'You got it!'],
    answerIs: 'The right answer is',
    done: 'Lesson complete!', review: 'Nice review!',
    cardNew: 'New Discovery Card!', cardGold: 'Your card turned gold!',
    cardHave: 'Card is in your Collection', goGold: 'Get three stars to turn it gold.',
    levelUp: 'Level up!',
    medal: 'You earned a world medal!',
    tryDone: 'Nice work!',
    tryBtn: 'I did it!',
  },

  // Read to me: on by default, and a child can turn it off for the lesson player.
  autoRead() { return ((Progress.profile && Progress.profile.settings) || {}).autoRead !== false; },
  toggleAutoRead() {
    const on = !this.autoRead();
    Progress.profile.settings = Progress.profile.settings || {};
    Progress.profile.settings.autoRead = on;
    Progress.commit();
    if (!on) { AudioLib.stop(); this._saying = null; this.syncListen(); }
    const b = document.getElementById('autoBtn');
    if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = this.ico(on ? 'speak' : 'mute'); }
    if (on) this.autoPlay();
  },
  autoBtn() {
    const on = this.autoRead();
    return `<button class="pl-tog ${on ? 'on' : ''}" id="autoBtn" aria-pressed="${on}"
      aria-label="Read to me" onclick="App.toggleAutoRead()">${this.ico(on ? 'speak' : 'mute')}</button>`;
  },
  // Speak these now (feedback, a tapped card), cutting off anything playing.
  speakNow(parts, always) {
    if (!always && !this.autoRead()) return;
    this._saying = null; this.syncListen();
    AudioLib.speakSeq(parts.filter(x => x && String(x).trim()));
  },
  // Start the screen's main Listen button, if read-to-me is on.
  autoPlay(sel) {
    if (!this.autoRead()) return;
    const b = document.querySelector(sel || '#lessonOverlay .pl-top .listen');
    if (b) this.say(+b.dataset.say);
  },

  blockSpeech(b) {
    if (b.t === 'p') return [b.text];
    if (b.t === 'term') return [`${b.word}. ${b.text}`];
    if (b.t === 'fact') return [b.label ? `${b.label}. ${b.text}` : b.text];
    if (b.t === 'try') return [`Try it. ${b.text}`];
    return [];
  },
  // A question, then every answer it offers, one clip each.
  checkSpeech(q) { return [q.prompt, ...(q.type === 'tf' ? ['True', 'False'] : q.options)]; },
  checkFeedback(q, ok) {
    return ok ? [this.PHR.right, q.explain] : [this.PHR.miss, q.hint || this.PHR.missFallback];
  },
  // Everything on a page that is read aloud, in order.
  pageSpeech(p) {
    if (p.blocks) {
      const out = p.blocks.flatMap(b => b.t === 'check' ? this.checkSpeech(b.q) : this.blockSpeech(b));
      return out.filter(x => x && String(x).trim());
    }
    return [p.name || '', p.text, p.more];
  },
  resultSpeech(L, first, card, lvUp) {
    const out = [first ? this.PHR.done : this.PHR.review, L.title];
    if (lvUp) out.push(this.PHR.levelUp);
    if (card) {
      out.push(card.upgraded ? this.PHR.cardGold : card.isNew ? this.PHR.cardNew : this.PHR.cardHave,
        L.idea);
      if (!card.foil) out.push(this.PHR.goGold);
    }
    return out;
  },
  // The complete list of strings an authored lesson can ever speak. The audio
  // generator and the offline downloader read this, nothing else.
  lessonStrings(L) {
    const out = L.idea ? [L.title, L.idea] : [];
    (L.pages || []).forEach(p => {
      out.push(...this.pageSpeech({ blocks: p.blocks }));
      p.blocks.forEach(b => { if (b.t === 'check') out.push(...this.checkFeedback(b.q, true),
        ...this.checkFeedback(b.q, false)); });
    });
    ((L.game || {}).pairs || []).forEach(pr => out.push(pr[0], pr[1]));
    (L.quiz || []).forEach(q => {
      out.push(...this.checkSpeech(q), q.explain);
      out.push(q.type === 'tf' ? (q.answer ? 'False' : 'True') : q.options[q.answer]);
    });
    if (this.gameStrings) out.push(...this.gameStrings(L));
    return out.filter(x => x && String(x).trim());
  },
  // Fixed lines: the same for every lesson.
  lessonPhrases() {
    const out = Object.values(this.PHR).flat();
    if (this.GPHR) out.push(...Object.values(this.GPHR).flat());
    return out;
  },

  blockHTML(b, idx) {
    if (b.t === 'p') return `<p class="lp-p">${b.text}</p>`;
    if (b.t === 'term') return `<div class="lp-card lp-term"><span class="lp-tag">${this.fx('📖')} New word</span>
      <b class="lp-word">${b.word}</b><p>${b.text}</p></div>`;
    if (b.t === 'fact') return `<div class="lp-card lp-fact"><span class="lp-tag">${this.fx('✨')} ${b.label || 'Look at this'}</span>
      <p>${b.text}</p></div>`;
    if (b.t === 'try') {
      const done = this._lesson && this._lesson._tried[this._lesson.idx];
      return `<div class="lp-card lp-try"><span class="lp-tag">${this.fx('🧪')} Try it</span>
      <p>${b.text}</p>
      <button class="lp-try-btn ${done ? 'done' : ''}" onclick="App.tryDone(this)">${done ? '✓ ' + this.PHR.tryDone : this.PHR.tryBtn}</button></div>`;
    }
    return '';
  },
  tryDone(btn) {
    const s = this._lesson;
    if (!s || s._tried[s.idx]) return;
    s._tried[s.idx] = true;
    btn.classList.add('done'); btn.textContent = '✓ ' + this.PHR.tryDone;
    Sfx.play('ding', 0.4);
    this.sparkFloat('+1 ' + '⚡', btn);
    Progress.p.xp = (Progress.p.xp || 0) + 1;
    s.tryXp = (s.tryXp || 0) + 1;
    Progress.commit();
    this.pipReact('happy');
  },

  // One answer: the button, and (for authored text) a speaker that reads just it.
  answerRow(text, i, cls, disabled, onclick, authored) {
    return `<div class="answer-row">
      <button class="answer ${cls}" ${disabled ? 'disabled' : ''} onclick="${onclick}">${text}</button>
      ${authored ? this.listenLabel('', text) : ''}</div>`;
  },

  checkBoxHTML(q, authored, done) {
    const opts = q.type === 'tf' ? ['True', 'False'] : q.options;
    const label = q.label || (q.type === 'tf' ? 'True or false?'
      : q.type === 'blank' ? 'What number fits?' : 'Quick check');
    return `<div class="check-box" id="checkBox">
      <div class="check-q"><span>${label}</span>${authored
        ? this.listenLabel('Hear it', ...this.checkSpeech(q)) : ''}</div>
      <p class="check-prompt">${q.prompt}</p>
      <div class="answer-list">${opts.map((o, i) => this.answerRow(o, i,
        done && i === q.answer ? 'right' : '', done, `App.lessonCheckAnswer(${i})`, authored)).join('')}</div>
      <div class="check-fb" id="checkFb">${done && q.explain
        ? `<div class="fb ok"><span class="fb-pip">${this.pip('happy')}</span><div><b>${this.PHR.right}</b><p>${q.explain}</p></div></div>` : ''}</div>
    </div>`;
  },

  // The picture side of a page.
  pageArt(p, L, course) {
    const pip = `<span class="art-pip">${this.pip('')}</span>`;
    if (p._authored && p.img) {
      const sp = this.find(p.img);
      if (sp) return `<div class="art-scene"><div class="art-glow"></div>
        <div class="art-photo"><img src="${this.pic(sp)}" alt="${sp.name}"></div>${pip}</div>`;
    }
    if (!p._authored && p.img) {          // an older photo page
      return `<div class="art-scene"><div class="art-glow"></div>
        <div class="art-photo"><img src="${p.img}" alt="${p.name || ''}"></div>${pip}</div>`;
    }
    if (L.kind === 'species' && L.items) {
      const subs = L.items.map(i => this.find(i)).filter(Boolean).slice(0, 3);
      if (subs.length && (p.isFrame || p.icon === '🐾' || p.icon === '🌿')) {
        return `<div class="art-scene"><div class="art-glow"></div><div class="art-collage">${subs.map((a, k) =>
          `<div class="art-photo c${k}"><img src="${this.pic(a)}" alt="${a.name}"></div>`).join('')}</div>${pip}</div>`;
      }
    }
    const icon = p.icon || L.glyph || course.glyph;
    const props = this.worldProps(course.id);
    const pos = [[6, 12], [84, 8], [10, 70], [82, 66]];
    const bits = pos.map(([x, y], k) =>
      `<span class="art-bit" style="left:${x}%;top:${y}%;animation-delay:${k * .6}s">${this.fx(props[(this._lesson.idx + k) % props.length])}</span>`).join('');
    return `<div class="art-scene"><div class="art-glow"></div>${bits}
      <div class="art-main">${this.fx(icon)}</div>${pip}</div>`;
  },

  lessonRenderPage() {
    const s = this._lesson, p = s.pages[s.idx];
    const el = document.getElementById('lessonOverlay');
    if (!el) return;
    this.resetSay();
    const L = s.L, course = this.courseOf(L);
    const authored = !!p._authored;

    // Legacy (species) pages get an occasional auto-built check; authored
    // pages carry their own hand-written ones.
    if (!authored && p._check === undefined) {
      p._check = (s.idx > 0 && s.idx % 3 === 0 && Math.random() < 0.7)
        ? (Math.random() < 0.5 ? this.genBlank(p, s.pages.filter(x => x.text && !x.isIntro))
                                : this.genTF(p))
        : null;
    }
    const q = this.pageCheck(p);
    const answered = !!s._checkOK[s.idx];

    let body;
    if (authored) {
      body = p.blocks.map(b => b.t === 'check'
        ? this.checkBoxHTML(b.q, true, answered) : this.blockHTML(b)).join('');
    } else if (p.isFrame) {
      body = `<h2 class="lp-title">${L.title}</h2><p class="lp-p">${p.text}</p>`;
    } else {
      body = `${p.name ? `<div class="pl-kicker">${p.name}</div>` : ''}
        <p class="lp-p">${p.text}</p>
        ${p.more ? `<div class="lp-card lp-fact"><span class="lp-tag">${this.fx('✨')} More</span><p>${p.more}</p></div>` : ''}
        ${p.tryit ? `<div class="lp-card lp-try"><span class="lp-tag">${this.fx('🧪')} Try it</span><p>${p.tryit}</p></div>` : ''}
        ${q && !answered ? this.checkBoxHTML(q, false, false) : ''}`;
    }
    const last = s.idx === s.pages.length - 1;
    const locked = !!q && !answered;
    el.innerHTML = `
      <div class="pl-top">
        <button class="pl-x" onclick="App.lessonExit()" aria-label="Close">✕</button>
        <div class="pl-seg">${this.segs('story')}</div>
        ${authored ? this.autoBtn() : ''}
        ${this.listenLabel('Listen', ...this.pageSpeech(p))}
      </div>
      <div class="pl-stage">
        <div class="pl-art">${this.pageArt(p, L, course)}</div>
        <div class="pl-paper" id="plPaper">
          <div class="pl-kicker">${L.title}</div>
          ${body}
        </div>
      </div>
      <div class="pl-foot">
        <button class="pl-back" ${s.idx === 0 ? 'disabled' : ''} onclick="App.lessonBack()" aria-label="Back">‹</button>
        <button class="cta ${locked ? '' : 'pulse'}" id="lessonNextBtn" ${locked ? 'disabled' : ''}
          onclick="App.lessonNext()">${last ? 'On to the game' : 'Next'}</button>
      </div>`;
    this.syncListen();
    if (authored) this.autoPlay();
  },

  // A wrong answer shakes, turns red, and lets you try another — it never
  // locks the page.
  lessonCheckAnswer(i) {
    const s = this._lesson, p = s.pages[s.idx], q = this.pageCheck(p);
    if (!q || s._checkOK[s.idx]) return;
    const btns = [...document.querySelectorAll('#checkBox .answer')];
    const fb = document.getElementById('checkFb');
    if (i === q.answer) {
      s._checkOK[s.idx] = true;
      btns.forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === q.answer); });
      fb.innerHTML = `<div class="fb ok"><span class="fb-pip">${this.pip('happy')}</span>
        <div><b>${this.PHR.right}</b><p>${q.explain || ''}</p></div></div>`;
      Sfx.play('yes', 0.45);
      this.haptic(14);
      this.pipReact('happy');
      this.speakNow(this.checkFeedback(q, true));
      setTimeout(() => { const f = fb.firstElementChild; if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
      const nb = document.getElementById('lessonNextBtn');
      if (nb) { nb.disabled = false; nb.classList.add('pulse'); }
      return;
    }
    s._checkMiss[s.idx] = (s._checkMiss[s.idx] || 0) + 1;
    btns[i].disabled = true;
    btns[i].classList.remove('wrong'); void btns[i].offsetWidth; btns[i].classList.add('wrong');
    if (s._checkMiss[s.idx] >= 2) btns[q.answer].classList.add('hint');
    fb.innerHTML = `<div class="fb no"><span class="fb-pip">${this.pip('oops')}</span>
      <div><b>${this.PHR.miss}</b><p>${q.hint || this.PHR.missFallback}</p></div></div>`;
    Sfx.play('no', 0.35);
    this.haptic(30);
    this.pipReact('oops');
    this.speakNow(this.checkFeedback(q, false));
    setTimeout(() => { const f = fb.firstElementChild; if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
  },

  lessonBack() {
    const s = this._lesson;
    if (s.idx > 0) { s.idx--; this.lessonRenderPage(); }
  },

  lessonNext() {
    const s = this._lesson;
    Sfx.play('tap', 0.3);
    if (s.idx < s.pages.length - 1) { s.idx++; return this.lessonRenderPage(); }
    this.lessonStartGame();
  },

  // ══ THE QUIZ ═════════════════════════════════════════════════════════
  // The quiz asks about ideas, not about remembering a number: a figure-recall question
  // (q.fig, tools/qkind.py) is swapped for a question the child already met on a page of this
  // lesson, so the quiz keeps its length. Only if the lesson has no such question is it kept.
  portableQuiz(L) {
    const quiz = L.quiz || [];
    const ok = quiz.filter(q => !q.fig);
    if (ok.length === quiz.length) return quiz;
    const seen = new Set(ok.map(q => q.prompt));
    const spare = [];
    (L.pages || []).forEach(p => (p.blocks || []).forEach(b => {
      const q = b.t === 'check' ? b.q : null;
      if (q && !q.fig && q.type !== 'tf' && q.options && q.options.length >= 3 && !seen.has(q.prompt)) spare.push(q);
    }));
    const out = ok.concat(this.shuffle(spare)).slice(0, quiz.length);
    return out.length >= Math.min(3, quiz.length) ? out : quiz;
  },
  lessonStartQuiz() {
    const s = this._lesson;
    s.stage = 'quiz';
    // Shuffle the options as well as the order: the hand-written quiz lists
    // the right answer first in most questions, so without this a child
    // can pass every quiz by tapping the top button.
    s.quiz = this.shuffle(s.L.quiz ? this.portableQuiz(s.L) : this.buildQuestions(s.L, s.pages, 6, true)).map(q => {
      if (!q.options) return q;
      const order = this.shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
    });
    s.quizIdx = 0; s.quizRight = 0; s.quizFirst = 0; s.quizSeenMiss = {};
    this.lessonRenderQuiz();
  },

  lessonRenderQuiz() {
    const s = this._lesson, el = document.getElementById('lessonOverlay');
    const q = s.quiz[s.quizIdx];
    if (!q) return this.lessonFinish();
    this.resetSay();
    const opts = q.type === 'tf' ? ['True', 'False'] : q.options;
    const spoken = !!s.L.quiz;     // hand-written quizzes have a clip for every string
    el.innerHTML = `
      <div class="pl-top">
        <button class="pl-x" onclick="App.lessonExit()" aria-label="Close">✕</button>
        <div class="pl-seg">${this.segs('quiz')}</div>
        ${spoken ? this.autoBtn() : ''}
        <span class="pl-sp">${s.quizIdx + 1} / ${s.quiz.length}</span>
      </div>
      <div class="pl-stage">
        <div class="pl-art qz-art"><div class="art-scene">${q.img ? `<div class="art-photo"><img src="${q.img}" alt=""></div>`
          : `<div class="art-glow"></div><div class="art-main qz-pip">${this.pip('wow')}</div>`}</div></div>
        <div class="pl-paper" id="plPaper">
          <div class="pl-kicker">Quiz · question ${s.quizIdx + 1}</div>
          <p class="check-prompt qz-prompt">${q.prompt}</p>
          ${spoken ? `<div class="quiz-hear">${this.listenLabel('Hear it', ...this.checkSpeech(q))}</div>` : ''}
          <div class="answer-list" style="margin-top:14px">
            ${opts.map((o, i) => this.answerRow(o, i, '', false, `App.lessonQuizAnswer(${i})`, spoken)).join('')}
          </div>
        </div>
      </div>
      <div class="qz-fb" id="fbBar"></div>`;
    this.syncListen();
    if (spoken) this.autoPlay('#lessonOverlay .quiz-hear .listen');
  },

  lessonQuizAnswer(i) {
    const s = this._lesson, q = s.quiz[s.quizIdx];
    if (s._qLocked) return;
    const ok = i === q.answer;
    const opts = q.type === 'tf' ? ['True', 'False'] : q.options;
    s._qLocked = true;
    document.querySelectorAll('.answer-list .answer').forEach((b, j) => {
      b.onclick = null; b.disabled = true;
      if (j === q.answer) b.classList.add('right');
      else if (j === i) b.classList.add('wrong');
    });
    Sfx.play(ok ? 'yes' : 'no', ok ? 0.45 : 0.35);
    this.haptic(ok ? 14 : 30);
    if (ok) { s.quizRight++; if (!s.quizSeenMiss[s.quizIdx]) s.quizFirst++; }
    else s.quizSeenMiss[s.quizIdx] = true;
    const bar = document.getElementById('fbBar');
    bar.className = 'qz-fb ' + (ok ? 'ok' : 'no');
    const head = ok ? this.pick(this.PHR.cheers) : this.PHR.miss;
    bar.innerHTML = `
      <div class="qz-fb-in">
        <span class="fb-pip">${this.pip(ok ? 'happy cheer' : 'oops')}</span>
        <div class="qz-fb-t"><b>${head}</b>
          <p>${ok || this.explainLeadsWith(q, opts[q.answer]) ? (q.explain || '') : `${this.PHR.answerIs} ${opts[q.answer]}. ${q.explain || ''}`}</p></div>
        <button class="cta" onclick="App.lessonQuizContinue()">${s.quizIdx === s.quiz.length - 1 ? 'See how you did' : 'Continue'}</button>
      </div>`;
    requestAnimationFrame(() => bar.classList.add('up'));
    if (s.L.quiz) this.speakNow(ok || this.explainLeadsWith(q, opts[q.answer]) ? [head, q.explain]
      : [head, this.PHR.answerIs, opts[q.answer], q.explain]);
  },

  // when the explanation already opens with the answer, saying "The right answer is X. X. ..." is a stutter
  explainLeadsWith(q, opt) {
    const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const e = norm(q.explain), o = norm(opt);
    return !!o && e.startsWith(o.slice(0, Math.max(6, Math.min(o.length, 24))));
  },

  lessonQuizContinue() {
    const s = this._lesson;
    s._qLocked = false;
    s.quizIdx++;
    this.lessonRenderQuiz();
  },

  // ══ THE REWARD ═══════════════════════════════════════════════════════
  lessonFinish() {
    const s = this._lesson, L = s.L;
    if (s.mode === 'daily') return this.dailyFinish();
    const quizAcc = s.quiz.length ? s.quizFirst / s.quiz.length : 1;
    const gameAcc = s.gameAcc == null ? 1 : s.gameAcc;
    const quizStars = quizAcc >= 0.85 ? 3 : quizAcc >= 0.6 ? 2 : 1;
    const gameStars = gameAcc >= 0.85 ? 3 : gameAcc >= 0.6 ? 2 : 1;
    const stars = Math.max(1, Math.round((quizStars + gameStars) / 2));
    const prevStars = this.lessonStars(L.id);
    const first = prevStars === 0;
    const perfect = quizAcc >= 1;
    const xpGain = 15 + stars * 5 + (first ? 15 : 0) + (perfect ? 5 : 0);
    const before = this.levelInfo(s.xp0 != null ? s.xp0 : Progress.p.xp || 0);

    Progress.p.lessons = Progress.p.lessons || {};
    Progress.p.lessons[L.id] = { stars: Math.max(prevStars, stars),
      quizRight: s.quizRight, quizTotal: s.quiz.length, at: Store.dayKey(), g: s.gameKind };
    Progress.p.xp = (Progress.p.xp || 0) + xpGain;

    // The world medal is won by beating the world's boss (js/games2.js).
    let medal = false;
    Progress.p.medals = Progress.p.medals || {};
    const bossNow = !Progress.p.medals[L.course] && this.bossReady && this.bossReady(L.course);
    // The Discovery Card: one per lesson, gold-foil once earned at three stars.
    let card = null;
    if (L.idea) {
      Progress.p.cards = Progress.p.cards || {};
      const prev = Progress.p.cards[L.id];
      const foil = stars >= 3 || !!(prev && prev.foil);
      Progress.p.cards[L.id] = { foil };
      card = { foil, isNew: !prev, upgraded: !!prev && !prev.foil && foil };
    }
    Progress.touchDay();
    Progress.commit();
    const after = this.levelInfo(Progress.p.xp);
    const lvUp = after.level > before.level;

    const newlySeen = [];
    if (L.kind === 'species') {
      L.items.forEach(id => { if (Progress.markSeen(id)) newlySeen.push(id); });
    }

    this.confetti(stars >= 3 ? 40 : 24);
    Sfx.play(lvUp ? 'levelup' : 'tada', 0.55);
    const course = this.courseOf(L);
    const el = document.getElementById('lessonOverlay');
    el.innerHTML = `
      <div class="pl-top"><div class="pl-seg">${Array.from({ length: s.pages.length + 2 },
        () => '<i class="past"></i>').join('')}</div>${L.pages
        ? this.listenLabel('Listen', ...this.resultSpeech(L, first, card, lvUp)) : ''}</div>
      <div class="rs">
        <div class="rs-rays"></div>
        <div class="rs-pip">${this.pip('happy cheer jump')}</div>
        <div class="rs-kicker">${first ? this.PHR.done : this.PHR.review}</div>
        <h1>${L.title}</h1>
        <div class="rs-stars">${[0, 1, 2].map(i => `<span class="rs-star ${i < stars ? 'on' : 'off'}"
            style="animation-delay:${.3 + i * .35}s">${this.fx('⭐')}</span>`).join('')}</div>
        <div class="rs-stats">
          <div class="rs-stat"><b>${s.quizRight}/${s.quiz.length}</b><span>Quiz</span></div>
          <div class="rs-stat"><b>+<span id="rsXp">0</span></b><span>${this.fx('⚡')} Sparks</span></div>
          <div class="rs-stat"><b>${Progress.p.dayStreak || 1}</b><span>${this.fx('🔥')} Day streak</span></div>
        </div>
        <div class="rs-level"><span class="lv-n">${before.level}</span>
          <div style="flex:1"><small>Level ${after.level}</small>
            <span class="lv-bar"><i id="rsLv" style="width:${Math.round(before.frac * 100)}%"></i></span></div></div>
        ${lvUp ? `<div class="rs-levelup">${this.fx('🎉')} ${this.PHR.levelUp} You are level ${after.level}</div>` : ''}
        ${bossNow ? `<div class="rs-levelup">${this.fx('⚔️')} The ${course.name} boss is waiting on the map!</div>` : ''}
        ${card ? `<div class="dcard-wrap">${this.dcardHTML(L, course, card.foil, true, true)}
          <div class="dcard-note">${card.upgraded ? this.PHR.cardGold
            : card.isNew ? this.PHR.cardNew : this.PHR.cardHave}${
            !card.foil ? `<br><small>${this.PHR.goGold}</small>` : ''}</div></div>` : ''}
      </div>
      <div class="rs-foot"><button class="cta pulse" onclick="App.lessonExit()">Continue</button></div>`;
    this.syncListen();
    setTimeout(() => {
      this.countUp(document.getElementById('rsXp'), 0, xpGain, 1100);
      const bar = document.getElementById('rsLv');
      if (bar) bar.style.width = Math.round(after.frac * 100) + '%';
    }, 500);
    stars === 3 && setTimeout(() => Sfx.play('star', 0.4), 1000);
    newlySeen.forEach((id, i) => setTimeout(() => this.newSpecimen(this.find(id)), 1800 + i * 1400));
    if (L.pages) setTimeout(() => this.autoPlay('#lessonOverlay .pl-top .listen'), 900);
  },

  dcardHTML(L, course, foil, big, flip) {
    const t = this.theme(L.course);
    return `<div class="dcard ${foil ? 'foil' : ''} ${big ? 'big' : ''} ${flip ? 'flip' : ''}"
        style="--dtint:${t.acc}">
      <div class="dcard-glyph ${this.lessonPhoto(L) ? 'photo' : ''}">${this.lessonPhoto(L)
        ? `<img class="dcard-photo" src="${this.lessonPhoto(L)}" alt="">` : this.fx(L.glyph || course.glyph)}</div>
      <div class="dcard-kicker">${course.name}</div>
      <h3>${L.title}</h3>
      <p>${L.idea || ''}</p>
    </div>`;
  },

  // ══ SPECIES LESSONS (photo pages, auto-built questions) ══════════════
  // Kept as they were until these are rewritten as authored lessons too.
  lessonPages(L) {
    if (L.kind === 'species') {
      return L.items.flatMap(id => {
        const a = this.find(id);
        if (!a) return [];
        const pages = [{ text: a.blurb, more: a.size, img: this.pic(a),
          name: a.name, refId: id, isIntro: true }];
        (a.facts || []).slice(0, 2).forEach(f => pages.push({
          text: f.text, more: f.more, img: this.pic(a), name: a.name,
          refId: id, cat: f.cat, factKind: f.kind }));
        return pages;
      });
    }
    const rows = L.course === 'body'
      ? BODY.filter(r => r.section === L.section)
      : this.topicCfg(L.course).rows.filter(r => r.section === L.section);
    return rows.map(r => ({ text: r.text, more: r.more, tryit: r.tryit,
      refId: r.id, cat: r.cat, factKind: r.kind }));
  },

  // One sentence at a time — a whole dense fact as a "question" is unreadable.
  sentences(text) { return text.match(/[^.!?]+[.!?]+/g) || [text]; },

  sentenceWith(text, index) {
    const sents = this.sentences(text);
    let pos = 0;
    for (const s of sents) {
      if (index < pos + s.length) return { sentence: s.trim(), offset: index - pos };
      pos += s.length;
    }
    return { sentence: sents[sents.length - 1].trim(), offset: 0 };
  },

  NUM_RE: /(\d[\d,]*\.?\d*)\s*(feet|foot|ft|inches|inch|in|miles?|mi|pounds?|lbs?|lb|kilograms?|kg|meters?|m|centimeters?|cm|millimeters?|mm|mph|km\/h|kilometers?|km|degrees?|°F|°C|%|years?|hours?|minutes?|seconds?|days?)\b/,

  genBlank(fact, siblings) {
    const m = this.NUM_RE.exec(fact.text);
    if (!m) return null;
    const { sentence, offset } = this.sentenceWith(fact.text, m.index);
    if (offset < 0 || offset > sentence.length) return null;
    const correct = m[1] + ' ' + m[2];
    const prompt = sentence.slice(0, offset) + '____' + sentence.slice(offset + m[0].length);
    const others = [];
    siblings.forEach(s => { if (s === fact) return;
      const mm = this.NUM_RE.exec(s.text); if (mm) others.push(mm[1] + ' ' + mm[2]); });
    let distractors = this.shuffle([...new Set(others)].filter(o => o !== correct)).slice(0, 2);
    while (distractors.length < 2) {
      const n = parseFloat(m[1].replace(/,/g, ''));
      let alt = Math.round(n * (0.4 + Math.random() * 1.8) * 10) / 10;
      if (alt === n || alt <= 0) alt = n + 1 + Math.floor(Math.random() * 5);
      const altStr = alt + ' ' + m[2];
      if (altStr !== correct && !distractors.includes(altStr)) distractors.push(altStr);
    }
    const options = this.shuffle([correct, ...distractors]);
    return { type: 'blank', prompt, options, answer: options.indexOf(correct), explain: fact.text };
  },

  genTF(fact) {
    const m = this.NUM_RE.exec(fact.text);
    if (!m) return null;
    const { sentence, offset } = this.sentenceWith(fact.text, m.index);
    if (offset < 0 || offset > sentence.length) return null;
    if (Math.random() < 0.5) return { type: 'tf', prompt: sentence, answer: 0, explain: '' };
    const n = parseFloat(m[1].replace(/,/g, ''));
    const factor = Math.random() < 0.5 ? 1.5 + Math.random() : 0.3 + Math.random() * 0.4;
    let alt = Math.round(n * factor * 10) / 10;
    if (alt === n) alt = n + 1;
    const prompt = sentence.slice(0, offset) + alt + ' ' + m[2] + sentence.slice(offset + m[0].length);
    return { type: 'tf', prompt, answer: 1, explain: fact.text };
  },

  genChoice(id, lessonItems) {
    const a = this.find(id);
    if (!a) return null;
    const names = this.nameForms(a);
    const prompt = this.redact(a.blurb, names);
    if (prompt === a.blurb) return null;
    const pool = lessonItems.map(i => this.find(i)).filter(x => x && x.id !== id);
    const distractors = this.shuffle(pool).slice(0, 3).map(x => x.name);
    while (distractors.length < 3) {
      const other = this.all()[Math.floor(Math.random() * this.all().length)];
      if (other.id !== id && !distractors.includes(other.name)) distractors.push(other.name);
    }
    const options = this.shuffle([a.name, ...distractors]);
    return { type: 'choice', prompt, options, answer: options.indexOf(a.name),
      explain: a.blurb, img: this.pic(a) };
  },

  buildQuestions(L, pages, n, preferChoice) {
    const facts = pages.filter(p => p.text && !p.isIntro);
    const qs = [];
    if (preferChoice && L.kind === 'species') {
      this.shuffle([...new Set(L.items)]).forEach(id => {
        if (qs.length >= Math.ceil(n / 2)) return;
        const q = this.genChoice(id, L.items);
        if (q) qs.push(q);
      });
    }
    this.shuffle(facts).forEach(f => {
      if (qs.length >= n) return;
      const q = Math.random() < 0.5 ? this.genBlank(f, facts) : this.genTF(f);
      if (q) qs.push(q);
    });
    let i = 0;
    while (qs.length < Math.min(n, 3) && i < facts.length) {
      qs.push({ type: 'tf', prompt: this.sentences(facts[i].text)[0].trim(), answer: 0, explain: '' });
      i++;
    }
    return this.shuffle(qs).slice(0, n);
  },
});
