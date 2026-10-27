'use strict';
/* Fitness: a gym logger with estimated 1RMs and PRs, a calorie and macro
   tracker, a body heat map built from every PR you have, progress charts, and
   the Athletics page (track, field, 1RMs and fitness tests, each with a rank).
   Everything lives in D.fit. */

const fitCfg = () => {
  const F = D.fit = D.fit || {};
  F.prof = Object.assign({ sex: '', age: 16, height: 0, act: 1.55, goal: 'maintain' }, F.prof || {});
  F.weights = F.weights || {}; F.gym = F.gym || []; F.food = F.food || {}; F.myFoods = F.myFoods || []; F.custom = F.custom || [];
  return F;
};
const bodyweight = () => { const w = fitCfg().weights, k = Object.keys(w).sort().pop(); return k ? +w[k] : 0; };
const e1rm = (w, r) => r > 0 && w > 0 ? w * (1 + Math.min(r, 30) / 30) : 0; // Epley, reps capped at 30
const r1 = n => Math.round(n * 10) / 10;

// ---------- ranks ----------
const RANKS = [['Rookie', '#8bc34a'], ['Bronze', '#c9824a'], ['Silver', '#7d93ad'], ['Gold', '#f2b705'], ['Platinum', '#22b8cf'], ['Diamond', '#4dabf7'], ['Elite', '#be4bdb'], ['Legend', '#f03e3e']];
const rankOf = f => { const i = f >= 1 ? 7 : f >= .88 ? 6 : f >= .74 ? 5 : f >= .6 ? 4 : f >= .45 ? 3 : f >= .3 ? 2 : f >= .15 ? 1 : 0; return { i, name: RANKS[i][0], col: RANKS[i][1], f }; };
const rankTag = rk => rk ? `<span class="rktag" style="--rk:${rk.col}">${rk.name}</span>` : '';
const sexAdj = () => fitCfg().prof.sex === 'f';
// 0..1+ between "starting out" and "elite" for a test result
function testLevel(T, v) {
  if (v == null) return null;
  if (T.bw) { const bw = bodyweight() || 65, [a, b] = T.bw.map(x => x * (sexAdj() ? .68 : 1)); return Math.max(0, (v / bw - a) / (b - a)); }
  if (!T.std) return null;
  let [a, b] = T.std; if (sexAdj()) { const k = T.lower ? 1.12 : .85; a *= k; b *= k; }
  return Math.max(0, (v - a) / (b - a));
}

// ---------- exercise library: muscles (first is the main one), bodyweight factor, strength standard (x bodyweight) ----------
const MUSCLES = { chest: 'Chest', delts: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps', lats: 'Lats', upperback: 'Upper back', lowerback: 'Lower back', glutes: 'Glutes', quads: 'Quads', hams: 'Hamstrings', calves: 'Calves' };
const EXERCISES = [
  ['bench', 'Bench press', 'Chest', ['chest', 'triceps', 'delts'], 0, [.5, 1.75]],
  ['incline', 'Incline bench press', 'Chest', ['chest', 'delts', 'triceps'], 0, [.45, 1.5]],
  ['dbbench', 'Dumbbell bench (per hand)', 'Chest', ['chest', 'triceps', 'delts'], 0, [.2, .75]],
  ['fly', 'Chest fly', 'Chest', ['chest'], 0, [.15, .7]],
  ['pushup', 'Push-up', 'Chest', ['chest', 'triceps', 'delts'], .65, [.7, 1.9]],
  ['dip', 'Dips', 'Chest', ['triceps', 'chest', 'delts'], 1, [1.05, 2]],
  ['ohp', 'Overhead press', 'Shoulders', ['delts', 'triceps'], 0, [.35, 1.1]],
  ['dbohp', 'Dumbbell shoulder press (per hand)', 'Shoulders', ['delts', 'triceps'], 0, [.15, .5]],
  ['lat', 'Lateral raise (per hand)', 'Shoulders', ['delts'], 0, [.05, .25]],
  ['rear', 'Rear delt fly', 'Shoulders', ['delts', 'upperback'], 0, [.05, .3]],
  ['face', 'Face pull', 'Shoulders', ['delts', 'upperback', 'traps'], 0, [.2, .7]],
  ['pullup', 'Pull-up', 'Back', ['lats', 'biceps', 'upperback'], 1, [1.03, 1.8]],
  ['chinup', 'Chin-up', 'Back', ['lats', 'biceps'], 1, [1.05, 1.85]],
  ['pulldown', 'Lat pulldown', 'Back', ['lats', 'biceps'], 0, [.5, 1.4]],
  ['row', 'Barbell row', 'Back', ['upperback', 'lats', 'biceps'], 0, [.5, 1.5]],
  ['cablerow', 'Seated cable row', 'Back', ['upperback', 'lats', 'biceps'], 0, [.5, 1.5]],
  ['dbrow', 'Dumbbell row (per hand)', 'Back', ['lats', 'upperback', 'biceps'], 0, [.25, .85]],
  ['shrug', 'Shrug', 'Back', ['traps', 'forearms'], 0, [.8, 2.5]],
  ['backext', 'Back extension', 'Back', ['lowerback', 'glutes', 'hams'], .5, [.55, 1.3]],
  ['curl', 'Barbell curl', 'Arms', ['biceps', 'forearms'], 0, [.25, .8]],
  ['dbcurl', 'Dumbbell curl (per hand)', 'Arms', ['biceps', 'forearms'], 0, [.1, .4]],
  ['hammer', 'Hammer curl (per hand)', 'Arms', ['forearms', 'biceps'], 0, [.1, .42]],
  ['pushdown', 'Tricep pushdown', 'Arms', ['triceps'], 0, [.3, 1]],
  ['skull', 'Skull crusher', 'Arms', ['triceps'], 0, [.25, .8]],
  ['squat', 'Back squat', 'Legs', ['quads', 'glutes', 'hams', 'lowerback'], 0, [.75, 2.5]],
  ['fsquat', 'Front squat', 'Legs', ['quads', 'glutes', 'abs'], 0, [.6, 2]],
  ['legpress', 'Leg press', 'Legs', ['quads', 'glutes'], 0, [1.5, 5]],
  ['bss', 'Bulgarian split squat (total load)', 'Legs', ['quads', 'glutes'], 0, [.2, 1.1]],
  ['lunge', 'Lunge (total load)', 'Legs', ['quads', 'glutes', 'hams'], 0, [.3, 1.2]],
  ['legext', 'Leg extension', 'Legs', ['quads'], 0, [.4, 1.4]],
  ['deadlift', 'Deadlift', 'Legs', ['hams', 'glutes', 'lowerback', 'traps', 'forearms'], 0, [1, 3]],
  ['rdl', 'Romanian deadlift', 'Legs', ['hams', 'glutes', 'lowerback'], 0, [.6, 2.2]],
  ['legcurl', 'Leg curl', 'Legs', ['hams'], 0, [.3, 1.1]],
  ['hipthrust', 'Hip thrust', 'Legs', ['glutes', 'hams'], 0, [.75, 3]],
  ['calf', 'Calf raise', 'Legs', ['calves'], 0, [.8, 3]],
  ['clean', 'Power clean', 'Power', ['quads', 'glutes', 'traps', 'hams', 'delts'], 0, [.5, 1.5]],
  ['snatch', 'Power snatch', 'Power', ['delts', 'traps', 'quads', 'glutes'], 0, [.4, 1.2]],
  ['crunch', 'Cable crunch', 'Core', ['abs'], 0, [.3, 1.2]],
  ['hlr', 'Hanging leg raise', 'Core', ['abs', 'obliques'], .35, [.37, .6]],
  ['twist', 'Russian twist (load)', 'Core', ['obliques', 'abs'], 0, [.05, .4]],
  // 2.28: more lifts, and plyos (jumps, bounds and throws: logged as reps, with no 1RM)
  ['closegrip', 'Close-grip bench press', 'Chest', ['triceps', 'chest', 'delts'], 0, [.45, 1.5]],
  ['cablefly', 'Cable fly', 'Chest', ['chest'], 0, [.1, .5]],
  ['arnold', 'Arnold press (per hand)', 'Shoulders', ['delts', 'triceps'], 0, [.12, .45]],
  ['landmine', 'Landmine press', 'Shoulders', ['delts', 'chest', 'triceps'], 0, [.25, .9]],
  ['uprow', 'Upright row', 'Shoulders', ['delts', 'traps', 'biceps'], 0, [.25, .8]],
  ['tbarrow', 'T-bar row', 'Back', ['upperback', 'lats', 'biceps'], 0, [.5, 1.6]],
  ['invrow', 'Inverted row', 'Back', ['upperback', 'lats', 'biceps'], .6, [.65, 1.3]],
  ['preacher', 'Preacher curl', 'Arms', ['biceps'], 0, [.2, .7]],
  ['ohext', 'Overhead tricep extension', 'Arms', ['triceps'], 0, [.2, .7]],
  ['boxsquat', 'Box squat', 'Legs', ['quads', 'glutes', 'hams'], 0, [.7, 2.3]],
  ['gobletsq', 'Goblet squat', 'Legs', ['quads', 'glutes', 'abs'], 0, [.3, 1]],
  ['hacksquat', 'Hack squat', 'Legs', ['quads', 'glutes'], 0, [.8, 2.8]],
  ['stepup', 'Step-up (total load)', 'Legs', ['quads', 'glutes'], 0, [.2, 1]],
  ['pistol', 'Pistol squat', 'Legs', ['quads', 'glutes'], 1, [1, 1.5]],
  ['trapdl', 'Trap bar deadlift', 'Legs', ['quads', 'glutes', 'hams', 'traps'], 0, [1, 3.1]],
  ['sumodl', 'Sumo deadlift', 'Legs', ['glutes', 'hams', 'quads', 'lowerback'], 0, [1, 3]],
  ['goodmorning', 'Good morning', 'Legs', ['hams', 'lowerback', 'glutes'], 0, [.4, 1.4]],
  ['nordic', 'Nordic curl', 'Legs', ['hams'], .5, [.5, 1]],
  ['glutebridge', 'Glute bridge', 'Legs', ['glutes', 'hams'], 0, [.6, 2.5]],
  ['seatcalf', 'Seated calf raise', 'Legs', ['calves'], 0, [.5, 2]],
  ['hangclean', 'Hang clean', 'Power', ['quads', 'glutes', 'traps', 'hams'], 0, [.45, 1.4]],
  ['pushpress', 'Push press', 'Power', ['delts', 'triceps', 'quads'], 0, [.45, 1.4]],
  ['jerk', 'Split jerk', 'Power', ['delts', 'triceps', 'quads', 'glutes'], 0, [.5, 1.6]],
  ['jumpsquat', 'Jump squat (weighted)', 'Power', ['quads', 'glutes', 'calves'], 0, [.2, .8]],
  ['kbswing', 'Kettlebell swing', 'Power', ['glutes', 'hams', 'lowerback'], 0, [.2, .7]],
  ['sledpush', 'Sled push (total load)', 'Power', ['quads', 'glutes', 'calves'], 0, [1, 3]],
  ['boxjump', 'Box jump', 'Plyos', ['quads', 'glutes', 'calves'], 1, null],
  ['depthjump', 'Depth jump', 'Plyos', ['quads', 'calves', 'glutes'], 1, null],
  ['broadjump', 'Broad jump', 'Plyos', ['glutes', 'quads', 'hams'], 1, null],
  ['squatjump', 'Squat jump', 'Plyos', ['quads', 'glutes', 'calves'], 1, null],
  ['tuckjump', 'Tuck jump', 'Plyos', ['quads', 'abs', 'calves'], 1, null],
  ['hurdlehop', 'Hurdle hops', 'Plyos', ['calves', 'quads', 'hams'], 1, null],
  ['pogo', 'Pogo jumps', 'Plyos', ['calves'], 1, null],
  ['slhop', 'Single-leg hops', 'Plyos', ['calves', 'quads', 'glutes'], 1, null],
  ['bounds', 'Bounding', 'Plyos', ['glutes', 'hams', 'calves'], 1, null],
  ['skaters', 'Lateral bounds (skaters)', 'Plyos', ['glutes', 'quads', 'calves'], 1, null],
  ['splitjump', 'Split squat jump', 'Plyos', ['quads', 'glutes', 'hams'], 1, null],
  ['plyopush', 'Plyo (clap) push-up', 'Plyos', ['chest', 'triceps', 'delts'], .65, null],
  ['mbslam', 'Med ball slam', 'Plyos', ['abs', 'lats', 'delts'], 0, null],
  ['mbchest', 'Med ball chest pass', 'Plyos', ['chest', 'triceps', 'delts'], 0, null],
  ['mbrot', 'Med ball rotational throw', 'Plyos', ['obliques', 'abs', 'delts'], 0, null],
  ['mbovh', 'Med ball overhead throw', 'Plyos', ['delts', 'abs', 'lats'], 0, null],
  ['abwheel', 'Ab wheel rollout', 'Core', ['abs', 'obliques'], .3, [.3, .6]],
  ['pallof', 'Pallof press', 'Core', ['obliques', 'abs'], 0, [.1, .4]],
  ['farmer', 'Farmer carry (per hand)', 'Core', ['forearms', 'traps', 'abs'], 0, [.3, 1]],
];
const isPlyo = ex => ex.group === 'Plyos';
const setE = (ex, s) => isPlyo(ex) ? 0 : e1rm(setLoad(ex, s), +s.r); // plyos are about speed, so no 1RM
const exInfo = id => { const c = fitCfg().custom.find(x => x.id === id); if (c) return { id, name: c.name, group: 'Custom', m: c.m || [], bwf: 0, std: null };
  const e = EXERCISES.find(x => x[0] === id); return e ? { id, name: e[1], group: e[2], m: e[3], bwf: e[4], std: e[5] } : { id, name: 'Exercise', group: '', m: [], bwf: 0, std: null }; };
const setLoad = (ex, s) => (+s.w || 0) + (ex.bwf ? ex.bwf * (bodyweight() || 65) : 0);

// every working set ever, oldest first: {date, sid, x, w, r, e}
function allSets() {
  const out = [];
  for (const g of [...fitCfg().gym].sort((a, b) => a.date.localeCompare(b.date))) for (const it of g.ex || []) {
    const ex = exInfo(it.x);
    for (const s of it.sets || []) if (!s.warm && +s.r > 0 && (+s.w > 0 || ex.bwf)) out.push({ date: g.date, sid: g.id, x: it.x, w: +s.w || 0, r: +s.r, e: setE(ex, s) });
  }
  return out;
}
// per exercise: best e1RM, heaviest weight, most reps, best session volume, history of the best e1RM per session
function liftPRs(exclude) {
  const P = {};
  for (const s of allSets()) {
    if (s.sid === exclude || !s.e) continue; // plyos have no 1RM
    const p = P[s.x] = P[s.x] || { e: 0, w: 0, r: 0, vol: {}, hist: {}, last: '' };
    if (s.e > p.e) { p.e = s.e; p.eDate = s.date; }
    if (s.w > p.w) p.w = s.w; if (s.r > p.r) p.r = s.r;
    p.vol[s.sid] = (p.vol[s.sid] || 0) + s.w * s.r;
    p.hist[s.date] = Math.max(p.hist[s.date] || 0, s.e); p.last = s.date;
  }
  for (const p of Object.values(P)) p.bestVol = Math.max(0, ...Object.values(p.vol));
  return P;
}
const liftLevel = (id, e) => { const ex = exInfo(id); if (!ex.std || !e) return null; const bw = bodyweight() || 65, [a, b] = ex.std.map(x => x * (sexAdj() ? .68 : 1)); return Math.max(0, (e / bw - a) / (b - a)); };

// ---------- body heat map ----------
const TEST_MUSCLES = { sprint: ['quads', 'hams', 'glutes', 'calves'], hurdle: ['hams', 'quads', 'glutes', 'calves', 'abs'], dist: ['calves', 'quads', 'hams'], jump: ['quads', 'glutes', 'calves'], throw: ['delts', 'chest', 'triceps', 'obliques'],
  bench: ['chest', 'triceps', 'delts'], sq: ['quads', 'glutes', 'hams'], dl: ['hams', 'glutes', 'lowerback', 'traps'], ohp: ['delts', 'triceps'], clean: ['quads', 'glutes', 'traps'], fsq: ['quads', 'glutes', 'abs'], hipt: ['glutes', 'hams'],
  pull: ['lats', 'biceps', 'upperback'], push: ['chest', 'triceps'], plank: ['abs', 'obliques'], sit: ['hams', 'lowerback'], swim50: ['lats', 'delts'], beep: ['calves', 'quads'], yoyo: ['calves', 'quads'], agil: ['quads', 'calves', 'glutes'], illi: ['quads', 'calves', 'glutes'] };
function muscleScores(mode) {
  const S = Object.fromEntries(Object.keys(MUSCLES).map(k => [k, { v: 0, src: '' }]));
  const bump = (m, v, src, main) => { if (!S[m]) return; const val = main ? v : v * .8; if (val > S[m].v) S[m] = { v: val, src }; };
  if (mode === 'week') {
    const from = addDays(today(), -6);
    for (const s of allSets().filter(s => s.date >= from)) exInfo(s.x).m.forEach((m, i) => { S[m].v += i ? .5 : 1; S[m].src = `${S[m].v} sets this week`; });
    for (const k in S) S[k].src = S[k].v ? `${r1(S[k].v)} sets in the last 7 days` : 'not trained in the last 7 days';
    return S;
  }
  for (const [id, p] of Object.entries(liftPRs())) { const f = liftLevel(id, p.e), ex = exInfo(id); if (f != null) ex.m.forEach((m, i) => bump(m, f, `${ex.name}: ${r1(p.e)} kg est. 1RM`, !i)); }
  for (const T of TESTS) { const best = pbHistory(T.id).best, f = testLevel(T, best); if (f == null || best == null) continue; (TEST_MUSCLES[T.id] || TEST_MUSCLES[T.cat] || []).forEach((m, i) => bump(m, f, `${T.name}: ${fmtTest(T, best)}`, !i)); }
  return S;
}
function bodyMapSvg(mode) {
  const S = muscleScores(mode);
  const fill = k => { const s = S[k]; if (!s.v) return 'var(--panel2)'; if (mode === 'week') { const t = Math.min(1, s.v / 16); return `hsl(${Math.round(45 - 45 * t)} 90% ${Math.round(62 - 14 * t)}%)`; } return rankOf(s.v).col; };
  const tip = k => { const s = S[k]; return `<title>${MUSCLES[k]}: ${mode === 'week' ? s.src : s.v ? `${rankOf(s.v).name} (${esc(s.src)})` : 'no PRs yet'}</title>`; };
  const P = (k, d) => `<path d="${d}" fill="${fill(k)}" class="mz">${tip(k)}</path>`;
  const sym = (k, d) => P(k, d) + `<path d="${d}" transform="translate(200 0) scale(-1 1)" fill="${fill(k)}" class="mz">${tip(k)}</path>`;
  const ell = (k, cx, cy, rx, ry) => sym(k, `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`);
  const skin = 'class="bskin"';
  const base = `<circle cx="100" cy="32" r="19" ${skin}/><rect x="91" y="48" width="18" height="14" rx="4" ${skin}/>
    <path d="M44 186a8 9 0 1 0 1 0zM156 186a8 9 0 1 0-1 0z" ${skin}/><path d="M80 262h17l-1 14h-15zM103 262h17l-1 14h-15z" ${skin}/><path d="M76 350h20l2 12h-24zM104 350h20l2 12h-24z" ${skin}/>`;
  const front = `<g>${base}
    ${sym('traps', 'M91 58 L72 68 L91 66Z')}${ell('delts', 64, 84, 13, 15)}
    ${sym('chest', 'M98 70 L76 74 Q66 92 76 106 Q90 112 98 106Z')}
    ${ell('biceps', 59, 118, 9, 19)}${sym('forearms', 'M48 140 Q44 160 46 180 L56 180 Q62 160 60 140Z')}
    <path d="M86 110h28v62a6 6 0 0 1-6 6h-16a6 6 0 0 1-6-6z" fill="${fill('abs')}" class="mz">${tip('abs')}</path>
    <path d="M100 112v62M87 128h26M87 144h26M88 160h24" stroke="var(--panel)" stroke-width="1.5" opacity=".6" fill="none"/>
    ${sym('obliques', 'M84 112 L75 110 Q69 140 77 172 L84 176Z')}
    <path d="M78 178h44l-8 18h-28z" ${skin}/>
    ${sym('quads', 'M77 182 Q68 214 78 262 L97 262 Q102 222 99 198Z')}
    ${sym('calves', 'M79 278 Q74 312 80 348 L95 348 Q100 312 96 278Z')}</g>`;
  const back = `<g transform="translate(205 0)">${base}
    ${sym('upperback', 'M100 78 L84 78 L90 110 L100 110Z')}${sym('traps', 'M100 52 L76 70 L100 84Z')}${ell('delts', 64, 84, 13, 15)}
    ${sym('lats', 'M84 82 L74 88 Q68 118 82 152 L94 152 L89 112Z')}
    <path d="M89 114h22v52h-22z" fill="${fill('lowerback')}" class="mz">${tip('lowerback')}</path>
    ${ell('triceps', 59, 118, 9, 19)}${sym('forearms', 'M48 140 Q44 160 46 180 L56 180 Q62 160 60 140Z')}
    ${ell('glutes', 88, 188, 13, 16)}
    ${sym('hams', 'M76 204 Q70 232 78 262 L97 262 Q102 232 99 206Z')}
    ${sym('calves', 'M78 278 Q70 306 81 348 L95 348 Q102 306 97 278Z')}</g>`;
  return `<svg class="bodymap" viewBox="30 0 345 370" role="img" aria-label="Muscle heat map">${front}${back}
    <text x="100" y="369" text-anchor="middle" class="bmlab">Front</text><text x="305" y="369" text-anchor="middle" class="bmlab">Back</text></svg>`;
}
function bodyMapCard() {
  const mode = ui.bmMode || 'pr', S = muscleScores(mode);
  const legend = mode === 'week' ? '<div class="bmlegend wk"><span>none</span><i></i><span>16+ sets</span></div>'
    : `<div class="bmlegend">${RANKS.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>`;
  const top = Object.entries(S).filter(([, s]) => s.v).sort((a, b) => b[1].v - a[1].v);
  return `<div class="card bmcard"><div class="card-head"><h2>🔥 Body heat map</h2><div class="seg"><button class="${mode === 'pr' ? 'on' : ''}" data-fit="bm" data-v="pr">PR ranks</button><button class="${mode === 'week' ? 'on' : ''}" data-fit="bm" data-v="week">This week</button></div></div>
    ${bodyMapSvg(mode)}${legend}
    <p class="muted small-text">${mode === 'week' ? 'Sets per muscle over the last 7 days. Hover a muscle for the count.' : top.length ? `Strongest: ${top.slice(0, 3).map(([k, s]) => `${MUSCLES[k]} (${rankOf(s.v).name})`).join(', ')}. Built from your gym PRs and every athletics result. Hover a muscle to see which PR.` : 'Log gym sets or athletics results and each muscle lights up by rank.'}${!bodyweight() ? ' Add your bodyweight in Food for accurate lift ranks.' : ''}</p></div>`;
}

// ---------- charts ----------
function lineChart(pts, { lower, fmt = v => r1(v), h = 150, color = 'var(--accent)', target } = {}) {
  if (pts.length < 2) return `<div class="fchart-empty muted small-text">${pts.length ? 'One entry so far. Log another to see a trend.' : 'Nothing logged yet.'}</div>`;
  const W = 520, ys = pts.map(p => p.y).concat(target ? [target] : []), mn = Math.min(...ys), mx = Math.max(...ys), span = mx - mn || 1;
  const t0 = parseYmd(pts[0].x), t1 = parseYmd(pts[pts.length - 1].x), tspan = (t1 - t0) || 1;
  const X = d => 34 + (parseYmd(d) - t0) / tspan * (W - 44), Y = v => 10 + (1 - (v - mn) / span) * (h - 30);
  const line = pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `34,${h - 20} ${line} ${X(pts[pts.length - 1].x).toFixed(1)},${h - 20}`;
  const best = lower ? Math.min(...pts.map(p => p.y)) : Math.max(...pts.map(p => p.y));
  return `<svg class="fchart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none">
    <line x1="34" x2="${W - 10}" y1="${Y(mx)}" y2="${Y(mx)}" class="fgrid"/><line x1="34" x2="${W - 10}" y1="${Y(mn)}" y2="${Y(mn)}" class="fgrid"/>
    <text x="30" y="${Y(mx) + 4}" class="fax" text-anchor="end">${fmt(mx)}</text><text x="30" y="${Y(mn) + 4}" class="fax" text-anchor="end">${fmt(mn)}</text>
    ${target ? `<line x1="34" x2="${W - 10}" y1="${Y(target)}" y2="${Y(target)}" class="ftarget"/>` : ''}
    <polygon points="${area}" fill="${color}" opacity=".12"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    ${pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.y === best ? 5 : 3.5}" fill="${p.y === best ? '#f59f00' : color}"><title>${fmtDate(p.x)}: ${fmt(p.y)}</title></circle>`).join('')}
    <text x="34" y="${h - 4}" class="fax">${fmtDate(pts[0].x)}</text><text x="${W - 10}" y="${h - 4}" class="fax" text-anchor="end">${fmtDate(pts[pts.length - 1].x)}</text></svg>`;
}
function barChart(rows, { target, fmt = v => v, color = 'var(--accent)' } = {}) {
  const mx = Math.max(1, target || 0, ...rows.map(r => r.v)) * 1.08;
  return `<div class="fbars">${target ? `<div class="fbar-target" style="bottom:calc(${(target / mx * 100).toFixed(1)}% * .82 + 18px)"><span>${fmt(target)}</span></div>` : ''}${rows.map(r => `<div class="fbar" title="${esc(r.title || r.label)}: ${fmt(r.v)}"><div class="fbar-t"><i style="height:${(r.v / mx * 100).toFixed(1)}%;background:${r.over ? 'var(--warn)' : color}"></i></div><small>${esc(r.label)}</small></div>`).join('')}</div>`;
}

// ---------- gym ----------
const gymSession = id => fitCfg().gym.find(g => g.id === id);
function startGym(copyId) {
  const F = fitCfg(), src = copyId && gymSession(copyId);
  const g = { id: uid(), date: today(), name: src ? src.name : 'Gym session', mins: src?.mins || 60, ex: src ? src.ex.map(it => ({ x: it.x, sets: it.sets.map(s => ({ w: s.w, r: s.r, warm: s.warm })) })) : [] };
  F.gym.push(g); ui.gymEdit = g.id; ui.bodyPage = 'gym'; save(); render();
}
function finishGym() {
  const g = gymSession(ui.gymEdit); if (!g) return;
  g.ex = g.ex.filter(it => it.sets.some(s => +s.r > 0));
  if (!g.ex.length) { fitCfg().gym = fitCfg().gym.filter(x => x !== g); ui.gymEdit = null; save(); render(); toast('Session discarded', 'It had no sets with reps in it.'); return; }
  const before = liftPRs(g.id), prs = [];
  for (const it of g.ex) { const best = Math.max(0, ...it.sets.filter(s => !s.warm).map(s => setE(exInfo(it.x), s))); if (before[it.x] && best > before[it.x].e + .01) prs.push(`${exInfo(it.x).name} ${r1(best)} kg`); }
  // mirror it as a done workout so it counts for the Arena, streaks and friends
  const wv = { date: g.date, title: g.name, sport: 'Strength / Gym', duration: +g.mins || 60, intensity: 'Hard', done: true, notes: g.ex.map(it => `${exInfo(it.x).name} ${it.sets.filter(s => +s.r).map(s => `${s.w || 0}x${s.r}`).join(', ')}`).join('\n') };
  const w = g.wid && D.workouts.find(x => x.id === g.wid);
  if (w) Object.assign(w, wv); else { g.wid = uid(); D.workouts.push({ id: g.wid, ...wv }); }
  ui.gymEdit = null; save(); render();
  if (prs.length) celebrate({ icon: '<span class="critbig">🏆</span>', color: '#f59f00', kicker: `${prs.length} new PR${prs.length === 1 ? '' : 's'}!`, title: esc(prs.slice(0, 3).join(' · ')), text: 'Estimated one-rep maxes, from your best set of each lift.' });
  else toast('💪 Session saved', `${g.ex.length} exercise${g.ex.length === 1 ? '' : 's'}, ${g.ex.reduce((a, it) => a + it.sets.length, 0)} sets.`);
}
function exPicker() {
  const groups = {}; for (const e of EXERCISES) (groups[e[2]] = groups[e[2]] || []).push(e);
  const custom = fitCfg().custom;
  return `<select id="gymAddEx"><option value="">+ Add an exercise…</option>${Object.entries(groups).map(([g, l]) => `<optgroup label="${g}">${l.map(e => `<option value="${e[0]}">${esc(e[1])}</option>`).join('')}</optgroup>`).join('')}
    ${custom.length ? `<optgroup label="Your exercises">${custom.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>` : ''}<option value="__new">➕ New exercise…</option></select>`;
}
let restTimer = null, restEnd = 0;
function startRest(sec = 90) {
  restEnd = Date.now() + sec * 1000; clearInterval(restTimer);
  const tick = () => { const el = document.getElementById('restT'), left = Math.max(0, Math.round((restEnd - Date.now()) / 1000)); if (el) { el.hidden = false; el.textContent = `⏱ Rest ${Math.floor(left / 60)}:${pad(left % 60)}`; } if (!left) { clearInterval(restTimer); if (el) el.textContent = '✅ Rest done, next set!'; if (typeof sfx === 'function') try { sfx('ding'); } catch { } } };
  tick(); restTimer = setInterval(tick, 500);
}
function gymEditor() {
  const g = gymSession(ui.gymEdit); if (!g) { ui.gymEdit = null; return ''; }
  const before = liftPRs(g.id);
  const rows = g.ex.map((it, ei) => {
    const ex = exInfo(it.x), pb = before[it.x];
    return `<div class="gex"><div class="gex-head"><b>${esc(ex.name)}</b><span class="muted small-text">${ex.m.map(m => MUSCLES[m]).join(', ')}${pb ? ` · best ${r1(pb.e)} kg est. 1RM` : ''}</span><span style="flex:1"></span><button class="iconbtn" data-fit="exDel" data-i="${ei}" title="Remove exercise">✕</button></div>
      <div class="gsets"><div class="gset gset-h"><span>Set</span><span>${ex.bwf ? '+kg' : 'kg'}</span><span>Reps</span><span>${isPlyo(ex) ? '' : 'Est. 1RM'}</span><span></span></div>
      ${it.sets.map((s, si) => { const e = setE(ex, s), isPr = !s.warm && e && (!pb || e > pb.e + .01);
        return `<div class="gset ${s.done ? 'done' : ''}"><button class="gnum ${s.warm ? 'warm' : ''}" data-fit="warm" data-i="${ei}" data-j="${si}" title="Tap to mark as a warm-up">${s.warm ? 'W' : si + 1}</button>
        <input id="gs_${ei}_${si}_w" data-gs="w" data-i="${ei}" data-j="${si}" type="number" step="0.5" min="0" inputmode="decimal" value="${s.w ?? ''}" placeholder="${ex.bwf ? '0' : 'kg'}">
        <input id="gs_${ei}_${si}_r" data-gs="r" data-i="${ei}" data-j="${si}" type="number" min="0" inputmode="numeric" value="${s.r ?? ''}" placeholder="reps">
        <span class="ge1">${e ? r1(e) : '–'}${isPr && pb ? ' <span class="tag green">PR</span>' : ''}</span>
        <span class="gbtns"><button class="iconbtn ${s.done ? 'on' : ''}" data-fit="setDone" data-i="${ei}" data-j="${si}" title="Done (starts rest timer)">✓</button><button class="iconbtn" data-fit="setDel" data-i="${ei}" data-j="${si}" title="Delete set">−</button></span></div>`; }).join('')}</div>
      <button class="btn small" data-fit="setAdd" data-i="${ei}">+ Set</button></div>`;
  }).join('');
  return `<div class="card gymedit" id="gymEdit"><div class="card-head"><h2>🏋️ Logging</h2><span id="restT" class="resttimer" hidden></span></div>
    <div class="frow gmeta"><div class="field"><label>Name</label><input data-gm="name" value="${esc(g.name)}"></div><div class="field"><label>Date</label><input data-gm="date" type="date" value="${g.date}"></div><div class="field"><label>Minutes</label><input data-gm="mins" type="number" min="5" value="${g.mins || 60}"></div></div>
    ${rows || '<p class="muted">Add your first exercise below. Each new set copies the one before it.</p>'}
    <div class="row gadd">${exPicker()}<span style="flex:1"></span><button class="btn" data-fit="gymCancel">Discard</button><button class="btn primary" data-fit="gymFinish">Finish session</button></div></div>`;
}
function gymPage() {
  const F = fitCfg(), P = liftPRs(), ids = Object.keys(P).sort((a, b) => P[b].last.localeCompare(P[a].last));
  const sel = ui.gymEx && P[ui.gymEx] ? ui.gymEx : ids[0];
  const recent = [...F.gym].filter(g => g.id !== ui.gymEdit).sort((a, b) => b.date.localeCompare(a.date));
  const weeks = Array.from({ length: 10 }, (_, i) => addDays(mondayOf(today()), -7 * (9 - i)));
  const sets = allSets(), wvol = weeks.map(w => ({ label: `${parseYmd(w).getDate()}/${parseYmd(w).getMonth() + 1}`, title: `Week of ${fmtDate(w)}`, v: Math.round(sets.filter(s => s.date >= w && s.date <= addDays(w, 6)).reduce((a, s) => a + s.w * s.r, 0)) }));
  const prTable = ids.length ? `<div class="prtable">${ids.map(id => { const p = P[id], f = liftLevel(id, p.e), rk = f != null ? rankOf(f) : null;
    return `<button class="prrow ${id === sel ? 'on' : ''}" data-fit="gymEx" data-v="${id}"><span class="main"><b>${esc(exInfo(id).name)}</b><small>${exInfo(id).bwf ? `most reps ${p.r}${p.w ? ` · heaviest +${r1(p.w)} kg` : ''}` : `heaviest ${r1(p.w)} kg · most reps ${p.r} · best volume ${Math.round(p.bestVol).toLocaleString()} kg`}</small></span><span class="prv">${r1(p.e)}<small>kg 1RM</small></span>${rankTag(rk)}</button>`; }).join('')}</div>` : '<p class="muted">Your PRs appear here once you log a session: best estimated 1RM, heaviest weight, most reps and best volume for every lift.</p>';
  const hist = sel ? Object.entries(P[sel].hist).sort().map(([x, y]) => ({ x, y })) : [];
  return `${ui.gymEdit ? gymEditor() : `<div class="card gymstart"><div><h2>🏋️ Gym log</h2><p class="muted small-text">Log weight × reps for each set. You get an estimated 1RM for every set and a PR flag the moment you beat your best.</p></div>
      <div class="row"><button class="btn primary" data-fit="gymStart">+ Start a session</button>${recent[0] ? `<button class="btn" data-fit="gymStart" data-id="${recent[0].id}">↻ Repeat "${esc(recent[0].name)}"</button>` : ''}</div></div>`}
    <div class="fit-grid">${bodyMapCard()}
      <div class="card"><div class="card-head"><h2>🏆 Lift PRs</h2><span class="muted small-text">est. 1RM = weight × (1 + reps ÷ 30)</span></div>${prTable}</div></div>
    <div class="fit-grid">
      <div class="card"><div class="card-head"><h2>📈 ${sel ? esc(exInfo(sel).name) : 'Strength'} progress</h2><span class="muted small-text">best est. 1RM per session</span></div>${lineChart(hist, { fmt: v => `${r1(v)}` })}</div>
      <div class="card"><div class="card-head"><h2>📊 Weekly volume</h2><span class="muted small-text">kg lifted (weight × reps)</span></div>${barChart(wvol, { fmt: v => `${v.toLocaleString()} kg` })}</div></div>
    ${recent.length ? `<div class="card"><div class="card-head"><h2>Sessions</h2><span class="muted small-text">${recent.length}</span></div><ul class="list">${recent.slice(0, ui.gymAll ? 999 : 8).map(g => `<li class="item"><span class="dot" style="background:#e03131"></span><div class="main"><div class="title">${esc(g.name)}</div><div class="meta">${fmtDate(g.date)} · ${g.ex.map(it => esc(exInfo(it.x).name)).join(', ')}</div></div>
      <button class="btn small" data-fit="gymStart" data-id="${g.id}" title="Start a new session with the same exercises">Repeat</button><button class="btn small" data-fit="gymOpen" data-id="${g.id}">Edit</button><button class="iconbtn" data-fit="gymDel" data-id="${g.id}" title="Delete">✕</button></li>`).join('')}</ul>
      ${recent.length > 8 && !ui.gymAll ? '<button class="btn small" data-fit="gymAll">Show all</button>' : ''}</div>` : ''}`;
}

// ---------- food ----------
const FOODS = [ // name, kcal, protein, carbs, fat (per serving)
  ['Banana', 105, 1, 27, 0], ['Apple', 95, 0, 25, 0], ['Orange', 62, 1, 15, 0], ['Egg (1 large)', 72, 6, 0, 5], ['Toast (1 slice, white)', 80, 3, 15, 1], ['Toast (1 slice, wholemeal)', 75, 4, 13, 1],
  ['Butter (1 tsp)', 34, 0, 0, 4], ['Peanut butter (1 tbsp)', 95, 4, 3, 8], ['Vegemite on toast', 95, 5, 15, 1], ['Oats (1/2 cup dry)', 150, 5, 27, 3], ['Weet-Bix (2) + milk', 230, 11, 34, 5], ['Cereal bowl + milk', 250, 8, 42, 5],
  ['Milk (250ml, full)', 165, 8, 12, 9], ['Milk (250ml, skim)', 90, 9, 13, 0], ['Greek yoghurt (170g)', 150, 15, 8, 6], ['Protein shake (1 scoop + water)', 120, 24, 3, 2], ['Protein shake (1 scoop + milk)', 285, 32, 15, 11],
  ['Chicken breast (150g)', 250, 46, 0, 5], ['Beef mince (150g)', 375, 30, 0, 28], ['Steak (200g)', 420, 52, 0, 23], ['Salmon (150g)', 310, 33, 0, 19], ['Tuna can (95g)', 105, 23, 0, 1],
  ['Rice (1 cup cooked)', 205, 4, 45, 0], ['Pasta (1 cup cooked)', 220, 8, 43, 1], ['Potato (medium)', 160, 4, 37, 0], ['Sweet potato (medium)', 115, 2, 27, 0], ['Wrap (1)', 180, 5, 30, 4],
  ['Ham & cheese sandwich', 350, 20, 32, 15], ['Chicken wrap', 450, 30, 40, 18], ['Sushi roll (6 pc)', 300, 9, 55, 4], ['Burger', 550, 28, 42, 28], ['Pizza (2 slices)', 570, 24, 64, 22], ['Meat pie', 450, 13, 33, 29],
  ['Chips / fries (medium)', 380, 4, 48, 19], ['Spaghetti bolognese', 550, 30, 65, 17], ['Stir fry with rice', 600, 32, 75, 16], ['Salad (side)', 60, 2, 8, 2], ['Vegetables (1 cup)', 50, 3, 10, 0],
  ['Cheese (1 slice)', 70, 4, 0, 6], ['Almonds (30g)', 175, 6, 6, 15], ['Muesli bar', 140, 2, 22, 5], ['Chocolate bar', 240, 3, 28, 13], ['Chips (small packet)', 230, 3, 23, 14], ['Ice cream (1 cup)', 270, 5, 31, 14],
  ['Orange juice (250ml)', 110, 2, 26, 0], ['Soft drink (375ml)', 160, 0, 40, 0], ['Sports drink (600ml)', 150, 0, 36, 0], ['Iced coffee (500ml)', 340, 16, 48, 9], ['Flat white', 120, 7, 10, 6],
];
const MEALS = [['b', '🍳 Breakfast'], ['l', '🥪 Lunch'], ['d', '🍝 Dinner'], ['s', '🍎 Snacks']];
function foodTargets() {
  const p = fitCfg().prof, w = bodyweight();
  if (!w || !p.height || !p.age || !p.sex) return null;
  const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5), tdee = bmr * (+p.act || 1.55);
  const minor = p.age < 18, adj = p.goal === 'gain' ? 300 : p.goal === 'cut' ? (minor ? -200 : -400) : 0;
  const kcal = Math.round(Math.max(tdee + adj, bmr * 1.2, p.sex === 'f' ? 1600 : 1900) / 10) * 10;
  const prot = Math.round(w * 1.6), fat = Math.round(kcal * .28 / 9), carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, prot, fat, carb, minor };
}
const dayFood = d => fitCfg().food[d] || [];
const dayTotals = d => dayFood(d).reduce((a, f) => ({ k: a.k + (+f.k || 0), p: a.p + (+f.p || 0), c: a.c + (+f.c || 0), f: a.f + (+f.f || 0) }), { k: 0, p: 0, c: 0, f: 0 });
function addFood(vals) {
  const F = fitCfg(), d = ui.foodDay || today(), q = +vals.q || 1;
  const item = { id: uid(), n: vals.n.slice(0, 60), m: vals.m || 'b', k: Math.round(vals.k * q), p: r1(vals.p * q), c: r1(vals.c * q), f: r1(vals.f * q) };
  (F.food[d] = F.food[d] || []).push(item);
  const base = { n: item.n, k: +vals.k, p: +vals.p, c: +vals.c, f: +vals.f };
  F.myFoods = [base, ...F.myFoods.filter(x => x.n.toLowerCase() !== item.n.toLowerCase())].slice(0, 40);
  save(); render();
}
function foodLookup(name) {
  const n = name.trim().toLowerCase(); if (!n) return null;
  const mine = fitCfg().myFoods.find(x => x.n.toLowerCase() === n); if (mine) return mine;
  const f = FOODS.find(x => x[0].toLowerCase() === n); return f ? { n: f[0], k: f[1], p: f[2], c: f[3], f: f[4] } : null;
}
function foodPage() {
  const F = fitCfg(), P = F.prof, d = ui.foodDay || today(), T = foodTargets(), t = dayTotals(d), bw = bodyweight();
  const ring = (v, max, col, label, unit) => { const C = 2 * Math.PI * 34, pct = max ? Math.min(1, v / max) : 0;
    return `<div class="mring"><svg viewBox="0 0 80 80" width="88" height="88"><circle cx="40" cy="40" r="34" class="mp-track"/><circle cx="40" cy="40" r="34" fill="none" stroke="${v > max * 1.05 && max ? 'var(--warn)' : col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 40 40)"/></svg><div><b>${Math.round(v)}</b><small>${max ? `/ ${max}${unit}` : unit}</small></div><span>${label}</span></div>`; };
  const setup = `<details class="card fprof" ${T ? '' : 'open'}><summary><b>⚙️ Your body and goal</b> <span class="muted small-text">${T ? `maintenance ≈ ${T.tdee.toLocaleString()} kcal · BMR ${T.bmr.toLocaleString()}` : 'fill these in to get your daily targets'}</span></summary>
    <div class="frow"><div class="field"><label>Sex</label><select data-fp="sex"><option value="">Choose…</option><option value="m" ${P.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${P.sex === 'f' ? 'selected' : ''}>Female</option></select></div>
    <div class="field"><label>Age</label><input data-fp="age" type="number" min="10" max="99" value="${P.age || ''}"></div><div class="field"><label>Height (cm)</label><input data-fp="height" type="number" min="100" max="230" value="${P.height || ''}"></div>
    <div class="field"><label>Weight (kg)</label><input data-fp="weight" type="number" step="0.1" min="25" max="250" value="${bw || ''}"></div></div>
    <div class="frow"><div class="field"><label>How active</label><select data-fp="act">${[[1.2, 'Mostly sitting'], [1.375, 'Light (1-2 sessions a week)'], [1.55, 'Active (3-5 sessions a week)'], [1.725, 'Very active (6+ sessions)'], [1.9, 'Athlete (twice a day)']].map(([v, l]) => `<option value="${v}" ${+P.act === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Goal</label><select data-fp="goal">${[['maintain', 'Fuel my training (maintain)'], ['gain', 'Build muscle (+300 kcal)'], ['cut', 'Lean out slowly']].map(([v, l]) => `<option value="${v}" ${P.goal === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <p class="muted small-text">Targets use the Mifflin-St Jeor formula times your activity. Protein is 1.6 g per kg. ${T?.minor ? 'You\'re still growing, so "lean out" is kept gentle and the target never drops below a safe floor.' : 'Targets never drop below a safe floor.'}</p></details>`;
  const sugg = [...F.myFoods.map(x => x.n), ...FOODS.map(f => f[0])].filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
  const add = `<div class="card"><div class="card-head"><h2>➕ Add food</h2></div>
    <div class="frow fadd"><div class="field grow"><label>Food</label><input id="fdN" list="fdList" placeholder="Start typing, e.g. Banana" autocomplete="off"><datalist id="fdList">${sugg.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
    <div class="field"><label>Servings</label><input id="fdQ" type="number" step="0.25" min="0.25" value="1"></div><div class="field"><label>Meal</label><select id="fdM">${MEALS.map(([k, l]) => `<option value="${k}" ${k === defaultMeal() ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="frow fadd"><div class="field"><label>kcal</label><input id="fdK" type="number" min="0"></div><div class="field"><label>Protein g</label><input id="fdP" type="number" min="0" step="0.1"></div><div class="field"><label>Carbs g</label><input id="fdC" type="number" min="0" step="0.1"></div><div class="field"><label>Fat g</label><input id="fdF" type="number" min="0" step="0.1"></div><div class="field"><label>&nbsp;</label><button class="btn primary" data-fit="foodAdd">Add</button></div></div>
    ${F.myFoods.length ? `<div class="fchips"><span class="muted small-text">Quick add:</span>${F.myFoods.slice(0, 10).map((x, i) => `<button class="chip" data-fit="foodQuick" data-i="${i}" title="${x.k} kcal · ${x.p}g protein">${esc(x.n)}</button>`).join('')}</div>` : ''}</div>`;
  const list = MEALS.map(([k, l]) => { const items = dayFood(d).filter(x => x.m === k); if (!items.length) return '';
    return `<div class="daygroup">${l} <span class="muted small-text">${items.reduce((a, x) => a + x.k, 0)} kcal</span></div><ul class="list">${items.map(x => `<li class="item"><div class="main"><div class="title">${esc(x.n)}</div><div class="meta">${x.k} kcal · P ${x.p}g · C ${x.c}g · F ${x.f}g</div></div><button class="iconbtn" data-fit="foodDel" data-id="${x.id}" title="Remove">✕</button></li>`).join('')}</ul>`; }).join('');
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const kRows = days.map(x => { const v = dayTotals(x).k; return { label: DOW[parseYmd(x).getDay()].slice(0, 2), title: fmtDate(x), v, over: T && v > T.kcal * 1.1 }; });
  const wPts = Object.entries(F.weights).sort().slice(-60).map(([x, y]) => ({ x, y: +y }));
  return `${setup}
    <div class="card fday"><div class="card-head"><div class="row"><button class="iconbtn" data-fit="foodDay" data-n="-1">‹</button><h2 style="margin:0">${d === today() ? 'Today' : fmtDate(d)}</h2><button class="iconbtn" data-fit="foodDay" data-n="1" ${d >= today() ? 'disabled' : ''}>›</button>${d !== today() ? '<button class="btn small" data-fit="foodDay" data-n="0">Today</button>' : ''}</div>
      <span class="muted small-text">${T ? `${Math.max(0, T.kcal - t.k).toLocaleString()} kcal left` : ''}</span></div>
      <div class="mrings">${ring(t.k, T?.kcal, '#f76707', 'Calories', '')}${ring(t.p, T?.prot, '#e03131', 'Protein', 'g')}${ring(t.c, T?.carb, '#1c7ed6', 'Carbs', 'g')}${ring(t.f, T?.fat, '#f59f00', 'Fat', 'g')}</div>
      ${list || '<p class="muted small-text">Nothing logged for this day yet.</p>'}</div>
    ${add}
    <div class="fit-grid"><div class="card"><div class="card-head"><h2>📊 Calories, last 14 days</h2>${T ? `<span class="muted small-text">line = ${T.kcal.toLocaleString()} target</span>` : ''}</div>${barChart(kRows, { target: T?.kcal, color: '#f76707' })}</div>
      <div class="card"><div class="card-head"><h2>⚖️ Bodyweight</h2><div class="row"><input id="bwIn" type="number" step="0.1" min="25" max="250" placeholder="kg" style="width:80px" value=""><button class="btn small" data-fit="bwLog">Log today</button></div></div>${lineChart(wPts, { fmt: v => `${r1(v)}`, color: '#7950f2' })}</div></div>`;
}
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'b' : h < 15 ? 'l' : h < 21 ? 'd' : 's'; };

// ---------- athletics ----------
const TEST_CATS = [['sprint', '⚡ Sprints'], ['hurdle', '🚧 Hurdles'], ['dist', '🏃 Middle and distance'], ['jump', '🦘 Jumps'], ['throw', '🥏 Throws'], ['rm', '🏋️ 1 rep maxes'], ['test', '📏 Fitness tests']];
function myBests() { const o = {}; for (const T of TESTS) { const b = pbHistory(T.id).best; if (b != null) o[T.id] = b; } return o; }
function bestsSummary() {
  const B = myBests(), P = liftPRs(), lifts = Object.entries(P).sort((a, b) => b[1].e - a[1].e).slice(0, 8);
  const cells = TESTS.filter(T => B[T.id] != null).map(T => { const rk = rankOf(testLevel(T, B[T.id]) ?? 0); return `<div class="lbest" style="--rk:${rk.col}"><small>${esc(T.name)}</small><b>${fmtTest(T, B[T.id])}</b>${rankTag(rk)}</div>`; });
  const liftCells = lifts.map(([id, p]) => { const f = liftLevel(id, p.e); return `<div class="lbest est" style="--rk:${f != null ? rankOf(f).col : 'var(--border)'}"><small>${esc(exInfo(id).name)} <em>est.</em></small><b>${r1(p.e)} kg</b>${f != null ? rankTag(rankOf(f)) : ''}</div>`; });
  return `<div class="card"><div class="card-head"><h2>🏅 Logged bests</h2><span class="muted small-text">${cells.length} event${cells.length === 1 ? '' : 's'}${acct?.signedIn ? ' · your friends can see these' : ''}</span></div>
    ${cells.length || liftCells.length ? `<div class="lbests">${cells.join('')}${liftCells.join('')}</div>` : '<p class="muted">Log a result below and it shows up here with its rank, from Rookie up to Legend.</p>'}</div>`;
}
function athleticsPage() {
  const cat = ui.athCat || 'sprint';
  const tabs = `<div class="seg athtabs">${TEST_CATS.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-fit="athCat" data-v="${k}">${l}</button>`).join('')}<button class="${cat === 'records' ? 'on' : ''}" data-fit="athCat" data-v="records">🏆 Records</button></div>`;
  if (cat === 'records') return `${bestsSummary()}${tabs}${recordsHtml().replace(/<h2 style="margin:18px 0 10px">.*<\/h2>/, '')}`;
  const card = T => {
    const h = pbHistory(T.id), last = h.list[h.list.length - 1], si = statInfo(T.stat), rk = h.best != null ? rankOf(testLevel(T, h.best) ?? 0) : null;
    const open = ui.athOpen === T.id;
    return `<div class="card pbcard" style="--sc:${si[3]}"><div class="card-head"><h2>${esc(T.name)}</h2>${rankTag(rk)}<span class="tag" style="background:${si[3]}22;color:${si[3]}">${si[2]}</span></div>
      <div class="pbbest">${h.best != null ? fmtTest(T, h.best) : '<span class="muted">No result yet</span>'}</div>
      ${rk ? `<div class="rkbar" title="Progress from starting out to elite"><i style="width:${Math.min(100, rk.f * 100).toFixed(0)}%;background:${rk.col}"></i></div>` : ''}
      ${open ? lineChart(h.list.filter(p => p.date).map(p => ({ x: p.date, y: p.value })), { lower: T.lower, fmt: v => fmtTest(T, v), h: 120 }) : spark(h.list.map(p => p.value), T.lower)}
      <div class="muted small-text">${h.list.length ? `${h.list.length} result${h.list.length === 1 ? '' : 's'} · ${h.list.filter(p => p.pb).length} PB${h.list.filter(p => p.pb).length === 1 ? '' : 's'} · last ${pbWhen(last)}` : `${T.lower ? 'Lower' : 'Higher'} is better · ${T.time ? 'm:ss' : T.unit}`}${h.list.length > 1 ? ` · <a href="#" data-fit="athOpen" data-v="${T.id}">${open ? 'hide graph' : 'graph'}</a>` : ''}</div>
      <div class="row pbadd"><input id="pbv_${T.id}" type="text" inputmode="decimal" placeholder="${T.time ? 'm:ss' : T.unit}"><input id="pbd_${T.id}" type="date" value="${today()}"><button class="btn small primary" data-act="addPb" data-id="${T.id}">Log</button></div><button class="pbunk" data-act="addPbUnk" data-id="${T.id}" title="Log the result without a date, for a best you did a while ago">🤷 Don't know when I did it</button>
      ${h.list.length ? `<details><summary class="small-text">History</summary>${[...h.list].reverse().map(p => `<div class="pbrow"><span>${pbWhen(p)}</span><b>${fmtTest(T, p.value)}</b>${p.pb ? '<span class="tag green">PB</span>' : ''}<button class="iconbtn" data-act="delPb" data-id="${p.id}" title="Delete">✕</button></div>`).join('')}</details>` : ''}</div>`;
  };
  const est = cat === 'rm' ? (() => { const P = liftPRs(), map = { bench: 'bench', sq: 'squat', dl: 'deadlift', ohp: 'ohp', clean: 'clean', fsq: 'fsquat', hipt: 'hipthrust' };
    const rows = Object.entries(map).filter(([, x]) => P[x]).map(([t, x]) => `<span class="tag">${esc(exInfo(x).name)}: ~${r1(P[x].e)} kg</span>`);
    return rows.length ? `<p class="muted small-text" style="margin-top:12px">Estimated from your gym log: ${rows.join(' ')}. Log a real max here when you test it.</p>` : ''; })() : '';
  return `${bestsSummary()}${tabs}${est}<div class="pbgrid">${TESTS.filter(T => T.cat === cat).map(card).join('')}</div>`;
}
// what friends see (kept small: it rides along with the board row)
function fitPublish() {
  const P = liftPRs(), l = {}; for (const [id, p] of Object.entries(P)) l[id] = r1(p.e);
  return { b: myBests(), l, bw: bodyweight() || undefined };
}
function friendBestsHtml(f) {
  const mine = myBests(), theirs = f.raw?.fit?.b || {}, ids = TESTS.filter(T => mine[T.id] != null || theirs[T.id] != null);
  if (!ids.length) return '';
  return `<h3 style="margin:16px 0 6px">🏅 Athletics and lifts</h3><div class="cmp">${ids.map(T => { const a = mine[T.id], b = theirs[T.id], aw = a != null && (b == null || (T.lower ? a < b : a > b)), bw = b != null && (a == null || (T.lower ? b < a : b > a));
    return `<div class="cmp-row"><span class="cmp-v ${aw ? 'win' : ''}">${fmtTest(T, a)}</span><div class="cmp-mid"><small>${esc(T.name)}</small></div><span class="cmp-v r ${bw ? 'win' : ''}">${fmtTest(T, b)}</span></div>`; }).join('')}</div>`;
}

// ---------- events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-fit]'); if (!el) return;
  e.preventDefault();
  const F = fitCfg(), a = el.dataset.fit, g = gymSession(ui.gymEdit), i = +el.dataset.i, j = +el.dataset.j;
  switch (a) {
    case 'bm': ui.bmMode = el.dataset.v; render(); break;
    case 'gymStart': if (ui.gymEdit && !confirm('Discard the session you are logging and start another?')) return; if (ui.gymEdit) F.gym = F.gym.filter(x => x.id !== ui.gymEdit || x.wid); startGym(el.dataset.id); break;
    case 'gymOpen': ui.gymEdit = el.dataset.id; render(); window.scrollTo(0, 0); break;
    case 'gymFinish': finishGym(); break;
    case 'gymCancel': if (g && !g.wid && !confirm('Discard this session?')) return; if (g && !g.wid) F.gym = F.gym.filter(x => x !== g); ui.gymEdit = null; save(); render(); break;
    case 'gymDel': if (confirm('Delete this session?')) { const s = gymSession(el.dataset.id); F.gym = F.gym.filter(x => x !== s); if (s?.wid) D.workouts = D.workouts.filter(w => w.id !== s.wid); save(); render(); } break;
    case 'gymEx': ui.gymEx = el.dataset.v; render(); break;
    case 'gymAll': ui.gymAll = true; render(); break;
    case 'exDel': g.ex.splice(i, 1); save(); render(); break;
    case 'setAdd': { const s = g.ex[i].sets, last = s[s.length - 1]; s.push({ w: last?.w ?? '', r: last?.r ?? '' }); save(); render(); document.getElementById(`gs_${i}_${s.length - 1}_w`)?.focus(); break; }
    case 'setDel': g.ex[i].sets.splice(j, 1); save(); render(); break;
    case 'warm': g.ex[i].sets[j].warm = !g.ex[i].sets[j].warm; save(); render(); break;
    case 'setDone': { const s = g.ex[i].sets[j]; s.done = !s.done; save(); render(); if (s.done) startRest(); break; }
    case 'foodAdd': {
      const n = $('#fdN').value.trim(), k = +$('#fdK').value; if (!n || !(k >= 0) || $('#fdK').value === '') { toast('Add a food name and its calories', 'Pick from the list to fill them in automatically.'); return; }
      addFood({ n, k, p: +$('#fdP').value || 0, c: +$('#fdC').value || 0, f: +$('#fdF').value || 0, q: +$('#fdQ').value || 1, m: $('#fdM').value }); break; }
    case 'foodQuick': { const x = F.myFoods[i]; if (x) addFood({ ...x, q: 1, m: defaultMeal() }); break; }
    case 'foodDel': { const d = ui.foodDay || today(); F.food[d] = dayFood(d).filter(x => x.id !== el.dataset.id); if (!F.food[d].length) delete F.food[d]; save(); render(); break; }
    case 'foodDay': { const n = +el.dataset.n; ui.foodDay = n === 0 ? today() : addDays(ui.foodDay || today(), n); if (ui.foodDay > today()) ui.foodDay = today(); render(); break; }
    case 'bwLog': { const v = +$('#bwIn').value; if (!(v >= 25 && v <= 250)) { toast('Enter your weight in kg'); return; } F.weights[today()] = r1(v); save(); render(); toast('⚖️ Weight logged', `${r1(v)} kg`); break; }
    case 'athCat': ui.athCat = el.dataset.v; render(); break;
    case 'athOpen': ui.athOpen = ui.athOpen === el.dataset.v ? null : el.dataset.v; render(); break;
  }
});
document.addEventListener('change', e => {
  const el = e.target, F = D && fitCfg();
  if (el.dataset.gs || el.dataset.gm) {
    const g = gymSession(ui.gymEdit); if (!g) return;
    if (el.dataset.gm) g[el.dataset.gm] = el.dataset.gm === 'mins' ? +el.value : el.dataset.gm === 'date' ? (el.value || today()) : el.value.slice(0, 60);
    else { const v = el.value === '' ? '' : Math.max(0, +el.value); g.ex[+el.dataset.i].sets[+el.dataset.j][el.dataset.gs] = v; }
    save();
    if (el.dataset.gs) setTimeout(() => { const f = document.activeElement?.id; const box = document.getElementById('gymEdit'); if (box) { box.outerHTML = gymEditor(); if (f) document.getElementById(f)?.focus(); } if (restEnd > Date.now()) startRest(Math.round((restEnd - Date.now()) / 1000)); }, 0);
  } else if (el.id === 'gymAddEx' && el.value) {
    const g = gymSession(ui.gymEdit); if (!g) return;
    let id = el.value;
    if (id === '__new') { const name = (prompt('Name of the exercise?') || '').trim().slice(0, 50); if (!name) { el.value = ''; return; }
      const pick = (prompt(`Main muscles, separated by commas (${Object.values(MUSCLES).join(', ')})`) || '').toLowerCase();
      const m = Object.entries(MUSCLES).filter(([, n]) => pick.includes(n.toLowerCase())).map(([k]) => k);
      id = 'c' + uid(); F.custom.push({ id, name, m }); }
    const prev = [...F.gym].filter(x => x.id !== g.id).sort((a, b) => b.date.localeCompare(a.date)).flatMap(x => x.ex).find(it => it.x === id);
    g.ex.push({ x: id, sets: prev ? prev.sets.filter(s => !s.warm).map(s => ({ w: s.w, r: s.r })) : [{ w: '', r: '' }] });
    save(); render();
  } else if (el.dataset.fp) {
    const k = el.dataset.fp;
    if (k === 'weight') { if (+el.value >= 25) F.weights[today()] = r1(+el.value); }
    else F.prof[k] = ['age', 'height', 'act'].includes(k) ? +el.value : el.value;
    save(); render();
  } else if (el.id === 'fdN') {
    const f = foodLookup(el.value); if (f) { $('#fdK').value = f.k; $('#fdP').value = f.p; $('#fdC').value = f.c; $('#fdF').value = f.f; }
  }
});
