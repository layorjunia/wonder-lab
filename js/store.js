// Progress, saved locally per profile.
//
// The collection and the memory system are deliberately the SAME mechanic, so
// the field guide cannot be filled in by mashing Next. A species moves:
//   unseen -> seen      (its card came up in the deck)
//   seen   -> known     (answered one question about it correctly)
//   known  -> mastered  (correct twice, on two DIFFERENT days)
// That last rule is the important one: mastery cannot be farmed in a single
// sitting, which is what turns this into a reason to come back tomorrow.

const Store = {
  KEY: 'wonderlab:v1',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* unreadable — start clean */ }
    return { profiles: {}, activeId: null };
  },

  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); }
    catch (e) { console.warn('save failed', e); }
  },

  newProfile(name) {
    return {
      id: 'p' + Math.random().toString(36).slice(2, 10),
      name,
      cloud: false, uid: null,
      p: {
        species: {},      // id -> { seen:1, right:n, days:[dayKey], state }
        whoa: [],         // ids of facts marked "Whoa!" — the kid's own journal
        notes: {},        // factKey -> their own words
        quiz: { asked: 0, right: 0, streak: 0, best: 0 },
        tried: {},        // body "Try It" experiments completed
        deck: { day: null, served: [], idx: 0 },
        dayStreak: 0, lastDay: null, bestStreak: 0,
        badges: [],
      },
      updatedAt: Date.now(),
    };
  },

  dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },
};

const Progress = {
  data: null, profile: null,

  init() {
    this.data = Store.load();
    const a = this.data.activeId && this.data.profiles[this.data.activeId];
    if (a) this.profile = a;
    return !!a;
  },

  use(id) {
    this.profile = this.data.profiles[id];
    this.data.activeId = id;
    this.touchDay();
    this.commit();
  },

  create(name) {
    const p = Store.newProfile(name);
    this.data.profiles[p.id] = p;
    this.data.activeId = p.id;
    this.profile = p;
    this.touchDay();
    this.commit();
    return p;
  },

  commit() {
    if (this.profile) this.profile.updatedAt = Date.now();
    Store.save(this.data);
    // Signed in is the only condition — Sync itself is a no-op otherwise, and
    // a separate per-profile `cloud` flag was one more thing to get out of step.
    if (window.Sync && Sync.uid && this.profile) Sync.schedulePush(this.profile);
  },

  get p() { return this.profile.p; },

  // ── daily streak ──
  touchDay() {
    const p = this.p, today = Store.dayKey();
    if (p.lastDay === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    p.dayStreak = (p.lastDay === Store.dayKey(y)) ? (p.dayStreak || 0) + 1 : 1;
    p.bestStreak = Math.max(p.bestStreak || 0, p.dayStreak);
    p.lastDay = today;
  },

  // ── species knowledge ──
  rec(id) {
    const p = this.p;
    if (!p.species[id]) p.species[id] = { seen: 0, right: 0, days: [], state: 'unseen' };
    return p.species[id];
  },

  markSeen(id) {
    const r = this.rec(id);
    r.seen++;
    if (r.state === 'unseen') r.state = 'seen';
    this.commit();
  },

  markRight(id) {
    const r = this.rec(id);
    const today = Store.dayKey();
    r.right++;
    if (!r.days.includes(today)) r.days.push(today);
    // mastery needs two correct answers on two different days
    if (r.right >= 2 && r.days.length >= 2) r.state = 'mastered';
    else if (r.state !== 'mastered') r.state = 'known';
    this.commit();
  },

  state(id) { return (this.p.species[id] || {}).state || 'unseen'; },

  counts() {
    const out = { unseen: 0, seen: 0, known: 0, mastered: 0 };
    ANIMALS.forEach(a => { out[this.state(a.id)]++; });
    return out;
  },

  // ── the kid's own journal ──
  factKey(animalId, i) { return animalId + '#' + i; },

  toggleWhoa(animalId, i) {
    const k = this.factKey(animalId, i);
    const p = this.p;
    const at = p.whoa.indexOf(k);
    if (at >= 0) p.whoa.splice(at, 1); else p.whoa.push(k);
    this.commit();
    return at < 0;
  },

  isWhoa(animalId, i) { return this.p.whoa.includes(this.factKey(animalId, i)); },

  recordQuiz(correct) {
    const q = this.p.quiz;
    q.asked++;
    if (correct) { q.right++; q.streak++; q.best = Math.max(q.best, q.streak); }
    else q.streak = 0;
    this.commit();
  },
};
