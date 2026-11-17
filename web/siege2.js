'use strict';
/* Sieges, stage 2 (2.89.0): real wars between houses. Loaded after siege.js. Design: house-raids/plan.md.
   Everything lives in each house's own document under b._sg (no rules change): a house only ever writes
   its own document, and reads the other houses' to see wars against it.
   - Siege vote (vt): the Champion calls it and pays a war chest from the pool. Active members vote yes or
     no, pick a target and tick "I'll fight". Closes after 24 h: passes with more yes than no and enough
     volunteers. A failed vote refunds the chest (credit, cr).
   - War (war): declared when the vote passes. The siege window opens 24 h later and lasts 48 h. Each
     volunteer gets 1 run (2 when under 6 volunteers); late volunteers can join in the window's first 24 h.
     Runs are simulated on a snapshot of the enemy island (sn), saved with the seed and choices, so anyone
     can watch the exact replay.
   - The defender sees the war by reading the attacker's document: a banner, Stand guard (gd), and a war
     lock on terrain (6 changes at 3x the price).
   - Result: average stars of the best 5 runs over min(5, volunteers). 1.5+ is a win: loot from the
     defender's pool (not the Vault's space), scaled by stars and match, staged damage on up to 2
     buildings, a 5-day shield, rating changes (rt). The attacker writes the result into its log; the
     defender applies its side when one of its members next opens the house island (got).
   - Member stamps (mb): who's been active in the last 14 days and their power, for "too small to siege",
     house power and match labels.
   - Owner pause: /api/sieges reads sieges.json on main ({paused, note, cancel: [war ids]}).
   All numbers are in SGW so they can be tuned. */

const SGW = {
  chest: { l: 150, x: 150 }, voteH: 24, declH: 24, winH: 48, lateH: 24, shieldD: 5,
  minAct: 3, actD: 14, minVol: 3, best: 5, win: 1.5, runs: [2, 1], runsUnder: 6,
  rew: [20, 40, 70, 100], hold: { l: 200, x: 200 }, guardRew: { l: 30, x: 30 },
  loot: [[0, 0], [1, .05], [2, .15], [3, .2]], lootMax: .2, mint: .1, rev: 1.2,
  // much weaker, weaker, even, stronger (target power / ours)
  match: [[.7, .4, 'Much weaker'], [.87, .8, 'Weaker'], [1.15, 1, 'Even match'], [1e9, 1.3, 'Stronger']],
  dmgM: [1, .75, .5, 0], rep: [0, .05, .15, .35], dmgN: ['', 'Light damage', 'Heavy damage', 'Broken'],
  lock: { n: 6, k: 3 }, rt0: 1000, rt: { win: 20, lose: -10, hold: 15, fell: -15 }, scan: 150, snaps: 6, logN: 6,
};
const SG_HR = 3600000;
const SGS = { at: 0, docs: {}, cfg: { paused: false, cancel: [] }, busy: false, syncAt: 0, syncing: false };

// ---------- small helpers ----------
const sgG = d => { d.b = d.b || {}; return (d.b._sg = d.b._sg || {}); };
const sgMyH = () => SG_VIS?.home?.h || hsState().id;
const sgHome = () => (SG_VIS?.home ? SG_VIS.home.doc : HI.doc) || {};
const sgDocOf = h => h === sgMyH() ? sgHome() : SGS.docs[h]?.doc || null;
const sgDay = ms => ymd(new Date(ms));
const sgWeekOf = ms => mondayOf(sgDay(ms));
const sgRt = d => Math.round(sgDoc(d).rt ?? SGW.rt0);
const sgHn = h => { const x = hsHouse(h); return x ? `${x.e} ${x.name}` : h; };
function sgLeft(ms) {
  ms = Math.max(0, ms); const m = Math.round(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
}
function sgHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const sgR2 = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
const sgRoundA = A => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, sgR2(v)]));
const sgMyPow = () => { try { const A = sgAttacker(); return Math.round(A.body + A.mind); } catch { return 0; } };
// members who've opened the house island in the last 14 days
const sgAct = d => Object.entries(sgDoc(d).mb || {}).filter(([, m]) => m && m.d >= addDays(today(), -SGW.actD));
const sgPow = d => { const a = sgAct(d); return a.length ? Math.round(a.reduce((s, [, m]) => s + (+m.p || 0), 0) / a.length) : 0; };
const sgMatch = (mine, theirs) => { const r = mine ? theirs / mine : 1, m = SGW.match.find(x => r < x[0]); return { K: m[1], n: m[2], r }; };
const sgRunsPer = W => Object.keys(W.vol || {}).length < SGW.runsUnder ? SGW.runs[0] : SGW.runs[1];
const sgDmgM = (key, d = HI.doc) => SGW.dmgM[d?.b?.[key]?.sd?.n || 0] ?? 1;
function sgLootPct(avg) { const L = SGW.loot; for (let i = 1; i < L.length; i++) if (avg <= L[i][0]) return L[i - 1][1] + (L[i][1] - L[i - 1][1]) * (avg - L[i - 1][0]) / (L[i][0] - L[i - 1][0]); return L[L.length - 1][1]; }

// ---------- visiting another island (or a snapshot of ours) ----------
// The house island draws HI.doc for the house sgMyH()/hhHid() says, so a visit swaps them and puts ours back after.
function sgVisit(h, doc, why) {
  if (!SG_VIS) SG_VIS = { home: { doc: HI.doc, ut: HI.ut, h: HI.h } };
  SG_VIS.h = h; SG_VIS.why = why;
  HI.doc = doc; HI.ut = 'vis:' + h + ':' + Date.now();
  HH_C = {}; HH_W = null; HX3.sig = '';
  view = 'islands'; Object.assign(ui, { isTab: 'house', isPanel: null, isSel: null, hxP: null });
  render();
}
function sgVisitEnd(panel = 'sgwar') {
  const V = SG_VIS; if (!V?.home) return;
  if (ui.sgRun) { sgReplayStop(); ui.sgRun = null; }
  SG_VIS = null; HI.doc = V.home.doc; HI.ut = V.home.ut; HI.h = V.home.h;
  HH_C = {}; HH_W = null; HX3.sig = '';
  if (view === 'islands') { ui.isPanel = panel; render(); }
}
// run fn as if another house's island was open (synchronous, nothing is saved)
function sgAs(h, doc, fn) {
  const o = { v: SG_VIS, doc: HI.doc, ut: HI.ut };
  SG_VIS = { ...(SG_VIS || {}), h }; HI.doc = doc; HI.ut = 'as:' + h; HH_C = {}; HH_W = null;
  try { return fn(); } finally { SG_VIS = o.v; HI.doc = o.doc; HI.ut = o.ut; HH_C = {}; HH_W = null; }
}
// save to our own house document, even while visiting
async function sgHomeWrite(fn) {
  const V = SG_VIS; if (!V?.home) return hiWrite(fn);
  for (let i = 0; i < 2; i++) {
    const doc = JSON.parse(JSON.stringify(V.home.doc || {}));
    if (fn(doc) === false) return false;
    const r = await fetch('/api/account/house', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ h: V.home.h, ut: V.home.ut, doc }) });
    if (r.ok) { V.home.doc = doc; V.home.ut = (await r.json()).ut; return true; }
    if (r.status !== 409) break;
    const j = await (await fetch('/api/account/house?h=' + V.home.h, { cache: 'no-store' })).json(); V.home.doc = j.doc || {}; V.home.ut = j.ut || '';
  }
  toast('House island', 'Couldn\'t save the siege. Try again in a minute.'); return false;
}
// leaving the house island (or closing the briefing) ends a visit
document.addEventListener('click', e => { if (e.target.closest?.('[data-is="close"]') && SG_VIS?.home && !ui.sgRun) setTimeout(() => sgVisitEnd(), 0); }, true);
setInterval(() => { if (SG_VIS?.home && (view !== 'islands' || ui.isTab !== 'house')) sgVisitEnd(null); }, 500);

// what the sim needs of an island, frozen: buildings, roads, walls, terrain, guards and the house level
function sgSnap(d) {
  const b = JSON.parse(JSON.stringify(d.b || {})), g = b._sg || {};
  b._sg = { tf: g.tf || {}, gd: g.gd || {}, lk: g.lk, mb: {} };
  for (const [k, s] of Object.entries(b)) if (k[0] !== '_' && s && typeof s === 'object') { delete s.sd0; }
  return { b, c: { _: { n: '', l: hiTotal(d), e: 0 } }, __day: today() };
}

// ---------- reading every house ----------
async function sgScan(force) {
  if (SGS.busy || (!force && Date.now() - SGS.at < SGW.scan * 1000)) return;
  SGS.busy = true;
  try {
    const me = sgMyH(), out = {};
    await Promise.all(HS_HOUSES.map(async x => {
      if (x.id === me) return;
      try { const r = await fetch('/api/account/house?h=' + x.id, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); out[x.id] = { doc: j.doc || {}, ut: j.ut || '' }; } } catch { }
    }));
    SGS.docs = out;
    try { const r = await fetch('/api/sieges', { cache: 'no-store' }); if (r.ok) SGS.cfg = Object.assign({ paused: false, cancel: [] }, await r.json()); } catch { }
    SGS.at = Date.now();
  } finally { SGS.busy = false; }
}
// every war any house has declared: live ones (war) and finished ones (log)
function sgWars() {
  const out = [], cancel = new Set(SGS.cfg.cancel || []);
  for (const x of HS_HOUSES) {
    const d = sgDocOf(x.id); if (!d) continue; const g = sgDoc(d);
    if (g.war && !cancel.has(g.war.id)) out.push({ ...g.war, from: x.id, live: true });
    for (const L of g.log || []) if (L.as === 'att' && !cancel.has(L.id)) out.push({ ...L, from: x.id, tgt: L.h });
  }
  return out;
}
// no sieges in the holidays, Weeks 1 to 3 of a term (voting) or Term Boss week; and the owner's pause
function sgCalWhy(d = today()) {
  if (typeof termHoliday === 'function' && termHoliday(d)) return 'No sieges in the school holidays';
  const t = typeof termAt === 'function' && termAt(d);
  if (t) { const w = termWeek(d); if (w <= 3) return `No sieges in Weeks 1 to 3 of a term (it's Week ${w})`; if (bossWeek(mondayOf(d)) === 'term') return 'No sieges in Term Boss week'; }
  return '';
}
const sgOffWhy = () => SGS.cfg?.paused ? (SGS.cfg.note || 'Sieges are paused for now') : sgCalWhy();
// each other house: can we siege it, how strong is it, and what would it pay?
function sgTargets() {
  const me = sgMyH(), md = sgHome(), now = Date.now(), wk = mondayOf(today()), W = sgWars(), log = sgDoc(md).log || [], myP = sgPow(md);
  return HS_HOUSES.filter(x => x.id !== me).map(x => {
    const d = SGS.docs[x.id]?.doc; if (!d) return { h: x.id, x, ok: false, why: 'Couldn\'t load it', act: 0, pow: 0, M: sgMatch(1, 1), rt: SGW.rt0 };
    const why = [], act = sgAct(d).length, pow = sgPow(d), M = sgMatch(myP, pow), on = W.filter(w => w.tgt === x.id);
    const shield = Math.max(0, ...on.filter(w => !w.live).map(w => w.end + SGW.shieldD * 24 * SG_HR));
    if (act < SGW.minAct) why.push(`Too small: ${act} active member${act === 1 ? '' : 's'} (needs ${SGW.minAct})`);
    if (on.some(w => w.live)) why.push('Already at war with someone');
    else if (shield > now) why.push(`🛡️ Shielded for ${sgLeft(shield - now)}`);
    else if (on.some(w => sgWeekOf(w.decl) === wk)) why.push('Already sieged this week');
    const last = log.find(L => L.as === 'att'), lost = log.find(L => L.as === 'def' && L.h === x.id && L.win);
    const rev = !!lost && (!last || lost.at > last.at) && termOf(sgDay(lost.at)).key === termOf().key;
    if (last?.h === x.id && !rev) why.push('You sieged them last time');
    return { h: x.id, x, ok: !why.length, why: why.join(' · '), act, pow, M, rev, rt: sgRt(d) };
  });
}
function sgCallWhy() {
  const d = sgHome(), g = sgDoc(d), wk = mondayOf(today());
  const off = sgOffWhy(); if (off) return off;
  if (g.vt && !g.vt.done) return 'A siege vote is already open';
  if (g.war) return 'The house is already at war';
  if (sgWars().some(w => w.from === sgMyH() && sgWeekOf(w.decl) === wk)) return 'The house has already gone to war this week';
  if (sgAct(d).length < SGW.minAct) return `A house needs ${SGW.minAct} active members to go to war (members count once they open the house island)`;
  const p = hiPool(d); if (p.l < SGW.chest.l || p.e < SGW.chest.x) return `The war chest needs ${hxCost(SGW.chest.l, SGW.chest.x)} in the pool`;
  return '';
}
// wars against us that are declared and not over yet
const sgIncoming = () => { const me = sgMyH(), now = Date.now(); return sgWars().filter(w => w.live && w.tgt === me && now < w.end); };

// ---------- the vote ----------
function sgTally(vt, d) {
  let y = 0, n = 0; const t = {}, vol = {};
  for (const [u, v] of Object.entries(vt.v || {})) { if (v.y) y++; else n++; if (v.t) t[v.t] = (t[v.t] || 0) + 1; if (v.f) vol[u] = v.n; }
  const act = sgAct(d).length, need = Math.min(SGW.minVol, Math.max(1, Math.ceil(act * .25)));
  return { y, n, t, vol, need, pass: y > n && Object.keys(vol).length >= need };
}
const sgVoteEnd = vt => vt.at + SGW.voteH * SG_HR;

// ---------- keeping the house document up to date (called from hiTidy) ----------
function sgTidyDue(d) { const m = sgDoc(d).mb?.[HI.uid]; return !SG_VIS && !!HI.uid && (!m || m.d !== today() || m.n !== HI.user); }
function sgTidy(d) {
  const g = sgG(d), p = sgMyPow(); g.mb = g.mb || {};
  g.mb[HI.uid] = { n: HI.user, d: today(), p };
  for (const [u, m] of Object.entries(g.mb)) if (!m || m.d < addDays(today(), -60)) delete g.mb[u];
  if (g.gd?.[HI.uid]) g.gd[HI.uid] = { ...g.gd[HI.uid], at: today(), p, A: sgRoundA(sgAttacker()) };
}

// ---------- the things only the passing of time does: close votes, end wars, take hits ----------
async function sgSync(force) {
  if (SG_VIS || SGS.syncing || !HI.doc || !hsState().id || (!force && Date.now() - SGS.syncAt < 60000)) return;
  SGS.syncing = true; SGS.syncAt = Date.now();
  try {
    await sgScan(force);
    if (SG_VIS || !HI.doc) return;
    const jobs = sgJobs(HI.doc);
    if (jobs.length) { await hiWrite(d => { let any = false; for (const j of sgJobs(d)) any = j(d) !== false || any; return any ? undefined : false; }, true, true); HX3.sig = ''; }
    sgNotify();
    if (view === 'islands' && ui.isTab === 'house') render();
  } catch (e) { console.error(e); } finally { SGS.syncing = false; }
}
// what needs doing to the document d (each job changes d)
function sgJobs(d) {
  const g = sgDoc(d), now = Date.now(), jobs = [], me = sgMyH();
  if (g.vt && !g.vt.done && now >= sgVoteEnd(g.vt)) jobs.push(sgCloseVote);
  const cancel = new Set(SGS.cfg.cancel || []);
  if (g.war && cancel.has(g.war.id)) jobs.push(dd => { const G = sgG(dd); if (!G.war) return false; sgCredit(dd, G.war.chest || SGW.chest); G.log = [{ id: G.war.id, as: 'cx', h: G.war.tgt, at: now }, ...(G.log || [])].slice(0, SGW.logN); delete G.war; });
  else if (g.war) {
    const W = g.war, used = Object.values(W.vol || {}).length && Object.keys(W.vol).every(u => (W.runs?.[u] || []).length >= sgRunsPer(W));
    if ((now >= W.end || (used && now >= W.open + SGW.lateH * SG_HR)) && SGS.docs[W.tgt]) jobs.push(sgFinish);
  }
  // results of sieges against us, written by the attackers
  for (const x of HS_HOUSES) {
    if (x.id === me) continue;
    for (const L of sgDoc(SGS.docs[x.id]?.doc).log || []) if (L.as === 'att' && L.h === me && !g.got?.[L.id] && !cancel.has(L.id) && now - L.at < 30 * 24 * SG_HR) jobs.push(dd => sgApply(dd, L, x.id));
  }
  return jobs;
}
function sgCredit(d, c) { const g = sgG(d); g.cr = { l: Math.round((+g.cr?.l || 0) + (+c.l || 0)), e: Math.round((+g.cr?.e || 0) + (+(c.x ?? c.e) || 0)) }; }
function sgCloseVote(d) {
  const g = sgG(d), vt = g.vt; if (!vt || vt.done) return false;
  const T = sgTally(vt, d), off = sgOffWhy(), tg = sgTargets().filter(t => t.ok);
  const pick = Object.entries(T.t).filter(([h]) => tg.some(t => t.h === h)).sort((a, b) => b[1] - a[1] || sgPow(SGS.docs[b[0]]?.doc) - sgPow(SGS.docs[a[0]]?.doc))[0];
  if (!T.pass || off || !pick) {
    vt.done = 'fail'; vt.why = off || (!T.pass ? (T.y <= T.n ? 'More no than yes' : `Only ${Object.keys(T.vol).length} volunteer${Object.keys(T.vol).length === 1 ? '' : 's'} (needed ${T.need})`) : 'No target could be sieged');
    sgCredit(d, vt.chest || SGW.chest); return;
  }
  const t = tg.find(x => x.h === pick[0]), now = Date.now();
  vt.done = 'pass'; vt.tgt = t.h;
  g.war = { id: vt.id, tgt: t.h, decl: now, open: now + SGW.declH * SG_HR, end: now + (SGW.declH + SGW.winH) * SG_HR, vol: T.vol, runs: {}, K: t.M.K, mN: t.M.n, rev: t.rev ? 1 : 0, chest: vt.chest || SGW.chest, sn: {} };
}
function sgScore(W) {
  const all = Object.values(W.runs || {}).flat(), best = [...all].sort((a, b) => b.s - a.s || b.p - a.p).slice(0, SGW.best);
  const nv = Math.max(1, Math.min(SGW.best, Object.keys(W.vol || {}).length)), avg = best.reduce((s, r) => s + r.s, 0) / nv;
  return { all, best, avg: Math.round(avg * 100) / 100, win: avg >= SGW.win };
}
function sgFinish(d) {
  const g = sgG(d), W = g.war, td = SGS.docs[W?.tgt]?.doc; if (!W || !td) return false;
  const sc = sgScore(W), K = W.K * (W.rev ? SGW.rev : 1), loot = { l: 0, e: 0 }, dmg = [];
  if (sc.win) {
    const p = hiPool(td), vs = hhVaultSpace(td), pct = Math.min(SGW.lootMax, sgLootPct(sc.avg) * K);
    loot.l = Math.round(Math.max(0, p.l - vs) * pct); loot.e = Math.round(Math.max(0, p.e - vs) * pct);
    const n = {}; for (const r of sc.all) for (const id of r.b || []) n[id] = (n[id] || 0) + 1;
    Object.entries(n).filter(([id]) => td.b?.[id] && !['treasury', 'vault'].includes(hiBase(id))).sort((a, b) => b[1] - a[1]).slice(0, 2)
      .forEach(([id], i) => dmg.push({ id, n: hiItem(hiBase(id))?.n || id, add: sc.avg >= 2.5 && i === 0 ? 2 : 1 }));
    sgCredit(d, { l: loot.l * (1 + SGW.mint), e: loot.e * (1 + SGW.mint) });
  }
  const rtA = sc.win ? Math.round(SGW.rt.win * K) : SGW.rt.lose, rtD = sc.win ? SGW.rt.fell : SGW.rt.hold;
  g.rt = sgRt(d) + rtA;
  const L = { id: W.id, as: 'att', h: W.tgt, decl: W.decl, open: W.open, end: W.end, at: Date.now(), avg: sc.avg, win: sc.win ? 1 : 0, K: W.K, mN: W.mN, rev: W.rev, loot, dmg, rtA, rtD, vol: W.vol, runs: sc.all, sn: W.sn || {} };
  g.log = [L, ...(g.log || [])].slice(0, SGW.logN);
  g.log.forEach((x, i) => { if (i >= 3) delete x.sn; }); // replays are kept for the last 3 wars
  delete g.war;
}
// a siege against us has finished: take the hit (or the reward for holding)
function sgApply(d, L, from) {
  const g = sgG(d); if (g.got?.[L.id]) return false;
  g.got = g.got || {}; g.got[L.id] = Date.now();
  for (const [k, t] of Object.entries(g.got)) if (Date.now() - t > 40 * 24 * SG_HR) delete g.got[k];
  const lo = { l: 0, e: 0 }, dmg = [];
  if (L.win) {
    const p = hiPool(d), vs = hhVaultSpace(d);
    lo.l = Math.min(+L.loot?.l || 0, Math.max(0, p.l - vs)); lo.e = Math.min(+L.loot?.e || 0, Math.max(0, p.e - vs));
    d.sp = { l: (+d.sp?.l || 0) + lo.l, e: (+d.sp?.e || 0) + lo.e };
    for (const x of L.dmg || []) { const s = d.b?.[x.id]; if (!s || ['treasury', 'vault'].includes(hiBase(x.id))) continue; s.sd = { n: Math.min(3, (s.sd?.n || 0) + (x.add || 1)), at: today() }; dmg.push({ id: x.id, n: x.n, to: s.sd.n }); }
  } else sgCredit(d, SGW.hold);
  g.rt = sgRt(d) + (L.rtD || 0);
  const gd = [...new Set(Object.values(L.sn || {}).flatMap(s => Object.keys(s.b?._sg?.gd || {})))];
  g.log = [{ id: L.id, as: 'def', h: from, at: L.at, avg: L.avg, win: L.win, loot: lo, dmg, rtD: L.rtD, gd, runs: (L.runs || []).map(r => ({ u: r.u, n: r.n, s: r.s, p: r.p })) }, ...(g.log || [])].slice(0, SGW.logN);
}

// ---------- notices ----------
function sgNotify() {
  const c = cdState(), seen = c.sgSeen = c.sgSeen || {}, g = sgDoc(HI.doc), now = Date.now(), out = [];
  const once = (k, t, b) => { if (seen[k]) return; seen[k] = now; out.push([t, b]); };
  if (g.vt && !g.vt.done) once('vt' + g.vt.id, '🗳️ Siege vote', `${g.vt.by} called the house to war. Vote and pick a target in the ⚔️ War room on the house island.`);
  if (g.war) {
    if (now < g.war.open) once('decl' + g.war.id, '⚔️ War declared', `We march on ${sgHn(g.war.tgt)}. The siege window opens in ${sgLeft(g.war.open - now)}.`);
    else if (now < g.war.end && g.war.vol?.[HI.uid]) once('open' + g.war.id, '⚔️ The siege window is open', `March on ${sgHn(g.war.tgt)} from the War room on the house island.`);
  }
  for (const w of sgIncoming()) once('in' + w.id, `⚔️ ${sgHn(w.from)} declared war on us!`, now < w.open ? `Their siege window opens in ${sgLeft(w.open - now)}. Get the island ready and Stand guard in the War room.` : 'Their siege is on now. Stand guard in the War room.');
  for (const L of (g.log || []).slice(0, 3)) {
    if (L.as === 'att') once('res' + L.id, L.win ? '🏆 Siege won!' : '🏳️ Siege lost', L.win ? `We took ${sgHn(L.h)}: ${L.avg} stars average, ${hxCost(Math.round(L.loot.l * (1 + SGW.mint)), Math.round(L.loot.e * (1 + SGW.mint)))} in loot to the pool.` : `${sgHn(L.h)} held, with ${L.avg} stars average.`);
    if (L.as === 'def') {
      once('def' + L.id, L.win ? `🔥 ${sgHn(L.h)} took our island` : '🛡️ The island held!', L.win ? `They took ${hxCost(L.loot.l, L.loot.e)} from the pool${L.dmg.length ? ' and damaged ' + L.dmg.map(x => x.n).join(' and ') : ''}. Repair in the house island.` : `${sgHn(L.h)} only managed ${L.avg} stars average. ${hxCost(SGW.hold.l, SGW.hold.x)} defence reward to the pool.`);
      // a small thank-you to everyone who stood guard
      if (L.gd?.includes(HI.uid) && !seen['gr' + L.id]) { seen['gr' + L.id] = now; ftAddCurrency(SGW.guardRew.l, SGW.guardRew.x); out.push(['🛡️ Thanks for standing guard', `${hxCost(SGW.guardRew.l, SGW.guardRew.x)} for you.`]); }
    }
  }
  for (const k of Object.keys(seen)) if (now - seen[k] > 60 * 24 * SG_HR) delete seen[k];
  if (out.length) { save(); for (const [t, b] of out.slice(0, 3)) toast(t, b, { timeout: 12000 }); }
}
// something waiting for you in the War room?
function sgPing() {
  const g = sgDoc(HI.doc), now = Date.now();
  if (g.vt && !g.vt.done && !g.vt.v?.[HI.uid]) return true;
  if (g.war && now >= g.war.open && now < g.war.end && g.war.vol?.[HI.uid] && (g.war.runs?.[HI.uid] || []).length < sgRunsPer(g.war)) return true;
  return sgIncoming().length > 0 && !g.gd?.[HI.uid];
}
function sgBanner() {
  if (SG_VIS) return '';
  const g = sgDoc(HI.doc), now = Date.now(), inc = sgIncoming()[0]; let t = '';
  if (inc) t = now < inc.open ? `⚔️ ${sgHn(inc.from)} declared war on us · they march in ${sgLeft(inc.open - now)}` : `⚔️ ${sgHn(inc.from)} is besieging us · ${sgLeft(inc.end - now)} left`;
  else if (g.war) t = now < g.war.open ? `⚔️ War on ${sgHn(g.war.tgt)} · we march in ${sgLeft(g.war.open - now)}` : `⚔️ The siege of ${sgHn(g.war.tgt)} is on · ${sgLeft(g.war.end - now)} left`;
  else if (g.vt && !g.vt.done) t = `🗳️ Siege vote open · ${sgLeft(sgVoteEnd(g.vt) - now)} left`;
  return t ? `<div class="ishud is-tc sgban"><button class="sgbanb" data-hi="panel" data-v="sgwar">${esc(t)}</button></div>` : '';
}

// ---------- the war lock (terrain edits once a war is declared on us) ----------
const sgLockWar = () => { if (SG_VIS) return null; const now = Date.now(); return sgIncoming().find(w => now >= w.decl) || null; };
const sgWarK = () => sgLockWar() ? SGW.lock.k : 1;
function sgWarLeft(d = HI.doc) { const w = sgLockWar(); if (!w) return null; const wl = sgDoc(d).wl; return SGW.lock.n - (wl?.w === w.id ? wl.n : 0); }
function sgWarLock(d = HI.doc, pending = 0) {
  const w = sgLockWar(); if (!w) return '';
  return sgWarLeft(d) - pending <= 0 ? `War lock: all ${SGW.lock.n} terrain changes used until the siege by ${sgHn(w.from)} ends` : '';
}
function sgWarUse(d) { const w = sgLockWar(); if (!w) return; const g = sgG(d); g.wl = { w: w.id, n: (g.wl?.w === w.id ? g.wl.n : 0) + 1 }; }

// ---------- staged damage: repairs ----------
function sgRepairHtml(key, d, pool) {
  const s = d.b?.[key], n = s?.sd?.n || 0; if (!n) return '';
  const it = hiItem(hiBase(key)), f = SGW.rep[n], l = Math.round(it.l * f), x = Math.round(it.x * f), ok = pool.l >= l && pool.e >= x;
  return `<span class="tag hxbad">⚔️ ${SGW.dmgN[n]}: ${Math.round(SGW.dmgM[n] * 100)}% perk</span>${hiCanRepair() && !SG_VIS ? `<button class="btn small ${ok ? 'primary' : ''}" data-sg="rep" data-id="${key}" ${ok ? '' : 'disabled'}>🔧 Repair siege damage · ${hxCost(l, x)}</button>` : `<span class="muted small-text">Leaders repair it (${hxCost(l, x)})</span>`}`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-sg="rep"]'); if (!el || !hiCanRepair()) return;
  const key = el.dataset.id;
  const ok = await hiWrite(d => { const s = d.b?.[key], n = s?.sd?.n; if (!n) return false; const it = hiItem(hiBase(key)), l = Math.round(it.l * SGW.rep[n]), x = Math.round(it.x * SGW.rep[n]), p = hiPool(d); if (p.l < l || p.e < x) return false; delete s.sd; d.sp = { l: (+d.sp?.l || 0) + l, e: (+d.sp?.e || 0) + x }; });
  if (ok) { if (typeof sfx === 'function') sfx('coin'); toast('🔧 Repaired', `${hiItem(hiBase(key)).n} is as good as new.`); }
  HX3.sig = ''; render();
});

// ---------- guards: housemates who stood guard defend the guard posts (strongest first) ----------
function sgGuardsFor(d, S, day) {
  const gds = Object.values(sgDoc(d).gd || {}).filter(x => x && x.at >= addDays(day, -SGW.actD)).sort((a, b) => (b.p || 0) - (a.p || 0));
  S.filter(s => s.guard).sort((a, b) => b.lv - a.lv || b.hp - a.hp).forEach((s, i) => {
    const x = gds[i]; if (!x) return;
    const k = Math.max(.7, Math.min(2.5, (x.p || 30) / 30));
    s.guard.hp *= k; s.guard.max *= k; s.guard.dps *= k; s.guard.who = x.n; s.guard.cls = x.A?.cls;
  });
}

// ---------- the War room ----------
function sgWarHtml(d) {
  const g = sgDoc(d), now = Date.now(), off = sgOffWhy(), me = HI.uid, champ = hiHas('champion'), act = sgAct(d);
  if (!SGS.at) { sgSync(true); return '<p class="muted">Looking at the other houses…</p>'; }
  const T = sgTargets(), parts = [];
  if (SGS.cfg?.paused) parts.push(`<p class="sgnote">⏸️ <b>Sieges are paused.</b> ${esc(SGS.cfg.note || '')}</p>`);
  // wars on us
  for (const w of sgIncoming()) {
    const gdN = Object.keys(g.gd || {}).length, mine = !!g.gd?.[me], left = sgWarLeft(d);
    parts.push(`<div class="sgcard bad"><h4>⚔️ ${esc(sgHn(w.from))} declared war on us!</h4>
      <p>${now < w.open ? `Their siege window opens in <b>${sgLeft(w.open - now)}</b> and lasts ${SGW.winH} hours.` : `Their siege is on: <b>${sgLeft(w.end - now)}</b> left. ${Object.values(w.runs || {}).flat().length} attack${Object.values(w.runs || {}).flat().length === 1 ? '' : 's'} so far.`}
      Get ready: repair, build towers, traps and guard posts, and stand guard.</p>
      <p class="small-text">🛡️ ${gdN} standing guard${gdN ? ': ' + Object.values(g.gd).map(x => esc(x.n)).join(', ') : ''}. The strongest guard the guard posts. · 🔒 War lock: ${left} of ${SGW.lock.n} terrain changes left, at ${SGW.lock.k}× the price.</p>
      <button class="btn small ${mine ? '' : 'primary'}" data-sg="guard">${mine ? '✔ Standing guard (stop)' : '🛡️ Stand guard'}</button></div>`);
  }
  // our siege
  if (g.war) parts.push(sgWarCard(g.war, d));
  else if (g.vt && !g.vt.done) parts.push(sgVoteCard(g.vt, d, T));
  else {
    const why = sgCallWhy();
    const last = g.vt?.done === 'fail' && now - sgVoteEnd(g.vt) < 3 * 24 * SG_HR ? `<p class="small-text">🗳️ The last siege vote failed: ${esc(g.vt.why || '')}. The war chest went back to the pool.</p>` : '';
    parts.push(`<div class="sgcard"><h4>🗳️ Go to war</h4><p class="small-text">The Champion calls a siege vote and pays a war chest of ${hxCost(SGW.chest.l, SGW.chest.x)} from the pool (back if the vote fails). Members have ${SGW.voteH} hours to vote, pick a target and say if they'll fight. If it passes, war is declared and the siege window opens ${SGW.declH} hours later.</p>${last}
      ${champ ? `<button class="btn ${why ? '' : 'primary'}" data-sg="call" ${why ? 'disabled' : ''}>⚔️ Call a siege vote · ${hxCost(SGW.chest.l, SGW.chest.x)}</button>${why ? ` <span class="muted small-text">${esc(why)}</span>` : ''}` : `<span class="muted small-text">Only the Champion can call a siege vote.${why ? ' ' + esc(why) + '.' : ''}</span>`}</div>`);
  }
  // the other houses
  const myP = sgPow(d);
  parts.push(`<div class="ftlbl">🏰 The houses · ours: rating ${sgRt(d)}, power ${myP}, ${act.length} active</div><table class="sgtab"><tr><th>House</th><th>Rating</th><th>Active</th><th>Power</th><th></th></tr>${T.map(t => `<tr><td>${esc(sgHn(t.h))}</td><td>${t.rt}</td><td>${t.act}</td><td>${t.pow}${t.act ? ` <span class="tag">${t.M.n}</span>` : ''}</td><td class="small-text ${t.ok ? '' : 'muted'}">${t.ok ? (t.rev ? '🔥 Revenge: +20%' : 'Can be sieged') : esc(t.why)}</td></tr>`).join('')}</table>`);
  // history
  const log = (g.log || []).filter(L => L.as !== 'cx');
  if (log.length) parts.push(`<div class="ftlbl">📜 War log</div>${log.map(L => sgLogHtml(L)).join('')}`);
  parts.push(`<p class="muted small-text">Power is the average strength of members active in the last ${SGW.actD} days. Even matches pay best; much weaker houses pay ×${SGW.match[0][1]}. A siege is won at ${SGW.win}+ stars averaged over the best ${SGW.best} runs. After a siege the target gets a ${SGW.shieldD}-day shield. No sieges in the holidays, Weeks 1 to 3, or Term Boss week. Personal islands, balances and gear are never at risk.</p>`);
  return parts.join('');
}
function sgVoteCard(vt, d, T) {
  const now = Date.now(), my = vt.v?.[HI.uid] || {}, R = sgTally(vt, d), active = sgAct(d).some(([u]) => u === HI.uid);
  const tg = T.map(t => `<button class="btn small ${my.t === t.h ? 'primary' : ''}" data-sg="vote" data-k="t" data-v="${t.h}" ${t.ok ? '' : 'disabled'} title="${esc(t.ok ? `${t.M.n}: rewards ×${t.M.K}${t.rev ? ', revenge +20%' : ''}` : t.why)}">${esc(sgHn(t.h))} · ${t.M.n}${R.t[t.h] ? ` · ${R.t[t.h]} vote${R.t[t.h] === 1 ? '' : 's'}` : ''}</button>`).join('');
  return `<div class="sgcard"><h4>🗳️ Siege vote · ${sgLeft(sgVoteEnd(vt) - now)} left</h4><p class="small-text">${esc(vt.by)} called the house to war. Passes with more yes than no and at least ${R.need} volunteer${R.need === 1 ? '' : 's'}. Most target votes picks the target (a tie goes to the stronger house).</p>
    <p><b>👍 ${R.y}</b> yes · <b>👎 ${R.n}</b> no · <b>⚔️ ${Object.keys(R.vol).length}</b> will fight${Object.keys(R.vol).length ? ': ' + Object.values(R.vol).map(esc).join(', ') : ''}</p>
    ${active ? `<div class="row wrap" style="gap:6px"><button class="btn small ${my.y === 1 ? 'primary' : ''}" data-sg="vote" data-k="y" data-v="1">👍 Yes</button><button class="btn small ${my.y === 0 ? 'primary' : ''}" data-sg="vote" data-k="y" data-v="0">👎 No</button><button class="btn small ${my.f ? 'primary' : ''}" data-sg="vote" data-k="f" data-v="${my.f ? 0 : 1}">${my.f ? '✔ I\'ll fight' : '⚔️ I\'ll fight'}</button></div>
    <div class="ftlbl">Target</div><div class="row wrap" style="gap:6px">${tg}</div>` : '<p class="muted small-text">Open the house island regularly to vote (members active in the last 14 days).</p>'}</div>`;
}
function sgWarCard(W, d) {
  const now = Date.now(), me = HI.uid, mine = W.runs?.[me] || [], per = sgRunsPer(W), vol = !!W.vol?.[me], sc = sgScore(W), lateOk = now < W.open + SGW.lateH * SG_HR;
  const open = now >= W.open && now < W.end, off = sgOffWhy();
  let act = '';
  if (open && vol && mine.length < per) act = SGS.cfg?.paused ? '<span class="muted small-text">Paused</span>' : `<button class="btn primary" data-sg="march">⚔️ March on ${esc(sgHn(W.tgt))} (${per - mine.length} run${per - mine.length === 1 ? '' : 's'} left)</button>`;
  else if (vol && mine.length >= per) act = '<span class="small-text">✔ You\'ve used your runs.</span>';
  if (!vol && lateOk && sgAct(d).some(([u]) => u === me)) act += ` <button class="btn small" data-sg="join">⚔️ I'll fight too</button>`;
  const runs = Object.entries(W.runs || {}).flatMap(([u, rs]) => rs.map((r, i) => ({ ...r, i, u }))).sort((a, b) => b.at - a.at);
  return `<div class="sgcard"><h4>⚔️ War on ${esc(sgHn(W.tgt))} <span class="tag">${esc(W.mN || '')}${W.rev ? ' · 🔥 revenge' : ''}</span></h4>
    <p>${now < W.open ? `The siege window opens in <b>${sgLeft(W.open - now)}</b>. Get ready: gear, spells and moves all count. ${SGW.lateH}h of late joining after it opens.` : open ? `The siege is on: <b>${sgLeft(W.end - now)}</b> left. Each volunteer gets ${per} run${per === 1 ? '' : 's'}.` : 'The siege is over. The result is being counted.'}</p>
    <p class="small-text">⚔️ Volunteers: ${Object.values(W.vol || {}).map(esc).join(', ') || 'none'} · Score so far: <b>${sc.avg}</b> stars average (${SGW.win} wins)</p>
    ${runs.length ? `<div class="sgruns">${runs.map(r => `<div>${esc(r.n)}: ${'★'.repeat(r.s)}${'☆'.repeat(3 - r.s)} ${r.p}% <button class="btn tiny ghost" data-sg="watch" data-w="${W.id}" data-u="${r.u}" data-i="${r.i}">▶ Watch</button></div>`).join('')}</div>` : ''}
    <div class="row wrap" style="gap:8px">${act}</div>${off && !SGS.cfg?.paused ? '' : ''}</div>`;
}
function sgLogHtml(L) {
  const att = L.as === 'att', when = fmtDate(sgDay(L.at)), won = att ? L.win : !L.win;
  const runs = (L.runs || []).map((r, i) => `<div>${esc(r.n)}: ${'★'.repeat(r.s)}${'☆'.repeat(3 - r.s)} ${r.p}% ${(att ? L.sn : 1) ? `<button class="btn tiny ghost" data-sg="watch" data-w="${L.id}" data-i="${i}">▶ Watch</button>` : ''}</div>`).join('');
  const what = att ? (L.win ? `Won: ${hxCost(Math.round(L.loot.l * (1 + SGW.mint)), Math.round(L.loot.e * (1 + SGW.mint)))} loot` : 'They held') : (L.win ? `Lost ${hxCost(L.loot.l, L.loot.e)}${L.dmg?.length ? ', ' + L.dmg.map(x => `${x.n} (${SGW.dmgN[x.to] || 'damaged'})`).join(', ') : ''}` : `Held! ${hxCost(SGW.hold.l, SGW.hold.x)} reward`);
  return `<details class="sglog ${won ? 'good' : 'bad'}"><summary>${won ? '🏆' : '🏳️'} ${when} · ${att ? 'We besieged' : 'Besieged by'} ${esc(sgHn(L.h))} · ${L.avg}★ · ${what}</summary><div class="sgruns">${runs || '<span class="muted small-text">No attacks were made.</span>'}</div></details>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-sg="call"],[data-sg="vote"],[data-sg="join"],[data-sg="guard"],[data-sg="march"],[data-sg="attack"],[data-sg="watch"],[data-sg="home"]'); if (!el) return;
  const a = el.dataset.sg;
  if (a === 'home') { sgVisitEnd(); return; }
  if (a === 'watch') { sgWatch(el.dataset.w, el.dataset.u, +el.dataset.i); return; }
  if (a === 'attack') { sgAttack(); return; }
  if (SG_VIS) return;
  if (a === 'call') {
    if (!hiHas('champion')) return;
    await sgScan(true); const why = sgCallWhy(); if (why) { toast('Siege vote', why); render(); return; }
    if (!confirm(`Call the house to war? ${hxCost(SGW.chest.l, SGW.chest.x)} goes from the pool into the war chest (back if the vote fails). Everyone gets ${SGW.voteH} hours to vote.`)) return;
    const ok = await hiWrite(d => { const g = sgG(d), p = hiPool(d); if ((g.vt && !g.vt.done) || g.war || p.l < SGW.chest.l || p.e < SGW.chest.x) return false; g.vt = { id: sgMyH() + '-' + Date.now().toString(36), by: HI.user, at: Date.now(), chest: { ...SGW.chest }, v: {} }; d.sp = { l: (+d.sp?.l || 0) + SGW.chest.l, e: (+d.sp?.e || 0) + SGW.chest.x }; });
    if (ok) { if (typeof sfx === 'function') sfx('start'); toast('🗳️ Siege vote called', 'Your house has 24 hours to vote.'); }
  } else if (a === 'vote') {
    const k = el.dataset.k, v = el.dataset.v;
    await hiWrite(d => { const vt = sgDoc(d).vt; if (!vt || vt.done || Date.now() >= sgVoteEnd(vt)) return false; vt.v = vt.v || {}; const m = vt.v[HI.uid] = { n: HI.user, y: 1, ...(vt.v[HI.uid] || {}) }; m[k] = k === 't' ? v : +v; if (k === 't') m.y = m.y ?? 1; });
  } else if (a === 'join') {
    await hiWrite(d => { const W = sgDoc(d).war; if (!W || Date.now() >= W.open + SGW.lateH * SG_HR || W.vol?.[HI.uid]) return false; W.vol = { ...(W.vol || {}), [HI.uid]: HI.user }; });
  } else if (a === 'guard') {
    await hiWrite(d => { const g = sgG(d); g.gd = g.gd || {}; if (g.gd[HI.uid]) delete g.gd[HI.uid]; else g.gd[HI.uid] = { n: HI.user, at: today(), p: sgMyPow(), A: sgRoundA(sgAttacker()) }; });
  } else if (a === 'march') { sgMarch(); return; }
  render();
});

// ---------- marching: the briefing on the enemy island, the run, the replay ----------
async function sgMarch() {
  const W = sgDoc(HI.doc).war; if (!W || SGS.cfg?.paused) return;
  const r = await fetch('/api/account/house?h=' + W.tgt, { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast('Siege', 'Couldn\'t reach their island. Try again.'); return; }
  sgVisit(W.tgt, j.doc || {}, 'march'); ui.isPanel = 'sgmarch'; render(); setTimeout(sgSideMark, 60);
}
function sgMarchHtml() {
  const W = sgDoc(SG_VIS.home.doc).war, B = sgBrief(), st = hhSaved(), cls = cdClassInfo(), sk = SG_SKILL[cdClass()] || SG_SKILL[''];
  if (!W) return '<p>The war is over.</p><button class="btn" data-sg="home">🏠 Back to our island</button>';
  const left = sgRunsPer(W) - (W.runs?.[HI.uid] || []).length;
  const btns = (list, key, cur) => list.map(([id, e, n, t]) => `<button class="btn small ${cur === id ? 'primary' : ''}" data-sg="b" data-k="${key}" data-v="${id}" ${t ? `title="${esc(t)}"` : ''}>${e} ${n}</button>`).join('');
  const nT = Object.values(st.b).filter(s => hxW(st).item(s.id)?.slot === 'tower').length, nG = Object.values(st.b).filter(s => hxW(st).item(s.id)?.slot === 'guard').length;
  return `<p class="small-text">This is ${esc(sgHn(W.tgt))}'s island as it is right now. Look around: ${nT} tower${nT === 1 ? '' : 's'}, ${nG} guard post${nG === 1 ? '' : 's'}, ${(HI.doc.b?._wl || []).length} wall hexes. Traps are hidden. You have <b>${left}</b> run${left === 1 ? '' : 's'} left.</p>
    <div class="ftlbl">Land on the</div><div class="row wrap" style="gap:6px">${SG_SIDES.map((n, i) => `<button class="btn small ${B.side === i ? 'primary' : ''}" data-sg="b" data-k="side" data-v="${i}">${n}</button>`).join('')}</div>
    <div class="ftlbl">Go for</div><div class="row wrap" style="gap:6px">${btns(SG_PRIO, 'prio', B.prio)}</div>
    <div class="ftlbl">Use ${esc(sk[0])} ${cls ? `(${cls.n})` : ''}</div><div class="row wrap" style="gap:6px">${btns(SG_WHEN, 'when', B.when)}</div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn primary" data-sg="attack" ${left > 0 ? '' : 'disabled'}>⚔️ Attack!</button><button class="btn ghost" data-sg="home">🏠 Back</button><span class="muted small-text">The run counts as soon as it starts.</span></div>`;
}
let SG_ATTACKING = false;
async function sgAttack() {
  const V = SG_VIS; if (!V?.home || V.why !== 'march' || SG_ATTACKING) return;
  const W = sgDoc(V.home.doc).war; if (!W || Date.now() < W.open || Date.now() >= W.end) { toast('Siege', 'The siege window isn\'t open.'); return; }
  const me = HI.uid, i = (W.runs?.[me] || []).length; if (i >= sgRunsPer(W) || !W.vol?.[me]) return;
  SG_ATTACKING = true;
  try {
    const B = sgBrief(), ch = { side: B.side, prio: B.prio, when: B.when }, A = sgRoundA(sgAttacker()), seed = `${W.id}|${me}|${i}`;
    const snap = sgSnap(HI.doc), sig = sgHash(JSON.stringify(snap)), res = sgRun(snap, ch, A, seed);
    const run = { u: me, n: HI.user, s: res.stars, p: res.pct, sd: seed, ch, A, sn: sig, b: res.S.filter(s => s.left <= 0 && ['bld', 'tower', 'guard'].includes(s.kind)).map(s => s.id), at: Date.now() };
    const ok = await sgHomeWrite(h => {
      const G = sgG(h), WW = G.war; if (!WW || WW.id !== W.id || !WW.vol?.[me]) return false;
      const mine = WW.runs[me] = WW.runs?.[me] || []; WW.runs = { ...WW.runs, [me]: mine };
      if (mine.length >= sgRunsPer(WW) || Date.now() >= WW.end) return false;
      mine.push(run); WW.sn = WW.sn || {}; if (!WW.sn[sig] && Object.keys(WW.sn).length < SGW.snaps) WW.sn[sig] = snap;
    });
    if (!ok) return;
    const K = W.K * (W.rev ? SGW.rev : 1), rl = Math.round(SGW.rew[res.stars] * K), gear = res.stars >= 2 && typeof ftRollGear === 'function' ? ftRollGear() : null;
    ftAddCurrency(rl, rl); save();
    ui.isPanel = null; ui.isSel = null;
    ui.sgRun = { res, A, B: { ...B }, rt: 0, speed: 2, follow: true, done: false, real: { l: rl, gear: gear ? `${gear.e} ${gear.n}` : '' } };
    render(); sgReplayStart();
  } finally { SG_ATTACKING = false; }
}
// watch any run again: ours from the War room or the log, or theirs against us
async function sgWatch(id, u, i) {
  const home = sgHome(), g = sgDoc(home), me = sgMyH();
  let src = null, h = null, run = null;
  if (g.war?.id === id) { src = g.war; h = g.war.tgt; run = (g.war.runs?.[u] || [])[i]; }
  else {
    const L = (g.log || []).find(x => x.id === id); if (!L) return;
    if (L.as === 'att') { src = L; h = L.h; run = L.runs?.[i]; }
    else {
      await sgScan(true); const A = (sgDoc(SGS.docs[L.h]?.doc).log || []).find(x => x.id === id);
      src = A; h = me; run = A?.runs?.find(r => r.u === L.runs?.[i]?.u && r.s === L.runs[i].s && r.p === L.runs[i].p) || A?.runs?.[i];
    }
  }
  const snap = run && src?.sn?.[run.sn];
  if (!snap) { toast('Replay', 'That replay isn\'t kept any more (replays are kept for the last 3 wars).'); return; }
  sgVisit(h, JSON.parse(JSON.stringify(snap)), 'watch');
  const res = sgRun(HI.doc, run.ch, run.A, run.sd);
  ui.sgRun = { res, A: { ...run.A, n: run.n }, B: { side: run.ch.side, prio: run.ch.prio, when: run.ch.when }, rt: 0, speed: 2, follow: true, done: false, watch: true };
  render(); sgReplayStart();
}
// the house island while visiting
function sgVisitView() {
  const V = SG_VIS, h = hsHouse(V.h), own = V.h === V.home.h;
  const hud = `<div class="ishud is-tl"><div class="islvl house" style="--hc:${h?.col || '#888'}"><b>⚔️</b><div><span>${esc(sgHn(V.h))} island · ${V.why === 'watch' ? 'replay' : 'siege'}</span></div></div></div>`;
  if (ui.sgRun) return isFrame('house', hud, sgRunHtml());
  if (V.why === 'march') return isFrame('house', hud, isPanel(`⚔️ March on ${esc(sgHn(V.h))}`, sgMarchHtml()));
  return isFrame('house', hud + `<div class="ishud is-bc sgctl"><button class="btn primary" data-sg="home">🏠 Back to ${own ? 'the War room' : 'our island'}</button></div>`);
}
const sgRunBtns = R => R.real ? `<p class="small-text">🎁 Your reward: ${hxCost(R.real.l, R.real.l)}${R.real.gear ? ` and ${esc(R.real.gear)}` : ''}. Your stars count towards the house's best ${SGW.best}.</p><div class="row" style="gap:8px"><button class="btn primary" data-sg="home">🏠 Back to the War room</button></div>`
  : '<div class="row" style="gap:8px"><button class="btn primary" data-sg="home">🏠 Back</button></div>';

// ---------- the walkthrough ----------
if (typeof GUIDES === 'object') GUIDES.sieges = {
  name: 'Sieges',
  end: () => { ui.isPanel = null; if (view === 'islands') render(); },
  steps: [
    { title: 'Sieges are here ⚔️', text: 'Houses can now go to war. The Champion calls a siege vote, everyone votes and picks a target, and volunteers march on the enemy island.', go: sgGuideHome, wait: 600 },
    { title: 'The War room', go: sgGuideHome, text: 'Press ⚔️ <b>War</b> to vote, see the other houses\' strength, march when the siege window opens, and stand guard when another house attacks.', sel: '#isfull [data-v="sgwar"]' },
    { title: 'Win and lose', go: sgGuideHome, text: 'A win takes loot from the other house\'s pool and damages up to 2 of its buildings. Losing costs the same. The Vault keeps some safe, and personal islands, balances and gear are never at risk.', sel: '#isfull [data-v="sgwar"]' },
  ],
};
// check for wars now and then, even when the house island isn't open
setInterval(() => { try { if (typeof acct === 'object' && acct.signedIn && hsState().id && !SG_VIS && HI.doc) sgSync(); } catch { } }, 10 * 60000);
