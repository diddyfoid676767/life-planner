// 2.71: island looks (themes), day and night, seasons and Melbourne weather.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/sky271.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47924' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  const until = async (fn, arg) => { for (let i = 0; i < 40; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 17.4, weather_code: 61, cloud_cover: 90, precipitation: .4, wind_speed_10m: 12 } }) }));
  await p.goto('http://127.0.0.1:47924/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true;
    D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 2000, e: 2000 }; c.spent = { l: 0, e: 0 }; delete c.hx; save(); view = 'islands'; ui.isTab = 'personal'; render(); });
  await p.evaluate(() => { hxDaylight = () => ({ e: .8, p: .4, day: true }); });
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!HX3.kit && HX3.sig)); i++) await sleep(500);
  await sleep(1000);
  ok(await p.evaluate(() => HX_WX.cur?.rain && /17°/.test(document.querySelector('#isfull .hxwx')?.textContent)), '1. Melbourne weather loads and shows in the corner');
  ok(await until(() => HX3.wx?.kind === 'rain'), '2. rain falls on the island');
  ok(await p.evaluate(() => hxDaylight().day && IS3.sun.intensity > .3 && !HX3.nightG.visible), '3. daytime: sun up, lanterns dark');
  ok(await p.evaluate(() => hxSeason() === 'spring'), '4. November is spring');
  await p.screenshot({ path: S + '/sky-rain.png' });
  // buy and use the Autumn look
  await p.evaluate(() => { ui.isPanel = 'looks'; render(); }); await sleep(300);
  p.once('dialog', d => d.accept());
  await p.click('#isfull [data-sky="theme"][data-v="autumn"]'); await sleep(800);
  ok(await p.evaluate(() => hxState().theme === 'autumn' && hxState().themes.includes('autumn') && cdWallet().lumen === 1750 && HX3.kit.matT.map !== HX3.kit.base0 && HX3.kit.mat.map === HX3.kit.base0), '5. buying Autumn takes its price and recolours the island');
  // no rain: leaves fall
  await p.evaluate(() => { HX_WX.cur.rain = false; HX_WX.cur.cc = 10; HX3.sig = ''; ui.isPanel = null; render(); }); await sleep(800);
  ok(await until(() => HX3.wx?.kind === 'leaves'), '6. autumn leaves fall when it is dry');
  await p.screenshot({ path: S + '/sky-autumn.png' });
  // night
  await p.evaluate(() => { hxDaylight = () => ({ e: -.8, p: .5, day: false }); tfModel('lamp', 'blue'); HX3.sig = ''; render(); }); await sleep(800);
  ok(await p.evaluate(() => !hxDaylight().day && HX3.nightG.visible && HX3.lampMat.emissiveIntensity > 1), '7. night: lanterns glow');
  await p.screenshot({ path: S + '/sky-night.png' });
  // switching back to Natural is free; weather switch off stops the leaves
  const l0 = await p.evaluate(() => cdWallet().lumen);
  await p.evaluate(() => { ui.isPanel = 'looks'; render(); }); await sleep(200);
  await p.click('#isfull [data-sky="theme"][data-v="natural"]'); await sleep(300);
  await p.evaluate(() => { ui.isPanel = 'looks'; render(); }); await sleep(200);
  await p.click('#isfull [data-sky="wx"]'); await sleep(500);
  ok(await until(l0 => !hxState().theme && cdWallet().lumen === l0 && D.settings.isWx === false && !HX3.wx, l0), '8. Natural is free and the weather switch turns weather off');
  // Low graphics: no weather; the boss island gets its own light back
  await p.evaluate(() => { D.settings.isWx = true; D.settings.lowQuality = true; HX3.sig = ''; render(); }); await sleep(400);
  ok(await p.evaluate(() => !HX3.wx), '9. Low graphics turns weather off');
  await p.evaluate(() => { D.settings.lowQuality = false; ui.isTab = 'boss'; render(); }); await sleep(800);
  ok(await p.evaluate(() => IS3.sun.intensity === 1), '10. the boss island keeps its own light');
  ok(!errs.length, '11. no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
