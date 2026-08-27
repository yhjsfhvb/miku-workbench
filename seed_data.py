import sqlite3, os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miku_workbench.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Clear all existing data
c.execute("DELETE FROM tasks")
c.execute("DELETE FROM notes")
c.execute("DELETE FROM projects")
c.execute("DELETE FROM schedules")

today = date.today().isoformat()

# Tasks
tasks = [
    ('完成初音工作台UI设计', 'work', 2, today),
    ('整理项目文档和笔记', 'work', 1, None),
    ('学习Flask后端开发', 'study', 1, None),
    ('买猫粮和日用品', 'life', 0, today),
    ('回复邮件和消息', 'work', 1, None),
    ('本周读书计划：读完3章', 'study', 0, None),
]
for t in tasks:
    c.execute("INSERT INTO tasks (title, category, priority, due_date) VALUES (?,?,?,?)", t)

# Notes
notes = [
    ('Flask开发笔记', '记录Flask路由、模板、数据库操作要点\n1. 路由用@app.route装饰器\n2. 模板用Jinja2\n3. SQLite用sqlite3模块', 'work', 'cyan', 1),
    ('初音主题配色方案', '主色：#39C5BB 初音青\n辅色：#FFB3D9 樱花粉\n强调：#9B7EBD 淡紫\n背景：渐变 #e0f7f5 → #f5e0ed', 'idea', 'pink', 1),
    ('今日灵感', '把工作台做成初音主题，加入CSS绘制Miku头像\n用毛玻璃效果增加层次感\n浮动音符装饰增加氛围', 'idea', 'purple', 0),
    ('工作周报模板', '本周完成：\n下周计划：\n问题与风险：\n需要支持：', 'work', 'yellow', 0),
    ('读书笔记-代码整洁之道', '第一章：有意义的命名\n- 变量名要能表达意图\n- 避免误导性名称\n- 做有意义的区分', 'study', 'white', 0),
]
for n in notes:
    c.execute("INSERT INTO notes (title, content, category, color, pinned) VALUES (?,?,?,?,?)", n)

# Projects
projects = [
    ('Miku Workbench', '初音未来主题个人工作台 - 任务/笔记/项目/日程管理', 'cyan', 60, 'active'),
    ('数据分析可视化', '量产批次#9 跳跃相关性分析网页生成', 'pink', 85, 'active'),
    ('个人博客系统', '用Flask搭建博客，支持Markdown编辑', 'purple', 20, 'active'),
    ('学习计划', '系统学习Python Web开发全栈', 'yellow', 45, 'paused'),
]
for p in projects:
    c.execute("INSERT INTO projects (name, description, color, progress, status) VALUES (?,?,?,?,?)", p)

# Schedules
schedules = [
    ('团队周会', today, '10:00', 'meeting'),
    ('代码评审', today, '14:00', 'task'),
    ('健身时间', today, '19:00', 'reminder'),
    ('项目里程碑提交', f'{today}', '16:00', 'task'),
]
for s in schedules:
    c.execute("INSERT INTO schedules (title, date, time, type) VALUES (?,?,?,?)", s)

conn.commit()

# Verify data
for table in ['tasks', 'notes', 'projects', 'schedules']:
    rows = c.execute(f"SELECT * FROM {table}").fetchall()
    print(f"{table}: {len(rows)} rows")
    for r in rows[:2]:
        print(f"  {r}")

conn.close()
print("\nSeed data inserted successfully!")
