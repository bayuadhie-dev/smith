#!/usr/bin/env python3
"""Test API response for Production Monitoring Dashboard"""

from app import create_app
import json

app = create_app()

with app.app_context():
    with app.test_client() as client:
        # Simulate API request
        response = client.get('/api/executive/production-monitoring?year=2026&month=5&view=monthly')
        
        if response.status_code == 200:
            data = response.get_json()
            
            print("=" * 80)
            print("API RESPONSE - DOWNTIME BY CATEGORY")
            print("=" * 80)
            
            if 'downtime_by_category' in data:
                print("\ndowntime_by_category:")
                for cat, minutes in data['downtime_by_category'].items():
                    print(f"  {cat}: {minutes} minutes")
            else:
                print("\n❌ downtime_by_category NOT FOUND in response!")
            
            print("\n" + "=" * 80)
            print("SUMMARY")
            print("=" * 80)
            
            if 'summary' in data:
                summary = data['summary']
                print(f"\nTotal Runtime: {summary.get('total_runtime', 0)} minutes")
                print(f"Total Downtime: {summary.get('total_downtime', 0)} minutes")
                print(f"Total Idle: {summary.get('total_idle_time', 0)} minutes")
            
            print("\n" + "=" * 80)
        else:
            print(f"❌ API request failed with status code: {response.status_code}")
            print(f"Response: {response.data}")
