"""
Password strength validation utilities
"""
import re


def validate_password_strength(password):
    """
    Validate password strength
    
    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    
    Returns:
        tuple: (is_valid, error_message)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;\'`~]', password):
        return False, "Password must contain at least one special character (!@#$%^&*...)"
    
    # Check for common weak passwords
    common_passwords = [
        'password', 'password123', '12345678', 'qwerty123', 'admin123',
        'welcome123', 'letmein123', 'monkey123', '1q2w3e4r', 'password1'
    ]
    
    if password.lower() in common_passwords:
        return False, "This password is too common. Please choose a stronger password"
    
    return True, None


def get_password_strength_score(password):
    """
    Calculate password strength score (0-100)
    
    Returns:
        dict: {
            'score': int (0-100),
            'strength': str ('weak', 'fair', 'good', 'strong'),
            'feedback': list of str
        }
    """
    if not password:
        return {'score': 0, 'strength': 'weak', 'feedback': ['Password is required']}
    
    score = 0
    feedback = []
    
    # Length score (max 30 points)
    length = len(password)
    if length >= 8:
        score += min(30, length * 2)
    else:
        feedback.append(f"Password should be at least 8 characters (current: {length})")
    
    # Character variety (max 40 points)
    has_upper = bool(re.search(r'[A-Z]', password))
    has_lower = bool(re.search(r'[a-z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;\'`~]', password))
    
    if has_upper:
        score += 10
    else:
        feedback.append("Add uppercase letters")
    
    if has_lower:
        score += 10
    else:
        feedback.append("Add lowercase letters")
    
    if has_digit:
        score += 10
    else:
        feedback.append("Add numbers")
    
    if has_special:
        score += 10
    else:
        feedback.append("Add special characters")
    
    # Complexity bonus (max 30 points)
    unique_chars = len(set(password))
    if unique_chars >= 8:
        score += 15
    
    # No repeated patterns
    if not re.search(r'(.)\1{2,}', password):  # No 3+ repeated chars
        score += 10
    else:
        feedback.append("Avoid repeated characters")
    
    # No sequential patterns
    if not re.search(r'(012|123|234|345|456|567|678|789|abc|bcd|cde|def)', password.lower()):
        score += 5
    else:
        feedback.append("Avoid sequential patterns")
    
    # Determine strength level
    if score >= 80:
        strength = 'strong'
    elif score >= 60:
        strength = 'good'
    elif score >= 40:
        strength = 'fair'
    else:
        strength = 'weak'
    
    return {
        'score': min(100, score),
        'strength': strength,
        'feedback': feedback if feedback else ['Password looks good!']
    }


def get_password_requirements():
    """Get password requirements as a dict"""
    return {
        'min_length': 8,
        'require_uppercase': True,
        'require_lowercase': True,
        'require_number': True,
        'require_special': True,
        'special_chars': '!@#$%^&*(),.?":{}|<>_-+=[]\\\/;\'`~',
        'description': 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
    }
