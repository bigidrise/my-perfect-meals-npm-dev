import { z } from "zod";
import type { ConciergePresentation } from "../../../shared/coaching/types";

type PendingNavigation = NonNullable<ConciergePresentation["navigation"]>;
export function isConfirmableNavigation(
  navigation: PendingNavigation | undefined,
): navigation is PendingNavigation {
  return !!navigation && !navigation.performedAt && pendingNavigationIsFresh(navigation.offeredAt);
}
export const PendingNavigationDispositionSchema = z.enum(["preserve", "clear"]);
export const PENDING_NAVIGATION_TTL_MS = 30 * 60 * 1000;

export function pendingNavigationIsFresh(offeredAt: unknown, now = Date.now()): boolean {
  if (typeof offeredAt !== "string") return false;
  const time = Date.parse(offeredAt);
  return Number.isFinite(time) && time <= now && now - time < PENDING_NAVIGATION_TTL_MS;
}

/** Only a screened informational answer may carry an existing offer forward.
 * This neither creates a destination nor authorizes a navigation action. */
export function retainInformationalOffer(
  pending: PendingNavigation | undefined, disposition: unknown, now = Date.now(),
): PendingNavigation | undefined {
  return disposition === "preserve" && pending &&
    pendingNavigationIsFresh(pending.offeredAt, now) ? pending : undefined;
}

export const NAVIGATION_CONTINUITY_INSTRUCTIONS = [
  "NAVIGATION CONTINUITY: Interpret the latest member message using recent history and server-supplied pendingRecommendation/recentNavigationContext, not isolated keywords. navigation_confirmed/direct_navigation mean an action was offered, NOT that navigation occurred. Only performedAt is client-observed route evidence; it does not mean a recipe or task was completed. A fresh unperformed pendingRecommendation remains actionable on acceptance without another question. Never claim the member already opened, visited or completed it without client evidence. Performed navigation is context, not an unaccepted offer; unrelated yes cannot reopen it. A natural named request to reopen that destination may use direct_request.",
  "Set pendingNavigationDisposition=preserve only for a relevant informational follow-up about the SAME pending workflow with no rejection or change of intent. Set clear for rejection, cancellation, an unrelated topic, a different destination, unresolved change of workflow, or incompatible safety/care. Without a pending offer use clear. An explanation is not consent.",
  "A current valid pending offer may be accepted by a natural contextual request to locate or open that same destination, including 'Where is my builder?' after choosing Meal Builders. Use confirmed navigation and the existing pending destination/goal; do not demand its exact name again or ask permission repeatedly. A general question about how a feature works is informational, not acceptance.",
  "An explicit selection of Meal Builder or Meal Builders, including 'Take me to my meal builder', is a named workflow request. Use direct_request with meal_builders, activity=plan_meals and explicitFeatureId=meal_builders, a concise handoff and the existing button. Bare 'builder' without established pending context is not named authorization. Mentions, negations and comparisons are not opening requests.",
  "MEAL PREP CLARIFICATION: 'Meal prep', 'meal preparation', 'prepare meals for the week' and 'build my meals' can be ambiguous. Distinguish advance dated planning (Meal Builders or My Perfect Menu), preparing a specific dish (Create a Dish), and obtaining groceries (Grocery Store Coach). Ask one short useful question if the intended workflow is unresolved. Do not route generic meal prep to Grocery Coach without shopping intent or directly open a builder from those words.",
  "Once a workflow is explicitly selected, stop exploratory questions. Preserve all existing readiness, subscription, authorization and safety checks. Chef explains and directs; specialized tools create meals and plans. Never choose an assigned/clinical builder or transfer a date or meal slot.",
].join("\n");
