#!/usr/bin/env python3
"""Draft Wonder Lab lessons with a local ollama model, then gate every draft.

  python3 tools/draft_lessons.py --ids earth-volcanoes        # one lesson
  python3 tools/draft_lessons.py --course earth               # a course
  python3 tools/draft_lessons.py --all                        # everything left
  python3 tools/draft_lessons.py --all --workers 2            # two at once

The model gets two finished lessons written by hand (earth-quakes and
earth-rocks in .work/lessons-src/earth.txt) as its examples, the rules, and the
new lesson's source facts. What comes back is parsed and run through the SAME
gate every hand-written lesson passes (tools/check_lessons.py: structure,
editorial bans, sentence length, name = description game pairs, and every number
must appear in the source facts). Anything that fails is sent back for repair.

Drafts land in .work/lessons-draft/<id>.txt — a DRAFT, never shipped. Each one
is read against its source facts and corrected by hand before
tools/promote_lessons.py moves it into .work/lessons-src/.
"""
import argparse
import glob
import json
import os
import random
import re
import sys
import threading
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import check_lessons as C          # noqa: E402
import parse_lessons as P          # noqa: E402

DRAFTS = os.environ.get('DRAFT_DIR') or os.path.join(ROOT, '.work', 'lessons-draft')
SRC = os.path.join(ROOT, '.work', 'lessons-src')
GOLD = ['earth-quakes', 'earth-rocks']
SPECIES_GOLD = ['animals-mammals-1']
HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')

KIND_WORDS = {'found': 'measured or observed', 'record': 'history / on record',
              'worked': 'WORKED OUT by reasoning, never seen directly'}

RULES = """You write lessons for Wonder Lab, a science and history app for a curious 9-year-old who is being
homeschooled. You are a warm teacher talking across a table, not a textbook. Write the way a person talks.

VOICE
- Speak to the child as "you". Short, concrete sentences. Most are under 20 words, none over 30.
- One thought per paragraph. A paragraph block is at most 60 words.
- Warm and a little wondering. Start pages with a picture, a puzzle, or a question, not a definition.
- Never use filler: no "fascinating", "amazing", "incredible", "Did you know", "Let's dive in", "journey".
- NEVER announce a page. Banned openers: "Let's ...", "Now let's ...", "Today we ...". Start a page with a picture,
  a number or a question from its own subject, and pick up the thread the last page left hanging.
    BAD:  "Let's talk about how big a tsunami is."
    GOOD: "A tsunami is a wave, but nothing like the ones you jump in at the beach."
    BAD:  "Let's look at another big eruption."
    GOOD: "And it was not over. The tsunami it launched was still killing people in Hawaii and Japan a day later."
- Re-tell each fact in your own short spoken sentences; keep every number exact. A paragraph before a `fact:` block
  sets it up with something specific. It never just announces it and it never repeats it.
- A `term:` meaning is one plain sentence a 9-year-old understands. No jokes, no asides.
- A hint says WHAT on the page to look at ("Look at the first number on the page."), never "Think about ...".
- Never mention the app, the lesson, "this page" or "this section". Talk about the world.
- US spelling. Imperial units first, metric in parentheses, exactly as the source gives them.
- State the number first, and any comparison second. Never compare a thing to a vague object.

TRUTH
- Teach ONLY what the source facts say. Do not add facts, years, names, places or numbers from your own memory.
  Every number you write must appear in the source facts. If it is not there, leave it out.
- Be honest about how we know. A fact marked WORKED OUT is reasoned from evidence, never seen; say it was
  "worked out". A measured fact may be stated plainly.
- No evolution, no millions or billions of years, no "scientists believe", no geologic era names.
- A Genesis fact is framed "The written account says ..." and used as the lesson's LAST page.

STRUCTURE
- 8 to 10 pages. Each page starts with `--- ` and one emoji, then 1 to 4 blocks (a check counts as a block).
- Block kinds: `p:` a paragraph that teaches one thing. `term: word = meaning` a new word (use at least one).
  `fact: ...` or `fact(Label): ...` a callout with something concrete. `try: ...` something the child can do right
  now with what is at hand (use one if the source facts give you something to try).
- Put a question on about every other page, 5 or 6 in the lesson. A check is the LAST thing on its page:
    check: the question?
    - a wrong answer
    + the right answer
    - another wrong answer
    hint: shown after a wrong tap, points back to the page without giving the answer away
    explain: shown after the right answer, one warm sentence
  Three options. The answer must be something the page JUST taught. Wrong answers are plausible, not silly.
- `idea:` is two short sentences: what the child will understand, and what they will find out.
- `game:` has exactly 6 matching pairs `Name = what it is` separated by `|`. The LEFT side is always a NAME
  (a word, person, place or thing, 1 to 4 words). The RIGHT side is always what it is or does (3 to 10 words).
  Never put a name on the right. Every right side must fit only its own name.
- You are given a PLAN. Follow it exactly: its page order, its emoji, which facts go on which page, and where the
  questions, new words and try-its go. Every question in the plan names the right answer; you write the two
  wrong answers, the hint and the explanation. Never put a name, place or number on a page that is not in the
  facts the plan lists for it.
- Output ONLY the lesson in the format shown. No commentary, no markdown fences."""


SPECIES_STRUCTURE = """STRUCTURE (a lesson about several animals or plants from one group)
- The lesson follows its PLAN exactly: a roll-call page, then one page per species, then a side-by-side page, then a
  close. A species page starts `--- 🐾 @species-id` (or the plan's emoji) EXACTLY as the plan writes it: the species'
  own photo is shown on that page, so never describe what it looks like in a way a photo would contradict.
- A species page has 2 to 4 blocks. A `p:` that names the animal or plant and gives its character in your own warm
  words. One or two `fact:` blocks with the most surprising things from ITS entry. A `term:` only where the plan has
  TERM. A check only where the plan has a Q. Pick what would make a 9-year-old say "no way", not the first facts listed.
- Use ONLY what that species' entry says, and the STATS numbers exactly as given. Never move a fact from one species
  to another. A WORKED OUT fact is told as "the best read is ..." or "worked out", never as seen.
- Blocks: `p:`, `term: word = meaning`, `fact:` or `fact(Label):`, `try:` (only if the entry gives something to do).
- A check is the LAST block on its page, in this exact form, with three options, and its answer is on that page:
    check: the question?
    - a wrong answer
    + the right answer
    - another wrong answer
    hint: says WHAT on the page to look at
    explain: one warm sentence
- The side-by-side page compares the species using only the STATS numbers.
- After the last page write 4 to 6 quiz questions, each a different species or idea, in this form, with no hint:
    quiz: the question?
    - a wrong answer
    + the right answer
    - another wrong answer
    explain: one warm sentence
- `idea:` is two short sentences: what the child will meet, and one surprising thing to find out.
- `game:` has one pair per species, `Name = clue`, separated by `|`. The LEFT is always the species name; the RIGHT
  is 3 to 10 words that fit ONLY that species. For a lesson of more than six species, use six.
- Output ONLY the lesson in the format shown. No commentary, no markdown fences."""
RULES_SPECIES = RULES.split('STRUCTURE')[0] + SPECIES_STRUCTURE


def is_species(lid):
    return lid.startswith(('animals-', 'plants-'))


def load_sources():
    src = {}
    for f in sorted(glob.glob(os.path.join(ROOT, '.work', 'lesson-batch-*.json'))):
        src.update(json.load(open(f, encoding='utf-8')))
    return src


def fnum(f):
    return int(re.search(r'(\d+)$', f['id']).group(1))


def facts_block(entry):
    out = [f"COURSE: {entry['course']}   LESSON TITLE: {entry['title']}", 'SOURCE FACTS:']
    for f in sorted(entry['facts'], key=fnum):
        tag = KIND_WORDS.get(f['kind'], f['kind'])
        if f['cat'] == 'created':
            if re.search(r'Genesis|Psalm|Job \d|Amos', f['text'] + ' ' + (f.get('more') or '')):
                tag += '; GENESIS: frame as "The written account says"'
            else:
                tag += ('; DESIGN: a closing observation about how it is built. Present it as a wonder, '
                        'and do NOT attribute it to any Bible verse')
        out.append(f"[{fnum(f)}] ({tag}) {f['text']}")
        if f.get('more'):
            out.append(f"     more: {f['more']}")
        if f.get('tryit'):
            out.append(f"     TRY IT (what the child can do): {f['tryit']}")
    return '\n'.join(out)


PLAN_LINE = re.compile(r'^(\d+|close)\s+(\S+)(?:\s+@(\S+))?\s+\[([\d,\s]*)\]\s+(.*)$')


def load_plans():
    """lesson id -> {'text': the plan as written, 'pages': [(icon, term, try, q)]}"""
    plans = {}
    for f in sorted(glob.glob(os.path.join(ROOT, '.work', 'lessons-plan', '*.txt'))):
        for m in re.finditer(r'^=== (\S+)\n(.*?)(?=^=== |\Z)', open(f, encoding='utf-8').read(), re.S | re.M):
            lid, body = m.group(1), m.group(2)
            lines = [l.rstrip() for l in body.splitlines() if l.strip() and not l.startswith('#')]
            pages = []
            for l in lines:
                pm = PLAN_LINE.match(l)
                if pm:
                    rest = pm.group(5)
                    pages.append((pm.group(2), 'TERM' in rest, 'TRY' in rest, ' Q ' in rest, pm.group(3)))
            plans[lid] = {'text': '\n'.join(lines), 'pages': pages}
    return plans


def plan_problems(plan, L):
    """Does the draft follow the plan page for page?"""
    out, want = [], plan['pages']
    if len(L['pages']) != len(want):
        out.append(f'PLAN: the lesson needs exactly {len(want)} pages (one per plan line); it has {len(L["pages"])}')
        return out
    for i, ((icon, term, try_, q, img), pg) in enumerate(zip(want, L['pages']), 1):
        kinds = [b['t'] for b in pg['blocks']]
        if img:
            if pg.get('img') != img:
                out.append(f'PLAN: page {i} must start with --- {icon} @{img}')
        elif pg['icon'] != icon:
            out.append(f'PLAN: page {i} must start with --- {icon}')
        if q != ('check' in kinds):
            out.append(f'PLAN: page {i} {"must end with a check" if q else "must not have a check"}')
        if term and 'term' not in kinds:
            out.append(f'PLAN: page {i} needs a term block')
        if try_ and 'try' not in kinds:
            out.append(f'PLAN: page {i} needs a try block')
    return out


def gold_text(lid):
    f = 'animals.txt' if is_species(lid) else 'earth.txt'
    txt = open(os.path.join(SRC, f), encoding='utf-8').read()
    m = re.search(r'^=== ' + re.escape(lid) + r'\n(.*?)(?=^=== |\Z)', txt, re.S | re.M)
    return f'=== {lid}\n' + m.group(1).strip() + '\n'


def build_messages(src, plans, lid):
    ex = []
    for g in (SPECIES_GOLD if is_species(lid) else GOLD):
        ex.append(f"EXAMPLE — source facts:\n{facts_block(src[g])}\n\nEXAMPLE — the plan:\n{plans[g]['text']}\n\n"
                  f"EXAMPLE — the finished lesson:\n{gold_text(g)}")
    user = ('\n\n'.join(ex) + "\n\n----\nNow write the lesson for these source facts, following THIS PLAN exactly:\n"
            "one page per plan line in the same order, with the same emoji, using the facts the line names, "
            "a check only where the plan has a Q, a term only where it has TERM, a try only where it has TRY. "
            "Open each page by picking up where the last one left off. Write the game pairs yourself.\n"
            "Make it as warm and connected as the examples.\n\n"
            + facts_block(src[lid]) + f"\n\nTHE PLAN:\n{plans[lid]['text']}\n\nBegin with the line `=== {lid}`.")
    return [{'role': 'system', 'content': RULES_SPECIES if is_species(lid) else RULES},
            {'role': 'user', 'content': user}]


def chat(model, messages, num_ctx=20480, temperature=0.75, seed=None, label='', num_predict=4200):
    body = {'model': model, 'messages': messages, 'stream': True, 'keep_alive': '2h',
            'options': {'num_ctx': num_ctx, 'temperature': temperature, 'top_p': 0.92,
                        'repeat_penalty': 1.05, 'num_predict': num_predict,
                        **({'seed': seed} if seed is not None else {})}}
    req = urllib.request.Request(HOST + '/api/chat', json.dumps(body).encode(),
                                 {'Content-Type': 'application/json'})
    out, n, t0 = [], 0, time.time()
    with urllib.request.urlopen(req, timeout=3600) as r:
        for line in r:
            j = json.loads(line)
            piece = j.get('message', {}).get('content', '')
            out.append(piece)
            n += 1
            if j.get('done'):
                break
    secs = time.time() - t0
    time.sleep(secs * float(os.environ.get('DRAFT_COOLDOWN', '0')))     # let the machine breathe
    return ''.join(out), n, secs


def clean(text, lid):
    """The model's raw text down to just the lesson."""
    text = re.sub(r'^```[a-z]*\n?|```$', '', text.strip(), flags=re.M).strip()
    i = text.find('=== ')
    if i > 0:
        text = text[i:]
    # keep only the first lesson if it rambled on
    parts = re.split(r'^=== ', text, flags=re.M)
    parts = [p for p in parts if p.strip()]
    if not parts:
        return ''
    body = parts[0]
    body = re.sub(r'^[^\n]*\n', '', body, count=1)         # drop the id line the model wrote
    return f'=== {lid}\n' + body.strip() + '\n'


def parse_draft(text, lid):
    tmp = os.path.join(DRAFTS, f'.{lid}.parse.txt')
    open(tmp, 'w', encoding='utf-8').write(text)
    try:
        d = P.parse(tmp)
    except SystemExit as e:
        return None, [f'FORMAT: {e}']
    finally:
        os.unlink(tmp)
    if lid not in d:
        return None, ['FORMAT: no lesson found']
    return d[lid], []


def problems_for(lid, L, src_text):
    probs = []
    L.setdefault('quiz', [])
    C.check(lid, L, probs, src_text)
    return [p.split(': ', 1)[1] if ': ' in p else p for p in probs]


def spread_answers(lid, L):
    """Models love to put the right answer in the same slot. Spread them."""
    rng = random.Random(lid)
    used = [0, 0, 0, 0]
    for pg in L['pages']:
        for b in pg['blocks']:
            if b['t'] != 'check':
                continue
            q = b['q']
            opts = q['options']
            if all(re.search(r'\d', o) for o in opts):      # numbers stay in order
                used[q['answer']] += 1
                continue
            slots = list(range(len(opts)))
            best = min(used[i] for i in slots)
            t = rng.choice([i for i in slots if used[i] == best])
            right = opts[q['answer']]
            rest = [o for i, o in enumerate(opts) if i != q['answer']]
            rest.insert(t, right)
            q['options'], q['answer'] = rest, t
            used[t] += 1


def draft_one(model, src, plans, lid, retries, log, force=False):
    out = os.path.join(DRAFTS, lid + '.txt')
    if os.path.exists(out) and not force:
        log(f'{lid}: already drafted (use --force to redo)')
        return 'skipped'
    messages = build_messages(src, plans, lid)
    src_text = C.source_text().get(lid)
    best, best_probs = None, None
    for attempt in range(retries + 1):
        raw, ntok, secs = chat(model, messages, seed=random.randrange(1 << 30))
        text = clean(raw, lid)
        L, probs = parse_draft(text, lid) if text else (None, ['FORMAT: empty reply'])
        if L is not None:
            probs += problems_for(lid, L, src_text) + plan_problems(plans[lid], L)
        log(f'{lid}: attempt {attempt + 1}: {ntok} tokens in {secs:.0f}s, {len(probs)} problem(s)')
        if best is None or len(probs) < len(best_probs) or L is not None and best[0] is None:
            best, best_probs = (L, text), probs
        if not probs:
            break
        messages = messages + [
            {'role': 'assistant', 'content': text or raw},
            {'role': 'user', 'content': 'The lesson has these problems. Fix every one and output the COMPLETE '
             'corrected lesson in the same format, nothing else:\n- ' + '\n- '.join(probs[:25])}]
    L, text = best
    os.makedirs(DRAFTS, exist_ok=True)
    if L is not None:
        spread_answers(lid, L)
        text = P.emit(lid, L)
    if text:
        open(out, 'w', encoding='utf-8').write(text)
    note = os.path.join(DRAFTS, lid + '.problems')
    if best_probs:
        open(note, 'w', encoding='utf-8').write('\n'.join(best_probs) + '\n')
    elif os.path.exists(note):
        os.unlink(note)
    return 'clean' if not best_probs else f'{len(best_probs)} problem(s)'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', nargs='*', default=[])
    ap.add_argument('--course', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--model', default=os.environ.get('LESSON_MODEL', 'qwen2.5:32b'))
    ap.add_argument('--retries', type=int, default=3)
    ap.add_argument('--workers', type=int, default=1)
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()

    src = load_sources()
    plans = load_plans()
    done_gold = set(GOLD) | set(SPECIES_GOLD)
    approved = set()
    for f in glob.glob(os.path.join(SRC, '*.txt')):
        approved |= set(re.findall(r'^=== (\S+)', open(f, encoding='utf-8').read(), re.M))
    if a.ids:
        ids = a.ids
    elif a.course:
        ids = [i for i in src if src[i]['course'] == a.course]
    elif a.all:
        ids = list(src)
    else:
        ap.error('give --ids, --course or --all')
    ids = [i for i in ids if i not in done_gold and (i not in approved or a.force)]
    noplan = [i for i in ids if i not in plans]
    if noplan:
        print(f'{len(noplan)} lesson(s) have no plan yet and are skipped: ' + ', '.join(noplan[:8])
              + (' ...' if len(noplan) > 8 else ''))
    ids = [i for i in ids if i in plans]
    os.makedirs(DRAFTS, exist_ok=True)
    lock = threading.Lock()
    results = {}

    def log(msg):
        with lock:
            print(time.strftime('%H:%M:%S'), msg, flush=True)

    q = list(ids)

    def worker():
        while True:
            with lock:
                if not q:
                    return
                lid = q.pop(0)
            try:
                results[lid] = draft_one(a.model, src, plans, lid, a.retries, log, a.force)
            except Exception as e:                      # keep the batch going
                results[lid] = f'ERROR {e}'
                log(f'{lid}: ERROR {e}')

    log(f'{len(ids)} lesson(s) to draft with {a.model}, {a.workers} at a time')
    ts = [threading.Thread(target=worker) for _ in range(a.workers)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    clean_n = sum(1 for v in results.values() if v == 'clean')
    log(f'done: {clean_n} clean, {len(results) - clean_n} with notes')
    for k, v in results.items():
        if v != 'clean':
            log(f'  {k}: {v}')


if __name__ == '__main__':
    main()
