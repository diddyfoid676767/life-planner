'use strict';
/* Souls fights. 2.76 built the first one (the Snooze Golem in the Snooze Hollow); 2.81
   (feedback stage F4) rebuilt it as a DAMAGE RACE on the new movement core.

   - The goal of an attempt is as much damage as you can on your house's shared weekly bar
     in 3 minutes. One life: dying just ends the attempt early. No practice trials and no
     Easy setting for players; the owner's test mode can start a free test fight.
   - Your character is the KayKit hero (hero.js) with real animations. WASD move, Shift
     sprint, Space jump (clears the low attacks: sweeps, rings and shockwaves), Ctrl or the
     right mouse button roll (i-frames), F block (a block just before a hit is a perfect
     guard), left click light attack (three-hit chain), hold left for a heavy, 1-9 skills,
     R drinks a potion (3 a fight), Esc pauses. No lock-on: the camera is free and every
     attack has a floor warning you can read from any angle. Stamina pays for everything.
   - Damage comes from skill and from your build: level and gear multiply everything a lot
     (soPower), chained hits build a combo (up to +60%), perfect dodges and guards give +30%
     for a few seconds, and the glowing back crystal and its stuck fists after a slam are weak
     points (x1.6). It's stone-armoured while it attacks (half damage), so hit in the openings.
   - The Golem: far more dangerous than 2.76. Wind-ups vary, it chains combos, fakes out,
     holds its swing when it sees you roll early, and shrugs you off when you get greedy.
     Each phase (by time) adds moves: Alarm Barrage, then Sleepwalk (three slams on the
     march), then Wide Awake (Rude Awakening leap, shockwave slams, faster everything).
   - Afterwards: your damage, personal best and the house's top hitters.
   - Bonus fights: 60 Lumen + 60 Ember, 2 a day, once your weekly fights are used up.
   2.87 (round 2 stage R3, Golem 2.0): it's now Somnus, the Sleeping Colossus, a rigged stone body
   with real animations (sgolem.js). Every move is about 60% quicker, it walks and turns fast, and a
   light hit takes about a third of your health (slams and leaps half or more); 2 potions. Rolls cost
   35 stamina, stamina comes back slower, the untouchable window is only 0.2 s, and rolling again
   straight away gets tired. Phases come at 70/40/15% of this fight's own health bar, each with a roar.
   Aim with the crosshair: hold right click to aim over the shoulder; bolts fly straight where it
   points (no homing) and attacks go where the camera faces (no auto-turn). A shot into the crystal
   on its back is a weak-point hit. A Dark Souls style intro, the timer floats over your head, and
   the fight has its own recorded sounds, placed left or right of you. */

const SO_TIME = 180, SO_ARENA = 13.2, SO_BOSS = 'Snooze Golem', SO_ATT_CAP = 5000, SO_POTS = 2, SO_BR = 2.7;
// SO_BOSS stays the old name: it's the key the house fights and your best are saved under. Players see these:
const SO_NAME = 'Somnus', SO_TITLE = 'Somnus, the Sleeping Colossus', SO_LORE = 'An ancient stone giant that drags the world into endless sleep';
const SO_BONUS = { l: 60, e: 60, day: 2 };
const SO_C = {
  jog: 4.6, sprint: 7, acc: 14, dec: 18, air: 3, grav: 20, jump: 7.2, coyote: .12, buffer: .14,
  st: { max: 100, regen: 20, wait: .9, sprint: 18, light: 13, heavy: 28, roll: 35, skill: 12, jump: 8 },
  // a somersault: about 3 m, untouchable for only 0.2 s, then a get-up you can only cancel into an attack.
  // tired: a roll within `tired` s of the last one costs 30% more and goes 20% shorter, stacking up to 3 times
  roll: { speed: 5.3, time: .78, iFrom: .05, iTo: .25, free: .66, tired: .9 }, hold: .28, chain: .55, perfect: .2, guard: .2,
};
// the Golem's moves: wind-up (s, before speed and variation), damage as a share of your health, reach,
// arc (radians either side), low = a jump clears it, ph = first phase it appears in
// 2.87: about 60% quicker wind-ups and two to three times the damage of 2.86
const SO_MV = {
  punch: { n: 'Stone Fist', w: .33, d: .3, r: 4.4, arc: 1.1, open: .5 },
  slam: { n: 'Hammerfall', w: .55, d: .55, r: 4.6, open: 1.25, weak: 1 },
  sweep: { n: 'Earthsweep', w: .38, d: .3, r: 5.6, arc: 1.9, low: 1, open: .55 },
  roll: { n: 'Boulder Roll', w: .5, d: .45, open: 1 },
  wave: { n: 'Slumber Wave', w: .5, d: .18, low: 1, open: .3 },
  shrug: { n: 'Shoulder Crush', w: .22, d: .22, r: 4, open: .4 },
  alarm: { n: 'Falling Stones', w: .55, d: .28, r: 1.9, open: .25, ph: 1 },
  march: { n: 'Tremor March', w: .32, d: .4, r: 3.4, open: 1.1, ph: 2, weak: 1 },
  leap: { n: 'Colossal Leap', w: .65, d: .65, r: 4.2, open: 1.15, ph: 3, weak: 1 },
  shock: { n: 'Shockwave', d: .25, low: 1 },
  roar: { n: 'Roar', d: .12, r: 5 },
};
// phases by this fight's own health bar (at = the share of it left), not by time
const SO_PH = [{ at: 1, n: 'Stirring', sp: 1 }, { at: .7, n: 'Falling Stones', sp: 1.1 }, { at: .4, n: 'Awakened', sp: 1.22 }, { at: .15, n: 'Enraged', sp: 1.4 }];
// this fight's bar: about 110 of your light hits, so a strong run reaches the last phase and a great one fells it
const SO_FHITS = 110;
// each class fights its own way. A light combo is a list of swings (clicks chain them); hold for the heavy.
// c clip, span part of the clip to play, dur seconds, hit times (s), m damage, st stamina, lunge metres,
// bolt: a magic bolt flies at the Golem instead of a melee hit
const SO_COMBO = {
  Knight: { // sword and shield: a steady three-cut chain and an overhead
    light: [{ c: 'Sword_Regular_A', dur: .44, hit: [.2], m: 1 }, { c: 'Sword_Regular_B', dur: .48, hit: [.22], m: 1.1 }, { c: 'Sword_Regular_C', span: [.12, .62], dur: .6, hit: [.3], m: 1.5, lunge: .7 }],
    heavy: { c: 'Sword_Attack', span: [0, .72], dur: 1, hit: [.5], m: 2.7, lunge: 1, reach: 3.1 }, idle: 'Sword_Idle',
  },
  Barbarian: { // the axe: two big, slow, wide swings that hit hard
    light: [{ c: 'Sword_Attack', span: [.05, .66], dur: .72, hit: [.36], m: 1.6, st: 17, reach: 3.1, arc: 1.5, lunge: .6 }, { c: 'Sword_Regular_C', span: [.12, .7], dur: .82, hit: [.32, .5], m: 1.15, st: 17, reach: 3.1, arc: 2.3 }],
    heavy: { c: 'Sword_Regular_C', span: [0, .85], dur: 1.2, hit: [.5, .72], m: 1.9, reach: 3.3, arc: 2.6, lunge: .8 }, idle: 'Sword_Idle',
  },
  Mage: { // the staff: quick bolts, and a charged orb
    light: [{ c: 'Spell_Simple_Shoot', dur: .42, hit: [.2], m: .95, bolt: 1 }, { c: 'Spell_Simple_Shoot', dur: .42, hit: [.2], m: .95, bolt: 1 }, { c: 'Spell_Simple_Shoot', dur: .55, hit: [.28], m: 1.35, bolt: 2 }],
    heavy: { c: 'Spell_Simple_Enter', dur: .9, hit: [.62], m: 2.6, bolt: 3 }, idle: 'Spell_Simple_Idle_Loop',
  },
  Rogue: { // two daggers: four fast cuts, the last one twice
    light: [{ c: 'Sword_Regular_A', dur: .3, hit: [.13], m: .62, st: 9 }, { c: 'Sword_Regular_B', dur: .32, hit: [.14], m: .62, st: 9 }, { c: 'Melee_Hook', dur: .3, hit: [.13], m: .7, st: 9 }, { c: 'Punch_Cross', span: [.1, .7], dur: .42, hit: [.14, .24], m: .6, st: 11, lunge: .5 }],
    heavy: { c: 'Sword_Attack', span: [.05, .7], dur: .78, hit: [.36, .46], m: 1.45, lunge: 1.4 }, idle: 'Sword_Idle',
  },
};
const soCombo = () => SO_COMBO[SO.outfit] || SO_COMBO.Knight;
let SO = null;
function soGolemWeek() { return hsBoss(mondayOf(today())).n === SO_BOSS && bossWeek() !== 'rest'; }
const soTestOk = () => typeof solisDevOn === 'function' && solisDevOn();
const soBonusLeft = () => { const st = ftState(); return Math.max(0, SO_BONUS.day - ((st.bonus || {})[today()] || 0)); };
function soCanBonus() { const w = cdWallet(), a = ftAttempts(); return soGolemWeek() && !!hsState().id && !a.left && !a.rest && soBonusLeft() > 0 && w.lumen >= SO_BONUS.l && w.ember >= SO_BONUS.e; }
// how hard you hit: level and gear matter a lot (a level 1 with no gear does a small fraction of a geared one)
function soPower() {
  const lv = typeof solisLevel === 'function' ? solisLevel().n : 1, st = ftState();
  const gp = Object.values(st.wear || {}).reduce((a, id) => { const p = st.gear.find(x => x.id === id); return a + (p ? [1, 2, 3.5, 5][FT_RAR.findIndex(r => r[0] === p.r)] || 1 : 0); }, 0);
  return (1 + .12 * (lv - 1)) * (1 + .05 * gp);
}

// ---------- start, end ----------
function soOpen(kind) {
  if (SO) return;
  if (kind === 'trial') kind = 'test';
  if (kind === 'test' && !soTestOk()) return;
  if (kind === 'house' && (!soGolemWeek() || !hsState().id || !ftAttempts().left)) { toast('No fights left', 'Your weekly fights are used up.'); return; }
  if (kind === 'bonus' && !soCanBonus()) { toast('No bonus fight', `Bonus fights are for when your weekly fights are used up: ${SO_BONUS.day} a day, ${SO_BONUS.l} Lumen and ${SO_BONUS.e} Ember each.`); return; }
  if (!need3D()) { toast('Loading 3D…', 'Try again in a moment.'); return; }
  if (!webglOK()) { toast('No 3D here', 'This computer can\'t draw the Souls fight.'); return; }
  heroLoad();
  SO = { kind, intro: true };
  soOverlay(); soIntroDraw();
}
async function soStart() {
  const kind = SO.kind, house = kind === 'house' || kind === 'bonus', wk = mondayOf(today());
  if (!HERO.gltf && !HERO.fail) { const b = document.querySelector('[data-so="go"]'); if (b) { b.disabled = true; b.textContent = 'Getting ready…'; } await heroLoad(); if (!SO) return; }
  const P = ftMe(house);
  let shared = null;
  if (kind === 'house') { const st = ftState(); st.att[today()] = (st.att[today()] || 0) + 1; save(); } // taken up front, like the quick fight
  if (kind === 'bonus') {
    if (!soCanBonus()) { soClose(); return; }
    const st = ftState(), got = ftTake(SO_BONUS.l, SO_BONUS.e);
    st.bonus = st.bonus || {}; for (const d in st.bonus) if (d < addDays(today(), -7)) delete st.bonus[d];
    st.bonus[today()] = (st.bonus[today()] || 0) + 1; save();
    if (got.l !== SO_BONUS.l || got.e !== SO_BONUS.e) console.warn('bonus fight charged', got);
  }
  if (house) { const f = hsFight(hsState().id); shared = { hp: f.hp, left: f.left }; }
  const base = 3 + ((P.s || {}).str || 5) * .04 + ((P.s || {}).agi || 5) * .02, pow = soPower();
  Object.assign(SO, { intro: false, P, wk, shared, dealt: 0, time: 0, over: false, paused: false, keys: {}, hotCd: {}, nums: [], fx: [], tele: [], projs: [], rings: [], drops: [], parts: [], stop: 0, kick: 0, pow,
    fhp: Math.round(base * pow * SO_FHITS), aim: false, aimK: 0, atkId: 0,
    stats: { hits: 0, weak: 0, perfect: 0, guards: 0, combo: 0, pots: 0, hurt: 0 },
    me: { x: 0, z: 7, y: 0, vx: 0, vz: 0, vy: 0, ground: true, air: 0, jumpBuf: 0, face: Math.PI, sp: 0, st: SO_C.st.max, rest: 0, act: null, actT: 0, iFrom: -1, iTo: -1, rollAt: -9, blockAt: -9, block: false,
      emp: 0, buff: 1, rally: 0, reveal: 0, drowsy: 0, combo: 0, comboT: 0, chain: 0, chainT: 0, pots: SO_POTS, hold: null },
    B: { x: 0, z: -5, y: 0, face: 0, state: 'sleep', t: 1.4, atk: null, queue: [], cool: {}, stag: 0, greed: [], mark: 0, dot: [], vy: 0, stuck: 0 },
    cam: { cy: 0, cp: .32, cd: 6.4 }, t: performance.now(), acc: 0 });
  document.querySelector('#soov .so-intro')?.remove();
  soScene();
  // the intro: it sleeps, wakes, stands and roars, then its name. Skippable once you've seen it.
  SO.cine = { t: 0, skip: !!ftState().soIntroSeen };
  soHudDraw(); soCineDraw(); soLoop();
}
function soEnd(how) {
  if (SO.over) return; SO.over = true; SO.aim = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const out = [], dealt = Math.round(SO.dealt), st = ftState();
  let pb = null;
  if (SO.kind === 'house' || SO.kind === 'bonus') {
    const F = { kind: 'house', dealt, bossName: SO_NAME, cap: SO_ATT_CAP, souls: 1 };
    ftEnd(F, how === 'dead' ? 'down' : how === 'felled' ? 'felled' : 'time'); out.push(...F.res.out);
    st.soPb = st.soPb || {}; const old = st.soPb[SO_BOSS] || 0; pb = { old, now: Math.max(old, dealt), isNew: dealt > old && dealt > 0 };
    st.soPb[SO_BOSS] = pb.now; save();
  } else out.push('Test fight: no attempt used, nothing added to the bar, no reward.');
  SO.res = { how, out, pb };
  if (SO.H) SO.H.play(how === 'dead' ? 'Death_A' : 'Cheer', { loop: how !== 'dead', fade: .2 });
  if (how === 'felled') { SO.B.state = 'down'; SO.B.t = 0; soClearTele(); soSnd('g_roar', SO.B, { rate: .8 }); }
  setTimeout(() => SO && soHudDraw(), how === 'dead' ? 1600 : how === 'felled' ? 2600 : 300);
  if (how === 'dead') soSnd('g_pain', SO.me, { vol: 1.2 });
}
function soClose() {
  if (!SO) return;
  cancelAnimationFrame(SO.raf); if (document.pointerLockElement) document.exitPointerLock();
  if (SO.H) SO.H.dispose(); if (SO.gs) SO.gs.dispose();
  if (SO.S) SO.S.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
  if (SO.R) { SO.R.dispose(); SO.R.forceContextLoss?.(); }
  document.getElementById('soov')?.remove(); document.body.classList.remove('souls-on'); SO = null; render();
}

// ---------- the arena: the Snooze Hollow ----------
function soScene() {
  const R = SO.R = fxRenderer(), S = SO.S = new THREE.Scene(), low = hxLow();
  SO.canvas = R.domElement; SO.canvas.className = 'socanvas'; document.getElementById('soov').prepend(SO.canvas);
  S.background = new THREE.Color('#0b0a1a'); S.fog = new THREE.Fog('#0b0a1a', 24, 62);
  SO.cam3 = new THREE.PerspectiveCamera(58, 1, .1, 200);
  S.add(new THREE.HemisphereLight('#8f98d9', '#2a2238', .7));
  const moon = new THREE.DirectionalLight('#b9c6ff', 1.05); moon.position.set(-8, 26, 10); moon.castShadow = !low; moon.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 }); S.add(moon);
  const W = new THREE.Group(); S.add(W); const rnd = seeded('snooze-hollow');
  const m = (geo, col, x, y, z, glow) => is3mesh(geo, col, x, y, z, W, glow);
  const fl = m(new THREE.CylinderGeometry(16, 16.5, .6, 40), '#4a4458', 0, -.3, 0); fl.receiveShadow = true;
  const rune = m(new THREE.TorusGeometry(SO_ARENA - .4, .06, 4, 64), '#66d9e8', 0, .03, 0, true); rune.rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) { const c = m(new THREE.CircleGeometry(.6 + rnd() * 1.2, 7), '#57506a', (rnd() - .5) * 20, .01, (rnd() - .5) * 20); c.rotation.x = -Math.PI / 2; c.castShadow = false; }
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, r = 18.2 + rnd() * 2, h = 4 + rnd() * 6, rk = m(is3rock(new THREE.DodecahedronGeometry(2.4 + rnd() * 1.4, 0), rnd, .25), rnd() < .5 ? '#3f3650' : '#352d44', Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); rk.scale.set(1, h / 3.5, 1); rk.rotation.y = rnd() * 6; }
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, r = 14.2 + rnd() * 1.2, h = .8 + rnd() * 1.6, cr = m(new THREE.ConeGeometry(.3 + rnd() * .25, h, 5), rnd() < .6 ? '#66d9e8' : '#9775fa', Math.cos(a) * r, h / 2, Math.sin(a) * r, true); cr.rotation.set((rnd() - .5) * .6, 0, (rnd() - .5) * .6); }
  // 2.87: a ruined, moss-grown stone hall. Its stone bed (a dais under a broken arch) is where it has slept for an age
  const dais = new THREE.Group(); dais.position.set(0, 0, -15.6); W.add(dais);
  is3mesh(is3rock(new THREE.BoxGeometry(11, 1.4, 6, 3, 1, 2), rnd, .08), '#5d566b', 0, .7, 0, dais); is3mesh(new THREE.BoxGeometry(10.4, .25, 5.2), '#4f6b3e', 0, 1.45, .2, dais);
  for (const x of [-5, 5]) { is3mesh(new THREE.CylinderGeometry(.75, .9, 9, 8), '#5a5368', x, 4.5, -2.4, dais); }
  const lintel = is3mesh(new THREE.BoxGeometry(6.5, 1.1, 1.4), '#5a5368', -2, 9.2, -2.4, dais); lintel.rotation.z = -.12;
  // broken pillars around the edge, two fallen across the floor, mossy rubble
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, r = 15.4, h = 2.5 + rnd() * 6; if (Math.abs(Math.sin(a) + 1) < .25) continue; const p = m(new THREE.CylinderGeometry(.7, .85, h, 8), '#5a5368', Math.cos(a) * r, h / 2, Math.sin(a) * r); p.rotation.z = (rnd() - .5) * .08; const t = m(new THREE.CylinderGeometry(.74, .74, .22, 8), '#4f6b3e', Math.cos(a) * r, h + .05, Math.sin(a) * r); void t; }
  for (const [x, z, r] of [[-9.5, 4, .5], [8.8, -5.5, 2.2]]) { const p = m(new THREE.CylinderGeometry(.6, .7, 5.5, 8), '#5f586e', x, .6, z); p.rotation.set(Math.PI / 2, 0, r); }
  for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = 8 + rnd() * 6.5, k = .25 + rnd() * .6, c = m(is3rock(new THREE.DodecahedronGeometry(k, 0), rnd, .3), rnd() < .3 ? '#4f6b3e' : '#5d566b', Math.cos(a) * r, k * .4, Math.sin(a) * r); c.rotation.y = rnd() * 6; }
  for (let i = 0; i < 7; i++) { const c = m(new THREE.CircleGeometry(1.2 + rnd() * 2.2, 9), '#3f5232', (rnd() - .5) * 22, .012, (rnd() - .5) * 22); c.rotation.x = -Math.PI / 2; c.castShadow = false; }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 6, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#b9c6ff', transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(-3, 14, 3); beam.rotation.z = .25; S.add(beam);
  for (const [x, z] of [[-11, -9], [11, -9]]) { const t = new THREE.PointLight('#ff922b', 1.1, 16, 1.6); t.position.set(x, 3.2, z); S.add(t); m(new THREE.CylinderGeometry(.14, .1, 2.6, 6), '#495057', x, 1.3, z); m(new THREE.ConeGeometry(.24, .6, 5), '#ff922b', x, 2.9, z, true); }
  // Somnus: the rigged stone body (sgolem.js); the old block golem only if the animations didn't load
  SO.gs = typeof sgMake === 'function' ? sgMake() : null;
  if (SO.gs) { SO.gs.onFall = at => { soBurst(at, { tex: 'dirt_02', col: '#8a8398', n: 6, size: .7, life: 1, speed: 4, grav: 16, up: .3, add: false, op: .95 }); soSnd('g_crumble', at); }; SO.gs.play('Crouch_Idle_Loop', { speed: .45 }); SO.gs.eyes.forEach(e => e.material.emissiveIntensity = 0); }
  SO.gol = SO.gs || soGolem(); S.add(SO.gol.root);
  // you: the KayKit hero in your class outfit, with your head and cosmetics
  const d = youAvData(pfSpec()), ci = typeof cdClassInfo === 'function' ? cdClassInfo() : null, outfit = heroOutfitOf(ci?.id);
  SO.outfit = outfit;
  SO.H = heroMake({ spec: d.spec, gear: d.gear || {}, cls: d.cls || '', outfit, props: true, scale: .78 });
  if (SO.H) SO.trail = soTrail();
  if (SO.H) S.add(SO.H.root);
  else { const fig = av3figure({ ...d.spec, force: '' }, d.gear || {}, d.cls || ''); fig.scale.multiplyScalar(.85); SO.fig = new THREE.Group(); SO.fig.add(fig); S.add(SO.fig); }
  // your shadow blob, so you can judge jumps
  SO.blob = new THREE.Mesh(new THREE.CircleGeometry(.45, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .35, depthWrite: false })); SO.blob.rotation.x = -Math.PI / 2; S.add(SO.blob);
  soResize();
}
// the Snooze Golem: body, head, arms with fists, legs, and the glowing crystal on its back (a weak point)
function soGolem() {
  const root = new THREE.Group(), body = new THREE.Group(), rk = (r, s) => is3rock(new THREE.DodecahedronGeometry(r, 0), seeded(s), .2);
  root.add(body); body.position.y = 2.6; root.scale.setScalar(1.15);
  const torso = is3mesh(rk(1.5, 'g-t'), '#868e96', 0, 0, 0, body); torso.scale.set(1.25, 1, .95);
  const head = new THREE.Group(); head.position.set(0, 1.65, .15); body.add(head);
  is3mesh(rk(.8, 'g-h'), '#adb5bd', 0, .1, 0, head);
  const eyes = []; for (const s of [-1, 1]) eyes.push(is3mesh(new THREE.BoxGeometry(.32, .08, .08), '#66d9e8', s * .3, .2, .74, head, true));
  const cap = is3mesh(new THREE.ConeGeometry(.65, 1.2, 7), '#4263eb', .15, .95, 0, head); cap.rotation.z = -.5; is3mesh(new THREE.SphereGeometry(.17, 8, 6), '#ffffff', .72, 1.2, 0, head);
  const crystal = is3mesh(new THREE.OctahedronGeometry(.62, 0), '#66d9e8', 0, .35, -1.35, body, true); crystal.scale.set(1, 1.5, .7);
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 2, .55, 0); body.add(sh);
    is3mesh(new THREE.DodecahedronGeometry(.7, 0), '#868e96', 0, 0, 0, sh);
    is3mesh(new THREE.DodecahedronGeometry(.55, 0), '#7c858d', s * .15, -1.05, .1, sh);
    const fist = is3mesh(new THREE.DodecahedronGeometry(.72, 0), '#6c757d', s * .2, -2.05, .2, sh);
    return { sh, fist, s };
  });
  const legs = [-1, 1].map(s => { const L = new THREE.Group(); L.position.set(s * .8, -1.2, 0); body.add(L); is3mesh(new THREE.DodecahedronGeometry(.65, 0), '#6c757d', 0, -.7, 0, L); return L; });
  const zz = []; for (let i = 0; i < 3; i++) { const z = is3mesh(new THREE.TorusGeometry(.18 + i * .05, .05, 4, 4), '#66d9e8', 0, 0, 0, root, true); z.visible = false; zz.push(z); }
  root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; o.userData.glow = o.material.emissive.getHex() !== 0; } });
  return { root, body, head, eyes, arms, legs, zz, crystal, flash: 0 };
}
function soResize() {
  if (!SO?.R) return; const c = SO.canvas.parentNode, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
  SO.R.setSize(w, h, false); SO.cam3.aspect = w / h; SO.cam3.updateProjectionMatrix();
}

// ---------- the loop: fixed 60 Hz steps, drawn every frame ----------
function soLoop() {
  const tick = now => {
    if (!SO || !SO.R) return;
    const dt = Math.min(.25, (now - SO.t) / 1000); SO.t = now;
    // hit-stop: a landed hit freezes the fight for a few frames so it feels solid
    const frozen = SO.stop > 0; if (frozen) SO.stop -= dt;
    if (SO.cine) soCineStep(dt);
    else if (!SO.paused && !SO.intro && !frozen) { SO.acc += dt; while (SO.acc >= 1 / 60) { SO.acc -= 1 / 60; if (!SO.over) soStep(1 / 60); else soStepDead(1 / 60); } }
    soDraw(now / 1000, SO.paused ? 0 : frozen ? dt * .04 : dt);
    SO.raf = requestAnimationFrame(tick);
  };
  SO.raf = requestAnimationFrame(tick);
}
// this fight's bar: how much of it is left (0..1), and the phase that gives
const soLeft = () => SO.fhp ? Math.max(0, 1 - SO.dealt / SO.fhp) : 1;
const soPhase = () => { const l = soLeft(); let p = 0; for (let i = 1; i < SO_PH.length; i++) if (l < SO_PH[i].at) p = i; return p; };
// the way the camera (and so the crosshair) faces, as a facing angle
const soCamFace = () => SO.cam.cy + Math.PI;
const soSpeed = () => SO_PH[soPhase()].sp;
function soPct() { const s = SO.shared; return s ? Math.max(0, (s.left - SO.dealt) / s.hp) : 1; }
const soDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const soAng = d => Math.atan2(Math.sin(d), Math.cos(d));
const soRolling = () => SO.me.act?.k === 'roll';
const soIfr = () => SO.time >= SO.me.iFrom && SO.time <= SO.me.iTo;
function soStep(dt) {
  const M = SO.me, B = SO.B, K = SO.keys, P = SO.P, C = SO_C;
  SO.time += dt; if (SO.time >= SO_TIME) { soEnd('time'); return; }
  const sec = Math.floor(SO.time) !== Math.floor(SO.time - dt);
  for (const k of ['drowsy', 'emp', 'rally']) if (M[k] > 0) M[k] -= dt;
  if (M.comboT > 0) { M.comboT -= dt; if (M.comboT <= 0) M.combo = 0; }
  if (M.chainT > 0) { M.chainT -= dt; if (M.chainT <= 0) M.chain = 0; }
  if (sec && Math.floor(SO.time) % 4 === 0) { if (P.g?.rg) soHeal(P.g.rg, ''); if (P.cls === 'bard') soHeal(P.max * .02, ''); }
  // holding the left button long enough turns it into a heavy
  if (M.hold != null && SO.time - M.hold >= C.hold && !M.act) { M.hold = null; soAct('heavy'); }
  if (M.act) { M.actT += dt; soActStep(M, dt); }
  // block: hold F, facing roughly anywhere (the shield covers your front)
  const wantBlock = !!K.f && (!M.act || M.act.k === 'blockhit') && M.ground && M.st > 0;
  if (wantBlock && !M.block) M.blockAt = SO.time;
  M.block = wantBlock;
  // movement, relative to the camera
  const fw = (K.w ? 1 : 0) - (K.s ? 1 : 0), stf = (K.d ? 1 : 0) - (K.a ? 1 : 0), cy = SO.cam.cy;
  let mx = 0, mz = 0;
  if (fw || stf) { const c = Math.cos(cy), s = Math.sin(cy); mx = -s * fw + c * stf; mz = -c * fw - s * stf; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
  const moving = !!(fw || stf), busy = M.act && M.act.k !== 'roll';
  const sprint = moving && K.shift && !M.block && !busy && !SO.aim && M.st > 1 && M.ground;
  const top = (M.block ? 1.8 : sprint ? C.sprint : SO.aim ? C.jog * .55 : C.jog) * (M.drowsy > 0 ? .65 : 1) * (busy ? (M.act.k === 'potion' ? .2 : .15) : 1);
  if (sprint) { M.st -= C.st.sprint * dt; M.rest = C.st.wait; }
  M.rest = Math.max(0, M.rest - dt);
  if (M.rest <= 0 && !M.block && !M.act) M.st = Math.min(C.st.max, M.st + C.st.regen * (M.drowsy > 0 ? .5 : 1) * dt);
  if (M.act?.k === 'roll') { const p = M.actT / C.roll.time, v = C.roll.speed * (M.act.far || 1) * (p < .5 ? 1 : Math.max(0, 1 - (p - .5) / .3)); M.vx = M.act.dx * v; M.vz = M.act.dz * v; }
  else {
    const k = !M.ground ? C.air : moving ? C.acc : C.dec, tx = mx * top, tz = mz * top;
    M.vx += (tx - M.vx) * Math.min(1, dt * k); M.vz += (tz - M.vz) * Math.min(1, dt * k);
  }
  M.x += M.vx * dt; M.z += M.vz * dt; M.sp = Math.hypot(M.vx, M.vz);
  if (SO.aim && M.act?.k !== 'roll') M.face = soCamFace(); // aiming: you face where the crosshair points and strafe
  else if (moving && !busy && M.act?.k !== 'roll') M.face += soAng(Math.atan2(mx, mz) - M.face) * Math.min(1, dt * (M.ground ? 13 : 6));
  // jumping
  M.jumpBuf = Math.max(0, M.jumpBuf - dt);
  if (M.ground) M.air = 0; else M.air += dt;
  if (M.jumpBuf > 0 && (M.ground || M.air < C.coyote) && !M.act && M.st >= C.st.jump * .5) { M.vy = C.jump; M.ground = false; M.air = C.coyote; M.jumpBuf = 0; M.st -= C.st.jump; M.rest = C.st.wait; soSnd('g_armour', M, { gap: 150 }); }
  if (!M.ground) { M.vy -= C.grav * dt; M.y += M.vy * dt; if (M.y <= 0) { M.y = 0; M.vy = 0; M.ground = true; M.land = .25; soSnd('g_armour', M, { gap: 150 }); } }
  if (M.land > 0) M.land -= dt;
  // the arena edge and the Golem's body push you back
  const r = Math.hypot(M.x, M.z); if (r > SO_ARENA) { M.x *= SO_ARENA / r; M.z *= SO_ARENA / r; }
  const db = soDist(M, B); if (db < SO_BR && B.state !== 'roll' && B.state !== 'air' && M.y < 2) { const k = SO_BR / Math.max(.01, db); M.x = B.x + (M.x - B.x) * k; M.z = B.z + (M.z - B.z) * k; }
  soBossStep(dt);
  soHazStep(dt);
  soProjStep(dt);
  if (P.hp <= 0) soEnd('dead');
  else if (SO.dealt >= SO.fhp) soEnd('felled'); // you brought this fight's bar down
  else if (SO.shared && SO.shared.left > 0 && SO.shared.left - SO.dealt <= 0)  { /* a bar already beaten this week: the run still counts for your best */ B.state = 'down'; B.t = 0; soClearTele(); soEnd('win'); }
}
function soStepDead(dt) { const B = SO.B; if (B.state === 'down') B.t += dt; soProjStep(dt); }

// ---------- your attacks ----------
const SO_ACTS = {
  light: { st: SO_C.st.light, dur: .48, hit: [.2], reach: 2.6, arc: 1.25, m: 1 },
  heavy: { st: SO_C.st.heavy, dur: 1, hit: [.55], reach: 3, arc: 1.5, m: 2.7 },
  roll: { st: SO_C.st.roll, dur: SO_C.roll.time },
  potion: { dur: 1.3 }, // you stand still and drink: a hit before it goes down spills it
};
function soAct(k) {
  const M = SO.me, A = SO_ACTS[k]; if (!SO || SO.over || SO.paused || !A) return;
  // you can roll out of an attack's tail, and attack or roll again from a roll's get-up
  // 2.87: a roll's get-up can only turn into an attack, not straight into another roll
  const cancel = M.act && ((k === 'roll' && M.act.k !== 'roll' && M.act.k !== 'stagger' && M.act.k !== 'potion' && M.actT > .12) || (M.act.k === 'roll' && k !== 'potion' && k !== 'roll' && M.actT > SO_C.roll.free));
  if (M.act && !cancel) return;
  if (k !== 'potion' && M.st <= 0) { soPop('😮‍💨 No stamina', 'bad'); return; }
  if (k === 'roll' && !M.ground) return;
  const CB = soCombo(), def = k === 'light' ? CB.light[M.chain % CB.light.length] : k === 'heavy' ? CB.heavy : null;
  // rolling again straight after a roll gets tired: dearer, shorter, a shorter safe window
  const tired = k === 'roll' && SO.time - (M.rollAt + SO_C.roll.time) < SO_C.roll.tired ? Math.min(3, (M.tired || 0) + 1) : 0;
  const st = def?.st ? def.st * (k === 'heavy' ? 2 : 1) : A.st * (k === 'roll' ? 1 + .3 * tired : 1);
  if (st) { M.st -= st; M.rest = SO_C.st.wait; }
  M.act = { k, done: {} }; M.actT = 0;
  if (def) { M.act.def = { reach: k === 'heavy' ? 3 : 2.6, arc: k === 'heavy' ? 1.5 : 1.25, ...def }; if (def.bolt) M.act.def.reach = 99; }
  if (k === 'roll') {
    const K = SO.keys, fw = (K.w ? 1 : 0) - (K.s ? 1 : 0), stf = (K.d ? 1 : 0) - (K.a ? 1 : 0), cy = SO.cam.cy;
    let dx = Math.sin(M.face), dz = Math.cos(M.face);
    if (fw || stf) { const c = Math.cos(cy), s = Math.sin(cy); dx = -s * fw + c * stf; dz = -c * fw - s * stf; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    M.tired = tired; M.act.far = 1 - .2 * tired;
    M.act.dx = dx; M.act.dz = dz; M.face = Math.atan2(dx, dz); M.rollAt = SO.time; M.iFrom = SO.time + SO_C.roll.iFrom; M.iTo = SO.time + SO_C.roll.iFrom + (SO_C.roll.iTo - SO_C.roll.iFrom) * (1 - .25 * tired);
    if (tired && !SO.tiredSeen) { SO.tiredSeen = 1; soPop('😮‍💨 Rolling again so soon tires you: shorter and dearer', 'bad'); }
    if (typeof sfx === 'function') sfx('roll', { gap: 60 }); soSnd('g_armour', M, { gap: 60 });
  } else if (k === 'light' || k === 'heavy') {
    if (k === 'light') { const L = CB.light.length; M.act.n = M.chain % L; M.chain++; M.chainT = M.act.n === L - 1 ? 0 : def.dur + SO_C.chain; if (M.act.n === L - 1) M.chain = 0; }
    M.face = soCamFace(); // you strike where the camera faces: no turning towards the Golem for you
    if (def.lunge && soDist(M, SO.B) > SO_BR + 1) M.lunge = { left: def.lunge, t: .18 };
    SO.trail?.reset();
  }
  else if (k === 'potion') M.act.healed = 0;
}
function soPotion() {
  const M = SO.me; if (!soLive() || SO.paused || M.act || !M.ground) return;
  if (M.pots <= 0) { soPop('🧪 No potions left', 'bad'); return; }
  M.pots--; SO.stats.pots++; soAct('potion');
}
function soActStep(M, dt) {
  const a = M.act, A = a.def || SO_ACTS[a.k];
  if (M.lunge && M.lunge.left > 0) { const v = Math.min(M.lunge.left, M.lunge.left / M.lunge.t * dt * 1.6); M.lunge.left -= v; M.x += Math.sin(M.face) * v; M.z += Math.cos(M.face) * v; }
  if (a.k === 'potion' && !a.healed && M.actT >= .85) { a.healed = 1; soHeal(SO.P.max * .4, '🧪 Potion'); if (typeof sfx === 'function') sfx('pop'); }
  if (A.hit) A.hit.forEach((t, i) => { if (!a.done[i] && M.actT >= t) { a.done[i] = 1; soSwing(a, A); } });
  const dur = A.dur || .5;
  if (M.actT >= dur) M.act = null;
}
function soSwing(a, A) {
  const M = SO.me, B = SO.B, d = soDist(M, B) - SO_BR + .3, ang = Math.abs(soAng(Math.atan2(B.x - M.x, B.z - M.z) - M.face));
  const s = SO.P.s, base = (3 + (s.str || 5) * .04 + (s.agi || 5) * .02) * (A.m || 1);
  if (A.bolt) { soBolt({ n: base * SO.pow, size: A.bolt, school: 'staff' }); return; }
  soSnd('g_swish', M, { gap: 40 }); if (a.k === 'heavy') soSnd('g_grunt', M, { gap: 300 });
  if (d > A.reach || ang > A.arc || B.state === 'air' || M.y > 1.6) return;
  if (a.sk) { soSkillHit(a.sk); soImpact(a.k === 'heavy' ? 1.4 : 1); return; }
  soHit(base * SO.pow, { label: a.k, base: true });
  soImpact(a.k === 'heavy' ? 1.6 : (A.m || 1) > 1.4 ? 1.25 : 1);
}
// is a hit on a weak point? the back crystal (you're behind it) or its fists while they're stuck in the floor
function soWeakSpot() {
  const M = SO.me, B = SO.B, behind = Math.abs(soAng(Math.atan2(M.x - B.x, M.z - B.z) - B.face)) > 2.1;
  return B.stuck > 0 || behind;
}
// one hit on the Golem, with every multiplier
function soHit(n, o = {}) {
  const B = SO.B, M = SO.me, P = SO.P, g = P.g || {};
  let mult = 1;
  const sk = o.sk; if (sk) mult *= 1 + (sk.k === 'spell' ? (g.sp || 0) + (P.cls === 'sage' ? .15 : 0) : (g.mv || 0) + (P.cls === 'striker' ? .15 : 0));
  let weak = !o.dot && (o.weakHit ?? soWeakSpot());
  if (M.reveal > 0 && !o.dot) { weak = true; M.reveal--; }
  if (weak) mult *= 1.6 + (g.wk || 0);
  const crit = !o.dot && Math.random() < (g.cr || 0) + .05; if (crit) mult *= 1.5;
  // stone armour while it attacks: hit it in the openings
  const armour = !o.dot && (B.state === 'wind' || B.state === 'hold' || B.state === 'roll' || B.state === 'march' || B.state === 'roar'); if (armour) mult *= .5;
  if (B.mark > 0) mult *= 1.25;
  if (M.emp > 0) mult *= 1.3;
  if (M.rally > 0) mult *= 1.3;
  if (M.buff > 1 && !o.dot) { mult *= M.buff; M.buff = 1; }
  if (!o.dot) { M.combo++; M.comboT = 3.5; SO.stats.combo = Math.max(SO.stats.combo, M.combo); }
  mult *= 1 + Math.min(.6, Math.max(0, M.combo - 1) * .04);
  n = Math.max(1, Math.round(n * mult));
  SO.dealt += n; SO.stats.hits++; if (weak) SO.stats.weak++;
  if (!o.dot) B.greed.push(SO.time);
  SO.gol.flash = .12; if (weak) SO.gol.flinch = 1;
  soNum(n, weak ? 'weak' : crit ? 'crit' : armour ? 'arm' : '');
  if (weak && !SO.weakSeen) { SO.weakSeen = 1; soPop('💥 Weak point!', 'good'); }
  if (!o.dot) soSnd(crit || weak ? 'g_crack' : 'g_clang', B, { gap: 30, vol: armour ? .7 : 1 });
  return n;
}
function soHeal(n, label) { const P = SO.P, got = Math.min(Math.round(n), P.max - P.hp); P.hp += got; if (label && got) soPop(`${label} +${got}`, 'good'); }

// ---------- the hotbar: every equipped skill ----------
const soSkCd = s => 4 + (s.cd || 0) * 3; // seconds
function soSkill(i) {
  const s = SO?.P?.sk[i], M = SO?.me; if (!s || SO.over || SO.paused || M.act) return;
  if ((SO.hotCd[s.id] || 0) > SO.time) return;
  if (M.st < SO_C.st.skill) { soPop('😮‍💨 No stamina', 'bad'); return; }
  M.st -= SO_C.st.skill; M.rest = SO_C.st.wait; SO.hotCd[s.id] = SO.time + soSkCd(s);
  const P = SO.P, stat = P.s[s.st] || 5;
  if (s.fx === 'heal') { soHeal(P.max * s.pw / 100 * (.7 + stat / 150) * .6, `${s.e} ${s.n}`); if (s.cleanse) M.drowsy = 0; }
  else if (s.fx === 'shield') { const n = Math.round(P.max * s.pw / 100 * (.7 + stat / 150) * .6); P.shield = (P.shield || 0) + n; soPop(`${s.e} ${s.n} +${n} shield`, 'good'); }
  else if (s.fx === 'buff') { M.buff = 2; soPop(`${s.e} Next hit ×2`, 'good'); }
  else if (s.fx === 'rally') { M.rally = 10; soPop(`${s.e} Rally: +30% for 10 s`, 'good'); }
  if (s.fx === 'reveal') M.reveal = 2;
  if (!s.pw || s.fx === 'heal' || s.fx === 'shield') { M.act = { k: 'cast', raise: 1, done: {}, def: { dur: .5 } }; M.actT = 0; return; }
  M.face = soCamFace();
  if (s.k === 'spell') { // a bolt that flies where the crosshair points
    M.act = { k: 'cast', done: {}, def: { dur: .5 } }; M.actT = 0;
    for (let h = 0; h < (s.hits || 1); h++) soBolt({ s, t: -h * .15 - .15, school: s.t === 'light' ? 'light' : 'arcane' });
  } else { // a move: a lunge and a strike
    M.act = { k: 'skill', sk: s, done: {}, def: { dur: .6, hit: Array.from({ length: s.hits || 1 }, (_, i) => .22 + i * .12), reach: 3.2, arc: 1.6 } }; M.actT = 0;
    M.x += Math.sin(M.face) * .9; M.z += Math.cos(M.face) * .9;
  }
  if (typeof sfx === 'function') sfx('cast', { gap: 50 });
}
function soSkillHit(s, weak) {
  const P = SO.P, B = SO.B, stat = P.s[s.st] || 5, n = s.pw * (.5 + stat / 80) * .22 * SO.pow;
  soHit(n, { sk: s, weakHit: s.k === 'spell' ? !!weak : undefined });
  if (s.fx === 'mark') { B.mark = 8; soPop('🏹 Marked: +25% damage taken', 'good'); }
  if (s.dot) B.dot.push({ n: s.dot * .2 * SO.pow, left: 3, t: 1 });
  if (s.heal) soHeal(P.max * s.heal / 100, '');
  if (s.stun && Math.random() < s.stun * .6 && B.state === 'wind') { B.stag = .8; B.state = 'idle'; B.t = .5; B.queue = []; soClearTele(); soPop('💫 Interrupted!', 'good'); }
}
// 2.87: no homing. A bolt leaves your hand on the line to where the crosshair points and flies
// straight; it hits whatever part of the Golem it meets, or the floor, or nothing.
// the Golem's body as spheres around its bones (world space), and its back crystal
const SO_HITB = [['pelvis', 1], ['spine_02', 1.15], ['spine_03', 1.3], ['Head', .6], ['upperarm_l', .55], ['upperarm_r', .55], ['lowerarm_l', .6], ['lowerarm_r', .6], ['hand_l', .65], ['hand_r', .65], ['thigh_l', .6], ['thigh_r', .6], ['calf_l', .55], ['calf_r', .55]];
function soBody() {
  const B = SO.B, G = SO.gs, v = new THREE.Vector3();
  if (!G) return { parts: [{ x: B.x, y: 2.6 + B.y, z: B.z, r: 1.9, n: 'body' }], crystal: null };
  G.root.updateMatrixWorld(true);
  const parts = SO_HITB.map(([n, r]) => { v.setFromMatrixPosition(G.bone(n).matrixWorld); return { x: v.x, y: v.y, z: v.z, r, n }; });
  v.setFromMatrixPosition(G.crystal.matrixWorld);
  return { parts, crystal: { x: v.x, y: v.y, z: v.z, r: .75 } };
}
// where the crosshair points: the first bit of the Golem on the line, else the floor, else far away
function soAimPoint() {
  const cam = SO.cam3, o = cam.position.clone(), d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  let best = 60;
  const hit = (c, r) => { const oc = new THREE.Vector3(c.x - o.x, c.y - o.y, c.z - o.z), t = oc.dot(d); if (t < 0) return; const q = oc.lengthSq() - t * t; if (q > r * r) return; const t0 = t - Math.sqrt(r * r - q); if (t0 > 0 && t0 < best) best = t0; };
  if (SO.B.state !== 'down') { const b = soBody(); b.parts.forEach(p => hit(p, p.r)); if (b.crystal) hit(b.crystal, b.crystal.r); }
  if (d.y < -.01) { const t = -o.y / d.y; if (t > 0 && t < best) best = t; }
  return o.addScaledVector(d, best);
}
function soProjStep(dt) {
  const B = SO.B;
  SO.projs = SO.projs.filter(p => {
    p.t += dt; if (p.t < 0) return true;
    const S = SO_SCHOOL[p.school] || SO_SCHOOL.arcane;
    if (!p.m) { // it leaves the hand (or the staff's tip) with a flash, aimed at the crosshair
      const at = soCastHand(), to = soAimPoint(); p.x = at.x; p.y = at.y; p.z = at.z;
      const dir = to.sub(at); if (dir.lengthSq() < .01) dir.set(Math.sin(SO.me.face), 0, Math.cos(SO.me.face)); dir.normalize(); p.d = dir;
      p.m = soSprite('flare_01', S.core, .55 * p.size, 1); p.m2 = soSprite(S.tex, S.col, .9 * p.size, .9); SO.S.add(p.m, p.m2);
      soBurst(at, { tex: 'flare_01', col: S.col, n: 1, size: .9 * p.size, life: .18, speed: 0 }); if (p.size > 1.5) soBurst(at, { tex: 'spark_01', col: S.col, n: 6, size: .25, life: .3, speed: 3 });
    }
    const v = (p.size > 2 ? 20 : 28) * dt, rad = .2 + .1 * p.size;
    p.x += p.d.x * v; p.y += p.d.y * v; p.z += p.d.z * v;
    // what did it reach? the crystal first (a weak point), then the body
    let hitPart = null, weak = false;
    if (B.state !== 'air' && B.state !== 'down' && !SO.over) {
      const b = soBody(), near = c => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2 < (c.r + rad) ** 2;
      if (b.crystal && near(b.crystal)) { hitPart = b.crystal; weak = true; }
      else hitPart = b.parts.find(near) || null;
      if (hitPart && !weak && B.stuck > 0 && /hand/.test(hitPart.n)) weak = true; // its fists stuck in the floor
    }
    const gone = p.t > 1.6 || p.y < 0 || Math.hypot(p.x, p.z) > 17;
    if (hitPart || gone) {
      SO.S.remove(p.m, p.m2); p.m.material.dispose(); p.m2.material.dispose();
      const at = new THREE.Vector3(p.x, Math.max(.1, p.y), p.z);
      if (hitPart) {
        if (p.s) soSkillHit(p.s, weak); else soHit(p.n, { base: true, weakHit: weak });
        soBurst(at, { tex: 'star_04', col: S.col, n: 1, size: 1.6 * p.size, life: .25, speed: 0, grow: 1.6 });
        soBurst(at, { tex: S.tex, col: S.col, n: 3 + 3 * p.size, size: .45, life: .45, speed: 4.5 }); soBurst(at, { tex: 'circle_05', col: S.col, n: 1, size: .5, life: .35, speed: 0, grow: 5 });
        soImpact(p.size > 2 ? 1.4 : .8, at, true);
      } else if (p.y < .3) soBurst(at, { tex: S.tex, col: S.col, n: 3, size: .35, life: .35, speed: 3 }); // a miss fizzles on the floor
      return false;
    }
    p.m.position.set(p.x, p.y, p.z); p.m2.position.set(p.x, p.y, p.z); p.m2.material.rotation += dt * 8;
    if ((p.tr = (p.tr || 0) + dt) > .03) { p.tr = 0; soBurst(p.m.position, { tex: S.trail, col: S.col, n: 1, size: .5 * p.size, life: .32, speed: .3, fade: 1 }); }
    return true;
  });
}

// ---------- the Golem ----------
function soBossStep(dt) {
  const B = SO.B, M = SO.me, ph = soPhase(), sp = soSpeed();
  // a new phase: it stops whatever it was doing and roars (the shout knocks back anyone close)
  if (ph !== SO.lastPh) {
    if (SO.lastPh != null && ph > SO.lastPh && B.state !== 'air' && B.state !== 'roll') {
      soPop(`${SO_NAME}: ${SO_PH[ph].n}`, 'phase'); soClearTele(); B.queue = []; B.atk = { k: 'roar', w: 1.5, n: 'Roar' }; B.state = 'roar'; B.t = 1.5; B.stuck = 0; SO.atkId++;
      soSnd(ph >= 3 ? 'g_roar' : 'g_roar2', B); SO.shake = .9; SO.rings.push({ x: B.x, z: B.z, r: 1, v: 9, mv: SO_MV.roar, m: soRing('#ffd8a8') });
      SO.lastPh = ph;
    } else if (SO.lastPh == null || ph < SO.lastPh || (B.state !== 'air' && B.state !== 'roll')) SO.lastPh = ph;
  }
  if (B.mark > 0) B.mark -= dt; if (B.stuck > 0) B.stuck -= dt;
  for (const d of B.dot) { d.t -= dt; if (d.t <= 0 && d.left > 0) { d.t = 1; d.left--; soHit(d.n, { dot: true }); } } B.dot = B.dot.filter(d => d.left > 0);
  B.greed = B.greed.filter(t => SO.time - t < 2.4);
  if (B.stag > 0) { B.stag -= dt; return; }
  const dist = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z);
  B.t -= dt;
  switch (B.state) {
    case 'roar': { if (B.t <= 0) { B.state = 'idle'; B.t = .2; } break; }
    case 'idle': case 'chase': {
      // 2.87: it turns and walks fast, so you can't just stay behind it
      B.face += soAng(toP - B.face) * Math.min(1, dt * 5.5 * sp);
      if (dist > 3.8) { const v = 3.9 * sp; B.x += Math.sin(B.face) * v * dt; B.z += Math.cos(B.face) * v * dt; B.state = 'chase'; } else B.state = 'idle';
      soBossFence();
      // greedy hitting gets you shrugged off
      if (B.greed.length >= 4 && dist < 4.5 && !(B.cool.shrug > SO.time)) { B.queue = ['shrug']; B.t = 0; }
      if (B.t <= 0) soBossPick(dist, ph);
      break;
    }
    case 'wind': {
      const a = B.atk, turn = { punch: 6, slam: 2.6, sweep: 3.4, march: 4.5, shrug: 0 }[a.k];
      if (turn) B.face += soAng(toP - B.face) * Math.min(1, dt * turn);
      if (a.k === 'leap') soLeapAim(a, dt);
      soTeleStep(a, 1 - B.t / a.w);
      if (a.feint && B.t <= a.w * (1 - a.feint)) { soFeint(a); break; }
      if (B.t <= 0) {
        // it holds the hit when it sees you roll too early, so rolling every time gets caught
        if (a.delay && !a.held && soRolling() && SO.time < M.iTo + .1) { a.held = 1; B.t = Math.max(0, M.iTo - SO.time) + .12 + Math.random() * .1; B.state = 'hold'; break; }
        soBossStrike(a, ph);
      }
      break;
    }
    case 'hold': { const a = B.atk; soTeleStep(a, 1); if (a.k === 'punch') B.face += soAng(toP - B.face) * Math.min(1, dt * 3); if (B.t <= 0) soBossStrike(a, ph); break; }
    case 'roll': {
      const a = B.atk, v = 16 * sp; B.x += a.dx * v * dt; B.z += a.dz * v * dt; a.go -= v * dt;
      if (soDist(B, M) < 2.2 && !a.hit && M.y < 1.4) { a.hit = 1; soHurtBy({ ...SO_MV.roll, k: 'roll' }); }
      if (a.go <= 0 || Math.hypot(B.x, B.z) > SO_ARENA - 1) { B.state = 'recover'; B.t = SO_MV.roll.open / sp; B.stuck = .9; soClearTele(); soSnd('g_boom', B, { vol: .8 }); soDust(B.x, B.z, 1.2); SO.shake = .4; }
      break;
    }
    case 'air': { // Rude Awakening: up and down onto the spot it locked
      const a = B.atk, p = Math.min(1, 1 - B.t / a.air);
      B.x = a.fx + (a.tx - a.fx) * p; B.z = a.fz + (a.tz - a.fz) * p; B.y = Math.sin(p * Math.PI) * 6;
      if (a.tm) { a.tm.material.opacity = .35 + p * .5; }
      if (B.t <= 0) { B.y = 0; soClearTele(); soBoom(B.x, B.z, '#ff6b3d', 3.4); soDust(B.x, B.z, 2); SO.shake = .75; soSnd('g_boom', B, { gap: 100, vol: 1.2 }); if (soDist(B, M) < SO_MV.leap.r) soHurtBy({ ...SO_MV.leap, k: 'leap' }); B.stuck = 1.3; B.state = 'recover'; B.t = SO_MV.leap.open / sp; soBossFence(); }
      break;
    }
    case 'recover': {
      // keep hitting past the opening and it shrugs you off sooner
      if (B.greed.length >= 5 && B.t > .25 && !(B.cool.shrug > SO.time)) { B.t = .1; B.queue.unshift('shrug'); }
      if (B.t <= 0) soBossAfter(ph);
      break;
    }
  }
}
function soBossFence() { const B = SO.B, r = Math.hypot(B.x, B.z), m = SO_ARENA - 1.5; if (r > m) { B.x *= m / r; B.z *= m / r; } }
// what it does next: combos queued up first, then by distance and phase
function soBossPick(dist, ph) {
  const B = SO.B, c = B.cool, now = SO.time, can = k => !(c[k] > now) && ph >= (SO_MV[k].ph || 0), rnd = Math.random;
  let k, chain = false;
  if (B.queue.length) { k = B.queue.shift(); chain = true; }
  else if (can('alarm') && rnd() < .22) k = 'alarm';
  else if (can('leap') && dist > 5 && rnd() < .5) k = 'leap';
  else if (dist > 7.5 && can('roll')) k = 'roll';
  else if (can('wave') && rnd() < .16) k = 'wave';
  else if (dist < 4.6) {
    const r = rnd();
    if (can('march') && r < .25) { k = 'march'; }
    else if (r < .45) { k = 'punch'; if (ph >= 1 && rnd() < .6) B.queue.push(rnd() < .5 ? 'punch' : 'slam'); if (ph >= 2 && rnd() < .4) B.queue.push('sweep'); }
    else if (r < .7) { k = 'sweep'; if (ph >= 1 && rnd() < .5) B.queue.push('slam'); }
    else k = 'slam';
  }
  else if (dist < 6 && can('sweep') && rnd() < .4) k = 'sweep';
  else { B.t = .1; return; }
  const M = SO_MV[k], sp = soSpeed();
  c[k] = now + ({ punch: .6, slam: 2, sweep: 1.6, wave: 7, roll: 5, alarm: 8.5, march: 8, leap: 7, shrug: 2.4 }[k] || 2) / sp;
  // wind-ups vary every time, combo follow-ups come quicker
  const w = M.w * (.75 + rnd() * .5) * (chain ? .72 : 1) / sp;
  const a = B.atk = { k, w, n: M.n };
  if (['punch', 'slam', 'sweep'].includes(k) && !chain) { if (rnd() < [.08, .16, .22, .3][ph]) a.feint = .55 + rnd() * .15; else if (rnd() < [.4, .5, .6, .7][ph]) a.delay = 1; }
  if (k === 'march') a.steps = 3;
  B.state = 'wind'; B.t = w; SO.atkId++;
  soTeleMake(a);
  // stone grinding as it winds up; a growl before the big ones
  soSnd(['slam', 'leap', 'march', 'alarm', 'roll'].includes(k) ? 'g_growl' : 'g_grind', B, { gap: 120, vol: k === 'punch' ? .7 : 1 });
}
// a fake-out: the wind-up stops short, it shakes, and something quicker comes instead
function soFeint(a) {
  const B = SO.B; soClearTele();
  const k = a.k === 'punch' ? (Math.random() < .5 ? 'sweep' : 'slam') : a.k === 'slam' ? 'punch' : 'punch', M = SO_MV[k];
  const w = M.w * .6 / soSpeed();
  B.atk = { k, w, n: M.n, faked: 1 }; B.t = w; soTeleMake(B.atk); SO.atkId++;
  soSnd('g_grind', B, { gap: 80, rate: 1.3 });
}
// the warnings on the floor, readable from any angle
function soTeleMake(a) {
  const B = SO.B, M = SO.me, mat = (c, o = .3) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const add = (geo, c, x, z, rot = 0) => { const m = new THREE.Mesh(geo, mat(c)); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, .04, z); m.renderOrder = 2; SO.S.add(m); SO.tele.push({ m, a }); return m; };
  const R = SO_MV[a.k]?.r;
  if (a.k === 'slam') { a.tm = add(new THREE.CircleGeometry(R, 40), '#ff3b3b', B.x, B.z); const e = add(new THREE.RingGeometry(R - .15, R, 48), '#ff6b6b', B.x, B.z); e.material.opacity = .9; a.edge = e; }
  else if (a.k === 'punch') { a.tm = add(new THREE.CircleGeometry(R, 24, -1.1, 2.2), '#ff8f3b', B.x, B.z); a.cone = 1; }
  else if (a.k === 'sweep') { a.tm = add(new THREE.RingGeometry(1.4, R, 40, 1, -1.9, 3.8), '#ffd43b', B.x, B.z); a.cone = 1; }
  else if (a.k === 'shrug') { a.tm = add(new THREE.CircleGeometry(R, 32), '#e8590c', B.x, B.z); }
  else if (a.k === 'march') { a.tm = add(new THREE.CircleGeometry(R, 32), '#ff3b3b', B.x + Math.sin(B.face) * 2, B.z + Math.cos(B.face) * 2); a.ahead = 1; }
  else if (a.k === 'leap') { a.tx = M.x; a.tz = M.z; a.tm = add(new THREE.CircleGeometry(SO_MV.leap.r, 40), '#ff3b3b', M.x, M.z); }
  else if (a.k === 'roll') { const ang = Math.atan2(M.x - B.x, M.z - B.z), L = 16; a.dx = Math.sin(ang); a.dz = Math.cos(ang); a.go = L; const g = new THREE.PlaneGeometry(3.4, L); g.translate(0, L / 2, 0); a.tm = add(g, '#ff8f3b', B.x, B.z, ang + Math.PI); }
  else if (a.k === 'wave') { a.tm = add(new THREE.RingGeometry(1.6, 2.2, 40), '#74c0fc', B.x, B.z); }
  else if (a.k === 'alarm') {
    const n = soPhase() >= 3 ? 6 : 5;
    for (let i = 0; i < n; i++) { const x = M.x + (i ? (Math.random() - .5) * 8 : 0), z = M.z + (i ? (Math.random() - .5) * 8 : 0), m = new THREE.Mesh(new THREE.CircleGeometry(SO_MV.alarm.r, 24), mat('#ffd43b')); m.rotation.x = -Math.PI / 2; m.position.set(x, .05, z); SO.S.add(m); const w = a.w + .35 + i * .22; SO.drops.push({ m, x, z, t: w, w }); }
  }
}
function soTeleStep(a, p) {
  if (!a.tm) return; a.tm.material.opacity = .25 + p * .55;
  const B = SO.B;
  if (a.cone) { a.tm.position.set(B.x, .04, B.z); a.tm.rotation.z = B.face - Math.PI / 2; }
  if (a.ahead) a.tm.position.set(B.x + Math.sin(B.face) * 2, .04, B.z + Math.cos(B.face) * 2);
  if (a.edge) a.edge.position.set(B.x, .04, B.z);
}
// the leap's target follows you until just before it jumps
function soLeapAim(a, dt) { const M = SO.me; if (SO.B.t > .45) { a.tx += (M.x - a.tx) * Math.min(1, dt * 5); a.tz += (M.z - a.tz) * Math.min(1, dt * 5); } if (a.tm) a.tm.position.set(a.tx, .04, a.tz); }
function soClearTele() { SO.tele.forEach(t => { SO.S.remove(t.m); t.m.geometry.dispose(); }); SO.tele = []; }
function soBossStrike(a, ph) {
  const B = SO.B, M = SO.me, mv = SO_MV[a.k], sp = soSpeed(), d = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z), front = Math.abs(soAng(toP - B.face));
  const open = t => { B.state = 'recover'; B.t = t / sp; };
  if (a.k !== 'leap' && a.k !== 'march') soClearTele();
  if (a.k === 'punch') { if (d < mv.r && front < mv.arc) soHurtBy({ ...mv, k: a.k }); open(B.queue.length ? .1 : mv.open); SO.shake = .2; soSnd('g_whoosh', B, { gap: 60, rate: 1.2 }); }
  else if (a.k === 'sweep') { if (d < mv.r && front < mv.arc) soHurtBy({ ...mv, k: a.k }); open(B.queue.length ? .12 : mv.open); soSnd('g_whoosh', B, { gap: 60 }); soDust(B.x + Math.sin(B.face) * 2.5, B.z + Math.cos(B.face) * 2.5, .8); }
  else if (a.k === 'shrug') { if (d < mv.r) soHurtBy({ ...mv, k: a.k }); soBoom(B.x, B.z, '#e8590c', 2); B.greed = []; open(mv.open); soSnd('g_step', B, { gap: 60 }); }
  else if (a.k === 'slam') {
    if (d < mv.r) soHurtBy({ ...mv, k: a.k });
    soBoom(B.x, B.z, '#ff6b3d', 3); soDust(B.x + Math.sin(B.face) * 2.2, B.z + Math.cos(B.face) * 2.2, 1.6); SO.shake = .65; soSnd('g_boom', B, { gap: 100 });
    if (ph >= 3) SO.rings.push({ x: B.x, z: B.z, r: 1, v: 8, mv: SO_MV.shock, m: soRing('#ff6b3d') });
    if (B.queue.length) open(.2); else { B.stuck = 1.2; open(mv.open); }
  }
  else if (a.k === 'march') { // three slams on the march, each a step closer
    const cx = B.x + Math.sin(B.face) * 2, cz = B.z + Math.cos(B.face) * 2;
    if (Math.hypot(M.x - cx, M.z - cz) < mv.r) soHurtBy({ ...mv, k: a.k });
    soBoom(cx, cz, '#ff6b3d', 2.4); soDust(cx, cz, 1.1); SO.shake = .45; soSnd('g_boom', { x: cx, z: cz }, { gap: 60, vol: .8 });
    B.x += Math.sin(B.face) * 1.8; B.z += Math.cos(B.face) * 1.8; soBossFence();
    a.steps--;
    if (a.steps > 0) { a.held = 0; B.state = 'wind'; B.t = a.w = (.24 + Math.random() * .16) / sp; a.delay = a.steps === 1 && Math.random() < .5 ? 1 : 0; SO.atkId++; }
    else { soClearTele(); B.stuck = 1.3; open(mv.open); }
  }
  else if (a.k === 'wave') { SO.rings.push({ x: B.x, z: B.z, r: 1, v: 8, mv, m: soRing('#74c0fc'), drowsy: 1 }); open(mv.open); soSnd('g_roar2', B, { gap: 100, vol: .6, rate: 1.2 }); }
  else if (a.k === 'roll') { B.state = 'roll'; soSnd('g_grind', B, { gap: 100, rate: .8 }); }
  else if (a.k === 'leap') { a.fx = B.x; a.fz = B.z; a.air = .62 / sp; B.state = 'air'; B.t = a.air; soSnd('g_whoosh', B, { gap: 100, rate: .7 }); }
  else if (a.k === 'alarm') { open(mv.open); soSnd('g_whoosh', B, { gap: 100 }); }
  else open(.25);
}
// rings along the floor (jump them) and alarm clocks landing on their own timers
function soHazStep(dt) {
  const M = SO.me;
  SO.rings = SO.rings.filter(w => {
    w.r += w.v * soSpeed() * dt; w.m.scale.setScalar(w.r); w.m.material.opacity = Math.max(0, .6 - w.r / 40);
    const dp = soDist(w, M); if (!w.hit && Math.abs(dp - w.r) < .6) { w.hit = 1; if (soHurtBy(w.mv) && w.drowsy) { M.drowsy = 3; soPop('😴 Drowsy: slower, half stamina', 'bad'); } }
    if (w.r > 22) { SO.S.remove(w.m); w.m.geometry.dispose(); return false; }
    return true;
  });
  SO.drops = SO.drops.filter(t => {
    t.t -= dt; t.m.material.opacity = .25 + (1 - t.t / t.w) * .5; if (t.t > 0) return true;
    if (Math.hypot(t.x - M.x, t.z - M.z) < SO_MV.alarm.r) soHurtBy(SO_MV.alarm);
    soBoom(t.x, t.z, '#adb5bd'); soDust(t.x, t.z, .7); soSnd('g_rocks', t, { gap: 50 }); SO.S.remove(t.m); t.m.geometry.dispose(); return false;
  });
}
function soRing(col) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, .07, 6, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .6, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.set(SO.B.x, .3, SO.B.z); SO.S.add(m); return m; }
function soBossAfter(ph) {
  const B = SO.B;
  if (B.queue.length) { B.state = 'idle'; B.t = .05; return; }
  B.state = 'idle'; B.t = (.15 + Math.random() * .35) / soSpeed() * (ph >= 3 ? .7 : 1);
}
// a hit coming at you: jumped, rolled through, blocked, or taken. Returns true if it landed.
function soHurtBy(mv) {
  const M = SO.me, P = SO.P, g = P.g || {}, B = SO.B;
  if (SO.over) return false;
  if (mv.low && M.y > .35) { if (!SO.jumpSeen) { SO.jumpSeen = 1; soPop('🦘 Jumped it!', 'good'); } return false; }
  if (soIfr()) {
    if (SO.time - M.rollAt < SO_C.perfect && M.perfRoll !== M.rollAt) { M.perfRoll = M.rollAt; M.emp = 4; SO.stats.perfect++; soPop('✨ Perfect dodge! +30% damage', 'good'); }
    return false;
  }
  if (P.cls === 'rogue' && Math.random() < .1) { soPop('🗡️ Rogue: slipped it', 'good'); return false; }
  let n = P.max * mv.d * (1 + soPhase() * .06) * (1 - Math.min(.5, (g.dr || 0) + (P.cls === 'guardian' ? .2 : 0)));
  const facing = Math.abs(soAng(Math.atan2(B.x - M.x, B.z - M.z) - M.face)) < 1.8;
  if (M.block && facing) {
    if (SO.time - M.blockAt < SO_C.guard && M.perfGuard !== M.blockAt) { M.perfGuard = M.blockAt; M.emp = Math.max(M.emp, 2.5); SO.stats.guards++; soPop('🛡️ Perfect guard! +30% damage', 'good'); if (typeof sfx === 'function') sfx('clank', { gap: 40 }); M.act = { k: 'blockhit', done: {}, def: { dur: .3 } }; M.actT = 0; return false; }
    const heavy = mv.d >= .3; M.st -= n * (heavy ? 1.6 : 1.1); M.rest = SO_C.st.wait; n *= heavy ? .5 : .25;
    if (M.st <= 0) { M.st = 0; M.block = false; M.act = { k: 'stagger', done: {}, def: { dur: .9 } }; M.actT = 0; soPop('🛡️ Guard broken!', 'bad'); }
    else { M.act = { k: 'blockhit', done: {}, def: { dur: .3 } }; M.actT = 0; }
  } else if (!M.act || M.act.k !== 'stagger') { M.act = { k: 'stagger', done: {}, def: { dur: mv.d >= .3 ? .75 : .45 } }; M.actT = 0; M.hold = null; }
  n = Math.max(1, Math.round(n || 0));
  const sh = Math.min(P.shield || 0, n); P.shield = (P.shield || 0) - sh; n -= sh;
  P.hp = Math.max(0, P.hp - n); SO.hurtT = .35; soNum(n, 'me'); SO.stats.hurt++;
  M.combo = 0; M.comboT = 0;
  if (M.block) { if (typeof sfx === 'function') sfx('clank', { gap: 60 }); } else { soSnd('g_pain', M, { gap: 250 }); if (typeof sfx === 'function') sfx('hurt', { gap: 60 }); }
  return true;
}
// ---------- hit feel: sparks, spell sprites (Kenney Particle Pack, CC0), swing trails, hit-stop, camera kick ----------
const SO_SCHOOL = {
  staff: { core: '#e3fafc', col: '#3bc9db', tex: 'magic_05', trail: 'twirl_02' },
  arcane: { core: '#f3d9fa', col: '#b197fc', tex: 'magic_02', trail: 'magic_05' },
  light: { core: '#fff9db', col: '#fcc419', tex: 'star_04', trail: 'spark_04' },
};
const SO_TEX = {};
function soTex(n) { if (!SO_TEX[n]) { const t = SO_TEX[n] = new THREE.TextureLoader().load('fx/' + n + '.png'); t.encoding = THREE.sRGBEncoding; } return SO_TEX[n]; }
function soSprite(tex, col, size, op = 1, add = true) {
  // the textures are greyscale: added on as light, or used as the shape (alpha) of a solid colour
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: add ? soTex(tex) : null, alphaMap: add ? null : soTex(tex), color: col, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
  m.scale.setScalar(size); m.renderOrder = 5; return m;
}
// a burst of sprites at a point: n of them flying out at speed, falling with grav, growing by grow over life
function soBurst(at, o) {
  if (!SO?.S) return; const n = Math.max(1, Math.round((o.n || 1) * (hxLow() ? .5 : 1)));
  for (let i = 0; i < n; i++) {
    const sz = (o.size || .3) * (o.n > 1 ? .7 + Math.random() * .6 : 1), sp = soSprite(o.tex, o.col, sz, o.op ?? 1, o.add !== false);
    sp.position.copy(at); sp.material.rotation = Math.random() * 6.28; SO.S.add(sp);
    const v = new THREE.Vector3(Math.random() - .5, Math.random() - .5 + (o.up || 0), Math.random() - .5).normalize().multiplyScalar((o.speed ?? 3) * (.5 + Math.random() * .7));
    SO.parts.push({ sp, v, t: 0, life: (o.life || .4) * (.8 + Math.random() * .4), s0: sz, grow: o.grow || 0, grav: o.grav || 0, op: o.op ?? 1, spin: (Math.random() - .5) * 6 });
  }
}
function soFxStep(dt) {
  if (!SO.parts) return;
  SO.parts = SO.parts.filter(p => {
    p.t += dt; const k = p.t / p.life;
    if (k >= 1) { SO.S.remove(p.sp); p.sp.material.dispose(); return false; }
    p.v.y -= p.grav * dt; p.sp.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - Math.min(1, dt * 3));
    if (p.grav && p.sp.position.y < .05) { p.sp.position.y = .05; p.v.y = Math.abs(p.v.y) * .3; }
    p.sp.scale.setScalar(p.s0 * (1 + p.grow * k)); p.sp.material.opacity = p.op * (1 - k * k); p.sp.material.rotation += p.spin * dt;
    return true;
  });
  SO.trail?.step(dt);
}
// a landed hit: freeze a few frames, kick the camera, throw sparks and stone chips where it struck
function soImpact(pow = 1, at = null, magic = false) {
  const M = SO.me, B = SO.B;
  SO.stop = Math.min(.11, .045 + .03 * pow); SO.kick = Math.min(1, .45 * pow); SO.kickY = .22; SO.shake = Math.max(SO.shake || 0, .05 * pow);
  if (!at) { // the Golem's side that faces you, at the weapon's height
    const d = Math.max(.01, soDist(M, B)), r = SO_BR - .5, tip = SO.H?.tip('r');
    at = new THREE.Vector3(B.x + (M.x - B.x) / d * r, Math.max(1, Math.min(3.4, tip ? tip.y : 1.8)), B.z + (M.z - B.z) / d * r);
  }
  if (magic) return;
  soBurst(at, { tex: 'flare_01', col: '#fff4e6', n: 1, size: 1.1 * pow, life: .14, speed: 0, grow: .6 });
  soBurst(at, { tex: 'spark_01', col: '#ffd8a8', n: 7 * pow, size: .28, life: .35, speed: 7, grav: 9, up: .4 });
  soBurst(at, { tex: 'dirt_02', col: '#9a93a8', n: 3 * pow, size: .35, life: .6, speed: 4, grav: 14, up: .6, add: false, op: .9 });
  if (pow > 1.2) soBurst(at, { tex: 'smoke_03', col: '#6e6680', n: 2, size: 1.2, life: .7, speed: .8, grow: .8, add: false, op: .45 });
}
// the swing trail: a ribbon behind the blade while an attack swings
function soTrail() {
  const N = 20, pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 3), g = new THREE.BufferGeometry(), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false; mesh.renderOrder = 4; SO.S.add(mesh);
  let hist = []; const tip = new THREE.Vector3(), base = new THREE.Vector3(), tint = new THREE.Color();
  return {
    mesh, reset() { hist = []; },
    step(dt) {
      const M = SO.me, a = M.act, H = SO.H, D = a?.def;
      hist.forEach(h => { h.t += dt; }); hist = hist.filter(h => h.t < .18);
      const on = D && !D.bolt && (a.k === 'light' || a.k === 'heavy' || a.k === 'skill') && D.hit && M.actT > D.hit[0] - Math.min(.16, D.dur * .35) && M.actT < D.hit[D.hit.length - 1] + .08;
      if (on && H?.tip('r', tip)) { base.setFromMatrixPosition(H.weapons.r.matrixWorld).lerp(tip, .12); hist.unshift({ a: tip.clone(), b: base.clone(), t: 0 }); if (hist.length > N) hist.length = N; }
      tint.set(a?.k === 'heavy' ? '#ffc078' : '#a5d8ff');
      for (let i = 0; i < N; i++) {
        const h = hist[Math.min(i, hist.length - 1)], k = h ? Math.max(0, 1 - h.t / .18) * (1 - i / N) * 1.3 : 0;
        if (h) { pos.set([h.a.x, h.a.y, h.a.z], i * 6); pos.set([h.b.x, h.b.y, h.b.z], i * 6 + 3); }
        col.set([tint.r * k, tint.g * k, tint.b * k], i * 6); col.set([tint.r * k * .15, tint.g * k * .15, tint.b * k * .15], i * 6 + 3);
      }
      mesh.visible = hist.length > 1; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
}
// where a spell leaves from: the hand that's furthest forward, a little in front of it
function soCastHand() {
  const M = SO.me, f = new THREE.Vector3(Math.sin(M.face), 0, Math.cos(M.face)), H = SO.H;
  if (!H) return new THREE.Vector3(M.x, 1.5 + M.y, M.z).addScaledVector(f, .6);
  const hs = ['hand_r', 'hand_l'].map(n => new THREE.Vector3().setFromMatrixPosition(H.bone(n).matrixWorld));
  const h = hs[0].dot(f) >= hs[1].dot(f) ? hs[0] : hs[1]; return h.addScaledVector(f, .25);
}
// a magic bolt that flies at the Golem: a skill's spell (s) or the staff's own (n damage)
function soBolt(o) { SO.projs.push({ s: o.s, n: o.n, school: o.school, size: [1, 1, 1.4, 2.2][o.size || 1], t: o.t ?? 0, x: 0, y: 0, z: 0 }); if (!o.s && typeof sfx === 'function') sfx('cast', { gap: 40 }); }
function soBoom(x, z, col, s = 1.5) {
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, m = is3mesh(new THREE.IcosahedronGeometry(.25, 0), col, x, .4, z, SO.S, true); m.castShadow = false; m.material = m.material.clone(); m.material.transparent = true; SO.fx.push({ m, a, x, z, t: 0, s }); }
}

// ---------- 2.87: sounds from where they happen, dust ----------
// a fight sound at a spot: panned left or right of the camera and quieter far away
function soSnd(name, at, o = {}) {
  if (typeof sfx !== 'function' || !SO) return;
  let pan = 0, vol = 1;
  if (at && SO.cam3) {
    const c = SO.cam3, dx = at.x - c.position.x, dz = at.z - c.position.z, d = Math.hypot(dx, dz) || 1;
    const rx = Math.cos(SO.cam.cy), rz = -Math.sin(SO.cam.cy); // the camera's right
    pan = (dx * rx + dz * rz) / d * .75; vol = Math.max(.35, Math.min(1, 1.25 - d / 26));
  }
  sfx(name, { ...o, pan, vol: vol * (o.vol ?? 1) });
}
// dust kicked up off the floor (steps, slams, landings)
function soDust(x, z, k = 1) {
  const at = new THREE.Vector3(x, .3, z);
  soBurst(at, { tex: 'smoke_03', col: '#8f88a0', n: Math.round(3 * k) + 1, size: 1.4 * k, life: .9, speed: 2.2 * k, grow: 1.2, add: false, op: .5, up: .1 });
  if (k > .9) soBurst(at, { tex: 'dirt_02', col: '#7c7590', n: Math.round(4 * k), size: .35, life: .7, speed: 5, grav: 14, up: .7, add: false, op: .9 });
}

// ---------- 2.87: the intro, like a Souls boss: it sleeps, wakes, stands, roars, then its name ----------
const SO_CINE = { eyes: 3.2, stand: 3.7, roar: 5, title: 5.6, bar: 7.6, back: 8.3, end: 9.2 };
function soCineDraw() {
  const ov = document.getElementById('soov'); if (!ov) return;
  ov.classList.add('cine');
  ov.insertAdjacentHTML('beforeend', `<div class="so-cine"><div class="so-fade"></div><div class="so-title"><b>${esc(SO_TITLE)}</b><i></i></div>${SO.cine.skip ? '<small class="so-skip">Press any key to skip</small>' : ''}</div>`);
}
function soCineStep(dt) {
  const C = SO.cine, B = SO.B, G = SO.gs, T = SO_CINE, was = C.t; C.t += dt;
  const at = k => was < k && C.t >= k;
  if (at(.3) || at(1.9)) soSnd('g_snore', B);
  if (at(T.eyes)) { soSnd('g_grind', B, { rate: .7 }); }
  if (at(T.stand)) { B.state = 'wake'; soSnd('g_step', B); soDust(B.x - 1, B.z, .8); soDust(B.x + 1, B.z, .8); }
  if (at(T.roar)) { B.state = 'roar'; SO.shake = 1.4; soSnd('g_roar', B); soDust(B.x, B.z + 1.5, 2); SO.rings.push({ x: B.x, z: B.z, r: 1, v: 12, mv: SO_MV.roar, m: soRing('#ffd8a8'), cine: 1 }); }
  if (at(T.roar + 1.6)) B.state = 'wake';
  if (G) { const k = Math.max(0, Math.min(1, (C.t - T.eyes) / .6)); G.eyes.forEach(e => e.material.emissiveIntensity = 1.4 * k); }
  // the roar's ring only shows; it can't hurt you in the intro
  SO.rings = SO.rings.filter(w => { if (!w.cine) return true; w.r += w.v * dt; w.m.scale.setScalar(w.r); w.m.material.opacity = Math.max(0, .6 - w.r / 30); if (w.r > 20) { SO.S.remove(w.m); w.m.geometry.dispose(); return false; } return true; });
  const ov = document.getElementById('soov');
  if (ov) {
    ov.querySelector('.so-fade')?.style.setProperty('opacity', String(Math.max(0, 1 - C.t / .9)));
    const ti = ov.querySelector('.so-title'); if (ti) ti.classList.toggle('on', C.t >= T.title && C.t < T.end - .2);
    if (C.t >= T.bar) ov.classList.add('bar-in');
  }
  if (C.t >= T.end) soCineEnd();
}
function soCineEnd() {
  if (!SO?.cine) return;
  SO.cine = null; SO.B.state = 'idle'; SO.B.t = .8; SO.shake = 0;
  if (SO.gs) SO.gs.eyes.forEach(e => e.material.emissiveIntensity = 1.4);
  SO.rings = SO.rings.filter(w => { if (w.cine) { SO.S.remove(w.m); w.m.geometry.dispose(); } return !w.cine; });
  const ov = document.getElementById('soov'); ov?.querySelector('.so-cine')?.remove(); ov?.classList.remove('cine'); ov?.classList.add('bar-in');
  const st = ftState(); if (!st.soIntroSeen) { st.soIntroSeen = 1; save(); }
  SO.t = performance.now(); SO.acc = 0;
  soHudDraw(); if (typeof sfx === 'function') sfx('start');
}
// where the intro camera is: round the sleeping Golem, up to its face for the roar, then back behind you
function soCineCam(cam) {
  const C = SO.cine, B = SO.B, T = SO_CINE, t = C.t, look = new THREE.Vector3(B.x, 2.6, B.z);
  let pos;
  if (t < T.eyes) { const k = t / T.eyes, a = .9 - k * 1.5, r = 10 - k * 2.5; pos = new THREE.Vector3(B.x + Math.sin(a) * r, 2 + k * 1.2, B.z + Math.cos(a) * r); }
  else if (t < T.roar) { const k = Math.min(1, (t - T.eyes) / 1.2), e = k * k * (3 - 2 * k); pos = new THREE.Vector3(B.x + Math.sin(-.6) * (7.5 - e * 2), 3.2 - e * 2, B.z + Math.cos(-.6) * (7.5 - e * 2)); look.y = 2.6 + e * 1.6; }
  else if (t < T.back) { pos = new THREE.Vector3(B.x + 1.8, 1.4, B.z + 8); look.y = 3.8; }
  else { const k = Math.min(1, (t - T.back) / (T.end - T.back)), e = k * k * (3 - 2 * k), M = SO.me, C2 = SO.cam;
    const end = new THREE.Vector3(M.x + Math.sin(C2.cy) * Math.cos(C2.cp) * C2.cd + Math.cos(C2.cy) * .9, 1.55 + Math.sin(C2.cp) * C2.cd, M.z + Math.cos(C2.cy) * Math.cos(C2.cp) * C2.cd - Math.sin(C2.cy) * .9);
    pos = new THREE.Vector3(B.x + 1.8, 1.4, B.z + 8).lerp(end, e); look.lerp(new THREE.Vector3(M.x + Math.cos(C2.cy) * .9 - Math.sin(C2.cy) * 14, 2.75 - C2.cp * 6, M.z - Math.sin(C2.cy) * .9 - Math.cos(C2.cy) * 14), e); }
  if (SO.shake > 0) { SO.shake -= .016; pos.x += (Math.random() - .5) * SO.shake * .5; pos.y += (Math.random() - .5) * SO.shake * .5; }
  cam.position.copy(pos); cam.lookAt(look);
}

// ---------- 2.87: Somnus's body follows the fight ----------
function sgAnim(dt, t) {
  const S = SO.gs, B = SO.B, st = B.state, a = B.atk, mv = a && SG_MOVE[a.k], ph = SO.cine ? 0 : soPhase();
  if (st === 'sleep') S.play('Crouch_Idle_Loop', { speed: .45 });
  else if (st === 'wake') S.play('Idle_Loop', { fade: 1.1, speed: .6 });
  else if (st === 'roar') { S.play('Sword_Attack', { held: true, fade: .35 }); S.pose(.19 + Math.sin(t * 45) * .006); }
  else if (st === 'down') S.play('Death01', { loop: false, fade: .3, speed: .6 });
  else if (B.stag > 0) S.play('Hit_Chest', { loop: false, fade: .1, speed: .8 });
  else if ((st === 'wind' || st === 'hold') && mv) {
    // the wind-up: slowly up to the moment before impact, held there trembling if it waits
    if (S.atk !== SO.atkId) { S.atk = SO.atkId; S.play(mv.c, { held: true, restart: true, fade: .14 }); }
    const wp = st === 'hold' ? 1 : 1 - B.t / a.w;
    S.pose(mv.hit * (.08 + .88 * sgEase(wp)) + (st === 'hold' ? Math.sin(t * 50) * .006 : 0));
  }
  else if (st === 'air') S.play('Jump_Loop', { fade: .15 });
  else if (st === 'roll') S.play('Roll', { speed: 1.7 });
  else if (st === 'recover' && mv && S.cur === mv.c && S.struck !== SO.atkId) {
    // the strike: snap through the rest of the swing
    S.struck = SO.atkId; const A = S.act; A.timeScale = mv.after; A.paused = false; A.time = Math.max(A.time, mv.hit * A.getClip().duration);
  }
  else if (st === 'recover' && B.stuck > 0 && (S.done() || !mv || S.cur !== mv.c)) S.play(a?.k === 'leap' ? 'NinjaJump_Land' : 'Crouch_Idle_Loop', { loop: a?.k !== 'leap', fade: .2, speed: .9 });
  else if (st === 'recover' && mv && S.cur === mv.c && !S.done()) { /* the swing plays out */ }
  else if (st === 'chase') S.play('Walk_Loop', { fade: .25, speed: 3.9 * soSpeed() / 4.2 });
  else if (st === 'idle' || st === 'recover') S.play('Idle_Loop', { fade: .3, speed: ph >= 3 ? 1.1 : .7 });
  // heavy footsteps while it walks: a thud, dust and a little shake when it's close
  if (S.cur === 'Walk_Loop' && S.act) {
    const k = (S.act.time / S.act.getClip().duration) % 1, half = k < .5 ? 0 : 1;
    if (S.foot !== half) { S.foot = half; soSnd('g_step', B, { gap: 120 }); const fb = S.bone(half ? 'foot_r' : 'foot_l'), v = new THREE.Vector3().setFromMatrixPosition(fb.matrixWorld); soDust(v.x, v.z, .45); if (soDist(B, SO.me) < 9) SO.shake = Math.max(SO.shake || 0, .12); }
  }
  // a weak-point hit makes it flinch; the crystal and eyes burn brighter each phase; plates fall as it weakens
  if (S.flinch > 0) S.flinch = Math.max(0, S.flinch - dt * 3);
  const col = ['#66d9e8', '#74c0fc', '#ffa94d', '#ff6b6b'][ph];
  if (S.phCol !== col) { S.phCol = col; S.eyes.forEach(e => { e.material.color.set(col); e.material.emissive.set(col); }); S.cm.color.set(col); S.cm.emissive.set(col); S.glow.color.set(col); }
  S.cm.emissiveIntensity = 1.2 + ph * .5 + Math.sin(t * (3 + ph * 2)) * .4; S.glow.intensity = 1 + ph * .6;
  S.crystal.rotation.y += dt * (.5 + ph * .5);
  if (!SO.cine && B.state !== 'down') S.crumble(1 - soLeft());
  if (S.flash > 0) { S.flash -= dt; S.plates.forEach(p => { if (p.material.emissive && p.material !== S.cm) p.material.emissive.set(S.flash > 0 ? '#3a2a22' : '#000000'); }); }
  S.update(dt);
  if (S.flinch > 0) S.bone('spine_02').rotation.x -= Math.sin(S.flinch * Math.PI) * .25;
}

// ---------- drawing ----------
const soClipLen = n => HERO.gltf?.animations.find(a => a.name === n)?.duration || 1;
function soAnim(dt) {
  const H = SO.H, M = SO.me, a = M.act; if (!H) return;
  const one = (n, dur, o = {}) => H.play(n, { loop: false, fade: .08, speed: soClipLen(n) / dur, ...o });
  if (SO.over) { /* soEnd picked Death or Cheer */ }
  else if (a?.k === 'roll') one('Roll', SO_C.roll.time);
  else if ((a?.k === 'light' || a?.k === 'heavy') && a.def?.c) { const D = a.def, sp = D.span || [0, 1]; one(D.c, D.dur / (sp[1] - sp[0]), { restart: a.started !== 1, from: sp[0] }); a.started = 1; }
  else if (a?.k === 'skill') { one('1H_Melee_Attack_Stab', .6, { restart: a.started !== 1 }); a.started = 1; }
  else if (a?.k === 'cast') { one(a.raise ? 'Spellcast_Raise' : 'Spellcast_Shoot', .5, { restart: a.started !== 1 }); a.started = 1; }
  else if (a?.k === 'potion') one('Use_Item', SO_ACTS.potion.dur);
  else if (a?.k === 'stagger') { one(a.def.dur > .6 ? 'Hit_B' : 'Hit_A', a.def.dur, { restart: a.started !== 1 }); a.started = 1; }
  else if (a?.k === 'blockhit') { one('Block_Hit', .3, { restart: a.started !== 1 }); a.started = 1; }
  else if (M.block) H.play('Blocking', { fade: .1 });
  else if (!M.ground) { if (H.cur !== 'Jump_Start' && H.cur !== 'Jump_Idle') H.play('Jump_Start', { loop: false, fade: .08 }); else if (H.cur === 'Jump_Start' && H.done()) H.play('Jump_Idle', { fade: .12 }); }
  else if (M.land > 0 && M.sp < 1) H.play('Jump_Land', { loop: false, fade: .06, speed: 1.6 });
  else if (M.sp < .3) H.play(soCombo().idle, { fade: .2 });
  else if (M.sp < 2.2) H.play('Walking_A', { speed: Math.max(.7, M.sp / 1.7) });
  else if (M.sp < (SO_C.jog + SO_C.sprint) / 2) H.play('Running_A', { speed: M.sp / SO_C.jog });
  else H.play('Running_B', { speed: M.sp / SO_C.sprint * 1.05 });
  H.update(dt);
}
function soDraw(t, dt) {
  if (!SO.R || !SO.S) return;
  const M = SO.me, B = SO.B, G = SO.gol, cam = SO.cam3, C = SO.cam;
  if (SO.H) { SO.H.root.position.set(M.x, M.y, M.z); SO.H.root.rotation.y = M.face; soAnim(dt); }
  else if (SO.fig) { SO.fig.position.set(M.x, M.y, M.z); SO.fig.rotation.y = M.face; }
  SO.blob.position.set(M.x, .02, M.z); SO.blob.scale.setScalar(1 - Math.min(.5, M.y / 4));
  soFxStep(dt);
  // the Golem
  const R = G.root; R.position.set(B.x, B.y, B.z); R.rotation.y = B.face;
  if (SO.gs) sgAnim(dt, t); else {
  const b = G.body, arms = G.arms, wb = Math.sin(t * 3);
  b.rotation.set(0, 0, 0); b.position.y = 2.6; G.head.rotation.set(0, 0, 0);
  arms.forEach(A => { A.sh.rotation.set(0, 0, A.s * .15); }); G.legs.forEach(L => { L.rotation.x = 0; });
  const st = B.state, ak = B.atk?.k, wp = B.atk && (st === 'wind' || st === 'hold') ? Math.max(0, Math.min(1, 1 - B.t / B.atk.w)) : 0;
  const down = st === 'down', ph = soPhase(), tremble = st === 'hold' ? Math.sin(t * 60) * .04 : 0;
  G.eyes.forEach(e => { e.scale.y = down ? .15 : ph >= 3 ? 1.6 : 1; e.material.emissive?.set(ph >= 3 ? '#ff6b6b' : '#66d9e8'); });
  G.zz.forEach((z, i) => { z.visible = ph === 0 && st === 'idle'; if (z.visible) z.position.set(1 + i * .5, 4.7 + i * .6 + Math.sin(t * 2 + i) * .15, 0); });
  G.crystal.material.emissiveIntensity = .6 + Math.sin(t * 4) * .3; G.crystal.rotation.y = t;
  arms.forEach(A => { A.fist.material.emissive.set(B.stuck > 0 ? '#66d9e8' : '#000000'); });
  if (down) { b.rotation.x = -Math.min(1.4, B.t * 1.5); b.position.y = 2.6 - Math.min(1.6, B.t * 2); }
  else if (st === 'chase') { const s = Math.sin(t * 6); G.legs[0].rotation.x = s * .5; G.legs[1].rotation.x = -s * .5; arms[0].sh.rotation.x = -s * .3; arms[1].sh.rotation.x = s * .3; b.position.y = 2.6 + Math.abs(Math.cos(t * 6)) * .12; }
  else if ((st === 'wind' || st === 'hold') && ak === 'punch') { arms[1].sh.rotation.x = .9 * wp + tremble; arms[1].sh.rotation.y = -.6 * wp; b.rotation.y = -.4 * wp; }
  else if ((st === 'wind' || st === 'hold') && (ak === 'slam' || ak === 'march')) { arms.forEach(A => { A.sh.rotation.x = -2.9 * wp + tremble; }); b.position.y = 2.6 + wp * .4; b.rotation.x = -.2 * wp; }
  else if ((st === 'wind' || st === 'hold') && ak === 'sweep') { arms[0].sh.rotation.z = -1.5 * wp; arms[1].sh.rotation.z = 1.5 * wp; b.rotation.y = .9 * wp + tremble; b.position.y = 2.6 - wp * .5; }
  else if (st === 'wind' && ak === 'shrug') { b.position.y = 2.6 - wp * .4; arms.forEach(A => { A.sh.rotation.z = A.s * (.15 + .9 * wp); }); b.rotation.z = Math.sin(t * 50) * .05; }
  else if (st === 'wind' && ak === 'wave') { G.head.rotation.x = -.6 * wp; arms.forEach(A => { A.sh.rotation.z = A.s * (.15 + 1.2 * wp); }); }
  else if (st === 'wind' && ak === 'roll') { b.rotation.x = .9 * wp; b.position.y = 2.6 - wp * .8; arms.forEach(A => { A.sh.rotation.x = -1.2 * wp; }); }
  else if (st === 'wind' && ak === 'alarm') { arms[1].sh.rotation.x = -2.6 * wp; }
  else if (st === 'wind' && ak === 'leap') { b.position.y = 2.6 - wp * 1; arms.forEach(A => { A.sh.rotation.x = 1.2 * wp; }); }
  else if (st === 'air') { arms.forEach(A => { A.sh.rotation.x = -2.8; }); }
  else if (st === 'roll') { b.position.y = 1.9; b.rotation.x = t * 14; arms.forEach(A => { A.sh.rotation.x = -1.2; }); }
  else if (st === 'recover' && B.stuck > 0) { arms.forEach(A => { A.sh.rotation.x = -.9; }); b.position.y = 2.1; b.rotation.x = .45; }
  else if (st === 'recover' && ak === 'punch') { arms[1].sh.rotation.x = -1.5; b.rotation.y = .3; }
  else if (st === 'recover' && ak === 'sweep') { b.rotation.y = -.7; arms[1].sh.rotation.z = -1; }
  else { b.position.y = 2.6 + wb * .05; arms.forEach((A, i) => { A.sh.rotation.x = Math.sin(t * 1.5 + i) * .08; }); }
  if (G.flinch > 0) { G.flinch = Math.max(0, G.flinch - dt * 4); b.rotation.x -= Math.sin(G.flinch * Math.PI) * .22; G.head.rotation.x -= G.flinch * .3; }
  if (G.flash > 0) { G.flash -= .016; G.root.traverse(o => { if (o.isMesh && !o.userData.glow && !G.arms.some(A => A.fist === o)) o.material.emissive.set(G.flash > 0 ? '#664433' : '#000000'); }); }
  }
  SO.fx = SO.fx.filter(e => { e.t += .016; const p = e.t / .6; if (p >= 1) { SO.S.remove(e.m); e.m.geometry.dispose(); return false; } e.m.position.set(e.x + Math.cos(e.a) * p * e.s * 1.6, .4 + Math.sin(p * 3) * 1.2, e.z + Math.sin(e.a) * p * e.s * 1.6); e.m.material.opacity = 1 - p; return true; });
  if (SO.cine) { soCineCam(cam); SO.R.render(SO.S, cam); soHudTick(); return; }
  // the camera over your shoulder, free (no lock-on); it pulls in rather than going through the Golem or the wall
  // 2.87: holding right click aims: closer over the shoulder and zoomed in a little
  SO.aimK += ((SO.aim ? 1 : 0) - SO.aimK) * Math.min(1, dt * 12); const ak = SO.aimK;
  const fov = 58 - 14 * ak; if (Math.abs(cam.fov - fov) > .05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  const tx = M.x, ty = 1.55 + M.y * .6 + ak * .15, tz = M.z, cp = C.cp, d = C.cd + (3.9 - C.cd) * ak;
  let px = tx + Math.sin(C.cy) * Math.cos(cp) * d, py = ty + Math.sin(cp) * d, pz = tz + Math.cos(C.cy) * Math.cos(cp) * d;
  const side = .9 + .3 * ak; px += Math.cos(C.cy) * side; pz -= Math.sin(C.cy) * side;
  for (let f = .1; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f; if (B.state !== 'down' && Math.hypot(x - B.x, z - B.z) < 3.1 && ty + (py - ty) * f < 6 + B.y) { const k = Math.max(.35, f - .1); px = tx + (px - tx) * k; py = ty + (py - ty) * k + (1 - k) * 2.2; pz = tz + (pz - tz) * k; break; } }
  for (let f = .2; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f; if (Math.hypot(x, z) > 14.5) { const k = f - .05; px = tx + (px - tx) * k; py = ty + (py - ty) * k; pz = tz + (pz - tz) * k; break; } }
  if (SO.shake > 0) { SO.shake -= .016; px += (Math.random() - .5) * SO.shake; py += (Math.random() - .5) * SO.shake; }
  if (SO.kick > 0) { const k = SO.kick * SO.kick * .5; px += (tx - px) * k * .25; py += SO.kickY * k; pz += (tz - pz) * k * .25; SO.kick = Math.max(0, SO.kick - dt * 6); }
  cam.position.set(px, Math.max(.6, py), pz);
  // 2.87: the camera looks at a point well ahead of you, so the crosshair in the middle of the screen points
  // where you'd aim (mouse up and down raises and lowers it), not at the floor by your feet
  const L = 14; cam.lookAt(tx + Math.cos(C.cy) * side - Math.sin(C.cy) * L, ty + 1.2 - 1.8 * ak - cp * 6, tz - Math.sin(C.cy) * side - Math.cos(C.cy) * L);
  SO.R.render(SO.S, cam);
  soHudTick();
}
// floating damage numbers and pop-ups
function soNum(n, cls) {
  const el = document.createElement('div'); el.className = 'sonum ' + cls; el.textContent = (cls === 'me' ? '-' : '') + n + (cls === 'weak' ? ' 💥' : cls === 'crit' ? '!' : '');
  document.getElementById('soov')?.appendChild(el);
  const B = SO.B, M = SO.me, w = cls === 'me' ? { x: M.x, y: 2.2 + M.y, z: M.z } : { x: B.x + (Math.random() - .5) * 1.4, y: 4 + B.y + Math.random(), z: B.z };
  SO.nums.push({ el, w, t: 0 });
}
function soPop(text, cls) {
  const box = document.querySelector('#soov .so-pops'); if (!box) return;
  const el = document.createElement('div'); el.className = 'sopop ' + (cls || ''); el.textContent = text; box.appendChild(el);
  setTimeout(() => el.remove(), 2200); while (box.children.length > 3) box.firstChild.remove();
}

// ---------- the HUD ----------
function soOverlay() {
  let ov = document.getElementById('soov'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'soov'; document.body.appendChild(ov); document.body.classList.add('souls-on');
  return ov;
}
const SO_KEYS = '<span><kbd>W A S D</kbd> move</span><span><kbd>Mouse</kbd> look</span><span>hold <kbd>Right click</kbd> aim</span><span><kbd>Shift</kbd> sprint</span><span><kbd>Space</kbd> jump</span><span><kbd>Ctrl</kbd> roll</span><span><kbd>F</kbd> block</span><span><kbd>Left click</kbd> attack</span><span>hold <kbd>Left</kbd> heavy</span><span><kbd>1-9</kbd> skills</span><span><kbd>R</kbd> potion</span><span><kbd>Esc</kbd> pause</span>';
function soIntroDraw() {
  const ov = soOverlay(), k = SO.kind, st = ftState(), pb = (st.soPb || {})[SO_BOSS] || 0;
  ov.innerHTML = `<div class="so-intro"><div class="so-card">
    <div class="so-kicker">${k === 'bonus' ? 'BONUS FIGHT · DAMAGE RACE' : k === 'test' ? 'TEST FIGHT · OWNER ONLY' : 'WEEKLY WARBAND · DAMAGE RACE'}</div>
    <h2>${esc(SO_TITLE)}</h2><p class="so-sub">${esc(SO_LORE)}</p>
    <p>${k === 'bonus' ? `An extra fight for ${SO_BONUS.l} ${LUMEN} and ${SO_BONUS.e} ${EMBER} (${soBonusLeft()} left today).` : k === 'test' ? 'Free test fight: no attempt used and nothing goes on the bar.' : `Uses one of your weekly fights (${ftAttempts().left} left).`} <b>3 minutes, one life: deal as much damage as you can.</b> Everything you hit goes on your house's shared bar. Dying just ends the run early.</p>
    <p class="so-tips">It is fast and it hits hard: two or three mistakes and you're down, and you have ${SO_POTS} potions. Strike in the openings after its attacks. Rolls are short and costly, so time them. Hold right click to aim: spells fly exactly where the crosshair points, and the crystal on its back is a weak point. Esc shows the controls.</p>
    ${pb ? `<p class="muted small-text">Your best: ${pb.toLocaleString()} damage · power ×${soPower().toFixed(2)} from your level and gear</p>` : `<p class="muted small-text">Power ×${soPower().toFixed(2)} from your level and gear</p>`}
    <div class="so-btns"><button class="btn primary" data-so="go">⚔️ Fight</button><button class="btn ghost" data-so="cancel">Not now</button></div></div></div>`;
}
function soHudDraw() {
  const ov = soOverlay(); if (!SO || SO.intro) return;
  ov.querySelector('.so-hud')?.remove(); ov.querySelector('.so-end')?.remove();
  const hud = document.createElement('div'); hud.className = 'so-hud';
  hud.innerHTML = `<div class="so-boss"><div class="so-bn">${esc(SO_TITLE)} <span class="so-ph"></span></div><div class="so-bar"><i class="so-bhp"></i></div><div class="so-bsub"></div></div>
    <div class="so-dmg"><small>Your damage</small><b>0</b><span class="so-combo"></span></div>
    <div class="so-ptime"></div><div class="so-cross ${SO.aim ? 'aim' : ''}"><i></i><i></i><i></i><i></i></div><div class="so-pops"></div>
    <div class="so-me"><div class="so-hp"><i></i><span></span></div><div class="so-st"><i></i></div><div class="so-chips"></div></div>
    <div class="so-bar2"><div class="so-sk so-pot"><kbd>R</kbd><span>🧪</span><small class="so-potn"></small></div>${SO.P.sk.slice(0, 9).map((s, i) => `<div class="so-sk ${s.k === 'spell' ? 'so-spl' : 'so-mvl'}" data-i="${i}" title="${esc(s.n)}: ${esc(s.d)}"><kbd>${i + 1}</kbd><span>${s.e}</span><small>${esc(s.n)}</small><i></i></div>`).join('')}</div>
    <div class="so-help">${document.pointerLockElement ? '' : 'Click to steer with the mouse'}</div>`;
  ov.appendChild(hud);
  if (SO.paused && !SO.over) { const p = document.createElement('div'); p.className = 'so-end'; p.innerHTML = `<div class="so-card"><h2>Paused</h2><p class="muted">The clock is stopped.</p><div class="so-keys">${SO_KEYS}</div><div class="so-btns"><button class="btn primary" data-so="resume">Resume</button><button class="btn ghost" data-so="quit">End the fight</button></div></div>`; ov.appendChild(p); }
  if (SO.over && SO.res) { const p = document.createElement('div'); p.className = 'so-end'; p.innerHTML = soResultHtml(); ov.appendChild(p); }
}
// after a fight: your damage, your best, the house's top hitters
function soResultHtml() {
  const r = SO.res, S = SO.stats, dealt = Math.round(SO.dealt), t = SO.time, hs = hsState();
  let top = '';
  if (r.pb && hs.id) {
    const f = hsFight(hs.id), rows = f.rows.filter(x => (x.d || 0) > 0).slice(0, 5);
    if (rows.length) top = `<div class="so-top"><div class="ftlbl">${esc(hsHouse(hs.id)?.name || 'House')} top hitters this week</div><ol>${rows.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span><span>${x.me ? 'You' : esc(x.name)}</span><b>${(x.d || 0).toLocaleString()}</b></li>`).join('')}</ol></div>`;
  }
  return `<div class="so-card so-res"><h2>${{ dead: 'YOU DIED', time: 'TIME', win: 'COLOSSUS FELLED', felled: 'COLOSSUS FELLED', quit: 'Fight ended' }[r.how]}</h2>
    <div class="so-big"><b>${dealt.toLocaleString()}</b><small>damage in ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</small></div>
    ${r.pb ? `<p class="so-pb">${r.pb.isNew ? `🏅 New personal best!${r.pb.old ? ` (was ${r.pb.old.toLocaleString()})` : ''}` : `Personal best: ${r.pb.now.toLocaleString()}`}</p>` : ''}
    <div class="so-stats"><span>🔗 Best combo <b>${S.combo}</b></span><span>💥 Weak hits <b>${S.weak}</b></span><span>✨ Perfect dodges <b>${S.perfect}</b></span><span>🛡️ Perfect guards <b>${S.guards}</b></span><span>🧪 Potions <b>${S.pots}/${SO_POTS}</b></span></div>
    ${r.out.map(x => `<p class="small-text">${x}</p>`).join('')}${top}
    <div class="so-btns"><button class="btn primary" data-so="close">Done</button></div></div>`;
}
function soHudTick() {
  const ov = document.getElementById('soov'); if (!ov || !SO || SO.intro) return;
  const P = SO.P, M = SO.me, B = SO.B, q = s => ov.querySelector(s);
  const pct = soPct(), ph = soPhase(), left = soLeft();
  // the big bar is this fight's own (phases at 70/40/15%); the house's weekly bar is the small line under it
  if (q('.so-bhp')) q('.so-bhp').style.width = (left * 100) + '%';
  const tag = B.stuck > 0 ? ' · fists stuck: weak point' : B.state === 'wind' || B.state === 'hold' || B.state === 'roll' || B.state === 'roar' ? ' · armoured' : B.state === 'recover' ? ' · open' : '';
  if (q('.so-bsub')) q('.so-bsub').textContent = (SO.shared ? `House bar ${Math.round(pct * 100)}%` : 'Test fight') + tag;
  if (q('.so-ph')) q('.so-ph').textContent = ph ? '· ' + SO_PH[ph].n : '';
  if (q('.so-dmg b')) q('.so-dmg b').textContent = Math.round(SO.dealt).toLocaleString();
  const cm = M.combo > 1 ? `🔗 ${M.combo} hits +${Math.round(Math.min(.6, (M.combo - 1) * .04) * 100)}%` : '';
  if (q('.so-combo') && q('.so-combo').textContent !== cm) q('.so-combo').textContent = cm;
  // the clock floats over your head: orange in the last 30 seconds, red in the last 10
  const tl = Math.max(0, SO_TIME - SO.time), pt = q('.so-ptime');
  if (pt) {
    const txt = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`; if (pt.textContent !== txt) pt.textContent = txt;
    pt.classList.toggle('warn', tl < 30 && tl >= 10); pt.classList.toggle('crit', tl < 10);
    const v0 = new THREE.Vector3(M.x, M.y + 2.05, M.z).project(SO.cam3), W0 = SO.canvas.clientWidth, H0 = SO.canvas.clientHeight;
    pt.style.transform = `translate(${(v0.x + 1) / 2 * W0}px, ${(1 - v0.y) / 2 * H0}px) translate(-50%, -100%)`; pt.style.opacity = SO.over || v0.z > 1 ? 0 : 1;
  }
  q('.so-cross')?.classList.toggle('aim', !!SO.aim);
  if (q('.so-hp i')) { q('.so-hp i').style.width = (P.hp / P.max * 100) + '%'; q('.so-hp span').textContent = `${Math.ceil(P.hp)} / ${P.max}${P.shield ? ` +${Math.round(P.shield)}` : ''}`; }
  if (q('.so-st i')) { q('.so-st i').style.width = Math.max(0, M.st) + '%'; q('.so-st').classList.toggle('low', M.st < SO_C.st.light); }
  if (q('.so-potn')) q('.so-potn').textContent = `${M.pots} left`;
  q('.so-pot')?.classList.toggle('cd', M.pots <= 0);
  const chips = [M.drowsy > 0 && '😴 Drowsy', M.emp > 0 && '✨ +30%', M.rally > 0 && '🎻 Rally', M.buff > 1 && '♟️ ×2 ready', M.reveal > 0 && `📖 ×${M.reveal}`, M.block && '🛡️ Blocking'].filter(Boolean).join(' · ');
  if (q('.so-chips') && q('.so-chips').textContent !== chips) q('.so-chips').textContent = chips;
  ov.querySelectorAll('.so-sk[data-i]').forEach(el => { const s = P.sk[+el.dataset.i], c = Math.max(0, (SO.hotCd[s.id] || 0) - SO.time); el.classList.toggle('cd', c > 0); el.querySelector('i').style.height = (c / soSkCd(s) * 100) + '%'; });
  ov.classList.toggle('hurt', (SO.hurtT = (SO.hurtT || 0) - .016) > 0);
  const W = SO.canvas.clientWidth, H = SO.canvas.clientHeight, v = new THREE.Vector3();
  SO.nums = SO.nums.filter(n => { n.t += .016; if (n.t > 1) { n.el.remove(); return false; } v.set(n.w.x, n.w.y + n.t * 1.2, n.w.z).project(SO.cam3); n.el.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px) translate(-50%, -50%)`; n.el.style.opacity = 1 - n.t * n.t; return true; });
}

// ---------- input ----------
const soLive = () => SO && !SO.intro && !SO.over;
addEventListener('keydown', e => {
  if (!SO) return;
  const k = e.key.toLowerCase();
  if (SO.intro || SO.over) { if (k === 'escape') { e.preventDefault(); soClose(); } e.stopImmediatePropagation(); return; }
  if (SO.cine) { e.preventDefault(); e.stopImmediatePropagation(); if (SO.cine.skip && !e.repeat) soCineEnd(); return; }
  e.stopImmediatePropagation(); if (k !== 'f5' && k !== 'f12') e.preventDefault();
  if (k === 'escape') { soPause(!SO.paused); return; }
  if (SO.paused) return;
  const map = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
  if (['w', 'a', 's', 'd', 'shift', 'f'].includes(k) || map[k]) SO.keys[map[k] || k] = true;
  else if (k === ' ' && !e.repeat) SO.me.jumpBuf = SO_C.buffer;
  else if (k === 'control' && !e.repeat) soAct('roll');
  else if (k === 'r' && !e.repeat) soPotion();
  else if (/^[1-9]$/.test(k) && !e.repeat) soSkill(+k - 1);
}, true);
addEventListener('keyup', e => {
  if (!SO) return; const k = e.key.toLowerCase(), map = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
  SO.keys[map[k] || k] = false; e.stopImmediatePropagation();
}, true);
addEventListener('blur', () => { if (soLive()) { SO.keys = {}; SO.me.hold = null; SO.aim = false; } });
function soPause(on) { if (!soLive()) return; SO.paused = on; SO.keys = {}; SO.me.hold = null; SO.aim = false; if (on && document.pointerLockElement) document.exitPointerLock(); soHudDraw(); }
addEventListener('pointerdown', e => {
  if (SO?.cine && e.target.closest?.('#soov')) { e.preventDefault(); if (SO.cine.skip) soCineEnd(); return; }
  if (!soLive() || SO.paused || !e.target.closest?.('#soov') || e.target.closest('.so-card, button, input, label')) return;
  e.preventDefault();
  if (document.pointerLockElement !== SO.canvas) { try { const p = SO.canvas.requestPointerLock(); if (p?.catch) p.catch(() => { }); } catch (er) { } if (!SO.clicked) { SO.clicked = 1; return; } }
  if (e.button === 0) SO.me.hold = SO.time; // released quickly = light, held = heavy
  else if (e.button === 2) SO.aim = true; // hold right click to aim
}, true);
addEventListener('pointerup', e => {
  if (SO && e.button === 2) { SO.aim = false; return; }
  if (!soLive() || e.button !== 0 || SO.me.hold == null) return;
  SO.me.hold = null; soAct('light');
}, true);
addEventListener('pointermove', e => {
  if (!soLive() || SO.paused || document.pointerLockElement !== SO.canvas) return;
  const k = SO.aim ? .55 : 1; // finer while aiming
  SO.cam.cy -= e.movementX * .0038 * k;
  SO.cam.cp = Math.max(-.45, Math.min(1, SO.cam.cp + e.movementY * .003 * k));
}, true);
addEventListener('contextmenu', e => { if (SO && e.target.closest?.('#soov')) e.preventDefault(); }, true);
addEventListener('wheel', e => { if (!soLive() || !e.target.closest?.('#soov')) return; e.preventDefault(); SO.cam.cd = Math.max(4, Math.min(10, SO.cam.cd * (e.deltaY > 0 ? 1.08 : .92))); }, { capture: true, passive: false });
document.addEventListener('pointerlockchange', () => { if (!soLive()) return; if (!document.pointerLockElement && SO.clicked && !SO.paused) soPause(true); else soHudDraw(); });
addEventListener('resize', () => { if (SO?.R) soResize(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-so]'); if (!el) return;
  const v = el.dataset.so;
  if (v === 'house' || v === 'bonus' || v === 'test' || v === 'trial') { e.preventDefault(); soOpen(v); return; }
  if (!SO) return;
  e.preventDefault();
  if (v === 'go') soStart();
  else if (v === 'cancel' || v === 'close') soClose();
  else if (v === 'resume') { SO.paused = false; soHudDraw(); }
  else if (v === 'quit') { SO.paused = false; soEnd('quit'); }
});

// ---------- the boss island: the weekly boss breathes, sways and looks around ----------
function biIdle(m) {
  BI_IDLE.m = m; BI_IDLE.y = m.position.y; if (BI_IDLE.raf) return;
  const tick = now => {
    BI_IDLE.raf = 0;
    if (IS3.house !== 'boss' || view !== 'islands' || !IS3.canvas?.isConnected || !BI_IDLE.m?.parent || hxLow()) return;
    const t = now / 1000, o = BI_IDLE.m;
    o.position.y = BI_IDLE.y + Math.sin(t * 1.6) * .08; o.rotation.y = Math.sin(t * .5) * .25; o.rotation.z = Math.sin(t * .8) * .03;
    is3draw(); BI_IDLE.raf = requestAnimationFrame(tick);
  };
  BI_IDLE.raf = requestAnimationFrame(tick);
}
const BI_IDLE = { m: null, y: 0, raf: 0 };
