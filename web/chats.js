'use strict';
/* Chats: DMs and group chats with friends, plus the Beta and Dev badges shown
   next to names. Chats live on the friends server and only the people in a
   chat can read it. The open chat checks for new messages every few seconds;
   the chat list (and the unread number on the tab) every 30 seconds. */

let myBadges = [], myJersey;
let chatList = [], chatBlocks = [], chatSetup = false, chatLoadedAt = 0, chatOpen = null, chatMsgs = [], chatBusy = false, chatErr = '';
const chatDrafts = {};
const chatMuted = id => !!((window.D && D.settings.chatMute) || {})[id];

// ---------- badges ----------
const BADGES = { dev: ['🛠️', 'DEV', 'Made Life Planner'], beta: ['🧪', 'BETA', 'Signed up during the beta'] };
function badgeTags(list, small) {
  return (Array.isArray(list) ? list : []).filter(b => BADGES[b]).map(b => `<span class="ubadge ${b} ${small ? 'sm' : ''}" title="${esc(BADGES[b][2])}">${BADGES[b][0]} ${BADGES[b][1]}</span>`).join('');
}
async function loadMyBadges() {
  if (!acct.signedIn) return;
  try {
    const [me] = await (await fetch('/api/account/people?u=' + encodeURIComponent(acct.username), { cache: 'no-store' })).json();
    if (me) { myBadges = me.badges || []; myJersey = me.jersey ?? null; }
  } catch { }
  // claim the number you already wear, if no one beat you to it
  if (myJersey === null && D.settings.jerseyNo != null && D.settings.jerseyTaken !== String(D.settings.jerseyNo)) claimJersey(+D.settings.jerseyNo, true);
}

// ---------- unique jersey numbers ----------
async function claimJersey(n, quiet) {
  if (!acct.signedIn || !(n >= 0 && n <= 99)) return true;
  try {
    const r = await fetch('/api/account/jersey', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409) {
      if (quiet) { D.settings.jerseyTaken = String(n); save(); }
      toast(`#${n} is taken`, `${j.by ? '@' + j.by + ' already wears it. ' : ''}Pick another number on the Arena page.`, { cls: 'danger' });
      return false;
    }
    if (r.ok && !j.local) { myJersey = n; if (!quiet) toast(`👕 #${n} is yours`, 'No one else can wear it now.'); }
  } catch { }
  return true;
}
document.addEventListener('change', async e => {
  if (e.target.dataset?.setting !== 'jerseyNo' || !acct.signedIn) return;
  const n = Math.round(+e.target.value);
  if (!(n >= 0 && n <= 99)) return;
  if (!(await claimJersey(n)) && myJersey != null) { D.settings.jerseyNo = String(myJersey); save(); render(); }
});

// ---------- talking to the server ----------
async function chatCall(fn, args) {
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args: args || {} }) });
  const j = await r.json().catch(() => ({}));
  if (j.setup) chatSetup = true;
  if (!r.ok) throw new Error(j.error || 'Something went wrong.');
  chatSetup = false;
  return j.result;
}
async function refreshChats(force) {
  if (ONLINE || !acct.signedIn || (!force && Date.now() - chatLoadedAt < 25000)) return;
  chatLoadedAt = Date.now();
  try {
    const before = new Map(chatList.map(c => [c.id, c.last?.id || 0]));
    chatList = (await chatCall('my_chats')) || [];
    chatErr = '';
    if (!chatBlocks.loaded) { chatBlocks = (await chatCall('my_blocks')) || []; chatBlocks.loaded = true; }
    // a toast for new messages in chats you're not looking at
    for (const c of chatList) {
      const was = before.get(c.id);
      if (before.size && c.last && c.last.u !== acct.username && c.unread && !chatMuted(c.id) && (was === undefined || c.last.id > was) && !(view === 'friends' && chatOpen === c.id) && !chatBlocks.includes(c.last.u))
        toast(`💬 ${chatTitle(c)}`, (c.is_group ? '@' + c.last.u + ': ' : '') + c.last.body, { actions: [['Open', () => { view = 'friends'; openChat(c.id); }]] });
    }
  } catch (e) { chatErr = e.message; }
  updateChatBadge();
  if (view === 'friends' && !modal.open) drawChatList();
}
function updateChatBadge() {
  const b = document.querySelector('#tabs button[data-view=friends]'); if (!b) return;
  const n = chatList.reduce((s, c) => s + (chatMuted(c.id) ? 0 : +c.unread || 0), 0);
  b.dataset.badge = n ? (n > 99 ? '99+' : n) : '';
}
setInterval(() => refreshChats(), 30000);
setInterval(() => { if (view === 'friends' && chatOpen && document.visibilityState === 'visible') pollChat(); }, 3500);

const others = c => (c.members || []).filter(m => m.u !== acct.username);
function chatTitle(c) {
  if (c.name) return c.name;
  const o = others(c);
  if (!o.length) return 'Just you';
  return c.is_group ? o.map(m => m.d || m.u).slice(0, 3).join(', ') + (o.length > 3 ? ` +${o.length - 3}` : '') : (o[0].d || '@' + o[0].u);
}
function chatAvatar(c, size) {
  const o = others(c);
  if (!c.is_group) return safeBadge(o[0]?.av, size);
  return `<span class="chatgav" style="--s:${size}px">${o.slice(0, 2).map(m => safeBadge(m.av, size * .7)).join('')}</span>`;
}

async function openChat(id) {
  chatOpen = id; chatMsgs = []; view = 'friends'; render();
  await pollChat(true);
}
async function pollChat(first) {
  const id = chatOpen; if (!id || chatBusy) return;
  chatBusy = true;
  try {
    const after = first ? 0 : (chatMsgs.at(-1)?.id || 0);
    const r = await fetch(`/api/chat?c=${id}&after=${after}`, { cache: 'no-store' });
    const list = await r.json().catch(() => []);
    if (id !== chatOpen || !r.ok || !Array.isArray(list)) return;
    if (first) chatMsgs = list; else if (list.length) chatMsgs.push(...list.filter(m => !chatMsgs.some(x => x.id === m.id)));
    if (first || list.length) {
      drawChatMsgs(!first && list.some(m => m.p?.username !== acct.username));
      const c = chatList.find(x => x.id === id);
      if (c && (c.unread || first)) { c.unread = 0; updateChatBadge(); drawChatList(); chatCall('mark_read', { c: id }).catch(() => { }); }
    }
  } finally { chatBusy = false; }
}

// ---------- the page ----------
function viewChats(embedded) {
  if (ONLINE || !acctLoaded || !acct.signedIn) return '';
  if (!chatLoadedAt) refreshChats(true);
  const c = chatList.find(x => x.id === chatOpen);
  if (c) setTimeout(() => { const b = document.getElementById('chatMsgs'); if (b) b.scrollTop = b.scrollHeight; document.getElementById('chatInput')?.focus(); });
  return `<div class="row chatbar"><h2 style="margin:0">💬 Chats</h2><span style="flex:1"></span><button class="btn small primary" data-chat="new">✏️ New chat</button></div>
    <div class="chatwrap ${c ? 'open' : ''}"><div class="card chatside"><ul class="chatlist" id="chatList">${chatListHtml()}</ul></div>
      <div class="card chatmain">${c ? chatPaneHtml(c) : `<div class="chatempty"><div class="acct-hero">💬</div><p class="muted">${chatList.length ? 'Pick a chat on the left.' : 'Start a chat with a friend, or make a group.'}</p><button class="btn primary" data-chat="new">✏️ New chat</button></div>`}</div></div>`;
}
function chatListHtml() {
  if (chatSetup) return `<li class="muted small-text chatnote">Chats are being switched on. They'll appear here soon.</li>`;
  if (chatErr && !chatList.length) return `<li class="muted small-text chatnote">${esc(chatErr)}</li>`;
  if (!chatList.length) return `<li class="muted small-text chatnote">${chatLoadedAt ? 'No chats yet.' : 'Loading…'}</li>`;
  return chatList.map(c => {
    const l = c.last, blocked = l && chatBlocks.includes(l.u);
    return `<li class="${c.id === chatOpen ? 'on' : ''} ${c.unread ? 'unread' : ''}" data-chat="open" data-id="${esc(c.id)}">${chatAvatar(c, 40)}
      <div class="main"><b>${esc(chatTitle(c))}${!c.is_group ? badgeTags(others(c)[0]?.b, true) : ''}</b><small>${l ? (blocked ? 'Hidden message' : esc((l.u === acct.username ? 'You: ' : c.is_group ? l.u + ': ' : '') + l.body)) : c.is_group ? `${(c.members || []).length} people` : 'Say hi 👋'}</small></div>
      <div class="chatmeta">${l ? `<small>${esc(chatWhen(l.at))}</small>` : ''}${chatMuted(c.id) ? '<span title="Muted">🔕</span>' : ''}${c.unread ? `<span class="chatunread ${chatMuted(c.id) ? 'muted' : ''}">${c.unread}</span>` : ''}</div></li>`;
  }).join('');
}
function drawChatList() { const ul = document.getElementById('chatList'); if (ul) ul.innerHTML = chatListHtml(); }
function chatWhen(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function chatPaneHtml(c) {
  const o = others(c);
  const sub = c.is_group ? (c.members || []).map(m => m.u === acct.username ? 'you' : '@' + m.u).join(', ') : o[0] ? '@' + o[0].u : '';
  return `<div class="chathead"><button class="iconbtn chatback" data-chat="back" title="Back">‹</button>${chatAvatar(c, 40)}<div class="main"><b>${esc(chatTitle(c))}${!c.is_group ? badgeTags(o[0]?.b) : ''}</b><small>${esc(sub)}</small></div>
      <details class="chatmenu"><summary class="iconbtn" title="More">⋯</summary><div class="chatmenu-pop">
        ${c.is_group ? `<button data-chat="rename">✏️ Rename group</button><button data-chat="add">➕ Add people</button><button data-chat="members">👥 People</button>` : o[0] ? `<button data-chat="block" data-u="${esc(o[0].u)}">${chatBlocks.includes(o[0].u) ? '✅ Unblock' : '🚫 Block'} @${esc(o[0].u)}</button><button data-chat="report" data-u="${esc(o[0].u)}">🚩 Report @${esc(o[0].u)}</button>` : ''}
        <button data-chat="mute">${chatMuted(c.id) ? '🔔 Unmute' : '🔕 Mute'} ${c.is_group ? 'group' : 'chat'}</button>
        <button data-chat="leave" class="danger">🚪 ${c.is_group ? 'Leave group' : 'Delete chat'}</button></div></details></div>
    <div class="chatmsgs" id="chatMsgs">${chatMsgsHtml(c)}</div>
    ${!c.is_group && o[0] && chatBlocks.includes(o[0].u) ? `<p class="muted small-text chatnote">You blocked @${esc(o[0].u)}. Unblock them to send messages.</p>` :
      `<form class="chatsend" id="chatSend"><textarea id="chatInput" rows="1" maxlength="2000" placeholder="Message${c.is_group ? ' the group' : ' ' + esc(o[0]?.d || '@' + (o[0]?.u || ''))}…">${esc(chatDrafts[c.id] || '')}</textarea><button class="btn primary" data-chat="send">Send</button></form>`}`;
}
function chatMsgsHtml(c) {
  if (!chatMsgs.length) return `<p class="muted small-text chatnote">No messages yet. Say hi 👋</p>`;
  const mem = Object.fromEntries((c.members || []).map(m => [m.u, m]));
  let prev = null, prevDay = '';
  return chatMsgs.map(m => {
    const u = m.p?.username || '?', mine = u === acct.username, day = new Date(m.created_at).toDateString();
    const sep = day !== prevDay ? `<div class="chatday">${esc(day === new Date().toDateString() ? 'Today' : new Date(m.created_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }))}</div>` : '';
    const first = prev !== u || sep; prev = u; prevDay = day;
    if (chatBlocks.includes(u)) return `${sep}<div class="chatmsg hidden"><i>Message from someone you blocked</i></div>`;
    return `${sep}<div class="chatmsg ${mine ? 'mine' : ''} ${first ? 'first' : ''}">${!mine && c.is_group ? `<span class="chatmav">${first ? safeBadge(mem[u]?.av, 30) : ''}</span>` : ''}
      <div class="bub">${!mine && c.is_group && first ? `<small class="who">${esc(mem[u]?.d || u)}${badgeTags(mem[u]?.b, true)}</small>` : ''}${esc(m.body).replace(/\n/g, '<br>')}<span class="t">${esc(new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</span></div>
      ${!mine ? `<button class="chatflag" data-chat="report" data-u="${esc(u)}" data-m="${m.id}" title="Report this message">🚩</button>` : ''}</div>`;
  }).join('');
}
function drawChatMsgs(ping) {
  const box = document.getElementById('chatMsgs'), c = chatList.find(x => x.id === chatOpen); if (!box || !c) return;
  const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = chatMsgsHtml(c);
  if (atEnd || !ping) box.scrollTop = box.scrollHeight;
  if (ping && typeof sfx === 'function') try { sfx('notify'); } catch { }
}

async function sendChat() {
  const inp = document.getElementById('chatInput'); if (!inp || !chatOpen) return;
  const body = inp.value.trim(); if (!body) return;
  const id = chatOpen;
  inp.value = ''; chatDrafts[id] = ''; inp.style.height = '';
  // show it straight away, then swap in the real one
  const tmp = { id: (chatMsgs.at(-1)?.id || 0) + 0.5, body, created_at: new Date().toISOString(), p: { username: acct.username }, pending: true };
  chatMsgs.push(tmp); drawChatMsgs();
  try {
    await chatCall('send_message', { c: id, body });
    chatMsgs = chatMsgs.filter(m => m !== tmp);
    const c = chatList.find(x => x.id === id);
    if (c) { c.last = { id: 0, body: body.slice(0, 120), at: new Date().toISOString(), u: acct.username }; chatList = [c, ...chatList.filter(x => x !== c)]; drawChatList(); }
    await pollChat();
  } catch (e) {
    chatMsgs = chatMsgs.filter(m => m !== tmp); drawChatMsgs();
    inp.value = body; chatDrafts[id] = body;
    toast("Couldn't send that", e.message, { cls: 'danger' });
  }
}

// pick friends for a new chat or to add to a group
function chatPicker(mode) {
  const c = chatList.find(x => x.id === chatOpen);
  const inChat = new Set(mode === 'add' ? (c?.members || []).map(m => m.u) : []);
  const names = friendNames().filter(n => !inChat.has(n) && !chatBlocks.includes(n));
  mform.innerHTML = `<h2>${mode === 'add' ? 'Add people' : 'New chat'}</h2>
    <p class="muted small-text">${mode === 'add' ? 'Pick friends to add to the group.' : 'Pick one friend for a DM, or a few for a group chat.'}</p>
    ${names.length ? `<ul class="chatpick">${names.map(n => { const f = friendRows.find(x => x.user === n); return `<li><label>${safeBadge(f?.av, 32)}<b>${esc(f?.name || n)}</b><span class="muted small-text">@${esc(n)}</span><span style="flex:1"></span><input type="checkbox" value="${esc(n)}" data-chatpick></label></li>`; }).join('')}</ul>` : `<p class="muted">${friendNames().length ? 'All your friends are already here.' : 'Add friends on the Friends page first, then come back to chat with them.'}</p>`}
    ${mode === 'add' ? '' : `<div class="field" id="chatGroupName" hidden><label>Group name</label><input id="chatTitle" maxlength="40" placeholder="e.g. Footy squad"></div>`}
    <div class="modal-actions"><button type="button" class="btn" data-mact="cancel">Cancel</button>${names.length ? `<button type="button" class="btn primary" data-chat="${mode === 'add' ? 'addGo' : 'create'}">${mode === 'add' ? 'Add' : 'Start chat'}</button>` : `<button type="button" class="btn primary" data-chat="toFriends">Find friends</button>`}</div>`;
  modal.showModal();
}
document.addEventListener('change', e => {
  if (!e.target.matches('[data-chatpick]')) return;
  const n = mform.querySelectorAll('[data-chatpick]:checked').length, g = document.getElementById('chatGroupName');
  if (g) g.hidden = n < 2;
  const go = mform.querySelector('[data-chat="create"]'); if (go) go.textContent = n > 1 ? 'Make group' : 'Start chat';
});

async function chatAction(el) {
  const a = el.dataset.chat, c = chatList.find(x => x.id === chatOpen);
  const run = async (fn, args, ok) => { try { const r = await chatCall(fn, args); if (ok) toast(ok, ''); return r ?? true; } catch (e) { toast('Hmm, that didn\'t work', e.message, { cls: 'danger' }); return null; } };
  if (a === 'open') return openChat(el.dataset.id);
  if (a === 'back') { chatOpen = null; render(); return; }
  if (a === 'mute') { const m = D.settings.chatMute = D.settings.chatMute || {}; if (m[chatOpen]) delete m[chatOpen]; else m[chatOpen] = true; save(); updateChatBadge(); render(); toast(m[chatOpen] ? '🔕 Muted' : '🔔 Unmuted', m[chatOpen] ? 'No pop-ups or badge for this chat. New messages still show in the list.' : ''); return; }
  if (a === 'new') return chatPicker('new');
  if (a === 'add') { el.closest('details')?.removeAttribute('open'); return chatPicker('add'); }
  if (a === 'toFriends') { modal.close(); view = 'friends'; render(); return; }
  if (a === 'send') return sendChat();
  if (a === 'create' || a === 'addGo') {
    const names = [...mform.querySelectorAll('[data-chatpick]:checked')].map(x => x.value);
    if (!names.length) return toast('Pick someone first', '');
    if (a === 'addGo') { if (await run('add_members', { c: chatOpen, names }, `➕ Added ${names.length}`)) { modal.close(); await refreshChats(true); render(); } return; }
    const title = names.length > 1 ? (document.getElementById('chatTitle')?.value.trim() || 'Group chat') : null;
    const id = await run('start_chat', title ? { names, title } : { names });
    if (id) { modal.close(); await refreshChats(true); openChat(id); }
    return;
  }
  if (a === 'rename') {
    const t = prompt('Group name', c?.name || ''); if (t == null) return;
    if (await run('rename_chat', { c: chatOpen, title: t })) { await refreshChats(true); render(); }
    return;
  }
  if (a === 'members') {
    el.closest('details')?.removeAttribute('open');
    mform.innerHTML = `<h2>${esc(chatTitle(c))}</h2><ul class="chatpick">${(c.members || []).map(m => `<li><label>${safeBadge(m.av, 32)}<b>${esc(m.d || m.u)}</b>${badgeTags(m.b, true)}<span class="muted small-text">@${esc(m.u)}${m.u === acct.username ? ' (you)' : ''}</span><span style="flex:1"></span>${m.u !== acct.username ? `<button type="button" class="btn small" data-chat="dm" data-u="${esc(m.u)}">Message</button><button type="button" class="btn small" data-chat="block" data-u="${esc(m.u)}">${chatBlocks.includes(m.u) ? 'Unblock' : 'Block'}</button>` : ''}</label></li>`).join('')}</ul>
      <div class="modal-actions"><button type="button" class="btn primary" data-mact="cancel">Close</button></div>`;
    modal.showModal(); return;
  }
  if (a === 'dm') { const id = await run('start_chat', { names: [el.dataset.u] }); if (id) { modal.close(); await refreshChats(true); openChat(id); } return; }
  if (a === 'block') {
    const u = el.dataset.u, blocked = chatBlocks.includes(u);
    if (!blocked && !confirm(`Block @${u}? They won't be able to DM you or add you to groups, and you won't see their messages.`)) return;
    if (await run(blocked ? 'unblock_user' : 'block_user', { name: u }, blocked ? `@${u} unblocked` : `🚫 @${u} blocked`)) {
      chatBlocks = blocked ? chatBlocks.filter(x => x !== u) : [...chatBlocks, u]; chatBlocks.loaded = true;
      if (modal.open) modal.close(); render();
    }
    return;
  }
  if (a === 'report') {
    el.closest('details')?.removeAttribute('open');
    const why = prompt(`Report @${el.dataset.u}${el.dataset.m ? ' for this message' : ''}? Say what happened (optional).`); if (why == null) return;
    const args = { name: el.dataset.u, why: why.slice(0, 500) }; if (el.dataset.m) args.msg = +el.dataset.m;
    if (await run('report_user', args, '🚩 Thanks, the report was sent') && !chatBlocks.includes(el.dataset.u) && confirm(`Block @${el.dataset.u} too?`)) {
      const b = document.createElement('i'); b.dataset.chat = 'block'; b.dataset.u = el.dataset.u; chatAction(b);
    }
    return;
  }
  if (a === 'leave') {
    if (!confirm(c?.is_group ? `Leave ${chatTitle(c)}?` : `Delete this chat? It disappears for you; ${chatTitle(c)} keeps their copy.`)) return;
    if (await run('leave_chat', { c: chatOpen })) { chatList = chatList.filter(x => x.id !== chatOpen); chatOpen = null; updateChatBadge(); render(); }
  }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-chat]'); if (!el) return;
  e.preventDefault(); chatAction(el);
});
document.addEventListener('submit', e => { if (e.target.id === 'chatSend') { e.preventDefault(); sendChat(); } });
document.addEventListener('keydown', e => {
  if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'chatInput') return;
  chatDrafts[chatOpen] = e.target.value;
  e.target.style.height = ''; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px';
});
// open chats straight away once you're logged in
setTimeout(async () => { if (ONLINE) return; await loadAccount(); if (acct.signedIn) { loadMyBadges().then(() => { if (view === 'friends' || view === 'settings') render(); }); refreshChats(true); } }, 1500);
