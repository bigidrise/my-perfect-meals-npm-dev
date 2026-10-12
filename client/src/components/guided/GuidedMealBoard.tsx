import type { useGuidedPersonalMealBoard } from "@/hooks/useGuidedPersonalMealBoard";
import { GuidedJourneyExplanation } from "./GuidedJourneyExplanation";

export function GuidedMealBoard({ journey }: { journey: ReturnType<typeof useGuidedPersonalMealBoard> }) {
  if (!journey.visible) return null;
  const retry = journey.failed || journey.unverifiedLocal || journey.model.canRetry || (journey.placed && !journey.confirmedPlan && !journey.model.loading && !journey.pending);
  return <>
    <section data-testid="guided-meal-board" aria-label="First meal plan guidance"
      className="rounded-xl border border-orange-300/30 bg-black/70 p-4 text-white">
      <p role="status" className="text-sm leading-relaxed">
        {journey.pending ? "Your board save is pending. Guidance will wait for server confirmation."
          : journey.failed ? "The board save failed. Your local placement is not confirmed. Retry checks saved evidence; it doesn't save for you."
          : journey.model.canRetry || journey.unverifiedLocal ? "Your saved plan could not be verified. Retry, or keep using the Builder normally."
          : journey.model.loading ? "Checking saved plan evidence…"
          : journey.confirmedPlan ? "Your saved meal plan is confirmed. Open the completion explanation when you're ready."
          : journey.placed ? "A meal is placed locally, but this placement isn't server-confirmed yet."
          : "Create or select a meal, then add it to a day and meal slot. Generating a recipe or saving a Favorite alone doesn't save a meal plan."}
      </p>
      {journey.presentationNotice && <p className="mt-2 text-sm">{journey.presentationNotice}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {retry ? <button type="button" disabled={journey.pending || journey.model.busy}
          onClick={journey.retry} className="min-h-11 rounded-xl border border-white/30 px-4 py-2">Retry Saved Plan Check</button>
          : <button type="button" disabled={journey.pending || !journey.canExplain || journey.model.busy}
            data-testid="guided-meal-board-explain" onClick={() => { void journey.openBoardExplanation(); }}
            className="min-h-11 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">
            {journey.confirmedPlan ? "Your Meal Plan Is Saved" : "Explain This Step"}
          </button>}
        <button type="button" disabled={!journey.canExplain || journey.pending || journey.model.busy}
          onClick={() => { void journey.restart(); }} className="min-h-11 rounded-xl border border-white/30 px-4 py-2">Replay Explanations</button>
      </div>
    </section>
    {journey.explanation && <GuidedJourneyExplanation open model={journey.explanation}
      busy={journey.pending || journey.model.busy} onPrimary={() => { void journey.explanationPrimary(); }}
      onSecondary={journey.explanationSecondary} onClose={journey.dismissExplanation}
      onRestoreFocus={() => journey.restoreExplanationFocus('[data-testid="guided-meal-board-explain"]')} />}
  </>;
}
