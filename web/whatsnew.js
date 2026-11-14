// ---------- "What's new" card ----------
// Shown once, the first time Solis opens after an update: the new version number and what changed.
// TO SHIP A RELEASE: add an entry at the TOP of CHANGELOG (same number as `const version` in update.go).
// Keep each note to one short plain-English line. If someone skips versions, the card lists every
// version since the last one they saw (up to 3). D.settings.seenVersion remembers what was last shown.
// A brand-new install never sees it (the setup wizard marks the current version as seen).
const CHANGELOG = [
  { v: '2.62.0', notes: [
    'This "What\'s new" card: after each update it lists what changed',
  ] },
  { v: '2.61.0', notes: [
    '"Are you still here?" check while studying: the timer stops if nobody answers',
  ] },
  { v: '2.60.1', notes: [
    'Built-in 2027 term dates and days off',
  ] },
  { v: '2.60.0', notes: [
    'Today page layout fixes and Term dates',
    'Test mode and "Not present all day"',
    'Nicer motion and sounds',
  ] },
];
function verParts(v) { return String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0); }
function verCmp(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
async function whatsNewCheck() {
  if (ONLINE || !D || !D.settings) return;
  let cur = ''; try { cur = (await (await fetch('/api/info', { cache: 'no-store' })).json()).version || ''; } catch { }
  if (!cur) return;
  const seen = D.settings.seenVersion;
  // brand-new install: nothing to catch up on. An older planner that predates this card
  // (no seenVersion yet) gets the card for the version it just updated to.
  if (!seen && !D.settings.setupDone) { D.settings.seenVersion = cur; save(); return; }
  if (seen && verCmp(cur, seen) <= 0) return;
  if (modal.open || (typeof wiz !== 'undefined' && wiz) || document.getElementById('whatsNew')) { setTimeout(whatsNewCheck, 4000); return; }
  const lo = seen || '0.0.0';
  const list = CHANGELOG.filter(e => verCmp(e.v, lo) > 0 && verCmp(e.v, cur) <= 0).slice(0, 3);
  D.settings.seenVersion = cur; save();
  if (!list.length) return;
  const dlg = document.createElement('dialog'); dlg.id = 'whatsNew';
  dlg.innerHTML = `<div class="wn-head"><div class="wn-pic">✨</div><div><div class="wn-kicker">Solis updated</div><h2>What's new in ${esc(list[0].v)}</h2></div></div>
    <div class="wn-body">${list.map((e, i) => `${i ? `<h3>${esc(e.v)}</h3>` : ''}<ul>${e.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`).join('')}</div>
    <div class="modal-actions"><button class="btn primary" data-wn="ok">Got it</button></div>`;
  dlg.addEventListener('click', e => { if (e.target.closest('[data-wn]') || e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg); dlg.showModal();
}
