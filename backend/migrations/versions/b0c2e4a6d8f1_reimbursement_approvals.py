"""reimbursement_approvals + token email untuk reimbursement

Revision ID: b0c2e4a6d8f1
Revises: a9b1d3f5c7e0
"""
from alembic import op
import sqlalchemy as sa

revision = 'b0c2e4a6d8f1'
down_revision = 'a9b1d3f5c7e0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'reimbursement_approvals' not in insp.get_table_names():
        op.create_table(
            'reimbursement_approvals',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('reimbursement_id', sa.Integer(), sa.ForeignKey('reimbursements.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('approval_level', sa.Integer(), nullable=False),
            sa.Column('assigned_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('kind', sa.String(20), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('approver_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('comments', sa.Text(), nullable=True),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    et = [c['name'] for c in sa.inspect(bind).get_columns('approval_email_tokens')]
    if 'reimbursement_approval_id' not in et:
        op.add_column('approval_email_tokens', sa.Column('reimbursement_approval_id', sa.Integer(), sa.ForeignKey('reimbursement_approvals.id', ondelete='CASCADE'), nullable=True))
        op.create_index('ix_approval_email_tokens_reimb_approval_id', 'approval_email_tokens', ['reimbursement_approval_id'])


def downgrade():
    op.drop_index('ix_approval_email_tokens_reimb_approval_id', table_name='approval_email_tokens')
    op.drop_column('approval_email_tokens', 'reimbursement_approval_id')
    op.drop_table('reimbursement_approvals')
