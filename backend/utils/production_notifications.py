import json
import logging
import requests
from decimal import Decimal
from datetime import datetime
from models import db
from models.production import WorkOrder, ShiftProduction, DowntimeRecord
from utils.helpers import get_setting_value

logger = logging.getLogger(__name__)

def calculate_wo_completion_metrics(work_order_id):
    """
    Calculate production metrics, carton count, runtime, OEE efficiency,
    sorted downtime items, and top 3 downtime categories + idle time for a completed WO.
    """
    wo = db.session.get(WorkOrder, work_order_id)
    if not wo:
        return None

    shifts = ShiftProduction.query.filter_by(work_order_id=work_order_id).all()
    
    # 1. Basic Metrics
    total_grade_a = sum(float(s.good_quantity or 0) for s in shifts)
    total_scrap = sum(float(s.reject_quantity or 0) for s in shifts)
    total_runtime = sum(int(s.actual_runtime or 0) for s in shifts)
    total_downtime = sum(int(s.downtime_minutes or 0) for s in shifts)
    total_planned = sum(int(s.planned_runtime or 0) for s in shifts)
    
    # 2. Carton Count
    total_cartons = 0.0
    for s in shifts:
        pack_per_carton = s.pack_per_carton or wo.pack_per_carton or 0
        if pack_per_carton > 0:
            total_cartons += float(s.good_quantity or 0) / pack_per_carton
    
    # Round carton count to 1 decimal place
    total_cartons = round(total_cartons, 1)

    # 3. Efficiency Rate (OEE Efficiency)
    oee_efficiency = round((total_runtime / total_planned * 100), 1) if total_planned > 0 else 0.0

    # 4. Detailed Downtime Items (Grouped by reason, sorted descending by duration)
    shift_ids = [s.id for s in shifts]
    downtime_records = []
    if shift_ids:
        downtime_records = DowntimeRecord.query.filter(DowntimeRecord.shift_production_id.in_(shift_ids)).all()

    downtime_items = {}
    for record in downtime_records:
        reason = record.downtime_reason or record.downtime_category or "Lain-lain"
        downtime_items[reason] = downtime_items.get(reason, 0) + (record.duration_minutes or 0)
    
    sorted_downtime_items = sorted(downtime_items.items(), key=lambda x: x[1], reverse=True)

    # 5. Top 3 Categories (including Machine Downtime and Idle Time)
    categories = [
        ('Mesin (Breakdown/PM)', sum(int(s.downtime_mesin or 0) for s in shifts)),
        ('Operator', sum(int(s.downtime_operator or 0) for s in shifts)),
        ('Material Shortage', sum(int(s.downtime_material or 0) for s in shifts)),
        ('Design Change', sum(int(s.downtime_design or 0) for s in shifts)),
        ('Lainnya', sum(int(s.downtime_others or 0) for s in shifts)),
        ('Idle Time', sum(int(s.idle_time or 0) for s in shifts))
    ]
    
    # Filter categories with duration > 0, sort by duration, and take top 3
    top_3_categories = sorted([c for c in categories if c[1] > 0], key=lambda x: x[1], reverse=True)[:3]

    return {
        'wo_number': wo.wo_number,
        'product_name': wo.product.name if wo.product else "Unknown Product",
        'machine_name': wo.machine.name if wo.machine else "Unknown Machine",
        'total_grade_a': total_grade_a,
        'total_scrap': total_scrap,
        'total_cartons': total_cartons,
        'total_runtime_mins': total_runtime,
        'total_downtime_mins': total_downtime,
        'oee_efficiency_pct': oee_efficiency,
        'downtime_items': sorted_downtime_items,
        'top_categories': top_3_categories
    }

def format_wo_completion_message(metrics):
    """
    Format work order completion metrics into a friendly WhatsApp message.
    """
    if not metrics:
        return ""

    msg_lines = [
        "📢 *NOTIFIKASI WORK ORDER SELESAI* 📢",
        "---------------------------------------",
        f"No. WO: *{metrics['wo_number']}*",
        f"Produk: *{metrics['product_name']}*",
        f"Mesin: *{metrics['machine_name']}*",
        f"Tanggal Selesai: *{datetime.now().strftime('%d/%m/%Y %H:%M WIB')}*",
        "",
        "📊 *Metrik Produksi:*",
        f"- Total Grade A: *{metrics['total_grade_a']:,.0f} pcs*",
        f"- Total Karton: *{metrics['total_cartons']:,.1f} karton*",
        f"- Total Scrap: *{metrics['total_scrap']:,.0f} pcs*",
        f"- Actual Runtime: *{metrics['total_runtime_mins']} menit* ({round(metrics['total_runtime_mins']/60, 1)} jam)",
        f"- Total Downtime: *{metrics['total_downtime_mins']} menit* ({round(metrics['total_downtime_mins']/60, 1)} jam)",
        f"- Efisiensi OEE: *{metrics['oee_efficiency_pct']}%*",
        ""
    ]

    # Add downtime items
    if metrics['downtime_items']:
        msg_lines.append("⚠️ *Rincian Downtime (Terlama ke Tercepat):*")
        for i, (reason, minutes) in enumerate(metrics['downtime_items'], 1):
            msg_lines.append(f"{i}. *{reason}*: {minutes} menit")
        msg_lines.append("")

    # Add top 3 categories
    if metrics['top_categories']:
        msg_lines.append("🔥 *Top 3 Kategori Downtime & Idle:*")
        for i, (cat_name, minutes) in enumerate(metrics['top_categories'], 1):
            msg_lines.append(f"{i}. *{cat_name}*: {minutes} menit")
        msg_lines.append("")

    msg_lines.append("---------------------------------------")
    msg_lines.append("_Smith ERP - Sistem Notifikasi Otomatis_")
    
    return "\n".join(msg_lines)

def trigger_wo_completion_whatsapp_notification(work_order_id):
    """
    Generate the WO completion report and send it to target phone numbers via WhatsApp gateway/Twilio.
    """
    # 1. Check if WhatsApp notification is enabled
    is_enabled = get_setting_value('notifications.whatsapp_enabled', 'false') == 'true'
    if not is_enabled:
        logger.info("WhatsApp notifications are disabled.")
        return False

    # 2. Get API config
    provider = get_setting_value('notifications.whatsapp_provider', 'local')
    phones_str = get_setting_value('notifications.whatsapp_target_phones', '')
    
    if not phones_str:
        logger.warning("No target phone numbers configured for WhatsApp notifications.")
        return False

    # 3. Calculate metrics and format message
    metrics = calculate_wo_completion_metrics(work_order_id)
    if not metrics:
        logger.error(f"Failed to calculate metrics for Work Order ID: {work_order_id}")
        return False

    message = format_wo_completion_message(metrics)
    if not message:
        return False

    # 4. Send to each target phone number
    target_phones = [p.strip() for p in phones_str.split(',') if p.strip()]
    success_count = 0

    if provider == 'twilio':
        account_sid = get_setting_value('notifications.twilio_account_sid', '')
        auth_token = get_setting_value('notifications.twilio_auth_token', '')
        from_number = get_setting_value('notifications.twilio_from_number', '')
        
        if not account_sid or not auth_token or not from_number:
            logger.error("Twilio WhatsApp configurations are incomplete.")
            return False

        from requests.auth import HTTPBasicAuth
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        
        # Ensure twilio from number starts with whatsapp:
        twilio_from = from_number.strip()
        if not twilio_from.startswith('whatsapp:'):
            twilio_from = f"whatsapp:{twilio_from}"

        for phone in target_phones:
            try:
                # Ensure target phone starts with whatsapp:
                twilio_to = phone
                if not twilio_to.startswith('whatsapp:'):
                    twilio_to = f"whatsapp:{twilio_to}"

                logger.info(f"Sending Twilio WA notification for WO {metrics['wo_number']} to {twilio_to}...")
                response = requests.post(
                    twilio_url,
                    auth=HTTPBasicAuth(account_sid, auth_token),
                    data={
                        'From': twilio_from,
                        'To': twilio_to,
                        'Body': message
                    },
                    timeout=10
                )
                
                if response.status_code in (200, 201):
                    success_count += 1
                    logger.info(f"✓ Twilio WA message sent successfully to {phone}")
                else:
                    logger.error(f"✗ Twilio API returned error status {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e:
                logger.error(f"✗ Network error connecting to Twilio API: {e}")
    else:
        # Local self-hosted Node.js gateway
        api_url = get_setting_value('notifications.whatsapp_api_url', 'http://localhost:8000/send-message')
        api_token = get_setting_value('notifications.whatsapp_token', 'local-wa-secret-token')

        for phone in target_phones:
            try:
                logger.info(f"Sending Local WA notification for WO {metrics['wo_number']} to {phone}...")
                response = requests.post(
                    api_url,
                    headers={
                        'Content-Type': 'application/json',
                        'X-API-Key': api_token
                    },
                    json={
                        'to': phone,
                        'message': message
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    res_data = response.json()
                    if res_data.get('success'):
                        success_count += 1
                        logger.info(f"✓ Local WA message sent successfully to {phone}")
                    else:
                        logger.error(f"✗ Local WA Gateway returned failure: {res_data.get('message')}")
                else:
                    logger.error(f"✗ Failed to connect to Local WA gateway. Status: {response.status_code}, Response: {response.text}")
            except requests.exceptions.RequestException as e:
                logger.error(f"✗ Network error connecting to Local WhatsApp gateway: {e}")

    return success_count > 0
