'use strict';
/* Heroes (2.84, round 2 stage R2): your character everywhere (island walk, fights, the You
   page) and the villagers, made from the Quaternius "Universal" character family (CC0):
   the Universal Base Characters' heads, the Fantasy outfits (Peasant and Ranger, male and
   female), the matching hair pieces and weapons, and the Universal Animation Library 1+2.
   Packed by tools/qhero-pack.mjs into hero/qhero.glb and hero/q/*.jpg.

   One rig drives everything, so head, body, hair and hood all belong to the same model (no
   more pasted-on toon head). Your look is rebuilt from matching parts:
   - body shape (look.body: 'm' or 'f'), build and height;
   - skin tone, hair colour and eye colour recolour the painted textures (keeping their
     light and shade); kit colour and kit patterns recolour the cloth, shoes the boots;
   - hair styles map to the nearest of the pack's hair pieces (HERO_HAIR); a beard is its own
     piece; the Ranger hood is a real part of the outfit;
   - other headwear, eyewear, extras, charms and pets are the toon builders from av3d.js,
     fitted to the new head and bones (HERO_FIT).
   Your class picks the outfit and weapons (HERO_KIT). Looks that can't be remade on the
   new character are refunded once (heroRefund, run on start-up from whatsNewCheck).

   heroMake({ spec, gear, cls, outfit, props, scale }) gives { root, play(name), update(dt), ... }.
   Old animation names (from the KayKit pack) still work: HERO_CLIP maps them. */

const HERO = { gltf: null, loading: null, fail: false, tex: {} };
const HERO_OUTFIT = { guardian: 'Knight', tactician: 'Knight', striker: 'Barbarian', monk: 'Barbarian', sage: 'Mage', bard: 'Mage', ranger: 'Rogue', rogue: 'Rogue' };
const HERO_OUTFITS = ['Knight', 'Barbarian', 'Mage', 'Rogue'];
// what each class wears: an outfit, the parts of it, parts borrowed from the other outfit, and its weapons
const HERO_KIT = {
  Knight: { o: 'Ranger', parts: ['Body', 'Legs', 'Arms', 'Feet', 'Pauldron', 'Bracer', 'Belt_1'], r: 'Sword', l: 'Shield_Heater' },
  Barbarian: { o: 'Peasant', parts: ['Body', 'Legs', 'Arms', 'Feet'], more: ['Ranger_Bracer', 'Ranger_Belt_1'], r: 'Axe' },
  Mage: { o: 'Peasant', parts: ['Body', 'Legs', 'Arms', 'Feet'], more: ['Ranger_Belt_2'], r: 'Staff', l: 'Book' },
  Rogue: { o: 'Ranger', parts: ['Body', 'Legs', 'Arms', 'Feet', 'Belt_1', 'Belt_2'], r: 'Dagger', l: 'Dagger' },
};
// your hair style -> the nearest hair piece (null: none). Bought styles with no close piece are refunded.
const HERO_HAIR = {
  h_short: 'SimpleParted', h_side: 'SimpleParted', h_fringe: 'SimpleParted', h_quiff: 'SimpleParted', h_slick: 'SimpleParted', h_crop: 'Buzzed', h_hero: 'SimpleParted',
  h_buzz: 'Buzzed', h_bald: null, h_cornrows: 'Buzzed', h_hightop: 'Buzzed', h_twists: 'Buzzed', h_undercut: 'Buzzed', h_curly: 'SimpleParted', h_afro: 'Buzzed',
  h_long: 'Long', h_wavy: 'Long', h_flow: 'Long', h_locs: 'Long', h_braids: 'Long', h_bob: 'Long',
  h_bun: 'Buns', h_topknot: 'Buns', h_pony: 'Buns', h_spacebuns: 'Buns', h_pigtails: 'Buns',
  h_spiky: 'SimpleParted', h_mohawk: 'Buzzed', h_mullet: 'Long', h_frosted: 'SimpleParted', h_wolf: 'Long',
};
// bought looks that the new character can't show any more (refunded once, see heroRefund)
const HERO_GONE = ['h_spiky', 'h_mohawk', 'h_mullet', 'h_frosted', 'h_wolf', 'h_spacebuns', 'h_pigtails', 'f_focus', 'f_grin', 'f_fierce'];
const heroGone = id => HERO_GONE.includes(id);
// what you wear instead of a look that's gone (all free looks)
const HERO_SWAP = { h_spiky: 'h_short', h_mohawk: 'h_buzz', h_mullet: 'h_long', h_frosted: 'h_short', h_wolf: 'h_long', h_spacebuns: 'h_topknot', h_pigtails: 'h_pony', f_focus: 'f_smile', f_grin: 'f_smile', f_fierce: 'f_smile' };
// 2.84: once, give back what you paid for those looks and switch to the nearest free one
function heroRefund() {
  if (!D?.arena || D.arena.heroRefund) return;
  D.arena.heroRefund = 1;
  const own = D.arena.owned || {}, back = { l: 0, e: 0 }, names = [];
  for (const id of HERO_GONE) {
    const c = cos(id); if (!c || !own[id]) continue;
    delete own[id];
    if (c.price) { back.l += c.price.l || 0; back.e += c.price.e || 0; names.push(c.name); }
  }
  const av = myAv(); let swapped = false;
  for (const k of ['hair', 'face']) if (heroGone(av[k])) { av[k] = HERO_SWAP[av[k]] || AV_DEFAULT[k]; swapped = true; }
  if (swapped) D.arena.av = av;
  if (back.l || back.e) { const s = cdState(); s.got = s.got || { l: 0, e: 0 }; s.got.l = (s.got.l || 0) + back.l; s.got.e = (s.got.e || 0) + back.e; }
  save();
  if (names.length) toast('💸 Looks refunded', `The new 3D character can't wear ${names.join(', ')}, so you got back ${[back.l && LUMEN + ' ' + back.l, back.e && EMBER + ' ' + back.e].filter(Boolean).join(' and ')}.`);
}
// old animation names -> Universal Animation Library clips
const HERO_CLIP = {
  Idle: 'Idle_Loop', Unarmed_Idle: 'Idle_Loop', Walking_A: 'Walk_Loop', Walking_B: 'Walk_Loop', Walking_C: 'Walk_Formal_Loop', Walking_Backwards: 'Walk_Loop',
  Running_A: 'Jog_Fwd_Loop', Running_B: 'Sprint_Loop', Jump_Idle: 'Jump_Loop', Dodge_Forward: 'Roll',
  '1H_Melee_Attack_Slice_Diagonal': 'Sword_Regular_A', '1H_Melee_Attack_Slice_Horizontal': 'Sword_Regular_B', '1H_Melee_Attack_Chop': 'Sword_Regular_C',
  '1H_Melee_Attack_Stab': 'Melee_Hook', '2H_Melee_Attack_Chop': 'Sword_Attack', '2H_Melee_Attack_Slice': 'Sword_Attack', '2H_Melee_Idle': 'Sword_Idle',
  Block: 'Sword_Block', Blocking: 'Idle_Shield_Loop', Block_Hit: 'Idle_Shield_Break', Hit_A: 'Hit_Chest', Hit_B: 'Hit_Knockback', Death_A: 'Death01', Death_A_Pose: 'Death01',
  Cheer: 'Yes', PickUp: 'PickUp_Table', Use_Item: 'Consume', Spellcast_Shoot: 'Spell_Simple_Shoot', Spellcast_Raise: 'Spell_Simple_Enter', Throw: 'OverhandThrow',
  Sit_Floor_Idle: 'Sitting_Idle_Loop', Lie_Idle: 'Sitting_Idle_Loop',
};
// how the toon cosmetics sit on the new bones (tuned by eye in the You page and the fight)
const HERO_FIT = { headR: .115, headUp: .1, headFwd: .012, chest: .62, hand: .33, charm: [.55, 1.35, .1], weapon: .2 };
const HERO_TEXS = ['T_Superhero_Male', 'T_Superhero_Female', 'T_Regular_Male', 'T_Regular_Female', 'T_Peasant', 'T_Ranger', 'T_Hair_1', 'T_Hair_2', 'T_Eye_Brown'];
const HERO_SLOTS = [1, 2, 3, 5, 6]; // skin, kit, shoes, hair, eyes

// ---------- loading: the model, its textures and their recolour masks ----------
function heroImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
async function heroTexLoad(name) {
  const [img, msk] = await Promise.all([heroImg(`hero/q/${name}.jpg`), heroImg(`hero/q/${name}_m.png`)]);
  // the average brightness of each recolourable slot, so a tint keeps the painted shading around it
  const w = msk.width, h = msk.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(msk, 0, 0); const m = x.getImageData(0, 0, w, h).data;
  x.drawImage(img, 0, 0, w, h); const p = x.getImageData(0, 0, w, h).data;
  const sum = new Float32Array(8), n = new Float32Array(8), lin = v => Math.pow(v / 255, 2.2);
  for (let i = 0; i < w * h; i++) { const s = Math.round(m[i * 4] / 40); if (s > 0 && s < 8) { sum[s] += .2126 * lin(p[i * 4]) + .7152 * lin(p[i * 4 + 1]) + .0722 * lin(p[i * 4 + 2]); n[s]++; } }
  const ref = new Float32Array(8); for (let s = 0; s < 8; s++) ref[s] = n[s] ? sum[s] / n[s] : .3;
  const map = new THREE.Texture(img); map.flipY = false; map.encoding = THREE.sRGBEncoding; map.anisotropy = 4; map.needsUpdate = true;
  const mask = new THREE.Texture(msk); mask.flipY = false; mask.minFilter = mask.magFilter = THREE.NearestFilter; mask.generateMipmaps = false; mask.needsUpdate = true;
  HERO.tex[name] = { map, mask, ref };
}
function heroLoad() {
  if (HERO.gltf || HERO.fail) return Promise.resolve(HERO.gltf);
  if (HERO.loading) return HERO.loading;
  if (!window.THREE?.GLTFLoader) return Promise.resolve(null);
  const model = new Promise((ok, no) => new THREE.GLTFLoader().load('hero/qhero.glb', ok, undefined, no));
  HERO.loading = Promise.all([model, ...HERO_TEXS.map(heroTexLoad)]).then(([g]) => {
    // play every clip in place: the hips may bob and lean but never wander off
    for (const a of g.animations) for (const t of a.tracks) if (/^pelvis\.position/.test(t.name)) { const v = t.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0 + (v[i] - x0) * .25; } }
    HERO.gltf = g; return g;
  }).catch(e => { console.error('hero', e); HERO.fail = true; return null; });
  return HERO.loading;
}
function heroReady() { if (!HERO.gltf) heroLoad(); return !!HERO.gltf; }
function heroOutfitOf(clsId) { return HERO_OUTFIT[clsId] || 'Rogue'; }
// which body: picked on the You page; before that, a guess from the look (it's one click to change)
function heroBody(L) { return L.body === 'f' || L.body === 'm' ? L.body : (L.lashes === 'lashes' || ['h_long', 'h_bob', 'h_pony', 'h_bun', 'h_pigtails', 'h_spacebuns', 'h_braids', 'h_wavy'].includes(L._hair) ? 'f' : 'm'); }

// ---------- materials: toon light, painted texture, your colours on the masked parts ----------
let HERO_GRAD = null;
function heroGrad() {
  if (HERO_GRAD) return HERO_GRAD;
  const d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  HERO_GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); HERO_GRAD.minFilter = HERO_GRAD.magFilter = THREE.NearestFilter; HERO_GRAD.generateMipmaps = false; HERO_GRAD.needsUpdate = true;
  return HERO_GRAD;
}
const HERO_FRAG = `
  { float sl = qForce > .5 ? qForce : floor(texture2D(qMask, vUv).r * 255. / 40. + .5);
    vec3 tc = vec3(-1.); float rf = .3;
    if (sl > .5 && sl < 1.5) { tc = qSkin; rf = qRef1; }
    else if (sl > 1.5 && sl < 2.5 && qKitK > 0.) { tc = (qPat > .5 ? texture2D(qPatMap, vUv * 5.).rgb : qKit) * qKitD; rf = qRef2; }
    else if (sl > 2.5 && sl < 3.5) { tc = qShoe; rf = qRef3; }
    else if (sl > 4.5 && sl < 5.5) { tc = qHair; rf = qRef5; }
    else if (sl > 5.5 && sl < 6.5) { tc = qEye; rf = qRef6; }
    if (tc.r >= 0.) { float l = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); vec3 g = vec3(dot(tc, vec3(.2126, .7152, .0722))); vec3 nc = mix(g, tc, .82) * clamp(l / max(.02, rf), .45, 1.6) * .9; diffuseColor.rgb = sl > 1.5 && sl < 2.5 ? mix(diffuseColor.rgb, nc, qKitK) : nc; } }`;
function heroMatTex(name, K, force = 0, kitD = 1) {
  const T = HERO.tex[name]; if (!T) return new THREE.MeshToonMaterial({ color: '#b0a090', gradientMap: heroGrad() });
  const lin = c => c ? new THREE.Color(c).convertSRGBToLinear() : new THREE.Color(-1, -1, -1);
  const u = { qMask: { value: T.mask }, qForce: { value: force }, qSkin: { value: lin(K.skin) }, qKit: { value: lin(K.kit) }, qShoe: { value: lin(K.shoe) }, qHair: { value: lin(K.hair) }, qEye: { value: lin(K.eye) },
    qPat: { value: K.pat ? 1 : 0 }, qPatMap: { value: K.pat || T.mask }, qKitK: { value: K.kitK }, qKitD: { value: kitD } };
  for (const s of HERO_SLOTS) u['qRef' + s] = { value: T.ref[s] };
  const m = new THREE.MeshToonMaterial({ map: T.map, gradientMap: heroGrad() });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.fragmentShader = 'uniform sampler2D qMask, qPatMap; uniform float qForce, qPat, qKitK, qKitD, ' + HERO_SLOTS.map(x => 'qRef' + x).join(', ') + '; uniform vec3 qSkin, qKit, qShoe, qHair, qEye;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + HERO_FRAG);
  };
  m.customProgramCacheKey = () => 'qhero1';
  return m;
}

// ---------- building one ----------
function heroMake(o = {}) {
  const G = HERO.gltf; if (!G) return null;
  const outfit = HERO_OUTFITS.includes(o.outfit) ? o.outfit : 'Rogue', spec = o.spec || avatarSpec(), K0 = av3colors(spec), L = K0.L;
  const body = heroBody({ ...L, _hair: spec.hair }), Gd = body === 'f' ? 'Female' : 'Male', kit = HERO_KIT[outfit];
  // gear: body-shaped pieces recolour the outfit (as before), the rest uses the toon builders
  const tintGear = { Hoodie: 'kit', Chestplate: 'kit', Robe: 'kit', Spikes: 'shoe', Boots: 'shoe', Slippers: 'shoe' }, skipGear = ['Track Pants', 'Greaves', 'Training Shorts', 'Gloves', 'Tape', 'Hoodie', 'Chestplate', 'Robe', 'Spikes', 'Boots', 'Slippers'];
  const gear = {}, tint = {};
  for (const [b, c] of Object.entries(o.gear || {})) { if (tintGear[b]) tint[tintGear[b]] = c; if (!skipGear.includes(b)) gear[b] = c; }
  const kitC = spec.kit && spec.kit !== 'kit_gear' ? K0.kit : tint.kit || (o.cls ? av3mix(K0.kit, o.cls, AV3_STYLE.tint) : K0.kit);
  const shoeOn = (spec.shoes && spec.shoes !== 'sh_white') || tint.shoe;
  const K = { kitK: (spec.kit && spec.kit !== 'kit_gear') || tint.kit ? 1 : o.cls ? .45 : 0, skin: K0.skin, kit: kitC, shoe: tint.shoe || K0.shoe, hair: K0.hair, eye: K0.eye, pat: K0.pattern ? av3pattern(K0.pattern, kitC) : null };
  const hood = spec.hat === 'hat_hood' && !Object.keys(gear).some(b => ['Study Cap', 'Helm', 'Headband'].includes(b));
  const hairPiece = HERO_HAIR[spec.hair] === undefined ? 'SimpleParted' : HERO_HAIR[spec.hair];
  const hairName = hairPiece === 'Buzzed' && body === 'f' ? 'BuzzedFemale' : hairPiece;
  const beard = body === 'm' && ['full', 'goatee', 'moustache', 'stubble'].includes(L.beard);
  // the parts to show
  const want = new Set([`${body.toUpperCase()}_SuperHero_Male`, `${body.toUpperCase()}_Superhero_Female`, `${body.toUpperCase()}_Eyes`, `${body.toUpperCase()}_Eyebrows`]);
  const partName = (out, p) => { const b = `${Gd}_${out}_`; return { Feet: [b + 'Feet', b + 'Feet_Boots'], Pauldron: [b + 'Acc_Pauldron', b + 'Acc_Pauldrons'], Bracer: [b + 'Arms_Bracer'], Belt_1: [b + 'Body_Belt_1'], Belt_2: [b + 'Body_Belt_2'], Hood: [b + 'Head_Hood'] }[p] || [b + p]; };
  for (const p of kit.parts) partName(kit.o, p).forEach(n => want.add(n));
  for (const m of kit.more || []) { const [out, p] = m.split('_'), rest = m.slice(out.length + 1); partName(out, rest).forEach(n => want.add(n)); }
  if (hood) partName('Ranger', 'Hood').forEach(n => want.add(n));
  if (hairName && !hood) want.add('Hair_' + hairName);
  if (beard) want.add('Hair_Beard');

  const root = new THREE.Group(), rig = THREE.SkeletonUtils.clone(G.scene);
  const drop = [], mats = [];
  rig.traverse(m => {
    if (m.name.startsWith('W_')) { drop.push(m); return; }
    if (!m.isMesh) return;
    const nm = m.name.replace(/_\d+$/, ''), top = m.parent?.isMesh || m.parent?.name?.startsWith?.('W_') ? null : nm;
    const own = m.isSkinnedMesh ? (m.parent && !m.parent.isBone && m.parent.name && want.has(m.parent.name)) || want.has(nm) : false;
    if (!own) { drop.push(m); return; }
    const tex = m.material?.name || '', force = /_Feet/.test(m.name) || /_Feet/.test(m.parent?.name || '') ? (shoeOn ? 3 : 0) : 0;
    m.material = heroMatTex(tex, K, force, /_Legs/.test(m.name) || /_Legs/.test(m.parent?.name || '') ? .55 : 1); mats.push(m.material);
    m.castShadow = true; m.frustumCulled = false; void top;
  });
  drop.forEach(m => m.parent?.remove(m));
  root.add(rig);
  const bone = n => rig.getObjectByName(n);
  rig.updateMatrixWorld(true);

  // weapons: copies of the loose prop meshes, in your hands
  const weapons = {};
  const prop = (name, bn, side) => {
    const src = G.scene.getObjectByName('W_' + name), b = bone(bn); if (!src || !b) return;
    const w = src.clone(true); w.position.set(0, 0, 0); w.rotation.set(0, 0, 0); w.scale.setScalar(1);
    w.traverse(x => { if (x.isMesh) { x.castShadow = true; x.material = x.material.clone(); if (x.geometry.attributes.color) x.material.vertexColors = true; if (!x.geometry.attributes.color) x.material = new THREE.MeshToonMaterial({ color: x.material.color, gradientMap: heroGrad() }); mats.push(x.material); } });
    const fit = HERO_WEAPON[name] || HERO_WEAPON.Dagger, px = new THREE.Group(); px.add(w);
    w.scale.setScalar(fit.s); w.position.set(...fit.p); w.rotation.set(...fit.r);
    if (side === 'l') { px.scale.x = -1; }
    b.add(px); weapons[side] = px;
  };
  if (o.props) { if (kit.r) prop(kit.r, 'hand_r', 'r'); if (kit.l) prop(kit.l, 'hand_l', 'l'); }

  // the toon cosmetics: headwear, eyewear, extras, charm and pet, without a toon head or body
  const fig = av3figure({ ...spec, force: '', bare: true, hat: hood ? 'hat_none' : spec.hat, hairPiece: !!hairName || beard }, gear, o.cls || ''), P = fig.userData.P;
  for (const m of P.base) m.parent?.remove(m);
  fig.scale.set(1, 1, 1); fig.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(rig.matrixWorld).invert(), wp = n => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(rootInv, bone(n).matrixWorld));
  const attach = (g, bn, pos, sc) => {
    const b = bone(bn); if (!g || !b) return;
    const px = new THREE.Object3D(), want = new THREE.Matrix4().compose(pos, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    const bw = new THREE.Matrix4().multiplyMatrices(rootInv, b.matrixWorld);
    px.applyMatrix4(bw.invert().multiply(want)); b.add(px);
    g.parent?.remove(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); px.add(g);
  };
  const F = HERO_FIT, hs = F.headR / AV3_STYLE.headR, head = wp('Head');
  attach(P.head, 'Head', head.clone().add(new THREE.Vector3(0, F.headUp, F.headFwd)), hs);
  const ch = wp('spine_03'); attach(P.chest, 'spine_03', new THREE.Vector3(0, ch.y - AV3_STYLE.torsoH * F.chest * .78, 0), F.chest);
  P.hands.forEach((H, i) => attach(H, i ? 'hand_l' : 'hand_r', wp(i ? 'hand_l' : 'hand_r'), F.hand));
  P.feet.forEach(f => f.parent?.remove(f)); P.legs.forEach(l => l.parent?.remove(l)); P.arms.forEach(a => a.parent?.remove(a));
  fig.scale.setScalar(F.chest * 1.15); root.add(fig);
  P.charm.position.set(...F.charm.map(v => v / (F.chest * 1.15)));
  if (P.pet) P.pet.position.multiplyScalar(1);
  root.scale.set(K0.build, K0.tall, K0.build).multiplyScalar((o.scale || 1) * HERO_SCALE);
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });

  // animations
  const mixer = new THREE.AnimationMixer(rig), acts = {};
  const clip = n => G.animations.find(a => a.name === (HERO_CLIP[n] || n)) || G.animations.find(a => a.name === n);
  const H = { root, rig, fig, P, mixer, outfit, body, cur: '', act: null, bone, weapons, mats,
    play(name, { fade = .18, loop = true, speed = 1, restart = false, from = 0 } = {}) {
      const c = clip(name); if (!c) return null;
      let a = acts[c.name]; if (!a) a = acts[c.name] = mixer.clipAction(c);
      a.timeScale = speed;
      if (name === H.cur && !restart) return a;
      if (H.cur === 'loco') { // 2.103: leaving the blended walk/jog/sprint: fade every part of it out together
        for (const b of H.lc.acts) if (b !== a) b.fadeOut(fade);
        a.reset(); a.timeScale = speed; a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.weight = 1; if (from) a.time = from * c.duration;
        a.fadeIn(fade); a.play(); H.cur = name; H.act = a; return a;
      }
      a.reset(); a.timeScale = speed; a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true; a.setEffectiveWeight(1); if (from) a.time = from * c.duration;
      if (H.act && H.act !== a) a.crossFadeFrom(H.act, fade, false); a.play();
      H.cur = name; H.act = a; return a;
    },
    // 2.103: moving on foot. Idle, walk, jog and sprint all play at once, blended by your speed, with
    // their steps kept in time, so speeding up and slowing down never pops from one clip to the next.
    // refs: the speeds the walk, jog and sprint clips look right at. H.cur is 'loco' while it runs.
    loco(sp, { refs = [1.5, 2.7, 4.3], idle = 'Idle', fade = .2 } = {}) {
      const L = H.lc || (H.lc = { ph: 0, acts: [] });
      L.sp = sp; L.refs = refs;
      const want = [idle, 'Walking_A', 'Running_A', 'Running_B'].map(n => { const c = clip(n); return acts[c.name] || (acts[c.name] = mixer.clipAction(c)); });
      if (H.cur === 'loco' && L.acts[0] === want[0]) return;
      if (H.cur === 'loco') { L.acts[0].fadeOut(fade); L.acts[0] = want[0]; want[0].reset(); want[0].weight = 1; want[0].fadeIn(fade); want[0].play(); return; } // a new idle (the fight's guard stance)
      const prev = H.act;
      L.acts = want; L.w = 0; L.fade = Math.max(.01, fade);
      want.forEach((a, i) => { if (a === prev) return; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.weight = 0; a.timeScale = i ? 0 : 1; a.play(); });
      if (prev && !want.includes(prev)) prev.fadeOut(fade); else if (prev) { prev.stopFading(); prev.setLoop(THREE.LoopRepeat, Infinity); prev.timeScale = want.indexOf(prev) ? 0 : 1; L.w = 1; }
      H.cur = 'loco'; H.locoStep(0);
    },
    locoStep(dt) {
      const L = H.lc, [r1, r2, r3] = L.refs, sp = L.sp, A = L.acts;
      L.w = Math.min(1, L.w + dt / L.fade);
      // weights: idle until a slow walk, then walk, jog and sprint each strongest at its own speed
      const k = [.15, r1 * .75, r2, r3], w = [0, 0, 0, 0];
      if (sp <= k[0]) w[0] = 1; else if (sp >= k[3]) w[3] = 1;
      else for (let i = 0; i < 3; i++) if (sp <= k[i + 1]) { const t = (sp - k[i]) / (k[i + 1] - k[i]), s = t * t * (3 - 2 * t); w[i] = 1 - s; w[i + 1] = s; break; }
      // one step cycle shared by the moving clips: each clip's own pace at this speed, mixed by weight
      let f = 0, fw = 0;
      for (let i = 1; i < 4; i++) if (w[i] > 0) { const d = A[i].getClip().duration; f += w[i] * Math.max(.65, sp / L.refs[i - 1]) / d; fw += w[i]; }
      if (fw) L.ph = (L.ph + dt * f / fw) % 1;
      // the same clip can be idle and a step clip at once only if a caller passes a moving clip as idle; let the idle win
      for (let i = 1; i < 4; i++) if (A[i] !== A[0]) A[i].time = L.ph * A[i].getClip().duration;
      let best = 0; for (let i = 0; i < 4; i++) { if (A[i] === A[0] && i) continue; A[i].enabled = true; A[i].weight = w[i] * L.w; if (w[i] > w[best]) best = i; }
      H.act = A[best]; L.main = ['Idle', 'Walking_A', 'Running_A', 'Running_B'][best];
    },
    speed(s) { if (H.act) H.act.timeScale = s; },
    phase() { const a = H.act; return a ? (a.time / a.getClip().duration) % 1 : 0; },
    done() { const a = H.act; return !a || (a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - .02); },
    // where a weapon tip is in the world (for swing trails); null with no weapon
    tip(side = 'r', out = new THREE.Vector3()) { const w = weapons[side]; if (!w) return null; const f = HERO_WEAPON[kit[side]] || HERO_WEAPON.Dagger; return out.set(...f.tip).applyMatrix4(w.matrixWorld); },
    update(dt, t = performance.now() / 1000) {
      if (H.cur === 'loco') H.locoStep(dt);
      mixer.update(dt);
      if (P.charm) { P.charm.position.y = F.charm[1] / (F.chest * 1.15) + Math.sin(t * 1.6) * .06; P.charm.rotation.y = t; }
      if (P.pet) P.pet.position.y = .28 + Math.abs(Math.sin(t * 3)) * .1;
    },
    dispose() { root.parent?.remove(root); mixer.stopAllAction(); mats.forEach(m => m.dispose()); if (K.pat) K.pat.dispose(); },
  };
  H.play(HERO_CLIP[o.idle] || o.idle || 'Idle_Loop');
  return H;
}
// the pack is in metres (about 1.8 tall); the game was tuned for the old 2.3-unit hero
const HERO_SCALE = 1.25;
// weapon fits in the hand: scale, position, rotation (radians), and the tip for trails
const HERO_WEAPON = {
  Sword: { s: .62, p: [0, .1, .03], r: [-1.57, 0, 0], tip: [0, .9, 0] },
  Axe: { s: .2, p: [0, .1, .03], r: [-1.57, 0, 0], tip: [0, 3.4, 0] },
  Dagger: { s: .16, p: [0, .1, .03], r: [-1.57, 0, 0], tip: [0, 2, 0] },
  Shield_Heater: { s: .18, p: [0, .1, .03], r: [1.57, 1.57, 0], tip: [0, 1.2, 0] },
  Staff: { s: .7, p: [0, .1, .03], r: [-1.57, 0, 0], tip: [0, 1.4, 0] },
  Book: { s: .42, p: [0, .1, .03], r: [-1.57, 0, 0], tip: [0, .2, 0] },
};

// ---------- villagers: the same pack, a random look each ----------
const HERO_VIL_HAIR = ['h_short', 'h_long', 'h_side', 'h_buzz', 'h_bun', 'h_crop', 'h_bob', 'h_bald'];
function heroVillager(r, o = {}) {
  const pick = a => a[Math.floor(r() * a.length)];
  const spec = { hair: pick(HERO_VIL_HAIR), hat: pick(['hat_none', 'hat_none', 'hat_none', 'hat_none', 'hat_hood']), kitC: pick(['#3b5bdb', '#c92a2a', '#2b8a3e', '#e67700', '#862e9c', '#0b7285', '#5c940d', '#a61e4d', '#868e96']), shoes: 'sh_white',
    look: { ...LOOK_DEFAULT, body: r() < .5 ? 'f' : 'm', skinC: pick(['#f6d7b8', '#f1c9a5', '#e8b48a', '#d9a066', '#a86b3c', '#6b4226']), hairC: pick(['#1f1a17', '#3b2416', '#5c3a21', '#a0703f', '#c8a060', '#b5541c', '#9aa0a6']),
      beard: r() < .25 ? 'full' : 'none', build: pick(['slim', 'regular', 'regular', 'broad']) } };
  return heroMake({ spec, gear: {}, outfit: pick(['Barbarian', 'Mage', 'Rogue', 'Barbarian']), cls: '', idle: 'Idle', ...o });
}
