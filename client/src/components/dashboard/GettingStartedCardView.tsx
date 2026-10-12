import type { GettingStartedCardModel } from "../../lib/guidedJourney/dashboardModel";

interface GettingStartedCardViewProps {
  model: GettingStartedCardModel;
  onContinue: () => void;
  onRetry: () => void;
  onPauseResume: () => void;
  onToggleAutomatic: () => void;
  onRestart: () => void;
}

const stateLabels: Record<string, string> = {
  complete: "Completed",
  incomplete: "Remaining",
  unknown: "Needs check",
  not_applicable: "Not applicable",
};

export function GettingStartedCardView({
  model,
  onContinue,
  onRetry,
  onPauseResume,
  onToggleAutomatic,
  onRestart,
}: GettingStartedCardViewProps) {
  return (
    <section
      data-testid="guided-journey-card"
      aria-labelledby="getting-started-title"
      className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-lg shadow-black/20"
    >
      <div className="border-b border-white/10 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent px-5 py-4 sm:px-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
          Your next steps
        </p>
        <h2 id="getting-started-title" className="text-lg font-bold tracking-tight">
          Getting Started
        </h2>
        <p className="mt-0.5 text-sm text-zinc-300">Your My Perfect Meals Journey.</p>
      </div>

      <div className="space-y-4 px-5 py-4 sm:px-6">
        <p role="status" aria-live="polite" className="text-sm leading-relaxed text-zinc-300">
          {model.statusText}
        </p>

        {model.replayRequested && (
          <p className="rounded-lg border border-orange-300/20 bg-orange-300/5 px-3 py-2 text-sm leading-relaxed text-orange-100">
            Replay requested. Explanations are not enabled yet; your saved work is unchanged.
          </p>
        )}

        {model.paused && (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300">
            Guidance is paused. You may continue setup manually.
          </p>
        )}
        {model.automaticDisabled && (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300">
            Automatic guidance is off. Manual setup is still available.
          </p>
        )}
        {model.preferenceNotice && (
          <p className="rounded-lg border border-amber-300/25 bg-amber-300/5 px-3 py-2 text-sm leading-relaxed text-amber-100">
            {model.preferenceNotice}
          </p>
        )}

        {model.stages.length > 0 && (
          <ol className="space-y-2" aria-label="Setup stages">
            {model.stages.map((stage) => {
              const stateLabel = stateLabels[stage.state] ?? "Needs check";
              return (
                <li
                  key={stage.id}
                  className={`flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 ${
                    stage.current
                      ? "border-orange-400/40 bg-orange-500/[0.08]"
                      : "border-white/[0.07] bg-white/[0.025]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      stage.state === "complete"
                        ? "bg-emerald-400"
                        : stage.current
                          ? "bg-orange-400"
                          : stage.state === "unknown"
                            ? "bg-amber-300"
                            : "bg-zinc-600"
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-zinc-100">
                    {stage.label}
                    {stage.current && (
                      <span className="ml-2 inline-block rounded-full bg-orange-400/15 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-zinc-400">{stateLabel}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            data-testid="guided-journey-continue"
            onClick={onContinue}
            disabled={!model.canContinue}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Continue Setup
          </button>
          {model.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={model.loading || model.busy}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-orange-300/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>

        <details className="group border-t border-white/10 pt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-semibold text-zinc-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-orange-300 [&::-webkit-details-marker]:hidden">
            <span>Guidance controls</span>
            <span aria-hidden="true" className="text-zinc-500 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onPauseResume}
              disabled={!model.controlsReady}
              className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-medium text-zinc-200 hover:border-orange-300/30 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {model.paused ? "Resume Guidance" : "Pause Guidance"}
            </button>
            <button
              type="button"
              onClick={onToggleAutomatic}
              disabled={!model.controlsReady}
              className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-medium text-zinc-200 hover:border-orange-300/30 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {model.automaticDisabled ? "Enable Automatic Guidance" : "Disable Automatic Guidance"}
            </button>
            <button
              type="button"
              onClick={onRestart}
              disabled={!model.controlsReady}
              className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-medium text-zinc-200 hover:border-orange-300/30 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-2"
            >
              Restart Guidance
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}

export default GettingStartedCardView;
