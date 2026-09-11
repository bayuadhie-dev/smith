"""
Setup Staging Database Script (Option 2 Isolation Sandbox)
Kloning database PostgreSQL 'smith' ke 'smith_staging' untuk pengujian integrasi Accurate & MRP tanpa menyentuh database produksi.
"""
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_HOST = os.getenv('POSTGRES_HOST', 'localhost')
DB_PORT = os.getenv('POSTGRES_PORT', '5432')
DB_USER = os.getenv('POSTGRES_USER', 'postgres')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')
SRC_DB = 'smith'
TARGET_DB = 'smith_staging'


def setup_staging_db():
    print(f"🔄 Mempersiapkan Database Staging '{TARGET_DB}' dari '{SRC_DB}'...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname='postgres'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Putus semua koneksi aktif ke smith_staging jika ada
        cursor.execute(f"""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '{TARGET_DB}'
              AND pid <> pg_backend_pid();
        """)

        # Drop jika smith_staging sudah ada sebelumnya
        cursor.execute(f"DROP DATABASE IF EXISTS {TARGET_DB};")
        print(f"  ✓ Database lama '{TARGET_DB}' dibersihkan.")

        # Kloning DB smith ke smith_staging
        cursor.execute(f"CREATE DATABASE {TARGET_DB} TEMPLATE {SRC_DB};")
        print(f"  ✅ Database Staging '{TARGET_DB}' berhasil dikloning dari '{SRC_DB}'!")

        cursor.close()
        conn.close()

        print("\n📌 PETUNJUK PENGGUNAAN OPSI 2 (STAGING ISOLATION):")
        print(f"1. Database staging '{TARGET_DB}' siap digunakan.")
        print(f"2. Untuk menjalankan backend di mode staging, set environment variable:")
        print(f"   export DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{TARGET_DB}")
        print("3. Jalankan backend: python app.py")

    except Exception as e:
        print(f"❌ Gagal membuat database staging: {e}")
        sys.exit(1)


if __name__ == '__main__':
    setup_staging_db()
