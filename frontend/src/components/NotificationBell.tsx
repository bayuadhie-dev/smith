import React, { useState, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import axiosInstance from '../utils/axiosConfig';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: number;
  notification_type: string;
  category: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    subscribeToPush();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const subscribeToPush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Get VAPID public key from backend
      const vapidRes = await axiosInstance.get('/api/notifications/vapid-public-key');
      const vapidKey = vapidRes.data.public_key;
      if (!vapidKey) return;

      // Convert VAPID key
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to backend
      await axiosInstance.post('/api/notifications/push/subscribe', subscription.toJSON());
      console.log('[Push] Subscribed successfully');
    } catch (err) {
      console.log('[Push] Subscription failed:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axiosInstance.get('/api/notifications', {
        params: { per_page: 10 }
      });
      
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await axiosInstance.put(`/api/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate to action URL if exists
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  const markAllRead = async () => {
    try {
      await axiosInstance.put('/api/notifications/mark-all-read');
      setNotifications((ns) => ns.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const TYPE_STYLE: Record<string, { bar: string; dot: string }> = {
    success: { bar: 'border-l-emerald-600', dot: 'bg-emerald-600' },
    warning: { bar: 'border-l-amber-500', dot: 'bg-amber-500' },
    error: { bar: 'border-l-red-600', dot: 'bg-red-600' },
    info: { bar: 'border-l-sky-600', dot: 'bg-sky-600' },
  };
  const typeStyle = (t: string) => TYPE_STYLE[t] || { bar: 'border-l-gray-300', dot: 'bg-gray-400' };

  const CATEGORY_LABEL: Record<string, string> = {
    purchasing: 'Pembelian', finance: 'Keuangan', sales: 'Penjualan', production: 'Produksi', inventory: 'Gudang',
    quality: 'Kualitas', maintenance: 'Maintenance', hr: 'HR', system: 'Sistem',
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
    if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 rounded-lg transition-colors"
        aria-label="Notifikasi"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-[1.1rem] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-[26rem] max-w-[92vw] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notifikasi</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}</p>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                  <CheckIcon className="h-4 w-4" /> Tandai semua dibaca
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                  <BellIcon className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">Belum ada notifikasi</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map((n) => {
                    const st = typeStyle(n.notification_type);
                    return (
                      <li
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`cursor-pointer border-l-4 ${st.bar} px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!n.is_read ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm text-gray-900 dark:text-white ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                          {!n.is_read && <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${st.dot}`} />}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formatTimeAgo(n.created_at)} · {CATEGORY_LABEL[n.category] || n.category}
                          {(n.priority === 'high' || n.priority === 'urgent') && <span className="ml-2 font-medium text-red-600 dark:text-red-400">{n.priority === 'urgent' ? 'Mendesak' : 'Penting'}</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                onClick={() => { navigate('/app/notifications'); setIsOpen(false); }}
                className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Lihat semua notifikasi
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
