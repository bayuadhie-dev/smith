#!/usr/bin/env python
r"""
Script to check Production Monitoring, Work Orders, and Weekly Planning data for May 2026

Usage:
    cd backend
    source venv/bin/activate  # or: venv\Scripts\activate on Windows
    python check_may_2026_data.py
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Flask app properly
from flask import Flask
from models import db
from models.production import WorkOrder, ShiftProduction, WeeklyProductionPlan, WeeklyProductionPlanItem
from models.product import Product
from models import Machine
from datetime import datetime, date
from sqlalchemy import func, and_, or_

# Create Flask app instance
app = Flask(__name__)

# Configure database - use instance folder
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

print(f"Using database: {os.path.join(instance_path, 'erp_database.db')}")

db.init_app(app)

def check_may_2026_data():
    with app.app_context():
        print("\n" + "="*80)
        print("CHECKING DATA FOR MAY 2026")
        print("="*80)
        
        # Date range for May 2026
        start_date = date(2026, 5, 1)
        end_date = date(2026, 5, 31)
        
        print(f"\nDate Range: {start_date} to {end_date}")
        
        # ===== 1. WEEKLY PRODUCTION PLANS =====
        print("\n" + "-"*80)
        print("1. WEEKLY PRODUCTION PLANS FOR MAY 2026")
        print("-"*80)
        
        try:
            weekly_plans = WeeklyProductionPlan.query.filter(
                WeeklyProductionPlan.year == 2026,
                or_(
                    and_(
                        WeeklyProductionPlan.week_start >= start_date,
                        WeeklyProductionPlan.week_start <= end_date
                    ),
                    and_(
                        WeeklyProductionPlan.week_end >= start_date,
                        WeeklyProductionPlan.week_end <= end_date
                    )
                )
            ).all()
        except Exception as e:
            print(f"\n  ❌ Error querying weekly_production_plans table: {str(e)}")
            print(f"  💡 Table might not exist. Run: python create_weekly_plan_tables.py")
            weekly_plans = []
        
        if weekly_plans:
            print(f"\nFound {len(weekly_plans)} weekly plan(s):")
            for plan in weekly_plans:
                print(f"\n  Plan: {plan.plan_number}")
                print(f"  Week: {plan.week_number} ({plan.week_start} to {plan.week_end})")
                print(f"  Status: {plan.status}")
                print(f"  Items: {plan.items.count()}")
                
                if plan.items.count() > 0:
                    print(f"\n  Items Detail:")
                    for item in plan.items:
                        product_name = item.product.name if item.product else "Unknown"
                        machine_name = item.machine.name if item.machine else "No Machine"
                        print(f"    - {product_name} | {machine_name} | {item.planned_quantity} {item.uom} | Date: {item.planned_date} | WO: {item.work_order_id}")
        else:
            print("\n  ❌ No weekly plans found for May 2026")
        
        # ===== 2. WORK ORDERS =====
        print("\n" + "-"*80)
        print("2. WORK ORDERS FOR MAY 2026")
        print("-"*80)
        
        try:
            work_orders = WorkOrder.query.filter(
                or_(
                    and_(
                        WorkOrder.scheduled_start_date >= datetime.combine(start_date, datetime.min.time()),
                        WorkOrder.scheduled_start_date <= datetime.combine(end_date, datetime.max.time())
                    ),
                    and_(
                        WorkOrder.required_date >= start_date,
                        WorkOrder.required_date <= end_date
                    )
                )
            ).order_by(WorkOrder.scheduled_start_date).all()
        except Exception as e:
            print(f"\n  ❌ Error querying work_orders table: {str(e)}")
            print(f"  💡 Table might not exist or database path is incorrect")
            work_orders = []
        
        if work_orders:
            print(f"\nFound {len(work_orders)} work order(s):")
            
            # Group by source type
            by_source = {}
            for wo in work_orders:
                source = wo.source_type or 'unknown'
                if source not in by_source:
                    by_source[source] = []
                by_source[source].append(wo)
            
            for source, wos in by_source.items():
                print(f"\n  Source: {source.upper()} ({len(wos)} WOs)")
                for wo in wos:
                    product_name = wo.product.name if wo.product else "Unknown"
                    machine_name = wo.machine.name if wo.machine else "No Machine"
                    print(f"    - {wo.wo_number} | {product_name} | {machine_name}")
                    print(f"      Qty: {wo.quantity} {wo.uom} | Status: {wo.status}")
                    print(f"      Start: {wo.scheduled_start_date} | Required: {wo.required_date}")
                    if wo.notes:
                        # Show first 100 chars of notes
                        notes_preview = wo.notes[:100] + "..." if len(wo.notes) > 100 else wo.notes
                        print(f"      Notes: {notes_preview}")
        else:
            print("\n  ❌ No work orders found for May 2026")
        
        # ===== 3. SHIFT PRODUCTIONS =====
        print("\n" + "-"*80)
        print("3. SHIFT PRODUCTIONS FOR MAY 2026")
        print("-"*80)
        
        try:
            shift_productions = ShiftProduction.query.filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).order_by(ShiftProduction.production_date).all()
        except Exception as e:
            print(f"\n  ❌ Error querying shift_productions table: {str(e)}")
            shift_productions = []
        
        if shift_productions:
            print(f"\nFound {len(shift_productions)} shift production(s):")
            
            # Group by date
            by_date = {}
            for sp in shift_productions:
                date_key = sp.production_date.isoformat()
                if date_key not in by_date:
                    by_date[date_key] = []
                by_date[date_key].append(sp)
            
            for date_key, sps in sorted(by_date.items()):
                print(f"\n  Date: {date_key} ({len(sps)} shifts)")
                for sp in sps:
                    product_name = sp.product.name if sp.product else "Unknown"
                    machine_name = sp.machine.name if sp.machine else "No Machine"
                    print(f"    - {sp.shift} | {product_name} | {machine_name}")
                    print(f"      Good: {sp.good_quantity} | Reject: {sp.reject_quantity} | Target: {sp.target_quantity}")
        else:
            print("\n  ❌ No shift productions found for May 2026")
        
        # ===== 4. PRODUCTION MONITORING TARGETS =====
        print("\n" + "-"*80)
        print("4. PRODUCTION MONITORING TARGETS (from Weekly Plans)")
        print("-"*80)
        
        # Calculate targets from weekly plans
        targets_by_product = {}
        
        for plan in weekly_plans:
            if plan.status not in ['approved', 'in_progress', 'completed']:
                continue
                
            for item in plan.items:
                if not item.product:
                    continue
                
                product_name = item.product.name
                pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
                
                # Convert to cartons
                planned_qty = float(item.planned_quantity or 0)
                if item.uom == 'pcs' and pack_per_ctn > 0:
                    target_ctn = planned_qty / pack_per_ctn
                else:
                    target_ctn = planned_qty
                
                if product_name not in targets_by_product:
                    targets_by_product[product_name] = {
                        'target_ctn': 0,
                        'items': []
                    }
                
                targets_by_product[product_name]['target_ctn'] += target_ctn
                targets_by_product[product_name]['items'].append({
                    'plan': plan.plan_number,
                    'quantity': planned_qty,
                    'uom': item.uom,
                    'machine': item.machine.name if item.machine else 'No Machine'
                })
        
        if targets_by_product:
            print(f"\nTargets by Product:")
            for product_name, data in targets_by_product.items():
                print(f"\n  Product: {product_name}")
                print(f"  Total Target: {data['target_ctn']:.2f} cartons")
                print(f"  From {len(data['items'])} plan item(s):")
                for item in data['items']:
                    print(f"    - {item['plan']}: {item['quantity']} {item['uom']} on {item['machine']}")
        else:
            print("\n  ❌ No targets found from weekly plans")
        
        # ===== 5. SUMMARY =====
        print("\n" + "="*80)
        print("SUMMARY")
        print("="*80)
        print(f"Weekly Plans: {len(weekly_plans)}")
        print(f"Work Orders: {len(work_orders)}")
        print(f"Shift Productions: {len(shift_productions)}")
        print(f"Products with Targets: {len(targets_by_product)}")
        
        # Check for issues
        print("\n" + "-"*80)
        print("POTENTIAL ISSUES")
        print("-"*80)
        
        issues = []
        
        # Check if weekly plans have WOs
        for plan in weekly_plans:
            if plan.status in ['approved', 'in_progress']:
                items_without_wo = [item for item in plan.items if not item.work_order_id]
                if items_without_wo:
                    issues.append(f"Plan {plan.plan_number} has {len(items_without_wo)} items without Work Orders")
        
        # Check if WOs have production data
        for wo in work_orders:
            if wo.status in ['in_progress', 'completed']:
                has_production = ShiftProduction.query.filter_by(work_order_id=wo.id).first()
                if not has_production:
                    issues.append(f"WO {wo.wo_number} (status: {wo.status}) has no production data")
        
        if issues:
            for issue in issues:
                print(f"  ⚠️  {issue}")
        else:
            print("  ✅ No issues found")
        
        print("\n" + "="*80)

if __name__ == '__main__':
    check_may_2026_data()
