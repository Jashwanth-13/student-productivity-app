/* main.js - shared logic for all pages.
   Uses localStorage for persistence.
*/

const DB = {
  todos: 'sf_todos_v1',
  schedule: 'sf_schedule_v1',
  assignments: 'sf_assignments_v1',
  pomodoro: 'sf_pomodoro_v1',
  stats: 'sf_stats_v1'
};

function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('load error', e);
    return fallback;
  }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ---------- Utilities ---------- */
function formatDateISO(date){
  if(!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString();
}
function uid(prefix='id'){
  return prefix + '_' + Math.random().toString(36).slice(2,9);
}

/* ---------- DASHBOARD PAGE ---------- */
function renderDashboard(){
  const todos = load(DB.todos);
  const assignments = load(DB.assignments);
  const stats = load(DB.stats, {studyMinutes:0, sessions:0});
  const pending = todos.filter(t => !t.done).length;
  const dueSoon = assignments.filter(a => {
    const diff = (new Date(a.due) - new Date())/(1000*60*60*24);
    return diff <= 7 && !a.done;
  }).length;

  document.getElementById('dashboard-tasks-count').textContent = pending;
  document.getElementById('dashboard-assignments-count').textContent = dueSoon;
  document.getElementById('dashboard-studytime').textContent = `${stats.studyMinutes || 0}m`;
  const totalTasks = todos.length + assignments.length || 1;
  const completed = (todos.filter(t=>t.done).length + assignments.filter(a=>a.done).length);
  const percent = Math.round((completed/totalTasks)*100);
  document.getElementById('dashboard-progress').style.width = percent + '%';
  document.getElementById('dashboard-progress-text').textContent = percent + '% complete';

  const upcoming = [];
  const now = Date.now();
  todos.forEach(t=>{
    if(t.due){
      const d = new Date(t.due);
      if(d - now <= 7*24*3600*1000 && !t.done) upcoming.push({type:'Task', title:t.text, due:t.due});
    }
  });
  assignments.forEach(a=>{
    if(!a.done){
      const d = new Date(a.due);
      if(d - now <= 7*24*3600*1000) upcoming.push({type:'Assignment', title:a.title, due:a.due});
    }
  });
  upcoming.sort((a,b)=>new Date(a.due)-new Date(b.due));

  const ul = document.getElementById('dashboard-upcoming');
  ul.innerHTML = '';
  if(upcoming.length===0) ul.textContent = 'No upcoming items';
  else {
    upcoming.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'task-left';
      li.innerHTML = `<div><strong>${it.title}</strong><div class="task-meta">${it.type} • Due ${formatDateISO(it.due)}</div></div>`;
      ul.appendChild(li);
    });
  }
}

/* ---------- TODO PAGE ---------- */
function renderTodoList(){
  const listEl = document.getElementById('todo-list');
  if(!listEl) return;
  const todos = load(DB.todos);
  const filter = document.querySelector('input[name="todo-filter"]:checked')?.value || 'all';
  const q = document.getElementById('todo-search').value.trim().toLowerCase();
  listEl.innerHTML = '';
  const filtered = todos.filter(t=>{
    if(filter==='active' && t.done) return false;
    if(filter==='done' && !t.done) return false;
    if(q && !t.text.toLowerCase().includes(q)) return false;
    return true;
  });
  if(filtered.length===0){ listEl.innerHTML = `<li class="list-empty">No tasks</li>`; return; }
  filtered.forEach(t=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="task-left">
        <label><input type="checkbox" ${t.done?'checked':''} data-id="${t.id}" class="todo-check"></label>
        <div>
          <div class="title">${t.text}</div>
          <div class="task-meta">${t.priority.charAt(0).toUpperCase()+t.priority.slice(1)} • ${t.due ? 'Due '+formatDateISO(t.due) : 'No due date'}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost edit" data-id="${t.id}">Edit</button>
        <button class="btn danger delete" data-id="${t.id}">Delete</button>
      </div>
    `;
    listEl.appendChild(li);
  });
}

/* ---------- SCHEDULE PAGE ---------- */
function renderSchedule(){
  const grid = document.getElementById('week-grid');
  if(!grid) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  grid.innerHTML = '';
  const classes = load(DB.schedule);
  days.forEach(day=>{
    const dayBox = document.createElement('div');
    dayBox.className = 'day';
    dayBox.innerHTML = `<h4>${day}</h4>`;
    const dayClasses = classes.filter(c => c.day === day).sort((a,b)=>a.start.localeCompare(b.start));
    if(dayClasses.length===0) dayBox.innerHTML += `<div class="list-empty">No classes</div>`;
    else{
      dayClasses.forEach(cl=>{
        const el = document.createElement('div');
        el.style.marginTop='6px';
        el.innerHTML = `<strong>${cl.name}</strong><div class="task-meta">${cl.start} - ${cl.end} • ${cl.location||''}</div>`;
        dayBox.appendChild(el);
      });
    }
    grid.appendChild(dayBox);
  });
}

/* ---------- ASSIGNMENTS PAGE ---------- */
function renderAssignments(){
  const wrapper = document.getElementById('assignments-list');
  if(!wrapper) return;
  const assignments = load(DB.assignments);
  wrapper.innerHTML = '';
  if(assignments.length===0){ wrapper.innerHTML = `<p class="list-empty">No assignments yet</p>`; return; }
  assignments.sort((a,b)=>new Date(a.due)-new Date(b.due));
  assignments.forEach(a=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '10px';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="margin:0">${a.title} <span class="muted" style="font-weight:400">• ${a.subject}</span></h4>
          <div class="task-meta">Due ${formatDateISO(a.due)} • ${a.priority}</div>
          ${a.notes?`<p class="muted" style="margin-top:8px">${a.notes}</p>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn ${a.done? 'ghost' : ''}" data-action="toggle" data-id="${a.id}">${a.done ? 'Mark Undone' : 'Mark Done'}</button>
          <button class="btn danger" data-action="delete" data-id="${a.id}">Delete</button>
        </div>
      </div>
    `;
    wrapper.appendChild(card);
  });
}

/* ---------- POMODORO ---------- */
let pomTimer = null;
let pomRemaining = 0;
let pomMode = 'work'; // work or break
function renderPom(){
  const state = load(DB.pomodoro, {count:0});
  document.getElementById('pomodoro-count').textContent = state.count || 0;
}

function startPom(){
  const workMin = parseInt(document.getElementById('work-min').value) || 25;
  const breakMin = parseInt(document.getElementById('break-min').value) || 5;
  const mins = (pomMode === 'work') ? workMin : breakMin;
  if(pomRemaining <= 0) pomRemaining = mins * 60;
  tickPom();
  pomTimer = setInterval(tickPom, 1000);
  document.getElementById('start-btn').disabled = true;
  document.getElementById('pause-btn').disabled = false;
}

function tickPom(){
  if(pomRemaining <= 0){
    clearInterval(pomTimer);
    pomTimer = null;
    // switch mode
    if(pomMode === 'work'){
      // increment count
      const st = load(DB.pomodoro, {count:0});
      st.count = (st.count || 0) + 1;
      save(DB.pomodoro, st);
      // track study minutes
      const stats = load(DB.stats, {studyMinutes:0});
      stats.studyMinutes = (stats.studyMinutes || 0) + (document.getElementById('work-min').value|0);
      save(DB.stats, stats);
      pomMode = 'break';
      pomRemaining = (parseInt(document.getElementById('break-min').value)||5)*60;
      renderPom();
      alert('Work session finished! Time for a break.');
      startPom();
    } else {
      pomMode = 'work';
      pomRemaining = 0;
      document.getElementById('start-btn').disabled = false;
      document.getElementById('pause-btn').disabled = true;
      alert('Break finished — back to work!');
      renderPom();
    }
    save(DB.pomodoro, load(DB.pomodoro));
    renderDashboard();
    return;
  }
  pomRemaining--;
  const mm = String(Math.floor(pomRemaining/60)).padStart(2,'0');
  const ss = String(pomRemaining%60).padStart(2,'0');
  document.getElementById('timer-display').textContent = `${mm}:${ss}`;
}

function pausePom(){
  if(pomTimer) clearInterval(pomTimer);
  pomTimer = null;
  document.getElementById('start-btn').disabled = false;
  document.getElementById('pause-btn').disabled = true;
}

function resetPom(){
  pausePom();
  pomRemaining = 0;
  pomMode = 'work';
  const wm = parseInt(document.getElementById('work-min').value) || 25;
  document.getElementById('timer-display').textContent = `${String(wm).padStart(2,'0')}:00`;
}

/* ---------- Event wiring ---------- */
document.addEventListener('DOMContentLoaded', ()=> {
  const page = document.body.dataset.page;

  // Shared: nav active handled via HTML class
  // Render page-specific content:
  if(page === 'dashboard') renderDashboard();
  if(page === 'todo') {
    renderTodoList();
    // add item
    document.getElementById('todo-form').addEventListener('submit', (e)=>{
      e.preventDefault();
      const text = document.getElementById('todo-text').value.trim();
      const priority = document.getElementById('todo-priority').value;
      const due = document.getElementById('todo-due').value || null;
      if(!text) return;
      const todos = load(DB.todos);
      todos.push({id:uid('t'), text, priority, due, done:false, created:Date.now()});
      save(DB.todos, todos);
      document.getElementById('todo-text').value = '';
      renderTodoList();
      renderDashboard();
    });
    // searches and filters
    document.getElementById('todo-search').addEventListener('input', renderTodoList);
    document.querySelectorAll('input[name="todo-filter"]').forEach(r => r.addEventListener('change', renderTodoList));

    // list actions (delegate)
    document.getElementById('todo-list').addEventListener('click', (e)=>{
      const id = e.target.dataset.id;
      if(!id) return;
      if(e.target.classList.contains('delete')){
        let todos = load(DB.todos);
        todos = todos.filter(t => t.id !== id);
        save(DB.todos, todos);
        renderTodoList();
        renderDashboard();
      } else if(e.target.classList.contains('edit')){
        const todos = load(DB.todos);
        const t = todos.find(x=>x.id===id);
        if(t){
          const newText = prompt('Edit task', t.text);
          if(newText !== null) {
            t.text = newText.trim();
            save(DB.todos, todos);
            renderTodoList();
            renderDashboard();
          }
        }
      }
    });
    // checkbox toggle
    document.getElementById('todo-list').addEventListener('change', (e)=>{
      if(e.target.classList.contains('todo-check')){
        const id = e.target.dataset.id;
        const todos = load(DB.todos);
        const t = todos.find(x=>x.id===id);
        if(t){ t.done = e.target.checked; save(DB.todos, todos); renderDashboard(); }
        renderTodoList();
      }
    });
  }

  if(page === 'schedule'){
    renderSchedule();
    document.getElementById('schedule-form').addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.getElementById('class-name').value.trim();
      const day = document.getElementById('class-day').value;
      const start = document.getElementById('class-start').value;
      const end = document.getElementById('class-end').value;
      const location = document.getElementById('class-location').value.trim();
      if(!name||!start||!end) return;
      const arr = load(DB.schedule);
      arr.push({id:uid('c'), name, day, start, end, location});
      save(DB.schedule, arr);
      renderSchedule();
      document.getElementById('schedule-form').reset();
    });
  }

  if(page === 'assignments'){
    renderAssignments();
    document.getElementById('assignment-form').addEventListener('submit', (e)=>{
      e.preventDefault();
      const title = document.getElementById('assignment-title').value.trim();
      const subject = document.getElementById('assignment-subject').value.trim();
      const due = document.getElementById('assignment-due').value;
      const priority = document.getElementById('assignment-priority').value;
      const notes = document.getElementById('assignment-notes').value.trim();
      if(!title||!subject||!due) return;
      const arr = load(DB.assignments);
      arr.push({id:uid('a'), title, subject, due, priority, notes, done:false});
      save(DB.assignments, arr);
      document.getElementById('assignment-form').reset();
      renderAssignments();
      renderDashboard();
    });

    document.getElementById('assignments-list').addEventListener('click', (e)=>{
      const id = e.target.dataset.id;
      const action = e.target.dataset.action;
      if(!id) return;
      let arr = load(DB.assignments);
      if(action === 'delete'){
        arr = arr.filter(x=>x.id !== id);
        save(DB.assignments, arr);
        renderAssignments();
        renderDashboard();
      } else {
        const it = arr.find(x=>x.id===id);
        if(it){
          it.done = !it.done;
          save(DB.assignments, arr);
          renderAssignments();
          renderDashboard();
        }
      }
    });
  }

  if(page === 'pomodoro') {
    renderPom();
    resetPom();
    document.getElementById('start-btn').addEventListener('click', startPom);
    document.getElementById('pause-btn').addEventListener('click', pausePom);
    document.getElementById('reset-btn').addEventListener('click', resetPom);
    document.getElementById('pause-btn').disabled = true;
  }

  // general: update dashboard occasionally
  setInterval(()=> {
    if(document.body.dataset.page === 'dashboard') renderDashboard();
  }, 2000);
});

/* -- end main.js -- */
