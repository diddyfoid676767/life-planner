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
  { id: 'galaxy', name: 'Galaxy', a: '#7c3aed', b: '#22d3ee', dark: true },
  { id: 'mono', name: 'Mono', a: '#495057', b: '#868e96' },
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
  for (const [k, x] of Object.entries(v)) r.setProperty(k, x);
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
    <div class="themes">${sw}</div></div>`;
}
