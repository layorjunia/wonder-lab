#!/usr/bin/env python3
"""Ask a local model whether the retrieved passages support each doubtful fact. Runs on the iMac.

  python3 tools/audit/audit_judge.py --all --host http://127.0.0.1:11435 --model qwen2.5:14b --workers 3

Reads  .work/audit/ground-<course>.json   (facts the mechanical check could not ground, with passages)
Writes .work/audit/judge-<course>.json    {"<eid>|<i>": {"verdict", "evidence", "problem"}}   (resumable)
Python 3.9 compatible.
"""
import argparse
import glob
import json
import os
import sys
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, '.work', 'audit')

SYSTEM = """You are a careful fact checker for a children's science and history app.
You get a FACT and PASSAGES copied from reference articles. Answer with exactly one word:
supported     - the passages say it, or it follows directly from what they say.
contradicted  - a passage clearly says something different (a different number, name, place or way round). Convert units before comparing (1 mile = 1.609 km, 1 ft = 0.3048 m, 1 lb = 0.4536 kg, 1 in = 2.54 cm).
not_found     - the passages do not mention the claim, so you cannot tell.
The FACT is written for a child and may use a comparison or a vivid phrase. Judge the plain claims inside it, one by one; if any plain claim is contradicted, answer contradicted."""


def ask(host, model, fact, passages):
    user = 'FACT: %s\n\n' % fact
    for i, p in enumerate(passages[:2], 1):
        user += 'PASSAGE %d: %s\n\n' % (i, p[:520])
    user += 'One word (supported, contradicted or not_found):'
    body = json.dumps({'model': model, 'stream': False,
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}],
                       'options': {'temperature': 0.0, 'num_ctx': 2048, 'num_predict': 6}}).encode()
    req = urllib.request.Request(host + '/api/chat', body, {'Content-Type': 'application/json'})
    r = json.loads(urllib.request.urlopen(req, timeout=1800).read().decode('utf-8'))
    w = r['message']['content'].strip().lower().replace('-', '_')
    for v in ('contradicted', 'not_found', 'supported'):
        if v in w:
            return {'verdict': v, 'evidence': '', 'problem': ''}
    return {'verdict': 'error', 'evidence': '', 'problem': w[:60]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--course')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--host', default='http://127.0.0.1:11434')
    ap.add_argument('--model', default='qwen2.5:14b')
    ap.add_argument('--workers', type=int, default=1)
    a = ap.parse_args()
    courses = [a.course] if a.course else [os.path.basename(p)[7:-5] for p in sorted(glob.glob(os.path.join(OUT, 'ground-*.json')))]
    jobs = []
    for c in courses:
        g = json.load(open(os.path.join(OUT, 'ground-%s.json' % c), encoding='utf-8'))
        jp = os.path.join(OUT, 'judge-%s.json' % c)
        done = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
        for k, v in g.items():
            if v['status'] == 'check' and v.get('passages') and k not in done:
                jobs.append((c, k, (v['text'] + ' ' + (v.get('more') or '')).strip(), v['passages']))
    # least-covered first: those are the likeliest to be wrong
    print('%d doubtful fact(s) to judge' % len(jobs), flush=True)
    lock = threading.Lock()
    t0 = time.time()
    n = [0]
    results = {}

    def flush(c):
        jp = os.path.join(OUT, 'judge-%s.json' % c)
        d = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
        d.update(results.get(c, {}))
        json.dump(d, open(jp, 'w', encoding='utf-8'), ensure_ascii=False)

    def worker():
        while True:
            with lock:
                if not jobs:
                    return
                c, k, fact, passages = jobs.pop(0)
            try:
                r = ask(a.host, a.model, fact, passages)
            except Exception as e:                  # noqa: BLE001
                r = {'verdict': 'error', 'evidence': '', 'problem': repr(e)[:100]}
            with lock:
                results.setdefault(c, {})[k] = r
                n[0] += 1
                if n[0] % 25 == 0:
                    for cc in list(results):
                        flush(cc)
                    print('%d judged (%.0fs)' % (n[0], time.time() - t0), flush=True)

    th = [threading.Thread(target=worker) for _ in range(a.workers)]
    [t.start() for t in th]
    [t.join() for t in th]
    for cc in list(results):
        flush(cc)
    print('done: %d judged in %.0fs' % (n[0], time.time() - t0), flush=True)


if __name__ == '__main__':
    main()
