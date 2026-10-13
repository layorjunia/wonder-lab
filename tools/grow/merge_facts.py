#!/usr/bin/env python3
"""Turn the facts written for a course into app data: entries, section registration, lesson batch and plans.

  python3 tools/grow/merge_facts.py --course earth            # reads .work/grow/written/earth.json
  python3 tools/grow/merge_facts.py --course earth --check    # validate only, write nothing

Input (.work/grow/written/<course>.json), one object per section:
  {"deserts": {"hook": "...", "term": "dune", "icons": ["🏜️", ...],
      "facts": [{"t": "fact text", "s": 2, "from": "exact words the quote starts with",
                 "to": "exact words it ends with", "cat": "size", "kind": "found",
                 "q": "question?", "a": "answer in the fact"}, ...x6]}}

Every fact is checked against the SAVED source text (tools/grow/grow_check.py): the quote is resolved from
`from`..`to` so it is an exact substring of source `s`; numbers must be in the quote, names in the sources, editorial
tripwires and reading level pass. A section with any failing fact is reported and skipped.

Writes (per course):
  .work/entries-<course>-g1.json        the facts, ids <section>-1..6
  .work/lesson-batch-<course>-g1.json   lesson id -> {course, title, section, facts}   (what the drafter reads)
  .work/lessons-plan/<course>-g1.txt    one plan block per lesson
  .work/grow/provenance-<course>.json   fact id -> {url, title, quote}   (kept for audit; never shipped)
  js/schema.js                          the new sections (name + glyph) added to <COURSE>_SECTIONS
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
import grow_check as G                                       # noqa: E402
import imperialise as IMP                                    # noqa: E402

CAT_ICONS = {
    'size': ['📏', '📐', '⚖️', '🔭'], 'speed': ['💨', '🏃', '⚡', '🚀'], 'weird': ['🤔', '😮', '🎭', '✨'],
    'howworks': ['⚙️', '🔧', '🧩', '💡'], 'record': ['🏆', '🥇', '🌟', '📊'], 'people': ['🧑', '👤', '👑', '🧑‍🔬'],
    'when': ['📅', '⏳', '🕰️', '📜'], 'built': ['🏗️', '🧱', '🏛️', '🔨'], 'travel': ['🧭', '🗺️', '⛵', '🚂'],
    'daily': ['🏠', '🍞', '🧺', '🪑'], 'writing': ['✍️', '📖', '🖋️', '📜'], 'artifact': ['🏺', '🪙', '🗿', '🎨'],
    'food': ['🍽️', '🍎', '🥕', '🥛'], 'senses': ['👀', '👂', '👃', '✋'], 'home': ['🏡', '🌍', '🌳', '⛰️'],
    'defence': ['🛡️', '🔒', '🚧', '🧱'], 'babies': ['🐣', '🍼', '🧸', '🌱'], 'build': ['🔧', '🧰', '🏗️', '🧱'],
    'tryit': ['🖐️', '🔬', '🧪', '🎯'], 'bones': ['🦴', '🦷', '🪨', '⚱️'], 'copied': ['🪞', '🧬', '🎶', '🪄'],
    'oops': ['😮', '🙈', '🌀', '🎢']}
SPARE = ['🔎', '🎈', '🧭', '🌈', '🪁', '🔔', '🎁', '🍀']


SCHEMA_VAR = {'earth': 'EARTH_SECTIONS', 'astro': 'ASTRO_SECTIONS', 'physical': 'PHYSICAL_SECTIONS',
              'micro': 'MICRO_SECTIONS', 'ancient': 'ANCIENT_SECTIONS', 'america': 'AMERICA_SECTIONS',
              'utah': 'UTAH_SECTIONS', 'world': 'WORLD_SECTIONS', 'economics': 'ECONOMICS_SECTIONS',
              'body': 'BODY_SECTIONS'}


def resolve_quote(text, start, end):
    """The exact substring of `text` from `start` to `end` (whitespace-flexible), or None."""
    def rx(s):
        return re.escape(s.strip()).replace(r'\ ', r'\s+')
    m = re.search(rx(start), text)
    if not m:
        return None
    if not end or end.strip() == start.strip():
        return text[m.start():m.end()]
    m2 = re.search(rx(end), text[m.start():])
    if not m2:
        return None
    return re.sub(r'\s+', ' ', text[m.start():m.start() + m2.end()])


def finish_text(t):
    t = re.sub(r'\s+', ' ', t).strip()
    return IMP.imperialise(t)


def build_section(course, sec, spec, existing):
    src = json.load(open(os.path.join(ROOT, '.work', 'grow', 'sources', '%s-%s.json' % (course, sec)),
                         encoding='utf-8'))
    sources = {'S%d' % i: s for i, s in enumerate(src['sources'], 1)}
    problems, facts, prov = [], [], {}
    seen = []
    for n, w in enumerate(spec['facts'], 1):
        sid = 'S%d' % w['s']
        if sid not in sources:
            problems.append('fact %d: no source %s' % (n, sid))
            continue
        quote = resolve_quote(sources[sid]['text'], w['from'], w.get('to', ''))
        if not quote:
            problems.append('fact %d: cannot find quote "%s" ... "%s" in %s' % (n, w['from'][:40], w.get('to', '')[:40], sid))
            continue
        f = {'text': w['t'], 'quote': quote, 'source': sid, 'cat': w['cat'], 'kind': w['kind'],
             'q': w.get('q', ''), 'a': w.get('a', '')}
        pr = G.check_fact(f, course, {k: {'text': v['text']} for k, v in sources.items()},
                          existing=existing + seen, max_words=60, drift=(5.0 if w.get('loose') else 0.8), skip=('violence',))
        seen.append(f['text'])
        if pr:
            problems.append('fact %d "%s...": %s' % (n, f['text'][:40], '; '.join(pr)))
            continue
        fid = '%s-%d' % (sec, n)
        facts.append({'id': fid, 'section': sec, 'cat': f['cat'], 'kind': f['kind'], 'text': finish_text(f['text']),
                      'more': '', '_q': f['q'], '_a': f['a']})
        prov[fid] = {'source': sources[sid]['title'], 'url': sources[sid]['url'], 'quote': quote}
    return src, facts, prov, problems


def plan_block(lid, title, glyph, facts, spec):
    lines = ['=== %s' % lid, 'hook: %s' % spec.get('hook', title)]
    given = spec.get('icons') or []
    term = spec.get('term')
    used = {glyph}
    qn = 0
    termed = False
    for n, f in enumerate(facts, 1):
        if n - 1 < len(given):
            icon = given[n - 1]
        elif n == 1:
            icon = glyph
        else:
            icon = next((i for i in CAT_ICONS.get(f['cat'], []) + SPARE if i not in used), '✨')
        used.add(icon)
        rest = f['text']
        if term and not termed and re.search(r'\b' + re.escape(term) + r'\b', f['text'], re.I):
            rest += ' TERM %s' % term
            termed = True
        if f['_q'] and f['_a'] and qn < 4:
            rest += ' Q %s -> %s' % (f['_q'], f['_a'])
            qn += 1
        lines.append('%d %s [%d] %s' % (n, icon, n, rest))
    close = next((i for i in SPARE + ['🌟'] if i not in used), '🌟')
    lines.append('close %s [] A warm wrap-up of what the child just learned about %s.' % (close, title.lower()))
    return '\n'.join(lines) + '\n'


def register_schema(course, new):
    p = os.path.join(ROOT, 'js', 'schema.js')
    s = open(p, encoding='utf-8').read()
    var = SCHEMA_VAR[course]
    m = re.search(r'(const %s = \{)(.*?)(\n\};)' % var, s, re.S)
    if not m:
        raise SystemExit('cannot find %s in schema.js' % var)
    body = m.group(2)
    add, count = '', 0
    for sec, meta in new.items():
        if re.search(r'^\s*%s\s*:' % re.escape(sec), body, re.M):
            continue
        extra = ", tint: '#8fb8ff'" if course == 'body' else ''
        add += "\n  %s: { name: %s, glyph: %s%s }," % (sec + '', json.dumps(meta['name'], ensure_ascii=False),
                                                    json.dumps(meta['glyph'], ensure_ascii=False), extra)
        count += 1
    if add:
        body = body.rstrip()
        if not body.endswith(','):
            body += ','
        s = s[:m.start()] + m.group(1) + body + add + m.group(3) + s[m.end():]
        open(p, 'w', encoding='utf-8').write(s)
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--course', required=True)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--only')
    a = ap.parse_args()
    c = a.course
    written = json.load(open(os.path.join(ROOT, '.work', 'grow', 'written', c + '.json'), encoding='utf-8'))
    ex = json.load(open(os.path.join(ROOT, '.work', 'grow', 'existing-facts.json'), encoding='utf-8')).get(c, [])
    rows, batch, plans, newsecs, prov_all, bad = [], {}, [], {}, {}, 0
    for sec, spec in written.items():
        if sec.startswith('_') or (a.only and sec != a.only):
            continue
        src, facts, prov, problems = build_section(c, sec, spec, ex)
        if problems or len(facts) != len(spec['facts']):
            bad += 1
            print('PROBLEMS %s-%s:' % (c, sec))
            for p in problems:
                print('   -', p)
            continue
        lid = '%s-%s' % (c, sec)
        clean = [{k: v for k, v in f.items() if not k.startswith('_')} for f in facts]
        rows += clean
        batch[lid] = {'course': c, 'title': src['name'], 'section': sec, 'facts': clean}
        plans.append(plan_block(lid, src['name'], src['glyph'], facts, spec))
        newsecs[sec] = {'name': src['name'], 'glyph': src['glyph']}
        prov_all.update(prov)
    print('%s: %d sections ok, %d with problems, %d facts' % (c, len(newsecs), bad, len(rows)))
    if a.check or not rows:
        return 1 if bad else 0
    json.dump(rows, open(os.path.join(ROOT, '.work', 'entries-%s-g1.json' % c), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    json.dump(batch, open(os.path.join(ROOT, '.work', 'lesson-batch-%s-g1.json' % c), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    json.dump(prov_all, open(os.path.join(ROOT, '.work', 'grow', 'provenance-%s.json' % c), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    open(os.path.join(ROOT, '.work', 'lessons-plan', '%s-g1.txt' % c), 'w', encoding='utf-8').write(
        '# Story plans for %s (grown from sourced facts). Written by tools/grow/merge_facts.py\n\n' % c + '\n'.join(plans))
    print('registered %d new section(s) in schema.js' % register_schema(c, newsecs))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
