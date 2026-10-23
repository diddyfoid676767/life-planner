'use strict';
/* Setup: a first-run wizard so someone else can use the planner with their own
   name, classes, bell times and training week. It also re-runs from Settings
   to change those things without touching anything else. */

const WIZ_STEPS = ['You', 'Classes', 'School day', 'Training', 'Habits'];
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
  };
  if (!wiz.subjects.length) wiz.subjects = [{ name: '' }, { name: '' }, { name: '' }, { name: '' }, { name: '' }];
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
}
function drawSetup() {
  let ov = document.getElementById('wizfx');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'wizfx'; ov.className = 'treefx wizfx'; document.body.appendChild(ov);
    ov.addEventListener('click', wizClick);
  }
  const W = wiz, st = W.step;
  const dots = st < 0 ? '' : `<div class="wizdots">${WIZ_STEPS.map((n, i) => `<span class="${i === st ? 'on' : i < st ? 'done' : ''}">${i < st ? '✓' : i + 1} ${n}</span>`).join('')}</div>`;
  let body = '';
  if (st === -1) {
    body = `<div class="wizhero">📅</div><h2>Welcome to Life Planner</h2>
      <p>Your study, classes, training and tasks in one place, with a forest that grows while you study and an arena that gets tougher as you train.</p>
      <p class="muted">A few quick questions set it up for you. You can change everything later in Settings.</p>
      <div class="row wizbtns"><button class="btn primary big" data-w="next">Set up my planner →</button></div>
      ${W.seed ? `<p class="muted small-text" style="text-align:center;margin-top:14px">Moving your own planner to a new PC? <a href="#" data-w="starter">Load the built-in plan instead</a></p>` : ''}`;
  } else if (st === 0) {
    body = `<h2>About you</h2>
      <div class="field"><label>Your first name</label><input type="text" data-wf="name" value="${esc(W.name)}" placeholder="e.g. Sam" maxlength="40"></div>
      <div class="frow"><div class="field"><label>School (optional)</label><input type="text" data-wf="school" value="${esc(W.school)}" maxlength="60"></div>
        <div class="field"><label>Year level</label><input type="number" min="1" max="12" data-wf="year" value="${esc(W.year)}" placeholder="11"></div>
        <div class="field"><label>House (optional)</label><input type="text" data-wf="house" value="${esc(W.house)}" maxlength="30"></div></div>
      <p class="muted small-text">Year level and house are used to hide school calendar events meant for other years and houses.</p>`;
  } else if (st === 1) {
    body = `<h2>Your classes</h2><p class="muted">Add the subjects you study. Each gets its own colour and tree in the forest.</p>
      <div class="wizlist">${W.subjects.map((x, i) => {
        const used = x.id && (D.assessments.some(a => a.subjectId === x.id) || D.sessions.some(a => a.subjectId === x.id));
        return `<div class="row"><span class="dot" style="background:${x.color || SUBJ_COLORS[i % SUBJ_COLORS.length]}"></span><input type="text" data-wf="subjects.${i}.name" value="${esc(x.name)}" placeholder="e.g. ${['English', 'Maths', 'Biology', 'History', 'Art'][i % 5]}" maxlength="40">
          <button class="iconbtn" data-w="subDel" data-i="${i}" ${used ? 'disabled title="This subject has SACs or study blocks. Delete it from the Study page instead."' : 'title="Remove"'}>✕</button></div>`;
      }).join('')}</div>
      <button class="btn small" data-w="subAdd">+ Add a class</button>`;
  } else if (st === 2) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    body = `<h2>Your school day</h2><p class="muted">Bell times power Class mode: a focus timer for each period and an effort rating when the bell goes. Tick "break" for recess, lunch and roll call.</p>
      <div class="wizbells">${W.bells.map((b, i) => `<div class="row bellrow"><input type="text" data-wf="bells.${i}.n" value="${esc(b.n)}"><input type="time" data-wf="bells.${i}.start" value="${b.start}"><input type="time" data-wf="bells.${i}.end" value="${b.end}">
        <label class="small-text"><input type="checkbox" data-wf="bells.${i}.brk" ${b.brk ? 'checked' : ''}> break</label><button class="iconbtn" data-w="bellDel" data-i="${i}" title="Remove">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="btn small" data-w="bellAdd">+ Period</button><span style="flex:1"></span>
        <span class="catchips">${[1, 2, 3, 4, 5, 6].map(k => `<button class="cchip ${W.days.includes(k) ? 'on' : ''}" data-w="day" data-i="${k}">${names[k]}</button>`).join('')}</span></div>
      <div class="frow" style="margin-top:12px"><div class="field"><label>Timetable</label><select data-wf="cycle">${[[0, 'Same every week'], [5, '5-day cycle'], [10, '10-day cycle'], [14, '2-week cycle (Day 1 to 14)']].map(([v, l]) => `<option value="${v}" ${+W.cycle === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${+W.cycle ? `<div class="field"><label>Which day is today${isSchoolDay(today()) ? '' : ' (or the next school day)'}?</label><select data-wf="cday">${Array.from({ length: +W.cycle }, (_, k) => `<option value="${k + 1}" ${+W.cday === k + 1 ? 'selected' : ''}>Day ${k + 1}</option>`).join('')}</select></div>` : ''}</div>
      <p class="muted small-text">You'll pick the subject for each period in Class mode the first time it comes up. After that it's remembered.</p>`;
  } else if (st === 3) {
    body = `<h2>Your training</h2>
      <div class="field"><label>Training goal</label><input type="text" data-wf="goal" value="${esc(W.goal)}" placeholder="e.g. Get faster for netball and run a 5k" maxlength="100"></div>
      <p class="muted" style="margin-bottom:6px">Your usual week. Pick a sport for each day you train and leave rest days empty.</p>
      <div class="wizweek">${W.week.map((w, i) => `<div class="row"><b class="wizday">${DOW[w.d]}</b><select data-wf="week.${i}.sport"><option value="">Rest</option>${WIZ_SPORTS.map(s => `<option ${w.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input type="time" data-wf="week.${i}.time" value="${w.time}"><input type="number" min="10" max="240" step="5" data-wf="week.${i}.mins" value="${w.mins}"><span class="muted small-text">min</span></div>`).join('')}</div>
      <p class="muted small-text">${W.first ? '' : 'These are added on top of the workouts you already have. '}Workouts are added for the next ${W.weeks} weeks. Ticking them off grows your athlete card in the Arena.</p>`;
  } else if (st === 4) {
    body = `<h2>Good habits</h2>
      <div class="field"><label>Daily study goal (minutes)</label><input type="number" min="10" max="600" step="5" data-wf="daily" value="${W.daily}"></div>
      <div class="row" style="gap:10px"><label><input type="checkbox" data-wf="bed" ${W.bed ? 'checked' : ''} style="width:auto"> Bedtime on school nights at</label><input type="time" data-wf="bedTime" value="${W.bedTime}" style="width:auto"></div>
      <p class="muted small-text">The planner nudges you to wind down 30 minutes before, and you earn coins for early nights.</p>
      ${W.first ? `<div class="wiznote">💡 <b>Reminders:</b> after this, click <b>Turn on reminders</b> at the top right so pop-ups can reach you.</div>` : ''}`;
  }
  const nav = st < 0 ? '' : `<div class="row wizbtns">${st > 0 ? '<button class="btn" data-w="back">← Back</button>' : W.first ? '' : '<button class="btn" data-w="close">Cancel</button>'}<span style="flex:1"></span>
    ${st < WIZ_STEPS.length - 1 ? '<button class="btn primary" data-w="next">Next →</button>' : `<button class="btn primary" data-w="finish">${W.first ? 'Start planning 🎉' : 'Save changes'}</button>`}</div>`;
  const again = !!ov.firstChild;
  ov.innerHTML = `<div class="treecard wizcard ${again ? 'again' : ''}">${W.first ? '' : '<button class="iconbtn tc-close" data-w="close" title="Close">✕</button>'}${dots}<div class="wizbody">${body}</div>${nav}</div>`;
  const f = ov.querySelector('input[type=text]'); if (f && !f.value) f.focus();
}
async function wizClick(e) {
  const el = e.target.closest('[data-w]'); if (!el) return;
  e.preventDefault();
  wizRead();
  const W = wiz, i = +el.dataset.i;
  switch (el.dataset.w) {
    case 'next':
      if (W.step === 0 && !W.name.trim()) { toast('Add your name first', ''); return; }
      if (W.step === 1 && !W.subjects.some(x => x.name.trim())) { toast('Add at least one class', ''); return; }
      W.step++; break;
    case 'back': W.step--; break;
    case 'close': document.getElementById('wizfx')?.remove(); wiz = null; return;
    case 'starter':
      if (await loadStarter(true)) { D.settings.setupDone = true; save(); document.getElementById('wizfx')?.remove(); wiz = null; render(); toast('Built-in plan loaded', ''); }
      return;
    case 'subAdd': W.subjects.push({ name: '' }); break;
    case 'subDel': W.subjects.splice(i, 1); break;
    case 'bellAdd': { const last = W.bells[W.bells.length - 1], s = last ? last.end : '09:00', m = Math.min(1439, hmToMin(s) + 50); W.bells.push({ n: `Period ${W.bells.filter(b => !b.brk).length + 1}`, start: s, end: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }); break; }
    case 'bellDel': W.bells.splice(i, 1); break;
    case 'day': W.days = W.days.includes(i) ? W.days.filter(x => x !== i) : [...W.days, i]; break;
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
  // school day
  const sc = schoolCfg();
  sc.bells = W.bells.filter(b => b.start && b.end && b.start < b.end).sort((a, b) => a.start.localeCompare(b.start));
  sc.days = W.days.length ? W.days : [1, 2, 3, 4, 5];
  const len = +W.cycle;
  if (len !== +sc.cycle.len || (len && +W.cday !== cycleDay(today()))) {
    let d = today(); while (!sc.days.includes(parseYmd(d).getDay())) d = addDays(d, 1);
    sc.cycle = { len, date: d, day: Math.min(+W.cday || 1, len || 1) };
    if (len !== +W.cycleWas) { /* keep old picks; keys for other layouts just go unused */ }
  }
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
  today: ['☀️ Today', 'Your home page. Everything that matters today, in one place.', [
    ['.hero', 'Your day at a glance', 'How many things you\'ve ticked off, your study goal and your streak. <b>Start studying</b> starts a focus timer straight away.'],
    ['.todaynext', 'Coming up next', 'Your next SAC or exam, next deadline and next race, with how many days are left.'],
    ['.today-grid > .card', 'Today\'s timeline', 'Everything on today in time order. Tick things off as you go, press <b>▶ Focus</b> on a study block, and use the buttons underneath to add more.'],
    ['.today-grid > .stack', 'Tasks', 'Type a task and press Enter to add it. Overdue and missed things show underneath so nothing slips.'],
    ['.soon3', 'The next 3 days', 'A quick look ahead. Click a day to open it in Day plan.'],
    ['.apps-row', 'Your apps', 'Shortcuts to the apps and websites you use for school and training.']]],
  day: ['🕒 Day plan', 'Plan any day hour by hour.', [
    ['.daystrip', 'Pick a day', 'Jump between days. The dots show what\'s on and the bar shows how much is ticked off.'],
    ['.day-grid > .card', 'The day, hour by hour', 'Drag things to move them, click to edit, and press ▶ Focus on study blocks.'],
    ['.day-grid > .stack', 'Totals and quick add', 'How much study and training is planned, plus buttons to add anything to this day.']]],
  calendar: ['📅 Calendar', 'The whole month at once.', [
    ['.calbar', 'Month and filters', 'Move between months, connect a Google or school calendar, and choose what to show.'],
    ['.cal', 'Month view', 'Click any day to see it on the right. Events from linked calendars show up here too.'],
    ['.calgrid > .card', 'The day you picked', 'Everything on that day, with buttons to add study, SACs, workouts, events, deadlines and tasks.']]],
  study: ['📚 Study', 'Subjects, SACs and study blocks.', [
    ['.upnext-row', 'What\'s next', 'Your next study block, next SAC or exam and today\'s progress. <b>Plan more</b> builds a revision plan for a SAC.'],
    ['.study-grid2 > .study-side:first-child > .card:first-child', 'This week', 'Pick a day to see its study blocks. Press <b>▶ Start</b> to focus. A session of 10+ minutes plants a tree.'],
    ['.subjcard', 'Subjects and links', 'Your classes and their colours, plus links to study guides and notes.'],
    ['.study-grid2 > .study-side:last-child > .card:first-child', 'SACs & exams', 'Every assessment with a countdown. Tick one off when it\'s done to earn coins.'],
    ['.study-grid2 > .study-side:last-child > .card:last-child', 'Studied this week', 'Focus time per subject against what you planned.']]],
  school: ['🏫 Class mode', 'A timer for each school period.', [
    ['.clsgrid > :first-child', 'Today\'s periods', 'Pick the subject for each period. When the bell goes, rate your effort from 😴 to 🔥 for coins.'],
    ['.clsgrid > :last-child', 'Effort and bell times', 'Your average effort per subject this week. Check the bell times match your school.']]],
  forest: ['🌳 Forest', 'Every focus session grows a tree here.', [
    ['.scene-wrap', 'Your 3D garden', 'Hover a tree to see it sway, drag it to another tile to rearrange, and click it to name or water it. Switch to <b>Scene</b> for the classic view.'],
    ['.forest-tabs', 'Trees, critters and the shop', 'Choose each subject\'s tree, meet your critters, and spend coins on scenes, decorations and upgrades.'],
    ['.forest-cols > .stack:first-child', 'Challenges', 'New challenges every day and week. Claim the coins when you finish one.'],
    ['.forest-cols > .stack:last-child', 'Milestones and your trees', 'Big goals with bigger rewards, plus which tree each subject grows.']]],
  training: ['🏃 Training & Arena', 'Workouts power up your athlete.', [
    ['.ahero', 'Your athlete', 'Stats grow when you tick off workouts. 💪 Grit is the Arena\'s currency.'],
    ['.arenatabs', 'Arena tabs', 'Battle gym leaders and bosses, unlock and upgrade moves, log personal bests, and spend Grit in the shop and wardrobe.'],
    ['.stravacard', 'Automatic imports', 'Connect Garmin through intervals.icu, or import from Strava, so workouts come in by themselves. Tick them off to count them.'],
    ['.train-top', 'This week\'s training', 'Your next event, sessions done this week and your training load.'],
    ['.card.board', 'Week board', 'Every planned workout this week. Tick them off as you do them.']]],
  health: ['💤 Health & sleep', 'Sleep, steps and how you feel.', [
    ['.htiles', 'Last night and today', 'Sleep, steps, resting heart rate and body battery from your watch.'],
    ['.hgrid', 'Two-week trends', 'Sleep and steps compared to your goals.'],
    ['.hlogcard', 'Log today', 'No watch? Log your sleep, mood and energy here.']]],
  personal: ['✅ Events & Tasks', 'Everything outside school study.', [
    ['.grid.g2 > .card:first-child', 'Events & deadlines', 'Birthdays, appointments and deadlines. Filter them by type, and give each one its own reminders.'],
    ['.grid.g2 > .card:last-child', 'Tasks', 'Your whole to-do list grouped by when it\'s due. Add one at the top.']]],
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
}
window.addEventListener('resize', () => { if (tourAt >= 0) drawTour(); });
document.addEventListener('keydown', e => { if (tourAt >= 0 && (e.key === 'ArrowRight' || e.key === 'Enter')) { e.preventDefault(); tourGo(1); } else if (tourAt >= 0 && e.key === 'ArrowLeft') tourGo(-1); });
document.addEventListener('keydown', e => { if (tourAt >= 0 && e.key === 'Escape') endTour(); });
