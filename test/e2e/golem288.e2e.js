// 2.88: a bulkier, faster, less predictable Somnus; armoured outside its openings; fire-lit arena; grunts; the boss island.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/golem288.e2e.js DIR

const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47931' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47931/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const shot = n => p.screenshot({ path: S + '/' + n + '.png' });
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; save();
      soGolemWeek = () => true; ftState().att = {}; ftState().bonus = {}; delete ftState().soIntroSeen; const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id; save(); });
    // 1. serious names on the boss island
    await ev(() => { localStorage.setItem('solisDev', '1'); ui.isTab = 'boss'; ui.isPanel = null; view = 'islands'; render(); }); await sleep(900);
    ok(await ev(() => hsBossName(HS_BOSSES[2]) === 'Somnus, the Sleeping Colossus' && HS_BOSSES[2].n === 'Snooze Golem'), '1. Snooze Golem shows as Somnus, the Sleeping Colossus (saved key unchanged)');
    // 2. the intro card, then the cinematic
    await p.click('.is-br [data-so="house"]'); await sleep(400);
    ok(await ev(() => SO?.intro && /Somnus/.test(document.querySelector('.so-intro').textContent) && !document.querySelector('.so-intro .so-keys')), '2. intro card: Somnus, controls moved to the pause menu');
    await p.click('[data-so="go"]');
    ok(await until(() => SO && SO.cine && SO.R && SO.gs), '2b. the fight opens on the intro with the rigged Golem');
    ok(await ev(() => SO.gs.plates.length > 25 && !!SO.gs.bone('hand_r') && SO.gs.cur === 'Crouch_Idle_Loop'), '2c. Somnus is stone plates on the animation rig, asleep (' + await ev(() => SO.gs.plates.length) + ' plates)');
    const ht = await ev(() => { SO.gs.root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(SO.gs.root); return bb.max.y - bb.min.y; });
    ok(ht > 3.5 && ht < 8.5, '2d. a big, sensible size crouched ' + ht.toFixed(2));
    await sleep(600); await shot('g-cine1');
    await p.keyboard.press('x'); await sleep(200);
    ok(await ev(() => !!SO.cine), '2e. the first time, the intro cannot be skipped');
    ok(await until(() => SO.B.state === 'roar' && SO.gs.cur === 'Sword_Attack', null, 80), '2f. it stands and roars'); await shot('g-cine-roar');
    ok(await until(() => document.querySelector('.so-title.on')?.textContent.includes('Somnus'), null, 60), '2g. its name across the screen'); await sleep(500); await shot('g-cine-title');
    ok(await until(() => !SO.cine, null, 60), '2h. the intro ends and the fight begins'); await sleep(800); await shot('g-start');
    ok(await ev(() => ftState().soIntroSeen === 1 && document.getElementById('soov').classList.contains('bar-in')), '2i. intro marked seen, boss bar slid in');
    // the test hero can't die while we look at things
    await ev(() => { window._soEnd = soEnd; soEnd = how => { if (how === 'dead') { SO.P.hp = SO.P.max; return; } _soEnd(how); }; });
    // 3. tuning
    ok(await ev(() => SO.me.pots === 2 && SO_C.st.roll === 35 && SO_C.st.regen === 20 && Math.abs(SO_C.roll.iTo - SO_C.roll.iFrom - .2) < .001), '3. 2 potions, rolls cost 35, regen 20/s, 0.2 s i-frames');
    ok(await ev(() => SO_MV.punch.w <= .3 && SO_MV.punch.d >= .3 && SO_MV.slam.d >= .5 && SO_MV.leap.d >= .6), '3b. faster wind-ups, light hits ~30%, slams 50%+');
    const tired = await ev(() => { const M = SO.me; SO.B.stag = 999; M.act = null; M.st = 100; soAct('roll'); const c1 = 100 - M.st, f1 = M.act.far; for (let i = 0; i < 50 && M.act; i++) { SO.time += 1 / 60; M.actT += 1 / 60; soActStep(M, 1 / 60); } M.act = null; const s0 = M.st; soAct('roll'); return [c1, Math.round(s0 - M.st), f1, M.act.far, M.iTo - M.iFrom]; });
    ok(tired[0] === 35 && tired[1] > 35 && tired[3] < 1 && tired[4] < .2, '3c. a quick second roll is dearer and shorter ' + tired.map(x => +x.toFixed(2)));
    const noChain = await ev(() => { const M = SO.me; M.act = null; M.st = 100; soAct('roll'); M.actT = .7; const a = M.act; soAct('roll'); return M.act === a; });
    ok(noChain, '3d. a roll cannot be cancelled into another roll');
    // 4. phases by this fight's bar
    const ph = await ev(() => { SO.B.stag = 0; const r = []; for (const f of [.35, .65, .9]) { SO.dealt = SO.fhp * f; r.push(soPhase()); } SO.dealt = 0; return r; });
    ok(ph.join() === '1,2,3', '4. phases at 70/40/15% of this fight\'s health ' + ph + ' (bar ' + await ev(() => SO.fhp) + ')');
    const roar = await ev(() => { SO.lastPh = 0; SO.dealt = SO.fhp * .35; SO.B.state = 'idle'; SO.B.stag = 0; soBossStep(1 / 60); const r = SO.B.state; SO.dealt = 0; SO.lastPh = 0; return r; });
    ok(roar === 'roar', '4b. a new phase starts with a roar');
    // 5. aiming: crosshair, right click aims, bolts fly straight where it points
    ok(await ev(() => !!document.querySelector('.so-cross')), '5. a crosshair on screen');
    await ev(() => { SO.aim = true; }); await sleep(500);
    ok(await ev(() => SO.aimK > .8 && SO.cam3.fov < 50 && document.querySelector('.so-cross.aim')), '5b. aiming zooms over the shoulder');
    await shot('g-aim');
    // turn away from the Golem: a bolt must miss (no homing)
    const miss = await ev(async () => { Object.assign(SO.B, { x: 0, z: -4, state: 'idle', stag: 999 }); Object.assign(SO.me, { x: 0, z: 6, act: null }); SO.cam.cy = Math.PI / 2; SO.cam.cp = .1; await new Promise(r => setTimeout(r, 300)); soDraw(performance.now() / 1000, 0); const d0 = SO.dealt; soBolt({ n: 50, size: 1, school: 'staff' }); for (let i = 0; i < 120; i++) soProjStep(1 / 60); return SO.dealt - d0; });
    ok(miss === 0, '5c. a bolt aimed away from the Golem misses (no homing)');
    const hitIt = await ev(async () => { SO.cam.cy = 0; SO.cam.cp = .05; await new Promise(r => setTimeout(r, 300)); soDraw(performance.now() / 1000, 0); const ch = soBody().parts[2]; SO.cam3.lookAt(ch.x, ch.y, ch.z); SO.cam3.updateMatrixWorld(); const d0 = SO.dealt; soBolt({ n: 50, size: 1, school: 'staff' }); for (let i = 0; i < 120; i++) soProjStep(1 / 60); return SO.dealt - d0; });
    ok(hitIt > 0, '5d. aimed at it, the bolt hits ' + hitIt);
    const back = await ev(async () => { Object.assign(SO.me, { x: 0, z: -11 }); SO.B.face = 0; SO.cam.cy = Math.PI; SO.cam.cp = .02; SO.weakSeen = 1; await new Promise(r => setTimeout(r, 900)); const pt = soAimPoint(), cr = soBody().crystal; return [pt.distanceTo(new THREE.Vector3(cr.x, cr.y, cr.z)), cr.y]; });
    const weak = await ev(async () => { const cr = soBody().crystal, cam = SO.cam3; cam.lookAt(cr.x, cr.y, cr.z); cam.updateMatrixWorld(); const w0 = SO.stats.weak; const p0 = { s: undefined, n: 50, school: 'staff', size: 1, t: 0, x: 0, y: 0, z: 0 }; SO.projs.push(p0); const o = soAimPoint; soAimPoint = () => new THREE.Vector3(cr.x, cr.y, cr.z); soProjStep(1 / 60); soAimPoint = o; for (let i = 0; i < 90; i++) soProjStep(1 / 60); return SO.stats.weak - w0; });
    ok(weak === 1, '5e. a shot into the back crystal is a weak-point hit (aim point ' + back[0].toFixed(1) + ' from it)');
    const face = await ev(() => { const M = SO.me; M.act = null; M.st = 100; SO.cam.cy = 1; M.face = 0; soAct('light'); return Math.abs(soAng(M.face - (1 + Math.PI))) < .01; });
    ok(face, '5f. attacks go where the camera faces (no turning towards the Golem)');
    await ev(() => { SO.aim = false; SO.me.act = null; Object.assign(SO.me, { x: 0, z: 6 }); SO.cam.cy = 0; SO.cam.cp = .32; }); await sleep(300);
    // 6. the timer over your head
    const tm = await ev(() => { const el = document.querySelector('.so-ptime'), r = el.getBoundingClientRect(); return [el.textContent, r.top, r.left]; });
    ok(/^\d:\d\d$/.test(tm[0]) && tm[1] > 100 && tm[1] < 600, '6. the clock floats over your hero ' + tm);
    await ev(() => { SO.time = SO_TIME - 20; }); await sleep(200);
    ok(await ev(() => document.querySelector('.so-ptime').classList.contains('warn')), '6b. orange in the last 30 s');
    await ev(() => { SO.time = SO_TIME - 5; }); await sleep(200);
    ok(await ev(() => document.querySelector('.so-ptime').classList.contains('crit')), '6c. red in the last 10 s');
    await ev(() => { SO.shared = null; SO.time = 20; });
    // 7. each move plays its clip and lands hits
    let clips = 0;
    for (const k of ['punch', 'slam', 'sweep', 'wave', 'roll', 'alarm', 'march', 'leap', 'stomp', 'spin', 'throw', 'charge', 'quake']) {
      await ev(k => { soClearTele(); const B = SO.B; SO.dealt = SO.fhp * (['march', 'leap', 'quake'].includes(k) ? .9 : ['charge'].includes(k) ? .55 : .35); SO.lastPh = soPhase(); Object.assign(B, { x: 0, z: -4, y: 0, state: 'idle', queue: [k], cool: {}, t: 0, stag: 0, face: 0 }); SO.me.x = 0; SO.me.z = ['roll', 'leap', 'throw', 'charge', 'quake'].includes(k) ? 6 : -1; SO.me.y = 0; SO.P.hp = SO.P.max; SO.me.act = null; SO.me.iTo = -1; SO.me.block = false; }, k);
      const seen = await until(k => { if (!window._seenT) { window._seen = new Set(); window._seenT = setInterval(() => { if (SO?.gs) { _seen.add(SO.gs.cur); _seen.add(SO.B.state); } }, 5); } return _seen.has(SG_MOVE[k].c) || (k === 'charge' && _seen.has('charge')); }, k, 24); if (seen) clips++; else console.log('  no clip for ' + k);
      await ev(() => { window._clips = []; });
      if (['punch', 'slam', 'alarm', 'leap', 'spin', 'throw', 'charge', 'quake'].includes(k)) await shot('g-' + k);
      await sleep(1500);
    }
    ok(clips >= 10, '7a. each move plays its own animation (' + clips + '/13; a feint can swap one for another)');
    ok(await ev(() => SO.stats.hurt >= 7 && !SO.over), '7. the Golem lands hits (' + await ev(() => SO.stats.hurt) + ')');
    const dmg = await ev(() => { soEnd = _soEnd; SO.P.hp = SO.P.max; const P = SO.P, M = SO.me; M.act = null; M.iTo = -1; M.block = false; P.shield = 0; P.hp = P.max; SO.dealt = 0; soHurtBy({ ...SO_MV.slam, k: 'slam' }); const a = 1 - P.hp / P.max; P.hp = P.max; M.act = null; soHurtBy({ ...SO_MV.punch, k: 'punch' }); const b2 = 1 - P.hp / P.max; P.hp = P.max; return [a, b2]; });
    ok(dmg[0] > .4 && dmg[1] > .2, '7b. a slam takes ' + Math.round(dmg[0] * 100) + '%, a punch ' + Math.round(dmg[1] * 100) + '% of your health');
    // 8. sounds: the recorded fight set loads and plays
    const snd = await ev(async () => { sndCtx(); await SND.ctx.resume(); sndLoad(SND.ctx); await sndBufLoad; return ['g_roar', 'g_boom0', 'g_step0', 'g_clang0', 'g_crumble0', 'g_hurt0', 'g_hurtm1', 'g_hurth0', 'g_fire0', 'g_rise', 'g_title', 'g_quake'].filter(n => SND_BUF[n]).length; });
    ok(snd === 12, '8. the fight sound set loads, with the new grunts and intro sounds (' + snd + '/12)');
    // 8b. no more yell when you're hit: a grunt by how hard
    const gr = await ev(() => { const got = []; const o = soSnd; soSnd = (n, a, x) => { got.push(n); }; const P = SO.P, M = SO.me; for (const d of [.1, .3, .6]) { P.hp = P.max; M.act = null; M.iTo = -1; M.block = false; soHurtBy({ d, k: 'x' }); } soSnd = o; P.hp = P.max; return got; });
    ok(gr.join() === 'g_hurt,g_hurtm,g_hurth' && !gr.includes('g_pain'), '8b. hurt grunts get heavier with the damage: ' + gr);
    // 8c. armoured outside its openings: barely a scratch; in an opening, the full hit
    const arm = await ev(() => { const B = SO.B; SO.me.reveal = 0; SO.me.emp = 0; SO.me.buff = 1; SO.me.rally = 0; B.mark = 0; B.stuck = 0; B.stag = 0; Object.assign(B, { state: 'wind', atk: { k: 'punch', w: 1 }, t: 1, guard: false }); const d0 = SO.dealt; soHit(100, { weakHit: false }); const a = SO.dealt - d0; B.state = 'recover'; B.guard = false; B.t = 1; const d1 = SO.dealt; soHit(100, { weakHit: false }); const b2 = SO.dealt - d1; B.guard = true; const d2 = SO.dealt; soHit(100, { weakHit: false }); return [a, b2, SO.dealt - d2]; });
    ok(arm[0] <= 12 && arm[1] >= 100 && arm[2] <= 12, '8c. armoured hit ' + arm[0] + ', exposed hit ' + arm[1] + ', between combo hits ' + arm[2]);
    ok(await ev(() => { SO.B.state = 'recover'; SO.B.guard = false; soHudTick(); return document.querySelector('.so-boss').classList.contains('open'); }), '8d. the boss bar shows EXPOSED in an opening');
    // 8e. fire light: torches lit after the intro, real lights, mist
    ok(await ev(() => SO.torches.length === 10 && SO.torches.every(t => t.lit === 1) && SO.torches.filter(t => t.light).length >= 2), '8e. ten torches and braziers, all lit, with real lights (' + await ev(() => SO.torches.filter(t => t.light).length) + ')');
    // 8f. less predictable: 40 picks from the same spot give many different moves and tempos
    const vary = await ev(() => { const B = SO.B, ms = new Set(), ws = new Set(); SO.dealt = SO.fhp * .5; for (let i = 0; i < 40; i++) { B.queue = []; B.cool = {}; Object.assign(B, { x: 0, z: -4, face: 0 }); SO.me.x = 0; SO.me.z = i % 2 ? -.5 : 3; soBossPick(soDist(B, SO.me), soPhase()); ms.add(B.atk.k); ws.add(Math.round(B.atk.w * 20)); soClearTele(); SO.drops.forEach(t => SO.S.remove(t.m)); SO.drops = []; } B.state = 'idle'; return [ms.size, ws.size]; });
    ok(vary[0] >= 7 && vary[1] >= 6, '8f. varied moves (' + vary[0] + ') and tempos (' + vary[1] + ')');
    // 9. plates fall as it weakens; felling this fight's bar ends the run
    const fell = await ev(() => { SO.dealt = SO.fhp * .8; sgAnim(1 / 60, 1); return SO.gs.fallen; });
    ok(fell >= 6, '9. stone plates fall off as it weakens (' + fell + ')');
    await shot('g-hurt');
    await ev(() => { SO.rocks.forEach(r => SO.S.remove(r.m)); SO.rocks = []; SO.fis = []; SO.dealt = SO.fhp + 1; SO.P.hp = SO.P.max; }); await sleep(3200);
    const res = await ev(() => document.querySelector('.so-end')?.textContent || '');
    ok(/COLOSSUS FELLED/.test(res) && await ev(() => SO.gs.cur === 'Death01'), '9b. bringing the bar down fells it');
    await shot('g-felled');
    await p.click('[data-so="close"]'); await sleep(400);
    // 10. the second time, the intro can be skipped
    await ev(() => soOpen('test')); await sleep(200); await p.click('[data-so="go"]'); await until(() => SO && SO.cine);
    await sleep(500); await p.keyboard.press('x'); await sleep(300);
    ok(await ev(() => SO && !SO.cine && SO.B.state !== 'sleep'), '10. after the first time, any key skips the intro');
    await ev(() => { SO.B.stag = 999; SO.aim = true; }); await sleep(1200); await shot('g-aim2');
    ok(await ev(() => Number.isFinite(SO.P.hp)), '10b. health stays a number');
    await ev(() => soEnd('quit')); await sleep(400); await ev(() => soClose());
    // 11. the boss island is Somnus's hall, with the real Golem asleep on its bed
    await ev(() => { const i = HS_BOSSES.indexOf(hsBoss(mondayOf(today()))), j = HS_BOSSES.findIndex(b => b.n === 'Snooze Golem'); [HS_BOSSES[i], HS_BOSSES[j]] = [HS_BOSSES[j], HS_BOSSES[i]]; ui.isTab = 'boss'; ui.isPanel = null; view = 'islands'; IS3.sig = null; render(); }); await sleep(2500);
    ok(await until(() => !!BI_IDLE.gs && BI_IDLE.gs.root.parent && BI_IDLE.fires.length === 2, null, 40), '11. the boss island shows the rigged Somnus asleep, braziers burning');
    await sleep(1500); await shot('g-island');
  } catch (e) { fails++; console.log('ERR', e); }
  ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
