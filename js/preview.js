// Preview mode: everything unlocked, nothing real touched.
//
//   https://wonder-lab-ecru.vercel.app/?preview=1     turn it on  (?preview=0 turns it off)
//   or, anywhere: open the Me tab and tap your name five times.
//
// Preview keeps its own progress under a separate storage key and never syncs
// to the cloud, so the child's real stars, cards and streak are not affected.
// Every game, every world's boss and the daily challenge are open, and a menu
// jumps straight to any screen.

(function () {
  const FLAG = 'wonderlab:previewmode';
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('preview') === '1') localStorage.setItem(FLAG, '1');
    if (q.get('preview') === '0') localStorage.removeItem(FLAG);
    if (localStorage.getItem(FLAG) === '1') {
      window.PREVIEW = true;
      Store.KEY = 'wonderlab:preview-v1';                 // separate progress
      if (typeof Sync !== 'undefined') {                  // and never to the cloud
        Sync.schedulePush = function () {};
        Sync.push = function () { return Promise.resolve(); };
      }
    }
  } catch (e) { /* storage blocked: stay in normal mode */ }
})();

Object.assign(App, {
  previewToggle(on) {
    try {
      if (on) localStorage.setItem('wonderlab:previewmode', '1');
      else localStorage.removeItem('wonderlab:previewmode');
    } catch (e) { /* ignore */ }
    location.replace(location.pathname + (on ? '?preview=1' : '?preview=0'));
  },
  // five taps on the name in the Me tab flips preview mode (for the iPad app, which has no URL bar)
  previewTap() {
    const now = Date.now();
    this._pvTaps = (this._pvTaps || []).filter(t => now - t < 3000).concat(now);
    if (this._pvTaps.length >= 5) { this._pvTaps = []; this.previewToggle(!window.PREVIEW); }
  },

  // all authored lessons count as finished for everything that asks "what have you done?"
  doneLessons() {
    return window.PREVIEW ? LESSONS.filter(l => l.pages)
      : LESSONS.filter(l => l.pages && this.lessonStars(l.id) > 0);
  },
  bossReady(courseId) {
    if (window.PREVIEW) return this.lessonsFor(courseId).length > 0;
    const ls = this.lessonsFor(courseId);
    return ls.length > 0 && ls.every(l => this.lessonStars(l.id) > 0);
  },

  previewMenu() {
    if (!window.PREVIEW) return this.previewToggle(true);
    this.resetSay();
    this.realm('journey');
    this.setWorld(null);
    AudioLib.stop();
    ['lessonOverlay', 'introSheet'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    this._game = null; this._lesson = null;
    const sample = id => LESSONS.find(l => l.id === id);
    const worlds = this.worlds();
    const gameBtn = (k, g) => `<button class="gtile" style="--t-acc:#5a8dff;--t-acc-d:#3b63d6" onclick="App.hubPlay('${k}')">
        ${this.fx(g.glyph)}<h3>${g.name}</h3><p>${g.blurb}</p></button>`;
    this.el(`
      ${this.hud()}
      <div class="tab-head"><h1>Preview</h1>
        <p>Everything is unlocked and nothing here changes the real progress. Tap anything.</p></div>

      <h2 class="pv-h">Games</h2>
      <div class="tile-grid">${Object.entries(this.GAMES).map(([k, g]) => gameBtn(k, g)).join('')}</div>

      <h2 class="pv-h">Boss battles</h2>
      <div class="tile-grid">${worlds.map(c => {
        const t = this.theme(c.id);
        return `<button class="gtile" style="--t-acc:${t.acc};--t-acc-d:${t.accD}" onclick="App.bossStart('${c.id}')">
          ${this.fx((typeof BOSS_ICON !== 'undefined' && BOSS_ICON[c.id]) || '👾')}
          <h3>${this.bossName(c.id)}</h3><p>${c.name} boss</p></button>`;
      }).join('')}</div>

      <h2 class="pv-h">Worlds</h2>
      <div class="world-picker" style="padding:0">${worlds.map(c => {
        const t = this.theme(c.id);
        return `<button class="wp-item" style="--t-top:${t.top};--t-mid:${t.mid}" onclick="App.setWorldId('${c.id}');App.go('journey')">
          ${this.fx(c.glyph)}<b>${c.name}</b><small>${this.lessonsFor(c.id).length} lessons</small></button>`;
      }).join('')}</div>

      <h2 class="pv-h">Screens and moments</h2>
      <div class="pv-grid">
        <button class="btn" onclick="App.lessonOpen('earth-rocks')">Play a full lesson</button>
        <button class="btn" onclick="App.pvResults(false)">Lesson complete</button>
        <button class="btn" onclick="App.pvResults(true)">Level up + gold card</button>
        <button class="btn" onclick="App.dailyStart()">Daily challenge</button>
        <button class="btn" onclick="App.pvBoss(true)">Boss won</button>
        <button class="btn" onclick="App.pvBoss(false)">Boss lost</button>
        <button class="btn" onclick="App.newSpecimen(App.find('sloth'))">New specimen</button>
        <button class="btn" onclick="App.lessonIntro('animals-mammals-3')">Lesson intro sheet</button>
        <button class="btn" onclick="App.go('collection')">Cards tab</button>
        <button class="btn" onclick="App.go('games')">Games tab</button>
        <button class="btn" onclick="App.go('notes')">Me tab</button>
        <button class="btn" onclick="App.go('guide')">Animal field guide</button>
      </div>

      <h2 class="pv-h">Preview progress</h2>
      <div class="pv-grid">
        <button class="btn ghost" onclick="App.pvFill()">Finish every lesson (3 stars)</button>
        <button class="btn ghost" onclick="App.pvReset()">Start preview over</button>
        <button class="btn ghost" onclick="App.previewToggle(false)">Leave preview</button>
      </div>
      <div style="height:30px"></div>`);
  },

  // a finished lesson, on demand (optionally one level away from levelling up)
  pvResults(levelUp) {
    const L = LESSONS.find(l => l.id === 'earth-rocks');
    this.lessonOpen(L.id);
    const s = this._lesson;
    if (levelUp) {
      const lv = this.levelInfo(Progress.p.xp || 0);
      Progress.p.xp = Math.max(0, lv.next - 8);
      s.xp0 = Progress.p.xp;
    }
    s.quiz = (L.quiz || []).slice();
    s.quizIdx = s.quiz.length; s.quizRight = s.quizFirst = s.quiz.length; s.gameAcc = 1;
    this.lessonFinish();
  },
  pvBoss(win) {
    this.bossStart('earth');
    const g = this._game; if (!g) return;
    g.right = win ? 8 : 3; g.hp = win ? 0 : 3; g.hearts = win ? 3 : 0;
    this.bossEnd();
  },
  pvFill() {
    Progress.p.lessons = Progress.p.lessons || {};
    Progress.p.cards = Progress.p.cards || {};
    LESSONS.forEach(l => {
      Progress.p.lessons[l.id] = { stars: 3, quizRight: 5, quizTotal: 5, at: Store.dayKey() };
      if (l.idea) Progress.p.cards[l.id] = { foil: true };
    });
    Progress.p.medals = Progress.p.medals || {};
    COURSES.forEach(c => { Progress.p.medals[c.id] = true; });
    Progress.p.xp = Math.max(Progress.p.xp || 0, 1500);
    Progress.commit();
    this.toast(`${this.fx('🎉')} Every lesson finished`);
    this.previewMenu();
  },
  pvReset() {
    Progress.p.lessons = {}; Progress.p.cards = {}; Progress.p.medals = {}; Progress.p.xp = 0;
    Progress.p.dayStreak = 1; Progress.p.daily = null; Progress.p.species = {};
    Progress.commit();
    this.toast('Preview progress cleared');
    this.previewMenu();
  },
});

// the little pill that is always there in preview mode
if (window.PREVIEW) {
  window.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('button');
    b.className = 'pv-pill'; b.textContent = 'Preview';
    b.onclick = () => App.previewMenu();
    document.body.appendChild(b);
  });
  // no welcome screen in preview: go straight in
  const _welcome = App.welcome;
  App.welcome = function () {
    Progress.create('Preview');
    Progress.p.xp = Progress.p.xp || 60;
    Progress.commit();
    this.go('journey');
  };
}
