"""accounts.currency + bank_name/account_number/account_holder

Revision ID: a1c3e5f7b9d2
Revises: f9a1b3d5c7e0
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c3e5f7b9d2'
down_revision = 'f9a1b3d5c7e0'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('accounts')}
    if 'currency' not in cols:
        op.add_column('accounts', sa.Column('currency', sa.String(10), nullable=False, server_default='IDR'))
    for name, size in (('bank_name', 100), ('account_number', 60), ('account_holder', 150)):
        if name not in cols:
            op.add_column('accounts', sa.Column(name, sa.String(size), nullable=True))


def downgrade():
    for name in ('account_holder', 'account_number', 'bank_name', 'currency'):
        op.drop_column('accounts', name)
