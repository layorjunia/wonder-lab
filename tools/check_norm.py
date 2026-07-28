#!/usr/bin/env python3
"""Prove the Python and JavaScript norm() agree, character for character.

They are one function written twice, and a divergence is silent: fileFor()
returns null, resolve() drops to 'tts', and one line mid-screen speaks in the
browser voice while everything around it is fine. Nothing is logged. On iOS
with no synthesiser voice loaded, that line is simply silent.

Runs the whole corpus plus every manifest key through both implementations and
diffs. Seconds to run, and the only thing that catches the failure.

  .venv-tts/bin/python tools/check_norm.py
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
from gen_audio import corpus, norm                      # noqa: E402

# Loading audio.js in node needs two stubs: it ends with a bare AudioLib.init()
# that calls fetch() and document.addEventListener at load time, and its
# `const AudioLib` does not escape eval() on its own.
JS = r'''
globalThis.fetch = () => Promise.reject();
globalThis.document = { addEventListener() {}, removeEventListener() {} };
// audio.js now derives AUDIO_BASE from location at load time.
globalThis.location = { hostname: 'localhost', protocol: 'http:', origin: 'http://localhost' };
const fs = require('fs');
const AudioLib = eval(fs.readFileSync('js/audio.js', 'utf8') + '; AudioLib');
// argv[2], not argv[1]: the guide's snippet assumes `node -e`, where there is
// no script path in argv. This writes a real file, so the arg shifts by one.
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
lines.pop();
console.log(lines.map(l => AudioLib.norm(l)).join('\n'));
'''


def main():
    strings = []
    for key, _ in corpus():
        strings.append(key)
    mpath = os.path.join(ROOT, 'audio', 'manifest.json')
    if os.path.exists(mpath):
        strings += list(json.load(open(mpath, encoding='utf-8'))['words'])
    # newline-delimited, so anything containing a newline cannot be compared
    strings = sorted({s for s in strings if '\n' not in s})
    print(f'{len(strings)} unique strings')

    src = os.path.join(_WORK, 'norm-corpus.txt')
    with open(src, 'w', encoding='utf-8') as f:
        f.write('\n'.join(strings) + '\n')
    js_file = os.path.join(_WORK, 'norm-check.js')
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(JS)

    r = subprocess.run(['node', js_file, src], cwd=ROOT,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print('node failed:\n' + r.stderr[:600])
        return 1
    js_out = r.stdout.split('\n')
    if js_out and js_out[-1] == '':
        js_out.pop()

    if len(js_out) != len(strings):
        print(f'line count mismatch: python {len(strings)}, js {len(js_out)}')
        return 1

    bad = [(s, norm(s), j) for s, j in zip(strings, js_out) if norm(s) != j]
    for s, p, j in bad[:12]:
        print(f'  MISMATCH {s[:60]!r}\n    py: {p[:70]!r}\n    js: {j[:70]!r}')
    print(f'{len(bad)} mismatch(es)')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
