"""Impor & ekspor MASTER KARYAWAN.

Satu baris = satu karyawan. Idempoten seperti jenis master lain: nomor karyawan
yang sudah ada dilewati (galat ringan di baris itu), tidak pernah menimpa data
yang sudah tersimpan - gaji dan tunjangan terlalu mahal untuk ditimpa diam-diam
oleh sebuah berkas Excel.

Judul kolomnya bahasa Indonesia (bukan judul ekspor Accurate seperti jenis master
lain), karena karyawan tidak pernah ada di Accurate - masternya memang lahir di
sini. Urutan kolom ekspor sama dengan template impor, jadi berkas hasil ekspor
bisa diedit lalu diunggah kembali untuk menambah baris baru.
"""
from flask import request

from models import db
from models.hr import Department, Employee
from utils.import_center import Col, ImportKind, parse_amount, parse_date, register, text

# Nilai yang disimpan di basis data -> label yang ditulis orang di Excel.
# Keduanya diterima saat impor (lihat _pilih), yang kiri yang ditulis saat ekspor.
JENIS_KELAMIN = {'male': 'Laki-laki', 'female': 'Perempuan'}
STATUS_KAWIN = {'single': 'Belum Menikah', 'married': 'Menikah', 'divorced': 'Cerai', 'widowed': 'Duda/Janda'}
JENIS_KONTRAK = {'full_time': 'Karyawan Tetap', 'contract': 'Kontrak', 'part_time': 'Part Time',
                 'intern': 'Magang', 'outsource': 'Outsource', 'daily': 'Harian Lepas'}
KATEGORI_UPAH = {'monthly': 'Bulanan', 'fixed': 'Fixed', 'weekly': 'Mingguan', 'daily': 'Harian',
                 'piecework': 'Borongan', 'outsourcing': 'Outsourcing'}
STATUS_KERJA = {'active': 'Aktif', 'on_leave': 'Cuti', 'terminated': 'Non-aktif'}
PTKP = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3']


def _pilih(nilai, kamus, nama_kolom, bawaan=None):
    """Terima nilai basis data ('male') maupun label Indonesia ('Laki-laki')."""
    s = text(nilai)
    if not s:
        return bawaan
    k = s.strip().lower()
    if k in kamus:
        return k
    for kode, label in kamus.items():
        if k == label.lower():
            return kode
    pilihan = ', '.join(kamus.values())
    raise ValueError(f'{nama_kolom} "{s}" tidak dikenal (pilih: {pilihan})')


def _uang(nilai, nama_kolom):
    if nilai in (None, ''):
        return None
    try:
        return parse_amount(nilai, allow_negative=False)
    except ValueError as e:
        raise ValueError(f'{nama_kolom}: {e}')


def _tanggal(nilai, nama_kolom):
    if nilai in (None, ''):
        return None
    try:
        return parse_date(nilai)
    except ValueError as e:
        raise ValueError(f'{nama_kolom}: {e}')


def _cache(nama, bangun):
    """Satu kali per permintaan - impor 500 baris jangan 500 kali query master."""
    store = request.environ.setdefault('employee_import_cache', {})
    if nama not in store:
        store[nama] = bangun()
    return store[nama]


def _departemen():
    """{kode/nama huruf kecil: id} - orang boleh menulis kode ("PRD") atau nama."""
    def bangun():
        out = {}
        for d in Department.query.all():
            if d.code:
                out[d.code.strip().lower()] = d.id
            if d.name:
                out.setdefault(d.name.strip().lower(), d.id)
        return out
    return _cache('departemen', bangun)


def _vendor():
    """{kode/nama huruf kecil: id}"""
    def bangun():
        from models.hr import OutsourcingVendor
        out = {}
        for v in OutsourcingVendor.query.all():
            if v.code:
                out[v.code.strip().lower()] = v.id
            if v.name:
                out.setdefault(v.name.strip().lower(), v.id)
        return out
    return _cache('vendor', bangun)


def _nomor_terpakai():
    return _cache('nomor', lambda: {n.strip().lower() for (n,) in Employee.query.with_entities(Employee.employee_number).all() if n})


def _fingerprint_terpakai():
    return _cache('fp', lambda: {str(f).strip() for (f,) in Employee.query.with_entities(Employee.fingerprint_id).all() if f})


def _sudah_di_berkas(bucket):
    store = request.environ.setdefault('employee_import_seen', {})
    return store.setdefault(bucket, set())


KOLOM = [
    ('employee_number', 'Nomor Karyawan', True),
    ('nik', 'NIK', False),
    ('fingerprint_id', 'ID Mesin Absensi', False),
    ('first_name', 'Nama Depan', True),
    ('last_name', 'Nama Belakang', False),
    ('email', 'Email', False),
    ('phone', 'Telepon', False),
    ('mobile', 'Handphone', False),
    ('date_of_birth', 'Tanggal Lahir', False),
    ('gender', 'Jenis Kelamin', False),
    ('marital_status', 'Status Pernikahan', False),
    ('address', 'Alamat', False),
    ('city', 'Kota', False),
    ('postal_code', 'Kode Pos', False),
    ('department', 'Departemen', False),
    ('position', 'Jabatan', False),
    ('employment_type', 'Jenis Kontrak', False),
    ('hire_date', 'Tanggal Masuk', False),
    ('status', 'Status', False),
    ('pay_type', 'Kategori Penggajian', False),
    ('pay_rate', 'Tarif Upah', False),
    ('salary', 'Gaji Pokok', False),
    ('outsourcing_vendor', 'Vendor Outsourcing', False),
    ('npwp', 'NPWP', False),
    ('ptkp_status', 'Status PTKP', False),
    ('dependents', 'Jumlah Tanggungan', False),
    ('position_allowance_amount', 'Tunjangan Jabatan', False),
    ('transport_allowance_amount', 'Tunjangan Transport', False),
    ('emergency_contact_name', 'Kontak Darurat (Nama)', False),
    ('emergency_contact_phone', 'Kontak Darurat (Telepon)', False),
]


class EmployeeKind(ImportKind):
    key, label, group = 'employee', 'Karyawan', 'Master'
    description = 'Master karyawan. Nomor karyawan yang sudah ada dilewati, data tersimpan tidak pernah ditimpa.'
    view_permission = 'employees.view'
    create_permission = 'employees.create'
    summary_columns = [('number', 'Nomor', 'text'), ('name', 'Nama', 'text'), ('department', 'Departemen', 'text')]
    columns = [Col(field, label, required=req) for field, label, req in KOLOM]
    sample_rows = [[
        'FSN-001', '3216010101900001', '101', 'Budi', 'Santoso', 'budi@contoh.com', '', '081200000000',
        '1990-01-01', 'Laki-laki', 'Menikah', 'Jl. Contoh No. 1', 'Bekasi', '17111',
        'PRD', 'Operator Mesin', 'Karyawan Tetap', '2024-03-01', 'Aktif',
        'Bulanan', '', 5000000, '', '', 'K/1', 1, 500000, 300000, 'Siti Santoso', '081300000000',
    ]]
    guide = [
        'Nomor Karyawan wajib dan harus unik. Nomor yang sudah ada di sistem dilewati - '
        'impor ini hanya MENAMBAH karyawan baru, tidak pernah mengubah yang sudah tersimpan.',
        'Nama lengkap dibentuk dari Nama Depan + Nama Belakang, sama seperti form Tambah Karyawan.',
        'Departemen boleh ditulis kodenya ("PRD") atau nama lengkapnya ("Produksi"). Harus sudah ada di menu Departemen.',
        'Jenis Kelamin: ' + ', '.join(JENIS_KELAMIN.values()) + '.',
        'Status Pernikahan: ' + ', '.join(STATUS_KAWIN.values()) + '.',
        'Jenis Kontrak: ' + ', '.join(JENIS_KONTRAK.values()) + '.',
        'Kategori Penggajian: ' + ', '.join(KATEGORI_UPAH.values()) + '. Tarif Upah dipakai untuk '
        'Harian/Mingguan/Borongan (tarif per hari / per minggu / per satuan); Gaji Pokok untuk Bulanan.',
        'Status: ' + ', '.join(STATUS_KERJA.values()) + '. Karyawan ber-status Non-aktif tidak muncul di daftar karyawan.',
        'Status PTKP: ' + ', '.join(PTKP) + '. Jumlah Tanggungan 0 sampai 3.',
        'ID Mesin Absensi harus sama dengan ID pengguna di mesin fingerprint, dan tidak boleh dipakai dua karyawan.',
        'Vendor Outsourcing hanya diisi kalau Kategori Penggajian = Outsourcing, dan vendornya harus sudah terdaftar.',
    ]
    max_rows = 2000

    def build(self, key, rows):
        n, rec = rows[0]

        nomor = text(rec.get('employee_number'), 50)
        depan = text(rec.get('first_name'), 100)
        if not nomor or not depan:
            raise ValueError('Nomor Karyawan dan Nama Depan wajib diisi')
        if nomor.lower() in _sudah_di_berkas('nomor'):
            raise ValueError(f'Nomor Karyawan {nomor} ganda di dalam berkas')
        _sudah_di_berkas('nomor').add(nomor.lower())
        if nomor.lower() in _nomor_terpakai():
            raise ValueError(f'Karyawan {nomor} sudah ada, dilewati')

        fp = text(rec.get('fingerprint_id'), 50)
        if fp:
            if fp in _sudah_di_berkas('fp'):
                raise ValueError(f'ID Mesin Absensi {fp} ganda di dalam berkas')
            _sudah_di_berkas('fp').add(fp)
            if fp in _fingerprint_terpakai():
                raise ValueError(f'ID Mesin Absensi {fp} sudah dipakai karyawan lain')

        dep_id, dep_nama = None, None
        dep_tulis = text(rec.get('department'))
        if dep_tulis:
            dep_id = _departemen().get(dep_tulis.strip().lower())
            if not dep_id:
                raise ValueError(f'Departemen "{dep_tulis}" tidak ada. Buat dulu di menu Departemen, atau tulis kodenya')
            dep_nama = dep_tulis

        pay_type = _pilih(rec.get('pay_type'), KATEGORI_UPAH, 'Kategori Penggajian', 'monthly')
        vendor_id = None
        vendor_tulis = text(rec.get('outsourcing_vendor'))
        if vendor_tulis:
            vendor_id = _vendor().get(vendor_tulis.strip().lower())
            if not vendor_id:
                raise ValueError(f'Vendor Outsourcing "{vendor_tulis}" tidak terdaftar')
        elif pay_type == 'outsourcing':
            raise ValueError('Kategori Penggajian Outsourcing wajib mengisi Vendor Outsourcing')

        ptkp = text(rec.get('ptkp_status'))
        if ptkp:
            ptkp = ptkp.strip().upper()
            if ptkp not in PTKP:
                raise ValueError(f'Status PTKP "{ptkp}" tidak dikenal (pilih: {", ".join(PTKP)})')
        else:
            ptkp = 'TK/0'

        tanggungan = rec.get('dependents')
        if tanggungan in (None, ''):
            tanggungan = 0
        else:
            try:
                tanggungan = int(float(str(tanggungan).strip()))
            except ValueError:
                raise ValueError(f'Jumlah Tanggungan "{tanggungan}" bukan angka')
            if not 0 <= tanggungan <= 3:
                raise ValueError('Jumlah Tanggungan harus 0 sampai 3')

        belakang = text(rec.get('last_name'), 100) or ''
        status = _pilih(rec.get('status'), STATUS_KERJA, 'Status', 'active')
        tunj_jabatan = _uang(rec.get('position_allowance_amount'), 'Tunjangan Jabatan') or 0
        lahir = _tanggal(rec.get('date_of_birth'), 'Tanggal Lahir')
        masuk = _tanggal(rec.get('hire_date'), 'Tanggal Masuk')
        if lahir and masuk and lahir >= masuk:
            raise ValueError('Tanggal Lahir harus sebelum Tanggal Masuk')

        data = {
            'employee_number': nomor,
            'nik': text(rec.get('nik'), 50),
            'fingerprint_id': fp,
            'first_name': depan,
            'last_name': belakang,
            'full_name': f'{depan} {belakang}'.strip()[:200],
            'email': text(rec.get('email'), 120),
            'phone': text(rec.get('phone'), 50),
            'mobile': text(rec.get('mobile'), 50),
            'date_of_birth': lahir,
            'gender': _pilih(rec.get('gender'), JENIS_KELAMIN, 'Jenis Kelamin'),
            'marital_status': _pilih(rec.get('marital_status'), STATUS_KAWIN, 'Status Pernikahan'),
            'address': text(rec.get('address')),
            'city': text(rec.get('city'), 100),
            'postal_code': text(rec.get('postal_code'), 20),
            'department_id': dep_id,
            'position': text(rec.get('position'), 200),
            'employment_type': _pilih(rec.get('employment_type'), JENIS_KONTRAK, 'Jenis Kontrak'),
            'hire_date': masuk,
            'status': status,
            'is_active': status != 'terminated',
            'pay_type': pay_type,
            'pay_rate': _uang(rec.get('pay_rate'), 'Tarif Upah'),
            'salary': _uang(rec.get('salary'), 'Gaji Pokok'),
            'outsourcing_vendor_id': vendor_id,
            'npwp': text(rec.get('npwp'), 30),
            'ptkp_status': ptkp,
            'dependents': tanggungan,
            'has_allowance': tunj_jabatan > 0,
            'position_allowance_amount': tunj_jabatan,
            'transport_allowance_amount': _uang(rec.get('transport_allowance_amount'), 'Tunjangan Transport') or 0,
            'emergency_contact_name': text(rec.get('emergency_contact_name'), 200),
            'emergency_contact_phone': text(rec.get('emergency_contact_phone'), 50),
        }
        return data, {'number': nomor, 'name': data['full_name'], 'department': dep_nama or '-'}

    def save(self, data, user_id):
        db.session.add(Employee(**data))
        db.session.flush()
        # Daftar karyawan di-cache Redis 5 menit; tanpa ini karyawan baru tidak
        # kelihatan sampai cache kedaluwarsa dan orang menyangka impornya gagal.
        _bersihkan_cache_karyawan()
        return {'number': data['employee_number']}


def _bersihkan_cache_karyawan():
    import os

    import redis
    try:
        r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
        keys = r.keys('hr_employees_*')
        if keys:
            r.delete(*keys)
    except Exception as e:                                  # Redis mati bukan alasan impor gagal
        print(f'[imports.employees] gagal bersihkan cache karyawan: {e}')


register(EmployeeKind())
