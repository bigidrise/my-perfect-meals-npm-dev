/**
 * TrialMilestoneModal
 *
 * Fires ONCE per trial window at three thresholds:
 *   "7d"  — 4–7 days remaining  (informational, feature showcase)
 *   "3d"  — 2–3 days remaining  (urgency + upgrade CTA)
 *   "1d"  — exactly 1 day left  (last-chance + data-preservation message)
 *
 * localStorage key pattern:
 *   mpm:trialMilestone:<userId>:<YYYY-MM-DD>:<bucket>
 *
 * The date stamp is the trial-end date, so if an admin extends the trial
 * the user gets a fresh set of milestone fires for the new window.
 *
 * Works for all trialSource values (standard_signup, admin_grant,
 * clinic_grant, promotion).
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sparkles, Clock, Shield, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { isInTrial } from "@/lib/subscriptionCheck";

// ── Routes where no modal should appear ───────────────────────────────────────
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

// ── Milestone bucket type ──────────────────────────────────────────────────────
type MilestoneBucket = "7d" | "3d" | "1d";

function getMilestoneBucket(daysRemaining: number): MilestoneBucket | null {
  if (daysRemaining >= 4 && daysRemaining <= 7) return "7d";
  if (daysRemaining >= 2 && daysRemaining <= 3) return "3d";
  if (daysRemaining === 1) return "1d";
  return null;
}

function getSeenKey(userId: string, trialEndsAt: string, bucket: MilestoneBucket): string {
  const dateStamp = trialEndsAt.slice(0, 10); // YYYY-MM-DD
  return `mpm:trialMilestone:${userId}:${dateStamp}:${bucket}`;
}

function hasSeenMilestone(userId: string, trialEndsAt: string, bucket: MilestoneBucket): boolean {
  try {
    return localStorage.getItem(getSeenKey(userId, trialEndsAt, bucket)) === "1";
  } catch {
    return false;
  }
}

function markMilestoneSeen(userId: string, trialEndsAt: string, bucket: MilestoneBucket): void {
  try {
    localStorage.setItem(getSeenKey(userId, trialEndsAt, bucket), "1");
  } catch {
    // localStorage unavailable — silently skip; modal may re-appear but won't loop in this session
  }
}

// ── Per-bucket modal content ───────────────────────────────────────────────────
interface ModalConfig {
  icon: React.ReactNode;
  accentClass: string;
  badgeClass: string;
  headline: string;
  body: string;
  dataNote?: string;
  primaryCta: string;
  secondaryCta?: string;
}

function getModalConfig(
  bucket: MilestoneBucket,
  daysRemaining: number,
  tierLabel: string,
): ModalConfig {
  switch (bucket) {
    case "7d":
      return {
        icon: <Sparkles className="h-5 w-5 text-emerald-400" />,
        accentClass: "border-emerald-500/30",
        badgeClass: "bg-emerald-500/15 text-emerald-300",
        headline: `You have ${daysRemaining} days of ${tierLabel} access`,
        body:
          "Make the most of your trial — personalised meal plans, clinical-grade nutrition tools, and AI coaching are all yours right now.",
        primaryCta: "Explore features",
        secondaryCta: "Upgrade now",
      };
    case "3d":
      return {
        icon: <Clock className="h-5 w-5 text-orange-400" />,
        accentClass: "border-orange-500/40",
        badgeClass: "bg-orange-500/15 text-orange-300",
        headline: `${daysRemaining} days left in your trial`,
        body:
          "Your personalised nutrition plan, AI coaching sessions, and meal history are all waiting. Lock in access before your trial ends.",
        primaryCta: "Upgrade to keep access",
        secondaryCta: "Remind me later",
      };
    case "1d":
      return {
        icon: <Clock className="h-5 w-5 text-red-400" />,
        accentClass: "border-red-500/40",
        badgeClass: "bg-red-500/15 text-red-300",
        headline: "Your trial ends tomorrow",
        body:
          "Your account will move to the Free plan at midnight. Everything you've built — meal history, preferences, nutrition targets — stays safe.",
        dataNote: "Your data is never deleted. Upgrade anytime to pick up exactly where you left off.",
        primaryCta: "Upgrade now",
        secondaryCta: "Got it",
      };
  }
}

// ── Feature list for 7d modal ──────────────────────────────────────────────────
const FEATURE_HIGHLIGHTS = [
  "AI-powered meal builders",
  "Personalised macro targets",
  "Clinical nutrition coaching",
  "Grocery & barcode scanner",
  "Meal history & favourites",
];

// ── Main component ─────────────────────────────────────────────────────────────
export function TrialMilestoneModal() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState<MilestoneBucket | null>(null);

  useEffect(() => {
    if (!user?.id || !user.trialEndsAt || !isInTrial(user)) {
      setOpen(false);
      return;
    }

    // Excluded routes — never show
    if (EXCLUDED_ROUTES.some((r) => location === r || location.startsWith(r + "/"))) {
      setOpen(false);
      return;
    }

    const daysRemaining: number = (user as any).daysRemaining ?? 0;
    const bucket = getMilestoneBucket(daysRemaining);
    if (!bucket) {
      setOpen(false);
      return;
    }

    if (hasSeenMilestone(user.id, user.trialEndsAt as string, bucket)) {
      setOpen(false);
      return;
    }

    // Mark seen immediately so rapid re-renders or tab switches don't double-fire
    markMilestoneSeen(user.id, user.trialEndsAt as string, bucket);
    setActiveBucket(bucket);
    setOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.trialEndsAt, (user as any)?.daysRemaining]);

  function handleClose() {
    setOpen(false);
  }

  function handlePrimary() {
    setOpen(false);
    if (activeBucket === "7d") {
      setLocation("/business-center");
    } else {
      setLocation("/pricing");
    }
  }

  function handleSecondary() {
    setOpen(false);
  }

  if (!open || !activeBucket || !user) return null;

  const daysRemaining: number = (user as any).daysRemaining ?? 0;
  const trialTier: string | null = (user as any).trialTier ?? null;
  const tierLabel =
    trialTier === "ultimate"
      ? "Clinical · Ultimate"
      : trialTier
      ? trialTier.charAt(0).toUpperCase() + trialTier.slice(1)
      : "full";

  const cfg = getModalConfig(activeBucket, daysRemaining, tierLabel);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={`max-w-sm rounded-2xl border bg-zinc-950 p-0 overflow-hidden ${cfg.accentClass}`}
      >
        {/* Header strip */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
              {cfg.icon}
              <span>Trial Update</span>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-white leading-snug mb-2">
            {cfg.headline}
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">{cfg.body}</p>

          {cfg.dataNote && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
              <Shield className="h-3.5 w-3.5 text-white/40 mt-0.5 shrink-0" />
              <p className="text-xs text-white/50 leading-relaxed">{cfg.dataNote}</p>
            </div>
          )}
        </div>

        {/* Feature list — only for 7d bucket */}
        {activeBucket === "7d" && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
              Included in your trial
            </p>
            <ul className="space-y-1.5">
              {FEATURE_HIGHLIGHTS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                  <ChevronRight className="h-3.5 w-3.5 text-emerald-500/70 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA buttons */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            onClick={handlePrimary}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              activeBucket === "1d"
                ? "bg-red-600 hover:bg-red-500 active:bg-red-700"
                : activeBucket === "3d"
                ? "bg-orange-600 hover:bg-orange-500 active:bg-orange-700"
                : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
            }`}
          >
            {cfg.primaryCta}
          </button>
          {cfg.secondaryCta && (
            <button
              onClick={handleSecondary}
              className="w-full py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white/70 transition-colors"
            >
              {cfg.secondaryCta}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
