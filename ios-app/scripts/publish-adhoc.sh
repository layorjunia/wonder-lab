#!/bin/bash
# Build Wonder Lab as a real (native) app for the family's registered iPads
# and publish its install link.
#
#   bash scripts/publish-adhoc.sh
#
# Ad Hoc, same pattern as Lamplight and the Piano App (see ~/.claude/CLAUDE.md,
# "iOS: putting an app on the family's iPads"). Only iPads registered in the
# developer account can install it. Content and code still arrive over the air
# from wonder-lab-ota.web.app (see scripts/deploy-ota.sh) once installed, so
# this script only needs re-running for a NATIVE change, a new iPad, or before
# the profile expires (2027-09-17, with the Apple Distribution certificate).
#
# Hosted on Vercel (project wonder-lab-adhoc, team layor-junia, signed in as
# rileyinterested — never Illuminate's), kept separate from the PWA
# (wonder-lab-ecru.vercel.app) and the OTA content site so the ~40 MB .ipa
# never ends up in either.
set -e
cd "$(dirname "$0")/.."
KEY_ID="L58U29F65J"
ISSUER="77719da1-93f7-438f-8bc5-796eefc91031"
KEY="/Users/jacob/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
BUNDLE="com.illuminatedrones.wonderlab"
PROFILE="Wonder Lab AdHoc"
TEAM="B4U26FR445"
BASE="https://wonder-lab-adhoc.vercel.app"
BUILD=$(date +%Y%m%d%H%M)
BUILD_DIR="$(pwd)/build"
mkdir -p "$BUILD_DIR"

# Not /tmp: macOS's nightly cleanup deletes old files there and breaks cached
# SwiftPM checkouts.
ARCHIVE="$BUILD_DIR/WonderLab-$BUILD.xcarchive"
EXPORT="$BUILD_DIR/export-$BUILD"

# Keep only the newest few exports and archives (each archive is ~150 MB).
ls -1dt "$BUILD_DIR"/WonderLab-*.xcarchive 2>/dev/null | tail -n +3 | xargs rm -rf
ls -1dt "$BUILD_DIR"/export-* 2>/dev/null | tail -n +3 | xargs rm -rf

echo "== syncing web content into the native bundle =="
python3 scripts/sync-web.py
npx cap sync ios

echo "== refreshing the Ad Hoc provisioning profile =="
python3 scripts/adhoc_profile.py

echo "== archiving (build $BUILD) =="
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER" \
  CURRENT_PROJECT_VERSION="$BUILD" archive

cat > "$BUILD_DIR/ExportOptions.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>release-testing</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict><key>$BUNDLE</key><string>$PROFILE</string></dict>
  <key>compileBitcode</key><false/>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST

echo "== exporting .ipa =="
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER"

IPA="$EXPORT/App.ipa"
[ -f "$IPA" ] || { echo "export failed — no .ipa produced"; exit 1; }

echo "== verifying signature =="
APP_IN_IPA=$(unzip -l "$IPA" | grep -o 'Payload/[^/]*\.app' | head -1)
TMP_CHECK="$BUILD_DIR/check-$BUILD"
rm -rf "$TMP_CHECK"; mkdir -p "$TMP_CHECK"
unzip -q "$IPA" -d "$TMP_CHECK"
codesign -v "$TMP_CHECK/$APP_IN_IPA"
codesign -dv --verbose=2 "$TMP_CHECK/$APP_IN_IPA" 2>&1 | grep "Authority=" | head -1
DEVICE_COUNT=$(security cms -D -i "$TMP_CHECK/$APP_IN_IPA/embedded.mobileprovision" 2>/dev/null \
  | plutil -extract ProvisionedDevices xml1 -o - - 2>/dev/null | grep -c '<string>' || echo '?')
echo "embedded profile provisions $DEVICE_COUNT device(s)"
rm -rf "$TMP_CHECK"

echo "== publishing install page =="
SITE="$BUILD_DIR/install-site"
rm -rf "$SITE"; mkdir -p "$SITE/public"
cp "$IPA" "$SITE/public/WonderLab.ipa"
ICON_SRC="../../icons/icon-512.png"
sips -z 512 512 "$ICON_SRC" --out "$SITE/public/icon-512.png" > /dev/null
sips -z 57 57 "$ICON_SRC" --out "$SITE/public/icon-57.png" > /dev/null
VERSION="1.0"
SIZE_MB=$(du -m "$SITE/public/WonderLab.ipa" | cut -f1)

cat > "$SITE/public/manifest.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array><dict>
    <key>assets</key><array>
      <dict><key>kind</key><string>software-package</string><key>url</key><string>$BASE/WonderLab.ipa?b=$BUILD</string></dict>
      <dict><key>kind</key><string>display-image</string><key>url</key><string>$BASE/icon-57.png</string></dict>
      <dict><key>kind</key><string>full-size-image</string><key>url</key><string>$BASE/icon-512.png</string></dict>
    </array>
    <key>metadata</key><dict>
      <key>bundle-identifier</key><string>$BUNDLE</string>
      <key>bundle-version</key><string>$VERSION</string>
      <key>kind</key><string>software</string>
      <key>title</key><string>Wonder Lab</string>
    </dict>
  </dict></array>
</dict>
</plist>
PLIST

cat > "$SITE/public/index.html" << HTML
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install Wonder Lab</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#0d1621;color:#eef4fa;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;margin:0;padding:24px;text-align:center}
  img{width:120px;height:120px;border-radius:26px;margin-bottom:20px}
  .button{display:inline-block;background:#a8f062;color:#10240a;font-weight:700;
          padding:16px 32px;border-radius:14px;text-decoration:none;font-size:1.1rem;margin-top:16px}
  small{display:block;margin-top:18px;color:#8598ab;max-width:320px;line-height:1.5}
</style></head><body>
  <img src="icon-512.png" alt="Wonder Lab">
  <h1>Wonder Lab</h1>
  <a class="button" href="itms-services://?action=download-manifest&url=$BASE/manifest.plist">Install Wonder Lab</a>
  <small>Open this page in Safari on the iPad. After tapping Install, go to the Home Screen
  and wait for the icon to finish.<br>Version $VERSION · build $BUILD · ${SIZE_MB} MB ·
  for the family's registered iPads</small>
</body></html>
HTML

cd "$SITE/public"
[ -f .vercel/project.json ] || npx --yes vercel@latest link --yes --project wonder-lab-adhoc --scope layor-junia
npx --yes vercel@latest deploy --prod --yes --scope layor-junia

echo "== verifying the deploy propagated =="
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -r 0-0 "$BASE/WonderLab.ipa")
  [ "$CODE" = "200" ] || [ "$CODE" = "206" ] && break
  sleep 3
done
curl -s -o /dev/null -w 'install page: %{http_code}\n' "$BASE/"
curl -s -o /dev/null -w 'manifest.plist: %{http_code}\n' "$BASE/manifest.plist"
curl -s -o /dev/null -w 'WonderLab.ipa: %{http_code}\n' -r 0-0 "$BASE/WonderLab.ipa"

echo
echo "Install link: $BASE/"
