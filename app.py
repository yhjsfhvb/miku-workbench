from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from werkzeug.utils import secure_filename
import sqlite3, os, json, hashlib, secrets
from datetime import datetime, date
from functools import wraps

app = Flask(__name__)
app.json.ensure_ascii = False
app.config['JSON_AS_ASCII'] = False
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miku_workbench.db')
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        priority INTEGER DEFAULT 0,
        due_date TEXT,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        color TEXT DEFAULT 'cyan',
        pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT 'cyan',
        progress INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        type TEXT DEFAULT 'task',
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )''')

    # Create default user if not exists
    existing = c.execute('SELECT * FROM users WHERE username=?', ('yao',)).fetchone()
    if not existing:
        pw_hash = hashlib.sha256('123456'.encode()).hexdigest()
        c.execute('INSERT INTO users (username, password) VALUES (?, ?)', ('yao', pw_hash))
        print('Default user created: yao / 123456')

    conn.commit()
    conn.close()


# ========== AUTH ==========
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'unauthorized'}), 401
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect('/')
    return render_template('login.html')


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    username = data.get('username', '')
    password = data.get('password', '')
    pw_hash = hashlib.sha256(password.encode()).hexdigest()

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE username=? AND password=?', (username, pw_hash)).fetchone()
    conn.close()

    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'username': user['username'], 'avatar': user['avatar']})
    return jsonify({'success': False, 'error': '用户名或密码错误'}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/auth/check')
def auth_check():
    if 'user_id' in session:
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone()
        conn.close()
        if user:
            return jsonify({'logged_in': True, 'username': user['username'], 'avatar': user['avatar']})
    return jsonify({'logged_in': False})


@app.route('/api/avatar/upload', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({'error': '未选择文件'}), 400
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件格式'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f'avatar_{session["user_id"]}_{int(datetime.now().timestamp())}.{ext}'
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    avatar_url = f'/static/uploads/{filename}'
    conn = get_db()
    conn.execute('UPDATE users SET avatar=? WHERE id=?', (avatar_url, session['user_id']))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'avatar': avatar_url})


# ========== ROUTES ==========
@app.route('/')
@login_required
def index():
    return render_template('index.html')


# ========== TASK API ==========
@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    conn = get_db()
    filter_type = request.args.get('filter', 'all')
    if filter_type == 'completed':
        tasks = conn.execute('SELECT * FROM tasks WHERE completed=1 ORDER BY completed_at DESC').fetchall()
    elif filter_type == 'pending':
        tasks = conn.execute('SELECT * FROM tasks WHERE completed=0 ORDER BY priority DESC, created_at DESC').fetchall()
    elif filter_type == 'today':
        today = date.today().isoformat()
        tasks = conn.execute('SELECT * FROM tasks WHERE due_date=? AND completed=0 ORDER BY priority DESC', (today,)).fetchall()
    else:
        tasks = conn.execute('SELECT * FROM tasks ORDER BY completed ASC, priority DESC, created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(t) for t in tasks])


@app.route('/api/tasks', methods=['POST'])
@login_required
def add_task():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO tasks (title, category, priority, due_date) VALUES (?, ?, ?, ?)',
              (data.get('title', ''), data.get('category', 'general'), data.get('priority', 0), data.get('due_date')))
    conn.commit()
    task_id = c.lastrowid
    task = conn.execute('SELECT * FROM tasks WHERE id=?', (task_id,)).fetchone()
    conn.close()
    return jsonify(dict(task)), 201


@app.route('/api/tasks/<int:tid>', methods=['PUT'])
@login_required
def update_task(tid):
    data = request.json
    conn = get_db()
    task = conn.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'not found'}), 404
    completed = data.get('completed', task['completed'])
    completed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S') if completed and not task['completed'] else (None if not completed else task['completed_at'])
    conn.execute('UPDATE tasks SET title=?, category=?, priority=?, due_date=?, completed=?, completed_at=? WHERE id=?',
                 (data.get('title', task['title']), data.get('category', task['category']),
                  data.get('priority', task['priority']), data.get('due_date', task['due_date']),
                  completed, completed_at, tid))
    conn.commit()
    task = conn.execute('SELECT * FROM tasks WHERE id=?', (tid,)).fetchone()
    conn.close()
    return jsonify(dict(task))


@app.route('/api/tasks/<int:tid>', methods=['DELETE'])
@login_required
def delete_task(tid):
    conn = get_db()
    conn.execute('DELETE FROM tasks WHERE id=?', (tid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ========== NOTE API ==========
@app.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    conn = get_db()
    category = request.args.get('category')
    if category and category != 'all':
        notes = conn.execute('SELECT * FROM notes WHERE category=? ORDER BY pinned DESC, updated_at DESC', (category,)).fetchall()
    else:
        notes = conn.execute('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').fetchall()
    conn.close()
    return jsonify([dict(n) for n in notes])


@app.route('/api/notes', methods=['POST'])
@login_required
def add_note():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO notes (title, content, category, color) VALUES (?, ?, ?, ?)',
              (data.get('title', ''), data.get('content', ''), data.get('category', 'general'), data.get('color', 'cyan')))
    conn.commit()
    note_id = c.lastrowid
    note = conn.execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
    conn.close()
    return jsonify(dict(note)), 201


@app.route('/api/notes/<int:nid>', methods=['PUT'])
@login_required
def update_note(nid):
    data = request.json
    conn = get_db()
    note = conn.execute('SELECT * FROM notes WHERE id=?', (nid,)).fetchone()
    if not note:
        conn.close()
        return jsonify({'error': 'not found'}), 404
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute('UPDATE notes SET title=?, content=?, category=?, color=?, pinned=?, updated_at=? WHERE id=?',
                 (data.get('title', note['title']), data.get('content', note['content']),
                  data.get('category', note['category']), data.get('color', note['color']),
                  data.get('pinned', note['pinned']), now, nid))
    conn.commit()
    note = conn.execute('SELECT * FROM notes WHERE id=?', (nid,)).fetchone()
    conn.close()
    return jsonify(dict(note))


@app.route('/api/notes/<int:nid>', methods=['DELETE'])
@login_required
def delete_note(nid):
    conn = get_db()
    conn.execute('DELETE FROM notes WHERE id=?', (nid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ========== PROJECT API ==========
@app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    conn = get_db()
    projects = conn.execute('SELECT * FROM projects ORDER BY status ASC, created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(p) for p in projects])


@app.route('/api/projects', methods=['POST'])
@login_required
def add_project():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
              (data.get('name', ''), data.get('description', ''), data.get('color', 'cyan')))
    conn.commit()
    pid = c.lastrowid
    project = conn.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
    conn.close()
    return jsonify(dict(project)), 201


@app.route('/api/projects/<int:pid>', methods=['PUT'])
@login_required
def update_project(pid):
    data = request.json
    conn = get_db()
    project = conn.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({'error': 'not found'}), 404
    conn.execute('UPDATE projects SET name=?, description=?, color=?, progress=?, status=? WHERE id=?',
                 (data.get('name', project['name']), data.get('description', project['description']),
                  data.get('color', project['color']), data.get('progress', project['progress']),
                  data.get('status', project['status']), pid))
    conn.commit()
    project = conn.execute('SELECT * FROM projects WHERE id=?', (pid,)).fetchone()
    conn.close()
    return jsonify(dict(project))


@app.route('/api/projects/<int:pid>', methods=['DELETE'])
@login_required
def delete_project(pid):
    conn = get_db()
    conn.execute('DELETE FROM projects WHERE id=?', (pid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ========== SCHEDULE API ==========
@app.route('/api/schedules', methods=['GET'])
@login_required
def get_schedules():
    conn = get_db()
    month = request.args.get('month')
    if month:
        schedules = conn.execute('SELECT * FROM schedules WHERE date LIKE ? ORDER BY date, time', (f'{month}%',)).fetchall()
    else:
        schedules = conn.execute('SELECT * FROM schedules ORDER BY date, time').fetchall()
    conn.close()
    return jsonify([dict(s) for s in schedules])


@app.route('/api/schedules', methods=['POST'])
@login_required
def add_schedule():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO schedules (title, date, time, type) VALUES (?, ?, ?, ?)',
              (data.get('title', ''), data.get('date', ''), data.get('time', ''), data.get('type', 'task')))
    conn.commit()
    sid = c.lastrowid
    sched = conn.execute('SELECT * FROM schedules WHERE id=?', (sid,)).fetchone()
    conn.close()
    return jsonify(dict(sched)), 201


@app.route('/api/schedules/<int:sid>', methods=['PUT'])
@login_required
def update_schedule(sid):
    data = request.json
    conn = get_db()
    sched = conn.execute('SELECT * FROM schedules WHERE id=?', (sid,)).fetchone()
    if not sched:
        conn.close()
        return jsonify({'error': 'not found'}), 404
    conn.execute('UPDATE schedules SET title=?, date=?, time=?, type=?, completed=? WHERE id=?',
                 (data.get('title', sched['title']), data.get('date', sched['date']),
                  data.get('time', sched['time']), data.get('type', sched['type']),
                  data.get('completed', sched['completed']), sid))
    conn.commit()
    sched = conn.execute('SELECT * FROM schedules WHERE id=?', (sid,)).fetchone()
    conn.close()
    return jsonify(dict(sched))


@app.route('/api/schedules/<int:sid>', methods=['DELETE'])
@login_required
def delete_schedule(sid):
    conn = get_db()
    conn.execute('DELETE FROM schedules WHERE id=?', (sid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ========== DASHBOARD API ==========
@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    conn = get_db()
    today = date.today().isoformat()

    total_tasks = conn.execute('SELECT COUNT(*) as c FROM tasks').fetchone()['c']
    completed_tasks = conn.execute('SELECT COUNT(*) as c FROM tasks WHERE completed=1').fetchone()['c']
    pending_tasks = conn.execute('SELECT COUNT(*) as c FROM tasks WHERE completed=0').fetchone()['c']
    today_tasks = conn.execute('SELECT COUNT(*) as c FROM tasks WHERE due_date=? AND completed=0', (today,)).fetchone()['c']
    high_priority = conn.execute('SELECT COUNT(*) as c FROM tasks WHERE priority=2 AND completed=0').fetchone()['c']

    total_notes = conn.execute('SELECT COUNT(*) as c FROM notes').fetchone()['c']
    pinned_notes = conn.execute('SELECT COUNT(*) as c FROM notes WHERE pinned=1').fetchone()['c']

    total_projects = conn.execute('SELECT COUNT(*) as c FROM projects').fetchone()['c']
    active_projects = conn.execute('SELECT COUNT(*) as c FROM projects WHERE status="active"').fetchone()['c']

    recent_tasks = conn.execute('SELECT * FROM tasks WHERE completed=0 ORDER BY priority DESC, created_at DESC LIMIT 5').fetchall()
    recent_notes = conn.execute('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 3').fetchall()
    projects = conn.execute('SELECT * FROM projects WHERE status="active" ORDER BY progress DESC LIMIT 4').fetchall()

    today_schedules = conn.execute('SELECT * FROM schedules WHERE date=? ORDER BY time', (today,)).fetchall()

    conn.close()

    completion_rate = round(completed_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0

    return jsonify({
        'tasks': {'total': total_tasks, 'completed': completed_tasks, 'pending': pending_tasks,
                  'today': today_tasks, 'high_priority': high_priority, 'completion_rate': completion_rate},
        'notes': {'total': total_notes, 'pinned': pinned_notes},
        'projects': {'total': total_projects, 'active': active_projects, 'list': [dict(p) for p in projects]},
        'schedules': {'today': [dict(s) for s in today_schedules]},
        'recent_tasks': [dict(t) for t in recent_tasks],
        'recent_notes': [dict(n) for n in recent_notes],
    })


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5566))
    app.run(debug=True, host='0.0.0.0', port=port)
else:
    init_db()
