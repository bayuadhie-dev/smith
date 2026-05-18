"""
Migration script to create FG Conversion tables
Run this script to add WIP to FG conversion tracking tables
"""

from app import create_app
from models import db
from models.production import FGConversion, FGConversionItem, FGConversionMaterial, FGConversionLossDetail

def create_fg_conversion_tables():
    """Create FG conversion tables"""
    app = create_app()
    
    with app.app_context():
        print("Creating FG Conversion tables...")
        
        try:
            # Create tables
            db.create_all()
            
            print("✓ FG Conversion tables created successfully!")
            print("\nTables created:")
            print("  - fg_conversions (header)")
            print("  - fg_conversion_items (WIP → FG detail)")
            print("  - fg_conversion_materials (material consumption)")
            print("  - fg_conversion_loss_details (loss/reject tracking)")
            
        except Exception as e:
            print(f"✗ Error creating tables: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    create_fg_conversion_tables()
