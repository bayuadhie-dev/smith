"""mesin: rapikan nilai status dan pindahkan daftar mesin Fengsheng dari erp_db_v2

Revision ID: e8a0c2d4f6b9
Revises: d6f8b0c2e4a7
"""
from alembic import op
import sqlalchemy as sa

revision = 'e8a0c2d4f6b9'
down_revision = 'd6f8b0c2e4a7'
branch_labels = None
depends_on = None

# Status mesin yang sah. 'active' sempat terpakai di satu baris dan bukan bagian
# dari daftar ini - nilai di luar daftar dikembalikan ke 'idle'.
VALID = ('idle', 'running', 'maintenance', 'breakdown', 'offline')

# Daftar mesin Fengsheng, disalin apa adanya dari erp_db_v2 (sudah dirapikan user:
# MC 9 memang tidak ada). department diisi di sini karena di sumbernya kosong dan
# jenis mesin EPD dulu ditulis di kolom machine_type.
EPD = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12]
CONVERTING = [
    ('CVT-SLIT-01', 'Slitting 1', 'slitting'),
    ('CVT-SLIT-02', 'Slitting 2', 'slitting'),
    ('CVT-FOLD-200A', 'Folding 200 (1)', 'folding'),
    ('CVT-FOLD-200B', 'Folding 200 (2)', 'folding'),
    ('CVT-FOLD-280', 'Folding 280', 'folding'),
    ('CVT-FOLD-320', 'Folding 320', 'folding'),
    ('CVT-FOLD-600', 'Folding 600', 'folding'),
    ('CVT-PERF-01', 'Perforating 1', 'perforating'),
    ('CVT-PERF-02', 'Perforating 2', 'perforating'),
    ('CVT-LAMI-01', 'Laminasi Kain', 'laminasi'),
    ('CVT-CUT-01', 'Cutting', 'cutting'),
    ('CVT-BAGM-01', 'Bagmaker', 'bagmaker'),
]


def upgrade():
    bind = op.get_bind()

    bind.execute(
        sa.text("update machines set status = 'idle', updated_at = now() where status not in :v")
        .bindparams(sa.bindparam('v', expanding=True)), {'v': list(VALID)})

    nama = bind.execute(sa.text("select company_name from company_profile order by id limit 1")).scalar() or ''
    sudah_ada = bind.execute(sa.text("select count(*) from machines")).scalar()
    if 'FENGSHENG' not in nama.upper() or sudah_ada:
        return

    for n in EPD:
        bind.execute(sa.text("""
            insert into machines (code, name, machine_type, department, machine_number, status, is_active, created_at, updated_at)
            values (:c, :n, 'wet_wipes', 'EPD', :num, 'idle', true, now(), now())
        """), {'c': f'MC {n}', 'n': f'Mesin {n}', 'num': n})

    for code, name, tipe in CONVERTING:
        bind.execute(sa.text("""
            insert into machines (code, name, machine_type, department, status, is_active, created_at, updated_at)
            values (:c, :n, :t, 'Converting', 'idle', true, now(), now())
        """), {'c': code, 'n': name, 't': tipe})


def downgrade():
    bind = op.get_bind()
    nama = bind.execute(sa.text("select company_name from company_profile order by id limit 1")).scalar() or ''
    if 'FENGSHENG' in nama.upper():
        kode = [f'MC {n}' for n in EPD] + [c for c, _, _ in CONVERTING]
        bind.execute(sa.text("delete from machines where code in :k").bindparams(sa.bindparam('k', expanding=True)),
                     {'k': kode})
