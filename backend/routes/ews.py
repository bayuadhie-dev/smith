"""
EWS (Early Warning System) Routes
Endpoint untuk frontend membaca hasil prediksi risiko downtime shift produksi.
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from models import db
from models.ews import EWSPrediction
from models.production import ShiftProduction, Machine
from utils.i18n import success_response, error_response
from datetime import datetime, timedelta

ews_bp = Blueprint('ews', __name__)


@ews_bp.route('/predictions', methods=['GET'])
@jwt_required()
def get_predictions():
    """
    List prediksi EWS, dengan filter opsional:
    ?machine_id=<int>&status=<AMAN|BAHAYA>&date_from=<YYYY-MM-DD>&date_to=<YYYY-MM-DD>&limit=<int>
    """
    try:
        machine_id = request.args.get('machine_id', type=int)
        status_filter = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', 100, type=int)

        query = db.session.query(EWSPrediction).join(
            ShiftProduction, EWSPrediction.shift_production_id == ShiftProduction.id
        )

        if machine_id:
            query = query.filter(ShiftProduction.machine_id == machine_id)
        if status_filter:
            query = query.filter(EWSPrediction.status_ews == status_filter.upper())
        if date_from:
            query = query.filter(ShiftProduction.production_date >= date_from)
        if date_to:
            query = query.filter(ShiftProduction.production_date <= date_to)

        query = query.order_by(EWSPrediction.scored_at.desc()).limit(limit)
        predictions = query.all()

        results = []
        for p in predictions:
            sp = p.shift_production
            machine = Machine.query.get(sp.machine_id) if sp.machine_id else None
            item = p.to_dict()
            item['production_date'] = sp.production_date.isoformat() if sp.production_date else None
            item['shift'] = sp.shift
            item['machine_id'] = sp.machine_id
            item['machine_name'] = machine.name if machine else None
            results.append(item)

        return success_response('ews.predictions_fetched', data=results), 200

    except Exception as e:
        return error_response('ews.fetch_error', details=str(e)), 500


@ews_bp.route('/predictions/<int:shift_production_id>', methods=['GET'])
@jwt_required()
def get_prediction_detail(shift_production_id):
    """Detail prediksi EWS untuk satu shift_production_id tertentu."""
    try:
        prediction = EWSPrediction.query.filter_by(
            shift_production_id=shift_production_id
        ).first()

        if not prediction:
            return error_response('ews.not_found', error_code=404), 404

        sp = prediction.shift_production
        machine = Machine.query.get(sp.machine_id) if sp.machine_id else None

        item = prediction.to_dict()
        item['production_date'] = sp.production_date.isoformat() if sp.production_date else None
        item['shift'] = sp.shift
        item['machine_id'] = sp.machine_id
        item['machine_name'] = machine.name if machine else None
        item['downtime_mesin'] = sp.downtime_mesin
        item['downtime_operator'] = sp.downtime_operator
        item['downtime_design'] = sp.downtime_design
        item['oee_score'] = float(sp.oee_score) if sp.oee_score is not None else None

        return success_response('ews.prediction_fetched', data=item), 200

    except Exception as e:
        return error_response('ews.fetch_error', details=str(e)), 500


@ews_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    """
    Ringkasan EWS untuk dashboard: jumlah AMAN/BAHAYA dalam N hari terakhir.
    ?days=<int, default 7>
    """
    try:
        days = request.args.get('days', 7, type=int)
        since = datetime.utcnow() - timedelta(days=days)

        query = db.session.query(EWSPrediction).join(
            ShiftProduction, EWSPrediction.shift_production_id == ShiftProduction.id
        ).filter(ShiftProduction.production_date >= since.date())

        predictions = query.all()
        total = len(predictions)
        n_bahaya = sum(1 for p in predictions if p.status_ews == 'BAHAYA')
        n_aman = total - n_bahaya

        # Breakdown per mesin, biar dashboard bisa tunjuk mesin mana paling berisiko
        machine_breakdown = {}
        for p in predictions:
            sp = p.shift_production
            mid = sp.machine_id
            if mid not in machine_breakdown:
                machine_breakdown[mid] = {'machine_id': mid, 'aman': 0, 'bahaya': 0}
            if p.status_ews == 'BAHAYA':
                machine_breakdown[mid]['bahaya'] += 1
            else:
                machine_breakdown[mid]['aman'] += 1

        return success_response('ews.summary_fetched', data={
            'period_days': days,
            'total_scored': total,
            'aman': n_aman,
            'bahaya': n_bahaya,
            'bahaya_rate': round(n_bahaya / total * 100, 1) if total > 0 else 0,
            'per_machine': list(machine_breakdown.values()),
        }), 200

    except Exception as e:
        return error_response('ews.fetch_error', details=str(e)), 500


@ews_bp.route('/rescore/<int:shift_production_id>', methods=['POST'])
@jwt_required()
def rescore_shift(shift_production_id):
    """
    Re-score satu shift secara manual (misal setelah data downtime dikoreksi).
    Berguna juga untuk backfill shift lama yang belum pernah discore.
    """
    try:
        from utils.ews_scoring import score_shift_production
        from models.ews import EWSPrediction

        result = score_shift_production(shift_production_id, db.session)
        if result is None:
            return error_response('ews.insufficient_history', error_code=422), 422

        existing = EWSPrediction.query.filter_by(
            shift_production_id=shift_production_id
        ).first()

        if existing:
            existing.prob_bahaya = result['prob_bahaya']
            existing.status_ews = result['status_ews']
            existing.prob_threshold_used = result['prob_threshold_used']
            existing.model_version = result['model_version']
            existing.scored_at = datetime.utcnow()
        else:
            existing = EWSPrediction(
                shift_production_id=shift_production_id,
                prob_bahaya=result['prob_bahaya'],
                status_ews=result['status_ews'],
                prob_threshold_used=result['prob_threshold_used'],
                model_version=result['model_version'],
                scored_at=datetime.utcnow(),
            )
            db.session.add(existing)

        db.session.commit()
        return success_response('ews.rescored', data=existing.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return error_response('ews.rescore_error', details=str(e)), 500
