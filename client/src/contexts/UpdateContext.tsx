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
import { BUILD_RELEASE_ID, BUILD_VERSION } from "@/buildVersion";
import {
  isDifferentCustomerRelease,
  parseCustomerReleaseManifest,
} from "@/lib/releaseVersion";

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
  // `releaseId` is what the banner and dismiss key are keyed off.
  const [latestReleaseId, setLatestReleaseId] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string[]>([]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) {
          if (import.meta.env.DEV) {
            console.warn(`[UpdateContext] Release manifest request failed with status ${res.status}.`);
          }
          return;
        }
        const data = await res.json();
        const release = parseCustomerReleaseManifest(data);
        if (!release) {
          if (import.meta.env.DEV) {
            console.warn("[UpdateContext] Release manifest is missing a valid customer release record.");
          }
          return;
        }
        setLatestReleaseId(release.releaseId);
        setReleaseNotes(release.notes);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(
            "[UpdateContext] Unable to check the release manifest.",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const checkOnForeground = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", checkOnForeground);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkOnForeground);
      window.removeEventListener("focus", check);
    };
  }, []);

  const hasUpdate = isDifferentCustomerRelease(BUILD_RELEASE_ID, latestReleaseId);

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
