import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { COACH_NAVIGATION_GUIDANCE, COACH_KNOWLEDGE_ONLY_NAVIGATION, verifiedNavigationText } from "../../../shared/coaching/navigationGuidance";
import type { ConciergeGoal } from "../../../shared/coaching/schemas";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundary = (name: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escape(name)}(?=$|[^\\p{L}\\p{N}_])`, "iu");

export function namedNavigationDestinations(message: string): CoachDestinationId[] {
  const matches = Object.entries(COACH_NAVIGATION_GUIDANCE).flatMap(([id, record]) =>
    record.aliases.filter(name => boundary(name).test(message)).map(name => ({ id: id as CoachDestinationId, name })));
  // Beverage Creator is contained in Athlete Beverage Creator. Likewise reject
  // ambiguous multiple names rather than choosing by object iteration order.
  return [...new Set(matches.filter(match => !matches.some(other =>
    other.id !== match.id && other.name.length > match.name.length &&
    other.name.toLowerCase().includes(match.name.toLowerCase()))).map(match => match.id))];
}

/**
 * Only whole, named navigation commands qualify. This is NOT a food-intent
 * router: comparisons, education, quotes, negations, symptoms, compound requests
 * and unnamed food wishes continue through the existing semantic/safety flow.
 */
export function explicitNavigationRequest(message: string): CoachDestinationId | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "").replace(/,\s*please$/iu, "").replace(/^please\s+/iu, "");
  const matches = namedNavigationDestinations(text);
  if (matches.length !== 1) return undefined;
  const id = matches[0];
  return COACH_NAVIGATION_GUIDANCE[id].aliases.some(name => {
    const target = `(?:the\\s+|my\\s+)?${escape(name)}`;
    return new RegExp(
      `^(?:(?:(?:can|could|would) you\\s+)?(?:open|show me|show|launch|take me to|navigate to|go to)\\s+${target}|` +
      `(?:I (?:want|would like) to (?:open|use)|I'd like to (?:open|use))\\s+${target}|` +
      `(?:where is|where can I find|how (?:do I|can I) (?:get to|find)|(?:(?:can|could) you )?give me directions to)\\s+${target}|` +
      // A bounded literal feature selection, not a generic "make me a meal".
      `${id === "create_a_dish" ? "I want to create a dish" : "(?!)"})$`, "iu",
    ).test(text);
  }) ? id : undefined;
}

export function navigationGoal(id: CoachDestinationId): ConciergeGoal {
  return {
    activity: "unknown", occasion: "unknown", restaurant: "unknown", dishChosen: false,
    specialty: "none", explicitFeatureId: id,
  };
}

/** Bounded platform education, not opening consent or permission to give food advice. */
export function verifiedMealBuildersExplanation(message: string): string | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "").replace(/^please\s+/iu, "");
  const record = COACH_NAVIGATION_GUIDANCE.meal_builders;
  const matches = record.aliases.some(alias => {
    const name = `(?:the\\s+)?${escape(alias)}`;
    return new RegExp(`^(?:how (?:do|can) I (?:use|get started with) ${name}|` +
      `(?:explain|show me) how to use ${name}|how (?:does|do) ${name} work)$`, "iu").test(text);
  });
  return matches ? record.explanation : undefined;
}

/** Resolve an explicitly unspecified restaurant need to clarification, never a destination. */
export function verifiedRestaurantClarification(message: string): string | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "").replace(/^please\s+/iu, "");
  if (!/^(?:I (?:need|want|would like)|I'd like) to (?:eat out|(?:eat|dine) (?:at|in) (?:a )?restaurant)$/iu.test(text)) return undefined;
  return `${COACH_DESTINATIONS.restaurant_guide.label} helps you choose food at a restaurant you've already selected. ` +
    `${COACH_DESTINATIONS.find_meals_near_me.label} helps you find somewhere to eat. ` +
    "Do you already have a restaurant and want help choosing food, or do you need help finding somewhere to eat?";
}

/** Model prose never supplies UI relationships. Ordinary food advice is not a
 * navigation instruction; require UI language or a named feature relationship.
 */
export function hasUnverifiedNavigationProse(message: string): boolean {
  const names = namedNavigationDestinations(message);
  const ui = names.length > 0 || /\b(?:dashboard|shopping list|page|screen|tab|button|lifestyle|menu)\b/iu.test(message);
  if (!ui) return false;
  return /\b(?:open|launch|navigate|click|tap|press|select|go to|head to|look for|find it|located|access it|taking you|take you|send you)\b/iu.test(message) ||
    /\b(?:inside|within|under|through|via|from|in|on)\s+(?:the\s+|your\s+)?(?:shopping list|dashboard|lifestyle|[\p{L} -]+(?:page|tab|menu|screen))\b/iu.test(message) ||
    (names.length > 1 && /\b(?:contains|includes|houses)\b/iu.test(message)) ||
    /(?:→|➜|›|\s>\s)/u.test(message);
}

/** Recovery is read-only text. It never grants an action or reconstructs consent. */
export function verifiedLocationAnswer(message: string, tools: Array<{ id: string }>): string | undefined {
  const ids = namedNavigationDestinations(message);
  if (ids.length === 0) return knowledgeOnlyLocationAnswer(message);
  if (ids.length !== 1 || !tools.some(tool => tool.id === ids[0])) return undefined;
  const id = ids[0];
  const record = COACH_NAVIGATION_GUIDANCE[id];
  return `${COACH_DESTINATIONS[id].label}: ${record.entry}. ${record.start}`;
}

export function knowledgeOnlyLocationAnswer(message: string, wholeRequest = false): string | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "");
  const matches = Object.values(COACH_KNOWLEDGE_ONLY_NAVIGATION).filter(record =>
    record.aliases.some(alias => wholeRequest
      ? new RegExp(`^(?:please\\s+)?(?:(?:(?:can|could) you )?(?:open|show me|take me to|give me directions to)|where is|how do I (?:find|get to|use))\\s+(?:the\\s+|my\\s+)?${escape(alias)}$`, "iu").test(text)
      : boundary(alias).test(text)));
  if (matches.length !== 1) return undefined;
  const record = matches[0];
  return `${record.entry}. ${record.start} Chef can explain this location, but cannot provide its opening action yet.`;
}

export { verifiedNavigationText };
