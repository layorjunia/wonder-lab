#!/bin/bash
# Publish the current build as an over-the-air update for the native iPad app.
#
#   bash scripts/deploy-ota.sh
#
# Copies Wonder Lab's web app into www with a fresh version.json, then deploys
# www to Firebase Hosting: site wonder-lab-ota (https://wonder-lab-ota.web.app)
# in project homeschool-apps. Installed apps find the new version.json,
# download only the files that changed, and switch to them (js/updates.js).
#
# This does NOT touch the Ad Hoc .ipa or the App Store Connect profile — run
# this for ordinary content and code changes. Only re-run publish-adhoc.sh
# for a change to native (Swift/Xcode project) code, a newly added iPad, or
# before the Distribution certificate expires (2027-09-17).
set -e
cd "$(dirname "$0")/.."
python3 scripts/sync-web.py
firebase deploy --only hosting --project homeschool-apps --non-interactive
