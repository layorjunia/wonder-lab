"""Mechanical checks for a candidate fact. No model involved, so none of it can be talked round.

A fact passes only if
  * its quote is really in the source text (copied, not paraphrased);
  * every number in the fact is in the quote;
  * every capitalised name in the fact is in the source;
  * it clears the app's editorial tripwires (BANNED), reading level and length;
  * it stands alone (no opening "It/They/This...");
  * its question's answer is in the fact.

Python 3.9 compatible: this module also runs on the iMac.
"""
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)

from build_animals import BANNED, CATS            # noqa: E402
import readability as R                           # noqa: E402

KINDS = ('found', 'record', 'worked')
HISTORY = {'ancient', 'america', 'utah', 'world'}
YEAR_CLAIM = re.compile(r'\b\d{3,4}\s*(BC|B\.C\.|BCE)\b|\bAD\s*\d{3,4}\b|\b\d{3,4}\s*(AD|CE)\b', re.I)
STAR_STORY = re.compile(
    r'star\s*(?:s)?\s+(?:are|is|was|were)\s+(?:being\s+)?(?:born|formed|forming|made)'
    r'|(?:birth|formation|death|life\s*cycle)\s+of\s+(?:a\s+)?stars?'
    r'|stars?\s+(?:form|forms|forming|collapse|collapses|ignite|ignites|die|dies)\b'
    r'|protostar|main\s+sequence|red\s+giant\s+phase|stellar\s+evolution', re.I)
# Extra tripwires for web text: the family's deep-time and origins position, and
# words a nine-year-old app should not print.
EXTRA = [
    (re.compile(r'\b(formed|created|born)\s+(about\s+)?\d[\d,.]*\s*(million|billion)', re.I), 'formation age'),
    (re.compile(r'\b\d[\d,.]*\s*(million|billion|thousand)\s+years?\b', re.I), 'age claim'),
    (re.compile(r'\bbig bang\b|\bsupernova remnant\b|\bcarbon[- ]dat', re.I), 'origins/dating framing'),
    (re.compile(r'\b(died|killed|murder|massacre|suicide|genocide|slaughter|executed|death toll|rape)\b', re.I), 'violence'),
    (re.compile(r'\b(sexual|abortion|drug|drunk|alcohol|beer|wine)\b', re.I), 'adult topic'),
]
START_BAD = re.compile(r'^(It|They|He|She|This|These|Those|That|There|Its|His|Her|Their|But|And|So|Then|However)\b')
CONVERSIONS = [3.28084, 0.3048, 0.621371, 1.609344, 2.20462, 0.453592, 0.393701, 2.54, 0.0393701, 25.4,
               35.274, 0.0283495, 0.264172, 3.78541, 1.10231, 0.907185, 0.3861, 2.58999, 0.386102, 247.105, 0.404686,
               0.0929, 10.7639, 35.3147, 0.0283168, 100.0, 0.01, 1000.0, 0.001]
STOP = set('the a an of and to in on at for with by is are was were be been it its this that these those from as or '
           'but not they their he she his her you your we our i has have had can could will would may might do does '
           'did into over under about than then so such also more most some any each other one two three'.split())


def norm(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = unicodedata.normalize('NFKC', s)
    s = s.replace('–', '-').replace('—', '-').replace('−', '-')
    s = s.replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"')
    s = s.replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()


def numbers(s):
    out = []
    for m in re.finditer(r'\d[\d,]*(?:\.\d+)?', s):
        out.append(m.group(0).replace(',', '').rstrip('.'))
    return out


def content_words(s):
    return {w for w in re.findall(r"[a-z][a-z'-]+", s.lower()) if w not in STOP and len(w) > 2}


def names_in(text):
    """Capitalised words that are not the first word of a sentence."""
    out = set()
    for sent in re.split(r'(?<=[.!?])\s+', text):
        ws = re.findall(r"[A-Za-z][A-Za-z'’-]*", sent)
        for i, w in enumerate(ws):
            if i and w[0].isupper() and w.lower() not in STOP:
                out.add(w.strip("'’-"))
    return out


def check_fact(f, course, sources_by_id, existing=None, max_words=55, drift=0.5, skip=()):
    """Return a list of problem strings; empty means the fact passed."""
    p = []
    text = (f.get('text') or '').strip()
    quote = (f.get('quote') or '').strip()
    src = sources_by_id.get(f.get('source'))
    if not text:
        return ['empty text']
    nw = len(text.split())
    if nw > max_words:
        p.append('runs %d words (max %d)' % (nw, max_words))
    if nw < 8:
        p.append('too short')
    if f.get('cat') not in CATS:
        p.append('unknown category %r' % f.get('cat'))
    if f.get('kind') not in KINDS:
        p.append('unknown kind %r' % f.get('kind'))
    if START_BAD.match(text):
        p.append('does not stand alone (starts with %r)' % text.split()[0])
    # --- the quote is real
    alltext = ' '.join(norm(s['text']) for s in sources_by_id.values())
    nq = norm(quote)
    if len(nq) < 25:
        p.append('quote is missing or too short')
    elif src is not None and nq not in norm(src['text']):
        p.append('quote is not in source %s' % f.get('source'))
    elif src is None and nq not in alltext:
        p.append('quote is not in any source')
    # --- numbers
    qnums = set(numbers(quote))
    qvals = []
    for n in qnums:
        try:
            qvals.append(float(n))
        except ValueError:
            pass
    for n in numbers(text):
        if n in qnums:
            continue
        try:
            x = float(n)
        except ValueError:
            p.append('number %s is not in the quote' % n)
            continue
        ok = False
        for a in qvals:
            if abs(x - (a * 9.0 / 5.0 + 32)) <= max(0.6, 0.01 * abs(x)) or abs(x - ((a - 32) * 5.0 / 9.0)) <= max(0.6, 0.01 * abs(x)):
                ok = True
            for k in CONVERSIONS:
                if abs(x - a * k) <= max(0.51, 0.015 * abs(x)):
                    ok = True
        if not ok:
            p.append('number %s is not in the quote' % n)
    # --- names
    for nm in names_in(text):
        if norm(nm) not in alltext:
            p.append('name %r is not in the sources' % nm)
    # --- every content word of the fact should lean on the quote
    miss = [w for w in content_words(text) if w not in content_words(quote) and w[:-1] not in content_words(quote)
            and not any(w.startswith(q[:5]) for q in content_words(quote))]
    if len(miss) > max(6, len(content_words(text)) * drift):
        p.append('fact drifts from its quote (%s)' % ', '.join(sorted(miss)[:8]))
    # --- editorial
    blob = text
    for rx, label in BANNED:
        m = rx.search(blob)
        if m:
            p.append('EDITORIAL %s (%r)' % (label, m.group(0)))
    for rx, label in EXTRA:
        if label in skip:
            continue
        m = rx.search(blob)
        if m:
            p.append('EDITORIAL %s (%r)' % (label, m.group(0)))
    if course == 'astro':
        m = STAR_STORY.search(blob)
        if m:
            p.append('EDITORIAL star story (%r)' % m.group(0))
    if course in HISTORY and YEAR_CLAIM.search(blob) and f.get('kind') == 'found':
        p.append('an ancient year may not be marked found')
    # --- reading level
    g, longest, _ = R.grade(text)
    nsent = len(R.sentences(text))
    if longest > R.MAX_SENTENCE:
        p.append('a sentence runs %d words' % longest)
    if nsent >= 2 and g > R.MAX_GRADE + 2.0:
        p.append('reads at grade %.1f' % g)
    elif nsent < 2 and g > R.MAX_GRADE + 5.0:
        p.append('reads at grade %.1f' % g)
    # --- the question
    q, a = (f.get('q') or '').strip(), (f.get('a') or '').strip()
    if q and a:
        if not q.endswith('?'):
            p.append('question has no ?')
        aw = [w for w in re.findall(r"[a-z0-9][a-z0-9,.'-]*", norm(a)) if w not in STOP]
        tw = norm(text)
        hit = [w for w in aw if w.strip('.,') in tw or w.strip('.,')[:4] in tw]
        if aw and len(hit) < 0.6 * len(aw):
            p.append('answer %r is not in the fact' % a)
        if len(a.split()) > 8:
            p.append('answer is long')
    else:
        p.append('no question/answer')
    # --- already have it?
    if existing:
        cw = content_words(text)
        for old in existing:
            ow = content_words(old)
            if cw and ow and len(cw & ow) / float(len(cw | ow)) > 0.5:
                p.append('duplicates an existing fact: %s' % old[:60])
                break
    return p
