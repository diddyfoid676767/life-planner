'use strict';
/* 2.84 Tidy island (feedback round 2, stage R4).
   - The Workshop: a building on your island whose window holds Build, Roads, Walls, Terraform, Looks,
     Perks and How it works, plus the view controls (lock view, save angle, back to the middle).
     B opens it from anywhere. The screen's corners keep only the counters, Menu, Walk, the gear and
     Undo while you're editing.
   - Far islands: no island switcher bar. Round whichever island you're on, the others float in the
     distance: your own island, your house's fortress and this week's boss island (with its boss), and
     your housemates' islands as a ring of small islands further out. Hover one for its name and a hint,
     click it to fly there. Low graphics draws them as plain shapes.
   - Docks: on your own island's shore a wooden dock faces each of the other islands. In walk mode,
     walk to its end and a bridge of light carries you over. Fly back (click your island in the
     distance) and you land walking at the same dock. */

// ---------- the Workshop window ----------
const WS_TILES = [
  ['build', '🛒', 'Build', 'Buy new buildings'],
  ['road', '🛣️', 'Roads', 'Drag across hexes to lay them'],
  ['wall', '🧱', 'Walls', 'Drag to lay a wall ring'],
  ['tf', '🌱', 'Terraform', 'Ground, hills, ponds, paths, decorations'],
  ['looks', '🎨', 'Looks', 'Island looks, day and night, weather'],
  ['perks', '✨', 'Perks', 'Bonuses your buildings give'],
  ['help', '❔', 'How it works', 'Building, roads, linking, travel'],
];
function wsTab() {
  const st = hxState(), lv = hxLv(), busy = hxBusyN(st), wl = hxItem('wall').u;
  const tiles = WS_TILES.map(([id, e, n, d]) => {
    const lock = id === 'wall' && lv < wl;
    return `<button type="button" class="ws-t" data-ws="${id}" ${lock ? 'disabled' : ''}><i>${e}</i><b>${n}</b><small>${lock ? `Unlocks at level ${wl}` : d}</small></button>`;
  }).join('');
  const lk = typeof hxLocked === 'function' && hxLocked();
  const viewRow = `<div class="ws-view"><span>View</span><button type="button" data-is="view" data-v="lock" class="${lk ? 'on' : ''}" title="Snap to a tidy angle and keep it">${lk ? '🔒 Locked' : '🔓 Lock view'}</button><button type="button" data-is="view" data-v="saveview" title="Save this angle for Lock view">📌 Save angle</button><button type="button" data-is="view" data-v="reset" title="Back to the middle">⌂ Middle</button></div>`;
  return {
    k: `Level ${lv} · ${IS_BUILDERS - busy} of ${IS_BUILDERS} builders free`, v: 'Build and shape your island',
    hint: typeof hxWxChip === 'function' ? hxWxChip() : '',
    html: `<div class="ws-grid">${tiles}</div>${viewRow}<p class="bw-empty">Tip: press <b>B</b> to open the Workshop from anywhere, and <b>V</b> to walk.</p>`,
    list: [],
  };
}
function wsDo(a) {
  if ((ui.isTab || 'personal') !== 'personal' || ui.hxVisit) { ui.isTab = 'personal'; ui.hxVisit = null; if (typeof HX3 === 'object') HX3.sig = ''; }
  view = 'islands'; window.scrollTo(0, 0);
  if (a === 'road' || a === 'wall' || a === 'tf') { render(); hxStartPlace({ id: a, mode: 'tool', n: 0, brush: a === 'tf' ? ui.tfBrush || 'grass' : undefined }); return; }
  if (a === 'build') Object.assign(ui, { isPanel: 'shop', hxSel: null, hxP: null });
  else if (a === 'looks') Object.assign(ui, { isPanel: 'market', mkTab: 'looks', hxSel: null, hxP: null });
  else Object.assign(ui, { isPanel: a, hxSel: null, hxP: null });
  if (typeof sfx === 'function') try { sfx('open'); } catch (e) { }
  render();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-ws]'); if (!el || el.disabled) return;
  wsDo(el.dataset.ws);
});
// B opens (or closes) the Workshop from anywhere
document.addEventListener('keydown', e => {
  if (e.key !== 'b' && e.key !== 'B') return;
  const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
  if (typeof D !== 'object' || !D || document.querySelector('dialog[open]') || (typeof SO !== 'undefined' && SO) || ui.hxP || (document.getElementById('cmdk') && !document.getElementById('cmdk').hidden)) return;
  e.preventDefault();
  if (view === 'bw' && ui.bw?.id === 'workshop') { view = 'islands'; render(); return; }
  if (typeof shellRing === 'function') shellRing(false);
  bwOpen('workshop');
});

// ---------- far islands ----------
// where each island sits, as an angle round the one you're on (behind the island from the starting view)
const FA_ANG = { personal: -2.24, house: -2.8, boss: -1.62 };
const FA = { g: null, sig: '', pick: [], hov: null, down: null, docks: [], fx: null };
const faLow = () => !!(D.settings && D.settings.lowQuality);
const faHere = () => IS3.house === 'boss' ? 'boss' : IS3.house === 'hexh' ? 'house' : ui.hxVisit ? 'visit' : 'personal';
// what floats round you: { id, kind, n, hint, e, ac }
function faList() {
  const here = faHere(), out = [], po = typeof plannerOnly === 'function' && plannerOnly(), hs = typeof hsState === 'function' ? hsState() : {};
  if (here !== 'personal') out.push({ id: 'personal', kind: 'home', e: '🏝️', n: 'Your island', hint: 'Your buildings, farms and collectors · click to fly home', ac: '#8ce99a' });
  if (here !== 'house' && !po) {
    const h = hs.id && typeof hsHouse === 'function' ? hsHouse(hs.id) : null;
    let n = 0; try { if (h && typeof hsFight === 'function') n = hsFight(hs.id).rows.length; } catch (e) { }
    out.push({ id: 'house', kind: 'house', e: h ? h.e : '🏰', n: h ? `${h.name} fortress` : 'House fortress', hint: h ? `${n} housemate${n === 1 ? '' : 's'} fought this week · click to fly there` : 'Pick a house to build it together · click to fly there', ac: h?.col || '#ffd43b' });
  }
  if (here !== 'boss') {
    let b = null, left = 0, dead = false, rest = false;
    try { const wk = mondayOf(today()); b = hsBoss(wk); left = 7 - diffDays(wk, today()); rest = typeof bossWeek === 'function' && bossWeek(wk) === 'rest'; dead = !!(hs.id && hsFight(hs.id)?.dead); } catch (e) { }
    out.push({ id: 'boss', kind: 'boss', e: b ? b.e : '💀', n: b ? `Boss island: ${b.n}` : 'Boss island', boss: b?.n, dead, hint: rest ? 'Resting for the holidays' : dead ? 'Beaten this week 🎉 · click to fly there' : `Fight ends in ${left} day${left === 1 ? '' : 's'} · click to fly there`, ac: '#ff6b3d' });
  }
  // housemates' islands, further out (only what's already been fetched; the Tavern's House tab fetches the list)
  if (typeof hxIsleOn === 'function' && hxIsleOn()) {
    hxIsleList();
    for (const r of (HX_ISLE.list || []).filter(r => !r.me).slice(0, 12)) if (ui.hxVisit?.uid !== r.uid) out.push({ id: 'mate:' + r.uid, kind: 'mate', uid: r.uid, th: faMateTheme(r), e: '🏝️', n: `${r.n || 'Housemate'}'s island`, hint: 'A housemate · click to visit (look only)', ac: '#a5d8ff' });
  }
  return out;
}
// a housemate's island look, read from their shared island (once per update)
const FA_TH = {};
function faMateTheme(r) { const k = r.uid + '|' + r.ut; if (!(k in FA_TH)) { let t = ''; try { t = JSON.parse(r.d).th || ''; } catch (e) { } FA_TH[k] = t; } return FA_TH[k]; }
// one floating island in the distance (2.89): a light impression of the real one, by island type, on the
// same underside as the real islands (undersides.js). Your island and the house fortress show their real
// buildings in miniature (already on this computer, so nothing extra is fetched); housemates' islands are
// cheaper: a cottage and trees in their island look. Low graphics keeps the plain shapes.
function faIsle(f, low) {
  const g = new THREE.Group(), big = f.kind !== 'mate', r = big ? 4.6 : 2, rnd = seeded('fa-' + f.id), gfx = hxGfx();
  const boss = f.kind === 'boss', house = f.kind === 'house', fort = house && usFort();
  const kit = !low && typeof HX3 === 'object' && HX3.kit;
  // the top: grass inside a ring of sea on a sand slab, like the real hex islands (stone on the fortress look, dark rock on the boss island)
  const look = f.kind === 'home' ? faLook(hxState().theme) : f.kind === 'mate' ? faLook(f.th) : null;
  const grass = fort ? '#8a8692' : boss ? '#4b4458' : look?.gr ? is3shade(look.gr, .92) : '#7cc95a';
  if (boss) {
    is3mesh(new THREE.BoxGeometry(r * 1.4, .5, r * 1.4), '#4b4458', 0, -.25, 0, g);
    is3mesh(new THREE.BoxGeometry(r * 1.38, .45, r * 1.38), '#3d3649', 0, -.7, 0, g);
  } else {
    const ry = Math.PI / 6;
    is3mesh(new THREE.CylinderGeometry(r * .9, r * .9, .5, 6), grass, 0, -.2, 0, g).rotation.y = ry;
    if (!fort) is3mesh(new THREE.CylinderGeometry(r * .99, r * .99, .36, 6), '#4aa3df', 0, -.33, 0, g).rotation.y = ry; // the sea round the edge
    is3mesh(new THREE.CylinderGeometry(r * 1.02, r, .4, 6), fort ? '#6e6a75' : '#c9b48a', 0, -.7, 0, g).rotation.y = ry;
  }
  // the underside, the same as the real island's but with fewer parts (and still)
  const hs = typeof hsState === 'function' ? hsState() : {}, hh = house && hs.id && typeof hsHouse === 'function' ? hsHouse(hs.id) : null;
  const glow = boss ? (f.dead ? ['#4ee6ff', '#74c0fc'] : ['#ff6b3d', '#c2255c']) : house ? [hh?.col || f.ac, '#ffe8a3'] : usGlowFor(f.kind === 'home' ? hxState().theme : f.th);
  usBuild(g, { kind: boss ? 'boss' : house ? 'house' : f.kind === 'mate' ? 'mate' : 'home', fort, dead: f.dead, n: boss ? 4 : 6, rot: boss ? Math.PI / 4 : Math.PI / 6, R: boss ? r * .98 : r, y0: -.9, D: r * 1.75, rimY: -.5, rimR: boss ? r : r * 1.02, fallY: -.2, fallR: r * 1.02, glow, falls: f.kind === 'home' ? [-.5 + rnd()] : [], q: low || !big ? 'tiny' : 'far', seed: 'fa' + f.id });
  const M = (name, col, x, z, s = 1, ry = 0, mat) => { if (!kit) return null; const m = hxModel(name, col || hxCol(), mat, false); m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry; g.add(m); return m; };
  const max = gfx === 'high' ? 14 : 7;
  if (f.kind === 'home') {
    const st = hxState(), hall = HX_HOME_W.free.find(x => x.at === '0,0');
    if (!M(hall?.m || 'building_castle', null, 0, 0, .55)) is3mesh(new THREE.ConeGeometry(1, 2, 4), '#ffd43b', 0, 1, 0, g);
    if (kit) faReal(g, st, r / 17.5, max, rnd);
    if (!kit) is3mesh(new THREE.IcosahedronGeometry(.4, 1), '#ffb347', 0, 2.6, 0, g, true);
  } else if (house) {
    const col = hxCol();
    if (!M('building_castle', col, 0, 0, .75)) { is3mesh(new THREE.BoxGeometry(2, 2.4, 2), '#c9c2b5', 0, 1.2, 0, g); is3mesh(new THREE.ConeGeometry(1.5, 1.2, 4), f.ac, 0, 3, 0, g).rotation.y = Math.PI / 4; }
    M('flag_' + col, col, 0, 1.9, 1.4);
    // the real house buildings if the house island is already loaded, otherwise towers
    const st = kit && typeof hhSaved === 'function' && HI.doc ? (() => { try { return hhSaved(); } catch (e) { return null; } })() : null;
    if (!(st && faReal(g, st, r / 21.5, max, rnd))) { M('building_tower_A', col, 2.6, 1, .6); M('building_tower_A', col, -2.5, 1.3, .6); M('building_tower_A', col, .3, -2.7, .6); }
    // a wall round it, with towers on the corners: it's a fortress
    if (!low) faWalls(g, r * .8, fort ? '#7a7682' : '#c9c2b5', rnd);
    if (kit) for (let i = 0; i < 6; i += 2) { const a = i / 6 * Math.PI * 2; M('building_tower_A', col, Math.cos(a) * r * .8, Math.sin(a) * r * .8, .42); }
    if (fort && kit) for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, e = r * (.3 + rnd() * .45); M(['rock_single_A', 'rock_single_C', 'rock_single_E'][i % 3], null, Math.cos(a) * e, Math.sin(a) * e, .9 + rnd() * .6, rnd() * 6); }
  } else if (boss) {
    // the arena ring and this week's boss, with dark clouds over it, and the rock cracked with fire
    is3mesh(new THREE.CylinderGeometry(2.4, 2.5, .18, 16), '#8a8199', 0, .09, 0, g);
    const rune = is3mesh(new THREE.TorusGeometry(1.9, .07, 4, 30), f.dead ? '#4ee6ff' : '#ff7a3d', 0, .2, 0, g, true); rune.rotation.x = Math.PI / 2;
    if (!f.dead) for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, c = is3mesh(new THREE.BoxGeometry(.07, .04, .8 + rnd() * .8), '#ff922b', Math.cos(a) * 2.9, .02, Math.sin(a) * 2.9, g, true); c.rotation.y = a + (rnd() - .5); }
    if (!low && f.boss && typeof is3bossModel === 'function') { const m = new THREE.Group(); m.position.y = .2; m.scale.setScalar(.75); m.rotation.y = .6; try { is3bossModel(m, f.boss, f.dead ? 'dead' : 'live'); } catch (e) { } g.add(m); }
    else is3mesh(new THREE.IcosahedronGeometry(.9, 0), '#e03131', 0, 1.2, 0, g);
    if (!low) { const cm = new THREE.MeshStandardMaterial({ color: '#3a3346', roughness: 1, transparent: true, opacity: .85, depthWrite: false });
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rnd() * .9, 1), cm); c.position.set((rnd() - .5) * 6, 6.5 + rnd() * 1.2, (rnd() - .5) * 4); c.scale.y = .55; g.add(c); } }
  } else {
    // a housemate's island: a cottage and trees, in their island look
    const mat = kit ? faLookMat(look) : null;
    if (!M('building_home_B', null, 0, 0, .7, rnd() * 6, mat)) is3mesh(new THREE.BoxGeometry(1, .9, 1), '#e8c07d', 0, .45, 0, g);
    M('tree_single_A', null, 1.1, .5, .7, 0, mat); M('trees_A_small', null, -1, .6, .7, 0, mat); M(rnd() < .5 ? 'building_well' : 'tree_single_B', null, .2, -1.1, .6, 0, mat);
  }
  g.userData.fa = f;
  return g;
}
// a low stone wall with battlements round the fortress, merged into one mesh
function faWalls(g, e, col, rnd) {
  const b = usBucket(), h = .42, th = .16;
  for (let i = 0; i < 6; i++) {
    const a1 = i / 6 * Math.PI * 2, a2 = a1 + Math.PI / 3, A = [Math.cos(a1) * e, h / 2, Math.sin(a1) * e], B = [Math.cos(a2) * e, h / 2, Math.sin(a2) * e];
    const L = Math.hypot(B[0] - A[0], B[2] - A[2]), mid = [(A[0] + B[0]) / 2, (A[2] + B[2]) / 2], ang = Math.atan2(B[2] - A[2], B[0] - A[0]);
    usPut(b, new THREE.BoxGeometry(L, h, th).rotateY(-ang), col, mid[0], h / 2, mid[1]);
    for (let j = 0; j < 6; j++) { const t = (j + .5) / 6; usPut(b, new THREE.BoxGeometry(L / 14, .12, th * 1.1).rotateY(-ang), col, A[0] + (B[0] - A[0]) * t, h + .06, A[2] + (B[2] - A[2]) * t); }
    if (i === 1) usPut(b, new THREE.BoxGeometry(.34, .3, th * 1.3).rotateY(-ang), '#5c3d2e', mid[0], .15, mid[1]); // the gate
  }
  const m = usMesh(b, 'rock', g); if (m) m.castShadow = false;
}
// a few of an island's real buildings, shrunk onto a far island (biggest first)
function faReal(g, st, sc, max, rnd) {
  const W0 = hxW(st), rows = Object.entries(st.b || {}).map(([k, s]) => [k, s, W0.item(s.id)]).filter(([, , it]) => it && !it.wall).sort((a, b) => (b[2].hz || 1) - (a[2].hz || 1)).slice(0, max);
  let n = 0;
  for (const [k, s, it] of rows) {
    try {
      const [x, z] = hxMid(it, k), m = it.field ? hxModel('building_grain', hxCol()) : hxMakeModel(it, hxCol());
      m.position.set(x * sc, 0, z * sc); m.rotation.y = -(s.rot || 0) * Math.PI / 3; m.scale.multiplyScalar(sc * 1.6);
      m.traverse(o => { if (o.isMesh) o.castShadow = false; }); g.add(m); n++;
    } catch (e) { }
  }
  // and a few trees between them
  for (let i = 0; i < (n ? 4 : 2); i++) { const a = rnd() * 6.28, e = 2.2 + rnd() * 1.4, t = hxModel(rnd() < .5 ? 'trees_A_medium' : 'tree_single_B', hxCol(), undefined, false); t.position.set(Math.cos(a) * e, 0, Math.sin(a) * e); t.scale.setScalar(.45); g.add(t); }
  return n;
}
// an island look: a theme, or the real season
function faLook(th) { return (typeof HX_THEMES === 'object' && HX_THEMES[th]?.gr) ? HX_THEMES[th] : typeof HX_SEASONS === 'object' ? HX_SEASONS[hxSeason()] : null; }
// the kit's material recoloured to a look (made once per look)
function faLookMat(look) {
  const K = HX3.kit; if (!look || typeof hxThemeTex !== 'function') return undefined;
  const key = [look.gr, look.gs, look.lf, look.ls].join(); K.matFa = K.matFa || {};
  if (!K.matFa[key]) { const m = K.mat.clone(); m.map = hxThemeTex(look); K.matFa[key] = m; }
  return K.matFa[key];
}
// placed round you: the big ones on a near ring, housemates on a far ring
function faBuild() {
  if (FA.g) { IS3.scene.remove(FA.g); FA.g.traverse(o => { if (o.geometry && !Object.values(HX3?.geos || {}).includes(o.geometry)) o.geometry.dispose(); }); }
  const g = FA.g = new THREE.Group(); g.name = 'farIsles'; FA.pick = [];
  const low = faLow(), here = faHere(), list = faList();
  const R = IS3.house === 'hexh' ? 58 : IS3.house === 'boss' ? 36 : 44, y = IS3.house === 'boss' ? -6 : -9;
  const mates = list.filter(f => f.kind === 'mate');
  for (const f of list) {
    let a, r = R, yy = y, s = 1;
    if (f.kind === 'mate') { const i = mates.indexOf(f), n = mates.length; a = -2.24 + (n > 1 ? (i / (n - 1) - .5) * 2.2 : 0) + .15; r = R * 1.55; yy = y + 4; s = .9; }
    else a = FA_ANG[f.id];
    const isle = faIsle(f, low); isle.position.set(Math.cos(a) * r, yy, Math.sin(a) * r); isle.scale.setScalar(s); isle.rotation.y = -a; g.add(isle); FA.pick.push(isle);
  }
  // docks on your own island's shore, facing the house fortress and the boss island
  FA.docks = [];
  if (here === 'personal' && IS3.house === 'hex') for (const f of list.filter(f => f.kind === 'house' || f.kind === 'boss')) { const d = faDock(f); if (d) { FA.docks.push(d); if (d.g) g.add(d.g); } }
  if (typeof WK === 'object') WK.cells = null; // walk mode looks the docks up again
  IS3.scene.add(g);
}
// the water hex at the island's edge that faces an island, and a dock on it
function faDock(f) {
  const ang = FA_ANG[f.id], land = hxLand(), st = hxState();
  let best = null, bd = 9;
  for (const [k, h] of land) {
    if (h.t !== 'water') continue;
    const [q, r] = hxQR(k); if (hxDist(q, r) !== HX_R + 1) continue;
    const [x, z] = hxPos(q, r); let d = Math.atan2(z, x) - ang; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    // the shore hex it leads onto should be open ground (a road, path or grass), so you can walk onto it
    const inner = hxNb(k).filter(n => land.get(n) && land.get(n).t !== 'water' && hxDist(...hxQR(n)) === HX_R);
    const open = inner.some(n => { const a = hxAt(n, st); return a.kind === 'grass' || a.kind === 'road'; });
    if (d > .7) continue;
    const sc = d + (open ? 0 : .5); if (sc < bd) { bd = sc; best = k; }
  }
  if (!best) return null;
  const [x, z] = hxPos(...hxQR(best)), a = Math.atan2(z, x), d = { k: best, to: f.id, n: `Dock to ${f.n.replace(/^Boss island: /, 'the boss island (') + (f.kind === 'boss' && f.boss ? ')' : '')}`, ac: f.ac, x, z, r: Math.hypot(x, z), a };
  // the dock: planks running out from the shore, posts, two lanterns and a soft arch of light at the end
  const g = d.g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a;
  const wood = '#a8763f', dark = '#5c3d24';
  for (let i = 0; i < 9; i++) { const p = is3mesh(new THREE.BoxGeometry(.24, .07, 1.1), ['#a8763f', '#b9864c', '#9a6a37'][i % 3], -1.2 + i * .3, .08, 0, g); p.castShadow = false; }
  for (const sx of [-1.15, 1.15]) for (const sz of [-.5, .5]) is3mesh(new THREE.CylinderGeometry(.06, .07, 1.1, 6), dark, sx, -.4, sz, g);
  for (const sz of [-.5, .5]) is3mesh(new THREE.BoxGeometry(2.5, .05, .05), wood, 0, .38, sz, g);
  for (const sz of [-.5, .5]) { is3mesh(new THREE.CylinderGeometry(.035, .035, .8, 6), dark, 1.1, .5, sz, g); is3mesh(new THREE.OctahedronGeometry(.1, 0), '#ffd86b', 1.1, .95, sz, g, true); }
  const arch = is3mesh(new THREE.TorusGeometry(.62, .05, 6, 20, Math.PI), f.ac, 1.25, .1, 0, g, true); arch.rotation.y = Math.PI / 2;
  arch.material = arch.material.clone(); arch.material.transparent = true; arch.material.opacity = .85;
  return d;
}
function faMount() {
  if (!IS3.scene || !window.THREE) return;
  const show = !(typeof shell2D === 'function' && shell2D()) && (IS3.house === 'hex' || IS3.house === 'hexh' || IS3.house === 'boss');
  const L = show ? faList() : [];
  const sig = [show, IS3.house, faHere(), hxGfx(), !!HX3?.kit, usFort(), hxSeason(), L.map(f => f.id + (f.boss || '') + (f.dead ? 'd' : '') + (f.th || '')).join(','), IS3.house === 'hex' ? hxState().road.length + JSON.stringify(hxState().clr) : Object.keys(hxState().b).join() + hxState().theme, HI.doc && IS3.house !== 'hexh' ? HI.ut || '' : ''].join('|');
  if (sig !== FA.sig) { FA.sig = sig; if (show) faBuild(); else if (FA.g) { IS3.scene.remove(FA.g); FA.g = null; FA.docks = []; } }
  else if (FA.g && !IS3.scene.children.includes(FA.g)) IS3.scene.add(FA.g);
}
// is this hex a dock? (walk.js treats docks as ground, hexpolish.js gives them a hover tag)
function faDockAt(k) { return (IS3.house === 'hex' && !ui.hxVisit && FA.docks.find(d => d.k === k)) || null; }

// ---------- hover and click ----------
function faHit(e) {
  if (!FA.g || !FA.pick.length || !IS3.cam) return null;
  const r = IS3.canvas.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  IS3.ray.setFromCamera(m, IS3.cam);
  const hit = IS3.ray.intersectObjects(FA.pick, true)[0]; if (!hit) return null;
  let o = hit.object; while (o && !o.userData.fa) o = o.parent;
  return o ? o.userData.fa : null;
}
function faTag(f, e) {
  let t = document.getElementById('fatag');
  if (!f) { if (t) t.remove(); return; }
  if (!t) { t = document.createElement('div'); t.id = 'fatag'; document.body.appendChild(t); }
  const html = `<span>${f.e}</span><div><b>${esc(f.n)}</b><small>${esc(f.hint)}</small></div>`;
  if (t.dataset.id !== f.id) { t.dataset.id = f.id; t.innerHTML = html; t.style.setProperty('--ac', f.ac); }
  t.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
}
function faPointer(type, e) {
  if (!FA.g || !FA.g.parent || (typeof WK === 'object' && WK.on) || ui.hxP) return false;
  if (type === 'leave') { faTag(null); FA.hov = null; return false; }
  const f = e && (e.buttons === 0 || type !== 'move') ? faHit(e) : null;
  if (type === 'move') {
    if (e.buttons) { if (FA.hov) { FA.hov = null; faTag(null); } return false; }
    if (f !== FA.hov) { FA.hov = f; if (f) { if (typeof hxHoverInfo === 'function' && IS3.hexMode) hxHoverInfo(null); IS3.canvas.style.cursor = 'pointer'; if (typeof sfx === 'function') try { sfx('hxtick', { gap: 80, f: 440 }); } catch (x) { } } else IS3.canvas.style.cursor = ''; }
    faTag(f, e);
    return !!f;
  }
  if (type === 'down') { FA.down = f && e.button === 0 ? { f, x: e.clientX, y: e.clientY } : null; return !!FA.down; }
  if (type === 'up') {
    const d = FA.down; FA.down = null; if (!d) return false;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 7 && f && f.id === d.f.id) { faTag(null); FA.hov = null; faGo(f); }
    return true;
  }
  return false;
}
function faGo(f, dock) {
  if (typeof sfx === 'function') try { sfx('select'); } catch (x) { }
  if (f.kind === 'mate') {
    const row = (HX_ISLE.list || []).find(r => r.uid === f.uid), st = row && typeof hxVisitState === 'function' ? hxVisitState(row) : null;
    if (!st) { toast('Couldn\'t open that island', 'Try again in a minute.'); return; }
    shellTravel('personal', () => { Object.assign(ui, { hxVisit: { uid: row.uid, n: row.n, st }, isPanel: null, hxSel: null, hxP: null }); HX3.sig = ''; render(); });
    return;
  }
  const back = f.id === 'personal' && FA.fromDock; FA.fromDock = dock || null;
  if (f.id === 'personal' && ui.hxVisit && (ui.isTab || 'personal') === 'personal') { ui.hxVisit = null; HX3.sig = ''; render(); return; }
  shellTravel(f.id, back ? () => setTimeout(() => faLand(back), 120) : null);
  if (dock && f.id !== 'personal') setTimeout(() => toast('⚓ You crossed over', 'Walking works on your own island for now. Click your island in the distance to fly back, and you\'ll land on the dock.'), 900);
}
// back from a dock trip: you land walking at the end of the same dock, facing home
function faLand(id) {
  const d = FA.docks.find(x => x.to === id); if (!d || typeof wkToggle !== 'function' || (ui.isTab || 'personal') !== 'personal' || view !== 'islands') return;
  wkToggle(true);
  if (!WK.on) return;
  const r = d.r - 1.1, x = Math.cos(d.a) * r, z = Math.sin(d.a) * r;
  Object.assign(WK, { x, z, y: wkGround(x, z), vx: 0, vz: 0, face: Math.atan2(-x, -z) });
  WK.cy = WK.face + Math.PI; WK.ct = null; WK.cool = performance.now() + 800;
}

// ---------- walking onto a dock ----------
setInterval(() => {
  if (typeof WK !== 'object' || !WK.on || !FA.docks.length || view !== 'islands' || FA.going || ui.hxVisit) return;
  const k = hxFromXZ(WK.x, WK.z), d = FA.docks.find(x => x.k === k);
  if (!d || Math.hypot(WK.x, WK.z) < d.r - .1) return;
  const f = faList().find(x => x.id === d.to); if (!f) return;
  FA.going = true;
  faBridge(d, f, () => { FA.going = false; wkToggle(false); faGo(f, d.to); });
}, 120);
// a bridge of light forms from the dock to the island, then you're carried over
function faBridge(d, f, then) {
  const isle = FA.pick.find(o => o.userData.fa?.id === f.id);
  if (!isle || faLow() || matchMedia('(prefers-reduced-motion: reduce)').matches) { then(); return; }
  const A = new THREE.Vector3(d.x, .4, d.z), B = isle.position.clone().add(new THREE.Vector3(0, .5, 0)), L = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1, 8), new THREE.MeshBasicMaterial({ color: f.ac, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); IS3.scene.add(m);
  if (typeof sfx === 'function') try { sfx('whoosh'); } catch (x) { }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / 700), len = L * (1 - Math.pow(1 - p, 3));
    m.scale.set(1 + Math.sin(p * 9) * .2, Math.max(.01, len), 1 + Math.sin(p * 9) * .2); m.position.copy(A).add(B.clone().sub(A).normalize().multiplyScalar(len / 2));
    is3draw();
    if (p < 1) requestAnimationFrame(step); else { setTimeout(() => { IS3.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }, 900); then(); }
  };
  requestAnimationFrame(step);
}
