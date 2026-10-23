'use strict';
/* Friend accounts: log in with a username and password, search for friends by
   username, and see their live leaderboard rows. The planner app talks to the
   friends server; this page only sees usernames, avatars and stats. Your own
   row is published when you open the leaderboard and every 10 minutes. */

let acct = { configured: false, signedIn: false, username: '' }, acctLoaded = false;
let friendRows = [], friendRowsAt = 0, acctSearch = [], acctBusy = false, acctPublishedAt = 0;

async function loadAccount() {
  if (ONLINE) return acct;
  try { acct = await (await fetch('/api/account', { cache: 'no-store' })).json(); } catch { }
  acctLoaded = true;
  return acct;
}
async function acctPost(body) {
  const r = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}

function myStatsRow() {
  const r = myBoardRow();
  return { display: (D.settings.name || '').slice(0, 30), avatar: r.av, stats: { week: r.week, study: r.study, work: r.work, health: r.health } };
}
async function publishMe(force) {
  if (!acct.signedIn || (!force && Date.now() - acctPublishedAt < 10 * 60000)) return;
  acctPublishedAt = Date.now();
  try { await fetch('/api/account/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(myStatsRow()) }); } catch { }
}
const friendNames = () => (D.friendsU = D.friendsU || []);
function toBoardRow(p) {
  const s = p.stats || {};
  return { id: 'u:' + p.username, user: p.username, name: p.display || p.username, week: s.week || '', study: s.study || {}, work: s.work || {}, health: s.health || {}, av: p.avatar || null, updated: Date.parse(p.updated_at) || 0 };
}
async function refreshFriends(force) {
  const names = friendNames();
  if (!acct.configured || !names.length || (!force && Date.now() - friendRowsAt < 60000)) return;
  friendRowsAt = Date.now();
  try {
    const list = await (await fetch('/api/account/people?u=' + encodeURIComponent(names.join(',')), { cache: 'no-store' })).json();
    if (Array.isArray(list)) { friendRows = list.map(toBoardRow); if (view === 'training' && !modal.open) render(); }
  } catch { }
}
setInterval(() => { if (acct.signedIn) { publishMe(); refreshFriends(); } }, 5 * 60000);

// the login page / account card
function accountCard() {
  if (ONLINE) return '';
  if (!acctLoaded) { loadAccount().then(() => render()); return '<div class="card acctcard"><p class="muted">Loading your account…</p></div>'; }
  if (!acct.configured) return '';
  if (!acct.signedIn) return `<div class="card acctcard"><div class="acct-login">
      <div class="acct-hero">👥</div><h2>Log in to Life Planner</h2>
      <p class="muted small-text">Make an account to find friends by username and race them on the leaderboards. Only your username, avatar and leaderboard numbers are shared.</p>
      <form id="acctForm" autocomplete="on">
        <label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="e.g. speedy_sam"></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="72" placeholder="8+ characters"></label>
        <div class="row"><button class="btn primary" data-acct="login" ${acctBusy ? 'disabled' : ''}>Log in</button><button class="btn" data-acct="signup" ${acctBusy ? 'disabled' : ''}>Create account</button></div>
        <p class="muted small-text">There's no email on the account, so write your password down somewhere safe.</p>
      </form></div></div>`;
  return `<div class="card acctcard"><div class="card-head"><h2>Your account</h2></div>
    <div class="row"><span class="acct-chip">${safeBadge(avatarSpec(), 36)}<b>@${esc(acct.username)}</b></span><span style="flex:1"></span>
      <button class="btn small" data-acct="logout">Log out</button><button class="btn small danger" data-acct="delete">Delete account</button></div>
    <p class="muted small-text">Friends can find you by searching <b>${esc(acct.username)}</b> on the leaderboard.</p></div>`;
}

// friend search on the leaderboard
function friendSearchHtml() {
  if (ONLINE || !acct.configured) return '';
  if (!acct.signedIn) return `<div class="friendbox"><h3>👥 Friends</h3><p class="muted small-text">Log in to add friends by username and see their numbers live.</p><button class="btn primary" data-act="goto" data-v="settings">Log in or create an account</button></div>`;
  const names = friendNames();
  return `<div class="friendbox"><h3>👥 Friends <span class="muted small-text">you're @${esc(acct.username)}</span></h3>
    <div class="row"><input id="friendSearch" placeholder="Search usernames…" autocomplete="off" style="flex:1;min-width:200px"></div>
    <ul class="friendlist" id="friendResults">${searchRowsHtml()}</ul>
    ${names.length ? `<div class="daygroup">Your friends</div><ul class="friendlist">${names.map(n => { const f = friendRows.find(x => x.user === n); return `<li>${safeBadge(f?.av, 28)}<b>${esc(f?.name || n)}</b><span class="muted small-text">@${esc(n)}${f ? ` · updated ${esc(ago(new Date(f.updated).toISOString()))}` : ' · not found'}</span><span style="flex:1"></span><button class="iconbtn" data-acct="unfriend" data-u="${esc(n)}" title="Remove">✕</button></li>`; }).join('')}</ul>` : ''}</div>`;
}
function searchRowsHtml() {
  const names = friendNames();
  return acctSearch.filter(p => p.username !== acct.username).map(p => `<li>${safeBadge(p.avatar, 28)}<b>${esc(p.display || p.username)}</b><span class="muted small-text">@${esc(p.username)}</span><span style="flex:1"></span>${names.includes(p.username) ? '<span class="tag green">Friend</span>' : `<button class="btn small primary" data-acct="friend" data-u="${esc(p.username)}">Add</button>`}</li>`).join('');
}
let searchTimer = 0;
document.addEventListener('input', e => {
  if (e.target.id !== 'friendSearch') return;
  clearTimeout(searchTimer);
  const q = e.target.value.trim().toLowerCase().replace(/^@/, '');
  searchTimer = setTimeout(async () => {
    if (!q) acctSearch = [];
    else try { acctSearch = await (await fetch('/api/account/people?q=' + encodeURIComponent(q), { cache: 'no-store' })).json(); } catch { acctSearch = []; }
    if (!Array.isArray(acctSearch)) acctSearch = [];
    const ul = document.getElementById('friendResults'); if (ul) ul.innerHTML = searchRowsHtml() || (q ? '<li class="muted small-text">No one with that username yet.</li>' : '');
  }, 250);
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-acct]'); if (!el) return;
  e.preventDefault();
  const a = el.dataset.acct;
  if (a === 'login' || a === 'signup') {
    const f = document.getElementById('acctForm'); if (!f.reportValidity()) return;
    const username = f.username.value.trim().toLowerCase(), password = f.password.value;
    if (a === 'signup' && !confirm(`Create the account @${username}? Friends will be able to find you by this name.`)) return;
    acctBusy = true; el.textContent = a === 'login' ? 'Logging in…' : 'Creating…';
    try {
      await acctPost({ action: a, username, password });
      await loadAccount(); acctBusy = false;
      await publishMe(true); await refreshFriends(true);
      toast(a === 'login' ? `👋 Welcome back, @${username}` : `🎉 You're @${username}`, 'Find friends on Training & Arena → Leaderboard.');
    } catch (err) { acctBusy = false; toast(a === 'login' ? "Couldn't log in" : "Couldn't create the account", err.message, { cls: 'danger' }); }
    render();
  } else if (a === 'logout') {
    if (!confirm('Log out of your Life Planner account?')) return;
    await acctPost({ action: 'logout' }).catch(() => { }); await loadAccount(); friendRows = []; render(); toast('Logged out', '');
  } else if (a === 'delete') {
    if (prompt(`This removes @${acct.username} so friends can't see you any more. Type DELETE to confirm.`) !== 'DELETE') return;
    try { await acctPost({ action: 'delete' }); await loadAccount(); render(); toast('Account deleted', ''); }
    catch (err) { toast("Couldn't delete the account", err.message, { cls: 'danger' }); }
  } else if (a === 'friend') {
    const u = el.dataset.u; if (!friendNames().includes(u)) friendNames().push(u);
    save(); await refreshFriends(true); render(); toast(`👥 @${u} is on your leaderboard`, 'Their numbers update by themselves.');
  } else if (a === 'unfriend') {
    if (!confirm(`Take @${el.dataset.u} off your leaderboard?`)) return;
    D.friendsU = friendNames().filter(n => n !== el.dataset.u); friendRows = friendRows.filter(r => r.user !== el.dataset.u); save(); render();
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'acctForm') e.preventDefault(); });
