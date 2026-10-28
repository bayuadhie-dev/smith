import io
import re

import openpyxl
import pytest

SUP = ['No.', 'Kategori', 'ID Pemasok', 'Nama', 'Kontak', 'No. Telp. Bisnis', 'Handphone', 'Email', 'Faximili', 'Website',
       'Mata Uang Utama', 'Syarat Pembayaran', 'Alamat Pembayaran', 'Kota', 'Provinsi', 'Negara', 'Kode Pos', 'Catatan', 'Akun Utang', 'NPWP']


def _xlsx(head, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(head)
    for r in rows:
        ws.append(r)
    b = io.BytesIO()
    wb.save(b)
    b.seek(0)
    return b


def _post(client, headers, kind, buf, commit):
    return client.post(f'/api/imports/{kind}', headers=headers, content_type='multipart/form-data',
                       data={'file': (buf, 'x.xlsx'), 'commit': '1' if commit else '0'}).get_json()


def _sup_row(code, name, cur='IDR', terms='Net 30'):
    r = {h: None for h in SUP}
    r.update({'ID Pemasok': code, 'Nama': name, 'Mata Uang Utama': cur, 'Syarat Pembayaran': terms, 'Kategori': 'BAHAN BAKU', 'NPWP': '0000'})
    return [r[h] for h in SUP]


def test_supplier_preview_commit_and_duplicates(client, auth_headers, db_session):
    from models.purchasing import Supplier
    rows = [_sup_row('S-1', 'PT Satu'), _sup_row('S-2', 'PT Dua', cur='USD', terms='C.O.D'), _sup_row('S-1', 'PT Ganda')]
    prev = _post(client, auth_headers, 'supplier', _xlsx(SUP, rows), False)
    assert prev['summary']['ok'] == 2 and prev['summary']['error'] == 1
    assert Supplier.query.filter(Supplier.code.in_(['S-1', 'S-2'])).count() == 0          # pratinjau tidak menyimpan
    done = _post(client, auth_headers, 'supplier', _xlsx(SUP, rows), True)
    assert done['summary']['ok'] == 2
    s2 = Supplier.query.filter_by(code='S-2').first()
    assert s2.payment_terms_days == 0 and 'USD' in (s2.notes or '') and s2.tax_id is None
    again = _post(client, auth_headers, 'supplier', _xlsx(SUP, [_sup_row('S-1', 'PT Satu')]), True)
    assert again['summary']['ok'] == 0 and 'sudah ada' in again['transactions'][0]['errors'][0]
    assert Supplier.query.filter_by(code='S-1').count() == 1


def test_customer_and_asset_and_account(client, auth_headers, db_session):
    from models.asset_management import Asset
    from models.finance import Account
    from models.sales import Customer
    CUS = ['ID Pelanggan', 'Nama', 'Kategori', 'Syarat Pembayaran', 'Alamat Pengiriman', 'Jumlah Limit Piutang']
    r = _post(client, auth_headers, 'customer', _xlsx(CUS, [['C-1', 'PT Pelanggan', 'DISTRIBUTOR', 'Net 45', None, 1000]]), True)
    assert r['summary']['ok'] == 1 and Customer.query.filter_by(code='C-1').first().payment_terms_days == 45
    AST = ['Kategori Aset', 'Kode Aset', 'Nama', 'Tanggal Beli', 'Umur Aset Tahun', 'Umur Aset Bulan', 'Jumlah']
    r = _post(client, auth_headers, 'asset', _xlsx(AST, [['MESIN & PERALATAN', 'A-1', 'Mesin', '01/01/2020', 8, 0, 5000000]]), True)
    a = Asset.query.filter_by(asset_code='A-1').first()
    assert r['summary']['ok'] == 1 and a.asset_type == 'machinery' and float(a.purchase_cost) == 5000000 and float(a.accumulated_depreciation) == 0
    COA = ['Tipe Akun', 'Kode Perkiraan', 'Nama', 'Akun Induk']
    rows = [['EXPS', '9-9000', 'Induk Uji', None], ['EXPS', '9-9001', 'Anak Uji', '9-9000'], ['EXPS', '9-9002', 'Yatim', '9-NOPE'], ['XXXX', '9-9003', 'Salah', None]]
    r = _post(client, auth_headers, 'chart_of_accounts', _xlsx(COA, rows), True)
    assert r['summary']['ok'] == 2 and r['summary']['error'] == 2
    parent, child = Account.query.filter_by(account_code='9-9000').first(), Account.query.filter_by(account_code='9-9001').first()
    assert child.parent_id == parent.id and parent.is_header and child.level == 2


ITEM = ['Kategori Barang', 'Kode Barang', 'Nama Barang', 'Jenis Barang', 'Satuan', 'Satuan #2', 'Rasio Satuan #2']


def test_item_no_duplicates_across_tables(client, auth_headers, db_session, test_product, test_material):
    from models.product import Material, Product
    rows = [
        ['BAHAN PEMBANTU', 'NEW-1', 'LAKBAN BARU 2"', 'INV', 'ROL', 'CTN', 12],
        ['BARANG JADI', 'NEW-2', test_material.name, 'INV', 'PCS', None, None],        # nama sama dengan MATERIAL lama, kategori produk
        ['BAHAN BAKU', 'NEW-3', test_product.name.upper(), 'INV', 'KG', None, None],    # nama sama dengan PRODUK lama, kategori material
        ['BARANG JADI', test_product.code, 'Nama lain', 'INV', 'PCS', None, None],      # kode sudah ada
        ['LAIN-LAIN', 'NEW-4', 'Tidak diimpor', 'INV', 'PCS', None, None],
        ['BAHAN PEMBANTU', 'NEW-1', 'LAKBAN BARU 2"', 'INV', 'ROL', None, None],         # ganda di file
    ]
    p0, m0 = Product.query.count(), Material.query.count()
    prev = _post(client, auth_headers, 'item', _xlsx(ITEM, rows), False)
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 5
    assert Product.query.count() == p0 and Material.query.count() == m0
    errs = ' | '.join(e for t in prev['transactions'] for e in t['errors'])
    assert 'Nama sama dengan material' in errs and 'Nama sama dengan produk' in errs and 'sudah ada' in errs and 'tidak diimpor' in errs and 'ganda di file' in errs
    done = _post(client, auth_headers, 'item', _xlsx(ITEM, rows), True)
    assert done['summary']['ok'] == 1
    assert Material.query.count() == m0 + 1 and Product.query.count() == p0
    assert Material.query.filter_by(code='NEW-1').first().name == 'LAKBAN BARU 2"'


def test_accurate_headers_recognised_and_script_helpers_unchanged(client, auth_headers, db_session):
    from imports.master import AssetKind, ItemKind, SupplierKind
    from utils.master_import_helpers import parse_terms_days, supplier_fields
    heads = {c.label for c in SupplierKind.columns}
    assert {'ID Pemasok', 'Alamat Pembayaran', 'Syarat Pembayaran', 'Mata Uang Utama'} <= heads
    assert {'Kategori Barang', 'Kode Barang', 'Nama Barang', 'Satuan #2', 'Rasio Satuan #2', 'Non Aktif'} <= {c.label for c in ItemKind.columns}
    assert 'Kode Aset' in {c.label for c in AssetKind.columns}
    assert [parse_terms_days(x) for x in ('Net 45', 'C.O.D', '', None, 'Top 30 hr')] == [45, 0, 0, 0, 30]
    f, foreign = supplier_fields({'ID Pemasok': ' S9 ', 'Nama': 'N', 'Mata Uang Utama': 'CNY', 'Akun Utang': '200001, x'}.get, {'200001': 7})
    assert f['code'] == 'S9' and foreign and f['akun_hutang_usaha_id'] == 7


def test_legacy_script_still_works_with_shared_builders(app, db_session, tmp_path):
    import importlib
    from models.asset_management import Asset
    from models.purchasing import Supplier
    from models.sales import Customer
    script = importlib.import_module('scripts.import_fengsheng_master')

    def write(name, head, rows):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(head)
        for r in rows:
            ws.append(r)
        wb.save(tmp_path / name)
        return str(tmp_path / name)

    rep = script.Report()
    sh = ['ID Pemasok', 'Nama', 'Catatan', 'Mata Uang Utama', 'Akun Utang', 'Kontak', 'Email', 'No. Telp. Bisnis', 'Handphone', 'Faximili',
          'Website', 'NPWP', 'Alamat Pembayaran', 'Kota', 'Provinsi', 'Negara', 'Kode Pos', 'Syarat Pembayaran', 'Kategori']
    script.import_suppliers(write('s.xlsx', sh, [['LEG-S1', 'Legacy Sup', None, 'USD', None, None, None, None, None, None, None, '000', None, None, None, None, None, 'Net 15', 'CHEM'],
                                                  ['LEG-S1', 'Dobel', None, 'IDR'] + [None] * 15]), rep)
    s = Supplier.query.filter_by(code='LEG-S1').first()
    assert Supplier.query.filter_by(code='LEG-S1').count() == 1 and s.payment_terms_days == 15 and 'USD' in s.notes and s.tax_id is None
    assert '1 pemasok baru' in rep.lines[-1] and '1 dilewati' in rep.lines[-1]
    ch = ['ID Pelanggan', 'Nama', 'Catatan', 'Mata Uang Utama', 'Akun Piutang', 'Kontak', 'Email', 'No. Telp. Bisnis', 'Handphone', 'Faximili', 'Website',
          'Nomor Wajib Pajak', 'Alamat Penagihan', 'Kota', 'Provinsi', 'Negara', 'Kode Pos', 'Alamat Pengiriman', 'Kategori', 'Syarat Pembayaran', 'Jumlah Limit Piutang']
    script.import_customers(write('c.xlsx', ch, [['LEG-C1', 'Legacy Cus'] + [None] * 17 + ['Net 30', 5]]), rep)
    assert Customer.query.filter_by(code='LEG-C1').first().payment_terms_days == 30 and '1 tanpa alamat pengiriman' in rep.lines[-1]
    ah = ['Kategori Aset', 'Kode Aset', 'Nama', 'Umur Aset Tahun', 'Umur Aset Bulan', 'Akun Aset', 'Akun Akumulasi Penyusutan', 'Akun Beban Penyusutan',
          'Kategori Pajak', 'Kuantitas', 'Aset Tidak Berwujud', 'Kode #', 'Catatan', 'Tanggal Beli', 'Tanggal Pakai', 'Jumlah', 'Lokasi Aset', 'Nilai Sisa']
    script.import_assets(write('a.xlsx', ah, [['KENDARAAN', 'LEG-A1', 'Truk', 4, 7] + [None] * 8 + ['01/02/2021', None, 1000, 'GUDANG', 0]]), rep)
    a = Asset.query.filter_by(asset_code='LEG-A1').first()
    assert a.asset_type == 'vehicle' and a.useful_life_years == 5 and float(a.purchase_cost) == 1000
