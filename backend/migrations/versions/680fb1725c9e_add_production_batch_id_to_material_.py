"""add production_batch_id to material_issues for SPK-triggered staging

Revision ID: 680fb1725c9e
Revises: 15cf848c1849
Create Date: 2026-08-24 14:38:18.635265

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '680fb1725c9e'
down_revision = '15cf848c1849'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('material_issues', schema=None) as batch_op:
        batch_op.add_column(sa.Column('production_batch_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(None, 'production_batches', ['production_batch_id'], ['id'])


def downgrade():
    with op.batch_alter_table('material_issues', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('production_batch_id')
