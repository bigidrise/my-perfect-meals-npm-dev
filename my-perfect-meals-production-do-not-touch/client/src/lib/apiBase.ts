// API Base URL resolver - works consistently in dev, Replit, and Railway
export const getApiBase = (): string => {
  // In development or when using Vite proxy, use relative paths
  if ((import.meta as any).env?.DEV) {
    return '';
  }

  // Check for explicit API base URL from environment
  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  // In production, use same-origin (works for Replit and Railway deployments)
  return window.location.origin;
};

// Construct full API URL
export const getApiUrl = (path: string): string => {
  const base = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If base is empty (dev mode), return path as-is for Vite proxy
  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
};