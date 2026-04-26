#!/usr/bin/env python3
"""Script to reset password for user Puji"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from models import User

def reset_puji_password():
    app = create_app()
    with app.app_context():
        # Find user Puji
        user = User.query.filter_by(username='Puji').first()
        
        if not user:
            print("User 'Puji' not found!")
            # Try with lowercase
            user = User.query.filter_by(username='puji').first()
            if not user:
                print("User 'puji' not found!")
                return
        
        # Reset password to "puji123"
        user.set_password('puji123')
        db.session.commit()
        
        print(f"Password for user '{user.username}' has been reset to: puji123")
        print(f"Email: {user.email}")
        print(f"Full Name: {user.full_name}")

if __name__ == '__main__':
    reset_puji_password()
