'use strict';
/* 2.25 forest: trees no longer grow on their own. A tree is as big as its
   session was long, and the only way up is merging: drop a tree on another of
   the same kind and stage and they become one tree a stage bigger. The garden
   holds a limited number of trees; the rest live on the Archive island, which
   keeps every study block you've ever done (archived trees don't merge).
   Also here: study streak bonuses and the reforge bench. */

const FOREST2_START = '2026-10-27';
const gardenCap = () => 36 + 8 * upg('land') + 2 * lupg('seedbank');
const logById = id => D.focusLogs.find(l => l.id === id);
const setRec = (id, patch) => { D.game.trees[id] = { ...treeRec(id), ...patch }; };
const inGarden = l => !!l && l.mins >= 10 && !treeRec(l.id).arch && !treeRec(l.id).into;
const gardenLogs = () => D.focusLogs.filter(inGarden);
function canMerge(a, b) {
  const A = logById(a), B = logById(b);
  return !!(A && B && A !== B && inGarden(A) && inGarden(B) && !A.withered && !B.withered && speciesFor(A.subjectId) === speciesFor(B.subjectId) && treeStageOf(A) === treeStageOf(B) && treeStageOf(A) < TREE_STAGES.length - 1);
}
const mergePartner = l => gardenLogs().find(x => x.id !== l.id && canMerge(l.id, x.id));
// chance that a merge skips a stage: the old growth buffs feed this now
const mergeLuck = l => Math.min(.5, activeBuff('growAll') + .04 * lupg('sundial') + (crit('turtle') ? .05 : 0) + Math.max(0, (treeSpeciesBuff(l).grow || 1) - 1));
function mergeTrees(targetId, srcId, quiet) {
  if (!canMerge(targetId, srcId)) return 0;
  const T = logById(targetId), st = treeStageOf(T);
  const jump = st + 2 < TREE_STAGES.length && Math.random() < mergeLuck(T) ? 2 : 1;
  setRec(targetId, { up: st + jump - treeStage(T.mins), merged: (treeRec(targetId).merged || 0) + 1 + (treeRec(srcId).merged || 0), stage: st + jump });
  setRec(srcId, { into: targetId });
  if (D.game.gridPos) delete D.game.gridPos[srcId];
  D.game.merges = (D.game.merges || 0) + 1;
  save();
  if (typeof mythicOnMerge === 'function') setTimeout(() => mythicOnMerge(st + jump), quiet ? 0 : 1200);
  if (!quiet) {
    try { stageSfx(st + jump); } catch { }
    toast(`${STAGE_ICON[st + jump]} Merged into ${/^[AEIOU]/.test(TREE_STAGES[st + jump][1]) ? 'an' : 'a'} ${TREE_STAGES[st + jump][1].toLowerCase()}!`, jump > 1 ? 'Lucky merge: it skipped a whole stage.' : `${treeName(T)} is bigger, and grows more leaves.`);
  }
  return jump;
}
function mergeAll() {
  let n = 0, best = 0;
  for (let guard = 0; guard < 500; guard++) {
    const groups = {};
    for (const l of gardenLogs()) { if (l.withered) continue; const st = treeStageOf(l); if (st >= TREE_STAGES.length - 1) continue; (groups[speciesFor(l.subjectId) + ':' + st] = groups[speciesFor(l.subjectId) + ':' + st] || []).push(l); }
    const pair = Object.values(groups).find(g => g.length >= 2); if (!pair) break;
    pair.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    if (mergeTrees(pair[0].id, pair[1].id, true)) { n++; best = Math.max(best, treeStageOf(pair[0])); }
  }
  if (!n) { toast('Nothing to merge', 'Merging needs two garden trees of the same kind and stage.'); return; }
  try { stageSfx(best); } catch { }
  toast(`🔀 ${n} merge${n === 1 ? '' : 's'}`, `Your biggest is now ${/^[AEIOU]/.test(TREE_STAGES[best][1]) ? 'an' : 'a'} ${TREE_STAGES[best][1].toLowerCase()}. ${gardenCap() - gardenLogs().length} spaces free in the garden.`);
  render();
}
const mergeablePairs = () => { const c = {}; for (const l of gardenLogs()) if (!l.withered && treeStageOf(l) < TREE_STAGES.length - 1) { const k = speciesFor(l.subjectId) + ':' + treeStageOf(l); c[k] = (c[k] || 0) + 1; } return Object.values(c).reduce((a, n) => a + Math.floor(n / 2), 0); };
// the garden is full: the oldest unmerged trees go to the archive island
function enforceGardenCap() {
  if (!D.game.forest2) { D.game.forest2 = 1; for (const r of Object.values(D.game.trees || {})) delete r.water; } // growth from before 2.25 is undone
  const g = gardenLogs(), extra = g.length - gardenCap(); if (extra <= 0) return;
  g.sort((a, b) => (treeRec(a.id).up || 0) - (treeRec(b.id).up || 0) || String(a.start).localeCompare(String(b.start))).slice(0, extra).forEach(l => setRec(l.id, { arch: true }));
  save();
  toast('🏝️ Trees moved to the Archive island', `Your garden holds ${gardenCap()} trees, so ${extra} older one${extra === 1 ? '' : 's'} moved there. Merge trees to make room.`, { timeout: 12000 });
}
// 2.29: archiving is one way. The Archive island is your study log now: archived
// trees don't grow leaves or merge, and can't go back to the garden.
function archiveTree(id, on) {
  if (!on) return false;
  setRec(id, { arch: true }); if (D.game.gridPos) delete D.game.gridPos[id]; save(); return true;
}
function archiveView() {
  const all = D.focusLogs.filter(l => l.mins >= 10).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const num = new Map(all.map((l, i) => [l.id, i + 1]));
  const f = ui.archSubj || 'all', list = all.filter(l => f === 'all' || l.subjectId === f).reverse();
  const shown = ui.archAll ? list : list.slice(0, 300), months = {};
  for (const l of shown) (months[l.date.slice(0, 7)] = months[l.date.slice(0, 7)] || []).push(l);
  const hrs = list.reduce((a, l) => a + l.mins, 0), inG = all.filter(inGarden).length;
  const chip = (v, label, color) => `<button class="cchip ${f === v ? 'on' : ''}" data-f2="archSubj" data-v="${v}" ${color ? `style="--c:${color}"` : ''}>${label}</button>`;
  const hm = iso => { const d = new Date(iso); return isNaN(d) ? '' : fmtTime(d.toTimeString().slice(0, 5)); };
  const row = l => { const r = treeRec(l.id), s = subj(l.subjectId), sess = l.sessionId && D.sessions.find(x => x.id === l.sessionId);
    const where = r.into ? ['merged', '🔀', 'Merged into a bigger tree'] : r.arch ? ['arch', '🏝️', 'Archived'] : inGarden(l) ? ['garden', '🌳', 'In your garden'] : ['arch', '🏝️', 'Archived'];
    return `<div class="alog ${where[0]}" style="--c:${s.color}"><span class="alog-n">#${num.get(l.id)}</span><span class="alog-when"><b>${DOW[parseYmd(l.date).getDay()]} ${parseYmd(l.date).getDate()}</b> ${hm(l.start)}</span>
      <span class="alog-subj">${esc(s.name || 'Study')}</span><span class="alog-topic">${sess ? esc(String(sess.topic || '').replace(/^Revise: /, '')) : ''}${l.withered ? ' <span class="muted">· withered</span>' : ''}</span>
      <span class="alog-len">${fmtMins(l.mins)}</span><span class="alog-st" title="${where[2]}">${where[1]}</span></div>`; };
  return `<div class="card archcard"><div class="card-head"><h2>🏝️ Archive island</h2><span class="muted small-text">your log of every study session · ${all.length} sessions · ${fmtMins(all.reduce((a, l) => a + l.mins, 0))} · ${inG}/${gardenCap()} trees in your garden</span></div>
    <p class="muted small-text" style="margin-top:0">Every session you've done, newest first and numbered in the order you did them. 🌳 is still in your garden, 🔀 was merged into a bigger tree, 🏝️ is archived. Archived trees are kept here for the record: they don't grow leaves and can't go back to the garden.</p>
    <div class="catchips">${chip('all', 'All')}${D.subjects.map(s => chip(s.id, esc(s.name), s.color)).join('')}</div>
    ${f !== 'all' ? `<p class="small-text" style="margin:8px 0 0"><b>${list.length}</b> sessions · <b>${fmtMins(hrs)}</b> of ${esc(subj(f).name)}</p>` : ''}
    <div class="alogs">${Object.entries(months).map(([m, ls]) => `<div class="archm-head">${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)} <span>${ls.length} sessions · ${fmtMins(ls.reduce((a, l) => a + l.mins, 0))}</span></div>${ls.map(row).join('')}`).join('') || '<div class="empty">No study sessions yet. Start the focus timer and every session of 10+ minutes lands here.</div>'}</div>
    ${list.length > shown.length ? `<button class="btn" data-f2="archAll">Show all ${list.length}</button>` : ''}</div>`;
}

// ---------- study streak bonus ----------
const STREAK_TIERS = [[30, .3], [14, .2], [7, .1], [3, .05]];
let _dm = null, _dmKey = '';
function dayMinsCached() { const k = D.focusLogs.length + ':' + (D.focusLogs[D.focusLogs.length - 1] || {}).id; if (k !== _dmKey) { _dm = dailyMins(); _dmKey = k; } return _dm; }
function streakAt(day) { const m = dayMinsCached(); let n = m[day] >= 30 ? 1 : 0, d = addDays(day, -1); while (m[d] >= 30 && n < 400) { n++; d = addDays(d, -1); } return n; }
const streakTier = n => (STREAK_TIERS.find(([k]) => n >= k) || [0, 0])[1];
const streakBonus = l => l && String(l.date) >= FOREST2_START ? streakTier(streakAt(l.date)) : 0;
function streakPill() {
  const n = studyStreak(), b = streakTier(n), next = [...STREAK_TIERS].reverse().find(([k]) => n < k);
  return `<span class="streakpill ${b ? 'on' : ''}" title="Study 30+ minutes a day to keep a streak. 3 days +5%, 7 days +10%, 14 days +20%, 30 days +30% coins and XP from study.">🔥 ${n}-day streak${b ? ` · <b>+${Math.round(b * 100)}%</b> coins &amp; XP` : ''}${next ? ` <small>· +${Math.round(next[1] * 100)}% at ${next[0]} days</small>` : ''}</span>`;
}

// ---------- reforge ----------
const TIERS = ['common', 'rare', 'epic', 'legendary'];
const REFORGE_FEE = { common: 40, rare: 100, epic: 220, legendary: 450 };
function reforgeables() {
  const out = [];
  for (const i of ITEMS) { const n = D.game.items[i.id] || 0; if (n > 0 && i.id !== 'scene_meadow' && i.rarity !== 'mythic') out.push({ kind: 'item', id: i.id, name: i.name, rarity: i.rarity, n, group: { tree: '🌳 Trees', animal: '🦔 Animals', deco: '🏡 Decorations', scene: '🌅 Scenes' }[i.type] || '🌳 Forest', type: i.type, art: itemIcon(i, 44) }); }
  if (typeof COSMETICS !== 'undefined') { const av = myAv(); for (const c of COSMETICS) if ((c.coins || c.grit) && (D.arena.owned || {})[c.id] && av[c.cat] !== c.id) out.push({ kind: 'cos', id: c.id, name: c.name, rarity: priceRarity((c.coins || 0) + (c.grit || 0) * 1.2, [100, 200, 450]), n: 1, group: '👕 Avatar cosmetics', type: c.cat, art: '<span class="rfic">👕</span>' }); }
  if (typeof HELD !== 'undefined' && D.arena2) for (const h of HELD) { const n = (D.arena2.held || {})[h.id] || 0; if (n > 0) out.push({ kind: 'held', id: h.id, name: h.name, rarity: TIERS[Math.min(3, h.tier - 1)], n, group: '⚔️ Arena items', type: 'held', art: `<span class="rfic">${h.icon}</span>` }); }
  return out;
}
function reforgePool(x) {
  if (x.kind === 'item') return ITEMS.filter(i => i.type === x.type && i.id !== x.id && i.rarity !== 'mythic').map(i => ({ id: i.id, name: i.name, rarity: i.rarity, own: owned(i.id) }));
  if (x.kind === 'cos') return COSMETICS.filter(c => c.cat === x.type && c.id !== x.id && (c.coins || c.grit)).map(c => ({ id: c.id, name: c.name, rarity: priceRarity((c.coins || 0) + (c.grit || 0) * 1.2, [100, 200, 450]), own: ownsCos(c.id) }));
  return HELD.filter(h => h.id !== x.id).map(h => ({ id: h.id, name: h.name, rarity: TIERS[Math.min(3, h.tier - 1)], own: !!(D.arena2.held || {})[h.id] }));
}
function reforge(kind, id) {
  const x = reforgeables().find(r => r.kind === kind && r.id === id); if (!x) return;
  const fee = REFORGE_FEE[x.rarity], pool = reforgePool(x);
  if (!pool.length) { toast('Nothing to reforge into', 'There are no other items of this kind yet.'); return; }
  if (coins() < fee) { toast('Not enough coins', `Reforging costs ${fee} ${COIN}.`); return; }
  if (!confirm(`Reforge ${x.name}? It's used up${x.n > 1 ? ' (one copy)' : ''} and turns into a random ${x.kind === 'item' ? x.type : x.kind === 'cos' ? 'cosmetic' : 'item'} of the same rarity, with a 12% chance of the next rarity up. Costs ${fee} ${COIN}.`)) return;
  const up = Math.random() < .12 && x.rarity !== 'legendary' ? TIERS[TIERS.indexOf(x.rarity) + 1] : x.rarity;
  let cand = pool.filter(p => p.rarity === up && !p.own); if (!cand.length) cand = pool.filter(p => p.rarity === up);
  if (!cand.length) cand = pool.filter(p => p.rarity === x.rarity && !p.own); if (!cand.length) cand = pool.filter(p => !p.own); if (!cand.length) cand = pool;
  const got = cand[Math.floor(Math.random() * cand.length)];
  D.game.spent += fee;
  if (kind === 'item') { D.game.items[id]--; if (D.game.items[id] <= 0) delete D.game.items[id]; D.game.items[got.id] = (D.game.items[got.id] || 0) + 1; }
  else if (kind === 'cos') { delete D.arena.owned[id]; D.arena.owned[got.id] = true; }
  else { const H = D.arena2.held; H[id]--; if (H[id] <= 0) delete H[id]; H[got.id] = (H[got.id] || 0) + 1; }
  D.game.reforged = (D.game.reforged || 0) + 1;
  save(); render();
  const it = kind === 'item' ? itemById(got.id) : null;
  celebrate({ icon: it ? itemIcon(it, 90) : '<span class="critbig">🔨</span>', color: RARITY[got.rarity].color, kicker: up !== x.rarity ? 'Lucky reforge: it went up a rarity!' : 'Reforged', title: esc(got.name), text: `${esc(x.name)} became ${/^[aeiou]/i.test(RARITY[got.rarity].name) ? 'an' : 'a'} ${RARITY[got.rarity].name.toLowerCase()} ${esc(got.name)}${got.own ? ' (you had one already)' : ''}.` });
}
function reforgeView() {
  const list = reforgeables(), groups = {};
  for (const x of list) (groups[x.group] = groups[x.group] || []).push(x);
  return `<div class="card"><div class="card-head"><h2>🔨 Reforge</h2><span class="muted small-text">turn something you own into a random new one of the same kind and rarity</span><span class="coins">${COIN} <b>${coins()}</b></span></div>
    <p class="muted small-text" style="margin-top:0">Great for duplicates and things you don't use. Each reforge has a 12% chance to go up a rarity. Things you're wearing can't be reforged.</p>
    ${Object.entries(groups).map(([g, xs]) => `<div class="daygroup">${g}</div><div class="rfgrid">${xs.sort((a, b) => TIERS.indexOf(b.rarity) - TIERS.indexOf(a.rarity)).map(x => `<div class="rfitem" style="--rc:${RARITY[x.rarity].color}">${x.art}<div class="main"><b>${esc(x.name)}</b><small style="color:${RARITY[x.rarity].color}">${RARITY[x.rarity].name}${x.n > 1 ? ` · ×${x.n}` : ''}</small></div><button class="btn small ${coins() >= REFORGE_FEE[x.rarity] ? '' : 'disabled'}" data-f2="reforge" data-k="${x.kind}" data-id="${x.id}">🔨 ${REFORGE_FEE[x.rarity]} ${COIN}</button></div>`).join('')}</div>`).join('') || '<div class="empty">Win items from lucky boxes first, then reforge the ones you don\'t want.</div>'}</div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-f2]'); if (!el) return;
  e.preventDefault();
  const a = el.dataset.f2;
  if (a === 'mergeAll') { if (confirm(`Merge every matching pair in your garden? (${mergeablePairs()} pair${mergeablePairs() === 1 ? '' : 's'} right now)`)) mergeAll(); }
  if (a === 'archSubj') { ui.archSubj = el.dataset.v; render(); }
  if (a === 'archAll') { ui.archAll = true; render(); }
  if (a === 'reforge') reforge(el.dataset.k, el.dataset.id);
});
