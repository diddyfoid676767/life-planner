'use strict';
/* The sidebar: five places instead of a long list of tabs. Each place holds
   one or more pages, shown as tabs along the top of the page. The original
   tab buttons (#tabs) stay in the page but hidden, because the rest of the
   app sets badges on them and clicks them to change page; this file mirrors
   them into the places and the tabs above the page. */
const PLACES = [
  { id: 'today', label: 'Today', views: ['today'] },
  { id: 'plan', label: 'Plan', views: ['calendar', 'todo', 'inbox'] },
  { id: 'study', label: 'Study', views: ['study', 'school'] },
  { id: 'fitness', label: 'Fitness', views: ['training'] },
  { id: 'house', label: 'House', views: ['house', 'character'] },
  { id: 'friends', label: 'Friends', views: ['friends', 'board', 'profile'] },
];
const PLACE_ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  study: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  fitness: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  house: '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
};
const SUB_LABEL = { friends: 'Chats', training: 'Training & Health', inbox: 'Missed info', school: 'Class mode', board: 'Leaderboard' };
const placeOf = v => PLACES.find(p => p.views.includes(v));
// the sidebar button for a page, for the setup tour to point at
function placeBtn(v) { const p = placeOf(v); return p ? document.querySelector(`#places [data-place="${p.id}"]`) : document.querySelector(`#places [data-go="${v}"]`); }

(() => {
  const tabs = document.getElementById('tabs'), side = document.querySelector('.sidebar'), main = document.getElementById('view');
  if (!tabs || !side || !main) return;
  document.body.classList.add('places-on');
  let last = {};
  try { last = JSON.parse(localStorage.getItem('lpPlaceLast') || '{}') || {}; } catch (e) { }
  const nav = document.createElement('nav'); nav.id = 'places'; nav.setAttribute('aria-label', 'Places');
  nav.innerHTML = PLACES.map(p => `<button type="button" data-place="${p.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${PLACE_ICON[p.id]}</svg><span>${p.label}</span></button>`).join('')
    + '<div class="navspacer"></div><button type="button" data-go="settings" class="pl-set"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span>Settings</span></button>';
  tabs.after(nav);
  const sub = document.createElement('nav'); sub.id = 'subnav'; sub.setAttribute('aria-label', 'Pages'); sub.hidden = true;
  main.before(sub);

  const tabOf = v => tabs.querySelector(`button[data-view="${v}"]`);
  const go = v => tabOf(v)?.click();
  const shown = v => { const b = tabOf(v); return b && (!b.hidden || b.classList.contains('active')); };
  const labelOf = v => SUB_LABEL[v] || tabOf(v)?.querySelector('span')?.textContent || v;
  const badgeOf = v => tabOf(v)?.dataset.badge || '';
  const setAttr = (el, k, val) => { if (val) { if (el.getAttribute(k) !== String(val)) el.setAttribute(k, val); } else if (el.hasAttribute(k)) el.removeAttribute(k); };

  function sync() {
    const cur = tabs.querySelector('button.active')?.dataset.view || '';
    const here = placeOf(cur);
    if (here && last[here.id] !== cur) { last[here.id] = cur; try { localStorage.setItem('lpPlaceLast', JSON.stringify(last)); } catch (e) { } }
    for (const b of nav.querySelectorAll('[data-place]')) {
      const p = PLACES.find(x => x.id === b.dataset.place), vs = p.views.filter(shown);
      b.hidden = !vs.length;
      b.classList.toggle('active', here === p);
      // a count adds up across the place's pages; a dot (●) shows as a dot
      const bs = vs.map(badgeOf).filter(Boolean), n = bs.reduce((s, x) => s + (parseInt(x) || 0), 0);
      setAttr(b, 'data-badge', n ? (n > 99 ? '99+' : n) : bs.length ? '●' : '');
    }
    nav.querySelector('.pl-set').classList.toggle('active', cur === 'settings');
    const vs = here ? here.views.filter(shown) : [];
    sub.hidden = vs.length < 2;
    const html = vs.length < 2 ? '' : vs.map(v => `<button type="button" data-go="${v}" class="${v === cur ? 'active' : ''}"${badgeOf(v) ? ` data-badge="${badgeOf(v)}"` : ''}>${labelOf(v)}</button>`).join('');
    if (sub.innerHTML !== html) sub.innerHTML = html;
    document.body.dataset.place = here ? here.id : cur;
  }
  nav.addEventListener('click', e => {
    const s = e.target.closest('[data-go]'); if (s) { go(s.dataset.go); return; }
    const b = e.target.closest('[data-place]'); if (!b) return;
    const p = PLACES.find(x => x.id === b.dataset.place), vs = p.views.filter(shown);
    go(vs.includes(last[p.id]) ? last[p.id] : vs[0]);
  });
  sub.addEventListener('click', e => { const s = e.target.closest('[data-go]'); if (s) go(s.dataset.go); });
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; sync(); }); } })
    .observe(tabs, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-badge'] });
  sync();
})();
