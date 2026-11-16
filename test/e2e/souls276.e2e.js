// 2.76: the Snooze Golem Souls fight. Usage: node test/e2e/souls276.e2e.js DIR (see shell272.e2e.js)

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
  await p.evaluate(() => { ui.isTab = 'boss'; ui.isPanel = 'bspar'; view = 'islands'; render(); }); await h.sleep(1500);
  h.ok(await p.evaluate(() => !!document.querySelector('[data-so="trial"]')), 'Souls trial button in the Practice yard panel');
  await p.click('[data-so="trial"]'); await h.sleep(500);
  h.ok(await p.evaluate(() => !!SO && SO.intro && !!document.querySelector('.so-intro')), 'intro card shows');
  await h.shot('s-intro');
  await p.click('[data-so="go"]'); await h.sleep(2500);
  h.ok(await p.evaluate(() => !!SO.R && !SO.intro && SO.P.hp > 0), 'fight starts');
  await h.shot('s-start');
  // walk up to the Golem, hit it, roll
  await p.keyboard.down('w'); await h.sleep(1500); await p.keyboard.up('w');
  await p.evaluate(() => { SO.me.x = SO.B.x; SO.me.z = SO.B.z + 3; SO.me.face = Math.PI; SO.me.st = 100; soAct('light'); }); await h.sleep(900);
  h.ok(await p.evaluate(() => SO.dealt > 0), 'a light attack hits ' + await p.evaluate(() => SO.dealt));
  await p.evaluate(() => { SO.me.st = 100; soAct('heavy'); }); await h.sleep(1400);
  await p.evaluate(() => { SO.me.st = 100; soSkill(0); }); await h.sleep(1200);
  await h.shot('s-fight');
  // force each Golem attack so the telegraphs and animations run
  for (const k of ['slam', 'wave', 'roll', 'punch']) {
    await p.evaluate(k => { const B = SO.B; SO.lock = true; B.x = 0; B.z = -4; B.cool = {}; B.state = 'idle'; B.chain = null; SO.me.x = 0; SO.me.z = B.z + (k === 'roll' ? 9 : 3.2); SO.cam.cy = 0; soBossPick(k === 'roll' ? 9 : k === 'wave' ? 3 : 3, 0); if (B.atk?.k !== k || B.state !== 'wind') { B.atk = { k, w: 1.2, n: k }; soClearTele(); soTeleMake(B.atk); B.t = 1.2; B.state = 'wind'; } }, k);
    await h.sleep(250); await h.shot('s-' + k); await h.sleep(1600);
  }
  h.ok(await p.evaluate(() => SO.P.hp < SO.P.max), 'the Golem hits back');
  // phases on the trial bar
  await p.evaluate(() => { SO.B.hp = SO.B.max * .2; }); await h.sleep(500);
  h.ok(await p.evaluate(() => soPhase() === 3), 'phase 4 at 20%');
  await p.evaluate(() => { SO.P.hp = 0; }); await h.sleep(1800);
  h.ok(await p.evaluate(() => SO.over && /DIED/.test(document.querySelector('.so-end')?.textContent || '')), 'death screen');
  await h.shot('s-dead');
  await p.click('[data-so="close"]'); await h.sleep(500);
  h.ok(await p.evaluate(() => !SO && !document.getElementById('soov')), 'closes');
  // a real weekly Souls fight: pretend it's the Golem's week
  await p.evaluate(() => { soGolemWeek = () => true; const s = hsState(); if (!s.id) s.id = HS_HOUSES?.[0]?.id || 'phoenix'; });
  const before = await p.evaluate(() => ftAttempts().left);
  await p.evaluate(() => { soOpen('house'); }); await h.sleep(300);
  const kind = await p.evaluate(() => SO.kind);
  if (kind === 'house') {
    await p.click('[data-so="go"]'); await h.sleep(1500);
    await p.evaluate(() => { SO.me.x = SO.B.x; SO.me.z = SO.B.z + 3; SO.me.face = Math.PI; soAct('light'); }); await h.sleep(800);
    await p.evaluate(() => { soEnd('quit'); }); await h.sleep(500);
    h.ok(await p.evaluate(b => ftAttempts().left === b - 1 && /shared health bar/.test(document.querySelector('.so-end').textContent), before), 'house fight uses an attempt and adds to the shared bar');
    await h.shot('s-house-end');
    await p.click('[data-so="close"]');
  } else console.log('house fight not available here (' + kind + ')');
}
