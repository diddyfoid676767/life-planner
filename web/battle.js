'use strict';
/* Battles: each round the rival shows what it's about to do, and you answer
   with an attack, a special move, a block, a dodge or a counter. Attacks and
   blocks are timed on a moving bar, and every move costs energy. Bosses have
   their own fighting style, taunts and a second phase. Also: a daily
   challenge rival and Survival mode (waves until you drop). */

// The move book: basic attacks are free; the rest unlock with Grit once a stat
// is high enough, and every move levels up to 5. You take 4 into a fight.
const MOVE_BOOK = [
  ...STAT_IDS.map(k => ({ id: 'b_' + k, stat: k, icon: MOVES[k][0], name: MOVES[k][1], cost: 10, mult: 1, need: 0, price: 0, basic: true, note: `A solid ${statInfo(k)[1].toLowerCase()} attack.` })),
  { id: 'jab', stat: 'spd', need: 35, price: 60, icon: '👊', name: 'Quick jab', cost: 4, mult: .75, note: 'Cheap and quick, for when you\'re low on energy.' },
  { id: 'bump', stat: 'str', need: 40, price: 90, icon: '💪', name: 'Hip and shoulder', cost: 10, mult: 1.15, refund: 12, note: 'A solid hit that gives you 12 energy back.' },
  { id: 'wind', stat: 'end', need: 42, price: 120, icon: '🫁', name: 'Second wind', cost: 20, heal: 24, gain: 30, once: true, note: 'Heal 24 HP and get 30 energy back. Once a fight.' },
  { id: 'dash', stat: 'spd', need: 45, price: 150, icon: '💨', name: 'Sprint dash', cost: 35, mult: 1.8, pierce: .6, anim: 'dash', note: 'Big hit that mostly cuts through a guard.' },
  { id: 'ankle', stat: 'agi', need: 45, price: 160, icon: '🌀', name: 'Ankle breaker', cost: 30, mult: 1.25, autododge: true, anim: 'ankle', note: 'Hit, then you dodge their next attack for sure.' },
  { id: 'tackle', stat: 'pow', need: 50, price: 200, icon: '🏉', name: 'Power tackle', cost: 40, mult: 2, pierce: 1, anim: 'tackle', note: 'Smashes straight through any guard.' },
  { id: 'banana', stat: 'agi', need: 50, price: 220, icon: '🍌', name: 'Banana kick', cost: 30, mult: 1.4, crit: .35, anim: 'ankle', note: '35% chance of a critical hit for double damage.' },
  { id: 'bulldoze', stat: 'str', need: 52, price: 240, icon: '🦏', name: 'Bulldozer', cost: 45, mult: 1.45, stun: true, anim: 'bulldoze', note: 'Hits and stuns them, so they lose their next move.' },
  { id: 'lungs', stat: 'end', need: 55, price: 260, icon: '🧱', name: 'Iron lungs', cost: 20, heal: 12, shield: .5, note: 'Heal 12 and take half damage this round.' },
  { id: 'fend', stat: 'str', need: 60, price: 320, icon: '✋', name: 'Don\'t-argue', cost: 35, mult: 1.35, shield: .5, anim: 'tackle', note: 'Hit, and take half damage this round.' },
  { id: 'speccy', stat: 'pow', need: 62, price: 380, icon: '🦘', name: 'Speccy', cost: 55, mult: 2.5, anim: 'speccy', note: 'A huge leap over them for massive damage.' },
  { id: 'blindturn', stat: 'agi', need: 65, price: 420, icon: '🌪️', name: 'Blind turn', cost: 45, mult: 1.7, autododge: true, pierce: .5, anim: 'ankle', note: 'Big hit, and you dodge their next attack.' },
];
const MAX_MOVE_LV = 5;
const moveById = id => MOVE_BOOK.find(m => m.id === id);
const moveLv = id => (D.arena.moveLv || {})[id] || 1;
const ownsMove = m => m.basic || !!(D.arena.movesOwned || {})[m.id];
const moveCost = m => m.basic ? m.cost : Math.max(0, m.cost - 2 * (moveLv(m.id) - 1));
const movePow = m => 1 + .1 * (moveLv(m.id) - 1);
const upgradePrice = m => (m.basic ? 50 : Math.round(m.price * .6)) * moveLv(m.id);
function moveSet() {
  const set = (D.arena.moveset || []).map(moveById).filter(m => m && ownsMove(m)).slice(0, 4);
  if (set.length) return set;
  const st = battleStats(); return MOVE_BOOK.filter(m => m.basic).sort((a, b) => st[b.stat] - st[a.stat]).slice(0, 4);
}
function moveUnlock(id) {
  const m = moveById(id), st = athlete().total; if (!m || ownsMove(m)) return;
  if (st[m.stat] < m.need) { toast('Not strong enough yet', `${m.name} needs ${statInfo(m.stat)[1]} ${m.need}. Train it up.`); return; }
  if (grit() < m.price) { toast('Not enough Grit', `${m.name} costs ${m.price} ${GRIT}.`); return; }
  D.arena.spent += m.price; D.arena.movesOwned = { ...(D.arena.movesOwned || {}), [id]: new Date().toISOString() };
  const set = moveSet().map(x => x.id); if (set.length < 4) D.arena.moveset = [...set, id];
  save(); render(); celebrate({ icon: `<span class="critbig">${m.icon}</span>`, color: statInfo(m.stat)[3], kicker: 'New move', title: m.name, text: `${m.note} Put it in your move set to use it in battle.` });
}
function moveUpgrade(id) {
  const m = moveById(id); if (!m || !ownsMove(m) || moveLv(id) >= MAX_MOVE_LV) return;
  const p = upgradePrice(m); if (grit() < p) { toast('Not enough Grit', `Upgrading costs ${p} ${GRIT}.`); return; }
  D.arena.spent += p; D.arena.moveLv = { ...(D.arena.moveLv || {}), [id]: moveLv(id) + 1 };
  save(); render(); toast(`${m.icon} ${m.name} is now level ${moveLv(id)}`, m.basic ? '+10% damage.' : '+10% power and 2 less energy.');
}
function moveEquip(id) {
  const m = moveById(id); if (!m || !ownsMove(m)) return;
  let set = moveSet().map(x => x.id);
  if (set.includes(id)) { if (set.length <= 1) return; set = set.filter(x => x !== id); }
  else { if (set.length >= 4) { toast('Your move set is full', 'Take a move out first. You can carry 4.'); return; } set.push(id); }
  D.arena.moveset = set; save(); render();
}
const lvPips = id => `<span class="lvpips">${Array.from({ length: MAX_MOVE_LV }, (_, k) => `<i class="${k < moveLv(id) ? 'on' : ''}"></i>`).join('')}</span>`;
function arenaMoves() {
  const st = athlete().total, set = moveSet().map(m => m.id), g = grit();
  const card = m => {
    const own = ownsMove(m), can = st[m.stat] >= m.need, inSet = set.includes(m.id), lv = moveLv(m.id), col = statInfo(m.stat)[3];
    const fx = [m.mult && `${Math.round(m.mult * movePow(m) * 100)}% power`, m.heal && `heals ${Math.round(m.heal * movePow(m))}`, m.pierce && 'breaks guard', m.stun && 'stuns', m.autododge && 'auto-dodge', m.crit && 'crits', m.shield && 'half damage taken', m.refund && `+${m.refund} energy`].filter(Boolean).join(' · ');
    return `<div class="mvcard ${own ? 'own' : ''} ${inSet ? 'inset' : ''} ${!own && !can ? 'locked' : ''}" style="--sc:${col}">
      <div class="mvtop"><span class="mvic">${own || can ? m.icon : '🔒'}</span><div class="main"><b>${esc(m.name)}</b><div class="muted small-text">${statInfo(m.stat)[2]} · ⚡${moveCost(m)}${own ? ` · Lv ${lv}` : ''}</div></div>${own ? lvPips(m.id) : ''}</div>
      <p class="small-text">${esc(m.note)}</p><div class="muted small-text">${fx}</div>
      <div class="row mvbtns">${own ? `<button class="btn small ${inSet ? '' : 'primary'}" data-act="moveEquip" data-id="${m.id}">${inSet ? 'Take out' : '+ Move set'}</button>${lv < MAX_MOVE_LV ? `<button class="btn small" data-act="moveUpgrade" data-id="${m.id}" ${g >= upgradePrice(m) ? '' : 'disabled'}>⬆ Lv ${lv + 1} · ${upgradePrice(m)} ${GRIT}</button>` : '<span class="tag green">Max level</span>'}`
        : can ? `<button class="btn small primary" data-act="moveUnlock" data-id="${m.id}" ${g >= m.price ? '' : 'disabled'}>Unlock · ${m.price} ${GRIT}</button>` : `<span class="muted small-text">Needs ${statInfo(m.stat)[1]} ${m.need} (you have ${st[m.stat]})</span>`}</div></div>`;
  };
  return `<div class="card"><div class="card-head"><h2>🎒 Your move set</h2><span class="muted small-text">you take these 4 into every battle</span><span class="pill">${GRIT} ${g}</span></div>
    <div class="mvset">${[0, 1, 2, 3].map(k => { const m = moveById(set[k]); return m ? `<div class="mvslot" style="--sc:${statInfo(m.stat)[3]}"><span>${m.icon}</span><b>${esc(m.name)}</b><small>Lv ${moveLv(m.id)} · ⚡${moveCost(m)}</small></div>` : '<div class="mvslot empty">Empty slot</div>'; }).join('')}</div>
    <p class="muted small-text" style="margin-bottom:0">Block, Dodge and Counter are always available. New moves unlock as your stats grow from training.</p></div>
    <div class="card"><div class="card-head"><h2>📖 Move book</h2><span class="muted small-text">${MOVE_BOOK.filter(ownsMove).length} / ${MOVE_BOOK.length} learned</span></div>
    <div class="mvgrid">${MOVE_BOOK.map(card).join('')}</div></div>`;
}
const DEFENCES = {
  block: { icon: '🛡️', name: 'Block', cost: 0, note: 'Take much less damage and get +15 energy. Time it perfectly to take none and hit back.' },
  dodge: { icon: '↪️', name: 'Dodge', cost: 15, note: 'Avoid the hit completely, or not at all. Agility helps, and it\'s easier against big, slow hits.' },
  counter: { icon: '🔁', name: 'Counter', cost: 20, note: 'Against a normal attack: take half and hit back hard. Fails against big hits.' },
};
const ATTACK_COST = 10, TIMING = { perfect: [1.6, 'PERFECT!'], good: [1.25, 'Great!'], ok: [1, 'OK'], miss: [.5, 'Mistimed'] };
// how each boss fights
const BOSS_AI = {
  coach: { mix: { atk: 4, heavy: 2, guard: 3 }, every: 3, taunts: ['Is that all you\'ve got?', 'Ten more laps if you lose!', 'My nan hits harder.'],
    special: { name: 'Extra laps!', kind: 'drain', hint: 'Drains 35 of your energy. Block or dodge it.' },
    phase: { line: 'Right, NOW I\'m angry. Line up!', every: 2, mix: { atk: 5, heavy: 3, guard: 1 } } },
  storm: { mix: { atk: 6, heavy: 2, guard: 1 }, every: 3, fast: 1.15, taunts: ['Too slow!', 'You can\'t catch the wind.', 'Spin cycle incoming.'],
    special: { name: 'Twister', kind: 'double', hint: 'Hits twice. A good dodge beats both.' },
    phase: { line: 'The storm gets stronger!', every: 2, fast: 1.45 } },
  titan: { mix: { atk: 2, heavy: 5, guard: 2 }, every: 3, taunts: ['I am the mountain.', 'You will break first.', 'Tiny human.'],
    special: { name: 'Earthquake slam', kind: 'quake', hint: 'Can\'t be blocked or countered. Dodge it!' },
    phase: { line: 'The Titan hardens into stone. It takes less damage now.', every: 3, armour: .75 } },
  goat: { mix: { atk: 4, heavy: 3, guard: 2 }, every: 3, taunts: ['I\'ve seen your moves before.', 'Greatness is a habit.', 'Nice try. Again?'],
    special: { name: 'Greatest of all time', kind: 'copy', hint: 'Copies your best stat and hits with +20. Dodge or block.' },
    phase: { line: 'The GOAT digs deep and heals!', every: 2, heal: 35 } },
};
BOSS_AI.yeti = { mix: { atk: 3, heavy: 4, guard: 2 }, every: 3, taunts: ['RAAAWR.', '...', '*stares through you*'],
  special: { name: 'Avalanche', kind: 'freeze', hint: 'Buries you in snow and freezes 50 energy. Dodge it!' },
  phase: { line: 'The Yeti roars and the whole mountain shakes!', every: 2, armour: .8, heal: 25 } };
const RIVAL_TAUNTS = ['Let\'s go!', 'You look tired.', 'Bring it.', 'Warm-up\'s over.', 'Easy.'];
const DAILY_MODS = [
  { id: 'heavy', label: 'Heavy hitter: big hits do 30% more' }, { id: 'fast', label: 'Quick feet: the timing bar is faster' },
  { id: 'wall', label: 'Iron guard: guards a lot more often' }, { id: 'sneaky', label: 'Sneaky: hides one move in three' },
  { id: 'tank', label: 'Tank: 40% more HP' },
];

const rng = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const hashStr = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pickW = (w, r = Math.random()) => { const tot = Object.values(w).reduce((a, b) => a + b, 0); let x = r * tot; for (const [k, v] of Object.entries(w)) { if ((x -= v) < 0) return k; } return Object.keys(w)[0]; };

function dailyRival() {
  const t = today(), r = rng(hashStr('daily' + t)), pool = ENEMIES.filter(e => !e.boss);
  const base = pool[Math.floor(r() * pool.length)], mod = DAILY_MODS[Math.floor(r() * DAILY_MODS.length)];
  const bias = Object.fromEntries(STAT_IDS.map(k => [k, Math.round((r() - .5) * 20)]));
  return { ...base, id: 'daily', name: `${base.name} (daily)`, r: Math.min(97, athlete().ovr + 3), bias, mod, hp: mod.id === 'tank' ? 140 : 100, line: `Today's challenger. ${mod.label}.`, boss: false };
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
  return { ...base, id: 'wander:' + w, league: lg.id, r: Math.min(99, top - 2), hp: 120, left, boss: false };
}
const wanderWon = () => (D.arena.battles || []).some(b => b.e === 'wander:' + wanderWindow() && b.win);
function survivalRival(wave) {
  const pool = ENEMIES.filter(e => !e.boss), r = rng(hashStr('wave' + wave + (battle?.seed || 0)));
  const base = pool[Math.floor(r() * pool.length)];
  return { ...base, id: 'survival', name: `Wave ${wave}: ${base.name}`, r: Math.min(99, Math.max(30, athlete().ovr - 14) + 4 * wave), hp: 70 + 5 * wave, boss: false };
}

// ---------- starting ----------
function startBattle(id, mode = 'ladder') {
  let e, i = -1;
  if (mode === 'daily') { if (dailyWon()) { toast('Daily challenge done', 'A new challenger turns up tomorrow.'); return; } e = dailyRival(); }
  else if (mode === 'survival') e = null;
  else if (mode === 'wander') { if (wanderWon()) { toast('Already beaten', 'A new challenger turns up soon.'); return; } e = wanderRival(); }
  else { i = ENEMIES.findIndex(x => x.id === id); if (i < 0 || i > unlockedUpTo()) return; e = ENEMIES[i]; }
  if (!tokensLeft()) { toast('No battles left today', 'Tick off a workout or buy a Battle ticket in the shop.'); return; }
  const items = D.arena.items = D.arena.items || {};
  const boosts = Object.keys(ui.boost || {}).filter(k => ui.boost[k] && (items[k] || 0) > 0);
  boosts.forEach(k => items[k]--); ui.boost = {}; if (boosts.length) save();
  const me = battleStats(); if (boosts.includes('drink')) STAT_IDS.forEach(k => me[k] += 8);
  battle = { mode, i, me, hp: 100, hpMax: 100 + Math.round(Math.max(0, me.end - 50) / 2), energy: 60, round: 0, over: false, win: false, busy: false,
    luck: boosts.includes('charm') ? 3 : 0, boosts, used: {}, wave: 1, seed: Date.now() % 100000, combo: 0, best: 0 };
  const rd = readiness(); battle.hpMax = Math.max(60, battle.hpMax + rd.hp); battle.energy = Math.min(100, battle.energy + rd.energy); battle.ready = rd;
  battle.hp = battle.hpMax;
  setRival(mode === 'survival' ? survivalRival(1) : e);
  let ov = document.getElementById('battlefx');
  if (!ov) { ov = document.createElement('div'); ov.id = 'battlefx'; ov.className = 'treefx'; document.body.appendChild(ov); }
  ov.onclick = ev => {
    const b = ev.target.closest('[data-bm]'); if (!b) return;
    if (b.dataset.bm === 'close') {
      if (battle && !battle.over && battle.round && !confirm('Leave this battle? It counts as a loss.')) return;
      if (battle && !battle.over && battle.round) finishBattle(false);
      ov.remove(); battle = null; document.removeEventListener('keydown', battleKey); render(); return;
    }
    if (b.dataset.bm === 'tap') { timingTap(); return; }
    battleAct(b.dataset.bm);
  };
  document.addEventListener('keydown', battleKey);
  drawStage(); drawControls(); hud();
  const B = battle;
  banner(B.mode === 'survival' ? 'SURVIVAL: WAVE 1' : B.e.boss ? `👑 BOSS: ${B.e.name}` : B.mode === 'daily' ? '📅 DAILY CHALLENGE' : B.mode === 'wander' ? `🆕 ${B.e.name.toUpperCase()} APPEARS!` : 'FIGHT!', B.e.boss || B.mode !== 'ladder' ? 'boss' : '');
  logLine(`<b>${B.e.icon} ${esc(B.e.name)}:</b> "${esc(B.ai.taunts ? B.ai.taunts[0] : B.e.line)}"`);
  if (boosts.length) logLine(`Boosts on: ${boosts.map(k => { const x = SHOP_ITEMS.find(s => s.id === k); return x.icon + ' ' + x.name; }).join(', ')}`);
  nextIntent();
}
function setRival(e) {
  const B = battle, ai = BOSS_AI[e.id] || {};
  // regular rivals fight to their strengths: strong/tough ones guard, powerful ones swing big, quick ones keep attacking
  const es = enemyStats(e), mix = ai.mix || { atk: 3 + (es.spd + es.agi) / 60, heavy: 1 + es.pow / 40, guard: .8 + (es.str + es.end) / 90 };
  if (e.mod?.id === 'wall') mix.guard += 3;
  Object.assign(B, { e, es, ai: { ...ai, mix }, ehp: e.hp || 100, emax: e.hp || 100, phase: 1, stunned: false, autododge: false, intent: null, elast: '' });
}
function battleKey(ev) {
  if (!battle || battle.over) return;
  if (ev.code === 'Space' && battle.timing) { ev.preventDefault(); timingTap(); }
}

// ---------- drawing ----------
function drawStage() {
  const B = battle, e = B.e, lg = leagueOf(e) || LEAGUES[B.mode === 'survival' ? 3 : 2], spec = avatarSpec(), ov = document.getElementById('battlefx');
  ov.innerHTML = `<div class="treecard battlecard"><button class="iconbtn tc-close" data-bm="close" title="Leave">✕</button>
    <div class="bhud"><div class="hpside"><b>${esc(D.settings.name || 'You')}</b><div class="hpbar"><i id="hpMe"></i></div><span id="hpMeT"></span><div class="enbar" title="Energy"><i id="enMe"></i></div><small class="muted" id="enMeT"></small></div>
      <div class="bround"><small>${B.mode === 'survival' ? 'Survival' : B.mode === 'daily' ? 'Daily challenge' : B.mode === 'wander' ? 'New challenger' : esc(lg.icon + ' ' + lg.name)}</small><b id="bRound">FIGHT!</b></div>
      <div class="hpside them"><b id="eName">${e.boss ? '👑 ' : ''}${esc(e.name)}</b><div class="hpbar"><i id="hpThem"></i></div><span id="hpThemT"></span></div></div>
    <div class="bstage" style="--sky:${lg.sky};--ground:${lg.ground}">
      <div class="crowd"></div><div class="lights"><i></i><i></i><i></i><i></i></div><div class="ground"></div>
      <div class="fighter me" style="--dir:1" id="fMe"><div class="fbox">${avatarFull(spec, { size: 170 })}${petHtml(myAv().pet, 40)}</div><div class="fshadow"></div><div class="callout" id="cMe"></div></div>
      <div class="fighter them ${e.boss ? 'boss' : ''}" style="--dir:-1" id="fThem"><div class="fbox"><span class="esprite">${e.icon}</span></div><div class="fshadow"></div><div class="callout" id="cThem"></div></div>
      <div class="intent" id="bIntent"></div>
      <div class="bfx" id="bfx"></div><div class="bbanner" id="bBanner"></div>
    </div>
    <div id="bControls"></div><div class="blog" id="bLog"></div></div>`;
}
function hud() {
  const B = battle; if (!B) return;
  const set = (id, hp, max) => { const el = document.getElementById(id); if (!el) return; const p = Math.max(0, hp) / max * 100; el.style.width = p + '%'; el.style.background = p > 50 ? '#40c057' : p > 25 ? '#fab005' : '#e03131'; document.getElementById(id + 'T').textContent = `${Math.max(0, Math.round(hp))} / ${max}`; };
  set('hpMe', B.hp, B.hpMax); set('hpThem', B.ehp, B.emax);
  const en = document.getElementById('enMe'); if (en) { en.style.width = B.energy + '%'; document.getElementById('enMeT').textContent = `⚡ ${Math.round(B.energy)} energy`; }
  const r = document.getElementById('bRound'); if (r) r.textContent = B.over ? (B.win ? 'K.O.!' : B.mode === 'survival' ? 'GAME OVER' : 'DEFEAT') : B.mode === 'survival' ? `WAVE ${B.wave}` : B.round ? `ROUND ${B.round}` : 'FIGHT!';
  const n = document.getElementById('eName'); if (n) n.innerHTML = `${B.e.boss ? '👑 ' : ''}${esc(B.e.name)}${B.phase === 2 ? ' <span class="tag red">Phase 2</span>' : ''}`;
}
const logLine = html => document.getElementById('bLog')?.insertAdjacentHTML('afterbegin', `<div>${html}</div>`);
function intentText(it) {
  const B = battle;
  if (!it) return '';
  if (it.hidden) return '❓ <b>Hiding their next move</b>';
  if (it.type === 'stunned') return '💫 <b>Stunned</b>: can\'t move this round';
  if (it.type === 'guard') return '🛡️ <b>Bracing to guard</b>: your hits do less (specials break through)';
  if (it.type === 'special') return `⚡ <b>${esc(B.ai.special.name)}</b>: ${esc(B.ai.special.hint)}`;
  const [ic, nm] = MOVES[it.stat];
  return it.type === 'heavy' ? `⚠️ <b>Winding up a big ${ic} ${nm}</b>: dodge it` : `${ic} <b>${nm}</b> (normal attack): counter or block`;
}
function drawControls() {
  const B = battle, el = document.getElementById('bControls'); if (!el) return;
  if (B.over) { el.innerHTML = resultHtml(); document.getElementById('bIntent')?.classList.remove('show'); return; }
  if (B.timing) {
    el.innerHTML = `<div class="tbarwrap"><div class="tlabel">${esc(B.timing.label)}: press <b>Space</b> or the button when the marker is in the middle</div>
      <div class="tbar"><i class="tz ok"></i><i class="tz good"></i><i class="tz perfect"></i><b id="tMark"></b></div>
      <button class="btn primary big" data-bm="tap">${B.timing.kind === 'block' ? '🛡️ Block!' : '💥 Hit!'}</button></div>`;
    return;
  }
  const dis = c => B.busy || B.energy < c ? 'disabled' : '';
  el.innerHTML = `<div class="bsec"><span class="bsl">Moves</span><div class="bmoves m4">${moveSet().map(m => `<button class="bmove" data-bm="m:${m.id}" ${m.once && B.used[m.id] ? 'disabled' : dis(moveCost(m))} style="--sc:${statInfo(m.stat)[3]}" title="${esc(m.note)}"><span>${m.icon}</span><b>${esc(m.name)} <em>Lv${moveLv(m.id)}</em></b><small>⚡${moveCost(m)} · ${statInfo(m.stat)[2]} ${B.me[m.stat]} <i class="${B.me[m.stat] >= B.es[m.stat] ? 'up' : 'down'}">vs ${B.es[m.stat]}</i></small></button>`).join('')}</div></div>
    <div class="bsec"><span class="bsl">Defend</span><div class="bdefs">${Object.entries(DEFENCES).map(([k, d]) => `<button class="bdef" data-bm="d:${k}" ${dis(d.cost)} title="${esc(d.note)}"><span>${d.icon}</span><b>${d.name}</b><small>${d.cost ? '⚡' + d.cost : '+15 ⚡'}</small></button>`).join('')}</div></div>`;
}

// ---------- the rival's plan for this round ----------
function nextIntent() {
  const B = battle; if (!B || B.over) return;
  let it;
  if (B.stunned) { it = { type: 'stunned' }; B.stunned = false; }
  else {
    const every = (B.phase === 2 && B.ai.phase?.every) || B.ai.every;
    if (B.e.boss && every && (B.round + 1) % every === 0) it = { type: 'special' };
    else {
      const mix = { ...(B.phase === 2 && B.ai.phase?.mix || B.ai.mix) };
      if (B.ehp / B.emax < .3) mix.guard = (mix.guard || 1) * 1.6;
      if ((B.blocks || 0) >= 2) mix.heavy = (mix.heavy || 1) * 2; // punish turtling
      const type = pickW(mix);
      const opts = STAT_IDS.filter(k => k !== B.elast).map(k => [k, Math.pow(B.es[k], 2) * (.5 + Math.random())]).sort((a, b) => b[1] - a[1]);
      it = { type, stat: opts[0][0] };
      if (type !== 'guard') B.elast = it.stat;
    }
    if (B.e.mod?.id === 'sneaky' && Math.random() < .34 && it.type !== 'special') it.hidden = true;
  }
  B.intent = it;
  const el = document.getElementById('bIntent');
  if (el) { el.innerHTML = `<small>Next move</small>${intentText(it)}`; el.className = 'intent show ' + (it.type === 'heavy' || it.type === 'special' ? 'danger' : it.type === 'guard' ? 'calm' : ''); }
  if (Math.random() < .3) { const t = (B.ai.taunts || RIVAL_TAUNTS); say('them', t[Math.floor(Math.random() * t.length)]); }
}
function say(who, text, ms = 1500) {
  const c = document.getElementById(who === 'me' ? 'cMe' : 'cThem'); if (!c) return;
  c.innerHTML = esc(text); c.className = 'callout show'; clearTimeout(c._t); c._t = setTimeout(() => c.className = 'callout', ms);
}

// ---------- timing bar ----------
function timing(label, kind) {
  const B = battle;
  return new Promise(res => {
    const speed = 1 / (1300 - Math.max(0, B.e.r - 30) * 5) * (B.ai.fast && B.phase === 1 ? B.ai.fast : 1) * (B.phase === 2 && B.ai.phase?.fast || 1) * (B.e.mod?.id === 'fast' ? 1.3 : 1);
    B.timing = { label, kind, res, t0: performance.now(), speed, pos: 0 };
    drawControls();
    const step = now => {
      const T = B.timing; if (!T || T.res !== res) return;
      const x = (now - T.t0) * T.speed; T.pos = x % 2 < 1 ? x % 1 : 1 - x % 1;
      const m = document.getElementById('tMark'); if (m) m.style.left = (T.pos * 100) + '%';
      if (x > 4) { timingTap(true); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function timingTap(timeout) {
  const B = battle, T = B?.timing; if (!T) return;
  const d = Math.abs(T.pos - .5), q = timeout ? 'miss' : d < .045 ? 'perfect' : d < .12 ? 'good' : d < .26 ? 'ok' : 'miss';
  B.timing = null; drawControls(); T.res(q);
}

// ---------- a round ----------
const dmgRoll = (atk, def) => Math.max(4, Math.round(9 + (atk - def) * .3 + Math.random() * 6));
async function battleAct(code) {
  const B = battle; if (!B || B.over || B.busy || B.timing) return;
  const [kind, id] = code.split(':');
  const mv = kind === 'm' ? moveSet().find(m => m.id === id) : null, def = kind === 'd' ? DEFENCES[id] : null;
  const cost = mv ? moveCost(mv) : def ? def.cost : 99;
  if ((kind === 'm' && (!mv || (mv.once && B.used[id]))) || (kind === 'd' && !def) || B.energy < cost) return;
  B.busy = true; B.energy -= cost; B.round++; B.shield = 0; hud();
  const it = B.intent;
  let q = null;
  if (mv?.mult) q = await timing(`${mv.icon} ${mv.name}`, 'hit');
  else if (kind === 'd' && (id === 'block' || id === 'counter')) q = await timing(id === 'block' ? '🛡️ Block' : '🔁 Counter', 'block');
  if (q) { banner(TIMING[q][1], q === 'perfect' ? 'win' : q === 'miss' ? 'lose' : ''); B.combo = q === 'perfect' ? B.combo + 1 : 0; B.best = Math.max(B.best, B.combo); }
  let line = `R${B.round}: `;
  const armour = B.phase === 2 && B.ai.phase?.armour || 1;
  // 1) your move
  if (mv?.mult) {
    const stat = mv.stat, crit = mv.crit && Math.random() < mv.crit;
    let d = dmgRoll(B.me[stat] + B.luck, B.es[stat]) * TIMING[q][0] * mv.mult * movePow(mv) * armour * (1 + Math.min(B.combo, 4) * .05) * (crit ? 2 : 1);
    if (it.type === 'guard') d *= 1 - .55 * (1 - (mv.pierce || 0));
    d = Math.round(d); B.ehp = Math.max(0, B.ehp - d);
    line += `${mv.icon} ${mv.name} (${TIMING[q][1].toLowerCase().replace('!', '')})${crit ? ' CRITICAL' : ''} −${d}${it.type === 'guard' ? ' through their guard' : ''}. `;
    if (crit) banner('CRITICAL HIT!', 'win');
    await animateMove('me', mv.anim || stat, d, !mv.basic, mv.name);
    if (mv.stun) { B.stunned = true; line += 'They\'re stunned! '; }
    if (mv.autododge) B.autododge = true;
    if (mv.refund) B.energy = Math.min(100, B.energy + mv.refund);
    if (mv.shield) B.shield = mv.shield;
  } else if (mv) {
    const heal = Math.round((mv.heal || 0) * movePow(mv));
    B.hp = Math.min(B.hpMax, B.hp + heal); B.energy = Math.min(100, B.energy + (mv.gain || 0)); B.shield = mv.shield || 0;
    line += `${mv.icon} ${mv.name}: +${heal} HP${mv.gain ? `, +${mv.gain} energy` : ''}${mv.shield ? ', bracing' : ''}. `;
    document.getElementById('fMe')?.classList.add('sp-wind'); fxAt('me', `+${heal}`, 'dmgnum heal'); hud(); await sleep(700); document.getElementById('fMe')?.classList.remove('sp-wind');
  }
  if (mv?.once) B.used[mv.id] = 1;
  B.blocks = kind === 'd' && id === 'block' ? (B.blocks || 0) + 1 : 0;
  // 2) their move
  if (B.ehp > 0 && it.type !== 'stunned' && it.type !== 'guard') {
    const special = it.type === 'special', sk = special ? B.ai.special.kind : '';
    const stat = sk === 'copy' ? STAT_IDS.reduce((a, k) => B.me[k] > B.me[a] ? k : a, 'spd') : it.stat || 'pow';
    let hit = dmgRoll(B.es[stat] + (sk === 'copy' ? 20 : 0), B.me[stat]) * (it.type === 'heavy' ? 1.7 * (B.e.mod?.id === 'heavy' ? 1.3 : 1) : special ? 1.5 : 1) * (B.boosts.includes('guard') ? .7 : 1);
    let hits = sk === 'double' ? 2 : 1, back = 0, out = '';
    if (B.autododge) { hit = 0; out = 'You read it and slip away. '; B.autododge = false; }
    else if (kind === 'd' && id === 'dodge') {
      const p = Math.min(.9, .5 + (B.me.agi - B.es[stat]) / 150 + (it.type === 'heavy' || sk === 'quake' ? .25 : 0) + (sk === 'double' ? .1 : 0));
      if (Math.random() < p) { hit = 0; out = 'Dodged! '; fxAt('me', 'MISS', 'dmgnum'); } else out = 'Dodge failed. ';
    } else if (kind === 'd' && id === 'block') {
      B.energy = Math.min(100, B.energy + 15);
      if (sk === 'quake') out = 'The slam smashes through your block! ';
      else if (q === 'perfect') { hit = 0; back = 8 + Math.round(B.me.str / 12); out = 'Perfect block! '; }
      else { hit *= q === 'good' ? .3 : q === 'ok' ? .45 : .65; out = 'Blocked. '; }
    } else if (kind === 'd' && id === 'counter') {
      if (it.type === 'atk' && !special) { hit *= q === 'perfect' ? 0 : q === 'miss' ? .8 : .5; back = Math.round(dmgRoll(B.me.str, B.es[stat]) * 1.3 * TIMING[q][0]); out = 'Countered! '; }
      else { hit *= 1.1; out = 'Can\'t counter that! '; }
    }
    if ((sk === 'drain' || sk === 'freeze') && (kind !== 'd' || id !== 'dodge') && hit) { B.energy = Math.max(0, B.energy - (sk === 'freeze' ? 50 : 35)); out += sk === 'freeze' ? 'You\'re frozen! ' : 'Your energy drains! '; }
    const total = Math.round(hit * (1 - (B.shield || 0))) * hits;
    if (special) banner(`⚡ ${B.ai.special.name}!`, 'boss');
    if (total) { B.hp = Math.max(0, B.hp - total); await animateMove('them', it.type === 'heavy' || special ? 'str' : stat, total, special); }
    else { document.getElementById('fThem')?.classList.add('atk', 'atk-' + stat); await sleep(500); document.getElementById('fThem')?.classList.remove('atk', 'atk-' + stat); }
    if (back && B.ehp > 0) { back = Math.round(back * armour); B.ehp = Math.max(0, B.ehp - back); await animateMove('me', 'str', back, false); out += `You hit back −${back}. `; }
    line += `${esc(B.e.icon)} ${special ? esc(B.ai.special.name) : it.type === 'heavy' ? 'big ' + MOVES[stat][1] : MOVES[stat][1]}: ${out}${total ? `−${total}.` : ''}`;
  } else if (it.type === 'guard') line += `${B.e.icon} guarded.`;
  else if (it.type === 'stunned') line += `${B.e.icon} is stunned.`;
  if (kind === 'd' && it.type === 'guard' && id !== 'block') line += ' (wasted: they only guarded)';
  logLine(line);
  // 3) energy back, phase 2, end of fight
  B.energy = Math.min(100, B.energy + 12 + Math.round(B.me.end / 25));
  if (B.e.boss && B.phase === 1 && B.ehp > 0 && B.ehp / B.emax <= .4 && B.ai.phase) {
    B.phase = 2; banner('PHASE 2', 'boss'); say('them', B.ai.phase.line, 2600); logLine(`<b>${B.e.icon} ${esc(B.ai.phase.line)}</b>`);
    if (B.ai.phase.heal) { B.ehp = Math.min(B.emax, B.ehp + B.ai.phase.heal); fxAt('them', `+${B.ai.phase.heal}`, 'dmgnum heal'); }
    document.getElementById('fThem')?.classList.add('phase2'); await sleep(900);
  }
  hud();
  if (B.ehp <= 0 && B.mode === 'survival' && B.hp > 0) { await nextWave(); B.busy = false; drawControls(); return; }
  if (B.hp <= 0 || B.ehp <= 0 || B.round >= 15) {
    const win = B.mode === 'survival' ? false : B.ehp <= 0 ? true : B.hp <= 0 ? false : B.ehp / B.emax < B.hp / B.hpMax;
    finishBattle(win); hud();
    const loserEl = document.getElementById(win ? 'fThem' : 'fMe'), winEl = document.getElementById(win ? 'fMe' : 'fThem');
    loserEl?.classList.add('ko'); winEl?.classList.add(win ? 'dance-' + myAv().dance : 'dance-d_jump');
    banner(win ? 'K.O.!' : B.mode === 'survival' ? `GAME OVER · WAVE ${B.wave}` : 'DEFEAT', win ? 'win' : 'lose');
    if (win) for (let k = 0; k < 3; k++) setTimeout(() => burst('me', ['#fcc419', '#40c057', '#4dabf7'][k]), k * 250);
    await sleep(1100);
  } else nextIntent();
  B.busy = false; drawControls();
}
async function animateMove(who, anim, dmg, special, name = '') {
  if (STAT_IDS.includes(anim)) return animateClash(who, anim, dmg, special);
  const atk = document.getElementById(who === 'me' ? 'fMe' : 'fThem'), def = document.getElementById(who === 'me' ? 'fThem' : 'fMe'), loser = who === 'me' ? 'them' : 'me';
  atk.classList.add('atk', 'sp-' + anim, 'special'); if (name) banner(name.toUpperCase() + '!', 'boss');
  await sleep(520);
  def.classList.add('hit'); burst(loser, '#ffd43b'); burst(loser, '#ff6b00');
  fxAt(loser, `-${dmg}`, 'dmgnum big'); document.querySelector('#battlefx .bstage')?.classList.add('shake'); hud();
  await sleep(480);
  atk.classList.remove('atk', 'sp-' + anim, 'special'); def.classList.remove('hit'); document.querySelector('#battlefx .bstage')?.classList.remove('shake');
}
async function nextWave() {
  const B = battle;
  document.getElementById('fThem')?.classList.add('ko'); banner(`WAVE ${B.wave} CLEARED`, 'win'); burst('me', '#40c057');
  logLine(`<b>🌊 Wave ${B.wave} cleared!</b> +20 HP`);
  await sleep(1100);
  B.wave++; B.hp = Math.min(B.hpMax, B.hp + 20); B.energy = Math.max(B.energy, 50); B.round = 0;
  setRival(survivalRival(B.wave));
  const f = document.getElementById('fThem'); if (f) { f.classList.remove('ko', 'phase2'); f.querySelector('.esprite').textContent = B.e.icon; f.classList.add('enter'); setTimeout(() => f.classList.remove('enter'), 600); }
  hud(); banner(`WAVE ${B.wave}`, 'boss'); nextIntent();
}

// ---------- rewards and loot ----------
function finishBattle(win) {
  const B = battle; if (!B || B.over) return;
  B.over = true; B.win = win;
  const at = new Date().toISOString(), idx = Math.max(0, B.i);
  let reward, first = false;
  if (B.mode === 'survival') {
    const waves = B.wave - 1; reward = 5 + waves * 12;
    D.arena.survival = [...(D.arena.survival || []), { at, waves }].slice(-100);
    B.record = waves > (D.arena.survivalBest || 0); if (B.record) D.arena.survivalBest = waves;
  } else if (B.mode === 'daily') reward = win ? 60 : 5;
  else { first = win && !beaten(B.e.id); reward = win ? (first ? 30 + 12 * idx + (B.e.boss ? 100 : 0) : 8 + 2 * idx) : 5; }
  D.arena.battles = [...(D.arena.battles || []), { at, e: B.mode === 'survival' ? 'survival' : B.e.id, win, mode: B.mode }].slice(-300);
  D.arena.ledger['b:' + at] = reward;
  B.reward = reward; B.first = first;
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
  const head = sv ? `🌊 You lasted ${B.wave - 1} wave${B.wave === 2 ? '' : 's'}${B.record ? ' · new best!' : ''}` : B.win ? '🏆 You win!' : '😤 Not this time';
  const text = sv ? `Best ever: ${D.arena.survivalBest || 0} waves. It's on the training leaderboard.` : B.win ? (B.mode === 'daily' ? 'Daily challenge done. A new challenger turns up tomorrow.' : B.mode === 'wander' ? `${esc(B.e.name)} is beaten. Another challenger will turn up in a few days.` : B.first ? `${esc(B.e.name)} is beaten.${B.i < ENEMIES.length - 1 ? ' The next rival is unlocked.' : ' You beat the whole ladder. Legend.'}` : 'Another win.') : 'Watch their next move: dodge the big hits, counter the normal ones, and save energy for specials.';
  return `<div class="bresult ${B.win || (sv && B.wave > 1) ? 'win' : 'lose'}"><h2>${head}</h2><p>${text} <b>+${B.reward} ${GRIT}</b>${B.best >= 2 ? ` · best perfect streak ${B.best}` : ''}</p>
    ${B.loot?.length ? `<div class="loot"><b>Loot</b>${B.loot.map(l => `<span class="lootitem">${esc(l)}</span>`).join('')}</div>` : ''}
    <button class="btn primary" data-bm="close">Back to the Arena</button></div>`;
}

// ---------- arena page: daily challenge and survival ----------
function battleModesHtml() {
  const d = dailyRival(), won = dailyWon(), best = D.arena.survivalBest || 0;
  const wv = wanderRival(), wwon = wanderWon();
  return `<div class="grid g3 bmodes">
    <div class="card bmode wander"><div class="card-head"><h2>🆕 New challenger</h2>${wwon ? '<span class="tag green">✓ Beaten</span>' : `<span class="muted small-text">leaves in ${wv.left} day${wv.left === 1 ? '' : 's'}</span>`}</div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">${wv.icon}</span><div class="main"><b>${esc(wv.name)}</b> <span class="muted small-text">Lv ${wv.r}</span><div class="muted small-text">${esc(wv.line)} +90 Grit and gear.</div></div>
      ${wwon ? '' : `<button class="btn primary" data-act="fightMode" data-v="wander" ${tokensLeft() ? '' : 'disabled'}>⚔️ Fight</button>`}</div></div>
    <div class="card bmode daily"><div class="card-head"><h2>📅 Daily challenge</h2>${won ? '<span class="tag green">✓ Won today</span>' : '<span class="muted small-text">+60 Grit and loot</span>'}</div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">${d.icon}</span><div class="main"><b>${esc(d.name)}</b> <span class="muted small-text">rating ${d.r}</span><div class="muted small-text">${esc(d.mod.label)}</div></div>
      ${won ? '' : `<button class="btn primary" data-act="fightMode" data-v="daily" ${tokensLeft() ? '' : 'disabled'}>⚔️ Fight</button>`}</div>
      <p class="muted small-text" style="margin-bottom:0">${dailyWins()} daily win${dailyWins() === 1 ? '' : 's'} so far.${ownsCos('p_eagle') ? '' : ' Win 3 for the Eagle pet.'}</p></div>
    <div class="card bmode survival"><div class="card-head"><h2>🌊 Survival</h2><span class="muted small-text">best: ${best} wave${best === 1 ? '' : 's'}</span></div>
      <div class="row" style="align-items:center;gap:12px"><span class="bmicon">🔥</span><div class="main"><b>Wave after wave</b><div class="muted small-text">Each rival is tougher. You heal 20 between waves. 12 Grit a wave, loot from wave 4, Arena lights background at wave 8.</div></div>
      <button class="btn primary" data-act="fightMode" data-v="survival" ${tokensLeft() ? '' : 'disabled'}>Start</button></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>How fights work</h2><button class="btn small" data-act="arenaPage" data-v="moves">🥋 Moves →</button></div>
    <p class="small-text" style="margin:0">Each round the rival shows its <b>next move</b>. ⚠️ Big hits: <b>dodge</b>. Normal attacks: <b>counter</b> or <b>block</b>. 🛡️ Guarding: save energy or use a guard-breaking move. Attacks and blocks are timed, so press <b>Space</b> when the marker is in the middle for a <b>PERFECT</b>. Gym leaders have a second phase at 40% HP. Unlock and level up moves in the <b>Moves</b> tab.</p></div>`;
}
