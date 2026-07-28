#!/usr/bin/env python3
"""Run the real player's resolve() over every narratable string.

This is the ship gate. It loads js/audio.js in node with the actual manifest
attached and asks the same question the app will ask at runtime: does this
string have its own recording?

  clip     one pre-generated file. The only acceptable answer.
  stitched several word clips joined. Prose assembled this way sounds like a
           list being read; RULE 8 forbids it. Cannot happen in this app —
           there are no single-word clips to stitch from — so seeing one means
           the manifest shape changed.
  tts      the browser synthesiser. A build defect, not a fallback: different
           voice per device, and silent on iOS until a user gesture.

  .venv-tts/bin/python tools/audit_resolve.py
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK
os.environ.setdefault('HF_HOME', os.path.join(ROOT, '.work', 'hf'))

sys.path.insert(0, os.path.join(ROOT, 'tools'))
from gen_audio import corpus                              # noqa: E402

JS = r'''
globalThis.fetch = () => Promise.reject();
globalThis.document = { addEventListener() {}, removeEventListener() {} };
// audio.js now derives AUDIO_BASE from location at load time.
globalThis.location = { hostname: 'localhost', protocol: 'http:', origin: 'http://localhost' };
const fs = require('fs');
const AudioLib = eval(fs.readFileSync('js/audio.js', 'utf8') + '; AudioLib');
AudioLib.manifest = JSON.parse(fs.readFileSync('audio/manifest.json', 'utf8'));
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
lines.pop();
console.log(JSON.stringify(lines.map(l => AudioLib.resolve(l).kind)));
'''


def main():
    strings = [k for k, _ in corpus() if '\n' not in k]
    src = os.path.join(_WORK, 'resolve-corpus.txt')
    with open(src, 'w', encoding='utf-8') as f:
        f.write('\n'.join(strings) + '\n')
    js_file = os.path.join(_WORK, 'resolve-audit.js')
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(JS)

    r = subprocess.run(['node', js_file, src], cwd=ROOT,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print('node failed:\n' + r.stderr[:600])
        return 1
    kinds = json.loads(r.stdout)

    counts = {}
    bad = []
    for s, k in zip(strings, kinds):
        counts[k] = counts.get(k, 0) + 1
        if k != 'clip':
            bad.append((k, s))

    print(f'{len(strings)} narratable strings -> {counts}')
    for k, s in bad[:20]:
        print(f'  {k.upper():8} {s[:80]!r}')
    if bad:
        print(f'\n{len(bad)} string(s) would not play from a recording.')
        return 1
    print('every narratable string resolves to its own clip')
    return 0


if __name__ == '__main__':
    sys.exit(main())
