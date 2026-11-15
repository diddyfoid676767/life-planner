// 2.73: medieval skin, Steward and Warband names, the finished-build bell. Usage: node test/e2e/medieval273.e2e.js DIR (see shell272.e2e.js)

const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47931' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47931/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const h = { sleep, ok: (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); }, shot: n => p.screenshot({ path: S + '/' + n + '.png' }),
    until: async (fn, arg) => { for (let i = 0; i < 40; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; },
    clean: () => p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 2000, e: 2000 }; save(); }) };
  try { await steps(p, h); } catch (e) { fails++; console.log('ERR', e); }
  h.ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
async function steps(p, h) {
  await h.clean();
  await p.evaluate(() => { view = 'todaycard'; render(); }); await h.sleep(1500);
  h.ok(await p.evaluate(() => document.body.classList.contains('skin-med') && /Palatino|Georgia/.test(getComputedStyle(document.querySelector('.tc-top h2')).fontFamily)), 'medieval skin on, serif headings');
  await h.shot('m-card');
  await p.evaluate(() => { view = 'today'; render(); }); await h.sleep(500); await h.shot('m-today');
  await p.evaluate(() => { view = 'study'; render(); }); await h.sleep(500); await h.shot('m-study');
  await p.evaluate(() => { view = 'settings'; render(); }); await h.sleep(500);
  h.ok(await p.evaluate(() => /Steward/.test(document.querySelector('#view h1').textContent)), 'Settings is the Steward');
  await p.evaluate(() => { const st = hxState(); st.rung = st.rung || {}; st.b['-3,1'] = { id: 'cottage', start: '2026-11-01', ready: '2026-11-03', reps: [], lv: 1, rot: 0, t: 1 }; medBells(); });
  await h.sleep(300);
  h.ok(await p.evaluate(() => /Scholar.*finished/.test(document.getElementById('toasts').textContent)), 'bell + toast when a building is finished');
  await p.evaluate(() => { medBells(); }); h.ok(await p.evaluate(() => (document.getElementById('toasts').textContent.match(/finished/g) || []).length === 1), 'rings once');
  await p.evaluate(() => { document.querySelector('[data-med="skin"]')?.click(); }); await h.sleep(300);
  h.ok(await p.evaluate(() => D.settings.skin === 'plain' && !document.body.classList.contains('skin-med')), 'skin switches off');
  await p.evaluate(() => { D.settings.skin = ''; D.settings.theme = 'midnight'; render(); }); await h.sleep(300);
  await p.evaluate(() => { view = 'islands'; render(); }); await h.sleep(800); for (let i = 0; i < 5; i++) await p.evaluate(() => medStep());
  await p.evaluate(() => { shellMap(true); }); await h.sleep(300); await h.shot('m-map');
}
