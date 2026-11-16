#!/usr/bin/env node
/* Packs the KayKit Adventurers character pack (CC0, Kay Lousberg,
   github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) into one small
   file the app loads: web/hero/hero.glb (2.80, feedback stage F3).

   - One rig with the animations Solis uses (from Knight.glb), resampled.
   - The body, arms, legs and capes of all four outfits (Knight, Barbarian, Mage, Rogue)
     plus the hand-held weapons. Heads are left out: the app puts your own 3D head
     (face, hair, headwear, eyewear) on the rig's head bone.
   - The texture is baked into vertex colours, and every vertex gets a slot (_SLOT) so the
     app can recolour it: 0 keep, 1 skin, 2 kit (your kit colour), 3 shoes, 4 cape.

   Usage (needs: npm i @gltf-transform/core@3.10.1 @gltf-transform/functions@3.10.1 pngjs@7):
   node tools/hero-pack.mjs <pack>/addons/kaykit_character_pack_adventures/Characters/gltf web/hero/hero.glb */
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup } from '@gltf-transform/functions';
import { PNG } from 'pngjs';

const [dir, out] = process.argv.slice(2);
const io = new NodeIO();
const ANIMS = ['Idle', 'Unarmed_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Walking_Backwards', 'Running_A', 'Running_B', 'Running_Strafe_Left', 'Running_Strafe_Right',
  'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Idle',
  'Block', 'Blocking', 'Block_Hit', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Spellcast_Shoot', 'Spellcast_Raise', 'Throw', 'Sit_Floor_Idle', 'Lie_Idle'];
// hue ranges (degrees) of each outfit's main cloth colour: these vertices take your kit colour
const KIT = { Knight: h => h < 12 || h > 340, Barbarian: h => h > 185 && h < 235, Mage: h => h > 230 && h < 280, Rogue: h => h > 85 && h < 175 };
const KEEP_PROPS = ['1H_Sword', '2H_Sword', 'Round_Shield', 'Badge_Shield', '1H_Axe', '2H_Axe', 'Barbarian_Round_Shield', '1H_Wand', '2H_Staff', 'Spellbook', '1H_Crossbow', 'Knife', 'Knife_Offhand'];

function hsv([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; }
function bake(doc, who) {
  const root = doc.getRoot(), tex = root.listTextures()[0], png = PNG.sync.read(Buffer.from(tex.getImage()));
  for (const node of root.listNodes()) {
    const m = node.getMesh(); if (!m) continue;
    const name = node.getName(), part = name.replace(who + '_', '');
    for (const p of m.listPrimitives()) {
      const uv = p.getAttribute('TEXCOORD_0'), pos = p.getAttribute('POSITION'), n = uv.getCount();
      const col = new Float32Array(n * 3), slot = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const [u, v] = uv.getElement(i, []), x = Math.min(png.width - 1, Math.max(0, Math.floor(u * png.width))), y = Math.min(png.height - 1, Math.max(0, Math.floor(v * png.height))), o = (y * png.width + x) * 4;
        const c = [png.data[o], png.data[o + 1], png.data[o + 2]], [h, s, vv] = hsv(c);
        for (let k = 0; k < 3; k++) col[i * 3 + k] = Math.pow(c[k] / 255, 2.2); // linear, as glTF vertex colours are
        let sl = 0;
        if (node.getSkin()) {
          const py = pos.getElement(i, [])[1];
          if (h >= 10 && h <= 40 && s > .15 && s < .5 && vv > .75) sl = 1;
          else if (part === 'Cape') sl = 4;
          else if (KIT[who](h) && s > .25) sl = 2;
          else if (part.startsWith('Leg') && py < .2) sl = 3;
        } else if (part === 'Cape') sl = 4;
        slot[i] = sl;
      }
      p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(col).setBuffer(root.listBuffers()[0]));
      p.setAttribute('_SLOT', doc.createAccessor().setType('SCALAR').setArray(slot).setBuffer(root.listBuffers()[0]));
      p.setAttribute('TEXCOORD_0', null);
      p.getMaterial()?.setBaseColorTexture(null);
    }
  }
}
const base = await io.read(`${dir}/Knight.glb`);
for (const who of ['Knight', 'Barbarian', 'Mage', 'Rogue']) {
  const doc = who === 'Knight' ? base : await io.read(`${dir}/${who}.glb`), root = doc.getRoot();
  for (const node of root.listNodes()) { const m = node.getMesh(); if (!m) continue; const nm = node.getName(); if (nm.endsWith('_Head') || nm.endsWith('_Hat') || nm.endsWith('_Helmet') || (!node.getSkin() && !nm.endsWith('_Cape') && !KEEP_PROPS.includes(nm))) { node.setMesh(null); continue; } }
  // the skinned parts and props get unique names: "<Outfit>_Body", "<Outfit>:1H_Sword"
  for (const node of root.listNodes()) if (node.getMesh() && !node.getName().startsWith(who + '_')) node.setName(who + ':' + node.getName());
  for (const s of root.listScenes()) s.setName(who);
  bake(doc, who);
  if (who !== 'Knight') { for (const a of root.listAnimations()) a.dispose(); base.merge(doc); }
}
// every outfit onto the Knight's rig, so one skeleton and one set of animations drive them all
{
  const R = base.getRoot(), scenes = R.listScenes(), main = scenes.find(s => s.getName() === 'Knight'), byName = {};
  const walk = (n, f) => { f(n); n.listChildren().forEach(c => walk(c, f)); };
  main.listChildren().forEach(c => walk(c, n => { if (!n.getMesh()) byName[n.getName()] = n; }));
  const kSkin = R.listNodes().find(n => n.getName() === 'Knight_Body').getSkin(), rigNode = byName.Rig || main.listChildren()[0];
  for (const sc of scenes) {
    if (sc === main) continue;
    const meshes = []; sc.listChildren().forEach(c => walk(c, n => { if (n.getMesh()) meshes.push(n); }));
    const skins = new Map(); // one new skin per old one, on the Knight's bones
    for (const n of meshes) {
      const par = n.listParents().find(p => p.propertyType === 'Node') || null;
      if (n.getSkin()) {
        const sk = n.getSkin(), joints = sk.listJoints().map(j => byName[j.getName()]);
        if (joints.some(j => !j)) throw new Error('joint missing for ' + n.getName());
        let ns = skins.get(sk); if (!ns) { ns = base.createSkin(sc.getName()).setInverseBindMatrices(sk.getInverseBindMatrices()); joints.forEach(j => ns.addJoint(j)); skins.set(sk, ns); }
        n.setSkin(ns); (par || sc).removeChild(n); rigNode.addChild(n);
      } else { const to = byName[par.getName()]; if (!to) throw new Error('bone missing for ' + n.getName()); par.removeChild(n); to.addChild(n); }
    }
    sc.dispose();
  }
  main.setName('Hero'); R.setDefaultScene(main);
  const keep = new Set(); main.listChildren().forEach(c => walk(c, n => keep.add(n)));
  for (const n of R.listNodes()) if (!keep.has(n)) n.dispose();
}
for (const a of base.getRoot().listAnimations()) if (!ANIMS.includes(a.getName())) a.dispose();
// only the bones that bend the mesh are animated: IK and control bones, scale tracks, and
// translation on anything but the hips go, and so do tracks that never move off the rest pose
const near = (x, y) => x.every((v, i) => Math.abs(v - y[i]) < 1e-3);
for (const a of base.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  const n = ch.getTargetNode(), path = ch.getTargetPath(), nm = n?.getName() || '', out = ch.getSampler().getOutput(), k = out.getElementSize();
  let drop = !n || /IK|control/.test(nm) || path === 'scale' || (path === 'translation' && nm !== 'hips');
  if (!drop) { const rest = path === 'rotation' ? n.getRotation() : n.getTranslation(); drop = true; for (let i = 0; i < out.getCount(); i++) if (!near(out.getElement(i, []), rest)) { drop = false; break; } }
  if (drop) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
}
for (const t of base.getRoot().listTextures()) t.dispose();
// one buffer
const buf = base.getRoot().listBuffers()[0]; for (const b of base.getRoot().listBuffers().slice(1)) { for (const a of base.getRoot().listAccessors()) if (a.getBuffer() === b) a.setBuffer(buf); b.dispose(); }
await base.transform(resample({ tolerance: 1e-3 }), dedup(), prune({ keepAttributes: true }));
await io.write(out, base);
// a second pass drops the accessors the merge left behind with nothing using them
const fin = await io.read(out);
for (const a of fin.getRoot().listAccessors()) if (a.listParents().every(p => p === fin.getRoot())) a.dispose();
await io.write(out, fin);
console.log('wrote', out);
