// 2.62: "What's new" card after an update.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/whatsnew.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47921' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47921/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); ui.clsSeen = true; });
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const shown = () => p.evaluate(() => !!document.getElementById('whatsNew')?.open);
  const run = async (set) => { await p.evaluate(() => { document.getElementById('whatsNew')?.close(); }); await p.evaluate(set); await p.evaluate(() => whatsNewCheck()); await sleep(600); };
  const cur = await p.evaluate(() => fetch('/api/info').then(r => r.json()).then(i => i.version));
  // 1. fresh install: no card, version marked seen
  await run(() => { D.settings.setupDone = false; delete D.settings.seenVersion; });
  ok(!(await shown()), '1. fresh install shows no card');
  ok(await p.evaluate(v => D.settings.seenVersion === v, cur), '1b. fresh install remembers the version');
  // 2. same version again: nothing
  await run(() => { D.settings.setupDone = true; });
  ok(!(await shown()), '2. same version shows nothing');
  // 3. updated from an older version: card with the new version number
  await run(() => { D.settings.seenVersion = '2.60.1'; });
  ok(await shown(), '3. card shows after an update');
  const txt = await p.evaluate(() => document.getElementById('whatsNew').innerText);
  ok(txt.includes(cur) && txt.includes('2.63.0'), '3b. shows the new version and the skipped versions\' notes');
  ok(await p.evaluate(v => D.settings.seenVersion === v, cur), '3c. remembers it was shown');
  await p.screenshot({ path: S + '/whatsnew.png' });
  await p.click('[data-wn=ok]'); await sleep(300);
  ok(!(await shown()), '4. Got it closes the card');
  await run(() => { }); ok(!(await shown()), '4b. does not come back');
  // 5. existing planner from before this card (no seenVersion, setup done): shown once
  await run(() => { delete D.settings.seenVersion; });
  ok(await shown(), '5. an older planner with no remembered version sees the card once');
  ok(errs.length === 0, '6. no page errors ' + errs.join('|'));
  await b.close(); app.kill(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
