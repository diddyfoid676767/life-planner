'use strict';
/* Focus mini player: while a study timer runs, a small floating player
   (drag it anywhere) can stand in for the top bar, and "Pop out" opens it in
   a tiny always-on-top window that stays visible over other apps. */

let pipWin = null;
const miniPosKey = 'lp-mini-pos';

function miniInner(f, s, m, time, pct, big) {
  const R = big ? 54 : 30, C = 2 * Math.PI * R, sz = R * 2 + 12;
  return `<div class="mp-ring" style="--c:${s.color}">
      <svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}"><circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" class="mp-track"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" class="mp-bar" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/></svg>
      <div class="mp-tree">${focusTreeMarkup(f, m)}</div></div>
    <div class="mp-info"><b class="mp-time">${time}</b><span class="mp-subj">${esc(s.name)}${f.pausedAt ? ' · paused' : ''}</span>
      <div class="mp-btns"><button data-mp="pause" title="${f.pausedAt ? 'Resume' : 'Pause'}">${f.pausedAt ? '▶' : '❚❚'}</button><button data-mp="stop" class="mp-stop" title="Stop &amp; log">■</button>${big ? '<button data-mp="back" title="Back to the planner">↩</button>' : `<button data-mp="pop" title="Pop out: stays on top of other apps">⧉</button><button data-mp="bar" title="Back to the top bar">⤢</button>`}</div></div>`;
}

function miniAct(a) {
  if (a === 'pause') pauseFocus();
  else if (a === 'stop') { closePip(); stopFocus(true); }
  else if (a === 'pop') popOutMini();
  else if (a === 'bar') { D.settings.focusMini = false; save(); renderFocusBar(); }
  else if (a === 'back') { closePip(); window.focus(); }
}

// called every second from the focus bar's draw()
function updateMini(f, s, m, time, pct) {
  let el = document.getElementById('miniPlayer');
  const show = !!f && D.settings.focusMini && !pipWin;
  document.getElementById('focusBar').classList.toggle('as-mini', !!f && !!D.settings.focusMini);
  if (!show) { if (el) el.remove(); }
  else {
    if (!el) {
      el = document.createElement('div'); el.id = 'miniPlayer'; el.className = 'miniplayer';
      try { const p = JSON.parse(localStorage.getItem(miniPosKey) || 'null'); if (p) { el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; } } catch { }
      document.body.appendChild(el);
    }
    el.innerHTML = miniInner(f, s, m, time, pct, false);
  }
  if (pipWin && f) pipWin.document.getElementById('mp').innerHTML = miniInner(f, s, m, time, pct, true);
  if (!f) closePip();
}

async function popOutMini() {
  if (pipWin) { pipWin.focus(); return; }
  const css = `body{margin:0;font:14px/1.3 "Segoe UI",system-ui,sans-serif;background:${getComputedStyle(document.documentElement).getPropertyValue('--panel')};color:${getComputedStyle(document.documentElement).getPropertyValue('--text')};display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
    #mp{display:flex;align-items:center;gap:14px;padding:10px}` + miniCss;
  try {
    if ('documentPictureInPicture' in window) pipWin = await documentPictureInPicture.requestWindow({ width: 340, height: 170 });
    else pipWin = window.open('', 'lp-mini', 'width=340,height=170,popup');
  } catch { pipWin = null; }
  if (!pipWin) { toast("Couldn't open the pop-out", 'Your browser blocked it. The floating mini player still works.'); return; }
  const d = pipWin.document;
  d.title = 'Focus timer';
  d.head.innerHTML = `<meta charset="utf-8"><style>${css}</style>`;
  d.body.innerHTML = '<div id="mp" class="big"></div>';
  d.addEventListener('click', e => { const b = e.target.closest('[data-mp]'); if (b) miniAct(b.dataset.mp); });
  pipWin.addEventListener('pagehide', () => { pipWin = null; renderFocusBar(); });
  renderFocusBar();
}
function closePip() { if (pipWin) { const w = pipWin; pipWin = null; try { w.close(); } catch { } } }

// clicks and dragging for the floating player
document.addEventListener('click', e => { const b = e.target.closest('#miniPlayer [data-mp]'); if (b) miniAct(b.dataset.mp); });
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#miniPlayer'); if (!el || e.target.closest('button') || e.button) return;
  const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  el.classList.add('drag'); e.preventDefault();
  const move = ev => {
    const x = Math.max(4, Math.min(innerWidth - r.width - 4, ev.clientX - dx)), y = Math.max(4, Math.min(innerHeight - r.height - 4, ev.clientY - dy));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  };
  const up = () => {
    el.classList.remove('drag'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
    try { localStorage.setItem(miniPosKey, JSON.stringify([parseInt(el.style.left), parseInt(el.style.top)])); } catch { }
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
});

// shared by the floating player (via style.css) and the pop-out window
const miniCss = `
.mp-ring{position:relative;flex:none}.mp-ring svg{display:block}
.mp-track{fill:none;stroke:rgba(128,128,128,.22);stroke-width:7}
.mp-bar{fill:none;stroke:var(--c);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s linear}
.mp-tree{position:absolute;inset:14% 18% 18%;display:flex;align-items:flex-end;justify-content:center}.mp-tree svg{width:100%;height:100%}
.mp-info{display:flex;flex-direction:column;gap:3px;min-width:0}
.mp-time{font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
#mp.big .mp-time{font-size:2.4rem}
.mp-subj{font-size:.85rem;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
.mp-btns{display:flex;gap:6px;margin-top:4px}
.mp-btns button{border:0;border-radius:999px;width:32px;height:32px;cursor:pointer;background:rgba(128,128,128,.18);color:inherit;font-size:.85rem;font-weight:700}
.mp-btns button:hover{background:rgba(128,128,128,.32)}.mp-btns .mp-stop{background:#e03131;color:#fff}`;
(() => { const st = document.createElement('style'); st.textContent = miniCss; document.head.appendChild(st); })();
