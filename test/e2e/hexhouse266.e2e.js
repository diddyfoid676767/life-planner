// 2.66: the house island on hexes, banks, defences, the wall ring and the house walkthrough.
// The house document API is mocked, so no sign-in is needed.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/hexhouse266.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47922' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  // the mocked house document: the old square island with four buildings (array spots), one leader
  let doc = null, ut = 1; const puts = [];
  await p.route('**/api/account/house**', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { doc, ut: 'u' + ut, uid: 'u1', user: 'eli' } });
    const j = r.request().postDataJSON(); if (j.ut !== 'u' + ut) return r.fulfill({ status: 409, json: { error: 'changed' } });
    doc = j.doc; ut++; puts.push(JSON.parse(JSON.stringify(doc))); return r.fulfill({ json: { ut: 'u' + ut } });
  });
  await p.clock.setFixedTime(new Date('2026-11-14T15:00:00'));
  await p.goto('http://127.0.0.1:47922/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  const term = await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); ui.clsSeen = true; D.settings.setupDone = true; D.settings.seenVersion = '2.66.0'; D.settings.guidesSeen = ['hexmove', 'hexhouse'];
    hsState().id = 'flinders'; acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; const c = cdState(); c.got = { l: 5000, e: 5000 }; save(); return hiTerm().id; });
  await sleep(300); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  const B = (s, r, extra = {}) => ({ s, r, reps: [], by: 'eli', lv: 1, ...extra });
  doc = { c: { u1: { n: 'eli', l: 6000, e: 6000 } }, ld: { t: term, u: ['eli'] }, sp: { l: 1000, e: 1000 },
    b: { library: B('2026-09-01', '2026-09-29', { at: [3, 4] }), banner: B('2026-09-01', '2026-09-08', { at: [10, 2] }), pier: B('2026-09-02', '2026-09-09', { at: [1, 1] }), steps: B('2026-09-03', '2026-10-01', { at: [14, 14] }), _boss: { t: {}, r: {} } } };
  // 1. opening the house island moves it onto hexes, once, with roads
  await p.evaluate(() => { view = 'islands'; ui.isTab = 'house'; render(); });
  await p.waitForFunction(() => HI.doc && Array.isArray(HI.doc.b?._rd), null, { timeout: 20000 }).catch(() => { }); await sleep(800);
  const mig = puts.find(d => Array.isArray(d.b._rd));
  ok(!!mig && ['library', 'banner', 'pier', 'steps'].every(k => typeof mig.b[k].at === 'string'), '1. old buildings got hex spots ' + JSON.stringify(mig && Object.fromEntries(Object.entries(mig.b).map(([k, v]) => [k, v.at]))));
  ok(await p.evaluate(() => { const lk = hhLinkedKeys(); return ['library', 'banner', 'pier', 'steps'].every(k => lk.has(k)); }), '1b. every building got a free road to the great hall, pier touches the water');
  ok(mig && mig.sp.l === 1000 && mig.sp.e === 1000, '1c. the move cost the pool nothing');
  ok(await p.evaluate(() => { const st = hhSt(), at = HI.doc.b.steps.at; return hxFoot(hhItem('steps'), at).every(f => hxAt(f, st).kind === 'b'); }), '1d. temple steps cover 3 hexes');
  ok(await p.evaluate(() => hiPerks().sp > 0 && hiPerks().wk > 0), '1e. house perks work after the move ' + await p.evaluate(() => JSON.stringify(hiPerks())));
  // 2. it draws on hexes
  await p.waitForFunction(() => HX3.kit && IS3.house === 'hexh', null, { timeout: 20000 }).catch(() => { }); await sleep(1500);
  ok(await p.evaluate(() => IS3.house === 'hexh' && IS3.world.children.length > 200), '2. house island built in 3D on hexes ' + await p.evaluate(() => IS3.house + ' ' + IS3.world.children.length));
  await p.screenshot({ path: S + '/house-hex.png' });
  ok(await p.$('#isfull [data-hi=tool][data-v=road]') && await p.$('#isfull [data-hi=tool][data-v=wall]'), '2b. leaders get Roads and Walls');
  // 3. an unlinked building loses its perk; a road brings it back
  await p.evaluate(() => { HI.doc.b._rd = []; HI.ut += 'x'; });
  ok(await p.evaluate(() => !hhLinkedKeys().has('library') && !(hiPerks().sp > 0)), '3. no road, no perk');
  await p.evaluate(() => { HI.doc = JSON.parse(JSON.stringify(window.__d = HI.doc)); }); // keep
  await p.evaluate(() => { HI.at = 0; return hiLoad(true); }); await sleep(600);
  ok(await p.evaluate(() => hhLinkedKeys().has('library')), '3b. the saved roads link it again');
  // 4. start a Lumen Bank with the mouse: ghost, drop on a hex, pool pays
  const pt = k => p.evaluate(k => { const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, k);
  const spot = await p.evaluate(() => { const st = hhSt(), L = hhLand(); return [...L.keys()].filter(k => L.get(k).d >= 2 && L.get(k).d <= 3).find(k => { if (!hxCheck('lbank', k, st).ok || hxCheck('lbank', k, st).warn.length) return false; const [x, z] = hxPos(...hxQR(k)), v = new THREE.Vector3(x, 0, z).project(IS3.cam), r = IS3.canvas.getBoundingClientRect(); return document.elementFromPoint(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height) === IS3.canvas; }); });
  await p.evaluate(() => { ui.isPanel = 'shop'; render(); }); await sleep(300);
  ok(await p.evaluate(() => /Lumen Bank/.test(document.querySelector('#isfull .ispanel').innerText) && /Defences/i.test(document.querySelector('#isfull .ispanel').innerText)), '4. Projects lists the banks and defences');
  await p.click('#isfull [data-hi=start][data-id=lbank]'); await sleep(300);
  const [sx, sy] = await pt(spot); await p.mouse.move(sx - 30, sy); await p.mouse.move(sx, sy, { steps: 4 }); await sleep(300);
  ok(await p.evaluate(() => ui.hxP?.id === 'lbank' && !!HX3.ghost && ui.hxP.chk?.ok), '4b. the bank follows the mouse, green on ' + spot);
  await p.screenshot({ path: S + '/house-ghost.png' });
  const n0 = puts.length; await p.mouse.click(sx, sy); await sleep(1200);
  const d4 = puts[puts.length - 1];
  ok(puts.length > n0 && d4.b.lbank?.at === spot && d4.sp.l === 1600 && d4.sp.e === 1200, '4c. started on that hex, paid from the pool ' + JSON.stringify(d4.b.lbank) + JSON.stringify(d4.sp));
  ok(await p.evaluate(() => ui.isSel === 'lbank' && !!document.querySelector('.ispop')), '4d. its card opens');
  // 5. drag across hexes to lay roads, saved in one go
  const free = await p.evaluate(() => { const st = hhSt(), L = hhLand(); const ks = [...L.keys()].filter(k => L.get(k).d === 3 && hxCheck('road', k, st).ok); for (const a of ks) for (const n of hxNb(a)) if (ks.includes(n)) return [a, n]; return null; });
  await p.evaluate(() => { ui.isSel = null; render(); }); await sleep(200); await p.click('#isfull [data-hi=tool][data-v=road]'); await sleep(300);
  const [r1x, r1y] = await pt(free[0]), [r2x, r2y] = await pt(free[1]); const n5 = puts.length;
  await p.mouse.move(r1x, r1y); await p.mouse.down(); await p.mouse.move(r2x, r2y, { steps: 6 }); await p.mouse.up(); await sleep(1200);
  const d5 = puts[puts.length - 1];
  ok(puts.length === n5 + 1 && free.every(k => d5.b._rd.includes(k)) && d5.sp.l === 1610 && d5.sp.e === 1210, '5. two roads laid in one save, 5+5 each ' + JSON.stringify(d5.sp));
  await p.click('#isfull [data-hx=cancel]'); await sleep(300);
  ok(await p.evaluate(() => !ui.hxP && !ui.isPanel), '5b. Done closes the road tool and opens nothing else');
  // 6. walls: slots by house level, a closed ring keeps the raid out
  ok(await p.evaluate(() => { const ring = [...hhLand().keys()].filter(k => hhLand().get(k).d === 1); return hhRingOf({ b: { _rd: [], _wl: ring } }) && !hhRingOf({ b: { _rd: [], _wl: ring.slice(1) } }) && hhRingOf({ b: { _rd: [], _wl: ['g' + ring[0], ...ring.slice(1)] } }); }), '6. a closed ring (gates count) is detected, a gap isn\'t');
  ok(await p.evaluate(() => hhSlots(2).wall === 6 && hhSlots(7).tower === 6 && hhSlots(7).guard === 4 && hhSlots(1).wall === 0), '6b. defence space by house level');
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(HI.doc)); d.b._wl = Array(30).fill('9,9'); return hiCanStart(d, hiItem('guard')) === '' && /tower/.test(hiCanStart({ ...d, b: { ...d.b, 'archer.1': {}, 'archer.2': {}, 'archer.3': {}, 'archer.4': {}, 'magetw.1': {} } }, hiItem('archer'))); }), '6c. towers are limited by house level');
  // 7. bank interest: 1% a day on up to 500 x level, credited lazily into the pool
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(HI.doc)); d.b.lbank.s = '2026-11-01'; d.b.lbank.r = '2026-11-10'; const p0 = hiPool(d).l; hhBankTick(d); const g = d.b.lbank.i; hhBankTick(d); return g === 20 && d.b.lbank.i === 20 && hiPool(d).l === p0 + 20 && d.b.lbank.d === today(); }), '7. bank pays 4 days x 1% of 500 once');
  // 8. drag a building to move it
  const lib = await p.evaluate(() => HI.doc.b.library.at), to = await p.evaluate(() => { const st = hhSt(), L = hhLand(); return [...L.keys()].filter(k => L.get(k).d === 2).find(k => hxCheck('library', k, st, HI.doc.b.library.at).ok); });
  const [lx, ly] = await pt(lib), [tx, ty] = await pt(to); const n8 = puts.length;
  await p.evaluate(() => { ui.isSel = null; render(); }); await sleep(300);
  await p.mouse.move(lx, ly); await p.mouse.down(); await p.mouse.move(lx + 20, ly + 5, { steps: 3 }); await p.mouse.move(tx, ty, { steps: 8 }); await sleep(200);
  ok(await p.evaluate(() => ui.hxP?.mode === 'move' && ui.hxP.key === 'library'), '8. pressing and dragging lifts the library');
  await p.mouse.up(); await sleep(1200);
  ok(puts.length === n8 + 1 && puts[puts.length - 1].b.library.at === to, '8b. moved to ' + to + ' and saved ' + JSON.stringify(puts[puts.length - 1]?.b.library));
  // 9. a non-leader can look but not build
  await p.evaluate(() => { HI.user = 'sam'; render(); }); await sleep(400);
  ok(!(await p.$('#isfull [data-hi=tool]')) && await p.evaluate(() => hxPlace({ id: 'archer', mode: 'new' }, '2,2') === false || !hhCanEdit()), '9. non-leaders get no tools');
  await p.evaluate(() => { HI.user = 'eli'; render(); }); await sleep(300);
  // 10. the walkthrough, and the old island tab still works
  await p.evaluate(() => guideStart('hexhouse')); await sleep(1200);
  let steps = 0, spots = 0;
  for (let i = 0; i < 8 && await p.evaluate(() => guideOn()); i++) { await sleep(900); steps++; if (await p.$('#guidefx .gd-spot')) spots++; if (i === 3) await p.screenshot({ path: S + '/house-guide.png' }); await p.click('#guidefx [data-gd=next]'); }
  ok(steps === 5 && spots >= 4, `10. house guide walked ${steps} steps, ${spots} with a spotlight`);
  await p.evaluate(() => { ui.isTab = 'personal'; render(); }); await sleep(1500);
  ok(await p.evaluate(() => IS3.house === 'hex' && hxCheck('cottage', '1,1') && IS3.world.children.length > 150), '10b. your own hex island still draws');
  await p.evaluate(() => { ui.isTab = 'house'; render(); }); await sleep(1500);
  ok(await p.evaluate(() => IS3.house === 'hexh'), '10c. and back to the house island');
  ok(errs.length === 0, '11. no page errors ' + errs.join('|'));
  await b.close(); app.kill(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
