#!/usr/bin/env python3
"""Script to create user PujiR with same role as Puji"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from models import User, Role

def create_pujir_user():
    app = create_app()
    with app.app_context():
        # Find Puji to get their role
        puji = User.query.filter_by(username='Puji').first()
        if not puji:
            puji = User.query.filter_by(username='puji').first()
        
        if not puji:
            print("User Puji not found! Creating with default role 'Operator'...")
            puji_role = Role.query.filter_by(name='Operator').first()
        else:
            puji_role = puji.roles[0] if puji.roles else None
            print(f"Found Puji with role: {puji_role.name if puji_role else 'No role'}")
        
        # Check if PujiR already exists
        existing = User.query.filter_by(username='PujiR').first()
        if existing:
            print("User PujiR already exists! Resetting password...")
            existing.set_password('mtc2025')
            db.session.commit()
            print("Password for PujiR has been reset to: mtc2025")
            return
        
        # Create new user PujiR
        pujir = User(
            username='PujiR',
            email='pujir@gratiams.com',
            full_name='Puji R',
            is_active=True
        )
        pujir.set_password('mtc2025')
        
        # Assign same role as Puji
        if puji_role:
            pujir.roles.append(puji_role)
            print(f"Assigned role: {puji_role.name}")
        
        db.session.add(pujir)
        db.session.commit()
        
        print("\nUser PujiR created successfully!")
        print(f"Username: PujiR")
        print(f"Password: mtc2025")
        print(f"Email: pujir@gratiams.com")
        print(f"Full Name: Puji R")
        print(f"Role: {puji_role.name if puji_role else 'No role'}")

if __name__ == '__main__':
    create_pujir_user()
