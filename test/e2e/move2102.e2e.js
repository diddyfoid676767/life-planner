// 2.102: smoother movement and a better roll. Walk/jog/sprint blend, the walk is drawn the same frame it moves,
// the fight draws between its 60 Hz steps, the island isn't drawn under a fight, hex-shaped walls, and the roll:
// tap Shift (or a key picked in Settings), rolls the way you press, a buffered roll, run out of the get-up, i-frame shimmer.
// Usage: build into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/move2102.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47941' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const until = async (fn, arg, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await p.route('https://api.open-meteo.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:47941/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove()); ui.clsSeen = true; D.settings.setupDone = true;
      D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; save(); localStorage.setItem('solisDev', '1'); view = 'islands'; ui.isTab = 'personal'; render();
      ROLL_SHIFT.tap = 5; }); // the test browser is slow: any press here counts as a tap (real taps are timed by the key's own times)
    await until(() => typeof HX3 === 'object' && !!HX3.kit);
    await p.click('[data-wk="on"]');
    ok(await until(() => WK.on && WK.H), '1. walk mode starts'); await sleep(600);
    // the blend: weights always add up to one, and between walk and jog both play, in step
    const bl = await ev(() => { const H = WK.H, out = []; for (const sp of [0, .8, 2.1, 3.5, 5]) { H.loco(sp, { refs: [1.5, 2.7, 4.3] }); H.lc.w = 1; H.locoStep(0); const ws = H.lc.acts.map(a => a.weight); out.push([sp, +ws.reduce((x, y) => x + y, 0).toFixed(3), ws.filter(w => w > .01).length, H.lc.main]); } return out; });
    ok(bl.every(r => Math.abs(r[1] - 1) < .01) && bl[2][2] === 2 && bl[0][3] === 'Idle' && bl[4][3] === 'Running_B', '2. walk, jog and sprint blend by speed ' + JSON.stringify(bl));
    const sync = await ev(() => { const A = WK.H.lc.acts; WK.H.loco(2.1, { refs: [1.5, 2.7, 4.3] }); WK.H.locoStep(.37); return [A[1].time / A[1].getClip().duration, A[2].time / A[2].getClip().duration].map(x => +x.toFixed(3)); });
    ok(Math.abs(sync[0] - sync[1]) < .01, '2b. their steps stay in time ' + sync);
    // drawn once a frame, by the walk loop
    const rr = await ev(() => new Promise(res => { let n = 0, f = 0; const o = IS3.R.render; IS3.R.render = (...a) => { n++; return o.apply(IS3.R, a); }; const t0 = performance.now(); const tick = () => { f++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else { IS3.R.render = o; res([n, f]); } }; requestAnimationFrame(tick); }));
    ok(rr[0] > 0 && rr[0] <= rr[1] + 1, `3. the island is drawn once a frame while you walk (${rr[0]} draws in ${rr[1]} frames)`);
    // hold Shift: sprint, no roll
    await ev(() => { WK.stam = 100; WK.roll = 0; ROLL_SHIFT.tap = .22; });
    await p.keyboard.down('s'); await p.keyboard.down('Shift'); await sleep(1500); // away from the hall, so its door doesn't open
    const sp = await ev(() => ({ st: WK.stam, main: WK.H.lc?.main, rolled: WK.H.cur === 'Roll' || WK.roll > 0 }));
    await p.keyboard.up('Shift'); await p.keyboard.up('s'); await sleep(1200); await ev(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    ok(sp.st < 100 && sp.main === 'Running_B' && !sp.rolled, '4. holding Shift sprints and does not roll ' + JSON.stringify(sp));
    // tap Shift: a roll, the way you're pressing
    await ev(() => { ROLL_SHIFT.tap = 5; WK.stam = 100; WK.roll = 0; });
    await p.keyboard.down('d'); await sleep(150); await until(() => WK.ground, null, 20); await p.keyboard.press('Shift'); await sleep(60);
    const r1 = await ev(() => ({ roll: WK.roll > 0 || WK.rollBuf > 0, cur: WK.H.cur, dot: WK.rollDir[0] * Math.cos(WK.cy) - WK.rollDir[1] * Math.sin(WK.cy), st: WK.stam }));
    ok(r1.roll && r1.dot > .9, '5. a tap of Shift rolls, the way you press (to the right here) ' + JSON.stringify(r1));
    ok(await until(() => WK.H.cur === 'Roll', null, 12), '5b. with the somersault');
    ok(await until(() => WK.roll <= 0, null, 20), '5c. and you run straight out of the get-up'); await p.keyboard.up('d');
    // a buffered roll: pressed in the air, it comes out on landing
    await ev(() => { WK.stam = 100; WK.roll = 0; WK.ground = false; WK.y = wkGround(WK.x, WK.z) + .03; WK.vy = -1; WK.air = .2; wkRoll(); });
    ok(await ev(() => WK.rollBuf > 0 && WK.roll <= 0), '6. a roll pressed in the air waits');
    ok(await until(() => WK.roll > 0 || WK.H.cur === 'Roll', null, 12), '6b. and happens as you land');
    await sleep(900);
    // another roll key from Settings
    await ev(() => { D.settings.rollKey = 'c'; WK.stam = 100; WK.roll = 0; wkHud(); }); await until(() => WK.ground && WK.roll <= 0, null, 20);
    ok(await ev(() => /<kbd>C<\/kbd> roll/.test(document.getElementById('wkhud').innerHTML)), '7. the hint shows the key you picked');
    await ev(() => { window._rn = 0; window._rn0 = rollNow; rollNow = () => { _rn++; return _rn0(); }; });
    await p.keyboard.press('Shift'); await sleep(80);
    const noShift = await ev(() => _rn === 0); await p.keyboard.press('c'); await sleep(80);
    const cRoll = await ev(() => { const r = _rn === 1; rollNow = _rn0; return r; });
    ok(noShift && cRoll, '7b. then C rolls and a tap of Shift does not ' + [noShift, cRoll]);
    await ev(() => { delete D.settings.rollKey; wkHud(); });
    ok(await ev(() => /tap <kbd>Shift<\/kbd> roll/.test(document.getElementById('wkhud').innerHTML) && !/Ctrl/.test(document.getElementById('wkhud').innerHTML)), '7c. the default hint says tap Shift, not Ctrl');
    ok(await ev(() => typeof rollPick === 'function' && /data-mn="rollkey"/.test(rollPick()) && ROLL_KEYS.length >= 5), '7d. Settings has a Roll key picker');
    // hex walls
    const hx = await ev(() => { const a = wkHexOut(1.1, .3, 0, 0, .18), b = wkHexOut(.5, .1, 0, 0, .18), c = wkHexOut(1.3, 0, 0, 0, .18); return [a && a.map(v => +v.toFixed(3)), b && b.map(v => +v.toFixed(3)), c]; });
    ok(hx[0] && Math.abs(hx[0][0] - 1.18) < .01 && Math.abs(hx[0][1] - .3) < .01 && hx[1] && hx[2] === null, '8. walls are the hex itself: pushed straight out of a flat edge ' + JSON.stringify(hx));
    await p.keyboard.press('v'); await until(() => !WK.on, null, 10);

    // the fight
    await ev(() => { soOpen('test'); }); await sleep(300); await p.click('[data-so="go"]');
    ok(await until(() => SO && SO.R && SO.H && SO.cine, null, 80), '9. a test fight starts');
    await ev(() => soCineEnd()); await sleep(500);
    ok(await ev(() => /tap <kbd>Shift<\/kbd> roll/.test(SO_KEYS())), '9b. the fight\'s key list says tap Shift to roll');
    const isl = await ev(() => new Promise(res => { let n = 0; const o = IS3.R?.render; if (!o) return res(0); IS3.R.render = (...a) => { n++; return o.apply(IS3.R, a); }; setTimeout(() => { IS3.R.render = o; res(n); }, 1500); }));
    ok(isl === 0, `10. the island under the fight isn't drawn (${isl} draws)`);
    // between steps
    const lp = await ev(() => { const M = SO.me; SO.pv = { mx: 0, my: 0, mz: 0, mf: 0, bx: SO.B.x, by: SO.B.y, bz: SO.B.z, bf: SO.B.face }; const keep = [M.x, M.y, M.z, M.face, SO.acc, SO.paused]; M.x = 1; M.y = 0; M.z = 0; M.face = 0; SO.acc = .5 / 60; SO.paused = false; const I = soLerp(); M.x = keep[0]; M.y = keep[1]; M.z = keep[2]; M.face = keep[3]; SO.acc = keep[4]; return I.mx; });
    ok(Math.abs(lp - .5) < .02, '11. frames between the fight\'s steps draw you part way (' + lp.toFixed(2) + ')');
    // roll in the fight
    await ev(() => { SO.B.stag = 999; const M = SO.me; M.act = null; M.st = 100; M.x = 0; M.z = 7; ROLL_SHIFT.tap = 5; });
    await p.mouse.click(600, 400); await sleep(200); // lock the mouse (the first click only does that)
    await ev(() => { SO.paused = false; soHudDraw(); });
    await p.keyboard.press('Shift'); await sleep(40);
    const fr = await ev(() => ({ k: SO.me.act?.k, cur: SO.H.cur }));
    ok(fr.k === 'roll' || SO.me.rollAt > 0, '12. a tap of Shift rolls in the fight ' + JSON.stringify(fr));
    const gl = await ev(() => { const M = SO.me, t = SO.time; M.iFrom = t - .01; M.iTo = t + .1; SO.ifrK = 0; soIfrGlow(.016); const on = Math.max(...SO.H.mats.filter(m => m.emissive).map(m => m.emissive.b)); M.iTo = t - .001; for (let i = 0; i < 20; i++) soIfrGlow(.016); const off = Math.max(...SO.H.mats.filter(m => m.emissive).map(m => m.emissive.b)); return [on, off]; });
    ok(gl[0] > .2 && gl[1] < .01, '12b. you shimmer while untouchable, and stop after ' + gl.map(x => x.toFixed(2)));
    await sleep(1200);
    // a roll pressed mid-swing comes out after it
    const buf = await ev(() => { const M = SO.me; M.act = null; M.st = 100; cancelAnimationFrame(SO.raf); soLoop = () => { }; soAct('light'); const k0 = M.act?.k; soAct('roll'); const waiting = M.rollBuf > 0 && M.act?.k === 'light'; for (let i = 0; i < 60 && M.act?.k !== 'roll'; i++) soStep(1 / 60); return [k0, waiting, M.act?.k]; });
    ok(buf[0] === 'light' && buf[1] && buf[2] === 'roll', '13. a roll pressed during a swing comes out as soon as it can ' + buf);
    const dist = await ev(() => { const M = SO.me; Object.assign(SO.B, { x: 0, z: -8, state: 'idle', t: 9, atk: null, queue: [] }); M.act = null; M.st = 100; M.rollAt = -9; M.tired = 0; M.x = 0; M.z = 0; M.face = 0; M.vx = M.vz = 0; SO.keys = {}; soAct('roll'); const v0 = Math.hypot(M.vx, M.vz); for (let i = 0; i < 60; i++) soStep(1 / 60); return [+(M.z - 0).toFixed(2), +v0.toFixed(2)]; });
    ok(dist[0] > 2.2 && dist[0] < 3 && dist[1] > 4, `14. the roll is full speed from the first frame and goes about ${dist[0]} m`);
    await ev(() => soClose());
  } catch (e) { console.error(e); fails++; }
  ok(!errs.length, '15. no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); app.kill();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
