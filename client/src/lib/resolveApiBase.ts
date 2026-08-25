import { Capacitor } from '@capacitor/core';

/**
 * Bundled native shells start at capacitor://localhost, which cannot serve the
 * API. Keep the canonical production endpoint centralized here; browser builds
 * continue to use their own origin, including custom domains and development.
 */
export const NATIVE_PRODUCTION_API_ORIGIN = "https://app.myperfectmeals.ai";

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
