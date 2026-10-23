'use strict';
/* 3D Arena battles (three.js). The battle logic in battle.js is unchanged: it
   still adds classes to the #fMe / #fThem fighter elements (atk-pow, hit, ko,
   def-block, st-burn and so on). Here those elements become invisible anchors
   that follow the 3D fighters on screen, so damage numbers, callouts and
   bursts still pop up in the right place, and each frame the classes are read
   and played as 3D animations in a stadium that matches the league. */

const B3 = { on: false };
const B3X = 2.5; // each fighter's spot, either side of the centre line

function b3mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: o.flat !== false, roughness: o.rough ?? .7, metalness: o.metal || 0,
    emissive: o.emi || 0x000000, emissiveIntensity: o.ei ?? 1, transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1, side: o.side || THREE.FrontSide, depthWrite: o.dw ?? true });
}
const b3mesh = (geo, col, o) => { const m = new THREE.Mesh(geo, b3mat(col, o)); m.castShadow = o?.cast !== false; m.receiveShadow = true; return m; };
const b3at = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); return m; };
function b3tex(draw, w = 256, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
const emojiTex = e => b3tex((x, w, h) => { x.font = `${Math.round(h * .78)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, w / 2, h * .55); });
const glowTexB = col => b3tex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, col); g.addColorStop(.35, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, 128, 128);
const lgCols = s => (String(s).match(/#[0-9a-f]{3,6}/gi) || ['#74c0fc', '#d0ebff']);

// ---------- fighters ----------
// a low-poly athlete facing +z, feet at y = 0, about 2 units tall
function fighter3({ skin = '#f1c9a5', hair = '#5c3a21', bald = false, kit = '#5c7cfa', shorts = '#212529', shoe = '#f8f9fa', head = null, scale = 1 }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body };
  const hips = b3at(new THREE.Group(), 0, .95, 0); body.add(hips); P.hips = hips;
  const torso = new THREE.Group(); hips.add(torso); P.torso = torso;
  torso.add(b3at(b3mesh(new THREE.CylinderGeometry(.3, .24, .62, 8), kit), 0, .33, 0));
  torso.add(b3at(b3mesh(new THREE.SphereGeometry(.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit), 0, .6, 0));
  hips.add(b3at(b3mesh(new THREE.CylinderGeometry(.25, .27, .26, 8), shorts), 0, -.02, 0));
  // head: a face, or the rival's emoji as a big mask
  const hd = b3at(new THREE.Group(), 0, .98, 0); torso.add(hd); P.head = hd;
  hd.add(b3at(b3mesh(new THREE.CylinderGeometry(.09, .1, .14, 6), skin), 0, -.14, 0));
  if (head) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(head), transparent: true })); sp.scale.setScalar(1.15); sp.position.set(0, .14, 0); hd.add(sp); P.mask = sp;
  } else {
    hd.add(b3at(b3mesh(new THREE.IcosahedronGeometry(.27, 2), skin), 0, .1, 0));
    if (!bald) { const h = b3at(b3mesh(new THREE.SphereGeometry(.29, 12, 8, 0, Math.PI * 2, 0, Math.PI * .45), hair), 0, .12, -.02); h.rotation.x = -.25; hd.add(h); }
    for (const s of [-1, 1]) { hd.add(b3at(b3mesh(new THREE.SphereGeometry(.035, 6, 4), '#212529', { cast: false }), s * .09, .13, .245)); hd.add(b3at(b3mesh(new THREE.SphereGeometry(.05, 6, 4), skin), s * .27, .08, 0)); }
    const m = b3at(b3mesh(new THREE.TorusGeometry(.06, .014, 4, 8, Math.PI), '#c92a2a', { cast: false }), 0, .02, .25); m.rotation.z = Math.PI; hd.add(m);
  }
  // arms: shoulder pivot, upper arm, elbow pivot, forearm and a glove
  const limb = (r1, r2, len, col) => b3mesh(new THREE.CylinderGeometry(r1, r2, len, 6).translate(0, -len / 2, 0), col);
  P.arms = [-1, 1].map(s => {
    const sh = b3at(new THREE.Group(), s * .36, .6, 0); torso.add(sh);
    sh.add(b3at(b3mesh(new THREE.SphereGeometry(.12, 8, 6), kit), 0, 0, 0)); sh.add(limb(.085, .075, .38, skin));
    const el = b3at(new THREE.Group(), 0, -.38, 0); sh.add(el); el.add(limb(.07, .06, .34, skin));
    el.add(b3at(b3mesh(new THREE.IcosahedronGeometry(.1, 1), kit), 0, -.38, 0));
    return { sh, el, s };
  });
  P.legs = [-1, 1].map(s => {
    const hp = b3at(new THREE.Group(), s * .13, -.08, 0); hips.add(hp);
    hp.add(limb(.11, .085, .44, skin));
    const kn = b3at(new THREE.Group(), 0, -.44, 0); hp.add(kn); kn.add(limb(.085, .07, .42, skin));
    kn.add(b3at(b3mesh(new THREE.BoxGeometry(.17, .12, .3), shoe), 0, -.44, .06));
    return { hp, kn, s };
  });
  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh) o.material = o.material; });
  return P;
}
function myFighter3() {
  const spec = avatarSpec(), C = id => cos(id) || {}, L = Object.assign({}, LOOK_DEFAULT, spec.look || {});
  const dyed = spec.hairCol && (C(spec.hairCol).coins || C(spec.hairCol).grit);
  return fighter3({ skin: L.skinC || C(spec.skin).c || '#f1c9a5', hair: (dyed ? C(spec.hairCol).c : L.hairC) || C(spec.hairCol).c || '#5c3a21', bald: spec.hair === 'h_bald',
    kit: spec.kitC || '#5c7cfa', shoe: C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa') });
}
function rivalFighter3(e) {
  const t = typeOfRival(e), col = statInfo(t)[3];
  return fighter3({ skin: '#e9c39b', kit: e.boss ? '#212529' : col, shorts: e.boss ? col : '#343a40', shoe: '#343a40', head: e.icon, scale: e.boss ? 1.25 : 1 });
}

// ---------- the stadium ----------
function b3stadium(lg) {
  const S = B3.scene, [top, bot] = lgCols(lg.sky), night = ['state', 'national'].includes(lg.id), snow = lg.id === 'summit', beach = lg.id === 'regional';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    map: b3tex((x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(.5, bot); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 4, 256) }));
  S.add(sky); S.fog = new THREE.Fog(bot, 40, 140);
  S.add(new THREE.HemisphereLight(night ? '#8da2ff' : '#ffffff', shade(lg.ground, -.4), night ? .55 : .75));
  const sun = new THREE.DirectionalLight(night ? '#dbe4ff' : '#fff4e0', night ? .7 : 1.1); sun.position.set(-6, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -.0005; S.add(sun);
  // pitch, centre circle and halfway line
  const grd = snow ? '#d6e6f2' : beach ? '#e9c38b' : lg.ground;
  const field = b3mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), grd, { rough: 1 }); field.receiveShadow = true; S.add(field);
  const stripes = new THREE.Group(); S.add(stripes);
  if (!snow && !beach) for (let i = -6; i <= 6; i += 2) stripes.add(b3at(b3mesh(new THREE.PlaneGeometry(2, 40).rotateX(-Math.PI / 2), shade(grd, -.06), { cast: false }), i * 2, .005, 0));
  const ring = b3at(b3mesh(new THREE.RingGeometry(3.6, 3.75, 48).rotateX(-Math.PI / 2), '#ffffff', { cast: false, op: .8 }), 0, .01, 0); S.add(ring);
  S.add(b3at(b3mesh(new THREE.PlaneGeometry(.12, 7.5).rotateX(-Math.PI / 2), '#ffffff', { cast: false, op: .8 }), 0, .012, 0));
  if (lg.id === 'regional') { const track = b3at(b3mesh(new THREE.RingGeometry(9, 12, 48).rotateX(-Math.PI / 2), '#c2410c', { cast: false }), 0, .008, 0); S.add(track); }
  // the stands: tiers in a horseshoe behind the fighters, packed with a bouncing crowd
  const standCol = night ? '#343a40' : '#868e96', tiers = 6, arc = Math.PI * 1.25, a0 = Math.PI - arc / 2;
  for (let t = 0; t < tiers; t++) {
    const r = 14 + t * 1.3, h = .9 + t * .9, col = shade(standCol, (t % 2) * .08);
    S.add(b3at(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true, a0, arc), b3mat(shade(col, -.15), { side: THREE.BackSide })), 0, h / 2, 0));
    S.add(b3at(new THREE.Mesh(new THREE.RingGeometry(r, r + 1.3, 40, 1, a0 - Math.PI / 2, arc).rotateX(-Math.PI / 2), b3mat(col)), 0, h, 0));
  }
  const n = 1600, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(.15, .22, 2, 6) : new THREE.CylinderGeometry(.15, .15, .5, 6), b3mat('#ffffff', { rough: 1 }), n);
  const cols = ['#e03131', '#1971c2', '#f08c00', '#2f9e44', '#f8f9fa', '#ae3ec9', '#fcc419', '#212529'], mt = new THREE.Matrix4(), c = new THREE.Color(), seats = [];
  for (let i = 0; i < n; i++) { const t = i % tiers, a = a0 + Math.random() * arc, r = 14.35 + t * 1.3 + Math.random() * .7; seats.push([Math.sin(a) * r, .9 + t * .9 + .3, Math.cos(a) * r, Math.random() * 6, .6 + Math.random() * 1.2]); c.set(cols[i % cols.length]); crowd.setColorAt(i, c); }
  S.add(crowd); B3.crowd = { mesh: crowd, seats, mt };
  // floodlights
  B3.lamps = [];
  for (const [x, z] of [[-13, -9], [13, -9], [-15, 5], [15, 5]]) {
    S.add(b3at(b3mesh(new THREE.CylinderGeometry(.18, .25, 16, 6).translate(0, 8, 0), '#495057'), x, 0, z));
    const pan = b3at(b3mesh(new THREE.BoxGeometry(2.4, 1.2, .3), '#f8f9fa', { emi: '#fff9db', ei: night ? 1.6 : .5 }), x, 16.4, z); pan.lookAt(0, 0, 0); S.add(pan);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexB('#fff9db'), transparent: true, depthWrite: false, opacity: night ? .9 : .35, fog: false })); gl.scale.setScalar(night ? 9 : 5); gl.position.set(x, 16.4, z); S.add(gl);
  }
  if (night) { const sp = new THREE.SpotLight('#fff9db', 1.4, 60, .5, .6); sp.position.set(0, 18, 6); S.add(sp, sp.target); }
  if (snow) for (let i = 0; i < 8; i++) { const h = 20 + Math.random() * 25, a = -Math.PI / 2 + (i - 3.5) * .3, m = b3at(b3mesh(new THREE.ConeGeometry(h * .7, h, 5), '#adb5bd', { cast: false }), Math.cos(a) * 70, h / 2 - 1, Math.sin(a) * 70); S.add(m);
    S.add(b3at(b3mesh(new THREE.ConeGeometry(h * .27, h * .38, 5), '#ffffff', { cast: false }), m.position.x, h - 1 - h * .19, m.position.z)); }
  if (beach) S.add(b3at(b3mesh(new THREE.PlaneGeometry(400, 120).rotateX(-Math.PI / 2), '#1c7ed6', { cast: false, rough: .2 }), 0, -.05, -90));
  // snow or confetti in the air
  const pn = snow ? 600 : 0;
  if (pn) { const pos = new Float32Array(pn * 3); for (let i = 0; i < pn; i++) pos.set([(Math.random() - .5) * 40, Math.random() * 16, (Math.random() - .5) * 30], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: .09 })); S.add(pts);
    B3.tick.push(dt => { for (let i = 0; i < pn; i++) { let y = pos[i * 3 + 1] - dt * 1.2; if (y < 0) y = 16; pos[i * 3 + 1] = y; } g.attributes.position.needsUpdate = true; }); }
}

// ---------- setting up and tearing down ----------
function b3mount() {
  const st = document.querySelector('#battlefx .bstage'); if (!st || !webglOK()) return;
  b3dispose();
  const B = battle, lg = leagueOf(B.e) || LEAGUES[B.mode === 'survival' ? 3 : 2];
  const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.domElement.className = 'b3canvas'; st.prepend(R.domElement); st.classList.add('b3');
  Object.assign(B3, { on: true, R, st, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(40, 2, .1, 400), clock: new THREE.Clock(), tick: [], fx: [], shake: 0, lg });
  b3stadium(lg);
  B3.me = b3place(myFighter3(), 'me'); B3.them = b3place(rivalFighter3(B.e), 'them'); B3.eid = B.e.id + B.wave;
  b3resize(); new ResizeObserver(b3resize).observe(st);
  B3.raf = requestAnimationFrame(b3loop);
}
function b3place(P, who) {
  const dir = who === 'me' ? 1 : -1;
  P.who = who; P.dir = dir; P.home = -dir * B3X; P.root.position.set(P.home, 0, 0); P.root.rotation.y = dir * Math.PI / 2;
  P.prev = new Set(); P.acts = {}; P.flash = 0; P.el = document.getElementById(who === 'me' ? 'fMe' : 'fThem');
  P.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexB('#ffffff'), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending })); P.aura.scale.set(2.6, 3.4, 1); P.aura.position.y = 1.1; P.root.add(P.aura);
  P.shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), b3mat('#74c0fc', { op: 0, emi: '#4dabf7', ei: .6, dw: false, flat: false })); P.shield.position.y = 1.05; P.shield.visible = false; P.root.add(P.shield);
  P.stars = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('⭐'), transparent: true })); s.scale.setScalar(.28); P.stars.add(s); } P.stars.visible = false; P.head.add(P.stars);
  P.groundRing = b3at(new THREE.Mesh(new THREE.RingGeometry(.7, .85, 32).rotateX(-Math.PI / 2), b3mat('#4dabf7', { op: .7, emi: '#4dabf7', cast: false, dw: false })), 0, .03, 0); P.groundRing.visible = false; P.root.add(P.groundRing);
  P.root.traverse(o => { if (o.isMesh && o.material.emissive && !o.material.transparent) o.userData.mat = o.material; });
  B3.scene.add(P.root);
  return P;
}
function b3resize() {
  if (!B3.on) return; const w = B3.st.clientWidth, h = B3.st.clientHeight; if (!w) return;
  B3.R.setSize(w, h, false); B3.cam.aspect = w / h; B3.cam.updateProjectionMatrix();
}
function b3dispose() {
  if (!B3.on) return;
  cancelAnimationFrame(B3.raf); B3.on = false;
  B3.scene.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  B3.R.dispose(); B3.R.forceContextLoss?.(); B3.R.domElement.remove();
}

// ---------- animation ----------
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const bump = t => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI); // 0 → 1 → 0
const ACT_LEN = { atk: .8, hit: .55, 'def-dodge': .7, 'def-block': .8, 'def-counter': .7, 'sp-pump': .9, 'sp-taunt': .9, 'sp-wind': .9, wobble: .7, enter: .6 };
function b3fighter(P, t, dt) {
  const el = P.el, cls = new Set(el ? el.classList : []);
  for (const k of cls) if (!P.prev.has(k)) { P.acts[k] = t; if (k === 'hit') { P.flash = 1; b3burst(P, '#ffd43b', 14); } if (k === 'atk') P.atkStat = [...cls].find(c => /^atk-/.test(c))?.slice(4) || ([...cls].find(c => /^sp-/.test(c)) ? 'special' : 'str'); }
  P.prev = cls;
  const since = k => P.acts[k] != null ? (t - P.acts[k]) / (ACT_LEN[k] || .8) : 9, on = k => cls.has(k);
  const R = P.root, B = P.body, d = P.dir, gap = B3X * 2 - 1.3;
  let x = P.home, y = 0, lean = 0, spin = 0, flip = 0, side = 0, crouch = 0;
  // arms in a boxer's guard, legs in a stance, a gentle bounce
  const bob = Math.sin(t * 5 + (d > 0 ? 0 : 1.5)) * .03;
  let aL = [-1.1, .25, -1.5], aR = [-1.1, -.25, -1.5]; // shoulder x, shoulder z, elbow x
  let lg = [.25, -.3];
  // attacks: each stat has its own move
  const ta = since('atk');
  if (ta < 1 && on('atk')) {
    const s = P.atkStat, p = bump(ta * 1.15), e = ease(Math.min(1, ta * 1.6));
    if (s === 'spd') { x += d * gap * p; lean = .5 * p; aR = [-1.6 * p - .4, 0, -.2]; }
    else if (s === 'pow') { x += d * gap * Math.min(1, e); y = Math.sin(Math.min(1, ta * 1.4) * Math.PI) * 1.8; aL = aR = [-3, 0, 0]; if (ta > .45 && !P.slam) { P.slam = 1; b3shock(P.home + d * gap, statInfo('pow')[3]); B3.shake = .5; } }
    else if (s === 'end') { x += d * gap * p; spin = ta * Math.PI * 4; aL = [-.2, 1.4, 0]; aR = [-.2, -1.4, 0]; }
    else if (s === 'agi') { x += d * gap * p; y = bump(ta * 1.2) * 1.2; flip = -Math.min(1, ta * 1.25) * Math.PI * 2; }
    else if (s === 'special') { x += d * gap * p; y = bump(ta) * .6; aL = aR = [-1.6 - p, 0, 0]; lean = .3 * p; }
    else { x += d * gap * p; lean = .35 * p; aR = [-1.55, -.1, -.1 * (1 - p)]; } // str: a straight punch
  } else P.slam = 0;
  // being hit: knocked back, leaning away, flashing
  const th = since('hit'); if (th < 1) { x -= d * .7 * bump(th); lean -= .5 * bump(th); }
  // your defences
  const tdg = since('def-dodge'); if (tdg < 1) { side = bump(tdg) * 1.3; lean = -.2 * bump(tdg); }
  const tb = since('def-block'); P.shield.visible = tb < 1;
  if (tb < 1) { aL = [-1.4, .9, -2.1]; aR = [-1.4, -.9, -2.1]; crouch = .12 * bump(tb); P.shield.material.opacity = .35 * bump(tb) + .05; P.shield.material.color.set(on('def-perfect') ? '#ffd43b' : '#74c0fc'); P.shield.material.emissive.set(on('def-perfect') ? '#fab005' : '#4dabf7'); P.shield.scale.setScalar(.9 + bump(tb) * .2); }
  const tc = since('def-counter'); if (tc < 1) { spin = ease(tc) * Math.PI * 2; x += d * .8 * bump(tc); lg = [-1.2 * bump(tc), -.2]; }
  // status moves
  const tp = Math.min(since('sp-pump'), since('sp-wind'), since('sp-taunt'));
  if (tp < 1) { const p = bump(tp); if (on('sp-taunt')) { aL = [-.3, 1.8 * p, 0]; aR = [-.3, -1.8 * p, 0]; lean = -.2 * p; } else if (on('sp-wind')) { crouch = .3 * p; aL = aR = [-.8, 0, -.4]; } else { aL = [0, 1.5, -2.2 * p]; aR = [0, -1.5, -2.2 * p]; y = .15 * p; } }
  if (since('wobble') < 1 || on('st-dizzy') || on('st-daze') || on('st-stun')) side += Math.sin(t * 7) * .12;
  const te = since('enter'); if (te < 1) y = (1 - ease(te)) * 7;
  // K.O.: falls flat; winning: a celebration
  let ko = 0;
  if (on('ko')) { const tk = Math.min(1, (t - (P.acts.ko ?? t)) / .7); ko = ease(tk); }
  if ([...cls].some(c => /^dance-/.test(c))) { const td = t - (P.acts[[...cls].find(c => /^dance-/.test(c))] ?? t); y = Math.abs(Math.sin(td * 6)) * .6; spin = td * 3; aL = [-3, .3, 0]; aR = [-3, -.3, 0]; }
  // apply the pose
  R.position.set(x, y + bob, side * (d > 0 ? 1 : -1));
  B.rotation.set(0, 0, 0); B.position.set(0, 0, 0);
  B.rotation.order = 'YXZ'; B.rotation.y = spin; B.rotation.x = lean + flip - ko * Math.PI / 2;
  if (flip) B.position.y = .95 * (1 - Math.cos(flip)) * .2;
  if (ko) B.position.set(0, .25 * ko, -ko * .9);
  P.hips.position.y = .95 - crouch;
  const [l, r] = P.arms; l.sh.rotation.set(aL[0], 0, aL[1]); l.el.rotation.x = aL[2]; r.sh.rotation.set(aR[0], 0, aR[1]); r.el.rotation.x = aR[2];
  const walk = ta < 1 && on('atk') ? Math.sin(ta * 20) * .6 : 0;
  P.legs[0].hp.rotation.x = lg[0] + walk - crouch; P.legs[1].hp.rotation.x = lg[1] - walk - crouch; P.legs[0].kn.rotation.x = P.legs[1].kn.rotation.x = .25 + crouch * 2;
  // hit flash, auras and status effects
  P.flash = Math.max(0, P.flash - dt * 3);
  P.root.traverse(o => { if (o.userData.mat) o.userData.mat.emissive.setRGB(P.flash, P.flash * .1, P.flash * .1); });
  const aura = on('phase2') ? '#ff3b3b' : on('st-pumped') || (tp < 1 && on('sp-pump')) ? '#ff922b' : on('special') ? '#ffd43b' : on('st-regen') ? '#51cf66' : on('st-focus') ? '#cc5de8' : '';
  P.aura.material.opacity += ((aura ? .55 + Math.sin(t * 8) * .15 : 0) - P.aura.material.opacity) * Math.min(1, dt * 8);
  if (aura) P.aura.material.color.set(aura);
  if (on('phase2')) P.root.scale.setScalar(1.25 * (B3.them === P && battle?.e?.boss ? 1.12 : 1));
  P.stars.visible = on('st-dizzy') || on('st-daze') || on('st-stun');
  if (P.stars.visible) P.stars.children.forEach((s, k) => { const a = t * 3 + k * Math.PI / 2; s.position.set(Math.cos(a) * .4, .45, Math.sin(a) * .4); });
  P.groundRing.visible = on('st-guard'); if (on('st-guard')) P.groundRing.rotation.y = t;
  if (on('st-burn') && Math.random() < dt * 14) b3ember(P);
  if (P.mask) P.mask.material.rotation = Math.sin(t * 2) * .06;
  // keep the invisible HTML anchor over the fighter so pop-ups land on it
  if (el) { const v = new THREE.Vector3(R.position.x, 1.15 * R.scale.y + R.position.y * .6, R.position.z).project(B3.cam); el.style.left = ((v.x + 1) / 2 * B3.st.clientWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * B3.st.clientHeight) + 'px'; }
}
// sparks, fire, shockwaves and shots
function b3burst(P, col, n = 10) {
  const o = new THREE.Vector3(P.root.position.x, 1.3, P.root.position.z);
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 0), b3mat(col, { emi: col, ei: 1, cast: false })); m.position.copy(o); B3.scene.add(m);
    const v = new THREE.Vector3((Math.random() - .5) * 6, Math.random() * 5 + 1, (Math.random() - .5) * 6); B3.fx.push({ m, v, life: .7, grav: 12 }); }
}
function b3ember(P) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: B3.fireTex = B3.fireTex || glowTexB('#ff6b00'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(.35); s.position.set(P.root.position.x + (Math.random() - .5) * .6, .3 + Math.random() * 1.4, P.root.position.z + (Math.random() - .5) * .6); B3.scene.add(s);
  B3.fx.push({ m: s, v: new THREE.Vector3(0, 1.6, 0), life: .6, grav: 0, fade: true });
}
function b3shock(x, col) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.2, .45, 32).rotateX(-Math.PI / 2), b3mat(col, { emi: col, op: .9, cast: false, dw: false })); m.position.set(x, .05, 0); B3.scene.add(m);
  B3.fx.push({ m, life: .6, grow: 9, fade: true });
}
function b3projectile(from, stat, kind) {
  if (!B3.on) return;
  const a = from === 'me' ? B3.me : B3.them, b = from === 'me' ? B3.them : B3.me;
  const col = kind === 'fire' ? '#ff6b00' : kind === 'boss' ? '#9c36b5' : statInfo(stat)[3];
  const g = new THREE.Group(), core = new THREE.Mesh(new THREE.IcosahedronGeometry(kind === 'boss' ? .35 : .22, 1), b3mat('#ffffff', { emi: col, ei: 1.6, cast: false }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexB(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(kind === 'boss' ? 2.2 : 1.4);
  g.add(core, glow); g.position.set(a.root.position.x, 1.3, 0); B3.scene.add(g);
  const light = new THREE.PointLight(col, 1.5, 5); g.add(light);
  B3.fx.push({ m: g, life: .45, path: { x0: a.home + a.dir * .6, x1: b.home, arc: stat === 'pow' ? 1.6 : stat === 'agi' ? .8 : .2 }, trail: col, t0: .45, hit: () => { b3burst(b, col, 16); b3shock(b.home, col); } });
}
function b3loop() {
  if (!B3.on) return;
  if (!B3.R.domElement.isConnected) { b3dispose(); return; }
  B3.raf = requestAnimationFrame(b3loop);
  const dt = Math.min(.05, B3.clock.getDelta()), t = B3.clock.elapsedTime, B = battle;
  if (B && B.e && B3.eid !== B.e.id + B.wave) { // survival: the next wave's rival walks on
    B3.scene.remove(B3.them.root); B3.them = b3place(rivalFighter3(B.e), 'them'); B3.eid = B.e.id + B.wave; B3.them.acts.enter = t; B3.them.prev = new Set(['enter']); }
  b3fighter(B3.me, t, dt); b3fighter(B3.them, t, dt);
  // the crowd bounces, louder when something big happens
  const cr = B3.crowd, hype = 1 + B3.shake * 3;
  for (let i = 0; i < cr.seats.length; i++) { const [x, y, z, ph, sp] = cr.seats[i]; cr.mt.makeTranslation(x, y + Math.max(0, Math.sin(t * sp * 4 * hype + ph)) * .12 * hype, z); cr.mesh.setMatrixAt(i, cr.mt); }
  cr.mesh.instanceMatrix.needsUpdate = true;
  for (const f of B3.tick) f(dt, t);
  for (let i = B3.fx.length - 1; i >= 0; i--) {
    const f = B3.fx[i]; f.life -= dt;
    if (f.path) { const p = 1 - f.life / f.t0, x = f.path.x0 + (f.path.x1 - f.path.x0) * p; f.m.position.set(x, 1.3 + Math.sin(p * Math.PI) * f.path.arc, 0); f.m.rotation.y += dt * 10;
      if (Math.random() < .7) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexB(f.trail), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(.6); s.position.copy(f.m.position); B3.scene.add(s); B3.fx.push({ m: s, life: .3, fade: true, shrink: true }); }
      if (f.life <= 0) f.hit?.(); }
    if (f.v) { f.v.y -= (f.grav || 0) * dt; f.m.position.addScaledVector(f.v, dt); }
    if (f.grow) f.m.scale.multiplyScalar(1 + f.grow * dt * .5);
    if (f.shrink) f.m.scale.multiplyScalar(1 - dt * 3);
    if (f.fade) { const mat = f.m.material; if (mat) mat.opacity = Math.max(0, f.life / .6); }
    if (f.life <= 0) { B3.scene.remove(f.m); f.m.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); B3.fx.splice(i, 1); }
  }
  // camera: a slow drift, leaning toward whoever is attacking, with screen shake
  if (B3.st.classList.contains('shake')) B3.shake = Math.max(B3.shake, .35);
  B3.shake = Math.max(0, B3.shake - dt * 1.4);
  const focus = (B3.me.root.position.x + B3.them.root.position.x) / 2, cam = B3.cam, sh = B3.shake;
  B3.camX = (B3.camX ?? 0) + (focus * .6 - (B3.camX ?? 0)) * Math.min(1, dt * 3);
  cam.position.set(B3.camX + Math.sin(t * .25) * 1.2 + (Math.random() - .5) * sh * .5, 2.6 + Math.sin(t * .4) * .2 + (Math.random() - .5) * sh * .4, 9.2);
  cam.lookAt(B3.camX * .8, 1.25, 0);
  B3.R.render(B3.scene, cam);
}

// hook into the battle screen without touching its logic
if (typeof drawStage === 'function') {
  const _drawStage = drawStage;
  drawStage = function () { _drawStage(); try { b3mount(); } catch (e) { console.error('3D battle failed, using 2D', e); document.querySelector('#battlefx .bstage')?.classList.remove('b3'); } };
  const _projectile = projectile;
  projectile = function (from, stat, kind) { if (B3.on) return b3projectile(from, stat, kind); return _projectile(from, stat, kind); };
}
