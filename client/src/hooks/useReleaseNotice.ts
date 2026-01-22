import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mpm_lastSeenReleaseId';

interface ReleaseManifest {
  releaseId: string;
  publishedAt: string;
}

export function useReleaseNotice() {
  const [showBanner, setShowBanner] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);

  useEffect(() => {
    const checkRelease = async () => {
      try {
        const res = await fetch('/release-manifest.json', { cache: 'no-store' });
        if (!res.ok) return;
        
        const manifest: ReleaseManifest = await res.json();
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        
        setReleaseId(manifest.releaseId);
        
        if (lastSeen !== manifest.releaseId) {
          setShowBanner(true);
        }
      } catch {
        // Silent fail - don't break app if manifest unavailable
      }
    };

    checkRelease();
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

  return { showBanner, dismiss, update, releaseId };
}
