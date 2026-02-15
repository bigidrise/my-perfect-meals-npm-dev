// Locked to MPM Dev Only
const SERVER_URL = "https://mpm-dev.replit.app";

export function resolveApiBase(): string {
  return SERVER_URL;
}

export function apiUrl(path: string): string {
  return SERVER_URL + (path.startsWith("/") ? path : "/" + path);
}
