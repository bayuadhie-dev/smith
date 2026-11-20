"""Permintaan Barang bisa menunjuk formula / eksperimen R&D

Eksperimen R&D dulu hanya mencatat pemakaian bahan sebagai angka; stok gudang
tidak pernah berkurang. Sekarang bahan trial keluar lewat Permintaan Barang,
dokumen yang sama dengan produksi, jadi gudang menyiapkan dan stok berkurang
saat barang benar-benar diserahkan.

Revision ID: b9d1f3a5c7e9
Revises: a7c9e1b3d5f7
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'b9d1f3a5c7e9'
down_revision = 'a7c9e1b3d5f7'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('material_issues')}
    with op.batch_alter_table('material_issues') as batch:
        if 'rnd_formula_id' not in cols:
            batch.add_column(sa.Column('rnd_formula_id', sa.Integer(), nullable=True))
            batch.create_foreign_key('fk_material_issues_rnd_formula', 'rnd_formulas', ['rnd_formula_id'], ['id'])
        if 'rnd_experiment_id' not in cols:
            batch.add_column(sa.Column('rnd_experiment_id', sa.Integer(), nullable=True))
            batch.create_foreign_key('fk_material_issues_rnd_experiment', 'rnd_experiments', ['rnd_experiment_id'], ['id'])


def downgrade():
    with op.batch_alter_table('material_issues') as batch:
        batch.drop_constraint('fk_material_issues_rnd_experiment', type_='foreignkey')
        batch.drop_column('rnd_experiment_id')
        batch.drop_constraint('fk_material_issues_rnd_formula', type_='foreignkey')
        batch.drop_column('rnd_formula_id')
