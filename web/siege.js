'use strict';
/* Sieges, stage 1 (2.88.0): "Fortify". Loaded after hisland.js. Design: house-raids/plan.md (section 11 for
   the fortress and terrain). Everything here works on your own house island; real wars come in stage 2.
   - House terrain: the Architect or Warlord shapes the house island (forest, hills, raise and lower, paths,
     moats, cliffs), paid from the house pool. Saved in the house document as b._sg.tf, in the same shape
     as your own island's terraforming (terraform.js), so it draws with the same code.
     Moats and anything raised 2+ steps are "strong terrain": dearer, and capped by house level.
   - Guard rail: attackers must always have a walking route from the coast to the great hall. Walls and
     buildings don't count as sealing it (they can be broken); water, moats, mountains, rocks and climbs of
     2+ steps do. A stroke that would seal the island is refused.
   - The Fortress look: an optional Looks pick for the house island (stone ground, rocky crags round the
     coast, a keep for a great hall), bought once from the house pool. Defences work the same without it.
     Saved as b._sg.lk.
   - The siege sim: a deterministic, seeded auto-battle on a house island. Terrain changes how attackers
     walk (forest and hills are slow, water and cliffs block, climbs need a ramp), towers on raised ground
     reach further, guards hidden in forest strike first. Walls and buildings in the way must be broken.
     Stars: half the island destroyed, the banner planted at the great hall, everything destroyed.
   - Test your defences: a briefing (which side, what to go for, when to use the class skill), then a 3D
     replay of your own character attacking your house island. No rewards, nothing is damaged.
   All numbers are in SG, so they can be tuned after launch. */

const SG = {
  // house terrain: brush prices from the house pool (l = Lumen, x = Ember); strong = counts against the cap
  tf: {
    grass: { n: 'Clear', e: '🟩', l: 0, x: 0, d: 'Back to plain ground (no refund)' },
    forest: { n: 'Forest', e: '🌲', l: 4, x: 0, d: 'Slows attackers; guards hidden in it strike first' },
    path: { n: 'Path', e: '🟫', l: 2, x: 0, d: 'Quicker walking, for you and for attackers' },
    pstone: { n: 'Stone path', e: '🔘', l: 4, x: 0, d: 'Quicker walking, in cobbles' },
    hill: { n: 'Hills', e: '⛰️', l: 0, x: 6, d: 'Slow to climb over' },
    up: { n: 'Raise', e: '⬆️', l: 0, x: 4, d: 'One step up. Towers on raised ground shoot further. 2+ steps is strong terrain' },
    down: { n: 'Lower', e: '⬇️', l: 0, x: 0, d: 'One step down (no refund)' },
    cliff: { n: 'Cliff', e: '🧗', l: 20, x: 40, strong: 1, d: 'Raised 2 steps with rock sides: attackers can only climb it from a hex one step below' },
    water: { n: 'Moat', e: '💧', l: 30, x: 30, strong: 1, d: 'Water attackers can\'t cross' },
  },
  tfOrder: ['grass', 'forest', 'path', 'pstone', 'hill', 'up', 'down', 'cliff', 'water'],
  hiStep: { l: 20, x: 20 }, // each step from the 2nd up (strong terrain)
  // strong terrain hexes allowed, by house level
  strong: [0, 0, 6, 10, 14, 18, 24, 30, 36, 42, 48, 56, 64],
  fort: { l: 250, x: 250 }, // the Fortress look
  // the sim
  dt: .1, len: 180, bannerT: 2,
  hp: { wall: 300, gate: 220, tower: 520, guard: 380, bld: 420, big: 900, hall: 1400 },
  archer: { r: 3.2, cd: .9, dmg: 13 }, mage: { r: 2.6, cd: 2.4, dmg: 32, splash: 1 },
  hiR: .8, hiRMax: 1.6, // extra tower range per step of height
  trap: { spike: { dmg: 55 }, snare: { root: 3 }, rune: { sil: 8 } },
  guardU: { hp: 240, dps: 11, sp: 1.3, see: 2.4, seeForest: 1.3, ambush: 1.6 },
  lvm: [1, 1.3, 1.65],
  move: { road: .75, path: .75, grass: 1, sand: 1.1, forest: 1.8, hill: 1.9, up: .6 },
  // rewards when sieges are real (stage 2) are in the plan; tests give nothing
};
const SG_SIDES = ['East', 'South-east', 'South-west', 'West', 'North-west', 'North-east'];
const SG_PRIO = [
  ['towers', '🏹', 'Towers first', 'Knock out towers and guard posts, then the rest'],
  ['hall', '🏰', 'Straight for the hall', 'Plant the banner, smash through anything in the way'],
  ['traps', '🔎', 'Scout for traps', 'Walk carefully: twice as likely to spot and disarm traps'],
  ['treasury', '💰', 'Banks and treasury', 'The Lumen and Ember Banks, the Vault and the Treasury first'],
];
const SG_WHEN = [['early', '⚡', 'Early'], ['hurt', '❤️‍🩹', 'When hurt'], ['hall', '🏰', 'At the hall']];
const SG_FORT_LOOK = { n: 'Stone fortress', gr: '#bcb7a8', gs: .96, lf: '#46624a', ls: .5, tuft: ['#8d9a7a', '#a3a28c', '#76866a'], fl: ['#e9ecef', '#ced4da', '#ffe066'], flN: .6 };

// ---------- the house document's siege bits (b._sg) ----------
const sgDoc = (d = HI.doc) => d?.b?._sg || {};
const sgTfOf = d => (d?.b?._sg?.tf) || {};
const sgFortOwned = (d = HI.doc) => !!sgDoc(d).lk?.own;
const sgFortOn = (d = HI.doc) => !!(ui.sgFortPv || (sgDoc(d).lk?.own && sgDoc(d).lk?.on));
const sgStrongN = tf => Object.values(tf || {}).filter(v => v.t === 'water' || (v.h || 0) >= 2).length;
const sgStrongMax = (lv = hiLevel()) => SG.strong[Math.min(lv, SG.strong.length - 1)];

// ---------- house terrain: what a brush does to one hex ----------
// { nx, l, x } or { why } ('-' = nothing to do). Works on any hex state (live, or a saved document).
function sgTfPlan(k, id, st) {
  const b = SG.tf[id]; if (!b) return { why: '-' };
  const cur = st.tf?.[k] || {}, nx = { ...cur };
  if (!tfOpen(k, st)) {
    const a = hxAt(k, st);
    return { why: a.kind === 'tree' || a.kind === 'rock' ? 'The island\'s own woods and rocks stay' : a.kind === 'b' || a.kind === 'free' ? 'There\'s a building or wall here' : a.kind === 'road' ? 'There\'s a road here' : a.kind === 'hill' || a.kind === 'mount' ? 'The island\'s own hills stay' : '-' };
  }
  if (id === 'up') { if ((cur.h || 0) >= HX_TF.hMax) return { why: 'As high as it goes' }; if (cur.t === 'water') return { why: 'Fill the moat in first (Clear)' }; nx.h = (cur.h || 0) + 1; }
  else if (id === 'down') { if (!cur.h) return { why: '-' }; nx.h = cur.h - 1; if (nx.h < 2) delete nx.c; }
  else if (id === 'cliff') { if (cur.c && cur.h >= 2) return { why: '-' }; if (cur.t === 'water') return { why: 'Fill the moat in first (Clear)' }; nx.c = 1; nx.h = Math.max(cur.h || 0, 2); }
  else {
    const t = id === 'grass' ? undefined : id === 'pstone' ? 'path' : id, ps = id === 'pstone' ? 'stone' : undefined;
    if (cur.t === t && (t !== 'path' || cur.ps === ps)) return { why: '-' };
    if (t === 'water' && cur.h) return { why: 'Lower it to the ground first' };
    nx.t = t; nx.ps = ps;
  }
  tfClean(nx);
  const [l, x] = sgTfCost(cur, nx);
  return { nx, l, x };
}
// what changing one hex from a to b costs
function sgTfCost(a = {}, b = {}) {
  let l = 0, x = 0; const add = it => { l += it.l; x += it.x; };
  if (b.t && b.t !== a.t) add(SG.tf[b.t === 'path' && b.ps === 'stone' ? 'pstone' : b.t]);
  for (let h = (a.h || 0) + 1; h <= (b.h || 0); h++) add(h >= 2 ? SG.hiStep : SG.tf.up);
  if (b.c && !a.c) add(SG.tf.cliff);
  return [l, x];
}

// ---------- walking: what the sim and the guard rail think of each hex ----------
// { pass, cost, h, forest } for an attacker on foot. Walls and buildings count as passable here (they're broken through).
function sgTerr(k, st) {
  const a = hxAt(k, st), h = st.tf?.[k]?.h || 0;
  if (['off', 'water', 'pond', 'mount', 'rock', 'river'].includes(a.kind)) return { pass: false, h };
  const M = SG.move, g = a.g;
  const cost = a.kind === 'road' ? M.road : a.kind === 'tree' ? M.forest : a.kind === 'hill' ? M.hill : g === 'path' ? M.path : g === 'sand' ? M.sand : M.grass;
  return { pass: true, cost, h, forest: a.kind === 'tree' };
}
// can you step from hex a to hex b? (climbing 2+ steps needs a ramp; dropping down is fine)
const sgStep = (ta, tb) => tb.pass && tb.h - ta.h <= 1;
// the coast: the outermost ring of land
function sgRim(st) {
  const L = hxW(st).land(), R = hxW(st).R || HH_R;
  return [...L.keys()].filter(k => { const [q, r] = hxQR(k); return hxDist(q, r) === R && sgTerr(k, st).pass; });
}
// is there a walking route from the coast to the great hall?
function sgRouteOk(st) {
  const T = new Map(), t = k => { if (!T.has(k)) T.set(k, sgTerr(k, st)); return T.get(k); };
  const goal = new Set(hxNb('0,0')), seen = new Set(), todo = sgRim(st);
  todo.forEach(k => seen.add(k));
  while (todo.length) {
    const k = todo.pop(); if (goal.has(k)) return true;
    for (const n of hxNb(k)) if (!seen.has(n) && n !== '0,0' && sgStep(t(k), t(n))) { seen.add(n); todo.push(n); }
  }
  return false;
}

// ---------- painting house terrain (hxhouse.js calls these for the 'htf' tool) ----------
function sgTfPaint(P, k) {
  if (!hhCanEdit()) return 'Only the Architect or Warlord can shape the island';
  const lock = sgWarLock(HI.doc, (P.ops || []).filter(o => o[0] === 'tf').length); if (lock) return lock;
  const st = hhSt(), id = P.brush || 'forest', pl = sgTfPlan(k, id, st);
  if (pl.why) return pl.why;
  const wk = sgWarK(); pl.l *= wk; pl.x *= wk; // 2.89: the war lock triples the price
  const ops = P.ops || (P.ops = []), p = hiPool();
  const sp = ops.reduce((t, o) => o[0] === 'tf' ? [t[0] + (o[3] || 0), t[1] + (o[4] || 0)] : (() => { const c = hhOpCost(o[0], o[1], st); return [t[0] + c.l, t[1] + c.x]; })(), [0, 0]);
  if (p.l - sp[0] < pl.l || p.e - sp[1] < pl.x) return 'Not enough in the house pool';
  const tf2 = { ...(st.tf || {}), [k]: pl.nx };
  if (sgStrongN(tf2) > sgStrongN(st.tf) && sgStrongN(tf2) > sgStrongMax()) return `All ${sgStrongMax()} strong terrain hexes used (moats and cliffs; more at a higher house level)`;
  if (!sgRouteOk({ ...st, tf: tf2 })) return 'That would seal the great hall off: attackers must always have one walking route in';
  ops.push(['tf', k, id, pl.l, pl.x]);
  return '';
}
// the brush bar on the house island
function sgTfBar(P) {
  const id = P.brush || 'forest', d = HI.doc || {}, st = hhSt(), n = sgStrongN(st.tf), mx = sgStrongMax();
  const spent = (P.ops || []).filter(o => o[0] === 'tf').reduce((t, o) => [t[0] + o[3], t[1] + o[4]], [0, 0]);
  const btn = k => { const b = SG.tf[k]; return `<button class="tfb ${k === id ? 'on' : ''}" data-sg="brush" data-v="${k}" title="${esc(b.n)}: ${esc(b.d)}"><span>${b.e}</span>${esc(b.n)}<i>${b.l || b.x ? hxCost(b.l, b.x) : 'Free'}</i></button>`; };
  return `<div class="ishud is-bc isplace hxbar tfbar sgbar">
    <div class="tfitems">${SG.tfOrder.map(btn).join('')}</div>
    <div class="tfrow"><span id="tfhint"><b>${SG.tf[id].e} ${esc(SG.tf[id].n)}</b> · ${esc(SG.tf[id].d)}. Drag over the island, paid from the house pool.${P.n ? ` <b class="tfstroke">${P.n} done${spent[0] || spent[1] ? ' · ' + hxCost(spent[0], spent[1]) : ''}</b>` : ''} ${P.why ? `<b class="hxwhy bad">${esc(P.why)}</b>` : ''}</span>
    ${sgWarLeft() != null ? `<span class="tag hxbad" title="A war has been declared on the house">🔒 War lock: ${Math.max(0, sgWarLeft() - (P.ops || []).filter(o => o[0] === 'tf').length)}/${SGW.lock.n} changes left, ${SGW.lock.k}× price</span>` : ''}<span class="tag" title="Moats and anything raised 2+ steps">🧗 Strong terrain ${n}/${mx}</span><button class="btn small primary" data-hx="cancel">✔ Done</button></div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-sg="brush"]'); if (!el || ui.hxP?.id !== 'htf') return;
  ui.hxP.brush = ui.sgBrush = el.dataset.v; ui.hxP.why = ''; if (typeof sfx === 'function') sfx('select'); render();
});


// ---------- the Fortress look ----------
function sgFortHtml(d) {
  const own = sgFortOwned(d), on = sgFortOn(d), can = hhCanEdit(), p = hiPool(d), afford = p.l >= SG.fort.l && p.e >= SG.fort.x;
  const card = (id, e, n, desc, isOn, act) => `<div class="isitem ${isOn ? 'owned' : ''}"><div class="isitem-e">${e}</div><b>${n}</b><div class="muted small-text">${desc}</div>${act}</div>`;
  const natAct = !on || ui.sgFortPv ? (ui.sgFortPv ? `<button class="btn small" data-sg="fortpv" data-v="0">✖ Stop preview</button>` : '<span class="tag">In use</span>') : can ? '<button class="btn small" data-sg="fort" data-v="0">Use</button>' : '<span class="muted small-text">Architect or Warlord</span>';
  const fortAct = on && !ui.sgFortPv ? '<span class="tag">In use</span>' : own ? (can ? '<button class="btn small primary" data-sg="fort" data-v="1">Use</button>' : '<span class="muted small-text">Architect or Warlord</span>')
    : `${can ? `<button class="btn small ${afford ? 'primary' : ''}" data-sg="fortbuy" ${afford ? '' : 'disabled'}>${hxCost(SG.fort.l, SG.fort.x)}</button>` : `<span class="muted small-text">${hxCost(SG.fort.l, SG.fort.x)} · Architect or Warlord</span>`}${ui.sgFortPv ? '' : '<button class="btn small ghost" data-sg="fortpv" data-v="1" title="See it on the island for free">👁 Preview</button>'}`;
  return `<p class="muted small-text">A look for the whole house island. It changes how it looks, not how it defends: walls, towers, traps and terrain work the same either way.</p>
    <div class="isshop">${card('natural', '🍃', 'Natural', 'Grass and woods that follow the real season', !on, natAct)}${card('fortress', '🏯', 'Stone fortress', 'Stone ground, rocky crags round the coast and a keep for a great hall', on && !ui.sgFortPv, fortAct)}</div>
    ${ui.sgFortPv ? '<p class="small-text"><b>👁 Previewing the Stone fortress</b> · only you can see it, nothing is paid.</p>' : ''}`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-sg="fort"],[data-sg="fortbuy"],[data-sg="fortpv"]'); if (!el) return;
  const a = el.dataset.sg;
  if (a === 'fortpv') { ui.sgFortPv = el.dataset.v === '1'; HX3.sig = ''; render(); return; }
  if (!hhCanEdit()) return;
  if (a === 'fortbuy') {
    if (!confirm(`Buy the Stone fortress look for the house island for ${hxCost(SG.fort.l, SG.fort.x)} from the house pool? The house keeps it and can switch back any time for free.`)) return;
    const ok = await hiWrite(d => { const p = hiPool(d); if (sgFortOwned(d) || p.l < SG.fort.l || p.e < SG.fort.x) return false; d.b = d.b || {}; const g = d.b._sg = d.b._sg || {}; g.lk = { own: 1, on: 1, by: HI.user, at: today() }; d.sp = { l: (+d.sp?.l || 0) + SG.fort.l, e: (+d.sp?.e || 0) + SG.fort.x }; });
    if (ok) { ui.sgFortPv = false; if (typeof sfx === 'function') sfx('coin'); toast('🏯 Stone fortress', 'The house island is a fortress now.'); }
  } else {
    const on = el.dataset.v === '1';
    await hiWrite(d => { if (!sgFortOwned(d)) return false; d.b._sg.lk.on = on ? 1 : 0; });
    ui.sgFortPv = false;
  }
  HX3.sig = ''; render();
});
// extra pieces on the island when it's a fortress (called from hhDress): crags round the coast and a keep
function sgFortDress(W, add, rnd, col) {
  if (!sgFortOn()) return;
  const L = hhLand(), R = HH_R + 1, low = hxLow(), r2 = seeded('sg-fort');
  // a ring of grey crags along the shore
  for (const [k, h] of L) {
    const [q, r] = hxQR(k); if (h.t !== 'water' || hxDist(q, r) !== R) continue;
    if (r2() < .42) { const [x, z] = hxPos(q, r), ht = 1.4 + r2() * 2.4; const m = is3mesh(is3rock(new THREE.ConeGeometry(.9 + r2() * .6, ht, 5, 2), r2, .25, .2), ['#8a857c', '#9c968c', '#77726b'][Math.floor(r2() * 3)], x + (r2() - .5) * .8, ht / 2 - .4, z + (r2() - .5) * .8, W); m.rotation.y = r2() * 6; }
    else if (!low && r2() < .5) { const g = add('rock_single_' + 'ABCDE'[Math.floor(r2() * 5)], k, 0, -.1, 1.8 + r2()); g.rotation.y = r2() * 6.28; }
  }
  // the keep: a stone plinth under the great hall, small towers at three corners and banners
  is3mesh(new THREE.CylinderGeometry(1.55, 1.7, .3, 6), '#9a958b', 0, .15, 0, W).rotation.y = Math.PI / 6;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 6, t = hxModel('building_tower_A', col); t.position.set(Math.cos(a) * 1.35, .25, Math.sin(a) * 1.35); t.scale.setScalar(.5); W.add(t); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2, f = hxModel('flag_' + col, col); f.position.set(Math.cos(a) * 1.5, .3, Math.sin(a) * 1.5); f.scale.setScalar(2.6); f.rotation.y = -a; W.add(f); }
}
const sgFortBase = () => sgFortOn() ? ['#8f8a80', '#504b56'] : null;

// ---------- the sim ----------
// the island as the sim sees it: structures (walls, towers, guard posts, buildings, the hall) and traps
function sgWorld(d = HI.doc) {
  const st = hhStOf(d || {}), S = [], own = {}, traps = {}, W = hxW(st), day = d?.__day || today();
  const lvm = lv => SG.lvm[Math.max(0, Math.min(2, (lv || 1) - 1))];
  const push = s => { s.i = S.length; S.push(s); for (const k of s.hexes) own[k] = s.i; return s; };
  const [hx, hz] = hxPos(0, 0);
  push({ id: 'hall', kind: 'hall', n: 'Great hall', e: '🏰', hexes: ['0,0'], k: '0,0', x: hx, z: hz, hp: SG.hp.hall, lv: 1 });
  for (const [k, s] of Object.entries(st.b)) {
    const it = W.item(s.id); if (!it) continue;
    if (it.wall) { push({ id: k, kind: it.gate ? 'gate' : 'wall', n: it.gate ? 'Gate' : 'Wall', e: it.gate ? '🚪' : '🧱', hexes: [k], k, x: hxPos(...hxQR(k))[0], z: hxPos(...hxQR(k))[1], hp: SG.hp[it.gate ? 'gate' : 'wall'], lv: 1 }); continue; }
    const c = hiCond(s.key, day, st.__d || d || {}); if (!c || c === 'build' || c === 'broken') continue;
    const lv = hiLvOn(st.__d?.b?.[s.key] || d?.b?.[s.key], day), m = lvm(lv) * (c === 'worn' ? .75 : 1) * Math.max(.4, typeof sgDmgM === 'function' ? sgDmgM(s.key, st.__d || d) : 1), [x, z] = hxMid(it, k), base = hiBase(s.key);
    if (it.slot === 'trap') { traps[k] = { id: s.key, kind: base, n: it.n, e: it.e, k, x, z, lvm: lvm(lv) }; continue; }
    const kind = it.slot === 'tower' ? 'tower' : it.slot === 'guard' ? 'guard' : 'bld';
    const hp = (kind === 'tower' ? SG.hp.tower : kind === 'guard' ? SG.hp.guard : it.hz > 1 ? SG.hp.big : SG.hp.bld) * m;
    const o = push({ id: s.key, kind, base, n: it.n, e: it.e, hexes: hxFoot(it, k), k, x, z, hp, lv, m, h: st.tf?.[k]?.h || 0 });
    if (kind === 'guard') { const fo = sgTerr(k, st).forest || hxNb(k).some(n => sgTerr(n, st).forest); o.guard = { hp: SG.guardU.hp * m, max: SG.guardU.hp * m, dps: SG.guardU.dps * m, forest: fo, out: false, x, z }; }
  }
  for (const s of S) s.max = s.hp;
  if (typeof sgGuardsFor === 'function') sgGuardsFor(d || {}, S, day); // 2.89: housemates standing guard
  return { st, S, own, traps };
}
// the attacker, from a character: stats, class, power (level and gear) and gear buffs
function sgAttacker(o = {}) {
  const ch = o.stats ? { all: o.stats } : cdChar(), s = ch.all, cls = o.cls ?? cdClass(), pw = o.power ?? (typeof soPower === 'function' ? soPower() : 1), g = o.g || (typeof ftGearBuffs === 'function' ? ftGearBuffs() : {});
  const v = k => +s[k] || 0, max = Math.round(((typeof ftMaxHp === 'function' ? ftMaxHp(s, g) : 150) * 1.6) * (o.hpK || 1));
  const body = (10 + v('str') * .15 + v('spd') * .05 + v('agi') * .05) * pw * (cls === 'striker' ? 1.15 : cls === 'guardian' ? 1.08 : 1);
  const mind = (8 + v('kno') * .1 + v('log') * .06 + v('foc') * .06 + v('exp') * .04) * pw * (cls === 'sage' ? 1.15 : 1);
  return { n: o.n || D.settings.name || 'You', cls, pw, max, body, mind, spd: 1.05 + v('spd') / 220, spot: Math.min(.8, (v('log') + v('foc')) / 260 + (cls === 'rogue' || cls === 'ranger' ? .25 : 0)), dr: cls === 'guardian' ? .2 : 0, dodge: cls === 'rogue' ? .2 : 0, regen: cls === 'bard' ? .006 : 0, noRoot: cls === 'monk' };
}
// how hard the attacker hits a structure (body hits walls and buildings harder, mind hits towers and guards harder)
const sgDps = (A, kind, F) => ((kind === 'tower' || kind === 'guard' || kind === 'guardU') ? A.mind * (F.sil > 0 ? .5 : 1) + A.body * .5 : A.body + A.mind * .4 * (F.sil > 0 ? .5 : 1)) * (F.buff > 0 ? F.buffK : 1);
const SG_SKILL = {
  guardian: ['🛡️ Bulwark', F => { F.shield = F.A.max * .4; }],
  monk: ['🧘 Still Mind', F => { F.hp = Math.min(F.A.max, F.hp + F.A.max * .35); F.root = 0; F.sil = 0; }],
  sage: ['📜 Insight', F => { F.hp = Math.min(F.A.max, F.hp + F.A.max * .2); F.buff = 8; F.buffK = 1.3; }],
  bard: ['🎻 Rally', F => { F.buff = 10; F.buffK = 1.3; }],
  striker: ['⚡ Blitz', F => { F.buff = 6; F.buffK = 2; }],
  tactician: ['♟️ Gambit', F => { F.buff = 6; F.buffK = 2; }],
  ranger: ['🏹 Eagle Eye', F => { F.eagle = 1; F.buff = 8; F.buffK = 1.25; }],
  rogue: ['💨 Smoke Bomb', F => { F.smoke = 6; }],
  '': ['💪 Second wind', F => { F.hp = Math.min(F.A.max, F.hp + F.A.max * .2); }],
};
// a seeded random number generator (the same seed always gives the same siege)
function sgRnd(seed) { let h = 1779033703 ^ String(seed).length; for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
// where the attacker comes ashore for an entry side (0 to 5)
function sgSpawn(st, side) {
  const rim = sgRim(st).filter(k => sgReach(st, k)), a0 = side * Math.PI / 3;
  const da = k => { const [x, z] = hxPos(...hxQR(k)); let d = Math.atan2(z, x) - a0; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  return rim.sort((a, b) => da(a) - da(b))[0] || rim[0] || hxK(HH_R, 0);
}
function sgReach(st, from) { // can you walk from here to the hall?
  const T = new Map(), t = k => { if (!T.has(k)) T.set(k, sgTerr(k, st)); return T.get(k); };
  const goal = new Set(hxNb('0,0')), seen = new Set([from]), todo = [from];
  while (todo.length) { const k = todo.pop(); if (goal.has(k)) return true; for (const n of hxNb(k)) if (!seen.has(n) && n !== '0,0' && sgStep(t(k), t(n))) { seen.add(n); todo.push(n); } }
  return false;
}
// run a whole siege: returns { stars, pct, t, frames, ev, sum }. ch = { side, prio, when }
function sgRun(d, ch, A, seed = 'test') {
  const Wd = sgWorld(d), { st, S, own, traps } = Wd, rnd = sgRnd(seed + '|' + JSON.stringify(ch)), T = new Map();
  const terr = k => { if (!T.has(k)) T.set(k, sgTerr(k, st)); return T.get(k); };
  const H = k => hxHt(k, st), pos = k => hxPos(...hxQR(k)), dist = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2) / 2; // in hexes
  const start = sgSpawn(st, ch.side || 0), [sx, sz] = pos(start);
  const F = { A, hp: A.max, x: sx, z: sz, y: hxHt(start, st), k: start, t: 0, shield: 0, root: 0, sil: 0, buff: 0, buffK: 1, smoke: 0, eagle: 0, skill: false, banner: 0, planted: false, tgt: null, path: null, next: null, prog: 0, fight: null, act: 'walk', yaw: 0 };
  const ev = [], frames = [], sum = { dmgBy: {}, trapsHit: 0, trapsSpot: 0, guardsBeat: 0, broke: 0, walls: 0 };
  const E = (kind, o = {}) => ev.push({ t: +F.t.toFixed(2), kind, ...o });
  const scored = S.filter(s => s.kind !== 'wall' && s.kind !== 'gate'), pct = () => scored.length ? scored.filter(s => s.hp <= 0).length / scored.length : 1;
  // stars: one for half destroyed, one for the banner at the great hall, one for everything
  const starN = () => (pct() >= .5 ? 1 : 0) + (F.planted ? 1 : 0) + (pct() >= 1 ? 1 : 0);
  let stars = 0; const starCheck = () => { const n = starN(); while (stars < n) { stars++; E('star', { n: stars }); } };
  const alive = i => i != null && S[i].hp > 0;
  const blocker = k => { const i = own[k]; return alive(i) ? i : null; };
  // cheapest route (in seconds) from where the attacker stands; breaking through costs the time to break it
  const dij = (tgt) => {
    const cost = new Map([[F.k, 0]]), prev = new Map(), done = new Set(), q = [[0, F.k]];
    while (q.length) {
      let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
      const [c, k] = q.splice(bi, 1)[0]; if (done.has(k)) continue; done.add(k);
      for (const n of hxNb(k)) {
        if (done.has(n)) continue;
        const tn = terr(n); if (!sgStep(terr(k), tn)) continue;
        const b = blocker(n); if (b != null && b === tgt) continue; // you stand next to the target, not on it
        let w = (tn.cost + (tn.h > terr(k).h ? SG.move.up : 0)) / A.spd * (ch.prio === 'traps' ? 1.18 : 1);
        if (b != null) w += S[b].hp / Math.max(1, sgDps(A, S[b].kind, F));
        const nc = c + w; if (nc < (cost.get(n) ?? 1e9)) { cost.set(n, nc); prev.set(n, k); q.push([nc, n]); }
      }
    }
    return { cost, prev };
  };
  const nextTarget = () => {
    const R = dij(null), cands = [];
    for (const s of S) {
      if (s.hp <= 0) continue;
      let best = 1e9, at = null;
      for (const hk of s.hexes) for (const n of hxNb(hk)) { if (s.hexes.includes(n)) continue; const c = R.cost.get(n); if (c != null && c < best) { best = c; at = n; } }
      if (s.hexes.includes(F.k)) { best = 0; at = F.k; }
      if (at == null) continue;
      const hidden = s.kind === 'guard' && s.guard?.forest && !s.guard.out && dist(F.x, F.z, s.x, s.z) > SG.guardU.see;
      const pr = ch.prio, isDef = s.kind === 'tower' || (s.kind === 'guard' && !hidden), isBank = ['lbank', 'ebank', 'vault', 'treasury'].includes(s.base);
      let pen = 0;
      if (s.kind === 'wall' || s.kind === 'gate') pen += 400; // walls only when they're in the way
      if (pr === 'towers' && !isDef) pen += 60;
      if (pr === 'hall' && s.kind !== 'hall' && !F.planted) pen += 300;
      if (pr === 'treasury' && !isBank) pen += s.kind === 'hall' ? 40 : 80;
      if (s.kind === 'hall' && pr !== 'hall' && S.some(o => o.hp > 0 && o.kind !== 'hall' && o.kind !== 'wall' && o.kind !== 'gate')) pen += 30;
      cands.push({ i: s.i, c: best + pen, at });
    }
    cands.sort((a, b) => a.c - b.c);
    return cands[0] || null;
  };
  const routeTo = i => { // a list of hexes to walk, ending next to structure i
    const s = S[i], R = dij(i); let best = null, bc = 1e9;
    for (const hk of s.hexes) for (const n of hxNb(hk)) { if (s.hexes.includes(n)) continue; const c = R.cost.get(n); if (c != null && c < bc) { bc = c; best = n; } }
    if (best == null) return null;
    const out = []; for (let x = best; x && x !== F.k; x = R.prev.get(x)) out.push(x);
    return out.reverse();
  };
  const hurt = (dmg, from, pierce) => {
    if (A.dodge && rnd() < A.dodge) { E('dodge', { from }); return; }
    dmg *= 1 - A.dr;
    if (F.shield > 0 && !pierce) { const s = Math.min(F.shield, dmg); F.shield -= s; dmg -= s; }
    F.hp -= dmg; sum.dmgBy[from] = (sum.dmgBy[from] || 0) + dmg;
  };
  const useSkill = () => { if (F.skill || F.sil > 0) return; F.skill = true; const sk = SG_SKILL[A.cls] || SG_SKILL['']; sk[1](F); E('skill', { n: sk[0] }); };
  const towerCd = {}; const guards = S.filter(s => s.guard);
  const spotAround = () => {
    for (const n of [F.k, ...hxNb(F.k)]) {
      const tr = traps[n]; if (!tr || tr.done) continue;
      const ch2 = F.eagle ? 1 : Math.min(.95, A.spot * (ch.prio === 'traps' ? 2 : 1) * (n === F.k ? .5 : 1));
      if (n !== F.k && rnd() < ch2) { tr.done = 'spot'; sum.trapsSpot++; E('spot', { k: n, n: tr.n }); }
    }
  };
  const trigger = k => {
    const tr = traps[k]; if (!tr || tr.done) return;
    tr.done = 'hit'; sum.trapsHit++; E('trap', { k, tk: tr.kind, n: tr.n });
    if (tr.kind === 'spike') hurt(SG.trap.spike.dmg * tr.lvm, tr.n, true);
    else if (tr.kind === 'snare') { if (!A.noRoot) F.root = SG.trap.snare.root * tr.lvm; }
    else if (tr.kind === 'rune') F.sil = SG.trap.rune.sil * tr.lvm;
  };
  spotAround();
  const steps = Math.round(SG.len / SG.dt); let lastPick = -9;
  for (let step = 0; step < steps; step++) {
    const dt = SG.dt; F.t = step * dt;
    // timers
    F.root = Math.max(0, F.root - dt); F.sil = Math.max(0, F.sil - dt); F.buff = Math.max(0, F.buff - dt); F.smoke = Math.max(0, F.smoke - dt);
    if (A.regen) F.hp = Math.min(A.max, F.hp + A.max * A.regen * dt);
    // the class skill
    if (!F.skill) { const w = ch.when || 'hurt'; if ((w === 'early' && F.act === 'hit') || (w === 'hurt' && F.hp < A.max * .45) || (w === 'hall' && F.tgt != null && S[F.tgt].kind === 'hall' && F.act === 'hit')) useSkill(); }
    // guards come out when you get close (later in forest), and fight you where they meet you
    for (const g of guards) {
      const G = g.guard; if (G.hp <= 0 || g.hp <= 0 && !G.out) continue;
      const dd = dist(F.x, F.z, G.x, G.z);
      if (!G.out && dist(F.x, F.z, g.x, g.z) <= (G.forest ? SG.guardU.seeForest : SG.guardU.see)) { G.out = true; G.first = G.forest; E('guard', { id: g.id, forest: G.forest }); }
      if (!G.out) continue;
      if (dd > 1.05) { const sp = SG.guardU.sp * 2 * dt / Math.max(.01, dd * 2); G.x += (F.x - G.x) * Math.min(1, sp); G.z += (F.z - G.z) * Math.min(1, sp); G.act = 'walk'; }
      else { G.act = 'hit'; hurt(G.dps * dt * (G.first ? SG.guardU.ambush : 1), 'Guard', false); if (G.first) { G.firstT = (G.firstT || 0) + dt; if (G.firstT > 1.5) G.first = false; } if (!F.fight) F.fight = g.i; }
    }
    // towers shoot when you're in range (higher ground reaches further); smoke hides you
    for (const s of S) {
      if (s.kind !== 'tower' || s.hp <= 0) continue;
      const C = s.base === 'magetw' ? SG.mage : SG.archer, r = C.r + Math.min(SG.hiRMax, (s.h || 0) * SG.hiR);
      towerCd[s.i] = (towerCd[s.i] || 0) - dt;
      if (towerCd[s.i] > 0 || F.smoke > 0 || dist(F.x, F.z, s.x, s.z) > r) continue;
      towerCd[s.i] = C.cd; const dmg = C.dmg * s.m; hurt(dmg, s.n, s.base === 'magetw'); E('shot', { from: s.i, tb: s.base, x: +F.x.toFixed(2), z: +F.z.toFixed(2) });
    }
    if (F.hp <= 0) { F.act = 'dead'; E('dead'); frames.push(sgFrame(F, guards)); break; }
    // fighting a guard who reached you
    if (F.fight != null) {
      const g = S[F.fight], G = g.guard;
      if (!G || G.hp <= 0) F.fight = null;
      else { F.act = 'hit'; F.yaw = Math.atan2(G.x - F.x, G.z - F.z); G.hp -= sgDps(A, 'guardU', F) * dt; if (G.hp <= 0) { sum.guardsBeat++; E('guardDown', { id: g.id }); F.fight = null; } frames.push(sgFrame(F, guards)); continue; }
    }
    // pick a target (and a route to it)
    if (F.tgt == null || !alive(F.tgt) || (!F.next && !F.path?.length && !F.adj)) {
      if (F.tgt != null && !alive(F.tgt)) F.tgt = null;
      if (F.tgt == null && F.t - lastPick > .5) {
        lastPick = F.t; const c = nextTarget();
        if (!c) { F.act = 'idle'; frames.push(sgFrame(F, guards)); if (S.every(s => s.hp <= 0)) break; continue; }
        F.tgt = c.i; F.path = routeTo(c.i); F.adj = F.path && !F.path.length;
      }
    }
    if (F.tgt == null) { F.act = 'idle'; frames.push(sgFrame(F, guards)); continue; }
    const T0 = S[F.tgt], adjNow = T0.hexes.some(h => h === F.k || hxNb(h).includes(F.k));
    if (adjNow && !F.next) {
      // at the target: break it (and plant the banner at the hall)
      F.act = 'hit'; F.yaw = Math.atan2(T0.x - F.x, T0.z - F.z);
      if (T0.kind === 'hall' && !F.planted) { F.banner += dt; if (F.banner >= SG.bannerT) { F.planted = true; E('banner'); } }
      T0.hp -= sgDps(A, T0.kind, F) * dt; sum.dmgDone = (sum.dmgDone || 0) + sgDps(A, T0.kind, F) * dt;
      if (T0.hp <= 0) { T0.hp = 0; sum.broke++; if (T0.kind === 'wall' || T0.kind === 'gate') sum.walls++; E('break', { i: T0.i, id: T0.id, sk: T0.kind }); lastPick = -9; F.tgt = null; F.path = null; F.adj = false; T.clear(); }
      starCheck(); frames.push(sgFrame(F, guards)); continue;
    }
    // walking: one hex at a time; a wall or building in the way gets broken first
    if (!F.next) {
      if (!F.path?.length) { F.path = routeTo(F.tgt); if (!F.path) { F.tgt = null; frames.push(sgFrame(F, guards)); continue; } if (!F.path.length) { F.adj = true; frames.push(sgFrame(F, guards)); continue; } }
      const n = F.path[0], b = blocker(n);
      if (b != null) { // in the way: hit it
        const s = S[b]; F.act = 'hit'; F.yaw = Math.atan2(s.x - F.x, s.z - F.z);
        s.hp -= sgDps(A, s.kind, F) * dt;
        if (s.hp <= 0) { s.hp = 0; sum.broke++; if (s.kind === 'wall' || s.kind === 'gate') sum.walls++; E('break', { i: s.i, id: s.id, sk: s.kind }); T.clear(); starCheck(); }
        frames.push(sgFrame(F, guards)); continue;
      }
      F.next = n; F.from = [F.x, F.z]; F.prog = 0; F.path.shift();
      const tn = terr(n); F.legT = (tn.cost + (tn.h > terr(F.k).h ? SG.move.up : 0)) / A.spd * (ch.prio === 'traps' ? 1.18 : 1);
    }
    if (F.root > 0) { F.act = 'root'; frames.push(sgFrame(F, guards)); continue; }
    F.prog += dt / F.legT; F.act = 'walk';
    const [nx, nz] = pos(F.next); F.yaw = Math.atan2(nx - F.from[0], nz - F.from[1]);
    const p = Math.min(1, F.prog); F.x = F.from[0] + (nx - F.from[0]) * p; F.z = F.from[1] + (nz - F.from[1]) * p; F.y = H(F.k) + (H(F.next) - H(F.k)) * p;
    if (F.prog >= 1) { F.k = F.next; F.next = null; F.y = H(F.k); trigger(F.k); spotAround(); if (F.tgt != null && S[F.tgt].hexes.some(h => hxNb(h).includes(F.k))) F.adj = true; }
    frames.push(sgFrame(F, guards));
    if (S.every(s => s.hp <= 0)) break;
  }
  starCheck();
  stars = starN();
  return { stars, pct: Math.round(pct() * 100), t: +F.t.toFixed(1), dead: F.hp <= 0, hp: Math.max(0, Math.round(F.hp)), max: A.max, frames, ev, sum, start, S: S.map(s => ({ id: s.id, kind: s.kind, n: s.n, e: s.e, x: s.x, z: s.z, k: s.k, hexes: s.hexes, left: Math.round(s.hp), max: Math.round(s.max) })), traps: Object.values(traps).map(t => ({ k: t.k, n: t.n, kind: t.kind, done: t.done || '' })) };
}
const sgFrame = (F, guards) => [+F.x.toFixed(2), +(F.y || 0).toFixed(2), +F.z.toFixed(2), Math.max(0, Math.round(F.hp)), F.act, +F.yaw.toFixed(2), guards.filter(g => g.guard.out).map(g => [g.i, +g.guard.x.toFixed(2), +g.guard.z.toFixed(2), Math.max(0, Math.round(g.guard.hp)), g.guard.act || 'walk'])];

// ---------- Test your defences: briefing, replay, result ----------
const sgBrief = () => (ui.sgBrief = ui.sgBrief || { side: 0, prio: 'towers', when: 'hurt', who: 'me' });
const SG_WHO = [['me', 'You', 'Your own character: stats, class, level and gear'], ['weak', 'A weaker raider', 'About half as strong as you'], ['strong', 'A stronger raider', 'About half as strong again']];
function sgTestHtml(d) {
  const B = sgBrief(), st = hhSaved(d), cls = cdClassInfo(), sk = SG_SKILL[cdClass()] || SG_SKILL[''];
  const btns = (list, key, cur) => list.map(([id, e, n, t]) => `<button class="btn small ${cur === id ? 'primary' : ''}" data-sg="b" data-k="${key}" data-v="${id}" ${t ? `title="${esc(t)}"` : ''}>${e} ${n}</button>`).join('');
  const sides = SG_SIDES.map((n, i) => `<button class="btn small ${B.side === i ? 'primary' : ''}" data-sg="b" data-k="side" data-v="${i}">${n}</button>`).join('');
  const nT = Object.values(st.b).filter(s => hxW(st).item(s.id)?.slot === 'tower').length, nTr = Object.values(st.b).filter(s => hxW(st).item(s.id)?.slot === 'trap').length;
  return `<p class="muted small-text">Watch an attacker try to take your house island, exactly as it is now: walls, towers, traps, guard posts and the shape of the land. Nothing is damaged and nobody gets anything, it's practice. Traps stay hidden from the attacker.</p>
    <p class="small-text">🛡️ ${nT} tower${nT === 1 ? '' : 's'} · ${nTr} trap${nTr === 1 ? '' : 's'} · ${(d.b?._wl || []).length} wall hexes · ${sgStrongN(sgTfOf(d))} strong terrain hexes</p>
    <div class="ftlbl">Who attacks</div><div class="row wrap" style="gap:6px">${SG_WHO.map(([id, n, t]) => `<button class="btn small ${B.who === id ? 'primary' : ''}" data-sg="b" data-k="who" data-v="${id}" title="${esc(t)}">${n}</button>`).join('')}</div>
    <div class="ftlbl">Lands on the</div><div class="row wrap" style="gap:6px">${sides}</div>
    <div class="ftlbl">Goes for</div><div class="row wrap" style="gap:6px">${btns(SG_PRIO, 'prio', B.prio)}</div>
    <div class="ftlbl">Uses ${esc(sk[0])} ${cls ? `(${cls.n})` : ''}</div><div class="row wrap" style="gap:6px">${btns(SG_WHEN, 'when', B.when)}</div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn primary" data-sg="go">⚔️ Watch the attack</button><span class="muted small-text">Plays at 2× speed, skip any time.</span></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-sg="b"],[data-sg="go"],[data-sg="skip"],[data-sg="speed"],[data-sg="again"],[data-sg="close"],[data-sg="follow"]'); if (!el) return;
  const a = el.dataset.sg, B = sgBrief();
  if (a === 'b') { B[el.dataset.k] = el.dataset.k === 'side' ? +el.dataset.v : el.dataset.v; sgSideMark(); render(); return; }
  if (a === 'go') { sgTestGo(); return; }
  if (a === 'again') { ui.sgRun = null; sgReplayStop(); Object.assign(ui, { isPanel: 'sgtest' }); render(); return; }
  if (a === 'close') { ui.sgRun = null; sgReplayStop(); ui.isPanel = null; render(); return; }
  if (a === 'skip') { if (ui.sgRun) { ui.sgRun.rt = ui.sgRun.res.t + 1; } return; }
  if (a === 'speed') { const R = ui.sgRun; if (R) { R.speed = R.speed === 2 ? 4 : R.speed === 4 ? 1 : 2; el.textContent = `⏩ ${R.speed}×`; } return; }
  if (a === 'follow') { const R = ui.sgRun; if (R) { R.follow = !R.follow; el.classList.toggle('on', R.follow); } }
});
function sgTestGo() {
  const B = sgBrief(), d = HI.doc; if (!d) return;
  const k = B.who === 'weak' ? .5 : B.who === 'strong' ? 1.5 : 1, me = sgAttacker();
  const A = B.who === 'me' ? me : { ...me, n: B.who === 'weak' ? 'A weaker raider' : 'A stronger raider', body: me.body * k, mind: me.mind * k, max: Math.round(me.max * (k > 1 ? 1.35 : .7)) };
  const res = sgRun(d, { side: B.side, prio: B.prio, when: B.when }, A, 'test|' + hsState().id + '|' + Date.now());
  ui.isPanel = null; ui.isSel = null; ui.hxP = null;
  ui.sgRun = { res, A, B: { ...B }, rt: 0, speed: 2, follow: true, done: false };
  render(); sgReplayStart();
}
// a ring on the coast where the attacker will land (while the briefing is open)
function sgSideMark() {
  const want = (ui.isPanel === 'sgtest' || ui.isPanel === 'sgmarch') && window.THREE && IS3.scene && IS3.house === 'hexh' && HI.doc ? sgSpawn(hhSaved(), sgBrief().side) : null;
  if (HX3.sgMark && want && HX3.sgMark.userData.k === want) { if (!IS3.scene.children.includes(HX3.sgMark)) IS3.scene.add(HX3.sgMark); return; }
  if (HX3.sgMark) { HX3.sgMark.parent?.remove(HX3.sgMark); HX3.sgMark = null; }
  if (!want) return;
  const st = hhSaved(), k = want, [x, z] = hxPos(...hxQR(k)), g = HX3.sgMark = new THREE.Group(); g.userData.k = k;
  const r = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 6), new THREE.MeshBasicMaterial({ color: '#ff5b3d', transparent: true, opacity: .9, depthWrite: false })); r.rotation.set(-Math.PI / 2, 0, Math.PI / 6); r.position.set(x, .15 + hxHt(k, st), z); g.add(r);
  const f = is3mesh(new THREE.ConeGeometry(.35, .9, 4), '#ff5b3d', x, 1.4 + hxHt(k, st), z, g, true); f.rotation.x = Math.PI;
  IS3.scene.add(g); is3draw();
}

// ---------- the replay ----------
const SGR = { raf: 0, H: null, gs: {}, fx: [], hid: {}, evI: 0, t0: 0, last: 0 };
function sgReplayStart() {
  sgReplayStop(true);
  const R = ui.sgRun; if (!R || !window.THREE || !IS3.world) return;
  if (HX3.sgMark) { IS3.scene.remove(HX3.sgMark); HX3.sgMark = null; }
  const g = SGR.g = new THREE.Group(); IS3.scene.add(g);
  // the attacker: your own character (or a plain marker if the characters haven't loaded)
  let H = null; try { if (heroReady()) H = heroMake({ outfit: heroOutfitOf(R.A.cls), cls: R.A.cls ? CD_CLASSES.find(c => c.id === R.A.cls)?.col : undefined, scale: .6 }); } catch (e) { console.error(e); }
  if (H) { g.add(H.root); SGR.H = H; } else { const m = is3mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(.3, .6, 4, 8) : new THREE.CylinderGeometry(.3, .3, 1.2, 8), '#ff5b3d', 0, .7, 0); const w = new THREE.Group(); w.add(m); g.add(w); SGR.H = { root: w, play() { }, update() { } }; }
  // a glowing ring under the attacker so they're easy to follow
  const ring = SGR.ring = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 24), new THREE.MeshBasicMaterial({ color: '#ff5b3d', transparent: true, opacity: .85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const ban = SGR.ban = new THREE.Group(); is3mesh(new THREE.CylinderGeometry(.04, .04, 1.6, 5), '#5c3d24', 0, .8, 0, ban); is3mesh(new THREE.BoxGeometry(.7, .45, .03), '#ff5b3d', .37, 1.35, 0, ban, true); ban.visible = false; g.add(ban);
  SGR.gs = {}; SGR.fx = []; SGR.hid = {}; SGR.evI = 0; SGR.last = performance.now();
  // the buildings by hex, so broken ones can crumble
  SGR.byHex = {}; IS3.world.traverse(o => { if (o.userData?.hk) (SGR.byHex[o.userData.hk] = SGR.byHex[o.userData.hk] || []).push(o); });
  IS3.tgt0 = IS3.tgt ? [...IS3.tgt] : [0, 0]; IS3.dist0 = IS3.dist;
  IS3.dist = Math.min(IS3.dist, 28);
  if (typeof sfx === 'function') sfx('start');
  const tick = now => {
    SGR.raf = 0; const R2 = ui.sgRun; if (!R2 || view !== 'islands' || ui.isTab !== 'house') { sgReplayStop(); return; }
    const dt = Math.min(.1, (now - SGR.last) / 1000); SGR.last = now;
    if (!R2.done) R2.rt += dt * R2.speed;
    sgReplayStep(R2, dt);
    is3draw();
    SGR.raf = requestAnimationFrame(tick);
  };
  SGR.raf = requestAnimationFrame(tick);
}
function sgReplayStop(keep) {
  if (SGR.raf) cancelAnimationFrame(SGR.raf); SGR.raf = 0;
  if (SGR.g) { IS3.scene?.remove(SGR.g); SGR.H?.dispose?.(); for (const gg of Object.values(SGR.gs)) gg.H?.dispose?.(); SGR.g = null; }
  if (SGR.hid && Object.keys(SGR.hid).length) { for (const os of Object.values(SGR.hid)) for (const o of os) o.visible = true; SGR.hid = {}; }
  if (SGR.rub) { for (const r of SGR.rub) IS3.world?.remove(r); SGR.rub = null; }
  if (!keep && IS3.tgt0) { IS3.tgt = IS3.tgt0; IS3.dist = IS3.dist0 || IS3.dist; IS3.tgt0 = null; is3draw(); }
}
function sgReplayStep(R, dt) {
  const res = R.res, fr = res.frames, i = Math.min(fr.length - 1, Math.floor(R.rt / SG.dt)), f = fr[i], f2 = fr[Math.min(fr.length - 1, i + 1)], p = Math.min(1, (R.rt / SG.dt) - i);
  if (!f) return;
  const H = SGR.H, x = f[0] + (f2[0] - f[0]) * p, y = f[1] + (f2[1] - f[1]) * p, z = f[2] + (f2[2] - f[2]) * p;
  H.root.position.set(x, y, z); SGR.ring.position.set(x, y + .08, z); SGR.ring.visible = f[4] !== 'dead';
  let dy = f[5] - H.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); H.root.rotation.y += dy * Math.min(1, dt * 10);
  const act = f[4], sp = R.speed;
  H.play(act === 'dead' ? 'Death_A' : act === 'hit' ? '2H_Melee_Attack_Chop' : act === 'walk' ? 'Running_A' : act === 'root' ? 'Hit_A' : 'Idle', { loop: act !== 'dead' });
  H.speed?.(R.done ? 1 : sp * (act === 'walk' ? .9 : .6)); H.update(dt);
  // guards
  const seen = new Set();
  for (const [gi, gx, gz, ghp, gact] of f[6] || []) {
    seen.add(gi); let G = SGR.gs[gi];
    if (!G) { let gh = null; try { if (heroReady()) gh = heroMake({ outfit: 'Knight', cls: hsHouse(hhHid())?.col, scale: .5, spec: { ...avatarSpec(), hair: 'h_short' } }); } catch (e) { } if (!gh) { const w = new THREE.Group(); is3mesh(new THREE.CylinderGeometry(.28, .28, 1.1, 8), '#4dabf7', 0, .55, 0, w); gh = { root: w, play() { }, update() { } }; } SGR.g.add(gh.root); G = SGR.gs[gi] = { H: gh }; }
    G.H.root.position.set(gx, hxHt(hxFromXZ(gx, gz), hhSaved()), gz); G.H.root.rotation.y = Math.atan2(x - gx, z - gz); G.H.root.visible = ghp > 0;
    G.H.play(ghp <= 0 ? 'Death_A' : gact === 'hit' ? '1H_Melee_Attack_Slice_Diagonal' : 'Running_A', { loop: ghp > 0 }); G.H.speed?.(sp * .6); G.H.update(dt);
  }
  for (const [gi, G] of Object.entries(SGR.gs)) if (!seen.has(+gi)) G.H.root.visible = false;
  // camera follows the attacker
  if (R.follow && IS3.tgt) { IS3.tgt = [IS3.tgt[0] + (x - IS3.tgt[0]) * Math.min(1, dt * 2.5), IS3.tgt[1] + (z - IS3.tgt[1]) * Math.min(1, dt * 2.5)]; }
  // events up to now
  while (SGR.evI < res.ev.length && res.ev[SGR.evI].t <= R.rt) sgReplayEv(res.ev[SGR.evI++], R, x, y, z);
  // effects (arrows, bolts, puffs)
  const now = performance.now();
  SGR.fx = SGR.fx.filter(o => {
    const q = (now - o.t0) / (o.dur / (R.speed / 2)); if (q >= 1) { SGR.g.remove(o.m); return false; }
    if (o.from) o.m.position.set(o.from[0] + (o.to[0] - o.from[0]) * q, o.from[1] + (o.to[1] - o.from[1]) * q + Math.sin(q * Math.PI) * (o.arc || 0), o.from[2] + (o.to[2] - o.from[2]) * q);
    if (o.grow) { o.m.scale.setScalar(1 + q * o.grow); o.m.material.opacity = 1 - q; }
    return true;
  });
  sgHudUpdate(R, f);
  if (R.rt >= res.t + .8 && !R.done) { R.done = true; render(); if (typeof sfx === 'function') sfx(res.stars >= 2 ? 'success' : 'deny'); }
}
function sgReplayEv(e, R, x, y, z) {
  const res = R.res, s = e.i != null ? res.S[e.i] : e.from != null ? res.S[e.from] : null, M = (geo, col, glow) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: glow ? col : '#000', emissiveIntensity: glow ? .9 : 0, transparent: true })); SGR.g.add(m); return m; };
  const log = t => { R.log = [t, ...(R.log || [])].slice(0, 4); };
  const st = hhSaved();
  if (e.kind === 'shot' && s) {
    const m = e.tb === 'magetw' ? M(new THREE.IcosahedronGeometry(.18, 1), '#b197fc', true) : M(new THREE.CylinderGeometry(.03, .03, .5, 4), '#5c3d24');
    if (e.tb !== 'magetw') m.rotation.x = Math.PI / 2;
    const h0 = hxHt(s.k, st) + 2.2; SGR.fx.push({ m, t0: performance.now(), dur: 380, from: [s.x, h0, s.z], to: [e.x, y + .8, e.z], arc: .6 });
    if (typeof sfx === 'function') sfx(e.tb === 'magetw' ? 'cast' : 'swing', { gap: 120 });
  } else if (e.kind === 'break' && s) {
    log(`💥 ${s.e} ${s.n} broken`);
    for (const k of s.hexes) for (const o of SGR.byHex[k] || []) { if (o.visible) { o.visible = false; (SGR.hid[k] = SGR.hid[k] || []).push(o); } }
    if (s.kind !== 'wall' && s.kind !== 'gate') for (const k of s.hexes.slice(0, 1)) { const [hx, hz] = hxPos(...hxQR(k)), r = hxModel('building_destroyed', hxCol()); r.position.set(hx, hxHt(k, st), hz); IS3.world.add(r); (SGR.rub = SGR.rub || []).push(r); }
    const pf = M(new THREE.IcosahedronGeometry(.9, 1), '#d8c8a8'); pf.position.set(s.x, 1, s.z); SGR.fx.push({ m: pf, t0: performance.now(), dur: 700, grow: 1.6 });
    if (typeof sfx === 'function') sfx(s.kind === 'hall' ? 'slam' : 'hithard');
  } else if (e.kind === 'trap') {
    log(`🪤 ${e.n} sprung!`); const [tx, tz] = hxPos(...hxQR(e.k)), r = M(new THREE.RingGeometry(.4, 1.2, 6), e.tk === 'rune' ? '#9775fa' : '#ff6b6b', true); r.rotation.x = -Math.PI / 2; r.position.set(tx, hxHt(e.k, st) + .1, tz); SGR.fx.push({ m: r, t0: performance.now(), dur: 900, grow: 1.2 });
    if (typeof sfx === 'function') sfx('hurt');
  } else if (e.kind === 'spot') { log(`🔎 Spotted and disarmed a ${e.n.toLowerCase()}`); const [tx, tz] = hxPos(...hxQR(e.k)), r = M(new THREE.RingGeometry(.5, .8, 6), '#69db7c', true); r.rotation.x = -Math.PI / 2; r.position.set(tx, hxHt(e.k, st) + .1, tz); SGR.fx.push({ m: r, t0: performance.now(), dur: 900, grow: .8 }); }
  else if (e.kind === 'guard') { log(e.forest ? '🌲 A guard leapt out of the forest!' : '🛡️ A guard steps out'); if (typeof sfx === 'function') sfx('clank'); }
  else if (e.kind === 'guardDown') log('🛡️ A guard is beaten');
  else if (e.kind === 'skill') { log(`✨ ${e.n}`); const r = M(new THREE.TorusGeometry(.9, .06, 4, 20), '#ffd43b', true); r.rotation.x = Math.PI / 2; r.position.set(x, y + .4, z); SGR.fx.push({ m: r, t0: performance.now(), dur: 800, grow: 1.4 }); if (typeof sfx === 'function') sfx('cast'); }
  else if (e.kind === 'banner') { log('🚩 The banner is planted at the great hall!'); SGR.ban.visible = true; SGR.ban.position.set(x + .5, y, z + .3); }
  else if (e.kind === 'star') { if (typeof sfx === 'function') sfx('coin'); R.flash = performance.now(); }
  else if (e.kind === 'dodge') { }
  else if (e.kind === 'dead') log('☠️ The attacker falls');
}
function sgHudUpdate(R, f) {
  const el = document.getElementById('sghud'); if (!el) return;
  const res = R.res, t = Math.min(res.t, R.rt), ev = res.ev.filter(e => e.t <= R.rt), stars = Math.min(3, ev.filter(e => e.kind === 'star').length ? Math.max(...ev.filter(e => e.kind === 'star').map(e => e.n)) : 0);
  const sc = res.S.filter(s => s.kind !== 'wall' && s.kind !== 'gate'), broke = new Set(ev.filter(e => e.kind === 'break').map(e => e.i)), pct = sc.length ? Math.round(sc.filter(s => broke.has(res.S.indexOf(s))).length / sc.length * 100) : 0;
  const q = s => el.querySelector(s);
  q('.sg-t').textContent = `${Math.floor((SG.len - t) / 60)}:${String(Math.floor((SG.len - t) % 60)).padStart(2, '0')}`;
  q('.sg-st').innerHTML = [1, 2, 3].map(n => `<i class="${n <= stars ? 'on' : ''}">★</i>`).join('');
  q('.sg-pc').textContent = pct + '%';
  q('.sg-hp i').style.width = Math.max(0, f[3] / res.max * 100) + '%';
  q('.sg-log').innerHTML = (R.log || []).map(x => `<div>${esc(x)}</div>`).join('');
}
function sgRunHtml() {
  const R = ui.sgRun; if (!R) return '';
  if (!R.done) return `<div class="ishud is-tc sghud" id="sghud"><div class="sg-top"><b class="sg-t">3:00</b><span class="sg-st"></span><span class="sg-pc">0%</span></div><div class="sg-who">⚔️ ${esc(R.A.n)} <span class="sg-hp"><i></i></span></div><div class="sg-log"></div></div>
    <div class="ishud is-bc sgctl"><button class="btn small ${R.follow ? 'on' : ''}" data-sg="follow" title="The camera follows the attacker">🎥 Follow</button><button class="btn small" data-sg="speed">⏩ ${R.speed}×</button><button class="btn small primary" data-sg="skip">⏭ Skip</button></div>`;
  const res = R.res, by = Object.entries(res.sum.dmgBy).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const verdict = res.stars >= 3 ? 'The island fell completely.' : res.stars === 2 ? 'The attacker would have won this siege.' : res.stars === 1 ? 'A close one: one star isn\'t a win (a siege needs an average of 1.5).' : 'The island held!';
  return isPanel(`${res.stars >= 2 ? '🏳️' : '🛡️'} ${R.real ? 'Siege run' : R.watch ? 'Replay' : 'Test result'}: ${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}`, `<p><b>${verdict}</b> ${esc(R.A.n)} ${res.dead ? `fell after ${Math.round(res.t)} seconds` : res.pct >= 100 ? `destroyed everything in ${Math.round(res.t)} seconds` : 'ran out of time'}, with ${res.pct}% of the island destroyed${res.sum.walls ? ` and ${res.sum.walls} wall hex${res.sum.walls === 1 ? '' : 'es'} broken` : ''}.</p>
    <p class="small-text">Landed on the ${SG_SIDES[R.B.side].toLowerCase()} side · went for ${SG_PRIO.find(p => p[0] === R.B.prio)[2].toLowerCase()}.</p>
    ${by.length ? `<div class="ftlbl">What hurt them most</div><p class="small-text">${by.map(([n, v]) => `${esc(n)}: ${Math.round(v)}`).join(' · ')} (of ${res.max} health)</p>` : '<p class="small-text">Nothing on the island hurt them. Towers, traps and guard posts fight back.</p>'}
    <p class="small-text">🪤 Traps sprung: ${res.sum.trapsHit} · spotted and disarmed: ${res.sum.trapsSpot} · 🛡️ guards beaten: ${res.sum.guardsBeat}</p>
    <p class="muted small-text">Ideas: towers on raised ground reach further, moats and cliffs force attackers round to where your towers are, forest slows them and hides guards, and traps on the only way in are hard to avoid.</p>
    ${(R.real || R.watch) && typeof sgRunBtns === 'function' ? sgRunBtns(R) : '<div class="row" style="gap:8px"><button class="btn primary" data-sg="again">⚔️ Try another</button><button class="btn" data-sg="go">↻ Same again</button><button class="btn ghost" data-sg="close">Done</button></div>'}`).replace('class="ispanel"', 'class="ispanel sgres"');
}

// ---------- the house island HUD buttons and panels (hisland.js calls these) ----------
function sgPanel(pn, d) {
  if (pn === 'sglooks') return isPanel('🎨 House island looks', sgFortHtml(d));
  if (pn === 'sgtest') return isPanel('⚔️ Test your defences', sgTestHtml(d));
  if (pn === 'sgwar' && typeof sgWarHtml === 'function') return isPanel('⚔️ War room', sgWarHtml(d)).replace('class="ispanel"', 'class="ispanel iswide"');
  return '';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-sg="shape"]'); if (!el || !hhCanEdit()) return;
  hxStartPlace({ id: 'htf', mode: 'tool', n: 0, ops: [], brush: ui.sgBrush || 'forest' });
});

// ---------- the walkthrough ----------
const sgGuideHome = () => { view = 'islands'; Object.assign(ui, { isTab: 'house', isPanel: null, isSel: null, hxP: null }); render(); };
if (typeof GUIDES === 'object') GUIDES.fortify = {
  name: 'Fortify the house island',
  end: () => { ui.isPanel = null; if (view === 'islands') render(); },
  steps: [
    { title: 'Get your fortress ready ⚔️', text: 'Sieges are coming: one day another house will try to take your island. Now you can shape the land to defend it, and test it.', go: sgGuideHome, wait: 600 },
    { title: 'Shape the land', go: sgGuideHome, text: 'The Architect and Warlord open 🔨 <b>Build</b> and press ⛰️ <b>Shape the land</b>: forest slows attackers, cliffs and moats stop them, and towers on raised ground shoot further. Moats and cliffs cost more and are limited by house level. There\'s always one way in.', sel: '#isfull [data-hm="build"]' },
    { title: 'Test your defences', go: sgGuideHome, text: 'Open ⚔️ <b>War</b> and press 🎯 <b>Test your defences</b> to watch your own character try to take the island from any side. Nothing is damaged. Try different sides and see where it\'s weak.', sel: '#isfull [data-hm="war"]' },
    { title: 'A fortress look', go: sgGuideHome, text: 'Open 🔨 <b>Build</b> (or <b>Looks</b>) and press 🎨 <b>Island look</b> for the Stone fortress look: stone ground, rocky crags and a keep. It\'s just a look: defences work the same either way.', sel: '#isfull [data-hm="build"]' },
  ],
};
// closing the result (or the briefing) ends the replay and takes the landing ring away
document.addEventListener('click', e => {
  if (!e.target.closest?.('[data-is="close"]')) return;
  if (ui.sgRun) { sgReplayStop(); ui.sgRun = null; }
  setTimeout(sgSideMark, 30);
}, true);
