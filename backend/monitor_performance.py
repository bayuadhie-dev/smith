"""
Database Performance Monitoring Script
Run this script to monitor database query performance before/after indexing
"""

import sqlite3
import time
from datetime import datetime
import json
import os

# Database path
DB_PATH = 'instance/erp_database.db'
RESULTS_FILE = 'performance_results.json'

def get_connection():
    """Get database connection"""
    return sqlite3.connect(DB_PATH)

def test_query(cursor, query, description, runs=5):
    """Test a query multiple times and return average time"""
    times = []
    row_counts = []
    
    for i in range(runs):
        start = time.time()
        cursor.execute(query)
        results = cursor.fetchall()
        elapsed = time.time() - start
        times.append(elapsed)
        row_counts.append(len(results))
    
    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)
    avg_rows = sum(row_counts) / len(row_counts)
    
    return {
        'description': description,
        'query': query,
        'avg_time_ms': round(avg_time * 1000, 2),
        'min_time_ms': round(min_time * 1000, 2),
        'max_time_ms': round(max_time * 1000, 2),
        'avg_rows': round(avg_rows, 2),
        'runs': runs
    }

def check_indexes(cursor):
    """Check all indexes in database"""
    cursor.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name;")
    indexes = cursor.fetchall()
    
    index_by_table = {}
    for idx_name, tbl_name in indexes:
        if tbl_name not in index_by_table:
            index_by_table[tbl_name] = []
        index_by_table[tbl_name].append(idx_name)
    
    return {
        'total_indexes': len(indexes),
        'indexes_by_table': index_by_table
    }

def check_table_sizes(cursor):
    """Check table row counts"""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = cursor.fetchall()
    
    table_sizes = {}
    for (table_name,) in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            table_sizes[table_name] = count
        except:
            pass
    
    return table_sizes

def get_query_plan(cursor, query):
    """Get EXPLAIN QUERY PLAN for a query"""
    try:
        cursor.execute(f"EXPLAIN QUERY PLAN {query}")
        plan = cursor.fetchall()
        return [str(row) for row in plan]
    except Exception as e:
        return [f"Error: {str(e)}"]

def run_performance_test():
    """Run complete performance test"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("DATABASE PERFORMANCE MONITORING")
    print("=" * 80)
    print(f"Database: {DB_PATH}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    # Check indexes
    print("1. CHECKING INDEXES...")
    index_info = check_indexes(cursor)
    print(f"   Total indexes: {index_info['total_indexes']}")
    print(f"   Tables with indexes: {len(index_info['indexes_by_table'])}")
    print()
    
    # Check table sizes
    print("2. CHECKING TABLE SIZES...")
    table_sizes = check_table_sizes(cursor)
    print(f"   Total tables: {len(table_sizes)}")
    large_tables = {k: v for k, v in table_sizes.items() if v > 1000}
    print(f"   Tables with >1000 rows: {len(large_tables)}")
    for table, count in sorted(large_tables.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"     - {table}: {count:,} rows")
    print()
    
    # Define test queries
    test_queries = [
        # Work Orders
        ("Work Orders - Status Filter", "SELECT * FROM work_orders WHERE status = 'in_progress';"),
        ("Work Orders - Machine Filter", "SELECT * FROM work_orders WHERE machine_id = 1;"),
        ("Work Orders - Date Range", "SELECT * FROM work_orders WHERE scheduled_start_date >= date('now', '-7 days');"),
        
        # Inventory
        ("Inventory - Status Filter", "SELECT * FROM inventory WHERE stock_status = 'released';"),
        ("Inventory - Product Filter", "SELECT * FROM inventory WHERE product_id = 1;"),
        ("Inventory - Material Filter", "SELECT * FROM inventory WHERE material_id = 1;"),
        
        # Sales Orders
        ("Sales Orders - Customer Filter", "SELECT * FROM sales_orders WHERE customer_id = 1;"),
        ("Sales Orders - Status Filter", "SELECT * FROM sales_orders WHERE status = 'pending';"),
        
        # Invoices
        ("Invoices - Customer Filter", "SELECT * FROM invoices WHERE customer_id = 1;"),
        ("Invoices - Status Filter", "SELECT * FROM invoices WHERE status = 'paid';"),
        
        # Employees
        ("Employees - Department Filter", "SELECT * FROM employees WHERE department_id = 1;"),
        ("Employees - Active Filter", "SELECT * FROM employees WHERE is_active = 1;"),
        
        # Attendances
        ("Attendances - User Filter", "SELECT * FROM attendances WHERE user_id = 1;"),
        ("Attendances - Date Filter", "SELECT * FROM attendances WHERE attendance_date >= date('now', '-30 days');"),
        
        # Production Records
        ("Production Records - Date Filter", "SELECT * FROM production_records WHERE production_date >= date('now', '-7 days');"),
        
        # Machines
        ("Machines - Status Filter", "SELECT * FROM machines WHERE status = 'running';"),
    ]
    
    # Run query tests
    print("3. TESTING QUERY PERFORMANCE...")
    results = []
    for description, query in test_queries:
        try:
            result = test_query(cursor, query, description, runs=3)
            results.append(result)
            print(f"   {description}:")
            print(f"     Avg: {result['avg_time_ms']}ms | Min: {result['min_time_ms']}ms | Max: {result['max_time_ms']}ms | Rows: {result['avg_rows']}")
        except Exception as e:
            print(f"   {description}: ERROR - {str(e)}")
    print()
    
    # Get query plans for slow queries
    print("4. QUERY PLAN ANALYSIS FOR SLOW QUERIES (>10ms)...")
    slow_queries = [r for r in results if r['avg_time_ms'] > 10]
    for result in slow_queries[:5]:  # Top 5 slow queries
        print(f"   {result['description']}:")
        plan = get_query_plan(cursor, result['query'])
        for line in plan[:3]:  # Show first 3 lines
            print(f"     {line}")
    print()
    
    # Save results
    output = {
        'timestamp': datetime.now().isoformat(),
        'database': DB_PATH,
        'index_info': index_info,
        'table_sizes': table_sizes,
        'query_results': results,
        'slow_queries_count': len(slow_queries)
    }
    
    # Load existing results if file exists
    existing_results = []
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, 'r') as f:
            existing_results = json.load(f)
    
    # Append new results
    if isinstance(existing_results, list):
        existing_results.append(output)
    else:
        existing_results = [output]
    
    # Save results
    with open(RESULTS_FILE, 'w') as f:
        json.dump(existing_results, f, indent=2)
    
    print(f"5. RESULTS SAVED TO: {RESULTS_FILE}")
    print(f"   Total test runs in history: {len(existing_results)}")
    print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total indexes: {index_info['total_indexes']}")
    print(f"Queries tested: {len(results)}")
    print(f"Slow queries (>10ms): {len(slow_queries)}")
    if results:
        avg_all = sum(r['avg_time_ms'] for r in results) / len(results)
        print(f"Average query time: {avg_all:.2f}ms")
    print()
    
    conn.close()
    
    return output

def compare_results():
    """Compare performance results from different runs"""
    if not os.path.exists(RESULTS_FILE):
        print("No performance results found. Run performance test first.")
        return
    
    with open(RESULTS_FILE, 'r') as f:
        results = json.load(f)
    
    if len(results) < 2:
        print("Need at least 2 test runs to compare. Run performance test again.")
        return
    
    print("=" * 80)
    print("PERFORMANCE COMPARISON")
    print("=" * 80)
    
    # Compare first and last run
    first = results[0]
    last = results[-1]
    
    print(f"First run: {first['timestamp']}")
    print(f"Last run: {last['timestamp']}")
    print()
    
    # Compare query times
    first_queries = {q['description']: q['avg_time_ms'] for q in first['query_results']}
    last_queries = {q['description']: q['avg_time_ms'] for q in last['query_results']}
    
    print("Query Performance Changes:")
    for desc in first_queries:
        if desc in last_queries:
            first_time = first_queries[desc]
            last_time = last_queries[desc]
            change = last_time - first_time
            percent_change = (change / first_time * 100) if first_time > 0 else 0
            
            if abs(change) > 1:  # Only show significant changes
                status = "✓ IMPROVED" if change < 0 else "✗ SLOWER"
                print(f"  {desc}:")
                print(f"    {first_time:.2f}ms → {last_time:.2f}ms ({change:+.2f}ms, {percent_change:+.1f}%) {status}")
    
    print()
    print(f"Indexes before: {first['index_info']['total_indexes']}")
    print(f"Indexes after: {last['index_info']['total_indexes']}")
    print(f"Indexes added: {last['index_info']['total_indexes'] - first['index_info']['total_indexes']}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'compare':
        compare_results()
    else:
        run_performance_test()
