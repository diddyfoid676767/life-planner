// 2.82 Terraform 2.0: free/paid split, thin joined-up paths in three styles, edge fences, new items,
// the see-through ghost with a cost chip, wheel turning, moving and turning decorations, preview, undo and reset.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/terraform282.e2e.js DIR
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
    D.settings.seenVersion = '1.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 3000, e: 3000 }; c.spent = { l: 0, e: 0 }; delete c.hx; save(); view = 'islands'; ui.isTab = 'personal'; render(); });
  await p.waitForFunction(() => HX3.kit, null, { timeout: 30000 }); await sleep(800);
  await p.evaluate(() => document.querySelectorAll('.boxfx').forEach(d => d.remove()));
  await p.click('.hxtools [data-v="tf"]'); await sleep(300);
  ok(await p.$$eval('#isfull .tfcats button', b => b.length) >= 9 && await p.$('#isfull .tfitems .tfb.on'), '1. Terraform opens with category tabs and priced items');
  const w0 = await p.evaluate(() => cdWallet());
  const paint = (brush, ks) => p.evaluate(([brush, ks]) => { ui.hxP.brush = brush; HX3.paint = { last: null }; ui.hxP.sn = ui.hxP.sl = ui.hxP.sx = 0; for (const k of ks) hxPaintAt(k); HX3.paint = null; save(); render(); return ui.hxP.why; }, [brush, ks]);
  await paint('sand', ['3,-1', '3,-2']); await paint('up', ['2,1', '2,1']); await paint('forest', ['-2,2']);
  let w = await p.evaluate(() => cdWallet());
  ok(w.lumen === w0.lumen && w.ember === w0.ember, '2. sand, forest and raising are free');
  await paint('water', ['-1,3']); await paint('fountain', ['1,2']); await paint('lamp', ['0,3']); await paint('cliff', ['2,2']);
  w = await p.evaluate(() => cdWallet());
  ok(w0.lumen - w.lumen === 150 && w0.ember - w.ember === 2 + 30 + 4, `3. ponds, cliffs and decorations cost (${w0.lumen - w.lumen} Lumen, ${w0.ember - w.ember} Ember)`);
  ok(await p.evaluate(() => hxState().tf['2,1'].h === 1 && hxState().tf['2,2'].c === 1 && hxState().tf['2,2'].h === 2), '4. one raise per stroke; a cliff raises with rock sides');
  // stone path line from the road out: joins the road and each other, free
  await paint('pstone', ['2,-3', '2,-4', '2,-5']);
  const pj = await p.evaluate(() => ({ t: hxState().tf['2,-4'], m: tfJoins('2,-4', hxState()), w: cdWallet() }));
  ok(pj.t.t === 'path' && pj.t.ps === 'stone' && pj.m.toString(2).split('1').length - 1 === 2 && pj.w.lumen === w.lumen, `5. stone paths are free and join up (mask ${pj.m.toString(2)})`);
  ok(await p.evaluate(() => !!(tfJoins('2,-3', hxState()) & 2)), '6. a path joins the road or building next to it');
  ok(await paint('bench', ['2,-4']) === '' && await paint('fountain', ['2,-5']) !== '', '7. a bench can sit beside a path; a fountain can\'t go on one');
  // edges: point at the edge between two grass hexes
  const edge = (brush, k, i) => p.evaluate(([brush, k, i]) => { const [x, z] = hxPos(...hxQR(k)), a = i * Math.PI / 3; HX3.pt = [x + Math.cos(a) * .9, z + Math.sin(a) * .9]; ui.hxP.brush = brush; HX3.paint = { last: null }; hxPaintAt(k); HX3.paint = null; save(); return ui.hxP.why; }, [brush, k, i]);
  const l1 = await p.evaluate(() => cdWallet().lumen);
  await edge('fence', '-3,1', 0); await edge('hedge', '-3,1', 4);
  const e = await p.evaluate(() => ({ a: hxState().tf['-3,1']?.e, b: hxState().tf[hxNb('-3,1')[4]]?.e, l: cdWallet().lumen }));
  ok(e.a?.[0] === 'fence' && e.b?.[1] === 'hedge' && l1 - e.l === 7, `8. fences and hedges go on hex edges, kept on one hex each (${JSON.stringify(e)})`);
  ok(await p.evaluate(() => { const m = tfJoins('2,-4', hxState()), i = [0, 1, 2, 3, 4, 5].find(j => m >> j & 1); const E = i < 3 ? { k: '2,-4', i } : { k: hxNb('2,-4')[i], i: i - 3 }; return /road or path/.test(tfEdgePlan(E, 'fence', hxState()).why || ''); }), '9. a fence can\'t cross a path');
  // water pieces
  ok(await paint('boat', ['-1,3']) === '' && await paint('boat', ['4,1']) !== '' && await paint('boat', ['8,-4']) === '', '10. boats go on ponds and the sea, not grass');
  await paint('water', ['-2,3']); ok(await paint('bridge', ['-2,3']) === '', '11. a footbridge goes over a pond');
  // ghost and chip on hover
  await p.evaluate(() => { ui.hxP.brush = 'gazebo'; render(); HX3.cxy = [700, 400]; hxHover('4,1', true); });
  ok(await p.evaluate(() => HX3.ghost && HX3.ghost.children.length > 1 && /🌟|✦|Lumen|200/.test(document.getElementById('tfchip')?.textContent || '')), '12. a see-through ghost and a cost chip show on hover');
  await p.evaluate(() => hxHover('2,-5', true));
  ok(await p.evaluate(() => /✗/.test(document.getElementById('tfchip')?.textContent || '')), '13. the chip says why not when it doesn\'t fit');
  // wheel turns
  const r0 = await p.evaluate(() => ui.hxP.rot || 0);
  await p.evaluate(() => hxWheel({ deltaY: 120, ctrlKey: false }));
  ok(await p.evaluate(() => ui.hxP.rot || 0) === (r0 + 1) % 6, '14. the mouse wheel turns what you hold');
  // preview costs the difference
  await p.evaluate(() => { ui.tfPv = true; render(); }); await paint('statue', ['4,1']); await paint('picket', []);
  const pv = await p.evaluate(() => ({ c: tfPvCost(hxState()), w: cdWallet() }));
  ok(pv.c[1] === 150, `15. a preview is free and keeps the cost for Keep (${pv.c})`);
  await p.evaluate(() => { tfPvDiscard(); ui.tfPv = false; render(); });
  ok(await p.evaluate(() => !hxState().tf['4,1']?.d), '16. discarding the preview puts it back');
  // undo refunds the bridge
  const x1 = await p.evaluate(() => cdWallet().ember);
  await p.keyboard.press('Control+z'); await sleep(300);
  ok(await p.evaluate(() => !hxState().tf['-2,3']?.d) && await p.evaluate(() => cdWallet().ember) === x1 + 50, '17. Ctrl+Z undoes the last stroke and refunds it');
  // real mouse drag paints a dirt path
  await p.evaluate(() => { ui.hxP.brush = 'path'; render(); });
  const pt = k => p.evaluate(k => { const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, k);
  const [ax, ay] = await pt('-2,-1'), [bx, by] = await pt('0,-3');
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx, by, { steps: 4 }); await p.mouse.up(); await sleep(300);
  ok(await p.evaluate(() => Object.values(hxState().tf).filter(v => v.t === 'path' && !v.ps).length >= 1), '18. dragging the mouse paints a dirt path');
  await p.click('#isfull [data-hx="cancel"]'); await sleep(300);
  // move and turn a decoration, free
  const w2 = await p.evaluate(() => cdWallet());
  await p.evaluate(() => { const v = hxState().tf['1,2']; hxStartPlace({ id: 'tfmv', mode: 'deco', d: v.d, from: '1,2', rot: 0 }); hxHover('4,2', true); hxPlace(ui.hxP, '4,2'); ui.hxP = null; render(); });
  ok(await p.evaluate(() => hxState().tf['4,2']?.d === 'fountain' && !hxState().tf['1,2']?.d), '19. a decoration moves to another hex');
  await p.evaluate(() => { HX3.hk = '4,2'; }); await p.keyboard.press('r'); await sleep(200);
  const w3 = await p.evaluate(() => cdWallet());
  ok(await p.evaluate(() => hxState().tf['4,2'].r === 1) && w3.lumen === w2.lumen && w3.ember === w2.ember, '20. R turns the decoration under the mouse, and moving and turning are free');
  await p.evaluate(() => { ui.hxSel = '4,2'; render(); }); await sleep(200);
  ok(await p.$('#isfull [data-hx="tfturn"]') && await p.$('#isfull [data-hx="tfmove"]'), '21. a decoration\'s card has Turn and Move');
  // reset keeps decorations and fences
  await p.evaluate(() => { ui.hxSel = null; render(); });
  await p.click('.hxtools [data-v="tf"]'); await sleep(300);
  p.once('dialog', d => d.accept());
  await p.click('#isfull [data-hx="tfreset"]'); await sleep(400);
  const r = await p.evaluate(() => hxState().tf);
  ok(Object.values(r).every(v => !v.t && !v.h) && r['4,2']?.d === 'fountain' && r['-3,1']?.e?.[0] === 'fence' && !r['-1,3']?.d, '22. Reset terrain puts the ground back, keeps decorations and fences, and drops boats left on dry land');
  await p.click('#isfull [data-hx="cancel"]'); await sleep(300);
  ok(!errs.length, '23. no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
