import axios from 'axios';

const getApiBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
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

export default api;
