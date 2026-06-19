"""Add expense and reimbursement tables

Revision ID: add_expense_tables
Revises: 
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'add_expense_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create expenses table
    op.create_table(
        'expenses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('expense_number', sa.String(length=50), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('employee_name', sa.String(length=255), nullable=True),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('expense_category', sa.String(length=100), nullable=False),
        sa.Column('expense_type', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=True),
        sa.Column('exchange_rate', sa.Numeric(precision=15, scale=6), nullable=True),
        sa.Column('amount_base', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('receipt_file_path', sa.String(length=500), nullable=True),
        sa.Column('receipt_file_name', sa.String(length=255), nullable=True),
        sa.Column('receipt_file_type', sa.String(length=50), nullable=True),
        sa.Column('receipt_file_size', sa.Integer(), nullable=True),
        sa.Column('receipt_uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('vendor_name', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('approval_notes', sa.Text(), nullable=True),
        sa.Column('rejected_by', sa.Integer(), nullable=True),
        sa.Column('rejected_at', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('reimbursement_id', sa.Integer(), nullable=True),
        sa.Column('reimbursed_at', sa.DateTime(), nullable=True),
        sa.Column('cost_center_id', sa.Integer(), nullable=True),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('journal_entry_id', sa.Integer(), nullable=True),
        sa.Column('posted_to_gl', sa.Boolean(), nullable=True),
        sa.Column('gl_posted_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['cost_center_id'], ['cost_centers.id'], ),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['accounting_entries.id'], ),
        sa.ForeignKeyConstraint(['rejected_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reimbursement_id'], ['reimbursements.id'], ),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_expenses_employee_id', 'expenses', ['employee_id'])
    op.create_index('ix_expenses_expense_date', 'expenses', ['expense_date'])
    op.create_index('ix_expenses_expense_number', 'expenses', ['expense_number'], unique=True)
    op.create_index('ix_expenses_reimbursement_id', 'expenses', ['reimbursement_id'])
    op.create_index('ix_expenses_status', 'expenses', ['status'])

    # Create reimbursements table
    op.create_table(
        'reimbursements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reimbursement_number', sa.String(length=50), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('employee_name', sa.String(length=255), nullable=True),
        sa.Column('total_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=10), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('bank_account_number', sa.String(length=100), nullable=True),
        sa.Column('bank_account_name', sa.String(length=255), nullable=True),
        sa.Column('bank_name', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_by', sa.Integer(), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('processed_by', sa.Integer(), nullable=True),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('paid_by', sa.Integer(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('payment_reference', sa.String(length=100), nullable=True),
        sa.Column('journal_entry_id', sa.Integer(), nullable=True),
        sa.Column('posted_to_gl', sa.Boolean(), nullable=True),
        sa.Column('gl_posted_at', sa.DateTime(), nullable=True),
        sa.Column('reimbursement_period_start', sa.Date(), nullable=True),
        sa.Column('reimbursement_period_end', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['accounting_entries.id'], ),
        sa.ForeignKeyConstraint(['paid_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['processed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_reimbursements_employee_id', 'reimbursements', ['employee_id'])
    op.create_index('ix_reimbursements_reimbursement_number', 'reimbursements', ['reimbursement_number'], unique=True)
    op.create_index('ix_reimbursements_status', 'reimbursements', ['status'])


def downgrade():
    op.drop_index('ix_reimbursements_status', table_name='reimbursements')
    op.drop_index('ix_reimbursements_reimbursement_number', table_name='reimbursements')
    op.drop_index('ix_reimbursements_employee_id', table_name='reimbursements')
    op.drop_table('reimbursements')
    op.drop_index('ix_expenses_status', table_name='expenses')
    op.drop_index('ix_expenses_reimbursement_id', table_name='expenses')
    op.drop_index('ix_expenses_expense_number', table_name='expenses')
    op.drop_index('ix_expenses_expense_date', table_name='expenses')
    op.drop_index('ix_expenses_employee_id', table_name='expenses')
    op.drop_table('expenses')
