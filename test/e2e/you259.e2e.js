// 2.59: the full-screen You page, cosmetics over gear, cosmetic prices, theme backgrounds, Settings tidy-up and the sports log on Fitness.
// Usage: build the app into DIR/LifePlanner with a planner in DIR/data, then: node test/e2e/you259.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  try { fs.unlinkSync(S + '/data/window.key'); } catch { }
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47914' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47914/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); ui.clsSeen = true; window.celebrate = () => { }; document.querySelectorAll('.boxfx').forEach(e => e.remove()); });
  const av0 = await p.evaluate(() => JSON.stringify(D.arena.av || {})), set0 = await p.evaluate(() => JSON.stringify({ bg: D.settings.themeBg, hide: D.settings.avHideGear }));

  // 1. the Character tab is a full-screen stage: avatar in the middle, equipment left, build and stats right
  await p.evaluate(() => { view = 'profile'; ui.youTab = 'me'; ui.youLook = false; ui.gearSlot = ''; render(); });
  await p.waitForFunction(() => AV3.fig, null, { timeout: 20000 }); await sleep(600);
  const L = await p.evaluate(() => { const r = s => document.querySelector(s)?.getBoundingClientRect(); return { full: r('.youfull'), left: r('.yleft'), right: r('.yright'), stage: r('#av3host'), slots: document.querySelectorAll('.yleft .ygslot').length, stats: !!document.querySelector('.yright .ystats .yovr'), build: document.querySelectorAll('.yright .ybslot').length, vh: innerHeight }; });
  ok(L.full && L.full.height > L.vh * .85, `1. the stage fills the window (${Math.round(L.full?.height)} of ${L.vh})`);
  ok(L.slots === 6 && L.left.right < L.full.left + L.full.width / 2, '1b. the 6 equipment slots are down the left');
  ok(L.stats && L.build >= 6 && L.right.left > L.full.left + L.full.width / 2, '1c. stats and the build (spells, moves) are down the right');
  ok(L.stage.width > L.full.width * .9 && L.stage.height > L.full.height * .9, '1d. the 3D avatar gets the whole stage');
  // the avatar is big: its head-to-toe height on screen
  const hgt = await p.evaluate(() => { const b = new THREE.Box3().setFromObject(AV3.fig.userData.P.head); const t = b.max.clone().project(AV3.cam), f = new THREE.Vector3(0, 0, 0).project(AV3.cam); return (t.y - f.y) / 2; });
  ok(hgt > .6, `1e. the avatar fills most of the stage height (${Math.round(hgt * 100)}%)`);
  // 2. cosmetics are tucked under the avatar and open as a drawer
  ok(!(await p.$('.ylook')), '2. the cosmetics drawer is closed at first');
  await p.click('.ybtns [data-pf="look"]'); await sleep(500);
  const dr = await p.evaluate(() => { const d = document.querySelector('.ylook')?.getBoundingClientRect(), st = document.querySelector('.ystage').getBoundingClientRect(), f = document.querySelector('.youfull').getBoundingClientRect(); return { d, st, f }; });
  ok(dr.d && dr.d.top > dr.f.top + dr.f.height * .45 && dr.st.bottom <= dr.d.top + 20, '2b. Customise opens a drawer under the avatar and the avatar moves up above it');
  await p.click('.ybtns [data-pf="shop"]'); await sleep(400);
  ok(await p.evaluate(() => ui.pfCat === 'shop' && document.querySelectorAll('.ylook .shopitem').length === 6), '2c. Shop opens the weekly shop in the same drawer');
  await p.click('.ylook-h [data-pf="lookclose"]'); await sleep(300);
  ok(!(await p.$('.ylook')), '2d. ✕ closes it');

  // 3. cosmetics show on the avatar, over gear in the same place
  const st = await p.evaluate(() => { const s = ftState(); s.gear.push({ id: 'y1', slot: 'head', n: 'Rare Helm', e: '🪖', r: 'rare', b: { dr: .05 } }, { id: 'y2', slot: 'chest', n: 'Rare Hoodie', e: '🧥', r: 'rare', b: { hp: 10 } }); s.wear.head = 'y1'; s.wear.chest = 'y2'; D.arena.owned = { ...(D.arena.owned || {}), hat_crown: 'x', kit_red: 'x' }; D.arena.av = { ...myAv(), hat: 'hat_none', kit: 'kit_gear' }; D.settings.avHideGear = false; render(); return true; });
  await sleep(700);
  const meshCol = () => p.evaluate(() => { const cols = new Set(); AV3.fig.traverse(o => { if (o.isMesh && o.material.color) cols.add(o.material.color.getHexString()); }); return [...cols]; });
  const helmOn = () => p.evaluate(() => { let n = 0; AV3.fig.userData.P.head.traverse(o => { if (o.isMesh && o.geometry.parameters?.phiLength && o.geometry.parameters.radius > .44) n++; }); return n > 0; });
  ok(await helmOn(), '3. with no hat picked, the helm you wear shows');
  await p.evaluate(() => { wearCos('hat_crown'); }); await sleep(700);
  const crown = await p.evaluate(() => { let n = 0; AV3.fig.userData.P.head.traverse(o => { if (o.isMesh && o.geometry.type === 'ConeGeometry') n++; }); return n; });
  ok(crown >= 5 && !(await helmOn()), `3b. picking a hat shows the hat instead of the helm (${crown} crown points)`);
  await p.evaluate(() => { wearCos('kit_red'); }); await sleep(700);
  ok((await meshCol()).some(c => c.startsWith('c9') || c.startsWith('d1') || c.startsWith('e0') || c.startsWith('b')) && await p.evaluate(() => JSON.parse(document.getElementById('av3host').dataset.av).spec.kit === 'kit_red'), '3c. a picked kit colour shows instead of the hoodie');
  // previewing gear always shows it
  await p.evaluate(() => { ftState().gear.push({ id: 'y3', slot: 'head', n: 'Common Helm', e: '🪖', r: 'common', b: { dr: .03 } }); ui.gearSlot = 'head'; render(); }); await sleep(300);
  await p.click('[data-ft="try"][data-id="y3"]'); await sleep(700);
  ok(await p.evaluate(() => JSON.parse(document.getElementById('av3host').dataset.av).force === 'Helm') && await helmOn(), '3d. previewing a helm shows it even over your hat');
  await p.evaluate(() => { ui.gearTry = null; ui.gearSlot = ''; render(); }); await sleep(300);
  // hide gear
  await p.evaluate(() => { D.arena.av = { ...myAv(), hat: 'hat_none' }; render(); }); await sleep(500);
  await p.click('.ytoggle input'); await sleep(700);
  ok(await p.evaluate(() => D.settings.avHideGear && Object.keys(JSON.parse(document.getElementById('av3host').dataset.av).gear).length === 0) && !(await helmOn()), '3e. "Hide gear on my avatar" takes gear off the model');
  await p.click('.ytoggle input'); await sleep(500);
  // the background cosmetic shows behind the 3D avatar (the canvas is see-through)
  await p.evaluate(() => { D.arena.owned.bg_galaxy = 'x'; wearCos('bg_galaxy'); }); await sleep(600);
  const bgs = await p.evaluate(() => ({ css: getComputedStyle(document.querySelector('.youfull')).backgroundImage, sky: AV3.S.background, alpha: AV3.R.getContext().getContextAttributes().alpha }));
  ok(/gradient/.test(bgs.css) && bgs.sky === null && bgs.alpha, '3f. your background cosmetic shows behind the 3D avatar');

  // 4. no clipping: hats, bands and visors sit outside the hair and face
  const clip = await p.evaluate(() => {
    const bad = [];
    const build = sp => { const f = av3figure({ ...avatarSpec(), ...sp }, {}, ''); f.updateMatrixWorld(true); return f; };
    for (const hair of ['h_short', 'h_long', 'h_afro', 'h_curly', 'h_bob']) for (const hat of ['hat_band', 'hat_ninja']) {
      const f = build({ hair, hat, eyes: 'eye_none' }), P = f.userData.P; let band = null; P.head.children.forEach(m => { if (m.geometry?.type === 'TorusGeometry' && m.geometry.parameters.tube >= .045) band = band || m; });
      const front = new THREE.Box3().setFromObject(band).min.y - P.head.getWorldPosition(new THREE.Vector3()).y; if (front < .05) bad.push(`${hat} on ${hair} covers the eyes (${front.toFixed(2)})`);
    }
    for (const eyes of ['eye_sport', 'eye_visor', 'eye_titan']) {
      const f = build({ hair: 'h_short', hat: 'hat_none', eyes }), P = f.userData.P; let v = null; P.head.children.forEach(m => { if (m.geometry?.type === 'CylinderGeometry' && m.geometry.parameters.openEnded) v = m; });
      if (v.geometry.parameters.radiusTop < AV3_STYLE.headR * 1.2) bad.push(eyes + ' is too tight: eyes poke through');
    }
    // long hair is drawn facing out (not as a black outline) and stays off the shoulders
    for (const hair of ['h_long', 'h_wavy', 'h_flow', 'h_mullet', 'h_wolf']) {
      const f = build({ hair, hat: 'hat_none' }); let ok = false; f.userData.P.head.traverse(m => { if (m.geometry?.type === 'LatheGeometry') { const pos = m.geometry.attributes.position; ok = pos.getY(0) < pos.getY(pos.count - 1); } }); if (!ok) bad.push(hair + ' back hair faces inwards');
    }
    // caps: the peak sits on the rim, not through the crown
    for (const hat of ['hat_cap', 'hat_snap', 'hat_beta']) { const f = build({ hair: 'h_short', hat }); let peak = null; f.userData.P.head.children.forEach(m => { if (m.geometry?.type === 'CylinderGeometry' && m.geometry.parameters.height < .04) peak = m; }); if (!peak || peak.position.y > .12) bad.push(hat + ' peak cuts through the crown'); }
    // a hat makes the hair cap tight so the two never fight
    { const f = build({ hair: 'h_short', hat: 'hat_bandana' }); let hairR = 0; f.userData.P.head.children.forEach(m => { if (m.geometry?.type === 'SphereGeometry' && m.geometry.parameters.thetaLength < 3 && m.material.color.getHexString() !== 'c92a2a') hairR = Math.max(hairR, m.geometry.parameters.radius); }); if (hairR > AV3_STYLE.headR * 1.05) bad.push('hair pokes through the bandana'); }
    return bad;
  });
  ok(clip.length === 0, '4. hats, bands, visors, caps and long hair don\'t clip: ' + clip.join('; '));

  // 5. cosmetics cost a little, by rarity; a starter set of commons is free
  const pr = await p.evaluate(() => {
    const priced = COSMETICS.filter(c => c.price), free = COSMETICS.filter(c => !c.price && !c.req?.badge && c.cat !== 'skin' && !/_none$/.test(c.id));
    const bands = { common: [30, 60], rare: [100, 160], epic: [250, 350], legendary: [600, 800] };
    const inBand = priced.every(c => { const v = c.price.l || c.price.e, [lo, hi] = bands[c.rar]; return v >= lo && v <= hi; });
    const rars = new Set(priced.map(c => c.rar));
    return { priced: priced.length, all: COSMETICS.length, free: free.length, inBand, rars: rars.size, skins: COSMETICS.filter(c => c.cat === 'skin').every(c => !c.price), cats: new Set(free.map(c => c.cat)).size };
  });
  ok(pr.priced > pr.all / 2, `5. most looks have a price (${pr.priced} of ${pr.all})`);
  ok(pr.inBand && pr.rars === 4, '5b. prices are cheap and set by rarity (common 30-60 up to legendary 600-800)');
  ok(pr.free >= 30 && pr.cats >= 7 && pr.skins, `5c. a starter set is free (${pr.free} looks across ${pr.cats} kinds, every skin tone)`);
  const gf = await p.evaluate(() => { const d = { arena: { av: { hat: 'hat_crown', extra: 'x_wings', hair: 'h_short' }, owned: {} } }; cosGrandfather(d); return !!d.arena.owned.hat_crown && !!d.arena.owned.x_wings && !d.arena.owned.h_short && d.arena.cosV2 === 1; });
  ok(gf, '5d. looks you were already wearing stay yours');
  const grid = await p.evaluate(() => { ui.youLook = true; ui.pfCat = 'extra'; render(); const it = document.querySelector('.ylook .pfitem.locked[data-rar]'); return it ? { rar: !!it.querySelector('.pfrar'), price: !!it.querySelector('.pfprice') } : null; });
  ok(grid && grid.rar && grid.price, '5e. locked looks show their rarity and price in the drawer');
  await p.evaluate(() => { ui.youLook = false; render(); });

  // 6. theme backgrounds show again (the moving aurora moves)
  await p.evaluate(() => { D.settings.themeBg = 'aurora'; applyTheme(); view = 'today'; render(); }); await sleep(400);
  const au = await p.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, anim: getComputedStyle(document.body, '::before').animationName, img: getComputedStyle(document.body, '::before').backgroundImage }));
  ok(au.body === 'rgba(0, 0, 0, 0)' && au.anim === 'aurora' && /radial/.test(au.img), '6. the moving aurora background shows and moves');
  await p.evaluate(() => { D.settings.themeBg = 'mesh'; applyTheme(); }); await sleep(200);
  ok(/radial/.test(await p.evaluate(() => getComputedStyle(document.body).backgroundImage)), '6b. the mesh background shows');
  await p.evaluate(() => { D.settings.themeBg = 'stars'; applyTheme(); }); await sleep(200);
  ok(await p.evaluate(() => getComputedStyle(document.body, '::before').animationName === 'bgTwinkle'), '6c. the starry night twinkles');

  // 7. Settings: no You | Settings tabs above it, and the update buttons at the top
  await p.evaluate(() => { view = 'settings'; ui.setTab = 'app'; render(); }); await sleep(400);
  ok(await p.evaluate(() => document.getElementById('subnav').hidden && !document.querySelector('.settabs').textContent.includes('You &')), '7. Settings has no You tab above it');
  for (const t of ['you', 'look', 'cal']) { await p.evaluate(t => { ui.setTab = t; render(); }, t); await sleep(150); ok(await p.evaluate(() => !!document.querySelector('.page-head .setupd [data-act="checkUpdateNow"]')), `7b. Check for updates is at the top of the ${t} tab`); }
  ok(await p.evaluate(() => { document.getElementById('cmdkBtn')?.click(); const i = document.querySelector('#cmdk input'); if (!i) return false; i.value = 'update'; i.dispatchEvent(new Event('input', { bubbles: true })); const t = document.getElementById('cmdk').textContent; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return /Check for updates/.test(t); }), '7c. Ctrl+K finds Check for updates');

  // 8. the sports log moved from You, Stats to Fitness, Train
  await p.evaluate(() => { view = 'profile'; ui.youTab = 'stats'; render(); }); await sleep(300);
  ok(!(await p.evaluate(() => /Sports log/.test(document.getElementById('view').textContent))), '8. You, Stats has no sports log');
  await p.evaluate(() => { view = 'training'; ui.bodyPage = 'train'; render(); }); await sleep(300);
  ok(await p.evaluate(() => /Sports log/.test(document.getElementById('view').textContent) && !!document.getElementById('cdSport')), '8b. Fitness, Train has the sports log');

  for (const v of ['today', 'friends', 'islands', 'study', 'profile']) { await p.evaluate(v => { view = v; ui.youTab = 'me'; render(); }, v); await sleep(400); }
  ok(errs.length === 0, '9. no page errors: ' + errs.slice(0, 3).join(' | '));
  // leave the copy as it was
  await p.evaluate(([av, s]) => { D.arena.av = JSON.parse(av); const o = JSON.parse(s); D.settings.themeBg = o.bg; D.settings.avHideGear = o.hide; const st = ftState(); st.gear = st.gear.filter(x => !/^y\d$/.test(x.id)); for (const k of ['head', 'chest']) if (/^y\d$/.test(st.wear[k] || '')) delete st.wear[k]; save(); }, [av0, set0]);
  await sleep(500);
  await b.close(); app.kill();
  console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
