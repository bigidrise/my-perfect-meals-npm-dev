import { ChevronRight, Droplets } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { purchasedPlanIncludesFeature } from "@/lib/entitlements";

export default function HydrationDashboardCard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { requestUpgrade } = useUpgradeModal();

  const openHydration = () => {
    if (purchasedPlanIncludesFeature(user, "hydration_center")) {
      navigate("/hydration");
      return;
    }
    requestUpgrade({
      requiredTier: "pro",
      featureName: "My Perfect Hydration Center",
      valueMessage: "Build hydration support around your activity, nutrition context, preferences, barriers, and verified professional guidance—without relying on a generic one-size-fits-all water target.",
    });
  };

  return (
    <button
      type="button"
      onClick={openHydration}
      data-testid="card-hydration-center"
      aria-label="Open My Perfect Hydration Center"
      className="group flex w-full items-start gap-3 rounded-xl border border-sky-400/40 bg-gradient-to-r from-black via-sky-900/50 to-black p-4 text-left text-white backdrop-blur-lg transition-all hover:border-sky-300/70 hover:shadow-[0_0_28px_rgba(56,189,248,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span className="shrink-0 rounded-lg border border-sky-400/25 bg-sky-400/10 p-2.5">
        <Droplets className="h-5 w-5 text-sky-300" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold leading-snug">My Perfect Hydration Center</span>
          <span className="rounded-full border border-sky-300/25 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100">Pro</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-white/70">
          Track fluids, find drinks that work for you, and get personalized hydration support.
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-200">
          Open Hydration Center
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
