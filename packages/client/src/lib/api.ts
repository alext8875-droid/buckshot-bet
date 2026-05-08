import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bb_token');
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default api;
