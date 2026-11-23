"""Impor & ekspor master karyawan (Pusat Impor, jenis `employee`).

Yang dijaga di sini: template bisa diunduh dan judul kolomnya cocok dengan yang
dibaca pengimpor (kalau keduanya bergeser, orang mengunduh template lalu
diberi tahu "kolom wajib tidak ditemukan"), pratinjau tidak menulis apa pun,
dan hasil ekspor bisa diunggah kembali tanpa membuat ganda.
"""
import io

import openpyxl
import pytest

from models import db
from models.hr import Department, Employee, OutsourcingVendor


@pytest.fixture
def departemen(db_session):
    d = Department(code='PRD', name='Produksi', is_active=True)
    db_session.add(d)
    db_session.commit()
    return d


def _xlsx(baris, judul=None):
    """Susun berkas unggahan: judul kolom dari template + baris data."""
    from imports.employees import KOLOM
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Data'
    ws.append(judul or [label for _f, label, _r in KOLOM])
    for b in baris:
        ws.append(b)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _kirim(client, headers, baris, commit, judul=None):
    return client.post(
        '/api/imports/employee',
        headers=headers,
        data={'file': (_xlsx(baris, judul), 'karyawan.xlsx'), 'commit': '1' if commit else '0'},
        content_type='multipart/form-data',
    )


def _baris(nomor='FSN-001', nama='Budi', **ganti):
    from imports.employees import KOLOM
    isi = {'employee_number': nomor, 'first_name': nama, 'last_name': 'Santoso',
           'department': 'PRD', 'status': 'Aktif', 'pay_type': 'Bulanan', 'salary': 5000000}
    isi.update(ganti)
    return [isi.get(f, '') for f, _l, _r in KOLOM]


class TestTemplate:
    def test_template_terunduh_dengan_dua_sheet(self, client, auth_headers):
        r = client.get('/api/imports/employee/template', headers=auth_headers)
        assert r.status_code == 200
        wb = openpyxl.load_workbook(io.BytesIO(r.data))
        assert wb.sheetnames == ['Data', 'Petunjuk']

    def test_judul_template_dikenali_pengimpor(self, client, auth_headers, departemen):
        """Kalau template dan pembaca berkas bergeser, orang mengunduh template
        lalu ditolak dengan "kolom wajib tidak ditemukan". Jadi: unduh template,
        isi satu baris di bawah judulnya, unggah."""
        r = client.get('/api/imports/employee/template', headers=auth_headers)
        judul = [c.value for c in openpyxl.load_workbook(io.BytesIO(r.data))['Data'][1]]

        r2 = _kirim(client, auth_headers, [_baris()], commit=False, judul=judul)
        assert r2.status_code == 200, r2.get_json()
        assert r2.get_json()['summary']['error'] == 0

    def test_template_memuat_baris_contoh_yang_sah(self, client, auth_headers, departemen):
        """Baris contoh di template harus benar-benar bisa diimpor - kalau tidak,
        petunjuknya sendiri yang menyesatkan."""
        from imports.employees import EmployeeKind
        contoh = list(EmployeeKind.sample_rows[0])
        r = _kirim(client, auth_headers, [contoh], commit=False)
        assert r.status_code == 200
        tx = r.get_json()['transactions'][0]
        assert tx['errors'] == [], tx['errors']


class TestPratinjau:
    def test_pratinjau_tidak_menulis_apa_pun(self, client, auth_headers, app, departemen):
        r = _kirim(client, auth_headers, [_baris()], commit=False)
        assert r.status_code == 200
        assert r.get_json()['summary']['ok'] == 1
        assert r.get_json()['committed'] is False
        with app.app_context():
            assert Employee.query.count() == 0

    def test_pratinjau_melaporkan_baris_bermasalah_tanpa_menggugurkan_sisanya(self, client, auth_headers, departemen):
        baris = [_baris('FSN-001'), _baris('FSN-002', gender='Alien'), _baris('FSN-003')]
        r = _kirim(client, auth_headers, baris, commit=False)
        hasil = r.get_json()
        assert hasil['summary']['ok'] == 2
        assert hasil['summary']['error'] == 1
        salah = [t for t in hasil['transactions'] if t['errors']][0]
        assert 'Jenis Kelamin' in salah['errors'][0]
        assert salah['rows'] == [3]


class TestSimpan:
    def test_karyawan_tersimpan_dengan_isian_yang_dipetakan(self, client, auth_headers, app, departemen):
        r = _kirim(client, auth_headers, [_baris(
            nik='3216010101900001', fingerprint_id='101', email='budi@contoh.com',
            date_of_birth='1990-01-01', gender='Laki-laki', marital_status='Menikah',
            position='Operator Mesin', employment_type='Karyawan Tetap', hire_date='2024-03-01',
            ptkp_status='K/1', dependents=1, position_allowance_amount=500000,
            transport_allowance_amount=300000,
        )], commit=True)
        assert r.status_code == 200
        assert r.get_json()['summary']['ok'] == 1

        with app.app_context():
            e = Employee.query.filter_by(employee_number='FSN-001').one()
            assert e.full_name == 'Budi Santoso'
            assert e.department.code == 'PRD'
            assert e.gender == 'male' and e.marital_status == 'married'
            assert e.employment_type == 'full_time' and e.pay_type == 'monthly'
            assert e.status == 'active' and e.is_active is True
            assert float(e.salary) == 5000000
            assert e.ptkp_status == 'K/1' and e.dependents == 1
            assert e.has_allowance is True          # diturunkan dari tunjangan jabatan > 0
            assert float(e.transport_allowance_amount) == 300000
            assert str(e.date_of_birth) == '1990-01-01' and str(e.hire_date) == '2024-03-01'

    def test_nomor_yang_sudah_ada_dilewati_bukan_ditimpa(self, client, auth_headers, app, departemen):
        """Gaji dan tunjangan terlalu mahal untuk ditimpa diam-diam oleh Excel."""
        _kirim(client, auth_headers, [_baris(salary=5000000)], commit=True)
        r = _kirim(client, auth_headers, [_baris(nama='Orang Lain', salary=99000000)], commit=True)

        tx = r.get_json()['transactions'][0]
        assert 'sudah ada' in tx['errors'][0]
        with app.app_context():
            e = Employee.query.filter_by(employee_number='FSN-001').one()
            assert float(e.salary) == 5000000
            assert e.first_name == 'Budi'

    def test_baris_bermasalah_tidak_menggugurkan_baris_yang_benar(self, client, auth_headers, app, departemen):
        baris = [_baris('FSN-001'), _baris('FSN-002', department='Tidak Ada'), _baris('FSN-003')]
        r = _kirim(client, auth_headers, baris, commit=True)
        assert r.get_json()['summary'] == {'total': 3, 'ok': 2, 'error': 1, 'amount': 0}
        with app.app_context():
            assert {e.employee_number for e in Employee.query.all()} == {'FSN-001', 'FSN-003'}

    def test_status_non_aktif_ikut_mematikan_is_active(self, client, auth_headers, app, departemen):
        """Daftar karyawan menyaring is_active, bukan status - kalau tidak ikut
        dimatikan, karyawan keluar tetap muncul di daftar."""
        _kirim(client, auth_headers, [_baris(status='Non-aktif')], commit=True)
        with app.app_context():
            assert Employee.query.filter_by(employee_number='FSN-001').one().is_active is False


class TestValidasi:
    def test_nomor_atau_nama_kosong_ditolak(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(nomor='', nama='')], commit=True)
        assert 'wajib diisi' in r.get_json()['transactions'][0]['errors'][0]

    def test_nomor_ganda_di_dalam_berkas_ditolak(self, client, auth_headers, app, departemen):
        r = _kirim(client, auth_headers, [_baris('FSN-001'), _baris('FSN-001', nama='Agus')], commit=True)
        assert 'ganda' in r.get_json()['transactions'][1]['errors'][0]
        with app.app_context():
            assert Employee.query.count() == 1

    def test_id_mesin_absensi_tidak_boleh_dipakai_dua_orang(self, client, auth_headers, app, departemen):
        r = _kirim(client, auth_headers, [_baris('FSN-001', fingerprint_id='7'),
                                          _baris('FSN-002', nama='Agus', fingerprint_id='7')], commit=True)
        assert 'ID Mesin Absensi' in r.get_json()['transactions'][1]['errors'][0]
        with app.app_context():
            assert Employee.query.count() == 1

    def test_departemen_tak_dikenal_ditolak_dengan_jalan_keluar(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(department='Gudang Bawah Tanah')], commit=True)
        pesan = r.get_json()['transactions'][0]['errors'][0]
        assert 'Gudang Bawah Tanah' in pesan and 'menu Departemen' in pesan

    def test_outsourcing_wajib_sebut_vendornya(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(pay_type='Outsourcing')], commit=True)
        assert 'Vendor Outsourcing' in r.get_json()['transactions'][0]['errors'][0]

    def test_vendor_outsourcing_yang_terdaftar_diterima(self, client, auth_headers, app, db_session, departemen):
        db_session.add(OutsourcingVendor(code='V01', name='PT Tenaga Kerja', is_active=True))
        db_session.commit()
        r = _kirim(client, auth_headers, [_baris(pay_type='Outsourcing', outsourcing_vendor='PT Tenaga Kerja')], commit=True)
        assert r.get_json()['summary']['ok'] == 1
        with app.app_context():
            assert Employee.query.one().outsourcing_vendor.code == 'V01'

    def test_ptkp_dan_tanggungan_di_luar_batas_ditolak(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(ptkp_status='X/9')], commit=True)
        assert 'Status PTKP' in r.get_json()['transactions'][0]['errors'][0]
        r2 = _kirim(client, auth_headers, [_baris(dependents=7)], commit=True)
        assert 'Tanggungan' in r2.get_json()['transactions'][0]['errors'][0]

    def test_gaji_negatif_ditolak(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(salary=-100)], commit=True)
        assert 'Gaji Pokok' in r.get_json()['transactions'][0]['errors'][0]

    def test_lahir_setelah_masuk_kerja_ditolak(self, client, auth_headers, departemen):
        r = _kirim(client, auth_headers, [_baris(date_of_birth='2025-01-01', hire_date='2024-03-01')], commit=True)
        assert 'Tanggal Lahir' in r.get_json()['transactions'][0]['errors'][0]

    def test_kolom_wajib_hilang_menyebut_tombol_template(self, client, auth_headers):
        r = _kirim(client, auth_headers, [['x']], commit=False, judul=['Kolom Ngawur'])
        assert r.status_code == 400
        assert 'Unduh Template' in r.get_json()['error']


class TestEkspor:
    def test_ekspor_bisa_diunggah_kembali_tanpa_menggandakan(self, client, auth_headers, app, departemen):
        """Inti janji "ekspor lalu impor lagi": urutan kolom ekspor harus sama
        dengan template, dan baris yang sudah ada harus dilewati - bukan ganda."""
        _kirim(client, auth_headers, [_baris('FSN-001'), _baris('FSN-002', nama='Agus')], commit=True)

        r = client.get('/api/imports/employee/export', headers=auth_headers)
        assert r.status_code == 200
        ws = openpyxl.load_workbook(io.BytesIO(r.data))['Data']
        from imports.employees import KOLOM
        assert [c.value for c in ws[1]] == [label for _f, label, _r in KOLOM]
        isi = [list(row) for row in ws.iter_rows(min_row=2, values_only=True)]
        assert len(isi) == 2
        assert isi[0][0] == 'FSN-001' and isi[0][3] == 'Budi'

        ulang = client.post('/api/imports/employee', headers=auth_headers,
                            data={'file': (io.BytesIO(r.data), 'ekspor.xlsx'), 'commit': '1'},
                            content_type='multipart/form-data')
        assert ulang.get_json()['summary']['ok'] == 0
        assert ulang.get_json()['summary']['error'] == 2
        with app.app_context():
            assert Employee.query.count() == 2

    def test_karyawan_non_aktif_ikut_terekspor(self, client, auth_headers, departemen):
        _kirim(client, auth_headers, [_baris('FSN-001', status='Non-aktif')], commit=True)
        r = client.get('/api/imports/employee/export', headers=auth_headers)
        ws = openpyxl.load_workbook(io.BytesIO(r.data))['Data']
        isi = [list(row) for row in ws.iter_rows(min_row=2, values_only=True)]
        assert len(isi) == 1 and isi[0][18] == 'Non-aktif'


class TestDaftarJenis:
    def test_karyawan_muncul_sebagai_jenis_master_yang_bisa_impor_dan_ekspor(self, client, auth_headers):
        r = client.get('/api/imports/kinds', headers=auth_headers)
        k = next(x for x in r.get_json()['kinds'] if x['key'] == 'employee')
        assert k['group'] == 'Master'
        assert k['can_import'] is True and k['can_export'] is True
        assert k['export_by_date'] is False
        wajib = [c['label'] for c in k['columns'] if c['required']]
        assert wajib == ['Nomor Karyawan', 'Nama Depan']


class TestLengkapiYangKosong:
    """Karyawan yang sudah ada tapi datanya bolong: berkas boleh MENGISI lubangnya,
    tidak boleh menggeser yang sudah terisi."""

    def test_isian_kosong_terisi_dari_berkas(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris(department='', position='')], commit=True)
        with app.app_context():
            e = Employee.query.one()
            assert e.department_id is None and e.position is None and e.npwp is None

        r = _kirim(client, auth_headers, [_baris(department='PRD', position='Operator', npwp='09.254.294.3-407.000')], commit=True)
        assert r.get_json()['summary']['ok'] == 1
        assert 'Lengkapi' in r.get_json()['transactions'][0]['summary']['action']

        with app.app_context():
            e = Employee.query.one()
            assert e.department.code == 'PRD'
            assert e.position == 'Operator'
            assert e.npwp == '09.254.294.3-407.000'

    def test_isian_yang_sudah_terisi_tidak_tergeser(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris(position='Operator', salary=5000000)], commit=True)
        _kirim(client, auth_headers, [_baris(position='Direktur', salary=99000000, npwp='09.254.294.3-407.000')], commit=True)

        with app.app_context():
            e = Employee.query.one()
            assert e.position == 'Operator'            # tidak tergeser
            assert float(e.salary) == 5000000          # tidak tergeser
            assert e.npwp == '09.254.294.3-407.000'    # yang kosong terisi

    def test_nilai_bawaan_dihitung_sudah_terisi(self, client, auth_headers, app, departemen):
        """Status PTKP, Kategori Penggajian, Status dan Jumlah Tanggungan punya nilai
        bawaan. Menggesernya itu menimpa, bukan melengkapi - harus lewat form."""
        _kirim(client, auth_headers, [_baris(ptkp_status='TK/0', dependents=0)], commit=True)
        r = _kirim(client, auth_headers, [_baris(ptkp_status='K/3', dependents=3, pay_type='Harian', status='Non-aktif')], commit=True)

        assert 'tidak ada isian kosong' in r.get_json()['transactions'][0]['errors'][0]
        with app.app_context():
            e = Employee.query.one()
            assert e.ptkp_status == 'TK/0' and e.dependents == 0
            assert e.pay_type == 'monthly' and e.status == 'active'

    def test_tunjangan_yang_dikosongkan_tidak_dianggap_isian(self, client, auth_headers, app, departemen):
        """Sel tunjangan yang dibiarkan kosong diolah jadi 0. Nol itu bukan isian -
        kalau dianggap isian, tiap unggahan melaporkan "Lengkapi: Tunjangan ..." palsu."""
        _kirim(client, auth_headers, [_baris(position='Operator')], commit=True)
        r = _kirim(client, auth_headers, [_baris(position='Operator')], commit=True)
        assert 'tidak ada isian kosong' in r.get_json()['transactions'][0]['errors'][0]

    def test_pratinjau_menyebut_isian_mana_yang_akan_diisi(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris(department='', email='')], commit=True)
        r = _kirim(client, auth_headers, [_baris(department='PRD', email='budi@contoh.com')], commit=False)

        tindakan = r.get_json()['transactions'][0]['summary']['action']
        assert tindakan == 'Lengkapi: Email, Departemen'
        with app.app_context():                        # pratinjau tidak menulis
            assert Employee.query.one().department_id is None

    def test_id_mesin_absensi_milik_sendiri_bukan_bentrok(self, client, auth_headers, app, departemen):
        """Mengunggah ulang berkas ekspor: ID mesin di baris itu memang miliknya sendiri."""
        _kirim(client, auth_headers, [_baris(fingerprint_id='55', position='')], commit=True)
        r = _kirim(client, auth_headers, [_baris(fingerprint_id='55', position='Operator')], commit=True)
        assert r.get_json()['summary']['ok'] == 1
        with app.app_context():
            assert Employee.query.one().position == 'Operator'

    def test_id_mesin_milik_orang_lain_tetap_ditolak(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris('FSN-001', fingerprint_id='55'),
                                      _baris('FSN-002', nama='Agus', position='')], commit=True)
        r = _kirim(client, auth_headers, [_baris('FSN-002', nama='Agus', fingerprint_id='55', position='Operator')], commit=True)
        pesan = r.get_json()['transactions'][0]['errors'][0]
        assert 'sudah dipakai karyawan FSN-001' in pesan

    def test_nama_lengkap_ikut_terbentuk_ulang_saat_nama_belakang_terisi(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris(last_name='')], commit=True)
        with app.app_context():
            assert Employee.query.one().full_name == 'Budi'
        _kirim(client, auth_headers, [_baris(last_name='Santoso')], commit=True)
        with app.app_context():
            e = Employee.query.one()
            assert e.last_name == 'Santoso' and e.full_name == 'Budi Santoso'

    def test_satu_berkas_bisa_menambah_dan_melengkapi_sekaligus(self, client, auth_headers, app, departemen):
        _kirim(client, auth_headers, [_baris('FSN-001', department='')], commit=True)
        r = _kirim(client, auth_headers, [_baris('FSN-001', department='PRD'),
                                          _baris('FSN-002', nama='Agus')], commit=True)

        hasil = r.get_json()
        assert hasil['summary']['ok'] == 2
        tindakan = sorted(t['summary']['action'] for t in hasil['transactions'])
        assert tindakan == ['Karyawan baru', 'Lengkapi: Departemen']
        with app.app_context():
            assert Employee.query.count() == 2
            assert Employee.query.filter_by(employee_number='FSN-001').one().department.code == 'PRD'
