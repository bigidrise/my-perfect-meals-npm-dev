import { useState, useEffect, useRef } from 'react';
import { checkForUpdates, type VersionCheckResult } from '@/lib/versionCheck';
import { forceReloadWithCacheClear } from '@/lib/webviewCache';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useVersionCheck() {
  const [versionState, setVersionState] = useState<VersionCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCheckRef = useRef<number>(0);

  const performCheck = async () => {
    // Prevent duplicate checks within 30 seconds
    const now = Date.now();
    if (now - lastCheckRef.current < 30000) {
      return;
    }

    lastCheckRef.current = now;
    setIsChecking(true);

    try {
      const result = await checkForUpdates();
      setVersionState(result);

      if (result.updateAvailable || result.forceUpdate) {
        console.log('🔄 Update available:', result.latestVersion);
      }
    } catch (error) {
      console.error('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Set up periodic checking
  useEffect(() => {
    // Check immediately on mount
    performCheck();

    // Set up interval for periodic checks
    const scheduleNextCheck = () => {
      checkTimeoutRef.current = setTimeout(() => {
        performCheck();
        scheduleNextCheck();
      }, CHECK_INTERVAL);
    };

    scheduleNextCheck();

    // Clean up on unmount
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  // Check when tab becomes visible (user returns to app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible - check for updates
        performCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // CRITICAL: Auto-reload when app wakes from background (iOS fix)
  // This handles the case where iOS freezes JS when app is backgrounded
  // When user taps the app, we check version and reload if changed
  useEffect(() => {
    const handleFocus = async () => {
      try {
        // Fetch latest version with cache busting
        const res = await fetch("/version.json?cache=" + Date.now(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!res.ok) return;

        const { version } = await res.json();
        const current = localStorage.getItem("appVersion");

        // Store version on first load
        if (!current) {
          localStorage.setItem("appVersion", version);
          return;
        }

        // If version changed, force immediate reload with WKWebView cache clear (iOS fix)
        if (version !== current) {
          console.log(`🔄 Version changed: ${current} → ${version}, clearing cache and reloading...`);
          localStorage.setItem("appVersion", version);
          await forceReloadWithCacheClear();
        }
      } catch (err) {
        console.error("Focus version check failed:", err);
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return {
    versionState,
    isChecking,
    checkNow: performCheck
  };
}