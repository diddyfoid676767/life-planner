'use strict';
/* Building windows. 2.78 (feedback F2) made each building open a small card window that slides in
   from the right while the island stays in view. 2.84 (feedback round 2, R4 "Tidy island"):
   - The window IS the page now: no More. It's wider (about 40% of the screen), and every tab is
     fully usable right there: tick to-dos, add one, start and stop the study timer, log a workout,
     see every friend, chat and ranking. Rare things sit behind a small ⋯ in the header.
   - Each building keeps its medieval name with a small plain label under it (Notice Board / Today).
   - The Tavern holds the rankings (its own tab) and the housemates' islands you can visit.
   - The Workshop (a new building) holds Build, Roads, Walls, Terraform, Looks, Perks and How it
     works, so the corners of the screen stay clear. B opens it from anywhere.
   Settings are the gear in the top-right corner. The Training hall holds the Practice yard. */

const BW_ICON = { notice: '📜', library: '📚', training: '💪', tavern: '🍺', hall: '🏰', workshop: '🔨' };
const BW_NAME = { notice: 'Notice Board', library: 'Library', training: 'Training hall', tavern: 'Tavern', hall: 'Hall', workshop: 'Workshop' };
// old building ids still land somewhere sensible
const BW_ALIAS = { yard: 'training', today: 'notice', calendar: 'notice', study: 'library', friends: 'tavern', profile: 'hall', build: 'workshop', board: 'tavern', rankings: 'tavern' };

function bwOpen(id, tab) {
  if ((id === 'settings' || id === 'steward' || id === 'lodge') && typeof shellSettings === 'function') { shellSettings(); return; } // 2.83: settings are the corner gear now
  if ((id === 'board' || id === 'rankings') && !tab) tab = 'rank';
  id = BW_ALIAS[id] || id;
  if (id === 'market') { if (typeof hxOpen === 'function') hxOpen('shop'); return; }
  if (!BW_NAME[id]) return;
  if ((ui.isTab || 'personal') !== 'personal' && view === 'islands') ui.isTab = 'personal';
  const same = view === 'bw' && ui.bw?.id === id;
  if (id === 'workshop' && typeof WK === 'object' && WK.on && typeof wkToggle === 'function') wkToggle(false);
  ui.bw = { id, tab: tab || (same ? ui.bw.tab : null), dots: false };
  Object.assign(ui, { hxSel: null, isPanel: null }); view = 'bw'; window.scrollTo(0, 0); render();
  if (!same && typeof sfx === 'function') try { sfx('open'); } catch (e) { }
}

// ---------- small helpers ----------
const bwTry = (f, d) => { try { return f(); } catch (e) { return d; } };
const bwRow = (l, r = '', cls = '', at = '') => ({ l, r, cls, at });
const bwHd = l => ({ hd: l });
const bwGo = (label, at) => ({ label, at });
const bwPage = (v, set) => `data-bw="page" data-v="${v}"${set ? ` data-set='${esc(JSON.stringify(set))}'` : ''}`;
function bwWhen(d) { const n = diffDays(today(), d); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? fmtDate(d) : n < 7 ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }) : fmtDate(d); }
const bwTodo = (x, t) => bwRow(`<input type="checkbox" data-toggle="todo" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done"> ${esc(x.text)}`, x.done ? 'done' : x.due ? (x.due < t ? 'overdue' : bwWhen(x.due)) : '', x.done ? 'done' : x.due && x.due < t ? 'warn' : '');
const bwDayName = d => { const n = diffDays(today(), d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }); };
const bwPlain = id => HX_PLAIN[id] || '';

// ---------- what each building holds ----------
// a tab returns { k, v, go, hint, acts: [[label, attrs]], add: { kind, ph }, list: rows (bwHd for a heading), empty, lt, html }
const BW_DEF = {
  notice: () => ({
    tabs: [
      ['today', 'Today', () => {
        const t = today(), nowT = new Date().toTimeString().slice(0, 5), items = agenda(t, t).filter(e => e.kind !== 'todo');
        const next = items.filter(e => !e.done && (!e.time || e.time >= nowT)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))[0];
        const mins = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0), goal = +D.settings.dailyGoal || 60;
        const due = D.todos.filter(x => (!x.done && x.due && x.due <= t) || (x.done && x.doneAt && String(x.doneAt).slice(0, 10) === t));
        const list = [];
        if (items.length) list.push(bwHd('On today'), ...items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map(e => bwRow(esc(e.title), e.time ? fmtTime(e.time) : e.tag || '', e.done || (e.time && e.time < nowT) ? 'done' : e === next ? 'gold' : '')));
        list.push(bwHd('To-dos for today'), ...due.map(x => bwTodo(x, t)));
        return {
          k: next ? (next.time ? 'Next up · ' + fmtTime(next.time) : 'Next up') : 'Today', v: next ? next.title : 'Nothing else booked today',
          go: D.focus ? bwGo('■ Stop and log', 'data-act="focusStop"') : bwGo('▶ Start studying', 'data-act="focusNew"'), hint: `${fmtMins(mins) || '0m'} of ${fmtMins(goal)} studied today`,
          acts: [['＋ Event', 'data-act="new" data-kind="event"'], ['＋ SAC or exam', 'data-act="new" data-kind="assessment"']],
          add: { kind: 'todoToday', ph: 'Add a to-do for today…' },
          list: due.length || items.length ? list : [], empty: 'A clear day. Add a to-do below, or press Q anywhere.',
        };
      }],
      ['cal', 'Calendar', () => {
        const t = today(), wk = agenda(t, addDays(t, 13)).filter(e => !e.done && e.kind !== 'todo').sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')), sacs = wk.filter(e => e.kind === 'assessment' && e.date <= addDays(t, 6)).length;
        const list = []; let last = '';
        for (const e of wk.slice(0, 40)) { if (e.date !== last) { last = e.date; list.push(bwHd(bwDayName(e.date))); } list.push(bwRow(esc(e.title), e.time ? fmtTime(e.time) : e.tag || '', e.kind === 'assessment' ? 'warn' : '')); }
        return { k: 'The next two weeks', v: `${wk.length} event${wk.length === 1 ? '' : 's'}${sacs ? ` · ${sacs} SAC${sacs === 1 ? '' : 's'} this week` : ''}`, go: bwGo('＋ Add event', 'data-act="new" data-kind="event"'), hint: 'Lessons, SACs, training and your own events',
          acts: [['📅 Month view', bwPage('calendar')]], list, empty: 'Nothing booked in the next 14 days.' };
      }],
      ['todo', 'To-dos', () => {
        const t = today(), open = D.todos.filter(x => !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (+b.pri || 0) - (+a.pri || 0)), left = open.filter(x => x.due && x.due <= t).length;
        const doneT = D.todos.filter(x => x.done && x.doneAt && String(x.doneAt).slice(0, 10) === t);
        return { k: 'To-dos', v: left ? `${left} left today` : open.length ? `${open.length} open` : 'All done 🎉', hint: 'Q adds one from anywhere',
          add: { kind: 'todo', ph: 'Add a to-do…' },
          list: [...open.slice(0, 40).map(x => bwTodo(x, t)), ...(doneT.length ? [bwHd('Done today'), ...doneT.map(x => bwTodo(x, t))] : [])], empty: 'No to-dos. Nice.' };
      }],
    ],
    dots: [['The old Notice Board page', bwPage('today')], ['Calendar month view', bwPage('calendar')], ['To-do lists and filters', bwPage('today', { todoOpen: true })], ['Timetable and class mode', bwPage('today', { clsAll: true })]],
  }),
  library: () => ({
    tabs: [
      ['study', 'Study', () => {
        const t = today(), wk = mondayOf(t), f = D.focus, by = {};
        for (const l of D.focusLogs) if (l.date >= wk) by[l.subjectId] = (by[l.subjectId] || 0) + l.mins;
        const mins = D.focusLogs.filter(l => l.date === t).reduce((a, l) => a + l.mins, 0), goal = +D.settings.dailyGoal || 60, s = studyStreak();
        const tot = Object.values(by).reduce((a, m) => a + m, 0);
        const recent = D.focusLogs.slice().sort((a, b) => (b.date + (b.end || '')).localeCompare(a.date + (a.end || ''))).slice(0, 8);
        const list = [bwHd(`This week · ${fmtMins(tot) || '0m'}`), ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, m]) => bwRow(`<i class="bwdot" style="--c:${subj(id).color}"></i>${esc(subj(id).name)}`, fmtMins(m)))];
        if (recent.length) list.push(bwHd('Recent sessions'), ...recent.map(l => bwRow(`<i class="bwdot" style="--c:${subj(l.subjectId).color}"></i>${esc(subj(l.subjectId).name)}`, `${bwWhen(l.date)} · ${fmtMins(l.mins)}`)));
        const acts = [['📝 Exam mode', 'data-s2="examStart"']];
        if (f) { const m = focusElapsed(f); return { k: 'Studying ' + subj(f.subjectId).name, v: focusClock(f, m), go: bwGo('■ Stop and log', 'data-act="focusStop"'), hint: f.pausedAt ? 'Paused' : `Earning Lumen · ${s}-day streak`, list, acts: [], live: 1 }; }
        return { k: 'Today', v: `${fmtMins(mins) || '0m'} of ${fmtMins(goal)}`, go: bwGo('▶ Start studying', 'data-act="focusNew"'), hint: s ? `⚡ ${s}-day streak · keep it going` : 'Study today to start a streak', acts, list: tot || recent.length ? list : [], empty: 'Nothing studied yet. Start a timer above.' };
      }],
      ['sacs', 'SACs & exams', () => {
        const t = today(), up = D.assessments.filter(a => !a.done && a.date >= t).sort((a, b) => a.date.localeCompare(b.date)), n = up[0];
        const past = D.assessments.filter(a => a.date < t && a.score != null && a.score !== '').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
        const list = up.slice(0, 30).map(a => bwRow(`<i class="bwdot" style="--c:${subj(a.subjectId).color}"></i>${esc(subj(a.subjectId).name)}: ${esc(a.title)}`, `${bwWhen(a.date)} · ${relDays(diffDays(t, a.date)).toLowerCase()}`, diffDays(t, a.date) <= 3 ? 'warn' : '', `data-act="edit" data-kind="assessment" data-id="${a.id}"`));
        if (past.length) list.push(bwHd('Latest results'), ...past.map(a => bwRow(`<i class="bwdot" style="--c:${subj(a.subjectId).color}"></i>${esc(subj(a.subjectId).name)}: ${esc(a.title)}`, esc(String(a.score)), 'gold', `data-act="edit" data-kind="assessment" data-id="${a.id}"`)));
        return { k: n ? 'Next ' + (n.type || 'SAC') : 'SACs and exams', v: n ? `${subj(n.subjectId).name} ${relDays(diffDays(t, n.date)).toLowerCase()}` : 'None coming up', go: bwGo('＋ Add a SAC or exam', 'data-act="new" data-kind="assessment"'), hint: n ? esc(n.title) : 'Add them to see countdowns',
          acts: [['📊 Scores and records', bwPage('profile', { youTab: 'rec' })]], list, empty: 'Nothing coming up.' };
      }],
    ],
    dots: [['The old study page', bwPage('study')], ['Exam mode', 'data-s2="examStart"', 'Full screen, and leaving ends the timer'], ['Records and SAC results', bwPage('profile', { youTab: 'rec' })]],
  }),
  training: () => ({
    tabs: [
      ['work', 'Workouts', () => {
        const t = today(), wk = mondayOf(t), ws = D.workouts.filter(w => w.date <= t).sort((a, b) => b.date.localeCompare(a.date)), tw = ws.filter(w => w.date >= wk);
        return { k: 'This week', v: `${tw.length} workout${tw.length === 1 ? '' : 's'} · ${fmtMins(tw.reduce((a, w) => a + (+w.duration || 0), 0)) || '0m'}`, go: bwGo('＋ Log a workout', 'data-fit="logMenu"'), hint: 'Training earns Ember (gems)',
          acts: [['🏅 Records and progress', bwPage('training', { bodyPage: 'progress' })]],
          list: ws.slice(0, 20).map(w => bwRow(esc(w.title || w.sport || 'Workout'), `${bwWhen(w.date)}${w.duration ? ' · ' + fmtMins(+w.duration) : w.distance ? ' · ' + w.distance + ' km' : ''}`)), lt: 'Recent', empty: 'No workouts yet.' };
      }],
      ['ev', 'Events', () => {
        const t = today(), up = D.trainingEvents.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), n = up[0];
        return { k: n ? 'Next event' : 'Events', v: n ? `${n.name} ${relDays(diffDays(t, n.date)).toLowerCase()}` : 'Nothing booked', go: bwGo('＋ Add event', 'data-act="new" data-kind="tevent"'), hint: 'Races, games and comps',
          list: up.slice(0, 20).map(e => bwRow(esc(e.name), bwWhen(e.date))), empty: 'No events booked.' };
      }],
    ],
    dots: [['The old fitness page', bwPage('training', { bodyPage: 'train' })], ['Records and progress', bwPage('training', { bodyPage: 'progress' })], ['Body card', bwPage('training', { bodyPage: 'body' })]],
  }),
  tavern: () => ({
    tabs: [
      ['friends', 'Friends', () => {
        const rows = bwTry(() => allFriendRows().filter(f => f.user), []), st = rows.map(f => [f, bwTry(() => friendStatus(f), { on: false, txt: '' })]).sort((a, b) => b[1].on - a[1].on), on = st.filter(x => x[1].on).length;
        const cs = bwTry(() => shownChats(), []) || [], un = cs.reduce((s, c) => s + (+c.unread || 0), 0);
        const list = [];
        if (cs.length) list.push(bwHd(un ? `Chats · ${un} unread` : 'Chats'), ...cs.slice(0, 8).map(c => bwRow(esc(bwTry(() => chatTitle(c), c.name || 'Chat')), c.unread ? `${c.unread} new` : esc((c.last?.body || '').slice(0, 26)), c.unread ? 'gold' : '', bwPage('friends'))));
        if (st.length) list.push(bwHd(`Friends · ${on} online`), ...st.map(([f, s]) => bwRow(`<i class="bwon ${s.on ? 'on' : ''}"></i>${esc(f.name || f.user)}`, esc(s.txt || ''), '', bwPage('friends'))));
        return { k: 'Online now', v: rows.length ? `${on} friend${on === 1 ? '' : 's'}` : 'No friends yet', go: bwGo(cs.length ? '💬 Open chats' : '👥 Find friends', bwPage('friends')), hint: rows.length ? `${rows.length} friend${rows.length === 1 ? '' : 's'}` : 'Search by name or school email',
          acts: [['＋ Add a friend', bwPage('friends')]], list, empty: 'Add friends to chat and race them.' };
      }],
      ['house', 'House', () => {
        const h = bwTry(() => hsState(), {}), wk = mondayOf(today()), b = bwTry(() => hsBoss(wk), null), rest = bwTry(() => bossWeek() === 'rest', false);
        if (typeof plannerOnly === 'function' && plannerOnly()) return { k: 'House', v: 'Houses are for Westbourne students', list: [], empty: '' };
        if (!h.id) return { k: 'Your house', v: 'Not in a house yet', go: bwGo('🏰 Find a house', 'data-shell="travel" data-v="house"'), hint: 'Houses share a fortress and fight a boss each week', list: [], empty: '' };
        // housemates' islands you can visit (2.71), here since 2.84 instead of a corner button
        const list = [bwRow('🏰 House fortress', 'fly there', '', 'data-shell="travel" data-v="house"'), bwRow(`${b ? b.e : '💀'} Boss island`, 'fly there', '', 'data-shell="travel" data-v="boss"')];
        if (typeof hxIsleOn === 'function' && hxIsleOn()) {
          hxIsleList(); const L = (HX_ISLE.list || []).filter(r => !r.me);
          list.push(bwHd('Visit a housemate\'s island'), ...(L.length ? L.map(r => bwRow(`🏝️ ${esc(r.n || 'Housemate')}`, r.ut ? 'updated ' + fmtDate(r.ut.slice(0, 10)) : '', '', `data-hx="visit" data-v="${esc(r.uid)}"`)) : [bwRow(HX_ISLE.list ? '<span class="muted">No housemates have shared an island yet</span>' : '<span class="muted">Finding your housemates\' islands…</span>')]));
        }
        return { k: rest ? 'Rest week' : 'This week\'s boss', v: rest ? 'No boss this week' : b ? `${b.e} ${b.n}` : 'The Warband', go: rest ? bwGo('🏰 House fortress', 'data-shell="travel" data-v="house"') : bwGo('⚔ Fight it', 'data-shell="travel" data-v="boss"'), hint: 'Every hit goes on the house\'s weekly bar', list, empty: '' };
      }],
      ['rank', 'Rankings', () => {
        if (typeof acctLoaded !== 'undefined' && !acctLoaded && typeof loadAccount === 'function') loadAccount().then(() => { if (view === 'bw' && ui.bw?.tab === 'rank') render(); });
        const n = bwTry(() => friendsCount(), 0);
        const html = `${typeof acct === 'object' && acct.configured && !acct.signedIn && typeof accountCard === 'function' ? bwTry(accountCard, '') : ''}${bwTry(() => myWeekCard(), '')}${bwTry(() => viewBoard(), '<p class="muted">Couldn\'t load the leaderboard.</p>')}`;
        return { k: 'This week\'s leaderboard', v: n ? `You vs ${n} friend${n === 1 ? '' : 's'}` : 'Add friends to race them', hint: 'Resets every Monday. The boss damage ranking is on the boss island.', html, list: [], empty: '' };
      }],
    ],
    dots: [['Friends and chats page', bwPage('friends')], ['The full leaderboard', bwPage('board')], ['Invite friends', bwPage('friends')]],
  }),
  hall: () => ({
    tabs: [
      ['me', 'Character', () => {
        const L = solisLevel(), c = bwTry(() => cdClassInfo(), null), w = cdWallet();
        return { k: `Level ${L.n}${c ? ' ' + c.n : ''}`, v: L.max ? 'Top level' : `${L.into.toLocaleString()} / ${L.need.toLocaleString()} XP`, go: bwGo('✎ Customise', bwPage('profile', { youTab: 'me', youLook: true })), hint: c ? c.title : 'Pick a class at level 8',
          acts: [['📊 Records', bwPage('profile', { youTab: 'rec' })], ['📈 Stats and grades', bwPage('profile', { youTab: 'stats' })]],
          list: [bwRow('✦ Lumen <small class="bw-pl">coins</small>', w.lumen.toLocaleString(), 'gold'), bwRow('🔥 Ember <small class="bw-pl">gems</small>', w.ember.toLocaleString(), 'gold'), bwRow('⚡ Study streak', studyStreak() + ' days')], empty: '' };
      }],
      ['gear', 'Gear', () => {
        const st = ftState(), wr = st.wear || {}, eq = FT_GEAR_SLOTS.map(([k, n, e]) => [n, e, st.gear.find(g => g.id === wr[k])]), n = eq.filter(x => x[2]).length;
        return { k: 'Equipped', v: `${n} of ${FT_GEAR_SLOTS.length} slots`, go: bwGo('⚔ Change gear', bwPage('profile', { youTab: 'me', youLook: false })), hint: 'Gear drops from boss fights',
          list: eq.map(([sn, e, g]) => bwRow(`${g ? g.e : e} ${sn}`, g ? esc(g.n) : 'empty', g ? '' : 'done')), empty: '' };
      }],
    ],
    dots: [['Your character page', bwPage('profile', { youTab: 'me' })], ['Account', bwPage('profile', { youTab: 'acct' })], ['Send feedback', 'data-act="feedback"']],
  }),
  // 2.84: the Workshop holds every building and editing tool (workshop.js draws the tiles)
  workshop: () => ({ tabs: [['ws', 'Workshop', () => typeof wsTab === 'function' ? wsTab() : { k: 'Workshop', v: '', list: [] }]], dots: [] }),
};

// ---------- the window ----------
function viewBw() {
  const id = ui.bw?.id; if (!BW_DEF[id]) { view = 'islands'; return ''; }
  const def = BW_DEF[id](), tabs = def.tabs, t = tabs.find(x => x[0] === ui.bw.tab) || tabs[0];
  let c;
  try { c = t[2](); } catch (e) { console.error(e); if (typeof lpReportError === 'function') lpReportError('bw ' + id + ': ' + (e && e.message), e); c = { k: BW_NAME[id], v: 'This part hit a problem', hint: 'The old page under ⋯ still works.', list: [] }; }
  const list = (c.list || []).slice(0, 60), dots = def.dots || [];
  const row = r => r.hd ? `<div class="bw-lt">${r.hd}</div>` : `<div class="bw-it ${r.cls}" ${r.at}>${r.l ? `<span class="bw-l">${r.l}</span>` : ''}<span class="bw-r">${r.r}</span></div>`;
  const add = c.add ? `<form class="bw-add" data-bwadd="${c.add.kind}" autocomplete="off"><input name="text" placeholder="${esc(c.add.ph)}" aria-label="${esc(c.add.ph)}" maxlength="200"><button type="submit">Add</button></form>` : '';
  return `<div class="bw bw-${id}" data-bw-id="${id}">
    <div class="bw-h"><div class="bw-ic">${BW_ICON[id]}</div><div class="bw-tt"><h2>${BW_NAME[id]}</h2>${bwPlain(id) ? `<small>${bwPlain(id)}</small>` : ''}</div>
      <span class="bw-sp"></span>${dots.length ? `<button type="button" class="bw-dots" data-bw="dots" aria-expanded="${!!ui.bw.dots}" title="More pages">⋯</button>` : ''}<button type="button" class="bw-x" data-shell="home" title="Back to your island (Esc)" aria-label="Close">✕</button>
      ${ui.bw.dots && dots.length ? `<div class="bw-dl" role="menu">${dots.map(([l, at, sub]) => `<button type="button" role="menuitem" ${at}>${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>` : ''}</div>
    ${tabs.length > 1 ? `<div class="bw-tabs" role="tablist">${tabs.map(x => `<button type="button" role="tab" data-bw="tab" data-v="${x[0]}" class="${x === t ? 'on' : ''}" aria-selected="${x === t}">${x[1]}</button>`).join('')}</div>` : ''}
    <div class="bw-b" data-ks="bw-${id}-${t[0]}">
      ${c.k || c.v ? `<div class="bw-big"><small>${esc(c.k || '')}</small><b>${esc(c.v || '')}</b>${c.go ? `<button type="button" class="bw-go" ${c.go.at}>${c.go.label}</button>` : ''}${c.hint ? `<span>${c.hint}</span>` : ''}</div>` : ''}
      ${c.acts?.length ? `<div class="bw-acts">${c.acts.map(([l, at]) => `<button type="button" ${at}>${l}</button>`).join('')}</div>` : ''}
      ${add}
      ${list.length ? `${c.lt ? `<div class="bw-lt">${c.lt}</div>` : ''}<div class="bw-list">${list.map(row).join('')}</div>` : c.empty ? `<p class="bw-empty">${c.empty}</p>` : ''}
      ${c.html ? `<div class="bw-html">${c.html}</div>` : ''}
    </div></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-bw]');
  if (!el) { if (ui.bw?.dots && view === 'bw' && !e.target.closest('.bw-dl')) { ui.bw.dots = false; render(); } return; }
  const k = el.dataset.bw;
  if (k === 'tab') { ui.bw.tab = el.dataset.v; ui.bw.dots = false; render(); }
  else if (k === 'dots') { ui.bw.dots = !ui.bw.dots; render(); }
  else if (k === 'page') { let set = {}; try { set = JSON.parse(el.dataset.set || '{}'); } catch (x) { } Object.assign(ui, set); if (ui.bw) ui.bw.dots = false; view = el.dataset.v; window.scrollTo(0, 0); render(); }
});
// visiting a housemate from the Tavern: hxlife.js opens the island, this closes the window over it
document.addEventListener('click', e => { if (e.target.closest('.bw [data-hx="visit"]') && view === 'bw') { view = 'islands'; render(); } });
// a to-do ticked in the window stays on its list (struck through) for the rest of the day
document.addEventListener('change', e => { const c = e.target.closest?.('.bw [data-toggle="todo"]'); if (!c) return; const x = D.todos.find(y => y.id === c.dataset.id); if (x) { if (c.checked) x.doneAt = today(); else delete x.doneAt; } }, true);
// add a to-do straight from the window
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-bwadd]'); if (!f) return;
  e.preventDefault();
  const text = f.text.value.trim(); if (!text) return;
  const due = f.dataset.bwadd === 'todoToday' ? today() : '';
  D.todos.push({ id: uid(), text, due, done: false, notes: '', remind: due ? D.settings.remind.todo : [] });
  save(); render(); if (typeof sfx === 'function') try { sfx('pop'); } catch (x) { }
  setTimeout(() => document.querySelector('.bw-add input')?.focus(), 0);
});
// the study timer ticks in the Library window
setInterval(() => { if (view === 'bw' && ui.bw?.id === 'library' && D?.focus && document.visibilityState === 'visible' && !document.activeElement?.closest?.('.bw-add')) render(); }, 1000);
