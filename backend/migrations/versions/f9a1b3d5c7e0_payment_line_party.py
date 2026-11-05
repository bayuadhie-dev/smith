"""payment_lines.party_type/party_id (pemasok/pelanggan untuk akun uang muka)

Revision ID: f9a1b3d5c7e0
Revises: e8f0a2c4d6b9
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'f9a1b3d5c7e0'
down_revision = 'e8f0a2c4d6b9'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('payment_lines')}
    if 'party_type' not in cols:
        op.add_column('payment_lines', sa.Column('party_type', sa.String(20), nullable=True))
    if 'party_id' not in cols:
        op.add_column('payment_lines', sa.Column('party_id', sa.Integer, nullable=True))


def downgrade():
    op.drop_column('payment_lines', 'party_id')
    op.drop_column('payment_lines', 'party_type')
