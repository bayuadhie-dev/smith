"""
Sync pack_per_karton dari tabel products ke tabel bill_of_materials.pack_per_carton
Hanya update jika:
  1. BOM aktif
  2. BOM.pack_per_carton masih 1 atau NULL (belum diisi)
  3. Product.pack_per_karton > 1 (ada data)
  4. Nama produk sama persis (verifikasi via product_id FK)

Usage:
  python sync_bom_pack_per_karton.py          # Dry run (tidak mengubah DB)
  python sync_bom_pack_per_karton.py --apply  # Apply perubahan ke DB
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.production import BillOfMaterials
from models.product import Product

def sync_pack_per_karton(apply=False):
    app = create_app()
    
    with app.app_context():
        # Query semua BOM aktif yang pack_per_carton masih 1 atau NULL
        boms = db.session.query(BillOfMaterials, Product).join(
            Product, BillOfMaterials.product_id == Product.id
        ).filter(
            BillOfMaterials.is_active == True,
            db.or_(
                BillOfMaterials.pack_per_carton == None,
                BillOfMaterials.pack_per_carton <= 1
            )
        ).all()
        
        print(f"{'='*90}")
        print(f"SYNC pack_per_karton: products → bill_of_materials")
        print(f"Mode: {'APPLY (akan mengubah DB)' if apply else 'DRY RUN (hanya preview)'}")
        print(f"{'='*90}")
        print(f"Total BOM aktif dengan pack_per_carton <= 1: {len(boms)}")
        print()
        
        updated = []
        skipped = []
        
        for bom, product in boms:
            # Ambil pack_per_karton dari products
            ppk_str = product.pack_per_karton  # String field di products
            
            # Parse ke integer
            try:
                ppk = int(float(ppk_str)) if ppk_str else 0
            except (ValueError, TypeError):
                ppk = 0
            
            if ppk > 1:
                updated.append({
                    'bom_number': bom.bom_number,
                    'bom_id': bom.id,
                    'product_id': product.id,
                    'product_code': product.code,
                    'product_name': product.name,
                    'old_ppk': bom.pack_per_carton,
                    'new_ppk': ppk,
                })
                
                if apply:
                    bom.pack_per_carton = ppk
            else:
                skipped.append({
                    'bom_number': bom.bom_number,
                    'product_code': product.code,
                    'product_name': product.name,
                    'ppk_value': ppk_str,
                })
        
        # Print results
        print(f"✅ Akan di-update: {len(updated)}")
        print(f"⏭️  Dilewati (products.pack_per_karton kosong/0/1): {len(skipped)}")
        print()
        
        if updated:
            print(f"{'No':>3} | {'Kode Produk':>15} | {'Nama Produk':<45} | {'BOM ppk':>7} → {'New ppk':>7}")
            print(f"{'-'*90}")
            for i, u in enumerate(updated, 1):
                name = u['product_name'][:45] if u['product_name'] else ''
                print(f"{i:3d} | {u['product_code']:>15s} | {name:<45s} | {u['old_ppk'] or 'NULL':>7} → {u['new_ppk']:>7}")
        
        if apply and updated:
            db.session.commit()
            print(f"\n{'='*90}")
            print(f"✅ DONE! {len(updated)} BOM updated successfully.")
            print(f"{'='*90}")
        elif not apply and updated:
            print(f"\n{'='*90}")
            print(f"⚠️  DRY RUN - tidak ada perubahan. Jalankan dengan --apply untuk menerapkan.")
            print(f"   python sync_bom_pack_per_karton.py --apply")
            print(f"{'='*90}")
        
        if skipped:
            print(f"\n--- Dilewati ({len(skipped)} produk tanpa pack_per_karton di tabel products) ---")
            for s in skipped[:20]:
                name = s['product_name'][:45] if s['product_name'] else ''
                print(f"  {s['product_code']:>15s} | {name:<45s} | ppk: {s['ppk_value']}")
            if len(skipped) > 20:
                print(f"  ... dan {len(skipped) - 20} lainnya")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    sync_pack_per_karton(apply=apply)
