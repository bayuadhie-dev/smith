/**
 * API Configuration Helper
 * Provides consistent base URL across the application
 */

/**
 * Get the base URL for API calls
 * - Production (erp.graterp.my.id): https://api.graterp.my.id
 * - Development/LAN: http://{hostname}:5000
 */
export const getBaseURL = (): string => {
  const hostname = window.location.hostname;
  
  // Production domain - use HTTPS API subdomain
  if (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id')) {
    return 'https://api.graterp.my.id';
  }
  
  // Local development - use same hostname with port 5000
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
