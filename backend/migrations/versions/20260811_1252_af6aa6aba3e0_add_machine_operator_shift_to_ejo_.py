"""add machine operator shift to ejo warehouse sync log

Revision ID: af6aa6aba3e0
Revises: f3633ff3c92b
Create Date: 2026-08-11

Context: the warehouse-stock-detail endpoint was re-fetching Mesin/
Operator/Shift live from Accurate's finished-good-slip for every log
entry on every view - with ~10 entries per product this took 30+
seconds. Store these fields directly on the sync log at sync time
instead, so the detail view becomes a fast local DB read.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'af6aa6aba3e0'
down_revision = 'f3633ff3c92b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ejo_warehouse_sync_log', schema=None) as batch_op:
        batch_op.add_column(sa.Column('machine', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('operator', sa.String(200), nullable=True))
        batch_op.add_column(sa.Column('shift', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('trans_date', sa.String(30), nullable=True))


def downgrade():
    with op.batch_alter_table('ejo_warehouse_sync_log', schema=None) as batch_op:
        batch_op.drop_column('trans_date')
        batch_op.drop_column('shift')
        batch_op.drop_column('operator')
        batch_op.drop_column('machine')
