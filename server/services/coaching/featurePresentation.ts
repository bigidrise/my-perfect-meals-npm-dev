import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { COACH_NAVIGATION_GUIDANCE } from "../../../shared/coaching/navigationGuidance";

// Reviewed platform descriptions, not recipes, ingredient proposals or medical advice.
const purposes: Partial<Record<CoachDestinationId, string>> = {
  beverage_creator: "create smoothies, protein shakes and other drinks customized to your preferences",
  athlete_beverage_creator: "create workout-focused drinks for training or recovery",
  fridge_rescue: "make meals using ingredients you already have",
  shopping_list: "review your shopping list and add personal items",
  meal_builders: "plan meals with an available Meal Builder",
  my_perfect_menu: "choose breakfast, lunch, dinner or snack ideas",
  restaurant_guide: "choose what to order at a restaurant you have chosen",
  find_meals_near_me: "find somewhere nearby to eat",
  craving_creator: "explore sweet or savory cravings",
};

function featureLabel(id: CoachDestinationId): string {
  const destination = COACH_DESTINATIONS[id];
  return "navigationLabel" in destination ? destination.navigationLabel : destination.label;
}

export function conciseFeatureHandoff(id: CoachDestinationId): string {
  const label = featureLabel(id);
  const entry = COACH_NAVIGATION_GUIDANCE[id].entry;
  const parent = entry.includes(" → ") ? entry.slice(0, entry.lastIndexOf(" → ")) : undefined;
  return `${parent ? `You can find ${label} under ${parent}. ` : ""}Select Open ${label} below.`;
}

export function reviewedFeatureOffer(id: CoachDestinationId): string {
  const label = featureLabel(id);
  return `${purposes[id] ? `Use ${label} to ${purposes[id]}.` : `You can use ${label}.`}\n\nWould you like me to open ${label}?`;
}

/** This only prevents replacement of relevant safety communication; it never
 * authorizes a destination or exempts model food advice from inspection. */
export function requestsSafetyAssessment(message: string): boolean {
  return /\b(?:allerg\w*|safe(?:ly|ty)?|cross[- ]contact|medical|medication|symptoms?|condition|diagnos\w*|treatment|clinical)\b|\b(?:check|verify|assess)\b.{0,45}\bingredients?\b/iu.test(message);
}
