// Cloud sync — one account across every homeschool app.
//
// A child signs in once with their name plus four pictures and their progress
// follows them to any device and any app. The credentials are derived in
// js/firebase-config.js (HOMESCHOOL_AUTH) precisely so that derivation cannot
// drift apart between apps.
//
// Storage: profiles/{uid}/apps/wonder-lab
//   { name, progress, updatedAt: serverTimestamp, deviceId }
// Each app owns its own document, so two apps can never clobber each other
// while still sharing the login.
//
// LOCAL-FIRST, ALWAYS. Every save hits localStorage synchronously and the app
// is fully usable signed out, offline, or with Firebase down. The cloud is a
// backup and a second device, never the source of truth mid-session.

const Sync = {
  app: null, auth: null, db: null,
  status: 'off',          // off | loading | ready | error
  uid: null,
  _loadPromise: null,
  _unsub: null,
  _timer: null,
  _pushing: false,

  configured() {
    return typeof FIREBASE_CONFIG !== 'undefined' && !!FIREBASE_CONFIG
        && typeof HOMESCHOOL_AUTH !== 'undefined';
  },

  // A stable per-device id, so the realtime listener can ignore the echo of
  // this device's own writes instead of fighting itself.
  deviceId() {
    let id = localStorage.getItem('wonderlab:deviceId');
    if (!id) {
      id = 'd' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('wonderlab:deviceId', id);
    }
    return id;
  },

  // The SDK is ~300 KB and most sessions never sign in, so it loads on demand
  // rather than on boot.
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
      .then(() => Promise.all([load('firebase-auth-compat.js'),
                               load('firebase-firestore-compat.js')]))
      .then(() => {
        this.app = firebase.apps.length ? firebase.app()
                                        : firebase.initializeApp(FIREBASE_CONFIG);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        // Survives a closed tab and a cache eviction; also what lets writes
        // queue while offline and flush when the signal comes back.
        this.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        return this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .catch(() => {});
      })
      .then(() => { this.status = 'ready'; })
      .catch((e) => { this.status = 'error'; this._loadPromise = null; throw e; });
    return this._loadPromise;
  },

  doc(uid) {
    return this.db.collection('profiles').doc(uid)
      .collection('apps').doc('wonder-lab');
  },

  // ── auth ──
  async signIn(name, emojis) {
    await this.ensureLoaded();
    const email = HOMESCHOOL_AUTH.email(name);
    const pass = HOMESCHOOL_AUTH.password(emojis);
    try {
      const cred = await this.auth.signInWithEmailAndPassword(email, pass);
      this.uid = cred.user.uid;
    } catch (e) {
      // First time on this account: the same name + pictures creates it.
      // Any other failure is a real one and must surface.
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        try {
          const cred = await this.auth.createUserWithEmailAndPassword(email, pass);
          this.uid = cred.user.uid;
        } catch (e2) {
          throw new Error(this.explain(e2));
        }
      } else {
        throw new Error(this.explain(e));
      }
    }
    return this.uid;
  },

  async signOut() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this.uid = null;
    if (this.auth) await this.auth.signOut().catch(() => {});
  },

  explain(e) {
    const c = (e && e.code) || '';
    if (c.includes('network')) return "Can't reach the cloud. Check the wifi.";
    if (c.includes('email-already-in-use')) return 'That name is taken — check the pictures.';
    if (c.includes('wrong-password') || c.includes('invalid-credential'))
      return "Those pictures don't match that name.";
    if (c.includes('weak-password')) return 'Pick four pictures.';
    if (c.includes('too-many-requests')) return 'Too many tries — wait a minute.';
    return (e && e.message || 'Something went wrong.')
      .replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[^)]+\)\.?$/, '');
  },

  // ── data ──
  async push(profile) {
    if (!profile || !this.uid || this.status !== 'ready') return;
    this._pushing = true;
    try {
      await this.doc(this.uid).set({
        name: profile.name,
        progress: profile.p,
        deviceId: this.deviceId(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('cloud push failed', e);
    } finally {
      this._pushing = false;
    }
  },

  // Debounced so a burst of taps is one write, not twenty.
  schedulePush(profile) {
    if (!this.uid || this.status !== 'ready') return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(profile), 2000);
  },

  async pull() {
    if (!this.uid) return null;
    const snap = await this.doc(this.uid).get();
    return snap.exists ? snap.data() : null;
  },

  // Watch for writes from the child's OTHER device. Own writes echo back
  // through this listener too, which is what deviceId filters out — without
  // it the app would reload its own state on every save.
  watch(onRemote) {
    if (!this.uid || this._unsub) return;
    this._unsub = this.doc(this.uid).onSnapshot((snap) => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const d = snap.data();
      if (!d || d.deviceId === this.deviceId()) return;
      onRemote(d);
    }, () => { /* listener dropped; local play continues */ });
  },
};

// `const Sync` at script top level creates a lexical binding, NOT a property on
// window — so every `window.Sync && ...` guard in app.js and store.js silently
// evaluated false and cloud sync was dead code. Publish it explicitly.
window.Sync = Sync;

// A tab closed mid-debounce would otherwise lose the last few taps.
window.addEventListener('pagehide', () => {
  if (Sync._timer) clearTimeout(Sync._timer);
  if (Sync.uid && window.Progress && Progress.profile) Sync.push(Progress.profile);
});
