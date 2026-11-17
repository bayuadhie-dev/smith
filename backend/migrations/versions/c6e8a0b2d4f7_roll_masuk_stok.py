"""roll spunlace masuk stok: nomor batch di roll + zona Gudang Kain

Revision ID: c6e8a0b2d4f7
Revises: f1a3c5e7b9d2
"""
from alembic import op
import sqlalchemy as sa

revision = 'c6e8a0b2d4f7'
down_revision = 'f1a3c5e7b9d2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    have = [c['name'] for c in sa.inspect(bind).get_columns('production_rolls')]
    if 'batch_number' not in have:
        # Nomor batch di stok: nomor roll apa adanya, ditambah penanda putaran
        # kalau deret nomornya sudah berulang (mis. "500/P2").
        op.add_column('production_rolls', sa.Column('batch_number', sa.String(50), nullable=True))

    nama = bind.execute(sa.text("select company_name from company_profile order by id limit 1")).scalar() or ''
    if 'FENGSHENG' not in nama.upper():
        return

    zona = bind.execute(sa.text("select id from warehouse_zones where code = 'WH-KAIN'")).scalar()
    if not zona:
        bind.execute(sa.text("""
            insert into warehouse_zones (code, name, material_type, zone_type, description, is_active, created_at, updated_at)
            values ('WH-KAIN', 'Gudang Kain', 'wip', 'storage', 'Main roll dan jumbo roll keluaran spunlace', true, now(), now())
        """))
        zona = bind.execute(sa.text("select id from warehouse_zones where code = 'WH-KAIN'")).scalar()

    ada_lokasi = bind.execute(sa.text("select 1 from warehouse_locations where zone_id = :z"), {'z': zona}).first()
    if not ada_lokasi:
        bind.execute(sa.text("""
            insert into warehouse_locations (zone_id, location_code, rack, level, position, capacity, capacity_uom,
                                             occupied, is_active, is_available, created_at, updated_at)
            values (:z, 'KAIN-01', 'R1', 'L1', 'P1', 100000, 'kg', 0, true, true, now(), now())
        """), {'z': zona})


def downgrade():
    op.drop_column('production_rolls', 'batch_number')
