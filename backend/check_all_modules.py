"""
Checks one representative GET endpoint per Flask blueprint using the app's
own test client (in-process, no real HTTP) + a minted JWT for user id 1
(super admin). Picks the GET rule with the fewest path params per blueprint
(prefers one with zero params so it needs no real record id), excludes
rules requiring the <int:id>-style params we can't safely guess.

Outputs a CSV: blueprint,prefix,method,path,status_code,note
"""
import sys
import csv

sys.path.insert(0, '.')
from app import create_app
from flask_jwt_extended import create_access_token

app = create_app()

with app.app_context():
    token = create_access_token(identity='1')

client = app.test_client()
headers = {'Authorization': f'Bearer {token}'}

# Group rules by blueprint
from collections import defaultdict
by_bp = defaultdict(list)
for rule in app.url_map.iter_rules():
    if rule.endpoint == 'static':
        continue
    bp = rule.endpoint.split('.')[0] if '.' in rule.endpoint else rule.endpoint
    methods = rule.methods or set()
    if 'GET' not in methods:
        continue
    by_bp[bp].append(rule)

rows = []
for bp, rules in sorted(by_bp.items()):
    # Prefer a rule with zero path-arguments; else take the one with fewest.
    rules_sorted = sorted(rules, key=lambda r: len(r.arguments))
    chosen = None
    for r in rules_sorted:
        if len(r.arguments) == 0:
            chosen = r
            break
    if not chosen:
        chosen = rules_sorted[0]

    path = str(chosen.rule)
    # Fill in dummy path params with 1 so the route at least executes
    test_path = path
    for arg in chosen.arguments:
        test_path = test_path.replace(f'<int:{arg}>', '1').replace(f'<{arg}>', '1')

    try:
        resp = client.get(test_path, headers=headers)
        status = resp.status_code
        note = ''
    except Exception as e:
        status = 'ERROR'
        note = str(e)[:120]

    rows.append({
        'blueprint': bp,
        'path_checked': test_path,
        'status_code': status,
        'note': note,
        'total_get_routes_in_bp': len(rules),
    })

with open('/tmp/module_check_result.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['blueprint', 'path_checked', 'status_code', 'note', 'total_get_routes_in_bp'])
    writer.writeheader()
    writer.writerows(rows)

print(f"Checked {len(rows)} blueprints, wrote /tmp/module_check_result.csv")
for r in rows:
    print(r['blueprint'], r['status_code'], r['path_checked'])
