#!/usr/bin/env python3
"""Export the animal and plant lessons as source facts + plans for the drafter.

  python3 tools/species_batch.py

Writes
  .work/lesson-batch-species.json   same shape as lesson-batch-N.json: one numbered
                                    "fact" per species (everything the app knows about it)
  .work/species-ids.json            every species id, so a page can be checked against it
  .work/lessons-plan/species.txt    a plan per lesson: roll call, one page per species,
                                    a side-by-side page whose question is computed from
                                    the measured stats, and a warm close

A species lesson is five animals or plants from one group, so its shape is the same
every time. What changes is what is surprising about each, and the model finds that.
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

JS = r'''
const fs = require('fs');
const load = f => { const s = fs.readFileSync(f, 'utf8').replace(/^const (\w+)/gm, 'globalThis.$1'); eval(s); };
load('js/schema.js'); load('js/animals.js'); load('js/plants.js'); load('js/lessons.js');
const all = [...ANIMALS, ...PLANTS];
const byId = Object.fromEntries(all.map(a => [a.id, a]));
const out = { ids: all.map(a => a.id), lessons: [] };
LESSONS.filter(l => l.kind === 'species').forEach(l => out.lessons.push({
  id: l.id, course: l.course, title: l.title, group: l.group, glyph: l.glyph,
  species: l.items.map(id => byId[id])
}));
console.log(JSON.stringify(out));
'''

STAT_WORDS = {'speed': ('mph', 'fastest', 'top speed'), 'weight': ('lb', 'heaviest', 'weight'),
              'length': ('ft', 'longest', 'length'), 'life': ('years', 'longest-lived', 'lifespan')}
KIND = {'found': 'measured or observed', 'record': 'history / on record',
        'worked': 'WORKED OUT, never seen directly'}


def species_text(s):
    st = s.get('stats') or {}
    stats = ', '.join(f"{k} {v} {STAT_WORDS[k][0]}" for k, v in st.items() if k in STAT_WORDS)
    lines = [f"{s['name']}. {s.get('blurb', '')}"]
    if s.get('size'):
        lines.append(f"SIZE: {s['size']}")
    if stats:
        lines.append(f"STATS: {stats}")
    if s.get('wonder'):
        lines.append(f"WONDER: {s['wonder']}")
    for f in s.get('facts', []):
        lines.append(f"FACT ({KIND.get(f.get('kind'), 'measured or observed')}): {f['text']}"
                     + (f" {f['more']}" if f.get('more') else ''))
    return '\n     '.join(lines)


def compare(species):
    """The stat with the clearest single winner across all five, as a plan question."""
    best = None
    if len(species) < 3:
        return None
    for k, (unit, word, label) in STAT_WORDS.items():
        vals = [(s['stats'][k], s['name']) for s in species if (s.get('stats') or {}).get(k)]
        if len(vals) != len(species):
            continue
        vals.sort(reverse=True)
        if vals[0][0] == vals[1][0]:
            continue
        gap = vals[0][0] / max(vals[1][0], 0.001)
        if best is None or gap > best[0]:
            best = (gap, k, word, vals[0][1])
    return best


def main():
    r = subprocess.run(['node', '-e', JS], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[:2000])
    data = json.loads(r.stdout)
    batch, plans = {}, []
    for L in data['lessons']:
        sp = L['species']
        facts = [{'id': f"{L['id']}-s{k}", 'cat': 'species', 'kind': 'found',
                  'text': species_text(s), 'more': None} for k, s in enumerate(sp, 1)]
        batch[L['id']] = {'course': L['course'], 'title': L['title'], 'section': L['group'],
                          'facts': facts, 'species': [s['id'] for s in sp]}
        icon = '🐾' if L['course'] == 'animals' else '🌿'
        n = len(sp)
        count = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven'}[n]
        names = ', '.join(s['name'] for s in sp)
        lines = [f"=== {L['id']}",
                 f"hook: A roll call of the {count}: {names}. Ask the child which one they would most like to meet.",
                 f"1 {icon} [] Roll call. Name all {count} ({names}) and ask one curious question that makes the child want to meet "
                 f"{'it' if n == 1 else 'them'}. No facts yet."]
        qpages = {1, 3, 5} if n > 2 else {1, 2}
        for k, s in enumerate(sp, 1):
            q = ' Q write one question about the most surprising thing on this page, with its answer in the page' \
                if k in qpages else ''
            term = ' TERM pick one word from the facts a child would not know' if k == min(2, n) else ''
            lines.append(f"{k + 1} {icon} @{s['id']} [{k}] Meet the {s['name']}: its blurb and its most surprising fact, "
                         f"told fresh.{term}{q}")
        c = compare(sp)
        last = n + 2
        allf = ','.join(str(i) for i in range(1, n + 1))
        if c:
            _, key, word, winner = c
            lines.append(f"{last} 📊 [{allf}] Side by side. Use ONLY the STATS numbers exactly as given, with their units: never add, "
                         f"total, round or convert them. Exactly two blocks before the check: a short p naming the heaviest and the lightest "
                         f"with their exact numbers, and a short fact comparing the speeds that are given. "
                         f"Q which of the {count} is the {word} -> the {winner}")
        elif n > 1:
            lines.append(f"{last} 📊 [{allf}] Side by side: what the {count} have in common and what sets each apart.")
        else:
            last -= 1
        lines.append(f"close {icon} [] A warm wrap-up that names {'it' if n == 1 else 'them'} once more and teaches nothing new.")
        plans.append('\n'.join(lines))
    json.dump(batch, open(os.path.join(ROOT, '.work', 'lesson-batch-species.json'), 'w'),
              ensure_ascii=False, indent=1)
    json.dump(data['ids'], open(os.path.join(ROOT, '.work', 'species-ids.json'), 'w'))
    with open(os.path.join(ROOT, '.work', 'lessons-plan', 'species.txt'), 'w', encoding='utf-8') as f:
        f.write('# Auto-generated by tools/species_batch.py. A species lesson has one fixed shape.\n\n'
                + '\n\n'.join(plans) + '\n')
    print(f"{len(batch)} species lessons, {len(data['ids'])} species")


if __name__ == '__main__':
    main()
