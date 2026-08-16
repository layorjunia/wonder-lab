# Rewrite brief — Wonder Lab reading level

You are rewriting fact cards for a **9–10 year old girl** so she can actually
read them. The facts are correct. **Do not change what they claim.** Change how
they are said.

## What is wrong with the current prose

It reads like a museum label written for an adult. Three specific faults:

1. **Sentences that run 30–50 words**, stacked with commas, dashes and
   subordinate clauses.
2. **Clever inversions** that only land if you already know the answer —
   *"named after a voyage that did not discover them"*.
3. **Proper nouns arriving before the thing they describe** — a pile of names
   with nothing to attach them to.

## The rules

* **One idea per sentence.** Aim for 12–18 words. Never exceed 24.
* **Lead with the concrete thing** she can see, hold, or picture. Names,
  places and dates come *after*, and only if they earn their place.
* **Keep the dry, direct, slightly funny voice.** This is not baby talk. No
  "Wow!", no "Did you know?", no exclamation marks, no talking down.
* **Keep every number, unit and measurement exactly as written**, including
  the imperial-first-with-metric-in-brackets style: `275 ft (83.8 m)`.
* **Keep every proper noun that carries a real fact** (a museum, a person who
  did the thing, a place you could visit). Cut names that are decoration.
* **American spelling.** color, meter, mold, armor, gray, defense.
* Prefer a full stop to a dash or a semicolon. Break, don't join.

## Hard bans — the card will be rejected by the build if it breaks these

* `evolution`, `evolved`, `natural selection`, `ancestor`, `descended`
* `millions of years`, `billions of years`, `N million years`, `years ago`
* geologic era names: Triassic, Jurassic, Cretaceous, Mesozoic, Ice Age…
* `prehistoric`, `primitive`
* `scientists believe`, `scientists think`, `it is thought`, `experts say` —
  say what the reasoning *is*, or say nothing
* **Meta commentary**: never mention "this app", "this section", "this card",
  or the colored badges. Write about the world, not about the interface.
* For dinosaurs only: `feather`, `quill`, `plumage`

## Output

Return **only** a JSON object mapping each input `key` to its rewritten text.
Every key in your input file must appear exactly once. No commentary.

```json
{
  "cheetah#3|more": "Rewritten text here.",
  "oak#11|text": "Rewritten text here."
}
```

## Worked example

Before (grade 18.8, one 42-word sentence):

> Himeji Castle in Japan is built of wood and white plaster on a stone base,
> and its interior is a deliberate maze — narrow twisting passages, dead ends
> and steep steps of uneven height, so an attacker inside cannot move quickly
> or safely.

After:

> Himeji Castle in Japan is wood and white plaster on a stone base. Inside, it
> is a deliberate maze. The passages are narrow and twisting, some end in dead
> ends, and no two steps are the same height. An attacker cannot move fast or
> safely.

Same facts. Same voice. Four sentences instead of one.
