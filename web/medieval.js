'use strict';
/* 2.73 medieval theme pass (roadmap stage 4): a skin over the world, mostly
   text, CSS and sound. Pages open on parchment in a wooden frame with serif
   headings; houses get heraldic crests; a bell rings when a building is
   finished; a soft lute and drum plays while you look round your island.
   Logging screens keep their plain fast layout inside the frame. The skin can
   be switched off in the Steward (Look & sound). Lumen and Ember stay as they
   are; Today is the Notice Board, Settings the Steward, the house boss the
   Warband, and the term recap the Chronicle (old names still work in Ctrl+K). */
const medOn = () => typeof D === 'object' && D && D.settings && D.settings.skin !== 'plain';
function medApply() {
  const on = medOn(), cl = document.body.classList;
  cl.toggle('skin-med', on);
  cl.toggle('skin-dark', on && typeof themeIsDark === 'function' && themeIsDark());
}
// a heraldic shield in the house colours
function hsCrest(h, size = 22) {
  if (!h) return '';
  return `<svg class="crest" viewBox="0 0 40 46" width="${size}" height="${Math.round(size * 1.15)}" aria-hidden="true"><path d="M3 4h34v17c0 12-8 19-17 23C11 40 3 33 3 21z" fill="${h.col}" stroke="${h.ink === '#fff' ? '#3b2a12' : h.ink}" stroke-width="2.5"/><path d="M3 4h34v6H3z" fill="rgba(255,255,255,.28)"/><text x="20" y="31" font-size="17" text-anchor="middle">${h.e}</text></svg>`;
}

// ---------- the bell: a building on your island is finished ----------
function medBells() {
  if (typeof D !== 'object' || !D || typeof hxState !== 'function' || typeof hxCond !== 'function') return;
  let st; try { st = hxState(); } catch (e) { return; }
  const first = !st.rung; st.rung = st.rung || {};
  const done = [];
  for (const [k, s] of Object.entries(st.b || {})) {
    if (!s.ready) continue;
    const id = k + '@' + s.ready + (s.up ? '^' + s.up.lv : '');
    if (st.rung[id]) continue;
    let c; try { c = hxCond(k); } catch (e) { continue; }
    if (c === 'build' || c === 'grow' || (s.up && today() < s.up.r)) continue;
    st.rung[id] = 1; if (!first) done.push(s);
  }
  // keep the list short: only what is on the island now
  const keep = new Set(Object.entries(st.b || {}).map(([k, s]) => k + '@' + s.ready)); for (const id of Object.keys(st.rung)) if (!keep.has(id.split('^')[0])) delete st.rung[id];
  if (first || done.length) save();
  if (!done.length) return;
  medBell();
  const it = hxItem(done[0].id);
  if (it) toast(`🔔 ${it.e} ${it.n} ${done[0].up ? 'upgraded' : it.field ? 'is ripe' : 'is finished'}`, done.length > 1 ? `And ${done.length - 1} more.` : 'Your builders are free again.');
}
function medBell() {
  try {
    const c = sfxReady('ui'); if (!c) return;
    // a church-bell strike: a few inharmonic partials with a long ring
    for (const [f, v, d] of [[392, .16, 2.6], [392 * 2.01, .08, 2], [392 * 2.76, .05, 1.4], [392 * 4.07, .03, 1], [392 * .5, .06, 3]]) tone(c, { type: 'sine', f, dur: d, vol: v, attack: .004 });
    tone(c, { type: 'sine', f: 392, dur: 2.2, vol: .08, at: .9 });
  } catch (e) { }
}

// ---------- music: a soft lute and drum while your island is on screen ----------
const MED_MUS = { t: 0, beat: 0, timer: 0 };
const MED_SCALE = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392]; // D dorian
const MED_TUNE = [[0, 4, 7, 4], [2, 5, 9, 5], [3, 6, 8, 6], [4, 7, 10, 9]]; // four bars of broken chords, played round and round
function medMusicOn() {
  if (!medOn() || document.hidden || typeof view === 'undefined' || view !== 'islands') return false;
  const cfg = typeof sndCfg === 'function' ? sndCfg() : {}; return cfg.on && cfg.music !== false && cfg.vol > 0;
}
function medPluck(c, f, at, vol) {
  // a plucked string: a bright triangle that dies fast, plus a soft octave
  tone(c, { type: 'triangle', f, dur: .9, vol, at, attack: .003 }); tone(c, { type: 'sine', f: f * 2, dur: .5, vol: vol * .35, at, attack: .003 });
}
function medStep() {
  if (!medMusicOn()) return;
  const c = typeof sfxReady === 'function' ? sfxReady('music') : null; if (!c) return;
  const b = MED_MUS.beat++, bar = MED_TUNE[Math.floor(b / 8) % MED_TUNE.length], v = .045;
  const n = bar[b % 4]; if (b % 8 !== 7) medPluck(c, MED_SCALE[n], 0, b % 4 === 0 ? v * 1.3 : v);
  if (b % 4 === 0) tone(c, { type: 'sine', f: 90, f2: 48, dur: .28, vol: .09, attack: .004 }); // drum
  if (b % 4 === 2) hiss(c, { f: 1800, dur: .06, vol: .025, q: .8 }); // tap on the rim
  if (b % 16 === 0) medPluck(c, MED_SCALE[bar[0]] / 2, 0, v * .9); // a low note under each phrase
}
setInterval(medStep, 330);

// ---------- hooks ----------
if (typeof applyTheme === 'function') { const at0 = applyTheme; applyTheme = function () { at0.apply(this, arguments); try { medApply(); } catch (e) { } }; }
setInterval(medBells, 15000); setTimeout(medBells, 4000);
document.addEventListener('change', e => {
  const el = e.target; if (!el || el.dataset?.med !== 'skin' || !D) return;
  D.settings.skin = el.checked ? '' : 'plain'; save(); medApply(); render();
});
function medCardRow() {
  return `<label class="row"><input type="checkbox" data-med="skin" ${medOn() ? 'checked' : ''}> Medieval look (parchment, wood and serif headings)</label>`;
}
