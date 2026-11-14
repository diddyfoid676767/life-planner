// 2.63: term goals, weekly targets, the Chronicle, holiday boss rest, Term Boss, seasons.
// Usage: build the app into DIR/LifePlanner (go build -tags noseed) with DIR/data, then: node test/e2e/terms263.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47921' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const errs = []; let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const open = async (iso) => {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => errs.push(e.message + (errs.length ? '' : '\n' + e.stack)));
    await p.clock.setFixedTime(new Date(iso));
    await p.goto('http://127.0.0.1:47921/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
    await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1200);
    await p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); ui.clsSeen = true; D.settings.setupDone = true; D.settings.seenVersion = '9.9.9'; if (typeof wiz !== 'undefined' && wiz) { try { closeSetup?.(); } catch { } } document.querySelectorAll('dialog[open]').forEach(d => d.close()); });
    return p;
  };
  // ---- Week 1 of Term 1 2027: set goals and targets ----
  let p = await open('2027-02-03T10:00:00');
  ok(await p.evaluate(() => today() === '2027-02-03' && cdTerm() === '2027-T1' && termOf().real), 'real term key in Week 1');
  await p.evaluate(() => { if (!D.subjects.length) D.subjects.push({ id: 'sm', name: 'Methods', color: '#38f' }); D.house = { id: 'hudson', since: '2027-01-01', rev: {}, seen: {}, wins: 0, mvp: 0 }; save(); (view = 'study', render()); });
  await sleep(400);
  ok(await p.$('.t2card .t2add'), 'Term card on Study with the add-goal row');
  await p.selectOption('.t2add [data-t2n=k]', 'study'); await p.fill('.t2add [data-t2n=n]', '1'); await p.click('[data-t2=add]'); await sleep(200);
  ok(await p.evaluate(() => (D.term2.goals['2027-T1'] || []).length === 1), 'study goal added');
  const l0 = await p.evaluate(() => cdWallet().lumen);
  await p.evaluate(() => { const s = D.subjects[0]; D.term2.tgt[s.id] = 2; D.assessments.push({ id: 'a1', subjectId: s.id, title: 'SAC 1', type: 'SAC', date: '2027-02-10', done: false }); D.focusLogs.push({ id: 'f1', subjectId: s.id, date: '2027-02-03', start: '2027-02-03T09:00:00Z', mins: 70 }); save(); render(); });
  await sleep(300);
  ok(await p.evaluate(() => !!D.term2.goals['2027-T1'][0].paid), 'goal paid once hit');
  ok(await p.evaluate(l0 => cdWallet().lumen - l0 >= 100, l0), 'goal pays 100 Lumen');
  ok(await p.evaluate(() => t2Target(D.subjects[0]).h === 2.5), 'weekly target raised before a SAC (2h -> 2.5h)');
  ok(await p.evaluate(() => /of 2h 30m/.test(document.querySelector('.t2card').textContent)), 'target shown on the Term card');
  await p.screenshot({ path: S + '/term-card.png' });
  await p.close();
  // ---- Week 3: goals locked ----
  p = await open('2027-02-17T10:00:00');
  await p.evaluate(() => (view = 'study', render())); await sleep(300);
  ok(!(await p.$('.t2card .t2add')) && await p.evaluate(() => /Locked since/.test(document.querySelector('.t2card').textContent)), 'goals locked after Week 2');
  ok(await p.evaluate(() => hiTerm().voteStart === '2027-02-08' && hiTerm().voteEnd === '2027-02-22'), 'leader vote runs in Weeks 2-3');
  await p.close();
  // ---- last week of term: Term Boss ----
  p = await open('2027-03-23T10:00:00');
  ok(await p.evaluate(() => bossWeek() === 'term' && ftAttempts().extra >= 3), 'Term Boss week: 3 extra fights');
  ok(await p.evaluate(() => hsFight('hudson').hp >= 1100), 'Term Boss has double health');
  await p.evaluate(() => (view = 'islands', ui.isTab = 'house', ui.isPanel = 'house', render())); await sleep(400);
  ok(await p.evaluate(() => /TERM BOSS/.test(document.body.textContent) && !!document.querySelector('.t2season')), 'house page shows Term Boss and season ranking');
  await p.evaluate(() => t2NoteWeek());
  ok(await p.evaluate(() => D.term2.wk['2027-03-22'] && 'hudson' in D.term2.wk['2027-03-22']), 'season standings noted for the week');
  await p.screenshot({ path: S + '/term-boss.png' });
  await p.close();
  // ---- holidays: boss rests, Chronicle shows ----
  p = await open('2027-03-30T10:00:00');
  ok(await p.evaluate(() => bossWeek() === 'rest' && ftAttempts().left === 0 && cdTerm() === '2027-T1'), 'holidays: boss rests, holidays belong to Term 1');
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); t2Check(); }); await sleep(500);
  ok(await p.$('#chronicle[open]'), 'Chronicle shows in the holidays');
  ok(await p.evaluate(() => { const r = D.term2.recaps['2027-T1']; return r && r.study === 70 && r.goals === 1 && r.hit === 1; }), 'Chronicle saved with the right numbers');
  ok(await p.evaluate(() => t2Image(D.term2.recaps['2027-T1']).width === 1200), 'share image draws');
  await p.screenshot({ path: S + '/chronicle.png' });
  await p.click('[data-ch=ok]'); await sleep(200);
  await p.evaluate(() => (view = 'islands', ui.isTab = 'house', ui.isPanel = 'house', render())); await sleep(300);
  ok(await p.evaluate(() => /boss is resting/.test(document.body.textContent)), 'house page says the boss is resting');
  await p.evaluate(() => (view = 'study', render())); await sleep(300);
  ok(await p.evaluate(() => /Goals for Term 2 2027/.test(document.querySelector('.t2card').textContent) && !!document.querySelector('[data-t2=recap]')), 'holidays: next term goals open, Chronicle button');
  await p.screenshot({ path: S + '/holiday-study.png' });
  await p.close();
  console.log('errors', errs);
  await b.close(); app.kill(); process.exit(fails || errs.length ? 1 : 0);
})();
