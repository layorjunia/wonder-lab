#!/usr/bin/env python3
"""Validate the hand-authored lessons in .work/lessons/*.json.

  python3 tools/check_lessons.py            # all of them
  python3 tools/check_lessons.py earth      # just .work/lessons/earth.json

Structure (a lesson that fails these would break the player) and the same
editorial gate every other piece of content in this app goes through —
imported from build_animals, not copied, so a rule added there applies here.
Also catches the things that make a page hard to read aloud or hard to read:
long sentences, long paragraphs, too many blocks.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_animals import BANNED                                  # noqa: E402

BLOCKS = {'p', 'term', 'fact', 'try', 'check'}
MAX_SENT, MAX_PARA = 30, 75
PROPER = re.compile(r"\b[A-Z][a-z]{2,}(?:'s)?\b")
ALWAYS_OK = {'Earth', 'Genesis', 'God', 'Bible', 'Sun', 'Moon', 'The', 'And', 'But', 'So', 'Canada', 'United', 'States', 'Mexico', 'America',
             'Dakota', 'Pacific', 'Civil', 'Benjamin', 'Middle', 'Baltic', 'Victoria'}

# Figures and names a person has checked that the source facts do not repeat (lesson id -> list).
try:
    import json as _json
    GATE_ALLOW = _json.load(open(os.path.join(os.path.dirname(__file__), '..', '.work', 'gate-allow.json')))
except Exception:
    GATE_ALLOW = {}
OPENER = re.compile(r"^(now )?let'?s\b|^let us\b|^today,? (we|let)", re.I)
VAGUE_HINT = re.compile(r'^(think about|remember|try to think)\b', re.I)
CLICHE = re.compile(r"\b(amazing|fascinating|incredible|the magic of|has (its own|a) story|stories to tell|remember all the ways|waiting to be discovered|just waiting to)\b", re.I)
HAVE_YOU = re.compile(r"^have you (ever )?(wondered|seen|noticed|thought|tried|heard|looked)", re.I)
META = [(re.compile(r"\b(this|our|the) (lesson|quiz|page)\b|\bwraps? up (this|our|the)\b|\bwe'?ve (seen|looked|learned|talked)\b|\bhow we talked\b|\bisn'?t that amazing\b|\bkeep curious\b", re.I), 'meta commentary')]
ACRONYM = re.compile(r'\b[A-Z][A-Za-z]?[A-Z]{1,5}\b')
ACRONYM_OK = {'AD', 'BC', 'US', 'UK', 'USA', 'OK', 'TV', 'AA'}
NUM = re.compile(r'\d[\d,]*(?:\.\d+)?')


def source_text():
    """lesson id -> all the source fact text it may draw on."""
    out = {}
    for f in glob.glob(os.path.join(ROOT, '.work', 'lesson-batch-*.json')):
        for lid, v in json.load(open(f, encoding='utf-8')).items():
            out[lid] = ' '.join((x['text'] or '') + ' ' + (x.get('more') or '') + ' '
                                + (x.get('tryit') or '') for x in v['facts'])
    return out


def species_ids():
    f = os.path.join(ROOT, '.work', 'species-ids.json')
    return set(json.load(open(f))) if os.path.exists(f) else set()


def numbers(t):
    # 264,554 and 264554 are the same number
    return {n.rstrip(',').replace(',', '') for n in NUM.findall(t)}


def strings(lesson):
    """(where, text) for every piece of prose in a lesson."""
    for i, pg in enumerate(lesson['pages']):
        for j, b in enumerate(pg['blocks']):
            w = f'page {i + 1} block {j + 1}'
            if b['t'] == 'check':
                q = b['q']
                yield w + ' prompt', q['prompt']
                yield w + ' explain', q.get('explain', '')
                yield w + ' hint', q.get('hint', '')
                for k, o in enumerate(q.get('options', [])):
                    yield w + f' option {k + 1}', o
            else:
                yield w, b.get('text', '')
    for k, q in enumerate(lesson.get('quiz', [])):
        yield f'quiz {k + 1}', q['prompt']
    if lesson.get('idea'):
        yield 'idea', lesson['idea']
    for k, pr in enumerate((lesson.get('game') or {}).get('pairs', [])):
        yield f'pair {k + 1}', ' / '.join(pr)


def check(lid, L, problems, src=None, full=True):
    """full=False checks only what a single page can be wrong about (used while drafting page by page)."""
    allow = GATE_ALLOW.get(lid, [])

    def bad(msg):
        # a person has vetted these figures/names for this lesson (.work/gate-allow.json)
        if allow and re.search(r'(?:NUMBER|NAME|ACRONYM) (\S+) is not in the source facts', msg) \
                and re.search(r'(?:NUMBER|NAME|ACRONYM) (\S+) is not in the source facts', msg).group(1) in allow:
            return
        problems.append(f'{lid}: {msg}')

    if full and (not isinstance(L.get('idea'), str) or len(L['idea'].split()) < 6):
        bad('idea missing or too short')
    pages = L.get('pages') or []
    if full and not 6 <= len(pages) <= 12:
        bad(f'{len(pages)} pages (want 6-12)')
    checks = 0
    for i, pg in enumerate(pages):
        w = f'page {i + 1}'
        if not pg.get('icon'):
            bad(f'{w}: no icon')
        bl = pg.get('blocks') or []
        if not 1 <= len(bl) <= 4:
            bad(f'{w}: {len(bl)} blocks (want 1-4)')
        nchk = 0
        for b in bl:
            if b.get('t') not in BLOCKS:
                bad(f'{w}: unknown block {b.get("t")!r}')
                continue
            if b['t'] == 'term' and not b.get('word'):
                bad(f'{w}: term with no word')
            if b['t'] != 'check' and not (b.get('text') or '').strip():
                bad(f'{w}: empty {b["t"]} block')
            if b['t'] == 'check':
                nchk += 1
                q = b['q']
                if q.get('type') != 'choice':
                    bad(f'{w}: check type must be choice')
                o = q.get('options', [])
                if not 3 <= len(o) <= 4 or len(set(o)) != len(o):
                    bad(f'{w}: check wants 3-4 distinct options')
                if not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(o):
                    bad(f'{w}: check answer index out of range')
                if not (q.get('prompt') or '').strip() or not (q.get('explain') or '').strip():
                    bad(f'{w}: check needs a prompt and an explain')
                if not (q.get('hint') or '').strip():
                    bad(f'{w}: check needs a hint (shown after a wrong answer)')
        if nchk > 1:
            bad(f'{w}: {nchk} checks on one page (max 1)')
        checks += nchk
    if full:
        icons = [pg.get('icon') for pg in pages]
        if not any(pg.get('img') for pg in pages) and len(set(icons)) < len(icons) - 1:
            bad(f'icons repeat too much ({len(icons) - len(set(icons))} repeats) — one picture per page')
        if checks < 3:
            bad(f'only {checks} checks across the lesson (want 3+)')
        if not any(b['t'] == 'term' for pg in pages for b in pg['blocks']):
            bad('no new-word (term) block anywhere')
        # species pages show a photo: the id must be a real species
        ids = species_ids()
        for i, pg in enumerate(pages):
            if pg.get('img') and ids and pg['img'] not in ids:
                bad(f'page {i + 1}: @{pg["img"]} is not a species in the app')
        species = lid.startswith(('animals-', 'plants-'))
        qz = L.get('quiz') or []
        if species and not 4 <= len(qz) <= 6:
            bad(f'{len(qz)} quiz questions (a species lesson needs 4-6 written into it)')
        for k, q in enumerate(qz if species else []):
            o = q.get('options', [])
            if not 3 <= len(o) <= 4 or len(set(o)) != len(o):
                bad(f'quiz {k + 1}: wants 3-4 distinct options')
            if not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(o):
                bad(f'quiz {k + 1}: answer index out of range')
            if not (q.get('explain') or '').strip():
                bad(f'quiz {k + 1}: needs an explain')
        pr = (L.get('game') or {}).get('pairs') or []
        lo = 3 if species else 4
        if not lo <= len(pr) <= 6:
            bad(f'{len(pr)} game pairs (want {lo}-6)')
        flat = [x for p_ in pr for x in p_]
        if len(set(flat)) != len(flat):
            bad('game pairs contain a duplicate card')
        for p_ in pr:
            if len(p_) != 2 or any(len(x.split()) > 10 for x in p_):
                bad(f'game pair too long for a card: {p_}')
                continue
            # Left is always a NAME (a word, person, place, thing); right is always
            # what it is or does. A shorter right side means they were written
            # backwards, which puts names and descriptions in the same column.
            l, r = (len(x.split()) for x in p_)
            if r < 3 or r < l + 1 or l > 4:
                bad(f'game pair must be name = description (name left, 3+ words right): {p_}')
            # a clue must come from what the lesson itself says, not from the model's memory
            body = ' '.join((b.get('text', '') + ' ' + ' '.join(
                [b['q']['prompt'], b['q'].get('explain', '')] if b['t'] == 'check' else []))
                for pg in pages for b in pg['blocks']).lower()
            wt = lambda t: {w for w in re.findall(r"[a-z0-9']+", t.lower()) if len(w) > 2}
            wr = wt(p_[1])
            if wr and len(wr & wt(body)) < max(1, len(wr) // 2):
                bad(f'game clue is not from the lesson: {p_[0]} = {p_[1]}')

    # Every number must come from the source facts — a drafted lesson that
    # invents a year or a measurement is caught here, not by a child.
    if src is not None:
        allowed = numbers(src)
        # a number is also fine when it is the same measurement in the other
        # unit system (35 g -> 1.2 oz, 13 ft -> 4 m): the lessons print both.
        K = (0.3048, 1 / 0.3048, 0.4536, 1 / 0.4536, 2.54, 1 / 2.54, 1.609, 1 / 1.609,
             28.3495, 1 / 28.3495, 0.0283495, 1 / 0.0283495, 0.9144, 1 / 0.9144, 12, 1 / 12, 1000, 1 / 1000)

        def fl(x):
            try:
                return float(str(x).replace(',', ''))
            except ValueError:
                return None
        base = [v for v in (fl(a) for a in allowed) if v is not None]

        def derived(n):
            v = fl(n)
            if v is None or v == 0:
                return False
            return any(abs(v - a * k) <= 0.05 * abs(v) + 0.051 for a in base for k in K)
        for where, t in strings(L):
            if ' option ' in where:      # a wrong option may be any number
                continue
            for n in sorted(numbers(t) - allowed):
                if derived(n):
                    continue
                bad(f'{where}: NUMBER {n} is not in the source facts')

    # A capitalized word in mid-sentence is a name. If the source facts never
    # mention it, the model brought it from its own memory ("Vesuvius").
    if src is not None:
        low = src.lower() + ' ' + (L.get('idea') or '').lower()
        for where, t in strings(L):
            if ' option ' in where:
                continue
            for m in PROPER.finditer(t):
                w = m.group(0)
                before = t[:m.start()].rstrip()
                if not before or before[-1] in '.!?:"“/' or w in ALWAYS_OK:
                    continue
                lw = w.lower().replace("'s", '')
                # "Mexican" is fine when the source says "Mexico": match on the stem
                known = lw in low or (len(lw) >= 6 and lw[:5] in low)
                if not known:
                    bad(f'{where}: NAME {w} is not in the source facts')

    # An acronym the source never uses (NOAA, Kp, NASA...) is the model's own memory too.
    if src is not None:
        for where, t in strings(L):
            if ' option ' in where:
                continue
            for m in ACRONYM.finditer(t):
                if m.group(0) not in src and m.group(0) not in ACRONYM_OK:
                    bad(f'{where}: ACRONYM {m.group(0)} is not in the source facts')

    # Lifeless connective tissue: announcing a page instead of starting it, and a hint that points at nothing.
    for i, pg in enumerate(pages):
        for b in pg['blocks']:
            if b['t'] in ('p', 'fact', 'try') and OPENER.match(b.get('text', '')):
                bad(f'page {i + 1}: starts with an announcement ("{b["text"][:28]}..."): open with a specific '
                    f'picture, number or question from the page instead')
            if b['t'] == 'check' and VAGUE_HINT.match(b['q'].get('hint', '')):
                bad(f'page {i + 1}: the hint "{b["q"]["hint"][:30]}..." points at nothing: say WHAT on the page to look at')

    if full:
        hy = sum(1 for pg in pages if pg['blocks'] and HAVE_YOU.match(pg['blocks'][0].get('text', '')))
        if hy > 2:
            bad(f'{hy} pages open with "Have you ever...": vary the openings (2 at most)')
    for where, t in strings(L):
        m_c = CLICHE.search(t)
        if m_c:
            bad(f'{where}: cliche ("{m_c.group(0)}"): say the plain thing instead')
        for rx, label in BANNED + ([] if where.endswith('hint') else META):
            m = rx.search(t)
            if m:
                bad(f'{where}: EDITORIAL — {label} ({m.group(0)!r})')
        for s in re.split(r'(?<=[.!?])\s+', t):
            if len(s.split()) > MAX_SENT:
                bad(f'{where}: {len(s.split())}-word sentence: {s[:60]}...')
        if where.startswith('page') and ' block' in where and 'option' not in where \
                and not where.endswith(('explain', 'hint', 'prompt')):
            if len(t.split()) > MAX_PARA:
                bad(f'{where}: {len(t.split())}-word block (max {MAX_PARA})')


def main():
    want = sys.argv[1:]
    files = sorted(glob.glob(os.path.join(ROOT, '.work', 'lessons', '*.json')))
    if want:
        files = [f for f in files if os.path.basename(f)[:-5] in want]
    problems, n = [], 0
    srcs = source_text()
    for f in files:
        for lid, L in json.load(open(f, encoding='utf-8')).items():
            L.setdefault('quiz', [])
            check(lid, L, problems, srcs.get(lid))
            n += 1
    for p in problems[:80]:
        print('  ' + p)
    print(f'{n} lesson(s), {len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
