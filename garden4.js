'use strict';
/* 2.22.4 garden juice.
   Collecting leaves: the leaves burst out of the basket (or the 3D bubbles),
   then fly one by one into your leaf counter, which ticks up with a rising
   pluck for each leaf and a chime at the end.
   Watering: one click per tree, everywhere. In the 3D garden a little drop
   floats over each tree that still needs water today; clicking the tree waters
   it with a rain cloud, a splash and a happy bounce. In the tree list and the
   flat garden, clicking a thirsty tree (or its "needs water" tag) waters it. */

// ---------- sounds ----------
SFX_GROUP.leaftick = 'garden'; SFX_GROUP.leafdone = 'garden'; SFX_GROUP.splash = 'garden';
let leafPitch = 0;
SFX.leaftick = c => { const f = 660 * Math.pow(2, Math.min(leafPitch, 24) / 12); tone(c, { f, f2: f * 1.5, dur: .06, vol: .045, type: 'triangle' }); hiss(c, { f: 5000, dur: .03, vol: .012, type: 'highpass' }); };
SFX.leafdone = c => { [784, 988, 1175, 1568].forEach((f, i) => tone(c, { f, dur: .35, vol: .05, type: 'triangle', at: i * .05 })); hiss(c, { f: 3000, f2: 7000, dur: .35, vol: .02, type: 'highpass', at: .1 }); };
SFX.splash = c => { hiss(c, { f: 900, f2: 300, dur: .45, vol: .08, type: 'lowpass', attack: .01 }); for (let i = 0; i < 8; i++) tone(c, { f: 700 + Math.random() * 1400, f2: 1600 + Math.random() * 1600, dur: .045, vol: .03, at: .05 + i * .05 }); tone(c, { f: 1319, dur: .18, vol: .03, type: 'triangle', at: .45 }); };

// ---------- collecting leaves ----------
let leafOrigins = null; // screen points the leaves start from (the 3D bubbles set these)
const leafTarget = () => [...document.querySelectorAll('.leafpill b, .leafnums b')].find(el => { const r = el.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; });
leafBurst = function (fromEl, n) {
  const before = Math.max(0, leaves() - n);
  const r = (fromEl || document.querySelector('.leafbar'))?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  // wait a frame, so the page has redrawn and the counter we fly to is the new one
  setTimeout(() => {
    const starts = leafOrigins?.length ? leafOrigins : [{ x: r.left + r.width / 2, y: r.top + r.height / 2 }]; leafOrigins = null;
    const count = Math.min(26, 7 + Math.floor(Math.sqrt(n))), layer = document.createElement('div'); layer.className = 'leafflight'; document.body.appendChild(layer);
    const shown = [...document.querySelectorAll('.leafpill b, .leafnums b')]; shown.forEach(el => { el.textContent = fmtLeaf(before); });
    let landed = 0; leafPitch = 0;
    const done = () => { shown.forEach(el => { el.textContent = fmtLeaf(leaves()); }); };
    for (let k = 0; k < count; k++) {
      const s = starts[k % starts.length], el = document.createElement('i'); el.textContent = LEAF; layer.appendChild(el);
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90, bx = s.x + Math.cos(a) * d, by = s.y + Math.sin(a) * d * .7 - 40;
      const tg = leafTarget()?.getBoundingClientRect(), tx = tg ? tg.left + tg.width / 2 : innerWidth - 60, ty = tg ? tg.top + tg.height / 2 : 30;
      const spin = (Math.random() < .5 ? -1 : 1) * (360 + Math.random() * 360), delay = k * 45;
      const anim = el.animate([
        { transform: `translate(${s.x}px,${s.y}px) scale(.3) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${bx}px,${by}px) scale(1.25) rotate(${spin * .4}deg)`, opacity: 1, offset: .35 },
        { transform: `translate(${(bx + tx) / 2}px,${Math.min(by, ty) - 60}px) scale(1) rotate(${spin * .75}deg)`, opacity: 1, offset: .7 },
        { transform: `translate(${tx}px,${ty}px) scale(.45) rotate(${spin}deg)`, opacity: .9 },
      ], { duration: 900 + Math.random() * 250, delay, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'both' });
      anim.onfinish = () => {
        el.remove(); landed++; leafPitch = landed;
        sfx('leaftick', { gap: 35 });
        const t = leafTarget(); if (t) { t.textContent = fmtLeaf(Math.round(before + n * landed / count)); const host = t.closest('.leafpill, .leafnums'); host?.classList.remove('leafbump'); void host?.offsetWidth; host?.classList.add('leafbump'); }
        if (landed === count) {
          done(); sfx('leafdone'); layer.remove();
          const tg = leafTarget()?.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'leafgain'; pop.textContent = `+${fmtLeaf(n)} ${LEAF}`;
          pop.style.left = (tg ? tg.left + tg.width / 2 : innerWidth / 2) + 'px'; pop.style.top = (tg ? tg.bottom + 6 : 60) + 'px'; document.body.appendChild(pop); setTimeout(() => pop.remove(), 1500);
        }
      };
    }
    setTimeout(() => { if (layer.isConnected) { layer.remove(); done(); } }, 4000); // never leave the counter wrong
  }, 30);
  // the basket empties with a little shake
  const bar = document.querySelector('.leafbar'); bar?.classList.add('emptying'); setTimeout(() => document.querySelector('.leafbar')?.classList.remove('emptying'), 600);
};
// the 3D bubbles: leaves start from where each bubble was on screen, and burst in 3D too
if (typeof g3popBubbles === 'function') {
  const _pop = g3popBubbles;
  g3popBubbles = function () {
    try {
      const r = G3.canvas.getBoundingClientRect(), pts = [];
      for (const b of G3.bubbles) { const v = b.getWorldPosition(new THREE.Vector3()); g3leafPuff(v); v.project(G3.camera); pts.push({ x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }); }
      if (pts.length) leafOrigins = pts;
    } catch (e) { console.error(e); }
    return _pop();
  };
}

// ---------- watering ----------
const needsWater = l => l && treeRec(l.id).lastWater !== today() && !l.withered;
const waterLeft = () => 10 - wateredToday();
function waterPop(x, y, text) {
  const p = document.createElement('div'); p.className = 'waterpop'; p.style.left = x + 'px'; p.style.top = y + 'px';
  p.innerHTML = `<span class="wcan">🚿</span>${Array.from({ length: 9 }, (_, k) => `<i style="--dx:${(k - 4) * 7}px;--d:${(k * .05).toFixed(2)}s"></i>`).join('')}<b>${text}</b><u></u>`;
  document.body.appendChild(p); setTimeout(() => p.remove(), 1700);
}
// waters one tree and celebrates at (x, y). Returns true if it watered.
function waterOne(id, x, y) {
  const l = D.focusLogs.find(z => z.id === id); if (!needsWater(l)) return false;
  if (waterLeft() <= 0) { toast('💧 That\'s 10 trees today', 'You can water 10 trees a day. The rest can wait for tomorrow.'); return true; }
  const c = waterCoins(l), res = waterTree(id); if (res !== 'ok') return false;
  sfx('splash'); setTimeout(() => sfx('coin'), 420);
  waterPop(x, y, `💧 +${c} ${COIN}`);
  lastCoins = coins(); save();
  return true;
}
// in the tree list and the flat garden: a thirsty tree waters on click, a watered one opens its card
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-act="treeInfo"]'); if (!t) return;
  const inList = t.classList.contains('tcard'), l = D?.focusLogs?.find(z => z.id === t.dataset.id);
  if (!needsWater(l)) return;
  if (inList && !e.target.closest('.tcwater')) return; // in the list, the "needs water" tag waters; the rest of the card opens it
  e.stopPropagation(); e.preventDefault();
  if (waterOne(l.id, e.clientX, e.clientY)) {
    const tag = t.querySelector('.tcwater'); if (tag) { tag.classList.add('wet', 'justwet'); tag.textContent = '💧 watered'; }
    t.classList.add('watered'); setTimeout(() => render(), 900);
  }
}, true);

// ---------- the 3D garden: drops over thirsty trees, rain when you click ----------
function dropTex() {
  if (G3.dropTex) return G3.dropTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#339af0'; x.lineWidth = 7; x.stroke();
  const g = x.createLinearGradient(0, 26, 0, 100); g.addColorStop(0, '#74c0fc'); g.addColorStop(1, '#1971c2'); x.fillStyle = g;
  x.beginPath(); x.moveTo(64, 26); x.bezierCurveTo(86, 56, 92, 70, 88, 80); x.arc(64, 78, 24, .1, Math.PI - .1); x.bezierCurveTo(36, 70, 42, 56, 64, 26); x.fill();
  x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(54, 74, 5, 9, -.4, 0, Math.PI * 2); x.fill();
  return (G3.dropTex = srgb(new THREE.CanvasTexture(c)));
}
function glowTex() {
  if (G3.glowTex) return G3.glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (G3.glowTex = new THREE.CanvasTexture(c));
}
function leafTex() {
  if (G3.leafTex) return G3.leafTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.font = '50px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🍃', 32, 35);
  return (G3.leafTex = srgb(new THREE.CanvasTexture(c)));
}
// a short-lived sprite that moves, fades and is cleaned up by itself
function g3spark(o) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.map || glowTex(), color: o.color || '#ffffff', transparent: true, depthWrite: false, blending: o.add === false ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: o.op ?? 1 }));
  s.position.copy(o.pos); s.scale.set(o.sx || o.size || .2, o.sy || o.size || .2, 1); G3.world.add(s);
  const v = o.vel ? o.vel.clone() : new THREE.Vector3(), life = o.life || .8, t0 = G3.clock.elapsedTime, g = o.grav || 0;
  const f = (t, dt = .016) => {
    const p = (t - t0) / life; if (p >= 1) { G3.world.remove(s); s.material.dispose(); G3.tickers.splice(G3.tickers.indexOf(f), 1); return; }
    v.y -= g * dt; s.position.addScaledVector(v, dt); s.material.opacity = (o.op ?? 1) * (p < .15 ? p / .15 : 1 - Math.max(0, p - .5) / .5);
    if (o.spin) s.material.rotation += o.spin * dt; if (o.grow) s.scale.multiplyScalar(1 + o.grow * dt);
  };
  G3.tickers.push(f); return s;
}
function g3leafPuff(pos) {
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g3spark({ map: leafTex(), add: false, pos, size: .32, vel: new THREE.Vector3(Math.cos(a) * 1.6, 1.4 + Math.random() * 1.4, Math.sin(a) * 1.6), grav: 3, life: .9, spin: (Math.random() - .5) * 8 }); }
  g3spark({ pos, size: 1.4, color: '#b2f2bb', life: .35, grow: 3 });
}
// drops over every tree that needs water today
function g3drops() {
  if (!G3.objs) return;
  const can = waterLeft() > 0; G3.dropDay = today(); G3.drops = G3.drops || [];
  for (const d of G3.drops.splice(0)) { d.parent?.remove(d); d.material.dispose(); }
  if (!can) return;
  for (const o of G3.objs) {
    const l = o.userData.tree; if (!needsWater(l)) continue;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex(), depthTest: true, transparent: true })); s.scale.setScalar(.8);
    const sc = o.scale.y || 1; s.position.set(0, (o.userData.h || 2) / sc + .75, 0); s.userData.drop = true; o.add(s); G3.drops.push(s);
  }
}
if (typeof g3build === 'function') {
  const _build = g3build;
  g3build = function () { _build(); try { g3drops(); } catch (e) { console.error(e); } };
  // drops bob gently, and come back when a new day starts
  let lastCheck = 0;
  const _loop = g3loop;
  g3loop = function () {
    _loop();
    if (!G3.drops || !G3.clock) return;
    const t = G3.clock.elapsedTime;
    for (let i = 0; i < G3.drops.length; i++) { const d = G3.drops[i]; d.position.y += Math.sin(t * 2.4 + i) * .0025; const k = .8 * (1 + Math.sin(t * 3 + i) * .06); d.scale.set(k, k, 1); }
    if (t - lastCheck > 5) { lastCheck = t; if (G3.dropDay && G3.dropDay !== today()) g3drops(); }
  };
}
// clicking a thirsty tree in 3D: a rain cloud, falling drops, a splash ring and a bounce
function g3water(obj, ev) {
  const l = obj.userData.tree; if (!needsWater(l)) return false;
  if (!waterOne(l.id, ev.clientX, ev.clientY)) return false;
  const top = obj.userData.h || 2, base = obj.position.clone();
  const drop = obj.children.find(c => c.userData.drop);
  if (drop) { const t0 = G3.clock.elapsedTime, s0 = drop.scale.x; drop.userData.drop = false; G3.drops.splice(G3.drops.indexOf(drop), 1);
    const f = t => { const p = Math.min(1, (t - t0) / .3); drop.scale.setScalar(s0 * (1 + p)); drop.material.opacity = 1 - p; if (p >= 1) { obj.remove(drop); drop.material.dispose(); G3.tickers.splice(G3.tickers.indexOf(f), 1); } }; G3.tickers.push(f); }
  const cloudY = top + 1.4;
  for (let k = 0; k < 6; k++) g3spark({ add: false, color: '#f1f3f5', op: .95, pos: base.clone().add(new THREE.Vector3((k - 2.5) * .38, cloudY + Math.sin(k) * .15, (k % 2 - .5) * .35)), size: 1.3, life: 1.4 });
  for (let k = 0; k < 34; k++) setTimeout(() => G3.world && g3spark({ color: '#4dabf7', add: false, op: .9, pos: base.clone().add(new THREE.Vector3((Math.random() - .5) * 1.6, cloudY - .2, (Math.random() - .5) * 1.6)), sx: .09, sy: .4, vel: new THREE.Vector3(0, -6, 0), life: (cloudY - .2) / 6 }), k * 22);
  setTimeout(() => {
    if (!G3.world) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#74c0fc', transparent: true, opacity: .9, depthWrite: false }));
    ring.position.set(base.x, .06, base.z); G3.world.add(ring); const t0 = G3.clock.elapsedTime;
    const f = t => { const p = Math.min(1, (t - t0) / .7); ring.scale.setScalar(1.5 + p * 5); ring.material.opacity = .9 * (1 - p); if (p >= 1) { G3.world.remove(ring); ring.geometry.dispose(); ring.material.dispose(); G3.tickers.splice(G3.tickers.indexOf(f), 1); } };
    G3.tickers.push(f);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; g3spark({ color: '#a5d8ff', pos: base.clone().setY(.15), size: .22, vel: new THREE.Vector3(Math.cos(a) * 2, 2.2 + Math.random(), Math.sin(a) * 1.5), grav: 7, life: .6 }); }
    for (let k = 0; k < 12; k++) setTimeout(() => G3.world && g3spark({ color: '#8ce99a', pos: base.clone().add(new THREE.Vector3((Math.random() - .5) * 1, top * Math.random(), (Math.random() - .5) * 1)), size: .35, vel: new THREE.Vector3(0, 1.6, 0), life: 1 }), k * 40);
    // the happy bounce
    const s0 = obj.scale.clone(), t1 = G3.clock.elapsedTime;
    const b = t => { const p = Math.min(1, (t - t1) / .7), w = Math.sin(p * Math.PI * 3) * (1 - p) * .2; obj.scale.set(s0.x * (1 - w * .5), s0.y * (1 + w), s0.z * (1 - w * .5)); if (p >= 1) { obj.scale.copy(s0); G3.tickers.splice(G3.tickers.indexOf(b), 1); } };
    G3.tickers.push(b);
  }, 800);
  if (waterLeft() <= 0) setTimeout(() => g3drops(), 900);
  setTimeout(() => render(), 1300); // coins and the tree list catch up once the rain is done
  return true;
}
