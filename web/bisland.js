'use strict';
/* Boss island (2.53, islands stage 5). The weekly house boss lives on its own
   floating island, the third island in the Islands view. It shows this week's
   boss as a low-poly 3D model in a stone arena, the shared health bar, its
   weakness, special rule and attacks, and the Fight button for your turn-based
   house fights (fight.js). Panels: the boss, the house ranking and your hits,
   champion spars, and trophies.
   Trophies: every weekly boss a house beats becomes a gold statue on that
   house's island (kept in the shared house document, inside b._boss so no
   Firestore rule change is needed).
   Raids: some bosses attack the house island. If a raider still has more than
   half its health on Friday, it smashes one building (it jumps one stage of wear:
   working -> worn -> broken). 2.66: a closed ring of wall round the great hall holds raids off
   (before 2.66 a working Bastion did). Repair as usual. */

const BI_RAIDERS = { 'Doomscroll Kraken': 'drags it under with its tentacles', 'Snooze Golem': 'slams it flat', 'Couch Troll': 'throws the couch at it', 'Excuse Hydra': 'chews on it with every head' };
const BI_RAID_DAY = 4; // Friday (days after Monday)

// the shared bits in the house document: t = trophies { week: boss name }, r = raids { week: building id or '-' }
const biDoc = (d = HI.doc) => (d?.b?._boss) || {};
// trophies, newest first
function biTrophies() {
  if (typeof HI === 'undefined' || !HI.doc) return [];
  return Object.entries(biDoc().t || {}).sort((a, b) => a[0] < b[0] ? 1 : -1).map(([wk, n]) => ({ wk, n, b: HS_BOSSES.find(x => x.n === n) })).filter(x => x.b);
}
// what the island's look depends on, so it only rebuilds when this changes
function biSig() { const wk = mondayOf(today()), f = hsState().id ? hsFight(hsState().id) : null; return wk + (f?.dead ? 'd' : '') + (f && f.left < f.hp / 2 ? 'h' : ''); }

// records trophies and raids in the house document (once, by whoever sees it first)
let biBusy = false;
async function biTick(f) {
  if (biBusy || !f || typeof HI === 'undefined' || !HI.doc || HI.h !== f.hid) return;
  const wk = f.wk, b = hsBoss(wk), B = biDoc(), raidOn = addDays(wk, BI_RAID_DAY);
  const needT = f.dead && !(B.t || {})[wk];
  const needR = !f.dead && BI_RAIDERS[b.n] && !(B.t || {})[wk] && today() >= raidOn && !(B.r || {})[wk] && f.left > f.hp / 2 && hsRows.length;
  if (!needT && !needR) return;
  biBusy = true; let hit = '';
  try {
    await hiWrite(d => {
      d.b = d.b || {}; const x = d.b._boss = Object.assign({ t: {}, r: {} }, d.b._boss || {});
      if (needT && !x.t[wk]) x.t[wk] = b.n;
      if (needR && !x.r[wk]) {
        const ring = typeof hhRingOf === 'function' && hhRingOf(d);
        const pool = HI_ITEMS.filter(it => !it.slot && it.id !== 'treasury' && ['ok', 'worn'].includes(hiCond(it.id, today(), d)));
        const rnd = seeded('raid-' + f.hid + wk), t = !ring && pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
        x.r[wk] = t ? t.id : ring ? 'wall' : '-';
        if (t) { const s = d.b[t.id]; s.hit = [...(s.hit || []).filter(h => h >= addDays(today(), -120)), today()]; hit = t.id; }
      }
      for (const k of Object.keys(x.r)) if (k < addDays(wk, -70)) delete x.r[k];
      const ks = Object.keys(x.t).sort(); while (ks.length > 30) delete x.t[ks.shift()]; // keep the newest 30
    }, true, true);
  } catch (e) { console.error(e); }
  biBusy = false;
  if (needT) toast('🏆 New trophy', `${b.e} ${b.n} now stands in gold on the house island.`);
  if (hit) { const it = hiItem(hit); toast(`${b.e} ${b.n} raided the house island!`, `It ${BI_RAIDERS[b.n]}: ${it.e} ${it.n} is damaged. A leader can repair it.`); }
  if (view === 'islands') render();
}

function viewBossIsland() {
  const hs = hsState(), wk = mondayOf(today()), b = hsBoss(wk), B = FT_BOSS[b.n], a = ftAttempts(), w = cdWallet();
  const daysLeft = 7 - diffDays(wk, today()), raider = BI_RAIDERS[b.n];
  let f = null;
  if (hs.id) { hsLoad(); if (typeof hiLoad === 'function') hiLoad(); f = hsFight(hs.id); hsRecord(f); biTick(f); }
  const h = hs.id ? hsHouse(hs.id) : null, pct = f ? Math.max(0, Math.round(f.left / f.hp * 100)) : 100;
  const raid = biDoc().r?.[wk], raided = raid && raid !== '-' && raid !== 'bastion' && raid !== 'wall' ? hiItem(raid) : null;
  let warn = '';
  if (raider && f && !f.dead) warn = raided ? `💥 ${esc(b.n)} raided the house island and damaged the ${raided.e} ${raided.n}.` : raid === 'bastion' ? `🏯 The Bastion held ${esc(b.n)}'s raid off.` : raid === 'wall' ? `🧱 The house walls held ${esc(b.n)}'s raid off.` : raid ? '' : today() < addDays(wk, BI_RAID_DAY) ? `⚠️ Raider: if it still has over half its health on Friday, it smashes a building on the house island.` : '';
  const hud = `<div class="ishud is-tl"><div class="islvl boss ${f?.dead ? 'dead' : ''}"><b>${b.e}</b><div><span>${esc(b.n)}</span><small>${bossWeek(wk) === 'rest' ? `🌴 Resting for the holidays · back ${fmtDate(bossBackOn(wk))}` : f?.dead ? `Defeated by ${esc(h.name)} 🎉` : `${bossWeek(wk) === 'term' ? '👑 Term Boss · ' : ''}${daysLeft} day${daysLeft === 1 ? '' : 's'} left · ${f ? `${f.left.toLocaleString()} / ${f.hp.toLocaleString()} HP` : 'weekly boss'}`}</small>${f ? `<i class="bihp" style="width:${pct}%"></i>` : ''}</div></div>
      <div class="isbuilders">💡 Weak to ${esc(B.wn)}${f ? ` · you: ${ftWeekDmg(wk).toLocaleString()} dmg` : ''}</div></div>
    <div class="ishud is-tr">${isBar('cd-l', LUMEN, w.lumen, 'Lumen', 1, '')}${isBar('cd-e', EMBER, w.ember, 'Ember', 1, '')}</div>
    <div class="ishud is-bl"><button class="isbtn" data-is="panel" data-v="binfo">📜<span>Boss</span></button><button class="isbtn" data-is="panel" data-v="brank">🏆<span>Ranking</span></button><button class="isbtn" data-is="panel" data-v="bspar">🎯<span>Spar</span></button><button class="isbtn" data-is="panel" data-v="btro">🏅<span>Trophies</span></button></div>
    <div class="ishud is-br"><button class="isbtn big fight" data-ft="house" ${hs.id && a.left ? '' : 'disabled'}>⚔️<span>${!hs.id ? 'Join a house' : a.left ? `Fight · ${a.left} left` : (a.rest ? '🌴 Resting' : 'No fights left')}</span></button></div>
    ${warn && !ui.isPanel ? `<div class="ishud is-bc biwarn">${warn}</div>` : ''}`;
  const bub = f ? `<div class="isbubs"><button class="isbub ${f.dead ? 'collect' : ''}" data-b="boss" data-is="panel" data-v="binfo">${f.dead ? '☠️ Defeated' : `❤️ ${pct}%`}</button></div>` : '';
  let extra = bub; const pn = ui.isPanel;
  if (pn === 'binfo') extra += isPanel(`${b.e} ${esc(b.n)}`, biInfoHtml(b, B, a, f, raider));
  else if (pn === 'brank') extra += isPanel('🏆 This week', biRankHtml(f, h) + (typeof t2SeasonCard === 'function' ? t2SeasonCard() : ''));
  else if (pn === 'bspar') extra += isPanel('🎯 Spar a champion', `<p class="muted small-text">Optional and risky: a champion copy of any boss, much tougher than the weekly one. Stake 25 ${LUMEN} + 25 ${EMBER}; win and you get it back plus 35 of each and a 50% gear chance. Duels against friends are on the <a href="#" data-act="goto" data-v="character">Character</a> page.</p><div class="ftbosses">${HS_BOSSES.map(x => `<button class="ftbossbtn" data-ft="spar" data-n="${esc(x.n)}" title="${esc(FT_BOSS[x.n].sp)}"><span>${x.e}</span><small>${esc(x.n)}</small></button>`).join('')}</div>`);
  else if (pn === 'btro') extra += isPanel('🏅 Trophies', biTroHtml(h));
  if (!hs.id && !pn) extra += `<div class="ispanel iscentre"><div class="ispanel-h"><h3>${b.e} ${esc(b.n)}</h3></div><div class="ispanel-b"><p class="muted">${esc(b.s)} ${plannerOnly() ? 'Houses are for Westbourne students, but you can spar a champion copy of any boss.' : 'Join your house to fight it together each week. You can still spar a champion copy.'}</p><div class="row" style="gap:8px">${plannerOnly() ? '' : '<button class="btn primary" data-act="goto" data-v="house">Pick your house</button>'}<button class="btn" data-is="panel" data-v="bspar">🎯 Spar</button></div></div></div>`;
  return isFrame('boss', hud, extra);
}
function biInfoHtml(b, B, a, f, raider) {
  return `<p>${esc(b.s)}</p>
    ${f ? hsBar(f) : ''}
    <p class="small-text"><b>Weak to:</b> ${B.wn}</p><p class="small-text"><b>Special:</b> ${esc(B.sp)}</p>
    <p class="small-text"><b>Attacks:</b> ${[...B.atk, ...(B.big ? [B.big] : [])].map(x => esc(x[0])).join(', ')}</p>
    ${raider ? `<p class="small-text"><b>⚠️ Raider:</b> if it still has more than half its health on Friday, it ${raider}: one building on the house island takes damage. A closed ring of wall round the great hall stops it.</p>` : ''}
    <p class="muted small-text">${FT_WEEK_ATT + a.extra} fights a week${a.extra ? ' (house island perk included)' : ''}, up to ${FT_DAY_ATT} a day, ${FT_ROUNDS} rounds each, and it hits back lightly. Your study, revision, workouts and PBs also do damage. Beat it as a house and it becomes a gold trophy on your house island, and everyone who fought gets a rare or better piece of gear. Set your build on the <a href="#" data-act="goto" data-v="character">Character</a> page.</p>
    <button class="btn primary" data-ft="house" ${hsState().id && a.left ? '' : 'disabled'}>⚔️ ${a.left ? `Fight (${a.left} left)` : (a.rest ? '🌴 Resting' : 'No fights left')}</button>`;
}
function biRankHtml(f, h) {
  if (!f) return '<p class="muted">Join your house to see the ranking.</p>';
  const wk = f.wk, w = hsWeek(wk), all = HS_HOUSES.map(x => ({ x, f: hsFight(x.id) })).sort((a, b) => b.f.dealt / b.f.hp - a.f.dealt / a.f.hp || b.f.dealt - a.f.dealt);
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  return `<div class="ftlbl">Your hits: ${(w.dmg + ftWeekDmg(wk)).toLocaleString()}</div>
    <p class="small-text">📚 Study ${w.study} · 🃏 Revision ${w.rev} · 🏃 Workouts ${w.w} · 🏅 PBs ${w.pb} · ⚔️ Fights ${ftWeekDmg(wk).toLocaleString()}${w.both ? ' · ✨ All-rounder +10%' : ''}</p>
    <div class="ftlbl">${h.e} ${esc(h.name)}</div><ol class="hslist">${f.rows.slice(0, 12).map((x, i) => `<li class="${x.me ? 'me' : ''}"><span class="hsm">${medal(i)}</span><span>${x.me ? 'You' : esc(x.name)}</span><span></span><b>${(x.d || 0).toLocaleString()}</b></li>`).join('')}</ol>
    <div class="ftlbl">All houses</div><ol class="hsrank">${all.map(({ x, f }) => `<li class="${x.id === h.id ? 'me' : ''}"><span class="hsdot" style="background:${x.col}"></span><b>${x.e} ${x.name}</b><span class="muted small-text">${f.rows.length} player${f.rows.length === 1 ? '' : 's'}</span><span>${f.dead ? '☠️ ' : ''}${Math.min(100, Math.round(f.dealt / f.hp * 100))}%</span></li>`).join('')}</ol>
    <p class="muted small-text">Ranked by how much of their own boss each house has taken down, so small houses can win. More detail on the <a href="#" data-act="goto" data-v="house">House</a> page.</p>`;
}
function biTroHtml(h) {
  if (!h) return '<p class="muted">Join your house first.</p>';
  if (!HI.doc) return `<p class="muted">${HI.err === 'signin' ? 'Trophies are shared with your house, so sign in on the Friends page to see them.' : 'Loading…'}</p>`;
  const t = biTrophies();
  return t.length ? `<p class="muted small-text">${t.length} boss${t.length === 1 ? '' : 'es'} beaten by ${esc(h.name)}. The newest 12 stand in gold along the front of the <a href="#" data-is="tab" data-v="house">house island</a>.</p><ul class="cdlog">${t.map(x => `<li><b>${x.b.e} ${esc(x.n)}</b><span class="muted">week of ${fmtDate(x.wk)}</span></li>`).join('')}</ul>`
    : `<p class="muted">No trophies yet. Beat a weekly boss as a house and it stands in gold on the house island.</p>`;
}

// ---------- 3D: the arena and the bosses ----------
// colour for a boss part: as it is, stone grey once beaten, or gold for a trophy
function biTint(col, mode) {
  if (mode === 'live') return col;
  const c = new THREE.Color(col), l = .3 * c.r + .59 * c.g + .11 * c.b;
  return mode === 'gold' ? '#' + new THREE.Color('#ffd43b').lerp(new THREE.Color('#b8860b'), 1 - Math.min(1, l * 1.3)).getHexString() : '#' + new THREE.Color(.35 + l * .4, .34 + l * .4, .36 + l * .42).getHexString();
}
function is3bossModel(g, name, mode = 'live') {
  const T = c => biTint(c, mode), glow = mode === 'live';
  const M = (geo, col, x, y, z, gl) => is3mesh(geo, T(col), x, y, z, g, gl && glow);
  const Ico = (r, col, x, y, z, gl, d = 0) => M(new THREE.IcosahedronGeometry(r, d), col, x, y, z, gl);
  const Box = (w, h, d, col, x, y, z, gl) => M(new THREE.BoxGeometry(w, h, d), col, x, y, z, gl);
  const Cyl = (rt, rb, h, col, x, y, z, s = 7) => M(new THREE.CylinderGeometry(rt, rb, h, s), col, x, y, z);
  const Con = (r, h, col, x, y, z, s = 6, gl) => M(new THREE.ConeGeometry(r, h, s), col, x, y, z, gl);
  const eyes = (y, z, sp, r = .11, col = '#ffe066') => { for (const s of [-1, 1]) Ico(r, col, s * sp, y, z, true); };
  // a limb from a to b (a cylinder pointing between two points)
  const limb = (a, b, r, col) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = M(new THREE.CylinderGeometry(r, r * 1.1, A.distanceTo(B), 6), col, 0, 0, 0); m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m; };
  switch (name) {
    case 'The Procrastinator': {
      for (const s of [-1, 1]) Cyl(.12, .16, 3.6, '#6b4c33', s * 1.5, 1.8, 0, 6);
      limb([-1.6, 3.4, 0], [1.6, 3.4, 0], .13, '#7a5136');
      Ico(.95, '#8d6e4c', 0, 2.1, 0, false, 1).scale.set(1, 1.2, .9);
      Ico(.58, '#8d6e4c', 0, 2.95, .35, false, 1); Ico(.42, '#d8bb8f', 0, 2.9, .62, false, 1).scale.z = .6;
      for (const s of [-1, 1]) { Box(.22, .1, .05, '#3d2b1f', s * .17, 3, .86); limb([s * .55, 2.5, .1], [s * .55, 3.4, 0], .14, '#7a5136'); limb([s * .45, 1.3, .1], [s * .7, 3.35, 0], .14, '#7a5136'); Con(.08, .25, '#e9ecef', s * .55, 3.42, .14, 4); }
      Box(.18, .05, .05, '#3d2b1f', 0, 2.75, .88); break;
    }
    case 'Doomscroll Kraken': {
      Ico(1.15, '#7048e8', 0, 2.5, 0, false, 1).scale.set(1, 1.35, 1); Ico(.9, '#845ef7', 0, 1.5, 0, false, 1).scale.y = .7;
      eyes(2.3, .95, .42, .2); for (const s of [-1, 1]) Ico(.09, '#212529', s * .42, 2.3, 1.12);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; for (let j = 0; j < 6; j++) { const r = .8 + j * .42, y = 1.2 - j * .18 + (j > 3 ? (j - 3) * .35 : 0); Ico(.34 - j * .045, j % 2 ? '#9775fa' : '#7950f2', Math.cos(a) * r, y, Math.sin(a) * r); } }
      for (let i = 0; i < 4; i++) Box(.32, .5, .04, '#e9ecef', Math.cos(i * 1.7) * 2.6, 2.6 + i * .3, Math.sin(i * 1.7) * 2.6, true); // phones on its tentacles
      break;
    }
    case 'Snooze Golem': {
      M(is3rock(new THREE.DodecahedronGeometry(1.1, 0), seeded('golem'), .2), '#868e96', 0, 1.9, 0).scale.set(1.2, 1, .9);
      M(is3rock(new THREE.DodecahedronGeometry(.62, 0), seeded('golem2'), .2), '#adb5bd', 0, 3.25, .1);
      for (const s of [-1, 1]) { M(new THREE.DodecahedronGeometry(.5, 0), '#868e96', s * 1.5, 2.2, 0); M(new THREE.DodecahedronGeometry(.48, 0), '#6c757d', s * 1.7, 1.15, .2); M(new THREE.DodecahedronGeometry(.45, 0), '#6c757d', s * .55, .45, 0); Box(.24, .05, .05, '#66d9e8', s * .22, 3.3, .66, true); }
      const cap = Con(.5, .9, '#4263eb', .1, 3.95, 0, 7); cap.rotation.z = -.5; Ico(.13, '#ffffff', .52, 4.15, 0);
      Ico(.12, '#4ee6ff', .9, 4.4, 0, true); Ico(.09, '#4ee6ff', 1.25, 4.8, 0, true); break; // Zz
    }
    case 'Couch Troll': {
      Box(3, .6, 1.3, '#c92a2a', 0, .5, 0); Box(3, 1.1, .35, '#a61e1e', 0, 1.25, -.55); for (const s of [-1, 1]) Box(.35, .9, 1.3, '#a61e1e', s * 1.5, .9, 0);
      Ico(.85, '#5c940d', 0, 1.65, .05, false, 1).scale.set(1.15, 1, 1); Ico(.55, '#74b816', 0, 2.65, .2, false, 1);
      Con(.15, .45, '#5c940d', 0, 2.55, .75, 5).rotation.x = Math.PI / 2; eyes(2.8, .62, .2, .09, '#ff6b6b');
      for (const s of [-1, 1]) { Con(.14, .5, '#74b816', s * .6, 2.9, .1, 4).rotation.z = -s * 1; limb([s * .8, 1.9, .2], [s * 1.2, 1.2, .7], .17, '#5c940d'); limb([s * .35, 1, .5], [s * .4, .4, 1.1], .2, '#5c940d'); }
      Box(.18, .08, .45, '#212529', 1.2, 1.25, .85); break;
    }
    case 'Cram Wraith': {
      Cyl(.55, 1.15, 2.4, '#d0ebff', 0, 1.9, 0, 9); Ico(.75, '#e7f5ff', 0, 3.4, 0, false, 1);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; Con(.22, .55, '#d0ebff', Math.cos(a) * .95, .55, Math.sin(a) * .95, 5).rotation.x = Math.PI; }
      eyes(3.45, .62, .25, .13, '#9c36b5'); Box(.3, .12, .05, '#495057', 0, 3.1, .7);
      for (const s of [-1, 1]) limb([s * .7, 2.7, 0], [s * 1.5, 2.1, .6], .14, '#d0ebff');
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4, bk = Box(.55, .12, .4, ['#e03131', '#1971c2', '#2f9e44', '#f08c00'][i], Math.cos(a) * 2, 1.6 + i * .45, Math.sin(a) * 2); bk.rotation.set(.3, a, .2); }
      break;
    }
    case 'Excuse Hydra': {
      Ico(1.1, '#2f9e44', 0, 1.1, -.2, false, 1).scale.set(1.35, .85, 1.1); const tail = Con(.4, 1.8, '#2b8a3e', 0, .6, -1.7, 6); tail.rotation.x = -1.3;
      for (const s of [-1, 1]) for (const zz of [.4, -.7]) limb([s * .9, .8, zz], [s * 1.1, 0, zz + .1], .2, '#2b8a3e');
      for (let i = 0; i < 5; i++) { const a = (i - 2) * .45, top = [Math.sin(a) * 1.7, 3 - Math.abs(i - 2) * .35, .6 + Math.cos(a) * .5]; limb([Math.sin(a) * .5, 1.6, .2], top, .17, '#37b24d'); const hd = Ico(.33, '#40c057', top[0], top[1], top[2] + .1); hd.scale.z = 1.4; Box(.24, .12, .35, '#2f9e44', top[0], top[1] - .1, top[2] + .45); for (const s of [-1, 1]) Ico(.06, '#ffd43b', top[0] + s * .15, top[1] + .14, top[2] + .3, true); }
      break;
    }
    case 'Fog of Distraction': {
      const rnd = seeded('fog');
      for (let i = 0; i < 11; i++) { const a = rnd() * 6.28, r = rnd() * 1.1; Ico(.6 + rnd() * .55, rnd() < .5 ? '#ced4da' : '#dee2e6', Math.cos(a) * r, 1.6 + rnd() * 1.6, Math.sin(a) * r * .7, false, 1); }
      eyes(2.5, 1.2, .38, .17, '#fcc419');
      for (let i = 0; i < 5; i++) { const a = i * 1.25; Ico(.25, '#e9ecef', Math.cos(a) * 2.2, .9 + (i % 3) * .5, Math.sin(a) * 2.2); }
      for (let i = 0; i < 3; i++) Box(.55, .35, .04, '#74c0fc', -1.8 + i * 1.8, 3.6 + (i % 2) * .4, .6, true); // browser tabs floating in it
      break;
    }
    case 'The Energy Drain': {
      Cyl(.85, .85, 2.6, '#343a40', 0, 1.5, 0, 10); Cyl(.3, .3, .35, '#adb5bd', 0, 2.97, 0, 8);
      M(new THREE.CylinderGeometry(.88, .88, .45, 10), '#fa5252', 0, .5, 0, true);
      const b1 = Box(.25, .9, .06, '#ffd43b', .08, 1.8, .86, true); b1.rotation.z = .4; const b2 = Box(.25, .9, .06, '#ffd43b', -.08, 1.15, .86, true); b2.rotation.z = .4;
      eyes(2.4, .82, .3, .12, '#ff6b6b');
      for (const s of [-1, 1]) { limb([s * .85, 1.8, 0], [s * 1.6, 1.1, .4], .1, '#495057'); limb([s * .4, .3, 0], [s * .45, -.1, .2], .12, '#495057'); }
      for (let i = 0; i < 3; i++) { const z = Box(.12, .7, .05, '#ffe066', Math.cos(i * 2.1) * 1.6, 3.2 + i * .2, Math.sin(i * 2.1) * 1.6, true); z.rotation.z = .5; }
      break;
    }
    default: Ico(1.2, '#e03131', 0, 1.5, 0, false, 1); eyes(1.7, 1, .4);
  }
}
function is3bossBuild() {
  is3clear();
  const W = IS3.world, wk = mondayOf(today()), b = hsBoss(wk), f = hsState().id ? hsFight(hsState().id) : null, dead = !!f?.dead, hurt = f && f.left < f.hp / 2;
  const S = 17, top = IS3.top = .3, rnd = seeded('solis-boss-' + wk);
  Object.assign(IS3.sun.shadow.camera, { left: -S * .75, right: S * .75, top: S * .75, bottom: -S * .75 }); IS3.sun.shadow.camera.updateProjectionMatrix();
  is3base(W, S, top, rnd, 1.1, { turf: '#4b4458', lip: '#3d3649', dirt: '#5a4b5e', dirt2: '#463a4b', rock: '#3f3650', rock2: '#352d44', rock3: '#4d4260', crys: dead ? ['#4ee6ff', '#74c0fc'] : ['#ff6b3d', '#c2255c'], root: '#2d2838', tree: false });
  // the arena floor: a stone ring with glowing runes
  is3mesh(new THREE.CylinderGeometry(6.4, 6.6, .22, 20), '#8a8199', 0, top + .11, 0, W);
  is3mesh(new THREE.CylinderGeometry(5.6, 5.6, .24, 20), '#6f6680', 0, top + .12, 0, W);
  const rune = is3mesh(new THREE.TorusGeometry(4.6, .07, 4, 40), dead ? '#4ee6ff' : '#ff7a3d', 0, top + .26, 0, W, true); rune.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = is3mesh(new THREE.OctahedronGeometry(.18, 0), dead ? '#4ee6ff' : '#ff7a3d', Math.cos(a) * 4.6, top + .3, Math.sin(a) * 4.6, W, true); r.scale.y = .3; }
  is3mesh(new THREE.CylinderGeometry(1.9, 2.1, .3, 10), '#9d94ad', 0, top + .38, 0, W); // the dais
  // cracks of fire in the floor while it's alive
  if (!dead) for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, c = is3mesh(new THREE.BoxGeometry(.08, .04, 1 + rnd() * 1.4), '#ff922b', Math.cos(a) * 3.2, top + .25, Math.sin(a) * 3.2, W, true); c.rotation.y = a + (rnd() - .5); c.castShadow = false; }
  // pillars round the ring, some broken, with torches
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * 7.1, z = Math.sin(a) * 7.1, broken = rnd() < .35, h = broken ? .8 + rnd() * .9 : 2.6, g = new THREE.Group(); g.position.set(x, top, z);
    is3mesh(new THREE.BoxGeometry(.9, .25, .9), '#7d748c', 0, .12, 0, g); is3mesh(new THREE.CylinderGeometry(.3, .34, h, 7), '#9d94ad', 0, .25 + h / 2, 0, g);
    if (broken) { for (let j = 0; j < 3; j++) is3mesh(new THREE.DodecahedronGeometry(.18 + rnd() * .12, 0), '#8a8199', (rnd() - .5) * 1.4, .12, (rnd() - .5) * 1.4, g); }
    else { is3mesh(new THREE.BoxGeometry(.75, .2, .75), '#7d748c', 0, .35 + h, 0, g); if (i % 2 === 0) { is3mesh(new THREE.CylinderGeometry(.16, .1, .25, 6), '#495057', 0, .58 + h, 0, g); is3mesh(new THREE.ConeGeometry(.16, .45, 5), dead ? '#74c0fc' : '#ff922b', 0, .9 + h, 0, g, true); } }
    W.add(g);
  }
  // scattered rocks and bones at the edge
  for (let i = 0; i < 26; i++) { const sd = Math.floor(rnd() * 4), t = (rnd() - .5) * (S - 1), d = S / 2 - .4 - rnd() * .9, [x, z] = sd === 0 ? [t, d] : sd === 1 ? [t, -d] : sd === 2 ? [d, t] : [-d, t]; if (Math.hypot(x, z) < 7.8) continue;
    if (rnd() < .7) is3mesh(is3rock(new THREE.DodecahedronGeometry(.2 + rnd() * .35, 0), rnd, .3), rnd() < .5 ? '#6f6680' : '#5a5168', x, top + .15, z, W);
    else is3mesh(new THREE.ConeGeometry(.15, .5 + rnd() * .5, 5), dead ? '#4ee6ff' : '#ff6b3d', x, top + .3, z, W, true); }
  // the boss on its dais; beaten bosses turn to stone, topple over and get your house's banner
  const g = new THREE.Group(); g.position.set(0, top + .53, 0); g.rotation.y = Math.PI / 4; // faces the camera's starting spot W.add(g);
  const m = new THREE.Group(); g.add(m); is3bossModel(m, b.n, dead ? 'dead' : 'live'); m.scale.setScalar(hurt && !dead ? .95 : 1.05);
  if (dead) { m.rotation.z = .5; m.position.set(.7, -.15, 0); const h = hsHouse(hsState().id); is3mesh(new THREE.CylinderGeometry(.05, .05, 2.6, 5), '#dee2e6', -1.3, 1.3, .9, g); is3mesh(new THREE.BoxGeometry(.9, .6, .04), h?.col || '#ffd43b', -.85, 2.2, .9, g); }
  IS3.marks = { boss: [0, top + 5, 0] };
}
