"""kas kecil: dana pertama ternyata kas pabrik Purbalingga (dipegang HR), bukan 'HR'

Revision ID: f0a2b4c6d8e1
Revises: e9f1a3b5c7d0
"""
from alembic import op
import sqlalchemy as sa

revision = 'f0a2b4c6d8e1'
down_revision = 'e9f1a3b5c7d0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.execute(sa.text("select 1 from petty_cash_funds where code='KK-PBG'")).first():
        return
    bind.execute(sa.text("update petty_cash_funds set code='KK-PBG', name='Kas Kecil Purbalingga' where code='KK-HR' and name='Kas Kecil HR'"))


def downgrade():
    pass
