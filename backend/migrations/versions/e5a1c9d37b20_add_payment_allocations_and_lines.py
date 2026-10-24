"""add payment_allocations and payment_lines

Revision ID: e5a1c9d37b20
Revises: b3115f4ab498
Create Date: 2026-10-24

One Payment can now settle several invoices (payment_allocations) and a
standalone Kas/Bank transaction can be split over several accounts
(payment_lines). Existing single-invoice / single-contra rows are
backfilled into the new tables so reads can use one code path.
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5a1c9d37b20'
down_revision = 'b3115f4ab498'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'payment_allocations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=False),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
    )
    op.create_index('ix_payment_allocations_payment_id', 'payment_allocations', ['payment_id'])
    op.create_index('ix_payment_allocations_invoice_id', 'payment_allocations', ['invoice_id'])
    op.create_table(
        'payment_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('payment_id', sa.Integer(), sa.ForeignKey('payments.id'), nullable=False),
        sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
    )
    op.create_index('ix_payment_lines_payment_id', 'payment_lines', ['payment_id'])

    op.execute("""
        INSERT INTO payment_allocations (payment_id, invoice_id, amount)
        SELECT id, invoice_id, amount FROM payments WHERE invoice_id IS NOT NULL
    """)
    op.execute("""
        INSERT INTO payment_lines (payment_id, account_id, amount, description)
        SELECT id, contra_account_id, amount, notes FROM payments
        WHERE invoice_id IS NULL AND contra_account_id IS NOT NULL
    """)


def downgrade():
    op.drop_table('payment_lines')
    op.drop_table('payment_allocations')
