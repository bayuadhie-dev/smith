#!/usr/bin/env python3
"""Check pack per carton for MBF products"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.product import Product

def check_pack_per_carton():
    """Check pack per carton for Octenic and Gloveclean"""
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("CHECKING PACK PER CARTON")
        print("=" * 60)
        
        # Get the products
        octenic = Product.query.filter_by(name='OCTENIC 4S').first()
        gloveclean = Product.query.filter_by(name='GLOVECLEAN BODY WASH GLOVE 2S @96').first()
        
        if octenic:
            print(f"\nOctenic 4S:")
            print(f"  - Pack per Karton: {octenic.pack_per_karton}")
            
        if gloveclean:
            print(f"\nGloveclean Body Wash:")
            print(f"  - Pack per Karton: {gloveclean.pack_per_karton}")

if __name__ == "__main__":
    check_pack_per_carton()
