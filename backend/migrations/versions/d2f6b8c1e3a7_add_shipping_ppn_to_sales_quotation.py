"""SAP-equivalence plan item #3 (2026-10-05): shipping_cost on
Quotation/SalesOrder was wired into total_amount as a raw untaxed
additive in a previous round, but freight billed to a customer is
generally subject to PPN like any other charge. Rather than hardcoding
a tax policy, this adds shipping_ppn_code (same Y/A/B/L code set as
Product/Material.ppn_code, see utils.tax_helpers.PPN_RATE_MAP) so the
user picks the right PPN code per order/quotation, plus
shipping_tax_amount to store the resolved tax so the frontend can show
a breakdown instead of just a lump total_amount.

Existing rows default to 'Y' (standard 11%) via server_default, which
matches this repo's existing ppn_code default on Product/Material.

Revision ID: d2f6b8c1e3a7
Revises: c9e1a2b3d4f5
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'd2f6b8c1e3a7'
down_revision = 'c9e1a2b3d4f5'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = sa.inspect(bind)
    return column_name in [c['name'] for c in inspector.get_columns(table_name)]


def _add_shipping_tax_columns(table_name):
    bind = op.get_bind()
    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if not _has_column(bind, table_name, 'shipping_ppn_code'):
            batch_op.add_column(sa.Column(
                'shipping_ppn_code', sa.String(length=5), nullable=True,
                server_default='Y'
            ))
        if not _has_column(bind, table_name, 'shipping_tax_amount'):
            batch_op.add_column(sa.Column(
                'shipping_tax_amount', sa.Numeric(precision=15, scale=2),
                nullable=True, server_default='0'
            ))


def _drop_shipping_tax_columns(table_name):
    bind = op.get_bind()
    with op.batch_alter_table(table_name, schema=None) as batch_op:
        if _has_column(bind, table_name, 'shipping_tax_amount'):
            batch_op.drop_column('shipping_tax_amount')
        if _has_column(bind, table_name, 'shipping_ppn_code'):
            batch_op.drop_column('shipping_ppn_code')


def upgrade():
    _add_shipping_tax_columns('quotations')
    _add_shipping_tax_columns('sales_orders')


def downgrade():
    _drop_shipping_tax_columns('sales_orders')
    _drop_shipping_tax_columns('quotations')
