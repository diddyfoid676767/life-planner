// 2.81 (feedback F4): the Snooze Golem damage race on the KayKit hero. Usage: build into DIR/LifePlanner
// (go build -tags noseed) with DIR/data, then: node test/e2e/souls281.e2e.js DIR

const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47931' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"weather_code":1,"cloud_cover":10,"precipitation":0,"wind_speed_10m":5}}' }));
  await p.goto('http://127.0.0.1:47931/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const shot = n => p.screenshot({ path: S + '/' + n + '.png' });
  const until = async (fn, arg, n = 40) => { for (let i = 0; i < n; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  try {
    await ev(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch', 'game']; const c = cdState(); c.got = { l: 2000, e: 2000 }; save();
      soGolemWeek = () => true; ftState().att = {}; ftState().bonus = {}; ftState().dmg = {}; const s = hsState(); if (!s.id) s.id = HS_HOUSES[0].id; save(); });
    // 1. no trial for players, test fight only in owner test mode
    await ev(() => { localStorage.setItem('solisDev', '0'); ui.isTab = 'boss'; ui.isPanel = 'bspar'; view = 'islands'; render(); }); await sleep(1200);
    ok(await ev(() => !document.querySelector('[data-so="trial"], [data-so="test"]') && !soTestOk()), '1. no practice trial for players');
    await ev(() => { localStorage.setItem('solisDev', '1'); render(); }); await sleep(500);
    ok(await ev(() => !!document.querySelector('[data-so="test"]')), '1b. owner test mode shows a test fight');
    // 2. a weekly fight: intro, then the hero in the arena
    await ev(() => { ui.isPanel = null; render(); }); await sleep(600);
    ok(await ev(() => !!document.querySelector('.is-br [data-so="house"]')), '2. Souls fight button on the boss island');
    const before = await ev(() => ftAttempts().left);
    await p.click('.is-br [data-so="house"]'); await sleep(400);
    ok(await ev(() => SO?.intro && /DAMAGE RACE/.test(document.querySelector('.so-intro').textContent) && !/Easy|lock on/i.test(document.querySelector('.so-intro').textContent)), '2b. intro says damage race, no Easy or lock-on');
    await shot('s-intro');
    await p.click('[data-so="go"]');
    ok(await until(() => SO && !SO.intro && SO.R && SO.H), '2c. fight starts with the KayKit hero');
    ok(await ev(b => ftAttempts().left === b - 1, before), '2d. it used one weekly fight');
    const ht = await ev(() => { const bb = new THREE.Box3().setFromObject(SO.H.root); return bb.max.y - bb.min.y; });
    await ev(() => { SO.B.stag = 999; }); // the Golem waits while we test moving
    ok(ht > 1.4 && ht < 3, '2e. hero is a sensible size ' + ht.toFixed(2));
    await sleep(800); await shot('s-start');
    // 3. movement: sprint uses stamina, jump leaves the ground, roll gives i-frames
    await p.keyboard.down('w'); await p.keyboard.down('Shift'); await sleep(700);
    ok(await ev(() => SO.me.st < 100 && SO.me.sp > SO_C.jog + .5), '3. Shift sprints and uses stamina ' + await ev(() => SO.me.sp.toFixed(1)));
    await p.keyboard.up('Shift'); await p.keyboard.up('w');
    await p.keyboard.press(' '); await sleep(150);
    ok(await ev(() => SO.me.y > .3 && SO.H.cur.startsWith('Jump')), '3b. Space jumps');
    await sleep(700); const t0 = await ev(() => { SO.me.st = 100; window._acts = []; const o = soAct; soAct = k => { o(k); if (SO.me.act?.k === k) _acts.push(k); }; return SO.time; }); await p.keyboard.press('Control'); await sleep(80);
    ok(await ev(t0 => _acts.includes('roll') && SO.me.rollAt > t0 && SO.me.iTo - SO.me.iFrom > .3, t0), '3c. Ctrl rolls with i-frames');
    await sleep(600);
    // 4. attacks: light chain, hold for heavy, damage scales with power, weak point from behind
    const hit = (k, behind) => ev(([k, behind]) => { const B = SO.B; B.state = 'recover'; B.t = 9; B.stuck = 0; B.x = 0; B.z = -4; B.face = 0; B.greed = []; const M = SO.me; M.x = 0; M.z = behind ? -7 : -1; M.face = behind ? 0 : Math.PI; M.st = 100; M.act = null; const d0 = SO.dealt; soAct(k); for (let i = 0; i < 80 && M.act; i++) { M.actT += 1 / 60; soActStep(M, 1 / 60); } return SO.dealt - d0; }, [k, behind]);
    const l1 = await hit('light'), hv = await hit('heavy');
    ok(l1 > 0 && hv > l1 * 1.8, `4. light ${l1} and heavy ${hv} hit`);
    ok(await ev(() => SO.H.cur.includes('Melee')), '4b. attack animations play');
    await ev(() => { SO.me.combo = 0; }); const bk = await hit('light', true);
    ok(bk > l1 * 1.3, `4c. the back crystal is a weak point (${bk} vs ${l1})`);
    const pw = await ev(() => { const a = SO.pow; SO.pow = a * 5; return a; }); await ev(() => { SO.me.combo = 0; }); const big = await hit('light');
    ok(big > l1 * 3, `4d. power from level and gear multiplies damage (×${pw.toFixed(2)} → ×5: ${big})`);
    await ev(p0 => { SO.pow = p0; }, pw);
    // mouse: quick click = light, hold = heavy
    await p.mouse.move(700, 430); await p.mouse.click(700, 430); await sleep(200);
    await ev(() => { SO.me.act = null; SO.me.st = 100; SO.paused = false; }); await p.mouse.down(); await sleep(80); await p.mouse.up(); await sleep(60);
    ok(await ev(() => SO.me.act?.k === 'light'), '4e. a quick click is a light attack');
    await ev(() => { SO.me.act = null; SO.me.st = 100; _acts = []; }); await p.mouse.down(); await until(() => _acts.includes('heavy'), null, 8);
    ok(await ev(() => _acts.includes('heavy') && !_acts.slice(-2).includes('light')), '4f. holding the button is a heavy ' + await ev(() => JSON.stringify([_acts, SO.me.hold, SO.paused, SO.me.act?.k, SO.time])));
    await p.mouse.up(); await sleep(900);
    // 5. armour while it swings, greed gets a shrug
    await ev(() => { SO.B.stag = 0; });
    const arm = await ev(() => { SO.P.g.cr = -1; const B = SO.B; B.state = 'wind'; B.atk = { k: 'slam', w: 9, n: 'x' }; B.t = 9; SO.me.combo = 0; SO.me.x = 0; SO.me.z = -1; SO.me.face = Math.PI; const d0 = SO.dealt; soHit(10); return SO.dealt - d0; });
    ok(arm <= 6, '5. it is armoured while it attacks ' + arm);
    await ev(() => { soClearTele(); const B = SO.B; B.state = 'idle'; B.t = 5; B.queue = []; B.cool = {}; B.greed = [SO.time, SO.time, SO.time, SO.time]; SO.me.x = 0; SO.me.z = -1; }); await sleep(100);
    ok(await ev(() => SO.B.atk?.k === 'shrug'), '5b. greedy hitting gets a Grumpy Shrug');
    // 6. every move runs, in every phase; low attacks are jumped; delayed hits wait out a roll
    for (const ph of [0, 3]) for (const k of ['punch', 'slam', 'sweep', 'wave', 'roll', 'alarm', 'march', 'leap']) {
      await ev(([k, ph]) => { SO.time = SO_PH[ph].at + 1; soClearTele(); const B = SO.B; Object.assign(B, { x: 0, z: -4, y: 0, state: 'idle', queue: [k], cool: {}, t: 0, stag: 0 }); SO.me.x = 0; SO.me.z = k === 'roll' || k === 'leap' ? 6 : -1; SO.me.y = 0; SO.P.hp = SO.P.max; SO.me.act = null; }, [k, ph]);
      await sleep(ph ? 250 : 120); if (!ph) await shot('s-' + k); await sleep(1700);
    }
    ok(await ev(() => SO.stats.hurt > 3 && !SO.over), '6. the Golem lands hits (' + await ev(() => SO.stats.hurt) + ')');
    const jumped = await ev(() => { SO.me.y = 1; const r = soHurtBy(SO_MV.sweep); SO.me.y = 0; return !r; });
    ok(jumped, '6b. a jump clears a low sweep');
    const held = await ev(() => { soClearTele(); const B = SO.B; B.state = 'wind'; B.atk = { k: 'punch', w: .5, n: 'x', delay: 1 }; B.t = .001; SO.me.x = 0; SO.me.z = -1; SO.me.st = 100; SO.me.act = null; soAct('roll'); soBossStep(1 / 60); return B.state; });
    ok(held === 'hold', '6c. a delayed hit waits out an early roll');
    const pd = await ev(() => { const M = SO.me; M.act = null; M.st = 100; soAct('roll'); SO.time += .1; const r = soHurtBy(SO_MV.punch); return !r && M.emp > 0; });
    ok(pd, '6d. a perfect dodge boosts damage');
    const guard = await ev(() => { const M = SO.me; M.act = null; M.emp = 0; M.iTo = -1; M.block = true; M.blockAt = SO.time; M.face = Math.atan2(SO.B.x - M.x, SO.B.z - M.z); const h0 = SO.P.hp; const r = soHurtBy(SO_MV.punch); M.block = false; return !r && SO.P.hp === h0 && M.emp > 0; });
    ok(guard, '6e. a perfect guard (F just before the hit) blocks it all');
    await ev(() => { SO.time = 135; }); await sleep(300);
    ok(await ev(() => soPhase() === 3 && soSpeed() > 1.2), '6f. phase 4 Wide Awake by time');
    // 7. potions
    const pot = await ev(() => { const M = SO.me; M.act = null; SO.P.hp = 10; soPotion(); for (let i = 0; i < 70 && M.act; i++) { M.actT += 1 / 60; soActStep(M, 1 / 60); } return [SO.P.hp, M.pots]; });
    ok(pot[0] > 10 && pot[1] === 2, '7. R drinks a potion (3 a fight) ' + pot);
    await shot('s-fight');
    // 8. results: damage, PB, top hitters
    await ev(() => { SO.dealt = 1234; SO.P.hp = 0; }); await sleep(1800);
    const res = await ev(() => document.querySelector('.so-end')?.textContent || '');
    ok(/YOU DIED/.test(res) && /1,234/.test(res) && /personal best/i.test(res) && /top hitters/.test(res) && /shared health bar/.test(res), '8. results show damage, best and house top hitters');
    ok(await ev(() => ftState().soPb['Snooze Golem'] === 1234), '8b. personal best saved');
    await shot('s-dead');
    await p.click('[data-so="close"]'); await sleep(400);
    ok(await ev(() => !SO && !document.getElementById('soov')), '8c. closes');
    // 9. bonus fights: exactly 60 + 60, count against 2 a day, only when the weekly fights are used up
    await ev(() => { const st = ftState(); st.att[today()] = 9; st.bonus = {}; save(); ui.isTab = 'boss'; ui.isPanel = null; render(); }); await sleep(500);
    ok(await ev(() => !!document.querySelector('.is-br [data-so="bonus"]:not([disabled])')), '9. bonus fight button once weekly fights are used');
    const w0 = await ev(() => { const w = cdWallet(); return [w.lumen, w.ember]; });
    await p.click('.is-br [data-so="bonus"]'); await sleep(300); await p.click('[data-so="go"]'); await until(() => SO && !SO.intro && SO.R);
    const w1 = await ev(() => { const w = cdWallet(); return [w.lumen, w.ember, ftState().bonus[today()], soBonusLeft()]; });
    ok(w0[0] - w1[0] === 60 && w0[1] - w1[1] === 60 && w1[2] === 1 && w1[3] === 1, `9b. bonus fight takes exactly 60 + 60 and counts (${w0} → ${w1})`);
    await ev(() => soEnd('quit')); await sleep(400); await ev(() => soClose());
    await ev(() => { soOpen('bonus'); }); await sleep(200); await p.click('[data-so="go"]'); await until(() => SO && !SO.intro && SO.R);
    await ev(() => soEnd('quit')); await sleep(400); await ev(() => soClose());
    ok(await ev(() => soBonusLeft() === 0 && !soCanBonus() && (soOpen('bonus'), !SO)), '9c. no third bonus fight in a day');
  } catch (e) { fails++; console.log('ERR', e); }
  ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
