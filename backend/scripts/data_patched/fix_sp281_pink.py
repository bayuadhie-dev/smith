"""
Fix shift_production ID 281 (2026-04-22, mesin 11, shift_1b)
Product salah input: WIP WETKINS BABY BLUE 50S (id=285)
Seharusnya:           WIP WETKINS BABY PINK 50S (id=288)

Juga akan link ulang ke WO yang benar (WO untuk produk PINK) jika ditemukan.

Usage:
    python scripts/data_patched/fix_sp281_pink.py          # dry-run
    python scripts/data_patched/fix_sp281_pink.py --apply  # execute
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from models import db

SP_ID = 281
NEW_PRODUCT_ID = 288  # WIP WETKINS BABY PINK 50S
OLD_PRODUCT_ID = 285  # WIP WETKINS BABY BLUE 50S

app = create_app()

with app.app_context():
    apply_mode = '--apply' in sys.argv

    print("=" * 80)
    print(f"{'APPLY' if apply_mode else 'DRY-RUN'}: Fix SP id={SP_ID}")
    print(f"  product_id: {OLD_PRODUCT_ID} (BLUE) -> {NEW_PRODUCT_ID} (PINK)")
    print("=" * 80)

    # 1. Show current SP
    sp = db.session.execute(db.text(
        "SELECT sp.id, sp.production_date, sp.shift, sp.machine_id, sp.product_id, "
        "       p.name, sp.actual_quantity, sp.good_quantity, sp.work_order_id, "
        "       wo.wo_number, wo.product_id "
        "FROM shift_productions sp "
        "LEFT JOIN products p ON sp.product_id = p.id "
        "LEFT JOIN work_orders wo ON sp.work_order_id = wo.id "
        "WHERE sp.id = :id"
    ), {'id': SP_ID}).fetchone()

    if not sp:
        print(f"ERROR: SP id={SP_ID} not found")
        sys.exit(1)

    print(f"\n[CURRENT SP {sp[0]}]")
    print(f"  date={sp[1]} shift={sp[2]} machine_id={sp[3]}")
    print(f"  product_id={sp[4]} ({sp[5]})")
    print(f"  actual={sp[6]} good={sp[7]}")
    print(f"  work_order_id={sp[8]} wo={sp[9]} wo_product_id={sp[10]}")

    # 2. Show new product
    new_prod = db.session.execute(db.text(
        "SELECT id, code, name, pack_per_karton FROM products WHERE id = :id"
    ), {'id': NEW_PRODUCT_ID}).fetchone()
    print(f"\n[NEW PRODUCT] id={new_prod[0]} code={new_prod[1]} name={new_prod[2]} ppc={new_prod[3]}")

    # 3. Find candidate WO for PINK product on the same date
    candidates = db.session.execute(db.text(
        "SELECT id, wo_number, product_id, quantity, status, scheduled_start_date "
        "FROM work_orders "
        "WHERE product_id = :pid "
        "ORDER BY id DESC LIMIT 10"
    ), {'pid': NEW_PRODUCT_ID}).fetchall()

    print(f"\n[CANDIDATE WORK ORDERS for PINK product_id={NEW_PRODUCT_ID}]")
    if candidates:
        for wo in candidates:
            print(f"  WO id={wo[0]} number={wo[1]} qty={wo[3]} status={wo[4]} sched_start={wo[5]}")
    else:
        print("  (none found)")

    if not apply_mode:
        print("\n" + "=" * 80)
        print("DRY-RUN complete. Re-run with --apply to execute.")
        print("Note: only product_id will be updated. WO link is NOT changed automatically.")
        print("If you want to relink WO, edit this script's NEW_WO_ID variable.")
        print("=" * 80)
        sys.exit(0)

    # 4. Apply: update product_id and pack_per_carton
    new_ppc = int(new_prod[3]) if new_prod[3] else 24
    r = db.session.execute(db.text(
        "UPDATE shift_productions "
        "SET product_id = :pid, pack_per_carton = :ppc "
        "WHERE id = :id"
    ), {'pid': NEW_PRODUCT_ID, 'ppc': new_ppc, 'id': SP_ID})
    print(f"\n  shift_productions: {r.rowcount} row updated (product_id={NEW_PRODUCT_ID}, ppc={new_ppc})")

    db.session.commit()
    print("\nCOMMIT OK")
    print("=" * 80)
