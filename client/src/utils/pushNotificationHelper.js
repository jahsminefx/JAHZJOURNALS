import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushPermissionState() {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', or 'default'
}

export async function getDeviceSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error('Error getting browser push subscription:', err);
    return null;
  }
}

export async function getPushBackendStatus() {
  try {
    const res = await api.get('/push-notifications/status');
    return res.data; // { subscribed: boolean, deviceCount: number, devices: [] }
  } catch (err) {
    return { subscribed: false, deviceCount: 0, devices: [] };
  }
}

/**
 * Silently syncs push subscription if the user already granted browser permission.
 * Ensures the device is linked to the logged-in user in PostgreSQL PushSubscription table.
 */
export async function syncPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Permission is granted, but browser PushManager has not subscribed yet
      const res = await api.get('/push-notifications/public-key');
      const { publicKey } = res.data;
      if (!publicKey) return null;

      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (subscription) {
      // Post subscription to backend API to upsert in database
      await api.post('/push-notifications/subscribe', subscription.toJSON());
    }

    return subscription;
  } catch (err) {
    console.warn('Silent push subscription sync error:', err?.message || err);
    return null;
  }
}

/**
 * Prompts user for browser notification permission, registers service worker,
 * subscribes to PushManager, and records endpoint in the backend.
 */
export async function enablePushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error('Web Push Notifications are not supported by your browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Push notification permission was denied. Please allow notifications in your browser settings.');
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Fetch VAPID public key from backend
  const res = await api.get('/push-notifications/public-key');
  const { publicKey } = res.data;

  if (!publicKey) {
    throw new Error('VAPID public key unavailable.');
  }

  const convertedKey = urlBase64ToUint8Array(publicKey);

  // Subscribe browser PushManager
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey
  });

  // Post subscription to backend API
  await api.post('/push-notifications/subscribe', subscription.toJSON());

  return subscription;
}

export async function disablePushNotifications() {
  if (!isPushNotificationSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.post('/push-notifications/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.error('Error disabling push notifications:', err);
  }
}

export async function sendTestPushNotification() {
  const res = await api.post('/push-notifications/send-test');
  return res.data;
}
