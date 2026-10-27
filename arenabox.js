'use strict';
/* Arena boxes: bought with 🪙 coins (the money shared between the garden and
   the Arena). Each one holds a piece of gear, an avatar cosmetic or a move
   you don't have yet. If you already own everything in it, you get Grit. */

const ARENA_BOXES = [
  { id: 'kit', name: 'Kit bag', price: 150, kinds: ['gear', 'cos'], odds: { common: 60, rare: 32, epic: 7, legendary: 1 }, colors: ['#4dabf7', '#1864ab', '#e7f5ff'], note: 'Gear or cosmetics' },
  { id: 'style', name: 'Style crate', price: 200, kinds: ['cos'], odds: { common: 45, rare: 38, epic: 14, legendary: 3 }, colors: ['#f783ac', '#a61e4d', '#fff0f6'], note: 'Avatar cosmetics only' },
  { id: 'scroll', name: 'Move scroll', price: 300, kinds: ['move'], odds: { common: 30, rare: 45, epic: 20, legendary: 5 }, colors: ['#ffd43b', '#e67700', '#fff9db'], note: 'A move you haven\'t learned' },
  { id: 'pro', name: 'Pro locker', price: 450, kinds: ['gear'], odds: { common: 0, rare: 45, epic: 40, legendary: 15 }, colors: ['#495057', '#212529', '#ced4da'], note: 'Rare gear or better' },
  { id: 'champ', name: 'Champion chest', price: 900, kinds: ['gear', 'cos', 'move'], odds: { common: 0, rare: 0, epic: 60, legendary: 40 }, colors: ['#ff922b', '#c92a2a', '#fff4e6'], note: 'Epic or better' },
];
const priceRarity = (p, cuts) => p < cuts[0] ? 'common' : p < cuts[1] ? 'rare' : p < cuts[2] ? 'epic' : 'legendary';
function arenaPrizes() {
  const gear = GEAR.map(g => ({ kind: 'gear', id: g.id, name: g.name, rarity: priceRarity(g.price, [150, 350, 800]), own: ownsGear(g.id), g }));
  const cosm = COSMETICS.filter(c => c.coins || c.grit).map(c => ({ kind: 'cos', id: c.id, name: c.name, rarity: priceRarity((c.coins || 0) + (c.grit || 0) * 1.2, [100, 200, 450]), own: ownsCos(c.id), c }));
  const moves = MOVE_BOOK.filter(m => !m.basic).map(m => ({ kind: 'move', id: m.id, name: m.name, rarity: priceRarity(m.price, [150, 250, 380]), own: ownsMove(m), m }));
  return [...gear, ...cosm, ...moves];
}
function rollArenaPrize(box) {
  let r = Math.random() * 100, rarity = 'common';
  for (const [k, p] of Object.entries(box.odds)) { if (r < p) { rarity = k; break; } r -= p; }
  const pool = arenaPrizes().filter(x => box.kinds.includes(x.kind) && !x.own);
  const tier = ['common', 'rare', 'epic', 'legendary'];
  // nearest rarity that still has something you don't own
  for (const d of [0, 1, -1, 2, -2, 3, -3]) { const t = tier[tier.indexOf(rarity) + d]; const p = t && pool.filter(x => x.rarity === t); if (p && p.length) return p[Math.floor(Math.random() * p.length)]; }
  return { kind: 'grit', rarity, name: `${RARITY[rarity].refund * 2} Grit`, amount: RARITY[rarity].refund * 2 };
}
function prizeArt(x) {
  if (x.kind === 'gear') return `<span class="abprize">${x.g.icon}</span>`;
  if (x.kind === 'move') return `<span class="abprize">${x.m.icon}</span>`;
  if (x.kind === 'grit') return `<span class="abprize">${GRIT}</span>`;
  try { return avatarFull(avatarSpec({ ...myAv(), [x.c.cat]: x.c.id }), { size: 150 }); } catch (e) { return `<span class="abprize">✨</span>`; }
}
function prizeText(x) {
  if (x.kind === 'gear') return `New gear: ${bonusText(x.g.bonus)}. It's equipped in your Locker.`;
  if (x.kind === 'move') return `${x.m.note} Add it to your move set under Moves.`;
  if (x.kind === 'cos') return 'New look unlocked and put on your avatar. Change it any time in the Wardrobe.';
  return 'You already own everything in this box, so you get Grit instead.';
}
function openArenaBox(id, free) {
  const box = ARENA_BOXES.find(b => b.id === id); if (!box || (!free && coins() < box.price)) return;
  const x = rollArenaPrize(box), now = new Date().toISOString();
  if (!free) D.game.spent = (D.game.spent || 0) + box.price;
  D.arena.boxes = (D.arena.boxes || 0) + 1;
  if (x.kind === 'gear') { D.arena.gear = { ...(D.arena.gear || {}), [x.id]: now }; D.arena.equip = { ...(D.arena.equip || {}), [x.g.slot]: x.id }; }
  else if (x.kind === 'move') { D.arena.movesOwned = { ...(D.arena.movesOwned || {}), [x.id]: now }; const set = moveSet().map(m => m.id); if (set.length < 4) D.arena.moveset = [...set, x.id]; }
  else if (x.kind === 'cos') { D.arena.owned = { ...(D.arena.owned || {}), [x.id]: now }; wearCos(x.id, true); }
  else D.arena.ledger = { ...(D.arena.ledger || {}), ['box:' + Date.now()]: x.amount };
  save();
  revealFx({ boxHtml: boxSvg(box, 170), rarity: x.rarity, prizeHtml: prizeArt(x), title: x.name, text: prizeText(x),
    buttons: coins() >= box.price ? `<button class="btn" data-again="${box.id}">Open another (${box.price} ${COIN})</button>` : '', onButton: x => openArenaBox(x) });
}
function arenaBoxesCard() {
  const have = coins(), all = arenaPrizes();
  return `<div class="card"><div class="card-head"><h2>🎁 Arena boxes</h2><span class="muted small-text">paid with coins from studying</span><span class="pill">${COIN} ${have}</span></div>
    <div class="boxes">${ARENA_BOXES.map(b => { const left = all.filter(x => b.kinds.includes(x.kind) && !x.own).length;
      return `<div class="boxcard ${have >= b.price ? '' : 'poor'}" style="--bc:${b.colors[0]}"><div class="boxart">${boxSvg(b, 120)}</div><h3>${b.name}</h3><div class="boxnote">${b.note}</div>
      <div class="odds">${Object.entries(b.odds).filter(([, p]) => p).map(([r, p]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${p}%</span>`).join('')}</div>
      <span class="muted small-text">${left} thing${left === 1 ? '' : 's'} left to find</span>
      <button class="btn ${have >= b.price ? 'primary' : ''}" data-act="openArenaBox" data-id="${b.id}" ${have >= b.price ? '' : 'disabled'}>Open · ${b.price} ${COIN}</button></div>`; }).join('')}</div></div>`;
}
