"""
Migration: Tambah kolom thread ke chat_messages + buat tabel baru
(chat_threads, chat_direct_conversations, chat_direct_messages)

Jalankan: python migrate_chat_thread_dm.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db

def run_migration():
    app = create_app()
    with app.app_context():
        conn = db.engine.raw_connection()
        cursor = conn.cursor()

        print("=" * 55)
        print("  Chat Migration: Thread + DM Tables")
        print("=" * 55)

        # ── 1. Tambah kolom ke chat_messages ─────────────────────
        print("\n📋 Alter tabel chat_messages...")

        existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(chat_messages)").fetchall()}

        if 'thread_id' not in existing_cols:
            cursor.execute("ALTER TABLE chat_messages ADD COLUMN thread_id INTEGER REFERENCES chat_threads(id)")
            print("  ✓ Kolom thread_id ditambahkan")
        else:
            print("  · thread_id sudah ada")

        if 'is_thread_starter' not in existing_cols:
            cursor.execute("ALTER TABLE chat_messages ADD COLUMN is_thread_starter BOOLEAN DEFAULT 0")
            print("  ✓ Kolom is_thread_starter ditambahkan")
        else:
            print("  · is_thread_starter sudah ada")

        conn.commit()

        # ── 2. Buat tabel baru via SQLAlchemy ─────────────────────
        print("\n🏗️  Membuat tabel baru...")
        db.create_all()
        print("  ✓ Semua tabel baru dibuat (chat_threads, chat_direct_conversations, chat_direct_messages)")

        # ── 3. Verifikasi ─────────────────────────────────────────
        print("\n✅ Verifikasi...")
        tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
        for t in ['chat_threads', 'chat_direct_conversations', 'chat_direct_messages', 'chat_messages']:
            status = "✓" if t in tables else "✗"
            print(f"  {status} {t}")

        # Cek kolom chat_messages
        cols = {row[1] for row in cursor.execute("PRAGMA table_info(chat_messages)").fetchall()}
        for c in ['thread_id', 'is_thread_starter']:
            status = "✓" if c in cols else "✗"
            print(f"  {status} chat_messages.{c}")

        conn.close()
        print("\n🎉 Migration selesai! Restart backend sekarang.\n")

if __name__ == '__main__':
    run_migration()
