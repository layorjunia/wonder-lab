# Cloud sync and hosting

## One account, every app

A child types their name and taps four pictures. That becomes a Firebase Auth
email/password login, derived in `js/firebase-config.js`:

```js
HOMESCHOOL_AUTH.email('Lael')                  // lael@homeschool.family
HOMESCHOOL_AUTH.password(['🦖','🐙','🦋','🐝']) // 🦖🐙🦋🐝-homeschool-v1
```

**This derivation must be byte-identical in every homeschool app.** It is the
entire mechanism by which one login is shared. If two apps disagree, the same
child typing the same name and tapping the same four pictures gets a *different
Firebase user in each app*, their progress does not follow them, and nothing
errors — which is exactly the state this repo was in before:

| app | email domain | password salt |
|---|---|---|
| unicorn-reading-academy (before) | `@unicorn-academy.family` | `-URA1` |
| wonder-lab (before) | `@wonder-lab.family` | `-WL1` |
| **both (now)** | **`@homeschool.family`** | **`-homeschool-v1`** |

> **The reading app has not been changed yet.** Wonder Lab now uses the shared
> derivation; `unicorn-reading-academy/js/sync.js` still uses the old one. Until
> it is updated to match, the two apps still mint separate accounts.

Never change the salt once real accounts exist — it locks every child out of
their own data.

## Storage layout

```
profiles/{uid}/apps/wonder-lab
  { name, progress, deviceId, updatedAt: serverTimestamp }
```

One document per app under one uid, so two apps share a login without ever
overwriting each other's progress.

### Firestore rules

The `{document=**}` wildcard is required. Without it the per-app subdocuments
are unreachable and every write fails with a permission error.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Sync policy

* **Local first, always.** Every save hits `localStorage` synchronously. The app
  is fully usable signed out, offline, or with Firebase down.
* **On sign-in:** pull the cloud copy; it replaces local only if its
  `updatedAt` is newer. A child who played on the tablet this morning does not
  lose it by opening the laptop this afternoon.
* **On save:** debounced 2 s push, so a burst of taps is one write.
* **Realtime:** `onSnapshot` picks up writes from the child's other device.
  Own writes echo back through the same listener, which is what `deviceId`
  filters out — without it the app reloads its own state on every save.
* **On page hide:** flush any pending debounce, or the last few taps are lost.

## Hosting

Static site, no build step. Vercel serves the repo root as-is; `vercel.json`
only sets cache headers.

**Audio is the constraint.** The corpus is ~198 MB across ~4,750 files.
Vercel's documented limit on static file uploads is **100 MB on Hobby, 1 GB on
Pro** — so this fits on Pro and does not fit on Hobby. (That limit is documented
for CLI deploys; Git-connected projects clone in the build container, which may
behave differently, but do not bet a deploy on it.) The file count is fine
either way: the cap is 15,000.

### Why vercel.json looks sparse

JSON has no comments and Vercel's schema **rejects unknown keys**, including
the `"//"` convention — a deploy fails outright with "should NOT have
additional property". So the reasoning lives here instead:

* `/img/*` is immutable (filenames are species ids) — cached for a year.
* `/version.json` must never be cached, or the update self-heal can never
  detect a new build and every installed device stays pinned to the old one.
* `/sw.js` must never be stale, or the service worker cannot ship its own
  replacement.
* There is no `/audio/*` rule because the audio is not served from Vercel at
  all — `.vercelignore` excludes it and the app fetches it from Pages, which
  sets its own cache headers.

Nothing is precached — `sw.js` fetches clips lazily on first play — so the
corpus size is a hosting number, not a download. A child who presses Listen on
forty facts has fetched about 2 MB.
