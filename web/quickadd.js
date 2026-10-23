'use strict';
/* Smart quick add: type something like "Biology SAC next Thursday 9am" or
   "dentist 3 Nov 4pm" and it works out what it is (SAC, event, deadline,
   workout or task), the subject, the date and the time, then opens the
   usual form filled in so you can check it and press Save. */

const QA_DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const QA_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function qaDate(text) {
  const t = today(), low = text.toLowerCase();
  let m, date = '', span = null;
  const take = (re, fn) => { if (date) return; const x = re.exec(low); if (x) { const d = fn(x); if (d) { date = d; span = x[0]; } } };
  take(/\b(today|tonight)\b/, () => t);
  take(/\b(tomorrow|tmrw|tmr|tomoz)\b/, () => addDays(t, 1));
  take(/\bin (\d{1,2}|a|one|two|three) (day|days|week|weeks)\b/, x => { const n = { a: 1, one: 1, two: 2, three: 3 }[x[1]] || +x[1]; return addDays(t, /week/.test(x[2]) ? n * 7 : n); });
  take(/\b(next|this|on)?\s*(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b(\s+week)?/, x => {
    const want = QA_DOW.indexOf(x[2].slice(0, 3)); const cur = parseYmd(t).getDay();
    let diff = (want - cur + 7) % 7 || 7;
    if (x[3] || (x[1] === 'next' && diff < 3)) diff += 7; // "next Mon" said on a Sat, or "Thursday week"
    return addDays(t, diff);
  });
  take(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/, x => qaYmd(+x[1], QA_MON.indexOf(x[2])));
  take(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/, x => qaYmd(+x[2], QA_MON.indexOf(x[1])));
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, x => qaYmd(+x[1], +x[2] - 1, x[3]));
  return { date, span };
}
function qaYmd(d, mon, y) {
  if (mon < 0 || mon > 11 || d < 1 || d > 31) return '';
  const now = parseYmd(today());
  let year = y ? (+y < 100 ? 2000 + +y : +y) : now.getFullYear();
  let dt = new Date(year, mon, d);
  if (!y && dt < new Date(now.getFullYear(), now.getMonth(), now.getDate())) dt = new Date(year + 1, mon, d);
  return ymd(dt);
}
function qaTime(text) {
  const low = text.toLowerCase();
  let x = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b(?:\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/.exec(low);
  const hm = (h, mi, ap) => { h = +h % 12 + (ap === 'pm' ? 12 : 0); return `${String(h).padStart(2, '0')}:${String(+mi || 0).padStart(2, '0')}`; };
  if (x) return { time: hm(x[1], x[2], x[3]), end: x[4] ? hm(x[4], x[5], x[6] || x[3]) : '', span: x[0] };
  x = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(low);
  if (x) return { time: `${x[1].padStart(2, '0')}:${x[2]}`, end: '', span: x[0] };
  x = /\bat\s+(\d{1,2})\b/.exec(low);
  if (x && +x[1] >= 1 && +x[1] <= 12) { const h = +x[1] < 7 ? +x[1] + 12 : +x[1]; return { time: `${String(h).padStart(2, '0')}:00`, end: '', span: x[0] }; }
  return { time: '', end: '', span: null };
}

function parseQuick(raw) {
  const text = raw.trim();
  const { date, span: dSpan } = qaDate(text), { time, end, span: tSpan } = qaTime(text);
  const low = text.toLowerCase();
  const subj = typeof inboxSubject === 'function' ? inboxSubject(text) : null;
  let kind = 'todo', type = '', category = '';
  if (/\b(sac|exam|test|quiz|assessment|assignment|oral|presentation|essay|practice exam|trial exam|mock)\b/.test(low) && !/\b(study|revise|revision)\b/.test(low.replace(/\bstudy design\b/, ''))) {
    kind = 'assessment';
    type = /practice exam|trial exam|mock/.test(low) ? 'Practice exam' : /\bexam\b/.test(low) ? 'Exam' : /\b(test|quiz)\b/.test(low) ? 'Test' : /\b(assignment|essay|presentation|oral)\b/.test(low) ? 'Assignment' : 'SAC';
  } else if (/\b(study|revise|revision|homework)\b/.test(low) && subj && time) kind = 'session';
  else if (/\b(run|jog|gym|swim|ride|cycle|training|footy|basketball|netball|soccer|tennis|sprints?|workout|yoga|pilates)\b/.test(low) && !/\b(party|birthday)\b/.test(low)) kind = 'workout';
  else if (/\b(due|deadline|hand in|submit|by)\b/.test(low) && date) { kind = 'event'; category = 'Deadline'; }
  else if (/\b(birthday|bday)\b/.test(low)) { kind = 'event'; category = 'Birthday'; }
  else if (date && (time || /\b(appointment|dentist|doctor|physio|party|excursion|camp|meeting|interview|concert|game|match|carnival|formal|trip|dinner|movie|holiday)\b/.test(low))) {
    kind = 'event'; category = /\b(excursion|camp|school|formal|interview|parent|teacher)\b/.test(low) ? 'School' : /\b(dentist|doctor|physio|appointment)\b/.test(low) ? 'Appointment' : /\b(party|dinner|movie|concert)\b/.test(low) ? 'Social' : 'Personal';
  }
  // the title is what's left once the date and time words are taken out
  let title = text;
  for (const sp of [dSpan, tSpan]) if (sp) title = title.replace(new RegExp(sp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  title = title.replace(/\b(on|at|by|due)\s*$/i, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { kind, type, category, date, time, end, subjectId: subj?.id || '', subject: subj?.name || '', title };
}

const QA_LABEL = { assessment: '📝 SAC / exam', session: '📚 Study block', workout: '🏃 Workout', event: '📅 Event', todo: '✅ Task' };
function quickPreview(q) {
  const bits = [QA_LABEL[q.kind] + (q.type && q.type !== 'SAC' ? ` (${q.type})` : '') + (q.category && q.category !== 'Personal' ? ` · ${q.category}` : ''), q.subject && `📚 ${q.subject}`, q.date ? `📆 ${fmtDate(q.date)} (${relDays(diffDays(today(), q.date))})` : (q.kind === 'todo' ? 'no due date' : '📆 pick a date'), q.time && `🕒 ${fmtTime(q.time)}${q.end ? '–' + fmtTime(q.end) : ''}`].filter(Boolean);
  return bits.map(b => `<span class="qa-chip">${esc(b)}</span>`).join('');
}
function quickAddHtml() {
  return `<div class="card quickadd"><form id="qaForm" class="qa-row" autocomplete="off"><span class="qa-ic">✨</span>
      <input id="qaInput" placeholder='Quick add: "Biology SAC next Thursday 9am", "dentist 3 Nov 4pm", "run tomorrow 7am"' maxlength="200">
      <button class="btn primary">Add</button></form><div class="qa-prev" id="qaPrev"></div></div>`;
}
function quickAdd(text) {
  const q = parseQuick(text); if (!q.title) return;
  const pre = { date: q.date };
  if (q.kind === 'assessment') pre.fill = { title: q.title, type: q.type, time: q.time, ...(q.subjectId ? { subjectId: q.subjectId } : {}) };
  else if (q.kind === 'session') pre.fill = { topic: q.title, time: q.time, ...(q.subjectId ? { subjectId: q.subjectId } : {}) };
  else if (q.kind === 'workout') pre.fill = { title: q.title, time: q.time };
  else if (q.kind === 'event') { pre.category = q.category || 'Personal'; pre.fill = { title: q.title, time: q.time, endTime: q.end }; }
  else pre.fill = { text: q.title, due: q.date };
  const before = D.assessments.length;
  editors[q.kind](null, pre);
  const inp = document.getElementById('qaInput'); if (inp) inp.value = '';
  const prev = document.getElementById('qaPrev'); if (prev) prev.innerHTML = '';
  if (q.kind === 'assessment') {
    // after it's saved, offer a revision plan
    const once = () => {
      modal.removeEventListener('close', once);
      const a = D.assessments.length > before && D.assessments[D.assessments.length - 1];
      if (a && a.date > today() && confirm(`Plan revision sessions for "${a.title}" before ${fmtDate(a.date)}?`)) planStudy(a.id);
    };
    modal.addEventListener('close', once);
  }
}
document.addEventListener('input', e => {
  if (e.target.id !== 'qaInput') return;
  const v = e.target.value.trim(), prev = document.getElementById('qaPrev');
  if (prev) prev.innerHTML = v.length > 2 ? quickPreview(parseQuick(v)) : '';
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'qaForm') return;
  e.preventDefault();
  const v = document.getElementById('qaInput').value.trim();
  if (v) quickAdd(v);
});
// press "/" anywhere to jump to quick add
document.addEventListener('keydown', e => {
  if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || modal.open) return;
  const inp = document.getElementById('qaInput');
  if (inp) { e.preventDefault(); inp.focus(); }
  else { e.preventDefault(); view = 'today'; render(); setTimeout(() => document.getElementById('qaInput')?.focus(), 50); }
});
