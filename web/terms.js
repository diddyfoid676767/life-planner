'use strict';
/* 2.60 School term dates. The planner reads them from your school calendar feed
   (events like "Term 4 | Week 1", "Term 3 | Ends", "Mid Term Break", "Public Holiday")
   and you can edit or add terms by hand in Settings. Days between terms, mid term
   break days and public holidays count as holidays: no school day, no class mode,
   a safe streak, a calm Today, and island wear pauses. */

// Westbourne Grammar 2027 (official term dates): students' first and last days, and the days off inside terms
const TERMS_BUILTIN = [{ y: 2027, n: 1, from: '2027-02-01', to: '2027-03-25' }, { y: 2027, n: 2, from: '2027-04-13', to: '2027-06-25' }, { y: 2027, n: 3, from: '2027-07-13', to: '2027-09-10' }, { y: 2027, n: 4, from: '2027-10-04', to: '2027-12-03' }];
const DAYS_OFF_BUILTIN = { '2027-03-08': 'Labour Day', '2027-05-10': 'Mid-term break', '2027-06-14': "King's Birthday", '2027-08-09': 'Mid-term break', '2027-10-29': 'Student-free day', '2027-11-01': 'Mid-term break', '2027-11-02': 'Melbourne Cup' };
const termList = () => {
  const mine = (D.settings.terms || []).filter(t => t && (t.from || t.to));
  const built = TERMS_BUILTIN.filter(b => !mine.some(t => t.y === b.y && t.n === b.n)).map(b => ({ ...b, id: 'b' + b.y + b.n, auto: true, builtin: true }));
  return [...mine, ...built].sort((a, b) => (a.y - b.y) || (a.n - b.n));
};
const dayOffName = d => DAYS_OFF_BUILTIN[d] || '';
const TERM_FEED_RE = /^term\s*(\d)\s*\|\s*(.*)$/i;
let termMemo = { key: '', gaps: [], days: new Set() };
function termData() {
  const T = termList(), key = JSON.stringify(T) + Object.values(D.feedCache || {}).map(c => c.fetched || 0).join(',') + (D.feeds || []).length;
  if (termMemo.key === key) return termMemo;
  const gaps = [];
  for (let i = 0; i + 1 < T.length; i++) if (T[i].to && T[i + 1].from && T[i + 1].from > addDays(T[i].to, 1)) gaps.push({ from: addDays(T[i].to, 1), to: addDays(T[i + 1].from, -1) });
  // after the last term of a year: holidays until late January
  const last = T[T.length - 1];
  if (last && last.n === 4 && last.to) gaps.push({ from: addDays(last.to, 1), to: `${last.y + 1}-01-26` });
  const days = new Set(Object.keys(DAYS_OFF_BUILTIN));
  for (const f of D.feeds || []) {
    if (f.enabled === false) continue;
    for (const x of D.feedCache?.[f.id]?.items || []) if (/public holiday|mid[- ]?term break|pupil[- ]?free|student[- ]?free/i.test(x.t || '') && !TERM_FEED_RE.test(x.t || '')) days.add(x.d);
  }
  return termMemo = { key, gaps, days };
}
const termHoliday = d => { const m = termData(); return m.days.has(d) || m.gaps.some(g => g.from <= d && d <= g.to); };
function termAt(d) { return termList().find(t => (t.from || '0000') <= d && d <= (t.to || '9999') && t.from && t.to) || null; }
function termWeek(d) { const t = termAt(d); return t ? Math.floor(diffDays(mondayOf(t.from), d) / 7) + 1 : 0; }
function termLine(d) {
  if (isHoliday(d) && !isSchoolDay(d)) { if (dayOffName(d)) return `🌴 ${dayOffName(d)}`; const g = termData().gaps.find(g => g.from <= d && d <= g.to); if (g) return `🌴 School holidays · back ${fmtDate(addDays(g.to, 1))}`; return '🌴 Day off'; }
  const t = termAt(d); return t ? `Term ${t.n} · Week ${termWeek(d)}` : '';
}
// read the terms out of the school calendar feeds
function importTerms(quiet) {
  const found = {};
  for (const f of D.feeds || []) {
    for (const x of D.feedCache?.[f.id]?.items || []) {
      const m = TERM_FEED_RE.exec((x.t || '').trim()); if (!m || !x.d) continue;
      const n = +m[1], what = m[2].toLowerCase(), y = +x.d.slice(0, 4), k = `${y}-${n}`, o = found[k] = found[k] || { y, n };
      if (/^ends?\b/.test(what)) o.to = o.to && o.to > x.d ? o.to : x.d;
      else if (/week\s*\d|commence|begin|start/.test(what) && !/break/.test(what)) o.from = !o.from || x.d < o.from ? x.d : o.from;
    }
  }
  // a term whose start isn't in the feed (only unprefixed "Week 5" days): count back from its first week day
  for (const o of Object.values(found)) if (o.to && !o.from) {
    let best = null;
    for (const f of D.feeds || []) for (const x of D.feedCache?.[f.id]?.items || []) { const m = /^week\s*(\d+)$/i.exec((x.t || '').trim()); if (m && x.d <= o.to && x.d >= addDays(o.to, -75) && (!best || x.d < best.d)) best = { d: x.d, w: +m[1] }; }
    if (best) o.from = addDays(mondayOf(best.d), -7 * (best.w - 1));
  }
  const have = D.settings.terms = D.settings.terms || [];
  let changed = 0;
  for (const o of Object.values(found)) {
    if (!o.from && !o.to) continue;
    let t = have.find(h => h.y === o.y && h.n === o.n);
    if (!t) { t = { id: uid(), y: o.y, n: o.n, from: '', to: '', auto: true }; have.push(t); changed++; }
    if (!t.auto) continue; // a term you edited by hand stays as you set it
    for (const k of ['from', 'to']) if (o[k] && t[k] !== o[k]) { t[k] = o[k]; changed++; }
  }
  if (changed) { save(); if (!quiet) render(); }
  if (!quiet) toast(changed ? `📅 ${changed} term date${changed === 1 ? '' : 's'} imported` : 'No new term dates found', changed ? 'Taken from your school calendar. Edit them under Settings, Calendars.' : 'Connect your school calendar first, or type the dates in.');
  return changed;
}
function termsCard() {
  const T = termList();
  const row = t => `<div class="row termrow" data-term="${t.id}"><b style="min-width:62px">Term ${t.n}</b><input type="number" min="2020" max="2100" value="${t.y}" data-term-f="y" data-id="${t.id}" style="width:78px" title="Year"><input type="date" value="${t.from || ''}" data-term-f="from" data-id="${t.id}" title="First day"><span class="muted">to</span><input type="date" value="${t.to || ''}" data-term-f="to" data-id="${t.id}" title="Last day">
    ${t.builtin ? '<span class="tag" title="Official school dates, built in. Edit them to change.">official</span>' : t.auto ? '<span class="tag" title="Read from your school calendar">from calendar</span>' : ''}${t.builtin ? '' : `<button class="iconbtn" data-term="del" data-id="${t.id}" title="Remove">✕</button>`}</div>`;
  const g = termData().gaps.filter(g => g.to >= today()).slice(0, 2);
  return `<div class="card" data-sec="calendars" style="grid-column:1/-1"><div class="card-head"><h2>🗓️ School term dates</h2><button class="btn small" data-term="import">Read from my calendar</button><button class="btn small primary" data-term="add">＋ Add a term</button></div>
    <p class="muted small-text" style="margin-top:0">The planner works around these. Holidays between terms, mid term breaks and public holidays are days off: no class mode, your streak is safe, and wear on your islands pauses. Dates are read from your school calendar when it refreshes; anything you edit by hand is left alone.</p>
    ${T.length ? T.map(row).join('') : '<div class="empty">No term dates yet. Press “Read from my calendar”, or add them yourself.</div>'}
    ${g.length ? `<p class="muted small-text" style="margin:8px 0 0">${g.map(x => `Holidays ${fmtDate(x.from)} to ${fmtDate(x.to)}`).join(' · ')}</p>` : ''}</div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-term]'); if (!el || !D) return;
  const a = el.dataset.term;
  if (a === 'import') importTerms(false);
  else if (a === 'add') { const T = termList(), l = T[T.length - 1], n = l ? (l.n % 4) + 1 : 1, y = l ? (l.n === 4 ? l.y + 1 : l.y) : new Date().getFullYear(); (D.settings.terms = D.settings.terms || []).push({ id: uid(), y, n, from: '', to: '' }); save(); render(); }
  else if (a === 'del') { D.settings.terms = (D.settings.terms || []).filter(t => t.id !== el.dataset.id); save(); render(); }
});
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset?.termF; if (!k || !D) return;
  let t = (D.settings.terms || []).find(x => x.id === el.dataset.id);
  if (!t) { const b = termList().find(x => x.id === el.dataset.id); if (!b) return; t = { ...b, id: uid() }; delete t.builtin; (D.settings.terms = D.settings.terms || []).push(t); }
  t[k] = k === 'y' ? +el.value : el.value; t.auto = false; save(); render();
});
