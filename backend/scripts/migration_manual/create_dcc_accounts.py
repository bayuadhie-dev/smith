#!/usr/bin/env python3
"""
Buat 4 akun DCC + role DCC sesuai permission matrix dcc.md

Akun:
  1. DCC1 (auto-approve) — untuk bulk upload dokumen induk, langsung active
  2. DCC2 (auto-approve) — sama, backup
  3. DCC_Checker — untuk review/check dokumen setelah semua dokumen selesai diupload
  4. DCC_Approver — untuk approve/sahkan dokumen

Role DCC yang dibuat:
  - DCC Staff          : Buat dokumen, distribusi, memo, destroy
  - DCC Auto Approve   : Sama seperti DCC Staff + auto-approve saat upload
  - Dept Head          : Buat dokumen, review/check, approve Level III, CAPA initiate
  - Manager            : Buat dokumen, review/check, approve Level II, CAPA initiate+verify, memo
  - QA Manager         : Buat dokumen, review/check, approve Level II+III, CAPA verify (SCAR), destroy
  - General Manager    : Review QM, approve Level I+II
  - Management Rep     : Buat QM, CAPA verify (CPAR)
  - Direktur           : Approve Level I
"""

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from models import User, Role
from models.user import UserRole

def create_accounts():
    app = create_app()
    with app.app_context():
        # === Create DCC roles if not exist ===
        dcc_roles = [
            ('DCC Staff', 'DCC Staff — buat dokumen, distribusi, memo, destroy'),
            ('DCC Auto Approve', 'DCC Auto Approve — upload langsung active, untuk bulk upload awal'),
            ('QA Manager', 'QA Manager — review/check, approve Level II+III, verify SCAR, destroy'),
            ('General Manager', 'General Manager (GM) — review QM, approve Level I+II'),
            ('Management Rep', 'Management Representative (MR) — buat QM, verify CPAR'),
            ('Direktur', 'Direktur — approve Level I'),
        ]
        
        for role_name, desc in dcc_roles:
            existing = Role.query.filter_by(name=role_name).first()
            if not existing:
                role = Role(name=role_name, description=desc)
                db.session.add(role)
                print(f"  ✓ Role '{role_name}' dibuat")
            else:
                print(f"  · Role '{role_name}' sudah ada")
        
        db.session.commit()
        
        # === Create 4 DCC accounts ===
        accounts = [
            {
                'username': 'DCC1',
                'email': 'dcc1@gratiams.com',
                'full_name': 'DCC Staff 1 (Auto Approve)',
                'password': 'dcc2025',
                'department': 'DCC',
                'position': 'Document Controller',
                'role': 'DCC Auto Approve',
            },
            {
                'username': 'DCC2',
                'email': 'dcc2@gratiams.com',
                'full_name': 'DCC Staff 2 (Auto Approve)',
                'password': 'dcc2025',
                'department': 'DCC',
                'position': 'Document Controller',
                'role': 'DCC Auto Approve',
            },
            {
                'username': 'DCC3',
                'email': 'dcc3@gratiams.com',
                'full_name': 'DCC Staff 3',
                'password': 'dcc2025',
                'department': 'DCC',
                'position': 'Document Controller',
                'role': 'DCC Staff',
            },
            {
                'username': 'DCC4',
                'email': 'dcc4@gratiams.com',
                'full_name': 'DCC Staff 4',
                'password': 'dcc2025',
                'department': 'DCC',
                'position': 'Document Controller',
                'role': 'DCC Staff',
            },
        ]
        
        print("\n=== Membuat Akun DCC ===\n")
        
        for acc in accounts:
            user = User.query.filter_by(username=acc['username']).first()
            if user:
                print(f"  · User '{acc['username']}' sudah ada (ID: {user.id})")
                user.set_password(acc['password'])
                db.session.commit()
                print(f"    Password di-reset ke: {acc['password']}")
            else:
                user = User(
                    username=acc['username'],
                    email=acc['email'],
                    full_name=acc['full_name'],
                    department=acc['department'],
                    position=acc['position'],
                    is_active=True,
                    password_hash='',
                )
                user.set_password(acc['password'])
                db.session.add(user)
                db.session.flush()
                
                # Assign role
                role = Role.query.filter_by(name=acc['role']).first()
                if role:
                    ur = UserRole(user_id=user.id, role_id=role.id)
                    db.session.add(ur)
                
                db.session.commit()
                print(f"  ✓ User '{acc['username']}' dibuat (ID: {user.id})")
                print(f"    Password: {acc['password']}")
                print(f"    Role: {acc['role']}")
                print(f"    Full Name: {acc['full_name']}")
        
        print("\n=== Ringkasan ===\n")
        print("4 Akun DCC:")
        print("  1. DCC1 — auto-approve saat upload (password: dcc2025)")
        print("  2. DCC2 — auto-approve saat upload (password: dcc2025)")
        print("  3. DCC3 — normal flow, perlu approval (password: dcc2025)")
        print("  4. DCC4 — normal flow, perlu approval (password: dcc2025)")
        print()
        print("DCC1 & DCC2: upload dokumen → langsung status 'active'")
        print("DCC3 & DCC4: upload dokumen → status 'draft', perlu checker & approver")

if __name__ == '__main__':
    create_accounts()
