import { getDeviceId } from "./deviceId";
import { getApiUrl } from "@/lib/apiBase";

export async function fetchWithDevice(url: string, options?: RequestInit) {
  const deviceId = getDeviceId();

  // Ensure we're using the correct API base URL
  const fullUrl = url.startsWith('http') ? url : getApiUrl(url);

  return fetch(fullUrl, {
    ...options,
    credentials: 'include', // Important for CORS with cookies
    headers: {
      ...options?.headers,
      "X-Device-Id": deviceId,
    },
  });
}