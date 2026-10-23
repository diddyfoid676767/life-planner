// ---------- colour themes ----------
// A theme sets the accent colours and tints the page; the mode picks light,
// dark or whatever Windows uses. Applied as CSS variables on <html>.

const THEMES = [
  { id: 'classic', name: 'Classic', a: '#5b5bf0', b: '#8b5cf6' },
  { id: 'ocean', name: 'Ocean', a: '#0ea5e9', b: '#2563eb' },
  { id: 'forest', name: 'Forest', a: '#2f9e44', b: '#0ca678' },
  { id: 'sunset', name: 'Sunset', a: '#f76707', b: '#e64980' },
  { id: 'berry', name: 'Berry', a: '#c2255c', b: '#7048e8' },
  { id: 'mint', name: 'Mint', a: '#12b886', b: '#15aabf' },
  { id: 'candy', name: 'Candy', a: '#f06595', b: '#845ef7' },
  { id: 'gold', name: 'Gold', a: '#e8a200', b: '#e8590c' },
  { id: 'lavender', name: 'Lavender', a: '#9775fa', b: '#da77f2' },
  { id: 'peach', name: 'Peach', a: '#ff8787', b: '#ffa94d' },
  { id: 'sky', name: 'Sky', a: '#339af0', b: '#66d9e8' },
  { id: 'lime', name: 'Lime', a: '#74b816', b: '#20c997' },
  { id: 'cherry', name: 'Cherry blossom', a: '#e64980', b: '#f783ac' },
  { id: 'coffee', name: 'Coffee', a: '#a0663a', b: '#d9a066' },
  { id: 'tropical', name: 'Tropical', a: '#0ca678', b: '#fab005' },
  { id: 'ruby', name: 'Ruby', a: '#e03131', b: '#ae3ec9' },
  { id: 'galaxy', name: 'Galaxy', a: '#7c3aed', b: '#22d3ee', dark: true },
  { id: 'neon', name: 'Neon', a: '#f0f', b: '#0ff', dark: true },
  { id: 'midnight', name: 'Midnight', a: '#4c6ef5', b: '#15aabf', dark: true },
  { id: 'aurora', name: 'Aurora', a: '#20c997', b: '#9775fa', dark: true },
  { id: 'volcano', name: 'Volcano', a: '#fa5252', b: '#fd7e14', dark: true },
  { id: 'mono', name: 'Mono', a: '#495057', b: '#868e96' },
];
// what's behind the cards
const THEME_BGS = [
  ['plain', 'Plain'], ['soft', 'Soft glow'], ['gradient', 'Gradient'], ['mesh', 'Mesh'], ['aurora', 'Moving aurora'], ['stars', 'Starry night'],
];
const darkMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

function themeIsDark() {
  const th = THEMES.find(t => t.id === D?.settings?.theme) || THEMES[0];
  const mode = D?.settings?.themeMode || 'auto';
  return th.dark || mode === 'dark' || (mode === 'auto' && !!darkMQ?.matches);
}

function applyTheme() {
  const th = THEMES.find(t => t.id === D?.settings?.theme) || THEMES[0];
  const dark = themeIsDark(), r = document.documentElement.style;
  const mix = (c, pct, base) => `color-mix(in srgb, ${c} ${pct}%, ${base})`;
  const a = dark && th.id === 'mono' ? '#adb5bd' : th.a;
  const v = dark ? {
    '--bg': mix(th.a, th.dark ? 10 : 5, '#0d0f16'), '--panel': mix(th.a, 5, '#171a24'), '--panel2': mix(th.a, 9, '#1f2331'),
    '--border': mix(th.a, 12, '#2a2f40'), '--text': '#e8eaf2', '--muted': '#9aa0b6',
    '--accent': mix(a, 85, '#ffffff'), '--accent2': mix(th.b, 85, '#ffffff'),
    '--danger': '#ef6464', '--warn': '#f0a63a', '--ok': '#49c27c', '--shadow': '0 1px 3px rgba(0,0,0,.4)',
  } : {
    '--bg': mix(th.a, 6, '#f6f7fb'), '--panel': '#ffffff', '--panel2': mix(th.a, 6, '#f2f3f8'),
    '--border': mix(th.a, 10, '#e2e5ee'), '--text': '#1b2033', '--muted': '#6a7189',
    '--accent': a, '--accent2': th.b,
    '--danger': '#d64545', '--warn': '#d98a12', '--ok': '#2f9e5b', '--shadow': '0 1px 3px rgba(20,30,60,.08), 0 4px 14px rgba(20,30,60,.05)',
  };
  // gradient stops for the background styles
  const base = dark ? '#0d0f16' : '#f6f7fb', k = dark ? 1 : .8;
  Object.assign(v, {
    '--g1': mix(th.a, Math.round(34 * k), base), '--g2': mix(th.b, Math.round(30 * k), base), '--g3': mix(th.a, Math.round(14 * k), mix(th.b, 40, base)),
    '--ga': mix(th.a, 70, 'transparent'), '--gb': mix(th.b, 70, 'transparent'),
  });
  for (const [k2, x] of Object.entries(v)) r.setProperty(k2, x);
  const bg = D?.settings?.themeBg || 'soft', el = document.documentElement;
  el.dataset.bg = bg;
  el.toggleAttribute('data-glass', !!D?.settings?.themeGlass);
  r.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = th.a;
}
darkMQ?.addEventListener?.('change', () => D && applyTheme());

function themeCard() {
  const cur = D.settings.theme || 'classic', mode = D.settings.themeMode || 'auto';
  const sw = THEMES.map(t => `<button class="themesw ${cur === t.id ? 'on' : ''}" data-act="setTheme" data-v="${t.id}" title="${t.name}" style="--ta:${t.a};--tb:${t.b}">
    <i></i><span>${t.name}${t.dark ? ' 🌙' : ''}</span></button>`).join('');
  const m = (v, label) => `<button class="${mode === v ? 'on' : ''}" data-act="setThemeMode" data-v="${v}">${label}</button>`;
  return `<div class="card" data-sec="theme"><div class="card-head"><h2>Theme</h2><div class="seg">${m('auto', 'Auto')}${m('light', '☀️ Light')}${m('dark', '🌙 Dark')}</div></div>
    <div class="themes">${sw}</div>
    <h3 style="margin:16px 0 8px">Background</h3>
    <div class="bgsw-row">${THEME_BGS.map(([v, l]) => `<button class="bgsw ${(D.settings.themeBg || 'soft') === v ? 'on' : ''}" data-act="setThemeBg" data-v="${v}"><i class="bgprev bg-${v}"></i><span>${l}</span></button>`).join('')}</div>
    <label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" data-change="themeGlass" ${D.settings.themeGlass ? 'checked' : ''} style="width:auto"> Glass cards (see the background through them)</label></div>`;
}

// ---------- side tab order ----------
// D.settings.navOrder lists the tabs in your order (Settings always stays at
// the bottom); D.settings.navHidden hides tabs you don't use. Drag tabs in the
// sidebar, or use the arrows in Settings → Theme.
const NAV_FIXED = ['today', 'settings'];
function navDefault() { return [...document.querySelectorAll('#tabs button[data-view]')].map(b => b.dataset.view).filter(v => v !== 'settings'); }
let NAV_BASE = null;
const NAV_HTML = document.getElementById('tabs')?.innerHTML || '';
function navOrder() {
  NAV_BASE = NAV_BASE || navDefault();
  const saved = (D.settings.navOrder || []).filter(v => NAV_BASE.includes(v));
  return [...saved, ...NAV_BASE.filter(v => !saved.includes(v))];
}
function applyNav() {
  const nav = document.getElementById('tabs'); if (!nav) return;
  NAV_BASE = NAV_BASE || navDefault();
  const custom = !!D.settings.navOrder?.length, hidden = D.settings.navHidden || [];
  if (!custom && nav.classList.contains('custom')) nav.innerHTML = NAV_HTML;
  nav.classList.toggle('custom', custom);
  if (custom) {
    const spacer = nav.querySelector('.navspacer');
    for (const v of navOrder()) { const b = nav.querySelector(`button[data-view="${v}"]`); if (b) nav.insertBefore(b, spacer); }
  }
  nav.querySelectorAll('button[data-view]').forEach(b => { b.hidden = hidden.includes(b.dataset.view) && !NAV_FIXED.includes(b.dataset.view) && b.dataset.view !== view; b.draggable = b.dataset.view !== 'settings'; });
}
function navMove(v, n) {
  const o = navOrder(), i = o.indexOf(v), j = i + n;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; D.settings.navOrder = o;
}
function navCard() {
  const o = navOrder(), hidden = D.settings.navHidden || [];
  const label = v => document.querySelector(`#tabs button[data-view="${v}"] span`)?.textContent || v;
  return `<div class="card" data-sec="theme"><div class="card-head"><h2>Side tabs</h2>${D.settings.navOrder?.length || hidden.length ? '<button class="btn small" data-act="navReset">Reset</button>' : ''}</div>
    <p class="muted small-text" style="margin-top:0">Drag tabs in the sidebar to reorder them, or use the arrows. Untick a tab to hide it.</p>
    <ul class="navlist">${o.map((v, i) => `<li><input type="checkbox" data-change="navShow" data-v="${v}" ${hidden.includes(v) ? '' : 'checked'} ${NAV_FIXED.includes(v) ? 'disabled' : ''} style="width:auto"><span>${esc(label(v))}</span>
      <button class="iconbtn" data-act="navMove" data-v="${v}" data-n="-1" ${i ? '' : 'disabled'} title="Move up">↑</button><button class="iconbtn" data-act="navMove" data-v="${v}" data-n="1" ${i < o.length - 1 ? '' : 'disabled'} title="Move down">↓</button></li>`).join('')}</ul></div>`;
}
// drag to reorder in the sidebar
let navDrag = null;
document.addEventListener('dragstart', e => { const b = e.target.closest?.('#tabs button[data-view]'); if (!b) return; navDrag = b.dataset.view; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragover', e => {
  if (!navDrag) return;
  const b = e.target.closest?.('#tabs button[data-view]'); if (!b || b.dataset.view === 'settings') return;
  e.preventDefault();
  document.querySelectorAll('#tabs .dropabove, #tabs .dropbelow').forEach(x => x.classList.remove('dropabove', 'dropbelow'));
  const r = b.getBoundingClientRect(); b.classList.add(e.clientY < r.top + r.height / 2 ? 'dropabove' : 'dropbelow');
});
document.addEventListener('drop', e => {
  if (!navDrag) return;
  const b = e.target.closest?.('#tabs button[data-view]');
  if (b && b.dataset.view !== navDrag && b.dataset.view !== 'settings') {
    e.preventDefault();
    const o = navOrder().filter(v => v !== navDrag), r = b.getBoundingClientRect();
    o.splice(o.indexOf(b.dataset.view) + (e.clientY < r.top + r.height / 2 ? 0 : 1), 0, navDrag);
    D.settings.navOrder = o; save(); render();
  }
});
document.addEventListener('dragend', () => { navDrag = null; document.querySelectorAll('#tabs .dragging, #tabs .dropabove, #tabs .dropbelow').forEach(x => x.classList.remove('dragging', 'dropabove', 'dropbelow')); });
