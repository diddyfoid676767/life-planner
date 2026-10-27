// Feedback inbox + Back up now, with mocked chats. Usage: build the app into DIR/fbpc/LifePlanner with a planner in DIR/fbpc/data, then: node test/e2e/feedback-backup.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, app; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  app = spawn(S + '/fbpc/LifePlanner', [], { cwd: S + '/fbpc', env: { ...process.env, LP_PORT: '47901' }, stdio: 'ignore' });
  await sleep(1200);
  const b = await chromium.launch(), p = await b.newPage(); p.on('pageerror', e => console.log('page error', e.message)); 
  const t = n => new Date(Date.UTC(2026, 9, 27, 9, n)).toISOString();
  const msgs = { c1: [{ id: 1, body: 'bug from amy', created_at: t(1), p: { username: 'amy' } }, { id: 5, body: 'thanks amy', created_at: t(5), p: { username: 'eli' } }],
    c2: [{ id: 3, body: 'idea from ben', created_at: t(3), p: { username: 'ben' } }], c3: [{ id: 2, body: 'hey', created_at: t(2), p: { username: 'cat' } }] };
  const sent = [];
  const chats = () => [
    { id: 'c1', name: 'Feedback · @amy', is_group: true, members: [{ u: 'amy' }, { u: 'eli' }], last: { id: 5, body: 'thanks amy', at: t(5), u: 'eli' }, unread: 0 },
    { id: 'c2', name: 'Feedback · @ben', is_group: true, members: [{ u: 'ben' }, { u: 'eli' }], last: { id: 3, body: 'idea from ben', at: t(3), u: 'ben' }, unread: 1 },
    { id: 'c3', name: null, is_group: false, members: [{ u: 'cat' }, { u: 'eli' }], last: { id: 2, body: 'hey', at: t(2), u: 'cat' }, unread: 0 }];
  await p.route('**/api/account', r => r.request().method() === 'GET' ? r.fulfill({ json: { signedIn: true, username: 'eli', configured: true } }) : r.continue());
  await p.route('**/api/account/people*', r => r.fulfill({ json: [] }));
  await p.route('**/api/chat*', async r => {
    const q = new URL(r.request().url()), req = r.request();
    if (req.method() === 'GET') { const c = q.searchParams.get('c'), after = +q.searchParams.get('after'); return r.fulfill({ json: (msgs[c] || []).filter(m => m.id > after) }); }
    const { fn, args } = JSON.parse(req.postData());
    if (fn === 'my_chats') return r.fulfill({ json: { result: chats() } });
    if (fn === 'my_blocks') return r.fulfill({ json: { result: [] } });
    if (fn === 'send_message') { sent.push(args); msgs[args.c].push({ id: 10 + sent.length, body: args.body, created_at: new Date().toISOString(), p: { username: 'eli' } }); }
    return r.fulfill({ json: { result: true } });
  });
  await p.goto('http://127.0.0.1:47901/'); await p.waitForFunction(() => typeof D === 'object' && D && loaded);
  await sleep(2500);
  await p.evaluate(() => { view = 'friends'; render(); }); await sleep(800);
  const list = await p.locator('#chatList li').allInnerTexts();
  ok(list.length === 2 && list.some(x => x.includes('Feedback')), '1. two feedback chats show as one Feedback chat (plus the normal one): ' + JSON.stringify(list.map(x => x.split('\n')[0])));
  ok(list.find(x => x.includes('Feedback')).includes('1'), '1b. it shows the unread count');
  await p.locator('#chatList li', { hasText: 'Feedback' }).click(); await sleep(1200);
  const txt = await p.locator('#chatMsgs').innerText();
  ok(txt.indexOf('bug from amy') < txt.indexOf('idea from ben') && txt.indexOf('idea from ben') < txt.indexOf('thanks amy'), '2. messages from everyone, in time order');
  ok(/@amy/.test(txt) && /@ben/.test(txt) && /You to @amy/.test(txt), '2b. each message says who it is from / to');
  ok(/Replying to @ben/.test(await p.locator('.fbto').innerText()), '3. reply goes to whoever wrote last (ben)');
  await p.fill('#chatInput', 'reply to ben'); await p.press('#chatInput', 'Enter'); await sleep(1200);
  ok(sent.at(-1)?.c === 'c2', '3b. reply went to ben\'s chat only');
  await p.locator('.chatmsg', { hasText: 'bug from amy' }).locator('[data-chat=fbto]').click(); await sleep(300);
  ok(/Replying to @amy/.test(await p.locator('.fbto').innerText()), '4. ↩ switches who you reply to');
  await p.fill('#chatInput', 'reply to amy'); await p.press('#chatInput', 'Enter'); await sleep(1200);
  ok(sent.at(-1)?.c === 'c1', '4b. reply went to amy\'s chat');
  ok((await p.locator('#chatMsgs').innerText()).includes('reply to amy'), '4c. it shows in the feedback chat');
  // backup now
  await p.evaluate(() => { view = 'settings'; render(); }); await sleep(500);
  await p.evaluate(() => document.querySelector('[data-act=backupNow]').click()); await sleep(1200);
  const bk = fs.readdirSync(S + '/fbpc/data/backups').filter(n => n.startsWith('manual-'));
  ok(bk.length === 1, '5. Back up now makes a backup');
  await p.evaluate(() => document.querySelector('[data-act=showBackups]').click()); await sleep(800);
  ok((await p.evaluate(() => document.querySelector('.bklist').textContent)).includes('You backed it up'), '5b. it shows in the restore list');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); app?.kill?.(); process.exit(1); });
