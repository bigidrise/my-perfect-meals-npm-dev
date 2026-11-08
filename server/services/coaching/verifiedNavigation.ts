import { type CoachDestinationId } from "../../../shared/coaching/navigation";
import { COACH_NAVIGATION_GUIDANCE, DIABETIC_BUILDER_EXPLANATION, verifiedNavigationText as releasedNavigationText } from "../../../shared/coaching/navigationGuidance";
import type { ConciergeGoal } from "../../../shared/coaching/schemas";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundary = (name: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escape(name)}(?=$|[^\\p{L}\\p{N}_])`, "iu");

export function namedNavigationDestinations(message: string): CoachDestinationId[] {
  const matches = Object.entries(COACH_NAVIGATION_GUIDANCE).flatMap(([id, record]) =>
    record.aliases.filter(name => boundary(name).test(message)).map(name => ({ id: id as CoachDestinationId, name })));
  // Resolve nested names by their longest verified alias, never object order.
  return [...new Set(matches.filter(match => !matches.some(other =>
    other.id !== match.id && other.name.length > match.name.length &&
    other.name.toLowerCase().includes(match.name.toLowerCase()))).map(match => match.id))];
}

/** A whole named selection is a handoff request; questions and mentions are not. */
export function namedFeatureSelection(message: string): CoachDestinationId | undefined {
  if (/[?？؟]/u.test(message)) return undefined;
  const text = message.trim().replace(/[.!]+$/u, "").replace(/,?\s+please$/iu, "").replace(/^please\s+/iu, "");
  const matches = namedNavigationDestinations(text);
  if (matches.length !== 1) return undefined;
  const id = matches[0];
  return COACH_NAVIGATION_GUIDANCE[id].aliases.some(alias => new RegExp(
    `^(?:(?:I (?:want|choose|pick)|I'd like|I would like|let['’]s (?:use|do|go with))\\s+)?(?:the\\s+|my\\s+)?${escape(alias)}$`,
    "iu",
  ).test(text)) ? id : undefined;
}

/** Reviewed directions only. Does not emit an action or pending consent. */
export function verifiedFeatureDirections(id: CoachDestinationId): string {
  if (id === "meal_builders") return verifiedNavigationText(id);
  if (id === "fridge_rescue") {
    return "Go to Lifestyle → Fridge Rescue, enter the ingredients you have, then generate a meal.";
  }
  const guidance = COACH_NAVIGATION_GUIDANCE[id];
  return `Go to ${guidance.entry}.` + (guidance.start ? ` ${guidance.start}` : "");
}

/** Whole named commands only; food, symptoms, comparisons and negations are not consent. */
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
      `(?:(?:can|could) you )?give me directions to\\s+${target}|` +
      `${id === "create_a_dish" ? "I want to create a dish" : "(?!)"})$`, "iu",
    ).test(text);
  }) ? id : undefined;
}

/** Finding a destination is not consent to open it. Match only whole questions. */
export function navigationDestinationQuestion(message: string): CoachDestinationId | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "").replace(/^please\s+/iu, "");
  const matches = namedNavigationDestinations(text);
  if (matches.length !== 1) return undefined;
  const id = matches[0];
  return COACH_NAVIGATION_GUIDANCE[id].aliases.some(name => new RegExp(
    `^(?:where (?:is|are|can I find|can I see|do I find)|how (?:do I|can I) (?:get to|find))\\s+(?:the\\s+|my\\s+)?${escape(name)}$`, "iu",
  ).test(text)) ? id : undefined;
}

/** Whole consent binds only a fresh, server-loaded offer, never a guessed target. */
export function acceptsPendingFeature(message: string): boolean {
  return /^(?:yes(?: please)?|yeah|yep|sure(?: thing)?|certainly|absolutely|ok(?:ay)?|please do|go ahead|(?:please )?(?:open|use|launch) (?:it|that)|let['’]s do (?:it|that)|(?:(?:ok(?:ay)?|yes|sure),?\s+)?(?:please\s+)?take me there)[.!?]*$/iu.test(message.trim());
}

export function navigationGoal(id: CoachDestinationId): ConciergeGoal {
  return {
    activity: "unknown", occasion: "unknown", restaurant: "unknown", dishChosen: false,
    specialty: "none", explicitFeatureId: id,
  };
}

/** Educational wording never grants an action or food/clinical authority. */
export function verifiedDiabeticBuilderExplanation(message: string): string | undefined {
  const text = message.trim().replace(/[.!?]+$/u, "").replace(/^please\s+/iu, "");
  const name = "(?:the\\s+)?Diabetic (?:Meal|Menu) Builder";
  return new RegExp(`^(?:what is ${name}(?: used for)?|how does ${name} work|tell me about ${name}|explain ${name})$`, "iu").test(text)
    ? DIABETIC_BUILDER_EXPLANATION : undefined;
}

/** Development guidance only; routes, consent and eligibility are unchanged. */
export function verifiedNavigationText(id: CoachDestinationId, includeStartingSteps = true): string {
  const entry = releasedNavigationText(id, includeStartingSteps);
  if (process.env.NODE_ENV !== "development") return entry;
  if (id === "meal_builders") {
    // The founder requires this reminder on every builder handoff, even when
    // other starting instructions are omitted. Do not link a hub-only tutorial.
    return `${entry} Watch the Builder Tutorial video at the top of your builder for a walkthrough, then follow the builder's steps to create your meals.`;
  }
  if (id === "fridge_rescue" && includeStartingSteps) {
    return `${entry} Enter the ingredients you already have, then follow the page's steps to create a meal.`;
  }
  return entry;
}
