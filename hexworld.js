'use strict';
/* Hex home island (2.65, roadmap stage 3). Your island is a floating ring of
   hexagons built from the KayKit Medieval Hexagon pack (CC0, packed into
   hex/kaykit.bin by tools/kaykit-pack.py). It replaces the square personal
   island (full reset; whatever was spent on the old island is refunded once).
   - The page buildings (Hall, Library, Training hall, Tavern, Market, Practice
     yard) are free, already built, never break, and Open their page.
   - Perk buildings are bought with Lumen/Ember, built over days by 2 builders,
     go to level 3, wear and break (holidays and exam days don't count), and
     only work when a road joins them to the Hall.
   - Linking: lumber mill +50% touching forest, mine +50% touching a hill,
     watermill must touch the river, windmill +1% per touching field (up to 3).
     A closed ring of wall around the Hall gives -3% damage taken.
   - Trees and rocks block a hex until cleared (instant, costs a little).
   - Placing: buy and the building follows the mouse with a ghost that snaps to
     hexes, green when it fits (with link and bonus preview), red with the
     reason when it doesn't. R turns it, click drops it, Esc or right-click
     cancels. Drag any building to move it, Ctrl+Z undoes the last move. Roads
     and walls are laid by dragging along a line.
   All numbers below were approved by Eli on 14 Nov 2026 (hex-world/buildings-draft.md). */

// ---------- config ----------
const HX_R = 6; // land radius in hexes (127 land hexes), ring 7 is water
const HX_ROAD = { l: 5, x: 5 }, HX_BRIDGE = { l: 30, x: 30 }, HX_CLEAR = { tree: { l: 25, x: 0 }, rock: { l: 0, x: 25 } };
const HX_FIELD_MAX = 6, HX_FED_HP = 10, HX_RING = { dr: .03 };
// the page buildings: free, pre-built, never decay
const HX_FREE = [
  { id: 'hall', n: 'Hall', e: '🏰', m: 'building_castle', at: '0,0', open: 'profile', d: 'Your profile, character and gear' },
  { id: 'library', n: 'Library', e: '📚', m: 'building_church', at: '0,-2', open: 'study', d: 'Study tracker, SAC scores and exams' },
  { id: 'training', n: 'Training hall', e: '💪', m: 'building_barracks', at: '2,-2', open: 'training', d: 'Fitness, workouts and PRs' },
  { id: 'tavern', n: 'Tavern', e: '🍺', m: 'building_tavern', at: '-2,0', open: 'friends', d: 'Friends and chats' },
  { id: 'market', n: 'Market', e: '🛒', m: 'building_market', at: '-2,2', open: 'shop', d: 'The weekly cosmetics shop' },
  { id: 'yard', n: 'Practice yard', e: '🎯', m: 'building_archeryrange', at: '2,0', open: 'spar', d: 'Spar a champion boss' },
];
// perk buildings. b = perks (FT_BUFF battle buffs, lp/ep collectors, cl/ce storage), u = player level,
// near = collector bonus when touching that terrain, need = must touch that terrain, max = how many you can own
const HX_ITEMS = [
  { id: 'cottage', n: 'Scholar\'s cottage', e: '📖', m: 'building_home_A', l: 300, x: 0, days: 2, u: 1, b: { lp: .08 } },
  { id: 'lumber', n: 'Lumber mill', e: '🪵', m: 'building_lumbermill', l: 0, x: 300, days: 2, u: 1, b: { ep: .08 }, near: 'forest' },
  { id: 'field', n: 'Field', e: '🌾', m: 'building_grain', l: 40, x: 40, days: 2, u: 2, max: HX_FIELD_MAX, field: true },
  { id: 'well', n: 'Well', e: '🪣', m: 'building_well', l: 150, x: 150, days: 1, u: 2, b: { rg: 1 } },
  { id: 'store', n: 'Storehouse', e: '📦', m: 'building_home_B', l: 250, x: 250, days: 2, u: 3, b: { cl: 300, ce: 300 } },
  { id: 'watermill', n: 'Watermill', e: '💧', m: 'building_watermill', l: 450, x: 150, days: 3, u: 4, b: { lp: .06 }, need: 'river' },
  { id: 'wall', n: 'Stone wall', e: '🧱', m: 'wall_straight', l: 0, x: 30, u: 4, wall: true, max: 99 },
  { id: 'mine', n: 'Mine', e: '⛏️', m: 'building_mine', l: 150, x: 450, days: 3, u: 5, b: { ep: .06 }, near: 'hill' },
  { id: 'mage', n: 'Mage tower', e: '🔮', m: 'building_tower_B', l: 450, x: 150, days: 3, u: 6, b: { sp: .04 } },
  { id: 'forge', n: 'Forge', e: '⚒️', m: 'building_blacksmith', l: 150, x: 450, days: 3, u: 6, b: { mv: .04 } },
  { id: 'windmill', n: 'Windmill', e: '🌬️', m: 'building_windmill', l: 400, x: 400, days: 4, u: 8, b: { lp: .04, ep: .04 }, fields: .01 },
  { id: 'watch', n: 'Watchtower', e: '🗼', m: 'building_tower_A', l: 300, x: 300, days: 3, u: 9, b: { cr: .02 } },
  { id: 'catapult', n: 'Catapult tower', e: '🏹', m: 'building_tower_catapult', l: 700, x: 700, days: 5, u: 12, b: { sp: .02, mv: .02 } },
];
const HX_NEAR = { forest: ['forest', '+50% next to a forest', .5], hill: ['hill', '+50% next to a hill', .5] };
// old square-island prices, only to refund what was spent there (2.65 full reset)
const HX_OLD = { hut: [300, 0], shed: [0, 300], fire: [120, 120], vaultl: [0, 250], vaulte: [250, 0], shrine: [450, 0], forge: [150, 450], light: [450, 150], tower: [300, 300], wall: [0, 500], mill: [400, 400], spring: [600, 600], obs: [900, 300], totem: [700, 700] };

// ---------- hex maths (pointy-top, axial q,r; neighbour i is edge i at 60*i degrees in x/z) ----------
const HX_DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const HX_S3 = Math.sqrt(3);
const hxK = (q, r) => q + ',' + r;
const hxQR = k => k.split(',').map(Number);
const hxDist = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
const hxPos = (q, r) => [2 * (q + r / 2), HX_S3 * r];
const hxNb = k => { const [q, r] = hxQR(k); return HX_DIRS.map(([a, b]) => hxK(q + a, r + b)); };
function hxFromXZ(x, z) {
  const r = z / HX_S3, q = x / 2 - r / 2, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return hxK(rq, rr);
}
// hexes on a straight line between two hexes (for dragging roads and walls)
function hxLine(a, b) {
  const [q1, r1] = hxQR(a), [q2, r2] = hxQR(b), n = hxDist(q2 - q1, r2 - r1), out = [];
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0, [x1, z1] = hxPos(q1, r1), [x2, z2] = hxPos(q2, r2); out.push(hxFromXZ(x1 + (x2 - x1) * t + 1e-6, z1 + (z2 - z1) * t + 1e-6)); }
  return [...new Set(out)];
}
// tile variants by which edges they join (same masks for roads and rivers), found from the pack's geometry
const HX_TILE = { A: [0, 3], B: [3, 5], C: [3, 4], D: [1, 3, 5], E: [0, 3, 5], F: [0, 1, 3], G: [2, 3, 4], H: [0, 2, 3, 4], I: [1, 2, 4, 5], J: [0, 1, 2, 3], K: [1, 2, 3, 4, 5], L: [0, 1, 2, 3, 4, 5], M: [3] };
const HX_TILEMASK = Object.fromEntries(Object.entries(HX_TILE).map(([k, es]) => [k, es.reduce((m, e) => m | 1 << e, 0)]));
const hxRot = (m, k) => ((m << k) | (m >> (6 - k))) & 63;
// which variant and turn makes a tile join exactly these edges: [letter, turns]
function hxTileFor(mask) {
  if (!mask) return ['M', 0];
  for (const [k, m] of Object.entries(HX_TILEMASK)) for (let t = 0; t < 6; t++) if (hxRot(m, t) === mask) return [k, t];
  return ['L', 0];
}

// ---------- the land (the same for everyone; built once) ----------
const HX_RIVER = ['-7,3', '-6,3', '-5,3', '-4,3', '-3,3', '-3,4', '-2,4', '-1,4', '0,4', '1,3', '2,3', '3,3', '4,3'];
let HX_LAND = null;
function hxLand() {
  if (HX_LAND) return HX_LAND;
  const rnd = seeded('solis-hex-home'), L = new Map();
  for (let q = -HX_R - 1; q <= HX_R + 1; q++) for (let r = -HX_R - 1; r <= HX_R + 1; r++) {
    const d = hxDist(q, r); if (d > HX_R + 1) continue;
    L.set(hxK(q, r), { t: d > HX_R ? 'water' : 'grass', v: rnd() });
  }
  for (const k of HX_RIVER) if (L.has(k)) L.get(k).t = hxDist(...hxQR(k)) > HX_R ? 'water' : 'river';
  const set = (ks, t) => { for (const k of ks) { const h = L.get(k); if (h && h.t === 'grass') h.t = t; } };
  // a forest in the north-west, hills and a mountain ridge in the north-east, rocks dotted about
  set(['-4,-1', '-5,0', '-5,-1', '-4,-2', '-3,-2', '-6,1', '-6,2', '-5,1', '-3,-3', '-2,-4', '-4,1', '-1,-5', '0,-6', '-1,-4', '-5,2', '-2,-3'], 'forest');
  set(['3,-5', '4,-5', '5,-4', '4,-4'], 'hill');
  set(['5,-6', '6,-6', '6,-5', '2,-6', '1,-6', '6,-4'], 'mount');
  set(['4,-1', '-1,6', '5,1', '-3,6', '1,-3', '3,1', '-4,5', '6,-2', '-6,4'], 'rock');
  set(['2,4', '1,5', '-2,5', '5,0', '3,2', '-5,6', '4,-2'], 'forest');
  HX_LAND = L; return L;
}

// ---------- your island ----------
const hxState = () => { const c = cdState(); return (c.hx = Object.assign({ v: 1, b: {}, road: ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'], clr: [], mark: { l: 0, e: 0 } }, c.hx || {})); };
const hxItem = id => HX_ITEMS.find(x => x.id === id);
const hxFree = id => HX_FREE.find(x => x.id === id);
// 2.66: the same hex code drives the shared house island (hxhouse.js). A state can carry its own
// world in __w: land, item lookup, page buildings, how a building looks, and its owner's colour.
const HX_HOME_W = { land: () => hxLand(), item: id => HX_ITEMS.find(x => x.id === id), free: HX_FREE, home: true };
const hxW = st => (st && st.__w) || HX_HOME_W;
const hxFreeAt = (k, st) => hxW(st).free.find(x => x.at === k);
const hxHouseOn = () => IS3.house === 'hexh';
const hxCur = () => hxHouseOn() && typeof hhSt === 'function' ? hhSt() : hxState();
// the hexes a building covers: 1, or a 3-hex or 7-hex cluster for big house projects
const hxFoot = (it, k) => { const n = hxNb(k); return it?.hz === 7 ? [k, ...n] : it?.hz === 3 ? [k, n[0], n[1]] : [k]; };
// what's on a hex: { kind: 'free'|'b'|'road'|'tree'|'rock'|'hill'|'mount'|'river'|'water'|'grass', ... }
function hxAt(k, st = hxState()) {
  const W = hxW(st), h = W.land().get(k); if (!h) return { kind: 'off' };
  const f = hxFreeAt(k, st); if (f) return { kind: 'free', it: f };
  const mk = st.__occ?.[k] || (st.b[k] && k); if (mk && st.b[mk]) return { kind: 'b', s: st.b[mk], it: W.item(st.b[mk].id), main: mk };
  if (st.road.includes(k)) return { kind: 'road', bridge: h.t === 'river' };
  if ((h.t === 'forest' || h.t === 'rock') && st.clr.includes(k)) return { kind: 'grass' };
  return { kind: h.t === 'forest' ? 'tree' : h.t };
}
const hxTerr = (k, st) => { const a = hxAt(k, st); return a.kind === 'tree' ? 'forest' : a.kind; };
function hxLv() { return typeof isLv === 'function' ? isLv() : 1; }
const hxCost = (l, x) => [l && `${LUMEN} ${Math.round(l)}`, x && `${EMBER} ${Math.round(x)}`].filter(Boolean).join(' + ') || 'free';
const hxCan = (l, x) => { const w = cdWallet(); return w.lumen >= Math.round(l) && w.ember >= Math.round(x); };
const hxOwned = (id, st = hxState()) => Object.values(st.b).filter(s => s.id === id).length;
// your house colour picks the KayKit roof colour
function hxCol() {
  const h = typeof hsState === 'function' && hsState().id;
  return { pascoe: 'yellow', molland: 'red', flinders: 'blue', derrimut: 'red', strathmore: 'blue', hudson: 'green' }[h] || 'blue';
}

// roads joined to the hall, and which buildings touch them
function hxLinks(st = hxState()) {
  const roads = new Set(st.road), seen = new Set(), todo = hxNb('0,0').filter(k => roads.has(k));
  todo.forEach(k => seen.add(k));
  while (todo.length) { const k = todo.pop(); for (const n of hxNb(k)) if (roads.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); } }
  return seen;
}
const hxLinked = (k, net = hxLinks(), st) => { const s = st?.b?.[k], fp = s ? hxFoot(hxW(st).item(s.id), k) : [k]; return fp.some(f => hxNb(f).some(n => n === '0,0' || net.has(n))); };
// a closed ring of wall round the hall: the hall can't reach the water without crossing a wall
function hxRingClosed(st = hxState()) {
  const W = hxW(st), walls = new Set(Object.entries(st.b).filter(([, s]) => W.item(s.id)?.wall).map(([k]) => k)); if (walls.size < 6) return false;
  const L = hxW(st).land(), seen = new Set(['0,0']), todo = ['0,0'];
  while (todo.length) { const k = todo.pop(); for (const n of hxNb(k)) { if (seen.has(n) || walls.has(n) || !L.has(n)) continue; if (L.get(n).t === 'water') return false; seen.add(n); todo.push(n); } }
  return true;
}

// ---------- timers, wear and perks (same rules as the old island) ----------
const hxLvOn = (s, d = today()) => s ? (s.up && d >= s.up.r ? s.up.lv : s.lv || 1) : 0;
function hxFold(s) { if (s?.up && today() >= s.up.r) { s.lv = s.up.lv; s.reps = [...(s.reps || []), s.up.r]; delete s.up; } return s; }
const hxBusyN = (st = hxState()) => Object.values(st.b).filter(s => { const it = hxItem(s.id); return it && !it.field && !it.wall && (today() < s.ready || (s.up && today() < s.up.r)); }).length;
const HX_TL = new Map();
function hxCond(k, d = today(), st = hxState()) {
  const s = st.b[k]; if (!s || d < s.start) return null;
  const it = hxItem(s.id); if (!it) return null;
  if (it.wall) return 'ok';
  if (it.field) return d < s.ready ? 'grow' : 'ripe';
  if (d < s.ready) return 'build';
  const reps = [...(s.reps || []), ...(s.up && d >= s.up.r ? [s.up.r] : [])], key = [k, s.start, s.ready, reps.join(), today(), (D.settings.holidays || []).length, (D.assessments || []).length].join('|');
  let tl = HX_TL.get(key);
  if (!tl) {
    tl = { c: {}, act: 0 }; const rs = new Set(reps), paused = isPaused(); let act = 0;
    for (let x = s.ready; x <= today(); x = addDays(x, 1)) { if (rs.has(x)) act = 0; tl.c[x] = act >= IS_BREAK ? 'broken' : act >= IS_WEAR ? 'worn' : 'ok'; if (!paused(x)) act++; }
    tl.act = act; for (const kk of HX_TL.keys()) if (kk.startsWith(k + '|')) HX_TL.delete(kk); HX_TL.set(key, tl);
  }
  return tl.c[d] || 'ok';
}
const hxWearLeft = k => { hxCond(k); for (const [kk, v] of HX_TL) if (kk.startsWith(k + '|')) return IS_WEAR - v.act; return IS_WEAR; };
// how strongly a building's perk works right now: condition x level x road link
function hxPerkM(k, st = hxState(), net = hxLinks(st), d = today()) {
  const s = st.b[k], it = s && hxItem(s.id); if (!it || it.field || it.wall) return 0;
  const c = hxCond(k, d, st), m = c === 'ok' ? 1 : c === 'worn' ? .5 : 0;
  if (!m || !hxLinked(k, net, st)) return 0;
  if (it.need && !hxNb(k).some(n => hxTerr(n, st) === it.need)) return 0;
  return m * IS_LVM[Math.max(0, hxLvOn(s, d) - 1)];
}
// the linking bonus on a collector at a spot (as a share, 0.5 = +50%; windmill: extra rate per field)
function hxBonus(it, k, st = hxState()) {
  if (it.near) return hxNb(k).some(n => hxTerr(n, st) === HX_NEAR[it.near][0]) ? HX_NEAR[it.near][2] : 0;
  if (it.fields) return Math.min(3, hxNb(k).filter(n => st.b[n]?.id === 'field').length) * it.fields;
  return 0;
}
function hxRate(k, key, st = hxState(), net = hxLinks(st), d = today()) {
  const s = st.b[k], it = s && hxItem(s.id); if (!it?.b?.[key]) return 0;
  const m = hxPerkM(k, st, net, d); if (!m) return 0;
  return it.fields ? (it.b[key] + hxBonus(it, k, st)) * m : it.b[key] * m * (1 + hxBonus(it, k, st));
}
// battle buffs from the island, added to gear in fight.js
function islBuffs(d = today()) {
  const st = hxState(), net = hxLinks(st), g = {};
  for (const k of Object.keys(st.b)) {
    const it = hxItem(st.b[k].id), m = hxPerkM(k, st, net, d); if (!m) continue;
    for (const [kk, v] of Object.entries(it.b || {})) if (typeof FT_BUFF === 'object' && FT_BUFF[kk]) g[kk] = (g[kk] || 0) + (kk === 'hp' || kk === 'rg' ? Math.round(v * m) : v * m);
  }
  if (hxRingClosed(st)) for (const [kk, v] of Object.entries(HX_RING)) g[kk] = (g[kk] || 0) + v;
  if (st.fed) g.hp = (g.hp || 0) + st.fed; // a harvest: extra health until your next boss fight
  return g;
}
// called when a house boss fight ends: the harvest has been eaten
function hxEatFood() { const st = hxState(); if (st.fed) { delete st.fed; save(); } }
function islEarn(key, d) { const st = hxState(), net = hxLinks(st); let t = 0; for (const k of Object.keys(st.b)) t += hxRate(k, key, st, net, d); return t; }
// what the collectors hold now: everything made since you last collected, up to storage
function isStore() {
  const st = hxState(), c = cdState(), net = hxLinks(st); let l = 0, e = 0;
  const rl = islEarn('lp'), re = islEarn('ep'); // the island as it is now
  for (let d = st.from || today(); d <= today(); d = addDays(d, 1)) { if (!rl && !re) break; const x = cdDay(d); l += x.lumen * islEarn('lp', d); e += x.ember * islEarn('ep', d); }
  let capL = IS_STORE, capE = IS_STORE;
  for (const k of Object.keys(st.b)) { const it = hxItem(st.b[k].id), m = hxPerkM(k, st, net); if (it?.b?.cl) capL += it.b.cl * m; if (it?.b?.ce) capE += it.b.ce * m; }
  const mk = st.mark || { l: 0, e: 0 };
  return { l: Math.floor(Math.min(capL, Math.max(0, l - (mk.l || 0)))), e: Math.floor(Math.min(capE, Math.max(0, e - (mk.e || 0)))), capL: Math.round(capL), capE: Math.round(capE), tl: l, te: e };
}
function isCollect() {
  const s = isStore(), st = hxState(), c = cdState(); if (!s.l && !s.e) return;
  c.got = c.got || { l: 0, e: 0 }; c.got.l = (c.got.l || 0) + s.l; c.got.e = (c.got.e || 0) + s.e;
  st.mark = { l: s.tl, e: s.te }; save();
  if (typeof sfx === 'function') sfx('coin');
  toast('✨ Collected', [s.l && `${LUMEN} ${s.l}`, s.e && `${EMBER} ${s.e}`].filter(Boolean).join(' + ')); render();
}
// 2.65 full reset: refund the old square island once
function hxMigrate() {
  const st = hxState(), c = cdState(); // (cdState makes a fresh D.cards each call, so take it last)
  if (!st.from) st.from = today();
  if (c.isl && !c.isl.refunded) {
    let l = 0, x = 0;
    for (const [id, s] of Object.entries(c.isl.items || {})) { const p = HX_OLD[id]; if (!p) continue; const lv = Math.max(s.lv || 1, s.up?.lv || 0), f = 1 + (lv >= 2 ? 1.8 : 0) + (lv >= 3 ? 3 : 0); l += p[0] * f; x += p[1] * f; }
    c.isl = { refunded: today() };
    if (l || x) { c.got = c.got || { l: 0, e: 0 }; c.got.l = (c.got.l || 0) + Math.round(l); c.got.e = (c.got.e || 0) + Math.round(x); ui.hxRefund = [Math.round(l), Math.round(x)]; }
    save();
  }
}

// ---------- what can go where ----------
// { ok, why, warn: [], good: [], bonus: [hex keys] } for building id (or 'road') on hex k
function hxCheck(id, k, st = hxState(), moving) {
  const it = hxW(st).item(id), out = { ok: false, warn: [], good: [], bonus: [] };
  // a cluster: every hex it covers must be free
  if (it?.hz > 1) { for (const f of hxFoot(it, k)) { const c = hxCheck('_one', f, st, moving); if (!c.ok) return { ...out, why: it.hz + '-hex project: ' + c.why.charAt(0).toLowerCase() + c.why.slice(1) }; } return hxCheckPost(it, k, st, { ...out, ok: true }); }
  const a = hxAt(k, st);
  if (a.kind === 'off' || a.kind === 'water') return { ...out, why: 'That\'s off the island' };
  if (id === 'road') {
    if (a.kind === 'road' || a.kind === 'free' || a.kind === 'b') return { ...out, why: a.kind === 'road' ? 'Already a road' : 'Something\'s already here' };
    if (a.kind === 'river') return { ...out, ok: true, why: '', good: [`Bridge: ${hxCost(HX_BRIDGE.l, HX_BRIDGE.x)}`] };
  }
  if ((a.kind === 'tree' || a.kind === 'rock') && hxW(st).noClear) return { ...out, why: a.kind === 'tree' ? 'Trees are in the way' : 'Rocks are in the way' };
  if (a.kind === 'tree') return { ...out, why: `Clear the trees first (${hxCost(HX_CLEAR.tree.l, HX_CLEAR.tree.x)}, tap them)` };
  if (a.kind === 'rock') return { ...out, why: `Clear the rocks first (${hxCost(HX_CLEAR.rock.l, HX_CLEAR.rock.x)}, tap them)` };
  if (a.kind === 'hill' || a.kind === 'mount') return { ...out, why: 'Can\'t build on hills or mountains' };
  if (a.kind === 'river') return { ...out, why: 'Can\'t build on the river (roads can bridge it)' };
  if (a.kind === 'free' || (a.kind === 'b' && a.main !== moving) || a.kind === 'road') return { ...out, why: a.kind === 'road' ? 'There\'s a road here' : 'Something\'s already here' };
  if (id === 'road' || id === '_one') return { ...out, ok: true };
  if (!it) return { ...out, why: '?' };
  if (it.need && !hxNb(k).some(n => hxTerr(n, st) === it.need)) return { ...out, why: `A ${it.n.toLowerCase()} must touch the ${it.need}` };
  return hxCheckPost(it, k, st, { ...out, ok: true });
}
function hxCheckPost(it, k, st, out) {
  if (!it.field && !it.wall && !it.noRoad) { const net = hxLinks(st), tmp = { ...st, b: { ...st.b, [k]: { id: it.id } } }; if (hxLinked(k, net, tmp)) out.good.push('Linked to your hall'); else out.warn.push('Needs a road to the hall to work'); }
  if (it.near) { const ns = hxNb(k).filter(n => hxTerr(n, st) === HX_NEAR[it.near][0]); if (ns.length) { out.good.push(HX_NEAR[it.near][1]); out.bonus.push(...ns); } else out.warn.push(`${HX_NEAR[it.near][1]} (none here)`); }
  if (it.fields) { const ns = hxNb(k).filter(n => st.b[n]?.id === 'field'); out.bonus.push(...ns); out.good.push(`${Math.min(3, ns.length)} field${ns.length === 1 ? '' : 's'} touching (+${Math.min(3, ns.length)}% each)`); }
  if (it.field) { const ns = hxNb(k).filter(n => st.b[n]?.id === 'windmill'); out.bonus.push(...ns); if (ns.length) out.good.push('Boosts the windmill next to it'); }
  if (it.need) { out.good.push(`Touches the ${it.need}`); out.bonus.push(...hxNb(k).filter(n => hxTerr(n, st) === it.need)); }
  return out;
}

// ---------- page ----------
function viewHexHome() {
  hxMigrate();
  const st = hxState(), w = cdWallet(), lv = hxLv(), sto = isStore(), net = hxLinks(st);
  for (const s of Object.values(st.b)) hxFold(s);
  const busy = hxBusyN(st), P = ui.hxP;
  const bubs = Object.entries(st.b).map(([k, s]) => {
    const it = hxItem(s.id); if (!it || it.wall) return '';
    const c = hxCond(k);
    if (it.field) return c === 'ripe' ? `<button class="isbub collect" data-b="${k}" data-hx="harvest" data-k="${k}">🌾 Harvest</button>` : '';
    let t = '';
    if (c === 'build') t = `⏳ ${isTimeLeft(s.ready)}`;
    else if (s.up) t = `⬆️ ${isTimeLeft(s.up.r)}`;
    else if (c === 'broken') t = '🔴 Repair';
    else if (c === 'worn') t = '🟠 Worn';
    else if (!hxLinked(k, net)) t = '🛣️ No road';
    else if ((it.b.lp && sto.l) || (it.b.ep && sto.e)) return `<button class="isbub collect" data-b="${k}" data-hx="collect">${it.b.lp && sto.l ? `${LUMEN} ${sto.l}` : ''}${it.b.lp && it.b.ep && sto.l && sto.e ? ' · ' : ''}${it.b.ep && sto.e ? `${EMBER} ${sto.e}` : ''}</button>`;
    return t ? `<button class="isbub" data-b="${k}" data-hx="sel" data-k="${k}">${t}</button>` : '';
  }).join('');
  const lvI = typeof solisLevel === 'function' ? solisLevel() : null;
  const tool = P && (P.id === 'road' || P.id === 'wall' || P.id === 'erase');
  const hud = `<div class="ishud is-tl"><div class="islvl"><b>${lv}</b><div><span>Level ${lv}</span>${lvI ? `<i style="width:${Math.round(lvI.into / lvI.need * 100)}%"></i>` : ''}</div></div>
      <div class="isbuilders" title="Builders: how many things can be built or upgraded at once">🔨 ${IS_BUILDERS - busy}/${IS_BUILDERS} builders free</div></div>
    <div class="ishud is-tr">${isBar('cd-l', LUMEN, w.lumen, sto.l ? `+${sto.l} to collect · store ${sto.capL}` : `Store ${sto.capL}`, sto.l / sto.capL, sto.l ? 'collect' : '')}${isBar('cd-e', EMBER, w.ember, sto.e ? `+${sto.e} to collect · store ${sto.capE}` : `Store ${sto.capE}`, sto.e / sto.capE, sto.e ? 'collect' : '')}</div>
    <div class="ishud is-bl"><button class="isbtn" data-hx="panel" data-v="perks">✨<span>Perks</span></button><button class="isbtn" data-hx="panel" data-v="help">❔<span>How it works</span></button>${ui.hxUndo ? '<button class="isbtn" data-hx="undo" title="Undo the last move (Ctrl+Z)">↶<span>Undo</span></button>' : ''}</div>
    ${P ? '' : `<div class="ishud is-br hxtools"><button class="isbtn" data-hx="tool" data-v="road" title="Lay roads by dragging">🛣️<span>Roads</span></button>${lv >= hxItem('wall').u ? '<button class="isbtn" data-hx="tool" data-v="wall" title="Lay walls by dragging">🧱<span>Walls</span></button>' : ''}<button class="isbtn big" data-hx="panel" data-v="shop">🛒<span>Build</span></button></div>`}`;
  let extra = `<div class="isbubs">${bubs}</div>`;
  if (P) extra += hxPlaceBar(P, tool);
  else if (ui.isPanel === 'shop') extra += isPanel('🛒 Build on your island', hxShopHtml(st, w, lv, busy));
  else if (ui.isPanel === 'perks') {
    const g = islBuffs(), rl = islEarn('lp'), re = islEarn('ep'), ring = hxRingClosed(st);
    extra += isPanel('✨ Your island perks', `${Object.keys(g).length || rl || re ? `<p>${isBuffText(Object.assign(g, rl ? { lp: rl } : {}, re ? { ep: re } : {}))}</p>` : '<p class="muted">Build something (and join it to your hall with a road) to get your first perk.</p>'}
      ${st.fed ? `<p class="small-text">🌾 Harvest eaten: +${st.fed} health until your next boss fight.</p>` : ''}${ring ? '<p class="small-text">🧱 Your walls close a ring round the hall: −3% damage taken.</p>' : ''}
      <p class="muted small-text">Battle perks add to your gear on the Character page. Collectors pile up bonus Lumen and Ember from your study and training until you collect it, up to what you can store (${LUMEN} ${sto.capL} · ${EMBER} ${sto.capE}).</p>`);
  }
  else if (ui.isPanel === 'help') extra += isPanel('❔ How your island works', `<ul class="ishelp">
      <li>The Hall, Library, Training hall, Tavern, Market and Practice yard are free. Tap one and press <b>Open</b> to go to its page.</li>
      <li>Buy buildings in <b>Build</b>. The building follows your mouse: green means it fits, red says why not. Press <b>R</b> to turn it and click to drop it. <b>Esc</b> or right-click cancels.</li>
      <li>A building only works when a <b>road</b> joins it to your hall. Press 🛣️ <b>Roads</b> and drag across hexes to lay them (${hxCost(HX_ROAD.l, HX_ROAD.x)} a hex). Roads over the river become bridges.</li>
      <li>Some buildings like a spot: a lumber mill next to forest, a mine next to a hill, a watermill on the river, a windmill among fields.</li>
      <li>Drag any building to move it, free. <b>Ctrl+Z</b> undoes the last move. Tap trees or rocks to clear them.</li>
      <li>You have ${IS_BUILDERS} builders. Buildings go to level ${IS_MAXLV}, wear after ${IS_WEAR} active days and break after ${IS_BREAK}; holidays and exam days don't count.</li></ul>
      ${typeof guideStart === 'function' ? '<button class="btn small" data-act="guideStart" data-v="hexmove">🧭 Show me how</button>' : ''}`);
  else if (ui.hxSel) extra += hxPopHtml(ui.hxSel, st, w, lv, busy, net, sto);
  if (ui.hxRefund) { const [l, x] = ui.hxRefund; extra += `<div class="ispanel iscentre"><div class="ispanel-h"><h3>🏝️ Your new hex island</h3></div><div class="ispanel-b"><p>Your island has been rebuilt on hexagons. Everything you spent on your old buildings is back in your wallet: <b>${hxCost(l, x)}</b>.</p><button class="btn primary" data-hx="refundok">Let's build</button></div></div>`; }
  return isFrame('personal', hud, extra);
}
function hxPlaceBar(P, tool) {
  if (hxHouseOn()) return hhPlaceBar(P, tool);
  if (tool) {
    const n = P.id === 'road' ? 'road' : P.id === 'wall' ? 'wall' : '';
    return `<div class="ishud is-bc isplace hxbar"><span>${P.id === 'erase' ? '🧽 Drag over roads and walls to remove them (roads give their cost back).' : `Drag across hexes to lay ${n} (${P.id === 'road' ? hxCost(HX_ROAD.l, HX_ROAD.x) : hxCost(0, hxItem('wall').x)} each).${P.n ? ` <b>${P.n} laid</b>` : ''}`} ${P.why ? `<b class="hxwhy bad">${esc(P.why)}</b>` : ''}</span>
      <button class="btn small ${P.id === 'erase' ? 'primary' : ''}" data-hx="tool" data-v="${P.id === 'erase' ? (P.was || 'road') : 'erase'}">${P.id === 'erase' ? '✏️ Lay' : '🧽 Remove'}</button><button class="btn small primary" data-hx="cancel">✔ Done</button></div>`;
  }
  const it = hxItem(P.id), ch = P.chk;
  return `<div class="ishud is-bc isplace hxbar"><span>${P.mode === 'move' ? 'Moving' : 'Placing'} <b>${esc(it.n)}</b>: ${ch ? ch.ok ? `<b class="hxwhy ok">✓ Fits</b>${ch.good.map(g => ` <span class="hxchip ok">${esc(g)}</span>`).join('')}${ch.warn.map(g => ` <span class="hxchip warn">${esc(g)}</span>`).join('')}` : `<b class="hxwhy bad">✗ ${esc(ch.why)}</b>` : 'move the mouse over the island'}</span>
    <button class="btn small" data-hx="rot" title="Turn (R)">⟳ Turn</button><button class="btn small ghost" data-hx="cancel" title="Esc or right-click">✖ Cancel</button></div>`;
}
function hxShopHtml(st, w, lv, busy) {
  return `<p class="muted small-text">You're level ${lv}. ${IS_BUILDERS - busy} of ${IS_BUILDERS} builders free. Buildings need a road to your hall to work.</p><div class="isshop">${HX_ITEMS.filter(it => !it.wall).map(it => {
    const own = hxOwned(it.id, st), max = it.max || 1, lock = lv < it.u, full = own >= max, can = !full && !lock && hxCan(it.l, it.x) && (it.field || busy < IS_BUILDERS);
    const perk = it.field ? `Harvest: +${HX_FED_HP} health until your next boss fight` : isBuffText(it.b) + (it.near ? ` · ${HX_NEAR[it.near][1]}` : '') + (it.need ? ` · must touch the ${it.need}` : '') + (it.fields ? ' · +1% each per touching field' : '');
    return `<div class="isitem ${lock ? 'locked' : ''} ${full ? 'owned' : ''}"><div class="isitem-e">${lock ? '🔒' : it.e}</div><b>${it.n}</b>
      <div class="muted small-text">${lock ? `Unlocks at level ${it.u}` : perk}</div>
      <div class="small-text">${lock ? '&nbsp;' : `${it.field ? 'grows in' : 'builds in'} ${it.days} day${it.days === 1 ? '' : 's'}${max > 1 ? ` · ${own}/${max}` : ''}`}</div>
      ${full ? '<span class="tag">Built</span>' : lock ? `<span class="tag">Level ${it.u}</span>` : `<button class="btn small ${can ? 'primary' : ''}" data-hx="buy" data-id="${it.id}" ${can ? '' : 'disabled'} title="${!it.field && busy >= IS_BUILDERS ? 'All builders are busy' : ''}">${hxCost(it.l, it.x)}</button>`}</div>`;
  }).join('')}</div>`;
}
function hxPopHtml(k, st, w, lv, busy, net, sto) {
  const a = hxAt(k, st);
  const pop = (e, n, tags, sub, acts) => `<div class="ishud is-bc ispop"><div class="ispop-h"><span class="ise">${e}</span><div><b>${n}</b> ${tags}<div class="muted small-text">${sub}</div></div><button class="isx" data-hx="close" title="Close">✕</button></div><div class="ispop-a">${acts}</div></div>`;
  if (a.kind === 'free') {
    const f = a.it;
    return pop(f.e, f.n, '<span class="tag">Always open</span>', esc(f.d), `<button class="btn small primary" data-hx="open" data-v="${f.id}">Open →</button>${f.id !== 'hall' ? `<button class="btn small ghost" data-hx="move" data-k="${k}">✥ Move</button>` : ''}`);
  }
  if (a.kind === 'tree' || a.kind === 'rock') {
    const c = HX_CLEAR[a.kind]; return pop(a.kind === 'tree' ? '🌲' : '🪨', a.kind === 'tree' ? 'Trees' : 'Rocks', '', `Blocks this hex. ${a.kind === 'tree' ? 'Forest next to a lumber mill makes it collect 50% more, so you might keep some.' : ''}`, `<button class="btn small ${hxCan(c.l, c.x) ? 'primary' : ''}" data-hx="clear" data-k="${k}" ${hxCan(c.l, c.x) ? '' : 'disabled'}>🪓 Clear · ${hxCost(c.l, c.x)}</button>`);
  }
  if (a.kind === 'road') return pop(a.bridge ? '🌉' : '🛣️', a.bridge ? 'Bridge' : 'Road', '', 'Joins buildings to your hall.', `<button class="btn small ghost" data-hx="unroad" data-k="${k}">Remove (refund)</button>`);
  if (a.kind !== 'b') return '';
  const s = a.s, it = a.it, c = hxCond(k);
  if (it.wall) return pop(it.e, it.n, '', hxRingClosed(st) ? 'Part of a closed ring round your hall: −3% damage taken.' : 'Close a ring of wall round your hall for −3% damage taken.', `<button class="btn small ghost" data-hx="unwall" data-k="${k}">Remove</button>`);
  if (it.field) return pop(it.e, it.n, `<span class="tag">${c === 'ripe' ? '🌾 Ripe' : '🌱 Growing'}</span>`, c === 'ripe' ? `Harvest for +${HX_FED_HP} health until your next boss fight (it replants itself).` : `Ripe in ${isTimeLeft(s.ready)}. Fields touching a windmill boost it.`, `${c === 'ripe' ? `<button class="btn small primary" data-hx="harvest" data-k="${k}">🌾 Harvest</button>` : ''}<button class="btn small ghost" data-hx="move" data-k="${k}">✥ Move</button>`);
  const cur = hxLvOn(s), nx = cur + 1, m = IS_LVM[cur - 1], linked = hxLinked(k, net), bonus = hxBonus(it, k, st);
  let acts = '';
  if (c === 'build') acts = `<span class="muted small-text">Ready in ${isTimeLeft(s.ready)}</span>`;
  else if (s.up) acts = `<span class="muted small-text">Upgrading to level ${s.up.lv}, ready in ${isTimeLeft(s.up.r)}</span>`;
  else {
    if ((it.b.lp && sto.l) || (it.b.ep && sto.e)) acts += `<button class="btn small primary" data-hx="collect">✨ Collect</button>`;
    if (c === 'worn' || c === 'broken') { const f = IS_REPAIR[c], ok = hxCan(it.l * f, it.x * f); acts += `<button class="btn small ${ok ? 'primary' : ''}" data-hx="repair" data-k="${k}" ${ok ? '' : 'disabled'}>🔧 Repair · ${hxCost(it.l * f, it.x * f)}</button>`; }
    if (nx <= IS_MAXLV) {
      const need = isNeedLv(it, nx), f = IS_UPC[nx - 1], ok = lv >= need && hxCan(it.l * f, it.x * f) && busy < IS_BUILDERS;
      acts += lv < need ? `<span class="tag">🔒 Level ${need} to upgrade</span>` : `<button class="btn small ${ok ? 'primary' : ''}" data-hx="upgrade" data-k="${k}" ${ok ? '' : 'disabled'} title="${busy >= IS_BUILDERS ? 'All builders are busy' : ''}">⬆️ Level ${nx} · ${hxCost(it.l * f, it.x * f)} · ${Math.ceil(it.days * IS_UPD[nx - 1])}d</button>`;
    } else acts += '<span class="tag">⭐ Max level</span>';
  }
  acts += `<button class="btn small ghost" data-hx="move" data-k="${k}">✥ Move</button>`;
  const left = c === 'ok' && !s.up ? hxWearLeft(k) : 0;
  const notes = [isBuffText(it.b, m), bonus ? (it.fields ? `+${Math.round(bonus * 100)}% from fields` : `+${Math.round(bonus * 100)}% from the ${it.near === 'hill' ? 'hill' : 'forest'}`) : '', nx <= IS_MAXLV ? `next level: ${isBuffText(it.b, IS_LVM[nx - 1])}` : '', left > 0 ? `wears in ${left} active day${left === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  return pop(it.e, it.n, `<span class="tag">Level ${cur}</span> <span class="tag">${IS_LABEL[c] || ''}</span>${linked ? '' : ' <span class="tag hxbad">🛣️ Needs a road to your hall</span>'}`, notes, acts);
}
// the page buildings open their page
function hxOpen(id) {
  ui.hxSel = null;
  if (id === 'shop') { ui.youLook = true; ui.pfCat = 'shop'; view = 'profile'; }
  else if (id === 'spar') { ui.isTab = 'boss'; ui.isPanel = 'bspar'; }
  else view = hxFree(id)?.open || id;
  window.scrollTo(0, 0); render();
}

// ---------- actions ----------
function hxPlace(P, k) {
  if (hxHouseOn()) return hhPlace(P, k);
  const st = hxState(), it = hxItem(P.id); if (!it) return false;
  const ch = hxCheck(P.id, k, st, P.from); if (!ch.ok) { if (typeof sfx === 'function') sfx('deny'); toast('Can\'t go there', ch.why); return false; }
  if (P.mode === 'move') {
    if (P.free) { toast('Can\'t move that', 'Page buildings stay put for now.'); return false; }
    const s = st.b[P.from]; if (!s) return false; delete st.b[P.from]; s.rot = P.rot || 0; st.b[k] = s;
    ui.hxUndo = { from: P.from, to: k, rot: P.rot0 || 0 };
  } else {
    if (hxOwned(it.id, st) >= (it.max || 1) || !hxCan(it.l, it.x) || hxLv() < it.u || (!it.field && hxBusyN(st) >= IS_BUILDERS)) { toast('Can\'t build that now', ''); return false; }
    ftTake(it.l, it.x);
    st.b[k] = { id: it.id, start: today(), ready: addDays(today(), it.days || 0), reps: [], lv: 1, rot: P.rot || 0, t: Date.now() };
    toast(`${it.e} ${it.field ? 'Planted' : 'Building'} ${it.n}`, it.field ? `Ripe ${fmtDate(st.b[k].ready)}.` : `Ready ${fmtDate(st.b[k].ready)}.${ch.warn.length ? ' ' + ch.warn[0] + '.' : ''}`);
  }
  save(); hxFx('drop', k); return true;
}
// lay or remove a road or wall on one hex while dragging; returns why not, or ''
function hxPaint(tool, k) {
  if (hxHouseOn()) return hhPaint(tool, k);
  const st = hxState(), a = hxAt(k, st);
  if (tool === 'erase') {
    if (a.kind === 'road') { st.road = st.road.filter(x => x !== k); const c = a.bridge ? HX_BRIDGE : HX_ROAD; ftAddCurrency(c.l, c.x); return ''; }
    if (a.kind === 'b' && a.it.wall) { delete st.b[k]; return ''; }
    return 'nothing to remove';
  }
  if (tool === 'road') {
    const ch = hxCheck('road', k, st); if (!ch.ok) return ch.why;
    const c = a.kind === 'river' ? HX_BRIDGE : HX_ROAD; if (!hxCan(c.l, c.x)) return 'Not enough Lumen/Ember';
    ftTake(c.l, c.x); st.road.push(k); return '';
  }
  if (tool === 'wall') {
    const it = hxItem('wall'), ch = hxCheck('wall', k, st); if (!ch.ok) return ch.why;
    if (!hxCan(it.l, it.x)) return 'Not enough Ember';
    ftTake(it.l, it.x); st.b[k] = { id: 'wall', start: today(), ready: today(), reps: [], lv: 1, rot: 0 }; return '';
  }
  return '';
}
function hxStartPlace(P) {
  Object.assign(ui, { hxP: P, hxSel: null, isPanel: null }, hxHouseOn() ? { isSel: null } : {});
  if (typeof sfx === 'function') sfx('pickup');
  render(); if (HX3.hover) hxHover(HX3.hover, true);
}
function hxCancel() { if (!ui.hxP) return; const P = ui.hxP; ui.hxP = null; if (P.n) save(); render(); }
function hxUndo() {
  const u = ui.hxUndo, st = hxState(); if (!u || !st.b[u.to] || st.b[u.from]) { ui.hxUndo = null; render(); return; }
  st.b[u.from] = st.b[u.to]; st.b[u.from].rot = u.rot; delete st.b[u.to]; ui.hxUndo = null; save(); hxFx('drop', u.from); render(); toast('↶ Undone', 'Moved back.');
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-hx]'); if (!el) return;
  e.hxDone = true; // render() reuses DOM nodes, so later click handlers mustn't read this button again
  const st = hxState(), k = el.dataset.k, a = el.dataset.hx;
  switch (a) {
    case 'panel': Object.assign(ui, { isPanel: el.dataset.v, hxSel: null }); render(); break;
    case 'close': Object.assign(ui, { isPanel: null, hxSel: null }); render(); break;
    case 'sel': ui.hxSel = k; ui.isPanel = null; render(); break;
    case 'collect': isCollect(); break;
    case 'refundok': ui.hxRefund = null; render(); break;
    case 'open': hxOpen(el.dataset.v); break;
    case 'undo': hxUndo(); break;
    case 'cancel': hxCancel(); break;
    case 'rot': if (ui.hxP) { ui.hxP.rot = ((ui.hxP.rot || 0) + 1) % 6; hxGhostDraw(); } break;
    case 'tool': hxStartPlace({ id: el.dataset.v, mode: 'tool', n: 0, was: ui.hxP?.id }); break;
    case 'buy': { const it = hxItem(el.dataset.id); if (!it || hxLv() < it.u || !hxCan(it.l, it.x)) return; hxStartPlace({ id: it.id, mode: 'new', rot: 0 }); break; }
    case 'move': { const s = st.b[k], f = hxFreeAt(k); if (!s && !f) return; if (f) { toast('Page buildings stay put', 'They\'re the heart of your town for now.'); return; } hxStartPlace({ id: s.id, mode: 'move', from: k, rot: s.rot || 0, rot0: s.rot || 0 }); break; }
    case 'clear': { const at = hxAt(k, st), c = HX_CLEAR[at.kind]; if (!c || !hxCan(c.l, c.x)) return; ftTake(c.l, c.x); st.clr.push(k); ui.hxSel = null; save(); hxFx('dust', k); if (typeof sfx === 'function') sfx('rustle'); render(); break; }
    case 'unroad': { hxPaint('erase', k); ui.hxSel = null; save(); render(); break; }
    case 'unwall': { delete st.b[k]; ui.hxSel = null; save(); render(); break; }
    case 'harvest': { const s = st.b[k]; if (!s || hxCond(k) !== 'ripe') return; st.fed = HX_FED_HP; s.start = today(); s.ready = addDays(today(), hxItem('field').days); save(); if (typeof sfx === 'function') sfx('plant'); toast('🌾 Harvested', `+${HX_FED_HP} health until your next boss fight. The field is replanted.`); render(); break; }
    case 'upgrade': {
      const s = st.b[k], it = s && hxItem(s.id); if (!it || s.up || hxCond(k) === 'build') return;
      const nx = hxLvOn(s) + 1, f = IS_UPC[nx - 1], l = Math.round(it.l * f), x = Math.round(it.x * f), days = Math.ceil(it.days * IS_UPD[nx - 1]);
      if (nx > IS_MAXLV || hxLv() < isNeedLv(it, nx) || !hxCan(l, x) || hxBusyN(st) >= IS_BUILDERS) return;
      if (!confirm(`Upgrade ${it.n} to level ${nx} for ${hxCost(l, x)}? It takes ${days} day${days === 1 ? '' : 's'} and keeps working meanwhile.`)) return;
      ftTake(l, x); s.up = { lv: nx, s: today(), r: addDays(today(), days) }; save(); render(); toast(`⬆️ Upgrading ${it.n}`, `Level ${nx} ready ${fmtDate(s.up.r)}.`); break;
    }
    case 'repair': {
      const s = st.b[k], it = s && hxItem(s.id), c = hxCond(k), f = IS_REPAIR[c]; if (!f) return;
      const l = Math.round(it.l * f), x = Math.round(it.x * f); if (!hxCan(l, x)) return;
      ftTake(l, x); s.reps = [...(s.reps || []).filter(d => d >= addDays(today(), -400)), today()]; save(); render(); toast(`${it.e} ${it.n} repaired`, 'Its perk is back to full.'); break;
    }
  }
});
document.addEventListener('keydown', e => {
  if (view !== 'islands' || (typeof guideOn === 'function' && guideOn())) return;
  if (e.target.closest?.('input, textarea, select')) return;
  if ((ui.isTab || 'personal') === 'house') { // the house island: islands.js closes panels, this handles placing
    if (e.key === 'Escape' && ui.hxP) { e.preventDefault(); hxCancel(); }
    else if ((e.key === 'r' || e.key === 'R') && ui.hxP && ui.hxP.mode !== 'tool') { ui.hxP.rot = ((ui.hxP.rot || 0) + 1) % 6; hxGhostDraw(); }
    return;
  }
  if ((ui.isTab || 'personal') !== 'personal') return;
  if (e.key === 'Escape' && (ui.hxP || ui.hxSel || ui.isPanel)) { e.preventDefault(); if (ui.hxP) hxCancel(); else { Object.assign(ui, { isPanel: null, hxSel: null }); render(); } }
  else if ((e.key === 'r' || e.key === 'R') && ui.hxP && ui.hxP.mode !== 'tool') { ui.hxP.rot = ((ui.hxP.rot || 0) + 1) % 6; hxGhostDraw(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && ui.hxUndo) { e.preventDefault(); hxUndo(); }
});

// ---------- 3D ----------
const HX3 = { kit: null, loading: null, geos: {}, sig: '', anim: [], fx: [], ghost: null, hover: null, raf: 0 };
// loads hex/kaykit.bin once: one texture and every model, turned into three.js geometry on first use
function hxKit() {
  if (HX3.kit || HX3.loading) return HX3.kit;
  HX3.loading = fetch('hex/kaykit.bin').then(r => { if (!r.ok) throw new Error('kaykit ' + r.status); return r.arrayBuffer(); }).then(buf => new Promise((ok, no) => {
    const dv = new DataView(buf), n = dv.getUint32(4, true), idx = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), base = 8 + n;
    const img = new Image(), url = URL.createObjectURL(new Blob([new Uint8Array(buf, base + idx.tex[0], idx.tex[1])], { type: 'image/png' }));
    img.onload = () => {
      // the pack's grass is a very yellow lime: turn yellow-greens a little greener (roads, water, roofs untouched)
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const px = cx.getImageData(0, 0, cv.width, cv.height), a = px.data;
      for (let i = 0; i < a.length; i += 4) {
        const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < .25 || mx !== g && mx !== r) continue;
        let h = mx === r ? 60 * (((g - b) / d) % 6) : 60 * ((b - r) / d + 2); if (h < 0) h += 360; if (h < 52 || h > 85) continue;
        const nh = h + 22 * (1 - Math.abs(h - 68) / 20) + 6, c = d, x = c * (1 - Math.abs((nh / 60) % 2 - 1)), m = mx - c; // same brightness and saturation, new hue
        const [rr, gg, bb] = nh < 120 ? (nh < 60 ? [c, x, 0] : [x, c, 0]) : [0, c, x];
        a[i] = (rr + m) * 242; a[i + 1] = (gg + m) * 255; a[i + 2] = (bb + m) * 255;
      }
      cx.putImageData(px, 0, 0);
      const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true; URL.revokeObjectURL(url);
      HX3.kit = { buf, base, idx, tex, mat: new THREE.MeshStandardMaterial({ map: tex, roughness: .75, metalness: 0 }) };
      HX3.kit.ghost = { ok: new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: .7, emissive: '#3ad06b', emissiveIntensity: .35, depthWrite: false }), bad: new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: .55, emissive: '#ff3b3b', emissiveIntensity: .5, depthWrite: false }) };
      HX3.kit.ghostP = { ok: new THREE.MeshStandardMaterial({ color: '#7be495', transparent: true, opacity: .6, depthWrite: false }), bad: new THREE.MeshStandardMaterial({ color: '#ff6b6b', transparent: true, opacity: .5, depthWrite: false }) };
      HX3.kit.worn = new THREE.MeshStandardMaterial({ map: tex, roughness: .9, color: '#b9a58f' });
      ok(); if (view === 'islands') render();
    };
    img.onerror = no; img.src = url;
  })).catch(e => { console.error(e); HX3.fail = true; if (view === 'islands') render(); });
  return null;
}
// geometry for one part of a model in a colour (blue is the base; other colours swap some UVs)
function hxGeo(name, pi = 0, col = 'blue') {
  const key = name + '|' + pi + '|' + col; if (HX3.geos[key]) return HX3.geos[key];
  const K = HX3.kit, M = K.idx.models[name]; if (!M) return null;
  const p = M.p[pi], o = K.base + p.o, n = p.n;
  const pos = new Float32Array(K.buf.slice(o, o + n * 12));
  const ni = new Int8Array(K.buf, o + n * 12, n * 4), nrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { nrm[i * 3] = ni[i * 4] / 127; nrm[i * 3 + 1] = ni[i * 4 + 1] / 127; nrm[i * 3 + 2] = ni[i * 4 + 2] / 127; }
  const ui16 = new Uint16Array(K.buf, o + n * 16, n * 2), uv = new Float32Array(n * 2);
  for (let i = 0; i < n * 2; i++) uv[i] = ui16[i] / 65535;
  if (col !== 'blue' && M.c?.[col]?.[pi]) { const [off, cnt] = M.c[col][pi], d = new Uint16Array(K.buf, K.base + off, cnt * 3); for (let i = 0; i < cnt; i++) { uv[d[i * 3] * 2] = d[i * 3 + 1] / 65535; uv[d[i * 3] * 2 + 1] = d[i * 3 + 2] / 65535; } }
  const io = o + n * 20, idx = p.w === 2 ? new Uint16Array(K.buf.slice(io, io + p.i * 2)) : new Uint32Array(K.buf.slice(io, io + p.i * 4));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); return (HX3.geos[key] = g);
}
// a whole model as a group (each part keeps its own pivot, so fans and wheels can spin)
function hxModel(name, col, mat = HX3.kit.mat, shadow = true) {
  const M = HX3.kit.idx.models[name], g = new THREE.Group(); if (!M) return g;
  M.p.forEach((p, i) => {
    const m = new THREE.Mesh(hxGeo(name, i, col), mat); m.position.set(...p.t); m.castShadow = shadow; m.receiveShadow = true; m.name = p.m; g.add(m);
    if (/fan|wheel|saw/.test(p.m)) HX3.anim.push({ o: m, ax: /fan/.test(p.m) ? 'z' : 'x', sp: /saw/.test(p.m) ? 4 : /wheel/.test(p.m) ? -1.2 : 1.1 });
  });
  return g;
}
const hxLow = () => !!(D.settings && D.settings.lowQuality);
// mode 'hex' is your island, 'hexh' the shared house island (hxhouse.js); both are drawn by the same code
function mountHex3D(mode = 'hex') {
  if (!hxKit()) return false;
  IS3.layout = null; IS3.hexMode = true;
  if (IS3.house !== mode) { IS3.house = mode; HX3.sig = ''; Object.assign(IS3, is3home(mode), { tgt: [0, 0] }); if (HX3.ghost) { IS3.scene.remove(HX3.ghost); HX3.ghost = null; HX3.ghostModel = null; } }
  const st = hxCur(), W0 = hxW(st);
  const sig = [mode, W0.col || hxCol(), hxLow(), W0.sig ? W0.sig(st) : [JSON.stringify(st.b), st.road.join(';'), st.clr.join(';'), Object.keys(st.b).map(k => hxCond(k) + hxLvOn(st.b[k])).join()].join('|'), Math.floor(Date.now() / 36e5), ui.hxP?.mode === 'move' ? ui.hxP.from : ''].join('|');
  if (sig !== HX3.sig) { HX3.sig = sig; hxBuild(); }
  hxGhostDraw(); hxLoop(); is3draw(); return true;
}
// how a building on your own island looks right now: condition, level, upgrading, build progress
function hxLookHome(k, s, st) {
  const c = hxCond(k, today(), st), t0 = new Date(s.start + 'T00:00').getTime(), t1 = new Date(s.ready + 'T00:00').getTime();
  return { c, lv: hxLvOn(s), up: !!(s.up && today() < s.up.r), p: (Date.now() - (s.t || t0)) / Math.max(1, t1 - t0) };
}
// a building's model: a KayKit model, a custom one (it.make), plus any extra props (it.add)
function hxMakeModel(it, col, mat, shadow = true) {
  let g; col = it.col || col;
  if (it.make) { g = it.make(col); if (mat && mat !== HX3.kit.mat) { const pm = mat === HX3.kit.ghost.ok ? HX3.kit.ghostP.ok : mat === HX3.kit.ghost.bad ? HX3.kit.ghostP.bad : null; g.traverse(o => { if (o.isMesh) { o.material = o.material.map ? mat : pm || o.material; o.castShadow = shadow && o.castShadow; } }); } }
  else { g = hxModel(it.m, col, mat, shadow); if (it.s) { const w = new THREE.Group(); g.scale.setScalar(it.s); w.add(g); g = w; } }
  for (const [m, dx, dz, r = 0, s = 1] of it.add || []) { const p = hxModel(m === '@flag' ? 'flag_' + col : m, col, mat, shadow); p.position.set(dx, 0, dz); p.rotation.y = r; p.scale.setScalar(s); g.add(p); }
  return g;
}
// the middle of the hexes a building covers
const hxMid = (it, k) => { const fp = hxFoot(it, k); let x = 0, z = 0; for (const f of fp) { const [a, b] = hxPos(...hxQR(f)); x += a; z += b; } return [x / fp.length, z / fp.length]; };
// the whole island, rebuilt when something on it changes
function hxBuild() {
  const W = IS3.world, st = hxCur(), W0 = hxW(st), col = W0.col || hxCol(), L = W0.land(), R = W0.R || HX_R, S = (R + 1) / (HX_R + 1), rnd = seeded('solis-hex-dress' + (W0.seed || '')), low = hxLow();
  is3clear(); HX3.anim = []; IS3.marks = {};
  IS3.top = 0;
  Object.assign(IS3.sun.shadow.camera, { left: -17 * S, right: 17 * S, top: 17 * S, bottom: -17 * S, near: 1, far: 120 }); IS3.sun.shadow.camera.updateProjectionMatrix();
  IS3.sun.position.set(18, 34, 12); IS3.sun.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048); if (IS3.sun.shadow.map) { IS3.sun.shadow.map.dispose(); IS3.sun.shadow.map = null; }
  const add = (name, k, rot = 0, y = 0, s = 1, c = col, mat) => { const [x, z] = hxPos(...hxQR(k)); const g = hxModel(name, c, mat); g.position.set(x, y, z); g.rotation.y = -rot * Math.PI / 3; g.scale.setScalar(s); W.add(g); return g; };
  const roads = new Set(st.road), rivers = new Set([...L].filter(([, h]) => h.t === 'river').map(([k]) => k));
  const joins = n => roads.has(n) || n === '0,0' || !!hxFreeAt(n, st);
  // the rock under the island: a craggy hexagonal point with glowing crystals, like the other islands
  const base = is3mesh(is3rock(new THREE.CylinderGeometry(15.4 * S, 15.6 * S, 1.2, 6, 1), seeded('hxb'), .02), '#7a5a3e', 0, -1.6, 0, W); base.rotation.y = Math.PI / 6;
  const und = is3mesh(is3rock(new THREE.ConeGeometry(15 * S, 13 * S, 6, 6), seeded('hxu'), .22, .1), '#6d5f73', 0, -2.2 - 6.5 * S, 0, W); und.rotation.set(Math.PI, Math.PI / 6, 0);
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, r = (4 + rnd() * 6) * S, h = 1 + rnd() * 2; const cr = is3mesh(new THREE.ConeGeometry(.35 + rnd() * .3, h, 5), ['#4ee6ff', '#ffb347'][i % 2], Math.cos(a) * r, -3 - rnd() * 5 * S - h / 2, Math.sin(a) * r, W, true); cr.rotation.set(Math.PI + (rnd() - .5) * .5, 0, (rnd() - .5) * .5); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + rnd(), r = (22 + rnd() * 6) * S, s = .7 + rnd() * .8, g = new THREE.Group(); g.position.set(Math.cos(a) * r, -3 + rnd() * 6, Math.sin(a) * r); g.add(hxModel(rnd() < .5 ? 'hex_grass' : 'hex_grass_bottom', col)); if (rnd() < .6) { const t = hxModel(rnd() < .5 ? 'trees_A_small' : 'tree_single_B', col); g.add(t); } g.scale.setScalar(s); W.add(g); HX3.anim.push({ o: g, bob: rnd() * 6, y: g.position.y }); }
  // ground tiles
  for (const [k, h] of L) {
    const a = hxAt(k, st);
    if (h.t === 'water') { add('hex_water', k); if (rnd() < .12) add(rnd() < .5 ? 'waterlily_A' : 'waterplant_B', k, Math.floor(rnd() * 6), -.2); continue; }
    if (h.t === 'river') {
      const m = hxNb(k).reduce((mm, n, i) => mm | (rivers.has(n) || L.get(n)?.t === 'water' ? 1 << i : 0), 0), [v, t] = hxTileFor(m);
      add('hex_river_' + v, k, t);
      if (roads.has(k)) { const rm = hxNb(k).reduce((mm, n, i) => mm | (joins(n) ? 1 << i : 0), 0), e = [0, 1, 2, 3, 4, 5].find(i => rm & 1 << i) ?? 0; add('building_bridge_A', k, e + 1.5, 0); }
      continue;
    }
    if (a.kind === 'road') { const m = hxNb(k).reduce((mm, n, i) => mm | (joins(n) ? 1 << i : 0), 0), [v, t] = hxTileFor(m); add('hex_road_' + v, k, t); }
    else add('hex_grass', k, Math.floor(h.v * 6));
    if (a.kind === 'tree') { add(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6); IS3.marks[k] = null; }
    else if (a.kind === 'rock') { for (let i = 0; i < 3; i++) { const g = add(['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'][Math.floor(rnd() * 5)], k, 0, 0, 1.6 + rnd() * .8); g.position.x += (rnd() - .5) * 1.1; g.position.z += (rnd() - .5) * 1.1; g.rotation.y = rnd() * 6.28; } }
    else if (a.kind === 'hill') add(['hills_A', 'hills_B_trees', 'hills_C', 'hill_single_A'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6);
    else if (a.kind === 'mount') add(['mountain_A_grass_trees', 'mountain_B_grass', 'mountain_C_grass_trees'][Math.floor(h.v * 3)], k, Math.floor(h.v * 60) % 6);
    else if (a.kind === 'grass' && !low && h.v > .82) { const g = add(['tree_single_A', 'rock_single_B', 'tree_single_B'][Math.floor(h.v * 30) % 3], k, 0, 0, .8); g.position.x += (rnd() - .5) * 1.2; g.position.z += (rnd() - .5) * 1.2; }
  }
  // page buildings (the house island has only its great hall)
  W0.free.forEach((f, i) => {
    const g = add(f.m, f.at, f.rot ?? (f.id === 'hall' ? 0 : [3, 4, 2, 5, 1][i - 1] || 0), 0, f.s || 1);
    const [x, z] = hxPos(...hxQR(f.at)); IS3.marks[f.at] = [x, f.at === '0,0' ? 5.2 * (f.s || 1) : 2.4, z];
    if (f.id === 'hall') { const o = is3mesh(new THREE.IcosahedronGeometry(.42, 1), '#ffb347', 0, 4.65, 0, g, true); HX3.anim.push({ o, orb: 1 }); const ring = is3mesh(new THREE.TorusGeometry(.7, .04, 4, 20), '#ffe8a3', 0, 4.65, 0, g, true); HX3.anim.push({ o: ring, ring: 1 }); }
  });
  if (W0.dress) W0.dress(W, add, rnd, col);
  // the buildings, by stage
  const net = hxLinks(st);
  const walls = new Set(Object.entries(st.b).filter(([, s]) => W0.item(s.id)?.wall).map(([k]) => k));
  const lifted = ui.hxP?.mode === 'move' ? ui.hxP.from : null; // the one being moved is drawn as the ghost instead
  for (const [k, s] of Object.entries(st.b)) {
    const it = W0.item(s.id); if (!it || k === lifted) continue;
    const fp = hxFoot(it, k), [x, z] = hxMid(it, k), lk = W0.look ? W0.look(k, s, st) : hxLookHome(k, s, st), c = lk.c, lv = lk.lv, rot = s.rot || 0, mk = s.key || k;
    if (it.wall) {
      const ns = hxNb(k); let any = false;
      if (it.gate) { const i = Math.max(0, ns.findIndex(n => walls.has(n))); const g = add('wall_straight_gate', k, i); g.position.x += Math.cos(i * Math.PI / 3) * .5; g.position.z += Math.sin(i * Math.PI / 3) * .5; continue; }
      ns.forEach((n, i) => { if (walls.has(n) && i < 3) { any = true; const g = add('wall_straight', k, i); g.position.x += Math.cos(i * Math.PI / 3); g.position.z += Math.sin(i * Math.PI / 3); } });
      if (!any || ns.some((n, i) => walls.has(n) && i >= 3)) add('wall_corner_A_outside', k, 0, 0, .55);
      continue;
    }
    if (it.field) { const g = add('building_grain', k, rot); if (c === 'grow') g.scale.set(1, Math.min(1, Math.max(.15, lk.p)), 1); IS3.marks[mk] = [x, 1, z]; continue; }
    IS3.marks[mk] = [x, it.hz === 7 ? 4.4 : 2.6, z];
    if (c === 'build') {
      fp.forEach((f, i) => { add('building_dirt', f, rot); if (i) return; if (lk.p < .5) { add('building_stage_A', f, rot); add('resource_lumber', f, rot + 2, 0, 1).position.x += .5; } else add('building_scaffolding', f, rot); });
      if (!low) hxWorkers(W, x, z, rnd);
    } else if (c === 'broken') fp.forEach(f => add('building_destroyed', f, rot));
    else {
      const g = hxMakeModel(it, col, c === 'worn' ? HX3.kit.worn : undefined); g.position.set(x, 0, z); g.rotation.y = -rot * Math.PI / 3; g.scale.setScalar(1 + (lv - 1) * .06); W.add(g);
      if (lk.up) { add('ladder', k, rot + 1, 0, 1).position.x += .6; if (!low) hxWorkers(W, x, z, rnd); }
      if (!it.noRoad && !hxLinked(k, net, st)) for (const f of fp) { const [fx, fz] = hxPos(...hxQR(f)), r = is3mesh(new THREE.RingGeometry(1.55, 1.75, 6), '#ff8f5a', fx, .03, fz, W, true); r.rotation.set(-Math.PI / 2, 0, Math.PI / 6); }
    }
    for (let i = 1; i < lv; i++) { const g = add('flag_' + col, k, 0, 0, .8); g.position.x += .7 - i * .25; g.position.z += .55; }
  }
  // clouds drifting past, and chimney smoke
  if (!low) for (let i = 0; i < 5; i++) { const g = hxModel(i % 2 ? 'cloud_small' : 'cloud_big', col, HX3.kit.mat, false); const a = rnd() * 6.28, r = (10 + rnd() * 14) * S; g.position.set(Math.cos(a) * r, 7 + rnd() * 4, Math.sin(a) * r); g.scale.setScalar(1 + rnd()); W.add(g); HX3.anim.push({ o: g, cloud: .2 + rnd() * .3, a, r }); }
  // invisible ground the mouse lands on
  const pick = IS3.grid = new THREE.Mesh(new THREE.CircleGeometry(20 * S, 6), new THREE.MeshBasicMaterial({ visible: false })); pick.rotation.x = -Math.PI / 2; W.add(pick);
  IS3.ghost.visible = false;
}
// little builders hammering by a site
function hxWorkers(W, x, z, rnd) {
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(), a = rnd() * 6.28; g.position.set(x + Math.cos(a) * .9, 0, z + Math.sin(a) * .9); g.rotation.y = -a + Math.PI / 2;
    is3mesh(new THREE.CylinderGeometry(.08, .11, .3, 6), ['#3b5bdb', '#c92a2a'][i], 0, .15, 0, g); is3mesh(new THREE.SphereGeometry(.08, 8, 6), '#f1c27d', 0, .38, 0, g);
    const arm = is3mesh(new THREE.BoxGeometry(.04, .18, .04), '#6b4c33', .1, .32, 0, g); W.add(g); HX3.anim.push({ o: arm, hammer: rnd() * 6 }); HX3.anim.push({ o: g, hop: rnd() * 6 });
  }
}
// the building following the mouse while placing, with a coloured hex outline and its bonus hexes lit up
function hxGhostDraw() {
  if (!HX3.kit || !IS3.world) return;
  if (HX3.ghost) { IS3.scene.remove(HX3.ghost); HX3.ghost = null; HX3.ghostModel = null; }
  const P = ui.hxP, k = HX3.hover; if (!P || !k || view !== 'islands') { is3draw(); return; }
  const g = HX3.ghost = new THREE.Group(), [x, z] = hxPos(...hxQR(k));
  const outline = (kk, c, o = .9) => { const [xx, zz] = hxPos(...hxQR(kk)), r = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.72, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); r.rotation.set(-Math.PI / 2, 0, Math.PI / 6); r.position.set(xx - x, .06, zz - z); g.add(r); return r; };
  g.position.set(x, 0, z); IS3.scene.add(g);
  if (P.mode === 'tool') { outline(k, P.why ? '#ff5252' : P.id === 'erase' ? '#ffa94d' : '#51cf66'); is3draw(); return; }
  const st = hxCur(), ch = P.chk || hxCheck(P.id, k, st, P.from), it = hxW(st).item(P.id); if (!it) { is3draw(); return; }
  const fp = hxFoot(it, k), [mx, mz] = hxMid(it, k);
  for (const f of fp) {
    outline(f, ch.ok ? (ch.warn.length && !ch.good.length ? '#ffd43b' : '#51cf66') : '#ff5252');
    const [fx, fz] = hxPos(...hxQR(f)), fill = new THREE.Mesh(new THREE.CircleGeometry(1.6, 6), new THREE.MeshBasicMaterial({ color: ch.ok ? '#51cf66' : '#ff5252', transparent: true, opacity: .22, depthWrite: false })); fill.rotation.set(-Math.PI / 2, 0, Math.PI / 6); fill.position.set(fx - x, .05, fz - z); g.add(fill);
  }
  for (const b of ch.bonus || []) outline(b, '#ffd43b', .8);
  const m = hxMakeModel(it, hxW(st).col || hxCol(), ch.ok ? HX3.kit.ghost.ok : HX3.kit.ghost.bad, false); m.rotation.y = -(P.rot || 0) * Math.PI / 3; m.position.set(mx - x, .5, mz - z); g.add(m); HX3.ghostModel = m;
  is3draw();
}
function hxHover(k, force) {
  const P = ui.hxP; if (k === HX3.hover && !force) return;
  HX3.hover = k;
  if (P && P.mode !== 'tool') {
    P.chk = k ? hxCheck(P.id, k, hxCur(), P.from) : null;
    const bar = document.querySelector('#isfull .hxbar'); if (bar) { const tmp = document.createElement('div'); tmp.innerHTML = hxPlaceBar(P, false); bar.replaceWith(tmp.firstElementChild); }
    if (typeof sfx === 'function' && k) sfx('hover', { gap: 40 });
  }
  hxGhostDraw();
}
// pointer handling, called from islands.js's canvas listeners while a hex island shows
function hxKey(e) { const r = IS3.canvas.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); IS3.ray.setFromCamera(m, IS3.cam); const hit = IS3.grid && IS3.ray.intersectObject(IS3.grid)[0]; return hit ? hxFromXZ(hit.point.x, hit.point.z) : null; }
function hxPointer(type, e) {
  if (IS3.house !== 'hex' && IS3.house !== 'hexh') return false;
  if (typeof guideOn === 'function' && guideOn()) return type !== 'move'; // a guide is showing: look, don't build
  const P = ui.hxP, house = IS3.house === 'hexh';
  if (type === 'context') { if (P) { hxCancel(); return true; } return false; }
  if (type === 'down') {
    HX3.down = { x: e.clientX, y: e.clientY, k: hxKey(e), btn: e.button };
    if (P && P.mode === 'tool' && e.button === 0) { HX3.paint = { last: null }; hxPaintAt(HX3.down.k); return true; }
    return false;
  }
  if (type === 'move') {
    const k = hxKey(e);
    if (HX3.paint) { hxPaintAt(k); return true; }
    // press on one of your buildings and drag: pick it up (on the house island, leaders only)
    const D0 = HX3.down;
    if (D0 && !P && D0.btn === 0 && Math.abs(e.clientX - D0.x) + Math.abs(e.clientY - D0.y) > 8) {
      const st = hxCur(), a = D0.k ? hxAt(D0.k, st) : null, s = a?.kind === 'b' ? a.s : null;
      if (s && !a.it?.wall && (!house || hhCanEdit())) { HX3.down = null; HX3.dragged = true; hxStartPlace({ id: s.id, key: s.key, mode: 'move', from: a.main, rot: s.rot || 0, rot0: s.rot || 0, drag: true }); hxHover(k, true); return true; }
    }
    if (ui.hxP && !HX3.down) { hxHover(k); return true; }
    if (ui.hxP && ui.hxP.drag) { hxHover(k); return true; }
    return !!(ui.hxP && ui.hxP.drag);
  }
  if (type === 'up') {
    const D0 = HX3.down; HX3.down = null;
    if (HX3.paint) { HX3.paint = null; if (house) hhPaintDone(); else { save(); render(); } return true; }
    if (P && P.drag) { const k = hxKey(e); if (k && hxPlace(P, k)) { ui.hxP = null; if (!house) ui.hxSel = k; render(); } else hxCancel(); return true; }
    if (!D0 || Math.abs(e.clientX - D0.x) + Math.abs(e.clientY - D0.y) > 6 || D0.btn !== 0) return !!P;
    const k = hxKey(e);
    if (P) { if (k && hxPlace(P, k)) { ui.hxP = null; if (!house) ui.hxSel = P.mode === 'new' && hxItem(P.id).field ? null : k; render(); } return true; }
    if (house) { hhTap(k); return true; }
    // a tap: select what's there
    const a = k ? hxAt(k) : { kind: 'off' };
    const sel = ['free', 'b', 'tree', 'rock', 'road'].includes(a.kind) ? k : null;
    if (sel !== ui.hxSel || ui.isPanel) { ui.hxSel = sel; ui.isPanel = null; if (sel && typeof sfx === 'function') sfx('select'); render(); }
    return true;
  }
  return false;
}
function hxPaintAt(k) {
  const P = ui.hxP, T = HX3.paint; if (!P || !T || !k) return;
  const line = T.last ? hxLine(T.last, k).slice(1) : [k]; T.last = k;
  let why = '';
  for (const kk of line) { const w = hxPaint(P.id, kk); if (!w) { P.n = (P.n || 0) + 1; hxFx('pop', kk); } else why = w; }
  P.why = line.length && why && why !== 'nothing to remove' && why !== 'Already a road' ? why : '';
  HX3.hover = k; HX3.sig = ''; mountHex3D(IS3.house);
  const bar = document.querySelector('#isfull .hxbar'); if (bar) { const tmp = document.createElement('div'); tmp.innerHTML = hxPlaceBar(P, true); bar.replaceWith(tmp.firstElementChild); }
}
// little moments: a drop bounce with a dust puff and a thunk, a camera nudge
function hxFx(kind, k) {
  if (!window.THREE || !IS3.world || !k) return;
  const [x, z] = hxPos(...hxQR(k)), t0 = performance.now();
  if (kind === 'drop' && typeof sfx === 'function') { sfx('pop'); setTimeout(() => sfx('stone'), 90); }
  if (kind === 'pop' && typeof sfx === 'function') sfx('click', { gap: 50 });
  if (kind === 'drop') { HX3.nudge = t0; HX3.bounce = { k, t0 }; }
  if (hxLow() && kind !== 'drop') return;
  const n = kind === 'pop' ? 3 : 9;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28, m = is3mesh(new THREE.IcosahedronGeometry(.18, 0), '#d8c8a8', x + Math.cos(a) * .6, .2, z + Math.sin(a) * .6, IS3.scene, false);
    m.castShadow = false; m.material = m.material.clone(); m.material.transparent = true;
    HX3.fx.push({ o: m, t0, a, x, z });
  }
  hxLoop();
}
// animation: windmill fans, the orb, clouds, workers, effects. Low quality only animates effects.
function hxLoop() {
  if (HX3.raf) return;
  const tick = now => {
    HX3.raf = 0;
    if ((IS3.house !== 'hex' && IS3.house !== 'hexh') || view !== 'islands' || !IS3.canvas?.isConnected) return;
    const t = now / 1000, low = hxLow();
    if (!low) for (const a of HX3.anim) {
      if (a.ax) a.o.rotation[a.ax] = t * a.sp;
      else if (a.orb) a.o.position.y = 4.65 + Math.sin(t * 1.5) * .12;
      else if (a.ring) a.o.rotation.set(1.2 + Math.sin(t * .7) * .3, t * .8, 0);
      else if (a.cloud) { a.a += a.cloud * .0015; a.o.position.x = Math.cos(a.a) * a.r; a.o.position.z = Math.sin(a.a) * a.r; }
      else if (a.hammer != null) a.o.rotation.z = Math.sin(t * 9 + a.hammer) * .9;
      else if (a.hop != null) a.o.position.y = Math.abs(Math.sin(t * 4 + a.hop)) * .05;
      else if (a.bob != null) a.o.position.y = a.y + Math.sin(t * .6 + a.bob) * .4;
      else if (a.spin != null) a.o.rotation.y = t * a.spin;
      else if (a.flick != null) a.o.scale.set(1, .8 + Math.abs(Math.sin(t * 7 + a.flick)) * .4, 1);
    }
    if (HX3.ghostModel) HX3.ghostModel.position.y = .45 + Math.sin(t * 5) * .12;
    HX3.fx = HX3.fx.filter(f => {
      const p = (now - f.t0) / 650; if (p >= 1) { IS3.scene.remove(f.o); f.o.geometry.dispose(); return false; }
      f.o.position.set(f.x + Math.cos(f.a) * (.6 + p * 1.1), .2 + Math.sin(p * 3) * .5, f.z + Math.sin(f.a) * (.6 + p * 1.1)); f.o.scale.setScalar(1 + p * 1.5); f.o.material.opacity = 1 - p; return true;
    });
    if (HX3.nudge) { const p = (now - HX3.nudge) / 400; IS3.distK = p < 1 ? 1 - Math.sin(p * Math.PI) * .03 : 1; if (p >= 1) HX3.nudge = 0; }
    if (HX3.bounce) { const p = (now - HX3.bounce.t0) / 450, s = 1 + Math.sin(Math.min(1, p) * Math.PI * 2) * .08 * (1 - Math.min(1, p)); IS3.world.children.forEach(o => { const [x, z] = hxPos(...hxQR(HX3.bounce.k)); if (o.isGroup && Math.abs(o.position.x - x) < .01 && Math.abs(o.position.z - z) < .01 && o.position.y >= 0) o.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }); if (p >= 1) HX3.bounce = null; }
    is3draw();
    if (!low || HX3.fx.length || HX3.nudge || HX3.bounce || ui.hxP) HX3.raf = requestAnimationFrame(tick);
  };
  HX3.raf = requestAnimationFrame(tick);
}
// ---------- the "How to build on hexes" walkthrough (whatsnew.js plays it) ----------
// a box over a hex on screen, so a guide step can point at something in the 3D world
function hxAnchor(k) {
  const f = document.getElementById('isfull'); if (!f || !window.THREE || !IS3.cam) return;
  let a = document.getElementById('hxanchor'); if (!a) { a = document.createElement('div'); a.id = 'hxanchor'; f.appendChild(a); }
  const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 1, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect();
  Object.assign(a.style, { left: ((v.x + 1) / 2 * r.width - 50) + 'px', top: ((1 - v.y) / 2 * r.height - 60) + 'px' });
}
const hxGuideHome = () => { if (view !== 'islands' || (ui.isTab || 'personal') !== 'personal') { view = 'islands'; ui.isTab = 'personal'; } Object.assign(ui, { isPanel: null, hxSel: null, hxP: null, hxRefund: null }); render(); };
const hxGuideGhost = () => { hxGuideHome(); ui.hxP = { id: 'cottage', mode: 'new', rot: 0 }; render(); setTimeout(() => hxHover('1,1', true), 60); };
if (typeof GUIDES === 'object') GUIDES.hexmove = {
  name: 'Building on your hex island',
  end: () => { ui.hxP = null; document.getElementById('hxanchor')?.remove(); if (view === 'islands') render(); },
  steps: [
    { title: 'Your island is now hexagons 🏝️', text: 'Everything sits on a hex grid now, built from proper medieval models. Your Hall is in the middle, with the Library, Training hall, Tavern, Market and Practice yard around it. Tap any of them and press <b>Open</b> to go to its page.', go: hxGuideHome, wait: 500 },
    { title: 'Tap a building', text: 'Tapping the Hall (or any building) shows what it does. Page buildings have an <b>Open</b> button; your own buildings show their level, perk, Collect, Upgrade and Repair.', go: () => { hxGuideHome(); setTimeout(() => hxAnchor('0,0'), 80); }, sel: '#hxanchor', wait: 300 },
    { title: 'Buy something new', text: 'Press <b>Build</b> to see every building you can buy with Lumen and Ember. New ones unlock as your level goes up.', go: hxGuideHome, sel: '.hxtools [data-v="shop"]' },
    { title: 'Pick a building', text: 'Each card shows its perk, its price and how long it takes. Buildings with a linking bonus say so, like a lumber mill next to forest.', go: () => { hxGuideHome(); ui.isPanel = 'shop'; render(); }, sel: '#isfull .ispanel', place: 'left' },
    { title: 'It follows your mouse', text: 'After you buy, the building floats over the island and snaps to the hex under your mouse. <b>Green</b> means it fits, <b>red</b> tells you why not (blocked, no room, wrong terrain). Yellow outlines show the hexes that give it a bonus.', go: hxGuideGhost, sel: '#isfull .hxbar', wait: 400 },
    { title: 'Turn it, then drop it', text: 'Press <b>R</b> (or ⟳ Turn) to turn it, and click to drop it. There\'s no extra confirm. <b>Esc</b> or right-click cancels and nothing is spent.', go: () => { if (!ui.hxP) hxGuideGhost(); }, sel: '#isfull .hxbar [data-hx="rot"]' },
    { title: 'Move anything by dragging', text: 'Press on one of your buildings and drag it to a new hex. It lifts up, shows the same green/red check, and lands with a thunk. Moving is free, and <b>Ctrl+Z</b> (or ↶ Undo) puts it back.', go: () => { hxGuideHome(); setTimeout(() => hxAnchor('1,1'), 80); }, sel: '#hxanchor', wait: 300 },
    { title: 'Roads make buildings work', text: 'A building only gives its perk when a road joins it to your Hall. Press 🛣️ <b>Roads</b> and drag across the hexes to lay a line in one go. Roads over the river turn into bridges. Buildings without a road show an orange ring and a 🛣️ bubble.', go: hxGuideHome, sel: '.hxtools [data-v="road"]' },
    { title: 'Clear trees and rocks', text: 'Trees and rocks block a hex. Tap them to clear them for a little Lumen or Ember. Keep some forest by your lumber mill and a hill by your mine for +50%. That\'s it, have fun building!', go: () => { hxGuideHome(); setTimeout(() => hxAnchor('-4,-1'), 80); }, sel: '#hxanchor', wait: 300 },
  ],
};
