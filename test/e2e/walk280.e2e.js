// 2.80 movement core (feedback F3): KayKit hero with your cosmetics, the new controller
// (accelerate, sprint with stamina, jump, roll, swim, collisions, door), villagers on the
// same pack, and recorded sounds.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/walk280.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47931' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  await p.route('https://api.open-meteo.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:47931/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true;
    D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; hxState().road.push('2,-1', '3,-1', '3,-2', '1,-1', '0,-1'); save(); view = 'islands'; ui.isTab = 'personal'; render(); });
  await until(() => typeof HX3 === 'object' && !!HX3.kit);
  // villagers
  ok(await until(() => HX3.vil?.list.length >= 2 && HX3.vil.list.every(v => v.H?.mixer)), '1. villagers are animated characters from the pack');
  ok(await until(() => HX3.vil.list.some(v => v.H.cur === 'Walking_A')), '1b. and they walk with a real walk animation');
  // walk mode
  ok(await p.$('[data-wk="on"]') !== null, '2. the island has a Walk button');
  await p.click('[data-wk="on"]');
  ok(await until(() => WK.on && WK.H), '2b. walk mode starts with your character');
  ok(await p.evaluate(() => { let sk = 0, head = 0; WK.H.root.traverse(o => { if (o.isSkinnedMesh) sk++; }); WK.H.P.head.traverse(o => { if (o.isMesh) head++; }); return sk >= 5 && head > 10; }), '3. a rigged body with your own head, face and hair on it');
  const spec = await p.evaluate(() => { const s = pfSpec(); const H = heroMake({ spec: { ...s, hat: 'hat_crown', extra: 'x_cape' }, outfit: 'Mage', gear: { Helm: '#868e96', Boots: '#ae3ec9' } }); let n = 0; H.P.head.traverse(o => { if (o.isMesh) n++; }); const r = { n, cape: H.P.chest.children.length > 0, outfit: H.outfit }; H.dispose(); return r; });
  ok(spec.n > 10 && spec.cape && spec.outfit === 'Mage', '3b. hats, extras and gear go on the new character (' + JSON.stringify(spec) + ')');
  ok(await p.evaluate(() => ['Knight', 'Barbarian', 'Mage', 'Rogue'].every(o => heroMake({ outfit: o })?.outfit === o) && heroOutfitOf('guardian') === 'Knight' && heroOutfitOf('sage') === 'Mage'), '3c. four outfits, picked by class');
  const st = () => p.evaluate(() => ({ x: WK.x, z: WK.z, y: WK.y, sp: WK.sp || 0, a: WK.H.cur, st: WK.stam, g: WK.ground, sw: WK.swim, d: Math.hypot(WK.x, WK.z) }));
  const s0 = await st();
  await p.keyboard.down('s'); await sleep(250); const s1 = await st();
  ok(s1.sp > 0 && s1.sp < 2.7, `4. you speed up smoothly (${s1.sp.toFixed(2)} after a moment)`);
  await sleep(1500); await p.keyboard.down('Shift'); await sleep(1500); const s2 = await st();
  ok(s2.st < 100 && s2.a === 'Running_B', `5. Shift sprints and uses stamina (${Math.round(s2.st)})`);
  await p.keyboard.press(' '); await sleep(120); const s3 = await st();
  ok(!s3.g && s3.y > s0.y, '6. Space jumps');
  ok(await until(() => WK.ground, null, 30), '6b. and you land');
  await p.keyboard.up('Shift'); await p.keyboard.up('s'); await sleep(1200);
  ok((await st()).sp < .3 && (await st()).a === 'Idle', '7. you slow to a stop and stand idle');
  await p.keyboard.press('Control'); await sleep(100);
  ok(await p.evaluate(() => WK.roll > 0 && WK.H.cur === 'Dodge_Forward'), '8. Ctrl rolls');
  // buildings are solid: walk straight at the hall from its door side
  const hall = await p.evaluate(async () => { const [hx, hz] = hxPos(0, 0); WK.roll = 0; WK.x = hx; WK.z = hz + 2.4; WK.vx = WK.vz = 0; WK.cy = 0; WK.face = Math.PI; WK.cool = 0; WK.minD = 9; window.__opened = null; const o = hxOpen; hxOpen = id => { window.__opened = id; }; WK.__o = o; return [hx, hz]; });
  await p.keyboard.down('w');
  for (let i = 0; i < 12; i++) { await sleep(200); await p.evaluate(h => { WK.minD = Math.min(WK.minD, Math.hypot(WK.x - h[0], WK.z - h[1])); }, hall); }
  await p.keyboard.up('w');
  const md = await p.evaluate(() => WK.minD);
  ok(md > .9 && md < 1.6, `9. you walk up to the hall but can't walk through it (closest ${md.toFixed(2)} from its middle)`);
  ok(await p.evaluate(() => !!window.__opened), '9b. walking into it opens its window');
  await p.evaluate(() => { hxOpen = WK.__o; });
  // water: swim in the river
  const w = await p.evaluate(() => { const L = hxW(hxState()).land(); for (const [k, h] of L) if (h.t === 'river') { const [x, z] = hxPos(...hxQR(k)); if (wkWet(x, z) != null) return { x, z }; } return null; });
  if (w) { await p.evaluate(w => { WK.x = w.x; WK.z = w.z; }, w); ok(await until(() => WK.swim && WK.y < 0, null, 20), '10. you swim in the river'); }
  else ok(true, '10. (no river on this island)');
  // sounds
  await p.evaluate(() => { sndCtx(); sfx('click'); });
  ok(await until(() => Object.keys(SND_BUF).length > 40, null, 40), '11. recorded sounds load');
  ok(await p.evaluate(() => { const c = sfxReady('walk'); return !!c && sndPlay(c, SFX_SURF.stone, .5) && sndPlay(c, SFX_REC.swing[0], .5); }), '11b. footsteps and sword swings play from recordings');
  // off again
  await p.keyboard.press('v');
  ok(await until(() => !WK.on, null, 10), '12. V goes back to the builder view');
  await p.screenshot({ path: S + '/walk280.png' });
  ok(!errs.length, '13. no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); app.kill();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
