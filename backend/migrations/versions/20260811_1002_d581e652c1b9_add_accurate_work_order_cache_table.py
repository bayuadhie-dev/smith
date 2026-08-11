"""add accurate work order cache table

Revision ID: d581e652c1b9
Revises: e0877b28b018
Create Date: 2026-08-11

Context: "Data Modul" tab needs a browsable list of recent Accurate work
orders (EJO numbers) so users can click through to the EJO cross-check
instead of typing the number manually. Fetching this live (2500 WOs,
1 detail API call each) takes several minutes, so this table caches the
result of a manual scan (POST /accurate/work-order-cache-scan) for fast
tab loading, same pattern as accurate_bom_item_index.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd581e652c1b9'
down_revision = 'e0877b28b018'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'accurate_work_order_cache',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('accurate_id', sa.Integer(), nullable=False, unique=True, index=True),
        sa.Column('number', sa.String(100), nullable=False, index=True),
        sa.Column('item_name', sa.String(255), nullable=True),
        sa.Column('quantity_real', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(20), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('final_date', sa.String(30), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('accurate_work_order_cache')
