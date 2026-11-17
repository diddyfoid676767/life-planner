'use strict';
/* 2.73 medieval theme pass (roadmap stage 4): a skin over the world, mostly
   text, CSS and sound. Pages open on parchment in a wooden frame with serif
   headings; houses get heraldic crests; a bell rings when a building is
   finished. (The lute and drum music was removed in 2.78.)
   Logging screens keep their plain fast layout inside the frame. The skin can
   be switched off in the Steward (Look & sound). Lumen and Ember stay as they
   are; Today is the Notice Board, Settings the Steward, the house boss the
   Warband, and the term recap the Chronicle (old names still work in Ctrl+K). */
// 2.78 (feedback rework F2): the default look is now "storybook": menu style A (bright and rounded)
// by day and style C (lantern dark) at night or in dark mode. Parchment and wood is an optional look,
// and there's no music any more (the generated lute and drum are gone; boss music will be real tracks).
const medSkin = () => { const s = typeof D === 'object' && D && D.settings && D.settings.skin; return s === 'med' || s === 'plain' ? s : 'story'; };
const medOn = () => medSkin() === 'med';
// style C at night (real Melbourne sunset, as the island's sky) and whenever dark mode is on
const skinNight = () => { try { return (typeof themeIsDark === 'function' && themeIsDark()) || (typeof hxDaylight === 'function' && !hxDaylight().day); } catch (e) { return false; } };
function medApply() {
  const sk = medSkin(), cl = document.body.classList, night = skinNight();
  cl.toggle('skin-med', sk === 'med');
  cl.toggle('skin-dark', sk === 'med' && typeof themeIsDark === 'function' && themeIsDark());
  cl.toggle('skin-a', sk === 'story' && !night);
  cl.toggle('skin-c', sk === 'story' && night);
  const mt = document.querySelector('meta[name="theme-color"]'), want = sk === 'story' ? (night ? '#24213a' : '#fffdf8') : '#4f6df5'; if (mt && mt.content !== want) mt.content = want;
}
setInterval(() => { try { medApply(); } catch (e) { } }, 60000);
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

// ---------- hooks ----------
if (typeof applyTheme === 'function') { const at0 = applyTheme; applyTheme = function () { at0.apply(this, arguments); try { medApply(); } catch (e) { } }; }
setInterval(medBells, 15000); setTimeout(medBells, 4000);
document.addEventListener('change', e => {
  const el = e.target; if (!el || el.dataset?.med !== 'skin' || !D) return;
  D.settings.skin = el.value === 'story' ? '' : el.value; save(); medApply(); render();
});
function medCardRow() {
  const o = (v, l) => `<option value="${v}" ${medSkin() === v ? 'selected' : ''}>${l}</option>`;
  return `<div class="row">Menu style <select data-med="skin">${o('story', 'Storybook: bright by day, lantern at night')}${o('med', 'Parchment and wood')}${o('plain', 'Plain')}</select></div>`;
}
