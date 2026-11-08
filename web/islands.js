'use strict';
/* Islands (2.49, reworked in 2.51). Your personal island and your house island
   float in space as base-builder style grids. The Islands page is one full
   screen 3D view with the resource bars, switcher, shop and a tap-a-building
   popup drawn over it only when needed.
   Personal island: a 14x14 grid. Buildings unlock as your player level goes up,
   cost Lumen, Ember or both, take a few days to build (2 builders, so 2 at a
   time), are placed and moved on the grid, and upgrade to level 3 (each level
   needs a higher player level, costs more and takes longer, and makes the perk
   bigger). Collectors (Study Hut, Training Shed, Windmill) fill up with bonus
   Lumen/Ember from your study and training, up to what your vaults can store;
   tap to collect. They slowly wear (half perk) then break (no perk), are never
   destroyed, and are repaired with currency. Wear pauses on holidays and around
   exams. The 3D is low-poly and drawn only when something changes.
   State lives in D.cards.isl so it resets with the cards. */

const IS_WEAR = 21, IS_BREAK = 42; // active (not paused) days after building, repairing or upgrading
const IS_REPAIR = { worn: .15, broken: .35 }; // share of the build cost
const IS_N = 14, IS_BUILDERS = 2, IS_MAXLV = 3;
const IS_LVM = [1, 1.5, 2], IS_UPC = [1, 1.8, 3], IS_UPD = [1, 1.5, 2]; // perk, cost and time by level
const IS_STORE = 100; // what the collectors can hold with no vaults
// lp/ep: collectors (share of each day's Lumen/Ember that piles up to collect); cl/ce: vault storage
const IS_EARN = { lp: [.08, 'Collects Lumen', v => `+${Math.round(v * 100)}% of study`], ep: [.08, 'Collects Ember', v => `+${Math.round(v * 100)}% of training`], cl: [300, 'Lumen storage', v => `+${Math.round(v)}`], ce: [300, 'Ember storage', v => `+${Math.round(v)}`] };
// u = player level it unlocks at, sz = footprint in tiles
const IS_ITEMS = [
  { id: 'hut', n: 'Study Hut', e: '📚', m: 'hut', col: '#d9a066', l: 300, x: 0, days: 2, u: 1, sz: 2, b: { lp: .08 } },
  { id: 'shed', n: 'Training Shed', e: '🏋️', m: 'hut', col: '#c0504d', l: 0, x: 300, days: 2, u: 1, sz: 2, b: { ep: .08 } },
  { id: 'fire', n: 'Campfire', e: '🔥', m: 'fire', col: '#ff922b', l: 120, x: 120, days: 1, u: 2, sz: 2, b: { rg: 1 } },
  { id: 'vaultl', n: 'Lumen Vault', e: '💠', m: 'vault', col: '#ffe066', l: 0, x: 250, days: 2, u: 3, sz: 2, b: { cl: 300 } },
  { id: 'vaulte', n: 'Ember Vault', e: '🏮', m: 'vault', col: '#ff6b3d', l: 250, x: 0, days: 2, u: 3, sz: 2, b: { ce: 300 } },
  { id: 'shrine', n: 'Moon Shrine', e: '⛩️', m: 'shrine', col: '#e03131', l: 450, x: 0, days: 3, u: 4, sz: 2, b: { hp: 15 } },
  { id: 'forge', n: 'Forge', e: '⚒️', m: 'forge', col: '#868e96', l: 150, x: 450, days: 3, u: 5, sz: 2, b: { mv: .04 } },
  { id: 'light', n: 'Lighthouse', e: '🗼', m: 'light', col: '#f8f9fa', l: 450, x: 150, days: 3, u: 6, sz: 2, b: { sp: .04 } },
  { id: 'tower', n: 'Watchtower', e: '🏯', m: 'tower', col: '#a0785a', l: 300, x: 300, days: 3, u: 7, sz: 2, b: { cr: .02 } },
  { id: 'wall', n: 'Stone Wall', e: '🧱', m: 'wall', col: '#adb5bd', l: 0, x: 500, days: 3, u: 8, sz: 2, b: { dr: .03 } },
  { id: 'mill', n: 'Windmill', e: '🌬️', m: 'mill', col: '#f1e3c6', l: 400, x: 400, days: 4, u: 10, sz: 2, b: { lp: .05, ep: .05 } },
  { id: 'spring', n: 'Hot Spring', e: '♨️', m: 'spring', col: '#66d9e8', l: 600, x: 600, days: 4, u: 12, sz: 3, b: { hp: 20, rg: 1 } },
  { id: 'obs', n: 'Observatory', e: '🔭', m: 'dome', col: '#748ffc', l: 900, x: 300, days: 5, u: 14, sz: 3, b: { wk: .05 } },
  { id: 'totem', n: 'Spirit Totem', e: '🗿', m: 'totem', col: '#94d82d', l: 700, x: 700, days: 5, u: 16, sz: 2, b: { dg: .02 } },
];
// player level: the shared Solis level (level.js, lifetime Lumen + Ember)
function isLv() { try { if (typeof solisLevel === 'function') return solisLevel().n; } catch (e) { } return 1; }
const isState = () => { const c = cdState(); return (c.isl = Object.assign({ items: {}, mark: { l: 0, e: 0 } }, c.isl || {})); };
const isItem = id => IS_ITEMS.find(x => x.id === id);
const isFmt = (k, v) => { const f = IS_EARN[k] || FT_BUFF[k]; return f ? `${f[1]} ${f[2](Math.round(v * 100) / 100)}` : ''; };
const isBuffText = (b, m = 1) => Object.entries(b).map(([k, v]) => isFmt(k, k === 'hp' || k === 'rg' || k === 'cl' || k === 'ce' ? Math.round(v * m) : v * m)).join(' · ');
const isCost = (it, f = 1) => [it.l && `${LUMEN} ${Math.round(it.l * f)}`, it.x && `${EMBER} ${Math.round(it.x * f)}`].filter(Boolean).join(' + ');
const isNeedLv = (it, lv) => it.u + (lv - 1) * 3; // player level needed for building level lv
// level of a building on a day, counting a finished upgrade
const isLvOn = (s, d = today()) => s ? (s.up && d >= s.up.r ? s.up.lv : s.lv || 1) : 0;
const isRepsOn = (s, d = today()) => [...(s.reps || []), ...(s.up && d >= s.up.r ? [s.up.r] : [])];
// fold a finished upgrade into the saved building
function isFold(s) { if (s?.up && today() >= s.up.r) { s.lv = s.up.lv; s.reps = [...(s.reps || []), s.up.r]; delete s.up; } return s; }
const isBusy = (s, d = today()) => s && (d < s.ready || (s.up && d < s.up.r));

// days when wear stands still: holidays, and an exam's day plus the 3 days before it
function isPaused() {
  const ex = new Set();
  for (const a of (D.assessments || [])) if (typeof isExam === 'function' && isExam(a) && a.date) for (let i = 0; i <= 3; i++) ex.add(addDays(a.date, -i));
  return d => ex.has(d) || (typeof isHoliday === 'function' && isHoliday(d));
}
// each building's condition on every day since it was finished (cached until something changes)
const IS_TL = new Map();
function isTimeline(id) {
  const s = isState().items[id]; if (!s) return null;
  const reps = isRepsOn(s), key = [id, s.start, s.ready, reps.join(), today(), (D.settings.holidays || []).length, (D.assessments || []).length].join('|');
  if (IS_TL.has(key)) return IS_TL.get(key);
  const tl = {}, rs = new Set(reps), paused = isPaused(); let act = 0;
  for (let d = s.ready; d <= today(); d = addDays(d, 1)) {
    if (rs.has(d)) act = 0;
    tl[d] = act >= IS_BREAK ? 'broken' : act >= IS_WEAR ? 'worn' : 'ok';
    if (!paused(d)) act++;
  }
  const out = { tl, act };
  for (const k of IS_TL.keys()) if (k.startsWith(id + '|')) IS_TL.delete(k);
  IS_TL.set(key, out); return out;
}
function isCond(id, d = today()) {
  const s = isState().items[id]; if (!s || d < s.start) return null;
  if (d < s.ready) return 'build';
  return isTimeline(id).tl[d] || 'ok';
}
const isMult = c => c === 'ok' ? 1 : c === 'worn' ? .5 : 0;
const isPerkM = (id, d = today()) => isMult(isCond(id, d)) * IS_LVM[Math.max(0, isLvOn(isState().items[id], d) - 1)];
// battle buffs from the island, added to gear in fight.js
function islBuffs(d = today()) {
  const g = {};
  for (const it of IS_ITEMS) { const m = isPerkM(it.id, d); if (m) for (const [k, v] of Object.entries(it.b)) if (FT_BUFF[k]) g[k] = (g[k] || 0) + (k === 'hp' || k === 'rg' ? Math.round(v * m) : v * m); }
  return g;
}
// collector rate for Lumen (lp) or Ember (ep) on a day
function islEarn(k, d) { let t = 0; for (const it of IS_ITEMS) if (it.b[k] && isState().items[it.id]) t += it.b[k] * isPerkM(it.id, d); return t; }
// what the collectors hold right now: everything they have made since you last collected, up to the vaults' storage
function isStore() {
  const st = isState(), c = cdState(); let l = 0, e = 0;
  for (let d = c.since; d && d <= today(); d = addDays(d, 1)) { const rl = islEarn('lp', d), re = islEarn('ep', d); if (!rl && !re) continue; const x = cdDay(d); l += x.lumen * rl; e += x.ember * re; }
  let capL = IS_STORE, capE = IS_STORE;
  for (const it of IS_ITEMS) { const m = isPerkM(it.id); if (it.b.cl) capL += it.b.cl * m; if (it.b.ce) capE += it.b.ce * m; }
  const m = st.mark || { l: 0, e: 0 };
  return { l: Math.floor(Math.min(capL, Math.max(0, l - (m.l || 0)))), e: Math.floor(Math.min(capE, Math.max(0, e - (m.e || 0)))), capL: Math.round(capL), capE: Math.round(capE), tl: l, te: e };
}
function isCollect() {
  const s = isStore(), st = isState(), c = cdState(); if (!s.l && !s.e) return;
  c.got = c.got || { l: 0, e: 0 }; c.got.l = (c.got.l || 0) + s.l; c.got.e = (c.got.e || 0) + s.e;
  st.mark = { l: s.tl, e: s.te }; // anything past the storage cap is lost, like a full store
  save(); toast('✨ Collected', [s.l && `${LUMEN} ${s.l}`, s.e && `${EMBER} ${s.e}`].filter(Boolean).join(' + ')); render();
}

// ---------- grid placement ----------
// layout: { N, centre: [gx, gz, size], items: [{ id, sz, at }] }; at = top-left tile
function isFits(L, id, sz, gx, gz, gap = 0) {
  if (gx < 0 || gz < 0 || gx + sz > L.N || gz + sz > L.N) return false;
  const hit = (ax, az, as) => gx < ax + as + gap && ax - gap < gx + sz && gz < az + as + gap && az - gap < gz + sz;
  const [cx, cz, cs] = L.centre; if (hit(cx, cz, cs)) return false;
  return L.items.every(o => o.id === id || !o.at || !hit(o.at[0], o.at[1], o.sz));
}
// first free spot, nearest the middle
function isSpot(L, id, sz) {
  const c = (L.N - sz) / 2, spots = [];
  for (let x = 0; x <= L.N - sz; x++) for (let z = 0; z <= L.N - sz; z++) spots.push([x, z, Math.hypot(x - c, z - c)]);
  spots.sort((a, b) => a[2] - b[2]);
  const f = spots.find(([x, z]) => isFits(L, id, sz, x, z, 1)) || spots.find(([x, z]) => isFits(L, id, sz, x, z)); return f ? [f[0], f[1]] : null; // leave a path round each building if there's room
}
// personal layout, giving any building without a spot (from before 2.51) the nearest free one
function isLayout() {
  const st = isState(), L = { N: IS_N, centre: [6, 6, 2], items: [] };
  for (const it of IS_ITEMS) { const s = st.items[it.id]; if (s) L.items.push({ id: it.id, sz: it.sz, at: s.at }); }
  for (const o of L.items) if (!o.at || !isFits(L, o.id, o.sz, ...o.at)) { o.at = null; o.at = st.items[o.id].at = isSpot(L, o.id, o.sz) || [0, 0]; }
  return L;
}

// ---------- page ----------
const isTimeLeft = d => { const ms = new Date(d + 'T00:00').getTime() - Date.now(); if (ms <= 0) return 'soon'; const h = Math.floor(ms / 36e5), dd = Math.floor(h / 24); return dd ? `${dd}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`; };
const IS_LABEL = { build: '🏗️ Building', ok: '✅ Working', worn: '🟠 Worn: half perk', broken: '🔴 Broken: no perk' };
const isSwitch = tab => `<div class="ishud is-tc"><div class="isswitch">${[['personal', '🏝️', 'Your island'], ['house', '🏰', 'House island'], ['boss', typeof hsBoss === 'function' ? hsBoss(mondayOf(today())).e : '💀', 'Boss island']].map(([id, e, n]) => `<button class="${tab === id ? 'on' : ''}" data-is="tab" data-v="${id}">${e} ${n}</button>`).join('')}</div></div>`;
const isCtl = () => `<div class="g3ctl isctl"><button data-is="view" data-v="left" title="Turn left (or drag)">⟲</button><button data-is="view" data-v="right" title="Turn right">⟳</button><button data-is="view" data-v="in" title="Zoom in (or scroll)">＋</button><button data-is="view" data-v="out" title="Zoom out">−</button><button data-is="view" data-v="reset" title="Reset view">⌂</button></div>`;
// a resource bar: amount, and how full the store is
const isBar = (cls, ico, amt, sub, fill, act) => `<div class="isres ${cls}" ${act ? `data-is="${act}" role="button" tabindex="0"` : ''}><span class="isico">${ico}</span><div><b>${amt.toLocaleString()}</b><i style="width:${Math.max(0, Math.min(100, fill * 100))}%"></i></div><small>${sub}</small></div>`;
// full-screen frame: 3D, bubbles over buildings and whatever overlays are open
function isFrame(tab, hud, extra = '') {
  return `<div class="isfull" id="isfull">
    <div class="is3host" id="is3host"></div>
    ${typeof webglOK === 'function' && webglOK() ? '' : '<div class="isno3d">This computer can\'t show 3D, but your buildings still work.</div>'}
    ${isSwitch(tab)}${hud}${isCtl()}${extra}</div>`;
}
const isPanel = (title, body) => `<div class="ispanel-bg" data-is="close"></div><div class="ispanel"><div class="ispanel-h"><h3>${title}</h3><button class="isx" data-is="close" title="Close">✕</button></div><div class="ispanel-b">${body}</div></div>`;
const isPlaceBar = (n, ok) => `<div class="ishud is-bc isplace"><span>Tap a spot for <b>${esc(n)}</b>. Drag to turn the island.</span><button class="btn small primary" data-is="placeok" id="isPlaceOk" ${ok ? '' : 'disabled'}>✔ Place here</button><button class="btn small ghost" data-is="placeno">✖ Cancel</button></div>`;

function viewIslands() {
  const tab = ui.isTab || 'personal';
  if (tab === 'house') return viewHouseIsland();
  if (tab === 'boss') return viewBossIsland();
  const st = isState(), w = cdWallet(), lv = isLv(), L = isLayout(), sto = isStore();
  for (const s of Object.values(st.items)) isFold(s);
  const busy = IS_ITEMS.filter(it => isBusy(st.items[it.id])).length;
  const P = ui.isPlace && !ui.isPlace.h ? ui.isPlace : null;
  // bubbles over buildings: timers, collect and repair
  const bubs = IS_ITEMS.filter(it => st.items[it.id]).map(it => {
    const s = st.items[it.id], c = isCond(it.id);
    let t = '';
    if (c === 'build') t = `⏳ ${isTimeLeft(s.ready)}`;
    else if (s.up) t = `⬆️ ${isTimeLeft(s.up.r)}`;
    else if (c === 'broken') t = '🔴 Repair';
    else if (c === 'worn') t = '🟠 Worn';
    else if ((it.b.lp && sto.l) || (it.b.ep && sto.e)) return `<button class="isbub collect" data-b="${it.id}" data-is="collect">${it.b.lp && sto.l ? `${LUMEN} ${sto.l}` : ''}${it.b.lp && it.b.ep && sto.l && sto.e ? ' · ' : ''}${it.b.ep && sto.e ? `${EMBER} ${sto.e}` : ''}</button>`;
    return t ? `<button class="isbub" data-b="${it.id}" data-is="sel" data-id="${it.id}">${t}</button>` : '';
  }).join('');
  const lvI = typeof solisLevel === 'function' ? solisLevel() : null;
  const hud = `<div class="ishud is-tl"><div class="islvl"><b>${lv}</b><div><span>Level ${lv}</span>${lvI ? `<i style="width:${Math.round(lvI.into / lvI.need * 100)}%"></i>` : ''}</div></div>
      <div class="isbuilders" title="Builders: how many things can be built or upgraded at once">🔨 ${IS_BUILDERS - busy}/${IS_BUILDERS} builders free</div></div>
    <div class="ishud is-tr">${isBar('cd-l', LUMEN, w.lumen, sto.l ? `+${sto.l} to collect · store ${sto.capL}` : `Store ${sto.capL}`, sto.l / sto.capL, sto.l ? 'collect' : '')}${isBar('cd-e', EMBER, w.ember, sto.e ? `+${sto.e} to collect · store ${sto.capE}` : `Store ${sto.capE}`, sto.e / sto.capE, sto.e ? 'collect' : '')}</div>
    <div class="ishud is-bl"><button class="isbtn" data-is="panel" data-v="perks">✨<span>Perks</span></button><button class="isbtn" data-is="panel" data-v="help">❔<span>How it works</span></button></div>
    ${P ? '' : `<div class="ishud is-br"><button class="isbtn big" data-is="panel" data-v="shop">🛒<span>Shop</span></button></div>`}`;
  let extra = `<div class="isbubs">${bubs}</div>`;
  if (P) extra += isPlaceBar(isItem(P.id).n, P.ok);
  else if (ui.isPanel === 'shop') extra += isPanel('🛒 Shop · your island', isShopHtml(st, w, lv, busy));
  else if (ui.isPanel === 'perks') { const g = islBuffs(), rl = islEarn('lp', today()), re = islEarn('ep', today());
    extra += isPanel('✨ Your island perks', `${Object.keys(g).length || rl || re ? `<p>${isBuffText(Object.assign(g, rl ? { lp: rl } : {}, re ? { ep: re } : {}))}</p>` : '<p class="muted">Build something to get your first perk.</p>'}<p class="muted small-text">Battle perks add to your gear on the Character page. Collectors pile up extra Lumen and Ember from your study and training until you collect it, up to what your vaults can store (${LUMEN} ${sto.capL} · ${EMBER} ${sto.capE}).</p>`); }
  else if (ui.isPanel === 'help') extra += isPanel('❔ How your island works', `<ul class="ishelp"><li>New buildings unlock as your level goes up. Every Lumen and Ember you earn from study and training levels you up.</li><li>Buy one in the Shop, tap a spot on the grid and place it. It takes a few days to build. You have ${IS_BUILDERS} builders, so ${IS_BUILDERS} things can be built or upgraded at once.</li><li>Tap a building to upgrade it (up to level ${IS_MAXLV}), move it or repair it. Each level needs a higher player level and makes its perk bigger.</li><li>Collectors fill with bonus ${LUMEN} Lumen and ${EMBER} Ember. Tap the bubble to collect. When the store is full, the extra is lost, so build vaults.</li><li>After ${IS_WEAR} active days a building wears (half perk), after ${IS_BREAK} it breaks (no perk) until you repair it. Holidays and the days around exams don't count. Upgrading also freshens it up.</li></ul>`);
  else if (ui.isSel && st.items[ui.isSel]) extra += isPopHtml(isItem(ui.isSel), st, w, lv, busy);
  return isFrame('personal', hud, extra);
}
function isShopHtml(st, w, lv, busy) {
  return `<p class="muted small-text">You're level ${lv}. ${IS_BUILDERS - busy} of ${IS_BUILDERS} builders free.</p><div class="isshop">${IS_ITEMS.map(it => {
    const s = st.items[it.id], lock = lv < it.u, can = !s && !lock && w.lumen >= it.l && w.ember >= it.x && busy < IS_BUILDERS;
    return `<div class="isitem ${lock ? 'locked' : ''} ${s ? 'owned' : ''}"><div class="isitem-e">${lock ? '🔒' : it.e}</div><b>${it.n}</b>
      <div class="muted small-text">${lock ? `Unlocks at level ${it.u}` : isBuffText(it.b)}</div>
      <div class="small-text">${lock ? '&nbsp;' : `${it.sz}×${it.sz} · ${it.days} day${it.days === 1 ? '' : 's'}`}</div>
      ${s ? '<span class="tag">Built</span>' : lock ? `<span class="tag">Level ${it.u}</span>` : `<button class="btn small ${can ? 'primary' : ''}" data-is="buy" data-id="${it.id}" ${can ? '' : 'disabled'}>${isCost(it)}</button>`}</div>`;
  }).join('')}</div>`;
}
function isPopHtml(it, st, w, lv, busy) {
  const s = st.items[it.id], c = isCond(it.id), cur = isLvOn(s), nx = cur + 1, m = IS_LVM[cur - 1];
  let acts = '';
  if (c === 'build') acts = `<span class="muted small-text">Ready in ${isTimeLeft(s.ready)}</span>`;
  else if (s.up) acts = `<span class="muted small-text">Upgrading to level ${s.up.lv}, ready in ${isTimeLeft(s.up.r)}</span>`;
  else {
    if (c === 'worn' || c === 'broken') { const f = IS_REPAIR[c], ok = w.lumen >= Math.round(it.l * f) && w.ember >= Math.round(it.x * f); acts += `<button class="btn small ${ok ? 'primary' : ''}" data-is="repair" data-id="${it.id}" ${ok ? '' : 'disabled'}>🔧 Repair · ${isCost(it, f)}</button>`; }
    if (nx <= IS_MAXLV) {
      const need = isNeedLv(it, nx), f = IS_UPC[nx - 1], ok = lv >= need && w.lumen >= Math.round(it.l * f) && w.ember >= Math.round(it.x * f) && busy < IS_BUILDERS;
      acts += lv < need ? `<span class="tag">🔒 Level ${need} to upgrade</span>` : `<button class="btn small ${ok ? 'primary' : ''}" data-is="upgrade" data-id="${it.id}" ${ok ? '' : 'disabled'} title="${busy >= IS_BUILDERS ? 'All builders are busy' : ''}">⬆️ Level ${nx} · ${isCost(it, f)} · ${Math.ceil(it.days * IS_UPD[nx - 1])}d</button>`;
    } else acts += '<span class="tag">⭐ Max level</span>';
  }
  const left = c === 'ok' && !s.up ? IS_WEAR - isTimeline(it.id).act : 0;
  return `<div class="ishud is-bc ispop"><div class="ispop-h"><span class="ise">${it.e}</span><div><b>${it.n}</b> <span class="tag">Level ${cur}</span> <span class="tag">${IS_LABEL[c]}</span>
      <div class="muted small-text">${isBuffText(it.b, m)}${nx <= IS_MAXLV ? ` · next level: ${isBuffText(it.b, IS_LVM[nx - 1])}` : ''}${left > 0 ? ` · wears in ${left} active day${left === 1 ? '' : 's'}` : ''}</div></div><button class="isx" data-is="close" title="Close">✕</button></div>
    <div class="ispop-a">${acts}<button class="btn small ghost" data-is="move" data-id="${it.id}">✥ Move</button></div></div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-is]'); if (!el) return;
  const st = isState(), it = isItem(el.dataset.id), w = cdWallet();
  switch (el.dataset.is) {
    case 'tab': Object.assign(ui, { isTab: el.dataset.v, isSel: null, isPanel: null, isPlace: null }); if (view !== 'islands') { view = 'islands'; window.scrollTo(0, 0); } render(); break;
    case 'view': is3view(el.dataset.v); break;
    case 'panel': Object.assign(ui, { isPanel: el.dataset.v, isSel: null }); render(); break;
    case 'close': Object.assign(ui, { isPanel: null, isSel: null }); render(); break;
    case 'sel': ui.isSel = el.dataset.id; ui.isPanel = null; render(); break;
    case 'collect': isCollect(); break;
    case 'buy': {
      const busy = IS_ITEMS.filter(x => isBusy(st.items[x.id])).length;
      if (!it || st.items[it.id] || isLv() < it.u || w.lumen < it.l || w.ember < it.x || busy >= IS_BUILDERS) return;
      ui.isPanel = null; isPlaceStart({ id: it.id, sz: it.sz, mode: 'new', L: isLayout() }); break;
    }
    case 'move': if (!it || !st.items[it.id]) return; ui.isSel = null; isPlaceStart({ id: it.id, sz: it.sz, mode: 'move', L: isLayout(), at: st.items[it.id].at }); break;
    case 'placeno': ui.isPlace = null; render(); break;
    case 'placeok': {
      const P = ui.isPlace; if (!P || !P.ok) return;
      if (P.h) { hiPlaceDone(P); return; }
      const pi = isItem(P.id);
      if (P.mode === 'new') {
        if (st.items[pi.id] || w.lumen < pi.l || w.ember < pi.x) { ui.isPlace = null; render(); return; }
        ftTake(pi.l, pi.x); st.items[pi.id] = { start: today(), ready: addDays(today(), pi.days), reps: [], lv: 1, at: P.at };
        toast(`${pi.e} Building ${pi.n}`, `Ready ${fmtDate(addDays(today(), pi.days))}.`);
      } else st.items[pi.id].at = P.at;
      ui.isPlace = null; ui.isSel = pi.id; save(); render(); break;
    }
    case 'upgrade': {
      const s = st.items[it?.id]; if (!s || s.up || isCond(it.id) === 'build') return;
      const nx = isLvOn(s) + 1, f = IS_UPC[nx - 1], l = Math.round(it.l * f), x = Math.round(it.x * f), days = Math.ceil(it.days * IS_UPD[nx - 1]);
      if (nx > IS_MAXLV || isLv() < isNeedLv(it, nx) || w.lumen < l || w.ember < x || IS_ITEMS.filter(y => isBusy(st.items[y.id])).length >= IS_BUILDERS) return;
      if (!confirm(`Upgrade ${it.n} to level ${nx} for ${isCost(it, f)}? It takes ${days} day${days === 1 ? '' : 's'} and keeps working meanwhile.`)) return;
      ftTake(l, x); s.up = { lv: nx, s: today(), r: addDays(today(), days) };
      save(); render(); toast(`⬆️ Upgrading ${it.n}`, `Level ${nx} ready ${fmtDate(s.up.r)}.`); break;
    }
    case 'repair': {
      const c = isCond(it?.id), f = IS_REPAIR[c]; if (!f) return;
      const l = Math.round(it.l * f), x = Math.round(it.x * f); if (w.lumen < l || w.ember < x) return;
      ftTake(l, x); const s = st.items[it.id]; s.reps = [...(s.reps || []).filter(d => d >= addDays(today(), -400)), today()];
      save(); render(); toast(`${it.e} ${it.n} repaired`, 'Its perk is back to full.'); break;
    }
  }
});
document.addEventListener('keydown', e => {
  if (view !== 'islands') return;
  if (e.key === 'Escape' && (ui.isPanel || ui.isSel || ui.isPlace)) { Object.assign(ui, { isPanel: null, isSel: null, isPlace: null }); render(); }
  if (e.key === 'Enter' && e.target.closest?.('[data-is="collect"]')) isCollect();
});
function isPlaceStart(P) {
  P.at = P.at && isFits(P.L, P.id, P.sz, ...P.at) ? P.at : isSpot(P.L, P.id, P.sz);
  if (!P.at) { toast('No room', 'Move something to make space first.'); return; }
  P.ok = true; ui.isPlace = P; render();
}

// ---------- 3D (three.js, rotate and zoom only, drawn on demand) ----------
const IS3 = { yaw: Math.PI / 4, pitch: .62, dist: 34, sig: '' };
const is3home = house => ({ yaw: Math.PI / 4, pitch: house === 'boss' ? .42 : .62, dist: house === 'boss' ? 30 : house ? 50 : 34 });
function is3init() {
  if (IS3.R) return;
  const R = IS3.R = fxRenderer(); R.shadowMap.type = THREE.PCFSoftShadowMap;
  IS3.canvas = R.domElement; IS3.canvas.className = 'g3canvas';
  const S = IS3.scene = new THREE.Scene();
  // deep space: a soft gradient with two nebula glows, and one points cloud of stars
  const bg = document.createElement('canvas'); bg.width = 16; bg.height = 256; const x = bg.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#060a1f'); gr.addColorStop(.55, '#15123a'); gr.addColorStop(1, '#2a1640'); x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
  S.background = new THREE.CanvasTexture(bg); S.background.encoding = THREE.sRGBEncoding;
  const rnd = seeded('solis-stars'), pos = [];
  for (let i = 0; i < 900; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 160, k = Math.sqrt(1 - u * u); pos.push(Math.cos(a) * k * r, u * r, Math.sin(a) * k * r); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  S.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false })));
  for (const [col, p] of [['#7b4dff', [-70, 20, -90]], ['#1fb5c9', [80, -30, -60]], ['#ff7a3d', [30, 50, 110]]]) { const n = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .07, depthWrite: false })); n.position.set(...p); S.add(n); }
  IS3.cam = new THREE.PerspectiveCamera(38, 1, .5, 400);
  S.add(new THREE.HemisphereLight('#d9e2ff', '#3b2a55', .75));
  const sun = IS3.sun = new THREE.DirectionalLight('#fff1d6', 1); sun.position.set(16, 30, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 }); S.add(sun);
  const rim = new THREE.DirectionalLight('#8a7dff', .35); rim.position.set(-20, -6, -14); S.add(rim);
  IS3.world = new THREE.Group(); S.add(IS3.world);
  IS3.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, .5, 1), new THREE.MeshBasicMaterial({ color: '#51cf66', transparent: true, opacity: .45, depthWrite: false })); IS3.ghost.visible = false; S.add(IS3.ghost);
  IS3.ray = new THREE.Raycaster();
  const c = IS3.canvas; let drag = null, moved = 0;
  c.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; moved = 0; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => {
    if (!drag) { if (ui.isPlace) is3ghostAt(e); return; }
    moved += Math.abs(e.clientX - drag[0]) + Math.abs(e.clientY - drag[1]);
    IS3.yaw -= (e.clientX - drag[0]) * .008; IS3.pitch = Math.max(.25, Math.min(1.3, IS3.pitch + (e.clientY - drag[1]) * .006)); drag = [e.clientX, e.clientY]; is3draw();
  });
  c.addEventListener('pointerup', e => { const was = drag; drag = null; if (was && moved < 6) is3tap(e); });
  c.addEventListener('wheel', e => { e.preventDefault(); IS3.dist = Math.max(12, Math.min(90, IS3.dist * (e.deltaY > 0 ? 1.1 : .9))); is3draw(); }, { passive: false });
  new ResizeObserver(() => { if (is3resize()) is3draw(); }).observe(document.body);
}
function is3resize() {
  const h = IS3.canvas?.parentNode; if (!h) return false;
  const f = document.getElementById('isfull'); if (f) { const top = f.getBoundingClientRect().top + window.scrollY; f.style.height = Math.max(420, window.innerHeight - top - 12) + 'px'; }
  if (!h.clientWidth) return false;
  const sz = h.clientWidth + 'x' + h.clientHeight; if (sz === IS3.sz) return false;
  IS3.sz = sz; IS3.R.setSize(h.clientWidth, h.clientHeight, false); IS3.cam.aspect = h.clientWidth / h.clientHeight; IS3.cam.updateProjectionMatrix(); return true;
}
function is3draw() {
  if (!IS3.R || !IS3.canvas.isConnected || IS3.queued) return;
  IS3.queued = requestAnimationFrame(() => {
    IS3.queued = 0; const { cam, yaw, pitch, dist } = IS3;
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(0, 0, 0);
    IS3.R.render(IS3.scene, cam);
    // keep the bubbles over their buildings
    const host = IS3.canvas.parentNode, W = host.clientWidth, H = host.clientHeight, v = new THREE.Vector3();
    document.querySelectorAll('#isfull .isbub[data-b]').forEach(b => {
      const p = IS3.marks?.[b.dataset.b]; if (!p) { b.style.display = 'none'; return; }
      v.set(p[0], p[1], p[2]).project(cam); b.style.display = '';
      b.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px) translate(-50%, -100%)`;
    });
  });
}
function is3view(v) {
  if (v === 'left') IS3.yaw += Math.PI / 4; if (v === 'right') IS3.yaw -= Math.PI / 4;
  if (v === 'in') IS3.dist = Math.max(12, IS3.dist * .82); if (v === 'out') IS3.dist = Math.min(90, IS3.dist * 1.2);
  if (v === 'reset') Object.assign(IS3, is3home(IS3.house));
  is3draw();
}
// the tile under the pointer, on the island's grid
function is3tile(e) {
  if (!IS3.grid) return null;
  const r = IS3.canvas.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  IS3.ray.setFromCamera(m, IS3.cam); const hit = IS3.ray.intersectObject(IS3.grid)[0]; if (!hit) return null;
  return [Math.floor(hit.point.x + IS3.N / 2), Math.floor(hit.point.z + IS3.N / 2)];
}
function is3ghostAt(e) {
  const P = ui.isPlace, t = is3tile(e); if (!P || !t) return;
  const at = [Math.max(0, Math.min(IS3.N - P.sz, t[0] - Math.floor(P.sz / 2))), Math.max(0, Math.min(IS3.N - P.sz, t[1] - Math.floor(P.sz / 2)))];
  if (P.hov && P.hov[0] === at[0] && P.hov[1] === at[1]) return;
  P.hov = at; is3ghost(at, P.sz, isFits(P.L, P.id, P.sz, ...at)); is3draw();
}
function is3ghost(at, sz, ok) {
  const g = IS3.ghost; if (!at) { g.visible = false; return; }
  g.visible = true; g.scale.set(sz - .1, 1, sz - .1); g.position.set(at[0] + sz / 2 - IS3.N / 2, IS3.top + .25, at[1] + sz / 2 - IS3.N / 2);
  g.material.color.set(ok ? '#51cf66' : '#fa5252');
}
function is3tap(e) {
  const t = is3tile(e), P = ui.isPlace;
  if (P) {
    if (!t) return;
    const at = [Math.max(0, Math.min(IS3.N - P.sz, t[0] - Math.floor(P.sz / 2))), Math.max(0, Math.min(IS3.N - P.sz, t[1] - Math.floor(P.sz / 2)))];
    P.at = at; P.ok = isFits(P.L, P.id, P.sz, ...at); is3ghost(at, P.sz, P.ok); is3draw();
    const b = document.getElementById('isPlaceOk'); if (b) b.disabled = !P.ok; return;
  }
  if (IS3.house === 'boss') { ui.isPanel = ui.isPanel ? null : 'binfo'; render(); return; }
  const L = IS3.layout; if (!L || !t) { if (ui.isSel) { ui.isSel = null; render(); } return; }
  const o = L.items.find(o => o.at && t[0] >= o.at[0] && t[0] < o.at[0] + o.sz && t[1] >= o.at[1] && t[1] < o.at[1] + o.sz);
  const [cx, cz, cs] = L.centre, centre = t[0] >= cx && t[0] < cx + cs && t[1] >= cz && t[1] < cz + cs;
  const sel = o ? o.id : null;
  if (centre && !o) { ui.isSel = null; ui.isPanel = IS3.house ? 'hall' : 'help'; render(); return; }
  if (sel !== ui.isSel || ui.isPanel) { ui.isSel = sel; ui.isPanel = null; render(); }
}
function mountIsland3D() {
  const host = document.getElementById('is3host');
  if (!host || typeof webglOK !== 'function' || !webglOK()) return;
  is3init();
  if (IS3.canvas.parentNode !== host) { host.prepend(IS3.canvas); IS3.sz = ''; }
  is3resize();
  if (ui.isTab === 'boss') {
    if (IS3.house !== 'boss') { IS3.house = 'boss'; Object.assign(IS3, is3home('boss')); }
    IS3.layout = null; IS3.grid = null; const sig = 'b' + biSig();
    if (sig !== IS3.sig) { IS3.sig = sig; is3bossBuild(); }
    is3ghost(null); is3draw(); return;
  }
  const house = ui.isTab === 'house' && typeof hiLayout === 'function' && HI.doc, L = house ? hiLayout() : isLayout();
  const cond = house ? hiCond : isCond, lvOf = house ? (id => hiLvOn(HI.doc.b?.[id])) : (id => isLvOn(isState().items[id]));
  const sig = (house ? 'h' + hsState().id + hiLevel() + 't' + biTrophies().length : 'p' + isLv()) + L.items.map(o => o.id + ':' + (cond(o.id) || '') + lvOf(o.id) + (o.at || []).join('.')).join();
  if (!!house !== IS3.house) { IS3.house = !!house; Object.assign(IS3, is3home(IS3.house)); }
  IS3.layout = L;
  if (sig !== IS3.sig) { IS3.sig = sig; is3build(!!house, L); }
  const P = ui.isPlace; is3ghost(P ? P.at : null, P?.sz, P ? isFits(P.L, P.id, P.sz, ...P.at) : true);
  is3draw();
}
// shared low-poly materials, made once
const is3mat = (col, glow) => { const k = col + (glow ? '*' : ''); return (IS3.mats = IS3.mats || {})[k] || (IS3.mats[k] = new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: .9, ...(glow ? { emissive: col, emissiveIntensity: .8 } : {}) })); };
function is3mesh(geo, col, x = 0, y = 0, z = 0, g, glow) { const m = new THREE.Mesh(geo, is3mat(col, glow)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = !glow; if (g) g.add(m); return m; }
const is3shade = (col, f) => '#' + new THREE.Color(col).multiplyScalar(f).getHexString();
// a low-poly rock: a solid with its corners pushed about a bit
// (2.53: corners that share a spot move together, so the faces stay joined and you can't see through the seams;
// keep = how much of the bottom (before flipping) stays flat so it meets the island)
function is3rock(geo, rnd, amt, keep = 0) {
  const p = geo.attributes.position, moved = new Map(); geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, h = geo.boundingBox.max.y - y0 || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!moved.has(k)) { const t = keep ? Math.min(1, Math.max(0, (y - y0) / h - keep) / (1 - keep)) : 1; moved.set(k, [1 + (rnd() - .5) * amt * t, 1 + (rnd() - .5) * amt * t, 1 + (rnd() - .5) * amt * t]); }
    const m = moved.get(k); p.setXYZ(i, x * m[0], y * m[1], z * m[2]);
  }
  geo.computeVertexNormals(); return geo;
}
// the lawn: a checked grid texture, one tile per unit
function is3gridTex(N) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#69b84a' : '#72c152'; x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = 'rgba(30,60,20,.22)'; x.lineWidth = 2; for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(128, i * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(N / 2, N / 2); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function is3clear() { IS3.world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material?.map) o.material.map.dispose(); }); IS3.world.clear(); IS3.marks = {}; }
function is3build(house, L) {
  if (house === 'boss') return is3bossBuild();
  const W = IS3.world, N = L.N, M = house ? 3 : 2, S = N + M * 2, top = IS3.top = .3;
  const ITEMS = house ? HI_ITEMS : IS_ITEMS, cond = house ? hiCond : isCond;
  is3clear(); IS3.N = N;
  const rnd = seeded(house ? 'solis-house-' + hsState().id : 'solis-island');
  Object.assign(IS3.sun.shadow.camera, { left: -S * .75, right: S * .75, top: S * .75, bottom: -S * .75 }); IS3.sun.shadow.camera.updateProjectionMatrix();
  is3base(W, S, top, rnd, house ? 1.6 : 1);
  // the grid itself (also what taps land on)
  const grid = IS3.grid = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshStandardMaterial({ map: is3gridTex(N), roughness: 1 }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = top + .005; grid.receiveShadow = true; W.add(grid);
  // the border: trees, rocks, flowers and lamps, so the edge doesn't feel empty
  const edge = [];
  for (let i = 0; i < (house ? 70 : 34); i++) { const sd = Math.floor(rnd() * 4), t = (rnd() - .5) * (S - .8), d = S / 2 - .3 - rnd() * (M - .5); edge.push(sd === 0 ? [t, d] : sd === 1 ? [t, -d] : sd === 2 ? [d, t] : [-d, t]); }
  const tro = house && typeof biTrophies === 'function' ? biTrophies().slice(0, 12) : [], troZ = N / 2 + M / 2;
  for (const [x, z] of edge) { if (tro.length && z > N / 2 + .3 && Math.abs(x) < tro.length * .9 + .6) continue; // leave the trophy row clear
    const k = rnd(), g = new THREE.Group(); g.position.set(x, top, z);
    if (k < .45) is3tree(g, rnd, 0, 0, .8 + rnd() * .5);
    else if (k < .65) is3mesh(is3rock(new THREE.DodecahedronGeometry(.3 + rnd() * .35, 0), rnd, .3), '#909aa3', 0, .15, 0, g);
    else if (k < .85) is3mesh(new THREE.IcosahedronGeometry(.3 + rnd() * .25, 0), rnd() < .5 ? '#40a447' : '#2b8a3e', 0, .2, 0, g);
    else { is3mesh(new THREE.CylinderGeometry(.03, .03, .35, 3), '#2b8a3e', 0, .17, 0, g); is3mesh(new THREE.OctahedronGeometry(.12, 0), ['#ffd43b', '#f783ac', '#ffffff'][Math.floor(rnd() * 3)], 0, .4, 0, g); }
    W.add(g); }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const g = new THREE.Group(); g.position.set(sx * (S / 2 - M / 2), top, sz * (S / 2 - M / 2)); is3mesh(new THREE.CylinderGeometry(.08, .1, 1.6, 5), '#4a4458', 0, .8, 0, g); is3mesh(new THREE.OctahedronGeometry(.22, 0), '#ffd86b', 0, 1.75, 0, g, true); W.add(g); }
  // grass tufts scattered over the lawn's margin
  for (let i = 0; i < (house ? 60 : 30); i++) { const sd = Math.floor(rnd() * 4), t = (rnd() - .5) * (S - .6), d = S / 2 - .2 - rnd() * (M - .3), [x, z] = sd === 0 ? [t, d] : sd === 1 ? [t, -d] : sd === 2 ? [d, t] : [-d, t]; is3mesh(new THREE.ConeGeometry(.07, .22 + rnd() * .15, 3), rnd() < .5 ? '#4f9a37' : '#7cc95a', x, top + .1, z, W).castShadow = false; }
  // trophies: every boss the house has beaten, in gold on a plinth along the front
  tro.forEach((t, i) => { const g = new THREE.Group(); g.position.set((i - (tro.length - 1) / 2) * 1.8, top, troZ); is3mesh(new THREE.BoxGeometry(1.1, .45, 1.1), '#c9c2b5', 0, .22, 0, g); is3mesh(new THREE.BoxGeometry(1.2, .08, 1.2), '#ffd43b', 0, .47, 0, g, true); const m = new THREE.Group(); m.position.y = .5; m.scale.setScalar(.28); m.rotation.y = (i % 3 - 1) * .25; is3bossModel(m, t.n, 'gold'); g.add(m); W.add(g); });
  // the middle: the Solis orb on your island, the house hall on the house island
  const [cx, cz, cs] = L.centre, cg = new THREE.Group(); cg.position.set(cx + cs / 2 - N / 2, top, cz + cs / 2 - N / 2); W.add(cg);
  if (house) is3hall(cg, hsHouse(hsState().id), hiLevel()); else is3orb(cg, isLv());
  // buildings on their spots, each on a stone pad
  for (const o of L.items) {
    const it = ITEMS.find(x => x.id === o.id), c = cond(o.id); if (!it || !o.at || !c) continue;
    const x = o.at[0] + o.sz / 2 - N / 2, z = o.at[1] + o.sz / 2 - N / 2, g = new THREE.Group(); g.position.set(x, top, z);
    is3mesh(new THREE.BoxGeometry(o.sz - .15, .12, o.sz - .15), '#a39a8a', 0, .06, 0, g);
    const lv = house ? hiLvOn(HI.doc.b?.[o.id]) : isLvOn(isState().items[o.id]), k = o.sz / 2 * (1 + (lv - 1) * .07);
    IS3.marks[o.id] = [x, top + 2.4 * k + .4, z];
    const b = new THREE.Group(); b.position.y = .12; b.scale.setScalar(k); g.add(b);
    if (c === 'build') { const sc = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 1.8), new THREE.MeshBasicMaterial({ color: '#c08a52', wireframe: true })); sc.position.y = 1; b.add(sc); is3mesh(new THREE.BoxGeometry(.6, .6, .6), '#b07d48', .5, .3, .5, b); is3mesh(new THREE.BoxGeometry(.4, .4, .4), '#c99a62', -.5, .2, -.4, b); W.add(g); continue; }
    const f = c === 'ok' ? 1 : c === 'worn' ? .72 : .5;
    is3model(it, b, f);
    // level flag: none at 1, silver at 2, gold at 3
    if (lv > 1) { is3mesh(new THREE.CylinderGeometry(.03, .03, 1, 4), '#dee2e6', o.sz / 2 - .25, .6, o.sz / 2 - .25, g); is3mesh(new THREE.BoxGeometry(.32, .2, .03), lv >= 3 ? '#ffd43b' : '#ced4da', o.sz / 2 - .08, 1, o.sz / 2 - .25, g, lv >= 3); }
    if (c !== 'ok') { b.rotation.z = c === 'worn' ? .06 : .16; b.position.y = .12 - Math.sin(b.rotation.z) * .85 * k; } // sink the low side in, so the tilt doesn't open a gap underneath
    if (c === 'broken') for (let j = 0; j < 4; j++) is3mesh(new THREE.DodecahedronGeometry(.18, 0), is3shade(it.col, .5), (rnd() - .5) * 2, .1, (rnd() - .5) * 2, b);
    W.add(g);
  }
}
// the floating rock every island sits on: turf lip, grass, layered earth, a craggy underside with glowing
// crystals and hanging roots, and little islets drifting round it. pal changes the colours (the boss island is stone).
function is3base(W, S, top, rnd, big = 1, pal = {}) {
  const P = Object.assign({ turf: '#5fae43', lip: '#4f9a37', dirt: '#8a6744', dirt2: '#74563a', rock: '#6d5f73', rock2: '#5d5066', rock3: '#7a6c7e', crys: ['#4ee6ff', '#ffb347'], root: '#4a6b2f', tree: true }, pal);
  is3mesh(new THREE.BoxGeometry(S, .5, S), P.turf, 0, top - .25, 0, W);
  is3mesh(new THREE.BoxGeometry(S + .14, .16, S + .14), P.lip, 0, top - .42, 0, W); // a slightly wider turf lip, so the edge reads
  is3mesh(new THREE.BoxGeometry(S - .1, .7, S - .1), P.dirt, 0, top - .85, 0, W);
  is3mesh(new THREE.BoxGeometry(S - .3, .6, S - .3), P.dirt2, 0, top - 1.45, 0, W);
  // the underside: a square craggy point whose top stays flat under the earth (no gaps where they meet)
  const H = S * .75, und = is3mesh(is3rock(new THREE.ConeGeometry(S * .69, H, 4, 6), rnd, .26, .12), P.rock, 0, top - 1.7 - H / 2, 0, W); und.rotation.set(Math.PI, Math.PI / 4, 0);
  for (let i = 0; i < Math.round(8 * big); i++) { const a = rnd() * 6.28, r = S * (.12 + rnd() * .26), s = .8 + rnd() * 1.6; const k = is3mesh(is3rock(new THREE.DodecahedronGeometry(s, 0), rnd, .35), rnd() < .5 ? P.rock2 : P.rock3, Math.cos(a) * r, top - 2.2 - rnd() * S * .38, Math.sin(a) * r, W); k.scale.y = 1.6; }
  for (let i = 0; i < Math.round(7 * big); i++) { const a = rnd() * 6.28, r = S * (.1 + rnd() * .22), h = .8 + rnd() * 1.8; const cr = is3mesh(new THREE.ConeGeometry(.25 + rnd() * .25, h, 5), P.crys[i % P.crys.length], Math.cos(a) * r, top - 2.6 - rnd() * S * .3, Math.sin(a) * r, W, true); cr.rotation.z = Math.PI; }
  // roots and vines hanging over the edge
  for (let i = 0; i < Math.round(14 * big); i++) {
    const sd = i % 4, t = (rnd() - .5) * (S - 1), d = S / 2 - .12, h = .6 + rnd() * 1.6, x = sd === 0 ? t : sd === 1 ? t : sd === 2 ? d : -d, z = sd === 0 ? d : sd === 1 ? -d : t;
    const v = is3mesh(new THREE.BoxGeometry(sd > 1 ? .08 : .12, h, sd > 1 ? .12 : .08), P.root, x, top - .4 - h / 2, z, W); v.rotation[sd > 1 ? 'x' : 'z'] = (rnd() - .5) * .3;
  }
  // little rocks drifting around the island
  const n = Math.round(6 * big);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + rnd(), r = S * (.85 + rnd() * .5), y = -3 + rnd() * 6, s = .5 + rnd() * big, g = new THREE.Group(); g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    // flipped round z so its corners line up with the cap on top
    is3mesh(is3rock(new THREE.ConeGeometry(s, s * 1.8, 5, 2), rnd, .3, .3), P.rock, 0, -s * .9 - .12, 0, g).rotation.z = Math.PI; is3mesh(new THREE.CylinderGeometry(s * 1.04, s, .25, 5), P.turf, 0, 0, 0, g);
    if (P.tree && rnd() < .6) is3tree(g, rnd, 0, 0, .7); else if (!P.tree) is3mesh(new THREE.ConeGeometry(.12 + s * .15, .5 + s * .4, 5), P.crys[i % P.crys.length], 0, .3, 0, g, true);
    W.add(g);
  }
}
function is3tree(g, rnd, x, z, s) {
  is3mesh(new THREE.CylinderGeometry(.07 * s, .11 * s, .7 * s, 5), '#7a5136', x, .35 * s, z, g);
  if (rnd() < .5) { is3mesh(new THREE.ConeGeometry(.45 * s, .9 * s, 6), '#2f9e44', x, 1 * s, z, g); is3mesh(new THREE.ConeGeometry(.33 * s, .7 * s, 6), '#37b24d', x, 1.45 * s, z, g); }
  else is3mesh(new THREE.IcosahedronGeometry(.5 * s, 0), rnd() < .3 ? '#f08c00' : '#40a447', x, 1.05 * s, z, g);
}
// your island's centre: a glowing Solis orb on a pedestal, with a ring for every 5 levels
function is3orb(g, lv) {
  is3mesh(new THREE.CylinderGeometry(.9, 1, .3, 8), '#9aa1b0', 0, .15, 0, g); is3mesh(new THREE.CylinderGeometry(.35, .5, 1.2, 6), '#b8bfcc', 0, .9, 0, g);
  is3mesh(new THREE.IcosahedronGeometry(.48, 1), '#ffb347', 0, 1.95, 0, g, true);
  for (let i = 0; i < Math.min(3, 1 + Math.floor(lv / 5)); i++) { const r = is3mesh(new THREE.TorusGeometry(.75 + i * .18, .035, 4, 16), '#ffe8a3', 0, 1.95, 0, g, true); r.rotation.set(1.2 + i * .5, i * .9, 0); }
}
// the house island's centre: a great hall in the house colour that grows with the house level
function is3hall(g, h, hl) {
  const col = h?.col || '#ffd43b', st = '#c9c2b5';
  is3mesh(new THREE.BoxGeometry(3.8, .5, 3.8), '#a39a8a', 0, .25, 0, g);
  const tiers = Math.min(4, 1 + Math.floor(hl / 3));
  for (let i = 0; i < tiers; i++) is3mesh(new THREE.BoxGeometry(2.8 - i * .55, 1.1, 2.8 - i * .55), i % 2 ? is3shade(st, .9) : st, 0, 1.05 + i * 1.1, 0, g);
  const ry = .5 + tiers * 1.1; is3mesh(new THREE.ConeGeometry((2.8 - (tiers - 1) * .55) * .8, 1.3, 4), col, 0, ry + .65, 0, g).rotation.y = Math.PI / 4;
  is3mesh(new THREE.OctahedronGeometry(.25, 0), '#ffe8a3', 0, ry + 1.55, 0, g, true);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { is3mesh(new THREE.CylinderGeometry(.3, .35, 2.4, 6), st, dx, 1.2, dz, g); is3mesh(new THREE.ConeGeometry(.42, .7, 6), col, dx, 2.75, dz, g); }
  for (const s of [-1, 1]) { is3mesh(new THREE.BoxGeometry(.6, 1, .04), col, s * .8, 1.4, 1.42, g); }
  is3mesh(new THREE.BoxGeometry(.7, .9, .05), '#5c3d2e', 0, .95, 1.42, g);
}
function is3model(it, g, f) {
  const C = is3shade(it.col, f), D2 = is3shade('#6b4c33', f), S = is3shade('#adb5bd', f);
  const B = (w, h, d, col, x, y, z) => is3mesh(new THREE.BoxGeometry(w, h, d), col, x, y, z, g);
  const Cy = (rt, rb, h, col, x, y, z, s = 7) => is3mesh(new THREE.CylinderGeometry(rt, rb, h, s), col, x, y, z, g);
  const Co = (r, h, col, x, y, z, s = 4) => is3mesh(new THREE.ConeGeometry(r, h, s), col, x, y, z, g);
  switch (it.m) {
    case 'hut': B(1.6, 1.1, 1.4, C, 0, .55, 0); Co(1.3, .9, is3shade('#8f3b1b', f), 0, 1.55, 0).rotation.y = Math.PI / 4; B(.35, .6, .05, D2, 0, .3, .72); break;
    case 'fire': for (let j = 0; j < 4; j++) B(.9, .15, .15, D2, 0, .08, 0).rotation.y = j * .8; is3mesh(new THREE.ConeGeometry(.35, .8, 5), is3shade('#ff922b', f), 0, .5, 0, g, f === 1); Co(.2, .55, is3shade('#ffd43b', f), 0, .5, 0, 5); for (let j = 0; j < 5; j++) is3mesh(new THREE.DodecahedronGeometry(.16, 0), S, Math.cos(j * 1.26) * .6, .05, Math.sin(j * 1.26) * .6, g); break;
    case 'shrine': B(1.6, .15, .2, C, 0, 1.5, 0); B(1.3, .1, .15, C, 0, 1.2, 0); Cy(.08, .08, 1.5, C, -.55, .75, 0, 5); Cy(.08, .08, 1.5, C, .55, .75, 0, 5); B(.5, .3, .5, S, 0, .15, -.6); break;
    case 'forge': B(1.6, 1, 1.3, is3shade('#495057', f), 0, .5, 0); B(.4, 1.2, .4, S, .5, 1.4, -.3); is3mesh(new THREE.BoxGeometry(.5, .3, .3), is3shade('#ff6b00', f), 0, .45, .66, g, f === 1); break;
    case 'light': for (let j = 0; j < 4; j++) Cy(.55 - j * .07, .6 - j * .07, .7, j % 2 ? is3shade('#e03131', f) : C, 0, .35 + j * .7, 0, 8); is3mesh(new THREE.CylinderGeometry(.4, .4, .4, 8), is3shade('#ffe066', f), 0, 3, 0, g, f === 1); Co(.5, .5, is3shade('#e03131', f), 0, 3.45, 0, 8); break;
    case 'tower': for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) Cy(.07, .09, 2.2, D2, dx, 1.1, dz, 4); B(1.4, .15, 1.4, C, 0, 2.2, 0); Co(1.1, .7, is3shade('#8f3b1b', f), 0, 2.65, 0).rotation.y = Math.PI / 4; break;
    case 'wall': for (let j = -1; j <= 1; j++) B(.9, .8, .5, j ? C : is3shade(it.col, f * .85), j * .92, .4, 0); for (let j = -1; j <= 1; j++) B(.3, .25, .5, C, j * .92, .92, 0); break;
    case 'mill': Cy(.5, .75, 2, C, 0, 1, 0, 6); Co(.65, .6, is3shade('#8f3b1b', f), 0, 2.3, 0, 6); for (let j = 0; j < 4; j++) { const b = B(.18, 1.4, .05, D2, 0, 1.8, .6); b.rotation.z = j * Math.PI / 2 + .3; b.position.x = Math.sin(j * Math.PI / 2 + .3) * -.7; b.position.y = 1.8 + Math.cos(j * Math.PI / 2 + .3) * .7; } break;
    case 'spring': Cy(1, 1, .25, S, 0, .12, 0, 9); Cy(.8, .8, .28, C, 0, .14, 0, 9); for (let j = 0; j < 3; j++) is3mesh(new THREE.IcosahedronGeometry(.15, 0), '#ffffff', (j - 1) * .3, .55 + j * .15, 0, g); break;
    case 'dome': Cy(.9, .9, .8, is3shade('#dee2e6', f), 0, .4, 0, 8); is3mesh(new THREE.SphereGeometry(.85, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, .8, 0, g); Cy(.12, .16, .9, D2, .3, 1.5, 0, 5).rotation.z = -.8; break;
    case 'totem': for (let j = 0; j < 3; j++) B(.6 - j * .05, .55, .6 - j * .05, j % 2 ? is3shade('#2b8a3e', f) : C, 0, .3 + j * .56, 0); B(1.2, .12, .25, is3shade('#e8590c', f), 0, 1.3, 0); break;
    case 'vault': B(1.4, .7, 1.4, is3shade('#868e96', f), 0, .35, 0); B(1.2, .12, 1.2, is3shade('#495057', f), 0, .76, 0); is3mesh(new THREE.OctahedronGeometry(.45, 0), C, 0, 1.35, 0, g, f === 1); for (const s of [-1, 1]) B(.12, .5, 1.42, is3shade('#ced4da', f), s * .5, .35, 0); break;
  }
}
