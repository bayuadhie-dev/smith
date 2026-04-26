#!/usr/bin/env python3
"""Debug MBF sync data"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.product import Product
from models.production import WorkOrder
from datetime import datetime, timedelta
from utils.timezone import get_local_today

def debug_sync():
    """Debug sync data process"""
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("DEBUG SYNC DATA")
        print("=" * 60)
        
        # Get products
        octenic = Product.query.filter_by(name='OCTENIC 4S').first()
        gloveclean = Product.query.filter_by(name='GLOVECLEAN BODY WASH GLOVE 2S @96').first()
        
        print(f"\nOctenic: {octenic.name if octenic else 'Not found'} (ID: {octenic.id if octenic else 'N/A'})")
        print(f"Gloveclean: {gloveclean.name if gloveclean else 'Not found'} (ID: {gloveclean.id if gloveclean else 'N/A'})")
        
        # Define a sample period (this week)
        today = get_local_today()
        period_start = today - timedelta(days=today.weekday())  # Monday
        period_end = period_start + timedelta(days=4)  # Friday
        
        print(f"\nPeriod: {period_start} to {period_end}")
        
        # Check work orders
        if octenic and gloveclean:
            work_orders = WorkOrder.query.filter(
                WorkOrder.product_id.in_([octenic.id, gloveclean.id]),
                WorkOrder.status == 'completed'
            ).all()
            
            print(f"\nTotal completed WOs for these products: {len(work_orders)}")
            
            # Show recent work orders
            print("\nRecent completed work orders:")
            for wo in work_orders[-10:]:
                print(f"  WO #{wo.wo_number}: {wo.product.name}")
                print(f"    Status: {wo.status}")
                print(f"    Actual Start: {wo.actual_start_date}")
                print(f"    Qty Produced: {wo.quantity_produced}")
                print()
            
            # Check within period
            work_orders_in_period = WorkOrder.query.filter(
                WorkOrder.actual_start_date >= period_start,
                WorkOrder.actual_start_date <= period_end,
                WorkOrder.product_id.in_([octenic.id, gloveclean.id]),
                WorkOrder.status == 'completed'
            ).all()
            
            print(f"Work orders within period: {len(work_orders_in_period)}")
            
            if work_orders_in_period:
                print("\nWork orders in this week:")
                for wo in work_orders_in_period:
                    print(f"  WO #{wo.wo_number}: {wo.product.name}")
                    print(f"    Date: {wo.actual_start_date}")
                    print(f"    Hour: {wo.actual_start_date.hour if wo.actual_start_date else 'N/A'}")

if __name__ == "__main__":
    debug_sync()
