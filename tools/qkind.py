#!/usr/bin/env python3
"""Which questions are really "remember this figure"?

Jacob (2026-10-14), shown "When each worker did one small step, how many pins could ten workers make in a
day?" with three invented answers: "these kinds of questions are not good". A child who understood the idea
still cannot reason to 48,000; the only way to answer is to have memorised the number, and the boss, the
games and the quiz ask it away from the page that gave it.

A question is "figure recall" when it asks for a quantity, time or date AND the right answer is a hard figure
(two or more digits, a decimal, a percent, a hundred/thousand/million word, or twenty/thirty/...). Small counts
(two, six, a third) are ideas a child can hold, so they stay. A prompt that carries its own dollar amounts is an
arithmetic problem, not recall, so it stays too.

build_lessons.py writes `fig: 1` onto these; js/games2.js (boss + games), js/lesson.js (end-of-lesson quiz) and
js/games.js (daily challenge) skip them, and a page still asks them right after the child has read the figure.
"""
import re

HARD = re.compile(
    r"\d{2,}|\d[.,]\d|percent|%|\b(hundred|hundreds|thousand|thousands|million|millions|billion|billions|dozen|dozens|"
    r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|"
    r"nineteen)\b", re.I)
ASKS = re.compile(
    r"\b(how (many|much|long|high|tall|old|far|fast|deep|wide|heavy|big|large|hot|cold|thick|often|loud|strong)|"
    r"what year|which year|in what year|what date|on what date|what percent|what share|what fraction|at what age|"
    r"about how|when did|what is the (length|height|weight|speed|age|distance|width|depth|size|temperature|number)|"
    r"what temperature|what size|for how)\b", re.I)


def is_figure_recall(prompt, right):
    p = (prompt or '').strip()
    if '$' in p:
        return False
    return bool(HARD.search(right or '')) and bool(ASKS.search(p))


def tag(q):
    """Set q['fig'] = 1 for a multiple-choice question that only tests remembering a figure."""
    try:
        right = q['options'][q['answer']]
    except (KeyError, IndexError, TypeError):
        return False
    if is_figure_recall(q.get('prompt', ''), right):
        q['fig'] = 1
        return True
    q.pop('fig', None)
    return False
