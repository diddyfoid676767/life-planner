'use strict';
/* Phone-sized screens: the sidebar becomes a tab bar along the bottom with
   four main tabs and a More button that opens every other tab as a grid.
   The tabs are the sidebar's own buttons, so clicking one works as usual and
   a custom tab order from Settings still applies. */
(() => {
  const mq = matchMedia('(max-width: 640px)'), MAIN = ['today', 'calendar', 'study', 'training'];
  const SHORT = { training: 'Training', friends: 'Friends', school: 'Class', board: 'Ranks', inbox: 'Missed' };
  const tabs = document.getElementById('tabs'), side = document.querySelector('.sidebar');
  if (!tabs || !side) return;
  const more = document.createElement('button');
  more.id = 'mnavMore'; more.type = 'button';
  more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>More</span>';
  side.appendChild(more);
  const shade = document.createElement('div'), sheet = document.createElement('nav');
  shade.id = 'mnavShade'; sheet.id = 'mnavSheet';
  document.body.append(shade, sheet);

  // More: copies of the other tabs; tapping one clicks the real tab
  function open(on) {
    if (on) sheet.innerHTML = [...tabs.querySelectorAll('button[data-view]:not(.mprim)')].filter(b => !b.hidden && b.style.display !== 'none')
      .map(b => `<button type="button" data-go="${b.dataset.view}" class="${b.classList.contains('active') ? 'active' : ''}"${b.dataset.badge ? ` data-badge="${b.dataset.badge}"` : ''}>${b.innerHTML}</button>`).join('');
    document.body.classList.toggle('mnav-open', on);
  }
  sheet.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (!g) return;
    open(false); tabs.querySelector(`button[data-view="${g.dataset.go}"]`)?.click();
  });
  // which four tabs sit on the bar: the usual ones that are shown, topped up in tab order
  const set = (el, cls, on) => { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };
  function mark() {
    const all = [...tabs.querySelectorAll('button[data-view]')];
    const shown = all.filter(b => !b.hidden && b.dataset.view !== 'settings' && b.style.display !== 'none');
    const pick = MAIN.filter(v => shown.some(b => b.dataset.view === v));
    for (const b of shown) if (pick.length < 4 && !pick.includes(b.dataset.view)) pick.push(b.dataset.view);
    for (const b of all) {
      set(b, 'mprim', pick.includes(b.dataset.view));
      const sp = b.querySelector('span'); // a short name so the label fits under the icon
      if (sp && SHORT[b.dataset.view] && sp.dataset.short !== SHORT[b.dataset.view]) sp.dataset.short = SHORT[b.dataset.view];
    }
    const act = tabs.querySelector('button.active');
    set(more, 'active', !!act && !act.classList.contains('mprim'));
    // a red count on a tab that's tucked away shows as a dot on More
    set(more, 'mbadge', all.some(b => !b.classList.contains('mprim') && b.dataset.badge));
  }
  function apply() {
    document.body.classList.toggle('mnav', mq.matches);
    if (!mq.matches) open(false);
    mark();
  }
  more.addEventListener('click', () => open(!document.body.classList.contains('mnav-open')));
  shade.addEventListener('click', () => open(false));
  tabs.addEventListener('click', () => open(false));
  new MutationObserver(() => { if (document.body.classList.contains('mnav')) mark(); }).observe(tabs, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-badge'] });
  mq.addEventListener('change', apply);
  apply();
})();
