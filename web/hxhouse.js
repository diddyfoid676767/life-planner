'use strict';
/* House island on hexes (2.66, roadmap stage 3, second half). The shared house
   island uses the same hex engine as your own island (hexworld.js): the same
   KayKit models, roads, walls, ghost placing and drag to move. It is kept in
   the house document (hisland.js) without new top-level keys:
   - each building's b[key].at is now a hex ('q,r') and b[key].rot its turn;
   - b._rd is the list of road hexes, b._wl the wall hexes ('g' in front = a gate).
   Buildings from the old square island get a hex spot and a free road to the
   great hall the first time anyone opens the island (once, saved for everyone).
   Leaders place, move and lay roads and walls; everyone else can look and tap.
   House perks only work when a road joins the building to the great hall.
   A closed ring of wall round the hall keeps the Friday boss raid out.
   All numbers were approved by Eli on 14 Nov 2026 (hex-world/buildings-draft.md). */

const HH_R = 7; // land radius in hexes (169 land hexes, 217 with the water ring)
const HH_WALL = { l: 0, x: 40 }, HH_GATE = { l: 0, x: 80 }, HH_WALL_LV = 2;
const HH_BANK = { rate: .01, cap: 500 }, HH_VAULT = 2000;
// defence space by house level: wall hexes (gates count), towers, traps, guard posts
const HH_SLOTS = [[0, 0, 0, 0], [0, 0, 0, 0], [6, 1, 0, 0], [12, 2, 0, 0], [18, 3, 2, 0], [24, 4, 3, 1], [30, 5, 4, 2], [60, 6, 6, 4]];
const hhSlots = (lv = hiLevel()) => { const s = HH_SLOTS[Math.min(lv, 7)]; return { wall: s[0], tower: s[1], trap: s[2], guard: s[3] }; };
const HH_SLOT_N = { tower: 'tower', trap: 'trap', guard: 'guard post' };

// ---------- custom models (the only ones KayKit doesn't have) ----------
const hhStone = '#e3ddd0', hhGold = '#ffc94d';
const hhG = () => new THREE.Group();
const hhHexCyl = (r, h, col, y, g, glow) => { const m = is3mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 6), col, 0, y + h / 2, 0, g, glow); m.rotation.y = Math.PI / 6; return m; };
const HH_MAKE = {
  steps(col) { const g = hhG(); [[2.3, .35], [1.75, .35], [1.2, .35]].forEach(([r, h], i) => hhHexCyl(r, h, i % 2 ? '#d6cfbf' : hhStone, i * .35, g)); hhHexCyl(.6, .25, hhGold, 1.05, g, true); return g; },
  pillars(col) {
    const g = hhG(); hhHexCyl(2.2, .3, hhStone, 0, g);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; is3mesh(new THREE.CylinderGeometry(.16, .2, 2.1, 8), '#f1ece2', Math.cos(a) * 1.55, 1.35, Math.sin(a) * 1.55, g); is3mesh(new THREE.BoxGeometry(.45, .14, .45), '#d6cfbf', Math.cos(a) * 1.55, 2.45, Math.sin(a) * 1.55, g); }
    hhHexCyl(1.9, .22, '#d6cfbf', 2.5, g); hhHexCyl(.35, .3, hhGold, 2.72, g, true); return g;
  },
  sundome(col) {
    const g = hhG(); hhHexCyl(3.4, .3, '#d6cfbf', 0, g); hhHexCyl(2.9, .3, hhStone, .3, g);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; is3mesh(new THREE.CylinderGeometry(.18, .22, 1.8, 8), '#f1ece2', Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2, g); }
    is3mesh(new THREE.CylinderGeometry(2.45, 2.45, .3, 16), '#d6cfbf', 0, 2.5, 0, g);
    is3mesh(new THREE.SphereGeometry(2.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ffa94d', 0, 2.62, 0, g);
    is3mesh(new THREE.CylinderGeometry(.06, .1, 1.1, 6), hhGold, 0, 5.1, 0, g, true);
    const sun = is3mesh(new THREE.IcosahedronGeometry(.32, 1), hhGold, 0, 5.8, 0, g, true); HX3.anim.push({ o: sun, spin: .8 });
    return g;
  },
  pier(col) {
    const g = hhG(), wood = '#9c7046';
    is3mesh(new THREE.BoxGeometry(2.6, .14, 1), wood, .9, .12, 0, g);
    for (let i = 0; i < 6; i++) is3mesh(new THREE.BoxGeometry(.06, .02, 1.02), '#7a5535', -.25 + i * .48, .2, 0, g);
    for (const [x, z] of [[.6, .45], [.6, -.45], [2.1, .45], [2.1, -.45]]) is3mesh(new THREE.CylinderGeometry(.08, .08, 1, 6), '#6b4a2e', x, -.25, z, g);
    g.add(Object.assign(hxModel('crate_A_big', col), { position: new THREE.Vector3(-.2, .2, .25) }));
    g.add(Object.assign(hxModel('barrel', col), { position: new THREE.Vector3(.1, .2, -.25) }));
    return g;
  },
  beacon(col) { const g = hhG(); g.add(hxModel('building_tower_A', col)); const f = is3mesh(new THREE.IcosahedronGeometry(.32, 1), '#fff3bf', 0, 2.55, 0, g, true); HX3.anim.push({ o: f, spin: 1.4 }); return g; },
  signal(col) { const g = hhG(); g.add(hxModel('building_tower_base', col)); const f = is3mesh(new THREE.ConeGeometry(.3, .7, 6), '#ff922b', 0, 1.85, 0, g, true); HX3.anim.push({ o: f, flick: Math.random() * 6 }); is3mesh(new THREE.ConeGeometry(.16, .4, 6), '#ffe066', 0, 1.75, 0, g, true); return g; },
  vault(col) { const g = hhG(); g.add(hxModel('building_tower_base', col)); is3mesh(new THREE.BoxGeometry(.42, .62, .08), '#495057', 0, .31, .5, g); is3mesh(new THREE.TorusGeometry(.08, .025, 4, 12), '#adb5bd', .1, .32, .55, g); return g; },
  spike(col) { const g = hhG(); is3mesh(new THREE.CylinderGeometry(.75, .8, .06, 6), '#6b4f36', 0, .03, 0, g); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, r = i ? .42 : 0; is3mesh(new THREE.ConeGeometry(.07, .38, 4), '#adb5bd', Math.cos(a) * r, .22, Math.sin(a) * r, g); } return g; },
  snare(col) { const g = hhG(); is3mesh(new THREE.TorusGeometry(.45, .04, 4, 18), '#c9a26b', 0, .05, 0, g).rotation.x = Math.PI / 2; is3mesh(new THREE.CylinderGeometry(.05, .06, .6, 5), '#6b4a2e', .55, .3, 0, g); return g; },
  rune(col) { const g = hhG(); const d = is3mesh(new THREE.CylinderGeometry(.6, .6, .04, 6), '#9775fa', 0, .03, 0, g, true); d.rotation.y = Math.PI / 6; const r = is3mesh(new THREE.TorusGeometry(.42, .03, 3, 6), '#e5dbff', 0, .07, 0, g, true); r.rotation.x = Math.PI / 2; HX3.anim.push({ o: d, spin: .5 }); return g; },
};
// how each house project looks on hexes: a KayKit model (m, scale s, extra props), or a custom model;
// hz = hexes it covers, need = terrain it must touch, noRoad = works without a road
const HH_LOOK = {
  banner: { m: 'building_home_B', add: [['@flag', .55, .55, 0, 1.6], ['@flag', -.55, .55, 0, 1.6]] },
  yard: { m: 'building_archeryrange' },
  tent: { m: 'tent', s: 2.6, add: [['barrel', .8, .55, 0, 1.6], ['bucket_water', -.8, .5, 0, 1.6]] },
  signal: { make: HH_MAKE.signal },
  library: { m: 'building_church' },
  warforge: { m: 'building_blacksmith' },
  bastion: { m: 'building_tower_catapult' },
  pier: { make: HH_MAKE.pier, need: 'water' },
  beacon: { make: HH_MAKE.beacon },
  steps: { make: HH_MAKE.steps, hz: 3 },
  pillars: { make: HH_MAKE.pillars, hz: 3 },
  sundome: { make: HH_MAKE.sundome, hz: 7 },
  lbank: { m: 'building_market', col: 'blue', add: [['crate_A_big', .75, .5, 0, 1.4]] },
  ebank: { m: 'building_market', col: 'red', add: [['crate_B_big', .75, .5, 0, 1.4]] },
  vault: { make: HH_MAKE.vault, noRoad: true },
  treasury: { m: 'building_home_A', add: [['crate_A_big', .6, .5, 0, 1.6], ['crate_B_small', -.6, .55, 0, 1.8], ['sack', .65, -.4, 0, 1.6]], noRoad: true },
  archer: { m: 'building_tower_A', noRoad: true },
  magetw: { m: 'building_tower_B', noRoad: true },
  spike: { make: HH_MAKE.spike, noRoad: true },
  snare: { make: HH_MAKE.snare, noRoad: true },
  rune: { make: HH_MAKE.rune, noRoad: true },
  guard: { m: 'tent', s: 1.7, add: [['weaponrack', .7, .3, -.5, 2.2], ['target', -.7, .3, .5, 2]], noRoad: true },
};
const HH_IT = {};
function hhItem(id) {
  if (HH_IT[id]) return HH_IT[id];
  if (id === 'wall' || id === 'gate') return (HH_IT[id] = { id, n: id === 'gate' ? 'Gate' : 'Wall', e: id === 'gate' ? '🚪' : '🧱', wall: true, gate: id === 'gate', noRoad: true });
  const it = hiItem(id); if (!it) return null;
  return (HH_IT[id] = { ...it, ...HH_LOOK[id] });
}
const hiBase = key => String(key).split('.')[0];
const hiKeys = d => Object.keys(d?.b || {}).filter(k => k[0] !== '_' && hiItem(hiBase(k)));

// ---------- the land: seeded per house, grass in the middle, woods and hills towards the coast ----------
const HH_LAND = {};
function hhLand(h = hsState().id) {
  if (HH_LAND[h]) return HH_LAND[h];
  const rnd = seeded('solis-hh-' + h), M = new Map(), ring = [];
  for (let q = -HH_R - 1; q <= HH_R + 1; q++) for (let r = -HH_R - 1; r <= HH_R + 1; r++) { const d = hxDist(q, r); if (d <= HH_R + 1) M.set(hxK(q, r), { t: d === HH_R + 1 ? 'water' : 'grass', v: rnd(), d }); }
  const at = d => [...M].filter(([, x]) => x.d === d).map(([k]) => k), pick = a => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < 6; i++) { const c = pick([...at(5), ...at(6)]); for (const k of [c, ...hxNb(c)]) if (M.get(k)?.t === 'grass' && M.get(k).d >= 4 && rnd() < .7) M.get(k).t = 'forest'; }
  for (let i = 0; i < 4; i++) { const k = pick(at(6)); if (M.get(k).t === 'grass') M.get(k).t = 'hill'; }
  for (let i = 0; i < 3; i++) { const k = pick(at(7)); if (M.get(k).t === 'grass') M.get(k).t = 'mount'; }
  for (const [, x] of M) if (x.t === 'grass' && x.d >= 4 && rnd() < .04) x.t = 'rock';
  return (HH_LAND[h] = M);
}

// ---------- the hex state the engine reads, built from the house document ----------
const hhMigrated = d => Array.isArray(d?.b?._rd);
let HH_W = null;
function hhWorld() {
  const h = hsState().id, hl = HI.doc ? hiLevel() : 1, key = h + hl;
  if (HH_W?.key === key) return HH_W;
  const H = hsHouse(h) || { e: '🏰', name: 'House' };
  return (HH_W = {
    key, R: HH_R, seed: h, col: hxCol(), noClear: true, house: true,
    land: () => hhLand(h), item: hhItem, look: hhLook, dress: hhDress, sig: hhSig,
    free: [{ id: 'ghall', n: `${H.name} great hall`, e: H.e, m: 'building_castle', at: '0,0', rot: 0, s: 1 + Math.min(11, hl - 1) * .045 }],
  });
}
// ops = roads and walls being laid right now, before they're saved
function hhStOf(d, ops = []) {
  if (!hhMigrated(d)) d = hhMigrate(JSON.parse(JSON.stringify(d || {})));
  const b = {}, occ = {}, road = [...d.b._rd], wl = [...(d.b._wl || [])];
  for (const key of hiKeys(d)) {
    const s = d.b[key], it = hhItem(hiBase(key)); if (!it || typeof s.at !== 'string') continue;
    b[s.at] = { id: it.id, key, rot: s.rot || 0 }; for (const f of hxFoot(it, s.at)) if (f !== s.at) occ[f] = s.at;
  }
  for (const [t, k] of ops) {
    if (t === 'x') { const i = road.indexOf(k); if (i >= 0) road.splice(i, 1); const j = wl.findIndex(w => w === k || w === 'g' + k); if (j >= 0) wl.splice(j, 1); }
    else if (t === 'road') road.push(k); else wl.push(t === 'gate' ? 'g' + k : k);
  }
  for (const w of wl) { const g = w[0] === 'g', k = g ? w.slice(1) : w; if (!b[k] && !occ[k]) b[k] = { id: g ? 'gate' : 'wall' }; }
  return { b, road, clr: [], __occ: occ, __w: hhWorld(), __d: d };
}
let HH_C = {};
function hhSt() {
  const P = ui.hxP, key = [HI.ut, hsState().id, HI.doc ? hiLevel() : 0, JSON.stringify(P?.ops || [])].join('|');
  if (HH_C.key !== key || HH_C.doc !== HI.doc) HH_C = { key, doc: HI.doc, st: hhStOf(HI.doc || {}, P?.ops || []) };
  return HH_C.st;
}
// the saved island (no half-laid roads), for perks and raids
function hhSaved(d = HI.doc) { if (d === HI.doc) { if (HH_C.saved?.doc !== d || HH_C.saved.ut !== HI.ut) HH_C.saved = { doc: d, ut: HI.ut, st: hhStOf(d || {}) }; return HH_C.saved.st; } return hhStOf(d || {}); }
// the keys of buildings whose perk works: joined to the great hall by road (and a pier touching the water)
function hhLinkedKeys(d = HI.doc) {
  if (!d || !hhMigrated(d)) return null; // not on hexes yet: everything counts, as before
  const st = hhSaved(d), net = hxLinks(st), out = new Set();
  for (const [k, s] of Object.entries(st.b)) {
    if (!s.key) continue; const it = hhItem(s.id);
    if (it.need && !hxNb(k).some(n => hxTerr(n, st) === it.need)) continue;
    if (it.noRoad || hxLinked(k, net, st)) out.add(s.key);
  }
  return out;
}
const hhRingOf = d => !!d && hhMigrated(d) && hxRingClosed(hhSaved(d));
// condition, level and build progress of a house building, for the 3D island
function hhLook(k, s, st) {
  const d = st.__d || HI.doc || {}, ds = d.b?.[s.key] || {}, c = hiCond(s.key, today(), d) || 'build';
  const t0 = new Date(ds.s + 'T00:00').getTime(), t1 = new Date(ds.r + 'T00:00').getTime();
  return { c, lv: hiLvOn(ds), up: !!(ds.up && today() < ds.up.r), p: (Date.now() - t0) / Math.max(1, t1 - t0) };
}
function hhSig(st) {
  const d = st.__d || {};
  return [HI.ut, hiLevel(), typeof biTrophies === 'function' ? biTrophies().length : 0, JSON.stringify(st.b), st.road.join(';'), hiKeys(d).map(k => hiCond(k, today(), d) + hiLvOn(d.b[k])).join()].join('|');
}
// flags round the great hall and the boss trophies floating by the coast
function hhDress(W, add, rnd, col) {
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, g = hxModel('flag_' + col, col); g.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25); g.rotation.y = -a; g.scale.setScalar(2.2); W.add(g); }
  const tro = typeof biTrophies === 'function' ? biTrophies().slice(0, 12) : [], R = (HH_R + 1) * 2 + 3.4;
  tro.forEach((t, i) => {
    const a = Math.PI / 2 - Math.PI / 5 + (i - (tro.length - 1) / 2) * .2, g = new THREE.Group(); g.position.set(Math.cos(a) * R, -.6, Math.sin(a) * R);
    is3mesh(is3rock(new THREE.ConeGeometry(.9, 1.6, 5, 2), rnd, .3, .3), '#6d5f73', 0, -.9, 0, g).rotation.z = Math.PI;
    is3mesh(new THREE.CylinderGeometry(.95, .9, .25, 5), '#5fae43', 0, 0, 0, g); is3mesh(new THREE.BoxGeometry(.8, .35, .8), '#c9c2b5', 0, .3, 0, g); is3mesh(new THREE.BoxGeometry(.9, .07, .9), '#ffd43b', 0, .5, 0, g, true);
    const m = new THREE.Group(); m.position.y = .53; m.scale.setScalar(.24); m.rotation.y = -a + Math.PI / 2; is3bossModel(m, t.n, 'gold'); g.add(m);
    W.add(g); HX3.anim.push({ o: g, bob: i, y: -.6 });
  });
}

// ---------- moving the old square island onto hexes (once, by whoever opens it first) ----------
// every building keeps a hex spot if it has one, else gets the nearest free spot to the hall; then
// each one gets a free road to the hall
function hhMigrate(d) {
  d.b = d.b || {};
  const st = { b: {}, road: hxNb('0,0'), clr: [], __occ: {}, __w: hhWorld() };
  const keys = hiKeys(d).sort((a, b) => (d.b[a].s || '') < (d.b[b].s || '') ? -1 : 1);
  for (const key of keys) {
    const s = d.b[key], it = hhItem(hiBase(key));
    const at = typeof s.at === 'string' && hxCheck(it.id, s.at, st).ok ? s.at : hhSpot(it, st);
    if (!at) continue;
    s.at = at; s.rot = s.rot || 0; st.b[at] = { id: it.id, key }; for (const f of hxFoot(it, at)) if (f !== at) st.__occ[f] = at;
    if (!it.noRoad) st.road.push(...hhPath(st, hxFoot(it, at)));
  }
  d.b._rd = st.road; d.b._wl = d.b._wl || [];
  return d;
}
// the free spot nearest the hall where a building fits (and can reach the hall by road)
function hhSpot(it, st) {
  const L = st.__w.land(), ks = [...L.keys()].filter(k => L.get(k).d >= 2).sort((a, b) => L.get(a).d - L.get(b).d || L.get(a).v - L.get(b).v);
  for (const k of ks) { if (!hxCheck(it.id, k, st).ok) continue; if (it.noRoad || hhPath(st, hxFoot(it, k), true)) return k; }
  return null;
}
// the shortest line of new road from a building's hexes to the hall's road network (over grass only)
function hhPath(st, fp, test) {
  const net = hxLinks(st), touches = k => hxNb(k).some(n => n === '0,0' || net.has(n));
  if (fp.some(touches)) return [];
  const prev = new Map(), todo = [];
  for (const f of fp) for (const n of hxNb(f)) if (!fp.includes(n) && !prev.has(n) && hxAt(n, st).kind === 'grass') { prev.set(n, null); todo.push(n); }
  for (let i = 0; i < todo.length; i++) {
    const k = todo[i];
    if (touches(k)) { if (test) return true; const out = []; for (let x = k; x; x = prev.get(x)) out.push(x); return out; }
    for (const n of hxNb(k)) if (!prev.has(n) && !fp.includes(n) && hxAt(n, st).kind === 'grass') { prev.set(n, k); todo.push(n); }
  }
  return test ? false : [];
}

// ---------- banks: interest, credited when anyone opens the island ----------
function hhBankDue(d) { return ['lbank', 'ebank'].some(k => { const s = d.b?.[k]; return s && today() >= s.r && (s.d || s.r) < today(); }); }
function hhBankTick(d) {
  const lk = hhLinkedKeys(d);
  for (const [key, cur] of [['lbank', 'l'], ['ebank', 'e']]) {
    const s = d.b?.[key]; if (!s || today() < s.r) continue;
    const from = s.d || s.r; if (from >= today()) continue;
    const c = hiCond(key, today(), d), m = (c === 'ok' ? 1 : c === 'worn' ? .5 : 0) * (!lk || lk.has(key) ? 1 : 0);
    if (m) s.i = (+s.i || 0) + Math.round(Math.min(HH_BANK.cap * hiLvOn(s), hiPool(d)[cur]) * HH_BANK.rate * m * diffDays(from, today()));
    s.d = today();
  }
}
const hhBankCap = s => HH_BANK.cap * hiLvOn(s);
const hhVaultSpace = (d = HI.doc || {}) => d.b?.treasury && today() >= d.b.treasury.r ? HH_VAULT * hiLvOn(d.b.treasury) : 0;

// ---------- what leaders can do ----------
const hhCanEdit = () => !!HI.doc && hiAmLeader();
const hhSlotUsed = (d, slot) => slot === 'wall' ? (d.b?._wl || []).length : hiKeys(d).filter(k => hiItem(hiBase(k)).slot === slot).length;
// why a project can't be started now ('' if it can)
function hiCanStart(d, it, now = today()) {
  const p = hiPool(d), hl = hiLevel(d);
  if (hl < it.u) return `Unlocks at house level ${it.u}`;
  if (!it.slot && d.b?.[it.id]) return 'Already built';
  if (it.slot) { const max = hhSlots(hl)[it.slot]; if (hhSlotUsed(d, it.slot) >= max) return max ? `All ${max} ${HH_SLOT_N[it.slot]} spaces used (more at a higher house level)` : `${HH_SLOT_N[it.slot]}s need a higher house level`; }
  if (it.req && !['ok', 'worn', 'broken'].includes(hiCond(it.req, now, d))) return `Needs ${hiItem(it.req).n} first`;
  if (hiBig(it)) { const pr = hiProp(d); if (pr?.b !== it.id || !pr.passed) return 'Needs a house vote first'; }
  if (hiBusy(d, now) >= HI_MAX_BUILDING) return 'Both builders are busy';
  if (p.l < it.l || p.e < it.x) return 'Not enough in the house pool';
  return '';
}
const hhNewKey = (d, it) => { if (!it.slot) return it.id; let n = 1; while (d.b?.[it.id + '.' + n]) n++; return it.id + '.' + n; };
// a leader dropped a building on a hex: start it (paid from the pool) or move it
function hhPlace(P, k) {
  const st = hhSt(), it = hhItem(P.id), ch = hxCheck(P.id, k, st, P.from);
  if (!ch.ok) { if (typeof sfx === 'function') sfx('deny'); toast('Can\'t go there', ch.why); return false; }
  if (!hhCanEdit() || !it) return false;
  const base = hiItem(P.id), now = today(), rot = P.rot || 0;
  if (P.mode !== 'move') { const why = hiCanStart(HI.doc, base, now); if (why) { toast('Can\'t start that now', why); return false; } }
  hxFx('drop', k); HH_C.pend = { k, id: P.id, rot };
  (async () => {
    let key = P.key, ok;
    const fits = (d, from) => hxCheck(P.id, k, hhStOf(d), from).ok;
    if (P.mode === 'move') ok = await hiWrite(d => { const s = d.b?.[key]; if (!s || !hhMigrated(d) || !fits(d, s.at)) return false; s.at = k; s.rot = rot; });
    else {
      ok = await hiWrite(d => {
        if (!hhMigrated(d)) hhMigrate(d);
        if (hiCanStart(d, base, now) || !fits(d)) return false;
        if (hiBig(base)) delete d.pr;
        key = hhNewKey(d, base);
        d.sp = { l: (+d.sp?.l || 0) + base.l, e: (+d.sp?.e || 0) + base.x }; d.b[key] = { s: now, r: addDays(now, HI_LEN[base.t]), reps: [], by: HI.user, lv: 1, at: k, rot };
      });
      if (ok) toast(`${base.e} ${base.n} started`, `Ready ${fmtDate(addDays(now, HI_LEN[base.t]))}.${ch.warn.length ? ' ' + ch.warn[0] + '.' : ''}`);
    }
    HH_C.pend = null;
    if (ok) { ui.isSel = key; ui.isPanel = null; }
    HX3.sig = ''; render();
  })();
  return true;
}
// roads, walls and gates: laid on screen while dragging, saved in one go when the mouse lets go
function hhOpCost(t, k, st) { return t === 'road' ? (st.__w.land().get(k)?.t === 'river' ? HX_BRIDGE : HX_ROAD) : t === 'gate' ? HH_GATE : t === 'wall' ? HH_WALL : { l: 0, x: 0 }; }
function hhPaint(tool, k) {
  const P = ui.hxP; if (!P || !hhCanEdit()) return 'Only leaders can build';
  P.ops = P.ops || [];
  const st = hhSt(), a = hxAt(k, st);
  if (tool === 'erase') { if (a.kind === 'road' || (a.kind === 'b' && a.it?.wall)) { P.ops.push(['x', k]); return ''; } return 'nothing to remove'; }
  const ch = hxCheck(tool === 'road' ? 'road' : 'wall', k, st); if (!ch.ok) return ch.why;
  if (tool !== 'road') {
    const hl = hiLevel(), max = hhSlots(hl).wall, used = (HI.doc.b?._wl || []).length + P.ops.filter(o => o[0] === 'wall' || o[0] === 'gate').length;
    if (hl < HH_WALL_LV) return `Walls unlock at house level ${HH_WALL_LV}`;
    if (used >= max) return `All ${max} wall spaces used (more at a higher house level)`;
  }
  const c = hhOpCost(tool, k, st), p = hiPool(), sp = P.ops.reduce((t, [o, kk]) => { const x = hhOpCost(o, kk, st); return { l: t.l + x.l, e: t.e + x.x }; }, { l: 0, e: 0 });
  if (p.l - sp.l < c.l || p.e - sp.e < c.x) return 'Not enough in the house pool';
  P.ops.push([tool, k]); return '';
}
async function hhPaintDone() {
  const P = ui.hxP, ops = [...(P?.ops || [])]; if (!ops.length) { render(); return; }
  const ok = await hiWrite(d => {
    if (!hhMigrated(d)) hhMigrate(d);
    let l = 0, x = 0, n = 0;
    for (const [t, k] of ops) {
      const st = hhStOf(d), a = hxAt(k, st);
      if (t === 'x') { if (a.kind === 'road') d.b._rd = d.b._rd.filter(r => r !== k); else if (a.kind === 'b' && a.it?.wall) d.b._wl = d.b._wl.filter(w => w !== k && w !== 'g' + k); else continue; n++; continue; }
      if (!hxCheck(t === 'road' ? 'road' : 'wall', k, st).ok) continue;
      if (t !== 'road' && d.b._wl.length >= hhSlots(hiLevel(d)).wall) continue;
      const c = hhOpCost(t, k, st); l += c.l; x += c.x; n++;
      if (t === 'road') d.b._rd.push(k); else d.b._wl.push(t === 'gate' ? 'g' + k : k);
    }
    const p = hiPool(d); if (!n || p.l < l || p.e < x) return false;
    if (l || x) d.sp = { l: (+d.sp?.l || 0) + l, e: (+d.sp?.e || 0) + x };
  });
  if (ui.hxP === P) P.ops = P.ops.slice(ops.length);
  if (!ok) toast('Not saved', 'The roads and walls didn\'t save. Try again.');
  HX3.sig = ''; render();
}
async function hhRemoveHex(k) {
  if (!hhCanEdit()) return;
  const ok = await hiWrite(d => { if (!hhMigrated(d)) return false; const n = (d.b._rd.length + d.b._wl.length); d.b._rd = d.b._rd.filter(r => r !== k); d.b._wl = d.b._wl.filter(w => w !== k && w !== 'g' + k); if (n === d.b._rd.length + d.b._wl.length) return false; });
  if (ok) { ui.isSel = null; HX3.sig = ''; }
  render();
}
// a tap on the house island: the hall opens its panel, a building its card, a road or wall (leaders) a remove button
function hhTap(k) {
  const st = hhSt(), a = k ? hxAt(k, st) : { kind: 'off' };
  let sel = null, pn = null;
  if (a.kind === 'free') pn = 'hall';
  else if (a.kind === 'b') sel = a.s.key || 'hex:' + a.main;
  else if (a.kind === 'road' && hhCanEdit()) sel = 'hex:' + k;
  if (sel !== ui.isSel || pn !== ui.isPanel) { ui.isSel = sel; ui.isPanel = pn; if ((sel || pn) && typeof sfx === 'function') sfx('select'); render(); }
}
function hhHexPop(k) {
  const a = hxAt(k, hhSt()), lead = hhCanEdit(); if (!['road', 'b'].includes(a.kind)) return '';
  const n = a.kind === 'road' ? (a.bridge ? '🌉 Bridge' : '🛣️ Road') : `${a.it.e} ${a.it.n}`, sub = a.kind === 'road' ? 'Joins house buildings to the great hall, so their perks work.' : hhRingOf(HI.doc) ? 'Part of a closed ring round the great hall: the Friday raid can\'t get in.' : 'Close a ring of wall round the great hall and the Friday boss raid can\'t get in. Gates count as wall.';
  return `<div class="ishud is-bc ispop"><div class="ispop-h"><div><b>${n}</b><div class="muted small-text">${sub}</div></div><button class="isx" data-is="close" title="Close">✕</button></div><div class="ispop-a">${lead ? `<button class="btn small ghost" data-hi="unhex" data-k="${k}">Remove (no refund)</button>` : '<span class="muted small-text">Leaders lay and remove roads and walls.</span>'}</div></div>`;
}
function hhPlaceBar(P, tool) {
  if (tool) {
    const c = P.id === 'road' ? hxCost(HX_ROAD.l, HX_ROAD.x) : P.id === 'gate' ? hxCost(0, HH_GATE.x) : hxCost(0, HH_WALL.x), d = HI.doc || {};
    const sl = P.id === 'wall' || P.id === 'gate' ? ` · wall space ${(d.b?._wl || []).length + (P.ops || []).filter(o => o[0] === 'wall' || o[0] === 'gate').length}/${hhSlots().wall}` : '';
    return `<div class="ishud is-bc isplace hxbar"><span>${P.id === 'erase' ? '🧽 Drag over roads and walls to remove them (no refund from the pool).' : `Drag across hexes to lay ${P.id === 'gate' ? 'gates' : P.id + 's'} (${c} each from the house pool${P.id === 'road' ? ', bridges more' : ''})${sl}.${P.n ? ` <b>${P.n} laid</b>` : ''}`} ${P.why ? `<b class="hxwhy bad">${esc(P.why)}</b>` : ''}</span>
      <button class="btn small ${P.id === 'erase' ? 'primary' : ''}" data-hx="tool" data-v="${P.id === 'erase' ? (P.was || 'road') : 'erase'}">${P.id === 'erase' ? '✏️ Lay' : '🧽 Remove'}</button><button class="btn small primary" data-hx="cancel">✔ Done</button></div>`;
  }
  const it = hhItem(P.id), ch = P.chk;
  return `<div class="ishud is-bc isplace hxbar"><span>${P.mode === 'move' ? 'Moving' : 'Placing'} <b>${esc(it.n)}</b>${it.hz > 1 ? ` (${it.hz} hexes)` : ''}: ${ch ? ch.ok ? `<b class="hxwhy ok">✓ Fits</b>${ch.good.map(g => ` <span class="hxchip ok">${esc(g.replace('your hall', 'the great hall'))}</span>`).join('')}${ch.warn.map(g => ` <span class="hxchip warn">${esc(g.replace('the hall', 'the great hall'))}</span>`).join('')}` : `<b class="hxwhy bad">✗ ${esc(ch.why)}</b>` : 'move the mouse over the island'}</span>
    <button class="btn small" data-hx="rot" title="Turn (R)">⟳ Turn</button><button class="btn small ghost" data-hx="cancel" title="Esc or right-click">✖ Cancel</button></div>`;
}

// ---------- the "Your house island on hexes" walkthrough ----------
const hhGuideHome = () => { view = 'islands'; Object.assign(ui, { isTab: 'house', isPanel: null, isSel: null, hxP: null }); render(); };
if (typeof GUIDES === 'object') GUIDES.hexhouse = {
  name: 'The house island on hexes',
  end: () => { ui.hxP = null; if (view === 'islands') render(); },
  steps: [
    { title: 'Your house island is hexagons now 🏰', text: 'The shared house island moved onto hexes too, with the same medieval models as your own island. Every house building kept its level and perks and got a spot and a free road to the great hall.', go: hhGuideHome, wait: 600 },
    { title: 'Roads make house perks work', text: 'Like your own island, a house building only gives its perk when a road joins it to the great hall. Leaders press 🛣️ <b>Roads</b> and drag to lay them, paid from the house pool.', go: hhGuideHome, sel: '#isfull [data-hi="tool"][data-v="road"], #isfull .ishud.is-br' },
    { title: 'Leaders place and drag', text: 'Leaders start projects from <b>Projects</b>. The building follows the mouse, green when it fits and red with the reason when it doesn\'t. Press on a building and drag it to move it. Big temple parts cover 3 or 7 hexes.', go: hhGuideHome, sel: '#isfull [data-hi="panel"][data-v="shop"]' },
    { title: 'New: banks, a vault and a treasury', text: 'The <b>Lumen Bank</b> and <b>Ember Bank</b> earn the house 1% a day on up to 500 × their level. The <b>Vault</b> and <b>Treasury</b> keep savings safe once sieges arrive.', go: () => { hhGuideHome(); ui.isPanel = 'shop'; render(); }, sel: '#isfull .ispanel', place: 'left' },
    { title: 'Walls keep the raiders out', text: 'Close a ring of 🧱 <b>Walls</b> (gates count) all the way round the great hall and the Friday boss raid can\'t smash anything. That job used to be the Bastion\'s. Towers, traps and guard posts can be built now, ready for sieges later.', go: hhGuideHome, sel: '#isfull [data-hi="tool"][data-v="wall"], #isfull .ishud.is-bl' },
  ],
};
