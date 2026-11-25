"""Menghapus penerimaan barang yang salah catat.

Sampai 2026-11-24 tidak ada jalan sama sekali untuk membatalkan GRN - tidak ada
tombolnya, dan tidak ada endpoint-nya. Gudang (Bu Lisa) melaporkannya; BPB-26/11/007
di Fengsheng tercatat salah dan menggantung di daftar, sementara jumlah diterima
di PO ikut salah selamanya.
"""
from datetime import date

import pytest

from models import db
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
    from models.finance import GlobalAccountDefault
    from models.purchasing import Supplier
    from models.warehouse import WarehouseLocation, WarehouseZone

    grir = _akun(db_session, '200702', 'Hutang Pembelian Belum Ditagih', 'liability', 'credit')
    persediaan = _akun(db_session, '100501', 'Persediaan Bahan Baku', 'asset', 'debit')
    db_session.add_all([
        GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=grir.id),
        GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan.id),
        GlobalAccountDefault(
            transaction_key='accounts_payable',
            account_id=_akun(db_session, '200001', 'Hutang Usaha IDR', 'liability', 'credit').id),
    ])
    sup = Supplier(code='SUP-HPS', company_name='Pemasok Uji', is_active=True)
    zona = WarehouseZone(code='Z-HPS', name='Gudang Uji', zone_type='all', material_type='all')
    db_session.add_all([sup, zona])
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-HPS', rack='R', level='L',
                            position='P', capacity=100000, capacity_uom='kg')
    db_session.add(lok)
    db_session.commit()
    return {'lokasi': lok, 'grir': grir, 'persediaan': persediaan, 'supplier': sup}


def _po(db_session, siap, qty=100, harga=1000):
    from models.product import Material
    from models.purchasing import PurchaseOrder, PurchaseOrderItem
    m = Material(code=f'BHN-{qty}', name='Bahan Uji', material_type='raw_materials',
                 category='Bahan Baku', primary_uom='KG', is_active=True)
    db_session.add(m)
    db_session.commit()
    po = PurchaseOrder(po_number=f'PO-HPS-{qty}', supplier_id=siap['supplier'].id,
                       order_date=date.today(), status='approved', total_amount=qty * harga)
    db_session.add(po)
    db_session.commit()
    item = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=m.id, description=m.name,
                             quantity=qty, uom='KG', unit_price=harga, total_price=qty * harga)
    db_session.add(item)
    db_session.commit()
    return m, po, item


def _terima(client, headers, siap, m, po, item, qty):
    r = client.post('/api/purchasing/grn', headers=headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': m.id, 'quantity_ordered': float(item.quantity),
                   'quantity_received': qty, 'uom': 'KG', 'location_id': siap['lokasi'].id}]})
    assert r.status_code in (200, 201), r.get_json()
    return r.get_json()['grn_id']


def _stok(m):
    from models.warehouse import Inventory
    return float(db.session.query(db.func.coalesce(db.func.sum(Inventory.quantity_on_hand), 0))
                 .filter(Inventory.material_id == m.id).scalar() or 0)


def test_penerimaan_dihapus_beserta_stok_dan_jumlah_di_po(client, auth_headers, db_session, siap):
    from models.purchasing import GoodsReceivedNote, PurchaseOrderItem

    m, po, item = _po(db_session, siap, qty=100)
    grn_id = _terima(client, auth_headers, siap, m, po, item, 40)
    assert _stok(m) == 40
    db_session.refresh(item)
    assert float(item.quantity_received) == 40

    r = client.delete(f'/api/purchasing/grn/{grn_id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()

    assert db.session.get(GoodsReceivedNote, grn_id) is None
    assert _stok(m) == 0                                  # stoknya ikut ditarik
    db_session.refresh(item)
    assert float(item.quantity_received) == 0             # PO kembali seperti semula


def test_jurnal_penerimaan_dibalik_bukan_dihapus(client, auth_headers, db_session, siap):
    """Jurnal yang sudah terposting tidak boleh hilang tanpa jejak."""
    m, po, item = _po(db_session, siap, qty=100, harga=1000)
    grn_id = _terima(client, auth_headers, siap, m, po, item, 10)

    awal = AccountingEntry.query.filter_by(account_id=siap['grir'].id).count()
    assert awal >= 1                                      # GR/IR terbentuk saat diterima

    assert client.delete(f'/api/purchasing/grn/{grn_id}', headers=auth_headers).status_code == 200

    baris = AccountingEntry.query.filter_by(account_id=siap['grir'].id).all()
    assert len(baris) > awal                              # ada baris pembalik, bukan penghapusan
    saldo = sum(float(e.credit_amount or 0) - float(e.debit_amount or 0) for e in baris)
    assert round(saldo, 2) == 0                           # dan saldonya kembali nol


def test_penerimaan_yang_stoknya_sudah_terpakai_ditolak(client, auth_headers, db_session, siap):
    from models.warehouse import Inventory

    m, po, item = _po(db_session, siap, qty=100)
    grn_id = _terima(client, auth_headers, siap, m, po, item, 50)

    inv = Inventory.query.filter_by(material_id=m.id).first()
    inv.quantity_on_hand = 20            # 30 sudah dipakai produksi
    db_session.commit()

    r = client.delete(f'/api/purchasing/grn/{grn_id}', headers=auth_headers)
    assert r.status_code == 409
    assert 'sudah terpakai' in r.get_json()['error']
    assert _stok(m) == 20                                 # tidak ada yang berubah


def test_penerimaan_yang_sudah_difakturkan_ditolak(client, auth_headers, db_session, siap):
    from models.finance import Invoice
    from models.purchasing import GoodsReceivedNote

    m, po, item = _po(db_session, siap, qty=100)
    grn_id = _terima(client, auth_headers, siap, m, po, item, 25)
    db_session.add(Invoice(invoice_number='PI-HPS-1', invoice_type='purchase', grn_id=grn_id,
                           invoice_date=date.today(), due_date=date.today(), total_amount=1000,
                           status='sent'))
    db_session.commit()

    r = client.delete(f'/api/purchasing/grn/{grn_id}', headers=auth_headers)
    assert r.status_code == 409
    assert 'difakturkan' in r.get_json()['error']
    assert db.session.get(GoodsReceivedNote, grn_id) is not None


def test_penerimaan_tanpa_stok_dan_tanpa_jurnal_tetap_bisa_dihapus(client, auth_headers, db_session, siap):
    """Baris jasa (ongkos kirim) tidak melahirkan stok maupun jurnal - persis
    BPB-26/11/007 di Fengsheng yang diminta dihapus."""
    from models.product import Material
    from models.purchasing import GoodsReceivedNote, PurchaseOrder, PurchaseOrderItem

    jasa = Material(code='JASA-KIRIM', name='Biaya Pengiriman', material_type='non_inventory',
                    category='Non Persediaan', primary_uom='UNIT', is_active=True)
    db_session.add(jasa)
    db_session.commit()
    po = PurchaseOrder(po_number='PO-HPS-JASA', supplier_id=siap['supplier'].id,
                       order_date=date.today(), status='approved', total_amount=500000)
    db_session.add(po)
    db_session.commit()
    item = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=jasa.id, description=jasa.name,
                             quantity=1, uom='UNIT', unit_price=500000, total_price=500000)
    db_session.add(item)
    db_session.commit()

    r = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': jasa.id, 'quantity_ordered': 1,
                   'quantity_received': 1, 'uom': 'UNIT'}]})
    assert r.status_code in (200, 201), r.get_json()
    grn_id = r.get_json()['grn_id']

    assert client.delete(f'/api/purchasing/grn/{grn_id}', headers=auth_headers).status_code == 200
    assert db.session.get(GoodsReceivedNote, grn_id) is None


# ---- Rantai hapus: pembayaran -> faktur -> penerimaan ----------------------
# Diputuskan manajemen 2026-11-25: "Boleh ada fitur hapus tp berurutan pembelian
# kalo udh ada pembayaran. Urutan hapus dari pembayaran -> PI -> Grn".
# Pembatalan pembayaran sudah ada (void). Yang bolong: menghapus faktur membuang
# barisnya SAJA - jurnalnya tetap terposting, dan PO tetap mengira sudah tertagih.

def test_hapus_faktur_membalik_jurnal_dan_mengembalikan_jumlah_tertagih(
        client, auth_headers, db_session, siap):
    from models.finance import Invoice
    from models.purchasing import PurchaseOrderItem

    m, po, item = _po(db_session, siap, qty=100, harga=1000)
    _terima(client, auth_headers, siap, m, po, item, 40)

    r = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': m.id, 'description': m.name,
                   'quantity': 40, 'uom': 'KG', 'unit_price': 1000}]})
    assert r.status_code == 201, r.get_json()
    inv_id = r.get_json()['invoice']['id']
    inv = db.session.get(Invoice, inv_id)

    db_session.refresh(item)
    assert float(item.quantity_invoiced or 0) == 40
    sebelum = AccountingEntry.query.filter_by(reference_type='purchase_invoice',
                                              reference_id=inv_id).count()
    assert sebelum >= 2

    h = client.delete(f'/api/purchasing/purchase-invoices/{inv_id}', headers=auth_headers)
    assert h.status_code == 200, h.get_json()

    assert db.session.get(Invoice, inv_id) is None
    db_session.refresh(item)
    assert float(item.quantity_invoiced or 0) == 0          # PO siap difakturkan ulang

    # jurnal aslinya tetap ada, ditambah jurnal pembaliknya - saldonya nol
    semua = AccountingEntry.query.filter(
        AccountingEntry.reference_id == inv_id,
        AccountingEntry.reference_type.in_(('purchase_invoice', 'void_purchase_invoice'))).all()
    assert len(semua) > sebelum
    assert round(sum(float(e.debit_amount or 0) - float(e.credit_amount or 0) for e in semua), 2) == 0


def test_faktur_yang_sudah_dibayar_tidak_bisa_dihapus(client, auth_headers, db_session, siap):
    from models.finance import Invoice

    m, po, item = _po(db_session, siap, qty=100, harga=1000)
    _terima(client, auth_headers, siap, m, po, item, 10)
    r = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': siap['supplier'].id, 'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': m.id, 'description': m.name,
                   'quantity': 10, 'uom': 'KG', 'unit_price': 1000}]})
    inv_id = r.get_json()['invoice']['id']
    inv = db.session.get(Invoice, inv_id)
    inv.paid_amount = 5000
    db_session.commit()

    h = client.delete(f'/api/purchasing/purchase-invoices/{inv_id}', headers=auth_headers)
    assert h.status_code == 400
    assert 'pembayaran' in h.get_json()['error'].lower()
    assert db.session.get(Invoice, inv_id) is not None
