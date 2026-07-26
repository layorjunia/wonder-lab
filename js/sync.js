// Cloud sync — shares ONE account system with the other homeschool apps.
// A child signs in once with their name plus four picture-passwords and their
// progress in every app follows them. Each app stores its own document under
// profiles/{uid}/apps/{appId}, so two apps can never clobber each other.
//
// See ../unicorn-reading-academy/SETUP.md for the Firebase project details.

// ── Firebase (loaded on demand, only if configured) ──
const Sync = {
  app: null, auth: null, db: null,
  status: 'off',   // off | loading | ready | error
  _loadPromise: null,

  configured() { return typeof FIREBASE_CONFIG !== 'undefined' && !!FIREBASE_CONFIG; },

  ensureLoaded() {
    if (!this.configured()) return Promise.reject(new Error('not-configured'));
    if (this.status === 'ready') return Promise.resolve();
    if (this._loadPromise) return this._loadPromise;
    this.status = 'loading';
    const base = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const load = (src) => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = base + src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    this._loadPromise = load('firebase-app-compat.js')
      .then(() => Promise.all([load('firebase-auth-compat.js'), load('firebase-firestore-compat.js')]))
      .then(() => {
        this.app = firebase.initializeApp(FIREBASE_CONFIG);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.status = 'ready';
      })
      .catch((e) => { this.status = 'error'; this._loadPromise = null; throw e; });
    return this._loadPromise;
  },

  // Kid login: name + emoji picture password → synthetic email/password.
  _email(name) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reader';
    return slug + '@wonder-lab.family';
  },
  _password(emojis) { return emojis.join('') + '-WL1'; },

  async signUp(name, emojis) {
    await this.ensureLoaded();
    const cred = await this.auth.createUserWithEmailAndPassword(this._email(name), this._password(emojis));
    return cred.user.uid;
  },

  async signIn(name, emojis) {
    await this.ensureLoaded();
    const cred = await this.auth.signInWithEmailAndPassword(this._email(name), this._password(emojis));
    return cred.user.uid;
  },

  async push(profile) {
    if (!profile.cloud || !profile.uid || this.status !== 'ready') return;
    try {
      // Each app writes its own document so the two apps never overwrite
      // each other's progress, while still sharing one login.
      await this.db.collection('profiles').doc(profile.uid)
        .collection('apps').doc('wonder-lab').set({
          name: profile.name,
          progress: profile.p,
          updatedAt: profile.updatedAt
        });
    } catch (e) { console.warn('cloud push failed', e); }
  },

  async pull(uid) {
    await this.ensureLoaded();
    const snap = await this.db.collection('profiles').doc(uid)
      .collection('apps').doc('wonder-lab').get();
    return snap.exists ? snap.data() : null;
  },

  // Merge cloud data into a local profile if cloud copy is newer.
  mergeInto(profile, cloudData) {
    if (cloudData && cloudData.updatedAt > profile.updatedAt) {
      profile.p = cloudData.progress;
      profile.updatedAt = cloudData.updatedAt;
      return true;
    }
    return false;
  },

  // Debounced auto-push
  _timer: null,
  schedulePush(profile) {
    if (!profile.cloud || this.status !== 'ready') return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(profile), 4000);
  }
};

// Flush pending sync when leaving the page
window.addEventListener('pagehide', () => {
  if (Sync._timer) { clearTimeout(Sync._timer); }
  if (window.Progress && Progress.profile && Progress.profile.cloud) Sync.push(Progress.profile);
});
