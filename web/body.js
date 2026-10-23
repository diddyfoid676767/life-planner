'use strict';
/* Training & Health: your physical profile. Workouts build your athlete's
   stats, and sleep, freshness and resting heart rate make up today's
   readiness, which gives a bonus (or a penalty) in Arena battles. */

// readiness 0-100 from freshness, last night's sleep and resting heart rate
function readiness() {
  const t = today(), fr = freshness();
  let sleepPct = null, rhrPct = null, sleep = 0, rhr = 0;
  if (typeof healthCfg === 'function') {
    const H = healthCfg(), n = hday(t);
    sleep = n.sleep || 0; rhr = n.rhr || 0;
    if (sleep) sleepPct = Math.min(100, Math.round(sleep / (H.goals.sleep || 480) * 100));
    const past = healthRange(14).slice(0, -1).map(d => hday(d).rhr).filter(Boolean);
    if (rhr && past.length >= 3) { const avg = past.reduce((a, b) => a + b, 0) / past.length; rhrPct = Math.max(30, Math.min(100, Math.round(100 - (rhr - avg) * 10))); }
  }
  const parts = [[fr, .45], [sleepPct ?? 75, .4], [rhrPct ?? 80, .15]];
  const score = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0));
  const tier = score >= 85 ? ['🚀', 'Peak', 15, 10] : score >= 70 ? ['💪', 'Ready', 8, 5] : score >= 50 ? ['🙂', 'Okay', 0, 0] : ['😴', 'Run down', -10, 0];
  return { score, fr, sleepPct, rhrPct, sleep, rhr, icon: tier[0], label: tier[1], hp: tier[2], energy: tier[3] };
}

function weekTotals(from) {
  const to = addDays(from, 6);
  const ws = D.workouts.filter(w => w.date >= from && w.date <= to);
  const done = ws.filter(w => w.done), mins = done.reduce((a, w) => a + (+w.duration || 0), 0);
  let sleepAvg = 0, steps = 0;
  if (typeof healthCfg === 'function') {
    const days = Array.from({ length: 7 }, (_, i) => hday(addDays(from, i)));
    const s = days.filter(d => d.sleep); sleepAvg = s.length ? Math.round(s.reduce((a, d) => a + d.sleep, 0) / s.length) : 0;
    steps = days.reduce((a, d) => a + (d.steps || 0), 0);
  }
  return { mins, done: done.length, planned: ws.length, sleepAvg, steps };
}

function bodyProfile() {
  const a = athlete(), rd = readiness(), wk = mondayOf(today()), w = weekTotals(wk), ci = comboInfo();
  const C = 2 * Math.PI * 52, col = rd.score >= 85 ? '#20c997' : rd.score >= 70 ? '#40c057' : rd.score >= 50 ? '#fab005' : '#e03131';
  const part = (label, v, note) => `<div class="rd-part"><span>${label}</span><div class="meter"><i style="width:${v ?? 0}%;background:${v == null ? 'var(--border)' : v >= 70 ? '#40c057' : v >= 50 ? '#fab005' : '#e03131'}"></i></div><b>${v == null ? '–' : v + '%'}</b><small class="muted">${note}</small></div>`;
  const ready = `<div class="card rdcard"><div class="card-head"><h2>Today's readiness</h2></div>
    <div class="rd-top"><div class="rd-ring"><svg viewBox="0 0 120 120" width="132" height="132"><circle cx="60" cy="60" r="52" class="mp-track"/><circle cx="60" cy="60" r="52" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - rd.score / 100)).toFixed(1)}" transform="rotate(-90 60 60)"/></svg><div><b>${rd.score}</b><span>${rd.icon} ${rd.label}</span></div></div>
      <div class="rd-parts">${part('Freshness', rd.fr, 'recovery from recent workouts')}${part('Sleep', rd.sleepPct, rd.sleep ? `${fmtHm(rd.sleep)} last night` : 'no sleep logged')}${part('Heart rate', rd.rhrPct, rd.rhr ? `${rd.rhr} bpm resting` : 'from your watch')}</div></div>
    <div class="rd-arena"><span>⚔️ In the Arena today</span><b>${rd.hp || rd.energy ? `${rd.hp ? `${rd.hp > 0 ? '+' : ''}${rd.hp} HP` : ''}${rd.hp && rd.energy ? ' · ' : ''}${rd.energy ? `+${rd.energy} energy` : ''}` : 'no bonus'}</b><a href="#" data-act="goto" data-v="arena">Battle →</a></div></div>`;
  const STAT_FROM = { spd: 'sprints, speed work, running', pow: 'jumps, plyos, power lifts', str: 'gym and strength work', end: 'long runs, rides and swims', agi: 'agility, footy and court sports' };
  const stats = `<div class="card"><div class="card-head"><h2>Athlete stats</h2><span class="tag">⭐ ${a.ovr} ${esc(a.pos)}</span></div>
    <div class="bstats">${STATS.map(([k, name, ab, col]) => `<div class="bstat"><div class="row"><b>${esc(name)}</b><span class="muted small-text">from ${STAT_FROM[k]}</span><span style="flex:1"></span><b>${a.total[k]}</b></div><div class="sbar big"><i style="width:${a.total[k]}%;background:${col}"></i></div></div>`).join('')}</div>
    <p class="muted small-text">Every workout you tick off raises the stats it trains. These are your Arena stats too.</p></div>`;
  const tile = (icon, big, label, sub = '') => `<div class="btile"><span>${icon}</span><b>${big}</b><small>${label}</small>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const tiles = `<div class="btiles">${tile('⏱️', fmtMins(w.mins) || '0m', 'trained this week')}${tile('✅', `${w.done}/${w.planned}`, 'sessions done')}${tile('🔥', ci.combo, 'day combo')}${tile('🌙', w.sleepAvg ? fmtHm(w.sleepAvg) : '–', 'avg sleep')}${tile('👟', w.steps ? w.steps.toLocaleString() : '–', 'steps this week')}${tile('❤️', rd.rhr || '–', 'resting HR')}</div>`;
  // the last 8 weeks
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk, -7 * (7 - i))).map(f => ({ f, ...weekTotals(f) }));
  const maxM = Math.max(60, ...weeks.map(x => x.mins)), maxS = Math.max(480, ...weeks.map(x => x.sleepAvg));
  const chart = `<div class="card"><div class="card-head"><h2>Last 8 weeks</h2><span class="hlegend muted small-text"><span><i style="background:var(--accent)"></i>Training</span><span><i style="background:#9775fa"></i>Avg sleep</span></span></div>
    <div class="bweeks">${weeks.map(x => `<div class="bweek" title="Week of ${fmtDate(x.f)}: ${fmtMins(x.mins) || '0m'} training, ${x.sleepAvg ? fmtHm(x.sleepAvg) : 'no'} sleep"><div class="bwbars"><i class="tr" style="height:${(x.mins / maxM * 100).toFixed(0)}%"></i><i class="sl" style="height:${(x.sleepAvg / maxS * 100).toFixed(0)}%"></i></div><small>${parseYmd(x.f).getDate()}/${parseYmd(x.f).getMonth() + 1}</small></div>`).join('')}</div></div>`;
  const recent = doneWorkouts().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
  const rec = `<div class="card"><div class="card-head"><h2>Recent workouts</h2><button class="btn small" data-act="bodyPage" data-v="plan">Training plan →</button></div>
    ${recent.length ? `<ul class="list">${recent.map(x => `<li class="item"><span class="dot" style="background:${TEVENT_COLOR}"></span><div class="main"><div class="title">${esc(x.title || x.sport || 'Workout')}</div><div class="meta">${fmtDate(x.date)} · ${fmtMins(+x.duration || 0)}${x.intensity ? ' · ' + esc(x.intensity) : ''}</div></div><span class="tag green">+${workoutGrit(x)} ${GRIT}</span></li>`).join('')}</ul>` : '<div class="empty">Tick off a workout and it shows here.</div>'}</div>`;
  return `${tiles}<div class="body-grid">${ready}${stats}</div><div class="body-grid">${chart}${rec}</div>`;
}

function viewTraining() {
  const page = ui.bodyPage || 'profile';
  const tab = (v, l) => `<button class="${page === v ? 'on' : ''}" data-act="bodyPage" data-v="${v}">${l}</button>`;
  const head = pageHead('💪 Training &amp; Health', 'How you\'re going physically. It all feeds your Arena athlete.', `<button class="btn" data-act="new" data-kind="workout">+ Workout</button><button class="btn primary" data-act="new" data-kind="tevent">+ Event</button>`)
    + `<div class="seg arenatabs bodytabs">${tab('profile', '📊 Profile')}${tab('plan', '📅 Training')}${tab('health', '🌙 Sleep &amp; health')}${tab('bests', '📈 Bests')}</div>`;
  let body;
  if (page === 'plan') body = trainingPlan();
  else if (page === 'health') body = viewHealth(true);
  else if (page === 'bests') body = arenaBests();
  else body = bodyProfile();
  return head + body;
}
