"""SAP-equivalence plan item #1 (2026-10-05): persist movement_type on
inventory_transactions instead of deriving the SAP 3-digit movement type
code (101/131/261/311/551/552/601/701/702/999) at read time on every
request. See utils.inventory_helpers.derive_movement_type_code() for the
mapping logic, now called at write time by record_inventory_transaction()
and at the handful of raw InventoryTransaction(...) construction sites
(routes/wms_advanced.py, utils/accurate_client.py).

- inventory_transactions.movement_type (VARCHAR(3), nullable, indexed) -
  new column. Nullable because historical rows predate it; the API layer
  (routes/wms_advanced.py's enrich_transaction_dict()) falls back to
  deriving it on read for any row where this is still NULL. Backfilling
  existing rows is a separate one-off script
  (backend/scripts/backfill_movement_type.py), not part of this migration,
  per this repo's established pattern for one-off data scripts.

Revision ID: b7d3e4f5a6c1
Revises: a4f8c2e91d3b
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7d3e4f5a6c1'
down_revision = 'a4f8c2e91d3b'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = sa.inspect(bind)
    return column_name in [c['name'] for c in inspector.get_columns(table_name)]


def upgrade():
    bind = op.get_bind()

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        if not _has_column(bind, 'inventory_transactions', 'movement_type'):
            batch_op.add_column(sa.Column('movement_type', sa.String(length=3), nullable=True))
            batch_op.create_index('ix_inventory_transactions_movement_type', ['movement_type'])


def downgrade():
    bind = op.get_bind()

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        if _has_column(bind, 'inventory_transactions', 'movement_type'):
            batch_op.drop_index('ix_inventory_transactions_movement_type')
            batch_op.drop_column('movement_type')
