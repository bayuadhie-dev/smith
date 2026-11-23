/**
 * SATU-SATUNYA tempat alamat server API ditentukan.
 *
 * Jangan menyalin logika ini ke berkas lain. Sampai 2026-11-22 ada 14 berkas
 * yang masing-masing menghitung sendiri, dan sebagian hanya tahu domain
 * graterp. Di mode dev hal itu tertutupi karena VITE_API_URL di
 * .env.development menimpa semuanya; begitu dijalankan dari hasil build
 * (.env.production, tanpa VITE_API_URL) panggilan jatuh ke
 * http://<host>:5000 dan aplikasi mati di layar "Verifying session".
 */

/**
 * Get the base URL for API calls
 * - Production (erp.graterp.my.id): https://api.graterp.my.id
 * - Development/LAN: http://{hostname}:5000
 */
export const getBaseURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api$/, '');
  }

  const hostname = window.location.hostname;
  
  // Falmaco
  if (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id')) {
    return 'https://api.graterp.my.id';
  }

  // Fengsheng
  if (hostname === 'erp.fsnindonesia.com' || hostname.endsWith('.fsnindonesia.com')) {
    return 'https://api.fsnindonesia.com';
  }

  // Lokal / jaringan kantor - host yang sama, port 5000
  return `http://${hostname}:5000`;
};

/**
 * Get the full API URL with path
 * @param path - API path (e.g., '/api/users')
 * @returns Full URL (e.g., 'https://api.graterp.my.id/api/users')
 */
export const getApiURL = (path: string): string => {
  const baseURL = getBaseURL();
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseURL}${cleanPath}`;
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => {
  const hostname = window.location.hostname;
  return hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id');
};

/**
 * Check if running in development
 */
export const isDevelopment = (): boolean => {
  return !isProduction();
};
