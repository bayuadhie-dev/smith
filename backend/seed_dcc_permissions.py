#!/usr/bin/env python3
"""
Seed DCC permissions ke role DCC Staff & DCC Auto Approve
agar modul DCC muncul di sidebar frontend.

Masalah: Sidebar mengecek hasPermission('dcc.view') via canView('dcc').
         Role DCC sudah ada tapi tidak punya permission 'dcc.view' di DB.

Solusi: Buat permission 'dcc.view' (+ turunannya) dan assign ke semua role DCC.

Role yang mendapat permission DCC:
  - DCC Staff          : dcc.view + dcc.create + dcc.distribute + dcc.destroy
  - DCC Auto Approve   : sama seperti DCC Staff (full DCC access)
  - QA Manager         : dcc.view + dcc.capa_verify + dcc.destroy
  - General Manager    : dcc.view + dcc.review + dcc.approve
  - Management Rep     : dcc.view + dcc.capa_verify
  - Direktur           : dcc.view + dcc.approve
  - Dept Head          : dcc.view + dcc.create + dcc.review + dcc.capa_initiate
  - Supervisor         : dcc.view + dcc.create + dcc.review + dcc.capa_initiate
  - Manager            : dcc.view + dcc.create + dcc.review + dcc.approve + dcc.capa_initiate + dcc.capa_verify
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db
from models.user import Role, Permission, RolePermission

# ============================================================
# Definisi semua permission DCC
# ============================================================
DCC_PERMISSIONS = [
    # === PERMISSION UTAMA (dipakai sidebar untuk show/hide menu) ===
    {
        'name': 'dcc.view',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'view',
        'description': 'Akses modul Document Control Center (DCC) — dipakai sidebar'
    },
    # Legacy alias tanpa titik (dipakai hasPermission('dcc') di beberapa tempat)
    {
        'name': 'dcc',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'access',
        'description': 'Akses modul DCC (alias tanpa titik untuk kompatibilitas)'
    },

    # === PERMISSION SPESIFIK ===
    {
        'name': 'dcc.create',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'create',
        'description': 'Buat dokumen / revisi baru di DCC'
    },
    {
        'name': 'dcc.review',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'review',
        'description': 'Review / tanda tangani dokumen DCC sebagai Pengkaji'
    },
    {
        'name': 'dcc.approve',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'approve',
        'description': 'Sahkan / approve dokumen DCC sebagai Pengesah'
    },
    {
        'name': 'dcc.distribute',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'distribute',
        'description': 'Distribusi dokumen DCC ke departemen'
    },
    {
        'name': 'dcc.capa_initiate',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'capa_initiate',
        'description': 'Inisiasi / buat CPAR atau SCAR baru'
    },
    {
        'name': 'dcc.capa_verify',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'capa_verify',
        'description': 'Verifikasi efektivitas CAPA dan tutup CAPA'
    },
    {
        'name': 'dcc.memo',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'memo',
        'description': 'Buat dan publish memo internal DCC'
    },
    {
        'name': 'dcc.destroy',
        'resource': 'dcc',
        'module': 'dcc',
        'action': 'destroy',
        'description': 'Berita acara pemusnahan dokumen DCC'
    },
]

# ============================================================
# Matrix: role_name -> list of permission names yang diberikan
# (sesuai dcc.md Role & Permission Matrix)
# ============================================================
ROLE_PERMISSION_MATRIX = {
    # DCC Staff: buat dokumen, distribusi, memo, destroy — TAPI tidak approve/review
    'DCC Staff': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.distribute', 'dcc.memo', 'dcc.destroy',
    ],
    # DCC Auto Approve: sama dengan DCC Staff + lebih (auto internal)
    'DCC Auto Approve': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.distribute', 'dcc.memo', 'dcc.destroy',
    ],
    # QA Manager
    'QA Manager': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.review', 'dcc.approve',
        'dcc.capa_initiate', 'dcc.capa_verify',
        'dcc.destroy',
    ],
    # General Manager
    'General Manager': [
        'dcc.view', 'dcc',
        'dcc.review', 'dcc.approve',
    ],
    # Management Rep
    'Management Rep': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.capa_verify',
    ],
    # Direktur
    'Direktur': [
        'dcc.view', 'dcc',
        'dcc.approve',
    ],
    # Dept Head
    'Dept Head': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.review',
        'dcc.capa_initiate',
    ],
    # Supervisor
    'Supervisor': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.review',
        'dcc.capa_initiate',
    ],
    # Manager
    'Manager': [
        'dcc.view', 'dcc',
        'dcc.create', 'dcc.review', 'dcc.approve',
        'dcc.capa_initiate', 'dcc.capa_verify',
        'dcc.memo',
    ],
}


def seed_dcc_permissions():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("🔐 Seeding DCC Permissions")
        print("=" * 60)

        # ── Step 1: Buat semua permission DCC jika belum ada ──
        print("\n📋 Step 1: Membuat permission DCC...")
        perm_objects = {}
        for perm_data in DCC_PERMISSIONS:
            perm = Permission.query.filter_by(name=perm_data['name']).first()
            if not perm:
                perm = Permission(
                    name=perm_data['name'],
                    resource=perm_data['resource'],
                    module=perm_data['module'],
                    action=perm_data['action'],
                    description=perm_data['description'],
                    is_active=True
                )
                db.session.add(perm)
                db.session.flush()
                print(f"  ✓ Dibuat: '{perm_data['name']}' (ID: {perm.id})")
            else:
                print(f"  · Sudah ada: '{perm_data['name']}' (ID: {perm.id})")
            perm_objects[perm_data['name']] = perm

        db.session.flush()

        # ── Step 2: Assign permission ke tiap role ──
        print("\n🎭 Step 2: Assign permission ke role...")
        for role_name, perm_names in ROLE_PERMISSION_MATRIX.items():
            role = Role.query.filter_by(name=role_name).first()
            if not role:
                print(f"  ⚠️  Role '{role_name}' tidak ditemukan di DB — skip")
                continue

            assigned = 0
            skipped = 0
            for perm_name in perm_names:
                perm = perm_objects.get(perm_name)
                if not perm:
                    continue

                existing = RolePermission.query.filter_by(
                    role_id=role.id, permission_id=perm.id
                ).first()
                if not existing:
                    rp = RolePermission(role_id=role.id, permission_id=perm.id)
                    db.session.add(rp)
                    assigned += 1
                else:
                    skipped += 1

            print(f"  ✓ Role '{role_name}': +{assigned} permission baru, {skipped} sudah ada")

        db.session.commit()

        # ── Step 3: Verifikasi ──
        print("\n✅ Step 3: Verifikasi hasil...")
        for role_name in ROLE_PERMISSION_MATRIX.keys():
            role = Role.query.filter_by(name=role_name).first()
            if not role:
                continue
            count = RolePermission.query.join(Permission).filter(
                RolePermission.role_id == role.id,
                Permission.module == 'dcc'
            ).count()
            print(f"  {role_name}: {count} DCC permission(s)")

        print("\n🎉 Selesai! Modul DCC sekarang akan muncul di sidebar.")
        print("   Silakan refresh browser atau logout-login kembali.")


if __name__ == '__main__':
    seed_dcc_permissions()
