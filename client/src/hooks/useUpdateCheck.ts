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

interface UpdateStatus {
  hasUpdate: boolean;
  currentVersionLabel: string;
}

export function useUpdateCheck(): boolean & { status: UpdateStatus } {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) setLatestVersion(data.version);
      } catch {}
      finally {
        setIsChecking(false);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const isDev = BUILD_VERSION === "dev";
  const hasUpdate = !isDev && latestVersion !== null && latestVersion !== BUILD_VERSION;

  return hasUpdate as any;
}

export function useUpdateStatus(): UpdateStatus {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) setLatestVersion(data.version);
      } catch {}
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const isDev = BUILD_VERSION === "dev";
  const hasUpdate = !isDev && latestVersion !== null && latestVersion !== BUILD_VERSION;

  return {
    hasUpdate,
    currentVersionLabel: formatDate(BUILD_VERSION),
  };
}
