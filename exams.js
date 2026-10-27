'use strict';
/* Exam lead-up: a countdown card for each exam, a revision plan that mixes
   timed past papers with topic blocks (and works around SACs and tests), a
   mistake log that steers the next blocks toward your weak topics, a light
   taper day before each exam, and reminders to keep the streak going. */

const EXAM_TOPICS = [
  [/method|math/i, ['Functions & graphs', 'Transformations', 'Differentiation', 'Integration', 'Exponentials & logs', 'Circular (trig) functions', 'Discrete probability', 'Binomial & normal distributions', 'Algebra & equations']],
  [/physic/i, ['Motion & kinematics', 'Forces & Newton\'s laws', 'Energy & momentum', 'Electricity & circuits', 'Fields (gravity, electric, magnetic)', 'Light & waves', 'Practical skills & data analysis']],
  [/english|literature/i, ['Text response essay', 'Analysing argument', 'Creating texts', 'Quote bank & evidence', 'Essay planning under time']],
  [/media/i, ['Narrative & ideology', 'Media & change', 'Agency & control', 'Key terms & examples', 'Extended response structure']],
  [/bio/i, ['Cells & membranes', 'Genetics & DNA', 'Enzymes & biochemistry', 'Immunity & disease', 'Evolution', 'Experimental design']],
  [/chem/i, ['Stoichiometry', 'Organic chemistry', 'Equilibrium', 'Redox & electrochemistry', 'Analysis techniques']],
  [/business/i, ['Key terms & definitions', 'Case study application', 'Extended response', 'Operations & strategy']],
];
// filled in place, so a settings object you're holding stays the live one
const EXAM_PREP_DEFAULTS = { hoursSchool: 2, hoursWeekend: 4, schoolStart: '17:00', weekendStart: '09:30', perExam: 3, blockMins: 45, breakMins: 10 };
function examPrep() {
  const P = D.examPrep = D.examPrep || {};
  for (const [k, v] of Object.entries(EXAM_PREP_DEFAULTS)) if (P[k] == null) P[k] = v;
  if (!Array.isArray(P.papers)) P.papers = [];
  if (!P.off || typeof P.off !== 'object') P.off = {};
  return P;
}
// 2.28: hours and a start time for each day of the week (Sunday first), and
// one-off changes for single dates (off: { date: { h, start, note } }, h 0 = can't study)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function planWeek(P = examPrep()) {
  if (!Array.isArray(P.days) || P.days.length !== 7) P.days = DAY_NAMES.map((_, i) => i === 0 || i === 6 ? { h: P.hoursWeekend, start: P.weekendStart } : { h: P.hoursSchool, start: P.schoolStart });
  return P.days;
}
// how long you can study on a date and from when; holidays use Saturday's hours
function dayPlan(d) {
  const P = examPrep(), dow = parseYmd(d).getDay(), wk = planWeek(P), o = (P.off || {})[d];
  const base = typeof isHoliday === 'function' && isHoliday(d) && dow > 0 && dow < 6 ? wk[6] : wk[dow];
  return o ? { h: +o.h || 0, start: o.start || base.start, note: o.note || '', off: !(+o.h), custom: true } : { h: +base.h || 0, start: base.start, off: !(+base.h) };
}
const dayCapMins = d => Math.round(dayPlan(d).h * 60);
// the subjects the exam plan covers (all with an exam coming up, unless you picked some)
const planExams = from => upcomingExams(from).filter(a => !Array.isArray(examPrep().subjects) || examPrep().subjects.includes(a.subjectId));
const isExam = a => /exam/i.test(a.type || '') && a.type !== 'Practice exam';
function upcomingExams(from = today(), days = 60) {
  return D.assessments.filter(a => isExam(a) && !a.done && a.date >= from && diffDays(from, a.date) <= days).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
function subjectTopics(sid) {
  const name = subj(sid).name || '';
  const pack = typeof revisionFor === 'function' && revisionFor(sid);
  const base = pack ? pack.topics.map(t => t.t) : (EXAM_TOPICS.find(([re]) => re.test(name)) || [, ['Key concepts', 'Practice questions', 'Extended response']])[1];
  const own = examPrep().papers.filter(p => p.subjectId === sid).flatMap(p => p.topics || []);
  return [...new Set([...own, ...base])];
}
// topics you lost marks on, most often (and most recently) first
function weakTopics(sid) {
  const score = {};
  for (const p of examPrep().papers.filter(p => p.subjectId === sid)) {
    const age = Math.max(0, diffDays(p.date, today()));
    for (const t of p.topics || []) score[t] = (score[t] || 0) + 1 / (1 + age / 14);
  }
  // shaky topics and missed practice questions from the subject's revision tab count too
  if (typeof revWeak === 'function') for (const [t, w] of Object.entries(revWeak(sid))) score[t] = (score[t] || 0) + w * .6;
  return Object.entries(score).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
// how long a full paper takes, including reading time
function paperMins(a) {
  const s = (subj(a.subjectId).name || '') + ' ' + a.title;
  if (/exam 1|tech.?free/i.test(s)) return 75;
  if (/english|literature/i.test(s)) return 195;
  if (/physic|chem|bio/i.test(s)) return 165;
  return 135;
}
const TAPER = [[/exam 2|cas/i, 'Light review: check your bound reference and calculator programs'], [/exam 1|tech.?free/i, 'Light review: formulas and a few quick tech-free questions'], [/english|literature/i, 'Light review: quotes, essay plans and key ideas'], [/./, 'Light review: summary notes and past mistakes. No new papers']];
const taperText = a => TAPER.find(([re]) => re.test((subj(a.subjectId).name || '') + ' ' + a.title))[1];

function examReadiness(a) {
  const t = today(), plan = D.sessions.filter(s => s.assessmentId === a.id);
  const due = plan.filter(s => s.date < t || s.done), done = due.filter(s => s.done).length;
  const papers = examPrep().papers.filter(p => p.assessmentId === a.id);
  const target = Math.max(1, plan.filter(s => s.paper).length || examPrep().perExam);
  const pct = papers.slice(-3).map(p => p.outOf ? p.score / p.outOf : 0);
  const avg = pct.length ? pct.reduce((x, y) => x + y, 0) / pct.length : null;
  const onTrack = due.length ? done / due.length : plan.length ? 1 : 0;
  const cover = Math.min(1, papers.length / target);
  const score = Math.round(100 * (avg == null ? .65 * onTrack + .35 * cover : .35 * onTrack + .4 * avg + .25 * cover));
  return { score, papers: papers.length, target, avg, planDone: plan.filter(s => s.done).length, planN: plan.length };
}

// ---------- the plan ----------
// 2.28: the planner form picks which subjects have exams (and adds an exam date
// for any that has none yet), the block and break lengths, hours for each day
// of the week, and the days you can't study.
function buildExamPlan() {
  if (!D.subjects.length) { alert('Add your subjects first (Study tab).'); return; }
  const P = examPrep(), h = new Date().getHours(), wk = planWeek(P), t = today();
  const hasPlan = D.sessions.some(s => s.examPlan && !s.done && s.date >= t);
  const examsOf = sid => upcomingExams(addDays(t, 1), 120).filter(a => a.subjectId === sid);
  const picked = sid => Array.isArray(P.subjects) ? P.subjects.includes(sid) : examsOf(sid).length > 0;
  const subjRows = D.subjects.map(s => { const xs = examsOf(s.id);
    return `<label class="xpsubj" style="--c:${s.color}"><input type="checkbox" data-xps="${s.id}" ${picked(s.id) ? 'checked' : ''}><b>${esc(s.name)}</b>
      ${xs.length ? `<span class="muted small-text">${xs.map(a => `${esc(a.title)} · ${fmtDate(a.date)}`).join(', ')}</span>` : `<span class="xpnew muted small-text">no exam yet · date <input type="date" data-xpd="${s.id}" min="${addDays(t, 1)}"></span>`}</label>`; }).join('');
  const order = [1, 2, 3, 4, 5, 6, 0];
  const weekRows = order.map(i => `<div class="xpday"><span>${DAY_NAMES[i].slice(0, 3)}</span><input type="number" min="0" max="14" step=".5" value="${wk[i].h}" data-xph="${i}" title="Hours of study"><span class="muted small-text">h from</span><input type="time" value="${wk[i].start}" data-xpt="${i}"></div>`).join('');
  const offChip = d => `<span class="tag xpoff" data-xpoffd="${d}">${fmtDate(d)}${P.off[d].h ? ` · ${P.off[d].h}h` : ' · off'} <a href="#" data-xpoffx="${d}" title="Remove">✕</a></span>`;
  const offs = () => Object.keys(P.off).filter(d => d >= t).sort().map(offChip).join('') || '<span class="muted small-text">None yet</span>';
  const opt = (v, list) => list.map(([x, l]) => `<option value="${x}" ${+v === x ? 'selected' : ''}>${l}</option>`).join('');
  showForm({
    title: '🎓 Build my exam timetable',
    saveLabel: hasPlan ? 'Rebuild' : 'Build plan',
    fields: [{ type: 'html', html: `<p class="muted small-text" style="margin-top:0">Pick the subjects you have exams for, how long each block and break should be, and how much you can study on each day. You can edit, drag or delete any block afterwards, mark days you can't study on the timetable, and there's an Undo.</p>
        <div class="field"><label>Subjects with exams</label><div class="xpsubjs">${subjRows}</div></div>` },
      { type: 'row', fields: [{ key: 'start', label: 'Start from', type: 'date', value: h >= 18 ? addDays(t, 1) : t, required: true }, { key: 'perExam', label: 'Past papers per exam', type: 'number', value: P.perExam, min: 0, step: 1 }] },
      { type: 'html', html: `<div class="frow"><div class="field"><label>Study blocks</label><select data-xpb>${opt(P.blockMins, [[25, '25 minutes'], [30, '30 minutes'], [40, '40 minutes'], [45, '45 minutes'], [50, '50 minutes'], [60, '1 hour'], [75, '1¼ hours'], [90, '1½ hours']])}</select></div>
        <div class="field"><label>Breaks between blocks</label><select data-xpbr>${opt(P.breakMins, [[0, 'No break'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes'], [30, '30 minutes']])}</select></div></div>
        <div class="field"><label>Each day of the week</label><div class="xpweek">${weekRows}</div><span class="hint">Set a day to 0 hours to keep it free. Holidays use Saturday's hours.</span></div>
        <div class="field"><label>Days I can't study (or have less time)</label><div class="row xpoffrow"><input type="date" data-xpoffin min="${t}" style="width:auto"><input type="number" data-xpoffh min="0" max="14" step=".5" value="0" style="width:70px" title="Hours you can still study that day (0 = none)"><span class="muted small-text">h</span><button type="button" class="btn small" data-xpoffadd>Add</button></div><div class="catchips" id="xpOffs">${offs()}</div></div>` },
      { key: 'mode', label: 'What to do', type: 'select', value: hasPlan ? 'rebuild' : 'fill', options: [['rebuild', 'Rebuild the whole timetable (finished blocks stay)'], ['fill', 'Keep my blocks and fill free time with revision'], ['add', 'Only add past papers, SAC prep and light days']] }],
    onSave: v => {
      const q = sel => [...mform.querySelectorAll(sel)];
      const subs = q('[data-xps]').filter(x => x.checked).map(x => x.dataset.xps);
      // a ticked subject with no exam yet gets one on the date you gave
      let added = 0;
      for (const sid of subs) {
        const dIn = mform.querySelector(`[data-xpd="${sid}"]`);
        if (dIn && dIn.value && !examsOf(sid).length) { D.assessments.push({ id: uid(), subjectId: sid, type: 'Exam', title: `${subj(sid).name} exam`, date: dIn.value, time: '', weight: '', score: '', notes: 'Added from the exam planner', done: false, remind: D.settings.remind.assessment }); added++; }
      }
      if (!subs.some(sid => examsOf(sid).length)) { alert('Tick at least one subject that has an exam coming up (or give it an exam date).'); return false; }
      P.subjects = subs;
      q('[data-xph]').forEach(x => { wk[+x.dataset.xph].h = Math.max(0, Math.min(14, +x.value || 0)); });
      q('[data-xpt]').forEach(x => { if (x.value) wk[+x.dataset.xpt].start = x.value; });
      Object.assign(P, { blockMins: +mform.querySelector('[data-xpb]').value || 45, breakMins: +mform.querySelector('[data-xpbr]').value, perExam: Math.max(0, Math.min(6, v.perExam ?? 3)),
        hoursSchool: wk[1].h, hoursWeekend: wk[6].h, schoolStart: wk[1].start, weekendStart: wk[6].start });
      const before = D.sessions.slice();
      const made = makeExamPlan(v.start || t, v.mode || 'rebuild');
      if (!made) { alert('There was no free time to plan in. Try more hours, fewer days off or an earlier start.'); return false; }
      ui.studyTab = 'board'; view = 'study';
      setTimeout(() => undoToast(`🎓 Timetable ${v.mode === 'rebuild' ? 'rebuilt' : 'updated'}: ${made.blocks} blocks including ${made.papers} timed past papers${added ? `, and ${added} new exam${added === 1 ? '' : 's'}` : ''}.`, () => { D.sessions = before; }), 50);
    },
  });
  // days off: add and remove right in the form
  mform.querySelector('[data-xpoffadd]')?.addEventListener('click', () => {
    const d = mform.querySelector('[data-xpoffin]').value; if (!d) return;
    P.off[d] = { h: Math.max(0, +mform.querySelector('[data-xpoffh]').value || 0) }; mform.querySelector('#xpOffs').innerHTML = offs();
  });
  mform.querySelector('#xpOffs')?.addEventListener('click', e => { const x = e.target.closest('[data-xpoffx]'); if (!x) return; e.preventDefault(); delete P.off[x.dataset.xpoffx]; mform.querySelector('#xpOffs').innerHTML = offs(); });
}

function makeExamPlan(start, mode = 'add') {
  const replace = mode === 'rebuild';
  const P = examPrep();
  const exams = planExams(addDays(start, 1)); if (!exams.length) return null;
  const last = exams[exams.length - 1].date, blk = Math.max(20, +P.blockMins || 45), gap = Math.max(0, P.breakMins == null ? 10 : +P.breakMins || 0);
  // the old plan's unfinished blocks go, and (if you choose) your regular study blocks in the same period
  const forExam = s => { const a = s.assessmentId && D.assessments.find(x => x.id === s.assessmentId); return !s.assessmentId || (a && isExam(a)); };
  // (only adding? then your exam-plan revision blocks stay and just the extras are redone)
  const extra = s => s.paper || /^(Timed past paper|Light review|Prep for )/.test(s.topic || '');
  const removed = D.sessions.filter(s => !s.done && s.date >= start && ((s.examPlan && (mode !== 'add' || extra(s))) || (replace && s.date <= last && forExam(s))));
  // topics from the blocks you'd already planned carry over, per subject
  const carried = {};
  for (const s of removed.filter(s => !s.examPlan && !s.paper)) {
    const tp = String(s.topic || '').replace(/^(Revise( & practise)?|Exam-style questions|Study [^:]*|Review):\s*/i, '').trim();
    if (tp && !/^(study|revision)$|final review|timed practice|practice exam|past paper/i.test(tp)) (carried[s.subjectId] = carried[s.subjectId] || []).includes(tp) || carried[s.subjectId].push(tp);
  }
  D.sessions = D.sessions.filter(s => !removed.includes(s));
  const sacs = D.assessments.filter(a => !isExam(a) && !a.done && a.date > start && a.date <= last && a.type !== 'Practice exam');
  const examDays = new Set(exams.map(a => a.date));
  const weekend = d => [0, 6].includes(parseYmd(d).getDay()) || (typeof isHoliday === 'function' && isHoliday(d));
  // minutes free each day: that day's hours, less study already planned, and just an hour on exam days
  const cap = {}, days = [];
  for (let d = start; d < last; d = addDays(d, 1)) {
    const other = D.sessions.filter(s => s.date === d && !s.done).reduce((a, s) => a + (+s.duration || 0), 0);
    cap[d] = Math.max(0, dayCapMins(d) - other);
    if (examDays.has(d)) cap[d] = Math.min(cap[d], 60);
    days.push(d);
  }
  const plan = {}; // date -> blocks
  const add = (d, b) => { (plan[d] = plan[d] || []).push(b); cap[d] -= b.duration; };
  // 1. the day before each exam: light review only
  const taperDays = new Set();
  for (const a of exams) { const d = addDays(a.date, -1); if (cap[d] != null && !dayPlan(d).off) { taperDays.add(d); add(d, { a, duration: Math.min(45, blk), topic: taperText(a), taper: true }); } }
  // 2. timed past papers, spread through each exam's run-up, on days with room
  for (const a of exams) {
    const need = paperMins(a), done = P.papers.filter(p => p.assessmentId === a.id).length;
    const n = Math.max(0, P.perExam - done);
    const win = days.filter(d => d < addDays(a.date, -1) && !taperDays.has(d) && !examDays.has(d));
    if (!n || !win.length) continue;
    const fr = n === 1 ? [.8] : n === 2 ? [.55, .88] : Array.from({ length: n }, (_, i) => .35 + .6 * i / (n - 1));
    const used = new Set();
    for (const f of fr) {
      const at = Math.min(win.length - 1, Math.floor(f * win.length));
      const order = win.map((d, i) => [d, Math.abs(i - at) - (weekend(d) ? 1.5 : 0)]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
      const free = x => !used.has(x) && !(plan[x] || []).some(b => b.paper);
      const d = order.find(x => free(x) && cap[x] >= need);
      if (d) { used.add(d); add(d, { a, duration: need, paper: true, topic: `Timed past paper: ${a.title} (${fmtMins(need)}, exam conditions, then mark it and log your mistakes)` }); continue; }
      // no day long enough: do it in two timed halves on days next to each other
      const half = Math.ceil(need / 2 / 5) * 5;
      const d1 = order.find(x => free(x) && cap[x] >= half && win.includes(addDays(x, 1)) && free(addDays(x, 1)) && cap[addDays(x, 1)] >= half);
      if (!d1) continue;
      const d2 = addDays(d1, 1); used.add(d1); used.add(d2);
      add(d1, { a, duration: half, paperPart: true, topic: `Timed past paper, part 1: ${a.title} (first half, ${fmtMins(half)}, exam conditions)` });
      add(d2, { a, duration: half, paper: true, topic: `Timed past paper, part 2: ${a.title} (second half, ${fmtMins(half)}, then mark it and log your mistakes)` });
    }
  }
  // 3. topic blocks in the time that's left, weighted toward whatever is closest
  const rot = {};
  const nextTopic = a => {
    const sid = a.subjectId, list = [...weakTopics(sid), ...(carried[sid] || []), ...subjectTopics(sid)].filter((t, i, arr) => arr.indexOf(t) === i);
    const i = rot[sid] = (rot[sid] ?? -1) + 1;
    return list.length ? list[i % list.length] : 'Practice questions';
  };
  for (const d of days) {
    if (taperDays.has(d)) continue;
    if (mode === 'add') { // only prep for SACs in the next 3 days that have nothing planned, up to 2 blocks each
      const planned = a => Object.values(plan).flat().filter(b => b.a === a).length;
      const due = sacs.filter(a => a.date > d && diffDays(d, a.date) <= 3 && !D.sessions.some(s => s.assessmentId === a.id && !s.examPlan) && planned(a) < 2).sort((x, y) => x.date.localeCompare(y.date));
      if (!dayPlan(d).off) for (const sac of due.slice(0, 2)) add(d, { a: sac, duration: Math.min(45, blk), topic: `Prep for ${sac.title}` }); // urgent, so it goes in even on a full day
      continue;
    }
    const picked = {};
    while (cap[d] >= Math.min(blk, 30)) {
      const opts = [
        ...exams.filter(a => a.date > addDays(d, 1)).map(a => ({ a, w: 1 / (diffDays(d, a.date) + 2) })),
        ...sacs.filter(a => a.date > d && diffDays(d, a.date) <= 5 && D.sessions.filter(s => s.assessmentId === a.id && !s.examPlan).length < 2).map(a => ({ a, w: 1.4 / (diffDays(d, a.date) + 1), sac: true })),
      ].map(o => ({ ...o, w: o.w * Math.pow(.35, picked[o.a.subjectId] || 0) })).sort((x, y) => y.w - x.w);
      if (!opts.length) break;
      const o = opts[0], len = Math.min(blk, cap[d]);
      picked[o.a.subjectId] = (picked[o.a.subjectId] || 0) + 1;
      add(d, { a: o.a, duration: len, topic: o.sac ? `Prep for ${o.a.title}` : `Revise: ${nextTopic(o.a)}` });
    }
  }
  // give each day's blocks times, papers first while you're fresh, with your breaks between
  const created = [];
  for (const d of Object.keys(plan).sort()) {
    const startT = examDays.has(d) && hmToMin(dayPlan(d).start) < 17 * 60 ? '17:00' : dayPlan(d).start;
    // start after anything already planned that day
    const busy = [...D.sessions, ...D.workouts].filter(s => s.date === d && s.time && !s.examPlan).map(s => hmToMin(s.time) + (+s.duration || 30));
    let m = Math.max(hmToMin(startT), ...busy.filter(x => x > hmToMin(startT) - 60).map(x => x + gap));
    for (const b of plan[d].sort((x, y) => (y.paper || y.paperPart ? 1 : 0) - (x.paper || x.paperPart ? 1 : 0))) {
      created.push({ id: uid() + created.length, subjectId: b.a.subjectId, assessmentId: b.a.id, date: d, time: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, duration: b.duration, topic: b.topic, notes: '', done: false, remind: D.settings.remind.session, examPlan: true, ...(b.paper ? { paper: true } : {}) });
      m += b.duration + gap;
    }
  }
  if (!created.length) { D.sessions.push(...removed); return null; }
  D.sessions.push(...created);
  // blocks you'd already put on a day you can't study move to days with room
  for (const d of Object.keys(P.off || {})) if (d >= start && dayPlan(d).h * 60 < D.sessions.filter(s => s.date === d && !s.done).reduce((a, s) => a + (+s.duration || 30), 0)) reflowDay(d);
  return { blocks: created.length, papers: created.filter(s => s.paper).length, swapped: removed.filter(s => !s.examPlan).length };
}

// after logging mistakes, point the plan's next topic blocks at them
function retopic(sid) {
  const weak = weakTopics(sid); if (!weak.length) return 0;
  const blocks = D.sessions.filter(s => s.examPlan && !s.done && !s.paper && s.subjectId === sid && s.date >= today() && /^Revise: /.test(s.topic)).sort((a, b) => a.date.localeCompare(b.date));
  blocks.forEach((s, i) => { s.topic = `Revise: ${weak[i % Math.min(weak.length, 3)]}`; });
  return blocks.length;
}

// ---------- mistake log ----------
function logPaper(pre = {}) {
  const exams = D.assessments.filter(a => isExam(a) && !a.done).sort((a, b) => a.date.localeCompare(b.date));
  if (!exams.length) { alert('Add an exam first.'); return; }
  const a0 = exams.find(a => a.id === pre.assessmentId) || exams[0];
  const chips = sid => subjectTopics(sid).map(t => `<button type="button" class="cchip" data-topic="${esc(t)}">${esc(t)}</button>`).join('');
  showForm({
    title: '📝 Log a past paper',
    saveLabel: 'Save',
    fields: [{ key: 'assessmentId', label: 'Practice for', type: 'select', options: exams.map(a => [a.id, `${subj(a.subjectId).name}: ${a.title}`]), value: a0.id },
      { type: 'row', fields: [{ key: 'date', label: 'Done on', type: 'date', value: pre.date || today(), required: true }, { key: 'score', label: 'Marks you got', type: 'number', min: 0, step: .5, value: '' }, { key: 'outOf', label: 'Out of', type: 'number', min: 1, step: 1, value: '' }] },
      { key: 'topics', label: 'Topics you lost marks on (comma between each)', type: 'text', value: '', placeholder: 'e.g. Integration, Binomial distributions' },
      { type: 'html', html: `<div class="catchips qa-topics" id="paperTopics">${chips(a0.subjectId)}</div>` },
      notesF('')],
    onSave: v => {
      const a = find('assessment', v.assessmentId);
      const topics = v.topics.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 12);
      examPrep().papers.push({ id: uid(), assessmentId: a.id, subjectId: a.subjectId, date: v.date, score: v.score ?? 0, outOf: v.outOf || 0, topics, notes: v.notes });
      const n = retopic(a.subjectId);
      setTimeout(() => toast('📝 Paper logged', `${v.outOf ? `${Math.round((v.score || 0) / v.outOf * 100)}%. ` : ''}${n && topics.length ? `Your next ${n} ${subj(a.subjectId).name} blocks now focus on ${weakTopics(a.subjectId).slice(0, 3).join(', ')}.` : 'Nice work.'}`), 50);
    },
  });
  // tap a chip to add that topic; changing the exam swaps the chips
  mform.querySelector('#paperTopics')?.addEventListener('click', e => {
    const c = e.target.closest('[data-topic]'); if (!c) return;
    const inp = mform.querySelector('[name=topics]'), cur = inp.value.split(',').map(s => s.trim()).filter(Boolean);
    inp.value = (cur.includes(c.dataset.topic) ? cur.filter(x => x !== c.dataset.topic) : [...cur, c.dataset.topic]).join(', ');
    c.classList.toggle('on');
  });
  mform.querySelector('[name=assessmentId]')?.addEventListener('change', e => { const a = find('assessment', e.target.value); if (a) mform.querySelector('#paperTopics').innerHTML = chips(a.subjectId); });
}
// ticking off a past-paper block asks for the score
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset?.toggle !== 'session' || !el.checked) return;
  const s = D.sessions.find(x => x.id === el.dataset.id);
  if (s?.paper) setTimeout(() => logPaper({ assessmentId: s.assessmentId, date: s.date }), 450);
});

// ---------- the Study page hub ----------
function examHub() {
  const exams = upcomingExams();
  if (!exams.length) return '';
  const t = today(), P = examPrep(), hasPlan = D.sessions.some(s => s.examPlan && s.date >= t);
  const cards = exams.map(a => {
    const s = subj(a.subjectId), dd = diffDays(t, a.date), r = examReadiness(a), weak = weakTopics(a.subjectId).slice(0, 3);
    const col = r.score >= 75 ? '#40c057' : r.score >= 50 ? '#fab005' : '#fa5252';
    return `<div class="examcard ${dd <= 1 ? 'soon' : ''}" style="--c:${s.color}">
      <div class="ex-top"><div class="ex-days"><b>${dd === 0 ? 'Today' : dd}</b>${dd ? `<span>day${dd === 1 ? '' : 's'}</span>` : ''}</div>
        <div class="main"><div class="ex-subj">${esc(s.name)}</div><div class="ex-title">${esc(a.title)}</div><div class="muted small-text">${longDay(a.date)} ${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}</div></div></div>
      <div class="ex-ready"><span>Ready</span><div class="meter"><i style="width:${r.score}%;background:${col}"></i></div><b>${r.score}%</b></div>
      <div class="ex-stats"><span title="Timed past papers logged">📝 ${r.papers}/${r.target} papers${r.avg != null ? ` · avg ${Math.round(r.avg * 100)}%` : ''}</span><span title="Exam plan blocks done">📚 ${r.planDone}/${r.planN} blocks</span></div>
      ${weak.length ? `<div class="ex-weak"><span class="muted small-text">Work on</span>${weak.map(w => `<span class="tag">${esc(w)}</span>`).join('')}</div>` : ''}
      ${dd === 1 ? `<div class="ex-eve">🌙 Tomorrow! Light review only, then an early night.</div>` : ''}
      <button class="btn small" data-act="logPaper" data-id="${a.id}">Log a paper</button></div>`;
  }).join('');
  return `<div class="card examhub"><div class="card-head"><h2>🎓 Exam lead-up</h2><span class="muted small-text">${exams.length} exam${exams.length === 1 ? '' : 's'} · the first is ${relDays(diffDays(t, exams[0].date))}</span>
      <span style="flex:1"></span><button class="btn small" data-act="logPaper">📝 Log a past paper</button><button class="btn small primary" data-act="examPlan">${hasPlan ? '🔁 Rebuild my timetable' : '✨ Build my exam timetable'}</button></div>
    <div class="examcards">${cards}</div>
    ${hasPlan ? '' : `<p class="muted small-text" style="margin:10px 0 0">Add exam prep and it slots timed past papers into your current plan wherever there's room, preps any SAC that has nothing planned, and keeps the day before each exam light. You pick the subjects, block and break lengths, and your hours for each day when you build.</p>`}</div>`;
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
    const next = D.sessions.filter(s => s.date === t && !s.done).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))[0], ex = upcomingExams(t, 30)[0];
    if (next || ex) fire('nudge:' + t, '📚 Time to study', next ? `Next up: ${subj(next.subjectId).name}: ${String(next.topic || '').replace(/^Revise: /, '')}${next.time ? ' at ' + fmtTime(next.time) : ''}.` : `${subj(ex.subjectId).name} ${ex.title} is ${relDays(diffDays(t, ex.date))}. Even 25 minutes helps.`);
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

// ---------- 2.22: the exam timetable builds itself, then you edit it ----------
// The first time the Study page sees exams coming up with no exam plan, it
// builds a full timetable (papers, SAC prep, topic revision, light days). The
// Exam timetable tab shows it day by day: drag blocks between days, make them
// longer or shorter, edit or delete them, or rebuild.
function examAutoBuild() {
  const P = examPrep(), exams = upcomingExams(addDays(today(), 1));
  if (P.autoBuilt || !exams.length || D.sessions.some(s => s.examPlan)) return;
  P.autoBuilt = today();
  const before = D.sessions.slice(), start = new Date().getHours() >= 18 ? addDays(today(), 1) : today();
  const made = makeExamPlan(start, 'fill'); if (!made) return;
  save();
  setTimeout(() => toast('🎓 Your exam timetable is ready', `${made.blocks} blocks, including ${made.papers} timed past papers, fitted around what you'd already planned.`, { timeout: 20000, actions: [['See it', () => { ui.studyTab = 'board'; view = 'study'; render(); }], ['Undo', () => { D.sessions = before; save(); render(); }]] }), 400);
}
function examBoard() {
  const t = today(), exams = upcomingExams(), P = examPrep();
  const last = exams.length ? exams[exams.length - 1].date : addDays(t, 14), n = Math.min(42, diffDays(t, last) + 1);
  const days = Array.from({ length: n }, (_, i) => addDays(t, i)), examOn = d => exams.filter(a => a.date === d);
  const weekend = d => [0, 6].includes(parseYmd(d).getDay()) || (typeof isHoliday === 'function' && isHoliday(d));
  const block = s => { const sb = subj(s.subjectId);
    return `<div class="xb ${s.done ? 'done' : ''} ${s.paper ? 'paper' : ''}" draggable="true" data-xb="${s.id}" style="--c:${sb.color}">
      <div class="xb-top"><b>${esc(sb.name)}</b><span>${s.time ? fmtTime(s.time) : ''}</span></div>
      <div class="xb-topic" title="${esc(s.topic || '')}">${esc(String(s.topic || 'Study').replace(/^Revise: /, ''))}</div>
      <div class="xb-acts"><button class="iconbtn" data-xa="shorter" data-id="${s.id}" title="15 minutes shorter">−</button><span>${fmtMins(+s.duration || 30)}</span><button class="iconbtn" data-xa="longer" data-id="${s.id}" title="15 minutes longer">＋</button>
        <span style="flex:1"></span><button class="iconbtn" data-act="edit" data-kind="session" data-id="${s.id}" title="Edit">✎</button><button class="iconbtn" data-xa="del" data-id="${s.id}" title="Delete">✕</button></div></div>`; };
  const cols = days.map(d => {
    const list = D.sessions.filter(s => s.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const mins = list.reduce((a, s) => a + (+s.duration || 0), 0), dp = dayPlan(d), cap = dayCapMins(d), ex = examOn(d), dt = parseYmd(d);
    return `<div class="xcol ${d === t ? 'today' : ''} ${weekend(d) ? 'wkend' : ''} ${ex.length ? 'examday' : ''} ${dp.off ? 'dayoff' : ''}" data-xday="${d}">
      <div class="xcol-head"><b>${DOW[dt.getDay()]} ${dt.getDate()}</b><span class="${mins > cap ? 'red-text' : 'muted'}">${dp.off ? "Can't study" : `${fmtMins(mins) || '0m'} / ${fmtMins(cap)}`}</span>
        <button class="iconbtn xdaybtn ${dp.custom ? 'on' : ''}" data-xdayset="${d}" title="${dp.custom ? `Changed${dp.note ? ': ' + esc(dp.note) : ''}. Click to edit` : "Can't study this day, or have less time?"}">${dp.off ? '🚫' : dp.custom ? '✎' : '⋯'}</button></div>
      ${dp.note ? `<div class="xnote">${esc(dp.note)}</div>` : ''}
      ${ex.map(a => `<div class="xexam" style="--c:${subj(a.subjectId).color}">🎓 ${esc(subj(a.subjectId).name)}: ${esc(a.title)}${a.time ? ' · ' + fmtTime(a.time) : ''}</div>`).join('')}
      ${list.map(block).join('')}
      <button class="xadd" data-act="new" data-kind="session" data-date="${d}">＋</button></div>`;
  }).join('');
  return `<div class="study2">${pageHead('Study', 'Your exam timetable', `<button class="btn" data-act="examPlan">Rebuild…</button><button class="btn primary" data-act="focusNew">▶ Start studying</button>`)}${studyTabs()}
    <p class="muted small-text">Drag a block to another day to move it. Use − and ＋ to change how long it is. The numbers at the top of each day are planned time against that day's hours. Got something on? Press ⋯ on a day to mark it as a day you can't study (or have less time) and its blocks move to other days.</p>
    <div class="xboard">${cols}</div></div>`;
}
// re-time a day's blocks one after another, keeping the earliest start
function retimeDay(d) {
  const list = D.sessions.filter(s => s.date === d && s.time).sort((a, b) => a.time.localeCompare(b.time)); if (!list.length) return;
  let m = hmToMin(list[0].time); const gap = examPrep().breakMins ?? 10;
  for (const s of list) { s.time = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; m += (+s.duration || 30) + gap; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-xa]'); if (!b) return;
  const s = D.sessions.find(x => x.id === b.dataset.id); if (!s) return;
  if (b.dataset.xa === 'del') { const before = D.sessions.slice(); D.sessions = D.sessions.filter(x => x !== s); save(); render(); undoToast('Block deleted', () => { D.sessions = before; }); return; }
  s.duration = Math.max(15, Math.min(240, (+s.duration || 30) + (b.dataset.xa === 'longer' ? 15 : -15))); retimeDay(s.date); save(); render();
});
document.addEventListener('dragstart', e => { const b = e.target.closest?.('[data-xb]'); if (b) { e.dataTransfer.setData('text/xb', b.dataset.xb); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); } });
document.addEventListener('dragend', e => e.target.closest?.('[data-xb]')?.classList.remove('dragging'));
document.addEventListener('dragover', e => { const c = e.target.closest?.('[data-xday]'); if (c && e.dataTransfer.types.includes('text/xb')) { e.preventDefault(); document.querySelectorAll('.xcol.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', e => {
  const c = e.target.closest?.('[data-xday]'), id = e.dataTransfer.getData('text/xb'); if (!c || !id) return;
  e.preventDefault(); c.classList.remove('over');
  const s = D.sessions.find(x => x.id === id); if (!s || s.date === c.dataset.xday) return;
  const from = s.date, d = c.dataset.xday, gap = examPrep().breakMins ?? 10;
  const ends = D.sessions.filter(x => x.date === d && x.time && x !== s).map(x => hmToMin(x.time) + (+x.duration || 30) + gap);
  const m = Math.max(hmToMin(dayPlan(d).start), ...ends);
  s.date = d; s.time = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; retimeDay(from);
  save(); render();
});

// ---------- 2.28: a day you can't study (or have less time) ----------
// Marking a day moves the blocks that no longer fit to the nearest days that
// have room, before that block's exam where possible.
function editPlanDay(d) {
  const P = examPrep(), cur = (P.off || {})[d], wk = planWeek(P)[parseYmd(d).getDay()];
  showForm({
    title: `📅 ${fullDate(d)}`,
    saveLabel: 'Save',
    fields: [{ key: 'what', label: 'This day', type: 'select', value: cur ? (+cur.h ? 'less' : 'off') : 'normal', options: [['normal', `Normal (${wk.h}h from ${fmtTime(wk.start)})`], ['off', "I can't study this day"], ['less', 'I have less time (or a different start)']] },
      { type: 'row', fields: [{ key: 'h', label: 'Hours I can study', type: 'number', min: 0, max: 14, step: .5, value: cur ? cur.h : Math.max(0, wk.h - 1) }, { key: 'start', label: 'Starting at', type: 'time', value: (cur && cur.start) || wk.start }] },
      { key: 'note', label: "What's on (optional)", value: cur?.note || '', placeholder: 'e.g. Soccer final, family dinner' }],
    onSave: v => {
      const before = D.sessions.map(s => ({ ...s })), offBefore = { ...P.off };
      if (v.what === 'normal') delete P.off[d];
      else P.off[d] = { h: v.what === 'off' ? 0 : Math.max(0, +v.h || 0), start: v.what === 'less' ? v.start : '', note: v.note };
      const r = reflowDay(d);
      setTimeout(() => undoToast(v.what === 'normal' ? `${fullDate(d)} is back to normal.` : `${fullDate(d)} updated${r.moved ? `: ${r.moved} block${r.moved === 1 ? '' : 's'} moved to other days` : ''}${r.dropped ? `, ${r.dropped} didn't fit anywhere and came off the plan` : ''}.`, () => { D.sessions = before; P.off = offBefore; }), 50);
    },
  });
}
function reflowDay(d) {
  const t = today(), gap = examPrep().breakMins ?? 10;
  const list = D.sessions.filter(s => s.date === d && !s.done).sort((a, b) => (b.paper ? 1 : 0) - (a.paper ? 1 : 0) || (a.time || '99').localeCompare(b.time || '99'));
  let room = dayCapMins(d), moved = 0, dropped = 0;
  const keep = [], move = [];
  for (const s of list) { if ((+s.duration || 30) <= room) { keep.push(s); room -= +s.duration || 30; } else move.push(s); }
  // keep what still fits, starting from that day's start time
  let m = hmToMin(dayPlan(d).start);
  for (const s of keep.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))) { s.time = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; m += (+s.duration || 30) + gap; }
  const used = x => D.sessions.filter(s => s.date === x && !s.done).reduce((a, s) => a + (+s.duration || 30), 0);
  for (const s of move) {
    const ex = s.assessmentId && D.assessments.find(a => a.id === s.assessmentId), until = ex ? addDays(ex.date, s.taper ? 0 : -1) : addDays(d, 21);
    const near = [];
    for (let k = 1; k <= 21; k++) { const a = addDays(d, k), b = addDays(d, -k); if (a < until) near.push(a); if (b >= t && b < until) near.push(b); }
    const to = near.find(x => !dayPlan(x).off && dayCapMins(x) - used(x) >= (+s.duration || 30));
    if (!to) { D.sessions = D.sessions.filter(x => x !== s); dropped++; continue; }
    const ends = D.sessions.filter(x => x.date === to && x.time && x !== s).map(x => hmToMin(x.time) + (+x.duration || 30) + gap);
    const mm = Math.max(hmToMin(dayPlan(to).start), ...ends);
    s.date = to; s.time = `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; moved++;
  }
  return { moved, dropped };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-xdayset]'); if (!b) return;
  e.preventDefault(); e.stopPropagation(); editPlanDay(b.dataset.xdayset);
});
// typing an exam date for a subject ticks it
document.addEventListener('input', e => { const d = e.target.closest?.('[data-xpd]'); if (d && d.value) { const c = mform.querySelector(`[data-xps="${d.dataset.xpd}"]`); if (c) c.checked = true; } });
