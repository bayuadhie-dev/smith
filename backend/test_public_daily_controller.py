#!/usr/bin/env python3
"""
Test public daily controller endpoint
"""
from app import create_app

app = create_app()

with app.app_context():
    with app.test_client() as client:
        print("=" * 80)
        print("TEST PUBLIC DAILY CONTROLLER ENDPOINT")
        print("=" * 80)
        
        # Test with a specific date
        test_date = '2026-05-06'
        print(f"\nTesting with date: {test_date}")
        
        response = client.get(f'/api/oee/public/daily-controller?date={test_date}')
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.data.decode('utf-8')}")
        
        if response.status_code == 200:
            import json
            data = json.loads(response.data)
            print(f"\n✅ Success!")
            print(f"Machines count: {len(data.get('machines', []))}")
            print(f"Summary: {data.get('summary', {})}")
        else:
            print(f"\n❌ Error!")
        
        print("\n" + "=" * 80)
