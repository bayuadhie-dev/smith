"""
Shared extensions — hindari circular import antara app.py dan socketio_chat.py
"""
from flask_socketio import SocketIO

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading', logger=False, engineio_logger=False)
