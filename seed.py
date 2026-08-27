import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miku_workbench.db')

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Check encoding
enc = c.execute('PRAGMA encoding').fetchone()
print(f"DB encoding: {enc}")

# Delete all corrupted data (titles with ? chars)
c.execute("DELETE FROM tasks WHERE title LIKE '%?%'")
c.execute("DELETE FROM notes WHERE title LIKE '%?%' OR content LIKE '%?%'")
print(f"Deleted corrupted tasks: {c.rowcount}")

# Check what's left
tasks = c.execute("SELECT id, title FROM tasks").fetchall()
notes = c.execute("SELECT id, title FROM notes").fetchall()
projects = c.execute("SELECT id, name FROM projects").fetchall()
print(f"Remaining: tasks={len(tasks)}, notes={len(notes)}, projects={len(projects)}")
for t in tasks: print(f"  task {t[0]}: {t[1]}")
for n in notes: print(f"  note {n[0]}: {n[1]}")
for p in projects: print(f"  project {p[0]}: {p[1]}")

conn.commit()
conn.close()
print("Done. Corrupted data cleaned.")
