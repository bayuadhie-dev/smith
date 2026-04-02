/* Service Worker for Web Push Notifications */

self.addEventListener('push', function(event) {
  let data = { title: 'ERP Notification', body: '', url: '/app/notifications', icon: '/logo192.png' };

  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    data.body = event.data ? event.data.text() : '';
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: '/logo192.png',
    data: { url: data.url || '/app/notifications' },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'erp-notification-' + Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/app/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
