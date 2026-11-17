'use strict';
/* Small shared helpers (moved out of the old forest and setbacks code in
   2.55): holidays, bedtime, a celebration popup, colour shading and a seeded
   random number source. */

const DISTRACT_LIMIT = 3;

// ---------- holidays ----------
const holidays = () => D.settings.holidays || [];
const isHoliday = d => holidays().some(h => h.from <= d && d <= h.to) || (typeof termHoliday === 'function' && termHoliday(d));
const isRestDay = () => false; // rest days belonged to the old forest
function addHoliday() {
  const from = $('#holFrom')?.value, to = $('#holTo')?.value, name = ($('#holName')?.value || '').trim();
  if (!from || !to) return;
  const [a, b] = from <= to ? [from, to] : [to, from];
  D.settings.holidays = [...holidays(), { id: uid(), name: name || 'Holiday', from: a, to: b }];
  save(); render(); toast('✈️ Holiday added', `${fmtDate(a)}${a !== b ? ' – ' + fmtDate(b) : ''}: no study plan, and your streak is safe.`);
}

// ---------- bedtime ----------
const bedCfg = () => { const b = Object.assign({ on: true, time: '22:00', wk: '23:00', days: [0, 1, 2, 3, 4, 5, 6] }, D.settings.bedtime || {});
  if (!b.v2) { b.days = [...new Set([...b.days, 0, 5, 6])]; b.v2 = 1; } // weekends got their own later bedtime in 2.16.3
  return b; };
const isWeekendNight = d => [5, 6].includes(parseYmd(d).getDay());
const bedTimeFor = d => { const b = bedCfg(); return isWeekendNight(d) ? b.wk : b.time; };
const hmToMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m; };
const isBedNight = d => { const b = bedCfg(); return b.on && b.days.includes(parseYmd(d).getDay()) && !isHoliday(d); };
let bedShown = '';
function checkBedtime() {
  if (!D) return;
  const now = new Date(), t = today();
  const cur = now.getHours() * 60 + now.getMinutes(), early = now.getHours() < 4;
  const night = early ? addDays(t, -1) : t;
  const bt = bedTimeFor(night), past = early ? cur + 1440 - hmToMin(bt) : cur - hmToMin(bt);
  if (!isBedNight(night)) return;
  if (!early && past >= -30 && past < 0 && !D.fired['bed:w:' + night]) {
    D.fired['bed:w:' + night] = Date.now(); save();
    notify('🌙 Wind down', `Bed at ${fmtTime(bt)} tonight. Finish what you're doing and put the screens away soon.`, 'bed');
  }
  if (past >= 0 && past < 240 && document.visibilityState === 'visible' && !(typeof tourAt !== 'undefined' && tourAt >= 0) && bedShown !== night && !D.fired['bed:s:' + night]) { bedShown = night; D.fired['bed:s:' + night] = Date.now(); save(); bedtimeScreen(past, night); }
}
function bedtimeScreen(past, night = today()) {
  const time = bedTimeFor(night), wk = isWeekendNight(night);
  celebrate({ icon: '<span class="critbig">🛏️</span>', color: '#7950f2', kicker: wk ? 'Weekend' : 'School night', title: past < 5 ? `It's ${fmtTime(time)}. Time for bed!` : 'You should be asleep by now',
    text: 'Sleep is when your brain locks in what you studied today, and it\'s when your body recovers from training.', ok: 'Going to bed 🌙' });
  notify('🛏️ Time for bed', `It's ${fmtTime(time)}${wk ? '' : ' on a school night'}.`, 'bed');
}
function bedtimeRow() {
  const b = bedCfg(), names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<h3 style="margin:14px 0 6px">🌙 Bedtime</h3>
    <div class="row bedrow"><label><input type="checkbox" data-act="bedOn" ${b.on ? 'checked' : ''}> Bed by</label><input type="time" value="${b.time}" data-change="bedTime" style="width:auto"><span class="muted small-text">school nights,</span><input type="time" value="${b.wk}" data-change="bedTimeWk" style="width:auto"><span class="muted small-text">Fri &amp; Sat</span>
      <span class="catchips">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button class="cchip ${b.days.includes(i) ? 'on' : ''}" data-act="bedDay" data-v="${i}">${names[i]}</button>`).join('')}</span></div>
    <p class="muted small-text" style="margin:6px 0 0">One wind-down reminder 30 minutes before, then a bedtime screen.</p>`;
}
setInterval(checkBedtime, 30000);

// ---------- a celebration popup ----------
function celebrate({ icon, color = '#40c057', kicker, title, text, ok = 'Nice!' }) {
  const ov = document.createElement('div');
  ov.className = 'boxfx opened';
  ov.style.setProperty('--rc', color);
  ov.innerHTML = `<div class="boxstage"><div class="rays"></div><div class="reveal"><div class="prize">${icon}</div><div class="rar">${kicker}</div><h2>${title}</h2><p>${text}</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>${ok}</button></div></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === ov) { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); render(); } });
}

// ---------- colours and seeded randomness ----------
function shade(hex, amt) {
  let h = String(hex || '#2f9e44').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return hex;
  const mix = (c, t) => Math.round(c + (t - c) * Math.abs(amt));
  const t = amt < 0 ? 0 : 255;
  const r = mix(n >> 16 & 255, t), g = mix(n >> 8 & 255, t), b = mix(n & 255, t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function seeded(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
