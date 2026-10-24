'use strict';
/* Sound effects, all made on the fly with Web Audio (no sound files): soft
   ticks when you hover buttons, pops when you click, chimes for coins and
   purchases, garden sounds (leaf rustles, bubble pops, watering, planting,
   birdsong by day and crickets at night) and battle sounds for every kind of
   move. Settings → Sound sets the volume or turns any of it off. */

const sndCfg = () => Object.assign({ on: true, vol: .6, ui: true, garden: true, arena: true, ambience: true }, (window.D && D.settings && D.settings.sound) || {});
const SND = { ctx: null, out: null, last: {}, noise: null, hoverEl: null };
function sndCtx() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return SND.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const c = SND.ctx = new AC();
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(c.destination);
  SND.out = c.createGain(); SND.out.connect(comp);
  // a short soft echo shared by everything, so sounds feel less dry
  const dl = c.createDelay(); dl.delayTime.value = .09; const fb = c.createGain(); fb.gain.value = .22; const wet = c.createGain(); wet.gain.value = .18; const lp = c.createBiquadFilter(); lp.frequency.value = 2400;
  SND.out.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(comp);
  const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; SND.noise = n;
  return c;
}
// one note: oscillator type, start and end frequency, length, loudness, delay
function tone(c, { type = 'sine', f = 440, f2, dur = .12, vol = .2, at = 0, attack = .005, q, filter } = {}) {
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let node = o; if (filter) { const fl = c.createBiquadFilter(); fl.type = filter; fl.frequency.value = q || 1200; o.connect(fl); node = fl; }
  node.connect(g); g.connect(SND.out); o.start(t); o.stop(t + dur + .05);
}
// a burst of filtered noise: rustles, swishes, hits
function hiss(c, { dur = .15, vol = .2, at = 0, type = 'bandpass', f = 2000, f2, q = 1, attack = .004 } = {}) {
  const t = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = SND.noise; s.playbackRate.value = .8 + Math.random() * .4; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(SND.out); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
const SFX_GROUP = { hover: 'ui', click: 'ui', tab: 'ui', toggle: 'ui', untoggle: 'ui', open: 'ui', close: 'ui', notify: 'ui', coin: 'ui', buy: 'ui', deny: 'ui', levelup: 'ui', box: 'ui', success: 'ui', undo: 'ui',
  pop: 'garden', rustle: 'garden', water: 'garden', plant: 'garden', pickup: 'garden', chirp: 'garden', cricket: 'garden' };
const SFX = {
  hover: c => tone(c, { f: 2100, f2: 1900, dur: .035, vol: .022, type: 'sine' }),
  click: c => { tone(c, { f: 720, f2: 360, dur: .07, vol: .09 }); hiss(c, { f: 3500, dur: .025, vol: .025 }); },
  tab: c => { tone(c, { f: 660, dur: .06, vol: .06 }); tone(c, { f: 990, dur: .08, vol: .05, at: .045 }); },
  toggle: c => { tone(c, { f: 880, f2: 1320, dur: .08, vol: .07, type: 'triangle' }); },
  untoggle: c => { tone(c, { f: 900, f2: 540, dur: .08, vol: .06, type: 'triangle' }); },
  open: c => { tone(c, { f: 420, f2: 840, dur: .12, vol: .05 }); hiss(c, { f: 1200, f2: 4000, dur: .12, vol: .02 }); },
  close: c => { tone(c, { f: 700, f2: 380, dur: .1, vol: .045 }); },
  notify: c => { tone(c, { f: 1046, dur: .14, vol: .06, type: 'triangle' }); tone(c, { f: 1568, dur: .2, vol: .05, type: 'triangle', at: .08 }); },
  coin: c => { tone(c, { f: 1319, dur: .08, vol: .07, type: 'square', filter: 'lowpass', q: 3000 }); tone(c, { f: 1976, dur: .22, vol: .07, type: 'square', filter: 'lowpass', q: 3500, at: .07 }); },
  buy: c => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, dur: .25, vol: .07, type: 'triangle', at: i * .06 })); hiss(c, { f: 6000, dur: .3, vol: .02, at: .2, type: 'highpass' }); },
  success: c => { [392, 523, 659, 784].forEach((f, i) => tone(c, { f, dur: .3, vol: .07, type: 'triangle', at: i * .08 })); },
  levelup: c => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, dur: .35, vol: .07, type: 'triangle', at: i * .07 })); tone(c, { f: 2093, dur: .6, vol: .03, at: .35 }); },
  box: c => { hiss(c, { f: 400, f2: 5000, dur: .5, vol: .05 }); [784, 988, 1175, 1568].forEach((f, i) => tone(c, { f, dur: .3, vol: .05, type: 'triangle', at: .35 + i * .05 })); },
  deny: c => { tone(c, { f: 300, f2: 220, dur: .14, vol: .07, type: 'triangle' }); tone(c, { f: 220, f2: 160, dur: .16, vol: .06, type: 'triangle', at: .1 }); },
  undo: c => { tone(c, { f: 900, f2: 500, dur: .12, vol: .05 }); },
  // garden
  pop: c => { for (let i = 0; i < 3; i++) tone(c, { f: 380 + i * 160, f2: 1400 + i * 300, dur: .09, vol: .07, at: i * .06 }); hiss(c, { f: 4000, dur: .2, vol: .03, at: .05 }); tone(c, { f: 1568, dur: .25, vol: .04, type: 'triangle', at: .2 }); },
  rustle: c => { hiss(c, { f: 2600 + Math.random() * 1500, dur: .18 + Math.random() * .12, vol: .035, q: .8, attack: .03 }); hiss(c, { f: 5000, dur: .12, vol: .015, at: .05, type: 'highpass' }); },
  water: c => { hiss(c, { f: 1500, f2: 700, dur: .7, vol: .05, type: 'lowpass', attack: .08 }); for (let i = 0; i < 6; i++) tone(c, { f: 900 + Math.random() * 900, f2: 1800 + Math.random() * 900, dur: .05, vol: .03, at: .1 + i * .09 }); },
  plant: c => { tone(c, { f: 180, f2: 70, dur: .18, vol: .12 }); hiss(c, { f: 800, dur: .15, vol: .05, type: 'lowpass' }); tone(c, { f: 1175, dur: .12, vol: .025, type: 'triangle', at: .08 }); },
  pickup: c => { tone(c, { f: 300, f2: 600, dur: .09, vol: .06 }); hiss(c, { f: 2000, dur: .08, vol: .02 }); },
  chirp: c => { const b = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(c, { f: b, f2: b * (1.25 + Math.random() * .3), dur: .07, vol: .018, at: i * .11 }); },
  cricket: c => { for (let i = 0; i < 4; i++) tone(c, { f: 4400, dur: .025, vol: .012, type: 'square', filter: 'bandpass', q: 4400, at: i * .045 }); },
};
// battle sounds: each kind of move has its own flavour on top of a hit
const TYPE_SND = {
  fire: c => hiss(c, { f: 900, f2: 300, dur: .45, vol: .12, type: 'lowpass', attack: .03 }),
  water: c => { hiss(c, { f: 1200, f2: 500, dur: .4, vol: .09, type: 'lowpass' }); for (let i = 0; i < 4; i++) tone(c, { f: 500 + i * 120, f2: 1100, dur: .06, vol: .04, at: i * .06 }); },
  spark: c => { for (let i = 0; i < 6; i++) tone(c, { f: 600 + Math.random() * 1600, dur: .03, vol: .05, type: 'square', at: i * .03 }); hiss(c, { f: 5000, dur: .2, vol: .05, type: 'highpass' }); },
  nature: c => { hiss(c, { f: 3000, dur: .35, vol: .06, attack: .05 }); tone(c, { f: 660, f2: 990, dur: .2, vol: .03, type: 'triangle' }); },
  frost: c => { [2093, 2637, 3136].forEach((f, i) => tone(c, { f, dur: .3, vol: .03, type: 'triangle', at: i * .05 })); hiss(c, { f: 7000, dur: .3, vol: .03, type: 'highpass' }); },
  combat: c => tone(c, { f: 160, f2: 60, dur: .12, vol: .14 }),
  toxic: c => { for (let i = 0; i < 5; i++) tone(c, { f: 200 + Math.random() * 300, f2: 120, dur: .1, vol: .04, at: i * .05 }); },
  earth: c => { tone(c, { f: 70, f2: 40, dur: .5, vol: .16 }); hiss(c, { f: 300, dur: .5, vol: .08, type: 'lowpass' }); },
  air: c => hiss(c, { f: 600, f2: 3000, dur: .4, vol: .07, q: 2, attack: .08 }),
  mind: c => { tone(c, { f: 440, f2: 880, dur: .4, vol: .04, type: 'sine' }); tone(c, { f: 446, f2: 870, dur: .4, vol: .04, type: 'sine' }); },
  swarm: c => { for (let i = 0; i < 8; i++) tone(c, { f: 180 + Math.random() * 60, dur: .05, vol: .03, type: 'sawtooth', filter: 'lowpass', q: 900, at: i * .03 }); },
  stone: c => { for (let i = 0; i < 3; i++) { tone(c, { f: 120 - i * 15, f2: 50, dur: .15, vol: .1, at: i * .08 }); hiss(c, { f: 500, dur: .1, vol: .05, type: 'lowpass', at: i * .08 }); } },
  spirit: c => { tone(c, { f: 300, f2: 150, dur: .5, vol: .05, type: 'triangle' }); tone(c, { f: 305, f2: 148, dur: .5, vol: .04, type: 'triangle' }); },
  legend: c => { [262, 392, 523, 784].forEach((f, i) => tone(c, { f, dur: .5, vol: .05, type: 'sawtooth', filter: 'lowpass', q: 1800, at: i * .03 })); },
  normal: c => hiss(c, { f: 1000, dur: .08, vol: .05 }),
};
function battleSfx(side, kind, d = {}) {
  const c = sfxReady('arena'); if (!c) return;
  if (kind === 'send') { hiss(c, { f: 500, f2: 4000, dur: .3, vol: .05 }); tone(c, { f: 523, f2: 1047, dur: .2, vol: .06, type: 'triangle', at: .2 }); }
  else if (kind === 'recall') tone(c, { f: 900, f2: 300, dur: .25, vol: .05, type: 'triangle' });
  else if (kind === 'move' && d.move) { const m = d.move; (SPECIAL_TYPES.has(m.type) ? TYPE_SND[m.type] : c => hiss(c, { f: 500, f2: 1800, dur: .18, vol: .05, q: 1.5 }))?.(c); if (!isDmg(m)) tone(c, { f: 660, f2: 990, dur: .2, vol: .04, type: 'triangle' }); }
  else if (kind === 'hit') {
    if (d.dot) { tone(c, { f: 260, f2: 180, dur: .15, vol: .06, type: 'triangle' }); (TYPE_SND[d.type] || TYPE_SND.normal)(c); return; }
    const big = d.eff > 1 || d.crit, weak = d.eff && d.eff < 1;
    tone(c, { f: weak ? 140 : 110, f2: 45, dur: big ? .3 : .18, vol: big ? .2 : weak ? .08 : .14 }); hiss(c, { f: big ? 1800 : 1200, f2: 400, dur: big ? .25 : .14, vol: big ? .12 : weak ? .04 : .08, type: 'lowpass' });
    if (!SPECIAL_TYPES.has(d.type)) TYPE_SND[d.type]?.(c);
    if (d.crit) tone(c, { f: 1760, dur: .25, vol: .05, type: 'triangle', at: .05 });
    if (d.eff > 1) [880, 1319].forEach((f, i) => tone(c, { f, dur: .2, vol: .04, type: 'square', filter: 'lowpass', q: 2500, at: .08 + i * .07 }));
  }
  else if (kind === 'miss') hiss(c, { f: 2500, f2: 600, dur: .25, vol: .05, q: 3 });
  else if (kind === 'faint') { tone(c, { f: 600, f2: 90, dur: .8, vol: .08, type: 'triangle' }); tone(c, { f: 80, f2: 40, dur: .3, vol: .12, at: .65 }); }
  else if (kind === 'heal') [784, 988, 1175].forEach((f, i) => tone(c, { f, dur: .3, vol: .05, type: 'triangle', at: i * .07 }));
  else if (kind === 'stat') (d.up ? [523, 659, 784] : [784, 659, 523]).forEach((f, i) => tone(c, { f, dur: .12, vol: .05, type: 'square', filter: 'lowpass', q: 2200, at: i * .06 }));
  else if (kind === 'status') ({ slp: () => tone(c, { f: 500, f2: 300, dur: .6, vol: .04 }), frz: () => TYPE_SND.frost(c), par: () => TYPE_SND.spark(c), conf: () => TYPE_SND.mind(c), brn: () => TYPE_SND.fire(c), psn: () => TYPE_SND.toxic(c), tox: () => TYPE_SND.toxic(c), leech: () => TYPE_SND.nature(c) }[d.st] || (() => tone(c, { f: 400, f2: 300, dur: .2, vol: .04 })))();
  else if (kind === 'charge') hiss(c, { f: 300, f2: 2500, dur: .5, vol: .06 });
  else if (kind === 'phase') { tone(c, { f: 80, f2: 160, dur: .9, vol: .14, type: 'sawtooth', filter: 'lowpass', q: 400 }); hiss(c, { f: 200, dur: .9, vol: .06, type: 'lowpass' }); }
  else if (kind === 'win') (side === 'me' ? [523, 523, 523, 659, 784, 1047] : [392, 349, 311, 262]).forEach((f, i) => tone(c, { f, dur: side === 'me' ? .22 : .4, vol: .07, type: 'square', filter: 'lowpass', q: 2600, at: i * (side === 'me' ? .11 : .22) }));
}
function sfxReady(group) {
  const cfg = sndCfg(); if (!cfg.on || !cfg.vol || (group && cfg[group] === false)) return null;
  const c = sndCtx(); if (!c || c.state !== 'running') return null;
  SND.out.gain.value = cfg.vol * cfg.vol;
  return c;
}
function sfx(name, { gap = 0 } = {}) {
  try {
    const now = performance.now(); if (gap && now - (SND.last[name] || 0) < gap) return; SND.last[name] = now;
    const c = sfxReady(SFX_GROUP[name]); if (c && SFX[name]) SFX[name](c);
  } catch (e) { /* sound is never worth breaking the app for */ }
}

// ---------- hooking sounds onto the whole app ----------
const SND_TARGET = 'button, .btn, a[href], [data-act], summary, select, .stab, .dpill, input[type=checkbox], label.toggle';
document.addEventListener('pointerdown', () => sndCtx(), { capture: true, once: true });
document.addEventListener('keydown', () => sndCtx(), { capture: true, once: true });
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest?.(SND_TARGET); if (!el || el === SND.hoverEl) return;
  SND.hoverEl = el; if (el.disabled || el.closest('#battlefx .gbtext')) return;
  if (sndCfg().hover !== false) sfx('hover', { gap: 45 });
});
document.addEventListener('pointerout', e => { if (SND.hoverEl && !SND.hoverEl.contains(e.relatedTarget)) SND.hoverEl = null; });
document.addEventListener('click', e => {
  const el = e.target.closest?.(SND_TARGET); if (!el) return;
  if (el.disabled || el.matches('[disabled]')) { sfx('deny', { gap: 200 }); return; }
  if (el.matches('input[type=checkbox]')) { sfx(el.checked ? 'toggle' : 'untoggle'); return; }
  const act = el.dataset?.act || '';
  if (/^(buyUpg|buyLeafUpg|storeBuy)$/.test(act)) return; // these play "buy" when they go through
  if (/^(openBox|gift)$/.test(act)) { sfx('box'); return; }
  if (el.closest('.seg, .stabs, #tabs, .forest-tabs, .shoptabs, .revseg') || /Tab$|Page$|^goto$|^studyTab$/.test(act)) { sfx('tab'); return; }
  if (el.matches('summary')) { sfx(el.parentElement?.open ? 'close' : 'open'); return; }
  sfx('click', { gap: 30 });
}, true);
// coins going up, levels, purchases and toasts are checked after each page draw
let sndCoins = null, sndLevel = null;
function soundFeedback() {
  try {
    if (!window.D || !D.game) return;
    const c = coins(), lv = typeof levelInfo === 'function' ? levelInfo().n : null;
    if (sndCoins != null && c > sndCoins) sfx('coin', { gap: 120 });
    if (sndLevel != null && lv != null && lv > sndLevel) setTimeout(() => sfx('levelup'), 250);
    sndCoins = c; sndLevel = lv;
    if (ui.justBought) sfx('buy');
  } catch (e) { }
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList?.contains('toast')) sfx('notify', { gap: 400 }); }).observe(document.body, { childList: true, subtree: false });

// ---------- garden ambience: birds by day, crickets at night ----------
setInterval(() => {
  if (document.hidden || typeof view === 'undefined' || view !== 'forest' || !document.getElementById('g3host') || !sndCfg().ambience) return;
  const hr = new Date().getHours(), night = hr >= 20 || hr < 6;
  if (Math.random() < (night ? .5 : .35)) sfx(night ? 'cricket' : 'chirp');
}, 2600);

// ---------- Settings → Sound ----------
function soundCard() {
  const c = sndCfg(), row = (k, l, d) => `<label class="sndrow"><input type="checkbox" data-snd="${k}" ${c[k] !== false ? 'checked' : ''}><span><b>${l}</b><span class="muted small-text">${d}</span></span></label>`;
  return `<div class="card sndcard" data-sec="sound"><div class="card-head"><h2>🔊 Sound effects</h2></div>
    ${row('on', 'Sound on', 'Every sound in the app')}
    <div class="sndvol"><span>🔈</span><input type="range" min="0" max="1" step="0.05" value="${c.vol}" data-snd="vol" ${c.on ? '' : 'disabled'}><span>🔊</span><b>${Math.round(c.vol * 100)}%</b></div>
    <div class="sndgroups ${c.on ? '' : 'off'}">${row('ui', 'Buttons and menus', 'Clicks, tabs, coins and purchases')}${row('hover', 'Hover ticks', 'A tiny tick when your mouse moves over a button')}${row('garden', 'Garden', 'Rustling trees, popping bubbles, watering and planting')}${row('ambience', 'Garden ambience', 'Birds by day, crickets at night, while the garden is open')}${row('arena', 'Arena battles', 'Hits, misses, crits, healing and a sound for each kind of move')}</div>
    <button class="btn small" data-snd-test="1">▶ Play a test sound</button></div>`;
}
document.addEventListener('input', e => {
  const k = e.target.dataset?.snd; if (!k) return;
  D.settings.sound = { ...sndCfg(), [k]: k === 'vol' ? +e.target.value : e.target.checked };
  if (k === 'vol') { const b = e.target.parentNode.querySelector('b'); if (b) b.textContent = Math.round(+e.target.value * 100) + '%'; sfx('coin', { gap: 90 }); save(); return; }
  save(); render();
});
document.addEventListener('click', e => { if (e.target.closest?.('[data-snd-test]')) { sndCtx(); setTimeout(() => sfx('buy'), 30); } });
// the 🔊 button on the garden toolbar mutes or unmutes everything
document.addEventListener('click', e => { const b = e.target.closest?.('[data-snd-toggle]'); if (!b) return; D.settings.sound = { ...sndCfg(), on: !sndCfg().on }; save(); b.textContent = sndCfg().on ? '🔊' : '🔇'; b.classList.toggle('on', !sndCfg().on); if (sndCfg().on) { sndCtx(); setTimeout(() => sfx('toggle'), 20); } });
