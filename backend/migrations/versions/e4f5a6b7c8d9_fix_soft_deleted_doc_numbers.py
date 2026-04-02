"""fix soft-deleted document numbers — rename agar unique constraint tidak block reuse

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-03-31 09:16:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    # Rename document_number dari semua dokumen yang sudah soft-deleted (is_active=0)
    # agar unique constraint tidak block pembuatan dokumen baru dengan nomor yang sama
    conn = op.get_bind()
    results = conn.execute(
        sa.text("SELECT id, document_number FROM dcc_documents WHERE is_active = 0 AND document_number NOT LIKE '_DEL_%'")
    ).fetchall()
    for row in results:
        doc_id = row[0]
        doc_number = row[1]
        new_number = f"_DEL_{doc_id}_{doc_number}"
        conn.execute(
            sa.text("UPDATE dcc_documents SET document_number = :new_num WHERE id = :doc_id"),
            {"new_num": new_number, "doc_id": doc_id}
        )


def downgrade():
    # Restore original document_number dari soft-deleted documents
    conn = op.get_bind()
    results = conn.execute(
        sa.text("SELECT id, document_number FROM dcc_documents WHERE document_number LIKE '_DEL_%'")
    ).fetchall()
    for row in results:
        doc_id = row[0]
        doc_number = row[1]
        # Strip _DEL_{id}_ prefix
        parts = doc_number.split('_', 3)
        if len(parts) >= 4:
            original = parts[3]
            conn.execute(
                sa.text("UPDATE dcc_documents SET document_number = :orig WHERE id = :doc_id"),
                {"orig": original, "doc_id": doc_id}
            )
