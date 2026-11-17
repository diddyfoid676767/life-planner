// 2.98: owner test mode on the boss island: see any boss's arena, test any built fight.
// (was 2.88: a bulkier, faster, less predictable Somnus; armoured outside its openings; fire-lit arena; grunts; the boss island.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/bosstest298.e2e.js DIR

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
  let fails = 0; const HS_N = 8; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const shot = n => p.screenshot({ path: S + '/' + n + '.png' });
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; save();
      soGolemWeek = () => true; ftState().att = {}; ftState().bonus = {}; delete ftState().soIntroSeen; const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id; save(); });
    await ev(() => { localStorage.setItem('solisDev', '1'); ui.isTab = 'boss'; ui.isPanel = null; ui.biView = null; view = 'islands'; render(); }); await sleep(1500);
    // 1. the owner's Bosses button and list
    await p.click('[data-v="btest"]'); await sleep(500);
    const rows = await ev(() => [...document.querySelectorAll('.bitest-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    ok(rows.length === HS_N && rows.filter(r => /Souls fight/.test(r)).length >= 2, '1. the owner list shows every boss (' + rows.length + '), with a test fight for each built one'); await shot('bt-list');
    // 2. show Somnus's hall
    await p.click('[data-bi="view"][data-b="Snooze Golem"]');
    ok(await until(() => !!BI_IDLE.gs && BI_IDLE.gs.root.parent && biPreview()?.n === 'Snooze Golem', null, 60), '2. Somnus\'s hall with the sleeping Golem shows on the island');
    await ev(() => { ui.isPanel = null; render(); }); await sleep(1500); await shot('bt-somnus');
    ok(await ev(() => !!document.querySelector('.bipv') === (hsBoss(mondayOf(today())).n !== 'Snooze Golem')), '2b. a banner says it is an owner preview when it isn\'t this week\'s boss');
    // 3. Morrow's hall
    await ev(() => { ui.biView = 'The Procrastinator'; IS3.sig = null; render(); });
    ok(await until(() => biPreview()?.n === 'The Procrastinator' && IS3.sig && IS3.sig.includes('The Procrastinator'), null, 40), '3. Morrow\'s hall shows'); await sleep(1500); await shot('bt-morrow');
    // 4. a boss with no hall yet: the basic arena
    await ev(() => { ui.biView = 'Couch Troll'; IS3.sig = null; render(); }); await sleep(1500);
    ok(await ev(() => IS3.sig.includes('Couch Troll') && !BI_IDLE.gs), '4. a boss without its own hall shows the basic arena'); await shot('bt-troll');
    // 5. test fight from the list opens that boss
    await ev(() => { ui.isPanel = 'btest'; render(); }); await sleep(400);
    await p.click('[data-so="test"][data-b="The Procrastinator"]'); await sleep(400);
    ok(await ev(() => SO?.intro && SO.def.key === SO_DEFS['The Procrastinator'].key), '5. Test fight from the list opens Morrow');
    await ev(() => soClose());
    // 6. the HUD Test fight follows the preview; back to this week clears it
    await ev(() => { ui.isPanel = null; ui.biView = 'Snooze Golem'; IS3.sig = null; render(); }); await sleep(600);
    await p.click('.is-br [data-so="test"]'); await sleep(400);
    ok(await ev(() => SO?.intro && SO.def.key === SO_DEFS['Snooze Golem'].key), '6. the Test fight button opens the boss being previewed');
    await ev(() => soClose()); await ev(() => { ui.isPanel = 'btest'; render(); }); await sleep(300);
    await p.click('[data-bi="view"][data-b=""]'); await sleep(800);
    ok(await ev(() => !ui.biView && !biPreview()), '6b. back to this week\'s boss');
    // 7. not the owner: no Bosses button and no preview
    await ev(() => { localStorage.removeItem('solisDev'); ui.biView = 'Snooze Golem'; ui.isPanel = null; IS3.sig = null; render(); }); await sleep(800);
    ok(await ev(() => !document.querySelector('[data-v="btest"]') && !biPreview()), '7. players never see the owner list or a preview');
  } catch (e) { fails++; console.log('ERR', e); }
  ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
