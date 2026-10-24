'use strict';
/* Arena: the training game. Every workout you tick off builds your athlete's
   stats (Speed, Power, Strength, Endurance, Agility) and earns Grit, the Arena's
   own currency. Grit buys gear; stats and gear win battles against a ladder of
   rivals. Personal bests, training combos, recovery and weekly quests feed in.
   Stats and most Grit are worked out from the planner data each time, so
   ticking a workout on and off can't farm them. */

const GRIT = '💪';
const STATS = [['spd', 'Speed', 'SPD', '#339af0'], ['pow', 'Power', 'POW', '#f76707'], ['str', 'Strength', 'STR', '#e03131'], ['end', 'Endurance', 'END', '#2f9e44'], ['agi', 'Agility', 'AGI', '#9c36b5']];
const STAT_IDS = STATS.map(s => s[0]);
const statInfo = id => STATS.find(s => s[0] === id);
const INTENSITY = { Easy: .8, Moderate: 1, Hard: 1.3 };
const MOVES = { spd: ['💨', 'Burst of speed'], pow: ['💥', 'Leap and bump'], str: ['🛡️', 'Shoulder charge'], end: ['🫁', 'Outlast'], agi: ['🌀', 'Sidestep'] };

const TESTS = [
  { id: 's40', name: '40m sprint', unit: 's', lower: true, stat: 'spd' },
  { id: 's100', name: '100m sprint', unit: 's', lower: true, stat: 'spd' },
  { id: 'agil', name: '5-10-5 agility', unit: 's', lower: true, stat: 'agi' },
  { id: 'vj', name: 'Vertical jump', unit: 'cm', stat: 'pow' },
  { id: 'bj', name: 'Standing broad jump', unit: 'cm', stat: 'pow' },
  { id: 'beep', name: 'Beep test', unit: 'level', stat: 'end' },
  { id: 'tt2k', name: '2km time trial', unit: 'm:ss', lower: true, stat: 'end', time: true },
  { id: 'sq', name: 'Back squat (best set)', unit: 'kg', stat: 'str' },
  { id: 'bench', name: 'Bench press (best set)', unit: 'kg', stat: 'str' },
  { id: 'pull', name: 'Pull-ups (max reps)', unit: 'reps', stat: 'str' },
  { id: 's60', name: '60m sprint', unit: 's', lower: true, stat: 'spd' },
  { id: 's200', name: '200m', unit: 's', lower: true, stat: 'spd' },
  { id: 's400', name: '400m', unit: 's', lower: true, stat: 'spd' },
  { id: 'tt1k', name: '1km time trial', unit: 'm:ss', lower: true, stat: 'end', time: true },
  { id: 'tt3k', name: '3km time trial', unit: 'm:ss', lower: true, stat: 'end', time: true },
  { id: 'tt5k', name: '5km run', unit: 'm:ss', lower: true, stat: 'end', time: true },
  { id: 'tt10k', name: '10km run', unit: 'm:ss', lower: true, stat: 'end', time: true },
  { id: 'yoyo', name: 'Yo-yo test', unit: 'level', stat: 'end' },
  { id: 'illi', name: 'Illinois agility', unit: 's', lower: true, stat: 'agi' },
  { id: 'tri', name: 'Triple jump (standing)', unit: 'm', stat: 'pow' },
  { id: 'mb', name: 'Med ball throw', unit: 'm', stat: 'pow' },
  { id: 'dl', name: 'Deadlift (best set)', unit: 'kg', stat: 'str' },
  { id: 'push', name: 'Push-ups (max reps)', unit: 'reps', stat: 'str' },
  { id: 'plank', name: 'Plank hold', unit: 'm:ss', stat: 'str', time: true },
  { id: 'sit', name: 'Sit-and-reach', unit: 'cm', stat: 'agi' },
  { id: 'swim50', name: '50m swim', unit: 's', lower: true, stat: 'end' },
];
const GEAR = [
  { id: 'b_run', slot: 'boots', icon: '👟', name: 'Training runners', bonus: { spd: 2 }, price: 80 },
  { id: 'b_spike', slot: 'boots', icon: '⚡', name: 'Sprint spikes', bonus: { spd: 4, pow: 1 }, price: 250 },
  { id: 'b_footy', slot: 'boots', icon: '🥾', name: 'Footy boots', bonus: { agi: 3, spd: 2 }, price: 300 },
  { id: 'b_carbon', slot: 'boots', icon: '🚀', name: 'Carbon racers', bonus: { spd: 5, end: 2 }, price: 450 },
  { id: 'b_gold', slot: 'boots', icon: '🌟', name: 'Golden boots', bonus: { spd: 6, agi: 3 }, price: 700 },
  { id: 't_tee', slot: 'top', icon: '👕', name: 'Club tee', bonus: { end: 2 }, price: 60, color: '#868e96' },
  { id: 't_singlet', slot: 'top', icon: '🎽', name: 'Race singlet', bonus: { end: 3, spd: 1 }, price: 200, color: '#1c7ed6' },
  { id: 't_guernsey', slot: 'top', icon: '🦺', name: 'Footy guernsey', bonus: { str: 3, agi: 2 }, price: 300, color: '#c92a2a' },
  { id: 't_comp', slot: 'top', icon: '🩱', name: 'Compression top', bonus: { end: 3, str: 2 }, price: 350, color: '#212529' },
  { id: 't_state', slot: 'top', icon: '🎖️', name: 'State team kit', bonus: { spd: 4, pow: 4, agi: 4 }, price: 1200, color: '#1b2a6b' },
  { id: 't_captain', slot: 'top', icon: '🏅', name: "Captain's guernsey", bonus: { spd: 3, pow: 3, str: 3, end: 3, agi: 3 }, price: 900, color: '#f59f00' },
  { id: 'x_watch', slot: 'extra', icon: '⌚', name: 'GPS sports watch', bonus: { end: 3 }, price: 150 },
  { id: 'x_straps', slot: 'extra', icon: '🧤', name: 'Lifting straps', bonus: { str: 4 }, price: 200 },
  { id: 'x_phones', slot: 'extra', icon: '🎧', name: 'Hype headphones', bonus: { pow: 3, spd: 1 }, price: 180 },
  { id: 'x_band', slot: 'extra', icon: '🎗️', name: 'Agility ladder', bonus: { agi: 4 }, price: 220 },
  { id: 'x_vest', slot: 'extra', icon: '🦺', name: 'Weighted vest', bonus: { str: 3, end: 3 }, price: 380 },
  { id: 'x_ice', slot: 'extra', icon: '🧊', name: 'Ice bath pass', bonus: { end: 2, agi: 2 }, price: 260 },
  { id: 'x_crown', slot: 'extra', icon: '👑', name: 'Hall of Fame ring', bonus: { spd: 4, pow: 4, str: 4, end: 4, agi: 4 }, price: 1600 },
  { id: 'x_medal', slot: 'extra', icon: '🏆', name: 'Premiership medal', bonus: { spd: 2, pow: 2, str: 2, end: 2, agi: 2 }, price: 650 },
];
const SLOTS = [['boots', 'Boots'], ['top', 'Top'], ['extra', 'Extra']];
// rivals: overall rating and which stats they lean on, in four leagues that each end with a boss
const LEAGUES = [
  { id: 'local', name: 'Local Oval', icon: '🏟️', badge: '🥉', badgeName: 'Oval badge', sky: 'linear-gradient(180deg,#74c0fc,#d0ebff)', ground: '#69db7c', blurb: 'Where it all starts. Muddy, loud, and full of try-hards.' },
  { id: 'regional', name: 'Coastal Track', icon: '🏖️', badge: '🌊', badgeName: 'Wave badge', sky: 'linear-gradient(180deg,#ffa94d,#ffe8cc)', ground: '#c2410c', blurb: 'A sunset running track by the beach. Fast and windy.' },
  { id: 'state', name: 'State Stadium', icon: '🏛️', badge: '⭐', badgeName: 'Star badge', sky: 'linear-gradient(180deg,#364fc7,#748ffc)', ground: '#2b8a3e', blurb: 'Big crowds under the lights. Only the best make it here.' },
  { id: 'national', name: 'National Arena', icon: '🌃', badge: '🏆', badgeName: 'Champion badge', sky: 'linear-gradient(180deg,#0b0b23,#3b1f6b)', ground: '#5f3dc4', blurb: 'The biggest stage in the country.' },
  { id: 'summit', name: 'Everest Summit', icon: '🏔️', badge: '🏔️', badgeName: 'Summit badge', sky: 'linear-gradient(180deg,#1c3d6e,#a5d8ff 70%,#fff)', ground: '#e7f5ff', blurb: 'Thin air, deep snow, and legends who live up here.' },
];
const ENEMIES = [
  { id: 'couch', league: 'local', icon: '🛋️', name: 'Couch Potato', r: 34, bias: { end: -6, spd: -4 }, line: 'Hasn\'t moved since the last ad break.' },
  { id: 'turtle', league: 'local', icon: '🐢', name: 'Turtle Tom', r: 40, bias: { end: 8, spd: -10 }, line: 'Slow, but never stops.' },
  { id: 'sprinter', league: 'local', icon: '🏃', name: 'Club Sprinter', r: 46, bias: { spd: 10, end: -8 }, line: 'Fast off the blocks, fades late.' },
  { id: 'gymbro', league: 'local', icon: '🏋️', name: 'Gym Bro Brad', r: 51, bias: { str: 12, agi: -8, end: -4 }, line: 'Never skips leg day. Or arm day. Or any day.' },
  { id: 'coach', league: 'local', icon: '📣', name: 'Coach Crusher', r: 56, bias: { end: 6, str: 4 }, boss: true, hp: 130, special: 'Extra laps!', line: 'BOSS. Again! And this time like you mean it!' },
  { id: 'wall', league: 'regional', icon: '🧱', name: 'The Wall', r: 60, bias: { str: 10, pow: 4, spd: -10 }, line: 'Full-back. You won\'t get past easily.' },
  { id: 'cheetah', league: 'regional', icon: '🐆', name: 'Cheetah Kid', r: 64, bias: { spd: 12, agi: 6, str: -10 }, line: 'Blink and you\'ll miss them.' },
  { id: 'roo', league: 'regional', icon: '🦘', name: 'Ruckman Roo', r: 68, bias: { pow: 12, str: 4, agi: -8 }, line: 'Jumps over everyone at the bounce.' },
  { id: 'croc', league: 'regional', icon: '🐊', name: 'Croc Rocket', r: 71, bias: { pow: 8, str: 8, end: -8 }, line: 'Lies still, then explodes.' },
  { id: 'storm', league: 'regional', icon: '🌪️', name: 'Storm Rider', r: 74, bias: { agi: 10, spd: 6 }, boss: true, hp: 140, special: 'Twister', line: 'BOSS. Spins defenders into the turf.' },
  { id: 'ox', league: 'state', icon: '🐂', name: 'Iron Ox', r: 77, bias: { str: 12, end: 6, spd: -8 }, line: 'Built like a tractor.' },
  { id: 'champ', league: 'state', icon: '⚡', name: 'Track Champion', r: 80, bias: { spd: 10, pow: 6, str: -6 }, line: 'State champ. Owns the 100m.' },
  { id: 'ninja', league: 'state', icon: '🥷', name: 'Agility Ninja', r: 83, bias: { agi: 12, spd: 4, str: -8 }, line: 'You never see the sidestep coming.' },
  { id: 'marathon', league: 'state', icon: '🦌', name: 'Marathon Mo', r: 85, bias: { end: 14, pow: -8 }, line: 'Will still be running when you\'re in bed.' },
  { id: 'titan', league: 'state', icon: '🗿', name: 'The Titan', r: 88, bias: { str: 10, pow: 6, agi: -6 }, boss: true, hp: 160, special: 'Earthquake slam', line: 'BOSS. The ground shakes when it walks.' },
  { id: 'bolt', league: 'national', icon: '🌩️', name: 'Lightning Bolt', r: 90, bias: { spd: 9, pow: 5, end: -6 }, line: 'Already finished. You just haven\'t noticed.' },
  { id: 'mountain', league: 'national', icon: '🏔️', name: 'The Mountain', r: 92, bias: { str: 7, end: 5, agi: -6 }, line: 'You don\'t tackle it. You climb it.' },
  { id: 'phantom', league: 'national', icon: '👻', name: 'The Phantom', r: 94, bias: { agi: 6, spd: 4, str: -4 }, line: 'Here. Gone. Behind you.' },
  { id: 'goat', league: 'national', icon: '🐐', name: 'The GOAT', r: 97, bias: { agi: 2, end: 2 }, boss: true, hp: 180, special: 'Greatest of all time', line: 'FINAL BOSS. Good at everything.' },
  { id: 'sherpa', league: 'summit', icon: '🧗', name: 'Sherpa Sam', r: 96, bias: { end: 8, str: 4, spd: -6 }, line: 'Climbs Everest for a warm-up.' },
  { id: 'avalanche', league: 'summit', icon: '🏂', name: 'Avalanche Ash', r: 97, bias: { spd: 6, agi: 6, str: -6 }, line: 'Comes down the mountain faster than the snow.' },
  { id: 'eaglepk', league: 'summit', icon: '🦅', name: 'Peak Eagle', r: 98, bias: { pow: 6, agi: 4, end: -6 }, line: 'Strikes from above.' },
  { id: 'yeti', league: 'summit', icon: '🦍', name: 'The Yeti', r: 99, bias: { str: 4, end: 4 }, boss: true, hp: 200, special: 'Avalanche', line: 'SECRET BOSS. Nobody has ever got a photo of it.' },
];
const enemyStats = e => Object.fromEntries(STAT_IDS.map(k => [k, Math.max(10, Math.min(99, e.r + (e.bias[k] || 0)))]));

// ---------- training → stats and grit ----------
function workoutGains(w) {
  const t = `${w.title || ''} ${w.notes || ''}`.toLowerCase(), sp = w.sport || '';
  let g;
  if (sp === 'Strength / Gym') g = /power|jump|plyo|push press|clean/.test(t) ? { pow: 3, str: 2 } : /lower|squat|deadlift|lunge/.test(t) ? { str: 3, pow: 1 } : /upper|bench|pull|row/.test(t) ? { str: 3, end: .5 } : { str: 2, pow: 1 };
  else if (sp === 'Speed / Agility') g = /repeat/.test(t) ? { spd: 2, end: 2 } : /change of direction|plyo|bound/.test(t) ? { agi: 3, pow: 2 } : { spd: 3, agi: 2 };
  else if (sp === 'Running') g = /sprint/.test(t) ? { spd: 3, pow: 1 } : /easy|jog|recovery/.test(t) ? { end: 2 } : /interval|tempo|400|600|300|mid/.test(t) ? { end: 3, spd: 1 } : { end: 3 };
  else if (sp === 'Team sport') g = { agi: 2, end: 2, spd: 1 };
  else if (['Cycling', 'Swimming', 'Triathlon', 'Hiking'].includes(sp)) g = { end: 3 };
  else g = { end: 1, agi: 1 };
  const f = Math.min(2, (+w.duration || 30) / 45) * (INTENSITY[w.intensity] || 1);
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v * f]));
}
const isRecovery = w => w.intensity === 'Easy' || /mobility|stretch|recovery|yoga|foam/i.test(`${w.title} ${w.notes || ''}`);
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
function statPoints() {
  const pts = Object.fromEntries(STAT_IDS.map(k => [k, 0]));
  for (const w of doneWorkouts()) for (const [k, v] of Object.entries(workoutGains(w))) pts[k] += v;
  for (const T of TESTS) pts[T.stat] += pbHistory(T.id).list.filter(p => p.pb).length * 4 + (pbHistory(T.id).list.length ? 2 : 0);
  for (const [k, v] of Object.entries(D.arena.extraPts || {})) if (k in pts) pts[k] += v;
  return pts;
}
const rating = p => Math.min(99, Math.round(30 + 5.5 * Math.sqrt(p)));
function athlete() {
  const pts = statPoints(), base = Object.fromEntries(STAT_IDS.map(k => [k, rating(pts[k])]));
  const gear = equippedGear(), bonus = Object.fromEntries(STAT_IDS.map(k => [k, gear.reduce((a, g) => a + (g.bonus[k] || 0), 0)]));
  const total = Object.fromEntries(STAT_IDS.map(k => [k, Math.min(99, base[k] + bonus[k])]));
  const ovr = Math.round(STAT_IDS.reduce((a, k) => a + total[k], 0) / STAT_IDS.length);
  const top = [...STAT_IDS].sort((a, b) => total[b] - total[a])[0];
  const pos = { spd: 'WING', pow: 'FORWARD', str: 'KEY DEFENDER', end: 'RUNNER', agi: 'MIDFIELDER' }[top];
  return { pts, base, bonus, total, ovr, pos };
}

// combo: days in a row with a workout; after 3+ days one rest day keeps it going
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
// freshness: hard training in the last 3 days makes you tired (and weaker in battles)
function freshness() {
  const t = today(), from = addDays(t, -2);
  const load = doneWorkouts().filter(w => w.date >= from).reduce((a, w) => a + ({ Hard: 3, Moderate: 2, Easy: .5 }[w.intensity] || 2) * Math.min(2, (+w.duration || 30) / 45), 0);
  return Math.max(20, Math.min(100, Math.round(100 - load * 9) + ((D.arena.fresh || {})[t] || 0)));
}
const workoutGrit = w => Math.round((10 + Math.min(+w.duration || 30, 90) / 3) * (INTENSITY[w.intensity] || 1));
function gritEarned() {
  let g = 50; // starter grit
  const { byDay } = comboInfo();
  for (const w of doneWorkouts()) {
    const c = typeof byDay[w.date] === 'number' ? byDay[w.date] : 1;
    g += Math.round(workoutGrit(w) * (1 + .1 * Math.min(Math.max(c - 1, 0), 5))) + (isRecovery(w) ? 5 : 0);
  }
  g += Object.values(byDay).filter(v => v === 'rest').length * 15; // a planned rest day after a 3+ day combo
  for (const T of TESTS) { const h = pbHistory(T.id).list; g += (h.length ? 10 : 0) + h.filter(p => p.pb).length * 30; }
  g += Object.values(D.arena.ledger || {}).reduce((a, b) => a + (+b || 0), 0);
  return g;
}
const grit = () => Math.max(0, gritEarned() - (D.arena.spent || 0));

// ---------- gear ----------
const ownsGear = id => !!(D.arena.gear || {})[id];
const equippedGear = () => SLOTS.map(([s]) => GEAR.find(g => g.id === (D.arena.equip || {})[s])).filter(Boolean);
function buyGear(id) {
  const g = GEAR.find(x => x.id === id); if (!g || ownsGear(id) || grit() < g.price) return;
  D.arena.spent += g.price; D.arena.gear[id] = new Date().toISOString(); D.arena.equip[g.slot] = id;
  save(); render(); toast(`${g.icon} ${g.name} unlocked and equipped`, bonusText(g.bonus));
}
const bonusText = b => Object.entries(b).map(([k, v]) => `+${v} ${statInfo(k)[2]}`).join(' ');

// ---------- weekly quests ----------
function questDefs() {
  const wk = mondayOf(today()), end = addDays(wk, 6);
  const ws = doneWorkouts().filter(w => w.date >= wk && w.date <= end);
  const speed = ws.filter(w => w.sport === 'Speed / Agility' || /sprint/i.test(w.title)).length;
  const wins = (D.arena.battles || []).filter(b => b.win && b.at.slice(0, 10) >= wk).length;
  const pbs = TESTS.reduce((a, T) => a + pbHistory(T.id).list.filter(p => p.pb && p.date >= wk).length, 0);
  const pool = [
    { id: 'speed2', text: 'Do 2 speed or sprint sessions', have: speed, need: 2, reward: 50 },
    { id: 'gym3', text: 'Do 3 gym sessions', have: ws.filter(w => w.sport === 'Strength / Gym').length, need: 3, reward: 60 },
    { id: 'days4', text: 'Train on 4 different days', have: new Set(ws.map(w => w.date)).size, need: 4, reward: 60 },
    { id: 'mins200', text: 'Train for 200 minutes', have: ws.reduce((a, w) => a + (+w.duration || 0), 0), need: 200, reward: 50, unit: 'm' },
    { id: 'recover', text: 'Do an easy or recovery session', have: ws.filter(isRecovery).length, need: 1, reward: 30 },
    { id: 'pb', text: 'Set a new personal best', have: pbs, need: 1, reward: 60 },
    { id: 'win2', text: 'Win 2 Arena battles', have: wins, need: 2, reward: 50 },
    { id: 'combo3', text: 'Reach a 3-day training combo', have: comboInfo().combo, need: 3, reward: 40 },
  ];
  const rnd = seeded('quests' + wk);
  return pool.map(q => [rnd(), q]).sort((a, b) => a[0] - b[0]).slice(0, 4).map(([, q]) => ({ ...q, key: `q:${wk}:${q.id}` }));
}
function claimQuest(key) {
  const q = questDefs().find(x => x.key === key);
  if (!q || q.have < q.need || key in D.arena.ledger) return;
  D.arena.ledger[key] = q.reward; save(); render();
}

// ---------- battles ----------
const battlesToday = () => (D.arena.battles || []).filter(b => ymd(new Date(b.at)) === today()).length; // local day, not UTC
const tokensLeft = () => Math.max(0, 2 + Math.min(3, doneWorkouts().filter(w => w.date === today()).length) + ((D.arena.tickets || {})[today()] || 0) - battlesToday());
const beaten = id => (D.arena.battles || []).some(b => b.e === id && b.win);
const unlockedUpTo = () => { let i = 0; while (i < ENEMIES.length - 1 && beaten(ENEMIES[i].id)) i++; return i; };
const leagueOf = e => LEAGUES.find(l => l.id === e.league);
let battle = null;
function battleStats() {
  const a = athlete(), f = .85 + .15 * freshness() / 100;
  return Object.fromEntries(STAT_IDS.map(k => [k, Math.round(a.total[k] * f)]));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function banner(text, cls = '') {
  const el = document.getElementById('bBanner'); if (!el) return;
  el.className = 'bbanner show ' + cls; el.textContent = text;
  clearTimeout(el._t); el._t = setTimeout(() => el.className = 'bbanner', 1300);
}
function fxAt(who, html, cls) {
  const st = document.querySelector('#battlefx .bstage'), f = document.getElementById(who === 'me' ? 'fMe' : 'fThem'); if (!st || !f) return;
  const sr = st.getBoundingClientRect(), r = f.getBoundingClientRect();
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
  d.style.left = (r.left - sr.left + r.width / 2) + 'px'; d.style.top = (r.top - sr.top + r.height * .35) + 'px';
  document.getElementById('bfx').appendChild(d); setTimeout(() => d.remove(), 1400);
}
function burst(who, color) {
  let h = ''; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, r = 50 + Math.random() * 40; h += `<i style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;background:${color}"></i>`; }
  fxAt(who, h, 'burst');
}
async function animateClash(winner, move, dmg, special) {
  const atk = document.getElementById(winner === 'me' ? 'fMe' : 'fThem'), def = document.getElementById(winner === 'me' ? 'fThem' : 'fMe');
  const loser = winner === 'me' ? 'them' : 'me';
  atk.classList.add('atk', 'atk-' + move); if (special) atk.classList.add('special');
  await sleep(380);
  def.classList.add('hit'); burst(loser, statInfo(move)[3]);
  fxAt(loser, `-${dmg}`, 'dmgnum' + (dmg >= 25 ? ' big' : ''));
  if (dmg >= 22) document.querySelector('#battlefx .bstage')?.classList.add('shake');
  hud();
  await sleep(420);
  atk.classList.remove('atk', 'atk-' + move, 'special'); def.classList.remove('hit');
  document.querySelector('#battlefx .bstage')?.classList.remove('shake');
}
// ---------- drawing ----------
function avatarSvg(color = '#5c7cfa', size = 120) {
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="60" cy="34" r="20" fill="#f1c9a5"/><path d="M41 30 Q44 10 62 12 Q80 12 80 30 Q70 22 56 24 Q46 25 41 30Z" fill="#5c3a21"/>
    <path d="M24 118 Q24 70 60 64 Q96 70 96 118Z" fill="${color}"/><path d="M48 66 L60 80 L72 66" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="4"/>
    <text x="60" y="108" text-anchor="middle" font-size="22" font-weight="900" fill="rgba(255,255,255,.9)">${(D.settings.jerseyNo || 11)}</text></svg>`;
}
function athleteCard(a = athlete()) {
  const tier = a.ovr >= 85 ? 'special' : a.ovr >= 70 ? 'gold' : a.ovr >= 55 ? 'silver' : 'bronze';
  const top = equippedGear().find(g => g.slot === 'top');
  return `<div class="acard ${tier}"><div class="acard-top"><div class="aovr"><b>${a.ovr}</b><span>${a.pos}</span></div><div class="aavatar" style="background:${BG_CSS[myAv().bg] || 'transparent'}">${avatarFull(avatarSpec(), { size: 150, cls: 'idle' })}${petHtml(myAv().pet, 34)}</div></div>
    <div class="aname">${esc(D.settings.name || 'Athlete')}</div>
    <div class="astats">${STATS.map(([k, , ab]) => `<div><b>${a.total[k]}</b> ${ab}${a.bonus[k] ? `<i>+${a.bonus[k]}</i>` : ''}</div>`).join('')}<div class="agear">${equippedGear().map(g => `<span title="${esc(g.name)}">${g.icon}</span>`).join('') || '<span class="muted">no gear</span>'}</div></div>
    <div class="atier">${tier === 'special' ? '✨ Special' : tier[0].toUpperCase() + tier.slice(1)} card</div></div>`;
}
function spark(vals, lower) {
  if (vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals), w = 120, h = 34;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(max === min ? h / 2 : lower ? (v - min) / (max - min) * h : h - (v - min) / (max - min) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="-3 -3 ${w + 6} ${h + 6}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const fmtTest = (T, v) => v == null ? '–' : T.time ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : `${+(+v).toFixed(2)} ${T.unit}`;
function parseTest(T, s) {
  s = String(s || '').trim(); if (!s) return null;
  if (T.time) { const m = s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/); return m ? +m[1] * 60 + +m[2] : (isFinite(+s) ? +s * 60 : null); }
  return isFinite(+s) && +s > 0 ? +s : null;
}
function addPb(testId) {
  const T = TESTS.find(x => x.id === testId); if (!T) return;
  const v = parseTest(T, $(`#pbv_${testId}`)?.value), d = $(`#pbd_${testId}`)?.value || today();
  if (v == null) { toast('Enter a result first', T.time ? 'Use minutes:seconds, e.g. 7:45' : `In ${T.unit}`); return; }
  const before = pbHistory(testId).best;
  D.arena.pbs = [...(D.arena.pbs || []), { id: uid(), test: testId, value: v, date: d }];
  save(); render();
  const isPb = before != null && (T.lower ? v < before : v > before);
  if (isPb) celebrate({ icon: '<span class="critbig">🎉</span>', color: '#f59f00', kicker: 'New personal best!', title: `${esc(T.name)}: ${fmtTest(T, v)}`, text: `Beat your old best of ${fmtTest(T, before)}. +30 ${GRIT} and a boost to ${statInfo(T.stat)[1]}.` });
  else toast(before == null ? `📏 ${T.name} baseline saved` : 'Result saved', before == null ? `+10 ${GRIT}. Beat it next time for a PB.` : `Your best is still ${fmtTest(T, before)}.`);
}

// ---------- feedback: stat gains when a workout is ticked off ----------
let lastArena = null;
function arenaFeedback() {
  if (!D || !D.arena) return;
  const a = athlete(), g = grit(), snap = { ...a.total, g };
  if (lastArena) {
    const ups = STAT_IDS.filter(k => a.total[k] > lastArena[k]).map(k => `+${a.total[k] - lastArena[k]} ${statInfo(k)[2]}`);
    const dg = g - lastArena.g;
    if (ups.length || dg > 0) {
      const el = document.createElement('div'); el.className = 'coinpop gritpop';
      el.textContent = [...ups, dg > 0 ? `+${dg} ${GRIT}` : ''].filter(Boolean).join('  ');
      document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
    }
  }
  lastArena = snap;
  const b = document.querySelector('#tabs button[data-view="training"]');
  if (b) b.dataset.badge = questDefs().filter(q => q.have >= q.need && !(q.key in D.arena.ledger)).length || '';
}

// ---------- shop: consumables and swaps ----------
const SHOP_ITEMS = [
  { id: 'drink', icon: '⚡', name: 'Energy drink', text: 'Your athlete starts the next battle with +1 Attack.', grit: 40, boost: true },
  { id: 'charm', icon: '🍀', name: 'Lucky charm', text: 'Your athlete starts the next battle focused: 4× the critical hits.', grit: 45, boost: true },
  { id: 'guard', icon: '🦷', name: 'Mouthguard', text: 'Your athlete starts the next battle with a Reflect: physical hits do half.', grit: 50, boost: true },
  { id: 'ticket', icon: '🎟️', name: 'Battle ticket', text: 'One extra battle today.', grit: 60 },
  { id: 'smoothie', icon: '🥤', name: 'Recovery smoothie', text: '+25% freshness for today.', grit: 50 },
  { id: 'pt', icon: '🧑‍🏫', name: 'Personal trainer', text: '+6 training points on your weakest stat, for good.', grit: 150 },
  { id: 'camp', icon: '⛺', name: 'Training camp', text: '+4 training points on every stat, for good.', grit: 500 },
  { id: 'gearbox', icon: '📦', name: 'Gear crate', text: 'A random piece of gear you don\'t own yet.', grit: 280 },
  { id: 'stylebox', icon: '👚', name: 'Style box', text: 'A random cosmetic you don\'t own yet.', grit: 120 },
  { id: 'parcel', icon: '🎀', name: 'Fashion parcel', text: 'A random cosmetic you don\'t own yet, paid in coins.', coins: 200 },
  { id: 'shake', icon: '🥛', name: 'Study-to-gains shake', text: 'Swap 150 coins for 40 Grit. Once a day.', coins: 150 },
  { id: 'notes', icon: '📒', name: 'Training-to-brains notes', text: 'Swap 60 Grit for 120 coins. Once a day.', grit: 60 },
];
function buyItem(id) {
  const it = SHOP_ITEMS.find(x => x.id === id), t = today(); if (!it) return;
  if (it.grit && grit() < it.grit) { toast('Not enough Grit', ''); return; }
  if (it.coins && coins() < it.coins) { toast('Not enough coins', ''); return; }
  const once = id === 'shake' || id === 'notes';
  if (id === 'gearbox' && !GEAR.some(x => !ownsGear(x.id))) { toast('You own every piece of gear', ''); return; }
  if ((id === 'stylebox' || id === 'parcel') && !COSMETICS.some(c => !ownsCos(c.id) && !c.drop)) { toast('You own every cosmetic', 'Legend.'); return; }
  if (once && (D.arena.swaps || {})[id + ':' + t]) { toast('Already swapped today', 'Come back tomorrow.'); return; }
  if (it.grit) D.arena.spent += it.grit;
  if (it.coins) D.game.spent = (D.game.spent || 0) + it.coins;
  if (it.boost) { D.arena.items = D.arena.items || {}; D.arena.items[id] = (D.arena.items[id] || 0) + 1; }
  if (id === 'ticket') { D.arena.tickets = D.arena.tickets || {}; D.arena.tickets[t] = (D.arena.tickets[t] || 0) + 1; }
  if (id === 'smoothie') { D.arena.fresh = D.arena.fresh || {}; D.arena.fresh[t] = Math.min(60, (D.arena.fresh[t] || 0) + 25); }
  if (id === 'pt' || id === 'camp') {
    D.arena.extraPts = D.arena.extraPts || {};
    const weak = [...STAT_IDS].sort((a, b) => athlete().total[a] - athlete().total[b])[0];
    (id === 'pt' ? [weak] : STAT_IDS).forEach(k => D.arena.extraPts[k] = (D.arena.extraPts[k] || 0) + (id === 'pt' ? 6 : 4));
    if (id === 'pt') { save(); render(); toast(`🧑‍🏫 Extra ${statInfo(weak)[1]} work`, `+6 training points on ${statInfo(weak)[1]}.`); return; }
  }
  if (id === 'gearbox') {
    const pool = GEAR.filter(x => !ownsGear(x.id)), g = pool[Math.floor(Math.random() * pool.length)];
    D.arena.gear[g.id] = new Date().toISOString(); save(); render();
    celebrate({ icon: `<span class="critbig">${g.icon}</span>`, color: '#f76707', kicker: 'Gear crate', title: g.name, text: `${bonusText(g.bonus)}. Equip it in the Locker.` }); return;
  }
  if (id === 'stylebox' || id === 'parcel') {
    const pool = COSMETICS.filter(c => !ownsCos(c.id) && !c.drop), c = pool[Math.floor(Math.random() * pool.length)];
    D.arena.owned = { ...(D.arena.owned || {}), [c.id]: new Date().toISOString() }; save(); render();
    celebrate({ icon: `<span class="critbig">${c.e || '👕'}</span>`, color: '#7048e8', kicker: id === 'parcel' ? 'Fashion parcel' : 'Style box', title: c.name, text: `New ${COS_CATS.find(x => x[0] === c.cat)[1].toLowerCase()}. Wear it from the Wardrobe.` }); return;
  }
  if (once) D.arena.swaps = { ...(D.arena.swaps || {}), [id + ':' + t]: 1 };
  if (id === 'shake') D.arena.ledger['shake:' + t] = 40;
  if (id === 'notes') D.game.ledger['notes:' + t] = 120;
  save(); render(); toast(`${it.icon} ${it.name}`, it.boost ? 'Saved in your bag. Switch it on before a battle.' : 'Done.');
}
function arenaShop(g) {
  const items = D.arena.items || {};
  return `${arenaBoxesCard()}<div class="card"><div class="card-head"><h2>🛒 Shop</h2><span class="pill">${COIN} ${coins()}</span><span class="pill">${GRIT} ${g}</span></div>
    <div class="shopgrid">${SHOP_ITEMS.map(it => {
      const can = it.grit ? g >= it.grit : coins() >= it.coins, used = (D.arena.swaps || {})[it.id + ':' + today()];
      return `<div class="sitem"><div class="sicon">${it.icon}</div><b>${it.name}</b><span class="muted small-text">${it.text}</span>${it.boost && items[it.id] ? `<span class="tag">In your bag: ${items[it.id]}</span>` : ''}
        <button class="btn small ${can && !used ? 'primary' : ''}" data-act="buyItem" data-id="${it.id}" ${can && !used ? '' : 'disabled'}>${used ? 'Done today' : it.grit ? `${it.grit} ${GRIT}` : `${it.coins} ${COIN}`}</button></div>`;
    }).join('')}</div></div>
    <p class="muted small-text">Gear (stat boosts) is in the Locker, and avatar cosmetics are in the Wardrobe.</p>`;
}

// ---------- the Arena page (training and health live in body.js) ----------
function arenaStrip(a = athlete()) {
  const g = grit(), ci = comboInfo(), fr = freshness(), rd = readiness();
  const frCol = fr >= 75 ? '#40c057' : fr >= 50 ? '#fab005' : '#e03131';
  const tier = a.ovr >= 85 ? 'special' : a.ovr >= 70 ? 'gold' : a.ovr >= 55 ? 'silver' : 'bronze';
  return `<div class="ahero ${tier}"><div class="ahero-av" style="background:${BG_CSS[myAv().bg] || 'rgba(255,255,255,.15)'}">${avatarFull(avatarSpec(), { size: 120, cls: 'idle' })}${petHtml(myAv().pet, 26)}</div>
    <div class="ahero-main"><div class="ahero-name"><b>${esc(D.settings.name || 'Athlete')}</b><span class="ahero-ovr">${a.ovr} <small>${a.pos}</small></span></div>
      <div class="ahero-goal">${rd.icon} ${esc(rd.label)} today${rd.hp ? ` · ${rd.hp > 0 ? '+' : ''}${rd.hp}% HP in battles` : ''} <a href="#" data-act="goto" data-v="training" class="ahero-link">from your training &amp; sleep →</a></div>
      <div class="ahero-stats">${STATS.map(([k, , ab, col]) => `<div title="${statInfo(k)[1]}"><span>${ab}</span><div class="sbar"><i style="width:${a.total[k]}%;background:${col}"></i></div><b>${a.total[k]}</b></div>`).join('')}</div></div>
    <div class="ahero-side"><div><span>${GRIT}</span><b>${g}</b><small>Grit</small></div><div><span>${COIN}</span><b>${coins()}</b><small>Coins</small></div>
      <div><span>🔥</span><b>${ci.combo}</b><small>Combo</small></div><div><span style="color:${frCol}">●</span><b>${fr}%</b><small>Fresh</small></div><div><span>⚔️</span><b>${tokensLeft()}</b><small>Battles</small></div></div></div>`;
}
function viewArena() {
  let page = ui.arenaPage || 'battle';
  if (page === 'plan') page = 'battle';
  if (page === 'bests') { ui.bodyPage = 'bests'; view = 'training'; return viewTraining(); }
  const a = athlete(), g = grit(), ci = comboInfo(), fr = freshness();
  const frCol = fr >= 75 ? '#40c057' : fr >= 50 ? '#fab005' : '#e03131';
  const nq = questDefs().filter(q => q.have >= q.need && !(q.key in D.arena.ledger)).length;
  const tab = (v, l) => `<button class="${page === v ? 'on' : ''}" data-act="arenaPage" data-v="${v}">${l}</button>`;
  const tabs = `<div class="seg arenatabs">${tab('battle', '⚔️ Battle')}${tab('athlete', `🏠 Athlete${nq ? ` <span class="dotbadge">${nq}</span>` : ''}`)}${tab('moves', '🥋 Moves & crew')}${tab('locker', '🎒 Locker')}${tab('wardrobe', '👕 Wardrobe')}${tab('shop', '🎁 Boxes & shop')}</div>`;
  const head = pageHead('⚔️ Arena', 'Your stats come from the workouts you tick off', `<button class="btn" data-act="goto" data-v="training">💪 Training &amp; Health</button>`) + arenaStrip(a) + tabs;
  let body;
  if (page === 'battle') body = arenaBattles(a);
  else if (page === 'moves') body = arenaMoves();
  else if (page === 'locker') body = arenaLocker(g);
  else if (page === 'wardrobe') body = arenaWardrobe();
  else if (page === 'shop') body = arenaShop(g);
  else body = arenaHome(a, ci, fr, frCol);
  return head + body;
}
function arenaHome(a, ci, fr, frCol) {
  const recent = doneWorkouts().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
  const quests = questDefs();
  return `<div class="arena-home">
    <div>${athleteCard(a)}<p class="muted small-text" style="text-align:center">Stats grow with every workout you tick off. Gear adds the small <i>+</i> numbers.</p></div>
    <div class="arena-side">
      <div class="grid g2 tight">
        <div class="card mini"><div class="unlabel">Combo</div><div class="bignum">🔥 ${ci.combo}<span>day${ci.combo === 1 ? '' : 's'}</span></div><div class="muted small-text">+10% ${GRIT} per combo day (up to +50%). After 3 days, one rest day keeps it going and pays +15 ${GRIT}. Best: ${ci.best}.</div></div>
        <div class="card mini"><div class="unlabel">Freshness</div><div class="bignum" style="color:${frCol}">${fr}%</div><div class="meter"><i style="width:${fr}%;background:${frCol}"></i></div><div class="muted small-text">${fr >= 75 ? 'Fresh and ready. Battle at full strength.' : fr >= 50 ? 'A bit tired. An easy day or rest helps.' : 'Overcooked! Rest or go easy. You fight weaker when tired.'}</div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Weekly quests</h2><span class="muted small-text">new every Monday</span></div><ul class="chals">${quests.map(q => {
        const done = q.key in D.arena.ledger, ready = q.have >= q.need, pct = Math.min(100, Math.round(q.have / q.need * 100));
        return `<li class="chal ${done ? 'done' : ready ? 'ready' : ''}"><div class="main"><div class="title">${esc(q.text)}</div><div class="ctrack"><i style="width:${pct}%"></i></div><span class="muted small-text">${q.unit === 'm' ? `${fmtMins(Math.min(q.have, q.need)) || '0m'} / ${fmtMins(q.need)}` : `${Math.min(q.have, q.need)} / ${q.need}`}</span></div>
          ${done ? '<span class="tag green">✓ Claimed</span>' : ready ? `<button class="btn small primary" data-act="claimQuest" data-id="${q.key}">Claim ${q.reward} ${GRIT}</button>` : `<span class="reward">${q.reward} ${GRIT}</span>`}</li>`;
      }).join('')}</ul></div>
      <div class="card"><h2>Recent training</h2>${recent.length ? `<ul class="gains">${recent.map(w => `<li><div class="main"><b>${esc(w.title)}</b><span class="muted small-text">${fmtDate(w.date)} · ${fmtMins(+w.duration || 0)} · ${esc(w.intensity || '')}</span></div>
        <span class="gchips">${Object.entries(workoutGains(w)).map(([k, v]) => `<i style="--sc:${statInfo(k)[3]}">${statInfo(k)[2]} +${v.toFixed(1)}</i>`).join('')}</span><span class="reward">+${workoutGrit(w)} ${GRIT}</span></li>`).join('')}</ul>` : '<div class="empty">Tick off a workout in the Plan tab to start building your athlete.</div>'}</div>
    </div></div>`;
}
function arenaBattles(a) {
  const up = unlockedUpTo(), me = battleStats(), items = D.arena.items || {}, boost = ui.boost = ui.boost || {};
  const cur = leagueOf(ENEMIES[up]), sel = LEAGUES.find(l => l.id === ui.arenaSel && ENEMIES.findIndex(e => e.league === l.id) <= up) || cur;
  const boosts = SHOP_ITEMS.filter(x => x.boost);
  return `    <div class="card arenamap"><div class="card-head"><h2>🗺️ Arenas</h2><span class="muted small-text">beat each gym leader to earn its badge and travel on</span><span class="pill">⚔️ ${tokensLeft()} battle${tokensLeft() === 1 ? '' : 's'} left today</span></div>
      <div class="amap">${LEAGUES.map((lg, k) => { const open = ENEMIES.findIndex(e => e.league === lg.id) <= up, boss = ENEMIES.find(e => e.league === lg.id && e.boss), won = boss && beaten(boss.id);
        return `${k ? '<span class="apath"></span>' : ''}<button class="anode ${sel.id === lg.id ? 'on' : ''} ${open ? '' : 'locked'} ${won ? 'won' : ''}" data-act="arenaSel" data-v="${lg.id}" ${open ? '' : 'disabled'} style="--sky:${lg.sky}"><span class="anic">${open ? lg.icon : '🔒'}</span><b>${open ? lg.name : '???'}</b><small>${won ? lg.badge + ' ' + lg.badgeName : open ? `${ENEMIES.filter(e => e.league === lg.id && beaten(e.id)).length}/${ENEMIES.filter(e => e.league === lg.id).length} beaten` : 'Locked'}</small></button>`; }).join('')}</div></div>
    ${[sel].map(lg => `<div class="card league" style="--sky:${lg.sky}"><div class="card-head league-head"><h2>${lg.icon} ${lg.name}</h2><span class="muted small-text">${esc(lg.blurb)}</span></div>
    <div class="ladder">${ENEMIES.map((e, i) => [e, i]).filter(([e]) => e.league === lg.id).map(([e, i]) => {
      const es = enemyStats(e), locked = i > up, won = beaten(e.id);
      return `<div class="rung ${locked ? 'locked' : ''} ${won ? 'won' : ''} ${e.boss ? 'bossrung' : ''}"><div class="rpos">${e.boss ? '👑' : i + 1}</div><div class="renemy">${locked ? '🔒' : e.icon}</div>
        <div class="main"><b>${locked ? (e.boss ? 'Gym leader' : '???') : esc(e.name)}</b> <span class="muted small-text">Lv ${lvOf(e.r)}${e.boss ? ' · gym leader' : ''}</span>${locked ? '' : ` ${typeChips(typesOf(e))}`}${locked ? '<div class="muted small-text">Beat the rival above to unlock.</div>' : `<div class="muted small-text">${esc(e.line)}</div>
          <div class="bstats">${STATS.map(([k, , ab, col]) => `<span style="--sc:${col}" class="${me[k] > es[k] ? 'edge' : ''}">${ab} <b>${es[k]}</b></span>`).join('')}</div>`}</div>
        ${won ? `<span class="tag green">✓ ${e.boss ? lg.badge + ' Badge' : 'Beaten'}</span>` : ''}${locked ? '' : `<button class="btn ${won ? '' : 'primary'}" data-act="fight" data-id="${e.id}">⚔️ Fight</button>`}</div>`;
    }).join('')}</div></div>`).join('')}
${battleModesHtml()}<div class="card"><div class="card-head"><h2>Boosts</h2><span class="muted small-text">switch on before a fight · buy more in the Shop</span></div><div class="row" style="gap:10px">${boosts.map(x => `<label class="boostchip ${items[x.id] ? '' : 'none'}"><input type="checkbox" data-act="boostToggle" data-id="${x.id}" ${boost[x.id] && items[x.id] ? 'checked' : ''} ${items[x.id] ? '' : 'disabled'}> ${x.icon} ${x.name} <b>×${items[x.id] || 0}</b></label>`).join('')}</div></div>
    <p class="muted small-text">2 battles a day, +1 for each workout ticked off today. Highlighted stats are ones where you're already stronger. Freshness ${freshness()}% scales your stats, and rivals bring a bigger team the further you go.</p>`;
}
// records worked out from everything you've logged
function bestRecords() {
  const ws = doneWorkouts(), km = w => parseFloat(String(w.distance || '').replace(',', '.')) || 0;
  const best = (list, f) => list.reduce((b, x) => { const v = f(x); return v > (b?.v || 0) ? { v, x } : b; }, null);
  const byWeek = {}, byDay = {};
  for (const w of ws) { const k = mondayOf(w.date); byWeek[k] = byWeek[k] || { mins: 0, n: 0, km: 0 }; byWeek[k].mins += +w.duration || 0; byWeek[k].n++; byWeek[k].km += km(w); byDay[w.date] = 1; }
  const streak = (days, need = 1) => { let b = 0, run = 0, prev = null; for (const d of Object.keys(days).sort()) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; b = Math.max(b, run); prev = d; } return b; };
  const wk = (f) => Object.entries(byWeek).reduce((b, [k, v]) => f(v) > (b?.v || 0) ? { v: f(v), k } : b, null);
  const runs = ws.filter(w => /run|jog/i.test(w.sport + ' ' + w.title) && km(w) > 0);
  const paced = runs.filter(w => +w.duration > 0 && km(w) >= 1).map(w => ({ w, pace: +w.duration / km(w) }));
  const fastest = paced.sort((a, b) => a.pace - b.pace)[0];
  const H = typeof healthCfg === 'function' ? healthCfg().days : {};
  const hd = Object.entries(H);
  const hbest = (k, low) => hd.filter(([, v]) => v[k]).reduce((b, [d, v]) => (b == null || (low ? v[k] < b.v : v[k] > b.v)) ? { v: v[k], d } : b, null);
  const studyDay = {}; for (const l of D.focusLogs) studyDay[l.date] = (studyDay[l.date] || 0) + l.mins;
  const sd = Object.entries(studyDay).reduce((b, [d, m]) => m > (b?.v || 0) ? { v: m, d } : b, null);
  const longS = best(D.focusLogs, l => l.mins);
  const battles = D.arena.battles || [], wins = battles.filter(b => b.win).length;
  let winRun = 0, run = 0; for (const b of battles) { run = b.win ? run + 1 : 0; winRun = Math.max(winRun, run); }
  const lw = best(ws, w => +w.duration || 0), lr = best(runs, km);
  const totalKm = ws.reduce((a, w) => a + km(w), 0), totalH = ws.reduce((a, w) => a + (+w.duration || 0), 0);
  const ww = wk(v => v.mins), wn = wk(v => v.n), wkm = wk(v => v.km);
  const sl = hbest('sleep'), st = hbest('steps'), rhr = hbest('rhr', true), ss = hbest('score');
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
    ['🌙', 'Health', [
      ['😴', 'Longest sleep', sl ? fmtHm(sl.v) : null, sl && fmtDate(sl.d)],
      ['💯', 'Best sleep score', ss?.v || null, ss && fmtDate(ss.d)],
      ['👟', 'Most steps in a day', st ? st.v.toLocaleString() : null, st && fmtDate(st.d)],
      ['❤️', 'Lowest resting HR', rhr ? `${rhr.v} bpm` : null, rhr && fmtDate(rhr.d)]]],
    ['📚', 'Study & Arena', [
      ['🎯', 'Longest focus session', longS ? fmtMins(longS.v) : null, longS && `${esc(subj(longS.x.subjectId).name)} · ${fmtDate(longS.x.date)}`],
      ['📖', 'Most study in a day', sd ? fmtMins(sd.v) : null, sd && fmtDate(sd.d)],
      ['🔥', 'Longest study streak', typeof bestStreak === 'function' && bestStreak() ? `${bestStreak()} days` : null, '30+ minutes a day'],
      ['⚔️', 'Battle wins', wins || null, winRun ? `best run: ${winRun} in a row` : ''],
      ['🌊', 'Survival best', (D.arena.survivalBest || 0) || null, 'waves cleared']]],
  ];
}
function recordsHtml() {
  return `<div class="card recs"><div class="card-head"><h2>🏆 Your records</h2><span class="muted small-text">worked out from everything you log</span></div>
    ${bestRecords().map(([icon, title, rows]) => `<div class="recgroup"><div class="daygroup">${icon} ${title}</div><div class="recgrid">${rows.map(([ic, label, v, sub]) => `<div class="rec ${v == null ? 'none' : ''}"><span class="recic">${ic}</span><div class="main"><small>${label}</small><b>${v ?? '–'}</b>${sub && v != null ? `<em>${sub}</em>` : ''}</div></div>`).join('')}</div></div>`).join('')}</div>
    <h2 style="margin:18px 0 10px">📈 Fitness tests</h2>`;
}
function arenaBests() {
  return `${recordsHtml()}<div class="pbgrid">${TESTS.map(T => {
    const h = pbHistory(T.id), last = h.list[h.list.length - 1], si = statInfo(T.stat);
    return `<div class="card pbcard" style="--sc:${si[3]}"><div class="card-head"><h2>${esc(T.name)}</h2><span class="tag" style="background:${si[3]}22;color:${si[3]}">${si[2]}</span></div>
      <div class="pbbest">${h.best != null ? fmtTest(T, h.best) : '<span class="muted">No result yet</span>'}</div>
      ${spark(h.list.map(p => p.value), T.lower)}
      <div class="muted small-text">${h.list.length ? `${h.list.length} result${h.list.length === 1 ? '' : 's'} · ${h.list.filter(p => p.pb).length} PB${h.list.filter(p => p.pb).length === 1 ? '' : 's'} · last ${fmtDate(last.date)}` : `${T.lower ? 'Lower' : 'Higher'} is better`}</div>
      <div class="row pbadd"><input id="pbv_${T.id}" type="text" inputmode="decimal" placeholder="${T.time ? 'm:ss' : T.unit}"><input id="pbd_${T.id}" type="date" value="${today()}"><button class="btn small primary" data-act="addPb" data-id="${T.id}">Log</button></div>
      ${h.list.length ? `<details><summary class="small-text">History</summary>${[...h.list].reverse().map(p => `<div class="pbrow"><span>${fmtDate(p.date)}</span><b>${fmtTest(T, p.value)}</b>${p.pb ? '<span class="tag green">PB</span>' : ''}<button class="iconbtn" data-act="delPb" data-id="${p.id}" title="Delete">✕</button></div>`).join('')}</details>` : ''}</div>`;
  }).join('')}</div>`;
}
function arenaLocker(g) {
  return `<div class="card"><h2>Equipped</h2><div class="slots">${SLOTS.map(([s, n]) => { const it = GEAR.find(x => x.id === D.arena.equip[s]); return `<div class="slot"><span class="unlabel">${n}</span><div class="slotitem">${it ? `${it.icon} <b>${esc(it.name)}</b><span class="muted small-text">${bonusText(it.bonus)}</span>` : '<span class="muted">Empty</span>'}</div></div>`; }).join('')}</div></div>
    ${SLOTS.map(([s, n]) => `<div class="card"><h2>${n}</h2><div class="gearrow">${GEAR.filter(x => x.slot === s).map(x => {
      const own = ownsGear(x.id), on = D.arena.equip[s] === x.id;
      return `<div class="gear ${own ? 'own' : ''} ${on ? 'on' : ''}"><div class="gicon">${x.icon}</div><b>${esc(x.name)}</b><span class="gbonus">${bonusText(x.bonus)}</span>
        ${on ? '<span class="tag green">Equipped</span>' : own ? `<button class="btn small" data-act="equip" data-id="${x.id}">Equip</button>` : `<button class="btn small ${g >= x.price ? 'primary' : ''}" data-act="buyGear" data-id="${x.id}" ${g >= x.price ? '' : 'disabled'}>${x.price} ${GRIT}</button>`}</div>`;
    }).join('')}</div></div>`).join('')}
    <div class="card"><h2>Card</h2><div class="row"><label class="small-text">Jersey number <input type="number" min="0" max="99" data-setting="jerseyNo" value="${esc(D.settings.jerseyNo ?? 11)}" style="width:80px"></label></div></div>`;
}
