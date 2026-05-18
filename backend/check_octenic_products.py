#!/usr/bin/env python3
"""Check all products with OCTENIC in the name"""

from app import create_app
from models import db

app = create_app()

with app.app_context():
    print("=" * 80)
    print("PRODUCTS WITH 'OCTENIC' IN NAME")
    print("=" * 80)
    
    # Search for products with OCTENIC
    products = db.session.execute(
        db.text("SELECT id, code, name, pack_per_karton FROM products WHERE name LIKE '%OCTENIC%' OR name LIKE '%octenic%'")
    ).fetchall()
    
    print(f"\nFound {len(products)} product(s):\n")
    for p in products:
        print(f"ID: {p[0]}")
        print(f"Code: {p[1]}")
        print(f"Name: '{p[2]}'")
        print(f"Pack per Carton: {p[3]}")
        print("-" * 80)
    
    # Also check WETKINS
    print("\n" + "=" * 80)
    print("PRODUCTS WITH 'WETKINS' IN NAME")
    print("=" * 80)
    
    products = db.session.execute(
        db.text("SELECT id, code, name, pack_per_karton FROM products WHERE name LIKE '%WETKINS%' OR name LIKE '%wetkins%'")
    ).fetchall()
    
    print(f"\nFound {len(products)} product(s):\n")
    for p in products:
        print(f"ID: {p[0]}")
        print(f"Code: {p[1]}")
        print(f"Name: '{p[2]}'")
        print(f"Pack per Carton: {p[3]}")
        print("-" * 80)
    
    # Check GLOVECLEAN
    print("\n" + "=" * 80)
    print("PRODUCTS WITH 'GLOVECLEAN' IN NAME")
    print("=" * 80)
    
    products = db.session.execute(
        db.text("SELECT id, code, name, pack_per_karton FROM products WHERE name LIKE '%GLOVECLEAN%' OR name LIKE '%gloveclean%'")
    ).fetchall()
    
    print(f"\nFound {len(products)} product(s):\n")
    for p in products:
        print(f"ID: {p[0]}")
        print(f"Code: {p[1]}")
        print(f"Name: '{p[2]}'")
        print(f"Pack per Carton: {p[3]}")
        print("-" * 80)
