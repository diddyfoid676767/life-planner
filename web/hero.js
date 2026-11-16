'use strict';
/* Heroes (2.80, feedback stage F3): your character on the island, made from the KayKit
   Adventurers pack (CC0, Kay Lousberg; packed by tools/hero-pack.mjs into hero/hero.glb).

   One rig with real animations (idle, walk, run, jump, dodge, attacks, hits) and four
   outfits (Knight, Barbarian, Mage, Rogue). Your class picks the outfit, recoloured with
   your kit colour, skin tone and shoes. Your own toon head from the You page sits on the
   rig's head bone, so your face, hair and hair colour, headwear, eyewear, extras, charm,
   pet and head gear all carry over: nothing you bought disappears.

   heroMake({ spec, gear, cls, outfit, scale }) gives { root, play(name), update(dt), ... }.
   Villagers use the same pack with a random look (heroVillager). */

const HERO = { gltf: null, loading: null, fail: false, base: null };
// which outfit each class wears; no class yet: the rogue's plain adventurer clothes
const HERO_OUTFIT = { guardian: 'Knight', tactician: 'Knight', striker: 'Barbarian', monk: 'Barbarian', sage: 'Mage', bard: 'Mage', ranger: 'Rogue', rogue: 'Rogue' };
const HERO_OUTFITS = ['Knight', 'Barbarian', 'Mage', 'Rogue'];
// body-shaped gear is shown by recolouring the outfit instead of a shell over it
const HERO_GEAR_TINT = { Hoodie: 'kit', Chestplate: 'kit', Robe: 'kit', Spikes: 'shoe', Boots: 'shoe', Slippers: 'shoe' };
const HERO_GEAR_SKIP = ['Track Pants', 'Greaves', 'Training Shorts', 'Gloves', 'Tape'];

function heroLoad() {
  if (HERO.gltf || HERO.fail) return Promise.resolve(HERO.gltf);
  if (HERO.loading) return HERO.loading;
  if (!window.THREE?.GLTFLoader) return Promise.resolve(null);
  HERO.loading = new Promise(ok => new THREE.GLTFLoader().load('hero/hero.glb', g => { HERO.gltf = g; ok(g); }, undefined, e => { console.error('hero', e); HERO.fail = true; ok(null); }));
  return HERO.loading;
}
// true once the pack is loaded (starts loading it the first time it's asked)
function heroReady() { if (!HERO.gltf) heroLoad(); return !!HERO.gltf; }
function heroOutfitOf(clsId) { return HERO_OUTFIT[clsId] || 'Rogue'; }

// ---------- materials ----------
const HERO_MATS = {};
function heroMat(outline) {
  const k = outline ? 'ol' : 'body'; if (HERO_MATS[k]) return HERO_MATS[k];
  if (outline) {
    const m = new THREE.MeshBasicMaterial({ color: AV3_STYLE.olCol, side: THREE.BackSide });
    m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * .022;'); };
    return (HERO_MATS[k] = m);
  }
  return (HERO_MATS[k] = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: av3grad() }));
}
// recolours a part: every vertex in a slot takes the new colour, keeping its own light and shade
function heroTint(geo, cols) {
  const slot = geo.attributes._slot, col = geo.attributes.color; if (!slot || !col) return;
  const lum = i => .2126 * col.getX(i) + .7152 * col.getY(i) + .0722 * col.getZ(i);
  const ref = {}, n = {};
  for (let i = 0; i < slot.count; i++) { const s = slot.getX(i); if (s && cols[s]) { ref[s] = (ref[s] || 0) + lum(i); n[s] = (n[s] || 0) + 1; } }
  for (const s in ref) ref[s] /= n[s];
  const out = col.clone(), c = new THREE.Color();
  for (let i = 0; i < slot.count; i++) {
    const s = slot.getX(i); if (!s || !cols[s]) continue;
    c.set(cols[s]).convertSRGBToLinear(); const k = Math.min(1.6, Math.max(.45, lum(i) / (ref[s] || 1)));
    out.setXYZ(i, Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k));
  }
  geo.setAttribute('color', out);
}

// ---------- building one ----------
function heroMake(o = {}) {
  const G = HERO.gltf; if (!G) return null;
  const outfit = HERO_OUTFITS.includes(o.outfit) ? o.outfit : 'Rogue', spec = o.spec || avatarSpec(), K = av3colors(spec);
  // gear: body-shaped pieces recolour the outfit, the rest (helms, caps, charms) use the toon builders
  const gear = {}, tint = {};
  for (const [b, c] of Object.entries(o.gear || {})) { if (HERO_GEAR_TINT[b]) tint[HERO_GEAR_TINT[b]] = c; else if (!HERO_GEAR_SKIP.includes(b)) gear[b] = c; }
  const kit = tint.kit || (o.cls ? av3mix(K.kit, o.cls, AV3_STYLE.tint) : K.kit), shoe = tint.shoe || K.shoe;
  const cols = { 1: K.skin, 2: kit, 3: shoe, 4: av3drk(o.cls || kit, .2) };

  const root = new THREE.Group(), rig = THREE.SkeletonUtils.clone(G.scene);
  const meshes = []; rig.traverse(m => { if (m.isMesh) meshes.push(m); });
  for (const m of meshes) {
    const nm = m.name.replace(/_\d+$/, ''), mine = nm.startsWith(outfit + '_') || nm.startsWith(outfit + ':');
    // the outfit's own body and cape; its props only when they're wanted
    const prop = !m.isSkinnedMesh && !nm.endsWith('_Cape'), pname = nm.replace(outfit + ':', '').replace(outfit + '_', '');
    m.visible = mine && (!prop || (o.props || []).includes(pname));
    if (!m.visible) { m.parent?.remove(m); continue; }
    m.geometry = m.geometry.clone(); heroTint(m.geometry, cols);
    m.material = heroMat(false); m.castShadow = true; m.frustumCulled = false;
    if (m.isSkinnedMesh && o.outline !== false) { const l = new THREE.SkinnedMesh(m.geometry, heroMat(true)); l.bind(m.skeleton, m.bindMatrix); l.frustumCulled = false; l.raycast = () => { }; m.parent.add(l); }
  }
  root.add(rig);
  const bone = n => rig.getObjectByName(n);

  // your toon head and cosmetics, moved onto the rig's bones
  const fig = av3figure({ ...spec, force: '' }, gear, o.cls || ''), P = fig.userData.P;
  for (const m of P.base) m.parent?.remove(m);
  fig.scale.set(1, 1, 1); fig.updateMatrixWorld(true); rig.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const attach = (g, bn, pos, sc, rz = 0) => {
    const b = bone(bn); if (!g || !b) return;
    const px = new THREE.Object3D(), want = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(...(Array.isArray(sc) ? sc : [sc, sc, sc])));
    const bw = new THREE.Matrix4().multiplyMatrices(rootInv, b.matrixWorld);
    px.applyMatrix4(bw.invert().multiply(want)); b.add(px);
    g.parent?.remove(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); px.add(g);
  };
  const HS = 1.36; // your head is drawn a little bigger, like the pack's own heads
  attach(P.head, 'head', [0, 1.74, .03], HS);
  attach(P.chest, 'chest', [0, .4, 0], [1.2, 1.34, 1.26]);
  P.arms.forEach((A, i) => attach(A, i ? 'upperarml' : 'upperarmr', [i ? .42 : -.42, 1.18, 0], 1.25, i ? Math.PI / 2 : -Math.PI / 2));
  P.hands.forEach((H, i) => attach(H, i ? 'handslotl' : 'handslotr', [i ? .95 : -.95, 1.12, .05], 1.25, i ? Math.PI / 2 : -Math.PI / 2));
  P.feet.forEach((F, i) => attach(F, i ? 'footl' : 'footr', [i ? .17 : -.17, .1, .03], 1.15));
  P.legs.forEach((L, i) => attach(L, i ? 'upperlegl' : 'upperlegr', [i ? .17 : -.17, .5, 0], 1.15));
  // what's left (charm, pet, sparkles) floats with you
  fig.scale.setScalar(1.15); root.add(fig);
  root.scale.set(K.build, K.tall, K.build).multiplyScalar(o.scale || 1);
  root.traverse(m => { if (m.isMesh && m.material !== HERO_MATS.ol) m.castShadow = true; });

  // animations
  const mixer = new THREE.AnimationMixer(rig), acts = {};
  const clip = n => G.animations.find(a => a.name === n);
  const H = { root, rig, fig, P, mixer, outfit, cur: '', act: null, bone,
    play(name, { fade = .18, loop = true, speed = 1, restart = false } = {}) {
      const c = clip(name); if (!c) return null;
      let a = acts[name]; if (!a) a = acts[name] = mixer.clipAction(c);
      a.timeScale = speed;
      if (name === H.cur && !restart) return a;
      a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true; a.setEffectiveWeight(1);
      if (H.act && H.act !== a) a.crossFadeFrom(H.act, fade, false); a.play();
      H.cur = name; H.act = a; return a;
    },
    speed(s) { if (H.act) H.act.timeScale = s; },
    // how far through the current animation (0 to 1), for footsteps and the end of one-shots
    phase() { const a = H.act; return a ? (a.time / a.getClip().duration) % 1 : 0; },
    done() { const a = H.act; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - .02); },
    update(dt, t = performance.now() / 1000) {
      mixer.update(dt);
      if (P.charm) { P.charm.position.y = 1.45 + Math.sin(t * 1.6) * .06; P.charm.rotation.y = t; }
      if (P.pet) P.pet.position.y = .28 + Math.abs(Math.sin(t * 3)) * .1;
      const bl = (t % 4.2) < .12 ? .12 : 1; for (const e of P.eyes || []) e.scale.y = bl;
    },
    dispose() { root.parent?.remove(root); mixer.stopAllAction(); root.traverse(m => { if (m.isMesh && m.geometry && m.geometry !== undefined) m.geometry.dispose?.(); }); },
  };
  H.play(o.idle || 'Idle');
  return H;
}

// ---------- villagers: the same pack, a random look each ----------
const HERO_VIL_HAIR = ['h_short', 'h_long', 'h_curly', 'h_side', 'h_fringe', 'h_wavy', 'h_bun', 'h_pony', 'h_buzz', 'h_crop', 'h_bob', 'h_afro'];
const HERO_VIL_HAT = ['hat_none', 'hat_none', 'hat_none', 'hat_beanie', 'hat_cap', 'hat_bucket'];
function heroVillager(r, o = {}) {
  const pick = a => a[Math.floor(r() * a.length)];
  const spec = { hair: pick(HERO_VIL_HAIR), hat: pick(HERO_VIL_HAT), kitC: pick(['#3b5bdb', '#c92a2a', '#2b8a3e', '#e67700', '#862e9c', '#0b7285', '#5c940d', '#a61e4d', '#868e96']), shoes: 'sh_black',
    look: { ...LOOK_DEFAULT, skinC: pick(['#f6d7b8', '#f1c9a5', '#e8b48a', '#d9a066', '#a86b3c', '#6b4226']), hairC: pick(['#1f1a17', '#3b2416', '#5c3a21', '#a0703f', '#c8a060', '#b5541c', '#9aa0a6']),
      mouth: pick(['smile', 'smile', 'open', 'neutral']), beard: r() < .2 ? 'stubble' : 'none', build: pick(['slim', 'regular', 'regular', 'broad']) } };
  return heroMake({ spec, gear: {}, outfit: pick(HERO_OUTFITS), cls: '', idle: 'Idle', ...o });
}
