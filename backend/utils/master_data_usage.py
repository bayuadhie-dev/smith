from sqlalchemy import text
from models import db

_FK_CACHE = {}


def _find_referencing_columns(foreign_table):
    """Discover every (table, column) pair with a FK pointing at foreign_table.column='id',
    via information_schema - so this stays correct as new modules/tables get added,
    without needing a hardcoded per-module list."""
    if foreign_table in _FK_CACHE:
        return _FK_CACHE[foreign_table]

    rows = db.session.execute(text('''
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = :foreign_table
        ORDER BY tc.table_name
    '''), {'foreign_table': foreign_table}).fetchall()

    result = [(r[0], r[1]) for r in rows]
    _FK_CACHE[foreign_table] = result
    return result


def get_usage(foreign_table, record_id, sample_limit=5):
    """For a given products/materials row id, return per-referencing-table usage counts
    plus a few sample row ids, across the entire schema (BOM, SO, PO, Inventory, QC, etc.)."""
    columns = _find_referencing_columns(foreign_table)
    usage = []
    for table_name, column_name in columns:
        try:
            count_row = db.session.execute(
                text(f'SELECT COUNT(*) FROM "{table_name}" WHERE "{column_name}" = :id'),
                {'id': record_id}
            ).fetchone()
            count = count_row[0] if count_row else 0
            if count == 0:
                continue

            samples = db.session.execute(
                text(f'SELECT id FROM "{table_name}" WHERE "{column_name}" = :id ORDER BY id DESC LIMIT :lim'),
                {'id': record_id, 'lim': sample_limit}
            ).fetchall()

            usage.append({
                'table': table_name,
                'column': column_name,
                'count': count,
                'sample_ids': [s[0] for s in samples],
            })
        except Exception:
            # a referencing table without a plain integer 'id' PK, or other schema oddity -
            # skip it rather than fail the whole usage lookup for one edge case
            db.session.rollback()
            continue

    usage.sort(key=lambda u: u['count'], reverse=True)
    return usage
