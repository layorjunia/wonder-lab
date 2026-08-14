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
  crustaceans:{ name: 'Crabs & Shrimp', glyph: '🦀', tint: '#ff9f7a' },
  worms:      { name: 'Worms & Slugs', glyph: '🪱', tint: '#c9a06f' },
  tiny:       { name: 'Tiny Wonders', glyph: '🔬', tint: '#ff7a6b' },
  dinosaurs:  { name: 'Dinosaurs & Giants', glyph: '🦕', tint: '#ffa04a' },
};

/* Plant groups. Kept separate from GROUPS so a filter rail in one section can
   never offer a filter that belongs to another. */
const PLANT_GROUPS = {
  trees:      { name: 'Trees',            glyph: '🌳', tint: '#7fe3a0' },
  flowers:    { name: 'Flowers',          glyph: '🌸', tint: '#ff9ec7' },
  carnivores: { name: 'Meat-Eaters',      glyph: '🪤', tint: '#9ee85f' },
  desert:     { name: 'Desert Survivors', glyph: '🌵', tint: '#ffc94a' },
  crops:      { name: 'Food We Grow',     glyph: '🌾', tint: '#ffb04a' },
  water:      { name: 'Water Plants',     glyph: '🌊', tint: '#4fd6e8' },
  moss:       { name: 'Moss & Lichen',    glyph: '🍃', tint: '#8fd18f' },
  ferns:      { name: 'Ferns',            glyph: '🌿', tint: '#6fbf73' },
  fungi:      { name: 'Fungi',            glyph: '🍄', tint: '#ff7a6b' },
  odd:        { name: 'Oddities',         glyph: '🌀', tint: '#b088ff' },
};

/* The Earth half. Topic sections, like the body — there is no species here. */
const EARTH_SECTIONS = {
  rocks:     { name: 'Rocks & Crystals',  glyph: '💎' },
  volcanoes: { name: 'Volcanoes',         glyph: '🌋' },
  quakes:    { name: 'Earthquakes',       glyph: '🫨' },
  water:     { name: 'Oceans & Rivers',   glyph: '🌊' },
  weather:   { name: 'Weather',           glyph: '⛈️' },
  caves:     { name: 'Caves & Canyons',   glyph: '🕳️' },
  ice:       { name: 'Ice & Poles',       glyph: '🧊' },
  sky:       { name: 'Sun, Moon & Sky',   glyph: '🌙' },
};

/* Astronomy. Its own section rather than more Earth `sky` facts: those are
   what an observer on the ground sees — tides, shadows, eclipses — and this is
   the objects themselves. */
const ASTRO_SECTIONS = {
  sun:        { name: 'Our Star',        glyph: '☀️' },
  moon:       { name: 'The Moon',        glyph: '🌙' },
  rocky:      { name: 'Rocky Worlds',    glyph: '🪨' },
  giants:     { name: 'Giant Planets',   glyph: '🪐' },
  smallstuff: { name: 'Rocks & Comets',  glyph: '☄️' },
  stars:      { name: 'Stars',           glyph: '⭐' },
  deepsky:    { name: 'Deep Sky',        glyph: '🌌' },
  looking:    { name: 'How We Look',     glyph: '🔭' },
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
/* How do we know this?
 *
 * Not a decoration. A dinosaur entry mixes three completely different kinds of
 * claim — a measured bone, a weight somebody modelled from that bone, and a
 * written account — and prose alone lets the second quietly borrow the
 * authority of the first. Six bumps on one forearm became "Velociraptor had
 * feathers" in an earlier draft of this app, filed under evidence. Marking the
 * kind on the card itself is the fix: the child can see which is which without
 * having to already know.
 */
const KINDS = {
  /* "Dug up" is right for a fossil and nonsense for the moon's rotation, so
     the label follows the section: dinosaurs keep the spade, everything else
     gets the neutral word. The MEANING is identical — somebody actually
     looked. */
  found:  { name: 'Observed',     glyph: '🔍', tint: '#9ee85f',
            dino: { name: 'Dug up', glyph: '🦴' },
            blurb: 'Somebody actually looked. A measured bone, a counted set of teeth, a depth someone lowered a line to, a thing you could go and see for yourself.' },
  worked: { name: 'Worked out',   glyph: '📐', tint: '#ffc94a',
            blurb: 'Not dug up. Someone reasoned it from what was dug up — a weight, a speed, a habit, a color. Good reasoning is still reasoning.' },
  record: { name: 'Written down', glyph: '📜', tint: '#b088ff',
            blurb: 'From a written account rather than the ground — Genesis, an old chronicle, or the story of who found the bones and when.' },
};

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
  travel:   { name: 'Great Journeys', glyph: '🧭' },
  gross:    { name: 'Gross But Glorious', glyph: '🤢' },
  teamwork: { name: 'Better Together', glyph: '🤝' },
  disguise: { name: 'Master of Disguise', glyph: '🥸' },
  copied:   { name: 'We Copied It',   glyph: '💡' },
  tryit:    { name: 'Try It Yourself', glyph: '🧪' },
  oops:     { name: 'When It Goes Wrong', glyph: '🩹' },
  samesame: { name: 'Just Like An Animal', glyph: '🔗' },
  /* Dinosaur-only. `bones` is what the diggers actually dug up — measurable,
     countable, in a museum you can go and stand in front of. `created` is where
     the creature sits in the Bible's account: made on day six with the other
     land animals, alive alongside people, aboard the Ark. Kept as its own
     category so the two are never blurred together. */
  bones:    { name: 'What We Dug Up',  glyph: '🦴' },
  created:  { name: 'Made In The Beginning', glyph: '🌍' },

  /* History and physical science. "Speed" and "Babies" describe an animal;
     they do not describe a stele or a lever. `artifact` is the most useful one
     in the whole set for history — the thing is still there and a child could
     go and stand in front of it, which is the difference between a fact and a
     story about a fact. */
  built:    { name: 'What They Built',  glyph: '🏗️' },
  writing:  { name: 'Words & Writing',  glyph: '✍️' },
  daily:    { name: 'Everyday Life',    glyph: '🏠' },
  artifact: { name: 'You Can Go See It', glyph: '🏛️' },
  when:     { name: 'When It Happened', glyph: '📅' },
  people:   { name: 'The People',       glyph: '👥' },
  howworks: { name: 'How It Works',     glyph: '⚙️' },
};

// Comparable stats, so "compare two animals" works for any pair.
// Missing values are fine — the compare screen only shows what both have.
// Imperial units — this family is in the US, so feet and pounds come first.
const STAT_META = {
  speed:  { name: 'Top speed', unit: 'mph', big: true },
  weight: { name: 'Weight',    unit: 'lb',  big: true },
  length: { name: 'Length',    unit: 'ft',  big: true },
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
  sleep:    { name: 'Sleep & Dreams',  glyph: '😴' },
  cells:    { name: 'Cells & DNA',     glyph: '🧬' },
  voice:    { name: 'Voice & Sound',   glyph: '🗣️' },
  hands:    { name: 'Hands & Grip',    glyph: '✋' },
  heat:     { name: 'Hot & Cold',      glyph: '🌡️' },
  growing:  { name: 'Growing Up',     glyph: '📈', tint: '#7fe3a0' },
};

// Spoken game phrases.
//
// Declared here rather than written inline in app.js because tools/gen_audio.py
// has to render a clip for every string the app can speak. A phrase typed
// straight into a template literal is a phrase with no recording — the app then
// falls to the browser voice for that one line, in a different voice, and is
// silent for it on iOS. One definition, read by both the app and the generator.
const GAME_PHRASES = {
  heavier: 'Which is heavier?',
  longer:  'Which is longer?',
  taller:  'Which is taller?',
  lives:   'Which lives longer?',
};

/* ── The five new subjects ──────────────────────────────────────────────
   Same flat shape as EARTH and ASTRO: {id, section, cat, kind, text, more,
   tryit}. They render through App.topics(), which is driven by TOPIC_SETS
   below rather than by a branch per subject. */

const PHYSICAL_SECTIONS = {
  forces:   { name: 'Forces & Motion',  glyph: '🏃' },
  energy:   { name: 'Energy',           glyph: '⚡' },
  light:    { name: 'Light & Color',   glyph: '🌈' },
  sound:    { name: 'Sound',            glyph: '🔊' },
  heat:     { name: 'Heat & Cold',      glyph: '🔥' },
  electric: { name: 'Electricity',      glyph: '💡' },
  magnets:  { name: 'Magnets',          glyph: '🧲' },
  matter:   { name: 'States of Matter', glyph: '🧊' },
};

const MICRO_SECTIONS = {
  cell:     { name: 'Inside a Cell',    glyph: '🔵' },
  bacteria: { name: 'Bacteria',         glyph: '🦠' },
  virus:    { name: 'Viruses',          glyph: '🧬' },
  fungi:    { name: 'Molds & Yeasts',  glyph: '🍄' },
  pond:     { name: 'Pond Water',       glyph: '💧' },
  helpers:  { name: 'Helpful Microbes', glyph: '🥛' },
  clean:    { name: 'Staying Well',     glyph: '🧼' },
  scope:    { name: 'The Microscope',   glyph: '🔬' },
};

/* Ancient history runs on the Bible's own timeline. See
   .work/BRIEF-ancient.md — the short version is that BOTH chronologies are
   marked: Scripture states reign-lengths and genealogies (`record`), a YEAR
   comes from adding them up (`worked`), and the conventional date sits beside
   it with its own method named (`worked`). Marking one and not the other is
   the exact failure this app exists to correct. */
const ANCIENT_SECTIONS = {
  beginning: { name: 'The Beginning',     glyph: '🌍' },
  flood:     { name: 'Flood & Babel',     glyph: '🌊' },
  egypt:     { name: 'Egypt',             glyph: '🏺' },
  mesopot:   { name: 'Mesopotamia',       glyph: '🧱' },
  israel:    { name: 'Israel',            glyph: '🕎' },
  greece:    { name: 'Greece',            glyph: '🏛️' },
  rome:      { name: 'Rome',              glyph: '🦅' },
};

const AMERICA_SECTIONS = {
  explorers: { name: 'Explorers',         glyph: '🧭' },
  colonies:  { name: 'The Colonies',      glyph: '⛵' },
  founding:  { name: 'A New Country',     glyph: '📜' },
  inventors: { name: 'Inventors',         glyph: '💡' },
  frontier:  { name: 'Heading West',      glyph: '🐎' },
  machines:  { name: 'Rails & Machines',  glyph: '🚂' },
  flight:    { name: 'Flight',            glyph: '✈️' },
  everyday:  { name: 'Everyday Life',     glyph: '🏠' },
};

const WORLD_SECTIONS = {
  middle:    { name: 'The Middle Ages',   glyph: '🏰' },
  voyages:   { name: 'Great Voyages',     glyph: '🗺️' },
  printing:  { name: 'Printing & Books',  glyph: '📖' },
  discovery: { name: 'Age of Discovery',  glyph: '🔭' },
  builders:  { name: 'Great Builders',    glyph: '🏗️' },
  faroff:    { name: 'Far-Off Kingdoms',  glyph: '🐘' },
  medicine:  { name: 'Medicine',          glyph: '💊' },
  modern:    { name: 'The Modern World',  glyph: '🌐' },
};

/* One registry, so adding a subject is a data change. `data` and `secs` are
   the NAMES of globals rather than the globals themselves: schema.js loads
   before every data file, so the values do not exist yet at this point. */
const TOPIC_SETS = {
  earth:    { name: 'Earth',            glyph: '🌍', pat: 'topo',   data: 'EARTH',    secs: 'EARTH_SECTIONS' },
  astro:    { name: 'Astronomy',        glyph: '🔭', pat: 'star',   data: 'ASTRO',    secs: 'ASTRO_SECTIONS' },
  physical: { name: 'Physical Science', glyph: '🧲', pat: 'wave',   data: 'PHYSICAL', secs: 'PHYSICAL_SECTIONS' },
  micro:    { name: 'Microbiology',     glyph: '🦠', pat: 'cell',   data: 'MICRO',    secs: 'MICRO_SECTIONS' },
  ancient:  { name: 'Ancient History',  glyph: '🏺', pat: 'brick',  data: 'ANCIENT',  secs: 'ANCIENT_SECTIONS' },
  america:  { name: 'American History', glyph: '🦅', pat: 'scroll', data: 'AMERICA',  secs: 'AMERICA_SECTIONS' },
  world:    { name: 'World History',    glyph: '🌐', pat: 'star2',  data: 'WORLD',    secs: 'WORLD_SECTIONS' },
};

/* ── The three wings ──
   Ten subjects were ten identical tiles opening ten identical lists. They are
   not the same KIND of thing, and pretending they are is why the app felt like
   a database with a nav bar.

   Each wing has its own verb and its own screen:
     field      you COLLECT   — a passport of specimen cards you fill in
     expedition you TRAVEL    — a map of places with a path between them
     lab        you DO        — a bench of stations, each with experiments

   The data already supported this and nothing was using it: animals carry
   unseen -> spotted -> known -> mastered per species, history is already
   sectioned into places, and the science sections hold 125 experiments. */
const WINGS = {
  field: {
    name: 'The Field', verb: 'Collect', glyph: '🔭', tint: '#9ee85f',
    line: 'Every creature you meet gets a card in your passport.',
    sources: [{ kind: 'animals' }, { kind: 'plants' }],
  },
  expedition: {
    name: 'The Expedition', verb: 'Travel', glyph: '🧭', tint: '#ffc94a',
    line: 'Maps of real places. Walk them a stop at a time.',
    sources: [{ topic: 'ancient' }, { topic: 'america' }, { topic: 'world' },
              { topic: 'earth' }, { topic: 'astro' }],
  },
  lab: {
    name: 'The Lab', verb: 'Try it', glyph: '⚗️', tint: '#4fd6e8',
    line: 'Benches you can actually work at. Nothing here is only reading.',
    sources: [{ topic: 'physical' }, { topic: 'micro' }, { kind: 'body' }],
  },
};

/* Ten destinations is too many for one flat grid. Three families, in the order
   a child actually asks about them. `go` is an App method; `topic` is a key in
   TOPIC_SETS. */
const FAMILIES = [
  { name: 'Living Things', glyph: '🌿', tint: '#9ee85f', cards: [
    { go: 'guide',  name: 'Animals',   glyph: '🦁', pat: 'fur' },
    { go: 'plants', name: 'Plants',    glyph: '🌻', pat: 'leaf' },
    { topic: 'micro' },
    { go: 'body',   name: 'Your Body', glyph: '🫀', pat: 'pulse' },
  ] },
  { name: 'Earth & Sky', glyph: '🌍', tint: '#4fd6e8', cards: [
    { topic: 'earth' }, { topic: 'astro' }, { topic: 'physical' },
  ] },
  { name: 'History', glyph: '📜', tint: '#ffc94a', cards: [
    { topic: 'ancient' }, { topic: 'america' }, { topic: 'world' },
  ] },
];

/* Same reason as the generated data files: these are `const`, so they are not
   on globalThis unless we put them there, and TOPIC_SETS looks them up by
   name. Miss one and its subject renders as "being written" forever with no
   error anywhere. */
[['EARTH_SECTIONS', EARTH_SECTIONS], ['ASTRO_SECTIONS', ASTRO_SECTIONS],
 ['PHYSICAL_SECTIONS', PHYSICAL_SECTIONS], ['MICRO_SECTIONS', MICRO_SECTIONS],
 ['ANCIENT_SECTIONS', ANCIENT_SECTIONS], ['AMERICA_SECTIONS', AMERICA_SECTIONS],
 ['WORLD_SECTIONS', WORLD_SECTIONS], ['BODY_SECTIONS', BODY_SECTIONS],
].forEach(([n, v]) => { globalThis[n] = v; });
