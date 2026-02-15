// Locked API Base - MPM Dev Only
const API_BASE_URL = "https://mpm-dev.replit.app";

export const getApiBase = (): string => {
  return API_BASE_URL;
};

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
