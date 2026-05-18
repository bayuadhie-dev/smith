#!/usr/bin/env python3
"""Test API response with error handling"""

from app import create_app
import json
import traceback

app = create_app()

with app.app_context():
    with app.test_client() as client:
        try:
            # Simulate API request
            response = client.get('/api/executive/production-monitoring?year=2026&month=5&view=monthly')
            
            print("=" * 80)
            print(f"Status Code: {response.status_code}")
            print("=" * 80)
            
            if response.status_code == 200:
                data = response.get_json()
                
                print("\nResponse keys:")
                print(list(data.keys()))
                
                if 'downtime_by_category' in data:
                    print("\n✅ downtime_by_category FOUND:")
                    for cat, minutes in data['downtime_by_category'].items():
                        print(f"  {cat}: {minutes} minutes")
                else:
                    print("\n❌ downtime_by_category NOT FOUND!")
                    print("\nFull response structure:")
                    print(json.dumps(data, indent=2, default=str)[:2000])
            else:
                print(f"\n❌ API request failed!")
                print(f"Response data: {response.data.decode('utf-8')[:1000]}")
                
        except Exception as e:
            print(f"\n❌ Exception occurred:")
            print(traceback.format_exc())
