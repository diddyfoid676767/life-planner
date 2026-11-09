'use strict';
/* Character (2.47, islands stage 1): two fixed cards and two currencies.
   - Mind (Logic, Knowledge, Expression, Focus) comes from your average scaled
     school score in each subject. Each subject feeds several stats by weight.
     Scores are typed in per term for now (MyWestbourne fetching comes later).
   - Body (Speed, Endurance, Strength, Agility) comes from PRs: track and field,
     tested maxes, estimated 1RMs from any gym set, high-rep sets, swimming by
     stroke, logged runs, plus the team sports you play.
   - Classes: 8, each built on 3 stats. Your best matches are suggested.
   - Lumen (study) and Ember (training) are worked out from what you logged,
     so ticking things on and off can't farm them. Sessions count from 15
     minutes, pay by the minute, and have daily caps (6h study, 3h training).
     Class mode's lock-in timer pays much less, scaled by your effort rating.
   Cards can't be changed by spending; only real results move them. */

const LUMEN = '✦', EMBER = '🔥';
const MIND_STATS = [['log', 'Logic', '#4dabf7'], ['kno', 'Knowledge', '#748ffc'], ['exp', 'Expression', '#da77f2'], ['foc', 'Focus', '#38d9a9']];
const BODY_STATS = [['spd', 'Speed', '#339af0'], ['end', 'Endurance', '#2f9e44'], ['str', 'Strength', '#e03131'], ['agi', 'Agility', '#f59f00']];
const CD_STAT = Object.fromEntries([...MIND_STATS, ...BODY_STATS].map(s => [s[0], s]));
const CD_CLASSES = [
  { id: 'tactician', n: 'Tactician', e: '♟️', s: ['log', 'agi', 'foc'], d: 'Plans three moves ahead and strikes where it counts.', col: '#4dabf7', title: 'The Strategist' },
  { id: 'sage', n: 'Sage', e: '📜', s: ['kno', 'log', 'end'], d: 'Knows the answer and outlasts the fight.', col: '#748ffc', title: 'Keeper of Knowledge' },
  { id: 'bard', n: 'Bard', e: '🎻', s: ['exp', 'kno', 'agi'], d: 'Words and wit that lift the whole house.', col: '#da77f2', title: 'Voice of the House' },
  { id: 'monk', n: 'Monk', e: '🧘', s: ['foc', 'end', 'exp'], d: 'Calm, steady and impossible to distract.', col: '#38d9a9', title: 'The Unshaken' },
  { id: 'striker', n: 'Striker', e: '⚡', s: ['spd', 'agi', 'str'], d: 'Hits first, hits fast, hits hard.', col: '#fab005', title: 'Lightning Fist' },
  { id: 'ranger', n: 'Ranger', e: '🏹', s: ['end', 'foc', 'spd'], d: 'Goes the distance and never misses.', col: '#40c057', title: 'The Far-Sighted' },
  { id: 'guardian', n: 'Guardian', e: '🛡️', s: ['str', 'end', 'log'], d: 'Holds the line so others can attack.', col: '#f76707', title: 'Shield of the House' },
  { id: 'rogue', n: 'Rogue', e: '🗡️', s: ['agi', 'spd', 'exp'], d: 'Quick, slippery and full of tricks.', col: '#e64980', title: 'Shadow Blade' },
];
// subject name -> Mind weights and a scaling factor (roughly how VCE scales it)
// 2.57: classes unlock at player level 8 (2,800 XP) and are permanent once picked.
// A Respec Scroll (about a 3% drop when your house kills the weekly boss) lets you pick again.
const CD_CLASS_LV = 8, CD_RESPEC_DROP = .03;
// your class, once it is locked in (an old pick from before 2.57 waits until level 8)
function cdClass() {
  if (!cdState().clsV) { // 2.57 ship: anyone already past level 8 with a class keeps it and gets one free re-pick
    const past = typeof solisHas === 'function' && solisHas(CD_CLASS_LV), st = cdState(); // (cdState() makes a new object, so get it after the level)
    st.clsV = 1;
    if (st.cls && past) { st.clsLock = 1; st.respec = (st.respec || 0) + 1; st.respecGift = 1; }
  }
  const st = cdState();
  return st.clsLock && CD_CLASSES.some(c => c.id === st.cls) ? st.cls : '';
}
const cdClassInfo = (id = cdClass()) => CD_CLASSES.find(c => c.id === id) || null;
// the choose-a-class screen (opens from the You page)
function clsPickerDraw() {
  let ov = document.getElementById('clsov');
  if (!ui.clsPick) { ov?.remove(); return; }
  if (!ov) { ov = document.createElement('div'); ov.id = 'clsov'; document.body.appendChild(ov); }
  const st = cdState(), ch = cdChar(), cur = cdClass(), sel = ui.clsSel || '', best = ch.fit.slice(0, 3).map(x => x.c.id), respec = !!cur;
  const sk = s => `<div class="clsk"><span>${s.e}</span><div><b>${esc(s.n)}</b> <small class="muted">${s.k === 'spell' ? 'Spell' : 'Move'} · ${CD_STAT[s.st][1]}</small><div class="small-text">${esc(s.d)}</div></div></div>`;
  ov.innerHTML = `<div class="clsbox"><div class="row" style="justify-content:space-between"><div><div class="muted small-text">${respec ? `RESPEC SCROLL · ${st.respec || 0} LEFT` : `LEVEL ${CD_CLASS_LV} REACHED`}</div><h2 style="margin:2px 0">Choose your class</h2></div><button class="iconbtn" data-cls="close" title="Close">✕</button></div>
    <p class="muted small-text">Your class is <b>permanent</b>. It gives you a title, an outfit colour and aura, a passive and two skills only it has (a spell and a move). ⭐ marks your best matches from your Mind and Body stats. ${respec ? 'Picking a new class uses up one Respec Scroll.' : 'To change it later you need a Respec Scroll, a very rare drop from killing the weekly boss with your house.'}</p>
    <div class="clsgrid">${CD_CLASSES.map(c => { const F = FT_CLASS[c.id]; return `<button type="button" class="clscard ${sel === c.id ? 'on' : ''} ${cur === c.id ? 'cur' : ''}" style="--cc:${c.col}" data-cls="sel" data-id="${c.id}">
      <div class="clstop"><span class="clse">${c.e}</span><div><b>${c.n}${best.includes(c.id) ? ' ⭐' : ''}</b><small>${esc(c.title)}</small></div>${cur === c.id ? '<span class="tag">Current</span>' : ''}</div>
      <div class="clsstats">${c.s.map(k => `<span>${CD_STAT[k][1]} <b>${ch.all[k]}</b></span>`).join('')}</div>
      <div class="small-text muted">${esc(c.d)}</div><div class="small-text"><b>Passive:</b> ${esc(F.p)}</div>${ftClassSkills(c.id).map(sk).join('')}</button>`; }).join('')}</div>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-cls="close">Not yet</button><button class="btn primary" data-cls="ok" ${sel && sel !== cur ? '' : 'disabled'}>${sel ? `Become a ${cdClassInfo(sel).n}` : 'Pick a class'}</button></div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-cls]'); if (!el || !D) return;
  const a = el.dataset.cls;
  if (a === 'open') { if (!solisHas(CD_CLASS_LV)) { toast('🔒 Not yet', `Classes unlock at level ${CD_CLASS_LV}.`); return; } const had = cdClass(), st = cdState(); if (had && !(st.respec > 0)) { toast('📜 You need a Respec Scroll', 'Your class is permanent. Scrolls are a rare drop from killing the weekly boss.'); return; } ui.clsPick = true; ui.clsSel = st.clsLock ? '' : st.cls || ''; }
  else if (a === 'close') { ui.clsPick = false; ui.clsSeen = true; }
  else if (a === 'sel') ui.clsSel = el.dataset.id;
  else if (a === 'ok') {
    const c = cdClassInfo(ui.clsSel), had = cdClass(), st = cdState(); if (!c || c.id === had) return; // (fresh state: cdClass() can replace it)
    if (had && !(st.respec > 0)) return;
    if (!confirm(had ? `Use a Respec Scroll and become a ${c.n}? This is permanent until your next scroll.` : `Become a ${c.n}? This is permanent.`)) return;
    if (had) st.respec--;
    st.cls = c.id; st.clsLock = 1; st.clsAt = today(); delete st.respecGift; ui.clsPick = false; ui.clsSeen = true;
    save(); render();
    if (typeof celebrate === 'function') celebrate({ icon: `<span class="critbig">${c.e}</span>`, color: c.col, kicker: had ? 'New class' : 'Class chosen', title: `${esc(c.n)}: ${esc(c.title)}`, text: `${esc(FT_CLASS[c.id].p)} Your two class skills are in your build.` });
  }
  clsPickerDraw();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.clsPick) { ui.clsPick = false; ui.clsSeen = true; clsPickerDraw(); } });

const CD_SUBJ = [
  [/specialist/i, { log: .6, foc: .3, kno: .1 }, 1.12],
  [/method/i, { log: .6, foc: .3, kno: .1 }, 1.05],
  [/math|further|general/i, { log: .55, foc: .3, kno: .15 }, .97],
  [/physic/i, { log: .5, kno: .35, foc: .15 }, 1.03],
  [/chem/i, { kno: .5, log: .35, foc: .15 }, 1.05],
  [/bio/i, { kno: .6, foc: .25, log: .15 }, .98],
  [/psych/i, { kno: .5, foc: .3, exp: .2 }, .92],
  [/english|literat|\blit\b|eal/i, { exp: .6, kno: .25, foc: .15 }, 1],
  [/histor|politic|legal|philos|religio|global/i, { kno: .45, exp: .4, log: .15 }, 1],
  [/econ|account|business/i, { log: .4, kno: .4, exp: .2 }, 1],
  [/french|chinese|japanese|spanish|german|italian|indonesian|latin|korean|greek|language/i, { kno: .4, exp: .35, foc: .25 }, 1.08],
  [/comput|software|algorith|digital|it\b/i, { log: .6, foc: .25, kno: .15 }, 1],
  [/art|media|drama|theatre|music|design|visual|dance/i, { exp: .65, foc: .2, kno: .15 }, .92],
  [/\bpe\b|physical ed|health|outdoor/i, { kno: .45, foc: .35, exp: .2 }, .9],
  [/geog|environ|agri/i, { kno: .55, exp: .25, log: .2 }, .95],
];
const CD_SUBJ_DEF = [{ log: .25, kno: .25, exp: .25, foc: .25 }, 1];
const cdSubjInfo = name => { const m = CD_SUBJ.find(x => x[0].test(name || '')); return m ? [m[1], m[2]] : CD_SUBJ_DEF; };
// team sports: how each one feeds Body (adds up to 1)
const CD_SPORTS = [
  ['afl', 'AFL', { spd: .25, end: .35, str: .15, agi: .25 }], ['nrl', 'NRL', { spd: .2, end: .25, str: .35, agi: .2 }],
  ['soccer', 'Soccer', { spd: .25, end: .4, str: .05, agi: .3 }], ['cricket', 'Cricket', { spd: .2, end: .15, str: .2, agi: .45 }],
  ['basketball', 'Basketball', { spd: .25, end: .25, str: .1, agi: .4 }], ['netball', 'Netball', { spd: .2, end: .25, str: .05, agi: .5 }],
  ['tennis', 'Tennis', { spd: .25, end: .3, str: .1, agi: .35 }], ['rugby', 'Rugby union', { spd: .2, end: .25, str: .4, agi: .15 }],
];
const CD_INT = { Easy: .8, Moderate: 1, Hard: 1.3 };
const CD_CAP_STUDY = 360, CD_CAP_TRAIN = 180, CD_MIN = 15, CD_LOCK_RATE = .3;

const cdState = () => { const c = D.cards = Object.assign({ since: '', cls: '', scores: {} }, D.cards || {}); if (!c.since) c.since = today(); return c; };
const cdTerm = (d = today()) => `${d.slice(0, 4)}-T${Math.ceil(+d.slice(5, 7) / 3)}`;
const cdTermName = t => `Term ${t.slice(-1)} ${t.slice(0, 4)}`;
const cdRate = f => Math.round(5 + 94 * Math.max(0, Math.min(1, f)));
const cdAvg = o => { const v = Object.values(o); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };

// ---------- Mind ----------
// latest score you entered for each subject (this term first, then earlier terms)
function cdScores() {
  const st = cdState(), sc = st.scores, rs = st.res || {}, terms = [...new Set([...Object.keys(sc), ...Object.keys(rs)])].sort().reverse(), out = {};
  for (const s of D.subjects) for (const t of terms) {
    const list = rs[t]?.[s.id]; // 2.51: single results (SACs, tests) entered one at a time, averaged
    if (list?.length) { const W = list.reduce((a, r) => a + (+r.w || 1), 0); out[s.id] = { pct: Math.round(list.reduce((a, r) => a + r.v * (+r.w || 1), 0) / W), term: t, n: list.length }; break; } // 2.55: each result has a weighting
    const v = sc[t]?.[s.id]; if (v !== '' && v != null && !isNaN(+v)) { out[s.id] = { pct: +v, term: t }; break; }
  }
  return out;
}
function cdMind() {
  const sc = cdScores(), sum = {}, wt = {};
  for (const s of D.subjects) {
    const x = sc[s.id]; if (!x) continue;
    const [w, scale] = cdSubjInfo(s.name), p = Math.min(100, x.pct * scale);
    for (const [k, v] of Object.entries(w)) { sum[k] = (sum[k] || 0) + p * v; wt[k] = (wt[k] || 0) + v; }
  }
  // 35% scaled is the floor, 95% is 99
  return Object.fromEntries(MIND_STATS.map(([k]) => [k, wt[k] ? cdRate((sum[k] / wt[k] - 35) / 60) : 5]));
}

// ---------- Body ----------
// which Body stats each kind of PR feeds
function cdTestWeights(T) {
  const id = T.id;
  if (T.cat === 'swim') return /breast|fly/.test(id) ? { end: .5, str: .3, spd: .2 } : /im/.test(id) ? { end: .7, str: .2, agi: .1 } : { end: .7, spd: .3 };
  if (T.cat === 'sprint') return id === 's400' ? { spd: .6, end: .4 } : { spd: 1 };
  if (T.cat === 'hurdle') return id === 'h400' ? { end: .5, spd: .3, agi: .2 } : { agi: .5, spd: .5 };
  if (T.cat === 'dist') return id === 's800' ? { end: .7, spd: .3 } : { end: 1 };
  if (T.cat === 'jump') return { agi: .6, str: .2, spd: .2 };
  if (T.cat === 'rm') return T.stat === 'pow' ? { str: .6, spd: .2, agi: .2 } : { str: 1 };
  return { agil: { agi: 1 }, illi: { agi: 1 }, sit: { agi: 1 }, beep: { end: 1 }, yoyo: { end: 1 }, pull: { str: .7, end: .3 }, push: { str: .7, end: .3 }, plank: { end: .6, str: .4 }, swim50: { end: .6, spd: .4 } }[id] || { [T.stat in CD_STAT ? T.stat : 'str']: 1 };
}
function cdBodySources() {
  const src = [], add = (f, w, label, when) => { if (f == null || !(f > 0)) return; f = Math.min(1.1, f); for (const [k, v] of Object.entries(w)) src.push({ k, v: f * v, f, label, when, big: f >= .88 }); };
  for (const T of TESTS) { const h = pbHistory(T.id); if (h.best == null) continue; const p = [...h.list].reverse().find(x => x.value === h.best); add(testLevel(T, h.best), cdTestWeights(T), `${T.name}: ${fmtTest(T, h.best)}`, p?.date); }
  // gym log: estimated 1RM from any set, and high-rep sets for Endurance
  if (typeof liftPRs === 'function') {
    const P = liftPRs();
    for (const [x, p] of Object.entries(P)) add(liftLevel(x, p.e), { str: 1 }, `${exInfo(x).name}: ~${r1(p.e)} kg 1RM`, p.eDate);
    const hi = {};
    for (const s of allSets()) if (s.r >= 12 && s.e) { const f = (liftLevel(s.x, s.e) || 0) * Math.min(1, s.r / 20); if (f > (hi[s.x]?.f || 0)) hi[s.x] = { f, s }; }
    for (const [x, { f, s }] of Object.entries(hi)) add(f, { end: .6 }, `${exInfo(x).name}: ${s.w} kg × ${s.r}`, s.date);
  }
  // logged runs (app-tracked or typed in): best run as a 5km-equivalent time
  const T5 = TESTS.find(t => t.id === 'tt5k'); let best = null;
  for (const w of D.workouts) {
    const d = +w.distance, t = +w.duration;
    if (!w.done || w.sport !== 'Running' || !(d >= 1.5 && d <= 50) || !(t > 0)) continue;
    const eq = t * 60 * Math.pow(5 / d, 1.06), f = testLevel(T5, eq);
    if (f != null && (!best || f > best.f)) best = { f, w, eq };
  }
  if (best) add(best.f, best.w.distance <= 3 ? { end: 1, spd: .3 } : { end: 1 }, `Run: ${best.w.distance} km in ${fmtMins(+best.w.duration)}`, best.w.date);
  return src;
}
// hours of each team sport in the last 90 days
function cdSportHours() {
  const from = addDays(today(), -90), h = {};
  for (const w of D.workouts) if (w.done && w.teamSport && w.date >= from && w.date <= today()) h[w.teamSport] = (h[w.teamSport] || 0) + (+w.duration || 0) / 60;
  return h;
}
function cdBody() {
  const src = cdBodySources(), hrs = cdSportHours(), out = {};
  for (const [k] of BODY_STATS) {
    // best three results count 50/30/20, so one PR gets you started and variety gets you to the top
    const top = src.filter(s => s.k === k).sort((a, b) => b.v - a.v).slice(0, 3), core = top.reduce((a, s, i) => a + s.v * [.5, .3, .2][i], 0);
    let sport = 0; for (const [id, , w] of CD_SPORTS) sport += (w[k] || 0) * Math.min(1, (hrs[id] || 0) / 40);
    out[k] = cdRate(core + .3 * Math.min(1, sport * 2));
  }
  return out;
}
function cdChar() {
  const m = cdMind(), b = cdBody(), all = { ...m, ...b };
  const fit = CD_CLASSES.map(c => ({ c, v: c.s.reduce((a, k) => a + all[k], 0) })).sort((a, b) => b.v - a.v);
  return { m, b, all, mind: cdAvg(m), body: cdAvg(b), ovr: cdAvg(all), fit };
}

// ---------- Lumen and Ember ----------
function cdDay(d) {
  let study = 0, lock = 0, lockMins = 0, train = 0, ember = 0;
  for (const l of D.focusLogs) if (l.date === d && l.mins >= CD_MIN && !l.withered) study += l.mins;
  // class mode lock-in: much less than real study, scaled by the effort you rated (unrated counts as so-so)
  const bells = typeof schoolCfg === 'function' ? schoolCfg().bells : [];
  for (const [i, r] of Object.entries(D.school?.log?.[d] || {})) {
    const b = bells[i]; if (!r.started || r.absent || !b) continue;
    const mins = hmToMin(b.end) - hmToMin(b.start); if (mins < CD_MIN) continue;
    const e = eff10(r), k = !e ? .6 : e >= 8 ? 1 : e >= 5 ? .6 : .25;
    lockMins += mins; lock += mins * CD_LOCK_RATE * k;
  }
  const sCap = Math.min(study, CD_CAP_STUDY), lCap = Math.max(0, Math.min(lockMins, CD_CAP_STUDY - sCap)), lumen = Math.round(sCap + (lockMins ? lock * lCap / lockMins : 0));
  const ws = D.workouts.filter(w => w.done && w.date === d && +w.duration >= CD_MIN);
  for (const w of ws) { const m = Math.min(+w.duration, CD_CAP_TRAIN - train); if (m <= 0) break; train += m; ember += m * (CD_INT[w.intensity] || 1); }
  return { study, lockMins, lumen, train, ember: Math.round(ember) };
}
function cdWallet() {
  const st = cdState(), hf = typeof hiFrom === 'function' ? hiFrom() : ''; let l = 0, e = 0, hl = 0, he = 0;
  for (let d = st.since; d <= today(); d = addDays(d, 1)) { const x = cdDay(d), dl = x.lumen, de = x.ember; l += dl; e += de; if (hf && d >= hf) { hl += dl; he += de; } } // 2.51: island collector bonuses are collected by hand (islands.js), not added here
  // 2.50: a fixed share of what you earn after joining the house island goes to the house pool
  const earnL = l, earnE = e; // 2.51: lifetime earnings drive the player level (level.js)
  hl = hf ? Math.round(hl * HI_SHARE) : 0; he = hf ? Math.round(he * HI_SHARE) : 0; l = Math.round(l) - hl; e = Math.round(e) - he;
  const sp = st.spent || {}, got = st.got || {}; // 2.48: spent on spells/moves and lost stakes; won in battles and scrapped gear
  return { lumen: Math.max(0, l + (got.l || 0) - (sp.l || 0)), ember: Math.max(0, e + (got.e || 0) - (sp.e || 0)), today: cdDay(today()), hl, he, earnL, earnE };
}

// ---------- page ----------
function cdBars(stats, vals) {
  return stats.map(([k, n, c]) => `<div class="cdstat"><span>${n}</span><div class="cdtrack"><i style="width:${vals[k]}%;background:${c}"></i></div><b>${vals[k]}</b></div>`).join('');
}
// 2.51: the Character page is now part of Profile (profile.js puts these pieces together)
function cdParts() {
  const st = cdState(), ch = cdChar(), w = cdWallet(), t = w.today, term = cdTerm();
  const cls = cdClassInfo(), sug = ch.fit.slice(0, 3).map(x => x.c.id);
  const fresh = ch.ovr <= 6;
  const sc = st.scores[term] || {}, latest = cdScores();
  const rs = (st.res || {})[term] || {};
  const subjRows = D.subjects.map(s => {
    const [wts, scale] = cdSubjInfo(s.name), cur = latest[s.id], list = rs[s.id] || [], old = !list.length && sc[s.id] != null;
    const chips = list.map(r => `<span class="cdres">${esc(r.n || 'Result')} <b>${r.v}%</b>${(+r.w || 1) !== 1 ? `<small class="muted"> ×${+r.w}</small>` : ''}<button class="iconbtn" data-cd="delRes" data-s="${s.id}" data-id="${r.id}" title="Remove">✕</button></span>`).join('')
      + (old ? `<span class="cdres">Term average <b>${sc[s.id]}%</b><button class="iconbtn" data-cd="delOld" data-s="${s.id}" title="Remove">✕</button></span>` : '');
    return `<div class="cdsubjrow"><div class="cdsubjtop"><span><span class="dot" style="background:${s.color}"></span> <b>${esc(s.name)}</b></span>
        <span class="muted small-text">${cur ? `${cur.pct}%${cur.term !== term ? ` (from ${cdTermName(cur.term)})` : cur.n ? ` weighted average of ${cur.n}` : ''}` : 'No score yet'}</span></div>
      <div class="muted small-text">${Object.entries(wts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${CD_STAT[k][1]} ${Math.round(v * 100)}%`).join(' · ')}${scale !== 1 ? ` · scaled ×${scale}` : ''}</div>
      <div class="cdreslist">${chips}<input type="text" class="cdresn" id="cdn-${s.id}" maxlength="30" placeholder="What (e.g. SAC 1)"><input type="number" min="0" max="100" step="1" class="cdpct" id="cdr-${s.id}" data-cdadd="${s.id}" placeholder="%"><input type="number" min="0.1" max="10" step="0.1" class="cdpct cdw" id="cdw-${s.id}" data-cdadd="${s.id}" placeholder="Weight" title="Weighting: how much this result counts (1 = normal, 2 = counts double)"><button class="btn small" data-cd="addRes" data-s="${s.id}">Add</button></div></div>`;
  }).join('');
  const src = cdBodySources(), hrs = cdSportHours();
  const srcList = BODY_STATS.map(([k, n, c]) => { const top = src.filter(s => s.k === k).sort((a, b) => b.v - a.v).slice(0, 3);
    return `<div class="cdsrc"><b style="color:${c}">${n}</b>${top.length ? top.map(s => `<span>${esc(s.label)}${s.big ? ' <span class="tag" title="Very strong result: it will be checked once approvals are switched on">to be checked</span>' : ''}</span>`).join('') : '<span class="muted">No results yet</span>'}</div>`; }).join('');
  const sportsLog = D.workouts.filter(x => x.teamSport).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return {
    wallet: `    <div class="cdwallet">
      <div class="card cdcoin cd-l"><div class="cdbig">${LUMEN} ${w.lumen.toLocaleString()}</div><div><b>Lumen</b><div class="muted small-text">From study. Today ${t.lumen} (${fmtMins(Math.min(t.study, CD_CAP_STUDY)) || '0m'} of ${CD_CAP_STUDY / 60}h study${t.lockMins ? `, ${fmtMins(t.lockMins)} class lock-in` : ''})</div></div></div>
      <div class="card cdcoin cd-e"><div class="cdbig">${EMBER} ${w.ember.toLocaleString()}</div><div><b>Ember</b><div class="muted small-text">From training. Today ${t.ember} (${fmtMins(t.train) || '0m'} of ${CD_CAP_TRAIN / 60}h)</div></div></div>
    </div>
    <p class="muted small-text">Sessions count from ${CD_MIN} minutes and pay by the minute (training pays more when it's hard). Class mode's lock-in pays about a third as much, scaled by your effort rating. Spend them on spells and moves in the Build below.</p>
`,
    banner: `    ${fresh ? `<div class="card banner"><b>You're on a starter card.</b> <span class="muted">Add your SAC scores on Study and log a few PRs on Fitness to build your real card.</span></div>` : ''}
`,
    cards: `    <div class="cdcards">
      <div class="card cdcard cd-m"><div class="cdhead"><span>🧠 MIND</span><b>${ch.mind}</b></div>${cdBars(MIND_STATS, ch.m)}</div>
      <div class="card cdcard cd-ovr"><div class="cdcls">${cls ? cls.e : '❔'}</div><div class="cdovr">${ch.ovr}</div><div>${cls ? `<b>${cls.n}</b>` : '<span class="muted">No class yet</span>'}</div><div class="muted small-text">${esc(D.settings.name || 'You')}</div></div>
      <div class="card cdcard cd-b"><div class="cdhead"><span>💪 BODY</span><b>${ch.body}</b></div>${cdBars(BODY_STATS, ch.b)}</div>
    </div>
`,
    cls: `    <div class="card"><h3>Class</h3><p class="muted small-text">Pick the class you want to play. ⭐ marks your best matches from your top stats. Your class gives you a passive and its own skill in battles.</p>
      <div class="cdclasses">${CD_CLASSES.map(c => `<button type="button" class="cdclass ${st.cls === c.id ? 'on' : ''}" data-cd="cls" data-id="${c.id}"><span class="cdce">${c.e}</span><b>${c.n}${sug.includes(c.id) ? ' ⭐' : ''}</b><small>${c.s.map(k => CD_STAT[k][1]).join(' · ')}</small><small class="muted">${c.d}</small></button>`).join('')}</div></div>
`,
    build: `    ${typeof ftBuildHtml === 'function' ? `<div class="friends-main"><div class="stack">${ftBuildHtml()}</div><div class="stack">${ftBattlesHtml()}</div></div>` : ''}
`,
    scores: `<div class="card cdscores"><div class="card-head"><h2>🎓 SAC scores, ${cdTermName(term)}</h2></div>
        <p class="muted small-text">Add each result as you get it back (SACs, tests, exams) as a percentage, with its weighting (1 = normal, 2 = counts double). Each subject shows the weighted average of this term's results, which also builds your Mind card. A subject with nothing this term uses last term's score.</p>
        ${D.subjects.length ? `<div class="cdsubj">${subjRows}</div>` : '<p class="empty">Add your subjects first.</p>'}</div>`,
    stats: `    <div class="friends-main">
      <div class="stack"><div class="card"><h3>💪 What builds your Body</h3>${srcList}
        <p class="muted small-text">Your best three results for each stat count. PRs come from Training → Athletics, your gym log (estimated 1RM from any set, 12+ rep sets help Endurance), swimming by stroke, logged runs and team sports.</p>
        <button class="btn small" data-act="goto" data-v="training">Log a PR</button></div></div>
      <div class="stack"><div class="card"><h3>🏉 Sports log</h3>
          <div class="row cdsport"><select id="cdSport">${CD_SPORTS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select>
            <select id="cdKind"><option>Game</option><option>Training</option></select>
            <input id="cdMins" type="number" min="15" max="240" step="5" value="60" title="Minutes">
            <select id="cdInt"><option>Easy</option><option selected>Moderate</option><option>Hard</option></select>
            <input id="cdDate" type="date" value="${today()}"><button class="btn small primary" data-cd="sport">Log</button></div>
          ${sportsLog.length ? `<ul class="cdlog">${sportsLog.map(x => `<li><span>${fmtDate(x.date)}</span><b>${esc(x.title)}</b><span class="muted">${fmtMins(+x.duration)} · ${x.intensity}</span><button class="iconbtn" data-cd="delSport" data-id="${x.id}" title="Delete">✕</button></li>`).join('')}</ul>` : ''}
          <p class="muted small-text">Hours over the last 90 days add to your Body stats (up to 40 hours per sport), and each session earns Ember like a workout. ${Object.keys(hrs).length ? 'Last 90 days: ' + Object.entries(hrs).map(([id, h]) => `${CD_SPORTS.find(s => s[0] === id)?.[1] || id} ${r1(h)}h`).join(', ') : ''}</p></div>
      </div>
    </div>` };
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-cd]'); if (!el || el.tagName === 'INPUT') return;
  const st = cdState();
  switch (el.dataset.cd) {
    case 'sport': {
      const id = $('#cdSport').value, int = $('#cdInt').value, sp = CD_SPORTS.find(s => s[0] === id), mins = Math.max(0, Math.min(240, +$('#cdMins').value || 0)), d = $('#cdDate').value || today();
      if (!sp || mins < 1) return;
      if (d > today()) { alert("You can't log a game in the future."); return; }
      D.workouts.push({ id: uid(), title: `${sp[1]} ${$('#cdKind').value.toLowerCase()}`, sport: 'Team sport', teamSport: id, date: d, time: '', duration: mins, distance: '', intensity: int, notes: '', done: true });
      save(); render(); toast(`🏉 ${sp[1]} logged`, mins >= CD_MIN ? `+${Math.round(Math.min(mins, CD_CAP_TRAIN) * (CD_INT[int] || 1))} ${EMBER} if under today's cap` : `Sessions under ${CD_MIN} minutes don't earn Ember.`);
      break;
    }
    case 'addRes': cdAddRes(el.dataset.s); break;
    case 'delRes': { const t = cdTerm(), r = (st.res || {})[t]; if (!r?.[el.dataset.s]) return; r[el.dataset.s] = r[el.dataset.s].filter(x => x.id !== el.dataset.id); if (!r[el.dataset.s].length) delete r[el.dataset.s]; save(); render(); break; }
    case 'delOld': { const s = st.scores[cdTerm()]; if (s) { delete s[el.dataset.s]; save(); render(); } break; }
    case 'delSport': if (confirm('Delete this session?')) { D.workouts = D.workouts.filter(w => w.id !== el.dataset.id); save(); render(); } break;
  }
});
// 2.57: Study shows a read-only summary; results are added in You, Records
function cdScoresMini() {
  const latest = cdScores(), term = cdTerm();
  return `<div class="card cdscores mini"><div class="card-head"><h2>🎓 SAC averages</h2><span style="flex:1"></span><button class="btn small" data-pf="goRec">+ Add a result</button></div>
    ${D.subjects.length ? `<div class="cdmini">${D.subjects.map(s => { const x = latest[s.id]; return `<div><span><span class="dot" style="background:${s.color}"></span> ${esc(s.name)}</span><b>${x ? x.pct + '%' : '–'}</b><small class="muted">${x ? x.term !== term ? cdTermName(x.term) : x.n ? `${x.n} result${x.n === 1 ? '' : 's'}` : 'term average' : 'no score yet'}</small></div>`; }).join('')}</div>` : '<p class="empty">Add your subjects first.</p>'}
    <p class="muted small-text">Your results and PRs live together in You, Records.</p></div>`;
}
// 2.51: add one result at a time (Enter in the % box works too)
function cdAddRes(sid) {
  const inp = document.getElementById('cdr-' + sid), nm = document.getElementById('cdn-' + sid), raw = (inp?.value || '').trim();
  if (raw === '' || isNaN(+raw)) { inp?.focus(); return; }
  const st = cdState(), t = cdTerm(), r = st.res = st.res || {}, T = r[t] = r[t] || {};
  const wi = document.getElementById('cdw-' + sid), w = Math.max(0.1, Math.min(10, +(wi?.value || 1) || 1));
  (T[sid] = T[sid] || []).push({ id: uid(), v: Math.max(0, Math.min(100, Math.round(+raw))), n: (nm?.value || '').trim().slice(0, 30), d: today(), ...(w !== 1 ? { w } : {}) });
  inp.value = ''; if (nm) nm.value = ''; if (wi) wi.value = '';
  save(); render(); toast('🧠 Result added', `${D.subjects.find(x => x.id === sid)?.name || 'Subject'}: ${Math.round(+raw)}%`);
  setTimeout(() => document.getElementById('cdr-' + sid)?.focus(), 0);
}
document.addEventListener('keydown', e => { const el = e.target.closest?.('[data-cdadd]'); if (el && e.key === 'Enter') { e.preventDefault(); cdAddRes(el.dataset.cdadd); } });
