'use strict';
/* Real 3D garden (three.js, bundled in web/vendor so it works offline).
   The island is a soft lawn (a grid of tiles underneath) floating high above a sea with hills,
   mountains, clouds and a sky that follows the time of day. Drag empty space
   to spin the camera, scroll to zoom, drag a tree or decoration to move it,
   click a tree for its card. Trees only move when your pointer brushes
   through them. The canvas is kept between renders and re-attached to the
   page, and the world is only rebuilt when the garden actually changes. */

const T3D = 2; // tile size
const G3 = { ok: null, yaw: -.75, pitch: .42, dist: 0, zoom: 1, targetYaw: null, objs: [], tickers: [], roam: [], fliers: [], weather: null, sig: '' };
function webglOK() {
  if (G3.ok != null) return G3.ok;
  try { const c = document.createElement('canvas'); G3.ok = !!(window.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { G3.ok = false; }
  return G3.ok;
}
const tileXZ = (r, c, N) => [(c - (N - 1) / 2) * T3D, (r - (N - 1) / 2) * T3D];

function g3init() {
  if (G3.renderer) return;
  const R = G3.renderer = fxRenderer();
  G3.canvas = R.domElement; G3.canvas.className = 'g3canvas';
  G3.scene = new THREE.Scene();
  G3.camera = new THREE.PerspectiveCamera(42, 1, .1, 1200);
  G3.world = new THREE.Group(); G3.scene.add(G3.world);
  G3.ray = new THREE.Raycaster(); G3.clock = new THREE.Clock();
  g3events();
  new ResizeObserver(() => g3resize()).observe(document.body);
}
function g3resize() {
  const host = G3.canvas?.parentNode; if (!host || !host.clientWidth) return;
  const w = host.clientWidth, h = host.clientHeight;
  // resizing clears the canvas, so only do it when the size really changed
  if (G3.sz === w + 'x' + h + (G3.comp ? 'c' : '')) return;
  G3.sz = w + 'x' + h + (G3.comp ? 'c' : '');
  fxResize(G3.renderer, G3.comp, w, h); G3.camera.aspect = w / h; G3.camera.updateProjectionMatrix();
}
// called after every page render
function mountGarden3D() {
  const host = document.getElementById('g3host');
  if (!host) { g3stop(); return; }
  // what shows behind the canvas before its first frame: the sky colour, not black
  const hr = new Date().getHours(); host.style.background = hr >= 20 || hr < 6 ? '#0b1622' : 'linear-gradient(180deg,#a5d8ff,#d8f0dc)';
  g3init();
  const moved = G3.canvas.parentNode !== host;
  if (moved) host.prepend(G3.canvas);
  const sz = G3.sz; g3resize();
  const sig = g3signature(), rebuilt = sig !== G3.sig;
  if (rebuilt) { G3.sig = sig; g3build(); g3resize(); }
  // draw straight away so the page never shows an empty (black) canvas between frames
  if ((moved || rebuilt || sz !== G3.sz) && G3.camera.aspect) try { G3.comp ? G3.comp.c.render() : G3.renderer.render(G3.scene, G3.camera); } catch (e) { console.error(e); }
  if (!G3.raf) { G3.clock.getDelta(); G3.raf = requestAnimationFrame(g3loop); }
}
// collecting leaves pops the bubbles in place instead of rebuilding the island
function g3popBubbles() {
  sfx('pop');
  for (const b of G3.bubbles.splice(0)) { b.material.transparent = true; const s0 = b.scale.x, t0 = G3.clock.elapsedTime;
    const f = t => { const p = Math.min(1, (t - t0) / .35); b.scale.setScalar(s0 * (1 + p * .8)); b.material.opacity = 1 - p; if (p >= 1) { b.parent?.remove(b); b.material.dispose(); G3.tickers.splice(G3.tickers.indexOf(f), 1); } };
    G3.tickers.push(f); }
}
function g3stop() { if (G3.raf) cancelAnimationFrame(G3.raf); G3.raf = 0; }
function g3signature() {
  const hr = new Date().getHours(), night = hr >= 20 || hr < 6;
  return JSON.stringify([G3.logs?.map(l => [l.id, treeStageOf(l), l.withered, speciesFor(l.subjectId), subj(l.subjectId).color, treeRec(l.id).wilted]), visitorsToday(), D.game.gridPos, D.game.scene, D.game.fx, night,
    ITEMS.filter(i => owned(i.id) && !D.game.hidden[i.id]).map(i => i.id), Object.keys(D.game.critters || {}), Math.min(6, Math.ceil(pendingLeaves() / Math.max(1, basketCap()) * 6))]);
}

// ---------- building the world ----------
function g3dispose() {
  G3.world.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  G3.world.clear(); m3clear(); G3.objs = []; G3.tickers = []; G3.roam = []; G3.fliers = []; G3.lights = []; G3.weather = null; G3.bubbles = [];
}
function skyTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(.42, top); g.addColorStop(.62, bottom); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  return srgb(new THREE.CanvasTexture(c));
}
function glowTex(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, col); g.addColorStop(.3, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return srgb(new THREE.CanvasTexture(c));
}
function bubbleTex() {
  if (G3.bubTex) return G3.bubTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = '#40c057'; x.lineWidth = 8; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill(); x.stroke();
  x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🍃', 64, 70);
  return (G3.bubTex = srgb(new THREE.CanvasTexture(c)));
}
const GY = -60; // valley floor, well below the floating island
const hills = (x, z) => Math.sin(x * .045) * 3.2 + Math.cos(z * .05) * 2.6 + Math.sin((x + z) * .09) * 1.4 + Math.cos(x * .13 - z * .07) * .8;

function g3build() {
  const W = G3.world, logs = G3.logs || [];
  g3dispose();
  const sc = SCENES[D.game.scene] || SCENES.meadow, hr = new Date().getHours(), night = sc.night || hr >= 20 || hr < 6;
  const sky = sc.night ? (sc.sky || ['#0b1a3a', '#24406e']) : night ? ['#0f1838', '#33427a'] : sc.sky || ['#5fb4f5', '#dff2ff'];
  const { N, things } = gardenLayout(logs);
  G3.N = N; const half = N * T3D / 2;
  if (!G3.dist) G3.dist = Math.max(16, N * T3D * 1.45);
  G3.minD = N * T3D * .45; G3.maxD = N * T3D * 2.6 + 20;
  // sky, fog and light. The sky dome is also baked into an environment map, so
  // everything is lit softly from all around and shiny things reflect the sky.
  const sunDir = new THREE.Vector3(night ? -.5 : .55, night ? .55 : .42, night ? -.4 : .45).normalize();
  const skyMid = sc.night || night ? shade(sky[1], .1) : fxMix(sky[1], sky[0], .3), skyBot = night ? '#0b1430' : shade(sky[1], -.08);
  W.add(fxSkyDome(600, sky[0], skyMid, skyBot, sunDir, night ? '#c5d0ff' : '#fff1c9', night ? .5 : 1));
  fxEnv(G3.renderer, G3.scene, sky[0], skyMid, skyBot, sunDir, night ? '#c5d0ff' : '#fff1c9', night ? '#16203a' : shade(sc.hills, -.2));
  G3.scene.fog = new THREE.FogExp2(skyMid, night ? .0022 : .0013);
  G3.renderer.toneMappingExposure = night ? 1.05 : .82;
  W.add(new THREE.HemisphereLight(night ? '#7d8fd0' : shade(sky[0], .3), night ? '#1b2a20' : '#5b7a3a', night ? .2 : .22));
  const sun = new THREE.DirectionalLight(night ? '#aebfff' : '#ffe8c2', night ? 1.1 : 2.1);
  sun.position.copy(sunDir).multiplyScalar(half + 40); sun.castShadow = true;
  const hq = fxHQ();
  sun.shadow.mapSize.set(hq ? 4096 : 2048, hq ? 4096 : 2048); const sb = half + 4; Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: half * 2 + 120 });
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .04; sun.shadow.radius = 5; W.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(night ? '#6c7cff' : '#cfe8ff', night ? .5 : .7); rim.position.set(-sunDir.x * 30, 18, -sunDir.z * 30); W.add(rim); // a cool back light that outlines things
  // sun or moon in the sky, with a glow
  const orb = new THREE.Mesh(new THREE.SphereGeometry(night ? 9 : 14, 32, 16), new THREE.MeshBasicMaterial({ color: night ? '#fff9db' : '#fff3bf', fog: false, toneMapped: false }));
  orb.position.copy(sunDir).multiplyScalar(420); W.add(orb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(night ? '#dbe4ff' : '#fff3bf'), fog: false, transparent: true, depthWrite: false, opacity: gfx('rays') ? .7 : .35, toneMapped: false }));
  glow.scale.setScalar(night ? 90 : 170); glow.position.copy(orb.position); W.add(glow);
  // bloom for glowing things
  if (hq && !G3.comp) G3.sz = null, G3.comp = fxComposer(G3.renderer, G3.scene, G3.camera, { strength: .35, radius: .55, threshold: .9 });
  if (!hq && G3.comp) G3.comp = null;
  if (G3.comp) G3.comp.bloom.strength = night ? .7 : .3;
  g3resize();
  if (night) {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3; pos.set([Math.cos(th) * Math.sin(ph) * 560, Math.cos(ph) * 560, Math.sin(th) * Math.sin(ph) * 560], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.8, sizeAttenuation: false, fog: false, toneMapped: false, transparent: true }));
    W.add(stars); G3.tickers.push(t => { stars.material.opacity = .8 + Math.sin(t * 2) * .2; });
    if (sc.night && !sc.noAurora) { const au = new THREE.Mesh(new THREE.PlaneGeometry(500, 60, 40, 1), new THREE.MeshBasicMaterial({ color: '#63e6be', transparent: true, opacity: .22, side: THREE.DoubleSide, fog: false, depthWrite: false })); au.position.set(0, 160, -380); const p = au.geometry.attributes.position, b = p.array.slice(); W.add(au);
      G3.tickers.push(t => { for (let i = 0; i < p.count; i++) p.setY(i, b[i * 3 + 1] + Math.sin(b[i * 3] * .02 + t * .5) * 18); p.needsUpdate = true; }); }
  }
  // far below: a calm sea, soft rounded hills on the horizon and a few distant islands, all hazy
  const seaCol = night ? '#16284d' : shade(sky[1], -.35);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(700, 64).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: seaCol, roughness: .12, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.3 }));
  sea.position.y = GY; W.add(sea);
  const hillCol = night ? '#1f3350' : shade(sc.hills, -.32), hillCol2 = night ? '#2a3f63' : shade(sc.hills, -.22);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + Math.sin(i * 7.3) * .15, d = 430 + (i % 3) * 50, r = 80 + (i * 37 % 50);
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: i % 2 ? hillCol : hillCol2, roughness: 1 }));
    h.scale.y = .28 + (i * 13 % 7) / 40; h.position.set(Math.cos(a) * d, GY - 2, Math.sin(a) * d); W.add(h); }
  // little floating islands drifting in the distance
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 2.2, d = 90 + i * 25, g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(4 + i, 3.6 + i, 1.2, 32), m3mat(night ? shade(sc.g1, -.4) : sc.g1)); g.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(3.6 + i, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m3mat(night ? '#3b2a1e' : '#8a6248')); bot.scale.y = 1.4; bot.position.y = -.6; g.add(bot);
    for (let k = 0; k < 3; k++) { const tr = tree3('oak', ['#40c057', '#2f9e44', '#69db7c'][k], 3, 'far' + i + k); tr.position.set((k - 1) * 1.8, .6, Math.sin(k * 2 + i) * 1.2); tr.scale.setScalar(1.3); g.add(tr); }
    g.position.set(Math.cos(a) * d, -18 + i * 2, Math.sin(a) * d); W.add(g); const ph = i;
    G3.tickers.push(t => { g.position.y = -18 + ph * 2 + Math.sin(t * .3 + ph) * .6; }); }
  // soft clouds, some above and some drifting below the island
  if (gfx('clouds')) for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), s = 2.4 + Math.random() * 3, col = night ? '#5c6a96' : '#ffffff';
    for (let k = 0; k < 6; k++) c.add(at(new THREE.Mesh(new THREE.SphereGeometry(s * (.55 + Math.random() * .45), 24, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 1, transparent: true, opacity: .96 })), (k - 2.5) * s * .55, Math.sin(k * 2.1) * s * .25, (Math.random() - .5) * s * .5));
    c.scale.y = .7; const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 120, below = i % 3 === 0;
    c.position.set(Math.cos(a) * d, below ? -8 - Math.random() * 10 : 16 + Math.random() * 24, Math.sin(a) * d); W.add(c);
    const sp = .3 + Math.random() * .5; G3.tickers.push((t, dt) => { c.position.x += sp * dt; if (c.position.x > 180) c.position.x = -180; });
  }
  // the island: a soft lawn with rounded edges, a soil layer, and a rocky bottom hanging under it
  const top = shade(sc.g1, night && !sc.night ? -.38 : -.14), top2 = shade(sc.g2, night && !sc.night ? -.38 : -.14);
  const L = N * T3D, rr = Math.min(1.4, L * .08);
  const rounded = (w, r) => { const sh = new THREE.Shape(), h = w / 2; sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h); return sh; };
  const lawnTex = (() => { const px = 64 * N, c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'), rn = seeded('lawn' + N);
    x.fillStyle = top; x.fillRect(0, 0, px, px);
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) { x.fillStyle = (r + q) % 2 ? shade(top, .04) : shade(top2, .02); x.globalAlpha = .35; x.fillRect(q * 64, r * 64, 64, 64); } // mowed stripes in a soft checker
    x.globalAlpha = 1;
    for (let i = 0; i < px * px / 18; i++) { x.fillStyle = rn() < .5 ? shade(top, -.12) : shade(top, .12); x.globalAlpha = .25 + rn() * .3; const X = rn() * px, Y = rn() * px; x.fillRect(X, Y, 1.2, 2.5 + rn() * 3); }
    x.globalAlpha = 1; const t = srgb(new THREE.CanvasTexture(c)); t.anisotropy = 8; return t; })();
  const lawnGeo = new THREE.ExtrudeGeometry(rounded(L, rr), { depth: .3, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 4, curveSegments: 10 }).rotateX(-Math.PI / 2);
  { const uv = lawnGeo.attributes.uv, pos = lawnGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / L + .5, .5 - pos.getZ(i) / L); }
  const lawn = new THREE.Mesh(lawnGeo, [new THREE.MeshStandardMaterial({ map: lawnTex, roughness: .95 }), new THREE.MeshStandardMaterial({ color: shade(top2, -.12), roughness: .95 })]);
  lawn.position.y = -.42; lawn.receiveShadow = true; W.add(lawn); G3.tiles = lawn;
  const soil = night ? '#3b2a1e' : '#8a6248';
  const soilM = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(L - .1, rr), { depth: 1.1, bevelEnabled: true, bevelThickness: .2, bevelSize: .1, bevelSegments: 3, curveSegments: 10 }).rotateX(-Math.PI / 2), m3mat(soil)); soilM.position.y = -1.65; W.add(soilM);
  const under = new THREE.Mesh(new THREE.SphereGeometry(L * .46, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m3mat(night ? '#2e2620' : '#7a6a5c'));
  { const p = under.geometry.attributes.position, rn = seeded('under'); for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * .9) * .05 + Math.cos(p.getZ(i) * 1.1) * .05; p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k); } under.geometry.computeVertexNormals(); }
  under.scale.set(1, .75, 1); under.position.y = -1.6; W.add(under);
  // soft tufts and bushes round the edge of the lawn
  const tuftN = N * 6, tuft = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 16, 10), new THREE.MeshStandardMaterial({ roughness: .9 }), tuftN), q = new THREE.Quaternion(), vs = new THREE.Vector3(), tc = new THREE.Color(), mt = new THREE.Matrix4(), gr = seeded('tuft');
  for (let i = 0; i < tuftN; i++) { const side = i % 4, u = (gr() - .5) * (L - .6), e = L / 2 - .25 - gr() * .5, x = side === 0 ? u : side === 1 ? u : side === 2 ? e : -e, z = side === 0 ? e : side === 1 ? -e : u;
    const s = .6 + gr() * .9; vs.set(s, s * .7, s); mt.compose(new THREE.Vector3(x, .02, z), q, vs); tuft.setMatrixAt(i, mt); tc.set(gr() < .5 ? shade(top, -.15) : shade(top2, -.05)); tuft.setColorAt(i, tc); }
  tuft.castShadow = true; tuft.receiveShadow = true; W.add(tuft);
  if (gfx('flowers')) { const fr = seeded('fl'), n = Math.round(N * N * .35), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshStandardMaterial({ roughness: .6 }), n), cols = ['#ffffff', '#ffd43b', '#f783ac', '#b197fc', '#ff8787'];
    for (let i = 0; i < n; i++) { mt.makeTranslation((fr() - .5) * (L - .8), .06, (fr() - .5) * (L - .8)); fl.setMatrixAt(i, mt); tc.set(cols[i % 5]); fl.setColorAt(i, tc); } W.add(fl); }
  // trees and decorations on their tiles
  let bubbles = gfx('bubbles') && pendingLeaves() > 0 ? Math.min(6, 1 + Math.floor(pendingLeaves() / Math.max(1, basketCap()) * 6)) : 0;
  things.forEach((t, i) => {
    const [x, z] = tileXZ(t.r, t.c, N);
    let obj;
    if (t.g) obj = (DECO3[t.g.id] || DECO3.d_rock)();
    else {
      const l = t.l, s = subj(l.subjectId);
      obj = tree3(speciesFor(l.subjectId), s.color, treeStageOf(l), l.id);
      obj.rotation.y = seeded('rot' + l.id)() * Math.PI * 2;
      if (l.withered || treeRec(l.id).wilted) obj.traverse(o => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.offsetHSL(0, -.5, -.1); } });
      obj.userData.tree = l; obj.userData.h = new THREE.Box3().setFromObject(obj).max.y;
      if (bubbles > 0 && i % 2 === 0) { bubbles--; const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), depthTest: true })); b.scale.setScalar(.75); b.position.set(x, obj.userData.h + .3, z); b.userData.bubble = true; W.add(b); G3.bubbles.push(b); const ph = Math.random() * 6; G3.tickers.push(tt => { b.position.y += Math.sin(tt * 2 + ph) * .002; }); }
    }
    obj.position.set(x, 0, z); obj.userData.key = t.key; obj.userData.bend = { x: 0, z: 0, vx: 0, vz: 0 };
    obj.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    { const bx = new THREE.Box3().setFromObject(obj), r = Math.max(.45, Math.min(1.7, Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) * .55)); const bl = fxBlob(r, night ? .7 : .55); bl.position.set(0, .03, 0); obj.add(bl); } // a soft contact shadow so it sits on the grass
    W.add(obj); G3.objs.push(obj);
    if (obj.userData.tick) G3.tickers.push(obj.userData.tick);
    if (obj.userData.glow && night) { const pl = new THREE.PointLight(obj.userData.glow, .9, 5); pl.position.set(x, 1.6, z); W.add(pl); }
    const L = obj.userData.light; if (L && (night || L.flicker)) { const pl = new THREE.PointLight(L.color, night ? L.power : L.power * .4, L.dist); pl.position.set(x, L.y, z); W.add(pl); if (L.flicker) G3.tickers.push(tt => { pl.intensity = (night ? L.power : L.power * .4) * (.8 + Math.sin(tt * 17) * .1 + Math.sin(tt * 7.3) * .1); }); }
  });
  // animals and critters roam between tiles
  if (gfx('critters')) {
    const list = [...ITEMS.filter(i => i.type === 'animal' && ANIMAL3[i.id] && owned(i.id) && !D.game.hidden[i.id]).map(i => ANIMAL3[i.id]),
      ...CRITTERS.filter(k => crit(k.id) && CRIT3[k.id]).map(k => CRIT3[k.id]), ...visitorsToday().filter(id => VISIT3[id]).map(id => VISIT3[id])];
    const rr = seeded('roam' + today());
    for (const mk of list) { const a = mk(); const r = Math.floor(rr() * N), c = Math.floor(rr() * N), [x, z] = tileXZ(r, c, N); a.position.set(x + (rr() - .5), 0, z + (rr() - .5)); a.rotation.y = rr() * 6;
      a.scale.multiplyScalar(.8); a.traverse(o => { if (o.isMesh) o.castShadow = true; }); a.add(fxBlob(.45, .5)); W.add(a); G3.roam.push({ o: a, tx: a.position.x, tz: a.position.z, wait: rr() * 3, hop: rr() * 6 }); }
    const FLY = { bee: ['#fcc419', '#ffffff', .5], fireflies: ['#ffe066', '#fff9db', .35], parrot: ['#e03131', '#2f9e44', .9], bat: ['#343a40', '#495057', .8] };
    for (const k of CRITTERS.filter(k => crit(k.id) && k.fly)) G3.fliers.push(g3flier(bird3(...(FLY[k.id] || ['#8a5a3b', '#d9a066', 1]))));
    if (visitorsToday().includes('hummingbird')) G3.fliers.push(g3flier(bird3('#20c997', '#e64980', .45), 3, 1.5, 0, true));
  }
  if (owned('a_birds')) for (let i = 0; i < 4; i++) G3.fliers.push(g3flier(bird3('#343a40', '#495057', .9), 14 + i, 8 + i * 1.5, i));
  if (owned('a_butterfly')) for (const col of ['#f783ac', '#ffd43b', '#74c0fc']) G3.fliers.push(g3flier(bird3(col, col, .35), 3 + Math.random() * half, 1.2 + Math.random(), Math.random() * 6, true));
  if (owned('d_balloon') && !D.game.hidden.d_balloon) { const bl = DECO3.d_balloon(); bl.position.set(-half - 6, 14, -half); W.add(bl); G3.tickers.push(t => { bl.position.y = 14 + Math.sin(t * .4) * 1.5; bl.position.x = -half - 6 + Math.sin(t * .1) * 8; }); }
  // falling leaves, petals, snow or rain; fireflies at night
  if (gfx('weather')) {
    const n = sc.rain ? 900 : 160, pos = new Float32Array(n * 3), span = half + 14;
    for (let i = 0; i < n; i++) pos.set([(Math.random() - .5) * span * 2, Math.random() * 20, (Math.random() - .5) * span * 2], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = sc.rain ? '#a5d8ff' : D.game.scene === 'winter' ? '#ffffff' : (sc.fall || ['#8ce99a'])[0];
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: sc.rain ? .08 : .2, transparent: true, opacity: .9, depthWrite: false, map: G3.dotTex = G3.dotTex || (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 14, 8, .6, 0, Math.PI * 2); x.fill(); return new THREE.CanvasTexture(c); })() }));
    W.add(pts); const sp = sc.rain ? 14 : 1.2;
    G3.tickers.push((t, dt) => { for (let i = 0; i < n; i++) { let y = pos[i * 3 + 1] - sp * dt; if (y < -1) y = 20; pos[i * 3 + 1] = y; if (!sc.rain) pos[i * 3] += Math.sin(t + i) * .01; } g.attributes.position.needsUpdate = true; });
  }
  if (night && gfx('fireflies')) for (let i = 0; i < 24; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#ffe066'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.scale.setScalar(.35); const bx = (Math.random() - .5) * N * T3D, bz = (Math.random() - .5) * N * T3D, ph = Math.random() * 9; W.add(f);
    G3.tickers.push(t => { f.position.set(bx + Math.sin(t * .5 + ph) * .8, .6 + Math.sin(t * .9 + ph) * .4 + .4, bz + Math.cos(t * .4 + ph) * .8); f.material.opacity = .4 + Math.sin(t * 3 + ph) * .4; }); }
  // the tile highlight shown while dragging
  G3.hl = at(new THREE.Mesh(new THREE.PlaneGeometry(T3D * .96, T3D * .96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, depthWrite: false })), 0, .02, 0);
  G3.hl.visible = false; W.add(G3.hl);
}
function g3flier(o, rad = 10, h = 7, ph = 0, flutter = false) {
  o.traverse(m => { if (m.isMesh) m.castShadow = true; }); G3.world.add(o);
  return { o, rad, h, ph, flutter, sp: flutter ? .5 : .25 + Math.random() * .2 };
}

// ---------- every frame ----------
function g3loop() {
  G3.raf = 0;
  if (!G3.canvas.isConnected) return;
  G3.raf = requestAnimationFrame(g3loop);
  if (document.hidden) return;
  const dt = Math.min(.05, G3.clock.getDelta()), t = G3.clock.elapsedTime;
  if (G3.targetYaw != null) { G3.yaw += (G3.targetYaw - G3.yaw) * Math.min(1, dt * 6); if (Math.abs(G3.targetYaw - G3.yaw) < .002) G3.targetYaw = null; }
  if (G3.targetPitch != null) { G3.pitch += (G3.targetPitch - G3.pitch) * Math.min(1, dt * 6); if (Math.abs(G3.targetPitch - G3.pitch) < .002) G3.targetPitch = null; }
  // isometric view: a long lens from far away, so it looks flat like a classic iso game
  const k = G3.iso ? 3.2 : 1; G3.lens = (G3.lens ?? k) + (k - (G3.lens ?? k)) * Math.min(1, dt * 5);
  const pan = G3.pan || (G3.pan = { x: 0, z: 0 }), d = G3.dist * G3.lens, cam = G3.camera;
  if (Math.abs(cam.fov - 42 / G3.lens) > .01) { cam.fov = 42 / G3.lens; cam.updateProjectionMatrix(); }
  cam.position.set(pan.x + Math.sin(G3.yaw) * Math.cos(G3.pitch) * d, Math.sin(G3.pitch) * d, pan.z + Math.cos(G3.yaw) * Math.cos(G3.pitch) * d);
  cam.lookAt(pan.x, .6 + G3.dist * .14 / G3.lens, pan.z); // aim a little above the island so the sky shows behind it
  for (const f of [...G3.tickers]) f(t, dt);
  // brushed trees spring back
  for (const o of G3.objs) { const b = o.userData.bend; if (!b || (!b.x && !b.z && !b.vx && !b.vz)) continue;
    b.vx += (-26 * b.x - 4.5 * b.vx) * dt; b.vz += (-26 * b.z - 4.5 * b.vz) * dt; b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.x) + Math.abs(b.z) + Math.abs(b.vx) + Math.abs(b.vz) < .002) { b.x = b.z = b.vx = b.vz = 0; }
    const body = o.children[0]; if (body) { body.rotation.set(b.z, -o.rotation.y * 0, -b.x); body.rotation.order = 'XYZ'; } }
  // roaming animals walk to a nearby spot, pause, then pick another
  const lim = G3.N * T3D / 2 - .4;
  for (const a of G3.roam) {
    const o = a.o, dx = a.tx - o.position.x, dz = a.tz - o.position.z, dist = Math.hypot(dx, dz);
    if (dist < .05) { a.wait -= dt; if (a.wait < 0) { a.tx = Math.max(-lim, Math.min(lim, o.position.x + (Math.random() - .5) * 5)); a.tz = Math.max(-lim, Math.min(lim, o.position.z + (Math.random() - .5) * 5)); a.wait = 1 + Math.random() * 4; } o.position.y = 0; continue; }
    const sp = Math.min(dist, dt * .9); o.position.x += dx / dist * sp; o.position.z += dz / dist * sp;
    const want = Math.atan2(-dz, dx); let dr = want - o.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); o.rotation.y += dr * Math.min(1, dt * 6);
    a.hop += dt * 12; o.position.y = Math.abs(Math.sin(a.hop)) * .06;
    (o.userData.legs || []).forEach((l, i) => { l.rotation.z = Math.sin(a.hop + (i % 2) * Math.PI) * .5; });
  }
  for (const f of G3.fliers) { const ang = t * f.sp + f.ph; f.o.position.set(Math.cos(ang) * f.rad, f.h + Math.sin(t * (f.flutter ? 3 : 1) + f.ph) * (f.flutter ? .4 : 1), Math.sin(ang) * f.rad); f.o.rotation.y = -ang - Math.PI; f.o.userData.flap?.(t); }
  if (G3.comp) G3.comp.c.render(); else G3.renderer.render(G3.scene, cam);
}

// ---------- pointer: orbit, zoom, drag things, click, brush ----------
function g3pick(ev, list) {
  const r = G3.canvas.getBoundingClientRect(), v = new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  G3.ray.setFromCamera(v, G3.camera);
  return G3.ray.intersectObjects(list, true)[0];
}
const g3root = o => { while (o && !o.userData.key && !o.userData.bubble) o = o.parent; return o; };
function g3ground(ev) { const h = g3pick(ev, [G3.tiles]); if (h) return h.point; const p = new THREE.Vector3(); return G3.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; }
// slide the view across the ground (dx, dy in screen pixels)
function g3pan(dx, dy) {
  const right = new THREE.Vector3().setFromMatrixColumn(G3.camera.matrixWorld, 0).setY(0).normalize(), fwd = new THREE.Vector3(right.z, 0, -right.x);
  const s = G3.dist * .0016, lim = G3.N * T3D * .65, p = G3.pan || (G3.pan = { x: 0, z: 0 });
  p.x = Math.max(-lim, Math.min(lim, p.x - right.x * dx * s + fwd.x * dy * s)); p.z = Math.max(-lim, Math.min(lim, p.z - right.z * dx * s + fwd.z * dy * s));
}
const g3zoom = f => { G3.dist = Math.max(G3.minD, Math.min(G3.maxD, G3.dist * f)); };
function g3events() {
  const cv = G3.canvas, touches = new Map(); let drag = null, last = null, pinch = 0;
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('pointerdown', ev => {
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
    cv.setPointerCapture(ev.pointerId);
    if (ev.button === 2 || ev.shiftKey) { drag = { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, rotate: true, moved: false }; return; }
    if (ev.button > 0) return;
    const hit = g3pick(ev, [...G3.objs, ...G3.bubbles]), root = hit && g3root(hit.object);
    drag = { sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY, obj: root?.userData.key ? root : null, home: root?.userData.key ? root.position.clone() : null, bubble: root?.userData.bubble, moved: false, yaw: G3.yaw, pitch: G3.pitch };
  });
  cv.addEventListener('pointermove', ev => {
    if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size === 2 && pinch) { const [a, b] = [...touches.values()], dd = Math.hypot(a.x - b.x, a.y - b.y); g3zoom(pinch / Math.max(1, dd)); pinch = dd; return; }
    if (drag) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
      if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) { drag.moved = true; if (drag.obj) sfx('pickup'); }
      if (!drag.moved) return;
      if (drag.obj) { const p = g3ground(ev); if (p) { drag.obj.position.set(p.x, .5, p.z); const N = G3.N, c = Math.round(p.x / T3D + (N - 1) / 2), r = Math.round(p.z / T3D + (N - 1) / 2); drag.cell = r >= 0 && c >= 0 && r < N && c < N ? [r, c] : null; G3.hl.visible = !!drag.cell; if (drag.cell) { const [x, z] = tileXZ(r, c, N); G3.hl.position.set(x, .02, z); } } }
      else if (drag.rotate) { G3.targetYaw = null; G3.targetPitch = null; G3.yaw -= dx * .008; G3.pitch = Math.max(.12, Math.min(1.35, G3.pitch + dy * .006)); cv.style.cursor = 'grabbing'; }
      else { g3pan(dx, dy); cv.style.cursor = 'grabbing'; }
      return;
    }
    // brushing: the pointer pushes trees it passes through (anywhere along the
    // trunk or crown, not just at the ground), in the direction it's moving
    if (last) {
      const dx = ev.clientX - last.x, dy = ev.clientY - last.y;
      if (Math.hypot(dx, dy) > 1) {
        g3pick(ev, []); const ray = G3.ray.ray, right = new THREE.Vector3().setFromMatrixColumn(G3.camera.matrixWorld, 0), fwd = new THREE.Vector3(-right.z, 0, right.x);
        const a = new THREE.Vector3(), b2 = new THREE.Vector3();
        for (const o of G3.objs) { if (!o.userData.tree) continue;
          a.set(o.position.x, .2, o.position.z); b2.set(o.position.x, o.userData.h || 2.6, o.position.z);
          const d = Math.sqrt(ray.distanceSqToSegment(a, b2)); if (d > .9) continue;
          const k = (1 - d / .9) * .05, mx = (right.x * dx - fwd.x * dy) * k, mz = (right.z * dx - fwd.z * dy) * k;
          const bd = o.userData.bend, cs = Math.cos(-o.rotation.y), sn = Math.sin(-o.rotation.y);
          bd.vx += Math.max(-2, Math.min(2, mx * cs - mz * sn)); bd.vz += Math.max(-2, Math.min(2, mx * sn + mz * cs)); if (Math.abs(mx) + Math.abs(mz) > .02) sfx('rustle', { gap: 160 }); }
      }
    }
    last = { x: ev.clientX, y: ev.clientY };
    const h = g3pick(ev, [...G3.objs, ...G3.bubbles]); cv.style.cursor = h ? 'pointer' : 'grab';
  });
  const up = ev => {
    touches.delete(ev.pointerId); if (touches.size < 2) pinch = 0;
    if (!drag) return; const d = drag; drag = null; cv.style.cursor = 'grab'; G3.hl.visible = false;
    if (!d.moved && !d.rotate) {
      if (d.bubble) { collectLeaves(cv); g3popBubbles(); G3.sig = g3signature(); render(); return; }
      if (d.obj?.userData.tree) { if (!(typeof g3water === 'function' && g3water(d.obj, ev))) openTreeCard(d.obj.userData.tree.id); return; }
      return;
    }
    if (d.obj) {
      // slide things into place instead of rebuilding the whole island (which flashed)
      const pos = D.game.gridPos, key = d.obj.userData.key, home = d.home;
      const glide = (o, x, z) => { const fx = o.position.x, fz = o.position.z, fy = o.position.y; let t = 0; const f = (tt, dt) => { t = Math.min(1, t + (dt || .016) * 5); const e = 1 - Math.pow(1 - t, 3); o.position.set(fx + (x - fx) * e, fy * (1 - e) + Math.sin(e * Math.PI) * .25, fz + (z - fz) * e); if (t >= 1) G3.tickers.splice(G3.tickers.indexOf(f), 1); }; G3.tickers.push(f); };
      if (d.cell && ev.type !== 'pointercancel') {
        const to = d.cell.join(','), from = pos[key], other = Object.keys(pos).find(k => pos[k] === to && k !== key);
        if (other) { pos[other] = from; const o2 = G3.objs.find(o => o.userData.key === other); if (o2 && home) glide(o2, home.x, home.z); }
        pos[key] = to; save(); setTimeout(() => sfx('plant'), 160);
        const [x, z] = tileXZ(d.cell[0], d.cell[1], G3.N); glide(d.obj, x, z);
      } else if (home) glide(d.obj, home.x, home.z);
      G3.sig = g3signature(); render();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { last = null; });
  // a trackpad pinch (or ctrl + wheel) zooms; a two-finger swipe slides the view around
  cv.addEventListener('wheel', ev => {
    ev.preventDefault();
    if (ev.ctrlKey) g3zoom(Math.exp(Math.max(-.3, Math.min(.3, ev.deltaY * .01))));
    else g3pan(-ev.deltaX * .8, -ev.deltaY * .8);
  }, { passive: false });
}
function g3view(v) {
  if (v === 'left') G3.targetYaw = (G3.targetYaw ?? G3.yaw) + Math.PI / 4;
  if (v === 'right') G3.targetYaw = (G3.targetYaw ?? G3.yaw) - Math.PI / 4;
  if (v === 'in') G3.dist = Math.max(G3.minD, G3.dist * .82);
  if (v === 'out') G3.dist = Math.min(G3.maxD, G3.dist * 1.2);
  if (v === 'reset') { G3.iso = false; G3.targetYaw = -.75; G3.targetPitch = .42; G3.pan = { x: 0, z: 0 }; G3.dist = Math.max(16, G3.N * T3D * 1.45); }
  if (v === 'iso') { G3.iso = !G3.iso; if (G3.iso) { G3.targetYaw = Math.round((G3.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; G3.targetPitch = Math.atan(1 / Math.SQRT2); G3.pan = { x: 0, z: 0 }; G3.dist = Math.max(16, G3.N * T3D * 1.45); } else G3.targetPitch = .42; }
  document.querySelector('.g3ctl [data-v="iso"]')?.classList.toggle('on', !!G3.iso);
}
function garden3DHtml(logs) {
  G3.logs = logs;
  return `<div class="g3host" id="g3host"><div class="g3ctl"><button data-act="g3view" data-v="left" title="Turn left (or right-drag to spin)">⟲</button><button data-act="g3view" data-v="right" title="Turn right">⟳</button><button data-act="g3view" data-v="in" title="Zoom in">＋</button><button data-act="g3view" data-v="out" title="Zoom out">−</button><button data-act="g3view" data-v="iso" title="Isometric view" class="${G3.iso ? 'on' : ''}">◇</button><button data-act="g3view" data-v="reset" title="Reset view">⌂</button><button data-snd-toggle="1" title="Sound on or off (more in Settings → Sound)">${typeof sndCfg === 'function' && !sndCfg().on ? '🔇' : '🔊'}</button></div></div>`;
}
