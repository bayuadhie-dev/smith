"""Add PurchaseInvoice and PurchaseReturn models

Revision ID: 7889c902bbc1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 08:40:06.827269

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7889c902bbc1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Create purchase_invoices table
    op.create_table('purchase_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_number', sa.String(length=100), nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('supplier_invoice_number', sa.String(length=100), nullable=True),
        sa.Column('supplier_invoice_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('payment_status', sa.String(length=50), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('exchange_rate', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('payment_terms', sa.String(length=100), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('subtotal', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('shipping_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('other_charges', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('total_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('amount_paid', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('balance_due', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('received_by', sa.Integer(), nullable=True),
        sa.Column('posted_by', sa.Integer(), nullable=True),
        sa.Column('posted_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], name='fk_purchase_invoices_po_id'),
        sa.ForeignKeyConstraint(['posted_by'], ['users.id'], name='fk_purchase_invoices_posted_by'),
        sa.ForeignKeyConstraint(['received_by'], ['users.id'], name='fk_purchase_invoices_received_by'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_purchase_invoices_supplier_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number', name='uq_purchase_invoices_invoice_number')
    )
    op.create_index('ix_purchase_invoices_invoice_date', 'purchase_invoices', ['invoice_date'], unique=False)

    # Create purchase_invoice_items table
    op.create_table('purchase_invoice_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('po_item_id', sa.Integer(), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('material_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('quantity', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('uom', sa.String(length=20), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('tax_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('total_price', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('quantity_returned', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id'], ondelete='CASCADE', name='fk_purchase_invoice_items_invoice_id'),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id'], name='fk_purchase_invoice_items_material_id'),
        sa.ForeignKeyConstraint(['po_item_id'], ['purchase_order_items.id'], name='fk_purchase_invoice_items_po_item_id'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], name='fk_purchase_invoice_items_product_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_id', 'line_number', name='uq_purchase_invoice_items_line')
    )

    # Create purchase_returns table
    op.create_table('purchase_returns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('return_number', sa.String(length=100), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('return_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('approval_status', sa.String(length=50), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('exchange_rate', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('subtotal', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('total_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('credit_note_number', sa.String(length=100), nullable=True),
        sa.Column('credit_note_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name='fk_purchase_returns_approved_by'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_purchase_returns_created_by'),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id'], name='fk_purchase_returns_invoice_id'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_purchase_returns_supplier_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_number', name='uq_purchase_returns_return_number')
    )
    op.create_index('ix_purchase_returns_return_date', 'purchase_returns', ['return_date'], unique=False)

    # Create purchase_return_items table
    op.create_table('purchase_return_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('return_id', sa.Integer(), nullable=False),
        sa.Column('invoice_item_id', sa.Integer(), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('material_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('quantity', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('uom', sa.String(length=20), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('discount_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('discount_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('tax_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('total_price', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['invoice_item_id'], ['purchase_invoice_items.id'], name='fk_purchase_return_items_invoice_item_id'),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id'], name='fk_purchase_return_items_material_id'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], name='fk_purchase_return_items_product_id'),
        sa.ForeignKeyConstraint(['return_id'], ['purchase_returns.id'], ondelete='CASCADE', name='fk_purchase_return_items_return_id'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_id', 'line_number', name='uq_purchase_return_items_line')
    )


def downgrade():
    op.drop_table('purchase_return_items')
    op.drop_index('ix_purchase_returns_return_date', table_name='purchase_returns')
    op.drop_table('purchase_returns')
    op.drop_table('purchase_invoice_items')
    op.drop_index('ix_purchase_invoices_invoice_date', table_name='purchase_invoices')
    op.drop_table('purchase_invoices')
