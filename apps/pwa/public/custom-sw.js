// WastePL Custom Service Worker event handlers for Web Push

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'WastePL: Powiadomienie o wywozie';
    const options = {
      body: payload.body || 'Zbliża się termin wywozu odpadów.',
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/favicon.svg',
      tag: 'wastepl-collection-reminder',
      data: payload.data || { url: '/' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('WastePL: Wywóz odpadów', {
        body: text,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
