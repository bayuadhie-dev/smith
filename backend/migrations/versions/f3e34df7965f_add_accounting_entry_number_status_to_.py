"""add accounting_entry_number/status to inventory_transactions

Revision ID: f3e34df7965f
Revises: b3c8e2f6a1d4
Create Date: 2026-09-21 15:19:18.959596

NOTE: autogenerate also proposed dropping 9 unrelated tables (webhooks,
external_connectors, data_sync_jobs, api_endpoints, webhook_deliveries,
purchase_invoices_deprecated, purchase_invoice_items_deprecated,
fixed_assets, sync_job_executions) - pre-existing DB drift (tables with no
current SQLAlchemy model) unrelated to this change and NOT something this
migration should touch. Hand-trimmed to only the two new columns + their
index.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f3e34df7965f'
down_revision = 'b3c8e2f6a1d4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('accounting_entry_number', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('accounting_entry_status', sa.String(length=20), nullable=True))
        batch_op.create_index(batch_op.f('ix_inventory_transactions_accounting_entry_number'), ['accounting_entry_number'], unique=False)


def downgrade():
    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inventory_transactions_accounting_entry_number'))
        batch_op.drop_column('accounting_entry_status')
        batch_op.drop_column('accounting_entry_number')
