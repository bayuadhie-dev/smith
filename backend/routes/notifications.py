from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification, SystemAlert
from models.notification import PushSubscription
from utils.i18n import success_response, error_response, get_message
from datetime import datetime
from utils.timezone import get_local_now, get_local_today
import os

# Exempt notifications from rate limiting to allow legitimate polling
notifications_bp = Blueprint('notifications', __name__)

VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgY7mRZgnZwBe0ap+j\ndb+3V+P3N0BEIMkh3QDh2/JrT3WhRANCAARWOhyAgeZFoRaAzqIF+8rTBsYv10Zg\njOszUQzt9Y83TKuP5nbm/5AK2iBNozXlCmxV46+81l43uSiUEcgJwwJ8\n-----END PRIVATE KEY-----\n')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', 'BFY6HICB5kWhFoDOogX7ytMGxi_XRmCM6zNRDO31jzdMq4_mdub_kAraIE2jNeUKbFXjr7zWXje5KJQRyAnDAnw')
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:admin@gratiams.com')

@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        is_read = request.args.get('is_read', type=bool)
        
        query = Notification.query.filter_by(user_id=user_id, is_dismissed=False)
        
        if is_read is not None:
            query = query.filter_by(is_read=is_read)
        
        notifications = query.order_by(Notification.created_at.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'notifications': [{
                'id': n.id,
                'notification_type': n.notification_type,
                'category': n.category,
                'title': n.title,
                'message': n.message,
                'priority': n.priority,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat(),
                'action_url': n.action_url,
                'reference_type': n.reference_type,
                'reference_id': n.reference_id
            } for n in notifications.items],
            'total': notifications.total,
            'unread_count': Notification.query.filter_by(user_id=user_id, is_read=False, is_dismissed=False).count()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/<int:id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(id):
    try:
        notification = db.session.get(Notification, id)
        if not notification:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        notification.is_read = True
        notification.read_at = get_local_now()
        db.session.commit()
        
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/mark-all-read', methods=['PUT'])
@jwt_required()
def mark_all_as_read():
    try:
        user_id = get_jwt_identity()
        Notification.query.filter_by(user_id=user_id, is_read=False).update({
            'is_read': True,
            'read_at': get_local_now()
        })
        db.session.commit()
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    try:
        alerts = SystemAlert.query.filter_by(is_active=True, resolved=False).all()
        return jsonify({
            'alerts': [{
                'id': a.id,
                'alert_type': a.alert_type,
                'severity': a.severity,
                'title': a.title,
                'message': a.message,
                'created_at': a.created_at.isoformat()
            } for a in alerts]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notifications_bp.route('/vapid-public-key', methods=['GET'])
def get_vapid_public_key():
    """Get VAPID public key for frontend push subscription"""
    return jsonify({'public_key': VAPID_PUBLIC_KEY})


@notifications_bp.route('/push/subscribe', methods=['POST'])
@jwt_required()
def push_subscribe():
    """Save push subscription for current user"""
    user_id = get_jwt_identity()
    data = request.get_json()

    endpoint = data.get('endpoint')
    keys = data.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')

    if not all([endpoint, p256dh, auth]):
        return jsonify({'error': 'Invalid subscription data'}), 400

    existing = PushSubscription.query.filter_by(user_id=user_id, endpoint=endpoint).first()
    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_agent = request.headers.get('User-Agent', '')
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=request.headers.get('User-Agent', ''),
        )
        db.session.add(sub)

    db.session.commit()
    return jsonify({'message': 'Push subscription saved'}), 201


@notifications_bp.route('/push/unsubscribe', methods=['POST'])
@jwt_required()
def push_unsubscribe():
    """Remove push subscription"""
    user_id = get_jwt_identity()
    data = request.get_json()
    endpoint = data.get('endpoint')

    PushSubscription.query.filter_by(user_id=user_id, endpoint=endpoint).delete()
    db.session.commit()
    return jsonify({'message': 'Push subscription removed'})
