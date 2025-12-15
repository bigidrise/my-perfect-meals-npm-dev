import { getDeviceId } from "@/utils/deviceId";
import { getAuthToken } from "@/lib/auth";

export async function apiRequest(path: string, init: RequestInit = {}) {
  const authToken = getAuthToken();
  const deviceId = getDeviceId();
  
  const headers = new Headers(init.headers || {});
  if (authToken && !headers.has("x-auth-token")) headers.set("x-auth-token", authToken);
  if (!headers.has("X-Device-Id")) headers.set("X-Device-Id", deviceId);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  let data: any = null;
  try { data = await res.json(); } catch {}

  if (!res.ok || data?.ok === false) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}
