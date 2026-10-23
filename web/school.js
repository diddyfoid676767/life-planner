'use strict';
/* Class mode: a focus timer for each school period, then an effort rating
   when the bell goes. Ratings pay a few coins into the forest ledger
   (cls:<date>:<period>), and a fully rated good day pays a bonus (clsday:). */

const EFFORT = [['😴', 'Switched off'], ['😐', 'Drifted a lot'], ['🙂', 'OK'], ['💪', 'Solid work'], ['🔥', 'Locked in']];
// effort is rated out of 10 (older ratings were out of 5, so they count double)
const eff10 = r => r ? (r.e10 || (r.effort ? r.effort * 2 : 0)) : 0;
const effIcon = n => EFFORT[Math.max(0, Math.ceil(n / 2) - 1)][0];
const effColor = n => `hsl(${Math.round((n - 1) / 9 * 125)} 70% 45%)`;
const DEFAULT_BELLS = [
  { n: 'Mentor', start: '08:50', end: '09:10', brk: true },
  { n: 'Period 1', start: '09:10', end: '10:00' }, { n: 'Period 2', start: '10:00', end: '10:50' },
  { n: 'Recess', start: '10:50', end: '11:10', brk: true },
  { n: 'Period 3', start: '11:10', end: '12:00' }, { n: 'Period 4', start: '12:00', end: '12:50' },
  { n: 'Lunch', start: '12:50', end: '13:50', brk: true },
  { n: 'Period 5', start: '13:50', end: '14:40' }, { n: 'Period 6', start: '14:40', end: '15:30' },
];
const schoolCfg = () => {
  const s = D.settings.school = Object.assign({ on: true, bells: DEFAULT_BELLS.map(b => ({ ...b })), tt: {}, days: [1, 2, 3, 4, 5] }, D.settings.school || {});
  if (!s.bellsV2) { s.bellsV2 = true; s.bells = DEFAULT_BELLS.map(b => ({ ...b })); s.tt = {}; s.cycle = s.cycle || { len: 10, date: '2026-10-23', day: 5 }; }
  s.ttV2 = true;
  s.cycle = s.cycle || { len: 10, date: today(), day: 1 };
  return s;
};
// timetable day: Day 1..len counted over school weekdays from a known date, or the weekday when len is 0
function cycleDay(d) {
  const c = schoolCfg().cycle; if (!c.len) return 0;
  const days = schoolCfg().days, step = d >= c.date ? 1 : -1;
  let n = 0;
  for (let x = c.date; x !== d; x = addDays(x, step)) { const nx = addDays(x, step); if (days.includes(parseYmd(nx).getDay())) n += step; }
  return ((c.day - 1 + n) % c.len + c.len) % c.len + 1;
}
const ttKey = (d, i) => { const cd = cycleDay(d); return cd ? `D${cd}-${i}` : `${parseYmd(d).getDay()}-${i}`; };
const schoolLog = d => ((D.school = D.school || { log: {}, active: null }).log[d] = D.school.log[d] || {});
const isSchoolDay = d => { const s = schoolCfg(); return s.on && s.days.includes(parseYmd(d).getDay()) && !isHoliday(d); };
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; };
// subject for a period: today's override, else the weekly timetable
// planner events (like a music lesson) that fall inside a period
function periodEvents(d, b) {
  return agenda(d, d).filter(e => e.kind === 'event' && e.time && e.time < b.end && ((find('event', e.id) || {}).endTime || e.time) > b.start);
}
const evChips = (d, b) => periodEvents(d, b).map(e => { const ev = find('event', e.id) || {}; return `<span class="clsev">${esc(e.title)} ${fmtTime(e.time)}${ev.endTime ? '–' + fmtTime(ev.endTime) : ''}</span>`; }).join('');
function periodSubj(d, i) {
  const l = (D.school?.log?.[d] || {})[i];
  if (l && l.subj != null) return l.subj;
  return schoolCfg().tt[ttKey(d, i)] || '';
}
const subjLabel = id => id === 'free' ? 'Private study' : id === 'sport' ? 'Sport' : id ? subj(id).name : 'Pick a subject';
const subjColor = id => id === 'sport' ? '#f59f00' : id && id !== 'free' ? subj(id).color : '#868e96';
function currentPeriod() {
  const t = today(); if (!isSchoolDay(t)) return null;
  const m = nowMin(), bells = schoolCfg().bells;
  const i = bells.findIndex(b => hmToMin(b.start) <= m && m < hmToMin(b.end));
  return i < 0 ? null : { i, b: bells[i], left: hmToMin(bells[i].end) - m, len: hmToMin(bells[i].end) - hmToMin(bells[i].start) };
}
// periods today that are over (or running) and still need a rating
function unrated(d = today()) {
  if (!isSchoolDay(d)) return [];
  const m = d === today() ? nowMin() : 1e9, log = D.school?.log?.[d] || {};
  return schoolCfg().bells.map((b, i) => ({ b, i })).filter(({ b, i }) => !b.brk && hmToMin(b.end) <= m && !(log[i] && log[i].effort));
}
const clockTxt = cp => { const s = cp ? Math.max(0, Math.round(cp.left * 60)) : 0; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const periodCoins = r => r.effort + (r.phone ? 2 : 0) + (r.goal && r.goalMet ? 2 : 0);

function rateDay(d) {
  const log = schoolLog(d), bells = schoolCfg().bells, lessons = bells.map((b, i) => i).filter(i => !bells[i].brk);
  if (!lessons.every(i => log[i] && log[i].effort)) return;
  const avg = lessons.reduce((a, i) => a + eff10(log[i]), 0) / lessons.length;
  if (avg >= 7 && !(('clsday:' + d) in D.game.ledger)) {
    D.game.ledger['clsday:' + d] = 10;
    celebrate({ icon: '<span class="critbig">🏫</span>', color: '#3b5bdb', kicker: 'Full school day', title: 'Every period rated', text: `Average effort ${avg.toFixed(1)} out of 10. +10 ${COIN} bonus.` });
  }
}
function effortStreak() {
  let n = 0, d = today();
  if (!(('clsday:' + d) in D.game.ledger)) d = addDays(d, -1);
  for (let k = 0; k < 120; k++, d = addDays(d, -1)) {
    if (!isSchoolDay(d)) continue;
    if (('clsday:' + d) in D.game.ledger) n++; else break;
  }
  return n;
}

// ---------- class focus ----------
function startClass(i) {
  const t = today(), b = schoolCfg().bells[i];
  const goal = (document.getElementById('clsGoal')?.value || '').trim();
  D.school.active = { date: t, i, at: new Date().toISOString(), goal };
  const r = schoolLog(t)[i] = Object.assign(schoolLog(t)[i] || {}, { started: true, goal });
  if (r.subj == null) r.subj = periodSubj(t, i);
  save(); render();
  toast('🏫 Class focus on', `${b.n} ends at ${fmtTime(b.end)}. Phone away, eyes up.`);
}
function endClass(early) {
  const a = D.school.active; if (!a) return;
  D.school.active = null; save();
  openRating(a.date, a.i, early);
}
function openRating(d, i, early) {
  const b = schoolCfg().bells[i], r = schoolLog(d)[i] || {}, sid = r.subj != null ? r.subj : periodSubj(d, i);
  document.querySelectorAll('.clsfx').forEach(x => x.remove());
  const ov = document.createElement('div'); ov.className = 'treefx clsfx';
  ov.innerHTML = `<div class="treecard clsrate" style="--c:${subjColor(sid)}">
    <button class="iconbtn tc-close" data-x title="Later">✕</button>
    <div class="unlabel">${esc(b.n)} · ${fmtTime(b.start)}–${fmtTime(b.end)}</div>
    <h2 style="margin:4px 0 2px">How was your effort in ${esc(subjLabel(sid))}?</h2>
    ${r.goal ? `<p class="muted" style="margin:0">Your goal: <b>${esc(r.goal)}</b></p>` : ''}
    <div class="efforts10">${Array.from({ length: 10 }, (_, k) => `<button data-e="${k + 1}" class="${eff10(r) === k + 1 ? 'on' : ''}" style="--ec:${effColor(k + 1)}">${k + 1}</button>`).join('')}</div>
    <div class="efflabel" id="effLabel">${eff10(r) ? `${effIcon(eff10(r))} ${EFFORT[Math.ceil(eff10(r) / 2) - 1][1]}` : 'Pick a number from 1 (switched off) to 10 (locked in)'}</div>
    <label class="clschk"><input type="checkbox" id="clsPhone" ${r.phone ? 'checked' : ''}> 📵 My phone stayed away <span class="muted">+2 ${COIN}</span></label>
    ${r.goal ? `<label class="clschk"><input type="checkbox" id="clsMet" ${r.goalMet ? 'checked' : ''}> 🎯 I hit my goal <span class="muted">+2 ${COIN}</span></label>` : ''}
    <input type="text" id="clsHw" placeholder="Homework or something to remember? (adds a task due tomorrow)" maxlength="200">
    <div class="row" style="justify-content:flex-end;margin-top:10px"><span class="muted small-text" style="margin-right:auto">Effort pays 1 to 5 ${COIN}. Be honest, it's only for you.</span>
      <button class="btn primary" data-save disabled>Save</button></div></div>`;
  document.body.appendChild(ov);
  let pick = eff10(r);
  const saveBtn = ov.querySelector('[data-save]'); saveBtn.disabled = !pick;
  ov.addEventListener('click', e => {
    const eb = e.target.closest('[data-e]');
    if (eb) { pick = +eb.dataset.e; ov.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('on', x === eb)); ov.querySelector('#effLabel').textContent = `${effIcon(pick)} ${pick}/10 · ${EFFORT[Math.ceil(pick / 2) - 1][1]}`; saveBtn.disabled = false; return; }
    if (e.target.closest('[data-x]') || e.target === ov) { ov.remove(); render(); return; }
    if (e.target.closest('[data-save]') && pick) {
      const rec = schoolLog(d)[i] = Object.assign(schoolLog(d)[i] || {}, { subj: sid, effort: Math.ceil(pick / 2), e10: pick, phone: ov.querySelector('#clsPhone').checked, goalMet: !!ov.querySelector('#clsMet')?.checked, at: new Date().toISOString() });
      const hw = ov.querySelector('#clsHw').value.trim();
      if (hw) D.todos.push({ id: uid(), text: `${sid && sid !== 'free' && sid !== 'sport' ? subj(sid).name + ': ' : ''}${hw}`, due: addDays(d, 1), done: false, notes: `From ${b.n}`, remind: D.settings.remind.todo });
      const c = periodCoins(rec), first = !(`cls:${d}:${i}` in D.game.ledger);
      D.game.ledger[`cls:${d}:${i}`] = c;
      ov.remove(); save(); render();
      if (first) coinPop(c);
      toast(`${effIcon(pick)} ${b.n}: ${pick}/10 saved`, `+${c} ${COIN}${hw ? ' · homework added to tasks' : ''}`);
      rateDay(d); save(); updateSchoolBadge();
    }
  });
}
function coinPop(n) {
  const el = document.createElement('div'); el.className = 'coinpop'; el.textContent = `+${n} ${COIN}`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
}

// ---------- bell watcher ----------
function checkBells() {
  if (!D || !D.settings) return;
  const t = today(), a = D.school?.active;
  if (a) {
    const b = schoolCfg().bells[a.i];
    if (a.date !== t || !b || nowMin() >= hmToMin(b.end)) {
      D.school.active = null; save();
      notify('🔔 Bell', `${b ? b.n : 'Class'} is over. How was your effort?`, 'cls');
      render();
      if (document.visibilityState === 'visible' && !modal.open) openRating(a.date, a.i);
    }
  } else if (isSchoolDay(t)) {
    // a gentle nudge at the end of any lesson that wasn't in class mode
    for (const { b, i } of unrated(t)) {
      const key = `cls:n:${t}:${i}`, late = nowMin() - hmToMin(b.end);
      if (late < 5 && !D.fired[key]) { D.fired[key] = Date.now(); save(); notify('🔔 ' + b.n + ' is over', 'Rate your effort for a few coins.', 'cls'); }
    }
  }
  if (view === 'school') {
    const el = document.getElementById('clsClock'), cp = currentPeriod();
    const key = cp ? cp.i : -1;
    if (key !== shownPeriod && !modal.open && !document.querySelector('.clsfx')) { render(); return; }
    if (el && cp) { el.textContent = clockTxt(cp); const bar = document.getElementById('clsBar'); if (bar) bar.style.width = `${100 * (1 - cp.left / cp.len)}%`; }
  }
  updateSchoolBadge();
}
function updateSchoolBadge() {
  const b = document.querySelector('#tabs button[data-view="school"]'); if (!b || !D.settings) return;
  b.dataset.badge = unrated().length || (D.school?.active ? '●' : '');
}
setInterval(checkBells, 1000);

// ---------- the page ----------
function weekEffort() {
  const from = mondayOf(today()), rows = {};
  for (let d = from; d <= today(); d = addDays(d, 1)) for (const [i, r] of Object.entries(D.school?.log?.[d] || {})) {
    if (!r.effort) continue;
    const k = r.subj || ''; (rows[k] = rows[k] || []).push(eff10(r));
  }
  return Object.entries(rows).map(([k, v]) => ({ k, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).sort((a, b) => b.avg - a.avg);
}
function subjSelect(d, i, sid) {
  return `<select data-clsch="subj" data-i="${i}" class="clssel">${[['', 'Pick a subject'], ...D.subjects.map(s => [s.id, s.name]), ['free', 'Private study'], ['sport', 'Sport']].map(([v, l]) => `<option value="${v}" ${v === sid ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
let shownPeriod = -2;
function viewSchool() {
  const t = today(), cfg = schoolCfg(), log = D.school?.log?.[t] || {}, a = D.school?.active, cp = currentPeriod();
  shownPeriod = cp ? cp.i : -1;
  const earned = Object.entries(D.game.ledger).filter(([k]) => k.startsWith('cls')).reduce((s, [, v]) => s + v, 0);
  const streak = effortStreak();
  const cd = isSchoolDay(t) ? cycleDay(t) : 0;
  const head = pageHead('🏫 Class mode' + (cd ? ` <span class="pill">Day ${cd}</span>` : ''), 'A focus timer for every period, then rate your effort when the bell goes.',
    `<span class="pill">${COIN} ${earned} from class</span>${streak ? `<span class="pill">🔥 ${streak}-day effort streak</span>` : ''}`);
  if (!cfg.on) return `${head}<div class="card"><p>Class mode is off.</p><button class="btn primary" data-cls="on">Turn it on</button></div>${bellCard()}`;
  let hero;
  if (!isSchoolDay(t)) {
    let nd = addDays(t, 1); for (let k = 0; k < 60 && !isSchoolDay(nd); k++) nd = addDays(nd, 1);
    hero = `<div class="card clshero off"><div class="unlabel">${isHoliday(t) ? 'Holiday' : 'No school today'}</div><h2>Enjoy the day off</h2><p class="muted">Next school day: ${fullDate(nd)}.</p></div>`;
  } else if (cp && cp.b.brk) {
    hero = `<div class="card clshero brk"><div class="unlabel">${esc(cp.b.n)}</div><div class="clsclock" id="clsClock">${clockTxt(cp)}</div><div class="clsbar"><i id="clsBar" style="width:${100 * (1 - cp.left / cp.len)}%"></i></div><p class="muted">Have a break. Get some water and move around.</p></div>`;
  } else if (cp) {
    const sid = periodSubj(t, cp.i), on = a && a.i === cp.i && a.date === t, r = log[cp.i] || {};
    hero = `<div class="card clshero ${on ? 'live' : ''}" style="--c:${subjColor(sid)}">
      <div class="row"><div class="unlabel">${esc(cp.b.n)} · until ${fmtTime(cp.b.end)}</div><span style="flex:1"></span>${subjSelect(t, cp.i, sid)}</div>
      <h2 class="clssubj">${esc(subjLabel(sid))}</h2>${evChips(t, cp.b) ? `<div class="clsevs">${evChips(t, cp.b)}</div>` : ''}
      <div class="clsclock" id="clsClock">${clockTxt(cp)}</div><div class="clsbar"><i id="clsBar" style="width:${100 * (1 - cp.left / cp.len)}%"></i></div>
      ${on ? `<div class="clslive">${r.goal ? `🎯 <b>${esc(r.goal)}</b>` : 'In class focus'} · 📵 phone away</div>
          <div class="row" style="justify-content:center"><button class="btn" data-cls="end">End early and rate</button></div>`
        : r.effort ? `<p class="muted" style="text-align:center">Rated ${effIcon(eff10(r))} ${eff10(r)}/10 already.</p>`
          : `<div class="row clsstart"><input type="text" id="clsGoal" placeholder="Lesson goal (optional), e.g. finish Q1 to 8" maxlength="120"><button class="btn primary" data-cls="start" data-i="${cp.i}">▶ Start class focus</button></div>`}
    </div>`;
  } else {
    const m = nowMin(), next = cfg.bells.find(b => hmToMin(b.start) > m);
    hero = `<div class="card clshero off"><div class="unlabel">${next ? 'Before school' : 'School\'s out'}</div><h2>${next ? `${esc(next.n)} starts at ${fmtTime(next.start)}` : 'Nice work today'}</h2>
      ${next ? '' : `<p class="muted">${unrated().length ? `${unrated().length} period${unrated().length === 1 ? '' : 's'} still to rate below.` : 'Every period is rated.'}</p>`}</div>`;
  }
  const m = nowMin();
  const rows = isSchoolDay(t) ? cfg.bells.map((b, i) => {
    if (b.brk) return `<div class="clsrow brk"><span class="clstime">${fmtTime(b.start)}</span><span class="muted">${esc(b.n)}</span></div>`;
    const sid = periodSubj(t, i), r = log[i] || {}, over = hmToMin(b.end) <= m, now = cp && cp.i === i;
    const right = r.effort ? `<span class="clsdone" title="${EFFORT[r.effort - 1][1]}">${effIcon(eff10(r))} ${eff10(r)}/10 +${D.game.ledger[`cls:${t}:${i}`] || 0} ${COIN}</span>${r.phone ? '<span title="Phone away">📵</span>' : ''}<button class="iconbtn" data-cls="rate" data-i="${i}" title="Change rating">✎</button>`
      : over ? `<button class="btn small primary" data-cls="rate" data-i="${i}">Rate effort</button>` : now ? '<span class="tag green">Now</span>' : '';
    return `<div class="clsrow ${now ? 'now' : ''} ${over && !r.effort ? 'due' : ''}" style="--c:${subjColor(sid)}"><span class="clstime">${fmtTime(b.start)}</span><b class="clsn">${esc(b.n)}</b>${subjSelect(t, i, sid)}${evChips(t, b)}<span style="flex:1"></span>${right}</div>`;
  }).join('') : '';
  const wk = weekEffort();
  const week = wk.length ? `<div class="card"><h2>Effort this week</h2><div class="bars">${wk.map(w => `<div class="bar"><span>${esc(w.k ? subjLabel(w.k) : 'No subject set')}</span><div class="track"><div class="fill" style="width:${w.avg / 10 * 100}%;background:${subjColor(w.k)}"></div></div><span class="muted">${effIcon(Math.round(w.avg))} ${w.avg.toFixed(1)}/10 · ${w.n}</span></div>`).join('')}</div>
    <p class="muted small-text" style="margin:8px 0 0">Average effort out of 10 for each subject since Monday.</p></div>` : '';
  return `${head}<div class="clsgrid"><div>${hero}${rows ? `<div class="card"><div class="card-head"><h2>Today's periods</h2></div>${rows}
      <p class="muted small-text" style="margin:8px 0 0">The subject you pick is remembered for ${cd ? `Day ${cd} of your timetable` : 'this day of the week'}. Rate each period out of 10: up to 5 ${COIN} for effort, +2 for phone away, +2 for hitting your goal. Rate every period with an average of 7+ for a +10 ${COIN} day bonus.</p></div>` : ''}</div>
    <div>${week}${bellCard()}</div></div>`;
}
function bellCard() {
  const cfg = schoolCfg(), names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<div class="card"><details ${ui.bellsOpen ? 'open' : ''} data-cls-det><summary><b>Bell times</b> <span class="muted small-text">check these match your school</span></summary>
    ${cfg.bells.map((b, i) => `<div class="row bellrow"><input type="text" value="${esc(b.n)}" data-clsch="bn" data-i="${i}"><input type="time" value="${b.start}" data-clsch="bs" data-i="${i}"><input type="time" value="${b.end}" data-clsch="be" data-i="${i}">
      <label class="small-text"><input type="checkbox" data-clsch="bb" data-i="${i}" ${b.brk ? 'checked' : ''}> break</label><button class="iconbtn" data-cls="bdel" data-i="${i}" title="Remove">✕</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button class="btn small" data-cls="badd">+ Period</button><button class="btn small" data-cls="breset">Reset</button><span style="flex:1"></span>
      <span class="catchips">${[1, 2, 3, 4, 5].map(k => `<button class="cchip ${cfg.days.includes(k) ? 'on' : ''}" data-cls="day" data-i="${k}">${names[k]}</button>`).join('')}</span>
      <label class="small-text"><input type="checkbox" data-clsch="on" ${cfg.on ? 'checked' : ''}> On</label></div>
    <div class="row" style="margin-top:10px;gap:8px"><span class="small-text">Timetable</span><select data-clsch="clen" style="width:auto">${[[0, 'Same every week'], [5, '5-day cycle'], [10, '10-day cycle']].map(([v, l]) => `<option value="${v}" ${+cfg.cycle.len === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${cfg.cycle.len && isSchoolDay(today()) ? `<span class="small-text">Today is</span><select data-clsch="cday" style="width:auto">${Array.from({ length: cfg.cycle.len }, (_, k) => `<option value="${k + 1}" ${cycleDay(today()) === k + 1 ? 'selected' : ''}>Day ${k + 1}</option>`).join('')}</select>` : ''}</div></details></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-cls]'); if (!el || !D) return;
  const cfg = schoolCfg(), i = +el.dataset.i;
  switch (el.dataset.cls) {
    case 'start': startClass(i); break;
    case 'end': endClass(true); break;
    case 'rate': openRating(today(), i); break;
    case 'on': cfg.on = true; save(); render(); break;
    case 'badd': { const last = cfg.bells[cfg.bells.length - 1]; const s = last ? last.end : '15:00'; const e2 = Math.min(1439, hmToMin(s) + 50); cfg.bells.push({ n: `Period ${cfg.bells.filter(b => !b.brk).length + 1}`, start: s, end: `${String(Math.floor(e2 / 60)).padStart(2, '0')}:${String(e2 % 60).padStart(2, '0')}` }); ui.bellsOpen = true; save(); render(); break; }
    case 'bdel': cfg.bells.splice(i, 1); ui.bellsOpen = true; save(); render(); break;
    case 'breset': if (confirm('Reset bell times to the defaults?')) { cfg.bells = DEFAULT_BELLS.map(b => ({ ...b })); ui.bellsOpen = true; save(); render(); } break;
    case 'day': cfg.days = cfg.days.includes(i) ? cfg.days.filter(x => x !== i) : [...cfg.days, i]; ui.bellsOpen = true; save(); render(); break;
  }
});
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset?.clsch; if (!k || !D) return;
  const cfg = schoolCfg(), i = +el.dataset.i, t = today();
  if (k === 'subj') {
    cfg.tt[ttKey(t, i)] = el.value;
    const r = schoolLog(t)[i]; if (r) r.subj = el.value;
    save(); render(); return;
  }
  if (k === 'clen') cfg.cycle.len = +el.value;
  else if (k === 'cday') cfg.cycle = { len: cfg.cycle.len, date: t, day: +el.value };
  else if (k === 'on') cfg.on = el.checked;
  else if (k === 'bn') cfg.bells[i].n = el.value.trim() || cfg.bells[i].n;
  else if (k === 'bs' && el.value) cfg.bells[i].start = el.value;
  else if (k === 'be' && el.value) cfg.bells[i].end = el.value;
  else if (k === 'bb') cfg.bells[i].brk = el.checked;
  if (k === 'bs' || k === 'be') cfg.bells.sort((a, b) => a.start.localeCompare(b.start));
  ui.bellsOpen = true; save(); render();
});

// small banner for the Today page during school hours
function schoolBanner() {
  if (!D.settings.school?.on && D.settings.school) return '';
  const cp = currentPeriod(), n = unrated().length;
  if (!cp && !n) return '';
  const sid = cp && !cp.b.brk ? periodSubj(today(), cp.i) : '';
  const txt = cp ? (cp.b.brk ? `${esc(cp.b.n)} until ${fmtTime(cp.b.end)}` : `Now: <b>${esc(cp.b.n)}</b> · ${esc(subjLabel(sid))} · ${Math.ceil(cp.left)} min left`) : '';
  return `<div class="card clsbanner" style="--c:${subjColor(sid)}">🏫 ${txt}${txt && n ? ' · ' : ''}${n ? `${n} period${n === 1 ? '' : 's'} to rate` : ''}<span style="flex:1"></span><button class="btn small primary" data-act="goSchool">Class mode</button></div>`;
}
