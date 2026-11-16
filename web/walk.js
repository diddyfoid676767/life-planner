'use strict';
/* 2.75 walk mode (roadmap stage 5). Press V (or 🚶 Walk) on your island and you
   walk round it as your own character, seen over the shoulder.
   - WASD or the arrow keys move, Shift runs, the mouse turns the camera (click
     the island to lock the mouse, Esc frees it), the wheel zooms, V goes back
     to the builder view.
   - Walk into the Hall, Library, Training hall or Tavern and its interior fades
     in: your character stands at a desk or board in the corner, the mouse is
     free and the page opens beside it. Close the page (✕ or Esc) and you walk
     back out of the door. Other page buildings open their page straight away.
   - The room furniture is from the KayKit Dungeon, Furniture and Restaurant
     packs (CC0), packed by tools/interior-pack.py into hex/rooms.bin, which only
     loads the first time you go inside. The Hall has the magical Solis hearth.
   The camera and controls here are shared with the Souls fights (souls.js). */

const WK_S = .3, WK_SPEED = 2.4, WK_RUN = 4.4; // avatar size on the island, walk and run speed (hex widths are 2)
const WK = { on: false, fig: null, sig: '', x: 0, z: 2.6, y: 0, face: Math.PI, cy: 0, cp: .32, cd: 2.6, keys: {}, raf: 0, t: 0, ph: 0, sp: 0, inside: null, cool: 0, near: null, room: null, fade: 0 };
const WK_ROOMS = {
  hall: { n: 'Hall', floor: 'd_floor_tile_large', spot: [-2.4, -2.2], face: .75, light: '#ffb347' },
  library: { n: 'Library', floor: 'd_floor_wood_large', spot: [-3.4, -2.2], face: .75, light: '#ffd8a8' },
  training: { n: 'Training hall', floor: 'd_floor_tile_large', spot: [-3, -2.8], face: .75, light: '#ffc078' },
  tavern: { n: 'Tavern', floor: 'd_floor_wood_large_dark', spot: [-3.3, -2.4], face: .75, light: '#ff922b' },
};
const wkOk = () => (ui.isTab || 'personal') === 'personal' && !ui.hxVisit && !ui.hxP;
const wkTyping = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// ---------- on and off ----------
function wkToggle(on = !WK.on) {
  if (on && (!window.THREE || !IS3.R || !HX3.kit || !wkOk() || (typeof shell2D === 'function' && shell2D()))) { if (on) toast('🚶 Walk mode', 'Walk mode works on your own island in the 3D view.'); return; }
  if (WK.on === on) return;
  WK.on = on; document.body.classList.toggle('walking', on);
  if (on) {
    Object.assign(ui, { hxSel: null, isPanel: null });
    wkSpawn(); WK.cool = performance.now() + 600;
    WK.y = wkGround(WK.x, WK.z); WK.cam = { fov: IS3.cam.fov, near: IS3.cam.near };
    IS3.cam.fov = 55; IS3.cam.near = .05; IS3.cam.updateProjectionMatrix();
    wkFig(); if (typeof sfx === 'function') sfx('whoosh');
    render(); wkHud(); wkLoop();
  } else {
    if (WK.inside) wkLeave(true);
    if (document.pointerLockElement) document.exitPointerLock();
    if (WK.fig) { IS3.scene.remove(WK.fig); }
    if (WK.cam) { IS3.cam.fov = WK.cam.fov; IS3.cam.near = WK.cam.near; IS3.cam.updateProjectionMatrix(); }
    document.getElementById('wkhud')?.remove(); render(); is3draw();
  }
}
// your character, rebuilt when what you wear changes
function wkFig() {
  const d = typeof youAvData === 'function' ? youAvData(pfSpec()) : { spec: avatarSpec(), gear: {}, cls: '' }, sig = JSON.stringify(d);
  if (WK.fig && WK.sig === sig) { if (!WK.fig.parent) IS3.scene.add(WK.fig); return; }
  if (WK.fig) { IS3.scene.remove(WK.fig); av3dispose(WK.fig); }
  WK.sig = sig; const g = WK.fig = new THREE.Group(), f = av3figure({ ...d.spec, force: '' }, d.gear || {}, d.cls || '');
  f.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(f); g.userData.f = f; IS3.scene.add(g);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
}

// ---------- the island: where you can stand ----------
function wkHex(x, z) { const k = hxFromXZ(x, z); return { k, a: hxAt(k, hxState()) }; }
const WK_WALK = { grass: 1, road: 1, deco: 1, hill: 1 };
function wkStand(x, z) {
  const { k, a } = wkHex(x, z);
  if (WK_WALK[a.kind] || (a.kind === 'b' && a.it?.field)) return { ok: true, k };
  return { ok: false, k, a };
}
// you start on the road just outside the hall, or the nearest open ground to it
function wkSpawn() {
  const [hx, hz] = hxPos(0, 0);
  for (let r = 1.6; r < 14; r += .4) for (let i = 0; i < 24; i++) {
    const a = Math.PI / 2 - i / 24 * Math.PI * 2 * (i % 2 ? -1 : 1) / 2, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
    if ([[0, 0], [.2, 0], [-.2, 0], [0, .2], [0, -.2]].every(([p, q]) => wkStand(x + p, z + q).ok)) { WK.x = x; WK.z = z; WK.face = Math.atan2(x - hx, z - hz); WK.cy = WK.face + Math.PI; return; }
  }
  WK.x = 0; WK.z = 2.6;
}
function wkGround(x, z) { const { k, a } = wkHex(x, z); return (typeof hxHt === 'function' ? hxHt(k, hxState()) : 0) + (a.kind === 'hill' ? .25 : 0); }

// ---------- the loop ----------
function wkLoop() {
  if (WK.raf) return;
  WK.t = performance.now();
  const tick = now => {
    WK.raf = 0; if (!WK.on) return;
    const dt = Math.min(.1, (now - WK.t) / 1000); WK.t = now;
    if (!IS3.canvas?.isConnected) { WK.raf = requestAnimationFrame(tick); return; }
    if (WK.inside) wkRoomTick(now, dt); else wkStep(now, dt);
    wkAnim(now / 1000, dt);
    is3draw();
    WK.raf = requestAnimationFrame(tick);
  };
  WK.raf = requestAnimationFrame(tick);
}
function wkStep(now, dt) {
  if (!wkOk()) { wkToggle(false); return; } // you went to another island
  if (view !== 'islands') { WK.sp = 0; const r = wkRoomOf(view); if (r && !WK.fading && WK.skip !== view) wkEnter(r); return; }
  WK.skip = null; // a building page opened from the HUD: go inside
  const K = WK.keys, fw = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), st = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0);
  let mx = 0, mz = 0;
  if (fw || st) { const c = Math.cos(WK.cy), s = Math.sin(WK.cy); mx = -s * fw + c * st; mz = -c * fw - s * st; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
  const spd = (K.shift ? WK_RUN : WK_SPEED) * (fw || st ? 1 : 0);
  WK.sp += (spd - WK.sp) * Math.min(1, dt * 10);
  if (fw || st) {
    const want = Math.atan2(mx, mz); let d = want - WK.face; d = Math.atan2(Math.sin(d), Math.cos(d)); WK.face += d * Math.min(1, dt * 12);
    const nx = WK.x + mx * WK.sp * dt, nz = WK.z + mz * WK.sp * dt, r = .16;
    const fits = (x, z) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => wkStand(x + a, z + b).ok);
    if (fits(nx, nz)) { WK.x = nx; WK.z = nz; }
    else if (fits(nx, WK.z)) WK.x = nx;
    else if (fits(WK.x, nz)) WK.z = nz;
    const ahead = wkStand(WK.x + mx * .3, WK.z + mz * .3);
    if (!ahead.ok && ahead.a?.kind === 'free' && now > WK.cool) wkDoor(ahead.a.it);
  }
  WK.y += (wkGround(WK.x, WK.z) - WK.y) * Math.min(1, dt * 12);
  // the building you're next to gets a hint
  let near = null;
  for (const f of HX_FREE) { if (!f.at) continue; const [bx, bz] = hxPos(...hxQR(f.at)); if (Math.hypot(bx - WK.x, bz - WK.z) < 2.3) near = f; }
  if (near !== WK.near) { WK.near = near; wkHud(); }
}
// walking into a page building: an interior for the four big ones, the page itself for the rest
function wkDoor(f) {
  WK.cool = performance.now() + 1500;
  if (WK_ROOMS[f.id]) { wkEnter(f.id, f); return; }
  if (document.pointerLockElement) document.exitPointerLock();
  WK.x -= Math.sin(WK.face) * .4; WK.z -= Math.cos(WK.face) * .4;
  if (typeof sfx === 'function') sfx('open');
  hxOpen(f.id); WK.skip = view; // (the market opens the You page's shop: stay outside)
}
const wkRoomOf = v => ({ profile: 'hall', study: 'library', training: 'training', friends: 'tavern' })[v] || null;

// ---------- interiors ----------
const WKR = { kit: null, loading: null, geos: {}, mats: [] };
function wkKit() {
  if (WKR.kit || WKR.loading) return WKR.kit;
  WKR.loading = fetch('hex/rooms.bin').then(r => { if (!r.ok) throw new Error('rooms ' + r.status); return r.arrayBuffer(); }).then(buf => {
    const dv = new DataView(buf), n = dv.getUint32(4, true), idx = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), base = 8 + n;
    return Promise.all(idx.tex.map(([o, l]) => new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = URL.createObjectURL(new Blob([new Uint8Array(buf, base + o, l)], { type: 'image/png' })); })))
      .then(imgs => {
        WKR.mats = imgs.map(img => { const t = new THREE.Texture(img); t.flipY = false; t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: .8, metalness: 0 }); });
        WKR.kit = { buf, base, idx };
        if (WK.inside && !WK.room) wkRoomBuild(WK.inside);
      });
  }).catch(e => { console.error(e); WKR.fail = true; });
  return null;
}
function wkModel(name) {
  const K = WKR.kit, M = K.idx.models[name], g = new THREE.Group(); if (!M) return g;
  M.p.forEach((p, pi) => {
    const key = name + '|' + pi; let geo = WKR.geos[key];
    if (!geo) {
      const o = K.base + p.o, n = p.n, pos = new Float32Array(K.buf.slice(o, o + n * 12)), ni = new Int8Array(K.buf, o + n * 12, n * 4), nrm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { nrm[i * 3] = ni[i * 4] / 127; nrm[i * 3 + 1] = ni[i * 4 + 1] / 127; nrm[i * 3 + 2] = ni[i * 4 + 2] / 127; }
      const u16 = new Uint16Array(K.buf, o + n * 16, n * 2), uv = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) uv[i] = u16[i] / 65535;
      const io = o + n * 20, idx = p.w === 2 ? new Uint16Array(K.buf.slice(io, io + p.i * 2)) : new Uint32Array(K.buf.slice(io, io + p.i * 4));
      geo = WKR.geos[key] = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    }
    const m = new THREE.Mesh(geo, p.c ? is3mat(p.c) : WKR.mats[M.k]); m.castShadow = m.receiveShadow = true; g.add(m);
  });
  return g;
}
// each room: [model, x, z, quarter turns, scale, y]. The room is 12 x 12 with walls at the back (z -6) and left (x -6); the camera looks in from the open front corner.
const WK_FURN = {
  hall: [['d_banner_patternA_red', -.6, -6, 0], ['d_banner_patternA_red', 3.5, -6, 0], ['d_banner_triple_red', -6, 1, 1], ['d_table_long_tablecloth_decorated_A', 2, -1, 1], ['d_chair', -.2, -1, 1], ['d_chair', 4.2, -1, 3],
    ['d_chest_gold', -5, 2.8, 1], ['d_sword_shield_gold', -5.9, -3.2, 1, 1, 2.2], ['f_rug_rectangle_stripes_A', -2.6, -2.4, 0, 1.2], ['f_pictureframe_standing_A', -4.6, -4.8, .5, 1.6], ['d_torch_mounted', -6, -1.2, 1, 1, 2.4], ['d_torch_mounted', 2, -6, 0, 1, 2.4],
    ['f_armchair', 3.6, 3.6, 2.5], ['d_candle_triple', 2, -1, 0, 1, 1.89], ['d_pillar_decorated', 5.6, -5.6, 0, .8]],
  library: [['f_shelf_B_large_decorated', -6, -3.6, 1, 1.4, .4], ['f_shelf_B_large_decorated', -6, -3.6, 1, 1.4, 1.6], ['f_shelf_B_large_decorated', -6, 0, 1, 1.4, .4], ['f_shelf_B_large_decorated', -6, 0, 1, 1.4, 1.6], ['d_shelves', 2.5, -6, 0, 1.2], ['d_shelves', -1, -6, 0, 1.2],
    ['f_table_medium_long', -3.4, -3.6, 0, .9], ['f_chair_A_wood', -3.4, -4.7, 0], ['f_lamp_table', -4.3, -3.6, 0, .6, .9], ['f_book_set', -2.6, -3.4, .3, 1, 1.15], ['f_book_single', -3, -3.1, 1.2, 1, 1.15], ['f_rug_oval_A', 1, 1, 0, 1.4],
    ['f_armchair', 2.4, 1.6, 2.6], ['f_lamp_standing', 4.2, 2.6, 0], ['d_candle_lit', -5.2, 3.6, 0, .8], ['d_table_small_decorated_A', 4.8, -4.8, 0], ['f_cabinet_medium_decorated', -5.4, 4, 1]],
  training: [['d_banner_shield_green', -3, -6, 0], ['d_banner_thin_yellow', 2.5, -6, 0], ['weaponrack', -5.4, -2, 1, 1.8], ['weaponrack', -5.4, 1.6, 1, 1.8], ['target', 3.6, -5, 0, 1.8], ['d_barrel_large', 5, -2, 0, .7], ['d_crates_stacked', 4.6, 2.6, 2, .8],
    ['d_sword_shield', -6, 4.2, 1, 1, 2.2], ['f_rug_rectangle_A', 0, 0, 1, 1.6], ['d_box_stacked', -4.6, 4.4, 1, .5], ['d_torch_mounted', -6, -4.4, 1, 1, 2.4], ['d_torch_mounted', 0, -6, 0, 1, 2.4], ['d_table_medium', -3, -4.4, 0, .9], ['d_bottle_A_green', -3.2, -4.4, 0, 1, .9]],
  tavern: [['d_table_long_decorated_A', -3.2, -3.6, 1], ['d_keg_decorated', 2.6, -5.2, 0, .9], ['d_barrel_large', 5.2, -4.6, 0, .7], ['d_barrel_small_stack', -5.2, 1, 1, .9], ['r_table_round_A_decorated', 2, 1.2, 0, .9], ['r_chair_B', 2, 3, 2], ['r_chair_B', 3.9, 1.2, 3], ['r_chair_B', .1, 1.2, 1],
    ['d_stool', -1.8, -1.6, 0], ['d_stool', -4.4, -1.6, 0], ['d_shelf_small_candles', -6, -3, 1, 1, 2.3], ['d_bottle_A_green', 4.4, -4.5, 0, .8, 1.4], ['d_bottle_B_brown', 5.6, -4.5, 0, .8, 1.4], ['r_stew_pot', -2, -3.4, 0, 1.4, .85], ['d_plate_food_A', -4.2, -3.8, 0, 1, .85],
    ['d_torch_mounted', -6, -.8, 1, 1, 2.4], ['d_torch_mounted', -.6, -6, 0, 1, 2.4], ['f_rug_oval_A', 2, 1.2, 0, 1.3], ['d_banner_patternB_blue', 5.4, -6, 0, .8]],
};
function wkRoomBuild(id) {
  if (!wkKit()) return false;
  const R = WK_ROOMS[id], g = WK.room = new THREE.Group(), add = (m, x, z, r = 0, s = 1, y = 0) => { const o = m.startsWith('d_') || m.startsWith('f_') || m.startsWith('r_') ? wkModel(m) : hxModel(m, 'blue'); o.position.set(x, y, z); o.rotation.y = -r * Math.PI / 2; o.scale.setScalar(s); g.add(o); return o; };
  WK.lights = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) add(R.floor, i * 4, j * 4);
  for (let i = -1; i <= 1; i++) { add(i === 1 && id !== 'library' ? 'd_wall_window_open' : 'd_wall', i * 4, -6.5); add(i === 1 ? 'd_wall_doorway' : i === -1 && id === 'hall' ? 'd_wall' : 'd_wall_window_open', -6.5, i * 4, 1); }
  add('d_wall_corner', -6.5, -6.5, 0);
  for (const f of WK_FURN[id]) add(...f);
  if (id === 'hall') wkHearth(g);
  if (id === 'training') for (const [x, z] of [[1.4, -3.4], [-1, -2.6]]) wkDummy(g, x, z);
  // warm light from the torches and candles, and a soft fill so night-time rooms aren't black
  const hl = new THREE.HemisphereLight('#ffe8cc', '#3b2a1f', .55); g.add(hl);
  const pl = new THREE.PointLight(R.light, 1.4, 16, 1.6); pl.position.set(-2.5, 3.2, -2.5); g.add(pl); WK.lights.push(pl);
  const pl2 = new THREE.PointLight('#fff1d6', .6, 18, 1.4); pl2.position.set(3, 4, 3); g.add(pl2);
  g.scale.setScalar(.25); g.position.set(0, 0, 0); IS3.scene.add(g);
  return true;
}
// the Hall's magical hearth: a stone fireplace with the Solis orb burning in it
function wkHearth(g) {
  const h = new THREE.Group(); h.position.set(-3.3, 0, -5.6); g.add(h);
  is3mesh(new THREE.BoxGeometry(3.4, .5, 1.4), '#8a8199', 0, .25, 0, h);
  for (const s of [-1, 1]) is3mesh(new THREE.BoxGeometry(.6, 2.6, 1.2), '#9d94ad', s * 1.4, 1.5, 0, h);
  is3mesh(new THREE.BoxGeometry(3.8, .5, 1.5), '#7d748c', 0, 3, 0, h);
  is3mesh(new THREE.BoxGeometry(2.2, 1.6, .2), '#2b2233', 0, 1.3, -.45, h);
  const orb = is3mesh(new THREE.IcosahedronGeometry(.55, 1), '#ffb347', 0, 1.5, .1, h, true), ring = is3mesh(new THREE.TorusGeometry(.85, .05, 4, 24), '#ffe8a3', 0, 1.5, .1, h, true);
  const fl = []; for (let i = 0; i < 7; i++) { const f = is3mesh(new THREE.ConeGeometry(.16 + Math.random() * .1, .6 + Math.random() * .4, 5), i % 2 ? '#ff922b' : '#ffd43b', (i - 3) * .24, .8, .15, h, true); f.castShadow = false; fl.push(f); }
  const pl = new THREE.PointLight('#ffb347', 2.2, 14, 1.6); pl.position.set(0, 1.6, .8); h.add(pl); WK.lights.push(pl);
  WK.hearth = { orb, ring, fl, pl };
}
function wkDummy(g, x, z) {
  const d = new THREE.Group(); d.position.set(x, 0, z); g.add(d);
  is3mesh(new THREE.CylinderGeometry(.08, .08, 1.6, 6), '#6b4c33', 0, .8, 0, d); is3mesh(new THREE.CylinderGeometry(.4, .35, 1, 8), '#c9a46a', 0, 1.6, 0, d);
  is3mesh(new THREE.SphereGeometry(.3, 10, 8), '#d8bb8f', 0, 2.35, 0, d); is3mesh(new THREE.BoxGeometry(1.4, .14, .14), '#6b4c33', 0, 1.8, 0, d);
}
function wkEnter(id) {
  if (WK.inside === id) return;
  if (document.pointerLockElement) document.exitPointerLock();
  const from = WK.inside;
  wkFade(() => {
    if (from) wkRoomRemove();
    WK.inside = id; if (!from) WK.out = { x: WK.x, z: WK.z, face: WK.face };
    IS3.world.visible = false; document.body.classList.add('wk-in');
    wkRoomBuild(id);
    const R = WK_ROOMS[id]; WK.fig.position.set(R.spot[0] * .25, 0, R.spot[1] * .25); WK.fig.rotation.y = R.face; WK.fig.scale.setScalar(.25 * 1.15); WK.sp = 0;
    const page = HX_FREE.find(f => f.id === id)?.open;
    if (page && view !== page) { view = page; window.scrollTo(0, 0); render(); }
    if (typeof sfx === 'function') sfx('open');
    wkHud(); wkResize();
  });
}
function wkRoomRemove() {
  if (!WK.room) return;
  IS3.scene.remove(WK.room); WK.room.traverse(o => { if (o.geometry && !Object.values(WKR.geos).includes(o.geometry)) o.geometry.dispose(); }); WK.room = null; WK.hearth = null; WK.lights = [];
}
function wkLeave(now) {
  const go = () => {
    wkRoomRemove(); WK.inside = null; IS3.world.visible = true; document.body.classList.remove('wk-in');
    // back out of the door you came in through
    const o = WK.out || {}; WK.face = (o.face || 0) + Math.PI; WK.x = (o.x ?? WK.x) - Math.sin(o.face || 0) * .2; WK.z = (o.z ?? WK.z) - Math.cos(o.face || 0) * .2; WK.cy = WK.face + Math.PI;
    wkFig(); WK.fig.scale.setScalar(WK_S); WK.cool = performance.now() + 1200; wkResize(); wkHud();
  };
  if (now) go(); else wkFade(go);
}
// the room camera sits in the open corner; the view is shifted so you stand to the left of the page
function wkRoomTick(now, dt) {
  const want = view === 'islands' ? null : wkRoomOf(view);
  if (!want && view === 'islands') { wkLeave(); return; }
  if (want && want !== WK.inside && !WK.fading) { wkEnter(want); return; }
  if (!WK.room && WKR.kit) wkRoomBuild(WK.inside);
  const H = WK.hearth, t = now / 1000;
  if (H) { H.orb.position.y = 1.5 + Math.sin(t * 1.5) * .1; H.ring.rotation.set(1.2 + Math.sin(t * .7) * .3, t * .8, 0); H.fl.forEach((f, i) => { f.scale.y = .7 + Math.abs(Math.sin(t * 7 + i * 1.7)) * .6; }); H.pl.intensity = 2 + Math.sin(t * 9) * .25 + Math.sin(t * 13) * .15; }
  for (const l of WK.lights || []) if (l !== H?.pl) l.intensity = 1.3 + Math.sin(t * 8 + l.id) * .08;
}
function wkFade(fn) {
  let f = document.getElementById('wkfade'); if (!f) { f = document.createElement('div'); f.id = 'wkfade'; document.body.appendChild(f); }
  WK.fading = true; f.classList.add('on');
  setTimeout(() => { try { fn(); } finally { setTimeout(() => { f.classList.remove('on'); WK.fading = false; }, 60); } }, 260);
}
function wkResize() {
  const cam = IS3.cam; if (!cam) return;
  if (WK.inside && IS3.canvas) { const w = IS3.canvas.clientWidth, h = IS3.canvas.clientHeight; if (w && h) cam.setViewOffset(w, h, w * .27, 0, w, h); }
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}

// ---------- the camera (called from is3draw) ----------
function wkCam(cam) {
  if (!WK.on || !WK.fig) return false;
  if (WK.inside) {
    const R = WK_ROOMS[WK.inside], s = .25, [sx, sz] = R.spot;
    cam.position.set((sx + 7.6) * s, 6.2 * s, (sz + 8.6) * s); cam.lookAt(sx * s - .15, 1.1 * s, sz * s - .25);
    return true;
  }
  const tx = WK.x, ty = WK.y + .55, tz = WK.z, d = WK.cd, cp = WK.cp;
  let px = tx + Math.sin(WK.cy) * Math.cos(cp) * d, py = ty + Math.sin(cp) * d, pz = tz + Math.cos(WK.cy) * Math.cos(cp) * d;
  const side = .32; px += Math.cos(WK.cy) * side; pz -= Math.sin(WK.cy) * side; // over the right shoulder
  // pull the camera in front of anything between it and you (buildings, trees, rocks)
  for (let f = .15; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f, a = wkHex(x, z).a; if (!WK_WALK[a.kind] && a.kind !== 'off' && a.kind !== 'water' && a.kind !== 'river' && a.kind !== 'pond' && !(a.kind === 'b' && a.it?.field)) { const k = Math.max(.12, f - .12); px = tx + (px - tx) * k; py = ty + (py - ty) * k; pz = tz + (pz - tz) * k; break; } }
  py = Math.max(py, wkGround(px, pz) + .25);
  cam.position.set(px, py, pz); cam.lookAt(tx + Math.cos(WK.cy) * side, ty, tz - Math.sin(WK.cy) * side);
  return true;
}
// walking: legs and arms swing with your speed; standing: a gentle breath
function wkAnim(t, dt) {
  const g = WK.fig; if (!g) return;
  if (!WK.inside) { g.position.set(WK.x, WK.y, WK.z); g.rotation.y = WK.face; g.scale.setScalar(WK_S); }
  const P = g.userData.f?.userData?.P; if (!P) return;
  const v = WK.inside ? 0 : WK.sp; WK.ph += dt * (4 + v * 2.6);
  const sw = Math.min(1, v / WK_SPEED) * (v > WK_SPEED + .5 ? .95 : .7), s = Math.sin(WK.ph);
  P.legs[0].rotation.x = s * sw; P.legs[1].rotation.x = -s * sw;
  P.arms[0].rotation.x = -s * sw * .9; P.arms[1].rotation.x = s * sw * .9;
  g.userData.f.position.y = Math.abs(Math.cos(WK.ph)) * .06 * sw;
  const b = Math.sin(t * 2); P.chest.scale.y = 1 + b * .012 * (1 - sw); P.head.position.y = AV3_STYLE.headY + b * .012;
  const bl = (t % 4.2) < .12 ? .12 : 1; for (const e of P.eyes || []) e.scale.y = bl;
  if (P.charm) { P.charm.position.y = 1.45 + Math.sin(t * 1.6) * .06; P.charm.rotation.y = t; }
  if (P.pet) P.pet.position.y = .28 + Math.abs(Math.sin(t * 3)) * .1;
}

// ---------- the walk HUD ----------
function wkHud() {
  let h = document.getElementById('wkhud');
  if (!WK.on || WK.inside) { h?.remove(); return; }
  if (!h) { h = document.createElement('div'); h.id = 'wkhud'; document.body.appendChild(h); }
  const n = WK.near, room = n && WK_ROOMS[n.id];
  h.innerHTML = `${n ? `<div class="wk-near">${n.e} <b>${esc(n.n)}</b><span>${room ? 'Walk in to go inside' : `Walk in to open ${esc(n.d.toLowerCase())}`}</span></div>` : ''}
    <div class="wk-keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> run</span><span>${document.pointerLockElement ? '<kbd>Esc</kbd> free the mouse' : 'Click to steer with the mouse'}</span><button type="button" class="btn small" data-wk="off"><kbd>V</kbd> Builder view</button></div>`;
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || wkTyping(e.target) || (typeof SO !== 'undefined' && SO)) return;
  const k = e.key.toLowerCase();
  if (k === 'v' && !e.repeat && (view === 'islands' || WK.on) && !document.querySelector('dialog[open]')) {
    if (WK.inside) return; // inside, V does nothing: close the page to walk out
    e.preventDefault(); e.stopImmediatePropagation(); wkToggle(); return;
  }
  if (!WK.on || WK.inside || view !== 'islands') return;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { WK.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  else if (k === 'escape' && !document.pointerLockElement && !ui.isPanel) { e.preventDefault(); e.stopImmediatePropagation(); wkToggle(false); }
}, true);
addEventListener('keyup', e => { WK.keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') WK.keys.shift = false; }, true);
addEventListener('blur', () => { WK.keys = {}; });
// the mouse turns the camera: locked after a click, or by dragging
addEventListener('pointerdown', e => {
  if (!WK.on || WK.inside || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!document.pointerLockElement && IS3.canvas.requestPointerLock) { try { const p = IS3.canvas.requestPointerLock(); if (p?.catch) p.catch(() => { }); } catch (er) { } }
  WK.drag = [e.clientX, e.clientY];
}, true);
addEventListener('pointermove', e => {
  if (!WK.on || WK.inside || view !== 'islands') return;
  let dx = 0, dy = 0;
  if (document.pointerLockElement === IS3.canvas) { dx = e.movementX; dy = e.movementY; }
  else if (WK.drag && e.buttons) { dx = e.clientX - WK.drag[0]; dy = e.clientY - WK.drag[1]; WK.drag = [e.clientX, e.clientY]; }
  else return;
  e.stopImmediatePropagation();
  WK.cy -= dx * .0042; WK.cp = Math.max(-.15, Math.min(1.1, WK.cp + dy * .0035));
}, true);
addEventListener('pointerup', e => { if (WK.on && WK.drag) { WK.drag = null; if (!WK.inside && view === 'islands') e.stopImmediatePropagation(); } }, true);
addEventListener('wheel', e => { if (!WK.on || WK.inside || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return; e.stopImmediatePropagation(); e.preventDefault(); WK.cd = Math.max(1.4, Math.min(6, WK.cd * (e.deltaY > 0 ? 1.1 : .9))); }, { capture: true, passive: false });
document.addEventListener('pointerlockchange', () => wkHud());
addEventListener('resize', () => { if (WK.on) setTimeout(wkResize, 50); });
document.addEventListener('click', e => { const el = e.target.closest('[data-wk]'); if (!el) return; e.preventDefault(); wkToggle(el.dataset.wk === 'on' ? true : el.dataset.wk === 'off' ? false : undefined); });
