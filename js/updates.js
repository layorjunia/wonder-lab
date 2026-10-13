// Over-the-air updates for the native iPad app. The app updates ITSELF: nobody
// taps anything, and a new lesson or fix reaches the iPads without a reinstall
// or a new link.
//
// How it works (the same mechanics as Lamplight's js/45-updates.js, which is
// proven on the family's iPads):
//   * deploy-ota.sh puts each build on Firebase Hosting (wonder-lab-ota.web.app)
//     with a version.json listing every shipped file and a short hash of it;
//   * the app compares that with the version.json it is running, copies the
//     files that did not change from the build it is running, downloads only
//     the rest into Library/NoCloud/ionic_built_snapshots/<build>, and points
//     Capacitor's web view at that folder;
//   * the switch happens at the next SAFE moment: at launch (before a screen is
//     shown), when the app goes to the background, or when the child is on a
//     top-level screen. Never in the middle of a lesson, game or quiz;
//   * a build that was switched to but did not come up is marked bad and never
//     offered again, so a broken build cannot loop.
//
// Runs only inside the native app. The Vercel-hosted web app updates itself the
// ordinary way (see App.checkForUpdate and sw.js).
const Updates = {
  BASE: 'https://wonder-lab-ota.web.app/',
  // Capacitor's own live-update location, under Library/ (not backed up to iCloud).
  DIR: 'NoCloud/ionic_built_snapshots',
  busy: false,
  _lastCheck: 0,
  _applyTimer: null,

  native() {
    const C = window.Capacitor;
    return !!(C && C.isNativePlatform && C.isNativePlatform()
              && C.Plugins && C.Plugins.Filesystem && C.Plugins.WebView);
  },
  fs() { return window.Capacitor.Plugins.Filesystem; },
  wv() { return window.Capacitor.Plugins.WebView; },

  async fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },

  // The version.json of the build running right now (bundled, or a snapshot).
  async current() {
    return this.fetchJSON('version.json').catch(() => ({ build: '', files: {} }));
  },

  // Asks the OTA site for its newest build. Returns null if there is nothing
  // new, otherwise {build, remote, cur, changed, bytes}.
  async check() {
    if (!this.native()) return null;
    const [cur, remote] = await Promise.all([
      this.current(),
      this.fetchJSON(this.BASE + 'version.json?t=' + Date.now()).catch(() => null),
    ]);
    if (!remote || !remote.build || !remote.files) return null;
    // Never go backward: a fresh install carries a newer build than an OTA
    // download still sitting on disk from before that reinstall.
    if (remote.build <= (cur.build || '')) return null;
    // A build that was applied but never came up is not offered again.
    if (remote.build === localStorage.getItem('wonderlab:ota-bad')) return null;
    const changed = Object.keys(remote.files).filter(
      f => f !== 'version.json' && !(cur.files && cur.files[f] && cur.files[f].h === remote.files[f].h));
    if (!changed.length) return null;
    const bytes = changed.reduce((s, f) => s + (remote.files[f].n || 0), 0);
    return { build: remote.build, remote, cur, changed, bytes };
  },

  // Builds the new version in its own folder: unchanged files are copied from
  // the running build, the rest are downloaded. version.json is written LAST,
  // so a folder without it is an unfinished download and is never applied.
  async download(diff) {
    const fs = this.fs();
    const R = diff.remote, cur = diff.cur;
    const dest = `${this.DIR}/${R.build}`;
    const base = (await this.wv().getServerBasePath()).path;
    const files = Object.keys(R.files).filter(f => f !== 'version.json');

    try { await fs.rmdir({ path: dest, directory: 'LIBRARY', recursive: true }); } catch (e) { /* none yet */ }
    const dirs = new Set(files.map(f => f.split('/').slice(0, -1).join('/')));
    for (const d of dirs) {
      await fs.mkdir({ path: d ? `${dest}/${d}` : dest, directory: 'LIBRARY', recursive: true }).catch(() => {});
    }
    for (const f of files) {
      if (cur.files && cur.files[f] && cur.files[f].h === R.files[f].h) {
        await fs.copy({ from: 'file://' + base + '/' + f, to: `${dest}/${f}`, toDirectory: 'LIBRARY' });
      } else {
        await fs.downloadFile({ url: `${this.BASE}${f}?v=${R.files[f].h}`,
                                path: `${dest}/${f}`, directory: 'LIBRARY', recursive: true });
      }
    }
    await fs.downloadFile({ url: `${this.BASE}version.json?t=${Date.now()}`,
                            path: `${dest}/version.json`, directory: 'LIBRARY' });
    return R.build;
  },

  async complete(build) {
    try { await this.fs().stat({ path: `${this.DIR}/${build}/version.json`, directory: 'LIBRARY' }); return true; }
    catch (e) { return false; }
  },

  // Switches the web view to a downloaded build. The web view reloads at once;
  // boot() then makes it permanent (persistServerBasePath) once it has come up.
  async apply(build) {
    const { uri } = await this.fs().getUri({ path: `${this.DIR}/${build}`, directory: 'LIBRARY' });
    localStorage.setItem('wonderlab:ota-applied', build);
    localStorage.removeItem('wonderlab:ota-ready');
    await this.wv().setServerBasePath({ path: decodeURI(uri.replace(/^file:\/\//, '')) });
  },

  // Removes older downloaded builds, keeping the one now in use.
  async tidy(keep) {
    try {
      const { files } = await this.fs().readdir({ path: this.DIR, directory: 'LIBRARY' });
      for (const f of files) {
        const name = f.name || f;
        if (name !== keep) {
          await this.fs().rmdir({ path: `${this.DIR}/${name}`, directory: 'LIBRARY', recursive: true }).catch(() => {});
        }
      }
    } catch (e) { /* nothing to tidy on a fresh install */ }
  },

  // ── automatic updates ─────────────────────────────────────────────────

  // Switch to a finished download if it is newer than what is running.
  // Returns true if the switch was started.
  async applyIfReady() {
    if (!this.native()) return false;
    const ready = localStorage.getItem('wonderlab:ota-ready');
    if (!ready) return false;
    const cur = await this.current();
    const base = ((await this.wv().getServerBasePath()).path) || '';
    if (ready <= (cur.build || '') || base.endsWith('/' + ready)
        || ready === localStorage.getItem('wonderlab:ota-bad')) {
      localStorage.removeItem('wonderlab:ota-ready');
      return false;
    }
    if (!(await this.complete(ready))) return false;        // still downloading
    await this.apply(ready);
    return true;
  },

  // True when swapping builds cannot interrupt anything: no lesson, game, quiz
  // or result screen is open, and the child is on a top-level tab.
  safeToApply() {
    if (document.getElementById('lessonOverlay') || document.getElementById('introSheet')) return false;
    const tab = (typeof App !== 'undefined') ? App.tab : '';
    return !tab || ['journey', 'games', 'collection', 'notes'].includes(tab);
  },

  scheduleApply() {
    if (this._applyTimer) return;
    this._applyTimer = setInterval(async () => {
      if (!this.safeToApply()) return;
      try {
        const started = await this.applyIfReady();
        if (started || !localStorage.getItem('wonderlab:ota-ready')) {
          clearInterval(this._applyTimer); this._applyTimer = null;
        }
      } catch (e) { /* try again on the next tick */ }
    }, 4000);
  },

  // Download only; applying is applyIfReady / scheduleApply.
  async checkAndDownload() {
    if (!this.native() || this.busy) return null;
    this.busy = true;
    try {
      const diff = await this.check();
      if (!diff) return null;
      const build = await this.download(diff);
      localStorage.setItem('wonderlab:ota-ready', build);
      return diff;
    } finally {
      this.busy = false;
    }
  },

  async checkAndApply() {
    this._lastCheck = Date.now();
    try {
      const diff = await this.checkAndDownload();
      if (diff || localStorage.getItem('wonderlab:ota-ready')) this.scheduleApply();
    } catch (e) { /* offline or interrupted: try again next time */ }
  },

  // Called once at boot (js/app.js init, before anything is on screen).
  async boot() {
    if (!this.native()) return;
    const base = ((await this.wv().getServerBasePath()).path) || '';
    const applied = localStorage.getItem('wonderlab:ota-applied');
    if (applied) {
      localStorage.removeItem('wonderlab:ota-applied');
      if (base.endsWith('/' + applied)) {
        // The new build is running: keep it for later launches, tidy old ones.
        await this.wv().persistServerBasePath();
        localStorage.setItem('wonderlab:just-updated', '1');
        this.tidy(applied);
      } else {
        // We switched to it but the shell is not serving it: it did not come up.
        localStorage.setItem('wonderlab:ota-bad', applied);
      }
    }

    // A download finished earlier: switch to it NOW, before the child sees a
    // screen, so launching the app is what updates it.
    if (await this.applyIfReady().catch(() => false)) return;
    if (!base.includes('ionic_built_snapshots')) this.tidy(null);

    setTimeout(() => this.checkAndApply(), 3000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.applyIfReady().catch(() => {});                // leaving the app: swap now
      } else if (Date.now() - this._lastCheck > 10 * 60 * 1000) {
        this.checkAndApply();
      }
    });
  },
};

// `const Updates` is a LEXICAL binding, not a property of window. Everything that
// asks `window.Updates && Updates.native()` therefore saw undefined, and the
// whole over-the-air path (boot check, download, apply, the Me-tab card) silently
// never ran on any iPad. Same trap as window.Sync. Do not remove this line.
window.Updates = Updates;
