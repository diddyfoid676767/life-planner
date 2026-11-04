'use strict';
/* 2.35 forest and shop:
   - Prestige: once every garden upgrade is maxed, start a new forest. Your
     garden trees go to the Archive island (your study log keeps them), leaves
     and garden upgrades reset, and you get Seeds for the size of your forest.
     Seeds buy nodes on a permanent upgrade tree. Coins, critters, cosmetics
     and the Arena are kept. Each prestige adds a star next to your name.
   - Top-tier garden upgrades for big forests, more coin upgrades
   - Rare visitors that only come for certain decorations
   - Mythic quests: the Prism tree and Spirit blossom can only be earned
   - Hover a critter in the 3D garden for its stats, click it to pet it
   - Fruit and the fairy ring are little games now, the daily gift unboxes
   - Auto-pick: give your rarest trees to your biggest subjects
   Load order: after forest2.js. */

// ---------- prestige state ----------
function presState() { const P = D.game.prestige = D.game.prestige || {}; P.n = P.n || 0; P.seeds = P.seeds || 0; P.spent = P.spent || 0; P.nodes = P.nodes || {}; P.log = P.log || []; return P; }
const presN = () => (D && D.game && D.game.prestige && D.game.prestige.n) || 0;
const seedsLeft = () => { const P = presState(); return P.seeds - P.spent; };
const hasNode = id => !!(D && D.game && D.game.prestige && (D.game.prestige.nodes || {})[id]);
function presStar(r) {
  const n = r && r.me ? presN() : +((r && r.study) || {}).pres || 0; // shared inside the study numbers
  return n ? `<span class="pstar" title="Prestige ${n}: started a new forest ${n} time${n === 1 ? '' : 's'}">★${n > 1 ? n : ''}</span>` : '';
}

// the permanent upgrade tree: x and y are percentages across and down the tree
const PRES_NODES = [
  { id: 'p_root', icon: '🌱', name: 'First seed', desc: '+10% leaves from every tree', cost: 1, x: 50, y: 7, fx: { leaf: .1 } },
  { id: 'p_sun', icon: '☀️', name: 'Sunlight', desc: '+15% leaves from every tree', cost: 3, x: 26, y: 24, req: ['p_root'], fx: { leaf: .15 } },
  { id: 'p_bask', icon: '🧺', name: 'Woven basket', desc: 'The basket holds 6 more hours', cost: 2, x: 50, y: 24, req: ['p_root'], fx: { basket: 6 } },
  { id: 'p_luck', icon: '🍀', name: 'Lucky soil', desc: '+5% lucky merges (skip a stage)', cost: 3, x: 74, y: 24, req: ['p_root'], fx: { luck: .05 } },
  { id: 'p_sun2', icon: '🌞', name: 'Midsummer', desc: '+25% leaves from every tree', cost: 8, x: 12, y: 42, req: ['p_sun'], fx: { leaf: .25 } },
  { id: 'p_start', icon: '🎒', name: 'Head start', desc: 'Start every new forest with 25,000 leaves', cost: 5, x: 35, y: 42, req: ['p_sun', 'p_bask'], fx: { start: 25000 } },
  { id: 'p_gnome', icon: '🧙', name: 'Loyal gnome', desc: 'The garden gnome stays when you prestige', cost: 6, x: 60, y: 42, req: ['p_bask', 'p_luck'] },
  { id: 'p_coin', icon: '🪙', name: 'Golden roots', desc: '+5% coins from study sessions (from when you buy it)', cost: 6, x: 86, y: 42, req: ['p_luck'], fx: { coin: .05 } },
  { id: 'p_sun3', icon: '🌈', name: 'Evergreen', desc: '+50% leaves from every tree', cost: 20, x: 8, y: 61, req: ['p_sun2'], fx: { leaf: .5 } },
  { id: 'p_keep', icon: '🪴', name: 'Keepsake', desc: 'Keep your 3 biggest trees when you prestige', cost: 12, x: 28, y: 61, req: ['p_start'], fx: { keep: 3 } },
  { id: 'p_fruit', icon: '🍎', name: 'Orchard', desc: 'Fruit and fairy rings give double leaves', cost: 10, x: 50, y: 61, req: ['p_gnome'] },
  { id: 'p_visit', icon: '🦜', name: 'Bird song', desc: 'Visitors come 50% more often', cost: 10, x: 71, y: 61, req: ['p_gnome', 'p_coin'], fx: { visit: .5 } },
  { id: 'p_luck2', icon: '🎲', name: 'Twin seeds', desc: '+10% lucky merges', cost: 15, x: 92, y: 61, req: ['p_coin'], fx: { luck: .1 } },
  { id: 'p_bask2', icon: '🏺', name: 'Leaf vault', desc: 'The basket holds 12 more hours', cost: 25, x: 20, y: 79, req: ['p_sun3', 'p_keep'], fx: { basket: 12 } },
  { id: 'p_keep2', icon: '🌳', name: 'Heirloom grove', desc: 'Keep your 10 biggest trees when you prestige', cost: 40, x: 42, y: 79, req: ['p_keep'], fx: { keep: 7 } },
  { id: 'p_coin2', icon: '💰', name: 'Gilded bark', desc: '+10% coins from study sessions (from when you buy it)', cost: 30, x: 80, y: 79, req: ['p_visit', 'p_luck2'], fx: { coin: .1 } },
  { id: 'p_crown', icon: '👑', name: 'Crown of the forest', desc: 'Every tree grows double leaves', cost: 100, x: 50, y: 94, req: ['p_bask2', 'p_keep2', 'p_coin2'], fx: { mult: 1 } },
];
const presFx = key => PRES_NODES.reduce((a, n) => a + (hasNode(n.id) && n.fx && n.fx[key] || 0), 0);
// coin nodes only count for sessions after you bought them, like every other coin buff
const presFxAt = (key, l) => PRES_NODES.reduce((a, n) => { const at = hasNode(n.id) && D.game.prestige.nodes[n.id]; return a + (at && n.fx && n.fx[key] && String(l.start) >= at ? n.fx[key] : 0); }, 0);
const nodeOpen = n => !n.req || n.req.some(hasNode);

// ---------- top-tier garden upgrades (not needed for prestige) ----------
LEAF_UPGRADES.push(
  { id: 'canopy', icon: '🌉', name: 'Canopy walkway', desc: '+15% leaves from every tree, per level', prices: [150000], need: 60, max: 15, top: true },
  { id: 'mycel', icon: '🕸️', name: 'Mycelium network', desc: '+1% leaves for every tree in your garden, per level', prices: [400000], need: 80, max: 10, top: true },
  { id: 'starlight', icon: '🌠', name: 'Starlight grove', desc: '+50% leaves for every prestige you\'ve done, per level', prices: [1000000], pres: 1, max: 5, top: true },
  { id: 'worldseed', icon: '🌍', name: 'World seed', desc: 'Every tree grows double leaves', prices: [25000000], need: 100, once: true, top: true },
);
UPGRADES.push(
  { id: 'mergebell', icon: '🔔', name: 'Merge bell', desc: '+3% lucky merges (skip a stage), per level', prices: [500], max: 5 },
  { id: 'fruitbowl', icon: '🥝', name: 'Fruit bowl', desc: 'Fruit piles up to 2 more before it stops growing, per level', prices: [300, 700, 1500], max: 3 },
  { id: 'goldfind', icon: '🍂', name: 'Leaf hunter', desc: 'Golden leaves turn up 25% more often, per level', prices: [400], max: 4 },
  { id: 'compass', icon: '🧭', name: 'Explorer\'s compass', desc: 'Visitors drop by 10% more often, per level', prices: [350], max: 5 },
);
for (const u of [...LEAF_UPGRADES, ...UPGRADES].filter(u => u.max && u.prices.length < u.max)) extendPrices(u);

let _gcount = 0, _gcountAt = 0;
const gardenCount = () => { if (Date.now() - _gcountAt > 1000) { _gcount = gardenLogs().length; _gcountAt = Date.now(); } return _gcount; };
{
  const base = treeLeafRate;
  treeLeafRate = l => base(l) * (1 + .15 * lupg('canopy')) * (1 + .01 * lupg('mycel') * gardenCount()) * (1 + .5 * lupg('starlight') * presN()) * (lupg('worldseed') ? 2 : 1)
    * (1 + presFx('leaf')) * (1 + presFx('mult')) * (visiting('owl') ? 1.3 : 1) * (visiting('peacock') && speciesRarity(speciesFor(l.subjectId)) !== 'common' ? 1.25 : 1);
}
{
  const base = coinMult;
  coinMult = l => base(l) + presFxAt('coin', l);
}

// ---------- prestige ----------
const presUps = () => LEAF_UPGRADES.filter(u => !u.top);
const presReady = () => !!(D && D.game && D.game.leaves) && presUps().every(u => lupg(u.id) >= u.prices.length);
// forest size: every garden tree counts its stage, times how fast its kind grows leaves
const forestSize = () => Math.round(gardenLogs().filter(l => !l.withered).reduce((a, l) => a + (treeStageOf(l) + 1) * (LEAF_RARITY[speciesRarity(speciesFor(l.subjectId))] || 1), 0));
const seedsFor = () => Math.max(1, Math.floor(forestSize() / 25));
function doPrestige() {
  if (!presReady()) return;
  const gain = seedsFor(), keepN = presFx('keep');
  if (!confirm(`Prestige and start a new forest?\n\nYour garden trees go to the Archive island (they stay in your study log)${keepN ? `, except your ${keepN} biggest` : ''}. Your leaves and garden upgrades go back to zero.\nYou keep your coins, critters, tree types, cosmetics and the Arena.\n\nYou get ${gain} Seed${gain === 1 ? '' : 's'} to spend on the permanent upgrade tree, and a prestige star.`)) return;
  const P = presState(), L = leafState(), g = gardenLogs();
  const keep = new Set([...g].sort((a, b) => treeBase(b) * (LEAF_RARITY[speciesRarity(speciesFor(b.subjectId))] || 1) - treeBase(a) * (LEAF_RARITY[speciesRarity(speciesFor(a.subjectId))] || 1)).slice(0, keepN).map(l => l.id));
  for (const l of g) if (!keep.has(l.id)) { setRec(l.id, { arch: true, pres: P.n + 1 }); if (D.game.gridPos) delete D.game.gridPos[l.id]; }
  L.pastBank = (L.pastBank || 0) + (L.bank || 0); L.bank = presFx('start'); L.spent = 0; L.carry = 0; L.last = Date.now();
  L.ups = hasNode('p_gnome') && L.ups.gnome ? { gnome: L.ups.gnome } : {};
  P.n++; P.seeds += gain; P.log.push({ at: new Date().toISOString(), seeds: gain, size: forestSize() });
  ui.forestPage = 'prestige'; save(); render();
  try { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(sfxReady('ui'), { f, dur: 1.4, vol: .04, type: 'sine', at: i * .1 })); } catch (e) { }
  celebrate({ icon: '<span class="critbig">⭐</span>', color: '#f59f00', kicker: `Prestige ${P.n}`, title: `+${gain} Seed${gain === 1 ? '' : 's'}`, text: 'A fresh forest. Spend your Seeds on the upgrade tree: they last for good.' });
  if (P.n === 1) setTimeout(() => grantMythic('Your first prestige: the old forest left a Spirit blossom behind.', 'sp_spirit'), 2500);
}
function buyNode(id) {
  const n = PRES_NODES.find(x => x.id === id), P = presState(); if (!n || hasNode(id) || !nodeOpen(n)) return;
  if (seedsLeft() < n.cost) { toast(`${n.icon} ${n.name}`, `Needs ${n.cost} Seed${n.cost === 1 ? '' : 's'}. You have ${seedsLeft()}.`); return; }
  P.spent += n.cost; P.nodes[id] = new Date().toISOString(); ui.justNode = id; save(); render(); sfx('levelup');
  toast(`${n.icon} ${n.name}`, `${n.desc}. Yours for good.`);
}
function prestigeView() {
  const P = presState(), ready = presReady(), ups = presUps(), done = ups.filter(u => lupg(u.id) >= u.prices.length).length;
  const line = (a, b) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${hasNode(a.id) && hasNode(b.id) ? 'on' : hasNode(a.id) ? 'open' : ''}"/>`;
  const lines = PRES_NODES.flatMap(n => (n.req || []).map(r => line(PRES_NODES.find(x => x.id === r), n))).join('');
  const nodes = PRES_NODES.map(n => { const own = hasNode(n.id), open = !own && nodeOpen(n), can = open && seedsLeft() >= n.cost;
    return `<button class="pnode ${own ? 'own' : open ? 'open' : 'shut'} ${can ? 'can' : ''} ${ui.justNode === n.id ? 'just' : ''}" style="left:${n.x}%;top:${n.y}%" data-f3="node" data-id="${n.id}" aria-label="${esc(n.name)}">
      <span class="pn-ic">${own || open ? n.icon : '?'}</span><span class="ptip"><b>${own || open ? esc(n.name) : '???'}</b>${own || open ? `<span>${esc(n.desc)}</span>` : '<span>Buy a node next to it first</span>'}<em>${own ? '✓ Yours for good' : `🌰 ${n.cost} Seed${n.cost === 1 ? '' : 's'}`}</em></span></button>`; }).join('');
  setTimeout(() => { ui.justNode = null; }, 0);
  const q = mythicQuests();
  return `<div class="card prescard"><div class="card-head"><h2>⭐ Prestige ${P.n ? `<span class="pstar">★${P.n}</span>` : ''}</h2><span class="muted small-text">start a new forest for Seeds that last for good</span><span class="coins">🌰 <b>${seedsLeft()}</b> Seeds</span></div>
    <div class="presgrid"><div><p class="small-text" style="margin-top:0">${ready ? `Every garden upgrade is maxed. Prestige now for <b>${seedsFor()} Seeds</b> (your forest size is ${forestSize()}).` : `Max every garden upgrade to prestige: <b>${done} / ${ups.length}</b> done. The top-tier ones (🌉 🕸️ 🌠 🌍) aren't needed.`}</p>
      <div class="meter"><i style="width:${Math.round(done / ups.length * 100)}%"></i></div>
      <p class="muted small-text">Prestiging sends your garden trees to the Archive island and resets leaves and garden upgrades. You keep coins, critters, tree types, cosmetics and the Arena. Seeds scale with your forest size: every garden tree counts its stage times its leaf speed, and every 25 is a Seed.</p>
      <button class="btn ${ready ? 'primary' : ''}" data-f3="prestige" ${ready ? '' : 'disabled'}>⭐ ${ready ? `Prestige: +${seedsFor()} Seeds` : 'Not ready yet'}</button></div>
      <div class="pq"><h3>🔮 Mythic quests</h3>${q.map(x => `<div class="pqrow ${x.got ? 'got' : ''}"><span>${x.icon}</span><div class="main"><b>${esc(x.name)}</b><small class="muted">${esc(x.how)}</small><div class="meter"><i style="width:${Math.min(100, Math.round(x.have / x.need * 100))}%"></i></div></div>${x.got ? '<span class="tag green">✓ Found</span>' : x.have >= x.need ? `<button class="btn small primary" data-f3="quest" data-id="${x.id}">Claim</button>` : `<span class="muted small-text">${Math.min(x.have, x.need)} / ${x.need}</span>`}</div>`).join('')}</div></div></div>
    <div class="card ptreecard"><div class="card-head"><h2>🌳 The upgrade tree</h2><span class="muted small-text">${Object.keys(P.nodes).length} / ${PRES_NODES.length} · hover a node to see it, click to buy · start at the top</span></div>
    <div class="ptree"><svg class="plines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div></div>`;
}

// ---------- mythic quests ----------
function mythicQuests() {
  const st = typeof bestStreak === 'function' ? bestStreak() : 0, eternal = gardenTrees() && D.focusLogs.some(l => treeStageOf(l) >= TOP_STAGE);
  return [
    { id: 'sp_prism', icon: '🔷', name: 'Prism tree', how: 'Study 30+ minutes a day for 30 days in a row', have: st, need: 30, got: owned('sp_prism') },
    { id: 'sp_spirit', icon: '🕊️', name: 'Spirit blossom', how: 'Prestige for the first time', have: presN(), need: 1, got: owned('sp_spirit') },
    { id: 'sp_starfall', icon: '🌠', name: 'Starfall tree', how: 'Grow an Eternal tree, or get very lucky after long sessions and giant merges', have: eternal ? 1 : 0, need: 1, got: owned('sp_starfall') },
  ];
}
function claimQuest(id) {
  const q = mythicQuests().find(x => x.id === id); if (!q || q.got || q.have < q.need) return;
  grantMythic(`You finished the quest: ${q.how.toLowerCase()}.`, id); render();
}

// ---------- visitors: cosmetics bring rare ones ----------
VISITORS.push(
  { id: 'fox', emoji: '🦊', name: 'Red fox', buff: 'Brings you 60 coins when it arrives', needs: ['d_tent', 'd_cabin', 'd_campfire'] },
  { id: 'owl', emoji: '🦉', name: 'Snowy owl', buff: '+30% leaves from every tree while it visits', needs: ['d_telescope', 'd_treehouse'] },
  { id: 'peacock', emoji: '🦚', name: 'Peacock', buff: '+25% leaves from rare and better trees while it visits', needs: ['d_fountain', 'd_statue'] },
);
const VISIT_LIKES = { hummingbird: ['d_flowers'], raccoon: ['d_picnic', 'd_stall'], snail: ['d_pond', 'd_shrooms'], otter: ['d_pond', 'd_well'] };
for (const v of VISITORS) { const n = v.needs || VISIT_LIKES[v.id]; if (n) v.buff += `${v.needs ? '. Only visits if you have' : '. Visits more if you have'} ${n.map(id => (itemById(id) || {}).name || id).join(' or ')}`; }
visitorRoll = function (day) {
  const rnd = seeded('visit' + day), chance = Math.min(.9, .33 * (1 + .1 * lupg('birdbath') + activeBuff('visit') + .1 * upg('compass') + presFx('visit')));
  if (rnd() >= chance) return null;
  const has = ids => (ids || []).some(id => owned(id) && !(D.game.hidden || {})[id]);
  const pool = VISITORS.filter(v => !v.needs || has(v.needs)).flatMap(v => has(v.needs || VISIT_LIKES[v.id]) ? [v, v] : [v]);
  return pool[Math.floor(rnd() * pool.length)].id;
};

// ---------- critters in the 3D garden: hover for stats, click to pet ----------
function critInfo(c) {
  if (c.kind === 'crit') { const k = CRITTERS.find(x => x.id === c.id); return k && { icon: k.emoji, name: k.name, sub: `Lives here · moved in ${fmtDate(String(D.game.critters[k.id] || '').slice(0, 10))}`, buff: k.buff }; }
  if (c.kind === 'visit') { const k = visitorById(c.id); return k && { icon: k.emoji, name: k.name, sub: 'Visiting today', buff: k.buff }; }
  const i = itemById(c.id); return i && { icon: '🐾', name: i.name, sub: `${RARITY[i.rarity].name} animal · ${D.game.items[i.id] || 1} owned`, buff: 'Roams your forest' };
}
const petsToday = () => { const p = D.game.pets = D.game.pets || {}; if (p.day !== today()) { p.day = today(); p.ids = []; } return p; };
function critTip(c, x, y) {
  const k = critInfo(c); if (!k) return treeTip(null);
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'treetip'; document.body.appendChild(tipEl); }
  const key = 'c:' + c.kind + c.id + petsToday().ids.includes(c.id);
  if (tipFor !== key) {
    tipFor = key; tipEl.style.setProperty('--rc', c.kind === 'visit' ? '#e64980' : '#2f9e44');
    tipEl.innerHTML = `<b>${k.icon} ${esc(k.name)}</b><div class="tt-meta">${esc(k.sub)}</div><div class="tt-meta">✨ ${esc(k.buff)}</div><div class="tt-meta">${petsToday().ids.includes(c.id) ? '❤️ Petted today' : `👆 Click to pet: +${fmtLeaf(Math.max(1, Math.round(leafRate() / 4)))} ${LEAF}`}</div>`;
  }
  tipEl.hidden = false;
  const w = tipEl.offsetWidth || 200, h = tipEl.offsetHeight || 90;
  tipEl.style.left = Math.min(innerWidth - w - 8, x + 16) + 'px'; tipEl.style.top = Math.max(8, y - h - 12) + 'px';
}
function petCritter(c, ev, obj) {
  const a = (G3.roam || []).find(r => r.o === obj); if (a) a.jump = 1;
  try { sfx('chirp'); } catch (e) { }
  hearts(ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2);
  const p = petsToday(); if (p.ids.includes(c.id)) return;
  p.ids.push(c.id); const n = Math.max(1, Math.round(leafRate() / 4)); leafState().bank += n; save();
  const k = critInfo(c); toast(`❤️ You petted the ${k ? k.name.replace(/^(The|A) /, '') : 'critter'}`, `+${fmtLeaf(n)} leaves. Every critter can be petted once a day.`, { timeout: 3500 });
  const el = document.querySelector('.leafbar'); if (el) el.outerHTML = leafBar();
}
function hearts(x, y) {
  const box = document.createElement('div'); box.className = 'leafburst'; box.style.left = x + 'px'; box.style.top = y + 'px';
  box.innerHTML = Array.from({ length: 7 }, () => `<i style="--x:${Math.round((Math.random() - .5) * 120)}px;--y:${Math.round(-40 - Math.random() * 90)}px;--r:${Math.round(Math.random() * 60 - 30)}deg;--d:${(.8 + Math.random() * .5).toFixed(2)}s">❤️</i>`).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 1500);
}

// ---------- more tree sounds: big trees creak, glowing trees shimmer, fruit trees pop ----------
{
  const base = brushSfx, FRUITY = ['apple', 'lemon', 'fig', 'olive', 'plum', 'rowan'];
  brushSfx = function (l, strength = .5) {
    const before = brushAny; base(l, strength); if (!l || brushAny === before) return;
    let c; try { c = sfxReady('garden'); } catch (e) { return; } if (!c) return;
    const sp = speciesFor(l.subjectId), st = treeStageOf(l);
    try {
      if (st >= 7 && Math.random() < .25) tone(c, { f: 70 + Math.random() * 30, f2: 55, dur: .45, vol: .03, type: 'sawtooth', filter: 'lowpass', q: 260, attack: .08 });
      if (GLOWING.includes(sp) && Math.random() < .5) tone(c, { f: 1568 + Math.random() * 800, dur: .6, vol: .01, type: 'sine', attack: .1 });
      if (FRUITY.includes(sp) && Math.random() < .3) tone(c, { f: 700 + Math.random() * 300, f2: 300, dur: .08, vol: .025, type: 'sine', at: .05 });
    } catch (e) { }
  };
}

// ---------- fruit: shake the tree and catch what falls ----------
const fruitHours = () => hasNode('p_fruit') ? 2 : 1;
pickFruit = function () {
  const n = fruitReady(); if (!n) return;
  const L = extrasState(), per = Math.round(leafRate() * fruitHours());
  L.fruitAt = n >= fruitMax() ? Date.now() : L.fruitAt + n * FRUIT_H * 36e5; save();
  const fruit = Array.from({ length: n }, (_, i) => ({ gold: Math.random() < .1, x: 22 + (i * 56 / Math.max(1, n - 1 || 1)) + (Math.random() * 8 - 4), y: 22 + Math.random() * 26 }));
  let got = 0, left = n;
  const ov = f3overlay(`<h2>🍎 Pick your fruit</h2><p class="muted small-text">Click each one to catch it. Golden ones are worth 3.</p>
    <div class="orchard"><div class="otree">🌳</div>${fruit.map((f, i) => `<button class="ofruit ${f.gold ? 'gold' : ''}" data-i="${i}" style="left:${f.x}%;top:${f.y}%">${f.gold ? '🍏' : '🍎'}</button>`).join('')}</div>
    <div class="row" style="justify-content:center"><b class="ogot">+0 ${LEAF}</b><button class="btn primary" data-close>Done</button></div>`, () => {
      fruit.forEach((f, i) => { if (!f.done) take(i, true); }); if (got) { leafState().bank += got; save(); leafBurst(document.querySelector('.leafbar'), got); }
      toast(`🍎 Picked ${n} fruit`, `+${fmtLeaf(got)} leaves.`); const el = document.querySelector('.leafbar'); if (el) el.outerHTML = leafBar();
    });
  function take(i, quiet) { const f = fruit[i]; if (f.done) return; f.done = true; left--; got += per * (f.gold ? 3 : 1); if (!quiet) { const b = ov.querySelector(`.ofruit[data-i="${i}"]`); b.classList.add('fall'); try { sfx('pop'); } catch (e) { } ov.querySelector('.ogot').textContent = `+${fmtLeaf(got)} ${LEAF}`; if (!left) setTimeout(() => ov.querySelector('[data-close]')?.click(), 700); } }
  ov.addEventListener('click', e => { const b = e.target.closest('.ofruit'); if (b) take(+b.dataset.i); });
};
// ---------- fairy ring: pick a mushroom ----------
pickShroom = function () {
  if (!shroomReady()) return;
  const L = extrasState(), at = new Date().toISOString(), base = Math.round(leafRate() * 12 * fruitHours());
  L.shroomAt = Date.now(); L.bank += base; D.game.ledger['shroom:' + at] = 25; save();
  const prizes = [['🍃', 'A leaf pile', 'twelve more hours of leaves', () => { const n = Math.round(leafRate() * 12 * fruitHours()); leafState().bank += n; return n; }],
    ['🪙', 'A pot of coins', '+50 coins', () => { D.game.ledger['shroomb:' + at] = 50; return 0; }],
    ['🍂', 'Leaf rush', 'your trees grow ×10 leaves for 3 minutes', () => { LIVE.rushUntil = Date.now() + 180e3; return 0; }],
    ['🧺', 'A golden basket', 'a quarter of a full basket', () => { const n = Math.round(basketCap() * .25); leafState().bank += n; return n; }]].sort(() => Math.random() - .5).slice(0, 3);
  let picked = false;
  const ov = f3overlay(`<h2>🍄 A fairy ring!</h2><p class="muted small-text">+${fmtLeaf(base)} leaves and +25 ${COIN} already. Pick one mushroom for a bonus.</p>
    <div class="fring">${prizes.map((p, i) => `<button class="fshroom" data-i="${i}" style="--d:${i * .15}s">🍄<span class="fprize">${p[0]}<b>${p[1]}</b><small>${p[2]}</small></span></button>`).join('')}</div>
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>Done</button></div>`, () => { const el = document.querySelector('.leafbar'); if (el) el.outerHTML = leafBar(); render(); });
  ov.addEventListener('click', e => {
    const b = e.target.closest('.fshroom'); if (!b || picked) return; picked = true;
    const p = prizes[+b.dataset.i], n = p[3](); save();
    ov.querySelectorAll('.fshroom').forEach(x => x.classList.add(x === b ? 'pick' : 'miss'));
    try { sfx('coin'); } catch (e) { } if (n) leafBurst(b, n);
  });
};
function f3overlay(html, onClose) {
  const ov = document.createElement('div'); ov.className = 'f3ov'; ov.innerHTML = `<div class="f3card">${html}</div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === ov) { ov.remove(); onClose && onClose(); } });
  return ov;
}

// ---------- the daily gift unboxes ----------
{
  const base = claimGift;
  claimGift = function () {
    if (!giftReady()) return;
    const n = giftAmount(); base();
    revealFx({ boxHtml: boxSvg({ id: 'gift', colors: ['#ff6b6b', '#c92a2a', '#ffe066'] }, 170), rarity: n >= 60 ? 'epic' : n >= 30 ? 'rare' : 'common',
      prizeHtml: '<span class="critbig">🪙</span>', title: `+${n} coins`, text: 'Your daily gift. Come back tomorrow for another one.' });
  };
}

// ---------- auto-pick: rarest trees to the biggest subjects ----------
function subjectSizes() {
  const out = {};
  for (const l of gardenLogs()) if (!l.withered) out[l.subjectId] = (out[l.subjectId] || 0) + treeStageOf(l) + 1;
  return out;
}
function autoPickTrees() {
  const size = subjectSizes(), subs = [...D.subjects].sort((a, b) => (size[b.id] || 0) - (size[a.id] || 0) || D.focusLogs.filter(l => l.subjectId === b.id).length - D.focusLogs.filter(l => l.subjectId === a.id).length);
  const kinds = [...new Set([...BONUS_SPECIES.filter(b => owned(b[2])).map(b => b[0]), ...TREE_SPECIES.map(b => b[0])])].sort((a, b) => (LEAF_RARITY[speciesRarity(b)] || 1) - (LEAF_RARITY[speciesRarity(a)] || 1));
  const map = {}; subs.forEach((s, i) => { if (kinds[i]) map[s.id] = kinds[i]; });
  const changed = subs.filter(s => map[s.id] && map[s.id] !== speciesFor(s.id)).length;
  if (!changed) { toast('✨ Already the best', 'Your rarest trees are already on your biggest subjects.'); return; }
  if (!confirm(`Give your rarest trees to the subjects with the biggest forests? This changes the tree for ${changed} subject${changed === 1 ? '' : 's'} (all their trees change kind).`)) return;
  D.settings.treeFor = { ...(D.settings.treeFor || {}), ...map }; save(); render();
  toast('✨ Trees auto-picked', `${subs[0] ? subs[0].name + ' grows ' + speciesName(map[subs[0].id]) + ', and the rest follow by size.' : ''}`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-f3]'); if (!el) return;
  e.preventDefault();
  const a = el.dataset.f3;
  if (a === 'node') buyNode(el.dataset.id);
  if (a === 'prestige') doPrestige();
  if (a === 'quest') claimQuest(el.dataset.id);
  if (a === 'autopick') autoPickTrees();
});

// ---------- seasons are folded into prestige ----------
seasonCard = function () {
  const L = leafState();
  return `<div class="card seasoncard"><div class="card-head"><h2>⭐ Prestige</h2><span class="muted small-text">${L.seeds ? `your ${L.seeds} old season seed${L.seeds === 1 ? '' : 's'} still give +${2 * L.seeds}% leaves` : 'the new way to reset'}</span></div>
    <p class="muted small-text" style="margin-top:0">Seasons are now Prestige: max every garden upgrade, then start a new forest for Seeds that buy permanent upgrades.</p>
    <button class="btn" data-act="forestPage" data-v="prestige">Open Prestige</button></div>`;
};
