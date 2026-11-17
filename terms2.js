'use strict';
/* 2.63 Term features (roadmap stage 2).
   - Term goals: up to 3 a term (study hours, training hours, a SAC score), set by the
     end of Week 2, then locked. One progress bar each; hitting one pays 100 Lumen or Ember.
   - Weekly study targets per subject (e.g. Methods 3h). A target goes up a bit in the
     2 weeks before a SAC, test or exam in that subject.
   - The Chronicle: a recap of the term, shown on the last afternoon of term (or the first
     time Solis opens in the holidays), saved so past terms can be looked back at, with an
     image to copy or save.
   - Seasons: each term is a season. Every week a house scores the % of its boss it took
     down (the Term Boss week counts double). The top 3 houses at the end of term win
     Lumen and Ember for every member who played. Standings are noted from the house
     rows Solis sees each week (D.term2.wk).
   The house boss resting in the holidays and the Term Boss live in terms.js (bossWeek),
   houses.js and fight.js. */

const T2_GOALS = {
  study: { n: 'Study hours', e: '📚', u: 'h', def: 60, max: 600 },
  train: { n: 'Training hours', e: '🏃', u: 'h', def: 30, max: 400 },
  sac: { n: 'SAC average', e: '🎓', u: '%', def: 80, max: 100 },
};
const T2_MAX_GOALS = 3, T2_GOAL_PAY = 100, T2_SEASON_PAY = [150, 100, 50];
const t2 = () => (D.term2 = Object.assign({ goals: {}, tgt: {}, recaps: {}, wk: {} }, D.term2 || {}));
const t2Name = T => T.real ? `Term ${T.n} ${T.y}` : `Term ${T.n} ${T.y} (calendar quarter)`;

// goals are for the term you're in, or in the holidays, the term coming up
function t2GoalTerm() {
  const t = today(), T = termOf(t);
  if (t > T.to) { const N = termNext(t); if (N) return { y: N.y, n: N.n, from: N.from, to: N.to, key: `${N.y}-T${N.n}`, real: true, next: true }; }
  return T;
}
const t2Lock = T => addDays(mondayOf(T.from), 14); // goals lock when Week 2 ends
const t2CanEdit = T => today() < t2Lock(T);

function t2Study(from, to, sid) { let m = 0; for (const l of D.focusLogs) if (l.date >= from && l.date <= to && (!sid || l.subjectId === sid)) m += +l.mins || 0; return m; }
function t2Train(from, to) { let m = 0; for (const w of D.workouts) if (w.done && w.date >= from && w.date <= to) m += +w.duration || 0; return m; }
// a subject's SAC score for one term: the weighted average of single results, or the term score
function t2Sac(key, sid) {
  const st = cdState(), list = st.res?.[key]?.[sid];
  if (list?.length) { const W = list.reduce((a, r) => a + (+r.w || 1), 0); return Math.round(list.reduce((a, r) => a + r.v * (+r.w || 1), 0) / W); }
  const v = st.scores?.[key]?.[sid]; return v !== '' && v != null && !isNaN(+v) ? +v : null;
}
function t2SacAvg(key) { const v = D.subjects.map(s => t2Sac(key, s.id)).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
function t2Prog(g, T) {
  const end = T.to < today() ? T.to : today();
  if (g.k === 'study') return t2Study(T.from, end) / 60;
  if (g.k === 'train') return t2Train(T.from, end) / 60;
  return (g.s ? t2Sac(T.key, g.s) : t2SacAvg(T.key)) || 0;
}
const t2GoalName = g => g.k === 'sac' ? (g.s ? `${subj(g.s).name} SAC average` : 'SAC average, all subjects') : T2_GOALS[g.k].n;
const t2Pay = k => k === 'study' ? [T2_GOAL_PAY, 0] : k === 'train' ? [0, T2_GOAL_PAY] : [T2_GOAL_PAY / 2, T2_GOAL_PAY / 2];

function t2PayGoals() {
  const T = termOf(), G = t2().goals[T.key] || []; let n = 0;
  for (const g of G) {
    if (g.paid || !(t2Prog(g, T) >= g.n)) continue;
    g.paid = today(); n++;
    const [l, e] = t2Pay(g.k); if (typeof ftAddCurrency === 'function') ftAddCurrency(l, e);
    toast(`🎯 Term goal hit: ${t2GoalName(g)}`, `${g.n}${T2_GOALS[g.k].u} reached. +${[l && `${l} Lumen`, e && `${e} Ember`].filter(Boolean).join(' +')}`);
  }
  if (n) save();
  return n;
}

// this week's study target for a subject: raised in the 2 weeks before a SAC, test or exam
function t2Target(s, wk = mondayOf(today())) {
  const base = +t2().tgt[s.id] || 0; if (!base) return null;
  const a = D.assessments.filter(a => a.subjectId === s.id && !a.done && /sac|exam|test/i.test(a.type || '') && a.type !== 'Practice exam' && a.date >= wk && a.date <= addDays(wk, 13)).sort((x, y) => x.date.localeCompare(y.date))[0];
  return { base, h: a ? Math.max(base + .5, Math.round(base * 1.25 * 2) / 2) : base, a };
}
const t2H = h => { const m = Math.round(h * 60); return m ? fmtMins(m) : '0m'; };

// ---------- the Term card (Study page) ----------
function t2TermCard() {
  if (!D.subjects) return '';
  t2PayGoals();
  const t = today(), T = termOf(t), G0 = t2GoalTerm(), S = t2(), hol = t > T.to;
  const wk = mondayOf(t), total = Math.max(1, diffDays(T.from, T.to) + 1), done = Math.max(0, Math.min(total, diffDays(T.from, t) + 1));
  const wLeft = Math.max(0, Math.ceil(diffDays(t, T.to) / 7));
  const head = hol ? `🌴 Holidays · ${t2Name(T)} is over` : `${t2Name(T)}${T.real ? ` · Week ${termWeek(t)}` : ''} · ${wLeft ? `${wLeft} week${wLeft === 1 ? '' : 's'} left` : 'last week'}`;
  // goals
  const goals = S.goals[G0.key] || [], edit = t2CanEdit(G0), lock = t2Lock(G0);
  const goalRow = g => {
    const v = G0.next ? 0 : t2Prog(g, G0), pct = Math.min(100, Math.round(v / g.n * 100)), u = T2_GOALS[g.k].u;
    return `<div class="t2goal ${g.paid ? 'hit' : ''}"><div class="row"><span>${T2_GOALS[g.k].e} <b>${esc(t2GoalName(g))}</b></span><span class="muted small-text">${g.paid ? '✅ hit' : `${u === 'h' ? t2H(v) : Math.round(v) + '%'} of ${g.n}${u}`}</span>${edit ? `<button class="iconbtn" data-t2="del" data-id="${g.id}" title="Remove">✕</button>` : ''}</div><div class="t2bar"><i style="width:${pct}%"></i></div></div>`;
  };
  const kinds = Object.entries(T2_GOALS).map(([k, x]) => `<option value="${k}">${x.e} ${x.n}</option>`).join('');
  const addRow = edit && goals.length < T2_MAX_GOALS ? `<div class="t2add row"><select data-t2n="k">${kinds}</select><input type="number" data-t2n="n" min="1" max="600" placeholder="target" style="width:84px"><select data-t2n="s" title="For a SAC goal: one subject or all"><option value="">All subjects</option>${D.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn small primary" data-t2="add">＋ Add goal</button></div>` : '';
  const goalNote = edit ? `Pick up to ${T2_MAX_GOALS} by the end of Week 2 (${fmtDate(addDays(lock, -1))}), then they lock. Each one you hit pays ${T2_GOAL_PAY} ${LUMEN} or ${EMBER}.` : goals.length ? `Locked since ${fmtDate(lock)}.` : `Goals had to be set by the end of Week 2. Next term's open in the holidays.`;
  // weekly targets
  const rest = typeof bossWeek === 'function' && bossWeek(wk) === 'rest';
  const tgts = D.subjects.map(s => ({ s, x: t2Target(s, wk), m: t2Study(wk, addDays(wk, 6), s.id) }));
  const tRow = ({ s, x, m }) => {
    if (ui.t2Edit) return `<div class="t2tg row"><span><span class="dot" style="background:${s.color}"></span> ${esc(s.name)}</span><input type="number" min="0" max="40" step="0.5" value="${S.tgt[s.id] || ''}" placeholder="0" data-t2tgt="${s.id}" style="width:70px"> <span class="muted small-text">h a week</span></div>`;
    if (!x) return '';
    const pct = Math.min(100, Math.round(m / 60 / x.h * 100));
    return `<div class="t2tg"><div class="row"><span><span class="dot" style="background:${s.color}"></span> ${esc(s.name)}</span><span class="small-text"><b>${t2H(m / 60)}</b> of ${t2H(x.h)}${x.a ? ` <span class="tag amber" title="Raised from ${t2H(x.base)} for ${esc(x.a.title)}">${esc(x.a.type || 'SAC')} ${fmtDate(x.a.date)}</span>` : ''}${pct >= 100 ? ' ✅' : ''}</span></div><div class="t2bar" style="--c:${s.color}"><i style="width:${pct}%"></i></div></div>`;
  };
  const tHtml = tgts.map(tRow).join('');
  // Chronicle buttons
  const past = Object.entries(S.recaps).filter(([, r]) => r && !r.skip).sort((a, b) => b[0].localeCompare(a[0]));
  return `<div class="card t2card"><div class="card-head"><h2>🗓️ ${esc(head)}</h2><span style="flex:1"></span>${past.slice(0, 4).map(([k, r]) => `<button class="btn small ghost" data-t2="recap" data-k="${k}" title="Look back at ${esc(r.name)}">📜 ${esc(r.name)}</button>`).join('')}</div>
    ${hol ? '' : `<div class="t2term" title="${done} of ${total} days"><i style="width:${Math.round(done / total * 100)}%"></i></div>`}
    <div class="t2cols">
      <div><h3>🎯 ${G0.next ? `Goals for ${t2Name(G0)}` : 'Term goals'}</h3>${goals.map(goalRow).join('') || `<p class="muted small-text">No goals yet.</p>`}${addRow}<p class="muted small-text">${goalNote}</p></div>
      <div><div class="row" style="justify-content:space-between"><h3>⏱️ This week's study targets</h3><button class="btn small ghost" data-t2="tedit">${ui.t2Edit ? 'Done' : 'Set targets'}</button></div>
        ${rest && !ui.t2Edit ? '<p class="muted small-text">🌴 Holidays: targets are optional this week.</p>' : ''}
        ${tHtml || '<p class="muted small-text">Give each subject a weekly hours target (for example Methods 3h). It goes up a little in the 2 weeks before a SAC or exam.</p>'}</div>
    </div></div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-t2]'); if (!el || !D) return;
  const S = t2(), G0 = t2GoalTerm();
  switch (el.dataset.t2) {
    case 'add': {
      if (!t2CanEdit(G0)) return;
      const box = el.closest('.t2add'), k = box.querySelector('[data-t2n="k"]').value, n = +box.querySelector('[data-t2n="n"]').value || T2_GOALS[k].def, s = k === 'sac' ? box.querySelector('[data-t2n="s"]').value : '';
      const L = S.goals[G0.key] = S.goals[G0.key] || []; if (L.length >= T2_MAX_GOALS) return;
      L.push({ id: uid(), k, n: Math.max(1, Math.min(T2_GOALS[k].max, Math.round(n))), s }); save(); render(); break;
    }
    case 'del': { if (!t2CanEdit(G0)) return; S.goals[G0.key] = (S.goals[G0.key] || []).filter(g => g.id !== el.dataset.id); save(); render(); break; }
    case 'tedit': ui.t2Edit = !ui.t2Edit; render(); break;
    case 'recap': t2ShowRecap(el.dataset.k); break;
  }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset?.t2tgt || !D) return;
  const v = Math.max(0, Math.min(40, Math.round((+el.value || 0) * 2) / 2)), S = t2();
  if (v) S.tgt[el.dataset.t2tgt] = v; else delete S.tgt[el.dataset.t2tgt];
  save();
});

// ---------- seasons ----------
function t2NoteWeek() {
  if (typeof hsState !== 'function' || !hsState().id) return;
  const wk = mondayOf(today()), bw = bossWeek(wk); if (bw === 'rest') return;
  const o = {};
  for (const h of HS_HOUSES) { const f = hsFight(h.id); if (f.rows.length) o[h.id] = Math.min(100, Math.round(f.dealt / f.hp * 100)) * (bw === 'term' ? 2 : 1); }
  const W = t2().wk; if (JSON.stringify(W[wk]) === JSON.stringify(o)) return;
  W[wk] = o; for (const k in W) if (k < addDays(wk, -200)) delete W[k];
  save();
}
function t2Season(T = termOf()) {
  const pts = {}, w0 = mondayOf(T.from);
  for (const [wk, o] of Object.entries(t2().wk)) if (wk >= w0 && wk <= T.to) for (const [h, p] of Object.entries(o || {})) pts[h] = (pts[h] || 0) + (+p || 0);
  return HS_HOUSES.map(x => ({ h: x.id, x, pts: pts[x.id] || 0 })).sort((a, b) => b.pts - a.pts);
}
function t2SeasonCard() {
  const T = termOf(), S = t2Season(T), me = hsState().id, medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  return `<div class="card t2season"><div class="card-head"><h3>🏆 Season ranking · ${esc(t2Name(T))}</h3></div>
    <ol class="hsrank">${S.map((r, i) => `<li class="${r.h === me ? 'me' : ''}"><span class="hsm">${medal(i)}</span><span class="hsdot" style="background:${r.x.col}"></span><b>${r.x.e} ${r.x.name}</b><span></span><span>${r.pts.toLocaleString()} pts</span></li>`).join('')}</ol>
    <p class="muted small-text">Each term is a season. Every week a house scores the % of its own boss it took down, so small houses can win (the Term Boss in the last week counts double). At the end of term the top 3 houses win ${T2_SEASON_PAY.join(' / ')} ${LUMEN} and ${EMBER} for each member who fought.</p></div>`;
}

// ---------- the Chronicle ----------
function t2MakeRecap(T) {
  const from = T.from, to = T.to < today() ? T.to : today(), w0 = mondayOf(from), G = t2().goals[T.key] || [];
  const won = Object.entries(hsState().seen || {}).filter(([wk, r]) => wk >= w0 && wk <= T.to && r && r.won);
  const byDay = {}; for (const l of D.focusLogs) if (l.date >= from && l.date <= to) byDay[l.date] = (byDay[l.date] || 0) + (+l.mins || 0);
  let best = 0, run = 0, l = 0, e = 0, fought = false;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (byDay[d] >= 30) best = Math.max(best, ++run); else if (!isHoliday(d)) run = 0;
    const x = cdDay(d); l += x.lumen; e += x.ember;
  }
  const ft = typeof ftState === 'function' ? ftState() : { dmg: {} };
  for (const wk in ft.dmg) if (wk >= w0 && wk <= T.to && ft.dmg[wk] > 0) fought = true;
  const my = hsState().id, S = t2Season(T), rank = my ? S.findIndex(r => r.h === my) + 1 : 0, mine = S.find(r => r.h === my);
  const prize = rank && rank <= 3 && mine?.pts > 0 && (fought || won.length) ? T2_SEASON_PAY[rank - 1] : 0;
  return {
    name: t2Name(T).replace(' (calendar quarter)', ''), from, to: T.to, study: t2Study(from, to), train: t2Train(from, to),
    sac: t2SacAvg(T.key), sacPrev: t2SacAvg(termOf(addDays(from, -1)).key), goals: G.length, hit: G.filter(g => g.paid).length,
    bosses: won.length, tb: won.some(([, r]) => r.tb) ? 1 : 0, house: my || '', rank: mine?.pts > 0 ? rank : 0, streak: best, l: Math.round(l), e: Math.round(e), prize, at: today(),
  };
}
let t2Busy = false;
function t2Check() {
  if (!D || !D.settings || t2Busy) return;
  t2PayGoals();
  const t = today(), T = termOf(t), S = t2();
  if (S.recaps[T.key]) return;
  if (!(t > T.to || (t === T.to && new Date().getHours() >= 15))) return; // the last afternoon of term, or the holidays
  const r = t2MakeRecap(T);
  if (!r.study && !r.train && !r.bosses) return; // nothing happened this term: no Chronicle
  S.recaps[T.key] = r;
  if (r.prize && typeof ftAddCurrency === 'function') ftAddCurrency(r.prize, r.prize);
  save(); t2ShowRecap(T.key, true);
}
function t2Tiles(r) {
  const h = typeof hsHouse === 'function' && r.house ? hsHouse(r.house) : null, d = r.sac != null && r.sacPrev != null ? r.sac - r.sacPrev : null;
  return [
    ['📚', t2H(r.study / 60), 'studied'],
    ['🏃', t2H(r.train / 60), 'trained'],
    ['🎓', r.sac != null ? `${r.sac}%` : '–', r.sac == null ? 'no SAC scores' : d == null ? 'SAC average' : `SAC average · ${d > 0 ? '▲' : d < 0 ? '▼' : '='}${Math.abs(d)} vs last term`],
    ['🎯', r.goals ? `${r.hit}/${r.goals}` : '–', r.goals ? 'term goals hit' : 'no term goals set'],
    ['⚔️', String(r.bosses), `boss${r.bosses === 1 ? '' : 'es'} beaten${r.tb ? ' · 👑 Term Boss' : ''}`],
    ['🏆', h && r.rank ? `#${r.rank}` : '–', h ? `${h.e} ${h.name} this season${r.prize ? ` · +${r.prize} each` : ''}` : 'no house yet'],
    ['🔥', String(r.streak), `best streak (day${r.streak === 1 ? '' : 's'})`],
    ['✨', `${r.l.toLocaleString()} / ${r.e.toLocaleString()}`, 'Lumen / Ember earned'],
  ];
}
function t2ShowRecap(key, fresh) {
  const r = t2().recaps[key]; if (!r || r.skip) return;
  if (document.querySelector('dialog[open]') || (typeof wiz !== 'undefined' && wiz)) { setTimeout(() => t2ShowRecap(key, fresh), 4000); return; }
  const dlg = document.createElement('dialog'); dlg.id = 'chronicle';
  dlg.innerHTML = `<div class="ch-head"><div class="ch-pic">📜</div><div><div class="ch-kicker">The Chronicle${fresh ? ' · term over' : ''}</div><h2>${esc(r.name)}</h2><div class="muted small-text">${fmtDate(r.from)} to ${fmtDate(r.to)}${esc(D.settings.name ? ' · ' + D.settings.name : '')}</div></div></div>
    <div class="ch-grid">${t2Tiles(r).map(([e, v, l]) => `<div><span>${e}</span><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
    ${fresh ? `<p class="small-text">${r.prize ? `🏆 Your house finished in the top 3: +${r.prize} ${LUMEN} and +${r.prize} ${EMBER}. ` : ''}It's saved: look back any time from the Term card on Study.</p>` : ''}
    <div class="modal-actions"><button class="btn" data-ch="copy">📋 Copy image</button><button class="btn" data-ch="save">💾 Save image</button><span style="flex:1"></span><button class="btn primary" data-ch="ok">Close</button></div>`;
  dlg.addEventListener('click', async e => {
    const b = e.target.closest('[data-ch]'); if (e.target === dlg) { dlg.close(); return; } if (!b) return;
    if (b.dataset.ch === 'ok') { dlg.close(); return; }
    const c = t2Image(r);
    if (b.dataset.ch === 'save') { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `Solis Chronicle ${r.name}.png`; a.click(); return; }
    try { const blob = await new Promise(res => c.toBlob(res, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('📋 Image copied', 'Paste it into a chat to share your term.'); }
    catch { toast('Could not copy', 'Use Save image instead.'); }
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg); dlg.showModal();
  if (fresh && typeof sfx === 'function') try { sfx('levelup'); } catch { }
}
// the shareable picture
function t2Image(r) {
  const W = 1200, H = 675, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b1f38'); g.addColorStop(1, '#3b2a5c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,200,90,.12)'; x.beginPath(); x.arc(W - 120, 90, 260, 0, 7); x.fill();
  x.fillStyle = '#ffcf6b'; x.font = '700 26px Segoe UI, sans-serif'; x.fillText('📜 THE CHRONICLE', 60, 76);
  x.fillStyle = '#fff'; x.font = '800 58px Segoe UI, sans-serif'; x.fillText(r.name, 60, 142);
  x.fillStyle = 'rgba(255,255,255,.65)'; x.font = '24px Segoe UI, sans-serif'; x.fillText(`${D.settings.name || 'A Solis player'} · ${fmtDate(r.from)} to ${fmtDate(r.to)}`, 60, 182);
  t2Tiles(r).forEach(([e, v, l], i) => {
    const cx = 60 + (i % 4) * 275, cy = 225 + Math.floor(i / 4) * 195;
    x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, 255, 175, 18) : x.rect(cx, cy, 255, 175); x.fill();
    x.font = '34px Segoe UI Emoji, sans-serif'; x.fillText(e, cx + 20, cy + 50);
    x.fillStyle = '#fff'; x.font = '800 40px Segoe UI, sans-serif'; x.fillText(v, cx + 20, cy + 108, 220);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '19px Segoe UI, sans-serif'; x.fillText(l, cx + 20, cy + 145, 220);
  });
  x.fillStyle = '#ffcf6b'; x.font = '700 24px Segoe UI, sans-serif'; x.textAlign = 'right'; x.fillText('☀ Solis', W - 60, H - 34);
  return c;
}
