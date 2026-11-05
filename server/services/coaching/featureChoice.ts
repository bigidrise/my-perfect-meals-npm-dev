import type { ConciergePresentation } from "../../../shared/coaching/types";
import { pendingNavigationIsFresh } from "./conciergeNavigationContinuity";
import type { CoachDestinationId } from "../../../shared/coaching/navigation";

export type FeatureChoice = NonNullable<ConciergePresentation["featureChoice"]>;
export const DESSERT_CHOICE_QUESTION = "A small treat with Craving Creator or a full dessert with Dessert Creator?";

/** Only a current reviewed choice, never arbitrary older assistant prose. */
export function isDessertChoiceQuestion(text: string | null | undefined): boolean {
  return !!text && /[?？]/u.test(text) &&
    /\b(?:small (?:treat|portion)|Craving Creator)\b/iu.test(text) &&
    /\b(?:full dessert|larger (?:batch|dessert)|Dessert Creator)\b/iu.test(text);
}

export function selectedFeatureChoice(message: string, choice?: FeatureChoice): CoachDestinationId | undefined {
  if (choice?.kind !== "dessert_size" || !pendingNavigationIsFresh(choice.offeredAt)) return undefined;
  // Whole answers only: negations, questions, compounds and ingredient/medical
  // discussion cannot become consent. Other culinary intents stay semantic.
  const text = message.trim().replace(/[.!]+$/u, "").replace(/[‘’]/gu, "'");
  if (/^(?:(?:a|the) )?(?:whole pie|full dessert|larger batch)(?:,? please)?$/iu.test(text)) return "dessert_creator";
  if (/^(?:(?:a|the) )?(?:small treat|small portion|small)(?:,? please)?$/iu.test(text)) return "craving_creator";
  return undefined;
}
