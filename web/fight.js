'use strict';
/* Battles (2.48, islands stage 2): spells, moves, gear and turn-based fights.
   - Spells are bought once with Lumen, moves with Ember. You equip a limited
     build: 3 spells (Mind slots) and 3 moves (Body slots), plus your class's
     own skill. Change it any time outside a fight.
   - Gear: 6 slots (head, chest, legs, feet, hands, charm). Pieces only drop
     from fights, each with its own buffs. One legendary per term, whether it
     drops or is bought.
   - Your Mind and Body cards power everything: each skill scales with one stat.
   - Weekly house boss: 5 attempts a week (2 a day), 8 rounds each. The boss
     hits back lightly. Everything you deal goes on your house's shared bar.
     Each boss has its own attacks, a weakness and a special way to beat it.
   - Spar (a stronger copy of any boss) and Duels (a friend's character played
     by the computer) are optional and risky: the stake is taken when you
     start and comes back with a reward only if you win. Duels move a rating. */

const FT_SPELLS = 3, FT_MOVES = 3, FT_ROUNDS = 8, FT_SPAR_ROUNDS = 12, FT_WEEK_ATT = 5, FT_DAY_ATT = 2;
const FT_ATT_CAP = 700, FT_WEEK_CAP = 12000; // 2.81: the week cap rose for the Souls damage race (quick fights still cap at 700 each)
// skills: k spell|move, st = the stat it scales with, pw power, cd rounds between uses, t tag, c cost
const FT_SKILLS = [
  { id: 'spark', k: 'spell', n: 'Spark', e: '✨', st: 'foc', pw: 14, cd: 0, t: 'light', c: 0, d: 'A quick flash of light.' },
  { id: 'bolt', k: 'spell', n: 'Logic Bolt', e: '🔷', st: 'log', pw: 24, cd: 1, t: 'arcane', c: 120, d: 'A clean, reasoned hit.' },
  { id: 'recall', k: 'spell', n: 'Total Recall', e: '📖', st: 'kno', pw: 18, cd: 2, t: 'arcane', fx: 'reveal', c: 160, d: 'Hits and finds the weak spot: your next 2 hits count as super effective.' },
  { id: 'verse', k: 'spell', n: 'Cutting Verse', e: '🪶', st: 'exp', pw: 16, cd: 1, t: 'arcane', dot: 8, c: 180, d: 'Words that sting for 3 more rounds.' },
  { id: 'calm', k: 'spell', n: 'Calm Mind', e: '🫧', st: 'foc', pw: 25, cd: 3, fx: 'heal', c: 150, d: 'Heal about a quarter of your health.' },
  { id: 'ward', k: 'spell', n: 'Lumen Ward', e: '🔰', st: 'log', pw: 30, cd: 3, fx: 'shield', c: 200, d: 'A shield worth 30% of your health.' },
  { id: 'beam', k: 'spell', n: 'Focus Beam', e: '🎯', st: 'foc', pw: 30, cd: 2, t: 'light', c: 220, d: 'Locked-in, high-power light.' },
  { id: 'burst', k: 'spell', n: 'Light Burst', e: '☀️', st: 'kno', pw: 26, cd: 2, t: 'light', c: 240, d: 'Blinding light. Wakes, reveals and burns.' },
  { id: 'paradox', k: 'spell', n: 'Paradox', e: '🌀', st: 'log', pw: 16, cd: 3, t: 'arcane', stun: .6, c: 300, d: '60% chance to stun for a round.' },
  { id: 'nova', k: 'spell', n: 'Supernova', e: '🌟', st: 'kno', pw: 52, cd: 4, t: 'light', c: 700, r: 'epic', d: 'An enormous blast. Long cooldown.' },
  { id: 'crown', k: 'spell', n: 'Solar Crown', e: '👑', st: 'foc', pw: 66, cd: 4, t: 'light', heal: 15, c: 1500, r: 'legendary', d: 'Legendary. Huge light damage and heals 15%. One legendary per term.' },
  { id: 'jab', k: 'move', n: 'Jab', e: '👊', st: 'str', pw: 14, cd: 0, t: 'strike', c: 0, d: 'A quick punch.' },
  { id: 'dash', k: 'move', n: 'Sprint Strike', e: '💨', st: 'spd', pw: 22, cd: 1, t: 'swift', c: 120, d: 'In and out before it can react.' },
  { id: 'wind', k: 'move', n: 'Second Wind', e: '🌬️', st: 'end', pw: 25, cd: 3, fx: 'heal', c: 150, d: 'Heal about a quarter of your health.' },
  { id: 'brace', k: 'move', n: 'Brace', e: '🧱', st: 'end', pw: 30, cd: 3, fx: 'shield', c: 160, d: 'A shield worth 30% of your health.' },
  { id: 'cleave', k: 'move', n: 'Cleave', e: '🪓', st: 'str', pw: 26, cd: 2, t: 'cleave', c: 200, d: 'A wide cut. Chops off heads.' },
  { id: 'burn', k: 'move', n: 'Endurance Burn', e: '🔥', st: 'end', pw: 12, cd: 2, t: 'strike', dot: 10, c: 200, d: 'Keeps burning for 3 more rounds.' },
  { id: 'flurry', k: 'move', n: 'Flurry', e: '🌪️', st: 'agi', pw: 9, hits: 3, cd: 2, t: 'swift', c: 220, d: 'Three fast hits.' },
  { id: 'haymaker', k: 'move', n: 'Haymaker', e: '🥊', st: 'str', pw: 32, cd: 2, t: 'strike', stun: .3, c: 260, d: 'Big swing, 30% chance to stun.' },
  { id: 'tackle', k: 'move', n: 'Tackle', e: '🏉', st: 'spd', pw: 20, cd: 3, t: 'cleave', stun: .5, c: 280, d: '50% chance to stun. Counts as a cleave.' },
  { id: 'meteor', k: 'move', n: 'Meteor Drop', e: '☄️', st: 'str', pw: 52, cd: 4, t: 'strike', c: 700, r: 'epic', d: 'Everything into one hit. Long cooldown.' },
  { id: 'phoenix', k: 'move', n: 'Phoenix Rush', e: '🐦‍🔥', st: 'spd', pw: 66, cd: 4, t: 'swift', heal: 15, c: 1500, r: 'legendary', d: 'Legendary. A blazing charge that heals 15%. One legendary per term.' },
];
// each class: a passive and its own skill (always in your build)
const FT_CLASS = {
  tactician: { p: 'Every 3rd round your hits always crit.', sk: { id: 'c_gambit', k: 'spell', n: 'Gambit', e: '♟️', st: 'log', pw: 0, cd: 3, fx: 'buff', d: 'Your next hit does double damage.' }, sk2: { id: 'c_feint', k: 'move', n: 'Feint', e: '🎭', st: 'agi', pw: 18, cd: 2, t: 'swift', stun: .4, d: 'A fake-out: 40% chance to stun.' } },
  sage: { p: 'Spells do 15% more.', sk: { id: 'c_insight', k: 'spell', n: 'Insight', e: '📜', st: 'kno', pw: 20, cd: 3, fx: 'reveal', t: 'light', d: 'Hits and reveals: your next 2 hits count as super effective.' }, sk2: { id: 'c_staff', k: 'move', n: 'Staff Strike', e: '🪄', st: 'end', pw: 22, cd: 2, t: 'strike', heal: 8, d: 'A measured blow that heals 8%.' } },
  bard: { p: 'Heal 4% of your health every round.', sk: { id: 'c_rally', k: 'spell', n: 'Rally', e: '🎻', st: 'exp', pw: 0, cd: 4, fx: 'rally', d: 'Everything you do hits 30% harder for 3 rounds.' }, sk2: { id: 'c_encore', k: 'move', n: 'Encore', e: '🎶', st: 'agi', pw: 10, hits: 3, cd: 2, t: 'swift', d: 'Three quick hits in time with the music.' } },
  monk: { p: "Can't be stunned, confused or lost in fog.", sk: { id: 'c_still', k: 'spell', n: 'Still Mind', e: '🧘', st: 'foc', pw: 30, cd: 3, fx: 'heal', cleanse: 1, d: 'Heal 30% and clear burns and blindness.' }, sk2: { id: 'c_palm', k: 'move', n: 'Palm Strike', e: '🖐️', st: 'end', pw: 24, cd: 2, t: 'strike', stun: .3, d: 'A calm, heavy strike: 30% chance to stun.' } },
  striker: { p: 'Moves do 15% more.', sk: { id: 'c_blitz', k: 'move', n: 'Blitz', e: '⚡', st: 'spd', pw: 12, hits: 3, cd: 2, t: 'swift', d: 'Three lightning hits.' }, sk2: { id: 'c_charge', k: 'spell', n: 'Overcharge', e: '🔋', st: 'spd', pw: 0, cd: 3, fx: 'buff', d: 'Your next hit does double damage.' } },
  ranger: { p: 'Never misses: ignores dodging, fog and blindness.', sk: { id: 'c_mark', k: 'move', n: 'Mark', e: '🏹', st: 'foc', pw: 16, cd: 3, fx: 'mark', t: 'swift', d: 'Hits and marks it: +25% damage taken for 3 rounds.' }, sk2: { id: 'c_eagle', k: 'spell', n: 'Eagle Eye', e: '🦅', st: 'foc', pw: 18, cd: 3, fx: 'reveal', t: 'light', d: 'Hits and spots the weak point: your next 2 hits count as super effective.' } },
  guardian: { p: 'Takes 20% less damage.', sk: { id: 'c_bulwark', k: 'move', n: 'Bulwark', e: '🛡️', st: 'str', pw: 40, cd: 3, fx: 'shield', d: 'A shield worth 40% of your health.' }, sk2: { id: 'c_aegis', k: 'spell', n: 'Aegis Light', e: '🌞', st: 'log', pw: 18, cd: 3, t: 'light', heal: 10, d: 'Holy light that hits and heals 10%.' } },
  rogue: { p: '20% chance to dodge any hit.', sk: { id: 'c_backstab', k: 'move', n: 'Backstab', e: '🗡️', st: 'agi', pw: 22, cd: 2, t: 'strike', back: 1, d: 'Does 2.5× damage if the target is stunned, blind or confused.' }, sk2: { id: 'c_smoke', k: 'spell', n: 'Smoke Bomb', e: '💨', st: 'exp', pw: 10, cd: 3, t: 'arcane', stun: .6, d: '60% chance to stun, which sets up Backstab.' } },
};
// bosses (same names as the weekly Warbandes): their own attacks, a weakness and a special rule
const FT_BOSS = {
  'The Procrastinator': { weak: s => s.t === 'swift', wn: 'Swift moves', sp: 'Start now: everything in the first two rounds does double damage.',
    atk: [['Yawn', 8], ['"Later..."', 5, 'stun', .35], ['Snack break', 7]], dmgIn: F => F.round <= 2 ? 2 : 1 },
  'Doomscroll Kraken': { weak: s => s.st === 'foc', wn: 'Focus skills', sp: 'Three tentacles each block 15% of your damage. Every Focus skill cuts one off. Cut all three and it is stunned for 2 rounds.',
    atk: [['Notification ping', 3, '', 0, 3], ['Ink cloud', 6, 'blind', .7], ['Endless feed', 10]],
    init: B => { B.tent = 3; }, dmgIn: (F, s) => 1 - .15 * F.E.tent,
    after: (F, s) => { if (s.st === 'foc' && F.E.tent > 0) { F.E.tent--; ftLog(F, `✂️ A tentacle is cut off (${F.E.tent} left)`); if (!F.E.tent) { F.E.stun = 2; ftLog(F, '😵 The Kraken is stunned!'); } } }, chips: B => B.tent ? `🦑 ${B.tent} tentacles` : '' },
  'Snooze Golem': { weak: s => s.st === 'str', wn: 'Strength moves', sp: 'Stone armour blocks 40% while it sleeps. Hit it with light to wake it: no armour for 2 rounds. It slams hard every 3rd round.',
    atk: [['Snooze', 4], ['Pillow punch', 9]], big: ['SLAM', 22],
    dmgIn: F => F.E.awake > 0 ? 1 : .6, after: (F, s) => { if (s.t === 'light') { F.E.awake = 3; ftLog(F, '⏰ The Golem wakes up: armour off!'); } }, chips: B => B.awake > 0 ? '⏰ Awake' : '💤 Armoured' },
  'Couch Troll': { weak: s => s.st === 'end' || s.st === 'spd', wn: 'Endurance and Speed moves', sp: 'Keep moving: each Body move in a row does 25% more (up to double). A spell resets it.',
    atk: [['Sit down', 6, 'slow', .6], ['Cushion slam', 12], ['Remote throw', 8]],
    dmgIn: (F, s) => s.k === 'move' ? 1 + .25 * Math.min(4, F.P.chain) : 1, chips: (B, F) => F.P.chain ? `🏃 Moving ×${F.P.chain}` : '' },
  'Cram Wraith': { weak: s => s.st === 'kno', wn: 'Knowledge spells', sp: 'Body moves pass straight through it until it is revealed by light or a Knowledge spell (2 rounds).',
    atk: [['All-nighter', 10, 'drain'], ['Panic', 5, 'dot', .6], ['Blank mind', 7, 'confuse', .3]],
    dmgIn: (F, s) => s.k === 'move' && !(F.E.seen > 0) ? 0 : 1, after: (F, s) => { if (s.t === 'light' || s.st === 'kno') { F.E.seen = 3; ftLog(F, '👁️ The Wraith is revealed!'); } }, chips: B => B.seen > 0 ? '👁️ Revealed' : '👻 Hidden' },
  'Excuse Hydra': { weak: s => s.st === 'log', wn: 'Logic', sp: 'Grows a head every round, up to 5 (each one bites). Cleave hits cut a head off and do 50% more.',
    atk: [['Bite', 0]], init: B => { B.heads = 2; }, round: F => { if (F.E.heads < 5) { F.E.heads++; ftLog(F, `🐲 Another excuse grows (${F.E.heads} heads)`); } },
    dmgIn: (F, s) => s.t === 'cleave' ? 1.5 : 1, after: (F, s) => { if (s.t === 'cleave' && F.E.heads > 1) { F.E.heads--; ftLog(F, `🪓 A head is cut off (${F.E.heads} left)`); } },
    atkDmg: F => F.E.heads * 3.5, chips: B => `🐲 ${B.heads} heads` },
  'Fog of Distraction': { weak: s => s.st === 'foc', wn: 'Focus', sp: 'Dodges 45% of hits unless you used a Focus skill last turn (locked on). Monks and Rangers see through it.',
    atk: [['Wander', 6, 'confuse', .4], ['Haze', 8], ['New tab', 7, 'blind', .3]],
    dodge: F => (F.P.lastSt === 'foc' || ['monk', 'ranger'].includes(F.P.cls)) ? 0 : .45, chips: (B, F) => F.P.lastSt === 'foc' ? '🎯 Locked on' : '🌫️ Foggy' },
  'The Energy Drain': { weak: s => s.st === 'end', wn: 'Endurance', sp: 'Recharge: every point you heal also hits it for double. It crashes into you hard when you are under half health.',
    atk: [['Drain', 9, 'drain'], ['Sugar crash', 7, 'slow', .5]], big: ['CRASH', 18], bigIf: F => F.P.hp < F.P.max / 2, onHeal: (F, n) => ftHitBoss(F, n * 2, '🔋 Recharge') },
};
const FT_GEAR_SLOTS = [['head', 'Head', '🪖'], ['chest', 'Chest', '🦺'], ['legs', 'Legs', '👖'], ['feet', 'Feet', '👟'], ['hand', 'Hands', '🧤'], ['charm', 'Charm', '🔮']];
const FT_GEAR = {
  head: [['Study Cap', '🎓', ['sp', 'cr']], ['Helm', '🪖', ['dr', 'hp']], ['Headband', '🎽', ['cr', 'mv']]],
  chest: [['Hoodie', '🧥', ['hp', 'rg']], ['Chestplate', '🦺', ['dr', 'hp']], ['Robe', '🥋', ['sp', 'rg']]],
  legs: [['Track Pants', '👖', ['dg', 'mv']], ['Greaves', '🦿', ['hp', 'dr']], ['Training Shorts', '🩳', ['mv', 'dg']]],
  feet: [['Spikes', '👟', ['mv', 'dg']], ['Boots', '🥾', ['dr', 'hp']], ['Slippers', '🩴', ['rg', 'sp']]],
  hand: [['Gloves', '🧤', ['mv', 'cr']], ['Pen of Power', '🖊️', ['sp', 'cr']], ['Tape', '🩹', ['dr', 'mv']]],
  charm: [['Lucky Clover', '🍀', ['cr', 'dg']], ['Seer Orb', '🔮', ['wk', 'sp']], ['Medal', '🏅', ['hp', 'wk']]],
};
const FT_BUFF = { hp: [15, 'Health', v => `+${v}`], sp: [.05, 'Spell damage', v => `+${Math.round(v * 100)}%`], mv: [.05, 'Move damage', v => `+${Math.round(v * 100)}%`], cr: [.03, 'Crit chance', v => `+${Math.round(v * 100)}%`],
  dr: [.03, 'Damage taken', v => `−${Math.round(v * 100)}%`], dg: [.03, 'Dodge', v => `+${Math.round(v * 100)}%`], rg: [2, 'Heal per round', v => `+${v}`], wk: [.08, 'Super effective', v => `+${Math.round(v * 100)}%`] };
const FT_RAR = [['common', 'Common', 1, '#868e96'], ['rare', 'Rare', 1.6, '#1c7ed6'], ['epic', 'Epic', 2.4, '#ae3ec9'], ['legendary', 'Legendary', 3.5, '#f59f00']];
const FT_STAT_ORDER = ['log', 'kno', 'exp', 'foc', 'spd', 'end', 'str', 'agi'];

// 2.81: fills missing keys in place, so an object held across another ftState() call keeps its writes
// (it used to swap in a new object each call, which lost the bonus fight count)
const ftState = () => { const c = cdState(), d = { own: ['spark', 'jab'], eq: { spell: ['spark'], move: ['jab'] }, gear: [], wear: {}, att: {}, dmg: {}, leg: {}, kill: {}, r: 1000, w: 0, l: 0 }; c.ft = c.ft || {}; for (const k in d) if (!(k in c.ft)) c.ft[k] = d[k]; return c.ft; };
const ftSkill = id => FT_SKILLS.find(s => s.id === id) || Object.values(FT_CLASS).flatMap(c => [c.sk, c.sk2]).find(s => s.id === id);
// 2.57: each class has two exclusive skills, a spell and a move, always in your build
const ftClassSkills = cls => FT_CLASS[cls] ? [FT_CLASS[cls].sk, FT_CLASS[cls].sk2].filter(Boolean) : [];
// 2.57 gear sets: wear 3 or more matching pieces for a bonus, 5 or more for a bigger one
const FT_SETS = [
  { id: 'scholar', n: 'Scholar', e: '🎓', pcs: ['Study Cap', 'Robe', 'Slippers', 'Pen of Power', 'Seer Orb'], b3: { sp: .08 }, b5: { sp: .08, wk: .1 } },
  { id: 'iron', n: 'Ironclad', e: '🛡️', pcs: ['Helm', 'Chestplate', 'Greaves', 'Boots', 'Tape', 'Medal'], b3: { dr: .05 }, b5: { hp: 40, dr: .03 } },
  { id: 'athlete', n: 'Athlete', e: '🏃', pcs: ['Headband', 'Hoodie', 'Track Pants', 'Training Shorts', 'Spikes', 'Gloves', 'Lucky Clover'], b3: { mv: .08 }, b5: { dg: .05, cr: .03 } },
];
// which template a piece was made from (its name without the rarity)
const ftGearBase = p => (FT_GEAR[p.slot] || []).find(t => p.n === t[0] || p.n.endsWith(' ' + t[0]))?.[0] || '';
const ftSetOf = p => FT_SETS.find(S => S.pcs.includes(ftGearBase(p)));
// sets you have on: [{ S, n, b }] where b is the bonus that is switched on
function ftSets(st = ftState(), wear = st.wear) {
  const cnt = {};
  for (const id of Object.values(wear)) { const p = st.gear.find(x => x.id === id), S = p && ftSetOf(p); if (S) cnt[S.id] = (cnt[S.id] || 0) + 1; }
  return FT_SETS.filter(S => cnt[S.id]).map(S => { const n = cnt[S.id], b = {}; if (n >= 3) for (const [k, v] of Object.entries(S.b3)) b[k] = (b[k] || 0) + v; if (n >= 5) for (const [k, v] of Object.entries(S.b5)) b[k] = (b[k] || 0) + v; return { S, n, b }; });
}
const ftRar = r => FT_RAR.find(x => x[0] === r) || FT_RAR[0];
// 2.51: spells and moves unlock by player level (level.js), cheaper ones first; gear above common needs a level to wear
const ftSkillLv = s => s.lv || (!s.c ? 1 : s.r === 'legendary' ? 18 : s.r === 'epic' ? 12 : s.c <= 120 ? 2 : s.c <= 160 ? 3 : s.c <= 200 ? 4 : s.c <= 240 ? 6 : 8);
const FT_GEAR_LV = { common: 1, rare: 3, epic: 6, legendary: 10 };
const ftGearLv = p => FT_GEAR_LV[p.r] || 1;
const ftTermX = (wk = mondayOf(today())) => bossWeek(wk) === 'term' ? 2 : 1; // 2.63: Term Boss week doubles the caps and rewards
const ftWeekDmg = wk => Math.min(FT_WEEK_CAP * ftTermX(wk), Math.round(ftState().dmg[wk] || 0));
function ftAttempts() {
  const st = ftState(), wk = mondayOf(today()); let week = 0;
  for (const [d, n] of Object.entries(st.att)) { if (d >= wk) week += n; else if (d < addDays(wk, -14)) delete st.att[d]; }
  const day = st.att[today()] || 0;
  const extra = (typeof hiPerks === 'function' ? hiPerks().at || 0 : 0) + (bossWeek(wk) === 'term' ? 3 : 0); // 2.50: house island perks; 2.63: 3 extra Term Boss fights
  if (bossWeek(wk) === 'rest') return { left: 0, week, day, extra, rest: true };
  return { left: Math.max(0, Math.min(FT_WEEK_ATT + extra - week, FT_DAY_ATT - day)), week, day, extra };
}
// total buffs from what you're wearing
function ftGearBuffs(st = ftState(), wear = st.wear) {
  const g = {};
  for (const id of Object.values(wear)) { const p = st.gear.find(x => x.id === id); if (p) for (const [k, v] of Object.entries(p.b)) g[k] = (g[k] || 0) + v; }
  for (const { b } of ftSets(st, wear)) for (const [k, v] of Object.entries(b)) g[k] = (g[k] || 0) + v;
  if (typeof islBuffs === 'function') for (const [k, v] of Object.entries(islBuffs())) g[k] = (g[k] || 0) + v; // 2.49: island perks
  return g;
}
function ftAddCurrency(l, e) { const s = cdState(); s.got = s.got || { l: 0, e: 0 }; s.got.l += l; s.got.e += e; }
function ftTake(l, e) { const w = cdWallet(), s = cdState(); l = Math.min(l, w.lumen); e = Math.min(e, w.ember); s.spent = s.spent || { l: 0, e: 0 }; s.spent.l = (s.spent.l || 0) + l; s.spent.e = (s.spent.e || 0) + e; return { l, e }; }
// a random gear piece; legendaries are limited to one per term
function ftRollGear(minR = 0) {
  const st = ftState(), slot = FT_GEAR_SLOTS[Math.floor(Math.random() * 6)][0], tpl = FT_GEAR[slot][Math.floor(Math.random() * 3)];
  const x = Math.random(); let ri = x < .01 ? 3 : x < .1 ? 2 : x < .4 ? 1 : 0; ri = Math.max(ri, minR);
  if (ri === 3 && st.leg[cdTerm()]) ri = 2;
  const R = FT_RAR[ri], b = {};
  tpl[2].forEach((k, i) => { const [base] = FT_BUFF[k], v = base * R[2] * (i ? .5 : 1) * (.85 + Math.random() * .3); b[k] = k === 'hp' || k === 'rg' ? Math.max(1, Math.round(v)) : Math.round(v * 100) / 100; });
  const p = { id: uid(), slot, n: `${R[1] === 'Common' ? '' : R[1] + ' '}${tpl[0]}`, e: tpl[1], r: R[0], b, at: today() };
  if (ri === 3) st.leg[cdTerm()] = p.n;
  st.gear.push(p);
  if (st.gear.length > 40) { const worn = Object.values(st.wear), old = st.gear.find(g => !worn.includes(g.id)); st.gear = st.gear.filter(g => g !== old); }
  return p;
}
const ftBuffText = b => Object.entries(b).map(([k, v]) => `${FT_BUFF[k][1]} ${FT_BUFF[k][2](v)}`).join(' · ');

// ---------- fighters ----------
function ftMaxHp(s, g) { return Math.round(120 + s.end * 1.5 + s.str * .5 + (g.hp || 0)); }
function ftFighter({ n, e, stats, cls, skills, g }) {
  const max = ftMaxHp(stats, g);
  return { n, e, s: stats, cls, g, hp: max, max, sk: skills.map(s => ({ ...s, cdl: 0 })), shield: 0, stun: 0, blind: 0, confuse: 0, slow: 0, dot: [], buff: 1, rally: 0, mark: 0, reveal: 0, chain: 0, lastSt: '' };
}
function ftMe(house) {
  const st = ftState(), ch = cdChar(), cls = cdClass(), ids = [...st.eq.spell, ...st.eq.move].filter(id => st.own.includes(id));
  for (const s of ftClassSkills(cls)) ids.push(s.id);
  return ftFighter({ n: D.settings.name || 'You', e: CD_CLASSES.find(c => c.id === cls)?.e || '🙂', stats: ch.all, cls, skills: ids.map(ftSkill).filter(Boolean), g: house && typeof hiFightBuffs === 'function' ? hiFightBuffs(ftGearBuffs(st)) : ftGearBuffs(st) });
}
function ftPublish() {
  const st = ftState(), ch = cdChar(), cls = cdClass(), g = ftGearBuffs(st);
  return { c: cls || '', s: FT_STAT_ORDER.map(k => ch.all[k]), k: [...st.eq.spell, ...st.eq.move].filter(id => st.own.includes(id)).slice(0, 6), g: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(v * 100) / 100])), r: st.r };
}
function ftEnd(F, how) {
  F.over = true; const st = ftState(), out = [];
  if (F.kind === 'house') {
    const wk = mondayOf(today()), x = ftTermX(wk), before = st.dmg[wk] || 0, n = Math.min((F.cap || FT_ATT_CAP) * x, Math.round(F.dealt)), add = Math.max(0, Math.min(n, FT_WEEK_CAP * x - before));
    st.dmg[wk] = before + add; for (const k in st.dmg) if (k < addDays(wk, -35)) delete st.dmg[k];
    out.push(`<b>${add.toLocaleString()}</b> damage added to ${esc(F.bossName)}'s shared health bar${add < F.dealt ? ` (capped at ${((F.cap || FT_ATT_CAP) * x).toLocaleString()} a fight, ${(FT_WEEK_CAP * x).toLocaleString()} a week)` : ''}.`);
    out.push(how === 'down' ? 'It knocked you out, but every hit you landed still counts.' : F.souls ? 'You lasted the full 3 minutes.' : 'You lasted all the rounds.');
    if (Math.random() < Math.min(.6, .2 + add / 1200) * x) { const p = ftRollGear(x > 1 ? 1 : 0); out.push(`Gear drop: ${ftGearChip(p)}`); }
    hsLoad(true);
    if (typeof hxEatFood === 'function') hxEatFood(); // 2.65: a harvest's extra health lasts until a boss fight
  }
  F.res = { how, out }; save();
}
function ftGearChip(p) { const R = ftRar(p.r); return `<span class="ftgear" style="--rc:${R[3]}">${p.e} ${esc(p.n)}</span> <span class="muted small-text">${ftBuffText(p.b)}</span>`; }

// ---------- the Build card on the Character page ----------
function ftBuildHtml(noGear) {
  const st = ftState(), w = cdWallet(), cls = cdClass(), me = ftMe(), g = ftGearBuffs(st), tab = ui.ftTab || 'spell';
  const slot = (k, i) => { const id = st.eq[k][i], s = id && ftSkill(id); return `<button class="ftslot ${k}" data-ft="unequip" data-k="${k}" data-i="${i}" title="${s ? esc(s.d) + ' (click to take off)' : 'Empty: equip one from your collection below'}">${s ? `<span>${s.e}</span><b>${esc(s.n)}</b><small>${CD_STAT[s.st][1]}</small>` : '<span class="muted">+</span><small class="muted">Empty</small>'}</button>`; };
  const csk = ftClassSkills(cls);
  const lvN = solisLevel(w).n;
  const shop = FT_SKILLS.filter(s => s.k === tab).sort((a, b) => ftSkillLv(a) - ftSkillLv(b) || a.c - b.c).map(s => {
    const need = ftSkillLv(s);
    if (lvN < need && !st.own.includes(s.id)) return `<div class="ftitem locked"><span class="fti-e">🔒</span><div><b>???</b><div class="muted small-text">A ${s.k === 'spell' ? 'Mind spell' : 'Body move'}${s.r ? ' · ' + ftRar(s.r)[1] : ''}. What it does stays hidden until you unlock it.</div></div><span class="tag">Level ${need}</span></div>`;
    const own = st.own.includes(s.id), on = st.eq[s.k].includes(s.id), cur = s.k === 'spell' ? LUMEN : EMBER, bal = s.k === 'spell' ? w.lumen : w.ember, R = ftRar(s.r);
    const legGone = s.r === 'legendary' && !own && st.leg[cdTerm()];
    return `<div class="ftitem ${own ? 'own' : ''}" style="--rc:${R[3]}"><span class="fti-e">${s.e}</span><div><b>${esc(s.n)}</b>${s.r ? ` <span class="ftrar">${R[1]}</span>` : ''}<div class="muted small-text">${CD_STAT[s.st][1]} · ${s.pw ? `power ${s.pw}${s.hits ? '×' + s.hits : ''}` : ''}${s.cd ? ` · cooldown ${s.cd}` : ''}${s.t ? ` · ${s.t}` : ''}</div><div class="small-text">${esc(s.d)}</div></div>
      ${own ? (on ? '<span class="tag">Equipped</span>' : `<button class="btn small" data-ft="equip" data-id="${s.id}">Equip</button>`) : legGone ? `<span class="muted small-text">Legendary taken this term (${esc(st.leg[cdTerm()])})</span>` : `<button class="btn small ${bal >= s.c ? 'primary' : ''}" data-ft="buy" data-id="${s.id}" ${bal >= s.c ? '' : 'disabled'}>${cur} ${s.c}</button>`}</div>`;
  }).join('');
  const bag = [...st.gear].sort((a, b) => FT_RAR.findIndex(x => x[0] === b.r) - FT_RAR.findIndex(x => x[0] === a.r));
  const gearSlots = FT_GEAR_SLOTS.map(([k, n, e]) => { const p = st.gear.find(x => x.id === st.wear[k]); return `<div class="ftgslot" ${p ? `style="--rc:${ftRar(p.r)[3]}" title="${esc(ftBuffText(p.b))}"` : ''}><small class="muted">${n}</small>${p ? `<span>${p.e}</span><b>${esc(p.n)}</b><button class="iconbtn" data-ft="unwear" data-k="${k}" title="Take off">✕</button>` : `<span class="muted">${e}</span><small class="muted">Empty</small>`}</div>`; }).join('');
  return `<div class="card ftbuild"><div class="row" style="justify-content:space-between"><h3>⚔️ Build</h3><span class="muted small-text">❤️ ${me.max} health${Object.keys(g).length ? ' · ' + ftBuffText(Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'hp'))) : ''}</span></div>
    <p class="muted small-text">New spells and moves unlock as you level up (what they do is hidden until then), and rare, epic and legendary gear can be worn from levels ${FT_GEAR_LV.rare}, ${FT_GEAR_LV.epic} and ${FT_GEAR_LV.legendary}. Equip up to ${FT_SPELLS} spells (Mind) and ${FT_MOVES} moves (Body). Each one scales with the stat shown, so your cards matter. Your two class skills are always in. Change your build any time outside a fight.</p>
    <div class="ftslots"><div><div class="ftlbl">🧠 Spells</div>${[0, 1, 2].map(i => slot('spell', i)).join('')}</div><div><div class="ftlbl">💪 Moves</div>${[0, 1, 2].map(i => slot('move', i)).join('')}</div>
      <div><div class="ftlbl">Class</div>${csk.length ? csk.map(s => `<div class="ftslot cl" title="${esc(s.d)}"><span>${s.e}</span><b>${esc(s.n)}</b><small>${s.k === 'spell' ? 'Spell' : 'Move'} · ${CD_STAT[s.st][1]}</small></div>`).join('') + `<small class="muted">${esc(FT_CLASS[cls].p)}</small>` : `<div class="ftslot"><small class="muted">${solisHas(CD_CLASS_LV) ? 'Choose your class to get its two skills' : `Classes unlock at level ${CD_CLASS_LV}`}</small></div>`}</div></div>
    ${noGear ? '' : `<div class="ftlbl" style="margin-top:12px">🛡️ Gear</div><div class="ftgear6">${gearSlots}</div>`}
    ${noGear ? '' : bag.length ? `<details class="ftbag"><summary>Gear bag (${bag.length})</summary>${bag.map(p => { const on = st.wear[p.slot] === p.id; const gl = ftGearLv(p); if (!on && lvN < gl) return `<div class="ftbagrow"><span class="ftgear" style="--rc:${ftRar(p.r)[3]}">${p.e} ${ftRar(p.r)[1]} ${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1].toLowerCase()} piece</span> <span class="muted small-text">buffs hidden</span><span class="tag">🔒 Wear at level ${gl}</span><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button></div>`;
      return `<div class="ftbagrow">${ftGearChip(p)} <small class="muted">${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1]}</small>${on ? '<span class="tag">Wearing</span>' : `<button class="btn small" data-ft="wear" data-id="${p.id}">Wear</button><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button>`}</div>`; }).join('')}</details>` : '<p class="muted small-text">Gear drops from Warband fights, spars and duels. Beating the weekly Warband as a house gives everyone who fought a rare or better piece.</p>'}
    <div class="ftlbl" style="margin-top:12px">🛒 Shop</div>
    <div class="seg"><button class="${tab === 'spell' ? 'on' : ''}" data-ft="tab" data-v="spell">Spells (${LUMEN} Lumen)</button><button class="${tab === 'move' ? 'on' : ''}" data-ft="tab" data-v="move">Moves (${EMBER} Ember)</button></div>
    <div class="ftshop">${shop}</div></div>`;
}
const ftScrap = p => [10, 25, 60, 150][FT_RAR.findIndex(x => x[0] === p.r)] || 10;
// the boss panel on the House page
function ftHouseHtml() {
  const b = hsBoss(mondayOf(today())), B = FT_BOSS[b.n], a = ftAttempts(), wk = mondayOf(today()), tb = bossWeek(wk) === 'term';
  return `<div class="card ftbossinfo"><div class="row" style="justify-content:space-between"><h3>${tb ? '👑 Fight the Term Boss,' : '⚔️ Fight'} ${esc(b.n)}</h3><div class="row" style="gap:8px"><button class="btn" data-is="tab" data-v="boss">🏝️ Boss island</button><span class="muted small-text">${a.left ? `${a.left} fight${a.left === 1 ? '' : 's'} left` : (a.rest ? '🌴 Resting' : 'No fights left')}</span></div></div>
    <p class="small-text"><b>Weak to:</b> ${B.wn} · <b>Special:</b> ${esc(B.sp)}</p>
    <p class="small-text"><b>Attacks:</b> ${[...B.atk, ...(B.big ? [B.big] : [])].map(x => esc(x[0])).join(', ')}</p>
    <p class="muted small-text">${FT_WEEK_ATT + a.extra} fights a week${a.extra ? (tb ? ' (3 extra for the Term Boss)' : ' (house island perk included)') : ''}, up to ${FT_DAY_ATT} a day, ${FT_ROUNDS} rounds each. It hits back lightly. Your fights this week: ${a.week}, ${ftWeekDmg(wk).toLocaleString()} damage on the shared bar. Set your build on the <a href="#" data-act="goto" data-v="character">Character</a> page.</p></div>`;
}
// called when your house takes the boss down
function ftHouseKill(wk) {
  const st = ftState(); if (st.kill[wk] || !(st.dmg[wk] > 0)) return;
  st.kill[wk] = 1; for (const k in st.kill) if (k < addDays(wk, -70)) delete st.kill[k];
  if (bossWeek(wk) === 'term') { // 2.63: a Term Boss kill is the main way to get the term's legendary
    const p = ftRollGear(3); ftAddCurrency(100, 100); toast('👑 Term Boss reward', `You fought, so you get ${p.e} ${p.n}, plus 100 Lumen and 100 Ember.`);
  } else { const p = ftRollGear(1); toast('🎁 Boss reward', `You fought, so you get ${p.e} ${p.n}.`); }
  if (Math.random() < CD_RESPEC_DROP) { const c = cdState(); c.respec = (c.respec || 0) + 1; setTimeout(() => toast('📜 Respec Scroll!', 'A very rare drop. Use it on the You page to change your class once.'), 1500); }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-ft]'); if (!el) return;
  const st = ftState(), v = el.dataset;
  switch (v.ft) {
    case 'tab': ui.ftTab = v.v; render(); return;
    case 'buy': {
      const s = ftSkill(v.id), w = cdWallet(); if (!s || st.own.includes(s.id)) return;
      if (solisLevel(w).n < ftSkillLv(s)) { toast('🔒 Locked', `Reach level ${ftSkillLv(s)} to unlock this.`); return; }
      if (s.r === 'legendary' && st.leg[cdTerm()]) return;
      if ((s.k === 'spell' ? w.lumen : w.ember) < s.c) return;
      if (!confirm(`Buy ${s.n} for ${s.c} ${s.k === 'spell' ? 'Lumen' : 'Ember'}?`)) return;
      ftTake(s.k === 'spell' ? s.c : 0, s.k === 'move' ? s.c : 0); st.own.push(s.id);
      if (s.r === 'legendary') st.leg[cdTerm()] = s.n;
      if (st.eq[s.k].length < (s.k === 'spell' ? FT_SPELLS : FT_MOVES)) st.eq[s.k].push(s.id);
      save(); render(); toast(`${s.e} ${s.n} unlocked`, st.eq[s.k].includes(s.id) ? 'Equipped in your build.' : 'Your slots are full: take one off to equip it.'); return;
    }
    case 'equip': { const s = ftSkill(v.id); if (!s || !st.own.includes(s.id) || st.eq[s.k].includes(s.id)) return; const max = s.k === 'spell' ? FT_SPELLS : FT_MOVES; if (st.eq[s.k].length >= max) { toast('Slots full', `Click one of your equipped ${s.k}s to take it off first.`); return; } st.eq[s.k].push(s.id); save(); render(); return; }
    case 'unequip': { const arr = st.eq[v.k]; if (!arr?.[+v.i]) return; if (arr.length === 1 && st.eq[v.k === 'spell' ? 'move' : 'spell'].length === 0) return; arr.splice(+v.i, 1); save(); render(); return; }
    case 'wear': { const p = st.gear.find(x => x.id === v.id); if (p && solisLevel().n < ftGearLv(p)) { toast('🔒 Too heavy for now', `Reach level ${ftGearLv(p)} to wear ${ftRar(p.r)[1].toLowerCase()} gear.`); return; } if (p) { st.wear[p.slot] = p.id; if (ui.gearTry === p.id) ui.gearTry = null; save(); render(); } return; }
    case 'try': ui.gearTry = ui.gearTry === v.id ? null : v.id; render(); return;
    case 'unwear': delete st.wear[v.k]; save(); render(); return;
    case 'scrap': { const p = st.gear.find(x => x.id === v.id); if (!p || Object.values(st.wear).includes(p.id)) return; const n = ftScrap(p); if (!confirm(`Scrap ${p.n} for ${n} Lumen and ${n} Ember?`)) return; st.gear = st.gear.filter(x => x !== p); ftAddCurrency(n, n); save(); render(); return; }
  }
});
