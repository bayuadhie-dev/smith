"""
EWS Scoring — logic inti untuk menghitung probabilitas risiko downtime
sebuah shift produksi, menggunakan model RandomForest yang sudah dilatih
(lihat train_ews_rich.py). Dipanggil dari event listener (auto-score saat
shift baru masuk) maupun endpoint manual (re-score / batch scoring).
"""
import os
import joblib
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_MODELS_DIR = os.path.join(BASE_DIR, 'ml_models')

MODEL_FILE = os.path.join(ML_MODELS_DIR, 'model_ews_rich.pkl')
COLUMNS_FILE = os.path.join(ML_MODELS_DIR, 'model_rich_columns.pkl')
THRESHOLD_FILE = os.path.join(ML_MODELS_DIR, 'model_ews_prob_threshold.pkl')
MODEL_VERSION = 'rich_p75_v1'  # update manual tiap kali model diretrain & di-deploy ulang

FEATURES = [
    'shift', 'machine_id', 'product_id', 'planned_runtime',
    'prev_downtime_pct', 'prev_oee', 'prev_efficiency',
    'rolling3_downtime_pct', 'rolling3_oee', 'day_of_week',
    'downtime_mesin', 'downtime_operator', 'downtime_design'
]
DUMMY_COLUMNS = ['shift', 'machine_id', 'product_id']

_model = None
_model_columns = None
_prob_threshold = None


def _load_model():
    """Lazy-load model sekali saja per process, bukan tiap request."""
    global _model, _model_columns, _prob_threshold
    if _model is None:
        if not (os.path.exists(MODEL_FILE) and os.path.exists(COLUMNS_FILE) and os.path.exists(THRESHOLD_FILE)):
            raise FileNotFoundError(f"File model EWS tidak lengkap di {ML_MODELS_DIR}")
        _model = joblib.load(MODEL_FILE)
        _model_columns = joblib.load(COLUMNS_FILE)
        _prob_threshold = joblib.load(THRESHOLD_FILE)
    return _model, _model_columns, _prob_threshold


def build_features_for_machine_history(history_df: pd.DataFrame) -> pd.DataFrame:
    """
    Hitung fitur turunan (downtime_pct, prev_*, rolling3_*, day_of_week)
    dari histori shift SATU mesin, urut berdasarkan tanggal & shift.
    Baris terakhir di history_df adalah shift yang mau discore;
    baris-baris sebelumnya dipakai untuk hitung prev_*/rolling3_*.

    history_df harus berisi kolom: production_date, shift, planned_runtime,
    downtime_minutes, downtime_mesin, downtime_operator, downtime_design,
    oee_score, efficiency_rate — diurutkan ASC berdasarkan production_date, shift.
    """
    df = history_df.sort_values(['production_date', 'shift']).reset_index(drop=True)

    df['downtime_minutes'] = df['downtime_minutes'].fillna(0)
    df['downtime_pct'] = (df['downtime_minutes'] / df['planned_runtime']) * 100

    df['prev_downtime_pct'] = df['downtime_pct'].shift(1)
    df['prev_oee'] = df['oee_score'].shift(1)
    df['prev_efficiency'] = df['efficiency_rate'].shift(1)

    df['rolling3_downtime_pct'] = df['downtime_pct'].shift(1).rolling(window=3, min_periods=1).mean()
    df['rolling3_oee'] = df['oee_score'].shift(1).rolling(window=3, min_periods=1).mean()

    df['production_date'] = pd.to_datetime(df['production_date'])
    df['day_of_week'] = df['production_date'].dt.dayofweek

    return df


def score_shift(feature_row: dict) -> dict:
    """
    Score SATU shift. feature_row harus berisi semua kolom di FEATURES
    (sudah dihitung, termasuk prev_*/rolling3_*/day_of_week).
    Return: {'prob_bahaya': float, 'status_ews': 'AMAN'|'BAHAYA', 'prob_threshold_used': float, 'model_version': str}
    """
    model, model_columns, prob_threshold = _load_model()

    row_df = pd.DataFrame([feature_row])
    available_features = [f for f in FEATURES if f in row_df.columns]
    X = pd.get_dummies(row_df[available_features], columns=DUMMY_COLUMNS, drop_first=True)
    X_aligned = X.reindex(columns=model_columns, fill_value=0)

    proba = model.predict_proba(X_aligned)[:, 1][0]
    status = 'BAHAYA' if proba >= prob_threshold else 'AMAN'

    return {
        'prob_bahaya': round(float(proba), 4),
        'status_ews': status,
        'prob_threshold_used': float(prob_threshold),
        'model_version': MODEL_VERSION,
    }


def score_shift_production(shift_production_id: int, db_session) -> dict | None:
    """
    Score satu ShiftProduction berdasarkan ID, dengan mengambil histori
    mesin yang sama dari database untuk menghitung fitur prev_*/rolling3_*.
    Return None kalau shift ini adalah shift PERTAMA untuk mesinnya
    (belum ada histori, tidak bisa dihitung prev_oee → tidak bisa discore).
    """
    from models.production import ShiftProduction

    target = db_session.get(ShiftProduction, shift_production_id)
    if target is None or target.machine_id is None:
        return None

    # Ambil histori mesin yang sama, urut tanggal+shift, sampai (termasuk) shift target.
    # Dibatasi ke ~10 shift terakhir sebelum target — cukup untuk rolling window 3, hemat query.
    history = (
        db_session.query(ShiftProduction)
        .filter(
            ShiftProduction.machine_id == target.machine_id,
            ShiftProduction.status == 'completed',
            (ShiftProduction.production_date < target.production_date) |
            ((ShiftProduction.production_date == target.production_date) & (ShiftProduction.shift <= target.shift))
        )
        .order_by(ShiftProduction.production_date.desc(), ShiftProduction.shift.desc())
        .limit(10)
        .all()
    )

    if len(history) < 2:
        # Shift pertama mesin ini — tidak ada histori untuk hitung prev_oee.
        return None

    history_data = [{
        'production_date': h.production_date,
        'shift': h.shift,
        'machine_id': h.machine_id,
        'product_id': h.product_id,
        'planned_runtime': h.planned_runtime,
        'downtime_minutes': h.downtime_minutes,
        'downtime_mesin': h.downtime_mesin,
        'downtime_operator': h.downtime_operator,
        'downtime_design': h.downtime_design,
        'oee_score': float(h.oee_score) if h.oee_score is not None else None,
        'efficiency_rate': float(h.efficiency_rate) if h.efficiency_rate is not None else None,
    } for h in history]

    history_df = pd.DataFrame(history_data)
    feat_df = build_features_for_machine_history(history_df)

    last_row = feat_df.iloc[-1]
    if pd.isna(last_row['prev_oee']):
        return None

    return score_shift(last_row.to_dict())
