"""
Fix production_records yang berkaitan dengan SP 281
(2026-04-22, mesin 11, shift_1, WO 210, qty=5630)

Awalnya SP 281 sudah di-update product_id=288 (PINK).
Sekarang lengkapi dengan update production_records yang sesuai.

Logic: cari production_records dengan
  - work_order_id = 210
  - production_date = 2026-04-22
  - shift = shift_1 (atau 1)
  - quantity_produced = 5630
Kemudian update product_id = 288.

Usage:
    python scripts/data_patched/fix_pr_281_pink.py          # dry-run
    python scripts/data_patched/fix_pr_281_pink.py --apply  # execute
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from models import db

WO_ID = 210
PROD_DATE = '2026-04-22'
TARGET_QTY = 5630
NEW_PRODUCT_ID = 288  # WIP WETKINS BABY PINK 50S
OLD_PRODUCT_ID = 285  # WIP WETKINS BABY BLUE 50S

app = create_app()

with app.app_context():
    apply_mode = '--apply' in sys.argv

    print("=" * 80)
    print(f"{'APPLY' if apply_mode else 'DRY-RUN'}: Fix production_records linked to WO {WO_ID}")
    print(f"  Find PR with date={PROD_DATE}, quantity_produced={TARGET_QTY}")
    print(f"  Update product_id: {OLD_PRODUCT_ID} (BLUE) -> {NEW_PRODUCT_ID} (PINK)")
    print("=" * 80)

    # Show all PR for this WO
    rows = db.session.execute(db.text(
        "SELECT id, work_order_id, product_id, production_date, shift, "
        "       quantity_produced, quantity_good, quantity_scrap, downtime_minutes "
        "FROM production_records WHERE work_order_id = :wo "
        "ORDER BY id"
    ), {'wo': WO_ID}).fetchall()

    print(f"\n[ALL PR for WO {WO_ID}] {len(rows)} rows")
    target_pr_id = None
    for r in rows:
        is_target = (str(r[3]).startswith(PROD_DATE) and float(r[5] or 0) == float(TARGET_QTY))
        marker = ' <-- TARGET' if is_target else ''
        print(f"  PR id={r[0]} date={r[3]} shift={r[4]} product_id={r[2]} "
              f"produced={r[5]} good={r[6]} scrap={r[7]} dt={r[8]}{marker}")
        if is_target:
            target_pr_id = r[0]

    if not target_pr_id:
        print("\nERROR: No matching production_record found.")
        print("Check the data manually or adjust WO_ID/PROD_DATE/TARGET_QTY in this script.")
        sys.exit(1)

    print(f"\n[TARGET] PR id={target_pr_id} will be updated product_id -> {NEW_PRODUCT_ID}")

    if not apply_mode:
        print("\n" + "=" * 80)
        print("DRY-RUN complete. Re-run with --apply to execute.")
        print("=" * 80)
        sys.exit(0)

    # Apply
    r = db.session.execute(db.text(
        "UPDATE production_records SET product_id = :pid WHERE id = :id"
    ), {'pid': NEW_PRODUCT_ID, 'id': target_pr_id})
    print(f"\n  production_records: {r.rowcount} row updated")

    db.session.commit()
    print("\nCOMMIT OK")
    print("=" * 80)
