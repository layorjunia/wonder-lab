#!/usr/bin/env python3
"""Check every shipped fact against Wikipedia, mechanically, and queue the doubtful ones for a model.

  python3 tools/audit/audit_ground.py --course animals           # one data set
  python3 tools/audit/audit_ground.py --all --workers 6
  python3 tools/audit/audit_ground.py --report                   # summary of what is done

For each fact (its text and its 'more') we
  1. find the article(s): the subject's own page (a species) plus the top Wikipedia search hits for the fact's
     own key words;
  2. check that every number in the fact appears in those articles (or is a unit conversion of one that does) and
     that every capitalised name does too, and how many of its content words are there;
  3. mark it  grounded  (all of that holds)  or  check  (something is missing), keeping the three best passages
     so a model can be asked, on the iMac, whether the passages support it (tools/audit/audit_judge.py).

This does NOT prove a fact true. It proves its numbers and names are in a reference text, which is the cheap,
mechanical half of the check; the judge and a person do the rest.

Output: .work/audit/ground-<course>.json    (resumable)
"""
import argparse
import json
import os
import re
import sys
import threading
import time
import unicodedata
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'grow'))
import grow_check as G                                           # noqa: E402

OUT = os.path.join(ROOT, '.work', 'audit')
CACHE = os.path.join(OUT, 'wiki')
UA = 'WonderLabFactAudit/1.0 (family homeschool app; jacob@illuminatedrones.com)'
JS = {'animals': ('animals.js', 'ANIMALS'), 'plants': ('plants.js', 'PLANTS'), 'body': ('body.js', 'BODY'),
      'earth': ('earth.js', 'EARTH'), 'astro': ('astro.js', 'ASTRO'), 'physical': ('physical.js', 'PHYSICAL'),
      'micro': ('micro.js', 'MICRO'), 'ancient': ('ancient.js', 'ANCIENT'), 'america': ('america.js', 'AMERICA'),
      'world': ('world.js', 'WORLD'), 'utah': ('utah.js', 'UTAH')}
# unit conversion factors a fact's imperial figure may have been derived with (imperialise.py)
FACTORS = [1.0, 0.3048, 3.28084, 1.609344, 0.621371, 0.453592, 2.20462, 2.54, 0.393701, 0.0393701, 25.4,
           0.0283495, 35.274, 0.264172, 3.78541, 1.10231, 0.907185, 1.8, 0.5556, 100.0, 0.01]
STOPNAMES = set('The A An In On At It He She They We You I As If When While After Before During There This These Those '
                'Some Many Most Each One Two Three Its His Her Their Our Your But And Or So Not No Yes Unlike Like '
                'Even Still Only Both All Any Every Such What Why How Who Where Which Today Now Then Once Often '
                'Never Always Sometimes Mother Father Fahrenheit Celsius January February March April May June July '
                'August September October November December Monday Tuesday Wednesday Thursday Friday Saturday Sunday '
                'Earth Sun Moon God Bible Genesis'.split())


def http(url, tries=3):
    last = None
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40).read().decode('utf-8', 'replace')
        except Exception as e:                                  # noqa: BLE001
            last = e
            time.sleep(1.5 + 2 * i)
    raise RuntimeError(str(last))


def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s)[:90]


def wiki_text(title):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, slug(title) + '.txt')
    if os.path.exists(path):
        return open(path, encoding='utf-8').read()
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'redirects': 1,
                                'format': 'json', 'titles': title})
    try:
        d = json.loads(http('https://en.wikipedia.org/w/api.php?' + q))
        p = list(d['query']['pages'].values())[0]
        t = p.get('extract') or ''
    except Exception:                                           # noqa: BLE001
        t = ''
    t = re.sub(r'\n=+\s*(See also|References|External links|Further reading|Notes|Bibliography)\s*=+.*', '', t, flags=re.S)
    open(path, 'w', encoding='utf-8').write(t[:60000])
    return t[:60000]


def wiki_search(query, n=3):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, 'search_' + slug(query) + '.json')
    if os.path.exists(path):
        return json.load(open(path))
    q = urllib.parse.urlencode({'action': 'query', 'list': 'search', 'srsearch': query, 'srlimit': n,
                                'format': 'json', 'srnamespace': 0})
    try:
        hits = [h['title'] for h in json.loads(http('https://en.wikipedia.org/w/api.php?' + q))['query']['search']]
    except Exception:                                           # noqa: BLE001
        hits = []
    json.dump(hits, open(path, 'w'))
    return hits


def load_entries(course):
    f, const = JS[course]
    s = open(os.path.join(ROOT, 'js', f), encoding='utf-8').read()
    return json.loads(re.search(r'const %s = (\[.*\]);' % const, s, re.S).group(1))


def facts_of(course):
    """-> list of dicts {eid, subject, i, text, more}"""
    out = []
    for e in load_entries(course):
        if course in ('animals', 'plants'):
            out.append({'eid': e['id'], 'subject': e['name'], 'i': 'blurb', 'text': e.get('blurb', ''), 'more': ''})
            for i, f in enumerate(e.get('facts', [])):
                out.append({'eid': e['id'], 'subject': e['name'], 'i': i, 'text': f['text'], 'more': f.get('more') or ''})
        else:
            out.append({'eid': e['id'], 'subject': e.get('section', ''), 'i': 0, 'text': e['text'],
                        'more': e.get('more') or ''})
    return [f for f in out if f['text']]


def num_values(s):
    vals = []
    for m in re.finditer(r'(?<![\w.])\d[\d,]*(?:\.\d+)?', s):
        raw = m.group(0).replace(',', '')
        try:
            v = float(raw)
        except ValueError:
            continue
        if v == int(v) and v <= 12 and '.' not in raw:
            continue                                            # tiny integers match by accident
        vals.append(v)
    return vals


def number_ok(x, pool):
    for a in pool:
        for k in FACTORS:
            b = a * k
            if abs(x - b) <= max(0.02 * abs(x), 0.51):
                return True
    return False


def key_query(subject, text):
    caps = []
    for m in re.finditer(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*", text):
        w = m.group(0)
        if w.split()[0] not in STOPNAMES:
            caps.append(w)
    words = [w for w in re.findall(r"[a-z]{5,}", text.lower()) if w not in G.STOP][:6]
    return ' '.join(([subject] if subject else []) + caps[:3] + words[:3])[:150]


def paragraphs(text):
    return [p.strip() for p in text.split('\n') if len(p.strip()) > 50]


def best_passages(fact, texts, k=3):
    want = G.content_words(fact['text'] + ' ' + fact['more'])
    nums = set(re.findall(r'\d[\d,.]*', fact['text'] + ' ' + fact['more']))
    scored = []
    for t in texts:
        for p in paragraphs(t):
            pw = G.content_words(p)
            s = len(want & pw) / float(len(want) or 1) + 0.5 * sum(1 for n in nums if n in p)
            scored.append((s, p[:700]))
    scored.sort(reverse=True)
    return [p for _, p in scored[:k]]


def ground(fact, texts):
    full = fact['text'] + ' ' + fact['more']
    alltext = G.norm(' '.join(texts))
    pool = []
    for t in texts:
        pool += num_values(t)
    bad_nums = [v for v in num_values(full) if not number_ok(v, pool)]
    names = []
    for nm in G.names_in(full):
        if nm in STOPNAMES or len(nm) < 3:
            continue
        names.append(nm)
    bad_names = [n for n in names if G.norm(unicodedata.normalize('NFKD', n)) not in alltext]
    cw = G.content_words(full)
    at = set(re.findall(r"[a-z][a-z'-]+", alltext))
    hit = [w for w in cw if w in at or w[:5] in {a[:5] for a in at}]
    cov = len(hit) / float(len(cw) or 1)
    ok = not bad_nums and not bad_names and cov >= 0.65
    return {'status': 'grounded' if ok else 'check', 'bad_numbers': bad_nums[:6], 'bad_names': bad_names[:6],
            'coverage': round(cov, 2)}


def run(course, workers, limit):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'ground-%s.json' % course)
    done = json.load(open(path)) if os.path.exists(path) else {}
    items = facts_of(course)
    todo = [f for f in items if '%s|%s' % (f['eid'], f['i']) not in done]
    if limit:
        todo = todo[:limit]
    lock = threading.Lock()
    q = list(todo)
    t0 = time.time()
    n = [0]

    def worker():
        while True:
            with lock:
                if not q:
                    return
                f = q.pop(0)
            titles = []
            if course in ('animals', 'plants'):
                titles.append(f['subject'])
            hits = wiki_search(key_query(f['subject'] if course in ('animals', 'plants') else '', f['text']), 3)
            titles += [h for h in hits if h not in titles][:3]
            texts = [wiki_text(t) for t in titles]
            texts = [t for t in texts if len(t) > 200]
            r = ground(f, texts) if texts else {'status': 'check', 'bad_numbers': [], 'bad_names': [], 'coverage': 0.0}
            r.update({'text': f['text'], 'more': f['more'], 'titles': titles})
            if r['status'] == 'check':
                r['passages'] = best_passages(f, texts)
            with lock:
                done['%s|%s' % (f['eid'], f['i'])] = r
                n[0] += 1
                if n[0] % 100 == 0:
                    json.dump(done, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
                    print('%s: %d/%d (%.0fs)' % (course, n[0], len(todo), time.time() - t0), flush=True)

    th = [threading.Thread(target=worker) for _ in range(workers)]
    [t.start() for t in th]
    [t.join() for t in th]
    json.dump(done, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    c = {}
    for v in done.values():
        c[v['status']] = c.get(v['status'], 0) + 1
    print('%s: %d facts, %s' % (course, len(done), c))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--course')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    if a.report:
        for c in JS:
            p = os.path.join(OUT, 'ground-%s.json' % c)
            if os.path.exists(p):
                d = json.load(open(p))
                cc = {}
                for v in d.values():
                    cc[v['status']] = cc.get(v['status'], 0) + 1
                print('%-10s %5d  %s' % (c, len(d), cc))
        return 0
    for c in ([a.course] if a.course else list(JS) if a.all else []):
        run(c, a.workers, a.limit)
    return 0


if __name__ == '__main__':
    sys.exit(main())
