'use strict';
/* 2.22 upgrades: every upgrade with levels now goes up to level 20, and each
   level costs about 45% more than the one before, so the last levels are
   long-term goals. The prices you already paid stay the same. Plus six new
   upgrades: three for the garden (leaves) and three for coins. */

const UPG_MAX = 20, UPG_STEP = 1.45;
const nicePrice = n => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / p) * p; };
function extendPrices(u) {
  if (u.once) return;
  const out = [...u.prices], max = u.max || UPG_MAX;
  while (out.length < max) out.push(nicePrice(out[out.length - 1] * UPG_STEP));
  u.prices = out.slice(0, max);
}
LEAF_UPGRADES.push(
  { id: 'sundial', icon: '☀️', name: 'Sundial', desc: 'Trees grow 10% faster towards their next stage, per level', prices: [800], need: 5 },
  { id: 'trellis', icon: '🪴', name: 'Trellis', desc: '+3 leaves an hour for every mature or older tree, per level', prices: [1500], need: 10 },
  { id: 'birdbath', icon: '🐦', name: 'Bird bath', desc: 'Visiting critters drop by 10% more often, per level', prices: [1000], need: 5 },
);
UPGRADES.push(
  { id: 'drills', icon: '🥊', name: 'Training dummy', desc: '+2% to every Arena stat, per level', prices: [300] },
  { id: 'appraiser', icon: '🔍', name: 'Appraiser', desc: 'Duplicates from lucky boxes refund 10% more, per level', prices: [250] },
  { id: 'lamp', icon: '📚', name: 'Study lamp', desc: '+5% coins and XP for sessions of 45+ minutes, per level', prices: [400] },
);
// one-off upgrades stay one-off; the extra challenge stops at 3
for (const id of ['compost', 'mulch', 'gnome', 'stream']) { const u = LEAF_UPGRADES.find(x => x.id === id); if (u) u.once = true; }
for (const id of ['shield', 'discount', 'goldseed']) { const u = UPGRADES.find(x => x.id === id); if (u) u.once = true; }
{ const u = UPGRADES.find(x => x.id === 'extra'); if (u) { u.prices = [250, 900, 3000]; u.max = 3; } }
LEAF_UPGRADES.forEach(extendPrices); UPGRADES.forEach(extendPrices);
