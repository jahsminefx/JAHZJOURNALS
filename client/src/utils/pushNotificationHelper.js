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

function areUint8ArraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
 * Validates that existing subscription matches the backend's current VAPID key.
 * If key mismatch is detected or forceResubscribe is true, re-subscribes with current key.
 */
export async function syncPushSubscription(forceResubscribe = false) {
  if (!isPushNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Fetch the backend's current permanent VAPID public key
    const res = await api.get('/push-notifications/public-key');
    const { publicKey } = res.data;
    if (!publicKey) return null;

    const convertedKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    // Verify key match
    if (subscription) {
      let isMismatch = forceResubscribe;
      if (!isMismatch && subscription.options?.applicationServerKey) {
        const currentKeyBuffer = new Uint8Array(subscription.options.applicationServerKey);
        if (!areUint8ArraysEqual(currentKeyBuffer, convertedKey)) {
          isMismatch = true;
        }
      }

      if (isMismatch) {
        console.warn('VAPID key mismatch detected. Re-subscribing browser with active key...');
        await api.post('/push-notifications/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
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
    console.warn('Push subscription sync notice:', err?.message || err);
    return null;
  }
}

/**
 * Prompts user for browser notification permission, registers service worker,
 * and ensures device is subscribed with the active permanent VAPID key.
 */
export async function enablePushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error('Web Push Notifications are not supported by your browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Push notification permission was denied. Please allow notifications in your browser settings.');
  }

  // Force clean subscription with the active permanent key
  const subscription = await syncPushSubscription(true);
  if (!subscription) {
    throw new Error('Failed to subscribe device with browser push manager.');
  }

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
        await subscription.unsubscribe().catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error disabling push notifications:', err);
  }
}

export async function sendTestPushNotification() {
  // Sync first to ensure device is registered with active key
  await syncPushSubscription();
  const res = await api.post('/push-notifications/send-test');
  return res.data;
}
