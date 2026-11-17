'use strict';
/* 2.89 Island undersides (island-undersides/plan.md). One shared builder for the rock under every
   floating island, so your island, the house fortress, the boss island and the far islands all match:
   - Chunky rock: three uneven stacked tiers with overhangs, and a skirt of stone hex columns under the turf.
   - Hanging roots and vines from the rim, swaying slowly.
   - Waterfalls pouring off the rim where the island has a river or a pond, with mist.
   - Glow: pulsing crystal clusters, a soft rim light, drifting motes (embers on the boss island).
     The colour follows the house colour on the fortress and the season (or your island look) at home.
   - A hanging feature by island type: personal islands trail big roots, the house fortress has stone
     spikes and a chain with a lantern, the boss island is dark and cracked with dripping lava.
   - The house fortress's optional rocky look (house-raids plan section 11) makes it darker and spikier:
     siege.js says when it's on (sgFortOn).
   Everything static is merged into a few meshes (one per colour set), so it stays cheap. The moving
   parts run in the island's own animation loop and are left out on Low graphics. */

const US = { mats: {}, tex: {}, t: -1 };
// how much to draw: the main island follows High / Medium / Low; far islands are 'far', housemates 'tiny'
const US_Q = {
  high: { skirt: 44, vines: 40, cl: 5, falls: 3, mist: 4, motes: 44, rim: 1, links: 10, drips: 6, spikes: 12, sway: 1, boul: 14 },
  medium: { skirt: 26, vines: 24, cl: 4, falls: 2, mist: 2, motes: 18, rim: 1, links: 8, drips: 3, spikes: 10, sway: 1, boul: 9 },
  low: { skirt: 10, vines: 10, cl: 2, falls: 0, mist: 0, motes: 0, rim: 0, links: 5, drips: 0, spikes: 6, sway: 0, boul: 4 },
  far: { skirt: 10, vines: 14, cl: 2, falls: 1, mist: 0, motes: 0, rim: 1, links: 5, drips: 0, spikes: 7, sway: 0, boul: 4 },
  tiny: { skirt: 0, vines: 7, cl: 1, falls: 0, mist: 0, motes: 0, rim: 0, links: 0, drips: 0, spikes: 4, sway: 0, boul: 2 },
};
// the rock by island type (fort = the house's rocky fortress look)
const US_PAL = {
  home: { r: ['#b8a07e', '#8c7a8f', '#6d5f73'], st: ['#c4ae8c', '#a99478'], b: ['#7a6c7e', '#9a8a8a'], root: ['#7a5a3e', '#6b4f36'], vine: ['#4f8a3a', '#5f9d3f'], leaf: ['#6fbf45', '#8bd35a', '#4f9a37'] },
  house: { r: ['#b3b0a8', '#96938c', '#77746f'], st: ['#c2bdb2', '#a19d94'], b: ['#85827b', '#9c988f'], root: ['#6b5a46', '#5a4a3a'], vine: ['#4f7d3a', '#5a8a41'], leaf: ['#5fa83f', '#4f9a37'], spike: '#77737f' },
  fort: { r: ['#6e6a75', '#55515e', '#3d3946'], st: ['#7a7682', '#5f5b68'], b: ['#45414f', '#5a5664'], root: ['#4a3f36', '#3d342c'], vine: ['#3f5f33', '#4a6b3a'], leaf: ['#4f7d3a'], spike: '#46424f' },
  boss: { r: ['#4b4458', '#3f3650', '#2f283b'], st: ['#3d3649', '#463e55'], b: ['#352d44', '#4d4260'], root: ['#2d2838', '#262131'], vine: ['#2d2838'], leaf: ['#3a3346'], dark: '#2a1f3a' },
};
// the glow's colours on a personal island: the season, or your island look if you've picked one
const US_SEASON = { summer: ['#ffd166', '#4ee6ff'], autumn: ['#ff922b', '#ffd166'], winter: ['#74c0fc', '#d0ebff'], spring: ['#f783ac', '#8ce99a'] };
const US_THEME = { snow: 'winter', autumn: 'autumn', spring: 'spring', desert: 'summer' };
function usGlowFor(theme) { const s = US_THEME[theme] || (typeof hxSeason === 'function' ? hxSeason() : 'summer'); return US_SEASON[s] || US_SEASON.summer; }
const usFort = () => { try { return typeof sgFortOn === 'function' && !!HI.doc && !!sgFortOn(); } catch (e) { return false; } }; // the Stone fortress look (siege.js)
const usQ = () => typeof hxGfx === 'function' ? hxGfx() : (D.settings && D.settings.lowQuality ? 'low' : 'high');

// ---------- shared materials and textures ----------
function usMat(k) {
  const M = US.mats; if (M[k]) return M[k];
  if (k === 'rock') M[k] = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 });
  else if (k === 'glow') M[k] = new THREE.MeshBasicMaterial({ vertexColors: true });
  else if (k === 'fall' || k === 'fall2') { const t = usFallTex(k); M[k] = new THREE.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: k === 'fall' ? .9 : .55 }); }
  else if (k === 'mist') M[k] = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .2, depthWrite: false });
  else if (k === 'lava') M[k] = new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true });
  return M[k];
}
// falling water: soft vertical streaks that repeat, scrolled down every frame
function usFallTex(k) {
  if (US.tex[k]) return US.tex[k];
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'), rnd = seeded('us-fall-' + k);
  x.fillStyle = 'rgba(190,230,255,.55)'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 46; i++) { const w = 1 + rnd() * 4, px = rnd() * 64, py = rnd() * 256, h = 30 + rnd() * 120; x.fillStyle = `rgba(255,255,255,${.25 + rnd() * .6})`; x.fillRect(px, py, w, h); if (py + h > 256) x.fillRect(px, py - 256, w, h); }
  const t = US.tex[k] = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  return t;
}
function usDotTex() {
  if (US.tex.dot) return US.tex.dot;
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return (US.tex.dot = new THREE.CanvasTexture(c));
}
// once a frame, whichever island ticks first: the water scrolls and the crystals pulse
function usShared(t) {
  if (t === US.t) return; US.t = t;
  if (US.tex.fall) US.tex.fall.offset.y = (t * .9) % 1;
  if (US.tex.fall2) US.tex.fall2.offset.y = (t * 1.35) % 1;
  if (US.mats.glow) US.mats.glow.color.setScalar(.78 + Math.sin(t * 1.6) * .22);
}

// ---------- geometry helpers ----------
// how far the island's edge is at angle a (a polygon with n sides, turned by rot)
const usV0 = (n, rot) => Math.PI / 2 - rot;
function usEdge(R, n, rot, a) { const seg = Math.PI * 2 / n, d = (((a - usV0(n, rot)) % seg) + seg) % seg; return R * Math.cos(seg / 2) / Math.cos(d - seg / 2); }
// a tier of rock: a polygon-shaped cylinder with its sides pushed about (the top ring stays where it is, so it meets the island)
function usTier(n, rot, rTop, rBot, h, rnd, amt) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, n * 2, 3, false); g.rotateY(rot);
  const p = g.attributes.position, moved = new Map(), y1 = h / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!moved.has(k)) {
      const r = Math.hypot(x, z), a = Math.atan2(z, x), f = r > 1e-4 ? usEdge(1, n, rot, a) : 1, t = (y1 - y) / h; // 0 at the top, 1 at the bottom
      const j = 1 + (rnd() - .5) * amt * Math.min(1, t * 1.6);
      moved.set(k, [x * f * j, y + (t > .05 ? (rnd() - .5) * amt * h * .35 : 0), z * f * j]);
    }
    p.setXYZ(i, ...moved.get(k));
  }
  return g;
}
// a bucket of parts (geometry + colour) merged into one mesh at the end
function usBucket() { return []; }
function usPut(b, geo, col, x = 0, y = 0, z = 0) { if (x || y || z) geo.translate(x, y, z); b.push([geo, col]); return geo; }
// a tapered rod from A to B (roots, vines, cracks, chain posts)
let _ua, _ub, _uq, _um; // made on first use (three.js loads later)
function usRod(b, A, B, r1, r2, col, sides = 4) {
  if (!_ua) { _ua = new THREE.Vector3(); _ub = new THREE.Vector3(0, 1, 0); _uq = new THREE.Quaternion(); _um = new THREE.Matrix4(); }
  _ua.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); const L = _ua.length(); if (L < 1e-4) return;
  const g = new THREE.CylinderGeometry(r2, r1, L, sides, 1); // top = B, bottom = A
  _uq.setFromUnitVectors(_ub, _ua.normalize()); _um.makeRotationFromQuaternion(_uq); g.applyMatrix4(_um);
  g.translate((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2); b.push([g, col]);
}
function usMerge(parts, alpha) {
  let n = 0; const gs = parts.map(([g, c]) => { const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose(); n += ng.attributes.position.count; return [ng, c]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * (alpha ? 4 : 3)), C = new THREE.Color(); let o = 0;
  for (const [g, c] of gs) {
    const cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    C.set(c); for (let i = 0; i < cnt; i++) { const j = (o + i) * (alpha ? 4 : 3); col[j] = C.r; col[j + 1] = C.g; col[j + 2] = C.b; if (alpha) col[j + 3] = 1; }
    o += cnt; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, alpha ? 4 : 3));
  out.computeBoundingSphere(); return out;
}
function usMesh(parts, mat, into) { if (!parts.length) return null; const m = new THREE.Mesh(usMerge(parts), usMat(mat)); m.castShadow = m.receiveShadow = false; into.add(m); return m; }

/* The underside. o = {
     kind: 'home' | 'mate' | 'house' | 'boss',  fort: rocky fortress look,  dead: the boss is beaten (blue glow),
     n: sides (6 hex, 4 square), rot: how the island's polygon is turned, R: its corner radius,
     y0: where the rock starts (under the turf), D: how deep it goes, rimY / rimR: the rim the vines hang over,
     glow: [colour, colour], falls: [angle...] where water pours off, q: detail ('high' | 'medium' | 'low' | 'far' | 'tiny'),
     anim: an array to push { fn(t) } onto (the island's animation loop), or nothing for a still island,
     seed }
   Returns the group it built (already added to W). */
function usBuild(W, o) {
  const q = US_Q[o.q] || US_Q.high, n = o.n || 6, rot = o.rot || 0, R = o.R, D = o.D, y0 = o.y0, k = R / 17, rnd = seeded('us-' + (o.seed || o.kind));
  const kind = o.kind === 'mate' ? 'home' : o.kind, pal = US_PAL[kind === 'house' && o.fort ? 'fort' : kind] || US_PAL.home;
  const glow = o.glow || ['#4ee6ff', '#ffb347'], boss = kind === 'boss', house = kind === 'house', fort = house && o.fort;
  const g = new THREE.Group(); g.name = 'underside'; W.add(g);
  const rock = usBucket(), glo = usBucket(), seg = Math.PI * 2 / n, v0 = usV0(n, rot);
  const edge = (a, r = R) => usEdge(r, n, rot, a), at = (a, r, y) => { const e = edge(a, r); return [Math.cos(a) * e, y, Math.sin(a) * e]; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  // 1. the rock: three tiers, each a little off-centre so the overhangs differ round the island
  const jag = boss ? .34 : fort ? .38 : .26;
  const T = [
    { t: R * .99, b: R * .86, h: D * .16, y: y0, x: 0, z: 0, c: pal.r[0] },
    { t: R * .8, b: R * .58, h: D * .24, y: y0 - D * .14, x: (rnd() - .5) * R * .06, z: (rnd() - .5) * R * .06, c: pal.r[1] },
    { t: R * .56, b: R * .04, h: D * .64, y: y0 - D * .36, x: (rnd() - .5) * R * .08, z: (rnd() - .5) * R * .08, c: pal.r[2] },
  ];
  for (const [i, t] of T.entries()) usPut(rock, usTier(n, rot, t.t, t.b, t.h, rnd, jag * (i ? 1 : .6)), t.c, t.x, t.y - t.h / 2, t.z);
  const tip = [T[2].x, y0 - D * .98, T[2].z];
  // where a tier's surface is at angle a, a fraction f of the way down it
  const onTier = (ti, a, f, out = 0) => { const t = T[ti], r = t.t + (t.b - t.t) * f; const e = edge(a, r) + out; return [t.x + Math.cos(a) * e, t.y - t.h * f, t.z + Math.sin(a) * e]; };
  // the cliff skirt: stone hex columns hanging under the turf like basalt
  for (let i = 0; i < q.skirt; i++) {
    const a = (i + rnd() * .6) / q.skirt * Math.PI * 2, rr = R * (.016 + rnd() * .016), h = D * (.05 + rnd() * .1), p = at(a, R * (.93 + rnd() * .04), y0 - h / 2 + .02);
    usPut(rock, new THREE.CylinderGeometry(rr, rr * .9, h, 6), pick(pal.st), ...p);
    usPut(rock, new THREE.ConeGeometry(rr * .9, rr * 1.6, 6).rotateX(Math.PI), pick(pal.st), p[0], p[1] - h / 2 - rr * .8, p[2]);
  }
  // overhang boulders on the ledges where the tiers meet
  for (let i = 0; i < q.boul; i++) {
    const a = rnd() * Math.PI * 2, ti = i % 2, p = onTier(ti, a, .92, -R * .02), s = R * (.05 + rnd() * .06);
    const b = new THREE.DodecahedronGeometry(s, 0); b.scale(1, 1.3, 1); usPut(rock, b, pick(pal.b), ...p);
  }
  // 2. roots and vines from the rim (in a bucket per side, so each side can sway on its own hinge)
  const nv = Math.round(q.vines * (boss ? .3 : house ? (fort ? .2 : .4) : 1)), sides = Array.from({ length: n }, () => usBucket());
  const rimY = o.rimY ?? y0, rimR = o.rimR ?? R;
  for (let i = 0; i < nv; i++) {
    const a = rnd() * Math.PI * 2, sd = Math.floor((((a - v0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg) % n, B = q.sway ? sides[sd] : rock;
    const isRoot = boss || rnd() < .3, len = D * (.1 + rnd() * (isRoot ? .22 : .32)), segs = q === US_Q.tiny ? 2 : 3, th = R * (isRoot ? .007 : .0045) * (1 + rnd() * .6);
    const e = edge(a, rimR) + R * .012; let P = [Math.cos(a) * e, rimY, Math.sin(a) * e];
    const out = [Math.cos(a), 0, Math.sin(a)];
    for (let s = 0; s < segs; s++) {
      const sl = len / segs, bend = (rnd() - .5) * .5, inw = s === 0 ? .05 : -(.1 + rnd() * .25); // a little out over the lip, then back in under it
      const N = [P[0] + out[0] * sl * inw + Math.sin(a) * sl * bend, P[1] - sl, P[2] + out[2] * sl * inw - Math.cos(a) * sl * bend];
      usRod(B, P, N, th * (1 - s / segs * .6), th * (1 - (s + 1) / segs * .6), isRoot ? pick(pal.root) : pick(pal.vine));
      if (!isRoot) for (let l = 0; l < 2; l++) { const lf = new THREE.OctahedronGeometry(R * (.006 + rnd() * .007), 0); usPut(B, lf, pick(pal.leaf), P[0] + (N[0] - P[0]) * (l ? 1 : .5), P[1] + (N[1] - P[1]) * (l ? 1 : .5), P[2] + (N[2] - P[2]) * (l ? 1 : .5)); }
      P = N;
    }
  }
  // 3. the hanging feature
  const tipB = q.sway ? usBucket() : rock, tipG = q.sway ? usBucket() : glo;
  if (boss) {
    // dark crystals jutting from the lower rock, each with a burning tip, and glowing cracks down the sides
    for (let i = 0; i < (q === US_Q.tiny ? 2 : 6); i++) {
      const a = rnd() * Math.PI * 2, ti = 1 + (i % 2), p = onTier(ti, a, .3 + rnd() * .5, -R * .03), L = R * (.12 + rnd() * .12), d = [Math.cos(a) * .7, -.7, Math.sin(a) * .7];
      const E = [p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L]; usRod(rock, p, E, R * .045, R * .012, pal.dark, 5);
      usRod(glo, E, [E[0] + d[0] * L * .25, E[1] + d[1] * L * .25, E[2] + d[2] * L * .25], R * .014, R * .002, glow[i % 2], 5);
    }
    const nc = q === US_Q.tiny ? 2 : q === US_Q.low || q === US_Q.far ? 5 : 10;
    for (let i = 0; i < nc; i++) {
      const a = rnd() * Math.PI * 2, ti = rnd() < .5 ? 0 : 1; let f = .05, aa = a, P = onTier(ti, aa, f, R * .006);
      for (let s = 0; s < 3; s++) { f += .2 + rnd() * .15; aa += (rnd() - .5) * .08; const N = onTier(ti, aa, Math.min(.95, f), R * .006); usRod(glo, P, N, R * .005, R * .004, glow[0], 3); P = N; }
    }
    usRod(rock, tip, [tip[0], tip[1] - R * .12, tip[2]], R * .05, R * .005, pal.dark, 5);
  } else if (house) {
    // stone spikes under the ledges (more and longer on the rocky fortress look)
    const ns = Math.round(q.spikes * (fort ? 2 : 1));
    for (let i = 0; i < ns; i++) {
      const a = rnd() * Math.PI * 2, ti = i % 3 === 2 ? 1 : 0, p = onTier(ti, a, .97, -R * .03), L = D * (fort ? .12 + rnd() * .2 : .07 + rnd() * .12);
      const lean = fort && i % 2 ? .55 : .12, d = [Math.cos(a) * lean, -1, Math.sin(a) * lean];
      usRod(rock, p, [p[0] + d[0] * L, p[1] - L, p[2] + d[2] * L], R * (fort ? .035 : .028), R * .002, pal.spike, 5);
    }
    if (fort) for (let i = 0; i < Math.round(ns * .6); i++) { // spikes jutting sideways out of the skirt
      const a = rnd() * Math.PI * 2, p = onTier(0, a, .4 + rnd() * .4, -R * .02), L = R * (.06 + rnd() * .06);
      usRod(rock, p, [p[0] + Math.cos(a) * L, p[1] - L * .35, p[2] + Math.sin(a) * L], R * .025, R * .002, pal.spike, 5);
    }
    // a chain from the point with a lantern in the house colour
    if (q.links) {
      const lk = R * .028, sp = lk * 1.55; let y = tip[1] + lk;
      for (let i = 0; i < q.links; i++) { const t = new THREE.TorusGeometry(lk, lk * .28, 4, 8); if (i % 2) t.rotateY(Math.PI / 2); usPut(tipB, t, '#3b3a40', tip[0], y - lk, tip[2]); y -= sp; }
      const L = R * .05, ly = y - L * .6;
      usPut(tipB, new THREE.CylinderGeometry(L * .55, L * .7, L * .2, 6), '#2f2e34', tip[0], ly + L * .65, tip[2]);
      usPut(tipB, new THREE.ConeGeometry(L * .5, L * .4, 6), '#2f2e34', tip[0], ly + L * .9, tip[2]);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; usPut(tipB, new THREE.BoxGeometry(L * .08, L * 1.2, L * .08), '#2f2e34', tip[0] + Math.cos(a) * L * .5, ly, tip[2] + Math.sin(a) * L * .5); }
      usPut(tipB, new THREE.CylinderGeometry(L * .7, L * .55, L * .16, 6), '#2f2e34', tip[0], ly - L * .65, tip[2]);
      usPut(tipG, new THREE.OctahedronGeometry(L * .42, 0).scale(1, 1.4, 1), glow[0], tip[0], ly, tip[2]);
    }
  } else {
    // personal islands: a great tangle of roots trailing from the point, with glowing seed pods
    const nr = q === US_Q.tiny ? 3 : q === US_Q.high ? 7 : 5;
    for (let i = 0; i < nr; i++) {
      let a = i / nr * Math.PI * 2 + rnd(), P = [tip[0], tip[1] + D * .06, tip[2]], th = R * (.018 + rnd() * .01);
      const segs = q === US_Q.tiny ? 2 : 4, len = D * (.3 + rnd() * .2);
      for (let s = 0; s < segs; s++) {
        const sl = len / segs, spread = s === 0 ? .9 : .35 - s * .06; a += (rnd() - .5) * .5;
        const N = [P[0] + Math.cos(a) * sl * spread, P[1] - sl * (1 - spread * .3), P[2] + Math.sin(a) * sl * spread];
        usRod(tipB, P, N, th, th * .62, pick(pal.root), 5); th *= .62;
        if (s === 1 && q !== US_Q.tiny) { const b = a + (rnd() - .5) * 1.6, M = [N[0] + Math.cos(b) * sl * .5, N[1] - sl * .7, N[2] + Math.sin(b) * sl * .5]; usRod(tipB, N, M, th * .7, th * .2, pick(pal.root), 4); }
        P = N;
      }
      if (i % 2 === 0) usPut(tipG, new THREE.IcosahedronGeometry(R * .014, 0), glow[i % 4 === 0 ? 0 : 1], ...P);
    }
    // a few roots poking out of the middle tier too
    for (let i = 0; i < (q === US_Q.tiny ? 0 : 6); i++) {
      const a = rnd() * Math.PI * 2, p = onTier(1, a, .3 + rnd() * .5, -R * .01), L = D * (.08 + rnd() * .1);
      usRod(rock, p, [p[0] + Math.cos(a) * L * .35, p[1] - L, p[2] + Math.sin(a) * L * .35], R * .012, R * .003, pick(pal.root), 4);
    }
  }
  // 4. glowing crystal clusters on the lower rock
  if (!boss) for (let c = 0; c < q.cl; c++) {
    const a = (c + rnd() * .5) / q.cl * Math.PI * 2, ti = 1 + (c % 2), base = onTier(ti, a, .25 + rnd() * .5, -R * .02);
    for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
      const L = R * (.07 + rnd() * .08), d = [Math.cos(a) * .6 + (rnd() - .5) * .7, -.7, Math.sin(a) * .6 + (rnd() - .5) * .7];
      usRod(glo, base, [base[0] + d[0] * L, base[1] + d[1] * L, base[2] + d[2] * L], R * (.018 + rnd() * .012), R * .002, glow[i % 2], 5);
    }
  }
  usMesh(rock, 'rock', g); usMesh(glo, 'glow', g);
  const ticks = [];
  // the swaying parts hang from a hinge: each side from its own edge, the feature from the point
  if (q.sway) {
    sides.forEach((b, i) => {
      if (!b.length) return;
      const am = v0 + (i + .5) * seg, e = usEdge(rimR, n, rot, am), hx = Math.cos(am) * e, hz = Math.sin(am) * e, ax = new THREE.Vector3(-Math.sin(am), 0, Math.cos(am)), ph = rnd() * 6;
      const pv = new THREE.Group(); pv.position.set(hx, rimY, hz); g.add(pv);
      for (const [geo] of b) geo.translate(-hx, -rimY, -hz);
      usMesh(b, 'rock', pv);
      ticks.push(t => pv.quaternion.setFromAxisAngle(ax, Math.sin(t * .7 + ph) * .035));
    });
    const pv = new THREE.Group(); pv.position.set(...tip); g.add(pv);
    for (const [geo] of tipB) geo.translate(-tip[0], -tip[1], -tip[2]); for (const [geo] of tipG) geo.translate(-tip[0], -tip[1], -tip[2]);
    usMesh(tipB, 'rock', pv); usMesh(tipG, 'glow', pv);
    const amp = house ? .07 : .03;
    ticks.push(t => { pv.rotation.z = Math.sin(t * .55) * amp; pv.rotation.x = Math.sin(t * .43 + 1) * amp * .6; });
  }
  // 5. waterfalls off the rim, with mist where they thin out
  const falls = (o.falls || []).slice(0, q.falls);
  for (const a0 of falls) {
    const si = Math.floor((((a0 - v0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg), am = v0 + (si + .5) * seg; // face out from the side it's on
    const e = usEdge(o.fallR || R, n, rot, a0) + R * .008, x = Math.cos(a0) * e, z = Math.sin(a0) * e, w = R * .075, top = o.fallY ?? rimY, H = D * (q === US_Q.far ? .55 : .75);
    for (const [mk, ww, push] of [['fall', w, 0], ...(q === US_Q.high ? [['fall2', w * .6, R * .006]] : [])]) {
      const geo = new THREE.PlaneGeometry(ww, H, 1, 6), cA = new Float32Array(geo.attributes.position.count * 4), uv = geo.attributes.uv;
      for (let i = 0; i < geo.attributes.position.count; i++) { const f = 1 - uv.getY(i); cA.set([1, 1, 1, f < .04 ? f / .04 : Math.max(0, 1 - Math.pow(f, 1.6))], i * 4); uv.setY(i, uv.getY(i) * H / (R * .35)); }
      geo.setAttribute('color', new THREE.BufferAttribute(cA, 4));
      const m = new THREE.Mesh(geo, usMat(mk)); m.position.set(x + Math.cos(am) * push, top - H / 2, z + Math.sin(am) * push); m.rotation.y = Math.PI / 2 - am; m.renderOrder = 2; g.add(m);
    }
    // where it pours over the lip, a little curl of water
    const lg = new THREE.CylinderGeometry(w * .28, w * .28, w, 6, 1, true, 0, Math.PI); lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lg.attributes.position.count * 4).fill(.8), 4));
    const lip = new THREE.Mesh(lg, usMat('fall')); lip.rotation.set(0, Math.PI / 2 - am, Math.PI / 2); lip.position.set(x - Math.cos(am) * w * .2, top - w * .05, z - Math.sin(am) * w * .2); g.add(lip);
    for (let i = 0; i < q.mist; i++) {
      const s = R * (.05 + rnd() * .04), m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), usMat('mist')), my = top - H * (.55 + rnd() * .3), ph = rnd() * 6;
      m.position.set(x + Math.cos(am) * s * .6 + (rnd() - .5) * w, my, z + Math.sin(am) * s * .6 + (rnd() - .5) * w); g.add(m);
      ticks.push(t => { const k2 = 1 + Math.sin(t * .8 + ph) * .18; m.scale.set(k2, k2 * .8, k2); m.position.y = my + Math.sin(t * .5 + ph) * s * .3; });
    }
  }
  // 6. a soft light round the rim: a thin glowing seam where the turf meets the rock
  if (q.rim) {
    const rim = usBucket(), yy = y0 + .01;
    for (let i = 0; i < n; i++) { const a1 = v0 + i * seg, a2 = a1 + seg, e = R * 1.0; usRod(rim, [Math.cos(a1) * e, yy, Math.sin(a1) * e], [Math.cos(a2) * e, yy, Math.sin(a2) * e], R * .006, R * .006, glow[0], 4); }
    usMesh(rim, 'glow', g);
  }
  // 7. motes drifting under the island (embers rising on the boss island)
  if (q.motes) {
    const N = q.motes, pos = new Float32Array(N * 3), M = [];
    for (let i = 0; i < N; i++) M.push({ a: rnd() * Math.PI * 2, r: R * (.25 + rnd() * .85), y: rnd(), sp: .02 + rnd() * .05, ph: rnd() * 6 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: glow[0], size: R * .02, map: usDotTex(), transparent: true, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
    const step = t => {
      for (let i = 0; i < N; i++) {
        const m = M[i], a = m.a + t * m.sp * (boss ? .5 : 1), f = boss ? (m.y + t * m.sp * 1.6) % 1 : m.y, y = y0 - D * (boss ? 1 - f : .1 + f * .8) + (boss ? 0 : Math.sin(t * .6 + m.ph) * R * .02);
        pos[i * 3] = Math.cos(a) * m.r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * m.r;
      }
      geo.attributes.position.needsUpdate = true;
    };
    step(0); ticks.push(step);
  }
  // 8. lava dripping from the boss island's point and cracks
  if (boss && q.drips && !o.dead) for (let i = 0; i < q.drips; i++) {
    const a = rnd() * Math.PI * 2, from = i === 0 ? tip : onTier(1 + (i % 2), a, .9, R * .004), s = R * .012, m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), usMat('lava')), ph = rnd(), fallH = D * .5;
    m.scale.y = 1.8; g.add(m);
    ticks.push(t => { const f = (t * .45 + ph) % 1; m.position.set(from[0], from[1] - f * f * fallH, from[2]); m.scale.setScalar(1 - f * .7); m.scale.y *= 1.8; });
  }
  g.userData.tick = ticks.length ? t => { usShared(t); for (const f of ticks) f(t); } : t => usShared(t);
  if (o.anim) o.anim.push({ fn: g.userData.tick });
  return g;
}

// where water pours off a hex island: the ends of the river and any pond near the coast
function usHexFalls(L, st, R) {
  const out = [], add = (k, w) => { const [x, z] = hxPos(...hxQR(k)), a = Math.atan2(z, x); if (!out.some(o => Math.abs(Math.atan2(Math.sin(o.a - a), Math.cos(o.a - a))) < .6)) out.push({ a, w }); };
  for (const [k, h] of L) if (h.t === 'river' && hxNb(k).some(n => L.get(n)?.t === 'water' && hxDist(...hxQR(n)) > R)) add(k, 2);
  for (const [k, v] of Object.entries(st.tf || {})) if (v && v.t === 'water' && L.has(k) && hxDist(...hxQR(k)) >= R - 1) add(k, 1);
  return out.sort((a, b) => b.w - a.w).map(o => o.a);
}

// ---------- the boss island (and the old square islands) loop ----------
// the hex islands animate in their own loop (hexworld.js); the boss island has no loop of its own for this
const US_LOOP = { list: [], raf: 0 };
function usLoop(list) {
  US_LOOP.list = list; if (US_LOOP.raf || !list.length) return;
  const tick = now => {
    US_LOOP.raf = 0;
    if (IS3.house !== 'boss' || view !== 'islands' || !IS3.canvas?.isConnected || usQ() === 'low' || (typeof SO !== 'undefined' && SO)) return;
    const t = now / 1000; for (const a of US_LOOP.list) a.fn(t); is3draw();
    US_LOOP.raf = requestAnimationFrame(tick);
  };
  US_LOOP.raf = requestAnimationFrame(tick);
}
