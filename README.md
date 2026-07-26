# 🔬 Wonder Lab

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
- Remaining subjects beyond biology.
