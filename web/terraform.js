'use strict';
/* Terraforming and decorations (2.70; Terraform 2.0 in 2.82, feedback stage F5). Loaded after hexpolish.js.
   Your island's changes live in hxState().tf: { 'q,r': { t, ps, h, c, d, r, e } }
     t  = painted ground: sand | path | forest | hill | water (no t = the island's own ground)
     ps = path style: stone | board (none = dirt). Paths are thin roads along the middle of a hex
          that join up with the paths, roads, bridges and buildings next to them.
     h  = raised by this many steps (0 to HX_TF.hMax); c = 1 when its sides are a rock face (cliff)
     d  = the one decoration on the hex, r = which way it faces (0 to 5, 60 degrees a step). Small
          "side" pieces (lamps, benches, banners, flowers...) can stand beside a path, at the corner r picks.
     e  = edge pieces (fences, hedges, low walls) on this hex's edges 0 to 2: { i: id }. Edges 3 to 5
          belong to the neighbour across them, so every edge is kept in exactly one place.
   Free (Eli, 16 Nov): grass, sand, forest, every path style, raise, lower, undo, reset, and turning or
   moving things you've placed. Costs a little: ponds, hills, cliffs, decorations and fences.
   Everything snaps to hexes (or hex edges) and turns in 60 degree steps with R or the mouse wheel;
   a see-through ghost shows what will go down, green when it fits, red with the reason when it
   doesn't. All prices are here. */
const HX_TF = {
  hStep: .34, hMax: 3,
  cats: [['ground', '🌱', 'Ground'], ['paths', '🛤️', 'Paths'], ['shape', '⛰️', 'Shape'], ['plants', '🌸', 'Plants'], ['decor', '🏮', 'Decor'], ['big', '⛲', 'Landmarks'], ['water', '🚣', 'Water'], ['edges', '🚧', 'Fences']],
  // painted ground and height, per hex
  brush: {
    grass: { n: 'Grass', e: '🟩', c: 'ground', l: 0, x: 0, d: 'Back to plain grass', col: '#7cc95a' },
    sand: { n: 'Sand', e: '🏖️', c: 'ground', l: 0, x: 0, col: '#ead39b' },
    forest: { n: 'Forest', e: '🌲', c: 'ground', l: 0, x: 0, d: 'Counts as forest for a lumber mill', col: '#2f8a3a' },
    path: { n: 'Dirt path', e: '🟫', c: 'paths', l: 0, x: 0, ps: 'dirt', d: 'A thin path that joins up with the roads, paths and buildings next to it', col: '#d2a86f' },
    pstone: { n: 'Stone path', e: '🔘', c: 'paths', l: 0, x: 0, ps: 'stone', d: 'Cobbles that join up like the dirt path', col: '#b8b2a4' },
    pboard: { n: 'Boardwalk', e: '🪵', c: 'paths', l: 0, x: 0, ps: 'board', d: 'Wooden planks that join up like the dirt path', col: '#a0703f' },
    up: { n: 'Raise', e: '⬆️', c: 'shape', l: 0, x: 0, d: 'One step higher per stroke', col: '#c3e6a1' },
    down: { n: 'Lower', e: '⬇️', c: 'shape', l: 0, x: 0, d: 'One step lower per stroke', col: '#8d7b62' },
    hill: { n: 'Hills', e: '⛰️', c: 'shape', l: 0, x: 2, d: 'Counts as a hill for a mine', col: '#b8a98a' },
    cliff: { n: 'Cliff', e: '🧗', c: 'shape', l: 0, x: 4, d: 'Raises the hex with rock sides', col: '#a7a39a' },
    water: { n: 'Pond', e: '💧', c: 'water', l: 0, x: 2, d: 'Bridges and boats go on ponds', col: '#5ec3ef' },
  },
  // one per hex. side = may stand beside a path, wat = goes on a pond (sea = or the sea), glow = lights up at night, wr = how big it is to walk round
  deco: {
    flowers: { n: 'Flowers', e: '🌸', c: 'plants', l: 5, x: 0, side: 1 },
    bush: { n: 'Bush', e: '🍀', c: 'plants', l: 5, x: 0, side: 1, wr: .3 },
    bed: { n: 'Flower bed', e: '🌷', c: 'plants', l: 15, x: 0, side: 1, wr: .3 },
    tree: { n: 'Tree', e: '🌳', c: 'plants', l: 8, x: 0, wr: .42 },
    rock: { n: 'Rock', e: '🪨', c: 'plants', l: 0, x: 5, wr: .38 },
    plot: { n: 'Garden plot', e: '🥕', c: 'plants', l: 20, x: 0, d: 'Vegetables in tidy rows' },
    bench: { n: 'Bench', e: '🪑', c: 'decor', l: 25, x: 0, side: 1, wr: .3 },
    lamp: { n: 'Lamp post', e: '🏮', c: 'decor', l: 0, x: 30, side: 1, glow: 1, d: 'Glows at night', wr: .14 },
    lamps: { n: 'Lamp line', e: '💡', c: 'decor', l: 0, x: 50, side: 1, glow: 1, d: 'A lamp each side of a path, glowing at night', wr: .14 },
    flag: { n: 'Flag', e: '🚩', c: 'decor', l: 20, x: 0, side: 1, d: 'In your house colour', wr: .12 },
    banner: { n: 'Banner', e: '🎏', c: 'decor', l: 25, x: 0, side: 1, d: 'A tall banner in your house colour', wr: .12 },
    barrels: { n: 'Barrels', e: '🛢️', c: 'decor', l: 0, x: 15, side: 1, wr: .3 },
    campfire: { n: 'Campfire', e: '🔥', c: 'decor', l: 0, x: 30, glow: 1, d: 'Crackles and glows at night', wr: .35 },
    cart: { n: 'Cart', e: '🛒', c: 'decor', l: 20, x: 0, wr: .38 },
    tent: { n: 'Tent', e: '⛺', c: 'decor', l: 40, x: 0, wr: .62 },
    stall: { n: 'Market stall', e: '🍎', c: 'decor', l: 60, x: 0, d: 'A little stall in your house colour', wr: .55 },
    well: { n: 'Wishing well', e: '🪙', c: 'big', l: 80, x: 0, wr: .45 },
    statue: { n: 'Statue', e: '🗿', c: 'big', l: 0, x: 150, wr: .4 },
    fountain: { n: 'Fountain', e: '⛲', c: 'big', l: 150, x: 0, wr: .62 },
    windmill: { n: 'Little windmill', e: '🌀', c: 'big', l: 120, x: 120, d: 'Its sails turn in the wind', wr: .45 },
    gazebo: { n: 'Gazebo', e: '🛖', c: 'big', l: 200, x: 0, wr: .8 },
    arch: { n: 'Rock arch', e: '⛩️', c: 'big', l: 0, x: 120, d: 'A natural stone arch you can walk under' },
    lily: { n: 'Lily pond', e: '🪷', c: 'water', l: 40, x: 0, d: 'A little pond with lily pads, on grass' },
    bridge: { n: 'Footbridge', e: '🌉', c: 'water', l: 0, x: 50, wat: 1, d: 'Goes over a pond; paths join onto its ends' },
    boat: { n: 'Rowing boat', e: '🚣', c: 'water', l: 40, x: 0, wat: 1, sea: 1, d: 'Floats on a pond or the sea' },
  },
  // on the edges between hexes
  edge: {
    fence: { n: 'Fence', e: '🚧', c: 'edges', l: 3, x: 0, d: 'Goes along hex edges' },
    picket: { n: 'Picket fence', e: '🤍', c: 'edges', l: 4, x: 0, d: 'Goes along hex edges' },
    hedge: { n: 'Hedge', e: '🌿', c: 'edges', l: 4, x: 0, d: 'Goes along hex edges' },
    lowwall: { n: 'Low wall', e: '🧱', c: 'edges', l: 0, x: 4, d: 'Goes along hex edges' },
  },
};
const TF_ERASE = { n: 'Remove', e: '🧽', l: 0, x: 0, d: 'Take decorations, plants and fences away' };
const TF_PS = { dirt: { n: 'Dirt path', w: .52, top: '#d6ad74', rim: '#a9bb63' }, stone: { n: 'Stone path', w: .58, top: '#a39d90', rim: '#9cb067' }, board: { n: 'Boardwalk', w: .5, top: '#5b3a20', rim: '#8fa860' } };
const TF_KCOL = { blue: '#4dabf7', red: '#fa5252', green: '#51cf66', yellow: '#fcc419' };
const tfAll = st => (st.tf = st.tf || {});
const hxHt = (k, st) => ((st?.tf?.[k]?.h) || 0) * HX_TF.hStep;
const tfBrush = id => HX_TF.brush[id] || HX_TF.deco[id] || HX_TF.edge[id];
const tfKind = id => HX_TF.brush[id] ? 'brush' : HX_TF.deco[id] ? 'deco' : HX_TF.edge[id] ? 'edge' : id === 'erase' ? 'erase' : '';
const tfCostTxt = (l, x) => l || x ? hxCost(l, x) : 'Free';
const tfDecoName = d => HX_TF.deco[d]?.n.toLowerCase() || 'decoration';

// ---------- what can go where ----------
// what a hex is under its painted ground (natural ground with trees/rocks cleared counts as grass)
function tfOpen(k, st) {
  const L = hxW(st).land(), h = L.get(k); if (!h || h.t === 'water' || h.t === 'river') return false;
  if (hxFreeAt(k, st) || st.road.includes(k)) return false;
  const mk = st.__occ?.[k] || (st.b[k] && k); if (mk && st.b[mk]) return false;
  return h.t === 'grass' || ((h.t === 'forest' || h.t === 'rock') && st.clr.includes(k)) || !!st.tf?.[k]?.t;
}
function tfBlocked(k, st) {
  const a = hxAt(k, st);
  return a.kind === 'off' || a.kind === 'water' || a.kind === 'deco' ? '-' : a.kind === 'tree' || a.kind === 'rock' ? 'Clear the trees and rocks first' : a.kind === 'b' || a.kind === 'free' ? 'There\'s a building here' : a.kind === 'road' ? 'There\'s a road here' : a.kind === 'river' ? 'The river stays' : 'Hills and mountains stay';
}
// what painting brush id on hex k would do: { nx, l, x } (turn: only turned it, free) or { why } ('-' = nothing to do)
function tfPlan(k, id, st = hxState(), rot = 0) {
  const cur = st.tf?.[k] || {}, b = tfBrush(id), kind = tfKind(id), dn = cur.d && HX_TF.deco[cur.d];
  const away = () => ({ why: `Take the ${tfDecoName(cur.d)} away first` });
  if (kind === 'erase') return cur.d ? { nx: { ...cur, d: undefined, r: undefined }, l: 0, x: 0 } : { why: '-' };
  if (!b || kind === 'edge') return { why: '-' };
  const turn = () => (cur.r || 0) === rot ? { why: '-' } : { nx: { ...cur, r: rot }, l: 0, x: 0, turn: 1 };
  if (b.wat) {
    const h = hxW(st).land().get(k), sea = h?.t === 'water' && !hxFreeAt(k, st);
    if (!(cur.t === 'water' || (b.sea && sea))) return { why: b.sea ? 'Boats go on a pond or the sea' : 'Bridges go over a pond (paint one first)' };
    if (cur.d) return cur.d === id ? turn() : away();
    return { nx: { ...cur, d: id, r: rot }, l: b.l, x: b.x };
  }
  if (!tfOpen(k, st)) return { why: tfBlocked(k, st) };
  const nx = { ...cur };
  if (id === 'up') { if ((cur.h || 0) >= HX_TF.hMax) return { why: 'As high as it goes' }; nx.h = (cur.h || 0) + 1; }
  else if (id === 'down') { if (!cur.h) return { why: '-' }; nx.h = cur.h - 1; }
  else if (id === 'cliff') { if (cur.c && cur.h) return { why: '-' }; nx.c = 1; nx.h = Math.max(cur.h || 0, 2); }
  else if (kind === 'brush') {
    const t = id === 'grass' ? undefined : b.ps ? 'path' : id, ps = b.ps && b.ps !== 'dirt' ? b.ps : undefined;
    if (cur.t === t && (t !== 'path' || cur.ps === ps)) return { why: '-' };
    if (dn && (t === 'forest' || t === 'hill' || (t === 'path' && !dn.side))) return away();
    if (dn && !!dn.wat !== (t === 'water')) return away();
    nx.t = t; nx.ps = ps;
  } else { // a decoration
    if (cur.d === id) return turn();
    if (cur.t === 'forest' || cur.t === 'hill' || cur.t === 'water') return { why: 'Decorations go on grass, sand or beside a path' };
    if (cur.t === 'path' && !b.side) return { why: 'Only small pieces (lamps, benches, banners, flowers…) go beside a path' };
    if (cur.d) return away();
    nx.d = id; nx.r = rot;
  }
  return { nx, l: b.l, x: b.x };
}
// ---------- edges ----------
// the hex edge under a point on the ground: { k: its home hex, i: edge 0 to 2, d: how far from the middle of the hex the point is, at: the hex the point is on }
function tfEdgeAt(pt = HX3.pt) {
  if (!pt) return null;
  const at = hxFromXZ(pt[0], pt[1]), [cx, cz] = hxPos(...hxQR(at)), a = Math.atan2(pt[1] - cz, pt[0] - cx);
  const i = ((Math.round(a / (Math.PI / 3)) % 6) + 6) % 6, d = Math.hypot(pt[0] - cx, pt[1] - cz);
  return i < 3 ? { k: at, i, d, at } : { k: hxNb(at)[i], i: i - 3, d, at };
}
const tfRoadish = (k, st) => { const a = hxAt(k, st); return a.kind === 'road' || a.kind === 'free' || (a.kind === 'b' && !a.it?.wall && !a.it?.field) || st.tf?.[k]?.t === 'path'; };
function tfEdgePlan(E, id, st = hxState()) {
  const L = hxW(st).land(), n = hxNb(E.k)[E.i], cur = st.tf?.[E.k] || {}, has = cur.e?.[E.i];
  if (id === 'erase') return has ? { nx: { ...cur, e: { ...cur.e, [E.i]: undefined } }, l: 0, x: 0 } : { why: '-' };
  const b = HX_TF.edge[id], h1 = L.get(E.k), h2 = L.get(n); if (!b) return { why: '-' };
  if (!h1 || !h2 || (h1.t === 'water' && h2.t === 'water')) return { why: '-' };
  if (has === id) return { why: '-' };
  if (tfRoadish(E.k, st) && tfRoadish(n, st)) return { why: 'A road or path runs through here' };
  return { nx: { ...cur, e: { ...(cur.e || {}), [E.i]: id } }, l: b.l, x: b.x };
}
// the Remove brush takes a fence away when you point near the edge of a hex that has one
const tfEdgeHere = (st, k) => { const E = tfEdgeAt(); return !!E && (!k || E.at === k) && E.d > .58 && !!st.tf?.[E.k]?.e?.[E.i]; };
const tfEdgeMode = (id, st, k) => tfKind(id) === 'edge' || (id === 'erase' && tfEdgeHere(st, k));
function tfEdgeSig() { const P = ui.hxP; if (P?.id !== 'tf' || (tfKind(P.brush) !== 'edge' && P.brush !== 'erase')) return ''; const E = tfEdgeAt(); return E ? E.k + '|' + E.i + (tfEdgeHere(hxState()) ? '!' : '') : ''; }

// ---------- painting ----------
// paint one hex (or the edge under the mouse) with the current brush; returns '' when done, '-' when there was nothing to do, or why not
function tfPaint(k) {
  const P = ui.hxP, st = hxState(), T = HX3.paint, id = P.brush || 'grass';
  let pl, key = k, hk = k;
  if (tfEdgeMode(id, st, k)) { const E = tfEdgeAt(); if (!E) return '-'; key = E.k + '|' + E.i; hk = E.k; if (T.done?.has(key)) return '-'; pl = tfEdgePlan(E, id, st); }
  else { if (T.done?.has(k)) return '-'; pl = tfPlan(k, id, st, P.rot || 0); }
  if (pl.why) return pl.why;
  if (!ui.tfPv && !hxCan(pl.l, pl.x)) return `Not enough ${pl.l ? 'Lumen' : 'Ember'}`;
  return tfApply(st, hk, pl.nx, pl.l, pl.x, key);
}
function tfClean(nx) {
  for (const kk of Object.keys(nx)) if (nx[kk] === undefined || (kk === 'h' && !nx.h)) delete nx[kk];
  if (nx.e) { const e = { ...nx.e }; for (const i of Object.keys(e)) if (!e[i]) delete e[i]; if (Object.keys(e).length) nx.e = e; else delete nx.e; }
  if (!nx.h) delete nx.c;
  if (nx.t !== 'path') delete nx.ps;
  return nx;
}
// what a hex's change from a to b costs (a preview charges this on Keep)
function tfDiffCost(a = {}, b = {}) {
  let l = 0, x = 0; const add = it => { if (it) { l += it.l; x += it.x; } };
  if (b.t && b.t !== a.t && b.t !== 'path') add(HX_TF.brush[b.t]);
  if (b.c && !a.c) add(HX_TF.brush.cliff);
  if (b.d && b.d !== a.d) add(HX_TF.deco[b.d]);
  for (const [i, id] of Object.entries(b.e || {})) if (a.e?.[i] !== id) add(HX_TF.edge[id]);
  return [l, x];
}
function tfApply(st, k, nx, l, x, key = k) {
  const T = HX3.paint || {}, P = ui.hxP, tf = tfAll(st), prev = tf[k] ? { ...tf[k] } : null;
  tfClean(nx);
  if (Object.keys(nx).length) tf[k] = nx; else delete tf[k];
  (T.done = T.done || new Set()).add(key);
  if (P) { P.sn = (P.sn || 0) + 1; P.sl = (P.sl || 0) + l; P.sx = (P.sx || 0) + x; }
  if (ui.tfPv) { // 2.77: a free preview: nothing is charged until Keep
    const pv = st.tfPv = st.tfPv || []; let e = pv.find(q => q.k === k);
    if (!e) pv.push(e = { k, prev, l: 0, x: 0 });
    [e.l, e.x] = tfDiffCost(e.prev || {}, tf[k] || {}); return '';
  }
  if (l || x) ftTake(l, x);
  if (!T.rec) { T.rec = []; (ui.tfHist = ui.tfHist || []).push(T.rec); if (ui.tfHist.length > 40) ui.tfHist.shift(); }
  T.rec.push({ k, prev, l, x });
  return '';
}
// 2.77 free preview: strokes are free and stay in st.tfPv until you Keep (pay) or Discard
const tfPvCost = st => (st.tfPv || []).reduce((a, e) => [a[0] + e.l, a[1] + e.x], [0, 0]);
function tfPvDiscard(st = hxState(), quiet) {
  const pv = st.tfPv; if (!pv?.length) { delete st.tfPv; return; }
  for (const e of pv) { if (e.prev) tfAll(st)[e.k] = e.prev; else delete tfAll(st)[e.k]; }
  delete st.tfPv; HX3.sig = ''; if (!quiet) { save(); toast('👁 Preview discarded', 'Your island is back as it was. Nothing was charged.'); }
}
function tfPvKeep() {
  const st = hxState(), [l, x] = tfPvCost(st); if (!st.tfPv?.length) return;
  if (!hxCan(l, x)) { toast('Not enough yet', `Keeping these costs ${hxCost(l, x)}.`); return; }
  if (l || x) ftTake(l, x);
  const n = st.tfPv.length; delete st.tfPv; save(); if (typeof sfx === 'function') sfx('coin'); render(); toast('🌱 Kept', `${n} hex${n === 1 ? '' : 'es'} for ${tfCostTxt(l, x).toLowerCase()}.`);
}
function tfUndo() {
  const rec = ui.tfHist?.pop(), st = hxState(); if (!rec) return;
  let l = 0, x = 0;
  for (const u of rec.slice().reverse()) { if (u.prev) tfAll(st)[u.k] = u.prev; else delete tfAll(st)[u.k]; l += u.l; x += u.x; }
  if (l || x) ftAddCurrency(l, x);
  save(); HX3.sig = ''; render(); toast('↶ Undone', l || x ? `${hxCost(l, x)} back.` : 'Put back.');
}
function tfReset() {
  const st = hxState(), tf = tfAll(st);
  if (!Object.values(tf).some(v => v.t || v.h)) { toast('Nothing to reset', 'Your ground is as it started.'); return; }
  if (!confirm('Put all the ground, paths and heights back as they started? Decorations and fences stay. This can\'t be undone.')) return;
  for (const [k, v] of Object.entries(tf)) {
    for (const f of ['t', 'h', 'c', 'ps']) delete v[f];
    if (v.d && HX_TF.deco[v.d]?.wat && hxW(st).land().get(k)?.t !== 'water') { delete v.d; delete v.r; } // a bridge or boat on a pond that's gone
    if (!Object.keys(v).length) delete tf[k];
  }
  ui.tfHist = []; save(); HX3.sig = ''; render(); toast('🌱 Terrain reset', 'The ground is back as it started.');
}
// turning and moving what you've placed is free
function tfTurn(k, by = 1) {
  const st = hxState(), v = st.tf?.[k]; if (!v?.d) return false;
  v.r = ((v.r || 0) + by + 6) % 6; save(); HX3.sig = ''; if (typeof sfx === 'function') sfx('click'); render(); return true;
}
function tfMovePlan(P, k, st = hxState()) {
  const cur = st.tf?.[P.from]; if (!cur?.d) return { why: 'It\'s gone' };
  if (k === P.from) return (cur.r || 0) === (P.rot || 0) ? { why: '-' } : { turn: 1 };
  const tf = { ...st.tf, [P.from]: { ...cur, d: undefined, r: undefined } };
  const pl = tfPlan(k, P.d, { ...st, tf }, P.rot || 0); return pl.turn ? { why: '-' } : pl;
}
function tfMoveDrop(P, k) {
  const st = hxState(), cur = st.tf?.[P.from]; if (!cur?.d) return false;
  const pl = tfMovePlan(P, k, st);
  if (pl.why === '-') return true;
  if (pl.why) { if (typeof sfx === 'function') sfx('deny'); toast('Can\'t go there', pl.why); return false; }
  const d = cur.d; delete cur.d; delete cur.r; if (!Object.keys(cur).length) delete st.tf[P.from];
  const t = tfAll(st); t[k] = tfClean({ ...(t[k] || {}), d, r: P.rot || 0 });
  save(); hxFx('drop', k); return true;
}
function tfMoveBar(P) {
  const it = HX_TF.deco[P.d], ch = P.chk;
  return `<div class="ishud is-bc isplace hxbar"><span>Moving <b>${it?.e || ''} ${esc(it?.n || '')}</b> (free): ${ch ? ch.why && ch.why !== '-' ? `<b class="hxwhy bad">✗ ${esc(ch.why)}</b>` : '<b class="hxwhy ok">✓ Fits</b>' : 'move the mouse over the island'} <span class="muted small-text">· R or scroll turns it</span></span>
    <button class="btn small" data-hx="rot" title="Turn (R or scroll)">⟳ Turn</button><button class="btn small ghost" data-hx="cancel" title="Esc or right-click">✖ Cancel</button></div>`;
}
// mouse wheel turns whatever you're holding (Ctrl + wheel still zooms)
function hxWheel(e) {
  const P = ui.hxP; if (!P || e.ctrlKey || (IS3.house !== 'hex' && IS3.house !== 'hexh')) return false;
  if (!(P.mode === 'new' || P.mode === 'move' || P.mode === 'deco' || (P.id === 'tf' && tfKind(P.brush) === 'deco'))) return false;
  const now = performance.now(); HX3.wAcc = (now - (HX3.wT || 0) > 250 ? 0 : HX3.wAcc || 0) + e.deltaY; HX3.wT = now;
  if (Math.abs(HX3.wAcc) >= 40) { P.rot = ((P.rot || 0) + (HX3.wAcc > 0 ? 1 : 5)) % 6; HX3.wAcc = 0; if (typeof sfx === 'function') sfx('click', { gap: 40 }); hxHover(HX3.hover, true); }
  return true;
}

// ---------- the brush bar ----------
const tfCatOf = id => tfBrush(id)?.c || 'ground';
const tfCatItems = cat => [...Object.entries(HX_TF.brush), ...Object.entries(HX_TF.deco), ...Object.entries(HX_TF.edge)].filter(([, v]) => v.c === cat);
function tfBar(P) {
  const id = P.brush || 'grass', cat = ui.tfCat || tfCatOf(id);
  const btn = ([k, v]) => `<button class="tfb ${k === id ? 'on' : ''}" data-hx="tfb" data-v="${k}" title="${esc(v.n)}${v.d ? ': ' + esc(v.d) : ''}"><span>${v.e}</span>${esc(v.n)}<i>${tfCostTxt(v.l, v.x)}</i></button>`;
  return `<div class="ishud is-bc isplace hxbar tfbar">
    <div class="tfcats">${HX_TF.cats.map(([k, e, n]) => `<button class="${k === cat && id !== 'erase' ? 'on' : ''}" data-hx="tfcat" data-v="${k}">${e} ${n}</button>`).join('')}<button class="tfer ${id === 'erase' ? 'on' : ''}" data-hx="tfb" data-v="erase" title="${TF_ERASE.d}">🧽 Remove</button></div>
    <div class="tfitems">${tfCatItems(cat).map(btn).join('')}</div>
    <div class="tfrow"><span id="tfhint">${tfHint(P)}</span>
    ${tfPvBar()}<button class="btn small" data-hx="tfundo" ${ui.tfHist?.length ? '' : 'disabled'} title="Undo the last stroke and get its cost back (Ctrl+Z)">↶ Undo</button><button class="btn small ghost" data-hx="tfreset" title="Put the ground and heights back as they started">⟲ Reset terrain</button><button class="btn small primary" data-hx="cancel">✔ Done</button></div></div>`;
}
function tfHint(P) {
  const id = P.brush || 'grass', b = tfBrush(id) || TF_ERASE, kind = tfKind(id);
  const how = kind === 'erase' ? 'Drag over decorations, plants and fences (point near an edge for a fence) to take them away.'
    : kind === 'edge' ? 'Point at the edge between two hexes and drag along edges.'
      : kind === 'deco' ? 'Click to place, drag for a row. <b>R</b> or scroll turns it.'
        : b.ps ? 'Drag a line: it joins up with roads, paths and buildings.' : 'Click or drag over the island.';
  const stroke = P.sn ? ` <b class="tfstroke">${P.sn} done · ${tfCostTxt(P.sl, P.sx)}${ui.tfPv ? ' to keep' : ''}</b>` : '';
  return `${kind === 'erase' ? '' : `<b>${b.e} ${esc(b.n)}</b> · ${tfCostTxt(b.l, b.x)}${b.l || b.x ? (kind === 'edge' ? ' an edge' : ' a hex') : ''}. `}${how}${stroke} ${P.why ? `<b class="hxwhy bad">${esc(P.why)}</b>` : ''}`;
}
function tfPvBar() {
  const st = hxState(), n = st.tfPv?.length || 0, [l, x] = tfPvCost(st);
  if (!ui.tfPv) return '<button class="btn small" data-hx="tfpv" title="Try things on your island for free and only pay when you keep them">👁 Preview (free)</button>';
  return `<span class="tag">👁 Preview: free to try${n ? ` · ${n} hex${n === 1 ? '' : 'es'} · ${tfCostTxt(l, x)}` : ''}</span><button class="btn small primary" data-hx="tfkeep" ${n ? '' : 'disabled'}>✔ Keep${n ? ' · ' + tfCostTxt(l, x) : ''}</button><button class="btn small ghost" data-hx="tfdiscard">✖ ${n ? 'Discard' : 'Stop preview'}</button>`;
}
// a small chip by the mouse: what this hex would cost, why not, or the running total of a stroke
function tfChip(html, cls) {
  const f = document.getElementById('isfull'); let c = document.getElementById('tfchip');
  if (!html || !f || !HX3.cxy) { if (c) c.remove(); return; }
  if (!c) { c = document.createElement('div'); c.id = 'tfchip'; f.appendChild(c); }
  c.className = cls || ''; if (c.innerHTML !== html) c.innerHTML = html; tfChipMove();
}
function tfChipMove() {
  const c = document.getElementById('tfchip'), f = document.getElementById('isfull'); if (!c || !f || !HX3.cxy) return;
  const r = f.getBoundingClientRect(); c.style.transform = `translate(${HX3.cxy[0] - r.left + 16}px, ${HX3.cxy[1] - r.top + 16}px)`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-hx="tfb"],[data-hx="tfcat"],[data-hx="tfundo"],[data-hx="tfreset"],[data-hx="tfpv"],[data-hx="tfkeep"],[data-hx="tfdiscard"],[data-hx="decopv"],[data-hx="tfturn"],[data-hx="tfmove"]'); if (!el) return;
  const a = el.dataset.hx;
  if (a === 'tfb' && ui.hxP?.id === 'tf') { ui.hxP.brush = ui.tfBrush = el.dataset.v; if (el.dataset.v !== 'erase') ui.tfCat = tfCatOf(el.dataset.v); ui.hxP.why = ''; if (typeof sfx === 'function') sfx('select'); render(); if (HX3.hover) hxHover(HX3.hover, true); }
  else if (a === 'tfcat' && ui.hxP?.id === 'tf') { ui.tfCat = el.dataset.v; const first = tfCatItems(ui.tfCat)[0]; if (first) ui.hxP.brush = ui.tfBrush = first[0]; ui.hxP.why = ''; if (typeof sfx === 'function') sfx('select'); render(); }
  else if (a === 'tfundo') tfUndo();
  else if (a === 'tfreset') tfReset();
  else if (a === 'tfpv') { ui.tfPv = true; render(); }
  else if (a === 'tfkeep') tfPvKeep();
  else if (a === 'tfdiscard') { tfPvDiscard(); ui.tfPv = false; render(); }
  else if (a === 'decopv') { ui.tfPv = true; Object.assign(ui, { isPanel: null }); if (!HX_TF.deco[ui.tfBrush]) { ui.tfBrush = 'flowers'; ui.tfCat = 'plants'; } hxStartPlace({ id: 'tf', mode: 'tool', n: 0, brush: ui.tfBrush }); }
  else if (a === 'tfturn') tfTurn(el.dataset.k);
  else if (a === 'tfmove') { const v = hxState().tf?.[el.dataset.k]; if (v?.d) hxStartPlace({ id: 'tfmv', mode: 'deco', d: v.d, from: el.dataset.k, rot: v.r || 0 }); }
});

// ---------- 3D ----------
let TF_GH = false; // true while a ghost is being made: no animations or night lights for it
const tfAnim = a => { if (!TF_GH) HX3.anim.push(a); };
// the painted ground on one hex (called from hxBuild); returns true when it drew the tile itself
function tfGround(k, st, add, W) {
  const tf = st.tf?.[k]; if (!tf) return false;
  const ht = hxHt(k, st), [x, z] = hxPos(...hxQR(k));
  if (ht > 0) {
    const c = is3mesh(new THREE.CylinderGeometry(1.15, 1.15, ht + .5, 6), tf.c ? '#a39e95' : '#8d7b62', x, (ht - .5) / 2 - .03, z, W); c.rotation.y = Math.PI / 6; c.castShadow = false;
    if (tf.c) { const r = seeded('tf-cliff' + k); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6 + (r() - .5) * .5, s = .22 + r() * .14; const b = is3mesh(new THREE.DodecahedronGeometry(s, 0), ['#9c968c', '#b3ada2', '#8f8a81'][i % 3], x + Math.cos(a) * 1.05, ht * (.25 + r() * .5), z + Math.sin(a) * 1.05, W); b.rotation.set(r() * 3, r() * 3, 0); b.castShadow = false; } }
  }
  const h = hxW(st).land().get(k);
  if (tf.t === 'water') { add('hex_water', k); if (h.v > .6 && !tf.d) add('waterlily_A', k, Math.floor(h.v * 6), -.2); return true; }
  if (!tf.t) return false;
  add('hex_grass', k, Math.floor(h.v * 6));
  if (tf.t === 'sand') { const c = is3mesh(new THREE.CylinderGeometry(1.12, 1.14, .04, 6), '#ead39b', x, ht + .02, z, W); c.rotation.y = Math.PI / 6; c.castShadow = false; }
  else if (tf.t === 'forest') add(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6);
  else if (tf.t === 'hill') add(['hills_A', 'hills_B_trees', 'hills_C', 'hill_single_A'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6);
  // (paths are drawn all together by tfPaths)
  return true;
}
// which of a path hex's edges it joins: paths, roads, buildings, and a footbridge's ends
function tfJoins(k, st) {
  let m = 0;
  hxNb(k).forEach((n, i) => {
    const v = st.tf?.[n]; let j = v?.t === 'path' || st.road.includes(n) || !!hxFreeAt(n, st);
    if (!j) { const mk = st.__occ?.[n] || (st.b[n] && n), s = mk && st.b[mk], it = s && hxW(st).item(s.id); j = !!(it && !it.wall && !it.field); }
    if (!j && v?.d === 'bridge') j = i % 3 === (v.r || 0) % 3;
    if (j) m |= 1 << i;
  });
  return m;
}
// is a point (from the middle of a path hex) on the path? (keeps grass tufts off it)
function tfPathHit(m, dx, dz, hw) {
  if (Math.hypot(dx, dz) < hw * (m ? 1 : 1.7)) return true;
  for (let i = 0; i < 6; i++) if (m & 1 << i) { const a = i * Math.PI / 3, t = dx * Math.cos(a) + dz * Math.sin(a), q = -dx * Math.sin(a) + dz * Math.cos(a); if (t > 0 && t < 1.05 && Math.abs(q) < hw) return true; }
  return false;
}
const tfMat = (col, o = {}) => { const k = col + JSON.stringify(o); return (HX3.tfMats = HX3.tfMats || {})[k] || (HX3.tfMats[k] = new THREE.MeshStandardMaterial({ color: col, roughness: .95, ...o })); };
// every path on the island, as thin roads (instanced: a few draw calls whatever the size)
function tfPaths(W, st) {
  const by = { dirt: [], stone: [], board: [] };
  for (const [k, v] of Object.entries(st.tf || {})) if (v.t === 'path') { const [x, z] = hxPos(...hxQR(k)); (by[v.ps] || by.dirt).push({ x, z, y: hxHt(k, st), m: tfJoins(k, st), k }); }
  const o = new THREE.Object3D(), col = new THREE.Color();
  const inst = (geo, c, list, set, cols) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, tfMat(cols ? '#ffffff' : c), list.length);
    list.forEach((p, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); set(o, p, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (cols) im.setColorAt(i, col.set(cols[i % cols.length])); });
    im.receiveShadow = true; im.castShadow = false; W.add(im);
  };
  for (const [ps, list] of Object.entries(by)) {
    if (!list.length) continue;
    const S = TF_PS[ps], strips = [], hubs = [], r = seeded('tf-path-' + ps);
    for (const p of list) { let n = 0; for (let i = 0; i < 6; i++) if (p.m & 1 << i) { strips.push({ ...p, i }); n++; } hubs.push({ ...p, s: n ? 1 : 1.7 }); }
    const sGeo = w => new THREE.BoxGeometry(1, .02, w).translate(.5, 0, 0), hGeo = rr => new THREE.CylinderGeometry(rr, rr, .02, 18);
    const putS = dy => (o2, p) => { o2.position.set(p.x, p.y + dy, p.z); o2.rotation.y = -p.i * Math.PI / 3; };
    const putH = dy => (o2, p) => { o2.position.set(p.x, p.y + dy, p.z); o2.scale.set(p.s, 1, p.s); };
    inst(sGeo(S.w + .2), S.rim, strips, putS(.01)); inst(hGeo(S.w / 2 + .1), S.rim, hubs, putH(.01));
    inst(sGeo(S.w), S.top, strips, putS(.022)); inst(hGeo(S.w / 2), S.top, hubs, putH(.022));
    // little bits laid along each strip: cobbles or planks
    const along = (p, t, q) => { const a = p.i * Math.PI / 3; return [p.x + Math.cos(a) * t - Math.sin(a) * q, p.z + Math.sin(a) * t + Math.cos(a) * q]; };
    if (ps === 'stone') {
      const cob = [];
      for (const p of strips) for (let t = .1; t < 1; t += .16) for (const q of [-.19, 0, .19]) { const [x, z] = along(p, t + (r() - .5) * .05, q + (r() - .5) * .05); cob.push({ x, z, y: p.y, v: r() }); }
      for (const p of hubs) for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28, d = j ? .17 * p.s : 0; cob.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, y: p.y, v: r() }); }
      inst(HX3.cobGeo || (HX3.cobGeo = new THREE.CylinderGeometry(.075, .085, .05, 6)), '', cob, (o2, p) => { o2.position.set(p.x, p.y + .035, p.z); o2.rotation.y = p.v * 3; o2.scale.set(.85 + p.v * .3, 1, .85 + p.v * .3); }, ['#c9c3b6', '#b7b1a5', '#d8d2c6', '#a9a397', '#c2bcae']);
    } else if (ps === 'board') {
      const pl = [];
      for (const p of strips) for (let t = .07; t < 1; t += .14) { const [x, z] = along(p, t, 0); pl.push({ x, z, y: p.y, i: p.i, v: r() }); }
      for (const p of hubs) for (const t of [-.14, 0, .14]) { const i = [0, 1, 2, 3, 4, 5].find(j => p.m & 1 << j) ?? 0, a = i * Math.PI / 3; pl.push({ x: p.x + Math.cos(a) * t, z: p.z + Math.sin(a) * t, y: p.y, i, v: r() }); }
      inst(HX3.plankGeo || (HX3.plankGeo = new THREE.BoxGeometry(.12, .045, S.w + .1)), '', pl, (o2, p) => { o2.position.set(p.x, p.y + .055, p.z); o2.rotation.y = -p.i * Math.PI / 3 + (p.v - .5) * .06; }, ['#a8763f', '#b9864c', '#9a6a37', '#c08f57']);
    }
  }
}
// a decoration's model (shared by the ghost and the island)
function tfWaterMat() { return HX3.waterMat || (HX3.waterMat = new THREE.MeshStandardMaterial({ color: '#5ec3ef', emissive: '#1c6d99', emissiveIntensity: .35, roughness: .2, transparent: true, opacity: .85 })); }
function tfModel(id, col) {
  const g = new THREE.Group(), m = (geo, c, x, y, z, glow) => is3mesh(geo, c, x, y, z, g, glow), stone = '#d6cfc0', wood = '#a0703f', dark = '#6b4a2e', hc = TF_KCOL[col] || '#4dabf7';
  const two = (geo, c, x, y, z) => { const me = m(geo, c, x, y, z); me.material = me.material.clone(); me.material.side = THREE.DoubleSide; return me; };
  const r = seeded('tf-' + id);
  if (id === 'fountain') {
    m(new THREE.CylinderGeometry(.85, .95, .32, 10), stone, 0, .16, 0);
    const wm = tfWaterMat();
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, .05, 10), wm); w1.position.y = .3; g.add(w1);
    m(new THREE.CylinderGeometry(.11, .16, .62, 8), stone, 0, .6, 0);
    m(new THREE.CylinderGeometry(.38, .17, .14, 10), stone, 0, .92, 0);
    const w2 = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .03, 10), wm); w2.position.y = .98; g.add(w2);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(.07, .34, 6), wm); jet.position.y = 1.15; g.add(jet); tfAnim({ o: jet, flick: Math.random() * 6 });
  } else if (id === 'statue') {
    m(new THREE.BoxGeometry(.7, .36, .7), '#bdb6a8', 0, .18, 0); m(new THREE.BoxGeometry(.52, .12, .52), stone, 0, .42, 0);
    m(new THREE.CylinderGeometry(.12, .19, .56, 7), stone, 0, .76, 0); m(new THREE.SphereGeometry(.12, 8, 6), stone, 0, 1.15, 0);
    const arm = m(new THREE.BoxGeometry(.06, .42, .06), stone, .17, 1.1, 0); arm.rotation.z = -.35;
    m(new THREE.BoxGeometry(.03, .5, .03), '#e9c46a', .26, 1.45, 0);
  } else if (id === 'lamp') {
    m(new THREE.CylinderGeometry(.12, .15, .1, 6), '#3b3b45', 0, .05, 0); m(new THREE.CylinderGeometry(.035, .045, 1.3, 6), '#3b3b45', 0, .7, 0);
    m(new THREE.BoxGeometry(.2, .22, .2), '#2f2f38', 0, 1.42, 0);
    const lm = HX3.lampMat || (HX3.lampMat = new THREE.MeshStandardMaterial({ color: '#ffe8a3', emissive: '#ffb347', emissiveIntensity: .25, flatShading: true }));
    const li = new THREE.Mesh(new THREE.BoxGeometry(.15, .17, .15), lm); li.position.y = 1.42; g.add(li);
    const cap = m(new THREE.ConeGeometry(.17, .14, 4), '#2f2f38', 0, 1.6, 0); cap.rotation.y = Math.PI / 4;
    if (!TF_GH) (HX3.lights = HX3.lights || []).push(li);
  } else if (id === 'bench') {
    m(new THREE.BoxGeometry(.9, .06, .3), wood, 0, .32, 0); m(new THREE.BoxGeometry(.9, .2, .05), wood, 0, .5, -.14);
    for (const [lx, lz] of [[-.38, -.1], [.38, -.1], [-.38, .1], [.38, .1]]) m(new THREE.BoxGeometry(.06, .3, .06), '#5c3d24', lx, .15, lz);
  } else if (id === 'flowers') {
    const cs = ['#ffec99', '#ffa8c5', '#ffffff', '#d0bfff', '#ff8787', '#ffc078'];
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * .55, x = Math.cos(a) * d, z = Math.sin(a) * d; m(new THREE.CylinderGeometry(.012, .016, .2, 4), '#4b9a37', x, .1, z); m(new THREE.IcosahedronGeometry(.07, 0), cs[i % cs.length], x, .22, z); }
  } else if (id === 'bush') {
    for (const [x, z, s] of [[0, 0, .34], [.25, .12, .24], [-.22, .14, .26], [.05, -.24, .22]]) { const b = m(new THREE.IcosahedronGeometry(s, 1), ['#4f9e3c', '#5cae46', '#468f35'][Math.floor(r() * 3)], x, s * .72, z); b.scale.y = .85; }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28; m(new THREE.SphereGeometry(.035, 6, 4), '#e03131', Math.cos(a) * .3, .3 + r() * .2, Math.sin(a) * .3); }
  } else if (id === 'bed') {
    m(new THREE.BoxGeometry(1.06, .12, .66), '#6b4f3a', 0, .06, 0);
    for (const s of [1, -1]) { m(new THREE.BoxGeometry(1.18, .17, .07), wood, 0, .085, .36 * s); m(new THREE.BoxGeometry(.07, .17, .66), wood, .56 * s, .085, 0); }
    const cs = ['#ff8fab', '#ffd43b', '#b197fc', '#ff922b'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const x = -.42 + i * .17, z = -.18 + row * .18; m(new THREE.CylinderGeometry(.01, .014, .16, 4), '#4b9a37', x, .2, z); m(new THREE.IcosahedronGeometry(.06, 0), cs[row % cs.length], x, .3, z); m(new THREE.IcosahedronGeometry(.045, 0), '#5cae46', x + .05, .15, z); }
  } else if (id === 'plot') {
    m(new THREE.BoxGeometry(1.2, .06, 1), '#7a5638', 0, .03, 0);
    for (const z of [-.32, 0, .32]) {
      m(new THREE.BoxGeometry(1.1, .1, .2), '#8a6444', 0, .08, z);
      for (let i = 0; i < 5; i++) {
        const x = -.42 + i * .21, kind = (Math.round(z * 10) + i) % 3;
        if (kind === 0) m(new THREE.IcosahedronGeometry(.1, 1), '#7bc35a', x, .2, z);
        else if (kind === 1) { m(new THREE.ConeGeometry(.04, .14, 5), '#ff922b', x, .13, z).rotation.x = Math.PI; for (const a of [-.4, 0, .4]) { const l = m(new THREE.ConeGeometry(.025, .2, 4), '#4b9a37', x + a * .05, .27, z); l.rotation.z = a; } }
        else { m(new THREE.SphereGeometry(.08, 8, 6), '#e03131', x, .17, z); m(new THREE.ConeGeometry(.05, .1, 5), '#2b8a3e', x, .27, z); }
      }
    }
  } else if (id === 'banner') {
    m(new THREE.CylinderGeometry(.035, .045, 1.9, 6), dark, 0, .95, 0); m(new THREE.BoxGeometry(.72, .05, .05), dark, 0, 1.8, 0);
    const cl = two(new THREE.PlaneGeometry(.6, 1), hc, 0, 1.28, .04); m(new THREE.BoxGeometry(.6, .07, .02), '#e9c46a', 0, .79, .05);
    m(new THREE.SphereGeometry(.07, 8, 6), '#e9c46a', 0, 1.95, 0); tfAnim({ o: cl, fn: t => { cl.rotation.x = Math.sin(t * 1.8) * .08; } });
  } else if (id === 'campfire') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; m(new THREE.DodecahedronGeometry(.09, 0), ['#9c968c', '#b3ada2'][i % 2], Math.cos(a) * .34, .05, Math.sin(a) * .34); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .3, lg = m(new THREE.CylinderGeometry(.045, .05, .5, 6), '#7a4a2a', Math.cos(a) * .1, .15, Math.sin(a) * .1); lg.rotation.set(0, -a, 1.05); lg.rotation.order = 'YXZ'; }
    const f1 = m(new THREE.ConeGeometry(.17, .46, 6), '#ff922b', 0, .32, 0, true), f2 = m(new THREE.ConeGeometry(.09, .32, 6), '#ffe066', 0, .3, 0, true);
    tfAnim({ o: f1, flick: r() * 6 }); tfAnim({ o: f2, flick: r() * 6 + 2 });
  } else if (id === 'stall') {
    m(new THREE.BoxGeometry(1.1, .45, .42), wood, 0, .225, .16); m(new THREE.BoxGeometry(1.2, .05, .52), '#c9a06a', 0, .47, .16);
    for (const sx of [-1, 1]) { m(new THREE.CylinderGeometry(.03, .03, 1.25, 6), dark, .56 * sx, .62, -.24); m(new THREE.CylinderGeometry(.03, .03, 1, 6), dark, .56 * sx, .5, .4); }
    for (let i = 0; i < 6; i++) { const s = m(new THREE.BoxGeometry(.205, .03, .85), i % 2 ? '#fff8e7' : hc, -.52 + i * .205, 1.12, .1); s.rotation.x = .28; }
    for (let i = 0; i < 9; i++) m(new THREE.SphereGeometry(.06, 8, 6), ['#e03131', '#ff922b', '#82c91e'][Math.floor(i / 3)], -.38 + (i % 3) * .1 + Math.floor(i / 3) * .3, .54, .12 + (i % 2) * .08);
    m(new THREE.BoxGeometry(.3, .26, .3), '#8a5a32', .74, .13, .35);
  } else if (id === 'well') {
    m(new THREE.CylinderGeometry(.42, .46, .42, 10), stone, 0, .21, 0); m(new THREE.CylinderGeometry(.47, .47, .06, 10), '#bdb6a8', 0, .44, 0);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .02, 10), tfWaterMat()); w.position.y = .38; g.add(w);
    for (const sx of [-1, 1]) m(new THREE.BoxGeometry(.07, .85, .07), dark, .42 * sx, .85, 0);
    const roof = m(new THREE.ConeGeometry(.66, .4, 4), '#c0504d', 0, 1.42, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, .8);
    m(new THREE.CylinderGeometry(.025, .025, .9, 6), '#5c3d24', 0, 1.05, 0).rotation.z = Math.PI / 2;
    m(new THREE.CylinderGeometry(.006, .006, .25, 4), '#d8c8a8', 0, .92, 0); m(new THREE.CylinderGeometry(.08, .06, .12, 8), '#8a5a32', 0, .76, 0);
  } else if (id === 'windmill') {
    m(new THREE.CylinderGeometry(.3, .45, 1.4, 8), '#efe6d4', 0, .7, 0); m(new THREE.CylinderGeometry(.33, .33, .06, 8), '#c9a06a', 0, 1.1, 0);
    m(new THREE.ConeGeometry(.42, .5, 8), '#c0504d', 0, 1.65, 0); m(new THREE.BoxGeometry(.2, .32, .04), dark, 0, .16, .44);
    const hub = new THREE.Group(); hub.position.set(0, 1.25, .36); g.add(hub);
    is3mesh(new THREE.CylinderGeometry(.06, .06, .1, 8), dark, 0, 0, 0, hub).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm); is3mesh(new THREE.BoxGeometry(.04, .75, .02), wood, 0, .4, 0, arm); is3mesh(new THREE.BoxGeometry(.16, .55, .01), '#fff8e7', .09, .45, .01, arm); }
    tfAnim({ o: hub, ax: 'z', sp: 1.1 });
  } else if (id === 'gazebo') {
    const fl = m(new THREE.CylinderGeometry(.95, 1, .14, 6), '#d9c9a8', 0, .07, 0); fl.rotation.y = Math.PI / 6;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m(new THREE.CylinderGeometry(.045, .05, 1.1, 6), '#f4efe6', Math.cos(a) * .8, .69, Math.sin(a) * .8); if (i % 3) m(new THREE.BoxGeometry(.05, .05, .8), '#f4efe6', Math.cos(a + Math.PI / 6) * .7, .45, Math.sin(a + Math.PI / 6) * .7).rotation.y = -a - Math.PI / 6; }
    const rf = m(new THREE.ConeGeometry(1.18, .62, 6), hc, 0, 1.55, 0); rf.rotation.y = Math.PI / 6;
    m(new THREE.CylinderGeometry(1.0, 1.0, .08, 6), '#f4efe6', 0, 1.24, 0).rotation.y = Math.PI / 6;
    m(new THREE.SphereGeometry(.08, 8, 6), '#e9c46a', 0, 1.92, 0);
  } else if (id === 'arch') {
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const b = m(new THREE.DodecahedronGeometry(.27 - i * .02, 0), ['#a8a29a', '#bab4aa', '#9c968c'][(i + (sx > 0)) % 3], .62 * sx + (r() - .5) * .06, .22 + i * .3, (r() - .5) * .06); b.rotation.set(r() * 3, r() * 3, 0); }
    m(new THREE.TorusGeometry(.62, .2, 6, 12, Math.PI), '#aea89e', 0, .86, 0);
    for (let i = 0; i < 5; i++) { const a = .3 + i / 4 * (Math.PI - .6); m(new THREE.IcosahedronGeometry(.09 + r() * .05, 0), '#6aa84f', Math.cos(a) * .62, .86 + Math.sin(a) * .62 + .14, (r() - .5) * .15); }
  } else if (id === 'lily') {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .04, 18), tfWaterMat()); w.position.y = .03; g.add(w);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; m(new THREE.DodecahedronGeometry(.08 + r() * .04, 0), ['#b5b0a8', '#c9c4bb', '#a9a49c'][i % 3], Math.cos(a) * .78, .04, Math.sin(a) * .78); }
    for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = .2 + r() * .3, p = m(new THREE.CylinderGeometry(.13, .13, .015, 10), '#5cae46', Math.cos(a) * d, .06, Math.sin(a) * d); if (i === 1) m(new THREE.IcosahedronGeometry(.06, 0), '#ffa8c5', p.position.x, .1, p.position.z); }
    for (let i = 0; i < 5; i++) { const a = 2.5 + i * .18; m(new THREE.CylinderGeometry(.012, .02, .45, 4), '#6a9a3a', Math.cos(a) * .7, .22, Math.sin(a) * .7); }
  } else if (id === 'bridge') { // spans local x from -1 to 1 (r picks which pair of edges)
    const arc = x => .2 + .26 * Math.cos(x * Math.PI / 2), slope = x => -.26 * Math.PI / 2 * Math.sin(x * Math.PI / 2);
    for (let x = -1; x <= 1.001; x += .14) { const p = m(new THREE.BoxGeometry(.13, .05, .52), ['#a8763f', '#b9864c', '#9a6a37'][Math.round(x * 7 + 7) % 3], x, arc(x), 0); p.rotation.z = Math.atan(slope(x)); }
    for (const sz of [-1, 1]) {
      for (const x of [-.85, -.3, .3, .85]) m(new THREE.CylinderGeometry(.025, .025, .3, 5), dark, x, arc(x) + .15, .27 * sz);
      for (let x = -.85; x < .85; x += .275) { const xm = x + .1375, rl = m(new THREE.BoxGeometry(.29, .03, .03), wood, xm, arc(xm) + .3, .27 * sz); rl.rotation.z = Math.atan(slope(xm)); }
    }
    for (const x of [-.6, .6]) m(new THREE.CylinderGeometry(.05, .05, .5, 6), dark, x, arc(x) - .25, 0);
  } else if (id === 'boat') {
    const inner = new THREE.Group(), lift = new THREE.Group(); lift.position.y = .13; lift.add(inner); g.add(lift);
    const hull = is3mesh(new THREE.SphereGeometry(.5, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#8a5a32', 0, .02, 0, inner); hull.scale.set(1, .36, .42); hull.material = hull.material.clone(); hull.material.side = THREE.DoubleSide;
    is3mesh(new THREE.CylinderGeometry(.48, .48, .02, 12), '#5b3a20', 0, -.03, 0, inner).scale.set(1, 1, .4);
    is3mesh(new THREE.TorusGeometry(.49, .025, 4, 16), '#c9a06a', 0, .02, 0, inner).scale.set(1, .42, 1);
    inner.children[2].rotation.x = Math.PI / 2;
    is3mesh(new THREE.BoxGeometry(.06, .03, .38), '#c9a06a', 0, .0, 0, inner);
    for (const sz of [-1, 1]) { const oar = is3mesh(new THREE.CylinderGeometry(.015, .015, .95, 5), '#c9a06a', 0, .05, .14 * sz, inner); oar.rotation.set(0, sz * .25, Math.PI / 2 - .12); }
    const ph = r() * 6; tfAnim({ fn: t => { inner.rotation.z = Math.sin(t * 1.3 + ph) * .05; inner.rotation.x = Math.sin(t * .9 + ph) * .03; inner.position.y = Math.sin(t * 1.1 + ph) * .025; } });
  }
  else if (id === 'tree') g.add(hxModel('tree_single_A', col));
  else if (id === 'rock') { const rk = hxModel('rock_single_C', col); rk.scale.setScalar(1.8); g.add(rk); }
  else if (id === 'flag') { const f = hxModel('flag_' + col, col); f.scale.setScalar(2.6); g.add(f); }
  else if (id === 'barrels') { const a = hxModel('barrel', col), b = hxModel('barrel', col), c = hxModel('crate_A_small', col); a.position.set(-.3, 0, .1); b.position.set(.15, 0, -.2); c.position.set(.3, 0, .35); g.add(a, b, c); }
  else if (id === 'cart') g.add(hxModel('wheelbarrow', col));
  else if (id === 'tent') g.add(hxModel('tent', col));
  return g;
}
// an edge piece, along local x (an edge is 1.155 long), sitting on y = 0
function tfEdgeModel(id) {
  const g = new THREE.Group(), m = (geo, c, x, y, z) => is3mesh(geo, c, x, y, z, g), r = seeded('tf-e-' + id);
  if (id === 'fence') {
    for (const x of [-.55, 0, .55]) m(new THREE.BoxGeometry(.08, .44, .08), '#7a5230', x, .22, 0);
    for (const y of [.17, .33]) m(new THREE.BoxGeometry(1.16, .05, .04), '#a0703f', 0, y, 0);
  } else if (id === 'picket') {
    m(new THREE.BoxGeometry(1.16, .045, .03), '#ece6da', 0, .22, -.02);
    for (let i = 0; i < 8; i++) { const x = -.52 + i * .149; m(new THREE.BoxGeometry(.07, .34, .025), '#f8f4ec', x, .17, 0); const tip = m(new THREE.ConeGeometry(.05, .07, 4), '#f8f4ec', x, .375, 0); tip.rotation.y = Math.PI / 4; tip.scale.z = .35; }
  } else if (id === 'hedge') {
    const b = m(new THREE.BoxGeometry(1.12, .36, .3), '#3f8f3a', 0, .18, 0); b.castShadow = true;
    for (let i = 0; i < 5; i++) m(new THREE.IcosahedronGeometry(.15 + r() * .04, 1), ['#4ea545', '#469c3e', '#58b04e'][i % 3], -.45 + i * .225, .36, (r() - .5) * .06);
  } else if (id === 'lowwall') {
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4 + row; i++) { const w = row ? .24 : .29, x = -.58 + (row ? .12 : .145) + i * (row ? .233 : .29); if (x > .58) continue; const s = m(new THREE.BoxGeometry(w - .02, .14, .24), ['#b5aea2', '#a39d92', '#c4bdb0'][Math.floor(r() * 3)], x, .07 + row * .14, (r() - .5) * .03); s.rotation.y = (r() - .5) * .08; }
  }
  return g;
}
// where a decoration's piece(s) stand on its hex: [dx, dz, turn]. Side pieces on a path go to the corner r picks, facing the path.
function tfSpots(k, v, st) {
  const it = HX_TF.deco[v.d], r = v.r || 0, onPath = st.tf?.[k]?.t === 'path';
  const corner = i => { const a = ((i % 6) * 60 + 30) * Math.PI / 180; return [Math.cos(a) * .74, Math.sin(a) * .74, Math.atan2(-Math.cos(a), -Math.sin(a))]; };
  if (v.d === 'lamps') {
    if (onPath) return [corner(r), corner(r + 3)];
    const a = r * Math.PI / 3 + Math.PI / 2; return [[Math.cos(a) * .55, Math.sin(a) * .55, -r * Math.PI / 3], [-Math.cos(a) * .55, -Math.sin(a) * .55, -r * Math.PI / 3]];
  }
  if (onPath && it?.side) return [corner(r)];
  return [[0, 0, -r * Math.PI / 3]];
}
// how high a decoration sits: water pieces float on the pond or the sea
function tfDecoY(k, v, st) {
  const it = HX_TF.deco[v.d], y = hxHt(k, st);
  if (it?.wat) return hxW(st).land().get(k)?.t === 'water' ? -.2 : y - .2;
  return y + (v.t === 'sand' ? .04 : 0);
}
// night lights for lamps and campfires: [x, y, z, size] (hxsky.js draws them)
function tfGlows(st) {
  const out = [];
  for (const [k, v] of Object.entries(st.tf || {})) {
    if (!HX_TF.deco[v.d]?.glow) continue;
    const [x, z] = hxPos(...hxQR(k)), y = tfDecoY(k, v, st);
    for (const [dx, dz] of tfSpots(k, v, st)) out.push(v.d === 'campfire' ? [x + dx, y + .35, z + dz, 2] : [x + dx, y + 1.42, z + dz, 1.6]);
  }
  return out;
}
// every decoration, fence and path on the island (called from hxBuild)
function tfDecos(W, st, col) {
  HX3.lights = [];
  const mv = ui.hxP?.mode === 'deco' ? ui.hxP.from : null; // the one being moved is drawn as the ghost
  for (const [k, v] of Object.entries(st.tf || {})) {
    const [x, z] = hxPos(...hxQR(k)), y = hxHt(k, st);
    if (v.e) for (const [i, id] of Object.entries(v.e)) {
      if (!HX_TF.edge[id]) continue;
      const a = +i * Math.PI / 3, n = hxNb(k)[+i], g = tfEdgeModel(id);
      g.position.set(x + Math.cos(a), Math.max(y, hxHt(n, st)), z + Math.sin(a)); g.rotation.y = -(a + Math.PI / 2); W.add(g);
    }
    if (!v.d || !HX_TF.deco[v.d] || k === mv) continue;
    const dy = tfDecoY(k, v, st);
    for (const [dx, dz, ry] of tfSpots(k, v, st)) { const g = tfModel(v.d === 'lamps' ? 'lamp' : v.d, col); g.position.set(x + dx, dy, z + dz); g.rotation.y = ry; W.add(g); }
    IS3.marks[k] = [x, y + 1.2, z];
  }
  tfPaths(W, st);
}
// a see-through copy: keeps its own colours, green-tinted when it fits, red when it doesn't
function tfGhostify(o, ok) {
  const red = new THREE.Color('#ff4d4d');
  o.traverse(c => {
    if (!c.isMesh) return; c.castShadow = false;
    const m = c.material.clone(); m.transparent = true; m.opacity = ok ? .62 : .5; m.depthWrite = false;
    if (!ok && m.color) m.color.lerp(red, .65);
    if (m.emissive) { m.emissive.set(ok ? '#2f9e44' : '#c92a2a'); m.emissiveIntensity = ok ? .22 : .45; }
    c.material = m;
  });
  return o;
}
// the ghost while terraforming or moving a decoration (called from hxGhostDraw; g sits on hex k)
function tfGhost(g, k) {
  const P = ui.hxP, st = hxState(), col = hxCol(), [x0, z0] = hxPos(...hxQR(k));
  const ring = (kk, c, y = .06) => { const [xx, zz] = hxPos(...hxQR(kk)), rg = new THREE.Mesh(HX3.tfRing || (HX3.tfRing = new THREE.RingGeometry(1.5, 1.72, 6)), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .9, depthWrite: false })); rg.rotation.set(-Math.PI / 2, 0, Math.PI / 6); rg.position.set(xx - x0, y + hxHt(kk, st), zz - z0); g.add(rg); };
  const fill = (c, y, o = .45) => { const f = new THREE.Mesh(HX3.tfFill || (HX3.tfFill = new THREE.CircleGeometry(1.12, 6)), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); f.rotation.set(-Math.PI / 2, 0, Math.PI / 6); f.position.y = y; g.add(f); };
  const deco = (id, v, ok) => { TF_GH = true; try { const y = tfDecoY(k, v, { ...st, tf: { ...st.tf, [k]: v } }); for (const [dx, dz, ry] of tfSpots(k, v, st)) { const md = tfGhostify(tfModel(id === 'lamps' ? 'lamp' : id, col), ok); md.position.set(dx, y + .02, dz); md.rotation.y = ry; g.add(md); } } finally { TF_GH = false; } };
  let pl, chip = '';
  if (P.mode === 'deco') {
    pl = tfMovePlan(P, k, st); const ok = !pl.why || pl.why === '-';
    ring(k, ok ? '#51cf66' : '#ff5252'); deco(P.d, { ...(st.tf?.[k] || {}), d: P.d, r: P.rot || 0 }, ok);
    P.chk = pl; const bar = document.querySelector('#isfull .hxbar'); if (bar) { const tmp = document.createElement('div'); tmp.innerHTML = tfMoveBar(P); bar.replaceWith(tmp.firstElementChild); }
    tfChip(ok ? '' : `✗ ${esc(pl.why)}`, ok ? '' : 'bad'); return;
  }
  const id = P.brush || 'grass', kind = tfKind(id), b = tfBrush(id);
  if (tfEdgeMode(id, st, k)) {
    const E = tfEdgeAt(); if (!E) return; pl = tfEdgePlan(E, id, st);
    const ok = !pl.why, [cx, cz] = hxPos(...hxQR(E.k)), a = E.i * Math.PI / 3, y = Math.max(hxHt(E.k, st), hxHt(hxNb(E.k)[E.i], st));
    const md = id === 'erase' ? new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, .36), new THREE.MeshBasicMaterial({ color: '#ffa94d', transparent: true, opacity: .45, depthWrite: false })) : tfGhostify(tfEdgeModel(id), ok || pl.why === '-');
    if (id === 'erase') md.position.y = .25;
    const w = new THREE.Group(); w.add(md); w.position.set(cx + Math.cos(a) - x0, y + .02, cz + Math.sin(a) - z0); w.rotation.y = -(a + Math.PI / 2); g.add(w);
  } else {
    pl = tfPlan(k, id, st, P.rot || 0);
    const ok = !pl.why || pl.why === '-', y = hxHt(k, st);
    ring(k, pl.why && pl.why !== '-' ? '#ff5252' : kind === 'erase' ? '#ffa94d' : pl.why === '-' ? '#ffffff' : '#51cf66');
    if (kind === 'deco') deco(id, { ...(st.tf?.[k] || {}), d: id, r: P.rot || 0 }, ok);
    else if (kind === 'brush' && pl.nx) fill(b.col, hxHt(k, { tf: { [k]: pl.nx } }) + .09);
    else if (kind === 'erase' && !pl.why) fill('#ffa94d', y + .09, .35);
  }
  if (HX3.paint && P.sn) chip = `${P.sn} · ${tfCostTxt(P.sl, P.sx)}`;
  else if (pl.why && pl.why !== '-') chip = `✗ ${esc(pl.why)}`;
  else if (pl.nx && !pl.why) chip = pl.turn ? '⟳ Turn · free' : kind === 'erase' ? '🧽 Remove' : tfCostTxt(pl.l, pl.x) + (ui.tfPv ? ' · preview' : '');
  tfChip(chip, pl.why && pl.why !== '-' && !(HX3.paint && P.sn) ? 'bad' : '');
}
