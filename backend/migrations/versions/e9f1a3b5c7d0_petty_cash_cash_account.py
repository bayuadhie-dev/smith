"""kas kecil: akun kas per dana (Kas Operasional), untuk banyak lokasi

Revision ID: e9f1a3b5c7d0
Revises: d8e0f2a4b6c9
"""
from alembic import op
import sqlalchemy as sa

revision = 'e9f1a3b5c7d0'
down_revision = 'd8e0f2a4b6c9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    have = [c['name'] for c in sa.inspect(bind).get_columns('petty_cash_funds')]
    if 'cash_account_id' not in have:
        op.add_column('petty_cash_funds', sa.Column('cash_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    acc = bind.execute(sa.text("select id from accounts where account_code='100001' and account_name ilike 'Kas Operasional%'")).scalar()
    if acc:
        bind.execute(sa.text("update petty_cash_funds set cash_account_id=:a where cash_account_id is null"), {'a': acc})


def downgrade():
    op.drop_column('petty_cash_funds', 'cash_account_id')
