'use strict';
/* Low-poly 3D models for the garden: every tree species, decoration, animal
   and critter, built from simple shapes so it all runs offline with no model
   files. Each builder returns a THREE.Group with its base at y = 0. A tile is
   2 units wide; a full-grown tree is about 2.6 units tall. Moving parts
   (windmill blades, flames, flags, water) put a tick(t) on group.userData. */

const M3 = { mats: new Map() };
// smooth versions of the basic shapes: more segments, so models look rounded rather than faceted
const CylG = (rt, rb, h, seg = 8, hs = 1, open = false, t0, tl) => new THREE.CylinderGeometry(rt, rb, h, Math.max(16, seg * 2), hs, open, t0, tl);
const ConeG = (r, h, seg = 8, hs = 1, open = false, t0, tl) => new THREE.ConeGeometry(r, h, Math.max(16, seg * 2), hs, open, t0, tl);
const IcoG = (r, d = 1) => new THREE.IcosahedronGeometry(r, Math.min(4, d + 2));
const SphG = (r, ws = 12, hs = 8, ...rest) => new THREE.SphereGeometry(r, Math.max(24, ws * 2), Math.max(16, hs * 2), ...rest);
const TorG = (r, tube, rs = 8, ts = 16, arc) => new THREE.TorusGeometry(r, tube, Math.max(12, rs * 2), Math.max(32, ts * 2), arc);

function m3mat(color, o = {}) {
  const key = [color, o.metal || 0, o.rough ?? .85, o.emi || '', o.ei ?? 1, o.op ?? 1, o.flat === true ? 1 : 0].join('|');
  let m = M3.mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: o.flat === true, roughness: o.rough ?? .85, metalness: o.metal || 0,
      emissive: o.emi || 0x000000, emissiveIntensity: o.ei ?? 1, transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1 });
    M3.mats.set(key, m);
  }
  return m;
}
function m3clear() { for (const m of M3.mats.values()) m.dispose(); M3.mats.clear(); }
function m3mesh(geo, color, o = {}) { const m = new THREE.Mesh(geo, m3mat(color, o)); m.castShadow = o.cast !== false; m.receiveShadow = true; return m; }
const at = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); return m; };
// shapes with their base on y (not their centre)
const cyl = (rt, rb, h, col, x, y, z, seg = 7, o) => at(m3mesh(CylG(rt, rb, h, seg).translate(0, h / 2, 0), col, o), x, y, z);
const cone = (r, h, col, x, y, z, seg = 8, o) => at(m3mesh(ConeG(r, h, seg).translate(0, h / 2, 0), col, o), x, y, z);
const box = (w, h, d, col, x, y, z, o) => at(m3mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), col, o), x, y, z);
function ball(r, col, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) { const m = at(m3mesh(IcoG(r, o.detail ?? 1), col, o), x, y, z); m.scale.set(sx, sy, sz); return m; }
const sph = (r, col, x, y, z, o = {}) => at(m3mesh(SphG(r, o.seg || 12, o.seg ? o.seg * .7 : 8, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI), col, o), x, y, z);
// a limb from (x,y,z), leaning by ax (towards x) and az (towards z) radians
function limb(r1, r2, len, col, x, y, z, ax, az, seg = 6) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.set(az, 0, -ax);
  p.add(cyl(r2, r1, len, col, 0, 0, 0, seg)); return p;
}
const tipOf = (len, x, y, z, ax, az) => [x + Math.sin(ax) * len, y + Math.cos(ax) * Math.cos(az) * len, z + Math.sin(az) * len];
const grp = (...kids) => { const g = new THREE.Group(); kids.flat().forEach(k => k && g.add(k)); return g; };
const BARK3 = '#8a5a3b', BARK3D = '#6d4530';

// ---------- trees ----------
function canopy(col, pts, rnd, scale = 1, o) {
  const dk = shade(col, -.25), lt = shade(col, .25);
  return pts.map(([x, y, z, r], i) => ball(r * scale * (.9 + rnd() * .2), [col, dk, lt][i % 3 === 2 ? 2 : i % 2], x, y, z, 1, .85 + rnd() * .2, 1, o));
}
const ringPts = (n, rad, y, r, rnd, jit = .15) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + rnd(); return [Math.cos(a) * rad, y + (rnd() - .5) * jit * 2, Math.sin(a) * rad, r]; });
const blobTree = (col, rnd, h = 1.1, o) => {
  const pts = [[0, h + .75, 0, .62], ...ringPts(5, .45, h + .4, .45, rnd), ...ringPts(3, .25, h + 1.05, .38, rnd)];
  return { parts: [cyl(.1, .17, h + .3, BARK3, 0, 0, 0), limb(.06, .09, .55, BARK3, 0, h * .6, 0, .7, .2), limb(.06, .09, .5, BARK3, 0, h * .7, 0, -.6, -.3), ...canopy(col, pts, rnd, 1, o)], fruit: pts };
};
const T3 = {
  oak: (c, r) => blobTree(c, r),
  apple(c, r) { const t = blobTree(c, r, 1); t.parts.push(...t.fruit.slice(1, 8).map(([x, y, z]) => ball(.08, '#e03131', x * 1.25, y - .15, z * 1.25, 1, 1, 1, { detail: 0 }))); return t; },
  maple(c, r) { const pts = [[0, 1.85, 0, .6], ...ringPts(6, .55, 1.45, .45, r)]; return { parts: [cyl(.09, .15, 1.4, BARK3, 0, 0, 0), ...pts.map(([x, y, z, rr], i) => at(m3mesh(IcoG(rr, 0), i % 2 ? c : shade(c, -.2)), x, y, z))], fruit: pts }; },
  cherry(c, r) { const t = blobTree(c, r, 1, {}); t.parts[0].material = m3mat(BARK3D); t.parts.push(...t.fruit.flatMap(([x, y, z]) => [ball(.06, '#fff', x * 1.3, y + .1, z * 1.3, 1, 1, 1, { detail: 0 }), ball(.05, '#ffdeeb', x * 1.2, y - .2, z * 1.3, 1, 1, 1, { detail: 0 })])); return t; },
  birch(c, r) {
    const parts = [cyl(.08, .11, 1.9, '#f1efe9', 0, 0, 0)]; for (let i = 0; i < 6; i++) parts.push(box(.1 + r() * .06, .03, .2, '#3d3a36', (r() - .5) * .08, .2 + i * .26, 0));
    parts.push(ball(.55, shade(c, -.2), 0, 2, 0, .85, 1.5, .85), ball(.45, c, -.1, 2.1, .1, .85, 1.4, .85));
    return { parts, fruit: [[0, 2.5, 0], [.3, 2, .2], [-.3, 1.8, -.1]] };
  },
  ghostgum(c, r) {
    const parts = [cyl(.08, .13, 1.2, '#f1f3f5', 0, 0, 0)], fruit = [];
    for (const [ax, az] of [[.6, .1], [-.5, .3], [.1, -.6], [-.1, .5]]) { parts.push(limb(.05, .08, .9, '#f1f3f5', 0, 1, 0, ax, az)); const [x, y, z] = tipOf(.9, 0, 1, 0, ax, az); parts.push(ball(.38, c, x, y + .12, z, 1.2, .6, 1.2), ball(.25, shade(c, .25), x, y + .25, z, 1.2, .6, 1.2)); fruit.push([x, y + .2, z]); }
    return { parts, fruit };
  },
  pine(c) { const parts = [cyl(.09, .13, .5, BARK3, 0, 0, 0)]; [[.85, .4, 1], [.7, 1, .95], [.5, 1.55, .85]].forEach(([rr, y, h], i) => parts.push(cone(rr, h, i % 2 ? c : shade(c, -.2), 0, y, 0, 8))); return { parts, fruit: [[.4, .8, .3], [-.3, 1.3, .2], [.1, 2, -.2]] }; },
  fir(c) { const parts = [cyl(.08, .12, .4, BARK3D, 0, 0, 0)]; [[.8, .3], [.66, .8], [.5, 1.3], [.34, 1.75]].forEach(([rr, y]) => { parts.push(cone(rr, .75, c, 0, y, 0, 9), cone(rr * .55, .3, '#ffffff', 0, y + .45, 0, 9)); }); return { parts, fruit: [[.4, .6, .3], [-.3, 1.1, .2], [0, 2.3, 0]] }; },
  spruce(c) { const b = '#4c8fa8', parts = [cyl(.08, .12, .4, BARK3D, 0, 0, 0)]; for (let i = 0; i < 6; i++) parts.push(cone(.82 - i * .12, .6, i % 2 ? b : shade(b, -.15), 0, .3 + i * .33, 0, 10)); return { parts, fruit: [[.4, .7, .3], [-.3, 1.2, .2], [0, 2.4, 0]] }; },
  cypress(c) { return { parts: [cyl(.06, .09, .3, BARK3, 0, 0, 0), ball(.42, shade(c, -.15), 0, 1.35, 0, 1, 2.6, 1), ball(.33, c, -.08, 1.45, .08, 1, 2.6, 1)], fruit: [[.2, 1, .25], [-.2, 1.6, .2], [0, 2.3, 0]] }; },
  poplar(c) { return { parts: [cyl(.06, .1, .45, BARK3, 0, 0, 0), ball(.36, shade(c, -.1), 0, 1.5, 0, 1, 3, 1), ball(.24, shade(c, .25), .1, 1.6, .12, 1, 2.6, 1)], fruit: [[.2, 1.2, .2], [-.15, 1.8, .2], [0, 2.4, 0]] }; },
  redwood(c) { const parts = [cyl(.12, .24, 2.8, '#a0522d', 0, 0, 0, 8)]; for (let i = 0; i < 6; i++) parts.push(cone(.62 - i * .07, .5, i % 2 ? c : shade(c, -.2), 0, 1 + i * .32, 0, 8)); return { parts, fruit: [[.35, 1.3, .3], [-.3, 1.9, .2], [0, 2.8, 0]] }; },
  willow(c, r) {
    const parts = [cyl(.1, .17, 1.3, BARK3, 0, 0, 0), ball(.75, shade(c, -.15), 0, 1.6, 0, 1, .55, 1), ball(.55, shade(c, .2), 0, 1.75, 0, 1, .5, 1)];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = .55 + r() * .15, len = .7 + r() * .4; parts.push(cyl(.035, .025, len, i % 2 ? c : shade(c, .15), Math.cos(a) * rr, 1.62 - len, Math.sin(a) * rr, 4)); }
    return { parts, fruit: [[.4, 1.6, .3], [-.3, 1.7, .2], [0, 1.9, 0]] };
  },
  palm(c) {
    const parts = []; let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { const s = limb(.07, .085, .38, i % 2 ? BARK3 : BARK3D, x, y, 0, .08 + i * .03, 0); parts.push(s); [x, y] = tipOf(.38, x, y, 0, .08 + i * .03, 0); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, f = new THREE.Group(); f.position.set(x, y, 0); f.rotation.y = a; const leaf = ball(.42, i % 2 ? c : shade(c, -.2), .4, -.08, 0, 1.3, .12, .35); leaf.rotation.z = -.35; f.add(leaf); parts.push(f); }
    parts.push(ball(.08, '#6b4b2a', x + .06, y - .1, .06, 1, 1, 1, { detail: 0 }), ball(.08, '#6b4b2a', x - .05, y - .1, -.05, 1, 1, 1, { detail: 0 }));
    return { parts, fruit: [[x + .5, y, 0], [x - .5, y, .1], [x, y, .5]] };
  },
  cactus(c) {
    const p = [cyl(.22, .24, 1.4, c, 0, 0, 0, 10), sph(.22, c, 0, 1.4, 0, { half: true }), cyl(.1, .1, .45, c, .45, .55, 0, 8), sph(.1, c, .45, 1, 0, { half: true }), box(.25, .14, .14, c, .3, .5, 0),
      cyl(.09, .09, .35, shade(c, -.15), -.42, .75, 0, 8), sph(.09, shade(c, -.15), -.42, 1.1, 0, { half: true }), box(.22, .12, .12, shade(c, -.15), -.3, .7, 0)];
    return { parts: p, fruit: [[0, 1.65, 0], [.45, 1.12, 0], [-.42, 1.2, 0]] };
  },
  mushroom(c) {
    const cap = at(m3mesh(SphG(.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .7, 1), c), 0, 1.3, 0);
    const dots = [[.4, 1.75, .2], [-.3, 1.7, .4], [.1, 1.85, -.3], [-.5, 1.6, -.2], [.55, 1.55, -.3]].map(([x, y, z]) => ball(.1, '#fff', x, y, z, 1, .5, 1, { detail: 0 }));
    return { parts: [cyl(.2, .25, 1.35, '#f8f0e3', 0, 0, 0, 10), cap, ...dots], fruit: [[.6, 1.3, 0], [-.6, 1.3, 0], [0, 1.3, .6]] };
  },
  glowshroom() {
    const c = '#22b8cf', parts = [];
    [[0, 0, 1, 1.3], [.55, .25, .55, .7], [-.5, -.2, .45, .55]].forEach(([x, z, s, h]) => { parts.push(cyl(.12 * s, .16 * s, h, '#e3fafc', x, 0, z, 8, { emi: '#3bc9db', ei: .25 })); parts.push(at(m3mesh(SphG(.6 * s, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .6, 1), c, { emi: '#66d9e8', ei: .7 }), x, h, z)); });
    return { parts, fruit: [[0, 1.6, 0], [.55, .9, .25], [-.5, .7, -.2]], glow: '#66d9e8' };
  },
  baobab(c) {
    const parts = [cyl(.32, .42, 1.3, '#a47148', 0, 0, 0, 9)];
    for (const [ax, az] of [[.7, 0], [-.7, 0], [0, .7], [0, -.7], [.1, .1]]) { parts.push(limb(.06, .1, .5, '#a47148', 0, 1.25, 0, ax, az)); const [x, y, z] = tipOf(.5, 0, 1.25, 0, ax, az); parts.push(ball(.38, c, x, y + .08, z, 1.3, .45, 1.3)); }
    return { parts, fruit: [[.4, 1.7, 0], [-.4, 1.7, 0], [0, 1.85, 0]] };
  },
  acacia(c) {
    return { parts: [cyl(.07, .1, 1, BARK3, 0, 0, 0), limb(.05, .07, .7, BARK3, 0, .9, 0, .55, 0), limb(.05, .07, .7, BARK3, 0, .9, 0, -.5, .2),
      ball(1, shade(c, -.2), 0, 1.6, 0, 1.25, .22, 1), ball(.85, c, 0, 1.7, 0, 1.2, .2, 1)], fruit: [[.7, 1.75, 0], [-.7, 1.75, 0], [0, 1.85, .5]] };
  },
  dragon(c) {
    const parts = [cyl(.12, .16, .9, '#8d6e63', 0, 0, 0)];
    for (const [ax, az] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5], [.25, .3], [-.25, -.3]]) parts.push(limb(.05, .07, .8, '#8d6e63', 0, .85, 0, ax, az));
    parts.push(at(m3mesh(SphG(1.05, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .45, 1), c), 0, 1.45, 0), at(m3mesh(CylG(1.03, 1.03, .06, 14), shade(c, -.25)), 0, 1.45, 0));
    return { parts, fruit: [[.6, 1.7, 0], [-.6, 1.7, 0], [0, 1.9, .3]] };
  },
  bonsai(c, r) {
    const parts = [cyl(.5, .4, .3, '#8d6e63', 0, 0, 0, 10), cyl(.52, .52, .05, '#6d4c41', 0, .3, 0, 10), limb(.06, .1, .6, BARK3D, 0, .3, 0, .35, 0), limb(.05, .07, .55, BARK3D, .2, .8, 0, -.9, .2)];
    const pts = [[.45, 1.05, 0, .32], [-.3, 1.1, .1, .3], [.05, 1.35, -.05, .3]];
    parts.push(...pts.map(([x, y, z, rr], i) => ball(rr, i % 2 ? c : shade(c, -.2), x, y, z, 1.4, .55, 1.2)));
    return { parts, fruit: pts };
  },
  bamboo(c) {
    const parts = [];
    [[-.25, 0, 2.2, shade(c, -.15)], [.1, .15, 2.6, c], [.3, -.2, 1.9, shade(c, -.15)]].forEach(([x, z, h, col]) => {
      parts.push(cyl(.06, .07, h, col, x, 0, z, 6)); for (let y = .4; y < h; y += .4) parts.push(cyl(.075, .075, .04, shade(col, -.3), x, y, z, 6));
      parts.push(ball(.18, shade(c, .3), x + .15, h - .3, z, 1.6, .2, .6), ball(.16, shade(c, .3), x - .12, h - .7, z, 1.6, .2, .6));
    });
    return { parts, fruit: [[-.25, 2.2, 0], [.1, 2.6, .15], [.3, 1.9, -.2]] };
  },
  candy() {
    const parts = [cyl(.06, .06, 1.6, '#ffffff', 0, 0, 0, 8)];
    for (let y = .15; y < 1.6; y += .25) { const t = at(m3mesh(TorG(.065, .02, 4, 10), '#f03e3e'), 0, y, 0); t.rotation.x = Math.PI / 2 + .3; parts.push(t); }
    [[0, 2, 0, '#ffd43b', .38], [-.45, 1.6, .1, '#f783ac', .3], [.45, 1.65, -.1, '#74c0fc', .3], [.05, 1.45, .4, '#b197fc', .26]].forEach(([x, y, z, col, rr]) => {
      const d = at(m3mesh(CylG(rr, rr, .14, 18), col, { rough: .3 }), x, y, z); d.rotation.x = Math.PI / 2; parts.push(d);
      const sw = at(m3mesh(TorG(rr * .6, rr * .1, 4, 18), '#ffffff', { rough: .3 }), x, y, z + .075); parts.push(sw);
    });
    return { parts, fruit: [[0, 2.3, 0], [-.45, 1.9, .1], [.45, 1.95, -.1]] };
  },
  crystal() {
    const parts = [cyl(.06, .08, .5, '#495057', 0, 0, 0)];
    [[0, 1.3, 0, .5, 1.6], [-.4, .9, .1, .28, .9], [.4, .95, -.1, .3, 1], [.1, .8, .4, .22, .7]].forEach(([x, y, z, rr, sy], i) => { const m = at(m3mesh(IcoG(rr, 0), ['#4dabf7', '#74c0fc', '#a5d8ff', '#339af0'][i], { op: .85, rough: .15, metal: .2, emi: '#1c7ed6', ei: .35 }), x, y, z); m.scale.y = sy; parts.push(m); });
    return { parts, fruit: [[0, 2.1, 0], [-.4, 1.4, .1], [.4, 1.5, -.1]], glow: '#74c0fc' };
  },
  rainbow(c, r) { const cols = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa']; const pts = [[0, 1.85, 0, .5], ...ringPts(5, .48, 1.45, .42, r)]; return { parts: [cyl(.1, .16, 1.4, BARK3, 0, 0, 0), ...pts.map(([x, y, z, rr], i) => ball(rr, cols[i % 6], x, y, z))], fruit: pts }; },
  golden(c, r) { const t = blobTree('#fcc419', r, 1.1, { metal: .55, rough: .35, emi: '#f08c00', ei: .15 }); t.parts[0].material = m3mat('#b8860b', { metal: .5, rough: .4 }); return { ...t, glow: '#ffe066' }; },
  jacaranda(c, r) { const t = blobTree('#9775fa', r, 1.05); t.parts.push(...Array.from({ length: 10 }, () => ball(.07, '#b197fc', (r() - .5) * 1.8, .02, (r() - .5) * 1.8, 1, .25, 1, { detail: 0 }))); return t; },
  bottlebrush(c, r) {
    const t = blobTree(c, r, 1);
    t.parts.push(...t.fruit.slice(0, 7).map(([x, y, z]) => { const b = cyl(.07, .07, .32, '#e03131', x * 1.3, y - .05, z * 1.3, 6); b.rotation.z = (x > 0 ? -1 : 1) * .5; return b; }));
    return t;
  },
  frost(c, r) {
    const t = blobTree('#a5d8ff', r, 1.1, { op: .92, rough: .2, emi: '#74c0fc', ei: .25 }); t.parts[0].material = m3mat('#adb5bd');
    t.parts.push(...t.fruit.slice(1, 7).map(([x, y, z]) => { const ic = at(m3mesh(ConeG(.05, .3, 5).rotateX(Math.PI), '#e7f5ff', { op: .9 }), x * 1.2, y - .45, z * 1.2); return ic; }));
    return { ...t, glow: '#d0ebff' };
  },
  ember() {
    const parts = [cyl(.1, .16, 1.2, '#3b2a24', 0, 0, 0)], flames = [];
    [[0, 1.1, 0, .6, 1.4, '#e8590c'], [0, 1.15, 0, .45, 1.15, '#ff922b'], [0, 1.2, 0, .3, .9, '#ffd43b']].forEach(([x, y, z, rr, h, col]) => { const f = cone(rr, h, col, x, y, z, 9, { emi: col, ei: .8, flat: true }); flames.push(f); parts.push(f); });
    const g = { parts, fruit: [[.3, 1.6, 0], [-.3, 1.6, 0], [0, 2.3, 0]], glow: '#ff922b' };
    g.tick = t => flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 9 + i) * .06, 1 + Math.sin(t * 7 + i * 2) * .1, 1 + Math.cos(t * 8 + i) * .06); });
    return g;
  },
  moon(c, r) {
    const t = blobTree('#5f3dc4', r, 1.05, { emi: '#3b2a8a', ei: .3 }); t.parts[0].material = m3mat('#343a40');
    const cres = at(m3mesh(TorG(.28, .08, 6, 16, Math.PI * 1.3), '#fff3bf', { emi: '#fff3bf', ei: .9 }), .2, 2.7, 0); cres.rotation.z = -.6; t.parts.push(cres);
    t.parts.push(...t.fruit.map(([x, y, z]) => ball(.05, '#ffffff', x * 1.3, y + .1, z * 1.3, 1, 1, 1, { detail: 0, emi: '#ffffff', ei: 1 })));
    return { ...t, glow: '#b197fc' };
  },
  // ---- 2.17 trees ----
  wattle(c, r) { const t = blobTree('#7a9a3a', r, 1); t.parts.push(...t.fruit.flatMap(([x, y, z]) => Array.from({ length: 3 }, () => ball(.07, '#fcc419', x * 1.25 + (r() - .5) * .3, y + (r() - .5) * .3, z * 1.25 + (r() - .5) * .3, 1, 1, 1, { detail: 0, emi: '#fab005', ei: .2 })))); return t; },
  magnolia(c, r) {
    const parts = [cyl(.09, .14, 1.1, BARK3D, 0, 0, 0)], fruit = [];
    for (const [ax, az] of [[.55, .1], [-.5, .2], [.1, -.55], [-.15, .55], [0, 0]]) { parts.push(limb(.035, .06, .8, BARK3D, 0, .9, 0, ax, az)); const [x, y, z] = tipOf(.8, 0, .9, 0, ax, az); fruit.push([x, y, z]);
      for (let k = 0; k < 4; k++) { const p = ball(.13, k % 2 ? '#ffdeeb' : '#fcc2d7', x + Math.cos(k * 1.6) * .08, y + .06, z + Math.sin(k * 1.6) * .08, .6, 1.4, .6, { detail: 0 }); p.rotation.z = Math.cos(k * 1.6) * .6; p.rotation.x = Math.sin(k * 1.6) * .6; parts.push(p); } }
    parts.push(...canopy(c, ringPts(4, .4, 1.35, .25, r), r, 1));
    return { parts, fruit };
  },
  lemon(c, r) { const t = blobTree(c, r, .9); t.parts.push(...t.fruit.slice(1, 9).map(([x, y, z]) => ball(.09, '#ffe066', x * 1.25, y - .12, z * 1.25, 1, 1.25, 1, { detail: 1, rough: .5 }))); return t; },
  banyan(c, r) {
    const parts = [cyl(.22, .32, 1.3, '#8a6f5a', 0, 0, 0, 9)];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = .55 + r() * .35; parts.push(cyl(.035, .045, 1.35, '#8a6f5a', Math.cos(a) * rr, 0, Math.sin(a) * rr, 5)); }
    parts.push(...canopy(c, [[0, 1.75, 0, .7], ...ringPts(6, .75, 1.55, .5, r)], r, 1));
    return { parts, fruit: ringPts(5, .8, 1.6, .2, r) };
  },
  blaze(c, r) { const cols = ['#e8590c', '#f76707', '#fd7e14', '#c92a2a', '#fab005']; const pts = [[0, 1.85, 0, .6], ...ringPts(6, .5, 1.45, .45, r), ...ringPts(3, .25, 2.1, .35, r)]; return { parts: [cyl(.1, .16, 1.4, BARK3D, 0, 0, 0), ...pts.map(([x, y, z, rr], i) => ball(rr, cols[i % 5], x, y, z)), ...Array.from({ length: 8 }, () => ball(.08, cols[Math.floor(r() * 5)], (r() - .5) * 2, .02, (r() - .5) * 2, 1, .2, 1, { detail: 0 }))], fruit: pts }; },
  phoenix() {
    const parts = [cyl(.09, .15, 1.3, '#5c3a21', 0, 0, 0)], wings = [];
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const w = new THREE.Group(); w.position.set(0, 1.4, 0); w.rotation.z = s * (.5 + k * .28); const f = ball(.5 - k * .06, ['#ff6b00', '#ff922b', '#ffa94d', '#ffd43b'][k], s * .45, .15, 0, 1.4, .3, .5, { emi: '#ff6b00', ei: .45 }); w.add(f); parts.push(w); wings.push(w); }
    parts.push(cone(.25, .8, '#ffd43b', 0, 1.6, 0, 8, { emi: '#ffd43b', ei: .7 }));
    const g = { parts, fruit: [[.6, 1.7, 0], [-.6, 1.7, 0], [0, 2.4, 0]], glow: '#ffa94d' };
    g.tick = t => wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 2 + i) * .08; });
    return g;
  },
  galaxy(c, r) {
    const cols = ['#5f3dc4', '#3b5bdb', '#862e9c', '#1c7ed6'], pts = [[0, 1.9, 0, .62], ...ringPts(6, .5, 1.5, .45, r)];
    const parts = [cyl(.09, .14, 1.4, '#212529', 0, 0, 0), ...pts.map(([x, y, z, rr], i) => ball(rr, cols[i % 4], x, y, z, 1, 1, 1, { emi: cols[i % 4], ei: .35, rough: .4 }))];
    const ring = at(m3mesh(TorG(.95, .03, 6, 40), '#ffd8a8', { emi: '#ffd8a8', ei: 1 }), 0, 1.7, 0); ring.rotation.x = 1.2; parts.push(ring);
    parts.push(...Array.from({ length: 14 }, () => ball(.035, '#ffffff', (r() - .5) * 1.6, 1.1 + r() * 1.2, (r() - .5) * 1.6, 1, 1, 1, { detail: 0, emi: '#ffffff', ei: 1 })));
    const g = { parts, fruit: pts, glow: '#9775fa' }; g.tick = t => { ring.rotation.z = t * .4; }; return g;
  },
};
function tree3(species, color, stage, seed) {
  const rnd = seeded('t3' + seed), col = color || '#2f9e44', g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  if (stage === 0) {
    body.add(cyl(.025, .035, .45, shade(col, -.35), 0, 0, 0, 5), ball(.13, col, -.1, .38, 0, 1.3, .35, .7), ball(.12, shade(col, -.2), .1, .45, 0, 1.3, .35, .7), ball(.07, shade(col, .3), 0, .5, .02, 1, 1.4, 1));
    return g;
  }
  const t = (T3[species] || T3.oak)(col, rnd);
  t.parts.forEach(p => body.add(p));
  if (stage === 3) {
    const bloom = species === 'cherry' ? '#ffd43b' : rnd() < .5 ? '#ffffff' : '#ffd43b';
    t.fruit.forEach(([x, y, z]) => body.add(ball(.07, bloom, x * 1.15, y + .15, z * 1.15, 1, 1, 1, { detail: 0, emi: bloom, ei: .15 })));
  }
  body.scale.setScalar([1, .62, 1, 1.22][stage]);
  if (t.tick) g.userData.tick = t.tick;
  if (t.glow) g.userData.glow = t.glow;
  return g;
}

// ---------- decorations ----------
function flame3(x, y, z, s = 1) {
  const g = grp(cone(.22 * s, .55 * s, '#ff6b00', 0, 0, 0, 7, { emi: '#ff6b00', ei: .9 }), cone(.14 * s, .4 * s, '#ffd43b', 0, 0, 0, 7, { emi: '#ffd43b', ei: 1 }));
  g.position.set(x, y, z); g.userData.tick = t => g.scale.set(1 + Math.sin(t * 13) * .08, 1 + Math.sin(t * 9) * .15, 1 + Math.cos(t * 11) * .08);
  return g;
}
function withTick(g, ...kids) { const ticks = kids.filter(k => k.userData.tick); if (ticks.length) g.userData.tick = t => ticks.forEach(k => k.userData.tick(t)); return g; }
const DECO3 = {
  d_rock: () => grp(ball(.4, '#868e96', 0, .25, 0, 1.2, .7, 1), ball(.28, '#adb5bd', .45, .15, .2, 1, .7, 1), ball(.22, '#495057', -.4, .12, -.15), ball(.25, '#69a84f', .05, .5, 0, 1.2, .3, 1)),
  d_flowers: () => { const g = new THREE.Group(), cols = ['#f783ac', '#ffd43b', '#ffffff', '#b197fc', '#ff8787']; for (let i = 0; i < 14; i++) { const x = Math.cos(i * 2.4) * (.15 + i * .04), z = Math.sin(i * 2.4) * (.15 + i * .04), h = .25 + (i % 3) * .1; g.add(cyl(.012, .012, h, '#2f9e44', x, 0, z, 4), ball(.07, cols[i % 5], x, h, z, 1, .6, 1, { detail: 0 })); } return g; },
  d_bush: () => grp(ball(.45, '#2f9e44', 0, .35, 0, 1.2, .9, 1), ball(.35, '#40c057', .35, .3, .15), ball(.3, '#37b24d', -.35, .28, -.1), ...[[.2, .6, .3], [-.25, .5, .3], [.4, .45, -.2], [0, .7, -.25]].map(([x, y, z]) => ball(.06, '#e03131', x, y, z, 1, 1, 1, { detail: 0 }))),
  d_log: () => { const l = cyl(.22, .22, 1.3, '#8a5a3b', 0, 0, 0, 10); l.rotation.z = Math.PI / 2; l.position.set(.65, .22, 0); const e1 = at(m3mesh(new THREE.CircleGeometry(.2, 10), '#d9a066'), .66, .22, 0); e1.rotation.y = Math.PI / 2; return grp(l, e1, ball(.12, '#69a84f', .2, .42, .05, 1.5, .4, 1)); },
  d_shrooms: () => grp(...[[0, 0, 1], [.3, .2, .7], [-.25, .15, .6]].flatMap(([x, z, s]) => [cyl(.05 * s, .06 * s, .3 * s, '#f8f0e3', x, 0, z, 6), at(m3mesh(SphG(.2 * s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#e03131'), x, .3 * s, z), ball(.035 * s, '#fff', x + .08 * s, .38 * s, z, 1, .5, 1, { detail: 0 })])),
  d_bench: () => grp(box(1.3, .06, .4, '#a0522d', 0, .4, 0), box(1.3, .25, .06, '#a0522d', 0, .5, -.2), box(.06, .4, .35, '#343a40', -.55, 0, 0), box(.06, .4, .35, '#343a40', .55, 0, 0)),
  d_pond: () => {
    const water = at(m3mesh(CylG(.85, .85, .04, 24), '#4dabf7', { op: .85, rough: .05, metal: .3, flat: false, cast: false }), 0, .02, 0); water.scale.z = .75;
    const g = grp(water, ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return ball(.12, i % 2 ? '#868e96' : '#adb5bd', Math.cos(a) * .9, .05, Math.sin(a) * .7, 1, .6, 1, { detail: 0 }); }),
      at(m3mesh(CylG(.14, .14, .02, 10), '#2f9e44'), .3, .05, .1), at(m3mesh(CylG(.1, .1, .02, 10), '#37b24d'), -.25, .05, -.2), ball(.05, '#f783ac', .3, .08, .1, 1, 1, 1, { detail: 0 }));
    g.userData.tick = t => { water.material.color.setHSL(.57, .8, .62 + Math.sin(t) * .02); }; return g;
  },
  d_lantern: () => { const g = grp(cyl(.04, .05, 1.2, '#343a40', 0, 0, 0, 6), box(.24, .3, .24, '#fff3bf', 0, 1.2, 0, { emi: '#ffd43b', ei: .9 }), cone(.2, .15, '#343a40', 0, 1.5, 0, 4)); g.userData.light = { color: '#ffd43b', y: 1.3, power: 1.2, dist: 5 }; return g; },
  d_campfire: () => { const logs = [0, 1.2, 2.4].map(a => { const l = cyl(.06, .06, .7, '#6d4530', 0, .06, 0, 6); l.rotation.set(Math.PI / 2, a, 0); l.position.set(Math.sin(a) * -.35, .06, Math.cos(a) * -.35); return l; }); const f = flame3(0, .05, 0, 1.3); const g = withTick(grp(...logs, ...Array.from({ length: 8 }, (_, i) => ball(.08, '#868e96', Math.cos(i * .8) * .45, .04, Math.sin(i * .8) * .45, 1, .6, 1, { detail: 0 })), f), f); g.userData.light = { color: '#ff922b', y: .6, power: 2, dist: 7, flicker: true }; return g; },
  d_tent: () => { const t = at(m3mesh(ConeG(.85, 1.1, 4).translate(0, .55, 0), '#f76707'), 0, 0, 0); t.rotation.y = Math.PI / 4; const door = at(m3mesh(ConeG(.3, .6, 3).translate(0, .3, 0), '#862e00'), 0, 0, .45); return grp(t, door); },
  d_cabin: () => { const roof = at(m3mesh(CylG(.85, .85, 1.5, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), '#c92a2a'), 0, 1.1, 0); roof.rotation.y = Math.PI / 2; roof.scale.set(1, .55, 1);
    return grp(box(1.4, .8, 1.1, '#a0522d', 0, 0, 0), roof, box(.28, .5, .02, '#5c3a21', 0, 0, .56), box(.25, .22, .02, '#fff3bf', -.45, .35, .56, { emi: '#ffd43b', ei: .5 }), box(.15, .5, .15, '#868e96', .45, 1.1, -.2)); },
  d_sign: () => grp(cyl(.04, .05, 1, '#8a5a3b', 0, 0, 0, 6), box(.7, .22, .05, '#d9a066', .15, .7, 0), box(.6, .18, .05, '#c08a52', -.1, .42, .02)),
  d_picnic: () => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#e03131'; x.fillRect(i * 8, j * 8, 8, 8); } const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.1, .02, .9), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); cloth.receiveShadow = true; cloth.position.y = .01; return grp(cloth, box(.3, .18, .2, '#c08a52', .25, .02, .1), ball(.08, '#e03131', -.2, .07, -.1, 1, 1, 1, { detail: 0 })); },
  d_well: () => { const roof = at(m3mesh(ConeG(.75, .4, 4).translate(0, .2, 0), '#8a5a3b'), 0, 1.35, 0); roof.rotation.y = Math.PI / 4; return grp(cyl(.5, .5, .5, '#868e96', 0, 0, 0, 12), cyl(.42, .42, .02, '#1864ab', 0, .45, 0, 12), box(.06, 1, .06, '#6d4530', -.45, .4, 0), box(.06, 1, .06, '#6d4530', .45, .4, 0), roof); },
  d_windmill: () => { const blades = new THREE.Group(); blades.position.set(0, 2, .45); for (let i = 0; i < 4; i++) { const b = box(.16, .9, .03, '#f8f9fa', 0, 0, 0); b.rotation.z = i * Math.PI / 2; blades.add(b); } const g = grp(cyl(.3, .5, 2, '#e9ecef', 0, 0, 0, 8), cone(.42, .5, '#c92a2a', 0, 2, 0, 8), box(.25, .4, .02, '#8a5a3b', 0, 0, .44), blades); g.userData.tick = t => { blades.rotation.z = t * .9; }; return g; },
  d_flag: () => { const flag = at(m3mesh(new THREE.PlaneGeometry(.6, .35, 6, 1).translate(.3, 0, 0), '#e03131', { flat: false }), .03, 1.3, 0); flag.material.side = THREE.DoubleSide; const pos = flag.geometry.attributes.position, base = pos.array.slice();
    const g = grp(cyl(.025, .03, 1.5, '#868e96', 0, 0, 0, 6), flag); g.userData.tick = t => { for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 4 + base[i * 3] * 6) * base[i * 3] * .15); pos.needsUpdate = true; }; return g; },
  d_swing: () => { const seat = new THREE.Group(); seat.position.set(0, 1.4, 0); seat.add(cyl(.01, .01, .9, '#adb5bd', 0, -.9, 0, 4)); const tire = at(m3mesh(TorG(.18, .07, 6, 14), '#343a40'), 0, -1, 0); seat.add(tire);
    const g = grp(limb(.05, .07, 1.6, '#6d4530', -.5, 0, 0, .15, 0), limb(.05, .07, 1.6, '#6d4530', .5, 0, 0, -.15, 0), box(1.2, .08, .08, '#6d4530', 0, 1.45, 0), seat); g.userData.tick = t => { seat.rotation.x = Math.sin(t * 1.6) * .18; }; return g; },
  d_telescope: () => { const tube = cyl(.07, .1, .8, '#1864ab', 0, 0, 0, 10); tube.rotation.z = -.8; tube.position.set(0, .75, 0); return grp(limb(.02, .02, .8, '#495057', 0, 0, 0, .3, .2), limb(.02, .02, .8, '#495057', 0, 0, 0, -.3, .2), limb(.02, .02, .8, '#495057', 0, 0, 0, 0, -.35), tube); },
  d_fountain: () => { const jet = cyl(.04, .06, .6, '#a5d8ff', 0, .5, 0, 8, { op: .7, emi: '#74c0fc', ei: .3 }); const g = grp(cyl(.7, .75, .3, '#adb5bd', 0, 0, 0, 16), cyl(.62, .62, .02, '#4dabf7', 0, .28, 0, 16, { op: .85, rough: .05 }), cyl(.12, .15, .5, '#adb5bd', 0, .3, 0, 8), cyl(.3, .25, .1, '#adb5bd', 0, .8, 0, 12), jet); g.userData.tick = t => { jet.scale.y = 1 + Math.sin(t * 6) * .12; }; return g; },
  d_stall: () => { const awn = []; for (let i = 0; i < 5; i++) awn.push(box(.24, .04, .6, i % 2 ? '#fff' : '#fcc419', -.48 + i * .24, 1.15, 0)); return grp(box(1.2, .6, .5, '#c08a52', 0, 0, 0), box(.05, 1.15, .05, '#8a5a3b', -.58, 0, -.2), box(.05, 1.15, .05, '#8a5a3b', .58, 0, -.2), ...awn, ...[[-.3, '#ffe066'], [0, '#ffe066'], [.3, '#ffe066']].map(([x, c]) => cyl(.07, .06, .16, c, x, .6, .1, 8, { op: .85 }))); },
  d_treehouse: (c) => { const tr = tree3('oak', '#40c057', 2, 'house'); tr.scale.setScalar(1.1); const hut = grp(box(.75, .5, .6, '#a0522d', 0, 0, 0), cone(.6, .35, '#c92a2a', 0, .5, 0, 4), box(.2, .3, .02, '#5c3a21', 0, 0, .31)); hut.position.set(0, 1.2, .25); return grp(tr, hut, box(.06, 1.2, .06, '#6d4530', .3, 0, .5), box(.06, 1.2, .06, '#6d4530', -.3, 0, .5)); },
  d_statue: () => { const gold = { metal: .7, rough: .3, emi: '#f08c00', ei: .1 }; return grp(box(.6, .5, .6, '#ced4da', 0, 0, 0), box(.7, .08, .7, '#adb5bd', 0, .5, 0), cyl(.16, .2, .55, '#fcc419', 0, .58, 0, 8, gold), sph(.13, '#fcc419', 0, 1.25, 0, gold), limb(.05, .05, .45, '#fcc419', .12, 1.05, 0, -2.6, 0), limb(.05, .05, .4, '#fcc419', -.12, 1.05, 0, 2.4, 0), ball(.1, '#fcc419', .3, 1.55, 0, 1, 1, 1, { detail: 0, ...gold })); },
  d_balloon: () => { const env = ball(.9, '#ff6b6b', 0, 1.6, 0, 1, 1.15, 1, { detail: 2, flat: false }); const stripes = ball(.91, '#ffd43b', 0, 1.6, 0, .45, 1.16, 1.01, { detail: 2, flat: false }); return grp(env, stripes, box(.4, .3, .4, '#8a5a3b', 0, 0, 0), cyl(.01, .01, .7, '#495057', .18, .3, .18, 3), cyl(.01, .01, .7, '#495057', -.18, .3, -.18, 3)); },
};
// ---------- animals and critters ----------
// one builder for four-legged animals; spec picks colours, ears, tail and size
function beast(s) {
  const b = s.body, k = s.size || 1, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(ball(.32, b, 0, .38, 0, 1.35, .9, .9), ball(.2, s.head || b, .42, .6, 0, 1.1, 1, 1));
  if (s.belly) body.add(ball(.25, s.belly, .05, .3, 0, 1.2, .6, .8));
  if (s.snout) body.add(ball(.09, s.snout, .62, .55, 0, 1.3, .8, .9));
  body.add(ball(.03, '#212529', .58, .66, .1, 1, 1, 1, { detail: 0 }), ball(.03, '#212529', .58, .66, -.1, 1, 1, 1, { detail: 0 }));
  const ear = (z) => s.ears === 'long' ? ball(.06, s.head || b, .38, .9, z, 1, 3, 1) : s.ears === 'round' ? ball(.09, s.head || b, .38, .78, z * 1.4, .5, 1, 1) : s.ears === 'pointy' ? cone(.07, .18, s.head || b, .4, .74, z, 5) : null;
  body.add(ear(.09), ear(-.09));
  if (s.horn) body.add(cone(.04, .3, s.horn, .5, .78, 0, 6, { emi: s.horn, ei: .3 }));
  if (s.antlers) for (const z of [.08, -.08]) body.add(limb(.015, .02, .3, '#8a5a3b', .4, .75, z, -.3, z * 3), limb(.012, .015, .15, '#8a5a3b', .45, .95, z * 1.5, .6, 0));
  if (s.tail === 'bushy') { const t = ball(.16, s.tailCol || b, -.45, .55, 0, .8, 1.6, .8); t.rotation.z = .5; body.add(t); }
  else if (s.tail === 'puff') body.add(ball(.09, '#fff', -.42, .45, 0));
  else if (s.tail === 'long') body.add(limb(.025, .04, .45, s.tailCol || b, -.38, .4, 0, -1.9, 0));
  else if (s.tail === 'fan') for (let i = -3; i <= 3; i++) body.add(ball(.18, i % 2 ? '#2b8a3e' : '#1c7ed6', -.4 - Math.cos(i * .35) * .3, .5 + Math.cos(i * .3) * .35, Math.sin(i * .35) * .5, .4, 1.4, .3));
  if (s.spikes) for (let i = 0; i < 10; i++) body.add(cone(.04, .14, s.spikes, -.15 + (i % 5) * .1, .62, (Math.floor(i / 5) - .5) * .18, 4));
  const legs = [];
  for (const [x, z] of [[.22, .14], [.22, -.14], [-.22, .14], [-.22, -.14]]) { const l = cyl(.045, .05, s.legH || .22, s.legs || shade(b, -.2), x, 0, z, 5); legs.push(l); body.add(l); }
  if (s.biped) legs.slice(0, 2).forEach(l => l.visible = false);
  g.scale.setScalar(k * .9); g.userData.legs = legs; g.userData.body = body;
  return g;
}
function bird3(col, wing = col, k = 1) {
  const g = new THREE.Group(), w1 = new THREE.Group(), w2 = new THREE.Group();
  g.add(ball(.14, col, 0, 0, 0, 1.4, .9, .9), ball(.09, col, .17, .08, 0), cone(.03, .08, '#f59f00', .27, .08, 0, 4).rotateZ(-Math.PI / 2));
  w1.add(ball(.12, wing, 0, 0, .14, 1, .2, 1.6)); w2.add(ball(.12, wing, 0, 0, -.14, 1, .2, 1.6)); g.add(w1, w2);
  g.scale.setScalar(k); g.userData.flap = t => { w1.rotation.x = Math.sin(t * 14) * .7; w2.rotation.x = -Math.sin(t * 14) * .7; };
  return g;
}
const ANIMAL3 = {
  a_rabbit: () => beast({ body: '#f1f3f5', ears: 'long', tail: 'puff', snout: '#ffc9c9', size: .8, legH: .16 }),
  a_fox: () => beast({ body: '#f76707', belly: '#fff4e6', ears: 'pointy', tail: 'bushy', tailCol: '#ff922b', snout: '#fff', legs: '#343a40' }),
  a_deer: () => beast({ body: '#a0662e', belly: '#f8f0e3', ears: 'pointy', antlers: true, legH: .45, size: 1.2, tail: 'puff' }),
  a_cat: () => beast({ body: '#ff922b', ears: 'pointy', tail: 'long', snout: '#ffe8cc', size: .8 }),
  a_hedgehog: () => beast({ body: '#8d6e63', head: '#d9a066', spikes: '#5c3a21', size: .6, legH: .1, snout: '#d9a066' }),
  a_squirrel: () => beast({ body: '#d9480f', tail: 'bushy', ears: 'pointy', size: .6, belly: '#ffe8cc' }),
  a_unicorn: () => beast({ body: '#ffffff', ears: 'pointy', horn: '#fcc419', tail: 'long', tailCol: '#da77f2', legH: .5, size: 1.25 }),
  a_peacock: () => beast({ body: '#1864ab', head: '#1c7ed6', tail: 'fan', legH: .3, legs: '#adb5bd', biped: true, size: 1 }),
  a_duck: () => { const d = bird3('#f8f9fa', '#e9ecef', 1.6); d.position.y = .2; return grp(d); },
  a_owl: () => { const g = grp(ball(.28, '#8a5a3b', 0, .35, 0, 1, 1.3, 1), ball(.22, '#a0662e', 0, .72, 0), sph(.07, '#fff', .17, .76, .08, { seg: 8 }), sph(.07, '#fff', .17, .76, -.08, { seg: 8 }), ball(.035, '#212529', .23, .76, .08, 1, 1, 1, { detail: 0 }), ball(.035, '#212529', .23, .76, -.08, 1, 1, 1, { detail: 0 }), cone(.05, .12, '#a0662e', .05, .9, .1, 4), cone(.05, .12, '#a0662e', .05, .9, -.1, 4)); return g; },
};
// Aussie critters that move in as the forest grows
const CRIT3 = {
  koala: () => beast({ body: '#adb5bd', ears: 'round', snout: '#343a40', size: .75 }),
  echidna: () => beast({ body: '#5c3a21', spikes: '#f8f0e3', snout: '#343a40', size: .65, legH: .1 }),
  possum: () => beast({ body: '#868e96', ears: 'round', tail: 'long', tailCol: '#343a40', snout: '#ffc9c9', size: .65 }),
  frog: () => beast({ body: '#40c057', belly: '#d3f9d8', size: .5, legH: .08 }),
  kangaroo: () => beast({ body: '#c08a52', ears: 'long', tail: 'long', legH: .4, size: 1.2, biped: true, belly: '#e9c39b' }),
  wombat: () => beast({ body: '#7a5c48', ears: 'round', snout: '#5c4033', size: .85, legH: .12 }),
  lyrebird: () => beast({ body: '#8a5a3b', tail: 'fan', biped: true, legH: .3, size: .8 }),
  platypus: () => beast({ body: '#6d4c41', snout: '#343a40', tail: 'long', tailCol: '#5c3a21', size: .7, legH: .08 }),
};
