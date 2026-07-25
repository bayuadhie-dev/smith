#!/usr/bin/env python3
"""
=============================================================================
           SCRIPT MIGRASI AUTOMATIS: SQLITE TO POSTGRESQL (ERP)
=============================================================================
Skrip ini digunakan untuk mengonversi & memindahkan seluruh data dari SQLite 
(erp_database.db) ke PostgreSQL secara aman dan loss-free.

Cara Penggunaan di PC Server:
1. Pastikan PostgreSQL sudah aktif dan database target sudah dibuat:
   sudo -u postgres psql -c "CREATE DATABASE erp_db;"

2. Jalankan skrip ini dari folder backend:
   python3 scripts/migrate_to_postgres.py

3. Setelah sukses, ubah file .env backend:
   DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/erp_db
=============================================================================
"""

import os
import sys
import sqlite3
import argparse

def main():
    parser = argparse.ArgumentParser(description="ERP SQLite to PostgreSQL Migration Tool")
    parser.add_argument("--sqlite", type=str, default="", help="Path file SQLite (default: auto-detect di folder instance/)")
    parser.add_argument("--pg-uri", type=str, default="", help="PostgreSQL connection URI (default: dari DATABASE_URL di .env)")
    args = parser.parse_args()

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)
    os.chdir(backend_dir)

    # 1. Detect SQLite File
    sqlite_path = args.sqlite
    if not sqlite_path:
        possible_paths = [
            os.path.join(backend_dir, 'instance', 'erp_database.db'),
            os.path.join(backend_dir, 'erp_database.db')
        ]
        for p in possible_paths:
            if os.path.exists(p):
                sqlite_path = p
                break

    if not sqlite_path or not os.path.exists(sqlite_path):
        print("❌ ERROR: File SQLite erp_database.db tidak ditemukan!")
        sys.exit(1)

    # 2. Detect PostgreSQL URI
    pg_uri = args.pg_uri or os.getenv('TARGET_POSTGRES_URL') or os.getenv('DATABASE_URL')
    if not pg_uri or not pg_uri.startswith('postgresql'):
        # Prompt user if not specified
        print("\n🐘 Masukkan URI PostgreSQL Target:")
        print("Contoh: postgresql://postgres:password_anda@localhost:5432/erp_db")
        input_uri = input("URI PostgreSQL: ").strip()
        if input_uri:
            pg_uri = input_uri
        else:
            pg_uri = 'postgresql://postgres:postgres@localhost:5432/erp_db'

    print(f"\n==================================================")
    print(f"📦 Source SQLite DB : {sqlite_path}")
    print(f"🐘 Target Postgres  : {pg_uri}")
    print(f"==================================================\n")

    # Check psycopg2
    try:
        import psycopg2
    except ImportError:
        print("⚠️ Module 'psycopg2' belum terinstall. Menginstall psycopg2-binary...")
        os.system(f"{sys.executable} -m pip install psycopg2-binary")
        import psycopg2

    # Step 1: Create Schema via Flask SQLAlchemy
    print("🔨 [1/3] Membuat struktur tabel & skema di PostgreSQL...")
    os.environ['DATABASE_URL'] = pg_uri
    try:
        from app import create_app, db
        app = create_app()
        with app.app_context():
            db.create_all()
        print("   ✅ Skema tabel berhasil dibuat di PostgreSQL!")
    except Exception as e:
        print(f"   ❌ Gagal membuat skema di PostgreSQL: {e}")
        sys.exit(1)

    # Step 2: Transfer Data
    print("\n📦 [2/3] Memindahkan data dari SQLite ke PostgreSQL...")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(pg_uri)
    pg_cur = pg_conn.cursor()

    # Get Postgres Column Types
    pg_cur.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public';
    """)
    pg_col_types = {}
    for t_name, c_name, d_type in pg_cur.fetchall():
        if t_name not in pg_col_types:
            pg_col_types[t_name] = {}
        pg_col_types[t_name][c_name] = d_type.lower()

    # SQLite Tables
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%';")
    sqlite_tables = [row[0] for row in sqlite_cur.fetchall()]

    # Priority order (parent tables first)
    priority = ['users', 'roles', 'user_roles', 'permissions', 'role_permissions', 'products', 'customers', 'suppliers', 'machines', 'work_orders']
    ordered_tables = [t for t in priority if t in sqlite_tables] + [t for t in sqlite_tables if t not in priority]

    # Disable FK constraints during bulk copy
    pg_cur.execute("SET session_replication_role = 'replica';")

    migrated_count = 0
    total_rows = 0

    for table in ordered_tables:
        if table not in pg_col_types:
            continue

        try:
            sqlite_cur.execute(f"SELECT * FROM \"{table}\";")
            rows = sqlite_cur.fetchall()
            if not rows:
                continue

            valid_cols = [c for c in list(rows[0].keys()) if c in pg_col_types[table]]
            if not valid_cols:
                continue

            cols_str = ', '.join([f'"{c}"' for c in valid_cols])
            placeholders = ', '.join(['%s'] * len(valid_cols))

            data_values = []
            for r in rows:
                r_dict = dict(r)
                row_vals = []
                for col in valid_cols:
                    val = r_dict[col]
                    target_type = pg_col_types[table].get(col, '')

                    # Convert SQLite integers 1/0 to Postgres boolean
                    if 'bool' in target_type:
                        if val in (1, '1', True):
                            val = True
                        elif val in (0, '0', False):
                            val = False
                        else:
                            val = None
                    elif isinstance(val, bytes):
                        val = val.decode('utf-8', errors='ignore')

                    row_vals.append(val)
                data_values.append(tuple(row_vals))

            insert_sql = f"INSERT INTO \"{table}\" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"
            pg_cur.executemany(insert_sql, data_values)
            pg_conn.commit()

            print(f"   ✓ Tabel '{table}': {len(data_values)} baris berhasil dipindahkan")
            migrated_count += 1
            total_rows += len(data_values)
        except Exception as err:
            pg_conn.rollback()
            print(f"   ⚠️ Skip tabel '{table}': {err}")

    # Re-enable FK constraints
    pg_cur.execute("SET session_replication_role = 'origin';")
    pg_conn.commit()

    # Step 3: Reset Sequences
    print("\n🔄 [3/3] Mereset urutan ID auto-increment PostgreSQL...")
    for table in ordered_tables:
        if table in pg_col_types and 'id' in pg_col_types[table]:
            try:
                pg_cur.execute(f"""
                    SELECT setval(pg_get_serial_sequence('"{table}"', 'id'), COALESCE(MAX(id), 1)) FROM "{table}";
                """)
                pg_conn.commit()
            except Exception:
                pg_conn.rollback()

    sqlite_conn.close()
    pg_conn.close()

    print(f"\n==================================================")
    print(f"🎉 MIGRASI SUKSES! Total {migrated_count} tabel & {total_rows} baris data berhasil dipindahkan ke PostgreSQL.")
    print(f"==================================================\n")

if __name__ == '__main__':
    main()
