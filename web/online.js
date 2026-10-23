'use strict';
/* Online (claude.ai) storage for Life Planner: the same app, saved in the
   artifact's private database so the phone and PC see the same planner.
   Only included in the online build; app.js checks for window.OL. */
window.OL = (() => {
  const PLANNER = 'planner/main', INBOX = 'inbox/main';
  let dbP = null, mcpP = null, lastWritten = '';
  const db = () => (dbP = dbP || window.claude.use('db'));
  const mcp = () => (mcpP = mcpP || window.claude.use('mcp'));
  const strip = d => { const { feedCache, fired, inbox, ...rest } = d; return rest; };

  async function load() {
    const store = await db();
    if (!store) throw new Error('Sign in to claude.ai to use your planner.');
    const snap = await store.doc(PLANNER).get();
    if (!snap.exists) return null;
    const body = snap.data();
    return body.json ? JSON.parse(body.json) : null;
  }
  async function save(D) {
    const store = await db();
    if (!store) throw new Error('offline');
    const json = JSON.stringify(strip(D));
    if (json === lastWritten) return;
    await store.doc(PLANNER).set({ json, updatedAt: new Date().toISOString(), device: deviceName() });
    lastWritten = json;
  }
  // live updates from the other device
  async function subscribe(onRemote) {
    const store = await db(); if (!store) return;
    store.doc(PLANNER).onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const body = snap.data();
      if (!body.json || body.json === lastWritten) return;
      lastWritten = body.json;
      try { onRemote(JSON.parse(body.json)); } catch { }
    }, () => { });
  }
  async function watchInbox(onInbox) {
    const store = await db(); if (!store) return;
    store.doc(INBOX).onSnapshot(snap => {
      if (!snap.exists) return;
      const body = snap.data();
      try { onInbox(body.json ? JSON.parse(body.json) : body); } catch { }
    }, () => { });
  }
  function deviceName() { return /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'phone' : 'computer'; }

  // ---- Google Calendar through the viewer's own connector ----
  const localIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
  async function listCalendars() {
    const m = await mcp(); if (!m) throw new Error('Calendar access is not available here.');
    const r = await m.callTool('Google Calendar', 'list_calendars', {}, { cache: { staleTime: 3600e3, gcTime: 7 * 86400e3 } });
    const p = r.payload || {};
    return (p.calendars || p.items || []).map(c => ({ id: c.id || c.calendarId, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor, primary: !!c.primary }));
  }
  async function listEvents(calendarId, fromDate, toDate, fresh) {
    const m = await mcp(); if (!m) throw new Error('Calendar access is not available here.');
    const out = [];
    let pageToken;
    for (let i = 0; i < 10; i++) {
      const input = { startTime: localIso(fromDate), endTime: localIso(toDate), orderBy: 'startTime', pageSize: 250 };
      if (calendarId && calendarId !== 'primary') input.calendarId = calendarId;
      if (pageToken) input.pageToken = pageToken;
      const r = await m.callTool('Google Calendar', 'list_events', input, { cache: { staleTime: fresh ? 0 : 15 * 60e3, gcTime: 86400e3, refresh: !!fresh } });
      const p = r.payload || {};
      out.push(...(p.events || p.items || []));
      pageToken = p.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }
  async function download(name, text, type) {
    const dl = await window.claude.use('downloads');
    if (!dl) { alert('Downloads are not available here.'); return; }
    try { await dl.save({ filename: name, data: new Blob([text], { type }) }); } catch { }
  }
  return { load, save, subscribe, watchInbox, listCalendars, listEvents, download };
})();
