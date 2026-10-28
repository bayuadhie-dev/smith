"""Helper dan pembangun per-baris untuk impor master dari ekspor Accurate Online.
Dipakai bersama oleh scripts/import_fengsheng_master.py dan imports/master.py (Pusat Impor).
Setiap build_* menerima `get(judul_kolom)` -> nilai mentah sel, dan tidak menulis ke database."""
import json
import re
from datetime import date, datetime

TYPE_MAP = {   # kode "Tipe Akun" ekspor Accurate -> (account_type, normal_balance)
    'BANK': ('asset', 'debit'), 'AREC': ('asset', 'debit'), 'OCAS': ('asset', 'debit'), 'INTR': ('asset', 'debit'),
    'FASS': ('asset', 'debit'), 'OASS': ('asset', 'debit'), 'DEPR': ('asset', 'credit'),
    'APAY': ('liability', 'credit'), 'OCLY': ('liability', 'credit'), 'LTLY': ('liability', 'credit'),
    'EQTY': ('equity', 'credit'), 'REVE': ('revenue', 'credit'), 'OINC': ('revenue', 'credit'),
    'COGS': ('expense', 'debit'), 'EXPS': ('expense', 'debit'), 'OEXP': ('expense', 'debit'),
}
ASSET_TYPE_MAP = {'MESIN & PERALATAN': 'machinery', 'SEWA GUNA USAHA': 'machinery', 'INVENTARIS PABRIK': 'equipment',
                  'INVENTARIS KANTOR': 'furniture', 'KENDARAAN': 'vehicle'}


def clean(v, maxlen=None):
    if v is None:
        return None
    s = str(v).strip()
    if s in ('', '-', '--'):
        return None
    return s[:maxlen] if maxlen else s


def digits_or_none(v):
    s = clean(v)
    return None if (s is None or not s.strip('0 ')) else s


def number(v, default=0.0):
    try:
        return float(v) if v not in (None, '') else default
    except (TypeError, ValueError):
        return default


def parse_terms_days(v):
    s = (clean(v) or '').lower()
    if not s or 'c.o.d' in s or s in ('cod', 'tunai'):
        return 0
    m = re.search(r'(\d+)', s)
    return int(m.group(1)) if m else 30


def parse_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = clean(v)
    if not s:
        return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def first_account_code(v):
    s = clean(v)
    return s.split(',')[0].strip() if s else None


def norm_code(s):
    s = clean(s)
    return s[:-2] if s and s.endswith('.0') and s[:-2].isdigit() else s


def supplier_fields(get, accs):
    """-> (kwargs untuk Supplier, daftar catatan mata uang asing). accs: {kode_akun: id}."""
    notes = [clean(get('Catatan'))]
    cur = clean(get('Mata Uang Utama'))
    foreign = bool(cur and cur != 'IDR')
    if foreign:
        notes.append(f'Mata uang utama: {cur}')
    return dict(
        code=clean(get('ID Pemasok'), 50), company_name=clean(get('Nama'), 255), contact_person=clean(get('Kontak'), 200),
        email=clean(get('Email'), 120), phone=clean(get('No. Telp. Bisnis'), 50), mobile=clean(get('Handphone'), 50),
        fax=clean(get('Faximili'), 50), website=clean(get('Website'), 200),
        tax_id=digits_or_none(get('NPWP')) and clean(get('NPWP'), 100),
        address=clean(get('Alamat Pembayaran')), city=clean(get('Kota'), 100), state=clean(get('Provinsi'), 100),
        country=clean(get('Negara'), 100), postal_code=clean(get('Kode Pos'), 20),
        payment_terms_days=parse_terms_days(get('Syarat Pembayaran')), supplier_type=clean(get('Kategori'), 50),
        akun_hutang_usaha_id=accs.get(first_account_code(get('Akun Utang'))),
        notes=' | '.join(n for n in notes if n) or None, is_active=True), foreign


def customer_fields(get, accs):
    notes = [clean(get('Catatan'))]
    cur = clean(get('Mata Uang Utama'))
    foreign = bool(cur and cur != 'IDR')
    if foreign:
        notes.append(f'Mata uang utama: {cur}')
    return dict(
        code=clean(get('ID Pelanggan'), 50), company_name=clean(get('Nama'), 255), contact_person=clean(get('Kontak'), 200),
        email=clean(get('Email'), 120), phone=clean(get('No. Telp. Bisnis'), 50), mobile=clean(get('Handphone'), 50),
        fax=clean(get('Faximili'), 50), website=clean(get('Website'), 200),
        tax_id=clean(get('Nomor Wajib Pajak'), 100) if digits_or_none(get('Nomor Wajib Pajak')) else None,
        billing_address=clean(get('Alamat Penagihan')), billing_city=clean(get('Kota'), 100), billing_state=clean(get('Provinsi'), 100),
        billing_country=clean(get('Negara'), 100), billing_postal_code=clean(get('Kode Pos'), 20),
        shipping_address=clean(get('Alamat Pengiriman')), customer_type=clean(get('Kategori'), 50),
        payment_terms_days=parse_terms_days(get('Syarat Pembayaran')), credit_limit=number(get('Jumlah Limit Piutang')),
        akun_piutang_id=accs.get(first_account_code(get('Akun Piutang'))),
        notes=' | '.join(n for n in notes if n) or None, is_active=True), foreign


def asset_fields(get):
    kategori = clean(get('Kategori Aset')) or ''
    years = int(number(get('Umur Aset Tahun')))
    months = int(number(get('Umur Aset Bulan')))
    specs = {'akun_aset': clean(get('Akun Aset')), 'akun_akumulasi_penyusutan': clean(get('Akun Akumulasi Penyusutan')),
             'akun_beban_penyusutan': clean(get('Akun Beban Penyusutan')), 'kategori_pajak': clean(get('Kategori Pajak')),
             'kuantitas': number(get('Kuantitas'), 1), 'aset_tidak_berwujud': clean(get('Aset Tidak Berwujud')),
             'kode_accurate': clean(get('Kode #'))}
    return dict(
        asset_code=clean(get('Kode Aset'), 100), asset_name=clean(get('Nama'), 200),
        asset_type=ASSET_TYPE_MAP.get(kategori.upper(), 'equipment'), category=kategori.title() or None,
        description=clean(get('Catatan')), status='active', purchase_date=parse_date(get('Tanggal Beli')),
        commissioning_date=parse_date(get('Tanggal Pakai')), purchase_cost=number(get('Jumlah')),
        location=clean(get('Lokasi Aset'), 200), depreciation_method='straight_line',
        useful_life_years=years + (1 if months >= 6 else 0) if years or months else None, salvage_value=number(get('Nilai Sisa')),
        accumulated_depreciation=0, is_production_machine=False,
        specifications=json.dumps({k: v for k, v in specs.items() if v not in (None, '')}))
