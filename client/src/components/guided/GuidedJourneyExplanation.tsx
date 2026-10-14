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
      className="rounded-2xl border-white/15 bg-[#111111] text-white max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh]"
      onCloseAutoFocus={onRestoreFocus ? event => { event.preventDefault(); onRestoreFocus(); } : undefined}
      showCloseButton={false}
      footer={
        <>
          {model.secondaryLabel && onSecondary && <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {model.secondaryLabel}
          </button>}
          <button
            type="button"
            onClick={onPrimary}
            disabled={!model.canPerform || busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 sm:w-auto"
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">
            {model.indicator}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and pause guidance"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          >
            Close
          </button>
        </div>

        <p className="text-[15px] leading-7 text-white/85">
          {model.description}
        </p>

        {model.builderName && (
          <div className="rounded-xl border border-teal-500/25 bg-teal-950/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-300">
              Meal workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {model.builderName}
            </p>
          </div>
        )}

        {model.activityNotice && (
          <p
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm leading-6 text-amber-100"
          >
            {model.activityNotice}
          </p>
        )}
      </div>
    </UniversalDialog>
  );
}

export default GuidedJourneyExplanation;
