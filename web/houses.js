'use strict';
/* Houses (2.44): you join your school house, and what you log in the planner
   (focus sessions, revision cards and quiz questions, workouts, PBs) becomes
   damage against your house's weekly boss. Two cards, Mind and Body, rate you
   0-99 from the last 28 days, and the ratings multiply your damage. Ticking
   to-dos gives nothing: the planner is for organising, the house is for effort.
   Your week is shared on your profile row (stats.hs) and the house page reads
   everyone's rows for this week. */

const HS_HOUSES = [
  { id: 'pascoe', name: 'Pascoe', team: 'Pythons', col: '#f2c400', ink: '#3a2f00', e: '🐍' },
  { id: 'molland', name: 'Molland', team: 'Bulls', col: '#e03131', ink: '#fff', e: '🐂' },
  { id: 'flinders', name: 'Flinders', team: 'Falcons', col: '#1c7ed6', ink: '#fff', e: '🦅' },
  { id: 'derrimut', name: 'Derrimut', team: 'Tigers', col: '#f76707', ink: '#fff', e: '🐯' },
  { id: 'strathmore', name: 'Strathmore', team: 'Sharks', col: '#7048e8', ink: '#fff', e: '🦈' },
  { id: 'hudson', name: 'Hudson', team: 'Dragons', col: '#2f9e44', ink: '#fff', e: '🐉' },
];
const HS_BOSSES = [
  { n: 'The Procrastinator', e: '🦥', s: 'Feeds on "I\'ll do it later".' },
  { n: 'Doomscroll Kraken', e: '🦑', s: 'Its tentacles are made of notifications.' },
  { n: 'Snooze Golem', e: '🗿', s: 'Hits the snooze button for you.' },
  { n: 'Couch Troll', e: '🛋️', s: 'Wants you sitting down. Forever.' },
  { n: 'Cram Wraith', e: '👻', s: 'Appears the night before every test.' },
  { n: 'Excuse Hydra', e: '🐲', s: 'Grows two excuses for every one you cut.' },
  { n: 'Fog of Distraction', e: '🌫️', s: 'Makes you forget why you opened the tab.' },
  { n: 'The Energy Drain', e: '🔋', s: 'Skipped sleep, skipped training, skipped water.' },
];
const HS_INT = { Easy: .8, Moderate: 1, Hard: 1.3, 'Race / test': 1.3 };
// moves: unlocked by a card rating, triggered by something you actually did
const HS_MOVES = [
  { id: 'deep', c: 'm', at: 45, n: 'Deep Focus', d: 'A 45+ minute focus session hits 1.5x.' },
  { id: 'recall', c: 'm', at: 60, n: 'Total Recall', d: 'Revision cards and quiz questions hit 2x.' },
  { id: 'combo', c: 'b', at: 45, n: 'Combo', d: '3 workout days in a week: body damage 1.2x.' },
  { id: 'crit', c: 'b', at: 55, n: 'Critical', d: 'A new PB hits for double.' },
  { id: 'both', c: '', at: 0, n: 'All-rounder', d: 'Study and train in the same week: +10% on everything.' },
];

const hsState = () => (D.house = Object.assign({ id: '', since: '', rev: {}, seen: {}, wins: 0, mvp: 0 }, D.house || {}));
const hsHouse = id => HS_HOUSES.find(h => h.id === id);
const hsBoss = wk => HS_BOSSES[Math.floor(parseYmd(wk) / (7 * 864e5)) % HS_BOSSES.length];
// counts revision cards and quiz questions per day (called from revise.js)
function hsRev() { const st = hsState(), t = today(); st.rev[t] = (st.rev[t] || 0) + 1; for (const d in st.rev) if (d < addDays(t, -60)) delete st.rev[d]; }

// raw points for one day, before the card ratings
function hsDay(d, mv) {
  let s = 0, b = 0, deep = 0;
  for (const l of D.focusLogs) if (l.date === d && l.mins >= 5) { const big = l.mins >= 45 && mv.deep; s += l.mins * (big ? 1.5 : 1); if (big) deep++; }
  s = Math.min(s, 270);
  const rev = Math.min((hsState().rev[d] || 0) * 2 * (mv.recall ? 2 : 1), 80);
  let w = 0, wn = 0;
  for (const x of D.workouts) if (x.done && x.date === d) { w += Math.min(+x.duration || 0, 150) * (HS_INT[x.intensity] || 1) * 1.2; wn++; }
  w = Math.min(w, 220);
  const pbs = Math.min((D.arena?.pbs || []).filter(p => p.date === d).length, 2), pb = pbs * 40 * (mv.crit ? 2 : 1);
  b = w + pb;
  return { s: s + rev, b, study: s, rev, w, wn, pbs, pb, deep };
}
// the two card ratings, from the last 28 days (no moves, so they can't feed themselves)
function hsCards(t = today()) {
  let s = 0, b = 0;
  for (let i = 0; i < 28; i++) { const x = hsDay(addDays(t, -i), {}); s += x.s; b += x.b; }
  const r = (x, k) => Math.round(40 + 59 * (1 - Math.exp(-x / k)));
  return { m: r(s, 3000), b: r(b, 2000), ms: s, bs: b };
}
const hsMoves = c => Object.fromEntries(HS_MOVES.map(m => [m.id, !m.c || c[m.c] >= m.at]));
const hsMult = r => .75 + r / 200;
// one week: points, damage and what boosted it
function hsWeek(wk, c = hsCards()) {
  const mv = hsMoves(c), days = Array.from({ length: 7 }, (_, i) => hsDay(addDays(wk, i), mv)).filter((_, i) => addDays(wk, i) <= today());
  const sum = k => days.reduce((a, x) => a + x[k], 0);
  let s = sum('s'), b = sum('b');
  const trainDays = days.filter(x => x.wn).length, combo = mv.combo && trainDays >= 3, both = s > 0 && b > 0;
  const dmgS = s * hsMult(c.m), dmgB = b * hsMult(c.b) * (combo ? 1.2 : 1);
  const dmg = Math.round((dmgS + dmgB) * (both ? 1.1 : 1));
  return { s: Math.round(s), b: Math.round(b), e: Math.round(s + b), dmg, combo, both, trainDays, deep: sum('deep'), pbs: sum('pbs'), study: Math.round(sum('study')), rev: Math.round(sum('rev')), w: Math.round(sum('w')), pb: sum('pb') };
}
function housePublish() {
  const st = hsState(); if (!st.id) return undefined;
  const wk = mondayOf(today()), c = hsCards(), bd = x => typeof ftWeekDmg === 'function' ? ftWeekDmg(x) : 0; // 2.48: turn-based fight damage adds on top
  const w = hsWeek(wk, c), p = hsWeek(addDays(wk, -7), c).dmg + bd(addDays(wk, -7));
  const prev = [7, 14, 21].map(n => hsWeek(addDays(wk, -n), c).dmg + bd(addDays(wk, -n)));
  return { h: st.id, wk, d: Math.min(w.dmg + bd(wk), 20000), p: Math.min(p, 20000), a: Math.min(Math.round(prev.reduce((x, y) => x + y, 0) / 3), 20000), e: Math.min(w.e, 20000), m: c.m, b: c.b };
}

// everyone's rows this week, from the friends server
let hsRows = [], hsRowsAt = 0, hsRowsWk = '', hsLoading = false;
async function hsLoad(force) {
  const wk = mondayOf(today());
  if (ONLINE || hsLoading || (!force && hsRowsWk === wk && Date.now() - hsRowsAt < 120000)) return;
  hsLoading = true;
  try {
    if (!acctLoaded) await loadAccount();
    if (acct.signedIn) { await publishMe(true); }
    if (acct.configured) {
      const r = await fetch('/api/account/people?houseweek=' + wk, { cache: 'no-store' });
      if (r.ok) { hsRows = (await r.json()).filter(x => x.hs && hsHouse(x.hs.h)); hsRowsWk = wk; }
    }
  } catch { }
  hsRowsAt = Date.now(); hsLoading = false;
  if (view === 'house' || view === 'today') render();
}
// the boss fight for one house this week
function hsFight(hid) {
  const st = hsState(), wk = mondayOf(today()), me = acct.signedIn ? acct.username : '';
  const rows = hsRows.filter(x => x.hs.h === hid && x.hs.wk === wk && x.username !== me).map(x => ({ user: x.username, name: x.display || x.username, ...x.hs }));
  if (hid === st.id) { const p = housePublish(); rows.push({ user: me || 'you', name: D.settings.name || 'You', me: true, ...p }); }
  const hp = Math.round(1.1 * rows.reduce((a, x) => a + Math.max(x.a || 0, 500), 0)) || 550;
  const dealt = rows.reduce((a, x) => a + (x.d || 0), 0);
  return { hid, wk, rows: rows.sort((a, b) => b.d - a.d), hp, dealt, left: Math.max(0, hp - dealt), dead: dealt >= hp };
}

function hsBar(f) { const pct = Math.min(100, Math.round(f.dealt / f.hp * 100)); return `<div class="hsbar"><i style="width:${100 - pct}%"></i><span>${f.dead ? 'Defeated!' : `${f.left.toLocaleString()} / ${f.hp.toLocaleString()} HP`}</span></div>`; }
function hsCardHtml(kind, r, c) {
  const moves = HS_MOVES.filter(m => m.c === kind);
  return `<div class="hscard hs-${kind}"><div class="hsr">${r}</div><div class="hsk">${kind === 'm' ? '🧠 MIND FORM' : '💪 BODY FORM'}</div>
    <div class="hsx">×${hsMult(r).toFixed(2)} damage</div>
    <ul>${moves.map(m => `<li class="${r >= m.at ? 'on' : ''}" title="${esc(m.d)}">${r >= m.at ? '⚡' : '🔒'} ${m.n}${r >= m.at ? '' : ` <small>at ${m.at}</small>`}</li>`).join('')}</ul></div>`;
}

function hsPicker() {
  return `${pageHead('🏰 Houses', 'Pick your house to join this week\'s boss fight')}
    <div class="card"><p>Everything you log here, study sessions, revision, workouts and PBs, becomes damage against your house's weekly boss. Ticking off to-dos doesn't count: the planner keeps you organised, the house is for real effort.</p>
    <div class="hspick">${HS_HOUSES.map(h => `<button type="button" data-hs="pick" data-h="${h.id}" style="--hc:${h.col};--hi:${h.ink}"><b>${h.e}</b><span>${h.name}</span><small>${h.team}</small></button>`).join('')}</div>
    <p class="muted small-text">Pick the house you're really in at school. You can't switch later.</p></div>`;
}

function viewHouse() {
  const st = hsState();
  if (!st.id) return hsPicker();
  hsLoad();
  const h = hsHouse(st.id), wk = mondayOf(today()), boss = hsBoss(wk), f = hsFight(st.id), c = hsCards(), w = hsWeek(wk, c);
  const daysLeft = 7 - diffDays(wk, today());
  hsRecord(f);
  const all = HS_HOUSES.map(x => ({ x, f: hsFight(x.id) })).sort((a, b) => b.f.dealt / b.f.hp - a.f.dealt / a.f.hp || b.f.dealt - a.f.dealt);
  const by = ui.hsBy === 'e' ? 'e' : 'd', rows = [...f.rows].sort((a, b) => (b[by] || 0) - (a[by] || 0));
  const lw = st.seen[addDays(wk, -7)], recap = lw && st.recapSeen !== wk ? `<div class="card hsrecap"><b>📅 Last week:</b> ${h.name} ${lw.won ? `beat ${esc(lw.boss)} 🎉` : `didn't take down ${esc(lw.boss)} (${Math.round(lw.dealt / lw.hp * 100)}%)`}. You did ${lw.me.toLocaleString()} damage${lw.rank ? `, #${lw.rank} in your house` : ''}${lw.hr ? `, and ${h.name} came #${lw.hr} of 6` : ''}. <button class="btn small ghost" data-hs="recap">OK</button></div>` : '';
  const signed = acct.configured && acct.signedIn;
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  return `${pageHead(`${h.e} ${h.name} ${h.team}`, `${f.rows.length} fighting this week · ${st.wins} boss${st.wins === 1 ? '' : 'es'} beaten${st.mvp ? ` · ${st.mvp}× MVP` : ''}`)}
    <style>.hs-top{--hc:${h.col};--hi:${h.ink}}</style>
    ${recap}
    ${!ONLINE && !signed ? `<div class="card banner" style="margin-bottom:14px"><b>Sign in to fight with your house.</b> <span class="muted">Right now only your own damage counts. Sign in on the Friends page so your housemates' hits add up.</span> <button class="btn small" data-act="goto" data-v="friends">Sign in</button></div>` : ''}
    <div class="hs-top">
      <div class="card hsboss ${f.dead ? 'dead' : ''}">
        <div class="hsb-e">${boss.e}</div>
        <div class="hsb-main"><div class="muted small-text">WEEKLY BOSS · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left</div><h2>${esc(boss.n)}</h2><div class="muted">${esc(boss.s)}</div>${hsBar(f)}
        <div class="small-text">${f.dead ? `🎉 ${h.name} took it down! Keep hitting to climb the house ranking.` : f.left < f.hp * .1 ? `🔥 Under 10%! One more session could finish it.` : `HP is set from how much ${h.name} did over the last 3 weeks, plus 10%. Lock in and it goes down.`}</div></div>
      </div>
      <div class="hscards">${hsCardHtml('m', c.m)}${hsCardHtml('b', c.b)}</div>
    </div>
    ${typeof ftHouseHtml === 'function' ? ftHouseHtml() : ''}
    <div class="friends-main">
      <div class="stack">
        <div class="card"><h3>⚔️ Your hits this week: ${(w.dmg + (typeof ftWeekDmg === 'function' ? ftWeekDmg(wk) : 0)).toLocaleString()}</h3>
          <table class="hstable"><tr><td>📚 Focus sessions</td><td>${w.study} pts${w.deep ? ` · ⚡ Deep Focus ×${w.deep}` : ''}</td></tr>
          <tr><td>🃏 Revision</td><td>${w.rev} pts</td></tr>
          <tr><td>🏃 Workouts</td><td>${w.w} pts · ${w.trainDays} day${w.trainDays === 1 ? '' : 's'}${w.combo ? ' · ⚡ Combo' : ''}</td></tr>
          <tr><td>🏅 PBs</td><td>${w.pb} pts${w.pbs ? ` · ${w.pbs} new` : ''}</td></tr>
          <tr><td>⚔️ Boss fights</td><td>${typeof ftWeekDmg === 'function' ? ftWeekDmg(wk).toLocaleString() : 0} damage</td></tr>
          <tr><td>✨ All-rounder</td><td>${w.both ? '+10% on' : 'Study and train this week for +10%'}</td></tr></table>
          <p class="muted small-text">Points come from focus sessions (▶ on Study), revision cards and quizzes, and finished workouts (minutes × how hard). Daily caps stop farming. Your Mind and Body ratings multiply it into damage.</p>
          ${!w.dmg ? `<div class="row" style="gap:8px"><button class="btn" data-act="goto" data-v="study">📚 Start a focus session</button><button class="btn ghost" data-act="goto" data-v="training">🏃 Log a workout</button></div>` : ''}
        </div>
        <div class="card"><h3>🏆 House ranking</h3><ol class="hsrank">${all.map(({ x, f }) => `<li class="${x.id === st.id ? 'me' : ''}"><span class="hsdot" style="background:${x.col}"></span><b>${x.e} ${x.name}</b><span class="muted small-text">${f.rows.length} player${f.rows.length === 1 ? '' : 's'}</span><span>${f.dead ? '☠️ ' : ''}${Math.min(100, Math.round(f.dealt / f.hp * 100))}%</span></li>`).join('')}</ol>
          <p class="muted small-text">Ranked by how much of their own boss each house has taken down, so small houses can win.</p></div>
      </div>
      <div class="stack">
        <div class="card"><div class="row" style="justify-content:space-between"><h3>${h.e} ${h.name} this week</h3>
          <div class="seg"><button class="${by === 'd' ? 'on' : ''}" data-hs="by" data-v="d">Damage</button><button class="${by === 'e' ? 'on' : ''}" data-hs="by" data-v="e">Effort</button></div></div>
          <ol class="hslist">${rows.map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="hsm">${medal(i)}</span><span>${x.me ? (D.settings.name ? esc(D.settings.name) + ' (you)' : 'You') : esc(x.name)}</span><span class="muted small-text">🧠${x.m} 💪${x.b}</span><b>${(x[by] || 0).toLocaleString()}</b></li>`).join('')}</ol>
          <p class="muted small-text">Damage includes your card ratings; Effort is raw points, so new players can top it too. Top 3 by damage are this week's MVPs.</p>
          <p class="small-text">📣 Get your housemates on the planner: every extra player makes ${h.name} stronger.</p></div>
      </div>
    </div>`;
}

// remembers how the week went, for the Monday recap and the trophy count
function hsRecord(f) {
  const st = hsState(), me = f.rows.findIndex(x => x.me), was = st.seen[f.wk];
  const hr = HS_HOUSES.map(x => hsFight(x.id)).sort((a, b) => b.dealt / b.hp - a.dealt / a.hp).findIndex(x => x.hid === f.hid) + 1;
  const rec = { boss: hsBoss(f.wk).n, hp: f.hp, dealt: f.dealt, me: f.rows[me]?.d || 0, rank: me + 1, hr: hsRows.length ? hr : 0, won: f.dead };
  if (f.dead && !was?.won) { st.wins++; if (typeof ftHouseKill === 'function') ftHouseKill(f.wk); toast(`${hsBoss(f.wk).e} Boss defeated!`, `${hsHouse(f.hid).name} took down ${rec.boss}.`); }
  if (rec.rank && rec.rank <= 3 && f.rows.length >= 3 && !(was?.rank <= 3)) st.mvp++;
  if (!f.dead && f.left < f.hp * .1 && !was?.low) { rec.low = 1; toast('🔥 Boss under 10%', 'The last hit is up for grabs. One focus session or workout could finish it.'); }
  else if (was?.low) rec.low = 1;
  if (JSON.stringify(was) !== JSON.stringify(rec)) { st.seen[f.wk] = rec; for (const k in st.seen) if (k < addDays(f.wk, -70)) delete st.seen[k]; save(); }
}

// a slim strip on Today
function hsTodayStrip() {
  const st = hsState();
  if (!st.id) return `<div class="card hsstrip"><b>🏰 Join your house</b><span class="muted">Your study and workouts become hits on a weekly boss.</span><button class="btn small" data-act="goto" data-v="house">Pick house</button></div>`;
  hsLoad();
  const h = hsHouse(st.id), f = hsFight(st.id), boss = hsBoss(f.wk), pct = Math.min(100, Math.round(f.dealt / f.hp * 100)), t = hsDay(today(), hsMoves(hsCards()));
  return `<div class="card hsstrip" style="--hc:${h.col}"><b>${h.e} ${h.name} vs ${boss.e} ${esc(boss.n)}</b><span class="hsmini"><i style="width:${100 - pct}%"></i></span><span class="muted small-text">${f.dead ? 'Defeated 🎉' : `${pct}% down`} · today you: ${Math.round(t.s + t.b)} pts</span><button class="btn small ghost" data-act="goto" data-v="house">Open</button></div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-hs]'); if (!el) return;
  const st = hsState();
  switch (el.dataset.hs) {
    case 'pick': {
      const h = hsHouse(el.dataset.h); if (!h || st.id) return;
      if (!confirm(`Join ${h.name} ${h.team}? You can't switch house later.`)) return;
      st.id = h.id; st.since = today(); save(); hsLoad(true); render();
      const w = hsWeek(mondayOf(today()));
      toast(`${h.e} Welcome to ${h.name}!`, w.dmg ? `Your logging this week already hit the boss for ${w.dmg.toLocaleString()} damage.` : 'Start a focus session or log a workout to land your first hit.');
      break;
    }
    case 'by': ui.hsBy = el.dataset.v; render(); break;
    case 'recap': st.recapSeen = mondayOf(today()); save(); render(); break;
  }
});
