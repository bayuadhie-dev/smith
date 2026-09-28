"""
Reconcile Stock Accuracy
=========================
Read-only report script (2026-09-28) - verifies whether the "quantity_on_hand
punya known pre-existing accuracy issue" note (originally written 2026-09-11
in close_accounting_period()'s docstring, backend/routes/finance.py) is
still true, or whether it was actually resolved by the phantom-stock fix in
commit b962bb5 (2026-09-20, "phantom stock on batch-omitted transfer" -
execute_transfer() in routes/wms_advanced.py).

Does NOT write anything to the database - this is diagnostic only. Run
manually once the DB is reachable:

    cd backend && python scripts/reconcile_stock_accuracy.py

Three checks, each targeting a different angle of the same underlying
concern (there is no historical snapshot of quantity_on_hand to diff
against, so a full from-zero ledger reconstruction isn't reliable for data
older than the unified InventoryTransaction ledger - these checks are
deliberately scoped to what CAN be verified without that baseline):

1. Negative stock - Inventory.quantity_on_hand < 0 right now. Same query
   as utils/finance_helpers.get_negative_stock_items() (Closing Period's
   advisory check), run standalone here for a full report rather than
   just what's shown in one close attempt.

2. Historical phantom-stock risk (retroactive) - InventoryTransaction rows
   with transaction_type='transfer' and batch_number IS NULL, where the
   ORIGIN location (from_location_id) has an existing Inventory row for
   the same item with batch_number SET. This is the exact fingerprint of
   the pre-fix bug: the transfer item omitted batch_number, so the source
   Inventory lookup (which used to always filter by
   Inventory.batch_number == item.batch_number, i.e. == None) silently
   matched nothing and skipped the deduction, while the destination was
   still created with the full quantity. Any row matching this pattern
   dated BEFORE the fix (2026-09-20) was very likely affected; rows dated
   after are just flagged for awareness (the code path no longer has this
   bug, but the transfer item genuinely didn't specify a batch, which is
   worth a human glance either way).

3. Going-forward phantom-stock marker - InventoryTransaction rows whose
   notes contain the explicit warning text routes/wms_advanced.py's
   execute_transfer() now writes (2026-09-28 fix) when NO source Inventory
   row exists at all (a different root cause than #2 - not a batch
   mismatch, just a missing source row entirely - a residual gap in the
   same function that the 2026-09-20 fix didn't close). Any hit here is a
   real, current occurrence, not a historical guess.

Interpretation:
- If check 2 AND 3 both come back empty: strong evidence the "known
  accuracy issue" was specifically this phantom-stock bug and it's been
  closed - safe to consider upgrading Closing Period's negative-stock
  warning from advisory to a harder block in a future change.
- If either comes back non-empty: those specific items/locations need
  manual investigation (a real Stock Opname is the authoritative fix for
  any item flagged here, not blindly trusting the ledger OR the
  Inventory row).
"""
import sys

sys.path.insert(0, '.')

from app import create_app
from models import db
from models.warehouse import Inventory
from models.wms_advanced import InventoryTransaction
from models.product import Product, Material

PHANTOM_STOCK_MARKER = 'phantom stock'
PRE_FIX_DATE = '2026-09-20'  # commit b962bb5


def _item_label(product_id, material_id):
    if product_id:
        p = db.session.get(Product, product_id)
        return f'[Produk] {p.name if p else f"#{product_id}"}'
    if material_id:
        m = db.session.get(Material, material_id)
        return f'[Bahan] {m.name if m else f"#{material_id}"}'
    return '(item tidak diketahui)'


def check_negative_stock():
    print('\n=== 1. STOK NEGATIF (saat ini) ===')
    rows = Inventory.query.filter(Inventory.quantity_on_hand < 0).all()
    if not rows:
        print('  Tidak ada. Bersih.')
        return
    for inv in rows:
        label = _item_label(inv.product_id, inv.material_id)
        print(f'  - {label} @ location_id={inv.location_id} batch={inv.batch_number or "-"}: {inv.quantity_on_hand}')
    print(f'  Total: {len(rows)} baris.')


def check_historical_phantom_risk():
    print('\n=== 2. RISIKO PHANTOM STOCK HISTORIS (transfer tanpa batch_number, sebelum fix 2026-09-20) ===')
    suspects = InventoryTransaction.query.filter(
        InventoryTransaction.transaction_type == 'transfer',
        InventoryTransaction.batch_number.is_(None),
    ).all()

    flagged = []
    for txn in suspects:
        # Cek apakah ADA baris Inventory di lokasi asal untuk item yang sama
        # dengan batch_number TERISI - itu fingerprint bug pre-fix (lihat
        # docstring atas).
        query = Inventory.query.filter(
            Inventory.location_id == txn.from_location_id,
            Inventory.batch_number.isnot(None),
        )
        if txn.product_id:
            query = query.filter(Inventory.product_id == txn.product_id)
        elif txn.material_id:
            query = query.filter(Inventory.material_id == txn.material_id)
        else:
            continue

        if query.first():
            flagged.append(txn)

    if not flagged:
        print('  Tidak ada transaksi transfer yang cocok pola bug ini. Bersih.')
        return

    for txn in flagged:
        label = _item_label(txn.product_id, txn.material_id)
        before_fix = txn.transaction_date and txn.transaction_date.date().isoformat() < PRE_FIX_DATE
        tag = 'KEMUNGKINAN BESAR TERDAMPAK' if before_fix else 'setelah fix, cuma info'
        print(f'  - [{tag}] {txn.transaction_number} ({txn.transaction_date}) {label}: '
              f'{txn.from_location_id} -> {txn.to_location_id}, qty={txn.quantity}, ref={txn.reference_number}')
    print(f'  Total: {len(flagged)} transaksi dicurigai.')


def check_going_forward_marker():
    print('\n=== 3. PENANDA PHANTOM STOCK LIVE (baris sumber hilang total, sejak fix 2026-09-28) ===')
    rows = InventoryTransaction.query.filter(
        InventoryTransaction.notes.ilike(f'%{PHANTOM_STOCK_MARKER}%')
    ).all()
    if not rows:
        print('  Tidak ada. Bersih (atau fix 2026-09-28 belum pernah kena kasus ini).')
        return
    for txn in rows:
        label = _item_label(txn.product_id, txn.material_id)
        print(f'  - {txn.transaction_number} ({txn.transaction_date}) {label}: {txn.notes}')
    print(f'  Total: {len(rows)} transaksi.')


def run():
    app = create_app()
    with app.app_context():
        check_negative_stock()
        check_historical_phantom_risk()
        check_going_forward_marker()
        print('\nSelesai. Ini laporan read-only - tidak ada data yang diubah.')


if __name__ == '__main__':
    run()
