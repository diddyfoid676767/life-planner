// 2.71: villagers on the roads, and visiting a housemate's island (read-only).
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/life272.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47925' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const until = async (fn, arg) => { for (let i = 0; i < 40; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  await p.route('https://api.open-meteo.com/**', r => r.abort());
  const friend = { v: 1, b: { '1,1': ['cottage', 2, 'ok', 0], '-1,2': ['lumber', 1, 'ok', 3] }, road: ['1,0', '0,1', '-1,1'], clr: [], tf: { '2,2': { t: 'sand', d: 'fountain' }, '3,0': { h: 2 } }, th: 'snow', col: 'red' };
  let put = null;
  await p.route('**/api/account/isle**', r => { if (r.request().method() === 'PUT') { put = JSON.parse(r.request().postData()); return r.fulfill({ body: '{"ok":true}' }); }
    r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ uid: 'me1', me: true, n: 'Me', d: '{}', ut: '2026-11-15T10:00:00Z' }, { uid: 'u2', me: false, n: 'Sam', d: JSON.stringify(friend), ut: '2026-11-15T09:00:00Z' }]) }); });
  await p.goto('http://127.0.0.1:47925/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true;
    D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 2000, e: 2000 }; c.spent = { l: 0, e: 0 }; delete c.hx; hxState().road.push('2,-1', '3,-1', '3,-2'); save();
    hxIsleOn = () => true; view = 'islands'; ui.isTab = 'personal'; render(); });
  await until(() => !!HX3.kit && HX3.sig);
  ok(await until(() => HX3.vil?.list.length >= 2), '1. villagers walk the roads');
  const p0 = await p.evaluate(() => HX3.vil.list.map(v => v.g.position.x + ',' + v.g.position.z).join(';')); await sleep(2500);
  ok(await p.evaluate(p0 => HX3.vil.list.map(v => v.g.position.x + ',' + v.g.position.z).join(';') !== p0, p0), '2. and they move');
  ok(await until(() => true) && put && JSON.parse(put.d).road.length >= 9, '3. your island is shared with your house');
  await p.screenshot({ path: S + '/vil.png' });
  await p.click('#isfull [data-hx="panel"][data-v="visit"]'); await sleep(800);
  ok(await until(() => !!document.querySelector('#isfull .hxvrow[data-v="u2"]')), '4. the Visit panel lists housemates (not you)');
  await p.click('#isfull .hxvrow[data-v="u2"]'); await sleep(1500);
  ok(await until(() => ui.hxVisit?.uid === 'u2' && /Sam/.test(document.querySelector('#isfull .hxvisit')?.textContent) && hxCur().b['1,1']?.id === 'cottage' && hxLook().gr === HX_THEMES.snow.gr), '5. visiting draws Sam\'s island with their look');
  // read-only: dragging their building doesn't pick it up, own island untouched
  const own = await p.evaluate(() => JSON.stringify(hxState().b));
  const pt = await p.evaluate(() => { const [x, z] = hxPos(1, 1), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
  await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] + 80, pt[1] + 40, { steps: 5 }); await p.mouse.up(); await sleep(300);
  ok(await p.evaluate(own => !ui.hxP && JSON.stringify(hxState().b) === own, own), '6. nothing on a visited island can be moved');
  await p.screenshot({ path: S + '/visit.png' });
  await p.click('#isfull [data-hx="vhome"]'); await sleep(800);
  ok(await until(() => !ui.hxVisit && !hxCur().__w && !!document.querySelector('#isfull .hxtools')), '7. Back home returns to your island');
  ok(!errs.length, '8. no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
