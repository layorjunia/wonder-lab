#!/bin/bash
# Render, audit, stamp, publish. Double-click me.
#
# set -e so a failed audit stops the deploy. Stamping BEFORE the commit is
# what makes installed devices notice the new build; stamp after and every
# iPad keeps running the old one forever with no error anywhere.
set -e
cd "$(dirname "$0")"
.venv-tts/bin/python tools/gen_audio.py
.venv-tts/bin/python tools/check_norm.py
.venv-tts/bin/python tools/audit_resolve.py
.venv-tts/bin/python tools/stamp_version.py
git add -A
git commit -m "content + audio"
git push origin main
gh api repos/layorjunia/wonder-lab/pages/builds -X POST --silent || true
read -n1 -p "deployed - press any key"
