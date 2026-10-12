import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import { isPersonalJourneyWorkflow, journeyDashboardContextKey } from "@/lib/guidedJourney/dashboardScope";
import { useGuidedJourneyDashboard } from "@/hooks/useGuidedJourneyDashboard";
import { GuidedJourneyExplanation } from "./GuidedJourneyExplanation";

/** Inline offer only; the existing workflows own saving, redirects and resume. */
export function GuidedWorkflowNextStep({ busy = false, professionalSession = false, summaryVisible = false }: { busy?: boolean; professionalSession?: boolean; summaryVisible?: boolean }) {
  const { user, loading, refreshUser } = useAuth();
  const { activeProfileId } = useHousehold();
  const [path, navigate] = useLocation();
  function workspace() {
    try { return localStorage.getItem("mpm_active_space"); } catch { return "unknown"; }
  }
  const context = { development: IS_DEVELOPMENT, path, workspace: workspace(), householdProfileId: activeProfileId, professionalSession };
  const eligible = !loading && !professionalSession && isPersonalJourneyWorkflow(user, context);
  const journey = useGuidedJourneyDashboard({
    account: user, eligible, contextKey: journeyDashboardContextKey(user, context),
    refreshAccount: refreshUser, navigate, workflowBusy: busy,
    isCurrentContextPersonal: () => !loading && !professionalSession && isPersonalJourneyWorkflow(user, {
      ...context, workspace: workspace(), path: window.location.pathname,
    }),
  });
  if (!journey.visible) return null;
  return <>
    {(journey.handoff || journey.model.canRetry || journey.presentationNotice) && (
      <section data-testid="guided-workflow-next-step" aria-label="Guided Journey next step"
        style={summaryVisible ? { marginTop: "8rem" } : undefined}
        className="mx-auto w-full max-w-5xl rounded-xl border border-orange-300/30 bg-zinc-950 p-4 text-white">
        <p role="status" className="text-sm leading-relaxed text-zinc-200">
          {journey.handoff?.message ?? journey.presentationNotice ?? journey.model.statusText}
        </p>
        {journey.handoff && <button type="button" disabled={busy}
          onClick={() => { void journey.nextStep(); }} data-testid="guided-workflow-next-action"
          className="mt-3 min-h-11 scroll-mt-64 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">
          Next Step{journey.handoff.destination === "dashboard" ? ": Dashboard" : ""}
        </button>}
        {journey.model.canRetry && <button type="button" disabled={busy}
          onClick={journey.retry} className="mt-3 min-h-11 scroll-mt-64 rounded-xl border border-white/30 px-4 py-2">
          Retry Progress Check
        </button>}
      </section>
    )}
    {journey.explanation && <GuidedJourneyExplanation open model={journey.explanation}
      busy={busy || journey.model.busy}
      onPrimary={() => { void journey.explanationPrimary(); }}
      onSecondary={journey.explanationSecondary} onClose={journey.dismissExplanation}
      onRestoreFocus={() => journey.restoreExplanationFocus('[data-testid="guided-workflow-next-action"]')} />}
  </>;
}
