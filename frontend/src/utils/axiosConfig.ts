import { renewIfNeeded } from './sessionToken';
import axios from 'axios';
import { startRequest, finishRequest } from './netActivity';

// Custom event for session expiry - same as in store/api.ts
export const SESSION_EXPIRED_EVENT = 'session-expired';

// Get the current host for LAN access - always use the same hostname as frontend
const getBaseURL = () => {
  // Explicit override (staging/dev instances) takes priority - same env var
  // store/api.ts checks, so both API clients always agree on where to call.
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api$/, '');
  }

  const hostname = window.location.hostname;

  // Production domain - use HTTPS API subdomain
  if (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id')) {
    return 'https://api.graterp.my.id';
  }

  // Fengsheng. Dulu alamat ini hanya ada di VITE_API_URL milik
  // .env.development, jadi begitu server dijalankan dari hasil build
  // (.env.production) seluruh panggilan jatuh ke fallback localhost:5000 dan
  // aplikasi mati. Ditaruh di kode supaya tidak bisa terlupa saat menyiapkan
  // server baru.
  if (hostname === 'erp.fsnindonesia.com' || hostname.endsWith('.fsnindonesia.com')) {
    return 'https://api.fsnindonesia.com';
  }

  // Local development - use same hostname with port 5000
  return `http://${hostname}:5000`;
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    // The top progress bar reads this counter (utils/netActivity).
    startRequest();
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Renew the token in the background while the user is active (shared with the other HTTP clients)
      void renewIfNeeded();
    }
    return config;
  },
  (error) => {
    finishRequest();
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => {
    finishRequest();
    return response;
  },
  (error) => {
    finishRequest();
    if (error.response?.status === 401) {
      // Dispatch session expired event so SessionTimeoutModal can handle it
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

// Public axios instance (no auth, no session handling)
export const publicApi = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance;
