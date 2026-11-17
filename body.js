'use strict';
/* Fitness: three tabs. Train (today, log a workout, plan, recent sessions),
   Progress (bests, lift PRs, charts, weekly goal) and Body (your Body card
   stats, heat map and weight). Workouts earn Ember and grow the Body card
   (cards.js). */

// freshness-only readiness (battles still read this; there is no sleep or heart rate input any more)
function readiness() {
  const fr = freshness(), score = Math.round(fr);
  const tier = score >= 85 ? ['🚀', 'Peak', 15, 0] : score >= 70 ? ['💪', 'Ready', 8, 0] : score >= 50 ? ['🙂', 'Okay', 0, 0] : ['😴', 'Run down', -10, 0];
  return { score, fr, sleepPct: null, rhrPct: null, sleep: 0, rhr: 0, icon: tier[0], label: tier[1], hp: tier[2], energy: tier[3] };
}

function weekTotals(from) {
  const to = addDays(from, 6);
  const ws = D.workouts.filter(w => w.date >= from && w.date <= to);
  const done = ws.filter(w => w.done), mins = done.reduce((a, w) => a + (+w.duration || 0), 0);
  let ember = 0; for (let i = 0; i < 7 && addDays(from, i) <= today(); i++) ember += cdDay(addDays(from, i)).ember;
  return { mins, done: done.length, planned: ws.length, ember };
}
const workoutEmber = w => w.done && +w.duration >= CD_MIN ? Math.round(Math.min(+w.duration, CD_CAP_TRAIN) * (CD_INT[w.intensity] || 1)) : 0;

// ---------- Train ----------
function trainToday() {
  const t = today(), w = weekTotals(mondayOf(t)), ci = comboInfo();
  const next = D.workouts.filter(x => !x.done && x.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  const body = cdBody(), low = BODY_STATS.map(([k, n]) => [n, body[k] || 0]).sort((a, b) => a[1] - b[1])[0];
  const P = liftPRs(), prs = Object.entries(P).sort((a, b) => b[1].last.localeCompare(a[1].last)).slice(0, 3);
  const F = fitCfg(), gm = +F.goalMins || 0, gs = +F.goalSess || 0;
  const goal = gm || gs ? `<div class="muted small-text">Goal: ${[gm && `${fmtMins(w.mins) || '0m'} / ${fmtMins(gm)}`, gs && `${w.done}/${gs} sessions`].filter(Boolean).join(' · ')}</div>` : '';
  const hint = low && Object.values(body).some(v => v > 5) ? `<div class="muted small-text">Lowest Body stat: <b>${low[0]}</b>. Train it to lift your card.</div>` : '';
  const tile = (icon, big, label) => `<div class="btile"><span>${icon}</span><b>${big}</b><small>${label}</small></div>`;
  return `<div class="card"><div class="btiles">${tile(EMBER, w.ember.toLocaleString(), 'Ember this week')}${tile('⏱️', fmtMins(w.mins) || '0m', 'trained this week')}${tile('✅', `${w.done}${w.planned > w.done ? '/' + w.planned : ''}`, 'sessions')}${tile('🔥', ci.combo, 'day streak')}</div>
    <div class="row" style="margin-top:10px;align-items:center;gap:10px;flex-wrap:wrap"><button class="btn primary" data-fit="wmodeNew">▶ Start workout</button>
      <span class="muted small-text">${next ? `Next: <b>${esc(next.title || next.sport || 'Workout')}</b> · ${next.date === t ? 'today' : fmtDate(next.date)}${next.time ? ' ' + fmtTime(next.time) : ''}` : 'Nothing planned yet.'}</span></div>
    ${goal}${hint}
    ${prs.length ? `<div class="muted small-text" style="margin-top:6px">Latest PRs: ${prs.map(([id, p]) => `${esc(exInfo(id).name)} ${r1(p.e)} kg`).join(' · ')}</div>` : ''}</div>`;
}
function logMenu() {
  if (!ui.logMenu) return '';
  const b = (a, l) => `<button class="btn" ${a}>${l}</button>`;
  return `<div class="card"><div class="card-head"><h2>Log a workout</h2><button class="iconbtn" data-fit="logMenu">✕</button></div><div class="row" style="gap:8px;flex-wrap:wrap">
    ${b('data-fit="wmodeNew"', '🏋️ Gym session')}${b('data-act="new" data-kind="workout"', '🏃 Run, ride or other')}${b('data-act="goto" data-v="profile"', '🏉 Team sport')}${b('data-act="bodyPage" data-v="progress"', '🏅 PR or test result')}</div></div>`;
}
function recentWorkouts() {
  const recent = doneWorkouts().sort((x, y) => y.date.localeCompare(x.date)).slice(0, ui.recAll ? 40 : 6);
  return `<div class="card"><div class="card-head"><h2>Recent workouts</h2></div>${recent.length ? `<ul class="list">${recent.map(x => { const em = workoutEmber(x);
    return `<li class="item"><span class="dot" style="background:${TEVENT_COLOR}"></span><div class="main"><div class="title">${esc(x.title || x.sport || 'Workout')}${x.stravaId ? ' <span class="tag">Strava</span>' : ''}</div><div class="meta">${fmtDate(x.date)} · ${fmtMins(+x.duration || 0)}${x.distance ? ' · ' + x.distance + ' km' : ''}${x.intensity ? ' · ' + esc(x.intensity) : ''}</div></div><span class="tag">${em ? '+' + em + ' ' + EMBER : 'no Ember'}</span></li>`; }).join('')}</ul>${doneWorkouts().length > 6 && !ui.recAll ? '<button class="btn small" data-fit="recAll">Show more</button>' : ''}` : '<div class="empty">Tick off a workout or log one and it shows up here.</div>'}</div>`;
}
function trainTab() { return trainToday() + logMenu() + gymPage('train') + trainingPlan() + (typeof cdParts === 'function' ? cdParts().sports : '') + recentWorkouts(); }

// ---------- Progress ----------
function trendCard() {
  const F = fitCfg(), wk = mondayOf(today());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk, -7 * (7 - i))).map(f => ({ f, ...weekTotals(f) }));
  const max = Math.max(60, +F.goalMins || 0, ...weeks.map(x => x.mins));
  const bars = weeks.map(x => ({ label: `${parseYmd(x.f).getDate()}/${parseYmd(x.f).getMonth() + 1}`, title: `Week of ${fmtDate(x.f)}`, v: x.mins }));
  return `<div class="card"><div class="card-head"><h2>Last 8 weeks</h2><span class="muted small-text">minutes trained</span></div>${barChart(bars, { target: +F.goalMins || undefined, fmt: v => fmtMins(v) || '0m' })}
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px;align-items:center"><span class="muted small-text">Weekly goal (optional):</span>
      <input type="number" min="0" step="15" style="width:90px" data-fp="goalMins" value="${F.goalMins || ''}" placeholder="minutes"><input type="number" min="0" style="width:90px" data-fp="goalSess" value="${F.goalSess || ''}" placeholder="sessions"></div></div>`;
}
function progressTab() { return athleticsPage() + `<h3 class="prsubh">Gym progress</h3>` + gymPage('progress') + trendCard(); }

// ---------- Body ----------
function bodyTab() {
  const F = fitCfg(), body = cdBody(), has = Object.values(body).some(v => v > 5);
  const stats = `<div class="card"><div class="card-head"><h2>Body card</h2><a href="#" data-act="goto" data-v="profile">Full card →</a></div><div class="bstats">${BODY_STATS.map(([k, n, c]) => `<div class="bstat"><div class="row"><b>${n}</b><span style="flex:1"></span><b>${body[k] || 0}</b></div><div class="sbar big"><i style="width:${Math.min(100, body[k] || 0)}%;background:${c}"></i></div></div>`).join('')}</div>
    <p class="muted small-text">${has ? 'Set by your PRs, gym log, runs and team sports.' : 'Log a PR or a gym session and your card grows from the starter 5s.'}</p></div>`;
  const prof = `<div class="card"><div class="card-head"><h2>About you</h2></div><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
    <label class="muted small-text">Weight (kg) <input type="number" min="25" max="250" step="0.1" style="width:90px" data-fp="weight" value="${bodyweight() || ''}"></label>
    <label class="muted small-text">Sex <select data-fp="sex"><option value="">–</option><option value="m"${F.prof.sex === 'm' ? ' selected' : ''}>Male</option><option value="f"${F.prof.sex === 'f' ? ' selected' : ''}>Female</option></select></label></div>
    <p class="muted small-text">Used to rank your lifts against bodyweight standards. Stays on your device.</p></div>`;
  return `<div class="fit-grid">${stats}${prof}</div>${bodyMapCard()}`;
}

function viewTraining() {
  const MAP = { gym: 'train', plan: 'train', profile: 'train', health: 'train', food: 'train', bests: 'progress' };
  const page = MAP[ui.bodyPage] || ui.bodyPage || 'train';
  const tab = (v, l) => `<button class="${page === v ? 'on' : ''}" data-act="bodyPage" data-v="${v}">${l}</button>`;
  const head = pageHead('💪 Fitness', 'Train, track your bests and grow your Body card.', `<button class="btn" data-act="new" data-kind="tevent">+ Event</button><button class="btn primary" data-fit="logMenu">+ Log a workout</button>`)
    + `<div class="seg arenatabs bodytabs">${tab('train', '🏋️ Train')}${tab('progress', '🏅 Progress')}${tab('body', '🔥 Body')}</div>`;
  return head + (page === 'progress' ? progressTab() : page === 'body' ? bodyTab() : trainTab());
}
