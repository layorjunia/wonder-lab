#!/usr/bin/env python3
"""Fetch a life restoration for each dinosaur, alongside the skeleton photo.

Wikipedia's lead image for a dinosaur is almost always a mounted skeleton in a
museum hall, shot against a white sweep. Thirty of those in a grid is a wall of
grey, and a nine-year-old browsing a field guide sees bones where every other
species has an animal.

So each dinosaur gets TWO images:

  img/<id>.jpg        the mounted skeleton — what was actually dug up
  img/<id>-life.jpg   an artist's restoration — what it likely looked like

The app shows the restoration as the profile hero and the skeleton beside the
"What We Dug Up" facts, labelled as an artist's reconstruction. Keeping both,
and saying which is which, is the honest version: the bones are evidence, the
skin colour is somebody's informed guess, and a child should be able to see the
difference rather than be handed a painting labelled "photo".

Same licence gate as fetch_photos.py — PD/CC0/CC-BY/CC-BY-SA only, anything
unidentifiable is refused.

  python3 tools/fetch_life_art.py            # all missing
  python3 tools/fetch_life_art.py trex ...   # named ids only
"""
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
CREDITS = os.path.join(IMG, 'credits.json')

# Wikimedia asks for a contact in the User-Agent. A repo URL is the better
# choice than a personal address anyway, and this is a family project — it must
# not carry the Illuminate Drones business identity.
UA = ('WonderLabHomeschoolApp/1.0 (educational use; '
      'https://github.com/layorjunia/wonder-lab)')

OK_LICENCE = re.compile(
    r'^(cc0|cc[ -]by([ -]sa)?([ -][0-9.]+)?|public domain|pd(-|$)|'
    r'no restrictions|attribution)', re.I)
BAD_LICENCE = re.compile(r'(non[- ]?commercial|nc\b|nd\b|fair use|copyright)', re.I)

MAX_WIDTH = 900
JPEG_QUALITY = 82

# A restoration is a drawing or painting of the living animal. Museum mounts,
# bone close-ups, maps, size-comparison diagrams and phylogenetic charts all
# turn up in the same categories and none of them is what we want here.
WANT = re.compile(r'(restoration|reconstruction|life|_NT|NT\.|nobu|tamura|'
                  r'dinosaur.*art|paleoart|palaeoart)', re.I)
REJECT = re.compile(
    r'(skeleton|skull|mount|bone|tooth|teeth|claw|vertebra|femur|humerus|'
    r'scale|size.?compar|diagram|chart|cladogram|map|distribution|'
    r'footprint|track|quarry|excavat|specimen|holotype|fossil|cast|'
    r'\.svg$|\.pdf$|\.ogv$|\.webm$|logo|icon|stamp|coin)', re.I)


# every genus in the set, so one entry cannot borrow another's picture
ALL_GENERA = [s['name'].split()[0].lower() for s in json.load(
    open(os.path.join(ROOT, 'tools', 'species-dinos.json'), encoding='utf-8'))]


def api(host, params):
    url = f'https://{host}/w/api.php?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip_html(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()


def candidates(wiki_title):
    """Images from the article plus the taxon's restoration category."""
    out = []
    try:
        d = api('en.wikipedia.org', {
            'action': 'query', 'format': 'json', 'formatversion': '2',
            'prop': 'images', 'imlimit': '80', 'titles': wiki_title,
        })
        for p in d.get('query', {}).get('pages', []):
            for im in p.get('images', []):
                out.append(im['title'].replace('File:', ''))
    except Exception:
        pass
    # Commons keeps restorations filed under "<Taxon> restorations" / "art"
    for cat in (f'Category:{wiki_title} restorations',
                f'Category:{wiki_title}'):
        try:
            d = api('commons.wikimedia.org', {
                'action': 'query', 'format': 'json', 'formatversion': '2',
                'list': 'categorymembers', 'cmtitle': cat,
                'cmtype': 'file', 'cmlimit': '60',
            })
            for m in d.get('query', {}).get('categorymembers', []):
                out.append(m['title'].replace('File:', ''))
        except Exception:
            pass
    # Category listing alone is not enough: the Tyrannosaurus category is
    # dominated by video-game sprite sheets and returned not one usable
    # painting of the most famous dinosaur in the set. A full-text file search
    # finds the art that lives outside the taxon category.
    for q in (f'{wiki_title} restoration', f'{wiki_title} life reconstruction'):
        try:
            d = api('commons.wikimedia.org', {
                'action': 'query', 'format': 'json', 'formatversion': '2',
                'list': 'search', 'srsearch': q, 'srnamespace': '6',
                'srlimit': '30',
            })
            for m in d.get('query', {}).get('search', []):
                out.append(m['title'].replace('File:', ''))
        except Exception:
            pass
    # Scraping the taxon category drags in neighbours: the Tyrannosaurus
    # category handed back an Alioramus restoration, and the Triceratops one a
    # ceratopsian skin-integument figure. Both would have shipped the wrong
    # animal under the right name, so the genus has to appear in the filename
    # and no OTHER genus may.
    genus = wiki_title.split()[0].lower()
    others = [g for g in ALL_GENERA if g != genus]
    seen, ranked = set(), []
    for f in out:
        if f in seen:
            continue
        seen.add(f)
        if REJECT.search(f) or not re.search(r'\.(jpg|jpeg|png)$', f, re.I):
            continue
        low = f.lower()
        if genus not in low:
            continue
        if any(g in low for g in others):
            continue
        ranked.append((0 if WANT.search(f) else 1, f))
    ranked.sort()
    return [f for _, f in ranked]


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
    g = lambda k: strip_html(ex.get(k, {}).get('value', ''))
    return {
        'licence': g('LicenseShortName'),
        'author': g('Artist') or g('Credit') or 'Unknown',
        'descUrl': info.get('descriptionurl', ''),
        'url': info.get('url', ''),
        'width': info.get('width', 0),
        'height': info.get('height', 0),
    }


def acceptable(meta):
    lic = meta.get('licence', '')
    if not lic:
        return False, 'no licence stated'
    if BAD_LICENCE.search(lic):
        return False, f'not redistributable: {lic}'
    if not OK_LICENCE.match(lic):
        return False, f'unrecognised licence: {lic}'
    if meta.get('width', 0) < 420:
        return False, f'too small ({meta.get("width")}px)'
    return True, lic


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if im.width > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)),
                       Image.LANCZOS)
    im.save(dest, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
    return im.width, im.height


def main():
    roster = json.load(open(os.path.join(ROOT, 'tools', 'species-dinos.json'),
                            encoding='utf-8'))
    only = set(sys.argv[1:])
    if only:
        roster = [s for s in roster if s['id'] in only]
    credits = json.load(open(CREDITS, encoding='utf-8'))

    got = failed = skipped = 0
    for sp in roster:
        dest = os.path.join(IMG, sp['id'] + '-life.jpg')
        if os.path.exists(dest) and sp['id'] + '-life' in credits:
            skipped += 1
            continue
        picked = None
        for fn in candidates(sp.get('wiki') or sp['name'])[:14]:
            meta = file_meta(fn)
            if not meta:
                continue
            ok, why = acceptable(meta)
            if not ok:
                continue
            try:
                w, h = download(meta['url'], dest)
            except Exception as e:
                print(f'  {sp["id"]}: download failed ({e})')
                continue
            picked = {
                'name': sp['name'] + ' (life restoration)',
                'file': sp['id'] + '-life.jpg',
                'licence': why, 'author': meta['author'],
                'source': meta['descUrl'], 'width': w, 'height': h,
                'kind': 'artwork',
            }
            break
            time.sleep(0.2)
        if picked:
            credits[sp['id'] + '-life'] = picked
            got += 1
            print(f'  {sp["id"]:20} {picked["licence"]:16} {picked["author"][:40]}')
        else:
            failed += 1
            print(f'  {sp["id"]:20} NO USABLE RESTORATION')

    json.dump(credits, open(CREDITS, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\ndownloaded {got} | had {skipped} | none found {failed}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
