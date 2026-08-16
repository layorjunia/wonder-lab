# Wonder Lab — Astronomy brief

Fact cards for a **9–10 year old**. Same voice as the rest of the app: direct,
specific, a bit dry-funny. No "Wow!", no "Did you know?", no exclamation marks
unless one is truly earned.

## READ THIS FIRST. Astronomy is where the app's whole discipline gets tested.

More than any other subject, astronomy is taught as a confident story built on
a thin layer of observation. Jacob's example, and it is exactly right:

> **Nobody has ever watched a star be born.**

The Orion Nebula is real. You can find it with binoculars on a winter night. It
is a glowing cloud of gas and dust and it is genuinely beautiful. What is *not*
observed is that stars are forming inside it. "Stellar nursery" is a label
people apply because of what they think is happening, not a thing anyone has
watched happen.

Write the cloud. Write that you can go and see it. Then say plainly that people
call it a nursery because they think stars form there, and that nobody has
watched one form. **That card is better than the myth**, and it is the model
for this whole section.

## The three buckets

**`found` — somebody actually looked or measured.** This is most of astronomy
and it is astonishing:
* planet diameters, orbital periods, rotation periods, moon counts
* what a spacecraft photographed and measured — Voyager, Cassini, New Horizons,
  Juno, Perseverance, Parker, JWST
* Apollo samples: 842 lb of moon rock people have held and cut open
* sunspot cycles, counted since Galileo
* the Great Red Spot measurably shrinking over the years people have watched it
* meteorites you can weigh, cut and photograph
* eclipses and transits predicted in advance and then observed
* the speed of light, measured
* parallax to nearby stars — actual geometry, actual angles

**`worked` — reasoned from what was observed, and it must SAY so.**
* what is inside a planet, worked out from its density and how it pulls
* what is inside the sun
* exoplanet sizes, worked out from a dip in brightness
* black holes, worked out from stars orbiting something they cannot see
* distances beyond parallax, worked out from how bright something looks
  compared to how bright it is assumed to be

Say the reasoning in plain voice: "Nobody has been inside; the figure comes
from how it pulls on its moons." Never "scientists believe".

**`record` — from a written account:** who discovered what and when, what it
was named and why, Genesis, a historical observation someone wrote down.

## DO NOT WRITE THESE AT ALL

* stars being born, forming, collapsing, igniting — as things that happen
* "stellar nursery" stated as what a nebula IS
* star life cycles, main sequence, red giant, what the sun will become
* supernovae as a stage in a star's life (a supernova people *observed* — 1054,
  1987A — is fine and is `found`)
* how planets or moons formed
* the age of the universe, of a star, of anything
* the expansion history of the universe, cosmic background as an origin story
* black hole interiors

## Distances — the specific rule

* **Inside the solar system:** give distances plainly, `found`. They are
  measured by radar and by spacecraft that flew there.
* **Nearby stars:** parallax is real geometry. Give the distance, mark `found`,
  and it is worth one card explaining how the trick works — it is the same
  thing your two eyes do.
* **Beyond parallax:** give the distance, mark `worked`, and say the figure
  comes from comparing how bright a thing looks with how bright it is taken to
  be.
* **Never narrate light-travel time** for anything outside the solar system. Do
  not write "the light left it a million years ago". Inside the solar system it
  is fine and good — sunlight taking 8 minutes 20 seconds is measured.
* A light-year may be described as a distance, the way a mile is a distance.

## Also banned, as everywhere in this app

`evolution`, `evolved`, `natural selection`, "millions/billions of years", any
`N million years`, `years ago`, era names, `ancestor`, `descended`,
`prehistoric`, `primitive`. Do not date anything in either direction.

## Accuracy

* **Imperial first**, metric in brackets. Astronomical units and light-years
  may stand alone.
* Prefer the specific and checkable: a named spacecraft, a real date, a
  measured diameter, a thing a child could look up or look at.
* Never invent a figure. If you cannot verify it, write a different fact —
  but do not drop a fact merely because a search budget is thin. Ordinary
  measurable things are the point of this section.
* Correct popular errors where they exist — the Great Wall is not visible from
  space, the sun is not "burning", Mercury is not the hottest planet, the
  asteroid belt is nearly empty rather than crowded.

## Sections and counts

One JSON array. **14 facts per section, 8 sections, 112 facts.**

| section | covers |
|---|---|
| `sun` | our star as an observed object: size, sunspots, flares, eclipses, safety |
| `moon` | phases, libration, Apollo, far side, craters, moonquakes |
| `rocky` | Mercury, Venus, Earth from space, Mars, rovers |
| `giants` | Jupiter, Saturn, Uranus, Neptune, rings, big moons |
| `smallstuff` | asteroids, comets, meteors, meteorites, dwarf planets |
| `stars` | what stars look like, colour, brightness, parallax, constellations, named observations |
| `deepsky` | nebulae, star clusters, galaxies, the Milky Way as seen |
| `looking` | telescopes, observatories, spacecraft, JWST and Hubble, how to observe |

## Output shape

```json
[{ "id": "sun-1", "section": "sun", "cat": "size", "kind": "found",
   "text": "Under 55 words.",
   "more": "Optional deeper paragraph.",
   "tryit": "Optional: something to actually go and do tonight." }]
```

* `cat` from: size, build, record, weird, home, travel, speed, senses, gross,
  copied, teamwork, tryit, created.
* **One `created` fact per section (8 total).** Day four is the sun, moon and
  stars, set for signs and seasons and days and years. Anchor each to something
  concrete in that section, and vary them.
* **`tryit` is gold here** — find the moon in daylight, spot Jupiter's moons
  with binoculars, watch a sunset shadow, find Orion. Aim for 6–8 across the
  set.
* `id` is `<section>-<n>`, numbered from 1 within each section.
