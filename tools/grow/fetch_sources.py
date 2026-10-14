#!/usr/bin/env python3
"""Fetch the source text for every section in tools/grow/catalog.json.

  python3 tools/grow/fetch_sources.py                 # everything not yet fetched
  python3 tools/grow/fetch_sources.py --course utah   # one course
  python3 tools/grow/fetch_sources.py --force         # refetch

A section's facts may only be written from text saved here, and every fact must
quote it (see extract_facts.py). Sources are:
  * a Wikipedia article title      -> plain-text extract via the MediaWiki API
  * bible:<Book chapter>           -> World English Bible (public domain) via bible-api.com
  * https://...                    -> page text with tags stripped

Output: .work/grow/sources/<course>-<id>.json
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CATALOG = os.path.join(ROOT, 'tools', 'grow', 'catalog.json')
OUT = os.path.join(ROOT, '.work', 'grow', 'sources')
UA = 'WonderLabSourceFetcher/1.0 (family homeschool app; jacob@illuminatedrones.com)'
PER_SOURCE = 7000          # characters kept per source
DROP_SECTIONS = {'see also', 'references', 'external links', 'notes', 'further reading',
                 'bibliography', 'sources', 'citations', 'footnotes', 'gallery',
                 'in popular culture', 'in fiction', 'in literature', 'etymology and usage'}


def get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
        except Exception as e:                      # noqa: BLE001
            last = e
            time.sleep(2 + 3 * i)
    raise RuntimeError(f'{url}: {last}')


def clean_wiki(text):
    """Drop reference-type sections, heading markers and footnote debris."""
    out, skip = [], False
    for line in text.split('\n'):
        m = re.match(r'^(=+)\s*(.*?)\s*\1\s*$', line)
        if m:
            skip = m.group(2).lower() in DROP_SECTIONS
            if not skip:
                out.append('')
            continue
        if skip:
            continue
        line = re.sub(r'\[\d+\]|\[citation needed\]|\[[a-z]\]', '', line)
        out.append(line.strip())
    t = '\n'.join(out)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    return t


def wikipedia(title, host='en.wikipedia.org', limit=None):
    q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts|info', 'explaintext': 1,
                                'redirects': 1, 'format': 'json', 'inprop': 'url', 'titles': title})
    d = json.loads(get('https://%s/w/api.php?' % host + q))
    pages = d['query']['pages']
    p = list(pages.values())[0]
    if 'missing' in p or not p.get('extract'):
        raise RuntimeError(f'Wikipedia has no article "{title}"')
    text = clean_wiki(p['extract'])
    if re.search(r'may refer to:?$', text[:400], re.M) or len(text) < 400:
        raise RuntimeError(f'"{title}" looks like a disambiguation or stub page')
    return {'title': p['title'], 'url': p.get('fullurl') or 'https://%s/wiki/' % host + title.replace(' ', '_'),
            'text': text[:limit or PER_SOURCE], 'kind': 'wikipedia'}


def bible(ref):
    ref = ref.strip()
    m = re.match(r'^((?:[123] )?[A-Za-z ]+?)\s+(\d+)(?:-(\d+))?$', ref)
    if not m:
        raise RuntimeError(f'cannot read passage "{ref}"')
    book, a, b = m.group(1), int(m.group(2)), int(m.group(3) or m.group(2))
    texts = []
    for ch in range(a, b + 1):
        u = 'https://bible-api.com/' + urllib.parse.quote(f'{book} {ch}') + '?translation=web'
        d = json.loads(get(u))
        texts.append(f'{book} {ch}\n' + ' '.join(v['text'].strip().replace('\n', ' ') for v in d['verses']))
    return {'title': ref + ' (World English Bible)', 'url': 'https://bible-api.com/' + urllib.parse.quote(ref),
            'text': '\n\n'.join(texts)[:PER_SOURCE], 'kind': 'bible'}


def webpage(url):
    raw = get(url)
    raw = re.sub(r'(?is)<(script|style|nav|footer|header|aside)[^>]*>.*?</\1>', ' ', raw)
    raw = re.sub(r'(?i)</(p|div|li|h\d|tr|br)>', '\n', raw)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', raw))
    t = re.sub(r'[ \t]+', ' ', t)
    t = '\n'.join(l.strip() for l in t.split('\n') if len(l.strip()) > 40)
    return {'title': url, 'url': url, 'text': t[:PER_SOURCE], 'kind': 'web'}


def fetch(src):
    if src.startswith('bible:'):
        return bible(src[6:])
    if src.startswith('http'):
        return webpage(src)
    if src.startswith('simple:'):          # Simple English Wikipedia: plain words a 9-year-old can read
        return wikipedia(src[7:], 'simple.wikipedia.org')
    if '@' in src:                          # "Title@30000": keep more than the default 7000 characters
        t, n = src.rsplit('@', 1)
        return wikipedia(t, limit=int(n))
    return wikipedia(src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--course')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    cat = json.load(open(CATALOG, encoding='utf-8'))
    bad = []
    for course, secs in cat.items():
        if course.startswith('_') or (a.course and course != a.course):
            continue
        for s in secs:
            path = os.path.join(OUT, f'{course}-{s["id"]}.json')
            if os.path.exists(path) and not a.force:
                continue
            got = []
            for src in s['sources']:
                try:
                    r = fetch(src)
                    r['asked'] = src
                    r['retrieved'] = time.strftime('%Y-%m-%d')
                    got.append(r)
                except Exception as e:              # noqa: BLE001
                    bad.append(f'{course}-{s["id"]}: {src}: {e}')
                time.sleep(0.4)
            if len(got) < 2:
                bad.append(f'{course}-{s["id"]}: only {len(got)} usable source(s)')
                if not got:
                    continue
            json.dump({'course': course, 'id': s['id'], 'name': s['name'], 'glyph': s['glyph'],
                       'angle': s.get('angle', ''), 'sources': got}, open(path, 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)
            print(f'{course}-{s["id"]}: {len(got)} sources, {sum(len(g["text"]) for g in got)} chars')
    if bad:
        print('\nPROBLEMS:')
        print('\n'.join('  ' + b for b in bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
