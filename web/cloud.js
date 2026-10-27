'use strict';
/* The phone app: these same pages, hosted on GitHub Pages and added to the
   home screen. There's no LifePlanner.exe behind them, so this file stands in
   for it: you log in with your Life Planner account and the planner is saved
   to your own row on the friends server (planner_data), which the PC app
   keeps in sync while you're logged in there. A copy stays on the phone so it
   opens without internet. Does nothing when the PC app serves the page. */
if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.protocol !== 'file:') window.OL = (() => {
  const URL_ = 'https://vtjvneusumjvhdctvijz.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0anZuZXVzdW1qdmhkY3R2aWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTYwODcsImV4cCI6MjEwODI5MjA4N30.TzQqwPjHrB4NAAYzciQYP75zE8JTPAZOXcV-pHJuMDc'; // public anon key, same as the PC app
  const MAIL = 'users.lifeplanner.app', SESS = 'lpCloudSession', COPY = 'lpCloudCopy', PENDING = 'lpCloudPending'; // PENDING: the phone copy has changes the server hasn't got yet
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };
  let sess = null; try { sess = JSON.parse(ls.get(SESS) || 'null'); } catch { }
  let lastAt = '', lastJson = '';

  // the PC-only endpoints answer "not here" instead of a GitHub 404 page
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => (typeof u === 'string' && u.startsWith('/api/'))
    ? Promise.resolve(new Response(JSON.stringify({ error: 'This only works in the PC app.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    : realFetch(u, o);

  async function call(method, path, body, extra = {}) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json', ...extra };
    headers.Authorization = 'Bearer ' + (path.startsWith('/auth/') ? KEY : await token());
    let r;
    try { r = await realFetch(URL_ + path, { method, headers, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' }); }
    catch { throw Object.assign(new Error('No internet right now.'), { offline: true }); }
    const j = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error((j && (j.msg || j.message || j.error_description)) || r.statusText), { status: r.status });
    return j;
  }
  function keep(a, username) {
    sess = { access: a.access_token, refresh: a.refresh_token, exp: a.expires_at || Math.floor(Date.now() / 1000) + (a.expires_in || 3600), user: a.user?.id || sess?.user, username: username || sess?.username };
    ls.set(SESS, JSON.stringify(sess));
  }
  async function token() {
    if (!sess) throw new Error('not logged in');
    if (Date.now() / 1000 < sess.exp - 60) return sess.access;
    try { keep(await call('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: sess.refresh })); }
    catch (e) { if (e.status === 400 || e.status === 401) { sess = null; ls.set(SESS, null); } throw e; }
    return sess.access;
  }

  // the login screen, shown over the app until you're in
  function login() {
    return new Promise(done => {
      const el = document.createElement('div');
      el.className = 'cloud-login';
      el.innerHTML = `<form class="card"><img src="icon.svg" alt="" width="64" height="64"><h2>Life Planner</h2>
        <p class="muted small-text">Log in with your Life Planner account, the same one you use for friends in the PC app. Make one in the PC app under Settings, Account if you don't have one yet.</p>
        <label>Username<input name="u" autocomplete="username" autocapitalize="none" required minlength="3" maxlength="20"></label>
        <label>Password<input name="p" type="password" autocomplete="current-password" required minlength="8" maxlength="72"></label>
        <p class="cloud-err" hidden></p><button class="btn primary">Log in</button></form>`;
      document.body.appendChild(el);
      document.getElementById('boot')?.remove();
      const f = el.querySelector('form'), err = el.querySelector('.cloud-err');
      f.onsubmit = async e => {
        e.preventDefault();
        const u = f.u.value.trim().toLowerCase(), btn = f.querySelector('button');
        btn.disabled = true; err.hidden = true;
        try {
          keep(await call('POST', '/auth/v1/token?grant_type=password', { email: u + '@' + MAIL, password: f.p.value }), u);
          el.remove(); done();
        } catch (x) {
          err.textContent = x.status === 400 ? 'Wrong username or password.' : x.message; err.hidden = false; btn.disabled = false;
        }
      };
    });
  }
  function logout() { sess = null; ls.set(SESS, null); ls.set(COPY, null); ls.set(PENDING, null); location.reload(); }

  async function fetchRow(cols) {
    const rows = await call('GET', `/rest/v1/planner_data?select=${cols}&user_id=eq.${sess.user}`);
    return rows && rows[0] || null;
  }
  const missingTable = e => e.status === 404 || /planner_data/.test(e.message || '');
  async function load() {
    if (!sess) await login();
    try {
      const row = await fetchRow('data,updated_at');
      // changes made offline last time win over the server copy, and go up now
      const copy = ls.get(PENDING) && ls.get(COPY);
      if (copy) {
        lastAt = row?.updated_at || ''; lastJson = '';
        const d = JSON.parse(copy);
        setTimeout(() => { save(d).then(() => window.toast?.('✅ Synced', 'The changes you made offline are uploaded.')).catch(() => { }); }, 500);
        return d;
      }
      if (!row) return null;
      lastAt = row.updated_at; lastJson = JSON.stringify(row.data);
      ls.set(COPY, lastJson);
      return row.data;
    } catch (e) {
      if (e.status === 401 || e.message === 'not logged in') { await login(); return load(); }
      if (missingTable(e)) throw new Error('Phone sync isn\'t set up on the friends server yet.');
      const copy = ls.get(COPY); // offline: open the last copy
      if (copy) { setTimeout(() => window.toast?.('Offline', 'Showing your last saved copy. Changes save when you\'re back online.'), 800); return JSON.parse(copy); }
      throw e;
    }
  }

  // saves are full copies, so a burst of taps goes up once
  let waiting = null;
  function save(D) {
    if (!waiting) waiting = new Promise((ok, bad) => setTimeout(async () => {
      waiting = null;
      try {
        const json = JSON.stringify(D);
        if (json !== lastJson) {
          const out = await call('POST', '/rest/v1/planner_data?on_conflict=user_id&select=updated_at', { user_id: sess.user, data: D, device: 'phone' },
            { Prefer: 'resolution=merge-duplicates,return=representation' });
          lastJson = json; lastAt = out?.[0]?.updated_at || lastAt;
        }
        ls.set(COPY, json); ls.set(PENDING, null);
        ok();
      } catch (e) { ls.set(COPY, JSON.stringify(D)); ls.set(PENDING, '1'); bad(e); }
    }, 1500));
    return waiting;
  }

  // changes from the PC: checked every 20s while the app is open, and as soon
  // as you come back to it
  function subscribe(onRemote) {
    let busy = false;
    const check = async () => {
      if (busy || document.hidden || !sess || waiting || ls.get(PENDING)) return;
      busy = true;
      try {
        const head = await fetchRow('updated_at');
        if (head && head.updated_at !== lastAt) {
          const row = await fetchRow('data,updated_at');
          if (row && !waiting) { lastAt = row.updated_at; lastJson = JSON.stringify(row.data); ls.set(COPY, lastJson); onRemote(row.data); }
        }
      } catch { } finally { busy = false; }
    };
    setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
    addEventListener('focus', check);
  }

  async function download(name, text, type) {
    const blob = new Blob([text], { type }), file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch { } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  return { cloud: true, load, save, subscribe, watchInbox() { }, download, logout, user: () => sess?.username || '' };
})();
