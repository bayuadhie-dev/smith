from app import create_app
from models.user import User, db
app = create_app()
with app.app_context():
    users = User.query.all()
    for u in users:
        if 'puji' in u.username.lower() and u.username != 'PujiR':
            print(f"User: '{u.username}', Length: {len(u.username)}")
            if u.username != 'Puji':
                u.username = 'Puji'
                u.set_password('maintenance25')
                db.session.commit()
                print("Renamed to 'Puji' and set pwd to 'maintenance25'")
