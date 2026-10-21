"""add conversion_factor to bom_items and work_order_bom_items

BOM UOM conversion gap (found during a SAP-gap audit, 2026-09-14 memory
note, confirmed still open 2026-10-20): BOMItem.uom was free text with no
conversion against the material's own stock-tracking UOM. If a BOM was
ever authored in a different unit than the material's stock UOM (e.g. BOM
in KG, material stock tracked in GRAM), every downstream consumer - MRP
explosion, Material Issue, WIP costing, the overcommit check - silently
used the raw number as if units matched, off by whatever the true
conversion factor is.

conversion_factor = how many of the material's stock-tracking UOM equal 1
of this BOM item's own uom (e.g. uom='KG', material stock in GRAM ->
conversion_factor=1000). Defaults to 1 (no-op) so every existing row,
where BOM uom already happens to match stock UOM, is unaffected.

Revision ID: a1b2c3d4e5f6
Revises: d8e2f0b4c6a1
Create Date: 2026-10-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '04c060c2beeb'
down_revision = 'd8e2f0b4c6a1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'bom_items',
        sa.Column('conversion_factor', sa.Numeric(18, 8), nullable=False, server_default='1')
    )
    op.add_column(
        'work_order_bom_items',
        sa.Column('conversion_factor', sa.Numeric(18, 8), nullable=False, server_default='1')
    )


def downgrade():
    op.drop_column('work_order_bom_items', 'conversion_factor')
    op.drop_column('bom_items', 'conversion_factor')
