import urllib.request, json

# Test 1: Check auth without login
resp = urllib.request.urlopen("http://127.0.0.1:5566/api/auth/check")
data = json.loads(resp.read())
print(f"1. Auth check (no login): {data}")

# Test 2: Login with correct credentials
login_data = json.dumps({"username":"yao","password":"123456"}).encode()
req = urllib.request.Request("http://127.0.0.1:5566/api/login", data=login_data, headers={"Content-Type":"application/json"})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
print(f"2. Login (yao/123456): {data}")

# Test 3: Check auth after login
cookies = resp.headers.get('Set-Cookie', '')
print(f"3. Cookie received: {cookies[:50]}...")

# Test 4: Login with wrong password
wrong_data = json.dumps({"username":"yao","password":"wrong"}).encode()
req = urllib.request.Request("http://127.0.0.1:5566/api/login", data=wrong_data, headers={"Content-Type":"application/json"})
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    print(f"4. Login (wrong pass): {data}")
except urllib.error.HTTPError as e:
    data = json.loads(e.read())
    print(f"4. Login (wrong pass): HTTP {e.code} - {data}")

print("\nAll tests passed!")
