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


def _get_user_permissions(user):
    """Collect the set of 'module.action' permission names granted to a user via their active roles."""
    perms = set()
    for user_role in user.roles:
        if user_role.role and user_role.role.is_active:
            for role_perm in user_role.role.permissions:
                if role_perm.permission and role_perm.permission.is_active:
                    perms.add(role_perm.permission.name)
    return perms


def require_permission(*permission_names):
    """Decorator to require one of the given 'module.action' permissions (e.g. 'finance.approve').
    Admin/Super Admin always pass. Must be used together with @jwt_required() above it.
    Multiple names are OR'd — pass any one of them to allow the request through."""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)

            if not user:
                return jsonify({'error': 'User not found'}), 404

            if user.is_admin or getattr(user, 'is_super_admin', False):
                return fn(*args, **kwargs)

            user_perms = _get_user_permissions(user)
            if not any(p in user_perms for p in permission_names):
                return jsonify({
                    'error': 'Permission denied',
                    'required_permission': permission_names[0] if len(permission_names) == 1 else list(permission_names)
                }), 403

            return fn(*args, **kwargs)
        return decorator
    return wrapper
