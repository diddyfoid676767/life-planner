'use strict';
/* Garden idle game: every tree in the forest grows 🍃 leaves over time, even
   while the app is closed. Leaves pile up in the basket until it is full, so
   come back and collect them. Leaves are the garden's own money: garden
   upgrades, decorations and scenes. 🪙 coins buy everything else (lucky
   boxes, trees, animals and the Arena), and the two never swap. Rarer trees grow leaves faster, watered trees grow
   faster, and study sessions give a burst of fresh leaves. */

const LEAF = '🍃';
const LEAF_START = '2026-10-24'; // tree coin buffs stop for sessions from this day; leaves replace them

// ---------- more tree species ----------
Object.assign(SPECIES_DRAW, {
  jacaranda() {
    const p = '#9775fa', pd = '#7048e8', pl = '#d0bfff';
    return [`<path d="M-5 0 C-4 -20 -6 -34 -2 -44 L-22 -60 L-19 -63 L0 -50 L1 -66 L5 -66 L4 -48 L22 -60 L24 -57 L5 -42 C6 -28 5 -14 6 0Z" fill="${BARK_D}"/>
      ${c(-28, -62, 16, pd)}${c(28, -62, 16, pd)}${c(0, -80, 22, pd)}${c(-18, -68, 15, p)}${c(18, -70, 15, p)}${c(0, -86, 17, p)}${c(0, -64, 14, p)}
      ${[[-24, -70], [-10, -60], [-4, -94], [8, -86], [16, -76], [26, -64], [-2, -72], [12, -96], [-28, -56]].map(([x, y]) => c(x, y, 3, pl)).join('')}
      ${[[-30, -20], [-14, -6], [18, -12], [32, -4], [6, -2]].map(([x, y]) => c(x, y, 2.2, p)).join('')}`,
      [[-18, -66], [16, -72], [0, -90]]];
  },
  ghostgum(col, dk, lt) {
    return [`<path d="M-5 0 C-6 -24 -2 -40 -4 -56 C-14 -64 -20 -70 -26 -80 L-22 -82 C-14 -72 -6 -66 -1 -62 L0 -86 L4 -86 L4 -62 C10 -68 16 -74 22 -84 L26 -82 C20 -70 12 -62 5 -54 C3 -36 6 -20 6 0Z" fill="#f1f3f5"/>
      <path d="M-2 -8 C-1 -20 -3 -34 -1 -48" stroke="#dee2e6" stroke-width="2" fill="none"/>
      <ellipse cx="-26" cy="-86" rx="16" ry="9" fill="${dk}"/><ellipse cx="24" cy="-88" rx="15" ry="9" fill="${dk}"/><ellipse cx="2" cy="-96" rx="18" ry="10" fill="${dk}"/>
      <ellipse cx="-24" cy="-89" rx="12" ry="6" fill="${col}"/><ellipse cx="22" cy="-91" rx="11" ry="6" fill="${col}"/><ellipse cx="2" cy="-99" rx="13" ry="6" fill="${col}"/><ellipse cx="-2" cy="-102" rx="5" ry="2.4" fill="${lt}"/>`,
      [[-24, -88], [22, -90], [2, -100]]];
  },
  bottlebrush(col, dk, lt) {
    const brush = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-5" y="-16" width="10" height="16" rx="5" fill="#e03131"/>${[-14, -10, -6, -2].map(yy => `<path d="M-7 ${yy} h14" stroke="#ff8787" stroke-width="1.4"/>`).join('')}${c(0, -17, 2, '#ffd43b')}</g>`;
    return [`<path d="M-4 0 L-3 -40 L-14 -54 L-11 -56 L0 -46 L11 -56 L14 -54 L3 -40 L4 0Z" fill="${BARK}"/>
      ${c(-18, -62, 18, dk)}${c(18, -62, 18, dk)}${c(0, -78, 20, dk)}${c(-14, -66, 14, col)}${c(14, -66, 14, col)}${c(0, -82, 15, col)}
      ${brush(-22, -58, -30)}${brush(22, -60, 30)}${brush(0, -90, 0)}${brush(-8, -66, -10)}${brush(10, -72, 15)}`,
      [[-16, -64], [16, -66], [0, -82]]];
  },
  redwood(col, dk, lt) {
    const tier = (y, w, h) => `<path d="M${-w} ${y} Q0 ${y + 4} ${w} ${y} L${w * .3} ${y - h} L${-w * .3} ${y - h}Z" fill="${col}"/><path d="M0 ${y - h} L${w * .3} ${y - h} L${w} ${y} Q${w / 2} ${y + 3} 0 ${y + 2}Z" fill="${dk}"/>`;
    return [`<path d="M-8 0 L-5 -118 L5 -118 L8 0Z" fill="#a0522d"/><path d="M-3 -4 L-2 -110" stroke="#7f3f1d" stroke-width="2"/>
      ${tier(-44, 22, 14)}${tier(-62, 20, 14)}${tier(-80, 17, 14)}${tier(-98, 13, 14)}${tier(-114, 8, 12)}`,
      [[-12, -48], [12, -66], [-10, -84], [8, -100]]];
  },
  dragon(col, dk, lt) {
    const br = (a) => `<path d="M0 -40 Q${a * .4} -56 ${a} -70" stroke="#8d6e63" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    return [`<path d="M-7 0 L-5 -42 L5 -42 L7 0Z" fill="#8d6e63"/>${br(-30)}${br(-12)}${br(12)}${br(30)}
      <path d="M-50 -66 Q-40 -96 0 -98 Q40 -96 50 -66 Q0 -76 -50 -66Z" fill="${dk}"/><path d="M-44 -70 Q-34 -94 0 -94 Q34 -94 44 -70 Q0 -80 -44 -70Z" fill="${col}"/>
      ${Array.from({ length: 13 }, (_, i) => { const x = -42 + i * 7; return `<path d="M${x} -72 l-2 -8 M${x} -72 l2 -8" stroke="${lt}" stroke-width="1.4"/>`; }).join('')}
      ${[[-30, -74], [-6, -78], [18, -76], [36, -70]].map(([x, y]) => c(x, y, 2.6, '#c92a2a')).join('')}`,
      [[-30, -80], [30, -80], [0, -92]]];
  },
  frost() {
    const ice = '#a5d8ff', iced = '#74c0fc', icel = '#e7f5ff';
    return [`<path d="M-5 0 L-3 -44 L-13 -58 L-10 -60 L-1 -50 L0 -66 L3 -66 L3 -50 L11 -60 L14 -57 L4 -44 L5 0Z" fill="#adb5bd"/>
      ${c(-24, -60, 19, iced)}${c(24, -60, 19, iced)}${c(0, -82, 24, iced)}${c(-16, -66, 17, ice)}${c(16, -66, 17, ice)}${c(0, -86, 20, ice)}${c(0, -62, 17, ice)}
      ${c(-8, -92, 8, icel)}${c(14, -74, 5, icel)}
      ${[[-28, -76, 5], [20, -96, 6], [6, -52, 4]].map(([x, y, r]) => `<path d="M${x - r} ${y} h${2 * r} M${x} ${y - r} v${2 * r} M${x - r * .7} ${y - r * .7} l${r * 1.4} ${r * 1.4} M${x + r * .7} ${y - r * .7} l${-r * 1.4} ${r * 1.4}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`).join('')}
      ${[[-30, -46], [-16, -48], [20, -48], [32, -46]].map(([x, y]) => `<path d="M${x - 2} ${y} l2 9 l2 -9Z" fill="${icel}"/>`).join('')}`,
      [[-18, -64], [18, -66], [0, -88]]];
  },
  ember() {
    const f1 = '#ff6b00', f2 = '#ffa94d', f3 = '#ffe066';
    return [`<path d="M-6 0 L-4 -42 L-14 -58 L-11 -60 L-2 -48 L-1 -64 L3 -64 L3 -48 L12 -60 L15 -57 L5 -42 L6 0 Z" fill="#3b2a24"/><path d="M-1 -4 L0 -40" stroke="#ff6b00" stroke-width="1.6" opacity=".8"/>
      <path d="M-36 -54 C-40 -74 -24 -78 -26 -96 C-14 -88 -12 -104 0 -116 C10 -102 14 -92 24 -100 C24 -84 40 -76 36 -54 Q0 -40 -36 -54Z" fill="#e8590c"/>
      <path d="M-26 -56 C-30 -70 -18 -74 -18 -86 C-8 -80 -6 -94 2 -102 C8 -90 12 -84 18 -88 C18 -76 30 -70 26 -56 Q0 -46 -26 -56Z" fill="${f1}"/>
      <path d="M-14 -58 C-16 -68 -8 -72 -6 -80 C0 -74 4 -82 8 -86 C10 -76 18 -70 14 -58 Q0 -52 -14 -58Z" fill="${f2}"/>
      <path d="M-5 -60 C-6 -66 -2 -68 0 -72 C3 -66 6 -66 5 -60 Q0 -57 -5 -60Z" fill="${f3}"/>
      ${[[-30, -100], [26, -108], [8, -122]].map(([x, y]) => c(x, y, 1.8, f3)).join('')}`,
      [[-20, -64], [20, -66], [0, -86]]];
  },
  moon() {
    const m = '#5f3dc4', md = '#3b2a8a', ml = '#b197fc';
    return [`<path d="M-5 0 C-4 -20 -6 -34 -2 -46 L-18 -62 L-15 -64 L0 -52 L2 -68 L6 -68 L4 -50 L18 -60 L20 -57 L5 -44 C6 -30 5 -16 6 0Z" fill="#343a40"/>
      ${c(0, -76, 34, 'rgba(177,151,252,.25)')}
      ${c(-24, -62, 17, md)}${c(24, -62, 17, md)}${c(0, -80, 22, md)}${c(-16, -68, 15, m)}${c(16, -70, 15, m)}${c(0, -84, 18, m)}${c(0, -62, 14, m)}
      <path d="M12 -98 A11 11 0 1 1 -2 -84 A8 8 0 1 0 12 -98Z" fill="#fff3bf"/>
      ${[[-26, -74], [-10, -58], [18, -58], [28, -76], [-14, -92], [4, -66]].map(([x, y], i) => c(x, y, i % 2 ? 1.6 : 2.2, i % 3 ? '#fff' : ml)).join('')}`,
      [[-18, -66], [18, -68], [0, -86]]];
  },
});
ITEMS.push(
  { id: 'sp_jacaranda', type: 'tree', name: 'Jacaranda', rarity: 'rare', species: 'jacaranda' },
  { id: 'sp_ghostgum', type: 'tree', name: 'Ghost gum', rarity: 'rare', species: 'ghostgum' },
  { id: 'sp_bottlebrush', type: 'tree', name: 'Bottlebrush', rarity: 'rare', species: 'bottlebrush' },
  { id: 'sp_redwood', type: 'tree', name: 'Giant redwood', rarity: 'epic', species: 'redwood' },
  { id: 'sp_dragon', type: 'tree', name: 'Dragon tree', rarity: 'epic', species: 'dragon' },
  { id: 'sp_frost', type: 'tree', name: 'Frost tree', rarity: 'epic', species: 'frost' },
  { id: 'sp_ember', type: 'tree', name: 'Ember tree', rarity: 'legendary', species: 'ember' },
  { id: 'sp_moon', type: 'tree', name: 'Moonlight tree', rarity: 'legendary', species: 'moon' },
);
BONUS_SPECIES.push(['jacaranda', 'Jacaranda', 'sp_jacaranda'], ['ghostgum', 'Ghost gum', 'sp_ghostgum'], ['bottlebrush', 'Bottlebrush', 'sp_bottlebrush'],
  ['redwood', 'Giant redwood', 'sp_redwood'], ['dragon', 'Dragon tree', 'sp_dragon'], ['frost', 'Frost tree', 'sp_frost'], ['ember', 'Ember tree', 'sp_ember'], ['moon', 'Moonlight tree', 'sp_moon']);

// ---------- 2.17 trees ----------
Object.assign(SPECIES_DRAW, {
  wattle(col, dk, lt) {
    const g = '#7a9a3a', gd = '#5c7a2a';
    return [`<path d="M-4 0 C-3 -18 -5 -32 -2 -42 L-16 -56 L-13 -58 L0 -48 L2 -62 L6 -62 L4 -46 L16 -56 L18 -53 L5 -40 C6 -26 4 -12 5 0Z" fill="${BARK}"/>
      ${c(-22, -60, 16, gd)}${c(22, -60, 16, gd)}${c(0, -78, 20, gd)}${c(-14, -64, 13, g)}${c(14, -66, 13, g)}${c(0, -82, 15, g)}
      ${[[-30, -62], [-22, -72], [-12, -56], [-6, -88], [4, -76], [12, -92], [18, -58], [26, -68], [30, -56], [-18, -84], [8, -62], [20, -80], [-28, -52], [0, -96]].map(([x, y], i) => c(x, y, i % 3 ? 3 : 3.8, i % 2 ? '#fcc419' : '#ffd43b')).join('')}`,
      [[-18, -64], [18, -66], [0, -84]]];
  },
  magnolia(col, dk, lt) {
    const fl = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-7 -3 -8 -11 -3 -14 C-1 -9 1 -9 3 -14 C8 -11 7 -3 0 0Z" fill="#fcc2d7"/><path d="M0 0 C-3 -4 -3 -9 0 -12 C3 -9 3 -4 0 0Z" fill="#fff0f6"/></g>`;
    return [`<path d="M-5 0 C-4 -16 -6 -28 -2 -38 L-24 -56 L-21 -59 L0 -46 L1 -64 L5 -64 L4 -46 L24 -58 L26 -55 L5 -38 C6 -24 4 -12 6 0Z" fill="${BARK_D}"/>
      ${c(-22, -62, 12, dk)}${c(22, -64, 12, dk)}${c(0, -76, 14, dk)}
      ${fl(-26, -58, 1.2)}${fl(-12, -66)}${fl(4, -80, 1.3)}${fl(18, -70, 1.1)}${fl(28, -58)}${fl(-6, -54, .9)}${fl(10, -92)}${fl(-18, -80, 1.1)}`,
      [[-20, -66], [20, -68], [0, -82]]];
  },
  lemon(col, dk, lt) {
    return [`<path d="M-4 0 L-3 -36 L-12 -48 L-9 -50 L0 -42 L9 -50 L12 -48 L3 -36 L4 0Z" fill="${BARK}"/>
      ${c(-18, -56, 16, dk)}${c(18, -56, 16, dk)}${c(0, -72, 19, dk)}${c(-12, -60, 13, col)}${c(12, -62, 13, col)}${c(0, -76, 14, col)}${c(-4, -82, 5, lt)}
      ${[[-22, -50], [-8, -60], [14, -52], [24, -60], [4, -72], [-16, -70], [10, -84]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="4.6" fill="#ffe066" stroke="#fab005" stroke-width=".8"/>`).join('')}`,
      [[-14, -60], [14, -62], [0, -76]]];
  },
  spruce(col, dk, lt) {
    const b = '#4c8fa8', bd = '#2f6f8a', bl = '#a5d8ff';
    const tier = (y, w) => `<path d="M${-w} ${y} L0 ${y - w * 1.1} L${w} ${y}Z" fill="${bd}"/><path d="M${-w * .8} ${y - 2} L0 ${y - w * 1.1} L${w * .1} ${y - 2}Z" fill="${b}"/>`;
    return [`<path d="M-4 0 L-3 -16 L3 -16 L4 0Z" fill="${BARK_D}"/>${tier(-14, 30)}${tier(-34, 25)}${tier(-52, 20)}${tier(-68, 15)}${tier(-82, 10)}
      ${[[-20, -18], [16, -22], [-12, -40], [10, -44], [-6, -60], [4, -74]].map(([x, y]) => c(x, y, 1.6, bl)).join('')}`,
      [[-14, -26], [12, -46], [0, -70]]];
  },
  banyan(col, dk, lt) {
    return [`<path d="M-12 0 C-10 -16 -12 -30 -8 -44 L8 -44 C12 -30 10 -16 12 0Z" fill="#8a6f5a"/>
      ${[-40, -30, -20, 20, 30, 40].map(x => `<path d="M${x} 0 L${x * .96} -52" stroke="#8a6f5a" stroke-width="2"/>`).join('')}
      <path d="M-50 -50 Q-50 -80 -20 -84 Q0 -100 20 -84 Q50 -80 50 -50 Q0 -42 -50 -50Z" fill="${dk}"/>
      ${c(-30, -64, 16, col)}${c(30, -64, 16, col)}${c(0, -80, 20, col)}${c(-12, -60, 14, col)}${c(14, -60, 14, col)}${c(-6, -88, 6, lt)}`,
      [[-30, -66], [30, -66], [0, -84]]];
  },
  blaze() {
    const cols = ['#c92a2a', '#e8590c', '#f76707', '#fd7e14', '#fab005'];
    return [`<path d="M-5 0 L-4 -40 L-14 -54 L-11 -56 L-1 -46 L0 -62 L4 -62 L3 -46 L12 -56 L15 -53 L5 -40 L5 0Z" fill="${BARK}"/>
      ${[[-24, -60, 16], [24, -60, 16], [0, -80, 20], [-14, -66, 14], [14, -68, 14], [0, -88, 15], [0, -62, 13]].map(([x, y, r], i) => c(x, y, r, cols[i % 5])).join('')}
      ${[[-30, -6], [-12, -2], [16, -4], [30, -8]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="1.6" fill="${cols[i]}"/>`).join('')}`,
      [[-18, -64], [18, -66], [0, -86]]];
  },
  glowshroom() {
    const cap = (x, y, w, h, col) => `<path d="M${x - w} ${y} Q${x - w} ${y - h} ${x} ${y - h} Q${x + w} ${y - h} ${x + w} ${y}Z" fill="${col}"/>`;
    return [`${c(0, -54, 40, 'rgba(99,230,190,.18)')}<path d="M-6 0 Q-4 -30 -5 -56 L5 -56 Q4 -30 6 0Z" fill="#e6fcf5"/>
      ${cap(0, -54, 34, 30, '#0ca678')}${cap(0, -58, 28, 24, '#20c997')}
      ${[[-16, -66], [8, -74], [18, -62], [-4, -62], [-22, -58]].map(([x, y]) => c(x, y, 3, '#c3fae8')).join('')}
      <path d="M-18 0 Q-17 -10 -18 -16 L-14 -16 Q-15 -10 -14 0Z" fill="#e6fcf5"/>${cap(-16, -15, 9, 9, '#38d9a9')}
      <path d="M16 0 Q17 -8 16 -12 L20 -12 Q19 -8 20 0Z" fill="#e6fcf5"/>${cap(18, -11, 7, 7, '#63e6be')}`,
      [[-16, -66], [16, -66], [0, -78]]];
  },
  phoenix() {
    const fe = (a, col, l) => `<path d="M0 -50 Q${Math.cos(a) * l * .5} ${-50 - Math.sin(a) * l * .7} ${Math.cos(a) * l} ${-50 - Math.sin(a) * l} Q${Math.cos(a) * l * .6} ${-46 - Math.sin(a) * l * .4} 0 -46Z" fill="${col}"/>`;
    return [`${c(0, -64, 40, 'rgba(255,169,77,.2)')}<path d="M-5 0 L-4 -48 L4 -48 L5 0Z" fill="#5c3a21"/>
      ${[[.35, '#ff6b00', 48], [.7, '#ff922b', 46], [1.05, '#ffa94d', 40], [1.4, '#ffd43b', 34]].map(([a, col, l]) => fe(a, col, l) + fe(Math.PI - a, col, l)).join('')}
      <path d="M-6 -50 Q0 -90 6 -50Z" fill="#ffd43b"/>${c(0, -86, 4, '#fff3bf')}`,
      [[-30, -66], [30, -66], [0, -84]]];
  },
  galaxy() {
    const cols = ['#5f3dc4', '#3b5bdb', '#862e9c', '#1c7ed6'];
    return [`${c(0, -72, 40, 'rgba(151,117,250,.2)')}<path d="M-5 0 L-4 -44 L-14 -58 L-11 -60 L-1 -50 L0 -66 L4 -66 L3 -50 L12 -60 L15 -57 L5 -44 L5 0Z" fill="#212529"/>
      ${[[-24, -62, 17], [24, -62, 17], [0, -82, 22], [-14, -68, 14], [16, -70, 14], [0, -64, 14]].map(([x, y, r], i) => c(x, y, r, cols[i % 4])).join('')}
      <ellipse cx="0" cy="-72" rx="40" ry="9" fill="none" stroke="#ffd8a8" stroke-width="2" transform="rotate(-14 0 -72)"/>
      ${[[-28, -76], [-10, -58], [18, -58], [28, -80], [-14, -94], [6, -96], [4, -70]].map(([x, y], i) => c(x, y, i % 2 ? 1.4 : 2, '#fff')).join('')}`,
      [[-18, -66], [18, -68], [0, -86]]];
  },
});
ITEMS.push(
  { id: 'sp_wattle', type: 'tree', name: 'Golden wattle', rarity: 'rare', species: 'wattle' },
  { id: 'sp_magnolia', type: 'tree', name: 'Magnolia', rarity: 'rare', species: 'magnolia' },
  { id: 'sp_lemon', type: 'tree', name: 'Lemon tree', rarity: 'rare', species: 'lemon' },
  { id: 'sp_spruce', type: 'tree', name: 'Blue spruce', rarity: 'rare', species: 'spruce' },
  { id: 'sp_banyan', type: 'tree', name: 'Banyan', rarity: 'epic', species: 'banyan' },
  { id: 'sp_blaze', type: 'tree', name: 'Autumn blaze', rarity: 'epic', species: 'blaze' },
  { id: 'sp_glowshroom', type: 'tree', name: 'Glowshroom', rarity: 'epic', species: 'glowshroom' },
  { id: 'sp_phoenix', type: 'tree', name: 'Phoenix tree', rarity: 'legendary', species: 'phoenix' },
  { id: 'sp_galaxy', type: 'tree', name: 'Galaxy tree', rarity: 'legendary', species: 'galaxy' },
);
BONUS_SPECIES.push(['wattle', 'Golden wattle', 'sp_wattle'], ['magnolia', 'Magnolia', 'sp_magnolia'], ['lemon', 'Lemon tree', 'sp_lemon'], ['spruce', 'Blue spruce', 'sp_spruce'],
  ['banyan', 'Banyan', 'sp_banyan'], ['blaze', 'Autumn blaze', 'sp_blaze'], ['glowshroom', 'Glowshroom', 'sp_glowshroom'], ['phoenix', 'Phoenix tree', 'sp_phoenix'], ['galaxy', 'Galaxy tree', 'sp_galaxy']);

// ---------- leaves ----------
const LEAF_STAGE = [4, 7, 11, 15, 19, 24, 30, 38];          // leaves per hour by tree stage, sapling to ancient
const LEAF_RARITY = { common: 1, rare: 1.5, epic: 2.5, legendary: 4 };
// prices went up in 2.19 and the bigger upgrades only unlock once your garden has enough trees
const LEAF_UPGRADES = [
  { id: 'sprinkler', icon: '💦', name: 'Sprinkler', desc: '+20% leaves from every tree per level', prices: [300, 750, 1600, 3200, 6000] },
  { id: 'basket', icon: '🧺', name: 'Bigger basket', desc: 'Holds 4 more hours of leaves per level (starts at 8 hours)', prices: [400, 1000, 2200] },
  { id: 'rain', icon: '🌧️', name: 'Rain barrel', desc: 'Watered trees keep their ×1.5 boost for 1 more day per level', prices: [1200, 3500], need: 10 },
  { id: 'compost', icon: '🪱', name: 'Compost heap', desc: 'Withered and wilted trees grow leaves at full speed', prices: [900] },
  { id: 'fert', icon: '🧪', name: 'Fertiliser', desc: 'Each study session of 25+ minutes gives 1 more hour of leaves straight away, per level', prices: [600, 1700] },
  { id: 'hive', icon: '🍯', name: 'Bee hive', desc: '+2 leaves per hour for every tree, per level', prices: [1300, 3000, 6500], need: 5 },
  { id: 'mulch', icon: '🍂', name: 'Mulch', desc: 'Saplings and young trees grow leaves as if they were one size bigger', prices: [2500], need: 15 },
  { id: 'greenhouse', icon: '🏡', name: 'Greenhouse', desc: 'Rare, epic and legendary trees grow 25% more leaves per level', prices: [2000, 4500, 9000], need: 20 },
  { id: 'gnome', icon: '🧙', name: 'Garden gnome', desc: 'Collects your leaves for you whenever you open the garden', prices: [4500], need: 10 },
  { id: 'silo', icon: '🏚️', name: 'Leaf silo', desc: 'The basket holds 8 more hours per level', prices: [5000, 12000], need: 30 },
  { id: 'shears', icon: '✂️', name: 'Golden shears', desc: '+10% leaves from every tree per level', prices: [6000, 9000, 13000, 18000, 25000], need: 50 },
  { id: 'stream', icon: '🏞️', name: 'Garden stream', desc: 'Every tree counts as watered, all the time', prices: [20000], need: 75 },
];
const gardenTrees = () => D.focusLogs.filter(l => l.mins >= 10 && !l.withered).length;
function leafState() { D.game.leaves = D.game.leaves || { bank: 150, last: Date.now(), spent: 0, ups: {} }; D.game.leaves.ups = D.game.leaves.ups || {}; return D.game.leaves; }
const lupg = id => (leafState().ups[id] || []).length;
const leaves = () => Math.max(0, Math.floor(leafState().bank - (leafState().spent || 0)));
function treeLeafRate(l) {
  const sp = speciesFor(l.subjectId), r = treeRec(l.id);
  const st = treeStageOf(l), rar = speciesRarity(sp);
  let v = (LEAF_STAGE[lupg('mulch') && st < 2 ? st + 1 : st] + 2 * lupg('hive') + (st >= 3 ? 3 * lupg('trellis') : 0)) * LEAF_RARITY[rar];
  const d = (new Date(today()) - new Date(r.lastWater || '2000-01-01')) / 864e5;
  if (d <= 1 + lupg('rain') || lupg('stream') || visiting('snail')) v *= 1.5;      // watered recently
  if (rar !== 'common') v *= 1 + .25 * lupg('greenhouse');
  v *= 1 + .1 * lupg('shears');
  v *= (treeSpeciesBuff(l).leaf || 1) * (1 + activeBuff('leafAll') + (crit('ladybug') ? .05 : 0) + (visiting('hummingbird') ? .2 : 0));
  if (!lupg('compost')) v *= l.withered ? .25 : r.wilted ? .5 : 1;
  return v * (1 + .2 * lupg('sprinkler'));
}
const leafRate = () => D.focusLogs.filter(l => l.mins >= 10).reduce((a, l) => a + treeLeafRate(l), 0);
const basketHours = () => 8 + 4 * lupg('basket') + 8 * lupg('silo') + activeBuff('basket');
const basketCap = () => Math.round(leafRate() * basketHours());
function pendingLeaves() {
  const L = leafState(), h = Math.max(0, (Date.now() - L.last) / 36e5);
  return Math.floor(Math.min(basketCap(), leafRate() * h + (L.carry || 0)));
}
function collectLeaves(fromEl) {
  const L = leafState(), n = pendingLeaves();
  L.bank += n; L.last = Date.now(); L.carry = 0; save();
  if (n > 0) leafBurst(fromEl, n);
  return n;
}
// study sessions give a burst of fresh leaves into the basket
function leafSessionBonus(l) {
  if (!l || l.mins < 10) return;
  const L = leafState(), hrs = 1 + (l.mins >= 25 ? lupg('fert') : 0);
  L.carry = (L.carry || 0) + Math.round(leafRate() * hrs); save();
}
function leafBurst(fromEl, n) {
  const r = (fromEl || document.querySelector('.leafbar'))?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const box = document.createElement('div'); box.className = 'leafburst';
  box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height / 2) + 'px';
  box.innerHTML = Array.from({ length: Math.min(24, 6 + Math.floor(n / 20)) }, () => `<i style="--x:${Math.round((Math.random() - .5) * 260)}px;--y:${Math.round(-60 - Math.random() * 160)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--d:${(.9 + Math.random() * .7).toFixed(2)}s">${LEAF}</i>`).join('') + `<b>+${n} ${LEAF}</b>`;
  document.body.appendChild(box); setTimeout(() => box.remove(), 1800);
}
function buyLeafUpgrade(id) {
  const u = LEAF_UPGRADES.find(x => x.id === id); if (!u) return;
  const lvl = lupg(id), p = u.prices[lvl]; if (p == null || leaves() < p || gardenTrees() < (u.need || 0)) return;
  const L = leafState(); collectLeaves(); L.spent += p; L.ups[id] = [...(L.ups[id] || []), new Date().toISOString()]; ui.justBought = id; save(); render();
  toast(`${u.icon} ${u.name}${u.prices.length > 1 ? ` level ${lvl + 1}` : ''}`, u.desc);
}
const spendLeaves = p => { if (leaves() < p) return false; leafState().spent += p; return true; };
const fmtLeaf = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 10000 ? (n / 1000).toFixed(n >= 1e5 ? 0 : 1) + 'k' : String(Math.round(n));

function leafBar() {
  const p = pendingLeaves(), cap = basketCap(), rate = leafRate(), pct = cap ? Math.min(100, Math.round(p / cap * 100)) : 0;
  const full = cap && p >= cap;
  return `<div class="card leafbar ${full ? 'full' : ''}"><div class="leafbig">${LEAF}</div>
    <div class="main"><div class="leafnums"><b>${fmtLeaf(leaves())}</b> leaves <span class="muted small-text">· growing ${fmtLeaf(rate)} per hour from ${D.focusLogs.filter(l => l.mins >= 10).length} trees</span></div>
      <div class="basket"><i style="width:${pct}%"></i></div><span class="muted small-text">🧺 ${fmtLeaf(p)} / ${fmtLeaf(cap)} in the basket${full ? ' · full, collect them so your trees keep growing leaves' : ` · full in ${fmtMins(Math.ceil((cap - p) / Math.max(rate, .01) * 60))}`}</span></div>
    <button class="btn ${p > 0 ? 'primary' : ''}" data-act="collectLeaves" ${p > 0 ? '' : 'disabled'}>Collect ${p > 0 ? `+${fmtLeaf(p)}` : ''}</button></div>`;
}
function leafShopView() {
  const have = leaves();
  return `<div class="card"><div class="card-head"><h2>${LEAF} Garden upgrades</h2><span class="muted small-text">paid with leaves your trees grow</span><span class="coins">${LEAF} <b>${fmtLeaf(have)}</b></span></div>
    <div class="upgs">${LEAF_UPGRADES.map((u, i) => {
      const lvl = lupg(u.id), max = lvl >= u.prices.length, n = gardenTrees(), locked = !max && n < (u.need || 0);
      return upgTile(u, lvl, have, LEAF, 'buyLeafUpg', i, locked ? `<div class="upg-lock"><div class="meter"><i style="width:${Math.round(n / u.need * 100)}%"></i></div><span>Grow ${u.need} trees · ${n} so far</span></div>` : '');
    }).join('')}</div>
    <details class="howgrow"><summary class="muted small-text">How leaves work</summary><p class="muted small-text">Every tree grows leaves each hour, even when the app is closed: from ${LEAF_STAGE[0]} for a sapling up to ${LEAF_STAGE[7]} for an ancient tree. Rare trees grow ×1.5, epic ×2.5 and legendary ×4 (change a subject's tree to upgrade all of its trees). Watered trees grow ×1.5 for a day. Every study session drops an hour of leaves into the basket. The basket holds ${basketHours()} hours, so collect often.</p></details></div>`;
}
function gnomeCollect() {
  if (lupg('gnome') && view === 'forest' && pendingLeaves() >= Math.max(1, basketCap() * .05)) collectLeaves(document.querySelector('.leafbar'));
}
// keep the basket ticking while the garden is open
setInterval(() => { const el = document.querySelector('.leafbar'); if (el && D && D.game && !document.hidden) el.outerHTML = leafBar(); }, 30000);
