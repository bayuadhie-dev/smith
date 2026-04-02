from app import create_app
from models.user import User
import sqlite3

app = create_app()

print("Using Flask SQLAlchemy to query Puji:")
with app.app_context():
    u1 = User.query.filter_by(username='Puji').first()
    if u1: print(f"Flask found Puji: {u1.id}, {u1.password_hash}")
    else: print("Flask didn't find Puji")

print("\nUsing sqlite3 directly on erp_database.db:")
try:
    conn = sqlite3.connect('erp_database.db')
    c = conn.cursor()
    c.execute("SELECT id, username, password_hash FROM users WHERE username='Puji'")
    res = c.fetchone()
    if res: print(f"SQLite found Puji in erp_database.db: {res}")
    else: print("SQLite didn't find Puji in erp_database.db")
    conn.close()
except Exception as e:
    print(e)
    
print("\nUsing sqlite3 directly on erp.db:")
try:
    conn = sqlite3.connect('erp.db')
    c = conn.cursor()
    c.execute("SELECT id, username, password_hash FROM users WHERE username='Puji'")
    res = c.fetchone()
    if res: print(f"SQLite found Puji in erp.db: {res}")
    else: print("SQLite didn't find Puji in erp.db")
    conn.close()
except Exception as e:
    print(e)

