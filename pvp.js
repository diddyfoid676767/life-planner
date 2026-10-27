'use strict';
/* 2.22 PvP: battle other people.
   Live battles go over the friends server's realtime channels. Both apps
   work out every turn from the same shared seed, so only each player's
   choice (a move, a swap or an item) crosses the wire.
   Saved teams: your team is published with your leaderboard row, so friends
   can fight it while you're offline, with the computer playing it.
   Wins and losses move your rating on the ranked ladder. */

const PVP_VER = 2; // bump when the battle rules change, so different versions don't play each other
const PVP_TEAM = 4, PVP_START = 1000, PVP_WAIT = 120e3;
const PVP_TIERS = [[0, 'Bronze', '🥉', '#c08a52'], [1100, 'Silver', '🥈', '#868e96'], [1250, 'Gold', '🥇', '#f59f00'], [1400, 'Platinum', '💠', '#15aabf'], [1550, 'Diamond', '💎', '#4dabf7'], [1700, 'Champion', '👑', '#e64980']];
const pvpTier = r => PVP_TIERS.filter(t => r >= t[0]).pop();
const pvpNext = r => PVP_TIERS.find(t => t[0] > r);
const elo = (r, o, win, k) => Math.round(k * ((win ? 1 : 0) - 1 / (1 + Math.pow(10, (o - r) / 400))));
function pvpState() {
  const p = D.arena.pvp = D.arena.pvp || {};
  if (p.r == null) Object.assign(p, { r: PVP_START, w: 0, l: 0, log: [] });
  if (!p.id) p.id = Math.random().toString(36).slice(2, 10);
  return p;
}
const tierChip = r => { const t = pvpTier(r); return `<span class="tierchip" style="--tc:${t[3]}">${t[2]} ${t[1]}</span>`; };

// ---------- teams ----------
// your PvP team: your creature team, at full health
function pvpTeamMons() { return typeof crReady === 'function' && crReady() ? myTeamMons().slice(0, PVP_TEAM) : []; }
function pvpTeamSnap() {
  return pvpTeamMons().map(m => ({ sp: m.sp, name: String(m.name).slice(0, 30), types: m.types, lv: m.lv, base: m.base, st: m.st, mv: m.moves.map(x => [x.id, x.max]), held: m.held || null, crowd: m.crowd ? 1 : 0, never: m.never ? 1 : 0, wind: m.wind ? 1 : 0 }));
}
// anything that came over the network is cleaned before it's drawn
const okStr = v => typeof v === 'string' && /^[#\w-]{0,40}$/.test(v);
function cleanObj(o, depth = 0) {
  if (o == null || depth > 3) return undefined;
  if (typeof o === 'number') return Number.isFinite(o) ? o : undefined;
  if (typeof o === 'boolean') return o;
  if (typeof o === 'string') return okStr(o) ? o : undefined;
  if (Array.isArray(o)) return o.slice(0, 30).map(x => cleanObj(x, depth + 1)).filter(x => x !== undefined);
  if (typeof o === 'object') { const out = {}; for (const [k, v] of Object.entries(o).slice(0, 60)) { if (!/^\w{1,30}$/.test(k)) continue; const c = cleanObj(v, depth + 1); if (c !== undefined) out[k] = c; } return out; }
  return undefined;
}
function cleanLook(L) {
  const out = cleanObj(L) || {};
  if (typeof L?.badge === 'string' && [...L.badge].length <= 3) out.badge = L.badge; // an emoji drawn on a canvas, never as HTML
  return out;
}
function monFromSnap(s, k, side) {
  const e = s.e && ENEMIES.find(x => x.id === s.e), n = (v, lo, hi) => clamp(Math.round(+v || 0), lo, hi), spc = typeof s.sp === 'string' && specOf(s.sp);
  const types = (Array.isArray(s.types) ? s.types : []).filter(t => TYPES[t]).slice(0, 2); if (!types.length) types.push('normal');
  const st = {}, base = {};
  for (const x of ['hp', 'atk', 'def', 'spd', 'spc']) { st[x] = n(s.st?.[x], 1, 999); base[x] = n(s.base?.[x], 1, 255); }
  const moves = (Array.isArray(s.mv) ? s.mv : []).filter(x => Array.isArray(x) && moveById(x[0]) && x[0] !== 'struggle').slice(0, 4).map(([id, max]) => ({ id, pp: n(max, 1, 99), max: n(max, 1, 99) }));
  return { key: side[0] + k, name: e ? e.name : String(s.name || (spc && spc.name) || 'Rival').replace(/[<>&"]/g, '').slice(0, 30), icon: spc ? spc.icon : e ? e.icon : '🧍', ath: !spc && !e && !!s.ath, enemy: e || undefined,
    sp: spc ? spc.id : undefined, held: typeof s.held === 'string' && heldOf(s.held) ? s.held : null, crowd: s.crowd ? 1 : 0, never: s.never ? 1 : 0, wind: s.wind ? 1 : 0,
    types, lv: n(s.lv, 1, 100), base, st, hp: st.hp, status: null, slp: 0, toxN: 0, stg: { atk: 0, def: 0, spd: 0, spc: 0, acc: 0, eva: 0 }, vol: {}, moves, look: cleanLook(s.look), side };
}
function pvpCard() {
  const p = pvpState();
  return { id: p.id, ver: PVP_VER, name: (D.settings.name || acct.username || 'Player').slice(0, 30), user: acct.username || '', r: p.r, team: pvpTeamSnap(), av: avatarSpec() };
}

// ---------- the realtime channel (Supabase Realtime broadcast, Phoenix protocol) ----------
const RT = (() => {
  let ws = null, opening = null, ref = 0, hb = 0;
  const chans = {};
  function raw(topic, event, payload) { if (ws?.readyState !== 1) return null; const r = String(++ref); ws.send(JSON.stringify({ topic, event, payload, ref: r })); return r; }
  async function connect() {
    if (ws?.readyState === 1) return;
    if (opening) return opening;
    const a = acctLoaded ? acct : await loadAccount();
    if (!a.rt?.ws) throw new Error('Online battles are not set up in this version.');
    opening = new Promise((res, rej) => {
      const s = ws = new WebSocket(`${a.rt.ws}?apikey=${encodeURIComponent(a.rt.key)}&vsn=1.0.0`);
      const t = setTimeout(() => { s.close(); rej(new Error("Couldn't reach the battle server.")); }, 10000);
      s.onopen = () => { clearTimeout(t); res(); };
      s.onerror = () => { clearTimeout(t); rej(new Error("Couldn't reach the battle server.")); };
      s.onclose = () => { clearInterval(hb); if (ws === s) ws = null; for (const [k, c] of Object.entries(chans)) { delete chans[k]; c.onClose?.(); } };
      s.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        const c = chans[m.topic]; if (!c) return;
        if (m.event === 'phx_reply' && m.ref === c.joinRef) c.joined?.(m.payload?.status);
        else if (m.event === 'broadcast' && m.payload?.payload) { try { c.on(m.payload.payload); } catch (e) { console.error(e); } }
      };
    }).finally(() => { opening = null; });
    await opening;
    clearInterval(hb); hb = setInterval(() => raw('phoenix', 'heartbeat', {}), 25000);
  }
  async function channel(name, on, onClose) {
    await connect();
    const topic = 'realtime:' + name, a = acct;
    if (chans[topic]) chans[topic].leave();
    const c = { on, onClose };
    chans[topic] = c;
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("The battle server didn't answer.")), 10000);
      c.joined = st => { clearTimeout(t); st === 'ok' ? res() : rej(new Error('The battle server said no.')); };
      c.joinRef = raw(topic, 'phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false }, access_token: a.rt.key });
    });
    c.send = p => raw(topic, 'broadcast', { type: 'broadcast', event: 'm', payload: p });
    c.leave = () => { if (chans[topic] === c) { delete chans[topic]; raw(topic, 'phx_leave', {}); } };
    return c;
  }
  return { channel };
})();

// ---------- finding someone to battle ----------
// PV.st: idle · hosting (waiting with a code) · joining · seeking (quick match) · battle
const PV = { st: 'idle', code: '', msg: '', room: null, lobby: null, timers: [] };
const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
function pvpRedraw() { if (view === 'arena' && ui.arenaPage === 'pvp' && !battle && !modal.open) render(); }
function pvpReset(msg = '') {
  PV.timers.forEach(clearInterval); PV.timers = [];
  PV.room?.leave(); PV.lobby?.leave(); PV.room = PV.lobby = null;
  Object.assign(PV, { st: 'idle', code: '', msg });
  pvpRedraw();
}
const every = (ms, fn) => { fn(); PV.timers.push(setInterval(fn, ms)); };
function sameVer(card) { if (card?.ver === PVP_VER) return true; PV.msg = 'Your friend has a different version of Life Planner. Both of you need the latest update.'; pvpRedraw(); return false; }

async function pvpHost(code = newCode(), quiet) {
  pvpReset(); PV.st = 'hosting'; PV.code = code; PV.msg = 'Connecting…'; pvpRedraw();
  const me = pvpCard();
  try {
    PV.room = await RT.channel('lp-pvp-' + code, m => {
      if (m.t !== 'join' || PV.st !== 'hosting' && PV.st !== 'seeking' || !sameVer(m.card)) return;
      const seed = 1 + Math.floor(Math.random() * 2 ** 31);
      PV.room.send({ t: 'start', to: m.card.id, seed, card: me });
      pvpBegin(true, m.card, seed);
    }, () => PV.st !== 'battle' && pvpReset('Lost the connection to the battle server.'));
  } catch (e) { pvpReset(e.message); return; }
  if (!quiet) { PV.msg = ''; pvpRedraw(); }
}
async function pvpJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (code.length < 4) { toast('Type the 4-letter code', 'Your friend sees it when they host a battle.'); return; }
  pvpReset(); PV.st = 'joining'; PV.code = code; PV.msg = 'Looking for the battle…'; pvpRedraw();
  const me = pvpCard();
  try {
    PV.room = await RT.channel('lp-pvp-' + code, m => {
      if (m.t !== 'start' || m.to !== me.id || PV.st !== 'joining' || !sameVer(m.card)) return;
      pvpBegin(false, m.card, m.seed >>> 0);
    }, () => PV.st !== 'battle' && pvpReset('Lost the connection to the battle server.'));
  } catch (e) { pvpReset(e.message); return; }
  const t0 = Date.now();
  every(2000, () => {
    if (PV.st !== 'joining') return;
    if (Date.now() - t0 > 30000) { pvpReset(`No one is hosting ${code} right now. Check the code with your friend.`); return; }
    PV.room?.send({ t: 'join', card: me });
  });
}
// quick match: everyone looking shouts in the lobby; the lower id hosts, the other joins
async function pvpSeek() {
  const code = newCode(), id = pvpState().id;
  await pvpHost(code, true); if (PV.st !== 'hosting') return;
  PV.st = 'seeking'; PV.msg = 'Looking for someone to battle…'; pvpRedraw();
  try {
    PV.lobby = await RT.channel('lp-pvp-lobby', m => {
      if (m.t !== 'seek' || PV.st !== 'seeking' || m.v !== PVP_VER || !m.id || m.id === id) return;
      if (m.id < id && /^[A-Z0-9]{4}$/.test(m.code)) pvpJoin(m.code);
    });
  } catch (e) { pvpReset(e.message); return; }
  every(2500, () => { if (PV.st === 'seeking') PV.lobby?.send({ t: 'seek', id, code, v: PVP_VER, r: pvpState().r }); });
}
// invites: when you're logged in, your app listens on your own channel
let inviteCh = null;
async function pvpListen() {
  if (ONLINE || inviteCh || !acct.signedIn || !acct.rt) return;
  try {
    inviteCh = await RT.channel('lp-u-' + acct.username, m => {
      if (m.t !== 'invite' || !/^[A-Z0-9]{4}$/.test(m.code) || !friendNames().includes(m.from)) return;
      if (typeof sfx === 'function') try { sfx('chime'); } catch { }
      toast(`⚔️ ${String(m.name || m.from).slice(0, 30)} wants a live battle`, 'Your team against theirs, right now.', { timeout: 60000, actions: [['Battle!', () => { if (battle) return; view = 'arena'; ui.arenaPage = 'pvp'; render(); pvpJoin(m.code); }]] });
    }, () => { inviteCh = null; setTimeout(pvpListen, 30000); });
  } catch { inviteCh = null; setTimeout(pvpListen, 60000); }
}
async function pvpInvite(user) {
  if (!/^[a-z0-9_]{3,20}$/.test(user)) return;
  await pvpHost(); if (PV.st !== 'hosting') return;
  PV.msg = `Invite sent to @${user}. Waiting for them to accept…`; pvpRedraw();
  try { const c = await RT.channel('lp-u-' + user, () => { }); c.send({ t: 'invite', from: acct.username, name: D.settings.name || acct.username, code: PV.code }); setTimeout(() => c.leave(), 3000); }
  catch (e) { PV.msg = e.message; pvpRedraw(); }
}

// ---------- a live battle ----------
function pvpLink(isHost, oppId) {
  const box = {}, wait = {}, me = pvpState().id;
  let lastHeard = Date.now(), B = null;
  const L = {
    live: true, gone: false,
    rank: side => (side === 'me') === isHost ? 0 : 1,
    send: p => PV.room?.send({ ...p, from: me }),
    hear(m) {
      if (m.from !== oppId) return; lastHeard = Date.now();
      if (m.t === 'forfeit') return L.lost('gave up');
      if (m.t === 'act' || m.t === 'swap') { const k = m.t + ':' + m.turn; if (wait[k]) { const w = wait[k]; delete wait[k]; w(m); } else box[k] = m; }
    },
    recvMsg(t, turn) {
      const k = t + ':' + turn;
      if (box[k]) { const m = box[k]; delete box[k]; return Promise.resolve(m); }
      if (L.gone) return Promise.resolve(null);
      return new Promise(res => { wait[k] = res; L.onGone = () => res(null); });
    },
    recv: async (t, turn) => (await L.recvMsg(t, turn))?.v ?? null,
    has: (t, turn) => !!box[t + ':' + turn],
    lost(why) { if (L.gone || !B || B.over) return; L.gone = why; L.onGone?.(); say(`${B.e.name} ${why}.`, 1200).then(() => { if (battle === B && !B.over) endBattle(true); }); },
    async exchange(mine) {
      const T = B.turn, hp = pvpHash();
      L.send({ t: 'act', turn: T, h: hp, v: { kind: mine.kind, mv: mine.mv?.id, to: mine.to, id: mine.id } });
      const box2 = document.getElementById('bText');
      if (box2 && !L.has('act', T)) box2.innerHTML = `Waiting for <b>${esc(B.e.name)}</b> to choose…`;
      const msg = await L.recvMsg('act', T), v = msg?.v;
      if (!v || B.over) return null;
      if (msg.h !== hp) { L.desync = (L.desync || 0) + 1; console.warn('PvP out of sync on turn', T, msg.h, hp); }
      const them = cur('them'), f = forcedMove(them);
      if (v.kind === 'switch') return { kind: 'switch', to: clamp(v.to | 0, 0, B.sides.them.team.length - 1) };
      if (v.kind === 'item' && BAG[v.id]) return { kind: 'item', id: v.id };
      if (f && (v.mv === f.id)) return { kind: 'move', mv: f };
      return { kind: 'move', mv: moveById(v.mv) || moveById('struggle') };
    },
    attach(b) { B = b; },
  };
  // checks of the opponent's state are made in the same order on both sides: host's team first
  const pvpHash = () => { const sides = isHost ? ['me', 'them'] : ['them', 'me']; return sides.map(s => B.sides[s].team.map(m => m.hp).join('.')).join('|'); };
  // pings keep the link alive; two minutes of silence counts as leaving
  const ping = setInterval(() => {
    if (!B || B.over || battle !== B) { clearInterval(ping); return; }
    L.send({ t: 'ping' });
    if (Date.now() - lastHeard > PVP_WAIT) L.lost('lost connection');
  }, 5000);
  L.close = () => clearInterval(ping);
  return L;
}
function pvpBegin(isHost, opp, seed) {
  if (battle) return;
  PV.timers.forEach(clearInterval); PV.timers = []; PV.lobby?.leave(); PV.lobby = null;
  PV.st = 'battle'; PV.msg = '';
  const me = pvpCard(), link = pvpLink(isHost, opp.id);
  const room = PV.room;
  room.on = m => link.hear(m);
  room.onClose = () => link.lost('lost connection');
  startPvpBattle('pvp', me.team, opp, link, seed);
}
function startPvpBattle(mode, myTeam, opp, link, seed) {
  const mine = myTeam.map((s, k) => monFromSnap(s, k, 'me')), them = (opp.team || []).slice(0, PVP_TEAM).map((s, k) => monFromSnap(s, k, 'them'));
  if (!them.length) { toast('That team is empty', 'Ask them to open the Arena once to save their team.'); return; }
  // your own athlete keeps your avatar; theirs gets the one they sent
  for (const m of mine) if (m.ath) { m.av = null; m.look = null; }
  const oppAv = cleanObj(opp.av); for (const m of them) if (m.ath) m.av = oppAv;
  battle = { mode, i: -1, turn: 0, over: false, win: false, busy: true, boosts: [], wave: 1, seed, ready: { hp: 0 }, bag: { water: 2, physio: 1 }, bagThem: { water: 2, physio: 1 }, menu: '', moved: new Set(), ai: {} };
  const B = battle;
  B.e = { id: mode, name: String(opp.name || 'Rival').replace(/[<>&"]/g, '').slice(0, 30), icon: mode === 'pvp' ? '🌐' : '👻', league: 'national', r: 92, bias: {}, line: '' };
  B.opp = { name: B.e.name, user: /^[a-z0-9_]{3,20}$/.test(opp.user || '') ? opp.user : '', r: clamp(+opp.r || PVP_START, 100, 4000) };
  B.sides = { me: { team: mine, cur: 0 }, them: { team: them, cur: 0 } };
  if (link) { B.pvp = link; link.attach(B); bRand = rng(seed); }
  for (const m of mine) if (m.ath) m.key = 'me';
  openBattleFx();
  pvpIntro();
}
async function pvpIntro() {
  const B = battle, live = B.mode === 'pvp';
  banner(live ? '🌐 LIVE BATTLE' : '👻 SAVED TEAM', 'boss');
  await say(live ? `${B.e.name} (${pvpTier(B.opp.r)[1]}, ${B.opp.r}) is ready to battle!` : `You're up against ${B.e.name}'s saved team. The computer plays it.`);
  if (battle !== B) return;
  await sendIn('them', 0); await sendIn('me', 0);
  if (battle !== B || B.over) return;
  B.busy = false; drawControls();
}
function pvpFinish(B, win) {
  bRand = Math.random;
  const p = pvpState(), at = new Date().toISOString(), live = B.mode === 'pvp';
  if (live) { if (!win && !B.pvp.gone && alive('me').length) B.pvp.send({ t: 'forfeit' }); B.pvp.close(); setTimeout(() => { PV.room?.leave(); PV.room = null; Object.assign(PV, { st: 'idle', code: '' }); }, 1500); }
  // saved teams only count for rating once per friend per day
  p.ghost = p.ghost || {};
  const counts = live || p.ghost[B.opp.user || B.opp.name] !== today();
  if (!live) p.ghost[B.opp.user || B.opp.name] = today();
  const d = counts ? elo(p.r, B.opp.r, win, live ? 32 : 16) : 0;
  p.r = Math.max(100, p.r + d); if (win) p.w++; else p.l++;
  p.best = Math.max(p.best || PVP_START, p.r);
  p.log = [{ at, name: B.opp.name, user: B.opp.user, live, win, d, r: p.r }, ...(p.log || [])].slice(0, 30);
  const reward = win ? (live ? 40 : 25) : 8;
  D.arena.ledger['pvp:' + at] = reward;
  D.arena.battles = [...(D.arena.battles || []), { at, e: live ? 'pvp' : 'ghost', win, mode: B.mode }].slice(-300);
  Object.assign(B, { reward, rDelta: d, counted: counts, loot: [] });
  if (typeof publishMe === 'function') setTimeout(() => publishMe(true), 500);
}
function pvpResultHtml(B) {
  const p = pvpState(), t = pvpTier(p.r), d = B.rDelta;
  return `<div class="bresult ${B.win ? 'win' : 'lose'}"><h2>${B.win ? `🏆 You beat ${esc(B.e.name)}!` : `😤 ${esc(B.e.name)} wins this one`}</h2>
    <p>${B.pvp?.gone && B.win ? `They ${esc(B.pvp.gone)}. ` : ''}<b>+${B.reward} ${GRIT}</b> · Rating <b>${p.r}</b> ${B.counted ? `<span class="${d >= 0 ? 'green-text' : 'red-text'}">(${d >= 0 ? '+' : ''}${d})</span>` : '<span class="muted">(already counted today)</span>'} ${tierChip(p.r)}</p>
    <button class="btn primary" data-bm="close">Back to the Arena</button></div>`;
}
function pvpGhost(user) {
  const f = friendRows.find(x => x.user === user), s = f?.raw?.pvp;
  if (!s?.team?.length) { toast('No saved team yet', 'They need to open the Arena on the latest version first.'); return; }
  if (s.ver !== PVP_VER) { toast('Different version', 'One of you needs to update Life Planner first.'); return; }
  startPvpBattle('ghost', pvpTeamSnap(), { name: f.name, user: f.user, r: s.r, team: s.team, av: f.av }, null, 0);
}
// what goes up with your leaderboard row
function pvpPublish() { const p = pvpState(); return { ver: PVP_VER, r: p.r, w: p.w, l: p.l, best: p.best || p.r, team: pvpTeamSnap() }; }

// ---------- the PvP page ----------
function arenaPvp() {
  if (ONLINE) return '<div class="card"><p>PvP battles live in the PC app.</p></div>';
  if (!acctLoaded) loadAccount().then(() => { if (view === 'arena') render(); });
  const p = pvpState(), t = pvpTier(p.r), nx = pvpNext(p.r), lo = t[0], hi = nx ? nx[0] : lo + 200;
  const games = p.w + p.l, rows = [{ me: true, name: D.settings.name || 'You', user: acct.username, r: p.r, w: p.w, l: p.l, av: avatarSpec() },
    ...friendRows.filter(f => f.raw?.pvp).map(f => ({ name: f.name, user: f.user, r: f.raw.pvp.r || PVP_START, w: f.raw.pvp.w || 0, l: f.raw.pvp.l || 0, av: f.av, team: !!f.raw.pvp.team?.length, ver: f.raw.pvp.ver }))].sort((a, b) => b.r - a.r);
  const noPvp = friendRows.filter(f => !f.raw?.pvp);
  const busy = PV.st !== 'idle' && PV.st !== 'battle';
  const live = !acct.rt ? '<p class="muted">Live battles need the latest Life Planner with friend accounts turned on.</p>'
    : busy ? `<div class="pvpwait"><div class="gbwait"><i></i><i></i><i></i></div><div class="main">${PV.st === 'hosting' ? `<div class="unlabel">Your battle code</div><div class="pvpcode">${esc(PV.code)}</div><p class="muted small-text">Send this code to a friend. They tap <b>Join</b> and type it in.</p>` : ''}
        <b>${esc(PV.msg || (PV.st === 'seeking' ? 'Looking for someone to battle…' : PV.st === 'joining' ? 'Joining…' : 'Waiting for someone to join…'))}</b></div><button class="btn" data-pvp="cancel">Cancel</button></div>`
    : `<div class="pvpbtns"><button class="btn primary big" data-pvp="seek">⚡ Quick match</button><button class="btn big" data-pvp="host">🔑 Host with a code</button></div>
      <div class="row pvpjoin"><input id="pvpCode" placeholder="CODE" maxlength="6" autocomplete="off" spellcheck="false"><button class="btn" data-pvp="join">Join</button></div>
      ${PV.msg ? `<p class="muted small-text">${esc(PV.msg)}</p>` : ''}`;
  const team = pvpTeamMons();
  if (!team.length) return '<div class="card"><h2>🌐 PvP</h2><p>Pick your first creature on the Team tab, then come back to battle your friends.</p><button class="btn primary" data-act="arenaPage" data-v="team">🐾 Team</button></div>';
  return `<div class="pvp-top">
    <div class="card pvprank" style="--tc:${t[3]}"><div class="pvp-emblem">${t[2]}</div><div class="main"><div class="unlabel">Ranked</div><h2>${t[1]} <span class="pvp-r">${p.r}</span></h2>
      <div class="meter"><i style="width:${Math.min(100, (p.r - lo) / Math.max(1, hi - lo) * 100).toFixed(0)}%;background:${t[3]}"></i></div>
      <div class="muted small-text">${nx ? `${nx[0] - p.r} to ${nx[2]} ${nx[1]}` : 'Top tier'} · ${games ? `${p.w} won, ${p.l} lost` : 'No ranked games yet'}${p.best > p.r ? ` · best ${p.best}` : ''}</div></div></div>
    <div class="card pvplive"><div class="card-head"><h2>🌐 Live battle</h2><span class="muted small-text">3 against 3 · +40 ${GRIT} a win</span></div>${live}</div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-head"><h2>🏆 Ranked ladder</h2><span class="muted small-text">you and your friends</span></div>
      ${!acct.signedIn ? `<p class="muted small-text">Log in on the Friends page to see your friends' ranks and fight their saved teams.</p><button class="btn" data-act="goto" data-v="friends">👥 Friends</button>` : ''}
      <ol class="pvpladder">${rows.map((r, k) => `<li class="${r.me ? 'me' : ''}"><span class="lpos">${k + 1}</span>${safeBadge(r.av, 34)}<div class="main"><b>${esc(r.me ? 'You' : r.name)}</b><span class="muted small-text">${r.r} · ${r.w}–${r.l}</span></div>${tierChip(r.r)}
        ${r.me ? '' : `<span class="lbtns">${acct.rt && !busy ? `<button class="btn small primary" data-pvp="invite" data-u="${esc(r.user)}" title="Invite them to a live battle">⚔️ Live</button>` : ''}${r.team && r.ver === PVP_VER ? `<button class="btn small" data-pvp="ghost" data-u="${esc(r.user)}" title="Fight their saved team (the computer plays it)">👻 Saved team</button>` : ''}</span>`}</li>`).join('')}</ol>
      ${noPvp.length ? `<p class="muted small-text">${noPvp.map(f => esc(f.name)).join(', ')} ${noPvp.length === 1 ? "hasn't" : "haven't"} played PvP yet.</p>` : ''}
      <p class="muted small-text">Everyone starts at ${PVP_START}. A live win against someone rated higher moves you up more. Saved teams count half, once per friend a day.</p></div>
    <div class="stack">
      <div class="card"><div class="card-head"><h2>Your PvP team</h2><button class="btn small" data-act="arenaPage" data-v="team">Change →</button></div>
        <ul class="pvpteam">${team.map(m => `<li><span class="gbmic">${m.ath ? '🧍' : m.icon}</span><div class="main"><b>${esc(m.name)} <small>Lv${m.lv}</small></b><div>${typeChips(m.types)}</div></div><span class="muted small-text">${m.moves.map(x => moveById(x.id).icon).join(' ')}</span></li>`).join('')}</ul>
        <p class="muted small-text">Your creature team (up to ${PVP_TEAM}), at full health. No boosts or readiness bonus, so it's fair. Trainer stats, held items and team buffs still count.</p></div>
      <div class="card"><div class="card-head"><h2>Recent matches</h2></div>${(p.log || []).length ? `<ul class="pvplog">${p.log.slice(0, 8).map(g => `<li class="${g.win ? 'win' : 'lose'}"><b>${g.win ? 'Won' : 'Lost'}</b><span class="main">${g.live ? '🌐' : '👻'} vs ${esc(g.name)}</span><span class="muted small-text">${esc(ago(g.at))}</span><span class="${g.d >= 0 ? 'green-text' : 'red-text'}">${g.d >= 0 ? '+' : ''}${g.d}</span></li>`).join('')}</ul>` : '<p class="muted small-text">No matches yet. Try a quick match.</p>'}</div>
    </div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pvp]'); if (!b) return;
  const a = b.dataset.pvp;
  if (a === 'seek') pvpSeek();
  else if (a === 'host') pvpHost();
  else if (a === 'join') pvpJoin(document.getElementById('pvpCode')?.value);
  else if (a === 'cancel') pvpReset();
  else if (a === 'invite') pvpInvite(b.dataset.u);
  else if (a === 'ghost') pvpGhost(b.dataset.u);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pvpCode') pvpJoin(e.target.value); });
setTimeout(() => { if (!ONLINE) loadAccount().then(() => { pvpListen(); if (acct.signedIn) refreshFriends(); }); }, 3000);
