#!/usr/bin/env python
"""
Check WO Mesin 8 on May 6, 2026 for errors
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction, WorkOrder, Machine
from datetime import datetime

print("=" * 80)
print("CHECKING WO MESIN 8 - MAY 6, 2026")
print("=" * 80)

app = create_app()

with app.app_context():
    # Find Mesin 8
    mesin_8 = Machine.query.filter_by(name='Mesin 8').first()
    
    if not mesin_8:
        print("❌ Mesin 8 not found!")
        print("\nAvailable machines:")
        machines = Machine.query.all()
        for m in machines:
            print(f"  - ID: {m.id}, Name: {m.name}")
        sys.exit(1)
    
    print(f"✅ Found Mesin 8 (ID: {mesin_8.id})")
    
    # Find shift productions on May 6, 2026
    target_date = datetime(2026, 5, 6).date()
    
    shift_productions = ShiftProduction.query.filter(
        ShiftProduction.machine_id == mesin_8.id,
        ShiftProduction.production_date == target_date
    ).all()
    
    print(f"\nFound {len(shift_productions)} shift production records on May 6, 2026")
    print("=" * 80)
    
    if not shift_productions:
        print("❌ No shift production records found!")
        
        # Check nearby dates
        print("\nChecking nearby dates...")
        from datetime import timedelta
        for days_offset in [-1, 0, 1]:
            check_date = target_date + timedelta(days=days_offset)
            nearby = ShiftProduction.query.filter(
                ShiftProduction.machine_id == mesin_8.id,
                ShiftProduction.production_date == check_date
            ).count()
            print(f"  {check_date}: {nearby} records")
        
        sys.exit(0)
    
    # Check each shift production
    for idx, sp in enumerate(shift_productions, 1):
        print(f"\n{'=' * 80}")
        print(f"RECORD #{idx} - ID: {sp.id}")
        print(f"{'=' * 80}")
        
        # Basic info
        print(f"Date: {sp.production_date}")
        print(f"Shift: {sp.shift}")
        print(f"Machine: {sp.machine.name if sp.machine else 'N/A'} (ID: {sp.machine_id})")
        
        # Work Order info
        if sp.work_order_id:
            wo = sp.work_order
            if wo:
                print(f"\n📋 Work Order:")
                print(f"  WO Number: {wo.wo_number}")
                print(f"  Status: {wo.status}")
                print(f"  Product: {wo.product.name if wo.product else 'N/A'}")
                print(f"  Quantity: {wo.quantity} {wo.uom}")
                print(f"  Quantity Produced: {wo.quantity_produced}")
                print(f"  Quantity Good: {wo.quantity_good}")
                print(f"  Pack per Carton: {wo.pack_per_carton or 'N/A'}")
            else:
                print(f"\n❌ Work Order ID {sp.work_order_id} not found in database!")
        else:
            print(f"\n⚠️  No Work Order linked")
        
        # Product info
        if sp.product_id:
            product = sp.product
            if product:
                print(f"\n📦 Product:")
                print(f"  Name: {product.name}")
                print(f"  Code: {product.code}")
            else:
                print(f"\n❌ Product ID {sp.product_id} not found in database!")
        else:
            print(f"\n⚠️  No Product linked")
        
        # Production quantities
        print(f"\n📊 Production Quantities:")
        print(f"  Good Quantity (Grade A): {sp.good_quantity or 0}")
        print(f"  Rework Quantity (Grade B): {sp.rework_quantity or 0}")
        print(f"  Reject Quantity (Grade C): {sp.reject_quantity or 0}")
        print(f"  Actual Quantity: {sp.actual_quantity or 0}")
        print(f"  Pack per Carton: {sp.pack_per_carton or 0}")
        
        # Calculate cartons
        if sp.pack_per_carton and sp.pack_per_carton > 0:
            cartons = sp.good_quantity / sp.pack_per_carton if sp.good_quantity else 0
            print(f"  Cartons (Grade A): {cartons:.2f} ctn")
        
        # Time metrics
        print(f"\n⏱️  Time Metrics:")
        print(f"  Planned Runtime: {sp.planned_runtime or 0} minutes")
        print(f"  Downtime Mesin: {sp.downtime_mesin or 0} minutes")
        print(f"  Downtime Operator: {sp.downtime_operator or 0} minutes")
        print(f"  Downtime Material: {sp.downtime_material or 0} minutes")
        print(f"  Downtime Design: {sp.downtime_design or 0} minutes")
        print(f"  Downtime Others: {sp.downtime_others or 0} minutes")
        print(f"  Idle Time: {sp.idle_time or 0} minutes")
        
        total_downtime = (sp.downtime_mesin or 0) + (sp.downtime_operator or 0) + \
                        (sp.downtime_material or 0) + (sp.downtime_design or 0) + \
                        (sp.downtime_others or 0)
        runtime = (sp.planned_runtime or 0) - total_downtime - (sp.idle_time or 0)
        
        print(f"  Total Downtime: {total_downtime} minutes")
        print(f"  Calculated Runtime: {runtime} minutes")
        
        # Downtime issues
        if sp.issues:
            print(f"\n🔧 Downtime Issues:")
            issues = sp.issues.split('\n')
            for issue in issues:
                if issue.strip():
                    print(f"  - {issue.strip()}")
        
        # Check for errors
        print(f"\n🔍 Error Checks:")
        errors = []
        
        if not sp.work_order_id:
            errors.append("⚠️  No Work Order linked")
        elif not sp.work_order:
            errors.append("❌ Work Order not found in database")
        
        if not sp.product_id:
            errors.append("⚠️  No Product linked")
        elif not sp.product:
            errors.append("❌ Product not found in database")
        
        if not sp.good_quantity and not sp.actual_quantity:
            errors.append("⚠️  No production quantity recorded")
        
        if sp.planned_runtime and sp.planned_runtime <= 0:
            errors.append("❌ Invalid planned runtime")
        
        if total_downtime > (sp.planned_runtime or 0):
            errors.append("❌ Total downtime exceeds planned runtime")
        
        if runtime < 0:
            errors.append("❌ Calculated runtime is negative")
        
        if errors:
            for error in errors:
                print(f"  {error}")
        else:
            print(f"  ✅ No errors found")
    
    print("\n" + "=" * 80)
    print("CHECK COMPLETED")
    print("=" * 80)
