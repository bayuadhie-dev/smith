"""forecast conversion tracking: add quantity, drop unique per line+month

Revision ID: 7a7dffbee3ab
Revises: 680fb1725c9e
Create Date: 2026-08-25 08:31:57.096029

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '7a7dffbee3ab'
down_revision = '680fb1725c9e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quantity', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'))
        batch_op.drop_constraint('uq_forecast_line_conversion_line_month', type_='unique')


def downgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_forecast_line_conversion_line_month', ['line_id', 'month'])
        batch_op.drop_column('quantity')
