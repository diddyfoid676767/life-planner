'use strict';
/* Forest life: critters move in as the forest grows and each gives a small buff,
   upgrades are bought with coins, and every tree can be opened, named, starred
   and watered. Buffs only count for sessions after you got them, so a new buff
   never pays out again on old trees. */

// D.game.upgrades[id] is a list of purchase times (one per level); D.game.critters[id] is when it moved in
const upg = (id, l) => { const a = (D.game.upgrades || {})[id] || []; return l ? a.filter(t => String(l.start) >= t).length : a.length; };
const crit = (id, l) => { const at = (D.game.critters || {})[id]; return !!at && (!l || String(l.start) >= at) && !critAway(id, l); };
// a critter that wandered off after missed days gives no buff while it's away
const critAway = (id, l) => ((D.game.away || {})[id] || []).some(([a, b]) => l ? String(l.start) >= a && (!b || String(l.start) < b) : !b);

// Rare trees from lucky boxes give a small buff to the sessions grown as that tree
// (the tree type is saved on each session when it's logged, so only new sessions count).
const TREE_BUFFS = {
  cactus: { text: '+5 coins for sessions of 25+ minutes', flat: l => l.mins >= 25 ? 5 : 0 },
  mushroom: { text: '+10% XP', xp: .1 },
  candy: { text: '+10% coins', coin: .1 },
  baobab: { text: '+15 coins for sessions of 60+ minutes', flat: l => l.mins >= 60 ? 15 : 0 },
  crystal: { text: 'Watering gives double coins', water: 2 },
  rainbow: { text: '+15% coins and +10% XP', coin: .15, xp: .1 },
  golden: { text: '+20% coins', coin: .2 },
};
const treeBuff = l => (l && TREE_BUFFS[l.species]) || {};

const CRITTERS = [
  { id: 'bee', emoji: '🐝', name: 'Honey bees', how: 'Grow 5 trees', need: s => [s.trees, 5], buff: '+5% coins from study', at: [180, 230], fly: true },
  { id: 'kookaburra', emoji: '🐦', name: 'Kookaburra', how: 'Start a session before 8am', need: s => [s.early, 1], buff: '+10% coins for sessions before midday', at: [880, 190], fly: true },
  { id: 'koala', emoji: '🐨', name: 'Koala', how: 'Grow 10 trees', need: s => [s.trees, 10], buff: '+10% coins from challenges', at: [90, 300] },
  { id: 'echidna', emoji: '🦔', name: 'Echidna', how: 'Grow 15 trees', need: s => [s.trees, 15], buff: 'Daily study goal pays 10 instead of 5', at: [420, 425] },
  { id: 'possum', emoji: '🐿️', name: 'Possum', how: 'Grow trees for 4 different subjects', need: s => [s.subjects, 4], buff: '+10 coins on every daily gift', at: [760, 300] },
  { id: 'frog', emoji: '🐸', name: 'Green tree frog', how: 'Grow 20 trees', need: s => [s.trees, 20], buff: '+2 coins every time you water a tree', at: [575, 432] },
  { id: 'fireflies', emoji: '✨', name: 'Fireflies', how: 'Start a session at 8pm or later', need: s => [s.late, 1], buff: '+10% coins for sessions after 7pm', at: [640, 250], fly: true },
  { id: 'kangaroo', emoji: '🦘', name: 'Kangaroo', how: 'Grow 25 trees', need: s => [s.trees, 25], buff: '+10% XP from study', at: [300, 330] },
  { id: 'wombat', emoji: '🦡', name: 'Wombat', how: 'Grow 3 grand trees (90+ minutes)', need: s => [s.grand, 3], buff: '+20 coins for every grand tree', at: [840, 420] },
  { id: 'lyrebird', emoji: '🦚', name: 'Lyrebird', how: 'Reach a 7-day study streak', need: s => [s.best, 7], buff: '+1 daily challenge', at: [500, 318] },
  { id: 'platypus', emoji: '🦫', name: 'Platypus', how: 'Grow 50 trees', need: s => [s.trees, 50], buff: '+10% coins from study', at: [230, 432] },
];
const UPGRADES = [
  { id: 'magnet', icon: '🧲', name: 'Coin magnet', desc: '+5% coins from study per level', prices: [150, 300, 600] },
  { id: 'longer', icon: '⏳', name: 'Marathon roots', desc: 'Long sessions pay for 30 more minutes per level (cap starts at 2 hours)', prices: [200, 400] },
  { id: 'can', icon: '🚿', name: 'Watering can', desc: '+2 coins every time you water a tree, per level', prices: [100, 250] },
  { id: 'extra', icon: '🎯', name: 'Extra challenge', desc: 'One more daily challenge every day', prices: [250] },
  { id: 'shield', icon: '🛡️', name: 'Streak shield', desc: 'One missed day won\'t break your study streak', prices: [300] },
  { id: 'luck', icon: '🍀', name: 'Lucky charm', desc: 'Better odds in lucky boxes (4% more rare and epic per level)', prices: [250, 500] },
  { id: 'discount', icon: '🏷️', name: 'Box discount', desc: '10% off every lucky box', prices: [300] },
  { id: 'giftbig', icon: '🎁', name: 'Bigger gifts', desc: '+50% coins from the daily gift per level', prices: [200, 450] },
  { id: 'wise', icon: '🦉', name: 'Wise owl', desc: '+10% XP from study per level', prices: [200, 400] },
  { id: 'goldseed', icon: '🌰', name: 'Golden seeds', desc: 'Sessions of 25+ minutes have a 15% chance of a +25 coin bonus', prices: [350] },
];

// ---------- stats and critter discovery ----------
function forestStats() {
  const trees = D.focusLogs.filter(l => l.mins >= 10 && !l.withered);
  const hr = l => new Date(l.start).getHours();
  return {
    trees: trees.length, grand: trees.filter(l => l.mins >= 90).length,
    early: trees.filter(l => hr(l) < 8).length, late: trees.filter(l => hr(l) >= 20).length,
    best: bestStreak(), subjects: new Set(trees.map(l => l.subjectId)).size,
    hours: D.focusLogs.reduce((a, l) => a + l.mins, 0) / 60,
  };
}
function checkCritters() {
  if (!D.game.critters) return;
  const s = forestStats(), found = [];
  for (const k of CRITTERS) {
    if (D.game.critters[k.id]) continue;
    const [have, need] = k.need(s);
    if (have >= need) { D.game.critters[k.id] = new Date().toISOString(); D.game.ledger['c:' + k.id] = 50; found.push(k); }
  }
  if (found.length) { save(); setTimeout(() => critterArrives(found), 400); }
}
function celebrate({ icon, color = '#40c057', kicker, title, text }) {
  const ov = document.createElement('div');
  ov.className = 'boxfx opened';
  ov.style.setProperty('--rc', color);
  ov.innerHTML = `<div class="boxstage"><div class="rays"></div><div class="reveal"><div class="prize">${icon}</div><div class="rar">${kicker}</div><h2>${title}</h2><p>${text}</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>Nice!</button></div></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === ov) { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); render(); } });
}
function critterArrives(list) {
  const one = list.length === 1, k = list[0];
  celebrate({
    icon: `<span class="critbig">${list.map(x => x.emoji).join('')}</span>`, color: '#2f9e44',
    kicker: one ? 'A critter moved in!' : `${list.length} critters moved in!`,
    title: one ? esc(k.name) : list.map(x => esc(x.name)).join(', '),
    text: `${list.map(x => `<b>${x.emoji} ${esc(x.buff)}</b>`).join('<br>')}<br>+${50 * list.length} ${COIN} welcome bonus`,
  });
}
// critters living in the scene
function critterSprites() {
  return CRITTERS.filter(k => crit(k.id)).map((k, i) => `<g transform="translate(${k.at[0]} ${k.at[1]})"><text class="${k.fly ? 'critfly' : 'critbob'}" style="animation-delay:-${i * .7}s" font-size="${k.fly ? 24 : 30}" text-anchor="middle"><title>${esc(k.name)}: ${esc(k.buff)}</title>${k.emoji}</text></g>`).join('');
}

// ---------- daily gift and milestones ----------
const giftKey = () => 'gift:' + today();
const giftAmount = () => Math.round((10 + Math.floor(seeded('gift' + today())() * 21) + (crit('possum') ? 10 : 0)) * (1 + .5 * upg('giftbig')));
const giftReady = () => !(giftKey() in D.game.ledger);
function claimGift() {
  if (!giftReady()) return;
  const n = giftAmount(); D.game.ledger[giftKey()] = n; save(); render();
  toast(`🎁 Daily gift: +${n} ${COIN}`, 'Come back tomorrow for another one.');
}
function milestones() {
  const s = forestStats(), nc = Object.keys(D.game.critters || {}).length;
  return [
    ['first', '🌱', 'First tree', s.trees, 1, 20], ['t10', '🌳', '10 trees', s.trees, 10, 50], ['t50', '🌲', '50 trees', s.trees, 50, 150], ['t100', '🏞️', '100 trees', s.trees, 100, 300],
    ['grand', '🌸', 'A grand tree (90 min)', s.grand, 1, 50], ['s3', '🔥', '3-day streak', s.best, 3, 30], ['s7', '⚡', '7-day streak', s.best, 7, 80], ['s14', '🌟', '14-day streak', s.best, 14, 200],
    ['h10', '⏱️', '10 hours studied', s.hours, 10, 60], ['h50', '🏆', '50 hours studied', s.hours, 50, 200], ['h100', '👑', '100 hours studied', s.hours, 100, 400],
    ['c5', '🐾', '5 critters found', nc, 5, 100], ['call', '🦘', 'Every critter found', nc, CRITTERS.length, 300], ['b10', '🎁', '10 boxes opened', D.game.opened || 0, 10, 50],
  ].map(([id, e, name, have, need, reward]) => ({ id, e, name, have, need, reward, ok: have >= need, claimed: ('m:' + id) in D.game.ledger }));
}
function claimMilestone(id) {
  const m = milestones().find(x => x.id === id);
  if (!m || !m.ok || m.claimed) return;
  D.game.ledger['m:' + id] = m.reward; save(); render();
}
const rewardsWaiting = () => (giftReady() ? 1 : 0) + milestones().filter(m => m.ok && !m.claimed).length;

// ---------- upgrades ----------
function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id); if (!u) return;
  const lvl = upg(id), price = u.prices[lvl];
  if (price == null || coins() < price) return;
  D.game.spent += price;
  D.game.upgrades[id] = [...(D.game.upgrades[id] || []), new Date().toISOString()];
  save(); render();
  toast(`${u.icon} ${u.name}${u.prices.length > 1 ? ` level ${lvl + 1}` : ''}`, u.desc);
}

// ---------- your trees ----------
const NAME_A = ['Mossy', 'Sunny', 'Whispering', 'Brave', 'Old', 'Little', 'Golden', 'Quiet', 'Swift', 'Lucky', 'Misty', 'Proud', 'Gentle', 'Wild', 'Tall', 'Sleepy'];
const NAME_B = ['Fern', 'Acorn', 'Bramble', 'Willow', 'Pip', 'Maple', 'Sprout', 'Juniper', 'Hazel', 'Rowan', 'Basil', 'Clover', 'Ash', 'Bark', 'Twig', 'Elm'];
const treeRec = id => D.game.trees[id] || {};
function treeName(l) {
  const r = treeRec(l.id);
  if (r.name) return r.name;
  const rnd = seeded('name' + l.id);
  return NAME_A[Math.floor(rnd() * NAME_A.length)] + ' ' + NAME_B[Math.floor(rnd() * NAME_B.length)];
}
const waterCoins = l => (2 + 2 * upg('can') + (crit('frog') ? 2 : 0)) * (treeBuff(l).water || 1);
const wateredToday = () => Object.values(D.game.trees).filter(r => r.lastWater === today()).length;
function waterTree(id) {
  const l = D.focusLogs.find(x => x.id === id);
  if (!l || l.mins < 10) return 'gone';
  const r = D.game.trees[id] = { ...treeRec(id) };
  if (r.lastWater === today()) return 'done';
  if (wateredToday() >= 10) return 'limit';
  r.lastWater = today(); r.water = (r.water || 0) + 1; delete r.wilted;
  const k = 'w:' + today(); D.game.ledger[k] = (D.game.ledger[k] || 0) + waterCoins(l);
  save(); return 'ok';
}
function treeHeight(l) {
  return ((0.6 + Math.min(l.mins, 180) / 28) * (1 + .03 * Math.min(treeRec(l.id).water || 0, 30))).toFixed(1);
}
function treeCardHtml(l) {
  const s = subj(l.subjectId), r = treeRec(l.id), st = TREE_STAGES[treeStage(l.mins)][1];
  const start = new Date(l.start), end = new Date(start.getTime() + l.mins * 60000);
  const hm = d => fmtTime(d.toTimeString().slice(0, 5));
  const age = Math.max(0, Math.round((new Date(today()) - new Date(l.date)) / 864e5));
  const sess = l.sessionId && D.sessions.find(x => x.id === l.sessionId);
  const ok = r.lastWater !== today(), left = 10 - wateredToday();
  const stat = (k, v) => `<div class="tstat"><span>${k}</span><b>${v}</b></div>`;
  return `<button class="iconbtn tc-close" data-tc="close" title="Close">✕</button>
    <div class="tc-art" style="--c:${s.color}">${treeSvg(s.color, l.mins, 1, speciesFor(l.subjectId), 190)}${r.water ? `<span class="tc-drops">💧 ${r.water}</span>` : ''}</div>
    <div class="tc-body">
      <div class="tc-name"><input type="text" id="tcName" maxlength="40" value="${esc(treeName(l))}" title="Rename this tree"><button class="tc-fav ${r.fav ? 'on' : ''}" data-tc="fav" title="${r.fav ? 'Unstar' : 'Star this tree'}">${r.fav ? '★' : '☆'}</button></div>
      <div class="tc-sub"><span class="tag" style="background:${s.color}22;color:${s.color}">${esc(s.name)}</span> ${st}</div>
      <div class="tstats">${stat("Studied", fullDate(l.date))}${stat('Time', `${hm(start)} to ${hm(end)}`)}${stat('Length', fmtMins(l.mins))}
        ${stat('Height', treeHeight(l) + ' m')}${stat('Age', age === 0 ? 'Planted today' : `${age} day${age === 1 ? '' : 's'}`)}${stat('Earned', `${sessionCoins(l)} ${COIN}`)}</div>
      ${l.withered ? `<div class="tbuff bad">🥀 Withered: you left the timer ${DISTRACT_LIMIT}+ times, so it paid half coins.</div>` : r.wilted ? `<div class="tbuff bad">🥀 Wilted after a missed day (${fmtDate(r.wilted)}). Water it to bring it back.</div>` : ''}
      ${treeBuff(l).text ? `<div class="tbuff">★ ${esc((BONUS_SPECIES.find(b => b[0] === l.species) || [, 'Rare tree'])[1])} buff: <b>${esc(treeBuff(l).text)}</b></div>` : ''}
      ${sess ? `<p class="small-text muted" style="margin:8px 0 0">Study block: <b>${esc(sess.topic || '')}</b></p>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn ${ok && left > 0 ? 'primary' : ''}" data-tc="water" ${ok && left > 0 ? '' : 'disabled'}>💧 ${ok ? (left > 0 ? `Water (+${waterCoins(l)} ${COIN})` : 'Watered 10 trees today') : 'Watered today'}</button>
        <span class="muted small-text">Watering makes trees grow a little taller. ${left > 0 ? `${left} left today.` : ''}</span></div>
    </div>`;
}
function openTreeCard(id) {
  const l = D.focusLogs.find(x => x.id === id); if (!l) return;
  document.querySelector('.treefx')?.remove();
  const ov = document.createElement('div');
  ov.className = 'treefx';
  ov.innerHTML = `<div class="treecard">${treeCardHtml(l)}</div>`;
  document.body.appendChild(ov);
  const card = ov.querySelector('.treecard');
  const close = () => { saveName(); ov.remove(); document.removeEventListener('keydown', esc_); render(); };
  const saveName = () => {
    const inp = ov.querySelector('#tcName'); if (!inp) return;
    const v = inp.value.trim().slice(0, 40), r = { ...treeRec(id) };
    if (v && v !== treeName(l)) { r.name = v; D.game.trees[id] = r; save(); }
  };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('click', e => {
    if (e.target === ov) return close();
    const b = e.target.closest('[data-tc]'); if (!b) return;
    const a = b.dataset.tc;
    if (a === 'close') return close();
    saveName();
    if (a === 'fav') { D.game.trees[id] = { ...treeRec(id), fav: !treeRec(id).fav }; save(); }
    if (a === 'water') {
      const res = waterTree(id);
      if (res === 'ok') { const p = document.createElement('div'); p.className = 'coinpop'; p.textContent = `💧 +${waterCoins(l)} ${COIN}`; document.body.appendChild(p); setTimeout(() => p.remove(), 1600); lastCoins = coins(); }
    }
    card.innerHTML = treeCardHtml(l);
  });
  ov.querySelector('#tcName').addEventListener('keydown', e => { if (e.key === 'Enter') { saveName(); e.target.blur(); } });
}

// ---------- views ----------
function treesView() {
  const f = ui.treeSubj || 'all', sort = ui.treeSort || 'new';
  let logs = D.focusLogs.filter(l => l.mins >= 10 && (f === 'all' || (f === 'fav' ? treeRec(l.id).fav : l.subjectId === f)));
  logs = sort === 'long' ? logs.sort((a, b) => b.mins - a.mins) : sort === 'tall' ? logs.sort((a, b) => treeHeight(b) - treeHeight(a)) : logs.sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const chip = (v, label, color) => `<button class="cchip ${f === v ? 'on' : ''}" data-act="treeSubj" data-v="${v}" ${color ? `style="--c:${color}"` : ''}>${label}</button>`;
  const sorts = [['new', 'Newest'], ['long', 'Longest'], ['tall', 'Tallest']].map(([v, n]) => `<button class="${sort === v ? 'on' : ''}" data-act="treeSort" data-v="${v}">${n}</button>`).join('');
  const left = 10 - wateredToday();
  return `<div class="card"><div class="card-head"><h2>My trees</h2><span class="muted">${logs.length} tree${logs.length === 1 ? '' : 's'} · 💧 ${left > 0 ? `${left} waterings left today` : 'all watered for today'}</span><span style="flex:1"></span><div class="seg">${sorts}</div></div>
    <div class="catchips">${chip('all', 'All')}${chip('fav', '★ Starred')}${D.subjects.map(s => chip(s.id, esc(s.name), s.color)).join('')}</div>
    ${logs.length ? `<div class="tgrid">${logs.slice(0, 120).map(l => {
      const s = subj(l.subjectId), r = treeRec(l.id), wet = r.lastWater === today();
      return `<button class="tcard" data-act="treeInfo" data-id="${l.id}" style="--c:${s.color}">
        <div class="tcart">${treeSvg(s.color, l.mins, 1, speciesFor(l.subjectId), 96)}</div>
        <b>${r.fav ? '★ ' : ''}${esc(treeName(l))}</b><span class="muted small-text">${esc(s.name)} · ${fmtMins(l.mins)}</span><span class="muted small-text">${fmtDate(l.date)}</span>
        <span class="tcwater ${wet ? 'wet' : ''}">${wet ? '💧 watered' : '💧 needs water'}</span>${l.withered ? '<span class="tcwater bad">withered</span>' : r.wilted ? '<span class="tcwater bad">🥀 wilted</span>' : ''}</button>`;
    }).join('')}</div>${logs.length > 120 ? '<p class="muted small-text">Showing the first 120.</p>' : ''}` : '<div class="empty">No trees here yet. Study for 10+ minutes to plant one.</div>'}</div>`;
}
function crittersView() {
  const s = forestStats(), got = CRITTERS.filter(k => crit(k.id)).length;
  return `<div class="card"><div class="card-head"><h2>Critters</h2><span class="muted">${got} / ${CRITTERS.length} living in your forest</span></div>
    <p class="muted small-text" style="margin-top:0">Critters move in as your forest grows. Each one gives you a buff for as long as it stays, plus 50 ${COIN} when it arrives.</p>
    <div class="critgrid">${CRITTERS.map(k => {
      const has = crit(k.id), [have, need] = k.need(s), pct = Math.min(100, Math.round(have / need * 100));
      return `<div class="critcard ${has ? 'got' : ''}"><div class="critemoji">${has ? k.emoji : '❔'}</div><b>${has ? esc(k.name) : '???'}</b>
        <div class="critbuff">${has ? esc(k.buff) : esc(k.how)}</div>
        ${has ? `<span class="muted small-text">Moved in ${fmtDate(D.game.critters[k.id].slice(0, 10))}</span>` : `<div class="ctrack"><i style="width:${pct}%"></i></div><span class="muted small-text">${Math.min(have, need)} / ${need}</span>`}</div>`;
    }).join('')}</div></div>`;
}
function shopView() {
  const have = coins(), g = giftReady();
  const ups = UPGRADES.map(u => {
    const lvl = upg(u.id), max = lvl >= u.prices.length, price = u.prices[lvl];
    return `<div class="upg ${max ? 'max' : ''}"><div class="upgicon">${u.icon}</div><div class="main"><b>${u.name}</b>${u.prices.length > 1 ? ` <span class="muted small-text">level ${lvl} / ${u.prices.length}</span>` : ''}<div class="muted small-text">${u.desc}</div></div>
      ${max ? '<span class="tag green">✓ Owned</span>' : `<button class="btn small ${have >= price ? 'primary' : ''}" data-act="buyUpg" data-id="${u.id}" ${have >= price ? '' : 'disabled'}>${price} ${COIN}</button>`}</div>`;
  }).join('');
  return `<div class="forest-cols shop-top"><div class="stack">
      <div class="card giftcard ${g ? 'ready' : ''}"><div class="gifticon">🎁</div><div class="main"><h2 style="margin:0">Daily gift</h2><p class="muted small-text" style="margin:4px 0 0">${g ? 'A free gift is waiting for you.' : 'Opened. A new one arrives tomorrow.'}</p></div>
        ${g ? `<button class="btn primary" data-act="gift">Open gift</button>` : `<span class="tag green">+${D.game.ledger[giftKey()]} ${COIN}</span>`}</div>
      ${earnCard()}</div>
      <div class="card"><h2>Upgrades</h2><div class="upgs">${ups}</div></div></div>
    ${storeView()}${boxesView()}`;
}
function milestonesCard() {
  const ms = milestones();
  return `<div class="card"><h2>Milestones</h2><div class="mstones">${ms.map(m => `<div class="mstone ${m.claimed ? 'claimed' : m.ok ? 'ready' : ''}"><span class="me">${m.e}</span><div class="main"><b>${m.name}</b><span class="muted small-text">${m.claimed ? 'Claimed' : `${m.reward} ${COIN}`}</span></div>
    ${m.ok && !m.claimed ? `<button class="btn small primary" data-act="milestone" data-id="${m.id}">Claim</button>` : m.claimed ? '✓' : ''}</div>`).join('')}</div></div>`;
}

// ---------- choosing a subject's tree ----------
const speciesName = k => (BONUS_SPECIES.find(b => b[0] === k) || TREE_SPECIES.find(b => b[0] === k) || [, k])[1];
const speciesRarity = k => { const b = BONUS_SPECIES.find(x => x[0] === k); return b ? (itemById(b[2]) || {}).rarity || 'rare' : 'common'; };
function openTreePicker(subjectId) {
  const s = subj(subjectId), cur = speciesFor(subjectId), map = speciesMap();
  const takenBy = k => D.subjects.find(x => x.id !== subjectId && map[x.id] === k);
  const order = ['legendary', 'epic', 'rare', 'common'];
  const all = [...BONUS_SPECIES.map(b => ({ k: b[0], n: b[1], has: owned(b[2]) })), ...TREE_SPECIES.map(b => ({ k: b[0], n: b[1], has: true }))]
    .map(x => ({ ...x, r: speciesRarity(x.k) })).sort((a, b) => order.indexOf(a.r) - order.indexOf(b.r));
  const ov = document.createElement('div');
  ov.className = 'treefx';
  ov.innerHTML = `<div class="treecard pickcard"><button class="iconbtn tc-close" data-tp="close" title="Close">✕</button>
    <h2 style="margin:0 0 4px">Choose a tree for ${esc(s.name)}</h2><p class="muted small-text" style="margin:0 0 12px">Each subject has its own tree, so trees another subject uses are greyed out. ★ trees come from lucky boxes. Their buff counts for every session you grow as that tree from now on.</p>
    <div class="pickgrid">${all.map(x => { const rc = RARITY[x.r], b = TREE_BUFFS[x.k], tb = takenBy(x.k), ok = x.has && !tb; return `<button class="pick ${x.k === cur ? 'on' : ''} ${ok || x.k === cur ? '' : 'locked'}" ${ok ? `data-tp="${x.k}"` : 'disabled'} style="--rc:${rc.color}" ${tb ? `title="Already used by ${esc(tb.name)}"` : ''}>
      <div class="pickart">${x.has ? treeSvg(s.color, 45, 1, x.k, 70) : '<span class="pickq">?</span>'}</div><b>${x.has ? esc(x.n) : '???'}</b><span class="rar">${rc.name}</span>
      <span class="pbuff">${b ? (x.has ? esc(b.text) : 'Find it in a Tree chest') : 'No buff'}</span>${x.k === cur ? '<span class="tag green">Current</span>' : tb && x.has ? `<span class="tag">Used by ${esc(tb.name)}</span>` : ''}</button>`; }).join('')}</div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  ov.addEventListener('click', e => {
    if (e.target === ov) return close();
    const b = e.target.closest('[data-tp]'); if (!b) return;
    if (b.dataset.tp !== 'close') { D.settings.treeFor = { ...(D.settings.treeFor || {}), [subjectId]: b.dataset.tp }; save(); render(); toast(`🌳 ${s.name} now grows ${speciesName(b.dataset.tp)}`, TREE_BUFFS[b.dataset.tp] ? `Buff: ${TREE_BUFFS[b.dataset.tp].text}` : ''); }
    close();
  });
}
