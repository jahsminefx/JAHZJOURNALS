// Service Worker for JahzJournal Web Push Notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'JAHZJOURNALS';
        const options = {
            body: data.message || data.body || 'You have a new trading update.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/dashboard',
                timestamp: data.timestamp || new Date().toISOString()
            }
        };

        event.waitUntil(self.registration.showNotification(title, options));
    } catch (err) {
        console.error('Error handling push event:', err);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
