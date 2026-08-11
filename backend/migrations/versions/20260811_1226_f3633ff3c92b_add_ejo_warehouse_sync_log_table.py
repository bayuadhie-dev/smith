"""add ejo warehouse sync log table

Revision ID: f3633ff3c92b
Revises: d581e652c1b9
Create Date: 2026-08-11

Context: syncing EPD/FG warehouse stock from Accurate EJO processHistory
(MS -> EPD, FGS -> FG) is cumulative/historical per user decision, not a
snapshot - so re-running the manual sync must not double-count an EJO's
quantity into Inventory again. This log tracks which EJO+stage
combinations have already been applied.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f3633ff3c92b'
down_revision = 'd581e652c1b9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ejo_warehouse_sync_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ejo_number', sa.String(100), nullable=False, index=True),
        sa.Column('stage_type', sa.String(20), nullable=False),  # MS or FGS
        sa.Column('accurate_work_order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('quantity_added', sa.Float(), nullable=True),
        sa.Column('inventory_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('ejo_number', 'stage_type', name='uq_ejo_stage_sync'),
    )


def downgrade():
    op.drop_table('ejo_warehouse_sync_log')
