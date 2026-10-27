'use strict';
/* Full-screen focus timer: a progress ring with your subject's tree growing in
   the middle. Opens when a study timer starts; "Minimise" drops back to the bar. */

const FOCUS_STAGES = TREE_STAGES.slice(0, 5); // a session can grow a tree up to a grand tree
let focusFullOpen = false, focusFullStage = null;

function focusTarget(f, m) {
  if (f.planned) return f.planned;
  const next = FOCUS_STAGES.find(([t]) => m < t);
  return next ? next[0] : Math.ceil((m + 1) / 30) * 30;
}
function focusTreeMarkup(f, m) {
  const s = subj(f.subjectId), stage = m < 10 ? 0 : treeStage(m);
  const within = m < 10 ? 0 : stageProgress(m);
  const k = m < 10 ? .45 + .55 * (m / 10) : .82 + .18 * within;
  return `<svg viewBox="-48 -118 96 122" class="fftree" aria-hidden="true"><g transform="scale(${k.toFixed(3)})" style="transition:transform 1s ease">${treeG(speciesFor(f.subjectId), s.color, stage, f.startedAt)}</g></svg>`;
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
      <span class="spacer"></span><button class="btn small ghostlight" data-act="focusMin" title="Back to the planner (the timer keeps going)">Minimise ↘</button></div>
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
  el.querySelector('.ff-time').textContent = `${Math.floor(mm / 60) ? Math.floor(mm / 60) + ':' + pad(mm % 60) : mm}:${pad(ss)}`;
  const next = FOCUS_STAGES.find(([t]) => m < t);
  const coinsSoFar = m >= 10 ? Math.min(Math.floor(m), 120) + (m >= 45 ? 10 : 0) : 0;
  el.querySelector('.ff-sub').innerHTML = f.pausedAt ? '<span class="ff-paused">Paused</span>'
    : `${f.planned ? (m < f.planned ? `${fmtMins(Math.ceil(f.planned - m))} left of ${fmtMins(f.planned)}` : `🎉 ${fmtMins(f.planned)} done! Keep going or stop.`) : next ? `${Math.ceil(next[0] - m)} min to a ${next[1].toLowerCase()}` : 'Grand tree grown 🌸'}${coinsSoFar ? ` · +${coinsSoFar} ${COIN}` : ''}${D.settings.strictFocus ? ` · <span class="ff-strict ${(f.distractions || 0) >= DISTRACT_LIMIT ? 'bad' : ''}" title="Strict focus: leaving the planner for over a minute counts as a distraction">👀 ${f.distractions || 0}/${DISTRACT_LIMIT}</span>` : ''}`;
  el.querySelectorAll('.ff-stages span').forEach(sp => sp.classList.toggle('got', m >= +sp.dataset.t));
  const stageKey = (m < 10 ? 's' + Math.floor(m) : 't' + treeStage(m) + ':' + Math.floor(m / 3));
  if (stageKey !== focusFullStage) {
    const grew = focusFullStage && focusFullStage[0] === 't' && stageKey[0] === 't' && stageKey[1] !== focusFullStage[1] || (focusFullStage && focusFullStage[0] === 's' && stageKey[0] === 't');
    focusFullStage = stageKey;
    const box = el.querySelector('.ff-tree');
    box.innerHTML = focusTreeMarkup(f, m);
    if (grew) { box.classList.remove('levelup'); void box.offsetWidth; box.classList.add('levelup'); stageSfx(m < 10 ? 0 : treeStage(m)); }
  }
  el.querySelector('.ff-actions').innerHTML = focusAskCancel
    ? `<span><b>Cancel without logging?</b> No time, coins or tree.</span><button class="btn danger" data-act="focusCancelYes">Yes, cancel it</button><button class="btn ghostlight" data-act="focusCancelNo">Keep going</button>`
    : `<button class="btn ghostlight big" data-act="focusPause">${f.pausedAt ? '▶ Resume' : '❚❚ Pause'}</button><button class="btn primary big" data-act="focusStop">■ Stop &amp; log</button><button class="btn ghostlight" data-act="focusCancel">Cancel</button>
       ${typeof openBrainfm === 'function' ? '<button class="btn ghostlight" data-act="brainfmOpen" title="Open Brain.fm">♫ Brain.fm</button>' : ''}`;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && focusFullOpen) closeFocusFull(); });
