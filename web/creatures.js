'use strict';
/* 2.23 Arena: you're the trainer now. Your avatar stands at the side and
   cheers while a team of up to 4 creatures fights. You get creatures by
   picking a starter, hatching eggs and catching wild ones. They level up from
   battles and from your workouts, and evolve at set levels or with stones.

   Your trainer has their own stats, counted from the day 2.23 shipped: each
   workout trains the stat that matches its sport, and fitness tests score
   against standards for your age. Trainer stats make your whole team
   stronger, and trainer levels unlock upgrade tiers, the team aura, a fourth
   team slot, evolutions and special team buffs. */

// ---------- the creatures ----------
// base: hp, atk, def, spd, spc · plan: body shape for the 3D model · col: main, accent, belly
const sp = (id, name, icon, types, base, o = {}) => ({ id, name, icon, types, base: { hp: base[0], atk: base[1], def: base[2], spd: base[3], spc: base[4] }, stage: 1, ...o });
const SPECIES = [
  // starters
  sp('emberpup', 'Emberpup', '🐕', ['fire'], [39, 52, 43, 65, 50], { evo: { to: 'blazehound', lv: 16 }, rar: 'starter', plan: 'quad', col: ['#ff7a30', '#ffd43b', '#fff1e0'], f: { ears: 'pointy', tail: 'flame' }, dex: 'Its tail flickers brighter the faster it runs.' }),
  sp('blazehound', 'Blazehound', '🐕', ['fire'], [58, 64, 58, 80, 65], { stage: 2, evo: { to: 'infernowolf', lv: 34 }, plan: 'quad', col: ['#f76707', '#ffd43b', '#fff1e0'], f: { ears: 'pointy', tail: 'flame', mane: 1 }, dex: 'Runs laps around the oval until the grass smokes.' }),
  sp('infernowolf', 'Infernowolf', '🐺', ['fire', 'combat'], [78, 94, 75, 100, 85], { stage: 3, plan: 'quad', col: ['#c92a2a', '#ffa94d', '#2b2b2b'], f: { ears: 'pointy', tail: 'flame', mane: 1, horns: 1 }, dex: 'A wolf of living flame. Never finishes second.' }),
  sp('splashkit', 'Splashkit', '🦦', ['water'], [44, 48, 65, 43, 50], { evo: { to: 'torrentter', lv: 16 }, rar: 'starter', plan: 'quad', col: ['#4dabf7', '#a5d8ff', '#e7f5ff'], f: { ears: 'round', tail: 'paddle' }, dex: 'Loves the pool. Hates leaving it.' }),
  sp('torrentter', 'Torrentter', '🦦', ['water'], [59, 63, 80, 58, 65], { stage: 2, evo: { to: 'tidalord', lv: 34 }, plan: 'quad', col: ['#1c7ed6', '#74c0fc', '#e7f5ff'], f: { ears: 'round', tail: 'paddle', fin: 1 }, dex: 'Swims butterfly faster than you can run.' }),
  sp('tidalord', 'Tidalord', '🌊', ['water', 'frost'], [79, 83, 100, 78, 85], { stage: 3, plan: 'quad', col: ['#1864ab', '#99e9f2', '#e3fafc'], f: { ears: 'round', tail: 'paddle', fin: 1, crown: 1 }, dex: 'Rules the deep end. Ice forms where it swims.' }),
  sp('sproutle', 'Sproutle', '🐢', ['nature'], [45, 49, 49, 45, 65], { evo: { to: 'thornshell', lv: 16 }, rar: 'starter', plan: 'turtle', col: ['#69db7c', '#2b8a3e', '#d3f9d8'], f: { sprout: 1 }, dex: 'The leaf on its back grows when it studies.' }),
  sp('thornshell', 'Thornshell', '🐢', ['nature'], [60, 62, 63, 60, 80], { stage: 2, evo: { to: 'grovetitan', lv: 34 }, plan: 'turtle', col: ['#40c057', '#2b8a3e', '#d3f9d8'], f: { sprout: 2, spikes: 1 }, dex: 'Its shell is covered in sharp thorns.' }),
  sp('grovetitan', 'Grovetitan', '🌳', ['nature', 'earth'], [80, 82, 83, 80, 100], { stage: 3, plan: 'turtle', col: ['#2f9e44', '#5c3a21', '#d3f9d8'], f: { tree: 1, spikes: 1 }, dex: 'A whole forest grows on its back.' }),
  // Local Oval
  sp('buzzlet', 'Buzzlet', '🐝', ['swarm'], [40, 45, 35, 70, 30], { evo: { to: 'hivequeen', lv: 20 }, rar: 'common', reg: 0, plan: 'bug', col: ['#fcc419', '#212529', '#fff3bf'], dex: 'Buzzes around the canteen at lunch.' }),
  sp('hivequeen', 'Hivequeen', '👑', ['swarm', 'toxic'], [65, 80, 60, 90, 60], { stage: 2, plan: 'bug', col: ['#fab005', '#212529', '#fff3bf'], f: { crown: 1 }, dex: 'Commands a swarm of a thousand.' }),
  sp('pebblit', 'Pebblit', '🪨', ['stone'], [40, 60, 80, 20, 30], { evo: { to: 'golemite', lv: 22 }, rar: 'common', reg: 0, plan: 'blob', col: ['#adb5bd', '#868e96', '#dee2e6'], dex: 'Mistaken for a rock. Often sat on.' }),
  sp('golemite', 'Golemite', '🗿', ['stone', 'earth'], [55, 85, 105, 35, 45], { stage: 2, evo: { to: 'monolith', lv: 38 }, plan: 'golem', col: ['#868e96', '#495057', '#ced4da'], dex: 'Rolls downhill to get anywhere.' }),
  sp('monolith', 'Monolith', '🗿', ['stone', 'earth'], [80, 110, 130, 45, 55], { stage: 3, plan: 'golem', col: ['#495057', '#fcc419', '#adb5bd'], f: { runes: 1 }, dex: 'Ancient. Heavy. Unmovable.' }),
  sp('quokkazap', 'Quokkazap', '🐹', ['spark'], [35, 55, 40, 90, 50], { evo: { to: 'voltquokka', stone: 'spark' }, rar: 'common', reg: 0, plan: 'quad', col: ['#ffd43b', '#e67700', '#fff9db'], f: { ears: 'round', tail: 'bolt' }, dex: 'Always smiling. Always charged.' }),
  sp('voltquokka', 'Voltquokka', '⚡', ['spark'], [60, 90, 55, 110, 90], { stage: 2, plan: 'quad', col: ['#fab005', '#f76707', '#fff9db'], f: { ears: 'pointy', tail: 'bolt', mane: 1 }, dex: 'Selfies with it come out over-exposed.' }),
  sp('gustling', 'Gustling', '🐦', ['air', 'normal'], [40, 45, 40, 56, 35], { evo: { to: 'stormhawk', lv: 26 }, rar: 'common', reg: 0, plan: 'bird', col: ['#a5d8ff', '#748ffc', '#fff'], dex: 'Rides the breeze over the footy oval.' }),
  sp('stormhawk', 'Stormhawk', '🦅', ['air', 'spark'], [70, 85, 65, 100, 75], { stage: 2, plan: 'bird', col: ['#364fc7', '#fcc419', '#e7f5ff'], f: { crest: 1 }, dex: 'Thunder follows wherever it flies.' }),
  // Coastal Track
  sp('toxifrog', 'Toxifrog', '🐸', ['toxic', 'water'], [50, 55, 45, 60, 55], { evo: { to: 'venomtoad', lv: 26 }, rar: 'common', reg: 1, plan: 'frog', col: ['#9775fa', '#40c057', '#f3f0ff'], dex: 'Its bright colours say: don\'t lick me.' }),
  sp('venomtoad', 'Venomtoad', '🐸', ['toxic', 'water'], [80, 85, 70, 75, 80], { stage: 2, plan: 'frog', col: ['#7048e8', '#94d82d', '#f3f0ff'], f: { warts: 1 }, dex: 'One croak and the whole beach clears.' }),
  sp('rockroo', 'Rockroo', '🦘', ['combat', 'earth'], [55, 70, 55, 60, 35], { evo: { to: 'boulderoo', lv: 30 }, rar: 'common', reg: 1, plan: 'roo', col: ['#c08a52', '#8a5a2e', '#f4e3cf'], dex: 'Boxes anything that moves.' }),
  sp('boulderoo', 'Boulderoo', '🦘', ['combat', 'earth'], [85, 110, 80, 80, 50], { stage: 2, plan: 'roo', col: ['#8a5a2e', '#c92a2a', '#f4e3cf'], f: { gloves: 1 }, dex: 'Its jab can split a boulder in two.' }),
  // State Stadium
  sp('hootmind', 'Hootmind', '🦉', ['mind', 'air'], [60, 30, 45, 50, 75], { evo: { to: 'oracowl', lv: 32 }, rar: 'common', reg: 2, plan: 'bird', col: ['#b197fc', '#5f3dc4', '#f3f0ff'], f: { tufts: 1, owl: 1 }, dex: 'Stays up all night revising.' }),
  sp('oracowl', 'Oracowl', '🦉', ['mind', 'air'], [90, 45, 70, 75, 120], { stage: 2, plan: 'bird', col: ['#7048e8', '#fcc419', '#f3f0ff'], f: { tufts: 1, owl: 1, glasses: 1 }, dex: 'Knows the answer before you ask.' }),
  sp('shadecat', 'Shadecat', '🐈‍⬛', ['spirit'], [45, 60, 45, 80, 60], { evo: { to: 'phantomcat', stone: 'moon' }, rar: 'rare', reg: 2, plan: 'quad', col: ['#343a40', '#9775fa', '#495057'], f: { ears: 'pointy', tail: 'long', glow: 1 }, dex: 'Only seen out of the corner of your eye.' }),
  sp('phantomcat', 'Phantomcat', '👻', ['spirit', 'mind'], [65, 85, 60, 115, 95], { stage: 2, plan: 'quad', col: ['#212529', '#cc5de8', '#343a40'], f: { ears: 'pointy', tail: 'long', glow: 1, ghost: 1 }, dex: 'Walks through walls to steal your chips.' }),
  // National Arena
  sp('frostkoala', 'Frostkoala', '🐨', ['frost'], [65, 55, 60, 35, 60], { evo: { to: 'blizzkoala', stone: 'ice' }, rar: 'rare', reg: 3, plan: 'roo', col: ['#dee2e6', '#74c0fc', '#f8f9fa'], f: { koala: 1 }, dex: 'Naps in the freezer section.' }),
  sp('blizzkoala', 'Blizzkoala', '🐨', ['frost', 'combat'], [95, 95, 85, 55, 85], { stage: 2, plan: 'roo', col: ['#a5d8ff', '#1971c2', '#f8f9fa'], f: { koala: 1, icy: 1 }, dex: 'Hugs so cold they leave frostbite.' }),
  sp('glimmo', 'Glimmo', '✨', ['mind'], [50, 30, 50, 60, 85], { evo: { to: 'lumidra', lv: 36 }, rar: 'rare', reg: 3, plan: 'blob', col: ['#f783ac', '#fcc419', '#fff0f6'], f: { glow: 1, antenna: 1 }, dex: 'Made of starlight. Nobody knows what it eats.' }),
  sp('lumidra', 'Lumidra', '🌟', ['mind', 'legend'], [80, 60, 80, 90, 125], { stage: 2, plan: 'serpent', col: ['#f06595', '#fcc419', '#fff0f6'], f: { glow: 1, wings: 1 }, dex: 'Lights up the whole stadium at night.' }),
  // Everest Summit
  sp('yetling', 'Yetling', '❄️', ['frost', 'combat'], [70, 80, 60, 40, 40], { evo: { to: 'yetiking', lv: 40 }, rar: 'rare', reg: 4, plan: 'golem', col: ['#f1f3f5', '#74c0fc', '#cfe3f0'], f: { fur: 1 }, dex: 'Leaves huge footprints in the snow.' }),
  sp('yetiking', 'Yetiking', '🦍', ['frost', 'combat'], [110, 125, 90, 60, 60], { stage: 2, plan: 'golem', col: ['#e9ecef', '#1c7ed6', '#cfe3f0'], f: { fur: 1, crown: 1 }, dex: 'The real reason nobody climbs Everest in winter.' }),
  sp('drakelet', 'Drakelet', '🐉', ['legend'], [45, 64, 45, 50, 50], { evo: { to: 'wyrmlord', lv: 45 }, rar: 'legend', reg: 4, plan: 'serpent', col: ['#5f3dc4', '#ffd43b', '#e5dbff'], f: { horns: 1, wings: 1 }, dex: 'Hatches once in a hundred years.' }),
  sp('wyrmlord', 'Wyrmlord', '🐲', ['legend', 'air'], [95, 134, 95, 85, 100], { stage: 2, plan: 'serpent', col: ['#3b2a6b', '#ff922b', '#e5dbff'], f: { horns: 1, wings: 1, big: 1 }, dex: 'Its roar starts avalanches.' }),
  sp('phoenixa', 'Phoenixa', '🔥', ['fire', 'air'], [90, 100, 90, 90, 125], { rar: 'legend', plan: 'bird', col: ['#ff6b00', '#ffd43b', '#fff3bf'], f: { crest: 1, flame: 1 }, dex: 'Rises from the ashes of every loss.' }),
];
const specOf = id => SPECIES.find(s => s.id === id);
const STARTERS = ['emberpup', 'splashkit', 'sproutle'];
const preEvo = id => SPECIES.find(s => s.evo?.to === id);
const lineOf = id => { let s = specOf(id); while (preEvo(s.id)) s = preEvo(s.id); const out = [s]; while (s.evo) { s = specOf(s.evo.to); out.push(s); } return out; };
const STONES = { spark: ['⚡', 'Spark stone'], moon: ['🌙', 'Moon stone'], ice: ['🧊', 'Ice stone'] };

// moves: a creature learns the moves of its types (and a few Normal ones) as it levels
function learnset(id) {
  if (learnset.c[id]) return learnset.c[id];
  const s = specOf(id), lines = lineOf(id).flatMap(x => x.types), types = [...new Set([...s.types, ...lines])];
  const pool = MOVE_BOOK.filter(m => types.includes(m.type) || (m.type === 'normal' && ['quick', 'bite', 'pump', 'focus', 'wind', 'trash', 'dteam', 'sand'].includes(m.id)));
  const out = pool.map(m => [m, m.basic ? 1 : Math.max(1, Math.round((m.need - 33) * 1.25))]).sort((a, b) => a[1] - b[1]);
  // everyone starts with at least two moves
  if (!out.some(([, l]) => l === 1)) out[0][1] = 1;
  if (out.filter(([, l]) => l === 1).length < 2) { const q = out.find(([m]) => m.id === 'quick'); if (q) q[1] = 1; else if (out[1]) out[1][1] = 1; }
  return (learnset.c[id] = out.map(([m, l]) => ({ id: m.id, lv: l })));
}
learnset.c = {};
const knownAt = (id, lv) => learnset(id).filter(x => x.lv <= lv).map(x => x.id);

// ---------- state ----------
function CR() {
  if (D.arena2) return D.arena2;
  // first time on 2.23: trainer stats start today, gear Grit comes back, and the ladder starts over
  const refund = Object.keys(D.arena.gear || {}).reduce((a, id) => a + (GEAR.find(g => g.id === id)?.price || 0), 0);
  if (refund) D.arena.ledger['refund:gear'] = refund;
  D.arena.oldBattles = D.arena.battles || []; D.arena.battles = [];
  D.arena2 = { since: today(), mons: [], team: [], next: 1, stones: {}, held: {}, bands: 3, sbands: 0, buffs: {}, wxp: {}, pbx: {}, xp: 0, refund };
  save();
  return D.arena2;
}
const crReady = () => !!(D.arena2 && D.arena2.mons.length);
const monById = uid => CR().mons.find(m => m.uid === uid);
const XP_AT = lv => lv <= 1 ? 0 : Math.round(Math.pow(lv, 3) * .8);
function newMon(spId, lv = 5, how = 'egg') {
  const C = CR(), uid = 'm' + (C.next++);
  const m = { uid, sp: spId, lv, xp: XP_AT(lv), how, at: today(), train: {}, moves: knownAt(spId, lv).slice(-4), item: null, iv: 8 + Math.floor(Math.random() * 8) };
  C.mons.push(m);
  if (C.team.length < teamSlots()) C.team.push(uid);
  return m;
}
const teamMons = () => CR().team.map(monById).filter(Boolean).slice(0, teamSlots());

// ---------- the trainer ----------
const ageNow = () => clamp(+(D.settings.age || 0) || (+(D.settings.yearLevel || 10) + 5), 10, 40);
// what an average and an elite 16-year-old does (lower is better for times)
const STANDARDS = { s40: [5.9, 5.0], s100: [14, 11.5], s60: [8.8, 7.4], s200: [29, 23.5], s400: [68, 53], agil: [5.3, 4.5], illi: [17.5, 15], vj: [45, 70], bj: [200, 260], tri: [6, 7.8], mb: [6, 10],
  beep: [8, 13], yoyo: [15, 19], tt1k: [240, 175], tt2k: [510, 390], tt3k: [810, 600], tt5k: [1500, 1050], tt10k: [3300, 2280], swim50: [45, 28], sq: [60, 120], bench: [45, 90], dl: [80, 150], pull: [5, 18], push: [20, 50], plank: [75, 240], sit: [25, 40] };
function pbScore(testId, v) {
  const T = TESTS.find(x => x.id === testId), S = STANDARDS[testId]; if (!T || !S) return 50;
  const f = clamp(1 - (16 - ageNow()) * .04, .78, 1.06), [avg, elite] = T.lower ? [S[0] / f, S[1] / f] : [S[0] * f, S[1] * f];
  return clamp(Math.round(50 + (v - avg) / (elite - avg) * 45), 1, 100);
}
const pbBand = s => s >= 90 ? ['Elite', '#e64980'] : s >= 75 ? ['Excellent', '#7048e8'] : s >= 60 ? ['Above average', '#1c7ed6'] : s >= 40 ? ['Average', '#2f9e44'] : ['Building', '#868e96'];
function trainer() {
  const C = CR(), since = C.since, pts = Object.fromEntries(STAT_IDS.map(k => [k, 0]));
  let xp = 0, mins = 0;
  const ws = doneWorkouts().filter(w => w.date >= since);
  for (const w of ws) { for (const [k, v] of Object.entries(workoutGains(w))) pts[k] += v; const m = Math.min(+w.duration || 30, 120); mins += m; xp += Math.round(m * (INTENSITY[w.intensity] || 1) * 1.5); }
  // fitness tests logged since the update, scored for your age
  const tests = [];
  for (const T of TESTS) {
    const list = (D.arena.pbs || []).filter(p => p.test === T.id && p.date >= since);
    if (!list.length) continue;
    const best = list.reduce((b, p) => b == null || (T.lower ? p.value < b : p.value > b) ? p.value : b, null), s = pbScore(T.id, best);
    pts[T.stat] += s / 6; xp += s * 2 + (list.length - 1) * 10; tests.push({ T, best, score: s });
  }
  xp += (D.arena.battles || []).filter(b => b.win).length * 15 + C.mons.filter(m => m.how === 'caught').length * 10 + (C.xp || 0);
  let lv = 1; while (xp >= trainerXpAt(lv + 1) && lv < 50) lv++;
  const st = Object.fromEntries(STAT_IDS.map(k => [k, rating(pts[k])]));
  return { lv, xp, st, pts, tests, mins, n: ws.length, next: trainerXpAt(lv + 1), cur: trainerXpAt(lv) };
}
const trainerXpAt = lv => lv <= 1 ? 0 : Math.round(60 * Math.pow(lv - 1, 1.6));
const trainerLv = () => trainer().lv;
const upgTier = (lv = trainerLv()) => Math.min(5, 1 + Math.floor(lv / 5));
const teamSlots = (lv = D.arena2 ? trainerLv() : 1) => lv >= 4 ? 4 : 3;
const teamAura = (lv = trainerLv()) => Math.max(0, Math.min(20, lv - 4)); // % on every stat
const evoAllowed = (stage, lv = trainerLv()) => stage <= 1 ? lv >= 3 : lv >= 10;
const stoneAllowed = (lv = trainerLv()) => lv >= 6;
// special team buffs that switch on at trainer levels
const TEAM_PERKS = [
  { lv: 8, id: 'pep', icon: '📣', name: 'Pep talk', text: 'Your first creature starts every battle with +1 Speed.' },
  { lv: 12, id: 'wind', icon: '🫁', name: 'Second wind', text: 'Creatures heal 8% of their HP when they come in.' },
  { lv: 16, id: 'crowd', icon: '🙌', name: 'Crowd favourite', text: 'Critical hits are 1.5× as likely for your team.' },
  { lv: 20, id: 'never', icon: '💥', name: 'Never give up', text: 'Once a battle, a creature hangs on with 1 HP instead of fainting.' },
];
const perkOn = id => { const p = TEAM_PERKS.find(x => x.id === id); return !!p && trainerLv() >= p.lv; };
// trainer stats feed the matching creature stat
const TRAINER_FEEDS = { hp: 'end', atk: 'pow', def: 'str', spd: 'spd', spc: 'agi' };

// ---------- upgrades ----------
const HELD = [
  { id: 'h_band', icon: '🎗️', name: 'Power band', text: '+10% Attack.', coins: 120, tier: 1, mul: { atk: 1.1 } },
  { id: 'h_shell', icon: '🐚', name: 'Iron shell', text: '+10% Defence.', coins: 120, tier: 1, mul: { def: 1.1 } },
  { id: 'h_shoes', icon: '👟', name: 'Swift shoes', text: '+10% Speed.', grit: 120, tier: 1, mul: { spd: 1.1 } },
  { id: 'h_book', icon: '📘', name: 'Study notes', text: '+10% Skill.', coins: 150, tier: 2, mul: { spc: 1.1 } },
  { id: 'h_charm', icon: '🔆', name: 'Type charm', text: 'Moves that match its first type do 20% more.', coins: 200, tier: 2 },
  { id: 'h_lens', icon: '🔍', name: 'Scope lens', text: 'Critical hits twice as likely.', grit: 160, tier: 2 },
  { id: 'h_snack', icon: '🥪', name: 'Snack pack', text: 'Heals 1/16 of its HP every turn.', grit: 220, tier: 3 },
  { id: 'h_sash', icon: '🎽', name: 'Never-quit headband', text: 'At full HP, it survives a knockout hit with 1 HP (once).', grit: 260, tier: 3 },
];
const heldOf = id => HELD.find(h => h.id === id);
const TEAM_BUFFS = [
  { id: 'drills', icon: '🏋️', name: 'Team drills', text: '+3% to every stat, per level.', max: 5, cost: l => ({ grit: 150 * l }) },
  { id: 'spirit', icon: '💖', name: 'Team spirit', text: '+5% HP, per level.', max: 5, cost: l => ({ coins: 150 * l }) },
];
const buffLv = id => (CR().buffs || {})[id] || 0;
// stat training: +4 base points per level. Body stats cost Grit, Skill and Speed cost coins.
const TRAIN_COST = { hp: 'grit', atk: 'grit', def: 'grit', spd: 'coins', spc: 'coins' };
const trainCost = lv => 25 + lv * 25;
const trainCap = () => upgTier() * 2;
const EGGS = [
  { id: 'common', icon: '🥚', name: 'Common egg', coins: 120, grit: 40, lv: 1, text: 'A creature from the arenas you\'ve reached.' },
  { id: 'rare', icon: '🪺', name: 'Rare egg', coins: 350, grit: 120, lv: 5, text: 'A rare creature, or one of the other starters.' },
  { id: 'legend', icon: '🌟', name: 'Legend egg', coins: 900, grit: 350, lv: 12, text: 'Drakelet or Phoenixa. Extremely rare.' },
];

// ---------- creatures in battle ----------
function crStats(m, trainerInfo) {
  const s = specOf(m.sp), T = trainerInfo || trainer(), aura = teamAura(T.lv) / 100, drills = buffLv('drills') * .03, spirit = buffLv('spirit') * .05;
  const base = Object.fromEntries(Object.entries(s.base).map(([k, v]) => [k, v + 4 * ((m.train || {})[k] || 0)]));
  const mon = mkMon({ key: 'u:' + m.uid, uid: m.uid, sp: s.id, name: m.nick || s.name, icon: s.icon, types: s.types, lv: m.lv, base, dv: m.iv || 10, sx: clamp(10 + T.lv * 2, 10, 63), moves: m.moves.map(moveById).filter(Boolean) });
  const held = heldOf(m.item);
  for (const k of ['hp', 'atk', 'def', 'spd', 'spc']) {
    const fromTrainer = (T.st[TRAINER_FEEDS[k]] - 30) / 300;
    mon.st[k] = Math.round(mon.st[k] * (1 + aura + drills + Math.max(0, fromTrainer) + (k === 'hp' ? spirit : 0)) * (held?.mul?.[k] || 1));
  }
  mon.hp = mon.st.hp; mon.held = m.item || null;
  return mon;
}
function myTeamMons() {
  const T = trainer();
  const out = teamMons().map(m => crStats(m, T));
  out.forEach(m => { if (perkOn('crowd')) m.crowd = 1; if (perkOn('never')) m.never = 1; });
  return out;
}
// a wild or rival creature
function wildMon(spId, lv, o = {}) {
  const s = specOf(spId), r = rng(hashStr(spId + lv + (o.seed || '')));
  const m = mkMon({ key: 'w:' + spId + (o.seed || '') + lv, sp: spId, name: o.name || s.name, icon: s.icon, types: s.types, lv, base: s.base, dv: o.boss ? 15 : 4 + Math.floor(r() * 10), sx: (o.boss ? 40 : 6) + Math.min(50, lv), moves: knownAt(spId, lv).slice(-4).map(moveById), hpMul: o.hpMul, boss: o.boss, giant: o.giant });
  return m;
}
// what each rival trainer brings
const TRAINER_TEAMS = {
  couch: ['pebblit'], turtle: ['sproutle', 'pebblit'], sprinter: ['quokkazap', 'gustling'], gymbro: ['rockroo', 'pebblit'], coach: ['buzzlet', 'golemite', 'blazehound'],
  wall: ['golemite', 'thornshell'], cheetah: ['shadecat', 'quokkazap'], roo: ['rockroo', 'gustling'], croc: ['toxifrog', 'torrentter'], storm: ['gustling', 'voltquokka', 'torrentter', 'stormhawk'],
  ox: ['golemite', 'boulderoo'], champ: ['blazehound', 'voltquokka'], ninja: ['shadecat', 'phantomcat'], marathon: ['thornshell', 'venomtoad', 'hootmind'], titan: ['golemite', 'grovetitan', 'boulderoo', 'monolith'],
  bolt: ['stormhawk', 'voltquokka', 'quokkazap'], mountain: ['blizzkoala', 'monolith'], phantom: ['glimmo', 'phantomcat', 'venomtoad'], goat: ['tidalord', 'grovetitan', 'lumidra', 'infernowolf'],
  sherpa: ['yetling', 'blizzkoala', 'golemite'], avalanche: ['frostkoala', 'stormhawk', 'yetling'], eaglepk: ['oracowl', 'stormhawk', 'phoenixa'], yeti: ['blizzkoala', 'phantomcat', 'wyrmlord', 'yetiking'],
};
const LEAGUE_LV = [6, 16, 28, 40, 52];
function trainerLevelOf(e) {
  const t = tierOf(e), list = ENEMIES.filter(x => x.league === e.league), pos = Math.max(0, list.indexOf(e));
  return LEAGUE_LV[t] + pos * 2 + (e.boss ? 3 : 0);
}
const regionPool = t => SPECIES.filter(s => s.reg === t && s.stage === 1 && s.rar !== 'legend');
function rivalCreatures(e, mode) {
  const t = Math.min(4, tierOf(e)), r = rng(hashStr('team' + e.id + (mode === 'daily' ? today() : '') + (mode === 'survival' ? battle?.wave + ':' + battle?.seed : '')));
  let list = TRAINER_TEAMS[e.id] || TRAINER_TEAMS[e.base];
  let lv = mode === 'ladder' ? trainerLevelOf(e) : Math.max(5, Math.round(teamMons().reduce((a, m) => a + m.lv, 0) / Math.max(1, teamMons().length)) + (mode === 'wander' ? 3 : mode === 'daily' ? 2 : 0));
  if (mode === 'survival') lv = Math.max(5, lv - 6 + battle.wave * 2);
  const n = mode === 'survival' ? 1 + (battle?.wave >= 4 ? 1 : 0) + (battle?.wave >= 8 ? 1 : 0) : mode === 'wander' ? 3 : mode === 'daily' ? 3 : (list || []).length || 2;
  if (!list || mode !== 'ladder') { const pool = SPECIES.filter(s => s.rar !== 'legend' && (s.reg ?? 9) <= Math.max(t, 1) + 1); list = Array.from({ length: n }, () => pool[Math.floor(r() * pool.length)].id); }
  // evolve what they bring to fit their level
  list = list.slice(0, n).map(id => { let s = specOf(id); while (s.evo && s.evo.lv && lv >= s.evo.lv) s = specOf(s.evo.to); return s.id; });
  return list.map((id, k) => wildMon(id, Math.max(3, lv - (list.length - 1 - k) * 2), { seed: e.id + k, boss: e.boss && k === list.length - 1, hpMul: e.mod?.id === 'tank' && k === list.length - 1 ? 1.4 : 1 }));
}
// giant boss creatures: one in each arena, huge and tough, and they can't be caught
const GIANTS = [
  { id: 'g_hive', sp: 'hivequeen', lv: 14, league: 'local', name: 'Giant Hivequeen' },
  { id: 'g_toad', sp: 'venomtoad', lv: 27, league: 'regional', name: 'Giant Venomtoad' },
  { id: 'g_roo', sp: 'boulderoo', lv: 39, league: 'state', name: 'Giant Boulderoo' },
  { id: 'g_koala', sp: 'blizzkoala', lv: 50, league: 'national', name: 'Giant Blizzkoala' },
  { id: 'g_wyrm', sp: 'wyrmlord', lv: 62, league: 'summit', name: 'Giant Wyrmlord' },
];
const GIANT_DROPS = { g_hive: ['stone', 'spark'], g_toad: ['held', 'h_charm'], g_roo: ['stone', 'moon'], g_koala: ['stone', 'ice'], g_wyrm: ['egg', 'legend'] };

// ---------- after a battle ----------
const baseExp = s => 40 + s.stage * 35 + (s.rar === 'legend' ? 60 : 0);
function giveXp(m, xp, notes) {
  const s = specOf(m.sp), before = m.lv;
  m.xp += Math.round(xp);
  while (m.lv < 100 && m.xp >= XP_AT(m.lv + 1)) {
    m.lv++;
    for (const id of learnset(m.sp).filter(x => x.lv === m.lv).map(x => x.id)) {
      if (m.moves.includes(id)) continue;
      if (m.moves.length < 4) m.moves.push(id); else (m.newMoves = m.newMoves || []).includes(id) || m.newMoves.push(id);
      notes?.push(`${s.icon} ${m.nick || s.name} can learn ${moveById(id).name}`);
    }
  }
  if (m.lv > before) notes?.push(`⬆️ ${m.nick || specOf(m.sp).name} grew to Lv ${m.lv}`);
  return m.lv > before;
}
// creatures ready to evolve (by level, if your trainer level allows it)
function canEvolve(m) {
  const s = specOf(m.sp); if (!s.evo) return null;
  if (s.evo.lv) { if (m.lv < s.evo.lv) return { why: `Lv ${s.evo.lv}` }; if (!evoAllowed(s.stage)) return { why: `Trainer Lv ${s.stage <= 1 ? 3 : 10}` }; return { ok: true }; }
  if (!stoneAllowed()) return { why: 'Trainer Lv 6' };
  if (!(CR().stones[s.evo.stone] > 0)) return { why: `${STONES[s.evo.stone][1]}` };
  return { ok: true, stone: s.evo.stone };
}
function evolve(uid) {
  const m = monById(uid), s = specOf(m?.sp), c = m && canEvolve(m); if (!c?.ok) return;
  if (c.stone) CR().stones[c.stone]--;
  const to = specOf(s.evo.to), oldName = m.nick || s.name; m.sp = to.id;
  for (const id of knownAt(to.id, m.lv)) if (!m.moves.includes(id) && m.moves.length < 4) m.moves.push(id);
  save(); render();
  crCelebrate(to, 'Evolution!', `${oldName} evolved into ${to.name}!`);
}
// a growth crystal evolves a level-based creature up to 5 levels early
function useCrystal(uid) {
  const m = monById(uid), s = specOf(m?.sp); if (!m || !s.evo?.lv) return;
  if ((CR().crystals || 0) < 1) return toast('No growth crystals', 'Buy one in the shop.');
  if (m.lv < s.evo.lv - 5) return toast('Too young', `It needs to be Lv ${s.evo.lv - 5} or higher.`);
  if (!evoAllowed(s.stage)) return toast('Not yet', `Evolving needs trainer Lv ${s.stage <= 1 ? 3 : 10}.`);
  CR().crystals--; const to = specOf(s.evo.to), oldName = m.nick || s.name; m.sp = to.id;
  save(); render(); crCelebrate(to, 'Evolution!', `${oldName} evolved into ${to.name}!`);
}
function crCelebrate(s, kicker, text) {
  celebrate({ icon: `<span class="critbig">${s.icon}</span>`, color: TYPES[s.types[0]][2], kicker, title: s.name, text });
}
// called by finishBattle
function crAfterBattle(B, win) {
  const notes = [], C = CR();
  const used = B.sides.me.team.filter(m => m.used && m.uid);
  const foes = B.sides.them.team.filter(m => m.hp <= 0 || win);
  let xp = foes.reduce((a, f) => a + baseExp(specOf(f.sp) || { stage: 1 }) * f.lv / 7 * (B.mode === 'wild' ? 1 : 1.5), 0);
  if (!win) xp *= .25;
  for (const bm of used) { const m = monById(bm.uid); if (m) giveXp(m, xp / Math.max(1, used.length * .7), notes); }
  if (win && B.mode === 'giant' && B.e.drop) {
    const [k, v] = B.e.drop, first = !(C.giants || {})[B.e.id];
    C.giants = { ...(C.giants || {}), [B.e.id]: today() };
    if (first) {
      if (k === 'stone') { C.stones[v] = (C.stones[v] || 0) + 1; notes.push(`${STONES[v][0]} ${STONES[v][1]}`); }
      if (k === 'held') { C.held[v] = (C.held[v] || 0) + 1; notes.push(`${heldOf(v).icon} ${heldOf(v).name}`); }
      if (k === 'egg') { const m = hatch('legend', true); notes.push(`🌟 ${specOf(m.sp).name} hatched from a Legend egg`); }
    } else { C.crystals = (C.crystals || 0) + 1; notes.push('💎 Growth crystal'); }
  }
  if (win && B.mode !== 'wild' && Math.random() < .3) { C.bands = (C.bands || 0) + 1; notes.push('🎯 Catch band'); }
  return notes;
}

// ---------- catching ----------
function catchChance(m, superBand) {
  const s = specOf(m.sp), hpPart = 1 - .75 * m.hp / m.st.hp, st = m.status === 'slp' || m.status === 'frz' ? 2 : m.status ? 1.5 : 1;
  const rar = s.rar === 'legend' ? .15 : s.rar === 'rare' ? .5 : 1, stage = s.stage === 1 ? 1 : .6;
  return clamp(hpPart * st * rar * stage * (superBand ? 1.8 : 1) * .7, .03, .95);
}
async function throwBand(superBand) {
  const B = battle, C = CR(), foe = cur('them');
  const key = superBand ? 'sbands' : 'bands'; if (!(C[key] > 0)) return;
  C[key]--; save();
  await say(`You throw a ${superBand ? '💫 Super band' : '🎯 Catch band'} at ${foe.name}!`, 900);
  await play('them', 'catch', { phase: 'throw' });
  const p = catchChance(foe, superBand), shakes = Math.random() < p ? 3 : Math.floor(Math.random() * 3);
  for (let k = 0; k < shakes; k++) { await play('them', 'catch', { phase: 'shake', k }); await say(['Wobble…', 'Wobble… wobble…', 'Wobble… wobble… wobble…'][k], 700); }
  if (shakes === 3) {
    await play('them', 'catch', { phase: 'done' });
    const m = newMon(foe.sp, foe.lv, 'caught'); m.moves = foe.moves.map(x => x.id).slice(0, 4);
    B.caught = m; banner(`${foe.name.toUpperCase()} CAUGHT!`, 'win');
    await say(`Gotcha! ${foe.name} was caught!${CR().team.includes(m.uid) ? ' It joins your team.' : ' It went to your box.'}`);
    await endBattle(true); return true;
  }
  await play('them', 'catch', { phase: 'break' });
  await say(['Oh no! It broke free!', 'Argh! Almost had it!', 'So close!'][Math.min(2, shakes)]);
  return false;
}

// ---------- eggs ----------
function hatch(kind, free) {
  const C = CR(), reached = Math.max(0, tierOf(ENEMIES[unlockedUpTo()]));
  let pool;
  if (kind === 'legend') pool = SPECIES.filter(s => s.rar === 'legend' && s.stage === 1);
  else if (kind === 'rare') pool = SPECIES.filter(s => s.stage === 1 && (s.rar === 'rare' || (s.rar === 'starter' && s.id !== C.starter)));
  else pool = SPECIES.filter(s => s.stage === 1 && s.rar === 'common' && s.reg <= reached + 1);
  const s = pool[Math.floor(Math.random() * pool.length)];
  return newMon(s.id, kind === 'legend' ? 10 : 5, free ? 'gift' : 'egg');
}
function buyEgg(kind) {
  const E = EGGS.find(x => x.id === kind); if (!E) return;
  if (trainerLv() < E.lv) return toast('Not yet', `${E.name}s need trainer Lv ${E.lv}.`);
  if (coins() < E.coins || grit() < E.grit) return toast('Not enough', `${E.name} costs ${E.coins} ${COIN} and ${E.grit} ${GRIT}.`);
  D.game.spent = (D.game.spent || 0) + E.coins; D.arena.spent += E.grit;
  const m = hatch(kind); save();
  eggFx(E, specOf(m.sp));
}
function eggFx(E, s) {
  const ov = document.createElement('div'); ov.className = 'eggfx';
  ov.innerHTML = `<div class="eggstage"><div class="egg">${E.icon}</div><div class="hatched" style="--c:${TYPES[s.types[0]][2]}"><span>${s.icon}</span><b>${esc(s.name)}</b><div>${typeChips(s.types)}</div><small>${esc(s.dex || '')}</small><button class="btn primary" data-cr="eggok">Nice!</button></div></div>`;
  document.body.appendChild(ov);
  if (typeof sfx === 'function') try { sfx('box'); } catch { }
  setTimeout(() => ov.classList.add('crack'), 1500); setTimeout(() => ov.classList.add('open'), 2300);
  ov.addEventListener('click', e => { if (e.target.closest('[data-cr="eggok"]') || ov.classList.contains('open') && e.target === ov) { ov.remove(); render(); } });
}

// ---------- buying things ----------
function pay(c) {
  if (c.coins && coins() < c.coins) { toast('Not enough coins', `It costs ${c.coins} ${COIN}. Study to earn more.`); return false; }
  if (c.grit && grit() < c.grit) { toast('Not enough Grit', `It costs ${c.grit} ${GRIT}. Train to earn more.`); return false; }
  if (c.coins) D.game.spent = (D.game.spent || 0) + c.coins;
  if (c.grit) D.arena.spent += c.grit;
  return true;
}
const costTxt = c => [c.coins && `${c.coins} ${COIN}`, c.grit && `${c.grit} ${GRIT}`].filter(Boolean).join(' + ');
const canPay = c => (!c.coins || coins() >= c.coins) && (!c.grit || grit() >= c.grit);
const SHOP2 = [
  { id: 'bands', icon: '🎯', name: '3 Catch bands', text: 'Throw one at a weak wild creature to catch it.', coins: 60, give: C => { C.bands = (C.bands || 0) + 3; } },
  { id: 'sbands', icon: '💫', name: '3 Super bands', text: 'Nearly twice as likely to catch.', coins: 150, lv: 6, give: C => { C.sbands = (C.sbands || 0) + 3; } },
  { id: 'crystal', icon: '💎', name: 'Growth crystal', text: 'Evolves a creature up to 5 levels before it would.', grit: 300, lv: 3, give: C => { C.crystals = (C.crystals || 0) + 1; } },
  ...Object.entries(STONES).map(([k, [ic, n]]) => ({ id: 'st_' + k, icon: ic, name: n, text: `Evolves ${SPECIES.filter(s => s.evo?.stone === k).map(s => s.name).join(', ')}.`, coins: 300, lv: 6, give: C => { C.stones[k] = (C.stones[k] || 0) + 1; } })),
  { id: 'candy', icon: '🍬', name: 'Rare candy', text: 'One level for one creature.', coins: 180, grit: 60, lv: 5, give: C => { C.candy = (C.candy || 0) + 1; } },
];
function buyShop2(id) {
  const it = SHOP2.find(x => x.id === id); if (!it) return;
  if (it.lv && trainerLv() < it.lv) return toast('Not yet', `Needs trainer Lv ${it.lv}.`);
  if (!pay(it)) return;
  it.give(CR()); save(); render(); toast(`${it.icon} ${it.name}`, 'Added to your bag.');
}
function buyHeld(id) {
  const h = heldOf(id); if (!h) return;
  if (upgTier() < h.tier) return toast('Not yet', `Tier ${h.tier} items need trainer Lv ${(h.tier - 1) * 5}.`);
  if (!pay(h)) return;
  CR().held[id] = (CR().held[id] || 0) + 1; save(); render(); toast(`${h.icon} ${h.name}`, 'Give it to a creature on the Team page.');
}
function buyBuff(id) {
  const b = TEAM_BUFFS.find(x => x.id === id), l = buffLv(id); if (!b || l >= b.max) return;
  if (l + 1 > upgTier()) return toast('Not yet', `Level ${l + 1} needs trainer Lv ${l * 5}.`);
  if (!pay(b.cost(l + 1))) return;
  CR().buffs[id] = l + 1; save(); render(); toast(`${b.icon} ${b.name} level ${l + 1}`, b.text);
}
function trainStat(uid, k) {
  const m = monById(uid), l = (m?.train || {})[k] || 0; if (!m) return;
  if (l >= trainCap()) return toast('Training maxed for now', `Your trainer level allows ${trainCap()} levels a stat. Level up to train more.`);
  const c = { [TRAIN_COST[k]]: trainCost(l) }; if (!pay(c)) return;
  m.train = { ...(m.train || {}), [k]: l + 1 }; save(); render();
}
function giveHeld(uid, id) {
  const m = monById(uid), C = CR(); if (!m) return;
  if (m.item) C.held[m.item] = (C.held[m.item] || 0) + 1;
  m.item = null;
  if (id && C.held[id] > 0) { C.held[id]--; m.item = id; }
  save(); render();
}
function teachMove(uid, id) {
  const m = monById(uid), mv0 = moveById(id); if (!m || !mv0) return;
  if (m.moves.includes(id)) { if (m.moves.length > 1) m.moves = m.moves.filter(x => x !== id); save(); render(); return; }
  const learned = knownAt(m.sp, m.lv).includes(id) || (m.extra || []).includes(id);
  if (!learned) {
    const free = ownsMove(mv0), c = free ? {} : { coins: Math.round(mv0.price * .8) || 50 };
    const tierNeed = mv0.pow >= 110 ? 4 : mv0.pow >= 90 ? 3 : mv0.need >= 50 ? 2 : 1;
    if (upgTier() < tierNeed) return toast('Not yet', `Teaching ${mv0.name} needs upgrade tier ${tierNeed} (trainer Lv ${(tierNeed - 1) * 5}).`);
    if (!free && !confirm(`Teach ${mv0.name} for ${costTxt(c)}?`)) return;
    if (!free && !pay(c)) return;
    m.extra = [...(m.extra || []), id];
  }
  if (m.moves.length >= 4) return toast('Four moves already', 'Take one out first.'), save(), render();
  m.moves.push(id); m.newMoves = (m.newMoves || []).filter(x => x !== id); save(); render();
}
const tutorable = m => { const s = specOf(m.sp); return MOVE_BOOK.filter(x => s.types.includes(x.type) || x.type === 'normal'); };
function useCandy(uid) { const m = monById(uid), C = CR(); if (!m || !(C.candy > 0)) return; C.candy--; const notes = []; giveXp(m, XP_AT(m.lv + 1) - m.xp, notes); save(); render(); toast(`🍬 ${m.nick || specOf(m.sp).name} is Lv ${m.lv}`, notes.slice(1).join(' · ')); }

// team XP from workouts: every workout ticked off since the update trains the team, once
function crWorkoutXp() {
  if (!D.arena2) return;
  const C = CR(), team = teamMons(); if (!team.length) return;
  const fresh = doneWorkouts().filter(w => w.date >= C.since && !C.wxp[w.id]);
  if (!fresh.length) return;
  const notes = [];
  for (const w of fresh) {
    C.wxp[w.id] = 1;
    const mins = Math.min(+w.duration || 30, 120), f = INTENSITY[w.intensity] || 1;
    for (const m of team) giveXp(m, mins * f * 3 * Math.pow(1 + m.lv / 10, 2), notes);
  }
  save();
  toast(`🐾 Your team trained with you`, notes.filter(n => n.startsWith('⬆️')).join(' · ') || `${team.map(m => specOf(m.sp).icon).join(' ')} got XP from ${fresh.length} workout${fresh.length === 1 ? '' : 's'}.`);
}

// ---------- pages ----------
const crBadge = (s, size = 44) => `<span class="crbadge" style="--c:${TYPES[s.types[0]][2]};--c2:${TYPES[s.types[1] || s.types[0]][2]};width:${size}px;height:${size}px;font-size:${size * .55}px">${s.icon}</span>`;
function starterPicker() {
  return `<div class="card starterpick"><h2>Choose your first creature</h2><p class="muted">You're a trainer now. Your avatar cheers from the side while your creatures battle. Pick a partner to start. You can hatch and catch more later.</p>
    <div class="starters">${STARTERS.map(id => { const s = specOf(id), last = lineOf(id).at(-1);
      return `<button class="startercard" data-cr="starter" data-id="${id}" style="--c:${TYPES[s.types[0]][2]}"><div class="c3slot" data-c3="${id}">${crBadge(s, 110)}</div><b>${s.name}</b><div>${typeChips(s.types)}</div><small class="muted">${esc(s.dex)}</small><small>Evolves at Lv 16 and 34 into ${last.name}</small></button>`; }).join('')}</div>
    <p class="muted small-text">Your trainer stats start fresh today${D.arena.ledger['refund:gear'] ? `, and the ${D.arena.ledger['refund:gear']} ${GRIT} you spent on gear is back in your pocket` : ''}. The ladder starts over with new rival trainers.</p></div>`;
}
function monCard(m, on) {
  const s = specOf(m.sp), ce = canEvolve(m), nx = XP_AT(m.lv + 1), pc = Math.round((m.xp - XP_AT(m.lv)) / Math.max(1, nx - XP_AT(m.lv)) * 100);
  return `<button class="moncard ${on ? 'on' : ''} ${ui.crSel === m.uid ? 'sel' : ''}" data-cr="sel" data-id="${m.uid}">${crBadge(s, 52)}<div class="main"><b>${esc(m.nick || s.name)}</b> <small>Lv ${m.lv}</small><div>${typeChips(s.types)}</div>
    <div class="xpbar"><i style="width:${pc}%"></i></div></div>${ce?.ok ? '<span class="tag green">Can evolve!</span>' : m.newMoves?.length ? '<span class="tag">New move</span>' : m.item ? `<span title="${esc(heldOf(m.item)?.name)}">${heldOf(m.item)?.icon}</span>` : ''}</button>`;
}
function arenaTeam() {
  const C = CR();
  if (!C.mons.length) return starterPicker();
  const team = teamMons(), box = C.mons.filter(m => !C.team.includes(m.uid)), slots = teamSlots();
  const sel = monById(ui.crSel) || team[0] || C.mons[0]; ui.crSel = sel.uid;
  return `<div class="crwrap"><div class="stack">
      <div class="card"><div class="card-head"><h2>🐾 Team</h2><span class="muted small-text">${team.length}/${slots} · ${slots < 4 ? 'a 4th slot opens at trainer Lv 4' : 'the first one leads'}</span></div>
        <div class="monlist">${team.map(m => monCard(m, true)).join('')}${Array.from({ length: slots - team.length }, () => '<div class="moncard empty">Empty slot</div>').join('')}</div></div>
      <div class="card"><div class="card-head"><h2>📦 Box</h2><span class="muted small-text">${box.length} creature${box.length === 1 ? '' : 's'}</span></div>
        ${box.length ? `<div class="monlist">${box.map(m => monCard(m, false)).join('')}</div>` : '<p class="muted small-text">Creatures you catch or hatch when your team is full go here.</p>'}</div>
      <div class="card"><h2>🎒 Bag</h2><div class="crbag">${[['🎯', 'Catch bands', C.bands || 0], ['💫', 'Super bands', C.sbands || 0], ['💎', 'Growth crystals', C.crystals || 0], ['🍬', 'Rare candy', C.candy || 0], ...Object.entries(STONES).map(([k, [ic, n]]) => [ic, n, C.stones[k] || 0]), ...HELD.map(h => [h.icon, h.name, C.held[h.id] || 0])].filter(x => x[2]).map(([ic, n, v]) => `<span class="pill">${ic} ${n} ×${v}</span>`).join('') || '<span class="muted small-text">Empty. Buy things in Eggs &amp; shop.</span>'}</div></div>
    </div>${monDetail(sel)}</div>`;
}
function monDetail(m) {
  const s = specOf(m.sp), C = CR(), mon = crStats(m), on = C.team.includes(m.uid), ce = canEvolve(m), tier = upgTier(), cap = trainCap();
  const known = [...new Set([...knownAt(m.sp, m.lv), ...(m.extra || [])])];
  const next = learnset(m.sp).find(x => x.lv > m.lv);
  const evoTxt = s.evo ? (ce?.ok ? `<button class="btn primary" data-cr="evolve" data-id="${m.uid}">✨ Evolve into ${specOf(s.evo.to).name}${ce.stone ? ` (uses a ${STONES[ce.stone][1]})` : ''}</button>` : `<span class="muted small-text">Evolves into <b>${specOf(s.evo.to).name}</b> ${s.evo.lv ? `at Lv ${s.evo.lv}` : `with a ${STONES[s.evo.stone][0]} ${STONES[s.evo.stone][1]}`} · needs ${ce?.why}</span>${s.evo.lv && C.crystals > 0 && m.lv >= s.evo.lv - 5 && evoAllowed(s.stage) ? ` <button class="btn small" data-cr="crystal" data-id="${m.uid}">💎 Use a crystal</button>` : ''}`) : '<span class="muted small-text">Fully evolved.</span>';
  return `<div class="card mondetail"><div class="mdhead"><div class="c3view" id="c3view" data-sp="${m.sp}">${crBadge(s, 120)}</div>
      <div class="main"><h2>${esc(m.nick || s.name)} <small class="muted">Lv ${m.lv}</small></h2><div>${typeChips(s.types)}</div><p class="muted small-text">${esc(s.dex || '')}</p>
        <div class="xpbar big"><i style="width:${Math.round((m.xp - XP_AT(m.lv)) / Math.max(1, XP_AT(m.lv + 1) - XP_AT(m.lv)) * 100)}%"></i></div><small class="muted">${XP_AT(m.lv + 1) - m.xp} XP to Lv ${m.lv + 1} · from battles and your workouts${next ? ` · learns ${moveById(next.id).name} at Lv ${next.lv}` : ''}</small>
        <div class="row" style="margin-top:8px">${on ? `<button class="btn small" data-cr="bench" data-id="${m.uid}" ${C.team.length <= 1 ? 'disabled' : ''}>Move to box</button>${C.team.indexOf(m.uid) > 0 ? `<button class="btn small" data-cr="lead" data-id="${m.uid}">⭐ Make leader</button>` : ''}` : `<button class="btn small primary" data-cr="join" data-id="${m.uid}">+ Team</button>`}
          <button class="btn small" data-cr="nick" data-id="${m.uid}">✏️ Nickname</button>${C.candy > 0 ? `<button class="btn small" data-cr="candy" data-id="${m.uid}">🍬 Rare candy</button>` : ''}${!on && C.mons.length > 1 ? `<button class="btn small danger" data-cr="release" data-id="${m.uid}">Release</button>` : ''}</div></div></div>
    <div class="evorow">${evoTxt}</div>
    <h3>Stats <span class="muted small-text">training cap ${cap} per stat (upgrade tier ${tier})</span></h3>
    <div class="crstats">${[['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defence'], ['spd', 'Speed'], ['spc', 'Skill']].map(([k, l]) => { const t = (m.train || {})[k] || 0, cc = { [TRAIN_COST[k]]: trainCost(t) };
      return `<div class="crstat"><span>${l}</span><b>${mon.st[k]}</b><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < t ? 'on' : i < cap ? '' : 'lock'}"></i>`).join('')}</div><button class="btn small" data-cr="train" data-id="${m.uid}" data-k="${k}" ${t < cap && canPay(cc) ? '' : 'disabled'} title="+4 base ${l}">${t >= 10 ? 'Max' : t >= cap ? '🔒' : '+ ' + costTxt(cc)}</button></div>`; }).join('')}</div>
    <h3>Held item</h3><div class="row">${m.item ? `<span class="pill">${heldOf(m.item).icon} ${heldOf(m.item).name}: ${heldOf(m.item).text}</span><button class="btn small" data-cr="held" data-id="${m.uid}" data-v="">Take off</button>` : '<span class="muted small-text">Nothing.</span>'}
      ${HELD.filter(h => C.held[h.id] > 0 && h.id !== m.item).map(h => `<button class="btn small" data-cr="held" data-id="${m.uid}" data-v="${h.id}" title="${esc(h.text)}">${h.icon} Give ${h.name} (${C.held[h.id]})</button>`).join('')}</div>
    <h3>Moves <span class="muted small-text">${m.moves.length}/4 · click to swap</span></h3>
    <div class="crmoves">${known.map(id => { const x = moveById(id), inSet = m.moves.includes(id); return `<button class="crmove ${inSet ? 'on' : ''} ${(m.newMoves || []).includes(id) ? 'new' : ''}" data-cr="move" data-id="${m.uid}" data-v="${id}" style="--sc:${TYPES[x.type][2]}" title="${esc(x.note)}">${x.icon} <b>${esc(x.name)}</b><small>${TYPES[x.type][1]} · ${x.pow ? 'Pow ' + x.pow : catOf(x)}</small></button>`; }).join('')}</div>
    <details class="tutor"><summary>🧑‍🏫 Move tutor: teach other ${s.types.map(t => TYPES[t][1]).join('/')} and Normal moves</summary><div class="crmoves">${tutorable(m).filter(x => !known.includes(x.id)).map(x => `<button class="crmove" data-cr="move" data-id="${m.uid}" data-v="${x.id}" style="--sc:${TYPES[x.type][2]}" title="${esc(x.note)}">${x.icon} <b>${esc(x.name)}</b><small>${ownsMove(x) ? 'free (you learned it before)' : (Math.round(x.price * .8) || 50) + ' ' + COIN}</small></button>`).join('')}</div></details>
  </div>`;
}
function arenaTrainer() {
  const T = trainer(), C = CR(), pc = Math.round((T.xp - T.cur) / Math.max(1, T.next - T.cur) * 100);
  const unlocks = [[3, '🌱 Stage-2 evolutions'], [4, '4th team slot'], [5, 'Upgrade tier 2 · team aura +1%'], [6, 'Evolution stones · Super bands'], [8, '📣 Pep talk'], [10, 'Stage-3 evolutions · tier 3'], [12, '🫁 Second wind · Legend eggs'], [15, 'Tier 4'], [16, '🙌 Crowd favourite'], [20, '💥 Never give up · tier 5'], [24, 'Team aura maxed at +20%']];
  return `<div class="card trainercard"><div class="trtop">${safeBadge(avatarSpec(), 96)}<div class="main"><h2>Trainer ${esc(D.settings.name || '')} <span class="ahero-ovr">Lv ${T.lv}</span></h2>
      <div class="xpbar big"><i style="width:${pc}%"></i></div><small class="muted">${T.xp - T.cur} / ${T.next - T.cur} XP to Lv ${T.lv + 1} · counting from ${fmtDate(C.since)}</small>
      <div class="row" style="margin-top:6px"><span class="pill">🛡️ Upgrade tier ${upgTier()}</span><span class="pill">✨ Team aura +${teamAura()}%</span><span class="pill">🐾 ${teamSlots()} team slots</span><span class="pill">🏃 ${T.n} workouts · ${fmtMins(T.mins) || '0m'}</span></div></div></div>
    <div class="ahero-stats trstats">${STATS.map(([k, n, ab, col]) => `<div title="${n}: boosts your creatures' ${({ end: 'HP', pow: 'Attack', str: 'Defence', spd: 'Speed', agi: 'Skill' })[k]}"><span>${ab}</span><div class="sbar"><i style="width:${T.st[k]}%;background:${col}"></i></div><b>${T.st[k]}</b></div>`).join('')}</div>
    <p class="muted small-text">Each workout trains the stat that matches its sport: sprints and agility build Speed, gym work builds Strength and Power, runs, rides and swims build Endurance, team sports build Agility. Your trainer stats boost the matching stat on every creature (Endurance → HP, Power → Attack, Strength → Defence, Speed → Speed, Agility → Skill).</p></div>
    <div class="grid g2">
      <div class="card"><h2>📏 Fitness tests</h2><p class="muted small-text">Scored against standards for a ${ageNow()}-year-old. Each one adds trainer XP and stat points. Log results under Training &amp; Health → Bests.</p>
        ${T.tests.length ? `<ul class="trtests">${T.tests.sort((a, b) => b.score - a.score).map(x => { const [band, col] = pbBand(x.score); return `<li><b>${esc(x.T.name)}</b><span>${fmtTest(x.T, x.best)}</span><span class="tag" style="background:${col}22;color:${col}">${band} · ${x.score}</span></li>`; }).join('')}</ul>` : '<div class="empty">No tests since the update yet. Log one to score it.</div>'}
        <div class="row"><label class="small-text">Your age <input type="number" min="10" max="40" data-setting="age" value="${esc(D.settings.age || '')}" placeholder="${ageNow()}" style="width:70px"></label><button class="btn small" data-act="goto" data-v="training">Log a test →</button></div></div>
      <div class="card"><h2>🔓 What trainer levels unlock</h2><ul class="trunlocks">${unlocks.map(([lv, t]) => `<li class="${T.lv >= lv ? 'done' : ''}"><b>Lv ${lv}</b><span>${t}</span>${T.lv >= lv ? '<span class="tag green">✓</span>' : ''}</li>`).join('')}</ul>
        <h3>Team buffs</h3><ul class="trunlocks">${TEAM_PERKS.map(p => `<li class="${T.lv >= p.lv ? 'done' : ''}"><b>${p.icon} ${p.name}</b><span>${p.text}</span><span class="tag ${T.lv >= p.lv ? 'green' : ''}">${T.lv >= p.lv ? 'On' : 'Lv ' + p.lv}</span></li>`).join('')}</ul></div>
    </div>`;
}
function arenaShop2() {
  const C = CR(), tl = trainerLv(), tier = upgTier();
  const item = (ic, name, text, cost, act, id, lock) => `<div class="sitem"><div class="sicon">${ic}</div><b>${name}</b><span class="muted small-text">${text}</span><button class="btn small ${!lock && canPay(cost) ? 'primary' : ''}" data-cr="${act}" data-id="${id}" ${!lock && canPay(cost) ? '' : 'disabled'}>${lock || costTxt(cost)}</button></div>`;
  return `<div class="card"><div class="card-head"><h2>🥚 Eggs</h2><span class="pill">${COIN} ${coins()}</span><span class="pill">${GRIT} ${grit()}</span></div>
      <div class="shopgrid">${EGGS.map(E => item(`<span class="eggic">${E.icon}</span>`, E.name, E.text, { coins: E.coins, grit: E.grit }, 'egg', E.id, tl < E.lv ? `🔒 Trainer Lv ${E.lv}` : '')).join('')}</div></div>
    <div class="card"><h2>🎒 Items</h2><div class="shopgrid">${SHOP2.map(it => item(it.icon, it.name, it.text, it, 'shop', it.id, it.lv && tl < it.lv ? `🔒 Trainer Lv ${it.lv}` : '')).join('')}</div></div>
    <div class="card"><div class="card-head"><h2>🎽 Held items</h2><span class="muted small-text">give one to each creature · tier ${tier}</span></div><div class="shopgrid">${HELD.map(h => item(h.icon, h.name, h.text + (C.held[h.id] ? ` You have ${C.held[h.id]}.` : ''), h, 'buyheld', h.id, tier < h.tier ? `🔒 Tier ${h.tier}` : '')).join('')}</div></div>
    <div class="card"><div class="card-head"><h2>📈 Team buffs</h2><span class="muted small-text">permanent, for every creature</span></div><div class="shopgrid">${TEAM_BUFFS.map(b => { const l = buffLv(b.id), c = b.cost(l + 1); return item(b.icon, `${b.name} · Lv ${l}/${b.max}`, b.text, c, 'buff', b.id, l >= b.max ? 'Maxed' : l + 1 > tier ? `🔒 Tier ${l + 1}` : ''); }).join('')}</div></div>
    ${arenaShop(grit())}`;
}
// wild creatures and giants on the Battle page
function wildHtml() {
  const up = unlockedUpTo(), reached = tierOf(ENEMIES[up]), C = CR();
  return `<div class="grid g2 bmodes"><div class="card bmode wild"><div class="card-head"><h2>🌿 Wild creatures</h2><span class="pill">🎯 ${C.bands || 0}${C.sbands ? ` · 💫 ${C.sbands}` : ''}</span></div>
      <p class="muted small-text">Explore an arena you've reached. Weaken a wild creature, then throw a band from your bag to catch it.</p>
      <div class="row">${LEAGUES.slice(0, reached + 1).map((lg, t) => `<button class="btn ${t === reached ? 'primary' : ''}" data-cr="wild" data-v="${t}" title="${regionPool(t).map(s => s.name).join(', ')}">${lg.icon} ${lg.name}</button>`).join('')}</div></div>
    <div class="card bmode giant"><div class="card-head"><h2>🦖 Giant bosses</h2><span class="muted small-text">huge, tough, can't be caught</span></div>
      <ul class="giants">${GIANTS.filter(g => LEAGUES.findIndex(l => l.id === g.league) <= reached).map(g => { const s = specOf(g.sp), won = (C.giants || {})[g.id], drop = GIANT_DROPS[g.id];
        return `<li>${crBadge(s, 40)}<div class="main"><b>${g.name}</b> <small class="muted">Lv ${g.lv}</small><div class="muted small-text">${won ? 'Beaten · rematch for a 💎 Growth crystal' : `First win: ${drop[0] === 'stone' ? STONES[drop[1]][0] + ' ' + STONES[drop[1]][1] : drop[0] === 'held' ? heldOf(drop[1]).icon + ' ' + heldOf(drop[1]).name : '🌟 a Legend egg'}`}</div></div><button class="btn ${won ? '' : 'primary'}" data-cr="giant" data-id="${g.id}">⚔️ Fight</button></li>`; }).join('')}</ul></div></div>`;
}
function startWild(t) {
  const pool = regionPool(t), r = Math.random, s = pool[Math.floor(r() * pool.length)];
  const lv = Math.max(3, LEAGUE_LV[t] - 2 + Math.floor(r() * 5));
  startBattle({ id: 'wild', name: `Wild ${s.name}`, icon: s.icon, league: LEAGUES[t].id, wild: s.id, lv, line: '' }, 'wild');
}

// ---------- clicks ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-cr]'); if (!el) return;
  const a = el.dataset.cr, id = el.dataset.id;
  if (a === 'eggok') return;
  e.preventDefault();
  if (a === 'starter') { const s = specOf(id); if (!confirm(`Choose ${s.name} as your first creature?`)) return; CR().starter = id; newMon(id, 5, 'starter'); save(); render(); crCelebrate(s, 'Your partner', `${s.name} joins your team!`); }
  else if (a === 'sel') { ui.crSel = id; render(); }
  else if (a === 'join') { const C = CR(); if (C.team.length >= teamSlots()) return toast('Team is full', 'Move someone to the box first.'); C.team.push(id); save(); render(); }
  else if (a === 'bench') { const C = CR(); if (C.team.length <= 1) return; C.team = C.team.filter(x => x !== id); save(); render(); }
  else if (a === 'lead') { const C = CR(); C.team = [id, ...C.team.filter(x => x !== id)]; save(); render(); }
  else if (a === 'nick') { const m = monById(id), n = prompt('Nickname (leave empty for none)', m.nick || ''); if (n == null) return; m.nick = n.trim().slice(0, 16) || undefined; save(); render(); }
  else if (a === 'release') { const m = monById(id); if (!confirm(`Release ${m.nick || specOf(m.sp).name}? It goes back to the wild.`)) return; const C = CR(); if (m.item) C.held[m.item] = (C.held[m.item] || 0) + 1; C.mons = C.mons.filter(x => x.uid !== id); ui.crSel = null; save(); render(); }
  else if (a === 'evolve') evolve(id);
  else if (a === 'crystal') useCrystal(id);
  else if (a === 'candy') useCandy(id);
  else if (a === 'train') trainStat(id, el.dataset.k);
  else if (a === 'held') giveHeld(id, el.dataset.v);
  else if (a === 'move') teachMove(id, el.dataset.v);
  else if (a === 'egg') buyEgg(id);
  else if (a === 'shop') buyShop2(id);
  else if (a === 'buyheld') buyHeld(id);
  else if (a === 'buff') buyBuff(id);
  else if (a === 'wild') { if (!teamMons().length) return toast('Pick a starter first', ''); startWild(+el.dataset.v); }
  else if (a === 'giant') { if (!teamMons().length) return toast('Pick a starter first', ''); const g = GIANTS.find(x => x.id === id); startBattle({ ...g, icon: specOf(g.sp).icon, boss: true, giant: true, drop: GIANT_DROPS[g.id], line: '' }, 'giant'); }
});
