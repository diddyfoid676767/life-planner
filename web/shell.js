'use strict';
/* 2.72 world-only shell (roadmap stage 4). There is no sidebar any more: the
   island world is always there, full screen, and every page slides in over it
   as a panel. Closing the panel (✕, Esc or the Solis button) goes back to the
   world. A light HUD along the top replaces the sidebar: the building pages,
   Map (travel between islands), search, Lumen / Ember / streak, quick add,
   feedback and the Steward (settings). The running timer bar sits under it.
   Also here: the Today card that pops up when Solis opens, the map with its
   fly-over travel, the 2D map for slow computers, and the short Steward list
   at the top of Settings. The old page names still work (VIEW_ALIAS in
   places.js), so links, saved state and Ctrl+K all land in the right place. */

// the building that holds each page, as the HUD and the panel header name it
const SHELL_HOME = [
  { id: 'notice', v: ['today', 'calendar', 'todaycard'], e: '📜', n: 'Notice Board', k: 'Today, calendar and to-dos' },
  { id: 'library', v: ['study'], e: '📚', n: 'Library', k: 'Study, SAC scores and exams' },
  { id: 'training', v: ['training'], e: '💪', n: 'Training hall', k: 'Fitness, workouts and PRs' },
  { id: 'tavern', v: ['friends'], e: '🍺', n: 'Tavern', k: 'Friends and chats' },
  { id: 'hall', v: ['profile'], e: '🏰', n: 'Hall', k: 'You: character, gear and looks' },
];
const SHELL_OTHER = { settings: ['🧾', 'Steward'], board: ['🏆', 'Rankings'] };
const shellOf = v => SHELL_HOME.find(b => b.v.includes(v));
const shell2D = () => typeof D === 'object' && D && (!!D.settings?.map2d || (typeof webglOK === 'function' && window.THREE && !webglOK()));
const SHELL = { tab: null };

// ---------- the world behind and the panel over it (called from render) ----------
function shellWorld() {
  const w = document.getElementById('world'); if (!w) return;
  if (ui.isTab === 'rank') { ui.isTab = SHELL.tab && SHELL.tab !== 'rank' ? SHELL.tab.replace(/\+v|2d/g, '') : 'personal'; view = 'bw'; ui.bw = { id: 'tavern', tab: 'rank' }; } // 2.84: Rankings is a Tavern tab
  if (typeof VIEW_ALIAS === 'object' && VIEW_ALIAS[view]) view = VIEW_ALIAS[view];
  const only = view === 'islands', cl = document.body.classList;
  cl.add('world-on'); cl.toggle('world-only', only); cl.toggle('shp-card', view === 'todaycard');
  // 2.78: a window slides in from the right; the island moves left so it stays in view
  const open = !only && view !== 'todaycard'; cl.toggle('win-open', open);
  if (SHELL.view !== view) { SHELL.view = view; const c = document.querySelector('.content'); if (c) c.scrollTop = 0; }
  shellHud();
  requestAnimationFrame(() => { const c = document.querySelector('.content'), ww = open && c ? c.getBoundingClientRect().width + 12 : 0; document.body.style.setProperty('--win-w', ww + 'px'); if (typeof IS3 === 'object') { const t = ww && ww < innerWidth - 200 ? ww / 2 : 0; if (IS3.offT !== t) { IS3.offT = t; if (typeof is3draw === 'function') is3draw(); } } });
  // while a page is open the world behind only redraws when the island changes
  const tab = (ui.isTab || 'personal') + (ui.hxVisit ? '+v' : '') + (shell2D() ? '2d' : '');
  if (!only && w.firstChild && SHELL.tab === tab) return;
  SHELL.tab = tab;
  const html = viewIslands();
  if (!w.firstChild) w.innerHTML = html; else morphHtml(w, html);
}
// the header over a page: which building you're in, its tabs, and the way back out (filled in by shellHud)
function shellPanel(html) { return view === 'islands' ? '' : html; }

// ---------- HUD (2.78: no top bar) ----------
// top-left counters, one round Menu button bottom-right that opens a ring of the places (keys 1 to 6),
// banners along the top, and the running timer as a small pill at the bottom
const SHELL_RING = [['notice', '📜', 'Notice Board'], ['library', '📚', 'Library'], ['training', '💪', 'Training hall'], ['tavern', '🍺', 'Tavern'], ['hall', '🏰', 'Hall'], ['market', '🛒', 'Market'], ['workshop', '🔨', 'Workshop', 'B']];
function shellHud() {
  const hud = document.getElementById('hudc'); if (!hud || typeof D !== 'object' || !D) return;
  let st = '';
  try {
    const w = cdWallet(), s = studyStreak(), lv = typeof solisLevel === 'function' ? solisLevel(w).n : 1;
    // 2.84: each counter keeps its name with a small plain label under it
    st = `<span class="hc-l" title="Lumen (coins), from studying">✦ <span class="hc-n"><b>${w.lumen.toLocaleString()}</b><small>Lumen · coins</small></span></span><span class="hc-e" title="Ember (gems), from training">🔥 <span class="hc-n"><b>${w.ember.toLocaleString()}</b><small>Ember · gems</small></span></span><button type="button" class="hc-lv" data-shell="bw" data-v="hall" title="Your level (opens the Hall)"><span class="hc-n"><b>Lv ${lv}</b><small>level</small></span></button><span class="hc-st" title="Your study streak">⚡ <span class="hc-n"><b>${s}</b><small>day streak</small></span></span>`;
  } catch (e) { }
  if (hud.innerHTML !== st) hud.innerHTML = st;
  const badge = vs => { const bs = vs.map(v => document.querySelector(`#tabs button[data-view="${v}"]`)?.dataset.badge || '').filter(Boolean), n = bs.reduce((s, x) => s + (parseInt(x) || 0), 0); return n ? (n > 99 ? '99+' : n) : bs.length ? '●' : ''; };
  const ring = document.getElementById('ring'), cur = view === 'bw' ? ui.bw?.id : shellOf(view)?.id;
  if (ring) for (const b of ring.querySelectorAll('[data-shell="bw"]')) { const h = SHELL_HOME.find(x => x.id === b.dataset.v), bd = h ? badge(h.v) : ''; b.classList.toggle('on', b.dataset.v === cur && view !== 'islands'); if ((b.dataset.badge || '') !== bd) { if (bd) b.dataset.badge = bd; else delete b.dataset.badge; } }
  const mb = document.getElementById('menuBtn'); if (mb) { const any = SHELL_HOME.some(h => badge(h.v)); mb.classList.toggle('ping', any); }
  const t = document.querySelector('#shph .shp-t'); if (t) { const b = shellOf(view), o = SHELL_OTHER[view] || [], txt = b ? `${b.e} ${b.n}` : o[0] ? `${o[0]} ${o[1]}` : ''; if (t.textContent !== txt) t.textContent = txt; }
  const bk = document.querySelector('#shph .shp-bk'); if (bk) { const b = shellOf(view) || (view === 'settings' || view === 'board' ? SHELL_HOME.find(h => h.id === (view === 'board' ? 'tavern' : 'hall')) : null); bk.hidden = !b; if (b) bk.dataset.v = b.id; }
  document.body.classList.toggle('win-bw', view === 'bw');
}
function shellRing(on) {
  const r = document.getElementById('ring'), mb = document.getElementById('menuBtn'); if (!r) return;
  on = on == null ? r.hidden : on; r.hidden = !on; mb?.setAttribute('aria-expanded', on ? 'true' : 'false'); mb?.classList.toggle('open', on);
  if (on && typeof sfx === 'function') try { sfx('select'); } catch (e) { }
}
// 2.83: settings are the gear in the top-right corner (and Esc when nothing else is open), not part of the Hall
function shellSettings() { shellMap(false); shellRing(false); view = 'settings'; window.scrollTo(0, 0); render(); }
function shellNothingOpen() {
  return view === 'islands' && !ui.hxP && !ui.hxSel && !ui.isPanel && !ui.hxVisit && !ui.isSel && !ui.isPlace && !(typeof WK === 'object' && WK.on) && !(typeof SO !== 'undefined' && SO)
    && !document.querySelector('dialog[open], #guidefx, #cmdk:not([hidden]), #gqa.open, #ftov') && !(typeof focusFullOpen !== 'undefined' && focusFullOpen) && !(typeof tourAt === 'number' && tourAt >= 0);
}
function shellInit() {
  const content = document.querySelector('.content'); if (!content || document.getElementById('hudc')) return;
  const world = document.createElement('div'); world.id = 'world'; document.body.prepend(world);
  const hud = document.createElement('div'); hud.id = 'hudc'; hud.setAttribute('aria-label', 'Lumen, Ember, level and streak'); document.body.appendChild(hud);
  const ring = document.createElement('nav'); ring.id = 'ring'; ring.hidden = true; ring.setAttribute('aria-label', 'Places');
  ring.innerHTML = SHELL_RING.map(([id, e, n, key], i) => `<button type="button" data-shell="bw" data-v="${id}"><i>${e}</i><span>${n}${typeof HX_PLAIN === 'object' && HX_PLAIN[id] ? `<small>${HX_PLAIN[id]}</small>` : ''}</span><kbd>${key || i + 1}</kbd></button>`).join('')
    + '<hr><button type="button" data-shell="map"><i>🧭</i><span>Map</span><kbd>M</kbd></button><button type="button" data-shell="search"><i>🔍</i><span>Search</span><kbd>Ctrl K</kbd></button><button type="button" data-shell="add"><i>＋</i><span>Add something</span><kbd>Q</kbd></button><button type="button" data-act="feedback"><i>💬</i><span>Feedback</span></button>';
  const mb = document.createElement('button'); mb.type = 'button'; mb.id = 'menuBtn'; mb.dataset.shell = 'ring'; mb.title = 'Menu: every place, map, search and add'; mb.setAttribute('aria-expanded', 'false'); mb.innerHTML = '<span>Menu</span>';
  const gear = document.createElement('button'); gear.type = 'button'; gear.id = 'gearBtn'; gear.dataset.shell = 'settings'; gear.title = 'Settings (Esc)'; gear.setAttribute('aria-label', 'Settings'); gear.textContent = '⚙️';
  document.body.append(ring, mb, gear);
  // the update, offline and warning notes float along the top, over the world too
  const bars = document.createElement('div'); bars.id = 'hudbars';
  for (const id of ['updateBar', 'tempWarn', 'offline']) { const el = document.getElementById(id); if (el) bars.appendChild(el); }
  document.body.appendChild(bars);
  const fb = document.getElementById('focusBar'); if (fb) document.body.appendChild(fb); // the running timer: a pill at the bottom
  const ph = document.createElement('div'); ph.className = 'shp-h'; ph.id = 'shph';
  ph.innerHTML = '<button type="button" class="shp-bk" data-shell="bw" hidden title="Back to the building\'s window">‹ Back</button><span class="shp-t"></span><span class="shp-sub"></span><span class="shp-sp"></span><button type="button" class="shp-x" data-shell="home" title="Back to your island (Esc)">✕</button>';
  content.prepend(ph); const sub = document.getElementById('subnav'); if (sub) ph.querySelector('.shp-sub').appendChild(sub);
  const qa = document.getElementById('gqa'); if (qa) document.body.appendChild(qa);
  if (typeof D === 'object' && D) shellHud();
  setInterval(shellHud, 5000);
}

// ---------- the Today card (pops up when Solis opens; the full Notice Board has everything) ----------
function viewTodayCard() {
  const t = today(), now = new Date(), h = now.getHours(), nowT = now.toTimeString().slice(0, 5);
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const todays = agenda(t, t);
  // lessons today, with the one on now lit up
  let lessons = '';
  try {
    if (typeof schoolCfg === 'function' && schoolCfg().on && isSchoolDay(t)) {
      const m = nowMin(), bells = schoolCfg().bells;
      lessons = bells.map((b, i) => b.brk ? '' : `<span class="tc-les ${hmToMin(b.end) <= m ? 'past' : hmToMin(b.start) <= m ? 'now' : ''}"><small>${fmtTime(b.start)}</small>${esc(subjLabel(periodSubj(t, i)))}</span>`).join('');
    }
  } catch (e) { }
  const nextA = nextOf(D.assessments, a => !a.done && a.date >= t);
  const studied = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0), goal = +D.settings.dailyGoal || 60;
  // the term bar along the bottom
  let term = '';
  try {
    const T = termAt(t);
    if (T) { const all = Math.max(1, diffDays(T.from, T.to) + 1), done = diffDays(T.from, t) + 1, wk = termWeek(t), wks = Math.ceil(all / 7);
      term = `<div class="tc-term"><span>${esc(termLine(t) || T.name || 'Term')}</span><i><b style="width:${Math.min(100, Math.round(done / all * 100))}%"></b></i><span class="muted small-text">Week ${wk} of ${wks}</span></div>`; }
  } catch (e) { }
  let boss = '';
  try { if (!plannerOnly() && hsState().id && bossWeek() !== 'rest') boss = `<button type="button" class="btn small ghost tc-boss" data-shell="travel" data-v="boss" title="Go to the boss island">⚔️ Fight the boss</button>`; } catch (e) { }
  return `<div class="tdcard">
    <div class="tc-top"><div><div class="hero-date">${fullDate(t)}</div><h2>${greet}${D.settings.name ? ', ' + esc(D.settings.name) : ''}</h2>${nextUpLine(todays, nowT)}</div>
      <div class="tc-acts"><button type="button" class="btn primary" data-act="focusNew">▶ Start studying</button><span class="muted small-text">${fmtMins(studied) || '0m'} of ${fmtMins(goal)} today</span></div></div>
    ${lessons ? `<div class="tc-row"><b class="tc-lbl">Lessons</b><div class="tc-less">${lessons}</div></div>` : ''}
    ${nextA ? `<div class="tc-row"><b class="tc-lbl">Next SAC</b><span><b>${esc(subj(nextA.subjectId).name)}: ${esc(nextA.title)}</b> <span class="muted">${fmtDate(nextA.date)} · ${relDays(diffDays(t, nextA.date))}</span></span></div>` : ''}
    ${todoTodayCard('')}
    <div class="tc-foot">${term}<span class="shp-sp"></span>${boss}<button type="button" class="btn small" data-shell="go" data-v="today">📜 Open the Notice Board</button><button type="button" class="btn small primary" data-shell="home">To your island →</button></div>
  </div>`;
}

// ---------- map and travel ----------
function shellMapHtml() {
  const tab = SHELL.tab?.replace(/\+v|2d/g, '') || ui.isTab || 'personal', po = typeof plannerOnly === 'function' && plannerOnly();
  let be = '💀'; try { be = hsBoss(mondayOf(today())).e; } catch (e) { }
  const isl = [['personal', '🏝️', 'Your island', 'Your buildings, farms and collectors'], ['house', '🏰', 'House island', 'Shared builds, the pool, votes and roles'], ['boss', be, 'Boss island', "This week's boss"], ['plaza', '🏛️', 'Plaza', 'Everyone: statues, duels and portals. Coming in a later update']]
    .filter(([id]) => id !== 'house' || !po);
  const blds = HX_FREE.filter(f => f.at).map(f => `<button type="button" class="shm-bl" data-shell="pick" data-k="${f.at}" style="--ac:${f.ac || '#ffc94d'}"><i>${f.e}</i>${esc(f.n)}</button>`).join('');
  return `<div class="shm-in" role="dialog" aria-label="Map"><div class="shm-h"><h3>🧭 Map</h3><span class="muted small-text">Pick an island to fly there</span><span class="shp-sp"></span><button type="button" class="isx" data-shell="mapx" title="Close (Esc)">✕</button></div>
    <div class="shm-isl">${isl.map(([id, e, n, d]) => `<button type="button" class="shm-i ${id === tab && view === 'islands' ? 'on' : ''}" ${id === 'plaza' ? 'disabled' : `data-shell="travel" data-v="${id}"`}><i>${e}</i><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    <div class="shm-sub"><div><div class="shm-lbl">Your island from above</div><div class="shm-mini">${shell2DSvg('personal', true)}</div></div>
      <div><div class="shm-lbl">Buildings</div><div class="shm-bls">${blds}</div></div></div></div>`;
}
function shellMap(on) {
  let m = document.getElementById('shmap');
  if (!on) { if (m) m.remove(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'shmap'; document.body.appendChild(m); }
  try { if (typeof hxMigrate === 'function') hxMigrate(); } catch (e) { }
  m.innerHTML = shellMapHtml();
  if (typeof sfx === 'function') try { sfx('select'); } catch (e) { }
}
// a short fly-over between islands: clouds sweep past while the camera drops in. Any click skips it.
function shellTravel(tab, then) {
  shellMap(false);
  const same = (ui.isTab || 'personal') === tab && view === 'islands';
  const go = () => { Object.assign(ui, { isTab: tab, isSel: null, isPanel: null, isPlace: null, hxSel: null, hxP: null, hxVisit: null }); view = 'islands'; window.scrollTo(0, 0); render(); if (then) then(); };
  if (same) { if (then) then(); return; }
  const w = document.getElementById('world'), fast = shell2D() || D.settings?.lowQuality || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!w || fast) { go(); return; }
  let done = false, raf = 0;
  const end = () => { if (done) return; done = true; cancelAnimationFrame(raf); IS3.fly = 1; w.classList.remove('flying'); removeEventListener('pointerdown', end, true); if (typeof is3draw === 'function') is3draw(); };
  addEventListener('pointerdown', end, true);
  w.classList.add('flying');
  if (typeof sfx === 'function') try { sfx('whoosh'); } catch (e) { }
  setTimeout(() => {
    if (done) { go(); return; }
    go(); const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 900); IS3.fly = 1 + 1.4 * Math.pow(1 - k, 3); if (typeof is3draw === 'function') is3draw(); if (k < 1 && !done) raf = requestAnimationFrame(step); else end(); };
    raf = requestAnimationFrame(step);
  }, 320);
}

// ---------- 2D map (slow computers, no 3D, and the map's view from above) ----------
const SH2_COL = { water: '#2f6bd8', river: '#4c8ff0', grass: '#5aa64a', tree: '#2f7a3a', rock: '#8a8f98', hill: '#7f9a4c', mount: '#7a6e66', road: '#c9a46a', free: '#ffd43b', b: '#e8c07d', deco: '#6fbf73', off: 'none' };
function shell2DSvg(tab, mini) {
  let st;
  try {
    if (tab === 'house') { if (typeof hhSt !== 'function' || !HI.doc) return '<p class="muted small-text">The house island loads when you visit it.</p>'; IS3.house = 'hexh'; st = hhSt(); }
    else { if (!mini) IS3.house = 'hex'; st = mini ? hxState() : hxCur(); }
  } catch (e) { return ''; }
  const W = hxW(st), L = W.land(), [ax, az] = hxPos(1, 0), d = Math.hypot(ax, az), R = d / Math.sqrt(3) * .98;
  const pts = (x, z) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(x + Math.cos(a) * R).toFixed(2)},${(z + Math.sin(a) * R).toFixed(2)}`; }).join(' ');
  let minX = 0, maxX = 0, minZ = 0, maxZ = 0, polys = '', labels = '';
  for (const [k] of L) {
    const [x, z] = hxPos(...hxQR(k)), a = hxAt(k, st); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    const col = a.kind === 'b' && a.it?.wall ? '#9a8f84' : a.kind === 'free' && a.it.ac ? a.it.ac : SH2_COL[a.kind] || SH2_COL.grass;
    const sel = !mini && (k === ui.hxSel || k === HX3?.hover);
    polys += `<polygon points="${pts(x, z)}" fill="${col}" class="${sel ? 'sel' : ''}" ${mini ? `data-shell="pick" data-k="${k}"` : `data-hx2="${k}"`}><title>${esc(a.it?.n || a.kind)}</title></polygon>`;
    const e = a.kind === 'free' ? a.it.e : a.kind === 'b' && a.main === k && !a.it?.wall ? a.it?.e : a.kind === 'tree' ? '🌲' : a.kind === 'rock' ? '🪨' : a.kind === 'mount' ? '⛰️' : a.kind === 'deco' ? a.it?.e : '';
    if (e) labels += `<text x="${x.toFixed(2)}" y="${(z + .45).toFixed(2)}" font-size="${a.kind === 'free' || a.kind === 'b' ? 1.25 : .9}">${e}</text>`;
    if (a.kind === 'free' && !mini) labels += `<text class="sh2n" x="${x.toFixed(2)}" y="${(z + 1.55).toFixed(2)}">${esc(a.it.n)}</text>`;
  }
  const p = 2.4;
  return `<svg class="sh2svg" viewBox="${minX - p} ${minZ - p} ${maxX - minX + 2 * p} ${maxZ - minZ + 2 * p}" preserveAspectRatio="xMidYMid meet">${polys}<g class="sh2l">${labels}</g></svg>`;
}
function shell2DHtml(tab) {
  if (tab === 'boss') return '<div class="isno3d">The boss island is in 3D only.</div>';
  return `<div class="sh2d">${shell2DSvg(tab)}</div>${shell2D() && !D.settings?.map2d ? '' : '<div class="sh2note">2D map · switch back to 3D in the Steward</div>'}`;
}
// a tap on a hex of the 2D map does what a tap on the 3D island does
function shell2DTap(k) {
  const P = ui.hxP, house = (ui.isTab || 'personal') === 'house';
  if (P && P.mode === 'tool') {
    const w = typeof hxPaint === 'function' ? hxPaint(P.id, k) : 'x';
    if (w && w !== '-') toast('Can\'t do that here', w); else P.n = (P.n || 0) + 1;
    if (house && typeof hhPaintDone === 'function') hhPaintDone(); else { save(); render(); }
    return;
  }
  if (P) { if (hxPlace(P, k)) { ui.hxP = null; if (!house) ui.hxSel = k; render(); } return; }
  if (house) { if (typeof hhTap === 'function') hhTap(k); return; }
  if (ui.hxVisit) return;
  const a = hxAt(k), sel = ['free', 'b', 'tree', 'rock', 'road', 'deco'].includes(a.kind) ? k : null;
  if (a.kind === 'free') { hxOpen(a.it.id); return; }
  ui.hxSel = sel; ui.isPanel = null; if (sel && typeof sfx === 'function') try { sfx('select'); } catch (e) { }
  render();
}

// ---------- the Steward: a short plain list at the top of Settings ----------
function stewardHtml() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  let who = 'Not signed in';
  try { if (typeof acct === 'object' && acct && acct.signedIn) who = `Signed in as <b>${esc(acct.username || acct.email || '')}</b>`; } catch (e) { }
  const row = (e, n, sub, act) => `<div class="stw-row"><i>${e}</i><div><b>${n}</b><div class="muted small-text">${sub}</div></div><div class="stw-a">${act}</div></div>`;
  return `<div class="card stw" style="grid-column:1/-1"><div class="card-head"><h2>The essentials</h2><span class="muted small-text">The things you'll want most. Everything else is below.</span></div>
    ${row('👤', 'Sign-in and account', who, `<button class="btn small" data-act="setTab" data-v="you">Account</button>`)}
    ${row('🔒', 'Privacy', 'Your planner stays on this computer. Only your name, avatar, house and leaderboard numbers are shared.', '<a class="btn small" href="https://diddyfoid676767.github.io/life-planner/download/privacy.html" target="_blank" rel="noopener noreferrer">Read the privacy page</a>')}
    ${row('🔔', 'Notifications', perm === 'granted' ? 'On: reminders and timers can pop up.' : perm === 'denied' ? 'Blocked in this browser.' : 'Off for now.', perm === 'granted' || perm === 'unsupported' ? '' : '<button class="btn small" data-shell="notify">Turn on</button>')}
    ${row('🎨', 'Graphics', 'Low graphics drops shadows and weather. The 2D map is for computers that struggle with 3D.', `<label class="row"><input type="checkbox" data-mn="lowq" ${D.settings.lowQuality ? 'checked' : ''}> Low</label><label class="row"><input type="checkbox" data-mn="map2d" ${D.settings.map2d ? 'checked' : ''}> 2D map</label>`)}
    ${typeof ONLINE !== 'undefined' && ONLINE ? '' : row('⬆️', 'Updates', `Solis ${esc(typeof appVersion === 'string' ? appVersion : '')}. Updates install by themselves.`, '<button class="btn small primary" data-act="checkUpdateNow">Check for updates</button>')}
  </div>`;
}

// ---------- clicks and keys ----------
document.addEventListener('click', e => {
  // the island switcher flies you over
  const tb = e.target.closest('[data-is="tab"]');
  if (tb && tb.dataset.v !== 'rank' && !tb.closest('#view')) { e.stopPropagation(); e.preventDefault(); shellTravel(tb.dataset.v); return; }
  const h2 = e.target.closest('[data-hx2]'); if (h2) { shell2DTap(h2.dataset.hx2); return; }
  const el = e.target.closest('[data-shell]');
  if (!el) { if (e.target.id === 'shmap') shellMap(false); else if (e.target.id === 'world' && view !== 'islands') { view = 'islands'; render(); } if (!e.target.closest('#ring')) shellRing(false); return; }
  if (el.closest('#ring')) shellRing(false);
  switch (el.dataset.shell) {
    case 'ring': shellRing(); break;
    case 'bw': shellMap(false); if (typeof bwOpen === 'function') bwOpen(el.dataset.v); break;
    case 'add': setTimeout(() => document.querySelector('#gqa .gqa-btn')?.click(), 0); break;
    case 'home': shellMap(false); if (view !== 'islands') { view = 'islands'; window.scrollTo(0, 0); render(); } break;
    case 'go': shellMap(false); view = el.dataset.v; window.scrollTo(0, 0); render(); break;
    case 'steward': case 'settings': shellSettings(); break;
    case 'search': if (typeof openCmdk === 'function') openCmdk(); break;
    case 'map': shellMap(!document.getElementById('shmap')); break;
    case 'mapx': shellMap(false); break;
    case 'travel': shellTravel(el.dataset.v); break;
    case 'pick': { const k = el.dataset.k; shellTravel('personal', () => { ui.hxSel = k; render(); }); break; }
    case 'notify': if (typeof askNotify === 'function') Promise.resolve(askNotify()).then(() => render()); break;
  }
}, true);
document.addEventListener('keydown', e => {
  const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
  if (document.getElementById('modal')?.open || document.querySelector('dialog[open]') || (document.getElementById('cmdk') && !document.getElementById('cmdk').hidden)) return;
  if (e.key === 'Escape') {
    if (!document.getElementById('ring')?.hidden) { shellRing(false); e.preventDefault(); return; }
    if (document.getElementById('shmap')) { shellMap(false); e.preventDefault(); return; }
    if (view !== 'islands' && !e.defaultPrevented && !(typeof focusFullOpen !== 'undefined' && focusFullOpen)) { view = 'islands'; render(); e.preventDefault(); return; }
    if (!e.defaultPrevented && shellNothingOpen()) { e.preventDefault(); shellSettings(); }
  } else if ((e.key === 'm' || e.key === 'M') && !e.repeat && !ui.hxP) { e.preventDefault(); shellMap(!document.getElementById('shmap')); }
  else if (/^[1-6]$/.test(e.key) && !e.repeat && !ui.hxP && !(typeof WK === 'object' && WK.on)) { e.preventDefault(); shellRing(false); if (typeof bwOpen === 'function') bwOpen(SHELL_RING[+e.key - 1][0]); }
});
shellInit();

// a short walkthrough of the new shell, after the What's new card
if (typeof GUIDES === 'object') GUIDES.game = GUIDES.shell = {
  name: 'Solis is one game now',
  end: () => { if (view !== 'islands') { view = 'islands'; render(); } },
  steps: [
    { title: 'Your island is home 🏝️', text: 'Solis opens on your island. Click a building to open its window: it slides in from the right and the island stays in view.', go: () => { view = 'islands'; ui.isTab = 'personal'; render(); }, sel: '#world' },
    { title: 'Your counters', text: 'Lumen, Ember, your level and your study streak sit in the top-left corner.', sel: '#hudc' },
    { title: 'The Menu button', text: 'Every place is in the <b>Menu</b> ring, with the Map, search and Add. Keys <b>1 to 6</b> jump straight to a place, <b>Q</b> adds something and <b>Ctrl+K</b> searches.', go: () => shellRing(true), sel: '#ring' },
    { title: 'Simple windows', text: 'Each window has one big card, a short list and up to three tabs. Everything else is under <b>More</b>. Press ✕ or <b>Esc</b> to go back to the island.', go: () => { shellRing(false); bwOpen('notice'); }, sel: '.bw' },
  ],
};
