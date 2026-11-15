'use strict';
/* Island looks, day and night, seasons and weather (2.71, roadmap stage 3d). Loaded after terraform.js.
   - Themes (Spring meadow, Autumn, Snow, Desert oasis) recolour your island's grass and trees.
     Each is bought once; switching between ones you own is free. Terraforming stays on top.
   - With no theme, the season follows the real date (southern hemisphere) and tints it gently.
   - Lighting follows the real time of day: a sun that crosses the sky, golden hours, and a
     moonlit night where lamp posts and building lanterns glow.
   - Weather is Melbourne's for everyone (Open-Meteo, no key, no location asked or stored):
     gentle rain, more clouds when it's overcast, falling leaves in autumn, snow on the Snow theme.
     Low graphics, or the switch in Looks, turns weather off. */
const HX_THEMES = {
  natural: { n: 'Natural', e: '🍃', d: 'Follows the real season', l: 0, x: 0 },
  spring: { n: 'Spring meadow', e: '🌷', d: 'Bright green and full of flowers', l: 250, x: 250, gr: '#86dc5a', gs: .5, lf: '#3fb34f', ls: .3, tuft: ['#6fd650', '#8be26a', '#58c23e'], fl: ['#ff8fab', '#ffd6e0', '#fff3bf', '#e599f7', '#ffffff'], flN: 2 },
  autumn: { n: 'Autumn', e: '🍂', d: 'Orange and red leaves that fall', l: 250, x: 250, gr: '#bdb04c', gs: .55, lf: '#e0782a', ls: .85, tuft: ['#c9762c', '#a8552a', '#d9a441'], fl: ['#ffd43b', '#ff922b', '#e8590c'], leaves: 1 },
  snow: { n: 'Snow', e: '❄️', d: 'A white winter with gentle snowfall', l: 250, x: 250, gr: '#f1f6ff', gs: .88, lf: '#d5e4f0', ls: .6, tuft: ['#e7eefb', '#d3def0', '#ffffff'], fl: ['#ffffff', '#d0ebff'], snow: 1 },
  desert: { n: 'Desert oasis', e: '🏜️', d: 'Warm sand and dry grass', l: 250, x: 250, gr: '#dcc27e', gs: .8, lf: '#7f9a48', ls: .5, tuft: ['#b9a35a', '#cdb46b', '#a08a45'], fl: ['#ffa94d', '#ffe066'] },
};
// what the real season looks like when no theme is on (Melbourne: autumn Mar-May, winter Jun-Aug, spring Sep-Nov)
const HX_SEASONS = {
  summer: { n: 'Summer', e: '☀️', gr: '#c2c853', gs: .15 },
  autumn: { n: 'Autumn', e: '🍂', gr: '#bdb04c', gs: .25, lf: '#d9782d', ls: .45, leaves: 1, tuft: ['#7da843', '#b98a3a', '#5f9a3a'] },
  winter: { n: 'Winter', e: '🌧️', gr: '#7fae84', gs: .2, lf: '#2f7d5c', ls: .15 },
  spring: { n: 'Spring', e: '🌷', gr: '#7fdc55', gs: .25, flN: 1.6, fl: ['#ff8fab', '#ffec99', '#ffffff', '#d0bfff', '#ffc078'] },
};
const HX_MELB = { lat: -37.81, lon: 144.96 };
const hxSeason = (d = new Date()) => ['summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer'][d.getMonth()];
const hxWxOn = () => !hxLow() && D.settings.isWx !== false;
// the look for the island being drawn: a theme on your island, the season otherwise (the house island just follows the season)
function hxLook(home = IS3.house === 'hex') { const t = home && HX_THEMES[hxCur().theme]; return t && t.gr ? t : HX_SEASONS[hxSeason()]; }

// ---------- recoloured textures ----------
// the pack's greens move towards the look's colours, keeping their light and shade: the yellow-greens
// of the grass towards gr, the blue-greens of the leaves towards lf (only the land's material uses this)
function hxThemeTex(look) {
  const K = HX3.kit, key = [look.gr, look.gs, look.lf, look.ls].join(); K.texs = K.texs || {};
  if (!K.base0) K.base0 = K.tex;
  if (K.texs[key]) return K.texs[key];
  const src = K.base0.image, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0);
  const px = cx.getImageData(0, 0, cv.width, cv.height), a = px.data, c = new THREE.Color();
  const G = look.gr && (c.set(look.gr), [c.r * 255, c.g * 255, c.b * 255]), F = look.lf && (c.set(look.lf), [c.r * 255, c.g * 255, c.b * 255]);
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx !== g || mx - mn < 30) continue; // only clear greens
    const leaf = b > r, T = leaf ? F : G, s = leaf ? look.ls : look.gs; if (!T || !s) continue;
    const L = (r * .3 + g * .59 + b * .11) / (leaf ? 90 : 140);
    a[i] = r + (Math.min(255, T[0] * L) - r) * s; a[i + 1] = g + (Math.min(255, T[1] * L) - g) * s; a[i + 2] = b + (Math.min(255, T[2] * L) - b) * s;
  }
  cx.putImageData(px, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true;
  return (K.texs[key] = tex);
}
function hxApplyLook(look) {
  const K = HX3.kit, tex = look ? hxThemeTex(look) : K.base0 || K.tex, m = K.matT || (K.matT = K.mat.clone());
  if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
}

// ---------- day and night ----------
// hours since midnight, sunrise and day length for Melbourne on this date (good to about 15 minutes)
function hxSunTimes(d = new Date()) {
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), len = 12.15 + 2.6 * Math.cos(2 * Math.PI * (doy - 355) / 365);
  const dst = d.getMonth() >= 9 || d.getMonth() <= 2 || (d.getMonth() === 3 && d.getDate() < 7), noon = dst ? 13.2 : 12.2;
  return { now: d.getHours() + d.getMinutes() / 60, rise: noon - len / 2, set: noon + len / 2, len };
}
// 1 = midday, 0 = sunrise/sunset, below 0 = night (down to -1)
function hxDaylight(d = new Date()) {
  const T = hxSunTimes(d);
  if (T.now >= T.rise && T.now <= T.set) return { e: Math.sin(Math.PI * (T.now - T.rise) / T.len), p: (T.now - T.rise) / T.len, day: true };
  const n = T.now > T.set ? T.now - T.set : T.now + 24 - T.set, nl = 24 - T.len;
  return { e: -Math.sin(Math.PI * n / nl), p: n / nl, day: false };
}
const HX_SKY0 = {};
function hxSkyLights() {
  if (!HX_SKY0.hemi) { HX_SKY0.hemi = IS3.scene.children.find(o => o.isHemisphereLight); HX_SKY0.rim = IS3.scene.children.find(o => o.isDirectionalLight && o !== IS3.sun); HX_SKY0.sunC = IS3.sun.color.clone(); HX_SKY0.hemiC = HX_SKY0.hemi?.color.clone(); }
  return HX_SKY0;
}
// sets the light for now (called on every draw of a hex island and once a minute)
function hxSkyApply() {
  if (!IS3.sun || !IS3.hexMode) return;
  const L = hxSkyLights(), dl = hxDaylight(), wx = hxWxOn() ? HX_WX.cur : null, over = wx ? Math.min(1, (wx.cc || 0) / 100) * .35 + (wx.rain ? .2 : 0) : 0, S = ((hxW(hxCur()).R || HX_R) + 1) / (HX_R0 + 1);
  const sun = IS3.sun, c = new THREE.Color();
  let night = 0;
  if (dl.day) {
    const a = Math.PI * dl.p, gold = Math.max(0, 1 - dl.e * 3.2);
    sun.position.set(Math.cos(a) * 34 * S, 8 + Math.sin(a) * 30, 14);
    sun.color.copy(HX_SKY0.sunC).lerp(c.set('#ffa25e'), gold * .75);
    sun.intensity = (.55 + .45 * Math.min(1, dl.e * 2.2)) * (1 - over);
    if (L.hemi) { L.hemi.intensity = (.5 + .25 * Math.min(1, dl.e * 2)) * (1 - over * .5); L.hemi.color.copy(HX_SKY0.hemiC).lerp(c.set('#ffd7b0'), gold * .3); }
  } else {
    night = Math.min(1, -dl.e * 4 + .35);
    sun.position.set(-16 * S, 30, -12); sun.color.set('#a9bcff'); sun.intensity = .45 * (1 - over * .5);
    if (L.hemi) { L.hemi.intensity = .55; L.hemi.color.set('#97a5e0'); }
  }
  if (HX3.lampMat) HX3.lampMat.emissiveIntensity = .25 + night * 1.6;
  if (HX3.nightG) { HX3.nightG.visible = night > .05; HX3.nightG.children.forEach(o => { if (o.material) o.material.opacity = (o.userData.op || 1) * Math.min(1, night * 1.3); }); }
  HX3.night = night;
}
// puts the boss island's lighting back
function hxSkyReset() {
  if (!HX_SKY0.sunC) return;
  IS3.sun.color.copy(HX_SKY0.sunC); IS3.sun.intensity = 1; if (HX_SKY0.hemi) { HX_SKY0.hemi.intensity = .75; HX_SKY0.hemi.color.copy(HX_SKY0.hemiC); }
}
setInterval(() => { if (view === 'islands' && IS3.hexMode && (IS3.house === 'hex' || IS3.house === 'hexh') && IS3.canvas?.isConnected) { hxSkyApply(); is3draw(); } }, 60000);
// a soft round glow, shared by every lantern
function hxHaloTex() {
  if (HX3.haloTex) return HX3.haloTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(.35, 'rgba(255,180,90,.45)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (HX3.haloTex = new THREE.CanvasTexture(cv));
}

// ---------- weather (Melbourne, Open-Meteo) ----------
const HX_WX = { cur: null, at: 0, busy: false };
function hxWxFetch() {
  if (HX_WX.busy || Date.now() - HX_WX.at < 30 * 6e4) return;
  HX_WX.busy = true;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${HX_MELB.lat}&longitude=${HX_MELB.lon}&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m&timezone=Australia%2FMelbourne`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('weather ' + r.status)))
    .then(j => {
      const c = j.current || {}, code = c.weather_code || 0;
      HX_WX.cur = { code, t: Math.round(c.temperature_2m), cc: c.cloud_cover || 0, wind: c.wind_speed_10m || 0, rain: (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || (c.precipitation || 0) > .1, heavy: code >= 63 && code <= 67 || code >= 81, snow: (code >= 71 && code <= 77) || code === 85 || code === 86 };
      HX_WX.at = Date.now(); HX_WX.busy = false;
      if (view === 'islands' && IS3.hexMode) { HX3.sig = ''; render(); }
    }).catch(() => { HX_WX.busy = false; HX_WX.at = Date.now() - 25 * 6e4; }); // try again in 5 minutes
}
const hxWxText = w => !w ? '' : w.snow ? 'Snow' : w.rain ? (w.heavy ? 'Rain' : 'Light rain') : w.code >= 45 && w.code <= 48 ? 'Fog' : w.cc > 70 ? 'Cloudy' : w.cc > 30 ? 'Partly cloudy' : 'Clear';
const hxWxIcon = w => { const n = !hxDaylight().day; return !w ? '' : w.snow ? '🌨️' : w.rain ? '🌧️' : w.cc > 70 ? '☁️' : w.cc > 30 ? (n ? '☁️' : '⛅') : n ? '🌙' : '☀️'; };
// the little weather chip in the corner
function hxWxChip() {
  hxWxFetch();
  const w = HX_WX.cur, s = HX_SEASONS[hxSeason()];
  return `<button class="hxwx" data-hx="panel" data-v="looks" title="Melbourne weather and your island's look">${w ? `${hxWxIcon(w)} ${w.t}° · ${hxWxText(w)}` : `${hxDaylight().day ? '☀️' : '🌙'} Melbourne`} · ${s.e} ${s.n}</button>`;
}
// the season or theme's sig for rebuilding the island
const hxSkySig = () => { const w = hxWxOn() ? HX_WX.cur : null; return [IS3.house === 'hex' ? hxCur().theme || '' : '', hxSeason(), w ? [w.rain, w.heavy, w.snow, Math.round(w.cc / 25)].join() : '-'].join(','); };
// how many clouds to draw
const hxCloudN = () => { const w = hxWxOn() ? HX_WX.cur : null; return !w ? 7 : w.rain || w.cc > 70 ? 12 : w.cc > 30 ? 8 : 4; };

// ---------- extra pieces on the island: lanterns, rain, leaves, snow ----------
function hxSkyBuild(W, st, W0) {
  const look = hxLook(!!W0.home), low = hxLow();
  if (HX3.kit) hxApplyLook(look);
  HX3.wx = null;
  // lanterns by the page buildings and your finished buildings: a warm glow at night
  const ng = HX3.nightG = new THREE.Group(), halo = new THREE.SpriteMaterial({ map: hxHaloTex(), color: '#ffcf85', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = (x, y, z, s = 1.3) => { const sp = new THREE.Sprite(halo.clone()); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.userData.op = .9; ng.add(sp); };
  const lantern = (x, z, y0 = 0) => {
    if (!HX3.lampMat) tfModel('lamp', 'blue'); // makes the shared lamp material
    const p = new THREE.Group(); p.position.set(x, y0, z);
    is3mesh(new THREE.CylinderGeometry(.025, .03, .8, 5), '#3b3b45', 0, .4, 0, p);
    const li = new THREE.Mesh(new THREE.BoxGeometry(.11, .13, .11), HX3.lampMat); li.position.y = .86; p.add(li); W.add(p);
    glow(x, y0 + .86, z, 1.1);
  };
  W0.free.forEach(f => { if (f.id === 'hall' && !W0.home) return; const [x, z] = hxPos(...hxQR(f.at)); lantern(x - .75, z + .85); });
  for (const [k, s] of Object.entries(st.b)) { const it = W0.item(s.id); if (!it || it.wall || it.field || it.hz > 1) continue; const [x, z] = hxPos(...hxQR(k)); lantern(x - .8, z + .75, hxHt(k, st)); }
  for (const [k, v] of Object.entries(st.tf || {})) if (v.d === 'lamp') { const [x, z] = hxPos(...hxQR(k)); glow(x, hxHt(k, st) + 1.42, z, 1.6); }
  ng.visible = false; W.add(ng);
  // weather and leaves
  if (low || !hxWxOn() && !(W0.home && HX_THEMES[st.theme]?.snow)) return;
  const w = HX_WX.cur, S = ((W0.R || HX_R) + 1) * 2.2, kind = hxWxOn() && w?.rain ? 'rain' : (W0.home && HX_THEMES[st.theme]?.snow) || (hxWxOn() && w?.snow) ? 'snow' : look.leaves && !(hxWxOn() && w?.rain) ? 'leaves' : null;
  if (!kind || (!hxWxOn() && kind !== 'snow')) return;
  const n = kind === 'rain' ? (w.heavy ? 900 : 450) : kind === 'snow' ? 500 : 70, pos = new Float32Array(n * (kind === 'rain' ? 6 : 3)), sp = new Float32Array(n), r = seeded('hxwx');
  for (let i = 0; i < n; i++) {
    const x = (r() - .5) * S, y = r() * 22, z = (r() - .5) * S; sp[i] = .7 + r() * .6;
    if (kind === 'rain') pos.set([x, y, z, x + .05, y - .55, z], i * 6); else pos.set([x, y, z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let o;
  if (kind === 'rain') o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#b9d4ff', transparent: true, opacity: .45, depthWrite: false }));
  else if (kind === 'snow') o = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: .14, transparent: true, opacity: .9, depthWrite: false }));
  else {
    const cols = new Float32Array(n * 3), c = new THREE.Color(); for (let i = 0; i < n; i++) { c.set(['#e8590c', '#f08c00', '#c92a2a', '#d9a441'][i % 4]); cols.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    o = new THREE.Points(g, new THREE.PointsMaterial({ size: .22, vertexColors: true, transparent: true, opacity: .95, depthWrite: false }));
  }
  o.frustumCulled = false; W.add(o);
  HX3.wx = { o, kind, n, sp, S, t: performance.now(), wind: Math.min(1.5, (w?.wind || 8) / 20) };
}
// moves the rain, snow or leaves (called from hxLoop)
function hxWxStep(now) {
  const X = HX3.wx; if (!X) return;
  const dt = Math.min(.1, (now - X.t) / 1000); X.t = now;
  const a = X.o.geometry.attributes.position.array, t = now / 1000, H = X.S / 2;
  for (let i = 0; i < X.n; i++) {
    const s = X.sp[i];
    if (X.kind === 'rain') {
      const j = i * 6, dy = 26 * s * dt, dx = X.wind * 3 * dt;
      a[j + 1] -= dy; a[j + 4] -= dy; a[j] += dx; a[j + 3] += dx;
      if (a[j + 4] < -1) { const x = (Math.random() - .5) * X.S, z = (Math.random() - .5) * X.S, y = 20 + Math.random() * 4; a.set([x, y, z, x + .05, y - .55, z], j); }
    } else {
      const j = i * 3, leaf = X.kind === 'leaves';
      a[j + 1] -= (leaf ? 1.1 : 1.6) * s * dt;
      a[j] += (Math.sin(t * (leaf ? 1.7 : .9) + i) * (leaf ? 1.2 : .4) + X.wind * (leaf ? 1.4 : .5)) * dt;
      a[j + 2] += Math.cos(t * 1.3 + i * 1.7) * (leaf ? .8 : .3) * dt;
      if (a[j + 1] < (leaf ? .05 : -1) || Math.abs(a[j]) > H) { a[j] = (Math.random() - .5) * X.S; a[j + 1] = leaf ? 6 + Math.random() * 8 : 16 + Math.random() * 6; a[j + 2] = (Math.random() - .5) * X.S; }
    }
  }
  X.o.geometry.attributes.position.needsUpdate = true;
}

// ---------- the Looks panel ----------
function hxLooksHtml() {
  const st = hxState(), own = st.themes || [], cur = HX_THEMES[st.theme] ? st.theme : 'natural', s = HX_SEASONS[hxSeason()], w = HX_WX.cur, dl = hxDaylight();
  const T = hxSunTimes(), hm = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${(H + 11) % 12 + 1}:${String(M).padStart(2, '0')}${H < 12 ? 'am' : 'pm'}`; };
  return `<p class="muted small-text">Your island's light follows the real time of day (sunrise about ${hm(T.rise)}, sunset about ${hm(T.set)}), and lamps and lanterns glow at night. ${dl.day ? '' : '🌙 It\'s night now.'}</p>
    <div class="isshop">${Object.entries(HX_THEMES).map(([id, t]) => {
      const has = id === 'natural' || own.includes(id), on = id === cur, can = has || hxCan(t.l, t.x);
      return `<div class="isitem ${on ? 'owned' : ''} ${!on && can ? 'canbuy' : ''}" ${!on && can ? `data-sky="theme" data-v="${id}" role="button" tabindex="0"` : ''}><div class="isitem-e">${t.e}</div><b>${t.n}</b>
        <div class="muted small-text">${id === 'natural' ? `Follows the real season: ${s.e} ${s.n} now` : t.d}</div>
        ${on ? '<span class="tag">In use</span>' : `<button class="btn small ${can ? 'primary' : ''}" data-sky="theme" data-v="${id}" ${can ? '' : 'disabled'}>${has ? 'Use' : hxCost(t.l, t.x)}</button>`}</div>`;
    }).join('')}</div>
    <p class="muted small-text">A look recolours the grass and trees. Your terraforming and decorations stay as they are, and switching back to a look you own is free.</p>
    <label class="row small-text"><input type="checkbox" data-sky="wx" ${D.settings.isWx !== false ? 'checked' : ''} ${hxLow() ? 'disabled' : ''}> Weather on the island (Melbourne${w ? `, now ${hxWxText(w).toLowerCase()} and ${w.t}°` : ''})${hxLow() ? ' · off with Low graphics' : ''}</label>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-sky]'); if (!el || el.dataset.sky !== 'theme') return;
  const st = hxState(), id = el.dataset.v, t = HX_THEMES[id]; if (!t) return;
  st.themes = st.themes || [];
  if (id !== 'natural' && !st.themes.includes(id)) {
    if (!hxCan(t.l, t.x)) return;
    if (!confirm(`Buy the ${t.n} look for ${hxCost(t.l, t.x)}? You keep it and can switch back any time for free.`)) return;
    ftTake(t.l, t.x); st.themes.push(id);
  }
  if (id === 'natural') delete st.theme; else st.theme = id;
  save(); HX3.sig = ''; if (typeof sfx === 'function') sfx('coin'); render(); toast(`${t.e} ${t.n}`, id === 'natural' ? 'Your island follows the real season again.' : 'Your island has its new look.');
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-sky="wx"]'); if (!el) return;
  D.settings.isWx = el.checked; save(); HX3.sig = ''; render();
});
