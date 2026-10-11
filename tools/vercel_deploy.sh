#!/bin/bash
# One Vercel production deploy of Wonder Lab, with a size guard.
#
#   bash tools/vercel_deploy.sh
#
# 1. refuses if the upload would be over 100 MB (see tools/upload_size.py)
# 2. deploys once (Git pushes no longer deploy by themselves: vercel.json has
#    "git": {"deploymentEnabled": false}, so this is the ONLY way the site ships)
# 3. waits until the live site reports the build id that is in version.json
#
# The free Vercel plan keeps every deployment in a 10 GB Deployment Storage cap,
# so one slim deploy per release is the rule.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 tools/upload_size.py . --max-mb 100

vercel deploy --prod --yes --scope layor-junia

want=$(python3 -c "import json;print(json.load(open('version.json'))['build'])")
echo "waiting for the live site to report build $want ..."
for i in 1 2 3 4 5 6 7 8; do
  got=$(curl -fsS -m 15 "https://wonder-lab-ecru.vercel.app/version.json?$(date +%s)" 2>/dev/null \
        | python3 -c "import sys,json;print(json.load(sys.stdin)['build'])" 2>/dev/null || true)
  if [ "$got" = "$want" ]; then echo "live: $got"; exit 0; fi
  sleep 5
done
echo "WARNING: the live site reports '${got:-nothing}', expected '$want'" >&2
exit 2
