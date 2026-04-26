#!/usr/bin/env python3
"""Create MBF report tables in the database"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.mbf_report import MBFReport, MBFReportDetail

def create_tables():
    """Create MBF report tables"""
    app = create_app()
    
    with app.app_context():
        print("Creating MBF report tables...")
        
        # Create only the MBF tables
        MBFReport.__table__.create(db.engine, checkfirst=True)
        MBFReportDetail.__table__.create(db.engine, checkfirst=True)
        
        print("✅ MBF report tables created successfully!")
        
        # Verify tables exist
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'mbf_reports' in tables and 'mbf_report_details' in tables:
            print("✅ Tables verified in database")
        else:
            print("❌ Tables not found in database")
            return False
            
    return True

if __name__ == "__main__":
    try:
        if create_tables():
            print("\n🎉 All done! You can now use the MBF Report feature.")
        else:
            print("\n❌ Failed to create tables")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
