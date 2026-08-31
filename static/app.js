// ===== Miku Workbench Frontend =====

const API = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()),
  put: (url, data) => fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()),
  del: (url) => fetch(url, {method:'DELETE'}).then(r => r.json())
};

// ===== UTILITIES =====
function toast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 300); }, 2500);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

// ===== AUTH & AVATAR =====
async function checkAuth() {
  try {
    const resp = await fetch('/api/auth/check');
    const data = await resp.json();
    if (!data.logged_in) { window.location.href = '/login'; return; }
    document.getElementById('displayUsername').textContent = data.username;
    if (data.avatar) loadUserAvatar(data.avatar);
  } catch(e) { window.location.href = '/login'; }
}

function loadUserAvatar(avatarUrl) {
  const wrap = document.getElementById('userAvatar');
  const existing = wrap.querySelector('img');
  if (existing) existing.remove();
  const img = document.createElement('img');
  img.src = avatarUrl + '?t=' + Date.now();
  wrap.appendChild(img);
}

document.getElementById('avatarWrap').addEventListener('click', () => openAvatarModal());

function openAvatarModal() {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = '更换头像';
  body.innerHTML = `
    <div class="field">
      <label>选择图片</label>
      <div class="avatar-upload-area" id="avatarUploadArea">
        <div class="avatar-preview" id="avatarPreview">
          <span class="upload-placeholder">点击或拖拽图片到这里<br><small>支持 PNG/JPG/GIF/WebP</small></span>
        </div>
        <input type="file" id="avatarFile" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none">
      </div>
    </div>
    <div class="field">
      <label>预览</label>
      <div class="avatar-preview-circle" id="avatarPreviewCircle"></div>
    </div>
  `;
  document.getElementById('modalSave').onclick = async () => {
    const file = document.getElementById('avatarFile').files[0];
    if (!file) { toast('请先选择图片', 'error'); return; }
    const formData = new FormData();
    formData.append('avatar', file);
    const resp = await fetch('/api/avatar/upload', {method:'POST', body:formData});
    const data = await resp.json();
    if (data.success) {
      loadUserAvatar(data.avatar);
      toast('头像更新成功 ♪');
      closeModal();
    } else {
      toast(data.error || '上传失败', 'error');
    }
  };
  const uploadArea = document.getElementById('avatarUploadArea');
  const fileInput = document.getElementById('avatarFile');
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('avatarPreview').innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:200px;border-radius:14px">`;
        document.getElementById('avatarPreviewCircle').innerHTML = `<img src="${ev.target.result}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--miku-cyan)">`;
      };
      reader.readAsDataURL(file);
    }
  });
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--miku-cyan)'; });
  uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#e0e0e0'; });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#e0e0e0';
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
  showModal();
}

document.getElementById('btnLogout').addEventListener('click', async () => {
  await API.post('/api/logout', {});
  toast('已退出登录');
  setTimeout(() => { window.location.href = '/login'; }, 600);
});

// ===== NAVIGATION =====
const pageTitles = { dashboard:'仪表盘', tasks:'任务管理', notes:'我的笔记', projects:'项目管理', schedule:'日程安排', slt:'SLT测试经验分享' };
const quotes = [
  'Be Together Be Future',
  '把灵感写成代码与旋律',
  'Sing for you, code for you',
  '今天也要元气满满哦',
  'Miracle Paint at Night',
  'Tell Your World'
];

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('pageTitle').textContent = pageTitles[page];
    if (page === 'dashboard') loadDashboard();
    else if (page === 'tasks') loadTasks();
    else if (page === 'notes') loadNotes();
    else if (page === 'projects') loadProjects();
    else if (page === 'schedule') loadSchedule();
    else if (page === 'slt') loadSlt();
  });
});

// ===== DAILY GREETING =====
function setGreeting() {
  const h = new Date().getHours();
  let g;
  if (h < 6) g = '夜深了，注意休息哦～';
  else if (h < 11) g = '早上好！今天也要加油哦～';
  else if (h < 14) g = '中午好，吃完午饭了吗？';
  else if (h < 18) g = '下午好！保持节奏继续冲～';
  else if (h < 22) g = '晚上好，今天辛苦啦～';
  else g = '夜深了，注意休息哦～';
  document.getElementById('mikuGreeting').textContent = g;
  document.getElementById('dailyQuote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
}

// ===== DATE DISPLAY =====
function setDate() {
  const d = new Date();
  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('todayDate').textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 周${days[d.getDay()]}`;
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const d = await API.get('/api/dashboard');
  const kpiGrid = document.getElementById('kpiGrid');
  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">📋</div>
      <div class="kpi-value">${d.tasks.pending}</div>
      <div class="kpi-label">待办任务</div>
      <div class="kpi-sub">共${d.tasks.total}个 | 完成率${d.tasks.completion_rate}%</div>
    </div>
    <div class="kpi-card pink">
      <div class="kpi-icon">📌</div>
      <div class="kpi-value">${d.tasks.high_priority}</div>
      <div class="kpi-label">高优先级</div>
      <div class="kpi-sub">需要优先处理</div>
    </div>
    <div class="kpi-card purple">
      <div class="kpi-icon">✎</div>
      <div class="kpi-value">${d.notes.total}</div>
      <div class="kpi-label">笔记总数</div>
      <div class="kpi-sub">置顶${d.notes.pinned}个</div>
    </div>
    <div class="kpi-card yellow">
      <div class="kpi-icon">◈</div>
      <div class="kpi-value">${d.projects.active}</div>
      <div class="kpi-label">进行中项目</div>
      <div class="kpi-sub">共${d.projects.total}个项目</div>
    </div>
  `;

  document.getElementById('dashTaskCount').textContent = d.recent_tasks.length;
  const taskList = document.getElementById('dashTaskList');
  if (d.recent_tasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>暂无待办任务</p></div>';
  } else {
    taskList.innerHTML = d.recent_tasks.map(t => `
      <div class="task-item" onclick="toggleTask(${t.id})">
        <div class="task-checkbox ${t.completed?'done':''}"></div>
        <div class="task-info">
          <div class="task-title ${t.completed?'done':''}">${escHtml(t.title)}</div>
          <div class="task-meta">
            ${t.priority==2?'<span class="task-tag high">高</span>':t.priority==1?'<span class="task-tag med">中</span>':'<span class="task-tag low">低</span>'}
            ${t.due_date?`<span class="task-tag due">${formatDate(t.due_date)}</span>`:''}
            <span class="task-tag">${escHtml(t.category)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('dashNoteCount').textContent = d.recent_notes.length;
  const noteList = document.getElementById('dashNoteList');
  if (d.recent_notes.length === 0) {
    noteList.innerHTML = '<div class="empty-state"><div class="icon">✎</div><p>暂无笔记</p></div>';
  } else {
    noteList.innerHTML = d.recent_notes.map(n => `
      <div class="note-card ${n.color}" onclick="switchPage('notes')">
        ${n.pinned?'<div class="note-pin">📌</div>':''}
        <div class="note-title">${escHtml(n.title)}</div>
        <div class="note-content">${escHtml(n.content.substring(0,100))}</div>
        <div class="note-footer"><span class="note-cat">${escHtml(n.category)}</span><span class="note-date">${formatDate(n.updated_at)}</span></div>
      </div>
    `).join('');
  }

  document.getElementById('dashProjCount').textContent = d.projects.list.length;
  const projList = document.getElementById('dashProjList');
  if (d.projects.list.length === 0) {
    projList.innerHTML = '<div class="empty-state"><div class="icon">◈</div><p>暂无项目</p></div>';
  } else {
    projList.innerHTML = d.projects.list.map(p => `
      <div class="project-card ${p.color}" onclick="switchPage('projects')">
        <div class="project-name">${escHtml(p.name)}</div>
        <div class="project-desc">${escHtml(p.description || '暂无描述')}</div>
        <div class="project-progress-bar"><div class="project-progress-fill ${p.progress>=80?'high':p.progress<30?'low':''}" style="width:${p.progress}%"></div></div>
        <div class="project-footer">
          <span class="project-status ${p.status}">${p.status=='active'?'进行中':p.status=='paused'?'暂停':'已完成'}</span>
          <span class="project-pct">${p.progress}%</span>
        </div>
      </div>
    `).join('');
  }

  const schedList = document.getElementById('dashScheduleList');
  if (d.schedules.today.length === 0) {
    schedList.innerHTML = '<div class="empty-state"><div class="icon">♪</div><p>今日暂无日程安排</p></div>';
  } else {
    schedList.innerHTML = d.schedules.today.map(s => `
      <div class="schedule-item">
        <span class="schedule-time">${s.time || '--:--'}</span>
        <span class="schedule-title">${escHtml(s.title)}</span>
        <span class="schedule-type task-tag">${escHtml(s.type)}</span>
      </div>
    `).join('');
  }

  const pendingBadge = document.getElementById('nav-badge-pending');
  if (d.tasks.pending > 0) { pendingBadge.style.display = 'flex'; pendingBadge.textContent = d.tasks.pending; }
  else { pendingBadge.style.display = 'none'; }
  const tasksBadge = document.getElementById('nav-badge-tasks');
  if (d.tasks.today > 0) { tasksBadge.style.display = 'flex'; tasksBadge.textContent = d.tasks.today; }
  else { tasksBadge.style.display = 'none'; }
}

// ===== TASKS =====
let taskFilter = 'all';
async function loadTasks() {
  const tasks = await API.get(`/api/tasks?filter=${taskFilter}`);
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>暂无任务，点击右上角创建吧～</p></div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="task-item" data-id="${t.id}">
      <div class="task-checkbox ${t.completed?'done':''}" onclick="toggleTask(${t.id})"></div>
      <div class="task-info" onclick="editTask(${t.id})">
        <div class="task-title ${t.completed?'done':''}">${escHtml(t.title)}</div>
        <div class="task-meta">
          ${t.priority==2?'<span class="task-tag high">高优先级</span>':t.priority==1?'<span class="task-tag med">中优先级</span>':'<span class="task-tag low">低优先级</span>'}
          ${t.due_date?`<span class="task-tag due">截止 ${formatDate(t.due_date)}</span>`:''}
          <span class="task-tag">${escHtml(t.category)}</span>
        </div>
      </div>
      <span class="task-delete" onclick="deleteTask(${t.id})">✕</span>
    </div>
  `).join('');
}

document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-filter]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    taskFilter = tab.dataset.filter;
    loadTasks();
  });
});

document.getElementById('btnAddTask').addEventListener('click', () => openTaskModal());

async function toggleTask(id) {
  const tasks = await API.get('/api/tasks');
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  await API.put(`/api/tasks/${id}`, { ...task, completed: !task.completed });
  toast(task.completed ? '已取消完成' : '任务已完成 ✓');
  refreshCurrent();
}

async function deleteTask(id) {
  await API.del(`/api/tasks/${id}`);
  toast('任务已删除');
  refreshCurrent();
}

function editTask(id) {
  API.get('/api/tasks').then(tasks => {
    const task = tasks.find(t => t.id === id);
    if (task) openTaskModal(task);
  });
}

function openTaskModal(task = null) {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = task ? '编辑任务' : '新建任务';
  body.innerHTML = `
    <div class="field">
      <label>任务标题</label>
      <input type="text" id="f_taskTitle" value="${task?escAttr(task.title):''}" placeholder="输入任务标题...">
    </div>
    <div class="field-row">
      <div class="field">
        <label>分类</label>
        <select id="f_taskCat">
          <option value="general" ${task&&task.category==='general'?'selected':''}>常规</option>
          <option value="work" ${task&&task.category==='work'?'selected':''}>工作</option>
          <option value="study" ${task&&task.category==='study'?'selected':''}>学习</option>
          <option value="life" ${task&&task.category==='life'?'selected':''}>生活</option>
        </select>
      </div>
      <div class="field">
        <label>优先级</label>
        <select id="f_taskPri">
          <option value="0" ${task&&task.priority===0?'selected':''}>低</option>
          <option value="1" ${task&&task.priority===1?'selected':''}>中</option>
          <option value="2" ${task&&task.priority===2?'selected':''}>高</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>截止日期</label>
      <input type="date" id="f_taskDue" value="${task&&task.due_date?task.due_date:''}">
    </div>
  `;
  document.getElementById('modalSave').onclick = async () => {
    const data = {
      title: document.getElementById('f_taskTitle').value.trim(),
      category: document.getElementById('f_taskCat').value,
      priority: parseInt(document.getElementById('f_taskPri').value),
      due_date: document.getElementById('f_taskDue').value || null
    };
    if (!data.title) { toast('请输入任务标题', 'error'); return; }
    if (task) {
      await API.put(`/api/tasks/${task.id}`, { ...task, ...data });
      toast('任务已更新');
    } else {
      await API.post('/api/tasks', data);
      toast('任务已创建 ♪');
    }
    closeModal();
    refreshCurrent();
  };
  showModal();
}

// ===== NOTES =====
let noteCat = 'all';
async function loadNotes() {
  const notes = await API.get(`/api/notes?category=${noteCat}`);
  const grid = document.getElementById('noteGrid');
  if (notes.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">✎</div><p>暂无笔记，点击右上角创建吧～</p></div>';
    return;
  }
  grid.innerHTML = notes.map(n => {
    const atts = n.attachments || [];
    const imgAtts = atts.filter(a => a.is_image);
    const fileAtts = atts.filter(a => !a.is_image);
    return `
    <div class="note-card ${n.color}" data-id="${n.id}" onclick="viewNote(${n.id})">
      ${n.pinned?'<div class="note-pin">📌</div>':''}
      <div class="note-title">${escHtml(n.title)}</div>
      <div class="note-content">${escHtml(n.content)}</div>
      ${imgAtts.length ? `<div class="note-images">${imgAtts.slice(0,4).map(a => `<img src="${a.url}" class="note-thumb" onclick="event.stopPropagation();window.open('${a.url}','_blank')" alt="${escAttr(a.original_name)}">`).join('')}${imgAtts.length>4?`<div class="note-more-img">+${imgAtts.length-4}</div>`:''}</div>` : ''}
      ${fileAtts.length ? `<div class="note-files">${fileAtts.slice(0,3).map(a => `<a href="${a.url}" class="note-file-link" download title="${escAttr(a.original_name)}" onclick="event.stopPropagation()"><span class="file-icon">📄</span><span class="file-name">${escHtml(a.original_name)}</span><span class="file-size">${formatFileSize(a.size)}</span></a>`).join('')}${fileAtts.length>3?`<span class="note-more-file">+${fileAtts.length-3}个文件</span>`:''}</div>` : ''}
      <div class="note-footer">
        <span class="note-cat">${escHtml(n.category)}</span>
        <span class="note-date">${formatDate(n.updated_at)}</span>
      </div>
      <div class="note-actions">
        <button class="note-action" onclick="event.stopPropagation();editNote(${n.id})" title="编辑">✎</button>
        <button class="note-action" onclick="event.stopPropagation();pinNote(${n.id},${n.pinned?0:1})" title="置顶">📌</button>
        <button class="note-action" onclick="event.stopPropagation();deleteNote(${n.id})" title="删除">✕</button>
      </div>
    </div>
  `;}).join('');
}

document.querySelectorAll('.filter-tab[data-cat]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-cat]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    noteCat = tab.dataset.cat;
    loadNotes();
  });
});

document.getElementById('btnAddNote').addEventListener('click', () => openNoteModal());

async function pinNote(id, pinned) {
  const notes = await API.get('/api/notes');
  const note = notes.find(n => n.id === id);
  if (note) { await API.put(`/api/notes/${id}`, { ...note, pinned }); toast(pinned?'已置顶':'已取消置顶'); loadNotes(); }
}
async function deleteNote(id) {
  await API.del(`/api/notes/${id}`);
  toast('笔记已删除');
  loadNotes();
}
function viewNote(id) {
  API.get('/api/notes').then(notes => {
    const n = notes.find(nn => nn.id === id);
    if (!n) return;
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = n.title;
    const atts = n.attachments || [];
    const imgAtts = atts.filter(a => a.is_image);
    const fileAtts = atts.filter(a => !a.is_image);
    const catNames = { general:'常规', work:'工作', idea:'灵感', diary:'日记' };
    body.innerHTML = `
      <div class="note-view-meta">
        <span class="note-view-tag">${catNames[n.category] || n.category}</span>
        <span class="note-view-date">更新于 ${n.updated_at || ''}</span>
        ${n.pinned?'<span class="note-view-tag pinned">📌 已置顶</span>':''}
      </div>
      <div class="note-view-content">${escHtml(n.content) || '<span style="color:#999">（无内容）</span>'}</div>
      ${imgAtts.length ? `<div class="note-view-images">${imgAtts.map(a => `<img src="${a.url}" class="note-view-img" onclick="window.open('${a.url}','_blank')" alt="${escAttr(a.original_name)}">`).join('')}</div>` : ''}
      ${fileAtts.length ? `<div class="note-view-files">${fileAtts.map(a => `<a href="${a.url}" class="note-file-link" download><span class="file-icon">📄</span><span class="file-name">${escHtml(a.original_name)}</span><span class="file-size">${formatFileSize(a.size)}</span></a>`).join('')}</div>` : ''}
    `;
    const saveBtn = document.getElementById('modalSave');
    saveBtn.style.display = 'none';
    const cancelBtn = document.getElementById('modalCancel');
    cancelBtn.textContent = '关闭';
    const editBtn = document.getElementById('modalEditBtn');
    if (editBtn) editBtn.style.display = 'inline-block';
    editBtn.onclick = () => { saveBtn.style.display = ''; editBtn.style.display = 'none'; cancelBtn.textContent = '取消'; openNoteModal(n); };
    showModal();
  });
}

function editNote(id) {
  API.get('/api/notes').then(notes => {
    const note = notes.find(n => n.id === id);
    if (note) openNoteModal(note);
  });
}

function openNoteModal(note = null) {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = note ? '编辑笔记' : '新建笔记';
  document.getElementById('modalSave').style.display = '';
  document.getElementById('modalEditBtn').style.display = 'none';
  document.getElementById('modalCancel').textContent = '取消';
  let selColor = note ? note.color : 'cyan';
  let attachments = (note && note.attachments) ? [...note.attachments] : [];
  let pendingNoteId = note ? note.id : null;
  body.innerHTML = `
    <div class="field">
      <label>标题</label>
      <input type="text" id="f_noteTitle" value="${note?escAttr(note.title):''}" placeholder="输入笔记标题...">
    </div>
    <div class="field">
      <label>内容</label>
      <textarea id="f_noteContent" placeholder="开始书写...">${note?escHtml(note.content):''}</textarea>
    </div>
    <div class="field">
      <label>附件上传</label>
      <div class="note-upload-area" id="noteUploadArea">
        <span class="upload-placeholder">点击或拖拽文件到这里<br><small>支持图片/PDF/Word/Excel/PPT/ZIP/视频/音频，最大10MB</small></small></span>
        <input type="file" id="noteFileInput" multiple style="display:none">
      </div>
      <div id="noteAttachList" class="note-attach-list"></div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>分类</label>
        <select id="f_noteCat">
          <option value="general" ${note&&note.category==='general'?'selected':''}>常规</option>
          <option value="work" ${note&&note.category==='work'?'selected':''}>工作</option>
          <option value="idea" ${note&&note.category==='idea'?'selected':''}>灵感</option>
          <option value="diary" ${note&&note.category==='diary'?'selected':''}>日记</option>
        </select>
      </div>
      <div class="field">
        <label>颜色</label>
        <div class="color-pick" id="colorPick">
          <div class="color-opt cyan ${selColor==='cyan'?'sel':''}" data-c="cyan"></div>
          <div class="color-opt pink ${selColor==='pink'?'sel':''}" data-c="pink"></div>
          <div class="color-opt yellow ${selColor==='yellow'?'sel':''}" data-c="yellow"></div>
          <div class="color-opt purple ${selColor==='purple'?'sel':''}" data-c="purple"></div>
          <div class="color-opt white ${selColor==='white'?'sel':''}" data-c="white"></div>
        </div>
      </div>
    </div>
  `;
  function renderAttachList() {
    const list = document.getElementById('noteAttachList');
    if (attachments.length === 0) { list.innerHTML = ''; return; }
    list.innerHTML = attachments.map((a, i) => `
      <div class="attach-item">
        ${a.is_image ? `<img src="${a.url}" class="attach-thumb">` : `<span class="attach-file-icon">📄</span>`}
        <span class="attach-name">${escHtml(a.original_name)}</span>
        <span class="attach-size">${formatFileSize(a.size)}</span>
        <button class="attach-remove" onclick="removeAttach(${i})" title="删除">✕</button>
      </div>
    `).join('');
  }
  renderAttachList();
  document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
      selColor = opt.dataset.c;
    });
  });
  const uploadArea = document.getElementById('noteUploadArea');
  const fileInput = document.getElementById('noteFileInput');
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('drag-over'); });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  async function handleFiles(files) {
    if (files.length === 0) return;
    if (!pendingNoteId) {
      const data = {
        title: document.getElementById('f_noteTitle').value.trim() || '无标题笔记',
        content: document.getElementById('f_noteContent').value,
        category: document.getElementById('f_noteCat').value,
        color: selColor
      };
      const resp = await API.post('/api/notes', data);
      pendingNoteId = resp.id;
      note = resp;
    }
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      uploadArea.querySelector('.upload-placeholder').innerHTML = `上传中: ${escHtml(file.name)}...`;
      const resp = await fetch(`/api/notes/${pendingNoteId}/upload`, {method:'POST', body:formData});
      const data = await resp.json();
      if (data.success) {
        attachments = data.attachments;
        renderAttachList();
      } else {
        toast(data.error || '上传失败', 'error');
      }
    }
    uploadArea.querySelector('.upload-placeholder').innerHTML = '点击或拖拽文件到这里<br><small>支持图片/PDF/Word/Excel/PPT/ZIP/视频/音频，最大10MB</small>';
  }
  window.removeAttach = async (idx) => {
    const att = attachments[idx];
    if (pendingNoteId && att) {
      await fetch(`/api/notes/${pendingNoteId}/attachment/${att.filename}`, {method:'DELETE'});
      attachments = attachments.filter((_, i) => i !== idx);
      renderAttachList();
    }
  };
  document.getElementById('modalSave').onclick = async () => {
    const data = {
      title: document.getElementById('f_noteTitle').value.trim(),
      content: document.getElementById('f_noteContent').value,
      category: document.getElementById('f_noteCat').value,
      color: selColor
    };
    if (!data.title) { toast('请输入标题', 'error'); return; }
    if (pendingNoteId) {
      await API.put(`/api/notes/${pendingNoteId}`, { ...note, ...data });
      toast('笔记已更新');
    } else {
      await API.post('/api/notes', data);
      toast('笔记已创建 ✎');
    }
    closeModal();
    loadNotes();
  };
  showModal();
}

// ===== PROJECTS =====
let projStatus = 'all';
async function loadProjects() {
  const projects = await API.get('/api/projects');
  const filtered = projStatus === 'all' ? projects : projects.filter(p => p.status === projStatus);
  const grid = document.getElementById('projectGrid');
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">◈</div><p>暂无项目，点击右上角创建吧～</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="project-card ${p.color}" data-id="${p.id}">
      <div class="project-name">${escHtml(p.name)}</div>
      <div class="project-desc">${escHtml(p.description || '暂无描述')}</div>
      <div class="project-progress-bar"><div class="project-progress-fill ${p.progress>=80?'high':p.progress<30?'low':''}" style="width:${p.progress}%"></div></div>
      <div class="project-footer">
        <span class="project-status ${p.status}">${p.status=='active'?'进行中':p.status=='paused'?'暂停':'已完成'}</span>
        <span class="project-pct">${p.progress}%</span>
      </div>
      <div class="project-actions">
        <button class="project-action" onclick="editProject(${p.id})">编辑</button>
        <button class="project-action" onclick="deleteProject(${p.id})">删除</button>
      </div>
    </div>
  `).join('');
}

document.querySelectorAll('.filter-tab[data-pstatus]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-pstatus]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    projStatus = tab.dataset.pstatus;
    loadProjects();
  });
});

document.getElementById('btnAddProject').addEventListener('click', () => openProjectModal());

async function deleteProject(id) {
  await API.del(`/api/projects/${id}`);
  toast('项目已删除');
  loadProjects();
}
function editProject(id) {
  API.get('/api/projects').then(projects => {
    const p = projects.find(p => p.id === id);
    if (p) openProjectModal(p);
  });
}

function openProjectModal(proj = null) {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = proj ? '编辑项目' : '新建项目';
  let selColor = proj ? proj.color : 'cyan';
  body.innerHTML = `
    <div class="field">
      <label>项目名称</label>
      <input type="text" id="f_projName" value="${proj?escAttr(proj.name):''}" placeholder="输入项目名称...">
    </div>
    <div class="field">
      <label>项目描述</label>
      <textarea id="f_projDesc" placeholder="简单描述...">${proj?escHtml(proj.description||''):''}</textarea>
    </div>
    <div class="field-row">
      <div class="field">
        <label>进度 ${proj?proj.progress:0}%</label>
        <input type="range" id="f_projProg" min="0" max="100" value="${proj?proj.progress:0}" style="width:100%" oninput="this.previousElementSibling.textContent='进度 '+this.value+'%'">
      </div>
      <div class="field">
        <label>状态</label>
        <select id="f_projStatus">
          <option value="active" ${proj&&proj.status==='active'?'selected':''}>进行中</option>
          <option value="paused" ${proj&&proj.status==='paused'?'selected':''}>暂停</option>
          <option value="done" ${proj&&proj.status==='done'?'selected':''}>已完成</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>颜色</label>
      <div class="color-pick" id="projColorPick">
        <div class="color-opt cyan ${selColor==='cyan'?'sel':''}" data-c="cyan"></div>
        <div class="color-opt pink ${selColor==='pink'?'sel':''}" data-c="pink"></div>
        <div class="color-opt yellow ${selColor==='yellow'?'sel':''}" data-c="yellow"></div>
        <div class="color-opt purple ${selColor==='purple'?'sel':''}" data-c="purple"></div>
      </div>
    </div>
  `;
  document.querySelectorAll('#projColorPick .color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#projColorPick .color-opt').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
      selColor = opt.dataset.c;
    });
  });
  document.getElementById('modalSave').onclick = async () => {
    const data = {
      name: document.getElementById('f_projName').value.trim(),
      description: document.getElementById('f_projDesc').value,
      progress: parseInt(document.getElementById('f_projProg').value),
      status: document.getElementById('f_projStatus').value,
      color: selColor
    };
    if (!data.name) { toast('请输入项目名称', 'error'); return; }
    if (proj) {
      await API.put(`/api/projects/${proj.id}`, { ...proj, ...data });
      toast('项目已更新');
    } else {
      await API.post('/api/projects', data);
      toast('项目已创建 ◈');
    }
    closeModal();
    loadProjects();
  };
  showModal();
}

// ===== SCHEDULE =====
let scheduleDate = new Date();
async function loadSchedule() {
  const y = scheduleDate.getFullYear();
  const m = scheduleDate.getMonth();
  const monthStr = `${y}-${String(m+1).padStart(2,'0')}`;
  document.getElementById('scheduleMonth').textContent = `${y}年${m+1}月`;
  const schedules = await API.get(`/api/schedules?month=${monthStr}`);
  const container = document.getElementById('scheduleContainer');
  const weekdays = ['日','一','二','三','四','五','六'];
  let html = weekdays.map(d => `<div class="schedule-weekday">${d}</div>`).join('');
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();
  const today = todayStr();
  const todayDate = new Date().getDate();
  const todayMonth = new Date().getMonth();
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + i + 1;
    html += `<div class="schedule-day other-month"><span class="schedule-day-num">${d}</span></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = schedules.filter(s => s.date === dateStr);
    const isToday = (m === todayMonth && d === todayDate);
    html += `<div class="schedule-day ${isToday?'today':''}" onclick="addScheduleForDate('${dateStr}')">
      <span class="schedule-day-num">${d}</span>
      <div class="schedule-events">
        ${dayEvents.slice(0,3).map(s => `<div class="schedule-event ${s.type}">${escHtml(s.title)}</div>`).join('')}
      </div>
    </div>`;
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - totalCells % 7) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="schedule-day other-month"><span class="schedule-day-num">${i}</span></div>`;
  }
  container.innerHTML = html;
}

document.getElementById('prevMonth').addEventListener('click', () => { scheduleDate.setMonth(scheduleDate.getMonth()-1); loadSchedule(); });
document.getElementById('nextMonth').addEventListener('click', () => { scheduleDate.setMonth(scheduleDate.getMonth()+1); loadSchedule(); });
document.getElementById('btnAddSchedule').addEventListener('click', () => openScheduleModal());

function addScheduleForDate(date) { openScheduleModal(null, date); }

function openScheduleModal(sched = null, dateOverride = null) {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = sched ? '编辑日程' : '新建日程';
  const defaultDate = dateOverride || (sched ? sched.date : todayStr());
  body.innerHTML = `
    <div class="field">
      <label>日程标题</label>
      <input type="text" id="f_schedTitle" value="${sched?escAttr(sched.title):''}" placeholder="输入日程标题...">
    </div>
    <div class="field-row">
      <div class="field">
        <label>日期</label>
        <input type="date" id="f_schedDate" value="${defaultDate}">
      </div>
      <div class="field">
        <label>时间</label>
        <input type="time" id="f_schedTime" value="${sched&&sched.time?sched.time:''}">
      </div>
    </div>
    <div class="field">
      <label>类型</label>
      <select id="f_schedType">
        <option value="task" ${sched&&sched.type==='task'?'selected':''}>任务</option>
        <option value="meeting" ${sched&&sched.type==='meeting'?'selected':''}>会议</option>
        <option value="reminder" ${sched&&sched.type==='reminder'?'selected':''}>提醒</option>
      </select>
    </div>
  `;
  document.getElementById('modalSave').onclick = async () => {
    const data = {
      title: document.getElementById('f_schedTitle').value.trim(),
      date: document.getElementById('f_schedDate').value,
      time: document.getElementById('f_schedTime').value,
      type: document.getElementById('f_schedType').value
    };
    if (!data.title || !data.date) { toast('请填写标题和日期', 'error'); return; }
    if (sched) {
      await API.put(`/api/schedules/${sched.id}`, { ...sched, ...data });
      toast('日程已更新');
    } else {
      await API.post('/api/schedules', data);
      toast('日程已创建 ♪');
    }
    closeModal();
    loadSchedule();
  };
  showModal();
}

// ===== QUICK ADD =====
document.getElementById('btnQuickAdd').addEventListener('click', quickAddTask);
document.getElementById('quickInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') quickAddTask(); });

async function quickAddTask() {
  const input = document.getElementById('quickInput');
  const title = input.value.trim();
  if (!title) return;
  await API.post('/api/tasks', { title, category: 'general', priority: 0, due_date: null });
  toast('任务已添加 ♪');
  input.value = '';
  refreshCurrent();
}

// ===== SLT EXPERIENCE =====
let sltCat = 'all';
async function loadSlt() {
  const slts = await API.get(`/api/slt?category=${sltCat}`);
  const grid = document.getElementById('sltGrid');
  if (slts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><p>暂无经验，点击右上角创建吧～</p></div>';
    return;
  }
  grid.innerHTML = slts.map(s => {
    const atts = s.attachments || [];
    const imgAtts = atts.filter(a => a.is_image);
    const fileAtts = atts.filter(a => !a.is_image);
    return `
    <div class="note-card ${s.color}" data-id="${s.id}" onclick="viewSlt(${s.id})">
      ${s.pinned?'<div class="note-pin">📌</div>':''}
      <div class="note-title">${escHtml(s.title)}</div>
      <div class="note-content">${escHtml(s.content)}</div>
      ${imgAtts.length ? `<div class="note-images">${imgAtts.slice(0,4).map(a => `<img src="${a.url}" class="note-thumb" onclick="event.stopPropagation();window.open('${a.url}','_blank')" alt="${escAttr(a.original_name)}">`).join('')}${imgAtts.length>4?`<div class="note-more-img">+${imgAtts.length-4}</div>`:''}</div>` : ''}
      ${fileAtts.length ? `<div class="note-files">${fileAtts.slice(0,3).map(a => `<a href="${a.url}" class="note-file-link" download title="${escAttr(a.original_name)}" onclick="event.stopPropagation()"><span class="file-icon">📄</span><span class="file-name">${escHtml(a.original_name)}</span><span class="file-size">${formatFileSize(a.size)}</span></a>`).join('')}${fileAtts.length>3?`<span class="note-more-file">+${fileAtts.length-3}个文件</span>`:''}</div>` : ''}
      <div class="note-footer">
        <span class="note-cat">${escHtml(s.category)}</span>
        <span class="note-date">${formatDate(s.updated_at)}</span>
      </div>
      <div class="note-actions">
        <button class="note-action" onclick="event.stopPropagation();editSlt(${s.id})" title="编辑">✎</button>
        <button class="note-action" onclick="event.stopPropagation();pinSlt(${s.id},${s.pinned?0:1})" title="置顶">📌</button>
        <button class="note-action" onclick="event.stopPropagation();deleteSlt(${s.id})" title="删除">✕</button>
      </div>
    </div>
  `;}).join('');
}

document.querySelectorAll('.filter-tab[data-scat]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-scat]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sltCat = tab.dataset.scat;
    loadSlt();
  });
});

document.getElementById('btnAddSlt').addEventListener('click', () => openSltModal());

async function pinSlt(id, pinned) {
  const slts = await API.get('/api/slt');
  const s = slts.find(s => s.id === id);
  if (s) { await API.put(`/api/slt/${id}`, { ...s, pinned }); toast(pinned?'已置顶':'已取消置顶'); loadSlt(); }
}
async function deleteSlt(id) {
  await API.del(`/api/slt/${id}`);
  toast('经验已删除');
  loadSlt();
}
function viewSlt(id) {
  API.get('/api/slt').then(slts => {
    const s = slts.find(ss => ss.id === id);
    if (!s) return;
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = s.title;
    const atts = s.attachments || [];
    const imgAtts = atts.filter(a => a.is_image);
    const fileAtts = atts.filter(a => !a.is_image);
    const catNames = { general:'常规', test:'测试方法', case:'用例设计', bug:'缺陷分析', summary:'总结报告' };
    body.innerHTML = `
      <div class="note-view-meta">
        <span class="note-view-tag">${catNames[s.category] || s.category}</span>
        <span class="note-view-date">更新于 ${s.updated_at || ''}</span>
        ${s.pinned?'<span class="note-view-tag pinned">📌 已置顶</span>':''}
      </div>
      <div class="note-view-content">${escHtml(s.content) || '<span style="color:#999">（无内容）</span>'}</div>
      ${imgAtts.length ? `<div class="note-view-images">${imgAtts.map(a => `<img src="${a.url}" class="note-view-img" onclick="window.open('${a.url}','_blank')" alt="${escAttr(a.original_name)}">`).join('')}</div>` : ''}
      ${fileAtts.length ? `<div class="note-view-files">${fileAtts.map(a => `<a href="${a.url}" class="note-file-link" download><span class="file-icon">📄</span><span class="file-name">${escHtml(a.original_name)}</span><span class="file-size">${formatFileSize(a.size)}</span></a>`).join('')}</div>` : ''}
    `;
    document.getElementById('modalSave').style.display = 'none';
    document.getElementById('modalCancel').textContent = '关闭';
    const editBtn = document.getElementById('modalEditBtn');
    editBtn.style.display = 'inline-block';
    editBtn.onclick = () => { document.getElementById('modalSave').style.display = ''; editBtn.style.display = 'none'; document.getElementById('modalCancel').textContent = '取消'; openSltModal(s); };
    showModal();
  });
}
function editSlt(id) {
  API.get('/api/slt').then(slts => {
    const s = slts.find(ss => ss.id === id);
    if (s) openSltModal(s);
  });
}

function openSltModal(s = null) {
  const body = document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent = s ? '编辑经验' : '新建经验';
  document.getElementById('modalSave').style.display = '';
  document.getElementById('modalEditBtn').style.display = 'none';
  document.getElementById('modalCancel').textContent = '取消';
  let selColor = s ? s.color : 'cyan';
  let attachments = (s && s.attachments) ? [...s.attachments] : [];
  let pendingId = s ? s.id : null;
  body.innerHTML = `
    <div class="field">
      <label>标题</label>
      <input type="text" id="f_sltTitle" value="${s?escAttr(s.title):''}" placeholder="输入经验标题...">
    </div>
    <div class="field">
      <label>内容</label>
      <textarea id="f_sltContent" placeholder="分享你的测试经验...">${s?escHtml(s.content):''}</textarea>
    </div>
    <div class="field">
      <label>附件上传</label>
      <div class="note-upload-area" id="sltUploadArea">
        <span class="upload-placeholder">点击或拖拽文件到这里<br><small>支持图片/PDF/Word/Excel/PPT/ZIP/视频/音频，最大10MB</small></small></span>
        <input type="file" id="sltFileInput" multiple style="display:none">
      </div>
      <div id="sltAttachList" class="note-attach-list"></div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>分类</label>
        <select id="f_sltCat">
          <option value="general" ${s&&s.category==='general'?'selected':''}>常规</option>
          <option value="test" ${s&&s.category==='test'?'selected':''}>测试方法</option>
          <option value="case" ${s&&s.category==='case'?'selected':''}>用例设计</option>
          <option value="bug" ${s&&s.category==='bug'?'selected':''}>缺陷分析</option>
          <option value="summary" ${s&&s.category==='summary'?'selected':''}>总结报告</option>
        </select>
      </div>
      <div class="field">
        <label>颜色</label>
        <div class="color-pick" id="sltColorPick">
          <div class="color-opt cyan ${selColor==='cyan'?'sel':''}" data-c="cyan"></div>
          <div class="color-opt pink ${selColor==='pink'?'sel':''}" data-c="pink"></div>
          <div class="color-opt yellow ${selColor==='yellow'?'sel':''}" data-c="yellow"></div>
          <div class="color-opt purple ${selColor==='purple'?'sel':''}" data-c="purple"></div>
          <div class="color-opt white ${selColor==='white'?'sel':''}" data-c="white"></div>
        </div>
      </div>
    </div>
  `;
  function renderAttachList() {
    const list = document.getElementById('sltAttachList');
    if (attachments.length === 0) { list.innerHTML = ''; return; }
    list.innerHTML = attachments.map((a, i) => `
      <div class="attach-item">
        ${a.is_image ? `<img src="${a.url}" class="attach-thumb">` : `<span class="attach-file-icon">📄</span>`}
        <span class="attach-name">${escHtml(a.original_name)}</span>
        <span class="attach-size">${formatFileSize(a.size)}</span>
        <button class="attach-remove" onclick="removeSltAttach(${i})" title="删除">✕</button>
      </div>
    `).join('');
  }
  renderAttachList();
  document.querySelectorAll('#sltColorPick .color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#sltColorPick .color-opt').forEach(o => o.classList.remove('sel'));
      opt.classList.add('sel');
      selColor = opt.dataset.c;
    });
  });
  const uploadArea = document.getElementById('sltUploadArea');
  const fileInput = document.getElementById('sltFileInput');
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('drag-over'); });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleSltFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => handleSltFiles(e.target.files));
  async function handleSltFiles(files) {
    if (files.length === 0) return;
    if (!pendingId) {
      const data = {
        title: document.getElementById('f_sltTitle').value.trim() || '无标题经验',
        content: document.getElementById('f_sltContent').value,
        category: document.getElementById('f_sltCat').value,
        color: selColor
      };
      const resp = await API.post('/api/slt', data);
      pendingId = resp.id;
      s = resp;
    }
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      uploadArea.querySelector('.upload-placeholder').innerHTML = `上传中: ${escHtml(file.name)}...`;
      const resp = await fetch(`/api/slt/${pendingId}/upload`, {method:'POST', body:formData});
      const data = await resp.json();
      if (data.success) {
        attachments = data.attachments;
        renderAttachList();
      } else {
        toast(data.error || '上传失败', 'error');
      }
    }
    uploadArea.querySelector('.upload-placeholder').innerHTML = '点击或拖拽文件到这里<br><small>支持图片/PDF/Word/Excel/PPT/ZIP/视频/音频，最大10MB</small>';
  }
  window.removeSltAttach = async (idx) => {
    const att = attachments[idx];
    if (pendingId && att) {
      await fetch(`/api/slt/${pendingId}/attachment/${att.filename}`, {method:'DELETE'});
      attachments = attachments.filter((_, i) => i !== idx);
      renderAttachList();
    }
  };
  document.getElementById('modalSave').onclick = async () => {
    const data = {
      title: document.getElementById('f_sltTitle').value.trim(),
      content: document.getElementById('f_sltContent').value,
      category: document.getElementById('f_sltCat').value,
      color: selColor
    };
    if (!data.title) { toast('请输入标题', 'error'); return; }
    if (pendingId) {
      await API.put(`/api/slt/${pendingId}`, { ...s, ...data });
      toast('经验已更新');
    } else {
      await API.post('/api/slt', data);
      toast('经验已创建 ⚡');
    }
    closeModal();
    loadSlt();
  };
  showModal();
}

// ===== MODAL HELPERS =====
function showModal() { document.getElementById('modalOverlay').classList.add('show'); }
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('modalEditBtn').style.display = 'none';
  document.getElementById('modalSave').style.display = '';
  document.getElementById('modalCancel').textContent = '取消';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });

// ===== MISC =====
function switchPage(page) {
  document.querySelector(`.nav-item[data-page="${page}"]`).click();
}

function refreshCurrent() {
  const active = document.querySelector('.nav-item.active').dataset.page;
  if (active === 'dashboard') loadDashboard();
  else if (active === 'tasks') loadTasks();
  else if (active === 'notes') loadNotes();
  else if (active === 'projects') loadProjects();
  else if (active === 'schedule') loadSchedule();
  else if (active === 'slt') loadSlt();
  loadDashboard();
}

function escHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { if (!s) return ''; return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;'); }

// ===== INIT =====
checkAuth();
setGreeting();
setDate();
loadDashboard();
