#!/bin/bash
# Rebuild the narration corpus. Double-click me.
#
# Order matters: gen_audio writes the manifest that everything downstream
# reads, and the two audits are cheap gates that catch the failures which are
# otherwise silent — a norm() divergence (browser voice on one line) and a
# missing clip (browser voice on one line).
set -e
cd "$(dirname "$0")"
.venv-tts/bin/python tools/gen_audio.py "$@"
.venv-tts/bin/python tools/check_norm.py
.venv-tts/bin/python tools/audit_resolve.py
echo
echo "Rendered and audited. Now listen to it:"
echo "  .venv-tts/bin/python tools/verify_phrases.py"
read -n1 -p "done - press any key"
