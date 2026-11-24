"""Faktur pembelian barang berjenis WIP harus melunasi GR/IR, bukan jadi beban.

Dilaporkan Finance Fengsheng 2026-11-24: akun 200702 "Hutang Pembelian Belum
Ditagih" menggantung Rp 372.800.539 padahal BPB dan PI-nya sudah cocok. Dugaan
awalnya angka itu terbaca dari nilai PO karena pengirimannya parsial - ternyata
bukan: penerimaannya memang dinilai sebesar yang diterima. Yang meleset sisi
fakturnya. Penerimaan (routes/purchasing.py) memasukkan SEMUA baris berproduk ke
GR/IR, sementara faktur hanya menganggap persediaan empat jenis produk; jenis
lain - 'wip', 'premix', 'waste' - jatuh ke akun beban. Di Fengsheng 122 dari 293
produk berjenis 'wip', jadi nilainya tercatat dua kali: sebagai persediaan dari
GRN, dan sebagai Biaya Umum dan Adm Lainnya dari faktur.
"""
from datetime import date

import pytest

from models.finance import AccountingEntry


def _akun(db_session, kode, nama, tipe, normal):
    from models.finance import Account
    a = Account.query.filter_by(account_code=kode).first()
    if not a:
        a = Account(account_code=kode, account_name=nama, account_type=tipe,
                    normal_balance=normal, is_active=True, is_cash_bank=False)
        db_session.add(a)
        db_session.commit()
    return a


@pytest.fixture
def siap(db_session):
    """Pemasok, gudang, akun-akun, dan PO yang siap diterima."""
    from models.finance import GlobalAccountDefault
    from models.purchasing import PurchaseOrder, Supplier
    from models.warehouse import WarehouseLocation, WarehouseZone

    grir = _akun(db_session, '200702', 'Hutang Pembelian Belum Ditagih', 'liability', 'credit')
    beban = _akun(db_session, '620118', 'Biaya Umum dan Adm Lainnya', 'expense', 'debit')
    persediaan = _akun(db_session, '100502', 'Persediaan Barang Dalam Penyelesaian', 'asset', 'debit')
    db_session.add_all([
        GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=grir.id),
        GlobalAccountDefault(transaction_key='akun_beban_id', account_id=beban.id),
        GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan.id),
        GlobalAccountDefault(transaction_key='accounts_payable',
                             account_id=_akun(db_session, '200001', 'Hutang Usaha IDR', 'liability', 'credit').id),
    ])
    sup = Supplier(code='SUP-WIP', company_name='Pemasok Roll', is_active=True)
    zona = WarehouseZone(code='Z-WIP', name='Gudang WIP', zone_type='all', material_type='all')
    db_session.add_all([sup, zona])
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-WIP', rack='R', level='L',
                            position='P', capacity=100000, capacity_uom='kg')
    db_session.add(lok)
    db_session.commit()
    return {'lokasi': lok, 'grir': grir, 'beban': beban, 'persediaan': persediaan, 'supplier': sup}


def _po_berproduk(db_session, siap, jenis, kode, harga=100000, qty=10):
    from models.product import Product
    from models.purchasing import PurchaseOrder, PurchaseOrderItem

    p = Product(code=kode, name=f'Roll {jenis}', material_type=jenis, primary_uom='KG', is_active=True)
    db_session.add(p)
    db_session.commit()
    po = PurchaseOrder(po_number=f'PO-{kode}', supplier_id=siap['supplier'].id, order_date=date.today(),
                       status='approved', total_amount=harga * qty)
    db_session.add(po)
    db_session.commit()
    item = PurchaseOrderItem(po_id=po.id, line_number=1, product_id=p.id, description=p.name,
                             quantity=qty, uom='KG', unit_price=harga, total_price=harga * qty)
    db_session.add(item)
    db_session.commit()
    return p, po, item


def _terima_dan_tagih(client, headers, siap, produk, po, item, qty=10, harga=100000):
    grn = client.post('/api/purchasing/grn', headers=headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'product_id': produk.id, 'quantity_ordered': qty,
                   'quantity_received': qty, 'uom': 'KG', 'location_id': siap['lokasi'].id}]})
    assert grn.status_code in (200, 201), grn.get_json()
    inv = client.post('/api/purchasing/purchase-invoices', headers=headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'product_id': produk.id, 'description': produk.name,
                   'quantity': qty, 'uom': 'KG', 'unit_price': harga}]})
    assert inv.status_code == 201, inv.get_json()
    return grn.get_json(), inv.get_json()['invoice']['id']


def _debit(invoice_id):
    return {e.account_code: float(e.debit_amount or 0)
            for e in AccountingEntry.query.filter(AccountingEntry.reference_type == 'purchase_invoice',
                                                  AccountingEntry.reference_id == invoice_id,
                                                  AccountingEntry.debit_amount > 0).all()}


@pytest.mark.parametrize('jenis', ['wip', 'premix', 'waste', 'raw_materials', 'finished_goods'])
def test_faktur_barang_berstok_selalu_melunasi_gr_ir(client, auth_headers, db_session, siap, jenis):
    """Apa pun jenis produknya, kalau barangnya diterima lewat GRN maka fakturnya
    mendebit GR/IR - bukan akun beban."""
    produk, po, item = _po_berproduk(db_session, siap, jenis, f'P-{jenis.upper()}')
    _, inv_id = _terima_dan_tagih(client, auth_headers, siap, produk, po, item)

    debit = _debit(inv_id)
    assert debit.get('200702') == 1000000.0, debit
    assert '620118' not in debit, debit


def test_gr_ir_kembali_nol_setelah_barang_diterima_lalu_ditagih(client, auth_headers, db_session, siap):
    """Inti keluhannya: saldo GR/IR harus lunas begitu fakturnya masuk."""
    produk, po, item = _po_berproduk(db_session, siap, 'wip', 'P-ROLL-1')
    _terima_dan_tagih(client, auth_headers, siap, produk, po, item)

    baris = AccountingEntry.query.filter_by(account_id=siap['grir'].id).all()
    saldo = sum(float(e.debit_amount or 0) - float(e.credit_amount or 0) for e in baris)
    rincian = [(e.reference_type, float(e.debit_amount or 0), float(e.credit_amount or 0)) for e in baris]
    assert len(baris) == 2 and round(saldo, 2) == 0, rincian


def test_pengiriman_parsial_dinilai_sebesar_yang_diterima(client, auth_headers, db_session, siap):
    """Dugaan Finance: GR/IR membaca nilai PO. Tidak - yang dikredit hanya
    sebesar barang yang benar-benar datang."""
    produk, po, item = _po_berproduk(db_session, siap, 'wip', 'P-PARSIAL', harga=100000, qty=10)
    grn = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'product_id': produk.id, 'quantity_ordered': 10,
                   'quantity_received': 4, 'uom': 'KG', 'location_id': siap['lokasi'].id}]})
    assert grn.status_code in (200, 201), grn.get_json()

    kredit = sum(float(e.credit_amount or 0)
                 for e in AccountingEntry.query.filter_by(account_id=siap['grir'].id).all())
    assert kredit == 400000.0          # 4 x 100.000, bukan 1.000.000 senilai PO
