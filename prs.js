'use strict';
/* Personal bests and fitness tests (moved out of the old Arena in 2.55):
   the list of tests, logging a result, PB history and the records card on
   Fitness, Progress. The Body card (cards.js) is worked out from these. */

const STATS = [['spd', 'Speed', 'SPD', '#339af0'], ['pow', 'Power', 'POW', '#f76707'], ['str', 'Strength', 'STR', '#e03131'], ['end', 'Endurance', 'END', '#2f9e44'], ['agi', 'Agility', 'AGI', '#9c36b5']];
const STAT_IDS = STATS.map(s => s[0]);
const statInfo = id => STATS.find(s => s[0] === id);
const TESTS = [
  { id: 's40', name: '40m sprint', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [6.6, 4.6] },
  { id: 's60', name: '60m sprint', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [9.2, 6.7] },
  { id: 's100', name: '100m', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [15.5, 10.6] },
  { id: 's150', name: '150m', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [23, 15.8] },
  { id: 's200', name: '200m', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [32, 21.5] },
  { id: 's400', name: '400m', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [78, 48] },
  { id: 'h100', name: '100m / 110m hurdles', unit: 's', lower: true, stat: 'agi', cat: 'hurdle', std: [22, 14] },
  { id: 'h400', name: '400m hurdles', unit: 's', lower: true, stat: 'end', cat: 'hurdle', std: [90, 53] },
  { id: 's800', name: '800m', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [195, 112] },
  { id: 'tt1k', name: '1km time trial', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [290, 150] },
  { id: 's1500', name: '1500m', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [410, 230] },
  { id: 'mile', name: 'Mile', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [440, 250] },
  { id: 'tt2k', name: '2km time trial', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [610, 335] },
  { id: 'tt3k', name: '3000m', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [930, 510] },
  { id: 'steep', name: '2000m steeplechase', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [720, 370] },
  { id: 'tt5k', name: '5km', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [1700, 900] },
  { id: 'tt10k', name: '10km', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [3600, 1860] },
  { id: 'hj', name: 'High jump', unit: 'm', stat: 'pow', cat: 'jump', std: [1.2, 2.1] },
  { id: 'lj', name: 'Long jump', unit: 'm', stat: 'pow', cat: 'jump', std: [3.6, 7.3] },
  { id: 'tj', name: 'Triple jump', unit: 'm', stat: 'pow', cat: 'jump', std: [7.5, 15] },
  { id: 'pv', name: 'Pole vault', unit: 'm', stat: 'pow', cat: 'jump', std: [1.8, 5.2] },
  { id: 'vj', name: 'Vertical jump', unit: 'cm', stat: 'pow', cat: 'jump', std: [30, 80] },
  { id: 'bj', name: 'Standing broad jump', unit: 'cm', stat: 'pow', cat: 'jump', std: [160, 310] },
  { id: 'tri', name: 'Standing triple jump', unit: 'm', stat: 'pow', cat: 'jump', std: [5, 9.5] },
  { id: 'bench', name: 'Bench press 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.5, 1.75] },
  { id: 'sq', name: 'Back squat 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.75, 2.5] },
  { id: 'dl', name: 'Deadlift 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [1, 3] },
  { id: 'ohp', name: 'Overhead press 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.35, 1.1] },
  { id: 'clean', name: 'Power clean 1RM', unit: 'kg', stat: 'pow', cat: 'rm', bw: [0.5, 1.5] },
  { id: 'fsq', name: 'Front squat 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.6, 2] },
  { id: 'hipt', name: 'Hip thrust 1RM', unit: 'kg', stat: 'pow', cat: 'rm', bw: [0.75, 3] },
  { id: 'agil', name: '5-10-5 agility', unit: 's', lower: true, stat: 'agi', cat: 'test', std: [6.2, 4.2] },
  { id: 'illi', name: 'Illinois agility', unit: 's', lower: true, stat: 'agi', cat: 'test', std: [20, 14.5] },
  { id: 'beep', name: 'Beep test', unit: 'level', stat: 'end', cat: 'test', std: [5, 14] },
  { id: 'yoyo', name: 'Yo-yo test', unit: 'level', stat: 'end', cat: 'test', std: [13, 21] },
  { id: 'pull', name: 'Pull-ups (max reps)', unit: 'reps', stat: 'str', cat: 'test', std: [1, 25] },
  { id: 'push', name: 'Push-ups (max reps)', unit: 'reps', stat: 'str', cat: 'test', std: [10, 70] },
  { id: 'plank', name: 'Plank hold', unit: 'm:ss', stat: 'str', time: true, cat: 'test', std: [30, 300] },
  { id: 'sit', name: 'Sit-and-reach', unit: 'cm', stat: 'agi', cat: 'test', std: [0, 35] },
  { id: 'swim50', name: '50m swim', unit: 's', lower: true, stat: 'end', cat: 'test', std: [60, 26] },
  // 2.40: more lifts and events from the PR ranking doc (Strength Level and VDOT tables mapped onto Rookie to Legend)
  // 2.47: swimming by stroke and distance (seconds, short course)
  { id: 'free100', name: '100m freestyle', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [130, 52] },
  { id: 'free200', name: '200m freestyle', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [290, 115] },
  { id: 'free400', name: '400m freestyle', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [600, 245] },
  { id: 'back50', name: '50m backstroke', unit: 's', lower: true, stat: 'end', cat: 'swim', std: [70, 28] },
  { id: 'back100', name: '100m backstroke', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [150, 58] },
  { id: 'breast50', name: '50m breaststroke', unit: 's', lower: true, stat: 'end', cat: 'swim', std: [75, 30] },
  { id: 'breast100', name: '100m breaststroke', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [160, 63] },
  { id: 'fly50', name: '50m butterfly', unit: 's', lower: true, stat: 'end', cat: 'swim', std: [75, 26] },
  { id: 'fly100', name: '100m butterfly', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [165, 56] },
  { id: 'im200', name: '200m individual medley', unit: 'm:ss', lower: true, time: true, stat: 'end', cat: 'swim', std: [330, 125] },
  { id: 'row', name: 'Barbell row 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.3, 2.27], doc: 1 },
  { id: 'incl', name: 'Incline bench 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.35, 2.15], doc: 1 },
  { id: 'cgb', name: 'Close-grip bench 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.41, 2.23], doc: 1 },
  { id: 'dbb', name: 'Dumbbell bench 1RM (per hand)', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.08, 1.12], doc: 1 },
  { id: 'latpd', name: 'Lat pulldown 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.32, 2.13], doc: 1 },
  { id: 'bbcurl', name: 'Barbell curl 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.09, 1.32], doc: 1 },
  { id: 'dbcurl', name: 'Dumbbell curl 1RM (per hand)', unit: 'kg', stat: 'str', cat: 'rm', bw: [0, 0.72], doc: 1 },
  { id: 'ppress', name: 'Push press 1RM', unit: 'kg', stat: 'pow', cat: 'rm', bw: [0.25, 2.06], doc: 1 },
  { id: 'dbsp', name: 'Dumbbell shoulder press 1RM (per hand)', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.06, 0.88], doc: 1 },
  { id: 'legp', name: 'Leg press 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.45, 6.52], doc: 1 },
  { id: 'gob', name: 'Goblet squat 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0, 1.36], doc: 1 },
  { id: 'sumo', name: 'Sumo deadlift 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.76, 4.21], doc: 1 },
  { id: 'hexdl', name: 'Hex / trap bar deadlift 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.75, 3.98], doc: 1 },
  { id: 'rdl', name: 'Romanian deadlift 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.37, 3.3], doc: 1 },
  { id: 'snatch', name: 'Snatch 1RM', unit: 'kg', stat: 'pow', cat: 'rm', bw: [0.19, 2.03], doc: 1 },
  { id: 'cj', name: 'Clean and jerk 1RM', unit: 'kg', stat: 'pow', cat: 'rm', bw: [0.27, 2.41], doc: 1 },
  { id: 'bss', name: 'Bulgarian split squat 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0, 2.46], doc: 1 },
  { id: 'bblunge', name: 'Barbell lunge 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.05, 2.57], doc: 1 },
  { id: 'dbrow', name: 'Dumbbell row 1RM (per hand)', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.06, 1.26], doc: 1 },
  { id: 'hack', name: 'Hack squat 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.1, 4.7], doc: 1 },
  { id: 'legx', name: 'Leg extension 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.18, 2.98], doc: 1 },
  { id: 'legc', name: 'Lying leg curl 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.1, 1.92], doc: 1 },
  { id: 'shrug', name: 'Barbell shrug 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0.1, 3.85], doc: 1 },
  { id: 'tpush', name: 'Tricep pushdown 1RM', unit: 'kg', stat: 'str', cat: 'rm', bw: [0, 1.81], doc: 1 },
  { id: 's300', name: '300m', unit: 's', lower: true, stat: 'spd', cat: 'sprint', std: [65.1, 32.97], doc: 1 },
  { id: 's600', name: '600m', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [171.5, 74.79], doc: 1 },
  { id: 'tt2mi', name: '2 miles', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [1110.5, 494], doc: 1 },
  { id: 'tt15k', name: '15km', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [5646, 2546], doc: 1 },
  { id: 'tt10mi', name: '10 miles', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [6086.5, 2743], doc: 1 },
  { id: 'half', name: 'Half marathon', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [7965.9, 3660], doc: 1 },
  { id: 'mara', name: 'Marathon', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [16720.6, 7650], doc: 1 },
  { id: 'steep3', name: '3000m steeplechase', unit: 'm:ss', lower: true, stat: 'end', time: true, cat: 'dist', std: [1111.3, 493.1], doc: 1 },
  { id: 'chin', name: 'Chin-ups (max reps)', unit: 'reps', stat: 'str', cat: 'test', std: [0, 41.3], doc: 1 },
  { id: 'dips', name: 'Dips (max reps)', unit: 'reps', stat: 'str', cat: 'test', std: [0, 59.2], doc: 1 },
  { id: 'pistol', name: 'Pistol squats (max reps, per leg)', unit: 'reps', stat: 'str', cat: 'test', std: [0, 48.8], doc: 1 },
  { id: 'farmer', name: "Farmer's walk (kg per hand)", unit: 'kg', stat: 'str', cat: 'test', std: [0, 112.7], doc: 1 },
];
const doneWorkouts = () => D.workouts.filter(w => w.done && w.date <= today());

function pbHistory(testId) {
  const T = TESTS.find(x => x.id === testId);
  const list = (D.arena.pbs || []).filter(p => p.test === testId).sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  let best = null; const out = [];
  for (const p of list) {
    const isPb = best == null ? false : T.lower ? p.value < best : p.value > best;
    if (best == null || isPb) best = p.value;
    out.push({ ...p, pb: isPb, first: out.length === 0 });
  }
  return { list: out, best };
}
const rating = p => Math.min(99, Math.round(12 + 4 * Math.sqrt(p)));
function comboInfo() {
  const days = new Set(doneWorkouts().map(w => w.date)), t = today();
  let combo = 0, restUsed = false, best = 0, rests = 0;
  const byDay = {};
  for (let d = addDays(t, -120); d <= t; d = addDays(d, 1)) {
    if (days.has(d)) { combo++; restUsed = false; best = Math.max(best, combo); }
    else if (d === t) { /* today isn't over */ }
    else if (combo >= 3 && !restUsed) { restUsed = true; rests++; byDay[d] = 'rest'; }
    else combo = 0;
    if (days.has(d)) byDay[d] = combo;
  }
  return { combo, best, byDay, rests };
}
function freshness() {
  const t = today(), from = addDays(t, -2);
  const load = doneWorkouts().filter(w => w.date >= from).reduce((a, w) => a + ({ Hard: 3, Moderate: 2, Easy: .5 }[w.intensity] || 2) * Math.min(2, (+w.duration || 30) / 45), 0);
  return Math.max(20, Math.min(100, Math.round(100 - load * 9) + ((D.arena.fresh || {})[t] || 0)));
}
function spark(vals, lower) {
  if (vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals), w = 120, h = 34;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(max === min ? h / 2 : lower ? (v - min) / (max - min) * h : h - (v - min) / (max - min) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="-3 -3 ${w + 6} ${h + 6}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const fmtTest = (T, v) => v == null ? '–' : T.time && v >= 3600 ? `${Math.floor(v / 3600)}:${String(Math.floor(v % 3600 / 60)).padStart(2, '0')}:${String(Math.round(v % 60)).padStart(2, '0')}` : T.time ? `${Math.floor(v / 60)}:${(v % 60 < 10 ? '0' : '') + +(v % 60).toFixed(v % 1 ? 1 : 0)}` : `${+(+v).toFixed(2)} ${T.unit}`;
function parseTest(T, s) {
  s = String(s || '').trim(); if (!s) return null;
  if (T.time) { const h = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/); if (h) return +h[1] * 3600 + +h[2] * 60 + +h[3]; const m = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/); return m ? +m[1] * 60 + +m[2] : (isFinite(+s) ? +s * 60 : null); }
  return isFinite(+s) && +s > 0 ? +s : null;
}
const pbWhen = p => p.date ? fmtDate(p.date) : 'Date unknown';
function addPb(testId, unknown) {
  const T = TESTS.find(x => x.id === testId); if (!T) return;
  const v = parseTest(T, $(`#pbv_${testId}`)?.value), d = unknown ? '' : $(`#pbd_${testId}`)?.value || today();
  if (v == null) { toast('Enter a result first', T.time ? 'Use minutes:seconds, e.g. 7:45' : `In ${T.unit}`); return; }
  const before = pbHistory(testId).best;
  D.arena.pbs = [...(D.arena.pbs || []), { id: uid(), test: testId, value: v, date: d, ...(unknown ? { unk: true } : {}) }];
  save(); render();
  if (unknown) { toast(`📏 ${T.name}: ${fmtTest(T, v)} saved`, `With no date, it counts as one of your earliest results${before != null && (T.lower ? v < before : v > before) ? ' and is now your best' : ''}.`); return; }
  const isPb = before != null && (T.lower ? v < before : v > before);
  if (isPb) celebrate({ icon: '<span class="critbig">🎉</span>', color: '#f59f00', kicker: 'New personal best!', title: `${esc(T.name)}: ${fmtTest(T, v)}`, text: `Beat your old best of ${fmtTest(T, before)}. Your Body card's ${statInfo(T.stat)[1]} goes up.` });
  else toast(before == null ? `📏 ${T.name} baseline saved` : 'Result saved', before == null ? 'Beat it next time for a PB.' : `Your best is still ${fmtTest(T, before)}.`);
}
function bestRecords() {
  const ws = doneWorkouts(), km = w => parseFloat(String(w.distance || '').replace(',', '.')) || 0;
  const best = (list, f) => list.reduce((b, x) => { const v = f(x); return v > (b?.v || 0) ? { v, x } : b; }, null);
  const byWeek = {}, byDay = {};
  for (const w of ws) { const k = mondayOf(w.date); byWeek[k] = byWeek[k] || { mins: 0, n: 0, km: 0 }; byWeek[k].mins += +w.duration || 0; byWeek[k].n++; byWeek[k].km += km(w); byDay[w.date] = 1; }
  const streak = days => { let b = 0, run = 0, prev = null; for (const d of Object.keys(days).sort()) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; b = Math.max(b, run); prev = d; } return b; };
  const wk = f => Object.entries(byWeek).reduce((b, [k, v]) => f(v) > (b?.v || 0) ? { v: f(v), k } : b, null);
  const runs = ws.filter(w => /run|jog/i.test(w.sport + ' ' + w.title) && km(w) > 0);
  const paced = runs.filter(w => +w.duration > 0 && km(w) >= 1).map(w => ({ w, pace: +w.duration / km(w) }));
  const fastest = paced.sort((a, b) => a.pace - b.pace)[0];
  const lw = best(ws, w => +w.duration || 0), lr = best(runs, km);
  const totalKm = ws.reduce((a, w) => a + km(w), 0), totalH = ws.reduce((a, w) => a + (+w.duration || 0), 0);
  const ww = wk(v => v.mins), wn = wk(v => v.n), wkm = wk(v => v.km);
  return [
    ['🏃', 'Training', [
      ['⏱️', 'Longest workout', lw ? fmtMins(lw.v) : null, lw && `${esc(lw.x.title || lw.x.sport)} · ${fmtDate(lw.x.date)}`],
      ['📅', 'Biggest training week', ww ? fmtMins(ww.v) : null, ww && `week of ${fmtDate(ww.k)}`],
      ['🔁', 'Most sessions in a week', wn?.v || null, wn && `week of ${fmtDate(wn.k)}`],
      ['🔥', 'Longest training streak', streak(byDay) ? `${streak(byDay)} day${streak(byDay) === 1 ? '' : 's'}` : null, 'days in a row with a workout'],
      ['🧮', 'All-time training', totalH ? fmtMins(totalH) : null, `${ws.length} workout${ws.length === 1 ? '' : 's'}`]]],
    ['📏', 'Running', [
      ['🛣️', 'Longest run', lr ? `${+lr.v.toFixed(2)} km` : null, lr && fmtDate(lr.x.date)],
      ['⚡', 'Fastest pace (1km+)', fastest ? `${Math.floor(fastest.pace)}:${String(Math.round(fastest.pace % 1 * 60)).padStart(2, '0')} /km` : null, fastest && `${+km(fastest.w).toFixed(2)} km · ${fmtDate(fastest.w.date)}`],
      ['📈', 'Most km in a week', wkm?.v ? `${+wkm.v.toFixed(1)} km` : null, wkm && `week of ${fmtDate(wkm.k)}`],
      ['🌏', 'All-time distance', totalKm ? `${+totalKm.toFixed(1)} km` : null, 'from workouts with a distance']]],
  ];
}
function recordsHtml() {
  return `<div class="card recs"><div class="card-head"><h2>🏆 Your records</h2><span class="muted small-text">worked out from everything you log</span></div>
    ${bestRecords().map(([icon, title, rows]) => `<div class="recgroup"><div class="daygroup">${icon} ${title}</div><div class="recgrid">${rows.map(([ic, label, v, sub]) => `<div class="rec ${v == null ? 'none' : ''}"><span class="recic">${ic}</span><div class="main"><small>${label}</small><b>${v ?? '–'}</b>${sub && v != null ? `<em>${sub}</em>` : ''}</div></div>`).join('')}</div></div>`).join('')}</div>
    <h2 style="margin:18px 0 10px">📈 Fitness tests</h2>`;
}

// ---------- 2.57 one search bar to log a PR ----------
// Type an event, pick it, type one value in the right unit (time, kg × reps,
// cm...), the date defaults to today (clear it for "date unknown"), Enter saves.
// The same bar sits in You, Records and opens from Fitness, Progress.
const PRB_ALIAS = { '5k': 'tt5k', '10k': 'tt10k', '1k': 'tt1k', '2k': 'tt2k', '3k': 'tt3k', beep: 'beep', bench: 'bench', squat: 'sq', dead: 'dl' };
function prEvents() {
  const ev = TESTS.map(T => ({ k: 't:' + T.id, n: T.name, sub: (TEST_CATS.find(c => c[0] === T.cat) || [, ''])[1].replace(/^\S+ /, ''), T }));
  if (typeof EXERCISES !== 'undefined') for (const [id, n] of [...fitCfg().custom.map(c => [c.id, c.name]), ...EXERCISES]) { const ex = exInfo(id); if (ex.group === 'Plyos') continue; ev.push({ k: 'x:' + id, n, sub: `Gym set · ${ex.group || 'lift'}`, x: id }); }
  return ev;
}
const prEv = k => prEvents().find(e => e.k === k);
function prUnit(e) {
  if (e.x) return exInfo(e.x).bwf ? ['reps, or +kg × reps', 'e.g. 12, or 10 x 8 for 10 kg extra'] : ['kg × reps', 'e.g. 80 x 5 (just 80 for a single)'];
  const T = e.T; if (T.time) return ['m:ss', 'minutes:seconds, e.g. 7:45'];
  if (T.unit === 's') return ['seconds', 'e.g. 12.4'];
  if (T.cat === 'rm') return ['kg', 'your tested max in kg (80 x 3 works out a max for you)'];
  return [T.unit, `in ${T.unit}`];
}
function prMatches(q) {
  q = q.toLowerCase().trim(); if (!q) return [];
  const words = q.split(/\s+/), ev = prEvents(), al = PRB_ALIAS[q];
  const hit = ev.filter(e => { const t = (e.n + ' ' + e.sub).toLowerCase(); return words.every(w => t.includes(w)); });
  hit.sort((a, b) => (b.k === 't:' + al) - (a.k === 't:' + al) || a.n.toLowerCase().indexOf(words[0]) - b.n.toLowerCase().indexOf(words[0]) || !!a.x - !!b.x);
  if (al && !hit.some(e => e.k === 't:' + al)) { const e = ev.find(x => x.k === 't:' + al); if (e) hit.unshift(e); }
  return hit.slice(0, 8);
}
function prBarHtml() {
  const e = ui.prPick && prEv(ui.prPick);
  if (!e) return `<div class="prbar"><input class="prb-q" id="prbQ" type="text" autocomplete="off" spellcheck="false" placeholder="🔎 Log a PR: type an event, e.g. 100m, 5km, bench, beep test"><div class="prb-list" hidden></div></div>`;
  const [u, hint] = prUnit(e);
  return `<div class="prbar picked"><span class="prb-ev"><b>${esc(e.n)}</b><small>${esc(e.sub)}</small><button class="iconbtn" data-prb="clear" title="Pick another event">✕</button></span>
    <input class="prb-val" id="prbVal" type="text" autocomplete="off" placeholder="${esc(u)}" title="${esc(hint)}"><input id="prbDate" type="date" value="${today()}" max="${today()}" title="Clear the date if you don't know when"><button class="btn primary" data-prb="save">Save</button>
    <small class="muted prb-hint">${esc(hint)} · Enter saves</small></div>`;
}
function prPick(k) { ui.prPick = k; render(); setTimeout(() => document.getElementById('prbVal')?.focus(), 0); }
function prSave() {
  const e = ui.prPick && prEv(ui.prPick), raw = (document.getElementById('prbVal')?.value || '').trim(), date = document.getElementById('prbDate')?.value || '';
  if (!e) return;
  if (date > today()) { toast("That date hasn't happened yet", ''); return; }
  const xr = raw.match(/^\+?(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*(?:[x×*]|kg\s)\s*(\d+)$/i), num = parseFloat(raw.replace(',', '.'));
  if (e.x) {
    const ex = exInfo(e.x); let w, r;
    if (xr) { w = +xr[1].replace(',', '.'); r = +xr[2]; } else if (isFinite(num) && num > 0) { if (ex.bwf) { w = 0; r = Math.round(num); } else { w = num; r = 1; } }
    if (!(r > 0) || !(w > 0 || ex.bwf)) { toast('Enter weight × reps', prUnit(e)[1]); return; }
    const before = liftPRs()[e.x]?.e || 0, F = fitCfg();
    F.gym.push({ id: uid(), date: date || today(), name: `${ex.name} PR`, mins: 0, pr: 1, ex: [{ x: e.x, sets: [{ w, r }] }] });
    ui.prPick = ''; save(); render();
    const now = liftPRs()[e.x]?.e || 0;
    if (now > before && before) celebrate({ icon: '<span class="critbig">🎉</span>', color: '#f59f00', kicker: 'New lift PR!', title: `${esc(ex.name)}: ${w ? w + ' kg × ' : ''}${r}`, text: `Estimated 1RM ${r1(before)} → ${r1(now)} kg. Your Body card's Strength goes up.` });
    else toast(`🏋️ ${ex.name} saved`, `${w ? w + ' kg × ' : ''}${r}${now ? ` · est. 1RM ${r1(now)} kg` : ''}`);
    return;
  }
  const T = e.T; let v;
  if (T.cat === 'rm' && xr) { v = Math.round(e1rm(+xr[1].replace(',', '.'), +xr[2]) * 2) / 2; }
  else if (T.unit === 's' && /:/.test(raw)) { const m = raw.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/); v = m ? +m[1] * 60 + +m[2] : null; }
  else v = parseTest(T, raw);
  if (v == null || !(v > 0)) { toast('Enter a result first', prUnit(e)[1]); return; }
  const before = pbHistory(T.id).best;
  D.arena.pbs = [...(D.arena.pbs || []), { id: uid(), test: T.id, value: v, date, ...(date ? {} : { unk: true }) }];
  ui.prPick = ''; save(); render();
  const isPb = before != null && (T.lower ? v < before : v > before);
  if (isPb && date) celebrate({ icon: '<span class="critbig">🎉</span>', color: '#f59f00', kicker: 'New personal best!', title: `${esc(T.name)}: ${fmtTest(T, v)}`, text: `Beat your old best of ${fmtTest(T, before)}. Your Body card's ${statInfo(T.stat)[1]} goes up.` });
  else toast(before == null ? `📏 ${T.name} baseline saved` : isPb ? `📏 ${T.name}: new best saved` : 'Result saved', before == null ? `${fmtTest(T, v)}. Beat it next time for a PB.` : isPb ? `${fmtTest(T, v)} (no date)` : `Your best is still ${fmtTest(T, before)}.`);
  setTimeout(() => document.getElementById('prbQ')?.focus(), 0);
}
function prList(inp) {
  const list = inp.parentNode.querySelector('.prb-list'), hits = prMatches(inp.value);
  list.hidden = !hits.length;
  list.innerHTML = hits.map((e, i) => `<button type="button" class="${i ? '' : 'on'}" data-prb="pick" data-k="${e.k}"><b>${esc(e.n)}</b><small>${esc(e.sub)}</small></button>`).join('');
}
document.addEventListener('input', e => { if (e.target.id === 'prbQ') prList(e.target); });
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'prbQ') {
    const list = t.parentNode.querySelector('.prb-list'), bs = [...list.querySelectorAll('button')], i = bs.findIndex(b => b.classList.contains('on'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!bs.length) return; const j = (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, n) => b.classList.toggle('on', n === j)); }
    else if (e.key === 'Enter') { e.preventDefault(); const b = bs[i] || bs[0]; if (b) prPick(b.dataset.k); }
    else if (e.key === 'Escape') { t.value = ''; list.hidden = true; }
  } else if (t.id === 'prbVal' || t.id === 'prbDate') {
    if (e.key === 'Enter') { e.preventDefault(); prSave(); }
    else if (e.key === 'Escape') { ui.prPick = ''; render(); setTimeout(() => document.getElementById('prbQ')?.focus(), 0); }
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-prb]');
  if (!b) { document.querySelectorAll('.prb-list').forEach(l => { if (!e.target.closest('.prbar')) l.hidden = true; }); return; }
  const a = b.dataset.prb;
  if (a === 'pick') prPick(b.dataset.k);
  else if (a === 'clear') { ui.prPick = ''; render(); setTimeout(() => document.getElementById('prbQ')?.focus(), 0); }
  else if (a === 'save') prSave();
  else if (a === 'open') { ui.prBarOpen = !ui.prBarOpen; render(); if (ui.prBarOpen) setTimeout(() => (document.getElementById('prbQ') || document.getElementById('prbVal'))?.focus(), 0); }
});
