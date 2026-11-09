// 2.58 toon 3D avatar, gear on the model and the weekly cosmetic shop, on a copy of a real planner.
// Usage: build the app into DIR/LifePlanner with a planner in DIR/data, then: node test/e2e/avatar3d.e2e.js DIR
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const S = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const app = spawn(S + '/LifePlanner', [], { cwd: S, env: { ...process.env, LP_PORT: '47913' }, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(S + '/data/window.key'); i++) await sleep(250);
  await sleep(800);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47913/?k=' + fs.readFileSync(S + '/data/window.key', 'utf8').trim());
  await p.waitForFunction(() => typeof D === 'object' && D && loaded, null, { timeout: 20000 }); await sleep(1500);
  await p.evaluate(() => { document.getElementById('boot')?.remove(); ui.clsSeen = true; ui.youTab = 'me'; view = 'profile'; render(); });
  await p.waitForFunction(() => AV3.fig, null, { timeout: 20000 }); await sleep(800);
  const cnt = () => p.evaluate(() => { let n = 0, ol = 0; AV3.fig.traverse(o => { if (o.isMesh) { n++; if (o.material.side === THREE.BackSide) ol++; } }); return { n, ol }; });
  const c0 = await cnt();
  ok(c0.n > 80 && c0.ol > 30, `1. the toon figure is built with outlines (${c0.n} meshes, ${c0.ol} outlines)`);
  ok(await p.evaluate(() => AV3.fig.children.some(o => o.isMesh || o.isGroup) && document.querySelector('.pfstage.has3d') !== null), '1b. the 3D avatar replaces the 2D one');
  ok(await p.evaluate(() => [...AV3.mats ? Object.values(AV3.mats) : []].some(m => m.type === 'MeshToonMaterial')), '1c. toon materials');
  // what you wear shows: each cosmetic slot changes the model
  const av = await p.evaluate(() => myAv());
  const tries = [['hat', 'hat_crown'], ['eyes', 'eye_aviator'], ['extra', 'x_cape'], ['hair', 'h_afro'], ['pet', 'p_cat']];
  for (const [k, v] of tries) {
    const n = await p.evaluate(([k, v]) => { const h = document.getElementById('av3host'), d = JSON.parse(h.dataset.av); d.spec[k] = v; h.dataset.av = JSON.stringify(d); mountYou3D(); let n = 0; AV3.fig.traverse(o => { if (o.isMesh || o.isSprite) n++; }); return n; }, [k, v]);
    ok(n > 0, `2. ${k} ${v} builds (${n} parts)`);
  }
  // gear on the model and preview before wearing
  await p.evaluate(() => { const st = ftState(); st.gear.push({ id: 'tg1', slot: 'head', n: 'Common Helm', e: '🪖', r: 'common', b: { dr: .05 } }, { id: 'tg2', slot: 'chest', n: 'Legendary Chestplate', e: '🦺', r: 'legendary', b: { hp: 20 } }); st.wear.chest = 'tg2'; render(); });
  await sleep(600);
  const g1 = await p.evaluate(() => JSON.parse(document.getElementById('av3host').dataset.av).gear);
  ok(g1.Chestplate === '#f59f00' && !g1.Helm, '3. worn gear goes to the model in its rarity colour');
  await p.evaluate(() => { ui.gearSlot = 'head'; render(); }); await sleep(300);
  await p.click('[data-ft="try"][data-id="tg1"]'); await sleep(600);
  const g2 = await p.evaluate(() => JSON.parse(document.getElementById('av3host').dataset.av).gear);
  ok(g2.Helm === '#868e96', '3b. previewing a helm shows it on the model before wearing');
  ok(await p.evaluate(() => { let helm = false; AV3.fig.userData.P.head.traverse(o => { if (o.isMesh && o.geometry.parameters?.phiLength && o.material.color && o.material.color.getHexString() !== 'ffffff') helm = true; }); return helm; }), '3c. the helm is on the head');
  await p.click('[data-ft="try"][data-id="tg1"]'); await sleep(300);
  // the weekly shop
  await p.evaluate(() => { ui.youLook = true; ui.pfCat = 'shop'; ui.gearSlot = ''; render(); }); await sleep(500);
  const shop = await p.$$eval('.pfshop .shopitem', els => els.length);
  ok(shop === 6, '4. the shop shows 6 looks this week');
  const same = await p.evaluate(() => JSON.stringify(cosShop('2026-11-09').map(c => c.id)) === JSON.stringify(cosShop('2026-11-09').map(c => c.id)) && JSON.stringify(cosShop('2026-11-09').map(c => c.id)) !== JSON.stringify(cosShop('2026-11-16').map(c => c.id)));
  ok(same, '4b. the stock is the same all week and changes next week');
  const first = await p.evaluate(() => cosShop()[0]);
  await p.click(`.shoppic[data-id="${first.id}"]`); await sleep(700);
  ok(await p.evaluate(id => ui.pfTry === id && JSON.parse(document.getElementById('av3host').dataset.av).spec[cos(id).cat] === id, first.id), '5. clicking a shop look tries it on the 3D avatar');
  ok(!(await p.evaluate(id => ownsCos(id), first.id)), '5b. a priced look is not owned before buying');
  // not enough: nothing changes
  const before = await p.evaluate(() => { const w = cdWallet(); return { l: w.lumen, e: w.ember, sp: JSON.stringify(cdState().spent || {}) }; });
  const pricey = await p.evaluate(() => { const w = cdWallet(); return cosShop().find(c => (c.price.l || 0) > w.lumen || (c.price.e || 0) > w.ember)?.id; });
  if (pricey) { await p.evaluate(id => buyCos(id), pricey); ok(!(await p.evaluate(id => ownsCos(id), pricey)) && (await p.evaluate(() => JSON.stringify(cdState().spent || {}))) === before.sp, '6. a look you can\'t afford isn\'t bought and nothing is spent'); }
  // give enough and buy
  await p.evaluate(id => { const c = cos(id), s = cdState(); s.got = s.got || { l: 0, e: 0 }; s.got.l += c.price.l || 0; s.got.e += c.price.e || 0; }, first.id);
  const w1 = await p.evaluate(() => { const w = cdWallet(); return w.lumen + w.ember; });
  await p.click(`.shopitem button[data-act="buyCos"][data-id="${first.id}"]`); await sleep(600);
  const w2 = await p.evaluate(() => { const w = cdWallet(); return w.lumen + w.ember; });
  ok(await p.evaluate(id => ownsCos(id) && myAv()[cos(id).cat] === id, first.id), '7. buying makes it yours and you wear it');
  ok(w1 - w2 === (first.price.l || first.price.e), `7b. the price is taken off (${w1} -> ${w2})`);
  ok(await p.evaluate(id => !!D.arena.owned[id], first.id), '7c. it is saved as owned');
  const notInShop = await p.evaluate(() => COSMETICS.find(c => c.price && !cosInShop(c.id))?.id);
  await p.evaluate(id => buyCos(id), notInShop);
  ok(!(await p.evaluate(id => ownsCos(id), notInShop)), '8. a look that isn\'t in the shop this week can\'t be bought');
  // free new looks are free
  ok(await p.evaluate(() => ['h_topknot', 'h_hero', 'hat_hood', 'eye_patch', 'x_scarf'].every(ownsCos)), '9. the new free looks are free');
  // 2D avatar stands in for 3D-only looks
  const svg = await p.evaluate(() => avatarFull({ ...avatarSpec(), hat: 'hat_knight', extra: 'x_wingsDragon' }, { size: 80 }));
  ok(/svg/.test(svg) && svg.length > 500, '10. the 2D avatar draws 3D-only looks as their nearest 2D style');
  // other pages still work with the new looks on
  for (const v of ['today', 'friends', 'islands', 'fitness', 'study']) { await p.evaluate(v => { view = v; render(); }, v); await sleep(500); }
  await p.evaluate(() => { view = 'profile'; ui.youLook = false; render(); }); await sleep(800);
  ok(errs.length === 0, '11. no page errors: ' + errs.slice(0, 3).join(' | '));
  // put Eli's look back so the copy is left as it was
  await p.evaluate(av => { D.arena.av = av; save(); }, av);
  await b.close(); app.kill();
  console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
