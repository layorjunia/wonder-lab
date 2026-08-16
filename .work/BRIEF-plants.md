# Wonder Lab — plant entry brief

Fact cards for a **9–10 year old**. Every word ships to a child; accuracy is the
whole product. Same voice as the animal entries: direct, specific, a bit
dry-funny. Never "Wow!", never "Did you know?", no exclamation marks unless the
fact truly earns one.

## The family's frame

They read Genesis as history. Plants were made on **day three** — before the
sun, moon and stars on day four, and before any animal. Seed-bearing plants and
fruit trees are named specifically, each yielding seed "after its kind".

Write from inside that account where it is relevant. It is not a disclaimer
bolted on the end and it is not a sermon.

## Hard rules — the build script rejects entries that break these

Banned, by regex, in every shipped string:

* `evolution`, `evolved`, `natural selection`
* `millions of years`, `billions of years`, any `N million/billion years`
* `years ago` in any form
* era names: `Triassic`, `Jurassic` (except the film title), `Cretaceous`,
  `Mesozoic`, `Paleozoic`, `Cenozoic`, `Permian`, `Ice Age`
* `ancestor`, `descended`, `descendant`
* `prehistoric`, `primitive`
* `before humans/people/man existed/appeared/walked`

Do not argue against evolution either — never mention it. Do not date anything,
in either direction.

## HOW WE KNOW — required on every fact

Every fact carries a `kind`, and getting these right matters more than the
prose:

* **`found`** — directly observed. A measured height, a counted seed, a timed
  growth rate, a chemical someone extracted, something you could watch happen.
* **`worked out`** (`worked`) — reasoned from observation. Why a plant does
  something, what a structure is "for", how a relationship benefits both sides,
  anything inferred rather than watched.
* **`record`** — from a written account: Genesis, a historical record, or the
  history of the science (who discovered it, when, what they named it).

The test: could a person walk up and SEE the thing the sentence asserts? The
tallest measured coast redwood, yes — `found`. "The flower's shape evolved to
attract bees" — not only banned, it is `worked` reasoning even when phrased
legally as "the shape suits bees".

A `worked` fact must SAY it is reasoned, in plain voice: "The best read is
that…", "Measured from the trunk rings…", "Nobody has watched one do it; the
shape is the argument." NOT "scientists believe" — that teaches deference
instead of thinking.

**Over-hedging is also a failure.** A measured tree is a measured tree. If
every sentence sounds uncertain the child learns nothing.

## Accuracy

* **Imperial first**, metric in brackets: `379 ft (115 m)`.
* Prefer specific checkable things: a named tree, a counted number, a real
  place. "Hyperion, in Redwood National Park" beats "the tallest tree".
* Never invent a measurement, a record or a place.
* If a popular claim is wrong, say the corrected version — a myth-buster is a
  great card.
* **Fungi are not plants.** Where a fungus appears, say so plainly; it is one
  of the genuinely interesting facts about them.

## Output — one JSON array, nothing else

```json
[{
  "id": "giant-sequoia",
  "name": "Giant sequoia",
  "group": "trees",
  "blurb": "One sentence. What it is, plainly.",
  "size": "A comparison a nine-year-old can picture, imperial first.",
  "homes": ["forest"],
  "stats": { "height": 279, "life": 3000 },
  "wonder": "ONE quiet sentence — the made-on-purpose beat. Never a sermon.",
  "facts": [ { "cat": "size", "kind": "found", "text": "...", "more": "optional" } ]
}]
```

* `homes` — from: `rainforest, ocean, desert, grassland, polar, mountain,
  forest, freshwater, cave, backyard`.
* `stats` — only `height` (ft), `life` (years), `weight` (lb). Omit any that
  are genuinely unknown. Numbers only, no units in the value.
* `facts` — **10 to 12 per species**, `text` under 55 words.
  Categories: `size`, `build`, `food`, `defence`, `babies`, `record`, `weird`,
  `home`, `travel`, `teamwork`, `disguise`, `copied`, `gross`, `senses`,
  `speed`, `created`.
  - Include exactly **one or two `created`** facts — the day-three framing,
    anchored to something concrete about THIS plant. Vary them across species;
    do not paste the same sentence 90 times.
  - `copied` is a strong category for plants — burdock and Velcro, etc.
* `more` — optional, on about half. One short deeper paragraph.
