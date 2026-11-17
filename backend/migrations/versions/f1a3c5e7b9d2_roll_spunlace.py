"""roll spunlace: tabel production_rolls, berat cone di spesifikasi produk, mesin spunlace Fengsheng

Revision ID: f1a3c5e7b9d2
Revises: e5a7c9b1d3f6
"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a3c5e7b9d2'
down_revision = 'e5a7c9b1d3f6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if 'production_rolls' not in insp.get_table_names():
        op.create_table(
            'production_rolls',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('roll_number', sa.Integer(), nullable=False),
            sa.Column('cycle', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('repeat_number', sa.Integer(), nullable=True),
            sa.Column('roll_type', sa.String(10), nullable=False, server_default='main'),
            sa.Column('parent_roll_id', sa.Integer(), sa.ForeignKey('production_rolls.id'), nullable=True),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
            sa.Column('work_order_id', sa.Integer(), sa.ForeignKey('work_orders.id'), nullable=True),
            sa.Column('machine_id', sa.Integer(), sa.ForeignKey('machines.id'), nullable=True),
            sa.Column('produced_at', sa.Date(), nullable=False),
            sa.Column('shift', sa.String(20), nullable=True),
            sa.Column('gross_weight_kg', sa.Numeric(12, 2), nullable=False),
            sa.Column('net_weight_kg', sa.Numeric(12, 2), nullable=False),
            sa.Column('length_m', sa.Numeric(12, 2), nullable=True),
            sa.Column('width_cm', sa.Numeric(10, 2), nullable=True),
            sa.Column('grade', sa.String(1), nullable=False, server_default='A'),
            sa.Column('status', sa.String(20), nullable=False, server_default='available'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_production_rolls_number', 'production_rolls', ['roll_number'])
        op.create_index('ix_production_rolls_produced', 'production_rolls', ['produced_at'])
        op.create_index('ix_production_rolls_product', 'production_rolls', ['product_id'])
        op.create_index('ix_production_rolls_status', 'production_rolls', ['status'])

    # Berat cone per pcs: acuan saja, tidak dipakai menghitung berat bersih.
    spek = [c['name'] for c in insp.get_columns('product_specifications')]
    if 'cone_weight_kg' not in spek:
        op.add_column('product_specifications', sa.Column('cone_weight_kg', sa.Numeric(10, 3), nullable=True))

    # Satu mesin spunlace untuk Fengsheng (prosesnya tidak dipecah per bagian).
    nama = bind.execute(sa.text("select company_name from company_profile order by id limit 1")).scalar() or ''
    if 'FENGSHENG' in nama.upper():
        ada = bind.execute(sa.text("select 1 from machines where code = 'SPUNLACE-01'")).first()
        if not ada:
            bind.execute(sa.text("""
                insert into machines (code, name, machine_type, department, status, is_active, created_at, updated_at)
                values ('SPUNLACE-01', 'Mesin Spunlace', 'spunlace', 'Spunlace', 'idle', true, now(), now())
            """))


def downgrade():
    op.drop_table('production_rolls')
    op.drop_column('product_specifications', 'cone_weight_kg')
