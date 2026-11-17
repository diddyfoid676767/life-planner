// 2.97: Morrow, the Ever-Waiting: the second Souls boss, in the Hall of Hours.
// 2.102: reworked into a time mage: thrown clock hands, Promises, Echoes, Pendulums, Midnight, Deadline.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/morrow2102.e2e.js DIR

const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47932' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47932/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const shot = n => p.screenshot({ path: S + '/' + n + '.png' });
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; save();
      ftState().att = {}; ftState().bonus = {}; delete ftState().soSeen; const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id; save();
      // make this Morrow's week
      const i = HS_BOSSES.indexOf(hsBoss(mondayOf(today()))), j = HS_BOSSES.findIndex(b => b.n === 'The Procrastinator'); [HS_BOSSES[i], HS_BOSSES[j]] = [HS_BOSSES[j], HS_BOSSES[i]]; bossWeek = () => 'on';
      // (a fresh bar: the sample house may have beaten this week's boss already, which ends a house fight at once)
      const hf = hsFight; hsFight = h => ({ ...hf(h), hp: 99999, left: 99999, dead: false }); });
    // 1. Morrow's week has a Souls fight, and the island shows Morrow in its hall
    ok(await ev(() => soWeekDef()?.key === 'The Procrastinator' && soGolemWeek()), '1. Morrow\'s week has a Souls fight');
    await ev(() => { localStorage.setItem('solisDev', '1'); ui.isTab = 'boss'; ui.isPanel = null; view = 'islands'; IS3.sig = null; render(); }); await sleep(1500);
    // (the sample house may already have beaten it: then it lies fallen and grey, with no idle animation)
    const dead = await ev(() => !!hsFight(hsState().id)?.dead);
    ok(await until(d => BI_IDLE.fires.length === 2 && (d ? !BI_IDLE.gs : !!BI_IDLE.gs?.hg && BI_IDLE.gs.root.parent), dead, 40), '1b. the boss island shows the rigged Morrow in the Hall of Hours, candles burning' + (dead ? ' (beaten this week)' : ''));
    await sleep(1200); await shot('m-island');
    // 2. the intro card, then the cinematic
    await p.click('.is-br [data-so="house"]'); await sleep(400);
    ok(await ev(() => SO?.intro && SO.def.key === 'The Procrastinator' && /Morrow, the Ever-Waiting/.test(document.querySelector('.so-intro').textContent)), '2. intro card: Morrow, the Ever-Waiting');
    await shot('m-card');
    await p.click('[data-so="go"]');
    ok(await until(() => SO && SO.cine && SO.R && SO.gs && SO.gs.hg), '2b. the fight opens on the intro with the rigged Morrow');
    ok(await ev(() => ftAttempts().left >= 0 && SO.kind === 'house'), '2c. a real house fight');
    const ht = await ev(() => { SO.gs.root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(SO.gs.root); return [bb.max.y - bb.min.y, bb.max.x - bb.min.x]; });
    ok(ht[0] > 5 && ht[0] < 9, '2d. a towering size ' + ht.map(x => x.toFixed(2)));
    await sleep(900); await shot('m-cine1');
    await p.keyboard.press('x'); await sleep(200);
    ok(await ev(() => !!SO.cine), '2e. the first time, the intro cannot be skipped');
    await until(() => SO.cine && SO.cine.t > 3.6, null, 40); await shot('m-cine-face');
    ok(await until(() => SO.B.state === 'roar' && SO.gs.cur === 'Spell_Simple_Enter', null, 80), '2f. it draws itself up as the great bell tolls'); await shot('m-cine-roar');
    ok(await until(() => document.querySelector('.so-title.on')?.textContent.includes('Morrow'), null, 60), '2g. its name across the screen'); await sleep(500); await shot('m-cine-title');
    ok(await until(() => !SO.cine, null, 60), '2h. the intro ends and the fight begins'); await sleep(800); await shot('m-start');
    ok(await ev(() => ftState().soSeen?.['The Procrastinator'] === 1), '2i. Morrow\'s intro marked seen');
    // (off the house bar from here, so poking at the numbers can't 'beat' the sample house's boss)
    await ev(() => { SO.shared = null; SO.fhp = Math.max(SO.fhp, 20000); window._soEnd = soEnd; soEnd = how => { (window._ends = window._ends || []).push(how + '@' + SO.time.toFixed(1) + ' ' + new Error().stack.split('\n')[2]); if (how === 'dead') { SO.P.hp = SO.P.max; return; } _soEnd(how); }; });
    // 3. the arena: lit by real lights, the sunset through the windows
    ok(await ev(() => SO.torches.length === 10 && SO.torches.every(t => t.lit === 1) && SO.torches.filter(t => t.light).length >= 2 && SO.mrSun?.castShadow !== undefined), '3. candelabras and votive racks all lit, with real lights (' + await ev(() => SO.torches.filter(t => t.light).length) + ') and the sunset light');
    // 4. Act now: double damage in the first 20 s; waiting makes it faster
    const act = await ev(() => { const B = SO.B; SO.me.reveal = 0; SO.me.emp = 0; SO.me.buff = 1; SO.me.rally = 0; B.mark = 0; B.stag = 0; B.stuck = 0; Object.assign(B, { state: 'recover', guard: false, t: 1 }); SO.time = 5; const d0 = SO.dealt; soHit(100, { weakHit: false }); const a = SO.dealt - d0; SO.time = 25; const d1 = SO.dealt; soHit(100, { weakHit: false }); return [a, SO.dealt - d1]; });
    ok(act[0] > act[1] * 1.7, '4. Act now: a hit in the first 20 s does double (' + act + ')');
    const wait = await ev(() => { const B = SO.B; SO.spX = 1; B.idleT = 9.99; Object.assign(B, { state: 'idle', t: 5 }); SO.lastPh = soPhase(); mrStep(1 / 60); return SO.spX; });
    ok(wait > 1, '4b. waiting 10 s makes it faster (×' + wait + ')');
    const arm = await ev(() => { const B = SO.B; SO.time = 30; Object.assign(B, { state: 'wind', atk: { k: 'hand', w: 1 }, t: 1, guard: false }); const d0 = SO.dealt; soHit(100, { weakHit: false }); const a = SO.dealt - d0; B.state = 'idle'; return a; });
    ok(arm <= 12, '4c. guarded outside its openings (' + arm + ')');
    await ev(() => { SO.spX = 1; SO.dealt = 0; });
    // 5. phases at 70/40/15% of this fight's bar, with a toll
    const ph = await ev(() => { const r = []; for (const f of [.35, .65, .9]) { SO.dealt = SO.fhp * f; r.push(soPhase()); } SO.dealt = 0; return r; });
    ok(ph.join() === '1,2,3', '5. phases ' + ph);
    const roar = await ev(() => { SO.lastPh = 0; SO.dealt = SO.fhp * .35; SO.B.state = 'idle'; SO.B.stag = 0; mrStep(1 / 60); const r = SO.B.state; SO.dealt = 0; SO.lastPh = 0; SO.B.state = 'idle'; return r; });
    ok(roar === 'roar', '5b. a new phase starts with the bell');
    // 6. every move: its own clip and warning, and it lands hits
    await ev(() => { SO.shared = null; SO.time = 30; });
    let clips = 0;
    const MOVES = ['hand', 'hands', 'still', 'promise', 'rewind', 'away', 'echo', 'pendulum', 'midnight', 'deadline'];
    const phOf = { echo: .35, pendulum: .35, midnight: .65, deadline: .9 };
    for (const k of MOVES) {
      await ev(([k, f]) => { soClearTele(); mrEnd(); const B = SO.B; SO.dealt = SO.fhp * (f || .1); SO.lastPh = soPhase();
        Object.assign(B, { x: 0, z: -4, y: 0, state: 'idle', queue: [k], cool: {}, t: 0, stag: 0, face: 0, greed: [] });
        if (k === 'rewind') B.trail = [{ x: 6, z: -6, t: SO.time - 3 }];
        SO.me.x = 0; SO.me.z = k === 'hand' ? -.5 : k === 'still' ? 3 : 4.5; SO.me.vx = 0; SO.me.vz = 0; SO.me.y = 0; SO.P.hp = SO.P.max; SO.me.act = null; SO.me.iTo = -1; SO.me.block = false; SO.me.frozen = 0; SO.me.slow = 0;
        window._seen = new Set(); clearInterval(window._seenT); window._seenT = setInterval(() => { if (SO?.gs) { _seen.add(SO.gs.cur); _seen.add(SO.B.state); _seen.add(SO.B.atk?.k); if (SO.tele.length) _seen.add('tele'); for (const n of ['mrHands', 'mrBlades', 'mrProm', 'mrEchoes', 'mrPend']) if (SO[n]?.length) _seen.add(n); if (SO.mrDoom) _seen.add('doom'); } }, 5); }, [k, phOf[k]]);
      const want = { hand: 'Sword_Regular_B', hands: 'mrBlades', still: 'Spell_Simple_Shoot', promise: 'mrProm', rewind: 'air', away: 'mrBlades', echo: 'mrEchoes', pendulum: 'mrPend', midnight: 'mrHands', deadline: 'doom' }[k];
      const h0 = await ev(() => SO.stats.hurt);
      const seen = await until(w => _seen.has(w), want, 24); if (seen) clips++; else console.log('  not seen for ' + k + ': ' + await ev(() => [..._seen].join(',')));
      await sleep({ hands: 250, away: 700, promise: 500, echo: 700, pendulum: 900, midnight: 600, deadline: 1500, rewind: 500 }[k] || 150); await shot('m-' + k);
      await sleep({ midnight: 3600, deadline: 2600, pendulum: 2600, echo: 2200, promise: 2600 }[k] || 1600);
      console.log('  ' + k + ': hurt +' + (await ev(() => SO.stats.hurt) - h0) + ' (seen ' + await ev(() => [..._seen].filter(x => x && !/_/.test(x)).join(',')) + ')');
    }
    ok(clips >= 10, '6. each move plays out (' + clips + '/10)');
    ok(await ev(() => SO.stats.hurt >= 6 && !SO.over), '6b. Morrow lands hits (' + await ev(() => SO.stats.hurt) + ')');
    // 6c. it's a ranged fighter now: at a distance it throws and casts, it only swings when you crowd it
    const mix = await ev(() => { const B = SO.B, far = {}, near = {}; SO.dealt = SO.fhp * .5; SO.lastPh = soPhase();
      for (let i = 0; i < 120; i++) { for (const [M, z] of [[far, 9], [near, -1]]) { B.queue = []; B.cool = {}; B.hist = []; Object.assign(B, { x: 0, z: -4, face: 0, trail: [] }); SO.me.x = 0; SO.me.z = z; mrPick(soDist(B, SO.me), soPhase()); M[B.atk.k] = (M[B.atk.k] || 0) + 1; soClearTele(); mrEnd(); } }
      B.state = 'idle'; SO.dealt = 0; return [far, near]; });
    ok(!mix[0].hand && (mix[0].hands || 0) > 15 && Object.keys(mix[0]).length >= 5, '6c. at range it never swings, it throws and casts ' + JSON.stringify(mix[0]));
    ok((mix[1].hand || 0) > 20, '6d. crowd it and it swings the Hour Hand ' + JSON.stringify(mix[1]));
    // 6e. exposed while it casts, guarded while it winds up a swing
    const cst = await ev(() => { const B = SO.B; SO.time = 30; Object.assign(B, { state: 'cast', atk: { k: 'promise', w: 1 }, t: 1, stag: 0 }); const a = soOpenNow(); B.state = 'wind'; B.atk = { k: 'hand', w: 1 }; const b2 = soOpenNow(); B.state = 'doom'; const c = soOpenNow(); B.state = 'idle'; return [a, b2, c]; });
    ok(cst[0] && !cst[1] && cst[2], '6e. exposed while casting and during the Deadline, guarded in a wind-up ' + cst);
    // 6f. the phases change its attacks: wider fans and a second wave, two Echoes, three pendulums
    const evo = await ev(() => { const r = {}; for (const [f, n] of [[.1, 0], [.5, 2]]) { SO.dealt = SO.fhp * f; r[n] = mrFan(soPhase()).length; } SO.dealt = 0; return r; });
    ok(evo[0] === 3 && evo[2] === 5, '6f. three clock hands in the first phase, five later ' + JSON.stringify(evo));
    const wave = await ev(() => { mrEnd(); const B = SO.B; SO.dealt = SO.fhp * .5; SO.lastPh = soPhase(); Object.assign(B, { x: 0, z: -4, face: 0, state: 'wind', atk: { k: 'hands', w: .5, offs: mrFan(2) }, t: 0 }); SO.me.z = 6; mrStrike(B.atk, 2); const n1 = SO.mrBlades.length; for (let i = 0; i < 40; i++) mrHaz(1 / 60); const n2 = SO.mrBlades.length; mrEnd(); SO.dealt = 0; B.state = 'idle'; return [n1, n2]; });
    ok(wave[0] === 5 && wave[1] > 5, '6g. No Time to Rest: a second wave follows the first ' + wave);
    // 7. Stillness freezes you; the Last Hour slows you after a big hit
    const frz = await ev(() => { const B = SO.B, M = SO.me; Object.assign(B, { x: 0, z: -4, face: 0, state: 'idle', queue: [], stag: 0 }); Object.assign(M, { x: 0, z: 1, act: null, iTo: -1, block: false, frozen: 0, y: 0 }); SO.P.hp = SO.P.max; B.atk = { k: 'still', w: .5 }; mrStrike(B.atk, 0); const f = M.frozen; const x0 = M.x; SO.keys = { d: true }; for (let i = 0; i < 20; i++) soStep(1 / 60); SO.keys = {}; return [f, Math.abs(M.x - x0)]; });
    ok(frz[0] > .5 && frz[1] < .01, '7. Stillness freezes you in time (' + frz[0] + ' s, moved ' + frz[1].toFixed(3) + ')');
    const slow = await ev(() => { const M = SO.me; M.frozen = 0; M.slow = 0; SO.dealt = SO.fhp * .9; SO.lastPh = 3; M.act = null; M.iTo = -1; soHurtBy({ ...MR_MV.hand, k: 'hand' }); const s = M.slow; SO.dealt = 0; SO.lastPh = 0; M.slow = 0; SO.P.hp = SO.P.max; return s; });
    ok(slow > 1.5, '7b. in the Last Hour a big hit slows you (' + slow + ' s)');
    // 8. Deadline: inside a circle of light you're safe, outside you're hit
    const dl = await ev(() => { const r = []; for (const inside of [1, 0]) { mrEnd(); const B = SO.B, M = SO.me, P = SO.P; SO.dealt = SO.fhp * .9; SO.lastPh = 3; P.hp = P.max; Object.assign(M, { act: null, iTo: -1, block: false, y: 0 }); mrDeadline(3); const s = SO.mrDoom.safes[0];
      if (inside) { M.x = s.x; M.z = s.z; } else { M.x = -s.x * .1; M.z = -s.z * .1; if (SO.mrDoom.safes.some(q => Math.hypot(q.x - M.x, q.z - M.z) < 2.6)) { M.x = 0; M.z = 0; } }
      const h0 = P.hp; for (let i = 0; i < 230; i++) mrHaz(1 / 60); r.push(Math.round((1 - P.hp / h0) * 100)); } SO.dealt = 0; SO.lastPh = 0; SO.P.hp = SO.P.max; SO.B.state = 'idle'; return r; });
    ok(dl[0] === 0 && dl[1] > 40, '8. Deadline: safe in the light, ' + dl[1] + '% outside it');
    // 8b. pendulums hit in their lane, not beside it
    const pd = await ev(() => { const r = []; for (const off of [0, 4]) { mrEnd(); const M = SO.me, P = SO.P; P.hp = P.max; Object.assign(M, { x: off, z: 0, act: null, iTo: -1, block: false, y: 0 }); const tm = mrFloorMesh(new THREE.PlaneGeometry(2.6, 30), '#f00', 0, 0); SO.mrPend.push({ ang: 0, off: 0, nx: 1, nz: 0, t: 0, w: 1, tm, dir: 1 }); for (let i = 0; i < 90; i++) mrHaz(1 / 60); r.push(Math.round((1 - P.hp / P.max) * 100)); } SO.P.hp = SO.P.max; return r; });
    ok(pd[0] > 30 && pd[1] === 0, '8b. a pendulum hits in its lane (' + pd[0] + '%) and misses beside it (' + pd[1] + '%)');
    // 9. weak points: the hourglass face takes spell hits as weak; behind it, the clock in its back
    ok(await ev(() => SO_DEFS['The Procrastinator'].weakBone('Head') && !!soBody().crystal), '9. the hourglass face and the back clock are weak points');
    const vary = await ev(() => { const B = SO.B, ms = new Set(), ws = new Set(); for (const f of [.1, .5, .9]) { SO.dealt = SO.fhp * f; for (let i = 0; i < 40; i++) { B.queue = []; B.cool = {}; Object.assign(B, { x: 0, z: -4, face: 0, trail: [{ x: 6, z: 6, t: SO.time - 3 }] }); SO.me.x = 0; SO.me.z = i % 3 === 0 ? -.5 : i % 3 === 1 ? 4 : 9; mrPick(soDist(B, SO.me), soPhase()); ms.add(B.atk.k); ws.add(Math.round(B.atk.w * 20)); soClearTele(); mrEnd(); } } B.state = 'idle'; SO.dealt = 0; return [ms.size, ws.size]; });
    ok(vary[0] >= 9 && vary[1] >= 6, '9b. varied moves (' + vary[0] + ') and tempos (' + vary[1] + ')');
    // 10. felling it
    await ev(() => { mrEnd(); SO.dealt = SO.fhp + 1; SO.P.hp = SO.P.max; }); await sleep(3200);
    const res = await ev(() => document.querySelector('.so-end')?.textContent || '');
    console.log('  ends: ' + await ev(() => JSON.stringify([window._ends, SO.over, SO.B.state, SO.gs.cur, SO.dealt, SO.fhp, SO.time])));
    ok(/MORROW FELLED/.test(res) && await ev(() => SO.gs.cur === 'Death01'), '10. bringing the bar down fells it');
    ok(/Morrow/.test(res), '10b. the damage goes on Morrow\'s bar');
    await shot('m-felled');
    await p.click('[data-so="close"]'); await sleep(400);
    // 11. the owner's test fight can pick either boss; Somnus still works
    await ev(() => soOpen('test')); await sleep(300);
    ok(await ev(() => document.querySelectorAll('.so-pick button').length === 2), '11. the test fight lets you pick the boss');
    await p.click('.so-pick [data-b="Snooze Golem"]'); await sleep(200);
    ok(await ev(() => SO.def.key === 'Snooze Golem' && /Somnus/.test(document.querySelector('.so-intro h2').textContent)), '11b. picking Somnus');
    await p.click('[data-so="go"]'); await until(() => SO && SO.cine && SO.gs);
    ok(await ev(() => !!SO.gs.plates && SO.torches.length === 10), '11c. Somnus\'s hall and body as before');
    await sleep(1500); await shot('m-somnus');
    await ev(() => soCineEnd()); await sleep(1500);
    ok(await ev(() => SO && !SO.cine && SO.B.state !== 'sleep'), '11d. the Golem fight still runs');
    await ev(() => soEnd('quit')); await sleep(400); await ev(() => soClose());
    // 12. second time: Morrow's intro can be skipped; a real look at it in play
    await ev(() => soOpen('test', 'The Procrastinator')); await sleep(200); await p.click('[data-so="go"]'); await until(() => SO && SO.cine);
    await sleep(500); await p.keyboard.press('x'); await sleep(300);
    ok(await ev(() => SO && !SO.cine && SO.B.state !== 'sleep'), '12. after the first time, the intro skips');
    await ev(() => { if (!window._soEnd) { window._soEnd = soEnd; soEnd = how => { if (how === 'dead') { SO.P.hp = SO.P.max; return; } _soEnd(how); }; } });
    for (let i = 0; i < 4; i++) { await sleep(1800); await shot('m-play' + i); }
    ok(await ev(() => Number.isFinite(SO.P.hp) && Number.isFinite(SO.B.x) && SO.stats.hurt > 0), '12b. it fights on its own (hits on you: ' + await ev(() => SO.stats.hurt) + ')');
    await ev(() => { soEnd = _soEnd; soEnd('quit'); }); await sleep(400); await ev(() => soClose());
  } catch (e) { fails++; console.log('ERR', e); }
  ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
