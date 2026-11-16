'use strict';
/* Walk mode (2.75, rebuilt in 2.80 for feedback stage F3: the movement core).
   Your character (hero.js: the KayKit rig with real animations, your head, hair and
   cosmetics) walks the whole island: grass, roads, hills and terraformed slopes. It
   speeds up and slows down smoothly, sprints on Shift (uses stamina), jumps on Space
   (with a short grace window after a ledge and before landing), rolls on Ctrl or the
   right mouse button, and swims in water. Buildings, trees, rocks, decorations, cliffs
   and the island's edge block you. The camera sits over your shoulder, lags a little
   behind, zooms with the mouse wheel and pulls in rather than going through things.
   Walking into a page building opens its window. No lock-on: the camera is free.
   The camera hook (wkCam) is called from is3draw. */
const WK_ENABLED = true;

const WK_C = {
  scale: .3,            // the character's size on the island (hexes are 2 across)
  jog: 2.7, sprint: 4.3, swim: 1.35, swimFast: 2.1,
  acc: 12, dec: 16, air: 2.5,              // how fast you reach your speed, stop, and steer in the air
  grav: 18, jump: 4.1, coyote: .13, buffer: .14, step: .22,
  roll: { speed: 5, time: .55, cost: 22 },
  sprintJump: 1.1,      // a sprint jump goes a little higher, and flies over a river hex (a standing or jogging jump falls in)
  stam: { max: 100, sprint: 20, regen: 26, wait: .8, back: 30 },
  r: .18,               // your width, for bumping into things
  water: -.2,           // the water's surface; you swim with your shoulders just under it
  camH: .58, camSide: .26,
};
const WK = { on: false, H: null, sig: '', x: 0, z: 2.6, y: 0, vx: 0, vz: 0, vy: 0, face: Math.PI, cy: 0, cp: .3, cd: 3, cdNow: 3, ct: null, keys: {}, raf: 0, t: 0,
  ground: true, air: 0, jumpBuf: 0, stam: 100, tired: false, rest: 0, roll: 0, rollDir: [0, 0], swim: false, land: 0, near: null, cool: 0, stepPh: 0, ripple: null };
const wkOk = () => (ui.isTab || 'personal') === 'personal' && !ui.hxVisit && !ui.hxP;
const wkTyping = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// ---------- on and off ----------
function wkToggle(on = !WK.on) {
  if (on && !WK_ENABLED) return;
  if (on && (!window.THREE || !IS3.R || !HX3.kit || !wkOk() || (typeof shell2D === 'function' && shell2D()))) { toast('🚶 Walk mode', 'Walk mode works on your own island in the 3D view.'); return; }
  if (on && !heroReady()) { if (!HERO.fail) { toast('🚶 Walk mode', 'Getting your character ready…'); heroLoad().then(g => { if (g && view === 'islands') wkToggle(true); }); } else toast('🚶 Walk mode', "Your character couldn't load. Try restarting Solis."); return; }
  if (WK.on === on) return;
  WK.on = on; document.body.classList.toggle('walking', on);
  if (on) {
    Object.assign(ui, { hxSel: null, isPanel: null });
    wkSpawn(); WK.cool = performance.now() + 600;
    Object.assign(WK, { y: wkGround(WK.x, WK.z), vx: 0, vz: 0, vy: 0, ground: true, stam: WK_C.stam.max, tired: false, roll: 0, swim: false, ct: null, cdNow: WK.cd });
    WK.cam = { fov: IS3.cam.fov, near: IS3.cam.near };
    IS3.cam.fov = 55; IS3.cam.near = .05; IS3.cam.updateProjectionMatrix();
    wkFig(); if (typeof sfx === 'function') sfx('whoosh');
    render(); wkHud(); wkLoop();
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    if (WK.H) IS3.scene.remove(WK.H.root);
    if (WK.ripple) IS3.scene.remove(WK.ripple);
    if (WK.cam) { IS3.cam.fov = WK.cam.fov; IS3.cam.near = WK.cam.near; IS3.cam.updateProjectionMatrix(); }
    WK.keys = {};
    document.getElementById('wkhud')?.remove(); render(); is3draw();
  }
}
// your character, rebuilt when what you wear changes
function wkFig() {
  const d = typeof youAvData === 'function' ? youAvData(pfSpec()) : { spec: avatarSpec(), gear: {}, cls: '' }, ci = typeof cdClassInfo === 'function' ? cdClassInfo() : null;
  const sig = JSON.stringify(d) + (ci?.id || '');
  if (WK.H && WK.sig === sig) { if (!WK.H.root.parent) IS3.scene.add(WK.H.root); return; }
  if (WK.H) { WK.H.dispose(); av3dispose(WK.H.root); }
  WK.sig = sig; WK.H = heroMake({ spec: d.spec, gear: d.gear || {}, cls: d.cls || '', outfit: heroOutfitOf(ci?.id), scale: WK_C.scale });
  IS3.scene.add(WK.H.root);
  if (!WK.ripple) { WK.ripple = new THREE.Mesh(new THREE.RingGeometry(.15, .2, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .3, depthWrite: false })); WK.ripple.rotation.x = -Math.PI / 2; }
}

// ---------- the island: what's on each hex ----------
// h: ground height, solid: blocks like a wall, r: a round obstacle in the middle (buildings, trees), water
const WK_DECO_R = { bench: .3, lamp: .14, flag: .12, barrels: .3, cart: .38, tent: .62, statue: .4, fountain: .62, tree: .42, rock: .38 };
function wkCell(k) {
  const m = WK.cells || (WK.cells = new Map()); let c = m.get(k); if (!c) { c = wkCell0(k); m.set(k, c); } return c;
}
function wkCell0(k) {
  const st = hxState(), a = hxAt(k, st), h = typeof hxHt === 'function' ? hxHt(k, st) : 0;
  switch (a.kind) {
    case 'off': return { k, a, solid: true, h: 0 };
    case 'mount': return { k, a, solid: true, h: h + 1.5 };
    case 'water': case 'pond': return { k, a, water: true, h: -.6 };
    case 'river': return { k, a, h: 0, river: true }; // banks you can walk on, a channel you swim in
    case 'b': return a.it?.field ? { k, a, h } : { k, a, h, r: a.it?.wall ? .78 : .86, tall: 1.6 };
    case 'free': return { k, a, h, r: .88, tall: 1.8, door: a.it };
    case 'tree': return { k, a, h, r: .5, tall: 1.4 };
    case 'rock': return { k, a, h, r: .45, tall: .5 };
    case 'hill': return { k, a, h: h + .25 };
    case 'deco': return st.tf?.[k]?.t === 'water' || hxW(st).land().get(k)?.t === 'water' ? { k, a, water: true, h: -.6 } : { k, a, h, r: WK_DECO_R[a.d] ?? HX_TF.deco[a.d]?.wr ?? 0, tall: .8 }; // 2.82: boats and bridges float on water
    case 'road': return { k, a, h, road: true, bridge: a.bridge, river: a.bridge };
    default: return { k, a, h };
  }
}
// ground height under a point: each hex is flat in the middle and slopes to meet its neighbours,
// so terraformed steps become ramps; differences over 2 steps stay as cliffs
function wkGround(x, z, cache) {
  const k = hxFromXZ(x, z), c = wkCell(k); if (c.solid) return c.h; if (c.water) return c.h;
  if (c.river) { const y = wkRay(k, x, z); return y == null ? 0 : y < -.05 ? -.6 : y; }
  const [cx, cz] = hxPos(...hxQR(k)); let h = c.h;
  for (const n of hxNb(k)) {
    const cn = wkCell(n); if (cn.solid || cn.water || Math.abs(cn.h - c.h) > .72) continue;
    const [nx, nz] = hxPos(...hxQR(n)), t = ((x - cx) * (nx - cx) + (z - cz) * (nz - cz)) / 4; // 0 in the middle, .5 at the shared edge
    if (t > .3) { const u = Math.min(1, (t - .3) / .2); h += (cn.h - c.h) * u * u * (3 - 2 * u) * .5; }
  }
  return h;
}
// the real height of a river or bridge hex's models under a point (the river runs in a channel between banks)
const WK_RAY = { ray: null, at: new Map(), sig: '' };
function wkRay(k, x, z) {
  if (!IS3.world) return null;
  if (WK_RAY.sig !== HX3.sig) { WK_RAY.at.clear(); WK_RAY.sig = HX3.sig; }
  let objs = WK_RAY.at.get(k);
  if (!objs) { const [cx, cz] = hxPos(...hxQR(k)); objs = IS3.world.children.filter(o => Math.abs(o.position.x - cx) < .01 && Math.abs(o.position.z - cz) < .01); WK_RAY.at.set(k, objs); }
  const R = WK_RAY.ray || (WK_RAY.ray = new THREE.Raycaster());
  R.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0)); R.far = 6;
  const hit = R.intersectObjects(objs, true).find(h => h.object.isMesh && h.object.visible && h.point.y < 1.2);
  return hit ? hit.point.y : null;
}
// the water's surface if you're in water here (water hexes, or a river's channel), else null
function wkWet(x, z) { const k = hxFromXZ(x, z), c = wkCell(k); if (c.water) return WK_C.water; if (!c.river || c.bridge) return null; const y = wkRay(k, x, z); return y != null && y < -.05 ? y : null; }
// pushes a point out of everything solid near it; returns the hexes that stopped you
function wkCollide(x, z, y, r = WK_C.r) {
  const k0 = hxFromXZ(x, z), seen = new Set([k0]), list = [k0];
  for (const n of hxNb(k0)) { seen.add(n); list.push(n); for (const m of hxNb(n)) if (!seen.has(m)) { seen.add(m); list.push(m); } }
  let hit = null;
  for (let pass = 0; pass < 2; pass++) for (const k of list) {
    const c = wkCell(k), [cx, cz] = hxPos(...hxQR(k));
    let R = 0;
    if (c.solid) R = 1.06;
    else if (!c.water && c.h > y + .5) R = 1.06; // a cliff too high to step or jump onto
    else if (c.r && y < c.h + (c.tall || 1)) R = c.r;
    if (!R) continue;
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), m = R + r;
    if (d < m) { const s = d > 1e-4 ? (m - d) / d : 1; x += dx * s; z += dz * s; hit = hit || c; }
  }
  return { x, z, hit };
}
// you start on the road just outside the hall, or the nearest open ground to it
function wkSpawn() {
  const [hx, hz] = hxPos(0, 0);
  for (let r = 1.6; r < 14; r += .4) for (let i = 0; i < 24; i++) {
    const a = Math.PI / 2 - i / 24 * Math.PI * 2 * (i % 2 ? -1 : 1) / 2, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
    const c = wkCell(hxFromXZ(x, z)); if (c.solid || c.water || c.r) continue;
    const p = wkCollide(x, z, c.h); if (p.hit) continue;
    WK.x = x; WK.z = z; WK.face = Math.atan2(hx - x, hz - z); WK.cy = WK.face + Math.PI; return; // facing the hall, with open ground behind for the camera
  }
  WK.x = 0; WK.z = 2.6;
}

// ---------- the loop ----------
function wkLoop() {
  if (WK.raf) return;
  WK.t = performance.now();
  const tick = now => {
    WK.raf = 0; if (!WK.on) return;
    const dt = Math.min(.05, (now - WK.t) / 1000); WK.t = now;
    if (!IS3.canvas?.isConnected) { WK.raf = requestAnimationFrame(tick); return; }
    wkStep(now, dt);
    wkAnim(now / 1000, dt);
    is3draw();
    WK.raf = requestAnimationFrame(tick);
  };
  WK.raf = requestAnimationFrame(tick);
}
function wkStep(now, dt) {
  if (!wkOk()) { wkToggle(false); return; } // you went to another island
  if (now - (WK.cellsT || 0) > 500) { WK.cells = null; WK.cellsT = now; } // what's on each hex, looked up again twice a second
  const C = WK_C, K = view === 'islands' && !document.querySelector('dialog[open]') ? WK.keys : {};
  const fw = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), st = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0);
  let mx = 0, mz = 0;
  if (fw || st) { const c = Math.cos(WK.cy), s = Math.sin(WK.cy); mx = -s * fw + c * st; mz = -c * fw - s * st; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
  const moving = !!(fw || st);
  // stamina: sprinting and rolling use it, it comes back after a short rest
  const wantSprint = K.shift && moving && !WK.tired;
  if (wantSprint || WK.roll > 0) WK.rest = C.stam.wait; else WK.rest = Math.max(0, WK.rest - dt);
  if (wantSprint) WK.stam = Math.max(0, WK.stam - C.stam.sprint * dt);
  else if (!WK.rest) WK.stam = Math.min(C.stam.max, WK.stam + C.stam.regen * dt);
  if (WK.stam <= 0) WK.tired = true; else if (WK.tired && WK.stam >= C.stam.back) WK.tired = false;
  // speed: accelerate toward what you're pressing, slower to turn in the air
  let top = WK.swim ? (wantSprint ? C.swimFast : C.swim) : wantSprint ? C.sprint : C.jog;
  let tx = mx * top, tz = mz * top;
  if (WK.roll > 0) { WK.roll -= dt; tx = WK.rollDir[0] * C.roll.speed; tz = WK.rollDir[1] * C.roll.speed; }
  const k = WK.roll > 0 ? 30 : !WK.ground && !WK.swim ? C.air : moving ? C.acc : C.dec;
  WK.vx += (tx - WK.vx) * Math.min(1, dt * k); WK.vz += (tz - WK.vz) * Math.min(1, dt * k);
  WK.sp = Math.hypot(WK.vx, WK.vz);
  if (moving && WK.roll <= 0) { const want = Math.atan2(mx, mz); let d = want - WK.face; d = Math.atan2(Math.sin(d), Math.cos(d)); WK.face += d * Math.min(1, dt * (WK.ground ? 12 : 5)); }
  // move, then slide out of anything solid
  const p = wkCollide(WK.x + WK.vx * dt, WK.z + WK.vz * dt, WK.y);
  WK.x = p.x; WK.z = p.z;
  if (p.hit?.door && moving && now > WK.cool) wkDoor(p.hit.door);
  // up and down: jumping, falling, landing, swimming
  const g = wkGround(WK.x, WK.z);
  WK.jumpBuf = Math.max(0, WK.jumpBuf - dt);
  let wet = wkWet(WK.x, WK.z);
  if (wet != null && WK.fly && !WK.ground && !WK.swim && WK.y > C.water - .05) wet = null; // a sprint jump clears the river hex
  if (wet != null) {
    const surf = wet - .3 * C.scale / .3; WK.surf = wet;
    if (!WK.swim) { WK.swim = true; if (WK.vy < -1 && typeof sfx === 'function') sfx('splash'); else if (typeof sfx === 'function') sfx('splash', { gap: 400 }); }
    WK.vy = 0; WK.y += (surf - WK.y) * Math.min(1, dt * 6); WK.ground = false; WK.air = 0;
  } else {
    if (WK.swim) { WK.swim = false; WK.y = Math.max(WK.y, g); WK.ground = true; }
    if (WK.ground) WK.fly = false;
    if (WK.ground) {
      if (g < WK.y - C.step) { WK.ground = false; WK.air = 0; WK.vy = 0; } // walked off a ledge
      else WK.y += (g - WK.y) * Math.min(1, dt * 18);
    }
    if (WK.ground || WK.air < C.coyote) { if (WK.jumpBuf > 0 && WK.roll <= 0) { WK.fly = !!(wantSprint && WK.sp > C.jog + .4); WK.vy = C.jump * (WK.fly ? C.sprintJump : 1); WK.ground = false; WK.air = C.coyote; WK.jumpBuf = 0; WK.jumped = now; if (typeof sfx === 'function') sfx('jump', { gap: 150 }); } }
    if (!WK.ground) {
      WK.air += dt; WK.vy -= C.grav * dt; WK.y += WK.vy * dt;
      if (WK.y <= g && WK.vy <= 0) { WK.y = g; const hard = WK.vy < -4.5; WK.vy = 0; WK.ground = true; WK.land = hard ? .28 : .12; if (typeof sfx === 'function') sfx('land', { gap: 150 }); }
    }
  }
  WK.land = Math.max(0, WK.land - dt);
  // the building you're next to gets a hint
  let near = null;
  for (const f of HX_FREE) { if (!f.at) continue; const [bx, bz] = hxPos(...hxQR(f.at)); if (Math.hypot(bx - WK.x, bz - WK.z) < 2.3) near = f; }
  if (near !== WK.near) { WK.near = near; wkHud(); }
  wkStamBar();
}
function wkJump() { if (WK.swim) return; WK.jumpBuf = WK_C.buffer; }
function wkRoll() {
  if (WK.roll > 0 || WK.swim || !WK.ground || WK.stam < WK_C.roll.cost * .5) return;
  WK.stam = Math.max(0, WK.stam - WK_C.roll.cost); WK.roll = WK_C.roll.time; WK.rest = WK_C.stam.wait;
  const sp = Math.hypot(WK.vx, WK.vz); WK.rollDir = sp > .3 ? [WK.vx / sp, WK.vz / sp] : [Math.sin(WK.face), Math.cos(WK.face)];
  WK.face = Math.atan2(WK.rollDir[0], WK.rollDir[1]);
  WK.H?.play('Dodge_Forward', { loop: false, fade: .08, speed: 1.25, restart: true });
  if (typeof sfx === 'function') sfx('roll', { gap: 200 });
}
// walking into a page building opens that building's window
function wkDoor(f) {
  WK.cool = performance.now() + 1500;
  if (document.pointerLockElement) document.exitPointerLock();
  WK.vx = WK.vz = 0; WK.keys = {};
  if (typeof sfx === 'function') sfx('door');
  hxOpen(f.id);
}
function wkResize() { const cam = IS3.cam; if (!cam) return; cam.clearViewOffset(); cam.updateProjectionMatrix(); }

// ---------- the camera (called from is3draw) ----------
function wkCam(cam) {
  if (!WK.on || !WK.H) return false;
  const C = WK_C, dt = Math.min(.05, (performance.now() - (WK.camT || 0)) / 1000); WK.camT = performance.now();
  // the point the camera looks at follows you with a little lag (less up and down, so jumps don't jolt it)
  const tgt = [WK.x, WK.y + C.camH * C.scale / .3, WK.z];
  if (!WK.ct) WK.ct = tgt.slice();
  const f = 1 - Math.exp(-dt * 12), fy = 1 - Math.exp(-dt * 6);
  WK.ct[0] += (tgt[0] - WK.ct[0]) * f; WK.ct[2] += (tgt[2] - WK.ct[2]) * f; WK.ct[1] += (tgt[1] - WK.ct[1]) * fy;
  const [tx, ty, tz] = WK.ct, cp = WK.cp, sx = Math.cos(WK.cy) * C.camSide, sz = -Math.sin(WK.cy) * C.camSide;
  const dir = [Math.sin(WK.cy) * Math.cos(cp), Math.sin(cp), Math.cos(WK.cy) * Math.cos(cp)];
  // pull in in front of anything between you and the camera, then ease back out
  let free = WK.cd;
  for (let d = .3; d <= WK.cd; d += .1) {
    const x = tx + sx + dir[0] * d, y = ty + dir[1] * d, z = tz + sz + dir[2] * d, c = wkCell(hxFromXZ(x, z));
    const top = c.solid ? (c.a.kind === 'off' ? -9 : c.h) : c.r ? c.h + (c.tall || 1) : -9;
    if (y < top + .1 || y < wkGround(x, z) + .12) { free = Math.max(.35, d - .15); break; }
  }
  WK.cdNow += (free - WK.cdNow) * (free < WK.cdNow ? Math.min(1, dt * 25) : Math.min(1, dt * 3));
  const d = WK.cdNow;
  cam.position.set(tx + sx + dir[0] * d, ty + dir[1] * d, tz + sz + dir[2] * d);
  cam.lookAt(tx + sx, ty, tz + sz);
  return true;
}
// the animation follows what you're doing; footsteps follow the animation
function wkAnim(t, dt) {
  const H = WK.H; if (!H) return;
  H.root.position.set(WK.x, WK.y, WK.z); H.root.rotation.set(WK.swim && WK.sp > .3 ? .3 : 0, WK.face, 0, 'YXZ');
  const sp = WK.sp || 0, C = WK_C;
  if (WK.roll > 0) { /* the roll plays out */ }
  else if (WK.swim) { if (sp > .3) H.play('Running_B', { speed: .55 + sp * .15 }); else H.play('Idle', { speed: .7 }); }
  else if (!WK.ground) { if (H.cur !== 'Jump_Start' && H.cur !== 'Jump_Idle') H.play(WK.vy > 0 ? 'Jump_Start' : 'Jump_Idle', { loop: WK.vy <= 0, fade: .1 }); else if (H.cur === 'Jump_Start' && H.done()) H.play('Jump_Idle', { fade: .15 }); }
  else if (WK.land > 0 && sp < 1) H.play('Jump_Land', { loop: false, fade: .08, speed: 1.4 });
  else if (sp < .25) H.play('Idle', { fade: .25 });
  else if (sp < 1.9) H.play('Walking_A', { speed: Math.max(.6, sp / 1.5) });
  else if (sp < (C.jog + C.sprint) / 2) H.play('Running_A', { speed: sp / C.jog });
  else H.play('Running_B', { speed: sp / C.sprint * 1.05 });
  H.update(dt, t);
  // footsteps on each foot fall
  if (WK.ground && !WK.swim && sp > .5 && /Walking|Running/.test(H.cur)) {
    const ph = H.phase() * 2 % 1; if (ph < WK.stepPh) wkStepSound(sp); WK.stepPh = ph;
  }
  if (WK.ripple) { if (WK.swim) { if (!WK.ripple.parent) IS3.scene.add(WK.ripple); WK.ripple.position.set(WK.x, (WK.surf ?? C.water) + .012, WK.z); const s = 1 + Math.sin(t * 3) * .12 + Math.min(1, sp) * .3; WK.ripple.scale.set(s, s, s); if (sp > .4 && Math.random() < dt * 3 && typeof sfx === 'function') sfx('swim', { gap: 450 }); } else if (WK.ripple.parent) IS3.scene.remove(WK.ripple); }
}
function wkStepSound(sp) {
  if (typeof sfx !== 'function') return;
  const c = wkCell(hxFromXZ(WK.x, WK.z));
  const tf = hxState().tf?.[c.k]; // 2.82: boardwalks and footbridges sound like wood, stone paths like stone
  sfx('step', { surf: c.bridge || tf?.ps === 'board' || tf?.d === 'bridge' ? 'wood' : c.road || tf?.ps === 'stone' ? 'stone' : 'grass', vol: sp > 3.5 ? 1 : .7 });
}

// ---------- the walk HUD ----------
function wkHud() {
  let h = document.getElementById('wkhud');
  if (!WK.on) { h?.remove(); return; }
  if (!h) { h = document.createElement('div'); h.id = 'wkhud'; document.body.appendChild(h); }
  const n = WK.near;
  h.innerHTML = `${n ? `<div class="wk-near">${n.e} <b>${esc(n.n)}</b><span>Walk in to open ${esc(n.d.toLowerCase())}</span></div>` : ''}
    <div class="wk-stam" hidden><i></i></div>
    <div class="wk-keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> sprint</span><span><kbd>Space</kbd> jump</span><span><kbd>Ctrl</kbd> roll</span><span>${document.pointerLockElement ? '<kbd>Esc</kbd> free the mouse' : 'Click to steer with the mouse'}</span><button type="button" class="btn small" data-wk="off"><kbd>V</kbd> Builder view</button></div>`;
  WK.bar = h.querySelector('.wk-stam');
}
function wkStamBar() {
  const b = WK.bar; if (!b) return;
  const full = WK.stam >= WK_C.stam.max - .5; b.hidden = full; if (full) return;
  b.firstChild.style.width = (WK.stam / WK_C.stam.max * 100).toFixed(1) + '%'; b.classList.toggle('tired', WK.tired);
}

// ---------- input ----------
const WK_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];
addEventListener('keydown', e => {
  if (e.metaKey || e.altKey || wkTyping(e.target) || (typeof SO !== 'undefined' && SO)) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k !== 'control') return;
  if (WK_ENABLED && k === 'v' && !e.repeat && (view === 'islands' || WK.on) && !document.querySelector('dialog[open]')) {
    e.preventDefault(); e.stopImmediatePropagation(); wkToggle(); return;
  }
  if (!WK.on || view !== 'islands') return;
  if (WK_KEYS.includes(k)) { WK.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  else if (k === ' ') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) wkJump(); }
  else if (k === 'control') { e.preventDefault(); if (!e.repeat) wkRoll(); }
  else if (k === 'escape' && !document.pointerLockElement && !ui.isPanel) { e.preventDefault(); e.stopImmediatePropagation(); wkToggle(false); }
}, true);
addEventListener('keyup', e => { WK.keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') WK.keys.shift = false; }, true);
addEventListener('blur', () => { WK.keys = {}; });
// the mouse turns the camera: locked after a click, or by dragging; Ctrl rolls
addEventListener('pointerdown', e => {
  if (!WK.on || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (e.button === 2) return; // 2.83: right click is free (Ctrl rolls)
  if (!document.pointerLockElement && IS3.canvas.requestPointerLock) { try { const p = IS3.canvas.requestPointerLock(); if (p?.catch) p.catch(() => { }); } catch (er) { } }
  WK.drag = [e.clientX, e.clientY];
}, true);
addEventListener('contextmenu', e => { if (WK.on && e.target.classList?.contains('g3canvas')) e.preventDefault(); }, true);
addEventListener('pointermove', e => {
  if (!WK.on || view !== 'islands') return;
  let dx = 0, dy = 0;
  if (document.pointerLockElement === IS3.canvas) { dx = e.movementX; dy = e.movementY; }
  else if (WK.drag && e.buttons) { dx = e.clientX - WK.drag[0]; dy = e.clientY - WK.drag[1]; WK.drag = [e.clientX, e.clientY]; }
  else return;
  e.stopImmediatePropagation();
  WK.cy -= dx * .0042; WK.cp = Math.max(-.2, Math.min(1.15, WK.cp + dy * .0035));
}, true);
addEventListener('pointerup', e => { if (WK.on && WK.drag) { WK.drag = null; if (view === 'islands') e.stopImmediatePropagation(); } }, true);
addEventListener('wheel', e => { if (!WK.on || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return; e.stopImmediatePropagation(); e.preventDefault(); WK.cd = Math.max(1.2, Math.min(6, WK.cd * (e.deltaY > 0 ? 1.1 : .9))); }, { capture: true, passive: false });
document.addEventListener('pointerlockchange', () => wkHud());
addEventListener('resize', () => { if (WK.on) setTimeout(wkResize, 50); });
document.addEventListener('click', e => { const el = e.target.closest('[data-wk]'); if (!el) return; e.preventDefault(); wkToggle(el.dataset.wk === 'on' ? true : el.dataset.wk === 'off' ? false : undefined); });
