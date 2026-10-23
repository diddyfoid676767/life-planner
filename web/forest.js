'use strict';
/* Forest: every focus session of 10+ minutes plants a tree. Each subject has its
   own species (changeable) in its own colour, and longer sessions grow bigger
   trees: sapling 10m, young 25m, full 45m, grand 90m (grand trees blossom). */

const TREE_SPECIES = [
  ['oak', 'Oak'], ['pine', 'Pine'], ['cherry', 'Blossom'], ['birch', 'Birch'],
  ['palm', 'Palm'], ['cypress', 'Cypress'], ['willow', 'Willow'], ['maple', 'Maple'],
  ['apple', 'Apple'], ['fir', 'Fir'], ['bonsai', 'Bonsai'], ['bamboo', 'Bamboo'], ['acacia', 'Acacia'], ['poplar', 'Poplar'],
];
// extra species won from lucky boxes (see game.js)
const BONUS_SPECIES = [['cactus', 'Cactus', 'sp_cactus'], ['mushroom', 'Giant mushroom', 'sp_mushroom'], ['baobab', 'Baobab', 'sp_baobab'], ['crystal', 'Crystal tree', 'sp_crystal'], ['rainbow', 'Rainbow tree', 'sp_rainbow'], ['candy', 'Candy tree', 'sp_candy'], ['golden', 'Golden tree', 'sp_golden']];
const availableSpecies = () => [...TREE_SPECIES, ...BONUS_SPECIES.filter(b => D.game && (D.game.items[b[2]] || 0) > 0).map(b => [b[0], '★ ' + b[1]])];
const TREE_STAGES = [[10, 'Sapling'], [25, 'Young tree'], [45, 'Full tree'], [90, 'Grand tree']];

function shade(hex, amt) {
  let h = String(hex || '#2f9e44').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return hex;
  const mix = (c, t) => Math.round(c + (t - c) * Math.abs(amt));
  const t = amt < 0 ? 0 : 255;
  const r = mix(n >> 16 & 255, t), g = mix(n >> 8 & 255, t), b = mix(n & 255, t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function seeded(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
function treeStage(mins) { return mins >= 90 ? 3 : mins >= 45 ? 2 : mins >= 25 ? 1 : 0; }
// Each subject gets its own tree type: picks first (in subject order, no two the
// same), then the rest get the next unused standard tree.
function speciesMap() {
  const have = new Set(availableSpecies().map(s => s[0])), used = new Set(), map = {};
  for (const s of D.subjects) { const p = (D.settings.treeFor || {})[s.id]; if (p && have.has(p) && !used.has(p)) { map[s.id] = p; used.add(p); } }
  D.subjects.forEach((s, i) => {
    if (map[s.id]) return;
    for (let k = 0; k < TREE_SPECIES.length; k++) { const sp = TREE_SPECIES[(i + k) % TREE_SPECIES.length][0]; if (!used.has(sp)) { map[s.id] = sp; used.add(sp); return; } }
    map[s.id] = TREE_SPECIES[i % TREE_SPECIES.length][0];
  });
  return map;
}
function speciesFor(subjectId) { return speciesMap()[subjectId] || TREE_SPECIES[0][0]; }

const BARK = '#8a5a3b', BARK_D = '#6d4530';
const c = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
// Each species is drawn with its base at (0,0), about 100 units tall. Returns [svg, fruit points].
const SPECIES_DRAW = {
  oak(col, dk, lt) {
    return [`<path d="M-6 0 L-4 -42 L-14 -58 L-11 -60 L-2 -48 L-1 -64 L3 -64 L3 -48 L12 -60 L15 -57 L5 -42 L6 0 Z" fill="${BARK}"/>
      ${c(-24, -58, 20, dk)}${c(24, -58, 20, dk)}${c(0, -80, 25, dk)}
      ${c(-17, -64, 18, col)}${c(17, -64, 18, col)}${c(0, -84, 21, col)}${c(0, -60, 18, col)}
      ${c(-9, -90, 9, lt)}${c(-22, -68, 6, lt)}${c(12, -74, 6, lt)}`,
      [[-20, -60], [18, -66], [0, -86], [-6, -70], [26, -54], [8, -96]]];
  },
  pine(col, dk, lt) {
    const tier = (y, w, h) => `<path d="M${-w} ${y} L0 ${y - h} L0 ${y} Z" fill="${col}"/><path d="M0 ${y - h} L${w} ${y} L0 ${y} Z" fill="${dk}"/>`;
    return [`<rect x="-4" y="-22" width="8" height="22" rx="2" fill="${BARK}"/>
      ${tier(-16, 32, 40)}${tier(-40, 26, 38)}${tier(-62, 19, 40)}<path d="M-4 -98 L0 -104 L4 -98 Z" fill="${lt}"/>`,
      [[-14, -22], [12, -26], [-9, -48], [10, -50], [-5, -72], [5, -80]]];
  },
  cherry(col, dk, lt) {
    return [`<path d="M-5 0 C-4 -20 -6 -34 -2 -46 L-18 -64 L-15 -66 L0 -52 L2 -70 L6 -70 L4 -50 L18 -62 L20 -59 L5 -44 C6 -30 5 -16 6 0 Z" fill="${BARK_D}"/>
      ${c(-26, -62, 16, dk)}${c(24, -64, 17, dk)}${c(0, -82, 20, dk)}
      ${c(-18, -68, 15, col)}${c(16, -70, 15, col)}${c(-2, -86, 17, col)}${c(2, -62, 14, col)}
      ${[[-22, -70], [-12, -60], [-6, -92], [6, -84], [14, -76], [22, -64], [0, -70], [-26, -58], [10, -94], [26, -72]].map(([x, y]) => c(x, y, 3, '#fff')).join('')}
      ${[[-18, -76], [4, -76], [18, -60], [-8, -82]].map(([x, y]) => c(x, y, 2.2, lt)).join('')}`,
      [[-16, -64], [14, -72], [0, -90], [-24, -66], [22, -58]]];
  },
  birch(col, dk, lt) {
    return [`<rect x="-4.5" y="-74" width="9" height="74" rx="3" fill="#f1efe9"/>
      ${[[-12, 16], [-30, 34], [-50, 8], [-22, 12]].map(([y, w], i) => `<rect x="${i % 2 ? -4.5 : -1}" y="${y}" width="${w / 6 + 2}" height="2.2" rx="1" fill="#3d3a36"/>`).join('')}
      <ellipse cx="0" cy="-76" rx="25" ry="34" fill="${dk}"/><ellipse cx="-5" cy="-80" rx="19" ry="28" fill="${col}"/>
      <ellipse cx="-10" cy="-90" rx="7" ry="11" fill="${lt}"/><rect x="-2" y="-46" width="2" height="10" fill="#3d3a36"/>`,
      [[-14, -72], [10, -86], [-2, -100], [14, -64], [-8, -56]]];
  },
  palm(col, dk, lt) {
    const frond = (dx, dy, f) => `<path d="M0 -86 Q${dx * .5} ${-86 + dy - 18} ${dx} ${-86 + dy} Q${dx * .55} ${-86 + dy - 6} 0 -80 Z" fill="${f}"/>`;
    return [`<path d="M-5 0 Q-10 -40 -2 -86 L4 -86 Q-3 -40 5 0 Z" fill="${BARK}"/>
      ${[-10, -26, -42, -58, -72].map(y => `<path d="M${-6 + y / 30} ${y} l9 -2" stroke="${BARK_D}" stroke-width="2" stroke-linecap="round"/>`).join('')}
      ${frond(-40, 22, dk)}${frond(40, 22, dk)}${frond(-34, -6, col)}${frond(36, -4, col)}${frond(-12, -22, col)}${frond(14, -24, lt)}
      ${c(-4, -82, 4.5, '#6b4b2a')}${c(4, -81, 4.5, '#6b4b2a')}`,
      [[-30, -70], [30, -70], [-22, -88], [22, -90]]];
  },
  cypress(col, dk, lt) {
    return [`<rect x="-3" y="-14" width="6" height="14" rx="2" fill="${BARK}"/>
      <path d="M0 -112 C16 -86 20 -40 14 -12 Q0 -6 -14 -12 C-20 -40 -16 -86 0 -112 Z" fill="${dk}"/>
      <path d="M0 -112 C-16 -86 -20 -40 -14 -12 Q-4 -9 0 -9 Z" fill="${col}"/>
      <path d="M-5 -88 C-9 -70 -10 -50 -8 -34" stroke="${lt}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      [[-6, -40], [6, -60], [-4, -80], [6, -30], [0, -98]]];
  },
  willow(col, dk, lt) {
    const strands = Array.from({ length: 11 }, (_, i) => {
      const x = -30 + i * 6;
      return `<path d="M${x * .6} -80 Q${x} -60 ${x * 1.05} ${-26 - (i % 3) * 6}" stroke="${i % 2 ? col : dk}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    }).join('');
    return [`<path d="M-6 0 C-3 -30 -5 -50 -2 -70 L3 -70 C5 -50 3 -30 6 0 Z" fill="${BARK}"/>
      <ellipse cx="0" cy="-80" rx="30" ry="18" fill="${dk}"/>${strands}<ellipse cx="0" cy="-84" rx="24" ry="13" fill="${col}"/>
      <ellipse cx="-8" cy="-89" rx="9" ry="5" fill="${lt}"/>`,
      [[-22, -60], [20, -58], [-8, -84], [10, -82], [0, -50]]];
  },
  maple(col, dk, lt) {
    const leaf = (x, y, r, f) => `<path d="M${x} ${y - r} L${x + r * .35} ${y - r * .35} L${x + r} ${y - r * .2} L${x + r * .55} ${y + r * .25} L${x + r * .7} ${y + r} L${x} ${y + r * .6} L${x - r * .7} ${y + r} L${x - r * .55} ${y + r * .25} L${x - r} ${y - r * .2} L${x - r * .35} ${y - r * .35} Z" fill="${f}"/>`;
    return [`<path d="M-5 0 L-3 -44 L-12 -56 L-9 -58 L0 -48 L9 -58 L12 -56 L3 -44 L5 0 Z" fill="${BARK}"/>
      ${leaf(-18, -62, 20, dk)}${leaf(18, -62, 20, dk)}${leaf(0, -82, 24, dk)}${leaf(-12, -66, 16, col)}${leaf(14, -68, 16, col)}${leaf(0, -86, 19, col)}${leaf(-4, -94, 7, lt)}`,
      [[-16, -60], [16, -64], [0, -84], [-24, -70], [24, -70]]];
  },
};

Object.assign(SPECIES_DRAW, {
  cactus(col, dk, lt) {
    return [`<rect x="-10" y="-84" width="20" height="84" rx="10" fill="${col}"/>
      <path d="M-10 -38 h-12 a7 7 0 0 1 -7 -7 v-20 a6 6 0 0 1 12 0 v13 h7z" fill="${col}"/>
      <path d="M10 -50 h12 a7 7 0 0 0 7 -7 v-16 a6 6 0 0 0 -12 0 v9 h-7z" fill="${dk}"/>
      <rect x="-4" y="-78" width="4" height="72" rx="2" fill="${lt}" opacity=".45"/>
      ${[[-6, -66], [6, -50], [-6, -30], [6, -16], [-23, -56], [23, -64]].map(([x, y]) => `<path d="M${x} ${y} l-3 -2 M${x} ${y} l3 -2" stroke="#fff" stroke-width="1" opacity=".8"/>`).join('')}`,
      [[0, -88], [-23, -66], [23, -74]]];
  },
  mushroom(col, dk, lt) {
    return [`<path d="M-9 0 Q-11 -30 -7 -50 L7 -50 Q11 -30 9 0Z" fill="#f8f0e3"/><path d="M-6 -10 Q0 -6 6 -10" stroke="#e9dcc6" stroke-width="2" fill="none"/>
      <path d="M-42 -50 Q-40 -98 0 -100 Q40 -98 42 -50 Q0 -42 -42 -50Z" fill="${col}"/><path d="M-42 -50 Q0 -42 42 -50 Q0 -36 -42 -50Z" fill="${dk}"/>
      ${c(-22, -70, 7, '#fff')}${c(4, -86, 8, '#fff')}${c(24, -66, 6, '#fff')}${c(-6, -62, 4.5, '#fff')}<path d="M-26 -88 Q-14 -96 -2 -97" stroke="${lt}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      [[-30, -58], [30, -58], [-14, -54], [14, -54]]];
  },
  baobab(col, dk, lt) {
    return [`<path d="M-17 0 C-12 -20 -15 -50 -10 -66 L10 -66 C15 -50 12 -20 17 0Z" fill="#a47148"/><path d="M-6 -10 C-4 -30 -6 -46 -4 -60" stroke="#8a5a3b" stroke-width="2" fill="none"/>
      <path d="M-8 -64 L-24 -78 M0 -66 L0 -84 M8 -64 L24 -78" stroke="#a47148" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="-26" cy="-82" rx="19" ry="8" fill="${dk}"/><ellipse cx="26" cy="-82" rx="19" ry="8" fill="${dk}"/><ellipse cx="0" cy="-90" rx="23" ry="9" fill="${col}"/>
      <ellipse cx="-22" cy="-86" rx="14" ry="6" fill="${col}"/><ellipse cx="22" cy="-86" rx="14" ry="6" fill="${col}"/><ellipse cx="-4" cy="-94" rx="9" ry="3" fill="${lt}"/>`,
      [[-30, -84], [30, -84], [0, -96], [-12, -88], [12, -88]]];
  },
  crystal(col, dk, lt) {
    const star = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25}Z" fill="#fff"/>`;
    return [`<rect x="-3" y="-30" width="6" height="30" fill="#495057"/>
      <path d="M0 -112 L18 -72 L10 -30 L-10 -30 L-18 -72Z" fill="${col}" opacity=".88"/><path d="M0 -112 L18 -72 L10 -30 L0 -30Z" fill="${dk}" opacity=".55"/>
      <path d="M-18 -70 L-35 -60 L-25 -36 L-12 -40Z" fill="${lt}" opacity=".92"/><path d="M18 -66 L33 -54 L25 -34 L12 -40Z" fill="${col}" opacity=".92"/>
      <path d="M-4 -98 L-10 -58" stroke="#fff" stroke-width="2.5" opacity=".7"/>${star(-26, -76, 6)}${star(22, -92, 5)}${star(8, -50, 4)}`,
      [[-24, -52], [26, -48], [0, -80], [-8, -100]]];
  },
  rainbow() {
    const cols = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
    const pts = [[-24, -58, 17], [24, -58, 17], [-14, -78, 18], [14, -78, 18], [0, -96, 17], [0, -64, 17]];
    return [`<path d="M-6 0 L-4 -46 L4 -46 L6 0Z" fill="${BARK}"/>${pts.map(([x, y, r], i) => c(x, y, r, cols[i])).join('')}
      ${pts.map(([x, y, r], i) => c(x - r * .35, y - r * .35, r * .3, shade(cols[i], .45))).join('')}`,
      [[-20, -62], [20, -62], [0, -84]]];
  },
});

Object.assign(SPECIES_DRAW, {
  apple(col, dk, lt) {
    return [`<path d="M-6 0 L-4 -40 L-12 -52 L-9 -54 L-1 -45 L0 -58 L3 -58 L3 -45 L10 -54 L13 -51 L4 -40 L6 0 Z" fill="${BARK}"/>
      ${c(0, -70, 30, dk)}${c(-14, -66, 20, col)}${c(14, -66, 20, col)}${c(0, -80, 22, col)}${c(-8, -86, 8, lt)}
      ${[[-18, -60], [6, -58], [16, -74], [-6, -76], [20, -56], [-22, -74]].map(([x, y]) => `${c(x, y, 3.6, '#e03131')}${c(x - 1, y - 1.2, 1, '#ffc9c9')}`).join('')}`,
      [[-12, -70], [10, -84], [0, -60]]];
  },
  fir(col, dk, lt) {
    const tier = (y, w, h) => `<path d="M${-w} ${y} Q0 ${y + 6} ${w} ${y} L0 ${y - h} Z" fill="${col}"/><path d="M0 ${y - h} L${w} ${y} Q${w / 2} ${y + 4} 0 ${y + 3} Z" fill="${dk}"/>
      <path d="M${-w * .55} ${y - h * .42} Q0 ${y - h * .3} ${w * .55} ${y - h * .42}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>`;
    return [`<rect x="-4" y="-16" width="8" height="16" rx="2" fill="${BARK_D}"/>${tier(-12, 30, 34)}${tier(-36, 24, 32)}${tier(-58, 17, 32)}${tier(-78, 11, 26)}`,
      [[-12, -20], [12, -22], [-8, -44], [9, -46], [0, -70]]];
  },
  bonsai(col, dk, lt) {
    return [`<path d="M-22 0 h44 l-4 10 h-36 Z" fill="#8d6e63" transform="translate(0 -10)"/><rect x="-24" y="-12" width="48" height="4" rx="2" fill="#6d4c41"/>
      <path d="M-2 -12 C-8 -24 8 -30 2 -42 C-2 -50 -14 -50 -20 -56 M2 -42 C10 -48 18 -46 24 -54" stroke="${BARK_D}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="-20" cy="-60" rx="18" ry="9" fill="${dk}"/><ellipse cx="-22" cy="-63" rx="14" ry="6" fill="${col}"/>
      <ellipse cx="22" cy="-58" rx="16" ry="8" fill="${dk}"/><ellipse cx="22" cy="-61" rx="12" ry="5.5" fill="${col}"/>
      <ellipse cx="2" cy="-74" rx="15" ry="7" fill="${dk}"/><ellipse cx="0" cy="-77" rx="11" ry="5" fill="${col}"/><ellipse cx="-4" cy="-79" rx="4" ry="2" fill="${lt}"/>`,
      [[-20, -64], [22, -62], [0, -78]]];
  },
  bamboo(col, dk, lt) {
    const stalk = (x, h, f) => `<rect x="${x - 3}" y="${-h}" width="6" height="${h}" rx="3" fill="${f}"/>${Array.from({ length: Math.floor(h / 18) }, (_, i) => `<rect x="${x - 3.5}" y="${-18 * (i + 1)}" width="7" height="2" rx="1" fill="${shade(f, -.3)}"/>`).join('')}`;
    const leaf = (x, y, d) => `<path d="M${x} ${y} q${d * 10} -6 ${d * 18} -2 q${-d * 8} 6 ${-d * 18} 2Z" fill="${lt}"/>`;
    return [`${stalk(-10, 92, dk)}${stalk(2, 108, col)}${stalk(13, 80, dk)}${leaf(-10, -70, -1)}${leaf(2, -96, 1)}${leaf(2, -60, -1)}${leaf(13, -56, 1)}${leaf(-10, -40, 1)}`,
      [[-10, -94], [2, -110], [13, -82]]];
  },
  acacia(col, dk, lt) {
    return [`<path d="M-4 0 L-2 -40 L-20 -62 L-16 -64 L0 -46 L14 -66 L18 -63 L4 -40 L5 0Z" fill="${BARK}"/>
      <path d="M-46 -64 Q-30 -82 0 -80 Q30 -84 46 -66 Q20 -58 0 -60 Q-24 -56 -46 -64Z" fill="${dk}"/>
      <path d="M-40 -68 Q-24 -84 0 -82 Q26 -86 40 -70 Q16 -66 0 -68 Q-20 -64 -40 -68Z" fill="${col}"/><path d="M-20 -78 Q0 -84 16 -80" stroke="${lt}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      [[-30, -70], [30, -72], [0, -78], [-12, -74], [14, -76]]];
  },
  poplar(col, dk, lt) {
    return [`<rect x="-3" y="-20" width="6" height="20" rx="2" fill="${BARK}"/>
      <ellipse cx="0" cy="-66" rx="17" ry="50" fill="${dk}"/><ellipse cx="-4" cy="-70" rx="12" ry="44" fill="${col}"/>
      ${[[-6, -96], [-8, -72], [-6, -48], [4, -84], [4, -58]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="8" fill="${lt}" opacity=".55"/>`).join('')}`,
      [[-8, -90], [6, -70], [-6, -46], [4, -106]]];
  },
  candy() {
    const pop = (x, y, r, a, b) => `${c(x, y, r, a)}<path d="M${x - r * .7} ${y - r * .2} A${r * .7} ${r * .7} 0 0 1 ${x + r * .5} ${y - r * .5}" stroke="${b}" stroke-width="${r * .35}" fill="none"/><path d="M${x - r * .3} ${y + r * .1} A${r * .35} ${r * .35} 0 0 1 ${x + r * .3} ${y}" stroke="${b}" stroke-width="${r * .3}" fill="none"/>`;
    return [`<rect x="-4" y="-56" width="8" height="56" rx="3" fill="#fff"/>${[-50, -40, -30, -20, -10].map(y => `<path d="M-4 ${y} l8 -6" stroke="#f03e3e" stroke-width="3"/>`).join('')}
      ${pop(-20, -66, 15, '#f783ac', '#fff')}${pop(20, -66, 15, '#74c0fc', '#fff')}${pop(0, -88, 18, '#ffd43b', '#ff922b')}${pop(0, -62, 12, '#b197fc', '#fff')}`,
      [[-20, -80], [20, -80], [0, -104]]];
  },
  golden() {
    const g = '#fcc419', gd = '#e67700', gl = '#fff3bf';
    const spark = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25}Z" fill="#fff"/>`;
    return [`<path d="M-6 0 L-4 -42 L-14 -58 L-11 -60 L-2 -48 L-1 -64 L3 -64 L3 -48 L12 -60 L15 -57 L5 -42 L6 0 Z" fill="#b8860b"/>
      ${c(-24, -58, 20, gd)}${c(24, -58, 20, gd)}${c(0, -80, 25, gd)}${c(-17, -64, 18, g)}${c(17, -64, 18, g)}${c(0, -84, 21, g)}${c(0, -60, 18, g)}
      ${c(-9, -90, 9, gl)}${c(12, -72, 6, gl)}${spark(-26, -80, 6)}${spark(24, -92, 7)}${spark(4, -54, 5)}`,
      [[-20, -60], [18, -66], [0, -86]]];
  },
});

// Inner <g> markup for one tree. stage 0 sapling, 1 young, 2 full, 3 grand.
function treeG(species, color, stage, seed = 'x') {
  const col = color || '#2f9e44', dk = shade(col, -.28), lt = shade(col, .38);
  const shadow = `<ellipse cx="0" cy="1" rx="${[10, 20, 30, 36][stage]}" ry="${[2.5, 4, 5.5, 6.5][stage]}" fill="rgba(0,0,0,.16)"/>`;
  if (stage === 0) {
    return `${shadow}<path d="M0 0 C1 -8 -1 -16 0 -24" stroke="${shade(col, -.35)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M0 -16 C-14 -24 -16 -10 -2 -12 Z" fill="${col}"/><path d="M0 -21 C12 -32 18 -18 2 -18 Z" fill="${dk}"/><path d="M0 -24 C-4 -34 4 -36 1 -24 Z" fill="${lt}"/>`;
  }
  const [body, fruit] = (SPECIES_DRAW[species] || SPECIES_DRAW.oak)(col, dk, lt);
  const k = [0, .64, 1, 1.18][stage];
  let extra = '';
  if (stage === 3) {
    const rnd = seeded(seed);
    const bloom = species === 'cherry' ? '#ffd43b' : species === 'palm' ? '#7a4a1f' : rnd() < .5 ? '#ffffff' : '#ffd43b';
    extra = fruit.map(([x, y]) => `<circle cx="${x + (rnd() - .5) * 4}" cy="${y + (rnd() - .5) * 4}" r="3.4" fill="${bloom}" stroke="rgba(0,0,0,.12)" stroke-width=".8"/>`).join('');
  }
  return `${shadow}<g transform="scale(${k})">${body}${extra}</g>`;
}

// Standalone small tree icon (focus bar, legend). grow 0..1 animates a growing tree.
function treeSvg(color, mins, grow = 1, species = 'oak', h = 52) {
  const stage = grow < 1 ? (grow < .3 ? 0 : grow < .65 ? 1 : 2) : treeStage(mins);
  return `<svg class="tree" viewBox="-42 -128 84 134" width="${Math.round(h * 84 / 134)}" height="${h}" aria-hidden="true">${treeG(species, color, stage, mins)}</svg>`;
}

function bestStreak() {
  const days = [...new Set(Object.entries(D.focusLogs.reduce((a, l) => (a[l.date] = (a[l.date] || 0) + l.mins, a), {})).filter(([, m]) => m >= 30).map(([d]) => d))].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

function forestScene(logs) {
  const W = 1000, H = 440, hr = new Date().getHours();
  const sc = SCENES[D.game.scene] || SCENES.meadow;
  const night = sc.night || hr >= 20 || hr < 6, dusk = !night && hr >= 17;
  const sky = sc.night ? (sc.sky || ['#0b1a3a', '#24406e']) : night ? ['#16204a', '#3a4a86'] : dusk ? ['#ff9a6b', '#ffe0b8'] : sc.sky || ['#8fd0ff', '#e6f6ff'];
  const rnd = seeded('scene');
  const stars = night ? Array.from({ length: sc.noAurora ? 90 : 40 }, () => c(Math.round(rnd() * W), Math.round(rnd() * 170), (rnd() * 1.2 + .4).toFixed(1), 'rgba(255,255,255,.85)')).join('') : '';
  const orb = night ? `${c(830, 70, 26, '#f8f3d4')}${c(842, 62, 24, sky[0])}` : `${c(dusk ? 160 : 840, dusk ? 170 : 72, 48, dusk ? 'rgba(255,210,122,.3)' : 'rgba(255,240,150,.35)')}${c(dusk ? 160 : 840, dusk ? 170 : 72, 32, dusk ? '#ffd27a' : '#ffe066')}`;
  const cloud = (x, y, s, i) => `<g class="cloud" style="animation-delay:${-i * 13}s"><g transform="translate(${x} ${y}) scale(${s})" fill="${night ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)'}">${c(0, 0, 18, '')}${c(22, -8, 22, '')}${c(46, 0, 17, '')}<rect x="0" y="-2" width="46" height="19" rx="9"/></g></g>`.replace(/fill=""/g, '');
  const dim = sc.night ? 0 : night ? -.45 : dusk ? -.15 : 0;
  const tone = x => dim ? shade(x, dim) : x;
  const g1 = tone(sc.hills), g2 = tone(sc.g1), g3 = tone(sc.g2);
  const aurora = sc.night && !sc.noAurora ? `<g class="aurora"><path d="M-20 190 C150 110 300 210 480 140 S800 100 1020 170" stroke="#63e6be" stroke-width="34" fill="none" opacity=".35"/>
    <path d="M-20 215 C200 150 380 230 560 170 S860 140 1020 205" stroke="#b197fc" stroke-width="26" fill="none" opacity=".3"/></g>` : '';
  const fr = seeded('fall');
  const fall = sc.fall ? Array.from({ length: sc.rain ? 70 : 28 }, (_, i) => {
    const x = Math.round(fr() * W), col = sc.fall[i % sc.fall.length], snow = D.game.scene === 'winter';
    if (sc.rain) return `<g class="fall rain" style="--sway:-30px;animation-duration:${(1 + fr() * .8).toFixed(2)}s;animation-delay:-${(fr() * 2).toFixed(2)}s"><path d="M${x} 0 l-3 12" stroke="${col}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>`;
    return `<g class="fall" style="--sway:${Math.round((fr() - .5) * 120)}px;animation-duration:${(7 + fr() * 7).toFixed(1)}s;animation-delay:-${(fr() * 14).toFixed(1)}s">${snow ? c(x, 0, (1.5 + fr() * 2).toFixed(1), col) : `<ellipse cx="${x}" cy="0" rx="4" ry="2.2" fill="${col}" transform="rotate(${Math.round(fr() * 180)} ${x} 0)"/>`}</g>`;
  }).join('') : '';

  // place trees: scattered slots, drawn back to front
  const n = logs.length;
  const cols = Math.max(4, Math.ceil(Math.sqrt(n * 3.2))), rows = Math.max(1, Math.ceil(n / cols));
  const slots = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) slots.push([r, q]);
  const sr = seeded('slots' + n);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const size = Math.min(1.5, 2.6 / Math.sqrt(rows + 1)) * (cols > 10 ? 10 / cols * 1.1 : 1);
  const placed = logs.map((l, i) => {
    const [r, q] = slots[i], rr = seeded(l.id);
    const y = 268 + (rows === 1 ? 110 : r * (150 / (rows - 1)));
    const x = 70 + (q + .5) * ((W - 140) / cols) + (rr() - .5) * (W / cols) * .5 + (r % 2 ? (W / cols) * .25 : 0);
    const persp = .62 + .38 * (y - 268) / 150;
    return { l, x, y, s: size * persp, i };
  }).sort((a, b) => a.y - b.y);
  const deco = Array.from({ length: 34 }, (_, i) => {
    const x = Math.round(rnd() * W), y = 262 + Math.round(rnd() * 170);
    return i % 3 ? `<path d="M${x} ${y} l-3 -7 M${x} ${y} l0 -9 M${x} ${y} l3 -7" stroke="${g3}" stroke-width="1.6" stroke-linecap="round"/>`
      : `${c(x, y - 3, 2.6, ['#fff', '#ffd43b', '#f783ac'][i % 3])}`;
  }).join('');
  const ground = groundItems().map(g => ({ y: g.y, svg: `<g transform="translate(${g.x} ${g.y}) scale(${(1.25 * (.62 + .38 * (g.y - 268) / 150)).toFixed(3)})"><g class="ftree deco">${g.svg}</g></g>` }));
  const trees = [...placed.map(p => {
    const s = subj(p.l.subjectId);
    return { y: p.y, svg: `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.s.toFixed(3)})"><g class="ftree click ${p.l.withered ? 'withered' : treeRec(p.l.id).wilted ? 'wilt' : ''}" data-act="treeInfo" data-id="${p.l.id}" style="animation-delay:${Math.min(p.i * 35, 1400)}ms">
      <title>${esc(treeName(p.l))} · ${esc(s.name)} · ${fmtMins(p.l.mins)} · ${fmtDate(p.l.date)} (click for details)</title>${treeG(speciesFor(p.l.subjectId), s.color, treeStage(p.l.mins), p.l.id)}</g></g>` };
  }), ...ground].sort((a, b) => a.y - b.y).map(x => x.svg).join('');
  const empty = n ? '' : `<g transform="translate(500 360) scale(1.6)"><g class="ftree">${treeG('oak', '#40c057', 0)}</g></g>
    <text x="500" y="410" text-anchor="middle" font-size="18" font-weight="700" fill="${night ? '#e9f5e9' : '#2b5a2a'}">Your forest is waiting. Study for 10+ minutes to plant your first tree.</text>`;
  return `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Your study forest: ${n} trees">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g2}"/><stop offset="1" stop-color="${g3}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}${aurora}${orb}
    ${cloud(120, 70, 1, 0)}${cloud(470, 50, .8, 1)}${cloud(700, 110, 1.1, 2)}
    <path d="M0 220 Q140 150 300 200 T620 190 T1000 200 L1000 ${H} L0 ${H} Z" fill="${g1}" opacity=".75"/>
    <path d="M0 250 Q200 214 420 240 T1000 236 L1000 ${H} L0 ${H} Z" fill="url(#grass)"/>
    ${deco}${trees}${empty}${critterSprites()}${skyCreatures()}${fall}</svg>`;
}

function viewForest() {
  const t = today(), wk = mondayOf(t);
  const range = ui.forestRange || 'week';
  const from = range === 'week' ? wk : range === 'month' ? t.slice(0, 8) + '01' : '0000';
  const logs = D.focusLogs.filter(l => l.mins >= 10 && l.date >= from).sort((a, b) => a.start - b.start || a.date.localeCompare(b.date));
  const allTrees = D.focusLogs.filter(l => l.mins >= 10);
  const mins = D.focusLogs.filter(l => l.date >= from).reduce((a, l) => a + l.mins, 0);
  const streak = studyStreak(), best = bestStreak();
  const totalMins = D.focusLogs.reduce((a, l) => a + l.mins, 0);
  const grand = allTrees.filter(l => l.mins >= 90).length;
  const seg = (v, label) => `<button class="${range === v ? 'on' : ''}" data-act="forestRange" data-v="${v}">${label}</button>`;
  const gview = D.settings.forestView || 'grid';
  const gseg = (v, label) => `<button class="${gview === v ? 'on' : ''}" data-act="forestView" data-v="${v}">${label}</button>`;
  const stat = (big, label) => `<div class="fstat"><b>${big}</b><span>${label}</span></div>`;
  const legend = D.subjects.map(s => {
    const sp = speciesFor(s.id), cnt = allTrees.filter(l => l.subjectId === s.id).length;
    return `<div class="fleg" style="--c:${s.color}">${treeSvg(s.color, 45, 1, sp, 46)}<div class="main"><b>${esc(s.name)}</b><div class="muted small-text">${esc(speciesName(sp))} · <span style="color:${RARITY[speciesRarity(sp)].color};font-weight:700">${RARITY[speciesRarity(sp)].name}</span> · ${cnt} tree${cnt === 1 ? '' : 's'}</div>${TREE_BUFFS[sp] ? `<div class="tbuff sm">★ ${esc(TREE_BUFFS[sp].text)}</div>` : ''}</div>
      <button class="btn small" data-act="treePick" data-id="${s.id}" title="Choose this subject's tree">Change tree</button></div>`;
  }).join('');
  const stages = TREE_STAGES.map(([m, name], i) => `<div class="fstage">${`<svg class="tree" viewBox="-42 -128 84 134" width="40" height="64">${treeG('oak', '#40c057', i, 'stage')}</svg>`}<b>${name}</b><span class="muted small-text">${m}+ min</span></div>`).join('');
  const recent = D.focusLogs.slice(-5).reverse();
  let page = ui.forestPage || 'forest'; if (page === 'boxes') page = 'shop';
  const nClaim = claimable(), nReward = rewardsWaiting();
  const tab = (v, label) => `<button class="${page === v ? 'on' : ''}" data-act="forestPage" data-v="${v}">${label}</button>`;
  const head = `<div class="card-head forest-head"><h1 style="margin:0">My forest</h1>${gameHeader()}<span class="spacer" style="flex:1"></span>
      <button class="btn primary" data-act="focusNew">▶ Start studying</button></div>
    <div class="seg forest-tabs">${tab('forest', `🌳 Forest${nClaim + nReward ? ` <span class="dotbadge">${nClaim + nReward}</span>` : ''}`)}${tab('trees', '🌲 My trees')}${tab('critters', `🐾 Critters <span class="muted">${Object.keys(D.game.critters || {}).length}/${CRITTERS.length}</span>`)}${tab('shop', `🛒 Shop${giftReady() ? ' <span class="dotbadge">1</span>' : ''}`)}${tab('collection', `📖 Collection <span class="muted">${ITEMS.filter(i => owned(i.id)).length}/${ITEMS.length}</span>`)}</div>`;
  if (page === 'shop') return `${head}${shopView()}`;
  if (page === 'trees') return `${head}${treesView()}`;
  if (page === 'critters') return `${head}${crittersView()}`;
  if (page === 'collection') return `${head}${collectionView()}`;
  return `${head}
    <div class="scene-wrap ${gview === 'grid' ? 'isowrap' : ''}">${gview === 'grid' ? forestGrid(logs) : forestScene(logs)}
      <div class="scene-stats">${stat(logs.length, logs.length === 1 ? 'tree' : 'trees')}${stat(fmtMins(mins) || '0m', 'studied')}${stat('🔥 ' + streak, 'day streak')}${stat(best, 'best streak')}</div>
      <div class="scene-ctl"><div class="seg">${gseg('grid', '🧊 3D garden')}${gseg('scene', '🌄 Scene')}</div><div class="seg">${seg('week', 'This week')}${seg('month', 'This month')}${seg('all', 'All time')}</div></div>
      ${gview === 'grid' ? '<div class="iso-hint">Drag a tree to move it · hover to see it sway</div>' : ''}</div>
    <div class="forest-cols">
      <div class="stack">
      ${challengesCard()}
      ${setbacksCard()}
      </div>
      <div class="stack">
      ${milestonesCard()}
      <div class="card"><h2>Your trees</h2><p class="muted small-text" style="margin-top:0">Each subject grows its own tree. Pick a different one for any subject. ★ trees come from lucky boxes and give a small buff to every session you grow as that tree.</p><div class="flegs">${legend || '<div class="empty">Add subjects in the Study tab.</div>'}</div><details class="howgrow"><summary class="muted small-text">How trees grow</summary><div class="fstages">${stages}</div>
        <p class="muted small-text">A day counts toward your streak when you study 30+ minutes. Grand trees blossom. Click any tree in the forest to name it, water it and see its stats.</p></details></div>
      <div class="card"><h2>Recent sessions</h2>${recent.length ? `<ul class="list">${recent.map(l => `<li class="item tinted" style="--c:${subj(l.subjectId).color}">${treeSvg(subj(l.subjectId).color, l.mins, 1, speciesFor(l.subjectId), 34)}<div class="main"><div class="title">${esc(subj(l.subjectId).name)} · ${fmtMins(l.mins)}</div><div class="meta">${fmtDate(l.date)} ${fmtTime(new Date(l.start).toTimeString().slice(0, 5))}${l.mins < 10 ? ' · too short for a tree' : ''}</div></div><button class="iconbtn" data-act="delLog" data-id="${l.id}" title="Delete">✕</button></li>`).join('')}</ul>` : '<div class="empty">No sessions yet. Press ▶ Focus on a study block or Start studying.</div>'}</div>
      </div>
    </div>`;
}
