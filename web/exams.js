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
const examPrep = () => (D.examPrep = Object.assign({ papers: [], hoursSchool: 2, hoursWeekend: 4, schoolStart: '16:30', weekendStart: '09:30', perExam: 3 }, D.examPrep || {}));
const isExam = a => /exam/i.test(a.type || '') && a.type !== 'Practice exam';
function upcomingExams(from = today(), days = 60) {
  return D.assessments.filter(a => isExam(a) && !a.done && a.date >= from && diffDays(from, a.date) <= days).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
function subjectTopics(sid) {
  const name = subj(sid).name || '';
  const base = (EXAM_TOPICS.find(([re]) => re.test(name)) || [, ['Key concepts', 'Practice questions', 'Extended response']])[1];
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
function buildExamPlan() {
  const exams = upcomingExams(addDays(today(), 1));
  if (!exams.length) { alert('Add your exams first (as SAC / Exam with the type "Exam"), then build the plan.'); return; }
  const P = examPrep(), h = new Date().getHours();
  showForm({
    title: '🎓 Build my exam plan',
    saveLabel: 'Build plan',
    fields: [{ type: 'html', html: `<p class="muted small-text" style="margin-top:0">Plans revision for ${exams.map(a => `<b>${esc(subj(a.subjectId).name)}</b> (${fmtDate(a.date)})`).join(', ')}. Timed past papers go on days with enough time, topic blocks fill the rest, SACs and tests coming up get prep time, and the day before each exam is a light review. Rebuilding replaces the plan's unfinished blocks and keeps everything you've done.</p>` },
      { type: 'row', fields: [{ key: 'start', label: 'Start from', type: 'date', value: h >= 18 ? addDays(today(), 1) : today(), required: true }, { key: 'perExam', label: 'Past papers per exam', type: 'number', value: P.perExam, min: 0, step: 1 }] },
      { type: 'row', fields: [{ key: 'hoursSchool', label: 'Hours on a school day', type: 'number', value: P.hoursSchool, min: 0, step: .5 }, { key: 'schoolStart', label: 'Starting at', type: 'time', value: P.schoolStart }] },
      { type: 'row', fields: [{ key: 'hoursWeekend', label: 'Hours on a weekend or holiday', type: 'number', value: P.hoursWeekend, min: 0, step: .5 }, { key: 'weekendStart', label: 'Starting at', type: 'time', value: P.weekendStart }] },
      { key: 'replace', label: 'Fold my existing exam revision and regular study blocks into the plan (keeps their topics; SAC prep stays as it is)', type: 'bool', value: true }],
    onSave: v => {
      Object.assign(P, { perExam: Math.max(0, Math.min(6, v.perExam ?? 3)), hoursSchool: Math.max(0, Math.min(10, v.hoursSchool ?? 2)), hoursWeekend: Math.max(0, Math.min(12, v.hoursWeekend ?? 4)), schoolStart: v.schoolStart || '16:30', weekendStart: v.weekendStart || '09:30' });
      const before = D.sessions.slice();
      const made = makeExamPlan(v.start || today(), v.replace);
      if (!made) { alert('There was no free time to plan in. Try more hours or an earlier start.'); return false; }
      setTimeout(() => undoToast(`🎓 Exam plan ready: ${made.blocks} blocks including ${made.papers} timed past papers${made.swapped ? `, reorganising ${made.swapped} of your existing blocks` : ''}.`, () => { D.sessions = before; }), 50);
    },
  });
}

function makeExamPlan(start, replace) {
  const P = examPrep();
  const exams = upcomingExams(addDays(start, 1)), last = exams[exams.length - 1].date;
  // the old plan's unfinished blocks go, and (if you choose) your regular study blocks in the same period
  const forExam = s => { const a = s.assessmentId && D.assessments.find(x => x.id === s.assessmentId); return !s.assessmentId || (a && isExam(a)); };
  const removed = D.sessions.filter(s => !s.done && s.date >= start && (s.examPlan || (replace && s.date <= last && forExam(s))));
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
  // minutes free each day: your hours, less study already planned, and just an hour on exam days
  const cap = {}, days = [];
  for (let d = start; d < last; d = addDays(d, 1)) {
    const other = D.sessions.filter(s => s.date === d && !s.done).reduce((a, s) => a + (+s.duration || 0), 0);
    cap[d] = Math.max(0, Math.round((weekend(d) ? P.hoursWeekend : P.hoursSchool) * 60) - other);
    if (examDays.has(d)) cap[d] = Math.min(cap[d], 60);
    days.push(d);
  }
  const plan = {}; // date -> blocks
  const add = (d, b) => { (plan[d] = plan[d] || []).push(b); cap[d] -= b.duration; };
  // 1. the day before each exam: light review only
  const taperDays = new Set();
  for (const a of exams) { const d = addDays(a.date, -1); if (cap[d] != null) { taperDays.add(d); add(d, { a, duration: 45, topic: taperText(a), taper: true }); } }
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
    const picked = {};
    while (cap[d] >= 40) {
      const opts = [
        ...exams.filter(a => a.date > addDays(d, 1)).map(a => ({ a, w: 1 / (diffDays(d, a.date) + 2) })),
        ...sacs.filter(a => a.date > d && diffDays(d, a.date) <= 5 && D.sessions.filter(s => s.assessmentId === a.id && !s.examPlan).length < 2).map(a => ({ a, w: 1.4 / (diffDays(d, a.date) + 1), sac: true })),
      ].map(o => ({ ...o, w: o.w * Math.pow(.35, picked[o.a.subjectId] || 0) })).sort((x, y) => y.w - x.w);
      if (!opts.length) break;
      const o = opts[0], len = Math.min(60, cap[d]);
      picked[o.a.subjectId] = (picked[o.a.subjectId] || 0) + 1;
      add(d, { a: o.a, duration: len, topic: o.sac ? `Prep for ${o.a.title}` : `Revise: ${nextTopic(o.a)}` });
    }
  }
  // give each day's blocks times, papers first while you're fresh, with 10 minute breaks
  const created = [];
  for (const d of Object.keys(plan).sort()) {
    const startT = examDays.has(d) ? '17:00' : weekend(d) ? P.weekendStart : P.schoolStart;
    let m = hmToMin(startT);
    for (const b of plan[d].sort((x, y) => (y.paper || y.paperPart ? 1 : 0) - (x.paper || x.paperPart ? 1 : 0))) {
      created.push({ id: uid() + created.length, subjectId: b.a.subjectId, assessmentId: b.a.id, date: d, time: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, duration: b.duration, topic: b.topic, notes: '', done: false, remind: D.settings.remind.session, examPlan: true, ...(b.paper ? { paper: true } : {}) });
      m += b.duration + 10;
    }
  }
  if (!created.length) { D.sessions.push(...removed); return null; }
  D.sessions.push(...created);
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
      <span style="flex:1"></span><button class="btn small" data-act="logPaper">📝 Log a past paper</button><button class="btn small primary" data-act="examPlan">${hasPlan ? 'Rebuild my plan' : '✨ Build my exam plan'}</button></div>
    <div class="examcards">${cards}</div>
    ${hasPlan ? '' : `<p class="muted small-text" style="margin:10px 0 0">Build a plan and it lays out timed past papers and topic revision for every exam around your SACs, with a light day before each one. You can study ${P.hoursSchool}h on school days and ${P.hoursWeekend}h on weekends (change it when you build).</p>`}</div>`;
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
