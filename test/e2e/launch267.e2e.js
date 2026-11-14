// 2.67 launch: the welcome (Westbourne or planner only), school-email sign-up with the emailed
// link, the year list, owner tools, invites, planner-only mode and the launch reset. Needs the
// Firebase emulators and three copies of the app (DIR/a, DIR/b, DIR/c, each with LifePlanner):
//   LP_TEST_OWNER=<owner's school email> npx firebase emulators:exec --project demo-lp "node test/e2e/launch267.e2e.js DIR"
const { chromium } = require('playwright'); const { spawn, execSync } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const OWNER = process.env.LP_TEST_OWNER /* the owner's real school email, kept out of the repository */, STU = 'test.student@westbourne.vic.edu.au', OUT = 'pat.outsider@gmail.com';
const env = { LP_FB_KEY: 'fake', LP_FB_PROJECT: 'demo-lp', LP_FB_AUTH_HOST: 'http://127.0.0.1:9099', LP_FB_DOC_HOST: 'http://127.0.0.1:8080', LP_FB_EMU: '1' };
const apps = [];
async function openApp(b, dir, port) {
  for (const d of ['/data', '/cfg']) fs.rmSync(dir + d, { recursive: true, force: true }); // a brand-new player
  apps.push(spawn(dir + '/LifePlanner', [], { cwd: dir, env: { ...process.env, ...env, LP_PORT: String(port), XDG_CONFIG_HOME: dir + '/cfg' }, stdio: 'ignore' }));
  for (let i = 0; i < 60 && !fs.existsSync(dir + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'LAUNCH' : undefined));
  await p.goto(`http://127.0.0.1:${port}/?k=` + fs.readFileSync(dir + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 });
  await p.evaluate(() => document.getElementById('boot')?.remove());
  await p.waitForSelector('#wizfx', { timeout: 15000 });
  return p;
}
async function openLink(email) {
  const r = await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-lp/oobCodes')).json();
  const c = r.oobCodes.filter(x => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
  await fetch(c.oobLink);
}
const wizNext = p => p.click('#wizfx [data-w="next"]');
async function signUp(p, email) {
  await p.fill('#emForm [name=email]', email); await p.fill('#emForm [name=password]', 'password123');
  await p.click('#emForm [data-em="signup"]');
  await p.waitForFunction(() => acct.signedIn, null, { timeout: 15000 });
  await openLink(email);
  await p.waitForFunction(() => acct.verified, null, { timeout: 20000 }); // Solis notices the link by itself
  await sleep(500);
}

(async () => {
  // a test year list: the owner and one (pretend) beta-tester student
  fs.writeFileSync(S + '/yr.json', execSync(`go run ./tools/yrlist -beta "Test Student" -add "${OWNER}=Eli Owner,${STU}=Test Student"`, { input: '' }));
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    // ---- the owner
    const A = await openApp(b, S + '/a', 47931);
    ok(await A.isVisible('#wizfx [data-w="mode"][data-v="school"]') && await A.isVisible('#wizfx [data-w="mode"][data-v="planner"]'), '1. the welcome asks: Westbourne or just the planner');
    await A.click('#wizfx [data-w="mode"][data-v="school"]'); await A.waitForSelector('#emForm');
    ok(await A.isVisible('#emForm [name=email]') && /school email/i.test(await A.textContent('#wizfx')), '2. Westbourne: sign up with your school email');
    await wizNext(A); await sleep(200);
    ok(await A.evaluate(() => wizKeys()[wiz.step] === 'account'), '2b. can\'t skip the account in Westbourne mode');
    await signUp(A, OWNER);
    ok(await A.evaluate(() => acct.owner && !acct.school && plannerOnly()), '3. owner verified before the year list is loaded: planner only for now, owner tools on');
    await wizNext(A); await A.fill('#wizfx [data-wf="name"]', 'Eli'); await A.fill('#wizfx [data-wf="subjects.0.name"]', 'Chemistry'); await wizNext(A);
    await A.click('#wizfx [data-w="timer"][data-v=""]');
    ok(await A.evaluate(() => wizKeys().join() === 'account,classes,timer'), '4. planner only: no house step');
    await A.click('#wizfx [data-w="finish"]'); await sleep(500);
    await A.evaluate(() => { document.querySelector('.tourfx,#tourfx')?.remove(); view = 'settings'; render(); });
    ok(await A.isVisible('.owncard'), '5. owner tools in Settings');
    await A.setInputFiles('[data-own="yr"]', S + '/yr.json');
    await A.waitForFunction(() => acct.school, null, { timeout: 15000 });
    ok(await A.evaluate(() => !plannerOnly() && D.settings.mode === 'school' && acct.name === 'Eli Owner'), '6. year list loaded: the owner is now a verified Westbourne student');
    const ic = await A.evaluate(() => acct.ic);
    ok(/^[0-9a-f]{6}$/.test(ic), '6b. invite code ' + ic);

    // ---- a student with the owner's invite code
    const B = await openApp(b, S + '/b', 47932);
    await B.fill('#wizfx [data-wf="invite"]', ic.toUpperCase());
    await B.click('#wizfx [data-w="mode"][data-v="school"]'); await B.waitForSelector('#emForm');
    ok((await B.inputValue('#emForm [name=invite]')).toLowerCase() === ic, '7. the invite code carries into sign-up');
    await signUp(B, STU);
    ok(await B.evaluate(() => acct.school && acct.name === 'Test Student'), '8. student verified, name from the year list');
    await B.evaluate(() => loadMyBadges && loadMyBadges());
    await sleep(500);
    ok(await B.evaluate(() => (myBadges || []).includes('beta')), '8b. beta badge from the beta list');
    ok(await B.evaluate(() => friendNames().length === 1), '8c. the inviter is on their friends list');
    await wizNext(B);
    ok((await B.inputValue('#wizfx [data-wf="name"]')) === 'Test', '9. first name filled in from the list');
    await B.fill('#wizfx [data-wf="subjects.0.name"]', 'Maths'); await wizNext(B);
    await B.click('#wizfx [data-w="timer"][data-v="Maths"]'); await wizNext(B);
    ok(await B.isVisible('#wizfx .hspick [data-v="pascoe"]'), '10. house step for a verified student');
    await B.click('#wizfx .hspick [data-v="pascoe"]'); await B.click('#wizfx [data-w="finish"]'); await sleep(600);
    ok(await B.evaluate(() => hsState().id === 'pascoe' && !!D.focus), '11. joined the house and the first timer started');
    // invite reward: first session done
    await B.evaluate(() => { stopFocus?.(true, true); D.focusLogs.push({ id: 'x', date: today(), mins: 15, subjectId: D.subjects[0].id }); });
    await sleep(21000);
    await B.evaluate(() => inviteSync(true)); await sleep(1500);
    await B.evaluate(() => publishMe(true)); await sleep(2500);
    ok(await B.evaluate(() => !!D.settings.inviteRewarded), '12. the new player gets the invite reward');
    await A.evaluate(() => inviteSync(true)); await sleep(2500);
    ok(await A.evaluate(() => Object.keys(D.settings.invitePaid || {}).length === 1), '12b. the inviter gets theirs');

    // ---- someone outside the school
    const C = await openApp(b, S + '/c', 47933);
    await C.click('#wizfx [data-w="mode"][data-v="planner"]'); await C.waitForSelector('#emForm');
    ok(/optional/i.test(await C.textContent('#wizfx h2')), '13. planner only: the account is optional');
    await C.fill('#emForm [name=name]', 'Pat');
    await signUp(C, OUT);
    ok(await C.evaluate(() => acct.verified && !acct.school && plannerOnly()), '14. outside email: planner only');
    await wizNext(C); await C.fill('#wizfx [data-wf="subjects.0.name"]', 'Art'); await wizNext(C);
    await C.click('#wizfx [data-w="timer"][data-v=""]'); await C.click('#wizfx [data-w="finish"]'); await sleep(500);
    await C.evaluate(() => { document.querySelector('.tourfx,#tourfx')?.remove(); view = 'islands'; ui.isTab = 'house'; render(); });
    ok(await C.evaluate(() => ui.isTab === 'personal' && !document.querySelector('.isswitch [data-v="house"]') && hsTodayStrip() === ''), '15. no house island, tab or Today strip');
    ok(await C.evaluate(() => { ui.isTab = 'house'; hsState().id = ''; return !schoolReady(); }), '15b. can\'t join a house');
    // find the student by school email and by name
    const byEmail = await C.evaluate(async e => (await (await fetch('/api/account/people?q=' + encodeURIComponent(e))).json()).map(p => p.display), STU.toUpperCase());
    const byName = await C.evaluate(async () => (await (await fetch('/api/account/people?q=test st')).json()).map(p => p.display));
    ok(byEmail.join() === 'Test Student' && byName.includes('Test Student'), '16. friends by school email and by name: ' + byEmail + ' / ' + byName);

    // ---- the launch switch (owner)
    await A.evaluate(() => { D.cards.got = { l: 999, e: 999 }; view = 'settings'; render(); });
    await A.click('[data-own="launch"]');
    await A.waitForFunction(() => D.settings.launchAt, null, { timeout: 15000 });
    ok(await A.evaluate(() => !D.cards.got && D.cards.since === today() && D.subjects.length === 1 && /launched/i.test(document.querySelector('dialog')?.textContent || '')), '17. launch: world reset, planner kept, the launch card shows');
    const bk = fs.readdirSync(S + '/a/data/backups').filter(f => f.startsWith('before-launch'));
    ok(bk.length === 1, '17b. a backup was made first');

    for (const [n, p] of [['A', A], ['B', B], ['C', C]]) ok(!p.errs.length, `no page errors in ${n} ${p.errs.join(' | ')}`);
  } catch (e) { console.log('FAIL crashed:', e.message); fails++; }
  await b.close(); apps.forEach(a => a.kill());
  console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
})();
