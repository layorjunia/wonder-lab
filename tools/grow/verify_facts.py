#!/usr/bin/env python3
"""Second, separate model call: does the quote really say what the fact says?

  python3 tools/grow/verify_facts.py --all --host http://127.0.0.1:11435 --model qwen2.5:14b --workers 3

The first pass (extract_facts.py) proves the quote is real and the numbers match. It cannot see
meaning: "dunes over 180 m" can become "mountains over 180 m" with every number intact. So each
accepted fact goes back to a model WITHOUT the source, holding only the quote and the claim, and it must
say which details of the claim the quote does not state. A verdict other than "supported" is recorded on
the fact; review_facts.py shows those first.

Output: updates .work/grow/facts/<course>-<id>.json in place (fact['verdict'], fact['unsupported']).
Python 3.9 compatible.
"""
import argparse
import json
import os
import sys
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, '.work', 'grow', 'facts')

SYSTEM = """You are a strict fact checker for a children's app. You get a QUOTE from a reference text and a CLAIM written for a child.
Decide whether the QUOTE alone supports the CLAIM. Check every detail: the subject, the thing measured, the number and its unit,
and small words such as only, never, always, all, some, first, largest, most, over, about.
Reply with JSON only: {"verdict":"supported"|"partly"|"not","unsupported":"list the words or details of the CLAIM the QUOTE does not state, or empty"}.
"supported" means a careful reader would agree the quote says this. If the claim changes the thing described (for example dunes become mountains),
or overstates (some becomes all, nearly becomes exactly), the verdict is "not"."""


def ask(host, model, quote, claim):
    user = 'QUOTE: %s\n\nCLAIM: %s' % (quote, claim)
    body = json.dumps({'model': model, 'stream': False, 'format': 'json',
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}],
                       'options': {'temperature': 0.0, 'num_ctx': 4096, 'num_predict': 120}}).encode()
    req = urllib.request.Request(host + '/api/chat', body, {'Content-Type': 'application/json'})
    r = json.loads(urllib.request.urlopen(req, timeout=1800).read().decode('utf-8'))
    try:
        d = json.loads(r['message']['content'])
    except ValueError:
        return 'error', r['message']['content'][:80]
    v = str(d.get('verdict', 'error')).lower().strip()
    return (v if v in ('supported', 'partly', 'not') else 'error'), str(d.get('unsupported', ''))[:200]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--host', default='http://127.0.0.1:11434')
    ap.add_argument('--model', default='qwen2.5:14b')
    ap.add_argument('--workers', type=int, default=1)
    a = ap.parse_args()
    files = sorted(f for f in os.listdir(OUT_DIR) if f.endswith('.json'))
    if a.only:
        files = [f for f in files if f == a.only + '.json']
    elif not a.all:
        ap.error('give --only or --all')
    jobs = []
    for fn in files:
        d = json.load(open(os.path.join(OUT_DIR, fn), encoding='utf-8'))
        for i, f in enumerate(d['facts']):
            if 'verdict' not in f:
                jobs.append((fn, i))
    lock = threading.Lock()
    cache = {}
    logf = open(os.path.join(ROOT, '.work', 'grow', 'verify.log'), 'a')
    t0 = time.time()
    print('%d facts to verify' % len(jobs), flush=True)

    def worker():
        while True:
            with lock:
                if not jobs:
                    return
                fn, i = jobs.pop(0)
            path = os.path.join(OUT_DIR, fn)
            with lock:
                d = json.load(open(path, encoding='utf-8'))
            f = d['facts'][i]
            try:
                v, why = ask(a.host, a.model, f['quote'], f['text'])
            except Exception as e:                  # noqa: BLE001
                v, why = 'error', repr(e)[:100]
            with lock:
                d = json.load(open(path, encoding='utf-8'))
                d['facts'][i]['verdict'] = v
                d['facts'][i]['unsupported'] = why
                d['facts'][i]['verified_by'] = a.model
                json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                logf.write('%s %s #%d %s %s\n' % (time.strftime('%H:%M:%S'), fn, i, v, why))
                logf.flush()
                print('%s #%d %s %s (%.0fs)' % (fn, i, v, why[:60], time.time() - t0), flush=True)

    th = [threading.Thread(target=worker) for _ in range(a.workers)]
    [t.start() for t in th]
    [t.join() for t in th]
    print('done', flush=True)


if __name__ == '__main__':
    main()
