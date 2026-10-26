'use strict';
/* 3D Arena battles (three.js). battle.js runs the rules and calls play(side,
   kind, data) for every visible moment (sending a fighter out, a move, a hit,
   a faint...). Here each one becomes a keyframed animation on smooth,
   jointed fighters standing on two glowing platforms, with effects for every
   type (flames, lightning, waves, leaves, ice, rocks...). The stadium matches
   the league and is lit with the shared lighting from g3fx.js: soft shadows,
   an environment that gives shiny things reflections, and bloom on lights. */

const B3 = { on: false };
const SPOT = { me: new THREE.Vector3(-2.35, 0, 1.55), them: new THREE.Vector3(2.35, 0, -1.55) };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- materials and textures ----------
function b3mat(color, o = {}) {
  const P = o.phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new P({ color, roughness: o.rough ?? .62, metalness: o.metal || 0, flatShading: !!o.flat, emissive: o.emi || 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: (o.op ?? 1) < 1 || !!o.trans, opacity: o.op ?? 1, side: o.side || THREE.FrontSide, depthWrite: o.dw ?? true, envMapIntensity: o.env ?? .8 });
  if (o.phys) Object.assign(m, { clearcoat: o.cc ?? 0, clearcoatRoughness: o.ccr ?? .2, sheen: o.sheen ?? 0, sheenColor: new THREE.Color(o.sheenC || '#ffffff'), sheenRoughness: .6, transmission: o.tr || 0, thickness: o.th || 0 });
  if (o.map) m.map = o.map;
  return m;
}
const b3mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat.isMaterial ? mat : b3mat(mat, o)); m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; return m; };
const b3at = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); return m; };
function b3tex(draw, w = 256, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = srgb(new THREE.CanvasTexture(c)); t.anisotropy = 4; return t; }
const emojiTex = e => b3tex((x, w, h) => { x.font = `${Math.round(h * .74)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, w / 2, h * .56); }, 128, 128);
const lgCols = s => (String(s).match(/#[0-9a-f]{3,6}/gi) || ['#74c0fc', '#d0ebff']);
const TEX = {};
function ptex(kind) {
  if (TEX[kind]) return TEX[kind];
  const t = b3tex((x, w) => {
    const c = w / 2;
    if (kind === 'glow') { const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }
    else if (kind === 'spark') { x.translate(c, c); const g = x.createRadialGradient(0, 0, 0, 0, 0, c); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 4); x.beginPath(); x.ellipse(0, 0, c, c * .12, 0, 0, Math.PI * 2); x.fill(); } }
    else if (kind === 'ring') { x.strokeStyle = '#fff'; x.lineWidth = w * .07; x.shadowColor = '#fff'; x.shadowBlur = w * .08; x.beginPath(); x.arc(c, c, c * .78, 0, Math.PI * 2); x.stroke(); }
    else if (kind === 'leaf') { x.translate(c, c); x.rotate(.6); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, c * .9, c * .4, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = w * .04; x.beginPath(); x.moveTo(-c * .8, 0); x.lineTo(c * .8, 0); x.stroke(); }
    else if (kind === 'drop') { const g = x.createRadialGradient(c * .8, c * .8, 0, c, c, c); g.addColorStop(0, '#fff'); g.addColorStop(.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(c, c, c * .85, 0, Math.PI * 2); x.fill(); }
    else if (kind === 'smoke') { for (let k = 0; k < 6; k++) { const px = c + Math.cos(k) * c * .3, py = c + Math.sin(k * 2) * c * .3, g = x.createRadialGradient(px, py, 0, px, py, c * .6); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); } }
    else if (kind === 'z') { x.fillStyle = '#fff'; x.font = `900 ${w * .8}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', c, c); }
    else if (kind === 'up' || kind === 'down') { x.translate(c, c); if (kind === 'down') x.rotate(Math.PI); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -c * .9); x.lineTo(c * .6, -c * .1); x.lineTo(c * .22, -c * .1); x.lineTo(c * .22, c * .9); x.lineTo(-c * .22, c * .9); x.lineTo(-c * .22, -c * .1); x.lineTo(-c * .6, -c * .1); x.closePath(); x.fill(); }
    else if (kind === 'star') { x.translate(c, c); x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? c * .4 : c * .95, a = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
    else if (kind === 'shard') { x.translate(c, c); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -c * .95); x.lineTo(c * .3, 0); x.lineTo(0, c * .95); x.lineTo(-c * .3, 0); x.closePath(); x.fill(); }
  }, 64, 64);
  return (TEX[kind] = t);
}

// ---------- particles and effects ----------
function spawn(o) {
  const add = o.add !== false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex(o.tex || 'glow'), color: o.color || '#ffffff', transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: o.op ?? 1, rotation: o.rot ?? Math.random() * 6, toneMapped: !add, fog: false }));
  s.position.copy(o.pos); s.scale.setScalar(o.size || .3); B3.scene.add(s);
  B3.parts.push({ s, v: o.vel ? o.vel.clone() : V3(), g: o.grav || 0, drag: o.drag || 0, life: o.life || .6, max: o.life || .6, grow: o.grow || 0, spin: o.spin || 0, op: o.op ?? 1, fadeIn: o.fadeIn || 0 });
  return s;
}
const rnd = (a = 1) => (Math.random() - .5) * 2 * a;
const rv = (a = 1, up = 0) => V3(rnd(a), Math.random() * up + rnd(a) * (up ? 0 : 1), rnd(a));
function burstAt(pos, col, n = 14, o = {}) { for (let k = 0; k < n; k++) spawn({ pos, color: col, tex: o.tex || 'spark', size: (o.size || .35) * (.6 + Math.random() * .8), vel: rv(o.speed || 4, o.up || 2), grav: o.grav ?? 6, drag: 1.5, life: (o.life || .6) * (.7 + Math.random() * .6), grow: o.grow || -.5, spin: rnd(6) }); }
function ringAt(pos, col, o = {}) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.3, .5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: o.op ?? .9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  m.position.copy(pos); if (o.up) m.rotation.x = Math.PI / 2; if (o.face) m.lookAt(o.face); B3.scene.add(m);
  fxRun(o.dur || .5, p => { m.scale.setScalar(1 + p * (o.grow || 6)); m.material.opacity = (o.op ?? .9) * (1 - p); }, () => kill(m));
}
function flashLight(pos, col, power = 6, dur = .35, dist = 9) { const l = new THREE.PointLight(col, power, dist, 2); l.position.copy(pos); B3.scene.add(l); fxRun(dur, p => { l.intensity = power * (1 - p) * (1 - p); }, () => B3.scene.remove(l)); }
function fxRun(dur, step, end) { B3.fx.push({ t: 0, dur, step, end }); }
function kill(o) { B3.scene.remove(o); o.traverse?.(x => { x.geometry?.dispose(); if (x.material) x.material.dispose(); }); }
const after = s => new Promise(r => setTimeout(r, s * 1000 * (battle?.speed || 1)));

// ---------- fighters ----------
// a smooth, jointed athlete facing +z with feet at y = 0, about 2 units tall
const HAIR_OF = { h_bald: 'bald', h_buzz: 'buzz', h_long: 'long', h_flow: 'long', h_wavy: 'long', h_bob: 'long', h_locs: 'long', h_curly: 'curly', h_afro: 'afro', h_twists: 'curly', h_pony: 'pony', h_bun: 'bun', h_spiky: 'spiky', h_frosted: 'spiky', h_mohawk: 'mohawk', h_mullet: 'mullet', h_pigtails: 'pigtails' };
function fighter3(L) {
  const kit = L.kit || '#5c7cfa', kit2 = L.kit2 || shade(kit, -.25), skin = L.skin || '#f1c9a5', bulk = L.bulk || 1;
  const M = { skin: b3mat(skin, { rough: .55, phys: true, sheen: .3, sheenC: '#ffd8c2' }), kit: b3mat(kit, { phys: true, rough: .5, sheen: .6, sheenC: shade(kit, .4) }), kit2: b3mat(kit2, { phys: true, rough: .5, sheen: .5 }),
    shorts: b3mat(L.shorts || '#212529', { phys: true, rough: .55, sheen: .5 }), hair: b3mat(L.hairC || '#3b2a1e', { rough: .45, phys: true, sheen: .8, sheenC: shade(L.hairC || '#3b2a1e', .5) }),
    shoe: b3mat(L.shoe || '#f8f9fa', { rough: .35, phys: true, cc: .6 }), sole: b3mat('#212529', { rough: .7 }), white: b3mat('#ffffff', { rough: .2 }), dark: b3mat('#1a1a1a', { rough: .3 }), gold: b3mat('#fcc419', { metal: .9, rough: .25, emi: '#7a5c00', ei: .3 }) };
  if (L.ghost) for (const k of ['skin', 'kit', 'kit2', 'shorts']) Object.assign(M[k], { transparent: true, opacity: .62, emissive: new THREE.Color('#7048e8'), emissiveIntensity: .35 });
  if (L.stone) Object.assign(M.skin, { roughness: .95, sheen: 0, color: new THREE.Color('#8f8a83') });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body, L, mats: Object.values(M), M };
  const hips = b3at(new THREE.Group(), 0, .98, 0); body.add(hips); P.hips = hips;
  // shorts and torso
  const sh = b3mesh(new THREE.CapsuleGeometry(.21, .12, 8, 20), M.shorts); sh.scale.set(1.25 * bulk, 1, .95 * bulk); hips.add(b3at(sh, 0, -.02, 0));
  const spine = new THREE.Group(); hips.add(spine); P.spine = spine;
  const torso = b3mesh(new THREE.CapsuleGeometry(.23, .34, 10, 24), M.kit); torso.scale.set(1.18 * bulk, 1, .82 * bulk); spine.add(b3at(torso, 0, .36, 0));
  if (L.belly) { const b = b3mesh(new THREE.SphereGeometry(.26, 24, 16), M.kit); b.scale.set(1.1, .9, .9); spine.add(b3at(b, 0, .2, .1)); }
  const band = b3mesh(new THREE.TorusGeometry(.215, .03, 10, 40), M.kit2); band.rotation.x = Math.PI / 2; band.scale.set(1.18 * bulk, .82 * bulk, 1); spine.add(b3at(band, 0, .52, 0));
  const collar = b3mesh(new THREE.TorusGeometry(.1, .025, 8, 28), M.kit2); collar.rotation.x = Math.PI / 2; spine.add(b3at(collar, 0, .66, 0));
  if (L.badge) { const bd = new THREE.Mesh(new THREE.CircleGeometry(.11, 32), new THREE.MeshStandardMaterial({ map: emojiTex(L.badge), transparent: true, roughness: .5 })); spine.add(b3at(bd, 0, .42, .2 * bulk + .01)); }
  // head
  const head = b3at(new THREE.Group(), 0, .78, 0); spine.add(head); P.head = head;
  head.add(b3at(b3mesh(new THREE.CylinderGeometry(.07, .085, .14, 16), M.skin), 0, -.04, 0));
  const skull = b3mesh(new THREE.SphereGeometry(.24, 40, 28), M.skin); skull.scale.set(1, 1.08, 1.02); head.add(b3at(skull, 0, .2, 0));
  for (const s of [-1, 1]) {
    const eye = b3mesh(new THREE.SphereGeometry(.05, 20, 14), M.white, { cast: false }); eye.scale.set(1, 1.15, .6); head.add(b3at(eye, s * .085, .23, .205));
    const pup = b3mesh(new THREE.SphereGeometry(.03, 16, 12), L.glowEyes ? b3mat('#ff6b6b', { emi: '#ff2222', ei: 3 }) : M.dark, { cast: false }); head.add(b3at(pup, s * .085, .225, .232));
    const brow = b3mesh(new THREE.CapsuleGeometry(.014, .06, 4, 8), M.hair, { cast: false }); brow.rotation.z = Math.PI / 2 + s * (L.angry ? .35 : .08); head.add(b3at(brow, s * .088, .3, .22));
    if (!L.ears) head.add(b3at(b3mesh(new THREE.SphereGeometry(.05, 16, 12), M.skin), s * .235, .2, 0));
  }
  head.add(b3at(b3mesh(new THREE.SphereGeometry(.03, 14, 10), M.skin, { cast: false }), 0, .17, .24));
  const mouth = b3mesh(new THREE.TorusGeometry(.045, .011, 6, 20, Math.PI), b3mat('#a61e1e'), { cast: false }); mouth.rotation.z = Math.PI; head.add(b3at(mouth, 0, .1, .225)); P.mouth = mouth;
  hairOn(head, L.hair || 'short', M.hair, L);
  for (const x of L.extras || []) extraOn(P, x, M, L);
  // arms: shoulder pivot, upper arm, elbow, forearm, hand
  const limb = (r, len, mat) => b3mesh(new THREE.CapsuleGeometry(r, len, 6, 16).translate(0, -len / 2 - r * .3, 0), mat);
  P.arms = [-1, 1].map(s => {
    const shp = b3at(new THREE.Group(), s * (.3 * bulk + .04), .6, 0); spine.add(shp);
    const sl = b3mesh(new THREE.SphereGeometry(.105 * Math.sqrt(bulk), 20, 14), M.kit); sl.scale.set(1, .9, 1); shp.add(sl);
    shp.add(limb(.075 * Math.sqrt(bulk), .24, M.skin));
    const el = b3at(new THREE.Group(), 0, -.33, 0); shp.add(el); el.add(limb(.065 * Math.sqrt(bulk), .22, M.skin));
    const hand = b3mesh(new THREE.SphereGeometry(.075, 20, 14), L.gloves ? b3mat(L.gloves, { phys: true, cc: .8, rough: .3 }) : M.skin); hand.scale.set(.9, 1, 1); el.add(b3at(hand, 0, -.33, 0));
    return { sh: shp, el, hand, s };
  });
  P.legs = [-1, 1].map(s => {
    const hp = b3at(new THREE.Group(), s * .12 * bulk, -.06, 0); hips.add(hp);
    hp.add(limb(.095 * Math.sqrt(bulk), .3, M.skin));
    const kn = b3at(new THREE.Group(), 0, -.43, 0); hp.add(kn); kn.add(limb(.08 * Math.sqrt(bulk), .28, M.skin));
    const sock = b3mesh(new THREE.CylinderGeometry(.075, .07, .1, 16), M.white); kn.add(b3at(sock, 0, -.34, 0));
    const shoe = b3mesh(new THREE.CapsuleGeometry(.075, .14, 6, 16), M.shoe); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.15, 1, .9); kn.add(b3at(shoe, 0, -.44, .06));
    const sole = b3mesh(new THREE.CapsuleGeometry(.078, .15, 4, 12), M.sole); sole.rotation.x = Math.PI / 2; sole.scale.set(1.2, 1, .35); kn.add(b3at(sole, 0, -.5, .06));
    return { hp, kn, s };
  });
  if (L.ghost) P.legs.forEach(l => { l.kn.visible = false; });
  root.scale.setScalar(L.scale || 1);
  root.traverse(o => { if (o.isMesh && o.material?.emissive && !P.mats.includes(o.material)) P.mats.push(o.material); });
  P.mats = [...new Set(P.mats)]; P.mats.forEach(m => { m.userData.emi = m.emissive.clone(); m.userData.op = m.opacity; m.userData.tr = m.transparent; });
  return P;
}
function hairOn(head, style, mat, L) {
  if (style === 'bald') return;
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const m = b3mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; head.add(m); return m; };
  const cap = (cut = .5, lift = 0, s = 1.06) => add(new THREE.SphereGeometry(.245, 36, 20, 0, Math.PI * 2, 0, Math.PI * cut), 0, .22 + lift, -.01, s, s * 1.06, s, -.28);
  if (style === 'buzz') { cap(.42, 0, 1.03); return; }
  cap(style === 'long' || style === 'pony' || style === 'pigtails' || style === 'bun' ? .55 : .48);
  if (style === 'short' || style === 'mullet') add(new THREE.SphereGeometry(.12, 20, 14), .05, .4, .12, 1.4, .55, 1, -.4); // a little fringe swoop
  if (style === 'mullet') add(new THREE.CapsuleGeometry(.14, .16, 6, 16), 0, .08, -.15, 1.3, 1, .6);
  if (style === 'long') add(new THREE.CapsuleGeometry(.2, .26, 8, 20), 0, .06, -.1, 1.25, 1, .6);
  if (style === 'pony') add(new THREE.CapsuleGeometry(.065, .28, 6, 14), 0, .12, -.3, 1, 1, 1, .5);
  if (style === 'bun') add(new THREE.SphereGeometry(.09, 20, 14), 0, .42, -.16);
  if (style === 'pigtails') for (const s of [-1, 1]) add(new THREE.SphereGeometry(.09, 18, 12), s * .25, .28, -.08);
  if (style === 'afro' || style === 'curly') { const r = style === 'afro' ? .36 : .29; for (let k = 0; k < (style === 'afro' ? 22 : 16); k++) { const a = k * 2.4, h = .55 + (k % 5) * .1; add(new THREE.SphereGeometry(r * .32, 14, 10), Math.cos(a) * r * .75 * Math.sin(h * 2), .25 + Math.cos(h * 2) * r * .5 + .06, Math.sin(a) * r * .75 * Math.sin(h * 2) - .04); } }
  if (style === 'spiky') for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const m = add(new THREE.ConeGeometry(.06, .2, 12), Math.cos(a) * .14, .44, Math.sin(a) * .14 - .03); m.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); }
  if (style === 'mohawk') for (let k = 0; k < 6; k++) { const m = add(new THREE.ConeGeometry(.05, .2, 12), 0, .45 - Math.abs(k - 2.5) * .02, .15 - k * .07); m.rotation.x = -.3 - k * .12; }
}
function extraOn(P, x, M, L) {
  const head = P.head, spine = P.spine, add = (par, geo, mat, px, py, pz) => { const m = b3mesh(geo, mat.isMaterial ? mat : b3mat(mat, { phys: true, rough: .45 })); m.position.set(px, py, pz); par.add(m); return m; };
  const tc = L.type || '#868e96';
  if (x === 'headband') { const b = add(head, new THREE.TorusGeometry(.245, .03, 10, 40), tc, 0, .3, 0); b.rotation.x = Math.PI / 2 - .25; }
  if (x === 'cap') { add(head, new THREE.SphereGeometry(.255, 32, 16, 0, Math.PI * 2, 0, Math.PI * .45), L.capC || '#1864ab', 0, .25, -.01).rotation.x = -.15; const br = add(head, new THREE.CylinderGeometry(.2, .2, .025, 32, 1, false, -Math.PI / 2, Math.PI), L.capC || '#1864ab', 0, .32, .12); br.rotation.x = -.15; }
  if (x === 'whistle') { add(spine, new THREE.TorusGeometry(.13, .008, 6, 24), '#dee2e6', 0, .58, .1).rotation.x = 1.2; add(spine, new THREE.CapsuleGeometry(.025, .05, 4, 10), M.gold, 0, .48, .2).rotation.z = Math.PI / 2; }
  if (x === 'crown') { const c = add(head, new THREE.CylinderGeometry(.17, .15, .1, 32, 1, true), M.gold, 0, .5, 0); c.material.side = THREE.DoubleSide; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(head, new THREE.ConeGeometry(.035, .1, 10), M.gold, Math.cos(a) * .16, .59, Math.sin(a) * .16); add(head, new THREE.SphereGeometry(.022, 10, 8), b3mat('#e03131', { emi: '#c92a2a', ei: .8, rough: .1 }), Math.cos(a) * .165, .5, Math.sin(a) * .165); } }
  if (x === 'horns') for (const s of [-1, 1]) { const h = add(head, new THREE.TorusGeometry(.11, .035, 10, 24, Math.PI * .9), '#e9ecef', s * .17, .42, -.02); h.rotation.set(0, Math.PI / 2, s > 0 ? .3 : Math.PI - .3); }
  if (x === 'beard') { const b = add(head, new THREE.SphereGeometry(.2, 28, 18, 0, Math.PI * 2, Math.PI * .5, Math.PI * .5), L.hairC || '#3b2a1e', 0, .14, .04); b.scale.set(1.05, 1.1, 1.1); }
  if (x === 'goggles') { const g = add(head, new THREE.TorusGeometry(.245, .025, 8, 40), '#212529', 0, .27, 0); g.rotation.x = Math.PI / 2; for (const s of [-1, 1]) add(head, new THREE.CylinderGeometry(.065, .065, .05, 24), b3mat(tc, { phys: true, cc: 1, ccr: .05, metal: .3, rough: .1, emi: tc, ei: .25 }), s * .09, .25, .22).rotation.x = Math.PI / 2; }
  if (x === 'helmet') { add(head, new THREE.SphereGeometry(.29, 36, 20, 0, Math.PI * 2, 0, Math.PI * .55), b3mat(tc, { phys: true, cc: 1, ccr: .08, rough: .25 }), 0, .2, 0); const g = add(head, new THREE.TorusGeometry(.17, .015, 6, 20, Math.PI), '#dee2e6', 0, .12, .2); g.rotation.z = Math.PI; }
  if (x === 'headphones') { const b = add(head, new THREE.TorusGeometry(.26, .02, 8, 30, Math.PI), '#343a40', 0, .22, 0); b.rotation.y = Math.PI / 2; for (const s of [-1, 1]) add(head, new THREE.CylinderGeometry(.08, .08, .06, 24), tc, s * .26, .2, 0).rotation.z = Math.PI / 2; }
  if (x === 'ears') for (const s of [-1, 1]) { const e = add(head, new THREE.ConeGeometry(.08, .2, 16), L.earC || '#f59f00', s * .16, .46, -.02); e.rotation.z = -s * .35; }
  if (x === 'tail') { const t = new THREE.Group(); t.position.set(0, -.02, -.18); P.hips.add(t); let p = t; for (let k = 0; k < 5; k++) { const s = b3mesh(new THREE.SphereGeometry(.06 - k * .007, 14, 10), b3mat(L.earC || '#f59f00', { phys: true, sheen: 1 })); const g = new THREE.Group(); g.position.set(0, k ? -.08 : 0, k ? -.07 : 0); g.rotation.x = .35; p.add(g); g.add(s); p = g; } P.tail = t; }
  if (x === 'shell') { const s = add(spine, new THREE.SphereGeometry(.34, 36, 22, 0, Math.PI * 2, 0, Math.PI * .5), b3mat('#5c940d', { phys: true, cc: .7, rough: .4 }), 0, .32, -.12); s.rotation.x = -Math.PI / 2; s.scale.set(1, 1, .55); for (let k = 0; k < 5; k++) add(spine, new THREE.CircleGeometry(.07, 6), '#94d82d', (k % 3 - 1) * .14, .2 + Math.floor(k / 3) * .2, -.31).rotation.y = Math.PI; }
  if (x === 'cape') { const g = new THREE.CylinderGeometry(.3, .55, 1.05, 32, 6, true, Math.PI * .6, Math.PI * .8); const c = add(spine, g, b3mat(L.capeC || '#862e9c', { phys: true, sheen: 1, sheenC: '#ff8787', rough: .5, side: THREE.DoubleSide }), 0, .18, .02); c.rotation.y = Math.PI; P.cape = c; c.userData.base = g.attributes.position.array.slice(); }
  if (x === 'fur') { for (let k = 0; k < 26; k++) { const a = k * 2.4, y = .05 + (k % 7) * .09; add(spine, new THREE.SphereGeometry(.1, 12, 8), '#f1f3f5', Math.cos(a) * .25, y, Math.sin(a) * .2); } }
  if (x === 'spots') for (let k = 0; k < 8; k++) { const a = k * 1.7, s = add(spine, new THREE.CircleGeometry(.03, 12), '#212529', Math.sin(a) * .26, .22 + (k % 4) * .1, Math.cos(a) * .2); s.lookAt(s.position.clone().multiplyScalar(3)); }
  if (x === 'hood') { const h = add(head, new THREE.SphereGeometry(.3, 32, 20, 0, Math.PI * 2, 0, Math.PI * .62), b3mat(L.hoodC || tc, { phys: true, sheen: .8, rough: .7, side: THREE.DoubleSide }), 0, .18, -.04); h.rotation.x = -.5; }
  if (x === 'glasses') for (const s of [-1, 1]) { const g = add(head, new THREE.TorusGeometry(.055, .01, 6, 20), '#212529', s * .085, .23, .23); }
  if (x === 'aura') P.auraOn = true;
}
// what each rival looks like
const LOOKS = {
  couch: { hair: 'curly', hairC: '#6b4f3a', kit: '#adb5bd', kit2: '#868e96', shorts: '#495057', bulk: 1.18, belly: 1, extras: ['headphones'] },
  turtle: { hair: 'buzz', kit: '#2b8a3e', kit2: '#94d82d', extras: ['shell', 'headband'] },
  sprinter: { hair: 'short', kit: '#fab005', kit2: '#e67700', extras: ['headband'] },
  gymbro: { hair: 'buzz', hairC: '#212529', kit: '#212529', kit2: '#e03131', bulk: 1.3, angry: 1, gloves: '#e03131' },
  coach: { hair: 'short', hairC: '#868e96', kit: '#1864ab', kit2: '#f8f9fa', scale: 1.18, extras: ['cap', 'whistle', 'cape', 'beard'], capC: '#c92a2a', capeC: '#1864ab', angry: 1 },
  wall: { hair: 'buzz', kit: '#495057', kit2: '#adb5bd', bulk: 1.35, extras: ['helmet'] },
  cheetah: { hair: 'spiky', hairC: '#f59f00', kit: '#f59f00', kit2: '#212529', extras: ['ears', 'tail', 'spots'], earC: '#f08c00' },
  roo: { hair: 'short', hairC: '#a47148', kit: '#b08150', kit2: '#f8f9fa', extras: ['ears', 'tail'], earC: '#a47148', scale: 1.06, gloves: '#c92a2a' },
  croc: { hair: 'bald', skin: '#8fbf63', kit: '#2f9e44', kit2: '#ffd43b', extras: ['hood'], hoodC: '#2b8a3e', angry: 1 },
  storm: { hair: 'long', hairC: '#dbe4ff', kit: '#364fc7', kit2: '#74c0fc', scale: 1.18, extras: ['cape', 'goggles'], capeC: '#1c7ed6' },
  ox: { hair: 'buzz', hairC: '#212529', kit: '#862e9c', kit2: '#f8f9fa', bulk: 1.32, extras: ['horns'], angry: 1 },
  champ: { hair: 'spiky', hairC: '#212529', kit: '#f76707', kit2: '#ffd43b', extras: ['goggles'] },
  ninja: { hair: 'bald', kit: '#212529', kit2: '#c92a2a', extras: ['hood', 'headband'], hoodC: '#212529' },
  marathon: { hair: 'pony', hairC: '#c2410c', kit: '#2b8a3e', kit2: '#ffd43b', extras: ['headband'] },
  titan: { hair: 'bald', stone: 1, glowEyes: 1, kit: '#495057', kit2: '#868e96', bulk: 1.35, scale: 1.25, extras: ['cape', 'aura'], capeC: '#343a40' },
  bolt: { hair: 'mohawk', hairC: '#fab005', kit: '#fab005', kit2: '#1c7ed6', extras: ['goggles'] },
  mountain: { hair: 'beard', hairC: '#868e96', kit: '#495057', kit2: '#e9ecef', bulk: 1.4, scale: 1.12, extras: ['beard', 'fur'] },
  phantom: { hair: 'long', hairC: '#e9ecef', ghost: 1, kit: '#5f3dc4', kit2: '#9775fa', extras: ['hood'], hoodC: '#3b2a6b' },
  goat: { hair: 'short', hairC: '#f8f9fa', kit: '#fcc419', kit2: '#212529', scale: 1.22, extras: ['horns', 'crown', 'cape', 'beard', 'aura'], capeC: '#c92a2a' },
  sherpa: { hair: 'short', kit: '#e8590c', kit2: '#fff4e6', extras: ['hood', 'goggles'], hoodC: '#e8590c' },
  avalanche: { hair: 'long', hairC: '#ffd43b', kit: '#4dabf7', kit2: '#f8f9fa', extras: ['goggles', 'helmet'] },
  eaglepk: { hair: 'spiky', hairC: '#f8f9fa', kit: '#7048e8', kit2: '#fcc419', extras: ['goggles'] },
  yeti: { hair: 'afro', hairC: '#f1f3f5', skin: '#cfe3f0', kit: '#e9ecef', kit2: '#a5d8ff', shorts: '#e9ecef', bulk: 1.45, scale: 1.32, glowEyes: 1, extras: ['fur', 'aura'], angry: 1 },
};
const SKINS = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d1a07a'];
function monLook(m) {
  if (m.look) return m.look; // a PvP opponent brings their own look
  if (m.ath) {
    const spec = avatarSpec(), C = id => cos(id) || {}, Lk = Object.assign({}, LOOK_DEFAULT, spec.look || {});
    const dyed = spec.hairCol && (C(spec.hairCol).coins || C(spec.hairCol).grit);
    return { skin: Lk.skinC || C(spec.skin).c || '#f1c9a5', hairC: (dyed ? C(spec.hairCol).c : Lk.hairC) || C(spec.hairCol).c || '#5c3a21', hair: HAIR_OF[spec.hair] || 'short',
      kit: spec.kitC || '#5c7cfa', shoe: C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa'), bulk: Lk.build === 'strong' ? 1.15 : Lk.build === 'slim' ? .92 : 1,
      extras: [Lk.beard !== 'none' && 'beard', Lk.glasses !== 'none' && 'glasses', 'headband'].filter(Boolean), type: TYPES[m.types[0]][2] };
  }
  const e = m.enemy || {}, id = e.base || e.id, base = LOOKS[id] || {}, r = rng(hashStr('look' + (e.name || '')));
  const L = { skin: SKINS[Math.floor(r() * SKINS.length)], hairC: ['#3b2a1e', '#5c3a21', '#212529', '#c2410c', '#e9c46a'][Math.floor(r() * 5)], hair: ['short', 'spiky', 'long', 'curly', 'buzz'][Math.floor(r() * 5)], kit: TYPES[m.types[0]][2], kit2: TYPES[m.types[1] || 'normal'][2], ...base };
  L.type = TYPES[m.types[0]][2]; L.badge = e.icon;
  if (m.boss && !(L.extras || []).includes('cape')) L.extras = [...(L.extras || []), 'cape', 'aura'];
  return L;
}

// ---------- the stadium ----------
function b3stadium(lg) {
  const S = B3.scene, R = B3.R, [top, bot] = lgCols(lg.sky), id = lg.id;
  const night = id === 'state' || id === 'national', snow = id === 'summit', beach = id === 'regional', dusk = beach;
  const sunDir = (night ? V3(-.3, .8, .4) : dusk ? V3(-.8, .22, -.5) : snow ? V3(.4, .5, .6) : V3(.5, .7, .5)).normalize();
  const sunCol = night ? '#dbe4ff' : dusk ? '#ffb070' : '#fff1d6';
  const mid = fxMix(bot, top, .25), low = night ? shade(top, -.2) : shade(bot, -.1);
  S.add(fxSkyDome(220, top, mid, low, sunDir, sunCol, night ? .2 : dusk ? 1.6 : 1));
  fxEnv(R, S, top, mid, low, sunDir, sunCol, night ? '#1b2333' : shade(lg.ground, -.35));
  S.fog = new THREE.FogExp2(mid, night ? .012 : .009);
  R.toneMappingExposure = night ? 1.1 : dusk ? .95 : .9;
  S.add(new THREE.HemisphereLight(night ? '#8da2ff' : '#ffffff', shade(lg.ground, -.4), night ? .25 : .3));
  const sun = new THREE.DirectionalLight(sunCol, night ? 1.5 : dusk ? 2.4 : 2.6); sun.position.copy(sunDir).multiplyScalar(26); sun.castShadow = true;
  const hq = fxHQ(); sun.shadow.mapSize.set(hq ? 2048 : 1024, hq ? 2048 : 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 70 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 4; S.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(night ? '#9775fa' : '#cfe8ff', night ? 1.2 : .8); rim.position.set(6, 7, -10); S.add(rim);
  // the pitch: mown stripes, with a polished court in the middle that reflects the lights
  const grd = snow ? '#e3edf5' : beach ? '#e2b77a' : lg.ground;
  const lawn = b3tex((x, w, h) => { x.fillStyle = grd; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i += 2) { x.fillStyle = shade(grd, snow ? -.03 : -.07); x.fillRect(i * w / 16, 0, w / 16, h); } if (!snow && !beach) for (let k = 0; k < 2500; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 4); } }, 512, 512);
  lawn.wrapS = lawn.wrapT = THREE.RepeatWrapping; lawn.repeat.set(4, 4);
  const field = b3mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), b3mat('#ffffff', { map: lawn, rough: snow ? .5 : .9, env: .5 }), { cast: false }); S.add(field);
  const court = b3mesh(new THREE.CircleGeometry(6.2, 96).rotateX(-Math.PI / 2), b3mat(night ? '#1d2a44' : snow ? '#cfe2f3' : shade(grd, -.28), { phys: true, rough: .32, cc: .8, ccr: .08, env: .8 }), { cast: false }); court.position.y = .01; S.add(court);
  const line = (r1, r2, op = .85) => { const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: op })); m.position.y = .015; S.add(m); };
  line(6.05, 6.2); line(2.9, 3.0, .5);
  const mid2 = new THREE.Mesh(new THREE.PlaneGeometry(.1, 12.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5 })); mid2.rotation.y = Math.atan2(SPOT.them.x - SPOT.me.x, SPOT.them.z - SPOT.me.z) + Math.PI / 2; mid2.position.y = .016; S.add(mid2);
  if (beach) { const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 64).rotateX(-Math.PI / 2), b3mat('#1c7ed6', { phys: true, rough: .1, cc: 1, ccr: .05, env: 1.3 })); sea.position.set(0, -.3, -120); S.add(sea); }
  // the stands: tiers in a horseshoe behind the fighters, packed with a bouncing crowd
  const standCol = night ? '#2b3240' : '#868e96', tiers = 7, arc = Math.PI * 1.3, a0 = -Math.PI * .15 - arc / 2 + Math.PI * .85;
  for (let t = 0; t < tiers; t++) {
    const r = 16 + t * 1.35, h = .8 + t * .85, col = shade(standCol, (t % 2) * .07);
    S.add(b3at(b3mesh(new THREE.CylinderGeometry(r, r, h, 72, 1, true, a0, arc), b3mat(shade(col, -.15), { side: THREE.BackSide, rough: .8 }), { cast: false }), 0, h / 2, 0));
    S.add(b3at(b3mesh(new THREE.RingGeometry(r, r + 1.35, 72, 1, a0 - Math.PI / 2, arc).rotateX(-Math.PI / 2), b3mat(col, { rough: .8 }), { cast: false }), 0, h, 0));
  }
  const roof = b3mesh(new THREE.CylinderGeometry(27, 27, .6, 72, 1, true, a0, arc), b3mat(night ? '#1b1f27' : '#dee2e6', { side: THREE.DoubleSide, metal: .4, rough: .4 }), { cast: false }); roof.position.y = 9.5; S.add(roof);
  const n = 2200, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.15, .22, 4, 10), b3mat('#ffffff', { rough: .8 }), n);
  const cols = ['#e03131', '#1971c2', '#f08c00', '#2f9e44', '#f8f9fa', '#ae3ec9', '#fcc419', '#212529', '#e64980'], c = new THREE.Color(), seats = [];
  for (let i = 0; i < n; i++) { const t = i % tiers, a = a0 + Math.random() * arc, r = 16.35 + t * 1.35 + Math.random() * .7; seats.push([Math.sin(a) * r, .8 + t * .85 + .3, Math.cos(a) * r, Math.random() * 6, .6 + Math.random() * 1.2]); c.set(cols[i % cols.length]); crowd.setColorAt(i, c); }
  crowd.castShadow = false; S.add(crowd); B3.crowd = { mesh: crowd, seats, mt: new THREE.Matrix4() };
  // floodlights: bright panels that bloom, and real light pools on the court at night
  for (const [x, z] of [[-14, -11], [14, -11], [-18, 4], [18, 4]]) {
    S.add(b3at(b3mesh(new THREE.CylinderGeometry(.16, .28, 18, 16).translate(0, 9, 0), b3mat('#495057', { metal: .6, rough: .4 })), x, 0, z));
    const pan = b3at(b3mesh(new THREE.BoxGeometry(2.6, 1.3, .25), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d8', emissiveIntensity: night ? 6 : 1.5 }), { cast: false }), x, 18.4, z); pan.lookAt(0, 0, 0); S.add(pan);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('glow'), color: '#fff3c4', transparent: true, depthWrite: false, opacity: night ? .9 : .3, fog: false, toneMapped: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(night ? 12 : 6); gl.position.set(x, 18.4, z); S.add(gl);
  }
  if (night) for (const s of [SPOT.me, SPOT.them]) { const sp = new THREE.SpotLight('#fff6e0', 3, 40, .32, .7, 1.2); sp.position.set(s.x * .5, 16, s.z * .5 + 5); sp.target.position.copy(s); S.add(sp, sp.target); }
  if (snow) for (let i = 0; i < 9; i++) { const h = 26 + Math.random() * 26, a = -Math.PI / 2 + (i - 4) * .28, x = Math.cos(a) * 80, z = Math.sin(a) * 80;
    const m = b3at(b3mesh(new THREE.ConeGeometry(h * .7, h, 7), b3mat('#8d99ae', { flat: true }), { cast: false }), x, h / 2 - 1, z); S.add(m);
    S.add(b3at(b3mesh(new THREE.ConeGeometry(h * .28, h * .4, 7), b3mat('#ffffff', { flat: true, rough: .4 }), { cast: false }), x, h - 1 - h * .2, z)); }
  if (night && id === 'national') for (let k = 0; k < 6; k++) { const col = ['#cc5de8', '#4dabf7', '#f06595'][k % 3], beam = new THREE.Mesh(new THREE.CylinderGeometry(.05, 1.6, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    beam.geometry.translate(0, 15, 0); beam.position.set((k - 2.5) * 6, 9, -20); S.add(beam); B3.tick.push(t => { beam.rotation.z = Math.sin(t * .5 + k) * .5; beam.rotation.x = Math.cos(t * .4 + k) * .3; }); }
  if (snow) { const pn = 700, pos = new Float32Array(pn * 3); for (let i = 0; i < pn; i++) pos.set([rnd(25), Math.random() * 16, rnd(18)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: .1, map: ptex('glow'), transparent: true, depthWrite: false })));
    B3.tick.push(dt => { for (let i = 0; i < pn; i++) { let y = pos[i * 3 + 1] - dt * 1.1; if (y < 0) y = 16; pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(y + i) * dt * .2; } g.attributes.position.needsUpdate = true; }); }
}
// a glowing platform under each fighter, ringed in their type's colour
function b3platform(side) {
  const g = new THREE.Group(), p = SPOT[side];
  const base = b3mesh(new THREE.CylinderGeometry(1.3, 1.42, .16, 72), b3mat('#f1f3f5', { phys: true, rough: .25, cc: 1, ccr: .1, env: 1.2 })); base.position.y = .08; g.add(base);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, roughness: .3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.36, .035, 12, 96), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = .14; g.add(rim);
  const inner = new THREE.Mesh(new THREE.RingGeometry(.95, 1.0, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, toneMapped: false })); inner.position.y = .165; g.add(inner);
  g.position.copy(p); B3.scene.add(g);
  return { g, rimMat, inner };
}

// ---------- the rig: poses, blended each frame ----------
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = t => Math.pow(Math.min(1, Math.max(0, t)), 3);
const backOut = t => { const c = 1.9; t = Math.min(1, Math.max(0, t)) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
const bump = t => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const POSE0 = { f: 0, s: 0, y: 0, yaw: 0, lean: 0, roll: 0, crouch: 0, twist: 0, headX: 0, headY: 0, shL: -.75, shLz: .3, elL: -1.7, shR: -.95, shRz: -.3, elR: -1.8, hipL: -.28, knL: .35, hipR: .22, knR: .3, scale: 1 };
function mixPose(a, b, w) { const o = {}; for (const k in POSE0) o[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * w; return o; }
// each clip: a duration, a pose over time, and moments (hit, launch) that resolve the promise battle.js is waiting on
function clip(P, name, dur, pose, o = {}) {
  return new Promise(res => {
    const C = P.clip = { name, t: 0, dur: dur * (battle?.speed || 1), pose, res, hitAt: o.hitAt, onHit: o.onHit, hold: o.hold, blend: o.blend ?? .12, done: false };
    // if frames stall (hidden tab, slow graphics) the battle still moves on in real time
    setTimeout(() => { if (C.hitAt != null && !C.hitDone) { C.hitDone = true; C.onHit?.(); } C.res?.(); C.res = null; }, C.dur * 1500 + 800);
  });
}
function b3place(m, side) {
  const P = m.sp && typeof creature3 === 'function' ? creature3(m.sp) : fighter3(monLook(m)); P.side = side; P.mon = m; P.key = m.key;
  const to = SPOT[other(side)], me = SPOT[side];
  P.face = Math.atan2(to.x - me.x, to.z - me.z); P.fwd = V3(to.x - me.x, 0, to.z - me.z).normalize(); P.right = V3(P.fwd.z, 0, -P.fwd.x); P.gap = me.distanceTo(to);
  P.root.position.copy(me); P.root.position.y = .16; P.root.rotation.y = P.face;
  P.blob = fxBlob(.7, .6); P.blob.position.copy(me); P.blob.position.y = .175; B3.scene.add(P.blob);
  P.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('glow'), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, toneMapped: false })); P.aura.scale.set(2.8, 3.6, 1); P.aura.position.y = 1.1; P.root.add(P.aura);
  P.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), b3mat('#a5d8ff', { phys: true, tr: .7, th: .5, rough: .05, cc: 1, op: .55, trans: true, emi: '#4dabf7', ei: .2 })); P.ice.scale.set(.7, 1.15, .7); P.ice.position.y = 1; P.ice.visible = false; P.root.add(P.ice);
  P.pose = { ...POSE0 }; P.alpha = 1; P.hidden = true; P.root.visible = false; P.flash = 0; P.flashCol = new THREE.Color('#ffffff');
  P.el = document.getElementById(side === 'me' ? 'fMe' : 'fThem');
  B3.scene.add(P.root);
  return P;
}
function b3drop(P) { if (!P) return; B3.scene.remove(P.root); B3.scene.remove(P.blob); P.root.traverse(o => { o.geometry?.dispose(); }); }
function setAlpha(P, a) {
  P.alpha = a;
  for (const m of P.mats) { m.transparent = m.userData.tr || a < .999; m.opacity = (m.userData.op ?? 1) * a; m.depthWrite = a > .5; }
}
function idlePose(P, t) {
  const ph = P.side === 'me' ? 0 : 1.7, b = Math.sin(t * 3.4 + ph), m = P.mon;
  const p = { ...POSE0, y: Math.abs(b) * .02, crouch: .04 + b * .025, twist: Math.sin(t * 1.1 + ph) * .08, headY: Math.sin(t * .9 + ph) * .1, shL: POSE0.shL + b * .05, shR: POSE0.shR - b * .05 };
  if (m.status === 'slp') Object.assign(p, { crouch: .35, lean: .55, headX: .6, shL: .1, shLz: .15, elL: -.3, shR: .1, shRz: -.15, elR: -.3, hipL: -.9, knL: 1.6, hipR: -.9, knR: 1.6, y: -.12 + Math.sin(t * 1.5) * .02 });
  else if (m.hp / m.st.hp < .25 || m.status === 'psn' || m.status === 'tox') Object.assign(p, { lean: .25, crouch: .12, headX: .25, shL: -.2, elL: -.8, shR: -.2, elR: -.8, y: Math.abs(Math.sin(t * 5)) * .015 });
  if (m.vol?.conf) { p.roll = Math.sin(t * 3) * .15; p.headY += Math.sin(t * 5) * .3; }
  if (m.status === 'frz') Object.assign(p, POSE0, { crouch: .1 });
  if (m.status === 'par' && Math.sin(t * 13) > .85) { p.roll += rnd(.08); p.headY += rnd(.2); }
  return p;
}
function b3fighter(P, t, dt) {
  if (!P) return;
  let pose = idlePose(P, t);
  const C = P.clip;
  if (C) {
    C.t += dt; const p = Math.min(1, C.t / C.dur), cp = C.pose(p, P);
    const w = C.blend ? Math.min(seg(p, 0, C.blend), C.hold ? 1 : 1 - seg(p, 1 - C.blend, 1)) : 1;
    pose = mixPose(pose, { ...pose, ...cp }, w);
    if (C.hitAt != null && !C.hitDone && p >= C.hitAt) { C.hitDone = true; C.onHit?.(); if (!C.resAtEnd) C.res?.(); }
    if (p >= 1) { if (!C.hitAt) C.res?.(); P.clip = C.hold ? { ...C, t: C.dur, res: null, hitAt: null } : null; if (C.hold) P.held = cp; }
  }
  P.pose = pose;
  // apply
  const R = P.root, base = SPOT[P.side];
  const off = P.fwd.clone().multiplyScalar(pose.f).addScaledVector(P.right, pose.s);
  R.position.set(base.x + off.x, .16 + pose.y, base.z + off.z);
  R.rotation.set(0, P.face + pose.yaw, 0);
  R.scale.setScalar((P.L.scale || 1) * pose.scale * (P.big || 1));
  rigJoints(P, pose, t);
  if (P.tail) P.tail.rotation.y = Math.sin(t * 4) * .5;
  if (P.cape) { const g = P.cape.geometry.attributes.position, b = P.cape.userData.base; for (let i = 0; i < g.count; i++) { const y = b[i * 3 + 1], k = (.52 - y) / 1.05; g.setZ(i, b[i * 3 + 2] - k * k * (.25 + Math.sin(t * 3 + b[i * 3] * 3) * .08 + Math.max(0, pose.f) * .1)); } g.needsUpdate = true; }
  // hit flash and type-coloured glows
  P.flash = Math.max(0, P.flash - dt * 4);
  for (const m of P.mats) { if (!m.emissive) continue; m.emissive.copy(m.userData.emi).lerp(P.flashCol, P.flash); }
  const st = P.mon.status, auraCol = P.phase2 ? '#ff3b3b' : P.mon.vol?.focus ? '#cc5de8' : P.L.auraOn ? '#ffd43b' : P.mon.stg && Object.values(P.mon.stg).some(v => v >= 2) ? '#ff922b' : '';
  P.aura.material.opacity += ((auraCol && !P.hidden ? .35 + Math.sin(t * 6) * .1 : 0) - P.aura.material.opacity) * Math.min(1, dt * 6);
  if (auraCol) P.aura.material.color.set(auraCol);
  P.ice.visible = st === 'frz' && !P.hidden; if (P.ice.visible) P.ice.rotation.y = t * .2;
  // lingering status effects
  if (!P.hidden && P.alpha > .5) {
    const chest = R.position.clone().setY(R.position.y + (P.chestH ?? 1.2) * R.scale.y), head = R.position.clone().setY(R.position.y + (P.headH ?? 1.9) * R.scale.y);
    if (st === 'brn' && Math.random() < dt * 16) spawn({ pos: chest.clone().add(rv(.35)), color: Math.random() < .5 ? '#ff6b00' : '#ffd43b', tex: 'glow', size: .32, vel: V3(0, 1.8, 0), life: .55, grow: -.8 });
    if ((st === 'psn' || st === 'tox') && Math.random() < dt * 7) spawn({ pos: chest.clone().add(rv(.3)), color: '#be4bdb', tex: 'drop', size: .14, vel: V3(rnd(.3), .9, rnd(.3)), life: .9, add: false, op: .85 });
    if (st === 'par' && Math.random() < dt * 5) for (let k = 0; k < 3; k++) spawn({ pos: chest.clone().add(rv(.4)), color: '#ffe066', tex: 'spark', size: .3, vel: rv(1.5), life: .2 });
    if (st === 'slp' && Math.random() < dt * 1.6) spawn({ pos: head.clone().add(V3(.2, 0, 0)), color: '#dbe4ff', tex: 'z', size: .22, vel: V3(.25, .55, 0), life: 1.6, add: false, grow: .5, rot: .2 });
    if (P.mon.vol?.conf && Math.random() < dt * 8) { const a = t * 5 + Math.random(); spawn({ pos: head.clone().add(V3(Math.cos(a) * .4, .15, Math.sin(a) * .4)), color: '#ffe066', tex: 'star', size: .16, life: .25 }); }
    if (P.mon.vol?.leech && Math.random() < dt * 3) spawn({ pos: R.position.clone().add(rv(.4)).setY(.3), color: '#69db7c', tex: 'leaf', size: .2, vel: V3(0, .7, 0), life: .8, add: false, spin: 3 });
  }
  // keep the invisible HTML anchor over the fighter, so damage numbers land on them
  if (P.el) { const v = R.position.clone().setY(R.position.y + (P.chestH ?? 1.25) * R.scale.y).project(B3.cam); P.el.style.left = ((v.x + 1) / 2 * B3.st.clientWidth) + 'px'; P.el.style.top = ((1 - v.y) / 2 * B3.st.clientHeight) + 'px'; }
}
const chestOf = P => P.root.position.clone().setY(P.root.position.y + (P.chestH ?? 1.2) * P.root.scale.y);
const handOf = (P, k = 1) => P.arms[k].hand.getWorldPosition(V3());

// ---------- type effects: what flies from attacker to target ----------
const TCOL = t => (TYPES[t] || TYPES.normal)[2];
function shot(type, from, to, dur, onImpact) {
  const col = TCOL(type), path = t => { const p = from.clone().lerp(to, t); p.y += Math.sin(t * Math.PI) * (type === 'toxic' || type === 'water' ? 1.1 : type === 'stone' ? 0 : .35); return p; };
  if (type === 'spark') { bolt(to.clone().setY(9), to, col); flashLight(to, '#ffe066', 14, .3); setTimeout(onImpact, 60); return; }
  if (type === 'stone') { for (let k = 0; k < 6; k++) { const r = b3mesh(new THREE.DodecahedronGeometry(.18 + Math.random() * .2, 0), b3mat('#868e96', { flat: true, rough: .9 })); const st = to.clone().add(V3(rnd(.8), 6 + k * .6, rnd(.8))); r.position.copy(st); B3.scene.add(r); const d0 = dur * (.6 + k * .1);
      fxRun(d0, p => { r.position.lerpVectors(st, to.clone().add(V3(rnd(.05), -.6, rnd(.05))), easeIn(p)); r.rotation.x += .2; }, () => { burstAt(r.position, '#adb5bd', 5, { tex: 'smoke', size: .5, speed: 1.5, grav: 0, add: false }); kill(r); }); }
    setTimeout(onImpact, dur * 900); return; }
  if (type === 'earth') { ringAt(SPOT.me.clone().lerp(SPOT.them, .5).setY(.2), '#e8a76d', { grow: 9, dur: .6 }); B3.shake = .6;
    setTimeout(() => { for (let k = 0; k < 8; k++) { const r = b3mesh(new THREE.DodecahedronGeometry(.15 + Math.random() * .2, 0), b3mat('#a0785a', { flat: true })); const p0 = to.clone().setY(0).add(V3(rnd(.9), 0, rnd(.9))); r.position.copy(p0); B3.scene.add(r); const v = V3(rnd(1), 5 + Math.random() * 3, rnd(1));
      fxRun(.8, (p, dt) => { v.y -= 14 * dt; r.position.addScaledVector(v, dt); r.rotation.y += .2; }, () => kill(r)); } onImpact(); }, dur * 600); return; }
  if (type === 'mind') { for (let k = 0; k < 4; k++) setTimeout(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(.35, .04, 8, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })); B3.scene.add(m);
      fxRun(dur, p => { m.position.copy(path(p)); m.lookAt(to); m.scale.setScalar(1 + p * 1.5); m.material.opacity = 1 - p * .6; }, () => kill(m)); }, k * 90);
    setTimeout(onImpact, dur * 1000 + 270); return; }
  if (type === 'air') { for (let k = 0; k < 5; k++) setTimeout(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(.3, .03, 6, 32, Math.PI * 1.6), new THREE.MeshBasicMaterial({ color: '#e7f5ff', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, toneMapped: false })); B3.scene.add(m);
      fxRun(dur * .8, p => { m.position.copy(path(p)); m.lookAt(to); m.rotation.z += .5; m.scale.setScalar(.6 + p); m.material.opacity = .8 * (1 - p * .5); }, () => kill(m)); }, k * 60);
    setTimeout(onImpact, dur * 800 + 240); return; }
  if (type === 'legend' || type === 'spirit' && false) { const len = from.distanceTo(to), beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 1, 20, 1, true).translate(0, .5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d0bfff', transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    beam.position.copy(from); beam.lookAt(to); B3.scene.add(beam); flashLight(from, '#9775fa', 8, dur + .3);
    fxRun(dur + .35, p => { beam.scale.set(1 + Math.sin(p * 40) * .2, 1 + Math.sin(p * 40) * .2, len * easeOut(p * 3)); beam.material.opacity = p > .7 ? (1 - p) / .3 : 1; if (Math.random() < .6) spawn({ pos: from.clone().lerp(to, Math.random()), color: Math.random() < .5 ? '#fcc419' : '#9775fa', size: .25, vel: rv(1), life: .3 }); }, () => kill(beam));
    setTimeout(onImpact, dur * 400); return; }
  // everything else: a stream of particles, styled by type
  const sty = { fire: ['glow', ['#ff6b00', '#ffd43b', '#ff2a00'], .55, 18], water: ['drop', ['#4dabf7', '#a5d8ff', '#1c7ed6'], .32, 16], nature: ['leaf', ['#51cf66', '#94d82d', '#2b8a3e'], .28, 9], frost: ['shard', ['#c5f6fa', '#66d9e8', '#ffffff'], .3, 12],
    toxic: ['drop', ['#be4bdb', '#9c36b5', '#e599f7'], .4, 8], swarm: ['shard', ['#a9e34b', '#82c91e'], .22, 10], spirit: ['smoke', ['#7048e8', '#5f3dc4', '#9775fa'], .7, 12], combat: ['star', ['#ff8787', '#ffd43b'], .4, 6], normal: ['star', ['#ffffff', '#ffe066'], .35, 6], legend: ['glow', ['#9775fa', '#fcc419'], .5, 14] }[type] || ['glow', [col], .4, 10];
  const [tex, cols, size, rate] = sty, add = !['nature', 'toxic', 'swarm'].includes(type);
  const head = spawn({ pos: from, color: cols[0], tex: type === 'frost' || type === 'swarm' ? 'shard' : 'glow', size: size * 1.8, life: dur + .05 });
  const light = new THREE.PointLight(cols[0], 3, 5, 2); B3.scene.add(light);
  fxRun(dur, p => {
    const pos = path(easeIn(p) * .4 + p * .6); head.position.copy(pos); light.position.copy(pos);
    for (let k = 0; k < rate * .5; k++) spawn({ pos: pos.clone().add(rv(.12)), color: cols[Math.floor(Math.random() * cols.length)], tex, size: size * (.6 + Math.random() * .7), vel: rv(.6), life: .35 + Math.random() * .25, grow: type === 'fire' || type === 'spirit' ? 1.2 : -.5, add, spin: rnd(8), grav: type === 'water' || type === 'toxic' ? 4 : 0 });
  }, () => { B3.scene.remove(light); onImpact(); });
}
function bolt(a, b, col) {
  const mk = () => { const pts = [], n = 12; for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); if (k && k < n) p.add(V3(rnd(.35), 0, rnd(.35))); pts.push(p); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 40, .05, 6, false); };
  const m = new THREE.Mesh(mk(), new THREE.MeshBasicMaterial({ color: '#fff9db', toneMapped: false, transparent: true }));
  const glow = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, toneMapped: false })); glow.scale.set(1, 1, 1);
  B3.scene.add(m); let n = 0;
  fxRun(.35, p => { if (++n % 3 === 0) { m.geometry.dispose(); m.geometry = mk(); } m.material.opacity = 1 - p; }, () => kill(m));
  for (let k = 0; k < 14; k++) spawn({ pos: b.clone(), color: '#ffe066', tex: 'spark', size: .4, vel: rv(4, 3), grav: 5, life: .4 });
}
function impact(P, type, big) {
  const c = chestOf(P), col = TCOL(type);
  P.flash = 1; P.flashCol.set(type === 'normal' || type === 'combat' ? '#ffffff' : col);
  burstAt(c, col, big ? 22 : 12, { size: big ? .45 : .35 });
  spawn({ pos: c, color: '#ffffff', tex: 'star', size: big ? 1.6 : 1, life: .18, grow: 2 });
  ringAt(c, col, { face: B3.cam.position, grow: big ? 5 : 3.5, dur: .35 });
  flashLight(c, col, big ? 10 : 5, .3);
  if (type === 'fire') burstAt(c, '#ff6b00', 10, { tex: 'glow', size: .6, speed: 2, up: 3, grav: -2, grow: 1 });
  if (type === 'water') burstAt(c, '#74c0fc', 16, { tex: 'drop', size: .2, speed: 3, up: 3, grav: 9 });
  if (type === 'frost') { burstAt(c, '#c5f6fa', 12, { tex: 'shard', size: .3, speed: 3 }); ringAt(P.root.position.clone().setY(.2), '#99e9f2', { grow: 4, dur: .6 }); }
  if (type === 'nature') burstAt(c, '#69db7c', 12, { tex: 'leaf', size: .25, speed: 2.5, grav: 2, add: false });
  if (type === 'toxic') burstAt(c, '#be4bdb', 12, { tex: 'drop', size: .22, speed: 2.5, grav: 6 });
  if (big) B3.shake = Math.max(B3.shake, .5);
}

// ---------- clips: what battle.js asks for ----------
const PHYS_STYLE = { normal: 'punch', combat: 'kick', earth: 'stomp', stone: 'punch', air: 'leap', swarm: 'punch', spirit: 'spin', toxic: 'punch' };
async function b3play(side, kind, d = {}) {
  if (!B3.on) return false;
  const P = side === 'me' ? B3.me : B3.them, O = side === 'me' ? B3.them : B3.me;
  if (kind === 'send') {
    if (P && P.key !== d.mon.key) { b3drop(P); }
    const N = (!P || P.key !== d.mon.key) ? b3place(d.mon, side) : P;
    if (side === 'me') B3.me = N; else B3.them = N;
    N.hidden = false; N.root.visible = true; N.clip = null; setAlpha(N, 1); N.phase2 = false; N.big = d.mon.giant ? 1.8 : 1;
    B3.plat[side].rimMat.emissive.set(TCOL(d.mon.types[0])); B3.plat[side].rimMat.color.set(TCOL(d.mon.types[0])); B3.plat[side].inner.material.color.set(TCOL(d.mon.types[d.mon.types.length - 1]));
    const c = SPOT[side].clone().setY(1.1);
    spawn({ pos: c, color: '#ffffff', tex: 'glow', size: 3.5, life: .5, grow: 1 }); ringAt(SPOT[side].clone().setY(.2), TCOL(d.mon.types[0]), { grow: 5, dur: .7 }); flashLight(c, '#ffffff', 8, .5);
    burstAt(c, TCOL(d.mon.types[0]), 18, { tex: 'spark', speed: 3 });
    camFocus(SPOT[side], .9);
    return clip(N, 'send', .75, p => ({ scale: Math.max(.01, backOut(p)), y: (1 - easeOut(p)) * .6, shL: -2.6 * bump(seg(p, .4, 1)), shR: -2.6 * bump(seg(p, .4, 1)) }), { blend: 0 });
  }
  if (!P) return;
  if (kind === 'recall') {
    spawn({ pos: chestOf(P), color: '#ff6b6b', tex: 'glow', size: 2.5, life: .4 });
    await clip(P, 'recall', .4, p => ({ scale: Math.max(.01, 1 - easeIn(p)), y: p * .3 }), { blend: 0 });
    P.hidden = true; P.root.visible = false; return;
  }
  if (kind === 'faint') {
    camFocus(P.root.position, 1.4);
    await clip(P, 'faint', 1.3, p => { const a = seg(p, 0, .3), b = easeIn(seg(p, .25, .65));
      if (p > .6 && !P.dust) { P.dust = 1; burstAt(P.root.position.clone().setY(.3), '#ced4da', 14, { tex: 'smoke', size: .9, speed: 2, grav: 0, add: false, up: .5 }); }
      if (p > .65) setAlpha(P, 1 - seg(p, .65, 1));
      return { lean: -bump(a) * .2 - b * 1.45, crouch: .25 * b, y: -b * .55 - seg(p, .7, 1) * .4, headX: -.4 * b, shL: -2.4 * b, shLz: 1.1 * b, shR: -2.4 * b, shRz: -1.1 * b, elL: -.2, elR: -.2, hipL: -1.2 * b, hipR: -.9 * b, knL: .4, knR: .3, roll: bump(a) * .1 }; }, { blend: .05, hold: true });
    P.hidden = true; P.dust = 0; P.root.visible = false; return;
  }
  if (kind === 'charge') {
    if (d.kind === 'fly') { await clip(P, 'charge', .7, p => ({ crouch: .3 * bump(seg(p, 0, .4)), y: easeIn(seg(p, .35, 1)) * 14, shL: -2.8 * seg(p, .3, .5), shR: -2.8 * seg(p, .3, .5), hipL: .3, hipR: .4 }), { blend: .05 }); }
    else { for (let k = 0; k < 4; k++) setTimeout(() => burstAt(SPOT[side].clone().setY(.3), '#a0785a', 10, { tex: 'smoke', size: .7, speed: 2, add: false, grav: 1 }), k * 120);
      await clip(P, 'charge', .8, p => ({ yaw: p * 14, y: -easeIn(p) * 2.6, crouch: .2 }), { blend: .05 }); }
    P.hidden = true; P.root.visible = false; return;
  }
  if (kind === 'land') { P.hidden = false; P.root.visible = true; P.clip = null; return; }
  if (kind === 'move') { if (B3.coach && side === 'me') B3.coach.shout = B3.clock.elapsedTime; return moveClip(P, O, d.move, d); }
  if (kind === 'catch') return b3catch(P, d);
  if (kind === 'hit') {
    const cheer = side === 'them' ? B3.coach : B3.rivalCoach; if (cheer && !d.dot) cheer.cheer = B3.clock.elapsedTime + (d.eff > 1 || d.crit ? 1.4 : .9);
    if (d.dot) { P.flash = .8; P.flashCol.set(TCOL(d.type)); burstAt(chestOf(P), TCOL(d.type), 8, { tex: 'glow', size: .3, speed: 1.5 }); return clip(P, 'dot', .5, p => ({ crouch: .15 * bump(p), lean: .2 * bump(p), headX: .3 * bump(p) })); }
    const big = d.eff > 1 || d.crit;
    if (d.recoil) { P.flash = .6; P.flashCol.set('#ffffff'); return clip(P, 'recoil', .45, p => ({ lean: -.3 * bump(p), f: -.2 * bump(p) })); }
    impact(P, d.type, big); if (d.crit) slowmo(.25);
    return clip(P, 'hit', big ? .7 : .5, p => ({ f: -(big ? .9 : .5) * bump(seg(p, 0, .8)), lean: -(big ? .55 : .35) * bump(p), headX: -.4 * bump(p), roll: (big ? .25 : .1) * Math.sin(p * 12) * (1 - p), shL: -.3, shR: -.3, elL: -.4, elR: -.4, crouch: .1 * bump(p) }), { blend: .05 });
  }
  if (kind === 'miss') { return clip(P, 'dodge', .55, p => ({ s: (P.side === 'me' ? -1 : 1) * 1.1 * bump(p), lean: .1 * bump(p), roll: (P.side === 'me' ? -.3 : .3) * bump(p), hipL: -.6 * bump(p), knL: .8 * bump(p), y: .3 * bump(p) })); }
  if (kind === 'heal') {
    for (let k = 0; k < 24; k++) setTimeout(() => spawn({ pos: P.root.position.clone().add(V3(rnd(.6), Math.random() * .4, rnd(.6))), color: Math.random() < .5 ? '#69db7c' : '#d3f9d8', tex: Math.random() < .5 ? 'spark' : 'glow', size: .25, vel: V3(0, 2 + Math.random(), 0), life: .9 }), k * 25);
    ringAt(P.root.position.clone().setY(.25), '#51cf66', { grow: 3, dur: .8 }); P.flash = .5; P.flashCol.set('#51cf66');
    return clip(P, 'heal', .9, p => ({ shL: -2.2 * bump(p), shLz: .9 * bump(p), shR: -2.2 * bump(p), shRz: -.9 * bump(p), elL: -.3, elR: -.3, headX: -.3 * bump(p), y: .1 * bump(p) }));
  }
  if (kind === 'stat') {
    const up = d.up, col = up ? '#ff922b' : '#4dabf7';
    for (let k = 0; k < 14; k++) setTimeout(() => { const p0 = P.root.position.clone().add(V3(rnd(.6), up ? .2 : 2.4, rnd(.6))); spawn({ pos: p0, color: col, tex: up ? 'up' : 'down', size: .3, vel: V3(0, up ? 2.6 : -2.6, 0), life: .7, add: false, rot: 0 }); }, k * 40);
    ringAt(P.root.position.clone().setY(up ? .3 : 2), col, { grow: 3, dur: .6 }); P.flash = .45; P.flashCol.set(col);
    return clip(P, 'stat', .8, up ? p => ({ shL: -.4, shLz: 1.3 * bump(p), elL: -2.3 * bump(p), shR: -.4, shRz: -1.3 * bump(p), elR: -2.3 * bump(p), crouch: -.05 * bump(p), headX: -.25 * bump(p), y: .12 * bump(p) }) : p => ({ lean: .35 * bump(p), headX: .5 * bump(p), crouch: .2 * bump(p), shL: -.1, shR: -.1, elL: -.3, elR: -.3 }));
  }
  if (kind === 'status') {
    const c = chestOf(P), st = d.st;
    if (st === 'par') { bolt(c.clone().add(V3(0, 2.5, 0)), c, '#ffe066'); P.flash = 1; P.flashCol.set('#ffe066'); }
    else if (st === 'brn') burstAt(c, '#ff6b00', 22, { tex: 'glow', size: .55, speed: 2, up: 3, grav: -3, grow: 1 });
    else if (st === 'psn' || st === 'tox') burstAt(c, '#be4bdb', 18, { tex: 'drop', size: .25, speed: 2, up: 2, grav: 4, add: false });
    else if (st === 'frz') { burstAt(c, '#c5f6fa', 20, { tex: 'shard', size: .35, speed: 3 }); flashLight(c, '#99e9f2', 8, .5); }
    else if (st === 'slp') for (let k = 0; k < 3; k++) setTimeout(() => spawn({ pos: c.clone().add(V3(.2, .6, 0)), color: '#dbe4ff', tex: 'z', size: .3, vel: V3(.3, .8, 0), life: 1.2, add: false, grow: .6, rot: .2 }), k * 200);
    else if (st === 'conf') for (let k = 0; k < 10; k++) spawn({ pos: c.clone().add(V3(Math.cos(k) * .5, .6, Math.sin(k) * .5)), color: '#ffe066', tex: 'star', size: .2, vel: V3(Math.cos(k) * .6, .4, Math.sin(k) * .6), life: .7 });
    else if (st === 'leech') for (let k = 0; k < 12; k++) spawn({ pos: P.root.position.clone().add(V3(rnd(.5), .1, rnd(.5))), color: '#51cf66', tex: 'leaf', size: .3, vel: V3(0, 2, 0), life: .8, add: false, spin: 4 });
    return clip(P, 'status', .6, p => st === 'slp' ? { headX: .3 * bump(p) } : { roll: Math.sin(p * 30) * .1 * (1 - p), crouch: .1 * bump(p) });
  }
  if (kind === 'phase') {
    P.phase2 = true; B3.shake = 1; camFocus(P.root.position, 1.6);
    for (let k = 0; k < 4; k++) setTimeout(() => ringAt(P.root.position.clone().setY(.3), '#ff3b3b', { grow: 8, dur: .7 }), k * 180);
    flashLight(chestOf(P), '#ff3b3b', 14, 1.2);
    await clip(P, 'roar', 1.3, p => ({ shL: -1.2, shLz: 1.6 * bump(p), elL: -.5, shR: -1.2, shRz: -1.6 * bump(p), elR: -.5, lean: -.4 * bump(p), headX: -.6 * bump(p), crouch: .15 * bump(p), scale: 1 + .12 * easeOut(p) }), { blend: .1 });
    P.big = (P.big || 1) * 1.12; return;
  }
  if (kind === 'win') {
    const tr = side === 'me' ? B3.coach : B3.rivalCoach; if (tr) tr.cheer = 1e9;
    if (side === 'me') for (let k = 0; k < 60; k++) setTimeout(() => B3.on && spawn({ pos: V3(rnd(6), 7 + Math.random() * 2, rnd(4)), color: ['#fcc419', '#4dabf7', '#ff6b6b', '#51cf66'][k % 4], tex: 'shard', size: .25, vel: V3(rnd(1), -2.5, rnd(1)), life: 2.5, add: false, spin: 6 }), k * 25);
    camFocus(P.root.position, 3);
    P.clip = { name: 'win', t: 0, dur: 1e9, pose: (p, Q) => { const t = B3.clock.elapsedTime * 1.6, j = Math.abs(Math.sin(t * Math.PI)); return { y: j * .5, shL: -2.9, shLz: .4, elL: -.3 * j, shR: -1.2 + Math.sin(t * Math.PI) * .6, shRz: -.3, elR: -1.9, crouch: .15 * (1 - j), yaw: Math.sin(t) * .3 }; }, blend: .02 };
    return after(.9);
  }
}
async function moveClip(P, O, m, d) {
  const type = m.type, dmg = isDmg(m), special = SPECIAL_TYPES.has(type), target = d.target === P.side ? P : O;
  camFocus(P.root.position.clone().lerp(O.root.position, .5), 1.1);
  if (!dmg) {
    // a status move: a gesture, and an effect on whoever it's aimed at
    const self = target === P;
    if (self) return clip(P, 'buff', .75, p => ({ shL: -.5, shLz: 1.2 * bump(p), elL: -2.2 * bump(p), shR: -.5, shRz: -1.2 * bump(p), elR: -2.2 * bump(p), y: .15 * bump(p), crouch: -.05 }), { hitAt: .5, onHit: () => { ringAt(P.root.position.clone().setY(.25), TCOL(type), { grow: 3.5, dur: .6 }); burstAt(chestOf(P), TCOL(type), 14, { tex: 'glow', size: .35, speed: 2 }); } });
    return clip(P, 'cast', .8, p => ({ shR: -1.55 * easeOut(seg(p, 0, .4)), shRz: 0, elR: -.1, twist: .4 * seg(p, 0, .4), lean: .1 }), { hitAt: .4, onHit: () => shot(type, handOf(P), chestOf(O), .45, () => { O.flash = .6; O.flashCol.set(TCOL(type)); }) }).then(() => after(.45));
  }
  if (special || m.fixed && type !== 'combat') {
    // a special move: wind up, then throw it with both hands
    for (let k = 0; k < 10; k++) setTimeout(() => B3.on && spawn({ pos: handOf(P).add(rv(.5)), color: TCOL(type), tex: 'glow', size: .25, vel: handOf(P).sub(handOf(P).add(rv(.5))).multiplyScalar(3), life: .3 }), k * 30);
    let done; const landed = new Promise(r => { done = r; });
    const c = clip(P, 'special', 1.0, p => { const w = easeOut(seg(p, 0, .35)), t2 = easeOut(seg(p, .35, .48));
      return { lean: -.15 * w + .25 * t2, twist: -.35 * w + .35 * t2, shL: -1.0 * w - .55 * t2, shLz: .5 * w - .4 * t2, elL: -1.4 * w + 1.3 * t2, shR: -1.0 * w - .55 * t2, shRz: -.5 * w + .4 * t2, elR: -1.4 * w + 1.3 * t2, f: .25 * t2, hipL: -.5 * t2, knL: .5 }; },
      { hitAt: .42, onHit: () => shot(type, handOf(P, 0).lerp(handOf(P, 1), .5), chestOf(O), m.pow >= 100 ? .55 : .45, done) });
    await c; return landed;
  }
  // a physical move: charge in, strike, spring back
  const sty = PHYS_STYLE[type] || 'punch', reach = P.gap - (sty === 'kick' ? 1.25 : 1.05);
  let hitDone; const hit = new Promise(r => { hitDone = r; });
  clip(P, 'phys', sty === 'leap' ? 1.25 : 1.05, p => {
    const ant = bump(seg(p, 0, .22)), go = ease(seg(p, .18, .45)), back = easeOut(seg(p, .62, 1)), f = -.25 * ant + reach * go * (1 - back), run = seg(p, .18, .45) > 0 && seg(p, .18, .45) < 1 ? Math.sin(p * 60) : 0;
    const strike = bump(seg(p, .42, .66));
    const o = { f, crouch: .2 * ant, lean: -.15 * ant + .35 * go * (1 - back), hipL: -.28 + run * .8, hipR: .22 - run * .8, knL: .35 + Math.max(0, run) * .8, knR: .3 + Math.max(0, -run) * .8, shL: POSE0.shL + run * .5, shR: POSE0.shR - run * .5 };
    if (sty === 'punch') Object.assign(o, { shR: POSE0.shR + (-1.6 - POSE0.shR) * strike, elR: POSE0.elR * (1 - strike), shRz: -.1, twist: .55 * strike, lean: o.lean + .15 * strike });
    if (sty === 'kick') Object.assign(o, { hipR: .22 + (-1.7 - .22) * strike, knR: .3 * (1 - strike), lean: o.lean - .45 * strike, shL: -.2, shLz: 1.0 * strike, shR: -.2, shRz: -1.0 * strike, twist: -.3 * strike });
    if (sty === 'stomp') Object.assign(o, { y: bump(seg(p, .3, .55)) * 1.4, shL: -2.8 * strike, shR: -2.8 * strike, elL: -.3, elR: -.3 });
    if (sty === 'leap') Object.assign(o, { y: Math.sin(seg(p, .15, .55) * Math.PI) * 2.2, lean: o.lean + Math.min(1, seg(p, .15, .5)) * Math.PI * 2 * (1 - back) * 0 + .4 * strike, shL: -2.6 * strike, shR: -2.6 * strike, hipL: -1.2 * strike, knL: 1.5 * strike });
    if (sty === 'spin') Object.assign(o, { yaw: ease(seg(p, .2, .6)) * Math.PI * 4, shLz: 1.3 * strike, shRz: -1.3 * strike, shL: -.2, shR: -.2 });
    return o;
  }, { hitAt: sty === 'leap' ? .5 : .52, onHit: () => { if (sty === 'stomp') { ringAt(O.root.position.clone().setY(.2), '#e8a76d', { grow: 7, dur: .6 }); B3.shake = Math.max(B3.shake, .5); } hitDone(); } });
  return hit;
}
// ---------- trainers: you stand beside your creature and cheer; rival trainers do the same ----------
const COACH_AT = { me: V3(-4.0, 0, .88), them: V3(4.0, 0, -.88) };
function b3coaches() {
  const B = battle; B3.coach = B3.rivalCoach = null;
  const make = (L, side) => {
    const P = fighter3(L), at = COACH_AT[side], to = side === 'me' ? V3(-1.5, 0, 4.5) : SPOT[other(side)].clone().lerp(SPOT[side], .5);
    P.at = at; P.face = Math.atan2(to.x - at.x, to.z - at.z); P.cheer = 0; P.shout = -9; P.side = side;
    P.root.position.copy(at); P.root.rotation.y = P.face; P.root.scale.setScalar(.82 * (L.scale || 1));
    const blob = fxBlob(.45, .5); blob.position.set(at.x, .02, at.z); B3.scene.add(blob, P.root);
    return P;
  };
  try { B3.coach = make(monLook({ ath: true, types: [cur('me')?.types?.[0] || 'normal'] }), 'me'); } catch (e) { console.error(e); }
  if (B.mode === 'wild' || B.mode === 'giant') return;
  try {
    const e = B.e || {}, L = B.mode === 'pvp' || B.mode === 'ghost' ? { hair: 'short', kit: '#495057', kit2: '#adb5bd', extras: ['cap'], capC: '#495057' } : monLook({ enemy: e, types: typesOf(e), boss: e.boss });
    B3.rivalCoach = make({ ...L, scale: Math.min(1.15, L.scale || 1) }, 'them');
  } catch (e) { console.error(e); }
}
function b3coach(P, t) {
  if (!P) return;
  const ph = P.side === 'me' ? 0 : 2, b = Math.sin(t * 3 + ph), now = t;
  let p = { ...POSE0, crouch: .03 + b * .02, headY: Math.sin(t * .8 + ph) * .15, shL: -.1, shLz: .2, elL: -.3, shR: -.1, shRz: -.2, elR: -.3, hipL: -.05, hipR: .05, knL: .05, knR: .05 };
  // hands on knees, shouting, when your creature moves; a jump with both arms up after a good hit
  if (now - P.shout < 1) { const k = bump((now - P.shout) / 1); Object.assign(p, { shR: -.1 - 2.6 * k, shRz: -.2, elR: -.3 - .4 * k, lean: .12 * k, headX: -.25 * k }); }
  if (now < P.cheer) { const j = Math.abs(Math.sin(t * 7 + ph)); Object.assign(p, { y: j * .4, crouch: (1 - j) * .12, shL: -2.8, shLz: .35, elL: -.2, shR: -2.8, shRz: -.35, elR: -.2, hipL: -j * .3, knL: j * .5, hipR: -j * .3, knR: j * .5, headX: -.2 }); }
  if (P.throwT != null) { const q = Math.min(1, (now - P.throwT) / .6); Object.assign(p, { shR: -2.9 + 3.3 * easeOut(seg(q, .35, .7)), shRz: -.3, elR: -.6 * (1 - q), twist: -.5 * bump(q), lean: .25 * bump(seg(q, .3, 1)), hipL: -.5 * bump(q) }); if (q >= 1) P.throwT = null; }
  P.root.position.set(P.at.x, .02 + p.y, P.at.z); P.root.rotation.y = P.face;
  rigJoints(P, p, t);
}
// throwing a catch band: it flies from your hand, the creature is pulled in, the band wobbles, then it holds or breaks
async function b3catch(P, d) {
  const S = B3.scene;
  if (d.phase === 'throw') {
    const band = new THREE.Group(), ring = b3mesh(new THREE.TorusGeometry(.32, .07, 14, 40), b3mat(d.super ? '#9775fa' : '#e03131', { phys: true, cc: 1, rough: .25, emi: d.super ? '#7048e8' : '#c92a2a', ei: .35 }));
    const core = b3mesh(new THREE.SphereGeometry(.12, 20, 14), b3mat('#f8f9fa', { phys: true, cc: 1, rough: .2, emi: '#ffffff', ei: .4 })); band.add(ring, core); S.add(band); B3.band = band;
    if (B3.coach) B3.coach.throwT = B3.clock.elapsedTime;
    await after(.25);
    const from = B3.coach ? handOf(B3.coach).clone() : SPOT.me.clone().setY(1.5), to = chestOf(P);
    await new Promise(res => fxRun(.7, p => { band.position.copy(from.clone().lerp(to, p)); band.position.y += Math.sin(p * Math.PI) * 1.6; band.rotation.x += .4; band.rotation.y += .25; }, res));
    burstAt(to, '#ffffff', 22, { tex: 'spark', speed: 4 }); flashLight(to, '#ffffff', 12, .4); P.flash = 1; P.flashCol.set('#ffffff');
    await clip(P, 'pulled', .5, p => ({ scale: Math.max(.01, 1 - easeIn(p)), y: p * .6 }), { blend: 0, hold: true });
    P.hidden = true; P.root.visible = false;
    const ground = SPOT.them.clone().setY(.48);
    await new Promise(res => fxRun(.45, p => { band.position.lerpVectors(to, ground, easeIn(p)); band.rotation.set(Math.PI / 2 * p, 0, 0); }, res));
    band.rotation.set(Math.PI / 2, 0, 0);
    return;
  }
  const band = B3.band; if (!band) return;
  if (d.phase === 'shake') { await new Promise(res => fxRun(.55, p => { band.rotation.z = Math.sin(p * Math.PI * 2) * .5; band.position.x = SPOT.them.x + Math.sin(p * Math.PI * 2) * .06; }, res)); return; }
  if (d.phase === 'done') {
    for (let k = 0; k < 3; k++) setTimeout(() => B3.on && burstAt(band.position.clone().setY(.9), ['#fcc419', '#ffffff', '#69db7c'][k], 18, { tex: 'star', speed: 3, up: 3, grav: 3 }), k * 150);
    if (B3.coach) B3.coach.cheer = 1e9; return after(.8);
  }
  if (d.phase === 'break') {
    burstAt(band.position.clone(), '#ffffff', 26, { tex: 'spark', speed: 5 }); flashLight(band.position, '#ffffff', 10, .4); kill(band); B3.band = null;
    P.hidden = false; P.root.visible = true; P.clip = null;
    return clip(P, 'out', .5, p => ({ scale: Math.max(.01, backOut(p)) }), { blend: 0 });
  }
}
function camFocus(pos, dur) { B3.focus = { pos: pos.clone(), until: B3.clock.elapsedTime + dur * (battle?.speed || 1) }; }
function slowmo(d) { B3.slow = B3.clock.elapsedTime + d; }

// ---------- setting up and tearing down ----------
function b3mount() {
  const st = document.querySelector('#battlefx .bstage'); if (!st || !webglOK()) return;
  b3dispose();
  const B = battle, lg = leagueOf(B.e) || LEAGUES[B.mode === 'survival' ? 3 : 2];
  const R = fxRenderer(); R.domElement.className = 'b3canvas'; st.prepend(R.domElement); st.classList.add('b3');
  Object.assign(B3, { on: true, R, st, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(36, 2, .1, 600), clock: new THREE.Clock(), tick: [], fx: [], parts: [], shake: 0, lg, me: null, them: null, focus: null, sz: null, drawn: false });
  b3stadium(lg);
  B3.plat = { me: b3platform('me'), them: b3platform('them') };
  b3coaches();
  B3.comp = fxHQ() ? fxComposer(R, B3.scene, B3.cam, { strength: ['state', 'national'].includes(lg.id) ? .65 : .4, radius: .5, threshold: .85 }) : null;
  b3resize(); B3.ro = new ResizeObserver(b3resize); B3.ro.observe(st);
  B3.raf = requestAnimationFrame(b3loop);
}
function b3resize() {
  if (!B3.on) return; const w = B3.st.clientWidth, h = B3.st.clientHeight; if (!w) return;
  // resizing wipes the canvas, so only resize on a real change and redraw at once (no black frame)
  if (B3.sz === w + 'x' + h) return; B3.sz = w + 'x' + h;
  fxResize(B3.R, B3.comp, w, h); B3.cam.aspect = w / h; B3.cam.fov = w / h < 1.2 ? 46 : 36; B3.cam.updateProjectionMatrix();
  if (B3.drawn) try { B3.comp ? B3.comp.c.render() : B3.R.render(B3.scene, B3.cam); } catch (e) { console.error(e); }
}
function b3dispose() {
  if (!B3.on) return;
  cancelAnimationFrame(B3.raf); B3.on = false; B3.ro?.disconnect();
  B3.scene.traverse(o => { o.geometry?.dispose(); if (o.material) { if (o.material.map && !Object.values(TEX).includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); } });
  B3.scene.environment?.dispose?.();
  B3.R.dispose(); B3.R.forceContextLoss?.(); B3.R.domElement.remove();
}
function b3loop() {
  if (!B3.on) return;
  if (!B3.R.domElement.isConnected) { b3dispose(); return; }
  B3.raf = requestAnimationFrame(b3loop);
  let dt = Math.min(.05, B3.clock.getDelta()); const t = B3.clock.elapsedTime;
  if (B3.slow && t < B3.slow) dt *= .35;
  b3fighter(B3.me, t, dt); b3fighter(B3.them, t, dt); b3coach(B3.coach, t); b3coach(B3.rivalCoach, t);
  // the crowd bounces, louder when something big happens
  const cr = B3.crowd, hype = 1 + B3.shake * 3;
  for (let i = 0; i < cr.seats.length; i++) { const [x, y, z, ph, sp] = cr.seats[i]; cr.mt.makeTranslation(x, y + Math.max(0, Math.sin(t * sp * 4 * hype + ph)) * .12 * hype, z); cr.mesh.setMatrixAt(i, cr.mt); }
  cr.mesh.instanceMatrix.needsUpdate = true;
  for (const f of B3.tick) f(dt, t);
  for (let i = B3.fx.length - 1; i >= 0; i--) { const f = B3.fx[i]; f.t += dt; const p = Math.min(1, f.t / f.dur); f.step?.(p, dt); if (p >= 1) { B3.fx.splice(i, 1); f.end?.(); } }
  for (let i = B3.parts.length - 1; i >= 0; i--) {
    const q = B3.parts[i]; q.life -= dt;
    if (q.life <= 0) { B3.scene.remove(q.s); q.s.material.dispose(); B3.parts.splice(i, 1); continue; }
    q.v.y -= q.g * dt; if (q.drag) q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.s.position.addScaledVector(q.v, dt);
    if (q.grow) q.s.scale.multiplyScalar(Math.max(.01, 1 + q.grow * dt)); q.s.material.rotation += q.spin * dt;
    q.s.material.opacity = q.op * Math.min(1, q.life / q.max * 1.6);
  }
  for (const s of ['me', 'them']) { const pl = B3.plat[s]; pl.rimMat.emissiveIntensity = 1.8 + Math.sin(t * 3 + (s === 'me' ? 0 : 1)) * .5; pl.inner.rotation.y = t * .3; }
  // camera: the classic view from behind your fighter, drifting gently and leaning in on the action
  B3.shake = Math.max(0, B3.shake - dt * 1.3);
  const narrow = B3.cam.aspect < 1.2, base = narrow ? V3(-5.4, 3.6, 9.6) : V3(-6.4, 3.1, 7.6), look = V3(.55, 1.05, -.45);
  let want = base.clone().add(V3(Math.sin(t * .23) * .5, Math.sin(t * .31) * .15, Math.cos(t * .19) * .35)), wantLook = look.clone();
  if (B3.focus && t < B3.focus.until) { const f = B3.focus.pos; wantLook.lerp(f.clone().setY(1.1), .35); want.lerp(f.clone().add(V3(-3.6, 2.4, 5.6)), .25); }
  B3.camPos = (B3.camPos || want.clone()).lerp(want, Math.min(1, dt * 2.2)); B3.camLook = (B3.camLook || wantLook.clone()).lerp(wantLook, Math.min(1, dt * 2.6));
  const sh = B3.shake * B3.shake;
  B3.cam.position.copy(B3.camPos).add(V3(rnd(sh * .3), rnd(sh * .25), rnd(sh * .2)));
  B3.cam.lookAt(B3.camLook);
  if (B3.comp) B3.comp.c.render(); else B3.R.render(B3.scene, B3.cam);
  B3.drawn = true;
}

// hook into the battle screen: 3D when WebGL works, the 2D stage otherwise
if (typeof drawStage === 'function') {
  const _drawStage = drawStage;
  drawStage = function () { _drawStage(); try { b3mount(); } catch (e) { console.error('3D battle failed, using 2D', e); B3.on = false; document.querySelector('#battlefx .bstage')?.classList.remove('b3'); } };
  b3Anim = (side, kind, data) => B3.on ? b3play(side, kind, data) : false;
}
