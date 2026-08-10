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
];

const shouldNotifyDashboard = (config = {}) => {
  const method = String(config.method || '').toLowerCase();
  const url = String(config.url || '');

  return mutatingMethods.has(method) && dashboardRefreshPaths.some((path) => url.startsWith(path));
};

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined' && shouldNotifyDashboard(response.config)) {
      const timestamp = String(Date.now());
      window.localStorage.setItem('jahzjournal:data-version', timestamp);
      window.dispatchEvent(new CustomEvent('jahzjournal:data-changed', {
        detail: { version: timestamp },
      }));
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
