// ---------- 3D garden ----------
// The forest as an isometric grid of grass tiles. Trees and decorations sit on
// tiles, sway when you hover them, and can be dragged to another tile (dropping
// on a taken tile swaps the two). Positions live in D.game.gridPos as "row,col".

const ISO_W = 96, ISO_H = 48, ISO_D = 14;
const isoXY = (r, c) => [(c - r) * ISO_W / 2, (c + r) * ISO_H / 2];

function gardenLayout(logs) {
  const pos = D.game.gridPos = D.game.gridPos || {};
  const valid = new Set([...D.focusLogs.filter(l => l.mins >= 10).map(l => l.id), ...groundItems().map(g => 'g:' + g.id)]);
  for (const k of Object.keys(pos)) if (!valid.has(k)) delete pos[k];
  const seen = new Set();
  const things = [...logs.map(l => ({ key: l.id, l })), ...groundItems().map(g => ({ key: 'g:' + g.id, g }))].filter(t => !seen.has(t.key) && seen.add(t.key));
  let N = Math.max(6, Math.ceil(Math.sqrt(things.length * 1.5)));
  for (const t of things) { const p = pos[t.key]; if (p) { const [r, c] = p.split(',').map(Number); N = Math.max(N, r + 1, c + 1); } }
  N = Math.min(N, 24);
  const taken = {};
  for (const t of things) {
    const p = pos[t.key];
    if (!p || taken[p]) continue;
    const [r, c] = p.split(',').map(Number);
    if (r < N && c < N) { t.r = r; t.c = c; taken[p] = t.key; }
  }
  // new things fill free tiles from the front corner outwards
  const free = [];
  const reserved = new Set(Object.values(pos)); // tiles kept for trees outside this week or month
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!taken[`${r},${c}`] && !reserved.has(`${r},${c}`)) free.push([r, c]);
  free.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[1] - b[1]);
  let k = 0;
  for (const t of things) if (t.r == null && k < free.length) { [t.r, t.c] = free[k++]; pos[t.key] = `${t.r},${t.c}`; taken[pos[t.key]] = t.key; }
  return { N, things: things.filter(t => t.r != null), taken };
}

function forestGrid(logs) {
  const sc = SCENES[D.game.scene] || SCENES.meadow, hr = new Date().getHours();
  const night = sc.night || hr >= 20 || hr < 6;
  const sky = sc.night ? (sc.sky || ['#0b1a3a', '#24406e']) : night ? ['#16204a', '#3a4a86'] : sc.sky || ['#8fd0ff', '#e6f6ff'];
  const top = night && !sc.night ? shade(sc.g1, -.35) : sc.g1, top2 = night && !sc.night ? shade(sc.g2, -.35) : sc.g2;
  const { N, things } = gardenLayout(logs);
  const pad = 150, W = N * ISO_W + 80, H = N * ISO_H + ISO_D + pad + 30, ox = W / 2, oy = pad;
  const tiles = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const [x, y] = isoXY(r, c), hw = ISO_W / 2, hh = ISO_H / 2;
    const fill = (r + c) % 2 ? top : top2;
    const edge = [r === N - 1 ? `<path d="M${x - hw} ${y} L${x} ${y + hh} L${x} ${y + hh + ISO_D} L${x - hw} ${y + ISO_D} Z" fill="${shade(sc.g2, -.3)}"/>` : '',
      c === N - 1 ? `<path d="M${x} ${y + hh} L${x + hw} ${y} L${x + hw} ${y + ISO_D} L${x} ${y + hh + ISO_D} Z" fill="${shade(sc.g2, -.45)}"/>` : ''].join('');
    tiles.push(`${edge}<path class="gtile" data-rc="${r},${c}" d="M${x} ${y - hh} L${x + hw} ${y} L${x} ${y + hh} L${x - hw} ${y} Z" fill="${fill}" stroke="${shade(fill, -.12)}" stroke-width="1"/>`);
  }
  const items = things.sort((a, b) => (a.r + a.c) - (b.r + b.c) || a.c - b.c).map((t, i) => {
    const [x, y] = isoXY(t.r, t.c);
    if (t.g) return `<g class="gpos" transform="translate(${x} ${y})"><g class="gtree deco" data-key="${esc(t.key)}"><g class="sway"><g transform="scale(.95)">${t.g.svg}</g></g></g></g>`;
    const l = t.l, s = subj(l.subjectId);
    return `<g class="gpos" transform="translate(${x} ${y + 4})"><g class="gtree ${l.withered ? 'withered' : treeRec(l.id).wilted ? 'wilt' : ''}" data-key="${esc(t.key)}" data-act="treeInfo" data-id="${l.id}" style="animation-delay:${Math.min(i * 30, 1200)}ms">
      <title>${esc(treeName(l))} · ${esc(s.name)} · ${fmtMins(l.mins)} · ${fmtDate(l.date)} (drag to move, click for details)</title><g class="sway"><g transform="scale(.82)">${treeG(speciesFor(l.subjectId), s.color, treeStage(l.mins), l.id)}</g></g></g></g>`;
  }).join('');
  const empty = logs.length ? '' : `<text x="${ox}" y="${oy - 60}" text-anchor="middle" font-size="20" font-weight="700" fill="${night ? '#e9f5e9' : '#2b5a2a'}">Study for 10+ minutes to plant your first tree.</text>`;
  return `<svg class="scene iso" style="background:${sky[0]}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Your garden: ${logs.length} trees. Drag a tree to move it.">
    <defs><linearGradient id="isosky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#isosky)"/>${empty}
    <g class="board" transform="translate(${ox} ${oy})">${tiles.join('')}<g class="gitems">${items}</g></g></svg>`;
}

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
    if (!moving) { moving = true; t.classList.add('dragging'); svg.querySelector('.gitems').appendChild(holder); }
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
