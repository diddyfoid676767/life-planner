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
const TOUR = [
  ['today', '☀️ Today', 'Your home page: what\'s on today, your next SAC, training and deadlines, plus quick tasks. Press <b>Start studying</b> any time.'],
  ['day', '🕒 Day plan', 'Today hour by hour. Drag things around to plan your day, and see how much study and training is planned.'],
  ['calendar', '📅 Calendar', 'Month view of everything. Add a school or Google calendar link in Settings and those events show up here too.'],
  ['study', '📚 Study', 'Your subjects, SACs and exams, and study blocks. Press ▶ on a block for a focus timer. Every focus session plants a tree.'],
  ['school', '🏫 Class mode', 'A timer for each school period. When the bell goes, rate your effort from 😴 to 🔥 for a few coins. Add homework in the same box.'],
  ['forest', '🌳 Forest', 'Your trees, critters and coins. Spend coins in the shop on scenes, mystery boxes and upgrades. Skip a day of study and a tree wilts.'],
  ['training', '🏃 Training & Arena', 'Plan your workouts and tick them off. Every workout grows your athlete\'s stats and earns 💪 Grit. Battle rivals and bosses, log personal bests, do weekly quests, and dress your avatar in the Wardrobe.'],
  ['personal', '✅ Events & Tasks', 'Birthdays, appointments, deadlines and to-dos. Each can have its own reminders.'],
  ['inbox', '📬 Missed info', 'A summary of school emails and notices you might have missed. SACs, tests and other due dates from your email go straight into your planner and to-do list.'],
  ['settings', '⚙️ Settings', 'Change your setup, connect calendars, export a backup, and replay this tour. Keys 1 to 7 switch pages.'],
];
let tourAt = -1;
function startTour() { tourAt = 0; drawTour(); }
function endTour() {
  tourAt = -1; document.getElementById('tourfx')?.remove();
  document.querySelectorAll('.tourlit').forEach(x => x.classList.remove('tourlit'));
  D.settings.toured = true; save();
}
function drawTour() {
  const [v, title, text] = TOUR[tourAt];
  view = v; render();
  document.querySelectorAll('.tourlit').forEach(x => x.classList.remove('tourlit'));
  const btn = document.querySelector(`#tabs button[data-view="${v}"]`);
  if (btn) { btn.classList.add('tourlit'); btn.scrollIntoView({ block: 'nearest' }); }
  let ov = document.getElementById('tourfx');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'tourfx'; document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'next') { if (++tourAt >= TOUR.length) { endTour(); view = 'today'; render(); toast('🎉 That\'s the tour', 'Replay it any time from Settings.'); return; } drawTour(); }
      else if (b.dataset.t === 'back') { tourAt = Math.max(0, tourAt - 1); drawTour(); }
      else endTour();
    });
  }
  const r = btn ? btn.getBoundingClientRect() : { top: 100, right: 220, height: 40 };
  const top = Math.max(12, Math.min(window.innerHeight - 230, r.top - 20));
  ov.innerHTML = `<div class="tourcard" style="top:${top}px;left:${Math.round(r.right + 18)}px"><span class="tourarrow" style="top:${Math.round(r.top + r.height / 2 - top - 8)}px"></span>
    <div class="unlabel">Tour · ${tourAt + 1} of ${TOUR.length}</div><h3>${title}</h3><p>${text}</p>
    <div class="row"><button class="btn small" data-t="skip">Skip tour</button><span style="flex:1"></span>${tourAt ? '<button class="btn small" data-t="back">←</button>' : ''}<button class="btn small primary" data-t="next">${tourAt === TOUR.length - 1 ? 'Finish' : 'Next →'}</button></div></div>`;
}
document.addEventListener('keydown', e => { if (tourAt >= 0 && e.key === 'Escape') endTour(); });
