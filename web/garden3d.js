// ---------- 3D garden ----------
// The forest as an isometric island of grass tiles. Trees and decorations sit
// on tiles and can be dragged to another tile (dropping on a taken tile swaps
// the two). Positions live in D.game.gridPos as "row,col". Animals and critters
// roam between tiles, trees bend when your pointer brushes through them, and
// the sky has effects you can switch on and off (D.game.fx).

const ISO_W = 128, ISO_H = 64, ISO_D = 26;
const isoXY = (r, c) => [(c - r) * ISO_W / 2, (c + r) * ISO_H / 2];
const GARDEN_FX = [['clouds', '☁️ Clouds'], ['weather', '🍂 Falling leaves and weather'], ['rays', '🌤️ Sun rays'], ['fireflies', '✨ Fireflies at night'], ['critters', '🐾 Roaming animals'], ['flowers', '🌼 Flowers in the grass'], ['bubbles', '🍃 Leaf bubbles on trees']];
const gfx = k => ((D.game.fx || {})[k] ?? true);

function gardenLayout(logs) {
  const pos = D.game.gridPos = D.game.gridPos || {};
  const decos = groundItems().filter(g => (itemById(g.id) || {}).type !== 'animal');
  const valid = new Set([...D.focusLogs.filter(l => l.mins >= 10).map(l => l.id), ...decos.map(g => 'g:' + g.id)]);
  for (const k of Object.keys(pos)) if (!valid.has(k)) delete pos[k];
  const seen = new Set();
  const things = [...logs.map(l => ({ key: l.id, l })), ...decos.map(g => ({ key: 'g:' + g.id, g }))].filter(t => !seen.has(t.key) && seen.add(t.key));
  let N = Math.max(8, Math.ceil(Math.sqrt(things.length * 2.2)));
  for (const t of things) { const p = pos[t.key]; if (p) { const [r, c] = p.split(',').map(Number); N = Math.max(N, r + 1, c + 1); } }
  N = Math.min(N, 24);
  // the 3D island is bigger: once, move the old corner layout to the middle
  if (!D.game.grid3 && typeof webglOK === 'function' && webglOK()) {
    const ps = Object.values(pos).map(p => p.split(',').map(Number));
    if (ps.length) { const mr = Math.max(...ps.map(p => p[0])), mc = Math.max(...ps.map(p => p[1])), dr = Math.max(0, Math.floor((N - 1 - mr) / 2)), dc = Math.max(0, Math.floor((N - 1 - mc) / 2));
      for (const k of Object.keys(pos)) { const [r, c] = pos[k].split(',').map(Number); pos[k] = `${r + dr},${c + dc}`; } }
    D.game.grid3 = 1;
  }
  const taken = {};
  for (const t of things) {
    const p = pos[t.key];
    if (!p || taken[p]) continue;
    const [r, c] = p.split(',').map(Number);
    if (r < N && c < N) { t.r = r; t.c = c; taken[p] = t.key; }
  }
  // new things fill free tiles from the middle outwards
  const free = [];
  const reserved = new Set(Object.values(pos)); // tiles kept for trees outside this week or month
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!taken[`${r},${c}`] && !reserved.has(`${r},${c}`)) free.push([r, c]);
  const mid = (N - 1) / 2, dist = ([r, c]) => Math.hypot(r - mid, c - mid);
  const gap = ([r, c]) => dist([r, c]) + (r % 2 || c % 2 ? 3 : 0); // leave a tile between things first, so trees have room to spread
  free.sort((a, b) => gap(a) - gap(b) || a[0] - b[0] || a[1] - b[1]);
  let k = 0;
  for (const t of things) if (t.r == null && k < free.length) { [t.r, t.c] = free[k++]; pos[t.key] = `${t.r},${t.c}`; taken[pos[t.key]] = t.key; }
  return { N, things: things.filter(t => t.r != null), taken };
}

// little clumps of grass and flowers so tiles don't look flat
function tileDetail(r, c, top, night) {
  const rnd = seeded(`tile${r},${c}`), [x, y] = isoXY(r, c);
  let out = '';
  const dk = shade(top, -.22), lt = shade(top, .18);
  for (let i = 0; i < 4; i++) {
    const u = rnd() - .5, v = rnd() - .5, px = Math.round(x + (u + v) * ISO_W * .42), py = Math.round(y + (v - u) * ISO_H * .42);
    out += `<path d="M${px - 4} ${py} q1 -7 2 -9 M${px} ${py} q0 -9 0 -11 M${px + 4} ${py} q-1 -7 -2 -9" stroke="${i % 2 ? dk : lt}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  if (gfx('flowers') && rnd() < .3) {
    const u = rnd() - .5, v = rnd() - .5, px = Math.round(x + (u + v) * ISO_W * .38), py = Math.round(y + (v - u) * ISO_H * .38);
    const f = ['#fff', '#ffd43b', '#f783ac', '#b197fc', '#ff8787'][Math.floor(rnd() * 5)];
    out += `<g opacity="${night ? .6 : 1}"><path d="M${px} ${py} v-7" stroke="${dk}" stroke-width="1.3"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(px + 3 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(py - 8 + 2.2 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="2" fill="${f}"/>`).join('')}<circle cx="${px}" cy="${py - 8}" r="1.4" fill="#f59f00"/></g>`;
  }
  return out;
}
function cloud(x, y, s, o) {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="46" ry="18" fill="#fff"/><circle cx="-18" cy="-10" r="18" fill="#fff"/><circle cx="10" cy="-16" r="24" fill="#fff"/><circle cx="34" cy="-4" r="14" fill="#fff"/></g>`;
}

function forestGrid(logs) {
  const sc = SCENES[D.game.scene] || SCENES.meadow, hr = new Date().getHours();
  const night = sc.night || hr >= 20 || hr < 6;
  const sky = sc.night ? (sc.sky || ['#0b1a3a', '#24406e']) : night ? ['#16204a', '#3a4a86'] : sc.sky || ['#6ec1ff', '#e6f6ff'];
  const top = night && !sc.night ? shade(sc.g1, -.35) : sc.g1, top2 = night && !sc.night ? shade(sc.g2, -.35) : sc.g2;
  const { N, things } = gardenLayout(logs);
  const pad = 175, W = N * ISO_W + 40, H = N * ISO_H + ISO_D + pad + 30, ox = W / 2, oy = pad;
  const rnd = seeded('sky' + D.game.scene);
  // sky: sun or moon, stars, hills and clouds
  let skyArt = '';
  if (night) {
    skyArt += Array.from({ length: 90 }, () => `<circle class="twinkle" cx="${Math.round(rnd() * W * 2 - W / 2)}" cy="${Math.round(rnd() * pad * 1.4 - 40)}" r="${(rnd() * 1.4 + .4).toFixed(1)}" fill="#fff" style="animation-delay:-${(rnd() * 4).toFixed(1)}s"/>`).join('');
    skyArt += `<g transform="translate(${W * .82} ${pad * .38})"><circle r="38" fill="#fff3bf" opacity=".15"/><circle r="22" fill="#fff9db"/><circle cx="-6" cy="-4" r="4" fill="#e9ecef"/><circle cx="7" cy="6" r="3" fill="#e9ecef"/></g>`;
    if (sc.night && !sc.noAurora) skyArt += `<path class="aurora" d="M0 ${pad * .45} Q${W * .25} ${pad * .1} ${W * .5} ${pad * .4} T${W} ${pad * .3}" stroke="#63e6be" stroke-width="34" fill="none" opacity=".45" filter="url(#gblur)"/>`;
  } else {
    skyArt += `<g transform="translate(${W * .84} ${pad * .4})"><circle r="70" fill="#fff9db" opacity=".25"/><circle r="44" fill="#fff3bf" opacity=".5"/><circle r="28" fill="#ffe066"/></g>`;
    if (gfx('rays')) skyArt += `<g class="sunrays" transform="translate(${W * .84} ${pad * .4})">${Array.from({ length: 6 }, (_, i) => `<path d="M0 0 L${-W} ${Math.round(H * (.2 + i * .18))} L${-W} ${Math.round(H * (.27 + i * .18))} Z" fill="#fff9db" opacity=".09"/>`).join('')}</g>`;
  }
  const hills = `<path d="M${-W} ${pad + 20} Q${-W * .5} ${pad - 40} 0 ${pad + 40} Q${W * .15} ${pad - 50} ${W * .32} ${pad + 10} T${W * .66} ${pad - 10} T${W} ${pad + 20} T${W * 1.5} ${pad} T${W * 2} ${pad + 20} V${H * 2} H${-W}Z" fill="${shade(sc.hills, night ? -.5 : .15)}" opacity=".7"/>
    <path d="M${-W} ${pad + 60} Q${-W * .5} ${pad + 10} 0 ${pad + 90} Q${W * .22} ${pad + 10} ${W * .45} ${pad + 70} T${W} ${pad + 50} T${W * 1.5} ${pad + 70} T${W * 2} ${pad + 50} V${H * 2} H${-W}Z" fill="${shade(sc.hills, night ? -.45 : 0)}"/>`;
  const clouds = gfx('clouds') ? `<g class="clouds">${Array.from({ length: 6 }, (_, i) => `<g class="cloud" style="--cx:${-W * .6}px;--cw:${W * 1.6}px;animation-duration:${60 + i * 17}s;animation-delay:-${Math.round(rnd() * 80)}s">${cloud(0, Math.round(30 + rnd() * (pad - 40)), (.6 + rnd() * .9).toFixed(2), night ? .18 : .85)}</g>`).join('')}</g>` : '';
  // the island
  const tiles = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const [x, y] = isoXY(r, c), hw = ISO_W / 2, hh = ISO_H / 2;
    const fill = (r + c) % 2 ? top : top2;
    const soil = night ? '#3b2a1e' : '#7a5236', soilD = night ? '#2c1f16' : '#5e3f29';
    const edge = [r === N - 1 ? `<path d="M${x - hw} ${y} L${x} ${y + hh} L${x} ${y + hh + ISO_D} L${x - hw} ${y + ISO_D} Z" fill="${soil}"/><path d="M${x - hw} ${y} L${x} ${y + hh} L${x} ${y + hh + 7} L${x - hw} ${y + 7} Z" fill="${shade(fill, -.18)}"/>` : '',
      c === N - 1 ? `<path d="M${x} ${y + hh} L${x + hw} ${y} L${x + hw} ${y + ISO_D} L${x} ${y + hh + ISO_D} Z" fill="${soilD}"/><path d="M${x} ${y + hh} L${x + hw} ${y} L${x + hw} ${y + 7} L${x} ${y + hh + 7} Z" fill="${shade(fill, -.3)}"/>` : ''].join('');
    tiles.push(`${edge}<path class="gtile" data-rc="${r},${c}" d="M${x} ${y - hh} L${x + hw} ${y} L${x} ${y + hh} L${x - hw} ${y} Z" fill="url(#gt${(r + c) % 2})"/>`);
  }
  const details = Array.from({ length: N * N }, (_, i) => tileDetail(Math.floor(i / N), i % N, top, night)).join('');
  const pend = typeof pendingLeaves === 'function' ? pendingLeaves() : 0;
  let bubbles = gfx('bubbles') && pend > 0 ? Math.min(6, 1 + Math.floor(pend / Math.max(1, basketCap()) * 6)) : 0;
  const items = things.sort((a, b) => (a.r + a.c) - (b.r + b.c) || a.c - b.c).map((t, i) => {
    const [x, y] = isoXY(t.r, t.c), d = (t.r + t.c) * 100 + t.c;
    if (t.g) return `<g class="gpos" data-d="${d}" transform="translate(${x} ${y})"><g class="gtree deco" data-key="${esc(t.key)}"><g class="sway"><g transform="scale(1.25)">${t.g.svg}</g></g></g></g>`;
    const l = t.l, s = subj(l.subjectId), bub = bubbles > 0 && i % 2 === 0 ? (bubbles--, true) : false;
    return `<g class="gpos" data-d="${d}" data-x="${x}" data-y="${y + 6}" transform="translate(${x} ${y + 6})"><g class="gtree ${l.withered ? 'withered' : treeRec(l.id).wilted ? 'wilt' : ''}" data-key="${esc(t.key)}" data-act="treeInfo" data-id="${l.id}" style="animation-delay:${Math.min(i * 30, 1200)}ms">
      <title>${esc(treeName(l))} · ${esc(s.name)} · ${fmtMins(l.mins)} · ${fmtDate(l.date)} (drag to move, click for details)</title><g class="sway"><g transform="scale(1.4)">${treeG(speciesFor(l.subjectId), s.color, treeStage(l.mins), l.id)}</g></g></g>
      ${bub ? `<g class="leafbub" data-act="collectLeaves" transform="translate(0 ${-[54, 106, 160, 190][treeStage(l.mins)]})"><g class="bubin"><circle r="15" fill="#fff" opacity=".92" stroke="#40c057" stroke-width="2"/><text y="6" text-anchor="middle" font-size="17">🍃</text></g><title>Collect your leaves</title></g>` : ''}</g>`;
  }).join('');
  const empty = logs.length ? '' : `<text x="${ox}" y="${oy - 60}" text-anchor="middle" font-size="24" font-weight="700" fill="${night ? '#e9f5e9' : '#2b5a2a'}">Study for 10+ minutes to plant your first tree.</text>`;
  // things that move
  const roamers = gfx('critters') ? [
    ...ITEMS.filter(i => i.type === 'animal' && i.at && owned(i.id) && !D.game.hidden[i.id]).map(i => ({ id: i.id, svg: `<g transform="scale(1.1)">${decoSvg(i.id)}</g>`, title: i.name })),
    ...CRITTERS.filter(k => crit(k.id) && !k.fly).map(k => ({ id: k.id, svg: `<text font-size="34" text-anchor="middle" y="-4">${k.emoji}</text>`, title: `${k.name}: ${k.buff}` })),
  ] : [];
  const rr = seeded('roam' + today());
  const roam = roamers.map(a => { const r = Math.floor(rr() * N), c = Math.floor(rr() * N), [x, y] = isoXY(r, c);
    return `<g class="gpos roam" data-d="${(r + c) * 100 + c}" data-r="${r}" data-c="${c}" style="transform:translate(${x}px,${y}px)"><g class="roamface"><g class="roambob">${a.svg}</g></g><title>${esc(a.title)}</title></g>`; }).join('');
  const flyers = gfx('critters') ? CRITTERS.filter(k => crit(k.id) && k.fly).map((k, i) => { const [x, y] = isoXY(Math.floor(rr() * N), Math.floor(rr() * N));
    return `<g transform="translate(${x} ${y - 90})"><text class="critfly" style="animation-delay:-${i * 1.3}s" font-size="26" text-anchor="middle"><title>${esc(k.name)}: ${esc(k.buff)}</title>${k.emoji}</text></g>`; }).join('') : '';
  let air = '';
  if (owned('a_butterfly')) air += [['#f783ac', 0], ['#ffd43b', 3], ['#74c0fc', 6]].map(([f, dl]) => { const [x, y] = isoXY(Math.floor(rr() * N), Math.floor(rr() * N));
    return `<g transform="translate(${x} ${y - 50})"><g class="flutter" style="animation-delay:-${dl}s"><g transform="scale(1.3)"><path class="wing" d="M0 0 C-10 -12 -14 2 0 2 C-10 4 -6 12 0 2 C6 12 10 4 0 2 C14 2 10 -12 0 0Z" fill="${f}"/><path d="M0 -3 v8" stroke="#343a40" stroke-width="1.4"/></g></g></g>`; }).join('');
  let sky2 = '';
  if (owned('a_birds')) sky2 += `<g class="gbirds" style="--cx:${-W * .6}px;--cw:${W * 1.6}px"><g transform="translate(0 ${Math.round(pad * .45)})">${[[0, 0], [30, 12], [58, -4], [86, 8]].map(([x, y]) => `<path class="flap" d="M${x} ${y} q7 -7 14 0 q7 -7 14 0" stroke="${night ? '#ced4da' : '#343a40'}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')}</g></g>`;
  if (owned('d_balloon') && !D.game.hidden.d_balloon) sky2 += `<g transform="translate(${Math.round(W * .2)} ${Math.round(pad * .75)})"><g class="gballoon"><g transform="scale(1.3)">${decoSvg('d_balloon')}</g></g></g>`;
  // weather and fireflies drift over the whole picture
  let weather = '';
  if (gfx('weather')) {
    const wr = seeded('w' + D.game.scene), col = sc.fall || ['#8ce99a', '#69db7c', '#ffd43b'];
    weather = Array.from({ length: sc.rain ? 60 : 22 }, (_, i) => { const x = Math.round(wr() * W * 1.6 - W * .3), f = col[i % col.length];
      if (sc.rain) return `<g class="gfall rain" style="--sway:-40px;--fallh:${H}px;animation-duration:${(1 + wr() * .7).toFixed(2)}s;animation-delay:-${(wr() * 2).toFixed(2)}s"><path d="M${x} ${-pad} l-4 16" stroke="#a5d8ff" stroke-width="2" stroke-linecap="round" opacity=".8"/></g>`;
      return `<g class="gfall" style="--sway:${Math.round((wr() - .5) * 200)}px;--fallh:${H}px;animation-duration:${(9 + wr() * 9).toFixed(1)}s;animation-delay:-${(wr() * 18).toFixed(1)}s">${D.game.scene === 'winter' ? `<circle cx="${x}" cy="0" r="${(2 + wr() * 2.5).toFixed(1)}" fill="#fff"/>` : `<ellipse cx="${x}" cy="0" rx="6" ry="3" fill="${f}" transform="rotate(${Math.round(wr() * 180)} ${x} 0)"/>`}</g>`; }).join('');
  }
  const ff = night && gfx('fireflies') ? Array.from({ length: 18 }, (_, i) => { const [x, y] = isoXY(rr() * N, rr() * N);
    return `<circle class="firefly" cx="${Math.round(x + ox)}" cy="${Math.round(y + oy - 20 - rr() * 60)}" r="2.6" fill="#ffe066" style="animation-delay:-${(i * .7).toFixed(1)}s;animation-duration:${(4 + rr() * 4).toFixed(1)}s"/>`; }).join('') : '';
  return `<svg class="scene iso" style="background:${sky[0]}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Your garden: ${logs.length} trees. Drag a tree to move it.">
    <defs><filter id="gblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="12"/></filter><linearGradient id="isosky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
      <linearGradient id="gt0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(top2, .1)}"/><stop offset="1" stop-color="${shade(top2, -.06)}"/></linearGradient>
      <linearGradient id="gt1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(top, .1)}"/><stop offset="1" stop-color="${shade(top, -.06)}"/></linearGradient>
      <radialGradient id="isoshadow"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}" fill="url(#isosky)"/>${skyArt}${clouds}${hills}${sky2}${empty}
    <ellipse cx="${ox}" cy="${oy + N * ISO_H / 2 + ISO_D + 24}" rx="${N * ISO_W * .55}" ry="${N * ISO_H * .32}" fill="url(#isoshadow)"/>
    <g class="board" transform="translate(${ox} ${oy})">${tiles.join('')}<g class="gdetail" pointer-events="none">${details}</g><g class="gitems">${items}${roam}</g>${flyers}${air}</g>${weather}${ff}</svg>`;
}
function gardenFxPanel() {
  return `<details class="gfxpanel" ${ui.gfxOpen ? 'open' : ''}><summary class="btn small">✨ Effects</summary><div class="gfxlist">${GARDEN_FX.map(([k, l]) => `<label><input type="checkbox" data-change="gardenFx" data-v="${k}" ${gfx(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></details>`;
}

// keep roamers in the right depth order among the trees
function placeInDepth(g) {
  const parent = g.parentNode, d = +g.dataset.d;
  const next = [...parent.children].find(x => x !== g && +x.dataset.d > d);
  if (next) { if (g.nextSibling !== next) parent.insertBefore(g, next); } else if (parent.lastChild !== g) parent.appendChild(g);
}
// animals wander to a neighbouring tile every few seconds
setInterval(() => {
  if (document.hidden) return;
  const svg = document.querySelector('svg.iso'); if (!svg) return;
  const N = Math.round(Math.sqrt(svg.querySelectorAll('.gtile').length));
  svg.querySelectorAll('.gpos.roam').forEach(g => {
    if (Math.random() < .45) return;
    let r = +g.dataset.r, c = +g.dataset.c;
    const [dr, dc] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    r = Math.max(0, Math.min(N - 1, r + dr)); c = Math.max(0, Math.min(N - 1, c + dc));
    const [x0] = isoXY(+g.dataset.r, +g.dataset.c), [x, y] = isoXY(r, c);
    g.dataset.r = r; g.dataset.c = c; g.dataset.d = (r + c) * 100 + c;
    if (x !== x0) g.querySelector('.roamface').style.transform = x < x0 ? 'scaleX(-1)' : '';
    placeInDepth(g);
    g.classList.add('walking'); g.style.transform = `translate(${x}px,${y}px)`;
    setTimeout(() => g.classList.remove('walking'), 2400);
  });
}, 2600);

// Brushing: moving the pointer through trees pushes them over, and each one
// springs back with a little wobble. Nothing moves while the pointer is still.
const brush = new Map();
let brushLoop = 0, brushLast = null;
function brushTick() {
  let live = false;
  for (const [el, s] of brush) {
    s.v += -.07 * s.a - .11 * s.v; s.a += s.v;
    if (Math.abs(s.a) < .05 && Math.abs(s.v) < .05) { el.style.transform = ''; brush.delete(el); continue; }
    live = true; el.style.transform = `rotate(${s.a.toFixed(2)}deg) skewX(${(-s.a * .25).toFixed(2)}deg)`;
  }
  brushLoop = live ? requestAnimationFrame(brushTick) : 0;
}
document.addEventListener('pointermove', e => {
  const svg = e.target.closest && e.target.closest('svg.iso');
  if (!svg || document.querySelector('.gtree.dragging')) { brushLast = null; return; }
  const m = svg.querySelector('.board').getScreenCTM(); if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  if (brushLast && brushLast.svg === svg) {
    const dx = p.x - brushLast.x;
    if (Math.abs(dx) > .5) svg.querySelectorAll('.gpos[data-x]').forEach(g => {
      const x = +g.dataset.x, y = +g.dataset.y;
      if (Math.abs(p.x - x) > 46 || p.y > y + 12 || p.y < y - 150) return;
      const el = g.querySelector('.sway'), s = brush.get(el) || { a: 0, v: 0 };
      s.v += Math.max(-4, Math.min(4, dx * .35)) * (1 - Math.abs(p.x - x) / 60);
      s.a = Math.max(-24, Math.min(24, s.a)); brush.set(el, s);
    });
    if (brush.size && !brushLoop) brushLoop = requestAnimationFrame(brushTick);
  }
  brushLast = { svg, x: p.x, y: p.y };
});

// Dragging trees between tiles. A drag that moves under 5px counts as a click.
let gardenDragged = false;
document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('svg.iso .gtree');
  if (!t || e.button) return;
  const svg = t.closest('svg'), board = svg.querySelector('.board'), holder = t.parentNode;
  const key = t.dataset.key, base = holder.getAttribute('transform');
  const sx = e.clientX, sy = e.clientY;
  let moving = false, over = null;
  const local = ev => new DOMPoint(ev.clientX, ev.clientY).matrixTransform(board.getScreenCTM().inverse());
  const cell = p => [Math.round(p.y / ISO_H - p.x / ISO_W), Math.round(p.x / ISO_W + p.y / ISO_H)];
  const move = ev => {
    if (!moving && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    if (!moving) { moving = true; t.classList.add('dragging'); const sw = t.querySelector('.sway'); if (sw) { brush.delete(sw); sw.style.transform = ''; } svg.querySelector('.gitems').appendChild(holder); }
    ev.preventDefault();
    const p = local(ev), [r, c] = cell(p);
    holder.setAttribute('transform', `translate(${p.x} ${p.y + 10})`);
    const tile = svg.querySelector(`.gtile[data-rc="${r},${c}"]`);
    if (tile !== over) { over && over.classList.remove('over'); over = tile; over && over.classList.add('over'); }
  };
  const up = ev => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    if (!moving) return;
    gardenDragged = true; setTimeout(() => { gardenDragged = false; }, 50);
    over && over.classList.remove('over');
    if (ev.type === 'pointercancel' || !over) { holder.setAttribute('transform', base); t.classList.remove('dragging'); render(); return; }
    const pos = D.game.gridPos, to = over.dataset.rc, from = pos[key];
    const other = Object.keys(pos).find(k => pos[k] === to && k !== key);
    if (other) pos[other] = from;
    pos[key] = to;
    save(); render();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
});
// a finished drag shouldn't also open the tree's details
document.addEventListener('click', e => { if (gardenDragged && e.target.closest && e.target.closest('svg.iso')) { e.stopPropagation(); e.preventDefault(); gardenDragged = false; } }, true);
