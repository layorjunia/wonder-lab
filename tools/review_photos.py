#!/usr/bin/env python3
"""Build a contact sheet of every downloaded photo, so they can be eyeballed.

Automated checks catch a missing or mislicensed file; they cannot tell that a
photo is murky, watermarked, or shows the wrong thing. This renders them all at
card size for a human (or a vision pass) to judge, with the licence printed
underneath.

  python3 tools/review_photos.py  ->  .work/photo-review.html
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
credits = json.load(open(os.path.join(ROOT, 'img', 'credits.json'), encoding='utf-8'))
cards = []
for sid, c in sorted(credits.items()):
    cards.append(
        f'<figure style="width:260px;margin:0;background:#fff;border-radius:14px;'
        f'overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.12)">'
        f'<img src="../img/{c["file"]}" style="width:100%;height:170px;object-fit:cover;display:block">'
        f'<figcaption style="padding:8px 10px;font:13px system-ui">'
        f'<b>{c["name"]}</b><br><span style="color:#666;font-size:11px">{sid} · {c["licence"]}</span>'
        f'</figcaption></figure>')
html = ('<!doctype html><meta charset="utf-8"><body style="background:#eef1f5;'
        'padding:18px;font:14px system-ui"><h2>' + str(len(credits)) +
        ' photos</h2><div style="display:flex;flex-wrap:wrap;gap:14px">' +
        ''.join(cards) + '</div>')
out = os.path.join(ROOT, '.work', 'photo-review.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out)
