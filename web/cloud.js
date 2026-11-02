'use strict';
/* The phone app: these same pages, hosted on GitHub Pages and added to the
   home screen. There's no LifePlanner.exe behind them, so this file stands in
   for it: you log in with your Life Planner account and the planner is saved
   to your own row on the friends server (planner_data), which the PC app
   keeps in sync while you're logged in there. A copy stays on the phone so it
   opens without internet. Does nothing when the PC app serves the page. */
if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.protocol !== 'file:') window.OL = (() => {
  // the friends server (Firebase, since 2.39): the same project and key as the PC app
  let FB_KEY = 'AIzaSyCucsGSWVIGnGYmmlOifIvYsEHC1FtBQjs', FB_PROJECT = 'life-planner-4663f';
  let AUTH = 'https://identitytoolkit.googleapis.com/v1', TOK = 'https://securetoken.googleapis.com/v1', DOCS = 'https://firestore.googleapis.com/v1';
  if (/\.test$/.test(location.hostname)) try { const t = JSON.parse(localStorage.getItem('lpTestServer') || 'null'); if (t) ({ key: FB_KEY, project: FB_PROJECT, auth: AUTH, tok: TOK, docs: DOCS } = t); } catch { } // the emulators, for testing
  const MAIL = 'users.lifeplanner.app', SESS = 'lpCloudSession', COPY = 'lpCloudCopy', PENDING = 'lpCloudPending', BASE = 'lpCloudBase', BASE_AT = 'lpCloudBaseAt', SERVER = 'lpCloudServer';
  // PENDING: the phone copy has changes the server hasn't got yet (holds the server time it was built on).
  // BASE: the server copy this phone last had (from the server time in BASE_AT), so changes the PC saved meanwhile merge in
  // SERVER: 'fb' once this phone has synced with Firebase (before 2.43 the phone still used the old server)
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };
  let sess = null; try { sess = JSON.parse(ls.get(SESS) || 'null'); } catch { }
  if (sess && !sess.fb) sess = null; // logged in on the old server: log in again (the planner on this phone is kept and merged in)
  let lastAt = '', lastJson = '';
  // the server copy the planner here is built on
  function setLast(at, json) {
    lastAt = at || ''; lastJson = json || '';
    try { localStorage.setItem(BASE, lastJson); localStorage.setItem(BASE_AT, lastAt); }
    catch { ls.set(BASE, null); ls.set(BASE_AT, null); } // too big to keep twice: merges then keep both sides' items
  }

  // the PC-only endpoints answer "not here" instead of a GitHub 404 page
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => (typeof u === 'string' && u.startsWith('/api/'))
    ? Promise.resolve(new Response(JSON.stringify({ error: 'This only works in the PC app.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    : realFetch(u, o);

  async function req(url, opts) {
    let r;
    try { r = await realFetch(url, { cache: 'no-store', ...opts }); }
    catch { throw Object.assign(new Error('No internet right now.'), { offline: true }); }
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = j?.error || {}; throw Object.assign(new Error(e.message || r.statusText), { status: r.status, code: e.status || e.message || '' }); }
    return j;
  }
  const authPost = (path, body) => req(`${AUTH}/${path}?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  function keep(a, username) {
    sess = { fb: true, access: a.idToken || a.id_token, refresh: a.refreshToken || a.refresh_token, exp: Math.floor(Date.now() / 1000) + (+(a.expiresIn || a.expires_in) || 3600), user: a.localId || a.user_id || sess?.user, username: username || sess?.username };
    ls.set(SESS, JSON.stringify(sess));
  }
  async function token() {
    if (!sess) throw new Error('not logged in');
    if (Date.now() / 1000 < sess.exp - 60) return sess.access;
    try { keep(await req(`${TOK}/token?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sess.refresh) })); }
    catch (e) { if (e.status === 400 || e.status === 401) { sess = null; ls.set(SESS, null); } throw e; }
    return sess.access;
  }
  const docPath = () => `projects/${FB_PROJECT}/databases/(default)/documents/planner/${sess.user}`;
  async function docCall(method, url, body) {
    try { return await req(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() }, body: body == null ? undefined : JSON.stringify(body) }); }
    catch (e) { if (e.status === 401 || e.message === 'not logged in') throw Object.assign(new Error('not logged in'), { status: 401 }); throw e; }
  }

  // the login screen, shown over the app until you're in
  function login() {
    return new Promise(done => {
      const el = document.createElement('div');
      el.className = 'cloud-login';
      el.innerHTML = `<form class="card"><img src="icon.svg" alt="" width="64" height="64"><h2>Life Planner</h2>
        <p class="muted small-text">Log in with your Life Planner account, the same one you use for friends in the PC app. Make one in the PC app under Settings, Account if you don't have one yet.${ls.get(COPY) && ls.get(SERVER) !== 'fb' ? " Your planner moved to a new server: log in once more and this phone's changes are brought over." : ''}</p>
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
          keep(await authPost('accounts:signInWithPassword', { email: u + '@' + MAIL, password: f.p.value, returnSecureToken: true }), u);
          el.remove(); done();
        } catch (x) {
          err.textContent = x.status === 400 ? "Wrong username or password. (If you haven't logged in on the PC app since 2.39, do that once first.)" : x.message; err.hidden = false; btn.disabled = false;
        }
      };
    });
  }
  function logout() { sess = null; for (const k of [SESS, COPY, PENDING, BASE, BASE_AT, SERVER]) ls.set(k, null); location.reload(); }

  // the planner document: { data, updated_at } (updated_at is its version, the
  // document's update time); only the version when cols has no data
  async function fetchRow(cols) {
    let d;
    try { d = await docCall('GET', `${DOCS}/${docPath()}${cols.includes('data') ? '' : '?mask.fieldPaths=device'}`); }
    catch (e) { if (e.code === 'NOT_FOUND' || e.status === 404) return null; throw e; }
    if (!cols.includes('data')) return { updated_at: d.updateTime };
    return { updated_at: d.updateTime, data: JSON.parse(d.fields?.data?.stringValue || 'null') };
  }
  const missingTable = () => false;
  const merge = (base, mine, theirs) => window.LPMerge.merge(base, mine, theirs);
  async function load() {
    if (!sess) await login();
    try {
      const row = await fetchRow('data,updated_at');
      // changes made offline last time go up now; if the PC saved since, the
      // two are merged so both sets of changes are kept
      // a phone that last synced with the old server: its copy (with any
      // changes made since the PC moved to Firebase) merges in, deleting nothing
      const moved = ls.get(SERVER) !== 'fb';
      if (moved && ls.get(COPY)) { ls.set(PENDING, 'old-server'); ls.set(BASE, null); ls.set(BASE_AT, null); }
      ls.set(SERVER, 'fb');
      const base = ls.get(PENDING), copy = base && ls.get(COPY);
      if (copy) {
        let d = JSON.parse(copy);
        if (row && row.updated_at !== base) {
          let b = null; try { if (ls.get(BASE_AT) === base) b = JSON.parse(ls.get(BASE) || 'null'); } catch { }
          d = merge(b, d, row.data);
        }
        setLast(row?.updated_at, row ? JSON.stringify(row.data) : '');
        ls.set(COPY, JSON.stringify(d));
        setTimeout(() => { save(d).then(() => window.toast?.('✅ Synced', 'The changes you made offline are uploaded.')).catch(() => { }); }, 500);
        offerAside();
        return d;
      }
      ls.set(PENDING, null);
      offerAside();
      if (!row) return null;
      setLast(row.updated_at, JSON.stringify(row.data));
      ls.set(COPY, lastJson);
      return row.data;
    } catch (e) {
      if (e.status === 401 || e.message === 'not logged in') { await login(); return load(); }
      if (missingTable(e)) throw new Error('Phone sync isn\'t set up on the friends server yet.');
      const copy = ls.get(COPY); // offline: open the last copy
      if (copy) {
        lastAt = ls.get(BASE_AT) || ''; lastJson = ls.get(BASE) || ''; // what it was built on, for the upload later
        setTimeout(() => window.toast?.('Offline', 'Showing your last saved copy. Changes save when you\'re back online.'), 800);
        return JSON.parse(copy);
      }
      throw e;
    }
  }
  // changes 2.32.4 and 2.32.5 set aside instead of uploading: offered back, merged in
  function offerAside() {
    const x = ls.get('lpCloudAside'); if (!x) return;
    setTimeout(() => window.toast?.('Changes from this phone were kept aside', 'Changes made on this phone while it was offline were kept aside earlier instead of uploading. Bring them back to add them to your planner.', { timeout: 30000,
      actions: [['Bring them back', () => { try { onAsideFn?.(JSON.parse(x)); ls.set('lpCloudAside', null); } catch { } }], ['Discard', () => ls.set('lpCloudAside', null)]] }), 2500);
  }
  let onAsideFn = null;

  // uploads only over the server copy this phone last had: null means the PC
  // saved since and nothing was written
  async function put(json) {
    const write = () => docCall('POST', `${DOCS}/projects/${FB_PROJECT}/databases/(default)/documents:commit`, { writes: [{
      update: { name: docPath(), fields: { data: { stringValue: json }, device: { stringValue: 'phone' } } },
      updateTransforms: [{ fieldPath: 'updated_at', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: lastAt ? { updateTime: lastAt } : { exists: false } }] });
    for (let i = 0; ; i++) {
      try { const r = await write(); return { updated_at: r.writeResults?.[0]?.updateTime || r.commitTime }; }
      catch (e) {
        if (['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'NOT_FOUND', 'ABORTED'].includes(e.code)) return null;
        if (e.code !== 'PERMISSION_DENIED' || i) throw e;
        // the rules refuse a save within 2 seconds of the last one, and can refuse before the version is checked
        const head = await fetchRow('updated_at');
        if ((head?.updated_at || '') !== lastAt) return null;
        await new Promise(r => setTimeout(r, 2500));
      }
    }
  }
  // the page is told whenever the PC's newer changes were merged in, so it
  // carries on from the merged copy (never from the one built on the old copy)
  let onMergedFn = null, mergedLater = null;
  const tellMerged = x => { if (onMergedFn) onMergedFn(x); else mergedLater = x; };
  // saves are full copies, so a burst of taps goes up once
  let waiting = null;
  function save(D) {
    if (!waiting) waiting = new Promise((ok, bad) => setTimeout(async () => {
      waiting = null;
      const sent = JSON.stringify(D);
      let json = sent, merged = false;
      try {
        for (let i = 0; json !== lastJson; i++) {
          if (i === 4) throw new Error('The planner kept changing, trying again.');
          ls.set(COPY, json);
          const out = await put(json);
          if (out) { setLast(out.updated_at || lastAt, json); break; }
          const row = await fetchRow('data,updated_at');
          let base = null; try { base = lastJson ? JSON.parse(lastJson) : null; } catch { }
          if (!row) { if (!lastAt) throw new Error("Couldn't save, trying again."); lastAt = ''; continue; }
          const m = merge(base, JSON.parse(json), row.data);
          setLast(row.updated_at, JSON.stringify(row.data));
          json = JSON.stringify(m); merged = true;
        }
        ls.set(COPY, json); ls.set(PENDING, null);
        if (merged) tellMerged({ merged: JSON.parse(json), sent: JSON.parse(sent) });
        ok();
      } catch (e) {
        // kept here with the server copy it's built on, and merged when it goes up
        ls.set(COPY, json); ls.set(PENDING, lastAt || 'none');
        if (merged) tellMerged({ merged: JSON.parse(json), sent: JSON.parse(sent) });
        bad(e);
      }
    }, 1500));
    return waiting;
  }

  // changes from the PC: checked every 20s while the app is open, and as soon
  // as you come back to it
  function subscribe(onRemote, onAside, onMerged) {
    onAsideFn = onAside; onMergedFn = onMerged;
    if (mergedLater) { onMerged(mergedLater); mergedLater = null; }
    let busy = false;
    const check = async () => {
      if (busy || document.hidden || !sess || waiting || ls.get(PENDING)) return;
      busy = true;
      try {
        const head = await fetchRow('updated_at');
        if (head && head.updated_at !== lastAt) {
          const row = await fetchRow('data,updated_at');
          // taken only if the page has nothing waiting to go up (that upload merges it in instead)
          if (row && !waiting && !ls.get(PENDING) && onRemote(row.data) !== false) { setLast(row.updated_at, JSON.stringify(row.data)); ls.set(COPY, lastJson); }
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
