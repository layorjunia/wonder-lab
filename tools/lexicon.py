"""How Wonder Lab's voice says the words Kokoro has to guess (KokoroEngine uses tts_text).

Kokoro reads common words from its dictionary and works the rest out from spelling. Wonder Lab is full of
words it has never seen — species, genera, minerals, anatomy, the people who named things — and 1,029
single words came back as guesses (tools/names.py lists them with the guess). Most guesses are right;
this file holds the ones that are not.

Phonemes are Kokoro's American alphabet (misaki): A = "ay", I = "eye", O = "oh", W = "ow", Y = "oy",
T = the American flap in "water", ˈ before the stressed syllable, ˌ before a secondary stress.
British voices get the same entries with British vowels (british()).

Add an entry only when you have CHECKED the guess is wrong — tools/audit_speech.py renders every guessed
word and transcribes it back, which finds them without anyone having to read IPA.
"""
import re

WORDS = {
    # ── creatures whose names the model drops letters from or mis-stresses ──
    'olm': 'ˈOlm',                       # guessed "ohm" — the l disappeared
    'bdelloid': 'dˈɛlYd',                # the b is silent
    'frigatebird': 'fɹˈɪɡətbˌɜɹd',       # FRIG-it, not "frig-AYT"
    'frigatebirds': 'fɹˈɪɡətbˌɜɹdz',
    'axolotl': 'ˈæksəlˌɑTəl',
    'axolotls': 'ˈæksəlˌɑTəlz',
    'okapi': 'OkˈɑpI',
    'okapis': 'OkˈɑpIz',
    'echidna': 'ᵻkˈɪdnə',
    'echidnas': 'ᵻkˈɪdnəz',
    'coelacanth': 'sˈiləkˌænθ',          # the oe is "see", not "co-ee"
    'coelacanths': 'sˈiləkˌænθs',
    'pangolin': 'pˈæŋɡəlˌɪn',
    'pangolins': 'pˈæŋɡəlˌɪnz',
    'tuatara': 'tˌuətˈɑɹə',
    'chameleon': 'kəmˈiliən',
    'chameleons': 'kəmˈiliənz',

    # ── dinosaurs and fossils the guess mangles ──
    'Therizinosaurus': 'θˌɛɹɪzˌɪnəsˈɔɹəs',   # guessed a voiced "there-"
    'Parasaurolophus': 'pˌæɹəsɔɹˈɑləfəs',    # stress on -ROL-
    'Compsognathus': 'kˌɑmpsɑɡnˈAθəs',       # komp-sog-NAY-thus
    'oviraptorid': 'ˌOvᵻɹˈæptəɹˌɪd',
    'oviraptorids': 'ˌOvᵻɹˈæptəɹˌɪdz',
    'Archaeopteryx': 'ˌɑɹkiˈɑptəɹˌɪks',
    'pterosaur': 'tˈɛɹəsˌɔɹ',                # the p is silent
    'pterosaurs': 'tˈɛɹəsˌɔɹz',
    'plesiosaur': 'plˈiziəsˌɔɹ',
    'plesiosaurs': 'plˈiziəsˌɔɹz',
    'ichthyosaur': 'ˈɪkθiəsˌɔɹ',
    'ichthyosaurs': 'ˈɪkθiəsˌɔɹz',

    # ── plants ──
    'vera': 'vˈɛɹə',                     # "aloe vera", not "veer-a"
    'oleuropein': 'ˌOliuɹˈOpiᵻn',
    'Lithops': 'lˈIθɑps',                # LYE-thops
    'rafflesia': 'ɹəflˈiʒə',
    'bryophyte': 'bɹˈIəfˌIt',
    'bryophytes': 'bɹˈIəfˌIts',
    'chlorophyll': 'klˈɔɹəfˌɪl',
    'xylem': 'zˈIləm',
    'phloem': 'flˈOɛm',

    # ── science and the body ──
    'mitochondria': 'mˌITəkˈɑndɹiə',
    'mitochondrion': 'mˌITəkˈɑndɹiən',
    'cochlea': 'kˈɑkliə',
    'alveoli': 'ælvˈiəlˌI',
    'villi': 'vˈɪlI',
    'cilia': 'sˈɪliə',

    # ── people and places ──
    'Linnaeus': 'lᵻnˈiəs',               # lih-NEE-us
    'Scoville': 'skˈOvɪl',               # SKOH-vil
    'Othniel': 'ˈɑθniˌɛl',
    'Galapagos': 'ɡəlˈɑpəɡOs',
    'Galápagos': 'ɡəlˈɑpəɡOs',
}

_SIB, _VOICELESS = set('szʃʒʧʤ'), set('ptkfθ')


def _possessive(ph):
    last = ph.rstrip('ˈˌː')[-1:]
    return ph + ('ᵻz' if last in _SIB else 's' if last in _VOICELESS else 'z')


def british(ph):
    """American phonemes to British ones: "oh" as əʊ, no r after a vowel, the LOT vowel."""
    ph = ph.replace('O', 'Q').replace('T', 't')
    for a, b in (('ɑɹ', 'ɑː'), ('ɔɹ', 'ɔː'), ('ɜɹ', 'ɜː'), ('ɛɹ', 'ɛə'), ('ɪɹ', 'ɪə')):
        ph = re.sub(a + r'(?![aeiouAIOQWYæɑɒɔɛɪʊʌəᵻ])', b, ph)
    ph = re.sub(r'əɹ(?![aeiouAIOQWYæɑɒɔɛɪʊʌəᵻ])', 'ə', ph)
    return re.sub(r'ɑ(?![ːɹ])', 'ɒ', ph)


_KEEP_CAPS = {'OK', 'TV', 'DNA', 'UV', 'LED', 'CT', 'MRI', 'PH', 'US', 'UK', 'AM', 'PM'}
_WORD_RE = None


def _word_re():
    global _WORD_RE
    if _WORD_RE is None:
        keys = sorted(map(re.escape, WORDS), key=len, reverse=True)
        _WORD_RE = re.compile(r'\b(' + '|'.join(keys) + r")(['’]s)?\b")
    return _WORD_RE


def tts_text(text, lang='a'):
    """What the voice is given for one line: the same words, arranged so it reads them right."""
    t = str(text)
    # "8-20" is "eight to twenty", never "eight dash twenty"
    t = re.sub(r'(\d)\s*[-–]\s*(\d)', r'\1 to \2', t)

    def name(m):
        w, poss = m.group(1), m.group(2) or ''
        ph = WORDS[w]
        if lang == 'b':
            ph = british(ph)
        return f'[{w}{poss}](/{_possessive(ph) if poss else ph}/)'

    t = _word_re().sub(name, t)
    # WORDS IN CAPITALS for emphasis are read as words, not spelled out; real
    # acronyms keep their capitals.
    t = re.sub(r'(?<![\[/])\b([A-Z]{2,})\b',
               lambda m: m.group(1) if m.group(1) in _KEEP_CAPS else m.group(1).capitalize(), t)
    return t
