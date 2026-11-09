'use strict';
/* 2.56 menu customisation v1: reorder or hide the sidebar places, pick the
   page Solis opens on, show or hide the cards on Today, density and accent
   colour. Also the graphics quality switch (low drops the 3D shadows). It is
   one small card in Settings, Look & sound. Everything lives in
   D.settings.menu (and D.settings.lowQuality). */
const MENU_CARDS = [['week', 'Week strip'], ['next', 'Next SAC, deadline and race'], ['apps', 'App shortcuts'], ['rivals', 'Friends race bar'], ['house', 'House boss strip']];
const menuCfg = () => { const m = D.settings.menu = D.settings.menu || {}; m.order = m.order || []; m.hide = m.hide || []; m.cards = m.cards || {}; return m; };
const placeIdsInOrder = () => { const o = menuCfg().order; return PLACES.map(p => p.id).sort((a, b) => { const x = o.indexOf(a), y = o.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || PLACES.findIndex(p => p.id === a) - PLACES.findIndex(p => p.id === b); }); };
let menuSig = '';
function applyMenu() {
  if (typeof D !== 'object' || !D || !D.settings) return;
  const m = menuCfg(), ids = placeIdsInOrder(), sig = JSON.stringify([ids, m.hide, m.cards, m.dense, m.accent, D.settings.lowQuality]);
  if (sig === menuSig) return; menuSig = sig;
  const nav = document.getElementById('places'), spacer = nav?.querySelector('.navspacer');
  if (nav && spacer) ids.forEach((id, i) => {
    const b = nav.querySelector(`[data-place="${id}"]`); if (!b) return;
    nav.insertBefore(b, spacer); b.hidden = m.hide.includes(id);
    if (!b.hidden) { const n = ids.slice(0, i + 1).filter(x => !m.hide.includes(x)).length; b.title = `${PLACES.find(p => p.id === id).label} (${n})`; }
  });
  const cl = document.body.classList;
  for (const [k] of MENU_CARDS) cl.toggle('mh-' + k, m.cards[k] === false);
  cl.toggle('dens-compact', !!m.dense);
  if (m.accent) document.documentElement.style.setProperty('--accent', m.accent);
  else if (typeof applyTheme === 'function') applyTheme();
  if (typeof applyQuality === 'function') applyQuality();
}
// open the start page once, when Solis opens
let menuStarted = false;
function menuStart() {
  if (menuStarted || typeof D !== 'object' || !D) return; menuStarted = true;
  const s = menuCfg().start; if (s && s !== 'today') document.querySelector(`#places [data-place="${s}"]`)?.click();
}
function menuCard() {
  const m = menuCfg(), ids = placeIdsInOrder(), lbl = id => PLACES.find(p => p.id === id).label;
  const rows = ids.map((id, i) => `<div class="mnrow"><label><input type="checkbox" data-mn="show" data-id="${id}" ${m.hide.includes(id) ? '' : 'checked'}> ${esc(lbl(id))}</label><span><button class="iconbtn" data-mn="up" data-id="${id}" ${i ? '' : 'disabled'} title="Move up">▲</button><button class="iconbtn" data-mn="down" data-id="${id}" ${i < ids.length - 1 ? '' : 'disabled'} title="Move down">▼</button></span></div>`).join('');
  return `<div class="card" data-sec="theme" style="grid-column:1/-1"><div class="card-head"><h2>Menu &amp; layout</h2></div>
    <div class="mngrid"><div><h3>Sidebar</h3>${rows}</div>
    <div><h3>Today cards</h3>${MENU_CARDS.map(([k, l]) => `<label class="row"><input type="checkbox" data-mn="card" data-id="${k}" ${m.cards[k] === false ? '' : 'checked'}> ${l}</label>`).join('')}
      <h3>Open on</h3><select data-mn="start">${[['today', 'Today'], ...PLACES.filter(p => p.id !== 'today').map(p => [p.id, p.label])].map(([v, l]) => `<option value="${v}" ${(m.start || 'today') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div><h3>Look</h3><label class="row"><input type="checkbox" data-mn="dense" ${m.dense ? 'checked' : ''}> Compact spacing</label>
      <div class="row">Accent colour <input type="color" data-mn="accent" value="${m.accent || '#4f6df5'}"><button class="btn small" data-mn="accentReset" ${m.accent ? '' : 'disabled'}>Reset</button></div>
      <h3>Graphics</h3><label class="row"><input type="checkbox" data-mn="lowq" ${D.settings.lowQuality ? 'checked' : ''}> Low graphics (no shadows)</label></div></div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-mn]'); if (!b || !D) return;
  const m = menuCfg(), id = b.dataset.id;
  if (b.dataset.mn === 'up' || b.dataset.mn === 'down') { const ids = placeIdsInOrder(), i = ids.indexOf(id), j = i + (b.dataset.mn === 'up' ? -1 : 1); if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; m.order = ids; }
  else if (b.dataset.mn === 'accentReset') delete m.accent;
  else return;
  save(); applyMenu(); render();
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset?.mn || !D) return;
  const m = menuCfg(), k = el.dataset.mn, id = el.dataset.id;
  if (k === 'show') { if (el.checked) m.hide = m.hide.filter(x => x !== id); else if (PLACES.length - m.hide.length > 1) m.hide.push(id); else { el.checked = true; return; } }
  else if (k === 'card') m.cards[id] = el.checked;
  else if (k === 'start') m.start = el.value;
  else if (k === 'dense') m.dense = el.checked;
  else if (k === 'accent') m.accent = el.value;
  else if (k === 'lowq') D.settings.lowQuality = el.checked;
  else return;
  save(); applyMenu(); render();
});
