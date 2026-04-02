"""Add reviewer2 fields and required_reviewers to dcc_document_revisions

Revision ID: 39a5c576ddc1
Revises: 9a5a816dcf64
Create Date: 2026-03-26 11:39:28.949471

"""
from alembic import op
import sqlalchemy as sa


revision = '39a5c576ddc1'
down_revision = '9a5a816dcf64'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('required_reviewers', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('reviewer2_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('reviewer2_signed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('reviewer2_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('reviewer2_status', sa.String(length=20), nullable=True))
        batch_op.create_foreign_key('fk_rev2_user', 'users', ['reviewer2_id'], ['id'])


def downgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_rev2_user', type_='foreignkey')
        batch_op.drop_column('reviewer2_status')
        batch_op.drop_column('reviewer2_notes')
        batch_op.drop_column('reviewer2_signed_at')
        batch_op.drop_column('reviewer2_id')
        batch_op.drop_column('required_reviewers')
