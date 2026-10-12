import { UniversalDialog } from "../ui/universal-modal";
import type { GuidedJourneyExplanationModel } from "../../lib/guidedJourney/explanation";

interface GuidedJourneyExplanationProps {
  open: boolean;
  model: GuidedJourneyExplanationModel;
  busy: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  onRestoreFocus?: () => void;
}

export function GuidedJourneyExplanation({
  open,
  model,
  busy,
  onPrimary,
  onSecondary,
  onClose,
  onRestoreFocus,
}: GuidedJourneyExplanationProps) {
  return (
    <UniversalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={model.title}
      description={<span className="sr-only">{model.description}</span>}
      className="rounded-2xl border-stone-200 bg-stone-50 text-stone-950 max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh]"
      onCloseAutoFocus={onRestoreFocus ? event => { event.preventDefault(); onRestoreFocus(); } : undefined}
      showCloseButton={false}
      footer={
        <>
          {model.secondaryLabel && onSecondary && <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {model.secondaryLabel}
          </button>}
          <button
            type="button"
            onClick={onPrimary}
            disabled={!model.canPerform || busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 sm:w-auto"
          >
            {model.primaryLabel}
          </button>
        </>
      }
    >
      <div
        data-guided-journey-explanation
        className="space-y-5 px-1 pb-1"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">
            {model.indicator}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and pause guidance"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            Close
          </button>
        </div>

        <p className="text-[15px] leading-7 text-stone-700">
          {model.description}
        </p>

        {model.builderName && (
          <div className="rounded-xl border border-teal-900/10 bg-teal-50/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
              Meal workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-800">
              {model.builderName}
            </p>
          </div>
        )}

        {model.activityNotice && (
          <p
            role="status"
            className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
          >
            {model.activityNotice}
          </p>
        )}
      </div>
    </UniversalDialog>
  );
}

export default GuidedJourneyExplanation;
