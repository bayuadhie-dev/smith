#!/usr/bin/env python3
"""Test script to check if MBF report imports work correctly"""

try:
    print("Testing imports...")
    
    # Test model imports
    from models.mbf_report import MBFReport, MBFReportDetail
    print("✓ MBFReport models imported successfully")
    
    # Test route imports
    from routes.mbf_report import mbf_report_bp
    print("✓ MBFReport routes imported successfully")
    
    # Test blueprint registration
    print(f"✓ Blueprint URL prefix: {mbf_report_bp.url_prefix}")
    
    print("\nAll imports successful! The server should start without issues.")
    
except Exception as e:
    print(f"✗ Import error: {e}")
    import traceback
    traceback.print_exc()
