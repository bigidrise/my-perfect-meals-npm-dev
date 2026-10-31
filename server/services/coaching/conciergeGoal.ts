import { ConciergeDecisionSchema, type ConciergeDecision, type ConciergeGoal } from "../../../shared/coaching/schemas";
import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";

const unknownGoal: ConciergeGoal = {
  activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null,
};

/**
 * A veto, never a destination selector or keyword router. The existing reasoning
 * call interprets meaning and chooses its own question or food suggestions.
 * Known food preferences alone do not establish a preparation/restaurant goal.
 */
function goalFits(id: CoachDestinationId, goal: ConciergeGoal): boolean {
  switch (id) {
    case "craving_creator":
      return goal.activity === "prepare" && goal.occasion === "snack" && goal.specialty === "none";
    case "create_a_dish":
      return goal.activity === "prepare" && goal.specialty === "none" &&
        (goal.occasion === "meal" || (goal.dishChosen && goal.occasion === "unknown"));
    case "dessert_creator":
      return goal.activity === "prepare" && goal.occasion === "dessert";
    case "sushi_creator":
      return goal.activity === "prepare" && goal.specialty === "sushi";
    case "beverage_creator":
      return goal.activity === "prepare" && goal.occasion === "beverage" && goal.specialty !== "workout";
    case "athlete_beverage_creator":
      return goal.activity === "prepare" && goal.occasion === "beverage" && goal.specialty === "workout";
    case "restaurant_guide":
      return goal.activity === "eat_out" && goal.restaurant === "chosen";
    case "find_meals_near_me":
      return goal.activity === "eat_out" && goal.restaurant === "not_chosen";
    case "fridge_rescue": return goal.activity === "use_ingredients";
    case "hydration_center": return goal.activity === "hydration";
    case "my_perfect_buffet": return goal.activity === "buffet";
    case "my_perfect_getaway": return goal.activity === "travel";
    case "my_perfect_gatherings": return goal.activity === "gathering";
    case "macro_calculator": return goal.activity === "calculator";
    case "my_perfect_beginning": return goal.activity === "child_feeding";
  }
}

export function validateConciergeGoal(
  value: unknown,
  availableTools: Array<{ id: string }>,
  memberMessages: string[],
): ConciergeDecision | undefined {
  const parsed = ConciergeDecisionSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const decision = parsed.data;
  if (decision.mode !== "food_assistance" || !decision.destinationId) return decision;
  const id = decision.destinationId as CoachDestinationId;
  const goal = decision.goal;
  // A literal feature name is required for the explicit-request exception, but
  // the model still decides whether it is a request, negation, or discussion.
  const explicitlyRequested = goal?.explicitFeatureId === id && memberMessages.some(message =>
    message.toLocaleLowerCase().includes(COACH_DESTINATIONS[id].label.toLocaleLowerCase()));
  if (availableTools.some(tool => tool.id === id) && goal && (explicitlyRequested || goalFits(id, goal))) {
    return decision;
  }
  return { mode: "clarification", destinationId: null, goal: goal ?? { ...unknownGoal } };
}

/** Shared by reasoning and expression; no fixed question sequence or quotas. */
export const CONCIERGE_GOAL_INSTRUCTIONS = [
  "GOAL READINESS: Interpret the current goal from the latest member message and relevant history. Never select a feature from food/flavor words alone.",
  "Return goal with activity, occasion, restaurant, dishChosen, specialty, explicitFeatureId. Unknown is valid: do not invent a value to justify a destination.",
  "activity: unknown | prepare | eat_out | use_ingredients | plan_meals | hydration | buffet | travel | gathering | calculator | child_feeding.",
  "occasion: unknown | snack | meal | dessert | beverage. restaurant: unknown | chosen | not_chosen. specialty: none | sushi | workout. dishChosen: true only for an actual chosen dish.",
  "explicitFeatureId: exact available ID only when the member explicitly asks to use/open that named feature; otherwise null. A discussion, food mention, or previous assistant recommendation is not a member request.",
  "Food preference (light, flavorful, spicy, seafood, sushi, sweet, etc.) does not by itself establish activity or occasion. Unknown critical distinctions mean clarification and destinationId=null.",
  "A desire to prepare a small savory snack fits Craving Creator. Preparing a chosen dish or full meal fits Create a Dish. Preparing dessert, sushi, or a drink uses its dedicated creator. A food name alone does not imply preparation.",
  "For eating out, chosen restaurant means Restaurant Guide; explicitly wanting to find somewhere or having no restaurant chosen means Find Meals Near Me. If restaurant choice is unresolved, ask naturally; never assume a restaurant or that none is chosen.",
  "Use available ingredients only when that is the member's expressed goal. Weekly meal planning and clinical workflows require their verified hubs; if not available, explain that limitation with no substitute button.",
  "These are internal semantic considerations, not a checklist to collect from the member. Ask only one useful unresolved question, or offer a few practical food ideas. Flavor, protein, occasion, activity, budget, time, and ingredients matter only when relevant. Do not ask all of them or repeat answered questions.",
  "Keep food preferences, budget and practical constraints in the conversation; a change of mind replaces the earlier activity/restaurant/destination. Reassess readiness on this turn, not from a stale feature recommendation.",
  "Act immediately once the member's actual goal fits an available feature. A sufficiently clear preparation request needs no extra recipe/open-feature question. Keep final recommendations brief, without benefit paragraphs or a 'ready to try?' question.",
].join("\n");
