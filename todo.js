'use strict';
/* To-do: every task in one place. Tasks have an optional due date, a list
   (School, Training, Personal ... or your own) and a priority. The left side
   picks what to show; the right side shows it grouped by when it's due. */

const TODO_LISTS = ['School', 'Training', 'Personal', 'Home', 'Other'];
const TODO_PRI = [['0', 'None'], ['1', 'Low'], ['2', 'Medium'], ['3', 'High']];
const PRI_COLOR = ['', '#4dabf7', '#fab005', '#fa5252'];
// tasks without a list are sorted by what they say: subjects and school words go to School
function todoListOf(x) {
  if (x.list) return x.list;
  const t = ' ' + String(x.text || '').toLowerCase() + ' ';
  if (D.subjects.some(s => s.name && t.includes(s.name.toLowerCase())) || /\b(sac|essay|exam|test|homework|assignment|quiz|revise|study|teacher|class)\b/.test(t) || x.fromEmail) return 'School';
  if (/\b(run|training|gym|workout|race|swim|ride|footy|practice)\b/.test(t)) return 'Training';
  return 'Other';
}
const todoLists = () => [...new Set([...TODO_LISTS, ...D.todos.map(t => t.list).filter(Boolean)])];

function todoMatches(x, f, t) {
  if (f === 'done') return x.done;
  if (x.done) return false;
  if (f === 'today') return !!x.due && x.due <= t;
  if (f === 'week') return !!x.due && x.due <= addDays(t, 7);
  if (f === 'nodate') return !x.due;
  if (f === 'high') return (+x.pri || 0) >= 3;
  if (f.startsWith('l:')) return todoListOf(x) === f.slice(2);
  return true;
}

function todoRow(x) {
  const t = today(), dd = x.due ? diffDays(t, x.due) : null, pri = +x.pri || 0;
  const tag = dd === null || x.done ? '' : dd < 0 ? `<span class="tag red">${dd === -1 ? 'Yesterday' : `${-dd} days overdue`}</span>` : dd === 0 ? '<span class="tag amber">Today</span>' : dd === 1 ? '<span class="tag amber">Tomorrow</span>' : '';
  const meta = [x.due && !tag ? `Due ${fmtDate(x.due)}` : '', x.fromEmail ? 'from an email' : ''].filter(Boolean).join(' · ');
  return `<li class="todo-item ${x.done ? 'done' : ''}" style="--p:${PRI_COLOR[pri] || 'transparent'}">
    <input type="checkbox" data-toggle="todo" data-id="${x.id}" ${x.done ? 'checked' : ''} title="Mark done">
    <div class="main"><div class="title">${pri ? `<span class="todo-pri" title="${TODO_PRI[pri][1]} priority">${'!'.repeat(pri)}</span>` : ''}${esc(x.text)} ${tag}</div>
      <div class="meta"><span class="tag ktag">${esc(todoListOf(x))}</span>${esc(meta)}</div>
      ${x.notes ? `<div class="todo-notes">${esc(String(x.notes).slice(0, 160))}</div>` : ''}</div>
    <div class="todo-acts">${!x.done && x.due !== t ? `<button class="iconbtn" data-todo="today" data-id="${x.id}" title="Do it today">☀</button>` : ''}
      <button class="iconbtn" data-act="edit" data-kind="todo" data-id="${x.id}" title="Edit">✎</button></div></li>`;
}

function viewTodo() {
  const t = today(), f = ui.todoFilter || 'all', q = (ui.todoQ || '').toLowerCase(), ev = f.startsWith('ev:');
  const open = D.todos.filter(x => !x.done);
  const count = k => k === 'ev:up' ? upcomingEventCount() : k === 'ev:past' ? 0 : D.todos.filter(x => todoMatches(x, k, t)).length;
  let list = D.todos.filter(x => todoMatches(x, f, t) && (!q || (x.text + ' ' + (x.notes || '') + ' ' + (x.list || '')).toLowerCase().includes(q)));
  const byPri = (a, b) => (+b.pri || 0) - (+a.pri || 0);
  list.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || byPri(a, b));
  const groupsDef = f === 'done' ? [['Completed', () => true]] : [
    ['Overdue', x => x.due && x.due < t], ['Today', x => x.due === t], ['Tomorrow', x => x.due === addDays(t, 1)],
    ['Next 7 days', x => x.due && x.due > addDays(t, 1) && x.due <= addDays(t, 7)], ['Later', x => x.due && x.due > addDays(t, 7)], ['No due date', x => !x.due],
  ];
  const groups = groupsDef.map(([label, fn]) => {
    const xs = list.filter(fn); if (!xs.length) return '';
    return `<div class="tgroup ${label === 'Overdue' ? 'late' : ''}"><div class="tg-head">${label} <span>${xs.length}</span></div><ul class="todo-list">${xs.map(todoRow).join('')}</ul></div>`;
  }).join('');
  const side = (k, icon, label) => `<button class="todo-nav ${f === k ? 'on' : ''}" data-todo="filter" data-v="${esc(k)}"><span>${icon}</span><b>${esc(label)}</b><i>${count(k) || ''}</i></button>`;
  const overdue = open.filter(x => x.due && x.due < t).length, dueToday = open.filter(x => x.due === t).length;
  const title = { 'ev:up': 'Upcoming events', 'ev:past': 'Past events', all: 'All tasks', today: 'Today', week: 'Next 7 days', nodate: 'No due date', high: 'High priority', done: 'Completed' }[f] || f.slice(2);
  const opts = (arr, v) => arr.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('');
  const defList = f.startsWith('l:') ? f.slice(2) : (ui.todoLastList || '');
  return `${pageHead('To-do', `${open.length} open task${open.length === 1 ? '' : 's'}${dueToday ? ` · ${dueToday} due today` : ''}${overdue ? ` · <b class="red-text">${overdue} overdue</b>` : ''}`,
      `<button class="btn" data-act="new" data-kind="event">+ Event</button><button class="btn" data-act="new" data-kind="deadline">+ Deadline</button><button class="btn primary" data-act="new" data-kind="todo">+ Task</button>`)}
  <div class="todo-page">
    <aside class="card todo-side">
      ${side('all', '📋', 'All')}${side('today', '☀', 'Today')}${side('week', '📅', 'Next 7 days')}${side('nodate', '∞', 'No due date')}${side('high', '❗', 'High priority')}
      <div class="todo-sidehead">Lists</div>
      ${todoLists().map(l => side('l:' + l, '•', l)).join('')}
      <div class="todo-sidehead"></div>${side('done', '✓', 'Completed')}
      <div class="todo-sidehead">Events</div>${side('ev:up', '📆', 'Upcoming')}${side('ev:past', '🗓', 'Past')}
    </aside>
    <section class="card todo-main">${ev ? `<div class="card-head"><h2>${title}</h2></div>${eventsListHtml(f === 'ev:past' ? 'past' : 'up')}` : `
      <div class="card-head"><h2>${esc(title)}</h2><input type="text" id="todoQ" placeholder="Search tasks" value="${esc(ui.todoQ || '')}" data-todo-search style="max-width:220px"></div>
      <form class="todo-add" data-form="todoAdd">
        <input type="text" name="text" placeholder="＋ Add a task and press Enter" maxlength="300" autocomplete="off">
        <input type="date" name="due" title="Due date (optional)" value="${f === 'today' ? t : ''}">
        <select name="list" title="List"><option value="">No list</option>${opts(todoLists(), defList)}</select>
        <select name="pri" title="Priority">${opts(TODO_PRI.map(([v, l]) => [v, l === 'None' ? 'Priority' : l]), f === 'high' ? '3' : '0')}</select>
        <button class="btn primary">Add</button></form>
      ${groups || `<div class="empty">${q ? 'No tasks match that search.' : f === 'done' ? 'Nothing completed yet.' : 'No open tasks here. 🎉'}</div>`}
      ${f === 'done' && list.length ? '<button class="btn small" data-act="clearDone" style="margin-top:10px">Clear completed</button>' : ''}`}
    </section>
  </div>`;
}

// A small Today card: quick add plus what's due, with a link to the To-do tab
function todoTodayCard(overdueHtml) {
  const t = today(), open = D.todos.filter(x => !x.done);
  const due = open.filter(x => x.due && x.due <= t).sort((a, b) => a.due.localeCompare(b.due) || (+b.pri || 0) - (+a.pri || 0));
  return `<div class="card ttasks"><div class="card-head"><h2>To-do</h2><span class="muted small-text">${open.length} open</span><button class="btn small" data-act="goto" data-v="todo">Open →</button></div>
    <form class="row" data-form="quickTodo" style="margin-bottom:8px"><input type="text" name="text" placeholder="＋ Add a task and press Enter" style="flex:1" maxlength="300"><input type="date" name="due" style="width:auto" title="Due date (optional)"></form>
    <div class="tscroll">${due.length ? `<div class="tg-head">Due today or overdue <span>${due.length}</span></div><ul class="todo-list compact">${due.slice(0, 8).map(todoRow).join('')}</ul>${due.length > 8 ? `<button class="btn small" data-act="goto" data-v="todo">+${due.length - 8} more</button>` : ''}`
      : `<div class="empty">Nothing due today.${open.length ? ` <a href="#" data-act="goto" data-v="todo">See all ${open.length} tasks</a>` : ' 🎉'}</div>`}
    ${overdueHtml || ''}</div></div>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-todo]'); if (!b) return;
  e.preventDefault();
  const a = b.dataset.todo;
  if (a === 'filter') { ui.todoFilter = b.dataset.v; render(); }
  if (a === 'today') { const x = D.todos.find(y => y.id === b.dataset.id); if (x) { x.due = today(); save(); render(); } }
});
document.addEventListener('input', e => {
  if (!e.target.matches('[data-todo-search]')) return;
  ui.todoQ = e.target.value; const pos = e.target.selectionStart; render();
  const inp = document.getElementById('todoQ'); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="todoAdd"]'); if (!f) return;
  e.preventDefault();
  const text = f.text.value.trim(); if (!text) return;
  const due = f.due.value;
  ui.todoLastList = f.list.value;
  D.todos.push({ id: uid(), text, due, list: f.list.value, pri: +f.pri.value || 0, done: false, notes: '', remind: due ? D.settings.remind.todo : [] });
  save(); render();
  document.querySelector('[data-form="todoAdd"] input[name=text]')?.focus();
});
