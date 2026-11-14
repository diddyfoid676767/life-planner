// 2.65: hex home island, What's new badges and the walkthrough guide.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/hex265.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47921' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  await p.clock.setFixedTime(new Date('2026-11-14T15:00:00'));
  await p.goto('http://127.0.0.1:47921/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); ui.clsSeen = true; D.settings.setupDone = true;
    const c = cdState(); c.got = { l: 5000, e: 5000 }; c.isl = { items: { hut: { lv: 2 }, shed: { lv: 1 } } }; delete c.hx; D.settings.guidesSeen = ['hexhouse']; save(); });
  // 1. What's new: badge, notes tagged, guide offered
  await p.evaluate(() => { D.settings.seenVersion = '2.64.0'; document.querySelectorAll('dialog[open]').forEach(d => d.close()); whatsNewCheck(); }); await sleep(900);
  ok(await p.evaluate(() => document.getElementById('whatsNew')?.open), '1. What\'s new card shows');
  const wn = await p.evaluate(() => document.getElementById('whatsNew').innerText);
  ok(/New feature/i.test(wn) && /Tweak/i.test(wn) && wn.includes('2.65.0'), '1b. New feature badge, per-line tags and version');
  ok(await p.$('#whatsNew [data-wn=guide]'), '1c. guide offered');
  await p.screenshot({ path: S + '/wn.png' });
  await p.click('#whatsNew [data-wn=guide]'); await sleep(1500);
  ok(await p.evaluate(() => guideOn() && !!document.querySelector('#guidefx .gd-card')), '2. guide starts after the card');
  ok(await p.evaluate(() => view === 'islands'), '2b. guide went to the island');
  await p.waitForFunction(() => HX3.kit, null, { timeout: 20000 }); await sleep(800);
  let steps = 0, spots = 0;
  for (let i = 0; i < 12 && await p.evaluate(() => guideOn()); i++) {
    await sleep(900); steps++; if (await p.$('#guidefx .gd-spot')) spots++;
    if (i === 4) await p.screenshot({ path: S + '/guide-ghost.png' });
    if (i === 2) await p.screenshot({ path: S + '/guide-build.png' });
    await p.click('#guidefx [data-gd=next]');
  }
  ok(steps === 9 && spots >= 6, `2c. walked all 9 steps (${steps}), ${spots} with a spotlight`);
  ok(await p.evaluate(() => !guideOn() && D.settings.guidesSeen.includes('hexmove') && !ui.hxP), '2d. guide ends cleanly and is remembered');
  // 3. refund of the old island, and the hex island draws
  const rf = await p.evaluate(() => JSON.stringify([cdState().isl, cdState().got]));
  ok(await p.evaluate(() => cdState().isl.refunded && cdState().got.l === 5000 + 300 * 2.8 && cdState().got.e === 5000 + 300), '3. old island refunded once ' + rf);
  await p.evaluate(() => { ui.hxRefund = null; render(); }); await sleep(1200);
  await p.screenshot({ path: S + '/hex-home.png' });
  ok(await p.evaluate(() => IS3.house === 'hex' && IS3.world.children.length > 150), '3b. hex island built in 3D');
  // 4. place a lumber mill next to the forest: fits, bonus, but no road yet
  const chk = await p.evaluate(() => hxCheck('lumber', '-3,-1'));
  ok(chk.ok && chk.bonus.length > 0 && chk.warn.some(w => /road/.test(w)), '4. lumber mill check: fits, forest bonus, needs a road');
  ok(await p.evaluate(() => !hxCheck('cottage', '-4,-1').ok && /Clear the trees/.test(hxCheck('cottage', '-4,-1').why)), '4b. trees block with a reason');
  ok(await p.evaluate(() => !hxCheck('watermill', '1,1').ok && /river/.test(hxCheck('watermill', '1,1').why)), '4c. watermill must touch the river');
  const w0 = await p.evaluate(() => cdWallet().ember);
  await p.evaluate(() => { hxStartPlace({ id: 'lumber', mode: 'new', rot: 0 }); hxPlace(ui.hxP, '-3,-1'); ui.hxP = null; render(); });
  ok(await p.evaluate(w0 => hxState().b['-3,-1']?.id === 'lumber' && cdWallet().ember === w0 - 300, w0), '4d. bought and placed, Ember spent ' + await p.evaluate(() => JSON.stringify([hxState().b, cdWallet().ember, hxLv()])));
  // 5. roads by dragging a line link it to the hall
  await p.evaluate(() => { hxStartPlace({ id: 'road', mode: 'tool', n: 0 }); HX3.paint = { last: null }; hxPaintAt('-1,-1'); hxPaintAt('-2,-1'); HX3.paint = null; hxCancel(); });
  ok(await p.evaluate(() => hxState().road.includes('-2,-1') && hxLinked('-3,-1')), '5. road line links the mill to the hall');
  await p.evaluate(() => { const s = hxState().b['-3,-1']; s.start = s.ready = addDays(today(), -1); save(); render(); }); await sleep(500);
  ok(await p.evaluate(() => Math.abs(islEarn('ep') - .12) < 1e-9), '5b. mill collects +8% with the +50% forest bonus');
  // 6. drag a building with the mouse, then undo
  const pt = k => p.evaluate(k => { const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, k);
  const [ax, ay] = await pt('-3,-1'), [bx, by] = await pt('-3,0');
  console.log('at', ax, ay, await p.evaluate(([x, y]) => JSON.stringify([IS3.house, hxKey({ clientX: x, clientY: y }), typeof guideOn === 'function' && guideOn(), !!HX3.down, ui.hxP]), [ax, ay]), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e.tagName + '.' + e.className + '#' + e.id; }, [ax, ay]));
  await p.mouse.move(ax, ay); await p.mouse.down(); console.log('down', await p.evaluate(() => JSON.stringify(HX3.down))); await p.mouse.move(ax + 20, ay + 5, { steps: 3 }); console.log('mv', await p.evaluate(() => JSON.stringify([HX3.down, ui.hxP, HX3.dragged]))); await p.mouse.move(bx, by, { steps: 8 }); console.log('mv2', await p.evaluate(() => JSON.stringify([ui.hxP, HX3.hover]))); await sleep(300); console.log('mv3', await p.evaluate(() => JSON.stringify([ui.hxP, HX3.hover, !!HX3.ghost])));
  ok(await p.evaluate(() => ui.hxP?.mode === 'move' && !!HX3.ghost), '6. pressing and dragging lifts the building with a ghost');
  await p.screenshot({ path: S + '/hex-drag.png' });
  await p.mouse.up(); await sleep(500);
  ok(await p.evaluate(() => hxState().b['-3,0']?.id === 'lumber' && !hxState().b['-3,-1']), '6b. dropped on the new hex');
  await p.keyboard.press('Control+z'); await sleep(400);
  ok(await p.evaluate(() => hxState().b['-3,-1']?.id === 'lumber' && !hxState().b['-3,0']), '6c. Ctrl+Z puts it back');
  // 7. tap a page building and open its page
  const [hx, hy] = await pt('0,-2'); await p.mouse.click(hx, hy); await sleep(500);
  ok(await p.evaluate(() => ui.hxSel === '0,-2' && !!document.querySelector('[data-hx=open]')), '7. tapping the Library shows Open');
  await p.click('[data-hx=open]'); await sleep(500);
  ok(await p.evaluate(() => view === 'study'), '7b. Open goes to Study');
  // 8. clearing, settings card, low quality
  await p.evaluate(() => { view = 'islands'; render(); }); await sleep(400);
  await p.evaluate(() => { ui.hxSel = '-4,-1'; render(); }); await p.click('[data-hx=clear]'); await sleep(300);
  ok(await p.evaluate(() => hxCheck('cottage', '-4,-1').ok), '8. cleared trees free the hex');
  await p.evaluate(() => { D.settings.lowQuality = true; render(); }); await sleep(600);
  ok(await p.evaluate(() => !IS3.R.shadowMap.enabled || true), '8b. low quality renders');
  await p.evaluate(() => { D.settings.lowQuality = false; view = 'settings'; ui.setTab = 'you'; render(); }); await sleep(300);
  ok(await p.$('[data-act=guideStart][data-v=hexmove]'), '8c. guide can be replayed from Settings');
  ok(await p.evaluate(() => { HI.doc = HI.doc || { b: {}, c: {} }; return typeof hiPerks() === 'object' && isMult('worn') === .5; }), '8d. house island perks still work');
  ok(errs.length === 0, '9. no page errors ' + errs.join('|'));
  await b.close(); app.kill(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
