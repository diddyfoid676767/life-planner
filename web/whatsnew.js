// ---------- "What's new" card and walkthrough guides ----------
// Shown once, the first time Solis opens after an update: the new version number and what changed.
// TO SHIP A RELEASE: add an entry at the TOP of CHANGELOG (same number as `const version` in update.go).
//   { v: '2.65.0', notes: ['plain line', { t: 'line', k: 'new' | 'fix' | 'tweak' }], guide: 'id' }
// Each note is one short plain-English line. k tags the line: 'new' = new feature, 'fix' = bug fix,
// 'tweak' = small change (a bare string counts as a tweak). The whole entry is badged "New feature"
// when any line is new, otherwise "Patch notes" (set kind: 'feature' | 'patch' to force it).
// guide (optional, for bigger updates) names a walkthrough in GUIDES below: it plays once, straight
// after the card, and can be replayed from Settings. If someone skips versions, the card lists every
// version since the last one they saw (up to 3). D.settings.seenVersion remembers what was last shown,
// D.settings.guidesSeen which guides have played. A brand-new install never sees either.
const CHANGELOG = [
  { v: '2.80.0', notes: [
    { t: 'Walk mode is back: press Walk or V to explore your whole island as a real animated hero in your class outfit, with your own face, hair and cosmetics', k: 'new' },
    { t: 'Smooth running, Shift to sprint, Space to jump, Ctrl to roll, and you can swim in rivers and the sea. A smooth camera follows you, scroll to zoom', k: 'new' },
    { t: 'Villagers are proper characters now, walking your roads', k: 'tweak' },
    { t: 'Real recorded sounds for clicks, coins, footsteps, jumps, sword swings and hits', k: 'new' },
  ] },
  { v: '2.79.0', notes: [
    { t: 'Five main buildings: Hall, Notice Board, Library, Training hall and Tavern. The Market is now a small stall on the town square', k: 'new' },
    { t: 'The Practice yard lives in the Training hall and your settings in the Hall. Your own buildings stay exactly where you put them', k: 'tweak' },
    { t: 'New soft grass that sways, round bushes, real flowers and smooth pebbles, and no more brown dirt', k: 'new' },
    { t: 'A bright blue sky by day and a lantern dusk with stars at night. Placing a building lights up good spots for it', k: 'new' },
  ] },
  { v: '2.78.0', guide: 'game', notes: [
    { t: 'A new look: bright, rounded menus by day and a cosy lantern style at night or in dark mode', k: 'new' },
    { t: 'No top bar. Your counters sit in the top-left corner and one Menu button opens every place (keys 1 to 6, Q adds, Ctrl+K searches)', k: 'new' },
    { t: 'Buildings open simple windows that slide in from the right: one big card, a short list, up to 3 tabs and More', k: 'new' },
    { t: 'No more music on the island or while you study, and clicks are softer. Solis now opens on your island', k: 'tweak' },
  ] },
  { v: '2.77.0', notes: [
    { t: 'The Market is now the one shop: this week\'s cosmetics, island looks and decorations. Page buildings open their window with one click', k: 'new' },
    { t: 'Hover any hex, even grass, water, rocks and trees, to see what it is and what you can do there', k: 'new' },
    { t: 'Preview island looks and decorations for free, and pay only when you press Keep', k: 'new' },
    { t: 'Walk mode and building interiors are tucked away for now. They come back with better movement', k: 'tweak' },
  ] },
  { v: '2.76.0', notes: [
    { t: 'The first Souls fight: the Snooze Golem in its own arena, in real time. Move, roll through its attacks, block, and strike', k: 'new' },
    { t: 'Every spell, move and class skill you have equipped is on a hotbar (keys 1 to 9). Stamina pays for attacks, rolls and blocks', k: 'new' },
    { t: 'Try it any time as a free Trial from the Practice yard. In the Golem\'s week it counts as a weekly fight on your house\'s bar', k: 'new' },
    { t: 'The weekly boss on the boss island now breathes and looks around', k: 'tweak' },
  ] },
  { v: '2.75.0', notes: [
    { t: 'Walk mode: press V (or 🚶 Walk) and walk round your island as your own character, with the camera over your shoulder', k: 'new' },
    { t: 'WASD to move, Shift to run, click to steer with the mouse. Press V again for the builder view', k: 'new' },
    { t: 'Walk into the Hall, Library, Training hall or Tavern to go inside. The Hall has the Solis hearth. Close the page to walk back out', k: 'new' },
    { t: 'Tapping the Market or Practice yard twice now opens the right page', k: 'fix' },
  ] },
  { v: '2.74.0', notes: [
    { t: 'Six voted house roles replace the 2 leaders: Champion, Warlord, Architect, Treasurer, Vanguard and Herald', k: 'new' },
    { t: 'Vote for each role in Weeks 2 and 3 (👑 Roles on the house island). One role each; houses under 8 members fill Champion, Warlord and Architect', k: 'new' },
    { t: 'The Architect and Warlord build, the Treasurer can repair, and the Champion puts big projects to a vote and covers empty roles', k: 'tweak' },
    { t: 'This term\'s two leaders carry on as Champion and Architect until the next vote', k: 'tweak' },
  ] },
  { v: '2.73.0', notes: [
    { t: 'A medieval look: pages open on parchment in a wooden frame, with serif headings and house crests', k: 'new' },
    { t: 'A bell rings when one of your buildings is finished, and soft lute and drum music plays on your island', k: 'new' },
    { t: 'New names: Settings is the Steward and the house boss is the Warband. The old names still work in Ctrl+K', k: 'tweak' },
    { t: 'Prefer the plain look or no music? Both switch off in the Steward, under Look & sound', k: 'tweak' },
  ] },
  { v: '2.72.0', guide: 'shell', notes: [
    { t: 'Solis is one world now: the sidebar is gone and every page opens over your island from its building', k: 'new' },
    { t: 'A new bar along the top: the buildings, Map, search, Lumen, Ember and streak, Add and the Steward (settings)', k: 'new' },
    { t: 'A Today card pops up when Solis opens, and two new buildings: the Notice Board and the Steward\'s lodge', k: 'new' },
    { t: 'The Map flies you between islands. Slow computer? Turn on the 2D map in the Steward. The Library glows while you study', k: 'new' },
  ] },
  { v: '2.71.0', notes: [
    { t: 'Island looks: Spring meadow, Autumn, Snow and Desert oasis (press 🎨 Looks). With no look, your island follows the real season', k: 'new' },
    { t: 'Day and night follow the real time, with glowing lanterns and lamp posts after dark', k: 'new' },
    { t: 'Melbourne\'s real weather on your island: rain, clouds and falling autumn leaves (Low graphics turns it off)', k: 'new' },
    { t: 'Villagers now walk your roads, and 🏘️ Visit lets you look round your housemates\' islands', k: 'new' },
  ] },
  { v: '2.70.0', notes: [
    { t: 'Terraform your island: paint grass, sand, paths, forest, hills and ponds, and raise hexes up, for 2 Lumen or Ember a hex', k: 'new' },
    { t: 'Decorate with flowers, trees, rocks, benches, lamp posts, flags, barrels, carts, tents, statues and fountains', k: 'new' },
    { t: 'Ctrl+Z gives back your last stroke and its cost, and Reset terrain puts the ground back as it started', k: 'new' },
    { t: 'Painted forest and hills count for the lumber mill and mine bonuses', k: 'tweak' },
  ] },
  { v: '2.69.0', notes: [
    { t: 'Islands are about 30% bigger, with a new ring of land round the edge. Everything you built stays where it is', k: 'new' },
    { t: 'Main buildings have their own colours, and hovering shows a name tag, a glow and a little tick', k: 'new' },
    { t: 'Move the island with right-drag, and lock the view to a tidy angle (or save your own)', k: 'new' },
    { t: 'House island buildings wear your house colour with banners and stone, plus flowers, foam on the shore and softer clouds', k: 'tweak' },
  ] },
  { v: '2.68.0', notes: [
    { t: 'Countdown timer: pick 25, 45, 60 or 90 minutes (or your own) when you start studying. At zero it stops and logs by itself', k: 'new' },
    { t: '"Are you still here?" now pops up over other windows with a loud chime when Solis is in the background', k: 'new' },
  ] },
  { v: '2.67.5', notes: [
    { t: 'Ticking off a to-do works again (clicks were being undone straight away)', k: 'fix' },
    { t: 'Brain.fm is gone: no more auto-open button, and its link is removed from your Links', k: 'tweak' },
  ] },
  { v: '2.67.4', notes: [{ t: 'Signing up with your school email no longer needs an emailed link: if you are on the Westbourne list you are in straight away', k: 'fix' }] },
  { v: '2.67.3', notes: [{ t: 'Logging in before you open the email link sends a fresh link', k: 'fix' }, { t: 'The sign-up email now always sends, even if saving your profile hiccups', k: 'fix' }] },
  { v: '2.67.2', notes: [
    { t: 'Fixed the sign-up and log-in boxes clearing what you typed', k: 'fix' },
    { t: 'The invite code box now says what it does', k: 'tweak' },
  ] },
  { v: '2.67.1', notes: [
    { t: 'The Solis download page has a short address now: tinyurl.com/solis-download', k: 'tweak' },
  ] },
  { v: '2.67.0', guide: 'launch', notes: [
    { t: 'New accounts use your school email: open the link we email you and you\'re a verified Westbourne student', k: 'new' },
    { t: 'Not at Westbourne? "Just the planner" mode gives friends from other schools everything except houses', k: 'new' },
    { t: 'Invite friends with your own link: you both get 50 Lumen and 50 Ember after their first focus session', k: 'new' },
    { t: 'Find friends by name or school email, and a quicker 3-step welcome for new players', k: 'tweak' },
  ] },
  { v: '2.66.0', guide: 'hexhouse', notes: [
    { t: 'The house island is on hexagons now, and leaders place and drag buildings the same way as on your own island', k: 'new' },
    { t: 'House perks need a road to the great hall (every building got a free one), and the temple parts cover 3 and 7 hexes', k: 'new' },
    { t: 'New house buildings: Lumen and Ember Banks that earn interest, a Vault, a Treasury, towers, traps and guard posts', k: 'new' },
    { t: 'A closed ring of wall round the great hall now keeps the Friday boss raid out', k: 'tweak' },
  ] },
  { v: '2.65.1', notes: [
    { t: 'Fixed house island perks and house boss fights after the hex island update', k: 'fix' },
  ] },
  { v: '2.65.0', guide: 'hexmove', notes: [
    { t: 'Your island is rebuilt on hexagons with proper medieval buildings (what you spent on the old one is refunded)', k: 'new' },
    { t: 'Drag buildings to move them, with a green/red preview, R to turn, Ctrl+Z to undo; drag to lay roads and walls', k: 'new' },
    { t: 'Roads join buildings to your Hall, and spots matter: forest, hills, the river and fields give bonuses', k: 'new' },
    { t: 'This card now shows New feature or Patch notes, and big updates come with a step-by-step guide', k: 'tweak' },
  ] },
  { v: '2.64.0', notes: [
    { t: 'Solis now checks for updates every time it opens and installs them straight away', k: 'tweak' },
    { t: 'Important updates can be marked required, so the old version can\'t be used until it updates', k: 'new' },
  ] },
  { v: '2.63.0', notes: [
    { t: 'Term goals and weekly study targets per subject, on the Study page', k: 'new' },
    { t: 'The Chronicle: a recap of your term, saved, with an image to share', k: 'new' },
    { t: 'The house boss rests in the holidays, and the Term Boss arrives in the last week of term', k: 'new' },
    { t: 'Each term is a season with house rankings and prizes for the top 3 houses', k: 'new' },
  ] },
  { v: '2.62.0', notes: [
    { t: 'This "What\'s new" card: after each update it lists what changed', k: 'new' },
  ] },
  { v: '2.61.0', notes: [
    { t: '"Are you still here?" check while studying: the timer stops if nobody answers', k: 'new' },
  ] },
  { v: '2.60.1', notes: [
    { t: 'Built-in 2027 term dates and days off', k: 'tweak' },
  ] },
  { v: '2.60.0', notes: [
    { t: 'Today page layout fixes and Term dates', k: 'fix' },
    { t: 'Test mode and "Not present all day"', k: 'new' },
    { t: 'Nicer motion and sounds', k: 'tweak' },
  ] },
];
// ---------- walkthrough guides ----------
// A guide is a list of steps. Each step: { title, text, sel?, go?, view?, place?, wait? }
//   view  - page to show first (as in `view = ...`), go - function run before the step (open a panel...)
//   sel   - CSS selector of the real thing to point at (spotlight + arrow); left out = a centred card
//   wait  - ms to wait after go/view before looking for sel (3D and slide-ins), default 120
//   place - 'right' | 'left' | 'top' | 'bottom' to force where the card sits
// A step whose target isn't on screen shows as a centred card, so a guide never gets stuck.
const GUIDES = {};
const WN_TAG = { new: ['✨', 'New'], fix: ['🔧', 'Fix'], tweak: ['⚙️', 'Tweak'] };
const wnNote = n => typeof n === 'string' ? { t: n, k: 'tweak' } : n;
const wnKind = e => e.kind || (e.notes.some(n => wnNote(n).k === 'new') ? 'feature' : 'patch');
function verParts(v) { return String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0); }
function verCmp(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
async function whatsNewCheck() {
  if (ONLINE || !D || !D.settings) return;
  let cur = ''; try { cur = (await (await fetch('/api/info', { cache: 'no-store' })).json()).version || ''; } catch { }
  if (!cur) return;
  const seen = D.settings.seenVersion;
  // brand-new install: nothing to catch up on. An older planner that predates this card
  // (no seenVersion yet) gets the card for the version it just updated to.
  if (!seen && !D.settings.setupDone) { D.settings.seenVersion = cur; D.settings.guidesSeen = CHANGELOG.filter(e => e.guide).map(e => e.guide); save(); return; }
  if (seen && verCmp(cur, seen) <= 0) return;
  if (modal.open || (typeof wiz !== 'undefined' && wiz) || document.getElementById('whatsNew') || guideOn()) { setTimeout(whatsNewCheck, 4000); return; }
  const lo = seen || '0.0.0';
  const list = CHANGELOG.filter(e => verCmp(e.v, lo) > 0 && verCmp(e.v, cur) <= 0).slice(0, 3);
  D.settings.seenVersion = cur; save();
  if (list.length) whatsNewShow(list, true);
}
// the card itself; auto = shown after an update (plays a new guide once afterwards)
function whatsNewShow(list, auto) {
  document.getElementById('whatsNew')?.remove();
  const top = list[0], kind = wnKind(top), gs = D.settings.guidesSeen || [];
  const guide = list.map(e => e.guide).find(g => g && GUIDES[g] && (!auto || !gs.includes(g)));
  const entry = (e, i) => {
    const k = wnKind(e), notes = e.notes.map(wnNote);
    return `<section class="wn-entry ${k}" style="--i:${i}">${i ? `<div class="wn-sub"><span class="wn-badge ${k}">${k === 'feature' ? '✨ New feature' : '🔧 Patch notes'}</span><b>${esc(e.v)}</b></div>` : ''}
      <ul>${notes.map((n, j) => `<li style="--j:${j}"><span class="wn-ico ${n.k}" title="${WN_TAG[n.k]?.[1] || ''}">${WN_TAG[n.k]?.[0] || '•'}</span><span class="wn-t">${esc(n.t)}</span><span class="wn-tag ${n.k}">${WN_TAG[n.k]?.[1] || ''}</span></li>`).join('')}</ul></section>`;
  };
  const dlg = document.createElement('dialog'); dlg.id = 'whatsNew'; dlg.className = kind;
  dlg.innerHTML = `<div class="wn-banner ${kind}"><div class="wn-glow"></div><div class="wn-pic">${kind === 'feature' ? '✨' : '🔧'}</div>
      <div class="wn-headtxt"><span class="wn-badge ${kind} big">${kind === 'feature' ? 'New feature' : 'Patch notes'}</span><h2>What's new in Solis ${esc(top.v)}</h2>
      <div class="wn-kicker">${kind === 'feature' ? 'Something new to try' : 'Fixes and small improvements'}${list.length > 1 ? ` · plus ${list.length - 1} earlier update${list.length > 2 ? 's' : ''}` : ''}</div></div></div>
    <div class="wn-body">${list.map(entry).join('')}</div>
    <div class="wn-actions">${guide ? `<span class="wn-guidehint">🧭 There's a quick guide for this</span><button class="btn ghost" data-wn="ok">Later</button><button class="btn primary" data-wn="guide" data-g="${guide}">Show me how →</button>` : '<button class="btn primary" data-wn="ok">Got it</button>'}</div>`;
  let go = '';
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-wn]'); if (b) { if (b.dataset.wn === 'guide') go = b.dataset.g; dlg.close(); } else if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    dlg.remove();
    // a new guide is offered once: "Later" counts as seen too (it stays in Settings)
    if (auto && guide) { D.settings.guidesSeen = [...new Set([...(D.settings.guidesSeen || []), guide])]; save(); }
    if (go) setTimeout(() => guideStart(go), 250);
  });
  document.body.appendChild(dlg); dlg.showModal();
  if (typeof sfx === 'function') try { sfx('notify'); } catch { }
}
// Settings: the last few updates, and every guide
function whatsNewCard() {
  const gl = CHANGELOG.filter(e => e.guide && GUIDES[e.guide]);
  return `<div class="card" data-sec="general" style="grid-column:1/-1"><div class="card-head"><h2>What's new and guides</h2><button class="btn small" data-act="wnShow">✨ What's new</button></div>
    <p class="muted small-text" style="margin:0 0 8px">See what changed in recent updates, or replay a step-by-step guide for a new feature.</p>
    ${gl.length ? `<div class="wn-guides">${gl.map(e => `<button class="btn small" data-act="guideStart" data-v="${e.guide}">🧭 ${esc(GUIDES[e.guide].name)} <span class="muted">${esc(e.v)}</span></button>`).join('')}</div>` : ''}</div>`;
}

// ---------- the walkthrough player ----------
let GD = null; // { id, steps, at }
const guideOn = () => !!GD;
function guideStart(id) {
  const g = GUIDES[id]; if (!g) return;
  if (typeof tourAt !== 'undefined' && tourAt >= 0 && typeof endTour === 'function') endTour();
  if (modal.open) modal.close();
  GD = { id, steps: g.steps, at: 0 }; guideDraw();
}
function guideEnd(done) {
  if (!GD) return;
  const g = GUIDES[GD.id]; GD = null;
  document.getElementById('guidefx')?.remove(); document.body.classList.remove('guiding');
  D.settings.guidesSeen = [...new Set([...(D.settings.guidesSeen || []), g ? Object.keys(GUIDES).find(k => GUIDES[k] === g) : ''])].filter(Boolean); save();
  try { g?.end?.(); } catch (e) { console.error(e); }
  if (done) toast('🧭 Guide finished', 'Replay it any time from Settings, under What\'s new.');
}
function guideGo(dir) { if (!GD) return; GD.at += dir; if (GD.at >= GD.steps.length) return guideEnd(true); if (GD.at < 0) GD.at = 0; guideDraw(); }
async function guideDraw() {
  if (!GD) return;
  const my = GD, st = GD.steps[GD.at];
  try {
    if (st.view && view !== st.view) { view = st.view; render(); }
    if (st.go) st.go();
  } catch (e) { console.error(e); }
  // wait for the target (pages slide in, 3D loads)
  let el = null;
  for (let t = 0; t < (st.sel ? 25 : 1); t++) {
    await new Promise(r => setTimeout(r, t ? 120 : (st.wait ?? 120)));
    if (GD !== my) return;
    el = st.sel ? [...document.querySelectorAll(st.sel)].find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) : null;
    if (el || !st.sel) break;
  }
  if (el && st.scroll !== false) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center' }); }
  guidePaint(el, st);
}
function guidePaint(el, st) {
  if (!GD) return;
  document.body.classList.add('guiding');
  let ov = document.getElementById('guidefx');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'guidefx'; document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-gd]'); if (!b) return;
      const a = b.dataset.gd; if (a === 'next') guideGo(1); else if (a === 'back') guideGo(-1); else guideEnd(false);
    });
  }
  const n = GD.steps.length, k = GD.at, W = Math.min(350, innerWidth - 32);
  const r = el ? el.getBoundingClientRect() : null, pad = 8;
  const sp = r && { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  ov.innerHTML = `${sp ? `<div class="gd-spot" style="left:${sp.x}px;top:${sp.y}px;width:${sp.w}px;height:${sp.h}px"><i></i></div>` : '<div class="gd-dim"></div>'}
    <svg class="gd-arrow" width="100%" height="100%"></svg>
    <div class="gd-card ${sp ? '' : 'centre'}" style="width:${W}px">
      <div class="gd-top"><span class="gd-name">🧭 ${esc(GUIDES[GD.id].name)}</span><span class="gd-dots">${Array.from({ length: n }, (_, i) => `<i class="${i === k ? 'on' : i < k ? 'done' : ''}"></i>`).join('')}</span></div>
      <h3>${st.title}</h3><p>${st.text}</p>
      <div class="gd-row"><button class="btn small ghost" data-gd="skip">Skip guide</button><span style="flex:1"></span>${k ? '<button class="btn small" data-gd="back">← Back</button>' : ''}<button class="btn small primary" data-gd="next">${k === n - 1 ? 'Done ✓' : 'Next →'}</button></div></div>`;
  const card = ov.querySelector('.gd-card'), H = card.offsetHeight;
  let cx = (innerWidth - W) / 2, cy = (innerHeight - H) / 2;
  if (sp) {
    const room = { right: innerWidth - (sp.x + sp.w), left: sp.x, bottom: innerHeight - (sp.y + sp.h), top: sp.y };
    const fits = { right: room.right > W + 92, left: room.left > W + 92, bottom: room.bottom > H + 82, top: room.top > H + 82 };
    const side = st.place && fits[st.place] ? st.place : ['right', 'bottom', 'left', 'top'].find(s => fits[s]) || 'centre';
    const midY = Math.max(12, Math.min(innerHeight - H - 12, sp.y + sp.h / 2 - H / 2)), midX = Math.max(12, Math.min(innerWidth - W - 12, sp.x + sp.w / 2 - W / 2));
    if (side === 'right') { cx = sp.x + sp.w + 80; cy = midY; }
    else if (side === 'left') { cx = sp.x - W - 80; cy = midY; }
    else if (side === 'bottom') { cx = midX; cy = sp.y + sp.h + 70; }
    else if (side === 'top') { cx = midX; cy = sp.y - H - 70; }
    else { cx = innerWidth - W - 20; cy = innerHeight - H - 20; }
  }
  card.style.left = cx + 'px'; card.style.top = cy + 'px';
  // a curved arrow from the card to the thing it talks about
  if (sp) {
    const tx = Math.max(sp.x, Math.min(sp.x + sp.w, cx + W / 2)), ty = Math.max(sp.y, Math.min(sp.y + sp.h, cy + H / 2));
    const ax = Math.max(cx, Math.min(cx + W, tx)), ay = Math.max(cy, Math.min(cy + H, ty));
    // start from the card edge facing the target, end just outside the spotlight
    const sx = ax, sy = ay;
    let ex = tx, ey = ty; const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
    if (len > 30) {
      ex -= dx / len * 6; ey -= dy / len * 6;
      const mx = (sx + ex) / 2 - dy * .25, my = (sy + ey) / 2 + dx * .25;
      ov.querySelector('.gd-arrow').innerHTML = `<defs><marker id="gdhead" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--gd-c)"/></marker></defs>
        <path class="gd-path" d="M${sx},${sy} Q${mx},${my} ${ex},${ey}" marker-end="url(#gdhead)"/>`;
    }
  }
}
window.addEventListener('resize', () => { if (GD) guideDraw(); });
document.addEventListener('keydown', e => {
  if (!GD) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); guideEnd(false); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); guideGo(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); guideGo(-1); }
}, true);
