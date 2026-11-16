'use strict';
/* Walk mode (2.75). Hidden since 2.77 until the movement core (feedback stage F3)
   ships: set WK_ENABLED to true to bring it back. The building interiors were
   removed in 2.77: walking into a page building opens that building's window.
   The camera helpers here are shared with the Souls fights (souls.js). */
const WK_ENABLED = false;

const WK_S = .3, WK_SPEED = 2.4, WK_RUN = 4.4; // avatar size on the island, walk and run speed (hex widths are 2)
const WK = { on: false, fig: null, sig: '', x: 0, z: 2.6, y: 0, face: Math.PI, cy: 0, cp: .32, cd: 2.6, keys: {}, raf: 0, t: 0, ph: 0, sp: 0, inside: null, cool: 0, near: null, room: null, fade: 0 };
const wkOk = () => (ui.isTab || 'personal') === 'personal' && !ui.hxVisit && !ui.hxP;
const wkTyping = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// ---------- on and off ----------
function wkToggle(on = !WK.on) {
  if (on && !WK_ENABLED) return;
  if (on && (!window.THREE || !IS3.R || !HX3.kit || !wkOk() || (typeof shell2D === 'function' && shell2D()))) { if (on) toast('🚶 Walk mode', 'Walk mode works on your own island in the 3D view.'); return; }
  if (WK.on === on) return;
  WK.on = on; document.body.classList.toggle('walking', on);
  if (on) {
    Object.assign(ui, { hxSel: null, isPanel: null });
    wkSpawn(); WK.cool = performance.now() + 600;
    WK.y = wkGround(WK.x, WK.z); WK.cam = { fov: IS3.cam.fov, near: IS3.cam.near };
    IS3.cam.fov = 55; IS3.cam.near = .05; IS3.cam.updateProjectionMatrix();
    wkFig(); if (typeof sfx === 'function') sfx('whoosh');
    render(); wkHud(); wkLoop();
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    if (WK.fig) { IS3.scene.remove(WK.fig); }
    if (WK.cam) { IS3.cam.fov = WK.cam.fov; IS3.cam.near = WK.cam.near; IS3.cam.updateProjectionMatrix(); }
    document.getElementById('wkhud')?.remove(); render(); is3draw();
  }
}
// your character, rebuilt when what you wear changes
function wkFig() {
  const d = typeof youAvData === 'function' ? youAvData(pfSpec()) : { spec: avatarSpec(), gear: {}, cls: '' }, sig = JSON.stringify(d);
  if (WK.fig && WK.sig === sig) { if (!WK.fig.parent) IS3.scene.add(WK.fig); return; }
  if (WK.fig) { IS3.scene.remove(WK.fig); av3dispose(WK.fig); }
  WK.sig = sig; const g = WK.fig = new THREE.Group(), f = av3figure({ ...d.spec, force: '' }, d.gear || {}, d.cls || '');
  f.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(f); g.userData.f = f; IS3.scene.add(g);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
}

// ---------- the island: where you can stand ----------
function wkHex(x, z) { const k = hxFromXZ(x, z); return { k, a: hxAt(k, hxState()) }; }
const WK_WALK = { grass: 1, road: 1, deco: 1, hill: 1 };
function wkStand(x, z) {
  const { k, a } = wkHex(x, z);
  if (WK_WALK[a.kind] || (a.kind === 'b' && a.it?.field)) return { ok: true, k };
  return { ok: false, k, a };
}
// you start on the road just outside the hall, or the nearest open ground to it
function wkSpawn() {
  const [hx, hz] = hxPos(0, 0);
  for (let r = 1.6; r < 14; r += .4) for (let i = 0; i < 24; i++) {
    const a = Math.PI / 2 - i / 24 * Math.PI * 2 * (i % 2 ? -1 : 1) / 2, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
    if ([[0, 0], [.2, 0], [-.2, 0], [0, .2], [0, -.2]].every(([p, q]) => wkStand(x + p, z + q).ok)) { WK.x = x; WK.z = z; WK.face = Math.atan2(x - hx, z - hz); WK.cy = WK.face + Math.PI; return; }
  }
  WK.x = 0; WK.z = 2.6;
}
function wkGround(x, z) { const { k, a } = wkHex(x, z); return (typeof hxHt === 'function' ? hxHt(k, hxState()) : 0) + (a.kind === 'hill' ? .25 : 0); }

// ---------- the loop ----------
function wkLoop() {
  if (WK.raf) return;
  WK.t = performance.now();
  const tick = now => {
    WK.raf = 0; if (!WK.on) return;
    const dt = Math.min(.1, (now - WK.t) / 1000); WK.t = now;
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
  if (view !== 'islands') { WK.sp = 0; return; }
  const K = WK.keys, fw = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), st = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0);
  let mx = 0, mz = 0;
  if (fw || st) { const c = Math.cos(WK.cy), s = Math.sin(WK.cy); mx = -s * fw + c * st; mz = -c * fw - s * st; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
  const spd = (K.shift ? WK_RUN : WK_SPEED) * (fw || st ? 1 : 0);
  WK.sp += (spd - WK.sp) * Math.min(1, dt * 10);
  if (fw || st) {
    const want = Math.atan2(mx, mz); let d = want - WK.face; d = Math.atan2(Math.sin(d), Math.cos(d)); WK.face += d * Math.min(1, dt * 12);
    const nx = WK.x + mx * WK.sp * dt, nz = WK.z + mz * WK.sp * dt, r = .16;
    const fits = (x, z) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => wkStand(x + a, z + b).ok);
    if (fits(nx, nz)) { WK.x = nx; WK.z = nz; }
    else if (fits(nx, WK.z)) WK.x = nx;
    else if (fits(WK.x, nz)) WK.z = nz;
    const ahead = wkStand(WK.x + mx * .3, WK.z + mz * .3);
    if (!ahead.ok && ahead.a?.kind === 'free' && now > WK.cool) wkDoor(ahead.a.it);
  }
  WK.y += (wkGround(WK.x, WK.z) - WK.y) * Math.min(1, dt * 12);
  // the building you're next to gets a hint
  let near = null;
  for (const f of HX_FREE) { if (!f.at) continue; const [bx, bz] = hxPos(...hxQR(f.at)); if (Math.hypot(bx - WK.x, bz - WK.z) < 2.3) near = f; }
  if (near !== WK.near) { WK.near = near; wkHud(); }
}
// walking into a page building opens that building's window (2.77: no interiors for now)
function wkDoor(f) {
  WK.cool = performance.now() + 1500;
  if (document.pointerLockElement) document.exitPointerLock();
  WK.x -= Math.sin(WK.face) * .4; WK.z -= Math.cos(WK.face) * .4;
  if (typeof sfx === 'function') sfx('open');
  hxOpen(f.id);
}
function wkResize() {
  const cam = IS3.cam; if (!cam) return;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
}

// ---------- the camera (called from is3draw) ----------
function wkCam(cam) {
  if (!WK.on || !WK.fig) return false;
  const tx = WK.x, ty = WK.y + .55, tz = WK.z, d = WK.cd, cp = WK.cp;
  let px = tx + Math.sin(WK.cy) * Math.cos(cp) * d, py = ty + Math.sin(cp) * d, pz = tz + Math.cos(WK.cy) * Math.cos(cp) * d;
  const side = .32; px += Math.cos(WK.cy) * side; pz -= Math.sin(WK.cy) * side; // over the right shoulder
  // pull the camera in front of anything between it and you (buildings, trees, rocks)
  for (let f = .15; f <= 1; f += .05) { const x = tx + (px - tx) * f, z = tz + (pz - tz) * f, a = wkHex(x, z).a; if (!WK_WALK[a.kind] && a.kind !== 'off' && a.kind !== 'water' && a.kind !== 'river' && a.kind !== 'pond' && !(a.kind === 'b' && a.it?.field)) { const k = Math.max(.12, f - .12); px = tx + (px - tx) * k; py = ty + (py - ty) * k; pz = tz + (pz - tz) * k; break; } }
  py = Math.max(py, wkGround(px, pz) + .25);
  cam.position.set(px, py, pz); cam.lookAt(tx + Math.cos(WK.cy) * side, ty, tz - Math.sin(WK.cy) * side);
  return true;
}
// walking: legs and arms swing with your speed; standing: a gentle breath
function wkAnim(t, dt) {
  const g = WK.fig; if (!g) return;
  if (!WK.inside) { g.position.set(WK.x, WK.y, WK.z); g.rotation.y = WK.face; g.scale.setScalar(WK_S); }
  const P = g.userData.f?.userData?.P; if (!P) return;
  const v = WK.inside ? 0 : WK.sp; WK.ph += dt * (4 + v * 2.6);
  const sw = Math.min(1, v / WK_SPEED) * (v > WK_SPEED + .5 ? .95 : .7), s = Math.sin(WK.ph);
  P.legs[0].rotation.x = s * sw; P.legs[1].rotation.x = -s * sw;
  P.arms[0].rotation.x = -s * sw * .9; P.arms[1].rotation.x = s * sw * .9;
  g.userData.f.position.y = Math.abs(Math.cos(WK.ph)) * .06 * sw;
  const b = Math.sin(t * 2); P.chest.scale.y = 1 + b * .012 * (1 - sw); P.head.position.y = AV3_STYLE.headY + b * .012;
  const bl = (t % 4.2) < .12 ? .12 : 1; for (const e of P.eyes || []) e.scale.y = bl;
  if (P.charm) { P.charm.position.y = 1.45 + Math.sin(t * 1.6) * .06; P.charm.rotation.y = t; }
  if (P.pet) P.pet.position.y = .28 + Math.abs(Math.sin(t * 3)) * .1;
}

// ---------- the walk HUD ----------
function wkHud() {
  let h = document.getElementById('wkhud');
  if (!WK.on || WK.inside) { h?.remove(); return; }
  if (!h) { h = document.createElement('div'); h.id = 'wkhud'; document.body.appendChild(h); }
  const n = WK.near;
  h.innerHTML = `${n ? `<div class="wk-near">${n.e} <b>${esc(n.n)}</b><span>Walk in to open ${esc(n.d.toLowerCase())}</span></div>` : ''}
    <div class="wk-keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> run</span><span>${document.pointerLockElement ? '<kbd>Esc</kbd> free the mouse' : 'Click to steer with the mouse'}</span><button type="button" class="btn small" data-wk="off"><kbd>V</kbd> Builder view</button></div>`;
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || wkTyping(e.target) || (typeof SO !== 'undefined' && SO)) return;
  const k = e.key.toLowerCase();
  if (WK_ENABLED && k === 'v' && !e.repeat && (view === 'islands' || WK.on) && !document.querySelector('dialog[open]')) {
    e.preventDefault(); e.stopImmediatePropagation(); wkToggle(); return;
  }
  if (!WK.on || WK.inside || view !== 'islands') return;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { WK.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  else if (k === 'escape' && !document.pointerLockElement && !ui.isPanel) { e.preventDefault(); e.stopImmediatePropagation(); wkToggle(false); }
}, true);
addEventListener('keyup', e => { WK.keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') WK.keys.shift = false; }, true);
addEventListener('blur', () => { WK.keys = {}; });
// the mouse turns the camera: locked after a click, or by dragging
addEventListener('pointerdown', e => {
  if (!WK.on || WK.inside || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!document.pointerLockElement && IS3.canvas.requestPointerLock) { try { const p = IS3.canvas.requestPointerLock(); if (p?.catch) p.catch(() => { }); } catch (er) { } }
  WK.drag = [e.clientX, e.clientY];
}, true);
addEventListener('pointermove', e => {
  if (!WK.on || WK.inside || view !== 'islands') return;
  let dx = 0, dy = 0;
  if (document.pointerLockElement === IS3.canvas) { dx = e.movementX; dy = e.movementY; }
  else if (WK.drag && e.buttons) { dx = e.clientX - WK.drag[0]; dy = e.clientY - WK.drag[1]; WK.drag = [e.clientX, e.clientY]; }
  else return;
  e.stopImmediatePropagation();
  WK.cy -= dx * .0042; WK.cp = Math.max(-.15, Math.min(1.1, WK.cp + dy * .0035));
}, true);
addEventListener('pointerup', e => { if (WK.on && WK.drag) { WK.drag = null; if (!WK.inside && view === 'islands') e.stopImmediatePropagation(); } }, true);
addEventListener('wheel', e => { if (!WK.on || WK.inside || view !== 'islands' || !e.target.classList?.contains('g3canvas')) return; e.stopImmediatePropagation(); e.preventDefault(); WK.cd = Math.max(1.4, Math.min(6, WK.cd * (e.deltaY > 0 ? 1.1 : .9))); }, { capture: true, passive: false });
document.addEventListener('pointerlockchange', () => wkHud());
addEventListener('resize', () => { if (WK.on) setTimeout(wkResize, 50); });
document.addEventListener('click', e => { const el = e.target.closest('[data-wk]'); if (!el) return; e.preventDefault(); wkToggle(el.dataset.wk === 'on' ? true : el.dataset.wk === 'off' ? false : undefined); });
