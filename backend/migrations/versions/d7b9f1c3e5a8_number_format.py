"""number_sequences gets a full format template and a reset period

Finance asked for purchase orders numbered YY-MM-OLC-#### (26-11-OLC-011),
with the sequence restarting per year, instead of the built-in
PO-YYYYMM-00001. A prefix alone cannot express that - the text sits in the
middle and the year comes first - so the sequence row now carries the whole
template plus when it restarts.

Revision ID: d7b9f1c3e5a8
Revises: c6e8a0b2d4f7
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'd7b9f1c3e5a8'
down_revision = 'c6e8a0b2d4f7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c['name'] for c in sa.inspect(bind).get_columns('number_sequences')}
    with op.batch_alter_table('number_sequences') as batch:
        if 'number_format' not in cols:
            batch.add_column(sa.Column('number_format', sa.String(length=100), nullable=True))
        if 'reset_period' not in cols:
            batch.add_column(sa.Column('reset_period', sa.String(length=10), nullable=False,
                                       server_default='month'))

    # Purchase orders start on the format Finance uses on paper. Only their
    # company gets it; the sandbox keeps whatever it already had, and any
    # other instance is left untouched.
    company = bind.execute(sa.text("SELECT company_name FROM company_profile LIMIT 1")).fetchone()
    if company and 'FENGSHENG' in (company[0] or '').upper():
        row = bind.execute(sa.text(
            "SELECT id FROM number_sequences WHERE sequence_key = 'purchase_order'")).fetchone()
        if row:
            bind.execute(sa.text(
                "UPDATE number_sequences SET number_format = :f, reset_period = 'year' WHERE id = :id"),
                {'f': 'YY-MM-OLC-###', 'id': row[0]})
        else:
            bind.execute(sa.text(
                "INSERT INTO number_sequences (sequence_key, prefix, description, number_format, reset_period)"
                " VALUES ('purchase_order', 'PO', 'Pesanan Pembelian', 'YY-MM-OLC-###', 'year')"))


def downgrade():
    with op.batch_alter_table('number_sequences') as batch:
        batch.drop_column('reset_period')
        batch.drop_column('number_format')
