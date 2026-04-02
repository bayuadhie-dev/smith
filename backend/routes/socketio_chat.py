"""
WebSocket event handlers untuk Group Chat (Discord-style)
Requires: flask-socketio
"""
from flask import request
from flask_socketio import emit, join_room, leave_room, rooms
from flask_jwt_extended import decode_token
from datetime import datetime
import traceback

from extensions import socketio
from models import db
from models.user import User
from models.group_chat import (
    ChatMessage, ChatChannel, ChatServer, ChatThread,
    ChatDirectMessage, ChatDirectConversation,
    ChatUserStatus, ChatUnreadMessage,
    server_members
)
from utils.timezone import get_local_now

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def get_user_from_token(token):
    """Decode JWT dan return User object"""
    try:
        decoded = decode_token(token)
        user_id = decoded.get('sub')
        if user_id:
            return User.query.get(int(user_id))
    except Exception:
        pass
    return None


def user_room(user_id):
    """Room private per-user untuk menerima DM dan notifikasi"""
    return f'user_{user_id}'


def channel_room(channel_id):
    return f'channel_{channel_id}'


def thread_room(thread_id):
    return f'thread_{thread_id}'


def update_user_status(user_id, status):
    """Update status user di DB"""
    try:
        user_status = ChatUserStatus.query.filter_by(user_id=user_id).first()
        if not user_status:
            user_status = ChatUserStatus(user_id=user_id, status=status)
            db.session.add(user_status)
        else:
            user_status.status = status
            user_status.last_seen = get_local_now()
        db.session.commit()
    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────
# Connection Events
# ─────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    """Client terhubung — autentikasi via JWT dari query string"""
    token = request.args.get('token')
    if not token:
        return False  # Tolak koneksi

    user = get_user_from_token(token)
    if not user:
        return False

    # Join room privat user ini (untuk DM & notifikasi)
    join_room(user_room(user.id))

    # Update status online
    update_user_status(user.id, 'online')

    # Broadcast status ke semua member server yang sama
    try:
        servers = ChatServer.query.filter(
            ChatServer.members.any(id=user.id)
        ).all()
        for server in servers:
            emit('user_status_changed', {
                'user_id': user.id,
                'status': 'online',
                'username': user.username,
                'full_name': user.full_name,
            }, room=f'server_{server.id}')
            join_room(f'server_{server.id}')
    except Exception:
        pass

    print(f'[WS] {user.username} connected (sid={request.sid})')


@socketio.on('disconnect')
def on_disconnect():
    """Client terputus"""
    token = request.args.get('token')
    if not token:
        return

    user = get_user_from_token(token)
    if not user:
        return

    update_user_status(user.id, 'offline')

    try:
        servers = ChatServer.query.filter(
            ChatServer.members.any(id=user.id)
        ).all()
        for server in servers:
            emit('user_status_changed', {
                'user_id': user.id,
                'status': 'offline',
            }, room=f'server_{server.id}')
    except Exception:
        pass

    print(f'[WS] {user.username} disconnected')


# ─────────────────────────────────────────────
# Channel Room Management
# ─────────────────────────────────────────────

@socketio.on('join_channel')
def on_join_channel(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    channel_id = data.get('channel_id')
    if channel_id:
        join_room(channel_room(channel_id))
        emit('joined_channel', {'channel_id': channel_id}, room=request.sid)


@socketio.on('leave_channel')
def on_leave_channel(data):
    channel_id = data.get('channel_id')
    if channel_id:
        leave_room(channel_room(channel_id))


@socketio.on('join_thread')
def on_join_thread(data):
    thread_id = data.get('thread_id')
    if thread_id:
        join_room(thread_room(thread_id))


@socketio.on('leave_thread')
def on_leave_thread(data):
    thread_id = data.get('thread_id')
    if thread_id:
        leave_room(thread_room(thread_id))


# ─────────────────────────────────────────────
# Typing Indicator
# ─────────────────────────────────────────────

@socketio.on('typing_start')
def on_typing_start(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    channel_id = data.get('channel_id')
    thread_id = data.get('thread_id')

    payload = {
        'user_id': user.id,
        'username': user.username,
        'full_name': user.full_name,
    }

    if thread_id:
        emit('typing_start', {**payload, 'thread_id': thread_id},
             room=thread_room(thread_id), include_self=False)
    elif channel_id:
        emit('typing_start', {**payload, 'channel_id': channel_id},
             room=channel_room(channel_id), include_self=False)


@socketio.on('typing_stop')
def on_typing_stop(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    channel_id = data.get('channel_id')
    thread_id = data.get('thread_id')

    payload = {'user_id': user.id}

    if thread_id:
        emit('typing_stop', {**payload, 'thread_id': thread_id},
             room=thread_room(thread_id), include_self=False)
    elif channel_id:
        emit('typing_stop', {**payload, 'channel_id': channel_id},
             room=channel_room(channel_id), include_self=False)


# ─────────────────────────────────────────────
# Channel Messages
# ─────────────────────────────────────────────

@socketio.on('send_message')
def on_send_message(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        emit('error', {'message': 'Unauthorized'})
        return

    try:
        channel_id = data.get('channel_id')
        content = data.get('content', '').strip()
        reply_to_id = data.get('reply_to_id')

        if not channel_id or not content:
            emit('error', {'message': 'channel_id dan content wajib diisi'})
            return

        channel = ChatChannel.query.get(channel_id)
        if not channel:
            emit('error', {'message': 'Channel tidak ditemukan'})
            return

        # Access control: verifikasi user adalah member server
        server = channel.server
        is_member = user in server.members
        is_owner = server.owner_id == user.id
        if not is_member and not is_owner and not server.is_public:
            emit('error', {'message': 'Akses ditolak — bukan member server'})
            return

        # Private channel check
        if channel.is_private and user not in channel.allowed_members and not is_owner:
            emit('error', {'message': 'Akses ditolak — channel privat'})
            return

        msg = ChatMessage(
            channel_id=channel_id,
            user_id=user.id,
            content=content,
            reply_to_id=reply_to_id,
        )
        db.session.add(msg)
        db.session.flush()

        # Update last_message_at channel
        channel.last_message_at = get_local_now()

        # Update unread counts untuk semua member server kecuali sender
        server = channel.server
        for member in server.members:
            if member.id != user.id:
                unread = ChatUnreadMessage.query.filter_by(
                    user_id=member.id, channel_id=channel_id
                ).first()
                if not unread:
                    unread = ChatUnreadMessage(user_id=member.id, channel_id=channel_id, unread_count=1)
                    db.session.add(unread)
                else:
                    unread.unread_count = (unread.unread_count or 0) + 1

        db.session.commit()

        msg_dict = msg.to_dict()

        # Broadcast ke semua di channel room
        emit('new_message', msg_dict, room=channel_room(channel_id))

        # Kirim unread update ke tiap member
        for member in server.members:
            if member.id != user.id:
                unread = ChatUnreadMessage.query.filter_by(
                    user_id=member.id, channel_id=channel_id
                ).first()
                emit('unread_update', {
                    'channel_id': channel_id,
                    'count': unread.unread_count if unread else 1,
                }, room=user_room(member.id))

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        emit('error', {'message': str(e)})


@socketio.on('edit_message')
def on_edit_message(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        message_id = data.get('message_id')
        content = data.get('content', '').strip()

        if not content:
            return

        msg = ChatMessage.query.get(message_id)
        if not msg or msg.user_id != user.id or msg.is_deleted:
            emit('error', {'message': 'Tidak bisa edit pesan ini'})
            return

        msg.content = content
        msg.is_edited = True
        msg.edited_at = get_local_now()
        db.session.commit()

        payload = {'message_id': message_id, 'content': content, 'channel_id': msg.channel_id}
        emit('message_edited', payload, room=channel_room(msg.channel_id))

        # Kalau ada di thread
        if msg.thread_id:
            emit('message_edited', payload, room=thread_room(msg.thread_id))

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})


@socketio.on('delete_message')
def on_delete_message(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        message_id = data.get('message_id')
        msg = ChatMessage.query.get(message_id)
        if not msg:
            return

        # Hanya pemilik atau server owner
        server = msg.channel.server
        if msg.user_id != user.id and server.owner_id != user.id:
            emit('error', {'message': 'Tidak ada izin'})
            return

        msg.is_deleted = True
        msg.deleted_at = get_local_now()
        db.session.commit()

        payload = {'message_id': message_id, 'channel_id': msg.channel_id}
        emit('message_deleted', payload, room=channel_room(msg.channel_id))
        if msg.thread_id:
            emit('message_deleted', payload, room=thread_room(msg.thread_id))

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})


@socketio.on('add_reaction')
def on_add_reaction(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    from models.group_chat import ChatReaction
    try:
        message_id = data.get('message_id')
        emoji = data.get('emoji', '')

        msg = ChatMessage.query.get(message_id)
        if not msg or msg.is_deleted:
            return

        existing = ChatReaction.query.filter_by(
            message_id=message_id, user_id=user.id, emoji=emoji
        ).first()

        if existing:
            db.session.delete(existing)
        else:
            reaction = ChatReaction(message_id=message_id, user_id=user.id, emoji=emoji)
            db.session.add(reaction)

        db.session.commit()

        # Send updated reactions summary
        reactions = msg._get_reaction_summary()
        payload = {'message_id': message_id, 'reactions': reactions, 'channel_id': msg.channel_id}
        emit('reaction_updated', payload, room=channel_room(msg.channel_id))
        if msg.thread_id:
            emit('reaction_updated', payload, room=thread_room(msg.thread_id))

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})


# ─────────────────────────────────────────────
# Thread Reply
# ─────────────────────────────────────────────

@socketio.on('send_thread_reply')
def on_send_thread_reply(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        thread_id = data.get('thread_id')
        content = data.get('content', '').strip()

        if not thread_id or not content:
            emit('error', {'message': 'thread_id dan content wajib'})
            return

        thread = ChatThread.query.get(thread_id)
        if not thread:
            emit('error', {'message': 'Thread tidak ditemukan'})
            return

        msg = ChatMessage(
            channel_id=thread.channel_id,
            user_id=user.id,
            content=content,
            thread_id=thread_id,
        )
        db.session.add(msg)
        db.session.flush()

        # Update thread stats
        thread.reply_count += 1
        thread.last_reply_at = get_local_now()

        db.session.commit()

        msg_dict = msg.to_dict()

        # Broadcast ke thread room
        emit('new_thread_reply', {**msg_dict, 'thread_id': thread_id}, room=thread_room(thread_id))

        # Update thread_reply_count di parent message (broadcast ke channel)
        starter_msg = thread.starter_message
        emit('thread_updated', {
            'channel_id': thread.channel_id,
            'message_id': starter_msg.id,
            'thread_id': thread_id,
            'reply_count': thread.reply_count,
            'last_reply': msg_dict,
        }, room=channel_room(thread.channel_id))

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        emit('error', {'message': str(e)})


@socketio.on('create_thread')
def on_create_thread(data):
    """Buat thread dari sebuah pesan"""
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        message_id = data.get('message_id')
        msg = ChatMessage.query.get(message_id)
        if not msg or msg.is_deleted:
            emit('error', {'message': 'Pesan tidak ditemukan'})
            return

        # Cek apakah thread sudah ada
        if msg.is_thread_starter and msg.thread_id:
            thread = ChatThread.query.get(msg.thread_id)
            emit('thread_created', thread.to_dict(), room=request.sid)
            return

        # Buat thread baru
        thread = ChatThread(
            channel_id=msg.channel_id,
            starter_message_id=message_id,
            created_by=user.id,
        )
        db.session.add(thread)
        db.session.flush()

        # Mark message sebagai thread starter
        msg.is_thread_starter = True
        msg.thread_id = thread.id

        db.session.commit()

        thread_dict = thread.to_dict()
        emit('thread_created', thread_dict, room=channel_room(msg.channel_id))
        emit('thread_created', thread_dict, room=request.sid)

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        emit('error', {'message': str(e)})


# ─────────────────────────────────────────────
# Direct Messages
# ─────────────────────────────────────────────

@socketio.on('send_dm')
def on_send_dm(data):
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        receiver_id = data.get('receiver_id')
        content = data.get('content', '').strip()

        if not receiver_id or not content:
            emit('error', {'message': 'receiver_id dan content wajib'})
            return

        receiver = User.query.get(receiver_id)
        if not receiver:
            emit('error', {'message': 'User tidak ditemukan'})
            return

        # Get or create conversation
        u1, u2 = (user.id, receiver_id) if user.id < receiver_id else (receiver_id, user.id)
        conv = ChatDirectConversation.query.filter_by(user1_id=u1, user2_id=u2).first()
        if not conv:
            conv = ChatDirectConversation(user1_id=u1, user2_id=u2)
            db.session.add(conv)
            db.session.flush()

        # Buat DM
        dm = ChatDirectMessage(
            conversation_id=conv.id,
            sender_id=user.id,
            receiver_id=receiver_id,
            content=content,
        )
        db.session.add(dm)

        # Update unread untuk receiver
        if receiver_id == conv.user1_id:
            conv.unread_count_user1 += 1
        else:
            conv.unread_count_user2 += 1

        conv.last_message_at = get_local_now()
        db.session.commit()

        dm_dict = dm.to_dict()

        # Kirim ke SENDER via user_room (agar semua tab sender dapat event)
        sender_payload = {**dm_dict, 'conversation': conv.to_dict(for_user_id=user.id)}
        emit('new_dm', sender_payload, room=user_room(user.id))

        # Kirim ke RECEIVER
        receiver_payload = {**dm_dict, 'conversation': conv.to_dict(for_user_id=receiver_id)}
        emit('new_dm', receiver_payload, room=user_room(receiver_id))

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        emit('error', {'message': str(e)})


@socketio.on('dm_read')
def on_dm_read(data):
    """Tandai DM sudah dibaca"""
    token = request.args.get('token')
    user = get_user_from_token(token)
    if not user:
        return

    try:
        conversation_id = data.get('conversation_id')
        conv = ChatDirectConversation.query.get(conversation_id)
        if not conv:
            return

        # Reset unread count untuk user ini
        if user.id == conv.user1_id:
            conv.unread_count_user1 = 0
        else:
            conv.unread_count_user2 = 0

        # Mark all messages as read
        ChatDirectMessage.query.filter_by(
            conversation_id=conversation_id,
            receiver_id=user.id,
            is_read=False
        ).update({'is_read': True, 'read_at': get_local_now()})

        db.session.commit()

        emit('dm_read_ack', {'conversation_id': conversation_id}, room=request.sid)

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})


def init_socketio_events(app):
    """Register socketio dengan app"""
    from extensions import socketio as sio
    sio.init_app(app)
    print("✓ WebSocket (SocketIO) events registered")
