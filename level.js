'use strict';
/* Solis player level (2.51). Shared by the character page (spells, moves and
   gear unlock by level) and the islands (buildings unlock by level).
   XP = every Lumen and Ember you have ever earned from study and training
   (before the house share, spending or stakes, so buying things never lowers
   your level). Level n needs 50 × n × (n − 1) XP: level 2 at 100, 5 at 1,000,
   10 at 4,500, 20 at 19,000. Max level 50. */
const SOLIS_LV_MAX = 50;
const solisLvXp = n => 50 * n * (n - 1);
function solisLevel(w = cdWallet()) {
  const xp = Math.max(0, Math.round((w.earnL || 0) + (w.earnE || 0)));
  let n = 1; while (n < SOLIS_LV_MAX && solisLvXp(n + 1) <= xp) n++;
  const lo = solisLvXp(n), hi = solisLvXp(Math.min(n + 1, SOLIS_LV_MAX));
  return { n, xp, into: xp - lo, need: Math.max(1, hi - lo), max: n >= SOLIS_LV_MAX };
}
// true when the player has reached level lv (the one call other pages need)
const solisHas = lv => solisLevel().n >= (lv || 1);
