import urllib.request, json

resp = urllib.request.urlopen("http://127.0.0.1:5566/api/dashboard")
raw = resp.read()
text = raw.decode('utf-8')
data = json.loads(text)

print("=== Dashboard Data ===")
print(f"Tasks: {data['tasks']['pending']} pending, {data['tasks']['total']} total")
print(f"Notes: {data['notes']['total']} total, {data['notes']['pinned']} pinned")
print(f"Projects: {data['projects']['active']} active")

print("\n=== Recent Tasks ===")
for t in data['recent_tasks']:
    print(f"  [{t['id']}] {t['title']} (priority={t['priority']}, category={t['category']})")

print("\n=== Recent Notes ===")
for n in data['recent_notes']:
    print(f"  [{n['id']}] {n['title']} (color={n['color']}, pinned={n['pinned']})")

print("\n=== Projects ===")
for p in data['projects']['list']:
    print(f"  [{p['id']}] {p['name']} - {p['progress']}% ({p['status']})")

print("\n=== Today Schedules ===")
for s in data['schedules']['today']:
    print(f"  [{s['id']}] {s['time']} {s['title']} ({s['type']})")

print("\n=== Encoding Check ===")
print(f"Response bytes sample (first 100): {raw[:100]}")
print(f"Decoded OK: {len(text)} chars")
# Check if Chinese chars are present
has_cn = any('\u4e00' <= ch <= '\u9fff' for ch in text)
print(f"Contains Chinese characters: {has_cn}")
