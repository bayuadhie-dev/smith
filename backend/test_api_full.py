#!/usr/bin/env python3
"""Test API response - show full structure"""

from app import create_app
import json

app = create_app()

with app.app_context():
    with app.test_client() as client:
        response = client.get('/api/executive/production-monitoring?year=2026&month=5&view=monthly')
        
        if response.status_code == 200:
            data = response.get_json()
            
            print("=" * 80)
            print("TOP LEVEL KEYS:")
            print("=" * 80)
            print(list(data.keys()))
            
            if 'data' in data:
                print("\n" + "=" * 80)
                print("DATA KEYS:")
                print("=" * 80)
                print(list(data['data'].keys()))
                
                if 'downtime_by_category' in data['data']:
                    print("\n" + "=" * 80)
                    print("✅ DOWNTIME BY CATEGORY FOUND:")
                    print("=" * 80)
                    for cat, minutes in data['data']['downtime_by_category'].items():
                        print(f"  {cat}: {minutes} minutes")
                else:
                    print("\n❌ downtime_by_category NOT in data!")
            
            # Check if downtime_by_category is at top level
            if 'downtime_by_category' in data:
                print("\n" + "=" * 80)
                print("✅ DOWNTIME BY CATEGORY AT TOP LEVEL:")
                print("=" * 80)
                for cat, minutes in data['downtime_by_category'].items():
                    print(f"  {cat}: {minutes} minutes")
