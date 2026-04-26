import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app

def setup_logging(app):
    """Setup application logging to single consolidated file"""
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Single log file path for all logs
    combined_log = os.path.join(log_dir, 'combined.log')
    
    # Format for log messages
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Single log handler for all levels (INFO and above)
    combined_handler = RotatingFileHandler(
        combined_log,
        maxBytes=50 * 1024 * 1024,  # 50MB (increased since all logs in one file)
        backupCount=10,
        encoding='utf-8'
    )
    combined_handler.setLevel(logging.INFO)  # Log INFO, WARNING, ERROR, CRITICAL
    combined_handler.setFormatter(formatter)
    
    # Add handler to app logger
    app.logger.addHandler(combined_handler)
    app.logger.setLevel(logging.INFO)
    
    # Create access logger (uses same handler)
    access_logger = logging.getLogger('access')
    access_logger.addHandler(combined_handler)
    access_logger.setLevel(logging.INFO)
    
    # Also log to console in development
    if app.debug:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        app.logger.addHandler(console_handler)
    
    return app.logger, access_logger


def log_request(access_logger):
    """Middleware to log all requests"""
    from flask import request, g
    import time
    
    def before_request():
        g.start_time = time.time()
    
    def after_request(response):
        # Check if start_time exists and is not None
        start_time = getattr(g, 'start_time', None)
        if start_time is not None:
            duration = (time.time() - start_time) * 1000  # ms
            
            # Get user info if available
            user_info = ''
            try:
                from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                if user_id:
                    user_info = f' [User:{user_id}]'
            except:
                pass
            
            # Log the request with ACCESS prefix for easy filtering
            log_msg = f'ACCESS: {request.remote_addr}{user_info} - "{request.method} {request.path}" {response.status_code} {duration:.2f}ms'
            
            if response.status_code >= 400:
                access_logger.warning(log_msg)
            else:
                access_logger.info(log_msg)
        
        return response
    
    return before_request, after_request


def send_error_email(subject, error_message, traceback_text):
    """Send error alert email using SMTP configuration"""
    try:
        from config import Config
        
        # Only send email in production
        if os.getenv('FLASK_ENV', 'development') == 'development':
            return
        
        # Check if email configuration is available
        if not all([Config.MAIL_SERVER, Config.MAIL_USERNAME, Config.MAIL_PASSWORD, Config.MAIL_DEFAULT_SENDER]):
            return
        
        # Create email message
        msg = MIMEMultipart()
        msg['From'] = Config.MAIL_DEFAULT_SENDER
        msg['To'] = Config.MAIL_USERNAME  # Send to the same email account
        msg['Subject'] = f'[ERP ERROR ALERT] {subject}'
        
        # Email body
        body = f"""
ERP System Error Alert

Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Environment: {os.getenv('FLASK_ENV', 'development')}

Error Message:
{error_message}

Traceback:
{traceback_text}

This is an automated alert. Please check the logs for more details.
"""
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
            if Config.MAIL_USE_TLS:
                server.starttls()
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.send_message(msg)
            
    except Exception as e:
        # Don't raise exception in error handler
        print(f"Failed to send error email: {str(e)}")


def log_exception(app_logger):
    """Log unhandled exceptions and send email alert in production"""
    from flask import request
    import traceback
    
    def handle_exception(e):
        # Log the full traceback
        tb = traceback.format_exc()
        app_logger.error(f'Unhandled Exception on {request.method} {request.path}:\n{tb}')
        
        # Send email alert in production
        if os.getenv('FLASK_ENV', 'development') != 'development':
            send_error_email(
                subject=f'Unhandled Exception: {request.method} {request.path}',
                error_message=str(e),
                traceback_text=tb
            )
        
        # Return error response
        from flask import jsonify
        return jsonify({
            'error': 'Internal server error',
            'message': str(e) if app_logger.level <= logging.DEBUG else 'An unexpected error occurred'
        }), 500
    
    return handle_exception
