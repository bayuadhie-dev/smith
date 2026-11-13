"""kas kecil HR: dana, transaksi, pengisian kembali + hak akses

Revision ID: c7d9e1f3a5b8
Revises: b6c8d0e2f4a7
"""
from alembic import op
import sqlalchemy as sa

revision = 'c7d9e1f3a5b8'
down_revision = 'b6c8d0e2f4a7'
branch_labels = None
depends_on = None

PERMS = [
    ('petty_cash.view', 'view', 'Lihat kas kecil'),
    ('petty_cash.create', 'create', 'Buat permintaan pengeluaran kas kecil'),
    ('petty_cash.approve', 'approve', 'Setujui/tolak pengeluaran kas kecil (Plant Manager)'),
    ('petty_cash.pay', 'pay', 'Cairkan pengeluaran kas kecil (pemegang kas)'),
    ('petty_cash.replenish', 'replenish', 'Ajukan dan terima pengisian kembali kas kecil'),
    ('petty_cash.replenish_approve', 'replenish_approve', 'Setujui pengisian kembali kas kecil (Finance)'),
    ('petty_cash.report', 'report', 'Laporan kas kecil'),
    ('petty_cash.manage', 'manage', 'Atur parameter, pemegang kas, dan penyetuju kas kecil'),
]
GRANTS = {
    'Super Admin': [p[0] for p in PERMS],
    'HR Manager': ['view', 'create', 'pay', 'replenish', 'report', 'manage'],
    'HR Staff': ['view', 'create', 'pay', 'replenish'],
    'Finance Manager': ['view', 'replenish_approve', 'report'],
    'Finance Staff': ['view', 'report'],
    'Director': ['view', 'approve', 'replenish_approve', 'report'],
    'Manager': ['view', 'approve'],
}


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = insp.get_table_names()
    if 'petty_cash_funds' not in existing:
        op.create_table(
            'petty_cash_funds',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('code', sa.String(30), nullable=False, unique=True),
            sa.Column('name', sa.String(150), nullable=False),
            sa.Column('fixed_amount', sa.Numeric(15, 2), nullable=False, server_default='1000000'),
            sa.Column('per_txn_limit', sa.Numeric(15, 2), nullable=False, server_default='500000'),
            sa.Column('min_balance', sa.Numeric(15, 2), nullable=False, server_default='100000'),
            sa.Column('custodian_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('approver_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
    if 'petty_cash_replenishments' not in existing:
        op.create_table(
            'petty_cash_replenishments',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('number', sa.String(50), nullable=False, unique=True),
            sa.Column('fund_id', sa.Integer, sa.ForeignKey('petty_cash_funds.id'), nullable=False),
            sa.Column('request_date', sa.Date, nullable=False),
            sa.Column('reason', sa.String(30), nullable=False),
            sa.Column('balance_at_request', sa.Numeric(15, 2), nullable=False),
            sa.Column('amount_requested', sa.Numeric(15, 2), nullable=False),
            sa.Column('status', sa.String(30), nullable=False, server_default='requested'),
            sa.Column('note', sa.Text, nullable=True),
            sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
            sa.Column('approved_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('approved_at', sa.DateTime, nullable=True),
            sa.Column('received_at', sa.DateTime, nullable=True),
            sa.Column('amount_received', sa.Numeric(15, 2), nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_petty_cash_replenishments_fund_id', 'petty_cash_replenishments', ['fund_id'])
        op.create_index('ix_petty_cash_replenishments_status', 'petty_cash_replenishments', ['status'])
    if 'petty_cash_transactions' not in existing:
        op.create_table(
            'petty_cash_transactions',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('number', sa.String(50), nullable=False, unique=True),
            sa.Column('fund_id', sa.Integer, sa.ForeignKey('petty_cash_funds.id'), nullable=False),
            sa.Column('request_date', sa.Date, nullable=False),
            sa.Column('requester_employee_id', sa.Integer, sa.ForeignKey('employees.id'), nullable=True),
            sa.Column('requester_name', sa.String(255), nullable=False),
            sa.Column('department', sa.String(150), nullable=True),
            sa.Column('purpose', sa.Text, nullable=False),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('amount', sa.Numeric(15, 2), nullable=False),
            sa.Column('receipt_number', sa.String(100), nullable=False),
            sa.Column('status', sa.String(30), nullable=False, server_default='submitted'),
            sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
            sa.Column('approved_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('approved_at', sa.DateTime, nullable=True),
            sa.Column('approval_note', sa.Text, nullable=True),
            sa.Column('paid_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('paid_at', sa.DateTime, nullable=True),
            sa.Column('rejected_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('rejected_at', sa.DateTime, nullable=True),
            sa.Column('rejection_reason', sa.Text, nullable=True),
            sa.Column('replenishment_id', sa.Integer, sa.ForeignKey('petty_cash_replenishments.id'), nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_petty_cash_transactions_fund_id', 'petty_cash_transactions', ['fund_id'])
        op.create_index('ix_petty_cash_transactions_request_date', 'petty_cash_transactions', ['request_date'])
        op.create_index('ix_petty_cash_transactions_status', 'petty_cash_transactions', ['status'])

    if bind.execute(sa.text("select count(*) from petty_cash_funds")).scalar() == 0:
        bind.execute(sa.text("insert into petty_cash_funds (code, name) values ('KK-HR', 'Kas Kecil HR')"))

    for name, action, desc in PERMS:
        if not bind.execute(sa.text("select 1 from permissions where name=:n"), {'n': name}).first():
            bind.execute(sa.text("insert into permissions (name, resource, module, action, description, is_active, created_at) values (:n, 'petty_cash', 'petty_cash', :a, :d, true, now())"),
                         {'n': name, 'a': action, 'd': desc})
    for role, acts in GRANTS.items():
        rid = bind.execute(sa.text("select id from roles where name=:r"), {'r': role}).scalar()
        if not rid:
            continue
        for a in acts:
            pname = a if a.startswith('petty_cash.') else f'petty_cash.{a}'
            pid = bind.execute(sa.text("select id from permissions where name=:n"), {'n': pname}).scalar()
            if pid and not bind.execute(sa.text("select 1 from role_permissions where role_id=:r and permission_id=:p"), {'r': rid, 'p': pid}).first():
                bind.execute(sa.text("insert into role_permissions (role_id, permission_id, created_at) values (:r, :p, now())"), {'r': rid, 'p': pid})


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("delete from role_permissions where permission_id in (select id from permissions where resource='petty_cash')"))
    bind.execute(sa.text("delete from permissions where resource='petty_cash'"))
    op.drop_table('petty_cash_transactions')
    op.drop_table('petty_cash_replenishments')
    op.drop_table('petty_cash_funds')
