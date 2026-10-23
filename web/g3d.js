'use strict';
/* Real 3D garden (three.js, bundled in web/vendor so it works offline).
   The island is a grid of grass tiles floating above a 3D valley with hills,
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
  const R = G3.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
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
  G3.renderer.setSize(w, h, false); G3.camera.aspect = w / h; G3.camera.updateProjectionMatrix();
}
// called after every page render
function mountGarden3D() {
  const host = document.getElementById('g3host');
  if (!host) { g3stop(); return; }
  g3init();
  if (G3.canvas.parentNode !== host) host.prepend(G3.canvas);
  g3resize();
  const sig = g3signature();
  if (sig !== G3.sig) { G3.sig = sig; g3build(); }
  if (!G3.raf) { G3.clock.getDelta(); G3.raf = requestAnimationFrame(g3loop); }
}
function g3stop() { if (G3.raf) cancelAnimationFrame(G3.raf); G3.raf = 0; }
function g3signature() {
  const hr = new Date().getHours(), night = hr >= 20 || hr < 6;
  return JSON.stringify([G3.logs?.map(l => [l.id, l.mins, l.withered, speciesFor(l.subjectId), subj(l.subjectId).color, treeRec(l.id).wilted]), D.game.gridPos, D.game.scene, D.game.fx, night,
    ITEMS.filter(i => owned(i.id) && !D.game.hidden[i.id]).map(i => i.id), Object.keys(D.game.critters || {}), Math.min(6, Math.ceil(pendingLeaves() / Math.max(1, basketCap()) * 6))]);
}

// ---------- building the world ----------
function g3dispose() {
  G3.world.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  G3.world.clear(); m3clear(); G3.objs = []; G3.tickers = []; G3.roam = []; G3.fliers = []; G3.lights = []; G3.weather = null; G3.bubbles = [];
}
function skyTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(.55, bottom); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(c);
}
function glowTex(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, col); g.addColorStop(.3, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function bubbleTex() {
  if (G3.bubTex) return G3.bubTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = '#40c057'; x.lineWidth = 8; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill(); x.stroke();
  x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🍃', 64, 70);
  return (G3.bubTex = new THREE.CanvasTexture(c));
}
const GY = -34; // valley floor, well below the floating island
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
  // sky and fog
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex(sky[0], sky[1]), side: THREE.BackSide, fog: false, depthWrite: false }));
  W.add(skyMesh);
  G3.scene.fog = new THREE.Fog(sky[1], 120 + half * 2, 520 + half * 4);
  // light
  W.add(new THREE.HemisphereLight(night ? '#5a6aa8' : sky[1], night ? '#1b2a20' : '#4a6b3a', night ? .45 : .7));
  W.add(new THREE.AmbientLight('#ffffff', night ? .12 : .18));
  const sun = new THREE.DirectionalLight(night ? '#9fb3ff' : '#fff1d6', night ? .55 : 1.05);
  const sunDir = new THREE.Vector3(night ? -.5 : .6, night ? .75 : .8, night ? -.4 : .35).normalize();
  sun.position.copy(sunDir).multiplyScalar(half + 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sb = half + 8; Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: half * 2 + 120 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; W.add(sun, sun.target);
  // sun or moon in the sky, with a glow
  const orb = new THREE.Mesh(new THREE.SphereGeometry(night ? 9 : 14, 24, 16), new THREE.MeshBasicMaterial({ color: night ? '#fff9db' : '#fff3bf', fog: false }));
  orb.position.copy(sunDir).multiplyScalar(420); W.add(orb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(night ? '#dbe4ff' : '#fff3bf'), fog: false, transparent: true, depthWrite: false, opacity: gfx('rays') ? .9 : .5 }));
  glow.scale.setScalar(night ? 90 : 170); glow.position.copy(orb.position); W.add(glow);
  if (night) {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3; pos.set([Math.cos(th) * Math.sin(ph) * 560, Math.cos(ph) * 560, Math.sin(th) * Math.sin(ph) * 560], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
    W.add(stars); G3.tickers.push(t => { stars.material.opacity = .8 + Math.sin(t * 2) * .2; });
    if (sc.night && !sc.noAurora) { const au = new THREE.Mesh(new THREE.PlaneGeometry(500, 60, 40, 1), new THREE.MeshBasicMaterial({ color: '#63e6be', transparent: true, opacity: .22, side: THREE.DoubleSide, fog: false, depthWrite: false })); au.position.set(0, 160, -380); const p = au.geometry.attributes.position, b = p.array.slice(); W.add(au);
      G3.tickers.push(t => { for (let i = 0; i < p.count; i++) p.setY(i, b[i * 3 + 1] + Math.sin(b[i * 3] * .02 + t * .5) * 18); p.needsUpdate = true; }); }
  }
  // the valley around the island: rolling hills, a lake, far mountains and woods
  const tg = new THREE.PlaneGeometry(900, 900, 90, 90).rotateX(-Math.PI / 2), tp = tg.attributes.position, tcol = [];
  const hc = new THREE.Color(shade(sc.hills, night ? -.5 : -.3)), hc2 = new THREE.Color(shade(sc.g2, night ? -.5 : -.4));
  for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i), d = Math.hypot(x, z); const y = GY + hills(x, z) + Math.max(0, d - 120) * .06; tp.setY(i, y); const c = hc.clone().lerp(hc2, (Math.sin(x * .03) + 1) / 2 * .6); tcol.push(c.r, c.g, c.b); }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); terrain.receiveShadow = true; W.add(terrain);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(38, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: night ? '#1c3a5e' : '#4dabf7', roughness: .1, metalness: .3, transparent: true, opacity: .9 }));
  lake.position.set(-half - 30, GY + .8, half + 20); W.add(lake);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + Math.random() * .2, d = 400 + Math.random() * 120, h = 60 + Math.random() * 80;
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * .8, h, 6), m3mat(night ? '#2b3550' : shade(sc.hills, -.35))); m.position.set(Math.cos(a) * d, GY + h / 2, Math.sin(a) * d); W.add(m);
    if (h > 75) { const cap = new THREE.Mesh(new THREE.ConeGeometry(h * .28, h * .35, 6), m3mat('#f8f9fa')); cap.position.set(m.position.x, GY + h - h * .175, m.position.z); W.add(cap); } }
  const woods = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 4.5, 6).translate(0, 2.2, 0), m3mat(night ? '#1d3a2b' : '#2b8a3e'), 160), mt = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) { let x, z; do { x = (Math.random() - .5) * 420; z = (Math.random() - .5) * 420; } while (Math.hypot(x, z) < half + 25 || Math.hypot(x + half + 30, z - half - 20) < 42); const s = .7 + Math.random() * .8; mt.compose(new THREE.Vector3(x, GY + hills(x, z), z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); woods.setMatrixAt(i, mt); }
  woods.castShadow = true; W.add(woods);
  // clouds
  if (gfx('clouds')) for (let i = 0; i < 14; i++) {
    const c = new THREE.Group(), s = 2 + Math.random() * 3;
    for (let k = 0; k < 5; k++) c.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(s * (.6 + Math.random() * .5), 1), m3mat(night ? '#46507a' : '#ffffff', { rough: 1 })), (k - 2) * s * .7, Math.random() * s * .3, (Math.random() - .5) * s * .6));
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 140; c.position.set(Math.cos(a) * d, 18 + Math.random() * 26, Math.sin(a) * d);
    c.traverse(o => { o.castShadow = false; }); W.add(c);
    const sp = .3 + Math.random() * .5; G3.tickers.push((t, dt) => { c.position.x += sp * dt; if (c.position.x > 200) c.position.x = -200; });
  }
  // the island: tiles, a soil cliff with rocks hanging underneath, grass and flowers
  const top = night && !sc.night ? shade(sc.g1, -.35) : sc.g1, top2 = night && !sc.night ? shade(sc.g2, -.35) : sc.g2;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(T3D * .985, .35, T3D * .985).translate(0, -.175, 0), new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true }), N * N);
  const tc = new THREE.Color(); let ti = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const [x, z] = tileXZ(r, c, N); mt.makeTranslation(x, 0, z); tiles.setMatrixAt(ti, mt); tc.set((r + c) % 2 ? top : top2).offsetHSL(0, 0, (seeded(`t${r},${c}`)() - .5) * .04); tiles.setColorAt(ti++, tc); }
  tiles.receiveShadow = true; tiles.userData.ground = true; W.add(tiles); G3.tiles = tiles;
  const soil = night ? '#3b2a1e' : '#7a5236';
  W.add(at(m3mesh(new THREE.BoxGeometry(N * T3D + .1, 1.6, N * T3D + .1).translate(0, -.8, 0), soil), 0, -.35, 0));
  W.add(at(m3mesh(new THREE.BoxGeometry(N * T3D + .2, .3, N * T3D + .2).translate(0, -.15, 0), shade(top2, -.15)), 0, -.3, 0));
  const rk = seeded('rocks' + N);
  for (let i = 0; i < 9 + N; i++) { const h = 2 + rk() * 5, m = new THREE.Mesh(new THREE.ConeGeometry(1 + rk() * 2, h, 6).rotateX(Math.PI), m3mat(i % 2 ? shade(soil, -.15) : '#6c5a4c')); m.position.set((rk() - .5) * N * T3D * .8, -1.9 - h / 2, (rk() - .5) * N * T3D * .8); m.castShadow = true; W.add(m); }
  const blades = N * N * 14, grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.05, .32, 3).translate(0, .16, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), blades);
  const gr = seeded('grass'), q = new THREE.Quaternion(), e = new THREE.Euler(), vs = new THREE.Vector3();
  for (let i = 0; i < blades; i++) { const r = Math.floor(i / 14 / N), c = Math.floor(i / 14) % N, [x, z] = tileXZ(r, c, N); e.set((gr() - .5) * .4, gr() * 3, (gr() - .5) * .4); q.setFromEuler(e); const s = .7 + gr() * .8; vs.set(s, s, s);
    mt.compose(new THREE.Vector3(x + (gr() - .5) * T3D * .9, 0, z + (gr() - .5) * T3D * .9), q, vs); grass.setMatrixAt(i, mt); tc.set(gr() < .5 ? shade(top, -.18) : shade(top, .14)); grass.setColorAt(i, tc); }
  grass.receiveShadow = true; W.add(grass);
  if (gfx('flowers')) { const fr = seeded('fl'), n = Math.round(N * N * .5), fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ roughness: .6, flatShading: true }), n), cols = ['#ffffff', '#ffd43b', '#f783ac', '#b197fc', '#ff8787'];
    for (let i = 0; i < n; i++) { mt.makeTranslation((fr() - .5) * N * T3D * .97, .22, (fr() - .5) * N * T3D * .97); fl.setMatrixAt(i, mt); tc.set(cols[i % 5]); fl.setColorAt(i, tc); } W.add(fl); }
  // trees and decorations on their tiles
  let bubbles = gfx('bubbles') && pendingLeaves() > 0 ? Math.min(6, 1 + Math.floor(pendingLeaves() / Math.max(1, basketCap()) * 6)) : 0;
  things.forEach((t, i) => {
    const [x, z] = tileXZ(t.r, t.c, N);
    let obj;
    if (t.g) obj = (DECO3[t.g.id] || DECO3.d_rock)();
    else {
      const l = t.l, s = subj(l.subjectId);
      obj = tree3(speciesFor(l.subjectId), s.color, treeStage(l.mins), l.id);
      obj.rotation.y = seeded('rot' + l.id)() * Math.PI * 2;
      if (l.withered || treeRec(l.id).wilted) obj.traverse(o => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.offsetHSL(0, -.5, -.1); } });
      obj.userData.tree = l; obj.userData.h = new THREE.Box3().setFromObject(obj).max.y;
      if (bubbles > 0 && i % 2 === 0) { bubbles--; const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), depthTest: true })); b.scale.setScalar(.75); b.position.set(x, [1, 1.9, 3, 3.5][treeStage(l.mins)] + .3, z); b.userData.bubble = true; W.add(b); G3.bubbles.push(b); const ph = Math.random() * 6; G3.tickers.push(tt => { b.position.y += Math.sin(tt * 2 + ph) * .002; }); }
    }
    obj.position.set(x, 0, z); obj.userData.key = t.key; obj.userData.bend = { x: 0, z: 0, vx: 0, vz: 0 };
    obj.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    W.add(obj); G3.objs.push(obj);
    if (obj.userData.tick) G3.tickers.push(obj.userData.tick);
    if (obj.userData.glow && night) { const pl = new THREE.PointLight(obj.userData.glow, .9, 5); pl.position.set(x, 1.6, z); W.add(pl); }
    const L = obj.userData.light; if (L && (night || L.flicker)) { const pl = new THREE.PointLight(L.color, night ? L.power : L.power * .4, L.dist); pl.position.set(x, L.y, z); W.add(pl); if (L.flicker) G3.tickers.push(tt => { pl.intensity = (night ? L.power : L.power * .4) * (.8 + Math.sin(tt * 17) * .1 + Math.sin(tt * 7.3) * .1); }); }
  });
  // animals and critters roam between tiles
  if (gfx('critters')) {
    const list = [...ITEMS.filter(i => i.type === 'animal' && ANIMAL3[i.id] && owned(i.id) && !D.game.hidden[i.id]).map(i => ANIMAL3[i.id]),
      ...CRITTERS.filter(k => crit(k.id) && CRIT3[k.id]).map(k => CRIT3[k.id])];
    const rr = seeded('roam' + today());
    for (const mk of list) { const a = mk(); const r = Math.floor(rr() * N), c = Math.floor(rr() * N), [x, z] = tileXZ(r, c, N); a.position.set(x + (rr() - .5), 0, z + (rr() - .5)); a.rotation.y = rr() * 6;
      a.scale.multiplyScalar(.8); a.traverse(o => { if (o.isMesh) o.castShadow = true; }); W.add(a); G3.roam.push({ o: a, tx: a.position.x, tz: a.position.z, wait: rr() * 3, hop: rr() * 6 }); }
    for (const k of CRITTERS.filter(k => crit(k.id) && k.fly)) G3.fliers.push(g3flier(k.id === 'bee' ? bird3('#fcc419', '#ffffff', .5) : k.id === 'fireflies' ? bird3('#ffe066', '#fff9db', .35) : bird3('#8a5a3b', '#d9a066', 1)));
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
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: sc.rain ? .08 : .16, transparent: true, opacity: .9 }));
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
  const d = G3.dist, cam = G3.camera;
  cam.position.set(Math.sin(G3.yaw) * Math.cos(G3.pitch) * d, Math.sin(G3.pitch) * d, Math.cos(G3.yaw) * Math.cos(G3.pitch) * d);
  cam.lookAt(0, .6 + d * .14, 0); // aim a little above the island so the sky shows behind it
  for (const f of G3.tickers) f(t, dt);
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
  G3.renderer.render(G3.scene, cam);
}

// ---------- pointer: orbit, zoom, drag things, click, brush ----------
function g3pick(ev, list) {
  const r = G3.canvas.getBoundingClientRect(), v = new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  G3.ray.setFromCamera(v, G3.camera);
  return G3.ray.intersectObjects(list, true)[0];
}
const g3root = o => { while (o && !o.userData.key && !o.userData.bubble) o = o.parent; return o; };
function g3ground(ev) { const h = g3pick(ev, [G3.tiles]); if (h) return h.point; const p = new THREE.Vector3(); return G3.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; }
function g3events() {
  const cv = G3.canvas; let drag = null, last = null;
  cv.addEventListener('pointerdown', ev => {
    if (ev.button > 1) return;
    cv.setPointerCapture(ev.pointerId);
    const hit = g3pick(ev, [...G3.objs, ...G3.bubbles]), root = hit && g3root(hit.object);
    drag = { sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY, obj: root?.userData.key ? root : null, bubble: root?.userData.bubble, moved: false, yaw: G3.yaw, pitch: G3.pitch };
  });
  cv.addEventListener('pointermove', ev => {
    if (drag) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
      if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) drag.moved = true;
      if (!drag.moved) return;
      if (drag.obj) { const p = g3ground(ev); if (p) { drag.obj.position.set(p.x, .5, p.z); const N = G3.N, c = Math.round(p.x / T3D + (N - 1) / 2), r = Math.round(p.z / T3D + (N - 1) / 2); drag.cell = r >= 0 && c >= 0 && r < N && c < N ? [r, c] : null; G3.hl.visible = !!drag.cell; if (drag.cell) { const [x, z] = tileXZ(r, c, N); G3.hl.position.set(x, .02, z); } } }
      else { G3.targetYaw = null; G3.yaw -= dx * .008; G3.pitch = Math.max(.12, Math.min(1.35, G3.pitch + dy * .006)); cv.style.cursor = 'grabbing'; }
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
          bd.vx += Math.max(-2, Math.min(2, mx * cs - mz * sn)); bd.vz += Math.max(-2, Math.min(2, mx * sn + mz * cs)); }
      }
    }
    last = { x: ev.clientX, y: ev.clientY };
    const h = g3pick(ev, [...G3.objs, ...G3.bubbles]); cv.style.cursor = h ? 'pointer' : 'grab';
  });
  const up = ev => {
    if (!drag) return; const d = drag; drag = null; cv.style.cursor = 'grab'; G3.hl.visible = false;
    if (!d.moved) {
      if (d.bubble) { collectLeaves(cv); render(); return; }
      if (d.obj?.userData.tree) { openTreeCard(d.obj.userData.tree.id); return; }
      return;
    }
    if (d.obj) {
      const pos = D.game.gridPos, key = d.obj.userData.key;
      if (d.cell && ev.type !== 'pointercancel') { const to = d.cell.join(','), from = pos[key], other = Object.keys(pos).find(k => pos[k] === to && k !== key); if (other) pos[other] = from; pos[key] = to; save(); }
      G3.sig = ''; render();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { last = null; });
  cv.addEventListener('wheel', ev => { ev.preventDefault(); G3.dist = Math.max(G3.minD, Math.min(G3.maxD, G3.dist * (1 + Math.sign(ev.deltaY) * .1))); }, { passive: false });
}
function g3view(v) {
  if (v === 'left') G3.targetYaw = (G3.targetYaw ?? G3.yaw) + Math.PI / 4;
  if (v === 'right') G3.targetYaw = (G3.targetYaw ?? G3.yaw) - Math.PI / 4;
  if (v === 'in') G3.dist = Math.max(G3.minD, G3.dist * .82);
  if (v === 'out') G3.dist = Math.min(G3.maxD, G3.dist * 1.2);
  if (v === 'reset') { G3.targetYaw = -.75; G3.pitch = .42; G3.dist = Math.max(16, G3.N * T3D * 1.45); }
}
function garden3DHtml(logs) {
  G3.logs = logs;
  return `<div class="g3host" id="g3host"><div class="g3ctl"><button data-act="g3view" data-v="left" title="Turn left">⟲</button><button data-act="g3view" data-v="right" title="Turn right">⟳</button><button data-act="g3view" data-v="in" title="Zoom in">＋</button><button data-act="g3view" data-v="out" title="Zoom out">−</button><button data-act="g3view" data-v="reset" title="Reset view">⌂</button></div></div>`;
}
