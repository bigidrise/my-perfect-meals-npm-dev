import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Sparkles, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isInTrial } from "@/lib/subscriptionCheck";
import { useTranslation } from "react-i18next";

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

function getDismissedKey(userId: string, trialEndsAt: string) {
  // Key includes the trial end date so dismissal resets when the trial is extended
  // (e.g. after a 90-day Client Invitation replaces the original 7-day trial).
  const dateStamp = trialEndsAt.slice(0, 10); // YYYY-MM-DD
  return `mpm:trialBannerDismissed:${userId}:${dateStamp}`;
}

function getDaysRemaining(trialEndsAt: string): number {
  const now = Date.now();
  const end = new Date(trialEndsAt).getTime();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function TrialBanner() {
  const { t } = useTranslation("trialBanner");
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Re-read localStorage when the user or their trial end date changes.
  // (Trial end date changes when a Client Invitation extends the trial.)
  useEffect(() => {
    if (!user?.id || !user.trialEndsAt) {
      setDismissed(false);
      return;
    }
    const key = getDismissedKey(user.id, user.trialEndsAt as string);
    setDismissed(localStorage.getItem(key) === "1");
  }, [user?.id, user?.trialEndsAt]);

  // Don't show on auth / pricing / onboarding routes
  if (EXCLUDED_ROUTES.some((r) => location === r || location.startsWith(r + "/"))) {
    return null;
  }

  // Only show while the user is actively in their trial window
  if (!isInTrial(user)) return null;

  // Prefer server-authoritative daysRemaining; fall back to local computation
  const serverDays = (user as any)?.daysRemaining as number | undefined;
  const daysLeft = typeof serverDays === "number" ? serverDays : getDaysRemaining(user!.trialEndsAt as string);
  // Show when 1–7 days remain (full final week); TrialStatusCard handles earlier days on dashboard
  if (daysLeft <= 0 || daysLeft > 7) return null;

  // Don't show if already dismissed for this trial window
  if (dismissed) return null;

  function handleDismiss() {
    if (!user?.id || !user.trialEndsAt) return;
    const key = getDismissedKey(user.id, user.trialEndsAt as string);
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  const isLastDay = daysLeft === 1;
  const isUrgent = daysLeft <= 3;
  const dayLabel = isLastDay ? t("oneDayLeft") : t("daysLeft", { count: daysLeft });
  const trialTier = (user as any)?.trialTier ?? null;
  const tierLabel = trialTier === "ultimate" ? t("clinicalAccess") : t("fullAccess");

  return (
    <div
      className="fixed left-0 right-0 z-[9990] pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
    >
      <div className="pointer-events-auto mx-4">

        {isLastDay ? (
          // ── Last-day state: urgent, warm red ──────────────────────────────
          <div className="rounded-xl border border-red-500/40 bg-black/95 backdrop-blur-md px-4 py-3 shadow-lg shadow-red-900/20">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-red-500/20">
                <Clock className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-300 leading-tight mb-0.5">
                  {t("lastDayTitle")}
                </p>
                <p className="text-xs text-white/60 leading-relaxed">
                  {t("lastDayBody")}&nbsp;
                  <span className="text-white/70">{t("lastDayDataSafe")}</span>
                  &nbsp;{t("lastDayUpgradeHint")}
                </p>
                <button
                  onClick={() => setLocation("/pricing")}
                  className="mt-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors active:bg-red-700"
                >
                  {t("upgradeToPro")}
                </button>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 rounded-lg text-white/30 hover:text-white/60 active:bg-white/10 transition-colors"
                aria-label={t("dismiss")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          // ── General state: celebratory, orange ────────────────────────────
          <div className="rounded-xl border border-orange-500/30 bg-black/90 backdrop-blur-md px-4 py-3 shadow-lg shadow-orange-900/20">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-orange-500/20">
                <Sparkles className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight mb-0.5">
                  <span className={isUrgent ? "text-red-400" : "text-orange-400"}>{dayLabel}</span>{" "}
                  {t("trialCountdown", { tierLabel })}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setLocation("/pricing")}
                    className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 px-3 py-1.5 rounded-lg transition-colors active:bg-orange-700"
                  >
                    {t("upgradeToPro")}
                  </button>
                  <button
                    onClick={() => setLocation("/business-center")}
                    className="text-xs font-medium text-white/60 hover:text-white/80 underline underline-offset-2 transition-colors"
                  >
                    {t("exploreFeatures")}
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 rounded-lg text-white/30 hover:text-white/60 active:bg-white/10 transition-colors"
                aria-label={t("dismiss")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
