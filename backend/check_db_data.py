import sqlite3

db_path = 'instance/erp_database.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== PRODUCTION MODULE ===")
cursor.execute("SELECT COUNT(*) FROM shift_productions")
prod_count = cursor.fetchone()[0]
print(f"Total ShiftProduction records: {prod_count}")
if prod_count > 0:
    cursor.execute("SELECT MIN(production_date), MAX(production_date) FROM shift_productions")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

print("\n=== HR MODULE ===")
cursor.execute("SELECT COUNT(*) FROM employees")
emp_count = cursor.fetchone()[0]
print(f"Total Employee records: {emp_count}")
cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
active_count = cursor.fetchone()[0]
print(f"Active employees: {active_count}")

cursor.execute("SELECT COUNT(*) FROM piecework_logs")
log_count = cursor.fetchone()[0]
print(f"Total PieceworkLog records: {log_count}")
if log_count > 0:
    cursor.execute("SELECT MIN(work_date), MAX(work_date) FROM piecework_logs")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

print("\n=== FINANCE MODULE ===")
cursor.execute("SELECT COUNT(*) FROM invoices")
inv_count = cursor.fetchone()[0]
print(f"Total Invoice records: {inv_count}")
if inv_count > 0:
    cursor.execute("SELECT MIN(invoice_date), MAX(invoice_date) FROM invoices")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

cursor.execute("SELECT COUNT(*) FROM payments")
pay_count = cursor.fetchone()[0]
print(f"Total Payment records: {pay_count}")
if pay_count > 0:
    cursor.execute("SELECT MIN(payment_date), MAX(payment_date) FROM payments")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

cursor.execute("SELECT COUNT(*) FROM accounting_entries")
entry_count = cursor.fetchone()[0]
print(f"Total AccountingEntry records: {entry_count}")
if entry_count > 0:
    cursor.execute("SELECT MIN(entry_date), MAX(entry_date) FROM accounting_entries")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

print("\n=== QUALITY MODULE ===")
cursor.execute("SELECT COUNT(*) FROM quality_inspections")
qc_count = cursor.fetchone()[0]
print(f"Total QualityInspection records: {qc_count}")
if qc_count > 0:
    cursor.execute("SELECT MIN(inspection_date), MAX(inspection_date) FROM quality_inspections")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

print("\n=== SALES MODULE ===")
cursor.execute("SELECT COUNT(*) FROM sales_orders")
so_count = cursor.fetchone()[0]
print(f"Total SalesOrder records: {so_count}")
if so_count > 0:
    cursor.execute("SELECT MIN(order_date), MAX(order_date) FROM sales_orders")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

cursor.execute("SELECT COUNT(*) FROM customers")
cust_count = cursor.fetchone()[0]
print(f"Total Customer records: {cust_count}")
if cust_count > 0:
    cursor.execute("SELECT MIN(created_at), MAX(created_at) FROM customers")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")

conn.close()
