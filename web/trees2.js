'use strict';
/* 2.22 trees: twelve new species, and a buff of its own for every rare, epic
   and legendary tree. A buff works while one of your subjects grows that
   tree. Buffs on coins and XP count for sessions grown as that tree from
   2.22 on, so a new tree never pays out again on old sessions. */

const BUFF_START = '2026-10-26';

// ---------- new species, drawn like the others: base at (0,0), about 100 tall ----------
Object.assign(SPECIES_DRAW, {
  wisteria() {
    const p = '#b197fc', pd = '#845ef7', pl = '#e5dbff';
    const drop = (x, y, n) => Array.from({ length: n }, (_, i) => c(x + Math.sin(i * 1.3) * 1.2, y + i * 4.2, 3.4 - i * .35, i % 2 ? p : pl)).join('');
    return [`<path d="M-5 0 C-8 -18 2 -30 -3 -46 C-8 -54 -18 -58 -24 -66 L-21 -68 C-14 -62 -6 -58 -1 -54 L1 -70 L5 -70 L4 -52 C12 -58 18 -62 24 -70 L27 -67 C20 -58 10 -50 5 -44 C3 -30 7 -16 6 0Z" fill="${BARK_D}"/>
      <ellipse cx="0" cy="-74" rx="40" ry="14" fill="#5c940d"/><ellipse cx="-4" cy="-78" rx="32" ry="10" fill="#74b816"/>
      ${drop(-30, -66, 7)}${drop(-18, -64, 9)}${drop(-6, -66, 8)}${drop(6, -64, 9)}${drop(18, -66, 8)}${drop(30, -64, 6)}${drop(-24, -72, 5)}${drop(24, -72, 5)}
      ${c(-12, -82, 3, pd)}${c(10, -84, 3, pd)}`,
      [[-18, -40], [6, -38], [24, -44], [-30, -46]]];
  },
  olive(col, dk, lt) {
    const g = '#8a9a5b', gd = '#6b7b3f', gl = '#c0cc8f';
    return [`<path d="M-7 0 C-4 -10 -10 -20 -4 -30 C2 -38 -6 -44 -2 -52 L4 -52 C2 -44 9 -38 5 -30 C2 -22 8 -10 7 0Z" fill="#8d7b68"/>
      <path d="M-2 -46 L-18 -58 M3 -48 L18 -60" stroke="#8d7b68" stroke-width="4" stroke-linecap="round"/>
      ${c(-20, -62, 15, gd)}${c(20, -64, 15, gd)}${c(0, -76, 18, gd)}${c(-14, -66, 12, g)}${c(14, -68, 12, g)}${c(0, -80, 13, g)}${c(-6, -84, 5, gl)}
      ${[[-22, -58], [-10, -70], [16, -62], [24, -70], [4, -74], [-4, -60]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="2.8" fill="#364016"/>`).join('')}`,
      [[-16, -64], [16, -66], [0, -80]]];
  },
  aspen() {
    const y = '#fcc419', yd = '#f08c00', yl = '#fff3bf';
    return [`<rect x="-4" y="-80" width="8" height="80" rx="3" fill="#f8f9fa"/>${[-14, -30, -48, -62].map((yy, i) => `<ellipse cx="${i % 2 ? 2 : -1}" cy="${yy}" rx="2.6" ry="1.4" fill="#343a40"/>`).join('')}
      <ellipse cx="0" cy="-80" rx="24" ry="30" fill="${yd}"/>${c(-12, -84, 12, y)}${c(10, -88, 12, y)}${c(0, -100, 11, y)}${c(-4, -70, 11, y)}${c(12, -72, 9, y)}
      ${[[-16, -94], [6, -104], [16, -82], [-14, -74], [2, -86]].map(([x, yy]) => c(x, yy, 3, yl)).join('')}
      ${[[-20, -4], [-8, -2], [12, -3], [24, -5]].map(([x, yy]) => `<ellipse cx="${x}" cy="${yy}" rx="3" ry="1.3" fill="${y}"/>`).join('')}`,
      [[-12, -80], [10, -90], [0, -100]]];
  },
  fig(col, dk, lt) {
    const leaf = (x, y, r, f, a) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 ${-r} C${r * .5} ${-r * .8} ${r * .9} ${-r * .3} ${r * .6} 0 C${r} ${r * .3} ${r * .4} ${r * .8} 0 ${r} C${-r * .4} ${r * .8} ${-r} ${r * .3} ${-r * .6} 0 C${-r * .9} ${-r * .3} ${-r * .5} ${-r * .8} 0 ${-r}Z" fill="${f}"/>`;
    return [`<path d="M-6 0 C-5 -16 -8 -30 -3 -42 L-14 -56 L-11 -58 L0 -48 L1 -62 L5 -62 L4 -46 L14 -56 L17 -53 L5 -40 C7 -26 5 -12 6 0Z" fill="#a1887f"/>
      ${leaf(-22, -60, 14, dk, -20)}${leaf(20, -62, 14, dk, 25)}${leaf(0, -80, 16, dk, 0)}${leaf(-10, -70, 12, col, -10)}${leaf(12, -70, 12, col, 15)}${leaf(-2, -88, 9, lt, 5)}
      ${[[-16, -54], [14, -56], [4, -66], [-6, -76], [22, -72]].map(([x, y]) => `${c(x, y, 3.6, '#7048e8')}${c(x - .8, y - 1, 1, '#d0bfff')}`).join('')}`,
      [[-16, -62], [16, -64], [0, -82]]];
  },
  holly(col, dk, lt) {
    const h = '#2b8a3e', hd = '#1e6b2f';
    const tier = (y, w, hh) => `<path d="M${-w} ${y} L${-w * .7} ${y - hh * .3} L${-w * .85} ${y - hh * .45} L${-w * .45} ${y - hh * .65} L${-w * .5} ${y - hh * .8} L0 ${y - hh} L${w * .5} ${y - hh * .8} L${w * .45} ${y - hh * .65} L${w * .85} ${y - hh * .45} L${w * .7} ${y - hh * .3} L${w} ${y}Z" fill="${hd}"/><path d="M${-w * .8} ${y - 2} L0 ${y - hh} L${-w * .1} ${y - 2}Z" fill="${h}"/>`;
    return [`<rect x="-4" y="-16" width="8" height="16" rx="2" fill="${BARK_D}"/>${tier(-12, 30, 38)}${tier(-38, 24, 34)}${tier(-62, 17, 32)}
      ${[[-16, -22], [-12, -20], [14, -26], [18, -24], [-8, -48], [10, -50], [0, -70], [4, -72], [-20, -16], [22, -18]].map(([x, y]) => c(x, y, 2.6, '#e03131')).join('')}`,
      [[-14, -24], [12, -48], [0, -72]]];
  },
  cedar(col, dk, lt) {
    const shelf = (y, w) => `<ellipse cx="0" cy="${y}" rx="${w}" ry="6" fill="${dk}"/><ellipse cx="-3" cy="${y - 3}" rx="${w * .85}" ry="4.5" fill="${col}"/><ellipse cx="-6" cy="${y - 5}" rx="${w * .35}" ry="2" fill="${lt}"/>`;
    return [`<path d="M-7 0 L-4 -98 L4 -98 L7 0Z" fill="#8a5a3b"/>${[-26, -44, -60, -74, -86].map((y, i) => `<path d="M0 ${y} L${i % 2 ? 26 - i * 3 : -26 + i * 3} ${y - 4}" stroke="#8a5a3b" stroke-width="3"/>`).join('')}
      ${shelf(-28, 42)}${shelf(-46, 36)}${shelf(-62, 30)}${shelf(-76, 22)}${shelf(-88, 14)}${shelf(-98, 8)}`,
      [[-30, -30], [28, -48], [-20, -64], [10, -88]]];
  },
  mangrove(col, dk, lt) {
    const root = (x) => `<path d="M${x * .2} -26 Q${x * .7} -18 ${x} 0" stroke="#6d4c41" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return [`<ellipse cx="0" cy="0" rx="40" ry="5" fill="#4dabf7" opacity=".55"/>${[-34, -22, -10, 10, 22, 34].map(root).join('')}
      <path d="M-5 -24 C-4 -40 -6 -50 -2 -58 L4 -58 C6 -48 4 -38 5 -24Z" fill="#6d4c41"/>
      ${c(-24, -64, 17, dk)}${c(24, -64, 17, dk)}${c(0, -80, 21, dk)}${c(-16, -68, 14, col)}${c(16, -70, 14, col)}${c(0, -84, 16, col)}${c(-6, -90, 6, lt)}`,
      [[-20, -66], [20, -68], [0, -86]]];
  },
  lantern(col, dk, lt) {
    const lamp = (x, y) => `<path d="M${x} ${y - 9} v4" stroke="#495057" stroke-width="1"/><rect x="${x - 3.5}" y="${y - 5}" width="7" height="9" rx="3" fill="#ff922b"/><rect x="${x - 2}" y="${y - 3}" width="4" height="5" rx="2" fill="#fff3bf"/>${c(x, y, 9, 'rgba(255,212,59,.18)')}`;
    return [`<path d="M-6 0 L-4 -42 L-14 -58 L-11 -60 L-2 -48 L-1 -64 L3 -64 L3 -48 L12 -60 L15 -57 L5 -42 L6 0 Z" fill="#5c3d2e"/>
      ${c(-24, -60, 18, '#2b3a55')}${c(24, -60, 18, '#2b3a55')}${c(0, -80, 23, '#2b3a55')}${c(-16, -66, 15, '#364fc7')}${c(16, -66, 15, '#364fc7')}${c(0, -84, 18, '#364fc7')}
      ${lamp(-26, -42)}${lamp(26, -44)}${lamp(-10, -54)}${lamp(12, -58)}${lamp(0, -66)}`,
      [[-20, -66], [20, -68], [0, -88]]];
  },
  coral() {
    const br = (x1, y1, x2, y2, w) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (x2 > x1 ? -6 : 6)} ${(y1 + y2) / 2} ${x2} ${y2}" stroke="#ff8787" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    return [`${br(0, 0, 0, -40, 9)}${br(0, -36, -26, -66, 6)}${br(0, -36, 24, -70, 6)}${br(0, -40, 4, -92, 6)}${br(-24, -62, -38, -80, 4)}${br(-22, -62, -12, -86, 4)}${br(22, -66, 36, -86, 4)}${br(22, -66, 14, -94, 4)}${br(4, -88, -6, -108, 3)}${br(4, -88, 16, -106, 3)}
      ${[[-38, -80], [-12, -86], [36, -86], [14, -94], [-6, -108], [16, -106]].map(([x, y]) => `${c(x, y, 5, '#ffc9c9')}${c(x, y, 2.4, '#fff5f5')}`).join('')}`,
      [[-30, -74], [28, -78], [4, -96]]];
  },
  worldtree() {
    const g = '#2f9e44', gd = '#1b6e30', gl = '#8ce99a';
    return [`${c(0, -72, 46, 'rgba(140,233,154,.15)')}
      <path d="M-16 0 C-12 -10 -14 -26 -8 -40 C-14 -50 -30 -56 -38 -66 L-34 -70 C-24 -62 -12 -56 -4 -52 L-2 -78 L4 -78 L5 -52 C14 -58 26 -64 34 -72 L38 -68 C30 -58 16 -50 9 -40 C14 -26 12 -10 16 0Z" fill="#7a5230"/>
      <path d="M-16 0 Q-26 4 -34 2 M16 0 Q26 4 34 2 M-6 0 Q-10 6 -18 6 M6 0 Q10 6 18 6" stroke="#7a5230" stroke-width="3" stroke-linecap="round" fill="none"/>
      ${c(-36, -70, 16, gd)}${c(36, -72, 16, gd)}${c(-18, -88, 20, gd)}${c(18, -90, 20, gd)}${c(0, -104, 20, gd)}
      ${c(-30, -74, 12, g)}${c(30, -76, 12, g)}${c(-14, -92, 15, g)}${c(16, -94, 15, g)}${c(0, -108, 14, g)}${c(0, -84, 14, g)}
      ${[[-34, -80], [-8, -100], [22, -100], [34, -84], [2, -116], [-20, -84]].map(([x, y]) => c(x, y, 2.6, gl)).join('')}
      <circle cx="0" cy="-64" r="5" fill="#ffe066"/><circle cx="0" cy="-64" r="9" fill="rgba(255,224,102,.3)"/>`,
      [[-30, -76], [30, -78], [0, -108]]];
  },
  aurora() {
    const cols = ['#63e6be', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];
    return [`${c(0, -72, 42, 'rgba(99,230,190,.16)')}<path d="M-5 0 L-4 -44 L-14 -58 L-11 -60 L-1 -50 L0 -66 L4 -66 L3 -50 L12 -60 L15 -57 L5 -44 L5 0Z" fill="#212529"/>
      ${[[-24, -62, 17], [24, -62, 17], [0, -82, 22], [-14, -70, 14], [16, -72, 14], [0, -64, 14]].map(([x, y, r], i) => c(x, y, r, cols[i % 5])).join('')}
      ${[0, 1, 2].map(i => `<path d="M${-38 + i * 4} ${-90 + i * 10} Q0 ${-112 + i * 10} ${38 - i * 4} ${-90 + i * 10}" stroke="${cols[i + 1]}" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`).join('')}
      ${[[-26, -78], [-8, -56], [20, -58], [28, -82], [6, -96]].map(([x, y]) => c(x, y, 1.6, '#fff')).join('')}`,
      [[-18, -66], [18, -68], [0, -86]]];
  },
  storm() {
    return [`${c(0, -74, 40, 'rgba(116,192,252,.15)')}<path d="M-6 0 L-4 -42 L-14 -58 L-11 -60 L-2 -48 L-1 -64 L3 -64 L3 -48 L12 -60 L15 -57 L5 -42 L6 0 Z" fill="#343a40"/>
      ${c(-24, -62, 17, '#495057')}${c(24, -62, 17, '#495057')}${c(0, -82, 23, '#495057')}${c(-16, -68, 15, '#5c677d')}${c(16, -70, 15, '#5c677d')}${c(0, -86, 18, '#6c7a93')}${c(-6, -92, 7, '#adb5bd')}
      <path d="M-6 -66 L2 -78 L-2 -78 L6 -92 L-6 -76 L-1 -76 Z" fill="#ffe066"/><path d="M18 -54 L22 -62 L19 -62 L24 -70" stroke="#ffe066" stroke-width="2" fill="none"/>
      ${[[-28, -40], [-18, -30], [-6, -36], [8, -28], [20, -38], [30, -30]].map(([x, y]) => `<path d="M${x} ${y} l-2 6" stroke="#74c0fc" stroke-width="1.6" stroke-linecap="round"/>`).join('')}`,
      [[-18, -66], [18, -68], [0, -86]]];
  },
});
ITEMS.push(
  { id: 'sp_wisteria', type: 'tree', name: 'Wisteria', rarity: 'rare', species: 'wisteria' },
  { id: 'sp_olive', type: 'tree', name: 'Olive tree', rarity: 'rare', species: 'olive' },
  { id: 'sp_aspen', type: 'tree', name: 'Golden aspen', rarity: 'rare', species: 'aspen' },
  { id: 'sp_fig', type: 'tree', name: 'Fig tree', rarity: 'rare', species: 'fig' },
  { id: 'sp_holly', type: 'tree', name: 'Holly', rarity: 'rare', species: 'holly' },
  { id: 'sp_cedar', type: 'tree', name: 'Cedar of Lebanon', rarity: 'epic', species: 'cedar' },
  { id: 'sp_mangrove', type: 'tree', name: 'Mangrove', rarity: 'epic', species: 'mangrove' },
  { id: 'sp_lantern', type: 'tree', name: 'Lantern tree', rarity: 'epic', species: 'lantern' },
  { id: 'sp_coral', type: 'tree', name: 'Coral tree', rarity: 'epic', species: 'coral' },
  { id: 'sp_worldtree', type: 'tree', name: 'World tree', rarity: 'legendary', species: 'worldtree' },
  { id: 'sp_aurora', type: 'tree', name: 'Aurora tree', rarity: 'legendary', species: 'aurora' },
  { id: 'sp_storm', type: 'tree', name: 'Storm tree', rarity: 'legendary', species: 'storm' },
);
BONUS_SPECIES.push(['wisteria', 'Wisteria', 'sp_wisteria'], ['olive', 'Olive tree', 'sp_olive'], ['aspen', 'Golden aspen', 'sp_aspen'], ['fig', 'Fig tree', 'sp_fig'], ['holly', 'Holly', 'sp_holly'],
  ['cedar', 'Cedar of Lebanon', 'sp_cedar'], ['mangrove', 'Mangrove', 'sp_mangrove'], ['lantern', 'Lantern tree', 'sp_lantern'], ['coral', 'Coral tree', 'sp_coral'],
  ['worldtree', 'World tree', 'sp_worldtree'], ['aurora', 'Aurora tree', 'sp_aurora'], ['storm', 'Storm tree', 'sp_storm']);

// ---------- a buff for every special tree ----------
// leaf: ×this tree's leaves · leafAll: +% everyone's leaves · grow: ×this tree's growth · growAll: +% everyone's growth
// coin / xp: +% for sessions grown as this tree · night / morning: +% coins for sessions after 7pm / before noon
// nightXp: +% XP after 7pm · long: +coins for sessions of `longMins`+ · water: × watering coins · waterLeaf: watering drops leaves
// basket: +hours · luck: +% box odds · gift: +% daily gift · challenge: +% challenge rewards · visit: +% visitor chance
// visitDays: visitors stay longer · dupe: +% duplicate refunds · battle: +% Arena stats
const SPECIES_BUFFS = {
  cactus: { text: '+5% Defence in the Arena', battle: { def: .05 } },
  mushroom: { text: 'Its trees grow 25% faster', grow: 1.25 },
  baobab: { text: 'The basket holds 4 more hours', basket: 4 },
  crystal: { text: 'Watering pays double coins', water: 2 },
  rainbow: { text: '+3% better lucky box odds', luck: 3 },
  candy: { text: '+25% coins from the daily gift', gift: .25 },
  golden: { text: '+10% coins from its sessions', coin: .1 },
  jacaranda: { text: '+10% coins from challenges', challenge: .1 },
  ghostgum: { text: '+5% Speed in the Arena', battle: { spd: .05 } },
  bottlebrush: { text: 'Visiting critters come 25% more often', visit: .25 },
  redwood: { text: 'Its trees grow 40% faster', grow: 1.4 },
  dragon: { text: '+6% Attack in the Arena', battle: { atk: .06 } },
  frost: { text: '+15% coins for its sessions after 7pm', night: .15 },
  ember: { text: '+8% Skill in the Arena', battle: { spc: .08 } },
  moon: { text: '+12% XP from its sessions', xp: .12 },
  wattle: { text: '+15% coins for its sessions before midday', morning: .15 },
  magnolia: { text: '+5% leaves from every tree', leafAll: .05 },
  lemon: { text: 'Its trees grow 30% more leaves', leaf: 1.3 },
  spruce: { text: '+6% HP in the Arena', battle: { hp: .06 } },
  banyan: { text: 'Every tree grows 10% faster', growAll: .1 },
  blaze: { text: '+15 coins for its sessions of 60+ minutes', long: 15, longMins: 60 },
  glowshroom: { text: 'Duplicates from boxes refund 50% more', dupe: .5 },
  phoenix: { text: '+5% to every Arena stat', battle: { hp: .05, atk: .05, def: .05, spc: .05, spd: .05 } },
  galaxy: { text: '+15% XP and +2% better box odds', xp: .15, luck: 2 },
  wisteria: { text: 'Watering one of its trees drops an hour of its leaves in the basket', waterLeaf: 1 },
  olive: { text: '+8% Defence in the Arena', battle: { def: .08 } },
  aspen: { text: '+6% XP and +4% coins from its sessions', xp: .06, coin: .04 },
  fig: { text: '+8 coins for its sessions of 45+ minutes', long: 8, longMins: 45 },
  holly: { text: 'Visiting critters stay a day longer', visitDays: 1 },
  cedar: { text: 'Every tree grows 15% faster', growAll: .15 },
  mangrove: { text: 'The basket holds 8 more hours', basket: 8 },
  lantern: { text: '+20% XP for its sessions after 7pm', nightXp: .2 },
  coral: { text: '+4% HP and Attack in the Arena', battle: { hp: .04, atk: .04 } },
  worldtree: { text: '+12% leaves and 10% faster growth for every tree', leafAll: .12, growAll: .1 },
  aurora: { text: '+20% XP from its sessions', xp: .2 },
  storm: { text: '+10% Attack and +5% Speed in the Arena', battle: { atk: .1, spd: .05 } },
};
const speciesBuffText = k => (SPECIES_BUFFS[k] || {}).text || '';
// species your subjects grow right now
const activeSpecies = () => [...new Set(Object.values(speciesMap()))];
// the buff of the tree this planted tree is now (it follows the subject's tree type)
const treeSpeciesBuff = l => SPECIES_BUFFS[speciesFor(l.subjectId)] || {};
// buffs of a session's own tree, from 2.22 on (coins and XP)
const sessionBuff = l => (l && String(l.date) >= BUFF_START && SPECIES_BUFFS[l.species]) || {};
// sum of one number across every tree type your subjects grow
const activeBuff = key => activeSpecies().reduce((a, k) => a + (+(SPECIES_BUFFS[k] || {})[key] || 0), 0);
const activeBattleBuff = stat => activeSpecies().reduce((a, k) => a + (((SPECIES_BUFFS[k] || {}).battle || {})[stat] || 0), 0);
function sessionCoinBuff(l) {
  const b = sessionBuff(l); if (!b.text) return 0;
  const h = new Date(l.start).getHours();
  return (b.coin || 0) + (h >= 19 ? b.night || 0 : 0) + (h < 12 ? b.morning || 0 : 0);
}
function sessionXpBuff(l) {
  const b = sessionBuff(l); if (!b.text) return 0;
  return (b.xp || 0) + (new Date(l.start).getHours() >= 19 ? b.nightXp || 0 : 0);
}
const sessionFlatBuff = l => { const b = sessionBuff(l); return b.long && l.mins >= b.longMins ? b.long : 0; };

// ---------- 3D models for the new trees (see g3models.js for the helpers) ----------
if (typeof T3 !== 'undefined') Object.assign(T3, {
  wisteria(c, r) {
    const parts = [cyl(.08, .14, 1.4, BARK3D, 0, 0, 0), limb(.05, .07, .6, BARK3D, 0, 1.2, 0, .8, .1), limb(.05, .07, .6, BARK3D, 0, 1.2, 0, -.8, -.1),
      ball(.95, '#74b816', 0, 1.75, 0, 1.2, .3, 1.2), ball(.75, '#5c940d', 0, 1.85, 0, 1.1, .28, 1.1)];
    const fruit = [];
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + r() * .3, rad = .4 + r() * .6, x = Math.cos(a) * rad, z = Math.sin(a) * rad, len = 3 + Math.floor(r() * 3);
      for (let k = 0; k < len; k++) parts.push(ball(.075 - k * .008, k % 2 ? '#b197fc' : '#d0bfff', x, 1.62 - k * .11, z, 1, 1.2, 1, { detail: 0 }));
      if (i % 4 === 0) fruit.push([x, 1.7, z]);
    }
    return { parts, fruit };
  },
  olive(c, r) {
    const parts = [];
    for (const [ax, az] of [[.15, .1], [-.2, -.05]]) parts.push(limb(.07, .1, 1.1, '#8d7b68', 0, 0, 0, ax, az, 7));
    const pts = [[0, 1.45, 0, .5], ...ringPts(5, .45, 1.2, .38, r)];
    parts.push(...canopy('#8a9a5b', pts, r, 1), ...pts.slice(1).map(([x, y, z]) => ball(.05, '#364016', x * 1.2, y - .1, z * 1.2, 1, 1.3, 1, { detail: 0 })));
    return { parts, fruit: pts };
  },
  aspen(c, r) {
    const parts = [cyl(.07, .1, 2, '#f8f9fa', 0, 0, 0)];
    for (let i = 0; i < 5; i++) parts.push(box(.08, .03, .16, '#343a40', 0, .3 + i * .32, 0));
    const pts = [[0, 2.2, 0, .45], ...ringPts(5, .35, 1.9, .36, r), ...ringPts(3, .25, 2.45, .3, r)];
    parts.push(...canopy('#fcc419', pts, r, 1, { rough: .6 }));
    parts.push(...Array.from({ length: 8 }, () => ball(.05, '#fab005', (r() - .5) * 1.6, .02, (r() - .5) * 1.6, 1, .2, 1, { detail: 0 })));
    return { parts, fruit: pts };
  },
  fig(c, r) {
    const t = blobTree(c, r, 1);
    t.parts[0].material = m3mat('#a1887f');
    t.parts.push(...t.fruit.slice(1, 9).map(([x, y, z]) => ball(.075, '#7048e8', x * 1.2, y - .15, z * 1.2, 1, 1.2, 1, { detail: 1 })));
    return t;
  },
  holly(c) {
    const parts = [cyl(.08, .11, .4, BARK3D, 0, 0, 0)];
    [[.8, .3], [.65, .85], [.48, 1.35], [.3, 1.8]].forEach(([rr, y], i) => parts.push(cone(rr, .8, i % 2 ? '#2b8a3e' : '#1e6b2f', 0, y, 0, 7, { flat: true })));
    const fruit = [];
    for (let i = 0; i < 14; i++) { const y = .45 + (i / 14) * 1.5, rr = .72 - (y - .3) * .4, a = i * 2.4; fruit.push([Math.cos(a) * rr, y, Math.sin(a) * rr]); parts.push(ball(.05, '#e03131', Math.cos(a) * rr, y, Math.sin(a) * rr, 1, 1, 1, { detail: 0, rough: .3 })); }
    return { parts, fruit };
  },
  cedar(c) {
    const parts = [cyl(.12, .2, 2.5, '#8a5a3b', 0, 0, 0, 8)];
    [[1.05, .7], [.9, 1.15], [.75, 1.55], [.55, 1.9], [.35, 2.2], [.2, 2.45]].forEach(([rr, y], i) => parts.push(at(m3mesh(CylG(rr, rr * 1.08, .14, 14), i % 2 ? c : shade(c, -.2)), (i % 2 ? .08 : -.08), y, 0)));
    return { parts, fruit: [[.8, .8, 0], [-.6, 1.25, .3], [.4, 1.65, -.3], [0, 2.5, 0]] };
  },
  mangrove(c, r) {
    const parts = [at(m3mesh(CylG(.95, .95, .03, 24), '#4dabf7', { op: .6, rough: .1, cast: false }), 0, .02, 0), cyl(.08, .11, 1.2, '#6d4c41', 0, .45, 0)];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, root = limb(.03, .045, .7, '#6d4c41', Math.cos(a) * .05, .55, Math.sin(a) * .05, 0, 0, 5); root.rotation.set(0, -a, 0); root.children[0].rotation.z = 2.4; parts.push(root); }
    const pts = [[0, 1.85, 0, .55], ...ringPts(6, .55, 1.55, .42, r)];
    parts.push(...canopy(c, pts, r, 1));
    return { parts, fruit: pts };
  },
  lantern(c, r) {
    const t = blobTree('#364fc7', r, 1.05, { rough: .7 }); t.parts[0].material = m3mat('#5c3d2e');
    const lamps = t.fruit.slice(1, 7).map(([x, y, z]) => { const lp = grp(cyl(.006, .006, .14, '#495057', 0, -.14, 0, 4), at(m3mesh(SphG(.075, 10, 8), '#ff922b', { emi: '#ff922b', ei: 1 }), 0, -.2, 0)); lp.position.set(x * 1.15, y - .25, z * 1.15); return lp; });
    t.parts.push(...lamps);
    return { ...t, glow: '#ffa94d', tick: tt => lamps.forEach((lp, i) => { lp.rotation.z = Math.sin(tt * 1.5 + i) * .12; }) };
  },
  coral() {
    const parts = [], fruit = [];
    const branch = (x, y, z, ax, az, len, rad, depth) => {
      parts.push(limb(rad * .7, rad, len, '#ff8787', x, y, z, ax, az, 6));
      const [tx, ty, tz] = tipOf(len, x, y, z, ax, az);
      if (depth === 0) { parts.push(ball(.09, '#ffc9c9', tx, ty, tz, 1, 1, 1, { emi: '#ffa8a8', ei: .2 })); fruit.push([tx, ty, tz]); return; }
      branch(tx, ty, tz, ax + .45, az + .1, len * .7, rad * .7, depth - 1); branch(tx, ty, tz, ax - .45, az - .15, len * .7, rad * .7, depth - 1);
    };
    branch(0, 0, 0, 0, 0, .9, .1, 0); parts.pop(); fruit.pop();
    branch(0, .85, 0, .35, .2, .6, .07, 2); branch(0, .85, 0, -.4, -.2, .6, .07, 2);
    return { parts, fruit };
  },
  worldtree(c, r) {
    const parts = [cyl(.22, .4, 1.6, '#7a5230', 0, 0, 0, 10)];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, root = limb(.13, .03, .75, '#7a5230', Math.cos(a) * .2, .08, Math.sin(a) * .2, 0, 0, 6); root.rotation.set(0, -a, 0); root.children[0].rotation.z = -1.38; parts.push(root); }
    const fruit = [];
    for (const [ax, az] of [[.7, .1], [-.7, -.1], [.1, .7], [-.1, -.7], [0, 0]]) {
      parts.push(limb(.07, .12, .9, '#7a5230', 0, 1.5, 0, ax, az, 7)); const [x, y, z] = tipOf(.9, 0, 1.5, 0, ax, az);
      parts.push(...canopy('#2f9e44', [[x, y + .2, z, .55], [x + .25, y, z, .4], [x - .2, y + .05, z + .2, .38]], r, 1)); fruit.push([x, y + .3, z]);
    }
    parts.push(at(m3mesh(SphG(.12, 12, 8), '#ffe066', { emi: '#ffd43b', ei: 1 }), 0, 1.35, .3));
    return { parts, fruit, glow: '#8ce99a' };
  },
  aurora(c, r) {
    const cols = ['#63e6be', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'], pts = [[0, 1.9, 0, .6], ...ringPts(6, .5, 1.5, .44, r)];
    const parts = [cyl(.09, .14, 1.4, '#212529', 0, 0, 0), ...pts.map(([x, y, z, rr], i) => ball(rr, cols[i % 5], x, y, z, 1, 1, 1, { emi: cols[i % 5], ei: .3, rough: .4 }))];
    const ribbons = [0, 1, 2].map(i => { const m = at(m3mesh(TorG(1 - i * .12, .02, 6, 40, Math.PI), cols[i + 1], { emi: cols[i + 1], ei: 1, op: .7, cast: false }), 0, 2.2 + i * .12, 0); m.rotation.y = i; parts.push(m); return m; });
    return { parts, fruit: pts, glow: '#63e6be', tick: tt => ribbons.forEach((m, i) => { m.rotation.y = tt * (.2 + i * .1) + i; }) };
  },
  storm(c, r) {
    const t = blobTree('#5c677d', r, 1.1, { rough: .9 }); t.parts[0].material = m3mat('#343a40');
    const bolt = grp(...[[0, 0, .3], [.1, -.3, .25], [-.05, -.55, .25]].map(([x, y, h], i) => { const b = box(.05, h, .05, '#ffe066', x, y, 0, { emi: '#ffe066', ei: 1.2, cast: false }); b.rotation.z = i % 2 ? .5 : -.4; return b; }));
    bolt.position.set(.3, 1.6, .4); t.parts.push(bolt);
    return { ...t, glow: '#74c0fc', tick: tt => { bolt.visible = (Math.sin(tt * 3.1) + Math.sin(tt * 7.3)) > 1.4; } };
  },
});
