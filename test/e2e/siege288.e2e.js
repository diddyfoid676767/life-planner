// 2.88 (sieges stage 1, "Fortify"): house terrain, the route guard rail, strong terrain cap, the Fortress look,
// the siege sim and Test your defences. The house document API is mocked, so no sign-in is needed.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/siege288.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47933' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  let doc = null, ut = 1; const puts = [];
  await p.route('**/api/account/house**', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { doc, ut: 'u' + ut, uid: 'u1', user: 'eli' } });
    const j = r.request().postDataJSON(); if (j.ut !== 'u' + ut) return r.fulfill({ status: 409, json: { error: 'changed' } });
    doc = j.doc; ut++; puts.push(JSON.parse(JSON.stringify(doc))); return r.fulfill({ json: { ut: 'u' + ut } });
  });
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47933/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  const ev = (fn, a) => p.evaluate(fn, a);
  const term = await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); ui.clsSeen = true; D.settings.setupDone = true; D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game', 'fortify'];
    hsState().id = 'flinders'; acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; const c = cdState(); c.got = { l: 5000, e: 5000 }; save(); return hiTerm().id; });
  await ev(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  const B = (s, r, x = {}) => ({ s, r, reps: [], by: 'eli', lv: 1, ...x });
  doc = { c: { u1: { n: 'eli', l: 6000, e: 6000 } }, ld: { t: term, u: ['eli'] }, sp: { l: 1000, e: 1000 },
    b: { _rd: ['1,0', '2,0', '-1,0', '-2,0'], _wl: [], library: B('2026-09-01', '2026-09-29', { at: '3,0' }), lbank: B('2026-10-01', '2026-10-08', { at: '-3,0' }), _boss: { t: {}, r: {} } } };
  await ev(() => { acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; HI.at = 0; HI.err = ''; HI.h = ''; view = 'islands'; ui.isTab = 'house'; render(); });
  await p.waitForFunction(() => HI.doc && HX3.kit && IS3.house === 'hexh', null, { timeout: 25000 }).catch(() => { }); await sleep(1200);
  ok(await ev(() => hiLevel() === 6 && hhCanEdit()), '0. house level 6, you can build ' + await ev(() => [hiLevel(), HI.err, ui.isTab, view, IS3.house, !!HX3.kit, D.settings.mode].join()));
  ok(await ev(() => !!document.querySelector('#isfull [data-sg="shape"]') && !!document.querySelector('#isfull [data-v="sgtest"]') && !!document.querySelector('#isfull [data-v="sglooks"]')), '1. Shape, Looks and Test buttons on the house island');
  // 2. painting terrain: forest and a moat, paid from the pool, saved in b._sg.tf
  const sp0 = await ev(() => ({ ...HI.doc.sp }));
  const r2 = await ev(async () => {
    const st = hhSt(), open = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 4 && tfOpen(k, st)); window.__open = open;
    hxStartPlace({ id: 'htf', mode: 'tool', n: 0, ops: [], brush: 'forest' });
    const w1 = hxPaint('htf', open[0]); ui.hxP.brush = 'water'; const w2 = hxPaint('htf', open[1]), w3 = hxPaint('htf', '3,0'); ui.hxP.brush = 'cliff'; const w4 = hxPaint('htf', open[2]);
    await hhPaintDone(); return [w1, w2, w3, w4];
  });
  await sleep(300);
  const tf = await ev(() => HI.doc.b._sg?.tf || {}), op = await ev(() => window.__open);
  ok(r2[0] === '' && r2[1] === '' && r2[3] === '' && /building/.test(r2[2]), '2. forest, moat and cliff paint; a building hex is refused ' + JSON.stringify(r2));
  ok(tf[op[0]]?.t === 'forest' && tf[op[1]]?.t === 'water' && tf[op[2]]?.c === 1 && tf[op[2]]?.h === 2, '2b. saved in the house document ' + JSON.stringify(tf));
  const sp1 = await ev(() => ({ ...HI.doc.sp }));
  ok(sp1.l - sp0.l === 4 + 30 + 20 + 20 && sp1.e - sp0.e === 30 + 40 + 4 + 20, '2c. paid from the house pool: ' + JSON.stringify([sp1.l - sp0.l, sp1.e - sp0.e]));
  ok(await ev(() => sgStrongN(HI.doc.b._sg.tf) === 2), '2d. the moat and the cliff count as strong terrain');
  await ev(() => { ui.hxP = null; HX3.sig = ''; render(); }); await sleep(1200);
  await p.screenshot({ path: S + '/siege-terrain.png' });
  // 3. the guard rail: a moat ring all the way round can't be finished
  const ring = await ev(() => {
    const st = hhSaved(), ks = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 5);
    const tf = { ...st.tf }; for (const k of ks.slice(0, -1)) tf[k] = { t: 'water' };
    const openOne = sgRouteOk({ ...st, tf }); tf[ks[ks.length - 1]] = { t: 'water' }; const closed = sgRouteOk({ ...st, tf });
    // painting: the last hex is refused
    hxStartPlace({ id: 'htf', mode: 'tool', n: 0, ops: [], brush: 'water' });
    const saveTf = HI.doc.b._sg.tf, ut0 = HI.ut, cap0 = SG.strong; SG.strong = SG.strong.map(() => 999); HI.doc.b._sg.tf = Object.fromEntries(Object.entries(tf).filter(([k]) => k !== ks[ks.length - 1])); HI.ut += 'x';
    const why = hxPaint('htf', ks[ks.length - 1]); HI.doc.b._sg.tf = saveTf; HI.ut = ut0; SG.strong = cap0; ui.hxP = null;
    return [openOne, closed, why, ks.length];
  });
  ok(ring[0] === true && ring[1] === false && /seal/.test(ring[2]), '3. a ring with a gap is fine, a closed one is refused: ' + JSON.stringify(ring));
  const cliffs = await ev(() => { const st = hhSaved(), ks = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 3), tf = { ...st.tf }; for (const k of ks) tf[k] = { h: 2, c: 1 }; const a = sgRouteOk({ ...st, tf }); tf[ks[0]] = { h: 1 }; const b2 = sgRouteOk({ ...st, tf }); const tf2 = { ...tf }; tf2[ks[0]] = { h: 2, c: 1 }; tf2[hxNb(ks[0]).find(n => hxDist(...hxQR(n)) === 4)] = { h: 1 }; return [a, b2, sgRouteOk({ ...st, tf: tf2 })]; });
  ok(cliffs[0] === false && cliffs[1] === true && cliffs[2] === true, '3b. a cliff ring seals it; a 1-step gap or a ramp opens it ' + JSON.stringify(cliffs));
  // 4. the strong terrain cap
  const cap = await ev(() => { const mx = sgStrongMax(), had = sgStrongN(HI.doc.b._sg.tf); hxStartPlace({ id: 'htf', mode: 'tool', n: 0, ops: [], brush: 'water' }); const ks = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 8); let last = ''; let n = 0; for (const k of ks) { last = hxPaint('htf', k); if (last === '') n++; else if (/strong/.test(last)) break; } ui.hxP = null; return [mx, n + had, last]; });
  ok(cap[0] === 24 && cap[1] === 24 && /strong terrain/.test(cap[2]), '4. strong terrain stops at the house level cap ' + JSON.stringify(cap));
  // 5. the Fortress look: preview, buy, it shows
  await ev(() => { ui.isPanel = 'sglooks'; render(); }); await sleep(300);
  ok(await ev(() => /Stone fortress/.test(document.querySelector('#isfull .ispanel').innerText)), '5. the Looks panel offers the Stone fortress');
  await p.click('#isfull [data-sg="lkpv"][data-v="fortress"]'); await sleep(1500);
  ok(await ev(() => sgFortOn() && !sgFortOwned() && hxLook(false) === SG_FORT_LOOK), '5b. preview shows it without buying');
  p.once('dialog', d => d.accept());
  const spF = await ev(() => ({ ...HI.doc.sp }));
  await p.click('#isfull [data-sg="lkbuy"][data-v="fortress"]'); await sleep(1500);
  ok(await ev(() => sgFortOwned() && HI.doc.b._sg.lk.on === 1 && !ui.sgLkPv) && (await ev(() => HI.doc.sp.l)) - spF.l === 250, '5c. bought from the house pool and switched on');
  await ev(() => { ui.isPanel = null; render(); }); await sleep(2000);
  await p.screenshot({ path: S + '/siege-fortress.png' });
  ok(await ev(() => { let n = 0; IS3.world.traverse(o => { if (o.material?.color?.getHexString?.() === '8f8a80') n++; }); return n > 0; }), '5d. the island sits on grey fortress rock');
  // 5e. 2.95: more house looks, and Island look sits in the House menu
  ok(await ev(() => !!document.querySelector('#isfull .hhhud [data-hm="house"]') && !!document.querySelector('#isfull .hhring [data-v="sglooks"]') && !document.querySelector('#isfull .ishud.is-bl')), '5e. the House menu is on the right, with Island look in it');
  await ev(() => { ui.isPanel = 'sglooks'; render(); }); await sleep(300);
  ok(await ev(() => document.querySelectorAll('#isfull .ispanel .isitem').length >= 8), '5f. eight house looks to choose from');
  const spE = await ev(() => HI.doc.sp.l);
  p.once('dialog', d => d.accept()); await p.click('#isfull [data-sg="lkbuy"][data-v="ember"]'); await sleep(1500);
  ok(await ev(() => sgLkId() === 'ember' && hxLook(false) === SG_HLOOKS.ember && !sgFortOn() && sgFortOwned()) && (await ev(() => HI.doc.sp.l)) - spE === 250, '5g. buying Obsidian forge switches to it');
  await ev(() => { ui.isPanel = null; render(); }); await sleep(2000);
  await p.screenshot({ path: S + '/house-look-ember.png' });
  ok(await ev(() => { let n = 0; IS3.world.traverse(o => { if (o.material?.color?.getHexString?.() === '3b3540') n++; }); return n > 0; }), '5h. on black volcanic rock');
  await ev(() => { ui.isPanel = 'sglooks'; render(); }); await sleep(300);
  const spF2 = await ev(() => HI.doc.sp.l);
  await p.click('#isfull [data-sg="lkuse"][data-v="fortress"]'); await sleep(1200);
  ok(await ev(() => sgFortOn()) && (await ev(() => HI.doc.sp.l)) === spF2, '5i. switching back to an owned look is free');
  await ev(() => { ui.isPanel = null; render(); }); await sleep(800);
  // 5j. 2.97: the new looks on your own island too, with your own Lumen and Ember
  ok(await ev(() => ['fortress', 'blossom', 'frost', 'sands', 'ember', 'jungle'].every(id => HX_THEMES[id]?.l === 250 && HX_THEMES[id].gr) && HX_HOME_W.base() === null), '5j. six new looks for your own island');
  ok(await ev(() => { const st = hxState(), was = st.theme, h3 = IS3.house; IS3.house = 'hex'; st.theme = 'frost'; const b = HX_HOME_W.base(); st.theme = was; IS3.house = h3; return b?.[0] === '#c9d6e4'; }), '5k. Frost keep gives your island icy rock underneath');
  // 5l. building on the house island is marked as the house's
  ok(await ev(() => { hxStartPlace({ id: 'road', mode: 'tool', ops: [] }); render(); const t = document.querySelector('#isfull .hhbar .hhchip')?.innerText || ''; ui.hxP = null; render(); return /House build/.test(t); }), '5l. the house build bar says House build, in the house colour');
  // 5m. 2.101: the great hall has its own model, not the castle your own island's Hall uses
  ok(await ev(() => { const f = hhWorld().free[0], g = f.make(); let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return HX_HOME_W.free.find(x => x.id === 'hall').m === 'building_castle' && n > 40 && g.userData.anim?.length === 1 && IS3.marks['0,0']?.[1] > 2; }), '5m. the great hall is its own building, different from your Hall');
  // 6. the sim: deterministic, terrain and defences matter
  const sim = await ev(() => {
    const A = sgAttacker({ stats: { str: 50, end: 50, spd: 50, agi: 50, foc: 50, log: 50, kno: 50, exp: 50 }, cls: 'striker', power: 1.5, g: {} });
    const bare = { ...HI.doc, b: { ...HI.doc.b, _sg: {} } };
    const r1 = sgRun(bare, { side: 0, prio: 'hall', when: 'hurt' }, A, 's1'), r1b = sgRun(bare, { side: 0, prio: 'hall', when: 'hurt' }, A, 's1');
    // a defended island: a wall ring, towers on raised ground, traps and a guard post
    const d2 = JSON.parse(JSON.stringify(HI.doc)), ring2 = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 2 && !d2.b._rd.includes(k));
    d2.b._wl = ring2; d2.b._sg = { tf: { '0,-4': { h: 1 }, '4,-4': { h: 1 } } };
    Object.assign(d2.b, { 'archer.1': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 3, at: '0,-4' }, 'magetw.1': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 3, at: '4,-4' }, 'archer.2': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 3, at: '-4,0' },
      'spike.1': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 3, at: '3,-1' }, 'snare.1': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 1, at: '4,-1' }, 'guard.1': { s: '2026-10-01', r: '2026-10-08', reps: [], lv: 2, at: '5,-2' } });
    const r2 = sgRun(d2, { side: 0, prio: 'towers', when: 'hurt' }, A, 's2'), weak = { ...A, body: A.body * .4, mind: A.mind * .4, max: A.max * .6 };
    const r3 = sgRun(d2, { side: 0, prio: 'towers', when: 'hurt' }, weak, 's3');
    const w2 = sgWorld(d2), tw = w2.S.filter(s => s.kind === 'tower');
    return { bare: [r1.stars, r1.pct, r1.t], same: JSON.stringify(r1.ev) === JSON.stringify(r1b.ev), def: [r2.stars, r2.pct, r2.t, r2.dead, Object.keys(r2.sum.dmgBy).join('/')], weak: [r3.stars, r3.pct, r3.dead, r3.t], towers: tw.map(t => t.h), ev: r2.ev.slice(0, 12).map(e => e.kind) };
  });
  ok(sim.same, '6. the same seed gives the same siege');
  ok(sim.bare[0] === 3 && sim.bare[1] === 100, '6b. an undefended island falls completely ' + JSON.stringify(sim.bare));
  ok(sim.def[0] < 3 && sim.def[4].length > 0, '6c. a defended island fights back ' + JSON.stringify(sim.def));
  ok(sim.weak[0] <= sim.def[0] && sim.weak[2], '6d. a weak attacker does worse and falls ' + JSON.stringify(sim.weak));
  ok(sim.towers.join() === '1,1,0', '6e. towers on raised ground know their height ' + JSON.stringify(sim.towers) + ' ' + JSON.stringify(sim.ev));
  // moats make attackers go round: the route avoids the water
  const round = await ev(() => { const st = hhSaved(), ks = [...hhLand().keys()].filter(k => hxDist(...hxQR(k)) === 4); const tf = {}; for (const k of ks) { const [x] = hxPos(...hxQR(k)); if (x > -2) tf[k] = { t: 'water' }; } const d2 = JSON.parse(JSON.stringify(HI.doc)); d2.b._sg = { tf }; const A = sgAttacker({ stats: { str: 50, end: 50, spd: 50, agi: 50, foc: 50, log: 50, kno: 50, exp: 50 }, cls: '', power: 1.5, g: {} }); const r = sgRun(d2, { side: 0, prio: 'hall', when: 'hurt' }, A, 'm'); const wet = r.frames.some(f => { const k = hxFromXZ(f[0], f[2]); return tf[k]; }); const west = r.frames.some(f => f[0] < -3); return [wet, west, r.stars]; });
  ok(!round[0] && round[1], '6f. attackers walk round a moat, never through it ' + JSON.stringify(round));
  // 7. Test your defences: briefing, replay, result
  await ev(() => { ui.isPanel = 'sgtest'; render(); }); await sleep(500);
  ok(await ev(() => /Watch the attack/.test(document.querySelector('#isfull .ispanel').innerText) && !!HX3.sgMark && IS3.scene.children.includes(HX3.sgMark)), '7. the briefing shows, with a landing ring on the coast ' + await ev(() => [!!HX3.sgMark, ui.isPanel, IS3.house].join()));
  await p.click('#isfull [data-sg="b"][data-k="side"][data-v="3"]'); await sleep(200);
  ok(await ev(() => sgBrief().side === 3), '7b. pick the west side');
  await p.click('#isfull [data-sg="go"]');
  await p.waitForFunction(() => ui.sgRun && document.getElementById('sghud'), null, { timeout: 8000 }).catch(() => { });
  await sleep(2500); await p.screenshot({ path: S + '/siege-replay.png' });
  ok(await ev(() => !!SGR.H && ui.sgRun.rt > 1 && !!document.querySelector('.sghud .sg-st')), '7c. the replay plays with the HUD ' + await ev(() => ui.sgRun && ui.sgRun.rt.toFixed(1)));
  await ev(() => { ui.sgRun.speed = 4; }); await sleep(4000); await p.screenshot({ path: S + '/siege-replay2.png' });
  await p.click('[data-sg="skip"]').catch(() => { });
  await p.waitForFunction(() => ui.sgRun?.done, null, { timeout: 10000 }).catch(() => { }); await sleep(600);
  ok(await ev(() => /Test result/.test(document.querySelector('#isfull .ispanel')?.innerText || '')), '7d. the result shows ' + await ev(() => document.querySelector('#isfull .ispanel h3')?.innerText));
  await p.screenshot({ path: S + '/siege-result.png' });
  ok(puts.every(d => !d.b?._sg?.runs), '7e. a test saves nothing');
  await p.click('#isfull .ispanel [data-sg="close"]'); await sleep(500);
  ok(await ev(() => !ui.sgRun && !SGR.g && Object.keys(SGR.hid).length === 0), '7f. closing puts the island back');
  // 8. the walkthrough exists
  ok(await ev(() => GUIDES.fortify && GUIDES.fortify.steps.length === 4), '8. the Fortify walkthrough');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join('\n') : ''));
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); try { require('child_process').execSync('pkill -f ' + S + '/LifePlanner'); } catch { } process.exit(1); });
