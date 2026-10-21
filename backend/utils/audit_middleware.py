"""
Audit Trail Middleware
Tracks all user activities except admin
"""
from flask import request, g, current_app, has_request_context
from functools import wraps
from models import db, User
from models.settings_extended import AuditLog
from datetime import datetime
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import event, inspect as sa_inspect
import json
import time
import traceback

def should_track_request():
    """Determine if request should be tracked"""
    # Skip certain paths
    skip_paths = [
        '/api/auth/login',
        '/api/auth/logout',
        '/api/auth/refresh',
        '/api/system/metrics',
        '/api/notifications',
        '/static/',
        '/favicon.ico'
    ]
    
    for path in skip_paths:
        if request.path.startswith(path):
            return False
    
    return True

def get_user_info():
    """Get current user information.

    Fixed 2026-10-16: the exclusion check used to test
    `user.username == 'admin'` or a `user.role` attribute that doesn't
    exist on the User model at all (roles are many-to-many via UserRole,
    there's no singular `.role` column) - so `hasattr(user, 'role')` was
    always False, and the ONLY users actually excluded from audit logging
    were ones literally named "admin". Any real super_admin account with a
    different username (e.g. the developer's own account) was being logged
    like any other user. Now checks the real `is_super_admin` flag."""
    try:
        # Skip JWT verification for OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return None, False

        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()

        if user_id:
            # Convert to int if string
            if isinstance(user_id, str):
                user_id = int(user_id)

            user = db.session.get(User, user_id)
            if user:
                if user.is_super_admin:
                    return None, True  # user_id, is_super_admin (excluded)
                return user_id, False
        return None, False
    except Exception as e:
        # Silently handle JWT errors for unauthenticated requests
        return None, False

def determine_action(method, path):
    """Determine action type from HTTP method and path"""
    if method == 'GET':
        if '/list' in path or '/all' in path:
            return 'list'
        return 'view'
    elif method == 'POST':
        return 'create'
    elif method == 'PUT' or method == 'PATCH':
        return 'update'
    elif method == 'DELETE':
        return 'delete'
    return 'other'

def determine_resource_type(path):
    """Extract resource type from path"""
    # Remove /api/ prefix
    if path.startswith('/api/'):
        path = path[5:]
    
    # Extract first segment as resource type
    segments = path.split('/')
    if segments:
        return segments[0]
    return 'unknown'

def log_audit_trail(user_id, action, resource_type, resource_id=None, resource_name=None, 
                   old_values=None, new_values=None, status='success', error_message=None, duration_ms=None):
    """Log audit trail entry"""
    try:
        audit_log = AuditLog(
            user_id=user_id,
            session_id=request.cookies.get('session_id'),
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            resource_name=resource_name,
            old_values=json.dumps(old_values) if old_values else None,
            new_values=json.dumps(new_values) if new_values else None,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent'),
            request_method=request.method,
            request_url=request.url,
            status=status,
            error_message=error_message,
            duration_ms=duration_ms,
            timestamp=datetime.utcnow()
        )
        db.session.add(audit_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging audit trail: {e}")
        db.session.rollback()

def track_request():
    """Middleware to track all requests"""
    # Reset g values at start of each request to prevent stale data
    g.user_id = None
    g.start_time = None
    
    # Check if should track
    if not should_track_request():
        return
    
    # Get user info - fresh for each request
    user_id, is_admin = get_user_info()
    
    # Skip if admin
    if is_admin:
        return
    
    # Only track if user is logged in
    if not user_id:
        return
    
    # Store start time and user_id for this request
    g.start_time = time.time()
    g.user_id = user_id

def log_response(response):
    """Log response after request completes.

    2026-10-16: restricted to GET requests (view/list) only. Writes
    (POST/PUT/PATCH/DELETE) are now covered by the field-level mechanism
    below (_capture_before_flush/_capture_after_flush), which logs real
    per-column before/after values straight from the ORM - this
    request-level path used to ALSO log every write as a second, less
    useful entry (raw URL path as resource_type, e.g. "auth"/"batch-
    scheduling" instead of a real table name, and the full raw request
    body as new_values instead of just what changed) - duplicating and
    cluttering the log for the exact same action. GET requests have no DB
    write for the field-level mechanism to hook, so this remains the only
    source of "who looked at what" tracking."""
    if request.method != 'GET':
        return response
    # Check if tracking is enabled for this request
    if not hasattr(g, 'user_id') or g.user_id is None:
        return response

    try:
        # Calculate duration
        duration_ms = None
        if hasattr(g, 'start_time'):
            duration_ms = int((time.time() - g.start_time) * 1000)
        
        # Determine action and resource
        action = determine_action(request.method, request.path)
        resource_type = determine_resource_type(request.path)
        
        # Get request data
        request_data = None
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                request_data = request.get_json(silent=True)
            except:
                pass
        
        # Determine status
        status = 'success' if response.status_code < 400 else 'failed'
        
        # Extract resource info from response
        resource_id = None
        resource_name = None
        
        # Try to get resource_id from URL path (e.g., /api/production/work-orders/123)
        path_parts = request.path.split('/')
        for i, part in enumerate(path_parts):
            if part.isdigit():
                resource_id = part
                break
        
        try:
            if response.is_json:
                response_data = response.get_json()
                if isinstance(response_data, dict):
                    # Try to extract ID and name from common patterns
                    for id_key in ['id', 'order_id', 'product_id', 'customer_id', 'user_id', 'wo_id']:
                        if id_key in response_data and not resource_id:
                            resource_id = response_data[id_key]
                            break
                    
                    for name_key in ['wo_number', 'name', 'order_number', 'code', 'title', 'machine_name', 'product_name']:
                        if name_key in response_data:
                            resource_name = response_data[name_key]
                            break
                    
                    # For work orders, try to get more specific info
                    if 'work-orders' in request.path or 'work_order' in request.path:
                        if 'wo_number' in response_data:
                            resource_name = f"WO: {response_data['wo_number']}"
                        elif 'work_order' in response_data and isinstance(response_data['work_order'], dict):
                            wo = response_data['work_order']
                            resource_name = f"WO: {wo.get('wo_number', '')}"
                            if not resource_id:
                                resource_id = wo.get('id')
        except:
            pass
        
        # Log audit trail
        log_audit_trail(
            user_id=g.user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            old_values=None,  # Could be enhanced to track old values
            new_values=request_data,
            status=status,
            error_message=None if status == 'success' else f'HTTP {response.status_code}',
            duration_ms=duration_ms
        )
    except Exception as e:
        print(f"Error in log_response: {e}")
    
    return response

def init_audit_middleware(app):
    """Initialize audit middleware"""
    app.before_request(track_request)
    app.after_request(log_response)
    init_field_level_audit()


# ──────────────────────────────────────────────────────────────────────────
#  FIELD-LEVEL CHANGE CAPTURE (2026-10-16)
# ──────────────────────────────────────────────────────────────────────────
# The request-level tracking above (track_request/log_response) logs ONE row
# per HTTP request with the raw request body as `new_values` - it never
# actually looked at what changed in the database, and had no `old_values`
# at all outside the handful of routes manually wrapped in
# `@audit_log_action(...get_old_values=...)`. This section adds a SECOND,
# complementary mechanism that hooks SQLAlchemy's own commit lifecycle to
# capture REAL per-column before/after values for every row any route
# changes via the ORM - regardless of whether that route opted into the
# decorator. This is what "level paling detail" (user's words, 2026-10-16)
# means in practice: field-by-field diffs, not a raw request-body dump.
#
# Mechanics: `before_commit` still has live Python objects with SQLAlchemy's
# attribute history intact, so the diff is computed there and stashed on
# flask.g (request-scoped). `after_commit` fires only once the transaction
# has actually succeeded (so a rolled-back change is never logged), and
# writes the stashed diffs as AuditLog rows in their own follow-up
# transaction - mirroring the existing log_audit_trail() helper's own
# commit-per-log-entry pattern.

_SENSITIVE_FIELDS = {'password_hash', 'reset_token', 'google_id', 'api_key', 'secret', 'token'}
_SKIP_TABLES = {'audit_logs', 'number_sequence_counters'}  # never audit the audit log itself, or the numbering counter (too noisy, not meaningful business data)


def _serialize_value(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    # Decimal, date, datetime, Enum, etc - string form is good enough for an
    # audit trail (this is for human review, not round-tripping).
    return str(v)


def _diff_object(obj):
    """Returns {field_changes, resource_id, table_name} for one dirty ORM
    object, or None if nothing meaningful changed (or it's excluded)."""
    table_name = getattr(obj.__table__, 'name', None) if hasattr(obj, '__table__') else None
    if not table_name or table_name in _SKIP_TABLES:
        return None

    state = sa_inspect(obj)
    field_changes = {}
    for attr in state.mapper.column_attrs:
        key = attr.key
        if key in _SENSITIVE_FIELDS or any(s in key.lower() for s in _SENSITIVE_FIELDS):
            continue
        hist = state.attrs[key].history
        if not hist.has_changes():
            continue
        old_val = hist.deleted[0] if hist.deleted else None
        new_val = hist.added[0] if hist.added else getattr(obj, key, None)
        if old_val == new_val:
            continue
        field_changes[key] = {'old': _serialize_value(old_val), 'new': _serialize_value(new_val)}

    if not field_changes:
        return None
    return {
        'table_name': table_name,
        'resource_id': getattr(obj, 'id', None),
        'field_changes': field_changes,
    }


def _capture_before_flush(session, flush_context, instances):
    """SQLAlchemy's documented pattern for audit-logging: `before_flush` is
    the one lifecycle hook where it's safe to `session.add()` NEW objects
    (here, AuditLog rows) and have them included in the SAME flush/commit -
    unlike before_commit/after_commit, which either can't safely add new
    state or risk a second nested commit. If this flush rolls back, the
    AuditLog rows we add here roll back with it - correct, since we only
    want to log changes that actually took effect. A request that calls
    db.session.flush() explicitly mid-handler (common, e.g. to get a new
    row's id before using it) triggers this multiple times per request;
    each call only sees objects dirtied/added/deleted since the last flush,
    so nothing gets double-logged."""
    if not has_request_context():
        return
    user_id = getattr(g, 'user_id', None)
    if not user_id:
        return  # unauthenticated, or the acting user is super_admin (excluded) - see track_request()

    try:
        for obj in list(session.dirty):
            if not session.is_modified(obj):
                continue
            diff = _diff_object(obj)
            if diff:
                session.add(AuditLog(
                    user_id=user_id, action='update', resource_type=diff['table_name'],
                    resource_id=str(diff['resource_id']) if diff['resource_id'] is not None else None,
                    old_values=json.dumps({k: v['old'] for k, v in diff['field_changes'].items()}),
                    new_values=json.dumps({k: v['new'] for k, v in diff['field_changes'].items()}),
                    ip_address=request.remote_addr if request else None,
                    request_method=request.method if request else None,
                    request_url=request.url if request else None,
                    status='success', timestamp=datetime.utcnow(),
                ))
        # 'create' rows are finalized in after_flush: the new object's
        # primary key isn't assigned until the INSERT actually runs, which
        # hasn't happened yet at before_flush time - logging resource_id as
        # None for every create would make the audit trail far less useful
        # ("something was created" without saying what). BUT the field diff
        # itself must be computed HERE, not in after_flush - a freshly
        # inserted object's attribute history is no longer "changed" once
        # the INSERT has actually executed (confirmed empirically: deferring
        # _diff_object() to after_flush silently produced zero field_changes
        # for every create). So: diff now while history is still live,
        # stash (object, diff) pairs, and only pull `obj.id` in after_flush
        # once it exists.
        new_candidates = []
        for obj in list(session.new):
            diff = _diff_object(obj)
            if diff:
                new_candidates.append((obj, diff))
        if new_candidates:
            existing = getattr(g, '_pending_create_audit_objs', None) or []
            g._pending_create_audit_objs = existing + new_candidates

        for obj in list(session.deleted):
            table_name = getattr(obj.__table__, 'name', None) if hasattr(obj, '__table__') else None
            if not table_name or table_name in _SKIP_TABLES:
                continue
            session.add(AuditLog(
                user_id=user_id, action='delete', resource_type=table_name,
                resource_id=str(getattr(obj, 'id', None)) if getattr(obj, 'id', None) is not None else None,
                old_values=None, new_values=None,
                ip_address=request.remote_addr if request else None,
                request_method=request.method if request else None,
                request_url=request.url if request else None,
                status='success', timestamp=datetime.utcnow(),
            ))
    except Exception as e:
        print(f"Error capturing field-level audit diff: {e}")


def _capture_after_flush(session, flush_context):
    """Companion to _capture_before_flush: writes 'create' AuditLog rows
    now that the objects stashed there have real primary keys (the INSERT
    statements for this flush have just executed). session.add() here is
    still safe/supported - SQLAlchemy folds newly-added state from
    after_flush into the SAME ongoing flush operation."""
    if not has_request_context():
        return
    pending = getattr(g, '_pending_create_audit_objs', None)
    if not pending:
        return
    g._pending_create_audit_objs = None

    user_id = getattr(g, 'user_id', None)
    if not user_id:
        return

    for obj, diff in pending:
        # resource_id wasn't known at before_flush time (PK not assigned
        # yet) - re-read it now that the INSERT has executed.
        diff = {**diff, 'resource_id': getattr(obj, 'id', None)}
        session.add(AuditLog(
            user_id=user_id, action='create', resource_type=diff['table_name'],
            resource_id=str(diff['resource_id']) if diff['resource_id'] is not None else None,
            old_values=None,
            new_values=json.dumps({k: v['new'] for k, v in diff['field_changes'].items()}),
            ip_address=request.remote_addr if request else None,
            request_method=request.method if request else None,
            request_url=request.url if request else None,
            status='success', timestamp=datetime.utcnow(),
        ))


def init_field_level_audit():
    """Register the before_flush/after_flush listeners once at app
    startup. Idempotent - Flask-SQLAlchemy's db.session is a scoped_session
    proxying to one Session class per app, so listening once here covers
    every request."""
    from models import db as _db
    if getattr(init_field_level_audit, '_registered', False):
        return
    event.listen(_db.session, 'before_flush', _capture_before_flush)
    event.listen(_db.session, 'after_flush', _capture_after_flush)
    init_field_level_audit._registered = True


def audit_log_action(action, resource_type, get_resource_id=None, get_resource_name=None, get_old_values=None):
    """
    Decorator for detailed audit logging with old values tracking.
    
    Usage:
        @audit_log_action('update', 'work_order', 
                          get_resource_id=lambda: request.view_args.get('id'),
                          get_resource_name=lambda wo: wo.wo_number,
                          get_old_values=lambda wo: {'status': wo.status, 'quantity': wo.quantity_target})
        def update_work_order(id):
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            start_time = time.time()
            user_id = None
            old_values = None
            resource_id = None
            resource_name = None
            
            try:
                # Get user info
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                
                # Skip if super admin (see get_user_info() comment above)
                if user_id:
                    user = db.session.get(User, user_id)
                    if user and user.is_super_admin:
                        return f(*args, **kwargs)
                
                # Get resource ID
                if get_resource_id:
                    resource_id = get_resource_id()
                
                # Get old values before update (for update/delete actions)
                if get_old_values and action in ['update', 'delete'] and resource_id:
                    try:
                        # This function should return the model instance
                        old_values = get_old_values(resource_id)
                    except Exception as e:
                        print(f"Error getting old values: {e}")
                
            except Exception as e:
                print(f"Error in audit pre-processing: {e}")
            
            # Execute the actual function
            result = f(*args, **kwargs)
            
            # Log after execution
            try:
                if user_id:
                    duration_ms = int((time.time() - start_time) * 1000)
                    
                    # Get new values from request
                    new_values = None
                    if request.method in ['POST', 'PUT', 'PATCH']:
                        try:
                            new_values = request.get_json(silent=True)
                        except:
                            pass
                    
                    # Determine status from response
                    status = 'success'
                    if hasattr(result, 'status_code') and result.status_code >= 400:
                        status = 'failed'
                    elif isinstance(result, tuple) and len(result) > 1 and result[1] >= 400:
                        status = 'failed'
                    
                    # Get resource name from response if available
                    if get_resource_name and not resource_name:
                        try:
                            if hasattr(result, 'get_json'):
                                resp_data = result.get_json()
                                if isinstance(resp_data, dict):
                                    resource_name = resp_data.get('wo_number') or resp_data.get('name') or resp_data.get('code')
                        except:
                            pass
                    
                    log_audit_trail(
                        user_id=user_id,
                        action=action,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        resource_name=resource_name,
                        old_values=old_values,
                        new_values=new_values,
                        status=status,
                        duration_ms=duration_ms
                    )
            except Exception as e:
                print(f"Error in audit post-processing: {e}")
                traceback.print_exc()
            
            return result
        return decorated_function
    return decorator
