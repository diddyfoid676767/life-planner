// 2.60: hourglass centred, no stretch, steady top bar, Ask Claude gone, to-do open, not present all day.
// Usage: build the app into DIR/LifePlanner with a planner in DIR/data, then: node test/e2e/fix260.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47918' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47918/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); ui.clsSeen = true; });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  // hourglass centre vs ring centre
  await p.evaluate(() => { const s = D.subjects[0]; D.focus = { subjectId: s.id, start: Date.now() - 60000, sessionId: '' }; openFocusFull(); });
  await sleep(600);
  const g = await p.evaluate(() => { const a = document.querySelector('.ff-ring').getBoundingClientRect(), h = document.querySelector('.hourglass').getBoundingClientRect(); return { dx: (a.left + a.width / 2) - (h.left + h.width / 2), dy: (a.top + a.height / 2) - (h.top + h.height / 2), hw: h.width, hh: h.height }; });
  ok(Math.abs(g.dx) < 1.5 && Math.abs(g.dy) < 1.5, 'hourglass centred ' + JSON.stringify(g));
  
  await p.evaluate(() => { D.focus = null; closeFocusFull(); document.getElementById('focusFull')?.remove(); render(); });
  // top bar steady
  const bar = async tab => { await p.evaluate(t => { view = 'profile'; ui.youTab = t; render(); }, tab); await sleep(700); return p.evaluate(() => { const r = document.querySelector('.youswitch').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }); };
  const a = await bar('me'), c = await bar('rec'), d = await bar('stats');
  ok(JSON.stringify(a) === JSON.stringify(c) && JSON.stringify(a) === JSON.stringify(d), 'top bar same place ' + [a, c, d].join(' | '));
  
  // stretch: canvas buffer aspect matches host after opening customise
  await bar('me'); await p.waitForFunction(() => AV3.fig, null, { timeout: 20000 });
  await p.click('.ybtns [data-pf="look"]'); await sleep(900);
  const st = await p.evaluate(() => { const h = document.getElementById('av3host').getBoundingClientRect(), cv = AV3.R.domElement; return { ha: h.width / h.height, ca: cv.width / cv.height }; });
  ok(Math.abs(st.ha - st.ca) < .03, 'no stretch ' + JSON.stringify(st));
  
  // ask claude gone
  ok(!(await p.$('#aiFab')), 'no Ask Claude button');
  // todo open by default
  await p.evaluate(() => { view = 'today'; render(); }); await sleep(300);
  ok(await p.evaluate(() => !!document.querySelector('.ttasks.tall')), 'to-do open by default');
  // not present all day
  await p.evaluate(() => { D.settings.school.on = true; const d = today(); ui.clsAll = true; window.isSchoolDay = () => true; render(); });
  const cb = await p.$('[data-cls="absentday"]');
  ok(!!cb, 'not present all day button');
  await p.evaluate(() => { window.confirm = () => true; markAbsentDay(today()); }); await sleep(300);
  ok(await p.evaluate(() => dayAbsent(today())), 'all periods marked absent');
  
  console.log('errors', errs);
  await b.close(); app.kill();
})();
