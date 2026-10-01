#!/usr/bin/env python3
"""Copy Wonder Lab's web app into the Capacitor bundle (ios-app/www) and write
its OTA version.json.

  python3 scripts/sync-web.py
  npx cap sync ios        # (or: npm run sync, which does both)

The native app bundles everything EXCEPT the voice corpus — audio/ is ~340 MB
and already served cross-origin from GitHub Pages (js/audio.js's AUDIO_BASE),
and WKWebView can fetch an absolute https:// URL exactly like a browser can,
so there is no reason to ship it twice. Bundling it would also blow past
Apple's practical over-the-air app-size expectations for an Ad Hoc .ipa.

Everything that DOES get bundled is versioned here the same way Lamplight
does it (see ../../Layor Apps/Bible App/iOS/scripts/sync-web.py): version.json
lists this build's id and every shipped file's short SHA-1 plus byte size, so
the native Updates module (js/updates.js) can diff against the previous build
and download only what changed, copying everything else forward from the
build already on the device.
"""
import hashlib
import json
import os
import shutil
import time

HERE = os.path.dirname(os.path.abspath(__file__))
IOS_APP = os.path.dirname(HERE)
ROOT = os.path.dirname(IOS_APP)            # wonder-lab/
WWW = os.path.join(IOS_APP, 'www')

# Everything at the Wonder Lab root that is actually part of the running app.
# Deliberately a list, not "copy everything except a blocklist" — a new
# top-level file (a .md, a .command launcher, a future tools/ dropping) must
# not silently end up inside the shipped app bundle.
COPY = [
    'index.html', 'manifest.json', 'sw.js',
    'css', 'fonts', 'icons', 'img', 'js',
]


def sha1_16(data):
    return hashlib.sha1(data).hexdigest()[:16]


def copy_tree():
    if os.path.exists(WWW):
        shutil.rmtree(WWW)
    os.makedirs(WWW)
    for name in COPY:
        src = os.path.join(ROOT, name)
        dst = os.path.join(WWW, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        elif os.path.exists(src):
            shutil.copy2(src, dst)
        else:
            raise SystemExit(f'sync-web: expected {src} to exist')


def write_version():
    files = {}
    for r, dirs, fs in os.walk(WWW):
        dirs.sort()
        for name in sorted(fs):
            path = os.path.join(r, name)
            rel = os.path.relpath(path, WWW).replace(os.sep, '/')
            with open(path, 'rb') as f:
                data = f.read()
            files[rel] = {'h': sha1_16(data), 'n': len(data)}
    build = time.strftime('%Y%m%d-%H%M')
    with open(os.path.join(WWW, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump({'build': build, 'files': files}, f, separators=(',', ':'))
    return build, len(files)


def main():
    copy_tree()
    build, n = write_version()
    total = sum(os.path.getsize(os.path.join(r, f))
                for r, _, fs in os.walk(WWW) for f in fs)
    print(f'synced {n} files ({total / 1048576:.1f} MB) -> {WWW}')
    print(f'build {build}')


if __name__ == '__main__':
    main()
