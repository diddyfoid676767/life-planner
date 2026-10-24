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


// ---------- commands: remove, move, reschedule, mark done ----------
// "remove speed and agility tomorrow", "move Bio study to Sunday", "push gym back a day",
// "cancel dentist", "mark English essay done". Nothing changes until you confirm.
const QA_KINDS = [['session', 'sessions', 'date', i => `Study ${subj(i.subjectId).name || ''}: ${i.topic || ''}`, 'study session block revise revision'],
  ['workout', 'workouts', 'date', i => i.title + ' ' + (i.sport || ''), 'workout training session'],
  ['event', 'events', 'date', i => i.title + ' ' + (i.category || ''), 'event'],
  ['assessment', 'assessments', 'date', i => `${subj(i.subjectId).name || ''} ${i.title} ${i.type || ''}`, 'sac exam test assessment'],
  ['todo', 'todos', 'due', i => i.text, 'task todo']];
const QA_FILL = new Set('a an the my all of and from please can could you i have on at for to with also just is are this that it them up off out back forward later earlier by'.split(' '));
const QA_INTENT = [['remove', /^(?:(?:can|could) you |please |pls )*(remove|delete|cancel|clear|scrap|get rid of|take off|bin|drop|skip|wipe)\b/],
  ['move', /^(?:(?:can|could) you |please |pls )*(move|reschedule|shift|push|postpone|bring forward|bring|change|swap)\b/],
  ['done', /^(?:(?:can|could) you |please |pls )*(mark|tick off|tick|check off|finish|complete)\b/]];
function qaItems() {
  return QA_KINDS.flatMap(([kind, coll, dk, label, words]) => (D[coll] || []).map(i => ({ kind, coll, i, date: i[dk] || '', time: i.time || '', label: label(i).replace(/\s+/g, ' ').trim(), hay: label(i).toLowerCase(), kw: words })));
}
function qaTokens(phrase) { return phrase.toLowerCase().replace(/[^a-z0-9&' ]+/g, ' ').split(/\s+/).filter(w => w && !QA_FILL.has(w) && w !== '&'); }
function qaMatch(phrase, pool) {
  const s = inboxSubject(phrase), toks = qaTokens(phrase).filter(w => !(s && (new RegExp('^' + w).test(s.name.toLowerCase()) || SUBJ_ALIAS.some(([re]) => re.test(w)))));
  if (!toks.length && !s) return [];
  const re = w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // every word must appear in the title, except words that just name the kind ("study", "task", "sac")
  return pool.filter(x => (!s || x.i.subjectId === s.id || x.hay.includes(s.name.toLowerCase())) && toks.every(w => re(w).test(x.hay) || re(w).test(x.kw)) && (s || toks.some(w => re(w).test(x.hay))));
}
function parseCommand(raw) {
  const text = raw.trim(), low = text.toLowerCase().replace(/[.!?]+$/, '');
  let intent = null, rest = low;
  let verb = '';
  for (const [k, re] of QA_INTENT) { const m = re.exec(low); if (m) { intent = k; verb = m[1]; rest = low.slice(m[0].length); break; } }
  // clear commands always act; words like "push", "finish" or "drop" may just be part of something to add
  const strong = /^(remove|delete|cancel|get rid of|scrap|wipe|move|reschedule|postpone|shift|mark|tick off|tick|check off)$/.test(verb);
  if (!intent && /\b(as )?(done|complete|completed|finished)$/.test(low) && low.split(' ').length > 1) { intent = 'done'; verb = 'done'; rest = low; }
  if (!intent) return null;
  if (intent === 'done') rest = rest.replace(/\b(as )?(done|complete|completed|finished)$/, '');
  // where it goes: "to Sunday 4pm", or "back a day", "forward 2 days"
  let dest = null, shift = 0, src = rest;
  if (intent === 'move') {
    const rel = /\b(?:by\s+)?(an?|one|two|three|\d+)\s+(day|days|week|weeks)\s*(later|earlier|back|forward)?\b|\b(back|forward|later|earlier)\s+(?:by\s+)?(an?|one|two|three|\d+)\s+(day|days|week|weeks)\b/.exec(rest);
    if (rel) {
      const n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[rel[1] || rel[5]] ?? +(rel[1] || rel[5]), unit = /week/.test(rel[2] || rel[6]) ? 7 : 1, dir = rel[3] || rel[4] || '';
      shift = n * unit * (/forward|earlier/.test(dir) || /bring forward/.test(low) ? -1 : 1); src = rest.replace(rel[0], ' ');
    } else {
      const m = /\s(?:to|until|till|til|on|onto|for)\s+(?!do\b)(.+)$/.exec(' ' + rest);
      if (m) { const d = qaDate(m[1]), tm = qaTime(m[1]); if (d.date || tm.time) { dest = { date: d.date, time: tm.time }; src = (' ' + rest).slice(0, m.index); } }
      if (!dest && !shift) return { intent, text, strong, need: 'Say where to, e.g. "to Sunday", "to 4pm" or "back a day".', items: [] };
    }
  }
  const sd = qaDate(src), st = qaTime(src);
  let phrase = src; for (const sp of [sd.span, st.span]) if (sp) phrase = phrase.split(sp).join(' ');
  phrase = phrase.replace(/\b(everything|anything|stuff)\b/g, ' ').trim();
  const all = /\b(all|every|everything)\b/.test(src);
  const t = today();
  let pool = qaItems().filter(x => !(intent === 'done' && x.i.done));
  pool = sd.date ? pool.filter(x => x.date === sd.date) : pool.filter(x => x.kind === 'todo' ? !x.i.done : x.date >= t);
  if (st.time) pool = pool.filter(x => x.time === st.time);
  let items = qaTokens(phrase).length || inboxSubject(phrase) ? qaMatch(phrase, pool) : (sd.date ? pool : []);
  if (!items.length && /\s(and|&)\s|,/.test(phrase)) items = [...new Set(phrase.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean).flatMap(p => qaMatch(p, pool)))];
  // with no date given, act on the next matching day only (unless you said "all")
  if (items.some(x => x.date) && !sd.date) items = items.filter(x => x.date || !items.some(y => y.date && y.kind !== 'todo'));
  if (!sd.date && !all && items.length > 1) { const first = items.filter(x => x.date).map(x => x.date).sort()[0]; if (first) items = items.filter(x => x.date === first || (!x.date && x.kind === 'todo')).slice(0, 8); }
  items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { intent, text, strong: strong || verb === 'done', dest, shift, items: items.slice(0, 20), srcDate: sd.date };
}
const qaNewDate = (c, x) => c.shift ? addDays(x.date || today(), c.shift) : c.dest.date || x.date || today();
function commandPreview(c) {
  if (c.need) return `<span class="qa-chip warn">${esc(c.need)}</span>`;
  if (!c.items.length) return `<span class="qa-chip warn">${c.intent === 'remove' ? '🗑' : c.intent === 'move' ? '↪' : '✓'} Nothing in your planner matches that yet. Try a word from its title, a subject or a day</span>`;
  const verb = c.intent === 'remove' ? '🗑 Remove' : c.intent === 'done' ? '✓ Mark done' : `↪ Move ${c.shift ? (c.shift > 0 ? `${Math.abs(c.shift)} day${Math.abs(c.shift) === 1 ? '' : 's'} later` : `${Math.abs(c.shift)} day${Math.abs(c.shift) === 1 ? '' : 's'} earlier`) : `to ${c.dest.date ? fmtDate(c.dest.date) : 'the same day'}${c.dest.time ? ' ' + fmtTime(c.dest.time) : ''}`}`;
  return `<span class="qa-chip cmd">${esc(verb)}</span><span class="qa-chip">${c.items.length} match${c.items.length === 1 ? '' : 'es'}: ${esc(c.items.slice(0, 2).map(x => x.label).join(', '))}${c.items.length > 2 ? '…' : ''}</span><span class="qa-chip muted">Press Enter to check</span>`;
}
function commandConfirm(c) {
  const prev = document.getElementById('qaPrev'); if (!prev) return;
  const verb = c.intent === 'remove' ? 'Remove' : c.intent === 'done' ? 'Mark done' : 'Move';
  const when = x => x.date ? `${fmtDate(x.date)}${x.time ? ' ' + fmtTime(x.time) : ''}` : 'no date';
  prev.innerHTML = c.need || !c.items.length ? commandPreview(c) : `<div class="qa-confirm ${c.intent}"><div class="qac-head"><b>${verb} ${c.items.length === 1 ? 'this' : `these ${c.items.length}`}?</b><span class="muted small-text">Untick anything you want to keep as it is.</span></div>
    <ul class="qac-list">${c.items.map((x, k) => `<li><label><input type="checkbox" checked data-k="${k}"><span class="qac-kind">${QA_LABEL[x.kind].split(' ')[0]}</span><span class="qac-t">${esc(x.label)}${x.i.repeat && x.i.repeat !== 'none' ? ' <span class="tag">repeats: all of them</span>' : ''}</span>
      <span class="qac-when">${c.intent === 'move' ? `<s>${when(x)}</s> → <b>${fmtDate(qaNewDate(c, x))}${(c.dest?.time || x.time) ? ' ' + fmtTime(c.dest?.time || x.time) : ''}</b>` : when(x)}</span></label></li>`).join('')}</ul>
    <div class="row"><button class="btn ${c.intent === 'remove' ? 'danger' : 'primary'}" id="qacGo">${verb}</button><button class="btn" id="qacNo">Cancel</button></div></div>`;
  prev.querySelector('#qacNo').onclick = () => { prev.innerHTML = ''; };
  prev.querySelector('#qacGo').onclick = () => {
    const pick = c.items.filter((x, k) => prev.querySelector(`[data-k="${k}"]`).checked); if (!pick.length) { prev.innerHTML = ''; return; }
    const snap = JSON.stringify(QA_KINDS.map(([, coll]) => D[coll]));
    for (const x of pick) {
      if (c.intent === 'remove') D[x.coll] = D[x.coll].filter(i => i.id !== x.i.id);
      else if (c.intent === 'done') x.i.done = true;
      else { const nd = qaNewDate(c, x); if (x.kind === 'todo') x.i.due = nd; else { x.i.date = nd; if (c.dest?.time) x.i.time = c.dest.time; } }
    }
    save(); const inp = document.getElementById('qaInput'); if (inp) inp.value = ''; render();
    const n = pick.length, what = n === 1 ? pick[0].label : `${n} items`;
    toast(c.intent === 'remove' ? `🗑 Removed ${what}` : c.intent === 'done' ? `✓ Marked ${what} done` : `↪ Moved ${what}`, '', { actions: [['Undo', () => { QA_KINDS.forEach(([, coll], k) => { D[coll] = JSON.parse(snap)[k]; }); save(); render(); toast('Undone', ''); }]] });
  };
}

const QA_LABEL = { assessment: '📝 SAC / exam', session: '📚 Study block', workout: '🏃 Workout', event: '📅 Event', todo: '✅ Task' };
function quickPreview(q) {
  const bits = [QA_LABEL[q.kind] + (q.type && q.type !== 'SAC' ? ` (${q.type})` : '') + (q.category && q.category !== 'Personal' ? ` · ${q.category}` : ''), q.subject && `📚 ${q.subject}`, q.date ? `📆 ${fmtDate(q.date)} (${relDays(diffDays(today(), q.date))})` : (q.kind === 'todo' ? 'no due date' : '📆 pick a date'), q.time && `🕒 ${fmtTime(q.time)}${q.end ? '–' + fmtTime(q.end) : ''}`].filter(Boolean);
  return bits.map(b => `<span class="qa-chip">${esc(b)}</span>`).join('');
}
function quickAddHtml() {
  return `<div class="card quickadd"><form id="qaForm" class="qa-row" autocomplete="off"><span class="qa-ic">✨</span>
      <input id="qaInput" placeholder='Add or change: "Biology SAC next Thu 9am", "move Bio study to Sunday", "remove gym tomorrow"' maxlength="200">
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
  const c = v.length > 2 && parseCommand(v);
  if (prev) prev.innerHTML = v.length > 2 ? (c && (c.items.length || c.strong) ? commandPreview(c) : quickPreview(parseQuick(v))) : '';
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'qaForm') return;
  e.preventDefault();
  const v = document.getElementById('qaInput').value.trim();
  const c = v && parseCommand(v);
  if (c && (c.items.length || c.strong)) commandConfirm(c);
  else if (v) quickAdd(v);
});
// press "/" anywhere to jump to quick add
document.addEventListener('keydown', e => {
  if (e.key !== '/' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || modal.open) return;
  const inp = document.getElementById('qaInput');
  if (inp) { e.preventDefault(); inp.focus(); }
  else { e.preventDefault(); view = 'today'; render(); setTimeout(() => document.getElementById('qaInput')?.focus(), 50); }
});
