'use strict';
/* Ctrl+K: one search box that jumps to any page, runs a common action, or
   opens a task, SAC, event or race by name. */
(() => {
  const box = document.createElement('div'); box.id = 'cmdk'; box.hidden = true;
  box.innerHTML = '<div class="cmdk-in" role="dialog" aria-label="Search"><input id="cmdkQ" placeholder="Search pages, tasks, SACs, subjects and friends…" autocomplete="off" spellcheck="false"><ul id="cmdkList" role="listbox"></ul><div class="cmdk-foot">↑↓ to move · Enter to open · Esc to close</div></div>';
  document.body.appendChild(box);
  const q = box.querySelector('#cmdkQ'), list = box.querySelector('#cmdkList');
  let rows = [], at = 0;
  const label = v => document.querySelector(`#tabs button[data-view="${v}"] span`)?.textContent || v;
  const act = (a, extra = {}) => () => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra); b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); };
  const goView = v => () => document.querySelector(`#tabs button[data-view="${v}"]`)?.click();
  function all() {
    const out = [];
    for (const p of (typeof PLACES !== 'undefined' ? PLACES : [])) for (const v of p.views) out.push({ k: 'Page', t: label(v), sub: p.label, run: goView(v) });
    out.push({ k: 'Page', t: 'You', sub: 'character, avatar, stats', run: goView('profile') });
    out.push({ k: 'Page', t: 'Settings', run: goView('settings') });
    out.push({ k: 'Page', t: 'Your island', sub: 'Islands', run: () => { ui.isTab = 'personal'; goView('islands')(); } });
    out.push({ k: 'Page', t: 'House island and your house', sub: 'Islands', run: () => { ui.isTab = 'house'; goView('islands')(); } });
    out.push({ k: 'Page', t: 'Boss island: fight the weekly boss', sub: 'Islands', run: () => { ui.isTab = 'boss'; goView('islands')(); } });
    out.push({ k: 'Action', t: 'Start studying', run: act('focusNew') });
    out.push({ k: 'Action', t: 'Add a task', run: act('new', { kind: 'todo' }) });
    out.push({ k: 'Action', t: 'Add a study session', run: act('new', { kind: 'session' }) });
    out.push({ k: 'Action', t: 'Log a workout', run: act('new', { kind: 'workout' }) });
    out.push({ k: 'Action', t: 'Add a SAC or exam', run: act('new', { kind: 'assessment' }) });
    out.push({ k: 'Action', t: 'Add an event', run: act('new', { kind: 'event' }) });
    out.push({ k: 'Action', t: 'Send feedback', run: act('feedback') });
    if (typeof D !== 'object' || !D) return out;
    const t = typeof today === 'function' ? today() : '';
    const add = (arr, kind, k, title) => { for (const x of arr || []) { const n = title(x); if (n && !x.done) out.push({ k, t: n, sub: (x.date || x.due) && typeof fmtDate === 'function' ? fmtDate(x.date || x.due) : '', run: act('edit', { kind, id: x.id }), old: (x.date || x.due || '9') < t }); } };
    add(D.todos, 'todo', 'Task', x => x.text);
    add(D.assessments, 'assessment', 'SAC / exam', x => x.title);
    add(D.events, 'event', 'Event', x => x.title);
    add(D.trainingEvents, 'tevent', 'Race / event', x => x.title || x.name);
    for (const x of D.subjects || []) out.push({ k: 'Subject', t: x.name, sub: 'Study', run: goView('study') });
    if (typeof allFriendRows === 'function') try { for (const f of allFriendRows()) out.push({ k: 'Friend', t: f.name, sub: f.user ? '@' + f.user : '', run: goView('friends') }); } catch (e) { }
    return out;
  }
  function draw() {
    const s = q.value.trim().toLowerCase(), words = s.split(/\s+/).filter(Boolean);
    let r = all().filter(x => words.every(w => (x.t + ' ' + (x.sub || '') + ' ' + x.k).toLowerCase().includes(w)));
    if (!s) r = r.filter(x => x.k === 'Page' || x.k === 'Action');
    r.sort((a, b) => (a.old - b.old) || (b.t.toLowerCase().startsWith(s) - a.t.toLowerCase().startsWith(s)));
    rows = r.slice(0, 12); at = Math.min(at, Math.max(0, rows.length - 1));
    list.innerHTML = rows.length ? rows.map((x, i) => `<li role="option" data-i="${i}" class="${i === at ? 'on' : ''}"><span class="cmdk-k">${esc(x.k)}</span><span class="cmdk-t">${esc(x.t)}</span>${x.sub ? `<span class="cmdk-s">${esc(x.sub)}</span>` : ''}</li>`).join('') : '<li class="cmdk-none">Nothing found</li>';
  }
  function open(on) {
    box.hidden = !on;
    if (on) { q.value = ''; at = 0; draw(); q.focus(); }
  }
  function run(i) { const x = rows[i]; if (!x) return; open(false); x.run(); }
  window.openCmdk = () => open(true);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { if (document.getElementById('modal')?.open) return; e.preventDefault(); open(box.hidden); return; }
    if (box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); open(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(rows.length - 1, at + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(at); }
  });
  q.addEventListener('input', () => { at = 0; draw(); });
  list.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) run(+li.dataset.i); });
  box.addEventListener('mousedown', e => { if (e.target === box) open(false); });
  // a search button at the top of the sidebar, so Ctrl+K isn't the only way in
  const side = document.querySelector('.sidebar .brand');
  if (side) { const b = document.createElement('button'); b.type = 'button'; b.id = 'cmdkBtn'; b.title = 'Search (Ctrl+K)';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>Search</span><kbd>Ctrl K</kbd>';
    b.addEventListener('click', () => open(true)); side.after(b); }
})();
