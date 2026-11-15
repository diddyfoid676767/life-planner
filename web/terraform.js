'use strict';
/* Terraforming and decorations (2.70, roadmap stage 3d). Loaded after hexpolish.js.
   Your island's changes live in hxState().tf: { 'q,r': { t, h, d, r } }
     t = painted ground: sand | path | forest | hill | water (no t = the island's own ground)
     h = raised by this many steps (0 to HX_TF.hMax)
     d = a decoration or plant on the hex, r = which way it faces
   Painting only works on open ground (natural trees and rocks are cleared first, hills,
   mountains and the river stay). Painted forest and hills count for the lumber mill and mine
   bonuses. Every stroke costs a little; Undo gives a stroke back with its cost, Reset terrain
   puts the ground and heights back as they were (decorations stay). All prices are here. */
const HX_TF = {
  hStep: .34, hMax: 3,
  // per hex
  brush: {
    grass: { n: 'Grass', e: '🌿', l: 2, x: 0, d: 'Back to plain grass' },
    sand: { n: 'Sand', e: '🏖️', l: 2, x: 0 },
    path: { n: 'Path', e: '🟫', l: 2, x: 0, d: 'A dirt path (cosmetic: roads are what link buildings)' },
    forest: { n: 'Forest', e: '🌲', l: 2, x: 0, d: 'Counts as forest for a lumber mill' },
    hill: { n: 'Hills', e: '⛰️', l: 0, x: 2, d: 'Counts as a hill for a mine' },
    water: { n: 'Pond', e: '💧', l: 0, x: 2 },
    up: { n: 'Raise', e: '⬆️', l: 0, x: 2, d: 'One step higher per stroke' },
    down: { n: 'Lower', e: '⬇️', l: 0, x: 0, d: 'One step lower (free)' },
  },
  // decorations and plants: cosmetic only, one per hex
  deco: {
    flowers: { n: 'Flowers', e: '🌸', l: 5, x: 0, plant: 1 },
    tree: { n: 'Tree', e: '🌳', l: 8, x: 0, plant: 1 },
    rock: { n: 'Rock', e: '🪨', l: 0, x: 5, plant: 1 },
    bench: { n: 'Bench', e: '🪑', l: 25, x: 0 },
    lamp: { n: 'Lamp post', e: '🏮', l: 0, x: 30, d: 'Glows at night' },
    flag: { n: 'Flag', e: '🚩', l: 20, x: 0, d: 'In your house colour' },
    barrels: { n: 'Barrels', e: '🛢️', l: 0, x: 15 },
    cart: { n: 'Cart', e: '🛒', l: 20, x: 0 },
    tent: { n: 'Tent', e: '⛺', l: 40, x: 0 },
    statue: { n: 'Statue', e: '🗿', l: 0, x: 150 },
    fountain: { n: 'Fountain', e: '⛲', l: 150, x: 0 },
  },
};
const tfAll = st => (st.tf = st.tf || {});
const hxHt = (k, st) => ((st?.tf?.[k]?.h) || 0) * HX_TF.hStep;
const tfBrush = id => HX_TF.brush[id] || HX_TF.deco[id];
// what a hex is under its painted ground (natural ground with trees/rocks cleared counts as grass)
function tfOpen(k, st) {
  const L = hxW(st).land(), h = L.get(k); if (!h || h.t === 'water' || h.t === 'river') return false;
  if (hxFreeAt(k, st) || st.road.includes(k)) return false;
  const mk = st.__occ?.[k] || (st.b[k] && k); if (mk && st.b[mk]) return false;
  return h.t === 'grass' || ((h.t === 'forest' || h.t === 'rock') && st.clr.includes(k)) || !!st.tf?.[k]?.t;
}
// paint one hex with the current brush; returns '' when done, '-' when there was nothing to do, or why not
function tfPaint(k) {
  const P = ui.hxP, st = hxState(), T = HX3.paint, id = P.brush || 'grass';
  if (T.done?.has(k)) return '-';
  const cur = st.tf?.[k] || {}, b = tfBrush(id);
  if (id === 'erase') { if (!cur.d) return '-'; return tfApply(st, k, { ...cur, d: undefined, r: undefined }, 0, 0); }
  if (!tfOpen(k, st)) { const a = hxAt(k, st); return a.kind === 'off' || a.kind === 'water' ? '-' : a.kind === 'tree' || a.kind === 'rock' ? 'Clear the trees and rocks first' : a.kind === 'b' || a.kind === 'free' ? 'There\'s a building here' : a.kind === 'road' ? 'There\'s a road here' : a.kind === 'river' ? 'The river stays' : 'Hills and mountains stay'; }
  const nx = { ...cur };
  if (id === 'up') { if ((cur.h || 0) >= HX_TF.hMax) return 'As high as it goes'; nx.h = (cur.h || 0) + 1; }
  else if (id === 'down') { if (!cur.h) return '-'; nx.h = cur.h - 1; }
  else if (HX_TF.brush[id]) {
    const t = id === 'grass' ? undefined : id;
    if (cur.t === t) return '-';
    if (cur.d && (t === 'forest' || t === 'hill' || t === 'water')) return 'Remove the decoration first';
    nx.t = t;
  } else {
    if (cur.d === id) return '-';
    if (cur.t === 'forest' || cur.t === 'hill' || cur.t === 'water') return 'Decorations go on grass, sand or paths';
    nx.d = id; nx.r = P.rot || 0;
  }
  if (!hxCan(b.l, b.x)) return `Not enough ${b.l ? 'Lumen' : 'Ember'}`;
  return tfApply(st, k, nx, b.l, b.x);
}
function tfApply(st, k, nx, l, x) {
  const T = HX3.paint, tf = tfAll(st), prev = tf[k] ? { ...tf[k] } : null;
  for (const kk of Object.keys(nx)) if (nx[kk] === undefined || (kk === 'h' && !nx.h)) delete nx[kk];
  if (Object.keys(nx).length) tf[k] = nx; else delete tf[k];
  if (l || x) ftTake(l, x);
  (T.done = T.done || new Set()).add(k);
  if (!T.rec) { T.rec = []; (ui.tfHist = ui.tfHist || []).push(T.rec); if (ui.tfHist.length > 40) ui.tfHist.shift(); }
  T.rec.push({ k, prev, l, x });
  return '';
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
  if (!confirm('Put all the ground and heights back as they started? Decorations stay. This can\'t be undone and nothing is refunded.')) return;
  for (const [k, v] of Object.entries(tf)) { delete v.t; delete v.h; if (!v.d) delete tf[k]; }
  ui.tfHist = []; save(); HX3.sig = ''; render(); toast('🌱 Terrain reset', 'The ground is back as it started.');
}
// the brush bar while terraforming
function tfBar(P) {
  const id = P.brush || 'grass', b = tfBrush(id), btn = ([k, v]) => `<button class="tfb ${k === id ? 'on' : ''}" data-hx="tfb" data-v="${k}" title="${esc(v.n)}${v.d ? ': ' + esc(v.d) : ''} · ${hxCost(v.l, v.x)}"><span>${v.e}</span>${esc(v.n)}</button>`;
  const grp = (n, list) => `<div class="tfg"><small>${n}</small><div>${list.map(btn).join('')}</div></div>`;
  const B = Object.entries(HX_TF.brush), Dc = Object.entries(HX_TF.deco);
  return `<div class="ishud is-bc isplace hxbar tfbar">
    <div class="tfgs">${grp('Ground', B.filter(([k]) => k !== 'up' && k !== 'down'))}${grp('Height', B.filter(([k]) => k === 'up' || k === 'down'))}${grp('Plants', Dc.filter(([, v]) => v.plant))}${grp('Decorations', Dc.filter(([, v]) => !v.plant))}${grp('&nbsp;', [['erase', { n: 'Remove', e: '🧽', l: 0, x: 0, d: 'Take a decoration or plant away' }]])}</div>
    <div class="tfrow"><span>${id === 'erase' ? '🧽 Drag over decorations and plants to take them away.' : `<b>${b.e} ${esc(b.n)}</b> · ${hxCost(b.l, b.x)} a hex. Click or drag over the island${HX_TF.deco[id] ? ', <b>R</b> turns it' : ''}.`}${P.n ? ` <b>${P.n} done</b>` : ''} ${P.why ? `<b class="hxwhy bad">${esc(P.why)}</b>` : ''}</span>
    <button class="btn small" data-hx="tfundo" ${ui.tfHist?.length ? '' : 'disabled'} title="Undo the last stroke and get its cost back (Ctrl+Z)">↶ Undo</button><button class="btn small ghost" data-hx="tfreset" title="Put the ground and heights back as they started">⟲ Reset terrain</button><button class="btn small primary" data-hx="cancel">✔ Done</button></div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-hx="tfb"],[data-hx="tfundo"],[data-hx="tfreset"]'); if (!el) return;
  const a = el.dataset.hx;
  if (a === 'tfb' && ui.hxP?.id === 'tf') { ui.hxP.brush = ui.tfBrush = el.dataset.v; ui.hxP.why = ''; if (typeof sfx === 'function') sfx('select'); render(); }
  else if (a === 'tfundo') tfUndo();
  else if (a === 'tfreset') tfReset();
});

// ---------- 3D ----------
// the painted ground on one hex (called from hxBuild); returns true when it drew the tile itself
function tfGround(k, st, add, W) {
  const tf = st.tf?.[k]; if (!tf) return false;
  const ht = hxHt(k, st), [x, z] = hxPos(...hxQR(k));
  if (ht > 0) { const c = is3mesh(new THREE.CylinderGeometry(1.15, 1.15, ht + .5, 6), '#7a5a3e', x, (ht - .5) / 2 - .03, z, W); c.rotation.y = Math.PI / 6; c.castShadow = false; }
  const h = hxW(st).land().get(k);
  if (tf.t === 'water') { add('hex_water', k); if (h.v > .6) add('waterlily_A', k, Math.floor(h.v * 6), -.2); return true; }
  if (!tf.t) return false;
  add('hex_grass', k, Math.floor(h.v * 6));
  if (tf.t === 'sand') { const c = is3mesh(new THREE.CylinderGeometry(1.12, 1.14, .04, 6), '#ead39b', x, ht + .02, z, W); c.rotation.y = Math.PI / 6; c.castShadow = false; }
  else if (tf.t === 'path') add('building_dirt', k, Math.floor(h.v * 6));
  else if (tf.t === 'forest') add(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6);
  else if (tf.t === 'hill') add(['hills_A', 'hills_B_trees', 'hills_C', 'hill_single_A'][Math.floor(h.v * 4)], k, Math.floor(h.v * 60) % 6);
  return true;
}
// a decoration's model (shared by the ghost and the island)
function tfModel(id, col) {
  const g = new THREE.Group(), m = (geo, c, x, y, z, glow) => is3mesh(geo, c, x, y, z, g, glow), stone = '#d6cfc0';
  if (id === 'fountain') {
    m(new THREE.CylinderGeometry(.85, .95, .32, 10), stone, 0, .16, 0);
    const wm = HX3.waterMat || (HX3.waterMat = new THREE.MeshStandardMaterial({ color: '#5ec3ef', emissive: '#1c6d99', emissiveIntensity: .35, roughness: .2, transparent: true, opacity: .85 }));
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, .05, 10), wm); w1.position.y = .3; g.add(w1);
    m(new THREE.CylinderGeometry(.11, .16, .62, 8), stone, 0, .6, 0);
    m(new THREE.CylinderGeometry(.38, .17, .14, 10), stone, 0, .92, 0);
    const w2 = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .03, 10), wm); w2.position.y = .98; g.add(w2);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(.07, .34, 6), wm); jet.position.y = 1.15; g.add(jet); HX3.anim.push({ o: jet, flick: Math.random() * 6 });
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
    (HX3.lights = HX3.lights || []).push(li);
  } else if (id === 'bench') {
    m(new THREE.BoxGeometry(.9, .06, .3), '#a0703f', 0, .32, 0); m(new THREE.BoxGeometry(.9, .2, .05), '#a0703f', 0, .5, -.14);
    for (const [lx, lz] of [[-.38, -.1], [.38, -.1], [-.38, .1], [.38, .1]]) m(new THREE.BoxGeometry(.06, .3, .06), '#5c3d24', lx, .15, lz);
  } else if (id === 'flowers') {
    const r = seeded('tf-fl'), cs = ['#ffec99', '#ffa8c5', '#ffffff', '#d0bfff', '#ff8787', '#ffc078'];
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * .75, x = Math.cos(a) * d, z = Math.sin(a) * d; m(new THREE.ConeGeometry(.05, .22, 4), '#4b9a37', x, .1, z); m(new THREE.IcosahedronGeometry(.07, 0), cs[i % cs.length], x, .23, z); }
  } else if (id === 'tree') g.add(hxModel('tree_single_A', col));
  else if (id === 'rock') { const r = hxModel('rock_single_C', col); r.scale.setScalar(1.8); g.add(r); }
  else if (id === 'flag') { const f = hxModel('flag_' + col, col); f.scale.setScalar(2.6); g.add(f); }
  else if (id === 'barrels') { const a = hxModel('barrel', col), b = hxModel('barrel', col), c = hxModel('crate_A_small', col); a.position.set(-.3, 0, .1); b.position.set(.15, 0, -.2); c.position.set(.3, 0, .35); g.add(a, b, c); }
  else if (id === 'cart') g.add(hxModel('wheelbarrow', col));
  else if (id === 'tent') g.add(hxModel('tent', col));
  return g;
}
// every decoration on the island (called from hxBuild)
function tfDecos(W, st, col) {
  HX3.lights = [];
  for (const [k, v] of Object.entries(st.tf || {})) {
    if (!v.d || !HX_TF.deco[v.d]) continue;
    const [x, z] = hxPos(...hxQR(k)), g = tfModel(v.d, col); g.position.set(x, hxHt(k, st) + (v.t === 'sand' ? .04 : 0), z); g.rotation.y = -(v.r || 0) * Math.PI / 3; W.add(g);
    IS3.marks[k] = [x, hxHt(k, st) + 1.2, z];
  }
}
