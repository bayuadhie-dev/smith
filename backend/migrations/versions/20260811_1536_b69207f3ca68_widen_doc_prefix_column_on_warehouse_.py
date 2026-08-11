"""widen doc_prefix column on warehouse transfer log

Revision ID: b69207f3ca68
Revises: 2b581ecbc742
Create Date: 2026-08-11

Context: transaction numbers aren't all PL-*/IT-* as initially assumed -
some are ONLINE-prefixed with a longer prefix (e.g. "ONLINE 15072026-1"),
overflowing the original varchar(10). Widened to varchar(30).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b69207f3ca68'
down_revision = '2b581ecbc742'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('accurate_warehouse_transfer_log', schema=None) as batch_op:
        batch_op.alter_column('doc_prefix', existing_type=sa.String(10), type_=sa.String(30))


def downgrade():
    with op.batch_alter_table('accurate_warehouse_transfer_log', schema=None) as batch_op:
        batch_op.alter_column('doc_prefix', existing_type=sa.String(30), type_=sa.String(10))
