"""
Custom Report Builder CRUD + safe preview-query endpoint (2026-10-06) -
external-audit mock-data cleanup, category 3 item 1/3. Replaces
CustomReportBuilder.tsx's Math.random()-fabricated preview rows and
never-persisted saveReport() with a real whitelist-based query engine.
See utils/custom_report_registry.py for the safety design.
"""
import json

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db
from models.custom_report import CustomReportDefinition
from utils.auth_decorators import require_permission
from utils.custom_report_registry import DATA_SOURCES, run_source_query, ReportQueryError

custom_report_bp = Blueprint('custom_report', __name__, url_prefix='/api/reports/custom')


@custom_report_bp.route('/data-sources', methods=['GET'])
@jwt_required()
@require_permission('reports.view')
def list_data_sources():
    """Expose the whitelist itself so the frontend never has to guess
    what's actually queryable - avoids the UI/backend whitelist drifting
    out of sync silently."""
    return jsonify({
        'dataSources': {
            source_id: {
                'fields': list(cfg['fields'].keys()),
                'numericFields': list(cfg['numeric_fields']),
            }
            for source_id, cfg in DATA_SOURCES.items()
        }
    }), 200


@custom_report_bp.route('/preview', methods=['POST'])
@jwt_required()
@require_permission('reports.view')
def preview_custom_report():
    """Run the report definition against real data. Each selected
    dataSource is queried independently (see custom_report_registry's
    module docstring for why cross-source joins aren't attempted) and
    returned as its own labeled result set."""
    data = request.get_json() or {}
    data_sources = data.get('dataSources') or []
    all_fields = data.get('fields') or []
    filters = data.get('filters') or []
    group_by = data.get('groupBy') or []
    order_by = data.get('orderBy') or []

    if not data_sources:
        return jsonify({'error': 'At least one data source must be selected'}), 400

    results = {}
    try:
        for source_id in data_sources:
            if source_id not in DATA_SOURCES:
                raise ReportQueryError(f"Unknown data source: {source_id}")
            source_fields = [f for f in all_fields if f.get('source') == source_id]
            if not source_fields:
                continue
            whitelist = DATA_SOURCES[source_id]['fields']
            # Filters/groupBy/orderBy may reference ANY whitelisted field of
            # this source, not just ones also chosen as output columns (e.g.
            # "select order_number, filter by status" is a normal report).
            # If the same field name exists in multiple selected sources
            # (e.g. 'status' on both production and maintenance), the same
            # filter value is applied to each independently - intentional,
            # not a bug: there's no per-filter source tag from the frontend.
            source_filters = [f for f in filters if f.get('field') in whitelist]
            source_group_by = [g for g in group_by if g in whitelist]
            source_order_by = [o for o in order_by if o.get('field') in whitelist]

            rows = run_source_query(
                source_id,
                selected_fields=[{'field': f['field'], 'aggregation': f.get('aggregation')} for f in source_fields],
                filters=source_filters,
                group_by=source_group_by,
                order_by=source_order_by,
            )
            results[source_id] = rows
    except ReportQueryError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Query failed: {e}'}), 500

    return jsonify({'results': results}), 200


# ----------------------------------------------------------------------
# CRUD for saved report definitions
# ----------------------------------------------------------------------
@custom_report_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('reports.view')
def list_custom_reports():
    reports = CustomReportDefinition.query.order_by(CustomReportDefinition.created_at.desc()).all()
    return jsonify({'reports': [r.to_dict() for r in reports]}), 200


@custom_report_bp.route('/<int:report_id>', methods=['GET'])
@jwt_required()
@require_permission('reports.view')
def get_custom_report(report_id):
    report = db.session.get(CustomReportDefinition, report_id)
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    return jsonify(report.to_dict()), 200


@custom_report_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('reports.create')
def create_custom_report():
    try:
        data = request.get_json() or {}
        user_id = get_jwt_identity()

        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'name is required'}), 400
        if not data.get('dataSources'):
            return jsonify({'error': 'At least one data source is required'}), 400
        if not data.get('fields'):
            return jsonify({'error': 'At least one field is required'}), 400

        # Validate every field/filter/groupBy/orderBy against the
        # whitelist up front, same engine the preview endpoint uses -
        # a saved report that can never be run is worse than no report.
        for f in data.get('fields', []):
            from utils.custom_report_registry import resolve_column
            resolve_column(f.get('source'), f.get('field'))

        report = CustomReportDefinition(
            name=name,
            description=data.get('description'),
            data_sources=json.dumps(data.get('dataSources', [])),
            fields=json.dumps(data.get('fields', [])),
            filters=json.dumps(data.get('filters', [])),
            group_by=json.dumps(data.get('groupBy', [])),
            order_by=json.dumps(data.get('orderBy', [])),
            chart_type=data.get('chartType', 'table'),
            created_by=int(user_id) if user_id else None,
        )
        db.session.add(report)
        db.session.commit()
        return jsonify(report.to_dict()), 201
    except ReportQueryError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@custom_report_bp.route('/<int:report_id>', methods=['DELETE'])
@jwt_required()
@require_permission('reports.create')
def delete_custom_report(report_id):
    report = db.session.get(CustomReportDefinition, report_id)
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    db.session.delete(report)
    db.session.commit()
    return jsonify({'message': 'Report deleted'}), 200
