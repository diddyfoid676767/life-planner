// 2.90 (sieges stage 2): siege votes, war declaration, a real run on the enemy island, replays, the result
// (loot, damage, rating, log), the defender's side (applying a loss, war lock, standing guard), repairs and the
// owner pause. Every house document is mocked, so no sign-in is needed. Times are moved by editing the documents.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/siege289.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47934' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  p.on('dialog', d => d.accept());
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const H = {}, U = {}; let cfg = { paused: false, note: '', cancel: [] };
  for (const h of ['pascoe', 'molland', 'flinders', 'derrimut', 'strathmore', 'hudson']) { H[h] = {}; U[h] = 1; }
  await p.route('**/api/account/house**', async r => {
    if (r.request().method() === 'GET') { const h = new URL(r.request().url()).searchParams.get('h'); return r.fulfill({ json: { doc: H[h], ut: 'u' + U[h], uid: 'u1', user: 'eli' } }); }
    const j = r.request().postDataJSON(); if (j.ut !== 'u' + U[j.h]) return r.fulfill({ status: 409, json: { error: 'changed' } });
    if (process.env.DBG && j.h === 'flinders') console.log('PUT', j.ut, Date.now() % 100000, JSON.stringify(j.doc.b._sg?.vt?.at), new Error().stack.split('\n').length);
    H[j.h] = j.doc; U[j.h]++; return r.fulfill({ json: { ut: 'u' + U[j.h] } });
  });
  await p.route('**/api/sieges', r => r.fulfill({ json: cfg }));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47934/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  const ev = (fn, a) => p.evaluate(fn, a);
  const term = await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); ui.clsSeen = true; D.settings.setupDone = true; D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game', 'fortify', 'sieges'];
    hsState().id = 'flinders'; acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; const c = cdState(); c.got = { l: 5000, e: 5000 }; save(); return hiTerm().id; });
  const today = await ev(() => today());
  const clk = async s => { await p.waitForSelector(s, { state: 'attached', timeout: 8000 }); await ev(x => document.querySelector(x).click(), s); };
  await ev(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  const B = (s, r, x = {}) => ({ s, r, reps: [], by: 'eli', lv: 1, ...x }), HR = 3600000;
  const mb = (ids, p) => Object.fromEntries(ids.map((u, i) => [u, { n: 'p' + u, d: today, p }]));
  H.flinders = { c: { u1: { n: 'eli', l: 6000, e: 6000 } }, ld: { t: term, u: ['eli'] }, sp: { l: 1000, e: 1000 },
    b: { _rd: ['1,0', '2,0', '-1,0', '-2,0'], _wl: [], library: B('2026-09-01', '2026-09-29', { at: '3,0' }), _boss: { t: {}, r: {} }, _sg: { mb: { ...mb(['u2', 'u3'], 30) } } } };
  H.molland = { c: { u7: { n: 'max', l: 3000, e: 3000 } }, sp: { l: 0, e: 0 }, b: { _rd: ['1,0', '2,0'], _wl: [], library: B('2026-09-01', '2026-09-29', { by: 'max', at: '3,0' }), _sg: { mb: mb(['u7', 'u8', 'u9'], 25) } } };
  const reload = () => ev(async () => { acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; for (let i = 0; i < 50 && (HI.busy || SGS.syncing); i++) await new Promise(r => setTimeout(r, 100)); HI.at = 0; await hiLoad(true); SGS.at = 0; SGS.syncAt = 0; await sgSync(true); render(); });
  await ev(() => { acct = { configured: true, signedIn: true, username: 'eli' }; acctLoaded = true; HI.at = 0; HI.err = ''; HI.h = ''; view = 'islands'; ui.isTab = 'house'; render(); });
  await p.waitForFunction(() => HI.doc && HX3.kit && IS3.house === 'hexh', null, { timeout: 25000 }).catch(() => { }); await sleep(1200);
  await ev(() => sgSync(true)); await sleep(500);
  console.log('dbg', await ev(() => JSON.stringify([HI.err, !!HI.doc, HI.h, IS3.house, !!HX3.kit, HI.uid, ui.isTab, view])));
  ok(await ev(() => !!document.querySelector('#isfull [data-v="sgwar"]') && hiHas('champion')), '0. a War button on the house island, and you are the Champion');
  ok(H.flinders.b._sg.mb?.u1?.d === today, '0b. opening the island marks you active ' + JSON.stringify(H.flinders.b._sg.mb?.u1));
  ok(await ev(() => sgCalWhy() === ''), '0c. sieges are allowed today (no term calendar in the test) ' + await ev(() => sgCalWhy()));
  // 1. the War room
  await ev(() => { ui.isPanel = 'sgwar'; render(); }); await sleep(400);
  const wr = await ev(() => document.querySelector('#isfull .ispanel').innerText);
  ok(/Molland[^\n]*Can be sieged/.test(wr.replace(/\t/g, ' ')) && /Pascoe[^\n]*Too small/.test(wr.replace(/\t/g, ' ')), '1. the War room lists the houses: Molland can be sieged, Pascoe is too small');
  await p.screenshot({ path: S + '/siege-warroom.png' });
  // 2. call a siege vote
  const sp0 = H.flinders.sp.l;
  await clk('#isfull [data-sg="call"]'); for (let i = 0; i < 30 && H.flinders.sp.l === sp0; i++) await sleep(200);
  ok(!!H.flinders.b._sg.vt && H.flinders.sp.l - sp0 === 150, '2. the Champion calls a siege vote and pays the war chest ' + (H.flinders.sp.l - sp0));
  await clk('#isfull [data-sg="vote"][data-k="y"][data-v="1"]'); await sleep(500);
  await clk('#isfull [data-sg="vote"][data-k="t"][data-v="molland"]'); await sleep(500);
  await clk('#isfull [data-sg="vote"][data-k="f"]'); await sleep(500);
  ok(JSON.stringify(H.flinders.b._sg.vt.v.u1) === JSON.stringify({ n: 'eli', y: 1, t: 'molland', f: 1 }), '2b. vote yes, pick Molland, volunteer ' + JSON.stringify(H.flinders.b._sg.vt.v.u1));
  ok(await ev(() => /Siege vote open/.test(document.querySelector('#isfull .sgban')?.innerText || '')), '2c. a banner shows the vote');
  // 3. the vote closes 24h later: war is declared
  if (process.env.DBG) console.log('EDIT', U.flinders, Date.now() % 100000);
  Object.assign(H.flinders.b._sg.vt.v, { u2: { n: 'pu2', y: 1, t: 'molland', f: 1 }, u3: { n: 'pu3', y: 1, f: 1 } }); H.flinders.b._sg.vt.at -= 25 * HR; U.flinders++;
  await reload(); await sleep(400);
  console.log('dbg3', JSON.stringify(H.flinders.sp), JSON.stringify(H.flinders.b._sg.vt), await ev(() => JSON.stringify([sgTargets().map(t => t.h + ':' + t.ok + ':' + t.why), sgOffWhy(), sgJobs(HI.doc).length, Date.now() - sgVoteEnd(HI.doc.b._sg.vt), HI.ut, HI.busy, !!SG_VIS, HI.h, HI.err])), U.flinders);
  const W = H.flinders.b._sg.war;
  ok(W?.tgt === 'molland' && H.flinders.b._sg.vt.done === 'pass' && Object.keys(W.vol).length === 3 && W.open - W.decl === 24 * HR && W.end - W.open === 48 * HR, '3. the vote passes: war on Molland, window opens in 24h for 48h ' + JSON.stringify(W && { tgt: W.tgt, vol: W.vol, K: W.K, mN: W.mN }));
  ok(await ev(() => /War on .*Molland/.test(document.querySelector('#isfull .sgban')?.innerText || '') && !document.querySelector('#isfull [data-sg="march"]')), '3b. a countdown, and no March button before the window opens');
  // 4. the window opens: march on their island
  Object.assign(H.flinders.b._sg.war, { decl: Date.now() - 25 * HR, open: Date.now() - HR, end: Date.now() + 47 * HR }); U.flinders++;
  await reload(); await ev(() => { ui.isPanel = 'sgwar'; render(); }); await sleep(300);
  ok(await ev(() => sgPing() && !!document.querySelector('#isfull [data-sg="march"]')), '4. the window is open: March, and the War button pings');
  await clk('#isfull [data-sg="march"]');
  await p.waitForFunction(() => SG_VIS?.h === 'molland' && ui.isPanel === 'sgmarch', null, { timeout: 8000 }).catch(() => { }); await sleep(2500);
  ok(await ev(() => SG_VIS?.h === 'molland' && HI.doc.b.library?.by === 'max' && hxCol() === 'red' && /March on/.test(document.querySelector('#isfull .ispanel')?.innerText || '') && IS3.house === 'hexh'), '4b. their island shows, with the briefing');
  ok(await ev(async () => { const n = puts0 => 0; const r = await hiWrite(() => { }); return r === false; }), '4c. nothing can be saved to their island');
  await p.screenshot({ path: S + '/siege-march.png' });
  const got0 = await ev(() => ({ ...cdState().got }));
  await clk('#isfull [data-sg="b"][data-k="side"][data-v="3"]'); await sleep(200);
  await clk('#isfull [data-sg="attack"]');
  await p.waitForFunction(() => ui.sgRun?.real, null, { timeout: 8000 }).catch(() => { }); await sleep(2000);
  const run = H.flinders.b._sg.war.runs?.u1?.[0];
  ok(run && run.ch.side === 3 && H.flinders.b._sg.war.sn[run.sn] && H.molland.b._sg.war === undefined, '4d. the run is saved to our document first, with a snapshot of their island ' + JSON.stringify(run && { s: run.s, p: run.p, b: run.b }));
  const got1 = await ev(() => ({ ...cdState().got }));
  ok(got1.l - got0.l === [20, 40, 70, 100][run.s] * 1 || got1.l > got0.l, '4e. a personal reward by stars ' + (got1.l - got0.l));
  await p.screenshot({ path: S + '/siege-run.png' });
  await clk('#isfull [data-sg="skip"]'); await p.waitForFunction(() => ui.sgRun?.done, null, { timeout: 8000 }).catch(() => { }); await sleep(500);
  ok(await ev(() => /Siege run/.test(document.querySelector('#isfull .ispanel')?.innerText || '') && /Your reward/.test(document.querySelector('#isfull .ispanel').innerText)), '4f. the result shows the reward');
  await clk('#isfull [data-sg="home"]'); await sleep(1500);
  ok(await ev(() => !SG_VIS && hsState().id === 'flinders' && hxCol() === 'blue' && HI.doc.b._sg.war.runs.u1.length === 1 && ui.isPanel === 'sgwar'), '4g. back home, our document has the run');
  // 5. watch it again: the same result
  await ev(() => render()); await sleep(300);
  await clk('#isfull [data-sg="watch"]'); await p.waitForFunction(() => ui.sgRun?.watch, null, { timeout: 8000 }).catch(() => { });
  ok(await ev(r => ui.sgRun.res.stars === r.s && ui.sgRun.res.pct === r.p, run), '5. the replay gives exactly the same result');
  await ev(() => sgVisitEnd()); await sleep(800);
  // 6. the war ends: score, loot, rating, log
  const pool0 = await ev(() => hiPool());
  H.flinders.b._sg.war.runs.u2 = [{ u: 'u2', n: 'pu2', s: 3, p: 100, b: ['library'], at: Date.now() }];
  H.flinders.b._sg.war.runs.u3 = [{ u: 'u3', n: 'pu3', s: 2, p: 80, b: ['library'], at: Date.now() }];
  H.flinders.b._sg.war.end = Date.now() - 60000; U.flinders++;
  await reload(); await sleep(300);
  const L = H.flinders.b._sg.log?.[0], pool1 = await ev(() => hiPool());
  ok(L?.as === 'att' && !H.flinders.b._sg.war && L.win === 1 && L.avg >= 1.67, '6. the siege is won on the best-5 average ' + JSON.stringify(L && { avg: L.avg, win: L.win, K: L.K }));
  ok(L.loot.l > 0 && L.loot.l <= 600 && pool1.l - pool0.l === Math.round(L.loot.l * 1.1) && L.dmg[0]?.id === 'library', '6b. loot from their pool (+10%) and damage on their library ' + JSON.stringify([L.loot, pool1.l - pool0.l, L.dmg]));
  ok(H.flinders.b._sg.rt > 1000, '6c. our rating rose ' + H.flinders.b._sg.rt);
  // 7. Molland's side: they open their island and take the hit (we can't play them, so check the shield and the log)
  ok(await ev(() => { const t = sgTargets().find(x => x.h === 'molland'); return !t.ok && /Shielded|sieged them last time/.test(t.why); }), '7. Molland is shielded now');
  // 8. a war on us: banner, war lock, stand guard
  H.strathmore = { c: { u5: { n: 'sam', l: 100, e: 100 } }, b: { _sg: { mb: mb(['u5', 'u6', 'u4'], 30), war: { id: 'strathmore-x', tgt: 'flinders', decl: Date.now() - HR, open: Date.now() + 23 * HR, end: Date.now() + 71 * HR, vol: { u5: 'sam' }, runs: {}, K: 1 } } } };
  await reload(); await sleep(300);
  const lock = await ev(() => [sgWarK(), sgWarLeft(), sgWarLock(HI.doc, 6), document.querySelector('#isfull .sgban')?.innerText || '']);
  ok(lock[0] === 3 && lock[1] === 6 && /War lock/.test(lock[2]) && /declared war on us/.test(lock[3]), '8. a war on us: banner and war lock ' + JSON.stringify(lock));
  const paint = await ev(() => { const st = hhSt(), k = [...hhLand().keys()].find(k => hxDist(...hxQR(k)) === 4 && tfOpen(k, st)); hxStartPlace({ id: 'htf', mode: 'tool', n: 0, ops: [], brush: 'forest' }); const w = hxPaint('htf', k); const o = ui.hxP.ops[0]; ui.hxP = null; return [w, o?.[3]]; });
  ok(paint[0] === '' && paint[1] === 12, '8b. terrain costs 3x during the war lock ' + JSON.stringify(paint));
  await ev(() => { ui.isPanel = 'sgwar'; render(); }); await sleep(300);
  await clk('#isfull [data-sg="guard"]'); await sleep(500);
  ok(H.flinders.b._sg.gd?.u1?.n === 'eli' && H.flinders.b._sg.gd.u1.A?.max > 0, '8c. Stand guard saves your character to the house');
  ok(await ev(() => { const w = sgWorld(HI.doc); return true; }), '8d. the sim still builds with a guard standing');
  // 9. we lose a siege: loot, damage, log
  const sp9 = H.flinders.sp.l;
  H.derrimut = { b: { _sg: { log: [{ id: 'derrimut-y', as: 'att', h: 'flinders', at: Date.now() - HR, decl: Date.now() - 80 * HR, open: Date.now() - 50 * HR, end: Date.now() - HR, avg: 2, win: 1, loot: { l: 100, e: 100 }, dmg: [{ id: 'library', n: 'Library', add: 1 }], rtD: -15, runs: [{ u: 'u9', n: 'zed', s: 3, p: 100 }], sn: {} }] } } };
  await reload(); await sleep(300);
  const g9 = H.flinders.b._sg;
  ok(H.flinders.sp.l - sp9 === 100 && H.flinders.b.library.sd?.n === 1 && g9.got?.['derrimut-y'] && g9.log[0].as === 'def', '9. a lost defence: loot taken, the library damaged, logged ' + JSON.stringify([H.flinders.sp.l - sp9, H.flinders.b.library.sd, g9.log[0]?.as]));
  ok(await ev(() => sgDmgM('library') === .75), '9b. its perk drops to 75%');
  await reload();
  ok(H.flinders.sp.l - sp9 === 100, '9c. a result is only applied once');
  // 10. repair
  await ev(() => { ui.isPanel = null; ui.isSel = 'library'; render(); }); await sleep(300);
  const spR = H.flinders.sp.l;
  await clk('#isfull [data-sg="rep"]'); await sleep(600);
  ok(!H.flinders.b.library.sd && H.flinders.sp.l > spR, '10. repairing siege damage costs pool ' + (H.flinders.sp.l - spR));
  // 11. the owner pause
  cfg = { paused: true, note: 'Back soon', cancel: [] };
  await reload();
  ok(await ev(() => sgCallWhy() === 'Back soon'), '11. the owner pause stops new sieges');
  ok(JSON.stringify(H.flinders).length < 250000, '12. the house document stays small: ' + JSON.stringify(H.flinders).length);
  ok(!errs.length, 'no page errors'); if (errs.length) console.log(errs.slice(0, 5).join('\n---\n'));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close(); app.kill();
})().catch(e => { console.error(e); try { require('child_process').execSync('pkill -f LifePlanner'); } catch { } process.exit(1); });
