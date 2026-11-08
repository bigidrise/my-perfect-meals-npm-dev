import { containsGenericClosing, isGenericClosingSentence } from "./replyQuality";

/** Development response-quality screening only: never user-intent or consent routing. */
export type FallbackQuality = "useful" | "placeholder" | "acknowledgment" | "empty_closing" | "generic_closing";
export function fallbackQuality(text: string | null | undefined,
  environment: string | undefined = process.env.NODE_ENV): FallbackQuality {
  // Assess the prose, without modifying the actual candidate or stripping an
  // unsafe clause before the caller's whole-message safety screen.
  const prose = (text ?? "").normalize("NFKC").replace(/:[a-z0-9_+-]+:/gi, " ")
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, " ");
  if (!/[\p{L}\p{N}]/u.test(prose)) return "placeholder";
  if (/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(prose.trim())) return "placeholder";
  const words = prose.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (environment === "development") {
    if (isGenericClosingSentence(prose)) return "empty_closing";
    if (containsGenericClosing(prose)) return "generic_closing";
  }
  const acknowledgments = /^(?:(?:yes|yeah|yep|ok|okay|sure|absolutely|certainly|great|perfect|wonderful|awesome|excellent|nice|indeed|thanks|thank you|got it|understood|i understand|no problem|you re welcome|happy to help|glad to help|i can help(?: with that)?|sounds (?:good|great|delicious|like (?:a )?(?:delicious|good|great|wonderful|perfect) (?:plan|idea))|that sounds (?:good|great|delicious)|(?:that s )?(?:a )?(?:great|good|delicious) (?:choice|plan|idea)|none|null|undefined|n a)\s*)+$/u;
  return acknowledgments.test(words) ? "acknowledgment" : "useful";
}

export type FallbackOutcome = FallbackQuality | "unsafe";
export function selectRejectedConversation(
  candidates: { message?: string | null; conversationMessage?: string | null },
  screen: (text: string | null | undefined) => string | undefined,
) {
  const inspect = (value: string | null | undefined) => {
    const quality = fallbackQuality(value);
    const safe = screen(value);
    return { outcome: (quality !== "useful" ? quality : safe ? "useful" : "unsafe") as FallbackOutcome,
      text: quality === "useful" ? safe : undefined };
  };
  // Evaluate BOTH, never select by length. Preserve independent-continuation
  // precedence, but do not let an empty/acknowledgment variant hide useful prose.
  const message = inspect(candidates.message);
  const conversation = inspect(candidates.conversationMessage);
  return {
    text: conversation.text ?? message.text,
    selectedField: conversation.text ? "conversationMessage" : message.text ? "message" : "retry",
    outcomes: { message: message.outcome, conversationMessage: conversation.outcome },
  };
}

export const HANDOFF_RECOVERY =
  "I couldn't complete that response or confirm a feature to open. Nothing has been opened. Please try your request again.";
export const CONVERSATION_RECOVERY =
  "I couldn't complete that response. Nothing has been opened. Please try your request again.";
export const MISSING_PENDING_RECOVERY =
  "I don't have a feature selected for that handoff. Please name the feature you'd like to open.";
