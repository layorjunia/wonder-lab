#!/usr/bin/env python3
"""Write sourced facts for every section, with a local ollama model, then check them mechanically.

  python3 tools/grow/extract_facts.py --only earth-deserts            # one section
  python3 tools/grow/extract_facts.py --course utah --workers 3
  python3 tools/grow/extract_facts.py --all --host http://127.0.0.1:11435 --model qwen2.5:14b

For each section the model sees ONLY the saved source text (tools/grow/fetch_sources.py)
and must give, for every fact, an exact quote from it. grow_check.py then verifies the quote is
really in the source, every number is in the quote, every name is in the sources, and the app's
editorial tripwires. Failing facts go back to the model with the reasons (up to 3 rounds).

Output: .work/grow/facts/<course>-<id>.json   (resumable: finished sections are skipped)
Works on Python 3.9 (it runs on the iMac).
"""
import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import grow_check as G                                         # noqa: E402

SRC_DIR = os.path.join(ROOT, '.work', 'grow', 'sources')
OUT_DIR = os.path.join(ROOT, '.work', 'grow', 'facts')
EXIST = os.path.join(ROOT, '.work', 'grow', 'existing-facts.json')   # {course: [fact text, ...]}
TARGET = 6
ASK_PER_SOURCE = 4
CHARS_PER_SOURCE = 3000

HISTORY_CATS = 'when, travel, built, people, daily, writing, artifact, howworks, size, record, weird, food'
SCIENCE_CATS = 'size, speed, weird, howworks, record, senses, build, home, food, travel, defence, babies, tryit'

SYSTEM = """You write short true facts for Wonder Lab, a science and history app for a curious 9-year-old.
You are given SOURCE text. Use ONLY what the SOURCE says. Never add anything from memory.

Each fact has:
- "text": two or three short sentences, 25 to 45 words, in plain words a 9-year-old knows. Most sentences under 15 words.
  Say the main fact first, then one more surprising detail that the quote also states. Name the subject inside the text;
  never begin with It, They, He, She, This, These or That.
  Lead with the number when there is one. Copy every number EXACTLY as the SOURCE writes it: never round, convert, add or estimate.
  Use US spelling. When the SOURCE gives both, write the US unit first and the metric in parentheses, with the unit
  abbreviated: "590 ft (180 m)", "190 mi (300 km)", "13,000 lb (5,900 kg)". Write the thing described exactly as the quote does
  (a dune is a dune, not a mountain). Keep small words honest: "some", "about", "over", "up to", "only", "never".
- "quote": one or two consecutive sentences copied EXACTLY, character for character, from the SOURCE. They must contain everything the fact says.
- "source": the id of the source the quote is from (S1, S2, ...).
- "cat": one of: %s.
- "kind": "found" if it can be measured or seen today, "record" if it is history, a written account or who/when, "worked" if it is reasoned or estimated.
- "q": a simple question a child could answer from the text. "a": the answer in one to four words copied from the text.

- "topic": two or three words naming what the fact is about.

Rules: skip anything about how old something is in millions or billions of years, evolution, or geologic ages. Skip opinions, disputes and anything unsure. Skip sad or violent details. Skip birth and death dates, names of laws, acts, committees and treaties, and political fights. Prefer sizes, speeds, counts, firsts, how things work, and surprising details a child would repeat at dinner. Each fact is about a DIFFERENT thing. Output JSON only: {"facts":[...]}"""


def passages(source_text, angle, budget):
    """Pick the most useful paragraphs of a source: numbers and the section's angle first."""
    paras = []
    for line in source_text.split('\n'):
        line = line.strip()
        if len(line) <= 60:
            continue
        if len(line) > 700:                       # a whole chapter on one line: cut at sentences
            cur = ''
            for sent in re.split(r'(?<=[.!?])\s+', line):
                if cur and len(cur) + len(sent) > 600:
                    paras.append(cur)
                    cur = sent
                else:
                    cur = (cur + ' ' + sent).strip()
            if cur:
                paras.append(cur)
        else:
            paras.append(line)
    want = set(re.findall(r'[a-z]{4,}', angle.lower()))
    scored = []
    for i, p in enumerate(paras):
        s = 2.0 * min(len(re.findall(r'\d', p)), 8) / 8.0
        s += 0.35 * len(want & set(re.findall(r'[a-z]{4,}', p.lower())))
        s += max(0.0, 1.5 - 0.15 * i)
        scored.append((s, i, p))
    keep, used = [], 0
    for s, i, p in sorted(scored, reverse=True):
        if used + len(p) > budget:
            continue
        keep.append((i, p))
        used += len(p)
    return '\n'.join(p for _, p in sorted(keep))


def build_prompt(sec, need, sid, src, failed=None, have=None):
    parts = ['SECTION: %s' % sec['name'], 'FOCUS: %s' % sec['angle'], '',
             'SOURCE %s (%s):' % (sid, src['title']), src['picked'], '']
    if failed:
        parts.append('These facts were rejected. Fix each one, or replace it with a different fact from the SOURCE:')
        for f, why in failed:
            parts.append('- %s  [problems: %s]' % (json.dumps({k: f.get(k) for k in ('text', 'quote')}), '; '.join(why)))
        parts.append('(For "reads at grade": use shorter sentences and everyday words. For "number is not in the quote": '
                     'use only numbers the quote has. For "quote is not in source": copy the quote exactly.)')
        parts.append('')
    if have:
        parts.append('Already written (do NOT repeat these topics):')
        parts += ['- ' + t for t in have]
        parts.append('')
    parts.append('Write %d facts from this SOURCE only, as JSON {"facts":[...]} with "source":"%s".' % (need, sid))
    return '\n'.join(parts)


def call(host, model, system, user, num_predict=2200):
    body = json.dumps({'model': model, 'stream': False, 'format': 'json',
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
                       'options': {'temperature': 0.25, 'num_ctx': 8192, 'num_predict': num_predict, 'top_p': 0.9}}).encode()
    req = urllib.request.Request(host + '/api/chat', body, {'Content-Type': 'application/json'})
    r = json.loads(urllib.request.urlopen(req, timeout=3600).read().decode('utf-8'))
    return r['message']['content'], r


def parse(raw):
    try:
        d = json.loads(raw)
    except ValueError:
        m = re.search(r'\{.*\}', raw, re.S)
        if not m:
            return []
        try:
            d = json.loads(m.group(0))
        except ValueError:
            return []
    fs = d.get('facts') if isinstance(d, dict) else d
    return [f for f in (fs or []) if isinstance(f, dict)]


UNITS = [(r'\bkilometers?\b|\bkilometres?\b', 'km'), (r'\bmeters?\b|\bmetres?\b', 'm'),
         (r'\bcentimeters?\b|\bcentimetres?\b', 'cm'), (r'\bmillimeters?\b|\bmillimetres?\b', 'mm'),
         (r'\bkilograms?\b', 'kg'), (r'\bsquare kilometers?\b|\bsquare kilometres?\b', 'km2')]


def tidy(f):
    for k in ('text', 'quote', 'q', 'a', 'cat', 'kind', 'source', 'topic'):
        if isinstance(f.get(k), str):
            f[k] = re.sub(r'\s+', ' ', f[k]).strip()
    if isinstance(f.get('text'), str):
        for rx, ab in UNITS:
            f['text'] = re.sub(r'(\d[\d,.]*)\s*(?:' + rx[2:-2] + r')\b' if False else r'(?<=\d) (?:' + rx + ')', ' ' + ab, f['text'])
    f['kind'] = (f.get('kind') or '').lower()
    f['cat'] = (f.get('cat') or '').lower()
    return f


def run_section(path, host, model, existing, log):
    sec = json.load(open(path, encoding='utf-8'))
    course, sid = sec['course'], sec['id']
    out = os.path.join(OUT_DIR, '%s-%s.json' % (course, sid))
    if os.path.exists(out):
        return
    sources = {}
    for i, s in enumerate(sec['sources'], 1):
        sources['S%d' % i] = {'title': s['title'], 'url': s['url'], 'kind': s['kind'],
                              'text': s['text'], 'picked': passages(s['text'], sec['angle'] + ' ' + sec['name'],
                                                                    CHARS_PER_SOURCE)}
    check_src = {k: {'text': v['picked']} for k, v in sources.items()}
    cats = HISTORY_CATS if course in G.HISTORY else SCIENCE_CATS
    system = SYSTEM % cats
    ex = existing.get(course, [])
    accepted, rejected, attempts, t0 = [], [], [], time.time()
    for key, src in sources.items():
        mine, failed = [], []
        for rnd in range(2):
            user = build_prompt(sec, ASK_PER_SOURCE if rnd == 0 else 3, key, src,
                                failed=failed if rnd else None,
                                have=[m['text'][:70] for m in mine] if rnd else None)
            try:
                raw, meta = call(host, model, system, user, num_predict=1100)
            except Exception as e:                  # noqa: BLE001
                log('%s-%s %s round %d call failed: %s' % (course, sid, key, rnd, e))
                time.sleep(20)
                continue
            failed = []
            for f in [tidy(x) for x in parse(raw)]:
                f['source'] = key
                probs = G.check_fact(f, course, check_src, existing=ex + [a['text'] for a in accepted + mine])
                attempts.append({'source': key, 'round': rnd, 'text': f.get('text'), 'problems': probs})
                if probs:
                    failed.append((f, probs))
                else:
                    mine.append(f)
            if len(mine) >= 3 or not failed:
                break
        accepted += mine
        rejected += [{'text': f.get('text'), 'quote': f.get('quote'), 'source': key, 'problems': w} for f, w in failed]
        log('%s-%s %s (%s): %d accepted, %d rejected (%.0fs)' % (course, sid, key, src['title'][:28],
                                                                  len(mine), len(failed), time.time() - t0))
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump({'course': course, 'id': sid, 'name': sec['name'], 'glyph': sec['glyph'], 'model': model,
               'seconds': round(time.time() - t0), 'enough': len(accepted) >= TARGET,
               'sources': {k: {'title': v['title'], 'url': v['url'], 'kind': v['kind']} for k, v in sources.items()},
               'facts': accepted, 'rejected': rejected, 'attempts': attempts},
              open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    ap.add_argument('--course')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--host', default='http://127.0.0.1:11434')
    ap.add_argument('--model', default='qwen2.5:14b')
    ap.add_argument('--workers', type=int, default=1)
    a = ap.parse_args()
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith('.json'))
    by_course = {}
    for f in files:
        by_course.setdefault(f.split('-')[0], []).append(f)
    files = [fs[i] for i in range(12) for c, fs in sorted(by_course.items()) if i < len(fs)]
    if a.only:
        files = [f for f in files if f == a.only + '.json']
    elif a.course:
        files = [f for f in files if f.startswith(a.course + '-')]
    elif not a.all:
        ap.error('give --only, --course or --all')
    existing = json.load(open(EXIST, encoding='utf-8')) if os.path.exists(EXIST) else {}
    lock = threading.Lock()
    logf = open(os.path.join(ROOT, '.work', 'grow', 'extract.log'), 'a')

    def log(msg):
        with lock:
            line = time.strftime('%m-%d %H:%M:%S ') + msg
            logf.write(line + '\n')
            logf.flush()
            print(line, flush=True)

    todo = [os.path.join(SRC_DIR, f) for f in files
            if not os.path.exists(os.path.join(OUT_DIR, f))]
    log('%d section(s) to do with %s on %s, %d worker(s)' % (len(todo), a.model, a.host, a.workers))
    q = list(todo)

    def worker():
        while True:
            with lock:
                if not q:
                    return
                p = q.pop(0)
            try:
                run_section(p, a.host, a.model, existing, log)
            except Exception as e:                  # noqa: BLE001
                log('%s FAILED: %r' % (os.path.basename(p), e))

    th = [threading.Thread(target=worker) for _ in range(a.workers)]
    [t.start() for t in th]
    [t.join() for t in th]
    log('done')


if __name__ == '__main__':
    main()
