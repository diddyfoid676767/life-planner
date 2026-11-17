'use strict';
/* Leaderboards for studying, training and health. Each row is a player's
   weekly numbers plus their avatar. Your own row is worked out here; friends'
   rows come from friend codes: each planner turns its row into a short code,
   friends swap codes (text, Snap…) and paste them in. D.friends keeps the
   latest code from each friend. */

let boardFriends = [];
// the overall board: each category scores up to its max points for whoever leads it (study counts double)
const OVERALL_CATS = [['📚', 'Study', r => r.study?.mins || 0, 200], ['🏃', 'Training', r => r.work?.mins || 0, 100], ['🔥', 'Streak', r => r.study?.streak || 0, 100]];
function overallScores(rows) {
  const max = OVERALL_CATS.map(([, , f]) => Math.max(0, ...rows.map(f)));
  return rows.map(r => {
    const parts = OVERALL_CATS.map(([icon, name, f, w], i) => ({ icon, name, pts: max[i] ? Math.round(f(r) / max[i] * w) : 0 }));
    return { ...r, v: parts.reduce((a, p) => a + p.pts, 0), parts };
  }).sort((a, b) => b.v - a.v);
}
// 2.55: one board, picked from a dropdown
const BOARD_CATS = [
  ['overall', '🏆 Overall', null, v => `${v} pts`],
  ['study', '📚 Study this week', r => r.study?.mins || 0, v => fmtMins(v) || '0m'],
  ['work', '🏃 Training this week', r => r.work?.mins || 0, v => fmtMins(v) || '0m'],
  ['streak', '🔥 Study streak', r => r.study?.streak || 0, v => `${v} day${v === 1 ? '' : 's'}`],
  ['sessions', '✦ Focus sessions (all time)', r => r.study?.trees || 0, v => `${v}`],
];
function weekStats(from = mondayOf(today())) {
  const to = addDays(from, 6);
  const logs = D.focusLogs.filter(l => l.date >= from && l.date <= to), ws = D.workouts.filter(w => w.done && w.date >= from && w.date <= to);
  return { study: logs.reduce((a, l) => a + l.mins, 0), work: ws.reduce((a, w) => a + (+w.duration || 0), 0) };
}
function myBoardRow() {
  const w = weekStats();
  return {
    id: 'me', name: D.settings.name || 'You', me: true, av: avatarSpec(),
    // "trees" stays as the field name so older friends' apps still read it: it is your count of 10+ minute focus sessions
    study: { mins: w.study, streak: studyStreak(), trees: D.focusLogs.filter(l => l.mins >= 10).length },
    work: { mins: w.work },
    health: {},
    week: mondayOf(today()),
  };
}
function allFriendRows() { return [...(D.friends || []).filter(f => !friendRows.some(r => r.name === f.name)), ...friendRows]; }
function viewBoard() {
  boardFriends = allFriendRows();
  publishMe(); refreshFriends();
  const cat = BOARD_CATS.find(c => c[0] === ui.lbCat) || BOARD_CATS[0], [kind, , val, fmt] = cat;
  const wk = mondayOf(today()), weekly = kind === 'overall' || kind === 'study' || kind === 'work';
  // past weeks of your own as "ghost" rows until friends join
  const ghosts = boardFriends.length || !weekly || kind === 'overall' ? [] : [1, 2, 3].map(k => { const from = addDays(wk, -7 * k), s = weekStats(from); return { id: 'g' + k, ghost: true, name: k === 1 ? 'You, last week' : `You, ${k} weeks ago`, av: avatarSpec(), study: { mins: s.study }, work: { mins: s.work } }; });
  const rows = kind === 'overall' ? overallScores([myBoardRow(), ...boardFriends.filter(f => f.week === wk)])
    : [myBoardRow(), ...boardFriends.filter(f => !weekly || f.week === wk), ...ghosts].map(r => ({ ...r, v: val(r) })).sort((a, b) => b.v - a.v);
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
  return `<div class="card board"><div class="card-head"><h2>Leaderboard</h2><span style="flex:1"></span>
      <select data-change="lbCat" aria-label="Category">${BOARD_CATS.map(c => `<option value="${c[0]}" ${c === cat ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
    <div class="podium">${rows.slice(0, 3).map((r, i) => `<div class="pod p${i + 1} ${r.me ? 'me' : ''} ${r.ghost ? 'ghost' : ''}"><div class="podav">${safeBadge(r.av, i === 0 ? 120 : 96)}</div><b>${esc(r.name)}${badgeTags(r.me ? myBadges : r.badges, true)}</b><span>${fmt(r.v)}</span><div class="podstep">${medal(i)}</div></div>`).join('')}</div>
    <ol class="boardlist">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''} ${r.ghost ? 'ghost' : ''}"><span class="brank">${medal(i)}</span>${safeBadge(r.av, 44)}<b>${esc(r.name)}</b>${badgeTags(r.me ? myBadges : r.badges, true)}<span style="flex:1"></span>${r.parts ? `<span class="bparts">${r.parts.filter(x => x.pts).sort((a, b) => b.pts - a.pts).map(x => `<span title="${x.name}: ${x.pts} pts">${x.icon}${x.pts}</span>`).join('')}</span>` : ''}<span class="bval">${fmt(r.v)}</span></li>`).join('')}</ol>
    <p class="muted small-text" style="margin:8px 0 0">${kind === 'overall' ? `Points this week, with the leader in each getting the most and the rest in proportion: ${OVERALL_CATS.map(c => c[0] + ' ' + c[1].toLowerCase() + ' ' + c[3]).join(', ')}.` : weekly ? 'Resets every Monday.' : ''}</p>
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
    <p class="muted small-text">Send your code to friends who use Solis, and paste theirs below. Codes hold this week's numbers, so swap new ones each week to keep the board fresh. Nothing goes online.</p>
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
