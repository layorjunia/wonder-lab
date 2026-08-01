// Expeditions — the journey layer.
//
// The app was 3,500 excellent facts with no shape: a daily deck of random
// cards and four browsable lists. Nothing had a beginning or an end, so
// nothing felt like getting anywhere.
//
// An expedition is a short curated trail — six to nine stops — that crosses
// the sections deliberately. Down to the Deep starts at the bottom of the
// ocean, meets the animals that live there, and finishes with what happens to
// a whale when it dies. The point is the CONNECTION: a child who has walked
// that trail knows those facts belong to each other, which is not something
// browsing a species list will ever teach.
//
// Stops address existing content, so this file adds almost no new text — only
// the framing that turns a list into a route:
//
//   { s: 'cheetah' }            a species profile (animal or plant)
//   { e: 'caves-3' }            one earth fact
//   { b: 'b12' }                one body fact
//   { a: 'moon-4' }             one astronomy fact
//
// `note` on a stop is the guide's voice — one line saying why this stop is
// here and what to look for. That line is the actual pedagogy.

const EXPEDITIONS = [
  {
    id: 'deep',
    name: 'Down to the Deep',
    glyph: '🌊',
    tint: '#4fd6e8',
    intro: 'Start at the surface and keep going down until the light runs out. '
         + 'Then keep going.',
    outro: 'Everything down there runs on what falls from up here. Nothing '
         + 'grows in the dark, so the deep sea eats leftovers.',
    stops: [
      { e: 'water-1', note: 'First, how deep is deep.' },
      { s: 'colossal-squid', note: 'The biggest eye of any animal, built for almost no light.' },
      { s: 'anglerfish', note: 'When you cannot find food, make the food come to you.' },
      { s: 'vampire-squid', note: 'Not a squid, not a vampire, and it eats falling scraps.' },
      { s: 'giant-kelp', note: 'Back up in the light, where the food actually gets made.' },
      { s: 'sea-otter', note: 'And the animal that decides whether the kelp forest lives.' },
    ],
  },
  {
    id: 'day',
    name: 'A Day and a Night',
    glyph: '🌅',
    tint: '#ffc94a',
    intro: 'One turn of the earth, followed all the way round — from the '
         + 'ground under your feet to the clock inside you.',
    outro: 'Nothing in that chain decided to keep time. It all just runs on '
         + 'the same turning.',
    stops: [
      { e: 'sky-7', note: 'The turn itself, timed to the second.' },
      { e: 'sky-6', note: 'Your shadow is the hand of that clock. Go outside and check it.' },
      { s: 'lyrebird', note: 'Who fills the morning with sound, including sounds it stole.' },
      { s: 'barn-owl', note: 'The shift that starts when yours ends.' },
      { b: 'b50', note: 'And what your own body does while you are not watching.' },
      { e: 'sky-1', note: 'One last thing, still up there in the afternoon if you look.' },
    ],
  },
  {
    id: 'survive',
    name: 'Built to Last',
    glyph: '🛡️',
    tint: '#9ee85f',
    intro: 'Five living things that should not still be here, and are.',
    outro: 'Every one of them survives by shutting almost everything off. '
         + 'Staying alive and being busy are not the same job.',
    stops: [
      { s: 'tardigrade', note: 'Start with the one that survives being put in space.' },
      { s: 'resurrection-plant', note: 'A plant that looks dead for years and is not.' },
      { s: 'bristlecone-pine', note: 'Slow is its own kind of armour.' },
      { s: 'naked-mole-rat', note: 'Almost no oxygen, almost no pain, almost no rules.' },
      { s: 'lichen', note: 'Two things living as one, on bare rock, eating stone.' },
    ],
  },
  {
    id: 'fire',
    name: 'Fire and Rock',
    glyph: '🌋',
    tint: '#ff7a6b',
    intro: 'Down through the hot end of the planet, and the things that '
         + 'somehow live in it.',
    outro: 'Every one of those temperatures was measured by somebody who had '
         + 'to get close enough to take it.',
    stops: [
      { e: 'volcanoes-1', note: 'How hot, exactly, and how anyone knows.' },
      { e: 'rocks-1', note: 'What the heat leaves behind when it cools.' },
      { e: 'volcanoes-9', note: 'Water and heat together do something stranger, on a timetable.' },
      { s: 'fly-agaric', note: 'Above ground, life gets on with it regardless.' },
      { e: 'quakes-1', note: 'And the shaking that comes with all of it.' },
    ],
  },
  {
    id: 'small',
    name: 'Too Small to See',
    glyph: '🔬',
    tint: '#b088ff',
    intro: 'Everything on this trail is invisible to you right now, and all '
         + 'of it is in the room.',
    outro: 'You are outnumbered in your own house by things you will never '
         + 'see without help.',
    stops: [
      { s: 'dust-mite', note: 'Start with the ones in your bed.' },
      { s: 'tardigrade', note: 'And the one in the moss outside.' },
      { s: 'diatom', note: 'Glass houses, in every drop of pond water.' },
      { s: 'amoeba', note: 'One cell that does the whole job of being alive.' },
      { b: 'b34', note: 'Then look at what you shed into the air of your own bedroom.' },
    ],
  },
  {
    id: 'dug',
    name: 'What We Actually Dug Up',
    glyph: '🦴',
    tint: '#ffa04a',
    intro: 'A trail about the difference between a bone and a story. Watch '
         + 'the badge on every card.',
    outro: 'The bones are the same for everybody. What people build on top of '
         + 'them is where the arguing starts — and knowing which is which is '
         + 'the most useful thing in this whole app.',
    stops: [
      { s: 'tyrannosaurus', note: 'Sue is 250 real bones in a real building in Chicago.' },
      { s: 'carnotaurus', note: 'And one animal left an actual print of its skin.' },
      { s: 'velociraptor', note: 'Now a harder one. Look at what was found and what was added.' },
      { s: 'oviraptor', note: 'A name given in haste, and the find that overturned it.' },
      { s: 'iguanodon', note: 'A thumb spike stuck on the nose for decades. Nobody lied. They were wrong.' },
    ],
  },
];

// A stop can point at content that is not built yet — astronomy lands after
// this file does. Filtering here rather than at render time keeps every screen
// from having to know about it, and an expedition that loses a stop still runs.
function expeditionStops(x) {
  return x.stops.filter((st) => {
    if (st.s) return typeof App !== 'undefined' && !!App.find(st.s);
    if (st.e) return typeof EARTH !== 'undefined' && EARTH.some(e => e.id === st.e);
    if (st.b) return typeof BODY !== 'undefined' && BODY.some(b => b.id === st.b);
    if (st.a) return typeof ASTRO !== 'undefined' && ASTRO.some(a => a.id === st.a);
    return false;
  });
}
