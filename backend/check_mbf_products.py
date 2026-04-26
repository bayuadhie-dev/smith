#!/usr/bin/env python3
"""Check MBF products in Product and WorkOrder tables"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.product import Product
from models.production import WorkOrder

def check_products():
    """Check for Gloveclean and Octenic products"""
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("CHECKING PRODUCT TABLE")
        print("=" * 60)
        
        # Search in Product table
        products = Product.query.filter(
            db.or_(
                Product.name.ilike('%gloveclean%'),
                Product.name.ilike('%octenic%'),
                Product.code.ilike('%gloveclean%'),
                Product.code.ilike('%octenic%')
            )
        ).all()
        
        if products:
            print(f"\nFound {len(products)} products in Product table:")
            for p in products:
                print(f"  ID: {p.id} | Name: '{p.name}' | Code: '{p.code}'")
        else:
            print("\nNo products found in Product table")
            
        print("\n" + "=" * 60)
        print("CHECKING WORK ORDER TABLE")
        print("=" * 60)
        
        # Search in WorkOrder table
        work_orders = WorkOrder.query.join(Product).filter(
            db.or_(
                Product.name.ilike('%gloveclean%'),
                Product.name.ilike('%octenic%'),
                Product.code.ilike('%gloveclean%'),
                Product.code.ilike('%octenic%')
            )
        ).limit(10).all()
        
        if work_orders:
            print(f"\nFound {len(work_orders)} work orders with these products:")
            for wo in work_orders:
                print(f"  WO ID: {wo.id} | Product: '{wo.product.name}' | Status: {wo.status}")
        else:
            print("\nNo work orders found with these products")
            
        print("\n" + "=" * 60)
        print("RECENT WORK ORDERS (Last 10)")
        print("=" * 60)
        
        # Show recent work orders
        recent_wo = WorkOrder.query.join(Product).order_by(WorkOrder.id.desc()).limit(10).all()
        for wo in recent_wo:
            print(f"  WO ID: {wo.id} | Product: '{wo.product.name}' | Code: '{wo.product.code}'")

if __name__ == "__main__":
    check_products()
