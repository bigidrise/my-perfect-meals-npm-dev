import { useState, useEffect, useRef } from 'react';
import { checkForUpdates, type VersionCheckResult } from '@/lib/versionCheck';
// BIG-APP PATTERN: No auto-reload imports - all reloads are user-controlled now

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
        console.log('📢 [MPM Update] Update detected via periodic check:', result.latestVersion);
        // Dispatch event for update banner - user controls when to refresh
        window.dispatchEvent(new CustomEvent('mpm:update-available'));
      } else {
        // Versions match - sync localStorage to prevent focus handler mismatch
        localStorage.setItem("appVersion", result.latestVersion);
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

  // BIG-APP PATTERN: Check version on focus but NEVER auto-reload
  // Only dispatch update available event, let user control when to refresh
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

        // Extract base version (before '+' build metadata) for comparison
        // e.g., "1.0.0+2026.01.22.abc123" -> "1.0.0"
        const extractBaseVersion = (v: string) => v?.split('+')[0] || v;
        const baseVersion = extractBaseVersion(version);
        const baseCurrentVersion = extractBaseVersion(current || '');

        // Store version on first load
        if (!current) {
          localStorage.setItem("appVersion", version);
          return;
        }

        // If base version changed, signal update available (NO auto-reload)
        if (baseVersion !== baseCurrentVersion) {
          console.log(`📢 [MPM Update] New version detected: ${baseCurrentVersion} → ${baseVersion}`);
          localStorage.setItem("appVersion", version);
          // Dispatch event for update banner - user controls when to refresh
          window.dispatchEvent(new CustomEvent('mpm:update-available'));
        } else if (version !== current) {
          // Build metadata changed but base version same - silently update localStorage
          console.log(`📝 Build metadata updated: ${current} → ${version} (no action needed)`);
          localStorage.setItem("appVersion", version);
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