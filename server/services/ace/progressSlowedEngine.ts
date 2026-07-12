// Coach's Corner — "My progress has slowed" Situation Adapter
//
// Owns evidence gathering shape, follow-up questions, and the intent +
// recommendation logic for this situation only. Runs through the shared
// Coach Decision Engine (coachDecisionEngine.ts) — do not duplicate the
// pipeline here, only supply this situation's reasoning.

import type {
  CoachResponse,
  CoachingIntent,
  ProgressSlowedContext,
  ProgressSlowedFollowUp,
  SelfReportedWeightChange,
  SituationAdapter,
} from "../../../shared/coachCornerTypes";
import type { CoachingProfile } from "../../db/schema/ace";
import { resolveCoachingResponse } from "./coachDecisionEngine";

const MIN_WEEKS_BEFORE_JUDGING_PROGRESS = 3;
const SIGNIFICANT_WEIGHT_CHANGE_PERCENT = 7;

const SELF_REPORT_PERCENT_ESTIMATE: Record<SelfReportedWeightChange, number> = {
  none_little: 2,
  moderate: 8,
  significant: 15,
};

function determineIntent(
  context: ProgressSlowedContext,
  followUp: ProgressSlowedFollowUp
): CoachingIntent {
  const notEnoughTimeOnPlan =
    context.weeksOnPlan !== null &&
    context.weeksOnPlan < MIN_WEEKS_BEFORE_JUDGING_PROGRESS;

  const slowdownFeelsRecent = followUp.perceivedDuration === "short";

  if (notEnoughTimeOnPlan || slowdownFeelsRecent) {
    return "reassure";
  }

  const weightChangePercent =
    context.weightChangePercent !== null
      ? Math.abs(context.weightChangePercent)
      : followUp.selfReportedWeightChange
        ? SELF_REPORT_PERCENT_ESTIMATE[followUp.selfReportedWeightChange]
        : 0;

  if (weightChangePercent >= SIGNIFICANT_WEIGHT_CHANGE_PERCENT) {
    return "redirect";
  }

  return "educate";
}

function buildRecommendation(
  intent: CoachingIntent,
  _context: ProgressSlowedContext,
  _followUp: ProgressSlowedFollowUp,
  profile: CoachingProfile | null
): CoachResponse {
  const prefersUnderstanding = profile?.recoveryPreference === "understanding_why";
  const prefersSimplicity = profile?.recoveryPreference === "simple_plan";

  if (intent === "reassure") {
    return {
      intent,
      recommendation: "stay_the_course",
      message: {
        acknowledgment:
          "I hear you — it's frustrating when the scale doesn't seem to be moving the way you want.",
        recommendation:
          "For now, stay the course. Keep following your current plan exactly as it's written.",
        science: prefersUnderstanding
          ? "Weight loss almost never moves in a straight line. Water retention, sleep, hormones, and even how recently you ate can all shift the scale by several pounds without anything being wrong with your plan. A short slowdown this early usually isn't a signal to change anything — it's just how the process actually looks."
          : "This kind of short slowdown is normal, and changing your plan now would likely do more harm than good.",
        philosophy:
          "The best plan is the one you can still follow when the scale isn't cooperating — consistency through a flat week is what makes the next drop possible.",
        whatToWatchFor:
          "Keep an eye on your weight trend over the next 1-2 weeks rather than day to day. If it's still flat after that, come back and we'll look again.",
        action:
          "No changes needed right now — just keep logging so we have good data if we need to look closer later.",
      },
    };
  }

  if (intent === "redirect") {
    return {
      intent,
      recommendation: "recalculate_macros",
      message: {
        acknowledgment:
          "Thanks for sticking with it this long — real progress like yours is exactly why we need to check in.",
        recommendation:
          "It looks like your body has changed enough that your current macros may no longer match where you are now. Let's recalculate them together.",
        science:
          "As you lose weight, your body needs less energy to maintain itself, so the numbers that worked when you started can quietly become too high over time. That's not a failure on your part — it's just math catching up with your progress.",
        philosophy:
          "Never build a permanent goal on a temporary solution — your macros should keep pace with your body, not stay frozen at the number you started with.",
        whatToWatchFor:
          "After we update your numbers, give it another couple of weeks and watch whether the trend starts moving again.",
        action: prefersSimplicity
          ? "Let's go update your numbers right now — it only takes a minute."
          : "Head over to the Macro Calculator with me and we'll get your numbers realigned with where your body is today.",
      },
      routeTo: { label: "Open Macro Calculator", path: "/macro-counter" },
    };
  }

  return {
    intent: "educate",
    recommendation: "explain_plateau",
    message: {
      acknowledgment:
        "It makes sense that this is on your mind — a stretch without visible progress can feel discouraging.",
      recommendation:
        "Before we change anything, it helps to understand what's actually happening with a plateau like this.",
      science:
        "The scale is one signal, not the whole picture. Plateaus are a normal, expected part of any long-term change — your body adjusts, water weight fluctuates, and non-scale progress (energy, strength, how clothes fit) often keeps moving even when the number on the scale doesn't.",
      philosophy:
        "The scale measures one outcome — not your health. Learning to read the fuller picture is what keeps people consistent long after the scale stalls.",
      whatToWatchFor:
        "Track your weight as a weekly trend instead of a daily number, and pay attention to non-scale signals like energy and how your clothes fit over the next couple of weeks.",
      action:
        "No plan changes needed yet. If the trend is still flat in 2-3 weeks, come back and we'll take a closer look at your numbers.",
    },
  };
}

const progressSlowedAdapter: SituationAdapter<
  ProgressSlowedContext,
  ProgressSlowedFollowUp,
  CoachingProfile | null
> = {
  determineIntent,
  buildRecommendation,
};

export function resolveProgressSlowed(
  context: ProgressSlowedContext,
  followUp: ProgressSlowedFollowUp,
  profile: CoachingProfile | null
): CoachResponse {
  return resolveCoachingResponse(progressSlowedAdapter, context, followUp, profile);
}
