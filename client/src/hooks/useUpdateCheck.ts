import { useEffect, useState } from "react";
import { BUILD_VERSION } from "@/buildVersion";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function formatDate(ts: string): string {
  if (!ts || ts === "dev") return "Dev build";
  const num = Number(ts);
  if (isNaN(num)) return ts;
  return new Date(num).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}

function isStale(latest: string | null): boolean {
  if (!latest) return false;
  if (BUILD_VERSION === "dev") return false;
  return latest !== BUILD_VERSION;
}

/** Simple boolean — used by App.tsx for the global update banner */
export function useUpdateCheck(): boolean {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestVersion().then(setLatest);
    const interval = setInterval(() => fetchLatestVersion().then(setLatest), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return isStale(latest);
}

/** Full status object — used by ProfileSheet for the smart chip */
export function useUpdateStatus() {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestVersion().then(setLatest);
    const interval = setInterval(() => fetchLatestVersion().then(setLatest), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    hasUpdate: isStale(latest),
    currentVersionLabel: formatDate(BUILD_VERSION),
  };
}
