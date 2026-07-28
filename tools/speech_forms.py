#!/usr/bin/env python3
"""Turn written Wonder Lab text into something a TTS can read out loud.

The manifest key is always computed from the ORIGINAL text. Only the string
handed to the synthesiser passes through here. That split is what lets the app
look up a clip by the text on screen while the clip itself says "forty-three
feet" instead of "four three f t".

Why this file is large for a fun-fact app: 993 of 4,741 shipped strings contain
a digit, and a neural TTS reading them raw is confidently wrong rather than
obviously wrong. "1888" becomes "one thousand eight hundred eighty-eight" in a
sentence about a year. "AMNH 5060" becomes "amunh five thousand and sixty".
Neither sounds broken; both are wrong, and a nine-year-old has no way to tell.

  .venv-tts/bin/python tools/speech_forms.py --sample 25
"""
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_WORK = os.path.join(ROOT, '.work', 'tmp')
os.makedirs(_WORK, exist_ok=True)
tempfile.tempdir = _WORK
os.environ.setdefault('HF_HOME', os.path.join(ROOT, '.work', 'hf'))

from num2words import num2words

# ── units ────────────────────────────────────────────────────────────────
# Singular and plural, because "1 ft" is "one foot" and "43 ft" is "43 feet".
UNITS = {
    'ft': ('foot', 'feet'),        'in': ('inch', 'inches'),
    'lb': ('pound', 'pounds'),     'oz': ('ounce', 'ounces'),
    'mi': ('mile', 'miles'),       'mph': ('mile an hour', 'miles an hour'),
    'yd': ('yard', 'yards'),
    'm': ('metre', 'metres'),      'cm': ('centimetre', 'centimetres'),
    'mm': ('millimetre', 'millimetres'), 'km': ('kilometre', 'kilometres'),
    'kg': ('kilogram', 'kilograms'), 'g': ('gram', 'grams'),
    'hz': ('hertz', 'hertz'),      'khz': ('kilohertz', 'kilohertz'),
    'km/h': ('kilometre an hour', 'kilometres an hour'),
    'mi/h': ('mile an hour', 'miles an hour'),
    'db': ('decibel', 'decibels'),
    'tonne': ('tonne', 'tonnes'),  'ton': ('ton', 'tons'),
    'sq': ('square', 'square'),
}

# Letter strings that must be spelled, never pronounced as a word. Museum
# specimen codes dominate — this app cites a lot of them — plus the handful of
# genuine initialisms. Without this, Piper says "amunh" and "fmnuh" with total
# confidence, and `for_speech`'s .capitalize() would make it "Amnh".
SPELL_OUT = {
    'AMNH', 'FMNH', 'USNM', 'NHMUK', 'MACN', 'MPC', 'UMNH', 'MCF', 'PVPH',
    'CMN', 'ROM', 'IGM', 'MOR', 'UCMP', 'SGDS', 'CM', 'YPM', 'LACM', 'MWC',
    'TMM', 'NDGS', 'UALVP', 'FSAC', 'KK', 'CH', 'SM', 'DBCLS', 'HMS',
    'DNA', 'UV', 'CT', 'DDT', 'ATP', 'GPS', 'IUCN', 'US', 'AA', 'KAY',
    'MNHN', 'BSP', 'MIT', 'PV', 'MUCPV', 'NHM',
    # only ever appears inside the specimen code 'BSP AS I 563'
    'AS',
}

# 1970s -> "nineteen seventies", not "nineteen seventy s".
DECADE_WORD = {0: 'hundreds', 20: 'twenties', 30: 'thirties', 40: 'forties',
               50: 'fifties', 60: 'sixties', 70: 'seventies', 80: 'eighties',
               90: 'nineties', 10: 'tens'}

# A conversion in brackets is a reading aid, not something to say aloud. The
# app is imperial-first; speaking "forty-three feet, thirteen metres" doubles
# every measurement in the ear for no gain. 507 of the 993 digit-bearing
# strings carry one of these.
#
# Matching by unit name was too brittle — "(1.2 to 2.7 kg)" and "(40 km/h)"
# both slipped through and got read aloud. The reliable test is structural: a
# parenthetical is a conversion aside when it contains a digit and consists of
# NOTHING BUT numbers, unit letters and connectors. Any real prose in there
# fails the test and the bracket survives.
_ASIDE_BODY = re.compile(
    r'^(?:about|roughly|around|up\s+to|nearly|over)?\s*'
    r'[\d][\d,.\s]*'
    r'(?:(?:to|–|—|-|/|by|x|×)\s*[\d,.]*\s*[a-z°]{0,6}\s*)*'
    r'[a-z°/]{0,8}\s*$', re.I)


def _drop_asides(t):
    def keep(m):
        body = m.group(1).strip()
        if not re.search(r'\d', body):
            return m.group(0)
        return '' if _ASIDE_BODY.match(body) else m.group(0)
    return re.sub(r'\s*\(([^()]*)\)', keep, t)

ORD_SUFFIX = re.compile(r'\b(\d+)(st|nd|rd|th)\b', re.I)


def _n2w(n):
    """Cardinal, British-style ('and' in the hundreds), no hyphen weirdness."""
    try:
        s = num2words(n)
    except (OverflowError, NotImplementedError, ValueError):
        return str(n)
    return s.replace('-', ' ').replace(',', '')


def _num(tok):
    """'8,435' -> 8435 ; '2.62' -> 2.62 ; returns None if not numeric."""
    t = tok.replace(',', '')
    try:
        return int(t)
    except ValueError:
        try:
            return float(t)
        except ValueError:
            return None


def _say_number(tok):
    v = _num(tok)
    if v is None:
        return tok
    if isinstance(v, float):
        whole, _, frac = str(v).partition('.')
        return _n2w(int(whole)) + ' point ' + ' '.join(_n2w(int(d)) for d in frac)
    return _n2w(v)


def _say_year(y):
    """1888 -> 'eighteen eighty-eight', 2014 -> 'twenty fourteen', 1900 -> 'nineteen hundred'."""
    hi, lo = divmod(y, 100)
    if lo == 0:
        return _n2w(hi) + ' hundred'
    if lo < 10:
        return _n2w(hi) + ' oh ' + _n2w(lo)
    return _n2w(hi) + ' ' + _n2w(lo)


def _say_digits(s):
    """Specimen numbers are read digit by digit: 5060 -> 'five oh six oh'."""
    out = []
    for ch in s:
        if ch.isdigit():
            out.append('oh' if ch == '0' else _n2w(int(ch)))
        elif ch in '-/.':
            out.append('dash' if ch == '-' else ('slash' if ch == '/' else 'point'))
    return ' '.join(out)


def _spell(word):
    return ' '.join(word.upper())


def for_speech(text):
    """The only function callers need. Idempotent enough to run twice safely."""
    t = str(text)

    # 1. Celsius-first with Fahrenheit in brackets is the one aside worth
    #    keeping rather than dropping — this app speaks imperial, so promote
    #    the bracketed value instead of deleting it.
    t = re.sub(r'([\d,.]+)\s*°?\s*C\b\s*\(\s*([\d,.]+)\s*°?\s*F\b\s*\)',
               lambda m: m.group(2) + '°F', t)

    # 2. drop the bracketed conversion asides entirely
    t = _drop_asides(t)

    # 3. specimen codes: letters spelled, number read digit by digit. The
    #    suffix has to be swallowed by the SAME match — an earlier version
    #    matched "SGDS 18" and left ".T1" behind, which came out "eight.T1".
    def _spec(m):
        head, num = m.group(1), m.group(2)
        tail = m.group(3) or ''
        out = _spell(head.upper()) + ' ' + _say_digits(num)
        if tail:
            for part in re.findall(r'[A-Za-z]+|\d+', tail):
                out += ' ' + (_spell(part.upper()) if part.isalpha() else _say_digits(part))
        return out
    t = re.sub(r'\b([A-Z]{2,}[a-z]?)[\s-]?(\d+)((?:[.\-][A-Za-z0-9]+)*)\b', _spec, t)

    # 3a. hyphenated alphanumeric specimen codes ("MUCPv-Ch1") — the plain
    #     code pattern needs digits right after the letters, which these
    #     never have.
    def _spec2(m):
        out = []
        for part in re.findall(r'[A-Za-z]+|\d+', m.group(0)):
            out.append(_spell(part.upper()) if part.isalpha() else _say_digits(part))
        return ' '.join(out)
    t = re.sub(r'\b[A-Z]{2,}[a-z]*-[A-Za-z]*\d[A-Za-z0-9]*\b', _spec2, t)

    # 3b. decades
    t = re.sub(r'\b(1[5-9]|20)(\d)0s\b',
               lambda m: _n2w(int(m.group(1))) + ' ' +
                         DECADE_WORD[int(m.group(2)) * 10], t)

    # 3c. "3D" and friends — a digit glued to a letter
    t = re.sub(r'\b(\d)D\b', lambda m: _n2w(int(m.group(1))) + ' D', t)

    # 4. remaining initialisms, before any .capitalize()-style damage
    def _init(m):
        w = m.group(0)
        return _spell(w) if w in SPELL_OUT else w
    t = re.sub(r'\b[A-Z]{2,}\b', _init, t)

    # 5. years — before generic numbers, or 1888 becomes "one thousand..."
    def _yr(m):
        return _say_year(int(m.group(0)))
    t = re.sub(r'(?<![\d,.])\b(1[5-9]\d\d|20[0-4]\d)\b(?![\d,.]|\s*(?:ft|in|lb|oz|mi|m|cm|mm|km|kg|g)\b)',
               _yr, t)

    # 6. compound feet-and-inches reads as one measurement
    def _ftin(m):
        f, i = int(m.group(1)), int(m.group(2))
        return (f'{_n2w(f)} {"foot" if f == 1 else "feet"} '
                f'{_n2w(i)} {"inch" if i == 1 else "inches"}')
    t = re.sub(r'\b(\d+)\s*ft\s+(\d+)\s*in\b', _ftin, t)

    # 7. money, percent, degrees
    t = re.sub(r'\$\s*([\d,.]+)\s*(million|billion|thousand)?',
               lambda m: _say_number(m.group(1)) + (' ' + m.group(2) if m.group(2) else '') + ' dollars', t)
    t = re.sub(r'([\d,.]+)\s*%', lambda m: _say_number(m.group(1)) + ' percent', t)
    t = re.sub(r'([\d,.]+)\s*°\s*([CF])?',
               lambda m: _say_number(m.group(1)) + ' degrees' +
                         ({'C': ' Celsius', 'F': ' Fahrenheit'}.get(m.group(2) or '', '')), t)

    # 8. number + unit
    def _unit(m):
        tok, u = m.group(1), m.group(2)
        key = u.lower().rstrip('.')
        if key not in UNITS:
            return m.group(0)
        v = _num(tok)
        sing, plur = UNITS[key]
        return _say_number(tok) + ' ' + (sing if v == 1 else plur)
    t = re.sub(r'\b([\d][\d,.]*)\s*([a-zA-Z]{1,3}/[a-zA-Z]|[a-zA-Z]{1,5})\b', _unit, t)

    # 9. ordinals written with digits
    t = ORD_SUFFIX.sub(lambda m: num2words(int(m.group(1)), to='ordinal').replace('-', ' '), t)

    # 10. anything numeric still standing
    t = re.sub(r'(?<![\w])([\d][\d,.]*)(?![\w])', lambda m: _say_number(m.group(1).rstrip('.')), t)

    # 11. tidy — en/em dashes read as pauses, collapse whitespace
    t = t.replace('—', ' — ').replace('–', ' to ')
    t = re.sub(r'\s+([,.;:!?])', r'\1', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


if __name__ == '__main__':
    import json
    import random
    import subprocess
    n = 25
    if '--sample' in sys.argv:
        n = int(sys.argv[sys.argv.index('--sample') + 1])
    js = subprocess.run(
        ['node', '-e', '''
const fs=require('fs');
const load=f=>{const s=fs.readFileSync(f,'utf8').replace(/^const (\\w+)/m,'globalThis.$1');eval(s);};
load('js/animals.js'); load('js/body.js');
const all=[...ANIMALS.flatMap(a=>[a.name,a.blurb,a.size,a.wonder,
             ...a.facts.flatMap(f=>[f.text,f.more])]),
           ...BODY.flatMap(f=>[f.text,f.more,f.tryit])].filter(Boolean);
console.log(JSON.stringify(all));'''],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout
    allstr = json.loads(js)
    digits = [s for s in allstr if re.search(r'\d', s)]
    random.seed(7)
    for s in random.sample(digits, min(n, len(digits))):
        print('IN :', s[:160])
        print('OUT:', for_speech(s)[:200])
        print()
