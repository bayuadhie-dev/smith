"""bank_transfers: transfer dana antar akun kas/bank sendiri

Revision ID: c5e7a9b1d3f4
Revises: b3d5f7a9c1e8
"""
from alembic import op
import sqlalchemy as sa

revision = 'c5e7a9b1d3f4'
down_revision = 'b3d5f7a9c1e8'
branch_labels = None
depends_on = None


def upgrade():
    if 'bank_transfers' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'bank_transfers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('number', sa.String(50), nullable=False),
        sa.Column('transfer_date', sa.Date(), nullable=False),
        sa.Column('from_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('to_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('amount_received', sa.Numeric(18, 2), nullable=True),
        sa.Column('fee_amount', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('fee_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True),
        sa.Column('fee_charged_to', sa.String(10), nullable=False, server_default='from'),
        sa.Column('exchange_rate', sa.Numeric(18, 6), nullable=True),
        sa.Column('exchange_rate_to', sa.Numeric(18, 6), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='posted'),
        sa.Column('journal_number', sa.String(50), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('cancelled_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_bank_transfers_number', 'bank_transfers', ['number'], unique=True)
    op.create_index('ix_bank_transfers_transfer_date', 'bank_transfers', ['transfer_date'])
    op.create_index('ix_bank_transfers_status', 'bank_transfers', ['status'])


def downgrade():
    op.drop_table('bank_transfers')
