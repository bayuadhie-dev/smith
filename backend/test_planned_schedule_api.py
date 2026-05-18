#!/usr/bin/env python3
"""
Test API response to verify planned_days and planned_shifts are included
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from routes.executive_dashboard import executive_dashboard_bp
from datetime import date

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'test-secret'
db.init_app(app)
app.register_blueprint(executive_dashboard_bp, url_prefix='/api/executive')

with app.app_context():
    with app.test_client() as client:
        print("=" * 80)
        print("TESTING PRODUCTION MONITORING API")
        print("=" * 80)
        
        # Test with May 2026 date range
        response = client.get('/api/executive/production-monitoring?start_date=2026-05-01&end_date=2026-05-31')
        
        if response.status_code == 200:
            data = response.json
            products = data.get('products_achievement', [])
            
            print(f"\nFound {len(products)} products\n")
            
            for p in products:
                print(f"{'='*80}")
                print(f"Product: {p['product_name']}")
                print(f"{'='*80}")
                print(f"  Target Monthly: {p['target_ctn']} ctn")
                print(f"  Target Weekly: {p['target_ctn_weekly']} ctn")
                print(f"  Planned Days: {p.get('planned_days', 'N/A')}")
                print(f"  Planned Shifts: {p.get('planned_shifts', 'N/A')}")
                print(f"  Actual: {p['actual_ctn']} ctn")
                print(f"  Gap Message: {p.get('gap_message', 'N/A')}")
                print()
        else:
            print(f"Error: {response.status_code}")
            print(response.data)
