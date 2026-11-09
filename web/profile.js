'use strict';
/* You (2.55): your own page at the bottom of the sidebar. Your Lumen and
   Ember, the Mind and Body cards, your level, the avatar editor, class and
   build, your stats, account, feedback and a way into Settings. The 3D model
   was dropped so nothing 3D loads until you open Islands. */

const PF = {};
const PF_CATS = [['look', '🪞 Look like me'], ['hair', '💇 Hair'], ['hairCol', '🎨 Hair colour'], ['face', '😀 Face'], ['hat', '🧢 Headwear'], ['eyes', '🕶️ Eyewear'], ['kit', '👕 Kit'], ['shoes', '👟 Shoes'], ['extra', '✨ Extras'], ['pet', '🐶 Pet'], ['bg', '🌄 Background'], ['dance', '💃 Dance'], ['skin', 'Skin tone']];
function pfSpec() {
  const av = myAv(), tryId = ui.pfTry && cos(ui.pfTry), cat = ui.pfCat || 'look';
  const s = { ...avatarSpec(av) };
  if (tryId) { s[tryId.cat] = tryId.id; if (tryId.cat === 'kit') s.kitC = tryId.c || s.kitC; }
  if (cat === 'look') { s.hat = 'hat_none'; s.eyes = 'eye_none'; }
  return s;
}
function viewProfile() {
  const av = myAv(), spec = pfSpec(), cat = ui.pfCat || 'look';
  const C = typeof cdParts === 'function' ? cdParts() : null, SL = typeof solisLevel === 'function' ? solisLevel() : null;
  const user = acct.signedIn ? `@${esc(acct.username)}` : acct.configured && !ONLINE ? '<a href="#" data-pf="login">Log in to show friends</a>' : '';
  const stage = `<div class="pfstage" id="wardStage" style="background:${BG_CSS[spec.bg] || 'radial-gradient(ellipse at 50% 30%,var(--panel),var(--panel2))'}">
      <div class="pf2d on">${avatarFull(spec, { size: 260, cls: 'idle' })}${petHtml(spec.pet, 54)}</div>
      <div class="pfstage-btns"><button class="btn small" data-act="avDance" title="Play your victory dance">💃 Dance</button></div>
      ${ui.pfTry ? `<div class="pftry"><span>Trying on <b>${esc(cos(ui.pfTry)?.name || '')}</b></span>${pfBuyBtn(cos(ui.pfTry))}<button class="btn small" data-pf="untry">Take off</button></div>` : ''}</div>`;
  const tab = ui.youTab || 'me';
  const tabs = `<div class="seg youseg">${[['me', '🜂 Character'], ['look', '🪞 Avatar'], ['stats', '📊 Stats']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-pf="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
  const top = `<div class="card youtop">${stage}<div class="pfname"><h2>${esc(D.settings.name || 'You')}${typeof badgeTags === 'function' ? badgeTags(myBadges) : ''}</h2>
      <div class="muted">${user}${user ? ' · ' : ''}${SL ? `Level ${SL.n}` : ''} · 🔥 ${studyStreak()}-day streak</div>
      ${SL ? `<div class="pflv" title="Level XP is every Lumen and Ember you have earned. New spells, moves, gear and buildings unlock as you level up."><div class="cdtrack"><i style="width:${SL.max ? 100 : Math.round(SL.into / SL.need * 100)}%;background:linear-gradient(90deg,#f59f00,#4dabf7)"></i></div><small class="muted">${SL.max ? 'Max level' : `${SL.into.toLocaleString()} / ${SL.need.toLocaleString()} XP to level ${SL.n + 1}`}</small></div>` : ''}
      ${C ? C.wallet : ''}</div></div>`;
  let body;
  if (tab === 'look') body = `<div class="pfwrap"><div class="card pfedit"><div class="pfcats">${PF_CATS.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-pf="cat" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="pfopts" data-ks="pf-${cat}">${cat === 'look' ? lookEditor() : pfGrid(cat, av, spec)}</div></div>
      <div class="stack"><div class="card"><h2>About you</h2>
        <div class="frow"><div class="field"><label>Display name</label><input type="text" data-setting="name" value="${esc(D.settings.name || '')}" maxlength="30" placeholder="What friends see"></div>
          <div class="field"><label>Jersey number</label><input type="number" min="0" max="99" data-setting="jerseyNo" value="${esc(D.settings.jerseyNo ?? 11)}" style="width:90px"></div></div>
        ${acct.signedIn ? '<p class="muted small-text">Every jersey number can only be worn by one player. First come, first served.</p>' : ''}
        ${typeof myBadges !== 'undefined' && myBadges.length ? `<div class="pfbadges">${myBadges.filter(b => BADGES[b]).map(b => `<div class="pfbadge ${b}"><span>${BADGES[b][0]}</span><div><b>${BADGES[b][1]}</b><small>${esc(BADGES[b][2])}</small></div></div>`).join('')}</div>` : ''}
      </div>${accountCard()}</div></div>`;
  else if (tab === 'stats') body = `<div class="friends-main"><div class="stack">${typeof seasonCard === 'function' ? seasonCard() : ''}${typeof recordsHtml === 'function' ? recordsHtml().replace(/<h2 style="margin:18px 0 10px">.*<\/h2>/, '') : ''}</div>
      <div class="stack">${typeof gradeCard === 'function' ? gradeCard() : ''}${typeof studyPieCard === 'function' ? studyPieCard() : ''}</div></div>`;
  else body = C ? `${C.banner}${C.cards}${C.cls}${C.build}${C.stats}` : '';
  return `${pageHead('You', 'Your character, avatar and stats', `<button class="btn small" data-act="feedback">💬 Send feedback</button><button class="btn small" data-act="goto" data-v="settings">⚙ Settings</button>`)}
    ${top}${tabs}${body}`;
}
function pfBuyBtn(c) {
  if (!c) return '';
  if (ownsCos(c.id)) return `<button class="btn small primary" data-act="wearCos" data-id="${c.id}">Wear it</button>`;
  const r = cosReq(c); return r ? `<span class="tag">🔒 ${esc(r.label)}</span>` : '';
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
    const tag = on ? '<span class="tag green">Wearing</span>' : own ? '<span class="tag">Owned</span>' : r ? `<span class="tag ${r.ok ? 'green' : ''}">🔒 ${esc(r.label)}</span>` : '';
    return `<button class="pfitem ${on ? 'on' : ''} ${own ? 'own' : 'locked'} ${trying ? 'trying' : ''}" data-pf="pick" data-id="${c.id}">${pic}<b>${esc(c.name)}</b>${tag}</button>`;
  }).join('')}</div>
  <p class="muted small-text">${cat === 'dance' ? 'Pick a dance, then press 💃 Dance to see it.' : 'Click anything to wear it. Everything is free.'}</p>`;
}

// clicking an item wears it when it's yours, otherwise tries it on
function pfAction(el) {
  const a = el.dataset.pf;
  if (a === 'cat') { ui.pfCat = el.dataset.v; ui.pfTry = null; render(); }
  else if (a === 'tab') { ui.youTab = el.dataset.v; render(); }
  else if (a === 'pick') {
    const c = cos(el.dataset.id); if (!c) return;
    if (ownsCos(c.id)) { ui.pfTry = null; wearCos(c.id); }
    else { ui.pfTry = ui.pfTry === c.id ? null : c.id; render(); }
  }
  else if (a === 'untry') { ui.pfTry = null; render(); }
  else if (a === 'login') { ui.setTab = 'account'; view = 'settings'; render(); }
}
document.addEventListener('click', e => { const el = e.target.closest('[data-pf]'); if (!el) return; e.preventDefault(); pfAction(el); });
