#!/usr/bin/env python
r"""
Test Weekly Planning API - Create complete plan for May 2026
"""
import requests
import json
from datetime import date

# Configuration
BASE_URL = "http://localhost:5000"  # Adjust if different
API_BASE = f"{BASE_URL}/api/production"

# You need to get JWT token first
# For testing, you can get it from browser dev tools after login
JWT_TOKEN = None  # Set this after login

def get_token():
    """Login and get JWT token"""
    login_url = f"{BASE_URL}/api/auth/login"
    
    # Use your admin credentials
    username = input("Enter username (default: admin): ").strip() or "admin"
    password = input("Enter password: ").strip()
    
    response = requests.post(login_url, json={
        "username": username,
        "password": password
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('access_token')
        print(f"✅ Login successful! Token: {token[:20]}...")
        return token
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def create_weekly_plan(token):
    """Create weekly plan for May 2026"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 1: Create plan
    print("\n" + "="*80)
    print("STEP 1: Creating Weekly Plan")
    print("="*80)
    
    # May 2026 Week 1 (May 4-10) is actually week 19 of the year
    # Let's use week 19 to avoid conflict
    plan_data = {
        "year": 2026,
        "week_number": 19,  # Week 19 of 2026 (May 4-10)
        "notes": "Test plan for May 2026 - Week 1 (May 4-10)"
    }
    
    response = requests.post(
        f"{API_BASE}/weekly-plans",
        headers=headers,
        json=plan_data
    )
    
    if response.status_code != 201:
        print(f"❌ Failed to create plan: {response.text}")
        return None
    
    plan = response.json()['weekly_plan']
    plan_id = plan['id']
    print(f"✅ Plan created: {plan['plan_number']} (ID: {plan_id})")
    print(f"   Period: {plan['week_start']} to {plan['week_end']}")
    
    # Step 2: Get products and machines
    print("\n" + "="*80)
    print("STEP 2: Getting Products and Machines")
    print("="*80)
    
    # Get products
    products_response = requests.get(f"{BASE_URL}/api/products", headers=headers)
    if products_response.status_code == 200:
        products = products_response.json().get('products', [])[:3]  # Get first 3
        print(f"✅ Found {len(products)} products")
    else:
        print("❌ Failed to get products")
        return None
    
    # Get machines
    machines_response = requests.get(f"{BASE_URL}/api/machines", headers=headers)
    if machines_response.status_code == 200:
        machines = machines_response.json().get('machines', [])[:2]  # Get first 2
        print(f"✅ Found {len(machines)} machines")
    else:
        print("❌ Failed to get machines")
        return None
    
    # Step 3: Add items to plan
    print("\n" + "="*80)
    print("STEP 3: Adding Items to Plan")
    print("="*80)
    
    items_created = []
    for idx, product in enumerate(products, 1):
        machine = machines[idx % len(machines)]  # Alternate machines
        
        item_data = {
            "product_id": product['id'],
            "planned_quantity": 5000 + (idx * 1000),  # 6000, 7000, 8000
            "uom": "pcs",
            "priority": idx,
            "planned_date": f"2026-05-{4+idx:02d}",  # May 5, 6, 7
            "machine_id": machine['id'],
            "notes": f"Test item {idx}"
        }
        
        response = requests.post(
            f"{API_BASE}/weekly-plans/{plan_id}/items",
            headers=headers,
            json=item_data
        )
        
        if response.status_code == 201:
            item = response.json()['item']
            items_created.append(item)
            print(f"✅ Item {idx} added:")
            print(f"   Product: {product['name']}")
            print(f"   Quantity: {item_data['planned_quantity']} pcs")
            print(f"   Machine: {machine['name']}")
            print(f"   Date: {item_data['planned_date']}")
            print(f"   Material Status: {item.get('material_status', 'N/A')}")
        else:
            print(f"❌ Failed to add item {idx}: {response.text}")
    
    # Step 4: Submit plan
    print("\n" + "="*80)
    print("STEP 4: Submitting Plan for Approval")
    print("="*80)
    
    response = requests.post(
        f"{API_BASE}/weekly-plans/{plan_id}/submit",
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✅ Plan submitted for approval")
    else:
        print(f"❌ Failed to submit: {response.text}")
        return plan_id
    
    # Step 5: Approve plan
    print("\n" + "="*80)
    print("STEP 5: Approving Plan")
    print("="*80)
    
    response = requests.post(
        f"{API_BASE}/weekly-plans/{plan_id}/approve",
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✅ Plan approved!")
    else:
        print(f"❌ Failed to approve: {response.text}")
        return plan_id
    
    # Step 6: Generate Work Orders
    print("\n" + "="*80)
    print("STEP 6: Generating Work Orders")
    print("="*80)
    
    response = requests.post(
        f"{API_BASE}/weekly-plans/{plan_id}/generate-work-orders",
        headers=headers,
        json={"auto_merge": True}
    )
    
    if response.status_code == 201:
        result = response.json()
        print(f"✅ Work Orders generated!")
        print(f"   New WOs: {result['summary']['new_wos']}")
        print(f"   Merged WOs: {result['summary']['merged_wos']}")
        
        if result.get('created_work_orders'):
            print("\n   Created WOs:")
            for wo in result['created_work_orders']:
                print(f"     - {wo['wo_number']}: {wo['product_name']} ({wo['quantity']} pcs)")
        
        if result.get('merged_work_orders'):
            print("\n   Merged WOs:")
            for wo in result['merged_work_orders']:
                print(f"     - {wo['wo_number']}: Added {wo['added_quantity']} pcs (total: {wo['new_quantity']} pcs)")
    else:
        print(f"❌ Failed to generate WOs: {response.text}")
    
    print("\n" + "="*80)
    print("✅ WEEKLY PLAN CREATION COMPLETE!")
    print("="*80)
    print(f"\nPlan ID: {plan_id}")
    print(f"Items: {len(items_created)}")
    print(f"\nNow check:")
    print(f"1. python check_may_2026_data.py")
    print(f"2. Production Monitoring Dashboard for May 2026")
    print("="*80 + "\n")
    
    return plan_id

if __name__ == '__main__':
    print("="*80)
    print("WEEKLY PLANNING API TEST")
    print("="*80)
    print("\nThis script will:")
    print("1. Login to get JWT token")
    print("2. Create weekly plan for May 2026")
    print("3. Add 3 items to the plan")
    print("4. Submit and approve the plan")
    print("5. Generate work orders")
    print("\nMake sure backend is running on http://localhost:5000")
    print("="*80 + "\n")
    
    # Get token
    token = get_token()
    if not token:
        print("\n❌ Cannot proceed without token")
        exit(1)
    
    # Create plan
    plan_id = create_weekly_plan(token)
    
    if plan_id:
        print(f"\n✅ Success! Plan ID: {plan_id}")
    else:
        print(f"\n❌ Failed to create complete plan")
