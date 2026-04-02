/**
 * useChatSocket — custom hook untuk mengelola koneksi Socket.IO Group Chat
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

export interface SocketMessage {
  id: number;
  channel_id: number;
  user_id: number;
  user: { id: number; username: string; full_name: string; avatar?: string };
  content: string;
  message_type: string;
  reply_to_id?: number;
  reply_to?: SocketMessage;
  thread_id?: number;
  is_thread_starter?: boolean;
  thread_reply_count?: number;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  created_at: string;
  reactions: { emoji: string; count: number; users: number[] }[];
  attachments?: { id: number; filename: string; file_path: string; file_size: number; content_type: string }[];
}

export interface DmMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  sender: { id: number; username: string; full_name: string; avatar?: string };
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

interface UseChatSocketOptions {
  token: string | null;
  onNewMessage?: (msg: SocketMessage) => void;
  onMessageEdited?: (data: { message_id: number; content: string; channel_id: number }) => void;
  onMessageDeleted?: (data: { message_id: number; channel_id: number }) => void;
  onReactionUpdated?: (data: { message_id: number; reactions: any[]; channel_id: number }) => void;
  onNewThreadReply?: (msg: SocketMessage & { thread_id: number }) => void;
  onThreadUpdated?: (data: { channel_id: number; message_id: number; thread_id: number; reply_count: number; last_reply: SocketMessage }) => void;
  onThreadCreated?: (thread: any) => void;
  onNewDm?: (data: { conversation: any } & DmMessage) => void;
  onUnreadUpdate?: (data: { channel_id: number; count: number }) => void;
  onTypingStart?: (data: { user_id: number; username: string; full_name: string; channel_id?: number; thread_id?: number }) => void;
  onTypingStop?: (data: { user_id: number; channel_id?: number; thread_id?: number }) => void;
  onUserStatusChanged?: (data: { user_id: number; status: string; username?: string; full_name?: string }) => void;
  onError?: (data: { message: string }) => void;
}

export function useChatSocket(options: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.token) return;

    const socket = io(SOCKET_URL, {
      query: { token: options.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    socket.on('new_message', (msg: SocketMessage) => optionsRef.current.onNewMessage?.(msg));
    socket.on('message_edited', (data: any) => optionsRef.current.onMessageEdited?.(data));
    socket.on('message_deleted', (data: any) => optionsRef.current.onMessageDeleted?.(data));
    socket.on('reaction_updated', (data: any) => optionsRef.current.onReactionUpdated?.(data));
    socket.on('new_thread_reply', (msg: any) => optionsRef.current.onNewThreadReply?.(msg));
    socket.on('thread_updated', (data: any) => optionsRef.current.onThreadUpdated?.(data));
    socket.on('thread_created', (thread: any) => optionsRef.current.onThreadCreated?.(thread));
    socket.on('new_dm', (data: any) => optionsRef.current.onNewDm?.(data));
    socket.on('unread_update', (data: any) => optionsRef.current.onUnreadUpdate?.(data));
    socket.on('typing_start', (data: any) => optionsRef.current.onTypingStart?.(data));
    socket.on('typing_stop', (data: any) => optionsRef.current.onTypingStop?.(data));
    socket.on('user_status_changed', (data: any) => optionsRef.current.onUserStatusChanged?.(data));
    socket.on('error', (data: any) => optionsRef.current.onError?.(data));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.token]);

  // ── Emit helpers ──

  const joinChannel = useCallback((channelId: number) => {
    socketRef.current?.emit('join_channel', { channel_id: channelId });
  }, []);

  const leaveChannel = useCallback((channelId: number) => {
    socketRef.current?.emit('leave_channel', { channel_id: channelId });
  }, []);

  const joinThread = useCallback((threadId: number) => {
    socketRef.current?.emit('join_thread', { thread_id: threadId });
  }, []);

  const leaveThread = useCallback((threadId: number) => {
    socketRef.current?.emit('leave_thread', { thread_id: threadId });
  }, []);

  const sendMessage = useCallback((channelId: number, content: string, replyToId?: number) => {
    socketRef.current?.emit('send_message', { channel_id: channelId, content, reply_to_id: replyToId });
  }, []);

  const editMessage = useCallback((messageId: number, content: string) => {
    socketRef.current?.emit('edit_message', { message_id: messageId, content });
  }, []);

  const deleteMessage = useCallback((messageId: number) => {
    socketRef.current?.emit('delete_message', { message_id: messageId });
  }, []);

  const addReaction = useCallback((messageId: number, emoji: string) => {
    socketRef.current?.emit('add_reaction', { message_id: messageId, emoji });
  }, []);

  const createThread = useCallback((messageId: number) => {
    socketRef.current?.emit('create_thread', { message_id: messageId });
  }, []);

  const sendThreadReply = useCallback((threadId: number, content: string) => {
    socketRef.current?.emit('send_thread_reply', { thread_id: threadId, content });
  }, []);

  const sendDm = useCallback((receiverId: number, content: string) => {
    socketRef.current?.emit('send_dm', { receiver_id: receiverId, content });
  }, []);

  const markDmRead = useCallback((conversationId: number) => {
    socketRef.current?.emit('dm_read', { conversation_id: conversationId });
  }, []);

  const typingStart = useCallback((channelId?: number, threadId?: number) => {
    socketRef.current?.emit('typing_start', { channel_id: channelId, thread_id: threadId });
  }, []);

  const typingStop = useCallback((channelId?: number, threadId?: number) => {
    socketRef.current?.emit('typing_stop', { channel_id: channelId, thread_id: threadId });
  }, []);

  const isConnected = () => socketRef.current?.connected ?? false;

  return {
    socket: socketRef,
    isConnected,
    joinChannel,
    leaveChannel,
    joinThread,
    leaveThread,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    createThread,
    sendThreadReply,
    sendDm,
    markDmRead,
    typingStart,
    typingStop,
  };
}
