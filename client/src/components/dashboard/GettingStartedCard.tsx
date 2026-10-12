import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import { useGuidedJourneyDashboard } from "@/hooks/useGuidedJourneyDashboard";
import {
  isPersonalJourneyDashboard, journeyDashboardContextKey,
} from "@/lib/guidedJourney/dashboardScope";
import { GettingStartedCardView } from "./GettingStartedCardView";
import { GuidedJourneyExplanation } from "@/components/guided/GuidedJourneyExplanation";

function currentWorkspace(): string | null {
  try { return localStorage.getItem("mpm_active_space"); } catch { return "unknown"; }
}

/** Development-only entry point. This component never mounts a walkthrough. */
export function GettingStartedCard() {
  const { user, loading, refreshUser } = useAuth();
  const { activeProfileId } = useHousehold();
  const [path, navigate] = useLocation();
  const context = {
    development: IS_DEVELOPMENT, path, workspace: currentWorkspace(), householdProfileId: activeProfileId,
  };
  const eligible = !loading && isPersonalJourneyDashboard(user, context);
  const journey = useGuidedJourneyDashboard({
    account: user, eligible, contextKey: journeyDashboardContextKey(user, context),
    refreshAccount: refreshUser, navigate,
    isCurrentContextPersonal: () => !loading && isPersonalJourneyDashboard(user, {
      ...context, workspace: currentWorkspace(), path: window.location.pathname,
    }),
  });
  if (!journey.visible) return null;
  return (
    <div className="mb-4">
      <GettingStartedCardView model={journey.model}
        onContinue={() => { void journey.continueSetup(); }}
        onRetry={journey.retry} onPauseResume={journey.pauseResume}
        onToggleAutomatic={journey.toggleAutomatic} onRestart={journey.restart}
        onExplain={() => { void journey.openExplanation(); }} canExplain={journey.canExplain}
        presentationNotice={journey.presentationNotice} />
      {journey.explanation && (
        <GuidedJourneyExplanation open model={journey.explanation} busy={journey.model.busy}
          onPrimary={() => { void journey.explanationPrimary(); }}
          onSecondary={journey.explanationSecondary} onClose={journey.dismissExplanation}
          onRestoreFocus={journey.restoreExplanationFocus} />
      )}
    </div>
  );
}
