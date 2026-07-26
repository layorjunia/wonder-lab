// Offline cache for Wonder Lab.
// Bump CACHE whenever app code changes so installed devices pick it up.
const CACHE = 'wonderlab-v1';
const SHELL = [
  '.', 'index.html', 'css/style.css', 'manifest.json',
  'js/schema.js', 'js/animals.js', 'js/body.js', 'js/store.js', 'js/app.js',
  'img/credits.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Photos never change once downloaded, and there are 180 of them — serve
  // from cache first so browsing the field guide is instant and works offline.
  if (url.pathname.includes('/img/') && /\.(jpg|jpeg|png)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)
      .then(res => { const c = res.clone();
                     caches.open(CACHE).then(k => k.put(e.request, c)); return res; })));
    return;
  }

  // App code is network-first so updates land. cache:'reload' matters: a plain
  // fetch here can be answered from the browser's own HTTP cache, which silently
  // keeps serving the old index.html after a deploy.
  e.respondWith(
    fetch(e.request, { cache: 'reload' })
      .then(res => { const c = res.clone();
                     caches.open(CACHE).then(k => k.put(e.request, c)); return res; })
      .catch(() => fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })))
  );
});
