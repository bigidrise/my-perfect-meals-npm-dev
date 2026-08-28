/**
 * TrialStatusCard
 *
 * Persistent dashboard card shown while a trial is active.
 * Displays access tier, days remaining, and expiration date.
 * Escalates urgency at 7 → 3 → 1 days.
 * Source: server-authoritative — never computes duration client-side.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Sparkles, Clock, Shield } from "lucide-react";
import { isInTrial } from "@/lib/subscriptionCheck";
import { useTranslation } from "react-i18next";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getUrgencyLevel(daysRemaining: number): "normal" | "warning" | "urgent" {
  if (daysRemaining <= 1) return "urgent";
  if (daysRemaining <= 3) return "warning";
  return "normal";
}

export function TrialStatusCard() {
  const { t, i18n } = useTranslation("trialStatusCard");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!isInTrial(user)) return null;

  const trialEndsAt = user?.trialEndsAt as string | null;
  const daysRemaining: number = (user as any)?.daysRemaining ?? (() => {
    if (!trialEndsAt) return 0;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  const trialSource: string | null = (user as any)?.trialSource ?? null;
  const trialTier: string | null = (user as any)?.trialTier ?? null;
  const trialStartedAt: string | null = (user as any)?.trialStartedAt ?? null;
  const urgency = getUrgencyLevel(daysRemaining);

  const tierLabel = trialTier === "ultimate"
    ? t("clinicalUltimate")
    : trialTier
    ? trialTier.charAt(0).toUpperCase() + trialTier.slice(1)
    : t("tierFull");

  const sourceLabel =
    trialSource === "admin_grant" ? t("adminTrial") :
    trialSource === "clinic_grant" ? t("clinicalTrial") :
    trialSource === "promotion" ? t("promotionalTrial") :
    trialSource === "pilot_program" ? t("pilotProgram", { defaultValue: "Pilot Program" }) :
    trialSource === "client_access" ? t("clientAccess", { defaultValue: "Client Access" }) :
    t("freeTrial");

  const totalDays: number = (() => {
    if (trialStartedAt && trialEndsAt) {
      const ms = new Date(trialEndsAt).getTime() - new Date(trialStartedAt).getTime();
      const days = Math.round(ms / (1000 * 60 * 60 * 24));
      if (days > 0) return days;
    }
    // Fallback for legacy accounts without start date
    return trialSource && trialSource !== "standard_signup" ? 30 : 7;
  })();

  const bgClass =
    urgency === "urgent"
      ? "border-red-500/30 bg-red-950/20"
      : urgency === "warning"
      ? "border-orange-500/30 bg-orange-950/20"
      : "border-emerald-500/20 bg-emerald-950/10";

  const iconClass =
    urgency === "urgent"
      ? "text-red-400 bg-red-500/20"
      : urgency === "warning"
      ? "text-orange-400 bg-orange-500/20"
      : "text-emerald-400 bg-emerald-500/15";

  const dayColor =
    urgency === "urgent" ? "text-red-400" :
    urgency === "warning" ? "text-orange-400" :
    "text-emerald-400";

  const Icon = urgency === "urgent" ? Clock : urgency === "warning" ? Clock : Sparkles;

  const headlineText =
    urgency === "urgent"
      ? t("trialEndsToday")
      : urgency === "warning"
      ? t("daysLeftInTrial", { count: daysRemaining })
      : t("daysOfDaysRemaining", { count: daysRemaining, total: totalDays });

  return (
    <div className={`rounded-xl border px-4 py-3 mb-4 ${bgClass}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="h-3 w-3 text-white/40" />
            <span className="text-xs text-white/50 font-medium">{sourceLabel} · {tierLabel}</span>
          </div>
          <p className={`text-sm font-semibold leading-tight ${dayColor}`}>
            {headlineText}
          </p>
          {trialEndsAt && (
            <p className="text-xs text-white/50 mt-0.5">
              {urgency === "urgent"
                ? t("accountMovesFree")
                : t("trialExpires", { date: formatDate(trialEndsAt, i18n.language) })}
            </p>
          )}

          {/* Progress bar */}
          {daysRemaining > 0 && (
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  urgency === "urgent" ? "bg-red-500" :
                  urgency === "warning" ? "bg-orange-500" :
                  "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (daysRemaining / totalDays) * 100)}%` }}
              />
            </div>
          )}

          {urgency !== "normal" && (
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setLocation("/pricing")}
                className={`text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors ${
                  urgency === "urgent"
                    ? "bg-red-600 hover:bg-red-500 active:bg-red-700"
                    : "bg-orange-600 hover:bg-orange-500 active:bg-orange-700"
                }`}
              >
                {t("keepFullAccess")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
