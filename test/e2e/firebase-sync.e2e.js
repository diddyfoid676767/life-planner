// End-to-end sync test on the Firebase emulators (with the real firestore.rules):
// the PC app (the real binary) + PC windows + the phone app. From the repo root:
//   npx firebase-tools@13 emulators:start --project demo-lp --only auth,firestore   (in another terminal)
//   go build -tags noseed -o /tmp/lp/LifePlanner . && LP_BIN=/tmp/lp/LifePlanner node test/e2e/firebase-sync.e2e.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const S = __dirname, WORK = fs.mkdtempSync(path.join(require('os').tmpdir(), 'lp-e2e-')), PC = path.join(WORK, 'pc'), DATA = path.join(PC, 'data', 'planner-data.json');
const BIN = process.env.LP_BIN || path.join(WORK, 'LifePlanner');
const REAL = process.env.LP_PLANNER ? JSON.parse(fs.readFileSync(process.env.LP_PLANNER, 'utf8'))
  : { version: 1, subjects: [], assessments: [{ id: 'as1', title: 'x', date: '2026-11-01' }], sessions: [], trainingEvents: [], workouts: [], events: [], links: [], feeds: [], fired: {}, settings: {},
    todos: Array.from({ length: 20 }, (_, i) => ({ id: 'k' + i, text: 'todo ' + i, done: false, due: '', notes: '' })) };
REAL.settings.setupDone = true; REAL.settings.bootIntro = false; REAL.settings.tourDone = true;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let app = null, fails = 0, phoneOff = false;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; dbg(); } };
let dbg = () => {};
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1', DOCS = 'http://127.0.0.1:8080/v1', PROJ = 'demo-lp';
const TEST_SERVER = { key: 'fake', project: PROJ, auth: AUTH, tok: 'http://127.0.0.1:9099/securetoken.googleapis.com/v1', docs: DOCS };
let user = null; // { localId, idToken, refreshToken }
async function signUp() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJ}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJ}/accounts`, { method: 'DELETE' });
  user = await (await fetch(`${AUTH}/accounts:signUp?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'eli@users.lifeplanner.app', password: 'password123', returnSecureToken: true }) })).json();
}
function startApp() {
  app = spawn(path.join(PC, 'LifePlanner'), [], { cwd: PC, env: { ...process.env, LP_PORT: '47900', LP_SUPA_URL: 'http://127.0.0.1:1', LP_SUPA_KEY: 'k', LP_FB_KEY: 'fake', LP_FB_PROJECT: PROJ, LP_FB_AUTH_HOST: 'http://127.0.0.1:9099', LP_FB_DOC_HOST: 'http://127.0.0.1:8080' }, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stderr.on('data', d => fs.appendFileSync(path.join(WORK, 'app.log'), d));
  return sleep(1200);
}
async function stopApp() { if (app) { app.kill(); await new Promise(r => app.on('exit', r)); app = null; } }
const file = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const row = async () => { const d = await (await fetch(`${DOCS}/projects/${PROJ}/databases/(default)/documents/planner/${user.localId}`, { headers: { Authorization: 'Bearer owner' } })).json(); return d.fields ? { data: JSON.parse(d.fields.data.stringValue), updated_at: d.updateTime } : null; };
const ids = d => d.todos.map(t => t.id);
const has = (d, id) => ids(d).includes(id);
const until = async (f, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await f()) return true; } catch { } await sleep(300); } return false; };
// edits as if you made them: marks a real edit and saves
const edit = (p, fn, arg) => p.evaluate(([src, arg]) => { lastAct = Date.now(); (0, eval)('(' + src + ')')(D, arg); save(); }, [fn.toString(), arg]);
const addTodo = (p, id) => edit(p, (D, id) => D.todos.push({ id, text: id, done: false, due: '', notes: '' }), id);
const delTodo = (p, id) => edit(p, (D, id) => { D.todos = D.todos.filter(t => t.id !== id); }, id);

function fresh(withAccount) {
  fs.rmSync(PC, { recursive: true, force: true }); fs.mkdirSync(path.join(PC, 'data'), { recursive: true });
  fs.copyFileSync(BIN, path.join(PC, 'LifePlanner')); fs.chmodSync(path.join(PC, 'LifePlanner'), 0o755);
  fs.writeFileSync(DATA, JSON.stringify(REAL));
  if (withAccount) fs.writeFileSync(path.join(PC, 'data', 'account.json'), JSON.stringify({ backend: 'fb', user_id: user.localId, username: 'eli', access_token: user.idToken, refresh_token: user.refreshToken, expires_at: Math.floor(Date.now() / 1000) + 3000 }));
}

(async () => {
  await signUp();
  spawn('node', [path.join(S, 'static.js'), path.join(S, '..', '..', 'web')], { stdio: 'ignore' });
  await sleep(500);
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP phone.test 127.0.0.1'] });
  const pcCtx = await browser.newContext();
  const pcPage = async () => { const p = await pcCtx.newPage(); p.on('pageerror', e => console.log('  pc page error', e.message)); await p.goto('http://127.0.0.1:47900/?k=' + fs.readFileSync(path.join(PC, 'data', 'window.key'), 'utf8').trim()); await p.waitForFunction(() => typeof D === 'object' && D && loaded && baseHash); return p; };
  dbg = async () => { try { const r = await row(); console.log('   cloud', ids(r.data).slice(-6).join(','), r.updated_at, '\n   file ', ids(file()).slice(-6).join(','), '\n   first', REAL.todos[0].id); } catch (e) { console.log(e.message); } };
  const firstTodo = REAL.todos[0].id, secondTodo = REAL.todos[1].id;

  // ---- 1. two PC windows editing at the same time (no account)
  fresh(false); await startApp();
  {
    const a = await pcPage(), b = await pcPage();
    await addTodo(a, 'winA'); await sleep(800);
    await addTodo(b, 'winB'); await delTodo(b, firstTodo); await sleep(1500);
    let f = file(); ok(has(f, 'winA') && has(f, 'winB') && !has(f, firstTodo), '1. two windows: both added todos kept, the delete applied');
    await b.bringToFront(); await addTodo(a, 'winA2'); await sleep(1500);
    f = file(); ok(has(f, 'winA2') && has(f, 'winB'), '1b. background window edit merges too');
    await until(async () => (await b.evaluate(() => D.todos.map(t => t.id))).includes('winA2'), 25000);
    ok((await b.evaluate(() => D.todos.map(t => t.id))).includes('winA2'), '1c. other window picks up the merged copy');
    await a.close(); await b.close();
  }
  // ---- 2. a window kept open across a restart, while a new window saved meanwhile
  {
    const a = await pcPage();
    await stopApp();
    await addTodo(a, 'whileClosed'); await sleep(800);
    await startApp();
    const c = await pcPage(); await addTodo(c, 'newWindow'); await delTodo(c, secondTodo); await sleep(1200);
    await a.evaluate(() => ping()); await sleep(2500);
    const f = file(); ok(has(f, 'whileClosed') && has(f, 'newWindow') && !has(f, secondTodo), '2. edit made while the app was closed merges with a newer window\'s save');
    await a.close(); await c.close();
  }
  // ---- 2b. a tab closed before saving, app restarted, another window saved meanwhile: the kept changes merge in on reopen
  {
    const a = await pcPage();
    await a.evaluate(() => { lastAct = Date.now(); D.todos.push({ id: 'stashOnly', text: 'x' }); stash(JSON.stringify(D)); }); // saved in the browser only
    await a.close();
    const c = await pcPage(); await addTodo(c, 'afterStash'); await sleep(1200); await c.close();
    const d = await pcPage(); await sleep(1500);
    const f = file(); ok(has(f, 'stashOnly') && has(f, 'afterStash'), '2b. unsaved changes kept in the browser merge into a newer planner');
    await d.close();
  }
  await stopApp();

  // ---- 3. phone + PC sync
  await signUp(); fresh(true);
  await startApp();
  const pc = await pcPage(); await sleep(2000);
  ok((await row()) && has((await row()).data, firstTodo), '3. PC planner went up on first sync');
  const phCtx = await browser.newContext();
  await phCtx.route(/127\.0\.0\.1:(8080|9099)/, route => phoneOff ? route.abort('internetdisconnected') : route.continue());
  await phCtx.addInitScript(([u, t]) => { try { localStorage.setItem('lpTestServer', JSON.stringify(t)); if (!localStorage.getItem('lpCloudSession')) { localStorage.setItem('lpCloudSession', JSON.stringify({ fb: true, access: u.idToken, refresh: u.refreshToken, exp: Math.floor(Date.now() / 1000) + 3000, user: u.localId, username: 'eli' })); localStorage.setItem('lpCloudServer', 'fb'); } } catch { } }, [user, TEST_SERVER]);
  let ph = await phCtx.newPage(); ph.on('pageerror', e => console.log('  phone page error', e.message));
  const openPhone = async () => { await ph.goto('http://phone.test:47960/'); await ph.waitForFunction(() => typeof D === 'object' && D && D.todos); };
  await openPhone();
  ok(await ph.evaluate(id => D.todos.some(t => t.id === id), firstTodo), '3a. phone opens the synced planner');
  // phone online edit, PC edit at about the same time
  await addTodo(ph, 'phone1'); await addTodo(pc, 'pc1'); await sleep(9000);
  await pc.evaluate(() => ping()); await sleep(3000);
  let r = await row(), f = file();
  ok(has(r.data, 'phone1') && has(r.data, 'pc1') && has(f, 'phone1') && has(f, 'pc1'), '3b. phone and PC edits at the same time both kept (cloud and PC)');
  // phone offline: edits; PC edits and deletes meanwhile
  await ph.evaluate(() => dispatchEvent(new Event('focus')));
  ok(await until(() => ph.evaluate(() => D.todos.some(t => t.id === 'pc1'))), '3b2. phone picks up the PC\'s change');
  phoneOff = true;
  await addTodo(ph, 'offline1'); await delTodo(ph, 'pc1'); await sleep(2500);
  await addTodo(pc, 'pc2'); await delTodo(pc, firstTodo); await sleep(7000);
  r = await row(); ok(has(r.data, 'pc2') && !has(r.data, firstTodo) && !has(r.data, 'offline1'), '3c. PC changes went up while the phone is offline');
  phoneOff = false;
  await ph.evaluate(() => flush()); await sleep(4000);
  r = await row();
  ok(has(r.data, 'offline1') && has(r.data, 'pc2') && !has(r.data, 'pc1') && !has(r.data, firstTodo), '3d. phone back online: offline add + delete merged with the PC\'s add + delete');
  const phoneD = await ph.evaluate(() => D.todos.map(t => t.id));
  ok(phoneD.includes('pc2') && phoneD.includes('offline1') && !phoneD.includes(firstTodo), '3e. phone shows the merged planner');
  await until(async () => { await pc.evaluate(() => ping()); return has(file(), 'offline1'); }, 40000);
  f = file(); ok(has(f, 'offline1') && has(f, 'pc2') && !has(f, 'pc1'), '3f. PC file has the merged planner');
  ok(await until(async () => { await pc.evaluate(() => ping()); return (await pc.evaluate(() => D.todos.map(t => t.id))).includes('offline1'); }), '3g. PC window shows it');
  // phone closed while offline with changes, PC saves, phone reopened online
  phoneOff = true;
  await addTodo(ph, 'offline2'); await sleep(2500);
  await ph.close();
  await addTodo(pc, 'pc3'); await sleep(7000);
  phoneOff = false;
  ph = await phCtx.newPage(); await openPhone(); await sleep(4000);
  r = await row(); ok(has(r.data, 'offline2') && has(r.data, 'pc3'), '3h. phone reopened later: its offline changes merge with the PC\'s');
  // ---- 4. migration: a phone that last synced with the old server (2.33 to 2.42), with changes the PC never got
  await ph.close();
  const old = await row();
  const oldCopy = JSON.parse(JSON.stringify(old.data)); oldCopy.todos.push({ id: 'oldServerOnly', text: 'x' });
  await addTodo(pc, 'pc4'); await sleep(7000);
  const ph2ctx = await browser.newContext();
  await ph2ctx.addInitScript(([c, t]) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); localStorage.setItem('lpTestServer', JSON.stringify(t)); localStorage.setItem('lpCloudSession', JSON.stringify({ access: 'supa', refresh: 'ref', exp: Math.floor(Date.now() / 1000) + 86400, user: 'old-uuid', username: 'eli' })); localStorage.setItem('lpCloudCopy', c); localStorage.setItem('lpCloudBase', c); localStorage.setItem('lpCloudBaseAt', '2026-11-01T10:00:00.123+00:00'); }, [JSON.stringify(oldCopy), TEST_SERVER]);
  ph = await ph2ctx.newPage(); ph.on('pageerror', e => console.log('  phone page error', e.message));
  await ph.goto('http://phone.test:47960/');
  ok(await ph.locator('.cloud-login').isVisible({ timeout: 10000 }), '4a. a phone logged in to the old server asks to log in again');
  await ph.fill('.cloud-login input[name=u]', 'eli'); await ph.fill('.cloud-login input[name=p]', 'password123'); await ph.click('.cloud-login button');
  await ph.waitForFunction(() => typeof D === 'object' && D && D.todos); await sleep(5000);
  r = await row(); ok(has(r.data, 'oldServerOnly') && has(r.data, 'pc4') && has(r.data, 'offline2'), '4b. its changes from the old server merge in, nothing lost');
  ok(await until(async () => { await pc.evaluate(() => ping()); return has(file(), 'oldServerOnly'); }, 40000), '4c. and reach the PC');
  await addTodo(ph, 'afterMove'); await sleep(4000);
  r = await row(); ok(has(r.data, 'afterMove'), '4d. later phone saves go up as normal');
  // backups exist for the merges on the PC
  const bk = fs.readdirSync(path.join(PC, 'data', 'backups'));
  ok(bk.some(n => n.startsWith('before-cloud')), '5. PC kept a backup before taking in phone changes');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); await stopApp(); process.exit(fails ? 1 : 0);
})().catch(async e => { console.log(e); await stopApp(); process.exit(1); });
