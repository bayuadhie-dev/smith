"""convert default print-template font sizes from pt to mm

Revision ID: f7c2d9a41e83
Revises: e5a1c9d37b20
Create Date: 2026-10-24

The render engine treats canvas fontSize as mm (x2.83465 -> pt), but the
auto-generated default layouts were authored in pt, so every default
template (SPK, Surat Jalan, PO, ...) printed ~2.8x too large, clipped and
overlapping. Stored values >= 6 are pt-style (real mm sizes are ~2-6), so
only those are converted; already-mm values are left alone (idempotent).
"""
import json
from alembic import op
import sqlalchemy as sa

revision = 'f7c2d9a41e83'
down_revision = 'e5a1c9d37b20'
branch_labels = None
depends_on = None

FACTOR = 2.83465


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(sa.text('SELECT id, canvas_data FROM template_versions')).fetchall()
    for vid, data in rows:
        if isinstance(data, str):
            data = json.loads(data)
        if not data or not isinstance(data.get('objects'), list):
            continue
        changed = False
        for obj in data['objects']:
            fs = obj.get('fontSize')
            if isinstance(fs, (int, float)) and fs >= 6:
                obj['fontSize'] = round(fs / FACTOR, 3)
                changed = True
        if changed:
            conn.execute(
                sa.text('UPDATE template_versions SET canvas_data = CAST(:d AS JSON) WHERE id = :i'),
                {'d': json.dumps(data), 'i': vid},
            )


def downgrade():
    pass
