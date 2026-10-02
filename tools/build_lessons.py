#!/usr/bin/env python3
"""Build js/lessons.js — the curriculum index that turns Wonder Lab's existing
content into LESSONS, grouped into COURSES, for the Lamplight-style journey
map (see the 2026-10 rewrite: lessons + quizzes instead of free browsing).

This is deliberately a thin INDEX, not a second copy of the content. A lesson
record for a fact-based subject is just {course, section} — the facts
themselves stay in their one canonical place (ANCIENT, PHYSICAL, BODY, ...)
and js/app.js looks them up at render time. A species lesson is a list of
ids into ANIMALS/PLANTS. Nothing here is prose a human wrote; it is JSON
dumped straight out of Node, same discipline as gen_audio.py's corpus walker.

  .venv-tts/bin/python tools/build_lessons.py     (node not required —
  pure node -e eval, same pattern as gen_audio.py's corpus())

Chunk size for species courses: 5 per lesson. Average species facts-count
and Lamplight's own 6-11 page range both point at a lesson with 1 intro page
+ 2 fact pages per species (15 pages for 5 species) sitting a little high,
so species lessons show 1 intro + 1 fact page per species (10 pages for 5) —
right in Lamplight's band.
"""
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'lessons.js')

CHUNK = 5

# Fact-based subjects: course id -> (TOPIC_SETS key or 'body', display handled
# by TOPIC_SETS/BODY_SECTIONS already in schema.js — nothing new to author).
FACT_COURSES = ['earth', 'astro', 'physical', 'micro',
                 'ancient', 'america', 'world', 'economics']

_DUMP = r'''
const fs = require('fs');
const load = f => { const s = fs.readFileSync(f, 'utf8')
  .replace(/^const (\w+)/gm, 'globalThis.$1'); eval(s); };
load('js/schema.js'); load('js/animals.js'); load('js/body.js');
load('js/plants.js'); load('js/earth.js'); load('js/astro.js');
['ancient', 'america', 'world', 'micro', 'physical', 'economics']
  .forEach(f => load('js/' + f + '.js'));

const out = { courses: [], lessons: [] };

// ── fact-based courses: one lesson per existing SECTION ──
const FACT = %s;
FACT.forEach(key => {
  const t = TOPIC_SETS[key];
  const rows = globalThis[t.data] || [];
  const secs = globalThis[t.secs] || {};
  out.courses.push({ id: key, name: t.name, glyph: t.glyph, pat: t.pat, kind: 'facts' });
  Object.entries(secs).forEach(([sk, sv]) => {
    const n = rows.filter(r => r.section === sk).length;
    if (n) out.lessons.push({ id: key + '-' + sk, course: key, kind: 'facts',
      section: sk, title: sv.name, glyph: sv.glyph, n,
      // Default intro — a plain count, no setup. Overwritten below by
      // .work/lesson-curation.json wherever a real teaching intro exists.
      // Every lesson needs SOME string here, curated or not, because
      // gen_audio.py narrates L.intro for every lesson — never a runtime-
      // built string the corpus walker never saw.
      intro: `${n} thing${n === 1 ? '' : 's'} to discover about ${sv.name.toLowerCase()}.` });
  });
});

// ── Your Body: same shape, its own global (not in TOPIC_SETS) ──
out.courses.push({ id: 'body', name: 'Your Body', glyph: '🩺', pat: 'pulse', kind: 'facts' });
Object.entries(BODY_SECTIONS).forEach(([sk, sv]) => {
  const n = BODY.filter(r => r.section === sk).length;
  if (n) out.lessons.push({ id: 'body-' + sk, course: 'body', kind: 'facts',
    section: sk, title: sv.name, glyph: sv.glyph, n,
    intro: `${n} thing${n === 1 ? '' : 's'} to discover about ${sv.name.toLowerCase()}.` });
});

// ── species courses: chunk each GROUP into lessons of CHUNK ──
function chunkSpecies(course, rows, groups, chunk) {
  out.courses.push({ id: course, name: course === 'animals' ? 'Animals' : 'Plants',
    glyph: course === 'animals' ? '🦁' : '🌻',
    pat: course === 'animals' ? 'fur' : 'leaf', kind: 'species' });
  Object.keys(groups).forEach(gk => {
    const members = rows.filter(r => r.group === gk);
    if (!members.length) return;
    const g = groups[gk];
    const nChunks = Math.ceil(members.length / chunk);
    for (let i = 0; i < nChunks; i++) {
      const items = members.slice(i * chunk, i * chunk + chunk).map(r => r.id);
      out.lessons.push({ id: course + '-' + gk + '-' + (i + 1), course, kind: 'species',
        group: gk, title: g.name + (nChunks > 1 ? ' ' + romanNumeral(i + 1) : ''),
        glyph: g.glyph, tint: g.tint, items,
        // Each species page already opens with its own blurb — real local
        // context — so the lesson-level intro only needs to say what's ahead.
        // A count-plus-plural-name sentence breaks on a group's last, short
        // chunk ("Meet 1 worms & slugs.") — both the grammar and, it turned
        // out, the Kokoro render (a near-silent clip). This phrasing needs
        // no singular/plural agreement at any count.
        intro: `${g.name} — ${items.length} to meet.` });
    }
  });
}
function romanNumeral(n) {
  const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = '', v = n;
  for (const [val, sym] of map) while (v >= val) { s += sym; v -= val; }
  return s;
}
chunkSpecies('animals', ANIMALS, GROUPS, %d);
chunkSpecies('plants', PLANTS, PLANT_GROUPS, %d);

console.log(JSON.stringify(out));
'''


CURATION = os.path.join(ROOT, '.work', 'lesson-curation.json')
QUIZ = os.path.join(ROOT, '.work', 'lesson-quiz.json')


def main():
    script = _DUMP % (json.dumps(FACT_COURSES), CHUNK, CHUNK)
    r = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('node dump failed:\n' + r.stderr[:2000])
    data = json.loads(r.stdout)

    # Hand-curated teaching intros + fact ordering (tools/apply_lesson_intros.py),
    # tracked like .work/entries-*.json. Merged back in on every rebuild so a
    # content regeneration never silently drops them.
    curated = 0
    if os.path.exists(CURATION):
        curation = json.load(open(CURATION, encoding='utf-8'))
        for lesson in data['lessons']:
            c = curation.get(lesson['id'])
            if c:
                lesson['intro'] = c['intro']
                lesson['order'] = c['order']
                curated += 1
    print(f'{curated} lesson(s) carry a curated intro + order')

    # Hand-written quiz questions (tools/BRIEF-lesson-intros.md's sibling task:
    # every fact-course quiz replaced the auto-generated redacted-sentence
    # questions — "huge true/false questions with tons of facts" was the exact
    # complaint, and no amount of regex tuning fixes a question nobody wrote.
    # Written directly, not delegated, reading every fact first.
    quizzed = 0
    if os.path.exists(QUIZ):
        quizzes = json.load(open(QUIZ, encoding='utf-8'))
        for lesson in data['lessons']:
            q = quizzes.get(lesson['id'])
            if q:
                lesson['quiz'] = q
                quizzed += 1
    print(f'{quizzed} lesson(s) carry a hand-written quiz')

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Wonder Lab curriculum index. Generated by tools/build_lessons.py\n')
        f.write('// A thin index over the content already in ANIMALS/PLANTS/ANCIENT/etc. —\n')
        f.write('// no fact text is duplicated here. See js/app.js lessonPages() for how a\n')
        f.write('// lesson\'s pages are assembled at render time from its course + section\n')
        f.write('// (fact courses) or its item id list (species courses).\n')
        f.write(f'// {len(data["courses"])} courses, {len(data["lessons"])} lessons.\n')
        f.write('const COURSES = ')
        json.dump(data['courses'], f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\nglobalThis.COURSES = COURSES;\n')
        f.write('const LESSONS = ')
        json.dump(data['lessons'], f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\nglobalThis.LESSONS = LESSONS;\n')

    by_course = {}
    for lesson in data['lessons']:
        by_course[lesson['course']] = by_course.get(lesson['course'], 0) + 1
    print(f'{len(data["courses"])} courses, {len(data["lessons"])} lessons -> {OUT}')
    for c in data['courses']:
        print(f'  {c["id"]:<10} {by_course.get(c["id"], 0)} lessons')


if __name__ == '__main__':
    main()
