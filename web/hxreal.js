'use strict';
/* 2.72: real life shows on your island, for looks only (never a penalty).
   - While a study timer runs, the Library glows and sends a beam of light up.
   - While a workout is running, the Training hall's forge fire burns.
   - Flowers grow round the Library, one for each hour you've studied this week (up to 14).
   Day and night, seasons and Melbourne weather are in hxsky.js. */
const HXR = { sig: '' };
const hxrHours = () => { const m0 = mondayOf(today()); return Math.floor(D.focusLogs.filter(l => l.date >= m0).reduce((a, l) => a + (+l.mins || 0), 0) / 60); };
function hxRealBuild() {
  HX3.real = null;
  if (IS3.house !== 'hex' || ui.hxVisit || !IS3.world) return;
  const W = IS3.world, at = id => { const f = HX_FREE.find(x => x.id === id); return f && f.at ? hxPos(...hxQR(f.at)) : null; }, R = HX3.real = {};
  const lib = at('library');
  if (lib) {
    const g = R.study = new THREE.Group(); g.position.set(lib[0], 0, lib[1]);
    const bm = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.28, .5, 14, 16, 1, true), bm); beam.position.y = 9; g.add(beam);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.1, .05, 6, 32), new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 3.2; g.add(halo);
    const pl = new THREE.PointLight('#9fd8ff', 2.4, 9); pl.position.y = 2.2; g.add(pl);
    g.visible = false; W.add(g); HX3.anim.push({ o: bm, shim: 1, base: .3, amp: .12, sp: 2.2, ph: 0 }, { o: halo, ax: 'z', sp: .8 });
    // flowers for this week's study hours
    const n = Math.min(14, hxrHours()), cols = ['#ffd6e7', '#fff3bf', '#d0bfff', '#ffc9c9', '#c3fae8'];
    for (let i = 0; i < n; i++) {
      const a = i / 14 * Math.PI * 2 + .3, r = 1.25 + (i % 2) * .22, f = new THREE.Group(); f.position.set(lib[0] + Math.cos(a) * r, .05, lib[1] + Math.sin(a) * r);
      is3mesh(new THREE.CylinderGeometry(.02, .02, .22, 4), '#2b8a3e', 0, .11, 0, f); is3mesh(new THREE.IcosahedronGeometry(.075, 0), cols[i % cols.length], 0, .25, 0, f, true);
      W.add(f);
    }
  }
  const tr = at('training');
  if (tr) {
    const g = R.train = new THREE.Group(); g.position.set(tr[0], 0, tr[1]);
    for (let i = 0; i < 3; i++) { const m = new THREE.MeshBasicMaterial({ color: ['#ff6b2b', '#ffa94d', '#ffd43b'][i], transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }); const c = new THREE.Mesh(new THREE.ConeGeometry(.22 - i * .05, .6 - i * .12, 6), m); c.position.set(.95, .35 + i * .06, .55); g.add(c); HX3.anim.push({ o: m, shim: 1, base: .7, amp: .25, sp: 9 + i * 3, ph: i }); }
    const pl = new THREE.PointLight('#ff8f3d', 2.2, 7); pl.position.set(.95, 1, .55); g.add(pl);
    g.visible = false; W.add(g);
  }
  HXR.sig = ''; hxRealTick();
}
// timers start and stop without a rebuild: just switch the effects on and off
function hxRealTick() {
  const R = HX3.real; if (!R || typeof D !== 'object' || !D) return;
  const study = !!D.focus && !D.focus.pausedAt, train = !!D.fit?.live, sig = [study, train].join();
  if (sig === HXR.sig) return; HXR.sig = sig;
  if (R.study) R.study.visible = study; if (R.train) R.train.visible = train;
  if (typeof is3draw === 'function') is3draw();
}
// hxBuild (hexworld.js) draws the island; the effects go on top each time it does
if (typeof hxBuild === 'function') { const hxBuild0 = hxBuild; hxBuild = function () { hxBuild0(); try { hxRealBuild(); } catch (e) { console.error(e); } }; }
setInterval(hxRealTick, 2000);
