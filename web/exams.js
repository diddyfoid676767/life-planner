'use strict';
/* Exam countdowns: a card for each exam coming up, an exam-eve checklist on
   Today, and reminders to keep the study streak going. (The exam timetable
   builder and the study blocks were removed in 2.56.) */

const isExam = a => /exam/i.test(a.type || '') && a.type !== 'Practice exam';
function upcomingExams(from = today(), days = 60) {
  return D.assessments.filter(a => isExam(a) && !a.done && a.date >= from && diffDays(from, a.date) <= days).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
// the countdown cards on the Study page
function examHub() {
  const exams = upcomingExams();
  if (!exams.length) return '';
  const t = today();
  const cards = exams.map(a => {
    const s = subj(a.subjectId), dd = diffDays(t, a.date);
    return `<div class="examcard ${dd <= 1 ? 'soon' : ''}" style="--c:${s.color}">
      <div class="ex-top"><div class="ex-days"><b>${dd === 0 ? 'Today' : dd}</b>${dd ? `<span>day${dd === 1 ? '' : 's'}</span>` : ''}</div>
        <div class="main"><div class="ex-subj">${esc(s.name)}</div><div class="ex-title">${esc(a.title)}</div><div class="muted small-text">${longDay(a.date)} ${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}</div></div></div>
      ${dd === 1 ? `<div class="ex-eve">🌙 Tomorrow! Light review only, then an early night.</div>` : ''}
      </div>`;
  }).join('');
  return `<div class="card examhub"><div class="card-head"><h2>🎓 Exam countdown</h2><span class="muted small-text">${exams.length} exam${exams.length === 1 ? '' : 's'} · the first is ${relDays(diffDays(t, exams[0].date))}</span></div>
    <div class="examcards">${cards}</div></div>`;
}
// a card on Today the day before an exam
function examEveCard() {
  const tm = addDays(today(), 1), xs = D.assessments.filter(a => isExam(a) && !a.done && a.date === tm);
  if (!xs.length) return '';
  const calc = xs.some(a => /exam 2|cas/i.test(a.title)), noCalc = xs.some(a => /exam 1|tech.?free/i.test(a.title));
  const items = ['Light review only, no new papers', `Pack pens, pencils, ruler${calc ? ', CAS calculator (charged) and bound reference' : ''}${noCalc && !calc ? ' (no calculator for tech-free)' : ''}`, 'Student ID and a clear water bottle', `Bed by ${fmtTime(bedCfg().time)}`];
  return `<div class="card exameve"><div class="card-head"><h2>🌙 Exam tomorrow</h2></div>
    <div class="small-text"><b>${xs.map(a => `${esc(subj(a.subjectId).name)} ${esc(a.title)}${a.time ? ' at ' + fmtTime(a.time) : ''}`).join(' and ')}</b></div>
    <ul class="evelist">${items.map(i => `<li>✓ ${esc(i)}</li>`).join('')}</ul></div>`;
}

// ---------- reminders: study nudge, streak at risk, exam eve ----------
const nudgeCfg = () => Object.assign({ study: true, studyTime: '17:30', streak: true, streakTime: '20:30', eve: true }, D.settings.nudges || {});
function checkNudges() {
  if (!D || !D.settings || ONLINE) return;
  const n = nudgeCfg(), t = today(), now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
  const studied = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0);
  const free = (typeof isHoliday === 'function' && isHoliday(t) && !upcomingExams(t, 21).length) || (typeof isRestDay === 'function' && isRestDay(t));
  const fire = (key, title, body) => { if (D.fired[key]) return; D.fired[key] = Date.now(); save(); notify(title, body, key.split(':')[0]); };
  if (n.study && !free && cur >= hmToMin(n.studyTime) && cur < hmToMin(n.studyTime) + 180 && studied === 0) {
    const ex = upcomingExams(t, 30)[0];
    if (ex) fire('nudge:' + t, '📚 Time to study', `${subj(ex.subjectId).name} ${ex.title} is ${relDays(diffDays(t, ex.date))}.`);
  }
  if (n.streak && !free && cur >= hmToMin(n.streakTime) && cur < 23 * 60 + 30 && studied < 30) {
    const s = studyStreak();
    if (s > 0) fire('streak:' + t, `🔥 Your ${s}-day streak is at risk`, `Study ${30 - studied} more minute${30 - studied === 1 ? '' : 's'} before midnight to keep it.`);
  }
  if (n.eve && now.getHours() >= 19) {
    const xs = D.assessments.filter(a => isExam(a) && !a.done && a.date === addDays(t, 1));
    if (xs.length) fire('eve:' + t, '🌙 Exam tomorrow', `${xs.map(a => `${subj(a.subjectId).name} ${a.title}${a.time ? ' at ' + fmtTime(a.time) : ''}`).join(', ')}. Light review only, pack your things tonight, and get to bed by ${fmtTime(bedCfg().time)}.`);
  }
}
setInterval(checkNudges, 60000);
function nudgeRow() {
  const n = nudgeCfg();
  const row = (k, label, tk) => `<div class="row bedrow"><label><input type="checkbox" data-nudge="${k}" ${n[k] ? 'checked' : ''}> ${label}</label>${tk ? `<input type="time" value="${n[tk]}" data-nudget="${tk}" style="width:auto">` : ''}</div>`;
  return `<h3 style="margin:14px 0 6px">📣 Study reminders</h3>
    ${row('study', "Nudge me if I haven't studied by", 'studyTime')}${row('streak', 'Warn me when my streak is at risk at', 'streakTime')}${row('eve', 'Exam-eve checklist the night before each exam')}
    <p class="muted small-text" style="margin:6px 0 0">Your streak counts days with 30+ minutes of study. Holidays and rest days don't break it.</p>`;
}
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset?.nudge) { D.settings.nudges = { ...nudgeCfg(), [el.dataset.nudge]: el.checked }; save(); }
  if (el.dataset?.nudget && el.value) { D.settings.nudges = { ...nudgeCfg(), [el.dataset.nudget]: el.value }; save(); }
});

