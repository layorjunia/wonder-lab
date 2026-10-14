// Offline cache for Wonder Lab.
// Bump CACHE whenever app code changes so installed devices pick it up.
// Downloaded offline packs live here, unversioned, and survive every deploy.
// caches.match() below searches every cache, so nothing else has to know.
// The -v2 bump is the Kokoro re-record: the activate step below deletes every
// cache not named here, which is what clears the old Piper clips off every
// installed device. Offline.CACHE in js/audio.js must use the same name.
const OFFLINE_CACHE = 'wonderlab-offline-v2';
// Photos (and clips) never change once published, so they live in a cache that
// is NOT named after the build. Before this, every release threw every cached
// photo away and each device downloaded them all again from Vercel; with
// several releases a day that was most of the site's bandwidth.
const MEDIA_CACHE = 'wonderlab-media-v1';
const IS_MEDIA = /\/(img|audio)\/[^?]*\.(jpg|jpeg|png|svg|m4a|mp3)$/;
const CACHE = 'wonderlab-20261014-1007-2bffdb15';
const SHELL = [
  '.', 'index.html', 'css/style.css', 'css/lab.css', 'manifest.json',
  'css/fonts.css',
  'fonts/Baloo2-var-latin.woff2', 'fonts/Nunito-var-latin.woff2',
  // Self-hosted so the app has a voice offline too. ~380 KB, once.
  'fonts/Fraunces-600-latin.woff2', 'fonts/Fraunces-700-latin.woff2',
  'fonts/Inter-latin-1ab1ad55.woff2',
  'js/schema.js', 'js/store.js', 'js/audio.js', 'js/app.js',
  'js/sync.js', 'js/firebase-config.js', 'js/expeditions.js',
  // Every data file. Only animals and body were listed, so an offline
  // first-load quietly had no plants, no earth, no astronomy and no history —
  // the guards in app.js turn that into empty sections rather than an error,
  // which is worse: it looks like the app, minus most of it.
  'js/cutouts.js', 'js/animals.js', 'js/body.js', 'js/plants.js', 'js/earth.js', 'js/astro.js',
  'js/ancient.js', 'js/america.js', 'js/utah.js', 'js/world.js', 'js/micro.js', 'js/physical.js',
  'js/economics.js', 'js/lessons.js', 'js/lesson.js', 'js/updates.js',
  'js/fx.js', 'js/lab.js', 'js/games.js', 'js/games2.js', 'js/games3.js', 'js/games4.js', 'js/buddies.js', 'js/tabs.js', 'js/preview.js',
  'img/credits.json',
  // Precached so the very first Listen tap resolves against a real manifest
  // rather than null. The player also awaits its own fetch now, so this is
  // belt and braces — but it is cheap, and it is what makes the app work
  // offline at all.
  // Same-origin only when the app itself is on Pages. On Vercel the manifest
  // lives on the audio origin, so it is fetched (and cached) at runtime by the
  // cross-origin branch below rather than precached here — the player awaits
  // its own fetch, so the first Listen still resolves against a real manifest.
  // Only the default voice's manifest: the worker cannot know which voice the
  // profile chose, and the runtime branch below caches the other one on use.
  ...(location.origin.endsWith('github.io') ? ['audio/heart/manifest.json'] : []),
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(async ks => {
    const stale = ks.filter(k => k !== CACHE && k !== OFFLINE_CACHE && k !== MEDIA_CACHE);
    // Carry already-downloaded photos forward so the first release after this
    // change does not make every device fetch them again. Best effort only:
    // a failure here must never block the update.
    try {
      const media = await caches.open(MEDIA_CACHE);
      for (const k of stale) {
        if (!k.startsWith('wonderlab-')) continue;
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          if (!IS_MEDIA.test(new URL(req.url).pathname)) continue;
          if (await media.match(req)) continue;
          const res = await old.match(req);
          if (res && res.status === 200 && res.type !== 'opaque') await media.put(req, res);
        }
      }
    } catch (err) { /* ignore */ }
    // Keep the offline packs. Without this exclusion every deploy silently
    // deletes what the child deliberately downloaded for a car journey.
    await Promise.all(stale.map(k => caches.delete(k)));
    await self.clients.claim();
  }));
});

// The app is served from Vercel; the 194 MB of voice clips stay in the GitHub
// repo and are served by Pages. Those requests are CROSS-ORIGIN, so they have
// to be allowed through explicitly — the blanket same-origin bail below would
// otherwise skip every clip and offline playback would silently never work.
// Pages sends `access-control-allow-origin: *` — but that header only buys
// anything if the REQUEST is made in cors mode, and an <audio> element issues
// its request in `no-cors`. Passing that request straight to fetch() therefore
// yields an OPAQUE response, which Safari refuses to play:
//
//   TypeError: Response served by service worker is opaque
//   NotSupportedError: The operation is not supported.
//
// Every clip was silent on iPhone and iPad while working perfectly in desktop
// Chrome, which tolerates opaque media. The fix is to re-issue the request
// ourselves in cors mode (see corsFetch) so we get a real, readable, cacheable
// response. Never cache an opaque one — a cached opaque response fails exactly
// the same way, forever, on a device that is now offline-capable and wrong.
const AUDIO_ORIGIN = 'https://layorjunia.github.io';

function corsFetch(request) {
  return fetch(new Request(request.url, {
    mode: 'cors', credentials: 'omit', cache: 'default',
  }));
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const ourAudio = url.origin === AUDIO_ORIGIN && /\/audio\//.test(url.pathname);
  if (!sameOrigin && !ourAudio) return;

  // Immutable media — 240 photos and ~4,750 voice clips. Cache-first, filled
  // lazily on first use: the voice corpus is ~194 MB on the server and must
  // never be precached, but a clip already heard has to come back instantly
  // and has to work on a tablet with no signal.
  if (IS_MEDIA.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => {
      if (hit) return hit;
      const net = sameOrigin ? fetch(e.request) : corsFetch(e.request);
      return net.then((res) => {
        // 200 only. A 206 partial (Safari range-requests media) is not a whole
        // clip, and an opaque response is unplayable — caching either one
        // poisons the cache for good.
        if (res.status === 200 && res.type !== 'opaque') {
          const c = res.clone();
          caches.open(MEDIA_CACHE).then(k => k.put(e.request, c));
        }
        return res;
      // Last resort: hand back the untouched request rather than an error, so
      // a cors hiccup degrades to "the browser fetches it itself".
      }).catch(() => fetch(e.request));
    }));
    return;
  }

  // App code is network-first so updates land. cache:'no-cache' matters: a plain
  // fetch here can be answered from the browser's own HTTP cache, which silently
  // keeps serving the old index.html after a deploy. It revalidates every time,
  // but sends If-None-Match, so an unchanged file comes back as an empty 304.
  // (It used to be cache:'reload', which skips validators and re-downloaded all
  // ~3.7 MB of app code from Vercel on every single app open.)
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { const c = res.clone();
                     caches.open(CACHE).then(k => k.put(e.request, c)); return res; })
      .catch(() => fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })))
  );
});
