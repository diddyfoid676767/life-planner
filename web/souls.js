'use strict';
/* 2.76 Souls fights, stage (a) (roadmap stage 5, boss-souls/plan.md). A real-time,
   third-person fight against the Snooze Golem in its own arena, the Snooze Hollow.
   Move set approved by Eli on 15 Nov 2026 (souls-stage5/first-boss-moves.md).
   - WASD move, mouse turns the camera (click to lock the mouse), left click light
     attack, right click heavy attack, Space dodge roll (i-frames; a perfect dodge
     just before a hit gives +25% damage for 3 s and wakes the Golem), hold Shift
     to block, Tab lock-on, 1-9 the hotbar: every equipped spell, move and class
     skill with real-time cooldowns. Esc pauses. Stamina pays for attacks, rolls
     and blocks.
   - One life, a 3 minute cap, every hit counts. In the Golem's own week the
     fight uses one of your weekly fights and goes on the shared house bar
     (same caps, gear chance and rules as the quick fight, via ftEnd). Any other
     week it's a free Trial from the Practice yard: no attempt used, no reward.
   - Golem: Pillow Punch, SLAM, Snooze Wave, Roll Over. It dozes between combos
     with stone armour (-40% damage); a light spell or a perfect dodge wakes it
     (no armour for 6 s). Phases from the shared bar (or the trial's own health):
     75% Alarm Barrage, 50% Restless (faster, Punch chains into SLAM), 25% Wide
     Awake (never dozes, SLAM sends a shockwave). +10% damage each phase.
   - Easy timing (slower wind-ups) and auto lock-on switches, no reward penalty. */

const SO_TIME = 180, SO_TRIAL_HP = 900, SO_ARENA = 13.2, SO_BOSS = 'Snooze Golem';
const SO_ST = { max: 100, regen: 32, delay: .55, light: 16, heavy: 30, roll: 24, skill: 12 };
const SO_ATK = { // wind-up (s), damage, reach
  punch: { w: .8, d: 14, r: 3.6 }, slam: { w: 1.2, d: 26, r: 4.2 }, wave: { w: 1, d: 8 }, roll: { w: 1, d: 20 }, alarm: { w: 1.2, d: 10, r: 1.7 }, shock: { d: 12 },
};
let SO = null;
function soGolemWeek() { return hsBoss(mondayOf(today())).n === SO_BOSS && bossWeek() !== 'rest'; }
const soEasy = () => !!D.settings.soEasy, soAuto = () => !!D.settings.soAuto;

// ---------- start, end ----------
function soOpen(kind) {
  if (SO || (typeof FT !== 'undefined' && FT)) return;
  if (!need3D()) { toast('Loading 3D…', 'Try again in a moment.'); return; }
  if (!webglOK()) { toast('No 3D here', 'This computer can\'t draw the Souls fight. The quick fight still works.'); return; }
  if (kind === 'house' && (!soGolemWeek() || !hsState().id || !ftAttempts().left)) kind = 'trial';
  SO = { kind, intro: true };
  soOverlay(); soIntroDraw();
}
function soStart() {
  const kind = SO.kind, P = ftMe(kind === 'house'), wk = mondayOf(today());
  let shared = null;
  if (kind === 'house') {
    const st = ftState(); st.att[today()] = (st.att[today()] || 0) + 1; save(); // taken up front, like the quick fight
    const f = hsFight(hsState().id); shared = { hp: f.hp, left: f.left };
  }
  Object.assign(SO, { intro: false, P, wk, shared, dealt: 0, time: 0, over: false, paused: false, keys: {}, mouse: {}, lock: soAuto(), hotCd: {}, nums: [], fx: [], tele: [], projs: [], log: [],
    me: { x: 0, z: 7, y: 0, face: Math.PI, sp: 0, st: SO_ST.max, stT: 0, act: null, actT: 0, iUntil: 0, drowsy: 0, emp: 0, buff: 1, rally: 0, reveal: 0, hitBy: {} },
    B: { x: 0, z: -4, face: 0, hp: kind === 'trial' ? SO_TRIAL_HP : Infinity, max: SO_TRIAL_HP, state: 'idle', t: 1.6, atk: null, doze: 0, awake: 0, mark: 0, dot: [], stag: 0, combo: 0, rollV: null, cool: {} },
    cam: { cy: 0, cp: .32, cd: 6.4 }, t: performance.now(), acc: 0 });
  document.querySelector('#soov .so-intro')?.remove();
  soScene();
  soHudDraw(); soLoop();
  if (typeof sfx === 'function') sfx('start');
}
function soEnd(how) {
  if (SO.over) return; SO.over = true;
  if (document.pointerLockElement) document.exitPointerLock();
  const out = [];
  if (SO.kind === 'house') {
    const F = { kind: 'house', dealt: SO.dealt, bossName: SO_BOSS };
    ftEnd(F, how === 'dead' ? 'down' : 'time'); out.push(...F.res.out);
  } else {
    out.push(`Trial over: you dealt <b>${Math.round(SO.dealt).toLocaleString()}</b> damage${SO.B.hp <= 0 ? ' and beat the trial Golem' : ''}. Trials are practice: no attempt used and no reward.`);
    out.push(soGolemWeek() ? 'It\'s the Golem\'s week: a real Souls fight goes on your house\'s shared bar.' : `The Golem's next week as the Warband is coming up. Until then, keep practising.`);
  }
  SO.res = { how, out };
  setTimeout(() => SO && soHudDraw(), how === 'dead' ? 900 : 200);
  if (typeof sfx === 'function') sfx(how === 'dead' ? 'error' : 'success');
}
function soClose() {
  if (!SO) return;
  cancelAnimationFrame(SO.raf); if (document.pointerLockElement) document.exitPointerLock();
  if (SO.S) SO.S.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (SO.R) { SO.R.dispose(); SO.R.forceContextLoss?.(); }
  document.getElementById('soov')?.remove(); SO = null; render();
}

// ---------- the arena: the Snooze Hollow ----------
function soScene() {
  const R = SO.R = fxRenderer(), S = SO.S = new THREE.Scene(), low = hxLow();
  SO.canvas = R.domElement; SO.canvas.className = 'socanvas'; document.getElementById('soov').prepend(SO.canvas);
  S.background = new THREE.Color('#0b0a1a'); S.fog = new THREE.Fog('#0b0a1a', 24, 62);
  SO.cam3 = new THREE.PerspectiveCamera(58, 1, .1, 200);
  S.add(new THREE.HemisphereLight('#8f98d9', '#2a2238', .62));
  const moon = new THREE.DirectionalLight('#b9c6ff', 1.05); moon.position.set(-8, 26, 10); moon.castShadow = !low; moon.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 }); S.add(moon);
  const W = new THREE.Group(); S.add(W); const rnd = seeded('snooze-hollow');
  const m = (geo, col, x, y, z, glow) => is3mesh(geo, col, x, y, z, W, glow);
  const fl = m(new THREE.CylinderGeometry(16, 16.5, .6, 40), '#4a4458', 0, -.3, 0); fl.receiveShadow = true;
  const rune = m(new THREE.TorusGeometry(SO_ARENA - .4, .06, 4, 64), '#66d9e8', 0, .03, 0, true); rune.rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) { const c = m(new THREE.CircleGeometry(.6 + rnd() * 1.2, 7), '#57506a', (rnd() - .5) * 20, .01, (rnd() - .5) * 20); c.rotation.x = -Math.PI / 2; c.castShadow = false; }
  // the cave wall: a ring of big rocks, glowing crystals in the cracks
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, r = 18.2 + rnd() * 2, h = 4 + rnd() * 6, rk = m(is3rock(new THREE.DodecahedronGeometry(2.4 + rnd() * 1.4, 0), rnd, .25), rnd() < .5 ? '#3f3650' : '#352d44', Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); rk.scale.set(1, h / 3.5, 1); rk.rotation.y = rnd() * 6; }
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, r = 14.2 + rnd() * 1.2, h = .8 + rnd() * 1.6, cr = m(new THREE.ConeGeometry(.3 + rnd() * .25, h, 5), rnd() < .6 ? '#66d9e8' : '#9775fa', Math.cos(a) * r, h / 2, Math.sin(a) * r, true); cr.rotation.set((rnd() - .5) * .6, 0, (rnd() - .5) * .6); }
  // the giant stone bed at the back, with a pillow and a blanket
  const bed = new THREE.Group(); bed.position.set(0, 0, -15.5); W.add(bed);
  is3mesh(new THREE.BoxGeometry(11, 1.6, 6), '#6f6680', 0, .8, 0, bed); is3mesh(new THREE.BoxGeometry(11.6, 5, 1), '#5a5168', 0, 2.5, -3, bed);
  is3mesh(new THREE.BoxGeometry(10.6, .7, 4.2), '#4263eb', 0, 1.9, .8, bed); const pil = is3mesh(new THREE.SphereGeometry(1.5, 14, 10), '#e9ecef', -2.4, 2.4, -1.6, bed); pil.scale.set(1.5, .55, .9);
  // alarm clocks, broken and scattered
  for (const [x, z, r] of [[-8, -6, .4], [9, -3, 2], [-6, 8, 1.2], [7.5, 7, 2.8]]) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, r, 1.2); W.add(g); is3mesh(new THREE.CylinderGeometry(.9, .9, .5, 16), '#e03131', 0, .9, 0, g); is3mesh(new THREE.CylinderGeometry(.75, .75, .52, 16), '#f8f9fa', 0, .9, 0, g); for (const s of [-1, 1]) is3mesh(new THREE.SphereGeometry(.3, 8, 6), '#ffd43b', s * .6, 1.75, 0, g); }
  // the moonbeam through the roof
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 6, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#b9c6ff', transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(-3, 14, 3); beam.rotation.z = .25; S.add(beam);
  for (const [x, z] of [[-11, -9], [11, -9]]) { const t = new THREE.PointLight('#ff922b', 1.1, 16, 1.6); t.position.set(x, 3.2, z); S.add(t); m(new THREE.CylinderGeometry(.14, .1, 2.6, 6), '#495057', x, 1.3, z); m(new THREE.ConeGeometry(.24, .6, 5), '#ff922b', x, 2.9, z, true); }
  // the Golem and you
  SO.gol = soGolem(); S.add(SO.gol.root);
  const d = youAvData(pfSpec()), fig = av3figure({ ...d.spec, force: '' }, d.gear || {}, d.cls || '');
  fig.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const pg = SO.pfig = new THREE.Group(); pg.add(fig); pg.userData.f = fig; fig.scale.multiplyScalar(.85); S.add(pg);
  const P = fig.userData.P, sw = new THREE.Group(); sw.position.set(0, -.05, .05); sw.rotation.x = Math.PI / 2; P.hands[1].add(sw); // a sword in your right hand
  is3mesh(new THREE.BoxGeometry(.08, 1.1, .03), '#dee2e6', 0, .62, 0, sw); is3mesh(new THREE.BoxGeometry(.34, .06, .08), '#ffd43b', 0, .08, 0, sw); is3mesh(new THREE.CylinderGeometry(.035, .035, .22, 6), '#6b4c33', 0, -.05, 0, sw);
  SO.lockMark = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 20), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: .9, depthTest: false })); SO.lockMark.renderOrder = 9; S.add(SO.lockMark);
  soResize();
}
// the Snooze Golem with real joints so it can move: body, head, two arms with fists, two legs
function soGolem() {
  const root = new THREE.Group(), body = new THREE.Group(), T = c => c, rk = (r, s) => is3rock(new THREE.DodecahedronGeometry(r, 0), seeded(s), .2);
  root.add(body); body.position.y = 2.6;
  const torso = is3mesh(rk(1.5, 'g-t'), '#868e96', 0, 0, 0, body); torso.scale.set(1.25, 1, .95);
  const head = new THREE.Group(); head.position.set(0, 1.65, .15); body.add(head);
  is3mesh(rk(.8, 'g-h'), '#adb5bd', 0, .1, 0, head);
  const eyes = []; for (const s of [-1, 1]) eyes.push(is3mesh(new THREE.BoxGeometry(.32, .08, .08), '#66d9e8', s * .3, .2, .74, head, true));
  const cap = is3mesh(new THREE.ConeGeometry(.65, 1.2, 7), '#4263eb', .15, .95, 0, head); cap.rotation.z = -.5; is3mesh(new THREE.SphereGeometry(.17, 8, 6), '#ffffff', .72, 1.2, 0, head);
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
  return { root, body, head, eyes, arms, legs, zz, flash: 0 };
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
    if (!SO.paused && !SO.intro) { SO.acc += dt; while (SO.acc >= 1 / 60) { SO.acc -= 1 / 60; if (!SO.over) soStep(1 / 60); else soStepDead(1 / 60); } }
    soDraw(now / 1000);
    SO.raf = requestAnimationFrame(tick);
  };
  SO.raf = requestAnimationFrame(tick);
}
const soPhase = () => { const p = soPct(); return p <= .25 ? 3 : p <= .5 ? 2 : p <= .75 ? 1 : 0; };
function soPct() { if (SO.kind === 'trial') return Math.max(0, SO.B.hp / SO.B.max); const s = SO.shared; return s ? Math.max(0, (s.left - SO.dealt) / s.hp) : 1; }
const soDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const soAng = d => Math.atan2(Math.sin(d), Math.cos(d));
function soStep(dt) {
  const M = SO.me, B = SO.B, K = SO.keys, P = SO.P;
  SO.time += dt; if (SO.time >= SO_TIME) { soEnd('time'); return; }
  // stamina
  M.stT -= dt; if (M.stT <= 0 && !M.block) M.st = Math.min(SO_ST.max, M.st + SO_ST.regen * (M.drowsy > 0 ? .5 : 1) * dt);
  for (const k of ['drowsy', 'emp', 'rally']) if (M[k] > 0) M[k] -= dt;
  if (P.g?.rg && Math.floor(SO.time) !== Math.floor(SO.time - dt) && Math.floor(SO.time) % 4 === 0) soHeal(P.g.rg, '');
  if (P.cls === 'bard' && Math.floor(SO.time) !== Math.floor(SO.time - dt) && Math.floor(SO.time) % 4 === 0) soHeal(Math.round(P.max * .02), '');
  // your action
  if (M.act) { M.actT += dt; soActStep(M, dt); }
  M.block = !!K.shift && !M.act && M.st > 0;
  // movement
  const fw = (K.w ? 1 : 0) - (K.s ? 1 : 0), stf = (K.d ? 1 : 0) - (K.a ? 1 : 0);
  const cy = SO.cam.cy; let mx = 0, mz = 0;
  if (fw || stf) { const c = Math.cos(cy), s = Math.sin(cy); mx = -s * fw + c * stf; mz = -c * fw - s * stf; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
  const busy = M.act && M.act.k !== 'roll';
  const spd = (M.block ? 2 : 4.4) * (M.drowsy > 0 ? .6 : 1) * (busy ? .25 : 1) * (fw || stf ? 1 : 0);
  if (M.act?.k === 'roll') { const r = M.act; M.x += r.dx * 7.2 * dt * (M.actT < .42 ? 1 : .3); M.z += r.dz * 7.2 * dt * (M.actT < .42 ? 1 : .3); }
  else { M.sp += (spd - M.sp) * Math.min(1, dt * 12); if (fw || stf) { M.x += mx * M.sp * dt; M.z += mz * M.sp * dt; M.mx = mx; M.mz = mz; } }
  // facing: at the boss when locked on, else where you move
  const toB = Math.atan2(B.x - M.x, B.z - M.z);
  if (SO.lock && !M.act?.k?.startsWith('roll')) M.face += soAng(toB - M.face) * Math.min(1, dt * 14);
  else if ((fw || stf) && !busy) M.face += soAng(Math.atan2(mx, mz) - M.face) * Math.min(1, dt * 14);
  // the arena edge and the Golem's body push you back
  const r = Math.hypot(M.x, M.z); if (r > SO_ARENA) { M.x *= SO_ARENA / r; M.z *= SO_ARENA / r; }
  const db = soDist(M, B); if (db < 2.5 && B.state !== 'roll' && B.state !== 'down') { const k = 2.5 / Math.max(.01, db); M.x = B.x + (M.x - B.x) * k; M.z = B.z + (M.z - B.z) * k; }
  if (SO.lock) SO.cam.cy += soAng(Math.atan2(M.x - B.x, M.z - B.z) - SO.cam.cy) * Math.min(1, dt * 6);
  soBossStep(dt);
  soProjStep(dt);
  if (P.hp <= 0) soEnd('dead');
  if (SO.kind === 'trial' && B.hp <= 0 || SO.kind === 'house' && SO.shared && SO.shared.left - SO.dealt <= 0) { B.state = 'down'; B.t = 0; soClearTele(); soEnd('win'); }
}
function soStepDead(dt) { const B = SO.B; if (B.state === 'down') B.t += dt; if (SO.P.hp <= 0) SO.me.deadT = (SO.me.deadT || 0) + dt; soProjStep(dt); }

// ---------- your attacks ----------
const SO_ACTS = {
  light: { st: SO_ST.light, dur: .5, hit: [.2], reach: 2.5, arc: 1.3, m: 1 },
  heavy: { st: SO_ST.heavy, dur: .95, hit: [.55], reach: 2.9, arc: 1.5, m: 2.4 },
  roll: { st: SO_ST.roll, dur: .6 },
};
function soAct(k, dir) {
  const M = SO.me, A = SO_ACTS[k]; if (!SO || SO.over || SO.paused || !A) return;
  if (M.act && !(M.act.k !== 'roll' && k === 'roll' && M.actT > .1)) return; // you can roll out of an attack's tail
  if (M.st <= 0) { soPop('😮‍💨 No stamina', 'bad'); return; }
  M.st -= A.st; M.stT = SO_ST.delay;
  M.act = { k, done: {} }; M.actT = 0;
  if (k === 'roll') {
    let dx = M.mx || Math.sin(M.face), dz = M.mz || Math.cos(M.face); const K = SO.keys; if (!(K.w || K.a || K.s || K.d)) { dx = -Math.sin(M.face); dz = -Math.cos(M.face); }
    M.act.dx = dx; M.act.dz = dz; M.iUntil = SO.time + .4; M.rollAt = SO.time; if (!SO.lock) M.face = Math.atan2(dx, dz);
    if (typeof sfx === 'function') sfx('whoosh', { gap: 60 });
  }
}
function soActStep(M, dt) {
  const a = M.act, A = SO_ACTS[a.k] || a.def;
  if (A.hit) A.hit.forEach((t, i) => { if (!a.done[i] && M.actT >= t) { a.done[i] = 1; soSwing(a, A); } });
  if (M.actT >= (A.dur || .5)) M.act = null;
}
function soSwing(a, A) {
  const M = SO.me, B = SO.B, d = soDist(M, B) - 2.2, ang = Math.abs(soAng(Math.atan2(B.x - M.x, B.z - M.z) - M.face));
  if (typeof sfx === 'function') sfx('whoosh', { gap: 40 });
  if (d > A.reach || ang > A.arc) return;
  if (a.sk) { soSkillHit(a.sk); return; }
  const s = SO.P.s, base = (3 + (s.str || 5) * .06 + (s.agi || 5) * .02) * A.m;
  soHit(base, { label: a.k === 'heavy' ? 'heavy' : '', st: 'str', base: true });
}
// one hit on the Golem, with every multiplier
function soHit(n, o = {}) {
  const B = SO.B, M = SO.me, P = SO.P, g = P.g || {};
  let mult = 1;
  const sk = o.sk; if (sk) mult *= 1 + (sk.k === 'spell' ? (g.sp || 0) + (P.cls === 'sage' ? .15 : 0) : (g.mv || 0) + (P.cls === 'striker' ? .15 : 0));
  let weak = false;
  if (sk && sk.st === 'str' && sk.k === 'move') weak = true;
  if (M.reveal > 0 && !o.dot) { weak = true; M.reveal--; }
  if (weak) mult *= 1.5 + (g.wk || 0);
  const crit = !o.dot && Math.random() < (g.cr || 0) + .05; if (crit) mult *= 1.5;
  if (B.doze > 0) mult *= .6;
  if (B.mark > 0) mult *= 1.25;
  if (M.emp > 0) mult *= 1.25;
  if (M.rally > 0) mult *= 1.3;
  if (M.buff > 1 && !o.dot) { mult *= M.buff; M.buff = 1; }
  n = Math.max(1, Math.round(n * mult));
  SO.dealt += n; if (SO.kind === 'trial') B.hp = Math.max(0, B.hp - n);
  SO.gol.flash = .12;
  soNum(n, weak ? 'weak' : crit ? 'crit' : B.doze > 0 ? 'arm' : '');
  if (weak && !SO.weakSeen) { SO.weakSeen = 1; soPop('💥 Super effective!', 'good'); }
  if (typeof sfx === 'function') sfx(o.base ? 'pop' : 'coin', { gap: 30 });
  return n;
}
function soHeal(n, label) { const P = SO.P, got = Math.min(Math.round(n), P.max - P.hp); P.hp += got; if (label && got) soPop(`${label} +${got}`, 'good'); }

// ---------- the hotbar: every equipped skill ----------
const soSkCd = s => 3 + (s.cd || 0) * 3; // seconds
function soSkill(i) {
  const s = SO?.P?.sk[i], M = SO?.me; if (!s || SO.over || SO.paused || M.act) return;
  if ((SO.hotCd[s.id] || 0) > SO.time) return;
  if (M.st < SO_ST.skill) { soPop('😮‍💨 No stamina', 'bad'); return; }
  M.st -= SO_ST.skill; M.stT = SO_ST.delay; SO.hotCd[s.id] = SO.time + soSkCd(s);
  const P = SO.P, stat = P.s[s.st] || 5;
  if (s.fx === 'heal') { soHeal(P.max * s.pw / 100 * (.7 + stat / 150), `${s.e} ${s.n}`); if (s.cleanse) M.drowsy = 0; }
  else if (s.fx === 'shield') { const n = Math.round(P.max * s.pw / 100 * (.7 + stat / 150)); P.shield = (P.shield || 0) + n; soPop(`${s.e} ${s.n} +${n} shield`, 'good'); }
  else if (s.fx === 'buff') { M.buff = 2; soPop(`${s.e} Next hit ×2`, 'good'); }
  else if (s.fx === 'rally') { M.rally = 10; soPop(`${s.e} Rally: +30% for 10 s`, 'good'); }
  if (s.fx === 'reveal') M.reveal = 2;
  if (!s.pw || s.fx === 'heal' || s.fx === 'shield') { M.act = { k: 'cast', done: {}, def: { dur: .35 } }; M.actT = 0; return; }
  if (s.k === 'spell') { // a bolt of light that flies at the Golem
    M.act = { k: 'cast', done: {}, def: { dur: .4 } }; M.actT = 0;
    for (let h = 0; h < (s.hits || 1); h++) SO.projs.push({ s, x: M.x, z: M.z, y: 1.4, t: -h * .15, col: s.t === 'light' ? '#ffd43b' : '#9775fa' });
  } else { // a move: a lunge and a strike
    M.act = { k: 'skill', sk: s, done: {}, def: { dur: .6, hit: Array.from({ length: s.hits || 1 }, (_, i) => .22 + i * .12), reach: 3.2, arc: 1.6 } }; M.actT = 0;
    M.x += Math.sin(M.face) * .9; M.z += Math.cos(M.face) * .9;
  }
  if (typeof sfx === 'function') sfx('start', { gap: 50 });
}
function soSkillHit(s) {
  const P = SO.P, B = SO.B, stat = P.s[s.st] || 5, n = s.pw * (.5 + stat / 80) * .6;
  soHit(n, { sk: s });
  if (s.t === 'light') soWake('☀️ Light wakes the Golem!');
  if (s.fx === 'mark') { B.mark = 8; soPop('🏹 Marked: +25% damage taken', 'good'); }
  if (s.dot) B.dot.push({ n: s.dot * .6, left: 3, t: 1 });
  if (s.heal) soHeal(P.max * s.heal / 100, '');
  if (s.stun && Math.random() < s.stun) { B.stag = 1.2; if (B.state === 'wind') { B.state = 'idle'; B.t = .4; soClearTele(); } soPop('💫 Staggered!', 'good'); }
}
function soProjStep(dt) {
  const B = SO.B;
  SO.projs = SO.projs.filter(p => {
    p.t += dt; if (p.t < 0) return true;
    if (!p.m) { p.m = is3mesh(new THREE.IcosahedronGeometry(.28, 1), p.col, p.x, p.y, p.z, SO.S, true); p.m.castShadow = false; }
    const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz), v = 22 * dt;
    if (d < 1.8 || p.t > 2) { SO.S.remove(p.m); p.m.geometry.dispose(); if (d < 1.8 && !SO.over) soSkillHit(p.s); return false; }
    p.x += dx / d * v; p.z += dz / d * v; p.y += ((B.state === 'roll' ? 1.5 : 3) - p.y) * dt * 3; p.m.position.set(p.x, p.y, p.z); return true;
  });
}

// ---------- the Golem ----------
function soWake(msg) { const B = SO.B; if (soPhase() >= 3) return; B.awake = 6; if (B.doze > 0) { B.doze = 0; B.state = 'idle'; B.t = .3; soPop(msg, 'good'); } }
function soBossStep(dt) {
  const B = SO.B, M = SO.me, ph = soPhase(), fast = (ph >= 2 ? 1.15 : 1) / (soEasy() ? 1.45 : 1);
  if (ph !== SO.lastPh) { if (SO.lastPh != null && ph > SO.lastPh) soPop(['', '⏰ Phase 2: Alarm Barrage', '😤 Phase 3: Restless', '👁️ Phase 4: Wide Awake'][ph], 'phase'); SO.lastPh = ph; }
  for (const k of ['awake', 'mark']) if (B[k] > 0) B[k] -= dt;
  for (const d of B.dot) { d.t -= dt; if (d.t <= 0 && d.left > 0) { d.t = 1; d.left--; soHit(d.n, { dot: true }); } } B.dot = B.dot.filter(d => d.left > 0);
  if (B.stag > 0) { B.stag -= dt; return; }
  const dist = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z);
  B.t -= dt;
  switch (B.state) {
    case 'idle': case 'chase': {
      B.face += soAng(toP - B.face) * Math.min(1, dt * 3.5 * fast);
      if (dist > 3.4) { const sp = 1.7 * fast; B.x += Math.sin(B.face) * sp * dt; B.z += Math.cos(B.face) * sp * dt; B.state = 'chase'; } else B.state = 'idle';
      const r = Math.hypot(B.x, B.z); if (r > SO_ARENA - 1.5) { B.x *= (SO_ARENA - 1.5) / r; B.z *= (SO_ARENA - 1.5) / r; }
      if (B.t <= 0) soBossPick(dist, ph);
      break;
    }
    case 'doze': B.doze -= dt; if (B.doze <= 0 || B.awake > 0) { B.doze = 0; B.state = 'idle'; B.t = .5; } break;
    case 'wind': {
      const a = B.atk;
      if (a.k === 'punch' || a.k === 'slam') B.face += soAng(toP - B.face) * Math.min(1, dt * (a.k === 'punch' ? 4 : 1.5));
      soTeleStep(a, 1 - B.t / a.w);
      if (B.t <= 0) soBossStrike(a, ph);
      break;
    }
    case 'roll': {
      const a = B.atk, sp = 13 * fast; B.x += a.dx * sp * dt; B.z += a.dz * sp * dt; a.go -= sp * dt;
      if (soDist(B, M) < 2 && !a.hit) { a.hit = 1; if (!soDodged(a)) soHurt(SO_ATK.roll.d, 'Roll Over'); }
      if (a.go <= 0 || Math.hypot(B.x, B.z) > SO_ARENA - 1) { B.state = 'recover'; B.t = 1 / fast; soClearTele(); }
      break;
    }
    case 'recover': if (B.t <= 0) soBossAfter(ph); break;
    case 'wave': { // the sleep mist ring spreads out along the floor
      const w = B.wave; w.r += 7 * dt; if (w.m) { w.m.scale.setScalar(w.r); w.m.material.opacity = Math.max(0, .55 - w.r / 40); }
      const dp = soDist(w, M); if (!w.hit && Math.abs(dp - w.r) < .7) { w.hit = 1; if (!soDodged(w)) { soHurt(w.d, w.n); if (w.k === 'wave') { M.drowsy = 3; soPop('😴 Drowsy: slower, half stamina', 'bad'); } } }
      if (w.r > 22) { SO.S.remove(w.m); w.m.geometry.dispose(); B.wave = null; B.state = 'recover'; B.t = .2; }
      break;
    }
  }
  // alarm clocks thrown in phase 2+ land on their own timers
  SO.tele = SO.tele.filter(t => { if (!t.alarm) return true; t.t -= dt; if (t.m) t.m.material.opacity = .25 + (1 - t.t / t.w) * .5; if (t.t > 0) return true; if (Math.hypot(t.x - M.x, t.z - M.z) < SO_ATK.alarm.r && !soDodged(t)) soHurt(SO_ATK.alarm.d, 'Alarm'); soBoom(t.x, t.z, '#ffd43b'); SO.S.remove(t.m); t.m.geometry.dispose(); return false; });
}
function soBossPick(dist, ph) {
  const B = SO.B, c = B.cool, now = SO.time, can = k => !(c[k] > now);
  let k;
  if (B.chain) { k = B.chain; B.chain = null; }
  else if (ph >= 1 && can('alarm') && Math.random() < .3) k = 'alarm';
  else if (dist > 7 && can('roll')) k = 'roll';
  else if (can('wave') && Math.random() < .22) k = 'wave';
  else if (dist < 3.6) k = ph >= 2 && Math.random() < .5 ? 'punch2' : Math.random() < .6 ? 'punch' : 'slam';
  else if (dist < 4.6 && can('slam')) k = 'slam';
  else { B.t = .3; return; }
  if (k === 'punch2') { k = 'punch'; B.chain = 'slam'; }
  c[k] = now + { punch: 1.5, slam: 4, wave: 9, roll: 7, alarm: 11 }[k];
  const fast = (ph >= 2 ? 1.15 : 1) / (soEasy() ? 1.45 : 1), w = SO_ATK[k].w / fast;
  B.atk = { k, w, n: { punch: 'Pillow Punch', slam: 'SLAM', wave: 'Snooze Wave', roll: 'Roll Over', alarm: 'Alarm Barrage' }[k] };
  B.state = 'wind'; B.t = w; B.combo++;
  soTeleMake(B.atk);
  if (typeof sfx === 'function') sfx(k === 'slam' ? 'deny' : 'tab', { gap: 80 });
}
// the warnings on the floor: a red circle for SLAM, a cone for the punch, a lane for the roll, circles for alarms
function soTeleMake(a) {
  const B = SO.B, M = SO.me, mat = (c, o = .3) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const add = (geo, c, x, z, rot = 0) => { const m = new THREE.Mesh(geo, mat(c)); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, .04, z); m.renderOrder = 2; SO.S.add(m); SO.tele.push({ m, a }); return m; };
  if (a.k === 'slam') { a.tm = add(new THREE.CircleGeometry(SO_ATK.slam.r, 40), '#ff3b3b', B.x, B.z); const e = add(new THREE.RingGeometry(SO_ATK.slam.r - .15, SO_ATK.slam.r, 48), '#ff6b6b', B.x, B.z); e.material.opacity = .9; }
  else if (a.k === 'punch') { a.tm = add(new THREE.CircleGeometry(SO_ATK.punch.r, 24, -1, 2), '#ff8f3b', B.x, B.z); a.cone = 1; }
  else if (a.k === 'roll') { const ang = Math.atan2(M.x - B.x, M.z - B.z), L = 16; a.dx = Math.sin(ang); a.dz = Math.cos(ang); a.go = L; const g = new THREE.PlaneGeometry(3.4, L); g.translate(0, L / 2, 0); a.tm = add(g, '#ff8f3b', B.x, B.z, ang + Math.PI); a.lane = 1; }
  else if (a.k === 'alarm') { for (let i = 0; i < 4; i++) { const x = M.x + (i ? (Math.random() - .5) * 7 : 0), z = M.z + (i ? (Math.random() - .5) * 7 : 0), m = new THREE.Mesh(new THREE.CircleGeometry(SO_ATK.alarm.r, 24), mat('#ffd43b')); m.rotation.x = -Math.PI / 2; m.position.set(x, .05, z); SO.S.add(m); SO.tele.push({ alarm: 1, m, x, z, t: a.w + .4 + i * .25, w: a.w + .4 + i * .25 }); } }
}
function soTeleStep(a, p) {
  if (!a.tm) return; a.tm.material.opacity = .3 + p * .5;
  if (a.cone) { a.tm.position.set(SO.B.x, .04, SO.B.z); a.tm.rotation.z = SO.B.face - Math.PI / 2; }
}
function soClearTele() { SO.tele = SO.tele.filter(t => { if (t.alarm) return true; SO.S.remove(t.m); t.m.geometry.dispose(); return false; }); }
function soBossStrike(a, ph) {
  const B = SO.B, M = SO.me, d = soDist(B, M), toP = Math.atan2(M.x - B.x, M.z - B.z);
  soClearTele();
  if (a.k === 'punch') { if (d < SO_ATK.punch.r && Math.abs(soAng(toP - B.face)) < 1.1 && !soDodged(a)) soHurt(SO_ATK.punch.d, a.n); B.state = 'recover'; B.t = .55; SO.shake = .15; }
  else if (a.k === 'slam') {
    if (d < SO_ATK.slam.r && !soDodged(a)) soHurt(SO_ATK.slam.d, a.n);
    soBoom(B.x, B.z, '#ff6b3d', 3); SO.shake = .45; if (typeof sfx === 'function') sfx('error', { gap: 100 });
    if (ph >= 3) { B.wave = { x: B.x, z: B.z, r: 1, d: SO_ATK.shock.d, n: 'Shockwave', k: 'shock', m: soRing('#ff6b3d') }; B.state = 'wave'; } else { B.state = 'recover'; B.t = 1.1; }
  }
  else if (a.k === 'wave') { B.wave = { x: B.x, z: B.z, r: 1, d: SO_ATK.wave.d, n: a.n, k: 'wave', m: soRing('#74c0fc') }; B.state = 'wave'; }
  else if (a.k === 'roll') { B.state = 'roll'; }
  else { B.state = 'recover'; B.t = .6; }
}
function soRing(col) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 6, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.set(SO.B.x, .3, SO.B.z); SO.S.add(m); return m; }
// after a combo it dozes off in its stone armour (not once it's Wide Awake, or while it's been woken)
function soBossAfter(ph) {
  const B = SO.B;
  if (B.chain) { B.state = 'idle'; B.t = .15; return; }
  if (ph < 3 && B.awake <= 0 && B.combo >= 2 + Math.floor(Math.random() * 2)) { B.combo = 0; B.state = 'doze'; B.doze = 2.6 + Math.random(); soPop('💤 It dozes off: stone armour', ''); return; }
  B.state = 'idle'; B.t = (.9 + Math.random() * .7) / (ph >= 2 ? 1.15 : 1) * (soEasy() ? 1.3 : 1);
}
// was this hit dodged? i-frames from a roll, and a perfect dodge if the roll started just before
function soDodged(a) {
  const M = SO.me; if (SO.time > M.iUntil) return false;
  if (SO.time - M.rollAt < .22 && M.perfRoll !== M.rollAt) { M.perfRoll = M.rollAt; M.emp = 3; soPop('✨ Perfect dodge! +25% damage', 'good'); soWake('⏰ The Golem jolts awake!'); }
  return true;
}
function soHurt(n, name) {
  const P = SO.P, M = SO.me, g = P.g || {};
  n *= (1 + soPhase() * .1) * (1 - Math.min(.5, (g.dr || 0) + (P.cls === 'guardian' ? .2 : 0)));
  if (P.cls === 'rogue' && Math.random() < .12) { soPop('🗡️ Rogue: dodged', 'good'); return; }
  if (M.block && M.st > 0) { M.st -= n * 1.5; M.stT = SO_ST.delay; n *= .3; if (M.st <= 0) { M.st = 0; M.act = { k: 'stagger', done: {}, def: { dur: .8 } }; M.actT = 0; soPop('🛡️ Guard broken!', 'bad'); } else soPop('🛡️ Blocked', ''); }
  n = Math.max(1, Math.round(n));
  const sh = Math.min(P.shield || 0, n); P.shield = (P.shield || 0) - sh; n -= sh;
  P.hp = Math.max(0, P.hp - n); SO.hurtT = .35; soNum(n, 'me');
  if (typeof sfx === 'function') sfx('deny', { gap: 60 });
}
function soBoom(x, z, col, s = 1.5) {
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, m = is3mesh(new THREE.IcosahedronGeometry(.25, 0), col, x, .4, z, SO.S, true); m.castShadow = false; m.material = m.material.clone(); m.material.transparent = true; SO.fx.push({ m, a, x, z, t: 0, s }); }
}

// ---------- drawing ----------
function soDraw(t) {
  if (!SO.R || !SO.S) return;
  const M = SO.me, B = SO.B, G = SO.gol, cam = SO.cam3, C = SO.cam;
  // you
  const pf = SO.pfig, f = pf.userData.f, P = f.userData.P;
  pf.position.set(M.x, 0, M.z); pf.rotation.y = M.face;
  const a = M.act, at = M.actT || 0;
  f.rotation.x = 0; f.position.y = 0;
  P.arms[1].rotation.x = 0; P.arms[0].rotation.x = 0; P.arms[1].rotation.z = .2;
  if (M.deadT) { f.rotation.x = -Math.min(1.5, (M.deadT || 0) * 3); }
  else if (a?.k === 'roll') { f.rotation.x = Math.min(1, at / .5) * Math.PI * 2; f.position.y = Math.sin(Math.min(1, at / .5) * Math.PI) * .2 - .1; }
  else if (a?.k === 'light' || a?.k === 'skill') { const p = Math.min(1, at / .35); P.arms[1].rotation.x = p < .5 ? -2.4 * p * 2 : -2.4 + (p - .5) * 2 * 3.4; }
  else if (a?.k === 'heavy') { const p = Math.min(1, at / .7); P.arms[1].rotation.x = P.arms[0].rotation.x = p < .7 ? -3 * p / .7 : -3 + (p - .7) / .3 * 4; }
  else if (a?.k === 'cast') { P.arms[1].rotation.x = P.arms[0].rotation.x = -1.6; }
  else if (M.block) { P.arms[1].rotation.x = -1.4; P.arms[0].rotation.x = -1.5; P.arms[1].rotation.z = -.4; }
  else { WK.ph = (WK.ph || 0) + .016 * (4 + M.sp * 2.4); const sw = Math.min(1, M.sp / 4) * .8, s = Math.sin(WK.ph); P.legs[0].rotation.x = s * sw; P.legs[1].rotation.x = -s * sw; P.arms[0].rotation.x = -s * sw; P.arms[1].rotation.x = s * sw * .5; }
  // the Golem
  const R = G.root; R.position.set(B.x, 0, B.z); R.rotation.y = B.face;
  const b = G.body, arms = G.arms, wb = Math.sin(t * 3);
  b.rotation.set(0, 0, 0); b.position.y = 2.6; G.head.rotation.set(0, 0, 0);
  arms.forEach(A => { A.sh.rotation.set(0, 0, A.s * .15); }); G.legs.forEach(L => { L.rotation.x = 0; });
  const st = B.state, ak = B.atk?.k, wp = B.atk ? Math.max(0, Math.min(1, 1 - B.t / B.atk.w)) : 0;
  const dozing = st === 'doze', down = st === 'down';
  G.eyes.forEach(e => { e.scale.y = dozing || down ? .15 : 1; e.material.emissiveIntensity = dozing ? .1 : .8; });
  G.zz.forEach((z, i) => { z.visible = dozing; if (dozing) z.position.set(1 + i * .5, 4.7 + i * .6 + Math.sin(t * 2 + i) * .15, 0); });
  if (down) { b.rotation.x = -Math.min(1.4, B.t * 1.5); b.position.y = 2.6 - Math.min(1.6, B.t * 2); }
  else if (st === 'chase') { const s = Math.sin(t * 5); G.legs[0].rotation.x = s * .5; G.legs[1].rotation.x = -s * .5; arms[0].sh.rotation.x = -s * .3; arms[1].sh.rotation.x = s * .3; b.position.y = 2.6 + Math.abs(Math.cos(t * 5)) * .12; }
  else if (dozing) { G.head.rotation.x = .45; b.position.y = 2.45 + wb * .05; b.rotation.x = .12; arms.forEach(A => { A.sh.rotation.x = .2; }); }
  else if (st === 'wind' && ak === 'punch') { arms[1].sh.rotation.x = .9 * wp; arms[1].sh.rotation.y = -.6 * wp; b.rotation.y = -.4 * wp; }
  else if (st === 'wind' && ak === 'slam') { arms.forEach(A => { A.sh.rotation.x = -2.9 * wp; }); b.position.y = 2.6 + wp * .4; b.rotation.x = -.2 * wp; }
  else if (st === 'wind' && ak === 'wave') { G.head.rotation.x = -.6 * wp; arms.forEach(A => { A.sh.rotation.z = A.s * (.15 + 1.2 * wp); }); }
  else if (st === 'wind' && ak === 'roll') { b.rotation.x = .9 * wp; b.position.y = 2.6 - wp * .8; arms.forEach(A => { A.sh.rotation.x = -1.2 * wp; }); }
  else if (st === 'wind' && ak === 'alarm') { arms[1].sh.rotation.x = -2.6 * wp; }
  else if (st === 'roll') { b.position.y = 1.9; b.rotation.x = t * 14; arms.forEach(A => { A.sh.rotation.x = -1.2; }); }
  else if (st === 'recover' && ak === 'punch') { arms[1].sh.rotation.x = -1.5; b.rotation.y = .3; }
  else if (st === 'recover' && ak === 'slam') { arms.forEach(A => { A.sh.rotation.x = -.6; }); b.position.y = 2.2; b.rotation.x = .35; }
  else { b.position.y = 2.6 + wb * .05; arms.forEach((A, i) => { A.sh.rotation.x = Math.sin(t * 1.5 + i) * .08; }); }
  if (G.flash > 0) { G.flash -= .016; G.root.traverse(o => { if (o.isMesh && !o.userData.glow) o.material.emissive.set(G.flash > 0 ? '#664433' : '#000000'); }); }
  // effects
  SO.fx = SO.fx.filter(e => { e.t += .016; const p = e.t / .6; if (p >= 1) { SO.S.remove(e.m); e.m.geometry.dispose(); return false; } e.m.position.set(e.x + Math.cos(e.a) * p * e.s * 1.6, .4 + Math.sin(p * 3) * 1.2, e.z + Math.sin(e.a) * p * e.s * 1.6); e.m.material.opacity = 1 - p; return true; });
  // the camera over your shoulder; locked on it frames you both
  const tx = M.x, ty = 1.55, tz = M.z, cp = C.cp, d = C.cd;
  let px = tx + Math.sin(C.cy) * Math.cos(cp) * d, py = ty + Math.sin(cp) * d, pz = tz + Math.cos(C.cy) * Math.cos(cp) * d;
  const side = .9; px += Math.cos(C.cy) * side; pz -= Math.sin(C.cy) * side;
  for (let f = .1; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f; if (B.state !== 'down' && Math.hypot(x - B.x, z - B.z) < 2.9 && ty + (py - ty) * f < 5.6) { const k = Math.max(.35, f - .1); px = tx + (px - tx) * k; py = ty + (py - ty) * k + (1 - k) * 2.2; pz = tz + (pz - tz) * k; break; } } // never inside the Golem
  for (let f = .2; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f; if (Math.hypot(x, z) > 14.5) { const k = f - .05; px = tx + (px - tx) * k; py = ty + (py - ty) * k; pz = tz + (pz - tz) * k; break; } } // stay inside the cave wall
  if (SO.shake > 0) { SO.shake -= .016; px += (Math.random() - .5) * SO.shake; py += (Math.random() - .5) * SO.shake; }
  cam.position.set(px, Math.max(.6, py), pz);
  if (SO.lock) cam.lookAt(tx + (B.x - tx) * .4, 1.9, tz + (B.z - tz) * .4); else cam.lookAt(tx + Math.cos(C.cy) * side, ty, tz - Math.sin(C.cy) * side);
  SO.lockMark.visible = !!SO.lock && !SO.over; if (SO.lock) { SO.lockMark.position.set(B.x, 3.4, B.z); SO.lockMark.lookAt(cam.position); }
  SO.R.render(SO.S, cam);
  soHudTick();
}
// floating damage numbers and pop-ups
function soNum(n, cls) {
  const el = document.createElement('div'); el.className = 'sonum ' + cls; el.textContent = (cls === 'me' ? '-' : '') + n + (cls === 'weak' ? ' 💥' : cls === 'crit' ? '!' : '');
  document.getElementById('soov')?.appendChild(el);
  const B = SO.B, M = SO.me, w = cls === 'me' ? { x: M.x, y: 2.2, z: M.z } : { x: B.x + (Math.random() - .5) * 1.4, y: 4 + Math.random(), z: B.z };
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
function soIntroDraw() {
  const ov = soOverlay(), house = SO.kind === 'house';
  ov.innerHTML = `<div class="so-intro"><div class="so-card">
    <div class="so-kicker">${house ? 'WEEKLY WARBAND · SOULS FIGHT' : 'PRACTICE YARD · TRIAL'}</div>
    <h2>🗿 The Snooze Golem</h2><p class="so-sub">The Snooze Hollow</p>
    <p>${house ? `Uses one of your weekly fights (${ftAttempts().left} left). Everything you hit goes on your house's shared bar. One life, 3 minutes.` : 'Practice: no fight used and no reward. One life, 3 minutes, and this Golem can be beaten.'} Watch its wind-ups, roll through the hits, and hit hard while it's open.</p>
    <div class="so-keys"><span><kbd>W A S D</kbd> move</span><span><kbd>Mouse</kbd> camera</span><span><kbd>Left click</kbd> light attack</span><span><kbd>Right click</kbd> heavy</span><span><kbd>Space</kbd> roll</span><span><kbd>Shift</kbd> block</span><span><kbd>Tab</kbd> lock on</span><span><kbd>1-9</kbd> your skills</span><span><kbd>Esc</kbd> pause</span></div>
    <label class="so-opt"><input type="checkbox" data-so="easy" ${soEasy() ? 'checked' : ''}> Easy timing: slower wind-ups (no reward change)</label>
    <label class="so-opt"><input type="checkbox" data-so="auto" ${soAuto() ? 'checked' : ''}> Start locked on to the boss</label>
    <div class="so-btns"><button class="btn primary" data-so="go">⚔️ Fight</button><button class="btn ghost" data-so="cancel">${house ? 'Not now' : 'Back'}</button></div></div></div>`;
}
function soHudDraw() {
  const ov = soOverlay(); if (!SO || SO.intro) return;
  ov.querySelector('.so-hud')?.remove(); ov.querySelector('.so-end')?.remove();
  const hud = document.createElement('div'); hud.className = 'so-hud';
  hud.innerHTML = `<div class="so-boss"><div class="so-bn">🗿 Snooze Golem <span class="so-ph"></span></div><div class="so-bar"><i class="so-bhp"></i><b class="so-brun"></b></div><div class="so-bsub"></div></div>
    <div class="so-time"></div><div class="so-pops"></div>
    <div class="so-me"><div class="so-hp"><i></i><span></span></div><div class="so-st"><i></i></div><div class="so-chips"></div></div>
    <div class="so-bar2">${SO.P.sk.slice(0, 9).map((s, i) => `<div class="so-sk ${s.k === 'spell' ? 'so-spl' : 'so-mvl'}" data-i="${i}" title="${esc(s.n)}: ${esc(s.d)}"><kbd>${i + 1}</kbd><span>${s.e}</span><small>${esc(s.n)}</small><i></i></div>`).join('')}</div>
    <div class="so-help">${document.pointerLockElement ? '' : 'Click to steer with the mouse'}</div>`;
  ov.appendChild(hud);
  if (SO.paused && !SO.over) { const p = document.createElement('div'); p.className = 'so-end'; p.innerHTML = `<div class="so-card"><h2>Paused</h2><p class="muted">The Golem waits for you.</p><div class="so-btns"><button class="btn primary" data-so="resume">Resume</button><button class="btn ghost" data-so="quit">End the fight</button></div></div>`; ov.appendChild(p); }
  if (SO.over && SO.res) { const r = SO.res, p = document.createElement('div'); p.className = 'so-end'; p.innerHTML = `<div class="so-card"><h2>${{ dead: '💀 YOU DIED', time: '⏱️ Time', win: '🏆 GOLEM FELLED', quit: '🏳️ Fight ended' }[r.how]}</h2><p>You dealt <b>${Math.round(SO.dealt).toLocaleString()}</b> damage in ${Math.floor(SO.time / 60)}:${String(Math.floor(SO.time % 60)).padStart(2, '0')}.</p>${r.out.map(x => `<p>${x}</p>`).join('')}<div class="so-btns"><button class="btn primary" data-so="close">Done</button></div></div>`; ov.appendChild(p); }
}
function soHudTick() {
  const ov = document.getElementById('soov'); if (!ov || !SO || SO.intro) return;
  const P = SO.P, M = SO.me, B = SO.B, q = s => ov.querySelector(s);
  const pct = soPct(), ph = soPhase();
  if (q('.so-bhp')) q('.so-bhp').style.width = (pct * 100) + '%';
  const run = SO.kind === 'house' && SO.shared ? Math.min(SO.dealt, SO.shared.left) / SO.shared.hp : 0;
  if (q('.so-brun')) { q('.so-brun').style.left = (pct * 100) + '%'; q('.so-brun').style.width = (run * 100) + '%'; }
  if (q('.so-bsub')) q('.so-bsub').textContent = SO.kind === 'house' ? `House bar ${Math.round(pct * 100)}% · your hits this fight: ${Math.round(SO.dealt).toLocaleString()}${B.doze > 0 ? ' · 💤 armoured' : B.awake > 0 ? ' · ⏰ awake' : ''}` : `${Math.ceil(B.hp)} / ${B.max} · dealt ${Math.round(SO.dealt)}${B.doze > 0 ? ' · 💤 armoured' : B.awake > 0 ? ' · ⏰ awake' : ''}`;
  if (q('.so-ph')) q('.so-ph').textContent = ['', '· ⏰ Alarm Barrage', '· 😤 Restless', '· 👁️ Wide Awake'][ph];
  const left = Math.max(0, SO_TIME - SO.time); if (q('.so-time')) q('.so-time').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (q('.so-hp i')) { q('.so-hp i').style.width = (P.hp / P.max * 100) + '%'; q('.so-hp span').textContent = `${Math.ceil(P.hp)} / ${P.max}${P.shield ? ` +${Math.round(P.shield)}` : ''}`; }
  if (q('.so-st i')) { q('.so-st i').style.width = Math.max(0, M.st) + '%'; q('.so-st').classList.toggle('low', M.st < SO_ST.light); }
  const chips = [M.drowsy > 0 && '😴 Drowsy', M.emp > 0 && '✨ +25%', M.rally > 0 && '🎻 Rally', M.buff > 1 && '♟️ ×2 ready', M.reveal > 0 && `📖 ×${M.reveal}`, M.block && '🛡️ Blocking', SO.lock && '🎯 Locked on'].filter(Boolean).join(' · ');
  if (q('.so-chips') && q('.so-chips').textContent !== chips) q('.so-chips').textContent = chips;
  ov.querySelectorAll('.so-sk').forEach(el => { const s = P.sk[+el.dataset.i], c = Math.max(0, (SO.hotCd[s.id] || 0) - SO.time); el.classList.toggle('cd', c > 0); el.querySelector('i').style.height = (c / soSkCd(s) * 100) + '%'; });
  ov.classList.toggle('hurt', (SO.hurtT = (SO.hurtT || 0) - .016) > 0);
  // the numbers float up over whoever was hit
  const W = SO.canvas.clientWidth, H = SO.canvas.clientHeight, v = new THREE.Vector3();
  SO.nums = SO.nums.filter(n => { n.t += .016; if (n.t > 1) { n.el.remove(); return false; } v.set(n.w.x, n.w.y + n.t * 1.2, n.w.z).project(SO.cam3); n.el.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px) translate(-50%, -50%)`; n.el.style.opacity = 1 - n.t * n.t; return true; });
}

// ---------- input ----------
const soLive = () => SO && !SO.intro && !SO.over;
addEventListener('keydown', e => {
  if (!SO) return;
  const k = e.key.toLowerCase();
  if (SO.intro || SO.over) { if (k === 'escape') { e.preventDefault(); if (SO.over) soClose(); else soClose(); } e.stopImmediatePropagation(); return; }
  e.stopImmediatePropagation(); if (k !== 'f5' && k !== 'f12') e.preventDefault();
  if (k === 'escape') { soPause(!SO.paused); return; }
  if (SO.paused) return;
  if (['w', 'a', 's', 'd'].includes(k)) SO.keys[k] = true;
  else if (k === 'arrowup') SO.keys.w = true; else if (k === 'arrowdown') SO.keys.s = true; else if (k === 'arrowleft') SO.keys.a = true; else if (k === 'arrowright') SO.keys.d = true;
  else if (k === 'shift') SO.keys.shift = true;
  else if (k === ' ' && !e.repeat) soAct('roll');
  else if (k === 'tab' && !e.repeat) { SO.lock = !SO.lock; }
  else if (/^[1-9]$/.test(k) && !e.repeat) soSkill(+k - 1);
}, true);
addEventListener('keyup', e => {
  if (!SO) return; const k = e.key.toLowerCase(), map = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
  SO.keys[map[k] || k] = false; e.stopImmediatePropagation();
}, true);
addEventListener('blur', () => { if (soLive()) { SO.keys = {}; } });
function soPause(on) { if (!soLive()) return; SO.paused = on; SO.keys = {}; if (on && document.pointerLockElement) document.exitPointerLock(); soHudDraw(); }
addEventListener('pointerdown', e => {
  if (!soLive() || SO.paused || !e.target.closest?.('#soov') || e.target.closest('.so-card, button, input, label')) return;
  e.preventDefault();
  if (document.pointerLockElement !== SO.canvas) { try { const p = SO.canvas.requestPointerLock(); if (p?.catch) p.catch(() => { }); } catch (er) { } if (!SO.clicked) { SO.clicked = 1; return; } }
  soAct(e.button === 2 ? 'heavy' : 'light');
}, true);
addEventListener('pointermove', e => {
  if (!soLive() || SO.paused || document.pointerLockElement !== SO.canvas) return;
  if (!SO.lock) SO.cam.cy -= e.movementX * .0038;
  SO.cam.cp = Math.max(-.1, Math.min(1, SO.cam.cp + e.movementY * .003));
}, true);
addEventListener('contextmenu', e => { if (SO && e.target.closest?.('#soov')) e.preventDefault(); }, true);
addEventListener('wheel', e => { if (!soLive() || !e.target.closest?.('#soov')) return; e.preventDefault(); SO.cam.cd = Math.max(3.5, Math.min(10, SO.cam.cd * (e.deltaY > 0 ? 1.08 : .92))); }, { capture: true, passive: false });
document.addEventListener('pointerlockchange', () => { if (!soLive()) return; if (!document.pointerLockElement && SO.clicked && !SO.paused) soPause(true); else soHudDraw(); });
addEventListener('resize', () => { if (SO?.R) soResize(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-so]'); if (!el) return;
  const v = el.dataset.so;
  if (v === 'house' || v === 'trial') { e.preventDefault(); soOpen(v); return; }
  if (!SO) return;
  if (v === 'easy') { D.settings.soEasy = el.checked; save(); return; }
  if (v === 'auto') { D.settings.soAuto = el.checked; save(); return; }
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
