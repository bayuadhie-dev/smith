"""
Fix pack_per_karton untuk WETKINS BABY BLUE 50S BND @12X2 (product_id=67)
dari 24 menjadi 12 di:
  1. products table
  2. work_orders table (semua WO dengan product_id=67)
  3. shift_productions table (semua SP dengan product_id=67)

Usage:
    python scripts/data_patched/fix_wetkins_blue_ppc.py          # dry-run (preview)
    python scripts/data_patched/fix_wetkins_blue_ppc.py --apply  # execute
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from models import db

TARGET_PRODUCT_ID = 67
NEW_PPC = 12
OLD_PPC = 24

app = create_app()

with app.app_context():
    apply_mode = '--apply' in sys.argv

    print("=" * 80)
    print(f"{'APPLY' if apply_mode else 'DRY-RUN'}: Fix pack_per_karton for product_id={TARGET_PRODUCT_ID}")
    print(f"  From {OLD_PPC} -> {NEW_PPC}")
    print("=" * 80)

    # 1. Preview product
    product = db.session.execute(db.text(
        "SELECT id, code, name, pack_per_karton FROM products WHERE id = :id"
    ), {'id': TARGET_PRODUCT_ID}).fetchone()

    if not product:
        print(f"ERROR: Product id={TARGET_PRODUCT_ID} not found")
        sys.exit(1)

    print(f"\n[PRODUCT] id={product[0]} code={product[1]} name={product[2]}")
    print(f"  Current pack_per_karton = {product[3]}")
    print(f"  Will change to = {NEW_PPC}")

    # 2. Preview work_orders
    wos = db.session.execute(db.text(
        "SELECT id, wo_number, pack_per_carton, quantity FROM work_orders "
        "WHERE product_id = :pid"
    ), {'pid': TARGET_PRODUCT_ID}).fetchall()

    print(f"\n[WORK_ORDERS] {len(wos)} rows with product_id={TARGET_PRODUCT_ID}")
    for wo in wos[:10]:
        print(f"  WO id={wo[0]} number={wo[1]} current_ppc={wo[2]} qty={wo[3]}")
    if len(wos) > 10:
        print(f"  ... and {len(wos) - 10} more")

    # 3. Preview shift_productions
    sps = db.session.execute(db.text(
        "SELECT id, production_date, shift, pack_per_carton, actual_quantity "
        "FROM shift_productions WHERE product_id = :pid"
    ), {'pid': TARGET_PRODUCT_ID}).fetchall()

    print(f"\n[SHIFT_PRODUCTIONS] {len(sps)} rows with product_id={TARGET_PRODUCT_ID}")
    for sp in sps[:10]:
        print(f"  SP id={sp[0]} date={sp[1]} shift={sp[2]} current_ppc={sp[3]} actual={sp[4]}")
    if len(sps) > 10:
        print(f"  ... and {len(sps) - 10} more")

    if not apply_mode:
        print("\n" + "=" * 80)
        print("DRY-RUN complete. Re-run with --apply to execute changes.")
        print("=" * 80)
        sys.exit(0)

    # 4. Apply updates
    print("\n" + "=" * 80)
    print("APPLYING UPDATES...")
    print("=" * 80)

    r1 = db.session.execute(db.text(
        "UPDATE products SET pack_per_karton = :new WHERE id = :id"
    ), {'new': str(NEW_PPC), 'id': TARGET_PRODUCT_ID})
    print(f"  products: {r1.rowcount} rows updated")

    r2 = db.session.execute(db.text(
        "UPDATE work_orders SET pack_per_carton = :new WHERE product_id = :pid"
    ), {'new': NEW_PPC, 'pid': TARGET_PRODUCT_ID})
    print(f"  work_orders: {r2.rowcount} rows updated")

    r3 = db.session.execute(db.text(
        "UPDATE shift_productions SET pack_per_carton = :new WHERE product_id = :pid"
    ), {'new': NEW_PPC, 'pid': TARGET_PRODUCT_ID})
    print(f"  shift_productions: {r3.rowcount} rows updated")

    db.session.commit()
    print("\nCOMMIT OK")
    print("=" * 80)
