#!/usr/bin/env python3
"""Check for expense-related data in database"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect

app = Flask(__name__)
db_path = os.path.join(os.path.dirname(__file__), 'instance', 'erp_database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

with app.app_context():
    inspector = inspect(db.engine)

    print("=" * 60)
    print("DATABASE TABLES")
    print("=" * 60)
    tables = inspector.get_table_names()
    for table in sorted(tables):
        columns = [col['name'] for col in inspector.get_columns(table)]
        print(f"\n{table}:")
        print(f"  Columns: {', '.join(columns)}")

    print("\n" + "=" * 60)
    print("TABLE ROW COUNTS")
    print("=" * 60)
    with db.engine.connect() as conn:
        for table in sorted(tables):
            result = conn.execute(db.text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            if count > 0:
                print(f"{table}: {count} rows")

    print("\n" + "=" * 60)
    print("CHECKING FOR EXPENSE-RELATED DATA")
    print("=" * 60)

    # Check specific tables for expense patterns
    expense_keywords = ['expense', 'reimburs', 'cash', 'advance', 'claim', 'petty']
    with db.engine.connect() as conn:
        for table in sorted(tables):
            if any(kw in table.lower() for kw in expense_keywords):
                print(f"\nFound potential expense table: {table}")
                result = conn.execute(db.text(f"SELECT * FROM {table} LIMIT 3"))
                rows = result.fetchall()
                if rows:
                    columns = inspector.get_columns(table)
                    col_names = [col['name'] for col in columns]
                    print(f"  Columns: {col_names}")
                    for row in rows:
                        print(f"  Data: {dict(zip(col_names, row))}")
                else:
                    print(f"  Table is empty")

    print("\n" + "=" * 60)
    print("CHECKING payments TABLE")
    print("=" * 60)
    if 'payments' in tables:
        with db.engine.connect() as conn:
            result = conn.execute(db.text("SELECT * FROM payments LIMIT 5"))
            rows = result.fetchall()
            columns = inspector.get_columns('payments')
            col_names = [col['name'] for col in columns]
            print(f"Columns: {col_names}")
            if rows:
                for row in rows:
                    print(f"Data: {dict(zip(col_names, row))}")
            else:
                print("No data in payments table")

    print("\n" + "=" * 60)
    print("CHECKING pending_journal_entries TABLE")
    print("=" * 60)
    if 'pending_journal_entries' in tables:
        with db.engine.connect() as conn:
            result = conn.execute(db.text("SELECT * FROM pending_journal_entries LIMIT 5"))
            rows = result.fetchall()
            columns = inspector.get_columns('pending_journal_entries')
            col_names = [col['name'] for col in columns]
            print(f"Columns: {col_names}")
            if rows:
                for row in rows:
                    print(f"Data: {dict(zip(col_names, row))}")
            else:
                print("No data in pending_journal_entries table")
