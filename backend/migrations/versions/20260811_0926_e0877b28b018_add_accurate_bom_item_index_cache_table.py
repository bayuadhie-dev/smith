"""add accurate bom item index cache table

Revision ID: e0877b28b018
Revises: 93b93ad2c819
Create Date: 2026-08-11

Context: check_ejo()'s multi-level material tree expansion (Barang Jadi ->
WIP -> Mixing) needs to find, for any Accurate item, which Accurate BOM
produces it. Accurate's bill-of-material/list.do filter params are
confirmed unreliable (always returns the full unfiltered set), so this
requires a one-time scan of all ~643 BOMs to build an item_id -> bom_id
index. Without caching, this scan (~1.5-2 min) reruns on every ejo-check
call. This table persists that index so it only needs a manual re-scan
when Accurate's BOM structure actually changes.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e0877b28b018'
down_revision = '93b93ad2c819'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'accurate_bom_item_index',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('accurate_item_id', sa.Integer(), nullable=False, unique=True, index=True),
        sa.Column('accurate_item_name', sa.String(255), nullable=True),
        sa.Column('accurate_bom_id', sa.Integer(), nullable=False),
        sa.Column('accurate_bom_number', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('accurate_bom_item_index')
