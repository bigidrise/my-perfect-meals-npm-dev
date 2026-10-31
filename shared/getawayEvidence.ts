/** Getaway currently receives place/catalog context, not a sourced venue menu. */
export const GETAWAY_MENU_NOTICE =
  "Illustrative meal ideas — not verified menu offerings. Restaurants, dishes, ingredients, preparation, availability and nutrition have not been verified. Confirm with venue staff, especially for allergies or clinical requirements.";

export const GETAWAY_EVIDENCE_INSTRUCTIONS = [
  "MENU EVIDENCE LIMIT: No verified menu, ingredient list, preparation record or nutrition data is supplied by this workflow.",
  "Catalog venues and Google Places identify locations only. Named catalog dining areas and general model knowledge are not current menu evidence.",
  "Offer 2-3 illustrative food types to ask about, not claims that named dishes or outlets actually exist or are available.",
  "Use conditional wording such as 'Ask whether available'; do not claim allergy safety or clinical compliance from an unknown recipe.",
  "Do not invent calories, protein, fat, macros or ingredient-backed nutrient values. Return null for estimated nutrition fields without source evidence.",
  "Never infer an unprovided venue, terminal, deck or dining area. Ask the member to refine an unidentified location.",
].join("\n");

function text(value: unknown): string {
  if (typeof value !== "string") return "";
  // Do not pass model-authored numeric nutrition through as menu evidence.
  return value
    .replace(/\b(?:calories?|energy)\s*[:=]\s*\d+(?:\.\d+)?(?:\s*(?:kcal|kj))?\b/gi, "[nutrition unverified]")
    .replace(/\b\d+(?:\.\d+)?\s*(?:kcal|calories?|kilojoules?|(?:g|grams?)\s+(?:of\s+)?(?:protein|fat|carb(?:ohydrate)?s?|fiber|sugars?)|(?:mg|milligrams?)\s+(?:of\s+)?(?:sodium|potassium))\b/gi, "[nutrition unverified]")
    .replace(/\b(?:protein|fat|carb(?:ohydrate)?s?|fiber|sugars?|sodium|potassium)\s*[:=]?\s*\d+(?:\.\d+)?\s*(?:g|mg|grams?|milligrams?)\b/gi, "[nutrition unverified]");
}

/** Allowlisted response fields prevent model/cache claims from self-certifying. */
export function qualifyGetawayAdvice(input: any) {
  const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  return {
    venue: text(input?.venue),
    venueType: text(input?.venueType),
    zone: typeof input?.zone === "string" ? text(input.zone) : null,
    bestChoices: Array.isArray(input?.bestChoices) ? input.bestChoices.map((choice: any) => ({
      name: text(choice?.name), where: text(choice?.where), why: text(choice?.why),
      evidenceStatus: "illustrative" as const,
    })) : [],
    whyTheyFit: strings(input?.whyTheyFit),
    avoid: Array.isArray(input?.avoid) ? input.avoid.map((item: any) => ({
      item: text(item?.item), reason: text(item?.reason),
    })) : [],
    familyNote: strings(input?.familyNote),
    coachNote: text(input?.coachNote),
    evidence: {
      version: 1 as const,
      menuStatus: "unverified" as const,
      nutritionStatus: "unverified" as const,
      notice: GETAWAY_MENU_NOTICE,
    },
  };
}
