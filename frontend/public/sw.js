self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || '다나아 AI';
  const options = {
    body: payload.body || '오늘 비어 있는 건강 기록을 확인해 볼까요?',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: payload.url || '/app/chat',
      apiBase: payload.api_base || '',
      token: payload.token || '',
    },
    actions: [
      { action: 'open', title: '기록하러 가기' },
      { action: 'mute_today', title: '오늘은 쉬기' },
      { action: 'disable', title: '다음부터 끄기' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action || 'open';
  const data = event.notification.data || {};
  event.notification.close();

  if ((action === 'mute_today' || action === 'disable') && data.token) {
    const apiBase = data.apiBase || '';
    event.waitUntil(
      fetch(`${apiBase}/api/v1/push/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token, action }),
      }).catch(() => undefined),
    );
    return;
  }

  const targetUrl = new URL(data.url || '/app/chat', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin || !('focus' in client)) {
            continue;
          }

          if ('navigate' in client) {
            const navigatedClient = await client.navigate(targetUrl);
            if (navigatedClient && 'focus' in navigatedClient) {
              return navigatedClient.focus();
            }
          }
          return client.focus();
        } catch {
          // Try the next window or open a new one below.
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
