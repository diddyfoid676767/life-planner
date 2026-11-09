'use strict';
/* Full-screen focus timer: a progress ring with an hourglass of light in the
   middle that drains as you study (2.56; 2.55 had a sun). Opens when a study timer
   starts; "Minimise" drops back to the bar. */

const FOCUS_STAGES = [[10, 'Spark'], [22, 'Glow'], [45, 'Flare'], [90, 'Sun'], [180, 'Star']];
const focusStage = m => FOCUS_STAGES.reduce((s, [t], i) => m >= t ? i + 1 : s, 0); // 0 before 10 minutes
// a sun in your subject's colour; pct (0 to 1) makes it bigger and adds rays
function sunSvg(color, pct = 1, size = 40) {
  const p = Math.max(0, Math.min(1, pct)), r = 9 + 9 * p, n = 12, rays = Math.round(n * p);
  const ray = i => { const a = i / n * Math.PI * 2, r1 = r + 4, r2 = r + 9 + 3 * p; return `<line x1="${(32 + Math.cos(a) * r1).toFixed(1)}" y1="${(32 + Math.sin(a) * r1).toFixed(1)}" x2="${(32 + Math.cos(a) * r2).toFixed(1)}" y2="${(32 + Math.sin(a) * r2).toFixed(1)}"/>`; };
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="sunsvg" aria-hidden="true"><defs><radialGradient id="sg${size}"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ffe066"/><stop offset="1" stop-color="${esc(color)}"/></radialGradient></defs>
    <circle cx="32" cy="32" r="${(r + 8).toFixed(1)}" fill="${esc(color)}" opacity="${(.12 + .2 * p).toFixed(2)}"/><g stroke="#ffd43b" stroke-width="3" stroke-linecap="round">${Array.from({ length: rays }, (_, i) => ray(i)).join('')}</g><circle cx="32" cy="32" r="${r.toFixed(1)}" fill="url(#sg${size})"/></svg>`;
}
let focusFullOpen = false, focusFullStage = null;

function focusTarget(f, m) {
  if (f.planned) return f.planned;
  const next = FOCUS_STAGES.find(([t]) => m < t);
  return next ? next[0] : Math.ceil((m + 1) / 30) * 30;
}
// 2.56: an hourglass of light. The light drains from the top into the bottom as the session goes on.
function focusTreeMarkup(f, m) {
  const c = esc(subj(f.subjectId).color), g = 'M22 8H78C78 48 56 60 52 70C56 80 78 92 78 132H22C22 92 44 80 48 70C44 60 22 48 22 8Z';
  return `<svg viewBox="0 0 100 140" class="hourglass" aria-hidden="true"><defs><clipPath id="hgc"><path d="${g}"/></clipPath>
    <linearGradient id="hgl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8d6"/><stop offset=".5" stop-color="#ffd43b"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <path d="${g}" fill="rgba(255,255,255,.07)"/>
    <g clip-path="url(#hgc)"><rect class="hg-top" x="18" y="8" width="64" height="62" fill="url(#hgl)"/><rect class="hg-bot" x="18" y="70" width="64" height="62" fill="url(#hgl)"/>
      <line class="hg-stream" x1="50" y1="68" x2="50" y2="128" stroke="#fff3b0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 5"/></g>
    <path d="${g}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linejoin="round"/><path d="M16 8H84M16 132H84" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`;
}
function openFocusFull() {
  const f = D.focus; if (!f) return;
  focusFullOpen = true; focusFullStage = null;
  let el = document.getElementById('focusFull');
  if (!el) { el = document.createElement('div'); el.id = 'focusFull'; document.body.appendChild(el); }
  const s = subj(f.subjectId), sess = f.sessionId && find('session', f.sessionId);
  el.style.setProperty('--c', s.color);
  el.innerHTML = `<div class="ff-bg"></div>
    <div class="ff-top"><span class="ff-subj"><i style="background:${s.color}"></i>${esc(s.name)}</span>${sess?.topic ? `<span class="ff-topic">${esc(sess.topic)}</span>` : ''}
      <span class="spacer"></span>${f.exam ? '' : '<button class="btn small ghostlight" data-act="focusMin" title="Back to the planner (the timer keeps going)">Minimise ↘</button>'}</div>
    <div class="ff-center">
      <div class="ff-ring"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="132" class="ring-bg"/><circle cx="150" cy="150" r="132" class="ring-fg" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000"/></svg>
        <div class="ff-tree"></div></div>
      <div class="ff-time">0:00</div><div class="ff-sub"></div>
      <div class="ff-stages">${FOCUS_STAGES.map(([t, n]) => `<span data-t="${t}">${n}<b>${t}m</b></span>`).join('')}</div>
      <div class="ff-actions"></div>
    </div>`;
  el.hidden = false; el.classList.remove('out');
  updateFocusFull();
}
function closeFocusFull() {
  focusFullOpen = false;
  const el = document.getElementById('focusFull');
  if (el && !el.hidden) { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 250); }
}
function updateFocusFull() {
  const f = D.focus, el = document.getElementById('focusFull');
  if (!focusFullOpen || !f || !el) return;
  const m = focusElapsed(f), mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
  const target = focusTarget(f, m), pct = Math.min(1, m / target);
  el.querySelector('.ring-fg').setAttribute('stroke-dashoffset', String(Math.round(1000 * (1 - pct))));
  el.style.setProperty('--hp', pct.toFixed(4)); el.classList.toggle('hg-paused', !!f.pausedAt);
  el.querySelector('.ff-time').textContent = `${Math.floor(mm / 60) ? Math.floor(mm / 60) + ':' + pad(mm % 60) : mm}:${pad(ss)}`;
  const next = FOCUS_STAGES.find(([t]) => m < t);
  el.querySelector('.ff-sub').innerHTML = f.pausedAt ? '<span class="ff-paused">Paused</span>'
    : `${f.planned ? (m < f.planned ? `${fmtMins(Math.ceil(f.planned - m))} left of ${fmtMins(f.planned)}` : `🎉 ${fmtMins(f.planned)} done! Keep going or stop.`) : next ? `${Math.ceil(next[0] - m)} min to a ${next[1].toLowerCase()}` : 'Star reached ✦'}${D.settings.strictFocus ? ` · <span class="ff-strict ${(f.distractions || 0) >= DISTRACT_LIMIT ? 'bad' : ''}" title="Strict focus: leaving the planner for over a minute counts as a distraction">👀 ${f.distractions || 0}/${DISTRACT_LIMIT}</span>` : ''}`;
  el.querySelectorAll('.ff-stages span').forEach(sp => sp.classList.toggle('got', m >= +sp.dataset.t));
  const stageKey = (m < 10 ? 's' + Math.floor(m) : 't' + focusStage(m) + ':' + Math.floor(m / 3));
  if (stageKey !== focusFullStage) {
    const grew = focusFullStage && focusFullStage[0] === 't' && stageKey[0] === 't' && stageKey[1] !== focusFullStage[1] || (focusFullStage && focusFullStage[0] === 's' && stageKey[0] === 't');
    focusFullStage = stageKey;
    const box = el.querySelector('.ff-tree');
    box.innerHTML = focusTreeMarkup(f, m);
    if (grew) { box.classList.remove('levelup'); void box.offsetWidth; box.classList.add('levelup'); stageSfx(m < 10 ? 0 : focusStage(m)); }
  }
  el.querySelector('.ff-actions').innerHTML = focusAskCancel
    ? `<span><b>Cancel without logging?</b> Nothing gets logged.</span><button class="btn danger" data-act="focusCancelYes">Yes, cancel it</button><button class="btn ghostlight" data-act="focusCancelNo">Keep going</button>`
    : f.exam ? `<span class="ff-exam">🔒 Exam mode: switching windows, Esc or leaving full screen ends it with no reward</span><button class="btn primary big" data-act="focusStop">■ Stop &amp; log</button><button class="btn ghostlight" data-act="focusCancel">Cancel</button>`
    : `<button class="btn ghostlight big" data-act="focusPause">${f.pausedAt ? '▶ Resume' : '❚❚ Pause'}</button><button class="btn primary big" data-act="focusStop">■ Stop &amp; log</button><button class="btn ghostlight" data-act="focusCancel">Cancel</button>
       ${typeof openBrainfm === 'function' ? '<button class="btn ghostlight" data-act="brainfmOpen" title="Open Brain.fm">♫ Brain.fm</button>' : ''}`;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && focusFullOpen && !D.focus?.exam) closeFocusFull(); });
