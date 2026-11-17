'use strict';
/* Workout mode: a full-screen tracker made for the phone. One exercise at a
   time with big buttons: type the weight and reps (and how hard it felt), tap
   Done and the rest timer starts. Planned gym workouts (the repeating ones in
   the training plan) open with their exercises and sets filled in, with last
   time's weights ready to beat. It all goes into the same gym session the Gym
   page uses, so it counts for PRs, the Arena and friends. */

const isGymWorkout = w => !!w && (/strength|gym/i.test(w.sport || '') || /\b(gym|weights|lifting)\b/i.test(w.title || ''));

// the sets you did last time for an exercise (not counting this session)
function prevSets(x, notId) {
  const g = [...fitCfg().gym].filter(s => s.id !== notId && s.ex?.some(it => it.x === x && it.sets.some(z => +z.r > 0))).sort((a, b) => b.date.localeCompare(a.date))[0];
  return g ? g.ex.find(it => it.x === x).sets.filter(s => !s.warm && +s.r > 0) : [];
}
// the plan in a workout's notes, e.g. "Back squat 3x5 · Calf raises 2x12 · Landmine twist 3 sets"
function planFromNotes(text) {
  const out = [], F = fitCfg();
  for (const part of String(text || '').split(/[·•\n;]/)) {
    const m = part.match(/^\s*(.+?)\s+(\d+)\s*(?:[x×]\s*(\d+)|sets?\b)/i);
    if (!m) continue;
    const name = m[1].replace(/^[-*\d.)\s]+/, '').trim().slice(0, 50); if (!name) continue;
    let id = exMatch(name);
    if (!id) { const c = F.custom.find(c => c.name.toLowerCase() === name.toLowerCase()); id = c ? c.id : 'c' + uid(); if (!c) F.custom.push({ id, name, m: [] }); }
    out.push({ x: id, n: Math.max(1, Math.min(10, +m[2])), r: m[3] ? +m[3] : '' });
  }
  return out;
}
// open a planned workout (the Today list, the training plan or its edit form) in workout mode
function startPlanned(wid) {
  const w = D.workouts.find(x => x.id === wid); if (!w) return;
  const F = fitCfg();
  let g = F.gym.find(x => x.pw === wid || x.wid === wid);
  if (!g) {
    const plan = planFromNotes(w.notes);
    const last = [...F.gym].filter(x => x.name === w.title && x.ex?.length).sort((a, b) => b.date.localeCompare(a.date))[0];
    let ex = [];
    if (plan.length) ex = plan.map(p => { const prev = prevSets(p.x); return { x: p.x, sets: Array.from({ length: p.n }, (_, k) => ({ w: (prev[k] || prev[prev.length - 1])?.w ?? '', r: '', tr: p.r || (prev[k] || prev[prev.length - 1])?.r || '' })) }; });
    else if (last) ex = last.ex.map(it => ({ x: it.x, sets: it.sets.filter(s => !s.warm).map(s => ({ w: s.w, r: '', tr: s.r })) }));
    g = { id: uid(), date: w.date && w.date <= today() ? w.date : today(), name: w.title || 'Gym session', mins: w.duration || 60, ex, pw: wid };
    F.gym.push(g);
  }
  ui.gymEdit = g.id; ui.wmEx = null; save(); wmodeOpen();
}

// ---------- the screen ----------
let wmClock = 0, wmRestEnd = 0, wmRestTimer = 0, wmLock = null;
const wmRestSec = () => fitCfg().restSec || 90;
const wmCur = it => it ? it.sets.findIndex(s => !s.done) : -1;
function wmodeOpen() {
  const g = gymSession(ui.gymEdit); if (!g) return;
  g.startedAt = g.startedAt || Date.now(); fitCfg().live = g.id;
  if (ui.wmEx == null) { const k = g.ex.findIndex(it => wmCur(it) >= 0); ui.wmEx = k >= 0 ? k : 0; }
  ui.wmode = true; ui.bodyPage = 'gym'; save();
  wmodeRender();
  clearInterval(wmClock); wmClock = setInterval(wmTick, 1000);
  try { navigator.wakeLock?.request('screen').then(l => { wmLock = l; }).catch(() => { }); } catch { }
}
function wmodeClose(finished) {
  ui.wmode = false; clearInterval(wmClock); clearInterval(wmRestTimer); wmRestEnd = 0;
  document.getElementById('wmode')?.remove(); document.body.classList.remove('wm-on');
  try { wmLock?.release(); } catch { } wmLock = null;
  if (finished && D?.fit) delete D.fit.live;
}
function wmTick() {
  const g = gymSession(ui.gymEdit), el = document.getElementById('wmClock');
  if (!g || !ui.wmode) return wmodeClose();
  if (el) { const s = Math.floor((Date.now() - g.startedAt) / 1000); el.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`; }
}
function wmodeRender() {
  const g = gymSession(ui.gymEdit); if (!g) return wmodeClose(true);
  let box = document.getElementById('wmode');
  if (!box) { box = document.createElement('div'); box.id = 'wmode'; box.className = 'wmode'; document.body.appendChild(box); }
  document.body.classList.add('wm-on');
  const i = Math.max(0, Math.min(ui.wmEx || 0, g.ex.length - 1)), it = g.ex[i], cur = wmCur(it);
  const chips = g.ex.map((x, k) => { const n = x.sets.filter(s => s.done).length; return `<button class="${k === i ? 'on' : ''} ${n && n === x.sets.length ? 'done' : ''}" data-wm="ex" data-i="${k}">${esc(exInfo(x.x).name.replace(/ \(.*\)$/, ''))}<small>${n}/${x.sets.length}</small></button>`; }).join('');
  let body;
  if (!it || ui.wmAdd) body = `<div class="wm-card"><h2>${it ? 'Add an exercise' : 'What are you training?'}</h2>${exSearchBox()}<div class="row gadd">${exPicker()}</div>${it ? '<button class="btn" data-wm="addCancel">Back</button>' : ''}</div>`;
  else {
    const ex = exInfo(it.x), prev = prevSets(it.x, g.id), pb = liftPRs(g.id)[it.x];
    const sets = it.sets.map((s, j) => `<div class="wm-set ${j === cur ? 'cur' : ''} ${s.done ? 'done' : ''}">
      <button class="wm-n ${s.warm ? 'warm' : ''}" data-wm="warm" data-j="${j}" title="Tap to mark as a warm-up">${s.warm ? 'W' : j + 1}</button>
      <label><span>${ex.bwf ? '+kg' : 'kg'}</span><input data-wms="w" data-j="${j}" type="number" step="0.5" min="0" inputmode="decimal" value="${s.w ?? ''}" placeholder="${j && it.sets[j - 1].w !== '' && it.sets[j - 1].w != null ? it.sets[j - 1].w : ex.bwf ? '0' : 'kg'}"></label>
      <label><span>reps</span><input data-wms="r" data-j="${j}" type="number" min="0" inputmode="numeric" value="${s.r ?? ''}" placeholder="${s.tr || 'reps'}"></label>
      <label><span>RPE</span><input data-wms="rpe" data-j="${j}" type="number" min="1" max="10" step="0.5" inputmode="decimal" value="${s.rpe ?? ''}" placeholder="–"></label>
      <button class="wm-tick ${s.done ? 'on' : ''}" data-wm="done" data-j="${j}" title="${s.done ? 'Not done' : 'Done'}">✓</button></div>`).join('');
    const next = g.ex[i + 1];
    const big = cur >= 0 ? `<button class="wm-big" data-wm="done" data-j="${cur}">✓ Done set ${cur + 1}${it.sets[cur].tr && !it.sets[cur].r ? ` · ${it.sets[cur].tr} reps` : ''}</button>`
      : next ? `<button class="wm-big next" data-wm="ex" data-i="${i + 1}">Next: ${esc(exInfo(next.x).name)} →</button>` : '<button class="wm-big fin" data-wm="finish">🏁 Finish workout</button>';
    body = `<div class="wm-card"><div class="wm-exhead"><h2>${esc(ex.name)}</h2><button class="iconbtn" data-wm="exDel" title="Remove this exercise">✕</button></div>
      <p class="muted small-text">${ex.m.map(m => MUSCLES[m]).join(', ')}${prev.length ? ` · last time ${prev.map(s => `${s.w || 0}×${s.r}`).join(', ')}` : ''}${pb ? ` · best ${r1(pb.e)} kg est. 1RM` : ''}</p>
      <div class="wm-sets">${sets}</div>
      ${cur >= 0 ? `<div class="wm-rpe"><span class="muted small-text">How hard was set ${cur + 1}?</span>${[6, 7, 8, 9, 10].map(v => `<button class="${+it.sets[cur].rpe === v ? 'on' : ''}" data-wm="rpe" data-j="${cur}" data-v="${v}" title="${{ 6: 'Easy, 4+ reps left', 7: '3 reps left', 8: '2 reps left', 9: '1 rep left', 10: 'Nothing left' }[v]}">${v}</button>`).join('')}</div>` : ''}
      <div class="row wm-small"><button class="btn small" data-wm="addSet">＋ Set</button>${it.sets.length > 1 ? '<button class="btn small" data-wm="delSet">− Set</button>' : ''}<span style="flex:1"></span><button class="btn small" data-wm="add">＋ Exercise</button></div>
      ${big}</div>`;
  }
  const left = Math.max(0, Math.round((wmRestEnd - Date.now()) / 1000));
  box.innerHTML = `<div class="wm-top"><button class="btn small" data-wm="hide" title="Go back to the planner. The workout keeps going.">⌄ Hide</button><div class="wm-title"><b>${esc(g.name)}</b><small id="wmClock">0:00</small></div><button class="btn small primary" data-wm="finish">Finish</button></div>
    <div class="wm-chips">${chips}<button data-wm="add" title="Add an exercise">＋</button></div>
    <div class="wm-body">${body}</div>
    <div class="wm-rest" id="wmRest" ${left ? '' : 'hidden'}><span>Rest</span><b id="wmRestT">${Math.floor(left / 60)}:${pad(left % 60)}</b><button data-wm="rest" data-v="-15">−15s</button><button data-wm="rest" data-v="15">+15s</button><button data-wm="restSkip">Skip</button></div>`;
  wmTick();
}
function wmRest(sec) {
  wmRestEnd = Date.now() + sec * 1000; clearInterval(wmRestTimer);
  const tick = () => {
    const el = document.getElementById('wmRest'), t = document.getElementById('wmRestT'), left = Math.max(0, Math.round((wmRestEnd - Date.now()) / 1000));
    if (el) el.hidden = false;
    if (t) t.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
    if (!left) { clearInterval(wmRestTimer); wmRestEnd = 0; if (t) t.textContent = 'Go!'; try { sfx('ding'); } catch { } try { navigator.vibrate?.([200, 100, 200]); } catch { } setTimeout(() => { if (!wmRestEnd) document.getElementById('wmRest')?.setAttribute('hidden', ''); }, 4000); }
  };
  tick(); wmRestTimer = setInterval(tick, 500);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-wm]'); if (!el) return;
  e.preventDefault();
  const g = gymSession(ui.gymEdit); if (!g) return wmodeClose(true);
  const i = Math.max(0, Math.min(ui.wmEx || 0, g.ex.length - 1)), it = g.ex[i], j = +el.dataset.j;
  switch (el.dataset.wm) {
    case 'hide': wmodeClose(); view = 'training'; ui.bodyPage = 'gym'; render(); toast('💪 Workout still going', 'Open it again from the Gym page (▶ Workout mode).', { timeout: 4000 }); return;
    case 'finish': if (g.ex.some(x => x.sets.some(s => !s.done && (s.w !== '' || s.tr))) && !g.ex.some(x => x.sets.some(s => s.done)) && !confirm('No sets are ticked off yet. Finish anyway?')) return;
      view = 'training'; ui.bodyPage = 'gym'; finishGym(); return;
    case 'ex': ui.wmEx = +el.dataset.i; ui.wmAdd = false; break;
    case 'add': ui.wmAdd = true; break;
    case 'addCancel': ui.wmAdd = false; break;
    case 'exDel': if (!confirm(`Remove ${exInfo(it.x).name} from this workout?`)) return; g.ex.splice(i, 1); ui.wmEx = Math.max(0, i - 1); save(); break;
    case 'addSet': { const last = it.sets[it.sets.length - 1]; it.sets.push({ w: last?.w ?? '', r: '', tr: last?.r || last?.tr || '' }); save(); break; }
    case 'delSet': { const k = it.sets.map(s => !s.done).lastIndexOf(true); it.sets.splice(k >= 0 ? k : it.sets.length - 1, 1); save(); break; }
    case 'warm': it.sets[j].warm = !it.sets[j].warm; save(); break;
    case 'rpe': it.sets[j].rpe = +el.dataset.v; save(); break;
    case 'done': {
      const s = it.sets[j]; if (!s) return;
      if (s.done) { s.done = false; save(); break; }
      if (s.r === '' || s.r == null) s.r = +s.tr || '';
      if (s.r === '' || !(+s.r > 0)) { toast('How many reps?', 'Type the reps for this set first.', { timeout: 3000 }); document.querySelector(`[data-wms="r"][data-j="${j}"]`)?.focus(); return; }
      if ((s.w === '' || s.w == null) && j > 0) s.w = it.sets[j - 1].w;
      s.done = true; save();
      const ex = exInfo(it.x), pb = liftPRs(g.id)[it.x], e1 = setE(ex, s);
      if (!s.warm && e1 && pb && e1 > pb.e + .01) toast('🏆 New PR!', `${ex.name}: ${r1(e1)} kg estimated 1RM (was ${r1(pb.e)}).`);
      try { navigator.vibrate?.(40); } catch { }
      if (wmCur(it) >= 0 || g.ex[i + 1]) wmRest(wmRestSec());
      break;
    }
    case 'rest': { const F = fitCfg(); F.restSec = Math.max(15, Math.min(600, wmRestSec() + +el.dataset.v)); save(); if (wmRestEnd) wmRestEnd += +el.dataset.v * 1000; break; }
    case 'restSkip': wmRestEnd = Date.now(); break;
  }
  wmodeRender();
});
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset.wms || !ui.wmode) return;
  const g = gymSession(ui.gymEdit), it = g?.ex[Math.max(0, Math.min(ui.wmEx || 0, g.ex.length - 1))], s = it?.sets[+el.dataset.j]; if (!s) return;
  const k = el.dataset.wms;
  s[k] = el.value === '' ? '' : k === 'rpe' ? Math.min(10, Math.max(1, +el.value)) : Math.max(0, +el.value);
  save();
});
// after a restart (an update, say) a workout that was going opens again
const wmBoot = setInterval(() => {
  if (typeof D === 'undefined' || !D || !D.settings) return;
  clearInterval(wmBoot);
  const live = D.fit?.live && gymSession(D.fit.live);
  if (!live) { if (D.fit) delete D.fit.live; return; }
  if (Date.now() - (live.startedAt || 0) > 5 * 3600e3) { delete D.fit.live; return; }
  ui.gymEdit = live.id; wmodeOpen();
}, 400);
