// 2.70: terraforming, heights, decorations, undo and reset on the hex home island.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/terraform270.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47923' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  await p.goto('http://127.0.0.1:47923/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true;
    D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 2000, e: 2000 }; c.spent = { l: 0, e: 0 }; delete c.hx; save(); view = 'islands'; ui.isTab = 'personal'; render(); });
  await p.waitForFunction(() => HX3.kit, null, { timeout: 30000 }); await sleep(800);
  await p.evaluate(() => document.querySelectorAll('.boxfx').forEach(d => d.remove()));
  await p.click('.hxtools [data-v="tf"]'); await sleep(300);
  ok(await p.$('#isfull .tfbar .tfb.on'), '1. Terraform opens the brush bar');
  const w0 = await p.evaluate(() => cdWallet());
  // paint sand and a pond with real drags on open ground
  const paint = (brush, ks) => p.evaluate(([brush, ks]) => { ui.hxP.brush = brush; HX3.paint = { last: null }; for (const k of ks) hxPaintAt(k); HX3.paint = null; save(); render(); return ui.hxP.why; }, [brush, ks]);
  await paint('sand', ['3,-1', '3,-2']); await paint('water', ['-1,3']); await paint('up', ['2,1', '2,1']); await paint('fountain', ['1,2']); await paint('lamp', ['0,3']);
  const st = await p.evaluate(() => ({ tf: hxState().tf, w: cdWallet(), a: hxAt('-1,3').kind, d: hxAt('1,2').kind, h: hxHt('2,1', hxState()) }));
  ok(st.tf['3,-1'].t === 'sand' && st.a === 'pond' && st.d === 'deco', '2. sand, pond and a fountain are on the island');
  ok(st.tf['2,1']?.h === 1 && st.h > 0, '3. dragging twice over a hex in one stroke raises it once');
  ok(w0.lumen - st.w.lumen === 4 + 150 && w0.ember - st.w.ember === 2 + 2 + 30, `4. costs taken (${w0.lumen - st.w.lumen} Lumen, ${w0.ember - st.w.ember} Ember)`);
  ok(await p.evaluate(() => !hxCheck('cottage', '1,2').ok && !hxCheck('cottage', '-1,3').ok && hxCheck('cottage', '3,-1').ok && !hxCheck('road', '2,1').ok), '5. buildings avoid decorations and ponds, fit on sand; roads avoid raised hexes');
  ok(await paint('sand', ['-4,-1']) === 'Clear the trees and rocks first', '6. natural forest has to be cleared first');
  await paint('forest', ['3,-2']);
  ok(await p.evaluate(() => hxTerr('3,-2') === 'forest'), '7. painted forest counts as forest for a lumber mill');
  await p.screenshot({ path: S + '/tf1.png' });
  // undo the forest stroke: refunded
  const l1 = await p.evaluate(() => cdWallet().lumen);
  await p.keyboard.press('Control+z'); await sleep(300);
  ok(await p.evaluate(() => hxState().tf['3,-2'].t === 'sand') && await p.evaluate(() => cdWallet().lumen) === l1 + 2, '8. Ctrl+Z undoes the last stroke and refunds it');
  // real mouse drag paints too
  await p.evaluate(() => { ui.hxP.brush = 'path'; render(); });
  const pt = k => p.evaluate(k => { const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, k);
  const [ax, ay] = await pt('-2,-1'), [bx, by] = await pt('0,-3');
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx, by, { steps: 4 }); await p.mouse.up(); await sleep(300);
  ok(await p.evaluate(() => Object.values(hxState().tf).filter(v => v.t === 'path').length >= 1), '9. dragging the mouse paints a path');
  // reset terrain keeps decorations
  p.once('dialog', d => d.accept());
  await p.click('#isfull [data-hx="tfreset"]'); await sleep(400);
  const r = await p.evaluate(() => hxState().tf);
  ok(Object.values(r).every(v => !v.t && !v.h) && r['1,2']?.d === 'fountain', '10. Reset terrain puts the ground back and keeps decorations');
  await p.click('#isfull [data-hx="cancel"]'); await sleep(300);
  // tap a decoration
  await p.evaluate(() => { ui.hxSel = '1,2'; render(); }); await sleep(300);
  ok(await p.$('#isfull [data-hx="undeco"]'), '11. a decoration shows a Take away button');
  await p.evaluate(() => { D.settings.lowQuality = true; HX3.sig = ''; render(); }); await sleep(500);
  await p.evaluate(() => { D.settings.lowQuality = false; HX3.sig = ''; ui.hxSel = null; render(); }); await sleep(800);
  await p.screenshot({ path: S + '/tf2.png' });
  ok(!errs.length, '12. no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
