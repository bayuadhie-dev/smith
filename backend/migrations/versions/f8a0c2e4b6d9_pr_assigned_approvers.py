"""PR approval: penyetuju per orang + token email untuk langkah PR

Revision ID: f8a0c2e4b6d9
Revises: e7f9b1d3a5c8
"""
from alembic import op
import sqlalchemy as sa

revision = 'f8a0c2e4b6d9'
down_revision = 'e7f9b1d3a5c8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    pa = [c['name'] for c in insp.get_columns('pr_approvals')]
    if 'assigned_user_id' not in pa:
        op.add_column('pr_approvals', sa.Column('assigned_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    if 'kind' not in pa:
        op.add_column('pr_approvals', sa.Column('kind', sa.String(20), nullable=True))
    op.alter_column('pr_approvals', 'required_role_id', existing_type=sa.Integer(), nullable=True)
    et = [c['name'] for c in insp.get_columns('approval_email_tokens')]
    if 'pr_approval_id' not in et:
        op.add_column('approval_email_tokens', sa.Column('pr_approval_id', sa.Integer(), sa.ForeignKey('pr_approvals.id', ondelete='CASCADE'), nullable=True))
        op.create_index('ix_approval_email_tokens_pr_approval_id', 'approval_email_tokens', ['pr_approval_id'])
    op.alter_column('approval_email_tokens', 'workflow_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.drop_index('ix_approval_email_tokens_pr_approval_id', table_name='approval_email_tokens')
    op.drop_column('approval_email_tokens', 'pr_approval_id')
    op.drop_column('pr_approvals', 'kind')
    op.drop_column('pr_approvals', 'assigned_user_id')
