import type { BuilderKey } from "./nutritionContext/getActiveNutritionContext";
import type { BeverageViolation } from "./guardrails/beverageMedicalRules";

export type BeverageRejectionKind =
  | "alcohol_forbidden"
  | "macro_noncompliant"
  | "other";

export interface BeverageProtocolRejection {
  error: "PROTOCOL_VIOLATION" | "CLINICAL_VIOLATION";
  message: string;
  retryable: true;
  rejectionKind: BeverageRejectionKind;
  protocolName: string | null;
  violations?: string[];
}

interface AlternativePromptInput {
  originalPrompt: string;
  requestedCategoryLabel: string;
  effectiveCategoryLabel: string;
  flavorLabel: string;
  specificDrink?: string;
  customBeverageDescription?: string;
  rejection: BeverageProtocolRejection;
}

/**
 * Returns a protocol name only when server-side context identifies it directly.
 * Client copy must not try to infer clinical identity from a generic rejection.
 */
export function getKnownBeverageProtocolName(
  builder: BuilderKey | null,
  hasResolvedGlp1Targets: boolean,
): string | null {
  if (hasResolvedGlp1Targets || builder === "glp1") return "GLP-1";

  switch (builder) {
    case "diabetic":
      return "diabetes";
    case "anti_inflammatory":
      return "anti-inflammatory";
    case "beach_body":
      return "Beachbody";
    case "general_nutrition":
      return "general nutrition";
    case "performance_competition":
      return "performance nutrition";
    default:
      return null;
  }
}

export function getBeverageRejectionKind(
  violations: Pick<BeverageViolation, "isAlcohol">[] | undefined,
  source: "macro" | "protocol" | "clinical",
): BeverageRejectionKind {
  if (violations?.some((violation) => violation.isAlcohol)) {
    return "alcohol_forbidden";
  }
  return source === "macro" ? "macro_noncompliant" : "other";
}

export function shouldOfferBeverageAlternatives(
  nodeEnvironment: string | undefined,
): boolean {
  return nodeEnvironment === "development";
}

/**
 * Keeps alternatives anchored to the actual request while explicitly telling the
 * model why the previous output was rejected. Returned candidates are still
 * treated as untrusted and pass every validator before the client sees them.
 */
export function buildBeverageAlternativePrompt({
  originalPrompt,
  requestedCategoryLabel,
  effectiveCategoryLabel,
  flavorLabel,
  specificDrink,
  customBeverageDescription,
  rejection,
}: AlternativePromptInput): string {
  const requestedDetails = [
    `Requested category: ${requestedCategoryLabel}`,
    requestedCategoryLabel !== effectiveCategoryLabel
      ? `Safety-adjusted category: ${effectiveCategoryLabel}`
      : null,
    `Requested flavor direction: ${flavorLabel}`,
    specificDrink ? `Named drink request: ${specificDrink}` : null,
    customBeverageDescription
      ? `Original free-text request: ${customBeverageDescription}`
      : null,
  ].filter(Boolean).join("\n- ");

  const alcoholInstruction =
    rejection.rejectionKind === "alcohol_forbidden"
      ? `Alcohol itself conflicts with the active safeguards. Create only alcohol-free alternatives, but preserve the requested style, flavor, and occasion. A Dive Bar request should still feel like a practical neighborhood-bar non-alcoholic drink, not generic sparkling water.`
      : `Alcohol is not automatically prohibited. Preserve an alcoholic style, spirit direction, and bar realism when it can satisfy every stated safeguard. Do not change an alcoholic request to a mocktail unless a safe alcoholic option cannot be created.`;

  return `${originalPrompt}

SAFE ALTERNATIVE MODE:
The prior drink was rejected by a safety validator and must never be shown to the user.
Rejection reason: ${rejection.message}
${rejection.violations?.length ? `Validator details: ${rejection.violations.join("; ")}` : ""}

Create up to two DIFFERENT complete beverage alternatives in this exact JSON shape:
{
  "alternatives": [
    {
      "name": "",
      "description": "",
      "ingredients": [{ "name": "", "amount": "", "unit": "" }],
      "instructions": "",
      "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
      "servingSize": "",
      "reasoning": ""
    }
  ]
}

PRESERVE THE USER'S ORIGINAL INTENT AS FAR AS THE SAFEGUARDS ALLOW:
- ${requestedDetails}
- Keep the category recognizable and practical. For a Dive Bar, use ordinary neighborhood-bar techniques and stock; do not turn every conflict into sparkling water with lime.
- Keep the flavor family, requested spirit or named drink identity, occasion, serving intent, and cultural direction whenever doing so is safe.
- ${alcoholInstruction}
- The alternatives must be real, complete drinks with realistic nutrition and concise reasoning that names the relevant ingredients, substitutions, exclusions, or preparation choices.
- Return JSON only. Do not include the rejected drink or any explanation outside the JSON object.`;
}