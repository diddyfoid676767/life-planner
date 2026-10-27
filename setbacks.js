'use strict';
/* Setbacks, kept mild: a day with under 15 minutes of study (that isn't your
   weekly rest day or a holiday) costs 10 coins and wilts one tree until you
   water it. Two missed days in a row and a critter wanders off until you study
   30 minutes in a day. With strict focus on, leaving the planner for over a
   minute three times in one session withers that tree (half coins). Nothing
   counts from before this was added. */

const MISS_MINS = 15, MISS_COINS = 10, DISTRACT_LIMIT = 3, AWAY_SECS = 60;

const holidays = () => D.settings.holidays || [];
const isHoliday = d => holidays().some(h => h.from <= d && d <= h.to);
const restDayOf = d => (D.game.restUsed || {})[mondayOf(d)];
const isRestDay = d => restDayOf(d) === d;

function wiltOne(d) {
  const rnd = seeded('wilt' + d);
  const pool = D.focusLogs.filter(l => l.mins >= 10 && !l.withered && l.date < d && !treeRec(l.id).wilted);
  if (!pool.length) return null;
  const l = pool[Math.floor(rnd() * pool.length)];
  D.game.trees[l.id] = { ...treeRec(l.id), wilted: d };
  return l;
}
function critterLeaves() {
  const here = CRITTERS.filter(k => crit(k.id)).sort((a, b) => D.game.critters[b.id].localeCompare(D.game.critters[a.id]));
  if (!here.length) return null;
  const k = here[0];
  D.game.away[k.id] = [...(D.game.away[k.id] || []), [new Date().toISOString(), null]];
  return k;
}
function critterComeBack() {
  const back = [];
  for (const [id, periods] of Object.entries(D.game.away || {})) {
    const open = periods.find(p => !p[1]);
    if (open) { open[1] = new Date().toISOString(); back.push(CRITTERS.find(k => k.id === id)); }
  }
  return back.filter(Boolean);
}

function checkMissedDays() {
  const g = D.game, t = today(), y = addDays(t, -1);
  g.restUsed = g.restUsed || {}; g.away = g.away || {};
  if (!g.penaltiesFrom) { g.penaltiesFrom = t; g.checkedTo = y; save(); return; }
  const dm = dailyMins(), events = [];
  // a 30-minute day brings wandering critters home
  if ((dm[t] || 0) >= 30 && Object.values(g.away).some(ps => ps.some(p => !p[1]))) {
    const back = critterComeBack();
    if (back.length) { save(); setTimeout(() => toast(`${back.map(k => k.emoji).join('')} ${back.length === 1 ? back[0].name + ' is' : 'Your critters are'} back!`, 'Studying 30 minutes today brought them home. Their buffs are back on.', { timeout: 9000 }), 300); }
  }
  let d = addDays(g.checkedTo || y, 1);
  if (d > y) return;
  for (; d <= y; d = addDays(d, 1)) {
    if (d < g.penaltiesFrom || isHoliday(d) || (dm[d] || 0) >= MISS_MINS) continue;
    if (!g.restUsed[mondayOf(d)]) { g.restUsed[mondayOf(d)] = d; events.push({ type: 'rest', d }); continue; }
    g.ledger['miss:' + d] = -MISS_COINS;
    const tree = wiltOne(d);
    let gone = null;
    if (g.lastMiss && (g.lastMiss === addDays(d, -1) || (isRestDay(addDays(d, -1)) && g.lastMiss === addDays(d, -2)))) gone = critterLeaves();
    g.lastMiss = d;
    events.push({ type: 'miss', d, tree, gone });
  }
  g.checkedTo = y; save();
  const misses = events.filter(e => e.type === 'miss');
  if (misses.length) setTimeout(() => showSetbacks(events), 600);
}
function showSetbacks(events) {
  const misses = events.filter(e => e.type === 'miss'), rest = events.filter(e => e.type === 'rest');
  const lines = [
    ...rest.map(e => `😴 ${fullDate(e.d)} was your free rest day for that week.`),
    ...misses.map(e => `📉 ${fullDate(e.d)}: under ${MISS_MINS} minutes of study, −${MISS_COINS} ${COIN}`),
    ...misses.filter(e => e.tree).map(e => `🥀 <b>${esc(treeName(e.tree))}</b> wilted. Water it to bring it back.`),
    ...misses.filter(e => e.gone).map(e => `${e.gone.emoji} <b>${esc(e.gone.name)}</b> wandered off. Study 30 minutes in a day to bring it home.`),
  ];
  celebrate({ icon: '<span class="critbig">🥀</span>', color: '#e8590c', kicker: 'While you were away', title: `${misses.length} missed day${misses.length === 1 ? '' : 's'}`, text: lines.join('<br>') + '<br><br>Going on a trip? Add it under Holidays on the Forest tab so nothing is lost.' });
}

// ---------- strict focus: leaving the planner mid-session ----------
let leftAt = 0;
function focusLeft() { if (D?.focus && !D.focus.pausedAt && D.settings.strictFocus && !leftAt) leftAt = Date.now(); }
function focusBack() {
  if (!leftAt) return;
  const gone = (Date.now() - leftAt) / 1000; leftAt = 0;
  const f = D?.focus;
  if (!f || f.pausedAt || !D.settings.strictFocus || gone < AWAY_SECS) return;
  f.distractions = (f.distractions || 0) + 1; save(); renderFocusBar();
  const n = f.distractions;
  if (n >= DISTRACT_LIMIT) toast('🥀 Your tree withered', `You left the timer ${n} times, so this session's tree will be withered and pay half coins. Stay on the timer next time, or pause it first.`, { timeout: 12000 });
  else toast(`👀 Distraction ${n} of ${DISTRACT_LIMIT}`, `You were away for ${Math.round(gone / 60) || 1} min. At ${DISTRACT_LIMIT}, this tree withers. Pause the timer if you need a break.`, { timeout: 9000 });
}
document.addEventListener('visibilitychange', () => document.hidden ? focusLeft() : focusBack());
window.addEventListener('blur', focusLeft);
window.addEventListener('focus', focusBack);

// ---------- Forest tab card: rules and holidays ----------
function setbacksCard() {
  const t = today(), wkRest = restDayOf(t);
  const hols = holidays().filter(h => h.to >= addDays(t, -30)).sort((a, b) => a.from.localeCompare(b.from));
  const away = CRITTERS.filter(k => critAway(k.id));
  const wilted = D.focusLogs.filter(l => treeRec(l.id).wilted);
  return `<div class="card setbacks"><h2>Keep your forest healthy</h2>
    <ul class="earn small-text">
      <li>Study at least <b>${MISS_MINS} minutes</b> a day. A missed day costs <b>${MISS_COINS} ${COIN}</b> and wilts a tree until you water it.</li>
      <li>Two missed days in a row and a critter wanders off until you study 30 minutes in a day.</li>
      <li>You get <b>one free rest day each week</b>. ${wkRest ? `This week's was ${fullDate(wkRest)}.` : 'Not used yet this week.'}</li>
      <li><label><input type="checkbox" data-setting="strictFocus" ${D.settings.strictFocus ? 'checked' : ''}> <b>Strict focus</b></label>: leaving the planner for over a minute counts as a distraction. ${DISTRACT_LIMIT} in one session withers that tree (half coins).</li></ul>
    ${wilted.length || away.length ? `<p class="small-text">${wilted.length ? `🥀 ${wilted.length} wilted tree${wilted.length === 1 ? '' : 's'}. Water ${wilted.length === 1 ? 'it' : 'them'} in My trees. ` : ''}${away.length ? `${away.map(k => k.emoji).join('')} away right now.` : ''}</p>` : ''}
    ${bedtimeRow()}
    ${typeof nudgeRow === 'function' ? nudgeRow() : ''}
    <h3 style="margin:14px 0 6px">Holidays</h3>
    <p class="muted small-text" style="margin:0 0 8px">Days in a holiday never count as missed and don't break your streak.</p>
    ${hols.map(h => `<div class="holrow"><span>✈️ <b>${esc(h.name || 'Holiday')}</b> ${fmtDate(h.from)}${h.to !== h.from ? ` – ${fmtDate(h.to)}` : ''}</span><button class="iconbtn" data-act="holDel" data-id="${esc(h.id)}" title="Remove">✕</button></div>`).join('')}
    <div class="row holadd"><input type="text" id="holName" placeholder="e.g. Trip" maxlength="40"><input type="date" id="holFrom" value="${t}"><span class="muted">to</span><input type="date" id="holTo" value="${t}"><button class="btn small" data-act="holAdd">Add</button></div></div>`;
}
function addHoliday() {
  const from = $('#holFrom')?.value, to = $('#holTo')?.value, name = ($('#holName')?.value || '').trim();
  if (!from || !to) return;
  const [a, b] = from <= to ? [from, to] : [to, from];
  D.settings.holidays = [...holidays(), { id: uid(), name: name || 'Holiday', from: a, to: b }];
  // a holiday added afterwards takes back missed-day penalties inside it
  for (const k of Object.keys(D.game.ledger)) if (k.startsWith('miss:') && k.slice(5) >= a && k.slice(5) <= b) delete D.game.ledger[k];
  for (const r of Object.values(D.game.trees)) if (r.wilted && r.wilted >= a && r.wilted <= b) delete r.wilted;
  save(); render(); toast('✈️ Holiday added', `${fmtDate(a)}${a !== b ? ' – ' + fmtDate(b) : ''}: no missed days, and your streak is safe.`);
}

// ---------- bedtime ----------
// School nights (Sun to Thu) and weekend nights (Fri and Sat) have their own
// bedtime. A single wind-down nudge 30 minutes before, a "time for bed" screen at
// bedtime, and the Forest keeps score: +5 coins for each bedtime night the
// planner isn't in use more than 15 minutes past bedtime, −10 when it is.
const bedCfg = () => { const b = Object.assign({ on: true, time: '22:00', wk: '23:00', days: [0, 1, 2, 3, 4, 5, 6] }, D.settings.bedtime || {});
  if (!b.v2) { b.days = [...new Set([...b.days, 0, 5, 6])]; b.v2 = 1; } // weekends got their own later bedtime in 2.16.3
  return b; };
const isWeekendNight = d => [5, 6].includes(parseYmd(d).getDay());
const bedTimeFor = d => { const b = bedCfg(); return isWeekendNight(d) ? b.wk : b.time; };
const hmToMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const isBedNight = d => { const b = bedCfg(); return b.on && b.days.includes(parseYmd(d).getDay()) && !isHoliday(d); };
let bedShown = '';
function checkBedtime() {
  if (!D || !D.game) return;
  const g = D.game, b = bedCfg(), now = new Date(), t = today();
  g.late = g.late || {};
  if (!g.bedFrom) { g.bedFrom = t; save(); }
  const cur = now.getHours() * 60 + now.getMinutes(), early = now.getHours() < 4;
  const night = early ? addDays(t, -1) : t;
  const bt = bedTimeFor(night), past = early ? cur + 1440 - hmToMin(bt) : cur - hmToMin(bt);
  if (isBedNight(night)) {
    if (!early && past >= -30 && past < 0 && !D.fired['bed:w:' + night]) {
      D.fired['bed:w:' + night] = Date.now(); save();
      notify('🌙 Wind down', `Bed at ${fmtTime(bt)} tonight. Finish what you're doing and put the screens away soon.`, 'bed');
    }
    if (past >= 0 && past < 240 && document.visibilityState === 'visible' && !(typeof tourAt !== 'undefined' && tourAt >= 0) && !document.getElementById('wizfx') && bedShown !== night && !D.fired['bed:s:' + night]) { bedShown = night; D.fired['bed:s:' + night] = Date.now(); save(); bedtimeScreen(past, night); }
    if (past >= 15 && past < 360 && document.visibilityState === 'visible' && !g.late[night]) { g.late[night] = now.toISOString(); save(); }
  }
  // settle nights that are fully over (after 4am the next morning)
  const lastNight = addDays(t, early ? -2 : -1);
  let d = addDays(g.bedChecked || addDays(g.bedFrom, -1), 1);
  let changed = false;
  for (; d <= lastNight; d = addDays(d, 1)) {
    if (d < g.bedFrom || !isBedNight(d)) continue;
    g.ledger[(g.late[d] ? 'late:' : 'bed:') + d] = g.late[d] ? -10 : 5; changed = true;
  }
  if (g.bedChecked !== lastNight) { g.bedChecked = lastNight; changed = true; }
  if (changed) save();
}
function bedtimeScreen(past, night = today()) {
  const b = { time: bedTimeFor(night) }, wk = isWeekendNight(night);
  const ov = document.createElement('div');
  ov.className = 'boxfx opened bedfx';
  ov.style.setProperty('--rc', '#7950f2');
  ov.innerHTML = `<div class="boxstage"><div class="reveal"><div class="prize"><span class="critbig">🛏️</span></div><div class="rar">${wk ? 'Weekend' : 'School night'}</div>
    <h2>${past < 5 ? `It's ${fmtTime(b.time)}. Time for bed!` : 'You should be asleep by now'}</h2>
    <p>Sleep is when your brain locks in what you studied today, and it's when your body recovers from training.<br>Off to bed in the next 15 minutes keeps tonight's +5 ${COIN}. Staying on costs 10 ${COIN} tomorrow.</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>Going to bed 🌙</button></div></div></div>`;
  document.body.appendChild(ov);
  notify('🛏️ Time for bed', `It's ${fmtTime(b.time)}${wk ? '' : ' on a school night'}. Head to bed to keep tonight's coins.`, 'bed');
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]')) { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); } });
}
function bedtimeRow() {
  const b = bedCfg(), names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const nights = Object.keys(D.game.ledger).filter(k => k.startsWith('bed:')).length, late = Object.keys(D.game.ledger).filter(k => k.startsWith('late:')).length;
  return `<h3 style="margin:14px 0 6px">🌙 Bedtime</h3>
    <div class="row bedrow"><label><input type="checkbox" data-act="bedOn" ${b.on ? 'checked' : ''}> Bed by</label><input type="time" value="${b.time}" data-change="bedTime" style="width:auto"><span class="muted small-text">school nights,</span><input type="time" value="${b.wk}" data-change="bedTimeWk" style="width:auto"><span class="muted small-text">Fri &amp; Sat</span>
      <span class="catchips">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button class="cchip ${b.days.includes(i) ? 'on' : ''}" data-act="bedDay" data-v="${i}">${names[i]}</button>`).join('')}</span></div>
    <p class="muted small-text" style="margin:6px 0 0">One wind-down reminder 30 minutes before, then a bedtime screen. +5 ${COIN} for each night the planner isn't open more than 15 minutes after bedtime, −10 when it is. ${nights || late ? `So far: ${nights} early night${nights === 1 ? '' : 's'}, ${late} late.` : ''}</p>`;
}
setInterval(checkBedtime, 30000);
