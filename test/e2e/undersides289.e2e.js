// 2.89: island undersides and far islands (island-undersides/plan.md). Usage: build the app into DIR/LifePlanner
// (go build -tags noseed) with DIR/data, then: node test/e2e/undersides289.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47933' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1300, height: 820 }, timezoneId: 'Australia/Melbourne' });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 22, weather_code: 0, cloud_cover: 5, precipitation: 0, wind_speed_10m: 8 } }) }));
  await p.goto('http://127.0.0.1:47933/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const shot = n => p.screenshot({ path: S + '/' + n + '.png' });
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove());
      ui.clsSeen = true; D.settings.setupDone = true; D.settings.gfxMed = false; D.settings.lowQuality = false; D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game'];
      const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id;
      const st = hxState(); for (const [k, id] of [['3,0', 'cottage'], ['4,-2', 'well'], ['2,2', 'windmill']]) st.b[k] = { id, rot: 0, start: '2000-01-01', ready: '2000-01-01', t: 0 };
      hxIsleOn = () => true; hxIsleList = () => { }; HX_ISLE.list = [{ uid: 'u1', n: 'Sam', ut: '1', d: JSON.stringify({ th: 'snow', b: {} }) }, { uid: 'u2', n: 'Kai', ut: '1', d: '{}' }];
      save(); view = 'islands'; ui.isTab = 'personal'; render(); });
    for (let i = 0; i < 60 && !(await ev(() => !!HX3.kit && HX3.sig)); i++) await sleep(500);
    await sleep(800);
    const und = () => ev(() => { const u = IS3.world.getObjectByName('underside'); if (!u) return null; let meshes = 0, falls = 0, f2 = 0, pts = 0; u.traverse(o => { if (o.isMesh) meshes++; if (o.material === US.mats.fall) falls++; if (o.material === US.mats.fall2) f2++; if (o.isPoints) pts++; }); return { meshes, falls, f2, pts, ticks: HX3.anim.filter(a => a.fn === u.userData.tick).length }; });
    // 1. your island
    const home = await und();
    ok(home && home.meshes >= 8 && home.meshes < 60, '1. your island has the new underside, merged into a few meshes ' + JSON.stringify(home));
    ok(home && home.falls >= 2, '2. waterfalls pour off where the river reaches the edge ' + home?.falls);
    ok(home && home.pts === 1 && home.ticks === 1, '3. motes drift and it animates in the island loop');
    ok(await ev(() => { const g = usGlowFor(''); return g === US_SEASON[hxSeason()]; }) && await ev(() => usGlowFor('snow')[0] === US_SEASON.winter[0]), '4. the glow follows the season, or your island look');
    const t0 = await ev(() => US.tex.fall.offset.y); await sleep(400);
    ok(await ev(t0 => US.tex.fall.offset.y !== t0, t0), '5. the water moves');
    await ev(() => { IS3.yaw = .6; IS3.pitch = .25; IS3.dist = 60; is3draw(); }); await sleep(600); await shot('us-home');
    // 2. far islands: each type looks different, each on its own underside
    const far = await ev(() => FA.pick.map(o => { const f = o.userData.fa; let u = 0, kit = 0; o.traverse(x => { if (x.name === 'underside') u++; if (x.isMesh && x.material === HX3.kit.mat) kit++; }); return { id: f.id, kind: f.kind, th: f.th || '', u, kit }; }));
    ok(far.length === 4 && far.every(f => f.u === 1), '6. every far island has an underside ' + JSON.stringify(far.map(f => f.id)));
    ok(far.find(f => f.id === 'mate:u1')?.th === 'snow', '7. a housemate\'s island carries their island look');
    ok(await ev(() => { const o = FA.pick.find(o => o.userData.fa.id === 'house'); let walls = 0; o.traverse(x => { if (x.isMesh && x.material === US.mats.rock && x.geometry.attributes.position.count > 400) walls++; }); return walls >= 2; }), '8. the fortress has walls round it');
    // 3. the house fortress: stone, spikes and a chain with a lantern; the rocky look makes it darker
    await ev(() => { HI.doc = HI.doc || { b: {}, c: {} }; ui.isTab = 'house'; render(); }); await sleep(2500);
    const col = () => ev(() => { const u = IS3.world.getObjectByName('underside'); let c = null; u.traverse(o => { if (!c && o.isMesh && o.material === US.mats.rock) { const a = o.geometry.attributes.color; c = [a.getX(0), a.getY(0), a.getZ(0)]; } }); return c; });
    const c1 = await col();
    ok(await ev(() => IS3.house === 'hexh' && !!IS3.world.getObjectByName('underside')), '9. the house island has the underside too');
    await ev(() => { ui.sgLkPv = 'fortress'; render(); }); await sleep(2000);
    const c2 = await col();
    ok(c1 && c2 && c2[0] + c2[1] + c2[2] < c1[0] + c1[1] + c1[2], '10. the rocky fortress look makes the rock darker ' + JSON.stringify([c1, c2]));
    await ev(() => { IS3.yaw = .6; IS3.pitch = .25; IS3.dist = 80; is3draw(); }); await sleep(600); await shot('us-fort');
    await ev(() => { ui.sgLkPv = null; });
    // 4. the boss island: dark, cracked, lava dripping
    await ev(() => { ui.isTab = 'boss'; render(); }); await sleep(2500);
    ok(await ev(() => { const u = IS3.world.getObjectByName('underside'); let lava = 0; u.traverse(o => { if (o.material === US.mats.lava) lava++; }); return lava > 0 || !!hsFight(hsState().id)?.dead; }), '11. lava drips from the boss island');
    ok(await ev(() => US_LOOP.raf > 0), '12. the boss island animates its underside');
    await ev(() => { IS3.yaw = .6; IS3.pitch = .25; IS3.dist = 45; is3draw(); }); await sleep(600); await shot('us-boss');
    // 5. Low graphics: no waterfalls, motes or moving parts, plain far islands
    await ev(() => { D.settings.lowQuality = true; ui.isTab = 'personal'; render(); }); await sleep(2500);
    const lo = await und();
    ok(lo && lo.falls === 0 && lo.pts === 0, '13. Low: no waterfalls or motes ' + JSON.stringify(lo));
    ok(await ev(() => FA.pick.every(o => { let k = 0; o.traverse(x => { if (x.isMesh && x.material === HX3.kit.mat) k++; }); return k === 0; })), '14. Low: far islands keep the simple look');
    // 6. Medium sits in between
    await ev(() => { D.settings.lowQuality = false; D.settings.gfxMed = true; render(); }); await sleep(2500);
    const md = await und();
    ok(md && md.falls >= 2 && md.f2 === 0 && home.f2 > 0 && md.meshes < home.meshes && md.pts === 1, '15. Medium: simpler waterfalls and fewer parts, still animated ' + JSON.stringify(md));
    await ev(() => { D.settings.gfxMed = false; render(); }); await sleep(800);
    ok(!errs.length, '16. no page errors' + (errs.length ? '\n' + errs.join('\n') : ''));
  } catch (e) { fails++; console.log('FAIL (threw) ' + e.message); }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
