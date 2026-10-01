# Wonder Lab — Economics brief

Cards for a **9–10 year old**. Same voice as the rest of the app: direct,
specific, dry-funny. No "Wow!", no "Did you know?".

## READ THIS FIRST — stay out of the argument

Economics is the one subject in this app where adults disagree loudly about
conclusions. This section is not where that argument happens. Write the
**mechanics everyone agrees on**, not a position on any live debate:

* Say "a business sells something for more than it costs to make, and keeps
  the difference" — not whether that's fair.
* Say "a government collects taxes to pay for roads, schools and the
  military" — not whether taxes should be higher or lower.
* Say "prices tend to rise when something is scarce and a lot of people want
  it" — not whether that's good or bad.
* **Never** use the words capitalism, socialism, communism, Marxism, or name
  a political party, a sitting politician, or a specific country's current
  policy. A 9-year-old doesn't need the -ism; she needs to understand why a
  lemonade stand prices a cup at 50 cents.
* No investment advice, no stock tips, no "how to get rich." If a card is
  close to that line, it's the wrong card.
* Historical facts (a real invention, a real company, a real trade route, a
  real currency) are fine and good — treat them exactly like American/World
  History: `found` for something measurable or still standing, `worked` for
  a reasoned figure, `record` for a written account. Never editorialize about
  whether a historical economic policy was wise.

This is a mechanics section, like Physical Science: how a lever works, not
whether building the bridge was a good idea. Same posture here.

## Two atoms

Nearly every card in this section is one of two things:

1. **A trade** — two people exchange something because both think they come
   out ahead. (`trade` category)
2. **A choice** — you can't have both, so you pick. (`choices` category)

Keep coming back to these. A kid who gets "both sides think they're better
off" and "picking one thing means not picking another" has the whole subject;
everything else (money, business, supply and demand) is built out of those
two ideas.

## Sections and counts

One JSON array. **`id` is `<section>-<n>`, numbered from 1 in each section.**
Aim for roughly 40–55 cards per section, matching the other five new
subjects (~45 average).

| section | covers |
|---|---|
| `money` | What money actually solves (barter's problem: you have apples, I want fish, not apples), coins vs. bills vs. a bank balance, why money has to be hard to fake, the history of specific currencies (cowrie shells, the first paper money in China, the US dollar, a real exchange rate) |
| `trade` | Buying and selling, a market as a meeting place, why both sides of a trade think they won, trade between strangers who'll never meet again, bartering vs. money, real historical markets (the Silk Road, a farmers' market, an auction) |
| `work` | What a job is (trading time and skill for pay), different kinds of work (making things, growing things, fixing things, helping people), why some jobs pay more (training, danger, how few people can do it), a real historical job that doesn't exist anymore |
| `business` | What a business actually does (sell something for more than it costs, keep the difference as profit), starting small (a lemonade stand, a paper route), a real entrepreneur and what they actually built, factories and the assembly line, a business that failed and why |
| `choices` | Scarcity in kid terms (there's only so much of everything), opportunity cost without the jargon ("choosing the roller coaster means not riding the carousel right now"), wants vs. needs, a real historical shortage |
| `saving` | A piggy bank vs. a real bank, why a bank pays you to keep your money there, saving up for something instead of buying right away, a real historical way people saved (burying coins, livestock as savings) |
| `supply` | Supply and demand in plain language (more of something usually means a lower price; more people wanting it usually means a higher price), a real historical price swing (a gold rush, a shortage after a storm), why a baseball card or a toy becomes valuable |
| `world` | Trade between countries, imports and exports in kid terms, a real historical trade route, why a banana in a Michigan grocery store traveled thousands of miles, different countries' money |

## Also banned, as everywhere in this app

Evolution/deep-time language doesn't apply here, but everything else does:
no meta commentary about the app itself, no vague-object comparisons (a
number may be followed by a comparison, never replace it — "a candy bar costs
about $1.50, roughly what a bag of chips costs" is fine; "a candy bar costs
about as much as a video game" is not), US spelling, imperial units where a
physical thing is measured, every fact stands alone (if a card mentions "that
same trade route" or "the business from the last card," say what it actually
is — a reader may land on this card first).

## Accuracy

* Prices and figures are approximate and should say so ("about") unless
  pinned to a specific receipt, year, or measured object.
* Every named invention, company, or trade route must be real and checkable.
* A historical dollar amount should say what year it's from — a dollar in
  1900 bought something very different from a dollar today, and a card that
  doesn't say so teaches a wrong intuition about money.

## Output shape

```json
[{ "id": "money-1", "section": "money", "cat": "howworks", "kind": "worked",
   "text": "Under 55 words.",
   "more": "Optional deeper paragraph.",
   "tryit": "Optional: something to actually go and do." }]
```

* `cat` from: trade, choices, saving, work, built, daily, artifact, when,
  people, howworks, record, weird, size, teamwork, copied, tryit.
* `kind` is required on every card: `found` / `worked` / `record`.
* Aim for 6–8 `tryit` across the set — price something at a real store and
  compare, figure out the profit on a lemonade stand, track what a family
  actually spends money on in a week, compare two job postings.
