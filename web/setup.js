'use strict';
/* Setup: a first-run wizard so someone else can use the planner with their own
   name, classes, bell times and training week. It also re-runs from Settings
   to change those things without touching anything else. */

const WIZ_ALL = [['you', 'You'], ['account', 'Account'], ['classes', 'Classes'], ['calendar', 'Calendar'], ['school', 'School day'], ['tt', 'Timetable'], ['train', 'Training'], ['habits', 'Habits']];
// the account step is only there when accounts are switched on
const wizKeys = () => WIZ_ALL.filter(([k]) => k !== 'account' || !ONLINE).map(([k]) => k);
const wizStepOf = k => Math.max(0, wizKeys().indexOf(k));
// for a 2-week timetable we ask which week it is, and anchor Day 1 to a Monday so the days can't slip
const wizWeekStart = () => { let d = mondayOf(today()); if (parseYmd(today()).getDay() === 6 || parseYmd(today()).getDay() === 0) d = addDays(d, 7); const sd = schoolCfg().days; while (!sd.includes(parseYmd(d).getDay())) d = addDays(d, 1); return d; };
const WIZ_SPORTS = ['Running', 'Strength / Gym', 'Speed / Agility', 'Team sport', 'Cycling', 'Swimming', 'Hiking', 'Other'];
let wiz = null;

// a blank planner for a new person: the one-time changes for the original owner are marked done
function freshData() {
  const d = defaultData();
  d.subjects = [];
    Object.assign(d.settings, { palette2: true, fitnessGoalV1: true, tripHolidayV1: true, house: '', yearLevel: '', trainingGoal: '', setupDone: false,
    school: { on: true, bells: DEFAULT_BELLS.map(b => ({ ...b })), tt: {}, days: [1, 2, 3, 4, 5], bellsV2: true, ttV2: true, cycle: { len: 0, date: today(), day: 1 } } });
  return d;
}

function openSetup(first) {
  const s = D.settings, sc = schoolCfg();
  wiz = {
    first, step: first ? -1 : 0,
    name: s.name || '', school: s.schoolName || '', year: s.yearLevel || '', house: s.house || '',
    subjects: D.subjects.map(x => ({ id: x.id, name: x.name, color: x.color })),
    bells: sc.bells.map(b => ({ ...b })), cycle: sc.cycle.len || 0, cday: sc.cycle.len ? cycleDay(today()) || 1 : 1, days: [...sc.days],
    goal: s.trainingGoal || '', week: [1, 2, 3, 4, 5, 6, 0].map(d => ({ d, sport: '', time: '16:30', mins: 45 })), weeks: 6,
    bed: bedCfg().on, bedTime: bedCfg().time, daily: +s.dailyGoal || 60,
    feeds: D.feeds.map(f => ({ id: f.id, name: f.name, url: f.url })),
  };
  wiz.wk = sc.cycle.len && cycleDay(wizWeekStart()) > sc.cycle.len / 2 ? 'B' : 'A';
  if (!wiz.subjects.length) wiz.subjects = [{ name: '' }, { name: '' }, { name: '' }, { name: '' }, { name: '' }];
  // the saved timetable, as "day|bell index" -> subject (an index into wiz.subjects, or free / sport)
  wiz.tt = {};
  for (const [k, v] of Object.entries(sc.tt || {})) {
    const m = /^(D?\d+)-(\d+)$/.exec(k); if (!m || !v) continue;
    const si = wiz.subjects.findIndex(x => x.id === v);
    wiz.tt[m[1] + '|' + m[2]] = si >= 0 ? 's' + si : v === 'free' || v === 'sport' ? v : '';
  }
  wiz.ttCycle = +wiz.cycle;
  drawSetup();
}
function wizRead() {
  // pull what's in the inputs into wiz before re-drawing
  document.querySelectorAll('#wizfx [data-wf]').forEach(el => {
    const [k, i, f] = el.dataset.wf.split('.');
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (i == null) wiz[k] = v;
    else wiz[k][+i][f] = el.type === 'number' ? +v : v;
  });
  document.querySelectorAll('#wizfx [data-wt]').forEach(el => { wiz.tt[el.dataset.wt] = el.value; });
}
function drawSetup() {
  let ov = document.getElementById('wizfx');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'wizfx'; ov.className = 'treefx wizfx'; document.body.appendChild(ov);
    ov.addEventListener('click', wizClick);
  }
  const W = wiz, st = W.step, keys = wizKeys(), key = keys[st];
  const dots = st < 0 ? '' : `<div class="wizdots">${keys.map((k, i) => `<span class="${i === st ? 'on' : i < st ? 'done' : ''}">${i < st ? '✓' : i + 1} ${WIZ_ALL.find(x => x[0] === k)[1]}</span>`).join('')}</div>`;
  let body = '';
  if (st === -1) {
    body = `<div class="wizhero">📅</div><h2>Welcome to Life Planner</h2>
      <p>Your study, classes, training and tasks in one place, with a forest that grows while you study and an arena that gets tougher as you train.</p>
      <p class="muted">A few quick questions set it up for you. You can change everything later in Settings.</p>
      <div class="row wizbtns"><button class="btn primary big" data-w="next">Set up my planner →</button></div>
      ${W.seed ? `<p class="muted small-text" style="text-align:center;margin-top:14px">Moving your own planner to a new PC? <a href="#" data-w="starter">Load the built-in plan instead</a></p>` : ''}`;
  } else if (key === 'you') {
    body = `<h2>About you</h2>
      <div class="field"><label>Your first name</label><input type="text" data-wf="name" value="${esc(W.name)}" placeholder="e.g. Sam" maxlength="40"></div>
      <div class="frow"><div class="field"><label>School (optional)</label><input type="text" data-wf="school" value="${esc(W.school)}" maxlength="60"></div>
        <div class="field"><label>Year level</label><input type="number" min="1" max="12" data-wf="year" value="${esc(W.year)}" placeholder="11"></div>
        <div class="field"><label>House (optional)</label><input type="text" data-wf="house" value="${esc(W.house)}" maxlength="30"></div></div>
      <p class="muted small-text">Year level and house are used to hide school calendar events meant for other years and houses.</p>`;
  } else if (key === 'account') {
    if (!acctLoaded) loadAccount().then(() => { if (wiz) drawSetup(); });
    body = !acctLoaded ? '<h2>Your account</h2><p class="muted">Loading…</p>' : !acct.configured ? '<h2>Your account</h2><p class="muted">Accounts aren\'t switched on for this copy of Life Planner, so friends and chats are off. Press Next to carry on.</p>' : acct.signedIn ? `<h2>You're signed in</h2><p class="muted">You're <b>@${esc(acct.username)}</b>. Add some friends so you can race them on the leaderboards. You can always add more on the Friends page.</p>${friendSuggestHtml(true)}`
      : `<h2>Make your account</h2><p class="muted">Life Planner is better with friends: race them on the leaderboards, battle them in the Arena and chat. Pick a username (no email needed) or log in if you already have one.</p>${accountCard().replace('<h2>Log in to Life Planner</h2>', '').replace('<div class="acct-hero">👥</div>', '')}`;
  } else if (key === 'calendar') {
    body = `<h2>Your calendars</h2><p class="muted">Paste a private iCal (.ics) link from Google Calendar, Outlook or your school portal and its events show up in Today and Calendar. You can skip this and add them later in Settings.</p>
      <div class="wizlist">${W.feeds.map((f, i) => `<div class="row"><span>📅</span><input type="text" data-wf="feeds.${i}.name" value="${esc(f.name)}" placeholder="Name, e.g. School" style="max-width:180px"><input type="text" data-wf="feeds.${i}.url" value="${esc(f.url || '')}" placeholder="https://…/basic.ics" ${f.id && !f.url ? 'disabled' : ''}><button class="iconbtn" data-w="feedDel" data-i="${i}" title="Remove">✕</button></div>`).join('') || '<p class="muted small-text">No calendars yet.</p>'}</div>
      <button class="btn small" data-w="feedAdd">+ Add a calendar link</button>
      <p class="muted small-text">In Google Calendar: Settings, your calendar, "Secret address in iCal format". In Outlook: Settings, Calendar, Shared calendars, Publish.</p>`;
  } else if (key === 'classes') {
    body = `<h2>Your classes</h2><p class="muted">Add the subjects you study. Each gets its own colour and tree in the forest.</p>
      <div class="wizlist">${W.subjects.map((x, i) => {
        const used = x.id && (D.assessments.some(a => a.subjectId === x.id) || D.sessions.some(a => a.subjectId === x.id));
        return `<div class="row"><span class="dot" style="background:${x.color || SUBJ_COLORS[i % SUBJ_COLORS.length]}"></span><input type="text" data-wf="subjects.${i}.name" value="${esc(x.name)}" placeholder="e.g. ${['English', 'Maths', 'Biology', 'History', 'Art'][i % 5]}" maxlength="40">
          <button class="iconbtn" data-w="subDel" data-i="${i}" ${used ? 'disabled title="This subject has SACs or study blocks. Delete it from the Study page instead."' : 'title="Remove"'}>✕</button></div>`;
      }).join('')}</div>
      <button class="btn small" data-w="subAdd">+ Add a class</button>`;
  } else if (key === 'school') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    body = `<h2>Your school day</h2><p class="muted">Bell times power Class mode: a focus timer for each period and an effort rating when the bell goes. Tick "break" for recess, lunch and roll call.</p>
      <div class="wizbells">${W.bells.map((b, i) => `<div class="row bellrow"><input type="text" data-wf="bells.${i}.n" value="${esc(b.n)}"><input type="time" data-wf="bells.${i}.start" value="${b.start}"><input type="time" data-wf="bells.${i}.end" value="${b.end}">
        <label class="small-text"><input type="checkbox" data-wf="bells.${i}.brk" ${b.brk ? 'checked' : ''}> break</label><button class="iconbtn" data-w="bellDel" data-i="${i}" title="Remove">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="btn small" data-w="bellAdd">+ Period</button><span style="flex:1"></span>
        <span class="catchips">${[1, 2, 3, 4, 5, 6].map(k => `<button class="cchip ${W.days.includes(k) ? 'on' : ''}" data-w="day" data-i="${k}">${names[k]}</button>`).join('')}</span></div>
      <div class="frow" style="margin-top:12px"><div class="field"><label>Timetable</label><select data-wf="cycle">${[[0, 'Same every week'], [10, '2-week timetable (Week A and B, Day 1 to 10)'], [5, '5-day cycle'], [6, '6-day cycle'], [8, '8-day cycle']].map(([v, l]) => `<option value="${v}" ${+W.cycle === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${+W.cycle && +W.cycle === 2 * W.days.length ? `<div class="field"><label>${parseYmd(today()).getDay() % 6 === 0 ? 'Is next week' : 'Is this week'} Week A or Week B?</label><select data-wf="wk"><option value="A" ${W.wk !== 'B' ? 'selected' : ''}>Week A (Days 1 to ${W.days.length})</option><option value="B" ${W.wk === 'B' ? 'selected' : ''}>Week B (Days ${W.days.length + 1} to ${+W.cycle})</option></select></div>` : +W.cycle ? `<div class="field"><label>Which day is today${isSchoolDay(today()) ? '' : ' (or the next school day)'}?</label><select data-wf="cday">${Array.from({ length: +W.cycle }, (_, k) => `<option value="${k + 1}" ${+W.cday === k + 1 ? 'selected' : ''}>Day ${k + 1}</option>`).join('')}</select></div>` : ''}</div>
      <p class="muted small-text">Next you can fill in which class is in each period. For a 2-week timetable, Day 1 is the Monday of Week A.</p>`;
  } else if (key === 'tt') {
    body = wizTimetable();
  } else if (key === 'train') {
    body = `<h2>Your training</h2>
      <div class="field"><label>Training goal</label><input type="text" data-wf="goal" value="${esc(W.goal)}" placeholder="e.g. Get faster for netball and run a 5k" maxlength="100"></div>
      <p class="muted" style="margin-bottom:6px">Your usual week. Pick a sport for each day you train and leave rest days empty.</p>
      <div class="wizweek">${W.week.map((w, i) => `<div class="row"><b class="wizday">${DOW[w.d]}</b><select data-wf="week.${i}.sport"><option value="">Rest</option>${WIZ_SPORTS.map(s => `<option ${w.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input type="time" data-wf="week.${i}.time" value="${w.time}"><input type="number" min="10" max="240" step="5" data-wf="week.${i}.mins" value="${w.mins}"><span class="muted small-text">min</span></div>`).join('')}</div>
      <p class="muted small-text">${W.first ? '' : 'These are added on top of the workouts you already have. '}Workouts are added for the next ${W.weeks} weeks. Ticking them off grows your athlete card in the Arena.</p>`;
  } else if (key === 'habits') {
    body = `<h2>Good habits</h2>
      <div class="field"><label>Daily study goal (minutes)</label><input type="number" min="10" max="600" step="5" data-wf="daily" value="${W.daily}"></div>
      <div class="row" style="gap:10px"><label><input type="checkbox" data-wf="bed" ${W.bed ? 'checked' : ''} style="width:auto"> Bedtime on school nights at</label><input type="time" data-wf="bedTime" value="${W.bedTime}" style="width:auto"></div>
      <p class="muted small-text">The planner nudges you to wind down 30 minutes before, and you earn coins for early nights.</p>
      ${W.first ? `<div class="wiznote">💡 <b>Reminders:</b> after this, click <b>Turn on reminders</b> at the top right so pop-ups can reach you.</div>` : ''}`;
  }
  const nav = st < 0 ? '' : `<div class="row wizbtns">${st > 0 ? '<button class="btn" data-w="back">← Back</button>' : W.first ? '' : '<button class="btn" data-w="close">Cancel</button>'}<span style="flex:1"></span>
    ${st < keys.length - 1 ? '<button class="btn primary" data-w="next">Next →</button>' : `<button class="btn primary" data-w="finish">${W.first ? 'Start planning 🎉' : 'Save changes'}</button>`}</div>`;
  const again = !!ov.firstChild;
  ov.innerHTML = `<div class="treecard wizcard ${again ? 'again' : ''} ${key === 'tt' ? 'wide' : ''}">${W.first ? '' : '<button class="iconbtn tc-close" data-w="close" title="Close">✕</button>'}${dots}<div class="wizbody">${body}</div>${nav}</div>`;
  const f = ov.querySelector('input[type=text]'); if (f && !f.value) f.focus();
}
async function wizClick(e) {
  const el = e.target.closest('[data-w]'); if (!el) return;
  e.preventDefault();
  wizRead();
  const W = wiz, i = +el.dataset.i;
  switch (el.dataset.w) {
    case 'next':
      { const k = wizKeys()[W.step];
        if (k === 'you' && !W.name.trim()) { toast('Add your name first', ''); return; }
        if (k === 'account' && W.first && acct.configured && !acct.signedIn) { toast('Make an account first', 'Pick a username and password, then press Create account. Already have one? Log in.'); return; }
        if (k === 'classes' && !W.subjects.some(x => x.name.trim())) { toast('Add at least one class', ''); return; } }
      W.step++; break;
    case 'back': W.step--; break;
    case 'close': document.getElementById('wizfx')?.remove(); wiz = null; return;
    case 'starter':
      if (await loadStarter(true)) { D.settings.setupDone = true; save(); document.getElementById('wizfx')?.remove(); wiz = null; render(); toast('Built-in plan loaded', ''); }
      return;
    case 'subAdd': W.subjects.push({ name: '' }); break;
    case 'subDel': W.subjects.splice(i, 1); break;
    case 'feedAdd': W.feeds.push({ name: '', url: '' }); break;
    case 'feedDel': W.feeds.splice(i, 1); break;
    case 'bellAdd': { const last = W.bells[W.bells.length - 1], s = last ? last.end : '09:00', m = Math.min(1439, hmToMin(s) + 50); W.bells.push({ n: `Period ${W.bells.filter(b => !b.brk).length + 1}`, start: s, end: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }); break; }
    case 'bellDel': W.bells.splice(i, 1); break;
    case 'day': W.days = W.days.includes(i) ? W.days.filter(x => x !== i) : [...W.days, i]; break;
    case 'ttCopy': { const n = +W.cycle, half = n / 2; for (const k of Object.keys(W.tt)) { const [d, b] = k.split('|'), dn = +d.slice(1); if (d[0] === 'D' && dn <= half) W.tt['D' + (dn + half) + '|' + b] = W.tt[k]; } break; }
    case 'ttClear': W.tt = {}; break;
    case 'finish': finishSetup(); return;
  }
  drawSetup();
}
function finishSetup() {
  const W = wiz, s = D.settings;
  s.name = W.name.trim(); s.schoolName = W.school.trim(); s.yearLevel = W.year ? +W.year : ''; s.house = W.house.trim();
  // classes: rename in place, add new ones, drop removed unused ones
  const keep = W.subjects.filter(x => x.name.trim());
  const ids = new Set(keep.map(x => x.id).filter(Boolean));
  D.subjects = D.subjects.filter(x => ids.has(x.id) || D.assessments.some(a => a.subjectId === x.id) || D.sessions.some(a => a.subjectId === x.id));
  keep.forEach((x, i) => {
    const have = x.id && D.subjects.find(y => y.id === x.id);
    if (have) have.name = x.name.trim();
    else { const used = new Set(D.subjects.map(y => y.color)); D.subjects.push({ id: uid() + i, name: x.name.trim(), color: SUBJ_COLORS.find(c => !used.has(c)) || SUBJ_COLORS[i % SUBJ_COLORS.length], notes: '' }); }
  });
  // calendars: keep the ones still listed, add new links
  const keepF = W.feeds.filter(f => f.id || (f.name.trim() && /^(https?|webcal):\/\//i.test(f.url.trim())));
  D.feeds = D.feeds.filter(f => keepF.some(k => k.id === f.id));
  for (const f of keepF) {
    const have = f.id && D.feeds.find(x => x.id === f.id);
    if (have) { have.name = f.name.trim() || have.name; if (have.url && f.url.trim()) have.url = f.url.trim().replace(/^webcal:/i, 'https:'); }
    else { const nf = { id: uid(), name: f.name.trim(), url: f.url.trim().replace(/^webcal:/i, 'https:'), color: ['#5f3dc4', '#0b7285', '#a61e4d', '#495057'][D.feeds.length % 4], enabled: true, smart: /school|schoolbox|office365|outlook/i.test(f.name + f.url), hide: '', show: '' }; D.feeds.push(nf); setTimeout(() => refreshFeed(nf), 300); }
  }
  // school day
  const sc = schoolCfg();
  sc.bells = W.bells.filter(b => b.start && b.end && b.start < b.end).sort((a, b) => a.start.localeCompare(b.start));
  sc.days = W.days.length ? W.days : [1, 2, 3, 4, 5];
  const len = +W.cycle;
  if (len && len === 2 * sc.days.length) { const d = wizWeekStart(), day = W.wk === 'B' ? sc.days.length + 1 : 1; if (len !== +sc.cycle.len || cycleDay(d) !== day) sc.cycle = { len, date: d, day }; }
  else if (len !== +sc.cycle.len || (len && +W.cday !== cycleDay(today()))) {
    let d = today(); while (!sc.days.includes(parseYmd(d).getDay())) d = addDays(d, 1);
    sc.cycle = { len, date: d, day: Math.min(+W.cday || 1, len || 1) };
    if (len !== +W.cycleWas) { /* keep old picks; keys for other layouts just go unused */ }
  }
  // timetable: bell indexes follow the saved (sorted) bells, subjects their new ids
  const wb = W.bells, subjOf = v => { if (v === 'free' || v === 'sport') return v; const x = W.subjects[+String(v).slice(1)]; return x && x.name.trim() ? (D.subjects.find(y => y.name === x.name.trim()) || {}).id || '' : ''; };
  const tt = {};
  for (const [k, v] of Object.entries(W.tt || {})) {
    const [d, b] = k.split('|'), bi = sc.bells.indexOf(wb[+b]); if (bi < 0 || !v) continue;
    if ((d[0] === 'D') !== !!len) continue; // a layout from before the cycle changed
    const id = subjOf(v); if (id) tt[d + '-' + bi] = id;
  }
  sc.tt = tt;
  // training
  s.trainingGoal = W.goal.trim();
  let added = 0;
  for (const w of W.week.filter(x => x.sport)) {
    let d = today(); while (parseYmd(d).getDay() !== w.d) d = addDays(d, 1);
    for (let k = 0; k < W.weeks; k++, d = addDays(d, 7)) {
      D.workouts.push({ id: uid() + added, title: w.sport === 'Strength / Gym' ? 'Gym session' : w.sport === 'Team sport' ? 'Team training' : w.sport, sport: w.sport, eventId: '', date: d, time: w.time, duration: +w.mins || 45, distance: '', intensity: 'Moderate', notes: '', done: false, remind: s.remind.workout || [] });
      added++;
    }
  }
  // habits
  s.dailyGoal = +W.daily || 60;
  s.bedtime = Object.assign({}, bedCfg(), { on: !!W.bed, time: W.bedTime || '22:00' });
  const first = W.first;
  s.setupDone = true; if (first) s.welcomed = true;
  save(); document.getElementById('wizfx')?.remove(); wiz = null;
  view = 'today'; render(); renderFocusBar?.();
  if (first) { toast(`🎉 Welcome, ${s.name}!`, `${D.subjects.length} classes${added ? ` and ${added} workouts` : ''} are in. Here's a quick tour.`); startTour(); }
  else toast('✓ Setup saved', added ? `${added} workouts added.` : '');
}

// ---------- guided tour ----------
// Each page gets a step on its menu button, then one per section. A step whose
// section isn't on screen (no data yet, a card that's turned off) is skipped.
const TOUR_PAGES = {
  today: ['☀️ Today', 'Your home page. Your whole day on one screen.', [
    ['.hero', 'Your day at a glance', 'How many things you\'ve ticked off, your study goal and your streak. <b>Start studying</b> starts a focus timer straight away.'],
    ['.quickadd', 'Quick add', 'Type things like <b>"Biology SAC next Thursday 9am"</b> or <b>"dentist 3 Nov 4pm"</b>. It works out what it is, the subject, the date and the time, and puts it in the right place. For a SAC it offers to plan your revision too. Press <b>/</b> anywhere to jump here.'],
    ['.tweek', 'Pick a day', 'Click any day to plan it. The dots show what\'s on and the green bar shows how much is ticked off. Use the arrows to move between days and weeks.'],
    ['.tday', 'The day, in time order', 'Tick things off as you go, press <b>▶ Focus</b> on a study block, and use the buttons underneath to add more.'],
    ['.ttasks', 'Tasks', 'Type a task and press Enter to add it. Overdue and missed things show underneath so nothing slips.'],
    ['.tside', 'Coming up', 'Your next SAC, deadline and race, plus the next three days. Click a day to open it.'],
    ['.apps-row', 'Your apps', 'Shortcuts to the apps and websites you use for school and training.']]],
  calendar: ['📅 Calendar', 'The whole month at once.', [
    ['.calbar', 'Month and filters', 'Move between months, connect a Google or school calendar, and choose what to show.'],
    ['.cal', 'Month view', 'Click any day to see it underneath. Events from linked calendars show up here too.'],
    ['.calday', 'The day you picked', 'Everything on that day, laid out across the page, with buttons to add study, SACs, workouts, events, deadlines and tasks.']]],
  study: ['📚 Study', 'Subjects, SACs and study blocks.', [
    ['.upnext-row', 'What\'s next', 'Your next study block, next SAC or exam and today\'s progress. <b>Plan more</b> builds a revision plan for a SAC.'],
    ['.study-grid2 > .study-side:first-child > .card:first-child', 'This week', 'Pick a day to see its study blocks. Press <b>▶ Start</b> to focus. A session of 10+ minutes plants a tree.'],
    ['.examhub', 'Exam lead-up', 'A countdown for each exam and how ready you are. <b>Add exam prep</b> adds timed past papers, SAC prep and a light day before each exam to your current plan. After a paper, <b>Log a paper</b> with your score and the topics you lost marks on, and your next blocks focus on them.'],
    ['.subjcard', 'Subjects and links', 'Your classes and their colours, plus links to study guides and notes.'],
    ['.study-grid2 > .study-side:last-child > .card:first-child', 'SACs & exams', 'Every assessment with a countdown. Tick one off when it\'s done to earn coins.'],
    ['.study-grid2 > .study-side:last-child > .card:last-child', 'Studied this week', 'Focus time per subject against what you planned.']]],
  school: ['🏫 Class mode', 'A timer for each school period.', [
    ['.clsgrid > :first-child', 'Today\'s periods', 'Pick the subject for each period. When the bell goes, rate your effort from 😴 to 🔥 for coins.'],
    ['.clsgrid > :last-child', 'Effort and bell times', 'Your average effort per subject this week. Check the bell times match your school.']]],
  forest: ['🌳 Forest', 'Every focus session grows a tree here.', [
    ['.scene-wrap', 'Your 3D garden', 'Drag empty space to move around, pinch (or ＋ −) to zoom, right-drag or ⟲ ⟳ to spin, and ◇ for an isometric view. Drag a tree to another tile to move it, click it to name or water it, and brush through trees to see them bend. Trees grow 🍃 leaves: tap a leaf bubble or Collect to bank them. ✨ Effects turns clouds, weather and roaming animals on or off.'],
    ['.forest-tabs', 'Trees, critters and the shop', 'Choose each subject\'s tree, meet your critters, and spend coins on scenes, decorations and upgrades.'],
    ['.forest-cols > .stack:first-child', 'Challenges', 'New challenges every day and week. Claim the coins when you finish one.'],
    ['.forest-cols > .stack:last-child', 'Milestones and your trees', 'Big goals with bigger rewards, plus which tree each subject grows.']]],
  training: ['💪 Training & Health', 'Your physical profile. Everything here powers your Arena athlete.', [
    ['.btiles', 'This week at a glance', 'Training time, sessions done, your combo, sleep, steps and resting heart rate.'],
    ['.rdcard', 'Readiness', 'Freshness, last night\'s sleep and your heart rate make a readiness score. A high score gives your athlete bonus HP in Arena battles.'],
    ['.bodytabs', 'Training, sleep and bests', '<b>Training</b> has your plan and Garmin or Strava imports, <b>Sleep &amp; health</b> has your sleep log and trends, and <b>Bests</b> tracks personal records.']]],
  arena: ['⚔️ Arena', 'Battle with the athlete your workouts built.', [
    ['.ahero', 'Your athlete', 'Your stats, today\'s readiness bonus, 💪 Grit, combo and battles left today.'],
    ['.arenatabs', 'Arena tabs', 'Battle gym leaders and bosses, check quests, unlock and upgrade moves, and spend Grit on gear and outfits.']]],
  friends: ['👥 Friends', 'Race your friends at studying and training.', [
    ['.fme', 'Your week', 'Your numbers this week. Friends see these and your avatar, nothing else.'],
    ['.friends-main', 'Leaderboards and friends', 'Switch between study, training and health boards, search friends by username, and press <b>Compare</b> to go head to head.']]],
  todo: ['✅ To-do', 'Your tasks, events and deadlines in one place.', [
    ['.todo-side', 'Pick what to show', 'All tasks, today, the next 7 days, each list, and your upcoming or past events.'],
    ['.todo-main', 'Your list', 'Tasks grouped by when they\'re due. Add one at the top, or press <b>+ Event</b> for birthdays, appointments and deadlines.']]],
  inbox: ['📬 Missed info', 'School emails and notices you might have missed.', [
    ['.summarycard', 'The summary', 'A short catch-up of what came in. <b>Check email now</b> runs a fresh check.'],
    ['.catchips', 'Filter by type', 'Show just the action items, deadlines or events.'],
    ['.mailcards', 'Each email', 'Due dates go straight into your planner. Cross one off and it never reminds you again.']]],
  settings: ['⚙️ Settings', 'Make the planner yours.', [
    ['.settabs', 'Settings sections', 'Your details, your <b>Account</b> for friends, <b>Theme</b> colours, calendars, reminders, backups and app options. You can replay this tour from here.']]],
};
let TOUR = [], tourAt = -1;
function startTour() {
  TOUR = [];
  for (const [v, [title, intro, secs]] of Object.entries(TOUR_PAGES)) {
    TOUR.push({ v, title, text: intro + ' Press <b>Next</b> for a look around.', page: title });
    for (const [sel, t, text] of secs) TOUR.push({ v, sel, title: t, text, page: title });
  }
  tourAt = 0; drawTour(1);
}
function endTour() {
  tourAt = -1; document.getElementById('tourfx')?.remove();
  document.querySelectorAll('.tourlit').forEach(x => x.classList.remove('tourlit'));
  D.settings.toured = true; save();
}
function tourGo(dir) {
  for (;;) {
    tourAt += dir;
    if (tourAt >= TOUR.length) { endTour(); view = 'today'; render(); toast('🎉 That\'s the tour', 'Replay it any time from Settings.'); return; }
    if (tourAt < 0) { tourAt = 0; dir = 1; }
    const st = TOUR[tourAt];
    if (!st.sel) break;
    if (view !== st.v) { view = st.v; render(); }
    const el = document.querySelector('#view ' + st.sel);
    if (el && el.getBoundingClientRect().height > 0) break;
  }
  drawTour(dir);
}
function drawTour() {
  const st = TOUR[tourAt];
  if (view !== st.v || !st.sel) { view = st.v; render(); }
  document.querySelectorAll('.tourlit').forEach(x => x.classList.remove('tourlit'));
  const btn = document.querySelector(`#tabs button[data-view="${st.v}"]`);
  let target = st.sel ? document.querySelector('#view ' + st.sel) : btn;
  if (!st.sel) { window.scrollTo(0, 0); if (btn) { btn.classList.add('tourlit'); btn.scrollIntoView({ block: 'nearest' }); } }
  else if (target) target.scrollIntoView({ block: target.offsetHeight > innerHeight * .7 ? 'start' : 'center' });
  let ov = document.getElementById('tourfx');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'tourfx'; document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'next') tourGo(1);
      else if (b.dataset.t === 'back') tourGo(-1);
      else if (b.dataset.t === 'page') { const pg = TOUR[tourAt].v; while (tourAt < TOUR.length - 1 && TOUR[tourAt + 1].v === pg) tourAt++; tourGo(1); }
      else endTour();
    });
  }
  const r = target ? target.getBoundingClientRect() : { top: 100, left: 240, right: 240, bottom: 140, width: 0, height: 40 };
  const pad = 6, sp = { x: r.left - pad, y: Math.max(4, r.top - pad), w: r.width + pad * 2, h: Math.min(r.height + pad * 2, innerHeight - 8 - Math.max(4, r.top - pad)) };
  const W = Math.min(340, innerWidth - 32), H = 210;
  let cx, cy;
  if (sp.x + sp.w + W + 24 < innerWidth) { cx = sp.x + sp.w + 16; cy = Math.max(12, Math.min(innerHeight - H - 12, sp.y)); }
  else if (sp.y + sp.h + H + 16 < innerHeight) { cx = Math.max(16, Math.min(innerWidth - W - 16, sp.x)); cy = sp.y + sp.h + 12; }
  else if (sp.y - H - 16 > 0) { cx = Math.max(16, Math.min(innerWidth - W - 16, sp.x)); cy = sp.y - H - 12; }
  else { cx = innerWidth - W - 20; cy = innerHeight - H - 20; }
  const pages = [...new Set(TOUR.map(x => x.v))], pi = pages.indexOf(st.v) + 1;
  const inPage = TOUR.filter(x => x.v === st.v), k = inPage.indexOf(st) + 1;
  ov.innerHTML = `<div class="tourspot" style="left:${sp.x}px;top:${sp.y}px;width:${sp.w}px;height:${sp.h}px"></div>
    <div class="tourcard" style="top:${cy}px;left:${cx}px;width:${W}px">
    <div class="unlabel">${esc(st.page)} · ${k} of ${inPage.length} <span class="muted">· page ${pi} of ${pages.length}</span></div><h3>${st.title}</h3><p>${st.text}</p>
    <div class="row"><button class="btn small" data-t="skip">End tour</button>${pi < pages.length ? '<button class="btn small ghost" data-t="page">Next page ⇥</button>' : ''}<span style="flex:1"></span>${tourAt ? '<button class="btn small" data-t="back">←</button>' : ''}<button class="btn small primary" data-t="next">${tourAt === TOUR.length - 1 ? 'Finish' : 'Next →'}</button></div></div>`;
  // keep the whole card (and its buttons) on screen, however long the text is
  const card = ov.querySelector('.tourcard'), ch = card.offsetHeight;
  if (innerWidth > 760 && cy + ch > innerHeight - 12) card.style.top = Math.max(12, innerHeight - ch - 12) + 'px';
}
window.addEventListener('resize', () => { if (tourAt >= 0) drawTour(); });
document.addEventListener('keydown', e => { if (tourAt >= 0 && (e.key === 'ArrowRight' || e.key === 'Enter')) { e.preventDefault(); tourGo(1); } else if (tourAt >= 0 && e.key === 'ArrowLeft') tourGo(-1); });
document.addEventListener('keydown', e => { if (tourAt >= 0 && e.key === 'Escape') endTour(); });

// the timetable grid: one column per timetable day, one row per class period
function wizTimetable() {
  const W = wiz, len = +W.cycle, days = [...W.days].sort((a, b) => a - b), per = W.bells.map((b, i) => [b, i]).filter(([b]) => !b.brk && b.start && b.end);
  const cols = len ? Array.from({ length: len }, (_, k) => ['D' + (k + 1), `Day ${k + 1}`, len % days.length === 0 ? `${len === 10 ? (k < 5 ? 'Wk A ' : 'Wk B ') : ''}${DOW[days[k % days.length]]}` : '']) : days.map(d => [String(d), DOW[d], '']);
  const opts = v => `<option value="">–</option>${W.subjects.map((x, i) => x.name.trim() ? `<option value="s${i}" ${v === 's' + i ? 'selected' : ''}>${esc(x.name.trim())}</option>` : '').join('')}<option value="free" ${v === 'free' ? 'selected' : ''}>Private study</option><option value="sport" ${v === 'sport' ? 'selected' : ''}>Sport</option>`;
  if (!per.length) return `<h2>Your timetable</h2><p class="muted">Add some periods on the School day step first.</p>`;
  return `<h2>Your timetable</h2><p class="muted">Pick the class for each period. ${len ? `Your timetable repeats every ${len} school days.` : 'It\'s the same every week.'} You can skip this and fill it in later, period by period, in Class mode.</p>
    <div class="wiztt"><table><tr><th></th>${cols.map(([, l, sub]) => `<th>${l}${sub ? `<small>${sub}</small>` : ''}</th>`).join('')}</tr>
    ${per.map(([b, i]) => `<tr><th>${esc(b.n)}<small>${b.start}</small></th>${cols.map(([d]) => { const k = d + '|' + i, v = W.tt[k] || ''; return `<td><select data-wt="${k}" class="${v ? 'set' : ''}">${opts(v)}</select></td>`; }).join('')}</tr>`).join('')}</table></div>
    <div class="row" style="gap:8px;margin-top:8px">${len === 10 || (len && len % 2 === 0) ? `<button class="btn small" data-w="ttCopy">Copy Week A to Week B</button>` : ''}<button class="btn small" data-w="ttClear">Clear</button></div>`;
}
document.addEventListener('change', e => { if (e.target.matches?.('#wizfx [data-wf=cycle]')) { wizRead(); drawSetup(); } });
document.addEventListener('change', e => { if (e.target.matches?.('#wizfx [data-wt]')) e.target.classList.toggle('set', !!e.target.value); });
