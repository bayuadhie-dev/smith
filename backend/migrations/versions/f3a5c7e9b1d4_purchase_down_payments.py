"""purchase down payments (uang muka pembelian) + allocations to purchase invoices

Revision ID: f3a5c7e9b1d4
Revises: e2f4b6d8a0c3
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a5c7e9b1d4'
down_revision = 'e2f4b6d8a0c3'
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if 'purchase_down_payments' not in tables:
        op.create_table(
            'purchase_down_payments',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('dp_number', sa.String(100), nullable=False, unique=True),
            sa.Column('po_id', sa.Integer, sa.ForeignKey('purchase_orders.id'), nullable=True),
            sa.Column('supplier_id', sa.Integer, sa.ForeignKey('suppliers.id'), nullable=False),
            sa.Column('dp_date', sa.Date, nullable=False),
            sa.Column('amount', sa.Numeric(15, 2), nullable=False),
            sa.Column('allocated_amount', sa.Numeric(15, 2), nullable=False, server_default='0'),
            sa.Column('bank_account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=False),
            sa.Column('dp_account_id', sa.Integer, sa.ForeignKey('accounts.id'), nullable=True),
            sa.Column('payment_method', sa.String(50), nullable=False, server_default='bank_transfer'),
            sa.Column('reference_number', sa.String(100), nullable=True),
            sa.Column('notes', sa.Text, nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='posted'),
            sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=True),
        )
        op.create_index('ix_purchase_down_payments_po_id', 'purchase_down_payments', ['po_id'])
        op.create_index('ix_purchase_down_payments_supplier_id', 'purchase_down_payments', ['supplier_id'])
    if 'purchase_down_payment_allocations' not in tables:
        op.create_table(
            'purchase_down_payment_allocations',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('down_payment_id', sa.Integer, sa.ForeignKey('purchase_down_payments.id', ondelete='CASCADE'), nullable=False),
            sa.Column('invoice_id', sa.Integer, sa.ForeignKey('invoices.id'), nullable=False),
            sa.Column('amount', sa.Numeric(15, 2), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='active'),
            sa.Column('allocated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('allocated_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        )
        op.create_index('ix_pdp_alloc_down_payment_id', 'purchase_down_payment_allocations', ['down_payment_id'])
        op.create_index('ix_pdp_alloc_invoice_id', 'purchase_down_payment_allocations', ['invoice_id'])


def downgrade():
    op.drop_table('purchase_down_payment_allocations')
    op.drop_table('purchase_down_payments')
