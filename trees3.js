'use strict';
/* 2.29 trees: a Mythic rarity above Legendary (three trees you can't buy, win
   from boxes or reforge: they only turn up as a very rare drop from long study
   sessions and big merges), eight more common trees so the rarities make a
   pyramid, four stages past Ancient, lumpier and leafier 3D crowns, a small
   card when you hover a tree, rustles that sound like the tree you brush, and
   six more garden upgrades. Load order: after trees2.js, before upgrades2.js
   (which stretches every upgrade's prices). */

// ---------- rarities ----------
RARITY.mythic = { name: 'Mythic', color: '#e64980', refund: 250 };
LEAF_RARITY.mythic = 7;
// a pyramid: lots of commons and rares, fewer epics, a handful of legendaries, three mythics
for (const [ids, r] of [[['sp_rainbow', 'sp_golden', 'sp_ember', 'sp_moon'], 'epic'],
  [['sp_candy', 'sp_lantern', 'sp_coral', 'sp_frost', 'sp_crystal', 'sp_glowshroom', 'sp_mangrove'], 'rare'],
  [['sp_cactus', 'sp_olive', 'sp_holly', 'sp_aspen', 'sp_fig'], 'common']]) for (const id of ids) { const it = ITEMS.find(i => i.id === id); if (it) it.rarity = r; }

// ---------- stages past Ancient: leaves, sounds ----------
LEAF_STAGE.push(48, 60, 75, 95);
// (sound.js loads later, so these join its list once the page has loaded)
window.addEventListener('load', () => STAGE_SND.push(
  c => { tone(c, { f: 82, dur: 1.6, vol: .07, type: 'sawtooth', filter: 'lowpass', q: 500, attack: .3 }); [330, 415, 494, 659].forEach((f, i) => tone(c, { f, dur: 1.2, vol: .035, type: 'triangle', at: .3 + i * .14 })); },
  c => { tone(c, { f: 65, f2: 98, dur: 1.4, vol: .08, type: 'sawtooth', filter: 'lowpass', q: 400 }); hiss(c, { f: 300, f2: 3000, dur: .8, vol: .05, at: .2 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, dur: .9, vol: .03, type: 'square', filter: 'lowpass', q: 2400, at: .5 + i * .08 })); },
  c => { hiss(c, { f: 900, f2: 2400, dur: 2, vol: .04, type: 'bandpass', q: .4, attack: .8 }); [262, 392, 523, 784, 1047, 1568].forEach((f, i) => tone(c, { f, dur: 2, vol: .028, type: 'sine', at: i * .18, attack: .4 })); },
  c => { [55, 82, 110, 165].forEach((f, i) => tone(c, { f, dur: 3, vol: .04, type: 'sawtooth', filter: 'lowpass', q: 600, at: i * .1, attack: .6 })); [523, 659, 784, 988, 1175, 1568, 2093, 2637].forEach((f, i) => tone(c, { f, dur: 1.4, vol: .022, type: 'sine', at: .6 + i * .16 })); },
));

// ---------- eight more common trees (drawn with the base at 0,0, about 100 tall) ----------
TREE_SPECIES.push(['elm', 'Elm'], ['beech', 'Beech'], ['linden', 'Linden'], ['larch', 'Larch'], ['juniper', 'Juniper'], ['rowan', 'Rowan'], ['plum', 'Plum'], ['sycamore', 'Sycamore']);
Object.assign(SPECIES_DRAW, {
  elm(col, dk, lt) {
    return [`<path d="M-5 0 L-3 -46 L-20 -70 L-16 -72 L0 -54 L2 -76 L6 -76 L5 -54 L18 -72 L22 -69 L4 -44 L5 0Z" fill="${BARK}"/>
      ${c(-26, -78, 15, dk)}${c(26, -78, 15, dk)}${c(0, -92, 19, dk)}<ellipse cx="0" cy="-84" rx="38" ry="16" fill="${col}"/>${c(-14, -96, 12, col)}${c(14, -96, 12, col)}${c(-8, -100, 5, lt)}${c(18, -86, 5, lt)}${c(-26, -82, 4, lt)}`,
      [[-22, -80], [22, -80], [0, -98], [-8, -86], [12, -90]]];
  },
  beech(col, dk, lt) {
    return [`<path d="M-6 0 C-5 -14 -7 -26 -3 -36 L-16 -50 L-13 -52 L0 -42 L1 -56 L5 -56 L4 -40 L15 -50 L18 -47 L5 -34 C7 -22 5 -10 6 0Z" fill="#8d8a80"/>
      <ellipse cx="0" cy="-58" rx="40" ry="26" fill="${dk}"/><ellipse cx="-3" cy="-62" rx="34" ry="21" fill="${col}"/>${c(-18, -70, 8, lt)}${c(10, -76, 6, lt)}${c(22, -60, 5, lt)}`,
      [[-24, -56], [22, -60], [0, -76], [-10, -64], [12, -52]]];
  },
  linden(col, dk, lt) {
    return [`<rect x="-4" y="-34" width="8" height="34" rx="2" fill="${BARK}"/>
      <path d="M0 -112 C24 -96 34 -66 26 -44 C18 -30 -18 -30 -26 -44 C-34 -66 -24 -96 0 -112Z" fill="${dk}"/><path d="M-2 -106 C18 -92 26 -68 20 -50 C12 -38 -14 -40 -20 -50 C-26 -68 -20 -92 -2 -106Z" fill="${col}"/>
      ${c(-8, -86, 6, lt)}${c(8, -66, 4, lt)}${[[-14, -60], [12, -80], [-4, -50]].map(([x, y]) => `<path d="M${x} ${y} l3 -4 l3 4 l-3 3z" fill="#ffec99"/>`).join('')}`,
      [[-14, -58], [12, -78], [0, -96], [-10, -76], [14, -52]]];
  },
  larch(col, dk, lt) {
    const tier = (y, w, h) => `<path d="M${-w} ${y + 3} Q${-w * .5} ${y - h * .4} 0 ${y - h} Q${w * .5} ${y - h * .4} ${w} ${y + 3} Q0 ${y - 4} ${-w} ${y + 3}Z" fill="${dk}"/><path d="M${-w * .8} ${y} Q${-w * .35} ${y - h * .45} 0 ${y - h} L0 ${y - 3}Z" fill="${col}"/>`;
    return [`<rect x="-3.5" y="-104" width="7" height="104" rx="2" fill="#8a5a3b"/>${tier(-14, 30, 26)}${tier(-34, 26, 26)}${tier(-54, 21, 26)}${tier(-74, 15, 24)}${tier(-92, 9, 20)}
      ${[[-20, -16], [16, -36], [-12, -58], [8, -78]].map(([x, y]) => c(x, y, 2.4, lt)).join('')}`,
      [[-18, -18], [16, -38], [-12, -58], [8, -78], [0, -100]]];
  },
  juniper(col, dk, lt) {
    return [`<rect x="-3" y="-14" width="6" height="14" rx="2" fill="${BARK_D}"/>
      ${[[-6, -24, 14], [8, -34, 13], [-6, -48, 13], [6, -62, 12], [-4, -76, 11], [3, -90, 9], [0, -102, 6]].map(([x, y, r], i) => c(x, y, r, i % 2 ? dk : col)).join('')}
      ${c(-8, -64, 4, lt)}${c(6, -82, 3, lt)}${[[-14, -30], [12, -44], [-10, -56], [10, -70], [-6, -86]].map(([x, y]) => c(x, y, 2.4, '#5c7cfa')).join('')}`,
      [[-12, -30], [12, -44], [-10, -58], [8, -72], [0, -94]]];
  },
  rowan(col, dk, lt) {
    const berries = (x, y) => [[0, 0], [3, 2], [-3, 2], [0, 4], [3, 6], [-3, 6]].map(([a, b]) => c(x + a, y + b, 2.2, '#e8590c')).join('');
    return [`<path d="M-4 0 C-3 -16 -5 -28 -2 -38 L-14 -52 L-11 -54 L0 -44 L1 -58 L5 -58 L4 -42 L14 -52 L16 -49 L4 -36 C5 -24 4 -10 4 0Z" fill="#7d6b5d"/>
      ${c(-20, -58, 15, dk)}${c(20, -58, 15, dk)}${c(0, -74, 18, dk)}${c(-13, -62, 13, col)}${c(13, -64, 13, col)}${c(0, -78, 14, col)}${c(-6, -84, 5, lt)}
      ${berries(-22, -52)}${berries(16, -54)}${berries(-4, -68)}`,
      [[-18, -60], [18, -62], [0, -80]]];
  },
  plum(col, dk, lt) {
    return [`<path d="M-5 0 C-6 -14 -2 -26 -4 -38 L-17 -50 L-14 -52 L-1 -43 L1 -56 L5 -56 L3 -40 L16 -50 L18 -47 L5 -36 C6 -22 3 -10 5 0Z" fill="#5c3d2e"/>
      ${c(-20, -58, 16, dk)}${c(20, -58, 16, dk)}${c(0, -74, 19, dk)}${c(-14, -62, 13, col)}${c(14, -64, 13, col)}${c(0, -78, 14, col)}
      ${[[-22, -52], [14, -50], [-4, -64], [22, -66], [-14, -72]].map(([x, y]) => `${c(x, y, 3.6, '#7048e8')}${c(x - 1, y - 1, 1, '#d0bfff')}`).join('')}${[[-8, -86], [10, -80], [-24, -64]].map(([x, y]) => c(x, y, 2.4, '#fcc2d7')).join('')}`,
      [[-16, -60], [16, -62], [0, -80]]];
  },
  sycamore(col, dk, lt) {
    return [`<path d="M-7 0 C-6 -16 -8 -30 -3 -42 L-18 -58 L-15 -60 L0 -48 L1 -64 L5 -64 L4 -46 L17 -58 L20 -55 L6 -40 C8 -26 6 -12 7 0Z" fill="#c9bfa8"/>
      ${[[-3, -12], [2, -24], [-4, -34], [1, -6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="3.4" fill="#8f8467"/>`).join('')}
      ${c(-26, -64, 18, dk)}${c(26, -64, 18, dk)}${c(0, -84, 23, dk)}${c(-18, -70, 15, col)}${c(18, -72, 15, col)}${c(0, -88, 18, col)}${c(0, -66, 15, col)}${c(-10, -94, 7, lt)}${c(14, -78, 6, lt)}`,
      [[-22, -66], [22, -68], [0, -90], [-6, -74]]];
  },
});

// ---------- three mythic trees ----------
const MYTHIC_TREES = [
  { id: 'sp_starfall', type: 'tree', name: 'Starfall tree', rarity: 'mythic', species: 'starfall' },
  { id: 'sp_spirit', type: 'tree', name: 'Spirit blossom', rarity: 'mythic', species: 'spirit' },
  { id: 'sp_prism', type: 'tree', name: 'Prism tree', rarity: 'mythic', species: 'prism' },
];
ITEMS.push(...MYTHIC_TREES);
BONUS_SPECIES.push(...MYTHIC_TREES.map(i => [i.species, i.name, i.id]));
Object.assign(SPECIES_DRAW, {
  starfall() {
    const star = (x, y, r, f) => `<path d="M${x} ${y - r}L${x + r * .3} ${y - r * .3}L${x + r} ${y}L${x + r * .3} ${y + r * .3}L${x} ${y + r}L${x - r * .3} ${y + r * .3}L${x - r} ${y}L${x - r * .3} ${y - r * .3}Z" fill="${f}"/>`;
    return [`${c(0, -74, 46, 'rgba(145,167,255,.18)')}<path d="M-5 0 L-4 -44 L-14 -58 L-11 -60 L-1 -50 L0 -66 L4 -66 L3 -50 L12 -60 L15 -57 L5 -44 L5 0Z" fill="#ced4da"/>
      ${c(-24, -62, 18, '#1c2c5b')}${c(24, -62, 18, '#1c2c5b')}${c(0, -82, 24, '#1c2c5b')}${c(-15, -68, 15, '#2b3f80')}${c(15, -70, 15, '#2b3f80')}${c(0, -86, 18, '#364fc7')}
      ${[[-24, -66, 3], [-6, -90, 4], [18, -76, 3.4], [6, -60, 2.6], [-14, -80, 2.4], [26, -58, 2.2]].map(([x, y, r]) => star(x, y, r, '#fff3bf')).join('')}
      <path d="M30 -112 L14 -94" stroke="#fff3bf" stroke-width="2" stroke-linecap="round" opacity=".8"/>${star(13, -93, 3.4, '#ffe066')}`,
      [[-18, -66], [18, -68], [0, -88]]];
  },
  spirit() {
    return [`${c(0, -74, 48, 'rgba(252,194,215,.22)')}<path d="M-4 0 C-6 -16 2 -30 -2 -44 L-16 -60 L-13 -62 L0 -50 L1 -68 L5 -68 L4 -48 L16 -60 L18 -57 L4 -42 C6 -26 0 -14 4 0Z" fill="#f1f3f5"/>
      ${c(-24, -64, 17, 'rgba(255,222,235,.85)')}${c(24, -64, 17, 'rgba(255,222,235,.85)')}${c(0, -84, 22, 'rgba(255,222,235,.85)')}${c(-14, -70, 14, 'rgba(255,255,255,.85)')}${c(14, -72, 14, 'rgba(229,219,255,.9)')}${c(0, -88, 15, 'rgba(255,255,255,.9)')}
      ${[[-30, -40], [28, -46], [-20, -100], [22, -100], [0, -116]].map(([x, y], i) => `<path d="M${x} ${y} q${i % 2 ? 4 : -4} -6 0 -12" stroke="#fcc2d7" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`).join('')}
      ${[[-20, -72], [6, -94], [18, -64], [-6, -66], [26, -80]].map(([x, y]) => c(x, y, 2.2, '#f783ac')).join('')}`,
      [[-18, -66], [18, -68], [0, -88]]];
  },
  prism() {
    const cols = ['#ff8787', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc', '#f783ac'];
    const gem = (x, y, w, h, i) => `<path d="M${x} ${y - h} L${x + w} ${y - h * .3} L${x + w * .6} ${y + h * .6} L${x - w * .6} ${y + h * .6} L${x - w} ${y - h * .3}Z" fill="${cols[i % 7]}" opacity=".9"/><path d="M${x} ${y - h} L${x + w} ${y - h * .3} L${x} ${y}Z" fill="#fff" opacity=".45"/>`;
    return [`${c(0, -72, 46, 'rgba(229,153,247,.16)')}<path d="M-4 0 L-3 -40 L-12 -54 L-9 -56 L0 -46 L1 -60 L5 -60 L4 -46 L12 -56 L15 -53 L5 -40 L4 0Z" fill="#dee2e6"/>
      ${gem(-22, -62, 12, 16, 0)}${gem(22, -64, 12, 16, 4)}${gem(0, -88, 15, 20, 5)}${gem(-12, -76, 10, 14, 2)}${gem(12, -78, 10, 14, 3)}${gem(0, -64, 11, 14, 1)}${gem(-26, -84, 7, 10, 6)}${gem(26, -86, 7, 10, 2)}`,
      [[-18, -64], [18, -66], [0, -90]]];
  },
});
Object.assign(SPECIES_BUFFS, {
  starfall: { text: '+25% coins and XP from its sessions, and +2% better box odds', coin: .25, xp: .25, luck: 2 },
  spirit: { text: '+15% leaves from every tree, and watering pays double', leafAll: .15, water: 2 },
  prism: { text: '+20% chance for any merge to skip a stage', growAll: .2 },
});
// legendary buffs that fit the tree
SPECIES_BUFFS.phoenix = { ...SPECIES_BUFFS.phoenix, text: '+5% to every Arena stat, and its withered trees rise again (full leaves)', reborn: 1 };

// ---------- how a mythic tree turns up ----------
// Not in boxes, the store or the reforge bench. A 1 in 400 chance after any
// study session of 45+ minutes, 3% when a merge makes a Colossal tree or
// bigger, and a sure thing the first time you grow an Eternal tree.
function grantMythic(why) {
  const left = MYTHIC_TREES.filter(i => !owned(i.id)); if (!left.length) return false;
  const it = left[Math.floor(Math.random() * left.length)];
  D.game.items[it.id] = 1; (D.game.mythics = D.game.mythics || []).push({ id: it.id, at: new Date().toISOString(), why }); save();
  try { [523, 784, 1047, 1568, 2093].forEach((f, i) => tone(sfxReady('ui'), { f, dur: 1.2, vol: .04, type: 'sine', at: i * .12 })); } catch (e) { }
  celebrate({ icon: itemIcon(it, 150), color: RARITY.mythic.color, kicker: '★★★★★ Mythic tree', title: esc(it.name), text: `${why} Almost nobody ever finds one of these. Pick it for a subject under "Your trees": it grows leaves ×${LEAF_RARITY.mythic} and ${esc(speciesBuffText(it.species).replace(/^\+/, 'gives +'))}.` });
  return true;
}
function mythicOnMerge(stage) {
  if (stage >= TOP_STAGE && !D.game.eternalMythic) { D.game.eternalMythic = 1; if (grantMythic('Your first Eternal tree left a seed behind.')) return; }
  if (stage >= 8 && Math.random() < .03) grantMythic('A seed fell from your new giant.');
}
// a new tree: heirloom seeds may make it sprout a stage bigger, and long sessions might drop a mythic seed
function newTreeExtras(l) {
  if (!l || l.mins < 10) return;
  if (!l.withered && Math.random() < .08 * lupg('heirloom') && treeStage(l.mins) < TOP_STAGE) { D.game.trees[l.id] = { ...treeRec(l.id), up: 1 }; setTimeout(() => toast('📜 Heirloom seed!', 'Your new tree sprouted a whole stage bigger.'), 1500); }
  if (l.mins >= 45 && Math.random() < 1 / 400) setTimeout(() => grantMythic(`A mythic seed fell during your ${fmtMins(l.mins)} session.`), 2500);
}

// ---------- garden upgrades ----------
LEAF_UPGRADES.push(
  { id: 'seedbank', icon: '🌰', name: 'Seed bank', desc: 'Your garden holds 2 more trees, per level', prices: [1500], need: 10, max: 10 },
  { id: 'heirloom', icon: '📜', name: 'Heirloom seeds', desc: '8% chance per level that a new tree sprouts one stage bigger', prices: [2500], need: 15, max: 5 },
  { id: 'pollen', icon: '🌺', name: 'Pollinator patch', desc: '+1 leaf an hour for every rare or better tree, per level', prices: [1800], need: 10 },
  { id: 'chimes', icon: '🎐', name: 'Wind chimes', desc: 'Grand and bigger trees grow 6% more leaves, per level', prices: [3000], need: 20 },
  { id: 'press', icon: '📖', name: 'Leaf press', desc: '+3% more leaves every time you collect, per level', prices: [2200], need: 15 },
  { id: 'totem', icon: '🗿', name: 'Ancient totem', desc: 'Colossal and bigger trees grow 25% more leaves', prices: [40000], need: 40, once: true },
);

// ---------- 3D: new trees, lumpier crowns, the giant stages ----------
// a crown ball with a lumpy outline: the bumps depend only on position, so shared edges never crack
function lumpG(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 3), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), a = seed * 7.3, b = seed * 3.1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = 1 + .08 * Math.sin(v.x * 5 + a) * Math.sin(v.y * 4 + b) + .05 * Math.sin(v.z * 7 + a + b) + .035 * Math.sin((v.x + v.y) * 11 + b) * Math.cos(v.z * 9 + a);
    p.setXYZ(i, v.x * r * d, v.y * r * d * (v.y < 0 ? .82 : 1), v.z * r * d);
    n.setXYZ(i, v.x * .85 + Math.sin(v.y * 9 + a) * .08, v.y * .85 + .1, v.z * .85 + Math.cos(v.x * 9 + b) * .08);
  }
  n.needsUpdate = true; return g;
}
if (typeof THREE !== 'undefined') {
  // every leafy crown (blobTree and friends): lumpy balls, a little colour variety, and a dark core for depth
  canopy = function (col, pts, rnd, scale = 1, o) {
    const base = shade(col, (rnd() - .5) * .1), dk = shade(base, -.25), lt = shade(base, .22);
    const out = pts.map(([x, y, z, r], i) => { const m = at(m3mesh(lumpG(r * scale * (.9 + rnd() * .2), rnd() * 10), [base, dk, lt][i % 3 === 2 ? 2 : i % 2], o), x, y, z); m.scale.set(1, .85 + rnd() * .2, 1); m.rotation.y = rnd() * 6.3; return m; });
    const [cx, cy, cz, cr] = pts[0];
    out.push(at(m3mesh(IcoG(cr * scale * .9, 1), shade(base, -.45), { ...(o || {}), cast: false }), cx, cy - cr * .45, cz));
    return out;
  };
  const tallBlob = (col, r, h, pts) => ({ parts: [cyl(.09, .15, h, BARK3, 0, 0, 0), ...canopy(col, pts, r, 1)], fruit: pts });
  Object.assign(T3, {
    elm(c, r) {
      const parts = [cyl(.09, .14, 1.3, BARK3, 0, 0, 0)];
      for (const [ax, az] of [[.45, .1], [-.45, -.1], [.05, .45], [-.1, -.45]]) parts.push(limb(.04, .07, .85, BARK3, 0, 1.15, 0, ax, az));
      const pts = [[0, 2.2, 0, .55], ...ringPts(7, .72, 1.95, .42, r)];
      parts.push(...canopy(c, pts, r, 1)); return { parts, fruit: pts };
    },
    beech(c, r) { const t = tallBlob(c, r, 1, [[0, 1.6, 0, .72], ...ringPts(7, .66, 1.32, .5, r), ...ringPts(3, .3, 1.9, .4, r)]); t.parts[0].material = m3mat('#8d8a80'); return t; },
    linden(c, r) { return tallBlob(c, r, .8, [[0, 1.4, 0, .6], ...ringPts(5, .45, 1.15, .45, r), ...ringPts(4, .35, 1.75, .42, r), ...ringPts(3, .18, 2.25, .3, r), [0, 2.55, 0, .2]]); },
    larch(c) {
      const parts = [cyl(.06, .1, 2.5, '#8a5a3b', 0, 0, 0)];
      [[.75, .35], [.65, .75], [.55, 1.15], [.42, 1.55], [.3, 1.95], [.18, 2.3]].forEach(([rr, y], i) => parts.push(cone(rr, .62, i % 2 ? c : shade(c, -.18), 0, y, 0, 9, { rough: .9 })));
      return { parts, fruit: [[.55, .5, 0], [-.45, .9, .2], [.3, 1.35, -.25], [0, 2.4, 0]] };
    },
    juniper(c, r) {
      const pts = [[0, .55, 0, .38], [.08, .95, .05, .36], [-.06, 1.35, 0, .33], [.05, 1.72, -.04, .29], [0, 2.05, 0, .22], [0, 2.3, 0, .14]];
      const t = { parts: [cyl(.05, .08, .4, BARK3D, 0, 0, 0), ...canopy(c, pts, r, 1)], fruit: pts };
      t.parts.push(...Array.from({ length: 12 }, (_, i) => { const y = .5 + i * .14, a = i * 2.3, rr = .36 - i * .015; return ball(.04, '#5c7cfa', Math.cos(a) * rr, y, Math.sin(a) * rr, 1, 1, 1, { detail: 0, rough: .4 }); }));
      return t;
    },
    rowan(c, r) {
      const t = blobTree(c, r, .9); t.parts[0].material = m3mat('#7d6b5d');
      for (const [x, y, z] of t.fruit.slice(1, 7)) for (let k = 0; k < 5; k++) t.parts.push(ball(.045, '#e8590c', x * 1.2 + Math.cos(k * 1.3) * .06, y - .2 - (k % 2) * .05, z * 1.2 + Math.sin(k * 1.3) * .06, 1, 1, 1, { detail: 0, rough: .4 }));
      return t;
    },
    plum(c, r) {
      const t = blobTree(c, r, .95); t.parts[0].material = m3mat('#5c3d2e');
      t.parts.push(...t.fruit.slice(1, 8).map(([x, y, z]) => ball(.075, '#7048e8', x * 1.22, y - .16, z * 1.22, 1, 1.15, 1, { detail: 1, rough: .35 })));
      t.parts.push(...t.fruit.slice(4).map(([x, y, z]) => ball(.05, '#fcc2d7', x * 1.15, y + .2, z * 1.15, 1, 1, 1, { detail: 0 })));
      return t;
    },
    sycamore(c, r) {
      const t = blobTree(c, r, 1.15); t.parts[0].material = m3mat('#c9bfa8');
      for (let i = 0; i < 6; i++) t.parts.push(ball(.05, '#8f8467', Math.cos(i * 2) * .13, .2 + i * .2, Math.sin(i * 2) * .13, .6, 1.2, .6, { detail: 0 }));
      return t;
    },
    starfall(c, r) {
      const t = blobTree('#1c2c5b', r, 1.1, { emi: '#22348a', ei: .35, rough: .5 }); t.parts[0].material = m3mat('#ced4da', { metal: .4, rough: .3 });
      const stars = Array.from({ length: 18 }, () => { const s = at(m3mesh(new THREE.OctahedronGeometry(.045), '#fff3bf', { emi: '#fff3bf', ei: 1, cast: false }), (r() - .5) * 1.7, 1.1 + r() * 1.4, (r() - .5) * 1.7); t.parts.push(s); return s; });
      const fall = Array.from({ length: 3 }, (_, i) => { const s = at(m3mesh(new THREE.OctahedronGeometry(.07), '#ffe066', { emi: '#ffe066', ei: 1, cast: false }), 0, 0, 0); s.userData.ph = i * 2.1; t.parts.push(s); return s; });
      return { ...t, glow: '#91a7ff', tick: tt => { stars.forEach((s, i) => s.scale.setScalar(.7 + .5 * Math.abs(Math.sin(tt * 2 + i)))); fall.forEach(s => { const p = ((tt * .35 + s.userData.ph) % 2) / 2; s.position.set(1.2 - p * 1.6, 3.2 - p * 2.6, Math.sin(s.userData.ph) * .6); s.visible = p < .9; }); } };
    },
    spirit(c, r) {
      const pts = [[0, 1.9, 0, .62], ...ringPts(6, .5, 1.5, .46, r), ...ringPts(3, .25, 2.2, .36, r)];
      const parts = [cyl(.08, .13, 1.4, '#f1f3f5', 0, 0, 0, 7, { emi: '#ffffff', ei: .15 }), ...pts.map(([x, y, z, rr], i) => at(m3mesh(lumpG(rr, i * 1.7), ['#ffdeeb', '#ffffff', '#e5dbff'][i % 3], { op: .78, emi: '#fcc2d7', ei: .35, rough: .5, cast: false }), x, y, z))];
      const wisps = Array.from({ length: 7 }, (_, i) => { const w = ball(.05, '#fcc2d7', 0, 0, 0, 1, 2.2, 1, { detail: 0, emi: '#f783ac', ei: 1, cast: false }); w.userData.p = [i * .9, .6 + (i % 3) * .25, .8 + (i % 4) * .4]; parts.push(w); return w; });
      return { parts, fruit: pts, glow: '#fcc2d7', tick: tt => wisps.forEach(w => { const [ph, rad, y] = w.userData.p; w.position.set(Math.cos(tt * .6 + ph) * rad, y + ((tt * .25 + ph) % 1.6), Math.sin(tt * .6 + ph) * rad); }) };
    },
    prism(c, r) {
      const cols = ['#ff8787', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc', '#f783ac'];
      const parts = [cyl(.07, .12, 1.3, '#dee2e6', 0, 0, 0, 7, { metal: .5, rough: .2 })], gems = [];
      const pts = [[0, 1.85, 0, .42], ...ringPts(6, .55, 1.5, .3, r), ...ringPts(4, .3, 2.2, .26, r)];
      pts.forEach(([x, y, z, rr], i) => { const g = at(m3mesh(new THREE.OctahedronGeometry(rr), cols[i % 7], { op: .88, rough: .08, metal: .25, emi: cols[i % 7], ei: .3 }), x, y, z); g.scale.y = 1.4; g.rotation.y = r() * 3; gems.push(g); parts.push(g); });
      return { parts, fruit: pts, glow: '#e599f7', tick: tt => gems.forEach((g, i) => { g.rotation.y = tt * .4 + i; }) };
    },
  });
}
// colossal and up (stage 8+): standing stones, then a nest with circling birds, clouds, and a halo of stars
function tree3Huge(body, g, stage, col, rnd, ticks, t) {
  const top = Math.max(1.6, ...t.fruit.map(f => f[1]));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3, st = box(.12, .3 + (i % 2) * .14, .1, i % 2 ? '#868e96' : '#adb5bd', Math.cos(a) * .82, 0, Math.sin(a) * .82); st.rotation.y = -a; body.add(st); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .7, b = limb(.12, .03, .55, BARK3D, Math.cos(a) * .1, .05, Math.sin(a) * .1, 0, 0, 6); b.rotation.set(0, -a, 0); b.children[0].rotation.z = -1.25; body.add(b); }
  if (stage >= 9) {
    const nest = grp(at(m3mesh(TorG(.14, .05, 6, 14), '#8a5a3b'), 0, 0, 0), ball(.045, '#a5d8ff', -.04, .03, 0, 1, 1.2, 1, { detail: 1 }), ball(.045, '#a5d8ff', .05, .03, .02, 1, 1.2, 1, { detail: 1 }));
    nest.children[0].rotation.x = Math.PI / 2; nest.position.set(.35, top - .15, .3); body.add(nest);
    const birds = [0, 1].map(i => { const b = grp(cone(.04, .14, '#343a40', 0, 0, 0, 4)); b.children[0].rotation.z = -Math.PI / 2; const w = box(.2, .01, .05, '#495057', 0, 0, 0); b.add(w); b.userData.w = w; body.add(b); return b; });
    ticks.push(tt => birds.forEach((b, i) => { const a = tt * (.5 + i * .15) + i * 3; b.position.set(Math.cos(a) * 1.1, top + .5 + i * .2, Math.sin(a) * 1.1); b.rotation.y = -a; b.userData.w.rotation.x = Math.sin(tt * 12 + i) * .5; }));
  }
  if (stage >= 10) {
    const clouds = new THREE.Group(); clouds.position.y = top - .3;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, cl = grp(ball(.22, '#ffffff', 0, 0, 0, 1.4, .7, 1, { cast: false }), ball(.16, '#f8f9fa', .22, -.02, 0, 1.2, .7, 1, { cast: false }), ball(.15, '#f1f3f5', -.2, -.03, .05, 1.2, .7, 1, { cast: false })); cl.position.set(Math.cos(a) * 1.15, i * .12, Math.sin(a) * 1.15); clouds.add(cl); }
    body.add(clouds); ticks.push(tt => { clouds.rotation.y = tt * .12; });
  }
  if (stage >= 11) {
    const halo = at(m3mesh(TorG(1.05, .03, 6, 48), '#b197fc', { emi: '#9775fa', ei: 1, op: .85, cast: false }), 0, top + .35, 0); halo.rotation.x = Math.PI / 2 - .25; body.add(halo);
    const stars = Array.from({ length: 10 }, (_, i) => { const s = at(m3mesh(new THREE.OctahedronGeometry(.05), '#fff3bf', { emi: '#fff3bf', ei: 1, cast: false }), 0, 0, 0); s.userData.a = i / 10 * Math.PI * 2; body.add(s); return s; });
    ticks.push(tt => { halo.rotation.z = tt * .3; stars.forEach((s, i) => { const a = s.userData.a + tt * .35; s.position.set(Math.cos(a) * 1.05, top + .35 + Math.sin(a * 2 + tt) * .08, Math.sin(a) * 1.05); s.rotation.y = tt * 2; }); });
    t.glow = '#b197fc';
  }
}

// ---------- hover card: stage and a few stats, kept small ----------
let tipEl = null, tipFor = null;
function treeTip(l, x, y) {
  if (!l || !l.id) { if (tipEl) tipEl.hidden = true; tipFor = null; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'treetip'; document.body.appendChild(tipEl); }
  if (tipFor !== l.id) {
    tipFor = l.id;
    const sp = speciesFor(l.subjectId), rar = speciesRarity(sp), st = treeStageOf(l), r = treeRec(l.id), s = subj(l.subjectId);
    tipEl.style.setProperty('--rc', RARITY[rar].color);
    tipEl.innerHTML = `<b>${esc(treeName(l))}</b><div class="tt-st">${STAGE_ICON[st]} ${TREE_STAGES[st][1]} <span>${st + 1}/${TREE_STAGES.length}</span></div>
      <div class="tt-bar"><i style="width:${Math.round((st + 1) / TREE_STAGES.length * 100)}%"></i></div>
      <div class="tt-meta"><span style="color:${s.color}">${esc(s.name || '')}</span> · ${esc(speciesName(sp))} · <span style="color:${RARITY[rar].color}">${RARITY[rar].name}</span></div>
      <div class="tt-meta">${LEAF} ${fmtLeaf(treeLeafRate(l))}/h · ⏱ ${fmtMins(l.mins)}${r.merged ? ` · 🔀 ${r.merged}` : ''}${l.withered ? ' · 🥀' : ''}</div>`;
  }
  tipEl.hidden = false;
  const w = tipEl.offsetWidth || 200, h = tipEl.offsetHeight || 90;
  tipEl.style.left = Math.min(innerWidth - w - 8, x + 16) + 'px'; tipEl.style.top = Math.max(8, y - h - 12) + 'px';
}
// the flat (no 3D) garden and the tree lists get the same card
document.addEventListener('pointerover', e => { const g = e.target.closest?.('svg.iso .gtree[data-id]'); if (g) { const l = logById(g.dataset.id); if (l) treeTip(l, e.clientX, e.clientY); } });
document.addEventListener('pointermove', e => { if (tipEl && !tipEl.hidden && e.target.closest?.('svg.iso .gtree[data-id]')) treeTip(logById(e.target.closest('.gtree').dataset.id), e.clientX, e.clientY); });
document.addEventListener('pointerout', e => { if (e.target.closest?.('svg.iso .gtree[data-id]') && !e.relatedTarget?.closest?.('svg.iso .gtree[data-id]')) treeTip(null); });
document.addEventListener('pointerdown', () => treeTip(null), true);

// ---------- brushing through trees: a rustle that sounds like the tree ----------
// needles tick, palms and bamboo swish like paper, crystals chime, blossom is soft and airy,
// and bigger trees sound deeper. Each tree has its own little cooldown so a sweep sounds like a run of leaves.
const BRUSH_KIND = { pine: 'needle', fir: 'needle', spruce: 'needle', cedar: 'needle', cypress: 'needle', larch: 'needle', juniper: 'needle', holly: 'needle', poplar: 'needle',
  palm: 'paper', bamboo: 'paper', banyan: 'paper', mangrove: 'paper', cactus: 'paper', fig: 'paper',
  crystal: 'chime', prism: 'chime', frost: 'chime', candy: 'chime', galaxy: 'chime', starfall: 'chime',
  cherry: 'soft', wisteria: 'soft', magnolia: 'soft', jacaranda: 'soft', spirit: 'soft', plum: 'soft', willow: 'soft', mushroom: 'soft', glowshroom: 'soft' };
const brushLastAt = {}; let brushAny = 0;
function brushSfx(l, strength = .5) {
  if (!l) return;
  const now = performance.now(); if (now - brushAny < 45 || now - (brushLastAt[l.id] || 0) < 140) return;
  brushAny = now; brushLastAt[l.id] = now;
  let c; try { c = sfxReady('garden'); } catch (e) { return; } if (!c) return;
  const sp = speciesFor(l.subjectId), kind = BRUSH_KIND[sp] || 'leaf', st = treeStageOf(l), deep = 1 - Math.min(.45, st * .04), v = Math.min(1, .35 + strength * .9);
  try {
    if (kind === 'needle') for (let i = 0; i < 5; i++) hiss(c, { f: (5200 + Math.random() * 2500) * deep, dur: .035 + Math.random() * .03, vol: .02 * v, q: 3, at: i * .025 + Math.random() * .02 });
    else if (kind === 'paper') { hiss(c, { f: 1300 * deep, f2: 2600 * deep, dur: .22, vol: .035 * v, q: .7, attack: .05 }); hiss(c, { f: 3200, dur: .1, vol: .012 * v, at: .08, type: 'highpass' }); }
    else if (kind === 'chime') { [2093, 2637, 3136, 3951].sort(() => Math.random() - .5).slice(0, 2).forEach((f, i) => tone(c, { f: f * (st >= 8 ? .5 : 1), dur: .5, vol: .016 * v, type: 'sine', at: i * .06 })); hiss(c, { f: 7000, dur: .06, vol: .008 * v, type: 'highpass' }); }
    else if (kind === 'soft') { hiss(c, { f: 2200 * deep, dur: .28, vol: .022 * v, q: .5, attack: .07 }); if (Math.random() < .3) tone(c, { f: 1760 + Math.random() * 600, dur: .25, vol: .008, type: 'sine', at: .05 }); }
    else { // leaves: a quick run of small crackles over a soft swish
      hiss(c, { f: 1600 * deep, dur: .2 + Math.random() * .1, vol: .02 * v, q: .6, attack: .04 });
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) hiss(c, { f: (2600 + Math.random() * 2400) * deep, dur: .03 + Math.random() * .04, vol: (.012 + Math.random() * .014) * v, q: 2.2, at: Math.random() * .16 });
    }
  } catch (e) { }
}
// the card goes as soon as the pointer is over anything that isn't a tree
document.addEventListener('pointermove', e => { if (tipEl && !tipEl.hidden && !e.target.closest?.('.g3canvas, svg.iso .gtree')) treeTip(null); });
