"""
Machine Health / Anomaly Detection - Flask Blueprint
Mendeteksi anomali downtime mesin berbasis baseline statistik (avg + 2*stddev)
per mesin, dihitung dari riwayat downtime_mesin mingguan.

Akses di: /api/machine-health
"""
from datetime import datetime
from flask import Blueprint, jsonify, request
from models import db
from sqlalchemy import text

machine_health_bp = Blueprint('machine_health', __name__)

MIN_WEEKS_FOR_BASELINE = 8
THRESHOLD_MULTIPLIER = 2.0


def get_weekly_downtime_by_machine():
    """
    Ambil semua downtime_mesin per mesin per minggu.
    Return: dict {machine_id: [(week, total_downtime), ...]}
    """
    result = db.session.execute(text('''
        SELECT machine_id,
               strftime('%Y-%W', production_date) as week,
               SUM(downtime_mesin) as total_downtime
        FROM shift_productions
        WHERE downtime_mesin > 0
        GROUP BY machine_id, week
        ORDER BY machine_id, week
    '''))
    rows = result.fetchall()

    by_machine = {}
    for row in rows:
        m = row._mapping
        by_machine.setdefault(m['machine_id'], []).append({
            'week': m['week'],
            'total_downtime': m['total_downtime']
        })
    return by_machine


def calculate_baseline(weekly_values):
    """
    Hitung avg, stddev dari list nilai mingguan.
    Return None kalau data kurang dari MIN_WEEKS_FOR_BASELINE.
    """
    n = len(weekly_values)
    if n < MIN_WEEKS_FOR_BASELINE:
        return None

    avg = sum(weekly_values) / n
    variance = sum((x - avg) ** 2 for x in weekly_values) / n
    stddev = variance ** 0.5

    return {
        'avg': round(avg, 1),
        'stddev': round(stddev, 1),
        'threshold': round(avg + THRESHOLD_MULTIPLIER * stddev, 1),
        'num_weeks': n
    }


def get_machine_names():
    """Get machine id -> {code, name} mapping"""
    result = db.session.execute(text('SELECT id, code, name FROM machines'))
    return {row._mapping['id']: {
        'code': row._mapping['code'],
        'name': row._mapping['name']
    } for row in result.fetchall()}


def build_machine_status(current_week=None):
    """
    Bangun status semua mesin: baseline, minggu berjalan, apakah anomali.
    """
    if current_week is None:
        current_week = datetime.now().strftime('%Y-%W')

    weekly_data = get_weekly_downtime_by_machine()
    machine_names = get_machine_names()

    statuses = []
    for machine_id, weeks in weekly_data.items():
        values = [w['total_downtime'] for w in weeks]
        baseline = calculate_baseline(values)

        machine_info = machine_names.get(machine_id, {})
        this_week_entry = next((w for w in weeks if w['week'] == current_week), None)
        this_week_downtime = this_week_entry['total_downtime'] if this_week_entry else 0

        if baseline is None:
            status = 'insufficient_data'
            is_anomaly = False
        else:
            is_anomaly = this_week_downtime > baseline['threshold']
            status = 'anomaly' if is_anomaly else 'normal'

        statuses.append({
            'machine_id': machine_id,
            'machine_code': machine_info.get('code', f'ID{machine_id}'),
            'machine_name': machine_info.get('name', f'Mesin {machine_id}'),
            'current_week': current_week,
            'current_week_downtime': this_week_downtime,
            'baseline': baseline,
            'status': status,
            'is_anomaly': is_anomaly
        })

    # Urutkan: anomali dulu, baru normal, baru insufficient_data
    order = {'anomaly': 0, 'normal': 1, 'insufficient_data': 2}
    statuses.sort(key=lambda s: (order[s['status']], -s['current_week_downtime']))

    return statuses


# ============================================================
# ROUTES
# ============================================================

@machine_health_bp.route('/api/machine-health/status', methods=['GET'])
def api_status():
    """Status kesehatan semua mesin minggu ini (atau minggu tertentu via ?week=YYYY-WW)"""
    week = request.args.get('week')
    try:
        statuses = build_machine_status(current_week=week)
        return jsonify({
            'week': week or datetime.now().strftime('%Y-%W'),
            'machines': statuses,
            'anomaly_count': sum(1 for s in statuses if s['is_anomaly'])
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@machine_health_bp.route('/api/machine-health/history/<int:machine_id>', methods=['GET'])
def api_history(machine_id):
    """History mingguan 1 mesin + baseline, buat chart trend"""
    try:
        weekly_data = get_weekly_downtime_by_machine()
        weeks = weekly_data.get(machine_id, [])

        if not weeks:
            return jsonify({'error': 'Tidak ada data downtime untuk mesin ini'}), 404

        values = [w['total_downtime'] for w in weeks]
        baseline = calculate_baseline(values)

        machine_names = get_machine_names()
        machine_info = machine_names.get(machine_id, {})

        return jsonify({
            'machine_id': machine_id,
            'machine_code': machine_info.get('code'),
            'machine_name': machine_info.get('name'),
            'baseline': baseline,
            'weekly_history': weeks
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@machine_health_bp.route('/api/machine-health/check-and-notify', methods=['POST'])
def api_check_and_notify():
    """
    Dipanggil scheduler mingguan (misal tiap Senin pagi).
    Cek anomali minggu lalu, kirim WhatsApp kalau ada.
    """
    try:
        # Cek minggu KEMARIN (minggu yang baru selesai), bukan minggu berjalan
        from datetime import timedelta
        last_week = (datetime.now() - timedelta(weeks=1)).strftime('%Y-%W')

        statuses = build_machine_status(current_week=last_week)
        anomalies = [s for s in statuses if s['is_anomaly']]

        if anomalies:
            send_whatsapp_alert(anomalies, last_week)

        return jsonify({
            'week_checked': last_week,
            'anomaly_count': len(anomalies),
            'anomalies': anomalies,
            'notified': len(anomalies) > 0
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def send_whatsapp_alert(anomalies, week):
    """
    Kirim notifikasi WhatsApp untuk mesin yang anomali.
    Reuse pola pengiriman dari utils/production_notifications.py
    (setting-based: whatsapp_enabled, target phones, provider twilio/openwa).
    """
    from utils.helpers import get_setting_value
    import os
    import requests

    is_enabled = get_setting_value('notifications.whatsapp_enabled', False)
    if not is_enabled:
        return False

    provider = get_setting_value('notifications.whatsapp_provider', 'local')
    phones_str = get_setting_value('notifications.whatsapp_target_phones', '')
    if not phones_str or '6281234567890' in phones_str:
        phones_str = os.environ.get('TWILIO_TARGET_PHONES', phones_str)
    if not phones_str:
        return False

    target_phones = [p.strip() for p in phones_str.split(',') if p.strip()]

    lines = [f"⚠️ *Machine Health Alert - Minggu {week}*", "---------------------------------------"]
    for a in anomalies:
        lines.append(
            f"• *{a['machine_code']}* ({a['machine_name']}): "
            f"{a['current_week_downtime']} menit downtime minggu ini\n"
            f"  Normal: ~{a['baseline']['avg']} menit | Threshold: {a['baseline']['threshold']} menit"
        )
    lines.append("")
    lines.append("Mohon dicek kondisi mesin terkait.")
    lines.append("---------------------------------------")
    lines.append("_Smith ERP - Machine Health Alert_")
    message = "\n".join(lines)

    success_count = 0

    if provider == 'twilio':
        account_sid = get_setting_value('notifications.twilio_account_sid', '')
        if not account_sid or 'ACxxxx' in account_sid:
            account_sid = os.environ.get('TWILIO_ACCOUNT_SID', account_sid)
        auth_token = get_setting_value('notifications.twilio_auth_token', '')
        if not auth_token or 'xxxxxx' in auth_token:
            auth_token = os.environ.get('TWILIO_AUTH_TOKEN', auth_token)
        from_number = get_setting_value('notifications.twilio_from_number', '')
        if not from_number or '14155238886' in from_number:
            from_number = os.environ.get('TWILIO_FROM_NUMBER', from_number)

        if not account_sid or not auth_token or not from_number:
            return False

        from requests.auth import HTTPBasicAuth
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        twilio_from = from_number.strip()
        if not twilio_from.startswith('whatsapp:'):
            twilio_from = f"whatsapp:{twilio_from}"

        for phone in target_phones:
            try:
                twilio_to = phone if phone.startswith('whatsapp:') else f"whatsapp:{phone}"
                response = requests.post(
                    twilio_url,
                    auth=HTTPBasicAuth(account_sid, auth_token),
                    data={'From': twilio_from, 'To': twilio_to, 'Body': message},
                    timeout=10
                )
                if response.status_code in (200, 201):
                    success_count += 1
            except requests.exceptions.RequestException:
                pass
    else:
        api_url = get_setting_value('notifications.whatsapp_api_url', '')
        api_token = get_setting_value('notifications.whatsapp_token', '')
        if not api_url or not api_token:
            return False

        for phone in target_phones:
            clean = ''.join(filter(str.isdigit, phone))
            if clean.startswith('0'):
                clean = '62' + clean[1:]
            elif not clean.startswith('62'):
                clean = '62' + clean
            chat_id = f"{clean}@c.us"

            try:
                response = requests.post(
                    api_url,
                    headers={'Content-Type': 'application/json', 'X-API-Key': api_token},
                    json={'chatId': chat_id, 'text': message},
                    timeout=10
                )
                if response.status_code == 201:
                    success_count += 1
            except requests.exceptions.RequestException:
                pass

    return success_count > 0
