#!/usr/bin/env python3
"""Add carton columns to MBF report tables"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from sqlalchemy import text

def add_carton_columns():
    """Add carton columns to existing tables"""
    app = create_app()
    
    with app.app_context():
        print("Adding carton columns to MBF report tables...")
        
        # Add columns to mbf_reports table
        db.session.execute(text("""
            ALTER TABLE mbf_reports 
            ADD COLUMN total_target_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_reports 
            ADD COLUMN total_actual_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        # Add columns to mbf_report_details table
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN target_octenic_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN target_gloveclean_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN target_total_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN actual_octenic_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN actual_gloveclean_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.execute(text("""
            ALTER TABLE mbf_report_details 
            ADD COLUMN actual_total_cartons NUMERIC(15, 2) DEFAULT 0
        """))
        
        db.session.commit()
        print("✅ Carton columns added successfully!")
        
        # Update existing records to calculate cartons
        print("\nUpdating existing records...")
        
        # Update main reports
        db.session.execute(text("""
            UPDATE mbf_reports 
            SET total_target_cartons = total_target / 39
            WHERE target_octenic > 0 OR target_gloveclean > 0
        """))
        
        db.session.execute(text("""
            UPDATE mbf_reports 
            SET total_actual_cartons = actual_octenic / 39 + actual_gloveclean / 96
            WHERE actual_octenic > 0 OR actual_gloveclean > 0
        """))
        
        db.session.commit()
        print("✅ Existing records updated!")
        
    return True

if __name__ == "__main__":
    try:
        if add_carton_columns():
            print("\n🎉 Carton conversion is now ready!")
            print("The MBF Report will now show both pieces and cartons.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
