// 2.61: "are you still here?" check on the study timer.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/stillhere.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47919' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47919/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); ui.clsSeen = true; });
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const start = (minsAgo, exam) => p.evaluate(([m, ex]) => { D.settings.stillMins = 40; const s = D.subjects[0] || (D.subjects.push({ id: 'sx', name: 'Maths', color: '#38f' }), D.subjects[0]); D.focus = { subjectId: s.id, sessionId: '', startedAt: Date.now() - m * 60000, pausedAt: 0, pausedMs: 0, planned: 0, ...(ex ? { exam: true } : {}) }; renderFocusBar(); }, [minsAgo, exam]);
  const shown = () => p.evaluate(() => !!document.getElementById('stillHere'));
  // 1. not yet due
  await start(10); await sleep(1500); ok(!(await shown()), 'no prompt at 10 min');
  // 2. due at 41 min
  await start(41); await sleep(1500); ok(await shown(), 'prompt at 41 min');
  // 3. yes keeps it going and resets
  await p.click('#stillHere [data-st=yes]'); await sleep(300);
  ok(!(await shown()) && await p.evaluate(() => !!D.focus && D.focus.askedAt === 0 && D.focus.okAt > 40), 'yes dismisses and resets');
  await sleep(1500); ok(!(await shown()), 'not asked again straight away');
  // 4. no answer: stops and logs only up to the question
  await start(41); await sleep(1500);
  const before = await p.evaluate(() => D.focusLogs.length);
  await p.evaluate(() => { D.focus.askedAt = Date.now() - 5 * 60000 - 1000; });
  await sleep(1500);
  const r = await p.evaluate(() => ({ f: D.focus, n: D.focusLogs.length, last: D.focusLogs[D.focusLogs.length - 1] }));
  ok(r.f === null && r.n === before + 1 && r.last.mins >= 35 && r.last.mins <= 37, 'timeout stops timer, logs time up to the question (~36 of 41): ' + r.last?.mins);
  // 5. exam mode never prompts
  await start(60, true); await sleep(1500); ok(!(await shown()) && !(await p.evaluate(() => D.focus.askedAt)), 'no prompt in exam mode');
  await p.evaluate(() => { D.focus = null; renderFocusBar(); });
  // 6. paused timer never prompts
  await start(60); await p.evaluate(() => { D.focus.pausedAt = Date.now(); }); await sleep(1500); ok(!(await shown()), 'no prompt while paused');
  await p.evaluate(() => { D.focus = null; renderFocusBar(); });
  // 7. setting off
  await start(60); await p.evaluate(() => { D.settings.stillMins = 0; }); await sleep(100); await p.evaluate(() => { document.getElementById('stillHere')?.remove(); D.focus.askedAt = 0; }); await sleep(1500); ok(!(await shown()), 'no prompt when set to Never');
  await p.screenshot({ path: S + '/still.png' });
  console.log('errors', errs);
  await b.close(); app.kill(); process.exit(fails || errs.length ? 1 : 0);
})();
