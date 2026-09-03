// Coach's Corner — "I'm tired" Situation Adapter
//
// Owns evidence gathering shape, follow-up questions, and the intent +
// recommendation logic for this situation only. Runs through the shared
// Coach Decision Engine (coachDecisionEngine.ts) — do not duplicate the
// pipeline here, only supply this situation's reasoning.

import type {
  CoachResponse,
  CoachingIntent,
  SituationAdapter,
  TiredContext,
  TiredFollowUp,
} from "../../../shared/coachCornerTypes";
import type { CoachingProfile } from "../../db/schema/ace";
import { resolveCoachingResponse } from "./coachDecisionEngine";

const RECENT_PLAN_CHANGE_WINDOW_DAYS = 14;

function determineIntent(
  context: TiredContext,
  followUp: TiredFollowUp
): CoachingIntent {
  if (followUp.sleepQuality === "poor") {
    return "redirect";
  }

  const recentPlanChange =
    context.recentlyReducedCarbsOrSugar &&
    context.daysSincePlanChange !== null &&
    context.daysSincePlanChange <= RECENT_PLAN_CHANGE_WINDOW_DAYS;

  if (recentPlanChange || followUp.duration === "today") {
    return "educate";
  }

  return "reassure";
}

function buildRecommendation(
  intent: CoachingIntent,
  _context: TiredContext,
  followUp: TiredFollowUp,
  profile: CoachingProfile | null
): CoachResponse {
  const prefersUnderstanding = profile?.recoveryPreference === "understanding_why";
  const prefersSimplicity = profile?.recoveryPreference === "simple_plan";

  if (intent === "redirect") {
    return {
      intent,
      recommendation: "prioritize_sleep_and_hydration",
      message: {
        acknowledgment:
          "Thanks for telling me — feeling drained day after day is worth paying attention to.",
        recommendation:
          "Before we touch your food plan, let's focus on sleep and hydration for the next few days — those two things affect energy more than almost anything else.",
        science:
          "Poor sleep raises the hormones that drive hunger and fatigue while lowering the ones that help you feel steady and alert, so even a perfect nutrition plan can't fully compensate for it.",
        philosophy:
          "The best plan is the one you can still follow when you're running on empty — fix the foundation first, then judge the plan.",
        whatToWatchFor:
          followUp.timing === "afternoon_slump"
            ? "Notice whether the afternoon dip improves once you're sleeping more consistently."
            : "Notice whether your energy improves over the next few nights of better sleep.",
        action: prefersSimplicity
          ? "Aim for one small, concrete change tonight — lights off 30 minutes earlier."
          : "Try to protect a consistent bedtime and keep water intake steady through the day, then check back in with me in a few days.",
      },
    };
  }

  if (intent === "educate") {
    return {
      intent,
      recommendation: "explain_adaptation_fatigue",
      message: {
        acknowledgment:
          "It makes sense you're noticing this — a dip in energy right after a change to how you're eating is really common.",
        recommendation:
          "For now, stay the course. This kind of tiredness is usually temporary while your body adjusts.",
        science: prefersUnderstanding
          ? "When you reduce carbs or sugar, your body has to shift from quickly burning glucose to relying more on stored energy. That shift takes days to weeks to feel smooth, so a period of lower energy is a normal, expected part of adjusting — not a sign anything is wrong."
          : "This kind of tiredness after a food change is usually temporary and doesn't mean the plan is wrong.",
        philosophy:
          "Progress isn't measured by how easy today feels. It's measured by the decisions you keep making when today is difficult.",
        whatToWatchFor:
          "Keep an eye on your energy over the next week. If it hasn't started improving by then, let's look closer together.",
        action:
          "No changes needed right now — keep hydrating and keep meals consistent while your body adjusts.",
      },
    };
  }

  return {
    intent: "reassure",
    recommendation: "normalize_and_monitor",
    message: {
      acknowledgment:
        "I hear you — feeling low on energy is frustrating, especially when you're putting in the effort.",
      recommendation:
        "There's nothing here that points to a problem with your plan, so let's just keep an eye on it for now.",
      science:
        "Energy naturally fluctuates day to day based on sleep, stress, activity, and even the weather — a stretch of feeling tired without a clear cause doesn't usually mean something needs to change.",
      philosophy:
        "Not every dip needs a fix. Sometimes the most disciplined move is to stay steady and let your body catch up.",
      whatToWatchFor:
        "If this continues for more than a week, or you notice a pattern (like always after certain meals), come back and we'll dig into it.",
      action:
        "No plan changes needed right now — just keep tracking how you feel so we have good information if it continues.",
    },
  };
}

const tiredAdapter: SituationAdapter<TiredContext, TiredFollowUp, CoachingProfile | null> = {
  determineIntent,
  buildRecommendation,
};

export function resolveTired(
  context: TiredContext,
  followUp: TiredFollowUp,
  profile: CoachingProfile | null
): CoachResponse {
  return resolveCoachingResponse(tiredAdapter, context, followUp, profile);
}
