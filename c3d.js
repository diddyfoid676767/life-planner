'use strict';
/* 3D creatures (three.js). Each species in creatures.js has a body plan (quad,
   turtle, bug, blob, golem, bird, frog, roo, serpent), three colours and a few
   features (ears, tails, horns, wings...). creature3() builds a model from
   those with the same joints as the athlete rig in b3d.js (hips, spine, head,
   two "arms" and two "legs"), so every battle animation works on it. For four-
   legged creatures the arms are the front legs. Joints move relative to the
   rest pose (P.rel), so legs hang straight until a clip moves them.

   Pages with creatures on them (the starter picker and the Team page) get a
   small spinning model in each slot. One hidden renderer draws them all and
   copies each frame onto the slot's own canvas, so it only ever uses one
   WebGL context. */

// ---------- building a creature ----------
function c3eyes(par, x, y, z, r, o = {}) {
  const white = b3mat('#ffffff', { rough: .15, phys: true, cc: 1 }), dark = b3mat(o.pupil || '#1a1a2e', { rough: .1, phys: true, cc: 1, emi: o.glowEye || 0, ei: o.glowEye ? 2 : 1 });
  for (const s of [-1, 1]) {
    const e = b3mesh(new THREE.SphereGeometry(r, 24, 18), white, { cast: false }); e.scale.set(1, 1.1, .7); par.add(b3at(e, s * x, y, z));
    const p = b3mesh(new THREE.SphereGeometry(r * .62, 20, 14), dark, { cast: false }); p.scale.set(1, 1.1, .6); par.add(b3at(p, s * x, y - r * .05, z + r * .45));
    const h = new THREE.Mesh(new THREE.SphereGeometry(r * .2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); par.add(b3at(h, s * x - r * .22, y + r * .3, z + r * .72));
    if (o.angry) { const b = b3mesh(new THREE.CapsuleGeometry(r * .18, r * 1.1, 4, 8), b3mat(o.brow || '#212529'), { cast: false }); b.rotation.z = Math.PI / 2 + s * .4; par.add(b3at(b, s * x, y + r * 1.15, z + r * .3)); }
  }
}
// a limb that hangs straight down from its joint: upper part, a knee or elbow, lower part and a paw
function c3limb(par, x, y, z, r, len, mat, o = {}) {
  const sh = b3at(new THREE.Group(), x, y, z); par.add(sh);
  const inner = new THREE.Group(); inner.rotation.set(o.rx || 0, 0, o.rz || 0); sh.add(inner);
  const seg = (rr, ll) => b3mesh(new THREE.CapsuleGeometry(rr, ll, 6, 14).translate(0, -ll / 2, 0), mat);
  inner.add(seg(r, len));
  const el = b3at(new THREE.Group(), 0, -len, 0); inner.add(el);
  const el2 = new THREE.Group(); el2.rotation.x = o.kx || 0; el.add(el2);
  el2.add(seg(r * .85, len * (o.low ?? .9)));
  const foot = b3mesh(new THREE.SphereGeometry(r * (o.paw || 1.25), 18, 12), o.footMat || mat); foot.scale.set(1, .7, o.long || 1.25);
  el2.add(b3at(foot, 0, -len * (o.low ?? .9) - r * .2, r * (o.long ? o.long * .5 : .3)));
  return { sh, el, hand: foot, hp: sh, kn: el, s: Math.sign(x) || 1 };
}
const c3none = par => { const sh = new THREE.Group(), el = new THREE.Group(), hand = new THREE.Group(); par.add(sh); sh.add(el); el.add(hand); return { sh, el, hand, hp: sh, kn: el, s: 1 }; };

function creature3(spId, o = {}) {
  const s = specOf(spId) || specOf('emberpup'), f = s.f || {}, [c0, c1, c2] = s.col || ['#adb5bd', '#868e96', '#f1f3f5'];
  const stoneish = s.types.includes('stone') || s.plan === 'golem';
  const M = {
    main: b3mat(c0, { phys: true, rough: stoneish ? .85 : .5, sheen: stoneish ? 0 : .7, sheenC: shade(c0, .45), flat: stoneish, cc: s.types.includes('water') || s.plan === 'frog' ? .8 : 0 }),
    acc: b3mat(c1, { phys: true, rough: .45, sheen: .5, cc: .3, flat: stoneish }),
    belly: b3mat(c2, { phys: true, rough: .6, sheen: .6 }),
    dark: b3mat('#212529', { rough: .35 }), gold: b3mat('#fcc419', { metal: .9, rough: .25, emi: '#7a5c00', ei: .3 }),
    glow: new THREE.MeshStandardMaterial({ color: c1, emissive: c1, emissiveIntensity: 1.8, roughness: .4 }),
  };
  if (f.ghost) for (const k of ['main', 'acc', 'belly']) Object.assign(M[k], { transparent: true, opacity: .7, emissive: new THREE.Color(c1), emissiveIntensity: .25 });
  if (f.glow) Object.assign(M.acc, { emissive: new THREE.Color(c1), emissiveIntensity: .45 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const P = { root, body, L: { scale: 1, type: TYPES[s.types[0]][2] }, M, rel: true, sp: s.id, plan: s.plan, ticks: [] };
  const add = (par, geo, mat, x = 0, y = 0, z = 0, sc) => { const m = b3mesh(geo, mat); m.position.set(x, y, z); if (sc) m.scale.set(...sc); par.add(m); return m; };
  const S = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);
  let hipY = .7, chest = .9, top = 1.4, head, spine, hips;
  const rig = y => { hips = b3at(new THREE.Group(), 0, y, 0); body.add(hips); spine = new THREE.Group(); hips.add(spine); hipY = y; };
  const mkHead = (x, y, z) => { head = b3at(new THREE.Group(), x, y, z); spine.add(head); return head; };
  const plan = s.plan || 'quad';

  if (plan === 'quad') {
    rig(.66);
    add(spine, S(.34), M.main, 0, .14, 0, [1.05, .95, 1.5]);
    add(spine, S(.3), M.belly, 0, .04, .06, [.9, .7, 1.25]);
    mkHead(0, .44, .5);
    add(head, S(.3), M.main, 0, 0, 0, [1, .95, 1]);
    add(head, S(.15), M.belly, 0, -.08, .24, [1.05, .78, 1.05]);
    add(head, S(.05, 12, 10), M.dark, 0, -.02, .4);
    c3eyes(head, .12, .07, .23, .085);
    P.arms = [-1, 1].map(k => c3limb(spine, k * .19, -.02, .3, .085, .27, M.main, { footMat: M.belly }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .19, .0, -.3, .09, .27, M.main, { footMat: M.belly }));
    P.tailAt = b3at(new THREE.Group(), 0, .25, -.5); hips.add(P.tailAt);
    P.backAt = V3(0, .45, -.05); chest = .85; top = 1.45;
  } else if (plan === 'turtle') {
    rig(.36);
    add(spine, S(.36), M.main, 0, .06, 0, [1.1, .7, 1.25]);
    const shell = add(spine, new THREE.SphereGeometry(.52, 32, 18, 0, Math.PI * 2, 0, Math.PI * .5), M.acc, 0, .08, -.02, [1, .78, 1.12]);
    add(spine, new THREE.TorusGeometry(.5, .05, 10, 40), M.belly, 0, .08, -.02, [1, 1.12, 1]).rotation.x = Math.PI / 2;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const p = add(spine, new THREE.CircleGeometry(.1, 6), M.belly, Math.cos(a) * .26, .38, Math.sin(a) * .3 - .02); p.lookAt(p.position.clone().multiplyScalar(4).setY(2)); }
    mkHead(0, .16, .62);
    add(head, S(.24), M.main, 0, .08, .05, [1, .92, 1.08]);
    c3eyes(head, .11, .14, .23, .075);
    P.arms = [-1, 1].map(k => c3limb(spine, k * .33, -.05, .34, .1, .12, M.main, { low: .6 }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .33, 0, -.32, .1, .12, M.main, { low: .6 }));
    P.tailAt = b3at(new THREE.Group(), 0, .05, -.55); hips.add(P.tailAt);
    P.backAt = V3(0, .5, -.02); chest = .55; top = 1.0; P.shell = shell;
  } else if (plan === 'bug') {
    rig(.85);
    add(spine, S(.36), M.main, 0, 0, -.05, [1, .95, 1.15]);
    for (let k = 0; k < 3; k++) add(spine, new THREE.TorusGeometry(.33 - Math.abs(k - 1) * .05, .045, 10, 36), M.acc, 0, 0, -.25 + k * .14, [1, .98, 1]).rotation.y = 0;
    add(spine, new THREE.ConeGeometry(.07, .2, 12), M.dark, 0, -.05, -.48).rotation.x = -Math.PI / 2;
    mkHead(0, .22, .34);
    add(head, S(.24), M.main, 0, 0, 0);
    c3eyes(head, .1, .03, .17, .085);
    for (const k of [-1, 1]) { const a = add(head, new THREE.CylinderGeometry(.012, .012, .26, 6), M.dark, k * .08, .3, .02); a.rotation.z = -k * .35; add(head, S(.04, 10, 8), M.acc, k * .13, .42, .02); }
    P.wings = [-1, 1].map(k => { const g = b3at(new THREE.Group(), k * .1, .3, -.08); spine.add(g); const w = add(g, S(.3, 20, 12), b3mat('#e7f5ff', { phys: true, op: .45, trans: true, rough: .1, cc: 1, side: THREE.DoubleSide, emi: '#a5d8ff', ei: .2 }), k * .22, .12, -.05, [1, .08, .55]); w.rotation.z = k * .5; return g; });
    P.ticks.push(t => P.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * Math.sin(t * 38) * .45; }));
    P.hover = 1;
    P.arms = [-1, 1].map(k => c3limb(spine, k * .26, -.06, .18, .045, .12, M.dark, { low: .8, paw: 1 }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .2, -.25, -.05, .045, .14, M.dark, { low: .8, paw: 1 }));
    P.tailAt = b3at(new THREE.Group(), 0, 0, -.45); hips.add(P.tailAt);
    P.backAt = V3(0, .32, -.1); chest = .9; top = 1.45;
  } else if (plan === 'blob') {
    rig(.06);
    add(spine, S(.5, 36, 26), M.main, 0, .46, 0, [1, .9, 1]);
    add(spine, S(.36), M.belly, 0, .36, .18, [1, .85, .7]);
    mkHead(0, .52, .2);
    c3eyes(head, .16, .08, .24, .1);
    add(head, new THREE.TorusGeometry(.05, .012, 6, 16, Math.PI), M.dark, 0, -.06, .3).rotation.z = Math.PI;
    P.arms = [-1, 1].map(k => c3limb(spine, k * .46, .45, 0, .09, .07, M.main, { low: .5, paw: 1.1, rz: k * .5 }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .2, .02, .08, .09, .02, M.main, { low: .2, paw: 1.3 }));
    P.tailAt = b3at(new THREE.Group(), 0, .3, -.45); hips.add(P.tailAt);
    P.backAt = V3(0, .9, -.05); chest = .5; top = 1.05;
  } else if (plan === 'golem') {
    rig(.62);
    add(spine, new THREE.DodecahedronGeometry(.48, 1), M.main, 0, .5, 0, [1.2, 1.05, .85]);
    add(spine, new THREE.DodecahedronGeometry(.32, 1), M.belly, 0, .42, .2, [1.1, 1, .5]);
    add(spine, new THREE.DodecahedronGeometry(.26, 1), M.acc, 0, .05, 0, [1.3, .7, 1]);
    mkHead(0, 1.02, .08);
    add(head, new THREE.DodecahedronGeometry(.24, 1), M.main, 0, .05, 0, [1, .9, .95]);
    c3eyes(head, .1, .08, .2, .065, { angry: 1 });
    P.arms = [-1, 1].map(k => { const a = c3limb(spine, k * .64, .78, 0, .14, .3, M.main, { paw: 1.6, footMat: M.acc, rz: k * .12 }); add(a.sh, new THREE.DodecahedronGeometry(.2, 0), M.acc, 0, .02, 0); return a; });
    P.legs = [-1, 1].map(k => c3limb(hips, k * .26, -.05, 0, .15, .2, M.main, { low: .8, paw: 1.25, footMat: M.acc }));
    P.tailAt = b3at(new THREE.Group(), 0, .1, -.4); hips.add(P.tailAt);
    P.backAt = V3(0, .9, -.3); chest = 1.2; top = 1.95; P.biped = 1;
  } else if (plan === 'bird') {
    rig(.5);
    const b = add(spine, S(.36), M.main, 0, .3, 0, [.95, 1.05, 1.15]); b.rotation.x = -.3;
    add(spine, S(.27), M.belly, 0, .24, .16, [.9, 1, .7]);
    for (let k = 0; k < 3; k++) { const t = add(spine, S(.12, 12, 8), M.acc, (k - 1) * .09, .2, -.42, [.5, .15, 1.6]); t.rotation.set(.35, (k - 1) * .35, 0); }
    mkHead(0, .7, .2);
    add(head, S(.24), M.main, 0, 0, 0);
    const beak = add(head, new THREE.ConeGeometry(.07, .22, 14), b3mat('#fab005', { phys: true, cc: .6, rough: .3 }), 0, -.04, .27); beak.rotation.x = Math.PI / 2;
    c3eyes(head, f.owl ? .1 : .12, .06, f.owl ? .19 : .14, f.owl ? .095 : .07, { angry: !f.owl && s.stage > 1 });
    P.arms = [-1, 1].map(k => { const g = b3at(new THREE.Group(), k * .3, .45, -.02); spine.add(g); const w = add(g, S(.3, 20, 12), M.acc, k * .06, -.2, -.05, [.16, .7, .85]); w.rotation.z = -k * .15; const el = new THREE.Group(); g.add(el); const hand = b3at(new THREE.Group(), k * .08, -.4, 0); el.add(hand); return { sh: g, el, hand, s: k }; });
    P.legs = [-1, 1].map(k => c3limb(hips, k * .12, .02, 0, .035, .22, b3mat('#e67700', { rough: .5 }), { low: .9, paw: 1.6, long: 1.6 }));
    P.ticks.push((t, flying) => { if (!flying) return; });
    P.tailAt = b3at(new THREE.Group(), 0, .25, -.4); hips.add(P.tailAt);
    P.backAt = V3(0, .6, -.15); chest = .85; top = 1.45; P.flapper = 1;
  } else if (plan === 'frog') {
    rig(.28);
    const b = add(spine, S(.42), M.main, 0, .16, 0, [1.12, .8, 1.1]); b.rotation.x = -.25;
    add(spine, S(.34), M.belly, 0, .1, .14, [1.05, .7, .8]);
    mkHead(0, .38, .26);
    add(head, S(.3), M.main, 0, 0, 0, [1.15, .78, 1]);
    for (const k of [-1, 1]) add(head, S(.13), M.main, k * .17, .18, .02);
    c3eyes(head, .17, .21, .1, .1);
    add(head, new THREE.TorusGeometry(.2, .014, 6, 30, Math.PI), M.dark, 0, -.06, .21, [1, .5, 1]).rotation.z = Math.PI;
    P.arms = [-1, 1].map(k => c3limb(spine, k * .32, .02, .3, .06, .14, M.main, { low: .7, paw: 1.6 }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .38, .08, -.12, .1, .2, M.main, { rx: -1.1, kx: 2, low: 1, paw: 1.4, long: 2.2 }));
    P.tailAt = b3at(new THREE.Group(), 0, .1, -.4); hips.add(P.tailAt);
    P.backAt = V3(0, .45, -.1); chest = .45; top = .85;
  } else if (plan === 'roo') {
    rig(.58);
    const t = add(spine, new THREE.CapsuleGeometry(.29, .34, 10, 24), M.main, 0, .35, 0, [1.05, 1, .9]); t.rotation.x = .12;
    add(spine, new THREE.CapsuleGeometry(.21, .26, 8, 20), M.belly, 0, .3, .12, [1, 1, .6]);
    mkHead(0, .92, .1);
    add(head, S(.22), M.main, 0, .02, 0, [1, 1, 1.05]);
    add(head, S(.12), M.belly, 0, -.05, .18, [1, .8, 1]);
    add(head, S(.04, 12, 10), M.dark, 0, -.02, .29);
    c3eyes(head, .09, .07, .17, .065);
    P.arms = [-1, 1].map(k => c3limb(spine, k * .24, .58, .16, .06, .16, M.main, { low: .8, paw: f.gloves ? 2.4 : 1.2, footMat: f.gloves ? b3mat('#e03131', { phys: true, cc: .8, rough: .3 }) : M.belly, rx: -.5 }));
    P.legs = [-1, 1].map(k => c3limb(hips, k * .18, 0, 0, .12, .24, M.main, { low: .85, paw: 1.1, long: 2.6, footMat: M.acc }));
    // a thick tail that props it up
    let p = b3at(new THREE.Group(), 0, .05, -.24); hips.add(p); P.tail = p;
    for (let k = 0; k < 5; k++) { const g = b3at(new THREE.Group(), 0, k ? -.04 : 0, k ? -.13 : 0); g.rotation.x = .2; p.add(g); add(g, S(.12 - k * .016, 16, 12), M.main, 0, 0, 0, [1, 1, 1.5]); p = g; }
    P.backAt = V3(0, .7, -.22); chest = 1.0; top = 1.55; P.biped = 1;
  } else if (plan === 'serpent') {
    rig(.32);
    const pts = [[0, 0, -.1, .3], [0, .18, .12, .27], [0, .42, .2, .24], [0, .66, .16, .22], [0, .86, .2, .2]];
    pts.forEach(([x, y, z, r], k) => { add(spine, S(r), M.main, x, y, z); if (k < 4) add(spine, S(r * .8), M.belly, x, y, z + r * .35, [1, 1, .6]); });
    let p = b3at(new THREE.Group(), 0, -.05, -.3); hips.add(p); P.tail = p;
    for (let k = 0; k < 6; k++) { const g = b3at(new THREE.Group(), 0, -.02, -.2); p.add(g); add(g, S(.26 - k * .035, 16, 12), M.main); p = g; }
    add(p, new THREE.ConeGeometry(.08, .3, 12), M.acc, 0, 0, -.15).rotation.x = -Math.PI / 2;
    mkHead(0, 1.08, .3);
    add(head, S(.27), M.main, 0, 0, 0, [1, .9, 1.1]);
    add(head, S(.16), M.belly, 0, -.08, .2, [1.1, .7, 1.1]);
    for (const k of [-1, 1]) add(head, S(.025, 8, 6), M.dark, k * .06, -.04, .36);
    c3eyes(head, .13, .08, .19, .075, { angry: s.stage > 1 });
    for (let k = 0; k < 4; k++) add(spine, new THREE.ConeGeometry(.06, .16, 10), M.acc, 0, .3 + k * .22, -.08 - (k === 0 ? .2 : 0)).rotation.x = -.6;
    P.arms = [-1, 1].map(k => c3limb(spine, k * .22, .5, .32, .05, .14, M.main, { low: .8, paw: 1.3, footMat: M.acc, rx: -.6 }));
    P.legs = [c3none(hips), c3none(hips)];
    P.backAt = V3(0, .7, -.05); chest = .8; top = 1.45;
  }
  P.hips = hips; P.spine = spine; P.head = head; P.hipY = hipY;

  // ---------- features ----------
  const onHead = (geo, mat, x, y, z, sc) => add(head, geo, mat, x, y, z, sc);
  const hr = plan === 'blob' ? .3 : plan === 'golem' ? .24 : plan === 'turtle' ? .24 : .27;
  const back = P.backAt || V3(0, .5, 0);
  if (f.ears === 'pointy') for (const k of [-1, 1]) { const e = onHead(new THREE.ConeGeometry(.08, .24, 14), M.main, k * hr * .55, hr * .88, -.02); e.rotation.z = -k * .3; onHead(new THREE.ConeGeometry(.045, .14, 10), M.acc, k * hr * .53, hr * .85, .015).rotation.z = -k * .3; }
  if (f.ears === 'round') for (const k of [-1, 1]) { onHead(S(.08, 16, 12), M.main, k * hr * .72, hr * .7, -.02, [1, 1, .5]); onHead(S(.05, 12, 8), M.belly, k * hr * .72, hr * .7, .015, [1, 1, .4]); }
  if (plan === 'roo') for (const k of [-1, 1]) { const e = onHead(S(.08, 14, 10), M.main, k * .1, .3, -.04, [.6, 1.9, .5]); e.rotation.z = -k * .25; }
  if (f.koala) for (const k of [-1, 1]) { onHead(S(.12, 18, 12), M.main, k * .23, .17, -.02, [1, 1, .45]); onHead(S(.08, 14, 10), M.belly, k * .23, .17, .01, [1, 1, .4]); }
  if (f.koala) onHead(S(.06, 14, 10), M.dark, 0, -.04, .26, [1, 1.3, .8]);
  if (f.tufts) for (const k of [-1, 1]) { const e = onHead(new THREE.ConeGeometry(.05, .16, 10), M.acc, k * .14, .24, 0); e.rotation.z = -k * .5; }
  if (f.crest) for (let k = 0; k < 3; k++) { const c = onHead(new THREE.ConeGeometry(.04, .2, 10), M.acc, 0, .22 + k * .02, -.06 - k * .07); c.rotation.x = -.6 - k * .25; }
  if (f.horns) for (const k of [-1, 1]) { const h = onHead(new THREE.ConeGeometry(.045, .24, 12), b3mat('#f1f3f5', { phys: true, cc: .7, rough: .3 }), k * hr * .45, hr * .9, -.05); h.rotation.set(-.4, 0, -k * .35); }
  if (f.antenna) { onHead(new THREE.CylinderGeometry(.012, .012, .22, 6), M.dark, 0, hr + .08, 0); onHead(S(.05, 12, 8), M.glow, 0, hr + .2, 0); }
  if (f.crown) { const c = onHead(new THREE.CylinderGeometry(.12, .1, .07, 24, 1, true), M.gold, 0, hr + .02, -.01); c.material.side = THREE.DoubleSide; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; onHead(new THREE.ConeGeometry(.025, .08, 8), M.gold, Math.cos(a) * .11, hr + .09, Math.sin(a) * .11); } }
  if (f.glasses) for (const k of [-1, 1]) onHead(new THREE.TorusGeometry(.07, .012, 6, 20), M.dark, k * .1, .07, .24);
  if (f.mane) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; onHead(S(.09, 12, 8), M.acc, Math.cos(a) * .27, Math.sin(a) * .22 - .05, -.12); }
  if (f.fin) add(spine, new THREE.ConeGeometry(.12, .34, 3), M.acc, back.x, back.y + .05, back.z, [.3, 1, 1.4]);
  if (f.sprout) for (let k = 0; k < f.sprout; k++) { const l = add(spine, S(.14, 14, 10), b3mat('#51cf66', { phys: true, sheen: .6, rough: .5 }), (k ? .1 : -.05), back.y + .14, back.z - k * .05, [.45, .12, 1]); l.rotation.set(-.6, k ? .9 : -.4, .3); add(spine, new THREE.CylinderGeometry(.015, .02, .14, 6), b3mat('#2b8a3e'), 0, back.y + .05, back.z); }
  if (f.spikes) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const c = add(spine, new THREE.ConeGeometry(.06, .18, 10), M.belly, Math.cos(a) * .3, back.y - .04, Math.sin(a) * .34 + back.z); c.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); }
  if (f.tree) { add(spine, new THREE.CylinderGeometry(.06, .09, .4, 10), b3mat('#5c3a21', { rough: .9 }), 0, back.y + .2, back.z); for (let k = 0; k < 5; k++) add(spine, S(.2, 16, 12), b3mat(['#2f9e44', '#40c057', '#37b24d'][k % 3], { rough: .7, flat: true }), Math.cos(k * 1.3) * .18, back.y + .48 + (k % 2) * .1, back.z + Math.sin(k * 1.3) * .15); }
  if (f.runes) for (let k = 0; k < 4; k++) add(spine, new THREE.BoxGeometry(.08, .14, .02), M.glow, (k - 1.5) * .18, .55, .44);
  if (f.fur) for (let k = 0; k < 18; k++) { const a = k * 2.4, y = .25 + (k % 6) * .12; add(spine, S(.11, 10, 8), M.main, Math.cos(a) * .48, y, Math.sin(a) * .36); }
  if (f.icy) for (let k = 0; k < 5; k++) { const c = add(spine, new THREE.OctahedronGeometry(.08, 0), b3mat('#a5d8ff', { phys: true, cc: 1, rough: .05, emi: '#74c0fc', ei: .4 }), (k - 2) * .12, back.y + .12, back.z - Math.abs(k - 2) * .05, [.6, 1.8, .6]); c.rotation.z = (k - 2) * .2; }
  if (f.warts) for (let k = 0; k < 8; k++) add(spine, S(.04, 8, 6), M.acc, Math.cos(k * 2.1) * .3, .3 + Math.sin(k) * .05, Math.sin(k * 2.1) * .28 - .05);
  if (f.wings) P.backWings = [-1, 1].map(k => { const g = b3at(new THREE.Group(), k * .15, back.y + .05, back.z); spine.add(g); const w = add(g, new THREE.CircleGeometry(.45, 5, 0, Math.PI * .9), b3mat(c1, { phys: true, side: THREE.DoubleSide, op: .9, trans: true, sheen: .5, emi: f.glow ? c1 : 0, ei: .3 }), k * .3, .25, 0); w.rotation.set(0, Math.PI / 2, k * -.5 + Math.PI / 2 * (k > 0 ? 0 : 0)); w.scale.set(1, .8, 1); w.rotation.y = k * .3 + Math.PI / 2; return g; });
  if (P.backWings) P.ticks.push(t => P.backWings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (.25 + Math.sin(t * 5) * .3); }));
  // tails
  const ta = P.tailAt;
  if (ta && f.tail === 'flame') { add(ta, new THREE.ConeGeometry(.1, .4, 14), M.acc, 0, .12, -.05).rotation.x = -.5; const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('glow'), color: '#ff922b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); fl.scale.setScalar(.35); fl.position.set(0, .32, -.12); ta.add(fl); P.ticks.push(t => { fl.scale.setScalar(.32 + Math.sin(t * 13) * .05); fl.material.opacity = .8 + Math.sin(t * 17) * .2; }); }
  else if (ta && f.tail === 'paddle') add(ta, S(.16, 16, 10), M.acc, 0, -.05, -.12, [.9, .25, 1.4]);
  else if (ta && f.tail === 'bolt') { let y = 0; for (let k = 0; k < 3; k++) { const b = add(ta, new THREE.BoxGeometry(.08, .2, .05), M.acc, (k % 2 ? .06 : -.06), y + .1, -.05); b.rotation.z = k % 2 ? .6 : -.6; y += .16; } }
  else if (ta && (f.tail === 'long' || plan === 'quad')) { let p = ta; for (let k = 0; k < 4; k++) { const g = b3at(new THREE.Group(), 0, .04, -.1); g.rotation.x = -.35 + k * .15; p.add(g); add(g, S(.06 - k * .007, 12, 8), k === 3 ? M.acc : M.main); p = g; } }
  if (ta) P.tail = P.tail || ta;
  if (f.flame) { const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('glow'), color: '#ff6b00', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: .6 })); fl.scale.set(1.6, 1.8, 1); fl.position.set(0, chest - hipY, -.1); spine.add(fl); P.ticks.push(t => { fl.material.opacity = .45 + Math.sin(t * 9) * .12; }); }
  if (f.glow || f.ghost) { const g = new THREE.PointLight(c1, .8, 3, 2); g.position.set(0, chest - hipY, .3); spine.add(g); }

  const big = (f.big ? 1.2 : 1) * (s.stage === 3 ? 1.15 : s.stage === 2 ? 1.05 : .92);
  P.L.scale = big * (o.scale || 1);
  P.chestH = chest; P.headH = top;
  P.arms = P.arms || [c3none(spine), c3none(spine)]; P.legs = P.legs || [c3none(hips), c3none(hips)];
  root.scale.setScalar(P.L.scale);
  P.mats = [];
  root.traverse(x => { if (x.isMesh && x.material?.emissive) P.mats.push(x.material); });
  P.mats = [...new Set(P.mats)]; P.mats.forEach(m => { m.userData.emi = m.emissive.clone(); m.userData.op = m.opacity; m.userData.tr = m.transparent; });
  return P;
}

// joints: the athlete rig sets them straight from the pose; creatures move from their rest pose
function rigJoints(P, pose, t = 0) {
  P.body.rotation.set(pose.lean, 0, pose.roll, 'YXZ');
  P.hips.position.y = (P.hipY ?? .98) - pose.crouch * (P.rel ? .6 : 1) + (P.hover ? Math.sin(t * 3) * .06 : 0);
  P.spine.rotation.set(pose.lean * .3, pose.twist, 0);
  P.head.rotation.set(pose.headX, pose.headY, 0);
  const [l, r] = P.arms, k = P.rel ? .7 : 1, d = (v, b) => P.rel ? (v - b) * k : v;
  l.sh.rotation.set(d(pose.shL, POSE0.shL), 0, d(pose.shLz, POSE0.shLz)); l.el.rotation.x = d(pose.elL, POSE0.elL) * (P.rel ? .4 : 1);
  r.sh.rotation.set(d(pose.shR, POSE0.shR), 0, d(pose.shRz, POSE0.shRz)); r.el.rotation.x = d(pose.elR, POSE0.elR) * (P.rel ? .4 : 1);
  P.legs[0].hp.rotation.x = d(pose.hipL, POSE0.hipL); P.legs[0].kn.rotation.x = d(pose.knL, POSE0.knL);
  P.legs[1].hp.rotation.x = d(pose.hipR, POSE0.hipR); P.legs[1].kn.rotation.x = d(pose.knR, POSE0.knR);
  if (P.flapper) { const fl = Math.sin(t * (P.flap ? 22 : 2.5)) * (P.flap ? .9 : .08); l.sh.rotation.z += -fl - .05; r.sh.rotation.z += fl + .05; }
  for (const f of P.ticks || []) f(t);
}

// ---------- little viewers on the Team page and the starter picker ----------
const C3V = { slots: [] };
function c3viewInit() {
  if (C3V.R !== undefined) return C3V.R;
  if (typeof webglOK !== 'function' || !webglOK()) return (C3V.R = null);
  try {
    const R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    R.setPixelRatio(1); R.setSize(320, 320, false); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
    fxEnv(R, scene, '#9ec5ff', '#fff4e0', '#5a4a3a', new THREE.Vector3(.4, .8, .5), '#fff3d6', '#6b5a4a');
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', .7));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.7); sun.position.set(2.5, 5, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight('#b4c8ff', 1); rim.position.set(-3, 3, -4); scene.add(rim);
    const blob = fxBlob(.75, .5); scene.add(blob);
    Object.assign(C3V, { R, scene, cam, clock: new THREE.Clock() });
    return R;
  } catch (e) { console.error('3D creature viewer failed', e); return (C3V.R = null); }
}
function c3mount() {
  const els = [...document.querySelectorAll('[data-c3]')];
  C3V.slots = C3V.slots.filter(s => s.el.isConnected);
  if (!els.length || !c3viewInit()) return;
  for (const el of els) {
    const sp = el.dataset.c3; if (!specOf(sp)) continue;
    let slot = C3V.slots.find(s => s.el === el);
    if (slot && slot.sp === sp) continue;
    if (!slot) { const cv = document.createElement('canvas'); cv.width = cv.height = 320; cv.className = 'c3canvas'; slot = { el, cv, ctx: cv.getContext('2d') }; C3V.slots.push(slot); }
    if (slot.P) c3free(slot.P);
    slot.sp = sp; slot.P = creature3(sp); slot.yaw = -.5; slot.pop = 0;
    el.classList.add('has3d'); if (!slot.cv.isConnected) el.prepend(slot.cv);
    slot.cv.onpointerdown = e => { slot.drag = { x: e.clientX, yaw: slot.yaw, moved: 0 }; slot.cv.setPointerCapture(e.pointerId); e.stopPropagation(); };
    slot.cv.onpointermove = e => { if (!slot.drag) return; const dx = e.clientX - slot.drag.x; slot.drag.moved = Math.max(slot.drag.moved, Math.abs(dx)); slot.yaw = slot.drag.yaw + dx * .015; };
    slot.cv.onpointerup = e => { if (slot.drag && slot.drag.moved < 4) slot.pop = 1; else e.stopPropagation(); slot.drag = null; };
    slot.cv.onclick = e => { if (el.id === 'c3view') e.stopPropagation(); };
  }
  if (!C3V.on) { C3V.on = true; C3V.raf = requestAnimationFrame(c3loop); }
}
function c3free(P) { P.root.traverse(o => { o.geometry?.dispose(); }); }
function c3loop() {
  C3V.slots = C3V.slots.filter(s => { if (s.el.isConnected) return true; c3free(s.P); return false; });
  if (!C3V.slots.length) { C3V.on = false; return; }
  C3V.raf = requestAnimationFrame(c3loop);
  const dt = Math.min(.05, C3V.clock.getDelta()), t = C3V.clock.elapsedTime, { R, scene, cam } = C3V;
  for (const s of C3V.slots) {
    const P = s.P, b = Math.sin(t * 2.6 + s.cv.width);
    s.pop = Math.max(0, s.pop - dt * 2); const k = Math.sin((1 - s.pop) * Math.PI) * (s.pop > 0 ? 1 : 0);
    const pose = { ...POSE0, crouch: .03 + b * .02, headY: Math.sin(t * .7) * .25, headX: -k * .3, y: k * .35, shL: POSE0.shL - k * 1.2, shR: POSE0.shR - k * 1.2 };
    P.flap = k > .1;
    P.root.position.set(0, pose.y, 0); P.root.rotation.set(0, s.yaw, 0); P.root.scale.setScalar(P.L.scale * (1 + k * .06));
    rigJoints(P, pose, t);
    const h = P.headH * P.L.scale;
    cam.position.set(0, h * .62 + .25, Math.max(2.6, h * 2.55)); cam.lookAt(0, h * .45, 0);
    scene.add(P.root); R.render(scene, cam); scene.remove(P.root);
    s.ctx.clearRect(0, 0, 320, 320); s.ctx.drawImage(R.domElement, 0, 0);
  }
}
// after every render, put a model in each creature slot on the page
addEventListener('load', () => {
  const _render = render;
  render = function () { _render.apply(this, arguments); if (view === 'arena') try { c3mount(); } catch (e) { console.error(e); } };
});
