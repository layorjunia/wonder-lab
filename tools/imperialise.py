#!/usr/bin/env python3
"""Put imperial units first everywhere.

The family is in the US, so a nine-year-old should meet feet and pounds first
and metric second — not the other way round. Three cases have to be handled:

  1. "1.5 m (5 ft)"  -> "5 ft (1.5 m)"      already paired, wrong order
  2. "104 km/h"      -> "65 mph (104 km/h)" bare metric, needs converting
  3. "65 mph (104 km/h)"                    already right, leave alone

Stats are converted too, since those drive the Face-Off bars.

  python3 tools/imperialise.py .work/entries-*.json
"""
import glob
import json
import os
import tempfile
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK          # never the system temp dir

# metric unit -> (imperial unit, multiplier, decimals)
CONV = {
    'km/h': ('mph', 0.621371, 0),
    'kph': ('mph', 0.621371, 0),
    'cm': ('in', 0.393701, 1),
    'mm': ('in', 0.0393701, 2),
    'km': ('miles', 0.621371, 0),
    'm': ('ft', 3.28084, 1),
    'kg': ('lb', 2.20462, 0),
    'g': ('oz', 0.035274, 1),
    'tonnes': ('tons', 1.10231, 1),
    'tonne': ('ton', 1.10231, 1),
    'litres': ('gallons', 0.264172, 1),
    'litre': ('gallon', 0.264172, 1),
    'l': ('gallons', 0.264172, 1),
}
# imperial spellings that may appear inside an existing pair
IMPERIAL = r'(?:ft|feet|in|inches|mph|miles|mile|lb|lbs|pounds|oz|tons|ton|gallons|gallon)'
METRIC = r'(?:km/h|kph|cm|mm|km|m|kg|g|tonnes|tonne|litres|litre)'


def fmt(v, dec):
    # long distances in feet do not want a decimal place — "984.3 ft" reads as
    # false precision for something measured by pacing it out
    if dec and v >= 20:
        dec = 0
    if dec == 0:
        return f'{round(v):,}'
    s = f'{v:.{dec}f}'.rstrip('0').rstrip('.')
    # keep thousands separators on the whole part
    if '.' in s:
        a, b = s.split('.')
        return f'{int(a):,}.{b}'
    return f'{int(s):,}'


def num(s):
    return float(s.replace(',', ''))


def flip_pairs(text):
    """"1.5 m (5 ft)" -> "5 ft (1.5 m)" — keep the author's own imperial figure."""
    pat = re.compile(
        r'(?P<mv>\d[\d,\.]*)\s*(?P<mu>' + METRIC + r')\s*'
        r'\((?P<iv>\d[\d,\.]*)\s*(?P<iu>' + IMPERIAL + r')\)')

    def rep(m):
        return f"{m.group('iv')} {m.group('iu')} ({m.group('mv')} {m.group('mu')})"
    return pat.sub(rep, text)


def convert_bare(text):
    """Convert bare metric to "imperial (metric)", leaving correct pairs alone.

    Everything already finished is stashed behind a placeholder before the next
    pass runs. Without that, the single-value pass chews on the metric figure
    sitting inside a parenthesis this function just produced, and you get
    nested nonsense like "79 to 168 lb (36 to 168 lb (76 kg))".
    """
    done = []

    def stash(s):
        done.append(s)
        return f'\x00{len(done)-1}\x00'

    # 1. any metric already INSIDE parentheses is by definition a gloss on an
    #    imperial figure that precedes it — including when the author wrote that
    #    figure in words ("ten miles (16 km)", "an inch (2.5 cm)"). Leave it be.
    text = re.sub(r'\([^()]*?\d[\d,\.]*\s*(?:' + METRIC + r')\b[^()]*?\)',
                  lambda m: stash(m.group(0)), text)

    # 2. ranges — BOTH numbers must convert. Converting only the trailing one
    #    silently invents a false figure, which is worse than leaving metric.
    range_pat = re.compile(
        r'(?<![\w.])(?P<a>\d[\d,\.]*)\s*(?P<sep>to|and|–|—|-)\s*'
        r'(?P<b>\d[\d,\.]*)\s*(?P<u>' + METRIC + r')(?![\w/])')

    def rep_range(m):
        u = m.group('u')
        if u not in CONV:
            return m.group(0)
        iu, mult, dec = CONV[u]
        try:
            a, b = num(m.group('a')), num(m.group('b'))
        except ValueError:
            return m.group(0)
        raw = m.group('sep')
        sep = f' {raw} ' if raw in ('to', 'and') else raw
        return stash(f'{fmt(a * mult, dec)}{sep}{fmt(b * mult, dec)} {iu} '
                     f'({m.group("a")}{sep}{m.group("b")} {u})')
    text = range_pat.sub(rep_range, text)

    # 3. single values
    pat = re.compile(r'(?<![\w.])(?P<v>\d[\d,\.]*)\s*(?P<u>' + METRIC + r')(?![\w/])')

    def rep(m):
        u = m.group('u')
        if u not in CONV:
            return m.group(0)
        iu, mult, dec = CONV[u]
        try:
            v = num(m.group('v'))
        except ValueError:
            return m.group(0)
        return stash(f'{fmt(v * mult, dec)} {iu} ({m.group("v")} {u})')
    text = pat.sub(rep, text)

    for i, d in enumerate(done):
        text = text.replace(f'\x00{i}\x00', d)
    return text


def imperialise(text):
    if not text:
        return text
    return convert_bare(flip_pairs(text))


def main():
    patterns = sys.argv[1:] or ['.work/entries-*.json']
    files = []
    for p in patterns:
        files += sorted(glob.glob(p if os.path.isabs(p) else os.path.join(ROOT, p)))
    if not files:
        print('no files')
        return 2

    changed = 0
    for path in files:
        data = json.load(open(path, encoding='utf-8'))
        for e in data:
            for k in ('blurb', 'size', 'wonder'):
                if e.get(k):
                    new = imperialise(e[k])
                    if new != e[k]:
                        e[k] = new
                        changed += 1
            for f in e.get('facts', []):
                for k in ('text', 'more'):
                    if f.get(k):
                        new = imperialise(f[k])
                        if new != f[k]:
                            f[k] = new
                            changed += 1
            # Guard against double-conversion: running this twice, or over an
            # entry already authored in imperial, would silently inflate every
            # weight and length. The marker makes the pass idempotent.
            st = e.get('stats') or {}
            if e.get('_units') != 'imperial':
                if 'weight' in st:      # kg -> lb
                    st['weight'] = round(st['weight'] * 2.20462)
                if 'length' in st:      # m -> ft
                    st['length'] = round(st['length'] * 3.28084, 1)
                e['_units'] = 'imperial'
        json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'{os.path.basename(path)}: {len(data)} entries')
    print(f'{changed} text fields rewritten to imperial-first')
    return 0


if __name__ == '__main__':
    sys.exit(main())
