"""
Helper untuk kirim notifikasi in-app + Web Push ke user tertentu.
Dipakai oleh modul DCC dan Pre-Shift Checklist.
"""
from models import db, Notification
import json


def _send_web_push(user_id, title, message, action_url=None):
    """Kirim Web Push notification ke semua device user"""
    try:
        from pywebpush import webpush, WebPushException
        from models.notification import PushSubscription
        import os

        vapid_private = os.environ.get('VAPID_PRIVATE_KEY',
            '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgY7mRZgnZwBe0ap+j\ndb+3V+P3N0BEIMkh3QDh2/JrT3WhRANCAARWOhyAgeZFoRaAzqIF+8rTBsYv10Zg\njOszUQzt9Y83TKuP5nbm/5AK2iBNozXlCmxV46+81l43uSiUEcgJwwJ8\n-----END PRIVATE KEY-----\n')
        vapid_email = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:admin@gratiams.com')

        subs = PushSubscription.query.filter_by(user_id=int(user_id)).all()
        payload = json.dumps({
            'title': title,
            'body': message,
            'url': action_url or '/app/notifications',
            'icon': '/logo192.png',
        })

        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        'endpoint': sub.endpoint,
                        'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}
                    },
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={'sub': vapid_email}
                )
            except WebPushException as e:
                if e.response and e.response.status_code in (404, 410):
                    db.session.delete(sub)
                    db.session.commit()
                print(f"[WebPush] Failed for sub {sub.id}: {e}")
            except Exception as e:
                print(f"[WebPush] Error: {e}")
    except ImportError:
        pass
    except Exception as e:
        print(f"[WebPush] Module error: {e}")


def send_notification(user_id, title, message, category='system', notification_type='info',
                      priority='normal', action_url=None, reference_type=None, reference_id=None):
    """Kirim 1 notifikasi in-app + Web Push ke 1 user"""
    try:
        notif = Notification(
            user_id=int(user_id),
            notification_type=notification_type,
            category=category,
            title=title,
            message=message,
            priority=priority,
            action_url=action_url,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        db.session.add(notif)
        db.session.commit()

        # Web Push (async-safe, non-blocking)
        _send_web_push(user_id, title, message, action_url)
    except Exception as e:
        db.session.rollback()
        print(f"[Notification] Failed to send to user {user_id}: {e}")


def send_notification_bulk(user_ids, title, message, **kwargs):
    """Kirim notifikasi yang sama ke banyak user"""
    for uid in user_ids:
        send_notification(uid, title, message, **kwargs)


def notify_users_by_department(department, title, message, **kwargs):
    """Kirim notifikasi ke semua user aktif di departemen tertentu"""
    from models import User
    users = User.query.filter_by(department=department, is_active=True).all()
    for u in users:
        send_notification(u.id, title, message, **kwargs)


def notify_users_by_role(role_name, title, message, **kwargs):
    """Kirim notifikasi ke semua user aktif dengan role tertentu"""
    from models import User
    from models.user import UserRole, Role
    user_ids = db.session.query(UserRole.user_id).join(Role).filter(
        Role.name == role_name
    ).all()
    for (uid,) in user_ids:
        send_notification(uid, title, message, **kwargs)
