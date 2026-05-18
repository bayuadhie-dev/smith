"""
Rate limiting and account lockout utilities
"""
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from models import db
from utils.timezone import get_local_now

# In-memory storage for rate limiting (use Redis in production)
login_attempts = {}  # {ip_address: [(timestamp, username), ...]}
account_lockouts = {}  # {username: lockout_until_timestamp}

# Configuration
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 5
RATE_LIMIT_WINDOW_MINUTES = 15
MAX_REQUESTS_PER_WINDOW = 10


def clean_old_attempts():
    """Clean up old login attempts from memory"""
    now = get_local_now()
    cutoff = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)
    
    # Clean login attempts
    for ip in list(login_attempts.keys()):
        login_attempts[ip] = [
            (ts, username) for ts, username in login_attempts[ip]
            if ts > cutoff
        ]
        if not login_attempts[ip]:
            del login_attempts[ip]
    
    # Clean expired lockouts
    for username in list(account_lockouts.keys()):
        if account_lockouts[username] < now:
            del account_lockouts[username]


def get_client_ip():
    """Get client IP address from request"""
    # Check for proxy headers first
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr


def is_account_locked(username):
    """Check if account is locked due to failed attempts"""
    clean_old_attempts()
    
    if username in account_lockouts:
        lockout_until = account_lockouts[username]
        if lockout_until > get_local_now():
            remaining_seconds = int((lockout_until - get_local_now()).total_seconds())
            remaining_minutes = remaining_seconds // 60
            remaining_seconds = remaining_seconds % 60
            return True, f"Account locked due to too many failed login attempts. Please try again in {remaining_minutes}m {remaining_seconds}s."
        else:
            # Lockout expired
            del account_lockouts[username]
    
    return False, None


def record_failed_login(username):
    """Record a failed login attempt"""
    clean_old_attempts()
    
    ip = get_client_ip()
    now = get_local_now()
    
    # Record attempt
    if ip not in login_attempts:
        login_attempts[ip] = []
    login_attempts[ip].append((now, username))
    
    # Count failed attempts for this username from this IP
    username_attempts = [
        (ts, uname) for ts, uname in login_attempts[ip]
        if uname == username
    ]
    
    # Lock account if too many attempts
    if len(username_attempts) >= MAX_LOGIN_ATTEMPTS:
        lockout_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        account_lockouts[username] = lockout_until
        return True, len(username_attempts)
    
    return False, len(username_attempts)


def clear_failed_attempts(username):
    """Clear failed login attempts for a username (after successful login)"""
    ip = get_client_ip()
    
    if ip in login_attempts:
        login_attempts[ip] = [
            (ts, uname) for ts, uname in login_attempts[ip]
            if uname != username
        ]
        if not login_attempts[ip]:
            del login_attempts[ip]
    
    # Remove lockout if exists
    if username in account_lockouts:
        del account_lockouts[username]


def rate_limit(max_requests=MAX_REQUESTS_PER_WINDOW, window_minutes=RATE_LIMIT_WINDOW_MINUTES):
    """
    Decorator for rate limiting endpoints
    Usage: @rate_limit(max_requests=10, window_minutes=15)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            clean_old_attempts()
            
            ip = get_client_ip()
            now = get_local_now()
            cutoff = now - timedelta(minutes=window_minutes)
            
            # Count requests from this IP in the window
            if ip in login_attempts:
                recent_requests = [ts for ts, _ in login_attempts[ip] if ts > cutoff]
                if len(recent_requests) >= max_requests:
                    return jsonify({
                        'error': f'Too many requests. Please try again in a few minutes.',
                        'retry_after': window_minutes * 60
                    }), 429
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def get_lockout_info(username):
    """Get lockout information for a username"""
    if username in account_lockouts:
        lockout_until = account_lockouts[username]
        if lockout_until > get_local_now():
            remaining_seconds = int((lockout_until - get_local_now()).total_seconds())
            return {
                'locked': True,
                'lockout_until': lockout_until.isoformat(),
                'remaining_seconds': remaining_seconds
            }
    
    return {'locked': False}


def get_remaining_attempts(username):
    """Get remaining login attempts before lockout"""
    clean_old_attempts()
    
    ip = get_client_ip()
    
    if ip not in login_attempts:
        return MAX_LOGIN_ATTEMPTS
    
    username_attempts = [
        (ts, uname) for ts, uname in login_attempts[ip]
        if uname == username
    ]
    
    return max(0, MAX_LOGIN_ATTEMPTS - len(username_attempts))
