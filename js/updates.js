// Updates — lets the native iPad app pull new content and code without a
// reinstall. Pattern copied from Lamplight (Bible App, Web/src/45-updates.js):
// each build is published to Firebase Hosting with a version.json listing
// every shipped file's build id and a short hash. The app compares that with
// its own version.json, copies forward whatever didn't change from the build
// it is already running, downloads only what did, and points Capacitor's web
// view at the new folder — all through Capacitor's OWN WebView and
// Filesystem plugins, no custom native code required.
//
// Runs only inside the native app. The Vercel-hosted PWA updates itself the
// ordinary way (a fresh page load gets the new files; sw.js's network-first
// app-shell fetch is what notices on a repeat visit).
const Updates = {
  // The Firebase Hosting site this build's OTA content is published to. Kept
  // a plain constant (like Lamplight's VOICE_BASE) — no reason to branch on
  // environment, since the native app always wants the same source.
  BASE: 'https://wonder-lab-ota.web.app/',

  native() {
    const C = window.Capacitor;
    return !!(C && C.isNativePlatform && C.isNativePlatform()
              && C.Plugins && C.Plugins.Filesystem && C.Plugins.WebView);
  },

  async fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },

  // Compares the running build's version.json (bundled at the app root —
  // whichever folder the web view is actually serving from right now) with
  // the one published at BASE. Returns null if already current, otherwise
  // {build, changed:[path...], bytes}.
  async check() {
    if (!this.native()) return null;
    const [cur, remote] = await Promise.all([
      this.fetchJSON('version.json').catch(() => null),
      this.fetchJSON(this.BASE + 'version.json?t=' + Date.now()).catch(() => null),
    ]);
    if (!remote || !cur || remote.build === cur.build) return null;
    // Never go backward: a fresh install from Xcode carries a newer build
    // than any OTA download in progress, and an older download still sitting
    // on disk from before that reinstall must not reappear and win.
    if (remote.build <= cur.build) return null;
    const changed = Object.keys(remote.files).filter(
      f => !cur.files[f] || cur.files[f].h !== remote.files[f].h);
    const bytes = changed.reduce((s, f) => s + (remote.files[f].n || 0), 0);
    return { build: remote.build, remote, cur, changed, bytes };
  },

  // Builds the new version on disk: unchanged files copied forward from the
  // build currently running (no re-download), changed files fetched fresh.
  // version.json is written LAST, so a folder without one is an unfinished
  // download and never gets applied.
  async download(diff, onProgress) {
    const { Filesystem } = window.Capacitor.Plugins;
    const DIR = 'NoCloud';
    const curDir = 'ionic_built_snapshots/' + diff.cur.build;
    const newDir = 'ionic_built_snapshots/' + diff.build;
    const changedSet = new Set(diff.changed);
    const all = Object.keys(diff.remote.files);

    for (const f of all) {
      const from = (newDir + '/' + f).split('/');
      const dirPath = from.slice(0, -1).join('/');
      try { await Filesystem.mkdir({ path: dirPath, directory: DIR, recursive: true }); }
      catch (e) { /* already exists */ }
    }

    let done = 0;
    for (const f of all) {
      if (changedSet.has(f)) {
        await Filesystem.downloadFile({
          url: this.BASE + f + '?v=' + diff.remote.files[f].h,
          path: newDir + '/' + f, directory: DIR,
        });
      } else {
        try {
          await Filesystem.copy({
            from: curDir + '/' + f, to: newDir + '/' + f,
            directory: DIR, toDirectory: DIR,
          });
        } catch (e) {
          // Not on disk to copy forward (first OTA ever, or a pruned old
          // snapshot) — fall back to downloading it like a changed file.
          await Filesystem.downloadFile({
            url: this.BASE + f + '?v=' + diff.remote.files[f].h,
            path: newDir + '/' + f, directory: DIR,
          });
        }
      }
      done++;
      if (onProgress) onProgress(done, all.length);
    }

    // Last, and only after every file above has actually landed.
    await Filesystem.writeFile({
      path: newDir + '/version.json', directory: DIR,
      data: JSON.stringify(diff.remote), encoding: 'utf8',
    });
    return newDir;
  },

  // Points the web view at the freshly downloaded build. The reload happens
  // immediately; persistServerBasePath (called on the NEXT boot, once we know
  // the new build actually started up rather than crash-looping) is what
  // makes it survive a native relaunch.
  async apply(newDir) {
    const { Filesystem, WebView } = window.Capacitor.Plugins;
    const { uri } = await Filesystem.getUri({ path: newDir, directory: 'NoCloud' });
    localStorage.setItem('wonderlab:ota-pending', uri);
    await WebView.setServerBasePath({ path: uri });
  },

  async tidy() {
    const { Filesystem, WebView } = window.Capacitor.Plugins;
    try {
      const { files } = await Filesystem.readdir({ path: 'ionic_built_snapshots', directory: 'NoCloud' });
      const { path: livePath } = await WebView.getServerBasePath();
      for (const f of files) {
        if (livePath && livePath.includes(f.name)) continue;
        try { await Filesystem.rmdir({ path: 'ionic_built_snapshots/' + f.name, directory: 'NoCloud', recursive: true }); }
        catch (e) { /* in use or already gone */ }
      }
    } catch (e) { /* nothing to tidy on a fresh install */ }
  },

  // Called once at boot. If a download from last session finished applying
  // and this IS that new build running successfully, persist it (so a native
  // relaunch keeps using it without this app.js even having to ask again)
  // and tidy old snapshots. Then, if auto-update is on, quietly check and
  // download in the background — never apply automatically, so a child is
  // never mid-card when the ground shifts under them.
  async boot(autoUpdate) {
    if (!this.native()) return;
    const { WebView } = window.Capacitor.Plugins;
    const pending = localStorage.getItem('wonderlab:ota-pending');
    if (pending) {
      try {
        const { path: liveBase } = await WebView.getServerBasePath();
        if (liveBase && pending.includes(liveBase.split('/').pop())) {
          await WebView.persistServerBasePath();
          localStorage.removeItem('wonderlab:ota-pending');
          localStorage.setItem('wonderlab:just-updated', '1');
          this.tidy();
        }
      } catch (e) { /* ignore — try again next boot */ }
    }
    if (autoUpdate) {
      setTimeout(() => this.checkAndDownload().catch(() => {}), 8000);
    }
  },

  // Download only — never applies. Used for the silent background check and
  // for a "Download update" settings button; applying is a separate explicit
  // step (see App.applyUpdate in js/app.js) so a reload never happens while a
  // child is mid-card.
  async checkAndDownload() {
    const diff = await this.check();
    if (!diff) return null;
    const dir = await this.download(diff);
    localStorage.setItem('wonderlab:ota-ready', JSON.stringify({ build: diff.build, dir }));
    return diff;
  },
};
