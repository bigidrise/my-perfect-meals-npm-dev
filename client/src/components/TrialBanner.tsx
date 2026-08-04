import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasActivePaidSubscription } from "@/lib/subscriptionCheck";

// Routes where the banner should not appear
const EXCLUDED_ROUTES = [
  "/welcome",
  "/auth",
  "/login",
  "/pricing",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/guest-builder",
];

function getDismissedKey(userId: string) {
  return `mpm:trialBannerDismissed:${userId}`;
}

function getDaysRemaining(trialEndsAt: string): number {
  const now = Date.now();
  const end = new Date(trialEndsAt).getTime();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function TrialBanner() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Re-read from localStorage whenever the user identity changes.
  // useState initializer only runs once (with user=null during async auth load),
  // so we drive the value from an effect that tracks user.id instead.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!user?.id) {
      setDismissed(false);
      return;
    }
    setDismissed(localStorage.getItem(getDismissedKey(user.id)) === "1");
  }, [user?.id]);

  // Don't show on excluded routes
  if (EXCLUDED_ROUTES.some((r) => location === r || location.startsWith(r + "/"))) {
    return null;
  }

  // Only show when trialEndsAt is set
  if (!user?.trialEndsAt) return null;

  // Don't show if user already has a paid plan
  if (hasActivePaidSubscription(user)) return null;

  // Only show when 1–7 days remain
  const daysLeft = getDaysRemaining(user.trialEndsAt);
  if (daysLeft <= 0 || daysLeft > 7) return null;

  // Don't show if dismissed
  if (dismissed) return null;

  function handleDismiss() {
    if (!user?.id) return;
    localStorage.setItem(getDismissedKey(user.id), "1");
    setDismissed(true);
  }

  const dayLabel = daysLeft === 1 ? "1 day" : `${daysLeft} days`;

  return (
    <div
      className="fixed left-0 right-0 z-[9990] pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
    >
      <div className="pointer-events-auto mx-4">
        <div className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-black/90 backdrop-blur-md px-4 py-3 shadow-lg shadow-orange-900/20">
          <div className="shrink-0 p-1.5 rounded-lg bg-orange-500/20">
            <Clock className="h-4 w-4 text-orange-400" />
          </div>

          <p className="flex-1 text-sm text-white/90 leading-tight">
            <span className="font-semibold text-orange-400">{dayLabel} left</span>{" "}
            in your free trial.{" "}
            <button
              onClick={() => setLocation("/pricing")}
              className="font-semibold text-white underline underline-offset-2 active:text-orange-300"
            >
              Upgrade now
            </button>
          </p>

          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-lg text-white/40 active:text-white/70 active:bg-white/10"
            aria-label="Dismiss trial banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
