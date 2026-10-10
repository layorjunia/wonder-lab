#!/usr/bin/env python3
"""Draft Wonder Lab lessons ONE PAGE AT A TIME with a local ollama model.

  python3 tools/draft_pages.py --ids earth-volcanoes
  python3 tools/draft_pages.py --course earth
  python3 tools/draft_pages.py --all --model qwen2.5:14b

Why page by page: asked for a whole lesson in one go, the model ignores its plan (it put a
check on every page), copies the source, and "repairs" by making things worse. Asked for ONE
page, it sees only that page's plan line, that page's source facts and the page before it, so
it has one small job and nowhere to wander. Each page is checked on its own (structure,
invented numbers and names, announcement openers, vague hints, the plan's question and
answer), and only a page that fails is written again, with the exact problem. A page
costs seconds to redo; a lesson cost minutes.

After the pages: the idea line and the matching game (written from the finished pages), and
for animal and plant lessons the end-of-lesson quiz. Then the whole lesson goes through
tools/check_lessons.py. Drafts land in .work/lessons-draft/ — DRAFTS, to be read and fixed
by hand, then moved on with tools/promote_lessons.py.
"""
import argparse
import glob
import json
import os
import random
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import check_lessons as C                      # noqa: E402
import draft_lessons as D                      # noqa: E402
import parse_lessons as P                      # noqa: E402

VOICE = D.RULES.split('STRUCTURE')[0]

PAGE_STRUCTURE = """YOU WRITE ONE PAGE AT A TIME.
- Output exactly ONE page and nothing else: the line `--- <emoji>` (add ` @species-id` when the plan line has one),
  then 1 to 4 blocks. No commentary, no markdown fences.
- Blocks: `p:` a paragraph that teaches one thing. `term: word = meaning` a new word. `fact:` or `fact(Label):` a
  callout with something concrete. `try:` something the child can do right now. A check, only when the PLAN LINE
  has a Q, and always the LAST block:
    check: the question?
    - a wrong answer
    + the right answer
    - another wrong answer
    hint: says WHAT on the page to look at
    explain: one warm sentence
- The Q in the plan line names the right answer: use it, and write two plausible wrong answers, the hint and the
  explain. The answer must be stated in the page's own text.
- Use ONLY the SOURCE FACTS given for this page. Re-tell them in your own short spoken sentences; keep every number
  exact. Never add a name, place, year or number that is not in them.
- Pick up where the PREVIOUS PAGE left off: answer its question, or turn from it. Never announce the page.
- Put a `term:` only if the plan line says TERM, a `try:` only if it says TRY.
- COUNT YOUR BLOCKS before you answer: a page has AT MOST 4 blocks, and the check is one of them. A page with a check
  therefore has at most 3 other blocks (for example p, fact, check, or p, term, fact, check). Two terms plus a check is
  exactly: p, term, term, check. If you have too much, cut sentences; never add a fifth block.
- Never repeat an idea, a question or a phrase from an earlier page. Each page says something new.
- Only page 1 may open with a question such as "Have you ever...". Every other page opens with a picture, a number,
  a contrast, or a statement.
- The three answer options are about the SAME LENGTH and equally specific. The right answer is never the longest or the
  most detailed one: give each wrong answer a believable detail of its own.
- Write for a 9-year-old: most sentences under 14 words, short plain words, one idea per sentence. Keep every number.
- A hint names WHERE to look and WHAT to find: "Look at the second sentence. It gives the number of days."
  Never "Look at the fact box" on its own, and never "Think about ...".
- A fact marked GENESIS is told with ONLY what the source says. Never say the written account "mentions" a person,
  planet, animal or place the source does not name. Do not add a lesson of your own to it.
- A page may not state a fact that is not in its SOURCE FACTS, even a true one. If you want a sentence and the
  facts do not give it, leave the sentence out."""

SPECIES_PAGE = """
- This is a page of a lesson about animals or plants. A page headed `@species-id` shows that species' own photo, so the
  first `p:` names it and gives its character. Use only THAT species' entry. A WORKED OUT fact is told as "the best read
  is ..." or "worked out", never as seen. The side-by-side page uses only the STATS numbers."""

END_STEPS = """You are finishing a lesson. Below is the whole lesson, page by page. Write exactly two lines and nothing else.

idea: TWO short sentences, at most 35 words in all. First: the most surprising thing the child will meet, stated plainly.
Second: a question or a puzzle the lesson answers. Use words and facts that are on the pages. Never begin "You learned",
"You will learn", "Discover" or "Find out how X works"; never say "amazing", "fascinating" or "journey".

game: 4 to 6 matching pairs on one line, `Name = clue`, separated by ` | `.
  - The LEFT is a NAME that appears on the pages: a person, place, animal, plant, object or new word, 1 to 4 words.
  - The RIGHT is 3 to 10 words, and it must restate something the pages say about THAT name, using the pages' own words.
    It must fit only that name. Do not use your own knowledge: if the pages do not say it, the clue cannot say it.
  - Never put a name on the right, and never two names that mean almost the same.

Two examples of a good reply (for other lessons):

idea: The ground under your feet never stops moving. Find out how we measure it, and how a ten-year-old on a beach used what she had learned.
game: P wave = The push-pull wave that arrives first | S wave = The sideways wave that does more damage | Chile 1960 = The strongest earthquake ever measured | Tilly Smith = The ten-year-old who cleared her beach | Kola borehole = The deepest hole ever drilled

idea: Almost half of every rock is oxygen, and salt is a mineral. Find out why a ruby and a sapphire are the same stone.
game: Obsidian = Glass that a volcano made | Halite = Breaks into tiny cubes | Corundum = The mineral behind ruby and sapphire | Pumice = Full of bubbles, so it floats | Mica = Black flecks that peel in shiny sheets"""

QUIZ_STEP = """Now write {n} quiz questions for the end of the lesson. Each tests something stated in the pages above, and
each is about a different page. Use exactly this form, with no hint:
quiz: the question?
- a wrong answer
+ the right answer
- another wrong answer
explain: one warm sentence
Write only the questions."""


CLOSE_RULES = """THE CLOSING PAGE. Exactly two short `p:` blocks and nothing else.
  First p: the lesson's most vivid images as short fragments, in the lesson's own words, one after another. No new facts.
  Second p: ONE plain sentence that ties them together.
  Never advice. Never "remember", "next time you", "think about", "amazing", "magic", "story", "journey" or "wonder".
  Never refer to the lesson or to what "we" saw or learned.
    BAD:  "So next time you see a rainbow, remember all the ways light has traveled to reach your eyes."
    GOOD: "A sun that is eight minutes old. White light split by a prism. A blue sky that turns red at sunset. A mirror,
           a pencil in water, a box of paints."
    GOOD: "One light, and so many ways to watch it change."
    GOOD: "Yeast breathing in dough. Spores waiting in every room. A mold that killed bacteria in a dish."
    GOOD: "Fungi are not plants, and they do their work out of sight." """

SCRIPTURE_CLOSE = """THE CLOSING PAGE about the written account. Use at most 3 blocks:
  1. One short `p:` that turns the lesson's last idea toward it, as a question or a contrast.
  2. `fact(The written account says):` followed by ONLY what the source fact says, in short sentences of your own.
     Add nothing the fact does not say, and name nothing it does not name.
  3. Optional: one `p:` of at most two sentences that adds no new claim. No advice, no "remember"."""

DESIGN_CLOSE = """THE CLOSING PAGE about how it is built. Use at most 3 blocks: one short `p:` that sets it up with a picture or a
  question; a `fact:` that tells the design fact in short sentences; optionally one short `p:`. Present it as a wonder, and do
  NOT attribute it to any Bible verse."""

SCRIPTURE_RE = re.compile(r'Genesis|Psalm|Job \d|Amos')


def closing_spec(spec, entry):
    """The rules for the last page, replacing the plan's vague 'warm wrap-up'."""
    theme = re.sub(r'^\S+\s+\S+\s+\[[^\]]*\]\s*', '', spec['raw'])
    if not spec['nums']:
        return f"close {spec['icon']} [] {CLOSE_RULES}\n  (the lesson's theme: {theme})"
    byn = {D.fnum(f): f for f in entry['facts']}
    text = ' '.join(byn[n]['text'] + ' ' + (byn[n].get('more') or '') for n in spec['nums'] if n in byn)
    rules = SCRIPTURE_CLOSE if SCRIPTURE_RE.search(text) else DESIGN_CLOSE
    return f"close {spec['icon']} [{','.join(map(str, spec['nums']))}] {rules}\n  (plan: {theme})"


# ── plans and facts ─────────────────────────────────────────────────────────────
def parse_plan(plan):
    hook, specs = '', []
    for line in plan['text'].splitlines():
        if line.startswith('hook:'):
            hook = line[5:].strip()
            continue
        m = D.PLAN_LINE.match(line)
        if not m:
            continue
        idx, icon, img, nums, rest = m.groups()
        specs.append({'close': idx == 'close', 'icon': icon, 'img': img, 'raw': line,
                      'nums': [int(x) for x in re.findall(r'\d+', nums)],
                      'term': 'TERM' in rest, 'try': 'TRY' in rest, 'q': ' Q ' in rest,
                      'seed': (rest.split(' Q ', 1)[1].split('->')[1].strip()
                               if ' Q ' in rest and '->' in rest else '')})
    if specs and not any(sp['term'] for sp in specs):
        mid = specs[1] if len(specs) > 2 else specs[0]
        mid['term'] = True
        mid['raw'] += ' TERM pick the one word on this page a 9-year-old is least likely to know, and define it in one plain sentence'
    return hook, specs


def fact_lines(entry, nums, stats_only=False):
    out = []
    byn = {D.fnum(f): f for f in entry['facts']}
    for n in nums:
        f = byn.get(n)
        if not f:
            continue
        if stats_only:
            head = f['text'].split('\n')[0].split('.')[0]
            st = next((l for l in f['text'].split('\n') if l.strip().startswith('STATS:')), '')
            out.append(f"[{n}] {head}. {st.strip()}")
            continue
        tag = D.KIND_WORDS.get(f['kind'], f['kind'])
        if f['cat'] == 'created':
            if re.search(r'Genesis|Psalm|Job \d|Amos', f['text'] + ' ' + (f.get('more') or '')):
                tag += '; GENESIS: frame as "The written account says"'
            else:
                tag += '; DESIGN: a closing wonder about how it is built. Do NOT attribute it to any Bible verse'
        body = trim_species(f['text']) if (f['cat'] == 'species' and not stats_only) else f['text']
        out.append(f"[{n}] ({tag}) {body}")
        if f.get('more'):
            out.append(f"     more: {f['more']}")
        if f.get('tryit'):
            out.append(f"     TRY IT (what the child can do): {f['tryit']}")
    return '\n'.join(out)


def trim_species(text, max_facts=7, max_chars=430):
    """Shorten one species entry for the PROMPT: its name, blurb, size, stats and wonder, plus the first few facts.
    A page uses one or two facts, and on a slow machine every token read costs time. The full text still
    grounds the checks (tools/check_lessons.py reads the untrimmed source)."""
    head, facts = [], []
    for ln in text.split('\n'):
        (facts if ln.strip().startswith('FACT (') else head).append(ln)
    facts = [f if len(f) <= max_chars else f[:max_chars].rsplit(' ', 1)[0] + ' ...' for f in facts[:max_facts]]
    return '\n'.join(head + facts)


def page_facts(entry, spec, species):
    if species and not spec['img'] and len(spec['nums']) > 1:
        return fact_lines(entry, spec['nums'], stats_only=True)          # side by side: stats only
    if not spec['nums']:
        if species:
            return 'SPECIES IN THIS LESSON: ' + ', '.join(
                f['text'].split('\n')[0].split('.')[0] for f in entry['facts'])
        return '(no source facts: a warm wrap-up that teaches nothing new)'
    return fact_lines(entry, spec['nums'])


# ── examples shown to the model (plan line + facts -> the finished page) ────────────
EX_PICK = {'earth-quakes': [1, 2, 4, 5, 7, 9, 11], 'earth-rocks': [3, 6, 8, 10],
           'animals-mammals-1': [1, 2, 3, 7, 8]}


# Approved, hand-edited closing pages: what a good [] ending looks like.
CLOSE_EXAMPLES = [('physical-forces', 7), ('micro-pond', 7), ('micro-cell', 7)]


def _lesson_from_src(lid):
    course = lid.split('-')[0]
    return P.parse(os.path.join(D.SRC, course + '.txt'))[lid]


def build_examples(src, plans, gold_ids):
    out = []
    picks = [(gid, i) for gid in gold_ids for i in EX_PICK[gid]]
    if not D.is_species(gold_ids[0]):
        picks += CLOSE_EXAMPLES
    for gid, i in picks:
        hook, specs = parse_plan(plans[gid])
        gold = _lesson_from_src(gid)
        species = D.is_species(gid)
        spec, pg = specs[i - 1], gold['pages'][i - 1]
        raw = closing_spec(spec, src[gid]) if spec['close'] else spec['raw']
        out.append('EXAMPLE\nPLAN LINE: ' + raw + '\nSOURCE FACTS FOR THIS PAGE:\n'
                   + page_facts(src[gid], spec, species) + '\nTHE FINISHED PAGE:\n'
                   + '\n'.join(P.emit_page(pg)))
    return '\n\n'.join(out)


# ── one page ─────────────────────────────────────────────────────────────────────
def parse_one_page(text, lid):
    text = re.sub(r'^```[a-z]*\n?|```$', '', text.strip(), flags=re.M).strip()
    text = text[text.find('---'):] if '---' in text else text
    lines = text.splitlines()
    cut = next((i for i, l in enumerate(lines[1:], 1) if l.strip().startswith('---')), None)
    if cut is not None:                       # a stray rule line at the end is not a second page
        text = '\n'.join(lines[:cut])
    tmp = os.path.join(D.DRAFTS, f'.{lid}.page.txt')
    open(tmp, 'w', encoding='utf-8').write(f'=== {lid}\n' + text + '\n')
    try:
        d = P.parse(tmp)
    except SystemExit as e:
        return None, [f'FORMAT: {e}']
    finally:
        os.unlink(tmp)
    pages = d.get(lid, {}).get('pages', [])
    if len(pages) != 1:
        return None, ['FORMAT: write exactly one page, starting with --- and an emoji']
    return pages[0], []


def _syl(w):
    w = re.sub(r'[^a-z]', '', w.lower())
    if not w:
        return 0
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and not w.endswith(('le', 'ee')) and n > 1:
        n -= 1
    return max(1, n)


def fk_grade(text):
    """Flesch-Kincaid grade of a passage (rough, but it is the yardstick the app has used)."""
    sents = [x for x in re.split(r'(?<=[.!?])\s+', text.strip()) if x.strip()]
    words = re.findall(r"[A-Za-z']+", text)
    if not sents or not words:
        return 0.0
    return 0.39 * len(words) / len(sents) + 11.8 * sum(map(_syl, words)) / len(words) - 15.59


UNIT = {'how long': r'(feet|foot|ft|inch|inches|miles?|meters?|metres?|cm|km|years?|days?|hours?|minutes?|seconds?|months?|weeks?|m\b)',
        'how heavy': r'(pounds?|lb|lbs|tons?|tonnes?|kg|ounces?|grams?)',
        'how much does': r'(pounds?|lb|lbs|tons?|tonnes?|kg|ounces?|grams?|percent|%)',
        'how fast': r'(mph|km/h|miles per hour|feet per second|m/s)',
        'how tall': r'(feet|foot|ft|inch|inches|miles?|meters?|metres?|cm|km|m\b)',
        'how deep': r'(feet|foot|ft|inch|inches|miles?|meters?|metres?|cm|km|m\b)',
        'how far': r'(feet|foot|ft|inch|inches|miles?|meters?|metres?|cm|km|m\b)',
        'how old': r'(years?|months?|days?)'}


def kind_mismatch(prompt, answer):
    """'How long ...?' answered 'over 20 pounds': the answer is the wrong kind of thing."""
    q = prompt.lower().strip()
    for lead, rx in UNIT.items():
        if q.startswith(lead) or (' ' + lead + ' ') in (' ' + q + ' ')[:40]:
            if re.search(r'\d', answer) and not re.search(rx, answer.lower()):
                return True
            if lead == 'how long' and re.search(r'(pounds?|lb|tons?|kg)\b', answer.lower()):
                return True
    return False


def hint_points_wrong(blocks, q):
    """The hint says 'paragraph' but the answer is in a fact box (or the other way round)."""
    right = toks(q['options'][q['answer']])
    if not right:
        return False
    where = None
    for b in blocks:
        if b['t'] in ('p', 'fact', 'term', 'try') and len(right & toks(b.get('text', ''))) >= max(1, len(right) // 2):
            where = b['t']
            break
    h = q.get('hint', '').lower()
    if where == 'p' and re.search(r'\b(fact box|the box|term box|term definition)\b', h):
        return True
    if where in ('fact', 'term', 'try') and re.search(r'\bparagraph\b', h):
        return True
    return False


def too_long_right(options, answer, ratio=1.2):
    """True when the right answer is conspicuously longer than every wrong one (a tell a child can use)."""
    wrong = [len(o) for i, o in enumerate(options) if i != answer]
    return bool(wrong) and len(options[answer]) > ratio * max(wrong)


def _wstem(w):
    """spirals / spiraled / spiral, break / breaking: one word, so a light stem for matching an answer to its page."""
    if w.isdigit() or len(w) <= 4:
        return w
    for suf in ('ing', 'ed', 'es', 'ly', 's'):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            w = w[:-len(suf)]
            break
    return w[:6]


def toks(t):
    return {w for w in re.findall(r"[a-z0-9']+", t.lower()) if len(w) > 2}


def page_problems(lid, spec, pg, src_text, idx_=2, src_text_facts='', so_far='', entry_names=None):
    probs = []
    kinds = [b['t'] for b in pg['blocks']]
    if spec['img']:
        if pg.get('img') != spec['img']:
            probs.append(f"the page must start with: --- {spec['icon']} @{spec['img']}")
    elif pg['icon'] != spec['icon']:
        probs.append(f"the page must start with: --- {spec['icon']}")
    if spec['q'] and 'check' not in kinds:
        probs.append('this page needs a check as its LAST block (the plan line has a Q)')
    if not spec['q'] and 'check' in kinds:
        probs.append('this page must NOT have a check: remove it')
    if spec['term'] and 'term' not in kinds:
        probs.append('this page needs a term: block')
    if spec['try'] and 'try' not in kinds:
        probs.append('this page needs a try: block')
    if 'check' in kinds and kinds[-1] != 'check':
        probs.append('the check must be the last block')
    if spec['q'] and spec['seed'] and 'check' in kinds:
        q = next(b['q'] for b in pg['blocks'] if b['t'] == 'check')
        want = toks(spec['seed'])
        got = toks(q['options'][q['answer']])
        if want and len(want & got) < max(1, len(want) // 2):
            probs.append(f'the RIGHT answer must be: "{spec["seed"]}" (you wrote "{q["options"][q["answer"]]}")')
        page_text = ' '.join(b.get('text', '') for b in pg['blocks'] if b['t'] != 'check').lower()
        if want and len(want & toks(page_text)) < max(1, len(want) // 2):
            probs.append('the right answer must be stated in the page text above the check')
    if spec['img'] and entry_names:
        me = entry_names.get(spec['img'], '')
        text_all = ' '.join(b.get('text', '') for b in pg['blocks'] if b['t'] != 'check')
        opening = (pg['blocks'][0].get('text', '') if pg['blocks'] else '').lower()
        if me and me.lower().split()[-1] not in opening and me.lower() not in text_all.lower():
            probs.append(f'the first paragraph must name the {me} so the child knows who this is')
        for sid, nm in entry_names.items():
            if sid != spec['img'] and re.search(r'\b' + re.escape(nm.lower()) + r'\b', text_all.lower()):
                probs.append(f'do not mention the {nm} on the {me} page: use only the {me} entry')
    page_words = ' '.join(b.get('text', '') for b in pg['blocks'] if b['t'] != 'check')
    if len(page_words.split()) >= 25 and fk_grade(page_words) > 9.0:
        probs.append(f'READING LEVEL: this page reads at grade {fk_grade(page_words):.0f}, too hard for a 9-year-old: '
                     'use shorter sentences (most under 14 words) and plainer, shorter words, keeping the numbers')
    # The child must be able to find the answer ON THE PAGE, in the page's own words and numbers.
    page_body = ' '.join(b.get('text', '') for b in pg['blocks'] if b['t'] != 'check')
    sim_ = lambda t: {_wstem(w) for w in re.findall(r"[a-z0-9']+", t.lower().replace(',', '').replace("'s", ''))
                      if len(w) > 2 or w.isdigit()}
    for b in pg['blocks']:
        if b['t'] != 'check':
            continue
        q = b['q']
        ans = sim_(q['options'][q['answer']])
        stop = {'the', 'and', 'for', 'are', 'was', 'with', 'its', 'that', 'this', 'than', 'only', 'both'}
        content = {w for w in ans if w not in stop}
        if content and len(content & sim_(page_body)) / len(content) < 0.5:
            probs.append(f'the right answer "{q["options"][q["answer"]]}" is not stated on this page: a child must be '
                         'able to find it in the page text above the question. Ask about something the page says.')
        for quoted in re.findall(r'"([^"]{8,})"', q.get('hint', '')):
            if sim_(quoted) and len(sim_(quoted) & sim_(page_body)) / len(sim_(quoted)) < 0.7:
                probs.append('the hint quotes words that are not on the page: point to what the page really says')
    for b in pg['blocks']:
        if b['t'] != 'check':
            continue
        qq = b['q']
        if re.search(r'(?i)\b(most (surprising|interesting|amazing|exciting|important)|favou?rite|coolest|best|your opinion)\b', qq['prompt']):
            probs.append('the question asks for an OPINION ("most surprising", "best"): ask for a fact the page states, '
                         'with one clearly right answer')
        starts = [' '.join(re.findall(r"[a-z']+", o.lower())[:3]) for o in qq['options']]
        if len(set(starts)) < len(starts) and any(len(x.split()) >= 3 for x in starts):
            probs.append('two answer options begin with the same words, so more than one could be right: make the wrong '
                         'answers clearly different from the right one')
    for b in pg['blocks']:
        if b['t'] == 'check' and kind_mismatch(b['q']['prompt'], b['q']['options'][b['q']['answer']]):
            probs.append(f'the question "{b["q"]["prompt"][:50]}" is answered by the wrong KIND of answer: '
                         'a "how long" question needs a length or a time, "how heavy" needs a weight')
        if b['t'] == 'check' and hint_points_wrong([x for x in pg['blocks'] if x['t'] != 'check'], b['q']):
            probs.append('the hint points to the wrong place: say "the paragraph" for a p block and "the box" for a fact or term block')
    for b in pg['blocks']:
        if b['t'] == 'check' and too_long_right(b['q']['options'], b['q']['answer']):
            q = b['q']
            probs.append('the RIGHT answer is much longer than the wrong ones, which gives it away: rewrite the wrong '
                         'answers so all three options are about the same length and equally specific')
    for b in pg['blocks']:
        if b['t'] == 'check':
            q = b['q']
            right = toks(q['options'][q['answer']])
            sim = lambda t: {w for w in re.findall(r"[a-z0-9']+", t.lower()) if len(w) > 2 or w.isdigit()}
            for i, o in enumerate(q['options']):
                if i != q['answer'] and right and toks(o):
                    j = len(sim(q['options'][q['answer']]) & sim(o)) / max(1, len(sim(q['options'][q['answer']]) | sim(o)))
                    if j >= 0.6:
                        probs.append(f'the wrong answer "{o}" means almost the same as the right one: make it clearly wrong')
    if spec['close'] and not spec['nums'] and so_far:
        words = {w for w in re.findall(r"[a-z']+", ' '.join(b.get('text', '') for b in pg['blocks']).lower()) if len(w) > 4}
        known = {w for w in re.findall(r"[a-z']+", so_far.lower()) if len(w) > 4}
        def _stem(w):                      # dives / diving / dived are one word
            for suf in ('ing', 'ed', 'es', 'ly', 's'):
                if w.endswith(suf) and len(w) - len(suf) >= 4:
                    w = w[:-len(suf)]
                    break
            return w[:4]
        stems = {_stem(k) for k in known}
        function_words = {'their', 'there', 'these', 'those', 'which', 'where', 'while', 'other', 'every', 'about',
                          'because', 'through', 'would', 'could', 'should', 'being', 'always', 'something', 'everything',
                          'together', 'another', 'around', 'still', 'whole', 'each', 'own'}
        title_words = set(re.findall(r"[a-z']+", (spec.get('title') or '').lower()))
        new_words = sorted(w for w in words if w not in known and _stem(w) not in stems
                           and w not in function_words and w not in title_words)
        if len(new_words) > max(2, len(words) // 6):
            probs.append('the closing page may only use words the lesson already used; these are new: '
                         + ', '.join(new_words[:8]) + '. Take the images from the pages above.')
    first = pg['blocks'][0].get('text', '') if pg['blocks'] else ''
    if re.match(r"(?i)(did you know|fun fact|here'?s a (fun|little|tricky)|here is a (fun|little|tricky))", first):
        probs.append('do not open with "Did you know" or "Here is a fun fact": open with the picture or the number itself')
    ftoks = toks(src_text_facts or '')
    for b in pg['blocks']:
        if b['t'] == 'term':
            tt = toks(b['text'])
            if tt and ftoks and len(tt & ftoks) < max(1, int(len(tt) * 0.4)):
                probs.append(f'the term "{b["word"]}" is defined with words that are not in the source facts: define it using the facts only')
    if idx_ > 1 and re.match(r'(?i)have you (ever )?(wondered|seen|noticed|thought|tried|heard|looked)', first):
        probs.append('only page 1 may open with "Have you ever...": open with a picture, number or contrast')
    for b in pg['blocks']:
        if b['t'] == 'check':
            q = b['q']
            if re.match(r'(?i)look at the (fact|first fact|term|paragraph|page)( box| block)?\.?$', q['hint'].strip()):
                probs.append('the hint must say WHAT to find, not just where to look')
    if spec['close']:
        txt = ' '.join(b.get('text', '') for b in pg['blocks'])
        if re.search(r"(?i)\b(remember|next time|think about|amazing|magic|stor(y|ies)|journey|wonder(ful)?|we(?:'ve)? (saw|learned|looked|talked))\b", txt):
            probs.append('the closing page must not give advice or recap: no "remember", "next time", "story", "magic", "wonder", "we saw"')
        if len(pg['blocks']) > 3:
            probs.append('the closing page has at most 3 blocks')
        if not spec['nums'] and (len(pg['blocks']) != 2 or any(b['t'] != 'p' for b in pg['blocks'])):
            probs.append('the closing page is exactly two p blocks')
        if spec['nums'] and ('written account' in txt.lower() or SCRIPTURE_RE.search(src_text_facts or '')):
            labels = ' '.join((b.get('label') or '') for b in pg['blocks'] if b['t'] == 'fact').lower()
            if SCRIPTURE_RE.search(src_text_facts or '') and 'written account' not in labels:
                probs.append('the scripture fact needs the label: fact(The written account says): ...')
    mini = {'pages': [pg]}
    cp = []
    C.check(lid, mini, cp, src_text + ' ' + spec['raw'], full=False)
    probs += [p.split(': ', 1)[1] if ': ' in p else p for p in cp]
    return probs


def species_names(entry, specs):
    names = {}
    for sp in specs:
        if sp['img'] and sp['nums']:
            f = next((f for f in entry['facts'] if D.fnum(f) == sp['nums'][0]), None)
            if f:
                names[sp['img']] = f['text'].split('\n')[0].split('.')[0].strip()
    return names


SOFT = ('the hint points to the wrong place', 'the RIGHT answer is much longer', 'READING LEVEL', 'the wrong answer', 'the hint must say WHAT',
        'do not open with "Did you know"', 'only page 1 may open')


def split_long(text, limit=26):
    out = []
    for sent in re.split(r'(?<=[.!?])\s+', text):
        if len(sent.split()) > limit and sent.count(',') >= 2:
            parts = [x.strip() for x in re.split(r',\s*(?:and\s+)?', sent.rstrip('.!?')) if x.strip()]
            sent = ' '.join(x[0].upper() + x[1:] + '.' for x in parts)
        out.append(sent)
    return ' '.join(out)


def autorepair(pg, spec):
    """Fix what a person would fix without asking the model again (a retry costs minutes on a slow machine)."""
    pg['icon'] = spec['icon']
    for b in pg['blocks']:
        if b['t'] in ('p', 'fact', 'try') and b.get('text'):
            b['text'] = split_long(b['text'])
    if spec['img']:
        pg['img'] = spec['img']
    else:
        pg.pop('img', None)
    if not spec['q']:                                   # the plan wants no question here
        pg['blocks'] = [b for b in pg['blocks'] if b['t'] != 'check']
    else:                                               # the check always closes the page
        checks = [b for b in pg['blocks'] if b['t'] == 'check']
        pg['blocks'] = [b for b in pg['blocks'] if b['t'] != 'check'] + checks[:1]
    while len(pg['blocks']) > 4:                        # shed an extra paragraph, never the first or the check
        drop = next((i for i, b in enumerate(pg['blocks'][:-1]) if i > 0 and b['t'] == 'p'), None)
        if drop is None:
            break
        pg['blocks'].pop(drop)
    return pg


def write_page(model, base_msgs, lid, spec, prev_text, hook, entry, species, idx, total, src_text, log, so_far='',
               entry_names=None):
    facts = page_facts(entry, spec, species)
    spec = dict(spec, title=entry['title'])
    plan_line = closing_spec(spec, entry) if spec['close'] else spec['raw']
    ask = (f"LESSON: {entry['title']} ({entry['course']}).{' OPENING IDEA FOR THE WHOLE LESSON (page 1 only): ' + hook if idx == 1 else ''}\n"
           f"PREVIOUS PAGE:\n{prev_text or '(this is the first page)'}\n\n"
           f"PLAN LINE for the page you write now (page {idx} of {total}):\n{plan_line}\n"
           f"SOURCE FACTS FOR THIS PAGE:\n{facts}\n\nWrite this page now. Output only the page.")
    best, best_p, last = None, None, []
    for attempt in range(3):
        # A retry is the SAME request plus the problems: the model's long failed answer is not resent, so the
        # prompt (and the cached prefix) stays the size of the first try.
        note = ('' if not last else '\n\nYOUR LAST TRY HAD THESE PROBLEMS. Write the page again without them, and keep '
                'it short:\n- ' + '\n- '.join(last[:8]))
        msgs = base_msgs + [{'role': 'user', 'content': ask + note}]
        raw, ntok, secs = D.chat(model, msgs, num_predict=420, temperature=0.6 + 0.06 * attempt,
                                 seed=random.randrange(1 << 30))
        pg, probs = parse_one_page(raw, lid)
        if pg is not None:
            pg = autorepair(pg, spec)
            probs = page_problems(lid, spec, pg, src_text + ' ' + facts, idx, facts, so_far, entry_names)
        log(f'    page {idx}/{total} try {attempt + 1}: {ntok} tok {secs:.0f}s, {len(probs)} problem(s)'
            + (f' [{probs[0][:70]}]' if probs else ''))
        if pg is not None and (best is None or len(probs) < len(best_p)):
            best, best_p = pg, probs
        if not probs:
            break
        # style-only problems get one more try at most: the model cannot always fix them, and each try is minutes
        if attempt >= 1 and pg is not None and all(p.startswith(SOFT) for p in probs):
            break
        last = probs
    best_p = best_p or []
    CHECK_FLAWS = ('the right answer "', 'the hint quotes', 'the question "', 'the RIGHT answer must be:', 'the right answer must be stated',
                   'the question asks for an OPINION', 'two answer options begin', 'the wrong answer "')
    if best is not None and any(p.startswith(CHECK_FLAWS) for p in best_p) and any(b['t'] == 'check' for b in best['blocks']):
        best['blocks'] = [b for b in best['blocks'] if b['t'] != 'check']       # no question beats a bad question
        best_p = [p for p in best_p if not p.startswith(CHECK_FLAWS) and 'needs a check' not in p] + ['(a flawed check was dropped from this page)']
        log(f'    page {idx}/{total}: flawed check dropped')
    return best, best_p


def end_steps(model, lid, pages, species, n_species, src_text, log, species_list=None):
    body = '\n\n'.join('\n'.join(P.emit_page(pg)) for pg in pages)
    lesson_text = ' '.join(b.get('text', '') for pg in pages for b in pg['blocks']).lower()
    sys_msg = VOICE + '\n' + END_STEPS
    out_idea = out_game = None
    names_note = ''
    if species and species_list:
        names_note = ('\n\nThis is a lesson about these species, and the game has ONE pair per species (at most six): the LEFT of '
                      'every pair is exactly one of these names: ' + ', '.join(species_list) + '.')
    ask_ig = 'THE LESSON:\n' + body + names_note + '\n\nWrite the idea line and the game line.'
    msgs = [{'role': 'system', 'content': sys_msg}, {'role': 'user', 'content': ask_ig}]
    for attempt in range(3):
        raw, ntok, secs = D.chat(model, msgs, num_predict=320, temperature=0.7, seed=random.randrange(1 << 30))
        idea = re.search(r'^idea:\s*(.+)$', raw, re.M)
        game = re.search(r'^game:\s*(.+)$', raw, re.M)
        probs = []
        pairs = []
        for src_line in (idea.group(1) if idea else '', game.group(1) if game else ''):
            for rx, label in C.BANNED + C.META:
                m_b = rx.search(src_line)
                if m_b:
                    probs.append(f'EDITORIAL: "{m_b.group(0)}" ({label}) is not allowed: reword it')
        if not idea or len(idea.group(1).split()) < 6:
            probs.append('write an idea: line of two short sentences')
        elif re.match(r"(?i)(you('ll| will)? (learn|meet|discover|find)|discover|learn|find out)", idea.group(1).strip()):
            probs.append('the idea line must not begin "You learned/will learn/Discover/Find out": state the surprise plainly')
        elif len(idea.group(1).split()) > 40:
            probs.append('the idea line is at most 35 words')
        if not game:
            probs.append('write a game: line')
        else:
            for part in game.group(1).split('|'):
                a, sep, b = part.partition('=')
                a, b = a.strip(), b.strip()
                if not sep or not a or not b:
                    probs.append(f'game pair needs "Name = clue": {part.strip()}')
                    continue
                la, lb = len(a.split()), len(b.split())
                if la > 4 or lb < 3 or lb > 10 or lb < la + 1:
                    probs.append(f'"{a} = {b}": the LEFT must be a short name (1-4 words), the RIGHT 3-10 words describing it')
                if not (toks(a) & toks(lesson_text)):
                    probs.append(f'"{a}" is not a name that appears in the lesson')
                wb = toks(b)
                if wb and len(wb & toks(lesson_text)) < max(1, len(wb) // 2):
                    probs.append(f'"{a} = {b}": the clue must come from what the lesson says, not from your own knowledge')
                pairs.append([a, b])
            if species and species_list:
                allowed = {x.lower() for x in species_list}
                for a_, b_ in pairs:
                    if a_.lower() not in allowed:
                        probs.append(f'"{a_}" is not one of the lesson\'s species: the LEFT must be one of {", ".join(species_list)}')
                if len({a_.lower() for a_, _ in pairs}) != len(pairs):
                    probs.append('one pair per species: no species may appear twice')
            lo = 3 if species else 4
            if not lo <= len(pairs) <= 6:
                probs.append(f'write between {lo} and 6 pairs')
            flat = [x for p in pairs for x in p]
            if len(set(flat)) != len(flat):
                probs.append('no two cards may be the same')
        log(f'    idea+game try {attempt + 1}: {len(probs)} problem(s)')
        if not probs:
            out_idea, out_game = idea.group(1).strip(), pairs
            break
        if out_idea is None and idea and game and len(pairs) >= 3:
            out_idea, out_game = idea.group(1).strip(), pairs      # keep the best so far
        msgs = [{'role': 'system', 'content': sys_msg},
                {'role': 'user', 'content': ask_ig + '\n\nYOUR LAST TRY HAD THESE PROBLEMS. Write both lines again '
                 'without them:\n- ' + '\n- '.join(probs[:8])}]
    quiz = []
    if species:
        n = 5 if n_species >= 4 else 4
        asked = [b['q']['prompt'] for pg in pages for b in pg['blocks'] if b['t'] == 'check']
        no_repeat = ('\n\nThese questions were ALREADY asked on the pages. Do not ask them again, or anything close: '
                     + ' | '.join(asked)) if asked else ''
        ask_q = 'THE LESSON:\n' + body + no_repeat + '\n\n' + QUIZ_STEP.format(n=n)
        msgs = [{'role': 'system', 'content': VOICE}, {'role': 'user', 'content': ask_q}]
        for attempt in range(3):
            raw, ntok, secs = D.chat(model, msgs, num_predict=760, temperature=0.7, seed=random.randrange(1 << 30))
            tmp = os.path.join(D.DRAFTS, f'.{lid}.quiz.txt')
            open(tmp, 'w', encoding='utf-8').write(f'=== {lid}\n--- 🐾\np: x\n' + raw.strip() + '\n')
            probs, qprobs = [], {}
            try:
                q = P.parse(tmp)[lid].get('quiz', [])
            except SystemExit as e:
                q, probs = [], [f'FORMAT: {e}']
            finally:
                os.unlink(tmp)
            if not 4 <= len(q) <= 6 and not probs:
                probs.append(f'write {n} quiz questions')
            for k, item in enumerate(q, 1):
                hard, soft = [], []
                if len(item['options']) != 3:
                    hard.append(f'question {k}: exactly 3 options')
                right = toks(item['options'][item['answer']])
                if right and len(right & toks(lesson_text)) < max(1, len(right) // 2):
                    hard.append(f'question {k}: the right answer must be stated in the lesson')
                if not item.get('explain'):
                    hard.append(f'question {k}: needs an explain:')
                if kind_mismatch(item['prompt'], item['options'][item['answer']]):
                    hard.append(f'question {k}: "{item["prompt"][:45]}" is answered by the wrong KIND of answer '
                                '(a "how long" question needs a length or a time)')
                for a_ in asked:
                    pt, at = toks(item['prompt']), toks(a_)
                    if pt and at and len(pt & at) / len(pt | at) >= 0.55:
                        hard.append(f'question {k} repeats a question already asked on a page: ask about something else')
                if too_long_right(item['options'], item['answer']):
                    soft.append(f'question {k}: the right answer is much longer than the wrong ones: make all three '
                                'options about the same length')
                qprobs[k] = (hard, soft)
                probs += hard + soft
            log(f'    quiz try {attempt + 1}: {len(probs)} problem(s)')
            good = [item for k, item in enumerate(q, 1) if not qprobs.get(k, ([], []))[0]]
            hard_left = any(h for h, _ in qprobs.values())
            # accept: nothing wrong; or only style problems after one retry; or, on the last try, keep every
            # question that has no hard problem (the lesson gate decides whether four are enough)
            if not probs or (attempt >= 1 and not hard_left and len(q) >= 4) or attempt == 2:
                quiz = good if attempt == 2 or hard_left else q
                break
            msgs = [{'role': 'system', 'content': VOICE},
                    {'role': 'user', 'content': ask_q + '\n\nYOUR LAST TRY HAD THESE PROBLEMS. Write all the questions '
                     'again without them:\n- ' + '\n- '.join(probs[:8])}]
    return out_idea, out_game, quiz


# ── a lesson ────────────────────────────────────────────────────────────────────
def draft_lesson(model, src, plans, lid, examples, log):
    entry, plan = src[lid], plans[lid]
    species = D.is_species(lid)
    hook, specs = parse_plan(plan)
    src_text = C.source_text().get(lid, '')
    sysmsg = VOICE + '\n' + PAGE_STRUCTURE + (SPECIES_PAGE if species else '')
    base = [{'role': 'system', 'content': sysmsg},
            {'role': 'user', 'content': examples + '\n\n----\nThose are finished pages. Now the page I need:'},
            {'role': 'assistant', 'content': 'Understood. Send me the plan line, the source facts and the previous page, '
             'and I will write that one page in the same voice.'}]
    names = species_names(entry, specs)
    pages, notes, prev = [], [], ''
    for i, spec in enumerate(specs, 1):
        # a closing page with no facts may draw on what the lesson already said
        grounding = src_text if spec['nums'] or species else src_text
        pg, probs = write_page(model, base, lid, spec, prev, hook, entry, species, i, len(specs),
                               grounding, log, ' '.join(b.get('text', '') for p_ in pages for b in p_['blocks']),
                               names if species else None)
        if pg is None:
            raise RuntimeError(f'page {i}: could not get a parseable page')
        pages.append(pg)
        notes += [f'page {i}: {p}' for p in probs]
        prev = '\n'.join(P.emit_page(pg))
    idea, game, quiz = end_steps(model, lid, pages, species, len(entry.get('species', [])), src_text, log,
                                 list(names.values()) if species else None)
    L = {'idea': idea or '', 'pages': pages, 'game': {'pairs': game or []}, 'quiz': quiz}
    D.spread_answers(lid, L)
    final = []
    C.check(lid, dict(L, quiz=L['quiz']), final, src_text)
    notes += [p.split(': ', 1)[1] if ': ' in p else p for p in final]
    return L, sorted(set(notes))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', nargs='*', default=[])
    ap.add_argument('--course', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--model', default=os.environ.get('LESSON_MODEL', 'qwen2.5:14b'))
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--count', action='store_true', help='print how many lessons are left to draft, and stop')
    a = ap.parse_args()

    src, plans = D.load_sources(), D.load_plans()
    gold = set(D.GOLD) | set(D.SPECIES_GOLD)
    if a.ids:
        ids = a.ids
    elif a.course:
        ids = [i for i in src if src[i]['course'] == a.course]
    elif a.all:
        ids = list(src)
    else:
        ap.error('give --ids, --course or --all')
    ids = [i for i in ids if i not in gold and i in plans]
    os.makedirs(D.DRAFTS, exist_ok=True)
    if not a.force:
        approved = set()
        for f in glob.glob(os.path.join(D.SRC, '*.txt')):
            approved |= set(re.findall(r'^=== (\S+)', open(f, encoding='utf-8').read(), re.M))
        ids = [i for i in ids if i not in approved and not os.path.exists(os.path.join(D.DRAFTS, i + '.txt'))]
    if a.count:
        print(len(ids))
        return
    ex = {False: build_examples(src, plans, D.GOLD), True: build_examples(src, plans, D.SPECIES_GOLD)}

    def log(m):
        print(time.strftime('%H:%M:%S'), m, flush=True)

    log(f'{len(ids)} lesson(s), page by page, with {a.model}')
    summary = {}
    for lid in ids:
        t0 = time.time()
        try:
            L, notes = draft_lesson(a.model, src, plans, lid, ex[D.is_species(lid)], log)
        except Exception as e:                                  # keep the batch going
            log(f'{lid}: ERROR {e}')
            summary[lid] = f'ERROR {e}'
            continue
        open(os.path.join(D.DRAFTS, lid + '.txt'), 'w', encoding='utf-8').write(P.emit(lid, L))
        note = os.path.join(D.DRAFTS, lid + '.problems')
        if notes:
            open(note, 'w', encoding='utf-8').write('\n'.join(notes) + '\n')
        elif os.path.exists(note):
            os.unlink(note)
        summary[lid] = 'clean' if not notes else f'{len(notes)} note(s)'
        log(f'{lid}: done in {time.time() - t0:.0f}s, {summary[lid]}')
    n = sum(1 for v in summary.values() if v == 'clean')
    log(f'finished: {n} clean, {len(summary) - n} with notes')


if __name__ == '__main__':
    main()
