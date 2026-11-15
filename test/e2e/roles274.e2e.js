// 2.74: six voted house roles. Usage: node test/e2e/roles274.e2e.js DIR (see shell272.e2e.js)

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
  let fails = 0; const h = { sleep, ok: (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); }, shot: n => p.screenshot({ path: S + '/' + n + '.png' }),
    until: async (fn, arg) => { for (let i = 0; i < 40; i++) { if (await p.evaluate(fn, arg)) return true; await sleep(250); } return false; },
    clean: () => p.evaluate(() => { document.getElementById('boot')?.remove(); document.getElementById('wizfx')?.remove(); try { wiz = null; } catch { } if (modal.open) modal.close(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.boxfx').forEach(d => d.remove());
      const st = document.createElement('style'); st.textContent = '.boxfx{display:none!important}'; document.head.appendChild(st); D.settings.seenVersion = '9.9.9'; D.settings.guidesSeen = ['hexmove', 'hexhouse', 'launch']; const c = cdState(); c.got = { l: 2000, e: 2000 }; save(); }) };
  try { await steps(p, h); } catch (e) { fails++; console.log('ERR', e); }
  h.ok(!errs.length, 'no page errors ' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close(); app.kill(); process.exit(fails ? 1 : 0);
})();
async function steps(p, h) {
  await h.clean();
  const r = await p.evaluate(() => {
    const t = hiTerm().id, c = {}; const names = ['me', 'bob', 'cat', 'dan', 'eve', 'fay', 'gus', 'hal', 'ivy'];
    names.forEach((n, i) => c['u' + i] = { n, l: 300 - i * 10, e: 0 });
    const d = { c, v: { u1: { t, r: { champion: 'cat', architect: 'me' } }, u2: { t, r: { champion: 'cat' } }, u3: { t, ld: 'bob' }, u4: { t, r: { architect: 'cat', warlord: 'dan' } } } };
    HI.user = 'me';
    const full = hiTally(d, t);
    const small = hiTally({ c: { a: c.u0, b: c.u1, x: c.u2 }, v: {} }, t);
    const old = (() => { const dd = { ...d, ld: { t, u: ['bob', 'me'] } }; return hiRoles(dd); })();
    return { full, small, old: old.r };
  });
  console.log(JSON.stringify(r));
  h.ok(r.full.champion === 'cat' && r.full.architect === 'me' && r.full.warlord === 'dan' && Object.keys(r.full).length === 6 && new Set(Object.values(r.full)).size === 6, 'full house: votes win, one role each, empty seats to top contributors');
  h.ok(Object.keys(r.small).join() === 'champion,warlord,architect', 'small house fills three roles');
  h.ok(r.old.champion === 'bob' && r.old.architect === 'me', 'old leaders carry on as Champion and Architect');
  // panel
  await p.evaluate(() => { const t = hiTerm(); const c = {}; ['me', 'bob', 'cat'].forEach((n, i) => c['u' + i] = { n, l: 300, e: 0 }); HI.uid = 'u0'; HI.user = 'me'; HI.doc = Object.assign(HI.doc || {}, { c, v: {}, ld: { t: t.id, u: ['me', 'bob'], r: { champion: 'bob', architect: 'me', warlord: 'cat' } } }); });
  h.ok(await p.evaluate(() => hiAmLeader() && !hiHas('champion') && hiHas('vanguard') === false && hiMyRoles().map(r => r.id).join() === 'architect'), 'Architect can build, not put things to a vote');
  await p.evaluate(() => { HI.doc.ld.r = { champion: 'me' }; }); h.ok(await p.evaluate(() => hiHas('architect') && hiHas('champion')), 'Champion covers empty roles');
  const html = await p.evaluate(() => hiLeadHtml(HI.doc, hiRoles()));
  h.ok(/Champion/.test(html) && /Herald/.test(html) && /the Champion covers this/.test(html), 'roles panel lists the six roles');
}
