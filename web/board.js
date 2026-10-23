'use strict';
/* Leaderboards for studying, training and health. Each row is a player's
   weekly numbers plus their avatar. Your own row is worked out here; friends'
   rows come from friend codes: each planner turns its row into a short code,
   friends swap codes (text, Snap…) and paste them in. D.friends keeps the
   latest code from each friend. */

let boardFriends = [];
const BOARD_SORTS = {
  study: [['mins', 'Study this week', v => fmtMins(v) || '0m'], ['coins', 'Coins', v => `${v} ${COIN}`], ['streak', 'Study streak', v => `🔥 ${v}`], ['trees', 'Trees', v => `🌳 ${v}`]],
  health: [['sleep', 'Avg sleep', v => v ? fmtHm(v) : '–'], ['steps', 'Steps this week', v => (v || 0).toLocaleString()]],
  work: [['mins', 'Training this week', v => fmtMins(v) || '0m'], ['grit', 'Grit', v => `${v} ${GRIT}`], ['ovr', 'Rating', v => `⭐ ${v}`], ['wins', 'Battle wins', v => `⚔️ ${v}`], ['surv', 'Survival best', v => `🌊 ${v}`]],
};
function weekStats(from = mondayOf(today())) {
  const to = addDays(from, 6);
  const logs = D.focusLogs.filter(l => l.date >= from && l.date <= to), ws = D.workouts.filter(w => w.done && w.date >= from && w.date <= to);
  return { study: logs.reduce((a, l) => a + l.mins, 0), work: ws.reduce((a, w) => a + (+w.duration || 0), 0) };
}
function myBoardRow() {
  const w = weekStats(), a = athlete();
  return {
    id: 'me', name: D.settings.name || 'You', me: true, av: avatarSpec(),
    study: { mins: w.study, coins: coins(), streak: studyStreak(), trees: D.focusLogs.filter(l => !l.withered).length },
    work: { mins: w.work, grit: grit(), ovr: a.ovr, wins: (D.arena.battles || []).filter(b => b.win).length, surv: D.arena.survivalBest || 0 },
    health: healthWeek(),
    week: mondayOf(today()),
  };
}
function healthWeek(from = mondayOf(today())) {
  if (typeof healthCfg !== 'function') return {};
  const days = Array.from({ length: 7 }, (_, i) => hday(addDays(from, i)));
  const slept = days.filter(d => d.sleep);
  return { sleep: slept.length ? Math.round(slept.reduce((a, d) => a + d.sleep, 0) / slept.length) : 0, steps: days.reduce((a, d) => a + (d.steps || 0), 0) };
}
function allFriendRows() { return [...(D.friends || []).filter(f => !friendRows.some(r => r.name === f.name)), ...friendRows]; }
function viewBoard() {
  boardFriends = allFriendRows();
  publishMe(); refreshFriends();
  const kind = ui.boardKind || 'study', sorts = BOARD_SORTS[kind], key = ui.boardSort?.[kind] || sorts[0][0];
  const sortDef = sorts.find(s => s[0] === key) || sorts[0];
  const wk = mondayOf(today());
  // past weeks of your own as "ghost" rows until friends join
  const ghosts = boardFriends.length ? [] : [1, 2, 3].map(k => { const from = addDays(wk, -7 * k), s = weekStats(from); return { id: 'g' + k, ghost: true, name: k === 1 ? 'You, last week' : `You, ${k} weeks ago`, av: avatarSpec(), study: { mins: s.study }, work: { mins: s.work } }; });
  const rows = [myBoardRow(), ...boardFriends.filter(f => f.week === wk || key !== 'mins'), ...(key === 'mins' ? ghosts : [])]
    .map(r => ({ ...r, v: (r[kind] || {})[key] ?? 0 })).sort((a, b) => b.v - a.v);
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
  return `<div class="card board"><div class="card-head"><div class="seg">${[['study', '📚 Study'], ['work', '🏃 Training'], ['health', '🌙 Health']].map(([k, l]) => `<button class="${kind === k ? 'on' : ''}" data-act="boardKind" data-v="${k}">${l}</button>`).join('')}</div>
      <span style="flex:1"></span><div class="catchips">${sorts.map(([k, l]) => `<button class="cchip ${key === k ? 'on' : ''}" data-act="boardSort" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="podium">${rows.slice(0, 3).map((r, i) => `<div class="pod p${i + 1} ${r.me ? 'me' : ''} ${r.ghost ? 'ghost' : ''}"><div class="podav">${safeBadge(r.av, i === 0 ? 120 : 96)}</div><b>${esc(r.name)}</b><span>${sortDef[2](r.v)}</span><div class="podstep">${medal(i)}</div></div>`).join('')}</div>
    <ol class="boardlist">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''} ${r.ghost ? 'ghost' : ''}"><span class="brank">${medal(i)}</span>${safeBadge(r.av, 44)}<b>${esc(r.name)}</b><span style="flex:1"></span><span class="bval">${sortDef[2](r.v)}</span></li>`).join('')}</ol>
    </div>`;
}
// ---------- friend codes ----------
// LP1.<base64url of deflated JSON>: { v, id, n, w, s (study), k (training), h (health), av, t }
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
function playerId() { return D.settings.playerId = D.settings.playerId || uid() + uid(); }
async function myFriendCode() {
  const r = myBoardRow();
  const body = JSON.stringify({ v: 1, id: playerId(), n: r.name, w: r.week, s: r.study, k: r.work, h: r.health, av: r.av, t: Date.now() });
  return 'LP1.' + b64u(await pipeBytes(new TextEncoder().encode(body), new CompressionStream('deflate-raw')));
}
async function readFriendCode(code) {
  const m = /LP1\.([A-Za-z0-9_-]+)/.exec(String(code || '').replace(/\s+/g, ''));
  if (!m) throw new Error("That doesn't look like a friend code. It starts with LP1.");
  const j = JSON.parse(new TextDecoder().decode(await pipeBytes(unb64u(m[1]), new DecompressionStream('deflate-raw'))));
  if (j.v !== 1 || !j.id || typeof j.n !== 'string') throw new Error("That friend code didn't work.");
  const num = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => typeof v === 'number' && isFinite(v)));
  return { id: String(j.id).slice(0, 40), name: j.n.slice(0, 40) || 'Friend', week: /^\d{4}-\d{2}-\d{2}$/.test(j.w) ? j.w : '', study: num(j.s), work: num(j.k), health: num(j.h), av: j.av && typeof j.av === 'object' ? j.av : null, updated: +j.t || Date.now() };
}
let friendCode = '';
const safeBadge = (av, size) => { try { return av ? avatarBadge(av, size) : '👤'; } catch { return '👤'; } };
function boardSetupHtml() {
  if (ONLINE) return '';
  const friends = D.friends || [];
  myFriendCode().then(c => { friendCode = c; const el = document.getElementById('myFriendCode'); if (el) el.value = c; }).catch(() => { });
  return `<div class="friendbox"><h3>👥 Friends</h3>
    <p class="muted small-text">Send your code to friends who use Life Planner, and paste theirs below. Codes hold this week's numbers, so swap new ones each week to keep the board fresh. Nothing goes online.</p>
    <div class="row"><input id="myFriendCode" readonly value="${esc(friendCode)}" style="flex:1;min-width:200px;font-family:monospace;font-size:.8rem"><button class="btn primary" data-fact="copy">Copy my code</button></div>
    <div class="row" style="margin-top:8px"><input id="friendCodeIn" placeholder="Paste a friend's code (LP1.…)" style="flex:1;min-width:200px"><button class="btn" data-fact="add">Add friend</button></div>
    ${friends.length ? `<ul class="friendlist">${friends.map(f => `<li>${safeBadge(f.av, 28)}<b>${esc(f.name)}</b><span class="muted small-text">code from ${esc(ago(new Date(f.updated).toISOString()))}${f.week && f.week !== mondayOf(today()) ? ' · last week\'s numbers' : ''}</span><span style="flex:1"></span><button class="iconbtn" data-fact="remove" data-id="${esc(f.id)}" title="Remove">✕</button></li>`).join('')}</ul>` : ''}</div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-fact]'); if (!el) return;
  const act = el.dataset.fact;
  if (act === 'copy') {
    const code = friendCode || await myFriendCode();
    try { await navigator.clipboard.writeText(code); toast('📋 Friend code copied', 'Paste it into a message to your friends.'); }
    catch { const i = document.getElementById('myFriendCode'); i?.select(); toast('Select the code and copy it', ''); }
  } else if (act === 'add') {
    try {
      const f = await readFriendCode(document.getElementById('friendCodeIn')?.value);
      if (f.id === playerId()) throw new Error("That's your own code.");
      D.friends = (D.friends || []).filter(x => x.id !== f.id).concat(f);
      save(); render(); toast(`👥 ${f.name} is on your board`, 'Ask them for a new code each week.');
    } catch (err) { toast("Couldn't add that code", err.message, { cls: 'danger' }); }
  } else if (act === 'remove') {
    const f = (D.friends || []).find(x => x.id === el.dataset.id);
    if (f && confirm(`Take ${f.name} off your leaderboard?`)) { D.friends = D.friends.filter(x => x !== f); save(); render(); }
  }
});
