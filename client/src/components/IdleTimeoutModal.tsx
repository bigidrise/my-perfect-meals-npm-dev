/**
 * IdleTimeoutModal — HIPAA-compliant automatic session logoff
 *
 * Tracks user activity on the client and shows a warning modal before the
 * server-enforced idle timeout expires. The server is the source of truth;
 * this is purely a UX layer so users are not surprised by a sudden sign-out.
 *
 * Timeouts mirror the server constants in requireAuth.ts:
 *   • Clinical (coach / admin): 15 minutes idle
 *   • Consumer (client):        60 minutes idle
 *
 * Warning fires 2 minutes before the timeout. A "Stay Signed In" button
 * resets the timer. If the countdown reaches zero the user is logged out and
 * redirected to /login with a clear message.
 *
 * Only active when a real authenticated user is present (not guest, not Apple
 * review demo mode). Does nothing on native mobile — the OS manages lifecycle.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders, clearAuthToken } from "@/lib/auth";
import { clearUserContext } from "@/lib/sentry";

// Must match server/middleware/requireAuth.ts IDLE_TIMEOUT_MS
const IDLE_TIMEOUT_MS: Record<string, number> = {
  coach: 15 * 60 * 1000,
  admin: 15 * 60 * 1000,
  client: 60 * 60 * 1000,
};
const FALLBACK_TIMEOUT_MS = 60 * 60 * 1000;
const WARNING_LEAD_MS = 2 * 60 * 1000; // show warning 2 min before timeout

// Activity events that reset the idle timer
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "touchstart",
  "scroll",
  "pointerdown",
];

function getIdleTimeout(role: string | undefined): number {
  return IDLE_TIMEOUT_MS[role ?? "client"] ?? FALLBACK_TIMEOUT_MS;
}

export function IdleTimeoutModal() {
  const { user, setUser } = useAuth();
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  const lastActiveRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine if this instance should be active
  const isRealUser =
    !!user &&
    !user.id.startsWith("guest-") &&
    user.id !== "00000000-0000-0000-0000-000000000001"; // Apple review demo

  const idleTimeout = getIdleTimeout(user?.role);

  const signOut = useCallback(async () => {
    // Best-effort server logout — don't block on failure
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
    } catch {
      // Ignore network errors — we're signing out regardless
    }

    // Clear all local auth state
    setUser(null);
    localStorage.removeItem("mpm_current_user");
    localStorage.removeItem("userId");
    localStorage.removeItem("isAuthenticated");
    clearAuthToken();
    clearUserContext();

    // Redirect with a message the login page can display
    window.location.href = "/login?reason=idle_timeout";
  }, [setUser]);

  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startWarningCountdown = useCallback(() => {
    setWarningVisible(true);
    setSecondsLeft(Math.round(WARNING_LEAD_MS / 1000));

    countdownIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearWarningTimer();
          signOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearWarningTimer, signOut]);

  const scheduleWarning = useCallback(() => {
    clearWarningTimer();
    const timeUntilWarning = idleTimeout - WARNING_LEAD_MS;

    warningTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, timeUntilWarning);
  }, [idleTimeout, clearWarningTimer, startWarningCountdown]);

  const handleActivity = useCallback(() => {
    if (!isRealUser) return;
    lastActiveRef.current = Date.now();

    // If warning is not showing, simply reschedule
    if (!warningVisible) {
      scheduleWarning();
    }
  }, [isRealUser, warningVisible, scheduleWarning]);

  // "Stay Signed In" — dismiss warning and restart the full timer
  const handleStaySignedIn = useCallback(() => {
    setWarningVisible(false);
    clearWarningTimer();
    lastActiveRef.current = Date.now();
    scheduleWarning();
  }, [clearWarningTimer, scheduleWarning]);

  // Listen for SESSION_IDLE_TIMEOUT from any API response
  useEffect(() => {
    const handleIdleTimeout = () => {
      clearWarningTimer();
      signOut();
    };
    window.addEventListener("mpm:session-idle-timeout", handleIdleTimeout);
    return () => window.removeEventListener("mpm:session-idle-timeout", handleIdleTimeout);
  }, [clearWarningTimer, signOut]);

  // Register activity listeners and schedule the first warning
  useEffect(() => {
    if (!isRealUser) return;

    scheduleWarning();

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true })
    );

    return () => {
      clearWarningTimer();
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealUser, user?.role]);

  if (!warningVisible || !isRealUser) return null;

  const isClinical = user?.role === "coach" || user?.role === "admin";
  const minutesLeft = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown =
    minutesLeft > 0
      ? `${minutesLeft}:${String(secs).padStart(2, "0")}`
      : `${secs}s`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-desc"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(154,52,18,0.3) 100%)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600/20 ring-1 ring-orange-500/30">
          <svg
            className="h-7 w-7 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="idle-timeout-title"
          className="mb-2 text-lg font-semibold text-white"
        >
          Still there?
        </h2>

        {/* Description */}
        <p
          id="idle-timeout-desc"
          className="mb-1 text-sm text-white/70"
        >
          {isClinical
            ? "For security, clinical sessions time out after 15 minutes of inactivity."
            : "Your session will expire after 60 minutes of inactivity."}
        </p>
        <p className="mb-5 text-sm text-white/60">
          You'll be signed out in{" "}
          <span className="font-mono font-semibold text-orange-400">{countdown}</span>.
        </p>

        {/* Countdown ring */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-600/10 ring-2 ring-orange-500/40">
          <span className="font-mono text-xl font-bold text-orange-400">{countdown}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleStaySignedIn}
            className="w-full rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
          >
            Stay Signed In
          </button>
          <button
            onClick={signOut}
            className="w-full rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/70 transition-opacity active:opacity-80"
          >
            Sign Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
