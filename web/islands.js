'use strict';
/* Islands (2.49, islands stage 3): the Islands section with a travel map and
   your 3D personal island. Buildings cost Lumen, Ember or both, take a few days
   to build, then give small personal perks (more Lumen/Ember, or battle buffs
   that add to your gear). They slowly wear (half perk) then break (no perk),
   are never destroyed, and are repaired with currency. Wear pauses on holidays
   and around exams. The island view is rotate and zoom only, low-poly and drawn
   only when something changes. House and Boss islands come in stages 4 and 5.
   State lives in D.cards.isl so it resets with the cards. */

const IS_WEAR = 21, IS_BREAK = 42; // active (not paused) days after building or repairing
const IS_REPAIR = { worn: .15, broken: .35 }; // share of the build cost
const IS_EARN = { lp: [.03, 'Lumen earned', v => `+${Math.round(v * 100)}%`], ep: [.03, 'Ember earned', v => `+${Math.round(v * 100)}%`] };
const IS_ITEMS = [
  { id: 'hut', n: 'Study Hut', e: '📚', m: 'hut', col: '#d9a066', l: 300, x: 0, days: 2, b: { lp: .03 } },
  { id: 'shed', n: 'Training Shed', e: '🏋️', m: 'hut', col: '#c0504d', l: 0, x: 300, days: 2, b: { ep: .03 } },
  { id: 'fire', n: 'Campfire', e: '🔥', m: 'fire', col: '#ff922b', l: 120, x: 120, days: 1, b: { rg: 1 } },
  { id: 'shrine', n: 'Moon Shrine', e: '⛩️', m: 'shrine', col: '#e03131', l: 450, x: 0, days: 3, b: { hp: 15 } },
  { id: 'forge', n: 'Forge', e: '⚒️', m: 'forge', col: '#868e96', l: 150, x: 450, days: 3, b: { mv: .04 } },
  { id: 'light', n: 'Lighthouse', e: '🗼', m: 'light', col: '#f8f9fa', l: 450, x: 150, days: 3, b: { sp: .04 } },
  { id: 'tower', n: 'Watchtower', e: '🏯', m: 'tower', col: '#a0785a', l: 300, x: 300, days: 3, b: { cr: .02 } },
  { id: 'wall', n: 'Stone Wall', e: '🧱', m: 'wall', col: '#adb5bd', l: 0, x: 500, days: 3, b: { dr: .03 } },
  { id: 'mill', n: 'Windmill', e: '🌬️', m: 'mill', col: '#f1e3c6', l: 400, x: 400, days: 4, b: { lp: .02, ep: .02 } },
  { id: 'spring', n: 'Hot Spring', e: '♨️', m: 'spring', col: '#66d9e8', l: 600, x: 600, days: 4, b: { hp: 20, rg: 1 } },
  { id: 'obs', n: 'Observatory', e: '🔭', m: 'dome', col: '#748ffc', l: 900, x: 300, days: 5, b: { wk: .05 } },
  { id: 'totem', n: 'Spirit Totem', e: '🗿', m: 'totem', col: '#94d82d', l: 700, x: 700, days: 5, b: { dg: .02 } },
];
const isState = () => { const c = cdState(); return (c.isl = Object.assign({ items: {} }, c.isl || {})); };
const isItem = id => IS_ITEMS.find(x => x.id === id);
const isBuffText = b => Object.entries(b).map(([k, v]) => { const f = IS_EARN[k] || FT_BUFF[k]; return `${f[1]} ${f[2](Math.round(v * 100) / 100)}`; }).join(' · ');
const isCost = (it, f = 1) => [it.l && `${LUMEN} ${Math.round(it.l * f)}`, it.x && `${EMBER} ${Math.round(it.x * f)}`].filter(Boolean).join(' + ');

// days when wear stands still: holidays, and an exam's day plus the 3 days before it
function isPaused() {
  const ex = new Set();
  for (const a of (D.assessments || [])) if (typeof isExam === 'function' && isExam(a) && a.date) for (let i = 0; i <= 3; i++) ex.add(addDays(a.date, -i));
  return d => ex.has(d) || (typeof isHoliday === 'function' && isHoliday(d));
}
// each building's condition on every day since it was finished (cached until something changes)
const IS_TL = new Map();
function isTimeline(id) {
  const s = isState().items[id]; if (!s) return null;
  const key = [id, s.start, s.ready, (s.reps || []).join(), today(), (D.settings.holidays || []).length, (D.assessments || []).length].join('|');
  if (IS_TL.has(key)) return IS_TL.get(key);
  const tl = {}, reps = new Set(s.reps || []), paused = isPaused(); let act = 0;
  for (let d = s.ready; d <= today(); d = addDays(d, 1)) {
    if (reps.has(d)) act = 0;
    tl[d] = act >= IS_BREAK ? 'broken' : act >= IS_WEAR ? 'worn' : 'ok';
    if (!paused(d)) act++;
  }
  const out = { tl, act };
  for (const k of IS_TL.keys()) if (k.startsWith(id + '|')) IS_TL.delete(k);
  IS_TL.set(key, out); return out;
}
function isCond(id, d = today()) {
  const s = isState().items[id]; if (!s || d < s.start) return null;
  if (d < s.ready) return 'build';
  return isTimeline(id).tl[d] || 'ok';
}
const isMult = c => c === 'ok' ? 1 : c === 'worn' ? .5 : 0;
// battle buffs from the island, added to gear in fight.js
function islBuffs(d = today()) {
  const g = {};
  for (const it of IS_ITEMS) { const m = isMult(isCond(it.id, d)); if (m) for (const [k, v] of Object.entries(it.b)) if (FT_BUFF[k]) g[k] = (g[k] || 0) + (k === 'hp' || k === 'rg' ? Math.round(v * m) : v * m); }
  return g;
}
// extra share of Lumen (lp) or Ember (ep) earned on a day, used by cdWallet
function islEarn(k, d) {
  const its = isState().items; let t = 0;
  for (const it of IS_ITEMS) if (it.b[k] && its[it.id]) t += it.b[k] * isMult(isCond(it.id, d));
  return t;
}

// ---------- page ----------
function isMapHtml(tab) {
  const isle = (id, x, y, r, col, e, n, sub) => `<g class="ismap-i ${tab === id ? 'on' : ''}" data-is="tab" data-v="${id}" role="button" tabindex="0"><ellipse cx="${x}" cy="${y + r * .35}" rx="${r * 1.25}" ry="${r * .45}" fill="#0b3d5c" opacity=".35"/><ellipse cx="${x}" cy="${y}" rx="${r * 1.2}" ry="${r * .55}" fill="#f2d7a0"/><ellipse cx="${x}" cy="${y - 3}" rx="${r}" ry="${r * .42}" fill="${col}"/><text x="${x}" y="${y + 2}" text-anchor="middle" font-size="${r * .7}">${e}</text><text x="${x}" y="${y + r * .55 + 18}" text-anchor="middle" class="ismap-n">${n}</text><text x="${x}" y="${y + r * .55 + 33}" text-anchor="middle" class="ismap-s">${sub}</text></g>`;
  return `<svg class="ismap" viewBox="0 0 600 210" role="img" aria-label="Travel map"><rect width="600" height="210" rx="14" fill="url(#isSea)"/><defs><linearGradient id="isSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4dabf7"/><stop offset="1" stop-color="#1864ab"/></linearGradient></defs>
    <path d="M120 100 Q210 40 300 92 M300 92 Q390 150 480 96" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 8" fill="none" opacity=".7"/>
    ${isle('personal', 120, 96, 44, '#69db7c', '🏝️', 'Your island', 'Personal perks')}${isle('house', 300, 86, 56, '#51cf66', '🏰', 'House island', 'Coming in stage 4')}${isle('boss', 480, 92, 42, '#868e96', typeof hsBoss === 'function' ? hsBoss(mondayOf(today())).e : '💀', 'Boss island', 'Coming in stage 5')}</svg>`;
}
function viewIslands() {
  const tab = ui.isTab || 'personal', w = cdWallet();
  const head = `${pageHead('🏝️ Islands', 'Travel between your island, your house island and the boss island')}
    <div class="cdwallet"><div class="card cdcoin cd-l"><div class="cdbig">${LUMEN} ${w.lumen.toLocaleString()}</div><div><b>Lumen</b><div class="muted small-text">From study</div></div></div>
      <div class="card cdcoin cd-e"><div class="cdbig">${EMBER} ${w.ember.toLocaleString()}</div><div><b>Ember</b><div class="muted small-text">From training</div></div></div></div>
    <div class="card ismapcard">${isMapHtml(tab)}</div>`;
  if (tab === 'house') return `${head}<div class="card"><h3>🏰 House island</h3><p class="muted">Big shared builds paid from the house pool (House Lumen and House Ember), voted on by your house, arrive in the next update. For now your house fights the weekly boss on the House page.</p><button class="btn" data-act="goto" data-v="house">Go to House</button></div>`;
  if (tab === 'boss') { const b = typeof hsBoss === 'function' ? hsBoss(mondayOf(today())) : null;
    return `${head}<div class="card"><h3>${b ? b.e + ' ' + esc(b.n) : '💀 Boss island'}</h3><p class="muted">${b ? esc(b.s) + ' ' : ''}Visiting the boss on its own island comes in a later update. You can already fight this week's boss with your build from the House page.</p><button class="btn" data-act="goto" data-v="house">Fight on the House page</button></div>`; }
  const st = isState(), g = islBuffs(), earn = { lp: islEarn('lp', today()), ep: islEarn('ep', today()) };
  const perks = [...Object.entries(earn).filter(([, v]) => v), ...Object.entries(g)];
  const label = { build: '🏗️ Building', ok: '✅ Working', worn: '🟠 Worn: half perk', broken: '🔴 Broken: no perk' };
  const rows = IS_ITEMS.map(it => {
    const s = st.items[it.id], c = isCond(it.id), can = w.lumen >= it.l && w.ember >= it.x;
    let act;
    if (!s) act = `<button class="btn small ${can ? 'primary' : ''}" data-is="build" data-id="${it.id}" ${can ? '' : 'disabled'}>Build · ${isCost(it)}</button>`;
    else if (c === 'build') act = `<span class="muted small-text">Ready ${fmtDate(s.ready)}</span>`;
    else if (c === 'worn' || c === 'broken') { const f = IS_REPAIR[c], ok = w.lumen >= Math.round(it.l * f) && w.ember >= Math.round(it.x * f); act = `<button class="btn small ${ok ? 'primary' : ''}" data-is="repair" data-id="${it.id}" ${ok ? '' : 'disabled'}>Repair · ${isCost(it, f)}</button>`; }
    else { const left = IS_WEAR - isTimeline(it.id).act; act = `<span class="muted small-text">Wears in ${Math.max(1, left)} active day${left === 1 ? '' : 's'}</span>`; }
    return `<div class="isrow ${c || 'none'}"><span class="ise">${it.e}</span><div class="main"><b>${it.n}</b>${s ? ` <span class="tag">${label[c]}</span>` : ''}<div class="muted small-text">${isBuffText(it.b)} · ${it.days} day${it.days === 1 ? '' : 's'} to build</div></div>${act}</div>`;
  }).join('');
  return `${head}<div class="card is3card">
      <div class="is3host" id="is3host"><div class="g3ctl"><button data-is="view" data-v="left" title="Turn left (or drag)">⟲</button><button data-is="view" data-v="right" title="Turn right">⟳</button><button data-is="view" data-v="in" title="Zoom in (or scroll)">＋</button><button data-is="view" data-v="out" title="Zoom out">−</button><button data-is="view" data-v="reset" title="Reset view">⌂</button></div></div>
      ${typeof webglOK === 'function' && webglOK() ? '' : '<p class="muted">This computer can\'t show 3D, but your buildings still work.</p>'}</div>
    <div class="friends-main"><div class="stack"><div class="card"><h3>🔨 Build</h3><p class="muted small-text">Each building takes a few days to finish, then gives a small perk. After ${IS_WEAR} active days it wears (half perk), after ${IS_BREAK} it breaks (no perk) until you repair it. Holidays and the days around exams don't count.</p>${rows}</div></div>
      <div class="stack"><div class="card"><h3>✨ Your island perks</h3>${perks.length ? `<p>${isBuffText(Object.fromEntries(perks))}</p><p class="muted small-text">Battle perks add to your gear on the Character page. Lumen and Ember perks raise what each day's study and training pays.</p>` : '<p class="muted small-text">Build something to get your first perk.</p>'}</div></div></div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-is]'); if (!el) return;
  const st = isState(), it = isItem(el.dataset.id), w = cdWallet();
  switch (el.dataset.is) {
    case 'tab': ui.isTab = el.dataset.v; render(); break;
    case 'view': is3view(el.dataset.v); break;
    case 'build': {
      if (!it || st.items[it.id] || w.lumen < it.l || w.ember < it.x) return;
      if (!confirm(`Build ${it.n} for ${isCost(it)}? It takes ${it.days} day${it.days === 1 ? '' : 's'}.`)) return;
      ftTake(it.l, it.x); st.items[it.id] = { start: today(), ready: addDays(today(), it.days), reps: [] };
      save(); render(); toast(`${it.e} Building ${it.n}`, `Ready ${fmtDate(addDays(today(), it.days))}.`); break;
    }
    case 'repair': {
      const c = isCond(it?.id), f = IS_REPAIR[c]; if (!f) return;
      const l = Math.round(it.l * f), x = Math.round(it.x * f); if (w.lumen < l || w.ember < x) return;
      ftTake(l, x); const s = st.items[it.id]; s.reps = [...(s.reps || []).filter(d => d >= addDays(today(), -400)), today()];
      save(); render(); toast(`${it.e} ${it.n} repaired`, 'Its perk is back to full.'); break;
    }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('[data-is="tab"]')) e.target.closest('[data-is="tab"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });

// ---------- 3D island (three.js, rotate and zoom only, drawn on demand) ----------
const IS3 = { yaw: -.6, pitch: .55, dist: 34, sig: '' };
const IS_PLOTS = [[0, 0], ...[0, 1, 2, 3, 4].map(i => [3.6, i * 72 + 36]), ...[0, 1, 2, 3, 4, 5].map(i => [7, i * 60])].map(([r, a]) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)]);
function is3init() {
  if (IS3.R) return;
  const R = IS3.R = fxRenderer(); R.shadowMap.type = THREE.PCFShadowMap;
  IS3.canvas = R.domElement; IS3.canvas.className = 'g3canvas';
  IS3.scene = new THREE.Scene(); IS3.scene.background = new THREE.Color('#9fd3f5'); IS3.scene.fog = new THREE.Fog('#9fd3f5', 60, 140);
  IS3.cam = new THREE.PerspectiveCamera(40, 1, .5, 300);
  IS3.scene.add(new THREE.HemisphereLight('#ffffff', '#4a7a3a', .75));
  const sun = new THREE.DirectionalLight('#fff4dd', .9); sun.position.set(18, 30, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 }); IS3.scene.add(sun);
  IS3.world = new THREE.Group(); IS3.scene.add(IS3.world);
  const c = IS3.canvas; let drag = null;
  c.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!drag) return; IS3.yaw -= (e.clientX - drag[0]) * .008; IS3.pitch = Math.max(.15, Math.min(1.25, IS3.pitch + (e.clientY - drag[1]) * .006)); drag = [e.clientX, e.clientY]; is3draw(); });
  c.addEventListener('pointerup', () => { drag = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); IS3.dist = Math.max(14, Math.min(70, IS3.dist * (e.deltaY > 0 ? 1.1 : .9))); is3draw(); }, { passive: false });
  new ResizeObserver(() => { if (is3resize()) is3draw(); }).observe(document.body);
}
function is3resize() {
  const h = IS3.canvas?.parentNode; if (!h || !h.clientWidth) return false;
  const sz = h.clientWidth + 'x' + h.clientHeight; if (sz === IS3.sz) return false;
  IS3.sz = sz; IS3.R.setSize(h.clientWidth, h.clientHeight, false); IS3.cam.aspect = h.clientWidth / h.clientHeight; IS3.cam.updateProjectionMatrix(); return true;
}
function is3draw() {
  if (!IS3.R || !IS3.canvas.isConnected || IS3.queued) return;
  IS3.queued = requestAnimationFrame(() => {
    IS3.queued = 0; const { cam, yaw, pitch, dist } = IS3;
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 1, Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(0, 1, 0);
    IS3.R.render(IS3.scene, cam);
  });
}
function is3view(v) {
  if (v === 'left') IS3.yaw += Math.PI / 4; if (v === 'right') IS3.yaw -= Math.PI / 4;
  if (v === 'in') IS3.dist = Math.max(14, IS3.dist * .82); if (v === 'out') IS3.dist = Math.min(70, IS3.dist * 1.2);
  if (v === 'reset') Object.assign(IS3, { yaw: -.6, pitch: .55, dist: 34 });
  is3draw();
}
function mountIsland3D() {
  const host = document.getElementById('is3host');
  if (!host || typeof webglOK !== 'function' || !webglOK()) return;
  is3init();
  if (IS3.canvas.parentNode !== host) host.prepend(IS3.canvas);
  is3resize();
  const st = isState(), sig = IS_ITEMS.map(it => it.id + ':' + (isCond(it.id) || '')).join();
  if (sig !== IS3.sig) { IS3.sig = sig; is3build(st); }
  is3draw();
}
// shared low-poly materials, made once
const is3mat = col => (IS3.mats = IS3.mats || {})[col] || (IS3.mats[col] = new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: .9 }));
function is3mesh(geo, col, x = 0, y = 0, z = 0, g) { const m = new THREE.Mesh(geo, is3mat(col)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (g) g.add(m); return m; }
const is3shade = (col, f) => '#' + new THREE.Color(col).multiplyScalar(f).getHexString();
function is3build() {
  const W = IS3.world;
  W.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  W.clear();
  const rnd = seeded('solis-island');
  // sea, sand, grass and rocky underside
  const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 24), new THREE.MeshStandardMaterial({ color: '#3b9ad9', roughness: .4, flatShading: true }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -.6; sea.receiveShadow = true; W.add(sea);
  is3mesh(new THREE.CylinderGeometry(11.5, 12.5, 1.2, 11), '#e2b86e', 0, -.4, 0, W);
  is3mesh(new THREE.CylinderGeometry(10, 10.8, .9, 11), '#69b34c', 0, .25, 0, W);
  is3mesh(new THREE.CylinderGeometry(12.4, 5, 5, 11), '#7a6a58', 0, -3.4, 0, W);
  // props so it doesn't feel empty: palms, rocks, bushes, a dock and clouds
  const free = (x, z) => IS_PLOTS.every(([px, pz]) => Math.hypot(px - x, pz - z) > 2.1);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = 2 + rnd() * 9, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z)) continue;
    const k = rnd(), g = new THREE.Group(); g.position.set(x, .7, z); g.rotation.y = rnd() * 6;
    if (r > 8.6 && k < .5) { is3mesh(new THREE.CylinderGeometry(.12, .18, 2.6, 5), '#8b5e3c', 0, 1.3, 0, g).rotation.z = .15; for (let j = 0; j < 5; j++) { const lf = is3mesh(new THREE.ConeGeometry(.35, 1.8, 4), '#2f9e44', 0, 2.6, 0, g); lf.rotation.set(1.2, j * 1.26, 0, 'YXZ'); } }
    else if (k < .4) is3mesh(new THREE.DodecahedronGeometry(.3 + rnd() * .5, 0), '#909aa3', 0, .1, 0, g);
    else if (k < .8) is3mesh(new THREE.IcosahedronGeometry(.35 + rnd() * .35, 0), rnd() < .5 ? '#40a447' : '#2b8a3e', 0, .25, 0, g);
    else { is3mesh(new THREE.CylinderGeometry(.03, .03, .4, 3), '#2b8a3e', 0, .2, 0, g); is3mesh(new THREE.OctahedronGeometry(.13, 0), ['#ffd43b', '#f783ac', '#ffffff'][Math.floor(rnd() * 3)], 0, .45, 0, g); }
    W.add(g);
  }
  const dock = new THREE.Group(); dock.position.set(0, -.15, 12.3); is3mesh(new THREE.BoxGeometry(1.6, .15, 3.4), '#a0785a', 0, 0, 0, dock);
  for (const [dx, dz] of [[-.7, 1.5], [.7, 1.5], [-.7, -.2], [.7, -.2]]) is3mesh(new THREE.CylinderGeometry(.1, .1, 1, 5), '#6b4c33', dx, -.4, dz, dock); W.add(dock);
  for (let i = 0; i < 6; i++) { const cl = new THREE.Group(), a = i / 6 * Math.PI * 2; cl.position.set(Math.cos(a) * 30, 12 + rnd() * 6, Math.sin(a) * 30); for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rnd(), 0), is3mat('#ffffff')); s.position.set(j * 1.6 - 1.6, rnd() * .6, rnd()); cl.add(s); } W.add(cl); }
  // buildings on their plots; empty plots get a small dirt patch
  IS_ITEMS.forEach((it, i) => {
    const [x, z] = IS_PLOTS[i], c = isCond(it.id), g = new THREE.Group(); g.position.set(x, .7, z); g.rotation.y = Math.atan2(x, z);
    if (!c) { is3mesh(new THREE.CylinderGeometry(1, 1.05, .08, 7), '#8d6e4c', 0, .02, 0, g); W.add(g); return; }
    if (c === 'build') { is3mesh(new THREE.CylinderGeometry(1.1, 1.1, .08, 7), '#8d6e4c', 0, .02, 0, g); const sc = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 1.8), new THREE.MeshBasicMaterial({ color: '#c08a52', wireframe: true })); sc.position.y = 1; g.add(sc); is3mesh(new THREE.BoxGeometry(.6, .6, .6), '#b07d48', .5, .3, .5, g); W.add(g); return; }
    const f = c === 'ok' ? 1 : c === 'worn' ? .72 : .5;
    is3model(it, g, f);
    if (c !== 'ok') g.rotation.z = c === 'worn' ? .06 : .16;
    if (c === 'broken') for (let j = 0; j < 4; j++) is3mesh(new THREE.DodecahedronGeometry(.18, 0), is3shade(it.col, .5), (rnd() - .5) * 2, .1, (rnd() - .5) * 2, g);
    W.add(g);
  });
}
function is3model(it, g, f) {
  const C = is3shade(it.col, f), D2 = is3shade('#6b4c33', f), S = is3shade('#adb5bd', f);
  const B = (w, h, d, col, x, y, z) => is3mesh(new THREE.BoxGeometry(w, h, d), col, x, y, z, g);
  const Cy = (rt, rb, h, col, x, y, z, s = 7) => is3mesh(new THREE.CylinderGeometry(rt, rb, h, s), col, x, y, z, g);
  const Co = (r, h, col, x, y, z, s = 4) => is3mesh(new THREE.ConeGeometry(r, h, s), col, x, y, z, g);
  switch (it.m) {
    case 'hut': B(1.6, 1.1, 1.4, C, 0, .55, 0); Co(1.3, .9, is3shade('#8f3b1b', f), 0, 1.55, 0).rotation.y = Math.PI / 4; B(.35, .6, .05, D2, 0, .3, .72); break;
    case 'fire': for (let j = 0; j < 4; j++) B(.9, .15, .15, D2, 0, .08, 0).rotation.y = j * .8; Co(.35, .8, is3shade('#ff922b', f), 0, .5, 0, 5); Co(.2, .55, is3shade('#ffd43b', f), 0, .5, 0, 5); for (let j = 0; j < 5; j++) is3mesh(new THREE.DodecahedronGeometry(.16, 0), S, Math.cos(j * 1.26) * .6, .05, Math.sin(j * 1.26) * .6, g); break;
    case 'shrine': B(1.6, .15, .2, C, 0, 1.5, 0); B(1.3, .1, .15, C, 0, 1.2, 0); Cy(.08, .08, 1.5, C, -.55, .75, 0, 5); Cy(.08, .08, 1.5, C, .55, .75, 0, 5); B(.5, .3, .5, S, 0, .15, -.6); break;
    case 'forge': B(1.6, 1, 1.3, is3shade('#495057', f), 0, .5, 0); B(.4, 1.2, .4, S, .5, 1.4, -.3); B(.5, .3, .3, is3shade('#ff6b00', f), 0, .45, .66); break;
    case 'light': for (let j = 0; j < 4; j++) Cy(.55 - j * .07, .6 - j * .07, .7, j % 2 ? is3shade('#e03131', f) : C, 0, .35 + j * .7, 0, 8); Cy(.4, .4, .4, is3shade('#ffe066', f), 0, 3, 0, 8); Co(.5, .5, is3shade('#e03131', f), 0, 3.45, 0, 8); break;
    case 'tower': for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) Cy(.07, .09, 2.2, D2, dx, 1.1, dz, 4); B(1.4, .15, 1.4, C, 0, 2.2, 0); Co(1.1, .7, is3shade('#8f3b1b', f), 0, 2.65, 0).rotation.y = Math.PI / 4; break;
    case 'wall': for (let j = -1; j <= 1; j++) B(.9, .8, .5, j ? C : is3shade(it.col, f * .85), j * .92, .4, 0); for (let j = -1; j <= 1; j++) B(.3, .25, .5, C, j * .92, .92, 0); break;
    case 'mill': Cy(.5, .75, 2, C, 0, 1, 0, 6); Co(.65, .6, is3shade('#8f3b1b', f), 0, 2.3, 0, 6); for (let j = 0; j < 4; j++) { const b = B(.18, 1.4, .05, D2, 0, 1.8, .6); b.rotation.z = j * Math.PI / 2 + .3; b.position.x = Math.sin(j * Math.PI / 2 + .3) * -.7; b.position.y = 1.8 + Math.cos(j * Math.PI / 2 + .3) * .7; } break;
    case 'spring': Cy(1, 1, .25, S, 0, .12, 0, 9); Cy(.8, .8, .28, C, 0, .14, 0, 9); for (let j = 0; j < 3; j++) is3mesh(new THREE.IcosahedronGeometry(.15, 0), '#ffffff', (j - 1) * .3, .55 + j * .15, 0, g); break;
    case 'dome': Cy(.9, .9, .8, is3shade('#dee2e6', f), 0, .4, 0, 8); is3mesh(new THREE.SphereGeometry(.85, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, .8, 0, g); Cy(.12, .16, .9, D2, .3, 1.5, 0, 5).rotation.z = -.8; break;
    case 'totem': for (let j = 0; j < 3; j++) B(.6 - j * .05, .55, .6 - j * .05, j % 2 ? is3shade('#2b8a3e', f) : C, 0, .3 + j * .56, 0); B(1.2, .12, .25, is3shade('#e8590c', f), 0, 1.3, 0); break;
  }
}
