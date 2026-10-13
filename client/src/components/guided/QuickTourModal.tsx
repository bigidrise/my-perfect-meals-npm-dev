import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export interface TourStep {
  icon?: string;
  title: string;
  description: string;
}

interface QuickTourModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  title: string;
  steps: TourStep[];
  onDisableAllTours?: () => void;
  /** Welcome presentation only; existing page tours keep their current behavior. */
  welcome?: boolean;
  introduction?: string;
  primaryLabel?: string;
  onRestoreFocus?: () => void;
}

export function QuickTourModal({
  isOpen,
  onClose,
  title,
  steps,
  onDisableAllTours,
  welcome = false,
  introduction,
  primaryLabel = "Got it!",
  onRestoreFocus,
}: QuickTourModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(!welcome);

  const handleDisableAll = () => {
    if (onDisableAllTours) {
      onDisableAllTours();
    }
    onClose(true);
  };

  return (
    <UniversalDialog
      rawLayout
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose(dontShowAgain);
      }}
      showCloseButton={!welcome}
      onCloseAutoFocus={onRestoreFocus ? event => { event.preventDefault(); onRestoreFocus(); } : undefined}
      className={welcome
        ? "bg-zinc-950 border-white/10 text-white max-w-xl mx-auto rounded-2xl h-[min(52rem,calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
        : "bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white max-w-md mx-auto rounded-2xl"}
    >
        <DialogHeader className={welcome ? "shrink-0" : undefined}>
          {welcome && <p className="mb-3 text-sm font-semibold tracking-widest text-orange-400">MY PERFECT MEALS · WELCOME</p>}
          <DialogTitle className={welcome
            ? "text-3xl font-bold leading-tight text-white break-words [text-wrap:balance] sm:text-4xl"
            : "text-xl font-bold text-white text-center break-words [text-wrap:balance]"}>
            {title}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              Quick tour guide showing {steps.length} tips for this page
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div data-onboarding-welcome={welcome ? "" : undefined}
          className={welcome ? "min-h-0 flex-1 space-y-5 overflow-y-auto py-5 pr-2" : "space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-2"}>
          {introduction && <p className="text-base leading-relaxed text-white/80">{introduction}</p>}
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-sm font-bold text-orange-400">
                {step.icon || index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={welcome ? "font-semibold text-white text-lg leading-snug break-words" : "font-semibold text-white text-sm break-words"}>
                  {step.title}
                </h4>
                <p className={welcome ? "text-white/70 text-base leading-relaxed mt-1 break-words" : "text-white/70 text-xs mt-0.5 break-words"}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className={welcome ? "shrink-0 flex flex-col gap-3 pt-3 border-t border-white/10" : "flex flex-col gap-3 pt-2 border-t border-white/10"}>
          {welcome ? <>
            <Button
              type="button"
              onClick={() => onClose(dontShowAgain)}
              className="w-full min-h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-base font-semibold"
            >
              {primaryLabel}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-white/75">
                <input type="checkbox" checked={dontShowAgain}
                  onChange={event => setDontShowAgain(event.target.checked)}
                  className="h-4 w-4 accent-orange-500" />
                Don't show again
              </label>
              <button type="button" onClick={() => onClose(dontShowAgain)}
                className="min-h-11 rounded-lg px-3 text-sm text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
                Skip introduction
              </button>
            </div>
          </> : <div className="flex items-center justify-between">
            <PillButton
              active={dontShowAgain}
              onClick={() => setDontShowAgain(!dontShowAgain)}
              data-testid="toggle-dismiss-tour"
            >
              Don't show again
            </PillButton>

            <Button
              onClick={() => onClose(dontShowAgain)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-xl"
            >
              {primaryLabel}
            </Button>
          </div>}

          {onDisableAllTours && (
            <button
              onClick={handleDisableAll}
              className="text-xs text-white/75 hover:text-white/75 underline text-center transition-colors"
            >
              Turn Off All Tour Guides
            </button>
          )}
        </div>
    </UniversalDialog>
  );
}
