"""
Seed Expense Module Permissions
Add permissions for expense and reimbursement module
"""

from app import create_app
from models.user import Role, Permission, RolePermission
from models import db

# Definisi semua permission Expense
EXPENSE_PERMISSIONS = [
    # === PERMISSION UTAMA (dipakai sidebar untuk show/hide menu) ===
    {'name': 'expense.view', 'resource': 'expense', 'action': 'view', 'description': 'View expense module', 'module': 'expense'},
    {'name': 'expense.view_all', 'resource': 'expense', 'action': 'view_all', 'description': 'View all expenses (beyond own)', 'module': 'expense'},
    {'name': 'expense.create', 'resource': 'expense', 'action': 'create', 'description': 'Create expense claims', 'module': 'expense'},
    {'name': 'expense.edit', 'resource': 'expense', 'action': 'edit', 'description': 'Edit expense claims', 'module': 'expense'},
    {'name': 'expense.delete', 'resource': 'expense', 'action': 'delete', 'description': 'Delete expense claims', 'module': 'expense'},
    {'name': 'expense.submit', 'resource': 'expense', 'action': 'submit', 'description': 'Submit expense for approval', 'module': 'expense'},
    {'name': 'expense.approve', 'resource': 'expense', 'action': 'approve', 'description': 'Approve/reject expenses', 'module': 'expense'},
    {'name': 'expense.payment', 'resource': 'expense', 'action': 'payment', 'description': 'Process expense payments', 'module': 'expense'},
]

# Matrix: role_name -> list of permission names yang diberikan
ROLE_PERMISSION_MATRIX = {
    'Super Admin': ['expense.view', 'expense.view_all', 'expense.create', 'expense.edit', 'expense.delete', 'expense.submit', 'expense.approve', 'expense.payment'],
    'Finance Manager': ['expense.view', 'expense.view_all', 'expense.edit', 'expense.approve', 'expense.payment'],
    'Finance Staff': ['expense.view', 'expense.view_all', 'expense.edit'],
    'HR Manager': ['expense.view', 'expense.view_all', 'expense.approve'],
    'HR Staff': ['expense.view'],
    'Director': ['expense.view', 'expense.view_all', 'expense.approve'],
    'Manager': ['expense.view', 'expense.view_all', 'expense.approve'],
    'Supervisor': ['expense.view', 'expense.view_all'],
    'Staff': ['expense.view', 'expense.create', 'expense.edit', 'expense.submit'],
    'Operator': ['expense.view', 'expense.create', 'expense.edit', 'expense.submit'],
}


def seed_expense_permissions():
    """Seed expense permissions ke role yang sesuai"""
    app = create_app()
    
    with app.app_context():
        print("🔐 Seeding Expense Permissions")
        
        # ── Step 1: Buat semua permission Expense jika belum ada ──
        print("\n📋 Step 1: Membuat permission Expense...")
        created_count = 0
        for perm_data in EXPENSE_PERMISSIONS:
            perm = Permission.query.filter_by(name=perm_data['name']).first()
            if not perm:
                perm = Permission(
                    name=perm_data['name'],
                    resource=perm_data['resource'],
                    action=perm_data['action'],
                    description=perm_data['description'],
                    module=perm_data['module'],
                    is_active=True
                )
                db.session.add(perm)
                created_count += 1
                print(f"  ✓ Created: {perm_data['name']}")
            else:
                print(f"  - Exists: {perm_data['name']}")
        
        db.session.commit()
        print(f"\n  Total permissions created: {created_count}")
        
        # ── Step 2: Assign permission ke tiap role ──
        print("\n🎭 Step 2: Assign permission ke role...")
        for role_name, perm_names in ROLE_PERMISSION_MATRIX.items():
            role = Role.query.filter_by(name=role_name).first()
            if not role:
                print(f"  ⚠ Role '{role_name}' tidak ditemukan, skip...")
                continue
            
            assigned = 0
            skipped = 0
            for perm_name in perm_names:
                perm = Permission.query.filter_by(name=perm_name).first()
                if not perm:
                    print(f"    ⚠ Permission '{perm_name}' tidak ditemukan, skip...")
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
            
            if assigned > 0:
                db.session.commit()
                print(f"  ✓ Role '{role_name}': +{assigned} permission baru, {skipped} sudah ada")
        
        # ── Step 3: Verifikasi ──
        print("\n📊 Verifikasi permission per role:")
        for role_name in ROLE_PERMISSION_MATRIX.keys():
            role = Role.query.filter_by(name=role_name).first()
            if role:
                count = RolePermission.query.join(Permission).filter(
                    RolePermission.role_id == role.id,
                    Permission.module == 'expense'
                ).count()
                print(f"  {role_name}: {count} Expense permission(s)")
        
        print("\n✅ Seeding Expense Permissions selesai!")


if __name__ == '__main__':
    seed_expense_permissions()
