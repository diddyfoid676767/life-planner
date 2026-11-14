'use strict';
/* 2.60 Test mode (owner tools, hidden). Click the version number in Settings 7 times
   to unlock it. Test mode opens Solis as a brand-new player: empty planner, the welcome
   and setup, no account. Nothing is saved or sent anywhere while it is on (your real
   planner is untouched), and turning it off brings it straight back. It is also where
   unfinished features can be switched on: wrap them in `if (solisBeta())`. */

const TESTMODE = (() => { try { return localStorage.getItem('solisTest') === '1'; } catch { return false; } })();
const solisBeta = () => TESTMODE || (() => { try { return localStorage.getItem('solisBeta') === '1'; } catch { return false; } })();
// 2.63: a pretend date, only inside test mode, to see term weeks, the Term Boss, holidays and the Chronicle
const solisFakeDate = () => { if (!TESTMODE) return ''; try { return localStorage.getItem('solisDate') || ''; } catch { return ''; } };
const solisDevOn = () => TESTMODE || (() => { try { return localStorage.getItem('solisDev') === '1'; } catch { return false; } })();
if (TESTMODE) {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url || '', method = ((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const path = (() => { try { return new URL(url, location.href).pathname; } catch { return url; } })();
    if (path === '/api/account' && method === 'GET') return Promise.resolve(new Response(JSON.stringify({ configured: true, signedIn: false, username: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path.startsWith('/api/account/') && method === 'GET') return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path === '/api/seed') return Promise.resolve(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path.startsWith('/api/') && method !== 'GET') return Promise.resolve(new Response(JSON.stringify({ error: 'Test mode: nothing is sent or saved.' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    return realFetch(input, init);
  };
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div'); b.id = 'testBar';
    b.innerHTML = '<span>🧪 <b>Test mode</b> · you are a brand-new player · nothing is saved or sent</span><label class="tmdate">📅 Pretend date <input type="date" data-tm-date value="${solisFakeDate()}"></label><select data-tm-jump><option value="">Jump to…</option><option value="w1">Term Week 1</option><option value="w2">Week 2 (goals lock, voting)</option><option value="boss">Term Boss week</option><option value="end">Last day of term</option><option value="hol">Holidays</option><option value="real">Real date</option></select><button data-tm="again">Start over</button><button data-tm="off">Exit test mode</button>';
    document.body.appendChild(b);
  });
}
let devClicks = 0, devTimer = 0;
document.addEventListener('click', e => {
  if (e.target.closest?.('#verText2')) {
    devClicks++; clearTimeout(devTimer); devTimer = setTimeout(() => { devClicks = 0; }, 2500);
    if (devClicks >= 7) { devClicks = 0; try { const on = localStorage.getItem('solisDev') !== '1'; localStorage.setItem('solisDev', on ? '1' : '0'); toast(on ? '🧪 Owner tools unlocked' : 'Owner tools hidden', on ? 'Test mode is now in Settings, General & account.' : ''); if (typeof render === 'function') render(); } catch { } }
    return;
  }
  const el = e.target.closest?.('[data-tm]'); if (!el) return;
  const a = el.dataset.tm;
  if (a === 'again') location.reload();
  else if (a === 'on' || a === 'off') (async () => {
    try { if (typeof saveNow === 'function' && !TESTMODE) await saveNow(); localStorage.setItem('solisTest', a === 'on' ? '1' : '0'); } catch { }
    location.reload();
  })();
  else if (a === 'beta') { try { localStorage.setItem('solisBeta', solisBeta() && !TESTMODE ? '0' : '1'); } catch { } if (typeof render === 'function') render(); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!TESTMODE || !el.matches?.('[data-tm-date],[data-tm-jump]')) return;
  let d = el.value;
  if (el.matches('[data-tm-jump]')) {
    const real = ymd(new Date()), T = termList().find(t => t.from && t.to && t.to >= real) || termOf(real);
    d = { w1: T.from, w2: addDays(mondayOf(T.from), 7), boss: addDays(mondayOf(T.to), 1), end: T.to, hol: addDays(T.to, 4), real: '' }[d];
    if (d === undefined) return;
  }
  try { if (d) localStorage.setItem('solisDate', d); else localStorage.removeItem('solisDate'); } catch { }
  location.reload();
});
function testModeCard() {
  if (!solisDevOn()) return '';
  return `<div class="card" data-sec="general" style="grid-column:1/-1"><div class="card-head"><h2>🧪 Test mode <span class="tag">owner only</span></h2>${TESTMODE ? '<button class="btn small primary" data-tm="off">Exit test mode</button>' : '<button class="btn small primary" data-tm="on">Start test mode</button>'}</div>
    <p class="muted small-text" style="margin-top:0">Opens Solis as a brand-new player would see it: no data, the welcome and setup, no account to sign in to. Nothing is saved or sent while it is on, and your real planner is untouched. Exit and everything is back. Reload the window to start over.</p>
    <label class="row"><input type="checkbox" data-tm="beta" ${solisBeta() ? 'checked' : ''} ${TESTMODE ? 'disabled' : ''}> Show unfinished features (test mode always does)</label></div>`;
}
