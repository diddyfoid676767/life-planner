'use strict';
/* Villagers (2.71, roadmap stage 3d). Loaded after hxsky.js.
   Little villagers walk your roads (and the house island's), stop by buildings that touch a
   road for a moment, then wander on. 2.80: they're KayKit characters (hero.js) with a random look and real
   walk animations. Low graphics leaves them out. */
const HX_VIL = { max: 8, per: 3, speed: .9, scale: .24 };
function hxVilBuild(W, st, W0) {
  if (HX3.vil) for (const v of HX3.vil.list) v.H?.dispose();
  HX3.vil = null;
  if (hxLow()) return;
  const roads = new Set(st.road); if (roads.size < 2) return;
  // 2.80: villagers are KayKit characters with real walk animations; the pack loads first
  if (!heroReady()) { if (!HERO.fail) heroLoad().then(g => { if (g && view === 'islands') { HX3.sig = ''; render(); } }); return; }
  const n = Math.min(HX_VIL.max, Math.floor(roads.size / HX_VIL.per) + 1), list = [...roads], r = seeded('hxvil' + list.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const H = heroVillager(r, { scale: HX_VIL.scale }); if (!H) break;
    const g = H.root, body = H.rig;
    const at = list[Math.floor(r() * list.length)], [x, z] = hxPos(...hxQR(at));
    g.position.set(x + (r() - .5) * .6, typeof hxHt === 'function' ? hxHt(at, st) : 0, z + (r() - .5) * .6); W.add(g);
    out.push({ g, H, body, at, to: null, from: [g.position.x, g.position.z], dest: null, p: 1, wait: r() * 2, ph: r() * 6, sp: HX_VIL.speed * (.8 + r() * .4), prev: null });
  }
  HX3.vil = { list: out, roads, st, W0, t: performance.now() };
}
// where a villager heads next: along the road, or into a building beside it for a moment
function hxVilNext(v, V) {
  const nb = hxNb(v.at), roadN = nb.filter(k => V.roads.has(k)), bld = nb.filter(k => { const a = hxAt(k, V.st); return a.kind === 'b' && !a.it?.wall && !a.it?.field || a.kind === 'free'; });
  if (v.inside) { v.inside = false; return { k: v.at, wait: 0 }; }
  if (bld.length && Math.random() < .25) { const k = bld[Math.floor(Math.random() * bld.length)]; v.inside = true; return { k, half: true, wait: 1.5 + Math.random() * 2.5 }; }
  const fwd = roadN.filter(k => k !== v.prev), pick = fwd.length ? fwd : roadN;
  if (!pick.length) return { k: v.at, wait: 1 + Math.random() * 2 };
  return { k: pick[Math.floor(Math.random() * pick.length)], wait: Math.random() < .15 ? Math.random() * 1.5 : 0 };
}
function hxVilStep(now) {
  const V = HX3.vil; if (!V) return;
  const dt = Math.min(.1, (now - V.t) / 1000), t = now / 1000; V.t = now;
  for (const v of V.list) {
    if (v.wait > 0) { v.wait -= dt; v.H.play('Idle', { fade: .3 }); v.H.update(dt, t); continue; }
    if (v.p >= 1) {
      const nx = hxVilNext(v, V), [ax, az] = hxPos(...hxQR(v.at)), [bx, bz] = hxPos(...hxQR(nx.k));
      v.from = [v.g.position.x, v.g.position.z];
      // into a building: stop at its door (part way across); along a road: a little to one side, like a footpath
      const side = (v.ph % 1 - .5) * .5;
      v.dest = nx.half ? [ax + (bx - ax) * .55, az + (bz - az) * .55] : [bx + side * (bz - az) / 2, bz - side * (bx - ax) / 2];
      if (!nx.half && nx.k !== v.at) { v.prev = v.at; v.at = nx.k; }
      v.p = 0; v.len = Math.max(.1, Math.hypot(v.dest[0] - v.from[0], v.dest[1] - v.from[1])); v.after = nx.wait;
      if (v.len > .05) v.yaw = Math.atan2(v.dest[0] - v.from[0], v.dest[1] - v.from[1]);
    }
    v.p = Math.min(1, v.p + dt * v.sp / v.len);
    v.g.position.x = v.from[0] + (v.dest[0] - v.from[0]) * v.p; v.g.position.z = v.from[1] + (v.dest[1] - v.from[1]) * v.p;
    if (v.yaw != null) { let d = v.yaw - v.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); v.g.rotation.y += d * Math.min(1, dt * 8); }
    v.H.play('Walking_A', { speed: v.sp / .75, fade: .3 }); v.H.update(dt, t);
    if (v.p >= 1) v.wait = v.after || 0;
  }
}

/* Visiting a housemate's island (2.71). Your island is shared with your house as a small snapshot
   (isles/<uid> via /api/account/isle, at most every 10 minutes and only when it changed). The
   Visit panel lists your housemates' islands; visiting draws theirs read-only, with their
   terraforming, decorations and look, and Back home returns. */
const HX_ISLE = { at: 0, sig: '', busy: false, list: null, lat: 0, err: '' };
function hxIsleSnap() {
  const st = hxState(), b = {};
  for (const [k, s] of Object.entries(st.b)) { const it = hxItem(s.id); if (!it) continue; b[k] = [s.id, hxLvOn(s), hxCond(k) || 'ok', s.rot || 0]; }
  return JSON.stringify({ v: 1, b, road: st.road, clr: st.clr, tf: st.tf || {}, th: st.theme || '', col: hxCol() });
}
function hxIsleOn() { return typeof acct === 'object' && acct.configured && acct.signedIn && typeof hsState === 'function' && !!hsState().id && !(typeof plannerOnly === 'function' && plannerOnly()); }
// shares your island when it changed (called when your island is drawn)
function hxIslePublish() {
  if (HX_ISLE.busy || !hxIsleOn() || Date.now() - HX_ISLE.at < 10 * 6e4) return;
  const d = hxIsleSnap(); if (d === HX_ISLE.sig || d.length > 60000) return;
  HX_ISLE.busy = true;
  fetch('/api/account/isle', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ h: hsState().id, n: acct.name || acct.username || '', d }) })
    .then(r => { if (r.ok) HX_ISLE.sig = d; }).catch(() => { }).finally(() => { HX_ISLE.busy = false; HX_ISLE.at = Date.now(); });
}
function hxIsleList(force) {
  if (!hxIsleOn() || HX_ISLE.lbusy || (!force && HX_ISLE.list && Date.now() - HX_ISLE.lat < 120000)) return;
  HX_ISLE.lbusy = true;
  fetch('/api/account/isle?h=' + hsState().id, { cache: 'no-store' }).then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || 'failed'); return j; }))
    .then(j => { HX_ISLE.list = j; HX_ISLE.err = ''; }).catch(e => { HX_ISLE.err = e.message; HX_ISLE.list = HX_ISLE.list || []; })
    .finally(() => { HX_ISLE.lbusy = false; HX_ISLE.lat = Date.now(); if (view === 'islands' && ui.isPanel === 'visit') render(); });
}
// a housemate's snapshot as a read-only island state the hex code can draw
function hxVisitState(row) {
  let d; try { d = JSON.parse(row.d); } catch { return null; }
  const b = {}; for (const [k, a] of Object.entries(d.b || {})) if (Array.isArray(a) && hxItem(a[0])) b[k] = { id: a[0], lv: a[1] || 1, c: a[2] || 'ok', rot: a[3] || 0, start: '2000-01-01', ready: '2000-01-01' };
  const st = { b, road: Array.isArray(d.road) ? d.road : [], clr: Array.isArray(d.clr) ? d.clr : [], tf: d.tf && typeof d.tf === 'object' ? d.tf : {}, theme: HX_THEMES[d.th] ? d.th : '' };
  st.__w = { ...HX_HOME_W, visit: true, col: HX_KCOL.includes(d.col) ? d.col : 'blue', sig: () => 'visit|' + row.uid + '|' + row.ut, look: (k, s) => ({ c: s.c, lv: s.lv, up: false, p: 1 }) };
  return st;
}
function hxVisitView() {
  const V = ui.hxVisit;
  const hud = `<div class="ishud is-tl"><div class="hxvisit"><span>🏘️ Visiting <b>${esc(V.n || 'a housemate')}</b>'s island</span><small>Look around: nothing here can be changed.</small></div></div>
    <div class="ishud is-bl"><button class="isbtn big" data-hx="vhome" title="Back to your island (Esc)">🏝️<span>Back home</span></button><button class="isbtn" data-hx="panel" data-v="visit">🏘️<span>Visit</span></button></div>`;
  return isFrame('personal', hud, ui.isPanel === 'visit' ? isPanel('🏘️ Visit a housemate', hxVisitHtml()) : '');
}
function hxVisitHtml() {
  if (!hxIsleOn()) return '<p class="muted">Sign in and join a house to visit your housemates\' islands.</p>';
  hxIsleList();
  const L = HX_ISLE.list; if (!L) return '<p class="muted">Finding your housemates\' islands…</p>';
  const rows = L.filter(r => !r.me);
  return `${HX_ISLE.err ? `<p class="small-text muted">Couldn't load the list right now (${esc(HX_ISLE.err)}).</p>` : ''}
    ${rows.length ? `<div class="hxvlist">${rows.map(r => `<button class="hxvrow ${ui.hxVisit?.uid === r.uid ? 'on' : ''}" data-hx="visit" data-v="${esc(r.uid)}"><span>🏝️</span><b>${esc(r.n || 'Housemate')}</b><small>${r.ut ? 'updated ' + fmtDate(r.ut.slice(0, 10)) : ''}</small></button>`).join('')}</div>` : '<p class="muted">None of your housemates have shared an island yet. Islands are shared when their owner opens them in Solis 2.71 or later.</p>'}
    <p class="muted small-text">Your own island is shared with your house too, so they can visit you.</p>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-hx="visit"],[data-hx="vhome"]'); if (!el) return;
  if (el.dataset.hx === 'vhome') { ui.hxVisit = null; ui.isPanel = null; HX3.sig = ''; render(); return; }
  const row = (HX_ISLE.list || []).find(r => r.uid === el.dataset.v), st = row && hxVisitState(row);
  if (!st) { toast('Couldn\'t open that island', 'Try again in a minute.'); return; }
  Object.assign(ui, { hxVisit: { uid: row.uid, n: row.n, st }, isPanel: null, hxSel: null, hxP: null }); HX3.sig = '';
  if (typeof sfx === 'function') sfx('select'); render();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.hxVisit && view === 'islands' && !ui.isPanel) { ui.hxVisit = null; HX3.sig = ''; render(); } });
