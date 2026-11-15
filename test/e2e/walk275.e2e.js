// 2.75: walk mode and the four interiors. Usage: node test/e2e/walk275.e2e.js DIR (see shell272.e2e.js)

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
  await p.evaluate(() => { view = 'islands'; render(); }); await h.until(() => !!HX3.kit && IS3.house === 'hex'); await h.sleep(800);
  await p.keyboard.press('v'); await h.sleep(600);
  h.ok(await p.evaluate(() => WK.on && document.body.classList.contains('walking') && !!WK.fig?.parent), 'V starts walk mode with your character');
  await h.shot('w-start');
  const x0 = await p.evaluate(() => [WK.x, WK.z]);
  await p.keyboard.down('w'); await h.sleep(2500); await p.keyboard.up('w');
  const x1 = await p.evaluate(() => [WK.x, WK.z]);
  h.ok(Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) > .5, 'W walks forward ' + JSON.stringify([x0, x1]));
  await h.shot('w-walk');
  await p.evaluate(() => { WK.cy += 1.2; }); await h.sleep(200); await h.shot('w-turn');
  // walk straight into the library door
  for (const id of ['library', 'hall', 'training', 'tavern']) {
    await p.evaluate(id => { const f = HX_FREE.find(x => x.id === id); wkDoor(f); }, id);
    await h.until(() => !!WK.room && !WK.fading); await h.sleep(900);
    h.ok(await p.evaluate(id => WK.inside === id && view === HX_FREE.find(x => x.id === id).open && document.body.classList.contains('wk-in'), id), id + ' interior opens with its page');
    await h.shot('w-in-' + id);
    await p.keyboard.press('Escape'); await h.until(() => !WK.inside && !WK.fading); await h.sleep(400);
    h.ok(await p.evaluate(() => view === 'islands' && WK.on && IS3.world.visible && !WK.room), id + ': Esc walks back out');
  }
  // the HUD's buildings take you inside while walking
  await p.evaluate(() => { view = 'study'; render(); }); await h.until(() => WK.inside === 'library' && !!WK.room && !WK.fading);
  await p.evaluate(() => { view = 'friends'; render(); }); await h.until(() => WK.inside === 'tavern' && !!WK.room && !WK.fading);
  h.ok(await p.evaluate(() => WK.inside === 'tavern'), 'switching page switches room');
  await p.evaluate(() => { view = 'islands'; render(); }); await h.until(() => !WK.inside && !WK.fading); await h.sleep(300);
  await p.evaluate(() => { const f = HX_FREE.find(x => x.id === 'market'); wkDoor(f); }); await h.sleep(500);
  h.ok(await p.evaluate(() => view === 'profile' && !WK.inside), 'the market opens its page directly ' + await p.evaluate(() => view + ' ' + WK.inside + ' ' + WK.skip));
  await p.evaluate(() => { view = 'islands'; render(); }); await h.sleep(300);
  await p.keyboard.press('v'); await h.sleep(400);
  h.ok(await p.evaluate(() => !WK.on && !document.body.classList.contains('walking') && IS3.cam.fov === 38), 'V goes back to the builder view');
}
