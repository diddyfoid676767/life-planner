'use strict';
const ONLINE = !!window.OL;
const ONLINE_URL = 'https://claude.ai/artifact/PENDING';
/* Life Planner front end. All data lives in one object (D) that is saved to
   data/planner-data.json next to the exe through the local server. */

// ---------- utilities ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000); // b - a
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = s => { if (!s) return ''; const d = parseYmd(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
const fmtTime = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad(m)}${ap}`; };
const fmtMins = m => { m = Math.round(m || 0); if (m < 60) return `${m}m`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
const relDays = n => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
const mondayOf = s => { const d = parseYmd(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); };
const round5 = n => Math.max(5, Math.round(n / 5) * 5);

const REMIND_OPTS = [[0, 'At the time'], [15, '15 min before'], [60, '1 hour before'], [180, '3 hours before'], [1440, '1 day before'], [4320, '3 days before'], [10080, '1 week before'], [20160, '2 weeks before']];
const ASSESS_TYPES = ['SAC', 'Exam', 'Practice exam', 'Assignment', 'Test', 'Other'];
const SPORTS = ['Running', 'Cycling', 'Swimming', 'Triathlon', 'Strength / Gym', 'Speed / Agility', 'Team sport', 'Hiking', 'Other'];
const CATS = { Personal: '#7950f2', Deadline: '#e03131', Birthday: '#d6336c', Appointment: '#1098ad', Social: '#f08c00', Work: '#5c940d', School: '#3b5bdb', Other: '#868e96' };
const TRAIN_COLOR = '#f76707', TEVENT_COLOR = '#c92a2a', TODO_COLOR = '#5c677d';
const SUBJ_COLORS = ['#e64980', '#3b5bdb', '#9c36b5', '#2f9e44', '#1098ad', '#8d5524', '#d9480f', '#5c7cfa'];

const DEFAULT_APPS = [['Google Calendar', 'https://calendar.google.com/'], ['Outlook', 'https://outlook.office.com/mail/'], ['Teams', 'https://teams.microsoft.com/'],
  ['OneNote', 'https://www.onenote.com/notebooks'], ['School portal', ''], ['Garmin Connect', 'https://connect.garmin.com/modern/']];
function defaultData() {
  const names = ['English', 'Mathematical Methods', 'Chemistry', 'Psychology', 'Physical Education'];
  return {
    version: 1,
    subjects: names.map((name, i) => ({ id: uid() + i, name, color: SUBJ_COLORS[i], notes: '' })),
    assessments: [], sessions: [], trainingEvents: [], workouts: [], events: [], todos: [], feeds: [], feedCache: {}, focusLogs: [], focus: null, arena: { pbs: [], gear: {}, equip: {}, spent: 0, ledger: {}, battles: [] }, claude: { requests: [], decided: {}, seen: {}, draft: '' }, game: { spent: 0, bonus: 0, items: {}, scene: 'meadow', claimed: {}, opened: 0, hidden: {}, ledger: {}, critters: {}, upgrades: {}, trees: {} },
    links: DEFAULT_APPS.map(([title, url], i) => ({ id: 'app' + i + uid(), title, url, group: 'Apps', subjectId: '', notes: '' })),
    settings: {
      name: '', welcomed: false, sound: true,
      remind: { assessment: [10080, 1440], session: [15], tevent: [10080, 1440], workout: [], event: [1440, 60], todo: [1440] },
    },
    fired: {},
  };
}

// ---------- persistence ----------
let D = null;
let saveTimer = null, saving = false, dirty = false, bootId = '';
function save() {
  dirty = true;
  $('#saveState').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}
async function flush() {
  if (saving) { saveTimer = setTimeout(flush, 200); return; }
  saving = true; dirty = false;
  if (ONLINE) {
    try { await OL.save(D); $('#saveState').textContent = 'Saved online'; }
    catch (e) { $('#saveState').textContent = 'Not saved!'; dirty = true; setTimeout(flush, 5000); }
    finally { saving = false; }
    return;
  }
  try {
    const r = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Planner-Boot': bootId }, body: JSON.stringify(D) });
    if (r.status === 409) { location.reload(); return; }
    if (!r.ok) throw new Error(await r.text());
    $('#saveState').textContent = 'All changes saved';
    setOffline(false);
  } catch (e) {
    $('#saveState').textContent = 'Not saved!';
    dirty = true;
    setOffline(true);
  } finally { saving = false; }
}
function setOffline(off) { $('#offline').hidden = !off; }
async function ping() {
  if (ONLINE) return;
  try { const r = await fetch('/api/ping', { cache: 'no-store' }); if (!r.ok) throw 0; setOffline(false); const b = (await (await fetch('/api/info', { cache: 'no-store' })).json()).boot; if (bootId && b !== bootId) { location.reload(); return; } if (dirty) flush(); }
  catch { setOffline(true); }
}

function migrate(d) {
  const base = defaultData();
  for (const k of ['subjects', 'assessments', 'sessions', 'trainingEvents', 'workouts', 'events', 'todos', 'links', 'feeds']) if (!Array.isArray(d[k])) d[k] = [];
  d.settings = Object.assign({}, base.settings, d.settings || {});
  d.settings.remind = Object.assign({}, base.settings.remind, d.settings.remind || {});
  d.fired = d.fired || {};
  if (!d.settings.palette2) { // one-time switch to the clearer subject colours
    const pal = { 'english': '#e64980', 'maths methods': '#3b5bdb', 'mathematical methods': '#3b5bdb', 'media': '#9c36b5', 'physics': '#2f9e44', 'biology': '#1098ad', 'business management': '#8d5524' };
    for (const s of d.subjects) if (pal[s.name.toLowerCase()]) s.color = pal[s.name.toLowerCase()];
    d.settings.palette2 = true;
  }
  d.feedCache = d.feedCache || {};
  d.focusLogs = d.focusLogs || [];
  d.school = Object.assign({ log: {}, active: null }, d.school || {});
  d.arena = Object.assign({ pbs: [], gear: {}, equip: {}, spent: 0, ledger: {}, battles: [] }, d.arena || {});
  d.claude = Object.assign({ requests: [], decided: {}, seen: {}, draft: '' }, d.claude || {});
  d.game = Object.assign({ spent: 0, bonus: 0, items: {}, scene: 'meadow', claimed: {}, opened: 0, hidden: {}, ledger: {}, critters: {}, upgrades: {}, trees: {}, away: {}, restUsed: {} }, d.game || {});
  d.focus = d.focus || null;
  if (!d.settings.brainfmLink) { if (!d.links.some(l => /brain\.fm/i.test(l.url || ''))) d.links.push({ id: uid(), title: 'Brain.fm', url: 'https://my.brain.fm/', group: 'Apps', subjectId: '', notes: '' }); d.settings.brainfmLink = true; }
  if (d.settings.focusBrainfm == null) d.settings.focusBrainfm = true;
  if (d.settings.yearLevel == null) d.settings.yearLevel = 11;
  if (!d.settings.garminLink) {
    if (!d.links.some(l => /garmin/i.test(l.url || ''))) d.links.push({ id: uid(), title: 'Garmin Connect', url: 'https://connect.garmin.com/modern/', group: 'Apps', subjectId: '', notes: '' });
    d.settings.garminLink = true;
  }
  for (const f of d.feeds || []) if (f.smart == null) f.smart = /office365|outlook|schoolbox/i.test(f.url || '') || /school/i.test(f.name || '');
  d.inbox = d.inbox || null; d.inboxSeen = d.inboxSeen || {}; d.inboxAdded = d.inboxAdded || {}; d.inboxMuted = d.inboxMuted || {};
  return d;
}

// ---------- lookups ----------
const subj = id => D.subjects.find(s => s.id === id) || { name: 'No subject', color: '#868e96' };
const tevent = id => D.trainingEvents.find(e => e.id === id);
const COLL = { assessment: 'assessments', session: 'sessions', tevent: 'trainingEvents', workout: 'workouts', event: 'events', todo: 'todos', subject: 'subjects', link: 'links', feed: 'feeds' };
const find = (kind, id) => D[COLL[kind]].find(x => x.id === id);

// Expand an event's repeats into occurrence dates within [from, to].
function occurrences(ev, from, to) {
  const out = [];
  if (!ev.date) return out;
  const until = ev.until && ev.until < to ? ev.until : to;
  if (!ev.repeat || ev.repeat === 'none') { if (ev.date >= from && ev.date <= to) out.push(ev.date); return out; }
  const start = parseYmd(ev.date);
  if (ev.repeat === 'weekly' || ev.repeat === 'fortnightly') {
    const step = ev.repeat === 'weekly' ? 7 : 14;
    let s = ev.date;
    if (from > s) { const k = Math.floor(diffDays(s, from) / step); s = addDays(s, k * step); }
    for (let i = 0; s <= until && i < 1000; i++, s = addDays(s, step)) if (s >= from) out.push(s);
  } else {
    const day = start.getDate();
    const fy = parseYmd(from).getFullYear();
    let y = ev.repeat === 'yearly' ? Math.max(start.getFullYear(), fy - 1) : start.getFullYear();
    let m = start.getMonth();
    if (ev.repeat === 'monthly') { const f = parseYmd(from); const k = (f.getFullYear() - y) * 12 + f.getMonth() - m - 1; if (k > 0) { m += k; y += Math.floor(m / 12); m %= 12; } }
    for (let i = 0; i < 1000; i++) {
      const dim = new Date(y, m + 1, 0).getDate();
      const s = ymd(new Date(y, m, Math.min(day, dim)));
      if (s > until) break;
      if (s >= from && s >= ev.date) out.push(s);
      if (ev.repeat === 'yearly') y++; else { m++; if (m > 11) { m = 0; y++; } }
    }
  }
  return out;
}

// Everything with a date between from and to (inclusive), as uniform entries.
function agenda(from, to, filter = null) {
  const out = [];
  const add = e => { if (!filter || filter[e.group]) out.push(e); };
  for (const a of D.assessments) if (a.date >= from && a.date <= to) {
    const s = subj(a.subjectId);
    add({ kind: 'assessment', group: 'study', id: a.id, date: a.date, time: a.time, title: a.title, sub: s.name, tag: a.type, color: s.color, done: !!a.done, remind: a.remind, checkable: true, notes: [a.weight, a.notes].filter(Boolean).join(' · ') });
  }
  for (const x of D.sessions) if (x.date >= from && x.date <= to) {
    const s = subj(x.subjectId);
    add({ kind: 'session', group: 'study', id: x.id, date: x.date, time: x.time, title: `Study ${s.name}${x.topic ? ': ' + x.topic : ''}`, sub: fmtMins(x.duration), tag: 'Study', color: s.color, done: !!x.done, remind: x.remind, checkable: true, mins: x.duration, notes: x.notes });
  }
  for (const e of D.trainingEvents) if (e.date >= from && e.date <= to)
    add({ kind: 'tevent', group: 'training', id: e.id, date: e.date, time: e.time, title: e.name, sub: [e.sport, e.location].filter(Boolean).join(' · '), tag: 'Event', color: TEVENT_COLOR, remind: e.remind, notes: [e.goal && 'Goal: ' + e.goal, e.notes].filter(Boolean).join(' · ') });
  for (const w of D.workouts) if (w.date >= from && w.date <= to)
    add({ kind: 'workout', group: 'training', id: w.id, date: w.date, time: w.time, title: w.title, sub: [w.duration ? fmtMins(w.duration) : '', w.distance ? w.distance + ' km' : '', w.intensity].filter(Boolean).join(' · '), tag: 'Training', color: TRAIN_COLOR, done: !!w.done, remind: w.remind, checkable: true, mins: w.duration, notes: w.notes });
  for (const e of D.events) for (const d of occurrences(e, from, to)) {
    const rep = e.repeat && e.repeat !== 'none';
    add({ kind: 'event', group: 'personal', id: e.id, date: d, time: e.time, endTime: e.endTime, title: e.title, sub: [e.location, rep ? 'repeats ' + e.repeat : ''].filter(Boolean).join(' · '), tag: e.category, color: CATS[e.category] || CATS.Other, done: !rep && !!e.done, remind: e.remind, checkable: !rep && e.category === 'Deadline', notes: e.notes });
  }
  for (const t of D.todos) if (t.due && t.due >= from && t.due <= to)
    add({ kind: 'todo', group: 'personal', id: t.id, date: t.due, title: t.text, tag: 'Task', color: TODO_COLOR, done: !!t.done, remind: t.remind, checkable: true, notes: t.notes });
  for (const f of D.feeds) if (f.enabled !== false) {
    const items = D.feedCache[f.id]?.items || [];
    items.forEach((x, i) => { if (x.d >= from && x.d <= to && feedKeeps(f, x)) add({ kind: 'feed', group: 'calendars', id: f.id + '|' + i, date: x.d, time: x.s, endTime: x.e, title: x.t, sub: [x.l].filter(Boolean).join(''), tag: f.name, color: f.color || '#0b7285', notes: '' }); });
  }
  for (const c of GCAL) for (const [i, x] of c.items.entries()) if (x.d >= from && x.d <= to && feedKeeps(c, x))
    add({ kind: 'feed', group: 'calendars', id: c.id + '|' + i, date: x.d, time: x.s, endTime: x.e, title: x.t, sub: x.l || '', tag: c.name, color: c.color, notes: '' });
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  return out;
}

function toggleDone(kind, id, val) {
  const x = find(kind, id); if (!x) return;
  x.done = val; save();
  if (val && x.fromEmail && D.inboxSeen[x.fromEmail] !== 'dismissed') inboxDismiss(x.fromEmail); // done with it, so the email is crossed off too
  const row = document.querySelector(`[data-toggle="${kind}"][data-id="${id}"]`)?.closest('.item, tr');
  if (val && row) { row.classList.add('ticked'); setTimeout(render, 380); } else render();
}

// ---------- rendering helpers ----------
function itemHtml(e, opts = {}) {
  const dd = diffDays(today(), e.date);
  const when = opts.showDate ? `${fmtDate(e.date)} (${relDays(dd)})` : '';
  const time = e.time ? fmtTime(e.time) + (e.endTime ? '–' + fmtTime(e.endTime) : '') : '';
  let urg = '';
  if (!e.done && (e.kind === 'assessment' || e.kind === 'tevent' || e.tag === 'Deadline')) {
    if (dd < 0) urg = '<span class="tag red">Overdue</span>';
    else if (dd <= 3) urg = `<span class="tag red">${relDays(dd)}</span>`;
    else if (dd <= 14) urg = `<span class="tag amber">${dd} days</span>`;
  } else if (!e.done && dd < 0 && e.checkable) urg = '<span class="tag red">Missed</span>';
  const meta = [when, time, e.sub].filter(Boolean).join(' · ');
  const move = opts.move && dd < 0 && (e.kind === 'session' || e.kind === 'workout' || e.kind === 'todo')
    ? `<button class="btn small" data-act="moveToday" data-kind="${e.kind}" data-id="${e.id}" title="Move to today">→ Today</button>` : '';
  return `<li class="item tinted ${e.done ? 'done' : ''}" style="--c:${e.color}">
    ${e.checkable ? `<input type="checkbox" data-toggle="${e.kind}" data-id="${e.id}" ${e.done ? 'checked' : ''} title="Mark done">` : '<span style="width:18px"></span>'}
    <div class="main"><div class="title"><span class="tag ktag">${esc(e.tag)}</span>${esc(e.title)} ${urg}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div>
    ${move}
    ${e.kind === 'session' && !e.done ? `<button class="btn small" data-act="focus" data-id="${e.id}" title="Start a focus timer for this block">▶ Focus</button>` : ''}
    ${e.kind === 'feed' ? '' : `<button class="iconbtn" data-act="edit" data-kind="${e.kind}" data-id="${e.id}" title="Edit">✎</button>`}
  </li>`;
}
const listHtml = (items, empty, opts) => items.length ? `<ul class="list">${items.map(e => itemHtml(e, opts)).join('')}</ul>` : `<div class="empty">${empty}</div>`;
function groupedByDay(items, opts = {}) {
  if (!items.length) return `<div class="empty">${opts.empty || 'Nothing scheduled.'}</div>`;
  let html = '', cur = null;
  for (const e of items) {
    if (e.date !== cur) { if (cur) html += '</ul>'; cur = e.date; html += `<div class="daygroup">${fmtDate(e.date)} · ${relDays(diffDays(today(), e.date))}</div><ul class="list">`; }
    html += itemHtml(e, opts);
  }
  return html + '</ul>';
}
const addMenu = date => `<div class="row">
  <button class="btn small" data-act="new" data-kind="session" data-date="${date || ''}">+ Study</button>
  <button class="btn small" data-act="new" data-kind="assessment" data-date="${date || ''}">+ SAC / Exam</button>
  <button class="btn small" data-act="new" data-kind="workout" data-date="${date || ''}">+ Workout</button>
  <button class="btn small" data-act="new" data-kind="event" data-date="${date || ''}">+ Event</button>
  <button class="btn small" data-act="new" data-kind="deadline" data-date="${date || ''}">+ Deadline</button>
  <button class="btn small" data-act="new" data-kind="todo" data-date="${date || ''}">+ Task</button></div>`;

// ---------- shared building blocks ----------
const pageHead = (title, sub, actions = '') => `<div class="page-head"><div class="ph-text"><h1>${title}</h1>${sub ? `<div class="ph-sub">${sub}</div>` : ''}</div>${actions ? `<div class="ph-actions">${actions}</div>` : ''}</div>`;
const longDay = d => parseYmd(d).toLocaleDateString('en-AU', { weekday: 'long' });
const fullDate = d => { const x = parseYmd(d); return `${longDay(d)} ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
function ringHtml(pct, color, label, value) {
  const r = 26, C = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="rb"/><circle cx="32" cy="32" r="${r}" class="rf" style="stroke:${color}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - Math.max(0, Math.min(1, pct || 0)))).toFixed(1)}"/></svg><div class="rv ${String(value).replace(/<[^>]+>/g, '').length > 5 ? 'long' : ''}">${value}</div><div class="rl">${label}</div></div>`;
}
const checkBox = e => e.checkable ? `<input type="checkbox" data-toggle="${e.kind}" data-id="${e.id}" ${e.done ? 'checked' : ''} title="Mark done">` : '';
const focusBtn = (e, small) => e.kind === 'session' && !e.done ? `<button class="btn small ${small ? 'iconish' : ''}" data-act="focus" data-id="${e.id}" title="Start a focus timer">▶${small ? '' : ' Focus'}</button>` : '';
const editBtn = e => e.kind === 'feed' ? '' : `<button class="iconbtn" data-act="edit" data-kind="${e.kind}" data-id="${e.id}" title="Edit">✎</button>`;
// A vertical timeline for one day. opts.now draws a "now" marker; opts.notes shows notes.
function timelineHtml(items, opts = {}) {
  if (!items.length) return `<div class="empty">${opts.empty || 'Nothing planned.'}</div>`;
  const nowT = opts.now ? new Date().toTimeString().slice(0, 5) : null;
  const row = e => {
    const meta = [e.sub, e.kind === 'feed' ? '' : ''].filter(Boolean).join(' · ');
    return `<li class="tl-item ${e.done ? 'done' : ''}" style="--c:${e.color}">
      <div class="tl-time">${e.time ? fmtTime(e.time) : ''}${e.endTime ? `<span>${fmtTime(e.endTime)}</span>` : ''}</div><div class="tl-dot"></div>
      <div class="tl-card">${checkBox(e)}<div class="main"><div class="title"><span class="tag ktag">${esc(e.tag)}</span>${esc(e.title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}${opts.notes && e.notes ? `<div class="tl-notes">${esc(e.notes)}</div>` : ''}</div>
      ${focusBtn(e)}${editBtn(e)}</div></li>`;
  };
  const any = items.filter(e => !e.time), timed = items.filter(e => e.time);
  let timedHtml = '', placed = !nowT;
  for (const e of timed) {
    if (!placed && e.time > nowT) { timedHtml += `<li class="tl-now"><span>Now · ${fmtTime(nowT)}</span></li>`; placed = true; }
    timedHtml += row(e);
  }
  if (!placed && timed.length) timedHtml += `<li class="tl-now"><span>Now · ${fmtTime(nowT)}</span></li>`;
  return `${any.length ? `<div class="tl-label">Any time</div><ul class="tl">${any.map(row).join('')}</ul>` : ''}${timed.length ? `${any.length ? '<div class="tl-label">Scheduled</div>' : ''}<ul class="tl">${timedHtml}</ul>` : ''}`;
}
const miniRow = e => `<li class="mini ${e.done ? 'done' : ''}" style="--c:${e.color}">${e.checkable ? checkBox(e) : '<i class="mdot"></i>'}<span class="mt">${e.time ? fmtTime(e.time) : ''}</span><span class="mtitle" title="${esc(e.title)}">${esc(e.title)}</span>${focusBtn(e, true)}${editBtn(e)}</li>`;
function miniByDay(items, empty) {
  if (!items.length) return `<div class="empty">${empty}</div>`;
  const days = [...new Set(items.map(e => e.date))];
  return days.map(d => `<div class="mini-day"><b>${longDay(d)}</b> <span class="muted">${fmtDate(d)} · ${relDays(diffDays(today(), d))}</span></div><ul class="minis">${items.filter(e => e.date === d).map(miniRow).join('')}</ul>`).join('');
}

// ---------- views ----------
let view = 'today';
const ui = { daySel: null, calMonth: null, calSel: null, calFilter: { study: true, training: true, personal: true, calendars: true }, studyAll: false, assessPast: false, evFilter: 'upcoming', evCat: '', showDoneTodos: false, studyWeek: 0, forestRange: 'week', trainWeek: 0, inboxCat: '', setTab: 'general' };

function render() {
  applyTheme();
  applyNav();
  if (view === 'health') { view = 'training'; ui.bodyPage = 'health'; }
  if (view === 'day') view = 'today';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const v = $('#view');
  const y = window.scrollY;
  if (v.dataset.view !== view) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); v.dataset.view = view; }
  v.innerHTML = ({ today: viewToday, calendar: viewCalendar, study: viewStudy, forest: viewForest, training: viewTraining, arena: viewArena, friends: viewFriends, school: viewSchool, health: () => { view = 'training'; ui.bodyPage = 'health'; return viewTraining(); }, personal: viewPersonal, inbox: viewInbox, settings: viewSettings })[view]();
  updateInboxBadge();
  gameFeedback();
  window.scrollTo(0, y);
  updateNotifyBtn();
}

function nextOf(list, pred) { return list.filter(pred).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0]; }
function countCard(label, x, title, color, extra = '') {
  if (!x) return `<div class="card count" style="--cc:${color}"><div class="lbl">${label}</div><div class="muted" style="margin-top:6px">Nothing coming up</div></div>`;
  const n = diffDays(today(), x.date);
  return `<div class="card count" style="--cc:${color}"><div class="lbl">${label}</div>
    <div class="big">${n <= 0 ? 'Today' : n}${n > 0 ? `<span style="font-size:1rem;font-weight:600"> day${n === 1 ? '' : 's'}</span>` : ''}</div>
    <div class="title" style="font-weight:600;margin-top:4px">${esc(title)}</div><div class="muted small-text">${fmtDate(x.date)}${x.time ? ' · ' + fmtTime(x.time) : ''}${extra}</div></div>`;
}

// Today: one screen with your day at a glance, quick add, the week strip and
// the picked day's timeline, tasks and what's coming up.
function viewToday() {
  const t = today();
  if (!ui.daySel) ui.daySel = t;
  const d = ui.daySel, isToday = d === t;
  const now = new Date(), h = now.getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const nextA = nextOf(D.assessments, a => !a.done && a.date >= t);
  const nextT = nextOf(D.trainingEvents, e => e.date >= t);
  const deadlines = agenda(t, addDays(t, 366)).filter(e => !e.done && (e.tag === 'Deadline' || e.kind === 'todo'));
  const nextD = deadlines[0];

  const todays = agenda(t, t), items = isToday ? todays : agenda(d, d);
  const overdue = agenda(addDays(t, -21), addDays(t, -1)).filter(e => e.checkable && !e.done);
  const allTodos = D.todos.filter(x => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const checkable = todays.filter(e => e.checkable), doneN = checkable.filter(e => e.done).length;
  const dCheck = items.filter(e => e.checkable), dDone = dCheck.filter(e => e.done).length;
  const studied = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0);
  const goal = +D.settings.dailyGoal || 60, streak = studyStreak();
  const nowT = now.toTimeString().slice(0, 5);
  const nextUp = todays.find(e => e.time && e.time >= nowT && !e.done);
  const nStudy = todays.filter(e => e.kind === 'session').length, nTrain = todays.filter(e => e.kind === 'workout').length;
  const bits = [nStudy && `${nStudy} study block${nStudy === 1 ? '' : 's'}`, nTrain && `${nTrain} workout${nTrain === 1 ? '' : 's'}`, todays.filter(e => e.kind === 'assessment').length && `${todays.filter(e => e.kind === 'assessment').length} SAC/assessment`].filter(Boolean);
  const summary = todays.length ? `${todays.length} thing${todays.length === 1 ? '' : 's'} on today${bits.length ? ': ' + bits.join(', ') : ''}.${nextUp ? ` Next up: <b>${esc(nextUp.title)}</b> at ${fmtTime(nextUp.time)}.` : ''}` : 'Nothing planned today. A great day to get ahead.';
  const studyMins = items.filter(e => e.kind === 'session').reduce((a, e) => a + (+e.mins || 0), 0);
  const trainMins = items.filter(e => e.kind === 'workout').reduce((a, e) => a + (+e.mins || 0), 0);

  const welcome = D.settings.welcomed ? '' : `<div class="card welcome twelcome"><b>👋 Welcome to your Life Planner.</b> <span class="muted">Type anything into Quick add, tick things off as you go, and press ▶ to grow a tree while you study.</span><button class="btn small" data-act="dismissWelcome">Got it</button></div>`;
  const apps = D.links.filter(l => l.group === 'Apps').map(l => l.url
    ? `<a class="appchip" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer"><i style="background:${appColor(l.title)}">${esc(l.title[0] || '?')}</i>${esc(l.title)}</a>`
    : `<button class="appchip" data-act="edit" data-kind="link" data-id="${l.id}" title="Click to add its web address"><i>?</i>${esc(l.title)} (set link)</button>`).join('');
  const cp = typeof currentPeriod === 'function' && (D.settings.school?.on || !D.settings.school) ? currentPeriod() : null, unr = typeof unrated === 'function' ? unrated().length : 0;
  const nowLine = cp ? (cp.b.brk ? `${esc(cp.b.n)} until ${fmtTime(cp.b.end)}` : `Now: <b>${esc(cp.b.n)}</b> · ${esc(subjLabel(periodSubj(t, cp.i)))} · ${Math.ceil(cp.left)} min left`) : '';
  const stat = (v, l, pct) => `<div class="hstat"><b>${v}</b><span>${l}</span><i style="--p:${Math.round(Math.min(1, pct || 0) * 100)}%"></i></div>`;
  const upItem = (icon, label, x, title, color) => {
    if (!x) return `<div class="upitem" style="--c:${color}"><span class="upic">${icon}</span><div><div class="uplbl">${label}</div><div class="muted small-text">Nothing coming up</div></div></div>`;
    const n = diffDays(t, x.date);
    return `<div class="upitem" style="--c:${color}"><span class="upic">${icon}</span><div style="min-width:0"><div class="uplbl">${label}</div><div class="uptitle" title="${esc(title)}">${esc(title)}</div><div class="muted small-text">${fmtDate(x.date)}${x.time ? ' · ' + fmtTime(x.time) : ''}</div></div><span class="updays ${n <= 1 ? 'hot' : n <= 7 ? 'warm' : ''}">${n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`}</span></div>`;
  };
  const wk = mondayOf(d);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const x = addDays(wk, i), list = agenda(x, x), dt = parseYmd(x);
    const ck = list.filter(e => e.checkable), dn = ck.filter(e => e.done).length;
    return `<button class="dpill ${x === d ? 'sel' : ''} ${x === t ? 'today' : ''}" data-act="daySel" data-date="${x}" title="${fullDate(x)}">
      <span class="dn">${DOW[dt.getDay()]} <b>${dt.getDate()}</b></span>
      <span class="dots">${list.slice(0, 6).map(e => `<i style="background:${e.color}"></i>`).join('')}</span>
      <span class="dbar"><i style="width:${ck.length ? dn / ck.length * 100 : 0}%"></i></span></button>`;
  }).join('');
  const after = d < t ? t : d, soonDays = [1, 2, 3].map(k => addDays(after, k)), soon = agenda(soonDays[0], soonDays[2]);
  const todoList = allTodos.slice(0, 12);
  return `<div class="tpage">${welcome}
  <div class="hero slim thero ${tod}">
    <div class="hero-text"><div class="hero-date">${fullDate(t)} ${now.getFullYear()}</div>
      <h1>${greet}${D.settings.name ? ', ' + esc(D.settings.name) : ''}</h1><p>${summary}</p>
      ${nowLine || unr ? `<button class="hnow" data-act="goto" data-v="school">🏫 ${nowLine}${nowLine && unr ? ' · ' : ''}${unr ? `${unr} period${unr === 1 ? '' : 's'} to rate` : ''} →</button>` : ''}</div>
    <button class="btn white thero-go" data-act="focusNew">▶ Start studying</button>
    <div class="hstats">${stat(`${doneN}/${checkable.length}`, 'ticked off', checkable.length ? doneN / checkable.length : 0)}${stat(fmtMins(studied) || '0m', `of ${fmtMins(goal)} study goal`, studied / goal)}${stat('🔥 ' + streak, 'day streak', streak / 7)}</div>
  </div>
  ${quickAddHtml()}
  <div class="tweek"><div class="tweek-nav"><button class="btn small" data-act="dayNav" data-n="-7" title="Previous week">«</button><button class="btn small" data-act="dayNav" data-n="-1" title="Previous day">‹</button></div>
    <div class="daystrip">${strip}</div>
    <div class="tweek-nav"><button class="btn small" data-act="dayNav" data-n="1" title="Next day">›</button><button class="btn small" data-act="dayNav" data-n="7" title="Next week">»</button>${isToday ? '' : '<button class="btn small primary" data-act="dayNav" data-n="0">Today</button>'}<input type="date" value="${d}" data-change="dayPick" title="Jump to a date"></div></div>
  <div class="tgrid">
    <div class="card tday"><div class="card-head"><h2>${isToday ? 'Today' : esc(fullDate(d))}</h2><span class="muted small-text">${isToday ? '' : relDays(diffDays(t, d)) + ' · '}${dDone}/${dCheck.length} done${studyMins ? ` · 📚 ${fmtMins(studyMins)}` : ''}${trainMins ? ` · 🏃 ${fmtMins(trainMins)}` : ''}</span></div>
      <div class="tscroll">${timelineHtml(items, { now: isToday, notes: true, empty: isToday ? 'Nothing on today. Use Quick add or the buttons below.' : 'Nothing planned for this day yet.' })}</div>
      <div class="addrow">${addMenu(d)}</div></div>
    <div class="card ttasks"><div class="card-head"><h2>Tasks</h2><span class="muted small-text">${allTodos.length} open</span>${allTodos.length > todoList.length ? `<button class="btn small" data-act="goto" data-v="personal">All →</button>` : ''}</div>
      <form class="row" data-form="quickTodo" style="margin-bottom:8px"><input type="text" name="text" placeholder="＋ Add a task and press Enter" style="flex:1" maxlength="300"><input type="date" name="due" style="width:auto" title="Due date (optional)"></form>
      <div class="tscroll">${todoList.length ? `<ul class="list tasks compact">${todoList.map(todoHtml).join('')}</ul>` : '<div class="empty">No open tasks. 🎉</div>'}
      ${overdue.length ? `<details class="overdue"><summary><b>⚠ ${overdue.length} overdue or missed</b> <span class="muted small-text">last 3 weeks</span></summary>${listHtml(overdue, '', { showDate: true, move: true })}</details>` : ''}</div></div>
    <div class="tside">
      <div class="card todaynext">${upItem('📝', 'Next SAC / exam', nextA, nextA ? `${subj(nextA.subjectId).name}: ${nextA.title}` : '', nextA ? subj(nextA.subjectId).color : 'var(--accent)')}${upItem('⏰', 'Next deadline', nextD, nextD?.title, CATS.Deadline)}${upItem('🏁', 'Next race / event', nextT, nextT?.name, TEVENT_COLOR)}</div>
      <div class="card tsoon"><div class="card-head"><h2>Coming up</h2><button class="btn small" data-act="goto" data-v="calendar">Calendar →</button></div>
        <div class="tscroll soon3">${soonDays.map(x => { const its = soon.filter(e => e.date === x); return `<div><button class="mini-day linkish" data-act="daySel" data-date="${x}"><b>${longDay(x)}</b> <span class="muted">${fmtDate(x)}</span></button>${its.length ? `<ul class="minis">${its.slice(0, 4).map(miniRow).join('')}</ul>${its.length > 4 ? `<button class="btn small" data-act="daySel" data-date="${x}">+${its.length - 4} more</button>` : ''}` : '<div class="muted small-text">Nothing planned</div>'}</div>`; }).join('')}</div></div>
    </div>
  </div>
  <div class="apps-row">${apps}<button class="appchip add" data-act="new" data-kind="link" data-date="Apps" title="Add a quick-open button">＋</button></div></div>`;
}
const APP_COLORS = { google: '#4285f4', outlook: '#0078d4', teams: '#5b5fc7', onenote: '#7719aa', garmin: '#007cc3', 'brain.fm': '#1f2a44', 'school portal': '#8b1e3f' };
function appColor(title) { const k = Object.keys(APP_COLORS).find(k => title.toLowerCase().includes(k)); return k ? APP_COLORS[k] : 'var(--accent)'; }


function todoHtml(x) {
  const dd = x.due ? diffDays(today(), x.due) : null;
  const tag = dd === null ? '' : dd < 0 ? '<span class="tag red">Overdue</span>' : dd <= 2 ? `<span class="tag amber">${relDays(dd)}</span>` : '';
  return `<li class="item tinted ${x.done ? 'done' : ''}" style="--c:${TODO_COLOR}"><input type="checkbox" data-toggle="todo" data-id="${x.id}" ${x.done ? 'checked' : ''}>
    <div class="main"><div class="title">${esc(x.text)} ${tag}</div>${x.due ? `<div class="meta">Due ${fmtDate(x.due)}</div>` : ''}</div>
    <button class="iconbtn" data-act="edit" data-kind="todo" data-id="${x.id}" title="Edit">✎</button></li>`;
}


function linksHtml(groups) {
  const list = D.links.filter(l => groups.includes(l.group));
  if (arguments[1] === 'chips') return `<div class="link-chips"><span class="muted small-text">Links</span>${list.map(l => `<span class="lchip"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.title)} ↗</a><button class="iconbtn" data-act="edit" data-kind="link" data-id="${l.id}" title="Edit">✎</button></span>`).join('')}<button class="btn small" data-act="new" data-kind="link" data-date="${groups[0]}">+ Link</button></div>`;
  const by = {};
  for (const l of list) { const k = l.subjectId ? subj(l.subjectId).name : l.group; (by[k] = by[k] || []).push(l); }
  const body = Object.entries(by).map(([k, ls]) => `<div class="daygroup">${esc(k)}</div><ul class="list">${ls.map(l => `<li class="item"><div class="main"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer" class="title">${esc(l.title)}</a>${l.notes ? `<div class="meta">${esc(l.notes)}</div>` : ''}</div><button class="iconbtn" data-act="edit" data-kind="link" data-id="${l.id}" title="Edit">✎</button></li>`).join('')}</ul>`).join('');
  return `<div class="card"><div class="card-head"><h2>Resources &amp; links</h2><button class="btn small" data-act="new" data-kind="link" data-date="${groups[0]}">+ Link</button></div>${body || '<div class="empty">Save links to study guides, plans and cheat sheets here.</div>'}</div>`;
}
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';

function legendHtml() {
  const L = [...D.subjects.map(s => [s.name, s.color]), ['Training', TRAIN_COLOR], ['Race / event', TEVENT_COLOR], ['Deadline', CATS.Deadline], ['Personal', CATS.Personal], ['Task', TODO_COLOR], ...D.feeds.filter(f => f.enabled !== false).map(f => [f.name, f.color])];
  return L.map(([n, c]) => `<span class="lg"><i style="background:${c}"></i>${esc(n)}</span>`).join('');
}
function viewCalendar() {
  if (!ui.calMonth) { const d = new Date(); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
  if (!ui.calSel) ui.calSel = today();
  const m = ui.calMonth;
  const first = ymd(m);
  const gridStart = mondayOf(first);
  const gridEnd = addDays(gridStart, 41);
  const items = agenda(gridStart, gridEnd, ui.calFilter);
  const byDay = {};
  for (const e of items) (byDay[e.date] = byDay[e.date] || []).push(e);
  let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('');
  const t = today();
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i), dt = parseYmd(d);
    const list = byDay[d] || [];
    const chips = list.slice(0, 4).map(e => `<div class="chip ${e.done ? 'done' : ''}" style="--cc:${e.color}" title="${esc(e.title)}">${e.time ? fmtTime(e.time) + ' ' : ''}${esc(e.title)}</div>`).join('');
    cells += `<div class="day ${dt.getMonth() !== m.getMonth() ? 'other' : ''} ${d === t ? 'today' : ''} ${d === ui.calSel ? 'sel' : ''}" data-act="calSel" data-date="${d}">
      <span class="num">${dt.getDate()}</span>${chips}${list.length > 4 ? `<div class="more">+${list.length - 4} more</div>` : ''}</div>`;
  }
  const f = ui.calFilter;
  const sel = agenda(ui.calSel, ui.calSel, ui.calFilter);
  return `<div class="toolbar calbar">
      <h1 style="margin:0 8px 0 0">${MONTHS[m.getMonth()]} <span class="muted" style="font-weight:500">${m.getFullYear()}</span></h1>
      <button class="btn" data-act="calNav" data-n="-1">‹</button><button class="btn" data-act="calNav" data-n="0">Today</button><button class="btn" data-act="calNav" data-n="1">›</button><span class="spacer"></span>
      <button class="btn small" data-act="new" data-kind="feed">+ Connect a calendar</button>
      <div class="seg">${['study', 'training', 'personal', 'calendars'].map(g => `<button class="${f[g] ? 'on' : ''}" data-act="calFilter" data-g="${g}">${g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="legend">${legendHtml()}</div>
    <div class="calwrap">
      <div class="cal">${cells}</div>
      <div class="card calday" id="calDay"><div class="card-head"><h2>${fmtDate(ui.calSel)}</h2><span class="muted small-text">${relDays(diffDays(t, ui.calSel))} · ${sel.length} thing${sel.length === 1 ? '' : 's'}</span><span style="flex:1"></span><div class="caladd">${addMenu(ui.calSel)}</div></div>
        ${listHtml(sel, 'Nothing on this day.')}</div>
    </div>`;
}

function viewStudy() {
  const t = today(), now = new Date().toTimeString().slice(0, 5);
  const goal = +D.settings.dailyGoal || 60;
  const sessOf = id => D.sessions.find(x => x.id === id);
  const endOf = (tm, m) => { const [h, mi] = tm.split(':').map(Number), x = h * 60 + mi + m; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  const clean = s => String(s || '').replace(/^Study [^:]*: /, '').replace(/^Study /, '');

  // up next: the next unfinished study block, the next SAC/exam, and today so far
  const upcoming = D.sessions.filter(x => !x.done && (x.date > t || (x.date === t && (!x.time || endOf(x.time, +x.duration || 30) >= now)))).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  const nx = upcoming[0];
  const nextCard = nx ? (() => {
    const s = subj(nx.subjectId), dd = diffDays(t, nx.date);
    return `<div class="card upnext" style="--c:${s.color}"><div class="unlabel">Next study block</div>
      <div class="untitle">${esc(clean(nx.topic) || s.name)}</div>
      <div class="unmeta"><span class="tag" style="background:${s.color}22;color:${s.color}">${esc(s.name)}</span> ${dd === 0 ? 'Today' : relDays(dd)}${nx.time ? ' · ' + fmtTime(nx.time) : ''} · ${fmtMins(+nx.duration || 30)}</div>
      <div class="row" style="margin-top:auto"><button class="btn primary big" data-act="focus" data-id="${nx.id}">▶ Start now</button><button class="btn" data-act="edit" data-kind="session" data-id="${nx.id}">Edit</button></div></div>`;
  })() : `<div class="card upnext"><div class="unlabel">Next study block</div><div class="untitle">Nothing planned</div><div class="unmeta">Plan some revision before your next SAC.</div><div class="row" style="margin-top:auto"><button class="btn primary big" data-act="planStudy">Plan study</button></div></div>`;
  const na = D.assessments.filter(a => !a.done && a.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const sacCard = na ? (() => {
    const s = subj(na.subjectId), dd = diffDays(t, na.date), planned = D.sessions.filter(x => x.assessmentId === na.id), pdone = planned.filter(x => x.done).length;
    return `<div class="card upnext sac ${dd <= 3 ? 'soon' : ''}" style="--c:${s.color}"><div class="unlabel">Next SAC or exam</div>
      <div class="uncount"><b>${dd === 0 ? 'Today' : dd}</b>${dd === 0 ? '' : `<span>day${dd === 1 ? '' : 's'}</span>`}</div>
      <div class="untitle sm">${esc(na.title)}</div><div class="unmeta">${esc(s.name)} · ${fullDate(na.date)}${na.time ? ' ' + fmtTime(na.time) : ''}</div>
      <div class="row" style="margin-top:auto"><button class="btn" data-act="planStudy" data-id="${na.id}">${planned.length ? `Revision ${pdone}/${planned.length} done · plan more` : 'Plan revision'}</button></div></div>`;
  })() : `<div class="card upnext sac"><div class="unlabel">Next SAC or exam</div><div class="untitle">None coming up</div></div>`;
  const minsT = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0);
  const blocksT = D.sessions.filter(x => x.date === t), doneT = blocksT.filter(x => x.done).length;
  const todayCard = `<div class="card upnext today-card"><div class="unlabel">Today</div><div class="row" style="gap:18px;flex-wrap:nowrap">
      ${ringHtml(minsT / goal, '#40c057', 'studied', fmtMins(minsT) || '0m')}${ringHtml(blocksT.length ? doneT / blocksT.length : 0, '#7950f2', 'blocks done', `${doneT}/${blocksT.length}`)}</div>
      <div class="unmeta">Goal ${fmtMins(goal)} · 🔥 ${studyStreak()}-day streak</div></div>`;

  // week: day strip + the selected day's blocks as big rows
  const wk = addDays(mondayOf(t), 7 * ui.studyWeek), wkEnd = addDays(wk, 6);
  if (!ui.studyDay || ui.studyDay < wk || ui.studyDay > wkEnd) ui.studyDay = t >= wk && t <= wkEnd ? t : wk;
  const sd = ui.studyDay;
  const items = agenda(wk, wkEnd).filter(e => e.kind === 'session' || e.kind === 'assessment');
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(wk, i), dt = parseYmd(d), list = items.filter(e => e.date === d);
    const ss = list.filter(e => e.kind === 'session'), due = list.filter(e => e.kind === 'assessment');
    const plan = ss.reduce((a, e) => a + (+e.mins || 0), 0), dn = ss.filter(e => e.done).length;
    return `<button class="dpill ${d === sd ? 'sel' : ''} ${d === t ? 'today' : ''}" data-act="studyDay" data-date="${d}">
      <span class="dn">${DOW[dt.getDay()]}</span><b>${dt.getDate()}</b><span class="dmins">${plan ? fmtMins(plan) : '–'}</span>
      <span class="dots">${due.map(e => `<i class="due" style="background:${e.color}" title="${esc(e.title)}"></i>`).join('')}${ss.slice(0, 5).map(e => `<i style="background:${e.color}"></i>`).join('')}</span>
      <span class="dbar"><i style="width:${ss.length ? dn / ss.length * 100 : 0}%"></i></span></button>`;
  }).join('');
  const dayList = items.filter(e => e.date === sd);
  const dueRows = dayList.filter(e => e.kind === 'assessment').map(e => `<div class="sdue" style="--c:${e.color}" data-act="edit" data-kind="assessment" data-id="${e.id}"><span class="sdue-tag">${esc(e.tag)}</span><b>${esc(e.title.replace(/^[^:]*:\s*/, ''))}</b><span class="muted">${esc(e.sub || '')}${e.time ? ' · ' + fmtTime(e.time) : ''}</span></div>`).join('');
  const blockRows = dayList.filter(e => e.kind === 'session').map(e => {
    const x = sessOf(e.id) || {}, s = subj(x.subjectId), missed = !e.done && sd < t;
    const logged = D.focusLogs.filter(l => l.sessionId === e.id).reduce((a, l) => a + l.mins, 0);
    return `<div class="sblock item ${e.done ? 'done' : ''} ${missed ? 'missed' : ''}" style="--c:${e.color}">
      <div class="stime">${e.time ? fmtTime(e.time) : 'Any time'}<span>${fmtMins(+e.mins || 30)}</span></div>
      <input type="checkbox" class="bigcheck" data-toggle="session" data-id="${e.id}" ${e.done ? 'checked' : ''} title="Mark done">
      <div class="main" data-act="edit" data-kind="session" data-id="${e.id}"><div class="stitle">${esc(clean(x.topic) || clean(e.title))}</div>
        <div class="smeta"><span class="sdot" style="background:${s.color}"></span>${esc(s.name)}${logged ? ` · ⏱ ${fmtMins(logged)} studied` : ''}${missed ? ' · missed' : ''}</div>${x.notes ? `<div class="snotes">${esc(x.notes.slice(0, 110))}${x.notes.length > 110 ? '…' : ''}</div>` : ''}</div>
      ${!e.done ? `<button class="btn primary sp" data-act="focus" data-id="${e.id}" title="Start a focus timer">▶ Start</button>` : '<span class="tag green">✓ Done</span>'}</div>`;
  }).join('');
  const wkLabel = ui.studyWeek === 0 ? 'This week' : ui.studyWeek === 1 ? 'Next week' : ui.studyWeek === -1 ? 'Last week' : `${fmtDate(wk)} – ${fmtDate(wkEnd)}`;

  // SACs & exams
  const assessments = D.assessments.filter(a => ui.assessPast ? a.date < t : a.date >= t).sort((a, b) => ui.assessPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const assessRows = assessments.map(a => {
    const s = subj(a.subjectId), dd = diffDays(t, a.date);
    const planned = D.sessions.filter(x => x.assessmentId === a.id).length;
    const tag = a.done ? '<span class="tag green">Done</span>' : dd < 0 ? '' : dd <= 7 ? `<span class="tag red">${relDays(dd)}</span>` : dd <= 21 ? `<span class="tag amber">${dd} days</span>` : `<span class="tag">${dd} days</span>`;
    return `<li class="aitem ${a.done ? 'done' : ''}" style="--c:${s.color}"><input type="checkbox" data-toggle="assessment" data-id="${a.id}" ${a.done ? 'checked' : ''} title="Mark done">
      <div class="main" data-act="edit" data-kind="assessment" data-id="${a.id}"><div class="title">${esc(a.title)}</div><div class="meta">${esc(s.name)} · ${fmtDate(a.date)}${a.time ? ' ' + fmtTime(a.time) : ''}${a.score ? ' · ' + esc(a.score) : ''}</div></div>${tag}
      ${!ui.assessPast && !a.done ? `<button class="btn small" data-act="planStudy" data-id="${a.id}" title="Create revision sessions before this">Plan${planned ? ` (${planned})` : ''}</button>` : ''}</li>`;
  }).join('');

  // studied this week, per subject
  const tw = mondayOf(t), twEnd = addDays(tw, 6);
  const sum = (from, to, sid) => D.focusLogs.filter(l => l.date >= from && l.date <= to && (!sid || l.subjectId === sid)).reduce((a, l) => a + l.mins, 0);
  const rows = D.subjects.map(s => {
    const w = D.sessions.filter(x => x.subjectId === s.id && x.date >= tw && x.date <= twEnd);
    return { s, focus: sum(tw, twEnd, s.id), done: w.filter(x => x.done).length, plan: w.length };
  });
  const max = Math.max(30, ...rows.map(r => r.focus));
  const trees = D.focusLogs.filter(l => l.mins >= 10 && l.date >= tw).length;
  const subjects = D.subjects.map(s => `<span class="subj" style="--c:${s.color}"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}<button class="iconbtn" data-act="edit" data-kind="subject" data-id="${s.id}" title="Edit subject">✎</button></span>`).join('');

  return `<div class="study2">${pageHead('Study', `${fmtMins(sum(tw, twEnd)) || '0m'} studied this week · ${trees} tree${trees === 1 ? '' : 's'} planted`, `<button class="btn" data-act="planStudy">Plan study</button><button class="btn primary" data-act="focusNew">▶ Start studying</button>`)}
  <div class="upnext-row">${nextCard}${sacCard}${todayCard}</div>
  <div class="study-grid2">
    <div class="study-side">
    <div class="card"><div class="card-head"><h2>${wkLabel}</h2><span class="muted">${fullDate(sd)}</span><span style="flex:1"></span>
      <div class="seg"><button data-act="studyWeek" data-v="-1" title="Previous week">‹</button><button class="${ui.studyWeek === 0 ? 'on' : ''}" data-act="studyWeek" data-v="0">Today</button><button data-act="studyWeek" data-v="1" title="Next week">›</button></div></div>
      <div class="daystrip">${strip}</div>
      <div class="sday">${dueRows}${blockRows || (dueRows ? '' : `<div class="empty big">No study blocks ${sd === t ? 'today' : 'on this day'}.</div>`)}</div>
      <button class="btn" data-act="new" data-kind="session" data-date="${sd}" style="margin-top:10px">+ Add a study block</button></div>
  <div class="card subjcard"><div class="card-head"><h2>Subjects</h2></div><div class="subjects">${subjects || '<span class="empty">Add your subjects to get started.</span>'}<button class="btn small" data-act="new" data-kind="subject">+ Subject</button></div></div>
  ${linksHtml(['Study'], 'chips')}
    </div>
    <div class="study-side">
      <div class="card"><div class="card-head"><h2>SACs &amp; exams</h2><span style="flex:1"></span>
        <div class="seg"><button class="${!ui.assessPast ? 'on' : ''}" data-act="assessPast" data-v="0">Upcoming</button><button class="${ui.assessPast ? 'on' : ''}" data-act="assessPast" data-v="1">Past</button></div>
        <button class="iconbtn" data-act="new" data-kind="assessment" title="Add SAC / exam">＋</button></div>
        ${assessRows ? `<ul class="alist">${assessRows}</ul>` : `<div class="empty">${ui.assessPast ? 'No past assessments.' : 'No upcoming SACs or exams.'}</div>`}</div>
      <div class="card"><div class="card-head"><h2>Studied this week</h2><b class="wk-total">${fmtMins(sum(tw, twEnd)) || '0m'}</b></div>
        <div class="bars">${rows.map(r => `<div class="bar"><span>${esc(r.s.name)}</span><div class="track"><div class="fill" style="width:${r.focus / max * 100}%;background:${r.s.color}"></div></div><span class="muted">${fmtMins(r.focus) || '0m'}${r.plan ? ` · ${r.done}/${r.plan}` : ''}</span></div>`).join('') || '<div class="empty">No subjects.</div>'}</div>
        <p class="muted small-text" style="margin:8px 0 0">Time from the focus timer · blocks ticked off / planned.</p>
        <a href="#" class="forest-link" data-act="goto" data-v="forest">${treeSvg('#40c057', 45, 1, 'oak', 30)}<span><b>${trees} tree${trees === 1 ? '' : 's'}</b> this week · 🔥 ${studyStreak()}-day streak</span><span class="muted">Open forest →</span></a></div>
    </div>
  </div>
</div>`;
}

function trainingPlan() {
  const t = today();
  const events = D.trainingEvents.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const past = D.trainingEvents.filter(e => e.date < t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const next = events[0];
  const evRow = e => {
    const dd = diffDays(t, e.date), ws = D.workouts.filter(w => w.eventId === e.id);
    const done = ws.filter(w => w.done && w.date <= t).length, due = ws.filter(w => w.date <= t).length;
    return `<li class="evtile" style="--c:${TEVENT_COLOR}"><div class="evdate"><span>${MON[parseYmd(e.date).getMonth()]}</span><b>${parseYmd(e.date).getDate()}</b><span>${DOW[parseYmd(e.date).getDay()]}</span></div>
      <div class="main"><div class="title">${esc(e.name)} <span class="tag ${dd <= 7 ? 'red' : dd <= 28 ? 'amber' : ''}">${relDays(dd)}</span></div>
      <div class="meta">${[e.time && fmtTime(e.time), e.sport, e.goal && 'Goal: ' + e.goal, ws.length && `${ws.length} planned sessions, ${done}/${due} done`].filter(Boolean).map(esc).join(' · ')}</div></div>
      <button class="btn small" data-act="planTraining" data-id="${e.id}">${ws.length ? 'Rebuild plan' : 'Build plan'}</button><button class="iconbtn" data-act="edit" data-kind="tevent" data-id="${e.id}">✎</button></li>`;
  };
  const twk = mondayOf(t), twkEnd = addDays(twk, 6);
  const thisWeek = agenda(twk, twkEnd).filter(e => e.kind === 'workout');
  const doneMins = thisWeek.filter(e => e.done).reduce((a, e) => a + (+e.mins || 0), 0);
  const planMins = thisWeek.reduce((a, e) => a + (+e.mins || 0), 0);
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const s = addDays(twk, -7 * i), e = addDays(s, 6), ws = D.workouts.filter(w => w.date >= s && w.date <= e);
    weeks.push({ s, done: ws.filter(w => w.done).reduce((a, w) => a + (+w.duration || 0), 0), plan: ws.reduce((a, w) => a + (+w.duration || 0), 0) });
  }
  const max = Math.max(60, ...weeks.map(w => Math.max(w.done, w.plan)));
  const chart = `<div class="vbars">${weeks.map(w => `<div class="vb" title="${i18nWeek(w.s)}: ${fmtMins(w.done) || '0m'} of ${fmtMins(w.plan) || '0m'}"><div class="vtrack"><i class="vp" style="height:${w.plan / max * 100}%"></i><i class="vd" style="height:${w.done / max * 100}%"></i></div><span>${parseYmd(w.s).getDate()} ${MON[parseYmd(w.s).getMonth()]}</span></div>`).join('')}</div>`;

  // week board of workouts
  const wk = addDays(twk, 7 * (ui.trainWeek || 0)), wkEnd = addDays(wk, 6);
  const items = agenda(wk, wkEnd).filter(e => e.kind === 'workout' || e.kind === 'tevent');
  const cols = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(wk, i), dt = parseYmd(d), list = items.filter(e => e.date === d);
    const ws = list.filter(e => e.kind === 'workout'), evs = list.filter(e => e.kind === 'tevent');
    const mins = ws.reduce((a, e) => a + (+e.mins || 0), 0);
    return `<div class="wcol ${d === t ? 'today' : ''} ${d < t ? 'past' : ''}"><div class="whead"><span>${DOW[dt.getDay()]} <b>${dt.getDate()}</b></span>${mins ? `<span class="muted">${fmtMins(mins)}</span>` : ''}</div>
      <div class="wbody">${evs.map(e => `<div class="wdue" style="--c:${e.color}" data-act="edit" data-kind="tevent" data-id="${e.id}">🏁 ${esc(e.title)}</div>`).join('')}
      ${ws.map(e => `<div class="wchip item ${e.done ? 'done' : ''} ${!e.done && d < t ? 'missed' : ''}" style="--c:${e.color}"><div class="wtop">${checkBox(e)}<span class="meta">${e.time ? fmtTime(e.time) : ''}</span></div>
        <div class="main" data-act="edit" data-kind="workout" data-id="${e.id}" title="${esc(e.title)}"><div class="title">${esc(e.title)}</div><div class="meta">${esc(e.sub)}</div></div></div>`).join('')}
      <button class="wadd" data-act="new" data-kind="workout" data-date="${d}" title="Add a workout">+</button></div></div>`;
  }).join('');
  const wkLabel = !ui.trainWeek ? 'This week' : ui.trainWeek === 1 ? 'Next week' : ui.trainWeek === -1 ? 'Last week' : `${fmtDate(wk)} – ${fmtDate(wkEnd)}`;
  const nd = next ? diffDays(t, next.date) : 0, nws = next ? D.workouts.filter(w => w.eventId === next.id) : [];
  return `<p class="muted" style="margin:0 0 10px">${fmtMins(doneMins) || '0m'} of ${fmtMins(planMins) || '0m'} done this week. Tick off workouts to grow your athlete.</p>${stravaCard()}
    <div class="train-top">
      ${next ? `<div class="card nextev"><div class="lbl">Next event</div><div class="nebig">${nd <= 0 ? 'Today!' : nd}<span>${nd > 0 ? (nd === 1 ? ' day' : ' days') : ''}</span></div>
        <h2>${esc(next.name)}</h2><div class="nemeta">${fmtDate(next.date)}${next.time ? ' · ' + fmtTime(next.time) : ''}${next.goal ? ' · Goal: ' + esc(next.goal) : ''}</div>
        ${nws.length ? `<div class="nebar"><i style="width:${nws.filter(w => w.done).length / nws.length * 100}%"></i></div><div class="nemeta">${nws.filter(w => w.done).length}/${nws.length} plan sessions done</div>` : ''}
        <button class="btn white small" data-act="planTraining" data-id="${next.id}">${nws.length ? 'Rebuild plan' : 'Build a plan'}</button></div>`
        : `<div class="card nextev empty-ev"><div class="lbl">Next event</div><h2>Nothing booked</h2><div class="nemeta">Add a race, game or comp and build a plan toward it.</div><button class="btn white small" data-act="new" data-kind="tevent">+ Add event</button></div>`}
      <div class="card ringcard">${ringHtml(planMins ? doneMins / planMins : 0, TRAIN_COLOR, 'this week', `${fmtMins(doneMins) || '0m'}`)}<div class="small-text muted">${thisWeek.filter(e => e.done).length}/${thisWeek.length} sessions done</div></div>
      <div class="card"><div class="card-head"><h3 style="margin:0">Training load</h3><span class="muted small-text">last 6 weeks</span></div>${chart}</div>
    </div>
    <div class="card board"><div class="card-head"><h2>${wkLabel}</h2>
      <div class="seg"><button data-act="trainWeek" data-v="-1" title="Previous week">‹</button><button class="${!ui.trainWeek ? 'on' : ''}" data-act="trainWeek" data-v="0">Today</button><button data-act="trainWeek" data-v="1" title="Next week">›</button></div></div>
      <div class="weekboard short">${cols}</div></div>
    <div class="card"><div class="card-head"><h2>Events I'm training for</h2></div>
      ${events.length ? `<ul class="evtiles">${events.map(evRow).join('')}</ul>` : '<div class="empty">Add an event (fun run, race, game, comp, hike…) and build a training plan toward it.</div>'}
      ${past.length ? `<details style="margin-top:8px"><summary class="muted small-text">Past events</summary><ul class="list">${past.map(e => `<li class="item"><span class="dot" style="background:${TEVENT_COLOR}"></span><div class="main"><div class="title">${esc(e.name)}</div><div class="meta">${fmtDate(e.date)}${e.result ? ' · Result: ' + esc(e.result) : ''}</div></div><button class="iconbtn" data-act="edit" data-kind="tevent" data-id="${e.id}">✎</button></li>`).join('')}</ul></details>` : ''}</div>
    ${linksHtml(['Training', 'Other'], 'chips')}`;
}


const i18nWeek = s => { const d = parseYmd(s); return `Wk of ${d.getDate()} ${MON[d.getMonth()]}`; };

function viewPersonal() {
  const t = today();
  let list;
  if (ui.evFilter === 'upcoming') list = agenda(t, addDays(t, 365)).filter(e => e.kind === 'event');
  else if (ui.evFilter === 'past') list = agenda(addDays(t, -365), addDays(t, -1)).filter(e => e.kind === 'event').reverse();
  else list = D.events.map(e => ({ ...agenda(e.date, e.date).find(x => x.kind === 'event' && x.id === e.id) })).filter(x => x.id).sort((a, b) => a.date.localeCompare(b.date));
  if (ui.evFilter === 'upcoming') {
    const seen = new Set(); list = list.filter(e => { const ev = find('event', e.id); if (!ev.repeat || ev.repeat === 'none') return true; if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  }
  if (ui.evCat) list = list.filter(e => e.tag === ui.evCat);
  let month = '';
  const evHtml = list.map(e => {
    const dt = parseYmd(e.date), dd = diffDays(t, e.date), mk = MONTHS[dt.getMonth()] + ' ' + dt.getFullYear();
    const head = mk !== month ? `<li class="evmonth">${mk}</li>` : ''; month = mk;
    const urg = !e.done && e.tag === 'Deadline' && dd >= 0 && dd <= 7 ? `<span class="tag red">${relDays(dd)}</span>` : `<span class="muted small-text">${relDays(dd)}</span>`;
    return `${head}<li class="evtile ${e.done ? 'done' : ''}" style="--c:${e.color}"><div class="evdate"><span>${MON[dt.getMonth()]}</span><b>${dt.getDate()}</b><span>${DOW[dt.getDay()]}</span></div>
      <div class="main"><div class="title">${esc(e.title)} ${urg}</div><div class="meta"><span class="tag ktag">${esc(e.tag)}</span>${esc([e.time && fmtTime(e.time) + (e.endTime ? '–' + fmtTime(e.endTime) : ''), e.sub].filter(Boolean).join(' · '))}</div></div>
      ${checkBox(e)}${editBtn(e)}</li>`;
  }).join('');
  const open = D.todos.filter(x => !x.done);
  const groupsDef = [
    ['⚠ Overdue', x => x.due && x.due < t], ['Today', x => x.due === t], ['Tomorrow', x => x.due === addDays(t, 1)],
    ['This week', x => x.due && x.due > addDays(t, 1) && x.due <= addDays(t, 7)], ['Later', x => x.due && x.due > addDays(t, 7)], ['No due date', x => !x.due],
  ];
  const sorted = open.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const groups = groupsDef.map(([label, fn]) => { const xs = sorted.filter(fn); return xs.length ? `<div class="tgroup"><div class="tg-head">${label} <span>${xs.length}</span></div><ul class="list tasks">${xs.map(todoHtml).join('')}</ul></div>` : ''; }).join('');
  const doneList = ui.showDoneTodos ? D.todos.filter(x => x.done) : [];
  return `${pageHead('Events &amp; Tasks', `${list.length} ${ui.evFilter === 'past' ? 'past' : ui.evFilter === 'all' ? '' : 'upcoming'} event${list.length === 1 ? '' : 's'} · ${open.length} open task${open.length === 1 ? '' : 's'}`,
      `<button class="btn" data-act="new" data-kind="deadline">+ Deadline</button><button class="btn primary" data-act="new" data-kind="event">+ Event</button>`)}
  <div class="grid g2">
    <div class="card"><div class="card-head"><h2>Events &amp; deadlines</h2></div>
      <div class="toolbar"><div class="seg">${[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([k, l]) => `<button class="${ui.evFilter === k ? 'on' : ''}" data-act="evFilter" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="catchips"><button class="cchip ${!ui.evCat ? 'on' : ''}" data-act="evCat" data-v="">All</button>${Object.entries(CATS).map(([c, col]) => `<button class="cchip ${ui.evCat === c ? 'on' : ''}" style="--c:${col}" data-act="evCat" data-v="${c}">${c}</button>`).join('')}</div></div>
      ${evHtml ? `<ul class="evtiles">${evHtml}</ul>` : '<div class="empty">Nothing here yet.</div>'}</div>
    <div class="card"><div class="card-head"><h2>Tasks</h2><label class="small-text muted"><input type="checkbox" data-change="showDoneTodos" ${ui.showDoneTodos ? 'checked' : ''}> show completed</label></div>
      <form class="row" data-form="quickTodo" style="margin-bottom:10px"><input type="text" name="text" placeholder="Add a task and press Enter" style="flex:1" maxlength="300"><input type="date" name="due" style="width:auto" title="Due date (optional)"><button class="btn primary">Add</button></form>
      ${groups || '<div class="empty">No open tasks. 🎉</div>'}
      ${doneList.length ? `<div class="tgroup"><div class="tg-head">Completed <span>${doneList.length}</span></div><ul class="list tasks">${doneList.map(todoHtml).join('')}</ul></div>` : ''}
      ${D.todos.some(x => x.done) ? '<button class="btn small" data-act="clearDone" style="margin-top:10px">Clear completed</button>' : ''}</div>
  </div>`;
}


// ---------- missed info (email summary) ----------
// Claude writes data/missed-info.json: { updated, summary, items: [{ id, source, from, subject, received, category, summary, due, link }] }
const INBOX_CATS = ['Action needed', 'Deadline', 'Event', 'Changed', 'FYI'];
async function loadInbox() {
  try {
    if (ONLINE) return;
    const r = await fetch('/api/inbox', { cache: 'no-store' });
    applyInbox(await r.json());
  } catch { }
}
// Crossed-off emails stay gone: the same email coming back (a forward, a reply
// or the school copy) is matched on its subject too. The list also goes to the
// data folder so the hourly email check skips them and never mentions them again.
const inboxKey = x => String(x.subject || '').toLowerCase().replace(/^\s*((re|fw|fwd|aw)\s*:\s*)+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const inboxGone = x => D.inboxSeen[x.id] === 'dismissed' || (!!inboxKey(x) && !!D.inboxMuted[inboxKey(x)]);
function inboxDismiss(id) {
  const x = (D.inbox?.items || []).find(i => i.id === id);
  D.inboxSeen[id] = 'dismissed';
  if (x && inboxKey(x)) D.inboxMuted[inboxKey(x)] = today();
  // its to-do goes too (SACs and tests stay in the planner)
  D.todos = D.todos.filter(t => t.fromEmail !== id || t.done);
  save(); render(); syncInboxDismissed();
}
async function syncInboxDismissed() {
  if (ONLINE) return;
  const ids = Object.keys(D.inboxSeen).filter(k => D.inboxSeen[k] === 'dismissed'), subjects = Object.keys(D.inboxMuted);
  try { await fetch('/api/inbox/dismissed', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updated: new Date().toISOString(), ids, subjects }) }); } catch { }
}
function applyInbox(d) {
  try {
    if (d && Array.isArray(d.items) && (!D.inbox || d.updated !== D.inbox.updated)) {
      const isNew = !!D.inbox;
      D.inbox = d; inboxToPlanner(); save();
      const fresh = d.items.filter(x => !D.inboxSeen[x.id] && !inboxGone(x)).length;
      if (isNew && fresh) notify(`${fresh} new thing${fresh === 1 ? '' : 's'} in Missed info`, d.summary || '', 'inbox');
      if (!modal.open) render();
    }
  } catch { }
}
// SACs, tests and other dated school work found in email go straight into the
// planner: an assessment when the subject is clear, otherwise a task. Each email
// is only ever added once (D.inboxAdded), so deleting the entry keeps it gone.
const ASSESS_RE = /\b(sacs?|exam|test|assessment|assignment|essay|presentation|oral|prac(tical)?|investigation|report|folio|quiz|outcome)\b/i;
const DUE_RE = /\b(due|submit|submission|hand[- ]?in|deadline|bring|permission|form|sign|pay|excursion|incursion|camp|reminder|complete|finish)\b/i;
const SUBJ_ALIAS = [[/\b(maths? methods|methods|mm)\b/i, /method/i], [/\b(spec(ialist)?|specialist maths)\b/i, /spec/i], [/\b(general maths|gen maths)\b/i, /general/i], [/\bbio(logy)?\b/i, /bio/i], [/\bchem(istry)?\b/i, /chem/i], [/\bphys(ics)?\b/i, /phys/i], [/\b(biz|bus(iness)?( management)?|bm)\b/i, /bus/i], [/\b(eng(lish)?|lit(erature)?|eal)\b/i, /engl|lit/i], [/\bmedia\b/i, /media/i], [/\b(pe|phys(ical)? ed(ucation)?)\b/i, /physical|\bpe\b/i]];
function inboxSubject(text) {
  for (const s of D.subjects) if (s.name && new RegExp('\\b' + s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text)) return s;
  for (const [re, nameRe] of SUBJ_ALIAS) if (re.test(text)) { const s = D.subjects.find(x => nameRe.test(x.name)); if (s) return s; }
  return null;
}
function inboxToPlanner() {
  if (!D.inbox?.items || D.settings.inboxAuto === false) return 0;
  D.inboxAdded = D.inboxAdded || {};
  const t = today(), added = [];
  for (const x of D.inbox.items) {
    if (!x.id || D.inboxAdded[x.id] || inboxGone(x) || !/^\d{4}-\d{2}-\d{2}$/.test(x.due || '') || x.due < t) continue;
    const text = `${x.subject || ''} ${x.summary || ''}`, cat = x.category || 'FYI';
    const assess = ASSESS_RE.test(text) || /^mwb-[at]/.test(x.id), s = assess && inboxSubject(text); // school portal and Teams assessments always count
    if (!assess && !DUE_RE.test(text) && cat !== 'Deadline' && cat !== 'Action needed') continue;
    const notes = [x.summary, x.from && `From ${x.from}`, x.source ? `Added from ${x.source}` + (x.link ? ': ' + x.link : '') : 'Added from your email'].filter(Boolean).join('\n');
    if (s) {
      const same = D.assessments.find(a => a.subjectId === s.id && a.date === x.due);
      if (same) { D.inboxAdded[x.id] = 'a:' + same.id; continue; }
      const type = /\bsacs?\b/i.test(text) ? 'SAC' : /practice exam|trial exam/i.test(text) ? 'Practice exam' : /\bexam\b/i.test(text) ? 'Exam' : /\b(test|quiz)\b/i.test(text) ? 'Test' : /assignment|essay|report|folio|investigation/i.test(text) ? 'Assignment' : 'Other';
      const a = { id: uid(), subjectId: s.id, type, title: (x.subject || type).slice(0, 120), date: x.due, time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '', weight: '', score: '', notes, done: false, remind: D.settings.remind.assessment, fromEmail: x.id };
      D.assessments.push(a); D.inboxAdded[x.id] = 'a:' + a.id; added.push(`${s.name} ${type}`);
    } else {
      if (D.todos.some(td => td.fromEmail === x.id || (td.due === x.due && td.text.startsWith(x.subject || '\u0000')))) { D.inboxAdded[x.id] = 't'; continue; }
      const td = { id: uid(), text: (x.subject || 'From email').slice(0, 140), due: x.due, done: false, notes, remind: D.settings.remind.todo, fromEmail: x.id };
      D.todos.push(td); D.inboxAdded[x.id] = 't:' + td.id; added.push(td.text);
    }
  }
  if (added.length) {
    notify(`📬 ${added.length} due date${added.length === 1 ? '' : 's'} from your email, school portal or Teams added to your planner`, added.slice(0, 4).join(' · ') + (added.length > 4 ? ' …' : ''), 'inboxadd');
  }
  return added.length;
}
function updateInboxBadge() {
  const b = document.querySelector('#tabs button[data-view=inbox]'); if (!b) return;
  const n = (D.inbox?.items || []).filter(x => !D.inboxSeen[x.id] && !inboxGone(x)).length;
  b.dataset.badge = n || '';
}
function mailLink(x) {
  if (x.link && /^https:\/\//.test(x.link)) return x.link;
  if (!x.id || !/^[A-Za-z0-9_-]+$/.test(x.id)) return '';
  const acct = D.settings.gmailAccount;
  return `https://mail.google.com/mail/${acct ? '?authuser=' + encodeURIComponent(acct) : ''}#all/${x.id}`;
}
// Opens a claude.ai path in the Claude desktop app, or in the browser when the app isn't installed.
async function openClaudeApp(path) {
  if (!ONLINE) {
    try { const r = await fetch('/api/claude?path=' + encodeURIComponent(path), { method: 'POST' }); if (r.ok) return true; } catch { }
  }
  window.open('https://claude.ai' + path, '_blank', 'noopener');
  return false;
}
const PROJECT_URL = 'https://claude.ai/code';
// "Check email now" starts the hourly email check straight away once the
// scheduled task's token is saved (Settings, App); otherwise it opens Claude.
let claudeLinked = null;
async function checkClaudeLink() {
  if (ONLINE) return (claudeLinked = false);
  try { claudeLinked = !!(await (await fetch('/api/claudelink', { cache: 'no-store' })).json()).configured; } catch { claudeLinked = false; }
  return claudeLinked;
}
async function inboxCheckNow() {
  if (claudeLinked === null) await checkClaudeLink();
  if (claudeLinked) {
    try {
      const r = await fetch('/api/claudelink', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Claude couldn't start the check.");
      toast('📬 Checking your email now', 'Claude is reading your Gmail and school mail. Missed info updates by itself in a few minutes.', { timeout: 9000 });
      return;
    } catch (e) { toast("Couldn't start the email check", e.message, { cls: 'danger', timeout: 10000 }); return; }
  }
  await loadInbox();
  try { await navigator.clipboard.writeText('Check my email now and update Missed info'); } catch { }
  const where = await openClaudeApp(PROJECT_URL.replace('https://claude.ai', '')) ? 'the Claude app' : 'a new tab';
  toast('Reloaded Missed info', `Claude opened in ${where}. Paste the copied message (Ctrl+V) and send it to get a fresh check now; this tab updates within a minute after.`, { timeout: 12000 });
}
const INBOX_STYLE = { 'Action needed': ['#e03131', '❗'], Deadline: ['#f76707', '⏰'], Event: ['#7950f2', '📅'], Changed: ['#f59f00', '🔄'], FYI: ['#1c7ed6', 'ℹ️'] };
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!(m >= 0)) return new Date(iso).toLocaleString();
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)} days ago`;
};
function viewInbox() {
  const ib = D.inbox;
  const all = (ib?.items || []).filter(x => !inboxGone(x));
  const cats = INBOX_CATS.concat([...new Set(all.map(x => x.category || 'FYI'))].filter(c => !INBOX_CATS.includes(c)));
  const items = ui.inboxCat ? all.filter(x => (x.category || 'FYI') === ui.inboxCat) : all;
  const unread = all.filter(x => !D.inboxSeen[x.id]).length;
  // sort: by urgency (urgent / coming up / everything else) or simply newest first
  const sort = ui.inboxSort || 'urgent', t = today();
  const rec = x => String(x.received || '');
  const urg = x => {
    const c = x.category || 'FYI', dd = x.due ? diffDays(t, x.due) : null;
    if (c === 'Action needed' || (dd != null && dd <= 3)) return 0;
    if (c === 'Deadline' || c === 'Event' || c === 'Changed' || (dd != null && dd >= 0)) return 1;
    return 2;
  };
  const byUrg = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || rec(b).localeCompare(rec(a));
  const sorted = [...items].sort((a, b) => rec(b).localeCompare(rec(a)));
  const groups = sort === 'recent' ? [['', sorted]] : [['🔥 Urgent', 'Needs action, or due within 3 days'], ['📌 Coming up', 'Deadlines, events and changes'], ['📰 Everything else', '']]
    .map(([h, sub], i) => [h ? `<div class="mgroup"><b>${h}</b>${sub ? `<span class="muted small-text">${sub}</span>` : ''}</div>` : '', items.filter(x => urg(x) === i).sort(byUrg)]).filter(g => g[1].length);
  const card = x => {
    const c = x.category || 'FYI', [col, icon] = INBOX_STYLE[c] || ['#868e96', '✉️'];
    return `<li class="mailcard ${D.inboxSeen[x.id] ? '' : 'unread'}" style="--c:${col}"><div class="micon">${icon}</div>
      <div class="main"><div class="title">${D.inboxSeen[x.id] ? '' : '<span class="newdot"></span>'}${esc(x.subject || '(no subject)')}${x.due ? ` <span class="tag ${diffDays(t, x.due) <= 3 ? 'red' : 'amber'}">due ${fmtDate(x.due)}${diffDays(t, x.due) < 0 ? ' (overdue)' : diffDays(t, x.due) <= 3 ? ` (${relDays(diffDays(t, x.due))})` : ''}</span>` : ''}</div>
        <div class="msum">${esc(x.summary || '')}</div>
        <div class="meta"><span class="tag ktag">${esc(c)}</span>${esc(x.source || 'Email')} · ${esc(x.from || '')}${x.received ? ` · <span title="${esc(new Date(x.received).toLocaleString())}">${esc(ago(x.received))}</span>` : ''}</div></div>
      <div class="mact">${mailLink(x) ? `<a class="btn small primary" href="${esc(mailLink(x))}" target="_blank" rel="noopener noreferrer" title="Opens the email in Gmail, where you can reply">Open &amp; reply ↗</a>` : ''}
        ${D.inboxAdded[x.id] ? '<span class="tag green" title="Already in your planner">✓ In planner</span>' : x.due ? `<button class="btn small" data-act="inboxTask" data-id="${esc(x.id)}">+ Task</button>` : ''}
        <button class="iconbtn" data-act="inboxDismiss" data-id="${esc(x.id)}" title="Cross off: hides it for good, and the email check won\x27t bring it back">✕</button></div></li>`;
  };
  return `${pageHead('Missed info', ib?.updated ? `Updated ${new Date(ib.updated).toLocaleString()} · ${unread} new` : 'Summaries of emails you might have missed',
      `<button class="btn primary" data-act="inboxCheck" title="Starts a fresh email check now">↻ Check email now</button><button class="btn" data-act="inboxRead">Mark all read</button>
      <label class="btn">Load file<input type="file" accept=".json,application/json" data-change="importInbox" hidden></label>
      ${D.settings.inboxUrl ? `<a class="btn" href="${esc(safeUrl(D.settings.inboxUrl))}" target="_blank" rel="noopener noreferrer">Online ↗</a>` : ''}`)}
    ${ib?.summary ? `<div class="card summarycard"><div class="micon">✨</div><div>${esc(ib.summary)}</div></div>` : ''}
    ${all.length ? `<div class="row mtools"><div class="seg"><button class="${sort === 'urgent' ? 'on' : ''}" data-act="inboxSort" data-v="urgent">🔥 Most urgent first</button><button class="${sort === 'recent' ? 'on' : ''}" data-act="inboxSort" data-v="recent">🕒 Newest first</button></div></div>` : ''}
    ${all.length ? `<div class="catchips" style="margin-bottom:12px"><button class="cchip ${!ui.inboxCat ? 'on' : ''}" data-act="inboxCat" data-v="">All <b>${all.length}</b></button>${cats.map(c => { const n = all.filter(x => (x.category || 'FYI') === c).length; return n ? `<button class="cchip ${ui.inboxCat === c ? 'on' : ''}" style="--c:${(INBOX_STYLE[c] || ['#868e96'])[0]}" data-act="inboxCat" data-v="${esc(c)}">${(INBOX_STYLE[c] || ['', '✉️'])[1]} ${esc(c)} <b>${n}</b></button>` : ''; }).join('')}</div>` : ''}
    ${items.length ? groups.map(([h, list]) => `${h}<ul class="mailcards">${list.map(card).join('')}</ul>`).join('') : `<div class="card emptystate"><svg viewBox="0 0 120 90" width="140" aria-hidden="true"><rect x="10" y="18" width="100" height="64" rx="10" fill="color-mix(in srgb, var(--accent) 14%, transparent)"/><path d="M14 26 L60 58 L106 26" stroke="var(--accent)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="98" cy="20" r="12" fill="#40c057"/><path d="M92 20 l4 4 l8 -8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
      <h2>${ib ? 'You\'re all caught up' : 'No summary yet'}</h2><p class="muted">${ib ? 'Nothing you missed. Nice.' : 'Claude checks your email every hour (7am to 10pm) while the Claude app is open on this PC, and puts a summary here.'}</p></div>`}
    <p class="muted small-text">Claude checks your Gmail, school Outlook and Teams notifications every hour (7am to 10pm) while the Claude app is open on this PC. For an instant check, use <b>Check email now</b>.</p>`;
}


async function loadShortcuts() {
  try {
    const st = await (await fetch('/api/shortcuts')).json();
    document.querySelectorAll('[data-shortcut]').forEach(el => { el.checked = !!st[el.dataset.shortcut]; });
  } catch { }
}
function viewSettings() {
  setTimeout(loadShortcuts, 0);
  const r = D.settings.remind;
  const remindRow = (k, label) => `<tr><th>${label}</th>${REMIND_OPTS.map(([v, l]) => `<td><label class="rcheck" title="${l}"><input type="checkbox" data-remdef="${k}" value="${v}" ${r[k].includes(v) ? 'checked' : ''}></label></td>`).join('')}</tr>`;
  const sec = ui.setTab || 'general';
  const tabs = [['general', '👤 You'], ...(acct.configured && !ONLINE ? [['account', '🔑 Account']] : []), ['theme', '🎨 Theme'], ['calendars', '📅 Calendars'], ['reminders', '🔔 Reminders'], ['backup', '💾 Backup'], ['app', '🖥 App']];
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return `${pageHead('Settings', '', '')}
  <div class="seg settabs">${tabs.map(([k, l]) => `<button class="${sec === k ? 'on' : ''}" data-act="setTab" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="grid g2 settings-grid" data-sec="${sec}">
    ${themeCard()}
    ${navCard()}
    ${accountCard().replace('class="card acctcard"', 'class="card acctcard" data-sec="account"')}
    ${ONLINE ? `<div class="card" data-sec="calendars" style="grid-column:1/-1"><div class="card-head"><h2>Calendars</h2><button class="btn small" data-act="gcalRefresh">Refresh</button><button class="btn small primary" data-act="gcalChoose">Choose calendars</button></div>
      <p class="muted small-text" style="margin-top:0">Shows your Google Calendar (${(D.settings.gcal?.ids || ['primary']).length} calendar(s) selected). The first time, claude.ai asks you to allow access to Google Calendar. To include your school Outlook or Garmin calendar, subscribe to its iCal link inside Google Calendar (Other calendars → + → From URL).</p>
      ${GCAL.map(c => `<div class="row small-text"><span class="dot" style="background:${c.color};width:10px;height:10px;border-radius:50%;display:inline-block"></span>${esc(c.name)}: ${c.items.length} events${c.smart ? ` (${c.items.filter(x => !feedKeeps(c, x)).length} hidden by school filter)` : ''}</div>`).join('')}</div>` : ''}
    <div class="card" data-sec="calendars" style="grid-column:1/-1;${ONLINE ? 'display:none' : ''}"><div class="card-head"><h2>Calendar sync (Google, Outlook, school portal)</h2>
      <button class="btn small" data-act="refreshFeeds">Refresh now</button><label class="btn small">Import .ics file<input type="file" accept=".ics,text/calendar" data-change="importIcs" hidden></label><button class="btn small primary" data-act="new" data-kind="feed">+ Add calendar link</button></div>
      ${D.feeds.length ? `<ul class="list">${D.feeds.map(f => { const c = D.feedCache[f.id] || {}; return `<li class="item"><span class="dot" style="background:${f.color}"></span><div class="main"><div class="title">${esc(f.name)}${f.enabled === false ? ' <span class="tag">hidden</span>' : ''}</div>
        <div class="meta">${f.url ? '' : 'Imported file · '}${(c.items || []).length} events${f.smart || f.hide ? ` (${(c.items || []).filter(x => !feedKeeps(f, x)).length} hidden by filter)` : ''}${c.fetched ? ' · updated ' + new Date(c.fetched).toLocaleString() : ''}${c.error ? ` · <span style="color:var(--danger)">${esc(c.error)}</span>` : ''}</div></div>
        <button class="iconbtn" data-act="edit" data-kind="feed" data-id="${f.id}">✎</button></li>`; }).join('')}</ul>` : '<div class="empty">No calendars connected yet.</div>'}
      <details style="margin-top:10px"><summary><b>Where do I find the link?</b></summary><div class="small-text">
        <p><b>Google Calendar</b> (on a computer): open calendar.google.com → ⚙ Settings → under "Settings for my calendars" click your calendar → scroll to <i>Integrate calendar</i> → copy <b>Secret address in iCal format</b>. Do this for each calendar you want.</p>
        <p><b>Outlook / school Microsoft 365</b>: open outlook.office.com → ⚙ Settings → Calendar → Shared calendars → <i>Publish a calendar</i> → choose Calendar and "Can view all details" → Publish → copy the <b>ICS</b> link. If the option is missing, your school has turned publishing off. Teams meetings live in this calendar too.</p>
        <p><b>Garmin Connect</b> (planned workouts and races): on connect.garmin.com open your <i>Calendar</i> and look for a <i>Subscribe</i> / <i>Export</i> (iCal) option, then copy that link here. A link starting with webcal:// is fine. If there isn't one, sync Garmin to Strava and use the quick-open button instead.</p>
        <p><b>School portal</b>: in its calendar, look for <i>Subscribe</i>, <i>iCal</i> or <i>Export</i> and copy that link. If it only lets you download a file, use <b>Import .ics file</b> instead (that's a one-off snapshot).</p>
        <p><b>Going the other way:</b> use <b>Export to calendar (.ics)</b> below, then import that file into Google Calendar (Settings → Import &amp; export) or Outlook (Add calendar → Upload from file).</p>
        <p class="muted">Keep the secret links private: anyone with one can see that calendar.</p></div></details></div>
    <div class="card" data-sec="general" style="grid-column:1/-1"><div class="card-head"><h2>Setup and guide</h2><button class="btn small" data-act="tourStart">🧭 Take the tour</button><button class="btn small primary" data-act="setupOpen">Change my setup</button></div>
      <p class="muted small-text" style="margin:0">Change your name, classes, bell times and timetable, or add a training week. Nothing else is touched.</p>
      ${ONLINE ? '' : `<details style="margin-top:10px"><summary><b>Share the planner with a friend</b></summary><div class="small-text"><p>Send them <b>LifePlanner-share.zip</b>. It's the same app with none of your data in it. When they first open it, they get the setup and the tour, then everything they add is saved only on their PC.</p>
        <p>Don't send your own LifePlanner folder: its <b>data</b> folder holds your planner. Missed info is linked to your Claude account, so on their copy those pages only work once they set up their own.</p></div></details>`}</div>
    <div class="card" data-sec="general"><h2>You</h2>
      <div class="field"><label>Your name (for the greeting)</label><input type="text" data-setting="name" value="${esc(D.settings.name)}" maxlength="40"></div>
      <label class="row"><input type="checkbox" data-setting="sound" ${D.settings.sound ? 'checked' : ''}> Play a sound with reminders</label>
      <div class="frow" style="margin-top:10px"><div class="field"><label>Year level</label><input type="number" min="1" max="12" data-setting="yearLevel" value="${esc(D.settings.yearLevel || 11)}"></div>
        <div class="field"><label>House</label><input type="text" data-setting="house" value="${esc(D.settings.house || '')}" placeholder="Your house"></div>
        <div class="field"><label>Other houses (comma separated)</label><input type="text" data-setting="houses" value="${esc(D.settings.houses || '')}" placeholder="Hides notices meant for them"></div></div>
      <div class="field"><label>Daily study goal (minutes)</label><input type="number" min="10" max="600" step="5" data-setting="dailyGoal" value="${esc(D.settings.dailyGoal || 60)}"></div>
      <div class="field"><label>Training goal (shown on the Training tab)</label><input type="text" data-setting="trainingGoal" value="${esc(D.settings.trainingGoal || '')}" placeholder="e.g. Get fitter, faster and stronger for athletics and footy"></div>
      <label class="row"><input type="checkbox" data-setting="inboxAuto" ${D.settings.inboxAuto !== false ? 'checked' : ''}> Put SACs, tests and other due dates from my email straight into the planner and to-do list</label>
      <div class="field"><label>Missed info online page (optional link)</label><input type="text" data-setting="inboxUrl" value="${esc(D.settings.inboxUrl || '')}" placeholder="https://claude.ai/…"></div>
    </div>
    <div class="card" data-sec="reminders"><h2>Reminders</h2>
      <p class="muted small-text" style="margin-top:0">Pop-up notifications: <b>${perm === 'granted' ? 'on' : perm === 'denied' ? 'blocked in browser settings' : perm === 'unsupported' ? 'not supported by this browser' : 'off'}</b>.
      Reminders appear while the planner tab is open (it can be in the background). Things you missed while it was closed pop up next time you open it.</p>
      <div class="row"><button class="btn" data-act="askNotify">Turn on notifications</button><button class="btn" data-act="testNotify">Send a test reminder</button></div>
      <p class="muted small-text">Tip: export to your phone's calendar (below) for reminders even when your PC is off.</p></div>
    <div class="card" data-sec="reminders" style="grid-column:1/-1"><h2>Default reminders for new items</h2>
      <div style="overflow-x:auto"><table class="remtable"><thead><tr><th></th>${REMIND_OPTS.map(([, l]) => `<th>${l.replace(' before', '')}</th>`).join('')}</tr></thead><tbody>
      ${remindRow('assessment', 'SACs &amp; exams')}${remindRow('session', 'Study sessions')}${remindRow('tevent', 'Training events')}${remindRow('workout', 'Workouts')}${remindRow('event', 'Personal events')}${remindRow('todo', 'Tasks with a due date')}</tbody></table></div>
      <p class="muted small-text">Columns are how long before each item you get reminded.</p></div>
    <div class="card" data-sec="backup"><h2>Backup &amp; sync</h2>
      <p class="muted small-text" style="margin-top:0">Your data is in <code>data\\planner-data.json</code> next to LifePlanner.exe. A daily backup is kept in <code>data\\backups</code> (last 14 days).</p>
      <div class="row"><button class="btn" data-act="exportJson">Export backup (.json)</button><label class="btn">Import backup<input type="file" accept=".json,application/json" data-change="importJson" hidden></label></div>
      <div class="row" style="margin-top:8px"><button class="btn" data-act="exportIcs">Export to calendar (.ics)</button></div>
      <p class="muted small-text">The .ics file can be imported into Google Calendar, Outlook or your phone's calendar. It includes your reminders.</p></div>
    <div class="card" data-sec="app" style="${ONLINE ? 'display:none' : ''}"><h2>Use it like a normal app</h2>
      <p class="muted small-text" style="margin-top:0">Life Planner opens in its own window. Add shortcuts so you can open it like any other app (or pin it: right-click its icon on the taskbar → Pin to taskbar).</p>
      <div class="checks" id="shortcuts" style="flex-direction:column;gap:8px">
        <label><input type="checkbox" data-shortcut="desktop"> Desktop shortcut</label>
        <label><input type="checkbox" data-shortcut="startmenu"> Start menu</label>
        <label><input type="checkbox" data-shortcut="startup"> Open Life Planner when Windows starts (so reminders always work)</label>
      </div>
      <p class="muted small-text">If you move the LifePlanner folder, untick and tick these again.</p></div>
    <div class="card" data-sec="app" style="${ONLINE ? '' : 'display:none'}"><h2>Phone &amp; online</h2>
      ${ONLINE ? `<p class="small-text" style="margin-top:0">This is the online version: it saves to your claude.ai account, so your phone and PC always show the same planner.</p>
        <p class="small-text"><b>On your phone:</b> open this page in your browser (signed in to claude.ai), then <i>Share → Add to Home Screen</i> (iPhone) or <i>⋮ → Add to Home screen</i> (Android).</p>`
      : `<p class="small-text" style="margin-top:0">Your planner can also live online so it's on your phone. <a href="${ONLINE_URL}" target="_blank" rel="noopener noreferrer">Open the online version ↗</a></p>
        <p class="small-text">To move this PC's planner online: click <b>Export backup</b> above, then in the online version go to Settings → <b>Import backup</b>.</p>
        <label class="row small-text"><input type="checkbox" data-setting="useOnline" ${D.settings.useOnline ? 'checked' : ''}> Open the online version when I start LifePlanner.exe (so PC and phone always match)</label>`}
    </div>
    <div class="card" data-sec="app" style="${ONLINE ? 'display:none' : ''}"><h2>App</h2>
      <p class="small-text"><b id="verText">Version ${esc(appVersion)}</b> · New versions download by themselves from GitHub. You can also put a LifePlanner zip in your Downloads folder.</p>
      <label class="row small-text"><input type="checkbox" data-setting="autoUpdate" ${D.settings.autoUpdate !== false ? 'checked' : ''}> Install updates automatically (never during a focus timer)</label>
      <p class="small-text"><b>Brain.fm:</b> <span id="brainfmState">${brainfmApp ? 'opens the app (' + esc(brainfmApp.split(/[\\/]/).pop()) + ')' : 'app not found, so it opens the website'}</span></p>
      <div class="row" style="margin-bottom:10px"><input type="text" placeholder="Brain.fm app path (optional, e.g. C:\\Users\\you\\AppData\\Local\\brain\\Brain.fm.exe)" data-setting="brainfmPath" value="${esc(D.settings.brainfmPath || '')}" style="flex:1;min-width:220px"><button class="btn small" data-act="brainfmTest">Test</button></div>
      <p class="muted small-text" style="margin-top:0">Closing this tab is fine: the planner shuts itself down a few minutes after the last tab is closed. To reopen it, double-click LifePlanner.exe.</p>
      <p class="small-text" style="margin-top:14px"><b>Instant email check:</b> <span id="claudeLinkState">${claudeLinked ? 'on. <b>Check email now</b> starts the check straight away.' : 'off. <b>Check email now</b> opens Claude instead.'}</span></p>
      <p class="muted small-text" style="margin-top:0">To turn it on: in the Claude app open <b>Routines</b> in the left sidebar, open <b>Missed info email check</b>, click <b>⋯</b> then <b>Edit</b>, click <b>+</b> next to Trigger, pick <b>API</b>, then <b>Generate token</b> and paste it here. It's saved only on this PC.</p>
      <div class="row" style="margin-bottom:10px"><input type="password" id="claudeToken" placeholder="${claudeLinked ? 'Token saved (paste a new one to replace it)' : 'Paste the token (starts with sk-ant-)'}" autocomplete="off" style="flex:1;min-width:220px"><button class="btn small" data-act="claudeTokenSave">Save</button>${claudeLinked ? '<button class="btn small" data-act="claudeTokenClear">Remove</button>' : ''}</div>
      <div class="row"><button class="btn" data-act="loadStarter">Re-add starter plan</button><button class="btn danger" data-act="quit">Quit planner now</button><button class="btn danger" data-act="reset">Delete all data…</button></div></div>
  </div>`;
}

// ---------- forms ----------
const modal = $('#modal'), mform = $('#modalForm');
let formCtx = null;
function fieldHtml(f) {
  const v = f.value ?? '';
  const id = 'f_' + f.key;
  const req = f.required ? 'required' : '';
  let input;
  switch (f.type) {
    case 'select': input = `<select id="${id}" name="${f.key}" ${req}>${f.options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`; break;
    case 'textarea': input = `<textarea id="${id}" name="${f.key}" maxlength="5000">${esc(v)}</textarea>`; break;
    case 'bool': return `<div class="field"><label class="row" style="color:var(--text);font-size:.92rem;font-weight:600"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
    case 'remind': case 'checks': {
      const opts = f.type === 'remind' ? REMIND_OPTS : f.options;
      const vals = (v || []).map(String);
      input = `<div class="checks">${opts.map(([val, lab]) => `<label><input type="checkbox" name="${f.key}" value="${val}" ${vals.includes(String(val)) ? 'checked' : ''}>${esc(lab)}</label>`).join('')}</div>`; break;
    }
    case 'row': return `<div class="frow">${f.fields.map(fieldHtml).join('')}</div>`;
    case 'html': return f.html;
    default: input = `<input id="${id}" type="${f.type || 'text'}" name="${f.key}" value="${esc(v)}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} maxlength="300">`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}
function flatFields(fields) { return fields.flatMap(f => f.type === 'row' ? flatFields(f.fields) : f.type === 'html' ? [] : [f]); }
function showForm({ title, fields, onSave, onDelete, saveLabel = 'Save' }) {
  formCtx = { fields, onSave, onDelete };
  mform.innerHTML = `<h2>${esc(title)}</h2>${fields.map(fieldHtml).join('')}
    <div class="modal-actions">${onDelete ? '<button type="button" class="btn danger left" data-mact="delete">Delete</button>' : ''}
      <button type="button" class="btn" data-mact="cancel">Cancel</button><button type="submit" class="btn primary">${esc(saveLabel)}</button></div>`;
  modal.showModal();
  const firstInput = mform.querySelector('input[type=text],select,textarea');
  if (firstInput) firstInput.focus();
}
mform.addEventListener('submit', e => {
  e.preventDefault();
  const vals = {};
  for (const f of flatFields(formCtx.fields)) {
    const els = mform.querySelectorAll(`[name="${f.key}"]`);
    if (f.type === 'remind') vals[f.key] = [...els].filter(x => x.checked).map(x => Number(x.value)).sort((a, b) => b - a);
    else if (f.type === 'checks') vals[f.key] = [...els].filter(x => x.checked).map(x => x.value);
    else if (f.type === 'bool') vals[f.key] = els[0].checked;
    else if (f.type === 'number') vals[f.key] = els[0].value === '' ? null : Number(els[0].value);
    else vals[f.key] = els[0].value.trim();
  }
  if (formCtx.onSave(vals) === false) return;
  modal.close(); save(); render();
});
mform.addEventListener('click', e => {
  const b = e.target.closest('[data-mact]'); if (!b) return;
  if (b.dataset.mact === 'cancel') modal.close();
  if (b.dataset.mact === 'delete' && confirm('Delete this? This can\'t be undone.')) { if (formCtx.onDelete() !== false) { modal.close(); save(); render(); } }
});

function upsert(coll, id, vals) {
  if (id) Object.assign(D[coll].find(x => x.id === id), vals);
  else D[coll].push({ id: uid(), ...vals });
}
function remove(coll, id) { D[coll] = D[coll].filter(x => x.id !== id); }
const subjOpts = () => D.subjects.map(s => [s.id, s.name]);
const notesF = v => ({ key: 'notes', label: 'Notes', type: 'textarea', value: v });

const editors = {
  subject(id) {
    const s = id ? find('subject', id) : { name: '', color: SUBJ_COLORS[D.subjects.length % SUBJ_COLORS.length], notes: '' };
    showForm({
      title: id ? 'Edit subject' : 'Add subject',
      fields: [{ key: 'name', label: 'Subject name', value: s.name, required: true, placeholder: 'e.g. Mathematical Methods' },
        { key: 'color', label: 'Colour', type: 'color', value: s.color }, notesF(s.notes)],
      onSave: v => upsert('subjects', id, v),
      onDelete: id && (() => {
        const na = D.assessments.filter(a => a.subjectId === id).length, ns = D.sessions.filter(a => a.subjectId === id).length;
        if ((na || ns) && !confirm(`This also deletes ${na} assessment(s) and ${ns} study session(s) for this subject. Continue?`)) return false;
        remove('subjects', id); D.assessments = D.assessments.filter(a => a.subjectId !== id); D.sessions = D.sessions.filter(a => a.subjectId !== id);
      }),
    });
  },
  assessment(id, pre = {}) {
    if (!D.subjects.length) { alert('Add a subject first (Study tab).'); return; }
    const a = id ? find('assessment', id) : { subjectId: D.subjects[0].id, type: 'SAC', title: '', date: pre.date || '', time: '', weight: '', score: '', notes: '', done: false, remind: D.settings.remind.assessment };
    if (!id && pre.fill) Object.assign(a, pre.fill);
    showForm({
      title: id ? 'Edit assessment' : 'Add SAC / exam',
      fields: [{ type: 'row', fields: [{ key: 'subjectId', label: 'Subject', type: 'select', options: subjOpts(), value: a.subjectId }, { key: 'type', label: 'Type', type: 'select', options: ASSESS_TYPES, value: a.type }] },
        { key: 'title', label: 'Title', value: a.title, required: true, placeholder: 'e.g. Unit 3 SAC 2: Data analysis' },
        { type: 'row', fields: [{ key: 'date', label: 'Date', type: 'date', value: a.date, required: true }, { key: 'time', label: 'Start time (optional)', type: 'time', value: a.time }] },
        { type: 'row', fields: [{ key: 'weight', label: 'Weighting / details', value: a.weight, placeholder: 'e.g. 8% of study score' }, { key: 'score', label: 'Result', value: a.score, placeholder: 'e.g. 42/50' }] },
        { key: 'remind', label: 'Remind me', type: 'remind', value: a.remind }, notesF(a.notes), { key: 'done', label: 'Completed', type: 'bool', value: a.done }],
      onSave: v => upsert('assessments', id, v),
      onDelete: id && (() => { remove('assessments', id); }),
    });
  },
  session(id, pre = {}) {
    if (!D.subjects.length) { alert('Add a subject first (Study tab).'); return; }
    const s = id ? find('session', id) : { subjectId: D.subjects[0].id, date: pre.date || today(), time: '16:30', duration: 60, topic: '', notes: '', done: false, remind: D.settings.remind.session };
    if (!id && pre.fill) Object.assign(s, pre.fill);
    showForm({
      title: id ? 'Edit study session' : 'Add study session',
      fields: [{ key: 'subjectId', label: 'Subject', type: 'select', options: subjOpts(), value: s.subjectId },
        { key: 'topic', label: 'Topic / focus', value: s.topic, placeholder: 'e.g. Practice exam Section B' },
        { type: 'row', fields: [{ key: 'date', label: 'Date', type: 'date', value: s.date, required: true }, { key: 'time', label: 'Time', type: 'time', value: s.time }] },
        { key: 'duration', label: 'Length (minutes)', type: 'number', value: s.duration, min: 5, step: 5 },
        { key: 'remind', label: 'Remind me', type: 'remind', value: s.remind }, notesF(s.notes), { key: 'done', label: 'Done', type: 'bool', value: s.done }],
      onSave: v => upsert('sessions', id, v),
      onDelete: id && (() => { remove('sessions', id); }),
    });
  },
  tevent(id, pre = {}) {
    const e = id ? find('tevent', id) : { name: '', sport: 'Running', date: pre.date || '', time: '', location: '', goal: '', result: '', notes: '', remind: D.settings.remind.tevent };
    if (!id && pre.fill) Object.assign(e, pre.fill);
    showForm({
      title: id ? 'Edit training event' : 'Add training event',
      fields: [{ key: 'name', label: 'Event name', value: e.name, required: true, placeholder: 'e.g. Run Melbourne 10 km' },
        { type: 'row', fields: [{ key: 'sport', label: 'Sport', type: 'select', options: SPORTS, value: e.sport }, { key: 'location', label: 'Location', value: e.location }] },
        { type: 'row', fields: [{ key: 'date', label: 'Date', type: 'date', value: e.date, required: true }, { key: 'time', label: 'Start time', type: 'time', value: e.time }] },
        { type: 'row', fields: [{ key: 'goal', label: 'Goal', value: e.goal, placeholder: 'e.g. under 50 min' }, { key: 'result', label: 'Result', value: e.result }] },
        { key: 'remind', label: 'Remind me', type: 'remind', value: e.remind }, notesF(e.notes)],
      onSave: v => upsert('trainingEvents', id, v),
      onDelete: id && (() => {
        const n = D.workouts.filter(w => w.eventId === id && !w.done).length;
        if (n && confirm(`Also delete the ${n} upcoming/unfinished workouts in its plan?`)) D.workouts = D.workouts.filter(w => !(w.eventId === id && !w.done));
        remove('trainingEvents', id);
      }),
    });
  },
  workout(id, pre = {}) {
    const w = id ? find('workout', id) : { title: '', sport: 'Running', eventId: '', date: pre.date || today(), time: '', duration: 45, distance: '', intensity: 'Moderate', notes: '', done: false, remind: D.settings.remind.workout };
    if (!id && pre.fill) Object.assign(w, pre.fill);
    showForm({
      title: id ? 'Edit workout' : 'Add workout',
      fields: [{ key: 'title', label: 'Workout', value: w.title, required: true, placeholder: 'e.g. Easy 5 km run' },
        { type: 'row', fields: [{ key: 'sport', label: 'Type', type: 'select', options: SPORTS, value: w.sport }, { key: 'eventId', label: 'Part of training for', type: 'select', options: [['', '(none)'], ...D.trainingEvents.map(e => [e.id, e.name])], value: w.eventId }] },
        { type: 'row', fields: [{ key: 'date', label: 'Date', type: 'date', value: w.date, required: true }, { key: 'time', label: 'Time', type: 'time', value: w.time }] },
        { type: 'row', fields: [{ key: 'duration', label: 'Duration (minutes)', type: 'number', value: w.duration, min: 0, step: 5 }, { key: 'distance', label: 'Distance (km)', type: 'number', value: w.distance, min: 0, step: 0.1 }] },
        { key: 'intensity', label: 'Intensity', type: 'select', options: ['Easy', 'Moderate', 'Hard', 'Race / test'], value: w.intensity },
        { key: 'remind', label: 'Remind me', type: 'remind', value: w.remind }, notesF(w.notes), { key: 'done', label: 'Done', type: 'bool', value: w.done }],
      onSave: v => upsert('workouts', id, v),
      onDelete: id && (() => { remove('workouts', id); }),
    });
  },
  event(id, pre = {}) {
    const e = id ? find('event', id) : { title: '', category: pre.category || 'Personal', date: pre.date || today(), time: '', endTime: '', repeat: pre.category === 'Birthday' ? 'yearly' : 'none', until: '', location: '', notes: '', done: false, remind: D.settings.remind.event };
    if (!id && pre.fill) Object.assign(e, pre.fill);
    const isDl = e.category === 'Deadline';
    showForm({
      title: id ? 'Edit ' + (isDl ? 'deadline' : 'event') : 'Add ' + (isDl ? 'deadline' : 'event'),
      fields: [{ key: 'title', label: 'Title', value: e.title, required: true, placeholder: isDl ? 'e.g. Uni preferences due (VTAC)' : 'e.g. Dentist' },
        { type: 'row', fields: [{ key: 'category', label: 'Category', type: 'select', options: Object.keys(CATS), value: e.category }, { key: 'location', label: 'Location', value: e.location }] },
        { key: 'date', label: isDl ? 'Due date' : 'Date', type: 'date', value: e.date, required: true },
        { type: 'row', fields: [{ key: 'time', label: isDl ? 'Due time (optional)' : 'Start time (optional)', type: 'time', value: e.time }, { key: 'endTime', label: 'End time', type: 'time', value: e.endTime }] },
        { type: 'row', fields: [{ key: 'repeat', label: 'Repeats', type: 'select', options: [['none', 'Does not repeat'], ['weekly', 'Every week'], ['fortnightly', 'Every 2 weeks'], ['monthly', 'Every month'], ['yearly', 'Every year']], value: e.repeat }, { key: 'until', label: 'Repeat until (optional)', type: 'date', value: e.until }] },
        { key: 'remind', label: 'Remind me', type: 'remind', value: e.remind }, notesF(e.notes), { key: 'done', label: 'Done (for deadlines)', type: 'bool', value: e.done }],
      onSave: v => upsert('events', id, v),
      onDelete: id && (() => { remove('events', id); }),
    });
  },
  link(id, pre = {}) {
    const l = id ? find('link', id) : { title: '', url: '', group: ['Apps', 'Study', 'Training', 'Other'].includes(pre.date) ? pre.date : 'Study', subjectId: '', notes: '' };
    showForm({
      title: id ? 'Edit link' : 'Add link',
      fields: [{ key: 'title', label: 'Name', value: l.title, required: true }, { key: 'url', label: 'Web address', value: l.url, required: true, placeholder: 'https://…' },
        { type: 'row', fields: [{ key: 'group', label: 'Show under', type: 'select', options: [['Apps', 'Quick-open bar (Today page)'], 'Study', 'Training', 'Other'], value: l.group }, { key: 'subjectId', label: 'Subject (for study links)', type: 'select', options: [['', '(none)'], ...subjOpts()], value: l.subjectId }] },
        { key: 'notes', label: 'Note', value: l.notes }],
      onSave: v => { if (!/^https?:\/\//i.test(v.url)) v.url = 'https://' + v.url; upsert('links', id, v); },
      onDelete: id && (() => { remove('links', id); }),
    });
  },
  feed(id) {
    const f = id ? find('feed', id) : { smart: true, hide: '', show: '', name: '', url: '', color: ['#5f3dc4', '#0b7285', '#a61e4d', '#495057'][D.feeds.length % 4], enabled: true };
    showForm({
      title: id ? 'Edit calendar' : 'Add a calendar link',
      fields: [{ type: 'html', html: `<p class="muted small-text" style="margin-top:0">Paste a private iCal (.ics) link. The planner checks it every 30 minutes and shows its events (read-only) in Today, Day plan and Calendar.</p>` },
        { key: 'name', label: 'Name', value: f.name, required: true, placeholder: 'e.g. Google Calendar, School' },
        ...(f.url || !id ? [{ key: 'url', label: 'iCal link', value: f.url, required: true, placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics' }] : []),
        { key: 'color', label: 'Colour', type: 'color', value: f.color }, { key: 'enabled', label: 'Show these events', type: 'bool', value: f.enabled !== false },
        { key: 'smart', label: `School filter: only show events for Year ${D.settings.yearLevel || 11}${D.settings.house ? ' / ' + D.settings.house : ''} and whole-school events`, type: 'bool', value: !!f.smart },
        { key: 'hide', label: 'Also hide events containing (comma separated)', value: f.hide || '', placeholder: 'e.g. Parent, Staff only' },
        { key: 'show', label: 'Always show events containing (overrides the filter)', value: f.show || '', placeholder: 'e.g. Athletics, Media' }],
      onSave: v => { upsert('feeds', id, v); const nf = id ? find('feed', id) : D.feeds[D.feeds.length - 1]; if (nf.url) setTimeout(() => refreshFeed(nf), 50); },
      onDelete: id && (() => { remove('feeds', id); delete D.feedCache[id]; }),
    });
  },
  deadline(id, pre = {}) { editors.event(id, { ...pre, category: 'Deadline' }); },
  todo(id, pre = {}) {
    const t = id ? find('todo', id) : { text: '', due: pre.date || '', done: false, notes: '', remind: D.settings.remind.todo };
    if (!id && pre.fill) Object.assign(t, pre.fill);
    showForm({
      title: id ? 'Edit task' : 'Add task',
      fields: [{ key: 'text', label: 'Task', value: t.text, required: true }, { key: 'due', label: 'Due date (optional)', type: 'date', value: t.due },
        { key: 'remind', label: 'Remind me (needs a due date)', type: 'remind', value: t.remind }, notesF(t.notes), { key: 'done', label: 'Done', type: 'bool', value: t.done }],
      onSave: v => upsert('todos', id, v),
      onDelete: id && (() => { remove('todos', id); }),
    });
  },
};

// ---------- plan generators ----------
const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

function planStudy(assessId) {
  const t = today();
  const upcoming = D.assessments.filter(a => a.date > t && !a.done).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) { alert('Add an upcoming SAC or exam first, then plan study sessions for it.'); return; }
  const a = assessId ? find('assessment', assessId) : upcoming[0];
  showForm({
    title: 'Plan study sessions',
    saveLabel: 'Create sessions',
    fields: [{ type: 'html', html: '<p class="muted small-text" style="margin-top:0">Spreads revision sessions from the start date up to the day before the assessment, getting more frequent as it gets closer. You can edit or delete any session afterwards.</p>' },
      { key: 'assessmentId', label: 'Prepare for', type: 'select', options: upcoming.map(x => [x.id, `${subj(x.subjectId).name}: ${x.title} (${fmtDate(x.date)})`]), value: a.id },
      { type: 'row', fields: [{ key: 'start', label: 'Start from', type: 'date', value: t, required: true }, { key: 'perWeek', label: 'Sessions per week (early on)', type: 'number', value: 3, min: 1, step: 1 }] },
      { key: 'days', label: 'Days I can study', type: 'checks', options: WEEKDAYS, value: ['1', '2', '3', '4', '5', '6', '0'] },
      { type: 'row', fields: [{ key: 'time', label: 'Usual time', type: 'time', value: '16:30' }, { key: 'duration', label: 'Session length (minutes)', type: 'number', value: 60, min: 15, step: 5 }] },
      { key: 'topics', label: 'Topics to rotate through (one per line)', type: 'textarea', value: 'Review notes & summaries\nPractice questions\nPast exam / SAC questions under timed conditions\nFix weak areas from mistakes', hint: 'The last session before the assessment is always a final review.' },
      { key: 'ramp', label: 'Study every available day in the final week', type: 'bool', value: true }],
    onSave: v => {
      const target = find('assessment', v.assessmentId);
      const days = new Set(v.days.map(Number));
      if (!days.size) { alert('Pick at least one day.'); return false; }
      const end = addDays(target.date, -1);
      if (v.start > end) { alert('The start date must be before the assessment.'); return false; }
      const topics = v.topics.split('\n').map(s => s.trim()).filter(Boolean);
      if (!topics.length) topics.push('Revision');
      const per = Math.max(1, Math.min(7, v.perWeek || 3));
      // candidate days, skipping ones that already have a session for this subject
      const cands = [];
      for (let d = v.start; d <= end; d = addDays(d, 1)) if (days.has(parseYmd(d).getDay()) && !D.sessions.some(s => s.subjectId === target.subjectId && s.date === d)) cands.push(d);
      if (!cands.length) { alert('No free days in that range.'); return false; }
      const chosen = new Set();
      const finalWeekStart = addDays(target.date, -7);
      // group the rest by 7-day blocks counting back from the assessment
      const blocks = {};
      for (const d of cands) {
        if (v.ramp && d >= finalWeekStart) { chosen.add(d); continue; }
        const b = Math.floor(diffDays(d, target.date) / 7); (blocks[b] = blocks[b] || []).push(d);
      }
      for (const [b, list] of Object.entries(blocks)) {
        const n = Math.min(list.length, b <= 1 ? per + 1 : per); // a little extra in the second-last week
        for (let i = 0; i < n; i++) chosen.add(list[Math.floor((i + 0.5) * list.length / n)]);
      }
      const sorted = [...chosen].sort();
      const created = sorted.map((d, i) => ({
        id: uid() + i, subjectId: target.subjectId, assessmentId: target.id, date: d, time: v.time, duration: v.duration || 60,
        topic: i === sorted.length - 1 ? `Final review for ${target.title}` : topics[i % topics.length], notes: '', done: false, remind: D.settings.remind.session,
      }));
      D.sessions.push(...created);
      undoToast(`Created ${created.length} study sessions for ${target.title}.`, () => { const ids = new Set(created.map(c => c.id)); D.sessions = D.sessions.filter(s => !ids.has(s.id)); });
    },
  });
}

const TEMPLATES = {
  'Running': [['Easy run', 'Easy'], ['Intervals (e.g. 6 × 400 m fast, 90 s jog)', 'Hard'], ['Tempo run', 'Moderate'], ['Long run', 'Moderate']],
  'Cycling': [['Easy spin', 'Easy'], ['Hill repeats', 'Hard'], ['Tempo ride', 'Moderate'], ['Long ride', 'Moderate']],
  'Swimming': [['Technique & drills', 'Easy'], ['Interval sets', 'Hard'], ['Steady endurance swim', 'Moderate'], ['Long continuous swim', 'Moderate']],
  'Triathlon': [['Swim: technique + intervals', 'Moderate'], ['Bike intervals', 'Hard'], ['Run: tempo', 'Moderate'], ['Brick: bike then run', 'Hard']],
  'Strength / Gym': [['Upper body strength', 'Hard'], ['Lower body strength', 'Hard'], ['Mobility & core', 'Easy'], ['Full body strength', 'Hard']],
  'Speed / Agility': [['Acceleration + agility', 'Hard'], ['Repeat sprints', 'Hard'], ['Plyometrics + change of direction', 'Hard'], ['Technique + mobility', 'Easy']],
  'Team sport': [['Skills & agility', 'Moderate'], ['Conditioning intervals', 'Hard'], ['Strength & injury prevention', 'Moderate'], ['Endurance run', 'Moderate']],
  'Hiking': [['Stairs / hill walk', 'Hard'], ['Leg & core strength', 'Moderate'], ['Easy walk', 'Easy'], ['Long hike with pack', 'Moderate']],
  'Other': [['Session A', 'Moderate'], ['Session B', 'Hard'], ['Session C', 'Easy'], ['Long session', 'Moderate']],
};
function planTraining(evId) {
  const t = today();
  const evs = D.trainingEvents.filter(e => e.date > t).sort((a, b) => a.date.localeCompare(b.date));
  if (!evs.length) { alert('Add an upcoming training event first.'); return; }
  const ev = evId ? find('tevent', evId) : evs[0];
  showForm({
    title: 'Build a training plan',
    saveLabel: 'Create plan',
    fields: [{ type: 'html', html: '<p class="muted small-text" style="margin-top:0">Builds a week-by-week plan up to the event: load increases gradually, every 4th week is lighter for recovery, and the last 1–2 weeks taper so you are fresh on the day. This is a general guide, not medical advice; listen to your body and your coach.</p>' },
      { key: 'eventId', label: 'Training for', type: 'select', options: evs.map(e => [e.id, `${e.name} (${fmtDate(e.date)})`]), value: ev.id },
      { type: 'row', fields: [{ key: 'sport', label: 'Plan type', type: 'select', options: SPORTS, value: ev.sport || 'Running' }, { key: 'start', label: 'Start from', type: 'date', value: t, required: true }] },
      { key: 'days', label: 'Training days', type: 'checks', options: WEEKDAYS, value: ['2', '4', '6', '0'], hint: 'The last training day of each week becomes the longer session.' },
      { type: 'row', fields: [{ key: 'base', label: 'Your current longest session (minutes)', type: 'number', value: 40, min: 10, step: 5 }, { key: 'time', label: 'Usual time (optional)', type: 'time', value: '' }] },
      { key: 'replace', label: 'Replace unfinished workouts from an earlier plan for this event', type: 'bool', value: true }],
    onSave: v => {
      const e = find('tevent', v.eventId);
      const days = WEEKDAYS.map(x => x[0]).filter(d => v.days.includes(String(d)));
      if (!days.length) { alert('Pick at least one training day.'); return false; }
      const end = addDays(e.date, -1);
      if (v.start > end) { alert('The start date must be before the event.'); return false; }
      let removed = [];
      if (v.replace) { removed = D.workouts.filter(w => w.eventId === e.id && !w.done && w.date >= v.start); const ids = new Set(removed.map(w => w.id)); D.workouts = D.workouts.filter(w => !ids.has(w.id)); }
      const tpl = TEMPLATES[v.sport] || TEMPLATES.Other;
      const base = Math.max(10, v.base || 40);
      // weeks counted back from the event: week 0 = event week
      const totalWeeks = Math.ceil((diffDays(v.start, e.date)) / 7);
      const factorFor = wBack => {
        if (wBack === 0) return 0.5;
        if (wBack === 1 && totalWeeks >= 4) return 0.75;
        const build = totalWeeks - 1 - wBack; // 0 = first week
        const f = Math.min(1.8, 1 + 0.08 * build);
        return (build + 1) % 4 === 0 ? f * 0.8 : f;
      };
      const created = [];
      for (let d = v.start; d <= end; d = addDays(d, 1)) {
        const dow = parseYmd(d).getDay();
        if (!days.includes(dow)) continue;
        const f = factorFor(Math.max(0, Math.ceil(diffDays(d, e.date) / 7) - 1));
        const weekNo = totalWeeks - Math.max(0, Math.ceil(diffDays(d, e.date) / 7) - 1);
        // position of this day among the chosen days of its Mon-Sun week
        const idx = days.indexOf(dow), isLast = idx === days.length - 1 && days.length > 1;
        const eventWeek = diffDays(d, e.date) <= 7;
        let [name, intensity] = isLast ? tpl[3] : tpl[idx % 3];
        let dur = isLast ? base * f : base * 0.65 * f;
        if (eventWeek) { [name, intensity] = diffDays(d, e.date) <= 2 ? ['Short easy session + a few strides / openers', 'Easy'] : [tpl[0][0], 'Easy']; dur = base * 0.45; }
        created.push({ id: uid() + created.length, title: `Wk ${weekNo}: ${name}`, sport: v.sport, eventId: e.id, date: d, time: v.time, duration: round5(Math.max(15, dur)), distance: '', intensity, notes: '', done: false, remind: D.settings.remind.workout });
      }
      D.workouts.push(...created);
      undoToast(`Created ${created.length} workouts over ${totalWeeks} week${totalWeeks === 1 ? '' : 's'} for ${e.name}.`, () => { const ids = new Set(created.map(c => c.id)); D.workouts = D.workouts.filter(w => !ids.has(w.id)).concat(removed); });
    },
  });
}

// ---------- focus timer & study log ----------
// D.focus = running timer {subjectId, sessionId, startedAt, pausedAt, pausedMs}; saved so it syncs between devices.
const focusElapsed = f => Math.max(0, ((f.pausedAt || Date.now()) - f.startedAt - (f.pausedMs || 0)) / 60000);
function startFocus(subjectId, sessionId) {
  if (D.focus && !confirm('A focus timer is already running. Stop it and log that time first?')) return;
  if (D.focus) stopFocus(true, true);
  const sess = sessionId ? find('session', sessionId) : null;
  subjectId = subjectId || sess?.subjectId;
  if (!subjectId) { focusPicker(); return; }
  D.focus = { subjectId, sessionId: sessionId || '', startedAt: Date.now(), pausedAt: 0, pausedMs: 0, planned: sess?.duration || 0 };
  save(); renderFocusBar(); openFocusFull();
  if (D.settings.focusBrainfm) openBrainfm();
}
// Brain.fm: open the desktop app when it's installed, otherwise the website.
let brainfmApp = '';
function checkBrainfm() {
  if (ONLINE) return Promise.resolve('');
  return fetch('/api/brainfm?path=' + encodeURIComponent(D.settings.brainfmPath || '')).then(r => r.json()).then(j => (brainfmApp = j.found || '')).catch(() => '');
}
function openBrainfm() {
  if (!brainfmApp) { window.open('https://my.brain.fm/', '_blank', 'noopener'); return; }
  fetch('/api/brainfm?path=' + encodeURIComponent(D.settings.brainfmPath || ''), { method: 'POST' })
    .then(r => { if (!r.ok) throw 0; toast('Opening Brain.fm…', '', { timeout: 2500 }); })
    .catch(() => { brainfmApp = ''; toast('Could not open the Brain.fm app', 'Opening the website instead.', { actions: [['Open website', () => window.open('https://my.brain.fm/', '_blank', 'noopener')]] }); });
}
function focusPicker() {
  if (!D.subjects.length) { alert('Add a subject first.'); return; }
  showForm({ title: 'Start studying', saveLabel: 'Start timer', fields: [
    { key: 'subjectId', label: 'Subject', type: 'select', options: subjOpts(), value: D.subjects[0].id },
    { key: 'brain', label: 'Open Brain.fm too', type: 'bool', value: D.settings.focusBrainfm }],
    onSave: v => { D.settings.focusBrainfm = v.brain; setTimeout(() => startFocus(v.subjectId, ''), 0); } });
}
function pauseFocus() {
  const f = D.focus; if (!f) return;
  if (f.pausedAt) { f.pausedMs += Date.now() - f.pausedAt; f.pausedAt = 0; } else f.pausedAt = Date.now();
  save(); renderFocusBar();
}
function stopFocus(log, quiet) {
  const f = D.focus; if (!f) return;
  const mins = Math.round(focusElapsed(f));
  D.focus = null; focusAskCancel = false;
  if (log && mins >= 1) {
    D.focusLogs.push({ id: uid(), subjectId: f.subjectId, species: speciesFor(f.subjectId), ...((f.distractions || 0) >= DISTRACT_LIMIT ? { withered: true } : {}), sessionId: f.sessionId, date: ymd(new Date(f.startedAt)), start: new Date(f.startedAt).toISOString(), mins });
    const sess = f.sessionId && find('session', f.sessionId);
    if (sess && !sess.done && (!quiet) && confirm(`Logged ${fmtMins(mins)} of ${subj(f.subjectId).name}. Tick off this study block?`)) sess.done = true;
    else if (!quiet) toast(mins >= 10 ? '🌳 You grew a tree!' : 'Study time logged', `${fmtMins(mins)} of ${subj(f.subjectId).name}`);
  }
  save(); renderFocusBar(); if (!modal.open) render();
}
let focusTick = null, focusAskCancel = false;
function renderFocusBar() {
  const bar = $('#focusBar'); const f = D && D.focus;
  if (D && D.game) gameFeedback();
  if (!f) { bar.hidden = true; clearInterval(focusTick); focusTick = null; document.title = 'Life Planner'; closeFocusFull(); updateMini(null); return; }
  const s = subj(f.subjectId);
  const draw = () => {
    const m = focusElapsed(f), mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
    const time = `${Math.floor(mm / 60) ? Math.floor(mm / 60) + ':' + pad(mm % 60) : mm}:${pad(ss)}`;
    const pct = Math.min(100, m / focusTarget(f, m) * 100);
    bar.innerHTML = `<i class="fprog" style="width:${pct.toFixed(1)}%"></i><span class="ftree">${treeSvg(s.color, Math.max(10, f.planned || 45), Math.min(1, m / Math.max(10, f.planned || 45)), speciesFor(f.subjectId), 40)}</span><b>${esc(s.name)}</b> <span class="ftime">${time}</span>${f.planned ? `<span class="small-text"> / ${fmtMins(f.planned)}</span>` : ''}${f.pausedAt ? ' <span class="tag amber">Paused</span>' : ''}
      <span class="spacer"></span>${focusAskCancel ? `<span class="small-text"><b>Cancel without logging?</b> No time, coins or tree.</span><button class="btn small danger" data-act="focusCancelYes">Yes, cancel it</button><button class="btn small" data-act="focusCancelNo">Keep going</button>`
        : `<button class="btn small" data-act="focusPause">${f.pausedAt ? 'Resume' : 'Pause'}</button><button class="btn small primary" data-act="focusStop">Stop &amp; log</button><button class="btn small" data-act="focusCancel" title="Stop without logging">Cancel</button><button class="btn small" data-act="focusMax" title="Big timer">⤢ Big timer</button><button class="btn small" data-act="focusMini" title="A small player you can drag anywhere">▣ Mini player</button><button class="btn small" data-act="focusPop" title="A tiny window that stays on top of other apps">⧉ Pop out</button>`}`;
    updateFocusFull();
    updateMini(f, s, m, time, pct);
    bar.style.setProperty('--c', s.color);
    document.title = `${time} · ${s.name}`;
    if (f.planned && !f.pausedAt && !f.notified && m >= f.planned) { f.notified = true; notify(`${fmtMins(f.planned)} of ${s.name} done`, 'Take a break, or keep going and stop the timer when you finish.', 'focus'); }
  };
  bar.hidden = false; draw();
  clearInterval(focusTick); focusTick = setInterval(draw, 1000);
}
// ---------- streaks (forest drawing lives in forest.js) ----------
function studyStreak() {
  const byDay = {}; for (const l of D.focusLogs) byDay[l.date] = (byDay[l.date] || 0) + l.mins;
  let n = 0, d = today(), shield = upg('shield'); // a streak shield covers one missed day
  if (!(byDay[d] >= 30)) d = addDays(d, -1); // today still counts if you study later
  for (;;) {
    if (byDay[d] >= 30) { n++; d = addDays(d, -1); }
    else if ((isHoliday(d) || isRestDay(d)) && d >= addDays(today(), -60)) d = addDays(d, -1); // holidays and rest days don't break it
    else if (shield && n && byDay[addDays(d, -1)] >= 30) { shield--; d = addDays(d, -1); }
    else break;
  }
  return n;
}
// ---------- toasts & reminders ----------
function toast(title, body, { cls = '', actions = [], timeout = 8000 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.innerHTML = `<div class="main"><div class="t">${esc(title)}</div>${body ? `<div class="b">${esc(body)}</div>` : ''}</div>`;
  for (const [label, fn] of actions) { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = () => { fn(); el.remove(); }; el.appendChild(b); }
  const x = document.createElement('button'); x.className = 'iconbtn'; x.textContent = '✕'; x.onclick = () => el.remove(); el.appendChild(x);
  $('#toasts').appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
}
function undoToast(msg, undo) { toast(msg, '', { actions: [['Undo', () => { undo(); save(); render(); }]], timeout: 12000 }); }

function beep() {
  if (!D.settings.sound) return;
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach(off => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime + off); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + off + 0.15); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + off); o.stop(ctx.currentTime + off + 0.16); });
  } catch { }
}
function notify(title, body, tag) {
  toast('⏰ ' + title, body, { cls: 'rem', timeout: 0 });
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification(title, { body, tag, icon: 'icon.svg', requireInteraction: true }); n.onclick = () => { window.focus(); n.close(); }; } catch { }
  }
}
function checkReminders() {
  const now = Date.now();
  const t = today();
  let changed = false;
  const pending = [];
  for (const e of agenda(addDays(t, -1), addDays(t, 15))) {
    if (e.done || !e.remind || !e.remind.length) continue;
    const start = parseYmd(e.date);
    if (e.time) { const [h, m] = e.time.split(':').map(Number); start.setHours(h, m); } else start.setHours(8, 0); // all-day items count as 8am
    const endMs = e.time ? start.getTime() + 2 * 3600e3 : parseYmd(addDays(e.date, 1)).getTime();
    if (now > endMs) continue;
    const due = e.remind.filter(off => now >= start.getTime() - off * 60000 && !D.fired[`${e.kind}|${e.id}|${e.date}|${off}`]);
    if (!due.length) continue;
    for (const off of due) D.fired[`${e.kind}|${e.id}|${e.date}|${off}`] = now;
    changed = true;
    const dd = diffDays(t, e.date);
    const when = e.time ? `${relDays(dd)} at ${fmtTime(e.time)}` : relDays(dd);
    const mins = Math.round((start.getTime() - now) / 60000);
    const lead = e.time && dd === 0 ? (mins > 0 ? `in ${fmtMins(mins)}` : 'now') : when;
    const label = e.kind === 'assessment' ? `${e.sub} ${e.tag}: ${e.title}` : e.title;
    pending.push([label, `${lead} · ${fmtDate(e.date)}`, `${e.kind}|${e.id}|${e.date}`]);
  }
  if (pending.length > 3) notify(`${pending.length} reminders`, pending.map(p => `• ${p[0]} (${p[1]})`).join('\n'), 'batch');
  else for (const p of pending) notify(...p);
  // forget fired reminders older than 60 days
  for (const [k, v] of Object.entries(D.fired)) if (now - v > 60 * 86400e3) { delete D.fired[k]; changed = true; }
  if (changed) save();
}
function updateNotifyBtn() {
  const b = $('#notifyBtn');
  b.hidden = ONLINE || !('Notification' in window) || Notification.permission !== 'default';
}
async function askNotify() {
  if (!('Notification' in window)) { alert('This browser does not support notifications. Reminders will still show inside the planner.'); return; }
  const p = await Notification.requestPermission();
  updateNotifyBtn();
  if (p === 'granted') toast('Reminders are on', 'You will get pop-up notifications while the planner is open.');
  else if (p === 'denied') alert('Notifications are blocked. Click the icon to the left of the address bar to allow them. Reminders will still appear inside the planner.');
  if (view === 'settings') render();
}

// ---------- Google Calendar (online version) ----------
let GCAL = []; // [{id, name, color, smart, items:[{t,d,s,e,l}]}], not saved
const GCOLORS = ['#5f3dc4', '#0b7285', '#a61e4d', '#495057', '#2b8a3e'];
function gEventItem(ev) {
  if (ev.status === 'cancelled') return null;
  const st = ev.start || {}, en = ev.end || {};
  if (st.date) return { t: ev.summary || '(no title)', d: st.date, l: ev.location || '' };
  if (!st.dateTime) return null;
  const a = new Date(st.dateTime), b = en.dateTime ? new Date(en.dateTime) : null;
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { t: ev.summary || '(no title)', d: ymd(a), s: hm(a), e: b && ymd(b) === ymd(a) ? hm(b) : '', l: ev.location || '' };
}
async function loadGoogle(fresh) {
  if (!ONLINE) return;
  const g = D.settings.gcal = D.settings.gcal || { ids: ['primary'], names: { primary: 'Google Calendar' }, smart: {} };
  const from = parseYmd(addDays(today(), -7)), to = parseYmd(addDays(today(), 60));
  const res = [];
  for (const [i, id] of g.ids.entries()) {
    try {
      const evs = await OL.listEvents(id, from, to, fresh);
      res.push({ id, name: g.names[id] || 'Calendar', color: GCOLORS[i % GCOLORS.length], smart: !!g.smart[id], items: evs.map(gEventItem).filter(Boolean) });
    } catch (e) { g.error = (e && (e.message || e.code)) || 'Could not load'; }
  }
  GCAL = res;
  if (!modal.open) render();
}
async function chooseCalendars() {
  let cals;
  try { cals = await OL.listCalendars(); } catch (e) { alert('Could not load your Google calendars: ' + (e.message || e.code || e)); return; }
  const g = D.settings.gcal = D.settings.gcal || { ids: ['primary'], names: {}, smart: {} };
  const key = c => (c.primary ? 'primary' : c.id);
  showForm({
    title: 'Google calendars to show',
    fields: [{ type: 'html', html: '<p class="muted small-text" style="margin-top:0">Tip: to see your school (Outlook) or Garmin calendar here too, add its iCal link in Google Calendar under <i>Other calendars → + → From URL</i>, then tick it below.</p>' },
      { key: 'ids', label: 'Show', type: 'checks', options: cals.map(c => [key(c), c.name + (c.primary ? ' (main)' : '')]), value: g.ids },
      { key: 'smart', label: 'Apply the school filter (Year ' + (D.settings.yearLevel || 11) + ' / ' + (D.settings.house || 'house') + ' only) to', type: 'checks', options: cals.map(c => [key(c), c.name]), value: Object.keys(g.smart).filter(k => g.smart[k]) }],
    onSave: v => {
      g.ids = v.ids; g.names = Object.fromEntries(cals.map(c => [key(c), c.name])); g.smart = Object.fromEntries(v.smart.map(k => [k, true]));
      setTimeout(() => loadGoogle(true), 50);
    },
  });
}

// ---------- calendar feeds (.ics) ----------
// School calendar filter: hide events for other year levels and other houses.
const HOUSES = () => words(D.settings.houses || ''); // your school's other houses, typed in Settings
const JUNIOR_WORDS = ['junior school', 'junior years', 'elc', 'early learning', 'prep', 'kinder', 'middle school'];
const words = s => (s || '').split(/[\n,]/).map(w => w.trim().toLowerCase()).filter(Boolean);
const hasWord = (text, w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])', 'i').test(text);
function yearLevels(text) {
  const out = new Set();
  const re = /\b(?:years?|yrs?|y)\s*((?:\d{1,2}(?:\s*(?:-|–|to|,|&|\/|and)\s*)?)+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const part = m[1];
    const nums = (part.match(/\d{1,2}/g) || []).map(Number);
    if (/\d\s*(-|–|to)\s*\d/.test(part) && nums.length === 2) { for (let n = nums[0]; n <= nums[1]; n++) out.add(n); }
    else nums.forEach(n => out.add(n));
  }
  return [...out].filter(n => n >= 1 && n <= 12);
}
function feedKeeps(f, x) {
  const text = `${x.t} ${x.l || ''}`.toLowerCase();
  if (words(f.show).some(w => hasWord(text, w))) return true;
  if (words(f.hide).some(w => hasWord(text, w))) return false;
  if (!f.smart) return true;
  const year = Number(D.settings.yearLevel) || 11, house = (D.settings.house || '').toLowerCase();
  if (house && hasWord(text, house)) return true;
  const ys = yearLevels(text);
  if (ys.length && !ys.includes(year)) return false;
  if (HOUSES().some(h => h.toLowerCase() !== house && hasWord(text, h.toLowerCase()))) return false;
  if (!ys.length && JUNIOR_WORDS.some(w => hasWord(text, w))) return false;
  return true;
}

function parseIcs(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const evs = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const ci = line.indexOf(':'); if (ci < 0) continue;
    const [name, ...params] = line.slice(0, ci).split(';');
    const val = line.slice(ci + 1);
    const key = name.toUpperCase();
    if (key === 'EXDATE') (cur.EXDATE = cur.EXDATE || []).push(...val.split(','));
    else cur[key] = { val, params: params.join(';').toUpperCase() };
  }
  const unesc = v => (v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  const toLocal = v => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || ''); if (!m) return null;
    if (!m[4]) return { d: new Date(+m[1], m[2] - 1, +m[3]), allDay: true };
    const d = m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    return { d, allDay: false };
  };
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const from = parseYmd(addDays(today(), -90)), to = parseYmd(addDays(today(), 400));
  const overrides = new Set();
  for (const e of evs) if (e['RECURRENCE-ID'] && e.UID) { const r = toLocal(e['RECURRENCE-ID'].val); if (r) overrides.add(e.UID.val + '|' + ymd(r.d)); }
  const out = [];
  for (const e of evs) {
    if (!e.DTSTART || (e.STATUS && e.STATUS.val.toUpperCase() === 'CANCELLED')) continue;
    const st = toLocal(e.DTSTART.val); if (!st) continue;
    const en = e.DTEND ? toLocal(e.DTEND.val) : null;
    const durMs = en ? en.d - st.d : 0;
    const base = { t: unesc(e.SUMMARY?.val) || '(no title)', l: unesc(e.LOCATION?.val) };
    const exd = new Set((e.EXDATE || []).map(v => { const r = toLocal(v); return r ? ymd(r.d) : ''; }));
    const isOverride = !!e['RECURRENCE-ID'];
    const push = d => {
      const k = ymd(d);
      if (exd.has(k) || (!isOverride && e.UID && e.RRULE && overrides.has(e.UID.val + '|' + k))) return;
      if (d < from || d > to) return;
      const item = { ...base, d: k };
      if (!st.allDay) { item.s = hm(d); if (durMs > 0) { const ed = new Date(d.getTime() + durMs); if (ymd(ed) === k) item.e = hm(ed); } }
      out.push(item);
      // multi-day all-day events: show on each day (up to 2 weeks)
      if (st.allDay && durMs > 86400e3) for (let i = 1; i < Math.min(14, Math.round(durMs / 86400e3)); i++) { const nd = new Date(d); nd.setDate(nd.getDate() + i); out.push({ ...base, d: ymd(nd) }); }
    };
    if (!e.RRULE || isOverride) { push(st.d); continue; }
    const r = Object.fromEntries(e.RRULE.val.split(';').map(p => p.split('=')));
    const interval = Math.max(1, +r.INTERVAL || 1), count = +r.COUNT || Infinity;
    const until = r.UNTIL ? toLocal(r.UNTIL).d : to;
    const end = until < to ? until : to;
    const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byday = (r.BYDAY || '').split(',').filter(Boolean).map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: DAYS[m[2]] } : null; }).filter(Boolean);
    let n = 0;
    const emit = d => { if (d < st.d || d > end || n >= count) return false; n++; push(d); return true; };
    const at = (y, mo, day) => { const d = new Date(st.d); d.setFullYear(y, mo, day); return d; };
    if (r.FREQ === 'DAILY') {
      for (let i = 0, d = new Date(st.d); d <= end && n < count && i < 5000; i++, d = new Date(d.getTime()), d.setDate(d.getDate() + interval)) emit(d);
    } else if (r.FREQ === 'WEEKLY') {
      const wds = byday.length ? byday.map(b => b.wd) : [st.d.getDay()];
      const wk0 = new Date(st.d); wk0.setDate(wk0.getDate() - ((wk0.getDay() + 6) % 7));
      for (let w = 0; w < 1500 && n < count; w += interval) {
        const ws = new Date(wk0); ws.setDate(ws.getDate() + w * 7);
        if (ws > end) break;
        for (const wd of [...wds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) { const d = new Date(ws); d.setDate(d.getDate() + ((wd + 6) % 7)); if (d >= st.d) emit(d); }
      }
    } else if (r.FREQ === 'MONTHLY' || r.FREQ === 'YEARLY') {
      const step = r.FREQ === 'MONTHLY' ? interval : 12 * interval;
      for (let i = 0; i < 1200 && n < count; i += step) {
        const y = st.d.getFullYear() + Math.floor((st.d.getMonth() + i) / 12), mo = (st.d.getMonth() + i) % 12;
        if (new Date(y, mo, 1) > end) break;
        if (byday.length && byday[0].n) { // e.g. 2TU = second Tuesday, -1FR = last Friday
          const { n: nth, wd } = byday[0];
          let d;
          if (nth > 0) { d = at(y, mo, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (nth - 1) * 7); }
          else { d = at(y, mo + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7) + (nth + 1) * 7); }
          if (d.getMonth() === mo) emit(d);
        } else {
          const day = st.d.getDate();
          if (day <= new Date(y, mo + 1, 0).getDate()) emit(at(y, mo, day));
        }
      }
    } else push(st.d);
    if (out.length > 20000) break;
  }
  return out;
}
async function refreshFeed(f) {
  try {
    const r = await fetch('/api/feed?url=' + encodeURIComponent(f.url), { cache: 'no-store' });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt.trim() || r.statusText);
    D.feedCache[f.id] = { fetched: Date.now(), items: parseIcs(txt) };
  } catch (e) {
    D.feedCache[f.id] = { ...(D.feedCache[f.id] || {}), error: String(e.message || e).slice(0, 200) };
  }
  save();
  if (!modal.open) render();
}
async function refreshFeeds(force) {
  for (const f of D.feeds) {
    if (!f.url || f.enabled === false) continue;
    const c = D.feedCache[f.id];
    if (force || !c || !c.fetched || Date.now() - c.fetched > 25 * 60000 || c.error) await refreshFeed(f);
  }
}

// ---------- updates ----------
let appVersion = '';
let autoUpdateTimer = 0, autoUpdateSkip = false;
async function checkUpdate() {
  try {
    const u = await (await fetch('/api/update', { cache: 'no-store' })).json();
    appVersion = u.version;
    const bar = $('#updateBar');
    bar.hidden = !u.available;
    if (u.available && !autoUpdateTimer) bar.innerHTML = `A new version of Life Planner is ready. <button class="btn small" data-act="applyUpdate">Update now</button> <span class="small-text">Your data stays as it is.</span>`;
    // install by itself when nothing is in progress
    if (u.available && D.settings.autoUpdate !== false && !D.focus && !autoUpdateSkip && !autoUpdateTimer) {
      bar.innerHTML = `Installing the new version of Life Planner in 15 seconds… <button class="btn small" data-act="applyUpdate">Now</button> <button class="btn small ghost" data-act="skipUpdate">Not now</button>`;
      autoUpdateTimer = setTimeout(() => { autoUpdateTimer = 0; if (!D.focus && !autoUpdateSkip) applyUpdate(); else checkUpdate(); }, 15000);
    }
    const v = $('#verText'); if (v) v.textContent = 'Version ' + u.version;
  } catch { }
}
async function applyUpdate() {
  const bar = $('#updateBar');
  bar.textContent = 'Updating… the planner will reload in a few seconds.';
  await flush();
  try { const r = await fetch('/api/update', { method: 'POST' }); if (!r.ok) throw new Error(await r.text()); }
  catch (e) { bar.textContent = 'Update failed: ' + (e.message || e); return; }
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch('/api/ping', { cache: 'no-store' }); if (r.ok) { location.reload(); return; } } catch { }
    await new Promise(r => setTimeout(r, 750));
  }
  bar.textContent = 'The update was installed. Double-click LifePlanner.exe to open the planner again.';
}

// ---------- starter plan ----------
async function loadStarter(quiet) {
  try {
    const seed = await (await fetch('/api/seed', { cache: 'no-store' })).json();
    let added = 0;
    // on an empty planner, drop the untouched example subjects in favour of the real ones
    if (quiet) D.subjects = D.subjects.filter(x => !['English', 'Mathematical Methods', 'Chemistry', 'Psychology', 'Physical Education'].includes(x.name));
    for (const k of ['subjects', 'assessments', 'sessions', 'trainingEvents', 'workouts', 'events', 'todos', 'links']) {
      const have = new Set(D[k].map(x => x.id));
      // don't duplicate subjects/links that already exist by name
      const names = new Set(D[k].map(x => (x.name || x.title || '').toLowerCase()));
      for (const x of seed[k] || []) {
        if (have.has(x.id)) continue;
        if ((k === 'subjects' || k === 'links') && names.has((x.name || x.title || '').toLowerCase())) continue;
        D[k].push(x); added++;
      }
    }
    // point seeded items at subjects that already existed with the same name
    const byName = Object.fromEntries(D.subjects.map(s => [s.name.toLowerCase(), s.id]));
    const seedSub = Object.fromEntries((seed.subjects || []).map(s => [s.id, s.name.toLowerCase()]));
    for (const k of ['assessments', 'sessions', 'links']) for (const x of D[k]) if (x.subjectId && seedSub[x.subjectId] && !D.subjects.some(s => s.id === x.subjectId)) x.subjectId = byName[seedSub[x.subjectId]] || x.subjectId;
    if (!D.settings.name && seed.settings?.name) D.settings.name = seed.settings.name;
    save();
    if (!quiet) { render(); toast('Starter plan loaded', `${added} items added.`); }
    return added > 0;
  } catch { if (!quiet) alert('Could not load the starter plan.'); return false; }
}
async function checkTempFolder() {
  try {
    const { dataDir } = await (await fetch('/api/info')).json();
    if (/\\temp\\|\.zip/i.test(dataDir)) {
      const b = $('#offline'); b.hidden = false;
      b.innerHTML = 'You are running the planner from inside the zip, so nothing will be saved. Close this, right-click the zip, choose <b>Extract All</b>, then open LifePlanner.exe from the extracted folder.';
    }
  } catch { }
}

// ---------- export / import ----------
function download(name, text, type) {
  if (ONLINE) { OL.download(name, text, type); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m); }
function exportIcs() {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Planner//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dt = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
  const addMin = (d, t, m) => { const x = parseYmd(d); const [h, mi] = t.split(':').map(Number); x.setHours(h, mi + m); return [ymd(x), `${pad(x.getHours())}:${pad(x.getMinutes())}`]; };
  const ev = (uidv, title, d, t, mins, desc, remind, rrule) => {
    L.push('BEGIN:VEVENT', `UID:${uidv}@lifeplanner`, `DTSTAMP:${stamp}`, `SUMMARY:${icsEscape(title)}`);
    if (t) { L.push(`DTSTART:${dt(d, t)}`); const [ed, et] = addMin(d, t, mins || 60); L.push(`DTEND:${dt(ed, et)}`); }
    else { L.push(`DTSTART;VALUE=DATE:${dt(d)}`, `DTEND;VALUE=DATE:${dt(addDays(d, 1))}`); }
    if (rrule) L.push(rrule);
    if (desc) L.push(`DESCRIPTION:${icsEscape(desc)}`);
    for (const off of remind || []) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, `TRIGGER:-PT${off}M`, 'END:VALARM');
    L.push('END:VEVENT');
  };
  for (const a of D.assessments) ev(a.id, `${subj(a.subjectId).name} ${a.type}: ${a.title}`, a.date, a.time, 120, a.notes, a.done ? [] : a.remind);
  for (const s of D.sessions) ev(s.id, `Study ${subj(s.subjectId).name}${s.topic ? ': ' + s.topic : ''}`, s.date, s.time, s.duration, s.notes, s.done ? [] : s.remind);
  for (const e of D.trainingEvents) ev(e.id, e.name, e.date, e.time, 120, [e.goal && 'Goal: ' + e.goal, e.notes].filter(Boolean).join('\n'), e.remind);
  for (const w of D.workouts) ev(w.id, w.title, w.date, w.time, w.duration, w.notes, w.done ? [] : w.remind);
  for (const e of D.events) {
    const freq = { weekly: 'FREQ=WEEKLY', fortnightly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[e.repeat];
    const mins = e.time && e.endTime ? Math.max(15, (Number(e.endTime.slice(0, 2)) * 60 + Number(e.endTime.slice(3))) - (Number(e.time.slice(0, 2)) * 60 + Number(e.time.slice(3)))) : 60;
    ev(e.id, (e.category === 'Deadline' ? 'DUE: ' : '') + e.title, e.date, e.time, mins, e.notes, e.done ? [] : e.remind, freq ? `RRULE:${freq}${e.until ? ';UNTIL=' + dt(e.until) : ''}` : '');
  }
  for (const t of D.todos) if (t.due && !t.done) ev(t.id, 'Task: ' + t.text, t.due, '', 0, t.notes, t.remind);
  L.push('END:VCALENDAR');
  download('life-planner.ics', L.join('\r\n'), 'text/calendar');
}

// ---------- events ----------
document.addEventListener('click', e => {
  const tab = e.target.closest('#tabs button');
  if (tab) { view = tab.dataset.view; window.scrollTo(0, 0); render(); return; }
  const bf = e.target.closest('a[href*="brain.fm"]');
  if (bf && brainfmApp) { e.preventDefault(); openBrainfm(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  const { act, kind, id, date } = el.dataset;
  switch (act) {
    case 'edit': editors[kind](id); break;
    case 'new': editors[kind](null, { date }); break;
    case 'moveToday': { const x = find(kind, id); if (kind === 'todo') x.due = today(); else x.date = today(); save(); render(); break; }
    case 'calDay': ui.daySel = el.dataset.v; view = 'today'; window.scrollTo(0, 0); render(); break;
    case 'goto': view = el.dataset.v; window.scrollTo(0, 0); render(); break;
    case 'dismissWelcome': D.settings.welcomed = true; save(); render(); break;
    case 'calNav': { const n = +el.dataset.n; if (n === 0) { const d = new Date(); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); ui.calSel = today(); } else ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + n, 1); render(); break; }
    case 'calSel': ui.calSel = date; render(); document.getElementById('calDay')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'daySel': ui.daySel = date; render(); break;
    case 'studyDay': ui.studyDay = date; render(); break;
    case 'inboxSort': ui.inboxSort = el.dataset.v; render(); break;
    case 'trainWeek': ui.trainWeek = el.dataset.v === '0' ? 0 : (ui.trainWeek || 0) + Number(el.dataset.v); render(); break;
    case 'evCat': ui.evCat = el.dataset.v; render(); break;
    case 'inboxCat': ui.inboxCat = el.dataset.v; render(); break;
    case 'setTab': ui.setTab = el.dataset.v; render(); break;
    case 'dayNav': { const n = +el.dataset.n; ui.daySel = n === 0 ? today() : addDays(ui.daySel || today(), n); render(); break; }
    case 'calFilter': ui.calFilter[el.dataset.g] = !ui.calFilter[el.dataset.g]; render(); break;
    case 'assessPast': ui.assessPast = el.dataset.v === '1'; render(); break;
    case 'studyAll': ui.studyAll = el.dataset.v === '1'; render(); break;
    case 'studyWeek': ui.studyWeek = el.dataset.v === '0' ? 0 : ui.studyWeek + Number(el.dataset.v); render(); break;
    case 'claudeTokenSave': case 'claudeTokenClear': {
      const token = act === 'claudeTokenClear' ? '' : ($('#claudeToken')?.value || '').trim();
      if (act === 'claudeTokenSave' && !token) { toast('Paste the token first', ''); break; }
      fetch('/api/claudelink', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Couldn't save"); claudeLinked = !!j.configured; render(); toast(claudeLinked ? '✓ Instant email check is on' : 'Instant email check is off', ''); })
        .catch(e => toast("Couldn't save the token", e.message, { cls: 'danger' }));
      break;
    }
    case 'brainfmTest': checkBrainfm().then(() => { render(); openBrainfm(); }); break;
    case 'forestPage': ui.forestPage = el.dataset.v; render(); break;
    case 'claim': claimChallenge(id); break;
    case 'treeInfo': openTreeCard(id); break;
    case 'treePick': openTreePicker(id); break;
    case 'setupOpen': openSetup(false); break;
    case 'tourStart': startTour(); break;
    case 'goSchool': view = 'school'; render(); break;
    case 'icuSync': icuSync(); break;
    case 'icuKeys': icuSaveKeys(); break;
    case 'icuOff': icuDisconnect(); break;
    case 'stravaSync': stravaSync(false); break;
    case 'stravaKeys': stravaSaveKeys(); break;
    case 'stravaOff': stravaDisconnect(); break;
    case 'boardKind': ui.boardKind = el.dataset.v; render(); break;
    case 'boardSort': ui.boardSort = { ...(ui.boardSort || {}), [ui.boardKind || 'study']: el.dataset.v }; render(); break;
    case 'buyItem': buyItem(id); break;
    case 'boostToggle': ui.boost = ui.boost || {}; ui.boost[id] = el.checked; break;
    case 'setLook': setLook(el.dataset.k, el.dataset.v); break;
    case 'wardCat': ui.wardCat = el.dataset.v; render(); break;
    case 'wearCos': wearCos(id); break;
    case 'buyCos': buyCos(id); break;
    case 'avDance': { const st = document.querySelector('#wardStage .avatar'); if (st) { const d = myAv().dance; st.parentNode.classList.remove('dance-' + d); void st.parentNode.offsetWidth; st.parentNode.classList.add('dance-' + d); setTimeout(() => st.parentNode.classList.remove('dance-' + d), 2200); } break; }
    case 'arenaPage': ui.arenaPage = el.dataset.v; render(); break;
    case 'bodyPage': view = 'training'; ui.bodyPage = el.dataset.v; render(); break;
    case 'friendCompare': compareFriend(el.dataset.id); break;
    case 'friendsLogin': view = 'settings'; ui.setTab = 'account'; render(); break;
    case 'claimQuest': claimQuest(id); break;
    case 'fight': startBattle(id); break;
    case 'arenaSel': ui.arenaSel = el.dataset.v; render(); break;
    case 'moveUnlock': moveUnlock(id); break;
    case 'moveUpgrade': moveUpgrade(id); break;
    case 'moveEquip': moveEquip(id); break;
    case 'fightMode': startBattle(null, el.dataset.v); break;
    case 'addPb': addPb(id); break;
    case 'delPb': if (confirm('Delete this result?')) { D.arena.pbs = D.arena.pbs.filter(p => p.id !== id); save(); render(); } break;
    case 'buyGear': buyGear(id); break;
    case 'equip': { const g = GEAR.find(x => x.id === id); if (g && ownsGear(id)) { D.arena.equip[g.slot] = id; save(); render(); } break; }
    case 'holAdd': addHoliday(); break;
    case 'bedOn': D.settings.bedtime = { ...bedCfg(), on: el.checked }; save(); break;
    case 'bedDay': { const b = bedCfg(), v = +el.dataset.v; D.settings.bedtime = { ...b, days: b.days.includes(v) ? b.days.filter(x => x !== v) : [...b.days, v] }; save(); render(); break; }
    case 'holDel': D.settings.holidays = holidays().filter(h => h.id !== id); save(); render(); break;
    case 'goSettingsApp': view = 'settings'; ui.setTab = 'app'; render(); break;
    case 'treeSubj': ui.treeSubj = el.dataset.v; render(); break;
    case 'treeSort': ui.treeSort = el.dataset.v; render(); break;
    case 'buyUpg': buyUpgrade(id); break;
    case 'storeCat': ui.storeCat = el.dataset.v; render(); break;
    case 'storeBuy': storeBuy(id); break;
    case 'gift': claimGift(); break;
    case 'milestone': claimMilestone(id); break;
    case 'openBox': openBox(id); break;
    case 'setScene': D.game.scene = el.dataset.v; save(); render(); break;
    case 'forestRange': ui.forestRange = el.dataset.v; render(); break;
    case 'setTheme': D.settings.theme = el.dataset.v; save(); render(); break;
    case 'setThemeMode': D.settings.themeMode = el.dataset.v; save(); render(); break;
    case 'navMove': navMove(el.dataset.v, +el.dataset.n); save(); render(); break;
    case 'navReset': D.settings.navOrder = []; D.settings.navHidden = []; save(); render(); break;
    case 'setThemeBg': D.settings.themeBg = el.dataset.v; save(); render(); break;
    case 'forestView': D.settings.forestView = el.dataset.v; save(); render(); break;
    case 'evFilter': ui.evFilter = el.dataset.v; render(); break;
    case 'planStudy': planStudy(id); break;
    case 'planTraining': planTraining(id); break;
    case 'clearDone': if (confirm('Remove all completed tasks?')) { D.todos = D.todos.filter(x => !x.done); save(); render(); } break;
    case 'askNotify': askNotify(); break;
    case 'testNotify': notify('Test reminder', 'This is what a reminder looks like.', 'test'); break;
    case 'exportJson': download(`life-planner-backup-${today()}.json`, JSON.stringify(D, null, 2), 'application/json'); break;
    case 'exportIcs': exportIcs(); break;
    case 'refreshFeeds': refreshFeeds(true); break;
    case 'gcalChoose': chooseCalendars(); break;
    case 'gcalRefresh': loadGoogle(true); break;
    case 'focus': startFocus(el.dataset.subject, el.dataset.id); break;
    case 'focusPause': pauseFocus(); break;
    case 'focusMin': closeFocusFull(); break;
    case 'focusMax': openFocusFull(); break;
    case 'brainfmOpen': openBrainfm(); break;
    case 'focusStop': stopFocus(true); break;
    case 'focusMini': D.settings.focusMini = true; save(); renderFocusBar(); break;
    case 'focusPop': popOutMini(); break;
    case 'focusCancel': focusAskCancel = true; renderFocusBar(); break;
    case 'focusCancelNo': focusAskCancel = false; renderFocusBar(); break;
    case 'focusCancelYes': focusAskCancel = false; stopFocus(false); toast('Study session cancelled', 'Nothing was logged.', { timeout: 3500 }); break;
    case 'focusNew': focusPicker(); break;
    case 'delLog': if (confirm('Delete this logged study time?')) { D.focusLogs = D.focusLogs.filter(l => l.id !== id); save(); render(); } break;
    case 'applyUpdate': clearTimeout(autoUpdateTimer); autoUpdateTimer = 0; applyUpdate(); break;
    case 'skipUpdate': clearTimeout(autoUpdateTimer); autoUpdateTimer = 0; autoUpdateSkip = true; checkUpdate(); break;
    case 'loadStarter': if (confirm('Add your exams, SACs, study blocks, training and tasks from the starter plan? Anything already there stays; nothing is duplicated.')) loadStarter(false); break;
    case 'inboxDismiss': inboxDismiss(id); break;
    case 'inboxCheck': inboxCheckNow(); break;
    case 'inboxRead': for (const x of D.inbox?.items || []) if (!D.inboxSeen[x.id]) D.inboxSeen[x.id] = 'read'; save(); render(); break;
    case 'inboxTask': { const x = D.inbox.items.find(i => i.id === id); D.inboxAdded = D.inboxAdded || {}; D.inboxAdded[id] = 't'; D.todos.push({ id: uid(), text: x.subject + (x.from ? ' (' + x.from + ')' : ''), due: x.due, done: false, notes: x.summary || '', remind: D.settings.remind.todo }); D.inboxSeen[id] = D.inboxSeen[id] || 'read'; save(); render(); toast('Added to tasks', x.subject); break; }
    case 'quit': if (confirm('Quit the planner? Your data is saved.')) { flush().finally(() => fetch('/api/quit', { method: 'POST' }).catch(() => { }).finally(() => { document.body.innerHTML = '<main><h1>Planner closed</h1><p>You can close this tab. Double-click LifePlanner.exe to open it again.</p></main>'; })); } break;
    case 'reset': if (prompt('This deletes ALL your planner data. Type DELETE to confirm.') === 'DELETE') { D = migrate(freshData()); save(); render(); openSetup(true); } break;
  }
});
$('#notifyBtn').addEventListener('click', askNotify);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.shortcut) {
    fetch('/api/shortcuts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ where: el.dataset.shortcut, on: el.checked }) })
      .then(async r => { if (!r.ok) throw new Error(await r.text()); toast(el.checked ? 'Shortcut added' : 'Shortcut removed', ''); })
      .catch(e => { alert('Could not change the shortcut: ' + (e.message || e)); }).finally(loadShortcuts);
    return;
  }
  if (el.dataset.toggle) { toggleDone(el.dataset.toggle, el.dataset.id, el.checked); return; }
  if (el.dataset.setting) { D.settings[el.dataset.setting] = el.type === 'checkbox' ? el.checked : el.value.trim().replace(/^"|"$/g, ''); save(); if (el.dataset.setting === 'inboxAuto' && el.checked && inboxToPlanner()) { save(); render(); } if (el.dataset.setting === 'brainfmPath') checkBrainfm().then(render); return; }
  if (el.dataset.remdef) { const k = el.dataset.remdef; D.settings.remind[k] = [...document.querySelectorAll(`[data-remdef="${k}"]`)].filter(x => x.checked).map(x => Number(x.value)).sort((a, b) => b - a); save(); return; }
  if (el.dataset.change === 'lookColor') { setLook(el.dataset.k, el.value); return; }
  if (el.dataset.change === 'evCat') { ui.evCat = el.value; render(); }
  if (el.dataset.change === 'showItem') { D.game.hidden[el.dataset.id] = !el.checked; save(); }
  if (el.dataset.change === 'bedTime' && el.value) { D.settings.bedtime = { ...bedCfg(), time: el.value }; save(); }
  if (el.dataset.change === 'treeSpecies') { D.settings.treeFor = { ...(D.settings.treeFor || {}), [el.dataset.id]: el.value }; save(); render(); }
  if (el.dataset.change === 'dayPick' && el.value) { ui.daySel = el.value; render(); }
  if (el.dataset.change === 'navShow') { const h = new Set(D.settings.navHidden || []); el.checked ? h.delete(el.dataset.v) : h.add(el.dataset.v); D.settings.navHidden = [...h]; save(); render(); }
  if (el.dataset.change === 'themeGlass') { D.settings.themeGlass = el.checked; save(); render(); }
  if (el.dataset.change === 'importInbox' && el.files[0]) el.files[0].text().then(txt => { try { const d = JSON.parse(txt); if (!Array.isArray(d.items)) throw 0; D.inbox = d; save(); render(); } catch { alert("That isn't a Missed info summary file."); } });
  if (el.dataset.change === 'importIcs' && el.files[0]) {
    const file = el.files[0];
    file.text().then(txt => {
      if (!txt.includes('BEGIN:VCALENDAR')) { alert("That isn't a calendar (.ics) file."); return; }
      const f = { id: uid(), name: file.name.replace(/\.ics$/i, ''), url: '', color: '#5f3dc4', enabled: true };
      D.feeds.push(f);
      D.feedCache[f.id] = { fetched: Date.now(), items: parseIcs(txt) };
      save(); render(); toast('Calendar imported', `${D.feedCache[f.id].items.length} events from ${file.name}`);
    });
  }
  if (el.dataset.change === 'showDoneTodos') { ui.showDoneTodos = el.checked; render(); }
  if (el.dataset.change === 'importJson' && el.files[0]) {
    el.files[0].text().then(txt => {
      let d; try { d = JSON.parse(txt); } catch { alert('That file is not valid JSON.'); return; }
      if (!d || !Array.isArray(d.subjects)) { alert("That doesn't look like a Life Planner backup."); return; }
      if (!confirm('Replace ALL current planner data with this backup?')) return;
      D = migrate(d); save(); render(); toast('Backup imported', '');
    });
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="quickTodo"]'); if (!f) return;
  e.preventDefault();
  const text = f.text.value.trim(); if (!text) return;
  D.todos.push({ id: uid(), text, due: f.due.value, done: false, notes: '', remind: f.due.value ? D.settings.remind.todo : [] });
  save(); render();
  const again = $('[data-form="quickTodo"] input[name=text]'); if (again) again.focus();
});
document.addEventListener('keydown', e => {
  if (modal.open || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const keys = { '1': 'today', '2': 'calendar', '3': 'study', '4': 'training', '5': 'arena', '6': 'friends', '7': 'personal', '8': 'inbox', '9': 'settings' };
  if (keys[e.key]) { view = keys[e.key]; render(); }
});
window.addEventListener('beforeunload', e => { if (dirty) { flush(); e.preventDefault(); } });

// ---------- start ----------
async function initOnline() {
  $('#saveState').textContent = 'Loading…';
  try {
    const d = await OL.load();
    D = migrate(d || defaultData());
    if (!d) save();
    $('#saveState').textContent = 'Saved online';
  } catch (e) {
    D = defaultData();
    $('#view').innerHTML = `<div class="card"><h2>Can't open your planner</h2><p>${esc(e.message || 'Sign in to claude.ai and reload this page.')}</p></div>`;
    return;
  }
  render();
  renderFocusBar();
  OL.subscribe(remote => { if (dirty || saving) return; const keepFired = D.fired; D = migrate(remote); D.fired = keepFired; if (!modal.open) render(); renderFocusBar(); });
  OL.watchInbox(applyInbox);
  loadGoogle(false);
  setInterval(() => loadGoogle(false), 30 * 60000);
  checkReminders();
  setInterval(checkReminders, 30000);
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); if (!modal.open) render(); } }, 60000);
}
(async function init() {
  if (ONLINE) return initOnline();
  try {
    bootId = (await (await fetch('/api/info', { cache: 'no-store' })).json()).boot || '';
    const r = await fetch('/api/data', { cache: 'no-store' });
    const d = await r.json();
    D = migrate(d || freshData());
    if (!d) save();
  } catch (e) {
    D = defaultData(); setOffline(true);
  }
  render();
  // new or empty planner: run the setup (and the tour after it)
  if (!D.settings.setupDone && !D.assessments.length && !D.sessions.length && !D.workouts.length) {
    const seed = await fetch('/api/seed', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    openSetup(true); wiz.seed = !!(seed && seed.subjects); drawSetup();
  }
  renderFocusBar();
  checkBrainfm().then(() => { if (view === 'settings' && !modal.open) render(); });
  checkTempFolder();
  checkClaudeLink();
  loadAccount().then(a => { if (a.signedIn) { publishMe(true); refreshFriends(true); } if (view === 'settings' && !modal.open) render(); });
  checkUpdate();
  setInterval(checkUpdate, 5 * 60000);
  checkReminders();
  setInterval(checkReminders, 30000);
  setInterval(ping, 20000);
  refreshFeeds(false);
  if (inboxToPlanner()) { save(); render(); }
  syncInboxDismissed();
  loadInbox();
  setInterval(loadInbox, 60000);
  setInterval(() => refreshFeeds(false), 30 * 60000);
  // re-render at midnight-ish so "today" stays right
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); if (!modal.open) render(); } }, 60000);
})();
