#!/usr/bin/env python3
"""Replace the quiz of lessons in .work/lessons-src/<course>.txt (old text format).

  python3 tools/grow/set_quiz.py plants .work/prompt-fixes/quiz-plants.json

JSON: {"<lesson id>": [{"q": "prompt", "right": "...", "wrong": ["...", "..."], "explain": "..."}, ...]}
Answer slots are balanced afterwards by apply_prompt_fixes.py.
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
course, spec_path = sys.argv[1], sys.argv[2]
spec = json.load(open(spec_path, encoding='utf-8'))
p = os.path.join(ROOT, '.work', 'lessons-src', course + '.txt')
lines = open(p, encoding='utf-8').read().split('\n')
out, i, done = [], 0, set()
cur = None
while i < len(lines):
    ln = lines[i]
    m = re.match(r'=== (\S+)', ln)
    if m:
        cur = m.group(1)
    if cur in spec and cur not in done and re.match(r'quiz:', ln):
        # drop every quiz block of this lesson (quiz blocks run to the end of the lesson block)
        j = i
        while j < len(lines) and not re.match(r'(# UNREVIEWED|=== )', lines[j]):
            j += 1
        for q in spec[cur]:
            out.append('quiz: ' + q['q'])
            out.append('+ ' + q['right'])
            for w in q['wrong']:
                out.append('- ' + w)
            out.append('explain: ' + q['explain'])
            out.append('')
        done.add(cur)
        i = j
        continue
    out.append(ln)
    i += 1
open(p, 'w', encoding='utf-8').write('\n'.join(out))
missing = set(spec) - done
print('%s: replaced the quiz of %d lesson(s)%s' % (course, len(done), (', NOT FOUND: %s' % sorted(missing)) if missing else ''))
