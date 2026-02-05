import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
}

export function QuickTourModal({
  isOpen,
  onClose,
  title,
  steps,
  onDisableAllTours,
}: QuickTourModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const handleDisableAll = () => {
    if (onDisableAllTours) {
      onDisableAllTours();
    }
    onClose(true);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose(dontShowAgain);
      }}
    >
      <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white max-w-md mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center">
            {title}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              Quick tour guide showing {steps.length} tips for this page
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-sm font-bold text-orange-400">
                {step.icon || index + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white text-sm">
                  {step.title}
                </h4>
                <p className="text-white/70 text-xs mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60 select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50"
              />
              Don't show again
            </label>

            <Button
              onClick={() => onClose(dontShowAgain)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-xl"
            >
              Got it!
            </Button>
          </div>

          {onDisableAllTours && (
            <button
              onClick={handleDisableAll}
              className="text-xs text-white/75 hover:text-white/75 underline text-center transition-colors"
            >
              Turn Off All Tour Guides
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
