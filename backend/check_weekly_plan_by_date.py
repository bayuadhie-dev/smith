#!/usr/bin/env python3
"""Check Weekly Plan items grouped by date"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan

app = create_app()

with app.app_context():
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    print("=" * 80)
    print(f"Plan: {plan.plan_number}")
    print(f"Week: {plan.week_start} to {plan.week_end}")
    print("=" * 80)
    
    # Group by product and date
    items_by_product = {}
    
    for item in plan.items.all():
        product_name = item.product.name if item.product else "Unknown"
        planned_date = item.planned_date if item.planned_date else "No Date"
        
        if product_name not in items_by_product:
            items_by_product[product_name] = []
        
        items_by_product[product_name].append({
            'id': item.id,
            'date': planned_date,
            'quantity': float(item.planned_quantity or 0),
            'uom': item.uom
        })
    
    for product_name, items in items_by_product.items():
        print(f"\n{product_name}:")
        print(f"  Total items: {len(items)}")
        
        total_qty = sum(i['quantity'] for i in items)
        print(f"  Total quantity: {total_qty} pcs")
        
        # Get pack per carton
        first_item_id = items[0]['id']
        item_obj = plan.items.filter_by(id=first_item_id).first()
        pack_per_ctn = int(item_obj.product.pack_per_karton) if item_obj.product and item_obj.product.pack_per_karton else 50
        
        total_ctn = total_qty / pack_per_ctn if pack_per_ctn > 0 else 0
        print(f"  Total cartons: {total_ctn} ctn (pack_per_ctn: {pack_per_ctn})")
        
        print(f"  Items by date:")
        for item in sorted(items, key=lambda x: str(x['date'])):
            print(f"    - {item['date']}: {item['quantity']} {item['uom']}")
