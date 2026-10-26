'use strict';
/* Profile: your own page. A 3D version of your avatar you can spin around,
   your name, badges and jersey number, and the avatar editor (look, hair,
   clothes, extras, pets, dances). Changes show on the 3D model straight away;
   things you haven't unlocked yet can be tried on before you buy them. */

const PF = { R: null, on: false, key: '', yaw: 0, spin: true, drag: null, dance: null, tick: [] };

// ---------- the page ----------
const PF_CATS = [['look', '🪞 Look like me'], ['hair', '💇 Hair'], ['hairCol', '🎨 Hair colour'], ['face', '😀 Face'], ['hat', '🧢 Headwear'], ['eyes', '🕶️ Eyewear'], ['kit', '👕 Kit'], ['shoes', '👟 Shoes'], ['extra', '✨ Extras'], ['pet', '🐶 Pet'], ['bg', '🌄 Background'], ['dance', '💃 Dance'], ['skin', 'Skin tone']];
function pfSpec() {
  const av = myAv(), tryId = ui.pfTry && cos(ui.pfTry), cat = ui.pfCat || 'look';
  const s = { ...avatarSpec(av) };
  if (tryId) { s[tryId.cat] = tryId.id; if (tryId.cat === 'kit') s.kitC = tryId.c || s.kitC; }
  if (cat === 'look') { s.hat = 'hat_none'; s.eyes = 'eye_none'; }
  return s;
}
function viewProfile() {
  const av = myAv(), spec = pfSpec(), lv = levelInfo(), cat = ui.pfCat || 'look';
  const owned = COSMETICS.filter(c => ownsCos(c.id)).length, tryC = ui.pfTry && cos(ui.pfTry);
  const user = acct.signedIn ? `@${esc(acct.username)}` : acct.configured && !ONLINE ? '<a href="#" data-pf="login">Log in to show friends</a>' : '';
  const stage = `<div class="pfstage" id="pfStage" style="background:${BG_CSS[spec.bg] || 'radial-gradient(ellipse at 50% 30%,var(--panel),var(--panel2))'}">
      <div class="pf3d" id="pf3d"></div><div class="pf2d">${avatarFull(spec, { size: 300, cls: 'idle' })}${petHtml(spec.pet, 60)}</div>
      <div class="pfstage-btns"><button class="btn small" data-pf="dance" title="Play your victory dance">💃 Dance</button><button class="btn small ${PF.spin ? 'on' : ''}" data-pf="spin" title="Turn on or off the slow spin">🔄</button></div>
      ${tryC ? `<div class="pftry"><span>Trying on <b>${esc(tryC.name)}</b></span>${pfBuyBtn(tryC)}<button class="btn small" data-pf="untry">Take off</button></div>` : '<div class="pfhint">Drag to spin</div>'}</div>`;
  return `${pageHead('👤 Profile', 'Your avatar, your badges and your number')}
    <div class="pfwrap"><div class="stack">
      <div class="card pfcard">${stage}
        <div class="pfname"><h2>${esc(D.settings.name || 'You')}${typeof badgeTags === 'function' ? badgeTags(myBadges) : ''}</h2>
          <div class="muted">${user}${user ? ' · ' : ''}Level ${lv.n} ${esc(lv.title)} · #${esc(D.settings.jerseyNo ?? 11)}</div></div>
        <div class="pfstats"><span>${COIN} <b>${coins()}</b></span><span>${GRIT} <b>${grit()}</b></span><span>🔥 <b>${studyStreak()}</b> day streak</span><span>👕 <b>${owned}</b>/${COSMETICS.length} styles</span></div>
      </div>
      <div class="card"><h2>About you</h2>
        <div class="frow"><div class="field"><label>Display name</label><input type="text" data-setting="name" value="${esc(D.settings.name || '')}" maxlength="30" placeholder="What friends see"></div>
          <div class="field"><label>Jersey number</label><input type="number" min="0" max="99" data-setting="jerseyNo" value="${esc(D.settings.jerseyNo ?? 11)}" style="width:90px"></div></div>
        ${acct.signedIn ? '<p class="muted small-text">Every jersey number can only be worn by one player. First come, first served.</p>' : ''}
        ${typeof myBadges !== 'undefined' && myBadges.length ? `<div class="pfbadges">${myBadges.filter(b => BADGES[b]).map(b => `<div class="pfbadge ${b}"><span>${BADGES[b][0]}</span><div><b>${BADGES[b][1]}</b><small>${esc(BADGES[b][2])}</small></div></div>`).join('')}</div>` : ''}
      </div>
      ${accountCard()}
    </div>
    <div class="card pfedit"><div class="pfcats">${PF_CATS.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-pf="cat" data-v="${k}">${l}</button>`).join('')}</div>
      ${cat === 'look' ? lookEditor() : pfGrid(cat, av, spec)}</div></div>`;
}
function pfBuyBtn(c) {
  if (ownsCos(c.id)) return `<button class="btn small primary" data-act="wearCos" data-id="${c.id}">Wear it</button>`;
  const r = cosReq(c); if (r) return `<span class="tag">🔒 ${esc(r.label)}${r.prog ? ' · ' + r.prog : ''}</span>`;
  if (c.drop) return `<span class="tag">🔒 ${esc(c.drop)}</span>`;
  const can = c.coins ? coins() >= c.coins : grit() >= c.grit;
  return `<button class="btn small ${can ? 'primary' : ''}" data-act="buyCos" data-id="${c.id}" ${can ? '' : 'disabled'}>${c.coins ? `${c.coins} ${COIN}` : `${c.grit} ${GRIT}`}</button>`;
}
function pfGrid(cat, av, spec) {
  const items = COSMETICS.filter(c => c.cat === cat);
  const base = { ...spec, hat: av.hat, eyes: av.eyes };
  return `<div class="pfgrid">${items.map(c => {
    const own = ownsCos(c.id), on = av[cat] === c.id, trying = ui.pfTry === c.id, r = cosReq(c);
    const preview = { ...base, [cat]: c.id, ...(cat === 'kit' ? { kitC: c.id === 'kit_gear' ? avatarSpec({ ...av, kit: 'kit_gear' }).kitC : c.c } : {}) };
    const pic = cat === 'bg' ? `<div class="wbg" style="background:${BG_CSS[c.id] || 'var(--panel2)'}"></div>` : cat === 'pet' ? `<div class="wbg dance">${c.e || '🚫'}</div>`
      : cat === 'dance' ? `<div class="wbg dance">${{ d_jump: '🦘', d_flex: '💪', d_spin: '🌀', d_flip: '🤸', d_dab: '🙆', d_moon: '🕺', d_worm: '🐛', d_robot: '🤖', d_floss: '🕴️' }[c.id] || '💃'}</div>`
      : `<div class="wmini">${avatarFull(preview, { size: 92 })}</div>`;
    const tag = on ? '<span class="tag green">Wearing</span>' : own ? '<span class="tag">Owned</span>' : r ? `<span class="tag ${r.ok ? 'green' : ''}">🔒 ${esc(r.label)}</span>` : c.drop ? `<span class="tag">🏆 ${esc(c.drop)}</span>` : `<span class="tag price">${c.coins ? `${c.coins} ${COIN}` : `${c.grit} ${GRIT}`}</span>`;
    return `<button class="pfitem ${on ? 'on' : ''} ${own ? 'own' : 'locked'} ${trying ? 'trying' : ''}" data-pf="pick" data-id="${c.id}">${pic}<b>${esc(c.name)}</b>${tag}</button>`;
  }).join('')}</div>
  <p class="muted small-text">${cat === 'dance' ? 'Pick a dance, then press 💃 Dance to see it.' : 'Click anything to try it on. Coins come from studying, Grit from training, and 🔒 styles unlock as you level up and keep streaks.'}</p>`;
}

// clicking an item wears it when it's yours, otherwise tries it on
async function pfAction(el) {
  const a = el.dataset.pf;
  if (a === 'cat') { ui.pfCat = el.dataset.v; ui.pfTry = null; render(); }
  else if (a === 'pick') {
    const c = cos(el.dataset.id); if (!c) return;
    if (ownsCos(c.id)) { ui.pfTry = null; wearCos(c.id); if (c.cat === 'dance') pfDance(); else pfPop(); }
    else { ui.pfTry = ui.pfTry === c.id ? null : c.id; render(); if (c.cat === 'dance') pfDance(c.id); }
  }
  else if (a === 'untry') { ui.pfTry = null; render(); }
  else if (a === 'dance') pfDance();
  else if (a === 'spin') { PF.spin = !PF.spin; el.classList.toggle('on', PF.spin); }
  else if (a === 'login') { ui.setTab = 'account'; view = 'settings'; render(); }
}
document.addEventListener('click', e => { const el = e.target.closest('[data-pf]'); if (!el) return; e.preventDefault(); pfAction(el); });

// ---------- 3D ----------
const HAIR3 = { ...HAIR_OF, h_braids: 'long', h_hightop: 'hightop', h_wolf: 'mullet', h_spacebuns: 'spacebuns', h_quiff: 'spiky', h_undercut: 'short', h_slick: 'buzz', h_cornrows: 'buzz', h_crop: 'short' };
// two extra hairstyles the battle fighters didn't have
{
  const _hairOn = hairOn;
  hairOn = function (head, style, mat, L) {
    if (style !== 'hightop' && style !== 'spacebuns') return _hairOn(head, style, mat, L);
    _hairOn(head, 'buzz', mat, L);
    if (style === 'hightop') { const m = b3mesh(new THREE.CylinderGeometry(.21, .23, .26, 28), mat); m.position.set(0, .44, -.02); head.add(m); }
    else for (const s of [-1, 1]) { const m = b3mesh(new THREE.SphereGeometry(.11, 20, 14), mat); m.position.set(s * .15, .46, -.04); head.add(m); }
  };
}
const shadeHex = (hex, f) => '#' + new THREE.Color(hex || '#888').multiplyScalar(f).getHexString();
function pfLook(spec) {
  const C = id => cos(id) || {}, Lk = Object.assign({}, LOOK_DEFAULT, spec.look || {});
  const dyed = spec.hairCol && (C(spec.hairCol).coins || C(spec.hairCol).grit);
  const kit = spec.kitC || '#5c7cfa';
  return {
    skin: Lk.skinC || C(spec.skin).c || '#f1c9a5', hairC: (dyed ? C(spec.hairCol).c : Lk.hairC) || C(spec.hairCol).c || '#5c3a21', hair: HAIR3[spec.hair] || 'short',
    kit, kit2: shadeHex(kit, .7), shorts: '#2b2f3a', shoe: C(spec.shoes).c || (spec.shoes === 'sh_black' ? '#212529' : '#f8f9fa'),
    bulk: { slim: .92, regular: 1, athletic: 1.07, broad: 1.15 }[Lk.build] || 1, angry: spec.face === 'f_fierce' || spec.face === 'f_focus',
    extras: [Lk.beard !== 'none' && 'beard', Lk.glasses !== 'none' && spec.eyes === 'eye_none' && 'glasses'].filter(Boolean),
  };
}
function pfTex(draw, w = 256, h = 256) { return b3tex(draw, w, h); }
// the kit's pattern as a texture wrapped round the torso
function kitTex(pat, base) {
  if (!pat) return null;
  return pfTex((x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    if (pat === 'stripes') { x.fillStyle = '#fff'; for (let i = 0; i < 16; i++) x.fillRect(i * 16 + 4, 0, 6, h); }
    if (pat === 'hoops') { x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) x.fillRect(0, 70 + i * 40, w, 16); }
    if (pat === 'rainbow') ['#fa5252', '#fd7e14', '#fcc419', '#40c057', '#228be6', '#7048e8'].forEach((c, k) => { x.fillStyle = c; x.fillRect(0, 40 + k * 32, w, 32); });
    if (pat === 'camo') for (let i = 0; i < 40; i++) { x.fillStyle = ['#3d4a26', '#8a7a4a', '#2f3a1c'][i % 3]; x.beginPath(); x.ellipse((i * 67) % w, (i * 41) % h, 18, 10, i, 0, 7); x.fill(); }
    if (pat === 'checker') { x.fillStyle = '#f8f9fa'; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16); }
    if (pat === 'flames') { for (const [c, top] of [['#ff6b00', .45], ['#ffd43b', .65]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 16; i++) x.lineTo(i * w / 16, h * (top + (i % 2 ? .12 : -.05) + Math.sin(i * 1.7) * .04)); x.lineTo(w, h); x.fill(); } }
    if (pat === 'galaxy') { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b1d5c'); g.addColorStop(.5, '#5f3dc4'); g.addColorStop(1, '#a61e4d'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${.4 + (i % 3) * .2})`; x.beginPath(); x.arc((i * 97) % w, (i * 53) % h, i % 5 ? 1.2 : 2.6, 0, 7); x.fill(); } }
    if (pat === 'beta') { x.fillStyle = '#4dabf7'; x.fillRect(0, 70, w, 26); x.fillStyle = '#fff'; x.fillRect(0, 96, w, 6); }
    if (pat === 'dev') { x.fillStyle = 'rgba(105,219,124,.12)'; x.font = '14px monospace'; for (let j = 0; j < 14; j++) x.fillText('01001101 <div> {}'.slice(j % 5), 0, j * 19); }
  });
}
// jersey number (and username on the back) printed on the shirt
function numberDecal(P, no, name, back) {
  const tex = pfTex((x, w, h) => {
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6;
    if (back && name) { x.font = '900 34px "Segoe UI",sans-serif'; x.strokeText(name.toUpperCase().slice(0, 12), w / 2, 60); x.fillText(name.toUpperCase().slice(0, 12), w / 2, 60); }
    x.font = `900 ${back ? 150 : 96}px "Segoe UI",sans-serif`; x.strokeText(String(no), w / 2, back ? 210 : 170); x.fillText(String(no), w / 2, back ? 210 : 170);
  });
  const a = back ? .62 : .5, b = P.L.bulk || 1;
  const g = new THREE.CylinderGeometry(.236, .236, back ? .44 : .3, 20, 1, true, (back ? Math.PI : 0) - a, a * 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.scale.set(1.18 * b, 1, .82 * b); m.position.y = back ? .38 : .33; P.spine.add(m);
}
const mk = (geo, col, o) => b3mesh(geo, col && col.isMaterial ? col : b3mat(col, { phys: true, rough: .45, ...(o || {}) }));
const put = (par, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); par.add(m); return m; };
function hat3(P, id, kit) {
  const h = P.head, dome = (col, cut = .45, r = .262, y = .23) => put(h, mk(new THREE.SphereGeometry(r, 36, 18, 0, Math.PI * 2, 0, Math.PI * cut), col), 0, y, -.01, -.15);
  const gold = b3mat('#fcc419', { metal: .9, rough: .25, emi: '#7a5c00', ei: .3 });
  const cap = (col, back) => { dome(col); put(h, mk(new THREE.CylinderGeometry(.2, .2, .022, 32, 1, false, -Math.PI / 2, Math.PI), col), 0, .3, back ? -.13 : .13, back ? .15 : -.15, back ? Math.PI : 0); };
  switch (id) {
    case 'hat_band': put(h, mk(new THREE.TorusGeometry(.248, .032, 10, 40), '#e03131'), 0, .3, 0, Math.PI / 2 - .2); break;
    case 'hat_cap': cap(kit); break;
    case 'hat_backcap': cap(kit, true); break;
    case 'hat_snap': cap('#212529'); put(h, mk(new THREE.BoxGeometry(.12, .06, .02), kit), 0, .4, .2, -.5); break;
    case 'hat_beta': cap('#7048e8'); { const b = new THREE.Mesh(new THREE.CircleGeometry(.06, 24), new THREE.MeshStandardMaterial({ map: emojiTex('🧪'), transparent: true })); put(h, b, 0, .38, .2, -.55); } break;
    case 'hat_beanie': dome('#364fc7', .5, .27, .21); put(h, mk(new THREE.TorusGeometry(.262, .045, 12, 40), '#4c6ef5'), 0, .27, 0, Math.PI / 2 - .15); put(h, mk(new THREE.SphereGeometry(.07, 16, 12), '#dbe4ff', { sheen: 1 }), 0, .53, -.06); break;
    case 'hat_phones': { const b = put(h, mk(new THREE.TorusGeometry(.27, .02, 8, 30, Math.PI), '#343a40'), 0, .22, 0, 0, Math.PI / 2); for (const s of [-1, 1]) put(h, mk(new THREE.CylinderGeometry(.085, .085, .07, 24), kit), s * .27, .2, 0, 0, 0, Math.PI / 2); break; }
    case 'hat_bucket': put(h, mk(new THREE.CylinderGeometry(.2, .27, .2, 32), '#e9ecef'), 0, .42, -.01, -.12); put(h, mk(new THREE.CylinderGeometry(.38, .4, .025, 40), '#dee2e6'), 0, .31, 0, -.12); break;
    case 'hat_party': put(h, mk(new THREE.ConeGeometry(.13, .36, 24), '#f06595'), .05, .6, 0, 0, 0, -.2); put(h, mk(new THREE.SphereGeometry(.04, 12, 10), '#fcc419'), .09, .78, 0); break;
    case 'hat_viking': dome('#868e96', .5, .27, .21); for (const s of [-1, 1]) { const t = put(h, mk(new THREE.ConeGeometry(.06, .28, 16), '#f8f9fa'), s * .3, .42, 0, 0, 0, -s * .9); } put(h, mk(new THREE.TorusGeometry(.262, .03, 8, 40), '#495057'), 0, .28, 0, Math.PI / 2 - .15); break;
    case 'hat_halo': { const r = put(h, new THREE.Mesh(new THREE.TorusGeometry(.2, .025, 12, 48), b3mat('#ffe066', { emi: '#fcc419', ei: 2.5 })), 0, .66, 0, Math.PI / 2); PF.tick.push(t => { r.position.y = .66 + Math.sin(t * 2) * .02; }); break; }
    case 'hat_horns': for (const s of [-1, 1]) put(h, mk(new THREE.ConeGeometry(.05, .2, 16), '#e03131', { emi: '#5c0000', ei: .4 }), s * .14, .48, .02, 0, 0, -s * .4); break;
    case 'hat_goat': for (const s of [-1, 1]) { const hh = put(h, mk(new THREE.TorusGeometry(.11, .035, 10, 24, Math.PI * .9), '#e9ecef'), s * .17, .42, -.02); hh.rotation.set(0, Math.PI / 2, s > 0 ? .3 : Math.PI - .3); } break;
    case 'hat_durag': dome('#212529', .52, .262, .21); put(h, mk(new THREE.BoxGeometry(.08, .32, .01), '#212529'), 0, .06, -.27, .15); break;
    case 'hat_bandana': dome('#c92a2a', .47); put(h, mk(new THREE.ConeGeometry(.05, .12, 8), '#c92a2a'), .0, .2, -.28, -1.4); break;
    case 'hat_beret': { const b = put(h, mk(new THREE.SphereGeometry(.27, 32, 14), '#862e9c', { sheen: 1 }), -.04, .42, -.02, .1, 0, .25); b.scale.set(1, .32, 1); break; }
    case 'hat_flowers': for (let k = 0; k < 9; k++) { const a = (k / 8 - .5) * Math.PI * 1.1; put(h, mk(new THREE.SphereGeometry(.045, 12, 10), ['#f06595', '#fcc419', '#ff8787', '#cc5de8'][k % 4]), Math.sin(a) * .25, .37 - Math.abs(Math.sin(a)) * .06, Math.cos(a) * .2); } break;
    case 'hat_helmet': put(h, mk(new THREE.SphereGeometry(.29, 36, 20, 0, Math.PI * 2, 0, Math.PI * .55), kit, { cc: 1, ccr: .08, rough: .25 }), 0, .2, 0); break;
    case 'hat_crown': { const c = put(h, mk(new THREE.CylinderGeometry(.17, .15, .1, 32, 1, true), gold), 0, .5, 0); c.material.side = THREE.DoubleSide; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; put(h, mk(new THREE.ConeGeometry(.035, .1, 10), gold), Math.cos(a) * .16, .59, Math.sin(a) * .16); put(h, mk(new THREE.SphereGeometry(.022, 10, 8), b3mat('#e03131', { emi: '#e03131', ei: .6 })), Math.cos(a) * .16, .64, Math.sin(a) * .16); } break; }
    case 'hat_cowboy': put(h, mk(new THREE.CylinderGeometry(.19, .23, .22, 28), '#8b5a2b'), 0, .45, -.01, -.1); put(h, mk(new THREE.TorusGeometry(.21, .02, 8, 32), '#3b2416'), 0, .37, -.01, Math.PI / 2 - .1); { const b = put(h, mk(new THREE.CylinderGeometry(.46, .46, .02, 40), '#8b5a2b'), 0, .34, 0, -.1); b.scale.set(1, 1, .8); } break;
    case 'hat_tophat': put(h, mk(new THREE.CylinderGeometry(.18, .18, .42, 32), '#212529', { cc: .6 }), 0, .58, -.01, -.06); put(h, mk(new THREE.CylinderGeometry(.185, .185, .07, 32), '#c92a2a'), 0, .42, -.01, -.06); put(h, mk(new THREE.CylinderGeometry(.33, .33, .02, 40), '#212529'), 0, .37, 0, -.06); break;
    case 'hat_wizard': { put(h, mk(new THREE.CylinderGeometry(.4, .4, .02, 40), '#5f3dc4'), 0, .34, 0, -.08); const c = put(h, mk(new THREE.ConeGeometry(.24, .62, 32), '#5f3dc4', { sheen: 1, sheenC: '#b197fc' }), 0, .66, -.04, -.18, 0, .12); for (let k = 0; k < 6; k++) put(h, new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), b3mat('#ffe066', { emi: '#fcc419', ei: 2 })), Math.sin(k * 2.1) * .15, .45 + k * .06, .12 + Math.cos(k * 2.1) * .05); break; }
  }
}
function eyes3(P, id) {
  const h = P.head, y = .23, z = .23;
  const lens = (col, o) => b3mat(col, { phys: true, cc: 1, ccr: .05, rough: .1, metal: .3, ...(o || {}) });
  const visor = (col, o, h2 = .1, op = .85) => { const m = put(h, mk(new THREE.CylinderGeometry(.258, .258, h2, 32, 1, true, -1.1, 2.2), lens(col, { op, trans: true, side: THREE.DoubleSide, ...(o || {}) })), 0, y, 0); return m; };
  const pair = (geo, mat, dz = 0) => [-1, 1].map(s => put(h, new THREE.Mesh(geo, mat), s * .085, y, z + dz));
  switch (id) {
    case 'eye_sport': visor('#1c7ed6', { emi: '#1864ab', ei: .3 }); break;
    case 'eye_visor': visor('#3bc9db', { emi: '#15aabf', ei: 1.2 }); break;
    case 'eye_titan': visor('#ff3b3b', { emi: '#ff0000', ei: 2 }, .06, .95); break;
    case 'eye_ski': visor('#f06595', { emi: '#845ef7', ei: .4 }, .12); put(h, mk(new THREE.TorusGeometry(.255, .018, 8, 40), '#212529'), 0, y, 0, Math.PI / 2); break;
    case 'eye_aviator': pair(new THREE.SphereGeometry(.06, 20, 12), lens('#343a40'), .01).forEach(m => m.scale.set(1.1, .9, .4)); pair(new THREE.TorusGeometry(.064, .008, 8, 24), b3mat('#fcc419', { metal: .9, rough: .2 }), .025); break;
    case 'eye_goggles': put(h, mk(new THREE.TorusGeometry(.245, .022, 8, 40), '#212529'), 0, y, 0, Math.PI / 2); pair(new THREE.CylinderGeometry(.065, .065, .05, 24), lens('#74c0fc', { emi: '#1971c2', ei: .3 }), .01).forEach(m => m.rotation.x = Math.PI / 2); break;
    case 'eye_nerd': pair(new THREE.TorusGeometry(.065, .012, 6, 4), b3mat('#212529'), .02).forEach(m => m.rotation.z = Math.PI / 4); break;
    case 'eye_3d': [['#fa5252', -1], ['#339af0', 1]].forEach(([c, s]) => put(h, new THREE.Mesh(new THREE.BoxGeometry(.11, .075, .01), lens(c, { op: .8, trans: true })), s * .085, y, z + .025)); put(h, mk(new THREE.BoxGeometry(.3, .09, .006), '#f8f9fa'), 0, y, z + .018); break;
    case 'eye_mono': put(h, new THREE.Mesh(new THREE.TorusGeometry(.06, .01, 8, 24), b3mat('#e67700', { metal: .9, rough: .2 })), .085, y, z + .025); break;
    case 'eye_heart': case 'eye_star': {
      const s = new THREE.Shape();
      if (id === 'eye_heart') { s.moveTo(0, -.06); s.bezierCurveTo(-.09, 0, -.05, .07, 0, .03); s.bezierCurveTo(.05, .07, .09, 0, 0, -.06); }
      else for (let k = 0; k < 10; k++) { const r = k % 2 ? .03 : .07, a = k / 10 * Math.PI * 2 + Math.PI / 2; k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      pair(new THREE.ExtrudeGeometry(s, { depth: .015, bevelEnabled: false }), lens(id === 'eye_heart' ? '#e64980' : '#f06595', { emi: '#a61e4d', ei: .3 }), .015); break;
    }
    case 'eye_laser': { const m = b3mat('#ff2222', { emi: '#ff0000', ei: 4 }); pair(new THREE.SphereGeometry(.035, 12, 10), m, .01); const beams = [-1, 1].map(s => { const b = put(h, new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 2.5, 6).translate(0, 1.25, 0), new THREE.MeshBasicMaterial({ color: '#ff4d4d', transparent: true, opacity: .8, toneMapped: false })), s * .085, y, z + .02, Math.PI / 2 - .05); return b; }); PF.tick.push(t => beams.forEach(b => { b.material.opacity = .5 + Math.sin(t * 12) * .3; })); break; }
    case 'eye_vr': { put(h, mk(new THREE.BoxGeometry(.32, .13, .13), '#212529', { rough: .3 }), 0, y, .22); put(h, mk(new THREE.TorusGeometry(.255, .02, 8, 40), '#343a40'), 0, y, 0, Math.PI / 2); put(h, new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), b3mat('#40c057', { emi: '#40c057', ei: 3 })), .12, y + .03, .29); break; }
    case 'eye_paint': pair(new THREE.BoxGeometry(.08, .022, .01), b3mat('#212529'), -.005).forEach(m => m.position.y = y - .07); break;
  }
}
function extra3(P, id, kit) {
  const sp = P.spine, gold = b3mat('#fcc419', { metal: .9, rough: .22, emi: '#7a5c00', ei: .25 });
  const hand = P.arms[1].hand;
  switch (id) {
    case 'x_chain': put(sp, new THREE.Mesh(new THREE.TorusGeometry(.13, .012, 8, 32), gold), 0, .6, .07, 1.25); put(sp, new THREE.Mesh(new THREE.SphereGeometry(.035, 14, 10), gold), 0, .47, .2); break;
    case 'x_medal': put(sp, mk(new THREE.TorusGeometry(.13, .014, 6, 24), '#1c7ed6'), 0, .6, .08, 1.15); put(sp, new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .015, 24), gold), 0, .44, .21, Math.PI / 2); break;
    case 'x_belt': put(P.hips, new THREE.Mesh(new THREE.TorusGeometry(.26, .04, 10, 40), gold), 0, .06, 0, Math.PI / 2).scale.set(1.2, .95, 1); put(P.hips, new THREE.Mesh(new THREE.BoxGeometry(.16, .11, .03), gold), 0, .06, .23); break;
    case 'x_cape': case 'x_aura': case 'x_sparkle': break; // handled below
    case 'x_wings': {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(.25, .35, .7, .45, .85, .3); s.bezierCurveTo(.7, .2, .75, .05, .6, -.05); s.bezierCurveTo(.5, -.1, .4, -.25, .25, -.3); s.bezierCurveTo(.15, -.2, .05, -.1, 0, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelSize: .015, bevelThickness: .01, bevelSegments: 2 });
      const mat = b3mat('#ffffff', { phys: true, sheen: 1, sheenC: '#d0ebff', rough: .5 });
      const ws = [-1, 1].map(k => { const piv = new THREE.Group(); piv.position.set(k * .08, .45, -.2); sp.add(piv); const w = new THREE.Mesh(g, mat); w.scale.set(k, 1, 1); w.castShadow = true; piv.add(w); return piv; });
      PF.tick.push(t => ws.forEach((w, k) => { w.rotation.y = (k ? -1 : 1) * (.5 + Math.sin(t * 3) * .25); }));
      break;
    }
    case 'x_jetpack': {
      for (const s of [-1, 1]) {
        put(sp, mk(new THREE.CapsuleGeometry(.075, .3, 6, 16), '#adb5bd', { metal: .7, rough: .25 }), s * .1, .38, -.26);
        const f = put(sp, new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 16).translate(0, -.15, 0), new THREE.MeshBasicMaterial({ color: '#ff922b', transparent: true, opacity: .85, toneMapped: false })), s * .1, .14, -.26);
        PF.tick.push(t => { f.scale.y = .8 + Math.sin(t * 30 + s) * .25; f.material.color.setHSL(.07 + Math.sin(t * 20) * .03, 1, .55); });
      }
      put(sp, mk(new THREE.BoxGeometry(.3, .25, .06), '#495057', { metal: .5 }), 0, .42, -.2); break;
    }
    case 'x_backpack': { const b = put(sp, mk(new THREE.CapsuleGeometry(.17, .14, 8, 20), '#1c7ed6', { sheen: .6 }), 0, .36, -.27); b.scale.set(1.3, 1, .7); for (const s of [-1, 1]) put(sp, mk(new THREE.TorusGeometry(.17, .018, 6, 20, Math.PI), '#1864ab'), s * .13, .45, -.03, 0, Math.PI / 2, Math.PI / 2); break; }
    case 'x_guitar': {
      const g = new THREE.Group(); g.position.set(0, .3, .25); g.rotation.z = -.75; sp.add(g);
      for (const [r, y] of [[.13, -.06], [.16, -.24]]) { const m = mk(new THREE.CylinderGeometry(r, r, .06, 28), '#e8590c', { cc: .8 }); m.rotation.x = Math.PI / 2; m.position.y = y; g.add(m); }
      g.add(put(new THREE.Group(), mk(new THREE.CylinderGeometry(.04, .04, .062, 16), '#3b2416'), 0, 0, 0)); const n = mk(new THREE.BoxGeometry(.05, .5, .03), '#6b4423'); n.position.y = .25; g.add(n); const hd = mk(new THREE.BoxGeometry(.07, .09, .035), '#3b2416'); hd.position.y = .53; g.add(hd); break;
    }
    case 'x_skate': { const g = new THREE.Group(); hand.add(g); g.position.set(0, -.05, .05); g.rotation.set(0, 0, .3); const d = mk(new THREE.CapsuleGeometry(.09, .6, 6, 16), '#e64980', { cc: .6 }); d.scale.set(1, 1, .18); g.add(d); for (const y of [-.24, .24]) for (const x of [-.07, .07]) g.add(put(new THREE.Group(), mk(new THREE.CylinderGeometry(.03, .03, .03, 14), '#fcc419'), x, y, .04, 0, 0, Math.PI / 2)); break; }
    case 'x_ball': { const b = mk(new THREE.SphereGeometry(.13, 24, 16), '#c2410c', { rough: .6 }); b.scale.set(1, 1.45, 1); put(hand, b, .03, .02, .08, .4); break; }
    case 'x_trophy': { const g = new THREE.Group(); put(hand, g, 0, .05, .08); g.add(put(new THREE.Group(), new THREE.Mesh(new THREE.CylinderGeometry(.1, .05, .14, 24, 1, true), gold), 0, .2, 0)); g.add(put(new THREE.Group(), new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .1, 8), gold), 0, .08, 0)); g.add(put(new THREE.Group(), mk(new THREE.BoxGeometry(.12, .05, .12), '#495057'), 0, .02, 0)); break; }
    case 'x_books': ['#e03131', '#1c7ed6', '#2f9e44'].forEach((c, k) => put(hand, mk(new THREE.BoxGeometry(.24, .05, .17), c), (k % 2) * .015, .03 + k * .05, .08, 0, k * .2)); break;
    case 'x_laptop': { const g = new THREE.Group(); put(hand, g, 0, .03, .1, 0, 0, 0); g.add(mk(new THREE.BoxGeometry(.3, .015, .2), '#868e96', { metal: .6 })); const scr = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .012), [b3mat('#343a40'), b3mat('#343a40'), b3mat('#343a40'), b3mat('#343a40'), new THREE.MeshBasicMaterial({ map: pfTex((x, w, h) => { x.fillStyle = '#0b1a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#69db7c'; x.font = 'bold 90px monospace'; x.textAlign = 'center'; x.fillText('</>', w / 2, h * .62); }), toneMapped: false }), b3mat('#343a40')]); scr.position.set(0, .1, -.1); scr.rotation.x = -.25; g.add(scr); break; }
  }
}
function pfBuild(spec) {
  const old = PF.P; if (old) { PF.scene.remove(old.root); old.root.traverse(o => { o.geometry?.dispose(); }); }
  PF.tick = [];
  const L = pfLook(spec), pat = (cos(spec.kit) || {}).pattern;
  if (spec.extra === 'x_cape') { L.extras.push('cape'); L.capeC = '#e03131'; }
  const P = fighter3(L);
  const tex = kitTex(pat, L.kit); if (tex) { P.M.kit.map = tex; P.M.kit.color.set('#ffffff'); P.M.kit.needsUpdate = true; }
  numberDecal(P, spec.no ?? 11, acct.signedIn ? acct.username : D.settings.name || '', true); numberDecal(P, spec.no ?? 11, '', false);
  hat3(P, spec.hat, L.kit); eyes3(P, spec.eyes); extra3(P, spec.extra, L.kit);
  P.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  // glow behind you (aura) and sparkles
  PF.aura.visible = spec.extra === 'x_aura';
  PF.spark.forEach(s => { s.visible = spec.extra === 'x_sparkle'; });
  // pet
  const pet = cos(spec.pet);
  PF.pet.visible = !!pet?.e; if (pet?.e) { PF.pet.material.map?.dispose(); PF.pet.material.map = emojiTex(pet.e); PF.pet.material.needsUpdate = true; }
  PF.scene.add(P.root); PF.P = P; P.pose = { ...PF_IDLE };
  PF.dance = PF.dance && { ...PF.dance };
}
const PF_IDLE = { ...POSE0, shL: .05, shLz: -.12, elL: -.2, shR: .05, shRz: .12, elR: -.2, hipL: 0, knL: .02, hipR: 0, knR: .02 };
function pfMount() {
  const host = document.getElementById('pf3d'); if (!host) return;
  if (!PF.R) {
    if (typeof webglOK !== 'function' || !webglOK()) return;
    try {
      const R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping;
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
      fxEnv(R, scene, '#9ec5ff', '#fff4e0', '#5a4a3a', new THREE.Vector3(.4, .8, .5), '#fff3d6', '#6b5a4a');
      scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', .55));
      const sun = new THREE.DirectionalLight('#fff4e0', 1.6); sun.position.set(2.5, 5, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 15 }); sun.shadow.bias = -.0005; scene.add(sun);
      const rim = new THREE.DirectionalLight('#b4c8ff', .9); rim.position.set(-3, 3, -4); scene.add(rim);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, .14, 64), b3mat('#ffffff', { phys: true, rough: .35, cc: .6, op: .9, trans: true })); plat.position.y = -.07; plat.receiveShadow = true; scene.add(plat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, .02, 8, 80), new THREE.MeshBasicMaterial({ color: '#7c8cff', toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0; scene.add(ring);
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('glow'), color: '#ffb000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .6, toneMapped: false })); aura.scale.set(2.4, 3.2, 1); aura.position.set(0, 1.05, -.3); scene.add(aura);
      const spark = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex('star'), color: '#ffe066', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.scale.setScalar(.12); scene.add(s); return s; });
      const pet = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); pet.scale.setScalar(.45); scene.add(pet);
      const petBlob = fxBlob(.2, .45); scene.add(petBlob);
      Object.assign(PF, { R, scene, cam, ring, aura, spark, pet, petBlob, clock: new THREE.Clock() });
      const cv = R.domElement;
      cv.addEventListener('pointerdown', e => { PF.drag = { x: e.clientX, yaw: PF.yaw, moved: 0 }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (!PF.drag) return; const dx = e.clientX - PF.drag.x; PF.drag.moved = Math.max(PF.drag.moved, Math.abs(dx)); PF.yaw = PF.drag.yaw + dx * .012; PF.vel = dx; });
      cv.addEventListener('pointerup', () => { if (PF.drag && PF.drag.moved < 4) pfPop(); PF.drag = null; });
      cv.addEventListener('wheel', e => { e.preventDefault(); PF.zoom = Math.min(1.25, Math.max(.6, (PF.zoom || 1) + e.deltaY * .0008)); }, { passive: false });
    } catch (e) { console.error('3D profile failed', e); PF.R = null; return; }
  }
  host.appendChild(PF.R.domElement);
  document.getElementById('pfStage')?.classList.add('has3d');
  const key = JSON.stringify(pfSpec()) + (acct.username || '');
  if (key !== PF.key || !PF.P) { PF.key = key; pfBuild(pfSpec()); }
  pfResize();
  if (!PF.on) { PF.on = true; PF.raf = requestAnimationFrame(pfLoop); }
}
function pfResize() {
  const host = PF.R?.domElement.parentNode; if (!host) return;
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h || PF.sz === w + 'x' + h) return;
  PF.sz = w + 'x' + h; PF.R.setSize(w, h, false); PF.cam.aspect = w / h; PF.cam.updateProjectionMatrix();
}
addEventListener('resize', () => { PF.sz = ''; pfResize(); });
function pfApply(P, p) {
  const R = P.root;
  R.position.set(p.s, p.y, p.f); R.rotation.set(0, PF.yaw + p.yaw, 0); R.scale.setScalar((P.L.scale || 1) * p.scale);
  P.body.rotation.set(p.lean, 0, p.roll, 'YXZ'); P.hips.position.y = .98 - p.crouch;
  P.spine.rotation.set(p.lean * .3, p.twist, 0); P.head.rotation.set(p.headX, p.headY, 0);
  const [l, r] = P.arms; l.sh.rotation.set(p.shL, 0, p.shLz); l.el.rotation.x = p.elL; r.sh.rotation.set(p.shR, 0, p.shRz); r.el.rotation.x = p.elR;
  P.legs[0].hp.rotation.x = p.hipL; P.legs[0].kn.rotation.x = p.knL; P.legs[1].hp.rotation.x = p.hipR; P.legs[1].kn.rotation.x = p.knR;
}
const pfEase = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
// victory dances: a pose for each moment p (0..1) of the dance
const PF_DANCES = {
  d_jump: [2, p => { const b = Math.abs(Math.sin(p * Math.PI * 4)); return { y: b * .45, crouch: (1 - b) * .12, shL: -2.7, shLz: -.3, shR: -2.7, shRz: .3, elL: -.2, elR: -.2, hipL: -b * .3, knL: b * .6, hipR: -b * .3, knR: b * .6 }; }],
  d_flex: [2, p => { const k = Math.sin(p * Math.PI * 3) ** 2; return { shL: -1.57, shLz: -1.45, elL: -1.9 - k * .3, shR: -1.57, shRz: 1.45, elR: -1.9 - k * .3, scale: 1 + k * .06, crouch: .08, hipL: -.2, hipR: .2 }; }],
  d_spin: [2.1, p => ({ yaw: pfEase(p) * Math.PI * 6, shL: -.3, shLz: -1.3, shR: -.3, shRz: 1.3, y: Math.sin(p * Math.PI) * .1 }) ],
  d_flip: [1.6, p => { const q = Math.min(1, Math.max(0, (p - .15) / .7)); return { y: Math.sin(q * Math.PI) * .9, lean: -pfEase(q) * Math.PI * 2, crouch: q > 0 && q < 1 ? .35 : (1 - Math.abs(p - .15) * 8) * .2, hipL: -1.2 * Math.sin(q * Math.PI), knL: 2 * Math.sin(q * Math.PI), hipR: -1.2 * Math.sin(q * Math.PI), knR: 2 * Math.sin(q * Math.PI), shL: -2.5, shR: -2.5 }; }],
  d_dab: [2, p => { const on = Math.sin(p * Math.PI * 4) > 0; return on ? { shL: -2.1, shLz: -.9, elL: 0, shR: -1.6, shRz: -.6, elR: -2.2, headX: .45, headY: -.5, lean: .1 } : { crouch: .05 }; }],
  d_moon: [2.4, p => { const s = Math.sin(p * Math.PI * 10); return { f: -Math.sin(p * Math.PI) * .8, hipL: s * .25, knL: Math.max(0, s) * .5, hipR: -s * .25, knR: Math.max(0, -s) * .5, lean: -.08, shL: .2, shR: .2 }; }],
  d_worm: [2.2, p => { const q = Math.min(1, p * 5, (1 - p) * 5); const w = Math.sin(p * Math.PI * 8); return { lean: q * 1.45, y: q * (.22 + Math.max(0, w) * .15) - q * .7, crouch: 0, shL: -q * 2.8, shR: -q * 2.8, hipL: q * w * .3, hipR: q * w * .3, headX: -q * .6 }; }],
  d_robot: [2.4, p => { const st = Math.floor(p * 8) % 4; return [{ shL: -1.57, elL: 0, shR: 0, elR: -1.57, headY: .5 }, { shL: 0, elL: -1.57, shR: -1.57, elR: 0, headY: -.5 }, { shLz: -1.57, shRz: 1.57, elL: -1.57, elR: -1.57, headY: 0, crouch: .1 }, { shL: -3, shR: 0, elR: -1.57, headY: .3 }][st]; }],
  d_floss: [2.2, p => { const s = Math.sin(p * Math.PI * 8), c = Math.sin(p * Math.PI * 8 + Math.PI / 2); return { shL: .4 * c, shLz: -.4 + s * .5, shR: -.4 * c, shRz: .4 + s * .5, elL: 0, elR: 0, s: -s * .06, roll: s * .1, hipL: c * .1, hipR: -c * .1 }; }],
};
function pfDance(id) {
  id = id || myAv().dance;
  if (!PF.on) { const st = document.querySelector('#pfStage .pf2d .avatar'); if (st) { st.parentNode.classList.remove('dance-' + id); void st.parentNode.offsetWidth; st.parentNode.classList.add('wardstage', 'dance-' + id); } return; }
  const d = PF_DANCES[id] || PF_DANCES.d_jump; PF.dance = { fn: d[1], dur: d[0], t: 0 };
  PF.spinWas = PF.spin; PF.yawTo = 0;
  if (typeof sfx === 'function') try { sfx('levelup'); } catch { }
}
// a happy bounce when you change something
function pfPop() { if (PF.P) PF.pop = 1; if (typeof sfx === 'function') try { sfx('toggle'); } catch { } }
function pfLoop() {
  if (!PF.on) return;
  const cv = PF.R.domElement;
  if (!cv.isConnected || view !== 'profile') { PF.on = false; return; }
  PF.raf = requestAnimationFrame(pfLoop);
  const dt = Math.min(.05, PF.clock.getDelta()), t = PF.clock.elapsedTime, P = PF.P; if (!P) return;
  // spin: slow turn, or the flick you gave it, easing back to the front while dancing
  if (!PF.drag) {
    if (PF.dance) PF.yaw += (Math.round(PF.yaw / (Math.PI * 2)) * Math.PI * 2 - PF.yaw) * Math.min(1, dt * 5);
    else { PF.vel = (PF.vel || 0) * Math.pow(.05, dt); PF.yaw += (PF.spin ? dt * .35 : 0) + PF.vel * .0025; }
  }
  const b = Math.sin(t * 2.2);
  let pose = { ...PF_IDLE, y: 0, crouch: .02 + b * .012, twist: Math.sin(t * .8) * .06, headY: Math.sin(t * .6) * .15, headX: Math.sin(t * .9) * .04, shL: PF_IDLE.shL + b * .04, shR: PF_IDLE.shR - b * .04 };
  if (PF.pop > 0) { PF.pop = Math.max(0, PF.pop - dt * 2.5); const k = Math.sin((1 - PF.pop) * Math.PI); pose.y += k * .18; pose.scale = 1 + k * .05; pose.shL -= k * 1.2; pose.shR -= k * 1.2; }
  if (PF.dance) {
    const D2 = PF.dance; D2.t += dt; const p = Math.min(1, D2.t / D2.dur), w = Math.min(1, D2.t * 6, (D2.dur - D2.t) * 6);
    const dp = { ...pose, ...D2.fn(p) }; pose = mixPose(pose, dp, Math.max(0, w));
    if (p >= 1) PF.dance = null;
  }
  pfApply(P, pose);
  if (P.cape) { const g = P.cape.geometry.attributes.position, base = P.cape.userData.base; if (base) { for (let i = 0; i < g.count; i++) { const y = base[i * 3 + 1], k = (.52 - y) / 1.05; g.setZ(i, base[i * 3 + 2] - k * k * (.22 + Math.sin(t * 3 + base[i * 3] * 3) * .06)); } g.needsUpdate = true; } }
  for (const f of PF.tick) f(t, dt);
  PF.aura.material.opacity = .45 + Math.sin(t * 4) * .15;
  PF.spark.forEach((s, k) => { const a = t * (.8 + k * .07) + k * .8; s.position.set(Math.cos(a) * .75, .3 + ((t * .3 + k * .13) % 1) * 1.8, Math.sin(a) * .75); s.material.opacity = Math.sin(((t * .3 + k * .13) % 1) * Math.PI); });
  const pa = t * .7; PF.pet.position.set(.85 + Math.sin(pa) * .08, .35 + Math.abs(Math.sin(t * 3)) * .12, .35 + Math.cos(pa) * .1); PF.petBlob.position.set(PF.pet.position.x, .005, PF.pet.position.z); PF.petBlob.visible = PF.pet.visible;
  PF.ring.material.color.setHSL((t * .05) % 1, .7, .65);
  // camera
  const z = PF.zoom || 1, narrow = PF.cam.aspect < .8;
  PF.cam.position.set(0, 1.25 + (1 - z) * .3, (narrow ? 6.2 : 5.4) * z); PF.cam.lookAt(0, .98, 0);
  pfResize();
  PF.R.render(PF.scene, PF.cam);
}
// after every render: put the 3D model on the page (it keeps one canvas so it never flickers)
addEventListener('load', () => {
  const _render = render;
  render = function () { _render.apply(this, arguments); if (view === 'profile') try { pfMount(); } catch (e) { console.error(e); } };
});
