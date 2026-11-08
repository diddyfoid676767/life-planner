'use strict';
/* House island (2.50, islands stage 4). One shared island per house, kept in
   one Firestore document (houses/<id>, via /api/account/house). The house pool
   (House Lumen and House Ember) is everyone's contributions minus what the
   house has spent: a fixed 10% of what each member earns goes in automatically,
   and anyone can donate extra. Leaders (2 a term, voted in during the term's
   first 2 weeks) start projects and repairs. Projects take a week, a month or
   a term; month and term projects need a house-wide vote first. Chains give no
   perk until every part is built, unless a part works alone. House perks only
   apply in weekly house boss fights. Buildings wear and break like the
   personal island (slower), are never destroyed, and are repaired from the pool. */

const HI_SHARE = .1, HI_LEADERS = 2, HI_ELIG = 200, HI_VOTE_DAYS = 14, HI_PROP_DAYS = 3, HI_MAX_BUILDING = 2;
const HI_WEAR = 28, HI_BREAK = 56, HI_LEN = { week: 7, month: 28, term: 56 };
// at = extra house fights a week; other keys are FT_BUFF battle buffs (house fights only)
const HI_ITEMS = [
  { id: 'banner', u: 1, sz: 3, n: 'Banner Hall', e: '🚩', m: 'hut', col: '#ffd43b', l: 300, x: 100, t: 'week', b: { sp: .03, mv: .03 } },
  { id: 'yard', u: 1, sz: 3, n: 'Training Yard', e: '🥋', m: 'wall', col: '#c9a26b', l: 100, x: 300, t: 'week', b: { hp: 20 } },
  { id: 'tent', u: 2, sz: 3, n: 'Healer\'s Tent', e: '⛺', m: 'spring', col: '#63e6be', l: 200, x: 200, t: 'week', b: { rg: 1 } },
  { id: 'signal', u: 2, sz: 3, n: 'Signal Fire', e: '🔥', m: 'fire', col: '#ff922b', l: 150, x: 150, t: 'week', b: { cr: .02 } },
  { id: 'library', u: 3, sz: 3, n: 'Great Library', e: '📚', m: 'dome', col: '#748ffc', l: 1200, x: 400, t: 'month', b: { sp: .06, wk: .05 } },
  { id: 'warforge', u: 4, sz: 3, n: 'War Forge', e: '⚒️', m: 'forge', col: '#868e96', l: 400, x: 1200, t: 'month', b: { mv: .06 } },
  { id: 'bastion', u: 4, sz: 3, n: 'Bastion', e: '🏯', m: 'tower', col: '#a0785a', l: 800, x: 800, t: 'month', b: { dr: .05, at: 1 } },
  { id: 'pier', u: 3, sz: 3, n: 'Pier', e: '⚓', m: 'wall', col: '#8d6e4c', l: 400, x: 400, t: 'week', ch: 'harbour', alone: { dg: .01 } },
  { id: 'beacon', u: 5, sz: 3, n: 'Harbour Beacon', e: '🗼', m: 'light', col: '#f8f9fa', l: 1000, x: 1000, t: 'month', ch: 'harbour', req: 'pier' },
  { id: 'steps', u: 5, sz: 3, n: 'Temple Steps', e: '🪜', m: 'wall', col: '#e9ecef', l: 700, x: 700, t: 'month', ch: 'temple' },
  { id: 'pillars', u: 6, sz: 3, n: 'Temple Pillars', e: '⛩️', m: 'shrine', col: '#f08c00', l: 900, x: 900, t: 'month', ch: 'temple', req: 'steps' },
  { id: 'sundome', u: 7, sz: 4, n: 'Sun Dome', e: '☀️', m: 'dome', col: '#ffa94d', l: 1500, x: 1500, t: 'term', ch: 'temple', req: 'pillars' },
];
const HI_CHAINS = { harbour: { n: 'Harbour', b: { wk: .08, cr: .03 } }, temple: { n: 'Sun Temple', b: { hp: 40, sp: .08, mv: .08, at: 1 } } };
const hiItem = id => HI_ITEMS.find(x => x.id === id);
const hiBig = it => it.t !== 'week';
const hiBuffText = b => Object.entries(b).map(([k, v]) => k === 'at' ? `+${v} house fight a week` : `${FT_BUFF[k][1]} ${FT_BUFF[k][2](v)}`).join(' · ');
const hiCost = (it, f = 1) => [it.l && `${LUMEN} ${Math.round(it.l * f)}`, it.x && `${EMBER} ${Math.round(it.x * f)}`].filter(Boolean).join(' + ');

// local bits: when you joined the island (your 10% starts then), what you donated, last known perks
const hiLocal = () => { const c = cdState(); return (c.hi = Object.assign({ from: '', don: { l: 0, e: 0 }, perks: {} }, c.hi || {})); };
function hiFrom() { if (!hsState().id) return ''; const h = hiLocal(); if (!h.from) h.from = today(); return h.from; }
function hiMine() { const w = cdWallet(), d = hiLocal().don; return { l: w.hl + (d.l || 0), e: w.he + (d.e || 0) }; }

// ---------- the shared document ----------
let HI = { doc: null, ut: '', uid: '', user: '', at: 0, busy: false, err: '' };
async function hiLoad(force) {
  const h = hsState().id;
  if (!h || HI.busy || (!force && HI.h === h && Date.now() - HI.at < 60000)) return;
  HI.busy = true;
  try {
    if (!acctLoaded) await loadAccount();
    if (!acct.configured || !acct.signedIn) throw new Error('signin');
    const r = await fetch('/api/account/house?h=' + h, { cache: 'no-store' }), j = await r.json();
    if (!r.ok) throw new Error(j.error || 'failed');
    Object.assign(HI, { doc: j.doc || {}, ut: j.ut || '', uid: j.uid, user: j.user, h, err: '' });
    HI.at = Date.now(); HI.busy = false;
    await hiTidy();
  } catch (e) { HI.err = e.message; HI.at = Date.now(); }
  HI.busy = false;
  hiLocal().perks = hiPerks(); save();
  if (view === 'islands' && ui.isTab === 'house') render();
}
// change the document and save it; if someone else saved first, reload and try once more
async function hiWrite(fn, again = true, quiet = false) {
  const doc = JSON.parse(JSON.stringify(HI.doc || {}));
  if (fn(doc) === false) return false;
  const r = await fetch('/api/account/house', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ h: HI.h, ut: HI.ut, doc }) });
  if (r.status === 409 && again) { HI.at = 0; await hiLoad(true); return hiWrite(fn, false, quiet); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); if (!quiet) toast('House island', j.error === 'changed' ? 'Someone else just changed the island. Try again.' : 'Couldn\'t save: ' + (j.error || r.status) + '. Your profile may need to publish first, try again in a minute.'); return false; }
  HI.doc = doc; HI.ut = (await r.json()).ut; hiLocal().perks = hiPerks(); save(); return true;
}
// keeps your contribution up to date, and locks in this term's leaders when voting closes
async function hiTidy() {
  const d = HI.doc, mine = hiMine(), c = d.c?.[HI.uid];
  const needC = !c || mine.l > (c.l || 0) || mine.e > (c.e || 0) || c.n !== HI.user;
  const t = hiTerm(), lock = today() >= addDays(t.start, HI_VOTE_DAYS) && d.ld?.t !== t.id;
  if (!needC && !lock) return;
  await hiWrite(doc => {
    if (needC) { const o = doc.c?.[HI.uid] || {}; doc.c = doc.c || {}; doc.c[HI.uid] = { n: HI.user, l: Math.max(mine.l, o.l || 0), e: Math.max(mine.e, o.e || 0) }; }
    if (lock) doc.ld = { t: t.id, u: hiTally(doc, t.id) };
  }, true, true);
}

// ---------- pool, terms, leaders and votes ----------
function hiPool(d = HI.doc || {}) {
  let l = 0, e = 0; for (const x of Object.values(d.c || {})) { l += +x.l || 0; e += +x.e || 0; }
  return { l: Math.max(0, Math.round(l - (+d.sp?.l || 0))), e: Math.max(0, Math.round(e - (+d.sp?.e || 0))), n: Object.keys(d.c || {}).length };
}
function hiTerm(d = today()) {
  const id = cdTerm(d), y = +id.slice(0, 4), q = +id.slice(-1);
  const start = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`, prev = q > 1 ? `${y}-T${q - 1}` : `${y - 1}-T4`;
  return { id, start, prev, voteEnd: addDays(start, HI_VOTE_DAYS) };
}
// who can be a leader: anyone who has put HI_ELIG or more into the pool
const hiEligible = d => Object.values(d.c || {}).filter(x => (+x.l || 0) + (+x.e || 0) >= HI_ELIG).map(x => x.n);
const hiTop = d => Object.values(d.c || {}).sort((a, b) => (b.l + b.e) - (a.l + a.e)).slice(0, HI_LEADERS).map(x => x.n);
function hiTally(d, term) {
  const n = {}, el = new Set(hiEligible(d));
  for (const v of Object.values(d.v || {})) if (v.t === term && el.has(v.ld)) n[v.ld] = (n[v.ld] || 0) + 1;
  const won = Object.entries(n).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, HI_LEADERS).map(x => x[0]);
  for (const n of hiTop(d)) if (won.length < HI_LEADERS && !won.includes(n)) won.push(n); // empty seats go to the top contributors
  return won;
}
// this term's leaders; during voting, last term's leaders (or the top contributors) stay on
function hiLeaders(d = HI.doc || {}) {
  const t = hiTerm();
  if (d.ld?.t === t.id) return { u: d.ld.u || [], how: 'voted' };
  if (today() >= t.voteEnd) return { u: hiTally(d, t.id), how: 'voted' };
  if (d.ld?.t === t.prev) return { u: d.ld.u || [], how: 'last' };
  return { u: hiTop(d), how: 'top' };
}
const hiAmLeader = () => hiLeaders().u.includes(HI.user);
// the house-wide vote on a big project: open HI_PROP_DAYS, passes with more yes than no
function hiProp(d = HI.doc || {}) {
  const p = d.pr; if (!p || !hiItem(p.b)) return null;
  const k = p.b + '@' + p.at; let y = 0, n = 0;
  for (const v of Object.values(d.v || {})) if (v.p?.k === k) v.p.y > 0 ? y++ : n++;
  const open = today() < addDays(p.at, HI_PROP_DAYS), passed = !open && y > n && y >= Math.min(2, hiPool(d).n);
  return { ...p, k, y, n, open, passed, stale: !open && today() > addDays(p.at, HI_PROP_DAYS + 14) };
}

// ---------- buildings: condition and perks ----------
function hiCond(id, d = today(), doc = HI.doc || {}) {
  const s = doc.b?.[id]; if (!s || d < s.s) return null;
  if (d < s.r) return 'build';
  const reps = new Set(hiRepsOn(s, d)), hits = new Set(s.hit || []), paused = isPaused(); let act = 0;
  for (let x = s.r; x < d; x = addDays(x, 1)) { if (reps.has(x)) act = 0; if (hits.has(x)) act = hiSmash(act); if (!paused(x)) act++; }
  if (reps.has(d)) act = 0; else if (hits.has(d)) act = hiSmash(act); // 2.53: a boss raid knocks it down one stage
  return act >= HI_BREAK ? 'broken' : act >= HI_WEAR ? 'worn' : 'ok';
}
function hiActDays(id) { const s = HI.doc?.b?.[id]; if (!s) return 0; const reps = new Set(hiRepsOn(s)), p = isPaused(); let a = 0; for (let x = s.r; x <= today(); x = addDays(x, 1)) { if (reps.has(x)) a = 0; if (!p(x)) a++; } return a; }
function hiPerks() {
  if (!HI.doc) return hiLocal().perks || {};
  const g = {}, add = (b, m) => { for (const [k, v] of Object.entries(b)) g[k] = (g[k] || 0) + (k === 'hp' || k === 'rg' || k === 'at' ? Math.round(v * m) : v * m); };
  for (const it of HI_ITEMS) { const m = isMult(hiCond(it.id)) * IS_LVM[Math.max(0, hiLvOn(HI.doc.b?.[it.id]) - 1)]; if (!m) continue; if (it.b) add(it.b, m); if (it.alone) add(it.alone, m); }
  for (const [cid, ch] of Object.entries(HI_CHAINS)) { const ms = HI_ITEMS.filter(x => x.ch === cid).map(x => isMult(hiCond(x.id))); if (ms.every(m => m)) add(ch.b, Math.min(...ms)); }
  return g;
}
// your gear buffs plus the house island's, for house boss fights
function hiFightBuffs(g) { const o = { ...g }; for (const [k, v] of Object.entries(hiPerks())) if (FT_BUFF[k]) o[k] = (o[k] || 0) + v; return o; }

// ---------- levels, upgrades and the grid (2.51) ----------
const HI_N = 22, HI_MAXLV = 3, HI_UPD = [1, .5, .75]; // upgrade time as a share of the project length
// house level: rises with everything the house has ever put in the pool
const HI_LVT = [0, 800, 2000, 4000, 7000, 11000, 16000, 22000, 30000, 40000, 52000, 66000];
const hiTotal = (d = HI.doc || {}) => Object.values(d.c || {}).reduce((a, x) => a + (+x.l || 0) + (+x.e || 0), 0);
const hiLevel = (d = HI.doc || {}) => { const t = hiTotal(d); return HI_LVT.filter(x => t >= x).length; };
const hiNeedLv = (it, lv) => it.u + (lv - 1) * 2;
const hiLvOn = (s, d = today()) => s ? (s.up && d >= s.up.r ? s.up.lv : s.lv || 1) : 0;
const hiSmash = act => act >= HI_WEAR ? Math.max(act, HI_BREAK) : HI_WEAR;
const hiRepsOn = (s, d = today()) => [...(s.reps || []), ...(s.up && d >= s.up.r ? [s.up.r] : [])];
const hiBusy = (d, now = today()) => HI_ITEMS.filter(x => { const s = d.b?.[x.id]; return s && (now < s.r || (s.up && now < s.up.r)); }).length;
const hiUpDays = (it, lv) => Math.ceil(HI_LEN[it.t] * HI_UPD[lv - 1]);
function hiLayout() {
  const d = HI.doc || {}, L = { N: HI_N, centre: [9, 9, 4], items: [] };
  for (const it of HI_ITEMS) { const s = d.b?.[it.id]; if (s) L.items.push({ id: it.id, sz: it.sz, at: s.at }); }
  for (const o of L.items) if (!o.at || !isFits(L, o.id, o.sz, ...o.at)) { o.at = null; o.at = isSpot(L, o.id, o.sz) || [0, 0]; }
  return L;
}
const hiBuffTextM = (b, m) => Object.entries(b).map(([k, v]) => k === 'at' ? `+${v} house fight a week` : `${FT_BUFF[k][1]} ${FT_BUFF[k][2](k === 'hp' || k === 'rg' ? Math.round(v * m) : v * m)}`).join(' · ');
const hiPerkM = (it, m = 1) => it.b ? hiBuffTextM(it.b, m) : it.alone ? `Works alone: ${hiBuffTextM(it.alone, m)}` : `Part of ${HI_CHAINS[it.ch].n}`;

// ---------- page ----------
function viewHouseIsland() {
  const hs = hsState(), msg = (t, b) => isFrame('house', '', `<div class="ispanel iscentre"><div class="ispanel-h"><h3>${t}</h3></div><div class="ispanel-b">${b}</div></div>`);
  if (!hs.id) return msg('🏰 House island', `<p class="muted">Join your house first, then build the house island together.</p><button class="btn primary" data-act="goto" data-v="house">Pick your house</button>`);
  hiLoad();
  const h = hsHouse(hs.id);
  if (!HI.doc) return msg(`${h.e} ${h.name} island`, `<p class="muted">${HI.err === 'signin' ? 'The house island is shared, so you need to be signed in. Sign in on the Friends page.' : HI.err ? 'Couldn\'t reach the house island: ' + esc(HI.err) : 'Loading the house island…'}</p>${HI.err ? `<button class="btn" data-hi="reload">Try again</button>` : ''}`);
  const d = HI.doc, pool = hiPool(), L = hiLeaders(), lead = L.u.includes(HI.user), pr = hiProp(), hl = hiLevel(), busy = hiBusy(d);
  const nextT = HI_LVT[hl], tot = hiTotal(), prevT = HI_LVT[hl - 1] || 0;
  const P = ui.isPlace?.h ? ui.isPlace : null;
  const bubs = HI_ITEMS.filter(it => d.b?.[it.id]).map(it => {
    const s = d.b[it.id], c = hiCond(it.id);
    const t = c === 'build' ? `⏳ ${isTimeLeft(s.r)}` : s.up && today() < s.up.r ? `⬆️ ${isTimeLeft(s.up.r)}` : (c === 'broken' || c === 'worn') && (s.hit || []).some(x => x >= addDays(today(), -7)) ? '💥 Smashed' : c === 'broken' ? '🔴 Repair' : c === 'worn' ? '🟠 Worn' : '';
    return t ? `<button class="isbub" data-b="${it.id}" data-is="sel" data-id="${it.id}">${t}</button>` : '';
  }).join('');
  const hud = `<div class="ishud is-tl"><div class="islvl house" style="--hc:${h.col}"><b>${hl}</b><div><span>${h.e} ${esc(h.name)} · house level ${hl}</span>${nextT ? `<i style="width:${Math.round((tot - prevT) / (nextT - prevT) * 100)}%"></i>` : ''}</div></div>
      <div class="isbuilders">🔨 ${HI_MAX_BUILDING - busy}/${HI_MAX_BUILDING} builders free · ${lead ? '👑 You lead' : `Leaders: ${L.u.map(esc).join(', ') || 'none yet'}`}</div></div>
    <div class="ishud is-tr">${isBar('cd-l', LUMEN, pool.l, 'House Lumen', 1, '')}${isBar('cd-e', EMBER, pool.e, 'House Ember', 1, '')}</div>
    <div class="ishud is-bl"><button class="isbtn" data-hi="panel" data-v="pool">🏦<span>Pool</span></button><button class="isbtn" data-hi="panel" data-v="leaders">👑<span>Leaders</span></button><button class="isbtn ${pr?.open ? 'ping' : ''}" data-hi="panel" data-v="vote">🗳️<span>Vote</span></button><button class="isbtn" data-hi="panel" data-v="perks">✨<span>Perks</span></button></div>
    ${P ? '' : `<div class="ishud is-br"><button class="isbtn big" data-hi="panel" data-v="shop">🛒<span>Projects</span></button></div>`}`;
  let extra = `<div class="isbubs">${bubs}</div>`, pn = ui.isPanel;
  if (P) extra += isPlaceBar(hiItem(P.id).n, P.ok);
  else if (pn === 'shop') extra += isPanel(`🛒 House projects · level ${hl}`, hiShopHtml(d, pool, lead, pr, hl, busy));
  else if (pn === 'pool') extra += isPanel(`🏦 ${h.name} house pool`, hiPoolHtml(pool));
  else if (pn === 'leaders') extra += isPanel(`👑 Leaders · ${cdTermName(hiTerm().id)}`, hiLeadHtml(d, L));
  else if (pn === 'vote') extra += isPanel('🗳️ House vote', hiVoteHtml(d, pr, lead));
  else if (pn === 'perks' || pn === 'hall') { const pk = hiPerks(); extra += isPanel(pn === 'hall' ? `${h.e} ${h.name} great hall` : '✨ House perks', `${pn === 'hall' ? `<p>House level <b>${hl}</b>. ${nextT ? `${(nextT - tot).toLocaleString()} more in the pool (from anyone) for level ${hl + 1}.` : 'Top level!'} New projects and upgrades unlock as the house levels up.</p>` : ''}${Object.keys(pk).length ? `<p>${hiBuffText(pk)}</p>` : '<p class="muted small-text">Nothing built yet.</p>'}<p class="muted small-text">House perks only count in weekly house boss fights (on the <a href="#" data-act="goto" data-v="house">House</a> page), for everyone in ${h.name}.</p>`); }
  else if (ui.isSel && d.b?.[ui.isSel]) extra += hiPopHtml(hiItem(ui.isSel), d, pool, lead, hl, busy);
  return isFrame('house', hud, extra);
}
function hiShopHtml(d, pool, lead, pr, hl, busy) {
  const card = it => {
    const s = d.b?.[it.id], lock = hl < it.u, reqOk = !it.req || ['ok', 'worn', 'broken'].includes(hiCond(it.req)), can = pool.l >= it.l && pool.e >= it.x && busy < HI_MAX_BUILDING;
    let act;
    if (s) act = '<span class="tag">Built</span>';
    else if (lock) act = `<span class="tag">House level ${it.u}</span>`;
    else if (!reqOk) act = `<span class="muted small-text">Needs ${hiItem(it.req).n}</span>`;
    else if (hiBig(it) && !(pr?.b === it.id && pr.passed)) act = pr?.b === it.id ? `<span class="muted small-text">${pr.open ? 'House vote open' : 'Vote failed'}</span>` : lead && !(pr?.open) ? `<button class="btn small" data-hi="propose" data-id="${it.id}">Put to a vote</button>` : `<span class="muted small-text">Needs a house vote</span>`;
    else act = lead ? `<button class="btn small ${can ? 'primary' : ''}" data-hi="start" data-id="${it.id}" ${can ? '' : 'disabled'}>${hiCost(it)}</button>` : `<span class="muted small-text">${hiCost(it)} · leaders start it</span>`;
    return `<div class="isitem ${lock ? 'locked' : ''} ${s ? 'owned' : ''}"><div class="isitem-e">${lock ? '🔒' : it.e}</div><b>${it.n}</b><div class="muted small-text">${lock ? `Unlocks at house level ${it.u}` : hiPerkM(it)}</div><div class="small-text">${lock ? '&nbsp;' : `${it.sz}×${it.sz} · ${HI_LEN[it.t]} days${hiBig(it) ? ' · vote' : ''}`}</div>${act}</div>`;
  };
  return `<p class="muted small-text">Leaders start projects from the pool, ${HI_MAX_BUILDING} at a time. Month and term projects need a house vote first. Chains give their perk once every part is built.</p>
    <div class="isshop">${HI_ITEMS.filter(x => !x.ch).map(card).join('')}</div>
    ${Object.entries(HI_CHAINS).map(([cid, ch]) => `<div class="ftlbl">⛓️ ${ch.n} chain · when complete: ${hiBuffText(ch.b)}</div><div class="isshop">${HI_ITEMS.filter(x => x.ch === cid).map(card).join('')}</div>`).join('')}`;
}
function hiPopHtml(it, d, pool, lead, hl, busy) {
  const s = d.b[it.id], c = hiCond(it.id), cur = hiLvOn(s), nx = cur + 1, upping = s.up && today() < s.up.r;
  let acts = '';
  if (c === 'build') acts = `<span class="muted small-text">Ready in ${isTimeLeft(s.r)}</span>`;
  else if (upping) acts = `<span class="muted small-text">Upgrading to level ${s.up.lv}, ready in ${isTimeLeft(s.up.r)}</span>`;
  else {
    if (c === 'worn' || c === 'broken') { const f = IS_REPAIR[c], ok = pool.l >= Math.round(it.l * f) && pool.e >= Math.round(it.x * f); acts += lead ? `<button class="btn small ${ok ? 'primary' : ''}" data-hi="repair" data-id="${it.id}" ${ok ? '' : 'disabled'}>🔧 Repair · ${hiCost(it, f)}</button>` : `<span class="muted small-text">Leaders can repair (${hiCost(it, f)})</span>`; }
    if (nx <= HI_MAXLV) {
      const need = hiNeedLv(it, nx), f = IS_UPC[nx - 1], ok = pool.l >= Math.round(it.l * f) && pool.e >= Math.round(it.x * f) && busy < HI_MAX_BUILDING;
      acts += hl < need ? `<span class="tag">🔒 House level ${need} to upgrade</span>` : lead ? `<button class="btn small ${ok ? 'primary' : ''}" data-hi="upgrade" data-id="${it.id}" ${ok ? '' : 'disabled'}>⬆️ Level ${nx} · ${hiCost(it, f)} · ${hiUpDays(it, nx)}d</button>` : `<span class="muted small-text">Leaders can upgrade (${hiCost(it, f)})</span>`;
    } else acts += '<span class="tag">⭐ Max level</span>';
  }
  if (lead) acts += `<button class="btn small ghost" data-hi="move" data-id="${it.id}">✥ Move</button>`;
  return `<div class="ishud is-bc ispop"><div class="ispop-h"><span class="ise">${it.e}</span><div><b>${it.n}</b> <span class="tag">Level ${cur}</span> <span class="tag">${IS_LABEL[c]}</span>
      <div class="muted small-text">${hiPerkM(it, IS_LVM[cur - 1])}${nx <= HI_MAXLV && (it.b || it.alone) ? ` · next level: ${hiPerkM(it, IS_LVM[nx - 1])}` : ''} · built by ${esc(s.by || '?')}</div></div><button class="isx" data-is="close" title="Close">✕</button></div>
    <div class="ispop-a">${acts}</div></div>`;
}
function hiPoolHtml(pool) {
  const mine = hiMine(), w = cdWallet();
  return `<div class="cdwallet"><div class="card cdcoin cd-l"><div class="cdbig">${LUMEN} ${pool.l.toLocaleString()}</div><div><b>House Lumen</b></div></div><div class="card cdcoin cd-e"><div class="cdbig">${EMBER} ${pool.e.toLocaleString()}</div><div><b>House Ember</b></div></div></div>
    <p class="muted small-text">${Math.round(HI_SHARE * 100)}% of the Lumen and Ember you earn goes in automatically. You've put in ${LUMEN} ${mine.l.toLocaleString()} and ${EMBER} ${mine.e.toLocaleString()}. ${pool.n} member${pool.n === 1 ? '' : 's'} so far. Everything put in also raises the house level.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><input type="number" min="0" step="10" id="hiDonL" placeholder="${LUMEN} Lumen" style="width:110px"><input type="number" min="0" step="10" id="hiDonE" placeholder="${EMBER} Ember" style="width:110px"><button class="btn small primary" data-hi="donate">Donate</button><span class="muted small-text">You have ${LUMEN} ${w.lumen} · ${EMBER} ${w.ember}</span></div>`;
}
function hiLeadHtml(d, L) {
  const t = hiTerm(), myVote = d.v?.[HI.uid] || {}, el = hiEligible(d).filter(n => n !== HI.user), voting = today() < t.voteEnd;
  const tally = {}; for (const v of Object.values(d.v || {})) if (v.t === t.id && v.ld) tally[v.ld] = (tally[v.ld] || 0) + 1;
  return `<p>${L.u.length ? L.u.map(n => `<b>${esc(n)}</b>${n === HI.user ? ' (you)' : ''}`).join(', ') : '<span class="muted">Nobody yet</span>'}</p>
    <p class="muted small-text">${L.how === 'voted' ? 'Voted in for this term.' : L.how === 'last' ? `Last term's leaders stay on until voting closes ${fmtDate(t.voteEnd)}.` : `Until a vote is done, the top ${HI_LEADERS} contributors lead.`} ${HI_LEADERS} leaders a term. Anyone who has put ${HI_ELIG}+ into the pool can stand. Leaders start, upgrade, move and repair buildings.</p>
    ${voting ? `<div class="ftlbl">Vote for this term's leaders (until ${fmtDate(t.voteEnd)})</div>${el.length ? `<ul class="cdlog">${el.map(n => `<li><b>${esc(n)}</b><span class="muted">${tally[n] || 0} vote${tally[n] === 1 ? '' : 's'}</span><button class="btn small ${myVote.t === t.id && myVote.ld === n ? 'primary' : ''}" data-hi="lvote" data-u="${esc(n)}">${myVote.t === t.id && myVote.ld === n ? 'Voted' : 'Vote'}</button></li>`).join('')}</ul>` : '<p class="muted small-text">Nobody else can stand yet.</p>'}` : `<p class="muted small-text">The next leader vote opens at the start of next term.</p>`}`;
}
function hiVoteHtml(d, pr, lead) {
  if (!pr) return `<p class="muted">No vote open. Month and term projects need one: ${lead ? 'put one to a vote from Projects.' : 'a leader puts them to a vote.'} Votes stay open ${HI_PROP_DAYS} days and pass with more yes than no.</p>`;
  const myVote = d.v?.[HI.uid] || {}, it = hiItem(pr.b);
  return `<h4>${it.e} ${it.n}</h4><p class="small-text">${hiPerkM(it)} · ${hiCost(it)} · ${HI_LEN[it.t]} days</p><p class="small-text">Put forward by ${esc(pr.by)} on ${fmtDate(pr.at)}. ${pr.open ? `Open until ${fmtDate(addDays(pr.at, HI_PROP_DAYS))}.` : pr.passed ? 'Passed: a leader can start it.' : 'Didn\'t pass.'} 👍 ${pr.y} · 👎 ${pr.n}</p>
    ${pr.open ? `<div class="row" style="gap:8px"><button class="btn small ${myVote.p?.k === pr.k && myVote.p.y > 0 ? 'primary' : ''}" data-hi="pvote" data-y="1">👍 Yes</button><button class="btn small ${myVote.p?.k === pr.k && myVote.p.y < 0 ? 'primary' : ''}" data-hi="pvote" data-y="-1">👎 No</button></div>` : lead && !pr.passed ? `<button class="btn small ghost" data-hi="clearprop">Clear</button>` : ''}`;
}
// placing a new project or moving a building (leaders), after the spot is picked on the grid
async function hiPlaceDone(P) {
  const it = hiItem(P.id), now = today(); ui.isPlace = null;
  if (!hiAmLeader()) { render(); return; }
  let ok;
  if (P.mode === 'new') {
    ok = await hiWrite(d => {
      const p = hiPool(d); if (d.b?.[it.id] || p.l < it.l || p.e < it.x || hiBusy(d, now) >= HI_MAX_BUILDING || hiLevel(d) < it.u) return false;
      if (hiBig(it)) { const pr = hiProp(d); if (pr?.b !== it.id || !pr.passed) return false; delete d.pr; }
      d.sp = { l: (+d.sp?.l || 0) + it.l, e: (+d.sp?.e || 0) + it.x }; d.b = d.b || {}; d.b[it.id] = { s: now, r: addDays(now, HI_LEN[it.t]), reps: [], by: HI.user, lv: 1, at: P.at };
    });
    if (ok) toast(`${it.e} ${it.n} started`, `Ready ${fmtDate(addDays(now, HI_LEN[it.t]))}.`);
  } else ok = await hiWrite(d => { if (!d.b?.[it.id]) return false; d.b[it.id].at = P.at; });
  if (ok) ui.isSel = it.id;
  render();
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-hi]'); if (!el) return;
  const it = hiItem(el.dataset.id), now = today();
  let ok = false;
  switch (el.dataset.hi) {
    case 'reload': HI.at = 0; HI.err = ''; render(); hiLoad(true); return;
    case 'panel': Object.assign(ui, { isPanel: el.dataset.v, isSel: null }); break;
    case 'donate': {
      const w = cdWallet(), l = Math.min(w.lumen, Math.max(0, Math.round(+document.getElementById('hiDonL')?.value || 0))), x = Math.min(w.ember, Math.max(0, Math.round(+document.getElementById('hiDonE')?.value || 0)));
      if (!l && !x) return; if (!confirm(`Donate ${[l && LUMEN + ' ' + l, x && EMBER + ' ' + x].filter(Boolean).join(' + ')} to the house pool?`)) return;
      const got = ftTake(l, x), d = hiLocal().don; d.l = (d.l || 0) + got.l; d.e = (d.e || 0) + got.e; save();
      await hiTidy(); toast('🏰 Thanks!', 'Your donation is in the house pool.'); break;
    }
    case 'lvote': ok = await hiWrite(d => { d.v = d.v || {}; d.v[HI.uid] = { ...(d.v[HI.uid] || {}), t: hiTerm().id, ld: el.dataset.u }; }); break;
    case 'pvote': { const p = hiProp(); if (!p?.open) return; ok = await hiWrite(d => { d.v = d.v || {}; d.v[HI.uid] = { ...(d.v[HI.uid] || {}), p: { k: p.k, y: +el.dataset.y } }; }); break; }
    case 'propose': if (!it || !hiAmLeader() || hiProp()?.open) return; if (!confirm(`Put ${it.n} (${hiCost(it)}, ${HI_LEN[it.t]} days) to a house vote?`)) return;
      ok = await hiWrite(d => { d.pr = { b: it.id, at: now, by: HI.user }; }); ui.isPanel = 'vote'; break;
    case 'clearprop': if (!hiAmLeader()) return; ok = await hiWrite(d => { delete d.pr; }); break;
    case 'start': if (!it || !hiAmLeader()) return; ui.isPanel = null; isPlaceStart({ id: it.id, sz: it.sz, mode: 'new', L: hiLayout(), h: 1 }); return;
    case 'move': { if (!it || !hiAmLeader()) return; const L = hiLayout(); ui.isSel = null; isPlaceStart({ id: it.id, sz: it.sz, mode: 'move', L, h: 1, at: L.items.find(o => o.id === it.id)?.at }); return; }
    case 'upgrade': {
      if (!it || !hiAmLeader()) return;
      const s0 = HI.doc.b?.[it.id], nx = hiLvOn(s0) + 1, f = IS_UPC[nx - 1], days = hiUpDays(it, nx);
      if (!confirm(`Upgrade ${it.n} to level ${nx} for ${hiCost(it, f)} from the house pool? It takes ${days} days and keeps working meanwhile.`)) return;
      ok = await hiWrite(d => {
        const s = d.b?.[it.id], p = hiPool(d), l = Math.round(it.l * f), x = Math.round(it.x * f);
        if (!s || now < s.r || (s.up && now < s.up.r) || hiLvOn(s) + 1 !== nx || nx > HI_MAXLV || hiLevel(d) < hiNeedLv(it, nx) || p.l < l || p.e < x || hiBusy(d, now) >= HI_MAX_BUILDING) return false;
        if (s.up) { s.lv = s.up.lv; s.reps = [...(s.reps || []), s.up.r]; }
        d.sp = { l: (+d.sp?.l || 0) + l, e: (+d.sp?.e || 0) + x }; s.up = { lv: nx, s: now, r: addDays(now, days) };
      });
      if (ok) toast(`⬆️ Upgrading ${it.n}`, `Level ${nx} ready ${fmtDate(addDays(now, days))}.`); break;
    }
    case 'repair': {
      if (!it || !hiAmLeader()) return;
      ok = await hiWrite(d => {
        const f = IS_REPAIR[hiCond(it.id, now, d)], p = hiPool(d); if (!f) return false;
        const l = Math.round(it.l * f), x = Math.round(it.x * f); if (p.l < l || p.e < x) return false;
        d.sp = { l: (+d.sp?.l || 0) + l, e: (+d.sp?.e || 0) + x }; const s = d.b[it.id]; s.reps = [...(s.reps || []).filter(r => r >= addDays(now, -400)), now];
      });
      if (ok) toast(`${it.e} ${it.n} repaired`, 'Its perk is back to full for the whole house.'); break;
    }
  }
  render();
});
