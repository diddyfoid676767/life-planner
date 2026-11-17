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
function hxLook(home = IS3.house === 'hex') { if (!home && IS3.house === 'hexh' && typeof sgHLook === 'function' && sgHLook()) return sgHLook(); const t = home && HX_THEMES[hxCur().theme]; return t && t.gr ? t : HX_SEASONS[hxSeason()]; } // 2.88: or the house's Stone fortress look

// ---------- recoloured textures ----------
// the pack's greens move towards the look's colours, keeping their light and shade: the yellow-greens
// of the grass towards gr, the blue-greens of the leaves towards lf (only the land's material uses this)
function hxThemeTex(look) {
  const K = HX3.kit, key = [look.gr, look.gs, look.lf, look.ls, 'br2'].join(); K.texs = K.texs || {};
  if (!K.base0) K.base0 = K.tex;
  if (K.texs[key]) return K.texs[key];
  const src = K.base0.image, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0);
  const px = cx.getImageData(0, 0, cv.width, cv.height), a = px.data, c = new THREE.Color();
  const G = look.gr && (c.set(look.gr), [c.r * 255, c.g * 255, c.b * 255]), F = look.lf && (c.set(look.lf), [c.r * 255, c.g * 255, c.b * 255]);
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // 2.78 (feedback F2): no more brown: the dirt and the island's sides move towards a warm, light sand
    if (mx === r && r > b + 28 && g > b && r < 215) { const L = (r * .3 + g * .59 + b * .11) / 120, k = .62; a[i] = r + (Math.min(255, 236 * L) - r) * k; a[i + 1] = g + (Math.min(255, 214 * L) - g) * k; a[i + 2] = b + (Math.min(255, 168 * L) - b) * k; continue; }
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
  const K = HX3.kit, tex = hxThemeTex(look || {}), m = K.matT || (K.matT = K.mat.clone());
  if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
}

// ---------- day and night ----------
// hours since midnight, sunrise and day length for Melbourne on this date (good to about 15 minutes)
function hxSunTimes(d = new Date()) {
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), len = 12.15 + 2.6 * Math.cos(2 * Math.PI * (doy - 355) / 365);
  const dst = d.getMonth() >= 9 || d.getMonth() <= 2 || (d.getMonth() === 3 && d.getDate() < 7), noon = dst ? 13.2 : 12.2;
  return { now: d.getHours() + d.getMinutes() / 60, rise: noon - len / 2, set: noon + len / 2, len };
}
// ---------- 2.85 the real sun (feedback round 2, R7) ----------
// Where the sun and moon really are over Melbourne right now, worked out from the date and time
// (the standard low-precision formulas, good to well under a degree; no network needed).
// The world's north is -z (the river side of your island is south). Altitudes and azimuths are in
// radians, azimuth from north going clockwise.
const HX_SUN = { fakeH: null };
const HX_RAD = Math.PI / 180;
// now, or the time picked on the Looks panel's slider (only for looking; it's never saved)
function hxNow() { const d = new Date(); if (HX_SUN.fakeH == null) return d; d.setHours(0, 0, 0, 0); return new Date(d.getTime() + HX_SUN.fakeH * 36e5); }
function hxAltAz(ra, dec, n) {
  const lst = ((280.46061837 + 360.98564736629 * n) % 360 + HX_MELB.lon) * HX_RAD, H = lst - ra, phi = HX_MELB.lat * HX_RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { alt, az: (az + 2 * Math.PI) % (2 * Math.PI), dec };
}
// the sun: also gives its ecliptic longitude (for the moon's phase) and today's highest altitude
function hxSunPos(d = hxNow()) {
  const n = d.getTime() / 864e5 + 2440587.5 - 2451545, g = (357.528 + .9856003 * n) * HX_RAD;
  const lam = (280.46 + .9856474 * n + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * HX_RAD, eps = (23.439 - 4e-7 * n) * HX_RAD;
  const p = hxAltAz(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), Math.asin(Math.sin(eps) * Math.sin(lam)), n);
  return { ...p, lam, noon: Math.PI / 2 - Math.abs(HX_MELB.lat * HX_RAD - p.dec) };
}
// the moon: position, how much of it is lit (0 new to 1 full) and whether it's growing
function hxMoonPos(d = hxNow()) {
  const n = d.getTime() / 864e5 + 2440587.5 - 2451545, M = (134.963 + 13.064993 * n) * HX_RAD, F = (93.272 + 13.22935 * n) * HX_RAD;
  const lon = (218.316 + 13.176396 * n) * HX_RAD + 6.289 * HX_RAD * Math.sin(M), lat = 5.128 * HX_RAD * Math.sin(F), eps = 23.4397 * HX_RAD;
  const ra = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)), dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon));
  const el = ((lon - hxSunPos(d).lam) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { ...hxAltAz(ra, dec, n), lit: (1 - Math.cos(el)) / 2, wax: el < Math.PI };
}
// a direction in the world for an altitude and azimuth
const hxDir = (alt, az, v = new THREE.Vector3()) => v.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
const hxCompass = az => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(az / (Math.PI / 4)) % 8];
// 1 = the sun at its highest today, 0 = sunrise/sunset, below 0 = night (down to -1 when it's 18° below)
function hxDaylight(d = hxNow()) {
  const s = hxSunPos(d), T = hxSunTimes(d);
  if (s.alt > -.0145) return { e: Math.max(0, Math.min(1, s.alt / s.noon)), p: Math.max(0, Math.min(1, (T.now - T.rise) / T.len)), day: true };
  return { e: -Math.min(1, -s.alt / (18 * HX_RAD)), p: .5, day: false };
}
const HX_SKY0 = {};
function hxSkyLights() {
  if (!HX_SKY0.hemi) { HX_SKY0.hemi = IS3.scene.children.find(o => o.isHemisphereLight); HX_SKY0.rim = IS3.scene.children.find(o => o.isDirectionalLight && o !== IS3.sun); HX_SKY0.sunC = IS3.sun.color.clone(); HX_SKY0.hemiC = HX_SKY0.hemi?.color.clone(); }
  return HX_SKY0;
}
// sets the light for now (called on every draw of a hex island and once a minute). The light comes
// from where the sun really is, so the shadows of every building, tree, villager and your hero move
// through the day; at night it comes from the moon when it's up.
function hxSkyApply() {
  if (!IS3.sun || !IS3.hexMode) return;
  if (HX_SUN.fakeH != null && !(ui.isPanel === 'looks' || ui.isPanel === 'market' && ui.mkTab === 'looks')) HX_SUN.fakeH = null; // the time slider is only for looking
  const L = hxSkyLights(), dl = hxDaylight(), wx = hxWxOn() ? HX_WX.cur : null, over = wx ? Math.min(1, (wx.cc || 0) / 100) * .35 + (wx.rain ? .2 : 0) : 0;
  const sun = IS3.sun, c = new THREE.Color(), now = hxNow(), sp = hxSunPos(now), mp = hxMoonPos(now), d = new THREE.Vector3();
  let night = 0;
  if (dl.day) {
    const gold = Math.max(0, 1 - dl.e * 3.2);
    hxDir(Math.max(sp.alt, 9 * HX_RAD), sp.az, d); // very low suns keep their direction but don't stretch shadows off the island
    sun.position.copy(d).multiplyScalar(60);
    sun.color.copy(HX_SKY0.sunC).lerp(c.set('#ffa25e'), gold * .75);
    sun.intensity = (.55 + .45 * Math.min(1, dl.e * 2.2)) * (1 - over);
    if (L.hemi) { L.hemi.intensity = (.5 + .25 * Math.min(1, dl.e * 2)) * (1 - over * .5); L.hemi.color.copy(HX_SKY0.hemiC).lerp(c.set('#ffd7b0'), gold * .3); }
  } else {
    night = Math.min(1, -dl.e * 4 + .35);
    const up = mp.alt > 2 * HX_RAD;
    if (up) sun.position.copy(hxDir(Math.max(mp.alt, 14 * HX_RAD), mp.az, d)).multiplyScalar(60); else sun.position.set(-16, 30, -12);
    sun.color.set('#a9bcff'); sun.intensity = (up ? .3 + .22 * mp.lit : .38) * (1 - over * .5);
    if (L.hemi) { L.hemi.intensity = .55; L.hemi.color.set('#97a5e0'); }
  }
  hxBackdrop(dl.day ? Math.min(1, dl.e * 3) : 0, over);
  if (HX3.lampMat) HX3.lampMat.emissiveIntensity = .25 + night * 1.6;
  if (HX3.nightG) { HX3.nightG.visible = night > .05; HX3.nightG.children.forEach(o => { if (o.material) o.material.opacity = (o.userData.op || 1) * Math.min(1, night * 1.3); }); }
  HX3.night = night;
  Object.assign(HX_SUN, { sp, mp, over, night, rain: !!wx?.rain });
  hxSunLook();
  hxEnvSoon();
}

// the sun and moon you can see: sprites far out along their real direction. Fixed in the world:
// turn the view to find the sun; it's in the north at midday.
function hxSunTex() {
  if (HX_SUN.tex) return HX_SUN.tex;
  const mk = (stops, n = 128) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, n, n); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  return (HX_SUN.tex = {
    disc: mk([[0, 'rgba(255,255,250,1)'], [.36, 'rgba(255,250,225,1)'], [.44, 'rgba(255,226,150,.85)'], [.6, 'rgba(255,200,110,.25)'], [1, 'rgba(255,180,80,0)']]),
    glow: mk([[0, 'rgba(255,236,190,.55)'], [.2, 'rgba(255,214,150,.22)'], [.5, 'rgba(255,190,120,.07)'], [1, 'rgba(255,170,90,0)']], 256),
    mglow: mk([[0, 'rgba(210,225,255,.4)'], [.3, 'rgba(190,205,255,.12)'], [1, 'rgba(170,190,255,0)']]),
  });
}
// the moon's face for its phase: the lit side is drawn on the right and the sprite is turned towards the sun
function hxMoonTex(lit) {
  const k = Math.round(lit * 40) / 40; if (HX_SUN.moonK === k && HX_SUN.moonT) return HX_SUN.moonT;
  const n = 128, r = 54, cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'), c = n / 2;
  x.fillStyle = 'rgba(70,80,120,.35)'; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill(); // the dark side, faintly
  const lc = document.createElement('canvas'); lc.width = lc.height = n; const y = lc.getContext('2d');
  y.fillStyle = '#f4f1e6'; y.beginPath(); y.arc(c, c, r, -Math.PI / 2, Math.PI / 2); y.fill(); // the lit half
  const w = r * Math.abs(1 - 2 * k);
  y.globalCompositeOperation = k > .5 ? 'source-over' : 'destination-out';
  y.beginPath(); y.ellipse(c, c, Math.max(.01, w), r, 0, 0, Math.PI * 2); y.fill();
  y.globalCompositeOperation = 'source-atop'; y.fillStyle = 'rgba(150,150,140,.35)'; // a few seas
  for (const [a, b, s] of [[-14, -16, 13], [12, -6, 10], [-4, 14, 15], [18, 20, 7], [-22, 8, 8]]) { y.beginPath(); y.arc(c + a, c + b, s, 0, Math.PI * 2); y.fill(); }
  x.drawImage(lc, 0, 0);
  if (HX_SUN.moonT) HX_SUN.moonT.dispose();
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; HX_SUN.moonK = k;
  return (HX_SUN.moonT = t);
}
function hxSunObjs() {
  if (HX_SUN.g || !IS3.scene) return HX_SUN.g;
  const T = hxSunTex(), sp = (map, add = true) => new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const g = HX_SUN.g = new THREE.Group(); g.name = 'hxSun';
  HX_SUN.disc = sp(T.disc, false); HX_SUN.glow = sp(T.glow, false); HX_SUN.moon = sp(hxMoonTex(.5), false); HX_SUN.mglow = sp(T.mglow);
  for (const o of [HX_SUN.glow, HX_SUN.disc, HX_SUN.mglow, HX_SUN.moon]) { o.renderOrder = -5; o.frustumCulled = false; g.add(o); }
  IS3.scene.add(g); return g;
}
// colour and brightness for now (called from hxSkyApply)
function hxSunLook() {
  if (!hxSunObjs()) return;
  const { sp, mp, over, rain } = HX_SUN, hi = hxGfx() === 'high', c = new THREE.Color();
  const sunUp = Math.max(0, Math.min(1, (sp.alt + 1.5 * HX_RAD) / (4 * HX_RAD))), low = Math.max(0, 1 - sp.alt / (18 * HX_RAD)), cloud = rain ? .12 : 1 - over * 1.6;
  HX_SUN.disc.material.color.copy(c.set('#fffaf0').lerp(new THREE.Color('#ff9a4a'), Math.min(1, low * .85)));
  HX_SUN.disc.material.opacity = sunUp * Math.max(.15, cloud);
  HX_SUN.glow.material.color.set(low > .6 ? '#ffb070' : '#fff0d0'); HX_SUN.glow.material.opacity = hi ? sunUp * Math.max(.1, cloud) * (.8 + low * .5) : 0;
  HX_SUN.glow.visible = hi;
  const moonUp = Math.max(0, Math.min(1, (mp.alt + 1 * HX_RAD) / (4 * HX_RAD))) * Math.max(.25, 1 - Math.max(0, sp.alt + 6 * HX_RAD) / (12 * HX_RAD) * .7);
  const mt = hxMoonTex(mp.lit); if (HX_SUN.moon.material.map !== mt) { HX_SUN.moon.material.map = mt; HX_SUN.moon.material.needsUpdate = true; }
  HX_SUN.moon.material.opacity = moonUp * Math.max(.3, cloud); HX_SUN.mglow.material.opacity = moonUp * Math.max(.2, cloud) * (.3 + mp.lit * .7) * (sp.alt < 0 ? 1 : .3); HX_SUN.mglow.visible = hi;
  // stars come out as the sky darkens
  const st = IS3.scene.children.find(o => o.isPoints);
  if (st) { st.material.transparent = true; st.material.opacity = Math.min(1, HX3.night * 1.2) * (rain ? .2 : 1 - over * .9); }
}
// places them for this camera (called from is3draw just before each frame)
function hxSkyCam(cam) {
  const g = HX_SUN.g; if (!g) return;
  const on = !!IS3.hexMode && (IS3.house === 'hex' || IS3.house === 'hexh') && hxGfx() !== 'low' && !!HX_SUN.sp;
  g.visible = on; if (!on) return;
  // 2.90: they sit at a fixed place in the world (the real compass direction, with the height squeezed into
  // a band just below the horizon, so they show in the sky behind the island when the view is tilted up enough). They
  // no longer follow the camera: turning the view moves them across the screen like anything else out there.
  const c0 = HX_SUN.v1 || (HX_SUN.v1 = new THREE.Vector3()); c0.set(IS3.tgt?.[0] || 0, 0, IS3.tgt?.[1] || 0);
  const put = (alt, az, objs, size) => {
    const a = (-22 + 12 * Math.min(1, Math.max(-.2, alt) / .9)) * HX_RAD, v = hxDir(a, az, HX_SUN.v2 || (HX_SUN.v2 = new THREE.Vector3()));
    objs.forEach(([o, s]) => { o.position.copy(c0).addScaledVector(v, 250); o.scale.setScalar(size * s); });
    return v;
  };
  put(HX_SUN.sp.alt, HX_SUN.sp.az, [[HX_SUN.disc, 1], [HX_SUN.glow, 5.5]], 17);
  const mv = put(HX_SUN.mp.alt, HX_SUN.mp.az, [[HX_SUN.moon, 1], [HX_SUN.mglow, 3]], 12).clone();
  // turn the moon's lit side towards the sun, as it is seen from this camera
  const sd = hxDir(HX_SUN.sp.alt, HX_SUN.sp.az).sub(hxDir(HX_SUN.mp.alt, HX_SUN.mp.az)), q = cam.quaternion;
  const rx = new THREE.Vector3(1, 0, 0).applyQuaternion(q), ry = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  HX_SUN.moon.material.rotation = Math.atan2(sd.dot(ry), sd.dot(rx));
}

// water that reflects: the sky, the sun and (on High) the buildings around it, with a glint where
// the sun catches the ripples. One snapshot of the world all round the middle of the island is
// taken when something changes (and once a minute as the sun moves), not every frame.
function hxWaterMat() {
  const K = HX3.kit; if (!K || hxGfx() === 'low') return null;
  const base = K.matT || (K.matT = K.mat.clone());
  if (!K.matW) {
    HX3.uT = HX3.uT || { value: 0 }; HX_SUN.envK = HX_SUN.envK || { value: 1.6 }; HX_SUN.rip = HX_SUN.rip || { value: 1 };
    const m = K.matW = base.clone();
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uT: HX3.uT, envK: HX_SUN.envK, uRip: HX_SUN.rip });
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uT;\nuniform float envK;\nuniform float uRip;\nvarying vec3 vWP;\n' + sh.fragmentShader
        .replace('#include <envmap_common_pars_fragment>', THREE.ShaderChunk.envmap_common_pars_fragment.replace('uniform float envMapIntensity;', 'float envMapIntensity;'))
        .replace('#include <map_fragment>', `#include <map_fragment>
          float wM = step(.15, vUv.x) * step(vUv.x, .225) * step(.26, vUv.y) * step(vUv.y, .475); // the water in the pack's texture
          envMapIntensity = envK * wM; diffuseColor.rgb *= 1.0 - .35 * wM;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .06, wM);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, .25, wM);')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          if (wM > .5 && uRip > .5) {
            vec3 rp = vec3(sin(vWP.x * 2.3 + uT * 1.3) + .6 * sin(vWP.z * 3.7 - uT * 1.9 + vWP.x), 0.0, cos(vWP.z * 2.1 - uT * 1.1) + .6 * cos(vWP.x * 3.3 + uT * 1.6)) * .045;
            normal = normalize(normal + (viewMatrix * vec4(rp, 0.0)).xyz);
          }`);
    };
    m.customProgramCacheKey = () => 'hxWater';
  }
  if (K.matW.map !== base.map) { K.matW.map = base.map; K.matW.needsUpdate = true; }
  return K.matW;
}
function hxEnvSoon() { clearTimeout(HX_SUN.envT); HX_SUN.envT = setTimeout(hxEnvCapture, 220); }
function hxEnvCapture() {
  const g = hxGfx(), K = HX3.kit, R = IS3.R, S = IS3.scene;
  if (g === 'low' || !K?.matW || !R || !S || !IS3.hexMode || !HX_SUN.sp || !IS3.canvas?.isConnected) return;
  const sig = [HX3.sig, g, Math.round(HX_SUN.sp.alt * 60), Math.round(HX_SUN.sp.az * 60), Math.round(HX_SUN.mp.alt * 30), Math.round(HX_SUN.over * 10)].join('|');
  if (sig === HX_SUN.envSig && K.matW.envMap) return;
  const n = g === 'high' ? 256 : 64;
  if (HX_SUN.cubeN !== n) { HX_SUN.crt?.dispose(); HX_SUN.crt = new THREE.WebGLCubeRenderTarget(n); HX_SUN.crt.texture.encoding = THREE.sRGBEncoding; HX_SUN.cube = new THREE.CubeCamera(.3, 400, HX_SUN.crt); HX_SUN.cubeN = n; }
  const cube = HX_SUN.cube, P = new THREE.Vector3(0, 2.4, 0); cube.position.copy(P); cube.updateMatrixWorld(true);
  // what's seen: a plain sky colour for the time of day, the true sun and moon, and on High the island itself
  const keep = { bg: S.background, wv: IS3.world.visible, wx: HX3.wx?.o.visible, gh: HX3.ghost?.visible, ig: IS3.ghost.visible };
  const day = HX_SUN.sp.alt > 0, gold = day && HX_SUN.sp.alt < 12 * HX_RAD;
  S.background = new THREE.Color(!day ? (HX_SUN.sp.alt > -6 * HX_RAD ? '#4a3c6e' : '#121530') : HX_SUN.over > .2 ? '#aab9c6' : gold ? '#f0a46e' : '#7cc0f2');
  if (g !== 'high') IS3.world.visible = false;
  if (HX3.wx) HX3.wx.o.visible = false; if (HX3.ghost) HX3.ghost.visible = false; IS3.ghost.visible = false;
  const gv = HX_SUN.g.visible; HX_SUN.g.visible = true;
  for (const [o, s, alt, az] of [[HX_SUN.disc, 22, HX_SUN.sp.alt, HX_SUN.sp.az], [HX_SUN.glow, 80, HX_SUN.sp.alt, HX_SUN.sp.az], [HX_SUN.moon, 12, HX_SUN.mp.alt, HX_SUN.mp.az], [HX_SUN.mglow, 30, HX_SUN.mp.alt, HX_SUN.mp.az]]) { o.position.copy(P).addScaledVector(hxDir(alt, az), 150); o.scale.setScalar(s); }
  try { cube.update(R, S); } finally {
    S.background = keep.bg; IS3.world.visible = keep.wv; if (HX3.wx) HX3.wx.o.visible = keep.wx; if (HX3.ghost) HX3.ghost.visible = keep.gh; IS3.ghost.visible = keep.ig; HX_SUN.g.visible = gv;
  }
  HX_SUN.pm = HX_SUN.pm || new THREE.PMREMGenerator(R);
  const had = !!K.matW.envMap; HX_SUN.env = HX_SUN.pm.fromCubemap(HX_SUN.crt.texture, HX_SUN.env);
  K.matW.envMap = HX_SUN.env.texture; if (!had) K.matW.needsUpdate = true;
  HX_SUN.envK.value = day ? 1.7 : .9; HX_SUN.rip.value = g === 'high' ? 1 : 0; HX_SUN.envSig = sig;
  is3draw();
}
// 2.78 (feedback F2): the sky follows the menu style: a bright storybook sky by day (style A),
// a lantern dusk with stars at night (style C). day = 0 (night) to 1 (full day)
const HX_BG = {};
function hxBgTex(stops) { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256; const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 16, 256); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; }
function hxBackdrop(day, over = 0) {
  const S = IS3.scene; if (!S) return;
  if (!HX_BG.night) { HX_BG.night = S.background; HX_BG.day = hxBgTex([[0, '#3f93e6'], [.55, '#86c4f2'], [1, '#d4ecfb']]); HX_BG.day.userData.tm = 1; HX_BG.dusk = hxBgTex([[0, '#2a2754'], [.55, '#4a3f72'], [1, '#8a5f7e']]); HX_BG.grey = hxBgTex([[0, '#9fb3c4'], [.6, '#c9d5df'], [1, '#e4eaf0']]); HX_BG.gold = hxBgTex([[0, '#6f86c9'], [.5, '#e6a3a0'], [1, '#ffd09a']]); }
  const gold = day > 0 && day <= .45 && hxGfx() !== 'low' && over < .3, want = gold ? HX_BG.gold : day > .25 ? (over > .2 ? HX_BG.grey : HX_BG.day) : HX_BG.dusk; // 2.85: a golden sky around sunrise and sunset
  if (S.background !== want) S.background = want;
  for (const o of S.children) if (o.isPoints || (o.isMesh && o.material?.opacity === .07)) o.visible = day <= .25;
}
// puts the boss island's lighting back
function hxSkyReset() {
  if (HX_BG.night && IS3.scene) { IS3.scene.background = HX_BG.night; for (const o of IS3.scene.children) if (o.isPoints || (o.isMesh && o.material?.opacity === .07)) o.visible = true; }
  if (HX_SUN.g) HX_SUN.g.visible = false;
  const st = IS3.scene?.children.find(o => o.isPoints); if (st) st.material.opacity = 1;
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
  W0.free.forEach(f => { if (f.id === 'hall' && !W0.home || !f.at) return; const [x, z] = hxPos(...hxQR(f.at)); lantern(x - .75, z + .85); });
  for (const [k, s] of Object.entries(st.b)) { const it = W0.item(s.id); if (!it || it.wall || it.field || it.hz > 1) continue; const [x, z] = hxPos(...hxQR(k)); lantern(x - .8, z + .75, hxHt(k, st)); }
  if (typeof tfGlows === 'function') for (const [x, y, z, s] of tfGlows(st)) glow(x, y, z, s); // 2.82: lamps, lamp lines and campfires
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
  const pv = st.pvTheme && HX_THEMES[st.theme] ? HX_THEMES[st.theme] : null;
  return `${pv ? `<div class="hxpv"><b>👁 Previewing ${pv.e} ${pv.n}</b> · free until you keep it<div class="row" style="gap:8px;margin-top:6px"><button class="btn small primary" data-sky="theme" data-v="${st.theme}" ${hxCan(pv.l, pv.x) ? '' : 'disabled'}>✔ Keep · ${hxCost(pv.l, pv.x)}</button><button class="btn small ghost" data-sky="stoppv">✖ Stop preview</button></div></div>` : ''}<p class="muted small-text">Your island's light follows the real time of day (sunrise about ${hm(T.rise)}, sunset about ${hm(T.set)}), and lamps and lanterns glow at night. ${dl.day ? '' : '🌙 It\'s night now.'}</p>
    ${hxSunHtml()}
    <div class="isshop">${Object.entries(HX_THEMES).map(([id, t]) => {
      const has = id === 'natural' || own.includes(id), on = id === cur, can = has || hxCan(t.l, t.x);
      return `<div class="isitem ${on ? 'owned' : ''} ${!on && can ? 'canbuy' : ''}" ${!on && can ? `data-sky="theme" data-v="${id}" role="button" tabindex="0"` : ''}><div class="isitem-e">${t.e}</div><b>${t.n}</b>
        <div class="muted small-text">${id === 'natural' ? `Follows the real season: ${s.e} ${s.n} now` : t.d}</div>
        ${on ? '<span class="tag">In use</span>' : `<button class="btn small ${can ? 'primary' : ''}" data-sky="theme" data-v="${id}" ${can ? '' : 'disabled'}>${has ? 'Use' : hxCost(t.l, t.x)}</button>${has ? '' : `<button class="btn small ghost" data-sky="preview" data-v="${id}" title="See it on your island for free">👁 Preview</button>`}`}</div>`;
    }).join('')}</div>
    <p class="muted small-text">A look recolours the grass and trees. Your terraforming and decorations stay as they are, and switching back to a look you own is free.</p>
    <label class="row small-text"><input type="checkbox" data-sky="wx" ${D.settings.isWx !== false ? 'checked' : ''} ${hxLow() ? 'disabled' : ''}> Weather on the island (Melbourne${w ? `, now ${hxWxText(w).toLowerCase()} and ${w.t}°` : ''})${hxLow() ? ' · off with Low graphics' : ''}</label>`;
}
// 2.85: where the sun and moon are, and a slider to see the island at any time of day (only for looking)
function hxSunHtml() {
  const g = hxGfx(), n = hxNow(), sp = hxSunPos(n), mp = hxMoonPos(n), deg = a => Math.round(a / HX_RAD);
  const where = sp.alt > 0 ? `☀️ The sun is in the ${hxCompass(sp.az)}, ${deg(sp.alt)}° up.` : mp.alt > 0 ? `🌙 The moon is in the ${hxCompass(mp.az)}, ${deg(mp.alt)}° up, ${Math.round(mp.lit * 100)}% lit.` : '🌌 The sun and moon are both down.';
  const h = HX_SUN.fakeH ?? (n.getHours() + n.getMinutes() / 60), hm = h => { const H = Math.floor(h) % 24, M = Math.floor((h - Math.floor(h)) * 60); return `${(H + 11) % 12 + 1}:${String(M).padStart(2, '0')}${H < 12 ? 'am' : 'pm'}`; };
  return `<div class="hxsun"><p class="small-text">${where} ${g === 'low' ? 'Switch Graphics to Medium or High in Settings to see it, with moving shadows and water that reflects.' : 'Turn the view to find it, and watch the shadows move through the day.'}</p>
    ${g === 'low' ? '' : `<label class="row small-text" style="gap:8px">See a time of day <input type="range" min="0" max="23.75" step=".25" value="${h.toFixed(2)}" data-sky="time" style="flex:1"> <b data-sky-t>${hm(h)}</b>${HX_SUN.fakeH != null ? ' <button class="btn small ghost" data-sky="now">Back to now</button>' : ''}</label>
    <div class="row" style="gap:8px;margin-top:6px"><button class="btn small ghost" data-sky="find" data-v="sun">☀️ Look at the sun</button><button class="btn small ghost" data-sky="find" data-v="moon">🌙 Look at the moon</button></div>`}</div>`;
}
// 2.77: look a look over on your island for free; it never survives leaving the panel or a restart
function hxPvStop(quiet) {
  const st = hxState(); if (!st.pvTheme) return;
  if (st.pvTheme.was) st.theme = st.pvTheme.was; else delete st.theme;
  delete st.pvTheme; HX3.sig = ''; if (!quiet) { save(); render(); }
}
document.addEventListener('click', e => {
  const pe = e.target.closest('[data-sky="preview"],[data-sky="stoppv"]');
  if (pe) {
    const st = hxState();
    if (pe.dataset.sky === 'stoppv') hxPvStop();
    else if (HX_THEMES[pe.dataset.v]) { if (!st.pvTheme) st.pvTheme = { was: st.theme || '' }; st.theme = pe.dataset.v; HX3.sig = ''; if (typeof sfx === 'function') sfx('select'); render(); }
    return;
  }
  const el = e.target.closest('[data-sky]'); if (!el || el.dataset.sky !== 'theme') return;
  const st = hxState(), id = el.dataset.v, t = HX_THEMES[id]; if (!t) return;
  st.themes = st.themes || [];
  if (id !== 'natural' && !st.themes.includes(id)) {
    if (!hxCan(t.l, t.x)) return;
    if (!confirm(`Buy the ${t.n} look for ${hxCost(t.l, t.x)}? You keep it and can switch back any time for free.`)) return;
    ftTake(t.l, t.x); st.themes.push(id);
  }
  delete st.pvTheme; // keeping or picking a look ends any preview
  if (id === 'natural') delete st.theme; else st.theme = id;
  save(); HX3.sig = ''; if (typeof sfx === 'function') sfx('coin'); render(); toast(`${t.e} ${t.n}`, id === 'natural' ? 'Your island follows the real season again.' : 'Your island has its new look.');
});
document.addEventListener('input', e => {
  const el = e.target.closest?.('[data-sky="time"]'); if (!el) return;
  HX_SUN.fakeH = +el.value; const t = el.parentNode.querySelector('[data-sky-t]'); if (t) { const H = Math.floor(HX_SUN.fakeH), M = Math.round((HX_SUN.fakeH - H) * 60); t.textContent = `${(H + 11) % 12 + 1}:${String(M).padStart(2, '0')}${H < 12 ? 'am' : 'pm'}`; }
  hxSkyApply(); is3draw();
});
// 2.93: turns the view to face the sun or moon, tilted up so it shows over the island
document.addEventListener('click', e => {
  const f = e.target.closest?.('[data-sky="find"]'); if (!f || !HX_SUN.sp || typeof hxTweenTo !== 'function') return;
  const o = f.dataset.v === 'moon' ? HX_SUN.mp : HX_SUN.sp; hxTweenTo({ yaw: -o.az, pitch: .3 });
});
document.addEventListener('click', e => { if (e.target.closest?.('[data-sky="now"]')) { HX_SUN.fakeH = null; hxSkyApply(); render(); } });
document.addEventListener('change', e => {
  const el = e.target.closest('[data-sky="wx"]'); if (!el) return;
  D.settings.isWx = el.checked; save(); HX3.sig = ''; render();
});
