"""SAP-equivalence plan item #4 (2026-10-05): add lot_sizing_procedure
(EX/FX/WB/MB) + fixed_lot_size to materials, so utils.mrp_engine.run_mrp()
can round/pool planned orders per material instead of always lot-for-lot
+ MOQ. See Material.lot_sizing_procedure docstring in models/product.py
and utils/mrp_engine.py::_pool_planned_orders() for the full behavior.

Existing rows default to 'EX' (unchanged lot-for-lot behavior) via
server_default, so this is non-breaking for every material that doesn't
explicitly opt into FX/WB/MB.

Revision ID: c9e1a2b3d4f5
Revises: b7d3e4f5a6c1
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'c9e1a2b3d4f5'
down_revision = 'b7d3e4f5a6c1'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = sa.inspect(bind)
    return column_name in [c['name'] for c in inspector.get_columns(table_name)]


def upgrade():
    bind = op.get_bind()

    with op.batch_alter_table('materials', schema=None) as batch_op:
        if not _has_column(bind, 'materials', 'lot_sizing_procedure'):
            batch_op.add_column(sa.Column(
                'lot_sizing_procedure', sa.String(length=2), nullable=False,
                server_default='EX'
            ))
        if not _has_column(bind, 'materials', 'fixed_lot_size'):
            batch_op.add_column(sa.Column(
                'fixed_lot_size', sa.Numeric(precision=15, scale=2), nullable=True
            ))


def downgrade():
    bind = op.get_bind()

    with op.batch_alter_table('materials', schema=None) as batch_op:
        if _has_column(bind, 'materials', 'fixed_lot_size'):
            batch_op.drop_column('fixed_lot_size')
        if _has_column(bind, 'materials', 'lot_sizing_procedure'):
            batch_op.drop_column('lot_sizing_procedure')
