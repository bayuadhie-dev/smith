"""Add access control fields to DocumentTemplate (Fase 3)

Revision ID: 79f502aae1ce
Revises: fdb00c05b72e
Create Date: 2026-08-23 10:28:22.916932

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '79f502aae1ce'
down_revision = 'fdb00c05b72e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('document_templates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('access_scope', sa.String(length=20), nullable=False, server_default=sa.text("'all'")))
        batch_op.add_column(sa.Column('access_role_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))
        batch_op.add_column(sa.Column('access_user_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    with op.batch_alter_table('document_templates', schema=None) as batch_op:
        batch_op.drop_column('access_user_ids')
        batch_op.drop_column('access_role_ids')
        batch_op.drop_column('access_scope')
