'use strict';
/* Friend challenges: a weekly head-to-head with one friend in one category
   (study time, training time, km run, steps or trees). You send it, they
   accept it in their Friends tab, and whoever is ahead when the week ends
   wins an Arena box. Challenges travel inside each player's published board
   row (stats.chal), so no extra server is needed: a challenge counts once
   both of you list it. Each row also carries last week's numbers (stats.prev)
   so the result can be settled after the week rolls over. */

const CHAL_CATS = {
  study: ['📚', 'Most study', s => s.study || 0, v => fmtMins(v) || '0m'],
  train: ['🏃', 'Most training', s => s.work || 0, v => fmtMins(v) || '0m'],
  km: ['👟', 'Most km run', s => s.km || 0, v => `${(+v || 0).toFixed(1)} km`],
  steps: ['🚶', 'Most steps', s => s.steps || 0, v => (v || 0).toLocaleString()],
  trees: ['🌳', 'Most trees grown', s => s.trees || 0, v => `${v} tree${v === 1 ? '' : 's'}`],
};
const kmOf = w => parseFloat(String(w.distance || '').replace(',', '.')) || 0;
// your numbers for one week, in the shape the challenge categories read
function chalWeek(from = mondayOf(today())) {
  const to = addDays(from, 6), w = weekStats(from);
  const runs = D.workouts.filter(x => x.done && x.date >= from && x.date <= to && (x.sport === 'Running' || /run|jog/i.test(x.title || '')));
  return { week: from, study: w.study, work: w.work, km: Math.round(runs.reduce((a, x) => a + kmOf(x), 0) * 10) / 10,
    steps: healthWeek(from).steps || 0, trees: D.focusLogs.filter(l => l.mins >= 10 && !l.withered && l.date >= from && l.date <= to).length };
}
const myChals = () => (D.challenges = D.challenges || []);
// what goes into the published board row
function chalPublish() {
  const wk = mondayOf(today()), prevWk = addDays(wk, -7);
  return { chal: myChals().filter(c => c.week >= prevWk && c.status !== 'declined').map(c => ({ id: c.id, to: c.with, cat: c.cat, week: c.week })).slice(0, 12), now: chalWeek(wk), prev: chalWeek(prevWk) };
}
const friendRowByUser = u => friendRows.find(r => r.user === u);
// a friend's published numbers for a given week, if they're still available
function theirWeek(c) {
  const r = friendRowByUser(c.with), s = r?.raw || {};
  if (s.now?.week === c.week) return s.now;
  if (s.prev?.week === c.week) return s.prev;
  return null;
}
const theyListIt = c => (friendRowByUser(c.with)?.raw?.chal || []).some(x => x.id === c.id && x.to === acct.username);
function incomingChals() {
  if (!acct.signedIn) return [];
  const mine = new Set(myChals().map(c => c.id)), wk = mondayOf(today());
  const out = [];
  for (const r of friendRows) for (const x of (r.raw?.chal || [])) if (x.to === acct.username && !mine.has(x.id) && x.week >= wk && CHAL_CATS[x.cat]) out.push({ ...x, from: r.user, name: r.name });
  return out;
}
// keep each challenge's snapshot up to date and settle the ones whose week is over
function syncChals() {
  const wk = mondayOf(today());
  let changed = false;
  for (const c of myChals()) {
    if (c.status === 'pending' && theyListIt(c)) { c.status = 'active'; changed = true; }
    if (c.status !== 'active') continue;
    const t = theirWeek(c), get = CHAL_CATS[c.cat][2];
    if (t) { const v = get(t); if (v !== c.them) { c.them = v; changed = true; } }
    c.me = get(chalWeek(c.week));
    if (c.week < wk && !c.result) { c.result = c.me > (c.them || 0) ? 'win' : c.me < (c.them || 0) ? 'lose' : 'draw'; changed = true; }
  }
  // challenges nobody accepted by the end of their week fade away
  for (const c of myChals()) if (c.status === 'pending' && c.week < wk) { c.status = 'expired'; changed = true; }
  if (changed) save();
}
function sendChallenge() {
  const user = $('#chWho')?.value, cat = $('#chCat')?.value, when = $('#chWhen')?.value || 'now';
  if (!user || !CHAL_CATS[cat]) return;
  const week = when === 'next' ? addDays(mondayOf(today()), 7) : mondayOf(today());
  if (myChals().some(c => c.with === user && c.cat === cat && c.week === week && c.status !== 'declined')) { toast('Already on', 'You already have that challenge with them this week.'); return; }
  const f = friendRowByUser(user);
  myChals().push({ id: uid(), with: user, name: f?.name || user, cat, week, by: 'me', status: 'pending', at: new Date().toISOString() });
  save(); publishMe(true); render();
  toast(`${CHAL_CATS[cat][0]} Challenge sent to ${f?.name || user}`, 'It starts counting as soon as they accept it in their Friends tab.');
}
function answerChallenge(id, yes) {
  const x = incomingChals().find(c => c.id === id); if (!x) return;
  myChals().push({ id: x.id, with: x.from, name: x.name, cat: x.cat, week: x.week, by: 'them', status: yes ? 'active' : 'declined', at: new Date().toISOString() });
  save(); publishMe(true); render();
  if (yes) toast('⚔️ Challenge accepted', `${CHAL_CATS[x.cat][1]} against ${x.name}, ${x.week === mondayOf(today()) ? 'this week' : 'next week'}. Winner gets an Arena box.`);
}
function claimFriendChal(id) {
  const c = myChals().find(x => x.id === id); if (!c || c.claimed || !c.result) return;
  c.claimed = true;
  if (c.result === 'win') { save(); openArenaBox('kit', true); return; }
  D.arena.ledger = { ...(D.arena.ledger || {}), ['chal:' + c.id]: c.result === 'draw' ? 40 : 20 };
  save(); render(); toast(c.result === 'draw' ? '🤝 A draw' : '💪 Good fight', `+${c.result === 'draw' ? 40 : 20} ${GRIT} for taking part.`);
}
function cancelChallenge(id) { D.challenges = myChals().filter(c => c.id !== id); save(); publishMe(true); render(); }

function challengesFriendsCard() {
  if (ONLINE) return '';
  syncChals();
  const wk = mondayOf(today()), friends = friendRows.filter(r => r.user);
  if (!acct.signedIn) return `<div class="card"><div class="card-head"><h2>⚔️ Challenges</h2></div><p class="muted small-text">Log in and add friends by username to challenge them to a week of study, training, km run, steps or trees. Winner gets an Arena box.</p></div>`;
  const inc = incomingChals();
  const list = myChals().filter(c => c.status !== 'declined' && c.status !== 'expired' && !(c.claimed && c.week < addDays(wk, -14))).sort((a, b) => b.week.localeCompare(a.week));
  const daysLeft = 7 - ((new Date(today()).getDay() + 6) % 7);
  const row = c => {
    const [ic, label, , fmt] = CHAL_CATS[c.cat], me = c.me || 0, them = c.them || 0, t = Math.max(1, me + them);
    const when = c.week > wk ? 'starts Monday' : c.week === wk ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'finished';
    const lead = me > them ? 'You lead' : me < them ? `${esc(c.name)} leads` : 'Level';
    return `<li class="chrow ${c.result || ''}"><span class="hl-ic">${ic}</span><div class="main"><b>${label} vs ${esc(c.name)}</b>
      <small>${c.status === 'pending' ? `Waiting for ${esc(c.name)} to accept` : c.result ? (c.result === 'win' ? '🏆 You won!' : c.result === 'lose' ? `${esc(c.name)} won` : 'A draw') : lead} · ${when}</small>
      ${c.status === 'active' ? `<div class="chbar"><i class="l" style="width:${(me / t * 100).toFixed(0)}%"></i><i class="r" style="width:${(them / t * 100).toFixed(0)}%"></i></div><div class="chnums"><span>You ${fmt(me)}</span><span>${esc(c.name)} ${fmt(them)}</span></div>` : ''}</div>
      ${c.result && !c.claimed ? `<button class="btn small primary" data-act="chalClaim" data-id="${c.id}">${c.result === 'win' ? '🎁 Open prize' : `+${c.result === 'draw' ? 40 : 20} ${GRIT}`}</button>` : c.status === 'pending' ? `<button class="iconbtn" data-act="chalCancel" data-id="${c.id}" title="Cancel">✕</button>` : ''}</li>`;
  };
  return `<div class="card chcard"><div class="card-head"><h2>⚔️ Challenges</h2><span class="muted small-text">weekly head-to-heads · winner gets an Arena box</span></div>
    ${inc.map(x => `<div class="chinc"><span class="hl-ic">${CHAL_CATS[x.cat][0]}</span><div class="main"><b>${esc(x.name)} challenged you</b><small>${CHAL_CATS[x.cat][1]}, ${x.week === wk ? 'this week' : 'next week'}</small></div><button class="btn small primary" data-act="chalYes" data-id="${esc(x.id)}">Accept</button><button class="btn small" data-act="chalNo" data-id="${esc(x.id)}">Decline</button></div>`).join('')}
    ${list.length ? `<ul class="hlist chlist">${list.map(row).join('')}</ul>` : '<p class="muted small-text">No challenges yet.</p>'}
    ${friends.length ? `<div class="chnew"><select id="chWho">${friends.map(f => `<option value="${esc(f.user)}">${esc(f.name)}</option>`).join('')}</select>
      <select id="chCat">${Object.entries(CHAL_CATS).map(([k, [ic, l]]) => `<option value="${k}">${ic} ${l}</option>`).join('')}</select>
      <select id="chWhen"><option value="now">This week</option><option value="next">Next week</option></select><button class="btn primary" data-act="chalSend">Challenge</button></div>`
      : '<p class="muted small-text">Add a friend by username to challenge them.</p>'}</div>`;
}
