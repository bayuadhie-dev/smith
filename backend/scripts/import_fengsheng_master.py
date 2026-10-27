"""Impor master data PT FENGSHENG NONWOVEN INDONESIA dari ekspor Accurate Online ke database baru.

  cd backend && PYTHONPATH=. python scripts/import_fengsheng_master.py --dir /path/ke/folder-xlsx            # pemeriksaan (tidak menyimpan)
  cd backend && PYTHONPATH=. python scripts/import_fengsheng_master.py --dir /path/ke/folder-xlsx --apply    # simpan

Berkas (di --dir): akunperkiraan.xlsx, daftarbarang.xlsx, daftarpemasok.xlsx, daftarpelanggan.xlsx, asettetap.xlsx.
Urutan: akun perkiraan -> master referensi (disamakan dengan Falmaco: satuan, zona/lokasi gudang, akun default, akun pajak)
        -> barang -> pemasok -> pelanggan -> aset tetap.  Idempoten: baris yang kodenya sudah ada dilewati.
Semuanya satu transaksi: kalau --apply tidak diberikan, semuanya dibatalkan.
"""
import argparse
import json
import os
import re
import sys
from datetime import date, datetime

sys.path.insert(0, '.')

import openpyxl

from app import create_app
from models import db
from models.finance import Account, CompanyAccountSettings, GlobalAccountDefault, TaxAccountSettings
from models.uom import UnitOfMeasure

TYPE_MAP = {   # kode "Tipe Akun" ekspor Accurate -> (account_type, normal_balance)
    'BANK': ('asset', 'debit'), 'AREC': ('asset', 'debit'), 'OCAS': ('asset', 'debit'), 'INTR': ('asset', 'debit'),
    'FASS': ('asset', 'debit'), 'OASS': ('asset', 'debit'), 'DEPR': ('asset', 'credit'),
    'APAY': ('liability', 'credit'), 'OCLY': ('liability', 'credit'), 'LTLY': ('liability', 'credit'),
    'EQTY': ('equity', 'credit'), 'REVE': ('revenue', 'credit'), 'OINC': ('revenue', 'credit'),
    'COGS': ('expense', 'debit'), 'EXPS': ('expense', 'debit'), 'OEXP': ('expense', 'debit'),
}
ASSET_TYPE_MAP = {'MESIN & PERALATAN': 'machinery', 'SEWA GUNA USAHA': 'machinery', 'INVENTARIS PABRIK': 'equipment',
                  'INVENTARIS KANTOR': 'furniture', 'KENDARAAN': 'vehicle'}


def sheet_rows(path):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h).strip() if h is not None else '' for h in rows[0]]
    return head, rows[1:]


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


class Report:
    def __init__(self):
        self.lines, self.warnings = [], []

    def add(self, section, text):
        self.lines.append(f'[{section}] {text}')

    def warn(self, section, text):
        self.warnings.append(f'[{section}] {text}')


def import_accounts(path, rep):
    head, rows = sheet_rows(path)
    ix = {h: i for i, h in enumerate(head)}
    data = []
    for r in rows:
        code = clean(r[ix['Kode Perkiraan']])
        if not code:
            continue
        code = code[:-2] if code.endswith('.0') and code[:-2].isdigit() else code
        parent = clean(r[ix['Akun Induk']])
        parent = parent[:-2] if parent and parent.endswith('.0') and parent[:-2].isdigit() else parent
        data.append((code, clean(r[ix['Nama']]) or code, clean(r[ix['Tipe Akun']]), parent, clean(r[ix['Catatan']]), clean(r[ix['Mata Uang']])))
    codes = {d[0] for d in data}
    parents = {d[3] for d in data if d[3]}
    for d in data:
        if d[3] and d[3] not in codes:
            rep.warn('akun', f'{d[0]} {d[1]}: akun induk {d[3]} tidak ada di file, dibuat tanpa induk')
    existing = {a.account_code: a for a in Account.query.all()}
    created = 0
    for code, name, typ, parent, note, cur in data:
        if code in existing:
            continue
        if typ not in TYPE_MAP:
            rep.warn('akun', f'{code} {name}: tipe akun "{typ}" tidak dikenal, dianggap aset')
        acc_type, normal = TYPE_MAP.get(typ, ('asset', 'debit'))
        acc = Account(account_code=code, account_name=name[:200], account_type=acc_type, normal_balance=normal,
                      is_header=code in parents, is_cash_bank=(typ == 'BANK' and code not in parents), is_active=True,
                      description=note, level=1)
        db.session.add(acc)
        existing[code] = acc
        created += 1
    db.session.flush()
    by_code = existing
    for code, name, typ, parent, note, cur in data:
        acc = by_code[code]
        if parent and parent in by_code and acc.parent_id is None:
            acc.parent_id = by_code[parent].id

    def depth(a, seen=0):
        return 1 if a.parent_id is None or seen > 8 else 1 + depth(db.session.get(Account, a.parent_id), seen + 1)
    for code, *_ in data:
        by_code[code].level = depth(by_code[code])
    db.session.flush()
    foreign = [(d[0], d[5]) for d in data if d[5] and d[5] != 'IDR']
    if foreign:
        rep.warn('akun', f'{len(foreign)} akun bermata uang asing ({", ".join(f"{c}:{m}" for c, m in foreign[:6])}...): model Account tidak punya kolom mata uang, tercatat sebagai akun biasa')
    rep.add('akun', f'{created} akun baru dari {len(data)} baris ({sum(1 for d in data if d[0] in parents)} akun induk, {sum(1 for a in by_code.values() if a.is_cash_bank)} kas/bank)')


def import_reference(ref_path, rep):
    from models.warehouse import WarehouseLocation, WarehouseZone
    ref = json.load(open(ref_path, encoding='utf-8'))
    n = 0
    for u in ref['units_of_measure']:
        if not UnitOfMeasure.query.filter(db.func.upper(UnitOfMeasure.code) == u['code'].upper()).first():
            db.session.add(UnitOfMeasure(code=u['code'], name=u['name'], category=u['category'], description=u['description'], is_active=u['is_active']))
            n += 1
    rep.add('satuan', f'{n} satuan disalin dari Falmaco ({len(ref["units_of_measure"])} total di Falmaco)')
    z = 0
    zones = {}
    for zd in ref['warehouse_zones']:
        zone = WarehouseZone.query.filter_by(code=zd['code']).first()
        if not zone:
            zone = WarehouseZone(code=zd['code'], name=zd['name'], description=zd['description'], material_type=zd['material_type'],
                                 zone_type=zd['zone_type'], capacity=zd['capacity'], capacity_uom=zd['capacity_uom'], is_active=zd['is_active'])
            db.session.add(zone)
            z += 1
        zones[zd['code']] = zone
    db.session.flush()
    loc = 0
    for ld in ref['warehouse_locations']:
        if not WarehouseLocation.query.filter_by(location_code=ld['location_code']).first():
            db.session.add(WarehouseLocation(zone_id=zones[ld['zone_code']].id, location_code=ld['location_code'], rack=ld['rack'], level=ld['level'],
                                             position=ld['position'], capacity=ld['capacity'], capacity_uom=ld['capacity_uom'],
                                             is_active=ld['is_active'], is_available=ld['is_available']))
            loc += 1
    rep.add('gudang', f'{z} zona dan {loc} lokasi gudang disalin dari Falmaco')
    db.session.flush()
    accs = {a.account_code: a.id for a in Account.query.all()}
    made = 0
    for g in ref['global_account_defaults']:
        if g['account_code'] not in accs:
            rep.warn('akun default', f'{g["transaction_key"]} -> {g["account_code"]} tidak ada di akun perkiraan Fengsheng, dilewati (atur manual di Pengaturan Akun)')
            continue
        if not GlobalAccountDefault.query.filter_by(transaction_key=g['transaction_key']).first():
            db.session.add(GlobalAccountDefault(transaction_key=g['transaction_key'], account_id=accs[g['account_code']], description=g['description']))
            made += 1
    rep.add('akun default', f'{made} akun default transaksi disalin dari Falmaco (dicocokkan lewat kode akun)')
    t = ref['tax_account_settings'] or {}
    if t and not TaxAccountSettings.query.first():
        missing = [k for k, c in t.items() if c and c not in accs]
        for k in missing:
            rep.warn('pajak', f'akun {k} ({t[k]}) tidak ada di akun perkiraan Fengsheng')
        db.session.add(TaxAccountSettings(akun_ppn_keluaran_id=accs.get(t.get('ppn_keluaran')), akun_ppn_masukan_id=accs.get(t.get('ppn_masukan')),
                                          akun_pph22_id=accs.get(t.get('pph22')), akun_pph23_id=accs.get(t.get('pph23'))))
        rep.add('pajak', f'pengaturan akun pajak disalin (PPN keluaran {t.get("ppn_keluaran")}, masukan {t.get("ppn_masukan")}, PPh22 {t.get("pph22")}, PPh23 {t.get("pph23")})')
    db.session.flush()


def import_items(path, rep):
    from routes.master_data_import import import_item_rows
    head, rows = sheet_rows(path)
    res = import_item_rows(rows, commit=False)
    rep.add('barang', f'{res["created_product"]} produk + {res["created_material"]} material baru; dilewati: {res["skipped_exists"]} sudah ada, {res["skipped_category"]} kategori tidak diimpor; galat: {res["error_count"]}')
    for e in res['errors'][:10]:
        rep.warn('barang', e)
    if res['missing_gl_codes']:
        rep.warn('barang', f'{res["missing_gl_code_count"]} kode akun GL di file barang tidak ada di akun perkiraan: {", ".join(res["missing_gl_codes"][:12])}')


def import_suppliers(path, rep):
    from models.purchasing import Supplier
    head, rows = sheet_rows(path)
    ix = {h: i for i, h in enumerate(head)}
    accs = {a.account_code: a.id for a in Account.query.all()}
    created, skipped, foreign = 0, 0, 0
    seen = set()
    for r in rows:
        code = clean(r[ix['ID Pemasok']], 50)
        name = clean(r[ix['Nama']], 255)
        if not code or not name:
            continue
        if code in seen or Supplier.query.filter_by(code=code).first():
            skipped += 1
            continue
        seen.add(code)
        notes = [clean(r[ix['Catatan']])]
        cur = clean(r[ix['Mata Uang Utama']])
        if cur and cur != 'IDR':
            foreign += 1
            notes.append(f'Mata uang utama: {cur}')
        akun = clean(r[ix['Akun Utang']])
        akun = akun.split(',')[0].strip() if akun else None
        db.session.add(Supplier(
            code=code, company_name=name, contact_person=clean(r[ix['Kontak']], 200), email=clean(r[ix['Email']], 120),
            phone=clean(r[ix['No. Telp. Bisnis']], 50), mobile=clean(r[ix['Handphone']], 50), fax=clean(r[ix['Faximili']], 50),
            website=clean(r[ix['Website']], 200), tax_id=digits_or_none(r[ix['NPWP']]) and clean(r[ix['NPWP']], 100),
            address=clean(r[ix['Alamat Pembayaran']]), city=clean(r[ix['Kota']], 100), state=clean(r[ix['Provinsi']], 100),
            country=clean(r[ix['Negara']], 100), postal_code=clean(r[ix['Kode Pos']], 20),
            payment_terms_days=parse_terms_days(r[ix['Syarat Pembayaran']]), supplier_type=clean(r[ix['Kategori']], 50),
            akun_hutang_usaha_id=accs.get(akun), notes=' | '.join(n for n in notes if n) or None, is_active=True))
        created += 1
    db.session.flush()
    rep.add('pemasok', f'{created} pemasok baru ({skipped} dilewati: kode ganda/sudah ada; {foreign} bermata uang asing dicatat di Catatan)')


def import_customers(path, rep):
    from models.sales import Customer
    head, rows = sheet_rows(path)
    ix = {h: i for i, h in enumerate(head)}
    accs = {a.account_code: a.id for a in Account.query.all()}
    created, skipped, foreign, no_ship = 0, 0, 0, 0
    seen = set()
    for r in rows:
        code = clean(r[ix['ID Pelanggan']], 50)
        name = clean(r[ix['Nama']], 255)
        if not code or not name:
            continue
        if code in seen or Customer.query.filter_by(code=code).first():
            skipped += 1
            continue
        seen.add(code)
        notes = [clean(r[ix['Catatan']])]
        cur = clean(r[ix['Mata Uang Utama']])
        if cur and cur != 'IDR':
            foreign += 1
            notes.append(f'Mata uang utama: {cur}')
        akun = clean(r[ix['Akun Piutang']])
        akun = akun.split(',')[0].strip() if akun else None
        ship = clean(r[ix['Alamat Pengiriman']])
        if not ship:
            no_ship += 1
        db.session.add(Customer(
            code=code, company_name=name, contact_person=clean(r[ix['Kontak']], 200), email=clean(r[ix['Email']], 120),
            phone=clean(r[ix['No. Telp. Bisnis']], 50), mobile=clean(r[ix['Handphone']], 50), fax=clean(r[ix['Faximili']], 50),
            website=clean(r[ix['Website']], 200),
            tax_id=clean(r[ix['Nomor Wajib Pajak']], 100) if digits_or_none(r[ix['Nomor Wajib Pajak']]) else None,
            billing_address=clean(r[ix['Alamat Penagihan']]), billing_city=clean(r[ix['Kota']], 100), billing_state=clean(r[ix['Provinsi']], 100),
            billing_country=clean(r[ix['Negara']], 100), billing_postal_code=clean(r[ix['Kode Pos']], 20),
            shipping_address=ship, customer_type=clean(r[ix['Kategori']], 50),
            payment_terms_days=parse_terms_days(r[ix['Syarat Pembayaran']]), credit_limit=number(r[ix['Jumlah Limit Piutang']]),
            akun_piutang_id=accs.get(akun), notes=' | '.join(n for n in notes if n) or None, is_active=True))
        created += 1
    db.session.flush()
    rep.add('pelanggan', f'{created} pelanggan baru ({skipped} dilewati; {foreign} bermata uang asing dicatat di Catatan; {no_ship} tanpa alamat pengiriman)')


def import_assets(path, rep):
    from models.asset_management import Asset
    head, rows = sheet_rows(path)
    ix = {h: i for i, h in enumerate(head)}
    created, skipped = 0, 0
    seen = set()
    for r in rows:
        code = clean(r[ix['Kode Aset']], 100)
        name = clean(r[ix['Nama']], 200)
        if not code or not name:
            continue
        if code in seen or Asset.query.filter_by(asset_code=code).first():
            skipped += 1
            rep.warn('aset', f'{code}: kode ganda/sudah ada, dilewati')
            continue
        seen.add(code)
        kategori = clean(r[ix['Kategori Aset']]) or ''
        years = int(number(r[ix['Umur Aset Tahun']]))
        months = int(number(r[ix['Umur Aset Bulan']]))
        specs = {'akun_aset': clean(r[ix['Akun Aset']]), 'akun_akumulasi_penyusutan': clean(r[ix['Akun Akumulasi Penyusutan']]),
                 'akun_beban_penyusutan': clean(r[ix['Akun Beban Penyusutan']]), 'kategori_pajak': clean(r[ix['Kategori Pajak']]),
                 'kuantitas': number(r[ix['Kuantitas']], 1), 'aset_tidak_berwujud': clean(r[ix['Aset Tidak Berwujud']]),
                 'kode_accurate': clean(r[ix['Kode #']])}
        db.session.add(Asset(
            asset_code=code, asset_name=name, asset_type=ASSET_TYPE_MAP.get(kategori.upper(), 'equipment'), category=kategori.title() or None,
            description=clean(r[ix['Catatan']]), status='active', purchase_date=parse_date(r[ix['Tanggal Beli']]),
            commissioning_date=parse_date(r[ix['Tanggal Pakai']]), purchase_cost=number(r[ix['Jumlah']]),
            location=clean(r[ix['Lokasi Aset']], 200), depreciation_method='straight_line',
            useful_life_years=years + (1 if months >= 6 else 0) if years or months else None, salvage_value=number(r[ix['Nilai Sisa']]),
            accumulated_depreciation=0, is_production_machine=False, specifications=json.dumps({k: v for k, v in specs.items() if v not in (None, '')})))
        created += 1
    db.session.flush()
    # Akun default penyusutan/pelepasan dari akun yang dipakai aset di file Fengsheng sendiri.
    accs = {a.account_code: a.id for a in Account.query.all()}
    per_category, beban = {}, {}
    for r in rows:
        kategori = (clean(r[ix['Kategori Aset']]) or '').title()
        slug = kategori.strip().lower().replace(' & ', '_dan_').replace(' ', '_')
        akum, exp = clean(r[ix['Akun Akumulasi Penyusutan']]), clean(r[ix['Akun Beban Penyusutan']])
        if slug and akum:
            per_category[slug] = akum
        if exp:
            beban[exp] = beban.get(exp, 0) + 1
    made = 0
    for slug, code in per_category.items():
        key = f'akumulasi_penyusutan_{slug}'
        if code in accs and not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db.session.add(GlobalAccountDefault(transaction_key=key, account_id=accs[code], description='Dari file aset tetap Fengsheng'))
            made += 1
    if beban and not GlobalAccountDefault.query.filter_by(transaction_key='depreciation_expense').first():
        top = max(beban, key=beban.get)
        if top in accs:
            db.session.add(GlobalAccountDefault(transaction_key='depreciation_expense', account_id=accs[top], description='Akun beban penyusutan terbanyak di file aset tetap'))
            made += 1
    db.session.flush()
    rep.add('aset tetap', f'{created} aset baru ({skipped} dilewati); {made} akun default penyusutan dari file aset. Akumulasi penyusutan awal = 0 karena file tidak memuatnya')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='..')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--ref', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'falmaco_reference_masters.json'))
    args = ap.parse_args()
    only = set(filter(None, args.only.split(',')))
    app = create_app()
    rep = Report()
    with app.app_context():
        print('Database:', str(db.engine.url).rsplit('/', 1)[-1])
        steps = [('akun', lambda: import_accounts(os.path.join(args.dir, 'akunperkiraan.xlsx'), rep)),
                 ('referensi', lambda: import_reference(args.ref, rep)),
                 ('barang', lambda: import_items(os.path.join(args.dir, 'daftarbarang.xlsx'), rep)),
                 ('pemasok', lambda: import_suppliers(os.path.join(args.dir, 'daftarpemasok.xlsx'), rep)),
                 ('pelanggan', lambda: import_customers(os.path.join(args.dir, 'daftarpelanggan.xlsx'), rep)),
                 ('aset', lambda: import_assets(os.path.join(args.dir, 'asettetap.xlsx'), rep))]
        try:
            for name, fn in steps:
                if only and name not in only:
                    continue
                fn()
        except Exception:
            db.session.rollback()
            raise
        print('\n'.join(rep.lines))
        if rep.warnings:
            print(f'\nPERINGATAN ({len(rep.warnings)}):')
            print('\n'.join(rep.warnings[:60]))
        if args.apply:
            db.session.commit()
            print('\nDISIMPAN.')
        else:
            db.session.rollback()
            print('\nPEMERIKSAAN SAJA - tidak ada yang disimpan (tambahkan --apply untuk menyimpan).')


if __name__ == '__main__':
    main()
