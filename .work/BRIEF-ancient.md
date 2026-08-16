# Wonder Lab — Ancient History brief

Cards for a **9–10 year old**. Same voice as the rest of the app: direct,
specific, dry-funny. No "Wow!", no "Did you know?".

## READ THIS FIRST — the chronology rule

Jacob's decision: **the Bible's timeline is the spine of this section.** Events
are placed on it, and where a conventional date differs, the card says so and
says where each number came from.

But the app's whole discipline is that a conclusion never gets to wear the
clothes of an observation — and **that cuts both ways.** So:

| What | Badge | Why |
|---|---|---|
| "Genesis 5 lists ten men and how long each lived" | `record` | It is written in the text. Go and read it. |
| "Adding those up puts the Flood about 1,650 years after creation" | `worked` | Somebody did the arithmetic. That is a calculation, not a verse. |
| "Ussher put creation at 4004 BC" | `worked` | Ussher's own reckoning, published 1650. Name him. |
| "The pyramid is usually dated to about 2560 BC" | `worked` | King-lists copied centuries later, plus carbon dates from mortar. Name the method. |
| "The Great Pyramid has about 2.3 million blocks" | `found` | Counted. It is standing there. |

**Never print a bare year as though it were read off the stone** — for either
chronology. If a card gives a year, the same card says how the year was
arrived at. That is the entire editorial point of this section, and it is the
same standard the dinosaur section applies to feathers.

Say it plainly, at a child's level:

> The Bible gives the years each man lived before his son was born, so you can
> add them up. James Ussher did that in 1650 and landed on 4004 BC for
> creation. Other people adding up the same kind of list from a different old
> copy of the text get a few hundred years' difference — the copies do not all
> carry the same numbers.

That last sentence matters. The Hebrew Masoretic text and the Greek Septuagint
give different figures in the genealogies. Pretending they agree would be the
same failure as pretending a knob on a bone is a feather.

## What this section is mostly made of

**Things you can still go and look at.** That is the strongest kind of card
here, and the `artifact` category exists for it:

* The Rosetta Stone, British Museum, room 4.
* The Code of Hammurabi, a 7 ft 4 in stone finger of rock in the Louvre with
  282 laws cut into it.
* The Tel Dan Stele — a broken basalt slab naming the "House of David".
* Hezekiah's tunnel in Jerusalem: 1,750 ft cut through solid rock, still full
  of water, and children walk through it today. The inscription describing the
  two digging teams meeting in the middle is a real object.
* The Antikythera mechanism, a corroded bronze gear-box pulled off a shipwreck.
* Pompeii. Roman concrete harbours that are still standing in seawater.
* Cuneiform tablets — hundreds of thousands of them, most never translated.

Prefer these over summaries of what happened. A child who knows the Rosetta
Stone is in a room in London has something to hold onto; a child told "the
Egyptians had writing" has nothing.

## Sections and counts

One JSON array. **`id` is `<section>-<n>`, numbered from 1 in each section.**

| section | covers |
|---|---|
| `beginning` | Genesis 1–11 as a document, the genealogies, how a timeline gets built from them, the oldest surviving copies |
| `flood` | The Flood account, the Ark's stated dimensions, flood stories in other cultures as written records, Babel, language families |
| `egypt` | Pyramids, hieroglyphs, mummies, the Nile, Karnak, Israel in Egypt |
| `mesopot` | Cuneiform, Ur, ziggurats, Hammurabi, the wheel, the Nineveh library |
| `israel` | Tel Dan, Hezekiah's tunnel, the Siloam inscription, Lachish, the Dead Sea Scrolls, the Cyrus Cylinder |
| `greece` | Parthenon, the Olympics, Archimedes, the Antikythera mechanism, the alphabet |
| `rome` | Roads, concrete, aqueducts, Pompeii, the Colosseum, Latin in English |
| `howknow` | How anyone dates anything: king-lists, carbon, tree rings, stratigraphy, manuscripts — and what each one assumes |

`howknow` is the most important section. It is where the two chronologies get
laid side by side with their methods showing, and it is what makes the rest of
the section honest rather than a set of assertions.

## Also banned, as everywhere in this app

`evolution`, `evolved`, `natural selection`, "millions of years", `prehistoric`,
`primitive`, `Stone Age`/`Bronze Age`/`Iron Age` **as dated eras** (the phrase
is fine as a description of what the tools were made of), `ancestor` in the
evolutionary sense. No "scientists believe" / "historians think" — say what the
reasoning IS.

## Accuracy

* **Imperial first**, metric in brackets.
* Every artifact card should name where the thing is now, if it survives.
* Never invent a figure or an inscription. If it cannot be verified, write a
  different card.
* Correct popular errors: the pyramids were not built by Israelite slaves,
  Roman concrete was not "lost", the Rosetta Stone is not a treaty.

## Output shape

```json
[{ "id": "egypt-1", "section": "egypt", "cat": "artifact", "kind": "found",
   "text": "Under 55 words.",
   "more": "Optional deeper paragraph.",
   "tryit": "Optional: something to actually go and do." }]
```

* `cat` from: artifact, built, writing, daily, when, people, howworks, record,
  weird, size, travel, teamwork, copied, tryit, created.
* `kind` is required on every card: `found` / `worked` / `record`.
* Aim for 6–8 `tryit` across the set — cubits with a tape measure, writing your
  name in hieroglyphs, a water clock, working out how a lever moved a block.
