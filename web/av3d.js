'use strict';
/* 2.58 the big 3D avatar on the You page, restyled (round 3, part C):
   a chunky toon hero with dark outlines and flat cel shading, built from
   rounded shapes in your avatar's colours. It shows your look (skin, face
   shape, eyes, brows, nose, mouth, ears, beard, freckles, glasses, earrings,
   hair style and colour), your cosmetics (headwear, eyewear, kit and its
   pattern, shoes, extras like capes and wings, and your pet), the gear you
   wear (each piece in its rarity colour, legendaries glow) and your class's
   outfit tint and aura. Drag to turn it.

   Restyling: sizes live in AV3_STYLE, materials come from av3mat() (toon) and
   every outline from av3mesh(). Each hair style, hat, eyewear, extra and gear
   piece has its own small builder below (AV3_HAIR, AV3_HAT, AV3_EYE, AV3_EXTRA,
   AV3_GEAR), so a new look or a new cosmetic only means changing this file.
   three.js loads the first time the You page opens (the same files Islands
   uses); until then, and on computers without WebGL, the 2D avatar shows. */

const AV3_STYLE = {
  ol: .017, olCol: '#140f1f', // outline thickness and colour
  headR: .4, headY: 1.66, hipY: .74, torsoH: .62, shoulderX: .42,
  armR: .105, legR: .14, tint: .45, // how much the class colour tints the kit
  bg: ['#262b45', '#141726'],
};
const AV3 = { R: null, S: null, cam: null, root: null, fig: null, aura: null, sig: '', yaw: .45, spin: true, drag: null, raf: 0, host: null, mats: {}, tex: [] };

// ---------- materials, outlines and shapes ----------
let AV3_GRAD = null, AV3_OLM = null;
function av3grad() { // three flat bands of light: shadow, mid, lit
  if (AV3_GRAD) return AV3_GRAD;
  const d = new Uint8Array([84, 84, 84, 255, 178, 178, 178, 255, 255, 255, 255, 255]);
  AV3_GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); AV3_GRAD.minFilter = AV3_GRAD.magFilter = THREE.NearestFilter; AV3_GRAD.generateMipmaps = false; AV3_GRAD.needsUpdate = true;
  return AV3_GRAD;
}
// o: e emissive, ei its strength, op opacity, ds double-sided, map texture, flat (no lighting, for glows)
function av3mat(col, o = {}) {
  const key = col + '|' + (o.e || '') + (o.ei ?? '') + '|' + (o.op ?? '') + (o.ds ? 'd' : '') + (o.flat ? 'f' : '') + (o.map ? o.map.uuid : '');
  if (AV3.mats[key]) return AV3.mats[key];
  const base = { color: col, transparent: o.op != null, opacity: o.op ?? 1, depthWrite: o.op == null, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, map: o.map || null };
  const m = o.flat ? new THREE.MeshBasicMaterial(base) : new THREE.MeshToonMaterial({ ...base, gradientMap: av3grad(), emissive: o.e || '#000000', emissiveIntensity: o.ei ?? 1 });
  return (AV3.mats[key] = m);
}
// the outline: the same shape drawn inside out in dark ink, pushed out along its normals
function av3olm() {
  if (AV3_OLM) return AV3_OLM;
  const m = AV3_OLM = new THREE.MeshBasicMaterial({ color: AV3_STYLE.olCol, side: THREE.BackSide });
  m.onBeforeCompile = s => { s.uniforms.olT = { value: AV3_STYLE.ol }; s.vertexShader = 'uniform float olT;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * olT;'); };
  return m;
}
// a mesh with toon shading and an outline (o.ol false for small or see-through bits)
function av3mesh(par, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.sh !== false; m.receiveShadow = !!o.rs; par.add(m); // no self-shadowing: it speckles toon skin
 
  if (o.ol !== false && !mat.transparent && !(mat instanceof THREE.MeshBasicMaterial)) { const l = new THREE.Mesh(geo, av3olm()); l.castShadow = false; l.raycast = () => {}; m.add(l); }
  return m;
}
const av3cap = (r, len, s = 16) => new THREE.CapsuleGeometry(r, len, 6, s);
const av3sph = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const av3cyl = (rt, rb, h, s = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const av3tor = (r, t, arc = Math.PI * 2, rs = 10, ts = 28) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const av3cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const av3dome = (r, frac = .5, s = 28) => new THREE.SphereGeometry(r, s, 16, 0, Math.PI * 2, 0, Math.PI * frac);
const av3mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const av3lit = (c, t = .35) => av3mix(c, '#ffffff', t), av3drk = (c, t = .3) => av3mix(c, '#000000', t);
const av3lathe = (pts, s = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);
// a flat shape (star, heart, wing feather) given a little depth
function av3shape(draw, depth = .02, bevel = .008) {
  const sh = new THREE.Shape(); draw(sh);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 }); g.center(); return g;
}
const av3star = (r, n = 5) => av3shape(s => { for (let i = 0; i <= n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * .45 : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } });
const av3heart = r => av3shape(s => { s.moveTo(0, -r); s.bezierCurveTo(r * 1.4, -r * .1, r * .9, r * 1.1, 0, r * .45); s.bezierCurveTo(-r * .9, r * 1.1, -r * 1.4, -r * .1, 0, -r); });
// canvas textures (kit patterns, pet sprites); kept so they can be freed on rebuild
function av3canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; AV3.tex.push(t); return t;
}

// ---------- your colours and look ----------
function av3colors(spec) {
  const C = id => cos(id) || {}, L = Object.assign({}, LOOK_DEFAULT, spec.look || {});
  const dyed = spec.hairCol && (C(spec.hairCol).coins || C(spec.hairCol).grit || C(spec.hairCol).dye);
  return {
    L, skin: L.skinC || C(spec.skin).c || '#f1c9a5',
    hair: (dyed ? C(spec.hairCol).c : L.hairC) || C(spec.hairCol).c || '#5c3a21',
    kit: spec.kitC || '#5c7cfa', pattern: C(spec.kit).pattern || '',
    shoe: C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa'),
    eye: L.eyeCol || '#6b4423',
    build: { slim: .9, regular: 1, athletic: 1.07, broad: 1.15 }[L.build] || 1, tall: { short: .94, average: 1, tall: 1.06 }[L.height] || 1,
    head: { round: [1, 1, .96], oval: [.94, 1.06, .95], square: [1.05, .98, .97], long: [.92, 1.1, .94], heart: [1.03, 1, .95] }[L.face] || [1, 1, .96],
  };
}
// kit patterns as textures for the shirt
function av3pattern(p, c) {
  if (!p) return null;
  const lc = av3lit(c, .55), dc = av3drk(c, .35);
  return av3canvas(256, 256, (x, w, h) => {
    x.fillStyle = c; x.fillRect(0, 0, w, h);
    if (p === 'stripes') { x.fillStyle = '#f1f3f5'; for (let i = 0; i < 16; i += 2) x.fillRect(i * 16, 0, 16, h); }
    else if (p === 'hoops') { x.fillStyle = '#f1f3f5'; for (let i = 0; i < 8; i += 2) x.fillRect(0, 30 + i * 26, w, 26); }
    else if (p === 'camo') { for (const col of ['#3f4a26', '#8a8a5c', '#2b2a1c']) { x.fillStyle = col; for (let i = 0; i < 14; i++) { x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 20, 9 + Math.random() * 12, Math.random() * 3, 0, 7); x.fill(); } } }
    else if (p === 'rainbow') { ['#e03131', '#f08c00', '#fcc419', '#40c057', '#1c7ed6', '#7048e8'].forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * h / 6, w, h / 6 + 1); }); }
    else if (p === 'checker') { x.fillStyle = '#f1f3f5'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32); }
    else if (p === 'flames') { const g = x.createLinearGradient(0, h, 0, h * .3); g.addColorStop(0, '#fcc419'); g.addColorStop(.5, '#f76707'); g.addColorStop(1, '#e03131'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); for (let i = 0; i <= 8; i++) x.quadraticCurveTo(i * 32 + 8, 40 + (i % 2) * 40, i * 32 + 16, 10 + (i % 3) * 30); x.lineTo(w, 0); x.fill(); }
    else if (p === 'galaxy') { x.fillStyle = 'rgba(132,94,247,.5)'; x.beginPath(); x.ellipse(100, 120, 90, 40, -.4, 0, 7); x.fill(); x.fillStyle = 'rgba(230,73,128,.35)'; x.beginPath(); x.ellipse(180, 170, 60, 26, .3, 0, 7); x.fill(); x.fillStyle = '#fff'; for (let i = 0; i < 60; i++) x.fillRect(Math.random() * w, Math.random() * h, i % 7 ? 2 : 4, i % 7 ? 2 : 4); }
    else if (p === 'circuit') { x.strokeStyle = '#3bc9db'; x.lineWidth = 4; x.fillStyle = '#3bc9db'; for (let i = 0; i < 12; i++) { const a = Math.random() * w, b = Math.random() * h; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 40, b); x.lineTo(a + 40, b + 30); x.stroke(); x.beginPath(); x.arc(a + 40, b + 30, 6, 0, 7); x.fill(); } }
    else if (p === 'royal') { x.fillStyle = '#fcc419'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 40, w, 10); for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * 32 + 16, h * .45, 6, 0, 7); x.fill(); } }
    else if (p === 'beta' || p === 'dev') { x.fillStyle = lc; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.fillText(p === 'beta' ? 'β' : '</>', w * .25, h * .62); x.fillText(p === 'beta' ? 'β' : '</>', w * .75, h * .62); }
    else { x.fillStyle = dc; x.fillRect(0, h * .5, w, 20); }
  });
}

// ---------- hair: one builder per style ----------
// H(h) gets { g: head group, R: head radius, m: hair material, hat: true when a hat is on, K }
const AV3_HAIR = (() => {
  const cap = (h, frac = .58, k = 1.07, tilt = -.62) => { if (h.hat || h.band) k = Math.min(k, 1.045); h.capR = Math.max(h.capR || 0, h.R * k); const c = av3mesh(h.g, av3dome(h.R * k, frac), h.m, 0, .02, -.02); c.rotation.x = tilt; return c; }; // 2.59: tight under a hat so the two never fight
  const tuft = (h, x, y, z, s, rx = 0) => { if (h.hat && y > h.R * .6) return null; const t = av3mesh(h.g, av3sph(s, 16, 12), h.m, x, y, z); t.scale.set(1.3, .7, 1); t.rotation.x = rx; return t; };
  // 2.59: drawn bottom-up so it faces outwards (it showed as a black outline before), and narrower so long hair falls behind the shoulders, not into them
  const back = (h, len, w = 1, flare = 1) => { const b = av3mesh(h.g, av3lathe([[0, -len - .02], [h.R * .8 * w * flare, -len], [h.R * .9 * w * flare, -len * .6], [h.R * .82 * w, -.02], [0, 0]], 20), h.m, 0, .12, -.15); b.scale.set(.84, 1, .6); return b; };
  const strands = (h, n, len, r, from = .45, spread = 1.15) => { if (len > .35) spread = Math.min(spread, .66); /* long strands stay behind the shoulders */ for (let i = 0; i < n; i++) { const a = Math.PI * (from + (1 - from * 2) * 0) + (i / (n - 1) - .5) * Math.PI * spread, x = Math.sin(a) * h.R * .92, z = -Math.cos(a) * h.R * .92; const l = av3mesh(h.g, av3cap(r, len, 8), h.m, x, -.02 - len / 2, z); l.rotation.z = -Math.sin(a) * .18; l.rotation.x = Math.cos(a) * .18; } };
  const curls = (h, n, r, rad, y0, y1) => { for (let i = 0; i < n; i++) { const a = i * 2.39996, t = i / n, y = y0 + (y1 - y0) * t, rr = rad * Math.sqrt(Math.max(.05, 1 - Math.pow((y - y0) / (y1 - y0 + .001) * .9, 2))); const x = Math.cos(a) * rr, z = Math.sin(a) * rr - .03; if (z > h.R * .55 && y < .22) continue; av3mesh(h.g, av3sph(r, 12, 10), h.m, x, y, z); } };
  const S = {
    short: h => { cap(h); tuft(h, .08, h.R * .78, h.R * .5, .13, -.3); },
    crop: h => { cap(h); for (let i = 0; i < 7; i++) tuft(h, (i - 3) * .07, h.R * .8 + (i % 2) * .03, h.R * .42 - Math.abs(i - 3) * .03, .08, -.4); },
    side: h => { cap(h); if (h.hat) return; const s = av3mesh(h.g, av3cap(.1, .32, 12), h.m, .02, h.R * .72, h.R * .5); s.rotation.set(.3, 0, Math.PI / 2 + .25); s.scale.z = .7; },
    fringe: h => { cap(h); const f = av3mesh(h.g, av3dome(h.R * 1.02, .3), h.m, 0, .06, .12); f.rotation.x = .9; f.scale.set(1, 1, .7); },
    quiff: h => { cap(h); if (!h.hat) { const q = av3mesh(h.g, av3sph(.2, 20, 14), h.m, 0, h.R * .92, h.R * .42); q.scale.set(1.3, .8, 1.1); q.rotation.x = -.5; } },
    slick: h => { const c = cap(h, .55, 1.06, -.45); c.scale.y = .95; },
    undercut: h => { const u = cap(h, .5, 1.02, -.3); u.material = av3mat(av3mix(h.K.hair, h.K.skin, .45)); cap(h, .36, 1.07, -.25); if (!h.hat) tuft(h, 0, h.R * .9, h.R * .3, .2, -.3); },
    frosted: h => { cap(h); const tip = av3mat('#f4e3a1'); if (!h.hat) for (let i = 0; i < 7; i++) { const c = av3mesh(h.g, av3cone(.06, .16, 8), i % 2 ? tip : h.m, (i - 3) * .075, h.R * .92 - Math.abs(i - 3) * .03, h.R * .3); c.rotation.x = .5; } },
    buzz: h => { const c = cap(h, .5, 1.025, -.3); c.material = av3mat(av3mix(h.K.hair, h.K.skin, .35)); },
    long: h => { cap(h); back(h, .62); for (const s of [-1, 1]) { const l = av3mesh(h.g, av3cap(.085, .22, 10), h.m, s * h.R * .86, -.08, -.04); l.rotation.z = s * .08; } },
    wavy: h => { cap(h); back(h, .52, 1.05, 1.1); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) av3mesh(h.g, av3sph(.095, 12, 10), h.m, s * (h.R * .84 + (i % 2) * .03), -.04 - i * .11, -.05); },
    flow: h => { cap(h); back(h, .4, 1.05, 1.1); tuft(h, -.1, h.R * .72, h.R * .5, .14, -.2); for (const s of [-1, 1]) av3mesh(h.g, av3cap(.09, .22, 10), h.m, s * h.R * .88, -.12, 0); },
    bob: h => { cap(h, .58, 1.07, -.3); const b = av3mesh(h.g, new THREE.SphereGeometry(h.R * 1.12, 28, 16, 0, Math.PI * 2, 0, Math.PI * .72), h.m, 0, .02, -.06); b.scale.z = .95; b.material = av3mat(h.K.hair, { ds: true }); },
    curly: h => { cap(h, .5, 1.04); curls(h, h.hat ? 14 : 26, .1, h.R * 1.0, -.05, h.R * 1.0); },
    afro: h => { if (h.hat) { cap(h, .55, 1.12); curls(h, 14, .11, h.R * 1.02, -.22, .0); return; } const a = av3mesh(h.g, av3sph(h.R * 1.4, 28, 20), h.m, 0, h.R * .4, -.2); a.scale.z = .85; },
    pony: h => { cap(h, .55, 1.06, -.5); const t = av3mesh(h.g, av3cap(.1, .42, 12), h.m, 0, -.08, -h.R * 1.05); t.rotation.x = .35; av3mesh(h.g, av3tor(.07, .025), av3mat('#e64980'), 0, .14, -h.R * 1.02).rotation.x = Math.PI / 2 - .3; },
    bun: h => { cap(h, .55, 1.06, -.5); if (!h.hat) av3mesh(h.g, av3sph(.15, 16, 12), h.m, 0, h.R * .82, -h.R * .62); },
    topknot: h => { cap(h, .5, 1.03, -.3).material = av3mat(av3mix(h.K.hair, h.K.skin, .2)); if (!h.hat) { av3mesh(h.g, av3sph(.14, 16, 12), h.m, 0, h.R * 1.08, -.05); av3mesh(h.g, av3tor(.07, .03), av3mat('#c92a2a'), 0, h.R * .98, -.05).rotation.x = Math.PI / 2; } },
    spacebuns: h => { cap(h); if (!h.hat) for (const s of [-1, 1]) av3mesh(h.g, av3sph(.15, 16, 12), h.m, s * h.R * .62, h.R * .8, -.05); },
    pigtails: h => { cap(h); for (const s of [-1, 1]) { const t = av3mesh(h.g, av3cap(.09, .3, 10), h.m, s * h.R * 1.05, -.05, -.08); t.rotation.z = s * .5; av3mesh(h.g, av3sph(.05, 10, 8), av3mat('#f06595'), s * h.R * .98, .1, -.08, { ol: false }); } },
    mohawk: h => { cap(h, .5, 1.02, -.3).material = av3mat(av3mix(h.K.hair, h.K.skin, .45)); if (!h.hat) for (let i = 0; i < 6; i++) { const a = -.6 + i * .32, c = av3mesh(h.g, av3cone(.07, .3, 8), h.m, 0, Math.cos(a) * h.R * 1.02, Math.sin(a) * h.R * 1.02); c.rotation.x = a; c.scale.z = .45; } },
    spiky: h => { cap(h); if (!h.hat) for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.2, c = av3mesh(h.g, av3cone(.09, .3, 8), h.m, Math.sin(a) * h.R * .7, h.R * .82 + Math.cos(a) * .06, Math.cos(a * 1.3) * .08); c.rotation.z = -a * .6; c.rotation.x = -.25; } },
    hero: h => { cap(h, .55, 1.06, -.4); const n = h.hat ? 0 : 6; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - .5) * 1.8, c = av3mesh(h.g, av3cone(.11, .5, 8), h.m, Math.sin(a) * h.R * .62, h.R * .7, -.22); c.rotation.set(-1.15, 0, -a * .5); } tuft(h, -.12, h.R * .7, h.R * .55, .1, -.2); },
    mullet: h => { cap(h); back(h, .42, 1, 1.2); tuft(h, .06, h.R * .75, h.R * .52, .12, -.3); },
    locs: h => { cap(h, .54, 1.07); strands(h, 13, .5, .045, 0, 1.05); },
    braids: h => { cap(h, .54, 1.06); strands(h, 15, .58, .035, 0, 1.05); },
    twists: h => { cap(h, .54, 1.08); strands(h, 12, .28, .05, 0, 1.0); curls(h, 10, .07, h.R * .95, h.R * .4, h.R * 1.0); },
    cornrows: h => { cap(h, .5, 1.03, -.3); for (let i = -2; i <= 2; i++) { const r = av3mesh(h.g, av3tor(h.R * 1.03, .025, Math.PI * .9, 6, 24), h.m, i * .07, .02, -.02); r.rotation.set(0, Math.PI / 2, -Math.PI * .05); } },
    hightop: h => { cap(h); if (!h.hat) av3mesh(h.g, av3cyl(h.R * .78, h.R * .84, .32, 24), h.m, 0, h.R * .95, -.04); },
    wolf: h => { cap(h, .55, 1.09); back(h, .3, 1.05, 1.1); for (let i = 0; i < 6; i++) tuft(h, (i - 2.5) * .1, h.R * .62 + (i % 2) * .05, h.R * .55, .1, .2); },
  };
  return S;
})();
const AV3_HAIR_OF = { h_short: 'short', h_crop: 'crop', h_side: 'side', h_fringe: 'fringe', h_quiff: 'quiff', h_slick: 'slick', h_undercut: 'undercut', h_frosted: 'frosted', h_buzz: 'buzz', h_long: 'long', h_wavy: 'wavy', h_flow: 'flow', h_bob: 'bob', h_curly: 'curly', h_afro: 'afro', h_pony: 'pony', h_bun: 'bun', h_topknot: 'topknot', h_spacebuns: 'spacebuns', h_pigtails: 'pigtails', h_mohawk: 'mohawk', h_spiky: 'spiky', h_hero: 'hero', h_mullet: 'mullet', h_locs: 'locs', h_braids: 'braids', h_twists: 'twists', h_cornrows: 'cornrows', h_hightop: 'hightop', h_wolf: 'wolf' };

// ---------- headwear ----------
// T(h) gets the same { g, R, K } and builds on the head
const AV3_HAT = (() => {
  const dome = (h, col, k = 1.12, frac = .5, y = .05, tilt = -.15) => { const d = av3mesh(h.g, av3dome(h.R * k, frac), av3mat(col), 0, y, -.01); d.rotation.x = tilt; return d; };
  // 2.59: a peak sits on the cap's rim at the forehead instead of cutting through the crown
  const brim = (h, col, r = .3, fwd = .3, y = .11, tilt = .1) => { const b = av3mesh(h.g, av3cyl(r, r, .035, 24), av3mat(col), 0, y, fwd); b.scale.z = .8; b.rotation.x = tilt; return b; };
  // a band round the head (sweatband, ninja band, headband gear) sits just outside the hair
  const ringR = (h, y) => { const b = Math.max(h.capR || 0, h.R * h.K.head[0]); return Math.sqrt(Math.max(.01, b * b - (y - .02) ** 2)) + .022; };
  const horn = (h, col, s, big = 1) => { const c = av3mesh(h.g, av3cone(.07 * big, .3 * big, 10), av3mat(col), s * h.R * .62, h.R * .9, 0); c.rotation.z = -s * .55; return c; };
  return {
    hat_band: h => { const b = av3mesh(h.g, av3tor(ringR(h, .22), .045), av3mat('#e03131'), 0, .22, -.01); b.rotation.x = Math.PI / 2 + .2; b.scale.y = .92; },
    hat_cap: h => { dome(h, '#1c7ed6'); brim(h, '#1971c2', .3, h.R * .95); av3mesh(h.g, av3sph(.03, 8, 6), av3mat('#1971c2'), 0, h.R * 1.12 + .03, 0, { ol: false }); },
    hat_backcap: h => { dome(h, '#e03131'); brim(h, '#c92a2a', .28, -h.R * .95, .1, -.18); },
    hat_snap: h => { dome(h, '#212529'); const b = brim(h, '#f1f3f5', .34, h.R * .98, .08, .02); b.scale.z = .7; },
    hat_beta: h => { dome(h, '#7048e8'); brim(h, '#5f3dc4', .3, h.R * .95); },
    hat_beanie: h => { dome(h, '#364fc7', 1.13, .52, .02, -.18); av3mesh(h.g, av3tor(h.R * 1.1, .06), av3mat('#4c6ef5'), 0, .07, -.01).rotation.x = Math.PI / 2 - .18; av3mesh(h.g, av3sph(.09, 14, 10), av3mat('#dbe4ff'), 0, h.R * 1.18, -.08); },
    hat_crown: h => { const g = av3mat('#fcc419', { e: '#7a5200', ei: .25 }); av3mesh(h.g, av3cyl(h.R * .78, h.R * .72, .14, 24, true), av3mat('#fcc419', { ds: true }), 0, h.R * .95, -.04); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; av3mesh(h.g, av3cone(.06, .16, 6), g, Math.sin(a) * h.R * .75, h.R * .95 + .14, Math.cos(a) * h.R * .75 - .04); av3mesh(h.g, av3sph(.035, 8, 6), av3mat(['#e03131', '#1c7ed6', '#40c057'][i % 3]), Math.sin(a) * h.R * .78, h.R * .95, Math.cos(a) * h.R * .78 - .04, { ol: false }); } },
    hat_phones: h => { av3mesh(h.g, av3tor(h.R * 1.08, .04, Math.PI), av3mat('#212529'), 0, .02, 0); for (const s of [-1, 1]) { const c = av3mesh(h.g, av3cyl(.12, .12, .1, 20), av3mat('#e64980'), s * h.R * 1.05, 0, 0); c.rotation.z = Math.PI / 2; } },
    hat_bucket: h => { dome(h, '#e9ecef', 1.1, .5, .1, 0); av3mesh(h.g, av3cyl(h.R * 1.1, h.R * 1.4, .1, 24, true), av3mat('#dee2e6', { ds: true }), 0, .1, 0); },
    hat_party: h => { av3mesh(h.g, av3cone(.2, .5, 16), av3mat('#f06595'), 0, h.R * 1.18, -.02); av3mesh(h.g, av3sph(.06, 10, 8), av3mat('#fcc419'), 0, h.R * 1.18 + .27, -.02); },
    hat_viking: h => { dome(h, '#868e96', 1.13, .52, .02, -.1); av3mesh(h.g, av3tor(h.R * 1.11, .04), av3mat('#5c4033'), 0, .06, 0).rotation.x = Math.PI / 2; for (const s of [-1, 1]) { const c = av3mesh(h.g, av3cone(.08, .34, 10), av3mat('#f8f1e3'), s * h.R * 1.05, h.R * .55, 0); c.rotation.z = -s * 1.0; } },
    hat_halo: h => av3mesh(h.g, av3tor(.24, .03), av3mat('#ffe066', { flat: true }), 0, h.R * 1.45, -.04, { ol: false, sh: false }).rotation.x = Math.PI / 2,
    hat_horns: h => { for (const s of [-1, 1]) horn(h, '#e03131', s); },
    hat_goat: h => { for (const s of [-1, 1]) { const c = av3mesh(h.g, av3tor(.16, .045, Math.PI * 1.3, 8, 20), av3mat('#fcc419'), s * h.R * .55, h.R * .9, -.05); c.rotation.set(0, Math.PI / 2, s > 0 ? 0 : Math.PI); } },
    hat_durag: h => { dome(h, '#212529', 1.1, .55, .02, -.25); const t = av3mesh(h.g, av3cap(.05, .3, 8), av3mat('#212529'), .05, -.12, -h.R * 1.0); t.rotation.x = .3; },
    hat_bandana: h => { dome(h, '#c92a2a', 1.1, .5, .03, -.3); av3mesh(h.g, av3sph(.07, 10, 8), av3mat('#c92a2a'), 0, .05, -h.R * 1.02); for (const s of [-1, 1]) { const t = av3mesh(h.g, av3cap(.035, .16, 6), av3mat('#c92a2a'), s * .06, -.06, -h.R * 1.02); t.rotation.z = s * .5; } },
    hat_beret: h => { const b = av3mesh(h.g, av3sph(h.R * 1.05, 24, 12), av3mat('#862e9c'), -.06, h.R * .78, 0); b.scale.y = .32; b.rotation.z = .2; },
    hat_flowers: h => { const cols = ['#f06595', '#fcc419', '#ffffff', '#74c0fc', '#ff8787']; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; av3mesh(h.g, av3sph(.065, 10, 8), av3mat(cols[i % 5]), Math.sin(a) * h.R * .92, h.R * .55, Math.cos(a) * h.R * .92 - .03); } },
    hat_helmet: h => { const d = dome(h, '#40c057', 1.14, .5, .04, -.12); d.scale.z = 1.15; for (let i = -1; i <= 1; i++) av3mesh(h.g, new THREE.BoxGeometry(.05, .03, .3), av3mat('#212529'), i * .12, h.R * 1.17, 0, { ol: false }); },
    hat_cowboy: h => { av3mesh(h.g, av3cyl(h.R * .78, h.R * .9, .3, 24), av3mat('#8b5a2b'), 0, h.R * .9, -.02); const b = av3mesh(h.g, new THREE.TorusGeometry(h.R * 1.15, .12, 8, 32), av3mat('#7a4a22'), 0, h.R * .72, -.02); b.rotation.x = Math.PI / 2; b.scale.z = .25; av3mesh(h.g, av3cyl(h.R * 1.15, h.R * 1.15, .03, 32), av3mat('#7a4a22'), 0, h.R * .7, -.02); },
    hat_tophat: h => { av3mesh(h.g, av3cyl(h.R * .72, h.R * .72, .5, 24), av3mat('#212529'), 0, h.R * 1.15, -.04); av3mesh(h.g, av3cyl(h.R * 1.05, h.R * 1.05, .03, 28), av3mat('#212529'), 0, h.R * .86, -.04); av3mesh(h.g, av3cyl(h.R * .73, h.R * .73, .08, 24, true), av3mat('#c92a2a', { ds: true }), 0, h.R * .96, -.04, { ol: false }); },
    hat_wizard: h => { const c = av3mesh(h.g, av3cone(h.R * .78, .8, 20), av3mat('#5f3dc4'), 0, h.R * .82 + .4, -.08); c.rotation.x = -.18; av3mesh(h.g, av3cyl(h.R * 1.2, h.R * 1.2, .03, 28), av3mat('#5f3dc4'), 0, h.R * .82, -.04); const s = av3mesh(h.g, av3star(.07), av3mat('#fcc419', { e: '#fcc419', ei: .4 }), .05, h.R * .82 + .25, h.R * .5, { ol: false }); s.rotation.x = -.2; },
    // 2.58 new headwear
    hat_hood: h => { const c = av3mesh(h.g, new THREE.SphereGeometry(h.R * 1.2, 28, 16, 0, Math.PI * 2, 0, Math.PI * .62), av3mat('#2b8a3e', { ds: true }), 0, .02, -.06); c.rotation.x = -.55; const t = av3mesh(h.g, av3cone(.1, .3, 10), av3mat('#2b8a3e'), 0, .2, -h.R * 1.15); t.rotation.x = -2.2; },
    hat_catears: h => { for (const s of [-1, 1]) { const e = av3mesh(h.g, av3cone(.11, .2, 4), av3mat(h.K.hair), s * h.R * .55, h.R * .95, -.02); e.rotation.z = -s * .35; av3mesh(e, av3cone(.06, .12, 4), av3mat('#ffa8c5'), 0, -.02, .035, { ol: false }); } },
    hat_antlers: h => { const m = av3mat('#8b5a2b'); for (const s of [-1, 1]) { const a = av3mesh(h.g, av3cap(.03, .32, 6), m, s * h.R * .6, h.R * 1.05, -.05); a.rotation.z = -s * .5; for (let i = 0; i < 2; i++) { const b = av3mesh(a, av3cap(.022, .14, 6), m, 0, i * .1, 0); b.position.x = s * .06; b.rotation.z = -s * .9; } } },
    hat_ninja: h => { const nb = av3mesh(h.g, av3tor(ringR(h, .22), .05), av3mat('#212529'), 0, .22, -.01); nb.rotation.x = Math.PI / 2 + .2; nb.scale.y = .92; for (const s of [-1, 1]) { const t = av3mesh(h.g, av3cap(.035, .24, 6), av3mat('#212529'), s * .07, .22, -(ringR(h, .3) + .03)); t.rotation.set(.4, 0, s * .6); } const m = av3mesh(h.g, new THREE.SphereGeometry(h.R * 1.03, 28, 12, -Math.PI * .5, Math.PI, Math.PI * .58, Math.PI * .42), av3mat('#343a40', { ds: true }), 0, 0, 0); m.scale.z = 1.02; },
    hat_knight: h => { const M = av3mat('#ced4da', { e: '#495057', ei: .2 }); dome(h, '#ced4da', 1.14, .62, .0, 0).material = M; for (let i = -1; i <= 1; i += 2) av3mesh(h.g, new THREE.BoxGeometry(.3, .02, .02), av3mat('#212529'), 0, .02 + i * .03, h.R * 1.1, { ol: false }); for (let i = 0; i < 6; i++) { const p = av3mesh(h.g, av3sph(.08, 12, 10), av3mat('#e03131'), 0, h.R * 1.1 + Math.sin(i / 5 * 2.4) * .14, .1 - i * .08); p.scale.set(.7, 1, 1.1); } },
    hat_samurai: h => { dome(h, '#212529', 1.14, .5, .04, -.1); const s = av3mesh(h.g, av3cyl(h.R * 1.15, h.R * 1.45, .14, 24, true), av3mat('#343a40', { ds: true }), 0, .1, -.06); s.rotation.x = -.5; /* the neck guard rises at the front so it never covers the eyes */ const c = av3mesh(h.g, av3tor(.2, .03, Math.PI, 8, 20), av3mat('#fcc419', { e: '#7a5200', ei: .3 }), 0, h.R * .95, h.R * .5); c.rotation.x = -.3; av3mesh(h.g, av3sph(.05, 10, 8), av3mat('#e03131'), 0, h.R * .82, h.R * .82, { ol: false }); },
    hat_astro: h => { av3mesh(h.g, av3sph(h.R * 1.38, 32, 20), av3mat('#a5d8ff', { op: .22 }), 0, .02, 0, { sh: false }); av3mesh(h.g, av3tor(h.R * 1.0, .08), av3mat('#f8f9fa'), 0, -h.R * .95, 0).rotation.x = Math.PI / 2; av3mesh(h.g, av3sph(.04, 8, 6), av3mat('#ff6b6b', { flat: true }), h.R * .9, -h.R * .9, h.R * .4, { ol: false }); },
    hat_jester: h => { dome(h, '#7048e8', 1.1, .5, .04, -.15); for (const [s, col] of [[-1, '#7048e8'], [1, '#fcc419']]) { const c = av3mesh(h.g, av3cone(.1, .4, 10), av3mat(col), s * h.R * .7, h.R * .95, -.05); c.rotation.z = -s * 1.1; av3mesh(c, av3sph(.05, 8, 6), av3mat('#ffffff'), 0, .22, 0); } },
  };
})();

// ---------- eyewear (on the face, at eye height) ----------
const AV3_EYE = (() => {
  const pair = (h, geo, mat, z = .05, o) => [-1, 1].map(s => av3mesh(h.g, geo, mat, s * .15, h.eyY, h.fz(s * .15, h.eyY) + z, o));
  const bar = (h, col, w = .12, y = 0) => { const b = av3mesh(h.g, av3cap(.012, w, 6), av3mat(col), 0, h.eyY + y, h.fz(0, h.eyY) + .06, { ol: false }); b.rotation.z = Math.PI / 2; return b; };
  const strapR = h => Math.max(h.capR || 0, h.R * h.K.head[0]) + .02; // 2.59: straps go round the hair, not through it
  const strap = (h, col, y = 0) => av3mesh(h.g, av3tor(strapR(h), .025), av3mat(col), 0, h.eyY + y, -.01, { ol: false }).rotation.x = Math.PI / 2;
  const lens = (r, sy = .8, sz = .35) => { const g = av3sph(r, 18, 12); g.scale(1, sy, sz); return g; };
  return {
    eye_sport: h => { const v = av3mesh(h.g, new THREE.CylinderGeometry(h.R * 1.22, h.R * 1.22, .1, 32, 1, true, -Math.PI * .3, Math.PI * .6), av3mat('#1c7ed6', { ds: true, e: '#0b3d91', ei: .3 }), 0, h.eyY + .01, -.02); v.scale.z = h.K.head[2] * 1.02; },
    eye_aviator: h => { pair(h, lens(.08, .85), av3mat('#343a40', { e: '#495057', ei: .2 })); bar(h, '#fcc419'); },
    eye_star: h => { pair(h, av3star(.1), av3mat('#f06595'), .06); },
    eye_heart: h => { pair(h, av3heart(.07), av3mat('#e64980'), .06); },
    eye_paint: h => { for (const s of [-1, 1]) { const p = av3mesh(h.g, av3cap(.02, .08, 6), av3mat('#212529'), s * .15, h.eyY - .1, h.fz(s * .15, h.eyY - .1) + .01, { ol: false }); p.rotation.z = Math.PI / 2; } },
    eye_goggles: h => { pair(h, lens(.085, .8, .4), av3mat('#74c0fc', { e: '#1971c2', ei: .25 })); pair(h, av3tor(.085, .02, Math.PI * 2, 8, 20), av3mat('#1971c2'), .06, { ol: false }); bar(h, '#1971c2', .08); strap(h, '#212529'); },
    eye_nerd: h => { pair(h, av3tor(.085, .018, Math.PI * 2, 8, 22), av3mat('#212529'), .055, { ol: false }); bar(h, '#212529', .06); },
    eye_laser: h => { pair(h, av3sph(.07, 14, 10), av3mat('#ff2a2a', { flat: true }), .03, { ol: false }); h.glow = '#ff2a2a'; },
    eye_3d: h => { pair(h, new THREE.BoxGeometry(.19, .14, .02), av3mat('#f8f9fa'), .05); const [a, b] = pair(h, new THREE.BoxGeometry(.15, .1, .02), av3mat('#fa5252', { op: .9 }), .065); b.material = av3mat('#4dabf7', { op: .9 }); bar(h, '#f8f9fa', .06); },
    eye_mono: h => { av3mesh(h.g, av3tor(.085, .016, Math.PI * 2, 8, 22), av3mat('#fcc419'), .15, h.eyY, h.fz(.15, h.eyY) + .055, { ol: false }); },
    eye_ski: h => { const v = av3mesh(h.g, av3sph(.2, 24, 12), av3mat('#ff922b', { e: '#e8590c', ei: .3 }), 0, h.eyY, h.fz(0, h.eyY) - .02); v.scale.set(1.35, .5, .45); strap(h, '#212529'); },
    eye_visor: h => { const v = av3mesh(h.g, new THREE.CylinderGeometry(h.R * 1.22, h.R * 1.22, .12, 32, 1, true, -Math.PI * .32, Math.PI * .64), av3mat('#3bc9db', { flat: true, op: .9, ds: true }), 0, h.eyY, -.02, { sh: false }); v.scale.z = h.K.head[2] * 1.03; },
    eye_vr: h => { const b = av3mesh(h.g, new THREE.BoxGeometry(.48, .2, .16), av3mat('#f8f9fa'), 0, h.eyY, h.fz(0, h.eyY) + .03); av3mesh(b, new THREE.BoxGeometry(.4, .12, .02), av3mat('#212529'), 0, 0, .085, { ol: false }); strap(h, '#343a40'); },
    eye_titan: h => { const v = av3mesh(h.g, new THREE.CylinderGeometry(h.R * 1.22, h.R * 1.22, .12, 32, 1, true, -Math.PI * .3, Math.PI * .6), av3mat('#fcc419', { e: '#a87b00', ei: .4, ds: true }), 0, h.eyY, -.02); v.scale.z = h.K.head[2] * 1.03; },
    // 2.58 new eyewear
    eye_patch: h => { av3mesh(h.g, lens(.08, .9, .3), av3mat('#212529'), -.15, h.eyY, h.fz(-.15, h.eyY) + .04); const s = av3mesh(h.g, av3tor(strapR(h), .012), av3mat('#212529'), 0, h.eyY + .05, -.01, { ol: false }); s.rotation.set(Math.PI / 2, .3, 0); },
    eye_cyber: h => { av3mesh(h.g, av3cyl(.08, .08, .05, 20), av3mat('#343a40'), .15, h.eyY, h.fz(.15, h.eyY) + .04).rotation.x = Math.PI / 2; av3mesh(h.g, av3sph(.05, 12, 10), av3mat('#ff3b3b', { flat: true }), .15, h.eyY, h.fz(.15, h.eyY) + .07, { ol: false }); h.glow = '#ff3b3b'; },
    eye_mask: h => { const m = av3mesh(h.g, av3shape(s => { s.moveTo(-.3, 0); s.quadraticCurveTo(-.2, .14, 0, .05); s.quadraticCurveTo(.2, .14, .3, 0); s.quadraticCurveTo(.2, -.12, 0, -.03); s.quadraticCurveTo(-.2, -.12, -.3, 0); }, .015, .006), av3mat('#7048e8', { e: '#3b1f9a', ei: .3 }), 0, h.eyY + .01, h.fz(0, h.eyY) + .05); m.scale.set(1.05, 1.1, 1); },
  };
})();

// ---------- extras on the body ----------
// X(P, K) gets the figure's attach points
const AV3_EXTRA = (() => {
  const T = AV3_STYLE;
  const cape = (P, col, inner, trim) => { const c = new THREE.Group(); c.position.set(0, T.torsoH - .04, -.26); c.scale.set(P.bulk || 1, 1, P.bulk || 1); P.chest.add(c); // 2.59: wider over bulky chest gear so it never cuts into it
    const m = av3mesh(c, new THREE.CylinderGeometry(.34, .5, 1.05, 20, 4, true, Math.PI * .62, Math.PI * .76), av3mat(col, { ds: true }), 0, -.52, .26); m.material = av3mat(col, { ds: true }); if (trim) av3mesh(c, av3tor(.24, .055, Math.PI * 2, 8, 20), av3mat(trim), 0, .02, .2).rotation.x = Math.PI / 2; P.cape = c; return c; };
  const wings = (P, mk) => { const W = []; for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * .1, T.torsoH * .82, -.28); w.scale.setScalar(1.4); P.chest.add(w); mk(w, s); W.push(w); } P.wings = W; };
  const feather = (w, s, col, op) => { for (let i = 0; i < 5; i++) { const f = av3mesh(w, av3cap(.07, .42 - i * .05, 10), av3mat(col, op ? { op, e: col, ei: .5 } : {}), s * (.2 + i * .07), .2 - i * .1, -.02 * i, op ? { ol: false } : {}); f.rotation.z = -s * (.95 - i * .28); f.scale.z = .35; } };
  const backZ = P => -.3 - (P.backZ || 0); // things on your back sit further out over a hoodie or armour
  const onBack = (P, geo, mat, x, y, rz = 0) => { const m = av3mesh(P.chest, geo, mat, x, y, backZ(P)); m.rotation.z = rz; return m; };
  const inHand = (P, i, geo, mat, x = 0, y = -.05, z = .1) => av3mesh(P.hands[i], geo, mat, x, y, z);
  return {
    x_chain: P => { av3mesh(P.chest, av3tor(.2, .025, Math.PI * 2, 8, 24), av3mat('#fcc419', { e: '#7a5200', ei: .2 }), 0, T.torsoH - .08, .1, { ol: false }).rotation.x = Math.PI / 2 - .5; },
    x_medal: P => { av3mesh(P.chest, av3cyl(.08, .08, .03, 20), av3mat('#fcc419', { e: '#7a5200', ei: .25 }), 0, T.torsoH * .55, .33).rotation.x = Math.PI / 2; },
    x_cape: P => cape(P, '#e03131'),
    x_wings: P => wings(P, (w, s) => feather(w, s, '#ffffff')),
    x_aura: P => { P.flames = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, f = av3mesh(P.fig, av3cone(.08, .34, 8), av3mat(i % 2 ? '#ff922b' : '#fcc419', { flat: true, op: .75 }), Math.cos(a) * .5, .17, Math.sin(a) * .5, { ol: false, sh: false }); f.userData.a = a; P.flames.push(f); } },
    x_ball: P => { const b = inHand(P, 0, av3sph(.14, 18, 12), av3mat('#c2410c'), 0, 0, .12); b.scale.set(.8, .8, 1.25); },
    x_trophy: P => { const g = av3mat('#fcc419', { e: '#7a5200', ei: .2 }); inHand(P, 1, av3cyl(.12, .06, .18, 16), g, 0, .14, .1); inHand(P, 1, av3cyl(.03, .03, .1, 8), g, 0, .02, .1); inHand(P, 1, new THREE.BoxGeometry(.14, .05, .14), av3mat('#495057'), 0, -.04, .1); },
    x_books: P => { ['#e03131', '#1c7ed6', '#2f9e44'].forEach((c, i) => inHand(P, 0, new THREE.BoxGeometry(.28, .06, .2), av3mat(c), 0, .1 - i * .065, .1)); },
    x_sparkle: P => { P.sparks = []; for (let i = 0; i < 8; i++) { const s = av3mesh(P.fig, av3star(.05), av3mat('#fcc419', { flat: true }), 0, 0, 0, { ol: false, sh: false }); s.userData = { a: i / 8 * Math.PI * 2, y: .4 + Math.random() * 1.4 }; P.sparks.push(s); } },
    x_belt: P => { av3mesh(P.chest, av3tor(.3, .05, Math.PI * 2, 8, 28), av3mat('#212529'), 0, .06, 0).rotation.x = Math.PI / 2; av3mesh(P.chest, new THREE.BoxGeometry(.22, .14, .04), av3mat('#fcc419', { e: '#7a5200', ei: .25 }), 0, .06, .3); },
    x_backpack: P => { onBack(P, av3cap(.2, .14, 12), av3mat('#1c7ed6'), 0, T.torsoH * .45).scale.z = .55; },
    x_guitar: P => { const g = new THREE.Group(); g.position.set(0, T.torsoH * .45, backZ(P) - .02); g.rotation.z = .7; P.chest.add(g); const b = av3mesh(g, av3sph(.17, 18, 12), av3mat('#e8590c'), 0, -.15, 0); b.scale.z = .35; av3mesh(g, new THREE.BoxGeometry(.05, .5, .03), av3mat('#6b4423'), 0, .2, 0); },
    x_skate: P => { const s = onBack(P, new THREE.BoxGeometry(.2, .7, .03), av3mat('#e64980'), 0, T.torsoH * .45, .3); for (const y of [-.25, .25]) av3mesh(s, av3cyl(.03, .03, .22, 10), av3mat('#fcc419'), 0, y, -.04).rotation.z = Math.PI / 2; },
    x_jetpack: P => { P.jets = []; for (const s of [-1, 1]) { onBack(P, av3cap(.08, .26, 12), av3mat('#adb5bd'), s * .11, T.torsoH * .5); const f = av3mesh(P.chest, av3cone(.06, .22, 10), av3mat('#ff922b', { flat: true, op: .85 }), s * .11, T.torsoH * .5 - .3, backZ(P), { ol: false, sh: false }); f.rotation.x = Math.PI; P.jets.push(f); } },
    x_laptop: P => { inHand(P, 0, new THREE.BoxGeometry(.3, .02, .22), av3mat('#495057'), 0, .02, .1); },
    // 2.58 new extras
    x_scarf: P => { av3mesh(P.chest, av3tor(.2, .07, Math.PI * 2, 10, 24), av3mat('#e03131'), 0, T.torsoH - .02, .02).rotation.x = Math.PI / 2; const t = av3mesh(P.chest, av3cap(.055, .4, 8), av3mat('#e03131'), .12, T.torsoH - .1, -.25); t.rotation.set(-1.0, 0, -.3); t.scale.x = 1.4; P.scarf = t; },
    x_pauldrons: P => { for (const A of P.arms) { const s = av3mesh(A, av3dome(P.pads ? .2 : .17, .5, 20), av3mat('#adb5bd', { e: '#343a40', ei: .15 }), 0, P.pads ? .05 : .03, 0); s.scale.y = .8; av3mesh(A, av3sph(.03, 8, 6), av3mat('#fcc419'), 0, .17, 0, { ol: false }); } },
    x_sword: P => { const g = new THREE.Group(); g.position.set(0, T.torsoH * .5, backZ(P) - .04); g.rotation.z = -.6; P.chest.add(g); av3mesh(g, new THREE.BoxGeometry(.07, .78, .02), av3mat('#dee2e6', { e: '#495057', ei: .2 }), 0, .3, 0); av3mesh(g, new THREE.BoxGeometry(.24, .05, .05), av3mat('#fcc419'), 0, -.1, 0); av3mesh(g, av3cyl(.03, .03, .2, 8), av3mat('#5c4033'), 0, -.22, 0); },
    x_shield: P => { const s = onBack(P, av3cyl(.3, .3, .05, 24), av3mat('#1c7ed6'), 0, T.torsoH * .45); s.rotation.x = Math.PI / 2; av3mesh(s, av3tor(.28, .03, Math.PI * 2, 8, 28), av3mat('#fcc419'), 0, 0, 0, { ol: false }).rotation.x = Math.PI / 2; av3mesh(s, av3star(.12), av3mat('#f8f9fa'), 0, -.04, 0, { ol: false }).rotation.x = Math.PI / 2; },
    x_staff: P => { const h = new THREE.Group(); h.rotation.z = -.38; P.hands[1].add(h); /* leans out, away from your head */ av3mesh(h, av3cyl(.03, .035, 1.4, 10), av3mat('#6b4423'), 0, .2, .08); av3mesh(h, av3sph(.1, 16, 12), av3mat('#9775fa', { flat: true }), 0, .95, .08, { ol: false }); P.glowAt = [h, 0, .95, .08, '#9775fa']; P.charm.position.x = -.74; },
    x_capeRoyal: P => cape(P, '#a61e4d', '', '#f8f9fa'),
    x_capeVoid: P => { const c = cape(P, '#1a1033'); c.children[0].material = av3mat('#2b1d5c', { ds: true, e: '#5f3dc4', ei: .35 }); for (let i = 0; i < 14; i++) { const a = Math.PI * (.66 + Math.random() * .68), y = -.1 - Math.random() * .9; av3mesh(c, av3star(.025), av3mat('#ffffff', { flat: true }), Math.sin(a) * (.36 + (-y) * .15) * 1.04, y, .26 + Math.cos(a) * (.36 + (-y) * .15) * 1.04, { ol: false, sh: false }).lookAt(0, y, -2); } },
    x_wingsLight: P => wings(P, (w, s) => feather(w, s, '#66d9e8', .55)),
    x_wingsDragon: P => wings(P, (w, s) => { const m = av3mat('#c92a2a', { ds: true }); for (let i = 0; i < 3; i++) { const b = av3mesh(w, av3cap(.025, .6 - i * .12, 6), av3mat('#5c1a1a'), s * (.18 + i * .12), .2 - i * .06, 0); b.rotation.z = -s * (.9 - i * .3); } const mem = av3mesh(w, av3shape(sh => { sh.moveTo(0, 0); sh.lineTo(.62, .5); sh.quadraticCurveTo(.55, .1, .6, -.1); sh.quadraticCurveTo(.4, -.05, .38, -.25); sh.quadraticCurveTo(.2, -.1, 0, -.15); }, .01, .004), m, s * .3, .08, -.02); mem.scale.x = s; }),
    x_orbs: P => { P.orbs = []; ['#4dabf7', '#ffd43b', '#ff6b6b'].forEach((c, i) => { const o = av3mesh(P.fig, av3sph(.07, 14, 10), av3mat(c, { flat: true }), 0, 0, 0, { ol: false, sh: false }); o.userData.a = i * 2.09; P.orbs.push(o); }); },
  };
})();

// ---------- gear on the model: one builder per template, coloured by rarity ----------
// P = attach points, c = rarity colour, M = metal version of it, gl = legendary glow
const AV3_GEAR = (() => {
  const T = AV3_STYLE;
  return {
    'Study Cap': (P, c) => { const g = P.head; av3mesh(g, av3dome(T.headR * 1.06, .4), av3mat('#212529'), 0, .12, 0); const b = av3mesh(g, new THREE.BoxGeometry(.72, .05, .72), av3mat('#212529'), 0, T.headR * .78 + .1, -.02); b.rotation.y = Math.PI / 4; av3mesh(g, av3sph(.04), av3mat(c), 0, T.headR * .78 + .14, -.02, { ol: false }); const t = av3mesh(g, av3cap(.02, .22, 6), av3mat(c), .3, T.headR * .78, .1); t.rotation.z = .1; },
    Helm: (P, c, M) => { const g = P.head, h = av3mesh(g, av3dome(T.headR * 1.16, .56), M, 0, .0, -.02); h.scale.y = 1.04; h.rotation.x = -.42; av3mesh(g, new THREE.BoxGeometry(.05, .16, .05), M, 0, .1, T.headR * 1.06); for (let i = 0; i < 5; i++) av3mesh(g, av3sph(.06, 10, 8), av3mat(c), 0, T.headR * 1.12 - i * .02, .16 - i * .12); for (const s of [-1, 1]) { const ch = av3mesh(g, av3sph(.14, 14, 10), M, s * T.headR * .98, -.1, -.04); ch.scale.set(.3, 1, .9); } },
    Headband: (P, c, M, gl, h) => { const hb = av3mesh(P.head, av3tor(h ? h.ringR(.22) : T.headR, .045), av3mat(c), 0, .22, -.01); hb.rotation.x = Math.PI / 2 + .2; hb.scale.y = .92; for (const s of [-1, 1]) { const t = av3mesh(P.head, av3cap(.03, .2, 6), av3mat(c), s * .05, .2, -(h ? h.ringR(.3) + .03 : T.headR * 1.05)); t.rotation.set(.5, 0, s * .6); } },
    Hoodie: (P, c) => { P.bulk = 1.1; P.backZ = .12; const b = av3mesh(P.chest, av3lathe([[0, -.02], [.31, -.01], [.33, .12], [.39, .44], [.36, .58], [.2, .66], [0, .67]]), av3mat(c)); b.scale.z = .84; av3mesh(P.chest, av3tor(.2, .08, Math.PI * 2, 10, 20), av3mat(av3drk(c, .15)), 0, T.torsoH - .04, -.12).rotation.x = Math.PI / 2.6; av3mesh(P.chest, new THREE.BoxGeometry(.3, .12, .04), av3mat(av3drk(c, .12)), 0, .18, .29); for (const s of [-1, 1]) av3mesh(P.chest, av3cap(.012, .12, 6), av3mat('#f8f9fa'), s * .06, T.torsoH - .2, .3, { ol: false }); for (const A of P.arms) A.userData.sleeve.material = av3mat(c); },
    Chestplate: (P, c, M, gl) => { P.bulk = 1.14; P.backZ = .06; P.pads = true; const b = av3mesh(P.chest, av3lathe([[0, .1], [.32, .12], [.4, .42], [.38, .56], [.22, .64], [0, .65]]), M); b.scale.z = .86; av3mesh(P.chest, av3sph(.08, 14, 10), av3mat(c, gl), 0, .38, .34).scale.z = .4; for (const A of P.arms) { const s = av3mesh(A, av3dome(.18, .5, 20), M, 0, .03, 0); s.scale.y = .85; } },
    Robe: (P, c) => { P.bulk = 1.08; P.backZ = .03; av3mesh(P.chest, av3lathe([[.3, -.62], [.36, -.3], [.31, 0], [.3, .2], [.38, .44], [.34, .58], [.2, .66], [0, .67]]), av3mat(c, { ds: true })).scale.z = .86; av3mesh(P.chest, av3tor(.31, .035, Math.PI * 2, 8, 28), av3mat('#fcc419'), 0, .06, 0, { ol: false }).rotation.x = Math.PI / 2; av3mesh(P.chest, av3cap(.03, .4, 6), av3mat('#fcc419'), 0, T.torsoH * .5, .33, { ol: false }); for (const A of P.arms) A.userData.sleeve.material = av3mat(c); P.robe = true; },
    'Track Pants': (P, c) => { for (const L of P.legs) { L.userData.leg.material = av3mat(c); av3mesh(L, new THREE.BoxGeometry(.02, .42, .02), av3mat('#ffffff'), Math.sign(L.position.x) * T.legR * 1.02, -.24, 0, { ol: false }); } },
    Greaves: (P, c, M) => { for (const L of P.legs) { av3mesh(L, av3cyl(T.legR * 1.3, T.legR * 1.15, .2, 16), M, 0, -.38, .01); av3mesh(L, av3sph(.08, 12, 10), av3mat(c), 0, -.24, .12); } },
    'Training Shorts': (P, c) => { for (const L of P.legs) av3mesh(L, av3cyl(T.legR * 1.4, T.legR * 1.3, .2, 16), av3mat(c), 0, -.06, 0); },
    Spikes: (P, c) => { for (const F of P.feet) { F.userData.shoe.material = av3mat(c); for (let i = 0; i < 3; i++) av3mesh(F, av3cone(.022, .07, 6), av3mat('#dee2e6'), (i - 1) * .06, -.08, .1, { ol: false }).rotation.x = Math.PI; } },
    Boots: (P, c, M) => { for (const F of P.feet) { F.userData.shoe.material = M; av3mesh(F, av3cyl(.15, .14, .24, 16), M, 0, .12, -.03); av3mesh(F, av3tor(.15, .03, Math.PI * 2, 8, 20), av3mat(c), 0, .24, -.03, { ol: false }).rotation.x = Math.PI / 2; } },
    Slippers: (P, c) => { for (const F of P.feet) { F.userData.shoe.material = av3mat(c); av3mesh(F, av3sph(.07, 12, 8), av3mat('#ffffff'), 0, .05, .16); } },
    Gloves: (P, c) => { for (const H of P.hands) { H.userData.hand.material = av3mat(c); H.userData.hand.scale.setScalar(1.18); av3mesh(H, av3cyl(.12, .11, .08, 16), av3mat(av3drk(c, .2)), 0, .12, 0); } },
    'Pen of Power': (P, c, M, gl) => { const h = P.hands[1]; const p = av3mesh(h, av3cyl(.035, .035, .55, 10), av3mat(c, gl), 0, .05, .12); p.rotation.x = Math.PI / 2.4; av3mesh(h, av3cone(.035, .09, 10), av3mat('#fcc419'), 0, -.07, .38).rotation.x = Math.PI / 2.4 + Math.PI; },
    Tape: (P) => { for (const H of P.hands) for (let i = 0; i < 2; i++) av3mesh(H, av3tor(.11, .03, Math.PI * 2, 8, 18), av3mat('#f8f9fa'), 0, .08 + i * .05, 0, { ol: false }).rotation.x = Math.PI / 2; },
    'Lucky Clover': (P) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = av3mesh(g, av3heart(.06), av3mat('#40c057', { e: '#2b8a3e', ei: .3 }), Math.cos(i * Math.PI / 2) * .06, Math.sin(i * Math.PI / 2) * .06, 0); l.rotation.z = i * Math.PI / 2 - Math.PI / 2; } P.charm.add(g); },
    'Seer Orb': (P, c) => { av3mesh(P.charm, av3sph(.12), av3mat(c, { e: c, ei: .9, op: .85 }), 0, 0, 0, { sh: false }); av3mesh(P.charm, av3sph(.05, 12, 8), av3mat('#ffffff', { flat: true }), .03, .03, .06, { ol: false }); },
    Medal: (P, c) => { const m = av3mesh(P.charm, av3cyl(.11, .11, .035, 24), av3mat('#fcc419', { e: '#7a5200', ei: .25 }), 0, 0, 0); m.rotation.x = Math.PI / 2; av3mesh(P.charm, av3star(.06), av3mat(c), 0, 0, .03, { ol: false }); av3mesh(P.charm, new THREE.BoxGeometry(.07, .14, .01), av3mat(c), 0, .17, 0, { ol: false }); }, // a charm: it floats beside you like the others
  };
})();

// ---------- the face ----------
function av3face(h, spec, K) {
  const L = K.L, R = h.R, g = h.g, ex = spec.face || 'f_smile';
  const ink = av3mat('#2a1a14'), white = av3mat('#fbfbff'), skinD = av3mat(av3drk(K.skin, .18));
  // eyes: big toon eyes with an iris in your eye colour and a highlight
  const shape = { dots: [1, 1], round: [1.08, 1.1], almond: [1.08, .8], wide: [1.22, 1.22], sleepy: [1.02, .72], narrow: [1.04, .62] }[L.eyes] || [1, 1];
  if (ex === 'f_focus') shape[1] *= .75;
  h.eyes = [];
  for (const s of [-1, 1]) {
    const x = s * .15, z = h.fz(x, h.eyY), E = new THREE.Group(); E.position.set(x, h.eyY, z - .015); E.rotation.y = s * .28; g.add(E); h.eyes.push(E);
    const w = av3mesh(E, av3sph(.088, 20, 14), white, 0, 0, 0); w.scale.set(shape[0], 1.15 * shape[1], .5);
    const ir = av3mesh(E, av3sph(.058, 16, 12), av3mat(K.eye), 0, -.004, .03, { ol: false }); ir.scale.set(shape[0], 1.1 * Math.min(1, shape[1] + .1), .42);
    av3mesh(E, av3sph(.032, 12, 10), av3mat('#120c0a'), 0, -.004, .048, { ol: false }).scale.z = .4;
    av3mesh(E, av3sph(.016, 8, 6), av3mat('#ffffff', { flat: true }), .022, .028, .058, { ol: false });
    if (L.eyes === 'sleepy') { const lid = av3mesh(E, new THREE.SphereGeometry(.092, 18, 10, 0, Math.PI * 2, 0, Math.PI * .42), av3mat(K.skin), 0, .004, 0, { ol: false }); lid.scale.set(shape[0] * 1.02, 1.15, .55); }
    if (L.lashes === 'lashes') { const l = av3mesh(E, av3tor(.07, .012, Math.PI * .8, 6, 12), ink, 0, .02, .02, { ol: false }); l.rotation.z = Math.PI * .1; l.scale.y = 1.2 * shape[1]; }
  }
  // brows
  const bs = { straight: [.018, 0], arched: [.018, .28], thick: [.028, .05], thin: [.011, .1], angled: [.022, -.32], none: [.01, 0] }[L.brows] || [.018, 0];
  if (ex === 'f_fierce') bs[1] = -.4;
  const browCol = av3mat(L.brows === 'none' ? av3mix(K.hair, K.skin, .6) : av3drk(K.hair, .2));
  for (const s of [-1, 1]) {
    const b = av3mesh(g, av3cap(bs[0], .1, 8), browCol, s * .15, h.eyY + .135, h.fz(s * .15, h.eyY + .135) + .005, { ol: false }); b.rotation.z = Math.PI / 2 + s * bs[1];
    if (L.browCut !== 'none' && s === 1) for (let i = 0; i < (L.browCut === 'two' ? 2 : 1); i++) av3mesh(g, new THREE.BoxGeometry(.012, .05, .02), av3mat(K.skin), .17 + i * .025, h.eyY + .135, h.fz(.17, h.eyY + .135) + .018, { ol: false });
  }
  // nose
  const ny = h.eyY - .1, ns = { small: [1, .8, .7, .04], button: [1.1, 1, .9, .045], long: [.9, 1.5, .8, .045], wide: [1.45, .85, .7, .045], pointed: [.85, .9, 1.4, .042] }[L.nose] || [1, .8, .7, .04];
  av3mesh(g, av3sph(ns[3], 14, 10), av3mat(av3drk(K.skin, .06)), 0, ny, h.fz(0, ny) + .005, { ol: false }).scale.set(ns[0], ns[1], ns[2]);
  // mouth
  const my = h.eyY - .2, mz = h.fz(0, my) + .002, mouth = ex === 'f_grin' ? 'open' : ex === 'f_fierce' ? 'smirk' : ex === 'f_focus' ? 'neutral' : L.mouth, mm = av3mat('#5a2320');
  if (mouth === 'open' || mouth === 'braces' && ex === 'f_grin') { const o = av3mesh(g, new THREE.SphereGeometry(.085, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mm, 0, my + .02, mz - .01, { ol: false }); o.scale.set(1, .9, .35); av3mesh(g, new THREE.BoxGeometry(.13, .025, .02), white, 0, my + .008, mz + .012, { ol: false }); av3mesh(g, av3sph(.035, 10, 8), av3mat('#e8707a'), 0, my - .04, mz + .005, { ol: false }).scale.set(1.3, .5, .3); }
  else if (mouth === 'neutral') { av3mesh(g, av3cap(.013, .07, 6), mm, 0, my, mz, { ol: false }).rotation.z = Math.PI / 2; }
  else if (mouth === 'smirk') { const m = av3mesh(g, av3tor(.06, .014, Math.PI * .6, 6, 12), mm, .03, my + .03, mz, { ol: false }); m.rotation.z = Math.PI * 1.2; }
  else { const r = mouth === 'small' ? .045 : .068, m = av3mesh(g, av3tor(r, .015, Math.PI, 6, 16), mm, 0, my + r * .5, mz, { ol: false }); m.rotation.z = Math.PI; if (mouth === 'braces') { const b = av3mesh(g, av3tor(r * .9, .008, Math.PI * .8, 4, 12), av3mat('#adb5bd'), 0, my + r * .5, mz + .008, { ol: false }); b.rotation.z = Math.PI * 1.1; } }
  // cheeks and marks
  const ext = L.extras;
  if (ext === 'blush' || ex === 'f_grin') for (const s of [-1, 1]) { const c = av3mesh(g, av3sph(.055, 12, 8), av3mat('#ff8fa3', { op: .5 }), s * .25, h.eyY - .11, h.fz(s * .25, h.eyY - .11) - .01, { ol: false, sh: false }); c.scale.set(1.2, .7, .3); c.rotation.y = s * .6; }
  if (ext === 'freckles') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (.16 + (i % 2) * .05), y = h.eyY - .09 - (i > 1 ? .035 : 0); av3mesh(g, av3sph(.011, 6, 4), av3mat(av3drk(K.skin, .4)), x, y, h.fz(x, y) + .002, { ol: false }); }
  if (ext === 'mole') av3mesh(g, av3sph(.014, 6, 4), av3mat('#3b2416'), .14, my - .02, h.fz(.14, my - .02) + .002, { ol: false });
  if (ext === 'dimples') for (const s of [-1, 1]) av3mesh(g, av3sph(.012, 6, 4), skinD, s * .11, my + .01, h.fz(s * .11, my) + .002, { ol: false });
  if (ext === 'scar') { const sc = av3mesh(g, av3cap(.01, .16, 4), av3mat(av3lit(K.skin, .35)), -.15, h.eyY, h.fz(-.15, h.eyY) + .05, { ol: false }); sc.rotation.z = .4; }
  // beard
  const bc = av3mat(K.hair);
  if (L.beard === 'stubble') { const b = av3mesh(g, new THREE.SphereGeometry(R * 1.01, 28, 14, -Math.PI * .5, Math.PI, Math.PI * .6, Math.PI * .4), av3mat(av3mix(K.skin, K.hair, .32)), 0, 0, 0, { ol: false }); b.scale.set(...K.head); }
  if (L.beard === 'full') { const b = av3mesh(g, new THREE.SphereGeometry(R * 1.06, 28, 14, -Math.PI * .5, Math.PI, Math.PI * .62, Math.PI * .38), bc, 0, -.02, .01); b.scale.set(K.head[0], K.head[1] * 1.08, K.head[2]); }
  if (['moustache', 'goatee', 'full'].includes(L.beard)) for (const s of [-1, 1]) { const m = av3mesh(g, av3cap(.025, .07, 8), bc, s * .05, ny - .055, h.fz(s * .05, ny - .055) + .01, { ol: false }); m.rotation.z = Math.PI / 2 + s * .35; }
  if (L.beard === 'goatee') av3mesh(g, av3sph(.05, 12, 10), bc, 0, my - .085, h.fz(0, my - .085) - .01).scale.set(1, 1.2, .7);
  // ears, earrings, sideburns
  const es = { small: .8, big: 1.3 }[L.ears] || 1;
  for (const s of [-1, 1]) {
    const ex0 = s * R * K.head[0] * .97, e = av3mesh(g, av3sph(.085 * es, 14, 10), av3mat(K.skin), ex0, -.03, -.02); e.scale.set(.45, 1, .75);
    const er = L.earrings, one = er === 'stud' || er === 'hoop';
    if (er !== 'none' && (!one || s === 1)) { if (/hoop/.test(er)) av3mesh(g, av3tor(.035, .009, Math.PI * 2, 6, 14), av3mat('#fcc419'), ex0 + s * .01, -.12, -.01, { ol: false }).rotation.y = Math.PI / 2; else av3mesh(g, av3sph(.018, 8, 6), av3mat('#fcc419', { e: '#7a5200', ei: .3 }), ex0 + s * .02, -.1, -.01, { ol: false }); }
    if (L.sideburns !== 'none' && !K.bald) av3mesh(g, av3cap(.03, L.sideburns === 'long' ? .14 : .07, 6), bc, s * R * K.head[0] * .9, .02, .1, { ol: false });
  }
  // glasses from your look
  const gl = L.glasses;
  if (gl !== 'none' && (spec.eyes || 'eye_none') === 'eye_none') {
    const fr = av3mat(gl === 'rimless' ? '#ced4da' : '#212529'), t = gl === 'thick' ? .022 : gl === 'rimless' ? .007 : .013;
    for (const s of [-1, 1]) { const r = av3mesh(g, gl === 'rect' ? new THREE.TorusGeometry(.09, t, 4, 4) : av3tor(.085, t, Math.PI * 2, 6, 22), fr, s * .15, h.eyY, h.fz(s * .15, h.eyY) + .055, { ol: false }); if (gl === 'rect') { r.rotation.z = Math.PI / 4; r.scale.set(1.15, .8, 1); } r.rotation.y = s * .28; }
    av3mesh(g, av3cap(t, .05, 6), fr, 0, h.eyY + .01, h.fz(0, h.eyY) + .06, { ol: false }).rotation.z = Math.PI / 2;
  }
}

// ---------- the figure ----------
// spec = avatar spec (look and cosmetics), gear = { template name: rarity colour }, clsCol = class colour
function av3figure(spec, gear, clsCol) {
  const T = AV3_STYLE, K = av3colors(spec), fig = new THREE.Group(), P = { fig, legs: [], feet: [], hands: [], arms: [] };
  const C = id => cos(id) || {}, as3 = (cat, id) => C(id).as3 || id; // retired ids can point at a 3D builder
  const kit = clsCol ? av3mix(K.kit, clsCol, T.tint) : K.kit, pat = av3pattern(K.pattern, kit);
  const mSkin = av3mat(K.skin), mKit = pat ? av3mat('#ffffff', { map: pat }) : av3mat(kit), mSleeve = av3mat(kit), mPants = av3mat(av3mix(av3drk(kit, .45), '#2b2f45', .45)), mShoe = av3mat(K.shoe, spec.shoes === 'sh_glow' ? { e: K.shoe, ei: .5 } : {});
  K.bald = spec.hair === 'h_bald';
  fig.scale.set(K.build, K.tall, K.build);
  // legs and boots
  for (const s of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(s * .15, T.hipY, 0); L.rotation.z = s * .04; fig.add(L); P.legs.push(L);
    L.userData.leg = av3mesh(L, av3cap(T.legR, .34), mPants, 0, -.24, 0);
    const F = new THREE.Group(); F.position.set(0, -T.hipY + .1, .03); L.add(F); P.feet.push(F);
    const shoe = F.userData.shoe = av3mesh(F, av3sph(.15, 20, 14), mShoe, 0, 0, .04); shoe.scale.set(.95, .68, 1.4);
    av3mesh(F, av3cyl(.15, .15, .04, 20), av3mat('#f1f3f5'), 0, -.075, .04, { ol: false }).scale.z = 1.4;
    if (spec.shoes === 'sh_rocket') { F.userData.jet = av3mesh(F, av3cone(.08, .2, 10), av3mat('#ff922b', { flat: true, op: .85 }), 0, -.18, -.02, { ol: false, sh: false }); F.userData.jet.rotation.x = Math.PI; av3mesh(F, av3cyl(.06, .08, .06, 12), av3mat('#495057'), 0, -.09, -.06, { ol: false }); }
  }
  // torso: a V-shaped hero chest
  const chest = P.chest = new THREE.Group(); chest.position.y = T.hipY - .02; fig.add(chest);
  const torso = av3mesh(chest, av3lathe([[0, -.04], [.27, -.03], [.29, .1], [.36, .42], [.33, .56], [.18, .63], [0, .64]]), mKit); torso.scale.z = .82;
  av3mesh(chest, av3tor(.28, .04, Math.PI * 2, 8, 28), av3mat(av3drk(kit, .5)), 0, .02, 0, { ol: false }).rotation.x = Math.PI / 2; // belt
  av3mesh(chest, av3tor(.15, .035, Math.PI * 2, 8, 20), av3mat(av3drk(kit, .2)), 0, T.torsoH - .02, .01, { ol: false }).rotation.x = Math.PI / 2; // collar
  av3mesh(chest, av3cap(.11, .06, 12), mSkin, 0, T.torsoH + .03, 0); // neck
  if (spec.no != null && !pat) { /* jersey number on the back */ const t = av3canvas(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.font = 'bold 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(spec.no), w / 2, h / 2 + 4); }); const n = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); n.position.set(0, .36, -.31); n.rotation.y = Math.PI; chest.add(n); }
  // arms: short sleeves, chunky forearms and mitten hands
  for (const s of [-1, 1]) {
    const A = new THREE.Group(); A.position.set(s * T.shoulderX, T.torsoH - .1, 0); A.rotation.z = s * .2; chest.add(A); P.arms.push(A);
    av3mesh(A, av3sph(.14, 18, 14), mSleeve); // shoulder
    A.userData.sleeve = av3mesh(A, av3cap(T.armR * 1.12, .14, 14), mSleeve, 0, -.12, 0);
    av3mesh(A, av3cap(T.armR, .2, 14), mSkin, 0, -.32, 0);
    const H = new THREE.Group(); H.position.y = -.5; A.add(H); P.hands.push(H);
    H.userData.hand = av3mesh(H, av3sph(.13, 18, 14), mSkin); H.userData.hand.scale.set(1, 1.05, .9);
  }
  // head
  const head = P.head = new THREE.Group(); head.position.y = T.headY; fig.add(head);
  const skull = av3mesh(head, av3sph(T.headR, 36, 26), mSkin); skull.scale.set(...K.head);
  if (spec.look?.face === 'heart' || K.L.face === 'heart') { const ch = av3mesh(head, av3sph(T.headR * .55, 20, 14), mSkin, 0, -T.headR * .55, T.headR * .25, { ol: false }); ch.scale.set(.9, .7, .8); }
  const R = T.headR, [sx, sy, sz] = K.head;
  const h = { g: head, R, K, eyY: -.02, m: av3mat(K.hair), hat: false,
    fz: (x, y) => sz * R * Math.sqrt(Math.max(.05, 1 - (x / (sx * R)) ** 2 - (y / (sy * R)) ** 2)) };
  av3face(h, spec, K); P.eyes = h.eyes;
  // 2.59: cosmetics win where you've picked one (a hat over head gear, a kit
  // colour over chest gear, shoes over feet gear, an extra in your hand over
  // the Pen of Power), so the look you choose always shows; gear fills the
  // rest. The piece you're previewing (force) always shows.
  gear = { ...gear };
  const force = spec.force || '', drop = (names, why) => { if (why) for (const b of names) if (b !== force) delete gear[b]; };
  drop(['Study Cap', 'Helm', 'Headband'], spec.hat && spec.hat !== 'hat_none');
  drop(['Hoodie', 'Chestplate', 'Robe'], spec.kit && spec.kit !== 'kit_gear');
  drop(['Spikes', 'Boots', 'Slippers'], spec.shoes && spec.shoes !== 'sh_white');
  drop(['Pen of Power'], ['x_trophy', 'x_staff'].includes(spec.extra));
  // headwear: head gear (when no hat is picked, or while previewing it) replaces the hat
  const headGear = ['Study Cap', 'Helm', 'Headband'].some(b => gear[b]);
  const hatId = as3('hat', spec.hat), hatF = !headGear && AV3_HAT[hatId];
  h.hat = !!hatF || gear['Study Cap'] || gear.Helm;
  h.band = gear.Headband || ['hat_band', 'hat_ninja'].includes(hatId) && !!hatF; // the hair sits tight so a band can go round it
  if (!K.bald && !gear.Helm) { const f = AV3_HAIR[AV3_HAIR_OF[spec.hair] || 'short']; try { f(h); } catch (e) { console.error(e); } }
  if (hatF) try { hatF(h); } catch (e) { console.error(e); }
  const eyF = AV3_EYE[as3('eyes', spec.eyes)]; if (eyF) try { eyF(h); } catch (e) { console.error(e); }
  P.glow = h.glow;
  // charm floats beside you
  const charm = P.charm = new THREE.Group(); charm.position.set(.72, 1.45, .1); fig.add(charm);
  // gear, then extras
  h.ringR = y => { const b = Math.max(h.capR || 0, R * sx); return Math.sqrt(Math.max(.01, b * b - (y - .02) ** 2)) + .022; };
  for (const [base, c] of Object.entries(gear)) { const f = AV3_GEAR[base]; if (!f) continue; const leg = c === '#f59f00', gl = leg ? { e: c, ei: .45 } : {}; try { f(P, c, av3mat(av3mix(c, '#9aa3ad', leg ? .3 : .5), leg ? { e: c, ei: .15 } : {}), gl, h); } catch (e) { console.error(e); } }
  const xF = AV3_EXTRA[as3('extra', spec.extra)]; if (xF) try { xF(P, K); } catch (e) { console.error(e); }
  // pet: its emoji as a little sticker that hops beside you
  const pet = C(spec.pet).e;
  if (pet) { const t = av3canvas(128, 128, (x, w, hh) => { x.font = '100px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(pet, w / 2, hh / 2 + 6); }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); sp.scale.set(.5, .5, .5); sp.position.set(-.78, .28, .3); fig.add(sp); P.pet = sp; }
  fig.userData.P = P;
  return fig;
}
// class aura: a glowing ring on the ground and motes rising around you
function av3aura(col) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.58, .82, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .012; g.add(ring);
  const motes = [];
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(av3sph(.028, 8, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9 })); m.userData = { a: Math.random() * Math.PI * 2, r: .55 + Math.random() * .3, s: .3 + Math.random() * .4, o: Math.random() * 2 }; g.add(m); motes.push(m); }
  g.userData = { ring, motes };
  return g;
}
// the backdrop: a soft vertical glow, tinted by your class colour
function av3sky() { // 2.59: the stage behind the canvas draws the sky (or your background cosmetic)
  if (AV3.S.background) AV3.S.background.dispose?.();
  AV3.S.background = null;
}
// a low stone plinth to stand on, with a rim in your class colour
function av3plinth(col) {
  const g = new THREE.Group();
  av3mesh(g, av3cyl(.95, 1.02, .12, 40), av3mat('#3d4263'), 0, -.06, 0, { sh: false });
  av3mesh(g, av3tor(.96, .025, Math.PI * 2, 6, 48), av3mat(col || '#7c88d6', { flat: true }), 0, 0, 0, { ol: false, sh: false }).rotation.x = Math.PI / 2;
  const top = new THREE.Mesh(new THREE.CircleGeometry(.95, 40), av3mat('#4a5078')); top.rotation.x = -Math.PI / 2; top.position.y = .001; top.receiveShadow = true; g.add(top);
  return g;
}
function av3dispose(o) {
  o.traverse(m => { if (m.geometry) m.geometry.dispose(); });
  for (const m of Object.values(AV3.mats)) m.dispose(); AV3.mats = {};
  for (const t of AV3.tex) t.dispose(); AV3.tex = [];
}
function av3init() {
  const R = AV3.R = fxRenderer({ alpha: true }); R.toneMapping = THREE.NoToneMapping; R.setClearColor(0x000000, 0); // flat toon colours; see-through so your background cosmetic shows behind you
  const S = AV3.S = new THREE.Scene();
  AV3.cam = new THREE.PerspectiveCamera(30, 1, .1, 50); AV3.cam.position.set(0, 1.15, 5.9); AV3.cam.lookAt(0, .98, 0); // 2.59: closer, so you fill the stage
  S.add(new THREE.HemisphereLight('#e3e8ff', '#3a2e4a', .35));
  const sun = new THREE.DirectionalLight('#fff6e8', .85); sun.position.set(2.5, 5, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.002;
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 15 }); S.add(sun); AV3.sun = sun;
  const rim = new THREE.DirectionalLight('#9d8cff', .3); rim.position.set(-3, 2, -3); S.add(rim);
  AV3.root = new THREE.Group(); S.add(AV3.root);
  const cv = R.domElement; cv.className = 'av3cv';
  cv.addEventListener('pointerdown', e => { AV3.drag = { x: e.clientX, y: AV3.yaw }; AV3.spin = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (AV3.drag) AV3.yaw = AV3.drag.y + (e.clientX - AV3.drag.x) * .012; });
  cv.addEventListener('pointerup', () => { AV3.drag = null; });
  cv.addEventListener('dblclick', () => { AV3.spin = true; });
}
function av3loop(t) {
  AV3.raf = 0;
  const cv = AV3.R?.domElement; if (!cv || !cv.isConnected || document.hidden) return;
  const s = t / 1000, F = AV3.fig;
  if (AV3.spin) AV3.yaw += .004;
  AV3.root.rotation.y = AV3.yaw;
  if (F) {
    const P = F.userData.P, b = Math.sin(s * 2);
    P.chest.scale.y = 1 + b * .012; P.head.position.y = AV3_STYLE.headY + b * .012; P.head.rotation.z = Math.sin(s * .7) * .03;
    P.arms[0].rotation.x = Math.sin(s * 1.3) * .06; P.arms[1].rotation.x = -Math.sin(s * 1.3) * .06;
    const bl = (s % 4.2) < .12 ? .12 : 1; for (const e of P.eyes || []) e.scale.y = bl; // blink
    P.charm.position.y = 1.45 + Math.sin(s * 1.6) * .06; P.charm.rotation.y = s;
    if (P.cape) P.cape.rotation.x = .12 + Math.sin(s * 1.4) * .05;
    if (P.wings) P.wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (.95 + Math.sin(s * 1.8) * .15); });
    if (P.scarf) P.scarf.rotation.z = -.3 + Math.sin(s * 2.2) * .12;
    if (P.flames) for (const f of P.flames) { const a = f.userData.a + s * .6; f.position.set(Math.cos(a) * .5, .17 + Math.abs(Math.sin(s * 5 + a * 3)) * .05, Math.sin(a) * .5); f.scale.y = .8 + Math.abs(Math.sin(s * 6 + a * 2)) * .5; }
    if (P.sparks) for (const p of P.sparks) { const u = p.userData, a = u.a + s * .5; p.position.set(Math.cos(a) * .62, u.y + Math.sin(s * 2 + u.a) * .08, Math.sin(a) * .62); p.rotation.z = s * 2; p.scale.setScalar(.6 + Math.abs(Math.sin(s * 3 + u.a)) * .6); }
    if (P.orbs) for (const o of P.orbs) { const a = o.userData.a + s * 1.2; o.position.set(Math.cos(a) * .62, 1.2 + Math.sin(a * 2) * .15, Math.sin(a) * .62); }
    if (P.jets) for (const j of P.jets) j.scale.y = .8 + Math.random() * .4;
    for (const Fo of P.feet) if (Fo.userData.jet) Fo.userData.jet.scale.y = .8 + Math.random() * .4;
    if (P.pet) P.pet.position.y = .28 + Math.abs(Math.sin(s * 3)) * .1;
  }
  const A = AV3.aura;
  if (A) { A.userData.ring.material.opacity = .4 + Math.sin(s * 2) * .15; for (const m of A.userData.motes) { const u = m.userData, y = ((s * u.s + u.o) % 2); m.position.set(Math.cos(u.a + s * .4) * u.r, y, Math.sin(u.a + s * .4) * u.r); m.material.opacity = Math.max(0, 1 - y / 2); } }
  AV3.R.render(AV3.S, AV3.cam);
  AV3.raf = requestAnimationFrame(av3loop);
}
// called after every render: puts the canvas in #av3host and rebuilds the figure when what you wear changes
function mountYou3D() {
  const host = document.getElementById('av3host');
  if (!host) return;
  if (typeof need3D !== 'function') return;
  if (!need3D()) { if (is3dLoad && !AV3.wait) { AV3.wait = true; is3dLoad.then(() => { AV3.wait = false; if (view === 'profile') render(); }).catch(() => { AV3.wait = false; }); } return; }
  if (!webglOK()) return;
  if (!AV3.R) av3init();
  const cv = AV3.R.domElement;
  if (cv.parentNode !== host) host.prepend(cv);
  const d = JSON.parse(host.dataset.av || '{}'), sig = host.dataset.av + (D.settings.lowQuality ? 'L' : '');
  if (sig !== AV3.sig) {
    AV3.sig = sig;
    if (AV3.root.children.length) av3dispose(AV3.root);
    AV3.root.clear();
    try { AV3.fig = av3figure({ ...(d.spec || avatarSpec()), force: d.force || '' }, d.gear || {}, d.cls || ''); AV3.root.add(AV3.fig); } catch (e) { console.error(e); AV3.fig = null; }
    AV3.root.add(av3plinth(d.cls || ''));
    AV3.aura = d.cls ? av3aura(d.cls) : null; if (AV3.aura) AV3.root.add(AV3.aura);
    av3sky(d.cls || '');
    AV3.R.shadowMap.enabled = !D.settings.lowQuality; AV3.sun.castShadow = !D.settings.lowQuality;
  }
  const W = host.clientWidth, H = host.clientHeight;
  if (W && H && (AV3.w !== W || AV3.h !== H)) { AV3.w = W; AV3.h = H; AV3.R.setSize(W, H, false); AV3.cam.aspect = W / H; AV3.cam.updateProjectionMatrix(); }
  host.parentNode?.classList.add('has3d');
  // 2.60: follow the host's size as it changes (the stage shrinks when the Customise drawer opens), so the picture never stretches
  if (AV3.ro && AV3.roHost !== host) { AV3.ro.disconnect(); AV3.ro = null; }
  if (!AV3.ro && typeof ResizeObserver === 'function') { AV3.roHost = host; AV3.ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (w && h && (AV3.w !== w || AV3.h !== h)) { AV3.w = w; AV3.h = h; AV3.R.setSize(w, h, false); AV3.cam.aspect = w / h; AV3.cam.updateProjectionMatrix(); } }); AV3.ro.observe(host); }
  if (!AV3.raf) AV3.raf = requestAnimationFrame(av3loop);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('av3host') && AV3.R && !AV3.raf) AV3.raf = requestAnimationFrame(av3loop); });
window.addEventListener('resize', () => { if (document.getElementById('av3host')) mountYou3D(); });
