"""
Backfill EWS predictions untuk semua ShiftProduction lama yang belum discore.
Jalankan sekali setelah deploy awal, atau kapan saja untuk catch-up
shift yang terlewat (misal karena backend down saat shift itu dibuat).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from app import create_app
from models import db
from models.production import ShiftProduction
from models.ews import EWSPrediction
from utils.ews_scoring import score_shift_production

app = create_app()

with app.app_context():
    already_scored_ids = {p.shift_production_id for p in EWSPrediction.query.all()}
    all_shifts = ShiftProduction.query.filter_by(status='completed').all()
    to_score = [s for s in all_shifts if s.id not in already_scored_ids]

    print(f"Total shift completed: {len(all_shifts)}")
    print(f"Sudah discore         : {len(already_scored_ids)}")
    print(f"Akan discore sekarang : {len(to_score)}")
    print()

    n_scored = 0
    n_skipped = 0
    n_error = 0

    for shift in to_score:
        try:
            result = score_shift_production(shift.id, db.session)
            if result is None:
                n_skipped += 1
                continue

            prediction = EWSPrediction(
                shift_production_id=shift.id,
                prob_bahaya=result['prob_bahaya'],
                status_ews=result['status_ews'],
                prob_threshold_used=result['prob_threshold_used'],
                model_version=result['model_version'],
                scored_at=datetime.now(timezone.utc),
            )
            db.session.add(prediction)
            n_scored += 1

            if n_scored % 50 == 0:
                db.session.commit()
                print(f"  ... {n_scored} discore, commit batch")

        except Exception as e:
            n_error += 1
            print(f"  ✗ Error scoring shift {shift.id}: {e}")

    db.session.commit()
    print()
    print(f"✅ Selesai. Discore: {n_scored} | Dilewati (histori kurang): {n_skipped} | Error: {n_error}")
