// Wonder Lab — content schema.
//
// The whole app is generated from two flat arrays, ANIMALS and BODY. Keeping
// the shape rigid is what makes thousands of facts manageable: every fact
// carries a CATEGORY, so the same data drives the shuffle feed, the browse
// screens, the compare tool and the quiz generator without any of them needing
// bespoke content.
//
//   ANIMALS = [{
//     id:      'cheetah',              // also the photo filename, img/<id>.jpg
//     name:    'Cheetah',
//     group:   'mammals',              // key of GROUPS
//     homes:   ['grassland'],          // keys of HABITATS
//     size:    'A bit bigger than you',// plain-language, never just numbers
//     stats:   { speed: 70, weight: 54, length: 1.4, life: 12 },
//     facts:   [{ cat:'speed', text:'…', more:'…' }, …],
//     wonder:  'optional one-line design note',
//   }, …]
//
// `text` is the punchy card line. `more` is the optional paragraph for a kid
// who taps "Tell me more" — that is where the depth lives, so the card itself
// can stay short and surprising.

const GROUPS = {
  mammals:    { name: 'Mammals',      glyph: '🦁', tint: '#ffc94a' },
  birds:      { name: 'Birds',        glyph: '🦅', tint: '#4fd6e8' },
  reptiles:   { name: 'Reptiles',     glyph: '🦎', tint: '#9ee85f' },
  amphibians: { name: 'Amphibians',   glyph: '🐸', tint: '#7fe3a0' },
  fish:       { name: 'Fish',         glyph: '🐠', tint: '#6fb3ff' },
  insects:    { name: 'Bugs',         glyph: '🐝', tint: '#ffb04a' },
  spiders:    { name: 'Spiders',      glyph: '🕷️', tint: '#b088ff' },
  sea:        { name: 'Sea Creatures', glyph: '🐙', tint: '#4fd6e8' },
  tiny:       { name: 'Tiny Wonders', glyph: '🔬', tint: '#ff7a6b' },
};

const HABITATS = {
  rainforest: { name: 'Rainforest', glyph: '🌴' },
  ocean:      { name: 'Ocean',      glyph: '🌊' },
  desert:     { name: 'Desert',     glyph: '🏜️' },
  grassland:  { name: 'Grassland',  glyph: '🌾' },
  polar:      { name: 'Ice & Snow', glyph: '❄️' },
  mountain:   { name: 'Mountains',  glyph: '⛰️' },
  forest:     { name: 'Forest',     glyph: '🌲' },
  freshwater: { name: 'Rivers & Lakes', glyph: '🏞️' },
  cave:       { name: 'Caves',      glyph: '🕳️' },
  backyard:   { name: 'Your Backyard', glyph: '🏡' },
};

// Every animal draws from the same category set. That repetition is a feature:
// it is what lets the quiz ask "which of these is faster?" across any pair, and
// what makes writing 10 facts per animal a fill-in rather than a blank page.
const CATEGORIES = {
  speed:    { name: 'Speed',        glyph: '💨' },
  size:     { name: 'Size',         glyph: '📏' },
  senses:   { name: 'Super Senses', glyph: '👁️' },
  food:     { name: 'Food',         glyph: '🍽️' },
  babies:   { name: 'Babies',       glyph: '🥚' },
  defence:  { name: 'Defence',      glyph: '🛡️' },
  record:   { name: 'Record Holder', glyph: '🏆' },
  weird:    { name: 'Weird But True', glyph: '🤯' },
  build:    { name: 'Built-In Tools', glyph: '🔧' },
  home:     { name: 'Where It Lives', glyph: '📍' },
  talk:     { name: 'How It Talks',  glyph: '🗣️' },
  sleep:    { name: 'Sleep & Rest',  glyph: '😴' },
};

// Comparable stats, so "compare two animals" works for any pair.
// Missing values are fine — the compare screen only shows what both have.
const STAT_META = {
  speed:  { name: 'Top speed', unit: 'mph', big: true },
  weight: { name: 'Weight',    unit: 'kg',  big: true },
  length: { name: 'Length',    unit: 'm',   big: true },
  life:   { name: 'Lifespan',  unit: 'yrs', big: true },
};

const BODY_SECTIONS = {
  brain:    { name: 'Brain & Nerves', glyph: '🧠', tint: '#b088ff' },
  heart:    { name: 'Heart & Blood',  glyph: '❤️', tint: '#ff7a6b' },
  bones:    { name: 'Bones & Muscles', glyph: '🦴', tint: '#ffc94a' },
  lungs:    { name: 'Lungs & Breathing', glyph: '🫁', tint: '#4fd6e8' },
  senses:   { name: 'The Five Senses', glyph: '👂', tint: '#9ee85f' },
  gut:      { name: 'Eating & Digesting', glyph: '🍎', tint: '#ffb04a' },
  skin:     { name: 'Skin, Hair & Nails', glyph: '✋', tint: '#ff9f7a' },
  defence:  { name: 'Germ Fighters',  glyph: '🛡️', tint: '#6fb3ff' },
  growing:  { name: 'Growing Up',     glyph: '📈', tint: '#7fe3a0' },
};
