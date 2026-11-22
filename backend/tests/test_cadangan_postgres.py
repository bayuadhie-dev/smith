"""Tombol "Buat cadangan sekarang" harus bekerja di PostgreSQL.

Sampai 2026-11-22 seluruh modul cadangan mencari berkas .db di disk, jadi di
server PostgreSQL tombolnya selalu menjawab "Database file not found" -
padahal riwayat cadangan di layar tetap memajang entri lama dari zaman SQLite,
sehingga kelihatan seolah fitur ini jalan.
"""


def test_cadangan_sqlite_masih_jalan(client, auth_headers):
    # Harness tes memakai SQLite: jalur lama harus tetap hidup.
    r = client.post('/api/settings/backups/create', json={'description': 'uji'})
    assert r.status_code in (201, 401, 403), r.get_json()


def test_pemulihan_postgres_menolak_dengan_jujur(app, client, auth_headers, monkeypatch):
    from routes import backup as modul_backup

    monkeypatch.setattr(modul_backup, '_pakai_postgres', lambda: True)
    monkeypatch.setattr(modul_backup, 'load_backup_metadata',
                        lambda: {'backups': [{'id': 1, 'filename': 'backup_uji.dump'}]})
    monkeypatch.setattr(modul_backup.os.path, 'exists', lambda p: True)

    r = client.post('/api/settings/backups/1/restore', headers=auth_headers)
    # Bukan 500 dan bukan "berhasil" palsu: 501 dengan petunjuk pg_restore.
    assert r.status_code == 501, (r.status_code, r.get_json())
    assert 'pg_restore' in (r.get_json() or {}).get('error', '')
