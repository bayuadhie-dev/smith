"""Add assigned_reviewer_id, assigned_reviewer2_id, assigned_approver_id to dcc_document_revisions

Revision ID: b1c3f4e5a6d7
Revises: 39a5c576ddc1
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c3f4e5a6d7'
down_revision = '39a5c576ddc1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assigned_reviewer_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('assigned_reviewer2_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('assigned_approver_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_assigned_rev1', 'users', ['assigned_reviewer_id'], ['id'])
        batch_op.create_foreign_key('fk_assigned_rev2', 'users', ['assigned_reviewer2_id'], ['id'])
        batch_op.create_foreign_key('fk_assigned_appr', 'users', ['assigned_approver_id'], ['id'])


def downgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_assigned_appr', type_='foreignkey')
        batch_op.drop_constraint('fk_assigned_rev2', type_='foreignkey')
        batch_op.drop_constraint('fk_assigned_rev1', type_='foreignkey')
        batch_op.drop_column('assigned_approver_id')
        batch_op.drop_column('assigned_reviewer2_id')
        batch_op.drop_column('assigned_reviewer_id')
