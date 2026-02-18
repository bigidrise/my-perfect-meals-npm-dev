import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'mpm_lastSeenReleaseId';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

interface ReleaseManifest {
  releaseId: string;
  publishedAt: string;
  changes?: string[];
}

export function useReleaseNotice() {
  const [showBanner, setShowBanner] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const checkRelease = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const res = await fetch(`/release-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        
        const manifest: ReleaseManifest = await res.json();
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        
        setReleaseId(manifest.releaseId);
        setChanges(manifest.changes || []);
        
        if (lastSeen !== manifest.releaseId) {
          setShowBanner(true);
        }
      } catch {
        // Silent fail - don't break app if manifest unavailable
      }
    };

    // Check immediately on mount
    checkRelease();
    
    // Then poll every 5 minutes for updates
    pollIntervalRef.current = window.setInterval(checkRelease, POLL_INTERVAL_MS);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const dismiss = () => {
    if (releaseId) {
      localStorage.setItem(STORAGE_KEY, releaseId);
    }
    setShowBanner(false);
  };

  const update = () => {
    if (releaseId) {
      localStorage.setItem(STORAGE_KEY, releaseId);
    }
    window.location.reload();
  };

  return { showBanner, dismiss, update, releaseId, changes };
}
