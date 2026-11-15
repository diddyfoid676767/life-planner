// 2.72: world-only shell: no sidebar, HUD, Today card, Notice Board and Steward's lodge, map travel, 2D map, real-life glow, old names.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/shell272.e2e.js DIR

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
  await p.evaluate(() => { view = 'todaycard'; render(); });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!HX3.kit && HX3.sig)); i++) await h.sleep(500);
  await h.sleep(800); await h.shot('s-card');
  h.ok(await p.evaluate(() => !!document.querySelector('#world #isfull canvas') && getComputedStyle(document.querySelector('.sidebar')).display === 'none'), 'world behind, no sidebar');
  await p.keyboard.press('Escape'); await h.sleep(500);
  h.ok(await p.evaluate(() => view === 'islands'), 'Esc closes the card'); await h.shot('s-world');
  h.ok(await p.evaluate(() => HX_FREE.find(f => f.id === 'notice').at && HX_FREE.find(f => f.id === 'lodge').at && hxState().fa.notice), 'notice board + lodge placed ' + await p.evaluate(() => JSON.stringify(hxState().fa)));
  await p.evaluate(() => { ui.hxSel = HX_FREE.find(f => f.id === 'notice').at; render(); }); await h.sleep(400);
  await p.click('#isfull [data-hx="open"]'); await h.sleep(500);
  h.ok(await p.evaluate(() => view === 'today'), 'notice board opens Today'); await h.shot('s-today');
  await p.click('#hud [data-v="study"]'); await h.sleep(500); h.ok(await p.evaluate(() => view === 'study'), 'HUD library -> study'); await h.shot('s-study');
  await p.click('#hud [data-shell="steward"]'); await h.sleep(500); await h.shot('s-steward');
  await p.click('#hud [data-shell="map"]'); await h.sleep(400); await h.shot('s-map');
  await p.click('#shmap [data-v="boss"]'); await h.sleep(300); await h.shot('s-fly'); await h.sleep(1200);
  h.ok(await p.evaluate(() => view === 'islands' && ui.isTab === 'boss'), 'map travels to boss'); await h.shot('s-boss');
  await p.evaluate(() => { D.focus = { subjectId: D.subjects[0]?.id, startedAt: Date.now() - 6e5 }; ui.isTab = 'personal'; render(); renderFocusBar(); }); await h.sleep(3500);
  h.ok(await p.evaluate(() => HX3.real?.study?.visible), 'library glows while studying'); await h.shot('s-studying');
  await p.evaluate(() => { D.settings.map2d = true; render(); }); await h.sleep(500); await h.shot('s-2d');
  const k = await p.evaluate(() => HX_FREE.find(f => f.id === 'library').at);
  await p.click(`#isfull [data-hx2="${k}"]`); await h.sleep(300); await p.click(`#isfull [data-hx2="${k}"]`); await h.sleep(400);
  h.ok(await p.evaluate(() => view === 'study'), '2D: tap twice opens the library');
  await p.evaluate(() => { view = 'rankings'; render(); }); await h.sleep(300); h.ok(await p.evaluate(() => view === 'board'), 'old name rankings -> board');
  await p.evaluate(() => { ui.isTab = 'rank'; view = 'islands'; render(); }); await h.sleep(300); h.ok(await p.evaluate(() => view === 'board' && ui.isTab !== 'rank'), 'rank tab -> board page');
}
