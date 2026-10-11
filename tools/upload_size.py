#!/usr/bin/env python3
"""How big would a `vercel deploy` of this folder be?  Refuses when it is too big.

    python3 tools/upload_size.py [folder] [--max-mb 100] [--top 8]

Applies the same rules the Vercel CLI does: its built-in ignores (.git,
node_modules, .vercel, ...) plus the folder's .vercelignore (gitignore syntax).
Exit 0 = fine, 1 = over the limit (prints what is heavy so the ignore file can
be fixed), so a release script can stop before uploading hundreds of MB.

Why this exists: on 2026-10-10 each deploy shipped ~585 MB (ios-app/ and
.claude/ were not ignored) and filled the free 10 GB Deployment Storage cap.
The real site is ~20 MB.
"""
import fnmatch
import os
import sys

BUILTIN = ['.git', '.hg', '.svn', '.vercel', '.next', 'node_modules', '.DS_Store',
           '.env.local', '__pycache__', 'venv', '.venv']


def load_rules(root):
    rules = []
    path = os.path.join(root, '.vercelignore')
    if not os.path.exists(path):
        return rules
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n').strip()
        if not line or line.startswith('#'):
            continue
        neg = line.startswith('!')
        if neg:
            line = line[1:]
        dir_only = line.endswith('/')
        line = line.rstrip('/')
        anchored = '/' in line
        line = line.lstrip('/')
        rules.append((neg, dir_only, anchored, line.replace('**', '*')))
    return rules


def ignored(rel, is_dir, rules):
    name = os.path.basename(rel)
    if name in BUILTIN:
        return True
    verdict = False
    for neg, dir_only, anchored, pat in rules:
        if dir_only and not is_dir:
            continue
        hit = fnmatch.fnmatch(rel, pat) if anchored else fnmatch.fnmatch(name, pat)
        if hit:
            verdict = not neg
    return verdict


def measure(root):
    rules = load_rules(root)
    total = 0
    count = 0
    by_top = {}
    for cur, dirs, files in os.walk(root):
        rel_dir = os.path.relpath(cur, root)
        rel_dir = '' if rel_dir == '.' else rel_dir
        dirs[:] = [d for d in dirs if not ignored(os.path.join(rel_dir, d), True, rules)]
        for f in files:
            rel = os.path.join(rel_dir, f)
            if ignored(rel, False, rules):
                continue
            try:
                size = os.path.getsize(os.path.join(cur, f))
            except OSError:
                continue
            total += size
            count += 1
            top = rel.split(os.sep)[0] if os.sep in rel else '(top level files)'
            by_top[top] = by_top.get(top, 0) + size
    return total, count, by_top


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    root = os.path.abspath(args[0]) if args and not args[0].replace('.', '').isdigit() else os.getcwd()
    limit = 100.0
    top_n = 8
    argv = sys.argv[1:]
    if '--max-mb' in argv:
        limit = float(argv[argv.index('--max-mb') + 1])
    if '--top' in argv:
        top_n = int(argv[argv.index('--top') + 1])
    # a bare number after a flag is that flag's value, not the folder
    if args and args[0] in (str(limit), str(int(limit)), str(top_n)):
        root = os.getcwd()
    total, count, by_top = measure(root)
    mb = total / 1e6
    print(f'Vercel upload size: {mb:,.1f} MB in {count:,} files (limit {limit:g} MB)')
    for name, size in sorted(by_top.items(), key=lambda kv: -kv[1])[:top_n]:
        print(f'  {size / 1e6:8,.1f} MB  {name}')
    if mb > limit:
        print(f'\nREFUSING: over {limit:g} MB. Add the heavy folders above to .vercelignore '
              f'(or pass --max-mb if this is really intended).')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
