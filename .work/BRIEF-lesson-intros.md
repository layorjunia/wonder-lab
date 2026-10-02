# Wonder Lab — lesson teaching-intro + reorder brief

Wonder Lab just became a lesson-based app (journey map, one lesson at a
time, a quiz at the end — like Lamplight). The facts themselves were
written years ago for a DIFFERENT purpose: a shuffled browsable deck, where
every fact had to stand completely alone because a kid could land on any of
them in any order. That rule produced good standalone facts and a BAD
lesson: dropped into a fixed sequence, they read as disconnected trivia with
no throughline, because none of them were ever written to set up a concept
for the ones after it.

Real example of the problem, word for word, the current opening of the
Earthquakes lesson:

> Each whole step up the magnitude scale means the ground shakes ten times
> as far, and about 32 times as much energy comes out. So a magnitude 7 is
> not a bit worse than a 6. It would take roughly 32 sixes to add up to one
> seven.

That's a fact about how a scale works, used as the FIRST thing a child
reads — before anything has told her an earthquake even has a magnitude
scale, let alone why. It's not wrong, it's just the wrong place to start.

## Your job

For each lesson below (its full fact list is in the matching
`.work/lesson-batch-N.json` file), produce two things:

1. **`intro`** — a short teaching paragraph, 3 to 5 sentences, that goes
   BEFORE all of this lesson's facts and sets up what a child needs to
   already know to make sense of them. This is the one place in the whole
   app that's allowed to be genuinely introductory/connective rather than a
   standalone fact — its entire job is to prepare the reader for what
   follows, the way a teacher talks before handing out the worksheet.

2. **`order`** — the lesson's fact ids, reordered so they build: whatever
   defines or explains the core idea first, specific examples / records /
   odd details after. Don't invent a new order for the sake of it — if the
   existing order already makes sense, say so by returning it unchanged.
   Every id must appear exactly once; don't drop or duplicate any.

### Hard rules for the intro (same voice as the rest of the app)

- **Only use what the lesson's own facts already establish.** The intro
  sets up vocabulary and context for facts that follow — it may name a
  concept ("a magnitude scale measures how strong an earthquake is") but
  must never ASSERT a new fact, number, or claim that isn't already backed
  by one of the lesson's own facts. If you want to say why something
  matters, that reason has to come from a fact in the set. This is not a
  place to add general knowledge from outside the lesson.
- **Direct, specific, dry-funny — never "Wow!" or "Did you know?"** No fake
  enthusiasm, no rhetorical questions to the reader, no "Get ready to
  learn...". Write the way the facts themselves are written: declarative,
  concrete, occasionally wry.
- **No vague-object comparisons.** A number may be followed by a
  comparison, never replace one ("the ground can shake for over a minute"
  is fine; do not invent "about as long as a car ride").
- **Imperial first** if you cite any measurement, metric in parentheses —
  but you almost never need to cite a number in the intro; that's what the
  facts are for.
- **US spelling.**
- **No meta commentary.** Never mention Wonder Lab, lessons, quizzes, this
  app, or "in this lesson you will learn" — just teach the thing.
- **History sections (ancient/america/world) keep the evidence discipline**:
  if the intro touches on how old something is or how we know something,
  never state a BC/AD year as if it were measured. Ancient History
  specifically keeps the Bible's timeline as the spine (see the facts
  themselves for how they already handle this) — don't contradict that, and
  don't take a side the facts themselves don't already take.
- **Length: 3–5 sentences, roughly 40–70 words.** Short. This is a
  doorway, not another fact.

### Worked example (do it like this)

Lesson: `earth-quakes` (Earthquakes), given facts about the magnitude
scale, plate boundaries, and famous quakes.

```json
{
  "earth-quakes": {
    "intro": "An earthquake happens when two blocks of rock that have been
      locked together finally slip. Scientists measure how strong one is
      on a magnitude scale — but it isn't like a ruler, where each number
      is just one more than the last.",
    "order": ["quakes-3", "quakes-1", "quakes-2", "quakes-5", "quakes-4", "quakes-6"]
  }
}
```

(The real order and wording depend on the real facts in your batch — this
is only showing the shape and the register.)

## Output

One JSON file, `.work/rw/intros-batch-N.json` (N = your batch number),
shaped exactly like the worked example above but covering every lesson id
in your batch file. Every lesson in your batch must appear. Nothing else in
the output — no commentary, just the JSON object.
