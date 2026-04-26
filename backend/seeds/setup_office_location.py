"""Setup office location for GPS attendance validation"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from company_config.company import COMPANY_NAME

app = create_app()

with app.app_context():
    try:
        # Insert office location using raw SQL
        db.session.execute(db.text(f"""
            INSERT INTO office_locations (name, latitude, longitude, radius_meters, is_active, is_default, address)
            VALUES ('Kantor {COMPANY_NAME}', -7.513881030958723, 110.69837923296517, 500, 1, 1, 'Jawa Tengah')
        """))
        db.session.commit()
        print("✅ Office location created successfully!")
        print(f"   Name: Kantor {COMPANY_NAME}")
        print("   Latitude: -7.513881030958723")
        print("   Longitude: 110.69837923296517")
        print("   Radius: 500 meters")
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
