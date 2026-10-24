'use strict';
/* Study page subject tabs: for each subject, its exam countdown and plan,
   summary notes with a confidence rating per topic, practice questions you
   mark yourself, flashcards on a spaced-repetition schedule, and past papers.
   Low confidence and missed questions feed weakTopics(), so the exam plan
   steers revision blocks toward them. */

const revState = sid => { D.revise = D.revise || {}; return (D.revise[sid] = Object.assign({ conf: {}, qs: {}, box: {}, cards: [] }, D.revise[sid] || {})); };
const REV_SECS = [['notes', '📖 Notes'], ['practice', '✍️ Practice'], ['cards', '🃏 Flashcards'], ['papers', '📝 Past papers']];
const LEITNER = [0, 1, 3, 7, 14, 30];
const CONF = [[1, '😟', 'Shaky'], [2, '🙂', 'Getting there'], [3, '😎', 'Confident']];
const qKey = q => 'q' + hashStr(q.q);
const cKey = c => c.id ? 'c:' + c.id : 'b' + hashStr(c.f);

function revCards(sid) {
  const pack = revisionFor(sid), st = revState(sid);
  return [...(pack ? pack.cards.map(([f, b, t]) => ({ f, b, t })) : []), ...st.cards.map(c => ({ ...c, own: true }))];
}
const cardDue = (sid, c) => { const x = revState(sid).box[cKey(c)]; return !x || x.due <= today(); };
// topics to work on from this page: shaky ratings and questions you missed
function revWeak(sid) {
  const st = revState(sid), out = {};
  for (const [t, v] of Object.entries(st.conf)) if (v === 1) out[t] = (out[t] || 0) + 1;
  const pack = revisionFor(sid);
  if (pack) for (const q of pack.questions) if (st.qs[qKey(q)] === 'miss') out[q.t] = (out[q.t] || 0) + .5;
  return out;
}
function revProgress(sid) {
  const pack = revisionFor(sid), st = revState(sid); if (!pack) return null;
  const topics = pack.topics.length, conf = pack.topics.filter(t => st.conf[t.t] === 3).length;
  const qs = pack.questions.length, got = pack.questions.filter(q => st.qs[qKey(q)] === 'got').length;
  const cards = revCards(sid), due = cards.filter(c => cardDue(sid, c)).length, learnt = cards.filter(c => (st.box[cKey(c)]?.b || 0) >= 3).length;
  return { topics, conf, qs, got, cards: cards.length, due, learnt };
}

// ---------- the tab strip above the Study page ----------
function studyTabs() {
  const t = today(), cur = ui.studyTab || 'plan';
  const tabs = D.subjects.map(s => {
    const ex = D.assessments.filter(a => a.subjectId === s.id && isExam(a) && !a.done && a.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const dd = ex ? diffDays(t, ex.date) : null;
    return `<button class="stab ${cur === s.id ? 'on' : ''}" style="--c:${s.color}" data-act="studyTab" data-v="${s.id}"><i></i>${esc(s.name)}${dd != null ? `<span class="stab-d ${dd <= 7 ? 'soon' : ''}">${dd === 0 ? 'today' : dd + 'd'}</span>` : ''}</button>`;
  }).join('');
  return `<div class="stabs"><button class="stab plan ${cur === 'plan' ? 'on' : ''}" data-act="studyTab" data-v="plan">📅 Plan</button>${tabs}</div>`;
}
function viewStudyHub() {
  if (ui.studyTab && ui.studyTab !== 'plan' && !D.subjects.some(s => s.id === ui.studyTab)) ui.studyTab = 'plan';
  return !ui.studyTab || ui.studyTab === 'plan' ? viewStudy() : revisePage(ui.studyTab);
}

// ---------- one subject ----------
function revisePage(sid) {
  const s = subj(sid), pack = revisionFor(sid), t = today(), st = revState(sid), sec = ui.revSec || 'notes';
  const exams = D.assessments.filter(a => a.subjectId === sid && !a.done && a.date >= t && (isExam(a) || /sac|test/i.test(a.type || ''))).sort((a, b) => a.date.localeCompare(b.date));
  const ex = exams.find(isExam) || exams[0], dd = ex ? diffDays(t, ex.date) : null, rd = ex && isExam(ex) ? examReadiness(ex) : null, pr = revProgress(sid);
  const ring = (v, col, lbl, txt) => ringHtml(v, col, lbl, txt);
  const hero = `<div class="revhero" style="--c:${s.color}">
    <div class="rh-main"><div class="rh-kicker">${pack ? esc(pack.units) : 'Revision'}</div><h2>${esc(s.name)}</h2>
      ${ex ? `<div class="rh-exam"><b>${dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : `${dd} days`}</b> until ${esc(ex.title)} · ${fmtDate(ex.date)}${ex.time ? ' ' + fmtTime(ex.time) : ''}</div>` : '<div class="rh-exam">No exam or SAC coming up</div>'}
      ${pack ? `<p class="rh-fmt">${esc(pack.exam)}</p>` : ''}
      <div class="row rh-btns"><button class="btn primary" data-act="focus" data-subject="${sid}">▶ Study ${esc(s.name)}</button>${ex ? `<button class="btn" data-act="planStudy" data-id="${ex.id}">Plan revision</button>` : ''}${ex && isExam(ex) ? `<button class="btn" data-act="logPaper" data-id="${ex.id}">📝 Log a paper</button>` : ''}</div></div>
    ${pr ? `<div class="rh-rings">${rd ? ring(rd.score / 100, rd.score >= 75 ? '#40c057' : rd.score >= 50 ? '#fab005' : '#fa5252', 'exam ready', rd.score + '%') : ''}${ring(pr.conf / pr.topics, '#ffffff', 'topics confident', `${pr.conf}/${pr.topics}`)}${ring(pr.cards ? pr.learnt / pr.cards : 0, '#ffd43b', 'cards learnt', `${pr.learnt}/${pr.cards}`)}</div>` : ''}
  </div>`;
  // this subject's next plan blocks
  const blocks = D.sessions.filter(x => x.subjectId === sid && !x.done && x.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 4);
  const topicOf = x => String(x.topic || '').replace(/^Revise:\s*/, '');
  const planCard = `<div class="card revplan"><div class="card-head"><h2>Coming up</h2><span style="flex:1"></span><button class="btn small" data-act="new" data-kind="session">+ Block</button></div>
    ${blocks.length ? blocks.map(x => { const tp = topicOf(x), has = pack?.topics.some(q => q.t === tp);
      return `<div class="rpblock"><div class="rp-when"><b>${diffDays(t, x.date) === 0 ? 'Today' : DOW[parseYmd(x.date).getDay()]}</b><span>${x.time ? fmtTime(x.time) : ''} · ${fmtMins(+x.duration || 30)}</span></div><div class="main">${esc(x.topic || 'Study')}</div>
        ${has ? `<button class="btn small" data-act="rev" data-op="topic" data-v="${esc(tp)}">📖 Notes</button>` : ''}<button class="btn small primary" data-act="focus" data-id="${x.id}" data-subject="${sid}">▶</button></div>`; }).join('') : `<div class="empty">Nothing planned for ${esc(s.name)} yet.${ex ? ' Plan some revision before the exam.' : ''}</div>`}
    ${Object.keys(revWeak(sid)).length ? `<div class="rp-weak"><span class="muted small-text">Work on</span>${Object.entries(revWeak(sid)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => `<button class="tag" data-act="rev" data-op="topic" data-v="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : ''}</div>`;
  const nav = `<div class="seg revseg">${REV_SECS.map(([k, l]) => `<button class="${sec === k ? 'on' : ''}" data-act="rev" data-op="sec" data-v="${k}">${l}${k === 'cards' && pr?.due ? ` <span class="rbadge">${pr.due}</span>` : ''}</button>`).join('')}</div>`;
  const body = !pack ? `<div class="card empty big">No revision pack for ${esc(s.name)} yet. You can still add your own flashcards.</div>${revCardsHtml(sid)}`
    : sec === 'practice' ? revPracticeHtml(sid, pack) : sec === 'cards' ? revCardsHtml(sid) : sec === 'papers' ? revPapersHtml(sid, pack) : revNotesHtml(sid, pack);
  return `<div class="study2 revpage">${pageHead('Study', `Revise ${esc(s.name)}`, `<button class="btn primary" data-act="focusNew">▶ Start studying</button>`)}${studyTabs()}
    <div class="revtop">${hero}${planCard}</div>${nav}<div class="revbody" key="${sec}">${body}</div></div>`;
}

function revNotesHtml(sid, pack) {
  const st = revState(sid), open = ui.revTopic;
  return `<div class="revnotes">${pack.topics.map(tp => {
    const c = st.conf[tp.t] || 0, nq = pack.questions.filter(q => q.t === tp.t).length, nc = pack.cards.filter(x => x[2] === tp.t).length;
    return `<details class="rnote ${c ? 'c' + c : ''}" ${open === tp.t ? 'open' : ''} data-topic="${esc(tp.t)}"><summary><span class="rn-conf">${c ? CONF[c - 1][1] : '○'}</span><b>${esc(tp.t)}</b><span class="muted small-text">${nq ? `${nq} question${nq === 1 ? '' : 's'}` : ''}${nq && nc ? ' · ' : ''}${nc ? `${nc} cards` : ''}</span><i class="rn-chev">›</i></summary>
      <div class="rn-body"><ul>${tp.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      ${tp.key?.length ? `<div class="rn-key">${tp.key.map(k => `<code>${esc(k)}</code>`).join('')}</div>` : ''}
      <div class="rn-foot"><span class="muted small-text">How well do you know this?</span>${CONF.map(([v, e, l]) => `<button class="rconf ${c === v ? 'on' : ''}" data-act="rev" data-op="conf" data-t="${esc(tp.t)}" data-v="${v}" title="${l}">${e} ${l}</button>`).join('')}
        <span style="flex:1"></span>${nq ? `<button class="btn small" data-act="rev" data-op="practiceTopic" data-v="${esc(tp.t)}">✍️ Practise</button>` : ''}${nc ? `<button class="btn small" data-act="rev" data-op="cardsTopic" data-v="${esc(tp.t)}">🃏 Cards</button>` : ''}</div></div></details>`;
  }).join('')}</div>`;
}

function revPracticeHtml(sid, pack) {
  const st = revState(sid), f = ui.revQTopic || '', qs = pack.questions.filter(q => !f || q.t === f);
  const topics = [...new Set(pack.questions.map(q => q.t))];
  const got = pack.questions.filter(q => st.qs[qKey(q)] === 'got').length;
  return `<div class="card"><div class="card-head"><h2>Practice questions</h2><span class="muted small-text">${got}/${pack.questions.length} got right</span><span style="flex:1"></span>
      ${Object.keys(st.qs).length ? `<button class="btn small" data-act="rev" data-op="resetQs">Start over</button>` : ''}</div>
    <div class="catchips rq-filter"><button class="cchip ${!f ? 'on' : ''}" data-act="rev" data-op="qTopic" data-v="">All</button>${topics.map(tp => `<button class="cchip ${f === tp ? 'on' : ''}" data-act="rev" data-op="qTopic" data-v="${esc(tp)}">${esc(tp)}</button>`).join('')}</div>
    <p class="muted small-text">Try each one on paper first, then check the answer and mark yourself. Ones you miss show up under "Work on" and steer your exam plan.</p>
    <ol class="rqlist">${qs.map(q => { const k = qKey(q), m = st.qs[k];
      return `<li class="rq ${m || ''}" data-k="${k}"><div class="rq-top"><span class="tag">${esc(q.t)}</span>${m === 'got' ? '<span class="rq-mark">✓</span>' : m === 'miss' ? '<span class="rq-mark miss">↺</span>' : ''}</div>
        <div class="rq-q">${esc(q.q)}</div>
        <div class="rq-a"><div class="rq-ain"><b>Answer</b><p>${esc(q.a)}</p><div class="row"><button class="btn small" data-act="rev" data-op="mark" data-k="${k}" data-v="miss">↺ Not yet</button><button class="btn small primary" data-act="rev" data-op="mark" data-k="${k}" data-v="got">✓ Got it</button></div></div></div>
        <button class="btn small rq-show" data-act="rev" data-op="reveal">Show answer</button></li>`; }).join('')}</ol></div>`;
}

function revPapersHtml(sid, pack) {
  const t = today(), ex = D.assessments.filter(a => a.subjectId === sid && isExam(a)).sort((a, b) => a.date.localeCompare(b.date));
  const logged = examPrep().papers.filter(p => p.subjectId === sid).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="revpapers"><div class="card"><div class="card-head"><h2>Past papers</h2></div>
      <div class="rp-links">${pack.papers.map(([l, u]) => `<a class="rp-link" href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer"><span>📄</span><b>${esc(l)}</b><i>↗</i></a>`).join('')}</div>
      <p class="muted small-text">Your teachers' practice exams and school past papers are the best match for your own exam: ask for them, then time yourself.</p>
      ${ex.some(a => !a.done && a.date >= t) ? `<button class="btn primary" data-act="logPaper" data-id="${ex.find(a => !a.done && a.date >= t).id}">📝 Log a paper you've done</button>` : ''}</div>
    <div class="card"><div class="card-head"><h2>Exam tips</h2></div><ul class="rtips">${pack.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="card"><div class="card-head"><h2>Papers you've logged</h2></div>${logged.length ? `<ul class="list">${logged.map(p => `<li class="item"><div class="main"><div class="title">${fmtDate(p.date)}${p.outOf ? ` · ${p.score}/${p.outOf} (${Math.round(p.score / p.outOf * 100)}%)` : ''}</div>${p.topics?.length ? `<div class="meta">Lost marks on: ${p.topics.map(esc).join(', ')}</div>` : ''}</div></li>`).join('')}</ul>` : '<div class="empty">None yet. Do one timed and log your score: it updates your readiness.</div>'}</div></div>`;
}

// ---------- flashcards ----------
function fcQueue(sid) {
  const f = ui.fcTopic || '';
  return revCards(sid).filter(c => (!f || c.t === f) && (ui.fcAll || cardDue(sid, c)));
}
function revCardsHtml(sid) {
  const st = revState(sid), all = revCards(sid), f = ui.fcTopic || '', q = fcQueue(sid);
  if (ui.fc?.sid !== sid || ui.fc.f !== f || ui.fc.all !== !!ui.fcAll) ui.fc = { sid, f, all: !!ui.fcAll, i: 0, done: 0, order: q.map(cKey).sort(() => Math.random() - .5) };
  const order = ui.fc.order.filter(k => q.some(c => cKey(c) === k)), c = q.find(x => cKey(x) === order[0]);
  const topics = [...new Set(all.map(x => x.t).filter(Boolean))];
  const boxN = b => all.filter(x => (st.box[cKey(x)]?.b || 0) === b).length;
  const stage = c ? `<div class="fc-wrap"><div class="fc" data-act="rev" data-op="flip" tabindex="0"><div class="fc-in"><div class="fc-face fc-front"><span class="fc-t">${esc(c.t || 'Your card')}</span><div class="fc-txt">${esc(c.f)}</div><span class="fc-hint">Tap or press Space to flip</span></div>
        <div class="fc-face fc-back"><span class="fc-t">${esc(c.t || 'Your card')}</span><div class="fc-txt">${esc(c.b)}</div></div></div></div>
      <div class="fc-btns"><button class="btn fc-again" data-act="rev" data-op="fcAns" data-v="0">↺ Again <kbd>1</kbd></button><button class="btn primary fc-good" data-act="rev" data-op="fcAns" data-v="1">✓ Got it <kbd>2</kbd></button></div>
      <div class="fc-left muted small-text">${order.length} card${order.length === 1 ? '' : 's'} left${ui.fc.done ? ` · ${ui.fc.done} done this round` : ''}</div></div>`
    : `<div class="fc-empty"><div class="fc-party">🎉</div><b>${all.length ? 'All caught up!' : 'No cards yet'}</b><p class="muted">${all.length ? 'No cards are due. Cards come back on a schedule: 1, 3, 7, 14 then 30 days after you get them right.' : 'Add your own cards below.'}</p>${all.length ? `<button class="btn" data-act="rev" data-op="fcAll">Practise all ${f ? 'in this topic' : 'cards'} anyway</button>` : ''}</div>`;
  return `<div class="revcards"><div class="card fc-card"><div class="card-head"><h2>Flashcards</h2><span class="muted small-text">${all.filter(x => cardDue(sid, x)).length} due</span><span style="flex:1"></span>
      <select class="fc-sel" data-rev="fcTopic"><option value="">All topics</option>${topics.map(tp => `<option ${f === tp ? 'selected' : ''}>${esc(tp)}</option>`).join('')}</select></div>
      ${stage}
      <div class="fc-boxes" title="Leitner boxes: a card moves up a box each time you get it right">${[0, 1, 2, 3, 4, 5].map(b => `<div class="fc-box"><b>${boxN(b)}</b><span>${b === 0 ? 'new' : b === 5 ? 'learnt' : 'box ' + b}</span></div>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h2>Your own cards</h2><span style="flex:1"></span><button class="btn small primary" data-act="rev" data-op="addCard">+ Card</button></div>
      ${st.cards.length ? `<ul class="list owncards">${st.cards.map(x => `<li class="item"><div class="main"><div class="title">${esc(x.f)}</div><div class="meta">${esc(x.b)}${x.t ? ' · ' + esc(x.t) : ''}</div></div><button class="iconbtn" data-act="rev" data-op="delCard" data-v="${x.id}" title="Delete">✕</button></li>`).join('')}</ul>` : '<div class="empty">Add quotes, definitions or formulas from class. They join the deck.</div>'}</div></div>`;
}
function fcAnswer(sid, good) {
  const st = revState(sid), q = fcQueue(sid), k = ui.fc.order.find(k => q.some(c => cKey(c) === k)); if (!k) return;
  const cur = st.box[k]?.b || 0, b = good ? Math.min(5, cur + 1) : 1;
  st.box[k] = { b, due: good ? addDays(today(), LEITNER[b]) : today() };
  ui.fc.order = ui.fc.order.filter(x => x !== k); if (!good) ui.fc.order.push(k); else ui.fc.done++;
  if (ui.fcAll && good) ui.fc.order = ui.fc.order.filter(x => x !== k);
  save();
  const el = document.querySelector('.fc'); if (el) { el.classList.add(good ? 'out-good' : 'out-again'); setTimeout(render, 260); } else render();
}

// ---------- actions ----------
function revAct(el) {
  const sid = ui.studyTab, st = sid && revState(sid), { op, v } = el.dataset;
  switch (op) {
    case 'sec': ui.revSec = v; render(); break;
    case 'topic': ui.revSec = 'notes'; ui.revTopic = v; render(); setTimeout(() => document.querySelector(`.rnote[open]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); break;
    case 'conf': st.conf[el.dataset.t] = st.conf[el.dataset.t] === +v ? 0 : +v; ui.revTopic = el.dataset.t; save(); render(); retopic(sid) && save(); break;
    case 'practiceTopic': ui.revSec = 'practice'; ui.revQTopic = v; render(); break;
    case 'cardsTopic': ui.revSec = 'cards'; ui.fcTopic = v; ui.fcAll = false; render(); break;
    case 'qTopic': ui.revQTopic = v; render(); break;
    case 'reveal': el.closest('.rq').classList.add('show'); break;
    case 'mark': { st.qs[el.dataset.k] = v; save(); const li = el.closest('.rq'); li.classList.remove('got', 'miss', 'show'); li.classList.add(v, 'marked'); li.querySelector('.rq-top').insertAdjacentHTML('beforeend', `<span class="rq-mark ${v === 'miss' ? 'miss' : ''}">${v === 'got' ? '✓' : '↺'}</span>`); if (v === 'miss') retopic(sid) && save(); break; }
    case 'resetQs': if (confirm('Clear your marks on these questions?')) { st.qs = {}; save(); render(); } break;
    case 'flip': el.classList.toggle('flipped'); break;
    case 'fcAns': fcAnswer(sid, v === '1'); break;
    case 'fcAll': ui.fcAll = true; ui.fc = null; render(); break;
    case 'addCard': {
      const pack = revisionFor(sid);
      showForm({ title: '🃏 New flashcard', saveLabel: 'Add card', fields: [{ key: 'f', label: 'Front (question, term or quote cue)', type: 'text', required: true }, { key: 'b', label: 'Back (answer)', type: 'textarea', required: true },
        ...(pack ? [{ key: 't', label: 'Topic', type: 'select', options: [['', 'No topic'], ...pack.topics.map(x => [x.t, x.t])], value: ui.fcTopic || '' }] : [])],
        onSave: x => { st.cards.push({ id: uid(), f: x.f.trim(), b: x.b.trim(), t: x.t || '' }); ui.fc = null; } });
      break;
    }
    case 'delCard': st.cards = st.cards.filter(x => x.id !== v); delete st.box['c:' + v]; ui.fc = null; save(); render(); break;
  }
}
document.addEventListener('change', e => {
  if (e.target.dataset?.rev === 'fcTopic') { ui.fcTopic = e.target.value; ui.fcAll = false; ui.fc = null; render(); }
});
document.addEventListener('keydown', e => {
  if (view !== 'study' || (ui.revSec || 'notes') !== 'cards' || !ui.studyTab || ui.studyTab === 'plan' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  const fc = document.querySelector('.fc'); if (!fc) return;
  if (e.key === ' ') { e.preventDefault(); fc.classList.toggle('flipped'); }
  else if (e.key === '1' || e.key === '2') { e.preventDefault(); e.stopPropagation(); fcAnswer(ui.studyTab, e.key === '2'); }
}, true);
