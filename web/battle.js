'use strict';
/* Battles, played by the rules of the very first Pokémon games, with an
   athletics twist. You and your rival each bring a team. Every fighter has
   one or two types, five stats (HP, Attack, Defence, Speed and Skill), a level
   and four moves with limited uses (PP). Each turn both sides pick a move, swap
   fighters or use an item; the faster fighter goes first. Damage uses the
   classic formula: level, power, attack vs defence, a 1.5x bonus for moves that
   match your type, the type chart (2x, 0.5x or no effect), critical hits and a
   small random roll. Statuses (asleep, poisoned, burned, frozen, paralysed,
   confused) and stat stages from -6 to +6 work like the originals.

   Small changes to fit the app: your athlete is always on your team and their
   stats come from your training; rivals you've beaten can join your crew;
   sleep lasts 1 to 3 turns, frozen fighters thaw 10% of the time, Focus
   multiplies the crit chance (the old game had a bug that made it worse), and
   Spirit moves are super effective on Mind like they were meant to be. */

// ---------- types and the type chart ----------
const TYPES = {
  normal: ['⚪', 'Normal', '#a5a5a5'], fire: ['🔥', 'Fire', '#f76707'], water: ['💧', 'Water', '#1c7ed6'], spark: ['⚡', 'Spark', '#f5b400'],
  nature: ['🌿', 'Nature', '#37b24d'], frost: ['❄️', 'Frost', '#3bc9db'], combat: ['🥊', 'Combat', '#c92a2a'], toxic: ['☣️', 'Toxic', '#9c36b5'],
  earth: ['⛰️', 'Earth', '#b08150'], air: ['🌬️', 'Air', '#748ffc'], mind: ['🔮', 'Mind', '#e64980'], swarm: ['🐝', 'Swarm', '#82c91e'],
  stone: ['🪨', 'Stone', '#868e96'], spirit: ['👻', 'Spirit', '#7048e8'], legend: ['🐉', 'Legend', '#5f3dc4'],
};
// like the old games, the type decides whether a move is physical (Attack vs Defence) or special (Skill vs Skill)
const SPECIAL_TYPES = new Set(['fire', 'water', 'spark', 'nature', 'frost', 'mind', 'legend']);
const CHART = (() => {
  const c = {}, set = (a, list, v) => list.split(' ').forEach(d => { (c[a] = c[a] || {})[d] = v; });
  set('normal', 'stone', .5); set('normal', 'spirit', 0);
  set('fire', 'fire water stone legend', .5); set('fire', 'nature frost swarm', 2);
  set('water', 'water nature legend', .5); set('water', 'fire earth stone', 2);
  set('spark', 'spark nature legend', .5); set('spark', 'earth', 0); set('spark', 'water air', 2);
  set('nature', 'fire nature toxic air swarm legend', .5); set('nature', 'water earth stone', 2);
  set('frost', 'water frost', .5); set('frost', 'nature earth air legend', 2);
  set('combat', 'toxic air mind swarm', .5); set('combat', 'spirit', 0); set('combat', 'normal frost stone', 2);
  set('toxic', 'toxic earth stone spirit', .5); set('toxic', 'nature swarm', 2);
  set('earth', 'nature swarm', .5); set('earth', 'air', 0); set('earth', 'fire spark toxic stone', 2);
  set('air', 'spark stone', .5); set('air', 'nature combat swarm', 2);
  set('mind', 'mind', .5); set('mind', 'combat toxic', 2);
  set('swarm', 'fire combat air spirit', .5); set('swarm', 'nature toxic mind', 2);
  set('stone', 'combat earth', .5); set('stone', 'fire frost air swarm', 2);
  set('spirit', 'normal', 0); set('spirit', 'spirit mind', 2);
  set('legend', 'legend', 2);
  return c;
})();
const typeEff = (atk, defTypes) => defTypes.reduce((a, t) => a * (CHART[atk]?.[t] ?? 1), 1);
const typeBadge = t => `<span class="tbadge" style="--sc:${TYPES[t][2]}">${TYPES[t][0]} ${TYPES[t][1]}</span>`;
const typeChips = ts => ts.map(typeBadge).join('');
// your athlete's type comes from their best stats
const STAT_TYPE = { spd: 'spark', pow: 'fire', str: 'combat', end: 'water', agi: 'air' };
function myTypes(st) {
  const [a, b] = STAT_IDS.slice().sort((x, y) => st[y] - st[x]);
  return st[a] - st[b] <= 6 ? [STAT_TYPE[a], STAT_TYPE[b]] : [STAT_TYPE[a]];
}
const RIVAL_TYPES = {
  couch: ['normal'], turtle: ['water', 'stone'], sprinter: ['spark'], gymbro: ['combat'], coach: ['combat', 'normal'],
  wall: ['stone', 'earth'], cheetah: ['normal', 'spark'], roo: ['combat', 'air'], croc: ['water', 'earth'], storm: ['air', 'spark'],
  ox: ['earth', 'normal'], champ: ['spark', 'fire'], ninja: ['combat', 'spirit'], marathon: ['water', 'nature'], titan: ['stone', 'earth'],
  bolt: ['spark'], mountain: ['stone', 'frost'], phantom: ['spirit', 'toxic'], goat: ['legend', 'normal'],
  sherpa: ['earth', 'frost'], avalanche: ['frost', 'air'], eaglepk: ['air', 'mind'], yeti: ['frost', 'legend'],
};
const WANDER_TYPES = { 'Drifter Dusty': ['earth', 'normal'], 'Sensei Suki': ['combat', 'mind'], 'Captain Comeback': ['normal', 'combat'], 'Midnight Miler': ['spirit', 'water'],
  'RoboRunner 3000': ['spark', 'stone'], 'The Wizard': ['mind', 'fire'], 'Grizzly Gus': ['combat', 'earth'], 'Foxy Flash': ['fire', 'air'] };
const typesOf = e => RIVAL_TYPES[e.id] || WANDER_TYPES[e.name] || RIVAL_TYPES[e.base] || ['normal'];

// stat stages -6..+6, as multipliers
const STAGE = [.25, .28, .33, .4, .5, .66, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const stageMul = s => STAGE[Math.max(-6, Math.min(6, s)) + 6];
const STAT_NAME = { atk: 'Attack', def: 'Defence', spd: 'Speed', spc: 'Skill', acc: 'accuracy', eva: 'evasion' };
const COND = { slp: ['💤', 'Asleep', '#748ffc'], psn: ['☠️', 'Poisoned', '#9c36b5'], tox: ['☠️', 'Badly poisoned', '#862e9c'], brn: ['🔥', 'Burned', '#f76707'], frz: ['🧊', 'Frozen', '#3bc9db'], par: ['⚡', 'Paralysed', '#f5b400'] };

// ---------- the move book ----------
// pow: base power · acc: accuracy % (null = never misses) · pp: uses per battle.
// Basic moves are free; the rest unlock with Grit once a stat is high enough
// (stat/need), or come out of Move scrolls. Levelling a move adds PP.
const mv = (id, type, pow, acc, pp, icon, name, note, stat, need, price, x = {}) => ({ id, type, pow, acc, pp, icon, name, note, stat, need, price, ...x });
const MOVE_BOOK = [
  mv('b_spd', 'spark', 40, 100, 30, '⚡', 'Static dash', 'A quick, crackling dash. 10% chance to paralyse.', 'spd', 0, 0, { basic: 1, sec: { ch: 10, st: 'par' } }),
  mv('b_pow', 'fire', 40, 100, 25, '🔥', 'Fire up', 'A burst of heat. 10% chance to burn.', 'pow', 0, 0, { basic: 1, sec: { ch: 10, st: 'brn' } }),
  mv('b_str', 'combat', 40, 100, 30, '💪', 'Shoulder charge', 'A solid, honest hit.', 'str', 0, 0, { basic: 1 }),
  mv('b_end', 'water', 40, 100, 25, '💧', 'Bottle spray', 'A blast from your drink bottle.', 'end', 0, 0, { basic: 1 }),
  mv('b_agi', 'air', 40, 100, 35, '🌀', 'Sidestep gust', 'Spin past them and whip up the wind.', 'agi', 0, 0, { basic: 1 }),
  // speed
  mv('quick', 'normal', 40, 100, 30, '💨', 'Quick step', 'Always goes first.', 'spd', 35, 70, { pri: 1 }),
  mv('jab', 'normal', 18, 85, 15, '👊', 'Quick jabs', 'Hits 2 to 5 times in a row.', 'spd', 36, 80, { hits: 1 }),
  mv('bite', 'normal', 60, 100, 25, '😬', 'Snap', '30% chance to make them flinch.', 'spd', 38, 90, { sec: { ch: 30, st: 'flinch' } }),
  mv('trash', 'normal', 0, 85, 40, '🗣️', 'Trash talk', 'Gets in their head: their Defence drops 2 stages.', 'spd', 38, 90, { foe: { def: -2 } }),
  mv('thwave', 'spark', 0, 100, 20, '🔌', 'Static shock', 'Paralyses them: a quarter of the speed, and 1 turn in 4 they can\'t move.', 'spd', 40, 120, { inflict: 'par' }),
  mv('agility', 'mind', 0, null, 30, '🏃', 'Fast feet', 'Your Speed goes up 2 stages.', 'spd', 45, 140, { self: { spd: 2 } }),
  mv('dash', 'air', 80, 100, 20, '🌬️', 'Sprint dash', 'A strong rush of air.', 'spd', 45, 150),
  mv('pinmissile', 'swarm', 14, 85, 20, '📌', 'Stud rake', 'Hits 2 to 5 times in a row.', 'spd', 48, 170, { hits: 1 }),
  mv('tbolt', 'spark', 95, 100, 15, '🌩️', 'Lightning step', 'A huge spark attack. 10% chance to paralyse.', 'spd', 55, 260, { sec: { ch: 10, st: 'par' } }),
  mv('thunder', 'spark', 120, 70, 10, '⛈️', 'Thunder clap', 'Massive, but often misses. 10% chance to paralyse.', 'spd', 65, 380, { sec: { ch: 10, st: 'par' } }),
  // power
  mv('pump', 'normal', 0, null, 30, '💢', 'Psych up', 'Your Attack goes up 2 stages.', 'pow', 40, 110, { self: { atk: 2 } }),
  mv('flame', 'fire', 95, 100, 15, '🔥', 'On fire', 'A huge fire attack. 10% chance to burn.', 'pow', 44, 200, { sec: { ch: 10, st: 'brn' } }),
  mv('tackle', 'normal', 150, 90, 5, '🏉', 'Power tackle', 'The biggest hit there is, but you need a turn to catch your breath after (unless it knocks them out).', 'pow', 50, 240, { recharge: 1 }),
  mv('icebeam', 'frost', 95, 100, 10, '🧊', 'Cold shoulder', 'A freezing beam. 10% chance to freeze.', 'pow', 54, 260, { sec: { ch: 10, st: 'frz' } }),
  mv('speccy', 'air', 70, 95, 15, '🦘', 'Speccy', 'Turn 1: leap sky-high where nothing can hit you. Turn 2: land on them.', 'pow', 56, 280, { charge: 'fly' }),
  mv('rage', 'legend', 0, 100, 10, '🐉', 'Legend\'s roar', 'Always does exactly 40 damage.', 'pow', 58, 300, { fixed: 40 }),
  mv('fireblast', 'fire', 120, 85, 5, '☄️', 'Blazing finish', 'Huge, but can miss. 30% chance to burn.', 'pow', 62, 360, { sec: { ch: 30, st: 'brn' } }),
  mv('blizzard', 'frost', 120, 90, 5, '🌨️', 'Ice storm', 'Huge frost attack. 10% chance to freeze.', 'pow', 64, 380, { sec: { ch: 10, st: 'frz' } }),
  mv('explode', 'normal', 170, 100, 5, '💥', 'All-out', 'Leave everything out there: massive damage (it halves their Defence), but you faint.', 'pow', 70, 420, { explode: 1 }),
  // strength
  mv('bump', 'combat', 50, 100, 25, '💪', 'Hip and shoulder', 'Lands critical hits much more often.', 'str', 40, 90, { crit: 1 }),
  mv('wrap', 'normal', 15, 85, 20, '🤼', 'Headlock', 'Holds them for 2 to 5 turns: they lose a little HP each turn and can\'t swap out.', 'str', 42, 120, { wrap: 1 }),
  mv('sludge', 'toxic', 65, 100, 20, '🤢', 'Sweat bomb', '30% chance to poison.', 'str', 44, 150, { sec: { ch: 30, st: 'psn' } }),
  mv('seismic', 'combat', 0, 100, 20, '🌍', 'Suplex', 'Does damage equal to your level.', 'str', 46, 160, { fixed: 'lv' }),
  mv('bulldoze', 'earth', 100, 100, 10, '🦏', 'Bulldozer', 'Shakes the whole ground. Huge Earth attack.', 'str', 52, 240),
  mv('rockslide', 'stone', 75, 90, 10, '🪨', 'Rock slide', '30% chance to make them flinch.', 'str', 55, 240, { sec: { ch: 30, st: 'flinch' } }),
  mv('fend', 'combat', 0, 100, 20, '✋', 'Don\'t-argue', 'Goes last. Hits back double the damage of a Normal or Combat hit you just took.', 'str', 60, 320, { pri: -1, counter: 1 }),
  mv('dig', 'earth', 100, 100, 10, '⛏️', 'Dig in', 'Turn 1: go underground where nothing can hit you. Turn 2: burst up under them.', 'str', 62, 320, { charge: 'dig' }),
  // endurance
  mv('leechlife', 'swarm', 20, 100, 15, '🦟', 'Mozzie bite', 'You get back half the damage you do.', 'end', 38, 90, { drain: 1 }),
  mv('megadrain', 'nature', 40, 100, 10, '🌱', 'Energy drain', 'You get back half the damage you do.', 'end', 40, 110, { drain: 1 }),
  mv('wind', 'normal', 0, null, 20, '🫁', 'Second wind', 'Heal half your max HP.', 'end', 42, 120, { heal: .5 }),
  mv('amnesia', 'mind', 0, null, 20, '🧘', 'Zone out', 'Your Skill goes up 2 stages.', 'end', 46, 160, { self: { spc: 2 } }),
  mv('leech', 'nature', 0, 90, 10, '🪴', 'Energy sap', 'Plants a seed that drains 1/16 of their HP to you every turn. Nature types are immune.', 'end', 48, 170, { inflict: 'leech' }),
  mv('icebath', 'mind', 0, null, 10, '🛁', 'Ice bath', 'Fully heals you and cures statuses, but you sleep for 2 turns.', 'end', 48, 170, { rest: 1 }),
  mv('haze', 'frost', 0, null, 30, '🌫️', 'Cool down', 'Resets every stat change and lingering effect on both sides.', 'end', 50, 180, { haze: 1 }),
  mv('surf', 'water', 95, 100, 15, '🌊', 'Wave runner', 'A huge wave.', 'end', 52, 240),
  mv('lungs', 'mind', 0, null, 20, '🧱', 'Iron lungs', 'Reflect: physical hits on you do half damage until you swap out.', 'end', 55, 260, { screen: 'reflect' }),
  mv('toxic', 'toxic', 0, 85, 10, '🧪', 'Lactic acid', 'Badly poisons them: the damage gets worse every turn.', 'end', 56, 260, { inflict: 'tox' }),
  mv('hydro', 'water', 120, 80, 5, '🚿', 'Hose down', 'A massive blast of water, but it can miss.', 'end', 64, 360),
  // agility
  mv('sand', 'normal', 0, 100, 15, '🌪️', 'Dust kick', 'Kick dirt in their eyes: their accuracy drops.', 'agi', 36, 70, { foe: { acc: -1 } }),
  mv('dteam', 'normal', 0, null, 15, '👥', 'Shadow step', 'Your evasion goes up: they miss more.', 'agi', 40, 110, { self: { eva: 1 } }),
  mv('spin', 'spirit', 0, 100, 10, '😵‍💫', 'Dizzy spin', 'Confuses them for 2 to 5 turns: half the time they hurt themselves instead.', 'agi', 42, 130, { inflict: 'conf' }),
  mv('ankle', 'combat', 50, 90, 20, '🦶', 'Ankle breaker', '30% chance to make them flinch.', 'agi', 45, 160, { sec: { ch: 30, st: 'flinch' } }),
  mv('nshade', 'spirit', 0, 100, 15, '🌑', 'Ghost run', 'Does damage equal to your level.', 'agi', 46, 160, { fixed: 'lv' }),
  mv('banana', 'nature', 55, 95, 25, '🍌', 'Banana kick', 'Lands critical hits much more often.', 'agi', 50, 220, { crit: 1 }),
  mv('focus', 'normal', 0, null, 30, '🎯', 'Laser focus', 'Critical hits become 4 times as likely until you swap out.', 'agi', 50, 200, { focus: 1 }),
  mv('hypno', 'mind', 0, 60, 20, '🌀', 'Lullaby', 'Puts them to sleep for 1 to 3 turns. Misses a lot.', 'agi', 50, 200, { inflict: 'slp' }),
  mv('lscreen', 'mind', 0, null, 30, '🛡️', 'Mind shield', 'Light screen: special hits on you do half damage until you swap out.', 'agi', 52, 220, { screen: 'light' }),
  mv('sub', 'normal', 0, null, 10, '🎭', 'Body double', 'Spend a quarter of your HP on a decoy that takes hits and blocks statuses.', 'agi', 55, 260, { sub: 1 }),
  mv('blindturn', 'mind', 90, 100, 10, '🌪️', 'Blind turn', 'A huge Mind attack. 33% chance to lower their Skill.', 'agi', 65, 420, { sec: { ch: 33, foe: { spc: -1 } } }),
];
// moves only rivals use: the gym leaders' signature moves, and what anyone does when out of PP
const SIG_MOVES = [
  mv('sig_coach', 'normal', 75, 100, 10, '📣', 'Extra laps!', 'Hits, then lowers your Speed.', '', 0, 0, { sec: { ch: 100, foe: { spd: -1 } } }),
  mv('sig_storm', 'air', 35, 90, 10, '🌪️', 'Twister', 'Hits 2 to 5 times.', '', 0, 0, { hits: 1 }),
  mv('sig_titan', 'earth', 120, 90, 5, '🗿', 'Earthquake slam', '30% chance to make you flinch.', '', 0, 0, { sec: { ch: 30, st: 'flinch' } }),
  mv('sig_goat', 'legend', 100, 100, 5, '🐐', 'Greatest of all time', 'Lands critical hits much more often.', '', 0, 0, { crit: 1 }),
  mv('sig_yeti', 'frost', 100, 90, 5, '🏔️', 'Avalanche', '30% chance to freeze.', '', 0, 0, { sec: { ch: 30, st: 'frz' } }),
  mv('struggle', 'normal', 50, 100, 0, '😤', 'Struggle', 'Out of moves: hurts you too.', '', 0, 0, { recoil: .5 }),
];
const BOSS_SIG = { coach: 'sig_coach', storm: 'sig_storm', titan: 'sig_titan', goat: 'sig_goat', yeti: 'sig_yeti' };
const ALL_MOVES = [...MOVE_BOOK, ...SIG_MOVES];
const moveById = id => ALL_MOVES.find(m => m.id === id);
const MAX_MOVE_LV = 4;
const moveLv = id => Math.min(MAX_MOVE_LV, (D.arena.moveLv || {})[id] || 1);
const ownsMove = m => m.basic || !!(D.arena.movesOwned || {})[m.id];
const maxPP = (m, lv = 1) => m.pp + Math.floor(m.pp / 5) * (lv - 1); // each level is a "PP up": +20%
const upgradePrice = m => (m.basic ? 50 : Math.round(m.price * .6)) * moveLv(m.id);
const isDmg = m => m.pow > 0 || !!m.fixed || !!m.counter;
const catOf = m => !isDmg(m) ? 'Status' : SPECIAL_TYPES.has(m.type) ? 'Special' : 'Physical';
function moveSet() {
  const set = (D.arena.moveset || []).map(moveById).filter(m => m && MOVE_BOOK.includes(m) && ownsMove(m)).slice(0, 4);
  if (set.length) return set;
  const st = battleStats(); return MOVE_BOOK.filter(m => m.basic).sort((a, b) => st[b.stat] - st[a.stat]).slice(0, 4);
}
function moveUnlock(id) {
  const m = moveById(id), st = athlete().total; if (!m || ownsMove(m)) return;
  if (st[m.stat] < m.need) { toast('Not strong enough yet', `${m.name} needs ${statInfo(m.stat)[1]} ${m.need}. Train it up.`); return; }
  if (grit() < m.price) { toast('Not enough Grit', `${m.name} costs ${m.price} ${GRIT}.`); return; }
  D.arena.spent += m.price; D.arena.movesOwned = { ...(D.arena.movesOwned || {}), [id]: new Date().toISOString() };
  const set = moveSet().map(x => x.id); if (set.length < 4) D.arena.moveset = [...set, id];
  save(); render(); celebrate({ icon: `<span class="critbig">${m.icon}</span>`, color: TYPES[m.type][2], kicker: 'New move', title: m.name, text: `${m.note} Put it in your move set to use it in battle.` });
}
function moveUpgrade(id) {
  const m = moveById(id); if (!m || !ownsMove(m) || moveLv(id) >= MAX_MOVE_LV) return;
  const p = upgradePrice(m); if (grit() < p) { toast('Not enough Grit', `Upgrading costs ${p} ${GRIT}.`); return; }
  D.arena.spent += p; D.arena.moveLv = { ...(D.arena.moveLv || {}), [id]: moveLv(id) + 1 };
  save(); render(); toast(`${m.icon} ${m.name} is now level ${moveLv(id)}`, `${maxPP(m, moveLv(id))} PP a battle.`);
}
function moveEquip(id) {
  const m = moveById(id); if (!m || !ownsMove(m)) return;
  let set = moveSet().map(x => x.id);
  if (set.includes(id)) { if (set.length <= 1) return; set = set.filter(x => x !== id); }
  else { if (set.length >= 4) { toast('Your move set is full', 'Take a move out first. You can carry 4.'); return; } set.push(id); }
  D.arena.moveset = set; save(); render();
}
const lvPips = id => `<span class="lvpips">${Array.from({ length: MAX_MOVE_LV }, (_, k) => `<i class="${k < moveLv(id) ? 'on' : ''}"></i>`).join('')}</span>`;
const moveFacts = (m, lv = 1) => `${typeBadge(m.type)} <span class="mvcat">${catOf(m)}</span> · ${m.fixed ? (m.fixed === 'lv' ? 'dmg = level' : `${m.fixed} dmg`) : m.pow ? `Power ${m.pow}` : ''}${m.pow || m.fixed ? ' · ' : ''}${m.acc == null ? 'never misses' : `Acc ${m.acc}%`} · PP ${maxPP(m, lv)}${m.pri > 0 ? ' · goes first' : m.pri < 0 ? ' · goes last' : ''}`;

// ---------- your crew: rivals you've beaten can fight for you ----------
const crewPool = () => ENEMIES.filter(e => beaten(e.id));
function crewTeam() {
  const pool = crewPool().map(e => e.id);
  let t = (D.arena.team || []).filter(id => pool.includes(id));
  if (!D.arena.team) t = pool.slice(-5).reverse();
  return t.slice(0, 5);
}
function crewToggle(id) {
  let t = crewTeam();
  if (t.includes(id)) t = t.filter(x => x !== id);
  else { if (t.length >= 5) { toast('Your crew is full', 'Take someone out first. You can bring 5.'); return; } t.push(id); }
  D.arena.team = t; save(); render();
}
function crewUp(id) { const t = crewTeam(), i = t.indexOf(id); if (i > 0) { [t[i - 1], t[i]] = [t[i], t[i - 1]]; D.arena.team = t; save(); render(); } }

function arenaMoves() {
  const st = athlete().total, set = moveSet().map(m => m.id), g = grit(), me = myMon(), team = crewTeam(), pool = crewPool();
  const card = m => {
    const own = ownsMove(m), can = st[m.stat] >= m.need, inSet = set.includes(m.id), lv = moveLv(m.id), col = TYPES[m.type][2];
    return `<div class="mvcard ${own ? 'own' : ''} ${inSet ? 'inset' : ''} ${!own && !can ? 'locked' : ''}" style="--sc:${col}">
      <div class="mvtop"><span class="mvic">${own || can ? m.icon : '🔒'}</span><div class="main"><b>${esc(m.name)}</b><div class="muted small-text">${moveFacts(m, own ? lv : 1)}</div></div>${own ? lvPips(m.id) : ''}</div>
      <p class="small-text">${esc(m.note)}${me.types.includes(m.type) && m.pow ? ' <b>Matches your type: 1.5× damage.</b>' : ''}</p>
      <div class="row mvbtns">${own ? `<button class="btn small ${inSet ? '' : 'primary'}" data-act="moveEquip" data-id="${m.id}">${inSet ? 'Take out' : '+ Move set'}</button>${lv < MAX_MOVE_LV ? `<button class="btn small" data-act="moveUpgrade" data-id="${m.id}" ${g >= upgradePrice(m) ? '' : 'disabled'}>⬆ +PP · ${upgradePrice(m)} ${GRIT}</button>` : '<span class="tag green">Max PP</span>'}`
        : can ? `<button class="btn small primary" data-act="moveUnlock" data-id="${m.id}" ${g >= m.price ? '' : 'disabled'}>Unlock · ${m.price} ${GRIT}</button>` : `<span class="muted small-text">Needs ${statInfo(m.stat)[1]} ${m.need} (you have ${st[m.stat]})</span>`}</div></div>`;
  };
  const crewCard = e => { const m = crewMon(e), on = team.includes(e.id);
    return `<div class="crewcard ${on ? 'on' : ''}"><span class="crewic">${e.icon}</span><div class="main"><b>${esc(e.name)}</b> <span class="muted small-text">Lv ${m.lv}</span><div>${typeChips(m.types)}</div>
      <div class="muted small-text">${m.moves.map(x => moveById(x.id).name).join(' · ')}</div></div>
      <div class="crewbtns">${on && team.indexOf(e.id) > 0 ? `<button class="iconbtn" data-act="crewUp" data-id="${e.id}" title="Move up">▲</button>` : ''}<button class="btn small ${on ? '' : 'primary'}" data-act="crewToggle" data-id="${e.id}">${on ? 'Bench' : '+ Team'}</button></div></div>`; };
  return `<div class="card"><div class="card-head"><h2>🧍 ${esc(D.settings.name || 'Your athlete')}</h2><span class="muted small-text">Lv ${me.lv} · always leads your team</span>${typeChips(me.types)}<span class="pill">${GRIT} ${g}</span></div>
    <div class="monstats">${[['hp', 'HP', 'end'], ['atk', 'Attack', 'pow'], ['def', 'Defence', 'str'], ['spd', 'Speed', 'spd'], ['spc', 'Skill', 'agi']].map(([k, l, s]) => `<div><span>${l}</span><b>${me.st[k]}</b><small>from ${statInfo(s)[1]}</small></div>`).join('')}</div>
    <div class="mvset">${[0, 1, 2, 3].map(k => { const m = moveById(set[k]); return m ? `<div class="mvslot" style="--sc:${TYPES[m.type][2]}"><span>${m.icon}</span><b>${esc(m.name)}</b><small>${TYPES[m.type][1]} · ${m.pow ? 'Pow ' + m.pow : catOf(m)} · PP ${maxPP(m, moveLv(m.id))}</small></div>` : '<div class="mvslot empty">Empty slot</div>'; }).join('')}</div>
    <p class="muted small-text" style="margin-bottom:0">Your type comes from your best stats, and moves that match it do 1.5× damage. Your level comes from your overall rating, and freshness changes it a little each day.</p></div>
    <div class="card"><div class="card-head"><h2>🤝 Your crew</h2><span class="muted small-text">rivals you've beaten fight for you · bring up to 5 · fights are even, so you bring as many as they do</span></div>
    ${pool.length ? `<div class="crewgrid">${[...team.map(id => ENEMIES.find(e => e.id === id)), ...pool.filter(e => !team.includes(e.id))].map(crewCard).join('')}</div>` : '<div class="empty">Beat a rival on the ladder and they\'ll join your crew.</div>'}</div>
    <div class="card"><div class="card-head"><h2>📖 Move book</h2><span class="muted small-text">${MOVE_BOOK.filter(ownsMove).length} / ${MOVE_BOOK.length} learned</span></div>
    <div class="mvgrid">${MOVE_BOOK.map(card).join('')}</div></div>`;
}

// ---------- fighters ----------
const lvOf = r => Math.round(12 + r * .48);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// base stats from the shape of someone's five ratings: what they lean on is high, what they skip is low
function baseFrom(s, ref, bonus = 0) {
  const B = v => clamp(Math.round(78 + (v - ref) * 3 + bonus), 30, 160);
  return { hp: B(s.end), atk: B(s.pow), def: B(s.str), spd: B(s.spd), spc: B(s.agi) };
}
function genMoves(types, tier, seed, sig) {
  const r = rng(seed), cap = [55, 80, 95, 120, 170][tier], out = [], pick = l => l.length ? l[Math.floor(r() * l.length)] : null, add = m => { if (m && !out.includes(m) && out.length < 4) out.push(m); };
  const pw = m => m.pow || (m.fixed ? 60 : 0), ok = m => !m.recharge && !m.explode && !m.counter;
  if (sig) add(moveById(sig));
  for (const t of types) { const c = MOVE_BOOK.filter(m => m.type === t && pw(m) && ok(m)), fit = c.filter(m => pw(m) <= cap).sort((a, b) => pw(b) - pw(a)); add(fit.length ? (r() < .7 ? fit[0] : pick(fit)) : c.sort((a, b) => pw(a) - pw(b))[0]); }
  add(pick(MOVE_BOOK.filter(m => pw(m) && pw(m) <= cap - 10 && !types.includes(m.type) && m.type !== 'normal' && ok(m) && !m.charge)));
  add(pick(MOVE_BOOK.filter(m => !isDmg(m) && m.need <= 40 + tier * 8)));
  for (let k = 0; out.length < 4 && k < 20; k++) add(pick(MOVE_BOOK.filter(m => m.type === 'normal' && m.pow && m.pow <= cap && ok(m))));
  return out;
}
function mkMon(o) {
  const S = (b, hp) => Math.floor(((b + o.dv) * 2 + o.sx) * o.lv / 100) + (hp ? o.lv + 10 : 5);
  const st = { hp: Math.round(S(o.base.hp, 1) * (o.hpMul || 1)), atk: S(o.base.atk), def: S(o.base.def), spd: S(o.base.spd), spc: S(o.base.spc) };
  return { ...o, st, hp: st.hp, status: null, slp: 0, toxN: 0, stg: { atk: 0, def: 0, spd: 0, spc: 0, acc: 0, eva: 0 }, vol: {},
    moves: o.moves.map(m => ({ id: m.id, pp: maxPP(m, o.ath ? moveLv(m.id) : 1), max: maxPP(m, o.ath ? moveLv(m.id) : 1) })) };
}
function myLevel() { const st = battleStats(); return lvOf(STAT_IDS.reduce((a, k) => a + st[k], 0) / STAT_IDS.length); }
function myMon(hpMul = 1) {
  const st = battleStats(), ovr = STAT_IDS.reduce((a, k) => a + st[k], 0) / STAT_IDS.length;
  const m = mkMon({ key: 'me', name: D.settings.name || 'You', icon: '🧍', ath: true, types: myTypes(st), lv: lvOf(ovr), base: baseFrom(st, ovr, 6), dv: 15, sx: 63, moves: moveSet(), hpMul });
  // tree-type buffs and the training dummy upgrade lift your own stats
  const dummy = typeof upg === 'function' ? .02 * upg('drills') : 0;
  for (const k of ['hp', 'atk', 'def', 'spd', 'spc']) m.st[k] = Math.round(m.st[k] * (1 + dummy + (typeof activeBattleBuff === 'function' ? activeBattleBuff(k) : 0)));
  m.hp = m.st.hp;
  return m;
}
const tierOf = e => Math.max(0, LEAGUES.findIndex(l => l.id === e.league));
function crewMon(e) {
  const lv = Math.max(5, myLevel() - 1), tier = Math.max(tierOf(e), tierOf(ENEMIES[unlockedUpTo()]));
  return mkMon({ key: 'c:' + e.id, name: e.name, icon: e.icon, enemy: e, types: typesOf(e), lv, base: baseFrom(enemyStats(e), e.r, e.boss ? 8 : 0), dv: 13, sx: 50, moves: genMoves(typesOf(e), tier, hashStr('crew' + e.id), BOSS_SIG[e.id]) });
}
function rivalMon(e, o = {}) {
  const r = rng(hashStr('dv' + e.id + (o.seed || ''))), tier = o.tier ?? tierOf(e), boss = !!e.boss;
  return mkMon({ key: 't:' + e.id + (o.seed || ''), name: e.name, icon: e.icon, enemy: e, boss, types: o.types || typesOf(e), lv: o.lv || lvOf(e.r), base: baseFrom(enemyStats({ bias: {}, ...e }), e.r, boss ? 12 : 0),
    dv: boss ? 15 : 6 + Math.floor(r() * 10), sx: (boss ? 40 : 12) + tier * 6, hpMul: o.hpMul, moves: genMoves(o.types || typesOf(e), tier, hashStr('mv' + e.id + (o.seed || '')), BOSS_SIG[e.id]) });
}
// who a rival brings: backup from their league, with the rival themselves going last as the ace
function rivalTeam(e, mode) {
  const tier = tierOf(e), r = rng(hashStr('team' + e.id + (mode === 'daily' ? today() : ''))), seed = e.id;
  const n = mode === 'survival' ? 1 + (battle?.wave >= 4 ? 1 : 0) + (battle?.wave >= 8 ? 1 : 0) : mode === 'wander' ? 2 + (tier >= 2 ? 1 : 0) : mode === 'daily' ? 2 : e.boss ? Math.min(6, tier + 2) : [1, 2, 2 + Math.floor(r() * 2), 3, 3 + Math.floor(r() * 2)][tier];
  const pool = ENEMIES.filter(x => !x.boss && x.id !== e.id && x.id !== e.base && x.league === (LEAGUES[tier] || LEAGUES[0]).id);
  const mates = [];
  while (mates.length < n - 1 && pool.length) mates.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  const lv = lvOf(e.r), stier = mode === 'survival' ? Math.min(4, Math.floor(battle.wave / 2)) : tier;
  const ace = rivalMon(e, { hpMul: e.mod?.id === 'tank' ? 1.4 : 1, tier: stier });
  return [...mates.map((m, k) => rivalMon(m, { lv: Math.max(5, lv - 2 - k), seed: seed + k, tier: stier })), ace];
}

// ---------- rivals for the side modes ----------
const BOSS_AI = {
  coach: { taunts: ['Is that all you\'ve got?', 'Ten more laps if you lose!', 'My nan hits harder.'], phase: { line: 'Right, NOW I\'m angry. Line up!', up: { atk: 1 } } },
  storm: { taunts: ['Too slow!', 'You can\'t catch the wind.', 'Spin cycle incoming.'], phase: { line: 'The storm gets stronger!', up: { spd: 2 } } },
  titan: { taunts: ['I am the mountain.', 'You will break first.', 'Tiny human.'], phase: { line: 'The Titan hardens into stone.', up: { def: 2 } } },
  goat: { taunts: ['I\'ve seen your moves before.', 'Greatness is a habit.', 'Nice try. Again?'], phase: { line: 'The GOAT digs deep and heals!', heal: .3 } },
  yeti: { taunts: ['RAAAWR.', '...', '*stares through you*'], phase: { line: 'The Yeti roars and the whole mountain shakes!', up: { atk: 1, def: 1 } } },
};
const RIVAL_TAUNTS = ['Let\'s go!', 'You look tired.', 'Bring it.', 'Warm-up\'s over.', 'Easy.'];
const DAILY_MODS = [
  { id: 'heavy', label: 'Heavy hitter: their team starts with +1 Attack' }, { id: 'fast', label: 'Quick feet: their team starts with +1 Speed' },
  { id: 'wall', label: 'Iron guard: their team starts with a Reflect' }, { id: 'sneaky', label: 'Sneaky: their team starts with +1 evasion' },
  { id: 'tank', label: 'Tank: their ace has 40% more HP' },
];
// the battle engine draws from brand(): Math.random normally, and a seed both
// players share in live PvP so each side works out the same turn
let bRand = Math.random;
const brand = () => bRand();
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const hashStr = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
function dailyRival() {
  const t = today(), r = rng(hashStr('daily' + t)), pool = ENEMIES.filter(e => !e.boss);
  const base = pool[Math.floor(r() * pool.length)], mod = DAILY_MODS[Math.floor(r() * DAILY_MODS.length)];
  return { ...base, id: 'daily', base: base.id, name: `${base.name} (daily)`, r: Math.min(97, athlete().ovr + 3), mod, line: `Today's challenger. ${mod.label}.`, boss: false, league: leagueOf(ENEMIES[unlockedUpTo()]).id };
}
const dailyWon = (d = today()) => (D.arena.battles || []).some(b => b.e === 'daily' && b.win && b.at.slice(0, 10) === d);
const dailyWins = () => new Set((D.arena.battles || []).filter(b => b.e === 'daily' && b.win).map(b => b.at.slice(0, 10))).size;
// a new challenger turns up every 3 days in your current arena
const WANDERERS = [
  { icon: '🤠', name: 'Drifter Dusty', bias: { end: 8, spd: 4, pow: -6 }, line: 'Rode in on a dirt bike. Wants a race.' },
  { icon: '🥋', name: 'Sensei Suki', bias: { agi: 10, str: 2, end: -6 }, line: 'Trained in the mountains for ten years.' },
  { icon: '🦸', name: 'Captain Comeback', bias: { str: 6, end: 6, spd: -6 }, line: 'Never knows when they\'re beaten.' },
  { icon: '🧛', name: 'Midnight Miler', bias: { end: 12, pow: -6 }, line: 'Only trains after dark.' },
  { icon: '🤖', name: 'RoboRunner 3000', bias: { spd: 8, pow: 6, agi: -8 }, line: 'Beep. Calculating your weaknesses.' },
  { icon: '🧙', name: 'The Wizard', bias: { agi: 8, pow: 4, str: -8 }, line: 'Nobody knows how they do it.' },
  { icon: '🐻', name: 'Grizzly Gus', bias: { str: 12, pow: 4, spd: -10 }, line: 'Wrestles bears. Allegedly.' },
  { icon: '🦊', name: 'Foxy Flash', bias: { spd: 10, agi: 6, str: -10 }, line: 'Gone before you can blink.' },
];
const wanderWindow = () => Math.floor(Date.parse(today() + 'T00:00:00Z') / 864e5 / 3);
function wanderRival() {
  const w = wanderWindow(), r = rng(hashStr('wander' + w)), base = WANDERERS[Math.floor(r() * WANDERERS.length)];
  const lg = leagueOf(ENEMIES[unlockedUpTo()]), top = Math.max(...ENEMIES.filter(e => e.league === lg.id).map(e => e.r));
  const left = 3 - (Math.floor(Date.parse(today() + 'T00:00:00Z') / 864e5) % 3);
  return { ...base, id: 'wander:' + w, league: lg.id, r: Math.min(99, top - 2), left, boss: false };
}
const wanderWon = () => (D.arena.battles || []).some(b => b.e === 'wander:' + wanderWindow() && b.win);
function survivalRival(wave) {
  const pool = ENEMIES.filter(e => !e.boss), r = rng(hashStr('wave' + wave + (battle?.seed || 0)));
  const base = pool[Math.floor(r() * pool.length)];
  return { ...base, id: 'survival', base: base.id, name: base.name, r: Math.min(99, Math.max(30, athlete().ovr - 16) + 4 * wave), boss: false };
}

// ---------- starting a battle ----------
const BAG = { water: ['🥤', 'Water bottle', 'Heals a third of max HP.'], physio: ['🩹', 'Physio tape', 'Cures any status (sleep, poison, burn, freeze, paralysis).'] };
function startBattle(id, mode = 'ladder') {
  let e, i = -1; bRand = Math.random;
  if (mode === 'daily') { if (dailyWon()) { toast('Daily challenge done', 'A new challenger turns up tomorrow.'); return; } e = dailyRival(); }
  else if (mode === 'survival') e = null;
  else if (mode === 'wander') { if (wanderWon()) { toast('Already beaten', 'A new challenger turns up soon.'); return; } e = wanderRival(); }
  else { i = ENEMIES.findIndex(x => x.id === id); if (i < 0 || i > unlockedUpTo()) return; e = ENEMIES[i]; }
  if (!tokensLeft()) {
    const price = SHOP_ITEMS.find(x => x.id === 'ticket').grit;
    if (grit() < price) { toast('No battles left today', `You get 2 a day plus 1 for each workout you tick off (up to 3). A 🎟️ Battle ticket costs ${price} ${GRIT} and you have ${grit()}.`, { timeout: 9000 }); return; }
    if (!confirm(`You've used today's battles. You get 2 a day, plus 1 for each workout you tick off.\n\nUse a Battle ticket for ${price} Grit to fight now? (You have ${grit()} Grit.)`)) return;
    buyItem('ticket');
  }
  const items = D.arena.items = D.arena.items || {};
  const boosts = Object.keys(ui.boost || {}).filter(k => ui.boost[k] && (items[k] || 0) > 0);
  boosts.forEach(k => items[k]--); ui.boost = {}; if (boosts.length) save();
  const rd = readiness();
  battle = { mode, i, turn: 0, over: false, win: false, busy: true, boosts, wave: 1, seed: Date.now() % 100000, ready: rd, bag: { water: 2, physio: 1 }, menu: '', moved: new Set() };
  const B = battle;
  if (mode === 'survival') e = survivalRival(1);
  B.e = e;
  const them = rivalTeam(e, mode), size = mode === 'survival' ? 3 : Math.max(1, them.length);
  const mine = [myMon(1 + rd.hp / 100), ...crewTeam().map(id => crewMon(ENEMIES.find(x => x.id === id)))].slice(0, size);
  B.sides = { me: { team: mine, cur: 0 }, them: { team: them, cur: 0 } };
  for (const m of mine) m.side = 'me'; for (const m of them) m.side = 'them';
  B.ai = BOSS_AI[e.id] || {};
  openBattleFx();
  intro();
}
// the battle overlay: built once per battle, clicks go to battleAct
function openBattleFx() {
  let ov = document.getElementById('battlefx');
  if (!ov) { ov = document.createElement('div'); ov.id = 'battlefx'; ov.className = 'treefx'; document.body.appendChild(ov); }
  ov.onclick = ev => {
    if (ev.target.closest('#bText') && !ev.target.closest('[data-bm]')) { battle?.skip?.(); return; }
    const b = ev.target.closest('[data-bm]'); if (!b) return;
    if (b.dataset.bm === 'close') {
      const started = battle && !battle.over && (battle.turn || battle.pvp);
      if (started && !confirm('Leave this battle? It counts as a loss.')) return;
      if (started) finishBattle(false);
      bRand = Math.random;
      ov.remove(); battle = null; document.removeEventListener('keydown', battleKey); render(); return;
    }
    battleAct(b.dataset.bm);
  };
  document.addEventListener('keydown', battleKey);
  drawStage(); drawPanels(); drawControls();
}
async function intro() {
  const B = battle, e = B.e;
  banner(B.mode === 'survival' ? 'SURVIVAL: WAVE 1' : e.boss ? `👑 GYM LEADER: ${e.name}` : B.mode === 'daily' ? '📅 DAILY CHALLENGE' : B.mode === 'wander' ? `🆕 ${e.name.toUpperCase()} APPEARS!` : 'BATTLE!', e.boss || B.mode !== 'ladder' ? 'boss' : '');
  const them = B.sides.them.team, taunts = B.ai.taunts || RIVAL_TAUNTS;
  await say(`${e.icon} ${e.name} wants to battle!${them.length > 1 ? ` They brought a team of ${them.length}.` : ''}`);
  if (B.ai.taunts || Math.random() < .5) await say(`${e.name}: "${taunts[Math.floor(Math.random() * taunts.length)]}"`);
  if (e.mod) await say(`Daily twist: ${e.mod.label}.`);
  await sendIn('them', 0); await sendIn('me', 0);
  const me = cur('me');
  if (B.boosts.includes('drink')) await statChange(me, { atk: 1 }, '⚡ Energy drink: ');
  if (B.boosts.includes('charm')) { me.vol.focus = 1; drawPanels(); await say(`🍀 Lucky charm: ${nm(me)} is focused. Critical hits are more likely.`); }
  if (B.boosts.includes('guard')) { me.vol.reflect = 1; drawPanels(); await say(`🦷 Mouthguard: ${nm(me)} is protected by a Reflect.`); }
  B.busy = false; drawControls();
}
function battleKey(ev) {
  const B = battle; if (!B || B.over) return;
  if (ev.code === 'Space' || ev.code === 'Enter') { if (B.skip) { ev.preventDefault(); B.skip(); } }
  else if (!B.busy && /^Digit[1-4]$/.test(ev.code) && B.menu === 'fight') battleAct('m:' + (+ev.code.slice(5) - 1));
}

// ---------- state helpers ----------
const cur = side => battle.sides[side].team[battle.sides[side].cur];
const other = side => side === 'me' ? 'them' : 'me';
const nm = m => m.side === 'them' ? `Rival ${m.name}` : m.name;
const alive = side => battle.sides[side].team.filter(m => m.hp > 0);
const speedOf = m => m.st.spd * stageMul(m.stg.spd) * (m.status === 'par' ? .25 : 1);
const forcedMove = m => m.vol.recharge ? { id: 'recharge', icon: '😮‍💨', name: 'Catch breath' } : m.vol.charging ? moveById(m.vol.charging) : null;
const usable = m => m.moves.filter(x => x.pp > 0);

// ---------- drawing ----------
function monSprite(m) {
  if (m.ath && m.side === 'them') { try { return m.av ? avatarFull(m.av, { size: 170 }) : '<span class="esprite">🧍</span>'; } catch { return '<span class="esprite">🧍</span>'; } }
  return m.ath ? `${avatarFull(avatarSpec(), { size: 170 })}${petHtml(myAv().pet, 40)}` : `<span class="esprite">${m.icon}</span>`;
}
function drawStage() {
  const B = battle, e = B.e, lg = leagueOf(e) || LEAGUES[B.mode === 'survival' ? 3 : 2], ov = document.getElementById('battlefx');
  ov.innerHTML = `<div class="treecard battlecard gb"><button class="iconbtn tc-close" data-bm="close" title="Leave">✕</button>
    <div class="bstage" style="--sky:${lg.sky};--ground:${lg.ground}">
      <div class="crowd"></div><div class="lights"><i></i><i></i><i></i><i></i></div><div class="ground"></div>
      <div class="fighter me" style="--dir:1" id="fMe"><div class="fbox"></div><div class="fshadow"></div><div class="callout" id="cMe"></div></div>
      <div class="fighter them ${e.boss ? 'boss' : ''}" style="--dir:-1" id="fThem"><div class="fbox"></div><div class="fshadow"></div><div class="callout" id="cThem"></div></div>
      <div class="gbpanel them" id="pThem"></div><div class="gbpanel me" id="pMe"></div>
      <div class="bwhere">${B.mode === 'pvp' ? '🌐 Live PvP' : B.mode === 'ghost' ? '👻 Saved team' : B.mode === 'survival' ? '🌊 Survival' : B.mode === 'daily' ? '📅 Daily challenge' : B.mode === 'wander' ? '🆕 New challenger' : esc(lg.icon + ' ' + lg.name)}</div>
      <div class="bfx" id="bfx"></div><div class="bbanner" id="bBanner"></div>
    </div>
    <div class="gbbottom"><div class="gbtext" id="bText" title="Click or press Space to skip"></div><div class="gbmenu" id="bControls"></div></div>
    <details class="blogwrap"><summary>Battle log</summary><div class="blog" id="bLog"></div></details></div>`;
}
function drawPanels() {
  const B = battle; if (!B) return;
  for (const side of ['me', 'them']) {
    const el = document.getElementById(side === 'me' ? 'pMe' : 'pThem'), m = cur(side); if (!el || !m) continue;
    const p = Math.max(0, m.hp) / m.st.hp * 100, col = p > 50 ? '#40c057' : p > 20 ? '#fab005' : '#e03131';
    const balls = B.sides[side].team.map(x => `<i class="${x.hp <= 0 ? 'out' : x.status ? 'st' : ''}" title="${esc(x.name)}"></i>`).join('');
    const tags = [m.status && `<span class="ctag" style="--c:${COND[m.status][2]}">${COND[m.status][0]} ${COND[m.status][1]}</span>`, m.vol.conf && '<span class="ctag" style="--c:#e64980">😵‍💫 Confused</span>', m.vol.leech && '<span class="ctag" style="--c:#37b24d">🪴 Seeded</span>',
      m.vol.reflect && '<span class="ctag" style="--c:#4dabf7">🧱 Reflect</span>', m.vol.light && '<span class="ctag" style="--c:#cc5de8">🛡️ Screen</span>', m.vol.sub && '<span class="ctag" style="--c:#868e96">🎭 Decoy</span>', m.vol.focus && '<span class="ctag" style="--c:#7048e8">🎯 Focused</span>', m.vol.bound && '<span class="ctag" style="--c:#c92a2a">🤼 Held</span>',
      ...Object.entries(m.stg).filter(([, v]) => v).map(([k, v]) => `<span class="ctag stg ${v > 0 ? 'up' : 'down'}">${STAT_NAME[k].slice(0, 3)} ${v > 0 ? '+' : ''}${v}</span>`)].filter(Boolean).join('');
    el.innerHTML = `<div class="gbname"><b>${m.boss ? '👑 ' : ''}${esc(m.name)}</b><span class="gblv">Lv${m.lv}</span></div><div class="gbtypes">${typeChips(m.types)}</div>
      <div class="gbhp"><span>HP</span><div class="hpbar"><i style="width:${p}%;background:${col}"></i></div></div>${side === 'me' ? `<div class="gbnum">${Math.max(0, m.hp)} / ${m.st.hp}</div>` : ''}
      <div class="gbtags">${tags}</div><div class="gbballs">${balls}</div>`;
    const f = document.getElementById(side === 'me' ? 'fMe' : 'fThem');
    if (f && f.dataset.k !== m.key) { f.dataset.k = m.key; f.querySelector('.fbox').innerHTML = monSprite(m); f.classList.toggle('boss', !!m.boss); }
  }
}
const hud = drawPanels; // older callers
const logLine = html => document.getElementById('bLog')?.insertAdjacentHTML('afterbegin', `<div>${html}</div>`);
function drawControls() {
  const B = battle, el = document.getElementById('bControls'); if (!el) return;
  const box = document.getElementById('bText');
  if (B.over) { el.innerHTML = ''; if (box) box.innerHTML = resultHtml(); document.querySelector('#battlefx .gbbottom')?.classList.add('done'); return; }
  const me = cur('me');
  if (B.busy) { el.innerHTML = '<div class="gbwait"><i></i><i></i><i></i></div>'; return; }
  if (B.prompt === 'faint' || B.menu === 'crew') {
    const forced = B.prompt === 'faint';
    if (box) box.innerHTML = forced ? 'Who goes in next?' : 'Who do you want to swap in? It uses your turn.';
    el.innerHTML = `<div class="gbcrew">${B.sides.me.team.map((m, k) => `<button class="gbmon" data-bm="go:${k}" ${m.hp <= 0 || k === B.sides.me.cur ? 'disabled' : ''}>
      <span class="gbmic">${m.ath ? '🧍' : m.icon}</span><span class="main"><b>${esc(m.name)} <small>Lv${m.lv}</small></b><span class="gbmt">${typeChips(m.types)}</span><span class="hpbar sm"><i style="width:${Math.max(0, m.hp) / m.st.hp * 100}%"></i></span><small>${m.hp <= 0 ? 'Fainted' : `${m.hp}/${m.st.hp}${m.status ? ' · ' + COND[m.status][1] : ''}`}${k === B.sides.me.cur ? ' · out now' : ''}</small></span></button>`).join('')}</div>
      ${forced ? '' : '<button class="btn small gbback" data-bm="back">← Back</button>'}`;
    return;
  }
  const f = forcedMove(me);
  if (f) { if (box) box.innerHTML = `<b>${esc(me.name)}</b> ${f.id === 'recharge' ? 'needs to catch their breath.' : `is mid-${esc(f.name)}!`}`; el.innerHTML = `<button class="btn primary big gbcont" data-bm="cont">${f.icon} ${esc(f.name)} ▶</button>`; return; }
  if (box) box.innerHTML = `What will <b>${esc(me.name)}</b> do?`;
  if (B.menu === 'fight') {
    const foe = cur('them'), list = usable(me);
    el.innerHTML = `<div class="gbmoves">${me.moves.map((x, k) => { const m = moveById(x.id), ef = m.pow ? typeEff(m.type, foe.types) : 1;
      return `<button class="gbmove" data-bm="m:${k}" ${x.pp > 0 ? '' : 'disabled'} style="--sc:${TYPES[m.type][2]}" title="${esc(m.note)}"><span class="gbmi">${m.icon}</span><b>${esc(m.name)}</b>
        <small>${TYPES[m.type][1]} · ${m.fixed ? 'fixed dmg' : m.pow ? 'Pow ' + m.pow : 'Status'}${m.acc != null && m.acc < 100 ? ` · ${m.acc}%` : ''}</small><em class="gbpp ${x.pp <= x.max / 4 ? 'low' : ''}">PP ${x.pp}/${x.max}</em>
        ${ef > 1 ? '<em class="effx super">▲ super effective</em>' : ef === 0 ? '<em class="effx weak">✕ no effect</em>' : ef < 1 ? '<em class="effx weak">▼ not very effective</em>' : me.types.includes(m.type) && m.pow ? '<em class="effx stab">★ your type</em>' : ''}</button>`; }).join('')}
      ${list.length ? '' : '<button class="gbmove" data-bm="m:struggle"><span class="gbmi">😤</span><b>Struggle</b><small>Out of PP</small></button>'}</div><button class="btn small gbback" data-bm="back">← Back</button>`;
    return;
  }
  if (B.menu === 'bag') {
    el.innerHTML = `<div class="gbbag">${Object.entries(BAG).map(([k, [ic, n, t]]) => `<button class="gbitem" data-bm="item:${k}" ${B.bag[k] > 0 ? '' : 'disabled'}><span>${ic}</span><b>${n} ×${B.bag[k]}</b><small>${t}</small></button>`).join('')}</div><button class="btn small gbback" data-bm="back">← Back</button>`;
    return;
  }
  el.innerHTML = `<div class="gbmain"><button class="gbbtn fight" data-bm="menu:fight">⚔️ FIGHT</button><button class="gbbtn crew" data-bm="menu:crew" ${alive('me').length > 1 && !me.vol.bound ? '' : 'disabled'}>🤝 CREW</button>
    <button class="gbbtn bag" data-bm="menu:bag">🎒 BAG</button><button class="gbbtn run" data-bm="run">🏳️ GIVE UP</button></div>`;
}

// ---------- the text box ----------
// each message waits a moment (or a click / Space) before the next
function say(text, ms) {
  const B = battle; if (!B) return Promise.resolve();
  const t = document.getElementById('bText'); if (t) t.innerHTML = `<span class="gbtype">${esc(text)}</span><i class="gbnext">▼</i>`;
  logLine(esc(text));
  const wait = (ms ?? Math.min(2200, 650 + text.length * 16)) * (B.speed || 1);
  return new Promise(res => { const done = () => { clearTimeout(id); if (B.skip === done) B.skip = null; res(); }; const id = setTimeout(done, wait); B.skip = done; });
}

// ---------- animation: 3D when it's on (b3d.js), simple 2D otherwise ----------
let b3Anim = null;
async function play(side, kind, data = {}) {
  if (typeof battleSfx === 'function') try { battleSfx(side, kind, data); } catch (e) { }
  if (b3Anim) { try { const r = b3Anim(side, kind, data); if (r !== false) return await r; } catch (e) { console.error(e); } }
  const f = document.getElementById(side === 'me' ? 'fMe' : 'fThem'), stage = document.querySelector('#battlefx .bstage'); if (!f) return;
  const flash = async (cls, ms) => { f.classList.add(cls); await sleep(ms * (battle?.speed || 1)); f.classList.remove(cls); };
  if (kind === 'send') { f.classList.remove('ko', 'gone'); return flash('enter', 600); }
  if (kind === 'recall' || kind === 'charge') { f.classList.add('gone'); return sleep(350); }
  if (kind === 'land') { f.classList.remove('gone'); return sleep(150); }
  if (kind === 'faint') { f.classList.add('ko'); return sleep(800); }
  if (kind === 'move') {
    const m = data.move; if (!isDmg(m)) return flash('sp-pump', 600);
    projectile(side, m); f.classList.add('atk', SPECIAL_TYPES.has(m.type) ? 'atk-agi' : 'atk-str'); await sleep(450); f.classList.remove('atk', 'atk-agi', 'atk-str'); return;
  }
  if (kind === 'hit') { burst(side, TYPES[data.type]?.[2] || '#ffd43b'); if (data.dmg) fxAt(side, `-${data.dmg}`, 'dmgnum' + (data.eff > 1 || data.crit ? ' big' : '')); if (data.eff > 1 || data.crit) stage?.classList.add('shake'); await flash('hit', 420); stage?.classList.remove('shake'); return; }
  if (kind === 'miss') { fxAt(side, 'MISS', 'dmgnum'); return flash('wobble', 450); }
  if (kind === 'heal') { fxAt(side, `+${data.amt || ''}`, 'dmgnum heal'); return flash('sp-wind', 500); }
  if (kind === 'status') { fxAt(side, COND[data.st]?.[0] || '❗', 'stpop'); return sleep(350); }
  if (kind === 'stat') { fxAt(side, data.up ? '⬆️' : '⬇️', 'stpop'); return sleep(350); }
  if (kind === 'win') { f.classList.add('dance-d_jump'); return sleep(600); }
}
function projectile(from, m) {
  const st = document.querySelector('#battlefx .bstage'), a = document.getElementById(from === 'me' ? 'fMe' : 'fThem'), b = document.getElementById(from === 'me' ? 'fThem' : 'fMe');
  if (!st || !a || !b) return;
  const sr = st.getBoundingClientRect(), ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'proj'; p.textContent = m.icon;
  p.style.setProperty('--sx', (ar.left - sr.left + ar.width / 2) + 'px'); p.style.setProperty('--ex', (br.left - sr.left + br.width / 2) + 'px');
  p.style.setProperty('--y', (ar.top - sr.top + ar.height * .45) + 'px'); p.style.setProperty('--c', TYPES[m.type][2]); p.style.setProperty('--flip', from === 'me' ? 1 : -1);
  document.getElementById('bfx')?.appendChild(p); setTimeout(() => p.remove(), 900);
}

// ---------- a turn ----------
async function battleAct(code) {
  const B = battle; if (!B || B.over || B.busy) return;
  const [k, v] = code.split(':');
  if (k === 'menu') { B.menu = v; drawControls(); return; }
  if (k === 'back') { B.menu = ''; drawControls(); return; }
  if (k === 'run') {
    if (!confirm(B.mode === 'survival' ? 'End your Survival run here?' : 'Give up this battle? It counts as a loss.')) return;
    if (B.pvp) { B.pvp.send({ t: 'forfeit' }); B.over || (await endBattle(false)); return; }
    B.busy = true; drawControls(); await say(`${B.sides.me.team[0].name} called it a day.`, 900); await endBattle(false); return;
  }
  const me = cur('me');
  if (k === 'go') {
    const to = +v, m = B.sides.me.team[to]; if (!m || m.hp <= 0 || to === B.sides.me.cur) return;
    if (B.prompt === 'faint' && B.pickRes) { const r = B.pickRes; B.pickRes = null; r(to); return; }
    if (B.prompt === 'faint') { B.prompt = ''; B.busy = true; drawControls(); await sendIn('me', to); B.busy = false; B.menu = ''; drawControls(); return; }
    return runTurn({ kind: 'switch', to });
  }
  if (k === 'item') { if (!(B.bag[v] > 0)) return; return runTurn({ kind: 'item', id: v }); }
  if (k === 'cont') { const f = forcedMove(me); if (f) return runTurn({ kind: 'move', mv: f }); return; }
  if (k === 'm') {
    if (v === 'struggle') { if (usable(me).length) return; return runTurn({ kind: 'move', mv: moveById('struggle') }); }
    const slot = me.moves[+v]; if (!slot || slot.pp <= 0) return;
    return runTurn({ kind: 'move', mv: moveById(slot.id) });
  }
}
async function runTurn(mine) {
  const B = battle; B.busy = true; B.menu = ''; B.turn++; B.moved = new Set(); drawControls();
  const theirs = B.pvp ? await B.pvp.exchange(mine) : aiAct();
  if (battle !== B || B.over) return;
  const acts = [{ side: 'me', ...mine }, { side: 'them', ...theirs }];
  const pri = a => a.kind !== 'move' ? 10 : (a.mv.pri || 0), coin = brand();
  // speed ties: a coin flip, read the same way round by both players in PvP
  const tie = (a, b) => B.pvp ? (B.pvp.rank(a.side) - B.pvp.rank(b.side)) * (coin < .5 ? 1 : -1) : coin - .5;
  acts.sort((a, b) => pri(b) - pri(a) || speedOf(cur(b.side)) - speedOf(cur(a.side)) || tie(a, b));
  for (const a of acts) {
    if (B.over) break;
    const m = cur(a.side); if (m.hp <= 0) continue;
    if (a.kind === 'switch') await doSwitch(a.side, a.to);
    else if (a.kind === 'item') await useItem(a.side, a.id);
    else await doMove(a.side, a.mv);
    B.moved.add(a.side);
    if (cur('me').hp <= 0 || cur('them').hp <= 0) break;
  }
  if (!B.over && cur('me').hp > 0 && cur('them').hp > 0) await residuals();
  for (const s of ['me', 'them']) cur(s).vol.flinch = 0;
  if (!B.over) await checkFaints();
  if (!B.over && B.turn >= 80) { await say('The ref calls time!'); const pct = s => B.sides[s].team.reduce((a, m) => a + Math.max(0, m.hp) / m.st.hp, 0); await endBattle(pct('me') > pct('them') || (pct('me') === pct('them') && (!B.pvp || B.pvp.rank('me') === 0))); return; }
  if (!B.over && B.prompt !== 'faint') { B.busy = false; drawPanels(); drawControls(); }
}
async function doSwitch(side, to) {
  const B = battle, out = cur(side);
  await say(side === 'me' ? `${out.name}, come back!` : `${B.e.name} swaps out ${out.name}!`, 900);
  await play(side, 'recall'); clearVolatile(out);
  await sendIn(side, to);
}
function clearVolatile(m) { m.vol = {}; m.stg = { atk: 0, def: 0, spd: 0, spc: 0, acc: 0, eva: 0 }; if (m.status === 'tox') m.status = 'psn'; m.toxN = 0; }
async function sendIn(side, idx) {
  const B = battle; B.sides[side].cur = idx; const m = cur(side);
  drawPanels();
  const p = play(side, 'send', { mon: m });
  await say(side === 'me' ? (m.ath ? `Let's go, ${m.name}!` : `Go! ${m.name}!`) : m.ath ? `${m.name} steps up!` : `${B.e.name} sends out ${m.name}!`);
  await p;
  if (side === 'them' && B.e.mod) {
    const id = B.e.mod.id;
    if (id === 'heavy') m.stg.atk = 1; else if (id === 'fast') m.stg.spd = 1; else if (id === 'sneaky') m.stg.eva = 1; else if (id === 'wall') m.vol.reflect = 1;
    drawPanels();
  }
}
async function useItem(side, id) {
  const B = battle, m = cur(side); if (side === 'me') B.bag[id]--; else if (B.bagThem) B.bagThem[id]--;
  if (id === 'water') { const amt = Math.min(m.st.hp - m.hp, Math.ceil(m.st.hp / 3)); m.hp += amt; await say(`${nm(m)} drinks a 🥤 water bottle.`); await play(side, 'heal', { amt }); drawPanels(); await say(amt ? `${nm(m)} got back ${amt} HP.` : 'It had no effect.'); }
  else { const had = m.status; m.status = null; m.slp = 0; m.toxN = 0; await say(`${nm(m)} gets 🩹 physio tape.`); drawPanels(); await say(had ? `${nm(m)} is no longer ${COND[had][1].toLowerCase()}!` : 'It had no effect.'); }
}

// ---------- moves ----------
function calcDamage(a, d, m) {
  const eff = typeEff(m.type, d.types);
  if (m.fixed) return { dmg: m.fixed === 'lv' ? a.lv : m.fixed, eff: 1, crit: false, fixed: true };
  if (!eff) return { dmg: 0, eff: 0, crit: false };
  const special = SPECIAL_TYPES.has(m.type);
  let T = Math.floor(a.base.spd / 4); if (a.vol.focus) T *= 4; if (m.crit) T *= 8; T = Math.min(255, T);
  const crit = Math.floor(brand() * 256) < T;
  const ak = special ? 'spc' : 'atk', dk = special ? 'spc' : 'def';
  let A = a.st[ak], Dd = d.st[dk];
  if (!crit) { // critical hits ignore stat changes, burns and screens
    A = Math.floor(A * stageMul(a.stg[ak])); Dd = Math.floor(Dd * stageMul(d.stg[dk]));
    if (!special && a.status === 'brn') A = Math.floor(A / 2);
    if ((!special && d.vol.reflect) || (special && d.vol.light)) Dd *= 2;
  }
  if (m.explode) Dd = Math.floor(Dd / 2);
  if (A > 255 || Dd > 255) { A = Math.floor(A / 4); Dd = Math.floor(Dd / 4); }
  A = Math.max(1, A); Dd = Math.max(1, Dd);
  const L = a.lv * (crit ? 2 : 1);
  let dmg = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * m.pow * A / Dd) / 50) + 2;
  if (a.types.includes(m.type)) dmg = Math.floor(dmg * 1.5);
  for (const t of d.types) dmg = Math.floor(dmg * (CHART[m.type]?.[t] ?? 1));
  dmg = Math.floor(dmg * (217 + Math.floor(brand() * 39)) / 255);
  return { dmg: Math.max(1, dmg), eff, crit };
}
function hits(a, d, m) {
  if (m.acc == null) return true;
  const t = Math.floor(Math.floor(m.acc * 255 / 100) * stageMul(a.stg.acc) / stageMul(d.stg.eva));
  return Math.floor(brand() * 256) < clamp(t, 1, 255); // even 100% moves miss 1 time in 256, like the original
}
async function doMove(side, m) {
  const B = battle, a = cur(side), d = cur(other(side)), os = other(side);
  // can they act at all?
  if (m.id === 'recharge') { a.vol.recharge = 0; await say(`${nm(a)} is catching their breath!`); return; }
  if (a.status === 'slp') {
    if (--a.slp > 0) { await play(side, 'status', { st: 'slp' }); await say(`${nm(a)} is fast asleep.`); a.vol.charging = 0; return; }
    a.status = null; drawPanels(); await say(`${nm(a)} woke up!`);
  }
  if (a.status === 'frz') {
    if (brand() < .1) { a.status = null; drawPanels(); await say(`${nm(a)} thawed out!`); }
    else { await play(side, 'status', { st: 'frz' }); await say(`${nm(a)} is frozen solid!`); a.vol.charging = 0; return; }
  }
  if (a.vol.flinch) { a.vol.flinch = 0; await say(`${nm(a)} flinched!`); a.vol.charging = 0; return; }
  if (a.vol.conf) {
    if (--a.vol.conf <= 0) { a.vol.conf = 0; drawPanels(); await say(`${nm(a)} snapped out of it!`); }
    else {
      await play(side, 'status', { st: 'conf' }); await say(`${nm(a)} is confused!`);
      if (brand() < .5) { const self = calcDamage(a, a, { type: 'none', pow: 40 }); a.hp = Math.max(0, a.hp - self.dmg); await play(side, 'hit', { type: 'normal', dmg: self.dmg }); drawPanels(); await say('It hurt itself in its confusion!'); a.vol.charging = 0; return; }
    }
  }
  if (a.status === 'par' && brand() < .25) { await play(side, 'status', { st: 'par' }); await say(`${nm(a)} is fully paralysed!`); a.vol.charging = 0; return; }
  // two-turn moves: the first turn is the wind-up
  if (m.charge && a.vol.charging !== m.id) {
    usePP(a, m); a.vol.charging = m.id; drawPanels();
    await say(`${nm(a)} used ${m.name}!`, 700);
    await play(side, 'charge', { kind: m.charge, move: m });
    await say(m.charge === 'fly' ? `${nm(a)} leapt sky-high!` : `${nm(a)} dug in underground!`); return;
  }
  const second = !!(m.charge && a.vol.charging === m.id);
  if (second) a.vol.charging = 0; else usePP(a, m);
  if (!second) await say(`${nm(a)} used ${m.name}!`, 700);
  const foeTarget = isDmg(m) || m.inflict || m.foe;
  // they're up in the air or underground, or it just misses
  if (foeTarget && (d.vol.charging || !hits(a, d, m))) {
    await play(side, 'move', { move: m, target: os, miss: true }); await play(os, 'miss');
    await say(d.vol.charging ? `${nm(d)} is out of reach!` : `${nm(a)}'s attack missed!`);
    if (m.explode) { a.hp = 0; drawPanels(); }
    return;
  }
  if (!isDmg(m)) return statusMove(side, a, d, m);
  // damage
  let total = 0, n = 1, res = null, broke = false;
  if (m.counter) {
    const lt = a.vol.lastTaken;
    if (!lt || lt.turn !== B.turn || !['normal', 'combat'].includes(lt.type) || !lt.dmg) { await say('But it failed!'); return; }
    res = { dmg: lt.dmg * 2, eff: 1, crit: false, fixed: true };
  }
  if (m.hits) { const r = brand(); n = r < .375 ? 2 : r < .75 ? 3 : r < .875 ? 4 : 5; }
  await play(side, 'move', { move: m, target: os, second });
  for (let k = 0; k < n; k++) {
    const r = res || calcDamage(a, d, m);
    if (r.eff === 0) { await say(`It doesn't affect ${nm(d)}…`); return; }
    const dmg = Math.min(r.dmg, d.vol.sub ? d.vol.sub : d.hp);
    if (d.vol.sub) { d.vol.sub -= dmg; if (d.vol.sub <= 0) { d.vol.sub = 0; broke = true; } }
    else { d.hp -= dmg; d.vol.lastTaken = { dmg, type: m.type, turn: B.turn }; }
    total += dmg;
    await play(os, 'hit', { type: m.type, dmg, eff: r.eff, crit: r.crit, sub: !!d.vol.sub || broke, move: m, n: k });
    drawPanels();
    if (r.crit) await say('A critical hit!', 800);
    if (k === 0 && !r.fixed && r.eff > 1) await say('It\'s super effective!', 900);
    if (k === 0 && !r.fixed && r.eff < 1) await say('It\'s not very effective…', 900);
    if (broke) { await say(`${nm(d)}'s decoy fell apart!`); break; }
    if (d.hp <= 0) break;
    if (k < n - 1) await play(side, 'move', { move: m, target: os, again: true });
  }
  if (n > 1) await say(`Hit ${n} times!`, 800);
  // after-effects
  if (m.type === 'fire' && d.status === 'frz' && d.hp > 0) { d.status = null; drawPanels(); await say(`${nm(d)} thawed out!`); }
  if (m.drain && total) { const h = Math.min(a.st.hp - a.hp, Math.max(1, Math.floor(total / 2))); a.hp += h; await play(side, 'heal', { amt: h }); drawPanels(); await say(`${nm(d)} had its energy drained!`); }
  if (m.recoil && total) { const rc = Math.max(1, Math.floor(total * m.recoil)); a.hp = Math.max(0, a.hp - rc); await play(side, 'hit', { type: 'normal', dmg: rc, recoil: true }); drawPanels(); await say(`${nm(a)} is hurt by the effort!`); }
  if (m.explode) { a.hp = 0; drawPanels(); }
  if (m.recharge && d.hp > 0) a.vol.recharge = 1;
  if (m.wrap && d.hp > 0 && !d.vol.bound && !broke && !d.vol.sub) { d.vol.bound = 2 + Math.floor(brand() * 4); drawPanels(); await say(`${nm(d)} is caught in a headlock!`); }
  if (m.sec && d.hp > 0 && !d.vol.sub && !broke && brand() * 100 < m.sec.ch) {
    if (m.sec.st === 'flinch') { if (!B.moved.has(os)) d.vol.flinch = 1; }
    else if (m.sec.st) await inflict(d, m.sec.st, true);
    if (m.sec.foe) await statChange(d, m.sec.foe);
  }
  await bossPhase(d);
}
function usePP(a, m) { const s = a.moves.find(x => x.id === m.id); if (s && s.pp > 0) s.pp--; }
async function statusMove(side, a, d, m) {
  const os = other(side);
  if ((m.inflict || m.foe) && d.vol.sub) { await say('But it failed!'); return; }
  if (m.inflict === 'par' && typeEff(m.type, d.types) === 0) { await say(`It doesn't affect ${nm(d)}…`); return; }
  await play(side, 'move', { move: m, target: m.inflict || m.foe ? os : side });
  if (m.self) return statChange(a, m.self);
  if (m.foe) return statChange(d, m.foe);
  if (m.inflict === 'conf') { if (d.vol.conf) { await say(`${nm(d)} is already confused!`); return; } d.vol.conf = 2 + Math.floor(brand() * 4); drawPanels(); await play(os, 'status', { st: 'conf' }); await say(`${nm(d)} became confused!`); return; }
  if (m.inflict === 'leech') { if (d.types.includes('nature') || d.vol.leech) { await say(`${nm(d)} can't be seeded!`); return; } d.vol.leech = 1; drawPanels(); await play(os, 'status', { st: 'leech' }); await say(`${nm(d)} was seeded!`); return; }
  if (m.inflict) { if (!(await inflict(d, m.inflict, false))) await say('But it failed!'); return; }
  if (m.heal) { if (a.hp >= a.st.hp) { await say('But it failed!'); return; } const h = Math.min(a.st.hp - a.hp, Math.floor(a.st.hp * m.heal)); a.hp += h; await play(side, 'heal', { amt: h }); drawPanels(); await say(`${nm(a)} got their second wind!`); return; }
  if (m.rest) { if (a.hp >= a.st.hp) { await say('But it failed!'); return; } const h = a.st.hp - a.hp; a.hp = a.st.hp; a.status = 'slp'; a.slp = 3; a.toxN = 0; await play(side, 'heal', { amt: h }); drawPanels(); await say(`${nm(a)} hopped in the ice bath and nodded off… fully healed!`); return; }
  if (m.screen) { const k = m.screen === 'reflect' ? 'reflect' : 'light'; if (a.vol[k]) { await say('But it failed!'); return; } a.vol[k] = 1; drawPanels(); await say(k === 'reflect' ? `${nm(a)} is braced against physical hits!` : `${nm(a)} is shielded from special hits!`); return; }
  if (m.focus) { if (a.vol.focus) { await say('But it failed!'); return; } a.vol.focus = 1; drawPanels(); await say(`${nm(a)} is locked in!`); return; }
  if (m.sub) { const c = Math.floor(a.st.hp / 4); if (a.vol.sub || a.hp <= c) { await say('But it failed!'); return; } a.hp -= c; a.vol.sub = c + 1; drawPanels(); await say(`${nm(a)} set up a decoy!`); return; }
  if (m.haze) { for (const x of [a, d]) { x.stg = { atk: 0, def: 0, spd: 0, spc: 0, acc: 0, eva: 0 }; delete x.vol.conf; delete x.vol.leech; delete x.vol.focus; delete x.vol.reflect; delete x.vol.light; } drawPanels(); await say('All stat changes were wiped away!'); }
}
async function inflict(d, st, secondary) {
  if (d.status) { if (!secondary) await say(`${nm(d)} is already ${COND[d.status][1].toLowerCase()}!`); return true; }
  const immune = (st === 'brn' && d.types.includes('fire')) || (st === 'frz' && d.types.includes('frost')) || ((st === 'psn' || st === 'tox') && d.types.includes('toxic'));
  if (immune) return false;
  d.status = st; d.slp = st === 'slp' ? 1 + Math.ceil(brand() * 3) : 0; d.toxN = 0; d.vol.charging = 0;
  drawPanels(); await play(d.side, 'status', { st });
  await say(`${nm(d)} ${{ par: 'is paralysed! It may not be able to move', brn: 'was burned', frz: 'was frozen solid', psn: 'was poisoned', tox: 'was badly poisoned', slp: 'fell asleep' }[st]}!`);
  return true;
}
async function statChange(m, ch, pre = '') {
  for (const [k, v] of Object.entries(ch)) {
    const was = m.stg[k];
    if ((v > 0 && was >= 6) || (v < 0 && was <= -6)) { await say(`${pre}${nm(m)}'s ${STAT_NAME[k]} won't go any ${v > 0 ? 'higher' : 'lower'}!`); continue; }
    m.stg[k] = clamp(was + v, -6, 6); drawPanels();
    await play(m.side, 'stat', { up: v > 0, stat: k });
    await say(`${pre}${nm(m)}'s ${STAT_NAME[k]} ${v > 0 ? (v > 1 ? 'sharply rose' : 'rose') : (v < -1 ? 'harshly fell' : 'fell')}!`);
  }
}
async function bossPhase(m) {
  const B = battle, P = B.ai.phase;
  if (!P || !m.boss || m.side !== 'them' || m.hp <= 0 || B.phased || m.hp / m.st.hp > .4) return;
  B.phased = true; banner('PHASE 2', 'boss'); document.getElementById('fThem')?.classList.add('phase2');
  await play('them', 'phase'); await say(`${m.name}: "${P.line}"`, 1800);
  if (P.heal) { const h = Math.floor(m.st.hp * P.heal); m.hp = Math.min(m.st.hp, m.hp + h); await play('them', 'heal', { amt: h }); drawPanels(); }
  if (P.up) await statChange(m, P.up);
}
async function residuals() {
  const B = battle;
  for (const side of ['me', 'them']) {
    const m = cur(side), o = cur(other(side)); if (m.hp <= 0 || B.over) continue;
    const sixteenth = Math.max(1, Math.floor(m.st.hp / 16));
    if (m.status === 'brn' || m.status === 'psn' || m.status === 'tox') {
      const dmg = Math.min(m.hp, m.status === 'tox' ? sixteenth * ++m.toxN : sixteenth);
      m.hp -= dmg; await play(side, 'hit', { type: m.status === 'brn' ? 'fire' : 'toxic', dmg, dot: true }); drawPanels();
      await say(`${nm(m)} is hurt by ${m.status === 'brn' ? 'its burn' : 'poison'}!`, 900);
    }
    if (m.hp > 0 && m.vol.leech && o.hp > 0) {
      const dmg = Math.min(m.hp, sixteenth); m.hp -= dmg; o.hp = Math.min(o.st.hp, o.hp + dmg); await play(side, 'hit', { type: 'nature', dmg, dot: true }); drawPanels();
      await say(`${nm(m)}'s energy is sapped!`, 900);
    }
    if (m.hp > 0 && m.vol.bound) {
      const dmg = Math.min(m.hp, sixteenth); m.hp -= dmg; m.vol.bound--; await play(side, 'hit', { type: 'normal', dmg, dot: true }); drawPanels();
      await say(m.vol.bound ? `${nm(m)} is stuck in the headlock!` : `${nm(m)} broke free!`, 900);
    }
  }
}
async function checkFaints() {
  const B = battle;
  for (const side of ['them', 'me']) {
    const m = cur(side); if (m.hp > 0 || m.fainted) continue;
    m.fainted = true; m.status = null; m.vol = {}; await play(side, 'faint'); drawPanels(); await say(`${nm(m)} fainted!`);
  }
  if (!alive('them').length) {
    if (B.mode === 'survival' && alive('me').length) { if (cur('me').hp <= 0) await sendIn('me', B.sides.me.team.indexOf(alive('me')[0])); await nextWave(); return; }
    await endBattle(true); return;
  }
  if (!alive('me').length) { await endBattle(false); return; }
  if (B.pvp) { // you pick first, then wait for theirs, so neither player waits on the other
    if (cur('me').hp <= 0) {
      const to = await new Promise(res => { B.pickRes = res; B.prompt = 'faint'; B.busy = false; drawControls(); });
      B.prompt = ''; B.busy = true; drawControls(); B.pvp.send({ t: 'swap', turn: B.turn, v: to }); await sendIn('me', to);
    }
    if (cur('them').hp <= 0) { const to = await B.pvp.recv('swap', B.turn); if (battle !== B || B.over) return; await sendIn('them', to); }
    return;
  }
  if (cur('them').hp <= 0) await sendIn('them', aiSwap(true));
  if (cur('me').hp <= 0) { B.prompt = 'faint'; B.busy = false; drawControls(); }
}

// ---------- how rivals choose ----------
function aiAct() {
  const B = battle, a = cur('them'), d = cur('me');
  const f = forcedMove(a); if (f) return { kind: 'move', mv: f };
  const tier = tierOf(B.e), smart = a.boss || tier >= 2;
  // swap out of a bad match-up now and then
  const sw = aiSwap(false);
  if (sw != null && !a.vol.bound && Math.random() < (a.boss ? .5 : smart ? .3 : .1)) return { kind: 'switch', to: sw };
  if (B.aiItems == null) B.aiItems = B.e.boss || tier >= 3 ? 1 : 0;
  if (B.mode !== 'survival' && a.hp / a.st.hp < .25 && B.aiItems > 0 && Math.random() < .6) { B.aiItems--; return { kind: 'item', id: 'water' }; }
  const list = usable(a); if (!list.length) return { kind: 'move', mv: moveById('struggle') };
  const scored = list.map(s => { const m = moveById(s.id); return [m, aiScore(a, d, m) * (smart ? .85 + Math.random() * .3 : .6 + Math.random() * .8) + (smart ? 0 : Math.random() * 25)]; });
  scored.sort((x, y) => y[1] - x[1]);
  return { kind: 'move', mv: scored[0][0] };
}
function aiScore(a, d, m) {
  if (isDmg(m)) {
    if (m.counter) return d.types.some(t => t === 'normal' || t === 'combat') ? 30 : 5;
    let est;
    if (m.fixed) est = m.fixed === 'lv' ? a.lv : m.fixed;
    else {
      const eff = typeEff(m.type, d.types); if (!eff) return 0; const special = SPECIAL_TYPES.has(m.type);
      const A = a.st[special ? 'spc' : 'atk'] * stageMul(a.stg[special ? 'spc' : 'atk']), Dd = d.st[special ? 'spc' : 'def'] * stageMul(d.stg[special ? 'spc' : 'def']) * ((special ? d.vol.light : d.vol.reflect) ? 2 : 1);
      est = (Math.floor(2 * a.lv / 5 + 2) * m.pow * A / Dd / 50 + 2) * (a.types.includes(m.type) ? 1.5 : 1) * eff * .92 * (m.hits ? 3 : 1);
    }
    est *= (m.acc ?? 100) / 100;
    if (m.charge || m.recharge) est *= .7;
    if (m.explode) return a.hp / a.st.hp < .3 ? 150 : 0;
    const frac = est / Math.max(1, d.hp);
    return frac >= 1 ? 200 + (m.pri || 0) * 20 : 100 * frac;
  }
  const hp = a.hp / a.st.hp;
  if (m.heal || m.rest) return hp < .4 ? 95 : 0;
  if (m.self) { const [k] = Object.keys(m.self); return hp > .6 && a.stg[k] < 2 ? 38 : 4; }
  if (m.foe) { const [k] = Object.keys(m.foe); return d.stg[k] > -2 ? 22 : 2; }
  if (m.inflict === 'conf') return d.vol.conf || d.vol.sub ? 0 : 34;
  if (m.inflict === 'leech') return d.vol.leech || d.types.includes('nature') ? 0 : 40;
  if (m.inflict) { if (d.status || d.vol.sub) return 0; if (m.inflict === 'par' && typeEff('spark', d.types) === 0) return 0; if ((m.inflict === 'tox' || m.inflict === 'psn') && d.types.includes('toxic')) return 0; return { slp: 60, par: speedOf(d) > speedOf(a) ? 55 : 35, tox: 45 }[m.inflict] || 30; }
  if (m.screen) return a.vol[m.screen === 'reflect' ? 'reflect' : 'light'] || hp < .5 ? 0 : 28;
  if (m.focus) return a.vol.focus ? 0 : 20;
  if (m.sub) return a.vol.sub || hp < .5 ? 0 : 26;
  if (m.haze) return Object.values(d.stg).reduce((x, y) => x + Math.max(0, y), 0) >= 2 ? 70 : 0;
  return 5;
}
// the best teammate against what you have out (null when staying in is fine)
function aiSwap(forced) {
  const B = battle, S = B.sides.them, d = cur('me'), a = cur('them');
  const score = m => Math.max(...m.moves.map(s => { const mm = moveById(s.id); return mm.pow ? typeEff(mm.type, d.types) * (m.types.includes(mm.type) ? 1.5 : 1) : .8; })) - Math.max(...d.types.map(t => typeEff(t, m.types))) * .5 + m.hp / m.st.hp * .3;
  const opts = S.team.map((m, k) => [k, m]).filter(([k, m]) => m.hp > 0 && k !== S.cur);
  if (!opts.length) return forced ? S.cur : null;
  opts.sort((x, y) => score(y[1]) - score(x[1]));
  if (forced) return opts[0][0];
  return score(opts[0][1]) > score(a) + .9 ? opts[0][0] : null;
}

// ---------- survival waves ----------
async function nextWave() {
  const B = battle;
  banner(`WAVE ${B.wave} CLEARED`, 'win'); burst('me', '#40c057');
  await say(`🌊 Wave ${B.wave} cleared! Your team catches its breath.`);
  B.wave++;
  for (const m of B.sides.me.team) if (m.hp > 0) { m.hp = Math.min(m.st.hp, m.hp + Math.ceil(m.st.hp / 3)); m.moves.forEach(x => { x.pp = Math.min(x.max, x.pp + 3); }); }
  B.e = survivalRival(B.wave);
  B.sides.them = { team: rivalTeam(B.e, 'survival'), cur: 0 }; B.sides.them.team.forEach(m => { m.side = 'them'; });
  banner(`WAVE ${B.wave}`, 'boss');
  await sendIn('them', 0);
  B.busy = false; drawPanels(); drawControls();
}

// ---------- the end ----------
async function endBattle(win) {
  const B = battle; if (!B || B.over) return;
  finishBattle(win);
  const sv = B.mode === 'survival';
  if (win) { banner(B.e.boss ? `${(leagueOf(B.e) || {}).badge || '🏅'} BADGE WON!` : 'VICTORY!', 'win'); for (let k = 0; k < 3; k++) setTimeout(() => burst('me', ['#fcc419', '#40c057', '#4dabf7'][k]), k * 250); await play('me', 'win'); }
  else { banner(sv ? `GAME OVER · WAVE ${B.wave}` : 'DEFEAT', 'lose'); await play('them', 'win'); }
  B.busy = false; drawPanels(); drawControls();
}
function finishBattle(win) {
  const B = battle; if (!B || B.over) return;
  B.over = true; B.win = win;
  if (B.mode === 'pvp' || B.mode === 'ghost') { pvpFinish(B, win); save(); return; }
  const at = new Date().toISOString(), idx = Math.max(0, B.i);
  let reward, first = false;
  if (B.mode === 'survival') {
    const waves = B.wave - 1; reward = 5 + waves * 12;
    D.arena.survival = [...(D.arena.survival || []), { at, waves }].slice(-100);
    B.record = waves > (D.arena.survivalBest || 0); if (B.record) D.arena.survivalBest = waves;
  } else if (B.mode === 'daily') reward = win ? 60 : 5;
  else if (B.mode === 'wander') reward = win ? 90 : 5;
  else { first = win && !beaten(B.e.id); reward = win ? (first ? 30 + 12 * idx + (B.e.boss ? 100 : 0) : 8 + 2 * idx) : 5; }
  D.arena.battles = [...(D.arena.battles || []), { at, e: B.mode === 'survival' ? 'survival' : B.e.id, win, mode: B.mode }].slice(-300);
  D.arena.ledger['b:' + at] = reward;
  B.reward = reward; B.first = first;
  // a newly beaten rival joins your crew
  if (first && B.mode === 'ladder') { const t = crewTeam(); if (t.length < 5 && !t.includes(B.e.id)) D.arena.team = [...t, B.e.id]; B.joined = true; }
  B.loot = win || (B.mode === 'survival' && B.wave > 3) ? rollLoot(B, at) : [];
  save();
}
function rollLoot(B, at) {
  const out = [], r = Math.random, give = (icon, name, fn) => { fn(); out.push(`${icon} ${name}`); };
  const cosDrop = id => { if (!ownsCos(id)) give('🎁', cos(id).name + ' (avatar)', () => { D.arena.owned = { ...(D.arena.owned || {}), [id]: at }; }); };
  const gearDrop = () => { const pool = GEAR.filter(g => !ownsGear(g.id)); if (!pool.length) return false; const g = pool.sort((a, b) => a.price - b.price)[Math.min(pool.length - 1, Math.floor(r() * Math.min(pool.length, 3 + Math.max(0, B.i))))]; give(g.icon, g.name + ' (gear)', () => { D.arena.gear[g.id] = at; }); return true; };
  const boostDrop = () => { const ids = ['drink', 'charm', 'guard'], k = ids[Math.floor(r() * 3)], it = SHOP_ITEMS.find(x => x.id === k); give(it.icon, it.name, () => { D.arena.items = D.arena.items || {}; D.arena.items[k] = (D.arena.items[k] || 0) + 1; }); };
  if (B.mode === 'ladder' && B.e.boss) {
    const bossCos = { coach: 'x_belt', storm: 'kit_storm', titan: 'eye_titan', goat: 'hat_goat' }[B.e.id];
    if (B.first) { if (bossCos) cosDrop(bossCos); gearDrop(); } else if (r() < .35) gearDrop() || boostDrop(); else boostDrop();
    const c = 40 + 20 * LEAGUES.findIndex(l => l.id === B.e.league); give('🪙', `${c} coins`, () => { D.game.ledger['loot:' + at] = c; });
  } else if (B.mode === 'wander') {
    gearDrop() || boostDrop(); boostDrop();
  } else if (B.mode === 'daily') {
    boostDrop(); if (r() < .5) gearDrop() || boostDrop();
    if (dailyWins() + 1 >= 3) cosDrop('p_eagle');
  } else if (B.mode === 'survival') {
    const waves = B.wave - 1; if (waves >= 4) boostDrop(); if (waves >= 6 && r() < .5) gearDrop(); if (waves >= 8) cosDrop('bg_arena');
  } else {
    if (r() < .45) boostDrop();
    if (r() < .08) gearDrop();
    if (r() < .25) { const c = 15 + Math.floor(r() * 30); give('🪙', `${c} coins`, () => { D.game.ledger['loot:' + at] = c; }); }
  }
  return out;
}
function resultHtml() {
  const B = battle, sv = B.mode === 'survival';
  if (B.mode === 'pvp' || B.mode === 'ghost') return pvpResultHtml(B);
  const head = sv ? `🌊 You lasted ${B.wave - 1} wave${B.wave === 2 ? '' : 's'}${B.record ? ' · new best!' : ''}` : B.win ? '🏆 You win!' : '😤 Not this time';
  const text = sv ? `Best ever: ${D.arena.survivalBest || 0} waves.` : B.win ? (B.mode === 'daily' ? 'Daily challenge done. A new challenger turns up tomorrow.' : B.mode === 'wander' ? `${esc(B.e.name)} is beaten. Another challenger will turn up in a few days.` : B.first ? `${esc(B.e.name)} is beaten${B.joined ? ' and joins your crew 🤝' : ''}.${B.i < ENEMIES.length - 1 ? ' The next rival is unlocked.' : ' You beat the whole ladder. Legend.'}` : 'Another win.') : 'Check the types: hit them with moves they\'re weak to, and swap in a crew member who resists their attacks.';
  return `<div class="bresult ${B.win || (sv && B.wave > 1) ? 'win' : 'lose'}"><h2>${head}</h2><p>${text} <b>+${B.reward} ${GRIT}</b></p>
    ${B.loot?.length ? `<div class="loot"><b>Loot</b>${B.loot.map(l => `<span class="lootitem">${esc(l)}</span>`).join('')}</div>` : ''}
    <button class="btn primary" data-bm="close">Back to the Arena</button></div>`;
}

// ---------- arena page: daily challenge and survival ----------
function battleModesHtml() {
  const d = dailyRival(), won = dailyWon(), best = D.arena.survivalBest || 0;
  const wv = wanderRival(), wwon = wanderWon();
  return `<div class="grid g3 bmodes">
    <div class="card bmode wander"><div class="card-head"><h2>🆕 New challenger</h2>${wwon ? '<span class="tag green">✓ Beaten</span>' : `<span class="muted small-text">leaves in ${wv.left} day${wv.left === 1 ? '' : 's'}</span>`}</div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">${wv.icon}</span><div class="main"><b>${esc(wv.name)}</b> <span class="muted small-text">Lv ${lvOf(wv.r)}</span><div>${typeChips(typesOf(wv))}</div><div class="muted small-text">${esc(wv.line)} +90 Grit and gear.</div></div>
      ${wwon ? '' : `<button class="btn primary" data-act="fightMode" data-v="wander">⚔️ Fight</button>`}</div></div>
    <div class="card bmode daily"><div class="card-head"><h2>📅 Daily challenge</h2>${won ? '<span class="tag green">✓ Won today</span>' : '<span class="muted small-text">+60 Grit and loot</span>'}</div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">${d.icon}</span><div class="main"><b>${esc(d.name)}</b> <span class="muted small-text">Lv ${lvOf(d.r)}</span><div>${typeChips(typesOf(d))}</div><div class="muted small-text">${esc(d.mod.label)}</div></div>
      ${won ? '' : `<button class="btn primary" data-act="fightMode" data-v="daily">⚔️ Fight</button>`}</div>
      <p class="muted small-text" style="margin-bottom:0">${dailyWins()} daily win${dailyWins() === 1 ? '' : 's'} so far.${ownsCos('p_eagle') ? '' : ' Win 3 for the Eagle pet.'}</p></div>
    <div class="card bmode survival"><div class="card-head"><h2>🌊 Survival</h2><span class="muted small-text">best: ${best} wave${best === 1 ? '' : 's'}</span></div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">🔥</span><div class="main"><b>Wave after wave</b><div class="muted small-text">Bring 3. Each wave is tougher, and HP carries over (you heal a third between waves). 12 Grit a wave, loot from wave 4, Arena lights background at wave 8.</div></div>
      <button class="btn primary" data-act="fightMode" data-v="survival">Start</button></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>How battles work</h2><button class="btn small" data-act="arenaPage" data-v="moves">🥋 Moves &amp; crew →</button></div>
    <p class="small-text">Battles follow the rules of the original Pokémon games. Each turn you pick <b>Fight</b> (one of 4 moves), swap in a <b>Crew</b> member, or use something from your <b>Bag</b>. The faster fighter moves first. Every move has a type and limited uses (PP).</p>
    <p class="small-text"><b>Types</b> decide most fights: a super effective hit does 2× (or 4× against two weak types), a resisted one ½×, and some do nothing at all. Moves that match the user's own type do 1.5×. Critical hits come from Speed. Statuses stick around: 💤 sleep, ☠️ poison, 🔥 burn (halves physical damage), 🧊 freeze and ⚡ paralysis (slow, and sometimes can't move), plus 😵‍💫 confusion.</p>
    <details class="typechart"><summary class="small-text">Type chart</summary>${typeChartHtml()}</details></div>`;
}
function typeChartHtml() {
  const ts = Object.keys(TYPES);
  return `<div class="tchart"><table><tr><th class="muted small-text">attack ↓ · defend →</th>${ts.map(t => `<th title="${TYPES[t][1]}">${TYPES[t][0]}</th>`).join('')}</tr>${ts.map(a => `<tr><th>${typeBadge(a)}</th>${ts.map(d => { const v = CHART[a]?.[d] ?? 1; return `<td class="${v > 1 ? 'x2' : v === 0 ? 'x0' : v < 1 ? 'xh' : ''}">${v > 1 ? '2' : v === 0 ? '0' : v < 1 ? '½' : ''}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
}
