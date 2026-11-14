'use strict';
/* 2.36 friends and competition: exam mode, online and studying status,
   seasons and the weekly competition, the grade board (with a privacy
   setting), friends' forests, study pie charts and the unread dot on the
   app's taskbar icon. Everything shared rides in your published stats row. */

// ---------- exam mode: full screen, and leaving ends the session with nothing ----------
let examEnding = false;
function examFull() { try { window.lpFullscreen?.(true); document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); } catch { } }
function examExitFull() { try { window.lpFullscreen?.(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); } catch { } }
function examLeft(why) {
  const f = typeof D !== 'undefined' && D && D.focus; if (!f || !f.exam || examEnding) return;
  examEnding = true;
  const mins = Math.round(focusElapsed(f));
  D.focus = null; focusAskCancel = false;
  save(); renderFocusBar(); examExitFull(); publishMe(true);
  if (!modal.open) render();
  celebrate({ icon: '<span class="critbig">🔒</span>', color: '#e03131', kicker: 'Exam mode', title: 'Exam ended', text: `You ${why} after ${fmtMins(mins) || 'under a minute'}, so the timer stopped. This session isn't logged.`, ok: 'OK' });
  examEnding = false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) examLeft('left the planner'); });
window.addEventListener('blur', () => setTimeout(() => { if (!document.hasFocus()) examLeft('switched to another window'); }, 1200));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setTimeout(() => examLeft('left full screen'), 60); });
// a planner closed or reloaded mid-exam doesn't get the session back
(function examReload() { if (typeof D === 'undefined' || !D) return setTimeout(examReload, 500); if (D.focus && D.focus.exam) examLeft('closed the planner'); })();

// ---------- online and studying ----------
function myStatus() {
  const f = D.focus;
  return { t: Date.now(), s: f ? subj(f.subjectId).name.slice(0, 30) : '', at: f ? f.startedAt + (f.pausedMs || 0) : 0, p: f && f.pausedAt ? 1 : 0, x: f && f.exam ? 1 : 0 };
}
const ONLINE_MS = 11 * 60000;
function friendStatus(f) {
  const st = f.raw?.st || {}, seen = Math.max(f.updated || 0, +st.t || 0);
  if (!seen || Date.now() - seen > ONLINE_MS) return { on: false, txt: seen ? 'Last on ' + ago(new Date(seen).toISOString()) : '' };
  if (st.s && st.at) return { on: true, study: true, txt: `${st.x ? '🔒' : '📚'} ${st.p ? 'Paused on' : 'Studying'} ${st.s} · ${fmtMins((Date.now() - st.at) / 60000) || '1m'}` };
  return { on: true, txt: 'Online' };
}
function statusLine(f) { const s = friendStatus(f); return s.txt ? `<span class="fstatus ${s.on ? 'on' : ''} ${s.study ? 'study' : ''}"><i></i>${esc(s.txt)}</span>` : ''; }
function onlineSummary() {
  const st = allFriendRows().filter(f => f.user).map(friendStatus), on = st.filter(s => s.on).length, sd = st.filter(s => s.study).length;
  return on ? `<span class="fstatus on"><i></i>${on} online${sd ? ` · ${sd} studying` : ''}</span>` : '';
}

// ---------- seasons (school terms) and the year ----------
// Each season is a term plus the holidays after it, so the seasons cover the whole year.
const SEASON_STARTS = ['01-01', '04-20', '07-13', '10-05'];
function seasonOf(d = today()) {
  const y = d.slice(0, 4), md = d.slice(5);
  let i = 0; for (let k = 0; k < 4; k++) if (md >= SEASON_STARTS[k]) i = k;
  return { id: `${y}-${i + 1}`, n: i + 1, from: `${y}-${SEASON_STARTS[i]}`, to: i < 3 ? addDays(`${y}-${SEASON_STARTS[i + 1]}`, -1) : `${y}-12-31` };
}
function seasonStats() {
  const S = seasonOf(), y = today().slice(0, 4);
  const logs = D.focusLogs.filter(l => l.date >= S.from && l.date <= S.to);
  const yWins = (D.arena.battles || []).filter(b => b.win && new Date(b.at).getFullYear() === +y).length;
  return {
    ss: { id: S.id, s: logs.reduce((a, l) => a + l.mins, 0), k: D.workouts.filter(w => w.done && w.date >= S.from && w.date <= S.to).reduce((a, w) => a + (+w.duration || 0), 0), tr: logs.filter(l => l.mins >= 10 && !l.withered).length },
    yr: { y: +y, tr: D.focusLogs.filter(l => l.date.startsWith(y) && l.mins >= 10 && !l.withered).length, w: yWins },
  };
}

// ---------- weekly competition: one event a week ----------
const COMPS = [
  ['⏱️', 'Longest single session', logs => Math.max(0, ...logs.map(l => l.mins)), v => fmtMins(v) || '0m'],
  ['📅', 'Most days with 30m+ study', logs => { const d = {}; for (const l of logs) d[l.date] = (d[l.date] || 0) + l.mins; return Object.values(d).filter(m => m >= 30).length; }, v => `${v} day${v === 1 ? '' : 's'}`],
  ['✦', 'Most focus sessions', logs => logs.filter(l => l.mins >= 10 && !l.withered).length, v => `${v} session${v === 1 ? '' : 's'}`],
  ['🎯', 'Most study blocks ticked off', (logs, from, to) => D.sessions.filter(s => s.done && s.date >= from && s.date <= to).length, v => `${v}`],
  ['🏃', 'Most training', (logs, from, to) => D.workouts.filter(w => w.done && w.date >= from && w.date <= to).reduce((a, w) => a + (+w.duration || 0), 0), v => fmtMins(v) || '0m'],
  ['📚', 'Most study', logs => logs.reduce((a, l) => a + l.mins, 0), v => fmtMins(v) || '0m'],
];
const COMP_PRIZE = 100;
const compFor = wk => COMPS[Math.floor(Date.parse(wk + 'T00:00:00Z') / (7 * 864e5)) % COMPS.length];
function compValue(wk) { const to = addDays(wk, 6); return compFor(wk)[2](D.focusLogs.filter(l => l.date >= wk && l.date <= to), wk, to); }
function compPublish() { const wk = mondayOf(today()), pw = addDays(wk, -7); return { cw: { wk, v: compValue(wk) }, pw: { wk: pw, v: compValue(pw) } }; }
const friendComp = (f, wk) => { const s = f.raw || {}; return s.pw?.wk === wk ? s.pw.v : s.cw?.wk === wk ? s.cw.v : null; };
function compRows(wk) {
  const me = { me: true, name: 'You', av: avatarSpec(), v: compValue(wk) };
  return [me, ...allFriendRows().filter(f => f.user).map(f => ({ name: f.name, av: f.av, v: friendComp(f, wk) })).filter(r => r.v != null)].sort((a, b) => b.v - a.v);
}
// last week's winner gets paid from Tuesday, once friends have had a day to send their final numbers
function settleComp() {
  if (!acct.signedIn || !friendRows.length) return;
  const wk = addDays(mondayOf(today()), -7), C = D.comp = D.comp || { won: [] };
  if (C.settled === wk || new Date().getDay() === 1) return;
  const rows = compRows(wk); C.settled = wk;
  if (rows.length > 1 && rows[0].me && rows[0].v > 0 && rows[0].v > rows[1].v) {
    D.game.ledger['comp:' + wk] = COMP_PRIZE; C.won = [...(C.won || []), wk].slice(-60);
    setTimeout(() => celebrate({ icon: '<span class="critbig">🏆</span>', color: '#f59f00', kicker: 'Weekly competition', title: 'You won last week!', text: `${compFor(wk)[0]} ${compFor(wk)[1]}: ${compFor(wk)[3](rows[0].v)}.` }), 400);
  }
  save();
}
function compCard() {
  const wk = mondayOf(today()), [icon, name, , fmt] = compFor(wk), rows = compRows(wk), lw = addDays(wk, -7), won = (D.comp?.won || []).length;
  const left = 7 - ((new Date().getDay() + 6) % 7);
  return `<div class="card comp"><div class="card-head"><h2>${icon} This week: ${esc(name)}</h2><span class="muted small-text">${left === 1 ? 'ends tonight' : `${left} days left`}</span></div>
    <ol class="lbath">${rows.slice(0, 8).map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="lbpos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${safeBadge(r.av, 28)}<b>${esc(r.name)}</b><span style="flex:1"></span><b class="lbv">${fmt(r.v)}</b></li>`).join('')}</ol>
    <p class="muted small-text" style="margin:6px 0 0">A new event every Monday. Last week was ${compFor(lw)[0]} ${esc(compFor(lw)[1].toLowerCase())}.${won ? ` You've won ${won} week${won === 1 ? '' : 's'} 🏆` : ''}</p></div>`;
}
function seasonCard() {
  const S = seasonOf(), y = today().slice(0, 4), tab = ui.seasonTab || 'season', mine = seasonStats();
  const fr = allFriendRows().filter(f => f.user);
  let rows, cols;
  if (tab === 'season') {
    rows = [{ me: true, name: 'You', av: avatarSpec(), ...mine.ss }, ...fr.filter(f => f.raw?.ss?.id === S.id).map(f => ({ name: f.name, av: f.av, ...f.raw.ss }))]
      .map(r => ({ ...r, v: (r.s || 0) * 2 + (r.k || 0) }));
    cols = r => `<span class="bparts"><span title="Study">📚${fmtMins(r.s) || '0m'}</span><span title="Training">🏃${fmtMins(r.k) || '0m'}</span></span><b class="lbv">${r.v.toLocaleString()} pts</b>`;
  } else {
    rows = [{ me: true, name: 'You', av: avatarSpec(), ...mine.yr }, ...fr.filter(f => f.raw?.yr?.y === +y).map(f => ({ name: f.name, av: f.av, ...f.raw.yr }))]
      .map(r => ({ ...r, v: (r.tr || 0) * 10 }));
    cols = r => `<span class="bparts"><span title="Focus sessions this year">✦${r.tr || 0}</span></span><b class="lbv">${r.v.toLocaleString()} pts</b>`;
  }
  rows.sort((a, b) => b.v - a.v);
  const daysLeft = diffDays(today(), tab === 'season' ? S.to : `${y}-12-31`);
  return `<div class="card"><div class="card-head"><div class="seg"><button class="${tab === 'season' ? 'on' : ''}" data-s2="seasonTab" data-v="season">🗓️ Term ${S.n} season</button><button class="${tab === 'year' ? 'on' : ''}" data-s2="seasonTab" data-v="year">📅 ${y}</button></div><span style="flex:1"></span><span class="muted small-text">${daysLeft} day${daysLeft === 1 ? '' : 's'} left</span></div>
    <ol class="lbath">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="lbpos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${safeBadge(r.av, 28)}<b>${esc(r.name)}</b><span style="flex:1"></span>${cols(r)}</li>`).join('')}</ol>
    <p class="muted small-text" style="margin:6px 0 0">${tab === 'season' ? 'This term and the holidays after it: study counts double, training once. Resets each term.' : 'All year: 10 points for every focus session of 10+ minutes. Resets on 1 January.'}</p></div>`;
}

// ---------- grades: from your SAC and exam results ----------
const GRADE_SHARE = [['none', 'Nobody'], ['rank', 'My place only'], ['marks', 'My marks only'], ['both', 'Marks and place']];
function scorePct(s) {
  s = String(s || '');
  let m = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(s); if (m && +m[2] > 0) return Math.min(100, +m[1] / +m[2] * 100);
  m = /(\d+(?:\.\d+)?)\s*%/.exec(s); if (m) return Math.min(100, +m[1]);
  return null;
}
function myGrades() {
  const y = today().slice(0, 4), by = {};
  for (const a of D.assessments) {
    const p = scorePct(a.score); if (p == null || !(a.date || '').startsWith(y)) continue;
    const w = +(/(\d+(?:\.\d+)?)\s*%/.exec(a.weight || '') || [])[1] || 1, k = a.subjectId;
    (by[k] = by[k] || { w: 0, t: 0, c: 0 }); by[k].w += w; by[k].t += p * w; by[k].c++;
  }
  const subs = Object.entries(by).map(([id, b]) => [subj(id).name.slice(0, 30), Math.round(b.t / b.w * 10) / 10, b.c]);
  return { o: subs.length ? Math.round(subs.reduce((a, s) => a + s[1], 0) / subs.length * 10) / 10 : null, subs };
}
function gradePublish() {
  const sh = D.settings.gradeShare || 'none', g = myGrades();
  if (sh === 'none' || g.o == null) return undefined;
  return { m: sh === 'marks' || sh === 'both' ? 1 : 0, r: sh === 'rank' || sh === 'both' ? 1 : 0, y: +today().slice(0, 4), o: g.o, s: g.subs.slice(0, 12).map(s => s[0].replace(/[=;]/g, ' ') + '=' + s[1]).join(';') };
}
const normSub = n => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
const grSubs = gr => typeof gr?.s === 'string' && gr.s ? gr.s.split(';').map(x => { const i = x.lastIndexOf('='); return [x.slice(0, i), +x.slice(i + 1) || 0]; }) : [];
function gradeCard() {
  const g = myGrades(), sh = D.settings.gradeShare || 'none', key = ui.gradeSub || '';
  const val = (o, subs) => key ? (subs.find(s => normSub(s[0]) === key) || [])[1] ?? null : o;
  const rows = [{ me: true, name: 'You', av: avatarSpec(), v: val(g.o, g.subs), show: true },
    ...allFriendRows().filter(f => f.raw?.gr?.r && f.raw.gr.y === +today().slice(0, 4)).map(f => ({ name: f.name, av: f.av, v: val(f.raw.gr.o, grSubs(f.raw.gr)), show: !!f.raw.gr.m }))].filter(r => r.v != null).sort((a, b) => b.v - a.v);
  const subs = g.subs.map(s => [normSub(s[0]), s[0]]);
  return `<div class="card"><div class="card-head"><h2>🎓 Grades</h2><span style="flex:1"></span>${subs.length ? `<select data-s2change="gradeSub"><option value="">Average</option>${subs.map(([k, n]) => `<option value="${esc(k)}" ${k === key ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}</div>
    ${g.o == null ? '<p class="muted small-text">Add results to your SACs and exams (e.g. 42/50 or 84%) and your weighted average shows here.</p>'
      : `<ol class="lbath">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="lbpos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${safeBadge(r.av, 28)}<b>${esc(r.name)}</b><span style="flex:1"></span><b class="lbv">${r.show ? r.v.toFixed(1) + '%' : '🔒'}</b></li>`).join('')}</ol>`}
    <label class="row small-text" style="margin-top:8px;gap:8px">Friends can see <select data-s2change="gradeShare">${GRADE_SHARE.map(([k, l]) => `<option value="${k}" ${k === sh ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="muted small-text" style="margin:4px 0 0">${sh === 'none' ? 'Your grades stay on this PC.' : sh === 'rank' ? 'You appear on friends\' grade board with a 🔒 instead of your marks. Your average is sent so places can be worked out, but it isn\'t shown.' : sh === 'marks' ? 'Friends see your marks when they open your profile, but you\'re not placed on their grade board.' : 'Friends see your marks and your place.'} Weighted by the % in each result's weighting, this year only.</p></div>`;
}

// ---------- your forest, shared ----------
function forestPublish() {
  const live = D.focusLogs.filter(l => l.mins >= 10);
  return { n: live.length, t: live.slice().sort((a, b) => b.mins - a.mins).slice(0, 40).map(l => [String(l.species || 'oak').replace(/[^a-z0-9_-]/gi, '').slice(0, 16), Math.min(600, l.mins), (subj(l.subjectId).color || '#40c057').replace('#', '').slice(0, 6), l.withered ? 1 : 0].join(':')).join(';') };
}
function friendView(id) {
  const f = allFriendRows().find(x => x.id === id); if (!f) return;
  const s = f.raw || {}, fo = s.fo, gr = s.gr, st = friendStatus(f);
  const trees = (typeof fo?.t === 'string' ? fo.t.split(';').map(x => x.split(':')) : []).filter(t => t.length === 4 && /^[0-9a-f]{6}$/i.test(t[2]));
  const forest = trees.length ? `<div class="ffor">${trees.map(t => `<span title="${esc(fmtMins(t[1]))}">${sunSvg('#' + t[2], Math.min(1, (+t[1] || 0) / 180), Math.round(30 + Math.min(1, (+t[1] || 0) / 180) * 30))}</span>`).join('')}</div>` : '<p class="muted small-text">Their forest shows here once they update to 2.36.</p>';
  const grades = gr?.m && gr.y === +today().slice(0, 4) ? `<h3>🎓 Grades</h3><ul class="hlist">${[['Average', gr.o], ...grSubs(gr)].map(([n, p]) => `<li><div class="main"><b>${esc(String(n))}</b></div><span class="hl-v">${(+p).toFixed(1)}%</span></li>`).join('')}</ul>` : '';
  mform.innerHTML = `<h2>${safeBadge(f.av, 48)} ${esc(f.name)}</h2>
    ${st.txt ? `<p>${statusLine(f)}</p>` : ''}
    <p class="muted small-text">${fo ? `✦ ${fo.n} focus session${fo.n === 1 ? '' : 's'} · showing their biggest ${trees.length}` : ''}</p>
    ${forest}${grades}
    <div class="modal-actions"><button type="button" class="btn" data-act="friendCompare" data-id="${esc(f.id)}">Compare</button><button type="button" class="btn primary" data-mact="cancel">Close</button></div>`;
  modal.showModal();
}

// ---------- study pie charts ----------
function pieSvg(parts, size = 150) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1, r = 15.915;
  let off = 25;
  return `<svg class="pie" viewBox="0 0 42 42" width="${size}" height="${size}"><circle cx="21" cy="21" r="${r}" fill="none" stroke="var(--line, #8883)" stroke-width="7"/>${parts.map(p => {
    const pct = p.v / tot * 100, seg = `<circle cx="21" cy="21" r="${r}" fill="none" stroke="${p.c}" stroke-width="7" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"><title>${esc(p.n)}: ${Math.round(pct)}%</title></circle>`;
    off -= pct; return seg;
  }).join('')}</svg>`;
}
function studyPieCard() {
  const rg = ui.pieRange || 'week', t = today(), S = seasonOf();
  const from = rg === 'week' ? mondayOf(t) : rg === 'term' ? S.from : rg === 'year' ? t.slice(0, 4) + '-01-01' : '0000';
  const by = {}; for (const l of D.focusLogs) if (l.date >= from && l.date <= t) by[l.subjectId] = (by[l.subjectId] || 0) + l.mins;
  const parts = Object.entries(by).map(([id, v]) => { const s = subj(id); return { n: s.name, c: s.color, v }; }).filter(p => p.v > 0).sort((a, b) => b.v - a.v);
  const tot = parts.reduce((a, p) => a + p.v, 0);
  return `<div class="card piecard"><div class="card-head"><h2>Where your study goes</h2><span style="flex:1"></span><div class="seg">${[['week', 'Week'], ['term', 'Term'], ['year', 'Year'], ['all', 'All']].map(([k, l]) => `<button class="${rg === k ? 'on' : ''}" data-s2="pieRange" data-v="${k}">${l}</button>`).join('')}</div></div>
    ${tot ? `<div class="pierow"><div class="piewrap">${pieSvg(parts)}<b>${fmtMins(tot)}</b></div><ul class="pieleg">${parts.map(p => `<li><i style="background:${p.c}"></i>${esc(p.n)}<span style="flex:1"></span><b>${fmtMins(p.v)}</b><small>${Math.round(p.v / tot * 100)}%</small></li>`).join('')}</ul></div>` : '<p class="muted small-text">No study logged in this range yet.</p>'}</div>`;
}

// ---------- study over time: days, weeks and time of day ----------
function studyTimeCard() {
  const md = ui.trendMode || 'days', t = today();
  let cols;
  if (md === 'hours') {
    cols = Array.from({ length: 24 }, (_, h) => ({ k: h, label: h % 6 === 0 ? (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p') : '', tip: h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : h - 12 + 'pm', by: {} }));
    for (const l of D.focusLogs) { if (!l.start || l.date < addDays(t, -89)) continue; const h = new Date(l.start).getHours(); cols[h].by[l.subjectId] = (cols[h].by[l.subjectId] || 0) + l.mins; }
  } else {
    const n = md === 'days' ? 14 : 12, step = md === 'days' ? 1 : 7, end = md === 'days' ? t : mondayOf(t);
    cols = Array.from({ length: n }, (_, i) => { const from = addDays(end, -(n - 1 - i) * step); return { k: from, from, to: addDays(from, step - 1), label: md === 'days' ? (i % 2 === 1 || i === n - 1 ? String(+from.slice(8)) : '') : (i % 3 === 2 || i === n - 1 ? fmtDate(from).replace(/^\w+ /, '') : ''), tip: md === 'days' ? fmtDate(from) : `Week of ${fmtDate(from)}`, by: {} }; });
    const first = cols[0].from;
    for (const l of D.focusLogs) { if (l.date < first || l.date > t) continue; const c = cols.find(c => l.date >= c.from && l.date <= c.to); if (c) c.by[l.subjectId] = (c.by[l.subjectId] || 0) + l.mins; }
  }
  const tot = c => Object.values(c.by).reduce((a, b) => a + b, 0), max = Math.max(30, ...cols.map(tot)), W = 420, H = 110, bw = W / cols.length;
  const sum = cols.reduce((a, c) => a + tot(c), 0);
  const bars = cols.map((c, i) => { let y = H; return Object.entries(c.by).sort((a, b) => b[1] - a[1]).map(([id, m]) => { const h = m / max * H; y -= h; const sb = subj(id); return `<rect x="${(i * bw + bw * .15).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="1.5" fill="${sb.color}"><title>${esc(c.tip)} · ${esc(sb.name)}: ${fmtMins(m)}</title></rect>`; }).join('') + `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 12}" text-anchor="middle">${c.label}</text>`; }).join('');
  const best = md === 'hours' && sum ? cols.reduce((a, c) => tot(c) > tot(a) ? c : a) : null;
  const note = md === 'hours' ? (best ? `You study most around ${best.tip} (last 90 days).` : 'No timed sessions yet.') : `${fmtMins(sum) || '0m'} in the last ${cols.length} ${md === 'days' ? 'days' : 'weeks'} · ${fmtMins(sum / cols.length) || '0m'} a ${md === 'days' ? 'day' : 'week'} on average.`;
  return `<div class="card trendcard"><div class="card-head"><h2>Study over time</h2><span style="flex:1"></span><div class="seg">${[['days', 'Days'], ['weeks', 'Weeks'], ['hours', 'Time of day']].map(([k, l]) => `<button class="${md === k ? 'on' : ''}" data-s2="trendMode" data-v="${k}">${l}</button>`).join('')}</div></div>
    <svg class="trend" viewBox="0 0 ${W} ${H + 16}"><line x1="0" x2="${W}" y1="${H}" y2="${H}"/>${bars}</svg>
    <p class="muted small-text" style="margin:6px 0 0">${note} Tallest bar ${fmtMins(Math.max(...cols.map(tot))) || '0m'}.</p></div>`;
}

// ---------- unread dot on the app's taskbar icon ----------
let badgeShown = -1, badgeIcon = null;
function setAppBadge(n) {
  n = Math.max(0, n | 0); if (n === badgeShown) return; badgeShown = n;
  try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => { }); } catch { }
  if (!ONLINE) fetch('/api/badge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n }) }).catch(() => { });
  // the window's icon (and so its taskbar button) comes from the page's icon
  const link = document.querySelector('link[rel~="icon"]') || Object.assign(document.head.appendChild(document.createElement('link')), { rel: 'icon' });
  if (!link.dataset.base) link.dataset.base = link.getAttribute('href') || 'icon-192.png';
  if (!n) { link.href = link.dataset.base; return; }
  const draw = () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.drawImage(badgeIcon, 0, 0, 64, 64);
    x.fillStyle = '#e03131'; x.beginPath(); x.arc(46, 18, 17, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n > 9 ? '9+' : String(n), 46, 19);
    link.href = c.toDataURL('image/png');
  };
  if (badgeIcon?.complete) draw(); else { badgeIcon = new Image(); badgeIcon.onload = draw; badgeIcon.src = 'icon-192.png'; }
}

// ---------- clicks ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-s2]'); if (!el) return;
  e.preventDefault();
  const a = el.dataset.s2;
  if (a === 'seasonTab' || a === 'pieRange' || a === 'trendMode') { ui[a] = el.dataset.v; render(); }
  else if (a === 'friendView') friendView(el.dataset.id);
  else if (a === 'examStart') { if (!D.subjects.length) return alert('Add a subject first.'); showForm({ title: '🔒 Exam mode', saveLabel: 'Start exam', fields: [{ key: 'subjectId', label: 'Subject', type: 'select', options: subjOpts(), value: D.subjects[0].id }], onSave: v => { setTimeout(() => startFocus(v.subjectId, '', true), 0); } }); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-s2change]'); if (!el) return;
  const k = el.dataset.s2change;
  if (k === 'gradeShare') { D.settings.gradeShare = el.value; save(); publishMe(true); }
  else ui[k] = el.value;
  render();
});
