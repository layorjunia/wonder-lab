#!/usr/bin/env python3
"""Write .work/AUDIT.md: what the unattended build produced and what a person should look at first."""
import glob
import json
import os
import re
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, '.work')


def tail(path, n=4):
    return '\n'.join(open(path, errors='replace').read().strip().splitlines()[-n:]) if os.path.exists(path) else '(no output)'


def main():
    rev, unrev = {}, {}
    for f in sorted(glob.glob(os.path.join(W, 'lessons-src', '*.txt'))):
        lines = open(f, encoding='utf-8').read().splitlines()
        for i, l in enumerate(lines):
            m = re.match(r'^=== (\S+)', l)
            if m:
                (unrev if i and lines[i - 1].startswith('# UNREVIEWED') else rev)[m.group(1)] = os.path.basename(f)[:-4]
    fin = json.load(open(os.path.join(W, 'audit', 'finalize.json'))) if os.path.exists(os.path.join(W, 'audit', 'finalize.json')) else {'needs_work': {}}
    notes = {os.path.basename(p)[:-4]: open(p).read().strip() for p in glob.glob(os.path.join(W, 'audit', 'notes', '*.txt'))}
    by = lambda d: {c: sorted(k for k, v in d.items() if v == c) for c in sorted(set(d.values()))}
    out = [f'# Wonder Lab build audit — {time.strftime("%Y-%m-%d %H:%M")}', '',
           f'- **{len(rev)}** lessons read and approved by hand (the audit does not need to revisit these).',
           f'- **{len(unrev)}** lessons written by the local model, checked by the gates, and **not yet read by a person**.',
           f'- **{len(fin["needs_work"])}** drafts failed the gate and are NOT in the app yet.', '',
           '## Audit these first (unreviewed lessons, by course)']
    for c, ids in by(unrev).items():
        out.append(f'- **{c}** ({len(ids)}): ' + ', '.join(ids))
    out += ['', '## Drafts that still fail the gate (not in the app)']
    for k, v in fin['needs_work'].items():
        out.append(f'- `{k}`: ' + '; '.join(v)[:240])
    out += ['', '## Leftover notes the model could not fix itself (lesson: notes)']
    for k, v in notes.items():
        if k in unrev:
            out.append(f'- `{k}`: ' + v.replace('\n', ' | ')[:300])
    out += ['', '## Gates', '```', tail(os.path.join(W, 'check-lessons.log')), tail(os.path.join(W, 'check-norm.log')),
            tail(os.path.join(W, 'audit-resolve.log')), '```', '',
            '## How to audit', 'Open a course in the preview, play its unreviewed lessons, and tell me what reads badly. '
            'I fix the lesson text in `.work/lessons-src/<course>.txt` (the `# UNREVIEWED` line is removed once a lesson is approved) '
            'and re-render only the changed audio.']
    open(os.path.join(W, 'AUDIT.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print('wrote .work/AUDIT.md')


if __name__ == '__main__':
    main()
