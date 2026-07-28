#!/usr/bin/env python3
"""Download freely-licensed animal photos from Wikimedia and bundle them.

Photos are the reason a 9-year-old believes an animal is real, so they ship
with the app rather than loading live — no internet, no broken links, no
surprise substitutions.

Licensing is enforced, not assumed. Only licences that actually permit
redistribution are accepted (public domain, CC0, CC BY, CC BY-SA), the required
attribution is captured for every single image, and anything whose licence
cannot be positively identified is rejected rather than shipped hopefully.
img/credits.json is the record, and the app shows it on a credits page.

  python3 tools/fetch_photos.py --species species.json
  python3 tools/fetch_photos.py --species species.json --limit 5   # try a few
"""
import argparse
import io
import json
import os
import tempfile
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK          # never the system temp dir
IMG = os.path.join(ROOT, 'img')
# Wikimedia asks for a contact in the User-Agent. A repo URL is the better
# choice than a personal address anyway, and this is a family project — it must
# not carry the Illuminate Drones business identity.
UA = ('WonderLabHomeschoolApp/1.0 (educational use; '
      'https://github.com/layorjunia/wonder-lab)')

# Licences that permit redistribution in a bundled app.
OK_LICENCE = re.compile(
    r'^(cc0|cc[ -]by([ -]sa)?([ -][0-9.]+)?|public domain|pd(-|$)|'
    r'no restrictions|attribution)', re.I)
# Explicitly refuse these even if they look permissive.
BAD_LICENCE = re.compile(r'(non[- ]?commercial|nc\b|nd\b|fair use|copyright)', re.I)

MAX_WIDTH = 900          # plenty for a full-bleed card on an iPad
JPEG_QUALITY = 82


def api(host, params):
    url = f'https://{host}/w/api.php?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip_html(s):
    s = re.sub(r'<[^>]+>', '', s or '')
    return re.sub(r'\s+', ' ', s).strip()


def commons_candidates(title, want=6):
    """Other images on the article, so a poor lead photo is not the only option."""
    try:
        d = api('en.wikipedia.org', {
            'action': 'query', 'format': 'json', 'formatversion': '2',
            'prop': 'images', 'imlimit': '40', 'titles': title,
        })
        pages = d.get('query', {}).get('pages', [])
        if not pages:
            return []
        out = []
        for im in pages[0].get('images', []):
            n = im['title']
            if not re.search(r'\.(jpg|jpeg|png)$', n, re.I):
                continue
            # skip interface furniture that rides along on every article
            if re.search(r'(icon|logo|commons|wiki|symbol|map|distribution|'
                         r'status[_ ]iucn|question|edit|padlock|ambox)', n, re.I):
                continue
            out.append(n.split(':', 1)[-1])
            if len(out) >= want:
                break
        return out
    except Exception:  # noqa: BLE001
        return []


def lead_image(title):
    """The photo Wikipedia itself chose for the article — usually the best one."""
    d = api('en.wikipedia.org', {
        'action': 'query', 'format': 'json', 'formatversion': '2',
        'prop': 'pageimages', 'piprop': 'original', 'titles': title,
    })
    pages = d.get('query', {}).get('pages', [])
    if not pages or 'original' not in pages[0]:
        return None
    return pages[0]['original']['source']


def file_meta(filename):
    d = api('commons.wikimedia.org', {
        'action': 'query', 'format': 'json', 'formatversion': '2',
        'prop': 'imageinfo', 'iiprop': 'extmetadata|url|size',
        'titles': 'File:' + filename,
    })
    pages = d.get('query', {}).get('pages', [])
    if not pages or 'imageinfo' not in pages[0]:
        return None
    info = pages[0]['imageinfo'][0]
    ex = info.get('extmetadata', {})
    def get(k):
        return strip_html(ex.get(k, {}).get('value', ''))
    return {
        'licence': get('LicenseShortName'),
        'author': get('Artist') or get('Credit') or 'Unknown',
        'descUrl': info.get('descriptionurl', ''),
        'url': info.get('url', ''),
        'width': info.get('width', 0),
    }


def acceptable(meta):
    lic = meta.get('licence', '')
    if not lic:
        return False, 'no licence stated'
    if BAD_LICENCE.search(lic):
        return False, f'licence not redistributable: {lic}'
    if not OK_LICENCE.match(lic):
        return False, f'unrecognised licence: {lic}'
    return True, lic


def download(url, dest_stem):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    from PIL import Image
    im = Image.open(io.BytesIO(raw))
    im = im.convert('RGB')
    if im.width > MAX_WIDTH:
        h = round(im.height * MAX_WIDTH / im.width)
        im = im.resize((MAX_WIDTH, h), Image.LANCZOS)
    path = dest_stem + '.jpg'
    im.save(path, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    return path, im.width, im.height


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--species', required=True,
                    help='JSON list of {"id","name","wiki"} entries')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    species = json.load(open(args.species, encoding='utf-8'))
    if args.limit:
        species = species[:args.limit]
    os.makedirs(IMG, exist_ok=True)

    credits_path = os.path.join(IMG, 'credits.json')
    credits = {}
    if os.path.exists(credits_path):
        credits = json.load(open(credits_path, encoding='utf-8'))

    got, skipped, failed = 0, 0, []
    for i, sp in enumerate(species, 1):
        sid = sp['id']
        dest = os.path.join(IMG, sid)
        if not args.force and os.path.exists(dest + '.jpg') and sid in credits:
            skipped += 1
            continue
        title = sp.get('wiki') or sp['name']
        try:
            # an explicit override wins; then the lead photo; then any other
            # acceptable image on the article
            names = []
            if sp.get('file'):
                names.append(sp['file'].replace('File:', ''))
            src = lead_image(title)
            if src:
                names.append(urllib.parse.unquote(src.rsplit('/', 1)[-1]))
            names += commons_candidates(title)

            meta, why = None, 'no usable image found'
            for filename in names:
                m = file_meta(filename)
                if not m:
                    continue
                ok, reason = acceptable(m)
                if ok and m.get('width', 0) >= 400:
                    meta, why = m, reason
                    break
                why = reason
            if not meta:
                failed.append((sid, why))
                continue
            path, w, h = download(meta['url'] or src, dest)
            credits[sid] = {
                'name': sp['name'],
                'file': os.path.basename(path),
                'licence': meta['licence'],
                'author': meta['author'][:160],
                'source': meta['descUrl'],
                'width': w, 'height': h,
            }
            got += 1
        except Exception as e:  # noqa: BLE001 — report and keep going
            failed.append((sid, f'{type(e).__name__}: {e}'[:120]))
        if i % 10 == 0:
            print(f'  {i}/{len(species)}  got={got} skipped={skipped} '
                  f'failed={len(failed)}', flush=True)
        time.sleep(0.15)          # be polite to Wikimedia

    json.dump(credits, open(credits_path, 'w', encoding='utf-8'),
              indent=1, ensure_ascii=False)

    total_kb = sum(os.path.getsize(os.path.join(IMG, c['file']))
                   for c in credits.values()
                   if os.path.exists(os.path.join(IMG, c['file']))) / 1024
    print(f'\ndownloaded {got} | already had {skipped} | failed {len(failed)}')
    print(f'{len(credits)} photos on disk, {total_kb/1024:.1f} MB total')
    lics = {}
    for c in credits.values():
        lics[c['licence']] = lics.get(c['licence'], 0) + 1
    print('licences:', dict(sorted(lics.items(), key=lambda x: -x[1])))
    for sid, why in failed[:25]:
        print(f'   MISSING {sid}: {why}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
