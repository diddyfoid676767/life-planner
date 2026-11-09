'use strict';
/* The sidebar (2.55 navigation cleanup): five places, Today · Study · Fitness
   · Islands · Friends, plus You at the bottom. Each place holds one or more
   pages, shown as one row of tabs above the page. The original page buttons
   (#tabs) stay in the page but hidden, because the rest of the app sets
   badges on them and clicks them to change page; this file mirrors them.
   Also here: keys 1 to 6, icons-only sidebar on narrow windows, Lumen / Ember / streak in
   the footer and the one quick-add button. */
const PLACES = [
  { id: 'today', label: 'Today', views: ['today', 'calendar'] },
  { id: 'study', label: 'Study', views: ['study'] },
  { id: 'fitness', label: 'Fitness', views: ['training'] },
  { id: 'islands', label: 'Islands', views: ['islands'] },
  { id: 'friends', label: 'Friends', views: ['friends'] },
  { id: 'you', label: 'You', views: ['profile', 'settings'], extra: ['settings'] }, // 2.57: an ordinary sixth place; Settings sits behind the gear on You
];
const PLACE_ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  study: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  fitness: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  islands: '<path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M6 14c1-3 4-4 6-4s5 1 6 4"/><path d="M12 10V4l4 2-4 2"/>',
  you: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
};
const SUB_LABEL = { today: 'Today', friends: 'Chats' };
// old page names still work (links, saved state, the setup tour)
const VIEW_ALIAS = { day: 'today', plan: 'today', inbox: 'today', personal: 'today', todo: 'today', school: 'today', chats: 'friends', character: 'profile', forest: 'islands', arena: 'islands', house: 'islands', training2: 'training', board: 'islands' };
const placeOf = v => PLACES.find(p => p.views.includes(VIEW_ALIAS[v] || v));
// the sidebar button for a page, for the setup tour to point at
function placeBtn(v) { const p = placeOf(v); return p ? document.querySelector(`#places [data-place="${p.id}"]`) : document.querySelector(`#places [data-go="${VIEW_ALIAS[v] || v}"]`); }

(() => {
  const tabs = document.getElementById('tabs'), side = document.querySelector('.sidebar'), main = document.getElementById('view');
  if (!tabs || !side || !main) return;
  document.body.classList.add('places-on');
  let last = {};
  try { last = JSON.parse(localStorage.getItem('lpPlaceLast') || '{}') || {}; } catch (e) { }
  const nav = document.createElement('nav'); nav.id = 'places'; nav.setAttribute('aria-label', 'Places');
  nav.innerHTML = PLACES.map((p, i) => `<button type="button" data-place="${p.id}" title="${p.label} (${i + 1})"><svg viewBox="0 0 24 24" aria-hidden="true">${PLACE_ICON[p.id]}</svg><span>${p.label}</span></button>`).join('')
    + '<div class="navspacer"></div>';
  tabs.after(nav);
  const sub = document.createElement('nav'); sub.id = 'subnav'; sub.setAttribute('aria-label', 'Pages'); sub.hidden = true;
  main.before(sub);

  const tabOf = v => tabs.querySelector(`button[data-view="${v}"]`);
  const go = v => tabOf(v)?.click();
  const labelOf = v => SUB_LABEL[v] || tabOf(v)?.querySelector('span')?.textContent || v;
  const badgeOf = v => tabOf(v)?.dataset.badge || '';
  const setAttr = (el, k, val) => { if (val) { if (el.getAttribute(k) !== String(val)) el.setAttribute(k, val); } else if (el.hasAttribute(k)) el.removeAttribute(k); };
  const foot = document.getElementById('sideStats');
  // 2.56: feedback is always one click away, at the bottom of the sidebar
  const fb = document.createElement('button'); fb.type = 'button'; fb.id = 'fbBtn'; fb.className = 'fbbtn'; fb.dataset.act = 'feedback'; fb.title = 'Send feedback or report a bug';
  fb.innerHTML = '<span>💬</span><span class="fbl">Feedback</span>';
  // 2.57.2: Settings is always one click away: a gear next to Feedback, and in the top bar on narrow windows
  const gear = (id, cls) => { const g = document.createElement('button'); g.type = 'button'; g.id = id; g.className = cls; g.title = 'Settings'; g.setAttribute('aria-label', 'Settings'); g.textContent = '⚙'; g.addEventListener('click', () => go('settings')); return g; };
  const fbRow = document.createElement('div'); fbRow.className = 'fbrow'; fbRow.append(fb, gear('setBtn', 'setbtn'));
  (document.querySelector('.sidefoot') || side).prepend(fbRow);
  side.appendChild(gear('setBtnTop', 'setbtn settop'));

  function sync() {
    const cur = tabs.querySelector('button.active')?.dataset.view || '';
    const here = placeOf(cur);
    if (here && last[here.id] !== cur && !(here.extra || []).includes(cur)) { last[here.id] = cur; try { localStorage.setItem('lpPlaceLast', JSON.stringify(last)); } catch (e) { } }
    for (const b of nav.querySelectorAll('[data-place]')) {
      const p = PLACES.find(x => x.id === b.dataset.place);
      b.classList.toggle('active', here === p);
      // badges only for things that need you: a count adds up across the place's pages, a dot shows as a dot
      const bs = p.views.map(badgeOf).filter(Boolean), n = bs.reduce((s, x) => s + (parseInt(x) || 0), 0);
      setAttr(b, 'data-badge', n ? (n > 99 ? '99+' : n) : bs.length ? '●' : '');
    }
    // one row of tabs: the place's main pages, plus an extra page (To-do, Class mode) while you're on it
    // 2.59: Settings opens from the gear on its own, without a You | Settings row of tabs above it
    const vs = here && !(here.extra || []).includes(cur) ? here.views.filter(v => !(here.extra || []).includes(v)) : [];
    sub.hidden = vs.length < 2;
    const html = vs.length < 2 ? '' : vs.map(v => `<button type="button" data-go="${v}" class="${v === cur ? 'active' : ''}"${badgeOf(v) ? ` data-badge="${badgeOf(v)}"` : ''}>${labelOf(v)}</button>`).join('');
    if (sub.innerHTML !== html) sub.innerHTML = html;
    document.body.dataset.place = here ? here.id : cur;
  }
  // the footer: Lumen, Ember and your streak, and your avatar on the You button
  function syncFoot() {
    if (typeof D !== 'object' || !D) return;
    try {
      const w = typeof cdWallet === 'function' ? cdWallet() : null, st = typeof studyStreak === 'function' ? studyStreak() : 0;
      const html = `<div class="sfcur" title="Lumen from study · Ember from training · your study streak">${w ? `<span class="cd-l">✦ <b>${w.lumen.toLocaleString()}</b></span><span class="cd-e">🔥 <b>${w.ember.toLocaleString()}</b></span>` : ''}<span class="sfst">⚡ <b>${st}</b><small>day streak</small></span></div>`;
      if (foot && foot.innerHTML !== html) foot.innerHTML = html;
    } catch (e) { }
  }
  const visiblePlaces = () => (typeof placeIdsInOrder === 'function' ? placeIdsInOrder() : PLACES.map(p => p.id)).map(id => PLACES.find(p => p.id === id)).filter(p => !(D?.settings?.menu?.hide || []).includes(p.id));
  const openPlace = p => go(p.views.includes(last[p.id]) ? last[p.id] : p.views[0]);
  nav.addEventListener('click', e => {
    const s = e.target.closest('[data-go]'); if (s) { go(s.dataset.go); return; }
    const b = e.target.closest('[data-place]'); if (!b) return;
    openPlace(PLACES.find(x => x.id === b.dataset.place));
  });
  sub.addEventListener('click', e => { const s = e.target.closest('[data-go]'); if (s) go(s.dataset.go); });
  // keys 1 to 6 jump between places (not while typing)
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.getElementById('modal')?.open || !document.getElementById('cmdk')?.hidden && document.getElementById('cmdk')) return;
    const vis = visiblePlaces(), i = +e.key; if (i >= 1 && i <= vis.length) { e.preventDefault(); openPlace(vis[i - 1]); }
  });
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; sync(); syncFoot(); }); } })
    .observe(tabs, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-badge'] });
  sync();
  setInterval(syncFoot, 5000); setTimeout(syncFoot, 300);
  window.syncSideFoot = syncFoot;

  // one quick-add button on every page: a task, a study session or a workout
  const qa = document.createElement('div'); qa.id = 'gqa';
  qa.innerHTML = '<button type="button" class="gqa-btn" title="Add something (Q)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add</span><kbd>Q</kbd></button><div class="gqa-menu" hidden>'
    + [['todo', '✅', 'Task'], ['workout', '🏃', 'Workout'], ['assessment', '📝', 'SAC or exam'], ['event', '📆', 'Event']].map(([k, ic, l]) => `<button type="button" data-act="new" data-kind="${k}"><span>${ic}</span>${l}</button>`).join('')
    + '</div>';
  (side.querySelector('.brand') || side).after(qa);
  const menu = qa.querySelector('.gqa-menu'), openQa = on => { menu.hidden = !on; qa.classList.toggle('open', on); };
  qa.querySelector('.gqa-btn').addEventListener('click', () => openQa(menu.hidden));
  menu.addEventListener('click', () => setTimeout(() => openQa(false), 0));
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#gqa')) openQa(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { openQa(false); return; }
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    if (e.key.toLowerCase() === 'q' && !document.getElementById('modal')?.open) { e.preventDefault(); openQa(menu.hidden); }
  });
})();
