#!/usr/bin/env python3
"""Apply the FIX lines from an audit report to a lessons source file.

    python3 tools/apply_audit_fixes.py .work/audit/agent-animals.md .work/lessons-src/animals.txt [--write]

A report looks like:

    ## animals-mammals-3
    - **p.2 | HIGH** — description (may say "medium confidence")
      FIX: <old text> ||| <new text>

Every FIX is applied inside its own lesson's block only, and must match exactly
once (twice is allowed when the line is tagged "apply to both"). Anything that
does not match, or whose finding is marked "medium confidence", is listed and
left alone for a person to look at. Without --write nothing is changed.
"""
import re
import sys

BOTH = re.compile(r'\s*\((?:apply to both[^)]*|both[^)]*)\)\s*$', re.I)


def parse_report(text):
    fixes = []                      # (lesson, header, desc, old, new, both)
    lesson, header, desc = None, '', ''
    for raw in text.split('\n'):
        m = re.match(r'^##\s+(\S+)\s*$', raw)
        if m and not raw.startswith('## Summary'):
            lesson = m.group(1)
            continue
        m = re.match(r'^- \*\*(.+?)\*\*\s*[—-]\s*(.*)$', raw)
        if m:
            header, desc = m.group(1), m.group(2)
            continue
        m = re.match(r'^\s+FIX: ?(.*)$', raw)
        if m and lesson:
            body = m.group(1)
            both = bool(re.search(r'apply to both|both the check', body, re.I)) or 'apply to both' in desc.lower()
            body = BOTH.sub('', body)
            if ' ||| ' in body:
                old, new = body.split(' ||| ', 1)
            elif body.endswith(' |||'):
                old, new = body[:-4], ''
            else:
                fixes.append((lesson, header, desc, None, None, both))
                continue
            old, new = old.replace('\\n', '\n'), new.replace('\\n', '\n')
            fixes.append((lesson, header, desc, old, new, both))
    return fixes


def blocks(text):
    """[(id, start, end)] character spans of each lesson, markers included."""
    heads = [(m.start(), m.group(1)) for m in re.finditer(r'(?m)^=== (\S+)', text)]
    out = []
    for i, (pos, lid) in enumerate(heads):
        # the span starts at the comment lines directly above the header
        start = pos
        while True:
            prev = text.rfind('\n', 0, start - 1)
            line = text[prev + 1:start - 1] if start > 0 else ''
            if line.startswith('#'):
                start = prev + 1
            else:
                break
        end = heads[i + 1][0] if i + 1 < len(heads) else len(text)
        out.append((lid, start, end))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    accept_review = '--review' in sys.argv          # also apply the "medium confidence" fixes
    skip_text = [a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--skip=')]
    report, target = args[0], args[1]
    fixes = parse_report(open(report, encoding='utf-8').read())
    text = open(target, encoding='utf-8').read()
    spans = {lid: (s, e) for lid, s, e in blocks(text)}
    applied = failed = skipped = 0
    notes = []
    # apply bottom-up per lesson by re-slicing each time (blocks shift as text changes)
    for lesson, header, desc, old, new, both in fixes:
        if lesson not in spans:
            notes.append(f'NOLESSON {lesson}: {header}')
            failed += 1
            continue
        if old is None:
            notes.append(f'UNPARSED {lesson} [{header}]')
            failed += 1
            continue
        if skip_text and any(t in old or t in new for t in skip_text):
            notes.append(f'SKIPPED {lesson} [{header}]: {old[:70]!r}')
            skipped += 1
            continue
        if not accept_review and re.search(r'medium confidence|verify the source|check against a source', header + ' ' + desc, re.I):
            notes.append(f'REVIEW {lesson} [{header}]: {old[:70]!r} -> {new[:70]!r}')
            skipped += 1
            continue
        spans = {lid: (s, e) for lid, s, e in blocks(text)}
        s, e = spans[lesson]
        block = text[s:e]
        if new and new in block and old in new:
            continue                      # an expanding fix that is already in (re-running a report)
        n = block.count(old)
        if n == 0:
            notes.append(f'NOMATCH {lesson} [{header}]: {old[:90]!r}')
            failed += 1
            continue
        if n > 1 and not both:
            notes.append(f'MULTI({n}) {lesson} [{header}]: {old[:90]!r}')
            failed += 1
            continue
        block = block.replace(old, new)
        text = text[:s] + block + text[e:]
        applied += 1
    print(f'applied {applied}, not matched {failed}, left for review {skipped}')
    for n in notes:
        print('  ' + n)
    if write:
        open(target, 'w', encoding='utf-8').write(text)
        print('written', target)


if __name__ == '__main__':
    main()
