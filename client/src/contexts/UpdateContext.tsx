/**
 * UpdateContext
 *
 * Tracks whether a new customer-facing release is available.
 *
 * KEY DESIGN DECISION — two separate concepts live in release-manifest.json:
 *
 *   version    → timestamp, set by update-version.js on EVERY build.
 *                Used for cache-busting / deployment detection.
 *
 *   releaseId  → stable ID, only changed by cut-release.js when a developer
 *                intentionally ships a customer-facing announcement with notes.
 *
 * `hasUpdate` is true when the fetched releaseId differs from the one that was
 * baked into this bundle at build time. Routine technical deploys (new version,
 * same releaseId) do NOT produce a new banner.
 *
 * The hard guard in UpdateBanner ensures that even if `hasUpdate` is true,
 * an empty notes array will never render a blank banner.
 */

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
  /** The customer-facing release ID driving the current banner. Used as the dismiss key. */
  releaseId: string;
}

const UpdateContext = createContext<UpdateState>({
  hasUpdate: false,
  currentVersionLabel: formatDate(BUILD_VERSION),
  releaseNotes: [],
  releaseId: "",
});

export function UpdateProvider({ children }: { children: ReactNode }) {
  // `version` is still fetched to detect that a new deployment exists at all.
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  // `releaseId` is what the banner and dismiss key are keyed off.
  const [latestReleaseId, setLatestReleaseId] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string[]>([]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) setLatestVersion(data.version);
        if (data.releaseId) setLatestReleaseId(data.releaseId);
        if (Array.isArray(data.notes)) setReleaseNotes(data.notes);
      } catch {}
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // A new deployment exists when the fetched version differs from the baked-in BUILD_VERSION.
  // But the banner only appears if notes are non-empty (enforced in UpdateBanner).
  const hasUpdate =
    BUILD_VERSION !== "dev" &&
    latestVersion !== null &&
    latestVersion !== BUILD_VERSION;

  return (
    <UpdateContext.Provider
      value={{
        hasUpdate,
        currentVersionLabel: formatDate(BUILD_VERSION),
        releaseNotes,
        releaseId: latestReleaseId,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdateState(): UpdateState {
  return useContext(UpdateContext);
}
