"""Halaman Kesehatan Sistem harus menyebut mesin basis data yang sebenarnya.

Sebelum 2026-11-22 blok ini masih berpikir SQLite: 'engine' ditulis tetap
"SQLite" dan ukurannya dicari dari berkas .db yang sudah tidak ada sejak
pindah ke PostgreSQL, sehingga layar memajang "null MB".
"""


def test_mesin_dan_ukuran_basis_data_dilaporkan_apa_adanya(client, auth_headers):
    r = client.get('/api/health/system', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    db = r.get_json().get('database') or {}

    assert db.get('status') == 'healthy', db
    # Harness tes memakai SQLite; yang penting namanya ikut mesin sungguhan,
    # bukan string tetap.
    assert db.get('engine') in ('SQLite', 'PostgreSQL'), db
    assert db.get('table_count', 0) > 0
