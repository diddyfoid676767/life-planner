'use strict';
/* Morrow, the Ever-Waiting (2.97: the second Souls boss, was the Procrastinator).
   A towering hooded figure in a long grey robe with an hourglass where its face should be, a great
   clock-hand blade in its right hand and clock-hand claws on its left. It moves slowly, then very fast.
   The fight runs on the same engine as Somnus (souls.js); this file is its definition: the body (built
   on the hero's animation rig like Somnus, sgolem.js), its arena (the Hall of Hours: a dusty cathedral
   of stopped clocks, a frozen sunset burning in its stained glass), its brain, its intro, and its place
   on the boss island.
   2.102: a time mage, not a second brawler. Somnus fights up close with fists and stone; Morrow keeps
   its distance and fights with time. It has one melee swing (the Hour Hand, when you crowd it); the rest
   is ranged and magic:
   - Clock Hands (it throws a fan of spinning bronze clock hands down marked lanes: step out or roll),
     Stillness (a cone that freezes you in time), Empty Promises (it plants hourglasses round you that
     burst when their sand runs out, each on its own timer), Rewind (it goes back to where it stood
     3 seconds ago and strikes from there), Not Now (crowd it and it vanishes and reappears far away,
     throwing). Flipped from Somnus: it's exposed while it casts (it's busy putting things off: hit it
     now), and guarded while it swings.
   - Phases at 70/40/15% change what it does. Toll of the Bells: giant pendulums swing through the hall
     down marked lanes (get out of the lane), and Echoes, sand ghosts of itself, throw clock hands from
     where it used to be. No Time to Rest: it stops walking and steps through the sand instead, throws
     two waves that aim where you're going, two Echoes at once, Midnight (the floor clock's hands sweep
     the hall: jump them), and every Rewind leaves an Echo behind. The Last Hour: Deadline (the hall
     fills with sand and only three circles of light are safe; it stands exposed in the middle while
     it counts down), its big hits slow you in time, and it chains longer.
   - Act now: everything you land in the first 20 seconds does double damage. Waiting makes it stronger:
     every 10 seconds without a hit in an opening it gets 6% faster (up to +30%).
   - Hits only really count when it's exposed; the clock in its back (from behind) and its hourglass
     face (a spell to the head) are weak points. */

const MR_KEY = 'The Procrastinator', MR_SCALE = 3.5;
// moves: wind-up (s), damage (share of your health), reach, arc, low (jump it), open (s), ph (first phase)
const MR_MV = {
  hand: { n: 'Hour Hand', w: .5, d: .4, r: 6.6, arc: 1.65, open: .85 },
  hands: { n: 'Clock Hands', w: .55, d: .24, open: .9 },
  still: { n: 'Stillness', w: .55, d: .1, r: 10, arc: .5, open: .3 },
  promise: { n: 'Empty Promises', w: .4, d: .32, r: 2.2, open: .5 },
  rewind: { n: 'Rewind', w: .62, d: 0, open: 0 },
  away: { n: 'Not Now', w: .2, d: 0, open: 0 },
  echo: { n: 'Echoes', w: .5, d: .22, open: .5, ph: 1 },
  pendulum: { n: 'Pendulums', w: .6, d: .42, wid: 1.3, open: .45, ph: 1 },
  midnight: { n: 'Midnight', w: .7, d: .45, low: 1, open: 1.7, ph: 2 },
  deadline: { n: 'Deadline', w: .5, d: .55, r: 2.4, open: 1.2, ph: 3 },
  roar: { n: 'Toll', d: .12, r: 5 },
};
const MR_PH = [{ at: 1, n: 'The Waiting Hour', sp: 1.05 }, { at: .7, n: 'Toll of the Bells', sp: 1.15 }, { at: .4, n: 'No Time to Rest', sp: 1.28 }, { at: .15, n: 'The Last Hour', sp: 1.4 }];
// what each move can lead into when it chains
const MR_FOL = { hand: ['away', 'still', 'hands', 'promise'], hands: ['hands', 'promise', 'still'], still: ['hand', 'hands', 'promise'], promise: ['hands', 'still', 'hands'] };
// the clip each move plays on the rig, where in it the blow lands, and how fast the follow-through goes
const MR_ANIM = {
  hand: { c: 'Sword_Regular_B', hit: .42, after: 1.3 }, hands: { c: 'OverhandThrow', hit: .5, after: 1.1 }, still: { c: 'Spell_Simple_Shoot', hit: .42, after: 1 },
  promise: { c: 'Spell_Simple_Enter', hit: .5, after: .8 }, rewind: { c: 'Spell_Simple_Enter', hit: .5, after: 1 }, away: { c: 'Spell_Simple_Shoot', hit: .42, after: 1 },
  echo: { c: 'Spell_Simple_Shoot', hit: .42, after: 1 }, pendulum: { c: 'Spell_Simple_Enter', hit: .5, after: .8 }, midnight: { c: 'Spell_Simple_Enter', hit: .5, after: .6 },
  deadline: { c: 'Spell_Simple_Enter', hit: .5, after: .6 },
};
// the body as spheres round its bones (for aimed spells): the robe is wide, so the legs are too
const MR_HITB = [['pelvis', 1.45], ['spine_01', 1.1], ['spine_02', 1.15], ['spine_03', 1.25], ['Head', .9], ['upperarm_l', .6], ['upperarm_r', .6], ['lowerarm_l', .55], ['lowerarm_r', .55], ['hand_l', .55], ['hand_r', .65], ['thigh_l', 1.05], ['thigh_r', 1.05], ['calf_l', 1.15], ['calf_r', 1.15]];
const MR_SAND = ['#ffcf7a', '#ffb347', '#ff8a3d', '#ff4d4d'];

// ---------- the body ----------
function mrMake() {
  const G = HERO.gltf; if (!G) return null;
  const root = new THREE.Group(), rig = THREE.SkeletonUtils.clone(G.scene), drop = [];
  rig.traverse(m => { if (m.isMesh || m.name.startsWith('W_')) drop.push(m); });
  drop.forEach(m => m.parent?.remove(m));
  root.add(rig); root.scale.setScalar(MR_SCALE); root.updateMatrixWorld(true);
  const bone = n => rig.getObjectByName(n), rnd = seeded('morrow'), mats = [], K = MR_SCALE;
  const mat = (col, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: col, roughness: .92, metalness: 0, ...o }); mats.push(m); return m; };
  const robe = mat('#4d4954', { side: THREE.DoubleSide }), robe2 = mat('#36323d', { side: THREE.DoubleSide }), voidM = mat('#07060a', { roughness: 1 });
  const bronze = mat('#b08a4e', { metalness: .6, roughness: .38 }), boneM = mat('#d6cbb4', { roughness: .7 });
  const sandM = mat(MR_SAND[0], { emissive: MR_SAND[0], emissiveIntensity: 1.8, roughness: .5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0ff', transparent: true, opacity: .26, roughness: .05, depthWrite: false }); mats.push(glass);
  const wpos = n => new THREE.Vector3().setFromMatrixPosition(bone(n).matrixWorld);
  const up = new THREE.Vector3(0, 1, 0), off = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(K);
  const fix = (bn, mesh) => { mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); bone(bn).attach(mesh); return mesh; };
  // a cloth tube between two points: radius r0 at a, r1 at b
  const seg = (bn, a, b, r0, r1, m, o = {}) => {
    const g = new THREE.CylinderGeometry(r1 * K, r0 * K, a.distanceTo(b), o.sides || 12, o.hs || 1, !!o.open, o.ts || 0, o.tl || Math.PI * 2);
    const mesh = new THREE.Mesh(g, m); mesh.position.copy(a).lerp(b, .5); mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); return fix(bn, mesh);
  };
  const pel = wpos('pelvis'), s1 = wpos('spine_01'), s3 = wpos('spine_03'), nk = wpos('neck_01'), hd = wpos('Head');
  // the robe: a long skirt from the hips to the floor with a ragged hem, legs wrapped in cloth inside it
  const floor = new THREE.Vector3(pel.x, .02 * K, pel.z);
  const sk = seg('pelvis', floor, pel.clone().add(off(0, .1, 0)), .64, .2, robe, { sides: 20, hs: 4, open: true });
  { const p = sk.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); if (y < -sk.geometry.parameters.height * .3) { const w = 1 + Math.sin(Math.atan2(x, z) * 5 + rnd()) * .05; p.setXYZ(i, x * w, y, z * w); } } sk.geometry.computeVertexNormals(); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + rnd() * .2, r = .6 * K, c = new THREE.Mesh(new THREE.ConeGeometry(.07 * K, (.12 + rnd() * .1) * K, 4), i % 2 ? robe : robe2); c.position.set(pel.x + Math.sin(a) * r, .02 * K, pel.z + Math.cos(a) * r); c.rotation.set(Math.PI, a, 0); fix('pelvis', c); }
  for (const s of ['l', 'r']) { seg('thigh_' + s, wpos('thigh_' + s), wpos('calf_' + s), .15, .14, robe2); seg('calf_' + s, wpos('calf_' + s), wpos('foot_' + s), .14, .17, robe2, { open: true }); }
  // the body: a tall robed chest, a heavy mantle over the shoulders (it makes it broad), a cloak down its back
  seg('spine_01', s1.clone().add(off(0, -.12, 0)), s3, .2, .25, robe);
  seg('spine_03', s3, nk.clone().add(off(0, .02, 0)), .25, .14, robe);
  const man = new THREE.Mesh(new THREE.ConeGeometry(.46 * K, .34 * K, 16, 2, true), robe2); man.position.copy(nk).add(off(0, -.11, -.02)); fix('spine_03', man);
  const man2 = new THREE.Mesh(new THREE.ConeGeometry(.36 * K, .26 * K, 16, 1, true), robe); man2.position.copy(nk).add(off(0, -.02, -.02)); fix('spine_03', man2);
  const cl = seg('spine_03', new THREE.Vector3(nk.x, .08 * K, nk.z - .14 * K), nk.clone().add(off(0, -.06, -.1)), .5, .22, robe2, { open: true, ts: Math.PI / 2, tl: Math.PI, sides: 14, hs: 3 }); void cl;
  // a bronze belt with two small hourglasses hanging from it
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.215 * K, .022 * K, 6, 24), bronze); belt.position.copy(s1).add(off(0, -.06, 0)); belt.rotation.x = Math.PI / 2; fix('spine_01', belt);
  for (const sx of [-1, 1]) { const g = mrHourglass(K * .32, bronze, glass, sandM); g.position.copy(s1).add(off(sx * .16, -.24, .12)); fix('spine_01', g); }
  // sleeves that flare at the wrist, bony hands
  for (const s of ['l', 'r']) {
    seg('upperarm_' + s, wpos('upperarm_' + s), wpos('lowerarm_' + s), .085, .09, robe);
    seg('lowerarm_' + s, wpos('lowerarm_' + s), wpos('hand_' + s).add(off(s === 'l' ? -.03 : .03, 0, 0)), .09, .19, robe2, { open: true, hs: 2 });
    seg('hand_' + s, wpos('hand_' + s), wpos('middle_02_' + s), .035, .03, boneM, { sides: 6 });
  }
  // its left hand ends in four long clock-hand claws
  { const h = wpos('hand_l'), tip = wpos('middle_02_l');
    for (let i = 0; i < 4; i++) { const z = (i - 1.5) * .03, a = tip.clone().add(off(0, -.01, z)), b = tip.clone().add(off(.34 - Math.abs(i - 1.5) * .04, -.04, z * 2.2)); const c = mrHandShape(.34 - Math.abs(i - 1.5) * .04, .016, bronze); c.position.copy(a); c.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); fix('hand_l', c); }
    void h; }
  // the Hour Hand: a great bronze blade in its right fist, pointing forward like a sword
  const grip = wpos('hand_r').lerp(wpos('middle_02_r'), .55), blade = mrHandShape(1.42, .075, bronze, true);
  // (along the hand bone's +Y, like the hero's own sword: that's the way the sword clips swing it)
  const hq = new THREE.Quaternion(); bone('hand_r').getWorldQuaternion(hq);
  blade.position.copy(grip); blade.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 1, 0).applyQuaternion(hq)); fix('hand_r', blade);
  // the hood, open at the front onto darkness, and the hourglass where its face should be
  const gap = 1.5, hood = new THREE.Mesh(new THREE.SphereGeometry(.2 * K, 18, 12, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI * .7), robe2);
  hood.scale.set(1.05, 1.25, 1.15); hood.position.copy(hd).add(off(0, .08, -.02)); fix('Head', hood);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(.1 * K, .22 * K, 8), robe2); peak.position.copy(hd).add(off(0, .3, -.1)); peak.rotation.x = -.6; fix('Head', peak);
  const voidS = new THREE.Mesh(new THREE.SphereGeometry(.17 * K, 14, 10), voidM); voidS.position.copy(hd).add(off(0, .07, -.05)); fix('Head', voidS);
  const hg = new THREE.Group(); hg.position.copy(hd).add(off(0, .1, .1)); const hgIn = mrHourglass(K, bronze, glass, sandM); hg.add(hgIn); fix('Head', hg);
  const face = new THREE.PointLight(MR_SAND[0], 1.4, 3.2 * K * .5, 2); face.position.copy(hd).add(off(0, .1, .3)); bone('Head').attach(face);
  // the clock in its back (the weak point): a cracked bronze clock face that burns when it's exposed
  const cm = mat('#efe2c0', { emissive: '#ffcf7a', emissiveIntensity: .35, roughness: .6 }), crystal = new THREE.Group();
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(.17 * K, .17 * K, .03 * K, 28), cm); dial.rotation.x = Math.PI / 2; crystal.add(dial);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.17 * K, .018 * K, 6, 28), bronze); crystal.add(rim);
  const ink = mat('#2b2016');
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(.012 * K, (i % 3 ? .03 : .05) * K, .01 * K), ink); t.position.set(Math.sin(a) * .135 * K, Math.cos(a) * .135 * K, -.018 * K); t.rotation.z = -a; crystal.add(t); }
  const ch1 = new THREE.Mesh(new THREE.BoxGeometry(.014 * K, .1 * K, .01 * K), ink); ch1.geometry.translate(0, .05 * K, 0); ch1.position.z = -.022 * K; ch1.rotation.z = 2.6; crystal.add(ch1);
  const ch2 = new THREE.Mesh(new THREE.BoxGeometry(.01 * K, .14 * K, .01 * K), ink); ch2.geometry.translate(0, .07 * K, 0); ch2.position.z = -.024 * K; ch2.rotation.z = -.2; crystal.add(ch2);
  crystal.position.copy(s3).add(off(0, .02, -.25)); crystal.updateMatrix(); crystal.matrixWorld.copy(crystal.matrix);
  const glow = new THREE.PointLight('#ffcf7a', .8, 2.4 * K, 2); glow.position.z = -.25 * K; crystal.add(glow); bone('spine_03').attach(crystal);
  // two bronze rings turning round its waist, like the bands of an astrolabe
  // (each carries a few bronze weights, so you can see it turn)
  const rings = [.5, .58].map((r, i) => { const g = new THREE.Group(); g.position.copy(s1).add(off(0, .05 + i * .1, 0)); const t = new THREE.Mesh(new THREE.TorusGeometry(r * K, .01 * K, 5, 48), bronze); t.rotation.x = Math.PI / 2 + (i ? -.35 : .3); t.rotation.y = i ? .2 : -.15; g.add(t);
    for (let j = 0; j < 4; j++) { const a = j / 4 * Math.PI * 2 + i, b = new THREE.Mesh(new THREE.OctahedronGeometry(.028 * K, 0), bronze); b.position.set(Math.cos(a) * r * K, Math.sin(a) * r * K, 0); t.add(b); }
    fix('pelvis', g); return t; });
  root.updateMatrixWorld(true);

  const mixer = new THREE.AnimationMixer(rig), acts = {}, clip = n => G.animations.find(a => a.name === n);
  const S = {
    root, rig, bone, mixer, eyes: [], crystal, cm, glow, hg, sandM, face, rings, ch1, ch2, cur: '', act: null, flash: 0, flinch: 0, flip: 0, hgA: 0,
    play(name, { fade = .25, loop = true, speed = 1, restart = false, from = 0, held = false } = {}) {
      const c = clip(name); if (!c) return null;
      let a = acts[name]; if (!a) a = acts[name] = mixer.clipAction(c);
      if (name === S.cur && !restart) { if (!held) a.timeScale = speed; return a; }
      a.reset(); a.setLoop(loop && !held ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop || held; a.enabled = true; a.setEffectiveWeight(1);
      a.timeScale = held ? 0 : speed; a.time = from * c.duration;
      if (S.act && S.act !== a) a.crossFadeFrom(S.act, fade, false); a.play();
      S.cur = name; S.act = a; return a;
    },
    pose(k) { const a = S.act; if (!a) return; a.paused = false; a.timeScale = 0; a.time = Math.max(0, Math.min(.999, k)) * a.getClip().duration; },
    done() { const a = S.act; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - .03); },
    update(dt) { mixer.update(dt); },
    // the boss island: rings turning, the hourglass glowing
    idle(t, dt) { rings.forEach((r, i) => { r.rotation.z += dt * (i ? -.3 : .22); }); },
    dispose() { root.parent?.remove(root); mixer.stopAllAction(); mats.forEach(m => m.dispose()); root.traverse(o => o.geometry?.dispose()); },
  };
  S.play('Idle_FoldArms_Loop', { speed: .3 });
  return S;
}
// an hourglass, k = its scale (1 = the face, about 0.25 m tall on the rig): a bronze frame, glass, glowing sand
function mrHourglass(k, bronze, glass, sandM) {
  const g = new THREE.Group(), u = v => v * k, add = (geo, m, y = 0, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = u(y); o.rotation.x = rx; g.add(o); return o; };
  add(new THREE.CylinderGeometry(u(.075), u(.075), u(.014), 16), bronze, .108); add(new THREE.CylinderGeometry(u(.075), u(.075), u(.014), 16), bronze, -.108);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, r = new THREE.Mesh(new THREE.CylinderGeometry(u(.006), u(.006), u(.21), 5), bronze); r.position.set(Math.sin(a) * u(.064), 0, Math.cos(a) * u(.064)); g.add(r); }
  add(new THREE.ConeGeometry(u(.06), u(.1), 16, 1, true), glass, .05, Math.PI); add(new THREE.ConeGeometry(u(.06), u(.1), 16, 1, true), glass, -.05);
  add(new THREE.ConeGeometry(u(.045), u(.05), 12), sandM, .035, Math.PI);   // the sand still to fall
  add(new THREE.ConeGeometry(u(.052), u(.04), 12), sandM, -.08);            // the pile below
  add(new THREE.CylinderGeometry(u(.004), u(.004), u(.1), 4), sandM, -.02); // the stream
  return g;
}
// a clock hand as a blade: a long tapering point with a leaf near the tip, a pierced ring, a short tail.
// len and w in rig metres; big = the Hour Hand
function mrHandShape(len, w, m, big) {
  const K = MR_SCALE, s = new THREE.Shape(), L = len * K, W = w * K;
  s.moveTo(-W * .35, -L * .12); s.lineTo(-W * .7, -L * .06); s.lineTo(-W * .4, 0); s.lineTo(-W * .55, L * .2); s.lineTo(-W, L * .6); s.lineTo(-W * 1.9, L * .69);
  s.lineTo(-W * .45, L * .78); s.lineTo(0, L); s.lineTo(W * .45, L * .78); s.lineTo(W * 1.9, L * .69); s.lineTo(W, L * .6); s.lineTo(W * .55, L * .2); s.lineTo(W * .4, 0); s.lineTo(W * .7, -L * .06); s.lineTo(W * .35, -L * .12);
  if (big) { const h = new THREE.Path(); h.absarc(0, L * .42, W * .5, 0, Math.PI * 2, true); s.holes.push(h); }
  const d = (big ? .028 : .012) * K, geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 }); geo.translate(0, 0, -d / 2);
  const mesh = new THREE.Mesh(geo, m); return mesh;
}

// ---------- the arena: the Hall of Hours ----------
// a stained-glass window: a frozen sunset in a pointed arch, with lead lines (rose: the great clock window)
function mrGlassTex(seed, rose) {
  const c = document.createElement('canvas'), W = c.width = rose ? 256 : 128, H = c.height = rose ? 256 : 256, x = c.getContext('2d'), rnd = seeded(seed);
  if (rose) {
    const g = x.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, W / 2); g.addColorStop(0, '#ffe4a0'); g.addColorStop(.35, '#ff9a3c'); g.addColorStop(.7, '#b8304a'); g.addColorStop(1, '#3a1d5a');
    x.fillStyle = g; x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 70; i++) { x.fillStyle = `hsla(${rnd() * 60 - 10},80%,${40 + rnd() * 30}%,.25)`; const a = rnd() * 6.28, r = rnd() * W * .45; x.beginPath(); x.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 6 + rnd() * 14, 0, 6.28); x.fill(); }
    x.strokeStyle = '#140a0a'; x.lineWidth = 4;
    for (const r of [.2, .34, .48]) { x.beginPath(); x.arc(W / 2, H / 2, W * r, 0, 6.28); x.stroke(); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * W * .2, H / 2 + Math.sin(a) * W * .2); x.lineTo(W / 2 + Math.cos(a) * W * .48, H / 2 + Math.sin(a) * W * .48); x.stroke(); }
    // its hands stopped a minute before midnight
    x.lineCap = 'round'; x.strokeStyle = '#1a0f0a'; x.lineWidth = 9; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 - 4, H * .2); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W / 2 - 14, H * .1); x.stroke();
  } else {
    x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * .28); x.quadraticCurveTo(0, H * .02, W / 2, 0); x.quadraticCurveTo(W, H * .02, W, H * .28); x.lineTo(W, H); x.closePath(); x.clip();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1b52'); g.addColorStop(.3, '#7a2a52'); g.addColorStop(.55, '#d8573a'); g.addColorStop(.74, '#ffb44e'); g.addColorStop(.8, '#ffd27a'); g.addColorStop(1, '#4a2216');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff0c0'; x.beginPath(); x.arc(W / 2, H * .79, W * .2, Math.PI, 0); x.fill(); // the sun, stopped on the horizon
    for (let i = 0; i < 46; i++) { x.fillStyle = `hsla(${rnd() * 70 - 20},85%,${35 + rnd() * 35}%,.22)`; x.fillRect(Math.floor(rnd() * 3) * W / 3, Math.floor(rnd() * 9) * H / 9, W / 3, H / 9); }
    x.strokeStyle = '#140a0a'; x.lineWidth = 3;
    for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * W / 3, H * .12); x.lineTo(i * W / 3, H); x.stroke(); }
    for (let i = 2; i < 9; i++) { x.beginPath(); x.moveTo(0, i * H / 9); x.lineTo(W, i * H / 9); x.stroke(); }
    x.beginPath(); x.arc(W / 2, H * .17, W * .17, 0, 6.28); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * .28); x.quadraticCurveTo(0, H * .02, W / 2, 0); x.quadraticCurveTo(W, H * .02, W, H * .28); x.lineTo(W, H); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
// a stopped clock face texture (for wall clocks and the grandfather clocks)
function mrDialTex(seed) {
  const c = document.createElement('canvas'), W = c.width = c.height = 128, x = c.getContext('2d'), rnd = seeded(seed);
  x.fillStyle = '#e9dcbc'; x.beginPath(); x.arc(64, 64, 62, 0, 6.28); x.fill();
  x.strokeStyle = '#3b2a18'; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 58, 0, 6.28); x.stroke();
  const N = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  x.fillStyle = '#2b1d10'; x.font = 'bold 13px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  N.forEach((n, i) => { const a = i / 12 * 6.28 - Math.PI / 2; x.fillText(n, 64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); });
  x.lineCap = 'round'; const h = rnd() * 6.28, m = rnd() * 6.28;
  x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.sin(h) * 26, 64 - Math.cos(h) * 26); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.sin(m) * 40, 64 - Math.cos(m) * 40); x.stroke();
  // a crack across the glass
  x.strokeStyle = 'rgba(40,30,20,.55)'; x.lineWidth = 1.2; x.beginPath(); let px = 20 + rnd() * 30, py = 10 + rnd() * 20; x.moveTo(px, py); for (let i = 0; i < 6; i++) { px += 8 + rnd() * 12; py += 6 + rnd() * 14; x.lineTo(px, py); } x.stroke();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function mrGear(r, col, p) {
  const g = new THREE.Group(); is3mesh(new THREE.CylinderGeometry(r, r, .16, 20), col, 0, 0, 0, g); is3mesh(new THREE.CylinderGeometry(r * .32, r * .32, .2, 12), '#2d241a', 0, 0, 0, g);
  const n = Math.max(8, Math.round(r * 10)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, t = is3mesh(new THREE.BoxGeometry(.18, .16, r * .22), col, Math.sin(a) * r * 1.06, 0, Math.cos(a) * r * 1.06, g); t.rotation.y = a; }
  if (p) p.add(g); return g;
}
function mrScene(S, low) {
  const gfx = typeof hxGfx === 'function' ? hxGfx() : low ? 'low' : 'high';
  S.background = new THREE.Color('#0d0709'); S.fog = new THREE.FogExp2('#1a0f10', .022);
  S.add(new THREE.HemisphereLight('#a8828a', '#1a0d10', .42));
  // the frozen sunset: low, warm light pouring in through the windows on one side, striped by the pillars
  const sa = -.35, sun = SO.mrSun = new THREE.DirectionalLight('#ff9550', 1.35); sun.position.set(Math.cos(sa) * 30, 13, Math.sin(sa) * 30); sun.target.position.set(0, 0, 0); S.add(sun.target);
  sun.castShadow = !low; sun.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048); Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 80 }); sun.shadow.bias = -.0006; S.add(sun);
  const W = new THREE.Group(); S.add(W); const rnd = seeded('hall-of-hours');
  const m = (geo, col, x, y, z, glow) => is3mesh(geo, col, x, y, z, W, glow);
  // the floor, and the great clock laid into it; its minute hand moves with the fight's clock
  m(new THREE.CylinderGeometry(18, 18.5, .6, 48), '#3b3236', 0, -.3, 0).receiveShadow = true;
  const inner = m(new THREE.CylinderGeometry(13.6, 13.6, .04, 48), '#463b3f', 0, .02, 0); inner.receiveShadow = true;
  for (const [r, t] of [[13.25, .09], [12.7, .05], [11.7, .04]]) { const ring = m(new THREE.TorusGeometry(r, t, 4, 72), '#8a6a3c', 0, .05, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false; }
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0, L = big ? 1.1 : .35, b = m(new THREE.BoxGeometry(big ? .32 : .1, .05, L), '#8a6a3c', Math.sin(a) * (12.95 - L / 2), .05, Math.cos(a) * (12.95 - L / 2)); b.rotation.y = a; b.castShadow = false; }
  m(new THREE.CylinderGeometry(1.4, 1.5, .1, 24), '#8a6a3c', 0, .06, 0); m(new THREE.CylinderGeometry(.5, .5, .14, 16), '#5a4428', 0, .1, 0);
  const handM = (L, w, col) => { const g = new THREE.Group(); const h = is3mesh(new THREE.BoxGeometry(w, .06, L), col, 0, .09, -L / 2, g); h.castShadow = false; const tip = is3mesh(new THREE.ConeGeometry(w * 1.3, 1, 4), col, 0, .09, -L - .4, g); tip.rotation.x = -Math.PI / 2; tip.castShadow = false; W.add(g); return g; };
  const hourH = handM(6.2, .5, '#6e5530'), minH = handM(10.6, .32, '#7c6036'); hourH.rotation.y = -Math.PI * 2 * 11 / 12 + Math.PI; minH.rotation.y = Math.PI;
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(12.7, .12, 6, 96), new THREE.MeshBasicMaterial({ color: '#ffc76a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glowRing.rotation.x = Math.PI / 2; glowRing.position.y = .1; S.add(glowRing);
  SO.mrFloor = { minH, hourH, glowRing, glow: 0 };
  // dust lying on the floor, and scuffs
  for (let i = 0; i < 9; i++) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#1a1210', alphaMap: soTex('scorch_01'), transparent: true, opacity: .35 + rnd() * .25, depthWrite: false })); sc.rotation.set(-Math.PI / 2, 0, rnd() * 6); sc.scale.setScalar(2 + rnd() * 4); const a = rnd() * 6.28, r = 3 + rnd() * 9; sc.position.set(Math.cos(a) * r, .07, Math.sin(a) * r); sc.renderOrder = 1; W.add(sc); }
  // the walls: tall pillars, a low wall, and tall stained-glass windows holding a sunset that never ends
  const texs = [mrGlassTex('w1'), mrGlassTex('w2'), mrGlassTex('w3')], N = 16, R = 17.8;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const p = m(new THREE.CylinderGeometry(.8, .95, 19, 10), '#4a4046', x, 9.5, z); p.castShadow = true;
    m(new THREE.BoxGeometry(2.2, .8, 2.2), '#3f363c', x, .4, z); const cap = m(new THREE.BoxGeometry(2, .6, 2), '#3f363c', x, 15.2, z); cap.rotation.y = -a;
    const b = (i + .5) / N * Math.PI * 2, wx = Math.cos(b) * (R + .3), wz = Math.sin(b) * (R + .3);
    const wall = m(new THREE.BoxGeometry(6.2, 4.2, .9), '#3a3136', wx, 2.1, wz); wall.rotation.y = Math.PI / 2 - b;
    const top = m(new THREE.BoxGeometry(6.2, 2.4, .9), '#2e272b', wx, 16.8, wz); top.rotation.y = Math.PI / 2 - b;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 11), new THREE.MeshBasicMaterial({ map: texs[i % 3], transparent: true, alphaTest: .5, side: THREE.DoubleSide, toneMapped: false, fog: false, color: '#e6cfc0' }));
    win.position.set(wx, 9.8, wz); win.rotation.y = -Math.PI / 2 - b; W.add(win);
    // the stopped clocks on the pillars
    if (i % 3 === 0) { const d = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ map: mrDialTex('wc' + i), roughness: .7 })); const pr = R - 1; d.position.set(Math.cos(a) * pr, 7.5, Math.sin(a) * pr); d.lookAt(0, 7.5, 0); W.add(d); const rimc = m(new THREE.TorusGeometry(1, .09, 6, 28), '#8a6a3c', d.position.x, 7.5, d.position.z); rimc.lookAt(0, 7.5, 0); }
  }
  // shafts of sunset light falling through the windows on the sun's side
  for (const k of [-1.5, -.5, .5, 1.5]) {
    const b = sa + k * (Math.PI * 2 / N), from = new THREE.Vector3(Math.cos(b) * R, 10.5, Math.sin(b) * R), to = new THREE.Vector3(Math.cos(b) * 2 - Math.cos(sa) * 2, 0, Math.sin(b) * 2 - Math.sin(sa) * 2), len = from.distanceTo(to);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 3.3, len, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#ff9a50', transparent: true, opacity: .045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    sh.position.copy(from).lerp(to, .5); sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize()); S.add(sh);
  }
  // the altar at the back: steps, a huge cracked hourglass spilling its sand, and the rose clock window above
  const alt = new THREE.Group(); alt.position.set(0, 0, -15.3); W.add(alt);
  is3mesh(new THREE.BoxGeometry(9, .5, 4), '#41383d', 0, .25, 0, alt); is3mesh(new THREE.BoxGeometry(7, .5, 3), '#4a4046', 0, .75, -.3, alt);
  const big = mrHourglass(22, is3mat('#7a6036'), new THREE.MeshPhysicalMaterial({ color: '#e8f0ff', transparent: true, opacity: .2, roughness: .05, depthWrite: false }), is3mat('#c89a50', true)); big.position.set(0, 3.4, -.4); big.rotation.z = .08; alt.add(big);
  for (let i = 0; i < 4; i++) is3mesh(new THREE.ConeGeometry(.6 + rnd() * .6, .35 + rnd() * .25, 9), '#a8844a', (rnd() - .5) * 5, 1.1, (rnd() - .2) * 1.4, alt);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), new THREE.MeshBasicMaterial({ map: mrGlassTex('rose', true), toneMapped: false, fog: false, color: '#e6cfc0' })); rose.position.set(0, 11.6, -17.6); W.add(rose);
  const roseRim = m(new THREE.TorusGeometry(4.65, .3, 6, 48), '#3f363c', 0, 11.6, -17.5); void roseRim;
  // grandfather clocks against the walls, all stopped
  for (const a of [.62, 2.5, 3.78, 5.65]) {
    const g = new THREE.Group(), r = 16; g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.lookAt(0, 0, 0); W.add(g);
    is3mesh(new THREE.BoxGeometry(1.5, 5, 1), '#3b2a22', 0, 2.5, 0, g); is3mesh(new THREE.BoxGeometry(1.7, .5, 1.15), '#2e2019', 0, 5.2, 0, g);
    const d = new THREE.Mesh(new THREE.CircleGeometry(.6, 24), new THREE.MeshStandardMaterial({ map: mrDialTex('gf' + a), roughness: .7 })); d.position.set(0, 4.3, .51); g.add(d);
    is3mesh(new THREE.CylinderGeometry(.03, .03, 1.6, 4), '#8a6a3c', .1, 2.4, .52, g).rotation.z = .12; is3mesh(new THREE.CylinderGeometry(.24, .24, .05, 14), '#b08a4e', .2, 1.6, .53, g).rotation.x = Math.PI / 2;
  }
  // fallen gears and broken pews round the edge
  for (let i = 0; i < 11; i++) { const a = rnd() * 6.28, r = 13.9 + rnd() * 1.6, gr = mrGear(.35 + rnd() * .9, rnd() < .5 ? '#7d6340' : '#6a5436', W); gr.position.set(Math.cos(a) * r, .1, Math.sin(a) * r); gr.rotation.set((rnd() - .5) * .3, rnd() * 6, (rnd() - .5) * .3); if (i < 3) { gr.rotation.x = Math.PI / 2 - .3; gr.position.y = .8; gr.lookAt(0, .8, 0); gr.rotateX(Math.PI / 2 - .3); } }
  for (let i = 0; i < 6; i++) { const a = (i + .5) / 6 * Math.PI * 2 + .3, r = 15.4, g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = Math.PI / 2 - a + (rnd() - .5) * .5; W.add(g); is3mesh(new THREE.BoxGeometry(3.2, .18, .8), '#3b2a22', 0, .55, 0, g); is3mesh(new THREE.BoxGeometry(3.2, 1.1, .14), '#33241d', 0, 1, -.38, g).rotation.x = -.15; for (const x of [-1.4, 1.4]) is3mesh(new THREE.BoxGeometry(.14, .55, .7), '#2e2019', x, .27, 0, g); if (i % 2) g.rotation.z = .25; }
  mrCandles(W, rnd, gfx, low);
  // the body
  SO.gs = mrMake();
  if (SO.gs) { SO.gol = SO.gs; S.add(SO.gs.root); }
  else { SO.gol = soGolem(); S.add(SO.gol.root); } // the animations didn't load: the old stand-in
}
// candelabras round the hall and two great racks of votive candles by the altar: lit one by one in the intro
// (they go in SO.torches, so the shared flicker, flare and lighting code in souls.js drives them)
function mrCandles(W, rnd, gfx, low) {
  const T = SO.torches = [], iron = '#241f24', wax = '#e8dcc0';
  const put = (x, z, big) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); W.add(g); let fy, side = [];
    if (big) { // a tiered iron rack of votive candles
      is3mesh(new THREE.BoxGeometry(2.6, .2, 1), iron, 0, .1, 0, g);
      for (let t = 0; t < 3; t++) { is3mesh(new THREE.BoxGeometry(2.4 - t * .5, .1, .7), iron, 0, .6 + t * .45, -t * .12, g); for (let j = 0; j < 6 - t; j++) { const cx = (j - (5 - t) / 2) * .38; is3mesh(new THREE.CylinderGeometry(.06, .06, .18 + rnd() * .15, 6), wax, cx, .75 + t * .45, -t * .12, g); side.push([x + cx, .95 + t * .45, z - t * .12]); } }
      fy = 1.8;
    } else { // a tall three-armed candelabra
      is3mesh(new THREE.CylinderGeometry(.35, .45, .15, 8), iron, 0, .07, 0, g); is3mesh(new THREE.CylinderGeometry(.05, .07, 2.4, 6), iron, 0, 1.2, 0, g);
      is3mesh(new THREE.BoxGeometry(1.1, .06, .06), iron, 0, 2.3, 0, g);
      for (const cx of [-.5, 0, .5]) { is3mesh(new THREE.CylinderGeometry(.07, .07, .32 + (cx ? 0 : .12), 6), wax, cx, 2.5 + (cx ? 0 : .06), 0, g); if (cx) side.push([x + cx * Math.cos(0), 2.75, z]); }
      fy = 2.86;
    }
    const k = big ? 1.5 : .55;
    const f1 = soSprite('flame_03', '#ff9a3a', 1.1 * k, 1), f2 = soSprite('fire_01', '#ffe0a0', .7 * k, .9), gl = soSprite('flare_01', '#ff8a3a', 3.6 * k, .2);
    f1.position.set(x, fy + .25 * k, z); f2.position.set(x, fy + .12 * k, z); gl.position.set(x, fy + .1, z); [f1, f2, gl].forEach(sp => { sp.renderOrder = 3; SO.S.add(sp); });
    const sides = side.map(([sx, sy, sz]) => { const s = soSprite('flame_03', '#ffb050', .32, .95); s.position.set(sx, sy, sz); s.renderOrder = 3; SO.S.add(s); return s; });
    T.push({ x, y: fy, z, k, f1, f2, gl, big, lit: 0, base: big ? 2.4 : 1.3, ph: rnd() * 100, light: null, flare: 0, sides });
  };
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, r = 14.6; put(Math.cos(a) * r, Math.sin(a) * r); }
  put(-6, -12.6, true); put(6, -12.6, true);
  T.forEach((t, i) => {
    const want = t.big || gfx === 'high' || (gfx === 'medium' && i % 2 === 0); if (!want) return;
    const L = t.light = new THREE.PointLight('#ff9a4a', 0, t.big ? 24 : 14, 1.7); L.position.set(t.x, t.y + .4, t.z);
    if (t.big && gfx === 'high' && !low) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.bias = -.004; L.shadow.camera.near = .5; L.shadow.camera.far = 26; }
    SO.S.add(L);
  });
  // dust hanging in the air and drifting through the light
  SO.mist = [];
  for (let i = 0; i < (low ? 5 : 11); i++) { const sp = soSprite('smoke_03', '#6a5048', 7 + rnd() * 5, .08, false); const a = rnd() * 6.28, r = rnd() * 12; sp.position.set(Math.cos(a) * r, .6 + rnd() * .6, Math.sin(a) * r); sp.renderOrder = 1; SO.S.add(sp); SO.mist.push({ sp, a, r, v: (rnd() - .5) * .04, y: sp.position.y }); }
  SO.motes = [];
  for (let i = 0; i < (low ? 12 : 40); i++) { const sp = soSprite('spark_01', '#ffd8a0', .08 + rnd() * .07, .5); const a = rnd() * 6.28, r = 2 + rnd() * 12; sp.position.set(Math.cos(a) * r, 1 + rnd() * 9, Math.sin(a) * r); SO.S.add(sp); SO.motes.push({ sp, ph: rnd() * 9, y: sp.position.y }); }
}

// ---------- the fight: its brain ----------
function mrStart() {
  Object.assign(SO.B, { x: 0, z: -5.5, face: 0, state: 'sleep', trail: [], trT: 0, idleT: 0, tick: 0, tock: 0 });
  SO.spX = 1; SO.mrHands = []; SO.mrBlades = []; SO.mrProm = []; SO.mrEchoes = []; SO.mrPend = []; SO.mrDoom = null; SO.mrWave = null; SO.mrVid = 0; SO.mrHitV = {};
  // the things it throws and plants share these
  const bronze = new THREE.MeshStandardMaterial({ color: '#c49a58', metalness: .6, roughness: .35, emissive: '#6a4410', emissiveIntensity: .7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0ff', transparent: true, opacity: .3, roughness: .05, depthWrite: false });
  const sand = new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffb347', emissiveIntensity: 1.8, roughness: .5 });
  const blade = mrHandShape(.42, .03, bronze); blade.geometry.translate(0, -.42 * MR_SCALE * .5, 0);
  SO.mrMats = { bronze, glass, sand, bladeGeo: blade.geometry };
}
function mrStep(dt) {
  const B = SO.B, M = SO.me, ph = soPhase(), sp = soSpeed();
  // a new phase: the great bell tolls, the hourglass in its face turns over, and the shock knocks you back
  if (ph !== SO.lastPh) {
    const busy = ['air', 'dash', 'chan', 'doom'].includes(B.state);
    if (SO.lastPh != null && ph > SO.lastPh && !busy) {
      soPop(`Morrow: ${MR_PH[ph].n}`, 'phase'); mrClear(); B.queue = []; B.atk = { k: 'roar', w: 1.6, n: 'Toll' }; B.state = 'roar'; B.t = 1.6; B.stuck = 0; SO.atkId++;
      soSnd('m_toll', B); soSnd('m_roar', B, { gap: 200 }); SO.shake = .8; SO.rings.push({ x: B.x, z: B.z, r: 1, v: 9, mv: MR_MV.roar, m: soRing('#ffe0a0') }); soTorchFlare(1);
      if (SO.gs) SO.gs.flip = 1; if (SO.mrFloor) SO.mrFloor.glow = 1;
      setTimeout(() => { if (SO && !SO.over) soPop(['', '🔔 Pendulums swing and its Echoes throw', '⏩ It steps through the sand now, and aims where you\'re going', '⌛ Deadline: when the sand comes, get into the light'][ph], 'bad'); }, 1200);
      SO.lastPh = ph;
    } else if (SO.lastPh == null || ph < SO.lastPh || !busy) SO.lastPh = ph;
  }
  if (B.mark > 0) B.mark -= dt; if (B.stuck > 0) B.stuck -= dt;
  for (const d of B.dot) { d.t -= dt; if (d.t <= 0 && d.left > 0) { d.t = 1; d.left--; soHit(d.n, { dot: true }); } } B.dot = B.dot.filter(d => d.left > 0);
  B.greed = B.greed.filter(t => SO.time - t < 2.4);
  // the clock never stops: a heavy tick and tock every second, twice as fast in the last hour
  B.tick -= dt; if (B.tick <= 0) { B.tick = ph >= 3 ? .5 : 1; B.tock = 1 - B.tock; soSnd('m_tick', null, { vol: .55 + B.tock * .1, rate: B.tock ? .92 : 1 }); }
  // waiting makes it stronger: 10 s without a hit in an opening and it gets faster (up to +30%)
  B.idleT += dt; if (B.idleT >= 10) { B.idleT = 0; if (SO.spX < 1.3) { SO.spX = Math.min(1.3, Math.round((SO.spX + .06) * 100) / 100); soPop('⏳ You waited: Morrow grows faster', 'bad'); soSnd('m_whisper', B, { gap: 400 }); } }
  // where it has been (Rewind takes it back 3 s)
  B.trT -= dt; if (B.trT <= 0 && B.state !== 'air') { B.trT = .1; B.trail.push({ x: B.x, z: B.z, t: SO.time }); while (B.trail.length && B.trail[0].t < SO.time - 4.5) B.trail.shift(); }
  mrHaz(dt);
  if (B.stag > 0) { B.stag -= dt; return; }
  const dist = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z);
  B.t -= dt; B.back = 0;
  switch (B.state) {
    case 'roar': { if (B.t <= 0) { B.state = 'idle'; B.t = .1 + Math.random() * .4; } break; }
    case 'idle': case 'chase': {
      // it keeps its distance: it drifts in when you're far, and backs away, slow and patient, when you crowd it
      B.face += soAng(toP - B.face) * Math.min(1, dt * 3.2 * sp);
      if (dist > 10.5 && ph < 2) { const v = 1.9 * sp; B.x += Math.sin(B.face) * v * dt; B.z += Math.cos(B.face) * v * dt; B.state = 'chase'; }
      else if (dist < 4.6) { const v = 1.4 * sp; B.x -= Math.sin(B.face) * v * dt; B.z -= Math.cos(B.face) * v * dt; B.back = 1; B.state = 'idle'; }
      else B.state = 'idle';
      soBossFence();
      // crowd it and hit it too greedily and it isn't there any more
      if (B.greed.length >= 4 && dist < 5.5 && !(B.cool.away > SO.time)) { B.queue = ['away']; B.t = 0; }
      if (B.t <= 0) {
        const r = Math.random();
        // then, suddenly, very fast: it closes to throwing range in a blink (in the third phase it steps through the sand)
        if (!B.queue.length && dist > 11 && r < .5 && B.lastMove !== 'dash') { if (ph >= 2) mrStepSand(M, B); else mrDash(M, B); break; }
        if (!B.queue.length && dist < 11 && dist > 5 && r < [.18, .2, .14, .12][ph] && B.lastMove !== 'stalk') { B.state = 'stalk'; B.t = .6 + Math.random() * 1.1; B.side = Math.random() < .5 ? -1 : 1; B.lastMove = 'stalk'; break; }
        B.lastMove = ''; mrPick(dist, ph);
      }
      break;
    }
    case 'stalk': { // circling at a distance, watching, waiting
      B.face += soAng(toP - B.face) * Math.min(1, dt * 6);
      const v = 1.3 * sp, sx = Math.cos(B.face) * B.side, sz = -Math.sin(B.face) * B.side, close = dist > 9.5 ? .6 : dist < 7 ? -.6 : 0;
      B.x += (sx + Math.sin(B.face) * close) * v * dt; B.z += (sz + Math.cos(B.face) * close) * v * dt; soBossFence();
      if (B.t <= 0 || (dist < 5 && Math.random() < dt * 1.2)) mrPick(dist, ph);
      break;
    }
    case 'dash': {
      const a = B.dash, dx = a.tx - B.x, dz = a.tz - B.z, d = Math.hypot(dx, dz), v = 24 * sp * dt;
      B.face += soAng(Math.atan2(dx, dz) - B.face) * Math.min(1, dt * 14);
      if ((a.st = (a.st || 0) + dt) > .05) { a.st = 0; soBurst(new THREE.Vector3(B.x, .5, B.z), { tex: 'smoke_03', col: '#c8a060', n: 1, size: 1.6, life: .5, speed: .4, grow: 1, add: false, op: .35 }); }
      if (d <= v || B.t <= 0) { if (d <= v) { B.x = a.tx; B.z = a.tz; } soBossFence(); B.face = Math.atan2(M.x - B.x, M.z - B.z); B.lastMove = 'dash'; mrPick(soDist(B, M), ph, { fast: 1 }); }
      else { B.x += dx / d * v; B.z += dz / d * v; }
      break;
    }
    case 'wind': {
      const a = B.atk, turn = { hand: 2.6, hands: 4, still: 3.6 }[a.k] || 0;
      if (turn && !(a.k === 'hands' && B.t < .1)) B.face += soAng(toP - B.face) * Math.min(1, dt * turn);
      mrTeleStep(a, 1 - B.t / a.w);
      if (a.feint && B.t <= a.w * (1 - a.feint)) { mrFeint(a); break; }
      if (B.t <= 0) {
        // it waits for your roll to end before it throws or swings
        if (a.delay && !a.held && soRolling() && SO.time < M.iTo + .1) { a.held = 1; B.t = Math.max(0, M.iTo - SO.time) + .1 + Math.random() * .16; B.state = 'hold'; break; }
        if (a.wait && !a.held) { a.held = 1; B.t = a.wait; B.state = 'hold'; break; }
        mrStrike(a, ph);
      }
      break;
    }
    case 'hold': { const a = B.atk; mrTeleStep(a, 1); if (a.k === 'hands' || a.k === 'still') B.face += soAng(toP - B.face) * Math.min(1, dt * 2.5); if (B.t <= 0) mrStrike(a, ph); break; }
    case 'air': { // gone: a swirl of sand where it will step out
      const a = B.atk;
      if (a.sw && (a.swT = (a.swT || 0) + dt) > .06) { a.swT = 0; soBurst(new THREE.Vector3(a.ax + (Math.random() - .5), .3 + Math.random() * 2.5, a.az + (Math.random() - .5)), { tex: 'smoke_03', col: '#d8b070', n: 1, size: .9, life: .45, speed: 1.5, grow: .6, add: false, op: .45 }); }
      if (B.t <= 0) mrAppear(a, ph);
      break;
    }
    case 'cast': { // busy with its spell: exposed. It turns to watch you
      B.face += soAng(toP - B.face) * Math.min(1, dt * 2);
      if (B.t <= 0) { B.state = 'recover'; B.guard = false; B.t = (MR_MV[B.atk?.k]?.open || .4) / sp; }
      break;
    }
    case 'doom': break; // Deadline counts down in mrHaz, and lets it go
    case 'chan': { // Midnight: the hands sweep the hall; it stands at the centre, hands raised, guarded
      if (!SO.mrHands.length && B.t <= 0) { B.state = 'recover'; B.guard = false; B.t = MR_MV.midnight.open / Math.sqrt(sp); soSnd('m_scrape', B, { gap: 100 }); }
      break;
    }
    case 'recover': {
      if (B.greed.length >= 5 && B.t > .25 && dist < 5.5 && !(B.cool.away > SO.time)) { B.t = .05; B.queue.unshift('away'); }
      if (B.t <= 0) mrAfter(ph);
      break;
    }
    case 'tired': { if (B.t <= 0) { B.state = 'idle'; B.t = .05; } break; }
  }
}
// a sudden rush to throwing range: to a spot off to one side of you, never straight in a line you could read
function mrDash(M, B) {
  const side = Math.random() < .5 ? -1 : 1, ang = Math.atan2(B.x - M.x, B.z - M.z) + side * (.4 + Math.random() * .6), r = 6.5 + Math.random() * 2;
  B.dash = { tx: M.x + Math.sin(ang) * r, tz: M.z + Math.cos(ang) * r }; B.state = 'dash'; B.t = .9;
  soSnd('m_blink', B, { gap: 120, vol: .7, rate: 1.2 }); soSnd('g_whoosh', B, { gap: 80, rate: 1.3 });
}
// No Time to Rest: it doesn't walk any more, it steps through the sand
function mrStepSand(M, B) {
  const ang = Math.atan2(B.x - M.x, B.z - M.z) + (Math.random() - .5) * 2.2, r = 7 + Math.random() * 2.5;
  let x = M.x + Math.sin(ang) * r, z = M.z + Math.cos(ang) * r; const l = Math.hypot(x, z), m = SO_ARENA - 1.6; if (l > m) { x *= m / l; z *= m / l; }
  B.lastMove = 'dash'; B.atk = { k: 'away', w: .2, n: 'Not Now' }; SO.atkId++; mrVanish(B.atk, x, z, .3, 'pick');
}
// what it does next: weighted by distance and phase, avoiding what it just did, chaining at random with a tempo that never settles
function mrPick(dist, ph, o = {}) {
  const B = SO.B, c = B.cool, now = SO.time, rnd = Math.random, can = k => !(c[k] > now) && ph >= (MR_MV[k].ph || 0);
  let k, chain = false;
  B.guard = false;
  if (B.queue.length) { k = B.queue.shift(); chain = true; B.chainN = (B.chainN || 0) + 1; }
  else {
    const w = {}, add = (m, x) => { if (can(m)) w[m] = (w[m] || 0) + x; };
    const back = B.trail.find(p => p.t >= now - 3.1), rw = back && Math.hypot(back.x - B.x, back.z - B.z) > 4;
    if (dist < 6.6) { add('hand', 3); add('still', 1.3); add('promise', 1.4); add('away', ph ? 1.4 : .5); add('hands', .7); }
    else if (dist < 11) { add('hands', 3); add('promise', 2); add('still', 1.5); add('echo', 1.6); add('pendulum', 1.5); add('midnight', 1.2); add('deadline', 2.5); if (rw) add('rewind', 1.6); }
    else { add('hands', 2.4); add('promise', 1.4); add('echo', 1.8); add('pendulum', 1.6); add('midnight', 1.4); add('deadline', 2.5); add('still', .4); if (rw) add('rewind', 1.4); }
    // the first time in the Last Hour, the Deadline comes soon
    if (ph >= 3 && w.deadline && !B.doomed) w.deadline *= 3;
    if (o.fast) { delete w.pendulum; delete w.midnight; delete w.rewind; delete w.echo; delete w.deadline; delete w.away; }
    for (const m in w) { const n = B.hist.filter(x => x === m).length; w[m] *= Math.pow(.38, n); if (B.hist[B.hist.length - 1] === m) w[m] *= .25; }
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    if (!tot) { B.t = .08; B.state = 'idle'; return; }
    let r = rnd() * tot; for (const m in w) { r -= w[m]; if (r <= 0) { k = m; break; } } k = k || Object.keys(w)[0];
    B.chainN = 0;
    if (MR_FOL[k] && rnd() < [.32, .45, .58, .74][ph]) {
      const n = 1 + Math.floor(rnd() * (ph + 1.2)) + (ph >= 3 ? 1 : 0); let prev = k;
      for (let i = 0; i < Math.min(n, 4); i++) { const opts = MR_FOL[prev] || MR_FOL.hands; prev = opts[Math.floor(rnd() * opts.length)]; if (prev === 'away' && ph < 1) prev = 'still'; B.queue.push(prev); if (prev === 'away') break; }
    }
  }
  if (k === 'deadline') B.doomed = 1;
  B.hist.push(k); if (B.hist.length > 4) B.hist.shift();
  const sp = soSpeed();
  c[k] = now + ({ hand: .8, hands: 1.6, still: 4, promise: 6, rewind: 8, away: 6, echo: 9, pendulum: 10, midnight: 16, deadline: 22 }[k] || 2) * (.7 + rnd() * .6) / sp;
  // slow, then sudden: a wind-up can drag on, or snap out of a dash or a chain almost at once
  const prev = B.atk?.k, tempo = o.fast ? .5 + rnd() * .25 : chain ? [.5, .65, .85, 1.1, 1.4][Math.floor(rnd() * 5)] : .7 + rnd() * .9;
  let w = Math.max(.2, MR_MV[k].w * tempo / sp);
  if (chain && prev === 'still') w = Math.max(w, 1.05); // after a Stillness you get just long enough to break free first
  mrBegin(k, w, chain);
}
function mrBegin(k, w, chain) {
  const B = SO.B, ph = soPhase(), rnd = Math.random, mv = MR_MV[k];
  const a = B.atk = { k, w, n: mv.n };
  if (k === 'hand') {
    if (!chain && rnd() < [.12, .18, .24, .3][ph]) a.feint = .5 + rnd() * .2;
    else if (rnd() < [.45, .55, .65, .75][ph]) a.delay = 1;
  }
  if (k === 'hands' && rnd() < [.3, .45, .6, .7][ph]) a.delay = 1;
  if ((k === 'hand' || k === 'hands') && rnd() < [.2, .24, .28, .32][ph]) a.wait = .25 + rnd() * .7; // it holds, trembling, for as long as it likes
  B.state = 'wind'; B.t = w; SO.atkId++;
  mrTele(a);
  soSnd({ still: 'm_whisper', promise: 'm_sand', rewind: 'm_whisper', echo: 'm_whisper', pendulum: 'm_whisper', midnight: 'm_whisper', deadline: 'm_whisper', away: 'm_blink' }[k] || 'm_scrape', B, { gap: 120, vol: k === 'hands' ? .6 : .8, rate: .9 + rnd() * .2 });
}
// a fake-out: the Hour Hand stops short and a throw or a freeze comes instead
function mrFeint(a) {
  const B = SO.B; soClearTele();
  const k = Math.random() < .5 ? 'hands' : 'still', w = MR_MV[k].w * (.45 + Math.random() * .25) / soSpeed();
  B.atk = { k, w, n: MR_MV[k].n, faked: 1 }; B.t = w; mrTele(B.atk); SO.atkId++;
  soSnd('m_scrape', B, { gap: 80, rate: 1.3 });
}
// the fan of clock hands it throws: how many, and how wide, by phase
const mrFan = ph => ph ? [-.36, -.18, 0, .18, .36] : [-.22, 0, .22];
// ---------- the warnings on the floor ----------
const mrMat = (c, o = .3) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
function mrFloorMesh(geo, c, x, z, rot = 0, o = .3) { const m = new THREE.Mesh(geo, mrMat(c, o)); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, .06, z); m.renderOrder = 2; SO.S.add(m); return m; }
function mrKill(m) { if (!m) return; SO.S.remove(m); m.traverse?.(o => { if (!o.isSprite) o.geometry?.dispose(); if (o.material && !o.material.shared) o.material.dispose?.(); }); }
function mrTele(a) {
  const B = SO.B, M = SO.me;
  const add = (geo, c, x, z, rot = 0) => { const m = mrFloorMesh(geo, c, x, z, rot); SO.tele.push({ m, a }); return m; };
  const mv = MR_MV[a.k], ph = soPhase();
  if (a.k === 'hand') { a.tm = add(new THREE.RingGeometry(1.2, mv.r, 44, 1, -mv.arc, mv.arc * 2), '#ff7b3b', B.x, B.z); a.cone = 1; }
  else if (a.k === 'hands') { // a lane down the floor for each hand it will throw
    a.offs = mrFan(ph); a.lanes = a.offs.map(o => { const g = new THREE.PlaneGeometry(.55, 19); g.translate(0, 19 / 2 + 1, 0); return { o, m: add(g, '#ffb347', B.x, B.z) }; });
  }
  else if (a.k === 'still') { a.arc = ph >= 2 ? .8 : mv.arc; a.tm = add(new THREE.CircleGeometry(mv.r, 28, -a.arc, a.arc * 2), '#74c0fc', B.x, B.z); a.cone = 1; }
  else if (a.k === 'promise' || a.k === 'echo' || a.k === 'deadline') { a.tm = add(new THREE.RingGeometry(1.6, 2.3, 40), '#ffd8a0', B.x, B.z); }
  else if (a.k === 'rewind') { // where it stood 3 seconds ago: a ghost of sand
    const back = B.trail.find(p => p.t >= SO.time - 3.1) || { x: B.x, z: B.z }; a.gx = back.x; a.gz = back.z;
    a.tm = add(new THREE.RingGeometry(1.2, 1.6, 36), '#ffd8a0', a.gx, a.gz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 7, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#ffc870', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    col.position.set(a.gx, 3.5, a.gz); SO.S.add(col); SO.tele.push({ m: col, a }); a.col = col;
  }
  else if (a.k === 'pendulum') { // Toll of the Bells: lanes across the hall, one through you; giant pendulums swing down them
    const n = ph >= 2 ? 3 : 2, ang = Math.random() * Math.PI, nx = Math.cos(ang), nz = -Math.sin(ang), mine = M.x * nx + M.z * nz;
    const offs = [mine]; for (let i = 1; i < n; i++) offs.push(mine + (i % 2 ? 1 : -1) * (5 + Math.random() * 2) * Math.ceil(i / 2));
    offs.forEach((off, i) => {
      const tm = mrFloorMesh(new THREE.PlaneGeometry(mv.wid * 2, 30), '#ff8f3b', nx * off, nz * off, ang + Math.PI, .2);
      const w = a.w + .9 + i * (.3 + Math.random() * .4); SO.mrPend.push({ ang, off, nx, nz, t: w, w, tm, dir: Math.random() < .5 ? 1 : -1 });
    });
  }
}
function mrTeleStep(a, p) {
  const B = SO.B; if (a.col) a.col.material.opacity = .05 + p * .18;
  if (a.lanes) a.lanes.forEach(l => { l.m.material.opacity = .14 + p * .4; l.m.position.set(B.x, .06, B.z); l.m.rotation.z = B.face + l.o + Math.PI; });
  if (!a.tm) return; a.tm.material.opacity = .22 + p * .55;
  if (a.cone) { a.tm.position.set(B.x, .06, B.z); a.tm.rotation.z = B.face - Math.PI / 2; }
  else if (a.k !== 'rewind') a.tm.position.set(B.x, .06, B.z);
}
function mrClear() { soClearTele(); }
// a big blade sweep you can see: a fading arc of light at the height it swung
function mrArc(r, arc, low, col) {
  const B = SO.B, m = new THREE.Mesh(new THREE.RingGeometry(r * .35, r, 40, 1, -arc, arc * 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  m.rotation.set(-Math.PI / 2, 0, B.face - Math.PI / 2); m.position.set(B.x, low ? .5 : 2.6, B.z); SO.S.add(m); SO.fx.push({ m, a: 0, x: B.x, z: B.z, t: .3, s: 0, arc: 1 });
}
// throw a fan of spinning clock hands from (x, z) towards ang
function mrVolley(x, z, ang, offs, mv) {
  const vid = ++SO.mrVid, v = 15 * Math.sqrt(soSpeed());
  for (const o of offs) {
    const g = new THREE.Group(), b = new THREE.Mesh(SO.mrMats.bladeGeo, SO.mrMats.bronze); b.rotation.x = -Math.PI / 2; b.castShadow = true; g.add(b);
    const gl = soSprite('flare_01', '#ffcf7a', 1.3, .45); g.add(gl); g.position.set(x, 1.3, z); SO.S.add(g);
    SO.mrBlades.push({ g, gl, x, z, dx: Math.sin(ang + o), dz: Math.cos(ang + o), v, vid, mv, life: 2.4 });
  }
  soSnd('g_whoosh', { x, z }, { gap: 60, rate: 1.4 }); soSnd('m_blade', { x, z }, { gap: 60, rate: 1.5, vol: .7 });
}
// where to throw at you: straight at you, or (from the third phase) where you're going
function mrAim(x, z, lead) {
  const M = SO.me, d = Math.hypot(M.x - x, M.z - z), t = lead ? d / 15 : 0;
  return Math.atan2(M.x + M.vx * t - x, M.z + M.vz * t - z);
}
function mrStrike(a, ph) {
  const B = SO.B, M = SO.me, mv = MR_MV[a.k], sp = soSpeed(), d = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z), front = Math.abs(soAng(toP - B.face));
  const open = t => { B.state = 'recover'; B.guard = B.queue.length > 0; B.t = t * (B.guard ? 1 : .85 + Math.random() * .4) / sp; if (!B.guard && (B.chainN || 0) >= 2) B.tiredNext = 1; };
  const cast = t => { B.state = 'cast'; B.guard = false; B.t = t / Math.sqrt(sp); if (!SO.mrCastSeen) { SO.mrCastSeen = 1; soPop('✨ Casting: it\'s exposed, hit it now', 'good'); } };
  if (a.k !== 'rewind') soClearTele();
  if (a.k === 'hand') { // its one big swing, for when you crowd it
    if (d < mv.r && front < mv.arc) soHurtBy({ ...mv, k: a.k });
    mrArc(mv.r, mv.arc, false, '#ffb070'); soSnd('m_blade', B, { gap: 60, rate: .95 }); SO.shake = .2;
    open(B.queue.length ? .12 : mv.open);
  }
  else if (a.k === 'hands') { // Clock Hands: a fan down the lanes (from No Time to Rest it leads you, and a second wave follows)
    const ang = ph >= 2 ? mrAim(B.x, B.z, 1) : B.face;
    mrVolley(B.x + Math.sin(B.face) * 1.5, B.z + Math.cos(B.face) * 1.5, ang, a.offs || mrFan(ph), mv);
    if (ph >= 2) SO.mrWave = { t: .45 / Math.sqrt(sp) };
    open(B.queue.length ? .15 : mv.open);
  }
  else if (a.k === 'still') { // Stillness: a cone of frozen time (wider from No Time to Rest)
    const arc = a.arc || mv.arc;
    if (d < mv.r && front < arc + .08 && soHurtBy({ ...mv, k: a.k })) {
      M.frozen = M.block ? .35 : .8; soPop('⏳ Stillness: frozen in time', 'bad'); soSnd('m_freeze', M, { gap: 100 });
      soBurst(new THREE.Vector3(M.x, 1.2 + M.y, M.z), { tex: 'star_04', col: '#a5d8ff', n: 8, size: .5, life: .8, speed: 2, grav: -1 }); soBurst(new THREE.Vector3(M.x, 1.2, M.z), { tex: 'circle_05', col: '#a5d8ff', n: 1, size: 1, life: .5, speed: 0, grow: 2.5 });
    }
    const g = new THREE.Mesh(new THREE.CircleGeometry(mv.r, 28, -arc, arc * 2), new THREE.MeshBasicMaterial({ color: '#d0ebff', transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    g.rotation.set(-Math.PI / 2, 0, B.face - Math.PI / 2); g.position.set(B.x, 1, B.z); SO.S.add(g); SO.fx.push({ m: g, t: .35, arc: 1 });
    soSnd('m_freeze', B, { gap: 200, vol: .6 });
    open(B.queue.length ? .15 : mv.open);
  }
  else if (a.k === 'promise') { mrPromise(ph); cast(1); }
  else if (a.k === 'echo') { mrEchoes(ph >= 2 ? 2 : 1); cast(.85); }
  else if (a.k === 'pendulum') { soSnd('m_toll', B, { gap: 300, vol: .8 }); if (SO.mrFloor) SO.mrFloor.glow = .7; soPop('🔔 Pendulums: get out of the lanes', 'bad'); open(mv.open); }
  else if (a.k === 'rewind') { // into sand, and out again where it stood (from No Time to Rest it leaves an Echo where it was)
    if (ph >= 2) mrEchoAt(B.x, B.z);
    mrVanish(a, a.gx, a.gz, .28, Math.hypot(M.x - a.gx, M.z - a.gz) < 6.4 ? 'hand' : 'hands');
  }
  else if (a.k === 'away') { // Not Now: it vanishes and reappears far from you, throwing
    const ang = Math.atan2(B.x - M.x, B.z - M.z) + (Math.random() - .5) * 1.6, r = 9.5 + Math.random() * 1.5;
    let x = M.x + Math.sin(ang) * r, z = M.z + Math.cos(ang) * r; const l = Math.hypot(x, z), m = SO_ARENA - 1.6; if (l > m) { x *= m / l; z *= m / l; }
    B.greed = []; soPop('⌛ Not now…', 'bad'); mrVanish(a, x, z, .35, 'hands');
  }
  else if (a.k === 'midnight') { mrVanish(a, 0, 0, .3, 'chan'); }
  else if (a.k === 'deadline') { mrVanish(a, 0, 0, .3, 'doom'); }
  else open(.25);
}
// vanish into sand and step out at (x, z) after t seconds, then do `then`
function mrVanish(a, x, z, t, then) {
  const B = SO.B; soClearTele();
  soBurst(new THREE.Vector3(B.x, 2.5, B.z), { tex: 'smoke_03', col: '#d8b070', n: 8, size: 1.8, life: .8, speed: 3, grow: 1, add: false, op: .55 });
  soBurst(new THREE.Vector3(B.x, 2.5, B.z), { tex: 'spark_01', col: '#ffd08a', n: 14, size: .2, life: .9, speed: 5, grav: 4 });
  soSnd('m_blink', B, { gap: 80 });
  B.atk = { ...a, ax: x, az: z, then, sw: 1 }; B.state = 'air'; B.t = t / Math.sqrt(soSpeed());
}
function mrAppear(a, ph) {
  const B = SO.B, M = SO.me; B.x = a.ax; B.z = a.az; soBossFence(); B.face = Math.atan2(M.x - B.x, M.z - B.z);
  soBurst(new THREE.Vector3(B.x, 2.5, B.z), { tex: 'smoke_03', col: '#d8b070', n: 6, size: 1.6, life: .6, speed: 2.5, grow: .8, add: false, op: .5 });
  soSnd('m_blink', B, { gap: 60, rate: .85 });
  if (a.then === 'chan') { mrMidnight(ph); return; }
  if (a.then === 'doom') { mrDeadline(ph); return; }
  if (a.then === 'pick') { B.state = 'idle'; B.t = .05 + Math.random() * .3; return; }
  const k = a.then, w = Math.max(.22, MR_MV[k].w * (.6 + Math.random() * .35) / soSpeed());
  mrBegin(k, w, true);
}
// Empty Promises: hourglasses planted round you, each bursting when its sand runs out, on its own timer
function mrPromise(ph) {
  const M = SO.me, n = [3, 4, 5, 5][ph], mv = MR_MV.promise, base = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = base + i / (n - 1 || 1) * Math.PI * 2 * (n - 1) / n, r = i ? 2.6 + Math.random() * 2.2 : 0;
    let x = M.x + M.vx * .3 + Math.sin(a) * r, z = M.z + M.vz * .3 + Math.cos(a) * r; const l = Math.hypot(x, z); if (l > SO_ARENA - .5) { x *= (SO_ARENA - .5) / l; z *= (SO_ARENA - .5) / l; }
    const T = (1.5 + Math.random() * 1.6) / Math.sqrt(soSpeed());
    const fill = mrFloorMesh(new THREE.CircleGeometry(mv.r, 32), '#ffb347', x, z, 0, .32), edge = mrFloorMesh(new THREE.RingGeometry(mv.r - .14, mv.r, 40), '#ffe0a0', x, z, 0, .8);
    fill.scale.setScalar(.01);
    const hg = mrHourglass(MR_SCALE * 1.4, SO.mrMats.bronze, SO.mrMats.glass, SO.mrMats.sand); hg.position.set(x, -.6, z); SO.S.add(hg);
    SO.mrProm.push({ x, z, t: T, T, fill, edge, hg });
  }
  soSnd('m_sand', M, { gap: 100 }); soSnd('m_tick', M, { gap: 100, rate: 1.4 });
  if (!SO.mrPromSeen) { SO.mrPromSeen = 1; soPop('⏳ Empty Promises: leave before the sand runs out', 'bad'); }
}
// a sand ghost of itself: it fades in, aims, throws a fan of clock hands, and crumbles
function mrGhost() {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#f0c070', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const robe = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5.4, 14, 1, true), mat); robe.position.y = 2.7; g.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(.7, 12, 8), mat); hood.position.y = 5.6; g.add(hood);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, 2.4, 6), mat); arm.position.set(.9, 4, .5); arm.rotation.x = -1; g.add(arm);
  const eye = soSprite('flare_01', '#ffcf7a', 1.6, 0); eye.position.y = 5.6; g.add(eye);
  return { g, mat, eye };
}
function mrEchoAt(x, z) {
  const o = mrGhost(); o.g.position.set(x, 0, z); SO.S.add(o.g);
  SO.mrEchoes.push({ ...o, x, z, t: 1.15 / Math.sqrt(soSpeed()), out: 0, lanes: mrFan(0).map(off => { const g = new THREE.PlaneGeometry(.5, 17); g.translate(0, 17 / 2 + 1, 0); return { o: off, m: mrFloorMesh(g, '#ffd8a0', x, z, 0, .15) }; }) });
  soBurst(new THREE.Vector3(x, 2.5, z), { tex: 'smoke_03', col: '#d8b070', n: 5, size: 1.4, life: .6, speed: 2, grow: .8, add: false, op: .45 });
}
function mrEchoes(n) {
  const M = SO.me, B = SO.B, away = Math.atan2(B.x - M.x, B.z - M.z);
  for (let i = 0; i < n; i++) {
    const ang = away + Math.PI + (n > 1 ? (i ? 1 : -1) * (.9 + Math.random() * .5) : (Math.random() - .5) * 1.6), r = 8 + Math.random() * 1.5;
    let x = M.x + Math.sin(ang) * r, z = M.z + Math.cos(ang) * r; const l = Math.hypot(x, z), m = SO_ARENA - 1.2; if (l > m) { x *= m / l; z *= m / l; }
    mrEchoAt(x, z);
  }
  soSnd('m_whisper', B, { gap: 100 });
  if (!SO.mrEchoSeen) { SO.mrEchoSeen = 1; soPop('👻 Echoes: they throw where the lanes point', 'bad'); }
}
// Midnight: from the centre, one (two in the last hour) of the floor clock's hands sweeps all the way round. Jump it.
function mrMidnight(ph) {
  const B = SO.B, M = SO.me, n = ph >= 3 ? 2 : 1, base = Math.atan2(M.x, M.z) + Math.PI;
  B.state = 'chan'; B.t = .1; B.guard = true;
  for (let i = 0; i < n; i++) {
    const L = 13.4, g = new THREE.PlaneGeometry(1.5, L - .8); g.translate(0, (L - .8) / 2 + .8, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffc76a', transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(0, .12, 0); SO.S.add(m);
    const dir = i ? -1 : (Math.random() < .5 ? 1 : -1);
    SO.mrHands.push({ m, ang: base + i * Math.PI, dir, w: (2.7 + ph * .2) * Math.sqrt(soSpeed()), t: -.95, left: Math.PI * 2, hit: 0 });
  }
  if (SO.mrFloor) SO.mrFloor.glow = 1;
  soSnd('m_toll', B, { gap: 300, vol: .8 }); soSnd('m_roar', B, { gap: 300, vol: .5, rate: 1.2 });
  soPop('🕛 Midnight: jump the hands', 'bad');
}
// Deadline: the hall fills with sand and only three circles of light are safe. It stands in the middle, exposed, counting down.
function mrDeadline(ph) {
  const B = SO.B, M = SO.me, mv = MR_MV.deadline, T = 3.4, base = Math.random() * Math.PI * 2, safes = [];
  for (let i = 0; i < 3; i++) {
    const a = base + i * Math.PI * 2 / 3 + (Math.random() - .5) * .5, r = 6.5 + Math.random() * 3, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const fl = mrFloorMesh(new THREE.CircleGeometry(mv.r, 36), '#fff0c0', x, z, 0, .35), edge = mrFloorMesh(new THREE.RingGeometry(mv.r - .15, mv.r, 44), '#ffffff', x, z, 0, .9);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(mv.r, mv.r, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: .14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    col.position.set(x, 7, z); SO.S.add(col);
    safes.push({ x, z, fl, edge, col });
  }
  SO.mrDoom = { t: T, T, safes, n: 4, fog: SO.S.fog?.density || .022 };
  B.state = 'doom'; B.t = T; B.guard = false;
  if (SO.mrFloor) SO.mrFloor.glow = 1;
  soSnd('m_toll', B, { gap: 300 }); soSnd('m_sand', B, { gap: 100, vol: 1.2 }); soSnd('m_roar', B, { gap: 300, vol: .6, rate: .8 });
  soPop('⌛ Deadline: get into the light (it\'s exposed)', 'bad');
}
// hazards that are only Morrow's: thrown clock hands, Promises, Echoes, Pendulums, Midnight's hands, the Deadline
function mrHaz(dt) {
  const M = SO.me, B = SO.B, sp = soSpeed();
  // the second wave of Clock Hands
  if (SO.mrWave && (SO.mrWave.t -= dt) <= 0) { SO.mrWave = null; if (B.state !== 'air' && B.state !== 'down' && !SO.over) mrVolley(B.x, B.z, mrAim(B.x, B.z, 1), mrFan(0), MR_MV.hands); }
  SO.mrBlades = SO.mrBlades.filter(b => {
    const s = b.v * dt; b.x += b.dx * s; b.z += b.dz * s; b.life -= dt;
    b.g.position.set(b.x, 1.3, b.z); b.g.rotation.y += dt * 16;
    if (!SO.mrHitV[b.vid] && Math.hypot(b.x - M.x, b.z - M.z) < .95 && M.y < 2.2 && soHurtBy({ ...b.mv, k: 'hands', x: b.x, z: b.z })) {
      SO.mrHitV[b.vid] = 1; soBurst(new THREE.Vector3(M.x, 1.3, M.z), { tex: 'spark_01', col: '#ffd08a', n: 8, size: .25, life: .4, speed: 5, grav: 8 });
    }
    if (b.life > 0 && Math.hypot(b.x, b.z) < 16.5 && !SO.over) return true;
    SO.S.remove(b.g); b.gl.material.dispose(); return false;
  });
  SO.mrProm = SO.mrProm.filter(p => {
    p.t -= dt; const k = 1 - Math.max(0, p.t / p.T);
    p.fill.scale.setScalar(Math.max(.01, k)); p.fill.material.opacity = .2 + k * .3; p.edge.material.opacity = .5 + Math.sin(SO.time * (8 + k * 20)) * .3;
    p.hg.position.y = Math.min(.05, p.hg.position.y + dt * 3); p.hg.rotation.y += dt * .8;
    if (p.t > 0 && !SO.over) return true;
    if (!SO.over) {
      if (Math.hypot(p.x - M.x, p.z - M.z) < MR_MV.promise.r && M.y < 1.4) soHurtBy({ ...MR_MV.promise, k: 'promise' });
      soBoom(p.x, p.z, '#ffcf7a', 2.2); soDust(p.x, p.z, .9); soSnd('m_crash', p, { gap: 50, vol: .8, rate: 1.2 });
      soBurst(new THREE.Vector3(p.x, .8, p.z), { tex: 'spark_01', col: '#ffe0a0', n: 10, size: .22, life: .5, speed: 6, grav: 10, up: .6 });
      soBurst(new THREE.Vector3(p.x, .6, p.z), { tex: 'smoke_03', col: '#d8b070', n: 3, size: 2, life: .7, speed: 2, grow: 1, add: false, op: .5 });
    }
    mrKill(p.fill); mrKill(p.edge); SO.S.remove(p.hg); p.hg.traverse(o => o.geometry?.dispose()); return false;
  });
  SO.mrEchoes = SO.mrEchoes.filter(e => {
    e.t -= dt;
    if (e.t > 0) { // fading in, turning to you, its lanes following you
      const ang = Math.atan2(M.x - e.x, M.z - e.z); if (e.t > .15) e.ang = ang;
      e.g.rotation.y = e.ang; e.mat.opacity = Math.min(.42, e.mat.opacity + dt * 1.2); e.eye.material.opacity = e.mat.opacity * 2;
      e.lanes.forEach(l => { l.m.rotation.z = e.ang + l.o + Math.PI; l.m.material.opacity = .1 + (1 - e.t) * .35; });
      return true;
    }
    if (!e.thrown) { e.thrown = 1; e.lanes.forEach(l => mrKill(l.m)); e.lanes = []; mrVolley(e.x, e.z, e.ang, mrFan(0), MR_MV.echo); }
    e.out += dt; e.mat.opacity = Math.max(0, .42 - e.out * .7); e.eye.material.opacity = e.mat.opacity; e.g.position.y = -e.out * 1.5;
    if ((e.sT = (e.sT || 0) + dt) > .07) { e.sT = 0; soBurst(new THREE.Vector3(e.x + (Math.random() - .5) * 2, Math.random() * 4, e.z + (Math.random() - .5) * 2), { tex: 'smoke_03', col: '#d8b070', n: 1, size: 1, life: .5, speed: .5, grav: 2, add: false, op: .4 }); }
    if (e.out < .65 && !SO.over) return true;
    e.lanes.forEach(l => mrKill(l.m)); mrKill(e.g); return false;
  });
  SO.mrPend = SO.mrPend.filter(p => {
    p.t -= dt;
    if (p.t > 0) { p.tm.material.opacity = .14 + (1 - p.t / p.w) * .4 * (p.t < .5 ? (Math.sin(SO.time * 30) * .3 + .7) : 1); return true; }
    const dx = Math.sin(p.ang), dz = Math.cos(p.ang), cx = p.nx * p.off, cz = p.nz * p.off;
    if (!p.g) { // a giant pendulum blade drops out of the dark and swings down the lane
      const g = p.g = new THREE.Group(), bronze = SO.mrMats.bronze;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, .14, 32), bronze); disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nx, 0, p.nz)); g.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, .08, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffd08a', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); rim.quaternion.copy(disc.quaternion); g.add(rim);
      const rod = p.rod = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1, 6), bronze); SO.S.add(rod);
      SO.S.add(g); p.s = -15 * p.dir; p.prev = null; soSnd('m_bell', { x: cx, z: cz }, { gap: 80, vol: .8, rate: .8 + Math.random() * .3 });
    }
    const v = 30 * Math.sqrt(sp) * dt; p.s += p.dir * v;
    const u = p.s / 15, y = 1.4 + u * u * 1.6, x = cx + dx * p.s, z = cz + dz * p.s;
    p.g.position.set(x, y, z);
    const top = new THREE.Vector3(cx, 19, cz), bob = new THREE.Vector3(x, y + 1.6, z), len = top.distanceTo(bob);
    p.rod.position.copy(top).lerp(bob, .5); p.rod.scale.y = len; p.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bob).normalize());
    // you: in the lane, and did it pass where you stand?
    const rx = M.x - cx, rz = M.z - cz, along = rx * dx + rz * dz, across = Math.abs(rx * p.nx + rz * p.nz);
    if (!p.hit && across < MR_MV.pendulum.wid + .35 && p.prev != null && (along - p.prev) * (along - p.s) <= 0) { if (soHurtBy({ ...MR_MV.pendulum, k: 'pendulum', x, z })) p.hit = 1; }
    if (p.prev != null && Math.abs(along - p.s) < 3 && !p.whoosh) { p.whoosh = 1; soSnd('g_whoosh', { x, z }, { gap: 60, rate: .7, vol: 1.2 }); }
    p.prev = p.s; p.tm.material.opacity = Math.max(0, p.tm.material.opacity - dt * .6);
    if ((p.sT = (p.sT || 0) + dt) > .04) { p.sT = 0; soBurst(new THREE.Vector3(x, y - 1, z), { tex: 'spark_01', col: '#ffd08a', n: 1, size: .25, life: .4, speed: 2, grav: 4, up: 1 }); }
    if (Math.abs(p.s) < 15.5 && !SO.over) return true;
    mrKill(p.tm); SO.S.remove(p.g); p.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); SO.S.remove(p.rod); p.rod.geometry.dispose(); return false;
  });
  SO.mrHands = SO.mrHands.filter(h => {
    h.t += dt;
    if (h.t < 0) { h.m.material.opacity = .12 + (1 + h.t) * .25 * (Math.sin(h.t * 30) * .3 + .7); h.m.rotation.z = h.ang + Math.PI; return true; }
    const step = h.w * dt; h.ang += h.dir * step; h.left -= step; h.m.rotation.z = h.ang + Math.PI; h.m.material.opacity = .75;
    if ((h.sT = (h.sT || 0) + dt) > .05) { h.sT = 0; const r = 2 + Math.random() * 11; soBurst(new THREE.Vector3(Math.sin(h.ang) * r, .3, Math.cos(h.ang) * r), { tex: 'spark_01', col: '#ffd08a', n: 1, size: .25, life: .4, speed: 2, grav: 3, up: 1 }); }
    // you: on the hand's line, within its length?
    const pr = Math.hypot(M.x, M.z), pa = Math.atan2(M.x, M.z), da = soAng(pa - h.ang);
    if (!h.hit && pr > .8 && Math.abs(da) < Math.PI / 2 && pr * Math.abs(Math.sin(da)) < .9) { if (soHurtBy({ ...MR_MV.midnight, k: 'midnight' })) h.hit = 1; }
    if (h.left > 0 && !SO.over) return true;
    SO.S.remove(h.m); h.m.geometry.dispose(); h.m.material.dispose(); return false;
  });
  const D = SO.mrDoom;
  if (D) {
    D.t -= dt; const k = 1 - Math.max(0, D.t / D.T);
    if (Math.ceil(D.t) < D.n && D.t > 0) { D.n = Math.ceil(D.t); soPop(`⌛ ${D.n}…`, 'bad'); soSnd('m_tick', null, { gap: 50, vol: 1, rate: .8 }); }
    if (SO.S.fog) SO.S.fog.density = D.fog + k * .03;
    D.safes.forEach(s => { s.col.material.opacity = .1 + k * .2; s.fl.material.opacity = .25 + k * .35; });
    // the sand rising everywhere but the light
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = Math.random() * 13, x = Math.sin(a) * r, z = Math.cos(a) * r; if (D.safes.some(s => Math.hypot(s.x - x, s.z - z) < 2.8)) continue; soBurst(new THREE.Vector3(x, .3 + k * 1.5, z), { tex: 'smoke_03', col: '#c8a060', n: 1, size: 2 + k * 2, life: .9, speed: .5, grow: 1, add: false, op: .25 + k * .25 }); }
    if (D.t <= 0 || SO.over) {
      const safe = D.safes.some(s => Math.hypot(s.x - M.x, s.z - M.z) < MR_MV.deadline.r);
      if (!SO.over) {
        if (safe) soPop('☀️ Safe in the light', 'good'); else soHurtBy({ ...MR_MV.deadline, k: 'deadline' });
        SO.shake = 1; soSnd('m_crash', B, { gap: 50 }); soSnd('m_sand', B, { gap: 50, vol: 1.3 });
        for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28, r = 3 + Math.random() * 9; soBurst(new THREE.Vector3(Math.sin(a) * r, 1, Math.cos(a) * r), { tex: 'smoke_03', col: '#d8b070', n: 1, size: 3.5, life: .9, speed: 3, grow: 1.2, add: false, op: .55 }); }
        if (B.state === 'doom') { B.state = 'recover'; B.guard = false; B.t = MR_MV.deadline.open / Math.sqrt(sp); }
      }
      if (SO.S.fog) SO.S.fog.density = D.fog;
      D.safes.forEach(s => { mrKill(s.fl); mrKill(s.edge); mrKill(s.col); }); SO.mrDoom = null;
    }
  }
}
function mrAfter(ph) {
  const B = SO.B;
  if (B.queue.length) { B.state = 'idle'; B.t = .02; return; }
  if (B.tiredNext) { B.tiredNext = 0; B.state = 'tired'; B.t = (1.1 + Math.random() * .7) / Math.sqrt(soSpeed()); soSnd('m_whisper', B, { gap: 100, vol: .5, rate: .8 }); return; }
  // in the third phase it barely rests at all
  const r = Math.random();
  B.state = 'idle'; B.t = (r < .3 ? .02 : r < .8 ? .15 + Math.random() * .4 : .7 + Math.random() * .7) / soSpeed() * (ph >= 2 ? .5 : 1);
}

// ---------- its body follows the fight ----------
function mrAnim(dt, t) {
  const S = SO.gs, B = SO.B, st = B.state, a = B.atk, mv = a && MR_ANIM[a.k], ph = SO.cine ? 0 : soPhase();
  if (!S) return;
  S.root.visible = st !== 'air';
  if (st === 'sleep') S.play('Idle_FoldArms_Loop', { speed: .3 });
  else if (st === 'wake') S.play('Idle_Loop', { fade: .9, speed: .5 });
  else if (st === 'roar') { S.play('Spell_Simple_Enter', { held: true, fade: .3 }); S.pose(.5 + Math.sin(t * 40) * .006); }
  else if (st === 'down') S.play('Death01', { loop: false, fade: .3, speed: .55 });
  else if (B.stag > 0) S.play('Hit_Chest', { loop: false, fade: .1, speed: .8 });
  else if ((st === 'wind' || st === 'hold') && mv) {
    if (S.atk !== SO.atkId) { S.atk = SO.atkId; S.play(mv.c, { held: true, restart: true, fade: .14 }); }
    const wp = st === 'hold' ? 1 : 1 - B.t / a.w;
    S.pose(mv.hit * (.08 + .88 * sgEase(wp)) + (st === 'hold' ? Math.sin(t * 50) * .006 : 0));
  }
  else if (st === 'chan') S.play('Spell_Simple_Idle_Loop', { fade: .2, speed: 1.4 });
  else if (st === 'cast') S.play('Spell_Simple_Idle_Loop', { fade: .15, speed: 1.1 });
  else if (st === 'doom') S.play('Spell_Simple_Idle_Loop', { fade: .2, speed: 2 });
  else if (st === 'dash') S.play('Sprint_Loop', { fade: .08, speed: 1.4 });
  else if (st === 'tired') S.play('Crouch_Idle_Loop', { fade: .25, speed: 1.2 });
  else if (st === 'stalk') S.play('Walk_Formal_Loop', { fade: .3, speed: .7 * soSpeed() });
  else if (st === 'recover' && mv && S.cur === mv.c && S.struck !== SO.atkId) { S.struck = SO.atkId; const A = S.act; A.timeScale = mv.after; A.paused = false; A.time = Math.max(A.time, mv.hit * A.getClip().duration); }
  else if (st === 'recover' && mv && S.cur === mv.c && !S.done()) { /* the swing plays out */ }
  else if (st === 'chase') S.play('Walk_Formal_Loop', { fade: .3, speed: .85 * soSpeed() });
  else if (st === 'idle' && B.back) S.play('Walk_Formal_Loop', { fade: .3, speed: -.6 * soSpeed() });
  else if (st === 'idle' || st === 'recover') S.play('Idle_Loop', { fade: .3, speed: ph >= 3 ? .9 : .55 });
  // the sand in its face burns hotter each phase, and the hourglass turns over when the phase changes
  if (S.phCol !== MR_SAND[ph]) { S.phCol = MR_SAND[ph]; S.sandM.color.set(S.phCol); S.sandM.emissive.set(S.phCol); S.face.color.set(S.phCol); }
  S.sandM.emissiveIntensity = (SO.cine && SO.cine.t < MR_CINE.eyes ? .25 : 1.6 + ph * .3) + Math.sin(t * 3) * .2;
  S.face.intensity = SO.cine && SO.cine.t < MR_CINE.eyes ? .1 : 1.3 + ph * .3;
  if (S.flip > 0) { S.flip = Math.max(0, S.flip - dt * 1.6); S.hgA += dt * Math.PI * 1.6; S.hg.rotation.z = S.hgA; if (!S.flip) { S.hgA = Math.round(S.hgA / Math.PI) * Math.PI; S.hg.rotation.z = S.hgA; } }
  // the clock in its back blazes when it's open to hits; its hands spin with the fight
  const open = !SO.cine && B.state !== 'sleep' && soOpenNow();
  S.openK = (S.openK || 0) + ((open ? 1 : 0) - (S.openK || 0)) * Math.min(1, dt * (open ? 18 : 6));
  S.cm.emissiveIntensity = .35 + S.openK * (2.6 + Math.sin(t * 16) * .4); S.glow.intensity = .6 + S.openK * 2;
  S.ch1.rotation.z -= dt * (.4 + ph * .3); S.ch2.rotation.z -= dt * (4 + ph * 3);
  S.rings.forEach((r, i) => { r.rotation.z += dt * (i ? -1 : 1) * (.25 + ph * .2 + (st === 'chan' ? 2.5 : 0)); });
  // sand trickles from its robe as it moves
  if (st !== 'air' && Math.random() < dt * (st === 'chase' || st === 'stalk' ? 6 : 2)) soBurst(new THREE.Vector3(B.x + (Math.random() - .5) * 3, .2, B.z + (Math.random() - .5) * 3), { tex: 'smoke_03', col: '#a88a5a', n: 1, size: .9, life: 1, speed: .3, grow: .8, add: false, op: .25 });
  if (S.flinch > 0) S.flinch = Math.max(0, S.flinch - dt * 3);
  S.update(dt);
  if (S.flinch > 0) S.bone('spine_02').rotation.x -= Math.sin(S.flinch * Math.PI) * .2;
  // the hall: the floor clock's minute hand counts the fight down, its ring glows on a toll or at Midnight, candles and dust
  const F = SO.mrFloor;
  if (F) {
    F.minH.rotation.y = Math.PI - (SO.cine ? 0 : SO.time / SO_TIME) * Math.PI * 2;
    F.glow = Math.max(st === 'chan' || st === 'doom' ? .8 : 0, F.glow - dt * .8); F.glowRing.material.opacity = F.glow * .8;
  }
  for (const T of SO.torches || []) for (const s of T.sides || []) { s.visible = T.lit > 0; s.scale.setScalar(.32 * T.lit * (1 + Math.sin(t * 11 + T.ph + s.position.x) * .12)); }
  for (const mo of SO.motes || []) { mo.sp.position.y = mo.y + Math.sin(t * .3 + mo.ph) * .6; mo.sp.material.opacity = .25 + Math.sin(t * .8 + mo.ph) * .2; }
  if (SO.mrSun) SO.mrSun.intensity = 1.35 + (SO.mrFloor?.glow || 0) * .5;
  // fading blade arcs (soDraw's own fx list moves the rest)
  SO.fx.forEach(e => { if (e.arc) { e.t -= dt; e.m.material.opacity = Math.max(0, e.t / .3) * .55; if (e.t <= 0) { SO.S.remove(e.m); e.m.geometry.dispose(); e.done = 1; } } });
  SO.fx = SO.fx.filter(e => !e.done);
}

// ---------- its intro: the hall dark, the clock ticking; candles light one by one; it waits, arms folded,
// head bowed; the hourglass in its face turns over and starts to burn; it draws its blade; the great bell tolls ----------
const MR_CINE = { eyes: 3.4, stand: 4.4, roar: 5.5, title: 6.1, bar: 8.1, back: 8.7, end: 9.7 };
function mrCine(C, at) {
  const B = SO.B, S = SO.gs;
  for (const k of [.2, 1.2, 2.2, 3.2, 4.2]) if (at(k)) soSnd('m_tick', B, { vol: .8, rate: .9 });
  (SO.torches || []).forEach((tc, i) => { if (!tc.big && at(.4 + i * .3)) soTorchLight(tc); if (tc.big && at(MR_CINE.eyes - .5 + (i % 2) * .15)) soTorchLight(tc, 1.4); });
  if (at(1.6)) soSnd('m_whisper', B, { vol: .8 });
  if (at(2.4)) soSnd('m_whisper', B);
  if (at(MR_CINE.eyes)) { if (S) { S.flip = 1; const v = new THREE.Vector3().setFromMatrixPosition(S.hg.matrixWorld); soBurst(v, { tex: 'flare_01', col: '#ffd08a', n: 1, size: 2.2, life: .6, speed: 0, grow: 1.2 }); } soSnd('m_freeze', B, { vol: .5, rate: .7 }); soTorchFlare(.5); }
  if (at(MR_CINE.stand)) { B.state = 'wake'; soSnd('m_scrape', B); SO.shake = .3; soDust(B.x, B.z, .8); }
  if (at(MR_CINE.roar)) { B.state = 'roar'; SO.shake = 1.3; soSnd('m_toll', B); soSnd('m_roar', B); soTorchFlare(1.6); if (SO.mrFloor) SO.mrFloor.glow = 1; SO.rings.push({ x: B.x, z: B.z, r: 1, v: 12, mv: MR_MV.roar, m: soRing('#ffe0a0'), cine: 1 }); }
  if (at(MR_CINE.title)) { soSnd('g_title', null); SO.shake = Math.max(SO.shake, .3); }
  if (at(MR_CINE.roar + 1.7)) B.state = 'wake';
}
function mrCineCam(cam) {
  const C = SO.cine, B = SO.B, T = MR_CINE, t = C.t, look = new THREE.Vector3(B.x, 4.2, B.z);
  let pos;
  // a slow walk in from the far side of the hall, through the light, up to its face
  if (t < T.eyes) { const k = t / T.eyes, e = k * k * (3 - 2 * k), a = .7 - e * .9, r = 13 - e * 6.5; pos = new THREE.Vector3(B.x + Math.sin(a) * r, 1.6 + e * 3.3, B.z + Math.cos(a) * r); look.y = 3.2 + e * 2.3; }
  else if (t < T.roar) { const k = Math.min(1, (t - T.eyes) / 1.4), e = k * k * (3 - 2 * k); pos = new THREE.Vector3(B.x + Math.sin(-.2) * (4.6 + e * 3), 5 - e * 2.6, B.z + Math.cos(-.2) * (4.6 + e * 3)); look.y = 5.6 - e * .6; }
  else if (t < T.back) { pos = new THREE.Vector3(B.x - 2.2, 1.1, B.z + 9); look.y = 5; }
  else { const k = Math.min(1, (t - T.back) / (T.end - T.back)), e = k * k * (3 - 2 * k), M = SO.me, C2 = SO.cam;
    const end = new THREE.Vector3(M.x + Math.sin(C2.cy) * Math.cos(C2.cp) * C2.cd + Math.cos(C2.cy) * .9, 1.55 + Math.sin(C2.cp) * C2.cd, M.z + Math.cos(C2.cy) * Math.cos(C2.cp) * C2.cd - Math.sin(C2.cy) * .9);
    pos = new THREE.Vector3(B.x - 2.2, 1.1, B.z + 9).lerp(end, e); look.lerp(new THREE.Vector3(M.x + Math.cos(C2.cy) * .9 - Math.sin(C2.cy) * 14, 2.75 - C2.cp * 6, M.z - Math.sin(C2.cy) * .9 - Math.cos(C2.cy) * 14), e); }
  if (SO.shake > 0) { SO.shake -= .016; pos.x += (Math.random() - .5) * SO.shake * .5; pos.y += (Math.random() - .5) * SO.shake * .5; }
  cam.position.copy(pos); cam.lookAt(look);
}
function mrCineEnd() {
  if (SO.gs) { SO.gs.flip = 0; SO.gs.hgA = Math.PI; SO.gs.hg.rotation.z = Math.PI; }
  soPop('⏱️ Act now: double damage for 20 seconds', 'good');
}
function mrEnd() {
  (SO.mrHands || []).forEach(h => SO.S.remove(h.m)); SO.mrHands = [];
  (SO.mrBlades || []).forEach(b => SO.S.remove(b.g)); SO.mrBlades = []; SO.mrWave = null;
  (SO.mrProm || []).forEach(p => { SO.S.remove(p.fill, p.edge, p.hg); }); SO.mrProm = [];
  (SO.mrEchoes || []).forEach(e => { SO.S.remove(e.g); e.lanes.forEach(l => SO.S.remove(l.m)); }); SO.mrEchoes = [];
  (SO.mrPend || []).forEach(p => { SO.S.remove(p.tm); if (p.g) SO.S.remove(p.g, p.rod); }); SO.mrPend = [];
  if (SO.mrDoom) { SO.mrDoom.safes.forEach(s => SO.S.remove(s.fl, s.edge, s.col)); if (SO.S.fog) SO.S.fog.density = SO.mrDoom.fog; SO.mrDoom = null; }
}

SO_DEFS[MR_KEY] = {
  key: MR_KEY, name: 'Morrow', title: 'Morrow, the Ever-Waiting', lore: 'It promises tomorrow, and tomorrow never comes', felled: 'MORROW FELLED',
  ph: MR_PH, br: 2.3, numY: 5.6, hitb: MR_HITB, snd: { die: 'm_roar' },
  tips: 'It keeps its distance and fights with time: it throws clock hands down the orange lanes (step out or roll), plants hourglasses that burst when their sand runs out, and a blue cone freezes you in time. Crowd it and it swings its blade or vanishes. It\'s exposed while it casts and in the openings after its attacks. Act now: everything you land in the first 20 seconds does double damage, and every 10 seconds you go without a real hit it gets faster. Esc shows the controls.',
  armTxt: '⌛ Guarded: hits barely touch it. Strike when the clock on its back burns, after its attacks',
  scene: mrScene, start: mrStart, step: mrStep, anim: mrAnim, cine: mrCine, cineT: MR_CINE, cineCam: mrCineCam, cineEnd: mrCineEnd, end: mrEnd,
  weakBone: n => n === 'Head',
  // 2.102: exposed while it casts (Promises, Echoes, the Deadline) as well as in the openings after its attacks
  open: () => { const B = SO.B; return B.state === 'down' || B.stag > 0 || B.state === 'tired' || B.state === 'cast' || B.state === 'doom' || (B.state === 'recover' && !B.guard); },
  mult: (o, armour) => !o.dot && SO.time < 20 ? 2 : 1,
  onHit: (armour, o) => { if (!armour && !o.dot) SO.B.idleT = 0; },
  onHurt: (mv) => { if (soPhase() >= 3 && mv.d >= .3 && !SO.over) { SO.me.slow = 2; soPop('🐢 The Last Hour: time slows for you', 'bad'); } },
  tag: open => { const B = SO.B, act = SO.time < 20 ? ` · ACT NOW ×2 (${Math.ceil(20 - SO.time)}s)` : ''; return (B.state === 'cast' ? ' · casting: hit it now' : B.state === 'doom' ? ' · Deadline: get into the light' : B.state === 'tired' ? ' · winded: hit it now' : B.state === 'chan' ? ' · Midnight: jump the hands' : B.state === 'air' ? ' · gone…' : open ? ' · exposed' : ' · guarded') + act; },
  chips: () => [SO.spX > 1 && `⏳ +${Math.round((SO.spX - 1) * 100)}% faster`],
};

// ---------- the boss island in Morrow's week: the Hall of Hours in small, with Morrow waiting in it ----------
function mrIsland(W, g, top, rnd, dead) {
  if (typeof HERO === 'undefined' || !HERO.gltf) {
    if (typeof heroLoad === 'function' && !HERO.fail && !BI_IDLE.wait) { BI_IDLE.wait = 1; heroLoad().then(() => { BI_IDLE.wait = 0; if (HERO.gltf && IS3.house === 'boss' && view === 'islands') { is3bossBuild(); is3draw(); } }); }
    return false;
  }
  const M = (geo, col, x, y, z, p = W, gl) => is3mesh(geo, col, x, y, z, p, gl);
  // the floor ring becomes a clock face: numerals, and hands stopped a minute before midnight
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = M(new THREE.BoxGeometry(.14, .05, .55), '#b08a4e', Math.sin(a) * 4.95, top + .26, Math.cos(a) * 4.95); b.rotation.y = a; b.castShadow = false; }
  const h1 = M(new THREE.BoxGeometry(.22, .05, 2.6), '#8a6a3c', -.05, top + .27, -1.3); h1.rotation.y = .04; h1.castShadow = false;
  const h2 = M(new THREE.BoxGeometry(.14, .05, 4), '#8a6a3c', -.1, top + .28, -2); h2.rotation.y = .03; h2.castShadow = false;
  // a broken arcade of the hall behind it: pillars and three windows still holding the sunset
  const arc = new THREE.Group(); arc.position.set(0, top, 0); arc.rotation.y = Math.PI / 4; W.add(arc);
  const tex = [mrGlassTex('w1'), mrGlassTex('w2'), mrGlassTex('w3')];
  for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 2.6, h = i === 3 ? 3.2 : 5.6; M(new THREE.CylinderGeometry(.3, .36, h, 8), '#4a4046', x, h / 2, -4.3, arc); M(new THREE.BoxGeometry(.8, .3, .8), '#3f363c', x, .15, -4.3, arc); }
  for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 4.2), new THREE.MeshBasicMaterial({ map: tex[i], transparent: true, alphaTest: .5, side: THREE.DoubleSide, toneMapped: false, color: dead ? '#8a8a99' : '#e6cfc0' })); w.position.set((i - 1) * 2.6, 2.9 + (i === 2 ? -.5 : 0), -4.35); if (i === 2) w.scale.y = .75; arc.add(w); }
  M(new THREE.BoxGeometry(5.6, .5, .7), '#3f363c', -1.3, 5.75, -4.3, arc);
  // a stopped grandfather clock and a toppled gear
  const gc = new THREE.Group(); gc.position.set(3.8, 0, -1.8); gc.rotation.y = -.5; arc.add(gc); M(new THREE.BoxGeometry(.7, 2.4, .5), '#3b2a22', 0, 1.2, 0, gc); M(new THREE.CylinderGeometry(.27, .27, .05, 18), '#e9dcbc', 0, 2, .27, gc).rotation.x = Math.PI / 2;
  const gr = mrGear(.7, '#7d6340', arc); gr.position.set(-3.6, .12, -1.2);
  // two candelabras with real light
  const fires = [];
  for (const sx of [-1, 1]) {
    const x = sx * 2.7, z = 1.4; M(new THREE.CylinderGeometry(.04, .06, 1.6, 6), '#241f24', x, .8, z, arc); M(new THREE.BoxGeometry(.7, .05, .05), '#241f24', x, 1.55, z, arc);
    for (const cx of [-.3, .3]) M(new THREE.CylinderGeometry(.05, .05, .2, 6), '#e8dcc0', x + cx, 1.68, z, arc);
    const fl = M(new THREE.ConeGeometry(.1, .3, 6), dead ? '#74c0fc' : '#ff9a3a', x, 1.85, z, arc, true), fl2 = M(new THREE.ConeGeometry(.06, .2, 5), dead ? '#d0ebff' : '#ffe0a0', x, 1.82, z, arc, true);
    let L = null; if (!hxLow()) { L = new THREE.PointLight(dead ? '#74c0fc' : '#ff9a4a', 2.2, 8, 1.6); L.position.set(x, 2.2, z); arc.add(L); }
    fires.push({ fl, fl2, L, ph: rnd() * 9 });
  }
  // Morrow itself, scaled to the island, waiting with its arms folded (or fallen and grey once beaten)
  const S = mrMake(); if (!S) return false;
  S.root.scale.multiplyScalar(.5); S.root.position.set(0, .4, -.6); arc.add(S.root);
  S.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  S.face.distance = 3; S.glow.distance = 2;
  if (dead) {
    S.play('Death01', { loop: false, fade: 0 }); S.act.time = S.act.getClip().duration - .01; S.update(0);
    S.sandM.emissiveIntensity = 0; S.cm.emissiveIntensity = 0; S.face.intensity = 0; S.glow.intensity = 0;
    const h = hsHouse(hsState().id); M(new THREE.CylinderGeometry(.05, .05, 2.6, 5), '#dee2e6', -2, 1.3, 1.6, arc); M(new THREE.BoxGeometry(.9, .6, .04), h?.col || '#ffd43b', -1.55, 2.2, 1.6, arc);
  } else { S.play('Idle_FoldArms_Loop', { speed: .3 }); S.update(0); S.face.intensity = .9; S.cm.emissiveIntensity = .5; }
  if (typeof biIdle === 'function') biIdle(null, { gs: dead ? null : S, fires });
  return true;
}
