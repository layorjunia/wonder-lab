# Wonder Lab — dinosaur entry brief

You are writing fact cards for **Wonder Lab**, a science app for a **9–10 year
old**. Every word ships to a child. Accuracy is the whole product.

## Who this is for

A homeschooling family that reads Genesis as history. Their account: God made
the land animals — dinosaurs among them — on **day six**, and the swimming and
flying creatures on **day five**, all in the same creation week. People and
dinosaurs were alive at the same time. Land kinds went aboard the **Ark**.
Dinosaurs died out afterwards, and are remembered in the **dragon** accounts,
carvings and stories that turn up across many cultures.

Write from inside that account. It is not a disclaimer bolted on the end and it
is not a sermon — it is simply the history these facts sit in.

## Hard rules — the build script rejects entries that break these

Text is scanned by regex. These words/phrases will fail the build:

* `evolution`, `evolved`, `natural selection`
* `millions of years`, `billions of years`, any `N million/billion years`
* `years ago` (in any form)
* era names: `Triassic`, `Jurassic` (except the film title *Jurassic Park*),
  `Cretaceous`, `Mesozoic`, `Paleozoic`, `Cenozoic`, `Permian`, `Ice Age`
* `mass extinction`, `extinction event`, `K-Pg`, `K-T`, `asteroid impact/strike/hit`
* `ancestor`, `descended`, `descendant`
* `prehistoric`, `primitive`
* `before humans/people/man existed/appeared/walked`

`dinosaur`, `fossil`, `bones`, `dug up`, `Ark`, `Flood`, `dragon` are all fine
and expected. Do **not** argue against evolution either — never mention it.
Don't put a date on anything, in either direction.

## Accuracy rules

* Every measurement is an **imperial** figure first. Metric in parentheses is
  fine: `40 ft (12 m)`.
* Where a number is an estimate from bone measurements, say so plainly:
  "measured from the bones", "worked out from the leg bones". Do not present a
  reconstructed weight as if someone put the animal on a scale.
* Prefer **specific, checkable** things over vague awe: a named specimen, a
  counted number of teeth, a measured skull, a real museum. "Sue, at the Field
  Museum in Chicago" beats "scientists have found".
* If a popular claim is disputed or has been overturned, **say the corrected
  version** — a myth-buster is a great card. Known traps, do not repeat these:
  - Stegosaurus did **not** have a "second brain" in its hips.
  - Brachiosaurus did **not** snorkel underwater using head-top nostrils.
  - *Jurassic Park*'s Dilophosaurus neck frill and venom spit are **invented**
    for the film; there is no evidence for either.
  - *Jurassic Park*'s "velociraptors" are the size of Deinonychus. The real
    Velociraptor was about turkey-sized.
  - Oviraptor was named "egg thief" by mistake — the eggs under it turned out
    to be **its own**; it was sitting on its nest.
  - T. rex arms were small but **thickly muscled**, not useless flaps.
  - Pteranodon, Quetzalcoatlus, Plesiosaurus, Mosasaurus and Ichthyosaurus are
    **not dinosaurs** — say so where it fits; it is a genuinely interesting fact.
* Never invent a specimen, museum, number or discovery. If you are not sure of
  a figure, use a rounder one you are sure of, or write a different fact.

## Output — one JSON array, nothing else

```json
[{
  "id": "tyrannosaurus",
  "name": "Tyrannosaurus rex",
  "group": "dinosaurs",
  "blurb": "One sentence. What it was, plainly.",
  "size": "A comparison a nine-year-old can picture, imperial first.",
  "homes": ["forest"],
  "stats": { "length": 40, "weight": 17000 },
  "wonder": "ONE quiet sentence — the designed-on-purpose beat. Never a sermon.",
  "facts": [ { "cat": "bones", "text": "...", "more": "optional deeper paragraph" } ]
}]
```

* `homes` — from `rainforest, ocean, desert, grassland, polar, mountain,
  forest, freshwater, cave, backyard`. Pick 1–2 matching the rock the remains
  came out of (a river floodplain → `freshwater`; a sand desert → `desert`).
* `stats` — only `length` (ft) and `weight` (lb). Omit either if genuinely
  unknown. **No lifespan, no speed** unless it comes from trackways, in which
  case use `speed` in mph. Numbers only, no units in the value.
* `facts` — **10 to 12 per species**, each `text` under 55 words.
  Categories, and how many of each:
  - `bones` ×2–3 — **what was actually dug up.** Named specimens, tooth and
    claw lengths, skull measurements, trackways, bone beds, how complete a
    skeleton is, which museum you can go and see it in.
  - `created` ×2 — the Genesis frame. Day six (land) or day five (sea/sky);
    alive at the same time as people; the Ark took land kinds, and God could
    send young ones so a 40-ft animal never had to fit as an adult; dragon
    accounts, carvings and stories from many cultures. Vary these across
    species — do not paste the same sentence 30 times.
  - the rest from: `size`, `build`, `defence`, `food`, `senses`, `speed`,
    `record`, `weird`, `babies`, `teamwork`, `home`, `copied`.
* `more` — optional, on maybe half the facts. One short paragraph that goes
  deeper for a kid who taps "read more".
* Tone: direct, specific, a bit dry-funny. Never "Wow!", never "Did you know?",
  never an exclamation mark unless the fact truly earns it.
