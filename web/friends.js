'use strict';
/* Friends & Leaderboard page: your weekly card, who's leading each category,
   the leaderboards, races against the people just ahead of you, and your
   friends (found by username, or added with friend codes). */

function friendsCount() { return allFriendRows().length; }

function myWeekCard() {
  const r = myBoardRow(), lv = levelInfo();
  const stat = (icon, v, label) => `<div class="fwstat"><span>${icon}</span><b>${v}</b><small>${label}</small></div>`;
  return `<div class="card fme"><div class="fme-top">${safeBadge(r.av, 96)}<div class="fme-name">
      <h2>${esc(D.settings.name || 'You')}${badgeTags(myBadges)}</h2>
      <div class="muted">${acct.signedIn ? `@${esc(acct.username)}` : acct.configured && !ONLINE ? '<a href="#" data-act="friendsLogin">Log in to race friends</a>' : 'Just you for now'} · Level ${lv.n} ${esc(lv.title)}</div></div></div>
    <div class="fwstats">${stat('📚', fmtMins(r.study.mins) || '0m', 'studied')}${stat('🏃', fmtMins(r.work.mins) || '0m', 'trained')}${stat('🔥', r.study.streak, 'day streak')}${stat('🌳', r.study.trees, 'trees')}${stat(GRIT, r.work.grit, 'Grit')}${stat('⭐', r.work.ovr, 'rating')}</div></div>`;
}

const FRIEND_CATS = [
  ['📚', 'Most study', r => r.study?.mins || 0, v => fmtMins(v) || '0m'],
  ['🏃', 'Most training', r => r.work?.mins || 0, v => fmtMins(v) || '0m'],
  ['🔥', 'Longest streak', r => r.study?.streak || 0, v => `${v} days`],
  ['🌙', 'Best sleep', r => r.health?.sleep || 0, v => v ? fmtHm(v) : '–'],
  ['👟', 'Most steps', r => r.health?.steps || 0, v => (v || 0).toLocaleString()],
  ['⚔️', 'Battle wins', r => r.work?.wins || 0, v => `${v}`],
];
function thisWeekRows() {
  const wk = mondayOf(today());
  return [myBoardRow(), ...allFriendRows().filter(f => f.week === wk)];
}
function highlightsCard() {
  const rows = thisWeekRows();
  const items = FRIEND_CATS.map(([icon, label, get, fmt]) => {
    const best = rows.slice().sort((a, b) => get(b) - get(a))[0], v = get(best);
    return `<li class="${best.me && v ? 'me' : ''}"><span class="hl-ic">${icon}</span><div class="main"><small>${label}</small><b>${v ? esc(best.me ? 'You' : best.name) : '–'}</b></div><span class="hl-v">${v ? fmt(v) : ''}</span></li>`;
  }).join('');
  return `<div class="card"><div class="card-head"><h2>🏅 This week's leaders</h2></div><ul class="hlist">${items}</ul>
    ${rows.length < 2 ? '<p class="muted small-text">Add friends to compete for these spots.</p>' : ''}</div>`;
}
function racesCard() {
  const rows = thisWeekRows();
  if (rows.length < 2) return '';
  const race = (icon, label, get, unit) => {
    const sorted = rows.slice().sort((a, b) => get(b) - get(a)), i = sorted.findIndex(r => r.me), me = sorted[i];
    if (i === 0) {
      const next = sorted[1], lead = get(me) - get(next);
      return `<li><span class="hl-ic">${icon}</span><div class="main"><b>You're 1st for ${label}</b><small>${lead ? `${unit(lead)} ahead of ${esc(next.name)}` : `Tied with ${esc(next.name)}`}</small></div><span class="tag green">#1</span></li>`;
    }
    const ahead = sorted[i - 1], gap = get(ahead) - get(me);
    return `<li><span class="hl-ic">${icon}</span><div class="main"><b>${unit(gap + (unit === fmtMins ? 1 : 1))} to pass ${esc(ahead.name)}</b><small>${label}: you're #${i + 1} of ${sorted.length}</small></div><div class="racebar"><i style="width:${Math.min(100, get(me) / Math.max(1, get(ahead)) * 100).toFixed(0)}%"></i></div></li>`;
  };
  return `<div class="card"><div class="card-head"><h2>🏁 Races</h2><span class="muted small-text">resets Monday</span></div><ul class="hlist">
    ${race('📚', 'study', r => r.study?.mins || 0, v => fmtMins(v) || '1m')}${race('🏃', 'training', r => r.work?.mins || 0, v => fmtMins(v) || '1m')}${race('🌳', 'trees', r => r.study?.trees || 0, v => `${v} tree${v === 1 ? '' : 's'}`)}</ul></div>`;
}
function friendCards() {
  const list = allFriendRows();
  if (!list.length) return '';
  const wk = mondayOf(today());
  return `<div class="fcards">${list.map(f => {
    const stale = f.week && f.week !== wk;
    return `<div class="fcard"><div class="fcard-av">${safeBadge(f.av, 64)}</div><div class="main"><b>${esc(f.name)}</b>${badgeTags(f.badges, true)}<div class="muted small-text">${f.user ? '@' + esc(f.user) : 'friend code'}${f.updated ? ' · ' + esc(ago(new Date(f.updated).toISOString())) : ''}</div>
      <div class="fcard-stats"><span>📚 ${fmtMins(stale ? 0 : f.study?.mins) || '0m'}</span><span>🏃 ${fmtMins(stale ? 0 : f.work?.mins) || '0m'}</span><span>🔥 ${f.study?.streak || 0}</span><span>⭐ ${f.work?.ovr || '–'}</span></div></div>
      <div class="fcard-btns"><button class="btn small primary" data-act="friendCompare" data-id="${esc(f.id)}">Compare</button>${f.user && acct.signedIn ? `<button class="btn small" data-chat="dm" data-u="${esc(f.user)}" title="Message">💬</button>` : ''}${f.user ? `<button class="iconbtn" data-acct="unfriend" data-u="${esc(f.user)}" title="Remove">✕</button>` : `<button class="iconbtn" data-fact="remove" data-id="${esc(f.id)}" title="Remove">✕</button>`}</div></div>`;
  }).join('')}</div>`;
}
function compareFriend(id) {
  const f = allFriendRows().find(x => x.id === id); if (!f) return;
  const me = myBoardRow(), stale = f.week && f.week !== mondayOf(today());
  const rows = [
    ['📚 Study this week', r => r.study?.mins || 0, v => fmtMins(v) || '0m', true],
    ['🏃 Training this week', r => r.work?.mins || 0, v => fmtMins(v) || '0m', true],
    ['🔥 Study streak', r => r.study?.streak || 0, v => `${v}`],
    ['🌳 Trees', r => r.study?.trees || 0, v => `${v}`],
    [`${GRIT} Grit`, r => r.work?.grit || 0, v => `${v}`],
    ['⭐ Rating', r => r.work?.ovr || 0, v => `${v}`],
    ['⚔️ Battle wins', r => r.work?.wins || 0, v => `${v}`],
    ['🌊 Survival best', r => r.work?.surv || 0, v => `${v}`],
    ['🌙 Avg sleep', r => r.health?.sleep || 0, v => v ? fmtHm(v) : '–'],
    ['👟 Steps this week', r => r.health?.steps || 0, v => (v || 0).toLocaleString(), true],
  ];
  let mine = 0, theirs = 0;
  const body = rows.map(([label, get, fmt, weekly]) => {
    const a = get(me), b = weekly && stale ? 0 : get(f), t = Math.max(1, a + b);
    if (a > b) mine++; else if (b > a) theirs++;
    return `<div class="cmp-row"><span class="cmp-v ${a > b ? 'win' : ''}">${fmt(a)}</span><div class="cmp-mid"><small>${label}</small><div class="cmp-bar"><i class="l" style="width:${(a / t * 100).toFixed(0)}%"></i><i class="r" style="width:${(b / t * 100).toFixed(0)}%"></i></div></div><span class="cmp-v r ${b > a ? 'win' : ''}">${fmt(b)}</span></div>`;
  }).join('');
  mform.innerHTML = `<h2>You vs ${esc(f.name)}</h2>
    <div class="cmp-head"><div>${safeBadge(me.av, 80)}<b>You</b><span class="cmp-score ${mine > theirs ? 'win' : ''}">${mine}</span></div><div class="cmp-vs">VS</div><div>${safeBadge(f.av, 80)}<b>${esc(f.name)}</b><span class="cmp-score ${theirs > mine ? 'win' : ''}">${theirs}</span></div></div>
    <div class="cmp">${body}</div>${friendBestsHtml(f)}
    <p class="muted small-text">${mine > theirs ? `You're winning ${mine} of ${rows.length} categories. Keep it up!` : mine < theirs ? `${esc(f.name)} leads ${theirs} categories. Time to catch up!` : 'Dead even. Next session decides it.'}${stale ? ' Their weekly numbers are from last week.' : ''}</p>
    <div class="modal-actions"><button type="button" class="btn primary" data-mact="cancel">Close</button></div>`;
  modal.showModal();
}

// Leaderboard tab: everything competitive with friends in one place
function viewLeaderboard() {
  if (ONLINE) return `${pageHead('🏆 Leaderboard', '')}<div class="card"><p>Leaderboards live in the PC app.</p></div>`;
  if (!acctLoaded) loadAccount().then(() => { if (view === 'board') render(); });
  const n = friendsCount();
  return `${pageHead('🏆 Leaderboard', n ? `You vs ${n} friend${n === 1 ? '' : 's'} · resets every Monday` : 'Add friends to race them', `<button class="btn small" data-act="goto" data-v="friends">👥 Friends &amp; chats</button>`)}
    <div class="friends-top">${myWeekCard()}${highlightsCard()}</div>
    ${acct.configured && !acct.signedIn ? accountCard() : ''}
    <div class="friends-main">
      <div class="stack">${viewBoard()}${athleticsBoardCard()}</div>
      <div class="stack">${racesCard()}${challengesFriendsCard()}${!n ? `<div class="card">${friendSuggestHtml(true) || '<p class="muted">Add friends on the Friends &amp; chats page to see them here.</p>'}</div>` : ''}</div>
    </div>`;
}
// fastest / strongest among your friends for one event
function athleticsBoardCard() {
  const rows = [{ me: true, name: 'You', av: avatarSpec(), b: myBests() }, ...allFriendRows().map(f => ({ name: f.name, av: f.av, b: f.raw?.fit?.b || {} }))];
  const evs = TESTS.filter(T => rows.some(r => r.b[T.id] != null));
  if (!evs.length) return `<div class="card"><div class="card-head"><h2>🏅 Athletics</h2></div><p class="muted small-text">Log results on Training, Athletics and they race your friends' here.</p></div>`;
  const T = evs.find(x => x.id === ui.lbEvent) || evs[0];
  const list = rows.filter(r => r.b[T.id] != null).sort((a, b) => T.lower ? a.b[T.id] - b.b[T.id] : b.b[T.id] - a.b[T.id]);
  return `<div class="card"><div class="card-head"><h2>🏅 Athletics</h2><select data-change="lbEvent">${evs.map(x => `<option value="${x.id}" ${x === T ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <ol class="lbath">${list.map((r, i) => { const rk = rankOf(testLevel(T, r.b[T.id]) ?? 0); return `<li class="${r.me ? 'me' : ''}"><span class="lbpos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${safeBadge(r.av, 32)}<b>${esc(r.name)}</b><span style="flex:1"></span>${rankTag(rk)}<b class="lbv">${fmtTest(T, r.b[T.id])}</b></li>`; }).join('')}</ol></div>`;
}
// a line on Today: where you stand against your friends this week
function todayRivals() {
  const quick = `<div class="todayquick"><button class="btn small ghost" data-act="editClasses" title="Change your classes, calendars and timetable">✏️ Classes &amp; calendars</button></div>`;
  if (ONLINE || !friendsCount()) return quick;
  const sc = overallScores(thisWeekRows()), i = sc.findIndex(r => r.me); if (i < 0) return '';
  const ahead = sc[i - 1];
  return `<a href="#" class="rivalbar" data-act="goto" data-v="board"><span class="rvpos">${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</span><span><b>You're ${i === 0 ? '1st' : `#${i + 1}`} of ${sc.length}</b> on this week's leaderboard${ahead ? ` · ${ahead.v - sc[i].v} pts behind ${esc(ahead.name)}` : sc[1] ? ` · ${sc[0].v - sc[1].v} pts clear of ${esc(sc[1].name)}` : ''}</span><span class="rvgo">Leaderboard →</span></a>${quick}`;
}

function viewFriends() {
  if (ONLINE) return `${pageHead('Friends & chats', '')}<div class="card"><p>Friends live in the PC app. Open Life Planner on your computer to see them.</p></div>`;
  if (!acctLoaded) loadAccount().then(() => { if (view === 'friends') render(); });
  const n = friendsCount();
  if (acct.configured && !acct.signedIn) return `${pageHead('👥 Friends & chats', 'Log in to add friends and message them')}${accountCard()}`;
  return `${pageHead('👥 Friends &amp; chats', n ? `${n} friend${n === 1 ? '' : 's'}` : 'Find your friends and message them', `${acct.signedIn ? `<span class="acct-chip">@${esc(acct.username)}</span>` : ''}<button class="btn small" data-act="goto" data-v="board">🏆 Leaderboard</button>`)}
    <div class="social-grid">
      <div class="social-chats">${typeof viewChats === 'function' ? viewChats(true) : ''}</div>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Friends</h2>${n ? `<span class="muted small-text">${n}</span>` : ''}</div>
          ${acct.signedIn ? friendSearchHtml().replace('<h3>👥 Friends', '<h3 hidden>').replace('class="friendbox"', 'class="friendbox flat"') : ''}
          ${friendSuggestHtml()}
          ${friendCards() || (friendNames().length ? '' : '<p class="muted small-text">No friends yet. Search for a username above, or swap friend codes below.</p>')}
          <details class="codes"><summary>${acct.signedIn ? 'Friends without an account? Swap friend codes' : 'Swap friend codes (no account needed)'}</summary>${boardSetupHtml().replace('<h3>👥 Friends</h3>', '')}</details>
        </div>
      </div>
    </div>`;
}
