import { Capacitor } from '@capacitor/core';

/**
 * Native shells do not have a web origin that can serve the API. Keep their
 * production endpoint centralized here; all browser builds use their own
 * origin, including custom domains, Replit deployments, and development.
 */
export const NATIVE_PRODUCTION_API_ORIGIN = "https://app.myperfectmeals.com";

export function resolveApiBaseForRuntime({
  isNative,
  webOrigin,
}: {
  isNative: boolean;
  webOrigin?: string;
}): string {
  if (isNative) return NATIVE_PRODUCTION_API_ORIGIN;
  return webOrigin || "";
}

export function resolveApiBase(): string {
  let isNative = false;
  try {
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }

  return resolveApiBaseForRuntime({
    isNative,
    webOrigin: typeof window === "undefined" ? undefined : window.location.origin,
  });
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveApiBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
