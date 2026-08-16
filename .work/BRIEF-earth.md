# Wonder Lab — Earth section brief

Fact cards for a **9–10 year old** about the planet itself. Not species —
topics. Same voice as the rest of the app: direct, specific, a bit dry-funny.
No "Wow!", no "Did you know?".

## Read this first: Earth is the hardest section in this app

Geology is where inference gets stated as fact more than anywhere else, and
where this family's reading of Genesis diverges most from the textbook. That
does not mean writing less — it means being scrupulous about **which kind of
claim each sentence is**. A measured lava temperature and a reconstructed
history of a canyon are not the same kind of statement, and the app must not
let the second borrow the authority of the first.

Get that right and this section is the most interesting one in the app.

## The family's frame

Genesis as history. Day one, light. Day two, the waters divided. Day three,
dry land appears and plants. Day four, sun, moon and stars. Later, a global
Flood that covered the earth, which is the event they understand to have
shaped much of what we see — canyons, sedimentary layers, the fossils in them.

Write from inside that account where it is relevant, in the `created` and
`flood` categories. Elsewhere just describe the earth.

## Hard rules — enforced by regex on shipped text

Banned everywhere:

* `evolution`, `evolved`, `natural selection`
* `millions of years`, `billions of years`, any `N million/billion years`
* `years ago` in any form
* era names: `Triassic`, `Jurassic` (except the film), `Cretaceous`,
  `Mesozoic`, `Paleozoic`, `Cenozoic`, `Permian`, `Ice Age`
* `ancestor`, `descended`, `descendant`
* `prehistoric`, `primitive`
* `before humans/people/man existed/appeared/walked`

**Do not put an age on the earth, on a rock, or on a layer — in either
direction.** Not "4.5 billion", not "six thousand". Describe what is there.

Do not argue against mainstream geology and do not argue for the Flood as a
debate. State the observable thing; where the Flood is the frame, mark it
`record` and say plainly that it comes from the written account.

## HOW WE KNOW — required on every fact, and load-bearing here

* **`found`** — measured or observed. Lava temperature, the depth of a canyon,
  the height of a wave, the number of active volcanoes, what a mineral scratches.
* **`worked`** — reasoned from what is observed. How a cave formed, what is in
  the core, how a mountain rose, why a layer looks the way it does. Nobody
  watched any of it. Say so, in plain voice: "Nobody has ever been below the
  crust — the layers are read off the way earthquake waves bend."
* **`record`** — from a written account: Genesis, or the history of the
  science (who first measured it, when, what they named it).

**Anything about the deep past is `worked` or `record`, never `found`.** The
rock is found. The story of how it got there is worked out. That distinction is
the single most important thing in this section.

Over-hedging is also a failure. A measured depth is a measured depth.

## Accuracy

* **Imperial first**, metric in brackets.
* Prefer specific checkable things: a named volcano, a real depth, a dated
  eruption a person recorded, a place a child could look up.
* Never invent a figure.
* Where a popular claim is wrong or oversimplified, correct it.

## Sections and how many facts each

Return one JSON array of fact objects. **12 facts per section, 8 sections, 96
facts total.** Sections (use these exact `section` values):

| section | covers |
|---|---|
| `rocks` | minerals, crystals, hardness, what rocks are made of, gemstones |
| `volcanoes` | eruptions, lava, magma, named volcanoes, geysers |
| `quakes` | earthquakes, plates, tsunamis, how shaking is measured |
| `water` | oceans, rivers, the water cycle, trenches, tides |
| `weather` | storms, lightning, clouds, snowflakes, records |
| `caves` | caves, canyons, sinkholes, stalactites |
| `ice` | glaciers, icebergs, the poles, permafrost |
| `sky` | the moon, sun, seasons, day and night, auroras, meteors |

## Output — one JSON array, nothing else

```json
[{
  "id": "rocks-1",
  "section": "rocks",
  "cat": "weird",
  "kind": "found",
  "text": "Under 55 words.",
  "more": "Optional deeper paragraph.",
  "tryit": "Optional: a 30-second thing to do with no equipment."
}]
```

* `cat` from: `size`, `build`, `record`, `weird`, `home`, `travel`, `speed`,
  `defence`, `gross`, `copied`, `teamwork`, `senses`, `tryit`, `created`.
* Include **one `created` fact per section** (8 total) placing that part of the
  earth in the Genesis account — day one/two/three/four as fits, or the Flood.
  Anchor each to something concrete in that section. Vary them.
* **`tryit` is valuable here** — scratching a mineral, watching a shadow move,
  counting seconds between lightning and thunder. Aim for 4–6 across the set.
* `id` must be `<section>-<n>`, numbered from 1 within each section.
