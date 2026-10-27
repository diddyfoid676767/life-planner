'use strict';
/* Health & sleep: last night's sleep, steps and resting heart rate from
   Garmin, either through intervals.icu (/api/intervals/wellness, the same
   connection the Garmin activity import uses) or the Life Planner Connector
   extension (/api/browser/health, which adds body battery and sleep stages),
   plus a quick daily log of sleep, mood and energy for nights without a watch.
   Stored in D.health.days[YYYY-MM-DD]. */

const HEALTH_MEASURED = ['sleep', 'deep', 'light', 'rem', 'awake', 'score', 'bed', 'wake', 'steps', 'rhr', 'bb', 'stress'];
const MOODS = [['😫', 'Awful'], ['😕', 'Meh'], ['🙂', 'OK'], ['😄', 'Good'], ['🤩', 'Great']];
const healthCfg = () => (D.health = D.health || { days: {} }, D.health.days = D.health.days || {}, D.health.goals = Object.assign({ sleep: 480, steps: 10000 }, D.health.goals || {}), D.health);
const hday = d => healthCfg().days[d] || {};
const fmtHm = m => m ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m` : '–';
const minOfDay = hm => { if (!/^\d{2}:\d{2}$/.test(hm || '')) return null; const v = hmToMin(hm); return v < 12 * 60 ? v + 24 * 60 : v; }; // bedtimes after midnight count as late, not early
const fromMinOfDay = v => { v = Math.round(v) % (24 * 60); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

// sleep belongs to the morning you wake up
function healthRange(n) { const t = today(), out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(t, -i)); return out; }

async function healthSync() {
  if (ONLINE) return;
  const got = {};
  try {
    if (typeof icuState !== 'undefined' && icuState?.connected) {
      const r = await fetch(`/api/intervals/wellness?oldest=${addDays(today(), Object.keys(healthCfg().days).length ? -7 : -30)}`, { cache: 'no-store' });
      if (r.ok) for (const [d, v] of Object.entries((await r.json()).days || {})) got[d] = { ...got[d], ...v };
    }
  } catch { }
  try {
    const j = await (await fetch('/api/browser/health', { cache: 'no-store' })).json();
    for (const [d, v] of Object.entries(j.days || {})) got[d] = { ...got[d], ...v };
  } catch { }
  try {
    const days = healthCfg().days;
    let changed = false;
    for (const [d, v] of Object.entries(got)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const cur = days[d] || {}, next = { ...cur };
      for (const k of HEALTH_MEASURED) if (v[k] != null && v[k] !== '' && v[k] !== 0) next[k] = v[k];
      next.src = 'garmin';
      if (JSON.stringify(next) !== JSON.stringify(cur)) { days[d] = next; changed = true; }
    }
    if (changed) { save(); if (view === 'training' && ui.bodyPage === 'health' && !modal.open) render(); }
  } catch { }
}

function healthTile(icon, label, big, sub, pct, color) {
  return `<div class="card htile"><div class="hlabel">${icon} ${label}</div><div class="hbig">${big}</div>
    ${pct != null ? `<div class="hmeter"><i style="width:${Math.min(100, Math.max(0, pct))}%;background:${color || 'var(--accent)'}"></i></div>` : ''}
    <div class="muted small-text">${sub || '&nbsp;'}</div></div>`;
}

function viewHealth(embedded) {
  const H = healthCfg(), t = today(), last = hday(t), y = hday(addDays(t, -1));
  const days14 = healthRange(14), rows = days14.map(d => ({ d, ...hday(d) }));
  const slept = rows.filter(r => r.sleep), avgSleep = slept.length ? slept.reduce((a, r) => a + r.sleep, 0) / slept.length : 0;
  const beds = rows.map(r => minOfDay(r.bed)).filter(v => v != null), avgBed = beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length : null;
  const bedSpread = beds.length > 2 ? Math.sqrt(beds.reduce((a, b) => a + (b - avgBed) ** 2, 0) / beds.length) : null;
  const rhrs = rows.filter(r => r.rhr).map(r => r.rhr), avgRhr = rhrs.length ? rhrs.reduce((a, b) => a + b, 0) / rhrs.length : 0;
  const stepsRows = rows.filter(r => r.steps), avgSteps = stepsRows.length ? stepsRows.reduce((a, r) => a + r.steps, 0) / stepsRows.length : 0;
  const hit = slept.filter(r => r.sleep >= H.goals.sleep).length;

  const tiles = [
    healthTile('🌙', 'Last night', fmtHm(last.sleep), [last.bed && last.wake && `${fmtTime(last.bed)} → ${fmtTime(last.wake)}`, last.score && `score ${last.score}`].filter(Boolean).join(' · ') || (last.sleep ? '' : 'Not logged yet'), last.sleep ? last.sleep / H.goals.sleep * 100 : null, '#7950f2'),
    healthTile('👟', 'Steps today', last.steps ? last.steps.toLocaleString() : '–', last.steps ? `${Math.round(last.steps / H.goals.steps * 100)}% of ${H.goals.steps.toLocaleString()}` : y.steps ? `Yesterday ${y.steps.toLocaleString()}` : 'From Garmin', last.steps ? last.steps / H.goals.steps * 100 : null, '#2f9e5b'),
    healthTile('❤️', 'Resting heart rate', last.rhr ? `${last.rhr} <small>bpm</small>` : '–', last.rhr && avgRhr ? (last.rhr > avgRhr + 4 ? `⚠️ ${Math.round(last.rhr - avgRhr)} above your usual. Go easy today.` : `Usual ${Math.round(avgRhr)} bpm`) : 'From Garmin'),
    healthTile('🔋', 'Body battery', last.bb ? `${last.bb}` : '–', last.stress ? `Stress ${last.stress}` : 'From Garmin', last.bb || null, '#f59f00'),
  ].join('');

  const max = Math.max(H.goals.sleep + 60, ...rows.map(r => r.sleep || 0));
  const sleepChart = `<div class="hchart">${rows.map(r => {
    const stages = r.deep || r.rem || r.light ? [['deep', r.deep, '#5f3dc4'], ['rem', r.rem, '#9775fa'], ['light', r.light, '#d0bfff']] : [['sleep', r.sleep, '#9775fa']];
    return `<div class="hcol" title="${parseYmd(r.d).toDateString()}: ${fmtHm(r.sleep)}${r.score ? ' · score ' + r.score : ''}"><div class="htrack"><div class="hgoal" style="bottom:${H.goals.sleep / max * 100}%"></div>
      ${stages.map(([k, v, c]) => v ? `<i style="height:${v / max * 100}%;background:${c}"></i>` : '').join('')}</div><span>${DOW[parseYmd(r.d).getDay()].slice(0, 1)}</span></div>`;
  }).join('')}</div>`;
  const smax = Math.max(H.goals.steps, ...rows.map(r => r.steps || 0));
  const stepsChart = `<div class="hchart">${rows.map(r => `<div class="hcol" title="${parseYmd(r.d).toDateString()}: ${(r.steps || 0).toLocaleString()} steps"><div class="htrack"><div class="hgoal" style="bottom:${H.goals.steps / smax * 100}%"></div>${r.steps ? `<i style="height:${r.steps / smax * 100}%;background:${r.steps >= H.goals.steps ? '#2f9e5b' : '#8ce99a'}"></i>` : ''}</div><span>${DOW[parseYmd(r.d).getDay()].slice(0, 1)}</span></div>`).join('')}</div>`;

  const exams = D.assessments.filter(a => a.type === 'Exam' && a.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const tips = [];
  if (slept.length >= 3 && avgSleep < H.goals.sleep - 30) tips.push(`You're averaging <b>${fmtHm(avgSleep)}</b>, about ${fmtMins(H.goals.sleep - avgSleep)} under your goal. Getting to bed ${Math.round((H.goals.sleep - avgSleep) / 5) * 5} minutes earlier would close the gap.`);
  if (bedSpread != null && bedSpread > 45) tips.push(`Your bedtime moves around by about ${Math.round(bedSpread)} minutes. A steadier bedtime usually means better sleep.`);
  if (exams && diffDays(t, exams.date) <= 21) tips.push(`${esc(exams.title)} is ${relDays(diffDays(t, exams.date))}. Sleep is when you lock in what you studied, so protect it this week.`);
  if (last.rhr && avgRhr && last.rhr > avgRhr + 4) tips.push('Your resting heart rate is up, which can mean tiredness or a cold coming. Maybe swap hard training for an easy session.');

  const log = hday(t);
  const logCard = `<div class="card hlogcard"><div class="card-head"><h2>Log today</h2><span class="muted small-text">${log.src === 'garmin' ? 'Sleep from Garmin. Add how you feel.' : 'No watch? Log your sleep here.'}</span></div>
    <div class="hlog">
      <label>Bed <input type="time" id="hBed" value="${esc(log.bed || '')}"></label>
      <label>Woke <input type="time" id="hWake" value="${esc(log.wake || '')}"></label>
      <div><div class="muted small-text">How did you sleep?</div><div class="hmoods">${MOODS.map(([e, l], i) => `<button class="${log.quality === i + 1 ? 'on' : ''}" data-hact="quality" data-v="${i + 1}" title="${l}">${e}</button>`).join('')}</div></div>
      <div><div class="muted small-text">Mood</div><div class="hmoods">${MOODS.map(([e, l], i) => `<button class="${log.mood === i + 1 ? 'on' : ''}" data-hact="mood" data-v="${i + 1}" title="${l}">${e}</button>`).join('')}</div></div>
      <div><div class="muted small-text">Energy</div><div class="hmoods">${['🪫', '😪', '😐', '⚡', '🚀'].map((e, i) => `<button class="${log.energy === i + 1 ? 'on' : ''}" data-hact="energy" data-v="${i + 1}">${e}</button>`).join('')}</div></div>
    </div>
    <button class="btn primary" data-hact="saveSleep" style="margin-top:10px">Save sleep</button></div>`;

  const garminHint = !Object.values(H.days).some(d => d.src === 'garmin') ? `<p class="muted small-text">Got a Garmin? Connect intervals.icu under <a href="#" data-act="bodyPage" data-v="plan">Training &amp; Health → Training → Auto-import from Garmin</a> and your sleep, steps and resting heart rate fill in here by themselves.</p>` : '';

  const goals = `<label class="small-text muted">Sleep goal <select data-hgoal="sleep">${[420, 450, 480, 510, 540].map(m => `<option value="${m}" ${H.goals.sleep === m ? 'selected' : ''}>${fmtHm(m)}</option>`).join('')}</select></label>
      <label class="small-text muted">Steps goal <select data-hgoal="steps">${[6000, 8000, 10000, 12000, 15000].map(s => `<option value="${s}" ${H.goals.steps === s ? 'selected' : ''}>${s.toLocaleString()}</option>`).join('')}</select></label>`;
  return `${embedded ? `<div class="row hgoals">${goals}</div>` : pageHead('Health &amp; sleep', 'Sleep, steps and recovery, from Garmin and what you log', goals)}
  <div class="htiles">${tiles}</div>
  ${tips.length ? `<div class="card htips">${tips.map(x => `<p>💡 ${x}</p>`).join('')}</div>` : ''}
  <div class="hgrid">
    <div class="card"><div class="card-head"><h2>Sleep, last 2 weeks</h2><span style="flex:1"></span><span class="muted small-text">avg ${fmtHm(avgSleep)}${avgBed != null ? ` · bed ~${fmtTime(fromMinOfDay(avgBed))}` : ''} · goal hit ${hit}/${slept.length}</span></div>
      ${sleepChart}<div class="hlegend muted small-text"><span><i style="background:#5f3dc4"></i>Deep</span><span><i style="background:#9775fa"></i>REM / total</span><span><i style="background:#d0bfff"></i>Light</span><span><i class="dash"></i>Goal</span></div></div>
    <div class="card"><div class="card-head"><h2>Steps, last 2 weeks</h2><span style="flex:1"></span><span class="muted small-text">avg ${Math.round(avgSteps).toLocaleString()} a day</span></div>${stepsChart}</div>
  </div>
  ${logCard}
  ${garminHint}`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-hact]'); if (!el) return;
  const d = today(), H = healthCfg(), day = H.days[d] = H.days[d] || {};
  const act = el.dataset.hact;
  if (act === 'quality' || act === 'mood' || act === 'energy') { day[act] = +el.dataset.v; save(); render(); return; }
  if (act === 'saveSleep') {
    const bed = document.getElementById('hBed')?.value || '', wake = document.getElementById('hWake')?.value || '';
    if (bed) day.bed = bed; if (wake) day.wake = wake;
    if (bed && wake && day.src !== 'garmin') { let m = hmToMin(wake) - hmToMin(bed); if (m <= 0) m += 24 * 60; day.sleep = m; }
    save(); render(); toast('🌙 Sleep saved', day.sleep ? fmtHm(day.sleep) : '');
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.hgoal; if (!k) return;
  healthCfg().goals[k] = +e.target.value; save(); render();
});

(async () => {
  for (let k = 0; k < 40 && !(typeof D !== 'undefined' && D); k++) await new Promise(r => setTimeout(r, 500));
  if (ONLINE || !D) return;
  setTimeout(healthSync, 3000); // after the intervals.icu check has run
  setInterval(healthSync, 10 * 60000);
})();
