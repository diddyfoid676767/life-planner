'use strict';
/* 2.22 garden ideas: bonuses that build on each other and reasons to come back.
   - Collection: +2% leaves for every tree type and critter you own
   - Subject milestones: 10, 25, 50 and 100 trees in one subject each double its leaves
   - Critter teamwork: some critters boost the trees they like
   - Golden leaf: pops up while the garden is open; tap it for a leaf rush or a basket bonus
   - While you were away: what grew since you last looked
   - Fruit (every 5 hours, up to 4) and a mushroom ring (every 2 days)
   - Skills: Rain dance (water everything, once a day) and Harvest moon (double
     leaves for an hour after a 25+ minute session)
   - Seasons: reset leaves and leaf upgrades (never trees) for seeds, a permanent bonus
   - Best-value badge in the leaf shop
   Live bonuses (golden leaf, Harvest moon) only count while the app is open. */

// ---------- multipliers ----------
const FLOWERING = ['cherry', 'magnolia', 'wisteria', 'jacaranda', 'bottlebrush', 'wattle', 'apple', 'lemon', 'olive', 'fig', 'lantern'];
const GLOWING = ['moon', 'lantern', 'aurora', 'glowshroom', 'ember', 'storm', 'worldtree'];
const SYNERGY = [
  { critter: 'bee', icon: '🐝', text: '+15% leaves from flowering trees', when: (l, sp) => FLOWERING.includes(sp), mult: .15 },
  { critter: 'fireflies', icon: '✨', text: '+20% leaves from glowing trees', when: (l, sp) => GLOWING.includes(sp), mult: .2 },
  { critter: 'koala', icon: '🐨', text: '+25% leaves from Ghost gums', when: (l, sp) => sp === 'ghostgum', mult: .25 },
  { critter: 'kookaburra', icon: '🐦', text: '+10% leaves from trees grown before 9am', when: l => new Date(l.start).getHours() < 9, mult: .1 },
  { upgrade: 'wise', icon: '🦉', text: '+10% leaves from trees grown after 7pm, per Wise owl level', when: l => new Date(l.start).getHours() >= 19, mult: .1 },
];
const ownedSpecies = () => ITEMS.filter(i => i.type === 'tree' && owned(i.id)).length;
const ownedCritters = () => Object.keys(D.game.critters || {}).length;
const collectionMult = () => 1 + .02 * (ownedSpecies() + ownedCritters());
const MILESTONES = [10, 25, 50, 100];
const subjectTrees = id => D.focusLogs.filter(l => l.subjectId === id && l.mins >= 10 && !l.withered).length;
const milestoneMult = id => 2 ** MILESTONES.filter(m => subjectTrees(id) >= m).length;
const seedMult = () => 1 + .02 * (leafState().seeds || 0);
function synergyMult(l) {
  const sp = speciesFor(l.subjectId);
  return 1 + SYNERGY.reduce((a, s) => a + (!s.when(l, sp) ? 0 : s.critter ? (crit(s.critter) ? s.mult : 0) : s.mult * upg(s.upgrade)), 0);
}
{
  const base = treeLeafRate;
  treeLeafRate = l => base(l) * collectionMult() * milestoneMult(l.subjectId) * synergyMult(l) * seedMult();
}

// ---------- live bonuses: only while the app is open ----------
const LIVE = { rushUntil: 0 };
const harvestOn = () => (leafState().harvestUntil || 0) > Date.now();
const rushOn = () => LIVE.rushUntil > Date.now();
// extra leaves go into the basket a little at a time
setInterval(() => {
  if (!D?.game || document.hidden) return;
  const extra = (rushOn() ? 9 : 0) + (harvestOn() ? 1 : 0); if (!extra) return;
  const L = leafState(); L.carry = (L.carry || 0) + leafRate() * extra * 2 / 3600;
}, 2000);

// ---------- golden leaf ----------
let goldenAt = Date.now() + (5 + Math.random() * 10) * 60e3;
function goldenTick() {
  if (!D?.game || document.hidden || view !== 'forest' || (ui.forestPage || 'forest') !== 'forest' || document.getElementById('goldleaf')) return;
  if (Date.now() < goldenAt) return;
  goldenAt = Date.now() + (5 + Math.random() * 10) * 60e3;
  const scene = document.querySelector('.scene-wrap'); if (!scene) return;
  const r = scene.getBoundingClientRect();
  const g = document.createElement('button'); g.id = 'goldleaf'; g.title = 'Golden leaf! Tap it'; g.textContent = '🍂';
  g.style.left = (r.left + scrollX + r.width * (.15 + Math.random() * .7)) + 'px'; g.style.top = (r.top + scrollY + r.height * (.15 + Math.random() * .5)) + 'px';
  g.onclick = () => {
    g.remove();
    if (Math.random() < .5) {
      LIVE.rushUntil = Date.now() + 60e3; if (typeof sfx === 'function') try { sfx('coin'); } catch { }
      toast('🍂 Leaf rush!', 'Your trees grow ×10 leaves for the next minute.');
      setTimeout(() => { const el = document.querySelector('.leafbar'); if (el) el.outerHTML = leafBar(); }, 61e3);
    } else {
      const n = Math.max(1, Math.round(basketCap() * .1)); leafState().bank += n; save(); leafBurst(document.querySelector('.leafbar'), n);
      toast('🍂 Golden leaf!', `+${fmtLeaf(n)} leaves, a tenth of a full basket.`);
    }
    const el = document.querySelector('.leafbar'); if (el) el.outerHTML = leafBar();
  };
  document.body.appendChild(g);
  setTimeout(() => { g.classList.add('gone'); setTimeout(() => g.remove(), 600); }, 15000);
}
setInterval(goldenTick, 5000);

// ---------- fruit and mushrooms ----------
const FRUIT_H = 5, FRUIT_MAX = 4, SHROOM_H = 48;
function extrasState() { const L = leafState(), now = Date.now(); if (!L.fruitAt) L.fruitAt = now; if (!L.shroomAt) L.shroomAt = now; return L; }
const fruitReady = () => Math.min(FRUIT_MAX, Math.floor((Date.now() - extrasState().fruitAt) / (FRUIT_H * 36e5)));
const shroomReady = () => Date.now() - extrasState().shroomAt >= SHROOM_H * 36e5;
function pickFruit(el) {
  const n = fruitReady(); if (!n) return;
  const L = extrasState(), got = Math.round(leafRate() * n);
  L.bank += got; L.fruitAt = n >= FRUIT_MAX ? Date.now() : L.fruitAt + n * FRUIT_H * 36e5; save(); leafBurst(el, got);
  toast(`🍎 Picked ${n} fruit`, `+${fmtLeaf(got)} leaves (an hour of growth each).`);
}
function pickShroom(el) {
  if (!shroomReady()) return;
  const L = extrasState(), got = Math.round(leafRate() * 12), at = new Date().toISOString();
  L.bank += got; L.shroomAt = Date.now(); D.game.ledger['shroom:' + at] = 25; save(); leafBurst(el, got);
  toast('🍄 Fairy ring!', `+${fmtLeaf(got)} leaves and +25 ${COIN}. Another one grows in 2 days.`);
}

// ---------- skills ----------
function rainDance() {
  const L = leafState(); if (L.rainDay === today()) return;
  L.rainDay = today();
  for (const l of D.focusLogs.filter(x => x.mins >= 10 && !x.withered)) { const r = treeRec(l.id); r.lastWater = today(); }
  save(); toast('🌧️ Rain dance', 'Every tree is watered for today. No coins for this one, but they all grow ×1.5 leaves.');
}
const studiedLong = () => D.focusLogs.some(l => l.date === today() && l.mins >= 25);
function harvestMoon() {
  const L = leafState(); if (L.moonDay === today() || !studiedLong()) return;
  L.moonDay = today(); L.harvestUntil = Date.now() + 36e5; save();
  toast('🌕 Harvest moon', 'Double leaves for the next hour while the app is open.');
}

// ---------- the leaf bar gets a row of extras ----------
{
  const base = leafBar;
  leafBar = function () {
    if (!D.game.leaves) return base();
    const L = extrasState(), f = fruitReady(), sh = shroomReady(), t = today();
    const nextFruit = fmtMins(Math.ceil((L.fruitAt + (f + 1) * FRUIT_H * 36e5 - Date.now()) / 6e4));
    const bonus = [[collectionMult(), '📚 Collection'], [seedMult(), '🌱 Seeds']].filter(([m]) => m > 1).map(([m, l]) => `<span class="lchip" title="${l} bonus">${l} ×${m.toFixed(2)}</span>`).join('');
    const live = [rushOn() && '<span class="lchip hot">🍂 Leaf rush ×10</span>', harvestOn() && `<span class="lchip hot">🌕 Harvest moon ×2 · ${fmtMins(Math.ceil((L.harvestUntil - Date.now()) / 6e4))} left</span>`].filter(Boolean).join('');
    const extras = `<div class="leafx">
      <button class="lchip btnish ${f ? 'ready' : ''}" data-g2="fruit" ${f ? '' : 'disabled'} title="Fruit grows every ${FRUIT_H} hours, up to ${FRUIT_MAX}">🍎 ${f ? `Pick ${f} fruit` : `Fruit in ${nextFruit}`}</button>
      <button class="lchip btnish ${sh ? 'ready' : ''}" data-g2="shroom" ${sh ? '' : 'disabled'} title="A fairy ring grows every 2 days">🍄 ${sh ? 'Fairy ring!' : `Fairy ring in ${fmtMins(Math.ceil((L.shroomAt + SHROOM_H * 36e5 - Date.now()) / 6e4))}`}</button>
      <button class="lchip btnish ${L.rainDay !== t ? 'ready' : ''}" data-g2="rain" ${L.rainDay !== t ? '' : 'disabled'} title="Water every tree, once a day">🌧️ ${L.rainDay !== t ? 'Rain dance' : 'Rain dance used'}</button>
      <button class="lchip btnish ${L.moonDay !== t && studiedLong() ? 'ready' : ''}" data-g2="moon" ${L.moonDay !== t && studiedLong() ? '' : 'disabled'} title="Double leaves for an hour, after a 25+ minute session, once a day">🌕 ${L.moonDay === t ? 'Harvest moon used' : studiedLong() ? 'Harvest moon' : 'Harvest moon: study 25m'}</button>
      ${live}${bonus}</div>`;
    return base().replace(/<\/div>\s*$/, extras + '</div>');
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-g2]'); if (!b) return;
  const a = b.dataset.g2, bar = document.querySelector('.leafbar');
  if (a === 'fruit') pickFruit(b); else if (a === 'shroom') pickShroom(b); else if (a === 'rain') rainDance(); else if (a === 'moon') harvestMoon();
  else if (a === 'season') return seasonReset();
  if (bar) bar.outerHTML = leafBar();
});

// ---------- while you were away ----------
function awayCheck() {
  const L = leafState(), last = L.seen || 0, gone = Date.now() - last;
  L.seen = Date.now();
  if (!last || gone < 30 * 60e3 || !leafRate()) return;
  const p = pendingLeaves(), cap = basketCap(), pct = cap ? Math.round(p / cap * 100) : 0, f = fruitReady();
  setTimeout(() => celebrate({ icon: '<span class="critbig">🧺</span>', color: '#2f9e44', kicker: `While you were away · ${fmtMins(Math.round(gone / 6e4))}`,
    title: `Your trees grew ${fmtLeaf(p)} leaves`,
    text: `The basket is ${pct}% full${pct >= 100 ? ', so collect them to keep growing' : ''}.${f ? `<br>🍎 ${f} fruit ${f === 1 ? 'is' : 'are'} ready to pick.` : ''}${shroomReady() ? '<br>🍄 A fairy ring has grown.' : ''}<br>Open the garden to collect.` }), 2600);
}
{
  const t = setInterval(() => { if (!D?.game || !D.focusLogs) return; clearInterval(t); awayCheck(); setInterval(() => { if (!document.hidden) leafState().seen = Date.now(); }, 60e3); }, 500);
  addEventListener('pagehide', () => { if (D?.game) { leafState().seen = Date.now(); } });
}

// ---------- seasons ----------
const lifetimeLeaves = () => { const L = leafState(); return (L.pastBank || 0) + (L.bank || 0); };
const seedsTotal = () => Math.floor(Math.sqrt(lifetimeLeaves() / 1000));
const seedsGain = () => Math.max(0, seedsTotal() - (leafState().seeds || 0));
function seasonReset() {
  const n = seedsGain(); if (!n) return;
  if (!confirm(`Start a new season?\n\nYou keep every tree, critter and coin. Your leaves and leaf upgrades go back to zero.\n\nYou get ${n} seed${n === 1 ? '' : 's'}: +${2 * n}% leaves forever (you'd have ${(leafState().seeds || 0) + n} seeds).`)) return;
  const L = leafState();
  L.pastBank = (L.pastBank || 0) + L.bank; L.bank = 0; L.spent = 0; L.carry = 0; L.last = Date.now(); L.ups = {};
  L.seeds = (L.seeds || 0) + n; L.season = (L.season || 1) + 1;
  save(); render();
  celebrate({ icon: '<span class="critbig">🌱</span>', color: '#2f9e44', kicker: `Season ${L.season}`, title: `+${n} seed${n === 1 ? '' : 's'}`, text: `Every leaf now grows ${Math.round((seedMult() - 1) * 100)}% faster, for good.` });
}
function seasonCard() {
  const L = leafState(), n = seedsGain(), next = (seedsTotal() + 1) ** 2 * 1000;
  return `<div class="card seasoncard"><div class="card-head"><h2>🍂 Seasons</h2><span class="muted small-text">Season ${L.season || 1} · ${L.seeds || 0} seed${(L.seeds || 0) === 1 ? '' : 's'} (+${2 * (L.seeds || 0)}% leaves)</span></div>
    <p class="muted small-text" style="margin-top:0">Start a new season to reset your leaves and leaf upgrades (never your trees, critters or coins) for seeds. Each seed is +2% leaves forever. Seeds come from all the leaves you've ever grown: ${fmtLeaf(lifetimeLeaves())} so far, next seed at ${fmtLeaf(next)}.</p>
    <button class="btn ${n ? 'primary' : ''}" data-g2="season" ${n ? '' : 'disabled'}>${n ? `Reset now: +${n} seed${n === 1 ? '' : 's'}` : 'No seeds to gain yet'}</button></div>`;
}

// ---------- the leaf shop: best value badge, milestones, teamwork, seasons ----------
function bestValueUpgrade() {
  const L = leafState(), now = leafRate(), have = leaves(), n = gardenTrees();
  let best = null;
  for (const u of LEAF_UPGRADES) {
    const lvl = lupg(u.id), price = u.prices[lvl]; if (price == null || n < (u.need || 0)) continue;
    const a = L.ups[u.id] = [...(L.ups[u.id] || []), 'x']; const gain = leafRate() - now; a.pop(); if (!a.length) delete L.ups[u.id];
    if (gain <= 0) continue;
    const pay = price / gain; if (!best || pay < best.pay) best = { id: u.id, pay, gain, afford: have >= price };
  }
  return best;
}
{
  const base = leafShopView;
  leafShopView = function () {
    const b = bestValueUpgrade();
    let html = base();
    if (b) html = html.replace(new RegExp(`(<button class="btn small[^"]*" data-act="buyLeafUpg" data-id="${b.id}")`), `<span class="bestval" title="Pays for itself in ${fmtMins(Math.ceil(b.pay * 60))}: +${fmtLeaf(b.gain)} leaves an hour">⭐ Best value</span>$1`);
    const subs = D.subjects.filter(s => subjectTrees(s.id)).map(s => { const k = subjectTrees(s.id), nx = MILESTONES.find(m => k < m), m = milestoneMult(s.id);
      return `<li><i style="background:${s.color}"></i><b>${esc(s.name)}</b><span class="muted small-text">${k} tree${k === 1 ? '' : 's'}${nx ? ` · ${nx - k} to ×${m * 2}` : ''}</span><span class="tag ${m > 1 ? 'green' : ''}">×${m}</span></li>`; }).join('');
    const syn = SYNERGY.map(s => { const on = s.critter ? crit(s.critter) : upg(s.upgrade) > 0; return `<li class="${on ? '' : 'off'}"><span>${s.icon}</span><span>${esc(s.text)}</span>${on ? '<span class="tag green">On</span>' : `<span class="muted small-text">${s.critter ? 'needs the critter' : 'needs the upgrade'}</span>`}</li>`; }).join('');
    return html + `<div class="grid g2">
      <div class="card"><div class="card-head"><h2>🏅 Subject milestones</h2><span class="muted small-text">10, 25, 50 and 100 trees each double a subject's leaves</span></div><ul class="msubs">${subs || '<li class="muted">Grow some trees first.</li>'}</ul>
        <p class="muted small-text">Collection bonus: ${ownedSpecies()} tree types and ${ownedCritters()} critters give ×${collectionMult().toFixed(2)} leaves.</p></div>
      <div class="card"><div class="card-head"><h2>🤝 Critter teamwork</h2></div><ul class="synlist">${syn}</ul></div></div>${seasonCard()}`;
  };
}
