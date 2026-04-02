import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';
import {
  HashtagIcon, PlusIcon, UserGroupIcon, ChevronDownIcon, ChevronRightIcon,
  PaperAirplaneIcon, FaceSmileIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  ArrowUturnLeftIcon, XMarkIcon, ChatBubbleLeftRightIcon,
  SpeakerWaveIcon, LockClosedIcon, PaperClipIcon, ChatBubbleOvalLeftEllipsisIcon,
  ChevronDoubleDownIcon, ClipboardIcon, CheckIcon, EllipsisHorizontalIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useChatSocket, SocketMessage, DmMessage } from '../../hooks/useChatSocket';
import EmojiPicker from '../../components/EmojiPicker';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Server { id: number; name: string; description: string; icon: string; owner_id: number; is_public: boolean; member_count: number; categories?: Category[]; uncategorized_channels?: Channel[]; }
interface Category { id: number; name: string; order: number; is_collapsed: boolean; channels: Channel[]; }
interface Channel { id: number; name: string; description: string; channel_type: string; is_private: boolean; is_locked: boolean; topic: string; message_count: number; }
interface Member { id: number; username: string; full_name: string; status?: 'online' | 'idle' | 'dnd' | 'offline'; custom_status?: string; }
interface DmConversation { id: number; user1_id: number; user2_id: number; last_message_at: string; unread_count: number; other_user: { id: number; username: string; full_name: string; avatar?: string }; last_message?: { content: string }; }
interface ThreadData { thread: { id: number; channel_id: number; starter_message_id: number; reply_count: number; }; starter_message: SocketMessage; replies: SocketMessage[]; }

const EMOJI_LIST = ['👍','❤️','😂','😮','😢','😡','🎉','🔥','👀','💯','✅','🙏','💪','🤔','😊'];

const statusColor = (s?: string) => ({ online: '#3ba55d', idle: '#faa81a', dnd: '#ed4245', offline: '#747f8d' }[s || 'offline'] || '#747f8d');

// ─── Standalone Components (MUST be outside GroupChat to avoid remount bug) ───

const TypingBar: React.FC<{ users: string[] }> = ({ users }) => {
  if (!users.length) return null;
  const text = users.length === 1 ? `${users[0]} sedang mengetik...` : `${users.join(', ')} sedang mengetik...`;
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-gray-400">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      {text}
    </div>
  );
};

interface InputBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  onFileClick?: () => void;
  replyTo?: SocketMessage | null;
  editingMessage?: SocketMessage | null;
  onCancelReply?: () => void;
  showEmojiPicker?: boolean;
  onToggleEmoji?: () => void;
  onEmojiSelect?: (e: string) => void;
}

const ChatInputBox: React.FC<InputBoxProps> = ({
  value, onChange, onSend, placeholder, inputRef, fileInputRef, onFileClick,
  replyTo, editingMessage, onCancelReply, showEmojiPicker, onToggleEmoji, onEmojiSelect,
}) => {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="px-4 pb-4 shrink-0 relative">
      {/* Reply/edit bar */}
      {(replyTo || editingMessage) && (
        <div className="flex items-center gap-2 mb-1 px-3 py-1.5 bg-[#2b2d31] border border-[#3f4147] rounded-t-lg text-xs text-gray-300">
          {replyTo ? <>
            <ArrowUturnLeftIcon className="h-3.5 w-3.5 text-[#5865f2]" />
            <span>Balas <strong className="text-white">{replyTo.user?.full_name}</strong>: <span className="text-gray-400">{replyTo.content.slice(0, 60)}</span></span>
          </> : <>
            <PencilIcon className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-yellow-300">Mengedit pesan</span>
          </>}
          <button onClick={onCancelReply} className="ml-auto text-gray-500 hover:text-white transition-colors">
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className={`flex items-end gap-2 bg-[#383a40] rounded-xl px-3 py-2.5 ${ (replyTo || editingMessage) ? 'rounded-t-none border-t border-[#4f545c]' : ''}`}>
        {fileInputRef && (
          <button onClick={onFileClick}
            className="text-gray-400 hover:text-white p-1 shrink-0 transition-colors" title="Lampirkan file">
            <PaperClipIcon className="h-5 w-5" />
          </button>
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-400 resize-none outline-none leading-relaxed"
          style={{ minHeight: 22, maxHeight: 160 }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 160) + 'px';
          }}
        />
        <button onClick={onToggleEmoji}
          className="text-gray-400 hover:text-yellow-400 p-1 shrink-0 transition-colors" title="Emoji">
          <FaceSmileIcon className="h-5 w-5" />
        </button>
        <button onClick={onSend} disabled={!value.trim()}
          className="p-1 shrink-0 text-[#5865f2] hover:text-blue-300 disabled:text-gray-600 transition-colors">
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>
      {/* Full Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker onSelect={e => onEmojiSelect?.(e)} onClose={onToggleEmoji!} />
      )}
      {fileInputRef && (
        <input ref={fileInputRef} type="file" className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" />
      )}
    </div>
  );
};

const Avatar: React.FC<{ name: string; size?: number; status?: string }> = ({ name, size = 36, status }) => {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors = ['#5865f2','#57f287','#fee75c','#eb459e','#ed4245','#3ba55d','#faa81a'];
  const color = colors[name?.charCodeAt(0) % colors.length || 0];
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', userSelect: 'none' }}>{initials}</div>
      {status && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: statusColor(status), border: '2px solid #2b2d31' }} />}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const GroupChat: React.FC = () => {
  const authUser = useSelector((state: RootState) => state.auth.user);
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const currentUserId = authUser?.id || parseInt(localStorage.getItem('userId') || '0');

  // Server & Channel state
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<number[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  // Members state
  const [onlineMembers, setOnlineMembers] = useState<Member[]>([]);
  const [offlineMembers, setOfflineMembers] = useState<Member[]>([]);
  const [showMembers, setShowMembers] = useState(true);

  // Input state
  const [messageInput, setMessageInput] = useState('');
  const [dmInput, setDmInput] = useState('');         // TERPISAH dari channel input!
  const [replyTo, setReplyTo] = useState<SocketMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<SocketMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [showThreadEmojiPicker, setShowThreadEmojiPicker] = useState(false);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);

  // Thread state
  const [activeThread, setActiveThread] = useState<ThreadData | null>(null);
  const [threadInput, setThreadInput] = useState('');
  const [typingThreadUsers, setTypingThreadUsers] = useState<string[]>([]);

  // DM state
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [selectedDm, setSelectedDm] = useState<DmConversation | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmMode, setDmMode] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Typing
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Hover DM
  const [hoveredDmMsg, setHoveredDmMsg] = useState<number | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Member[]>([]);

  // Sidebar DM user picker
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [dmPickerUsers, setDmPickerUsers] = useState<Member[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedChannelRef = useRef<Channel | null>(null);
  const selectedServerRef = useRef<Server | null>(null);

  useEffect(() => { selectedChannelRef.current = selectedChannel; }, [selectedChannel]);
  useEffect(() => { selectedServerRef.current = selectedServer; }, [selectedServer]);

  // Ref for selectedDm — agar onNewDm callback tidak stale
  const selectedDmRef = useRef<DmConversation | null>(null);
  useEffect(() => { selectedDmRef.current = selectedDm; }, [selectedDm]);
  const dmModeRef = useRef(false);
  useEffect(() => { dmModeRef.current = dmMode; }, [dmMode]);
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // ─── WebSocket ────────────────────────────────────────────────────────────
  const { joinChannel, leaveChannel, joinThread, leaveThread, sendMessage: wsSend,
    editMessage: wsEdit, deleteMessage: wsDelete, addReaction: wsReact,
    createThread: wsCreateThread, sendThreadReply: wsSendThreadReply,
    sendDm: wsSendDm, typingStart, typingStop } = useChatSocket({
    token,
    onNewMessage: (msg) => {
      if (msg.channel_id === selectedChannelRef.current?.id) {
        setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        setUnreadCounts(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 }));
      }
    },
    onMessageEdited: ({ message_id, content, channel_id }) => {
      if (channel_id === selectedChannelRef.current?.id) {
        setMessages(prev => prev.map(m => m.id === message_id ? { ...m, content, is_edited: true } : m));
      }
      if (activeThread) {
        setActiveThread(prev => prev ? { ...prev, replies: prev.replies.map(r => r.id === message_id ? { ...r, content, is_edited: true } : r) } : prev);
      }
    },
    onMessageDeleted: ({ message_id }) => {
      setMessages(prev => prev.map(m => m.id === message_id ? { ...m, is_deleted: true, content: '[Message deleted]' } : m));
      if (activeThread) {
        setActiveThread(prev => prev ? { ...prev, replies: prev.replies.filter(r => r.id !== message_id) } : prev);
      }
    },
    onReactionUpdated: ({ message_id, reactions }) => {
      setMessages(prev => prev.map(m => m.id === message_id ? { ...m, reactions } : m));
      if (activeThread) {
        setActiveThread(prev => prev ? { ...prev, replies: prev.replies.map(r => r.id === message_id ? { ...r, reactions } : r) } : prev);
      }
    },
    onNewThreadReply: (msg) => {
      if (activeThread && msg.thread_id === activeThread.thread.id) {
        setActiveThread(prev => prev ? { ...prev, replies: [...prev.replies.filter(r => r.id !== msg.id), msg] } : prev);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    },
    onThreadUpdated: ({ message_id, thread_id, reply_count }) => {
      setMessages(prev => prev.map(m => m.id === message_id ? { ...m, thread_id, is_thread_starter: true, thread_reply_count: reply_count } : m));
    },
    onThreadCreated: (thread) => {
      setMessages(prev => prev.map(m => m.id === thread.starter_message_id ? { ...m, thread_id: thread.id, is_thread_starter: true } : m));
    },
    onNewDm: (data) => {
      const myId = currentUserIdRef.current;
      const curDm = selectedDmRef.current;
      const inDmMode = dmModeRef.current;

      // Cek apakah ini percakapan yang sedang dibuka
      const otherUserId = data.sender_id === myId ? data.receiver_id : data.sender_id;
      const isActiveDm = inDmMode && curDm &&
        curDm.other_user?.id === otherUserId;

      if (isActiveDm) {
        // Update conv ID jika masih 0 (percakapan pertama kali)
        const isNewConv = curDm && curDm.id === 0 && data.conversation?.id;
        if (isNewConv) {
          const realId = data.conversation.id;
          setSelectedDm(prev => prev ? { ...prev, id: realId } : prev);
          setDmConversations(prev => {
            const hasReal = prev.some(c => c.id === realId);
            if (hasReal) return prev;
            return prev.map(c =>
              c.other_user?.id === curDm.other_user?.id
                ? { ...c, id: realId, last_message: { content: data.content } }
                : c
            );
          });
        } else {
          // Update last message di sidebar
          setDmConversations(prev => prev.map(c =>
            c.other_user?.id === otherUserId
              ? { ...c, last_message: { content: data.content } }
              : c
          ));
        }

        // Tambah pesan ke chat — HANYA dari orang lain (sendiri sudah optimistic)
        if (data.sender_id !== myId) {
          // Dedup: cek apakah pesan dengan ID ini sudah ada
          setDmMessages(prev => {
            const exists = prev.some(m => m.id === data.id);
            if (exists) return prev;
            return [...prev, data as unknown as DmMessage];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      } else {
        // DM masuk tapi BUKAN conversation yang aktif → update sidebar
        setDmConversations(prev => {
          const exists = prev.some(c => c.other_user?.id === otherUserId);
          if (exists) {
            return prev.map(c =>
              c.other_user?.id === otherUserId
                ? { ...c,
                    last_message: { content: data.content },
                    // Hanya tambah unread jika user ini receiver
                    unread_count: data.receiver_id === myId ? (c.unread_count || 0) + 1 : c.unread_count,
                  }
                : c
            );
          } else {
            // Percakapan baru dari orang lain → refetch list
            fetchDmConversations();
            return prev;
          }
        });
        // Update badge total unread hanya jika kita receiver
        if (data.receiver_id === myId) setDmUnread(n => n + 1);
      }
    },

    onUnreadUpdate: ({ channel_id, count }) => {
      setUnreadCounts(prev => ({ ...prev, [channel_id]: count }));
    },
    onTypingStart: (data) => {
      if (data.thread_id && activeThread?.thread.id === data.thread_id) {
        setTypingThreadUsers(prev => prev.includes(data.full_name) ? prev : [...prev, data.full_name]);
        if (typingTimers.current[data.user_id]) clearTimeout(typingTimers.current[data.user_id]);
        typingTimers.current[data.user_id] = setTimeout(() => setTypingThreadUsers(prev => prev.filter(n => n !== data.full_name)), 3000);
      } else if (data.channel_id === selectedChannelRef.current?.id) {
        setTypingUsers(prev => prev.includes(data.full_name) ? prev : [...prev, data.full_name]);
        if (typingTimers.current[data.user_id]) clearTimeout(typingTimers.current[data.user_id]);
        typingTimers.current[data.user_id] = setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== data.full_name)), 3000);
      }
    },
    onTypingStop: (data) => {
      setTypingUsers(prev => prev.filter((_, i) => i !== -1 /* keep all, cleared by timer */));
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── API Calls ────────────────────────────────────────────────────────────
  const fetchServers = async () => {
    try {
      const res = await axiosInstance.get('/api/chat/servers');
      const joined = res.data.joined_servers || [];
      setServers(joined);
      if (joined.length > 0) selectServer(joined[0]);
    } catch (e: any) {
      if (e.response?.status !== 403) toast.error('Gagal memuat server');
    } finally { setLoading(false); }
  };

  const selectServer = async (server: Server) => {
    try {
      const res = await axiosInstance.get(`/api/chat/servers/${server.id}`);
      setSelectedServer(res.data.server);
      fetchOnlineMembers(server.id);
      const first = res.data.server.categories?.[0]?.channels?.[0] || res.data.server.uncategorized_channels?.[0];
      if (first) selectChannel(first);
    } catch { toast.error('Gagal memuat server'); }
  };

  const selectChannel = async (channel: Channel) => {
    if (selectedChannelRef.current?.id === channel.id) return; // sudah di channel ini
    if (selectedChannelRef.current?.id) leaveChannel(selectedChannelRef.current.id);

    // Isolasi room: clear semua state sebelumnya
    setMessages([]);
    setReplyTo(null);
    setEditingMessage(null);
    setActiveThread(null);
    setDmMode(false);
    setSelectedDm(null);
    setSelectedChannel(channel);

    try {
      const res = await axiosInstance.get(`/api/chat/channels/${channel.id}`);
      if (res.data.error) {
        toast.error(res.data.error);
        return;
      }
      setMessages(res.data.messages || []);
      axiosInstance.post(`/api/chat/channels/${channel.id}/read`).catch(() => {});
      setUnreadCounts(prev => ({ ...prev, [channel.id]: 0 }));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error('Akses ditolak — Anda tidak punya akses ke channel ini');
        setSelectedChannel(null);
      }
    }
    joinChannel(channel.id);
  };

  const fetchOnlineMembers = async (serverId: number) => {
    try {
      const res = await axiosInstance.get(`/api/chat/servers/${serverId}/online`);
      setOnlineMembers(res.data.online || []);
      setOfflineMembers(res.data.offline || []);
    } catch { }
  };

  const fetchDmConversations = async () => {
    try {
      const res = await axiosInstance.get('/api/chat/dm');
      setDmConversations(res.data.conversations || []);
      const total = res.data.conversations?.reduce((s: number, c: DmConversation) => s + (c.unread_count || 0), 0) || 0;
      setDmUnread(total);
    } catch { }
  };

  const selectDm = async (conv: DmConversation) => {
    // Jika sudah buka conv yang sama, jangan re-fetch
    if (selectedDm?.other_user?.id === conv.other_user?.id && dmMode) return;

    setSelectedDm(conv);
    setDmMode(true);
    setSelectedChannel(null);
    setActiveThread(null);
    setDmMessages([]);

    try {
      // Selalu fetch by other_user.id — berlaku untuk kedua sisi percakapan
      const res = await axiosInstance.get(`/api/chat/dm/${conv.other_user.id}`);
      const msgs = res.data.messages || [];
      setDmMessages(msgs);

      // Jika conv.id masih 0, update ke ID real dari server
      if (res.data.conversation?.id && (!conv.id || conv.id === 0)) {
        const realId = res.data.conversation.id;
        setSelectedDm(prev => prev ? { ...prev, id: realId } : prev);
        setDmConversations(prev => prev.map(c =>
          c.other_user?.id === conv.other_user?.id ? { ...c, id: realId } : c
        ));
      }

      // Mark as read
      axiosInstance.post(`/api/chat/dm/${conv.other_user.id}/read`).then(() => {
        setDmConversations(prev => prev.map(c =>
          c.other_user?.id === conv.other_user?.id ? { ...c, unread_count: 0 } : c
        ));
        setDmUnread(prev => Math.max(0, prev - (conv.unread_count || 0)));
      }).catch(() => {});

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast.error('Gagal memuat riwayat pesan');
    }
  };


  const openDmWithUser = async (userId: number) => {
    try {
      const res = await axiosInstance.get(`/api/chat/dm/${userId}`);
      const messages = res.data.messages || [];
      const other = res.data.other_user;
      const convId = res.data.conversation?.id || 0;

      // Buat conv object
      const conv: DmConversation = {
        id: convId,
        user1_id: Math.min(currentUserId, userId),
        user2_id: Math.max(currentUserId, userId),
        last_message_at: res.data.conversation?.last_message_at || '',
        unread_count: 0,
        other_user: other,
      };

      // Langsung masukkan ke sidebar jika belum ada
      setDmConversations(prev => {
        const exists = prev.some(c => c.other_user?.id === userId);
        if (!exists) return [conv, ...prev];
        // Update jika ID berubah dari 0 ke real
        return prev.map(c => c.other_user?.id === userId ? { ...c, id: convId } : c);
      });

      // Set state langsung tanpa memanggil selectDm (agar tidak reset messages)
      setSelectedDm(conv);
      setDmMode(true);
      setSelectedChannel(null);
      setActiveThread(null);
      setDmMessages(messages);
      setShowDmPicker(false);

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Gagal membuka DM'); }
  };

  useEffect(() => {
    fetchServers();
    fetchDmConversations();
  }, []);

  // Reset DM state saat user berubah — DM harus per-akun
  useEffect(() => {
    if (currentUserId) {
      setDmConversations([]);
      setSelectedDm(null);
      setDmMessages([]);
      setDmInput('');
      setDmUnread(0);
      setDmMode(false);
      fetchDmConversations();
    }
  }, [currentUserId]);

  // Polling fallback (5s) untuk members online
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedServerRef.current) fetchOnlineMembers(selectedServerRef.current.id);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Send Message ─────────────────────────────────────────────────────────
  const sendMsg = async () => {
    if (dmMode && selectedDm) {
      // DM mode — pakai dmInput terpisah
      const content = dmInput.trim();
      if (!content) return;

      // Optimistic update: langsung tampilkan pesan sendiri
      const optimisticMsg: DmMessage = {
        id: Date.now(), // temp ID
        conversation_id: selectedDm.id,
        sender_id: currentUserId,
        receiver_id: selectedDm.other_user.id,
        sender: {
          id: currentUserId,
          username: authUser?.username || '',
          full_name: authUser?.full_name || authUser?.username || '',
        },
        content,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setDmMessages(prev => [...prev, optimisticMsg]);
      setDmInput('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      // Kirim via WebSocket (atau REST sebagai fallback)
      try {
        wsSendDm(selectedDm.other_user.id, content);
      } catch {
        try {
          const res = await axiosInstance.post(`/api/chat/dm/${selectedDm.other_user.id}`, { content });
          // Replace optimistic dengan real message dari server
          setDmMessages(prev => prev.map(m => m.id === optimisticMsg.id ? res.data.message : m));
        } catch { toast.error('Gagal mengirim pesan'); }
      }
      return;
    }

    // Channel mode
    const content = messageInput.trim();
    if (!content || !selectedChannel) return;
    try {
      if (editingMessage) {
        wsEdit(editingMessage.id, content);
        setEditingMessage(null);
      } else {
        wsSend(selectedChannel.id, content, replyTo?.id);
        setReplyTo(null);
      }
      setMessageInput('');
      typingStop(selectedChannel.id);
    } catch { toast.error('Gagal mengirim pesan'); }
  };

  const sendThreadMsg = () => {
    const content = threadInput.trim();
    if (!content || !activeThread) return;
    wsSendThreadReply(activeThread.thread.id, content);
    setThreadInput('');
    typingStop(undefined, activeThread.thread.id);
  };

  const openThread = async (msg: SocketMessage) => {
    try {
      const res = await axiosInstance.post(`/api/chat/messages/${msg.id}/thread`);
      setActiveThread(res.data);
      joinThread(res.data.thread.id);
      setShowMembers(false);
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Gagal membuka thread'); }
  };

  const closeThread = () => {
    if (activeThread) leaveThread(activeThread.thread.id);
    setActiveThread(null);
    setShowMembers(true);
  };

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    if (selectedChannel && !dmMode) {
      typingStart(selectedChannel.id);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => typingStop(selectedChannel.id), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedChannel) return;
    const form = new FormData();
    form.append('file', selectedFile);
    form.append('channel_id', selectedChannel.id.toString());
    if (messageInput.trim()) form.append('caption', messageInput.trim());
    try {
      await axiosInstance.post('/api/chat/messages/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedFile(null); setMessageInput('');
      toast.success('File terkirim');
    } catch { toast.error('Gagal upload file'); }
  };

  const handleDmFileUpload = async (file: File) => {
    if (!selectedDm) return;
    const form = new FormData();
    form.append('file', file);
    if (dmInput.trim()) form.append('caption', dmInput.trim());

    // Optimistic: tampilkan preview sebelum upload selesai
    const isImg = file.type.startsWith('image/');
    const tempUrl = URL.createObjectURL(file);
    const optimisticMsg: DmMessage & { file_url?: string; file_name?: string } = {
      id: Date.now(),
      conversation_id: selectedDm.id,
      sender_id: currentUserId,
      receiver_id: selectedDm.other_user.id,
      sender: { id: currentUserId, username: authUser?.username || '', full_name: authUser?.full_name || '' },
      content: dmInput.trim() || file.name,
      message_type: isImg ? 'image' : 'file',
      is_read: false,
      created_at: new Date().toISOString(),
      file_url: tempUrl,
      file_name: file.name,
    };
    setDmMessages(prev => [...prev, optimisticMsg]);
    setDmInput('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await axiosInstance.post(
        `/api/chat/dm/${selectedDm.other_user.id}/upload`, form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      // Ganti optimistic dengan real
      setDmMessages(prev => prev.map(m => m.id === optimisticMsg.id
        ? { ...res.data.message, file_url: res.data.message.file_url } : m
      ));
      URL.revokeObjectURL(tempUrl);
    } catch {
      setDmMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      URL.revokeObjectURL(tempUrl);
      toast.error('Gagal upload file');
    }
  };

  const deleteDmMessage = async (msgId: number) => {
    try {
      await axiosInstance.delete(`/api/chat/dm/messages/${msgId}`);
      setDmMessages(prev => prev.filter(m => m.id !== msgId));
    } catch { toast.error('Gagal hapus pesan'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Disalin!'));
  };

  const fetchDmPickerUsers = async () => {
    try {
      if (selectedServer) {
        const res = await axiosInstance.get(`/api/chat/servers/${selectedServer.id}/online`);
        const all = [...(res.data.online || []), ...(res.data.offline || [])];
        setDmPickerUsers(all.filter((u: Member) => u.id !== currentUserId));
      }
    } catch { }
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return `Kemarin ${format(date, 'HH:mm')}`;
    return format(date, 'dd/MM HH:mm');
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    if (isToday(date)) return 'Hari Ini';
    if (isYesterday(date)) return 'Kemarin';
    return format(date, 'dd MMMM yyyy');
  };

  // Group messages by date
  const groupByDate = (msgs: SocketMessage[]) => {
    const groups: { date: string; messages: SocketMessage[] }[] = [];
    let cur = '';
    msgs.forEach(m => {
      const d = format(new Date(m.created_at), 'yyyy-MM-dd');
      if (d !== cur) { cur = d; groups.push({ date: m.created_at, messages: [m] }); }
      else groups[groups.length - 1].messages.push(m);
    });
    return groups;
  };

  // ─── Message Row ──────────────────────────────────────────────────────────
  const MessageRow: React.FC<{
    msg: SocketMessage; isThread?: boolean; prevMsg?: SocketMessage;
    onReply?: () => void; onThread?: () => void;
  }> = ({ msg, isThread = false, prevMsg, onReply, onThread }) => {
    const isMine = msg.user_id === currentUserId;
    const compact = prevMsg && prevMsg.user_id === msg.user_id &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

    return (
      <div
        className={`group relative flex items-start gap-3 px-4 py-0.5 hover:bg-white/5 rounded transition-colors ${compact ? 'mt-0' : 'mt-3'}`}
        onMouseEnter={() => setHoveredMessage(msg.id)}
        onMouseLeave={() => { setHoveredMessage(null); setShowEmojiPicker(null); }}
      >
        {/* Avatar or timestamp */}
        <div className="w-9 flex-shrink-0 flex justify-center mt-0.5">
          {compact ? (
            <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 mt-1 select-none">{formatTime(msg.created_at)}</span>
          ) : (
            <Avatar name={msg.user?.full_name || msg.user?.username || '?'} size={36} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!compact && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-semibold text-sm text-white hover:underline cursor-pointer">{msg.user?.full_name || msg.user?.username}</span>
              <span className="text-[11px] text-gray-400">{formatTime(msg.created_at)}</span>
              {msg.is_edited && <span className="text-[10px] text-gray-500">(diedit)</span>}
            </div>
          )}

          {/* Reply quote */}
          {msg.reply_to && (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 pl-2 border-l-2 border-gray-500">
              <span className="truncate max-w-xs">{msg.reply_to.user?.full_name}: {msg.reply_to.content}</span>
            </div>
          )}

          {/* Message text */}
          {!msg.is_deleted ? (
            <p className="text-sm text-gray-100 whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          ) : (
            <p className="text-xs text-gray-500 italic">Pesan dihapus</p>
          )}

          {/* Attachments */}
          {msg.attachments?.map(att => (
            <div key={att.id} className="mt-1">
              {att.content_type?.startsWith('image/') ? (
                <img src={`/uploads/chat/${att.file_path?.split('/').pop()}`} alt={att.filename} className="max-w-xs max-h-48 rounded-lg object-cover cursor-pointer" />
              ) : (
                <a href={`/uploads/chat/${att.file_path?.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">📎 {att.filename}</a>
              )}
            </div>
          ))}

          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {msg.reactions.map(r => (
                <button key={r.emoji} onClick={() => wsReact(msg.id, r.emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${r.users.includes(currentUserId) ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'}`}>
                  <span>{r.emoji}</span><span>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thread reply count */}
          {msg.is_thread_starter && msg.thread_reply_count !== undefined && msg.thread_reply_count > 0 && (
            <button onClick={() => onThread?.()}
              className="flex items-center gap-1.5 mt-1 text-xs text-blue-400 hover:text-blue-300 hover:underline">
              <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
              {msg.thread_reply_count} balasan
            </button>
          )}
        </div>

        {/* Hover actions */}
        {hoveredMessage === msg.id && !msg.is_deleted && (
          <div className="absolute right-4 top-0 -translate-y-1 flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
            {/* Emoji quick pick */}
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-white/10 rounded" title="Reaksi">
                <FaceSmileIcon className="h-4 w-4" />
              </button>
              {showEmojiPicker === msg.id && (
                <div className="absolute bottom-8 right-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-wrap gap-1 w-48 z-20">
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => { wsReact(msg.id, e); setShowEmojiPicker(null); }}
                      className="text-lg hover:scale-125 transition-transform">{e}</button>
                  ))}
                </div>
              )}
            </div>
            {/* Reply */}
            <button onClick={onReply} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded" title="Balas">
              <ArrowUturnLeftIcon className="h-4 w-4" />
            </button>
            {/* Thread */}
            {!isThread && (
              <button onClick={onThread} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded" title="Buka Thread">
                <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4" />
              </button>
            )}
            {/* Edit (own only) */}
            {isMine && (
              <button onClick={() => { setEditingMessage(msg); setMessageInput(msg.content); inputRef.current?.focus(); }}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded" title="Edit">
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {/* Delete */}
            {(isMine || selectedServer?.owner_id === currentUserId) && (
              <button onClick={() => wsDelete(msg.id)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded" title="Hapus">
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // (TypingBar & InputBox now defined outside GroupChat — see top of file)

  if (loading) return (
    <div className="fixed inset-0 top-16 flex items-center justify-center bg-[#313338]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5865f2]" />
    </div>
  );

  if (servers.length === 0 && !loading) return (
    <div className="fixed inset-0 top-16 flex items-center justify-center bg-[#313338] text-gray-100">
      <div className="text-center">
        <UserGroupIcon className="h-16 w-16 mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-400">Akses Chat Tidak Tersedia</h2>
        <p className="text-gray-500 mt-2">Role Anda tidak memiliki akses ke fitur Group Chat</p>
      </div>
    </div>
  );

  const allChannels = [
    ...(selectedServer?.categories?.flatMap(c => c.channels) || []),
    ...(selectedServer?.uncategorized_channels || [])
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 top-16 flex bg-[#313338] text-gray-100 overflow-hidden font-sans" style={{ fontFamily: "'gg sans','Noto Sans',Arial,sans-serif" }}>

      {/* ═══ LEFT: Channel Sidebar ═══ */}
      <div className="w-60 bg-[#2b2d31] flex flex-col flex-shrink-0">
        {/* Server header */}
        {selectedServer && (
          <div className="h-12 px-4 flex items-center justify-between border-b border-black/30 shadow-sm cursor-pointer hover:bg-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">{selectedServer.icon || '🏢'}</span>
              <h2 className="font-bold text-sm text-white truncate">{selectedServer.name}</h2>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
        )}

        {/* Scrollable channel list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {/* Add channel */}
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>Channels</span>
            <button onClick={() => toast('Buka Server Settings untuk tambah channel')} className="hover:text-white">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Categories */}
          {selectedServer?.categories?.map(cat => (
            <div key={cat.id}>
              <button onClick={() => setCollapsedCategories(p => p.includes(cat.id) ? p.filter(i => i !== cat.id) : [...p, cat.id])}
                className="flex items-center gap-1 w-full px-2 py-0.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300">
                {collapsedCategories.includes(cat.id) ? <ChevronRightIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                {cat.name}
              </button>
              {!collapsedCategories.includes(cat.id) && cat.channels.map(ch => (
                <ChannelItem key={ch.id} channel={ch} isSelected={selectedChannel?.id === ch.id && !dmMode} unread={unreadCounts[ch.id] || 0} onClick={() => selectChannel(ch)} />
              ))}
            </div>
          ))}

          {/* Uncategorized */}
          {selectedServer?.uncategorized_channels?.map(ch => (
            <ChannelItem key={ch.id} channel={ch} isSelected={selectedChannel?.id === ch.id && !dmMode} unread={unreadCounts[ch.id] || 0} onClick={() => selectChannel(ch)} />
          ))}

          {/* DMs section */}
          <div className="mt-3">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <span>Pesan Langsung {dmUnread > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{dmUnread}</span>}</span>
              <button onClick={() => { setShowDmPicker(true); fetchDmPickerUsers(); }} className="hover:text-white" title="Buka DM Baru">
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            {dmConversations.map(conv => (
              <button key={`dm-${conv.other_user?.id || conv.id}`} onClick={() => selectDm(conv)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedDm?.other_user?.id === conv.other_user?.id && dmMode
                    ? 'bg-white/20 text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}>
                <Avatar name={conv.other_user?.full_name || '?'} size={28} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium truncate text-white">{conv.other_user?.full_name}</p>
                  {conv.last_message && (
                    <p className="text-[11px] text-gray-500 truncate">{conv.last_message.content}</p>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">{conv.unread_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* DM user picker modal */}
        {showDmPicker && (
          <div className="absolute inset-0 top-16 z-50 flex items-start justify-center pt-20 bg-black/60" onClick={() => setShowDmPicker(false)}>
            <div className="bg-[#2b2d31] rounded-xl shadow-2xl w-80 p-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Pesan Langsung Baru</h3>
                <button onClick={() => setShowDmPicker(false)}><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {dmPickerUsers.map(u => (
                  <button key={u.id} onClick={() => openDmWithUser(u.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-sm text-gray-300">
                    <Avatar name={u.full_name || u.username} size={28} status={u.status} />
                    <span>{u.full_name || u.username}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ CENTER: Message Area ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="h-12 px-4 flex items-center gap-3 border-b border-black/30 shadow-sm bg-[#313338] flex-shrink-0">
          {dmMode && selectedDm ? (
            <>
              <Avatar name={selectedDm.other_user?.full_name || '?'} size={24} />
              <span className="font-bold text-white text-sm">{selectedDm.other_user?.full_name}</span>
              <span className="text-gray-400 text-xs">Pesan Langsung</span>
            </>
          ) : selectedChannel ? (
            <>
              {selectedChannel.is_private ? <LockClosedIcon className="h-4 w-4 text-gray-400" /> : <HashtagIcon className="h-5 w-5 text-gray-400" />}
              <span className="font-bold text-white text-sm">{selectedChannel.name}</span>
              {selectedChannel.topic && <span className="text-gray-400 text-xs border-l border-gray-600 pl-3 truncate">{selectedChannel.topic}</span>}
            </>
          ) : <span className="text-gray-400 text-sm">Pilih channel</span>}

          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setShowSearch(s => !s)} className="text-gray-400 hover:text-white" title="Cari">
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
            {!dmMode && (
              <button onClick={() => setShowMembers(s => !s)} className="text-gray-400 hover:text-white" title="Member">
                <UserGroupIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2 bg-[#2b2d31] border-b border-black/30 flex items-center gap-2">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari pesan..." className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none" />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}><XMarkIcon className="h-4 w-4 text-gray-400 hover:text-white" /></button>
          </div>
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto py-4 relative"
          onScroll={e => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
            setShowScrollDown(!atBottom);
          }}
        >
          {dmMode && selectedDm ? (
            // DM Messages
            <div>
              <div className="px-8 pb-6 text-center">
                <Avatar name={selectedDm.other_user?.full_name || '?'} size={72} />
                <h2 className="text-2xl font-bold text-white mt-3">{selectedDm.other_user?.full_name}</h2>
                <p className="text-gray-400 text-sm mt-1">Mulai percakapan dengan <strong className="text-white">{selectedDm.other_user?.full_name}</strong></p>
              </div>
              {dmMessages.map((msg: any, i) => {
                const isMine = msg.sender_id === currentUserId;
                const isImg = msg.message_type === 'image';
                const isFile = msg.message_type === 'file';
                const showAvatar = !isMine && (i === 0 || dmMessages[i - 1]?.sender_id !== msg.sender_id);
                const showTime = i === dmMessages.length - 1 || dmMessages[i + 1]?.sender_id !== msg.sender_id;

                return (
                  <div key={msg.id}
                    className={`flex items-end gap-2 px-4 py-0.5 group ${ isMine ? 'flex-row-reverse' : ''}`}
                    onMouseEnter={() => setHoveredDmMsg(msg.id)}
                    onMouseLeave={() => setHoveredDmMsg(null)}
                  >
                    {/* Avatar */}
                    <div className="w-7 flex-shrink-0">
                      {!isMine && showAvatar ? <Avatar name={msg.sender?.full_name || '?'} size={28} /> : <div className="w-7" />}
                    </div>

                    {/* Bubble */}
                    <div className={`relative max-w-xs lg:max-w-sm xl:max-w-md flex flex-col ${ isMine ? 'items-end' : 'items-start'}`}>
                      {showAvatar && !isMine && (
                        <span className="text-[11px] text-gray-400 font-semibold mb-0.5 px-1">{msg.sender?.full_name}</span>
                      )}

                      {/* Image */}
                      {isImg && msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.file_url} alt={msg.file_name || 'image'}
                            className="rounded-xl object-cover max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ maxWidth: 280, maxHeight: 220 }}
                          />
                        </a>
                      )}

                      {/* File */}
                      {isFile && msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm cursor-pointer hover:opacity-90 transition-opacity ${ isMine ? 'bg-[#5865f2] text-white rounded-br-sm' : 'bg-[#383a40] text-gray-100 rounded-bl-sm'}`}>
                          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <PhotoIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px]">{msg.file_name || msg.content}</p>
                            <p className="text-xs opacity-70">Klik untuk unduh</p>
                          </div>
                        </a>
                      )}

                      {/* Text content (show if not purely a file) */}
                      {(!isImg && !isFile) || (isImg && msg.content && msg.content !== msg.file_name) ? (
                        <div className={`px-3 py-2 rounded-2xl text-sm ${ isMine ? 'bg-[#5865f2] text-white rounded-br-sm' : 'bg-[#383a40] text-gray-100 rounded-bl-sm'} ${ isImg ? 'mt-1' : ''}`}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      ) : null}

                      {/* Timestamp */}
                      {showTime && (
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${ isMine ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                          {isMine && (
                            <span className={`text-[10px] ${ msg.is_read ? 'text-blue-400' : 'text-gray-500'}`}>
                              {msg.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    {hoveredDmMsg === msg.id && (
                      <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${ isMine ? 'mr-1' : 'ml-1'}`}>
                        <button onClick={() => copyToClipboard(msg.content)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded" title="Salin">
                          <ClipboardIcon className="h-3.5 w-3.5" />
                        </button>
                        {isMine && (
                          <button onClick={() => deleteDmMessage(msg.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded" title="Hapus">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            // Channel Messages
            <div>
              {groupByDate(messages.filter(m => !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase()))).map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-xs text-gray-400 font-semibold">{formatDate(group.date)}</span>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                  {group.messages.map((msg, i) => (
                    <MessageRow key={msg.id} msg={msg} prevMsg={i > 0 ? group.messages[i - 1] : undefined}
                      onReply={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                      onThread={() => openThread(msg)} />
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Scroll to bottom button */}
          {showScrollDown && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-4 right-4 bg-[#5865f2] hover:bg-[#4752c4] text-white p-2 rounded-full shadow-lg transition-all z-10"
              title="Ke pesan terbaru">
              <ChevronDoubleDownIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Typing indicator */}
        <TypingBar users={typingUsers} />

        {/* Input */}
        <div className="relative">
          <ChatInputBox
            value={dmMode ? dmInput : messageInput}
            onChange={dmMode ? setDmInput : handleInputChange}
            placeholder={dmMode ? `Pesan @${selectedDm?.other_user?.full_name}` : selectedChannel ? `Pesan #${selectedChannel.name}` : 'Pilih channel...'}
            onSend={sendMsg}
            inputRef={dmMode ? undefined : inputRef}
            fileInputRef={dmMode ? dmFileInputRef : fileInputRef}
            onFileClick={() => dmMode ? dmFileInputRef.current?.click() : fileInputRef.current?.click()}
            replyTo={!dmMode ? replyTo : null}
            editingMessage={!dmMode ? editingMessage : null}
            onCancelReply={() => { setReplyTo(null); setEditingMessage(null); setMessageInput(''); }}
            showEmojiPicker={dmMode ? showDmEmojiPicker : showEmojiPicker === -99}
            onToggleEmoji={() => dmMode ? setShowDmEmojiPicker(v => !v) : setShowEmojiPicker(v => v === -99 ? null : -99)}
            onEmojiSelect={e => { if (dmMode) { setDmInput(v => v + e); setShowDmEmojiPicker(false); } else { setMessageInput(v => v + e); setShowEmojiPicker(null); } }}
          />
          {/* DM file input handler */}
          <input ref={dmFileInputRef} type="file" className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleDmFileUpload(f); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* ═══ RIGHT: Thread Panel or Members ═══ */}
      {activeThread ? (
        /* Thread Panel */
        <div className="w-80 bg-[#2b2d31] flex flex-col border-l border-black/30 flex-shrink-0">
          <div className="h-12 px-4 flex items-center justify-between border-b border-black/30">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
              <span className="font-bold text-sm text-white">Thread</span>
            </div>
            <button onClick={closeThread} className="text-gray-400 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Starter message */}
            <div className="mb-3 pb-3 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Avatar name={activeThread.starter_message?.user?.full_name || '?'} size={28} />
                <span className="font-semibold text-sm text-white">{activeThread.starter_message?.user?.full_name}</span>
                <span className="text-[11px] text-gray-400">{activeThread.starter_message ? formatTime(activeThread.starter_message.created_at) : ''}</span>
              </div>
              <p className="text-sm text-gray-200 pl-9 whitespace-pre-wrap">{activeThread.starter_message?.content}</p>
            </div>

            {/* Thread replies */}
            <div className="text-[11px] text-gray-400 font-semibold mb-2">
              {activeThread.thread.reply_count} Balasan
            </div>
            {activeThread.replies.map((reply, i) => (
              <MessageRow key={reply.id} msg={reply} isThread prevMsg={i > 0 ? activeThread.replies[i - 1] : undefined} />
            ))}
            <div ref={threadEndRef} />
          </div>

          <TypingBar users={typingThreadUsers} />
          <ChatInputBox
            value={threadInput}
            onChange={v => { setThreadInput(v); if (activeThread) typingStart(undefined, activeThread.thread.id); }}
            placeholder="Balas di thread..."
            onSend={sendThreadMsg}
            showEmojiPicker={showThreadEmojiPicker}
            onToggleEmoji={() => setShowThreadEmojiPicker(v => !v)}
            onEmojiSelect={e => { setThreadInput(v => v + e); setShowThreadEmojiPicker(false); }}
          />
        </div>
      ) : showMembers && !dmMode ? (
        /* Members Panel */
        <div className="w-56 bg-[#2b2d31] flex flex-col border-l border-black/30 flex-shrink-0">
          <div className="h-12 px-4 flex items-center border-b border-black/30">
            <span className="font-bold text-sm text-white">Anggota — {(onlineMembers.length + offlineMembers.length)}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-2">
            {onlineMembers.length > 0 && (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Online — {onlineMembers.length}</p>
                {onlineMembers.map(m => (
                  <button key={m.id} onClick={() => { fetchDmPickerUsers(); openDmWithUser(m.id); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors group">
                    <Avatar name={m.full_name || m.username} size={30} status={m.status || 'online'} />
                    <div className="text-left min-w-0">
                      <p className="text-sm text-gray-200 truncate group-hover:text-white">{m.full_name || m.username}</p>
                      {m.custom_status && <p className="text-[10px] text-gray-500 truncate">{m.custom_status}</p>}
                    </div>
                  </button>
                ))}
              </>
            )}
            {offlineMembers.length > 0 && (
              <>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mt-3 mb-1">Offline — {offlineMembers.length}</p>
                {offlineMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded">
                    <Avatar name={m.full_name || m.username} size={30} status="offline" />
                    <p className="text-sm text-gray-500 truncate">{m.full_name || m.username}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ─── Channel Item ─────────────────────────────────────────────────────────────
const ChannelItem: React.FC<{ channel: Channel; isSelected: boolean; unread: number; onClick: () => void }> = ({ channel, isSelected, unread, onClick }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors group ${isSelected ? 'bg-white/20 text-white' : unread > 0 ? 'text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}>
    {channel.is_private ? <LockClosedIcon className="h-3.5 w-3.5 flex-shrink-0" /> : channel.channel_type === 'voice' ? <SpeakerWaveIcon className="h-3.5 w-3.5 flex-shrink-0" /> : <HashtagIcon className="h-3.5 w-3.5 flex-shrink-0" />}
    <span className={`flex-1 text-left truncate text-[13px] ${unread > 0 ? 'font-semibold' : 'font-normal'}`}>{channel.name}</span>
    {unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-auto">{unread > 99 ? '99+' : unread}</span>}
  </button>
);

export default GroupChat;
