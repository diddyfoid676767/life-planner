// ---------- posture check ----------
// While a focus timer runs (and isn't paused), a small popup asks you to fix your posture every few minutes.
// Nothing shows outside study time. D.settings.posture (on by default) and D.settings.postureMins.
const POSTURE_TIPS = ['Sit back in the chair so your back is supported.', 'Drop your shoulders away from your ears.', 'Screen at eye level, about an arm away.', 'Feet flat on the floor, knees level with your hips.', 'Chin back a little, not poking towards the screen.', 'Look at something far away for 20 seconds.', 'Roll your shoulders back five times.', 'Unclench your jaw and relax your hands.'];
let postureNext = 0, postureFor = 0, postureTip = 0;
function postureMins() { return Math.max(5, +D.settings.postureMins || 20); }
function postureTick() {
  const f = D && D.focus, el = document.getElementById('posture');
  if (!f || f.pausedAt || D.settings.posture === false) { if (el && !f) el.remove(); return; }
  if (postureFor !== f.startedAt) { postureFor = f.startedAt; postureNext = focusElapsed(f) + postureMins(); return; }
  if (!el && focusElapsed(f) >= postureNext) showPosture();
}
function showPosture() {
  document.getElementById('posture')?.remove();
  const tip = POSTURE_TIPS[postureTip++ % POSTURE_TIPS.length];
  const el = document.createElement('div'); el.id = 'posture'; el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<div class="pic">🧍</div><div class="pmain"><b>Posture check</b><div>${esc(tip)}</div>
    <div class="row"><button class="btn small primary" data-pz="ok">Done</button><button class="btn small" data-pz="snooze">In 5 min</button><button class="btn small" data-pz="off" title="Turn posture checks off">Stop these</button></div></div>`;
  el.onclick = e => {
    const a = e.target.closest('[data-pz]')?.dataset.pz; if (!a) return;
    const f = D.focus, now = f ? focusElapsed(f) : 0;
    postureNext = now + (a === 'snooze' ? 5 : postureMins());
    if (a === 'off') { D.settings.posture = false; save(); toast('Posture checks are off', 'Turn them back on in Settings.'); }
    el.remove();
  };
  (document.getElementById('focusFull')?.hidden === false ? document.getElementById('focusFull') : document.body).appendChild(el);
  if (D.settings.sound) try { beep(); } catch { }
  // Leave it up a minute; if ignored, ask again on the next interval.
  setTimeout(() => { if (el.isConnected) { el.remove(); const f = D.focus; if (f) postureNext = focusElapsed(f) + postureMins(); } }, 60000);
}
setInterval(() => { try { postureTick(); } catch { } }, 15000);
