import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";
import { fallbackQuality } from "./conciergeFallback";

export type ReplyScreenReason = "accepted" | "missing" | "placeholder" | "empty_closing" | "feature_reference" |
  "route_reference" | "link" | "permission_question" | "navigation_language";
type ScreenResult = { reason: ReplyScreenReason; text?: string };

/** Output checks only. These never interpret member consent or authorize actions. */
export function navigationPermissionQuestion(message: string, development = true): boolean {
  const sentences = message.split(/[.!?？؟\n]/u);
  const permission = /^\s*(?:would you like|do you want|shall (?:I|we)|should (?:I|we)|may I|can I (?:help|assist)|ready to)\b/i;
  if (!development) {
    // Preserve the historical screen outside Development.
    return sentences.some(sentence =>
      !/\b(?:or|rather than|instead of)\b/i.test(sentence) && permission.test(sentence) &&
      /\b(?:open|use|launch|proceed|continue|start|find|search|discover|explore|assist|help)\b/i.test(sentence));
  }
  const namedFeature = Object.values(COACH_DESTINATIONS)
    .some(destination => message.toLocaleLowerCase().includes(destination.label.toLocaleLowerCase()));
  return sentences.some(sentence => {
    if (!permission.test(sentence)) return false;
    const featureTarget = Object.values(COACH_DESTINATIONS)
      .some(destination => sentence.toLocaleLowerCase().includes(destination.label.toLocaleLowerCase())) ||
      /\b(?:feature|tool|builder|creator|planner|page|screen|dashboard|app|link)\b/i.test(sentence);
    // "Help", "find" and "start" alone are normal coaching language. Require
    // an actual navigation operation/target, not merely a permission-shaped question.
    const opening = /\b(?:open|launch|navigate|redirect|route|go to|take you to|send you to)\b/i.test(sentence);
    const implicitOpening = /\b(?:open|launch)\s+(?:it|this|that)\s*(?:now|for you)?\s*$/i.test(sentence) ||
      /\b(?:navigate|redirect|route|take you|send you)\s+(?:there|back)\b/i.test(sentence);
    const referencedWorkflow = namedFeature &&
      /\b(?:use|start|continue|explore)\s+(?:it|this|that)\b/i.test(sentence);
    const workflow = /\b(?:use|start|proceed|continue)\b/i.test(sentence);
    return implicitOpening || referencedWorkflow || (featureTarget && (opening || workflow));
  });
}

export function screenIndependentConversation(message: string | null | undefined,
  allowedDestinationId?: CoachDestinationId, allowFeatureMentions = false,
  environment: string | undefined = process.env.NODE_ENV): ScreenResult {
  if (!message) return { reason: "missing" };
  if (fallbackQuality(message, environment) === "empty_closing") return { reason: "empty_closing" };
  if (!/[\p{L}\p{N}]/u.test(message) ||
    fallbackQuality(message) === "placeholder") {
    return { reason: "placeholder" };
  }
  const lower = message.toLocaleLowerCase();
  let remaining = lower;
  for (const [id, destination] of Object.entries(COACH_DESTINATIONS)
    .sort((a, b) => b[1].label.length - a[1].label.length)) {
    const label = destination.label.toLocaleLowerCase();
    if (remaining.includes(label)) {
      if (!allowFeatureMentions && id !== allowedDestinationId) return { reason: "feature_reference" };
      remaining = remaining.split(label).join("");
    }
    if (lower.includes(destination.route)) return { reason: "route_reference" };
  }
  if (/https?:\/\/|www\.|javascript:|data:|href\s*=|\]\s*\(|(?:^|\s)\/[a-z]/i.test(message)) {
    return { reason: "link" };
  }
  return { reason: "accepted", text: message };
}

export function screenOrdinaryConversation(message: string | null | undefined,
  environment: string | undefined = process.env.NODE_ENV): ScreenResult {
  if (message && navigationPermissionQuestion(message)) {
    return { reason: "permission_question" };
  }
  return screenIndependentConversation(message, undefined, true, environment);
}

export function screenConversationalContinuation(message: string | null | undefined, structuredOffer = false,
  environment: string | undefined = process.env.NODE_ENV): ScreenResult {
  const result = screenIndependentConversation(message, undefined, true, environment);
  if (!result.text) return result;
  if (!structuredOffer && navigationPermissionQuestion(result.text)) {
    return { reason: "permission_question" };
  }
  if (/\b(?:open|launch|navigate|click|tap|press|redirect|transfer|take you|taking you|send you|get you started|getting you started|button)\b/i.test(result.text)) {
    return { reason: "navigation_language" };
  }
  return result;
}
