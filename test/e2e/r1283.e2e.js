// 2.83 (feedback round 2, R1): no quick fights, settings gear + Esc, right-side menus, old sounds, no right-click roll, sprint jump over rivers.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/r1283.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47932' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10}}' }));
  await p.goto('http://127.0.0.1:47932/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, arg, n = 40) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); D.settings.seenVersion = '9.9.9'; save(); view = 'islands'; ui.isTab = 'personal'; render(); }); await sleep(1200);
    // 1. quick fights are gone
    ok(await ev(() => typeof ftStart === 'undefined' && typeof ftAct === 'undefined' && typeof ftDraw === 'undefined' && typeof ftBattlesHtml === 'undefined'), '1. turn-based fight code is gone');
    await ev(() => { ui.isTab = 'boss'; ui.isPanel = 'binfo'; render(); }); await sleep(800);
    ok(await ev(() => !document.querySelector('[data-ft="house"], [data-ft="spar"], [data-ft="duel"], [data-v="bspar"]')), '1b. no quick fight, spar or duel buttons on the boss island');
    await ev(() => { ui.isPanel = null; ui.isTab = 'personal'; render(); }); await sleep(800);
    // 2. gear and Esc
    ok(await ev(() => { const g = document.getElementById('gearBtn'); return !!g && getComputedStyle(g).display !== 'none' && g.getBoundingClientRect().right > window.innerWidth - 30 && g.getBoundingClientRect().top < 30; }), '2. a gear sits top-right');
    await p.click('#gearBtn'); await sleep(600);
    ok(await ev(() => view === 'settings'), '2b. the gear opens settings');
    await p.keyboard.press('Escape'); await sleep(500);
    ok(await ev(() => view === 'islands'), '2c. Esc closes settings');
    await p.keyboard.press('Escape'); await sleep(500);
    ok(await ev(() => view === 'settings'), '2d. Esc with nothing open opens settings');
    await p.keyboard.press('Escape'); await sleep(500);
    await ev(() => { ui.isPanel = 'help'; render(); }); await sleep(500);
    await p.keyboard.press('Escape'); await sleep(500);
    ok(await ev(() => view === 'islands' && !ui.isPanel), '2e. Esc closes an open panel first, not settings');
    await ev(() => { bwOpen('hall'); }); await sleep(600);
    ok(await ev(() => !/Settings/.test(document.querySelector('.bw')?.innerText || '')), '2g. the Hall has no Settings tab');
    await ev(() => { view = 'islands'; render(); }); await sleep(500);
    // 3. panels slide in from the right
    for (const pn of ['shop', 'perks', 'market', 'help', 'visit']) {
      await ev(pn => { ui.isTab = 'personal'; ui.isPanel = pn; render(); }, pn); await sleep(700);
      const r = await ev(() => { const e = document.querySelector('.ispanel'); if (!e) return null; const q = e.getBoundingClientRect(); return { l: q.left, r: q.right }; });
      ok(r && r.l > 680 && r.r > 1360, `3. ${pn} panel is on the right`);
    }
    await ev(() => { ui.isPanel = null; render(); }); await sleep(400);
    await ev(() => { modal.querySelector('form').innerHTML = '<h2>Test</h2>'; modal.showModal(); }); await sleep(500);
    ok(await ev(() => { const q = modal.getBoundingClientRect(); return q.right > window.innerWidth - 30 && q.left > window.innerWidth / 2 - 20; }), '3b. forms (quick add) open on the right');
    await ev(() => modal.close());
    // 4. sounds
    await ev(() => { sndCtx(); sfx('click'); sfx('step', { surf: 'stone' }); }); await sleep(800);
    ok(await ev(() => Object.keys(SND_BUF).length === 0 && typeof SFX.step === 'function' && typeof SFX.roll === 'function'), '4. old made-up sounds outside fights (no recordings loaded)');
    // 5. walk: right click no roll, sprint jump over river
    await p.keyboard.press('v'); ok(await until(() => WK.on, null, 40), '5. walk mode on'); await sleep(600);
    await ev(() => { WK.stam = 100; });
    const box = await ev(() => { const r = IS3.canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(box.x, box.y, { button: 'right' }); await sleep(300);
    ok(await ev(() => WK.roll <= 0), '5b. right click does not roll');
    await until(() => WK.ground, null, 30);
    console.log('INFO state', JSON.stringify(await ev(() => ({ g: WK.ground, sw: WK.swim, st: WK.stam, r: WK.roll }))));
    await ev(() => { ROLL_SHIFT.tap = 5; }); await p.keyboard.press('Shift'); await sleep(100);
    ok(await ev(() => WK.roll > 0 || WK.rollBuf > 0), '5c. a tap of Shift rolls (2.103)'); await sleep(900);
    // find a river channel crossing: put the hero on the bank facing the channel
    const rv = await ev(() => {
      const L = hxW(hxState()).land();
      for (const [k, h] of L) if (h.t === 'river') { const [x, z] = hxPos(...hxQR(k)); for (let a = 0; a < 6.28; a += .26) for (let d = .3; d < 1.2; d += .1) { const wx = x + Math.cos(a) * d, wz = z + Math.sin(a) * d; if (wkWet(wx, wz) != null) { for (let t = 0; t < 1.6; t += .05) { const bx = wx - Math.cos(a) * t, bz = wz - Math.sin(a) * t; if (wkWet(bx, bz) == null && !wkCollide(bx, bz, 0).hit && wkGround(bx, bz) > -.05) { return { bx, bz, a, w: 0 }; } } } } }
      return null;
    });
    if (rv) {
      // simulate: start on the bank, face the river, hold forward at sprint then jump
      const run = async sprint => {
        await ev(rv => { WK.x = rv.bx - Math.cos(rv.a) * 1.2; WK.z = rv.bz - Math.sin(rv.a) * 1.2; WK.y = 0; WK.vx = WK.vz = 0; WK.swim = false; WK.ground = true; WK.stam = 100; WK.tired = false; WK.cy = Math.atan2(-Math.cos(rv.a), -Math.sin(rv.a)) + 0; WK.keys = {}; }, rv);
        await ev(sprint => { WK.keys = { w: true, shift: sprint }; }, sprint); await sleep(500);
        await p.keyboard.press('Space'); await sleep(1500);
        const swam = await ev(() => WK.swim); await ev(() => { WK.keys = {}; }); return swam;
      };
      const sw1 = await run(true), sw2 = await run(false);
      ok(!sw1, '6. a sprint jump clears the river hex'); ok(sw2, '6b. a jogging jump falls in');
    } else ok(true, '6. (no river on this island)');
    ok(!errs.length, '7. no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { fails++; console.log('ERR', e); }
  await b.close(); app.kill();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
