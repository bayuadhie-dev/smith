"""add credit memos (nota kredit customer)

Revision ID: b4d6f8a1c3e5
Revises: a9b3d5e7c2f1
Create Date: 2026-10-25

Sales-return credit that cannot be applied to an invoice is kept as a credit memo
that can later be applied to an open invoice or refunded in cash.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b4d6f8a1c3e5'
down_revision = 'a9b3d5e7c2f1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'credit_memos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('memo_number', sa.String(100), nullable=False, unique=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('memo_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('amount_applied', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('amount_refunded', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('source_type', sa.String(50)),
        sa.Column('source_id', sa.Integer()),
        sa.Column('notes', sa.Text()),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_credit_memos_memo_number', 'credit_memos', ['memo_number'])
    op.create_index('ix_credit_memos_customer_id', 'credit_memos', ['customer_id'])
    op.create_table(
        'credit_memo_applications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('memo_id', sa.Integer(), sa.ForeignKey('credit_memos.id'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id')),
        sa.Column('bank_account_id', sa.Integer(), sa.ForeignKey('accounts.id')),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('applied_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_credit_memo_applications_memo_id', 'credit_memo_applications', ['memo_id'])


def downgrade():
    op.drop_table('credit_memo_applications')
    op.drop_table('credit_memos')
