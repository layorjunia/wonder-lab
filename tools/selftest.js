// Dev-only bot: plays every authored lesson end to end through the REAL player
// code (pages, wrong then right answers, every game kind the lesson can play,
// the quiz, the results) and reports anything that throws or renders empty.
//
// In the running app (e.g. http://localhost:8788/):
//   const s = await fetch('tools/selftest.js').then(r => r.text()); eval(s);
//   await SelfTest.runAll();            // all lessons
//   await SelfTest.runAll(['earth-rocks']);   // some
//
// It saves and restores the child's progress, mutes sound and speech, and
// compresses timers so 100+ lessons take about a minute.
window.SelfTest = {
  async runAll(only) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const problems = [], seen = { lessons: 0, pages: 0, checks: 0, games: {}, quizzes: 0 };
    const errs = [];
    const onerr = e => errs.push(String((e && (e.message || e.reason)) || e));
    window.addEventListener('error', onerr);
    window.addEventListener('unhandledrejection', onerr);
    const savedProgress = JSON.stringify(Progress.data);
    const realSetTimeout = window.setTimeout;
    const realSfx = Sfx.play, realSpeak = AudioLib.speakSeq, realStop = AudioLib.stop;
    window.setTimeout = (f, ms, ...a) => realSetTimeout(f, Math.min(ms || 0, 4), ...a);
    Sfx.play = () => {};
    AudioLib.speakSeq = () => Promise.resolve();
    AudioLib.stop = () => {};
    const lessons = LESSONS.filter(l => !only || only.includes(l.id));
    const tick = () => new Promise(r => realSetTimeout(r, 12));
    const mark = (L, msg) => problems.push(`${L.id}: ${msg}`);
    try {
      for (const L of lessons) {
        const before = errs.length;
        try {
          App.lessonOpen(L.id);
          const s = App._lesson;
          seen.lessons++;
          for (let i = 0; i < s.pages.length; i++) {
            s.idx = i; App.lessonRenderPage(); seen.pages++;
            const paper = document.getElementById('plPaper');
            if (!paper || paper.innerText.trim().length < 15) mark(L, `page ${i + 1} rendered empty`);
            const q = App.pageCheck(s.pages[i]);
            if (q) {
              seen.checks++;
              const opts = q.type === 'tf' ? 2 : (q.options || []).length;
              if (opts < 2 || q.answer < 0 || q.answer >= opts) mark(L, `page ${i + 1} check has a bad answer index`);
              App.lessonCheckAnswer(q.answer === 0 ? 1 : 0);
              App.lessonCheckAnswer(q.answer);
              if (!s._checkOK[i]) mark(L, `page ${i + 1} check could not be completed`);
              const nb = document.getElementById('lessonNextBtn');
              if (nb && nb.disabled) mark(L, `page ${i + 1} Next still locked after the right answer`);
            }
          }
          // every game this lesson can play
          for (const kind of App.gameKinds(L)) {
            seen.games[kind] = (seen.games[kind] || 0) + 1;
            App.gameStart(kind, [L], 'lesson');
            const g = App._game;
            if (!g || !g.total) { mark(L, `${kind} produced no rounds`); continue; }
            if (kind === 'sort') {
              g.items.forEach((it, k) => { App.gmSortPlace(k, 1 - it.bin); App.gmSortPlace(k, it.bin); });
              if (g.placed !== g.total) mark(L, `sort placed ${g.placed}/${g.total}`);
            } else if (kind === 'hilo') {
              for (let n = 0; n < g.total; n++) {
                const r = g.items[g.idx];
                const better = r.more ? (r.a.stats[r.stat] > r.b.stats[r.stat] ? 0 : 1) : (r.a.stats[r.stat] < r.b.stats[r.stat] ? 0 : 1);
                App.gmHiloPick(better); await tick(); await tick();
              }
            } else if (kind === 'drag') {
              g.items.forEach((_, k) => { App.gmDragPlace(k, (k + 1) % g.total); App.gmDragPlace(k, k); });
              if (g.placed !== g.total) mark(L, `drag placed ${g.placed}/${g.total}`);
            } else if (kind === 'pairs') {
              for (let n = 0; n < g.n; n++) {
                const a = g.cards.findIndex(c => c.side === 0 && c.i === g.cards.filter(x => x.side === 0)[n].i);
                const left = g.cards.findIndex((c, k) => c.side === 0 && !g.done[k]);
                const right = g.cards.findIndex((c, k) => c.side === 1 && c.i === g.cards[left].i);
                App.gmPairTap(left); App.gmPairTap(right);
              }
              if (Object.keys(g.done).length !== g.cards.length) mark(L, 'pairs not all matched');
            } else {
              let guard = 0;
              while (App._game === g && g.idx < g.total && guard++ < 12) {
                const r = g.items[g.idx], before = g.idx;
                if (kind === 'bubbles') {
                  const wrong = r.opts.findIndex(o => o !== r.name);
                  if (wrong >= 0) App.gmBubbleTap(wrong);
                  App.gmBubbleTap(r.opts.indexOf(r.name));
                } else if (kind === 'whoami') {
                  App.gmWhoTap(r.opts.findIndex(o => o.id === r.a.id));
                } else if (kind === 'rank') {
                  r.order.forEach(a => App.gmRankTap(a.id));
                } else if (kind === 'catch' || kind === 'sling' || kind === 'slice') {
                  const pick = { catch: 'gmCatchPick', sling: 'gmSlingPick', slice: 'gmSlicePick' }[kind];
                  await tick();                      // the round sets its pick handler after layout
                  const wrong = r.opts.findIndex((_, i) => i !== r.ans);
                  if (kind !== 'slice') App[pick](wrong);
                  App[pick](r.ans);
                }
                await tick(); await tick();
                if (App._game === g && g.idx === before) { mark(L, `${kind} stuck on round ${before + 1}`); break; }
              }
            }
            await tick();
          }
          // quiz
          App.lessonStartQuiz();
          const s2 = App._lesson;
          seen.quizzes++;
          if (!s2.quiz.length) mark(L, 'quiz is empty');
          let guard = 0;
          while (s2.quizIdx < s2.quiz.length && guard++ < 30) {
            const q = s2.quiz[s2.quizIdx];
            if (!document.querySelector('#lessonOverlay .answer')) { mark(L, `quiz ${s2.quizIdx + 1} shows no answers`); break; }
            App.lessonQuizAnswer(q.answer);
            App.lessonQuizContinue();
          }
          await tick();
          if (!document.querySelector('#lessonOverlay .rs')) mark(L, 'results screen did not render');
          if (L.idea && !document.querySelector('#lessonOverlay .dcard')) mark(L, 'no Discovery Card on results');
          App.lessonExit();
        } catch (e) {
          mark(L, 'threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
          try { App.lessonExit(); } catch (e2) { /* ignore */ }
        }
        if (errs.length > before) mark(L, 'uncaught error(s): ' + errs.slice(before).join(' / '));
      }
    } finally {
      window.setTimeout = realSetTimeout;
      Sfx.play = realSfx; AudioLib.speakSeq = realSpeak; AudioLib.stop = realStop;
      window.removeEventListener('error', onerr);
      window.removeEventListener('unhandledrejection', onerr);
      Progress.data = JSON.parse(savedProgress);
      Progress.profile = Progress.data.profiles[Progress.data.activeId];
      Store.save(Progress.data);
    }
    return { ok: problems.length === 0, seen, problems };
  },
};

// Games tab and Daily challenge, with a handful of lessons marked finished.
SelfTest.hub = async function () {
  const problems = [];
  const realSetTimeout = window.setTimeout;
  const realSfx = Sfx.play, realSpeak = AudioLib.speakSeq, realStop = AudioLib.stop;
  window.setTimeout = (f, ms, ...a) => realSetTimeout(f, Math.min(ms || 0, 4), ...a);
  Sfx.play = () => {}; AudioLib.speakSeq = () => Promise.resolve(); AudioLib.stop = () => {};
  const tick = () => new Promise(r => realSetTimeout(r, 20));
  const saved = JSON.stringify(Progress.data);
  const errs = [];
  const onerr = e => errs.push(String((e && (e.message || e.reason)) || e));
  window.addEventListener('error', onerr);
  try {
    Progress.p.lessons = Progress.p.lessons || {};
    LESSONS.filter(l => l.pages).slice(0, 10).concat(LESSONS.filter(l => l.kind === 'species' && l.pages).slice(0, 8))
      .forEach(l => { Progress.p.lessons[l.id] = { stars: 2, quizRight: 4, quizTotal: 5 }; });
    App.go('games'); await tick();
    if (!document.querySelector('.gtile') || !document.querySelector('.daily')) problems.push('games tab did not render tiles');
    for (const kind of Object.keys(App.GAMES)) {
      App.hubPlay(kind); await tick();
      const g = App._game;
      if (!g) { problems.push(`${kind}: hubPlay started nothing`); continue; }
      let guard = 0;
      while (App._game === g && g.idx < g.total && guard++ < 14) {
        const r = g.items ? g.items[g.idx] : null, before = g.idx;
        if (kind === 'pairs') {
          for (let n = 0; n < g.n; n++) {
            const left = g.cards.findIndex((c, k) => c.side === 0 && !g.done[k]);
            const right = g.cards.findIndex((c, k) => c.side === 1 && c.i === g.cards[left].i);
            App.gmPairTap(left); App.gmPairTap(right);
          }
          break;
        }
        if (kind === 'bubbles') App.gmBubbleTap(r.opts.indexOf(r.name));
        if (kind === 'whoami') App.gmWhoTap(r.opts.findIndex(o => o.id === r.a.id));
        if (kind === 'rank') r.order.forEach(a => App.gmRankTap(a.id));
        if (kind === 'catch' || kind === 'sling' || kind === 'slice') {
          await tick();
          App[{ catch: 'gmCatchPick', sling: 'gmSlingPick', slice: 'gmSlicePick' }[kind]](r.ans);
        }
        if (kind === 'hilo') {
          const better = r.more ? (r.a.stats[r.stat] > r.b.stats[r.stat] ? 0 : 1) : (r.a.stats[r.stat] < r.b.stats[r.stat] ? 0 : 1);
          App.gmHiloPick(better);
        }
        if (kind === 'drag') g.items.forEach((_, k) => App.gmDragPlace(k, k));
        if (kind === 'sort') {
          g.items.forEach((it, k) => App.gmSortPlace(k, it.bin));
          await tick(); await tick();
          break;
        }
        await tick(); await tick();
        if (App._game === g && g.idx === before) { problems.push(`${kind}: stuck on round ${before + 1}`); break; }
      }
      await tick(); await tick();
      if (!document.querySelector('#lessonOverlay .rs')) problems.push(`${kind}: no hub result screen`);
      App.gameExit(); await tick();
    }
    // a boss battle (all earth lessons marked done so it is ready)
    LESSONS.filter(l => l.course === 'earth').forEach(l => { Progress.p.lessons[l.id] = { stars: 3 }; });
    if (!App.bossReady('earth')) problems.push('boss not ready for earth');
    App.medalTap('earth'); await tick();
    const bg = App._game;
    if (!bg || bg.kind !== 'boss') problems.push('boss did not start');
    else {
      let guard = 0;
      while (App._game === bg && bg.hp > 0 && bg.hearts > 0 && guard++ < 14) {
        const r = bg.items[bg.idx];
        App.gmBossPick(r.ans); await tick(); await tick();
      }
      await tick(); await tick();
      if (!document.querySelector('#lessonOverlay .rs-medal')) problems.push('boss: no victory screen');
      if (!(Progress.p.medals || {}).earth) problems.push('boss: medal not awarded');
      App.bossQuit();
    }
    // daily challenge
    App.dailyStart(); await tick();
    const s = App._lesson;
    if (!s || !s.quiz) problems.push('daily did not start');
    else {
      let guard = 0;
      while (s.quizIdx < s.quiz.length && guard++ < 10) {
        App.lessonQuizAnswer(s.quiz[s.quizIdx].answer); App.lessonQuizContinue();
      }
      await tick();
      if (!document.querySelector('#lessonOverlay .rs')) problems.push('daily: no result screen');
      if (!App.dailyDone()) problems.push('daily: not recorded as done');
      App.dailyExit();
    }
    // the tabs
    for (const t of ['journey', 'games', 'collection', 'notes', 'guide', 'plants']) {
      try { App.go(t); await tick(); } catch (e) { problems.push(`tab ${t} threw: ${e.message}`); }
    }
  } catch (e) {
    problems.push('threw: ' + (e.stack || e));
  } finally {
    window.setTimeout = realSetTimeout; Sfx.play = realSfx; AudioLib.speakSeq = realSpeak; AudioLib.stop = realStop;
    window.removeEventListener('error', onerr);
    Progress.data = JSON.parse(saved); Progress.profile = Progress.data.profiles[Progress.data.activeId];
    Store.save(Progress.data);
  }
  if (errs.length) problems.push('uncaught: ' + errs.join(' / '));
  return { ok: problems.length === 0, problems };
};
