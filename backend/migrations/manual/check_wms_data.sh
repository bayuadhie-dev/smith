#!/bin/bash
# Run this on the server: bash migrations/manual/check_wms_data.sh
DB="instance/erp_database.db"

echo "=== work_order_bom_items ==="
echo "Total rows:"
sqlite3 "$DB" "SELECT COUNT(*) FROM work_order_bom_items;"

echo "With material_id:"
sqlite3 "$DB" "SELECT COUNT(*) FROM work_order_bom_items WHERE material_id IS NOT NULL;"

echo "With quantity_planned:"
sqlite3 "$DB" "SELECT COUNT(*) FROM work_order_bom_items WHERE quantity_planned IS NOT NULL AND CAST(quantity_planned AS REAL) > 0;"

echo "With quantity_actual > 0:"
sqlite3 "$DB" "SELECT COUNT(*) FROM work_order_bom_items WHERE quantity_actual IS NOT NULL AND CAST(quantity_actual AS REAL) > 0;"

echo ""
echo "Sample rows (first 5):"
sqlite3 -header -column "$DB" "SELECT id, work_order_id, material_id, item_name, item_code, quantity_planned, quantity_actual, uom FROM work_order_bom_items LIMIT 5;"

echo ""
echo "=== material_consumptions ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM material_consumptions;"

echo ""
echo "=== inventory_transactions ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM inventory_transactions;"

echo ""
echo "=== inventory_movements ==="
sqlite3 "$DB" "SELECT COUNT(*) FROM inventory_movements;"

echo ""
echo "=== WO with BOM items ==="
sqlite3 -header -column "$DB" "SELECT wb.work_order_id, wo.wo_number, COUNT(*) as bom_items FROM work_order_bom_items wb JOIN work_orders wo ON wb.work_order_id = wo.id GROUP BY wb.work_order_id ORDER BY wb.work_order_id DESC LIMIT 10;"
