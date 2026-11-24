"""Pemesanan dan pengeluaran bahan baku - satu jalur untuk semua pemanggil.

Dulu seluruh urutannya (pesan FIFO -> keluarkan FIFO -> jurnal) hanya ada di
dalam dua fungsi route di `routes/material_issue.py`. Begitu ada layar lain yang
perlu mengeluarkan bahan - mis. pemakaian bahan di halaman Roll Spunlace -
satu-satunya jalan adalah menyalin ulang, dan salinan itu pasti menyimpang:
jurnalnya terlewat, atau stok dikurangi tanpa pernah dipesan lebih dulu.
"""
from models import db
from models.material_issue import MaterialIssue, MaterialIssueItem
from utils.timezone import get_local_now


class StokKurang(Exception):
    """Bahan tidak cukup untuk dipesan. Tidak ada yang disimpan."""


def pesan_bahan(mi):
    """Pesan (reserve) seluruh baris permintaan secara FIFO. Status -> approved.

    Melempar StokKurang kalau ada bahan yang tidak cukup; pemanggil yang
    memutuskan rollback.
    """
    from utils.fifo_helper import fifo_reserve_stock

    rincian = []
    for item in mi.items:
        if not item.material_id:
            continue
        butuh = float(item.required_quantity) - float(item.issued_quantity or 0)
        if butuh <= 0:
            continue

        hasil = fifo_reserve_stock(material_id=item.material_id, quantity_needed=butuh)
        if not hasil['success']:
            nama = item.material.name if item.material else 'material'
            raise StokKurang(f'Stok {nama} tidak cukup. {hasil["error"]}')

        if hasil['reservations']:
            item.warehouse_location_id = hasil['reservations'][0]['location_id']
            item.batch_number = hasil['reservations'][0]['batch_number']

        rincian.append({
            'material_id': item.material_id,
            'material_name': item.material.name if item.material else None,
            'quantity_reserved': hasil['reserved'],
            'batches': len(hasil['reservations']),
        })
    return rincian


def keluarkan_bahan(mi, user_id, items_to_issue=None):
    """Kurangi stok yang sudah dipesan secara FIFO, lalu catat jurnalnya.

    items_to_issue: [{'item_id', 'quantity'}]; kosong = seluruh sisa baris.
    Mengembalikan (jumlah_baris_keluar, rincian_fifo).
    """
    from utils.fifo_helper import fifo_deduct_stock

    if not items_to_issue:
        items_to_issue = [{'item_id': item.id, 'quantity': float(item.pending_quantity)}
                          for item in mi.items if item.pending_quantity > 0]

    keluar, rincian = 0, []
    for baris in items_to_issue:
        item = db.session.get(MaterialIssueItem, baris['item_id'])
        if not item or item.material_issue_id != mi.id:
            continue

        qty = float(baris.get('quantity', item.pending_quantity))
        if qty <= 0 or qty > float(item.pending_quantity):
            continue

        wo_number = mi.work_order.wo_number if mi.work_order else ''
        hasil = fifo_deduct_stock(
            material_id=item.material_id,
            quantity_needed=qty,
            reference_number=mi.issue_number,
            reference_type='material_issue',
            reference_id=mi.id,
            notes=f'Issued for Work Order {wo_number}',
            user_id=user_id,
            from_reserved=True,
        )

        if not hasil['success']:
            rincian.append({
                'material_id': item.material_id,
                'material_name': item.material.name if item.material else None,
                'error': hasil['error'],
            })
            continue

        item.issued_quantity = float(item.issued_quantity or 0) + hasil['deducted']
        item.unit_cost = hasil['weighted_avg_cost']
        item.total_cost = hasil['total_cost']
        if hasil['movements']:
            item.batch_number = hasil['movements'][0]['batch_number']
            item.warehouse_location_id = hasil['movements'][0]['location_id']
        item.status = 'issued' if item.is_fully_issued else 'partial'
        keluar += 1

        # '_transaction' (baris InventoryTransaction mentah) hanya untuk pemanggil
        # internal yang menambal GL; kalau ikut ke JSON, responsnya gagal diserialisasi.
        rincian.append({
            'material_id': item.material_id,
            'material_name': item.material.name if item.material else None,
            'quantity_issued': hasil['deducted'],
            'batches_used': len(hasil['movements']),
            'weighted_avg_cost': hasil['weighted_avg_cost'],
            'total_cost': hasil['total_cost'],
            'batch_details': [{k: v for k, v in m.items() if k != '_transaction'}
                              for m in hasil['movements']],
        })

    semua = all(item.is_fully_issued for item in mi.items)
    ada = any(item.issued_quantity > 0 for item in mi.items)
    if semua:
        mi.status = 'issued'
        mi.issued_date = get_local_now()
    elif ada:
        mi.status = 'partial'
    mi.issued_by = user_id

    _jurnal_pemakaian(mi, rincian, user_id)
    return keluar, rincian


def _jurnal_pemakaian(mi, rincian, user_id):
    """Dr Persediaan Barang Dalam Proses / Cr Persediaan Bahan Baku.

    Hanya menjurnal yang benar-benar keluar PADA panggilan ini, jadi pengeluaran
    bertahap atas permintaan yang sama tidak terjurnal dua kali. Bahan berbiaya 0
    dilewati - bukan galat - mengikuti kebiasaan "jangan memposting jurnal Rp0
    palsu" yang sudah dipakai di tempat lain.
    """
    total = sum(float(d.get('total_cost') or 0) for d in rincian if 'total_cost' in d)
    if total <= 0:
        return

    from models.approval_workflow import PendingJournalEntry
    from models.finance import GlobalAccountDefault
    from utils.finance_helpers import post_pending_journal, resolve_account

    wip = GlobalAccountDefault.query.filter_by(transaction_key='wip_persediaan').first()
    try:
        akun_persediaan = resolve_account('akun_persediaan_id', product_id=None, category_id=None)
    except ValueError:
        akun_persediaan = None
    if not (wip and akun_persediaan):
        return

    pending = PendingJournalEntry(
        workflow_id=None,
        entry_date=get_local_now().date(),
        description=f'Pemakaian bahan baku - {mi.issue_number}',
        reference=mi.issue_number,
        lines=[
            {'account_id': wip.account_id, 'debit': total, 'credit': 0,
             'description': f'Bahan baku masuk WIP - {mi.issue_number}'},
            {'account_id': akun_persediaan, 'debit': 0, 'credit': total,
             'description': f'Pemakaian persediaan bahan baku - {mi.issue_number}'},
        ],
        total_debit=total,
        total_credit=total,
        created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()
    post_pending_journal(pending.id, posted_by_user_id=user_id,
                         reference_type='material_issue', reference_id=mi.id)
