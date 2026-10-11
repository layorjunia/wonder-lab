# 🔬 Wonder Lab

A homeschool science and history app for a 9–10 year old, rebuilt in October 2026
(**Wonder Lab 2**) as a game: real authored lessons in colored worlds, a sprout
mascot called Pip, Sparks and levels, daily streaks, Discovery Cards, and four
games that are not quizzes.

**Live:** https://wonder-lab-ecru.vercel.app (audio from https://layorjunia.github.io/wonder-lab/)

## How it is built (2026-10)

| Piece | Where |
|---|---|
| The whole look | `css/lab.css` (loaded after `style.css`, which now only styles the older field-guide screens) |
| Journey map, lesson player, quiz, results | `js/lesson.js` |
| Games: Match Up, Bubble Pop, Who Am I?, Line Up; Games tab; daily challenge | `js/games.js` |
| Pip, world colors, HUD, levels, Fluent icons | `js/lab.js`, `js/fx.js`, `img/fx/` |
| Welcome, nav, Games / Cards / Me tabs | `js/tabs.js` |
| Lesson text (editable truth) | `.work/lessons-src/*.txt` → `tools/parse_lessons.py` → `tools/build_lessons.py` → `js/lessons.js` |
| Quality gate | `tools/check_lessons.py`, `tools/option_balance.py stats` |
| Voice | `tools/gen_audio.py` (Kokoro, one clip per string), `tools/check_norm.py`, `tools/audit_resolve.py` |
| Test without a browser pane | `node tools/ui_shot.mjs .work/qa/selftest.json` (all lessons, every game) and `hubtest.json` |

Lessons drafted by a local model are marked `# UNREVIEWED` above their `=== id` line until a
person has read them.

## The older description (before the rebuild)

A science app for a 9–10 year old. First subject: **biology** — animals and the
human body — built as thousands of short, true, surprising facts with real
photographs.

**Live:** https://layorjunia.github.io/wonder-lab/

## What's in it

| Tab | What it does |
|---|---|
| **Today** | A finite deck of ~20 fact cards, dealt fresh each day. Finite on purpose — an endless scroll trains skimming; a deck that runs out gives a clean stop and a reason to come back. |
| **Guide** | Every species, filterable by animal group or habitat. Unmet species stay in silhouette. |
| **Play** | Auto-generated quizzes and a Face-Off that compares any two animals' stats side by side. |
| **Body** | The human body, built around *Try It Now* — 30-second experiments on your own body with no equipment. |
| **Notes** | Everything the child tapped "Whoa!" on — their own collection. |

## How knowing something is tracked

The collection and the memory system are deliberately the same mechanic, so the
field guide cannot be filled in by mashing Next:

```
unseen  →  seen      its card came up in the deck
seen    →  known     answered one question about it correctly
known   →  mastered  correct twice, on two DIFFERENT days
```

That last rule is the important one — mastery cannot be farmed in one sitting.

## Content rules

Written to be affirmable by a working zoologist *and* consistent with the
family's reading of Genesis. In practice that means the facts are pure
observable biology — anatomy, behaviour, senses, speed, records — and:

- no evolution, common descent, or natural selection
- **no dates or ages in either direction** — not "millions of years", and not
  "6,000 years" either. Nothing is dated.
- no arguing *against* evolution either; the debate simply isn't in this app
- no non-avian dinosaurs (the available kids' material entangles them with
  disputed empirical claims)
- design language is welcome as ordinary description, and any Creator-framing
  lives in the separate one-line `wonder` field — never inside a fact, so every
  fact stands on its own as science

`tools/build_animals.py` enforces those rules by searching the shipped text.
Content that breaks them does not get built in.

## Rebuilding content

```bash
python3 tools/fetch_photos.py --species tools/species.json   # photos + licences
python3 tools/build_animals.py .work/entries-*.json          # validate + emit js/animals.js
python3 tools/review_photos.py                               # contact sheet to eyeball
```

## Writing and releasing lessons (2026-10)

All 131 lessons are authored (`.work/lessons-src/*.txt`, one `=== id` block each).

```bash
# write a lesson by hand into .work/lessons-draft/<id>.txt, then run every check on it
python3 tools/lint_draft.py <id>
python3 tools/promote_lessons.py <id>           # appends it to .work/lessons-src/<course>.txt
python3 tools/parse_lessons.py && python3 tools/check_lessons.py && python3 tools/build_lessons.py
.venv-tts/bin/python tools/check_norm.py && .venv-tts/bin/python tools/audit_resolve.py
bash tools/render_voice.sh af_heart audio/heart  # only the missing clips are rendered
```

Release (a `git push` does NOT deploy to Vercel any more: `vercel.json` turns Git deploys off,
because every push used to upload the whole repo and filled the free 10 GB deployment storage):

```bash
python3 tools/stamp_version.py
git add -A && git commit && git push origin main    # GitHub Pages serves audio/
bash tools/vercel_deploy.sh                          # size guard (max 100 MB) + ONE deploy + waits for the build id
bash ios-app/scripts/deploy-ota.sh                   # iPad over-the-air update (Firebase)
```

## Photos

All 180 photos come from Wikimedia under licences that permit redistribution
(public domain, CC0, CC BY, CC BY-SA). The fetcher **refuses** anything whose
licence it cannot positively identify, records the required attribution for
every image in `img/credits.json`, and the app shows the full credits list.

## Still to do

- Cloud sync (`js/sync.js`) is written and shares the reading app's login, but
  is not loaded yet: it needs the Firestore rule widened from
  `match /profiles/{uid}` to `match /profiles/{uid}/{document=**}` so each app
  can own a sub-document, plus a sign-in screen.
- Economics has no lessons yet (the world stays hidden until it has some).
- Remaining subjects beyond biology.
