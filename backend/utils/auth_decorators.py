from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, User


def admin_required():
    """Decorator to require admin access. Must be used together with @jwt_required() above it."""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)

            if not user or not user.is_admin:
                return jsonify({'error': 'Admin access required'}), 403

            return fn(*args, **kwargs)
        return decorator
    return wrapper
