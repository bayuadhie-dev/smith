import axios from 'axios';

// Custom event for session expiry - same as in store/api.ts
export const SESSION_EXPIRED_EVENT = 'session-expired';

// Auto-detect the correct API base URL
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (envBaseUrl && envBaseUrl !== 'auto') {
    return envBaseUrl;
  }

  // Auto-detect based on current hostname
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  } else if (hostname === 'erp.graterp.my.id') {
    // Public domain access via Cloudflare Tunnel: frontend and backend are
    // separate tunneled subdomains, not same-host-different-port. Port 5000
    // is not exposed on erp.graterp.my.id, so this must go to the backend's
    // own tunneled domain instead.
    return 'https://api.graterp.my.id/api';
  } else {
    // LAN access: same IP as frontend but port 5000 for backend
    return `http://${hostname}:5000/api`;
  }
};

// Create axios instance with default configuration
const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Dispatch session expired event so SessionTimeoutModal can handle it
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
