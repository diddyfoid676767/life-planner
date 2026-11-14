'use strict';
/* Strava: activities come in as workouts that grow the athlete's
   stats and earn Grit like any other workout, once you tick them off. A planned
   workout on the same day and sport gets the Strava details instead of adding a
   second one. Works through the
   planner's own Strava connection, or from the activities.csv in a Strava
   data export. */

let stravaState = null, stravaBusy = false;
const STRAVA_SPORT = [
  [/run/i, 'Running'], [/ride|bike|cycl/i, 'Cycling'], [/swim/i, 'Swimming'], [/weight|strength|crossfit|workout|hiit|pilates|yoga|cardio/i, 'Strength / Gym'],
  [/hike|walk/i, 'Hiking'], [/soccer|football|rugby|basketball|netball|tennis|squash|badminton|volley|hockey|cricket/i, 'Team sport'],
];
const stravaSport = t => (STRAVA_SPORT.find(([re]) => re.test(t || '')) || [0, 'Other'])[1];

async function checkStrava() {
  if (ONLINE) return;
  try { stravaState = await (await fetch('/api/strava', { cache: 'no-store' })).json(); } catch { stravaState = null; }
}
// turn one activity into a workout (or tick off the planned one it matches)
function stravaToWorkout(a, src = 'strava') {
  const id = src + ':' + a.id;
  if (D.workouts.some(w => w.stravaId === id)) return 0;
  const sport = stravaSport(a.sport_type || a.type), date = (a.start_date_local || '').slice(0, 10), time = (a.start_date_local || '').slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < addDays(today(), -(+D.settings.stravaDays || 30))) return 0;
  // the same session from another source (Garmin, Strava, intervals.icu): started within 10 minutes
  if (time && D.workouts.some(w => w.stravaId && w.date === date && w.time && Math.abs(hmToMin(w.time) - hmToMin(time)) <= 10)) return 0;
  const mins = Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)), km = a.distance ? +(a.distance / 1000).toFixed(2) : '';
  const perMin = (a.suffer_score || 0) / Math.max(mins, 1), hr = a.average_heartrate || 0;
  const intensity = hr >= 165 || perMin >= 1.6 ? 'Hard' : (hr && hr < 135) || (a.suffer_score && perMin < .6) ? 'Easy' : 'Moderate';
  const notes = [{ garmin: 'From Garmin', icu: 'From Garmin via intervals.icu' }[src] || 'From Strava', km && `${km} km`, hr && `avg HR ${Math.round(hr)}`, a.total_elevation_gain && `${Math.round(a.total_elevation_gain)} m climb`].filter(Boolean).join(' · ');
  const planned = D.workouts.find(w => !w.done && !w.stravaId && w.date === date && (w.sport === sport || (sport === 'Running' && w.sport === 'Speed / Agility')));
  if (planned) { Object.assign(planned, { stravaId: id, duration: mins, distance: km || planned.distance, notes: [planned.notes, notes].filter(Boolean).join('\n') }); return 1; }
  D.workouts.push({ id: uid(), title: a.name || sport, sport, eventId: '', date, time, duration: mins, distance: km, intensity, notes, done: false, remind: [], stravaId: id });
  return 1;
}
async function stravaSync(quiet) {
  if (ONLINE || stravaBusy || !stravaState?.connected) return;
  stravaBusy = true; if (!quiet) render();
  try {
    const since = D.settings.stravaSince || Math.floor((Date.now() - (D.settings.stravaDays || 30) * 864e5) / 1000);
    const r = await fetch(`/api/strava/activities?after=${since - 3 * 86400}`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Strava sync failed');
    let n = 0; for (const a of j.items || []) n += stravaToWorkout(a);
    D.settings.stravaSince = Math.floor(Date.now() / 1000); D.settings.stravaLast = new Date().toISOString();
    save();
    if (n) toast(`🟧 ${n} Strava activit${n === 1 ? 'y' : 'ies'} imported`, 'Tick them off in your training plan to count them toward your stats and Grit.');
    else if (!quiet) toast('Strava is up to date', '');
  } catch (e) { if (!quiet) toast("Couldn't sync Strava", e.message, { cls: 'danger' }); }
  stravaBusy = false; render();
}
async function stravaSaveKeys() {
  const id = document.getElementById('stravaId')?.value.trim(), sec = document.getElementById('stravaSecret')?.value.trim();
  const r = await fetch('/api/strava', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ClientID: id, ClientSecret: sec }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast("Couldn't save that", j.error || ''); return; }
  await checkStrava(); render(); location.href = '/strava/connect';
}
async function stravaDisconnect() {
  if (!confirm('Disconnect Strava? Activities already imported stay.')) return;
  await fetch('/api/strava', { method: 'DELETE' }); await checkStrava(); render();
}
// Strava bulk export: Settings → My Account → Download or Delete Your Account → Request archive → activities.csv
function stravaCsv(text, quiet) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const h = rows.shift() || [], col = name => h.findIndex(x => x.trim().toLowerCase() === name);
  const iId = col('activity id'), iDate = col('activity date'), iName = col('activity name'), iType = col('activity type'), iEl = col('elapsed time'), iMov = col('moving time'), iDist = col('distance'), iHr = col('average heart rate'), iRe = col('relative effort');
  if (iId < 0 || iDate < 0) return garminCsv(h, rows, quiet);
  let n = 0;
  for (const r of rows) {
    if (!r[iId]) continue;
    const dt = new Date(r[iDate]); if (isNaN(dt)) continue;
    const local = `${ymd(dt)}T${dt.toTimeString().slice(0, 5)}`;
    const dist = parseFloat(r[iDist]) || 0;
    n += stravaToWorkout({ id: r[iId], name: r[iName], type: r[iType], start_date_local: local, elapsed_time: +r[iEl] || 0, moving_time: +r[iMov] || 0, distance: dist < 400 ? dist * 1000 : dist, average_heartrate: +r[iHr] || 0, suffer_score: +r[iRe] || 0 });
  }
  save(); render(); if (quiet && !n) return n; toast(`🟧 ${n} activit${n === 1 ? 'y' : 'ies'} imported from the file`, n ? 'Tick them off in your training plan to count them toward your stats and Grit.' : 'Everything in that file was already here.');
}
// Garmin Connect: Activities → Export CSV. No activity id, so date + title is the key.
function garminCsv(h, rows, quiet) {
  const col = (...names) => h.findIndex(x => names.includes(x.trim().toLowerCase()));
  const iType = col('activity type'), iDate = col('date', 'start time'), iTitle = col('title'), iDist = col('distance'), iTime = col('time', 'moving time', 'elapsed time'), iHr = col('avg hr', 'average heart rate');
  if (iDate < 0 || iTime < 0) { if (quiet) return 0; toast("That file isn't a Strava or Garmin activity export", 'Use activities.csv from a Strava data export, or Export CSV on the Garmin Connect Activities page.'); return; }
  const secs = v => String(v || '').split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0);
  let n = 0;
  for (const r of rows) {
    const dt = new Date(String(r[iDate] || '').replace(' ', 'T')); if (isNaN(dt)) continue;
    const local = `${ymd(dt)}T${dt.toTimeString().slice(0, 5)}`, title = r[iTitle] || r[iType] || 'Workout';
    const km = parseFloat(String(r[iDist] || '').replace(/,/g, '')) || 0;
    n += stravaToWorkout({ id: (local + '|' + title).replace(/[^\w:|-]/g, ''), name: title, type: r[iType] || title, start_date_local: local, elapsed_time: secs(r[iTime]), moving_time: secs(r[iTime]), distance: km * 1000, average_heartrate: parseFloat(r[iHr]) || 0 }, 'garmin');
  }
  save(); render(); if (quiet && !n) return n; toast(`⌚ ${n} Garmin activit${n === 1 ? 'y' : 'ies'} imported`, n ? 'Tick them off in your training plan to count them toward your stats and Grit.' : 'Everything in that file was already here.');
}
document.addEventListener('change', e => {
  if (e.target.id !== 'stravaFile' || !e.target.files[0]) return;
  const f = e.target.files[0]; f.text().then(stravaCsv); e.target.value = '';
});

// intervals.icu: free, syncs with Garmin Connect, read with the athlete's own API key
let icuState = null, icuBusy = false;
async function checkIcu() {
  if (ONLINE) return;
  try { icuState = await (await fetch('/api/intervals', { cache: 'no-store' })).json(); } catch { icuState = null; }
}
async function icuSync(quiet) {
  if (ONLINE || icuBusy || !icuState?.connected) return;
  icuBusy = true; if (!quiet) render();
  try {
    const oldest = D.settings.icuSince || addDays(today(), -(+D.settings.stravaDays || 30));
    const r = await fetch(`/api/intervals/activities?oldest=${oldest}`, { cache: 'no-store' }), j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Sync failed');
    let n = 0; for (const a of j.items || []) n += stravaToWorkout(a, 'icu');
    D.settings.icuSince = addDays(today(), -3); D.settings.icuLast = new Date().toISOString(); save();
    if (n) toast(`⌚ ${n} new activit${n === 1 ? 'y' : 'ies'} from Garmin`, 'Tick them off in your training plan to count them toward your stats and Grit.');
    else if (!quiet) toast('Garmin is up to date', '');
  } catch (e) { if (!quiet) toast("Couldn't sync with intervals.icu", e.message, { cls: 'danger' }); }
  icuBusy = false; render();
}
async function icuSaveKeys() {
  const athlete = document.getElementById('icuId')?.value.trim(), key = document.getElementById('icuKey')?.value.trim();
  const r = await fetch('/api/intervals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Athlete: athlete, Key: key }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast("Couldn't connect", j.error || ''); return; }
  await checkIcu(); toast('⌚ Connected to intervals.icu', 'Your Garmin activities come in by themselves every hour.'); icuSync(true);
}
async function icuDisconnect() {
  if (!confirm('Disconnect intervals.icu? Activities already imported stay.')) return;
  await fetch('/api/intervals', { method: 'DELETE' }); await checkIcu(); render();
}
// activities the Life Planner Connector Chrome extension read from strava.com
// and connect.garmin.com while you were logged in there
async function browserActsSync() {
  if (ONLINE) return;
  try {
    const j = await (await fetch('/api/browser/activities', { cache: 'no-store' })).json();
    let n = 0; for (const a of j.items || []) n += stravaToWorkout(a, a.src);
    if (n) { save(); render(); toast(`🏃 ${n} new activit${n === 1 ? 'y' : 'ies'} from Strava or Garmin`, 'Tick them off in your training plan to count them toward your stats and Grit.'); }
  } catch { }
}
// an activity CSV saved into Downloads is imported by itself
async function watchDownloads() {
  if (ONLINE || D.settings.watchDownloads === false) return;
  try {
    const j = await (await fetch(`/api/downloads/activities?since=${+D.settings.dlCsvMtime || 0}`, { cache: 'no-store' })).json();
    if (!j.text) return;
    D.settings.dlCsvMtime = j.mtime; save();
    stravaCsv(j.text, true);
  } catch { }
}
function stravaCard() {
  if (ONLINE) return '';
  const s = stravaState || {};
  const icu = icuState || {};
  const icuHtml = icu.connected ? `<div class="card stravacard"><div class="card-head"><h2>⌚ Garmin (via intervals.icu)</h2><span class="muted small-text">Connected${D.settings.icuLast ? ` · synced ${ago(D.settings.icuLast)}` : ''}</span>
      <button class="btn small primary" data-act="icuSync" ${icuBusy ? 'disabled' : ''}>${icuBusy ? 'Syncing…' : 'Sync now'}</button><button class="btn small" data-act="icuOff">Disconnect</button></div>
      <p class="muted small-text" style="margin:0">New activities come in by themselves every hour while the planner is open. They count once you tick them off.</p></div>`
    : `<div class="card stravacard"><details><summary><h2 style="display:inline">⌚ Auto-import from Garmin</h2> <span class="muted small-text">free, through intervals.icu · no uploading</span></summary>
      <ol class="small-text">
        <li>Sign up free at <a href="https://intervals.icu" target="_blank" rel="noopener">intervals.icu</a> and connect <b>Garmin Connect</b> when it asks (you can connect Strava too, but Garmin is what it can pass on).</li>
        <li>In intervals.icu open <b>Settings</b>, scroll down to <b>Developer Settings</b>, and copy your <b>Athlete ID</b> (like i123456) and <b>API Key</b> (press View or Generate).</li>
        <li>Paste them below and press <b>Connect</b>.</li></ol>
      <div class="row"><input type="text" id="icuId" placeholder="Athlete ID, e.g. i123456" style="max-width:200px"><input type="password" id="icuKey" placeholder="API Key" autocomplete="off" style="flex:1;min-width:200px"><button class="btn primary" data-act="icuKeys">Connect</button></div>
      <p class="muted small-text" style="margin-bottom:0">The key stays in this PC's data folder.</p></details></div>`;
  return icuHtml + stravaInner(s);
}
function stravaInner(s) {
  if (s.connected) return `<div class="card stravacard"><div class="card-head"><h2><span class="stravalogo">S</span> Strava</h2><span class="muted small-text">Connected${s.athlete ? ' as ' + esc(s.athlete) : ''}${D.settings.stravaLast ? ` · synced ${ago(D.settings.stravaLast)}` : ''}</span>
    <button class="btn small primary" data-act="stravaSync" ${stravaBusy ? 'disabled' : ''}>${stravaBusy ? 'Syncing…' : 'Sync now'}</button><button class="btn small" data-act="stravaOff">Disconnect</button></div>
    <p class="muted small-text" style="margin:0">New activities come in by themselves every hour while the planner is open. They only count once you tick them off. A planned workout on the same day gets the Strava details instead of being doubled.</p></div>`;
  return `<div class="card stravacard"><details ${s.configured ? 'open' : ''}><summary><h2 style="display:inline"><span class="stravalogo">S</span> Import from Strava or Garmin</h2> <span class="muted small-text">activities come in as workouts you tick off</span></summary>
    <ol class="small-text">
      <li>On a computer, open <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> and create an app (Strava only allows this with a subscription). Use any name (e.g. "My planner"), any category, <b>Website</b>: <code>http://127.0.0.1</code> and <b>Authorization Callback Domain</b>: <code>127.0.0.1</code>.</li>
      <li>Copy the <b>Client ID</b> and <b>Client Secret</b> into the boxes below and press <b>Connect</b>. Strava asks you to allow access, then sends you back here.</li></ol>
    <div class="row"><input type="text" id="stravaId" placeholder="Client ID" value="${esc(s.clientId || '')}" style="max-width:160px"><input type="password" id="stravaSecret" placeholder="Client Secret" autocomplete="off" style="flex:1;min-width:200px">
      <select data-setting="stravaDays" style="width:auto">${[[14, 'last 2 weeks'], [30, 'last 30 days'], [90, 'last 3 months'], [365, 'last year']].map(([v, l]) => `<option value="${v}" ${+(D.settings.stravaDays || 30) === v ? 'selected' : ''}>Import ${l}</option>`).join('')}</select>
      <button class="btn primary" data-act="stravaKeys">Connect</button></div>
    <p class="muted small-text">The secret and sign-in stay in this PC's data folder. <b>No Strava subscription?</b> Import the <b>activities.csv</b> from a free Strava data export (Strava → Settings → My Account → Download or Delete Your Account → Request your archive), or a <b>Garmin Connect</b> export (Activities → Export CSV):
      <label class="btn small">Import a Strava or Garmin CSV<input type="file" id="stravaFile" accept=".csv,text/csv" hidden></label></p>
    <label class="row small-text"><input type="checkbox" data-setting="watchDownloads" ${D.settings.watchDownloads !== false ? 'checked' : ''}> Import it by itself when I save an activities CSV into my Downloads folder</label></details></div>`;
}
(async () => {
  for (let k = 0; k < 40 && !(typeof D !== 'undefined' && D); k++) await new Promise(r => setTimeout(r, 500));
  if (ONLINE || !D) return;
  await checkStrava(); await checkIcu();
  const h = location.hash.match(/strava=(\w+)/);
  if (h) {
    history.replaceState(null, '', location.pathname);
    const msg = { connected: ['🟧 Strava connected', 'Importing your activities now.'], denied: ['Strava wasn\'t connected', 'Try Connect again and press Authorize.'], scope: ['Strava needs activity access', 'Tick "View data about your activities" when you connect.'], error: ['Strava sign-in failed', 'Check the Client ID and Secret.'], missing: ['Add your Strava app first', ''] }[h[1]];
    if (msg) toast(msg[0], msg[1]);
    view = 'training'; ui.arenaPage = 'plan';
  }
  if (D && view === 'training') render();
  stravaSync(true); icuSync(true); watchDownloads(); browserActsSync();
  setInterval(() => { stravaSync(true); icuSync(true); }, 60 * 60000);
  setInterval(() => { watchDownloads(); browserActsSync(); }, 2 * 60000);
})();
