// 2.84 (feedback round 2, R2): Quaternius characters everywhere, somersault roll, class combos, hit feel,
// refunded looks. Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then:
// node test/e2e/hero284.e2e.js DIR

const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47934' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  await p.route('https://api.open-meteo.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:47934/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
      D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; ui.clsSeen = true; save(); localStorage.setItem('solisDev', '1'); });
    // 1. the refund: a bought look the new character can't show is paid back once and swapped
    const ref = await ev(() => {
      D.arena.heroRefund = 0; D.arena.owned = { ...(D.arena.owned || {}), h_spiky: '2026-01-01' }; D.arena.av = { ...myAv(), hair: 'h_spiky' };
      const w0 = cdWallet(), price = cos('h_spiky').price; heroRefund(); const w1 = cdWallet(); heroRefund(); const w2 = cdWallet();
      return { got: (w1.lumen - w0.lumen) + (w1.ember - w0.ember), want: (price.l || 0) + (price.e || 0), once: w2.lumen === w1.lumen && w2.ember === w1.ember, hair: myAv().hair, owned: !!D.arena.owned.h_spiky };
    });
    ok(ref.got === ref.want && ref.want > 0, `1. a gone look is refunded (${ref.got} of ${ref.want})`);
    ok(ref.once && ref.hair === 'h_short' && !ref.owned, '1b. only once, and you wear the nearest free look');
    ok(await ev(() => pfGrid('hair', myAv(), pfSpec()).indexOf('h_spiky') < 0 && cosShop().every(c => !heroGone(c.id))), '1c. gone looks are out of the picker and the shop');
    // 2. the You page: the new character, body A/B, matching hair
    await ev(() => { ui.youTab = 'me'; view = 'profile'; render(); });
    ok(await until(() => AV3.hero && AV3.hero.root.parent), '2. the You page shows the Quaternius character');
    ok(await ev(() => HERO.gltf.animations.some(a => a.name === 'Roll') && HERO.gltf.animations.some(a => a.name === 'Sword_Regular_A') && HERO.gltf.animations.length >= 40), '2b. Universal Animation Library clips loaded');
    const bodies = await ev(() => ['m', 'f'].map(b => { const H = heroMake({ spec: { ...avatarSpec(), look: { ...myLook(), body: b } }, outfit: 'Rogue' }); const r = H.body; H.dispose(); return r; }));
    ok(bodies[0] === 'm' && bodies[1] === 'f', '2c. 3D body A and B');
    ok(await ev(() => { setLook('body', 'f'); return myLook().body === 'f' && /3D body/.test(lookEditor()); }), '2d. the look editor has a 3D body choice');
    const kits = await ev(() => ['Knight', 'Barbarian', 'Mage', 'Rogue'].map(o => { const H = heroMake({ outfit: o, props: true }); const r = [o, Object.keys(H.weapons).sort().join('')]; H.dispose(); return r.join(':'); }).join(' '));
    ok(kits === 'Knight:lr Barbarian:r Mage:lr Rogue:lr', '2e. each class holds its weapons ' + kits);
    // 3. the fight: somersault roll and class combos
    await ev(() => { soOpen('test'); }); await sleep(300); await p.click('[data-so="go"]');
    ok(await until(() => SO && !SO.intro && SO.R && SO.H && SO.trail), '3. the fight starts with the new character and a swing trail');
    await ev(() => { SO.B.stag = 999; cancelAnimationFrame(SO.raf); soLoop = () => { }; SO.R.render = () => { };
      window.adv = sec => { for (let t = 0; t < sec; t += 1 / 60) { if (SO.stop > 0) SO.stop -= 1 / 60; else soStep(1 / 60); soDraw(SO.time, 1 / 60); } }; });
    const roll = await ev(() => { const M = SO.me; Object.assign(M, { x: 0, z: 7, face: 0, act: null, st: 100 }); SO.keys = {}; soAct('roll'); adv(.1); const cur = SO.H.cur; adv(.9); return { d: M.z - 7, cur, done: !M.act }; });
    ok(roll.d > 2.3 && roll.d < 3.3 && roll.cur === 'Roll' && roll.done, `3b. Ctrl does a short somersault (${roll.d.toFixed(2)} m)`);
    const cancel = await ev(() => { const M = SO.me; M.act = null; M.st = 100; soAct('roll'); adv(.3); soAct('light'); const early = M.act.k; adv(.4); soAct('light'); return [early, M.act?.k]; });
    ok(cancel[0] === 'roll' && cancel[1] === 'light', '3c. no attacking mid-roll, but you can from the get-up');
    const combo = await ev(() => ['Knight', 'Barbarian', 'Mage', 'Rogue'].map(o => {
      SO.outfit = o; const M = SO.me, B = SO.B; Object.assign(B, { x: 0, z: -4, state: 'recover', t: 99, stuck: 0, face: 0 }); Object.assign(M, { x: 0, z: -1, face: Math.PI, act: null, chain: 0, chainT: 0 });
      const clips = []; const d0 = SO.dealt; SO.projs = [];
      for (let i = 0; i < 4; i++) { M.st = 100; soAct('light'); if (M.act) clips.push(M.act.def.c); for (let n = 0; M.act && n < 200; n++) adv(1 / 60); }
      adv(.6); return { o, clips, dealt: SO.dealt - d0, bolts: o === 'Mage' ? clips.length : 0 };
    }));
    const by = Object.fromEntries(combo.map(c => [c.o, c]));
    ok(by.Knight.clips.slice(0, 3).join() === 'Sword_Regular_A,Sword_Regular_B,Sword_Regular_C', '3d. Knight: three sword cuts ' + by.Knight.clips);
    ok(by.Barbarian.clips[0] === 'Sword_Attack' && by.Barbarian.clips[1] === 'Sword_Regular_C' && by.Barbarian.clips[2] === 'Sword_Attack', '3e. Barbarian: two big swings ' + by.Barbarian.clips);
    ok(by.Mage.clips.every(c => /^Spell/.test(c)) && by.Mage.dealt > 0, '3f. Mage: staff bolts that hit from range ' + by.Mage.dealt);
    ok(by.Rogue.clips.length === 4 && new Set(by.Rogue.clips).size === 4, '3g. Rogue: four fast dagger cuts ' + by.Rogue.clips);
    ok(combo.every(c => c.dealt > 0), '3h. every class deals damage ' + combo.map(c => c.dealt));
    // 4. hit feel: hit-stop, camera kick, sparks
    const feel = await ev(() => { SO.outfit = 'Knight'; const M = SO.me, B = SO.B; Object.assign(B, { x: 0, z: -4, state: 'recover', t: 99 }); Object.assign(M, { x: 0, z: -1, face: Math.PI, act: null, chain: 0, st: 100 }); SO.parts.forEach(q => SO.S.remove(q.sp)); SO.parts = [];
      soAct('light'); let stop = 0, kick = 0, parts = 0; for (let i = 0; i < 40; i++) { if (SO.stop > 0) SO.stop -= 1 / 60; else soStep(1 / 60); soDraw(SO.time, 1 / 60); stop = Math.max(stop, SO.stop); kick = Math.max(kick, SO.kick); parts = Math.max(parts, SO.parts.length); } return { stop, kick, parts, tex: Object.keys(SO_TEX).length }; });
    ok(feel.stop > .04 && feel.kick > 0, `4. a hit freezes for a moment and kicks the camera (${feel.stop.toFixed(3)} s)`);
    ok(feel.parts >= 3 && feel.tex >= 3, `4b. sparks and stone chips fly (${feel.parts} sprites)`);
    ok(await ev(() => { SO.parts.forEach(q => SO.S.remove(q.sp)); SO.parts = []; soBolt({ n: 5, school: 'light', size: 1 }); adv(.05); return SO.parts.length > 0 && SO.projs.length === 1 && SO.projs[0].m?.isSprite; }), '4c. spells fly as glowing particle bolts');
    await ev(() => { soEnd('quit'); }); await sleep(300); await ev(() => soClose());
    // 5. the island walk rolls with the same somersault
    ok(await ev(() => WK_C.roll.time > .7 && WK_C.roll.speed * WK_C.roll.time * .65 < 3.2), '5. island roll is a short somersault too');
  } catch (e) { fails++; console.log('ERR', e); }
  ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
