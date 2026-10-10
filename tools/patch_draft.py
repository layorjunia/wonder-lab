#!/usr/bin/env python3
"""Fix a drafted lesson with find-and-replace lines read from stdin.

  python3 tools/patch_draft.py earth-volcanoes <<'EOF2'
  old text ||| new text
  a whole line to delete\n ||| 
  EOF2

Each line is `old ||| new`. `old` must occur exactly once in the draft (so a typo cannot
silently patch the wrong place); \\n in either side means a newline. Anything after a
line that is just `---REPLACE-ALL---` is taken as the complete new text of the draft.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS = os.path.join(ROOT, '.work', 'lessons-draft')


def main():
    lid = sys.argv[1]
    path = os.path.join(DRAFTS, lid + '.txt')
    text = open(path, encoding='utf-8').read()
    body = sys.stdin.read()
    if '---REPLACE-ALL---' in body:
        text = body.split('---REPLACE-ALL---', 1)[1].lstrip('\n')
        open(path, 'w', encoding='utf-8').write(text if text.endswith('\n') else text + '\n')
        print(f'{lid}: replaced whole draft')
        return
    bad = 0
    for n, line in enumerate(body.splitlines(), 1):
        if not line.strip():
            continue
        if ' ||| ' not in line and not line.endswith(' |||'):
            print(f'line {n}: no |||'); bad += 1; continue
        old, new = line.split('|||', 1)
        old, new = old.rstrip(' ').replace('\\n', '\n'), new.lstrip(' ').replace('\\n', '\n')
        c = text.count(old)
        if c != 1:
            print(f'line {n}: "{old[:50]}" occurs {c} times'); bad += 1; continue
        text = text.replace(old, new, 1)
    if bad:
        print(f'{lid}: NOT written ({bad} bad line(s))'); sys.exit(1)
    open(path, 'w', encoding='utf-8').write(text)
    print(f'{lid}: patched')


if __name__ == '__main__':
    main()
