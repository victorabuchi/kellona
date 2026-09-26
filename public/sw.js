// Service worker: shows booking reminders and invitations, opens the app on tap.
self.addEventListener('push', (event) => {
  let data = { title: 'Kellona', body: '', url: '/book' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // plain text payload
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url } }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/book';
  event.waitUntil(self.clients.openWindow(url));
});
