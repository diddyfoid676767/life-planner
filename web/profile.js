'use strict';
/* You (2.57, round 3 part B). Four tabs, kept to one screen each where possible:
   - Character: your big 3D avatar in the middle with your 6 gear slots on the
     sides (head, chest, hands on the left; legs, feet, charm on the right) and
     your stats next to it, all without scrolling. Click a slot to see the gear
     you have for it, preview a piece on the avatar, then wear it. Under it:
     your class, your build (spells and moves) and battles. Edit look swaps the
     lower half for the avatar editor.
   - Records: one search bar to log a PR, your bests, recent PRs and your SAC
     scores, all on one page.
   - Stats: season, grades, study split, what builds your Body, sports log.
   - Account: name, jersey, badges, account and feedback.
   Settings sits behind the gear button. */

const PF = {};
const PF_CATS = [['look', '🪞 Look like me'], ['shop', '🛒 Shop'], ['hair', '💇 Hair'], ['hairCol', '🎨 Hair colour'], ['face', '😀 Face'], ['hat', '🧢 Headwear'], ['eyes', '🕶️ Eyewear'], ['kit', '👕 Kit'], ['shoes', '👟 Shoes'], ['extra', '✨ Extras'], ['pet', '🐶 Pet'], ['bg', '🌄 Background'], ['skin', 'Skin tone']];
const YOU_LEFT = ['head', 'chest', 'hand'], YOU_RIGHT = ['legs', 'feet', 'charm'];
function pfSpec() {
  const av = myAv(), tryId = ui.pfTry && cos(ui.pfTry), cat = ui.pfCat || 'look';
  const s = { ...avatarSpec(av) };
  if (tryId) { s[tryId.cat] = tryId.id; if (tryId.cat === 'kit') s.kitC = tryId.c || s.kitC; }
  if (ui.youLook && cat === 'look') { s.hat = 'hat_none'; s.eyes = 'eye_none'; }
  return s;
}
// what's worn, with the piece you're previewing swapped in
function youWear() {
  const st = ftState(), w = { ...st.wear }, t = ui.gearTry && st.gear.find(x => x.id === ui.gearTry);
  if (t) w[t.slot] = t.id; else ui.gearTry = null;
  return w;
}
function youSlot(k) {
  const st = ftState(), [, n, e] = FT_GEAR_SLOTS.find(s => s[0] === k), w = youWear(), p = st.gear.find(x => x.id === w[k]), tr = ui.gearTry && p?.id === ui.gearTry, S = p && ftSetOf(p);
  const have = st.gear.filter(x => x.slot === k).length;
  return `<button type="button" class="ygslot ${p ? 'on' : ''} ${tr ? 'trying' : ''} ${ui.gearSlot === k ? 'open' : ''}" data-pf="slot" data-v="${k}" ${p ? `style="--rc:${ftRar(p.r)[3]}"` : ''} title="${p ? esc(ftBuffText(p.b)) : `No ${n.toLowerCase()} gear on`}">
    <span class="yge">${p ? p.e : e}</span><span class="ygt"><small>${n}${tr ? ' · preview' : ''}</small><b>${p ? esc(p.n) : 'Empty'}</b>${S ? `<em>${S.e} ${S.n}</em>` : have ? `<em>${have} in bag</em>` : ''}</span></button>`;
}
function youStatsPanel() {
  const ch = cdChar(), cls = cdClassInfo(), w = cdWallet(), st = ftState(), wear = youWear();
  const g = ftGearBuffs(st, wear), hp = ftMaxHp(ch.all, g), sets = ftSets(st, wear);
  const base = ui.gearTry ? ftGearBuffs(st) : null, hp0 = base ? ftMaxHp(ch.all, base) : hp;
  const diff = base ? Object.keys({ ...g, ...base }).filter(k => k !== 'hp' && Math.abs((g[k] || 0) - (base[k] || 0)) > .001).map(k => { const d = (g[k] || 0) - (base[k] || 0); return `<span class="${(k === 'dr' ? d > 0 : d > 0) ? 'up' : 'down'}">${FT_BUFF[k][1]} ${d > 0 ? '+' : '−'}${k === 'rg' ? Math.abs(Math.round(d)) : Math.round(Math.abs(d) * 100) + '%'}</span>`; }) : [];
  const bars = (stats, vals) => stats.map(([k, n, c]) => `<div class="ysb"><span>${n}</span><div class="cdtrack"><i style="width:${vals[k]}%;background:${c}"></i></div><b>${vals[k]}</b></div>`).join('');
  return `<div class="ystats">
    <div class="yovr"><div><small class="muted">OVERALL</small><b>${ch.ovr}</b></div><div><small class="muted">🧠 MIND</small><b>${ch.mind}</b></div><div><small class="muted">💪 BODY</small><b>${ch.body}</b></div></div>
    <div class="ysbars"><div>${bars(MIND_STATS, ch.m)}</div><div>${bars(BODY_STATS, ch.b)}</div></div>
    <div class="yfight"><span>❤️ <b>${hp}</b> health${hp !== hp0 ? ` <span class="${hp > hp0 ? 'up' : 'down'}">(${hp > hp0 ? '+' : ''}${hp - hp0})</span>` : ''}</span>${Object.entries(g).filter(([k]) => k !== 'hp').map(([k, v]) => `<span>${FT_BUFF[k][1]} ${FT_BUFF[k][2](Math.round(v * 100) / 100)}</span>`).join('')}</div>
    ${diff.length ? `<div class="ydiff">If you wear it: ${diff.join(' ')}</div>` : ''}
    ${sets.length ? `<div class="ysets">${sets.map(({ S, n }) => `<div class="${n >= 3 ? 'live' : ''}" title="3 pieces: ${esc(ftBuffText(S.b3))} · 5 pieces: ${esc(ftBuffText(S.b5))}">${S.e} <b>${S.n} set</b> ${n}/${S.pcs.length >= 6 ? 6 : 5}<small>${n >= 5 ? ftBuffText({ ...S.b3, ...Object.fromEntries(Object.entries(S.b5).map(([k, v]) => [k, v + (S.b3[k] || 0)])) }) : n >= 3 ? `${ftBuffText(S.b3)} · 5 for more` : `wear 3 for ${ftBuffText(S.b3)}`}</small></div>`).join('')}</div>` : '<p class="muted small-text" style="margin:0">Wear 3 matching pieces (Scholar, Ironclad or Athlete) for a set bonus.</p>'}
    <div class="ywal"><span class="cd-l" title="Lumen, from study">${LUMEN} <b>${w.lumen.toLocaleString()}</b></span><span class="cd-e" title="Ember, from training">${EMBER} <b>${w.ember.toLocaleString()}</b></span>${cls ? `<span class="tag" style="background:${cls.col}22;color:${cls.col}">${cls.e} ${cls.n}</span>` : ''}</div>
  </div>`;
}
function youHero() {
  const spec = pfSpec(), SL = solisLevel(), cls = cdClassInfo(), st = ftState(), wear = youWear(), gear = {};
  for (const id of Object.values(wear)) { const p = st.gear.find(x => x.id === id); if (p) { const b = ftGearBase(p); if (b) gear[b] = ftRar(p.r)[3]; } }
  const av = JSON.stringify({ spec, gear, cls: cls ? cls.col : '' }).replace(/"/g, '&quot;');
  const tryP = ui.gearTry && st.gear.find(x => x.id === ui.gearTry), user = acct.signedIn ? `@${esc(acct.username)} · ` : '';
  return `<div class="card youhero">
    <div class="yhgear">${YOU_LEFT.map(youSlot).join('')}</div>
    <div class="yhstage pfstage" style="background:${BG_CSS[spec.bg] || `radial-gradient(ellipse at 50% 35%, ${cls ? cls.col + '33' : '#3a4170'}, #151827 75%)`}">
      <div class="av3host" id="av3host" data-av="${av}"></div>
      <div class="pf2d on">${avatarFull(spec, { size: 250, cls: 'idle' })}${petHtml(spec.pet, 50)}</div>
      <div class="yhname"><h2>${esc(D.settings.name || 'You')}${typeof badgeTags === 'function' ? badgeTags(myBadges) : ''}</h2>
        ${cls ? `<div class="yhtitle" style="color:${cls.col}">${cls.e} ${cls.n} · ${esc(cls.title)}</div>` : ''}
        <div class="yhlv"><span>${user}Level ${SL.n}</span><div class="cdtrack"><i style="width:${SL.max ? 100 : Math.round(SL.into / SL.need * 100)}%"></i></div><small>${SL.max ? 'Max level' : `${SL.into.toLocaleString()} / ${SL.need.toLocaleString()} XP`}</small></div></div>
      <div class="pfstage-btns"><button class="btn small ${ui.youLook ? 'on' : ''}" data-pf="look">🪞 ${ui.youLook ? 'Done' : 'Edit look'}</button></div>
      ${tryP ? `<div class="pftry"><span>Previewing <b>${tryP.e} ${esc(tryP.n)}</b></span><button class="btn small primary" data-ft="wear" data-id="${tryP.id}">Wear it</button><button class="btn small" data-ft="try" data-id="${tryP.id}">Cancel</button></div>`
        : ui.pfTry ? `<div class="pftry"><span>Trying on <b>${esc(cos(ui.pfTry)?.name || '')}</b></span>${pfBuyBtn(cos(ui.pfTry))}<button class="btn small" data-pf="untry">Take off</button></div>` : '<span class="pfhint">Drag to turn · double-click to spin</span>'}
    </div>
    <div class="yhgear">${YOU_RIGHT.map(youSlot).join('')}</div>
    ${youStatsPanel()}
  </div>`;
}
// the gear you have for one slot (or all of it), with preview and wear
function youGearDrawer() {
  const k = ui.gearSlot; if (!k) return '';
  const st = ftState(), lvN = solisLevel().n, name = k === 'all' ? 'All gear' : FT_GEAR_SLOTS.find(s => s[0] === k)[1];
  const list = st.gear.filter(p => k === 'all' || p.slot === k).sort((a, b) => FT_RAR.findIndex(x => x[0] === b.r) - FT_RAR.findIndex(x => x[0] === a.r));
  const rows = list.map(p => {
    const on = st.wear[p.slot] === p.id, gl = ftGearLv(p), R = ftRar(p.r), S = ftSetOf(p), tr = ui.gearTry === p.id;
    if (!on && lvN < gl) return `<div class="ygrow locked"><span class="ftgear" style="--rc:${R[3]}">${p.e} ${R[1]} ${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1].toLowerCase()} piece</span><span class="muted small-text">buffs hidden</span><span class="tag">🔒 Level ${gl}</span><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button></div>`;
    return `<div class="ygrow ${tr ? 'trying' : ''}">${ftGearChip(p)}${S ? `<span class="tag">${S.e} ${S.n}</span>` : ''}${k === 'all' ? `<small class="muted">${FT_GEAR_SLOTS.find(s => s[0] === p.slot)[1]}</small>` : ''}<span style="flex:1"></span>
      ${on ? `<span class="tag green">Wearing</span><button class="btn small" data-ft="unwear" data-k="${p.slot}">Take off</button>` : `<button class="btn small ${tr ? 'on' : ''}" data-ft="try" data-id="${p.id}">${tr ? 'Stop preview' : '👁 Preview'}</button><button class="btn small primary" data-ft="wear" data-id="${p.id}">Wear</button><button class="iconbtn" data-ft="scrap" data-id="${p.id}" title="Scrap for ${ftScrap(p)} ${LUMEN} and ${EMBER}">♻️</button>`}</div>`;
  }).join('');
  return `<div class="card ygdrawer"><div class="card-head"><h2>🛡️ ${name}</h2><span style="flex:1"></span>${k !== 'all' ? '<button class="btn small" data-pf="slot" data-v="all">All gear</button>' : ''}<button class="iconbtn" data-pf="slot" data-v="" title="Close">✕</button></div>
    ${rows || `<p class="muted small-text">No ${k === 'all' ? '' : name.toLowerCase() + ' '}gear yet. Gear drops from house boss fights, spars and duels.</p>`}
    <p class="muted small-text">Sets: ${FT_SETS.map(S => `${S.e} <b>${S.n}</b> (${S.pcs.join(', ')}): 3 pieces ${ftBuffText(S.b3)}, 5 pieces also ${ftBuffText(S.b5)}`).join(' · ')}</p></div>`;
}
function youClassCard() {
  const st = cdState(), cls = cdClassInfo(), SL = solisLevel(), need = solisLvXp(CD_CLASS_LV);
  if (!cls && SL.n < CD_CLASS_LV) return `<div class="card yclass locked"><span class="yce">🔒</span><div><b>Classes unlock at level ${CD_CLASS_LV}</b><div class="muted small-text">${(need - SL.xp).toLocaleString()} XP to go (${SL.xp.toLocaleString()} / ${need.toLocaleString()}). Then you choose one of ${CD_CLASSES.length} classes for good: a title, an aura and two skills only that class has.${st.cls ? ` You picked ${cdClassInfo(st.cls)?.n} earlier, and you'll get to confirm it then.` : ''}</div><div class="cdtrack" style="margin-top:6px"><i style="width:${Math.min(100, SL.xp / need * 100)}%;background:linear-gradient(90deg,#f59f00,#4dabf7)"></i></div></div></div>`;
  if (!cls) return `<div class="card yclass ready"><span class="yce">✨</span><div><b>You've reached level ${CD_CLASS_LV}: choose your class</b><div class="muted small-text">It's permanent, so take a look at all ${CD_CLASSES.length}.</div></div><button class="btn primary" data-cls="open">Choose a class</button></div>`;
  const F = FT_CLASS[cls.id];
  return `<div class="card yclass" style="--cc:${cls.col}"><span class="yce">${cls.e}</span><div><b>${cls.n}</b> <span class="muted">· ${esc(cls.title)}</span><div class="small-text">${esc(F.p)} · Skills: ${ftClassSkills(cls.id).map(s => `${s.e} ${esc(s.n)}`).join(', ')}</div></div>
    ${st.respec > 0 ? `<button class="btn" data-cls="open" title="Use a Respec Scroll to pick a new class">📜 Respec (${st.respec})</button>` : '<span class="muted small-text" title="A very rare drop when your house kills the weekly boss">📜 No Respec Scrolls</span>'}</div>`;
}
function youRecords() {
  const C = cdParts(), pbs = [...(D.arena.pbs || [])].filter(p => TESTS.some(T => T.id === p.test)).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  const recent = pbs.map(p => { const T = TESTS.find(x => x.id === p.test); return `<li><span>${pbWhen(p)}</span><b>${esc(T.name)}</b><span>${fmtTest(T, p.value)}</span><button class="iconbtn" data-act="delPb" data-id="${p.id}" title="Delete">✕</button></li>`; }).join('');
  return `<div class="yrec"><div class="stack"><div class="card"><div class="card-head"><h2>🏆 Log a PR</h2><span class="muted small-text">type an event, its result, Enter</span></div>
      ${prBarHtml()}${recent ? `<ul class="cdlog yrecent">${recent}</ul>` : ''}</div>
      ${bestsSummary()}</div>
    <div class="stack">${C.scores}</div></div>
    ${recordsHtml().replace(/<h2 style="margin:18px 0 10px">.*<\/h2>/, '')}`;
}
function viewProfile() {
  const av = myAv(), spec = pfSpec(), cat = ui.pfCat || 'look';
  const tab = ['me', 'rec', 'stats', 'acct'].includes(ui.youTab) ? ui.youTab : 'me';
  if (tab === 'me' && !ui.clsSeen && !ui.clsPick && !cdClass() && solisHas(CD_CLASS_LV)) { ui.clsPick = true; ui.clsSel = cdState().cls || ''; setTimeout(clsPickerDraw, 0); }
  const tabs = `<div class="seg youseg">${[['me', '🜂 Character'], ['rec', '🏆 Records'], ['stats', '📊 Stats'], ['acct', '👤 Account']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-pf="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
  let body;
  if (tab === 'rec') body = youRecords();
  else if (tab === 'stats') { const C = cdParts(); body = `<div class="friends-main"><div class="stack">${typeof seasonCard === 'function' ? seasonCard() : ''}</div>
      <div class="stack">${typeof gradeCard === 'function' ? gradeCard() : ''}${typeof studyPieCard === 'function' ? studyPieCard() : ''}</div></div>${C.stats}`; }
  else if (tab === 'acct') body = `<div class="friends-main"><div class="stack"><div class="card"><h2>About you</h2>
        <div class="frow"><div class="field"><label>Display name</label><input type="text" data-setting="name" value="${esc(D.settings.name || '')}" maxlength="30" placeholder="What friends see"></div>
          <div class="field"><label>Jersey number</label><input type="number" min="0" max="99" data-setting="jerseyNo" value="${esc(D.settings.jerseyNo ?? 11)}" style="width:90px"></div></div>
        ${acct.signedIn ? '<p class="muted small-text">Every jersey number can only be worn by one player. First come, first served.</p>' : acct.configured && !ONLINE ? '<p><a href="#" data-pf="login">Log in to show friends</a></p>' : ''}
        ${typeof myBadges !== 'undefined' && myBadges.length ? `<div class="pfbadges">${myBadges.filter(b => BADGES[b]).map(b => `<div class="pfbadge ${b}"><span>${BADGES[b][0]}</span><div><b>${BADGES[b][1]}</b><small>${esc(BADGES[b][2])}</small></div></div>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:12px"><button class="btn" data-act="feedback">💬 Send feedback</button><button class="btn" data-act="goto" data-v="settings">⚙ All settings</button></div></div></div>
      <div class="stack">${accountCard()}</div></div>`;
  else if (ui.youLook) body = `<div class="card pfedit"><div class="pfcats">${PF_CATS.map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-pf="cat" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="pfopts" data-ks="pf-${cat}">${cat === 'look' ? lookEditor() : pfGrid(cat, av, spec)}</div></div>`;
  else body = `${youGearDrawer()}${youClassCard()}${typeof ftBuildHtml === 'function' ? `<div class="friends-main"><div class="stack">${ftBuildHtml(true)}</div><div class="stack">${ftBattlesHtml()}</div></div>` : ''}`;
  const SL = solisLevel();
  return `${pageHead('You', `Level ${SL.n} · 🔥 ${studyStreak()}-day streak`, `<button class="iconbtn ysetbtn" data-act="goto" data-v="settings" title="Settings">⚙</button>`)}
    ${tabs}${tab === 'me' ? youHero() : ''}${body}`;
}
function pfBuyBtn(c) {
  if (!c) return '';
  if (ownsCos(c.id)) return `<button class="btn small primary" data-act="wearCos" data-id="${c.id}">Wear it</button>`;
  if (c.price) return cosInShop(c.id) ? `<button class="btn small primary" data-act="buyCos" data-id="${c.id}">Buy for ${cosPrice(c)}</button>` : '<span class="tag">🛒 In the shop some weeks</span>';
  const r = cosReq(c); return r ? `<span class="tag">🔒 ${esc(r.label)}</span>` : '';
}
// 2.58 the weekly shop: 6 looks for Lumen or Ember, new ones every Monday
const PF_SHOP_IC = { hair: '💇', hairCol: '🎨', hat: '🎩', eyes: '🕶️', kit: '👕', shoes: '👟', extra: '✨', pet: '🐾' };
function pfShop(av) {
  const w = cdWallet(), days = 7 - ((new Date(today() + 'T12:00').getDay() + 6) % 7);
  return `<div class="pfshophead"><span>New looks every Monday · ${days === 1 ? 'new stock tomorrow' : `new stock in ${days} days`}</span><span class="cd-l">${LUMEN} <b>${w.lumen.toLocaleString()}</b></span><span class="cd-e">${EMBER} <b>${w.ember.toLocaleString()}</b></span></div>
  <div class="pfgrid pfshop">${cosShop().map(c => {
    const R = COS_RAR[c.rar], own = ownsCos(c.id), on = av[c.cat] === c.id, trying = ui.pfTry === c.id, can = (c.price.l || 0) <= w.lumen && (c.price.e || 0) <= w.ember;
    return `<div class="pfitem shopitem ${on ? 'on' : ''} ${trying ? 'trying' : ''}" style="--rc:${R[1]}"><button type="button" class="shoppic" data-pf="pick" data-id="${c.id}" title="Try it on">${c.e || PF_SHOP_IC[c.cat] || '✨'}</button>
      <b>${esc(c.name)}</b><small style="color:${R[1]}">${R[0]} · ${PF_CATS.find(x => x[0] === c.cat)?.[1].replace(/^\S+ /, '') || ''}</small>
      ${own ? (on ? '<span class="tag green">Wearing</span>' : `<button class="btn small" data-act="wearCos" data-id="${c.id}">Wear</button>`) : `<button class="btn small ${can ? 'primary' : ''}" data-act="buyCos" data-id="${c.id}" ${can ? '' : 'title="Not enough yet"'}>${cosPrice(c)}</button>`}</div>`;
  }).join('')}</div>
  <p class="muted small-text">Click a look to try it on your 3D self first. Bought looks are yours for good. Lumen comes from study, Ember from training.</p>`;
}
function pfGrid(cat, av, spec) {
  if (cat === 'shop') return pfShop(av);
  const items = COSMETICS.filter(c => c.cat === cat);
  const base = { ...spec, hat: av.hat, eyes: av.eyes };
  return `<div class="pfgrid">${items.map(c => {
    const own = ownsCos(c.id), on = av[cat] === c.id, trying = ui.pfTry === c.id, r = cosReq(c);
    const preview = { ...base, [cat]: c.id, ...(cat === 'kit' ? { kitC: c.id === 'kit_gear' ? avatarSpec({ ...av, kit: 'kit_gear' }).kitC : c.c } : {}) };
    const pic = cat === 'bg' ? `<div class="wbg" style="background:${BG_CSS[c.id] || 'var(--panel2)'}"></div>` : cat === 'pet' ? `<div class="wbg dance">${c.e || '🚫'}</div>`
      : `<div class="wmini">${avatarFull(preview, { size: 92 })}</div>`;
    const tag = on ? '<span class="tag green">Wearing</span>' : own ? '<span class="tag">Owned</span>' : c.price ? `<span class="tag" style="color:${COS_RAR[c.rar][1]}">${cosInShop(c.id) ? cosPrice(c) : '🛒 Shop'}</span>` : r ? `<span class="tag ${r.ok ? 'green' : ''}">🔒 ${esc(r.label)}</span>` : '';
    return `<button class="pfitem ${on ? 'on' : ''} ${own ? 'own' : 'locked'} ${trying ? 'trying' : ''}" data-pf="pick" data-id="${c.id}">${pic}<b>${esc(c.name)}</b>${tag}</button>`;
  }).join('')}</div>
  <p class="muted small-text">Click anything to wear it. Looks with a price are bought in the weekly 🛒 Shop with Lumen or Ember; click one to try it on first.</p>`;
}

// clicking an item wears it when it's yours, otherwise tries it on
function pfAction(el) {
  const a = el.dataset.pf;
  if (a === 'cat') { ui.pfCat = el.dataset.v; ui.pfTry = null; render(); }
  else if (a === 'tab') { ui.youTab = el.dataset.v; render(); }
  else if (a === 'look') { ui.youLook = !ui.youLook; ui.pfTry = null; render(); }
  else if (a === 'slot') { ui.gearSlot = ui.gearSlot === el.dataset.v ? '' : el.dataset.v; if (!ui.gearSlot) ui.gearTry = null; ui.youLook = false; render(); }
  else if (a === 'goRec') { ui.youTab = 'rec'; document.querySelector('#tabs button[data-view="profile"]')?.click(); if (view !== 'profile') { view = 'profile'; render(); } }
  else if (a === 'pick') {
    const c = cos(el.dataset.id); if (!c) return;
    if (ownsCos(c.id)) { ui.pfTry = null; wearCos(c.id); }
    else { ui.pfTry = ui.pfTry === c.id ? null : c.id; render(); }
  }
  else if (a === 'untry') { ui.pfTry = null; render(); }
  else if (a === 'login') { ui.setTab = 'account'; view = 'settings'; render(); }
}
document.addEventListener('click', e => { const el = e.target.closest('[data-pf]'); if (!el) return; e.preventDefault(); pfAction(el); });
