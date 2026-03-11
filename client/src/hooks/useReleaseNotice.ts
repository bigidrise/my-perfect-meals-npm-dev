import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'mpm_whatsNewSeen:';
const LEGACY_STORAGE_KEY = 'mpm_lastSeenReleaseId';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface ReleaseManifest {
  releaseId: string;
  publishedAt: string;
  changes?: string[];
}

function migrateLegacyKey(): void {
  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyValue) {
    markReleaseSeen(legacyValue);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

function hasSeenRelease(id: string): boolean {
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`) === '1';
}

function markReleaseSeen(id: string): void {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, '1');
}

export function useReleaseNotice() {
  const [showBanner, setShowBanner] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const dismissedReleaseIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    migrateLegacyKey();
  }, []);

  const checkRelease = useCallback(async () => {
    try {
      const res = await fetch(`/release-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        setShowBanner(false);
        return;
      }

      const manifest: ReleaseManifest = await res.json();
      if (!manifest.releaseId) {
        setShowBanner(false);
        return;
      }

      setReleaseId(manifest.releaseId);
      setChanges(manifest.changes || []);

      if (hasSeenRelease(manifest.releaseId) || dismissedReleaseIdRef.current === manifest.releaseId) {
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(false);
    }
  }, []);

  useEffect(() => {
    checkRelease();

    pollIntervalRef.current = window.setInterval(checkRelease, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [checkRelease]);

  const dismiss = useCallback(() => {
    if (releaseId) {
      dismissedReleaseIdRef.current = releaseId;
      markReleaseSeen(releaseId);
    }
    setShowBanner(false);
  }, [releaseId]);

  const update = useCallback(() => {
    if (releaseId) {
      dismissedReleaseIdRef.current = releaseId;
      markReleaseSeen(releaseId);
    }
    window.location.reload();
  }, [releaseId]);

  return { showBanner, dismiss, update, releaseId, changes };
}
