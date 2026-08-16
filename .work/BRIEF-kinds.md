# Marking how each animal fact is known

The 180 non-dinosaur animals are the only content in Wonder Lab with no
evidence marking. Dinosaurs, plants and Earth all carry it. Your job is to add
a `kind` to every fact for the species you are given — and to rephrase only the
handful that state a reasoned conclusion as though someone had watched it.

## THREE KINDS

* **`found`** — somebody actually observed or measured it. A timed sprint, a
  weighed animal, a counted clutch, a filmed behaviour, a tagged migration
  route, a dissected gut. If a person could go and see it happen, it is
  `found`.

* **`worked`** — reasoned from observation rather than watched. Why an animal
  does something. What a structure is "for". How a relationship benefits both
  sides. A lifespan nobody followed end to end. A population estimate. Anything
  inferred.

* **`record`** — from a written account rather than from the animal: who
  discovered it and when, what it was named and why, a historical event, a
  Genesis reference.

## THE BAR — read this twice, it is where the last pass went wrong

**Most of these facts are `found`, and that is correct.** A measured top speed,
a counted tooth row, a filmed hunt, a recorded dive depth — state them plainly
and mark them `found`. Do NOT hedge them. Do NOT add "scientists believe" to
something a person measured. Over-marking things as `worked` is a worse error
than the gap this pass exists to close: an app where every sentence sounds
uncertain teaches a child nothing and stops being trusted.

Reach for `worked` only when the sentence genuinely asserts something nobody
observed — a purpose, a cause, a motive, an estimate, a reconstruction.

Expect roughly: 70% `found`, 20% `worked`, 10% `record`. If your split is far
from that, you are probably over-hedging.

## REWRITING — the light touch

Change the wording ONLY when a `worked` fact is phrased as flat observation.
Then say the reasoning out loud in the app's own plain voice:

  good: "The best read is that…", "Worked out from the skull…",
        "Nobody has watched one do it; the shape is the argument."
  bad:  "Scientists believe…", "It is thought that…", "Experts say…"
        — vague appeals to authority that teach deference instead of thinking.

Leave every `found` and `record` fact's wording exactly as it is unless it
contains an outright error.

Never introduce: evolution, natural selection, millions/billions of years,
"years ago", era names, ancestor, descended, prehistoric, primitive, feather
(on a dinosaur — irrelevant here but the gate still checks).

## Output

One JSON array, nothing else. One object per fact, for EVERY fact in every
species you were given — including the ones you leave untouched.

```json
[{ "id": "cheetah", "index": 0, "kind": "found",
   "text": "unchanged unless it overstated certainty",
   "changed": false }]
```

`index` is the 0-based position in that species' `facts` array. Include `more`
only if you rewrote it. The count you return must equal the total number of
facts across the species you were assigned.
