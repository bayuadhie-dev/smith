#!/usr/bin/env python3
"""Check Weekly Production Plan for May 2026"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem
from datetime import date

app = create_app()

with app.app_context():
    print("=" * 80)
    print("CHECKING WEEKLY PRODUCTION PLAN FOR MAY 2026")
    print("=" * 80)
    
    # Check all weekly plans for May 2026
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= date(2026, 5, 1),
        WeeklyProductionPlan.week_start <= date(2026, 5, 31)
    ).all()
    
    print(f"\nFound {len(plans)} weekly plans for May 2026\n")
    
    for plan in plans:
        print(f"Plan ID: {plan.id}")
        print(f"  Week: {plan.week_number}")
        print(f"  Period: {plan.week_start} to {plan.week_end}")
        print(f"  Status: {plan.status}")
        print(f"  Year: {plan.year}")
        
        items = list(plan.items)
        print(f"  Items count: {len(items)}")
        
        if items:
            print(f"  Products:")
            for item in items:
                try:
                    product_name = item.product.name if item.product else f"Product {item.product_id}"
                    machine_name = item.machine.name if item.machine else "No machine"
                    print(f"    - {product_name}")
                    print(f"      Machine: {machine_name}")
                    print(f"      Planned Qty: {item.planned_quantity} {item.uom}")
                    
                    pack_per_ctn = None
                    try:
                        if item.product and item.product.pack_per_karton:
                            pack_per_ctn = int(item.product.pack_per_karton)
                    except:
                        pass
                    
                    print(f"      Pack/Ctn: {pack_per_ctn if pack_per_ctn else 'N/A'}")
                    
                    if pack_per_ctn and pack_per_ctn > 0:
                        if item.uom == 'pcs':
                            target_ctn = item.planned_quantity / pack_per_ctn
                        else:
                            target_ctn = item.planned_quantity
                        print(f"      Target (ctn): {target_ctn:.2f}")
                    else:
                        print(f"      Target (ctn): N/A (no pack_per_karton)")
                    
                    print(f"      Planned Days: {item.planned_days}")
                    print(f"      Planned Shifts: {item.planned_shifts}")
                except Exception as e:
                    print(f"    ERROR processing item: {e}")
        print()
    
    print("=" * 80)
    
    # Also check MonthlySchedule
    from routes.schedule_grid import MonthlySchedule
    
    monthly = MonthlySchedule.query.filter_by(year=2026, month=5).all()
    print(f"\nFound {len(monthly)} monthly schedules for May 2026\n")
    
    for ms in monthly:
        product_data = db.session.execute(
            db.text("SELECT name, pack_per_karton FROM products WHERE id = :id"),
            {'id': ms.product_id}
        ).fetchone()
        
        product_name = product_data[0] if product_data else f"Product {ms.product_id}"
        machine_name = ms.machine.name if ms.machine else "No machine"
        
        print(f"Product: {product_name}")
        print(f"  Machine: {machine_name}")
        print(f"  Target: {ms.target_ctn} ctn")
        print()
