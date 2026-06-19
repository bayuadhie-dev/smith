"""
Sync existing data to WMS Advanced tables.
Populates material_consumptions from work_order_bom_items
and inventory_transactions from inventory_movements.

Run from backend folder:
    python migrations/manual/sync_wms_data.py
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import create_app
from models import db

def sync_material_consumptions():
    """Populate material_consumptions from work_order_bom_items that have actual data"""
    print("\n=== Syncing Material Consumptions ===")
    
    # First check what data exists
    total = db.session.execute(db.text("SELECT COUNT(*) FROM work_order_bom_items")).scalar()
    with_material = db.session.execute(db.text("SELECT COUNT(*) FROM work_order_bom_items WHERE material_id IS NOT NULL")).scalar()
    with_actual = db.session.execute(db.text("SELECT COUNT(*) FROM work_order_bom_items WHERE quantity_actual IS NOT NULL AND quantity_actual > 0")).scalar()
    print(f"  work_order_bom_items: total={total}, with_material_id={with_material}, with_actual_qty={with_actual}")
    
    rows = db.session.execute(db.text("""
        SELECT 
            wb.work_order_id,
            wb.material_id,
            wb.original_bom_item_id,
            wb.quantity_planned,
            wb.quantity_actual,
            wb.quantity_variance,
            wb.uom,
            wb.notes,
            wb.created_at,
            wb.modified_by,
            wb.modified_at,
            wb.item_name,
            wb.item_code
        FROM work_order_bom_items wb
        WHERE wb.quantity_planned IS NOT NULL OR wb.quantity_actual IS NOT NULL
    """)).fetchall()
    
    if not rows:
        print("  No work_order_bom_items found with quantity data.")
        return 0
    
    inserted = 0
    skipped = 0
    
    no_material = 0
    for row in rows:
        work_order_id = row[0]
        material_id = row[1]
        bom_item_id = row[2]
        quantity_planned = float(row[3]) if row[3] else 0
        quantity_actual = float(row[4]) if row[4] else 0
        quantity_variance = float(row[5]) if row[5] else 0
        uom = row[6]
        notes = row[7]
        created_at = row[8]
        modified_by = row[9]
        modified_at = row[10]
        item_name = row[11]
        item_code = row[12]
        
        # material_consumptions requires material_id
        if not material_id:
            no_material += 1
            continue
        
        # Check if already exists
        existing = db.session.execute(db.text("""
            SELECT id FROM material_consumptions 
            WHERE work_order_id = :wo_id AND material_id = :mat_id
        """), {'wo_id': work_order_id, 'mat_id': material_id}).fetchone()
        
        if existing:
            skipped += 1
            continue
        
        # Determine status
        if quantity_actual <= 0:
            status = 'planned'
        elif quantity_actual >= quantity_planned and quantity_planned > 0:
            status = 'completed'
        elif quantity_actual > 0:
            status = 'partial'
        else:
            status = 'planned'
        
        # Calculate variance percentage
        variance_pct = 0
        if quantity_planned > 0:
            variance_pct = round((quantity_actual - quantity_planned) / quantity_planned * 100, 2)
        
        db.session.execute(db.text("""
            INSERT INTO material_consumptions 
                (work_order_id, material_id, bom_item_id, quantity_planned, uom,
                 quantity_actual, variance, variance_percentage, 
                 issued_by, issued_at, status, notes, created_at)
            VALUES 
                (:wo_id, :mat_id, :bom_id, :qty_planned, :uom,
                 :qty_actual, :variance, :variance_pct,
                 :issued_by, :issued_at, :status, :notes, :created_at)
        """), {
            'wo_id': work_order_id,
            'mat_id': material_id,
            'bom_id': bom_item_id,
            'qty_planned': quantity_planned,
            'uom': uom,
            'qty_actual': quantity_actual,
            'variance': quantity_variance if quantity_variance else (quantity_actual - quantity_planned),
            'variance_pct': variance_pct,
            'issued_by': modified_by,
            'issued_at': modified_at,
            'status': status,
            'notes': notes,
            'created_at': created_at or '2026-01-01'
        })
        inserted += 1
    
    db.session.commit()
    print(f"  Inserted: {inserted}, Skipped (already exists): {skipped}, Skipped (no material_id): {no_material}")
    return inserted


def sync_inventory_transactions():
    """Populate inventory_transactions from inventory_movements"""
    print("\n=== Syncing Inventory Transactions ===")
    
    rows = db.session.execute(db.text("""
        SELECT 
            im.id,
            im.product_id,
            im.material_id,
            im.location_id,
            im.movement_type,
            im.movement_date,
            im.quantity,
            im.reference_number,
            im.reference_type,
            im.reference_id,
            im.batch_number,
            im.lot_number,
            im.unit_cost,
            im.total_cost,
            im.quantity_before,
            im.quantity_after,
            im.notes,
            im.created_by,
            im.created_at
        FROM inventory_movements im
        ORDER BY im.id
    """)).fetchall()
    
    if not rows:
        print("  No inventory_movements found.")
        return 0
    
    # Check how many already synced
    existing_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM inventory_transactions"
    )).scalar()
    
    if existing_count > 0:
        print(f"  inventory_transactions already has {existing_count} records.")
        print("  Skipping to avoid duplicates. Delete existing records first if you want to re-sync.")
        return 0
    
    inserted = 0
    
    for row in rows:
        mv_id = row[0]
        product_id = row[1]
        material_id = row[2]
        location_id = row[3]
        movement_type = row[4]
        movement_date = row[5]
        quantity = float(row[6]) if row[6] else 0
        reference_number = row[7]
        reference_type = row[8]
        reference_id = row[9]
        batch_number = row[10]
        lot_number = row[11]
        unit_cost = row[12]
        total_cost = row[13]
        qty_before = row[14]
        qty_after = row[15]
        notes = row[16]
        created_by = row[17]
        created_at = row[18]
        
        # Map movement_type to transaction_type and direction
        type_map = {
            'stock_in': ('goods_receipt', 'in'),
            'stock_out': ('sales_delivery', 'out'),
            'transfer': ('transfer', 'in'),
            'adjust': ('adjustment', 'in'),
            'adjustment': ('adjustment', 'in'),
            'production': ('production_output', 'in'),
            'material_issue': ('material_issue', 'out'),
            'receipt': ('goods_receipt', 'in'),
            'issue': ('material_issue', 'out'),
            'return': ('return', 'in'),
            'scrap': ('scrap', 'out'),
        }
        
        txn_type, direction = type_map.get(movement_type, ('other', 'in'))
        
        # If quantity is negative, flip direction
        if quantity < 0:
            direction = 'out' if direction == 'in' else 'in'
            quantity = abs(quantity)
        
        # Generate transaction number
        txn_number = f"TXN-SYNC-{mv_id:06d}"
        
        # Determine locations
        from_location = location_id if direction == 'out' else None
        to_location = location_id if direction == 'in' else None
        
        # Find work_order_id if reference_type is work_order
        work_order_id = None
        if reference_type == 'work_order':
            work_order_id = reference_id
        
        db.session.execute(db.text("""
            INSERT INTO inventory_transactions 
                (transaction_number, transaction_type, transaction_date,
                 product_id, material_id, quantity, direction,
                 from_location_id, to_location_id,
                 batch_number, lot_number,
                 reference_type, reference_id, reference_number,
                 work_order_id,
                 unit_cost, total_cost,
                 balance_before, balance_after,
                 status, notes, created_by, created_at)
            VALUES 
                (:txn_number, :txn_type, :txn_date,
                 :product_id, :material_id, :quantity, :direction,
                 :from_loc, :to_loc,
                 :batch, :lot,
                 :ref_type, :ref_id, :ref_number,
                 :wo_id,
                 :unit_cost, :total_cost,
                 :bal_before, :bal_after,
                 'completed', :notes, :created_by, :created_at)
        """), {
            'txn_number': txn_number,
            'txn_type': txn_type,
            'txn_date': movement_date or created_at or '2026-01-01',
            'product_id': product_id,
            'material_id': material_id,
            'quantity': quantity,
            'direction': direction,
            'from_loc': from_location,
            'to_loc': to_location,
            'batch': batch_number,
            'lot': lot_number,
            'ref_type': reference_type,
            'ref_id': reference_id,
            'ref_number': reference_number,
            'wo_id': work_order_id,
            'unit_cost': float(unit_cost) if unit_cost else None,
            'total_cost': float(total_cost) if total_cost else None,
            'bal_before': float(qty_before) if qty_before else None,
            'bal_after': float(qty_after) if qty_after else None,
            'notes': notes,
            'created_by': created_by,
            'created_at': created_at or '2026-01-01',
        })
        inserted += 1
        
        # Commit in batches
        if inserted % 500 == 0:
            db.session.commit()
            print(f"  ... {inserted} records inserted")
    
    db.session.commit()
    print(f"  Total inserted: {inserted}")
    return inserted


def main():
    print("=" * 60)
    print("WMS Advanced Data Sync")
    print("Populating WMS tables from existing data")
    print("=" * 60)
    
    app = create_app()
    
    with app.app_context():
        # 1. Sync material consumptions
        mc_count = sync_material_consumptions()
        
        # 2. Sync inventory transactions
        txn_count = sync_inventory_transactions()
        
        print("\n" + "=" * 60)
        print("SYNC COMPLETE")
        print(f"  Material Consumptions: {mc_count} records")
        print(f"  Inventory Transactions: {txn_count} records")
        print("=" * 60)


if __name__ == '__main__':
    main()
