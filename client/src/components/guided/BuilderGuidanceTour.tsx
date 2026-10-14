import { useEffect, useLayoutEffect, useState, type ComponentProps } from "react";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import { MEAL_BUILDER_GUIDANCE, type GuidedMealBuilderKey } from "@shared/mealBuilderGuidance";
import { guidanceInteractionBlocked, observeGuidanceInteractions } from "@/lib/guidedJourney/presentation";
import { QuickTourModal } from "./QuickTourModal";
import { GuidedJourneyExplanation } from "./GuidedJourneyExplanation";

type Props = ComponentProps<typeof QuickTourModal> & {
  builderKey: GuidedMealBuilderKey;
  professionalClient?: boolean;
  useIntroduction?: boolean;
};

export function BuilderGuidanceTour({ builderKey, professionalClient = false, useIntroduction = true, ...tour }: Props) {
  const [detailed, setDetailed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [blocked, setBlocked] = useState(() => IS_DEVELOPMENT && guidanceInteractionBlocked());
  useLayoutEffect(() => {
    if (!IS_DEVELOPMENT || !useIntroduction || !tour.isOpen || detailed) return;
    const update = () => setBlocked(guidanceInteractionBlocked());
    update();
    return observeGuidanceInteractions(update);
  }, [tour.isOpen, detailed, useIntroduction]);
  useEffect(() => {
    if (!tour.isOpen) { setDetailed(false); setDontShowAgain(false); }
  }, [tour.isOpen]);
  if (!IS_DEVELOPMENT || !useIntroduction || detailed) return <QuickTourModal {...tour} />;
  const definition = MEAL_BUILDER_GUIDANCE[builderKey];
  const close = () => tour.onClose(dontShowAgain);
  return <GuidedJourneyExplanation
    open={tour.isOpen && !blocked}
    busy={false}
    model={{
      stageId: "saved_meal_plan",
      title: professionalClient ? "Let's Build Your Client's Meals" : "Let's Create Your First Meal",
      indicator: professionalClient ? "Professional Client Builder Guide" : "Stage 3 of 3",
      description: professionalClient
        ? `You are working in ${definition.name} for the selected client. Use the existing meal controls to create or select a meal, then add it to the client's day and meal slot. The client's saved targets and applicable protocols remain in charge—not your personal setup.`
        : `Use the existing meal controls in ${definition.name} to create or select a meal, then add it to a day and meal slot. You can duplicate meals or days using the board's existing controls. When ready, use the existing grocery tools to shop for your plan.`,
      builderName: definition.name,
      primaryLabel: "Continue in Builder", secondaryLabel: "Close & Pause",
      canPerform: true, activityNotice: null,
    }}
    onPrimary={close} onSecondary={close} onClose={close}
    extraContent={<div className="space-y-4"><button type="button" onClick={() => setDetailed(true)}
      className="min-h-10 text-sm font-semibold text-teal-300 underline underline-offset-4 hover:text-teal-200">
      Read the Full Builder Guide
    </button>
    <label className="flex w-full items-center gap-2 text-sm text-white/80">
      <input type="checkbox" checked={dontShowAgain} onChange={event => setDontShowAgain(event.target.checked)}
        className="h-4 w-4 accent-teal-500" />
      Don't show this builder explanation again
    </label></div>}
  />;
}
