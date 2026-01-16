import { Capacitor } from '@capacitor/core';

// ⭐ Production backend URL (your live deployed app backend)
const PROD_SERVER_URL =
  "https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app";

// ⭐ Staging backend URL (your new staging environment)
const STAGING_SERVER_URL =
  "https://my-perfect-meals-staging--bigidrise.replit.app";

// Detect Capacitor native iOS/Android wrapper
function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Detect dev environments (localhost, Replit dev domain, etc.)
function isDevEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostname.includes("repl.co") ||
    hostname.includes("replit.dev") ||
    hostname.includes("replit.app") // Production deployed apps should use same origin
  );
}

// Detect staging environment
function isStagingEnvironment(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes("my-perfect-meals-staging--bigidrise");
}

export function resolveApiBase(): string {
  // Native app ALWAYS uses explicit server URL
  if (isCapacitorNative()) {
    console.log("Native app detected → production backend");
    return PROD_SERVER_URL;
  }

  // STAGING logic → always talk to staging backend
  if (isStagingEnvironment()) {
    console.log("Staging environment detected → staging backend");
    return STAGING_SERVER_URL;
  }

  // DEV logic → use same origin
  if (isDevEnvironment()) {
    console.log("Dev environment detected → using window.origin");
    return window.location.origin;
  }

  // Anything else is production
  console.log("Production environment detected → production backend");
  return PROD_SERVER_URL;
}

export function apiUrl(path: string): string {
  const base = resolveApiBase();
  return base + (path.startsWith("/") ? path : "/" + path);
}
