'use strict';
/* 2.67 Launch (build stage 8).
   - Planner-only mode: for people who aren't at Westbourne. The planner side
     and their own island, no houses. Chosen at first run, and switched on by
     itself when someone verifies an email that isn't on the year list.
   - Accounts with a real email: Westbourne students sign up with their school
     address and open the link Firebase emails them. The server checks the year
     list (launch.go). Old username accounts keep working until launch.
   - Invites: a 6-character code and a link; both people get Lumen and Ember
     when the new person finishes their first focus session.
   - Owner tools (Eli's verified account only): load the hashed year list, set
     badges by hand, and the launch switch (the full reset for everyone).
   - The launch reset itself, run once on each computer when the owner flips it. */

const DL_URL = 'https://diddyfoid676767.github.io/life-planner/download/';
const SCHOOL_DOMAIN = 'westbourne.vic.edu.au';
const INVITE_REWARD = 50;

const plannerOnly = () => !!(typeof D === 'object' && D && D.settings && D.settings.mode === 'planner');
function applyMode() { document.body.classList.toggle('mode-planner', plannerOnly()); }
function setMode(m) {
  D.settings.mode = m;
  if (m === 'planner' && typeof hsState === 'function') { const st = hsState(); st.id = ''; }
  save(); applyMode();
}
// can this person join a house? Verified Westbourne students; before launch, old accounts and people not signed in too
function schoolReady() {
  if (plannerOnly()) return false;
  if (acct.school) return true;
  if (acct.launch?.reset) return false;
  return !(acct.signedIn && !acct.legacy);
}
function schoolNeeded() {
  toast('Verify your school email first', acct.signedIn && !acct.legacy && acct.verified
    ? "That email isn't on the Westbourne year list, so houses aren't open to it."
    : 'Houses are for Westbourne students. Sign up with your school email in Settings, Account, and open the link we email you.', { cls: 'danger' });
}
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';

// ---------- the sign-up / log-in card ----------
let emTab = 'signup', emBusy = false, emPoll = 0;
function emailCard(inWizard) {
  const school = !plannerOnly();
  const inv = D.settings.invite || '';
  if (emTab === 'old') return `<div class="card acctcard"><div class="acct-login"><h2>Log in with your old username</h2>
    <p class="muted small-text">Old username accounts work until launch (1 Feb). After that everyone uses a school email account.</p>
    <form id="acctForm" autocomplete="on"><label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+"></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="72"></label>
      <div class="row"><button class="btn primary" data-acct="login" ${acctBusy ? 'disabled' : ''}>Log in</button><a href="#" class="small-text" data-em="tab" data-v="login">Back</a></div></form></div></div>`;
  const tabs = `<div class="seg emtabs"><button class="${emTab === 'signup' ? 'on' : ''}" data-em="tab" data-v="signup">Sign up</button><button class="${emTab === 'login' ? 'on' : ''}" data-em="tab" data-v="login">Log in</button></div>`;
  return `<div class="card acctcard"><div class="acct-login">
    ${inWizard ? '' : '<div class="acct-hero">👥</div><h2>Your Solis account</h2>'}
    <p class="muted small-text">${school
      ? `Use your <b>school email</b> (…@${SCHOOL_DOMAIN}). We email you a link to prove it's you, and that unlocks your house.`
      : 'Any email works. An account lets you add friends, race them on the leaderboards and chat. Only your name, avatar and leaderboard numbers are shared.'}</p>
    ${tabs}
    <form id="emForm" autocomplete="on">
      ${emTab === 'signup' && !school ? `<label>First name<input name="name" maxlength="30" value="${esc(D.settings.name || '')}" placeholder="e.g. Sam"></label>` : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required maxlength="120" placeholder="${school ? 'you@' + SCHOOL_DOMAIN : 'you@example.com'}"></label>
      <label>Password<input name="password" type="password" autocomplete="${emTab === 'signup' ? 'new-password' : 'current-password'}" required minlength="8" maxlength="72" placeholder="8+ characters"></label>
      ${emTab === 'signup' ? `<label>Invite code <span class="muted">(optional)</span><input name="invite" maxlength="6" value="${esc(inv)}" placeholder="e.g. 3F9A1C" style="text-transform:uppercase"></label>` : ''}
      <div class="row"><button class="btn primary" data-em="${emTab}" ${emBusy ? 'disabled' : ''}>${emTab === 'signup' ? 'Create account' : 'Log in'}</button>
        ${emTab === 'login' ? '<a href="#" class="small-text" data-em="forgot">Forgot your password?</a>' : ''}</div>
      ${emTab === 'login' && !acct.launch?.reset ? '<p class="small-text"><a href="#" data-em="tab" data-v="old">Log in with an old username instead</a></p>' : ''}
    </form></div></div>`;
}
// signed in with an email: waiting for the link, or done
function emailAcctCard() {
  if (!acct.verified) {
    emWatch();
    return `<div class="card acctcard emwait"><div class="acct-hero">📬</div><h2>Check your inbox</h2>
      <p>We sent a link to <b>${esc(acct.email)}</b>. Open it, then come back here. Solis notices by itself.</p>
      <p class="muted small-text">Nothing there? Check junk or "Other". School inboxes can take a few minutes.</p>
      <div class="row"><button class="btn primary" data-em="check" ${emBusy ? 'disabled' : ''}>I've opened it</button><button class="btn" data-em="resend">Send it again</button><button class="btn ghost" data-em="logout">Use a different email</button></div></div>`;
  }
  const status = acct.school ? '<span class="tag green">✅ Westbourne student</span>' : '<span class="tag">📅 Planner only</span>';
  return `<div class="card acctcard"><div class="card-head"><h2>Your account</h2>${status}</div>
    <div class="row"><span class="acct-chip">${safeBadge(avatarSpec(), 36)}<b>${esc(acct.name || D.settings.name || acct.email)}</b>${typeof badgeTags === 'function' ? badgeTags(myBadges) : ''}</span><span style="flex:1"></span>
      <button class="btn small" data-acct="logout">Log out</button><button class="btn small danger" data-acct="delete">Delete account</button></div>
    <p class="muted small-text">${esc(acct.email)} · friends find you by your name${acct.school ? ' or school email' : ''}. Your invite code is <b>${esc((acct.ic || '').toUpperCase())}</b>.</p></div>`;
}
// old username accounts: a nudge to make the new one before launch
function legacyBanner() {
  if (!acct.signedIn || !acct.legacy) return '';
  return `<div class="card emlegacy"><b>🚀 New accounts are here.</b> At launch (1 Feb) everyone moves to accounts with their school email and starts fresh, and usernames stop working. You can make yours now: log out, then sign up with your school email.</div>`;
}
function emWatch() {
  if (emPoll || !acct.signedIn || acct.verified || acct.legacy) return;
  emPoll = setInterval(async () => {
    if (!acct.signedIn || acct.verified || acct.legacy || document.hidden) { if (!acct.signedIn || acct.verified) { clearInterval(emPoll); emPoll = 0; } return; }
    try { await emPost({ action: 'check' }, true); } catch { }
  }, 6000);
}
async function emPost(body, quiet) {
  const r = await fetch('/api/account/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  const was = acct.verified, wasSchool = acct.school;
  await loadAccount();
  if ((acct.verified && !was) || (acct.school && !wasSchool)) emVerified();
  else if (!quiet) emRedraw();
  return j;
}
// the email link was opened: Westbourne student, or planner-only
function emVerified() {
  if (acct.school) {
    if (plannerOnly()) setMode('school');
    else if (!D.settings.mode) { D.settings.mode = 'school'; save(); }
    if (!D.settings.name && acct.name) { D.settings.name = firstName(acct.name); save(); }
    toast(`✅ You're verified${acct.name ? ', ' + firstName(acct.name) : ''}!`, 'Westbourne student: houses, house islands and the weekly boss are open to you.');
  } else {
    if (!plannerOnly()) setMode('planner');
    toast('📅 Planner-only mode', `That email isn't on the Westbourne year list, so Solis is set up as a planner: to-dos, study, fitness, your own island and friends. Houses are only for Westbourne students.`);
  }
  publishMe(true); inviteSync(true);
  emRedraw();
}
function emRedraw() { if (typeof wiz !== 'undefined' && wiz) drawSetup(); if (!modal.open) render(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-em]'); if (!el) return;
  e.preventDefault();
  const a = el.dataset.em;
  if (a === 'tab') { emTab = el.dataset.v; emRedraw(); return; }
  if (a === 'signup' || a === 'login') {
    const f = document.getElementById('emForm'); if (!f || !f.reportValidity()) return;
    const email = f.email.value.trim().toLowerCase(), password = f.password.value;
    if (a === 'signup' && !plannerOnly() && !email.endsWith('@' + SCHOOL_DOMAIN)
      && !confirm(`That isn't a Westbourne school email.\n\nYou can still use Solis as a planner, but houses are only for Westbourne students. Carry on with ${email}?`)) return;
    let inviter = '';
    const code = (f.invite?.value || '').trim().toLowerCase();
    if (a === 'signup' && code) {
      const p = await inviteLookup(code);
      if (!p) { toast("That invite code didn't work", 'Check it, or leave it empty.', { cls: 'danger' }); return; }
      inviter = p.uid; D.settings.invite = code; D.settings.invitedBy = p.username; D.settings.inviteHouse = p.stats?.hs?.h || '';
      if (!friendNames().includes(p.username)) friendNames().push(p.username);
      save();
    }
    emBusy = true; el.textContent = a === 'signup' ? 'Creating…' : 'Logging in…';
    try {
      await emPost({ action: a, email, password, name: f.name?.value || D.settings.name || '', inviter });
      emBusy = false;
      if (f.name?.value && !D.settings.name) { D.settings.name = f.name.value.trim(); save(); }
      if (acct.verified) emVerified();
      else toast(a === 'signup' ? '📬 Check your inbox' : '👋 Welcome back', a === 'signup' ? `We sent a link to ${email}. Open it to finish.` : 'Open the link we emailed you to finish.');
      await publishMe(true); await refreshFriends(true);
    } catch (err) { emBusy = false; toast(a === 'signup' ? "Couldn't create the account" : "Couldn't log in", err.message, { cls: 'danger' }); }
    emRedraw();
  } else if (a === 'check') {
    emBusy = true; emRedraw();
    try { await emPost({ action: 'check' }); if (!acct.verified) toast('Not yet', "The link hasn't been opened yet. It can take a minute to arrive."); }
    catch (err) { toast("Couldn't check", err.message, { cls: 'danger' }); }
    emBusy = false; emRedraw();
  } else if (a === 'resend') {
    try { await emPost({ action: 'resend' }); toast('📬 Sent again', `Check ${acct.email}.`); } catch (err) { toast("Couldn't send it", err.message, { cls: 'danger' }); }
  } else if (a === 'logout') {
    await acctPost({ action: 'logout' }).catch(() => { }); await loadAccount(); friendRows = []; emRedraw();
  } else if (a === 'forgot') {
    const email = prompt('Your email, and we\'ll send a link to pick a new password:', document.querySelector('#emForm [name=email]')?.value || '');
    if (!email) return;
    try { await emPost({ action: 'reset', email }); toast('📬 Check your inbox', `If ${email} has an account, a reset link is on its way.`); } catch (err) { toast("Couldn't send it", err.message, { cls: 'danger' }); }
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'emForm') e.preventDefault(); });

// ---------- planner-only / Westbourne switch in Settings ----------
function modeCard() {
  if (ONLINE) return '';
  const p = plannerOnly();
  return `<div class="card" data-sec="account"><div class="card-head"><h2>Solis mode</h2><span class="tag">${p ? '📅 Planner only' : '🏫 Westbourne'}</span></div>
    <p class="muted small-text">${p ? 'The planner side and your own island. Houses, the house island and the weekly house boss are hidden.' : 'Everything, including houses. Houses need a verified Westbourne school email.'}</p>
    <div class="row"><button class="btn small" data-mode="${p ? 'school' : 'planner'}">${p ? "I'm at Westbourne" : 'Switch to planner only'}</button><button class="btn small ghost" data-act="howto">📖 How to start</button></div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-mode]'); if (!el) return;
  const m = el.dataset.mode;
  if (m === 'planner' && hsState().id && !confirm('Switch to planner only? You leave your house, and only a verified Westbourne email can join one again.')) return;
  if (m === 'school' && acct.signedIn && acct.verified && !acct.school) { schoolNeeded(); return; }
  setMode(m); render();
  if (m === 'school' && !acct.school) toast('🏫 Westbourne mode', 'Sign up or log in with your school email to join your house.');
});

// ---------- invites ----------
async function inviteLookup(code) {
  if (!/^[0-9a-f]{6}$/.test(code)) return null;
  try { const r = await (await fetch('/api/account/people?ic=' + code, { cache: 'no-store' })).json(); return Array.isArray(r) && r[0] ? r[0] : null; } catch { return null; }
}
const inviteLink = () => DL_URL + '?i=' + (acct.ic || '').toUpperCase() + (hsState().id ? '&h=' + hsState().id : '');
function inviteCard() {
  if (ONLINE || !acct.signedIn || acct.legacy || !acct.ic) return '';
  const paid = Object.keys(D.settings.invitePaid || {}).length;
  return `<div class="card invcard"><div class="card-head"><h2>🎟️ Invite friends</h2>${paid ? `<span class="tag green">${paid} joined</span>` : ''}</div>
    <p class="small-text">Send your link. When a friend finishes their first focus session, you <b>both</b> get ${INVITE_REWARD} ${LUMEN} Lumen and ${INVITE_REWARD} ${EMBER} Ember${hsState().id ? ', and they land in your house' : ''}.</p>
    <div class="row"><input readonly value="${esc(inviteLink())}" style="flex:1;min-width:220px" onclick="this.select()"><button class="btn small primary" data-inv="copy">📋 Copy link</button></div>
    <p class="muted small-text">Or tell them your code: <b style="letter-spacing:2px">${esc(acct.ic.toUpperCase())}</b></p></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-inv]'); if (!el) return;
  if (el.dataset.inv === 'copy') navigator.clipboard?.writeText(inviteLink()).then(() => toast('📋 Link copied', 'Paste it into a group chat.'), () => toast('Copy it from the box', ''));
});
// both sides of the reward. You: your first focus session after joining with
// a code. The friend who invited you: your profile says you've done one.
let invSyncAt = 0;
async function inviteSync(force) {
  if (ONLINE || TESTMODE || !acct.signedIn || acct.legacy || (!force && Date.now() - invSyncAt < 10 * 60000)) return;
  invSyncAt = Date.now();
  const s = D.settings;
  if (s.invitedBy && !s.inviteRewarded && firstSessionDone()) {
    s.inviteRewarded = today(); ftAddCurrency(INVITE_REWARD, INVITE_REWARD); save();
    toast('🎟️ Invite reward', `Your first session is done: you and the friend who invited you each get ${INVITE_REWARD} Lumen and ${INVITE_REWARD} Ember.`);
    publishMe(true);
  }
  let list = [];
  try { list = await (await fetch('/api/account/people?invited=1', { cache: 'no-store' })).json(); } catch { }
  if (!Array.isArray(list)) return;
  const paid = s.invitePaid = s.invitePaid || {};
  let n = 0;
  for (const p of list) {
    if (!p.uid || !p.fs || paid[p.uid]) continue;
    paid[p.uid] = today(); n++; ftAddCurrency(INVITE_REWARD, INVITE_REWARD);
    if (!friendNames().includes(p.username)) friendNames().push(p.username);
    toast(`🎟️ ${p.display || 'Your friend'} joined Solis`, `They finished their first session: +${INVITE_REWARD} Lumen and +${INVITE_REWARD} Ember for you.`);
  }
  if (n) { save(); refreshFriends(true); if (!modal.open) render(); }
}
const firstSessionDone = () => (D.focusLogs || []).some(l => +l.mins >= 10);
// an invite link opened on the download page leaves ?i=CODE&h=house; the page
// shows the code, and the welcome asks for it

// ---------- owner tools ----------
function ownerCard() {
  if (ONLINE || !acct.owner) return '';
  const L = acct.launch || {};
  return `<div class="card owncard" data-sec="account" style="grid-column:1/-1"><div class="card-head"><h2>🛠️ Owner tools <span class="tag">only you see this</span></h2></div>
    <div class="owngrid">
      <div><h3>Year list</h3><p class="muted small-text">Load <b>year-list-hashes.json</b>. It holds only salted hashes and encrypted names, never the emails. Students on it can verify; everyone else gets planner only.</p>
        <label class="btn small">📂 Load the year list<input type="file" accept=".json,application/json" data-own="yr" hidden></label></div>
      <div><h3>Badges</h3><p class="muted small-text">Find someone by name or school email and give or take the beta badge.</p>
        <input id="ownFind" placeholder="Name or school email…" autocomplete="off" style="width:100%"><ul class="friendlist" id="ownRes"></ul></div>
      <div><h3>🚀 Launch</h3>${L.reset ? `<p class="small-text"><b>Launched</b> ${esc(L.at ? fmtDate(L.at.slice(0, 10)) : '')}. Old username accounts are switched off and every copy of Solis has reset its world.</p>`
        : `<p class="muted small-text">The full reset, planned for 1 Feb 2027. Every copy of Solis backs up its planner, then resets Lumen, Ember, islands, cards, gear, houses and friends lists, and old username accounts stop working. Planner data (tasks, SACs, study and workout history) stays. It can't be undone.</p>
        <button class="btn small danger" data-own="launch">Launch Solis…</button>`}</div>
    </div></div>`;
}
async function ownPost(body) {
  const r = await fetch('/api/account/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
document.addEventListener('change', async e => {
  const el = e.target; if (el.dataset?.own !== 'yr' || !el.files?.[0]) return;
  try {
    const j = JSON.parse(await el.files[0].text());
    if (!Array.isArray(j.entries)) throw new Error("That file isn't a Solis year list.");
    const r = await ownPost({ action: 'yr', entries: j.entries });
    toast('✅ Year list loaded', `${r.n} students can now verify. Press "I've opened it" or log in again to verify yourself.`);
    await emPost({ action: 'check' }, true).catch(() => { });
  } catch (err) { toast("Couldn't load the year list", err.message, { cls: 'danger' }); }
  el.value = '';
});
let ownTimer = 0, ownRows = [];
document.addEventListener('input', e => {
  if (e.target.id !== 'ownFind') return;
  clearTimeout(ownTimer);
  const q = e.target.value.trim().toLowerCase();
  ownTimer = setTimeout(async () => {
    ownRows = [];
    if (q) try { ownRows = await (await fetch('/api/account/people?q=' + encodeURIComponent(q), { cache: 'no-store' })).json(); } catch { }
    if (!Array.isArray(ownRows)) ownRows = [];
    const ul = document.getElementById('ownRes'); if (!ul) return;
    ul.innerHTML = ownRows.map((p, i) => { const b = p.badges || [], beta = b.includes('beta'); return `<li>${safeBadge(p.avatar, 24)}<b>${esc(p.display || p.username)}</b>${badgeTags(b, true)}${p.v ? '<span class="tag green">✓</span>' : ''}<span style="flex:1"></span><button class="btn small" data-own="${beta ? 'unbeta' : 'beta'}" data-i="${i}">${beta ? 'Take beta' : 'Give beta'}</button></li>`; }).join('') || (q ? '<li class="muted small-text">No one found.</li>' : '');
  }, 300);
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-own]'); if (!el || el.tagName === 'INPUT') return;
  const a = el.dataset.own;
  if (a === 'beta' || a === 'unbeta') {
    const p = ownRows[+el.dataset.i]; if (!p) return;
    const b = (p.badges || []).filter(x => x !== 'beta'); if (a === 'beta') b.push('beta');
    try { await ownPost({ action: 'badges', u: p.username, badges: b }); p.badges = b; toast(a === 'beta' ? '🅱️ Beta badge given' : 'Beta badge taken', p.display || ''); document.getElementById('ownFind')?.dispatchEvent(new Event('input', { bubbles: true })); }
    catch (err) { toast("Couldn't change badges", err.message, { cls: 'danger' }); }
  } else if (a === 'launch') {
    if (prompt('This resets the world for EVERYONE (Lumen, Ember, islands, houses, friends lists) and switches off old username accounts. It can\'t be undone.\n\nType LAUNCH to go ahead.') !== 'LAUNCH') return;
    try { await ownPost({ action: 'launch', reset: true }); await loadAccount(); render(); toast('🚀 Solis has launched', 'Every copy of Solis resets within about 10 minutes of opening.'); launchCheck(); }
    catch (err) { toast("Couldn't launch", err.message, { cls: 'danger' }); }
  }
});

// ---------- the launch reset, once per computer ----------
async function launchCheck() {
  if (ONLINE || TESTMODE || !loaded || !acct.launch?.reset || !acct.launch.at) return;
  const s = D.settings;
  if (s.launchAt === acct.launch.at) return;
  if (!s.setupDone) { s.launchAt = acct.launch.at; save(); return; } // a new player starts fresh anyway
  try { if (typeof saveNow === 'function') await saveNow(); await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot: 'before-launch' }) }); } catch { }
  D.cards = { since: today() }; D.house = {}; D.challenges = []; D.friendsU = [];
  delete s.invitePaid; delete s.inviteRewarded; delete s.invitedBy;
  s.launchAt = acct.launch.at; save();
  if (acct.signedIn && acct.legacy) { await acctPost({ action: 'logout' }).catch(() => { }); await loadAccount(); }
  friendRows = [];
  render();
  mform.innerHTML = `<h2>🚀 Solis has launched!</h2>
    <p>Everyone starts fresh today: new islands, new Lumen and Ember, new houses. Your planner (tasks, SACs, calendar, study and workout history) is all still here, and a backup of everything from before is in Settings, Backups.</p>
    ${plannerOnly() ? '' : `<p><b>Next:</b> make your account with your school email and join your house.</p>`}
    <div class="modal-actions"><button type="button" class="btn primary" data-mact="cancel">Let's go</button>${acct.signedIn ? '' : '<button type="button" class="btn" data-act="gotoAccount">Make my account</button>'}</div>`;
  formCtx = { fields: [], onSave() { } }; modal.showModal();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-act="gotoAccount"]')) { modal.close?.(); emTab = 'signup'; view = 'settings'; render(); setTimeout(() => document.querySelector('[data-sec="account"]')?.scrollIntoView({ behavior: 'smooth' }), 50); }
  if (e.target.closest('[data-act="howto"]')) openHowTo();
});

// ---------- how to start ----------
function openHowTo() {
  const school = !plannerOnly();
  mform.innerHTML = `<h2>📖 How to start with Solis</h2>
    <ol class="howto">
      <li><b>Add your subjects</b> on Study. Each gets a colour that shows up everywhere.</li>
      <li><b>Start a focus timer</b> (Study, or the ⏱ button). Every study minute earns ${LUMEN} Lumen; every workout you log earns ${EMBER} Ember.</li>
      <li><b>Build your island</b> on Islands with the Lumen and Ember you earn.</li>
      ${school ? '<li><b>Join your house</b> (needs your verified school email). Your sessions and workouts become hits on the weekly house boss.</li>' : '<li><b>Spar a boss</b> on the Boss island when you want a challenge.</li>'}
      <li><b>Add friends</b> by name${school ? ' or school email' : ''} on Friends, and send your invite link: you both get Lumen and Ember when they finish their first session.</li>
      <li><b>Put things in the planner</b>: to-dos, SACs and tests, calendar links. Today shows what's next.</li>
    </ol>
    <p class="muted small-text">Updates install by themselves. Stuck? The 💬 Feedback button sends a message straight to the developer.</p>
    <div class="modal-actions"><button type="button" class="btn primary" data-mact="cancel">Got it</button></div>`;
  formCtx = { fields: [], onSave() { } }; modal.showModal();
}

// every few minutes: the launch switch and invite rewards
setTimeout(() => { if (typeof D === 'object' && D) applyMode(); }, 0);
setInterval(() => { if (!ONLINE && typeof D === 'object' && D) { applyMode(); launchCheck(); inviteSync(); } }, 60000);
setTimeout(async () => { if (ONLINE || typeof D !== 'object' || !D) return; await loadAccount(); applyMode(); launchCheck(); inviteSync(true); }, 4000);

// the walkthrough after the 2.67 update
if (typeof GUIDES === 'object') GUIDES.launch = {
  name: 'School email accounts and invites',
  steps: [
    { title: 'Accounts with your school email 🏫', text: 'New Solis accounts use your <b>school email</b>. We email you a link, you open it, and you\'re a verified Westbourne student with your real name. Usernames stop working at launch (1 Feb), so make your new account any time before then.', view: 'settings', sel: '[data-sec="account"]' },
    { title: 'Planner only, for everyone else', text: 'Friends from other schools can use Solis too: they pick <b>Just the planner</b> and get to-dos, study, fitness and their own island. Houses stay for verified Westbourne students. Switch here any time.', view: 'settings', sel: '[data-mode]' },
    { title: 'Invite friends, both get rewards 🎟️', text: 'Once you have your new account, Friends shows your invite link. When a friend finishes their first focus session you <b>both</b> get 50 Lumen and 50 Ember. Find friends by name or school email.', view: 'friends' },
    { title: 'Getting Solis is one link', text: 'Send people to <b>diddyfoid676767.github.io/life-planner/download</b>: one button, a how-to-start guide and help with the blue Windows warning.' },
  ],
};
