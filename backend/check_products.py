#!/usr/bin/env python3
"""Check product names in database"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.product import Product

def check_products():
    """Check for Gloveclean and Octenic products"""
    app = create_app()
    
    with app.app_context():
        print("Searching for products containing 'gloveclean' or 'octenic'...")
        
        # Search for products containing these keywords
        products = Product.query.filter(
            db.or_(
                Product.name.ilike('%gloveclean%'),
                Product.name.ilike('%octenic%')
            )
        ).all()
        
        if products:
            print(f"\nFound {len(products)} products:")
            for p in products:
                print(f"  - ID: {p.id}, Name: '{p.name}', Code: '{p.code}'")
        else:
            print("\nNo products found with those keywords.")
            
        # Show all products for reference
        print("\n\nFirst 20 products in database:")
        all_products = Product.query.limit(20).all()
        for p in all_products:
            print(f"  - ID: {p.id}, Name: '{p.name}'")

if __name__ == "__main__":
    check_products()
