"""
Custom Report Builder whitelist registry (2026-10-06) - external-audit
mock-data cleanup, category 3 item 1/3. Replaces
CustomReportBuilder.tsx's Math.random()-fabricated preview rows with a
real, SAFE query engine.

Safety design: every selectable/filterable/groupable field is an entry
in DATA_SOURCES below, resolved to a real SQLAlchemy column object (or
a joined column). User input is NEVER interpolated into SQL text - a
field/dataSource/operator name from the request is only ever used as a
dict key to look up a column object from this registry; anything not
found is rejected with 400, never silently passed through to a query.

Each data source maps 1:1 to the `dataSources` array already defined in
frontend/src/pages/Reports/CustomReportBuilder.tsx - that file is kept
in sync as the UI-facing source of truth for field labels. A few
frontend fields (SKU, defect_count, sales_rep, maintenance cost) had no
real backing column anywhere in the schema and were dropped from BOTH
sides rather than faked - see CustomReportBuilder.tsx's updated
dataSources for the corrected field list.

Limitation (documented, not silently glossed over): multiple
dataSources can be selected in one report, but each is queried
independently and returned as its own labeled result set - there is no
general-purpose safe way to auto-join unrelated domains (e.g. Waste
Records + Quality Tests have no natural join key), so this does not
attempt a cross-source join.
"""
from models import db
from models.sales import SalesOrder, Customer
from models.production import WorkOrder, Machine
from models.product import Product
from models.warehouse import Inventory, WarehouseLocation
from models.quality import QualityTest
from models.waste import WasteRecord, WasteCategory
from models.maintenance import MaintenanceRecord
from sqlalchemy import func


DATA_SOURCES = {
    'sales': {
        'model': SalesOrder,
        'joins': [(Customer, SalesOrder.customer_id == Customer.id)],
        'fields': {
            'order_number': SalesOrder.order_number,
            'customer_name': Customer.company_name,
            'total_amount': SalesOrder.total_amount,
            'order_date': SalesOrder.order_date,
            'status': SalesOrder.status,
        },
        'numeric_fields': {'total_amount'},
    },
    'production': {
        'model': WorkOrder,
        'joins': [
            (Product, WorkOrder.product_id == Product.id),
            (Machine, WorkOrder.machine_id == Machine.id),
        ],
        'fields': {
            'work_order_number': WorkOrder.wo_number,
            'product_name': Product.name,
            'quantity': WorkOrder.quantity,
            'start_date': WorkOrder.scheduled_start_date,
            'end_date': WorkOrder.scheduled_end_date,
            'status': WorkOrder.status,
            'machine_name': Machine.name,
        },
        'numeric_fields': {'quantity'},
    },
    'inventory': {
        'model': Inventory,
        'joins': [
            (Product, Inventory.product_id == Product.id),
            (WarehouseLocation, Inventory.location_id == WarehouseLocation.id),
        ],
        'fields': {
            'product_name': Product.name,
            'product_code': Product.code,
            'current_stock': Inventory.quantity_on_hand,
            'minimum_stock': Inventory.min_stock_level,
            'location': WarehouseLocation.location_code,
            'last_updated': Inventory.last_stock_check,
        },
        'numeric_fields': {'current_stock', 'minimum_stock'},
    },
    'quality': {
        'model': QualityTest,
        'joins': [(Product, QualityTest.product_id == Product.id)],
        'fields': {
            'test_number': QualityTest.test_number,
            'product_name': Product.name,
            'test_date': QualityTest.test_date,
            'result': QualityTest.result,
        },
        'numeric_fields': set(),
    },
    'waste': {
        'model': WasteRecord,
        'joins': [(WasteCategory, WasteRecord.category_id == WasteCategory.id)],
        'fields': {
            'record_number': WasteRecord.record_number,
            'waste_date': WasteRecord.waste_date,
            'category': WasteCategory.name,
            'quantity': WasteRecord.quantity,
            'hazard_level': WasteCategory.hazard_level,
            'disposal_method': WasteRecord.disposal_method,
        },
        'numeric_fields': {'quantity'},
    },
    'maintenance': {
        'model': MaintenanceRecord,
        'joins': [(Machine, MaintenanceRecord.machine_id == Machine.id)],
        'fields': {
            'record_number': MaintenanceRecord.record_number,
            'machine_name': Machine.name,
            'maintenance_date': MaintenanceRecord.maintenance_date,
            'maintenance_type': MaintenanceRecord.maintenance_type,
            'status': MaintenanceRecord.status,
        },
        'numeric_fields': set(),
    },
}

OPERATORS = {
    'equals': lambda col, val: col == val,
    'not_equals': lambda col, val: col != val,
    'contains': lambda col, val: col.ilike(f'%{val}%'),
    'starts_with': lambda col, val: col.ilike(f'{val}%'),
    'ends_with': lambda col, val: col.ilike(f'%{val}'),
    'greater_than': lambda col, val: col > val,
    'less_than': lambda col, val: col < val,
    'in': lambda col, val: col.in_([v.strip() for v in val.split(',') if v.strip()]),
    'between': lambda col, val: _between(col, val),
}

AGGREGATIONS = {
    'count': func.count,
    'sum': func.sum,
    'avg': func.avg,
    'min': func.min,
    'max': func.max,
}


def _between(col, val):
    parts = [v.strip() for v in val.split(',')]
    if len(parts) != 2:
        raise ValueError("'between' requires value as 'low,high'")
    return col.between(parts[0], parts[1])


class ReportQueryError(ValueError):
    """Raised when a request references a dataSource/field/operator/
    aggregation not present in the whitelist above, or sends a
    malformed filter - always surfaced as an HTTP 400, never a 500 or a
    silently-ignored no-op."""
    pass


def resolve_column(source_id, field_name):
    source = DATA_SOURCES.get(source_id)
    if source is None:
        raise ReportQueryError(f"Unknown data source: {source_id}")
    col = source['fields'].get(field_name)
    if col is None:
        raise ReportQueryError(f"Unknown field '{field_name}' for data source '{source_id}'")
    return col


def run_source_query(source_id, selected_fields, filters, group_by, order_by, limit=500):
    """Build and execute a safe query for ONE data source. selected_fields
    is a list of {field, aggregation} dicts (aggregation may be '' / None).
    filters is a list of {field, operator, value} dicts. Returns a list of
    plain dicts keyed by field name, ready to serialize as JSON."""
    source = DATA_SOURCES.get(source_id)
    if source is None:
        raise ReportQueryError(f"Unknown data source: {source_id}")

    if not selected_fields:
        raise ReportQueryError("At least one field must be selected")

    select_cols = []
    labels = []
    has_aggregation = any(f.get('aggregation') for f in selected_fields)

    for f in selected_fields:
        field_name = f.get('field')
        agg = f.get('aggregation') or ''
        col = resolve_column(source_id, field_name)

        if agg:
            if agg not in AGGREGATIONS:
                raise ReportQueryError(f"Unknown aggregation: {agg}")
            if agg != 'count' and field_name not in source['numeric_fields']:
                raise ReportQueryError(
                    f"Aggregation '{agg}' is only valid on a numeric field, '{field_name}' is not"
                )
            select_cols.append(AGGREGATIONS[agg](col).label(field_name))
        else:
            select_cols.append(col.label(field_name))
        labels.append(field_name)

    query = db.session.query(*select_cols)
    for join_model, condition in source.get('joins', []):
        query = query.join(join_model, condition)

    for filt in (filters or []):
        field_name = filt.get('field')
        operator = filt.get('operator')
        value = filt.get('value')
        if not field_name or value in (None, ''):
            continue
        col = resolve_column(source_id, field_name)
        op_fn = OPERATORS.get(operator)
        if op_fn is None:
            raise ReportQueryError(f"Unknown filter operator: {operator}")
        query = query.filter(op_fn(col, value))

    group_cols = []
    if group_by:
        for g in group_by:
            group_cols.append(resolve_column(source_id, g))
        query = query.group_by(*group_cols)
    elif has_aggregation:
        # SQL requires every non-aggregated selected column to be grouped.
        for f in selected_fields:
            if not f.get('aggregation'):
                query = query.group_by(resolve_column(source_id, f.get('field')))

    for ob in (order_by or []):
        field_name = ob.get('field')
        direction = ob.get('direction', 'asc')
        col = resolve_column(source_id, field_name)
        query = query.order_by(col.desc() if direction == 'desc' else col.asc())

    query = query.limit(limit)
    rows = query.all()

    results = []
    for row in rows:
        d = {}
        for label, value in zip(labels, row):
            if hasattr(value, 'isoformat'):
                value = value.isoformat()
            elif value is not None and not isinstance(value, (str, int, float, bool)):
                value = float(value)
            d[label] = value
        results.append(d)
    return results
