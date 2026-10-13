// Buddies: the companion that comes along on every screen.
//
// Pip (the sprout) is the original. Eleven in all now, picked on the Welcome
// screen or in the Me tab. Every buddy is drawn with the SAME structure as Pip
// (.pip-body, .eye-open, .e-happy, .e-oops, .arms-up/.arms-down, .m-idle/.m-happy/
// .m-oops/.m-wow, .pip-leafL/.pip-leafR) so css/lab.css animates all of them with
// no per-character code: they bob, blink, cheer, jump and shake alike, and the
// ears/horns/tufts wiggle through the leaf classes.
//
// App.pip() is replaced here so every one of the ~40 existing call sites (journey,
// games, results, boss, nav) shows the chosen buddy without being touched.

const BUDDY_SHAPES = {
  round: 'M60 36 C92 36 109 60 109 84 C109 106 89 119 60 119 C31 119 11 106 11 84 C11 60 28 36 60 36Z',
  tall:  'M60 30 C88 30 104 56 104 84 C104 108 86 121 60 121 C34 121 16 108 16 84 C16 56 32 30 60 30Z',
  wide:  'M60 42 C97 42 113 64 113 86 C113 106 93 118 60 118 C27 118 7 106 7 86 C7 64 23 42 60 42Z',
  box:   'M24 40 H96 Q110 40 110 54 V100 Q110 118 92 118 H28 Q10 118 10 100 V54 Q10 40 24 40Z',
};

// c = body gradient [light, mid, dark]; every part is plain SVG in the 120 x 130 box.
const BUDDIES = {
  ember: {
    name: 'Ember', kind: 'dragon', shape: 'round',
    c: ['#ffd9a8', '#ff9a52', '#e0602a'], line: '#a8431b', limb: '#ffa45e', limbLine: '#b84f1f',
    feet: '#e66a2e', feetLine: '#a8431b', belly: '#fff0c9', blush: '#ff7a7a',
    behind: `<path d="M16 72 C1 56 1 38 14 30 C14 46 20 54 31 60Z" fill="#ff7f3f" stroke="#a8431b" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M104 72 C119 56 119 38 106 30 C106 46 100 54 89 60Z" fill="#ff7f3f" stroke="#a8431b" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M100 104 C118 106 124 92 117 80 C113 92 106 95 97 96Z" fill="#ff8a45" stroke="#a8431b" stroke-width="3" stroke-linejoin="round"/>`,
    top: `<g class="pip-leafL"><path d="M40 44 L33 22 L50 38Z" fill="#fff0c9" stroke="#a8431b" stroke-width="2.5" stroke-linejoin="round"/></g>
      <g class="pip-leafR"><path d="M80 44 L87 22 L70 38Z" fill="#fff0c9" stroke="#a8431b" stroke-width="2.5" stroke-linejoin="round"/></g>`,
    front: `<circle cx="54" cy="82" r="1.8" fill="#a8431b"/><circle cx="66" cy="82" r="1.8" fill="#a8431b"/>`,
  },
  rusty: {
    name: 'Rusty', kind: 'fox', shape: 'round',
    c: ['#ffdfb8', '#ff9c47', '#e06a1c'], line: '#a84a0f', limb: '#ff9c47', limbLine: '#a84a0f',
    feet: '#6b3a1f', feetLine: '#3d2010', belly: '#fff4e3', blush: '#ff9a8a',
    behind: `<path d="M98 108 C124 108 126 80 112 68 C110 84 103 93 95 98Z" fill="#ff9c47" stroke="#a84a0f" stroke-width="3" stroke-linejoin="round"/>
      <path d="M112 68 C106 72 109 80 106 86 C116 84 121 76 112 68Z" fill="#fff4e3"/>`,
    top: `<g class="pip-leafL"><path d="M27 54 L25 20 L52 40Z" fill="#ff9c47" stroke="#a84a0f" stroke-width="3" stroke-linejoin="round"/>
        <path d="M31 45 L30 29 L44 40Z" fill="#6b3a1f"/></g>
      <g class="pip-leafR"><path d="M93 54 L95 20 L68 40Z" fill="#ff9c47" stroke="#a84a0f" stroke-width="3" stroke-linejoin="round"/>
        <path d="M89 45 L90 29 L76 40Z" fill="#6b3a1f"/></g>`,
    front: `<path d="M12 92 L27 83 L25 99Z" fill="#fff4e3"/><path d="M108 92 L93 83 L95 99Z" fill="#fff4e3"/>
      <ellipse cx="60" cy="82" rx="5" ry="3.4" fill="#2b1a12"/>`,
  },
  hoot: {
    name: 'Hoot', kind: 'owl', shape: 'round',
    c: ['#f6e2bc', '#d2a06a', '#9a6a3c'], line: '#5e3d20', limb: '#c9955a', limbLine: '#5e3d20',
    feet: '#f0a030', feetLine: '#a86a10', belly: '#fff0cf', blush: '#ff9a8a',
    top: `<g class="pip-leafL"><path d="M30 46 L24 22 L47 38Z" fill="#9a6a3c" stroke="#5e3d20" stroke-width="3" stroke-linejoin="round"/></g>
      <g class="pip-leafR"><path d="M90 46 L96 22 L73 38Z" fill="#9a6a3c" stroke="#5e3d20" stroke-width="3" stroke-linejoin="round"/></g>`,
    front: `<path d="M54 78 L60 92 L66 78 Q60 72 54 78Z" fill="#ffb02e" stroke="#a86a10" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M43 108 Q48 103 53 108 M57 111 Q62 106 67 111 M71 108 Q76 103 81 108" fill="none" stroke="#9a6a3c" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  clover: {
    name: 'Clover', kind: 'bunny', shape: 'tall',
    c: ['#ffffff', '#f1e8ff', '#c9b4f0'], line: '#7d62b8', limb: '#f1e9ff', limbLine: '#7d62b8',
    feet: '#f1e9ff', feetLine: '#7d62b8', belly: '#ffffff', blush: '#ff9ec0',
    behind: `<g class="pip-leafL"><ellipse cx="42" cy="20" rx="10" ry="24" transform="rotate(-9 42 20)" fill="#f1e9ff" stroke="#7d62b8" stroke-width="3"/>
        <ellipse cx="42" cy="22" rx="4.8" ry="17" transform="rotate(-9 42 22)" fill="#ffb7d3"/></g>
      <g class="pip-leafR"><ellipse cx="78" cy="20" rx="10" ry="24" transform="rotate(9 78 20)" fill="#f1e9ff" stroke="#7d62b8" stroke-width="3"/>
        <ellipse cx="78" cy="22" rx="4.8" ry="17" transform="rotate(9 78 22)" fill="#ffb7d3"/></g>
      <circle cx="101" cy="108" r="9" fill="#ffffff" stroke="#7d62b8" stroke-width="3"/>`,
    front: `<ellipse cx="60" cy="82" rx="4.5" ry="3.2" fill="#ff8fb3"/>`,
  },
  waddles: {
    name: 'Waddles', kind: 'penguin', shape: 'tall',
    c: ['#7088b4', '#3d5380', '#1f2f52'], line: '#0f1a30', limb: '#3d5380', limbLine: '#0f1a30',
    feet: '#ffb02e', feetLine: '#a86a10', belly: false, blush: '#ff9a8a',
    top: `<path d="M60 52 C85 52 95 70 95 88 C95 107 80 118 60 118 C40 118 25 107 25 88 C25 70 35 52 60 52Z" fill="#fffdf4"/>`,
    front: `<path d="M51 80 L69 80 L60 93Z" fill="#ffb02e" stroke="#a86a10" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M52 40 L60 28 L68 40" fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  honey: {
    name: 'Honey', kind: 'bear', shape: 'wide',
    c: ['#f6d6a8', '#c98a4a', '#8f5628'], line: '#5a3416', limb: '#c98a4a', limbLine: '#5a3416',
    feet: '#a8692f', feetLine: '#5a3416', belly: '#f8e2bd', blush: '#ff9a8a',
    top: `<g class="pip-leafL"><circle cx="26" cy="52" r="12" fill="#c98a4a" stroke="#5a3416" stroke-width="3"/><circle cx="26" cy="53" r="6" fill="#f8e2bd"/></g>
      <g class="pip-leafR"><circle cx="94" cy="52" r="12" fill="#c98a4a" stroke="#5a3416" stroke-width="3"/><circle cx="94" cy="53" r="6" fill="#f8e2bd"/></g>`,
    front: `<ellipse cx="60" cy="90" rx="20" ry="14" fill="#f8e2bd" opacity=".9"/><ellipse cx="60" cy="82" rx="6" ry="4.2" fill="#3a2410"/>`,
  },
  mochi: {
    name: 'Mochi', kind: 'cat', shape: 'round',
    c: ['#fff6e6', '#ffdcb0', '#eaa968'], line: '#a8672a', limb: '#ffdcb0', limbLine: '#a8672a',
    feet: '#ffdcb0', feetLine: '#a8672a', belly: '#ffffff', blush: '#ff9aa8',
    behind: `<path d="M22 108 C0 108 -2 82 12 74 C12 88 18 93 25 96Z" fill="#ffdcb0" stroke="#a8672a" stroke-width="3" stroke-linejoin="round"/>`,
    top: `<g class="pip-leafL"><path d="M28 52 L28 22 L50 40Z" fill="#ffdcb0" stroke="#a8672a" stroke-width="3" stroke-linejoin="round"/>
        <path d="M33 44 L33 30 L44 39Z" fill="#ffb7c4"/></g>
      <g class="pip-leafR"><path d="M92 52 L92 22 L70 40Z" fill="#ffdcb0" stroke="#a8672a" stroke-width="3" stroke-linejoin="round"/>
        <path d="M87 44 L87 30 L76 39Z" fill="#ffb7c4"/></g>
      <path d="M53 44 L53 53 M60 42 L60 53 M67 44 L67 53" fill="none" stroke="#c98a4a" stroke-width="3" stroke-linecap="round"/>`,
    front: `<path d="M22 88 L6 83 M22 95 L6 97 M98 88 L114 83 M98 95 L114 97" fill="none" stroke="#a8672a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M56 81 L64 81 L60 86Z" fill="#ff8fa3" stroke="#a8672a" stroke-width="1.6" stroke-linejoin="round"/>`,
  },
  rex: {
    name: 'Rex', kind: 'dinosaur', shape: 'wide',
    c: ['#c4f8dc', '#4cc99a', '#2a9a74'], line: '#1b6e55', limb: '#4cc99a', limbLine: '#1b6e55',
    feet: '#36b385', feetLine: '#1b6e55', belly: '#fff6c9', blush: '#ff9a8a',
    behind: `<path d="M100 106 C120 106 126 92 119 78 C114 90 107 93 97 95Z" fill="#4cc99a" stroke="#1b6e55" stroke-width="3" stroke-linejoin="round"/>`,
    top: `<path d="M42 46 L49 28 L56 42Z M56 42 L62 22 L68 42Z M68 42 L75 28 L82 46Z" fill="#ffb02e" stroke="#a86a10" stroke-width="2.5" stroke-linejoin="round"/>`,
    front: `<circle cx="53" cy="80" r="2" fill="#1b6e55"/><circle cx="67" cy="80" r="2" fill="#1b6e55"/>`,
  },
  bolt: {
    name: 'Bolt', kind: 'robot', shape: 'box',
    c: ['#f6f9fd', '#c2d4e8', '#8aa5c4'], line: '#3e5f82', limb: '#9db6d1', limbLine: '#3e5f82',
    feet: '#6b87a8', feetLine: '#2e4a68', belly: false, blush: '#ff9aa8',
    behind: `<g class="pip-leafL"><path d="M60 42 L60 22" stroke="#3e5f82" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="17" r="7" fill="#ff5d5d" stroke="#a82d2d" stroke-width="3"/></g>`,
    top: `<rect x="30" y="96" width="60" height="15" rx="7.5" fill="#e3edf7" stroke="#3e5f82" stroke-width="2"/>
      <circle cx="9" cy="72" r="6" fill="#6b87a8" stroke="#2e4a68" stroke-width="2.5"/><circle cx="111" cy="72" r="6" fill="#6b87a8" stroke="#2e4a68" stroke-width="2.5"/>`,
    front: `<circle cx="22" cy="50" r="2.4" fill="#3e5f82"/><circle cx="98" cy="50" r="2.4" fill="#3e5f82"/>
      <path d="M40 104 H48 M54 104 H62 M68 104 H76" stroke="#3e5f82" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  sparkle: {
    name: 'Sparkle', kind: 'unicorn', shape: 'round',
    c: ['#ffffff', '#fdeaff', '#e3bff2'], line: '#a066c4', limb: '#fdeaff', limbLine: '#a066c4',
    feet: '#fdeaff', feetLine: '#a066c4', belly: '#ffffff', blush: '#ff9ec8',
    behind: `<path d="M26 60 C4 54 0 80 14 94 C12 80 19 71 28 66Z" fill="#ff8fb3"/>
      <path d="M26 66 C10 64 8 82 18 92 C17 82 22 76 28 72Z" fill="#ffd166"/>
      <path d="M27 72 C16 72 15 84 21 90 C21 83 24 79 28 77Z" fill="#7ad0ff"/>`,
    top: `<path d="M54 42 L60 10 L66 42Z" fill="#ffd166" stroke="#c98a12" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M55 34 L65 30 M56 26 L64 23" fill="none" stroke="#c98a12" stroke-width="2.2" stroke-linecap="round"/>
      <g class="pip-leafL"><path d="M34 50 L29 33 L46 43Z" fill="#fdeaff" stroke="#a066c4" stroke-width="2.6" stroke-linejoin="round"/></g>
      <g class="pip-leafR"><path d="M86 50 L91 33 L74 43Z" fill="#fdeaff" stroke="#a066c4" stroke-width="2.6" stroke-linejoin="round"/></g>`,
    front: `<path d="M20 78 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2Z" fill="#ffd166" opacity=".9"/>`,
  },
};

Object.assign(App, {
  // Pip first, then the rest in this order.
  BUDDY_ORDER: ['pip', 'ember', 'rusty', 'hoot', 'clover', 'waddles', 'honey', 'mochi', 'rex', 'bolt', 'sparkle'],
  _pipSprout: App.pip,

  buddyId() {
    const set = (typeof Progress !== 'undefined' && Progress.profile && Progress.profile.settings) || {};
    const id = this._wbuddy || set.buddy;
    return (id && (id === 'pip' || BUDDIES[id])) ? id : 'pip';
  },
  buddyName(id) { return id === 'pip' ? 'Pip' : (BUDDIES[id] ? BUDDIES[id].name : 'Pip'); },
  buddyKind(id) { return id === 'pip' ? 'sprout' : (BUDDIES[id] ? BUDDIES[id].kind : 'sprout'); },

  // The mascot. Same signature as the original, so no call site changes.
  pip(state, cls) { return this.buddySvg(this.buddyId(), state, cls); },

  buddySvg(id, state, cls) {
    const b = BUDDIES[id];
    if (!b) return this._pipSprout(state, cls);
    const st = String(state || '');
    const G = 'bd-' + id;
    const arm = (cx, cy, rot, rx = 9, ry = 7) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${b.limb}" stroke="${b.limbLine}" stroke-width="2.5"/>`;
    return `<svg class="mascot ${st} ${cls || ''}" viewBox="0 0 120 130" aria-hidden="true">
      <defs><radialGradient id="${G}" cx="38%" cy="32%" r="80%">
        <stop offset="0" stop-color="${b.c[0]}"/><stop offset=".55" stop-color="${b.c[1]}"/><stop offset="1" stop-color="${b.c[2]}"/>
      </radialGradient></defs>
      <ellipse cx="60" cy="123" rx="34" ry="6" fill="rgba(0,0,0,.24)"/>
      <g class="pip-body">
        ${b.behind || ''}
        <ellipse cx="41" cy="115" rx="12" ry="6.5" fill="${b.feet}" stroke="${b.feetLine}" stroke-width="2.5"/>
        <ellipse cx="79" cy="115" rx="12" ry="6.5" fill="${b.feet}" stroke="${b.feetLine}" stroke-width="2.5"/>
        <g class="arms-down">${arm(12, 88, -28)}${arm(108, 88, 28)}</g>
        <g class="arms-up">${arm(9, 62, -62)}${arm(111, 62, 62)}</g>
        <path d="${BUDDY_SHAPES[b.shape || 'round']}" fill="url(#${G})" stroke="${b.line}" stroke-width="3.5"/>
        ${b.belly === false ? '' : `<ellipse cx="60" cy="100" rx="27" ry="15" fill="${b.belly || '#fff'}" opacity=".7"/>`}
        ${b.top || ''}
        <g class="eye-open">
          <g class="pip-eye"><ellipse cx="42" cy="70" rx="11.5" ry="13.5" fill="#fff" stroke="#2d2a3a" stroke-width="2.5"/>
            <ellipse cx="44" cy="72" rx="6.5" ry="8.5" fill="#1d2b3a"/><circle cx="46.5" cy="68" r="2.8" fill="#fff"/><circle cx="41.5" cy="76" r="1.4" fill="#fff"/></g>
          <g class="pip-eye r"><ellipse cx="78" cy="70" rx="11.5" ry="13.5" fill="#fff" stroke="#2d2a3a" stroke-width="2.5"/>
            <ellipse cx="76" cy="72" rx="6.5" ry="8.5" fill="#1d2b3a"/><circle cx="78.5" cy="68" r="2.8" fill="#fff"/><circle cx="73.5" cy="76" r="1.4" fill="#fff"/></g>
        </g>
        <g class="e-happy"><path d="M31 74 Q42 58 53 74" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M67 74 Q78 58 89 74" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/></g>
        <g class="e-oops"><path d="M31 68 Q42 80 53 68" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M67 68 Q78 80 89 68" fill="none" stroke="#1d2b3a" stroke-width="5.5" stroke-linecap="round"/></g>
        <ellipse cx="27" cy="88" rx="7.5" ry="4.8" fill="${b.blush}" opacity=".6"/>
        <ellipse cx="93" cy="88" rx="7.5" ry="4.8" fill="${b.blush}" opacity=".6"/>
        <path class="m-idle" d="M50 89 Q60 99 70 89" fill="none" stroke="#2d2a3a" stroke-width="4" stroke-linecap="round"/>
        <g class="m-happy"><path d="M45 84 Q60 110 75 84 Z" fill="#8b2d3c" stroke="#2d2a3a" stroke-width="3" stroke-linejoin="round"/>
          <ellipse cx="60" cy="98" rx="7" ry="4.5" fill="#ff7a8f"/></g>
        <path class="m-oops" d="M50 97 Q60 86 70 97" fill="none" stroke="#2d2a3a" stroke-width="4" stroke-linecap="round"/>
        <ellipse class="m-wow" cx="60" cy="93" rx="7.5" ry="9.5" fill="#8b2d3c" stroke="#2d2a3a" stroke-width="3"/>
        ${b.front || ''}
      </g></svg>`;
  },

  // ── choosing a buddy ──────────────────────────────────────────────────
  _buddyTiles(selected, fn) {
    return this.BUDDY_ORDER.map(id => `
      <button class="buddy ${id === selected ? 'on' : ''}" onclick="App.${fn}('${id}')"
        aria-label="${this.buddyName(id)} the ${this.buddyKind(id)}">
        <span class="b-art">${id === 'pip' ? this._pipSprout('') : this.buddySvg(id, '')}</span>
        <b>${this.buddyName(id)}</b></button>`).join('');
  },

  // Me tab
  buddyCard() {
    return `<div class="card buddy-card" style="margin-top:16px">
      <h2>Your buddy</h2>
      <p class="dim small" style="margin-top:6px">${this.GPHR.buddyTitle}</p>
      <div class="buddy-grid">${this._buddyTiles(this.buddyId(), 'setBuddy')}</div>
    </div>`;
  },

  // Welcome screen: the choice is held until the profile exists.
  welcomeBuddies() {
    return `<div class="buddy-grid wl-buddies">${this._buddyTiles(this.buddyId(), 'pickWelcomeBuddy')}</div>`;
  },

  _sayBuddy(id) {
    const k = 'buddy_' + id;
    if (this.GPHR[k]) AudioLib.speak(this.GPHR[k]);
  },

  pickWelcomeBuddy(id) {
    this._wbuddy = id;
    document.querySelectorAll('.wl-buddies .buddy').forEach(b =>
      b.classList.toggle('on', b.getAttribute('onclick').includes("'" + id + "'")));
    const pip = document.querySelector('.wl-pip');
    if (pip) pip.innerHTML = this.pip('happy');
    this._sayBuddy(id);
  },

  setBuddy(id) {
    if (!Progress.profile) return;
    Progress.profile.settings = Progress.profile.settings || {};
    Progress.profile.settings.buddy = id;
    Progress.commit();
    this._wbuddy = null;
    this.go('notes');
    this._sayBuddy(id);
    setTimeout(() => this.pipReact('happy'), 80);
  },
});

Object.assign(App.GPHR, {
  buddyTitle: 'Pick a buddy to come along.',
  buddy_pip: 'Pip the sprout.',
  buddy_ember: 'Ember the dragon.',
  buddy_rusty: 'Rusty the fox.',
  buddy_hoot: 'Hoot the owl.',
  buddy_clover: 'Clover the bunny.',
  buddy_waddles: 'Waddles the penguin.',
  buddy_honey: 'Honey the bear.',
  buddy_mochi: 'Mochi the cat.',
  buddy_rex: 'Rex the dinosaur.',
  buddy_bolt: 'Bolt the robot.',
  buddy_sparkle: 'Sparkle the unicorn.',
});
