# Comparison sweep — replace vague objects with real measurements

Jacob's rule, verbatim intent: "Why not just say the weight?" A bowling ball
is not a unit — bowling balls run 6 to 16 lb. The app must state the
measurement. A comparison may only FOLLOW a stated number, never replace it.

For every entry, rewrite `text` so that:

1. **Vague household/vehicle objects are removed**: bowling ball, washing
   machine, school bus, family car, grand piano, bag of sugar, refrigerator,
   and anything of that kind. Whether or not a number is present.
2. **The measurement is stated in imperial** (lb, ft, in), metric optional in
   brackets. Sources for numbers, in order:
   - a number already in the entry's `text`
   - the entry's `stats` object (weight is lb, length is ft, speed is mph)
   **NEVER invent a number.** If neither source has one, remove the
   comparison and keep the sentence grammatical WITHOUT adding any figure.
3. **Allowed to stay** (only if a real number is also present, or the
   reference is itself exact): ratios to the animal's own body ("twenty times
   its own body length"), standardized objects (a US quarter, a sheet of
   paper, a football field's 100 yards), and "about your size" style
   comparisons. When in doubt, cut the comparison.
4. Keep the app's voice: short sentences (≤24 words), US spelling, no
   exclamation marks, no meta commentary. Keep every OTHER fact in the
   sentence intact. Sentences must stay at a 9-year-old's reading level.

Output: a single JSON object mapping each input `key` to the rewritten text.
Every key exactly once. No commentary.
