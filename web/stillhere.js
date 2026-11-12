// ---------- "are you still here?" check ----------
// While a normal focus timer runs (not paused, never in exam mode) Solis asks every so often whether you're still
// studying. If nobody answers within a few minutes the timer stops and logs only the time up to the question,
// so a forgotten timer can't keep running for hours. D.settings.stillMins: minutes between questions (0 = off, default 40).
// The question lives on the timer (D.focus.okAt = minutes studied at the last yes, D.focus.askedAt = when it was asked).
const STILL_WAIT = 5 * 60000;
let stillLastTick = 0;
function stillMins() { const v = D.settings.stillMins; return v == null || v === '' ? 40 : Math.max(0, +v || 0); }
function stillTick() {
  const f = D && D.focus, el = document.getElementById('stillHere'), now = Date.now();
  const gap = stillLastTick ? now - stillLastTick : 0; stillLastTick = now;
  if (!f || f.exam || f.pausedAt || !stillMins()) { if (f && f.askedAt) { f.askedAt = 0; f.okAt = focusElapsed(f); save(); } if (el) el.remove(); return; }
  if (f.okAt == null) f.okAt = 0;
  if (!f.askedAt) {
    if (el) el.remove();
    // a long gap between checks means the computer was asleep: the question counts from when it went quiet
    if (gap > 3 * 60000) { f.askedAt = now - gap; save(); }
    else if (focusElapsed(f) - f.okAt >= stillMins()) { f.askedAt = now; save(); stillAlert(f); }
    else return;
  }
  if (now - f.askedAt >= STILL_WAIT) { stillTimeout(f); return; }
  if (!el) showStill(f); else stillCountdown(f);
}
function stillCountdown(f) {
  const t = document.getElementById('stillLeft'); if (!t) return;
  const left = Math.max(0, Math.ceil((f.askedAt + STILL_WAIT - Date.now()) / 1000));
  t.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
}
function stillAlert(f) {
  try { sfx('notify'); } catch { }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification('Still studying?', { body: 'Tap yes in Solis or the timer will stop in 5 minutes.', tag: 'stillhere', icon: 'icon.svg' }); n.onclick = () => { window.focus(); n.close(); }; } catch { }
  }
}
function showStill(f) {
  const el = document.createElement('div'); el.id = 'stillHere'; el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<div class="pic">👋</div><div class="pmain"><b>Are you still here?</b>
    <div>Your ${esc(subj(f.subjectId).name)} timer is at ${fmtMins(Math.round(focusElapsed(f)))}. It stops in <b id="stillLeft"></b> unless you say you're still studying, and only the time up to now is kept.</div>
    <div class="row"><button class="btn small primary" data-st="yes">Yes, still here</button><button class="btn small" data-st="stop">Stop &amp; log</button></div></div>`;
  el.onclick = e => {
    const a = e.target.closest('[data-st]')?.dataset.st; if (!a) return;
    const f2 = D.focus; el.remove(); if (!f2) return;
    if (a === 'yes') { f2.okAt = focusElapsed(f2); f2.askedAt = 0; save(); }
    else { f2.pausedAt = f2.askedAt || Date.now(); f2.askedAt = 0; stopFocus(true); }
  };
  document.body.appendChild(el); stillCountdown(f);
}
function stillTimeout(f) {
  document.getElementById('stillHere')?.remove();
  f.pausedAt = f.askedAt; f.askedAt = 0; // freeze the clock at the moment of the question
  const mins = Math.round(focusElapsed(f)), name = subj(f.subjectId).name;
  stopFocus(true, true);
  try { sfx('sheetclose'); } catch { }
  toast('Timer stopped: no answer', mins >= 1 ? `Logged ${fmtMins(mins)} of ${name}, up to when Solis asked if you were still there.` : 'Nothing was logged.', { timeout: 0 });
}
setInterval(() => { try { stillTick(); } catch { } }, 1000);
