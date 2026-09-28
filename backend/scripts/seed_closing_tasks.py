"""
One-off seed (2026-09-28): default Closing Period checklist items.

Run manually once, after the DB is reachable and migrations are applied:
    cd backend && python scripts/seed_closing_tasks.py

Safe to re-run: skips any code that already exists.
"""
import sys

sys.path.insert(0, '.')

from app import create_app
from models import db
from models.finance import ClosingTaskDefinition

DEFAULT_TASKS = [
    {
        'code': 'bank_reconciliation',
        'label': 'Rekonsiliasi Bank Selesai',
        'description': 'Semua mutasi bank bulan ini sudah di-match terhadap jurnal GL (lihat menu Bank Reconciliation).',
        'is_required': True,
        'display_order': 1,
    },
    {
        'code': 'stock_opname',
        'label': 'Stock Opname Selesai',
        'description': 'Stock opname fisik bulan ini sudah dilakukan dan selisihnya sudah diposting ke jurnal.',
        'is_required': True,
        'display_order': 2,
    },
    {
        'code': 'ar_ap_aging_review',
        'label': 'AR/AP Aging Direview',
        'description': 'Piutang dan hutang usaha sudah direview - tidak ada saldo mencurigakan yang belum diinvestigasi.',
        'is_required': True,
        'display_order': 3,
    },
    {
        'code': 'payroll_posted',
        'label': 'Payroll Periode Ini Sudah Diposting',
        'description': 'Payroll untuk periode yang bersangkutan sudah dihitung, di-approve, dan jurnalnya sudah diposting.',
        'is_required': True,
        'display_order': 4,
    },
    {
        'code': 'pending_approvals_cleared',
        'label': 'Tidak Ada Approval Menggantung',
        'description': 'Tidak ada Purchase Invoice/Expense/Reimbursement bertanggal periode ini yang masih pending approval.',
        'is_required': False,
        'display_order': 5,
    },
]


def seed():
    app = create_app()
    with app.app_context():
        created, skipped = 0, 0
        for task_data in DEFAULT_TASKS:
            existing = ClosingTaskDefinition.query.filter_by(code=task_data['code']).first()
            if existing:
                skipped += 1
                continue
            db.session.add(ClosingTaskDefinition(**task_data))
            created += 1
            print(f"  [OK] {task_data['code']} - {task_data['label']}")
        db.session.commit()
        print(f"\nSelesai. Dibuat {created}, dilewati {skipped} (sudah ada).")


if __name__ == '__main__':
    seed()
