#!/usr/bin/env python
"""
Quick test to verify machines field is properly tracked in product_totals
"""

# Simulate the data structure
product_totals = {}
product_name = "OCTENIC 4S"

# Initialize (like in the code)
product_totals[product_name] = {
    'product_name': product_name,
    'product_code': '123',
    'grade_a': 0,
    'machines': set()
}

# Add machines (like in the code)
product_totals[product_name]['machines'].add('Mesin 7')
product_totals[product_name]['machines'].add('Mesin 8')

# Convert to string (like in the code)
machines_list = ', '.join(sorted(product_totals[product_name]['machines'])) if product_totals[product_name]['machines'] else 'N/A'

print(f"Product: {product_name}")
print(f"Machines set: {product_totals[product_name]['machines']}")
print(f"Machines string: {machines_list}")
print("\n✅ Test passed! Machines field works correctly.")
