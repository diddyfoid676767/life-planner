'use strict';
/* 2.78 simple building windows (feedback rework F2). Clicking a building (or Menu, or keys 1 to 6)
   opens a small window that slides in from the right while the island stays in view. Each window
   has one big card with one button, a short list (3 to 5 rows), at most 3 tabs, and More for
   everything else. More opens the full pages (the old Notice Board, Library, Fitness, Friends,
   You and Settings pages) in a wider window. The Market keeps its own panel on the island.
   The Hall now holds what the Steward's lodge did (settings) and the Training hall holds the
   Practice yard (spars). */

const BW_ICON = { notice: '📜', library: '📚', training: '💪', tavern: '🍺', hall: '🏰' };
const BW_NAME = { notice: 'Notice Board', library: 'Library', training: 'Training hall', tavern: 'Tavern', hall: 'Hall' };
// old building ids still land somewhere sensible
const BW_ALIAS = { lodge: 'hall', steward: 'hall', yard: 'training', today: 'notice', calendar: 'notice', study: 'library', friends: 'tavern', profile: 'hall', settings: 'hall' };

function bwOpen(id, tab) {
  id = BW_ALIAS[id] || id;
  if (id === 'market') { if (typeof hxOpen === 'function') hxOpen('shop'); return; }
  if (!BW_NAME[id]) return;
  if ((ui.isTab || 'personal') !== 'personal' && view === 'islands') ui.isTab = 'personal';
  const same = view === 'bw' && ui.bw?.id === id;
  ui.bw = { id, tab: tab || (same ? ui.bw.tab : null), more: false };
  ui.hxSel = null; view = 'bw'; window.scrollTo(0, 0); render();
  if (!same && typeof sfx === 'function') try { sfx('open'); } catch (e) { }
}

// ---------- small helpers ----------
const bwTry = (f, d) => { try { return f(); } catch (e) { return d; } };
const bwRow = (l, r = '', cls = '', at = '') => ({ l, r, cls, at });
const bwGo = (label, at) => ({ label, at });
const bwPage = (v, set) => `data-bw="page" data-v="${v}"${set ? ` data-set='${esc(JSON.stringify(set))}'` : ''}`;
function bwWhen(d) { const n = diffDays(today(), d); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 7 ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }) : fmtDate(d); }

// ---------- what each building holds ----------
const BW_DEF = {
  notice: () => ({
    tabs: [
      ['today', 'Today', () => {
        const t = today(), nowT = new Date().toTimeString().slice(0, 5), items = agenda(t, t).filter(e => e.kind !== 'todo');
        const next = items.filter(e => !e.done && (!e.time || e.time >= nowT)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))[0];
        const mins = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0), goal = +D.settings.dailyGoal || 60;
        const due = D.todos.filter(x => !x.done && x.due && x.due <= t);
        return {
          k: next ? (next.time ? 'Next up · ' + fmtTime(next.time) : 'Next up') : 'Today', v: next ? next.title : 'Nothing else booked today',
          go: D.focus ? bwGo('■ Stop and log', 'data-act="focusStop"') : bwGo('▶ Start studying', 'data-act="focusNew"'), hint: `${fmtMins(mins) || '0m'} of ${fmtMins(goal)} studied today`,
          list: [...due.slice(0, 4).map(x => bwRow(`<input type="checkbox" data-toggle="todo" data-id="${x.id}"> ${esc(x.text)}`, x.due < t ? 'overdue' : '', x.due < t ? 'warn' : '')),
            ...items.filter(e => e !== next).slice(0, Math.max(1, 5 - Math.min(4, due.length))).map(e => bwRow(esc(e.title), e.time ? fmtTime(e.time) : e.tag || '', e.done ? 'done' : ''))].slice(0, 5),
          empty: 'A clear day. Add a task with Q.',
        };
      }],
      ['cal', 'Calendar', () => {
        const t = today(), wk = agenda(t, addDays(t, 6)).filter(e => !e.done && e.kind !== 'todo'), sacs = wk.filter(e => e.kind === 'assessment').length;
        return { k: 'This week', v: `${wk.length} event${wk.length === 1 ? '' : 's'}${sacs ? ` · ${sacs} SAC${sacs === 1 ? '' : 's'}` : ''}`, go: bwGo('＋ Add event', 'data-act="new" data-kind="event"'), hint: 'Lessons, SACs, training and your own events',
          list: wk.slice(0, 5).map(e => bwRow(esc(e.title), `${bwWhen(e.date)}${e.time ? ' · ' + fmtTime(e.time) : ''}`)), empty: 'Nothing booked in the next 7 days.' };
      }],
      ['todo', 'To-dos', () => {
        const t = today(), open = D.todos.filter(x => !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (+b.pri || 0) - (+a.pri || 0)), left = open.filter(x => x.due && x.due <= t).length;
        return { k: 'To-dos', v: left ? `${left} left today` : open.length ? `${open.length} open` : 'All done 🎉', go: bwGo('＋ Add to-do', 'data-act="new" data-kind="todo"'), hint: 'Q adds one from anywhere',
          list: open.slice(0, 5).map(x => bwRow(`<input type="checkbox" data-toggle="todo" data-id="${x.id}"> ${esc(x.text)}`, x.due ? bwWhen(x.due) : '', x.due && x.due < t ? 'warn' : '')), empty: 'No to-dos. Nice.' };
      }],
    ],
    more: [['The full Notice Board', bwPage('today')], ['Calendar', bwPage('calendar')], ['All to-dos', bwPage('today', { todoOpen: true })], ['Timetable and class mode', bwPage('today', { clsAll: true })]],
  }),
  library: () => ({
    tabs: [
      ['study', 'Study', () => {
        const t = today(), wk = mondayOf(t), f = D.focus, by = {};
        for (const l of D.focusLogs) if (l.date >= wk) by[l.subjectId] = (by[l.subjectId] || 0) + l.mins;
        const mins = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0), goal = +D.settings.dailyGoal || 60, s = studyStreak();
        const list = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, m]) => bwRow(`<i class="bwdot" style="--c:${subj(id).color}"></i>${esc(subj(id).name)}`, fmtMins(m)));
        if (f) { const m = focusElapsed(f); return { k: 'Studying ' + subj(f.subjectId).name, v: focusClock(f, m), go: bwGo('■ Stop and log', 'data-act="focusStop"'), hint: f.pausedAt ? 'Paused' : `Earning Lumen · ${s}-day streak`, list, empty: '', live: 1 }; }
        return { k: 'Today', v: `${fmtMins(mins) || '0m'} of ${fmtMins(goal)}`, go: bwGo('▶ Start studying', 'data-act="focusNew"'), hint: s ? `⚡ ${s}-day streak · keep it going` : 'Study today to start a streak', list, empty: 'Nothing studied this week yet.', lt: 'This week' };
      }],
      ['sacs', 'SACs & exams', () => {
        const t = today(), up = D.assessments.filter(a => !a.done && a.date >= t).sort((a, b) => a.date.localeCompare(b.date)), n = up[0];
        return { k: n ? 'Next ' + (n.type || 'SAC') : 'SACs and exams', v: n ? `${subj(n.subjectId).name} ${relDays(diffDays(t, n.date)).toLowerCase()}` : 'None coming up', go: bwGo('＋ Add a SAC or exam', 'data-act="new" data-kind="assessment"'), hint: n ? esc(n.title) : 'Add them to see countdowns',
          list: up.slice(0, 5).map(a => bwRow(`<i class="bwdot" style="--c:${subj(a.subjectId).color}"></i>${esc(subj(a.subjectId).name)}: ${esc(a.title)}`, bwWhen(a.date))), empty: '' };
      }],
    ],
    more: [['The full study page', bwPage('study')], ['Exam mode', 'data-s2="examStart"', 'Full screen, and leaving ends the timer'], ['Records and SAC results', bwPage('profile', { youTab: 'rec' })]],
  }),
  training: () => ({
    tabs: [
      ['work', 'Workouts', () => {
        const t = today(), wk = mondayOf(t), ws = D.workouts.filter(w => w.date <= t).sort((a, b) => b.date.localeCompare(a.date)), tw = ws.filter(w => w.date >= wk);
        return { k: 'This week', v: `${tw.length} workout${tw.length === 1 ? '' : 's'} · ${fmtMins(tw.reduce((a, w) => a + (+w.duration || 0), 0)) || '0m'}`, go: bwGo('＋ Log a workout', 'data-fit="logMenu"'), hint: 'Training earns Ember',
          list: ws.slice(0, 5).map(w => bwRow(esc(w.title || w.sport || 'Workout'), `${bwWhen(w.date)}${w.duration ? ' · ' + fmtMins(+w.duration) : w.distance ? ' · ' + w.distance + ' km' : ''}`)), lt: 'Recent', empty: 'No workouts yet.' };
      }],
      ['ev', 'Events', () => {
        const t = today(), up = D.trainingEvents.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), n = up[0];
        return { k: n ? 'Next event' : 'Events', v: n ? `${n.name} ${relDays(diffDays(t, n.date)).toLowerCase()}` : 'Nothing booked', go: bwGo('＋ Add event', 'data-act="new" data-kind="tevent"'), hint: 'Races, games and comps',
          list: up.slice(0, 5).map(e => bwRow(esc(e.name), bwWhen(e.date))), empty: '' };
      }],
      ['spar', 'Practice yard', () => ({ k: 'Practice yard', v: 'Spar a champion', go: bwGo('⚔ Spar now', 'data-bw="spar"'), hint: 'Practise against a champion boss. Spars happen on the boss island', list: [], empty: '' })],
    ],
    more: [['The full fitness page', bwPage('training', { bodyPage: 'train' })], ['Records and progress', bwPage('training', { bodyPage: 'progress' })], ['Body card', bwPage('training', { bodyPage: 'body' })]],
  }),
  tavern: () => ({
    tabs: [
      ['house', 'House', () => {
        const h = bwTry(() => hsState(), {}), wk = mondayOf(today()), b = bwTry(() => hsBoss(wk), null), rest = bwTry(() => bossWeek() === 'rest', false);
        if (typeof plannerOnly === 'function' && plannerOnly()) return { k: 'House', v: 'Houses are for Westbourne students', go: bwGo('👥 Friends and chats', bwPage('friends')), hint: '', list: [], empty: '' };
        if (!h.id) return { k: 'Your house', v: 'Not in a house yet', go: bwGo('🏰 Find a house', 'data-shell="travel" data-v="house"'), hint: 'Houses share an island and fight a boss each week', list: [], empty: '' };
        return { k: rest ? 'Rest week' : 'This week\'s boss', v: rest ? 'No boss this week' : b ? `${b.e} ${b.n}` : 'The Warband', go: rest ? bwGo('🏰 House island', 'data-shell="travel" data-v="house"') : bwGo('⚔ Fight it', 'data-shell="travel" data-v="boss"'), hint: 'Every hit goes on the house\'s weekly bar',
          list: [bwRow('🏰 House island', '', '', 'data-shell="travel" data-v="house"'), bwRow('🏆 Leaderboards', '', '', bwPage('board'))], empty: '' };
      }],
      ['friends', 'Friends', () => {
        const rows = bwTry(() => allFriendRows().filter(f => f.user), []), st = rows.map(f => [f, bwTry(() => friendStatus(f), { on: false, txt: '' })]).sort((a, b) => b[1].on - a[1].on), on = st.filter(x => x[1].on).length;
        return { k: 'Online now', v: rows.length ? `${on} friend${on === 1 ? '' : 's'}` : 'No friends yet', go: bwGo('👥 Find friends', bwPage('friends')), hint: rows.length ? `${rows.length} friend${rows.length === 1 ? '' : 's'}` : 'Search by name or school email',
          list: st.slice(0, 5).map(([f, s]) => bwRow(`<i class="bwon ${s.on ? 'on' : ''}"></i>${esc(f.name || f.user)}`, esc(s.txt || ''))), empty: '' };
      }],
      ['chats', 'Chats', () => {
        const cs = bwTry(() => shownChats(), bwTry(() => chatList, [])) || [], un = cs.reduce((s, c) => s + (+c.unread || 0), 0);
        return { k: 'Messages', v: un ? `${un} unread` : 'All caught up', go: bwGo('💬 Open chats', bwPage('friends')), hint: '',
          list: cs.slice(0, 5).map(c => bwRow(esc(bwTry(() => chatTitle(c), c.name || 'Chat')), c.unread ? `${c.unread} new` : esc((c.last?.body || '').slice(0, 26)), c.unread ? 'gold' : '', bwPage('friends'))), empty: 'No chats yet.' };
      }],
    ],
    more: [['Friends and chats', bwPage('friends')], ['Leaderboards', bwPage('board')], ['Invite friends', bwPage('friends')]],
  }),
  hall: () => ({
    tabs: [
      ['me', 'Character', () => {
        const L = solisLevel(), c = bwTry(() => cdClassInfo(), null), w = cdWallet();
        return { k: `Level ${L.n}${c ? ' ' + c.n : ''}`, v: L.max ? 'Top level' : `${L.into.toLocaleString()} / ${L.need.toLocaleString()} XP`, go: bwGo('✎ Customise', bwPage('profile', { youTab: 'me', youLook: true })), hint: c ? c.title : 'Pick a class at level 8',
          list: [bwRow('✦ Lumen', w.lumen.toLocaleString(), 'gold'), bwRow('🔥 Ember', w.ember.toLocaleString(), 'gold'), bwRow('⚡ Study streak', studyStreak() + ' days')], empty: '' };
      }],
      ['gear', 'Gear', () => {
        const st = ftState(), wr = st.wear || {}, eq = FT_GEAR_SLOTS.map(([k, n, e]) => [n, e, st.gear.find(g => g.id === wr[k])]), n = eq.filter(x => x[2]).length;
        return { k: 'Equipped', v: `${n} of ${FT_GEAR_SLOTS.length} slots`, go: bwGo('⚔ Change gear', bwPage('profile', { youTab: 'me', youLook: false })), hint: 'Gear drops from boss fights',
          list: eq.slice(0, 5).map(([sn, e, g]) => bwRow(`${g ? g.e : e} ${sn}`, g ? esc(g.n) : 'empty', g ? '' : 'done')), empty: '' };
      }],
      ['set', 'Settings', () => {
        const perm = 'Notification' in window ? Notification.permission : 'unsupported', signed = bwTry(() => acct.signedIn, false);
        const look = { story: 'Storybook', med: 'Parchment', plain: 'Plain' }[typeof medSkin === 'function' ? medSkin() : 'story'];
        return { k: 'Look and sound', v: `${look} · ${typeof skinNight === 'function' && skinNight() ? 'lantern now' : 'bright now'}`, go: bwGo('⚙ All settings', bwPage('settings', { setTab: 'look' })), hint: 'Bright by day, lantern at night',
          list: [bwRow('👤 Account', signed ? 'Signed in' : 'Not signed in', '', bwPage('settings', { setTab: 'you' })), bwRow('🔔 Notifications', perm === 'granted' ? 'On' : 'Off', '', bwPage('settings', { setTab: 'cal' })), bwRow('🎨 Graphics', D.settings.lowQuality ? 'Low' : 'High', '', bwPage('settings', { setTab: 'look' })), bwRow('⬆️ Updates', typeof appVersion === 'string' ? 'Solis ' + esc(appVersion) : '', '', bwPage('settings', { setTab: 'app' }))], empty: '' };
      }],
    ],
    more: [['Your character page', bwPage('profile', { youTab: 'me' })], ['Records', bwPage('profile', { youTab: 'rec' })], ['Stats and grades', bwPage('profile', { youTab: 'stats' })], ['Account', bwPage('profile', { youTab: 'acct' })], ['All settings', bwPage('settings')], ['Send feedback', 'data-act="feedback"']],
  }),
};

// ---------- the window ----------
function viewBw() {
  const id = ui.bw?.id; if (!BW_DEF[id]) { view = 'islands'; return ''; }
  const def = BW_DEF[id](), tabs = def.tabs, t = tabs.find(x => x[0] === ui.bw.tab) || tabs[0];
  let c;
  try { c = t[2](); } catch (e) { console.error(e); if (typeof lpReportError === 'function') lpReportError('bw ' + id + ': ' + (e && e.message), e); c = { k: BW_NAME[id], v: 'This part hit a problem', hint: 'The full page under More still works.', list: [] }; }
  const list = (c.list || []).slice(0, 5);
  return `<div class="bw" data-bw-id="${id}">
    <div class="bw-h"><div class="bw-ic">${BW_ICON[id]}</div><h2>${BW_NAME[id]}</h2><button type="button" class="bw-x" data-shell="home" title="Back to your island (Esc)" aria-label="Close">✕</button></div>
    ${tabs.length > 1 ? `<div class="bw-tabs" role="tablist">${tabs.map(x => `<button type="button" role="tab" data-bw="tab" data-v="${x[0]}" class="${x === t ? 'on' : ''}" aria-selected="${x === t}">${x[1]}</button>`).join('')}</div>` : ''}
    <div class="bw-b">
      <div class="bw-big"><small>${esc(c.k || '')}</small><b>${esc(c.v || '')}</b>${c.go ? `<button type="button" class="bw-go" ${c.go.at}>${c.go.label}</button>` : ''}${c.hint ? `<span>${c.hint}</span>` : ''}</div>
      ${list.length ? `${c.lt ? `<div class="bw-lt">${c.lt}</div>` : ''}<div class="bw-list">${list.map(r => `<div class="bw-it ${r.cls}" ${r.at}>${r.l ? `<span class="bw-l">${r.l}</span>` : ''}<span class="bw-r">${r.r}</span></div>`).join('')}</div>` : c.empty ? `<p class="bw-empty">${c.empty}</p>` : ''}
      <button type="button" class="bw-more" data-bw="more" aria-expanded="${!!ui.bw.more}">${ui.bw.more ? 'Less ▲' : 'More ▼'}</button>
      ${ui.bw.more ? `<div class="bw-ml">${def.more.map(([l, at, sub]) => `<button type="button" ${at}>${l}${sub ? `<small>${sub}</small>` : ''}<span>›</span></button>`).join('')}</div>` : ''}
    </div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-bw]'); if (!el) return;
  const k = el.dataset.bw;
  if (k === 'tab') { ui.bw.tab = el.dataset.v; ui.bw.more = false; render(); }
  else if (k === 'spar') { view = 'islands'; if (typeof shellTravel === 'function') shellTravel('boss', () => { ui.isPanel = 'bspar'; render(); }); }
  else if (k === 'more') { ui.bw.more = !ui.bw.more; render(); }
  else if (k === 'page') { let set = {}; try { set = JSON.parse(el.dataset.set || '{}'); } catch (x) { } Object.assign(ui, set); view = el.dataset.v; window.scrollTo(0, 0); render(); }
});
// the study timer ticks in the Library window
setInterval(() => { if (view === 'bw' && ui.bw?.id === 'library' && D?.focus && document.visibilityState === 'visible') render(); }, 1000);
