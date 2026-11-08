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
const FT_ATT_CAP = 700, FT_WEEK_CAP = 3500;
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
  tactician: { p: 'Every 3rd round your hits always crit.', sk: { id: 'c_gambit', k: 'spell', n: 'Gambit', e: '♟️', st: 'log', pw: 0, cd: 3, fx: 'buff', d: 'Your next hit does double damage.' } },
  sage: { p: 'Spells do 15% more.', sk: { id: 'c_insight', k: 'spell', n: 'Insight', e: '📜', st: 'kno', pw: 20, cd: 3, fx: 'reveal', t: 'light', d: 'Hits and reveals: your next 2 hits count as super effective.' } },
  bard: { p: 'Heal 4% of your health every round.', sk: { id: 'c_rally', k: 'spell', n: 'Rally', e: '🎻', st: 'exp', pw: 0, cd: 4, fx: 'rally', d: 'Everything you do hits 30% harder for 3 rounds.' } },
  monk: { p: "Can't be stunned, confused or lost in fog.", sk: { id: 'c_still', k: 'spell', n: 'Still Mind', e: '🧘', st: 'foc', pw: 30, cd: 3, fx: 'heal', cleanse: 1, d: 'Heal 30% and clear burns and blindness.' } },
  striker: { p: 'Moves do 15% more.', sk: { id: 'c_blitz', k: 'move', n: 'Blitz', e: '⚡', st: 'spd', pw: 12, hits: 3, cd: 2, t: 'swift', d: 'Three lightning hits.' } },
  ranger: { p: 'Never misses: ignores dodging, fog and blindness.', sk: { id: 'c_mark', k: 'move', n: 'Mark', e: '🏹', st: 'foc', pw: 16, cd: 3, fx: 'mark', t: 'swift', d: 'Hits and marks it: +25% damage taken for 3 rounds.' } },
  guardian: { p: 'Takes 20% less damage.', sk: { id: 'c_bulwark', k: 'move', n: 'Bulwark', e: '🛡️', st: 'str', pw: 40, cd: 3, fx: 'shield', d: 'A shield worth 40% of your health.' } },
  rogue: { p: '20% chance to dodge any hit.', sk: { id: 'c_backstab', k: 'move', n: 'Backstab', e: '🗡️', st: 'agi', pw: 22, cd: 2, t: 'strike', back: 1, d: 'Does 2.5× damage if the target is stunned, blind or confused.' } },
};
// bosses (same names as the weekly house bosses): their own attacks, a weakness and a special rule
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

const ftState = () => { const c = cdState(); return (c.ft = Object.assign({ own: ['spark', 'jab'], eq: { spell: ['spark'], move: ['jab'] }, gear: [], wear: {}, att: {}, dmg: {}, leg: {}, kill: {}, r: 1000, w: 0, l: 0 }, c.ft || {})); };
const ftSkill = id => FT_SKILLS.find(s => s.id === id) || Object.values(FT_CLASS).map(c => c.sk).find(s => s.id === id);
const ftRar = r => FT_RAR.find(x => x[0] === r) || FT_RAR[0];
// 2.51: spells and moves unlock by player level (level.js), cheaper ones first; gear above common needs a level to wear
const ftSkillLv = s => s.lv || (!s.c ? 1 : s.r === 'legendary' ? 18 : s.r === 'epic' ? 12 : s.c <= 120 ? 2 : s.c <= 160 ? 3 : s.c <= 200 ? 4 : s.c <= 240 ? 6 : 8);
const FT_GEAR_LV = { common: 1, rare: 3, epic: 6, legendary: 10 };
const ftGearLv = p => FT_GEAR_LV[p.r] || 1;
const ftWeekDmg = wk => Math.min(FT_WEEK_CAP, Math.round(ftState().dmg[wk] || 0));
function ftAttempts() {
  const st = ftState(), wk = mondayOf(today()); let week = 0;
  for (const [d, n] of Object.entries(st.att)) { if (d >= wk) week += n; else if (d < addDays(wk, -14)) delete st.att[d]; }
  const day = st.att[today()] || 0;
  const extra = typeof hiPerks === 'function' ? hiPerks().at || 0 : 0; // 2.50: house island perks
  return { left: Math.max(0, Math.min(FT_WEEK_ATT + extra - week, FT_DAY_ATT - day)), week, day, extra };
}
// total buffs from what you're wearing
function ftGearBuffs(st = ftState()) {
  const g = {};
  for (const id of Object.values(st.wear)) { const p = st.gear.find(x => x.id === id); if (p) for (const [k, v] of Object.entries(p.b)) g[k] = (g[k] || 0) + v; }
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
  const st = ftState(), ch = cdChar(), cls = cdState().cls, ids = [...st.eq.spell, ...st.eq.move].filter(id => st.own.includes(id));
  if (FT_CLASS[cls]) ids.push(FT_CLASS[cls].sk.id);
  return ftFighter({ n: D.settings.name || 'You', e: CD_CLASSES.find(c => c.id === cls)?.e || '🙂', stats: ch.all, cls, skills: ids.map(ftSkill).filter(Boolean), g: house && typeof hiFightBuffs === 'function' ? hiFightBuffs(ftGearBuffs(st)) : ftGearBuffs(st) });
}
function ftPublish() {
  const st = ftState(), ch = cdChar(), cls = cdState().cls, g = ftGearBuffs(st);
  return { c: cls || '', s: FT_STAT_ORDER.map(k => ch.all[k]), k: [...st.eq.spell, ...st.eq.move].filter(id => st.own.includes(id)).slice(0, 6), g: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Math.round(v * 100) / 100])), r: st.r };
}
// a friend's published character, cleaned up (it came over the network)
function ftGhost(row) {
  const ch = row.raw?.pvp?.ch; if (!ch || !Array.isArray(ch.s)) return null;
  const stats = Object.fromEntries(FT_STAT_ORDER.map((k, i) => [k, Math.max(5, Math.min(99, +ch.s[i] || 5))]));
  const g = {}; for (const k of Object.keys(FT_BUFF)) { const v = +ch.g?.[k]; if (v > 0) g[k] = Math.min(k === 'hp' ? 200 : k === 'rg' ? 25 : .6, v); }
  const cls = FT_CLASS[ch.c] ? ch.c : '';
  const ids = (Array.isArray(ch.k) ? ch.k : []).filter(id => FT_SKILLS.some(s => s.id === id)).slice(0, 6);
  if (!ids.length) ids.push('spark', 'jab'); if (cls) ids.push(FT_CLASS[cls].sk.id);
  return ftFighter({ n: row.name, e: CD_CLASSES.find(c => c.id === cls)?.e || '🙂', stats, cls, skills: ids.map(ftSkill), g });
}

// ---------- the fight ----------
let FT = null;
function ftLog(F, t, cls = '') { F.log.push({ t, cls }); if (F.log.length > 40) F.log.shift(); }
function ftHitBoss(F, n, label) {
  n = Math.max(0, Math.round(n));
  if (F.kind === 'house') { F.dealt += n; } else { F.E.hp = Math.max(0, F.E.hp - n); F.dealt += n; }
  if (label) ftLog(F, `${label}: ${n} damage`, 'good');
}
function ftStart(kind, opt = {}) {
  if (FT) return;
  const P = ftMe(kind === 'house'); let E, bossDef = null, name;
  if (kind === 'duel') { E = ftGhost(opt.row); if (!E) return; }
  else {
    const b = opt.boss || hsBoss(mondayOf(today())); name = b.n; bossDef = FT_BOSS[b.n];
    const hp = kind === 'spar' ? 300 + 4 * cdChar().ovr : Infinity;
    E = { n: b.n, e: b.e, hp, max: hp, stun: 0, blind: 0, confuse: 0, dot: [], mark: 0, shield: 0, awake: 0, seen: 0, boss: 1 };
    bossDef.init?.(E);
  }
  FT = { kind, round: 1, maxR: kind === 'house' ? FT_ROUNDS : FT_SPAR_ROUNDS, P, E, B: bossDef, bossName: name, log: [], dealt: 0, over: false, scale: kind === 'spar' ? 1.6 : kind === 'house' ? .75 : 1, opt };
  const st = ftState();
  // the stake and attempt are taken up front, so closing the app mid-fight can't dodge a loss
  if (kind === 'house') { st.att[today()] = (st.att[today()] || 0) + 1; ftLog(FT, `⚔️ ${name} appears! ${FT_ROUNDS} rounds: hit as hard as you can.`); }
  if (kind === 'spar') { FT.stake = ftTake(25, 25); ftLog(FT, `⚔️ Spar: ${name} (champion). Stake ${FT.stake.l} ${LUMEN} ${FT.stake.e} ${EMBER}.`); }
  if (kind === 'duel') { FT.stake = ftTake(15, 15); FT.rd = 16; st.r -= FT.rd; st.l++; ftLog(FT, `⚔️ Duel vs ${E.n}. Stake ${FT.stake.l} ${LUMEN} ${FT.stake.e} ${EMBER}.`); }
  if (bossDef) ftLog(FT, `💡 Weak to ${bossDef.wn}. ${bossDef.sp}`, 'hint');
  save(); ftTurnStart(FT.P); ftDraw();
}
function ftTurnStart(A) {
  for (const s of A.sk || []) if (s.cdl > 0) s.cdl--;
  if (A.dot?.length) { let n = 0; A.dot = A.dot.filter(d => { n += d.n; return --d.t > 0; }); if (n) ftDamage(FT, A, n, '🔥 Burn', true); }
  if (A.cls === 'bard' && A.hp > 0) ftHeal(FT, A, Math.round(A.max * .04), '');
  if ((A.g?.rg) && A.hp > 0) ftHeal(FT, A, A.g.rg, '');
}
function ftHeal(F, A, n, label) {
  const got = Math.min(n, A.max - A.hp); A.hp += got;
  if (label) ftLog(F, `${label}: +${got} health`, 'good');
  if (got > 0 && A === F.P && F.B?.onHeal) F.B.onHeal(F, got);
}
// damage into a fighter (player or ghost) or into a spar boss
function ftDamage(F, T, n, label, raw) {
  if (T.boss) { ftHitBoss(F, n, label); return n; }
  if (!raw) {
    const dg = Math.min(.4, (T.g?.dg || 0) + (T.cls === 'rogue' ? .2 : 0));
    if (Math.random() < dg) { ftLog(F, `${label}: ${T === F.P ? 'you dodge' : T.n + ' dodges'}!`); return 0; }
    n *= 1 - Math.min(.5, (T.g?.dr || 0) + (T.cls === 'guardian' ? .2 : 0));
  }
  n = Math.max(1, Math.round(n));
  const sh = Math.min(T.shield, n); T.shield -= sh; const hit = n - sh; T.hp = Math.max(0, T.hp - hit);
  ftLog(F, `${label}: ${hit}${sh ? ` (${sh} blocked)` : ''} to ${T === F.P ? 'you' : T.n}`, T === F.P ? 'bad' : 'good');
  return hit;
}
const ftWeakOf = (F, s) => F.B ? F.B.weak(s) : false;
function ftUse(F, A, T, s) {
  const me = A === F.P;
  if (A.confuse > 0 && A.cls !== 'monk') { A.confuse--; const ok = A.sk.filter(x => !x.cdl); s = ok[Math.floor(Math.random() * ok.length)]; ftLog(F, `😵 ${me ? 'You are' : A.n + ' is'} confused and use ${s.n}`); }
  s.cdl = s.cd + 1; A.chain = s.k === 'move' ? A.chain + 1 : 0;
  const stat = A.s[s.st] || 5, power = .5 + stat / 80, who = me ? 'You' : A.n;
  if (s.fx === 'heal') { ftHeal(F, A, Math.round(A.max * s.pw / 100 * (.7 + stat / 150)), `${s.e} ${who}: ${s.n}`); if (s.cleanse) { A.dot = []; A.blind = 0; } }
  else if (s.fx === 'shield') { const n = Math.round(A.max * s.pw / 100 * (.7 + stat / 150)); A.shield += n; ftLog(F, `${s.e} ${who}: ${s.n} (+${n} shield)`, 'good'); }
  else if (s.fx === 'buff') { A.buff = 2; ftLog(F, `${s.e} ${who}: ${s.n}. Next hit ×2`, 'good'); }
  else if (s.fx === 'rally') { A.rally = 3; ftLog(F, `${s.e} ${who}: ${s.n}. +30% for 3 rounds`, 'good'); }
  if (s.pw && !['heal', 'shield'].includes(s.fx)) {
    if (s.fx === 'reveal') A.reveal = 2;
    for (let h = 0; h < (s.hits || 1); h++) {
      if (T.hp <= 0 && !T.boss) break;
      const sure = A.cls === 'ranger';
      if (A.blind > 0 && !sure) { A.blind--; if (Math.random() < .5) { ftLog(F, `${s.e} ${s.n} misses (blinded)`); continue; } }
      if (T.boss && F.B?.dodge && !sure && Math.random() < F.B.dodge(F)) { ftLog(F, `${s.e} ${s.n} disappears into the fog`); continue; }
      let n = s.pw * power * (1 + (s.k === 'spell' ? A.g.sp || 0 : A.g.mv || 0));
      if ((A.cls === 'sage' && s.k === 'spell') || (A.cls === 'striker' && s.k === 'move')) n *= 1.15;
      if (A.rally > 0) n *= 1.3;
      n *= A.buff; if (T.mark > 0) n *= 1.25;
      if (A.slow > 0 && s.k === 'move') n *= .8;
      if (s.back && (T.stun > 0 || T.blind > 0 || T.confuse > 0)) n *= 2.5 / 1.2; if (s.back) n *= 1.2;
      let tag = '';
      if (T.boss && (ftWeakOf(F, s) || A.reveal > 0)) { n *= 1.5 + (A.g.wk || 0); tag = ' 💥 super effective'; if (A.reveal > 0 && s.fx !== 'reveal') A.reveal--; }
      if (T.boss && F.B?.dmgIn) n *= F.B.dmgIn(F, s);
      const crit = (A.cls === 'tactician' && F.round % 3 === 0) || Math.random() < .05 + (A.g.cr || 0);
      if (crit) { n *= 1.5; tag += ' ⚡ crit'; }
      n *= .9 + Math.random() * .2;
      if (T.boss && n <= 0) { ftLog(F, `${s.e} ${s.n} goes straight through it`); continue; }
      ftDamage(F, T, n, `${s.e} ${who}: ${s.n}${tag}`);
    }
    A.buff = 1;
    if (s.dot) T.dot.push({ n: Math.round(s.dot * power), t: 3 });
    if (s.stun && Math.random() < s.stun && !(T.cls === 'monk')) { T.stun = Math.max(T.stun, 1); ftLog(F, `💫 ${T === F.P ? 'You are' : T.n + ' is'} stunned`); }
    if (s.fx === 'mark') T.mark = 3;
    if (s.heal) ftHeal(F, A, Math.round(A.max * s.heal / 100), `${s.e} ${s.n}`);
    if (T.boss && F.B?.after) F.B.after(F, s);
  }
  A.lastSt = s.st;
  if (A.rally > 0 && s.fx !== 'rally') A.rally--;
}
function ftBossTurn(F) {
  const E = F.E, B = F.B, P = F.P;
  for (const k of ['mark', 'awake', 'seen']) if (E[k] > 0) E[k]--;
  if (E.dot.length) { let n = 0; E.dot = E.dot.filter(d => { n += d.n; return --d.t > 0; }); if (n) ftHitBoss(F, n, '🔥 Burn'); }
  if (F.kind === 'spar' && E.hp <= 0) return;
  if (E.stun > 0) { E.stun--; ftLog(F, `💫 ${E.n} is stunned and can't attack`); return; }
  B.round?.(F);
  const big = B.big && (B.bigIf ? B.bigIf(F) : F.round % 3 === 0);
  const a = big ? B.big : B.atk[Math.floor(Math.random() * B.atk.length)];
  const [an, base, fx, ch = 1, hits = 1] = a;
  const dmg = (B.atkDmg ? B.atkDmg(F) : base) * F.scale;
  for (let i = 0; i < hits; i++) { const hit = ftDamage(F, P, dmg * (.85 + Math.random() * .3), `${E.e} ${an}${big ? '!' : ''}`); if (fx === 'drain' && hit && F.kind === 'spar') E.hp = Math.min(E.max, E.hp + hit); }
  if (fx && fx !== 'drain' && Math.random() < ch) {
    if ((fx === 'stun' || fx === 'confuse') && P.cls === 'monk') ftLog(F, '🧘 Your calm shrugs it off');
    else if (fx === 'stun') { P.stun = 1; ftLog(F, '💫 You lose your next turn', 'bad'); }
    else if (fx === 'blind') { P.blind = 2; ftLog(F, '🌑 You are blinded (50% miss)', 'bad'); }
    else if (fx === 'confuse') { P.confuse = 1; ftLog(F, '😵 You are confused', 'bad'); }
    else if (fx === 'slow') { P.slow = 2; ftLog(F, '🐌 Your moves are slowed (−20%)', 'bad'); }
    else if (fx === 'dot') { P.dot.push({ n: Math.round(5 * F.scale), t: 3 }); ftLog(F, '😰 Panic: you burn for 3 rounds', 'bad'); }
  }
  if (!big && B.big && !B.bigIf && (F.round + 1) % 3 === 0) ftLog(F, `⚠️ ${E.n} is winding up a ${B.big[0]}...`, 'hint');
}
function ftGhostTurn(F) {
  const E = F.E, P = F.P;
  ftTurnStart(E); if (E.hp <= 0) return;
  if (E.stun > 0) { E.stun--; ftLog(F, `💫 ${E.n} is stunned`); return; }
  const ok = E.sk.filter(s => !s.cdl), low = E.hp < E.max * .4;
  const pick = (low && ok.find(s => s.fx === 'heal' || s.fx === 'shield')) || ok.filter(s => s.pw && !['heal', 'shield'].includes(s.fx)).sort((a, b) => b.pw * (b.hits || 1) - a.pw * (a.hits || 1))[0] || ok[0];
  ftUse(F, E, P, pick);
}
// you pick a skill: your turn, then theirs, then the next round
function ftAct(id) {
  const F = FT; if (!F || F.over) return;
  const s = F.P.sk.find(x => x.id === id); if (!s || s.cdl) return;
  ftUse(F, F.P, F.E, s);
  ftAfterPlayer(F);
}
function ftAfterPlayer(F) {
  if (ftCheck(F)) return ftDraw();
  if (F.kind === 'duel') ftGhostTurn(F); else ftBossTurn(F);
  if (ftCheck(F)) return ftDraw();
  F.round++;
  if (F.round > F.maxR) { ftEnd(F, F.kind === 'house' ? 'time' : F.P.hp / F.P.max > F.E.hp / F.E.max ? 'win' : 'loss'); return ftDraw(); }
  ftTurnStart(F.P);
  if (ftCheck(F)) return ftDraw();
  if (F.P.stun > 0) { F.P.stun--; ftLog(F, '💫 You are stunned and skip this turn', 'bad'); F.P.chain = 0; ftDraw(); setTimeout(() => FT === F && ftAfterPlayer(F), 700); return; }
  ftDraw();
}
function ftCheck(F) {
  if (F.over) return true;
  if (F.P.hp <= 0) { ftEnd(F, F.kind === 'house' ? 'down' : 'loss'); return true; }
  if (F.kind !== 'house' && F.E.hp <= 0) { ftEnd(F, 'win'); return true; }
  return false;
}
function ftEnd(F, how) {
  F.over = true; const st = ftState(), out = [];
  if (F.kind === 'house') {
    const wk = mondayOf(today()), before = st.dmg[wk] || 0, n = Math.min(FT_ATT_CAP, Math.round(F.dealt)), add = Math.max(0, Math.min(n, FT_WEEK_CAP - before));
    st.dmg[wk] = before + add; for (const k in st.dmg) if (k < addDays(wk, -35)) delete st.dmg[k];
    out.push(`<b>${add.toLocaleString()}</b> damage added to ${esc(F.bossName)}'s shared health bar${add < F.dealt ? ` (capped at ${FT_ATT_CAP} a fight, ${FT_WEEK_CAP.toLocaleString()} a week)` : ''}.`);
    out.push(how === 'down' ? 'It knocked you out, but every hit you landed still counts.' : 'You lasted all the rounds.');
    if (Math.random() < Math.min(.6, .2 + add / 1200)) { const p = ftRollGear(); out.push(`Gear drop: ${ftGearChip(p)}`); }
    hsLoad(true);
  } else {
    const won = how === 'win';
    if (won) {
      const rw = F.kind === 'spar' ? 35 : 20; ftAddCurrency(F.stake.l + rw, F.stake.e + rw);
      out.push(`You win! +${rw} ${LUMEN} +${rw} ${EMBER} and your stake back.`);
      if (F.kind === 'duel') { const g = Math.round(16 + Math.max(-8, Math.min(8, ((+F.opt.row.raw.pvp.ch.r || 1000) - st.r) / 25))); st.r += F.rd + g; st.l--; st.w++; out.push(`Rating +${g} (now ${st.r}).`); }
      if (Math.random() < (F.kind === 'spar' ? .5 : .3)) { const p = ftRollGear(); out.push(`Gear drop: ${ftGearChip(p)}`); }
    } else {
      out.push(`You lost the stake (${F.stake.l} ${LUMEN} ${F.stake.e} ${EMBER})${F.kind === 'duel' ? ` and ${F.rd} rating (now ${st.r})` : ''}.`);
    }
  }
  F.res = { how, out }; save();
}
function ftGearChip(p) { const R = ftRar(p.r); return `<span class="ftgear" style="--rc:${R[3]}">${p.e} ${esc(p.n)}</span> <span class="muted small-text">${ftBuffText(p.b)}</span>`; }

// ---------- drawing the fight ----------
function ftBar(hp, max, cls) { return `<div class="ftbar ${cls}"><i style="width:${Math.max(0, hp / max * 100)}%"></i><span>${Math.round(hp)} / ${max}</span></div>`; }
function ftChips(A, F) {
  const c = [];
  if (A.shield) c.push(`🔰 ${A.shield}`); if (A.stun) c.push('💫 Stunned'); if (A.blind) c.push('🌑 Blind'); if (A.confuse) c.push('😵 Confused'); if (A.slow) c.push('🐌 Slowed');
  if (A.dot?.length) c.push('🔥 Burning'); if (A.mark) c.push('🏹 Marked'); if (A.rally) c.push('🎻 Rally'); if (A.buff > 1) c.push('♟️ ×2 ready'); if (A.reveal) c.push(`📖 Weak spot ×${A.reveal}`);
  if (A.boss && F.B?.chips) { const x = F.B.chips(A, F); if (x) c.push(x); }
  return c.map(x => `<span class="ftchip">${x}</span>`).join('');
}
function ftDraw() {
  const F = FT; let ov = $('#ftov');
  if (!F) { ov?.remove(); return; }
  if (!ov) { ov = document.createElement('div'); ov.id = 'ftov'; document.body.appendChild(ov); }
  const P = F.P, E = F.E;
  const foe = F.kind === 'house' ? `<div class="ftdealt">Damage this fight: <b>${Math.round(F.dealt).toLocaleString()}</b></div>` : ftBar(E.hp, E.max, 'foe');
  const btn = s => { const sp = s.k === 'spell', weak = F.B && ftWeakOf(F, s); return `<button class="ftsk ${sp ? 'ftsp' : 'ftmv'} ${s.id.startsWith('c_') ? 'ftcl' : ''}" data-ft="act" data-id="${s.id}" ${s.cdl || F.over ? 'disabled' : ''} title="${esc(s.d)}"><span>${s.e}</span><b>${esc(s.n)}</b><small>${s.cdl ? `ready in ${s.cdl}` : `${CD_STAT[s.st][1]}${s.pw && !['heal', 'shield'].includes(s.fx) ? ` · ${s.pw}${s.hits ? '×' + s.hits : ''}` : ''}${weak ? ' · 💥' : ''}`}</small></button>`; };
  ov.innerHTML = `<div class="ftbox ${F.over ? 'over' : ''}">
    <div class="ftfoe"><div class="fte">${E.e}</div><div class="ftmain"><div class="muted small-text">${F.kind === 'house' ? 'WEEKLY HOUSE BOSS' : F.kind === 'spar' ? 'SPAR · CHAMPION' : 'DUEL'} · Round ${Math.min(F.round, F.maxR)} of ${F.maxR}</div><h2>${esc(E.n)}</h2>${foe}<div class="ftchips">${ftChips(E, F)}</div></div></div>
    <div class="ftlog">${F.log.slice(-7).map(l => `<div class="${l.cls}">${l.t}</div>`).join('')}</div>
    <div class="ftme"><div class="row" style="justify-content:space-between"><b>${P.e} ${esc(P.n)}${P.cls ? ` · ${CD_CLASSES.find(c => c.id === P.cls).n}` : ''}</b><div class="ftchips">${ftChips(P, F)}</div></div>${ftBar(P.hp, P.max, 'me')}</div>
    ${F.over ? `<div class="ftres"><h3>${{ win: '🏆 Victory', loss: '💀 Defeat', down: '💥 Knocked out', time: '⏱️ Time' }[F.res.how]}</h3>${F.res.out.map(x => `<p>${x}</p>`).join('')}<button class="btn primary" data-ft="close">Done</button></div>`
      : `<div class="ftsks">${P.sk.map(btn).join('')}</div><div class="row" style="justify-content:space-between"><span class="muted small-text">Hover a skill to see what it does. 💥 = super effective here.</span><button class="btn small ghost" data-ft="flee">${F.kind === 'house' ? 'End fight' : 'Give up'}</button></div>`}
  </div>`;
  const lg = ov.querySelector('.ftlog'); if (lg) lg.scrollTop = lg.scrollHeight;
}

// ---------- the Build card on the Character page ----------
function ftBuildHtml() {
  const st = ftState(), w = cdWallet(), cls = cdState().cls, me = ftMe(), g = ftGearBuffs(st), tab = ui.ftTab || 'spell';
  const slot = (k, i) => { const id = st.eq[k][i], s = id && ftSkill(id); return `<button class="ftslot ${k}" data-ft="unequip" data-k="${k}" data-i="${i}" title="${s ? esc(s.d) + ' (click to take off)' : 'Empty: equip one from your collection below'}">${s ? `<span>${s.e}</span><b>${esc(s.n)}</b><small>${CD_STAT[s.st][1]}</small>` : '<span class="muted">+</span><small class="muted">Empty</small>'}</button>`; };
  const csk = FT_CLASS[cls]?.sk;
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
    <p class="muted small-text">New spells and moves unlock as you level up (what they do is hidden until then), and rare, epic and legendary gear can be worn from levels ${FT_GEAR_LV.rare}, ${FT_GEAR_LV.epic} and ${FT_GEAR_LV.legendary}. Equip up to ${FT_SPELLS} spells (Mind) and ${FT_MOVES} moves (Body). Each one scales with the stat shown, so your cards matter. Your class skill is always in. Change your build any time outside a fight.</p>
    <div class="ftslots"><div><div class="ftlbl">🧠 Spells</div>${[0, 1, 2].map(i => slot('spell', i)).join('')}</div><div><div class="ftlbl">💪 Moves</div>${[0, 1, 2].map(i => slot('move', i)).join('')}</div>
      <div><div class="ftlbl">Class</div>${csk ? `<div class="ftslot cl" title="${esc(csk.d)}"><span>${csk.e}</span><b>${csk.n}</b><small>${esc(FT_CLASS[cls].p)}</small></div>` : '<div class="ftslot"><small class="muted">Pick a class above to get its skill</small></div>'}</div></div>
    <div class="ftlbl" style="margin-top:12px">🛡️ Gear</div><div class="ftgear6">${gearSlots}</div>
    ${bag.length ? `<details class="ftbag"><summary>Gear bag (${bag.length})</summary>${bag.map(p => { const on = st.wear[p.slot] === p.id; const gl = ftGearLv(p); if (!on && lvN < gl) return `<div class="ftbagrow"><span class="ftgear" style="--rc:${ftRar(p.r)[3]}">${p.e} ${ftRar(p.r)[1]} ${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1].toLowerCase()} piece</span> <span class="muted small-text">buffs hidden</span><span class="tag">🔒 Wear at level ${gl}</span><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button></div>`;
      return `<div class="ftbagrow">${ftGearChip(p)} <small class="muted">${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1]}</small>${on ? '<span class="tag">Wearing</span>' : `<button class="btn small" data-ft="wear" data-id="${p.id}">Wear</button><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button>`}</div>`; }).join('')}</details>` : '<p class="muted small-text">Gear drops from house boss fights, spars and duels. Beating the weekly boss as a house gives everyone who fought a rare or better piece.</p>'}
    <div class="ftlbl" style="margin-top:12px">🛒 Shop</div>
    <div class="seg"><button class="${tab === 'spell' ? 'on' : ''}" data-ft="tab" data-v="spell">Spells (${LUMEN} Lumen)</button><button class="${tab === 'move' ? 'on' : ''}" data-ft="tab" data-v="move">Moves (${EMBER} Ember)</button></div>
    <div class="ftshop">${shop}</div></div>`;
}
const ftScrap = p => [10, 25, 60, 150][FT_RAR.findIndex(x => x[0] === p.r)] || 10;
// the Battles card: spar any boss, duel friends
function ftBattlesHtml() {
  const st = ftState();
  if (acct.signedIn && typeof refreshFriends === 'function') refreshFriends();
  const duels = friendRows.filter(f => f.raw?.pvp?.ch?.s);
  return `<div class="card"><h3>🥊 Battles</h3><p class="muted small-text">Optional and risky. A spar or duel takes a stake when it starts (25 ${LUMEN} + 25 ${EMBER} to spar, 15 each to duel). Win and you get it back plus a reward and a chance at gear. Lose and it's gone.</p>
    <div class="ftlbl">Spar a champion boss</div><div class="ftbosses">${HS_BOSSES.map(b => `<button class="ftbossbtn" data-ft="spar" data-n="${esc(b.n)}" title="${esc(FT_BOSS[b.n].sp)}"><span>${b.e}</span><small>${esc(b.n)}</small></button>`).join('')}</div>
    <div class="ftlbl" style="margin-top:10px">Duel a friend's character · your rating ${st.r} (${st.w}W ${st.l}L)</div>
    ${duels.length ? `<ul class="cdlog">${duels.map(f => { const c = f.raw.pvp.ch, cl = CD_CLASSES.find(x => x.id === c.c); return `<li><b>${esc(f.name)}</b><span class="muted">${cl ? cl.e + ' ' + cl.n : 'No class'} · rating ${+c.r || 1000}</span><button class="btn small" data-ft="duel" data-u="${esc(f.user)}">Duel</button></li>`; }).join('')}</ul>` : `<p class="muted small-text">${acct.signedIn ? 'None of your friends have a character on Solis 2.48 yet.' : 'Sign in on the Friends page to duel your friends.'} The computer plays their build, so they don't need to be online.</p>`}</div>`;
}
// the boss panel on the House page
function ftHouseHtml() {
  const b = hsBoss(mondayOf(today())), B = FT_BOSS[b.n], a = ftAttempts(), wk = mondayOf(today());
  return `<div class="card ftbossinfo"><div class="row" style="justify-content:space-between"><h3>⚔️ Fight ${esc(b.n)}</h3><div class="row" style="gap:8px"><button class="btn" data-is="tab" data-v="boss">🏝️ Boss island</button><button class="btn primary" data-ft="house" ${a.left ? '' : 'disabled'}>${a.left ? `Fight (${a.left} left)` : 'No fights left'}</button></div></div>
    <p class="small-text"><b>Weak to:</b> ${B.wn} · <b>Special:</b> ${esc(B.sp)}</p>
    <p class="small-text"><b>Attacks:</b> ${[...B.atk, ...(B.big ? [B.big] : [])].map(x => esc(x[0])).join(', ')}</p>
    <p class="muted small-text">${FT_WEEK_ATT + a.extra} fights a week${a.extra ? ' (house island perk included)' : ''}, up to ${FT_DAY_ATT} a day, ${FT_ROUNDS} rounds each. It hits back lightly. Your fights this week: ${a.week}, ${ftWeekDmg(wk).toLocaleString()} damage on the shared bar. Set your build on the <a href="#" data-act="goto" data-v="character">Character</a> page.</p></div>`;
}
// called when your house takes the boss down
function ftHouseKill(wk) {
  const st = ftState(); if (st.kill[wk] || !(st.dmg[wk] > 0)) return;
  st.kill[wk] = 1; for (const k in st.kill) if (k < addDays(wk, -70)) delete st.kill[k];
  const p = ftRollGear(1); toast('🎁 Boss reward', `You fought, so you get ${p.e} ${p.n}.`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-ft]'); if (!el) return;
  const st = ftState(), v = el.dataset;
  switch (v.ft) {
    case 'act': ftAct(v.id); return;
    case 'flee': if (!FT || FT.over) return; if (FT.kind !== 'house' && !confirm('Give up? You lose the stake.')) return; ftEnd(FT, FT.kind === 'house' ? 'time' : 'loss'); ftDraw(); return;
    case 'close': FT = null; ftDraw(); render(); return;
    case 'house': if (ftAttempts().left) ftStart('house'); return;
    case 'spar': { const b = HS_BOSSES.find(x => x.n === v.n); if (b && confirm(`Spar the champion ${b.n}? Stake: 25 ${LUMEN} and 25 ${EMBER}.`)) ftStart('spar', { boss: b }); return; }
    case 'duel': { const row = friendRows.find(f => f.user === v.u); if (row && confirm(`Duel ${row.name}? Stake: 15 ${LUMEN} and 15 ${EMBER}, plus rating.`)) ftStart('duel', { row }); return; }
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
    case 'wear': { const p = st.gear.find(x => x.id === v.id); if (p && solisLevel().n < ftGearLv(p)) { toast('🔒 Too heavy for now', `Reach level ${ftGearLv(p)} to wear ${ftRar(p.r)[1].toLowerCase()} gear.`); return; } if (p) { st.wear[p.slot] = p.id; save(); render(); } return; }
    case 'unwear': delete st.wear[v.k]; save(); render(); return;
    case 'scrap': { const p = st.gear.find(x => x.id === v.id); if (!p || Object.values(st.wear).includes(p.id)) return; const n = ftScrap(p); if (!confirm(`Scrap ${p.n} for ${n} Lumen and ${n} Ember?`)) return; st.gear = st.gear.filter(x => x !== p); ftAddCurrency(n, n); save(); render(); return; }
  }
});
