'use strict';
/* 2.22 critters: five more move in for good when you grow certain kinds of
   tree, one moves in when a tree grows old, and four visitors drop by now and
   then for a day. A visitor gives its buff only while it's here. */

CRITTERS.push(
  { id: 'panda', emoji: '🐼', name: 'Panda', how: 'Grow 5 trees as Bamboo', need: s => [s.sp('bamboo'), 5], buff: '+10% XP from study', at: [610, 300] },
  { id: 'parrot', emoji: '🦜', name: 'Parrot', how: 'Grow 3 trees as Palm or Mangrove', need: s => [s.sp('palm', 'mangrove'), 3], buff: '+5% coins from study', at: [930, 240], fly: true },
  { id: 'penguin', emoji: '🐧', name: 'Penguin', how: 'Grow 3 trees as Fir, Blue spruce or Frost tree', need: s => [s.sp('fir', 'spruce', 'frost'), 3], buff: '+10% coins for sessions of 60+ minutes', at: [380, 420] },
  { id: 'bat', emoji: '🦇', name: 'Fruit bat', how: 'Grow 3 trees as Moonlight, Lantern or Aurora tree', need: s => [s.sp('moon', 'lantern', 'aurora'), 3], buff: '+10% XP for sessions after 7pm', at: [720, 200], fly: true },
  { id: 'ladybug', emoji: '🐞', name: 'Ladybirds', how: 'Grow 5 trees as Blossom, Magnolia or Wisteria', need: s => [s.sp('cherry', 'magnolia', 'wisteria'), 5], buff: '+5% leaves from every tree', at: [160, 420] },
  { id: 'turtle', emoji: '🐢', name: 'Old turtle', how: 'Grow a tree into an Elder tree', need: s => [s.elder, 1], buff: '+5% lucky merges (skip a stage)', at: [470, 432] },
);
// forest stats gain tree-type counts and the oldest stage reached
{
  const base = forestStats;
  forestStats = function () {
    const s = base(), trees = D.focusLogs.filter(l => l.mins >= 10 && !l.withered);
    s.sp = (...kinds) => trees.filter(l => kinds.includes(speciesFor(l.subjectId))).length;
    s.elder = trees.filter(l => treeStageOf(l) >= 5).length;
    return s;
  };
}

// ---------- visitors ----------
const VISITORS = [
  { id: 'hummingbird', emoji: '🐦', name: 'Hummingbird', buff: '+20% leaves from every tree while it visits', fly: true },
  { id: 'raccoon', emoji: '🦝', name: 'Raccoon', buff: 'Brings you 30 coins when it arrives' },
  { id: 'snail', emoji: '🐌', name: 'Garden snail', buff: 'Every tree counts as watered while it visits' },
  { id: 'otter', emoji: '🦦', name: 'Otter', buff: 'Watering pays double coins while it visits' },
];
const visitorById = id => VISITORS.find(v => v.id === id);
// one roll a day: about a third of days bring a visitor, more with the bird bath and a bottlebrush
function visitorRoll(day) {
  const rnd = seeded('visit' + day), chance = Math.min(.9, .33 * (1 + .1 * (typeof lupg === 'function' ? lupg('birdbath') : 0) + activeBuff('visit')));
  return rnd() < chance ? VISITORS[Math.floor(rnd() * VISITORS.length)].id : null;
}
// who is visiting today: today's roll is saved the first time it's seen, so
// buying upgrades later never changes a past day; holly lets visitors stay longer
function visitorsToday() {
  const v = D.game.visits = D.game.visits || {}, t = today();
  if (!(t in v)) v[t] = visitorRoll(t);
  const out = new Set(v[t] ? [v[t]] : []), extra = activeBuff('visitDays');
  for (let k = 1; k <= extra; k++) { const d = addDays(t, -k); if (v[d]) out.add(v[d]); }
  return [...out];
}
const visiting = id => !!D?.game && visitorsToday().includes(id);
function checkVisitors() {
  if (!D || !D.game) return;
  const t = today(); if (D.game.visitSeen === t) return;
  const id = visitorsToday()[0]; if (!id) return;
  D.game.visitSeen = t;
  const k = visitorById(id); if (!k) return;
  D.game.visitLog = { ...(D.game.visitLog || {}), [id]: (D.game.visitLog?.[id] || 0) + 1 };
  if (id === 'raccoon') D.game.ledger['v:' + t] = 30;
  save();
  setTimeout(() => toast(`${k.emoji} ${k.name} is visiting today`, k.buff), 800);
}
function visitorBanner() {
  const vs = visitorsToday().map(visitorById).filter(Boolean);
  if (!vs.length) return '';
  return `<div class="visitbar">${vs.map(k => `<span class="visit-e">${k.emoji}</span><span><b>${esc(k.name)} is visiting today.</b> <span class="muted">${esc(k.buff)}</span></span>`).join('')}</div>`;
}
function visitorsCard() {
  const seen = D.game.visitLog || {}, now = visitorsToday();
  return `<div class="card"><div class="card-head"><h2>Visitors</h2><span class="muted">${Object.keys(seen).length} / ${VISITORS.length} have dropped by</span></div>
    <p class="muted small-text" style="margin-top:0">Visitors turn up on about a third of days and stay for the day. A bird bath brings them more often.</p>
    <div class="critgrid">${VISITORS.map(k => { const met = seen[k.id], here = now.includes(k.id);
      return `<div class="critcard ${met ? 'got' : ''} ${here ? 'here' : ''}"><div class="critemoji">${met || here ? k.emoji : '❔'}</div><b>${met || here ? esc(k.name) : '???'}</b>
        <div class="critbuff">${met || here ? esc(k.buff) : 'Drops by now and then'}</div><span class="muted small-text">${here ? '<b class="green-text">Here today</b>' : met ? `Visited ${met} time${met === 1 ? '' : 's'}` : 'Not met yet'}</span></div>`; }).join('')}</div></div>`;
}

// ---------- 3D models ----------
if (typeof CRIT3 !== 'undefined') Object.assign(CRIT3, {
  panda: () => beast({ body: '#f8f9fa', head: '#f8f9fa', ears: 'round', snout: '#212529', legs: '#212529', size: .9 }),
  penguin: () => { const g = grp(ball(.22, '#212529', 0, .3, 0, 1, 1.5, 1), ball(.17, '#f8f9fa', .08, .28, 0, .8, 1.3, .9), ball(.14, '#212529', 0, .62, 0), cone(.04, .1, '#f59f00', .15, .6, 0, 4).rotateZ(-Math.PI / 2), ball(.025, '#fff', .11, .66, .06, 1, 1, 1, { detail: 0 }), ball(.025, '#fff', .11, .66, -.06, 1, 1, 1, { detail: 0 })); g.scale.setScalar(.9); return g; },
  ladybug: () => { const g = new THREE.Group(); for (const [x, z] of [[0, 0], [.4, .3], [-.3, .35]]) g.add(at(m3mesh(SphG(.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e03131'), x, .02, z), ball(.04, '#212529', x + .08, .05, z, 1, 1, 1, { detail: 0 })); return g; },
  turtle: () => grp(at(m3mesh(SphG(.3, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, .7, 1), '#5c940d'), 0, .08, 0), ball(.1, '#8ce99a', .4, .14, 0), ...[[.22, .18], [.22, -.18], [-.22, .18], [-.22, -.18]].map(([x, z]) => ball(.06, '#8ce99a', x, .05, z))),
});
const VISIT3 = {
  raccoon: () => beast({ body: '#868e96', head: '#adb5bd', ears: 'pointy', tail: 'bushy', tailCol: '#495057', snout: '#212529', size: .75 }),
  snail: () => grp(ball(.08, '#e9c39b', .1, .06, 0, 2.4, .6, 1), at(m3mesh(TorG(.11, .07, 8, 18), '#c08a52'), -.02, .2, 0), ball(.02, '#212529', .3, .14, .03, 1, 1, 1, { detail: 0 })),
  otter: () => beast({ body: '#7a5230', belly: '#d9a066', ears: 'round', tail: 'long', tailCol: '#5c3a21', size: .7, legH: .08 }),
};
