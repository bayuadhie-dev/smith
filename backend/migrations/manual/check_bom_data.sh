#!/bin/bash
DB="instance/erp_database.db"

echo "=== bill_of_materials ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM bill_of_materials;"

echo ""
echo "=== bom_items ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM bom_items;"

echo ""
echo "=== Sample bom_items (5) ==="
sqlite3 -header -column "$DB" "SELECT bi.id, bi.bom_id, bi.material_id, bi.item_name, bi.quantity, bi.uom FROM bom_items bi LIMIT 5;"

echo ""
echo "=== Work Orders with bom_id ==="
sqlite3 -header -column "$DB" "SELECT id, wo_number, bom_id, product_id, status FROM work_orders WHERE bom_id IS NOT NULL LIMIT 10;"

echo ""
echo "=== Work Orders without bom_id ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM work_orders WHERE bom_id IS NULL;"

echo ""
echo "=== Total Work Orders ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM work_orders;"
