// ---------- Ask Claude chat + the direct email check ----------
// The chat sees the page you're on (its title and text) and answers with your own
// Claude API key, which stays in the data folder (Settings, App). The same key lets
// the planner sort your Gmail and school mail itself (mailcheck.go), so Missed info
// keeps filling even when the hourly Claude task can't reach this PC.
const AI = { st: null, mail: null, msgs: [], busy: false, open: false, ctrl: null };
const AI_MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (best)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (cheaper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)']];
async function aiLoad() {
  if (ONLINE) return;
  try { AI.st = await (await fetch('/api/ai', { cache: 'no-store' })).json(); } catch { }
  try { AI.mail = await (await fetch('/api/mail', { cache: 'no-store' })).json(); } catch { }
}
async function aiPut(url, body) {
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save");
  return j;
}

// Settings, App: the API key, the model, and the Gmail app password.
function aiSettingsCard() {
  if (ONLINE) return '';
  const st = AI.st || {}, m = AI.mail || {};
  return `<div class="card" data-sec="app" style="grid-column:1/-1"><h2>✦ Claude in the planner</h2>
    <p class="small-text" style="margin-top:0">Your own Claude API key powers <b>Ask Claude</b> (the ✦ button, bottom right) and the <b>direct email check</b>. Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>. It's saved only on this PC, and usage is billed to your API account.</p>
    <div class="row" style="margin-bottom:10px"><input type="password" id="aiKey" placeholder="${st.configured ? 'Key saved (paste a new one to replace it)' : 'Paste your API key (starts with sk-ant-)'}" autocomplete="off" style="flex:1;min-width:220px">
      <select id="aiModel" title="Which Claude answers">${AI_MODELS.map(([v, l]) => `<option value="${v}" ${(st.model || AI_MODELS[0][0]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn small primary" data-ai="saveKey">Save</button>${st.configured ? '<button class="btn small" data-ai="clearKey">Remove</button>' : ''}</div>
    <p class="small-text"><b>Direct email check:</b> ${m.configured ? `on for ${esc(m.user)}.` : 'off.'} ${m.checked ? `Last checked ${esc(ago(m.checked))}.` : ''} ${m.error ? `<span class="tag red">${esc(m.error)}</span>` : ''}</p>
    <p class="muted small-text" style="margin-top:0">While the planner is open it reads your Gmail every 30 minutes (7am to 10pm), plus the school Outlook export, and Claude sorts what matters into Missed info. It only reads mail. Gmail needs an <b>app password</b>: turn on 2-Step Verification, then make one at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a> and paste the 16 letters here.</p>
    <div class="row"><input type="email" id="mailUser" placeholder="you@gmail.com" value="${esc(m.user || '')}" style="flex:1;min-width:180px"><input type="password" id="mailPass" placeholder="${m.configured ? 'App password saved' : 'App password'}" autocomplete="off" style="flex:1;min-width:160px">
      <button class="btn small primary" data-ai="saveMail">Save &amp; test</button>${m.configured ? '<button class="btn small" data-ai="clearMail">Turn off</button>' : ''}</div></div>`;
}

// Missed info: when the last check ran, and a nudge when nothing is set up.
function mailStatusLine() {
  if (ONLINE) return '';
  const m = AI.mail || {}, ib = D.inbox;
  const stale = !ib?.updated || Date.now() - new Date(ib.updated) > 6 * 3600e3;
  if (m.configured || m.checked) return `<p class="small-text muted">Checked here ${m.checked ? esc(ago(m.checked)) : 'not yet'}${m.error ? ` · <span class="tag red">${esc(m.error)}</span>` : ''}</p>`;
  return stale ? `<div class="card hintcard"><b>Emails not coming in?</b> The hourly Claude check can only save here while the Claude app is open and online on this PC. Turn on the <b>direct email check</b> in <a href="#" data-ai="goSettings">Settings, App</a> and the planner checks Gmail itself while it's open.</div>` : '';
}
async function mailCheckDirect(quiet) {
  if (ONLINE || !(AI.mail?.configured || AI.mail?.checked) || !AI.st?.configured) return false;
  if (!quiet) toast('📬 Checking your email…', 'Claude is sorting your new mail. This takes up to a minute.', { timeout: 6000 });
  try {
    const r = await fetch('/api/mail', { method: 'POST' }), j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "The check didn't finish.");
    AI.mail = j; await loadInbox();
    if (!quiet) toast(j.added ? `📬 ${j.added} new in Missed info` : '📬 Nothing new', '', { timeout: 5000 });
  } catch (e) { if (!quiet) toast("Couldn't check your email", e.message, { cls: 'danger', timeout: 10000 }); await aiLoad(); }
  if (!modal.open) render();
  return true;
}

// ---------- the chat panel ----------
function aiPageText() {
  const main = document.getElementById('view');
  const title = document.querySelector('#tabs button.active span')?.textContent || view;
  let text = (main?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  const modalText = modal.open ? (document.getElementById('modalForm')?.innerText || '').trim() : '';
  if (modalText) text = `Open dialog:\n${modalText}\n\nPage behind it:\n${text}`;
  return `Page: ${title}\n\n${text.slice(0, 50000)}`;
}
function aiMd(s) {
  // a tiny, safe Markdown: escape first, then bold, code, bullets and paragraphs
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .split(/\n{2,}/).map(p => /^\s*([-*•]|\d+\.)\s/.test(p) ? `<ul>${p.split('\n').map(l => `<li>${l.replace(/^\s*([-*•]|\d+\.)\s+/, '')}</li>`).join('')}</ul>` : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}
function aiPanel() {
  let el = document.getElementById('aichat');
  if (!el) {
    el = document.createElement('div'); el.id = 'aichat'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Ask Claude');
    el.innerHTML = `<div class="aihead"><b>✦ Ask Claude</b><span class="muted small-text" id="aiWhere"></span><span class="spacer"></span><button class="iconbtn" data-ai="new" title="New chat">↺</button><button class="iconbtn" data-ai="close" title="Close">✕</button></div>
      <div class="ailog" id="aiLog"></div>
      <form class="aiform" id="aiForm"><textarea id="aiIn" rows="2" placeholder="Ask about this page, or anything…"></textarea><button class="btn primary" id="aiSend">Send</button></form>`;
    document.body.appendChild(el);
    el.querySelector('#aiForm').onsubmit = e => { e.preventDefault(); aiSend(); };
    el.querySelector('#aiIn').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); } if (e.key === 'Escape') aiToggle(false); };
  }
  return el;
}
function aiDraw() {
  const log = document.getElementById('aiLog'); if (!log) return;
  const where = document.querySelector('#tabs button.active span')?.textContent || '';
  document.getElementById('aiWhere').textContent = where ? `· sees ${where}` : '';
  if (!AI.st?.configured) {
    log.innerHTML = `<div class="aiempty"><p><b>Add your Claude API key</b> to start chatting.</p><p class="muted small-text">It's in Settings, App, under ✦ Claude in the planner.</p><button class="btn primary small" data-ai="goSettings">Open Settings</button></div>`;
    return;
  }
  log.innerHTML = AI.msgs.length ? AI.msgs.map(m => `<div class="aimsg ${m.role}${m.err ? ' err' : ''}">${m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : aiMd(m.content) || '<span class="aidots"><i></i><i></i><i></i></span>'}</div>`).join('')
    : `<div class="aiempty"><p>I can see the <b>${esc(where || 'page')}</b> page you're on.</p><div class="aisugs">${['Summarise this page', 'What should I do next?', 'Quiz me on something I’m studying'].map(s => `<button class="btn small" data-ai="sug">${esc(s)}</button>`).join('')}</div></div>`;
  log.scrollTop = log.scrollHeight;
}
function aiToggle(on) {
  AI.open = on ?? !AI.open;
  const el = aiPanel(); el.classList.toggle('on', AI.open);
  document.getElementById('aiFab')?.classList.toggle('on', AI.open);
  if (AI.open) { aiDraw(); setTimeout(() => document.getElementById('aiIn')?.focus(), 50); }
}
async function aiSend(text) {
  const box = document.getElementById('aiIn');
  text = (text ?? box.value).trim(); if (!text || AI.busy) return;
  box.value = ''; AI.busy = true;
  AI.msgs.push({ role: 'user', content: text });
  const reply = { role: 'assistant', content: '' }; AI.msgs.push(reply); aiDraw();
  const send = document.getElementById('aiSend'); send.disabled = true;
  const history = AI.msgs.filter(m => m !== reply && !m.err).slice(-20).map(({ role, content }) => ({ role, content }));
  AI.ctrl = new AbortController();
  try {
    const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AI.ctrl.signal,
      body: JSON.stringify({ messages: history, page: aiPageText(), today: new Date().toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Claude couldn't answer.");
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (!line.startsWith('data: ')) continue;
        const ev = JSON.parse(line.slice(6));
        if (ev.t) { reply.content += ev.t; aiDraw(); }
        if (ev.error) throw new Error(ev.error);
        if (ev.cut) reply.content += '\n\n…(cut short)';
      }
    }
    if (!reply.content) throw new Error('Claude sent back an empty answer.');
  } catch (e) {
    if (e.name !== 'AbortError') { reply.content = e.message || "Claude couldn't answer."; reply.err = true; }
    else if (!reply.content) AI.msgs.splice(AI.msgs.indexOf(reply), 1);
  }
  AI.busy = false; AI.ctrl = null; send.disabled = false; aiDraw();
}
function aiFab() {
  if (ONLINE || document.getElementById('aiFab')) return;
  const b = document.createElement('button'); b.id = 'aiFab'; b.title = 'Ask Claude about this page (Ctrl+J)'; b.innerHTML = '✦<span>Ask Claude</span>';
  b.onclick = () => aiToggle(); document.body.appendChild(b);
}
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j' && !ONLINE) { e.preventDefault(); aiToggle(); } });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-ai]'); if (!el) return;
  const a = el.dataset.ai;
  if (el.tagName === 'A') e.preventDefault();
  switch (a) {
    case 'close': aiToggle(false); break;
    case 'new': AI.ctrl?.abort(); AI.msgs = []; aiDraw(); break;
    case 'sug': aiSend(el.textContent); break;
    case 'goSettings': aiToggle(false); view = 'settings'; ui.setTab = 'app'; render(); break;
    case 'saveKey': case 'clearKey': {
      const body = a === 'clearKey' ? { key: '' } : { model: $('#aiModel').value, ...($('#aiKey').value.trim() ? { key: $('#aiKey').value.trim() } : {}) };
      aiPut('/api/ai', body).then(j => { AI.st = j; render(); toast(j.configured ? '✓ Claude is ready' : 'API key removed', j.configured ? 'Try the ✦ button, bottom right.' : ''); })
        .catch(err => toast("Couldn't save the key", err.message, { cls: 'danger' }));
      break;
    }
    case 'saveMail': case 'clearMail': {
      const body = a === 'clearMail' ? { user: '', pass: '' } : { user: $('#mailUser').value.trim(), pass: $('#mailPass').value };
      if (a === 'saveMail') toast('Testing Gmail…', '', { timeout: 3000 });
      aiPut('/api/mail', body).then(j => { AI.mail = j; render(); if (j.configured) { toast('✓ Gmail connected', j.ai ? 'Running the first check now.' : 'Add your Claude API key too, so Claude can sort your mail.'); if (j.ai) mailCheckDirect(true); } else toast('Direct email check is off', ''); })
        .catch(err => toast("Couldn't connect Gmail", err.message, { cls: 'danger', timeout: 10000 }));
      break;
    }
  }
});
