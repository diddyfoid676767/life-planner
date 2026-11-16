#!/usr/bin/env node
/* Packs the Quaternius "Universal" character family (all CC0, quaternius.com) into the files
   the app loads (2.84, round 2 stage R2): web/hero/qhero.glb plus its textures in web/hero/q/.

   Sources (licence CC0 1.0, re-checked at download, see web/hero/LICENSE.txt):
   - Universal Animation Library 1 + 2 (UAL1.glb, UAL2.glb): the rig and the animations.
   - Universal Base Characters: Superhero_Male / Superhero_Female. Only the head and neck
     are kept (the outfits bring their own arms, hands and legs), with the eyes and brows.
   - Modular Character Outfits - Fantasy (free version): Peasant and Ranger, male and female,
     as separate parts (body, arms, legs, feet, hood, pauldrons, bracers, belts).
   - Universal hair pieces: Buzzed, BuzzedFemale, SimpleParted, Long, Buns, Beard.
   - Modular Weapons: Dagger, Axe, Shield_Heater. Plus three hand props from the KayKit
     Adventurers pack (CC0) already in web/hero/hero.glb: 1H_Sword, 2H_Staff, Spellbook.
   Mirrors used for the download (the build machine can't reach quaternius.com):
   github.com/Dallolz/moorfall-assets and github.com/Mesh2Motion/mesh2motion-assets.

   Every skinned part is re-bound onto ONE skeleton (UAL1's), so one mixer drives the lot.
   Root-motion is stripped (the game moves you). Textures go out as small JPEGs, and each
   gets a mask PNG saying which pixels can be recoloured: 1 skin, 2 kit, 3 shoes, 5 hair,
   6 eyes. The app tints those pixels keeping the painted light and shade.

   Usage (npm i @gltf-transform/core@3.10.1 @gltf-transform/functions@3.10.1 @gltf-transform/extensions@3.10.1 sharp@0.33 meshoptimizer@0.22):
   node tools/qhero-pack.mjs <moorfall-assets dir> <kaykit hero.glb> web/hero */
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup, quantize, weldPrimitive, simplifyPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { PropertyType } from '@gltf-transform/core';
import sharp from 'sharp';
import fs from 'node:fs';

const [src, kay, out] = process.argv.slice(2);
import { KHRMeshQuantization } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
fs.mkdirSync(`${out}/q`, { recursive: true });

// the clips Solis uses (UAL1 then UAL2); root-motion versions are left out
const CLIPS1 = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll', 'Sword_Attack', 'Sword_Idle',
  'Spell_Simple_Enter', 'Spell_Simple_Shoot', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Exit', 'Punch_Jab', 'Punch_Cross', 'Hit_Chest', 'Hit_Head', 'Death01',
  'Interact', 'PickUp_Table', 'Swim_Fwd_Loop', 'Swim_Idle_Loop', 'Dance_Loop', 'Idle_Talking_Loop', 'Sitting_Idle_Loop', 'Crouch_Idle_Loop', 'Walk_Formal_Loop', 'Idle_Torch_Loop'];
const CLIPS2 = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Block', 'Idle_Shield_Loop', 'Idle_Shield_Break', 'Shield_OneShot', 'Hit_Knockback',
  'Melee_Hook', 'OverhandThrow', 'Consume', 'Yes', 'Idle_FoldArms_Loop', 'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'Idle_Lantern_Loop', 'Farm_Harvest'];
const PARTS = {
  Male_Peasant: ['Arms', 'Body', 'Feet', 'Legs'], Female_Peasant: ['Arms', 'Body', 'Feet', 'Legs'],
  Male_Ranger: ['Acc_Pauldron', 'Arms', 'Arms_Bracer', 'Body', 'Body_Belt_1', 'Body_Belt_2', 'Feet_Boots', 'Head_Hood', 'Legs'],
  Female_Ranger: ['Acc_Pauldrons', 'Arms', 'Arms_Bracer', 'Body', 'Body_Belt_1', 'Body_Belt_2', 'Feet', 'Head_Hood', 'Legs'],
};
const HAIRS = ['Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard'];
const WEAPONS = ['Dagger', 'Axe', 'Shield_Heater'];
const KAY_PROPS = { 'Knight:1H_Sword': 'Sword', 'Mage:2H_Staff': 'Staff', 'Mage:Spellbook': 'Book' };

// ---------- the base: UAL1's rig ----------
const base = await io.read(`${src}/animations/UAL1.glb`), R = base.getRoot(), scene = R.listScenes()[0];
const walk = (n, f) => { f(n); n.listChildren().forEach(c => walk(c, f)); };
const bones = {}; scene.listChildren().forEach(c => walk(c, n => { if (!n.getMesh()) bones[n.getName()] = n; }));
for (const n of R.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.dispose(); }
const rigTop = scene.listChildren().find(n => !n.getMesh());
for (const a of R.listAnimations()) if (!CLIPS1.includes(a.getName())) a.dispose();

// ---------- textures: JPEG + recolour mask ----------
const hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; };
const MASK = {
  skin: () => 1, hair: () => 5,
  eye: (h, s, v) => (s > .35 && v < .75 && v > .08 && (h < 60 || h > 330)) ? 6 : 0, // the iris
  Ranger: (h, s, v) => (h > 60 && h < 170 && s > .2) ? 2 : 0,                     // the green cloth
  Peasant: (h, s, v) => (s < .3 && v > .55) ? 2 : 0,                               // the cream shirt
};
const done = new Set();
async function texOut(tex, kind) {
  const name = tex.getName().replace(/_BaseColor$/, '').replace(/_Dark$/, '');
  if (done.has(name)) return name; done.add(name);
  const img = sharp(Buffer.from(tex.getImage())).removeAlpha();
  const size = /Eye/.test(name) ? 128 : 512;
  await img.clone().resize(size, size).jpeg({ quality: 82 }).toFile(`${out}/q/${name}.jpg`);
  const { data, info } = await img.clone().resize(size / 2, size / 2).raw().toBuffer({ resolveWithObject: true });
  const m = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < m.length; i++) { const [h, s, v] = hsv(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]); m[i] = MASK[kind](h, s, v) * 40; }
  await sharp(m, { raw: { width: info.width, height: info.height, channels: 1 } }).png({ palette: true, colours: 8 }).toFile(`${out}/q/${name}_m.png`);
  return name;
}
const kindOf = tex => /Eye/.test(tex) ? 'eye' : /Hair/.test(tex) ? 'hair' : /Ranger/.test(tex) ? 'Ranger' : /Peasant/.test(tex) ? 'Peasant' : 'skin';

// ---------- bring in a file's skinned meshes, on the base bones ----------
const skins = new Map();
async function bring(file, prefix, keep = () => true, cut) {
  const doc = await io.read(file), r = doc.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  // name every material by its texture so the app can find it again
  for (const m of r.listMaterials()) { const t = m.getBaseColorTexture(); m.setName(t ? await texOut(t, kindOf(t.getName())) : (m.getName().includes('Hair_2') ? 'T_Hair_2' : m.getName().includes('Hair') ? 'T_Hair_1' : m.getName())); m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); }
  for (const t of r.listTextures()) t.dispose();
  // what the app uses: position, normal, uv, skin (no second uv set or vertex colours)
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) for (const sem of ['TEXCOORD_1', 'COLOR_0', 'COLOR_1', 'TANGENT']) if (p.getAttribute(sem)) p.setAttribute(sem, null);
  const meshes = r.listNodes().filter(n => n.getMesh());
  for (const n of meshes) { if (!keep(n.getName())) { n.getMesh().dispose(); n.dispose(); continue; } n.setName(prefix + n.getName()); if (cut) cut(n); }
  for (const s of r.listScenes()) s.setName('x');
  base.merge(doc);
  const sc = R.listScenes().find(s => s.getName() === 'x');
  const mine = []; sc.listChildren().forEach(c => walk(c, n => { if (n.getMesh()) mine.push(n); }));
  for (const n of mine) {
    const sk = n.getSkin();
    if (sk) {
      let ns = skins.get(sk);
      if (!ns) { const joints = sk.listJoints().map(j => bones[j.getName()]); if (joints.some(j => !j)) throw new Error('joint missing in ' + file); ns = base.createSkin(n.getName()).setInverseBindMatrices(sk.getInverseBindMatrices()); joints.forEach(j => ns.addJoint(j)); skins.set(sk, ns); }
      n.setSkin(ns);
    }
    n.listParents().filter(p => p.propertyType === 'Node' || p.propertyType === 'Scene').forEach(p => p.removeChild(n));
    rigTop.addChild(n); n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }
  sc.dispose();
}
// only the head and neck of a base body: triangles weighted to Head or neck_01
function headOnly(n) {
  const sk = n.getSkin(); if (!sk) return;
  const keepJ = new Set(sk.listJoints().map((j, i) => ['Head', 'neck_01'].includes(j.getName()) ? i : -1).filter(i => i >= 0));
  for (const p of n.getMesh().listPrimitives()) {
    const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), idx = p.getIndices(); if (!J || !idx) continue;
    const ok = v => { const j = J.getElement(v, []), w = W.getElement(v, []); let s = 0; for (let k = 0; k < 4; k++) if (keepJ.has(j[k])) s += w[k]; return s > .5; };
    const good = []; const arr = idx.getArray();
    for (let t = 0; t < arr.length; t += 3) if (ok(arr[t]) || ok(arr[t + 1]) || ok(arr[t + 2])) good.push(arr[t], arr[t + 1], arr[t + 2]);
    // keep only the vertices still used
    const used = [...new Set(good)].sort((a, b) => a - b), map = new Map(used.map((v, i) => [v, i]));
    for (const sem of p.listSemantics()) { const a = p.getAttribute(sem), k = a.getElementSize(), src = a.getArray(), dst = new (src.constructor)(used.length * k); used.forEach((v, i) => { for (let j = 0; j < k; j++) dst[i * k + j] = src[v * k + j]; }); a.setArray(dst); }
    idx.setArray(new Uint32Array(good.map(v => map.get(v))));
  }
}
await bring(`${src}/characters/Superhero_Male.glb`, 'M_', () => true, n => /Superhero|SuperHero/.test(n.getName()) && headOnly(n));
await bring(`${src}/characters/Superhero_Female.glb`, 'F_', () => true, n => /Superhero|SuperHero/.test(n.getName()) && headOnly(n));
for (const [o, parts] of Object.entries(PARTS)) await bring(`${src}/outfits/${o}.glb`, '', nm => parts.some(p => nm === `${o}_${p}`));
for (const h of HAIRS) await bring(`${src}/hair/${h}.glb`, '');

// ---------- the UAL2 clips, onto the same bones ----------
{
  const doc = await io.read(`${src}/animations/UAL2.glb`), r = doc.getRoot();
  for (const a of r.listAnimations()) if (!CLIPS2.includes(a.getName())) a.dispose();
  for (const n of r.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); }
  for (const s of r.listScenes()) s.setName('x2');
  base.merge(doc);
  for (const a of R.listAnimations()) for (const ch of a.listChannels()) { const t = ch.getTargetNode(); if (t && bones[t.getName()] && bones[t.getName()] !== t) ch.setTargetNode(bones[t.getName()]); }
  R.listScenes().find(s => s.getName() === 'x2').dispose();
}

// ---------- props: Quaternius weapons and three KayKit hand props, loose (the app puts them in a hand) ----------
async function prop(file, pick, rename) {
  const doc = await io.read(file), r = doc.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  for (const t of r.listTextures()) t.dispose();
  for (const n of r.listNodes()) if (n.getSkin()) { n.getMesh()?.dispose(); n.setMesh(null); }
  const keep = [];
  for (const n of r.listNodes()) { if (!n.getMesh()) continue; const nm = pick(n); if (nm) { keep.push([n, nm]); } else { n.getMesh().dispose(); n.setMesh(null); } }
  for (const s of r.listScenes()) s.setName('xp');
  base.merge(doc);
  const sc = R.listScenes().find(s => s.getName() === 'xp');
  for (const [n0, nm] of keep) {
    const n = R.listNodes().find(x => x.getName() === n0.getName() && x.getMesh() && !x.getSkin() && x.listParents().some(p => p.propertyType === 'Node' || p.propertyType === 'Scene') && !x.getName().startsWith('W_'));
    if (!n) continue;
    const g = base.createNode('W_' + nm + (rename ? '' : ':' + n.getName())); rigTop.addChild(g);
    n.listParents().filter(p => p.propertyType === 'Node' || p.propertyType === 'Scene').forEach(p => p.removeChild(n));
    n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]); g.addChild(n);
  }
  sc.dispose();
}
for (const w of WEAPONS) {
  // each weapon is several meshes (steel, wood...): gather them under one node
  const doc = await io.read(`${src}/weapons/${w}.glb`), r = doc.getRoot();
  for (const s of r.listScenes()) s.setName('xw');
  base.merge(doc);
  const sc = R.listScenes().find(s => s.getName() === 'xw'), g = base.createNode('W_' + w); rigTop.addChild(g);
  sc.listChildren().forEach(c => { sc.removeChild(c); g.addChild(c); });
  sc.dispose();
}
await prop(kay, n => KAY_PROPS[n.getName()], true);

for (const s of R.listScenes()) if (s !== scene) s.dispose();
R.setDefaultScene(scene); scene.setName('QHero');

// ---------- animations: in place, only the bones that move ----------
const near = (x, y) => x.every((v, i) => Math.abs(v - y[i]) < 1e-3);
for (const a of R.listAnimations()) for (const ch of a.listChannels()) {
  const n = ch.getTargetNode(), path = ch.getTargetPath(), nm = n?.getName() || '', o = ch.getSampler().getOutput();
  let drop = !n || path === 'scale' || (path === 'translation' && nm !== 'pelvis') || /_leaf_/.test(nm);
  if (!drop) { const rest = path === 'rotation' ? n.getRotation() : n.getTranslation(); drop = true; for (let i = 0; i < o.getCount(); i++) if (!near(o.getElement(i, []), rest)) { drop = false; break; } }
  if (drop) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
}
// one buffer
const buf = R.listBuffers()[0]; for (const b of R.listBuffers().slice(1)) { for (const a of R.listAccessors()) if (a.getBuffer() === b) a.setBuffer(buf); b.dispose(); }
// the heaviest parts (boots, bracers) get fewer triangles
await MeshoptSimplifier.ready;
for (const m of R.listMeshes()) for (const p of m.listPrimitives()) { const n = p.getAttribute('POSITION').getCount(); if (n > 2400) { weldPrimitive(base, p, { tolerance: 0 }); simplifyPrimitive(base, p, { simplifier: MeshoptSimplifier, ratio: 2400 / n, error: .004 }); } }
// materials stay apart (each names its texture), everything else is shared where it can be
await base.transform(resample({ tolerance: 2e-3 }), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }), prune({ keepAttributes: true }), quantize({ quantizeNormal: 10, quantizePosition: 14, quantizeTexcoord: 12 }));
await io.write(`${out}/qhero.glb`, base);
// a second pass drops accessors the merges left behind with nothing using them
{ const fin = await io.read(`${out}/qhero.glb`); for (const a of fin.getRoot().listAccessors()) if (a.listParents().every(p => p === fin.getRoot())) a.dispose(); await io.write(`${out}/qhero.glb`, fin); }
console.log('wrote', `${out}/qhero.glb`, fs.statSync(`${out}/qhero.glb`).size, 'bytes;', R.listAnimations().length, 'clips');
