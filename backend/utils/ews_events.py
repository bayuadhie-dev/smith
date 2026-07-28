"""
EWS Event Listeners
Auto-trigger scoring risiko downtime saat ShiftProduction baru dibuat.
"""
from sqlalchemy import event


def register_ews_events(app):
    """Register event listener untuk auto-scoring EWS."""

    from models.production import ShiftProduction
    from models import db

    @event.listens_for(ShiftProduction, 'after_insert')
    def shift_production_created(mapper, connection, target):
        """
        Auto-score shift production baru saat record selesai dibuat.
        Dijalankan di background thread supaya tidak blocking insert utama.
        """
        if target.status != 'completed':
            return

        import threading

        def score_async(app_ctx, shift_production_id):
            with app_ctx:
                try:
                    from utils.ews_scoring import score_shift_production
                    from models.ews import EWSPrediction
                    from models import db as db_inner
                    from datetime import datetime

                    result = score_shift_production(shift_production_id, db_inner.session)
                    if result is None:
                        print(f"ℹ️  EWS: shift {shift_production_id} dilewati (belum ada histori mesin cukup)")
                        return

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
                        prediction = EWSPrediction(
                            shift_production_id=shift_production_id,
                            prob_bahaya=result['prob_bahaya'],
                            status_ews=result['status_ews'],
                            prob_threshold_used=result['prob_threshold_used'],
                            model_version=result['model_version'],
                            scored_at=datetime.utcnow(),
                        )
                        db_inner.session.add(prediction)

                    db_inner.session.commit()
                    print(f"✓ EWS scored shift {shift_production_id}: {result['status_ews']} (prob={result['prob_bahaya']})")

                except Exception as e:
                    print(f"✗ Gagal scoring EWS untuk shift {shift_production_id}: {str(e)}")

        threading.Thread(
            target=score_async,
            args=(app.app_context(), target.id)
        ).start()

    print("✓ EWS event listeners registered")
