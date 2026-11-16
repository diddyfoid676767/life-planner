'use strict';
/* 2.77 stage 6: the other Souls bosses, each in its own arena (move sets approved by
   Eli on 16 Nov 2026, souls-stage6/boss-moves.md). The fight engine, shapes and
   hooks are in souls.js; each boss here is a definition in SO_DEFS. A short
   melee swat fills the gaps between the 4 named moves, like the Golem's punch. */

// small helpers for dressing an arena
const so2 = {
  ring(W, n, r0, r1, f) { const rnd = seeded('ring' + n + r0); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd() * .2, r = r0 + rnd() * (r1 - r0); f(Math.cos(a) * r, Math.sin(a) * r, a, rnd, i); } },
  light(S, col, x, y, z, i = 1.1, d = 18) { const l = new THREE.PointLight(col, i, d, 1.6); l.position.set(x, y, z); S.add(l); return l; },
  swat: (n, d = 11) => ({ n, shape: 'cone', w: .75, d, r: 3.5, arc: 1.1, track: 4, cd: 1.6 }),
};

// ================= 🦥 The Procrastinator: the Waiting Room =================
SO_DEFS['The Procrastinator'] = {
  e: '🦥', arenaName: 'The Waiting Room', felled: 'PROCRASTINATOR FELLED', h: 5.2, rad: 2.1, spd: 1.5,
  rule: 'Start now: everything you land in the first 20 seconds does double damage.',
  tip: 'Start now: everything you land in the first 20 seconds does double damage. Hit it 3 times to knock its snack away.',
  v: { f: 62, type: 'triangle', n: 500 },
  ph: ['', '📄 Phase 2: Deadline Panic', '😰 Phase 3: Cramming', '⏳ Phase 4: Last Minute'],
  atk: {
    swat: so2.swat('Lazy Swipe', 10),
    yawn: { n: 'Yawn', shape: 'ring', w: 1.1, d: 8, fx: 'drowsy', fxT: 3, col: '#ffe066', sp: 6, cd: 8, rec: 1.6 },
    later: { n: '"Later..."', shape: 'cone', w: .9, d: 6, r: 5.5, arc: .55, fx: 'frozen', fxT: 1, col: '#74c0fc', track: 3, cd: 5 },
    snack: { n: 'Snack Break', shape: 'heal', w: .6, heal: 14, dur: 3.5, need: 3, cd: 14, say: '🍪 Snack Break: hit it 3 times to stop the heal!', stop: '🍪 Snack knocked away!' },
    slide: { n: 'Lazy Slide', shape: 'lane', w: 1, d: 18, sp: 12, cd: 6 },
    homework: { n: 'Deadline Panic', shape: 'drops', w: 1.1, d: 9, r: 1.6, cnt: 5, spread: 8, col: '#f8f9fa', cd: 9 },
  },
  pick(B, dist, ph, can) {
    const r = Math.random();
    let k = ph < 2 && can('snack') && r < .14 ? 'snack' : ph >= 1 && can('homework') && r < .4 ? 'homework' : dist > 7 && can('slide') ? 'slide' : can('yawn') && r < .3 ? 'yawn' : dist < 6 && can('later') && r < .55 ? 'later' : dist < 3.8 ? 'swat' : '';
    if (k && ph >= 3 && k !== 'snack' && Math.random() < .6) B.chain = dist < 4 ? 'swat' : can('slide') ? 'slide' : 'yawn'; // Last Minute: two in a row
    return k;
  },
  dmgIn: o => o.dot ? 1 : SO.time < 20 ? 2 : 1,
  chip: () => SO.time < 20 ? `⏰ Start now: ×2 for ${Math.ceil(20 - SO.time)} s` : '',
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#4a2c40', fog: [26, 66], sky: '#ffb38a', gnd: '#3b2433', hemi: .7, key: '#ffc078', keyI: 1.1, floor: '#6b4e5e', patch: '#7b5d6e', seed: 'waiting', rune: '#ffa94d' });
    const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: '#ff922b', fog: false })); sun.position.set(0, 7, -46); S.add(sun); // a sunset that never ends
    // beanbags and waiting-room chairs round the edge
    so2.ring(W, 12, 15, 17, (x, z, a, r) => { const bb = m(new THREE.SphereGeometry(1.2 + r() * .5, 12, 9), ['#e64980', '#7950f2', '#12b886', '#fab005'][Math.floor(r() * 4)], x, .7, z); bb.scale.y = .6; });
    so2.ring(W, 16, 19, 20, (x, z, a) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a - Math.PI / 2; W.add(g); is3mesh(new THREE.BoxGeometry(1.4, .3, 1.3), '#495057', 0, 1, 0, g); is3mesh(new THREE.BoxGeometry(1.4, 1.5, .25), '#495057', 0, 1.7, -.6, g); for (const s of [-1, 1]) is3mesh(new THREE.BoxGeometry(.1, 1, .1), '#212529', s * .6, .5, 0, g); });
    // big ticking clocks on stands
    for (const [x, z] of [[-9, -10], [10, -8], [-11, 6], [8, 11]]) { const g = new THREE.Group(); g.position.set(x, 0, z); g.lookAt(0, 0, 0); W.add(g); is3mesh(new THREE.CylinderGeometry(.12, .16, 3.4, 6), '#343a40', 0, 1.7, 0, g); const f = is3mesh(new THREE.CylinderGeometry(1.1, 1.1, .2, 20), '#f8f9fa', 0, 4, 0, g); f.rotation.x = Math.PI / 2; const hnd = is3mesh(new THREE.BoxGeometry(.08, .8, .05), '#212529', 0, 4.3, .14, g); hnd.rotation.z = rnd() * 6; }
    so2.light(S, '#ffa94d', -10, 4, -6, 1); so2.light(S, '#ffa94d', 10, 4, 6, 1);
  },
  model: () => soModelFrom('The Procrastinator', 1.5),
};

// ================= 🛋️ Couch Troll: the Living Room of Doom =================
SO_DEFS['Couch Troll'] = {
  e: '🛋️', arenaName: 'The Living Room of Doom', felled: 'TROLL FELLED', h: 4.6, rad: 2.5, spd: 1.8,
  rule: 'Keep moving: each hit within 2 s of your last does 12% more (up to +60%). Stand still for 2 s and it resets.',
  tip: 'Keep moving: chain your hits for up to +60% damage, but stand still and it resets.',
  v: { f: 78, type: 'sawtooth', n: 380 },
  ph: ['', '🍿 Phase 2: Popcorn Rain', '😠 Phase 3: Grumpy', '🛋️ Phase 4: Double Charge'],
  atk: {
    swat: so2.swat('Troll Swat', 12),
    cushion: { n: 'Cushion Slam', shape: 'circle', w: 1.1, d: 24, r: 4.4, track: 1.5, cd: 4 },
    sit: { n: 'Sit Down', shape: 'pull', w: .9, r: 7, life: 3, pw: 2.4, col: '#9775fa', cd: 9 },
    remote: { n: 'Remote Throw', shape: 'drops', w: .9, d: 14, r: 1.9, cnt: 1, col: '#868e96', cd: 4 },
    charge: { n: 'Couch Charge', shape: 'lane', w: 1, d: 22, sp: 14, wd: 3.8, cd: 6 },
    popcorn: { n: 'Popcorn Rain', shape: 'drops', w: 1, d: 7, r: 1.3, cnt: 6, spread: 10, col: '#fff3bf', gap: .15, cd: 10 },
  },
  init: B => { B.kc = 0; },
  pick(B, dist, ph, can) {
    const r = Math.random(); soA('sit').pw = ph >= 2 ? 3.4 : 2.4;
    const k = ph >= 1 && can('popcorn') && r < .3 ? 'popcorn' : dist > 7 && can('charge') ? 'charge' : can('sit') && r < .25 ? 'sit' : dist > 4.5 && can('remote') ? 'remote' : dist < 3.8 ? (can('cushion') && r < .45 ? 'cushion' : 'swat') : dist < 5 && can('cushion') ? 'cushion' : '';
    if (k === 'charge' && ph >= 3) B.chain = 'charge2';
    return k;
  },
  strike(a) { if (a.k === 'charge2') return false; },
  dmgIn(o) { const B = SO.B; if (o.dot) return 1; B.kn = SO.time - SO.me.lastHit < 2 && SO.me.still < 2 ? Math.min(5, B.kc + 1) : 0; return 1 + .12 * B.kn; },
  onHit() { SO.B.kc = SO.B.kn || 0; },
  step() { if (SO.me.still > 2) SO.B.kc = 0; },
  myChip: () => SO.B.kc ? `🏃 Moving +${SO.B.kc * 12}%` : '',
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#1c1a2e', fog: [26, 64], sky: '#a5b4fc', gnd: '#3b2a20', hemi: .55, key: '#ffe8cc', keyI: .9, floor: '#7a5536', rune: '#4dabf7' });
    const rug = m(new THREE.CircleGeometry(9, 32), '#a61e1e', 0, .02, 0); rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
    const rug2 = m(new THREE.RingGeometry(7.6, 8.2, 32), '#ffd43b', 0, .03, 0); rug2.rotation.x = -Math.PI / 2; rug2.castShadow = false;
    // the giant couch at the back and the TV at the front, glowing
    const c = new THREE.Group(); c.position.set(0, 0, -17); W.add(c);
    is3mesh(new THREE.BoxGeometry(14, 2.4, 4), '#c92a2a', 0, 1.2, 0, c); is3mesh(new THREE.BoxGeometry(14, 4, 1.4), '#a61e1e', 0, 3, -1.6, c); for (const s of [-1, 1]) is3mesh(new THREE.BoxGeometry(1.4, 3.2, 4), '#a61e1e', s * 7, 1.6, 0, c);
    for (const s of [-1, 0, 1]) { const cu = is3mesh(new THREE.BoxGeometry(3.8, 1, 3), '#e03131', s * 4.2, 2.8, .2, c); cu.rotation.x = -.1; }
    const tv = new THREE.Group(); tv.position.set(0, 0, 17); tv.rotation.y = Math.PI; W.add(tv);
    is3mesh(new THREE.BoxGeometry(5, 1.2, 1.6), '#495057', 0, .6, 0, tv); is3mesh(new THREE.BoxGeometry(9, 5.4, .5), '#212529', 0, 4.1, 0, tv); is3mesh(new THREE.BoxGeometry(8.4, 4.8, .1), '#4dabf7', 0, 4.1, .3, tv, true);
    so2.light(S, '#4dabf7', 0, 4, 14, 1.6, 26);
    // a lamp, a side table, popcorn everywhere
    for (const [x, z] of [[-12, -9], [12, -9]]) { m(new THREE.CylinderGeometry(.12, .3, 4.6, 8), '#343a40', x, 2.3, z); m(new THREE.ConeGeometry(1, 1.2, 12, 1, true), '#ffe8a3', x, 4.9, z, true); so2.light(S, '#ffd8a8', x, 4.4, z, .9, 14); }
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, r = 2 + rnd() * 12; m(new THREE.IcosahedronGeometry(.12 + rnd() * .1, 0), '#fff9db', Math.cos(a) * r, .1, Math.sin(a) * r).castShadow = false; }
    so2.ring(W, 20, 19, 20.5, (x, z, a) => { const p = m(new THREE.BoxGeometry(4, 9, .6), '#5c4033', x, 4.5, z); p.rotation.y = -a + Math.PI / 2; }); // the walls
  },
  model: () => soModelFrom('Couch Troll', 1.45),
};
SO_DEFS['Couch Troll'].atk.charge2 = { ...SO_DEFS['Couch Troll'].atk.charge, w: .7, cd: 0, hide: 1 };

// ================= 🔋 The Energy Drain: the Dead Socket =================
SO_DEFS['The Energy Drain'] = {
  e: '🔋', arenaName: 'The Dead Socket', felled: 'DRAIN FELLED', h: 5, rad: 1.9, spd: 1.8,
  rule: 'Recharge: every point you heal also hits it for double. It CRASHes into you when you are under half health.',
  tip: 'Recharge: every point you heal also hits it for double. Keep your health up or it CRASHes into you.',
  v: { f: 110, type: 'square', n: 3200, q: 1400 },
  ph: ['', '⚡ Phase 2: Overcharged', '🔁 Phase 3: Double Sweep', '💥 Phase 4: Short Circuit'],
  atk: {
    swat: so2.swat('Spark Jab', 11),
    beam: { n: 'Drain Beam', shape: 'beam', w: 1.1, d: 12, sweep: 1.7, arcW: 1.15, drain: 1, len: 15, wd: .8, col: '#ffd43b', back: ph => ph >= 2, cd: ph => ph >= 1 ? 3.5 : 6.5 },
    sugar: { n: 'Sugar Crash', shape: 'leap', w: 1.3, d: 18, r: 3.4, col: '#ff6b6b', cd: 6 },
    rings: { n: 'Static Rings', shape: 'ring', w: 1, d: 7, sp: 8, col: '#ffe066', cd: 8, rec: 2.2 },
    crash: { n: 'CRASH', shape: 'lane', w: .9, d: 30, sp: 16, wd: 3, col: '#ff3b3b', cd: 7 },
  },
  pick(B, dist, ph, can) {
    const r = Math.random(), P = SO.P, low = P.hp < P.max * (ph >= 3 ? .7 : .5);
    if (low && can('crash')) return 'crash';
    if (can('beam') && r < (ph >= 1 ? .45 : .3)) return 'beam';
    if (dist > 6 && can('sugar')) return 'sugar';
    if (can('rings') && r < .3) return 'rings';
    return dist < 3.8 ? 'swat' : can('sugar') && r < .5 ? 'sugar' : '';
  },
  onStrike(a) { if (a.k === 'rings') { soRing(SO.B.x, SO.B.z, a.A, .55); soRing(SO.B.x, SO.B.z, a.A, 1.1); } },
  onHeal(n) { soHit(n * 2, { dot: true }); soPop(`🔋 Recharge: ${n * 2} damage`, 'good'); },
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#14171c', fog: [24, 60], sky: '#ced4da', gnd: '#1a1d21', hemi: .5, key: '#ffe066', keyI: .8, floor: '#3b3f45', patch: '#2c2f33', seed: 'socket', rune: '#ffd43b' });
    // giant flat batteries lying round the scrapyard
    so2.ring(W, 9, 15.5, 18, (x, z, a, r, i) => { const g = new THREE.Group(); g.position.set(x, 1.4, z); g.rotation.set(Math.PI / 2, 0, a + r() * .8); W.add(g); is3mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 14), '#343a40', 0, 0, 0, g); is3mesh(new THREE.CylinderGeometry(1.42, 1.42, 1.2, 14), i % 2 ? '#fa5252' : '#495057', 0, 1.9, 0, g); is3mesh(new THREE.CylinderGeometry(.45, .45, .5, 10), '#adb5bd', 0, 2.75, 0, g); });
    // sparking cables and junk piles
    for (let i = 0; i < 7; i++) { const t = m(new THREE.TorusGeometry(1.4 + rnd() * 1.5, .12, 6, 18, Math.PI), i % 2 ? '#ffd43b' : '#212529', (rnd() - .5) * 26, 0, (rnd() - .5) * 26, i % 2 === 1); t.rotation.y = rnd() * 6; if (Math.hypot(t.position.x, t.position.z) < 9) t.position.multiplyScalar(1.6); }
    so2.ring(W, 14, 19.5, 22, (x, z, a, r) => { const k = m(new THREE.BoxGeometry(2 + r() * 2, 2 + r() * 4, 2 + r() * 2), r() < .5 ? '#495057' : '#5c5f66', x, 1.5, z); k.rotation.set(r() * .4, r() * 3, r() * .4); });
    SO.sparks = [so2.light(S, '#ffe066', -9, 2, -9, 1.2, 14), so2.light(S, '#ffe066', 10, 2, 8, 1.2, 14)];
  },
  scene() { }, draw2(G, B, t) { if (SO.sparks) SO.sparks.forEach((l, i) => { l.intensity = Math.random() < .08 ? 2.4 : .7 + Math.sin(t * 9 + i) * .2; }); },
  model: () => soModelFrom('The Energy Drain', 1.5),
};

// ================= 🦑 Doomscroll Kraken: the Endless Feed =================
// three tentacles stand round the arena and each blocks 15% of your damage; break them all to stun it
SO_DEFS['Doomscroll Kraken'] = {
  e: '🦑', arenaName: 'The Endless Feed', felled: 'KRAKEN FELLED', h: 5.2, rad: 2.3, spd: .9, near: 4,
  rule: 'Three tentacles stand round the arena, each blocking 15% of your damage. Hit one to break it (a Focus skill cuts one straight off). Break all three and it is stunned for 5 s; they grow back after 20 s.',
  tip: 'Its three tentacles each block 15% of your damage: break them (Focus skills cut them straight off) and it is stunned.',
  v: { f: 58, type: 'sawtooth', n: 900, q: 600 },
  ph: ['', '🔔 Phase 2: Double Ping', '🖤 Phase 3: Ink Flood', '🌀 Phase 4: Doom Spiral'],
  atk: {
    swat: so2.swat('Tentacle Swipe', 11),
    ping: { n: 'Notification Ping', shape: 'drops', w: .9, d: 7, r: 1.3, cnt: 3, spread: 5, gap: .12, col: '#74c0fc', cd: 5 },
    ink: { n: 'Ink Cloud', shape: 'zone', w: .9, fx: 'blind', r: 2.6, life: 5, col: '#1b1530', cd: 8 },
    feed: { n: 'Endless Feed', shape: 'beam', w: 1.1, d: 11, sweep: 1.8, arcW: 1.2, len: 15, wd: .8, col: '#74c0fc', cd: 7 },
    slam: { n: 'Tentacle Slam', shape: 'tslam', w: 1.1, d: 16, cd: 4.5 },
  },
  init(B) { B.tent = [0, 2.1, 4.2].map(a => ({ a, x: Math.cos(a + .5) * 8.5, z: Math.sin(a + .5) * 8.5, hp: 60, up: 1, re: 0 })); },
  alive: () => SO.B.tent.filter(t => t.up).length,
  pick(B, dist, ph, can) {
    const r = Math.random(); soA('ink').life = ph >= 2 ? 10 : 5;
    return can('slam') && this.alive() && r < .35 ? 'slam' : can('ping') && r < .55 ? 'ping' : can('feed') && r < .7 ? 'feed' : can('ink') ? 'ink' : dist < 4.2 ? 'swat' : '';
  },
  onStrike(a, ph) { if (a.k === 'ping' && ph >= 1) soDrops(a.A, 3, 5, .7); },
  // the slam: one tentacle (two in Doom Spiral) smashes down a lane towards you
  tele(a) {
    if (a.k !== 'slam') return false;
    const M = SO.me, up = SO.B.tent.filter(t => t.up).sort(() => Math.random() - .5).slice(0, soPhase() >= 3 ? 2 : 1);
    a.lanes = up.map(t => { const ang = Math.atan2(M.x - t.x, M.z - t.z), g = new THREE.PlaneGeometry(3, 16); g.translate(0, 8, 0); soFloor(g, '#ff8f3b', t.x, t.z, ang + Math.PI, a); t.aim = ang; t.slamT = -a.w; return { t, ang }; });
    return true;
  },
  strike(a) {
    if (a.k !== 'slam') return false;
    const M = SO.me, B = SO.B;
    for (const { t, ang } of a.lanes) { const dx = Math.sin(ang), dz = Math.cos(ang), rx = M.x - t.x, rz = M.z - t.z, along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx); t.slamT = 0;
      if (along > 0 && along < 16 && side < 1.6 && !soDodged(a)) soHurt(a.A.d, a.n); for (let i = 1; i < 4; i++) soBoom(t.x + dx * i * 4, t.z + dz * i * 4, '#9775fa', 1); }
    SO.shake = .35; B.state = 'recover'; B.t = .8; return true;
  },
  // your sword can hit a tentacle in reach instead of the Kraken
  swing(a, A) {
    const M = SO.me, B = SO.B, db = soDist(M, B) - soRad();
    const t = B.tent.filter(t => t.up).map(t => ({ t, d: Math.hypot(t.x - M.x, t.z - M.z) - .9, ang: Math.abs(soAng(Math.atan2(t.x - M.x, t.z - M.z) - M.face)) })).filter(x => x.d < A.reach && x.ang < A.arc && x.d < db).sort((p, q) => p.d - q.d)[0];
    if (!t) return false;
    const s = SO.P.s, n = a.sk ? a.sk.pw * .5 : (3 + (s.str || 5) * .06) * A.m * 1.6;
    if (a.sk?.st === 'foc') t.t.hp = 0; else t.t.hp -= n;
    soNum(Math.round(n), 'arm'); if (typeof sfx === 'function') sfx('pop', { gap: 30 });
    if (t.t.hp <= 0) this.cut(t.t);
    return true;
  },
  cut(t) {
    const B = SO.B; t.up = 0; t.hp = 60; t.re = soPhase() >= 3 ? 12 : 20; soBoom(t.x, t.z, '#9775fa', 2);
    const n = this.alive(); soPop(n ? `✂️ A tentacle is cut off (${n} left)` : '😵 All three cut: the Kraken is stunned!', 'good');
    if (!n) { B.stag = 5; B.state = 'idle'; B.t = .5; soClearTele(); }
  },
  onHit(o) { if (o.sk?.st === 'foc') { const t = SO.B.tent.find(t => t.up); if (t) this.cut(t); } },
  dmgIn: o => o.dot ? 1 : 1 - .15 * SO_DEFS['Doomscroll Kraken'].alive(),
  step(dt) { for (const t of SO.B.tent) if (!t.up && (t.re -= dt) <= 0) { t.up = 1; soPop('🦑 A tentacle grows back', 'bad'); } },
  chip: B => B.stag > 0 ? '😵 stunned' : `🦑 ${SO_DEFS['Doomscroll Kraken'].alive()} tentacles`,
  scene(S) {
    SO.tents = SO.B.tent.map(t => { const g = new THREE.Group(); g.position.set(t.x, 0, t.z); S.add(g); const segs = [];
      let p = g; for (let i = 0; i < 6; i++) { const s = new THREE.Group(); s.position.y = i ? .9 : 0; p.add(s); is3mesh(new THREE.CylinderGeometry(.42 - i * .05, .48 - i * .05, 1, 8), i % 2 ? '#9775fa' : '#7950f2', 0, .5, 0, s); segs.push(s); p = s; }
      is3mesh(new THREE.BoxGeometry(.5, .8, .06), '#e9ecef', 0, 1.1, 0, p, true); return { g, segs }; });
  },
  draw2(G, B, t) {
    SO.tents?.forEach((T, i) => { const tt = B.tent[i]; T.g.visible = !!tt.up; if (!tt.up) return; T.g.rotation.y = -(tt.aim || 0) + Math.PI;
      const sl = tt.slamT ?? 9; if (sl < 0) tt.slamT += .016; else if (sl < 1) tt.slamT += .016;
      T.segs.forEach((s, j) => { s.rotation.x = sl < 0 ? -.12 * (1 + sl) : sl < .5 ? .26 : Math.sin(t * 1.4 + i + j * .6) * .12; s.rotation.z = Math.cos(t * 1.1 + i * 2 + j * .5) * .1; }); });
    G.body.position.y += Math.sin(t * 1.2) * .1;
  },
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#060b18', fog: [22, 58], sky: '#748ffc', gnd: '#0b1a2e', hemi: .55, key: '#91a7ff', keyI: .9, floor: '#13294a', patch: '#1b3a63', seed: 'feed', rune: '#74c0fc' });
    const sea = new THREE.Mesh(new THREE.RingGeometry(16.4, 60, 40), new THREE.MeshPhongMaterial({ color: '#0b2545', shininess: 80 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.4; S.add(sea);
    // floating phone screens all round the lagoon
    for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, r = 17 + rnd() * 9, ph = new THREE.Group(); ph.position.set(Math.cos(a) * r, 2 + rnd() * 7, Math.sin(a) * r); ph.lookAt(0, ph.position.y, 0); W.add(ph); is3mesh(new THREE.BoxGeometry(1.6, 3, .15), '#212529', 0, 0, 0, ph); is3mesh(new THREE.BoxGeometry(1.4, 2.6, .05), ['#74c0fc', '#f783ac', '#ffd43b', '#8ce99a'][i % 4], 0, 0, .09, ph, true); }
    so2.ring(W, 16, 15.5, 17, (x, z, a, r) => { m(is3rock(new THREE.DodecahedronGeometry(1 + r(), 0), r, .3), '#1f2a44', x, 0, z); });
    so2.light(S, '#74c0fc', 0, 6, 0, .8, 30);
  },
  model: () => soModelFrom('Doomscroll Kraken', 1.4),
};

// ================= 👻 Cram Wraith: the Midnight Library =================
SO_DEFS['Cram Wraith'] = {
  e: '👻', arenaName: 'The Midnight Library', felled: 'WRAITH FELLED', h: 5.8, rad: 1.8, spd: 1.9,
  rule: 'Hidden: it\'s see-through, and weapon hits and moves do only 25% until it\'s revealed. Light, a Knowledge spell or a perfect dodge reveals it for 6 s.',
  tip: 'Hidden: your sword barely touches it until light, a Knowledge spell or a perfect dodge reveals it.',
  v: { f: 180, type: 'sine', n: 2400, q: 2000 },
  ph: ['', '📚 Phase 2: Flying Books', '❓ Phase 3: Pop Quizzes', '🌙 Phase 4: Exam Eve'],
  fast: ph => ph >= 3 ? 1.15 : 1,
  atk: {
    swat: so2.swat('Cold Grasp', 11),
    allnight: { n: 'All-Nighter', shape: 'beam', w: 1.1, d: 10, sweep: 1.7, arcW: 1.15, drain: 1, len: 15, wd: .8, col: '#cc5de8', cd: 7 },
    panic: { n: 'Panic', shape: 'drops', w: 1, d: 6, r: 1.6, cnt: 4, spread: 6, fx: 'burn', fxT: 3, col: '#ff8787', cd: 7 },
    blank: { n: 'Blank Mind', shape: 'ring', w: 1, d: 6, fx: 'confuse', fxT: 3, col: '#adb5bd', sp: 7, cd: 9, rec: 1.4 },
    quiz: { n: 'Pop Quiz', shape: 'blink', w: .9, then: 'qswipe', col: '#cc5de8', cd: ph => ph >= 2 ? 4 : 8 },
    qswipe: { n: 'Pop Quiz', shape: 'cone', w: .5, d: 13, r: 3.8, arc: 1.2, track: 6, cd: 0, hide: 1 },
    books: { n: 'Flying Books', shape: 'drops', w: 1.1, d: 8, r: 1.5, cnt: 5, spread: 9, col: '#4dabf7', cd: 9 },
  },
  init: B => { B.seen = 0; },
  pick(B, dist, ph, can) {
    const r = Math.random();
    return ph >= 1 && can('books') && r < .3 ? 'books' : can('quiz') && r < .45 ? 'quiz' : can('allnight') && r < .6 ? 'allnight' : can('blank') && r < .72 ? 'blank' : can('panic') && r < .85 ? 'panic' : dist < 3.8 ? 'swat' : '';
  },
  reveal() { const B = SO.B; if (!(B.seen > 0)) soPop('👁️ The Wraith is revealed!', 'good'); B.seen = 6; },
  dmgIn: o => o.dot || SO.B.seen > 0 || o.sk?.k === 'spell' || o.sk?.t === 'light' ? 1 : .25,
  onHit(o) { if (o.sk?.t === 'light' || o.sk?.st === 'kno') this.reveal(); },
  onPerfect() { this.reveal(); },
  step(dt, ph) { if (SO.B.seen > 0) SO.B.seen -= dt * (ph >= 3 ? 2 : 1); },
  chip: B => B.seen > 0 ? '👁️ revealed' : '👻 hidden',
  draw2(G, B, t) {
    const op = B.seen > 0 || B.state === 'down' ? 1 : .32;
    if (G.op !== op) { G.op = op; G.root.traverse(o => { if (o.isMesh) { o.material.transparent = op < 1; o.material.opacity = op; o.material.depthWrite = op >= 1; } }); }
    G.root.position.y = .5 + Math.sin(t * 1.8) * .25;
    SO.books?.forEach((b, i) => { b.rotation.y = t * .4 + i; b.position.y = 3 + Math.sin(t + i) * .6; });
  },
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#0d0b1a', fog: [22, 56], sky: '#9775fa', gnd: '#2a1f1a', hemi: .45, key: '#d0bfff', keyI: .7, floor: '#3b2f2a', patch: '#4a3a33', seed: 'library', rune: '#cc5de8' });
    // tall shelves round the room, full of books
    so2.ring(W, 18, 17, 17.5, (x, z, a, r) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a - Math.PI / 2; W.add(g); is3mesh(new THREE.BoxGeometry(5, 10, 1.2), '#4a2f22', 0, 5, 0, g);
      for (let row = 0; row < 5; row++) for (let i = 0; i < 7; i++) is3mesh(new THREE.BoxGeometry(.5, 1.2 + r() * .4, .8), ['#c92a2a', '#1971c2', '#2f9e44', '#f08c00', '#862e9c'][Math.floor(r() * 5)], -2 + i * .65, 1.2 + row * 1.9, .3, g); });
    // candles on stands, books floating in the air
    for (const [x, z] of [[-8, -8], [8, -8], [-9, 7], [9, 7]]) { m(new THREE.CylinderGeometry(.1, .2, 2.4, 6), '#495057', x, 1.2, z); m(new THREE.CylinderGeometry(.18, .18, .5, 8), '#f8f9fa', x, 2.65, z); m(new THREE.ConeGeometry(.12, .3, 5), '#ffa94d', x, 3.05, z, true); so2.light(S, '#ffa94d', x, 3.3, z, .9, 12); }
    SO.books = []; for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, r = 9 + rnd() * 5, b = m(new THREE.BoxGeometry(.9, .2, .7), ['#e03131', '#1971c2', '#2f9e44', '#f08c00'][i % 4], Math.cos(a) * r, 3, Math.sin(a) * r); SO.books.push(b); }
  },
  model: () => soModelFrom('Cram Wraith', 1.5),
};

// ================= 🐲 Excuse Hydra: the Swamp of Excuses =================
SO_DEFS['Excuse Hydra'] = {
  e: '🐲', arenaName: 'The Swamp of Excuses', felled: 'HYDRA FELLED', h: 5.2, rad: 2.4, spd: 1.5,
  rule: 'Heads: it starts with 2 and grows one every 20 s, up to 5. More heads, more bites. A Cleave hit, or every third heavy attack, cuts a head off (Cleave does 50% more).',
  tip: 'It grows a head every 20 s. Cleave hits and every third heavy attack cut one off.',
  v: { f: 85, type: 'sawtooth', n: 1600 },
  ph: ['', '🐍 Phase 2: Faster Growth', '🧪 Phase 3: Burning Spit', '🐲 Phase 4: Two for One'],
  atk: {
    bite: { n: 'Bite Flurry', shape: 'cone', w: .6, d: 6, r: 4, arc: .9, track: 5, cd: 2.5 },
    tail: { n: 'Tail Sweep', shape: 'circle', w: 1.1, d: 20, r: 4.6, cd: 5 },
    spit: { n: 'Excuse Spit', shape: 'drops', w: 1, d: 8, r: 1.5, cnt: () => SO.B.heads, spread: 7, col: '#94d82d', cd: 7 },
    lunge: { n: 'Lunge', shape: 'lane', w: 1, d: 20, sp: 13, len: 12, cd: 6 },
  },
  init: B => { B.heads = 2; B.grow = 20; B.hc = 0; B.bites = 0; },
  pick(B, dist, ph, can) {
    soA('bite').d = 4 + B.heads * 1.2; soA('spit').zone = ph >= 2 ? { k: 'burn', r: 1.5, life: 4, col: '#5c940d' } : null;
    const r = Math.random();
    return dist > 7 && can('lunge') ? 'lunge' : can('spit') && r < .3 ? 'spit' : dist < 4.2 ? (can('tail') && r < .4 ? 'tail' : can('bite') ? 'bite' : '') : can('lunge') && r < .5 ? 'lunge' : '';
  },
  onStrike(a) { const B = SO.B; if (a.k !== 'bite') return; B.bites++; if (B.bites < B.heads) B.chain = 'bite'; else B.bites = 0; },
  cut() { const B = SO.B; if (B.heads <= 1) return; B.heads--; soPop(`🪓 A head is cut off (${B.heads} left)`, 'good'); soBoom(B.x, B.z, '#40c057', 1.5); },
  dmgIn: o => o.sk?.t === 'cleave' ? 1.5 : 1,
  onHit(o) { const B = SO.B; if (o.sk?.t === 'cleave') this.cut(); else if (o.heavy && ++B.hc % 3 === 0) this.cut(); },
  step(dt, ph) { const B = SO.B; if (B.heads >= 5) return; if ((B.grow -= dt) <= 0) { B.grow = ph >= 1 ? 12 : 20; B.heads = Math.min(5, B.heads + (ph >= 3 ? 2 : 1)); soPop(`🐲 Another excuse grows (${B.heads} heads)`, 'bad'); soVoice('roar', 100); } },
  chip: B => `🐲 ${B.heads} heads`,
  myChip: () => SO.B.hc % 3 ? `🪓 heavy ${SO.B.hc % 3}/3` : '',
  model() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const b = is3mesh(new THREE.IcosahedronGeometry(1.6, 1), '#2f9e44', 0, 1.6, -.3, body); b.scale.set(1.35, .85, 1.1);
    const tail = is3mesh(new THREE.ConeGeometry(.6, 2.8, 7), '#2b8a3e', 0, .9, -2.6, body); tail.rotation.x = -1.3;
    for (const s of [-1, 1]) for (const z of [.5, -1]) is3mesh(new THREE.CylinderGeometry(.3, .34, 1.4, 7), '#2b8a3e', s * 1.4, .6, z, body);
    const heads = []; for (let i = 0; i < 5; i++) { const n = new THREE.Group(), a = (i - 2) * .42; n.position.set(Math.sin(a) * .8, 2.2, .5); n.rotation.set(.35, 0, -a * .9); body.add(n);
      is3mesh(new THREE.CylinderGeometry(.22, .3, 2.4, 7), '#37b24d', 0, 1.2, 0, n); const hd = new THREE.Group(); hd.position.y = 2.5; n.add(hd);
      is3mesh(new THREE.BoxGeometry(.6, .5, .9), '#40c057', 0, 0, .25, hd); is3mesh(new THREE.BoxGeometry(.5, .16, .6), '#2f9e44', 0, -.28, .45, hd); for (const s of [-1, 1]) is3mesh(new THREE.IcosahedronGeometry(.08, 0), '#ffd43b', s * .2, .18, .62, hd, true);
      heads.push({ n, hd, a }); }
    return { root, body, heads, flash: 0 };
  },
  draw(G, B, t, st, ak, wp, A) {
    soDrawGeneric(G, B, t, st, ak, wp, A);
    G.heads.forEach((H, i) => { const on = [2, 1, 3, 0, 4].indexOf(i) < B.heads; H.n.visible = on || st === 'down'; const bite = st === 'wind' && ak === 'bite' && i === [2, 1, 3, 0, 4][B.bites % B.heads];
      H.n.rotation.x = bite ? .35 - .6 * wp : st === 'recover' && ak === 'bite' ? 1.1 : .35 + Math.sin(t * 2 + i) * .1; H.hd.rotation.x = Math.sin(t * 3 + i) * .15; });
  },
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#0f1f17', fog: [18, 54], sky: '#a9e34b', gnd: '#1a2a1f', hemi: .55, key: '#d8f5a2', keyI: .75, floor: '#2f3e2a', patch: '#3b5233', seed: 'swamp', rune: '#94d82d' });
    for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, r = 4 + rnd() * 8, w = m(new THREE.CircleGeometry(1.2 + rnd() * 1.5, 12), '#1f3b2f', Math.cos(a) * r, .02, Math.sin(a) * r); w.rotation.x = -Math.PI / 2; w.castShadow = false; }
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = 3 + rnd() * 10, l = m(new THREE.CylinderGeometry(.5 + rnd() * .3, .5, .05, 10, 1, false, 0, 5.6), '#69db7c', Math.cos(a) * r, .04, Math.sin(a) * r); l.castShadow = false; }
    // dead trees round the bog
    so2.ring(W, 14, 15.5, 19, (x, z, a, r) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r() * 6; W.add(g); const h = 5 + r() * 4; is3mesh(new THREE.CylinderGeometry(.25, .5, h, 6), '#3d2e22', 0, h / 2, 0, g);
      for (let j = 0; j < 3; j++) { const br = is3mesh(new THREE.CylinderGeometry(.08, .16, 2.2, 5), '#3d2e22', 0, h * (.55 + j * .15), 0, g); br.rotation.set(0, j * 2, .9); br.position.x = .7 * (j % 2 ? 1 : -1); } });
    for (let i = 0; i < 6; i++) { const mist = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ color: '#c3fae8', transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide })); mist.position.set((rnd() - .5) * 24, 1 + rnd(), (rnd() - .5) * 24); mist.rotation.y = rnd() * 3; S.add(mist); }
    so2.light(S, '#94d82d', 0, 5, 0, .6, 30);
  },
};

// ================= 🌫️ Fog of Distraction: the Endless Tab =================
SO_DEFS['Fog of Distraction'] = {
  e: '🌫️', arenaName: 'The Endless Tab', felled: 'FOG CLEARED', h: 5.4, rad: 2, spd: 1.6,
  rule: 'Foggy: 45% of your hits miss, unless a Focus skill landed in the last 8 s, or you\'re locked on and just perfect-dodged. Monks and Rangers always see through it.',
  tip: 'Foggy: almost half your hits miss. Land a Focus skill, or perfect-dodge while locked on, to see it clearly.',
  v: { f: 140, type: 'triangle', n: 1800, q: 1600 },
  ph: ['', '🗂️ Phase 2: Tab Overload', '💨 Phase 3: Restless Mind', '🌫️ Phase 4: Doomfog'],
  atk: {
    swat: so2.swat('Distract', 10),
    haze: { n: 'Haze', shape: 'beam', w: 1.1, d: 10, sweep: 1.8, arcW: 1.2, len: 15, wd: .9, col: '#ced4da', cd: 6 },
    newtab: { n: 'New Tab', shape: 'drops', w: 1, d: 10, r: 1.7, cnt: 4, spread: 7, col: '#74c0fc', cd: 6 },
    wander: { n: 'Wander', shape: 'wander', w: .9, cd: 10 },
    mist: { n: 'Mist Ring', shape: 'ring', w: 1, d: 8, col: '#e9ecef', sp: 7, cd: 8, rec: 1.4 },
  },
  sees() { const M = SO.me; return SO.focusT > SO.time || ['monk', 'ranger'].includes(SO.P.cls) || SO.lock && M.perfAt && SO.time - M.perfAt < 3; },
  pick(B, dist, ph, can) {
    const r = Math.random();
    return can('wander') && r < .2 ? 'wander' : can('newtab') && r < .45 ? 'newtab' : can('haze') && r < .62 ? 'haze' : can('mist') && r < .75 ? 'mist' : dist < 3.8 ? 'swat' : '';
  },
  onStrike(a, ph) { if (a.k === 'newtab' && ph >= 1) soDrops(a.A, 4, 7, .9); },
  dmgIn(o) { if (o.dot) return 1; if (o.sk?.st === 'foc') SO.focusT = SO.time + 8; return this.sees() || Math.random() > .45 ? 1 : 0; },
  // Wander: fog clouds round you swap left and right, and it drifts somewhere else
  tele(a) { if (a.k !== 'wander') return false; const M = SO.me; a.pts = [0, 1, 2].map(i => { const an = Math.random() * 6.28, r = i ? 2.5 + Math.random() * 2 : 0, x = M.x + Math.cos(an) * r, z = M.z + Math.sin(an) * r; soFloor(new THREE.CircleGeometry(2.2, 24), '#adb5bd', x, z, 0, a); return [x, z]; }); return true; },
  strike(a, ph) {
    if (a.k !== 'wander') return false; const B = SO.B;
    a.pts.forEach(([x, z]) => soZone(x, z, { k: 'confuse', r: 2.2, life: ph >= 3 ? 9 : 5, col: '#adb5bd' }));
    soBoom(B.x, B.z, '#e9ecef', 1); const an = Math.random() * 6.28; B.x = Math.cos(an) * 8; B.z = Math.sin(an) * 8; soBoom(B.x, B.z, '#e9ecef', 1);
    B.state = 'recover'; B.t = .6; return true;
  },
  step(dt, ph) { if (ph >= 3 && SO.S?.fog) { SO.S.fog.near += (8 - SO.S.fog.near) * dt * .3; SO.S.fog.far += (24 - SO.S.fog.far) * dt * .3; } },
  chip: () => SO_DEFS['Fog of Distraction'].sees() ? '🎯 clear' : '🌫️ foggy',
  draw2(G, B, t) { G.inner.rotation.y = t * .25; G.root.position.y = .3 + Math.sin(t * 1.3) * .2; SO.tabs?.forEach((w, i) => { w.position.y = 3 + i % 4 + Math.sin(t * .7 + i) * .5; }); },
  arena(S, W, m, rnd) {
    soArenaBase(S, W, { bg: '#5c6b7a', fog: [16, 48], sky: '#e9ecef', gnd: '#495057', hemi: .8, key: '#f8f9fa', keyI: .7, floor: '#8693a0', patch: '#97a4b0', seed: 'tab', rune: '#fcc419' });
    // floating browser windows all round
    SO.tabs = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + rnd() * .3, r = 15 + rnd() * 6, g = new THREE.Group(); g.position.set(Math.cos(a) * r, 3, Math.sin(a) * r); g.lookAt(0, 3, 0); W.add(g);
      is3mesh(new THREE.BoxGeometry(4, 2.6, .12), '#f8f9fa', 0, 0, 0, g); is3mesh(new THREE.BoxGeometry(4, .4, .14), '#4dabf7', 0, 1.1, 0, g); for (let j = 0; j < 3; j++) is3mesh(new THREE.BoxGeometry(2.6 - j * .6, .16, .14), '#ced4da', -.4, .4 - j * .45, .02, g); SO.tabs.push(g); }
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.28, r = 14 + rnd() * 3, c = m(new THREE.IcosahedronGeometry(1.4 + rnd() * 1.4, 1), '#dee2e6', Math.cos(a) * r, .6, Math.sin(a) * r); c.scale.y = .5; }
  },
  model: () => soModelFrom('Fog of Distraction', 1.5),
};
