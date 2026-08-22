# Stand-alone brief — every fact must make sense on its own

Readers do NOT read a profile top to bottom. The daily deck deals one fact at
random, the games pull one fact, the sky shows one fact in a sheet, the
passport opens anywhere. A fact that says "that find", "the same trick",
"those pits", "she", or "the second one" — meaning something from an EARLIER
fact in the same profile — reads as nonsense on its own. Jacob's rule,
verbatim: **anytime it references something, it needs to say what it's
actually referencing.**

## The test

A fact's `text` must make complete sense to someone who has read ONLY:
1. the name of the subject (the animal / plant / section — it is printed on
   the card above the fact), and
2. this one fact.

Pronouns for the subject itself are FINE: "It", "They", "Its", "Their" on a
cheetah card mean the cheetah. Do not touch those.

NOT fine — fix these by naming the thing, briefly, inside the fact:
* a person introduced in another fact and then referred to as "she", "he",
  "Anning", "the farmer"
* a find, study, tunnel, tablet, cave, experiment, or event described in
  another fact and then called "that find", "the tablet", "the same cave"
* comparatives with a missing half: "the same trick", "this time", "again",
  "the other one", "the second", "even more", "another"
* sentence openers that continue a thought from elsewhere: "That is why…",
  "Which is why…", "So…", "And…", "But…", "Those two numbers…"

`more` must make sense given that fact's own `text` plus the subject. It may
lean on its own `text`; it may NOT lean on any other fact.

## How to fix

Add the referent in the fewest words that make the fact whole. Replace "that
find" with "the 1811 find of the first complete skull". Replace "she" with
"Mary Anning". Replace "the same trick" with "the trick of playing dead". If
the fact cannot stand alone without restating a whole other fact, restate the
minimum and cut the rest.

Keep every number, unit and claim exactly. Never add a fact that is not
already in the profile. Sentences ≤ 24 words, US spelling, no exclamation
marks, no meta commentary, no vague-object comparisons.

## Output

A JSON object mapping `key|text` or `key|more` to the rewritten string —
ONLY for facts you changed. Unchanged facts are omitted. Most facts will be
fine; expect to change roughly one in ten.
