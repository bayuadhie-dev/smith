"""Perpindahan karantina QC tidak ikut tampil di daftar Transaksi Stok.

Masukan Finance 2026-11-20: satu penerimaan yang diperiksa QC memunculkan
sepasang baris transfer_out + transfer_in dengan jumlah sama di detik yang sama.
Barangnya tidak pernah benar-benar keluar masuk - itu hanya pindah rak - jadi
barisnya cuma bikin daftar ramai.
"""
from datetime import datetime


def _txn(db_session, test_material, **kw):
    from models.wms_advanced import InventoryTransaction
    data = dict(material_id=test_material.id, quantity=228.7, transaction_date=datetime(2026, 11, 20),
                transaction_number=f"TRX-{kw.get('transaction_type')}-{kw.get('reference_type')}")
    data.update(kw)
    t = InventoryTransaction(**data)
    db_session.add(t)
    db_session.commit()
    return t


def test_pasangan_karantina_disembunyikan(client, auth_headers, db_session, test_material):
    _txn(db_session, test_material, transaction_type='transfer_out', direction='out', reference_type='grn_inspection')
    _txn(db_session, test_material, transaction_type='transfer_in', direction='in', reference_type='grn_inspection')
    _txn(db_session, test_material, transaction_type='receipt', direction='in', reference_type='grn')

    r = client.get('/api/wms/transactions', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    jenis = [t['transaction_type'] for t in r.get_json()['transactions']]
    assert 'receipt' in jenis
    assert 'transfer_in' not in jenis and 'transfer_out' not in jenis


def test_pindah_gudang_sungguhan_tetap_tampil(client, auth_headers, db_session, test_material):
    """transfer_in/out dari Transfer Stok antar gudang bukan noise - harus tetap kelihatan."""
    _txn(db_session, test_material, transaction_type='transfer_out', direction='out', reference_type='stock_transfer')

    r = client.get('/api/wms/transactions', headers=auth_headers)
    jenis = [t['transaction_type'] for t in r.get_json()['transactions']]
    assert 'transfer_out' in jenis


def test_masih_bisa_dilihat_kalau_diminta(client, auth_headers, db_session, test_material):
    _txn(db_session, test_material, transaction_type='transfer_in', direction='in', reference_type='grn_inspection')

    r = client.get('/api/wms/transactions?include_internal=1', headers=auth_headers)
    jenis = [t['transaction_type'] for t in r.get_json()['transactions']]
    assert 'transfer_in' in jenis
