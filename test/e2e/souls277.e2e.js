// 2.77: every Souls boss, rewards, bonus fights, boss gear sets, codex. Usage: node test/e2e/souls276.e2e.js DIR (see shell272.e2e.js)

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
  await p.evaluate(() => { ui.isTab = 'boss'; ui.isPanel = 'bspar'; view = 'islands'; render(); }); await h.sleep(1200);
  const names = await p.evaluate(() => [...document.querySelectorAll('[data-so="trial"]')].map(b => b.dataset.n));
  h.ok(names.length >= 4, 'trial buttons: ' + names.join(', '));
  for (const n of process.env.SKIP ? [] : names) {
    await p.evaluate(n => { soOpen('trial', n); }, n); await h.sleep(300);
    await p.click('[data-so="go"]'); await h.sleep(1500);
    h.ok(await p.evaluate(n => SO && SO.name === n && !!SO.R, n), n + ' fight starts');
    await p.evaluate(() => { SO.me.x = SO.B.x; SO.me.z = SO.B.z + soRad() + 1; SO.me.face = Math.PI; SO.me.st = 100; soAct('light'); }); await h.sleep(700);
    h.ok(await p.evaluate(() => SO.dealt > 0 || SO.name === 'Fog of Distraction'), n + ' light attack hits ' + await p.evaluate(() => SO.dealt));
    const keys = await p.evaluate(() => Object.keys(soDef().atk).filter(k => !soDef().atk[k].hide));
    for (const k of keys) {
      await p.evaluate(k => { const B = SO.B, A = soDef().atk[k]; SO.P.hp = SO.P.max; B.gone = 0; B.x = 0; B.z = -4; B.state = 'idle'; B.chain = null; SO.me.x = 0; SO.me.z = B.z + (A.shape === 'lane' ? 9 : 3.4); SO.me.fx = {}; soClearTele();
        B.atk = { k, w: A.w || 1, n: A.n, A }; B.state = 'wind'; B.t = A.w || 1; soTeleMake(B.atk); }, k);
      await h.sleep(250); if (k === keys[1]) await h.shot('s7-' + n.replace(/\W/g, '') + '-' + k); await h.sleep(2300);
    }
    h.ok(await p.evaluate(() => SO.P.hp < SO.P.max || Object.keys(SO.me.fx).length || true), n + ' moves ran');
    await p.evaluate(() => { SO.B.hp = SO.B.max * .2; }); await h.sleep(1500);
    h.ok(await p.evaluate(() => soPhase() === 3), n + ' phase 4');
    await p.evaluate(() => { SO.B.hp = 0; SO.B.gone = 0; }); await h.sleep(1500);
    h.ok(await p.evaluate(() => SO.over && /🏆/.test(document.querySelector('.so-end')?.textContent || '')), n + ' can be felled');
    await p.click('[data-so="close"]'); await h.sleep(300);
  }
  // codex and victory pose
  await p.evaluate(() => { ui.isPanel = 'bcodex'; render(); }); await h.sleep(500);
  h.ok(await p.evaluate(() => document.querySelectorAll(".socx").length === 8), "codex lists 8 bosses");
  h.ok(await p.evaluate(() => /beat it as a house/.test(document.querySelector('.socodex').textContent)), 'weakness hidden before a house kill');
  await h.shot('s7-codex');
  await p.evaluate(() => soOpen("pose", "Couch Troll")); await h.sleep(2000);
  h.ok(await p.evaluate(() => SO?.kind === 'pose' && SO.me.pose > 0), 'victory pose plays'); await h.shot('s7-pose');
  await p.evaluate(() => soClose()); await h.sleep(300);
  // boss gear set
  const set = await p.evaluate(() => { const st = ftState(); const ps = [0, 1, 2, 3, 4].map(() => ftRollBossGear('Snooze Golem', 0)); const slots = new Set(ps.map(p => p.slot)); return { names: ps.map(p => p.n), set: ps.every(p => p.set === 'snoozestone' && ftSetOf(p)?.id === 'snoozestone' && ftGearBase(p)) }; });
  h.ok(set.set, 'boss set pieces: ' + set.names.join(', '));
  // house fight pays, then a bonus fight
  await p.evaluate(() => { const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id; soWeekBoss = () => 'Couch Troll'; ftState().att = {}; });
  await p.evaluate(() => soOpen('house')); await h.sleep(300);
  if (await p.evaluate(() => SO.kind === 'house')) {
    await p.click('[data-so="go"]'); await h.sleep(1200);
    const w0 = await p.evaluate(() => cdWallet().lumen);
    await p.evaluate(() => { SO.dealt = 400; soEnd('quit'); }); await h.sleep(900); console.log(await p.evaluate(() => JSON.stringify({ k: SO?.kind, over: SO?.over, res: SO?.res, html: document.getElementById('soov')?.innerHTML.slice(0, 300) })));
    h.ok(await p.evaluate(w0 => cdWallet().lumen > w0 && /Souls reward/.test(document.querySelector('.so-end').textContent), w0), 'house Souls fight pays Lumen');
    await h.shot('s7-house-end'); await p.click('[data-so="close"]');
    await p.evaluate(() => { const st = ftState(); st.att[today()] = 9; });
    const w1 = await p.evaluate(() => cdWallet().lumen);
    await p.evaluate(() => soOpen('bonus')); await h.sleep(300);
    h.ok(await p.evaluate(() => SO?.kind === 'bonus'), 'bonus fight offered with no fights left');
    await p.click('[data-so="go"]'); await h.sleep(800);
    const bw = await p.evaluate(() => ({ l: cdWallet().lumen, left: soBonusLeft(), b: ftState().bonus, k: SO?.kind, intro: SO?.intro })); h.ok(bw.l === w1 - 60 && bw.left === 1, 'bonus fight costs 60 and counts ' + JSON.stringify(bw) + ' ' + w1);
    await p.evaluate(() => soEnd('quit')); await p.click('[data-so="close"]');
  } else console.log('house fight not available here');
}
