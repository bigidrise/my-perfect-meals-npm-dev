import { getDeviceId } from "@/utils/deviceId";
import { getAuthHeaders, isNativePlatform } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

export async function apiRequest(path: string, init: RequestInit = {}) {
  const deviceId = getDeviceId();
  
  const headers = new Headers(init.headers || {});
  if (!isNativePlatform()) headers.delete("x-auth-token");
  for (const [name, value] of Object.entries(getAuthHeaders())) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (!headers.has("X-Device-Id")) headers.set("X-Device-Id", deviceId);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  let data: any = null;
  try { data = await res.json(); } catch {}

  if (!res.ok || data?.ok === false) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}
