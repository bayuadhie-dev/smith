"""Halaman Editor Konfigurasi Terpusat harus memanggil alamat API yang benar.

Dilaporkan 2026-11-25: halamannya terbuka lalu langsung "Gagal memuat data: The
requested URL was not found on the server". Penyebabnya alamat API diketik
'/configedit/api/configs' di templatenya, padahal blueprint-nya terdaftar di
'/api/config' - dan karena halamannya dikirim lewat send_file (bukan
render_template), `url_for` pun tidak pernah jalan.
"""
import re


def test_alamat_api_di_halaman_cocok_dengan_rute_sebenarnya(client, app):
    r = client.get('/api/config/')
    assert r.status_code == 200
    html = r.get_data(as_text=True)

    m = re.search(r'const ALAMAT_KONFIG = "([^"]*)"', html)
    assert m, 'halaman tidak menanam alamat API-nya'
    alamat = m.group(1)

    # bukan sekadar "ada isinya" - alamatnya harus benar-benar rute yang terdaftar
    assert '{{' not in alamat, f'Jinja tidak jalan, alamat terkirim mentah: {alamat}'
    terdaftar = {str(rule) for rule in app.url_map.iter_rules()}
    assert alamat in terdaftar, f'{alamat} bukan rute yang terdaftar'


def test_tidak_ada_lagi_alamat_configedit_yang_dipanggil(client):
    html = client.get('/api/config/').get_data(as_text=True)
    assert "fetch('/configedit" not in html
    assert 'fetch("/configedit' not in html
