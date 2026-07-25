#!/usr/bin/env python3
"""
=============================================================================
     SKRIP MIGRASI PRODUCTION-GRADE: SQLITE TO POSTGRESQL (ERP)
=============================================================================
Skrip ini mengonversi & memindahkan data dari SQLite ke PostgreSQL dengan fitur:
- Fix Syntax & Attribute Name Error (args.dry_run)
- Multi-format Datetime Sanitizer (termasuk %d/%m/%Y, ISO 8601, Unix Timestamp)
- Fallback Batch Row-by-Row jika batch insert memicu error
- Toleransi Superuser Privileges (session_replication_role fallback)
- Verifikasi Otomatis Jumlah Baris Data khusus mode Eksekusi (Skip pada Dry-Run)
=============================================================================
"""

import os
import sys
import sqlite3
import argparse
from datetime import datetime

def parse_datetime(val):
    """Sanitasi & Konversi String Tanggal/Jam ke ISO 8601 Timestamp PostgreSQL."""
    if val is None or val == '' or str(val).strip() == '':
        return None
    val_str = str(val).strip()

    # 1. Jika angka murni (Unix Timestamp)
    if val_str.isdigit():
        try:
            return datetime.fromtimestamp(int(val_str)).isoformat()
        except Exception:
            return None

    # 2. Coba pustaka dateutil jika terinstall
    try:
        from dateutil import parser as date_parser
        return date_parser.parse(val_str).isoformat()
    except Exception:
        pass

    # 3. Fallback pencarian format datetime umum
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val_str, fmt).isoformat()
        except Exception:
            pass

    return val_str

def main():
    parser = argparse.ArgumentParser(description="ERP Production-Grade SQLite to PostgreSQL Migration Tool")
    parser.add_argument("--sqlite", type=str, default="", help="Path file SQLite")
    parser.add_argument("--pg-uri", type=str, default="", help="PostgreSQL connection URI")
    parser.add_argument("--dry-run", action="store_true", help="Cek & verifikasi tanpa eksekusi insert")
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
        print("\n🐘 Masukkan URI PostgreSQL Target:")
        print("Contoh: postgresql://postgres:password_anda@localhost:5432/erp_db")
        input_uri = input("URI PostgreSQL: ").strip()
        pg_uri = input_uri if input_uri else 'postgresql://postgres:postgres@localhost:5432/erp_db'

    print(f"\n==================================================")
    print(f"📦 Source SQLite DB : {sqlite_path}")
    print(f"🐘 Target Postgres  : {pg_uri}")
    if args.dry_run:
        print(f"🔍 MODE DRY-RUN     : AKTIF (Tanpa modifikasi DB target)")
    print(f"==================================================\n")

    try:
        import psycopg2
    except ImportError:
        print("⚠️ Installing psycopg2-binary...")
        os.system(f"{sys.executable} -m pip install psycopg2-binary")
        import psycopg2

    # Step 1: Create Schema via Flask SQLAlchemy
    if not args.dry_run:
        print("🔨 [1/4] Membuat struktur tabel & skema di PostgreSQL...")
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
    print("\n📦 [2/4] Membaca data dari SQLite...")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(pg_uri)
    pg_cur = pg_conn.cursor()

    # Metadata tipe kolom Postgres
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

    # SQLite Tables list
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%';")
    sqlite_tables = [row[0] for row in sqlite_cur.fetchall()]

    # Priority table order
    priority = ['users', 'roles', 'user_roles', 'permissions', 'role_permissions', 'products', 'customers', 'suppliers', 'machines', 'work_orders']
    ordered_tables = [t for t in priority if t in sqlite_tables] + [t for t in sqlite_tables if t not in priority]

    # Cobalah disable FK constraint jika user memiliki superuser privilege
    if not args.dry_run:
        try:
            pg_cur.execute("SET session_replication_role = 'replica';")
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()
            print("  ℹ️ Info: User PostgreSQL bukan Superuser, migrasi berlanjut dengan urutan tabel standar.")

    sqlite_counts = {}
    pg_counts = {}
    warnings_list = []
    total_sqlite_rows = 0

    for table in ordered_tables:
        if table not in pg_col_types:
            continue

        sqlite_cur.execute(f"SELECT COUNT(*) FROM \"{table}\";")
        sqlite_row_count = sqlite_cur.fetchone()[0]
        sqlite_counts[table] = sqlite_row_count
        total_sqlite_rows += sqlite_row_count

        if sqlite_row_count == 0:
            continue

        sqlite_cur.execute(f"SELECT * FROM \"{table}\";")
        rows = sqlite_cur.fetchall()
        valid_cols = [c for c in list(rows[0].keys()) if c in pg_col_types[table]]
        if not valid_cols:
            continue

        if args.dry_run:
            print(f"  🔍 Dry-run: Tabel '{table}' siap migrasi ({sqlite_row_count} baris)")
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

                # 1. Handling Boolean
                if 'bool' in target_type:
                    if val in (1, '1', True, 'true', 'TRUE'):
                        val = True
                    elif val in (0, '0', False, 'false', 'FALSE'):
                        val = False
                    else:
                        val = None
                # 2. Handling Timestamp / Date
                elif any(t in target_type for t in ['timestamp', 'date', 'time']):
                    val = parse_datetime(val)
                # 3. Handling Integer / Bigint
                elif any(t in target_type for t in ['integer', 'bigint', 'smallint']):
                    if val == '' or val is None:
                        val = None
                    else:
                        try:
                            val = int(val)
                        except Exception:
                            val = None
                # 4. Handling Bytes
                elif isinstance(val, bytes):
                    val = val.decode('utf-8', errors='ignore')

                row_vals.append(val)
            data_values.append(tuple(row_vals))

        insert_sql = f"INSERT INTO \"{table}\" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"

        # Batch Insert dengan Fallback Row-by-Row jika batch bermasalah
        try:
            pg_cur.executemany(insert_sql, data_values)
            pg_conn.commit()
            print(f"  ✓ Tabel '{table}': {len(data_values)} baris berhasil dipindahkan (Batch)")
        except Exception as batch_err:
            pg_conn.rollback()
            print(f"  ⚠️ Batch insert gagal pada '{table}': {batch_err}. Menggunakan fallback row-by-row...")
            success_rows = 0
            fail_rows = 0
            for r_idx, single_row in enumerate(data_values):
                try:
                    pg_cur.execute(insert_sql, single_row)
                    success_rows += 1
                    # Commit per 100 baris agar performa fallback tetap tinggi
                    if success_rows % 100 == 0:
                        pg_conn.commit()
                except Exception as single_err:
                    pg_conn.rollback()
                    fail_rows += 1
                    warn_msg = f"Tabel '{table}' baris #{r_idx + 1} ID={single_row[0] if single_row else '?'}: {single_err}"
                    warnings_list.append(warn_msg)
            pg_conn.commit()
            print(f"  ✓ Tabel '{table}': {success_rows} sukses, {fail_rows} gagal dikonversi")

    if not args.dry_run:
        try:
            pg_cur.execute("SET session_replication_role = 'origin';")
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()

        # Step 3: Reset Auto-increment Sequences
        print("\n🔄 [3/4] Mereset urutan ID auto-increment PostgreSQL...")
        for table in ordered_tables:
            if table in pg_col_types and 'id' in pg_col_types[table]:
                try:
                    pg_cur.execute(f"""
                        SELECT setval(pg_get_serial_sequence('"{table}"', 'id'), COALESCE(MAX(id), 1)) FROM "{table}";
                    """)
                    pg_conn.commit()
                except Exception:
                    pg_conn.rollback()

    # Step 4: Verification & Row-Count Comparison (Hanya pada Mode Eksekusi)
    if args.dry_run:
        print(f"\n==================================================")
        print(f"🔍 SIMULASI DRY-RUN SELESAI:")
        print(f"   • Total Tabel Ditemukan  : {len(sqlite_tables)} tabel")
        print(f"   • Total Baris Siap Migrasi: {total_sqlite_rows} baris")
        print(f"   • Tidak ada data diubah di PostgreSQL (Dry-Run)")
        print(f"==================================================\n")
    else:
        print("\n🔍 [4/4] Verifikasi Hasil Migrasi (Row Count Check)...")
        mismatches = 0
        matched = 0

        for table in ordered_tables:
            if table not in pg_col_types:
                continue
            try:
                pg_cur.execute(f"SELECT COUNT(*) FROM \"{table}\";")
                pg_cnt = pg_cur.fetchone()[0]
                pg_counts[table] = pg_cnt
                sq_cnt = sqlite_counts.get(table, 0)

                if sq_cnt == pg_cnt:
                    matched += 1
                else:
                    mismatches += 1
                    print(f"  ⚠️ Mismatch '{table}': SQLite={sq_cnt} baris ➔ Postgres={pg_cnt} baris (Selisih {pg_cnt - sq_cnt})")
            except Exception:
                pass

        print(f"\n==================================================")
        print(f"📊 VERIFIKASI MIGRATION SELESAI:")
        print(f"   • Tabel Cocok (Exact Match): {matched} tabel")
        if mismatches > 0:
            print(f"   • Tabel Mismatch (Selisih): {mismatches} tabel")
        if warnings_list:
            print(f"\n⚠️ RINGKASAN BARIS GAGAL ({len(warnings_list)} baris):")
            for w in warnings_list[:15]:
                print(f"   - {w}")
            if len(warnings_list) > 15:
                print(f"   - ... dan {len(warnings_list) - 15} baris lainnya.")
        print(f"==================================================\n")

    sqlite_conn.close()
    pg_conn.close()

if __name__ == '__main__':
    main()
