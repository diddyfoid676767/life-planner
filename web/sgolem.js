'use strict';
/* Somnus, the Sleeping Colossus (2.87, round 2 stage R3: Golem 2.0).
   Until 2.86 the Golem was a pile of stone blocks tilted by code. Now it's a real rigged body:
   the hero's own skeleton (Quaternius Universal Animation Library, CC0) with carved stone plates
   bound to every bone, so it moves with hand-made animations (walk, punches, overhead slams,
   throws, a roll, a leap, a death) at about three times your size.
   The fight drives the clips: a wind-up plays its clip slowly up to the moment of impact and holds
   there trembling, then the strike snaps through the rest at full speed. Its plates crack and fall
   off as it loses health, and the crystal in its back burns brighter each phase. */

// the stone plates: [from bone, to bone, radius, shape squash x, z]; sizes in the rig's metres (a 1.8 m body)
const SG_SEGS = [
  ['pelvis', 'spine_01', .2, 1.35, 1], ['spine_01', 'spine_02', .21, 1.35, 1], ['spine_02', 'spine_03', .24, 1.45, 1.05],
  ['spine_03', 'neck_01', .31, 1.6, 1.12], ['neck_01', 'Head', .1, 1, 1],
  ['clavicle_l', 'upperarm_l', .15, 1, 1], ['clavicle_r', 'upperarm_r', .15, 1, 1],
  ['upperarm_l', 'lowerarm_l', .15, 1, 1], ['upperarm_r', 'lowerarm_r', .15, 1, 1],
  ['lowerarm_l', 'hand_l', .17, 1, 1], ['lowerarm_r', 'hand_r', .17, 1, 1],
  ['pelvis', 'thigh_l', .17, 1, 1], ['pelvis', 'thigh_r', .17, 1, 1],
  ['thigh_l', 'calf_l', .19, 1, 1], ['thigh_r', 'calf_r', .19, 1, 1],
  ['calf_l', 'foot_l', .17, 1, 1], ['calf_r', 'foot_r', .17, 1, 1],
  ['foot_l', 'ball_l', .13, 1.25, 1], ['foot_r', 'ball_r', .13, 1.25, 1],
];
const SG_SCALE = 2.9;          // about 5 m tall
const SG_STONE = ['#77707f', '#6a6373', '#837c8c', '#5f5968'];
const SG_MOSS = '#5b7a45';

function sgMake() {
  const G = HERO.gltf; if (!G) return null;
  const root = new THREE.Group(), rig = THREE.SkeletonUtils.clone(G.scene), drop = [];
  rig.traverse(m => { if (m.isMesh || m.name.startsWith('W_')) drop.push(m); });
  drop.forEach(m => m.parent?.remove(m));
  root.add(rig); root.scale.setScalar(SG_SCALE); root.updateMatrixWorld(true);
  const bone = n => rig.getObjectByName(n), rnd = seeded('somnus'), mats = [], plates = [];
  const mat = (col, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: col, roughness: .92, metalness: .02, flatShading: true, ...o }); mats.push(m); return m; };
  const stone = SG_STONE.map(c => mat(c)), moss = mat(SG_MOSS, { roughness: 1 });
  const glowM = mat('#66d9e8', { emissive: '#66d9e8', emissiveIntensity: 1.4, roughness: .4 });
  const wpos = n => new THREE.Vector3().setFromMatrixPosition(bone(n).matrixWorld);
  const up = new THREE.Vector3(0, 1, 0), off = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(SG_SCALE);
  // a stone between two points, bound to the first bone (attach keeps where it is in the world)
  const plate = (bn, a, b, r, sx, sz, m, o = {}) => {
    const len = a.distanceTo(b), geo = is3rock(new THREE.DodecahedronGeometry(1, o.detail || 0), rnd, .35);
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true;
    const d = b.clone().sub(a).normalize(), q = new THREE.Quaternion().setFromUnitVectors(up, d);
    mesh.quaternion.copy(q); mesh.position.copy(a).lerp(b, o.at ?? .5);
    mesh.scale.set(r * sx * SG_SCALE, Math.max(len * .62, r * SG_SCALE * .9), r * sz * SG_SCALE).multiplyScalar(o.k || 1);
    mesh.rotateY(rnd() * 6.28);
    bone(bn).attach(mesh); plates.push(mesh); return mesh; // no parent yet, so its position is read as world
  };
  for (const [a, b, r, sx, sz] of SG_SEGS) {
    const A = wpos(a), Bp = wpos(b), m = stone[Math.floor(rnd() * stone.length)];
    plate(a, A, Bp, r, sx, sz, m);
    // a second, smaller stone on the big pieces so they read as stacked boulders, not capsules
    if (r >= .2) plate(a, A, Bp, r * .8, sx * .9, sz * .9, stone[Math.floor(rnd() * stone.length)], { at: .25 + rnd() * .5, k: .85 });
  }
  // huge fists
  const fists = ['l', 'r'].map(s => { const h = wpos('hand_' + s), tip = wpos('middle_02_' + s); return plate('hand_' + s, h, tip, .2, 1.15, 1.05, stone[2], { k: 1.1 }); });
  // shoulder boulders with moss on top
  for (const s of ['l', 'r']) {
    const a = wpos('upperarm_' + s), m = plate('clavicle_' + s, a.clone().add(off(0, -.05, 0)), a.clone().add(off(0, .35, 0)), .2, 1.2, 1.2, stone[1]);
    const mo = plate('clavicle_' + s, a.clone().add(off(0, .22, 0)), a.clone().add(off(0, .34, 0)), .17, 1.1, 1.1, moss, { k: .9 }); mo.scale.y *= .35; void m;
  }
  // a small heavy head sunk between the shoulders, with a brow and glowing eye slits
  const hd = wpos('Head'), head = plate('Head', hd.clone().add(off(0, -.02, 0)), hd.clone().add(off(0, .26, 0)), .13, 1.15, 1.1, stone[2]);
  const brow = plate('Head', hd.clone().add(off(-.12, .15, .1)), hd.clone().add(off(.12, .15, .1)), .05, 1, 1.4, stone[3]);
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(.09 * SG_SCALE, .022 * SG_SCALE, .03 * SG_SCALE), glowM.clone()); mats.push(e.material);
    e.position.copy(hd).add(off(s * .055, .1, .13)); bone('Head').attach(e); return e;
  });
  // moss on the back and the crown, and the crystal growing out of its back (the weak point)
  const s3 = wpos('spine_03'), s2 = wpos('spine_02');
  const backMoss = plate('spine_03', s3.clone().add(off(.05, .05, -.2)), s3.clone().add(off(-.05, .2, -.24)), .2, 1.2, .5, moss); backMoss.scale.z *= .5;
  plate('Head', hd.clone().add(off(0, .2, -.02)), hd.clone().add(off(0, .26, -.04)), .1, 1.1, 1.1, moss, { k: .8 }).scale.y *= .4;
  const crystal = new THREE.Group(), cm = glowM.clone(); mats.push(cm);
  for (const [x, y, z, s, rx, rz] of [[0, 0, 0, 1, -.5, 0], [.09, -.05, .02, .62, -.4, -.5], [-.09, -.04, .02, .55, -.4, .55], [.02, .1, .03, .45, -.9, .2]]) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(.12 * SG_SCALE, 0), cm); c.scale.set(s * .7, s * 1.9, s * .7); c.position.set(x * SG_SCALE, y * SG_SCALE, z * SG_SCALE); c.rotation.set(rx, 0, rz); crystal.add(c);
  }
  crystal.position.copy(s2.clone().lerp(s3, .6)).add(off(0, 0, -.27));
  const glow = new THREE.PointLight('#66d9e8', 1.2, 7, 2); crystal.add(glow); crystal.updateMatrix(); crystal.matrixWorld.copy(crystal.matrix); bone('spine_02').attach(crystal);
  root.updateMatrixWorld(true);

  // the clips: the hero's, played on this rig
  const mixer = new THREE.AnimationMixer(rig), acts = {};
  const clip = n => G.animations.find(a => a.name === n);
  const S = {
    root, rig, bone, mixer, eyes, fists, crystal, cm, glow, plates, head, brow, cur: '', act: null, fallen: 0, flash: 0, flinch: 0,
    // play a clip: looped, or once (clamped at the end), or held (time set by the fight, see pose)
    play(name, { fade = .25, loop = true, speed = 1, restart = false, from = 0, held = false } = {}) {
      const c = clip(name); if (!c) return null;
      let a = acts[name]; if (!a) a = acts[name] = mixer.clipAction(c);
      if (name === S.cur && !restart) { if (!held) a.timeScale = speed; return a; }
      a.reset(); a.setLoop(loop && !held ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop || held; a.enabled = true; a.setEffectiveWeight(1);
      a.timeScale = held ? 0 : speed; a.time = from * c.duration;
      if (S.act && S.act !== a) a.crossFadeFrom(S.act, fade, false); a.play();
      S.cur = name; S.act = a; return a;
    },
    // hold the current clip at a share of its length
    pose(k) { const a = S.act; if (!a) return; a.paused = false; a.timeScale = 0; a.time = Math.max(0, Math.min(.999, k)) * a.getClip().duration; },
    len(name) { return clip(name)?.duration || 1; },
    done() { const a = S.act; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - .03); },
    // plates break off as it loses health: share = how much is gone (0..1)
    crumble(share) {
      const want = Math.floor(share * 9); let fell = 0;
      while (S.fallen < want) {
        const cand = plates.filter(p => p.visible && p.material !== moss && p !== head && p !== brow && !fists.includes(p) && p.scale.x < .55);
        const p = cand[Math.floor(rnd() * cand.length)]; if (!p) break;
        p.visible = false; S.fallen++; fell++;
        S.onFall?.(new THREE.Vector3().setFromMatrixPosition(p.matrixWorld));
      }
      return fell;
    },
    update(dt) { mixer.update(dt); },
    dispose() { root.parent?.remove(root); mixer.stopAllAction(); mats.forEach(m => m.dispose()); root.traverse(o => o.geometry?.dispose()); },
  };
  S.play('Sitting_Idle_Loop');
  return S;
}

// which clip each move uses, where in it the blow lands (share of the clip), and how fast the follow-through plays
const SG_MOVE = {
  punch: { c: 'Punch_Cross', hit: .38, after: 1.4 },
  slam: { c: 'Sword_Attack', hit: .44, after: 1.1 },
  sweep: { c: 'Sword_Regular_B', hit: .42, after: 1.3 },
  shrug: { c: 'Idle_Shield_Break', hit: .3, after: 1.3 },
  wave: { c: 'Spell_Simple_Shoot', hit: .42, after: 1 },
  alarm: { c: 'OverhandThrow', hit: .5, after: 1.2 },
  march: { c: 'Sword_Regular_C', hit: .42, after: 1.5 },
  leap: { c: 'NinjaJump_Start', hit: .9, after: 1 },
  roll: { c: 'Roll', hit: .2, after: 1.6 },
  roar: { c: 'Spell_Simple_Enter', hit: .5, after: .6 },
};
// the wind-up curve: it moves slowly at first and creeps into the last stretch, so the hit snaps
const sgEase = p => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 1.6);
