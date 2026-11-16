'use strict';
/* Hex island polish (2.69, roadmap stage 3b and 3c). Loaded after hexworld.js and hxhouse.js.
   - Main buildings wear their own accent colour: a coloured hex plate and a pennant.
   - Hovering a hex shows a small name tag with an icon, a glow on the hex, and a soft tick
     whose pitch depends on the kind of building.
   - Detail on the land: grass tufts, flowers, pebbles, shoreline foam and water shimmer.
   - Clouds fade when they drift in front of the island.
   - Camera: drag turns, right-drag (or Shift+drag) pans. "Lock view" snaps to a tidy angle and
     holds it (dragging then only pans); you can save your own angle for the lock.
   - House island buildings get the house look: a stone plinth and banners in the house colour. */

// ---------- accent colours ----------
function hxAccent(W, f, x, z) {
  const plate = is3mesh(new THREE.CylinderGeometry(1.62, 1.66, .05, 6), f.ac, x, .025, z, W);
  plate.rotation.y = Math.PI / 6; plate.receiveShadow = true; plate.castShadow = false;
  const rim = is3mesh(new THREE.TorusGeometry(1.6, .045, 3, 6), f.ac, x, .06, z, W, true);
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  if (f.id === 'hall') return; // the hall has its orb
  // a pennant on a pole at the back corner
  const g = new THREE.Group(); g.position.set(x + .95, 0, z - .55);
  is3mesh(new THREE.CylinderGeometry(.035, .045, 1.5, 6), '#6b4a2e', 0, .75, 0, g);
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.lineTo(.62, -.14); fl.lineTo(0, -.32); fl.lineTo(0, 0);
  const m = is3mesh(new THREE.ShapeGeometry(fl), f.ac, .02, 1.48, 0, g); m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
  is3mesh(new THREE.SphereGeometry(.06, 8, 6), '#ffe8a3', 0, 1.53, 0, g, true);
  W.add(g); HX3.anim.push({ o: m, wave: Math.random() * 6 });
}

// ---------- house look (stage 3c): stone plinth and house banners ----------
function hxHouseDress(W, it, fp, x, z, col, ink) {
  for (const f of fp) { const [fx, fz] = hxPos(...hxQR(f)), p = is3mesh(new THREE.CylinderGeometry(1.5, 1.6, .16, 6), '#cfc8ba', fx, .08, fz, W); p.rotation.y = Math.PI / 6; p.castShadow = false; }
  if (it.wall) return;
  const tall = /tower|bastion|archer|magetw|beacon/.test(it.id + (it.m || ''));
  for (const sx of tall ? [1] : [1, -1]) {
    const g = hxModel('flag_' + col, col); g.position.set(x + .9 * sx, .16, z + .7); g.scale.setScalar(2.8); W.add(g);
  }
  if (!tall) { const t = hxModel('building_tower_base', col); t.position.set(x - .95, .16, z - .6); t.scale.setScalar(.38); W.add(t); }
}

// ---------- detail on the land ----------
// glues simple geometries into one (positions and normals), so a clump or a flower is one instance
function hxMerge(geos) {
  const ps = [], ns = [];
  for (const g0 of geos) { const g = g0.index ? g0.toNonIndexed() : g0; ps.push(...g.attributes.position.array); ns.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3)); return g;
}
// a soft clump of grass: a few rounded blades (stretched half-spheres) leaning out
function hxClumpGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, g = new THREE.SphereGeometry(.05, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 3.2 + (i % 2) * 1.2, 1); g.rotateZ(Math.cos(a) * .35); g.rotateX(Math.sin(a) * .35); g.translate(Math.cos(a) * .035, 0, Math.sin(a) * .035); parts.push(g); }
  return hxMerge(parts);
}
const hxBushGeo = () => { const p = []; for (const [x, z, r] of [[0, 0, .16], [.11, .05, .11], [-.09, .06, .12], [.02, -.1, .1]]) { const g = new THREE.SphereGeometry(r, 10, 7); g.scale(1, .82, 1); g.translate(x, r * .7, z); p.push(g); } return hxMerge(p); };
const hxPetalGeo = () => { const p = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, g = new THREE.SphereGeometry(.045, 6, 4); g.scale(1.25, .35, .8); g.translate(Math.cos(a) * .045, .17, Math.sin(a) * .045); p.push(g); } return hxMerge(p); };
// a material that sways in the wind: the higher a vertex, the further it moves (one shared clock)
function hxSwayMat(col, amp) {
  HX3.uT = HX3.uT || { value: 0 };
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: .9 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = HX3.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec2 wp = instanceMatrix[3].xz;
      #else
      vec2 wp = vec2(0.0);
      #endif
      float sw = sin(uT * 1.7 + wp.x * .9 + wp.y * .6) + .4 * sin(uT * 2.9 + wp.y * 1.3);
      transformed.x += sw * ${amp.toFixed(3)} * position.y * 6.0; transformed.z += sw * ${(amp * .5).toFixed(3)} * position.y * 6.0;`);
  };
  return m;
}
function hxDetail(W, L, st, rnd, low) {
  if (low) return;
  const tufts = [], flowers = [], pebbles = [], foam = [], shim = [];
  const r2 = seeded('solis-hex-detail' + (hxW(st).seed || '')), lk = typeof hxLook === 'function' ? hxLook(!!hxW(st).home) : {}, tc = .55 / (lk.flN || 1);
  for (const [k, h] of L) {
    const [x, z] = hxPos(...hxQR(k));
    if (h.t === 'water') {
      hxNb(k).forEach((n, i) => { const t = L.get(n)?.t; if (t && t !== 'water') foam.push([x, z, i]); });
      for (let i = 0; i < 2; i++) if (r2() < .5) shim.push([x + (r2() - .5) * 1.4, z + (r2() - .5) * 1.4, i]);
      continue;
    }
    const a = hxAt(k, st); if (a.kind !== 'grass' || a.g) continue;
    const n = 6 + Math.floor(r2() * 5), y0 = hxHt(k, st); // 2.78: lush
    for (let i = 0; i < n; i++) {
      const ang = r2() * 6.28, rr = .35 + r2() * .55, px = x + Math.cos(ang) * rr, pz = z + Math.sin(ang) * rr, v = r2();
      if (v < tc + .15) tufts.push([px, pz, r2(), y0]); else if (v < .9) flowers.push([px, pz, r2(), y0]); else pebbles.push([px, pz, r2(), y0]);
    }
  }
  const inst = (geo, mat, list, place) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { place(o, p); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; W.add(m); return m;
  };
  const tint = (m, list, cols) => { if (!m) return; const c = new THREE.Color(); list.forEach((p, i) => m.setColorAt(i, c.set(cols[Math.floor(p[2] * cols.length) % cols.length]))); m.instanceColor.needsUpdate = true; };
  // 2.78 (feedback F2): soft rounded grass clumps that sway, round bushes, proper flowers and smooth pebbles
  const sway = hxSwayMat;
  const gm = inst(HX3.geoClump || (HX3.geoClump = hxClumpGeo()), sway('#7cc95a', .06), tufts, (o, [x, z, v, y]) => { o.position.set(x, .06 + y, z); o.rotation.set(0, v * 6, 0); o.scale.setScalar(.75 + v * .6); });
  tint(gm, tufts, lk.tuft || ['#7cc95a', '#8fd468', '#68b84b', '#9ad870']);
  const bushes = tufts.filter((p, i) => i % 7 === 3);
  const bm = inst(HX3.geoBush || (HX3.geoBush = hxBushGeo()), sway('#4f9e3c', .025), bushes, (o, [x, z, v, y]) => { o.position.set(x + .12, .05 + y, z - .1); o.rotation.set(0, v * 9, 0); o.scale.setScalar(.8 + v * .5); });
  tint(bm, bushes, (lk.tuft || ['#4f9e3c', '#5cae46', '#468f35']).map(c => '#' + new THREE.Color(c).multiplyScalar(.78).getHexString()));
  const stems = inst(HX3.geoStem || (HX3.geoStem = new THREE.CylinderGeometry(.008, .01, .17, 4).translate(0, .085, 0)), sway('#5c9e3c', .05), flowers, (o, [x, z, v, y]) => { o.position.set(x, .04 + y, z); o.rotation.set(0, v * 6, 0); o.scale.setScalar(.8 + v * .5); });
  const pm = inst(HX3.geoPetal || (HX3.geoPetal = hxPetalGeo()), sway('#ffffff', .05), flowers, (o, [x, z, v, y]) => { o.position.set(x, .04 + y, z); o.rotation.set(0, v * 6, 0); o.scale.setScalar(.8 + v * .5); });
  tint(pm, flowers, lk.fl || ['#ffec99', '#ffa8c5', '#ffffff', '#d0bfff', '#ffc078', '#ff8fab']);
  inst(HX3.geoMid || (HX3.geoMid = new THREE.SphereGeometry(.026, 6, 4).translate(0, .175, 0)), sway('#ffd43b', .05), flowers, (o, [x, z, v, y]) => { o.position.set(x, .04 + y, z); o.rotation.set(0, v * 6, 0); o.scale.setScalar(.8 + v * .5); });
  const peb = inst(HX3.geoPeb || (HX3.geoPeb = new THREE.SphereGeometry(.07, 9, 6)), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85 }), pebbles, (o, [x, z, v, y]) => { o.position.set(x, .015 + y, z); o.rotation.set(0, v * 6, 0); o.scale.set(.7 + v * .6, .38, .55 + v * .4); });
  tint(peb, pebbles, ['#c9c4bb', '#b5b0a8', '#d8d3ca', '#a9a49c']);
  // shoreline foam: a soft strip along each water edge that touches land
  const foamM = new THREE.MeshBasicMaterial({ color: '#f1f8ff', transparent: true, opacity: .55, depthWrite: false });
  inst(new THREE.PlaneGeometry(1.1, .2), foamM, foam, (o, [x, z, i]) => { const a = i * Math.PI / 3; o.position.set(x + Math.cos(a) * .86, -.18, z + Math.sin(a) * .86); o.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2); o.scale.set(1, 1, 1); });
  HX3.anim.push({ o: foamM, shim: 1, base: .5, amp: .18, sp: 1.3, ph: 0 });
  // water shimmer: little glints that fade in and out in three groups
  for (let gI = 0; gI < 3; gI++) {
    const m = new THREE.MeshBasicMaterial({ color: '#e7f5ff', transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending });
    inst(new THREE.PlaneGeometry(.32, .07), m, shim.filter((p, i) => i % 3 === gI), (o, [x, z]) => { o.position.set(x, -.17, z); o.rotation.set(-Math.PI / 2, 0, r2() * 3); });
    HX3.anim.push({ o: m, shim: 1, base: .25, amp: .25, sp: 1.6 + gI * .4, ph: gI * 2.1 });
  }
}

// ---------- clouds fade in front of the island ----------
const HX_V = { c: null, p: null };
function hxCloudFade(a) {
  if (!IS3.cam) return;
  HX_V.c = HX_V.c || new THREE.Vector3(); HX_V.p = HX_V.p || new THREE.Vector3();
  const cam = IS3.cam, R = (hxW(hxCur()).R || HX_R) * 2 + 2, c = HX_V.c.set(IS3.tgt?.[0] || 0, 0, IS3.tgt?.[1] || 0), p = HX_V.p.copy(a.o.position);
  const dc = cam.position.distanceTo(c), dp = cam.position.distanceTo(p);
  c.project(cam); p.project(cam);
  const rScr = R / (dc * Math.tan(cam.fov * Math.PI / 360)), d = Math.hypot((p.x - c.x) * cam.aspect, p.y - c.y);
  // anything nearer the camera than the island's middle fades right out, so clouds never cover the island
  const want = dp < dc * .97 ? 0 : d < rScr * .9 && dp < dc * 1.05 ? .25 * a.op : a.op;
  a.m.opacity += (want - a.m.opacity) * .08; a.o.visible = a.m.opacity > .02;
}

// ---------- hover: name tag, glow, tick ----------
// what a hex shows on hover: [icon, name, accent colour, tick pitch]
const HX_TICK = { cottage: 700, lumber: 330, field: 880, well: 620, store: 360, watermill: 520, mine: 300, mage: 990, forge: 280, windmill: 600, watch: 740, catapult: 340 };
function hxHoverWhat(k) {
  const st = hxCur(), a = hxAt(k, st), W = hxW(st);
  const own = !W.house && !ui.hxVisit; // 2.77: a hint on what you can do here (not when you're only visiting)
  if (a.kind === 'free') return [a.it.e, a.it.n, a.it.ac || W.ac || '#ffd43b', a.it.hz || 523, a.it.at, own ? 'Click to open' : ''];
  if (a.kind === 'b' && !a.it?.wall) return [a.it.e, a.it.n, W.house ? W.ac || '#ffe8a3' : '#ffe8a3', HX_TICK[a.it.id] || 450 + (a.it.n.length * 37) % 400, a.main, W.house ? 'Click for details' : own ? 'Click for details, drag to move' : ''];
  if (a.kind === 'b') return [a.it.e, a.it.n, '#ced4da', 260, a.main, ''];
  if (a.kind === 'deco') return [a.it.e, a.it.n, '#ffd8a8', 560, k, own ? 'Decoration · click to take away' : ''];
  const c = HX_CLEAR || {}, cost = x => x ? hxCost(x.l, x.x) : '';
  if (a.kind === 'tree') return ['🌲', a.tf ? 'Painted forest' : 'Trees', '#8ce99a', 240, k, own ? (a.tf ? 'Counts as forest for a lumber mill · click to clear' : `Blocks building · click to clear (${cost(c.tree)}) · lumber mills like it`) : 'Blocks building'];
  if (a.kind === 'rock') return ['🪨', 'Rocks', '#ced4da', 210, k, own ? `Blocks building · click to clear (${cost(c.rock)})` : 'Blocks building'];
  if (a.kind === 'road') return [a.bridge ? '🌉' : '🛣️', a.bridge ? 'Bridge' : 'Road', '#e9d8a6', 330, k, 'Joins buildings to your hall'];
  if (a.kind === 'river') return ['🌊', 'River', '#74c0fc', 480, k, 'Roads over it become bridges · watermills sit here'];
  if (a.kind === 'water') return ['🌊', 'Water', '#74c0fc', 420, k, 'Too deep to build on'];
  if (a.kind === 'pond') return ['💧', 'Pond', '#74c0fc', 430, k, 'Painted with Terraform'];
  if (a.kind === 'hill') return ['⛰️', 'Hill', '#b8a98a', 280, k, 'Mines like to sit next to it'];
  if (a.kind === 'grass') { const n = { sand: 'Sand', path: 'Path' }[a.g] || 'Grass'; return [a.g === 'sand' ? '🏖️' : a.g === 'path' ? '🟫' : '🌱', n, '#b2f2bb', 360, k, own ? 'Open ground · Build or Terraform here' : 'Open ground']; }
  return null;
}
function hxHoverInfo(k) {
  const what = k && !ui.hxP ? hxHoverWhat(k) : null, key = what ? what[4] : null;
  if (key === HX3.hk) return;
  HX3.hk = key;
  const f = document.getElementById('isfull'); let tag = document.getElementById('hxtag');
  if (!what) { if (tag) tag.remove(); if (HX3.glow) HX3.glow.visible = false; if (IS3.canvas) IS3.canvas.style.cursor = ''; is3draw(); return; }
  if (!tag && f) { tag = document.createElement('div'); tag.id = 'hxtag'; f.appendChild(tag); }
  if (tag) { tag.dataset.k = key; tag.style.setProperty('--ac', what[2]); tag.innerHTML = `<span>${what[0]}</span>${esc(what[1])}${what[5] ? `<small>${esc(what[5])}</small>` : ''}`; }
  if (IS3.canvas) IS3.canvas.style.cursor = 'pointer';
  // the glow: a soft hex of light on the hovered hex (or every hex a big project covers)
  if (!HX3.glow) {
    HX3.glow = new THREE.Group(); HX3.glow.material = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending });
  }
  const g = HX3.glow; g.clear(); g.material.color.set(what[2]);
  const st = hxCur(), a = hxAt(key, st), fp = a.kind === 'b' ? hxFoot(a.it, key) : [key];
  for (const h of fp) {
    const [x, z] = hxPos(...hxQR(h)), m = new THREE.Mesh(HX3.glowGeo || (HX3.glowGeo = new THREE.CircleGeometry(1.12, 6)), g.material);
    m.rotation.set(-Math.PI / 2, 0, Math.PI / 6); m.position.set(x, .09, z); g.add(m);
    const r = new THREE.Mesh(HX3.glowRing || (HX3.glowRing = new THREE.RingGeometry(1.06, 1.16, 6)), g.material); r.rotation.copy(m.rotation); r.position.set(x, .1, z); g.add(r);
  }
  g.visible = true; if (IS3.scene && !IS3.scene.children.includes(g)) IS3.scene.add(g);
  if (typeof sfx === 'function') sfx('hxtick', { gap: 60, f: what[3] });
  hxLoop(); is3draw();
}
// keeps the name tag over its hex (called from is3draw)
function hxTagPos(cam, W, H) {
  const tag = document.getElementById('hxtag'); if (!tag || !tag.dataset.k) return;
  const k = tag.dataset.k, mk = IS3.marks?.[k], [x, z] = hxPos(...hxQR(k));
  const v = new THREE.Vector3(mk ? mk[0] : x, (mk ? mk[1] : 1.4) + .5, mk ? mk[2] : z).project(cam);
  tag.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px) translate(-50%, -100%)`;
}

// ---------- camera: lock view, saved angle, smooth snaps ----------
const HX_ISO = { yaw: Math.PI / 4, pitch: .66 };
const hxLocked = () => !!D.settings.isLock;
const hxLockAngle = () => D.settings.isView || HX_ISO;
function hxTweenTo(to, ms = 450) { HX3.tween = { t0: performance.now(), ms, from: { yaw: IS3.yaw, pitch: IS3.pitch, dist: IS3.dist, tx: IS3.tgt?.[0] || 0, tz: IS3.tgt?.[1] || 0 }, to }; hxLoop(); }
function hxTweenStep(now) {
  const T = HX3.tween, p = Math.min(1, (now - T.t0) / T.ms), e = 1 - Math.pow(1 - p, 3), lerp = (a, b) => a + (b - a) * e;
  // turn the short way round
  let dy = (T.to.yaw ?? T.from.yaw) - T.from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  IS3.yaw = T.from.yaw + dy * e; IS3.pitch = lerp(T.from.pitch, T.to.pitch ?? T.from.pitch); IS3.dist = lerp(T.from.dist, T.to.dist ?? T.from.dist);
  IS3.tgt = [lerp(T.from.tx, T.to.tx ?? T.from.tx), lerp(T.from.tz, T.to.tz ?? T.from.tz)];
  if (p >= 1) HX3.tween = null;
}
function hxViewAct(v) {
  if (v === 'lock') {
    D.settings.isLock = !hxLocked(); save();
    if (D.settings.isLock) { hxTweenTo({ ...hxLockAngle(), tx: 0, tz: 0 }); toast('🔒 View locked', 'Dragging now moves the island around. Scroll still zooms.', { timeout: 2500 }); }
  } else if (v === 'saveview') {
    D.settings.isView = { yaw: IS3.yaw, pitch: IS3.pitch }; D.settings.isLock = true; save();
    toast('📌 Angle saved', 'Lock view now snaps to this angle.', { timeout: 2500 });
  } else if (v === 'reset') hxTweenTo({ ...(hxLocked() ? hxLockAngle() : is3home(IS3.house)), dist: is3home(IS3.house).dist, tx: 0, tz: 0 });
  const c = document.querySelector('#isfull .isctl'); if (c) { const t = document.createElement('div'); t.innerHTML = isCtl(); c.replaceWith(t.firstElementChild); }
  is3draw();
}
// moving the island by dragging: pixels to ground units
function hxPan(dx, dy) {
  const k = IS3.dist * .0009, sy = Math.sin(IS3.yaw), cy = Math.cos(IS3.yaw), t = IS3.tgt || [0, 0];
  const lim = ((hxW(hxCur()).R || HX_R) + 1) * 1.6;
  let x = t[0] - (cy * dx) * k - (sy * dy) * k / Math.max(.5, Math.sin(IS3.pitch)), z = t[1] + (sy * dx) * k - (cy * dy) * k / Math.max(.5, Math.sin(IS3.pitch));
  const d = Math.hypot(x, z); if (d > lim) { x *= lim / d; z *= lim / d; }
  IS3.tgt = [x, z];
}
