'use strict';
/* Forest rewards: coins and XP come only from real study (focus sessions of
   10+ minutes, ticked-off blocks, finished SACs), so an idle timer earns
   little. Coins buy lucky boxes that unlock trees, animals, decorations and
   forest scenes. Earned coins are worked out from the planner data each time,
   so ticking a block on and off can't farm coins. */

const COIN = '🪙';
const RARITY = {
  common: { name: 'Common', color: '#868e96', refund: 10 },
  rare: { name: 'Rare', color: '#228be6', refund: 30 },
  epic: { name: 'Epic', color: '#9c36b5', refund: 80 },
  legendary: { name: 'Legendary', color: '#f59f00', refund: 200 },
};
const ITEMS = [
  // trees (new species for "Your trees")
  { id: 'sp_cactus', type: 'tree', name: 'Cactus', rarity: 'rare', species: 'cactus' },
  { id: 'sp_mushroom', type: 'tree', name: 'Giant mushroom', rarity: 'rare', species: 'mushroom' },
  { id: 'sp_baobab', type: 'tree', name: 'Baobab', rarity: 'epic', species: 'baobab' },
  { id: 'sp_crystal', type: 'tree', name: 'Crystal tree', rarity: 'epic', species: 'crystal' },
  { id: 'sp_rainbow', type: 'tree', name: 'Rainbow tree', rarity: 'legendary', species: 'rainbow' },
  { id: 'sp_candy', type: 'tree', name: 'Candy tree', rarity: 'epic', species: 'candy' },
  { id: 'sp_golden', type: 'tree', name: 'Golden tree', rarity: 'legendary', species: 'golden' },
  // decorations
  { id: 'd_rock', type: 'deco', name: 'Mossy rocks', rarity: 'common', at: [95, 405] },
  { id: 'd_flowers', type: 'deco', name: 'Wildflowers', rarity: 'common', at: [930, 420] },
  { id: 'd_bush', type: 'deco', name: 'Berry bush', rarity: 'common', at: [40, 330] },
  { id: 'd_log', type: 'deco', name: 'Fallen log', rarity: 'common', at: [330, 428] },
  { id: 'd_shrooms', type: 'deco', name: 'Toadstools', rarity: 'common', at: [720, 418] },
  { id: 'd_bench', type: 'deco', name: 'Park bench', rarity: 'rare', at: [860, 352] },
  { id: 'd_pond', type: 'deco', name: 'Lily pond', rarity: 'rare', at: [560, 425] },
  { id: 'd_lantern', type: 'deco', name: 'Lantern', rarity: 'rare', at: [215, 360] },
  { id: 'd_campfire', type: 'deco', name: 'Campfire', rarity: 'rare', at: [455, 405] },
  { id: 'd_tent', type: 'deco', name: 'Tent', rarity: 'epic', at: [140, 300] },
  { id: 'd_cabin', type: 'deco', name: 'Log cabin', rarity: 'epic', at: [905, 290] },
  // animals
  { id: 'a_butterfly', type: 'animal', name: 'Butterflies', rarity: 'common' },
  { id: 'a_rabbit', type: 'animal', name: 'Rabbit', rarity: 'rare', at: [640, 395] },
  { id: 'a_birds', type: 'animal', name: 'Birds', rarity: 'rare' },
  { id: 'a_fox', type: 'animal', name: 'Fox', rarity: 'epic', at: [270, 395] },
  { id: 'a_deer', type: 'animal', name: 'Deer', rarity: 'epic', at: [780, 330] },
  { id: 'a_owl', type: 'animal', name: 'Owl', rarity: 'legendary', at: [975, 415] },
  // forest scenes
  { id: 's_autumn', type: 'scene', name: 'Autumn', rarity: 'rare', scene: 'autumn' },
  { id: 's_spring', type: 'scene', name: 'Cherry spring', rarity: 'rare', scene: 'spring' },
  { id: 's_winter', type: 'scene', name: 'Winter', rarity: 'epic', scene: 'winter' },
  { id: 's_aurora', type: 'scene', name: 'Aurora night', rarity: 'legendary', scene: 'aurora' },
  { id: 's_golden', type: 'scene', name: 'Golden hour', rarity: 'rare', scene: 'golden' },
  { id: 's_tropical', type: 'scene', name: 'Tropical island', rarity: 'epic', scene: 'tropical' },
  { id: 's_sunset', type: 'scene', name: 'Sunset glow', rarity: 'rare', scene: 'sunset' },
  { id: 's_lavender', type: 'scene', name: 'Lavender fields', rarity: 'rare', scene: 'lavender' },
  { id: 's_rainy', type: 'scene', name: 'Rainy day', rarity: 'rare', scene: 'rainy' },
  { id: 's_desert', type: 'scene', name: 'Desert dunes', rarity: 'epic', scene: 'desert' },
  { id: 's_outback', type: 'scene', name: 'Red outback', rarity: 'epic', scene: 'outback' },
  { id: 's_starry', type: 'scene', name: 'Starry night', rarity: 'legendary', scene: 'starry' },
  // more decorations and animals
  { id: 'd_sign', type: 'deco', name: 'Signpost', rarity: 'common', at: [600, 300] },
  { id: 'd_picnic', type: 'deco', name: 'Picnic blanket', rarity: 'common', at: [380, 352] },
  { id: 'd_well', type: 'deco', name: 'Wishing well', rarity: 'rare', at: [60, 420] },
  { id: 'd_windmill', type: 'deco', name: 'Windmill', rarity: 'epic', at: [700, 282] },
  { id: 'd_balloon', type: 'deco', name: 'Hot air balloon', rarity: 'legendary' },
  { id: 'a_cat', type: 'animal', name: 'Cat', rarity: 'common', at: [520, 360] },
  { id: 'a_duck', type: 'animal', name: 'Ducks', rarity: 'rare', at: [600, 422] },
  // v2.8 shop additions
  { id: 'd_flag', type: 'deco', name: 'Pennant flag', rarity: 'common', at: [985, 330] },
  { id: 'd_swing', type: 'deco', name: 'Tire swing', rarity: 'common', at: [255, 330] },
  { id: 'd_telescope', type: 'deco', name: 'Telescope', rarity: 'rare', at: [170, 428] },
  { id: 'd_fountain', type: 'deco', name: 'Fountain', rarity: 'rare', at: [505, 352] },
  { id: 'd_stall', type: 'deco', name: 'Lemonade stand', rarity: 'rare', at: [800, 428] },
  { id: 'd_treehouse', type: 'deco', name: 'Treehouse', rarity: 'epic', at: [330, 300] },
  { id: 'd_statue', type: 'deco', name: 'Golden statue', rarity: 'legendary', at: [455, 300] },
  { id: 'a_hedgehog', type: 'animal', name: 'Hedgehog', rarity: 'common', at: [420, 432] },
  { id: 'a_squirrel', type: 'animal', name: 'Squirrel', rarity: 'common', at: [880, 425] },
  { id: 'a_peacock', type: 'animal', name: 'Peacock', rarity: 'epic', at: [690, 405] },
  { id: 'a_unicorn', type: 'animal', name: 'Unicorn', rarity: 'legendary', at: [140, 362] },
];
const BOXES = [
  { id: 'wood', name: 'Wooden box', price: 60, odds: { common: 70, rare: 25, epic: 4.5, legendary: .5 }, colors: ['#b07a46', '#8a5a2e', '#e0b47a'] },
  { id: 'silver', name: 'Silver box', price: 150, odds: { common: 35, rare: 45, epic: 17, legendary: 3 }, colors: ['#adb5bd', '#6c757d', '#f1f3f5'] },
  { id: 'gold', name: 'Golden box', price: 350, odds: { common: 0, rare: 40, epic: 45, legendary: 15 }, colors: ['#fcc419', '#e67700', '#fff3bf'] },
  { id: 'seed', name: 'Seed pouch', price: 25, odds: { common: 90, rare: 10 }, colors: ['#8ce99a', '#2f9e44', '#d3f9d8'], note: 'Cheap and cheerful' },
  { id: 'deco', name: 'Decor crate', price: 120, odds: { common: 50, rare: 35, epic: 12, legendary: 3 }, types: ['deco'], colors: ['#ffa8a8', '#c92a2a', '#fff5f5'], note: 'Decorations only' },
  { id: 'animal', name: 'Animal crate', price: 180, odds: { common: 30, rare: 45, epic: 20, legendary: 5 }, types: ['animal'], colors: ['#ffc078', '#d9480f', '#fff4e6'], note: 'Animals only' },
  { id: 'tree', name: 'Tree chest', price: 220, odds: { common: 0, rare: 50, epic: 38, legendary: 12 }, types: ['tree'], colors: ['#69db7c', '#2b8a3e', '#ebfbee'], note: 'Rare trees only' },
  { id: 'scene', name: 'Scene capsule', price: 300, odds: { common: 0, rare: 55, epic: 30, legendary: 15 }, types: ['scene'], colors: ['#74c0fc', '#1864ab', '#e7f5ff'], note: 'Forest scenes only' },
  { id: 'mythic', name: 'Mythic box', price: 800, odds: { common: 0, rare: 0, epic: 60, legendary: 40 }, colors: ['#da77f2', '#862e9c', '#f8f0fc'], note: 'Epic or better' },
];
const boxPrice = b => Math.round(b.price * (1 - .1 * upg('discount')));
const LEVELS = ['Seedling', 'Sprout', 'Sapling', 'Grove keeper', 'Forester', 'Ranger', 'Woodland sage', 'Forest guardian', 'Ancient oak', 'Legend of the forest'];

const itemById = id => ITEMS.find(i => i.id === id);
const owned = id => (D.game.items[id] || 0) > 0;
const creditMins = l => l.mins >= 10 ? Math.min(l.mins, 120) : 0; // cap so a forgotten timer can't pay out

function dailyMins() { const m = {}; for (const l of D.focusLogs) m[l.date] = (m[l.date] || 0) + l.mins; return m; }
// coin multiplier for one focus session, from upgrades and critter buffs
// (only buffs you had when the session started count, so new buffs don't pay out on old trees)
function coinMult(l) {
  let m = 1 + .05 * upg('magnet', l) + (crit('bee', l) ? .05 : 0) + (crit('platypus', l) ? .1 : 0) + (treeBuff(l).coin || 0);
  const h = new Date(l.start).getHours();
  if (crit('kookaburra', l) && h < 12) m += .1;
  if (crit('fireflies', l) && h >= 19) m += .1;
  return m;
}
function sessionCoins(l) {
  if (l.mins < 10) return 0;
  const c = Math.min(l.mins, 120 + 30 * upg('longer', l)) * coinMult(l) + (l.mins >= 45 ? 10 : 0) + (l.mins >= 90 && crit('wombat', l) ? 20 : 0) + (treeBuff(l).flat ? treeBuff(l).flat(l) : 0);
  const gold = l.mins >= 25 && upg('goldseed', l) && seeded('gold' + l.id)() < .15 ? 25 : 0;
  return Math.round((l.withered ? c / 2 : c) + gold); // a withered tree (too many distractions) pays half
}
function coinsEarned() {
  let c = 100; // welcome gift: enough for your first box
  for (const l of D.focusLogs) c += sessionCoins(l);
  c += Object.entries(dailyMins()).filter(([, m]) => m >= 30).reduce((a, [d]) => a + (crit('echidna', { start: d + 'T23:59' }) ? 10 : 5), 0); // daily study goal
  c += D.sessions.filter(x => x.done).length * 5 + D.assessments.filter(x => x.done).length * 25 + D.workouts.filter(x => x.done).length * 5 + (D.todos || []).filter(x => x.done).length * 2;
  c += Object.values(D.game.claimed).reduce((a, b) => a + (+b || 0), 0);
  c += Object.values(D.game.ledger || {}).reduce((a, b) => a + (+b || 0), 0);
  return c + (D.game.bonus || 0);
}
const coins = () => Math.max(0, coinsEarned() - (D.game.spent || 0));
function xpTotal() {
  return Math.round(D.focusLogs.reduce((a, l) => a + creditMins(l) * (1 + (crit('kangaroo', l) ? .1 : 0) + (treeBuff(l).xp || 0) + .1 * upg('wise', l)), 0) + D.sessions.filter(x => x.done).length * 10 + D.assessments.filter(x => x.done).length * 50 + D.workouts.filter(x => x.done).length * 5);
}
// level n needs 30*n*(n-1) XP: 60 for level 2, 180 for 3, 360 for 4 ...
function levelInfo(xp = xpTotal()) {
  let n = 1; while (30 * (n + 1) * n <= xp) n++;
  const lo = 30 * n * (n - 1), hi = 30 * (n + 1) * n;
  return { n, title: LEVELS[Math.min(n - 1, LEVELS.length - 1)], xp, into: xp - lo, need: hi - lo };
}

// ---------- challenges ----------
function challengeDefs() {
  const t = today(), wk = mondayOf(t), wkEnd = addDays(wk, 6);
  const logsT = D.focusLogs.filter(l => l.date === t), logsW = D.focusLogs.filter(l => l.date >= wk && l.date <= wkEnd);
  const minsT = logsT.reduce((a, l) => a + l.mins, 0), minsW = logsW.reduce((a, l) => a + l.mins, 0);
  const before = D.focusLogs.filter(l => l.date >= wk && l.date < t);
  const weakest = D.subjects.length ? D.subjects.map(s => [s, before.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.mins, 0)]).sort((a, b) => a[1] - b[1])[0][0] : null;
  const dm = dailyMins();
  const daily = [
    { id: 'm45', text: 'Study for 45 minutes today', reward: 30, have: minsT, need: 45, unit: 'm' },
    { id: 'm90', text: 'Study for 90 minutes today', reward: 60, have: minsT, need: 90, unit: 'm' },
    { id: 'full', text: 'Grow a full tree (one 45-minute session)', reward: 40, have: Math.max(0, ...logsT.map(l => l.mins)), need: 45, unit: 'm' },
    { id: 'tick2', text: 'Tick off 2 study blocks today', reward: 25, have: D.sessions.filter(x => x.date === t && x.done).length, need: 2 },
    { id: 'two', text: 'Study 2 different subjects today', reward: 25, have: new Set(logsT.filter(l => l.mins >= 10).map(l => l.subjectId)).size, need: 2 },
    { id: 'early', text: 'Finish a 20+ minute session before 5pm', reward: 20, have: logsT.filter(l => l.mins >= 20 && new Date(l.start).getHours() < 17).length, need: 1 },
    { id: 'perfect', text: 'Perfect day: tick off every study block planned today', reward: 30, have: D.sessions.filter(x => x.date === t && x.done).length, need: Math.max(1, D.sessions.filter(x => x.date === t).length) },
    { id: 'move', text: 'Get a workout done today', reward: 15, have: D.workouts.filter(x => x.date === t && x.done).length, need: 1 },
    ...(weakest ? [{ id: 'weak', text: `Give ${weakest.name} some love: 25 minutes today`, reward: 35, have: logsT.filter(l => l.subjectId === weakest.id).reduce((a, l) => a + l.mins, 0), need: 25, unit: 'm' }] : []),
  ];
  const rnd = seeded('daily' + t);
  const picks = daily.map(d => [rnd(), d]).sort((a, b) => a[0] - b[0]).slice(0, 3 + upg('extra') + (crit('lyrebird') ? 1 : 0)).map(x => x[1]);
  const weekly = [
    { id: 'h5', text: 'Study 5 hours this week', reward: 150, have: minsW, need: 300, unit: 'm' },
    { id: 'd5', text: 'Hit 30 minutes on 5 days this week', reward: 120, have: Array.from({ length: 7 }, (_, i) => dm[addDays(wk, i)] || 0).filter(m => m >= 30).length, need: 5 },
    { id: 't10', text: 'Plant 10 trees this week', reward: 100, have: logsW.filter(l => l.mins >= 10).length, need: 10 },
  ];
  return [...picks.map(c => ({ ...c, key: `d:${t}:${c.id}`, kind: 'Today' })), ...weekly.map(c => ({ ...c, key: `w:${wk}:${c.id}`, kind: 'This week' }))];
}
const claimable = () => challengeDefs().filter(c => c.have >= c.need && !(c.key in D.game.claimed)).length;
function claimChallenge(key) {
  const c = challengeDefs().find(x => x.key === key);
  if (!c || c.have < c.need || key in D.game.claimed) return;
  D.game.claimed[key] = Math.round(c.reward * (crit('koala') ? 1.1 : 1)); save(); render();
}

// ---------- lucky boxes ----------
function rollItem(box) {
  const odds = { ...box.odds }, luck = upg('luck') * 4; // lucky charm moves odds from common to rare/epic
  if (odds.common) { const mv = Math.min(odds.common, luck); odds.common -= mv; odds.rare = (odds.rare || 0) + mv * .6; odds.epic = (odds.epic || 0) + mv * .4; }
  let r = Math.random() * 100, rarity = 'common';
  for (const [k, p] of Object.entries(odds)) { if (r < p) { rarity = k; break; } r -= p; }
  let pool = ITEMS.filter(i => i.rarity === rarity && (!box.types || box.types.includes(i.type)));
  if (!pool.length) pool = ITEMS.filter(i => !box.types || box.types.includes(i.type));
  const fresh = pool.filter(i => !owned(i.id));
  // a little kindness: new items are twice as likely as duplicates
  const weighted = [...pool, ...fresh];
  return weighted[Math.floor(Math.random() * weighted.length)];
}
function openBox(boxId) {
  const cur = 'coin'; // lucky boxes are coins only
  const box = BOXES.find(b => b.id === boxId);
  if (!box || (cur === 'leaf' ? leaves() : coins()) < boxPrice(box)) return;
  const item = rollItem(box);
  const dupe = owned(item.id);
  if (cur === 'leaf') spendLeaves(boxPrice(box)); else D.game.spent += boxPrice(box);
  D.game.items[item.id] = (D.game.items[item.id] || 0) + 1;
  D.game.opened = (D.game.opened || 0) + 1;
  if (dupe) D.game.bonus = (D.game.bonus || 0) + RARITY[item.rarity].refund;
  save();
  boxAnimation(box, item, dupe, cur);
}
function boxSvg(box, size = 120) {
  const [c1, c2, c3] = box.colors;
  return `<svg viewBox="-60 -70 120 120" width="${size}" height="${size}" aria-hidden="true">
    <ellipse cx="0" cy="42" rx="44" ry="7" fill="rgba(0,0,0,.15)"/>
    <rect x="-42" y="-8" width="84" height="48" rx="6" fill="${c1}"/><rect x="-42" y="-8" width="84" height="48" rx="6" fill="url(#bx${box.id})"/>
    <rect x="-8" y="-8" width="16" height="48" fill="${c3}" opacity=".9"/>
    <g class="lid"><rect x="-48" y="-26" width="96" height="20" rx="6" fill="${c2}"/><rect x="-9" y="-26" width="18" height="20" fill="${c3}"/>
      <path d="M0 -26 C-22 -50 -34 -30 -8 -26 Z M0 -26 C22 -50 34 -30 8 -26 Z" fill="${c3}" stroke="${c2}" stroke-width="2"/></g>
    <text x="0" y="24" text-anchor="middle" font-size="20" font-weight="800" fill="${c2}" opacity=".7">?</text>
    <defs><linearGradient id="bx${box.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs></svg>`;
}
// Multi-stage unboxing: the box drops in, shakes harder while it glows in the
// prize's rarity colour, bursts open with a flash and the prize rises out of it.
// Shared by garden boxes and Arena boxes. Click during the build-up to skip.
function revealFx({ boxHtml, rarity, prizeHtml, title, text, buttons = '', onButton }) {
  const rc = RARITY[rarity] || RARITY.common, tier = ['common', 'rare', 'epic', 'legendary'].indexOf(rarity);
  const ov = document.createElement('div');
  ov.className = `boxfx unbox r-${rarity}`;
  ov.style.setProperty('--rc', rc.color);
  const confetti = Array.from({ length: 30 + tier * 20 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1) * 300}px;--y:${-120 - Math.random() * 280}px;--r:${Math.random() * 720}deg;--d:${(.9 + Math.random() * .9).toFixed(2)}s;background:${['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#da77f2', rc.color, rc.color][i % 7]}"></i>`).join('');
  const sparks = Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 360 / 14}deg;--dl:${(Math.random() * .9).toFixed(2)}s"></i>`).join('');
  ov.innerHTML = `<div class="flash"></div><div class="boxstage"><div class="rays"></div><div class="beam"></div><div class="ring"></div>
    <div class="thebox"><div class="glow"></div><div class="sparks">${sparks}</div>${boxHtml}</div>
    <div class="reveal"><div class="prize">${prizeHtml}</div><div class="rar">${'★'.repeat(tier + 1)} ${rc.name}</div><h2>${esc(title)}</h2>
      <p>${text}</p><div class="row" style="justify-content:center">${buttons}<button class="btn primary" data-close>Nice!</button></div></div>
    <div class="confetti">${confetti}</div>${tier === 3 ? `<div class="goldrain">${Array.from({ length: 26 }, () => `<i style="left:${Math.random() * 100}%;--d:${(1.6 + Math.random() * 1.8).toFixed(2)}s;--dl:${(Math.random() * 1.5).toFixed(2)}s">✦</i>`).join('')}</div>` : ''}</div>`;
  document.body.appendChild(ov);
  const timers = [];
  const stage = (cls, ms) => timers.push(setTimeout(() => ov.classList.add(cls), ms));
  const open = () => { timers.forEach(clearTimeout); ov.classList.add('charge', 'burst', 'opened'); };
  stage('charge', 450); stage('burst', 2100); stage('opened', 2350);
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); render(); };
  ov.addEventListener('click', e => {
    if (!ov.classList.contains('opened')) return open();
    if (e.target.closest('[data-close]') || e.target === ov) return close();
    const b = e.target.closest('[data-again]');
    if (b && onButton) { ov.remove(); onButton(b.dataset.again); }
  });
  return ov;
}
function boxAnimation(box, item, dupe, cur = 'coin') {
  const p = boxPrice(box), canAgain = cur === 'leaf' ? leaves() >= p : coins() >= p, sym = cur === 'leaf' ? LEAF : COIN;
  revealFx({ boxHtml: boxSvg(box, 170), rarity: item.rarity, prizeHtml: itemIcon(item, 150), title: item.name,
    text: dupe ? `You already had this, so you get ${RARITY[item.rarity].refund} ${COIN} back.` : itemBlurb(item),
    buttons: canAgain ? `<button class="btn" data-again="${box.id}">Open another (${p} ${sym})</button>` : '',
    onButton: id => openBox(id, cur) });
}
function itemBlurb(item) {
  return item.type === 'tree' ? `New tree unlocked! Pick it for a subject under "Your trees". It grows leaves ×${LEAF_RARITY[item.rarity]} faster.`
    : item.type === 'scene' ? 'New forest scene! Switch to it in your Collection.'
    : item.type === 'animal' ? 'A new friend has moved into your forest.' : 'Added to your forest.';
}

// ---------- drawings ----------
function decoSvg(id) {
  switch (id) {
    case 'd_flag': return `<rect x="-1.5" y="-60" width="3" height="60" fill="#868e96"/><path d="M1.5 -60 L30 -52 L1.5 -44Z" fill="#e03131" class="sway"/>`;
    case 'd_swing': return `<path d="M-30 -70 Q0 -78 30 -70" stroke="#6b4423" stroke-width="7" fill="none"/><g class="sway"><path d="M0 -72 L0 -26" stroke="#adb5bd" stroke-width="1.6"/><ellipse cx="0" cy="-18" rx="11" ry="8" fill="none" stroke="#343a40" stroke-width="5"/></g>`;
    case 'd_telescope': return `<path d="M-10 0 L0 -18 L10 0" stroke="#495057" stroke-width="2.4" fill="none"/><g transform="translate(0 -20) rotate(-30)"><rect x="-16" y="-4" width="34" height="8" rx="3" fill="#364fc7"/><rect x="16" y="-5" width="5" height="10" rx="2" fill="#fcc419"/></g>`;
    case 'd_fountain': return `<ellipse cx="0" cy="-4" rx="30" ry="8" fill="#adb5bd"/><ellipse cx="0" cy="-7" rx="25" ry="5" fill="#74c0fc"/><rect x="-3" y="-30" width="6" height="24" fill="#ced4da"/><ellipse cx="0" cy="-30" rx="10" ry="3" fill="#ced4da"/><g class="flutter"><path d="M0 -32 Q-10 -44 -16 -24 M0 -32 Q10 -44 16 -24" stroke="#a5d8ff" stroke-width="2" fill="none"/></g>`;
    case 'd_stall': return `<rect x="-24" y="-22" width="48" height="22" fill="#ffe066"/><rect x="-24" y="-22" width="48" height="4" fill="#f08c00"/><path d="M-28 -44 L28 -44 L24 -34 L-24 -34Z" fill="#fa5252"/><path d="M-14 -44 L-12 -34 M0 -44 L0 -34 M14 -44 L12 -34" stroke="#fff" stroke-width="4"/><rect x="-22" y="-34" width="3" height="14" fill="#8a5a2e"/><rect x="19" y="-34" width="3" height="14" fill="#8a5a2e"/><text x="0" y="-8" font-size="8" text-anchor="middle" font-weight="800" fill="#8a5a2e">LEMONADE</text>`;
    case 'd_treehouse': return `<rect x="-5" y="-60" width="10" height="60" fill="#6b4423"/>${c(0, -95, 34, '#2f9e44')}${c(-22, -80, 22, '#37b24d')}${c(22, -82, 22, '#40c057')}<rect x="-20" y="-78" width="40" height="26" fill="#b07a46" stroke="#6b4423" stroke-width="2"/><path d="M-24 -78 L0 -94 L24 -78Z" fill="#c92a2a"/><rect x="-5" y="-70" width="10" height="10" fill="#74c0fc"/><path d="M14 -52 L14 0 M20 -52 L20 0 M14 -40 L20 -40 M14 -28 L20 -28 M14 -16 L20 -16" stroke="#8a5a2e" stroke-width="2"/>`;
    case 'd_statue': return `<rect x="-16" y="-14" width="32" height="14" fill="#868e96"/><rect x="-12" y="-20" width="24" height="6" fill="#adb5bd"/>${c(0, -58, 8, '#fcc419')}<path d="M-8 -50 L8 -50 L10 -20 L-10 -20Z" fill="#f59f00"/><path d="M8 -46 L20 -62 M-8 -46 L-16 -34" stroke="#f59f00" stroke-width="5" stroke-linecap="round"/><path d="M20 -66 L22 -72 L24 -66" fill="#fff3bf"/>`;
    case 'a_hedgehog': return `<path d="M-14 0 Q-16 -16 0 -18 Q14 -18 14 -4 Z" fill="#6b4423"/>${[-10, -5, 0, 5].map(x => `<path d="M${x} -14 l-3 -6 l5 3z" fill="#4a2f17"/>`).join('')}<path d="M10 -6 Q20 -6 18 0 L10 0Z" fill="#e0b47a"/>${c(15, -4, 1.1, '#212529')}`;
    case 'a_squirrel': return `<g class="sway"><path d="M-6 -6 Q-22 -10 -16 -30 Q-8 -36 -6 -24 Q-10 -16 -2 -10Z" fill="#d9480f"/></g><ellipse cx="2" cy="-8" rx="8" ry="9" fill="#e8590c"/>${c(6, -20, 6, '#e8590c')}<path d="M4 -26 l1 -5 l3 4z" fill="#e8590c"/>${c(8, -21, 1, '#212529')}<ellipse cx="9" cy="-8" rx="3" ry="2.4" fill="#8a5a2e"/>`;
    case 'a_peacock': return `<g class="sway">${[-60, -40, -20, 0, 20, 40, 60].map(a => `<g transform="rotate(${a})"><ellipse cx="0" cy="-34" rx="7" ry="22" fill="#2b8a3e"/>${c(0, -48, 4, '#1c7ed6')}${c(0, -48, 2, '#fcc419')}</g>`).join('')}</g><ellipse cx="0" cy="-10" rx="7" ry="11" fill="#1864ab"/>${c(0, -26, 5, '#1c7ed6')}<path d="M4 -26 l6 1 l-6 2z" fill="#f59f00"/>${c(2, -27, 1, '#fff')}`;
    case 'a_unicorn': return `<ellipse cx="0" cy="-22" rx="20" ry="11" fill="#fff" stroke="#e9ecef"/><rect x="-14" y="-14" width="5" height="14" fill="#fff"/><rect x="8" y="-14" width="5" height="14" fill="#fff"/><path d="M14 -28 L24 -46 L32 -40 L22 -24Z" fill="#fff"/><path d="M27 -46 L36 -64 L31 -44Z" fill="#fcc419"/><path d="M16 -38 Q8 -44 6 -30 Q10 -34 14 -30 Q14 -36 20 -36Z" fill="#f783ac"/><g class="sway"><path d="M-20 -24 Q-32 -24 -30 -8" stroke="#da77f2" stroke-width="5" fill="none" stroke-linecap="round"/></g>${c(28, -44, 1.3, '#212529')}`;
    case 'd_rock': return `<path d="M-22 0 Q-24 -14 -10 -18 Q4 -24 14 -14 Q20 -6 18 0 Z" fill="#868e96"/><path d="M-10 -18 Q2 -22 10 -16 Q0 -13 -8 -13Z" fill="#adb5bd"/><path d="M-22 0 Q-20 -8 -12 -10 Q-6 -6 -8 0Z" fill="#69a84f"/><path d="M12 0 Q14 -9 22 -8 Q28 -4 26 0Z" fill="#7d838a"/>`;
    case 'd_flowers': return [[-14, '#ff6b6b'], [-5, '#ffd43b'], [4, '#cc5de8'], [13, '#ffffff'], [-9, '#ff922b'], [9, '#f783ac']].map(([x, f], i) => `<path d="M${x} 0 L${x + (i % 2 ? 1 : -1)} ${-12 - (i % 3) * 4}" stroke="#2b8a3e" stroke-width="1.6"/>${c(x + (i % 2 ? 1 : -1), -13 - (i % 3) * 4, 3.6, f)}${c(x + (i % 2 ? 1 : -1), -13 - (i % 3) * 4, 1.4, '#fff3bf')}`).join('');
    case 'd_bush': return `${c(-12, -10, 12, '#2f8a3e')}${c(10, -10, 12, '#2f8a3e')}${c(0, -18, 13, '#37a24a')}${[[-12, -14], [4, -22], [12, -8], [-2, -8], [-16, -4]].map(([x, y]) => c(x, y, 2.4, '#e03131')).join('')}`;
    case 'd_log': return `<rect x="-30" y="-12" width="56" height="12" rx="6" fill="#8a5a3b"/><path d="M-26 -9 h46 M-24 -4 h40" stroke="#6d4530" stroke-width="1.2"/><ellipse cx="26" cy="-6" rx="5" ry="6" fill="#d9a066"/><ellipse cx="26" cy="-6" rx="2.4" ry="3" fill="#b07a46"/>${c(-14, -13, 3, '#69a84f')}`;
    case 'd_shrooms': return [[-10, 1], [2, 1.3], [12, .8]].map(([x, s]) => `<g transform="translate(${x} 0) scale(${s})"><rect x="-1.8" y="-9" width="3.6" height="9" rx="1.5" fill="#fff4e6"/><path d="M-8 -8 Q0 -18 8 -8 Z" fill="#e03131"/>${c(-3, -11, 1.3, '#fff')}${c(3, -10, 1.1, '#fff')}</g>`).join('');
    case 'd_bench': return `<rect x="-26" y="-20" width="52" height="4" rx="1.5" fill="#a0673a"/><rect x="-26" y="-14" width="52" height="4" rx="1.5" fill="#8a5a2e"/><rect x="-28" y="-10" width="56" height="4" rx="1.5" fill="#b07a46"/><rect x="-22" y="-6" width="3" height="6" fill="#495057"/><rect x="19" y="-6" width="3" height="6" fill="#495057"/>`;
    case 'd_pond': return `<ellipse cx="0" cy="-4" rx="46" ry="11" fill="#4dabf7"/><ellipse cx="0" cy="-5" rx="40" ry="8" fill="#74c0fc"/><ellipse cx="-14" cy="-6" rx="9" ry="3" fill="#a5d8ff"/><path d="M14 -5 a6 3 0 1 0 1 -3 l-1 3z" fill="#40c057"/>${c(22, -7, 2, '#f783ac')}`;
    case 'd_lantern': return `<rect x="-1.5" y="-40" width="3" height="40" fill="#343a40"/><rect x="-6" y="-48" width="12" height="12" rx="2" fill="#ffd43b"/><path d="M-7 -48 h14 l-7 -6z" fill="#343a40"/>${c(0, -42, 14, 'rgba(255,212,59,.25)')}`;
    case 'd_campfire': return `<path d="M-14 0 L12 -6 M-12 -6 L14 0" stroke="#6d4530" stroke-width="4" stroke-linecap="round"/><g class="flame"><path d="M0 -4 C-10 -12 -4 -22 0 -30 C4 -22 10 -12 0 -4Z" fill="#ff922b"/><path d="M0 -5 C-5 -10 -2 -17 0 -21 C2 -17 5 -10 0 -5Z" fill="#ffd43b"/></g>${c(0, -14, 20, 'rgba(255,146,43,.18)')}`;
    case 'd_tent': return `<path d="M-30 0 L0 -40 L30 0 Z" fill="#fd7e14"/><path d="M0 -40 L30 0 L14 0 Z" fill="#e8590c"/><path d="M-8 0 L0 -18 L8 0Z" fill="#5c2b0c"/><path d="M0 -40 l0 -6" stroke="#495057" stroke-width="2"/>`;
    case 'd_cabin': return `<rect x="-30" y="-30" width="60" height="30" fill="#a0673a"/>${[-24, -18, -12, -6].map(y => `<path d="M-30 ${y} h60" stroke="#8a5a2e" stroke-width="1.5"/>`).join('')}<path d="M-36 -28 L0 -52 L36 -28 Z" fill="#7a2e1a"/><rect x="16" y="-56" width="7" height="14" fill="#5c5f66"/><rect x="-6" y="-18" width="12" height="18" fill="#5c3a21"/><rect x="-24" y="-22" width="11" height="10" fill="#ffe066" stroke="#5c3a21" stroke-width="1.5"/><rect x="13" y="-22" width="11" height="10" fill="#ffe066" stroke="#5c3a21" stroke-width="1.5"/>`;
    case 'a_rabbit': return `<g class="hop"><ellipse cx="0" cy="-8" rx="10" ry="8" fill="#f1f3f5"/>${c(9, -15, 6, '#f1f3f5')}<ellipse cx="7" cy="-27" rx="2.4" ry="8" fill="#f1f3f5"/><ellipse cx="11" cy="-26" rx="2.4" ry="8" fill="#e9ecef"/><ellipse cx="7" cy="-27" rx="1" ry="5" fill="#ffc9c9"/>${c(12, -16, 1.2, '#212529')}${c(-10, -9, 3.4, '#fff')}</g>`;
    case 'a_fox': return `<g class="sway"><path d="M-14 -10 C-30 -14 -34 -2 -22 0 C-18 -2 -16 -6 -14 -8Z" fill="#e8590c"/><path d="M-30 -6 C-33 -2 -27 1 -24 0Z" fill="#fff"/></g><ellipse cx="0" cy="-9" rx="15" ry="7" fill="#f76707"/><path d="M-8 -3 v5 M8 -3 v5" stroke="#343a40" stroke-width="2.5"/><path d="M10 -14 L24 -12 L14 -4 Z" fill="#f76707"/><path d="M12 -14 L13 -22 L17 -14Z M17 -14 L19 -21 L21 -13Z" fill="#d9480f"/><path d="M18 -10 L24 -12 L19 -7Z" fill="#fff"/>${c(17, -12, 1.1, '#212529')}`;
    case 'a_deer': return `<ellipse cx="0" cy="-20" rx="15" ry="8" fill="#a0673a"/>${[-10, -5, 6, 11].map(x => `<rect x="${x}" y="-14" width="2.6" height="14" fill="#8a5a2e"/>`).join('')}<path d="M10 -24 L16 -40 L22 -38 L16 -22Z" fill="#a0673a"/><ellipse cx="22" cy="-41" rx="7" ry="4.5" fill="#a0673a"/><path d="M18 -44 l-4 -10 m2 5 l-5 -2 M22 -44 l3 -10 m-1.5 5 l5 -2" stroke="#6d4530" stroke-width="1.6" fill="none"/>${c(24, -42, 1, '#212529')}${[[-6, -22], [0, -24], [5, -21]].map(([x, y]) => c(x, y, 1.4, '#f8f0e3')).join('')}`;
    case 'd_sign': return `<rect x="-2" y="-34" width="4" height="34" fill="#8a5a2e"/><path d="M-20 -32 h30 l6 5 l-6 5 h-30z" fill="#d9a066" stroke="#8a5a2e" stroke-width="1.5"/><path d="M20 -20 h-30 l-6 5 l6 5 h30z" fill="#c98a4e" stroke="#8a5a2e" stroke-width="1.5"/><path d="M-14 -27 h18 M-6 -15 h18" stroke="#6d4530" stroke-width="1.6"/>`;
    case 'd_picnic': return `<path d="M-30 -2 L-18 -16 L30 -16 L20 -2 Z" fill="#ff6b6b"/>${[-14, -2, 10].map(x => `<path d="M${x} -16 l-8 14" stroke="#fff" stroke-width="3" opacity=".85"/>`).join('')}<path d="M-26 -7 h50" stroke="#fff" stroke-width="2.4" opacity=".85"/><rect x="2" y="-24" width="14" height="10" rx="2" fill="#b07a46"/><path d="M4 -24 q5 -8 10 0" stroke="#8a5a2e" stroke-width="1.6" fill="none"/>${c(-8, -14, 3, '#e03131')}`;
    case 'd_well': return `<rect x="-16" y="-16" width="32" height="16" rx="3" fill="#adb5bd"/>${[-10, 0, 10].map(x => `<path d="M${x} -16 v16" stroke="#868e96" stroke-width="1.2"/>`).join('')}<ellipse cx="0" cy="-16" rx="16" ry="4" fill="#495057"/><ellipse cx="0" cy="-16" rx="12" ry="2.6" fill="#4dabf7"/><path d="M-13 -16 v-24 M13 -16 v-24" stroke="#8a5a2e" stroke-width="3"/><path d="M-20 -38 L0 -50 L20 -38 Z" fill="#c92a2a"/><path d="M0 -38 v12" stroke="#495057" stroke-width="1"/><rect x="-3" y="-28" width="6" height="5" fill="#8a5a2e"/>`;
    case 'd_windmill': return `<path d="M-12 0 L-7 -52 L7 -52 L12 0 Z" fill="#f1f3f5"/><path d="M-9 -52 L0 -64 L9 -52 Z" fill="#c92a2a"/><rect x="-4" y="-14" width="8" height="14" rx="4" fill="#8a5a2e"/><rect x="-3" y="-38" width="6" height="7" fill="#74c0fc"/><g transform="translate(0 -54)"><g class="spin">${[0, 90, 180, 270].map(a => `<g transform="rotate(${a})"><rect x="-2" y="-34" width="4" height="34" fill="#8a5a2e"/><rect x="2" y="-32" width="9" height="26" fill="#fff3bf" stroke="#d9a066" stroke-width="1"/></g>`).join('')}</g>${c(0, 0, 3.4, '#495057')}</g>`;
    case 'd_balloon': return `<path d="M-22 -60 C-22 -92 22 -92 22 -60 C22 -44 8 -34 4 -28 L-4 -28 C-8 -34 -22 -44 -22 -60Z" fill="#ff6b6b"/><path d="M-8 -86 C-14 -70 -10 -44 -4 -28 L4 -28 C10 -44 14 -70 8 -86 Q0 -90 -8 -86Z" fill="#ffd43b"/><path d="M-1.5 -88 C-3 -60 -2 -40 0 -28 C2 -40 3 -60 1.5 -88Z" fill="#4dabf7"/><path d="M-4 -28 L-6 -16 M4 -28 L6 -16" stroke="#6d4530" stroke-width="1"/><rect x="-7" y="-16" width="14" height="10" rx="2" fill="#a0673a"/>`;
    case 'a_cat': return `<g class="sway"><path d="M-12 -6 C-24 -8 -24 -24 -16 -26" stroke="#f08c00" stroke-width="3.4" fill="none" stroke-linecap="round"/></g><ellipse cx="0" cy="-8" rx="12" ry="8" fill="#ff922b"/>${c(10, -18, 7, '#ff922b')}<path d="M5 -23 L6 -31 L10 -24Z M11 -24 L15 -31 L16 -22Z" fill="#ff922b"/><path d="M6 -24 l1 -4 l2 3z M12 -24 l2.4 -4 l.6 3z" fill="#ffc9c9"/><g class="blink">${c(8, -19, 1.2, '#212529')}${c(13, -19, 1.2, '#212529')}</g><path d="M-6 -12 l0 -4 M-1 -13 l0 -4" stroke="#e8590c" stroke-width="1.6"/>${c(10.5, -16, .9, '#e64980')}`;
    case 'a_duck': return [[-12, 0, 1], [10, -2, .8]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="bob"><ellipse cx="0" cy="-5" rx="10" ry="6" fill="#fff"/>${c(7, -12, 5, '#2f9e44')}<path d="M11 -12 l6 1.4 l-6 1.6z" fill="#f59f00"/>${c(8, -13, 1, '#212529')}<path d="M-4 -6 q4 -4 8 0" stroke="#dee2e6" stroke-width="1.6" fill="none"/></g></g>`).join('');
    case 'a_owl': return `<path d="M-14 0 h28 l-3 -12 h-22z" fill="#8a5a3b"/><ellipse cx="0" cy="-12" rx="2" ry="1" fill="#6d4530"/><ellipse cx="0" cy="-24" rx="10" ry="13" fill="#7c5a3c"/><ellipse cx="0" cy="-20" rx="6" ry="8" fill="#d9b48a"/><path d="M-9 -34 l3 -6 l3 5z M9 -34 l-3 -6 l-3 5z" fill="#7c5a3c"/><g class="blink">${c(-4, -29, 4, '#fff')}${c(4, -29, 4, '#fff')}${c(-4, -29, 2, '#212529')}${c(4, -29, 2, '#212529')}</g><path d="M-1.5 -25 L0 -22 L1.5 -25Z" fill="#f59f00"/>`;
  }
  return '';
}
function skyCreatures() {
  let out = '';
  if (owned('a_birds')) out += `<g class="birds">${[[0, 0], [26, 10], [50, -4]].map(([x, y]) => `<path class="flap" d="M${x} ${y} q6 -6 12 0 q6 -6 12 0" stroke="#343a40" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('')}</g>`;
  if (owned('d_balloon') && !D.game.hidden.d_balloon) out += `<g class="balloon"><g transform="translate(300 150) scale(1.1)">${decoSvg('d_balloon')}</g></g>`;
  if (owned('a_butterfly')) out += [[230, 250, '#f783ac', 0], [610, 230, '#ffd43b', 2], [820, 270, '#74c0fc', 4]].map(([x, y, f, d]) => `<g transform="translate(${x} ${y})"><g class="flutter" style="animation-delay:-${d}s"><path class="wing" d="M0 0 C-10 -12 -14 2 0 2 C-10 4 -6 12 0 2 C6 12 10 4 0 2 C14 2 10 -12 0 0Z" fill="${f}"/><path d="M0 -3 v8" stroke="#343a40" stroke-width="1.4"/></g></g>`).join('');
  return out;
}
const SCENES = {
  meadow: { name: 'Meadow', hills: '#8fcf6b', g1: '#6cbf54', g2: '#58ad45' },
  autumn: { name: 'Autumn', hills: '#d9a05b', g1: '#c98a3e', g2: '#a8702c', fall: ['#e8590c', '#f59f00', '#c92a2a'] },
  spring: { name: 'Cherry spring', hills: '#a9e08a', g1: '#8fd46b', g2: '#74c056', fall: ['#ffc9de', '#fcc2d7', '#ffffff'] },
  winter: { name: 'Winter', hills: '#dbe7f3', g1: '#eef4fb', g2: '#d3e0ee', fall: ['#ffffff'], sky: ['#a9c3e0', '#eaf2fb'] },
  aurora: { name: 'Aurora night', hills: '#1f4a4a', g1: '#245a4a', g2: '#173f36', night: true },
  golden: { name: 'Golden hour', hills: '#c9b45a', g1: '#b5a844', g2: '#97903a', sky: ['#ffb36b', '#ffe8b0'], fall: ['#ffe066', '#fff3bf'] },
  tropical: { name: 'Tropical island', hills: '#3bc9db', g1: '#f2d49b', g2: '#e3bd78', sky: ['#4cc9f0', '#d0f4ff'] },
  sunset: { name: 'Sunset glow', hills: '#b5658a', g1: '#7d9c4a', g2: '#5f7f38', sky: ['#ff6f91', '#ffc38b'], fall: ['#ffd8a8'] },
  lavender: { name: 'Lavender fields', hills: '#b197fc', g1: '#9775fa', g2: '#7950f2', sky: ['#a5d8ff', '#f3f0ff'], fall: ['#e5dbff', '#d0bfff', '#ffffff'] },
  rainy: { name: 'Rainy day', hills: '#6f8f6a', g1: '#5c8a55', g2: '#4a7444', sky: ['#7d8b99', '#c5ced6'], fall: ['#a5d8ff'], rain: true },
  desert: { name: 'Desert dunes', hills: '#e9b872', g1: '#f2cf8d', g2: '#e0b064', sky: ['#74c0fc', '#fff3bf'] },
  outback: { name: 'Red outback', hills: '#c2410c', g1: '#d9622b', g2: '#b4501f', sky: ['#ffa94d', '#ffe8cc'] },
  starry: { name: 'Starry night', hills: '#2b3a67', g1: '#25466b', g2: '#1b3554', night: true, noAurora: true, sky: ['#05081a', '#1b2a5a'] },
};
function sceneSwatch(key, w = 64) {
  const s = SCENES[key];
  const sky = s.sky || (s.night ? ['#0b1a3a', '#24406e'] : ['#8fd0ff', '#e6f6ff']);
  return `<svg viewBox="0 0 64 44" width="${w}" height="${Math.round(w * 44 / 64)}" aria-hidden="true"><defs><linearGradient id="sw${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="64" height="44" rx="6" fill="url(#sw${key})"/>${s.night && !s.noAurora ? '<path d="M0 14 Q20 4 34 14 T64 10" stroke="#63e6be" stroke-width="4" fill="none" opacity=".7"/>' : ''}${s.noAurora ? [[8, 6], [20, 12], [36, 5], [50, 10], [58, 4], [28, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#fff"/>`).join('') : ''}
    <path d="M0 26 Q18 18 34 24 T64 22 V44 H0Z" fill="${s.hills}"/><path d="M0 31 Q30 26 64 30 V44 H0Z" fill="${s.g1}"/>
    ${s.fall ? [[10, 8], [30, 14], [50, 6], [20, 20], [44, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${s.fall[0]}"/>`).join('') : ''}</svg>`;
}
function itemIcon(item, size = 64) {
  if (item.type === 'tree') return `<svg viewBox="-60 -130 120 136" width="${size}" height="${size}" aria-hidden="true">${treeG(item.species, item.species === 'crystal' ? '#4dabf7' : '#40c057', 2, 'icon')}</svg>`;
  if (item.type === 'scene') return sceneSwatch(item.scene, size);
  if (item.id === 'a_birds') return `<svg viewBox="-10 -30 80 50" width="${size}" height="${size}">${[[0, 0], [26, 10], [50, -4]].map(([x, y]) => `<path d="M${x} ${y} q6 -6 12 0 q6 -6 12 0" stroke="#343a40" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}</svg>`;
  if (item.id === 'd_balloon') return `<svg viewBox="-30 -96 60 96" width="${size}" height="${size}" aria-hidden="true">${decoSvg('d_balloon')}</svg>`;
  if (item.id === 'a_butterfly') return `<svg viewBox="-20 -18 40 32" width="${size}" height="${size}"><path d="M0 0 C-10 -12 -14 2 0 2 C-10 4 -6 12 0 2 C6 12 10 4 0 2 C14 2 10 -12 0 0Z" fill="#f783ac"/><path d="M0 -3 v8" stroke="#343a40" stroke-width="1.4"/></svg>`;
  if (['d_treehouse', 'd_swing', 'd_flag', 'd_statue', 'a_peacock', 'a_unicorn'].includes(item.id)) return `<svg viewBox="-65 -132 130 138" width="${size}" height="${size}" aria-hidden="true">${decoSvg(item.id)}</svg>`;
  return `<svg viewBox="-50 -64 100 70" width="${size}" height="${size}" aria-hidden="true">${decoSvg(item.id)}</svg>`;
}
// Ground items (decorations, animals) for the scene, with positions; drawn in depth order with trees.
function groundItems() {
  return ITEMS.filter(i => i.at && owned(i.id) && !D.game.hidden[i.id]).map(i => ({ x: i.at[0], y: i.at[1], svg: decoSvg(i.id), id: i.id }));
}

// ---------- views ----------
function gameHeader() {
  const lv = levelInfo(), n = claimable();
  return `<div class="gamebar">
    <div class="lvl"><div class="lvbadge">${lv.n}</div><div class="lvtext"><b>${esc(lv.title)}</b><div class="lvtrack"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div><span class="muted small-text">${lv.into} / ${lv.need} XP to level ${lv.n + 1}</span></div></div>
    <div class="coins" title="Coins: from studying, ticking off blocks, finished SACs and challenges. Shared with the Arena.">${COIN} <b>${coins()}</b></div>
    <div class="coins leafpill" title="Leaves: grown by your trees, for the garden">${LEAF} <b>${fmtLeaf(leaves())}</b></div>
    ${n ? `<span class="tag green">${n} reward${n === 1 ? '' : 's'} to claim</span>` : ''}</div>`;
}
function challengesCard() {
  const list = challengeDefs();
  const row = c => {
    const done = c.key in D.game.claimed, ready = c.have >= c.need;
    const pct = Math.min(100, Math.round(c.have / c.need * 100));
    const prog = c.unit === 'm' ? `${fmtMins(Math.min(c.have, c.need)) || '0m'} / ${fmtMins(c.need)}` : `${Math.min(c.have, c.need)} / ${c.need}`;
    return `<li class="chal ${done ? 'done' : ready ? 'ready' : ''}"><div class="main"><div class="title">${esc(c.text)}</div><div class="ctrack"><i style="width:${pct}%"></i></div><span class="muted small-text">${prog}</span></div>
      ${done ? '<span class="tag green">✓ Claimed</span>' : ready ? `<button class="btn small primary claim" data-act="claim" data-id="${c.key}">Claim ${c.reward} ${COIN}</button>` : `<span class="reward">${c.reward} ${COIN}</span>`}</li>`;
  };
  return `<div class="card"><div class="card-head"><h2>Challenges</h2><span class="muted small-text">new ones every day</span></div>
    <div class="daygroup" style="margin-top:0">Today</div><ul class="chals">${list.filter(c => c.kind === 'Today').map(row).join('')}</ul>
    <div class="daygroup">This week</div><ul class="chals">${list.filter(c => c.kind === 'This week').map(row).join('')}</ul></div>`;
}
function boxesView() {
  const have = coins();
  return `<div class="card"><div class="card-head"><h2>Lucky boxes</h2><span class="muted small-text">coins only</span><span class="coins">${COIN} <b>${have}</b></span></div>
    <div class="boxes">${BOXES.map(b => { const p = boxPrice(b); return `<div class="boxcard ${have >= p ? '' : 'poor'}" style="--bc:${b.colors[0]}">
      <div class="boxart">${boxSvg(b, 120)}</div><h3>${b.name}</h3>${b.note ? `<div class="boxnote">${b.note}</div>` : ''}
      <div class="odds">${Object.entries(b.odds).filter(([, p]) => p).map(([r, p]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${p}%</span>`).join('')}</div>
      <button class="btn ${have >= p ? 'primary' : ''}" data-act="openBox" data-id="${b.id}" ${have >= p ? '' : 'disabled'}>Open · ${p} ${COIN}</button></div>`; }).join('')}</div></div>`;
}
// Coins and leaves buy different things: trees and animals cost coins, while
// decorations and scenes for the garden cost leaves. There's no swapping one
// for the other.
const STORE_PRICE = { common: 90, rare: 220, epic: 500, legendary: 1200 };
const LEAF_PRICE = { common: 120, rare: 300, epic: 700, legendary: 1500 };
const storeCur = i => i.type === 'deco' || i.type === 'scene' ? 'leaf' : 'coin';
const storePrice = i => (storeCur(i) === 'leaf' ? LEAF_PRICE : STORE_PRICE)[i.rarity];
function storeView() {
  const cat = ui.storeCat || 'tree';
  const cats = [['tree', `🌳 Trees · ${COIN}`], ['animal', `🦔 Animals · ${COIN}`], ['deco', `🏡 Decorations · ${LEAF}`], ['scene', `🌅 Scenes · ${LEAF}`]];
  const list = ITEMS.filter(i => i.type === cat).sort((a, b) => storePrice(a) - storePrice(b));
  const leafy = cat === 'deco' || cat === 'scene', have = leafy ? leaves() : coins(), sym = leafy ? LEAF : COIN;
  return `<div class="card"><div class="card-head"><h2>Item store</h2><span class="muted small-text">${leafy ? 'garden decorations and scenes are paid with leaves' : 'trees and animals are paid with coins'}</span><span class="coins">${sym} <b>${leafy ? fmtLeaf(have) : have}</b></span></div>
    <div class="seg" style="margin-bottom:10px">${cats.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-act="storeCat" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="storegrid">${list.map(i => { const p = storePrice(i), has = owned(i.id);
      return `<div class="storeitem ${has ? 'own' : ''}" style="--rc:${RARITY[i.rarity].color}"><div class="storeart">${itemIcon(i, 70)}</div><b>${esc(i.name)}</b><span class="small-text" style="color:${RARITY[i.rarity].color}">${RARITY[i.rarity].name}</span>
        ${has ? '<span class="tag green">✓ Owned</span>' : `<button class="btn small ${have >= p ? 'primary' : ''}" data-act="storeBuy" data-id="${i.id}" ${have >= p ? '' : 'disabled'}>${p} ${sym}</button>`}</div>`; }).join('')}</div></div>`;
}
function storeBuy(id) {
  const i = itemById(id); if (!i || owned(id)) return;
  const p = storePrice(i);
  if (storeCur(i) === 'leaf') { if (!spendLeaves(p)) return; } else { if (coins() < p) return; D.game.spent += p; }
  D.game.items[id] = 1; save(); render();
  toast(`✨ ${i.name} is yours`, i.type === 'scene' ? 'Pick it under Collection to change your forest.' : 'It\'s in your forest now.');
}
function earnCard() {
  const ways = [['⏱️', `1 ${COIN} a minute`, `in focus sessions of 10+ minutes (up to ${fmtMins(120 + 30 * upg('longer'))} each)`], ['🌳', '+10 a full tree', 'for a 45+ minute session'],
    ['📅', `+${crit('echidna') ? 10 : 5} a study day`, 'each day you study 30+ minutes'], ['✅', 'Ticking things off', '+5 a study block, +25 a SAC or exam, +5 a workout, +2 a task'],
    ['🏆', 'Challenges', '15 to 150 coins each'], ['🎁', 'Daily gift', 'free coins once a day'], ['💧', 'Water your trees', 'coins for each tree, once a day each'],
    ['🎖️', 'Milestones and critters', 'pay out once when you reach or find them'], ['📦', 'Duplicates', 'from boxes give coins back']];
  return `<div class="card"><div class="card-head"><h2>How to earn</h2></div>
    <div class="earngrid">${ways.map(([ic, t, d], i) => `<div class="earnitem" style="--i:${i}"><span>${ic}</span><div><b>${t}</b><div class="muted small-text">${d}</div></div></div>`).join('')}</div>
    <p class="muted small-text" style="margin:12px 0 0">${COIN} Coins buy lucky boxes, trees, animals and everything in the Arena. ${LEAF} Leaves are the garden's own money: your trees grow them every hour, and they buy garden upgrades, decorations and scenes. You can't swap one for the other.</p></div>`;
}
function collectionView() {
  const groups = [['tree', 'Trees'], ['animal', 'Animals'], ['deco', 'Decorations'], ['scene', 'Forest scenes']];
  const total = ITEMS.length, got = ITEMS.filter(i => owned(i.id)).length;
  const scenes = ['meadow', ...ITEMS.filter(i => i.type === 'scene' && owned(i.id)).map(i => i.scene)];
  return `<div class="card"><div class="card-head"><h2>Collection</h2><span class="muted">${got} / ${total} found</span></div>
    <div class="sceneset"><span class="muted small-text">Forest scene:</span>${scenes.map(k => `<button class="scenebtn ${D.game.scene === k ? 'on' : ''}" data-act="setScene" data-v="${k}" title="${SCENES[k].name}">${sceneSwatch(k, 58)}<span>${SCENES[k].name}</span></button>`).join('')}</div>
    ${groups.map(([t, label]) => `<div class="daygroup">${label}</div><div class="coll">${ITEMS.filter(i => i.type === t).map(i => {
      const has = owned(i.id), rc = RARITY[i.rarity];
      return `<div class="citem ${has ? '' : 'locked'}" style="--rc:${rc.color}" title="${has ? esc(i.name) : 'Not found yet'}">
        <div class="cicon">${itemIcon(i, 58)}</div><b>${has ? esc(i.name) : '???'}</b><span class="rar">${rc.name}${(D.game.items[i.id] || 0) > 1 ? ` · ×${D.game.items[i.id]}` : ''}</span>
        ${i.type === 'tree' ? `<span class="tbuff sm">${LEAF} ×${LEAF_RARITY[i.rarity]} leaves</span>` : ''}
        ${has && (i.type === 'deco' || i.at) ? `<label class="small-text muted"><input type="checkbox" data-change="showItem" data-id="${i.id}" ${D.game.hidden[i.id] ? '' : 'checked'}> show</label>` : ''}</div>`;
    }).join('')}</div>`).join('')}</div>`;
}

// coin / level change feedback, checked after each render
let lastCoins = null, lastLevel = null;
function gameFeedback() {
  if (!D || !D.game) return;
  if (typeof mountGarden3D === 'function') try { mountGarden3D(); } catch (e) { console.error(e); }
  if (typeof soundFeedback === 'function') soundFeedback();
  checkCritters();
  checkMissedDays();
  gnomeCollect();
  arenaFeedback();
  const now = coins(), lv = levelInfo().n;
  if (lastCoins !== null && now > lastCoins) {
    const el = document.createElement('div'); el.className = 'coinpop'; el.textContent = `+${now - lastCoins} ${COIN}`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
  }
  if (lastLevel !== null && lv > lastLevel) toast(`⭐ Level up! You're now level ${lv}`, `${levelInfo().title}. Keep growing that forest.`, { timeout: 9000 });
  lastCoins = now; lastLevel = lv;
  const ss = document.getElementById('sideStats');
  if (ss) { const L = levelInfo(); ss.innerHTML = `<div class="sstat"><div class="lvbadge">${L.n}</div><div style="flex:1;min-width:0"><b>${esc(L.title)}</b><div class="lvtrack"><i style="width:${Math.round(L.into / L.need * 100)}%"></i></div></div></div>
    <div class="sstat-row"><span title="Coins">${COIN} ${now}</span><span title="Day streak">🔥 ${studyStreak()}</span><span title="Critters found">🐾 ${Object.keys(D.game.critters || {}).length}</span></div>
    ${D.focus ? '<button class="btn small" data-act="focusMax">⏱ Back to timer</button>' : '<button class="btn small primary" data-act="focusNew">▶ Start studying</button>'}`; }
  const b = document.querySelector('#tabs button[data-view="forest"]');
  if (b) { const n = claimable() + rewardsWaiting(); b.dataset.badge = n || ''; }
}
