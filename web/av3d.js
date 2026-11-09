'use strict';
/* 2.57 the big 3D avatar on the You page. A simple chunky figure built from
   rounded shapes in your avatar's colours (skin, hair, kit, shoes), wearing
   the gear you have on (each piece shows on the model in its rarity colour),
   with your class's outfit tint and aura. Drag to turn it.

   Restyling: every size and material lives in AV3_STYLE and av3mat(), and each
   body part and gear piece has its own small builder below (AV3_GEAR), so a
   new look only means changing this file. three.js loads the first time the
   You page opens (the same files Islands uses); until then, and on computers
   without WebGL, the 2D avatar shows instead. */

const AV3_STYLE = {
  rough: .62, skinRough: .5, metalRough: .3, metal: .75,
  headR: .32, bodyR: .3, bodyLen: .32, armR: .095, armLen: .42, legR: .12, legLen: .5,
  hipY: .82, shoulderY: 1.4, headY: 1.86, tint: .45, // how much the class colour tints the kit
  bg: ['#262b45', '#141726'],
};
const AV3 = { R: null, S: null, cam: null, root: null, fig: null, aura: null, sig: '', yaw: .45, spin: true, drag: null, raf: 0, host: null };

function av3mat(col, o = {}) {
  return new THREE.MeshStandardMaterial({ color: col, roughness: o.r ?? AV3_STYLE.rough, metalness: o.m ?? 0, emissive: o.e || '#000000', emissiveIntensity: o.ei ?? 1, transparent: o.op != null, opacity: o.op ?? 1, depthWrite: o.op == null });
}
function av3mesh(par, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; par.add(m); return m;
}
const av3cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
const av3sph = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);
const av3mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

// the colours the 2D avatar uses
function av3colors(spec) {
  const C = id => cos(id) || {}, L = Object.assign({}, LOOK_DEFAULT, spec.look || {});
  const dyed = spec.hairCol && (C(spec.hairCol).coins || C(spec.hairCol).grit);
  return {
    skin: L.skinC || C(spec.skin).c || '#f1c9a5',
    hair: (dyed ? C(spec.hairCol).c : L.hairC) || C(spec.hairCol).c || '#5c3a21',
    kit: spec.kitC || '#5c7cfa',
    shoe: C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa'),
    eye: L.eyeCol || '#3b2a1e', bald: spec.hair === 'h_bald' || spec.hair === 'h_buzz', long: /long|pony|flow|locs|wavy|bob|pigtails|twists/.test(spec.hair || ''),
    build: { slim: .9, regular: 1, athletic: 1.06, broad: 1.14 }[L.build] || 1, tall: { short: .94, average: 1, tall: 1.06 }[L.height] || 1,
  };
}

// ---------- gear on the model: one builder per template, coloured by rarity ----------
// P = the figure's attach points, c = rarity colour, M = metal version of it
const AV3_GEAR = {
  'Study Cap': (P, c) => { const g = P.head; av3mesh(g, new THREE.BoxGeometry(.62, .05, .62), av3mat('#212529'), 0, .3, 0).rotation.y = Math.PI / 4; av3mesh(g, new THREE.CylinderGeometry(.24, .26, .14, 20), av3mat('#212529'), 0, .22, 0); av3mesh(g, av3sph(.04), av3mat(c, { e: c, ei: .4 }), .2, .29, .2); },
  Helm: (P, c, M) => { const g = P.head; const h = av3mesh(g, new THREE.SphereGeometry(AV3_STYLE.headR * 1.12, 28, 16, 0, Math.PI * 2, 0, Math.PI * .55), M, 0, .02, 0); h.scale.y = 1.05; av3mesh(g, new THREE.BoxGeometry(.06, .2, .1), M, 0, .1, .33); },
  Headband: (P, c) => { av3mesh(P.head, new THREE.TorusGeometry(AV3_STYLE.headR * 1.0, .035, 10, 32), av3mat(c), 0, .1, 0).rotation.x = Math.PI / 2; },
  Hoodie: (P, c) => { const b = av3mesh(P.chest, av3cap(AV3_STYLE.bodyR * 1.1, AV3_STYLE.bodyLen), av3mat(c)); b.scale.z = .92; av3mesh(P.chest, new THREE.TorusGeometry(.17, .07, 10, 20), av3mat(av3mix(c, '#000', .2)), 0, .36, -.14).rotation.x = Math.PI / 2.4; },
  Chestplate: (P, c, M) => { const b = av3mesh(P.chest, new THREE.SphereGeometry(AV3_STYLE.bodyR * 1.14, 24, 16, -Math.PI * .5, Math.PI, Math.PI * .2, Math.PI * .55), M, 0, .04, .01); b.scale.y = 1.25; for (const s of [-1, 1]) av3mesh(P.chest, av3sph(.13, 16, 12), M, s * .33, .3, 0).scale.y = .7; },
  Robe: (P, c) => { av3mesh(P.chest, new THREE.CylinderGeometry(AV3_STYLE.bodyR * 1.08, .42, .95, 24, 1, true), av3mat(c, { r: .8 }), 0, -.3, 0).material.side = THREE.DoubleSide; av3mesh(P.chest, new THREE.TorusGeometry(.3, .03, 8, 24), av3mat('#fcc419', { m: .7, r: .3 }), 0, -.08, 0).rotation.x = Math.PI / 2; },
  'Track Pants': (P, c) => { for (const L of P.legs) { const m = av3mesh(L, av3cap(AV3_STYLE.legR * 1.18, AV3_STYLE.legLen * .9), av3mat(c), 0, -AV3_STYLE.legLen / 2 - .02, 0); av3mesh(L, new THREE.BoxGeometry(.02, AV3_STYLE.legLen * .8, .02), av3mat('#ffffff'), AV3_STYLE.legR * 1.15 * Math.sign(L.position.x), -AV3_STYLE.legLen / 2, 0); m.castShadow = true; } },
  Greaves: (P, c, M) => { for (const L of P.legs) av3mesh(L, new THREE.CylinderGeometry(AV3_STYLE.legR * 1.3, AV3_STYLE.legR * 1.15, AV3_STYLE.legLen * .5, 16), M, 0, -AV3_STYLE.legLen * .72, .01); },
  'Training Shorts': (P, c) => { for (const L of P.legs) av3mesh(L, new THREE.CylinderGeometry(AV3_STYLE.legR * 1.4, AV3_STYLE.legR * 1.3, AV3_STYLE.legLen * .4, 16), av3mat(c), 0, -.08, 0); },
  Spikes: (P, c) => { for (const F of P.feet) { F.children[0].material = av3mat(c); for (let i = 0; i < 3; i++) av3mesh(F, new THREE.ConeGeometry(.02, .06, 6), av3mat('#dee2e6', { m: .8, r: .3 }), (i - 1) * .06, -.08, .08).rotation.x = Math.PI; } },
  Boots: (P, c, M) => { for (const F of P.feet) { F.children[0].material = M; av3mesh(F, new THREE.CylinderGeometry(.13, .12, .22, 16), M, 0, .1, -.02); } },
  Slippers: (P, c) => { for (const F of P.feet) { F.children[0].material = av3mat(c, { r: .9 }); av3mesh(F, av3sph(.06, 12, 8), av3mat('#ffffff', { r: 1 }), 0, .04, .14); } },
  Gloves: (P, c) => { for (const H of P.hands) { H.children[0].material = av3mat(c); H.children[0].scale.setScalar(1.25); } },
  'Pen of Power': (P, c) => { const h = P.hands[1]; const p = av3mesh(h, new THREE.CylinderGeometry(.025, .025, .42, 10), av3mat(c, { e: c, ei: .35 }), 0, .02, .1); p.rotation.x = Math.PI / 2.4; av3mesh(h, new THREE.ConeGeometry(.025, .07, 10), av3mat('#fcc419', { m: .8, r: .3 }), 0, -.07, .29).rotation.x = Math.PI / 2.4 + Math.PI; },
  Tape: (P, c) => { for (const H of P.hands) av3mesh(H, new THREE.TorusGeometry(.085, .028, 8, 18), av3mat('#f8f9fa', { r: .9 }), 0, .1, 0).rotation.x = Math.PI / 2; },
  'Lucky Clover': (P, c) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = av3mesh(g, av3sph(.06, 12, 8), av3mat('#40c057', { e: '#2b8a3e', ei: .3 }), Math.cos(i * Math.PI / 2) * .06, Math.sin(i * Math.PI / 2) * .06, 0); l.scale.z = .3; } P.charm.add(g); },
  'Seer Orb': (P, c) => { av3mesh(P.charm, av3sph(.1), av3mat(c, { e: c, ei: .9, r: .1, op: .85 })); },
  Medal: (P, c) => { av3mesh(P.chest, new THREE.CylinderGeometry(.08, .08, .025, 20), av3mat('#fcc419', { m: .85, r: .25 }), 0, .1, AV3_STYLE.bodyR + .02).rotation.x = Math.PI / 2; av3mesh(P.chest, new THREE.BoxGeometry(.05, .14, .01), av3mat(c), 0, .22, AV3_STYLE.bodyR); },
};

// ---------- the figure ----------
function av3figure(spec, gear, clsCol) {
  const S = AV3_STYLE, K = av3colors(spec), fig = new THREE.Group(), P = { legs: [], feet: [], hands: [] };
  const kit = clsCol ? av3mix(K.kit, clsCol, S.tint) : K.kit;
  const mSkin = av3mat(K.skin, { r: S.skinRough }), mKit = av3mat(kit), mKit2 = av3mat(av3mix(kit, '#000', .25)), mShoe = av3mat(K.shoe), mHair = av3mat(K.hair, { r: .8 });
  fig.scale.set(K.build, K.tall, K.build);
  // legs and feet
  for (const s of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(s * .14, S.hipY, 0); fig.add(L); P.legs.push(L);
    av3mesh(L, av3cap(S.legR, S.legLen), mKit2, 0, -S.legLen / 2, 0);
    const F = new THREE.Group(); F.position.set(0, -S.legLen - S.legR * .9, .04); L.add(F); P.feet.push(F);
    const shoe = av3mesh(F, av3sph(.13, 20, 14), mShoe); shoe.scale.set(.9, .55, 1.35);
  }
  // body
  const chest = P.chest = new THREE.Group(); chest.position.y = S.hipY + .32; fig.add(chest);
  av3mesh(chest, av3cap(S.bodyR, S.bodyLen), mKit).scale.z = .85;
  av3mesh(chest, av3sph(.12, 16, 12), mSkin, 0, S.bodyLen / 2 + .2, 0); // neck
  // arms
  P.arms = [];
  for (const s of [-1, 1]) {
    const A = new THREE.Group(); A.position.set(s * (S.bodyR + .1), S.shoulderY - chest.position.y + .05, 0); A.rotation.z = s * .12; chest.add(A); P.arms.push(A);
    av3mesh(A, av3sph(S.armR * 1.35, 16, 12), mKit); // shoulder
    av3mesh(A, av3cap(S.armR, S.armLen), mKit, 0, -S.armLen / 2 - .04, 0);
    const H = new THREE.Group(); H.position.y = -S.armLen - .12; A.add(H); P.hands.push(H);
    av3mesh(H, av3sph(S.armR * 1.15, 16, 12), mSkin);
  }
  // head
  const head = P.head = new THREE.Group(); head.position.y = S.headY; fig.add(head);
  av3mesh(head, av3sph(S.headR, 32, 24), mSkin).scale.set(1, 1.05, .95);
  const mEye = av3mat('#1b1b25', { r: .2 });
  for (const s of [-1, 1]) {
    av3mesh(head, av3sph(.045, 12, 10), mEye, s * .11, .03, S.headR * .9).scale.z = .5;
    av3mesh(head, av3sph(.06, 12, 10), mSkin, s * S.headR * .98, 0, 0).scale.set(.5, 1, .8); // ears
  }
  const mouth = av3mesh(head, new THREE.TorusGeometry(.06, .014, 6, 16, Math.PI), av3mat('#7a3b2e'), 0, -.1, S.headR * .9); mouth.rotation.z = Math.PI;
  if (!K.bald && !gear.Helm) {
    const h = av3mesh(head, new THREE.SphereGeometry(S.headR * 1.06, 32, 20, 0, Math.PI * 2, 0, Math.PI * .5), mHair, 0, .02, -.02); h.rotation.x = -.25;
    if (K.long) av3mesh(head, av3cap(S.headR * .85, .3), mHair, 0, -.18, -.12).scale.z = .55;
  }
  // charm floats beside you
  const charm = P.charm = new THREE.Group(); charm.position.set(.62, 1.5, .1); fig.add(charm);
  // gear
  for (const [base, c] of Object.entries(gear)) { const f = AV3_GEAR[base]; if (f) try { f(P, c, av3mat(av3mix(c, '#adb5bd', .45), { m: S.metal, r: S.metalRough })); } catch (e) { console.error(e); } }
  fig.userData.P = P;
  return fig;
}
// class aura: a glowing ring on the ground and motes rising around you
function av3aura(col) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .78, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .01; g.add(ring);
  const motes = [];
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(av3sph(.025, 8, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9 })); m.userData = { a: Math.random() * Math.PI * 2, r: .5 + Math.random() * .3, s: .3 + Math.random() * .4, o: Math.random() * 2 }; g.add(m); motes.push(m); }
  g.userData = { ring, motes };
  return g;
}

// the backdrop: a soft vertical glow, tinted by your class colour
function av3sky(col) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  const [top, bot] = AV3_STYLE.bg, mid = col ? av3mix(top, col, .35) : av3mix(top, '#5c6bc0', .25);
  g.addColorStop(0, bot); g.addColorStop(.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  if (AV3.S.background) AV3.S.background.dispose();
  AV3.S.background = new THREE.CanvasTexture(c); AV3.S.background.encoding = THREE.sRGBEncoding;
}
function av3init() {
  const R = AV3.R = fxRenderer();
  const S = AV3.S = new THREE.Scene();
  AV3.cam = new THREE.PerspectiveCamera(30, 1, .1, 50); AV3.cam.position.set(0, 1.3, 5.6); AV3.cam.lookAt(0, 1.08, 0);
  S.add(new THREE.HemisphereLight('#e3e8ff', '#3a2e4a', .9));
  const sun = new THREE.DirectionalLight('#fff3df', 1.25); sun.position.set(2.5, 5, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 15 }); S.add(sun); AV3.sun = sun;
  const rim = new THREE.DirectionalLight('#9d8cff', .5); rim.position.set(-3, 2, -3); S.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: .35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
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
    P.chest.scale.y = 1 + b * .012; P.head.position.y = AV3_STYLE.headY + b * .01;
    P.arms[0].rotation.x = Math.sin(s * 1.3) * .05; P.arms[1].rotation.x = -Math.sin(s * 1.3) * .05;
    P.charm.position.y = 1.5 + Math.sin(s * 1.6) * .06; P.charm.rotation.y = s;
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
    AV3.root.clear();
    AV3.fig = av3figure(d.spec || avatarSpec(), d.gear || {}, d.cls || ''); AV3.root.add(AV3.fig);
    AV3.aura = d.cls ? av3aura(d.cls) : null; if (AV3.aura) AV3.root.add(AV3.aura);
    av3sky(d.cls || '');
    AV3.R.shadowMap.enabled = !D.settings.lowQuality; AV3.sun.castShadow = !D.settings.lowQuality;
  }
  const W = host.clientWidth, H = host.clientHeight;
  if (W && H && (AV3.w !== W || AV3.h !== H)) { AV3.w = W; AV3.h = H; AV3.R.setSize(W, H, false); AV3.cam.aspect = W / H; AV3.cam.updateProjectionMatrix(); }
  host.parentNode?.classList.add('has3d');
  if (!AV3.raf) AV3.raf = requestAnimationFrame(av3loop);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('av3host') && AV3.R && !AV3.raf) AV3.raf = requestAnimationFrame(av3loop); });
window.addEventListener('resize', () => { if (document.getElementById('av3host')) mountYou3D(); });
