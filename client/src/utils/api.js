import axios from 'axios';
import toast from 'react-hot-toast';

const getApiBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '5173' || window.location.port === '5174') {
      return `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }
    return '/api';
  }

  return 'http://localhost:5000/api';
};

export const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = getApiBaseURL().replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const api = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mutatingMethods = new Set(['post', 'put', 'patch', 'delete']);
const dashboardRefreshPaths = [
  '/accounts',
  '/trades',
  '/screenshots',
  '/emotions',
  '/rules',
  '/users/trading-goals',
  '/weekly-reviews',
  '/mentors',
];

let realtimeChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    realtimeChannel = new BroadcastChannel('jahzjournal:realtime-sync');
  } catch (e) {
    realtimeChannel = null;
  }
}

export const subscribeToRealtimeSync = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleEvent = () => callback();
  const handleStorage = (e) => {
    if (e.key === 'jahzjournal:data-version') callback();
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') callback();
  };

  window.addEventListener('jahzjournal:data-changed', handleEvent);
  window.addEventListener('storage', handleStorage);
  window.addEventListener('focus', handleEvent);
  document.addEventListener('visibilitychange', handleVisibility);

  let channelListener = null;
  if (realtimeChannel) {
    channelListener = () => callback();
    realtimeChannel.addEventListener('message', channelListener);
  }

  return () => {
    window.removeEventListener('jahzjournal:data-changed', handleEvent);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('focus', handleEvent);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (realtimeChannel && channelListener) {
      realtimeChannel.removeEventListener('message', channelListener);
    }
  };
};

const shouldNotifyDashboard = (config = {}) => {
  const method = String(config.method || '').toLowerCase();
  const url = String(config.url || '');

  return mutatingMethods.has(method) && dashboardRefreshPaths.some((path) => url.startsWith(path));
};

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined' && shouldNotifyDashboard(response.config)) {
      const timestamp = String(Date.now());
      const url = String(response.config?.url || '');
      window.localStorage.setItem('jahzjournal:data-version', timestamp);
      window.dispatchEvent(new CustomEvent('jahzjournal:data-changed', {
        detail: { version: timestamp, url },
      }));
      if (realtimeChannel) {
        try {
          realtimeChannel.postMessage({ version: timestamp, url });
        } catch (e) {
          // ignore
        }
      }
    }

    return response;
  },
  (error) => {
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.error === 'PLAN_LIMIT_REACHED' && data.message) {
        toast.error(data.message, { id: `limit-${data.feature}`, duration: 5000 });
      }
    }
    return Promise.reject(error);
  }
);

export default api;
