// 2.85 (R7): the real sun. The sun and moon at their real Melbourne positions, light and shadows that
// follow them, a golden sky at sunrise and sunset, water that reflects, and the three graphics levels.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/sun285.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47925' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, timezoneId: 'Australia/Melbourne' });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 22, weather_code: 0, cloud_cover: 5, precipitation: 0, wind_speed_10m: 8 } }) }));
  await p.goto('http://127.0.0.1:47925/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true; D.settings.gfxMed = false; D.settings.lowQuality = false;
    D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 3000, e: 3000 }; c.spent = { l: 0, e: 0 }; delete c.hx; save(); view = 'islands'; ui.isTab = 'personal'; render(); });
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!HX3.kit && HX3.sig)); i++) await sleep(500);
  await sleep(1000);
  // 1. the maths: Melbourne, 16 Nov 2026. Solar noon is about 1:10pm (daylight saving), the sun ~72° up in the north
  const pos = await p.evaluate(() => { const r = 180 / Math.PI, n = hxSunPos(new Date('2026-11-16T02:10:00Z')), m = hxSunPos(new Date('2026-11-15T19:30:00Z')), e = hxSunPos(new Date('2026-11-16T09:00:00Z')), mo = hxMoonPos(new Date('2026-11-24T12:00:00Z')); return { na: n.alt * r, nz: n.az * r, ma: m.alt * r, mz: m.az * r, ea: e.alt * r, ez: e.az * r, lit: mo.lit }; });
  ok(pos.na > 70 && pos.na < 74 && (pos.nz < 8 || pos.nz > 352), `1. midday sun is high in the north (${pos.na.toFixed(1)}° up, az ${pos.nz.toFixed(1)}°)`);
  ok(pos.ma > 0 && pos.ma < 12 && pos.mz > 100 && pos.mz < 125, `2. 6:30am sun is low in the east-south-east (${pos.ma.toFixed(1)}°, az ${pos.mz.toFixed(1)}°)`);
  ok(pos.ea > 0 && pos.ea < 12 && pos.ez > 235 && pos.ez < 260, `3. 8pm sun is low in the west-south-west (${pos.ea.toFixed(1)}°, az ${pos.ez.toFixed(1)}°)`);
  ok(pos.lit > .9, `4. the moon is full on 24 Nov 2026 (${(pos.lit * 100).toFixed(0)}% lit)`);
  // 2. midday, looking north
  const at = (h, yaw) => p.evaluate(([h, yaw]) => { ui.isPanel = 'market'; ui.mkTab = 'looks'; HX_SUN.fakeH = h; render(); hxSkyApply(); if (yaw != null) { IS3.yaw = yaw; IS3.pitch = .5; } is3draw(); }, [h, yaw]);
  await at(13.2, 0); await sleep(900);
  const noon = await p.evaluate(() => ({ y: IS3.sun.position.y, z: IS3.sun.position.z, len: IS3.sun.position.length(), disc: HX_SUN.disc.material.opacity, vis: HX_SUN.g.visible, env: !!HX3.kit.matW?.envMap, water: (() => { let n = 0; IS3.world.traverse(o => { if (o.material === HX3.kit.matW) n++; }); return n; })(), shadow: IS3.R.shadowMap.enabled && IS3.sun.castShadow, size: IS3.sun.shadow.mapSize.x }));
  ok(noon.y > 50 && noon.z < 0 && noon.vis && noon.disc > .8, `5. at 1pm the light comes from high in the north and the sun shows (${JSON.stringify(noon)})`);
  ok(noon.env && noon.water > 20 && noon.shadow && noon.size === 2048, '6. High: water reflects and the shadows are sharp');
  ok(await p.evaluate(() => /The sun is in the north/.test(document.querySelector('.hxsun')?.textContent || '')), '7. the Looks panel says where the sun is');
  await p.evaluate(() => { ui.isPanel = null; ui.mkTab = 'looks'; }); await p.evaluate(() => { HX_SUN.fakeH = 13.2; ui.isPanel = 'looks'; hxSkyApply(); ui.isPanel = null; document.querySelectorAll('.ispanel,.hxpanel').forEach(e => e.style.display = 'none'); is3draw(); });
  await sleep(600); await p.screenshot({ path: S + '/sun-noon.png' });
  // 3. evening: the light comes from the west, low and golden
  await at(19.6, -4.3); await sleep(900);
  const eve = await p.evaluate(() => ({ x: IS3.sun.position.x, y: IS3.sun.position.y, r: IS3.sun.color.r, b: IS3.sun.color.b, bg: IS3.scene.background === HX_BG.gold }));
  ok(eve.x < -30 && eve.y < 25 && eve.r > eve.b && eve.bg, `8. at 7:36pm the light is low and warm from the west, with a golden sky (${JSON.stringify(eve)})`);
  await p.evaluate(() => document.querySelectorAll('.ispanel,.hxpanel').forEach(e => e.style.display = 'none')); await sleep(300);
  await p.screenshot({ path: S + '/sun-evening.png' });
  // 4. night: the moon and stars
  await p.evaluate(() => { HX_SUN.fakeH = 23; ui.isPanel = 'looks'; hxSkyApply(); const m = HX_SUN.mp; IS3.yaw = -m.az; IS3.pitch = .45; is3draw(); });
  await sleep(900);
  const nt = await p.evaluate(() => ({ night: HX3.night, moon: HX_SUN.moon.material.opacity, up: HX_SUN.mp.alt > 0, stars: IS3.scene.children.find(o => o.isPoints).material.opacity, lamps: HX3.nightG.visible }));
  ok(nt.night > .5 && nt.stars > .5 && nt.lamps && (!nt.up || nt.moon > .3), `9. 11pm: stars, lanterns${nt.up ? ' and the moon' : ''} (${JSON.stringify(nt)})`);
  await p.evaluate(() => document.querySelectorAll('.ispanel,.hxpanel').forEach(e => e.style.display = 'none')); await sleep(300);
  await p.screenshot({ path: S + '/sun-night.png' });
  // 5. Medium: simpler
  await p.evaluate(() => { D.settings.gfxMed = true; HX_SUN.fakeH = 13.2; ui.isPanel = 'looks'; render(); hxSkyApply(); }); await sleep(2500);
  const med = await p.evaluate(() => ({ g: hxGfx(), size: IS3.sun.shadow.mapSize.x, glow: HX_SUN.glow.visible, rip: HX_SUN.rip.value, n: HX_SUN.cubeN, env: !!HX3.kit.matW.envMap, vis: HX_SUN.g.visible }));
  ok(med.g === 'medium' && med.size === 1024 && !med.glow && med.rip === 0 && med.n === 64 && med.env, `10. Medium: smaller shadows, no glow or ripples, sky-only reflections (${JSON.stringify(med)})`);
  // 6. Low: none of it
  await p.evaluate(() => { D.settings.lowQuality = true; D.settings.gfxMed = false; applyQuality(); render(); }); await sleep(800);
  const low = await p.evaluate(() => { let w = 0; IS3.world.traverse(o => { if (o.material === HX3.kit.matW) w++; }); return { vis: HX_SUN.g.visible, w, sh: IS3.R.shadowMap.enabled }; });
  ok(!low.vis && low.w === 0 && !low.sh, `11. Low: no sun, no reflections, no shadows (${JSON.stringify(low)})`);
  // 7. the Settings picker
  await p.evaluate(() => { D.settings.lowQuality = false; applyQuality(); view = 'settings'; render(); }); await sleep(500);
  const sel = await p.$('select[data-mn="gfx"]');
  if (sel) { await sel.selectOption('medium'); await sleep(200); }
  ok(!!sel && await p.evaluate(() => D.settings.gfxMed === true && !D.settings.lowQuality), '12. Settings has High / Medium / Low');
  // 8. the boss island hides the sun
  await p.evaluate(() => { D.settings.gfxMed = false; view = 'islands'; ui.isTab = 'boss'; render(); }); await sleep(800);
  ok(await p.evaluate(() => !HX_SUN.g.visible && IS3.scene.children.find(o => o.isPoints).material.opacity === 1), '13. the boss island has no sun and its own stars');
  ok(!errs.length, '14. no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
