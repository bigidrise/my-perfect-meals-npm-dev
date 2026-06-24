import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

interface UpdateState {
  hasUpdate: boolean;
  currentVersionLabel: string;
  releaseNotes: string[];
}

const UpdateContext = createContext<UpdateState>({
  hasUpdate: false,
  currentVersionLabel: formatDate(BUILD_VERSION),
  releaseNotes: [],
});

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [latest, setLatest] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string[]>([]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) setLatest(data.version);
        if (Array.isArray(data.notes)) setReleaseNotes(data.notes);
      } catch {}
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const hasUpdate =
    BUILD_VERSION !== "dev" && latest !== null && latest !== BUILD_VERSION;

  return (
    <UpdateContext.Provider
      value={{ hasUpdate, currentVersionLabel: formatDate(BUILD_VERSION), releaseNotes }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdateState(): UpdateState {
  return useContext(UpdateContext);
}
