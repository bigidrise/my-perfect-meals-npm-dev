import { useCallback, useEffect, useRef } from "react";
import { QuickTourModal } from "./QuickTourModal";
import { useQuickTour } from "@/hooks/useQuickTour";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useToast } from "@/hooks/use-toast";
import "./OnboardingWelcome.css";

/** Presentation only: neither dismissal nor the CTA saves or advances setup. */
export function OnboardingWelcome({ accountId }: { accountId: string }) {
  const guideRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const reportPreferenceError = useCallback(() => {
    toast({
      title: "Your guide preference couldn't be saved",
      description: "You can still continue setup. This introduction may appear again on your next visit.",
      variant: "destructive",
    });
  }, [toast]);
  // Reuse the existing tour controller, but isolate this page and immutable account.
  // The parent mounts this entrance only while saved onboarding is incomplete.
  const tour = useQuickTour(
    `development-setup-welcome-v1::${encodeURIComponent(accountId)}`,
    reportPreferenceError,
    { autoOpenDelayMs: 0, setupComplete: false },
  );
  const { isOpen: copilotOpen, close: closeCopilot } = useCopilot();
  useEffect(() => {
    // Yield the screen to the written welcome without changing assistant settings.
    if (tour.shouldShow && copilotOpen) closeCopilot();
  }, [tour.shouldShow, copilotOpen, closeCopilot]);

  return <>
    <div className="mx-auto flex w-full max-w-3xl justify-end px-6 pt-3">
      <button ref={guideRef} type="button" onClick={tour.openTour}
        className="min-h-11 rounded-lg px-3 text-sm text-orange-400 hover:text-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
        aria-label="Open setup guide" data-testid="onboarding-welcome-guide">
        Guide
      </button>
    </div>
    <QuickTourModal
      welcome
      completionDriven
      isOpen={tour.shouldShow}
      onClose={tour.closeTour}
      onRestoreFocus={() => guideRef.current?.focus()}
      title="Let's Get to Know You"
      introduction="Tell us about yourself, your food preferences, your goals, and your lifestyle. This helps My Perfect Meals personalize your experience around you."
      primaryLabel="Start Onboarding"
      steps={[]}
      onDisableAllTours={() => tour.setGlobalDisabled(true)}
    />
  </>;
}
